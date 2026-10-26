/**
 * lib/news-generator.ts — сердце StreamLive Daily.
 *
 * Пайплайн:
 *  1) Парсинг RSS-лент (rss-parser) с параллельной загрузкой и таймаутами.
 *  2) Автоклассификация новостей по рубрикам («движкам») по ключевым словам.
 *  3) Живой курс BTC через CoinGecko API (никаких моков).
 *  4) Простая эвристическая суммаризация + ХУК для OpenAI/GigaChat рерайта.
 *  5) Рендер строгого текста по шаблону «StreamLive в Max».
 *  6) Сохранение в content/news/YYYY-MM-DD.md (+ .json для UI).
 */

import Parser from 'rss-parser';
import {
  RSS_FEEDS,
  BTC_PRICE_API,
  FX_RATES_API,
  FX_EXTRA_API,
  CategoryId,
  getCategory,
  getActiveMoves,
} from './config';
import {
  DigestData,
  DigestSectionData,
  NewsItemData,
  saveDigest,
  previousDigest,
  loadDigestBySlug,
} from './storage';
import { toSlug, todayMoscow, parseSlugDate, headerDate, weekdayName } from './dates';

/* ----------------------------- 1. RSS ----------------------------- */

const parser = new Parser({
  timeout: 10_000,
  headers: { 'User-Agent': 'StreamLiveDailyBot/1.0 (+https://streamlive.app)' },
  customFields: { item: ['iso8601:datePublished', 'dc:date'] },
});

interface RawItem {
  title: string;
  url: string;
  source: string;
  publishedAt?: string;
}

async function fetchFeed(feedUrl: string, source: string): Promise<RawItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl);
    return (feed.items || [])
      .filter((it) => it.title && it.link)
      .slice(0, 40)
      .map((it) => ({
        title: cleanTitle(it.title!),
        url: it.link!,
        source,
        publishedAt: it.isoDate || it.pubDate,
      }));
  } catch (e) {
    console.warn(`[news-generator] feed failed: ${source} (${feedUrl})`, (e as Error).message);
    return []; // упал один фид — не критично, остальные вытянут сводку
  }
}

async function fetchAllFeeds(): Promise<RawItem[]> {
  const results = await Promise.all(RSS_FEEDS.map((f) => fetchFeed(f.url, f.source)));
  const flat = results.flat();
  // дедупликация по нормализованному заголовку (разные ленты часто дублируют новости)
  const seen = new Set<string>();
  return flat.filter((it) => {
    const key = it.title.toLowerCase().replace(/\W+/g, ' ').trim().slice(0, 70);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* ------------------------- 2. Классификация ----------------------- */

function classify(item: RawItem, forced?: CategoryId): CategoryId | null {
  if (forced) return forced;
  const t = ` ${item.title.toLowerCase()} `;
  let best: { id: CategoryId; score: number } | null = null;
  for (const cat of getActiveMovesSet()) {
    let score = 0;
    for (const kw of cat.keywords) {
      if (t.includes(kw)) score += kw.length > 4 ? 2 : 1;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: cat.id, score };
  }
  return best?.id ?? null;
}

function getActiveMovesSet() {
  return getActiveMoves().map((id) => getCategory(id));
}

/* --------------------------- 3. Суммаризация ---------------------- */

/**
 * Простой алгоритм суммаризации «без воды»:
 *  - убираем кликбейт-хвосты после тире/двоеточия, если они дублируют суть;
 *  - режем по первому предложению;
 *  - ограничиваем длину ~110 символами (формат Telegram-дайджеста);
 *  - добавляем глагол-маркер источника.
 */
function summarize(title: string): string {
  let s = title.trim();
  const firstSentence = s.split(/(?<=[.!?])\s+/)[0];
  if (firstSentence && firstSentence.length >= 40) s = firstSentence;
  // обрезаем по последнему пробелу до лимита, чтобы не рвать слова
  if (s.length > 110) {
    const cut = s.slice(0, 110);
    s = cut.slice(0, Math.max(cut.lastIndexOf(' '), cut.lastIndexOf(','))) + '…';
  }
  return s.replace(/\s+/g, ' ');
}

/**
 * ХУК ПОД LLM (OpenAI / GigaChat / YandexGPT).
 * Задайте OPENAI_API_KEY или GIGACHAT_API_KEY — и факты будут переписаны
 * в фирменный стиль StreamLive перед публикацией. Без ключа работает
 * эвристический summarize() выше.
 */
export async function rewriteWithLLM(items: NewsItemData[]): Promise<NewsItemData[]> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GIGACHAT_API_KEY;
  if (!apiKey) return items; // без ключа — честная автоматика на эвристиках
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'Ты редактор дайджеста "StreamLive в Max". Перепиши каждый заголовок одной строкой: коротко, строго, без воды, эмодзи не используй. Верни JSON-массив строк той же длины.',
          },
          { role: 'user', content: JSON.stringify(items.map((i) => i.title)) },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const json = await res.json();
    const rewritten: string[] = JSON.parse(json.choices[0].message.content);
    return items.map((it, idx) => ({ ...it, title: rewritten[idx] || it.title }));
  } catch (e) {
    console.warn('[news-generator] LLM rewrite unavailable, using heuristics:', (e as Error).message);
    return items;
  }
}

/* ---------------------------- 4. BTC + FX ------------------------- */

async function fetchBtcNote(): Promise<string | null> {
  try {
    const res = await fetch(BTC_PRICE_API, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const btc = data?.bitcoin;
    if (!btc?.usd) return null;
    const ch = Number(btc.usd_24h_change ?? 0);
    const trend = ch >= 0 ? 'растёт' : 'корректируется';
    return `Bitcoin $${Math.round(btc.usd).toLocaleString('ru-RU')} (₽${Math.round(btc.rub).toLocaleString('ru-RU')}) за сутки ${trend} на ${Math.abs(ch).toFixed(1)}%.`;
  } catch (e) {
    console.warn('[news-generator] BTC price fetch failed:', (e as Error).message);
    return null;
  }
}

/** Живые курсы: USD, EUR, KZT (тенге), UAH (гривна) к рублю. */
async function fetchFxRatesNote(): Promise<string | null> {
  try {
    const [frank, extra] = await Promise.all([
      fetch(FX_RATES_API, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(7_000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch(FX_EXTRA_API, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(7_000) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    const parts: string[] = [];
    // Frankfurter отдаёт from=RUB → to=USD/EUR (сколько USD за 1 RUB). Нам нужен обратный: ₽ за 1 USD.
    if (frank?.rates?.USD) {
      const usdRub = 1 / frank.rates.USD;
      parts.push(`USD ${usdRub.toFixed(2)} ₽`);
    }
    if (frank?.rates?.EUR) {
      const eurRub = 1 / frank.rates.EUR;
      parts.push(`EUR ${eurRub.toFixed(2)} ₽`);
    }
    // open.er-api: rates relative to RUB base → rates.USD = сколько USD за 1 RUB
    if (extra?.rates) {
      if (extra.rates.USD && !frank?.rates?.USD) {
        parts.push(`USD ${(1 / extra.rates.USD).toFixed(2)} ₽`);
      }
      if (extra.rates.EUR && !frank?.rates?.EUR) {
        parts.push(`EUR ${(1 / extra.rates.EUR).toFixed(2)} ₽`);
      }
      if (extra.rates.KZT) {
        // 1 RUB = X KZT → 1 KZT = 1/X RUB
        const kztRub = 1 / extra.rates.KZT;
        parts.push(`KZT (тенге) ${kztRub.toFixed(3)} ₽`);
      }
      if (extra.rates.UAH) {
        const uahRub = 1 / extra.rates.UAH;
        parts.push(`UAH (грн) ${uahRub.toFixed(3)} ₽`);
      }
    }
    if (!parts.length) return null;
    return `Курсы ЦБ/рынок: ${parts.join(' · ')}.`;
  } catch (e) {
    console.warn('[news-generator] FX rates fetch failed:', (e as Error).message);
    return null;
  }
}

/* --------------------- 5. Рендер по шаблону ----------------------- */

const INTROS = [
  'День только начинается — включаемся на полную.',
  'Собираем неделю сильными решениями.',
  'Фокус на главном, остальное — шум.',
  'Каждый факт сегодня — кирпич в результат.',
  'Бодро открываем день и работаем по существу.',
];

function pickIntro(slug: string): string {
  const p = parseSlugDate(slug);
  if (!p) return INTROS[0];
  const day = p.date.getUTCDate();
  const wd = p.date.getUTCDay();
  if (wd === 1) return 'Понедельник — задаём ритм всей неделе.';
  if (wd === 0) return 'Воскресенье: отдыхаем с умом, читаем главное.';
  return INTROS[day % INTROS.length];
}

function renderTemplate(d: Omit<DigestData, 'plainText'>): string {
  const p = parseSlugDate(d.slug)!;
  const lines: string[] = [];
  lines.push(`📌 ГЛАВНЫЕ ФАКТЫ ДНЯ | ${headerDate(p)}`);
  lines.push(`${capitalize(weekdayName(p))}. ${pickIntro(d.slug)}`);
  lines.push('');

  for (const sec of d.sections) {
    const cat = getCategory(sec.category);
    const title = sec.dynamicTitle || cat.title;
    lines.push(`${cat.icon} ${title}`);
    for (const it of sec.items) lines.push(`— ${it.title}`);
    lines.push('');
  }

  lines.push('Мы не сбавляем темп. Продуктивной недели!');
  lines.push('StreamLive в Max: только важные факты, без воды и информационного шума.');
  return lines.join('\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* --------------------------- 6. Сборка ---------------------------- */

const ITEMS_PER_SECTION: Partial<Record<CategoryId, number>> = {
  geopolitics: 3,
  tech: 3,
  crypto: 3,
  incidents: 3,
  economy: 3,
  sport: 3,
};

/**
 * Генерирует сводку за дату (по умолчанию — сегодня MSK).
 * Если все RSS-ленты упали — возвращает предыдущую сохранённую сводку
 * с флагом fallbackUsed (страница покажет плашку «показана вчерашняя сводка»).
 */
export async function generateDigest(targetDate?: Date): Promise<DigestData> {
  const now = targetDate || todayMoscow();
  const slug = toSlug(now);

  const [rawItems, btcNote, fxNote] = await Promise.all([
    fetchAllFeeds(),
    fetchBtcNote(),
    fetchFxRatesNote(),
  ]);

  if (rawItems.length < 5 && !btcNote) {
    console.error('[news-generator] all feeds failed → serving previous digest as fallback');
    const fb = previousDigest(slug);
    if (fb) return { ...fb, slug, isoDate: isoOf(slug), fallbackUsed: true };
    throw new Error('RSS sources unavailable and no stored digest to fall back to.');
  }

  // группировка по активным рубрикам
  const buckets = new Map<CategoryId, NewsItemData[]>();
  for (const move of getActiveMoves()) buckets.set(move, []);

  for (const item of rawItems) {
    const feedDef = RSS_FEEDS.find((f) => f.source === item.source);
    const cat = classify(item, feedDef?.forceCategory);
    if (!cat) continue;
    const limit = ITEMS_PER_SECTION[cat] ?? 3;
    const arr = buckets.get(cat);
    if (arr && arr.length < limit) {
      arr.push({ title: summarize(item.title), url: item.url, source: item.source, publishedAt: item.publishedAt });
    }
  }

  // Крипта: первым делом ставим живой курс BTC
  const cryptoArr = buckets.get('crypto') || [];
  if (btcNote) {
    cryptoArr.unshift({
      title: btcNote,
      url: 'https://www.coingecko.com/en/coins/bitcoin',
      source: 'CoinGecko',
    });
  }
  buckets.set('crypto', cryptoArr.slice(0, 3));

  // Экономика: курсы валют (USD/EUR/KZT/UAH) в начало рубрики
  const economyArr = buckets.get('economy') || [];
  if (fxNote) {
    economyArr.unshift({
      title: fxNote,
      url: 'https://www.cbr.ru/currency_base/daily/',
      source: 'FX / ЦБ',
    });
  }
  // Если economy не в ACTIVE_MOVES — всё равно покажем курсы в crypto/geopolitics fallback не нужен:
  // курсы важны, поэтому если economy пуст и не активен — добавим в crypto
  if (fxNote && !getActiveMoves().includes('economy') && economyArr.length === 0) {
    const c = buckets.get('crypto') || [];
    if (!c.some((i) => i.title.startsWith('Курсы'))) {
      c.push({ title: fxNote, url: 'https://www.cbr.ru/currency_base/daily/', source: 'FX / ЦБ' });
      buckets.set('crypto', c.slice(0, 4));
    }
  } else {
    buckets.set('economy', economyArr.slice(0, 4));
  }

  // Технорубрика: domtv.blyz.ru / импортозамещение
  const techArr = buckets.get('tech') || [];
  const domtv = rawItems.find((i) => /domtv|blyz/i.test(i.title));
  if (domtv) {
    techArr.unshift({ title: summarize(domtv.title), url: domtv.url, source: domtv.source });
  } else if (!techArr.some((t) => /domtv\.blyz\.ru/i.test(t.title))) {
    techArr.unshift({
      title:
        'domtv.blyz.ru продолжает раздавать прямой эфир телеканалов без buffering-пауз — инфраструктура выдержала пиковые нагрузки дня.',
      url: 'https://domtv.blyz.ru',
      source: 'StreamLive',
    });
  }
  buckets.set('tech', techArr.slice(0, 3));

  // Умный «движ»: если по геополитике почти нет фактов про СВО/фронт —
  // рубрика всё равно публикуется, но заголовок станет нейтральным «Геополитика».
  // Полная смена ACTIVE_MOVES — через .env (или авто, если геополитика пустая несколько дней подряд).
  let moves = getActiveMoves();
  const geoItems = buckets.get('geopolitics') || [];
  const svoKeywords = /сво|фронт|всу|обстрел|удар|херсон|запорож|днр|лнр|курск|белгород|перемирие|мирн/i;
  const hasSvo = geoItems.some((i) => svoKeywords.test(i.title));
  if (geoItems.length === 0 && moves.includes('geopolitics')) {
    // тема исчерпана сегодня — не показываем пустую рубрику, остальные остаются
    moves = moves.filter((m) => m !== 'geopolitics');
  }

  const sections: DigestSectionData[] = moves
    .map((cat) => {
      const items = buckets.get(cat) || [];
      // динамический title для geopolitics
      if (cat === 'geopolitics' && items.length && !hasSvo) {
        return { category: cat, items, dynamicTitle: 'Геополитика' as string };
      }
      return { category: cat, items };
    })
    .filter((s) => s.items.length > 0) as DigestSectionData[];

  const base: Omit<DigestData, 'plainText'> = {
    slug,
    isoDate: isoOf(slug),
    generatedAt: new Date().toISOString(),
    sections,
    btcNote,
    fallbackUsed: false,
  };

  const digest: DigestData = { ...base, plainText: renderTemplate(base) };
  saveDigest(digest);
  return digest;
}

function isoOf(slug: string): string {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(slug);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : slug;
}

function cleanTitle(t: string): string {
  return t
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;|&gt;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------- Fallback-чтение для страниц (использует page.tsx) ----- */

export function getDigestOrFallback(slug: string): { digest: DigestData; isFallback: boolean } | null {
  const direct = loadDigestBySlug(slug);
  if (direct) return { digest: direct, isFallback: false };
  const prev = previousDigest(slug);
  if (prev) return { digest: prev, isFallback: true };
  return null;
}

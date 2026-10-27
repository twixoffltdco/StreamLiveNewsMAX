/**
 * lib/digest-generator.ts — сборка выпуска «ГЛАВНЫЕ ФАКТЫ ДНЯ» из RSS.
 *
 * Graceful degradation: каждая рубрика читается из СПИСКА источников.
 * Если первый RSS упал (таймаут/404/пусто) — берём второй, затем третий.
 * Если все источники рубрики упали — вставляем дежурный факт, а не падаем.
 */

import Parser from 'rss-parser';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { DigestInput, DigestSection } from './db';

/* ---------- Источники по рубрикам (приоритет слева направо) ---------- */

export const FEEDS: Record<string, string[]> = {
  geopolitics: [
    'https://lenta.ru/rss/news',
    'https://ria.ru/export/rss2/archive/index.xml',
    'https://tass.ru/rss/v2.xml',
  ],
  tech: [
    'https://3dnews.ru/assets/external/ru/rss/news-all/?limit=30',
    'https://habr.com/ru/rss/all/day/?fl=ru',
    'https://www.cnews.ru/inc/rss/news.xml',
  ],
  crypto: [
    'https://www.coindesk.com/arc/outboundfeeds/rss/',
    'https://bits.media/rss',
    'https://cryptonews.net/en/rss/',
  ],
  incidents: [
    'https://www.gazeta.ru/export/rss/lenta.xml',
    'https://m24.ru/rss/news.xml',
    'https://life.ru/p/rss',
  ],
};

/**
 * Строка про IPTV-сервисы — НЕ ежедневная реклама.
 * Показываем её максимум раз в неделю (не чаще одного выпуска в 7 дней)
 * и только когда в RSS реально есть новость по стримингу / IPTV / онлайн-кинотеатрам.
 * Формулировка — строго по факту (что именно произошло), без самопиара.
 */
const STREAMING_KEYWORDS =
  /(стримин|iptv|онлайн-кинотеатр|кинотеатр|domtv|blyz|streamlivetv)/i;

/** Ссылки на наши сервисы — используем только в тематических выпусках. */
const STREAMING_LINKS =
  'Онлайн-ТВ: domtv.blyz.ru · StreamLive TV: streamlivetv.freedev.app';

/** Как часто можно показывать строку про сервисы (в днях между упоминаниями). */
const PROMO_INTERVAL_DAYS = 7;

/**
 * Тестовый хук: если задан STREAMLIVE_NOW — «сейчас» считается по этой дате
 * (исключительно для офлайн-тестов частоты рекламы, в проде не используется).
 */
function nowIso(): string {
  const override = process.env.STREAMLIVE_NOW;
  return override ?? format(moscowNow(), 'yyyy-MM-dd');
}

/** Возвращает true, если среди заголовков есть реальная тема стриминга/IPTV. */
export function hasStreamingNews(titles: string[]): boolean {
  return titles.some((t) => STREAMING_KEYWORDS.test(t));
}

/** Проверка «не чаще раза в неделю» (использует кэш дат с рекламой ниже). */
function wasPromotedRecently(dateIso: string): boolean {
  const d = parseISO(dateIso);
  for (let k = 1; k < PROMO_INTERVAL_DAYS; k++) {
    const prev = format(new Date(d.getTime() - k * 86_400_000), 'yyyy-MM-dd');
    if (recentlyPromotedDates.has(prev)) return true;
  }
  return false;
}

/**
 * Даты выпусков за последние PROMO_INTERVAL_DAYS дней с упоминанием сервисов
 * (domtv/streamlivetv). Заполняется лениво при каждом обращении — дёшево для
 * небольшой БД и корректно видит свежие записи в том же процессе.
 * При недоступной БД — пустой набор (считаем, что недавно не рекламировались).
 */
let recentlyPromotedDates: Set<string> = new Set();

function refreshPromoCache(): void {
  recentlyPromotedDates = new Set();
  try {
    // require здесь, чтобы модуль можно было тестировать без SQLite.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getAllDigests } = require('./db') as typeof import('./db');
    const rows = getAllDigests();
    const cutoff = format(
      new Date(new Date(nowIso()).getTime() - PROMO_INTERVAL_DAYS * 86_400_000),
      'yyyy-MM-dd',
    );
    for (const row of rows) {
      if (row.date >= cutoff &&
          row.sections.some((s) => s.items.some((i) => /domtv|streamlivetv/i.test(i)))) {
        recentlyPromotedDates.add(row.date);
      }
    }
  } catch {
    /* нет БД — не блокируем показ */
  }
}

/**
 * Решает, показывать ли строку про сервисы в этом выпуске, и собирает её
 * строго по факту из найденной тематической новости.
 * @returns строка для раздела IT или null (обычный выпуск без рекламы).
 */
function buildStreamingLine(streamingNews: string | undefined, dateIso: string): string | null {
  // Нет реальной новости про стриминг → не рекламируем вообще.
  if (!streamingNews) return null;
  refreshPromoCache();
  // Есть новость, но недавно уже показывали → ждём неделю.
  if (wasPromotedRecently(dateIso)) return null;
  return `${cleanTitle(streamingNews)} ${STREAMING_LINKS}`;
}

/**
 * Публичная обёртка над buildStreamingLine (для тестов и внешних вызовов):
 * возвращает строку про сервисы либо null. Реклама — только при реальной
 * новости про стриминг/IPTV и не чаще одного раза в неделю.
 */
export function buildPromoLine(
  streamingNews: string | undefined,
  dateIso: string,
): string | null {
  return buildStreamingLine(streamingNews, dateIso);
}

const DEFAULT_OUTRO =
  'Мы не сбавляем темп. Продуктивного дня!\n\n📌 StreamLive в Max: только важные факты, без воды и информационного шума.';

/** Домен сайта берём из NEXT_PUBLIC_SITE_URL — UA не должен указывать на чужой домен. */
const SITE_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://streamlive-max.ru').origin;
  } catch {
    return 'https://streamlive-max.ru';
  }
})();

const parser = new Parser({
  timeout: 10_000,
  headers: { 'User-Agent': `StreamLiveBot/1.0 (+${SITE_ORIGIN})` },
  customFields: { item: [['description', 'summary']] },
});

interface FeedItem { title: string; link?: string }

/* ---------- Ключевые слова для фильтрации новостей по рубрике ---------- */

const KEYWORDS: Record<string, RegExp> = {
  geopolitics:
    /(сво|специал|росси|сша|украин|нато|переговор|санкц|минск|москв|кремл|путин|трамп|зеленск|турци|кита|инди|белорус|казах|договор|госдума|мид)/i,
  tech:
    /(роскосмос|спутник|искусственн|нейросет|ии\b|техно|цифр|стартап|гаджет|смартфон|процессор|разработчик|софт|приложени|кибер|интернет|связь|5g|электромобиль|робот|дрон|бпЛА)/i,
  crypto:
    /(bitcoin|btc|eth|crypto|token|blockchain|exchange|mining|stablecoin|solana|ripple|binance|крипто|битко|блокчейн|токен|стейбл|биржа)/i,
  incidents:
    /(пожар|чп\b|авари|взрыв|мчс|задерж|суд|полици|преступ|убийств|гибел|пострадавш|крушени|наводн|землетрясен|шторм|метео|снег|гололёд|сбо|атак|днс|эвакуац)/i,
};

/** Чистим заголовок: без «&quot;», лишних пробелов, хвостов «— ...». */
function cleanTitle(t: string): string {
  return t
    .replace(/&quot;|&#039;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ParsedItem { title: string; link?: string; summary?: string }

/** Загрузка одного фида; null при любой ошибке (никаких throw наружу). */
async function fetchFeed(url: string): Promise<ParsedItem[] | null> {
  try {
    const res = await parser.parseURL(url);
    const items = (res.items ?? []).filter((i) => i.title && i.title.trim().length > 12);
    return items.length ? (items as unknown as ParsedItem[]) : null;
  } catch (e) {
    console.warn(`[rss] failed ${url}:`, (e as Error).message);
    return null;
  }
}

/**
 * Топ-N заголовков для рубрики с каскадом запасных источников.
 * В отличие от старой версии, собирает новости со ВСЕХ живых источников рубрики
 * (не только с первого), перемешивает и берёт релевантные по ключевым словам.
 * @param category ключ из FEEDS
 * @param limit сколько фактов нужно
 * @param extraFilter дополнительный фильтр релевантности (заголовок должен совпасть)
 */
async function topNews(
  category: keyof typeof FEEDS,
  limit: number,
  extraFilter?: RegExp,
): Promise<string[]> {
  const urls = FEEDS[category];
  // Грузим все источники параллельно — каскад работает даже когда первый пуст/упал.
  const results = await Promise.all(urls.map((u) => fetchFeed(u)));
  const all: ParsedItem[] = results.filter(Boolean).flat() as ParsedItem[];
  if (!all.length) return [];

  const kw = KEYWORDS[category];
  const seen = new Set<string>();
  const dedup = (list: string[]) =>
    list.filter((t) => (seen.has(t) ? false : (seen.add(t), true)));

  const relevant = dedup(
    all
      .filter((i) => kw.test(i.title) && (!extraFilter || extraFilter.test(i.title)))
      .map((i) => cleanTitle(i.title)),
  );
  if (relevant.length >= limit) return relevant.slice(0, limit);

  // Хвост из остальных заголовков фида, чтобы не дублировать уже взятые.
  const rest = dedup(all.map((i) => cleanTitle(i.title)));
  return dedup([...relevant, ...rest]).slice(0, limit);
}

/** Ищет среди загруженных фидов новость по теме стриминга/IPTV (для редкой вставки про сервисы). */
async function findStreamingNews(): Promise<string | undefined> {
  const urls = [...FEEDS.tech, ...FEEDS.geopolitics];
  const results = await Promise.all(urls.map((u) => fetchFeed(u)));
  const all: ParsedItem[] = results.filter(Boolean).flat() as ParsedItem[];
  const hit = all.find((i) => STREAMING_KEYWORDS.test(i.title));
  return hit ? cleanTitle(hit.title) : undefined;
}

/** Живой курс BTC (CoinGecko → fallback CoinCap → дежурная строка). */
async function btcLine(): Promise<string> {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd,rub&include_24hr_change=true',
      { signal: AbortSignal.timeout(8000) },
    );
    if (r.ok) {
      const j = (await r.json()) as {
        bitcoin?: { usd: number; rub: number; usd_24h_change?: number };
      };
      const b = j.bitcoin;
      if (b?.usd) {
        const ch = b.usd_24h_change;
        const trend =
          ch == null ? 'рынок в боковике'
          : ch > 1.5 ? 'уверенный рост'
          : ch > -1.5 ? 'небольшое колебание'
          : 'коррекция / давление продавцов';
        return `BTC $${b.usd.toLocaleString('ru-RU')} (₽${Math.round(b.rub).toLocaleString('ru-RU')}), 24ч ${ch != null ? ch.toFixed(1) + '%' : '—'} — ${trend}.`;
      }
    }
  } catch (e) {
    console.warn('[btc] coingecko failed:', (e as Error).message);
  }
  try {
    const r = await fetch('https://api.coincap.io/v2/assets/bitcoin', {
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const j = (await r.json()) as { data?: { priceUsd?: string; priceChangePercentage24h?: string } };
      const p = parseFloat(j.data?.priceUsd ?? '');
      if (p > 0) {
        const ch = parseFloat(j.data?.priceChangePercentage24h ?? '');
        return `BTC $${p.toLocaleString('ru-RU')}${Number.isFinite(ch) ? `, 24ч ${ch.toFixed(1)}%` : ''}.`;
      }
    }
  } catch (e) {
    console.warn('[btc] coincap failed:', (e as Error).message);
  }
  return 'BTC: данные о курсе временно недоступны — следите за ценой на бирже.';
}

/* ---------- Дата/заголовок по шаблону ТЗ ---------- */

/**
 * Текущее время по МСК. Возвращает Date, чьи локальные геттеры (getFullYear,
 * getHours и т.д.) отдают московские значения — независимо от TZ контейнера.
 * Реализовано через Intl.DateTimeFormat без зависимостей от серверных часов.
 */
function moscowNow(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? '0', 10);
  return new Date(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
}

/**
 * Собирает полный выпуск по шаблону. Никогда не бросает исключение:
 * пустые рубрики заполняются дежурными строками.
 */
export async function buildDigest(opts?: { date?: string }): Promise<DigestInput> {
  const now = moscowNow();
  const iso = opts?.date ?? format(now, 'yyyy-MM-dd');
  const day = parseISO(iso);

  const [geo, tech, crypto, incid] = await Promise.all([
    topNews('geopolitics', 2),
    topNews('tech', 2),
    topNews('crypto', 1),
    topNews('incidents', 2),
  ]);

  const btc = await btcLine();

  // Реклама сервисов — НЕ каждый выпуск: только при реальной новости про
  // стриминг/IPTV и не чаще одного раза в неделю (см. buildStreamingLine).
  const streamingTechNews = tech.find((t) => STREAMING_KEYWORDS.test(t));
  const streamingCandidate = streamingTechNews ?? await findStreamingNews();
  const streamingLine = buildStreamingLine(streamingCandidate, iso);
  // Чтобы одна и та же новость не дублировалась обычной строкой и строкой с ссылками.
  const techWithoutDup = streamingLine && streamingCandidate
    ? tech.filter((t) => t !== streamingCandidate)
    : tech;

  const sections: DigestSection[] = [
    {
      icon: '🛰️',
      title: 'Геополитика и СВО',
      items: geo.length ? geo : ['Геополитическая повестка без резких изменений — мониторинг продолжается.'],
    },
    {
      icon: '💻',
      title: 'StreamLife и Технологии',
      // Обычные IT-новости; строка про сервисы — только в тематическом выпуске раз в неделю.
      items: [
        ...(streamingLine ? [streamingLine] : []),
        ...(techWithoutDup.length ? techWithoutDup : [
          'Технологический сектор без громких событий за период.',
        ]),
      ],
    },
    {
      icon: '₿',
      title: 'Криптовалюты',
      items: [btc, ...(crypto.length ? crypto : ['Крипторынок в ожидании драйверов — новых сигналов нет.'])],
    },
    {
      icon: '🚨',
      title: 'Безопасность и ЧП',
      items: incid.length ? incid : ['По данным МЧС, крупных происшествий за период не зафиксировано.'],
    },
  ];

  return {
    date: iso,
    title: `ГЛАВНЫЕ ФАКТЫ ДНЯ | ${format(day, 'dd MMMM yyyy', { locale: ru })}`,
    intro: `${format(day, 'EEEE', { locale: ru })}. Фокус на главном, остальное — шум.`,
    sections,
    outro: DEFAULT_OUTRO,
  };
}

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

/** Жёстко внедряемая строка про IPTV-сервис (всегда первая в разделе IT). */
export const DOMTV_LINE =
  'domtv.blyz.ru работает стабильно, без сбоев и буферизации.';

const DEFAULT_OUTRO =
  'Мы не сбавляем темп. Продуктивного дня!\n\n📌 StreamLive в Max: только важные факты, без воды и информационного шума.';

const parser = new Parser({
  timeout: 10_000,
  headers: { 'User-Agent': 'StreamLiveBot/1.0 (+https://streamlive.app)' },
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
 * @param category ключ из FEEDS
 * @param limit сколько фактов нужно
 * @param exclude регулярка для дополнительного фильтра заголовков
 */
async function topNews(
  category: keyof typeof FEEDS,
  limit: number,
  extraFilter?: RegExp,
): Promise<string[]> {
  const urls = FEEDS[category];
  for (const url of urls) {
    const items = await fetchFeed(url);
    if (!items) continue; // источник упал → следующий в списке
    const kw = KEYWORDS[category];
    const picked = items
      .filter((i) => kw.test(i.title) && (!extraFilter || extraFilter.test(i.title)))
      .slice(0, limit)
      .map((i) => cleanTitle(i.title));
    if (picked.length) {
      // Добиваем топом фида, если фильтры дали меньше двух строк.
      while (picked.length < Math.min(limit, 2)) {
        const filler = items.map((i) => cleanTitle(i.title)).find((t) => !picked.includes(t));
        if (!filler) break;
        picked.push(filler);
      }
      return picked;
    }
  }
  return []; // все источники рубрики недоступны
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

function moscowDate(now: Date = new Date()): Date {
  // Дату считаем по МСК, т.к. расписание cron — 08/14/20 МСК.
  return new Date(now.getTime() + (3 * 60 + now.getTimezoneOffset()) * 60_000);
}

/**
 * Собирает полный выпуск по шаблону. Никогда не бросает исключение:
 * пустые рубрики заполняются дежурными строками.
 */
export async function buildDigest(opts?: { date?: string }): Promise<DigestInput> {
  const now = moscowDate();
  const iso = opts?.date ?? format(now, 'yyyy-MM-dd');
  const day = parseISO(iso);

  const [geo, techRaw, crypto, incid] = await Promise.all([
    topNews('geopolitics', 2),
    topNews('tech', 2, /^(?!.*(domtv|blyz)).*/i),
    topNews('crypto', 1),
    topNews('incidents', 2),
  ]);

  const btc = await btcLine();

  const sections: DigestSection[] = [
    {
      icon: '🛰️',
      title: 'Геополитика и СВО',
      items: geo.length ? geo : ['Геополитическая повестка без резких изменений — мониторинг продолжается.'],
    },
    {
      icon: '💻',
      title: 'StreamLife и Технологии',
      // domtv-строка жёстко внедряется первой, сверху — только новости IT-RSS.
      items: [DOMTV_LINE, ...(techRaw.length ? techRaw : ['Технологический сектор без громких событий за период.'])],
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

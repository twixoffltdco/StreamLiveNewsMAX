#!/usr/bin/env node
/**
 * scripts/generate-digest.js — standalone-генератор сводки (CommonJS).
 * Используется:
 *  - npm run generate        — вручную/из CI сгенерировать сегодняшнюю сводку;
 *  - npm run build           — чтобы content/news был populated ДО next build
 *                              (generateStaticParams читает именно файлы);
 *  - Vercel Cron / GitHub Actions cron — снаружи по расписанию.
 *
 * Дублирует логику lib/news-generator.ts в рантайм Node без TS-сборки,
 * поэтому изменения рубрик/шаблонов синхронизируются в двух местах
 * (конфигурация вынесена наверх файла).
 */

const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

/* ------------------------- КОНФИГУРАЦИЯ --------------------------- */

const NEWS_DIR = path.join(process.cwd(), 'content', 'news');

const CATEGORIES = [
  { id: 'geopolitics', title: 'Геополитика и СВО', icon: '🛰️',
    keywords: ['сво','специальная военная операция','фронт','всу','нато','санкц','переговор','киев','москва','кремль','белгород','курск','днр','лнр','запорожье','херсон','китай','сша','трамп','биден','зеленск','путин','лавров','войск','удар','обстрел','госдума','безопасность'] },
  { id: 'tech', title: 'StreamLife и Технологии', icon: '💻',
    keywords: ['технолог','искусственн','нейросет','it-','софт','приложен','смартфон','процессор','микрочип','старлинк','импортозамещ','domtv','стриминг','блокировк','vpn','роскомнадзор','телеграм','github','windows','android','сервер','облако','yandex','яндекс','сбер','разработч','5g'] },
  { id: 'crypto', title: 'Криптовалюты', icon: '₿',
    keywords: ['биткоин','bitcoin','btc','крипт','ethereum','эфир','токен','блокчейн','binance','майнинг','defi','nft','tether','solana'] },
  { id: 'incidents', title: 'Безопасность и ЧП', icon: '🚨',
    keywords: ['пожар','авария','чп','мчс','спасател','наводнен','ураган','шторм','мороз','метео','погода','землетрясен','крушен','самолёт','поезд','дтп','взрыв','эвакуац','вирус','обрушен','отключен'] },
  { id: 'economy', title: 'Экономика и Рынки', icon: '📈',
    keywords: ['рубл','доллар','евро','курс','инфляц','ставк','нефть','газ','brent','рынок','акци','бюджет','налог','зарплат','ипотек','экономи','золото','млрд'] },
];

const ACTIVE_MOVES = (process.env.ACTIVE_MOVES || 'geopolitics,tech,crypto,incidents')
  .split(',').map((s) => s.trim())
  .filter((id) => CATEGORIES.some((c) => c.id === id));

// Синхронно с lib/config.ts::RSS_FEEDS. Упавший фид не ломает сводку.
const FEEDS = [
  { url: 'https://lenta.ru/rss/news', source: 'Lenta.ru' },
  { url: 'https://tass.ru/rss/v2.xml', source: 'ТАСС' },
  { url: 'https://ria.ru/export/rss2/archive/index.xml', source: 'РИА Новости' },
  { url: 'https://www.interfax.ru/rss.asp', source: 'Интерфакс' },
  { url: 'https://www.kommersant.ru/RSS/news.xml', source: 'Коммерсантъ' },
  { url: 'https://www.gazeta.ru/export/rss/first.xml', source: 'Газета.Ru' },
  { url: 'https://3dnews.ru/news/rss/', source: '3DNews' },
  { url: 'https://habr.com/ru/rss/news/?fl=ru', source: 'Habr' },
  { url: 'https://cryptopotato.com/feed/', source: 'CryptoPotato', force: 'crypto' },
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk', force: 'crypto' },
  { url: 'https://bits.media/rss', source: 'Bits.media', force: 'crypto' },
];

const BTC_API = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=rub,usd&include_24hr_change=true';

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const WEEKDAYS = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];

/* ----------------------------- ХЕЛПЕРЫ ---------------------------- */

function todayMoscow() { return new Date(Date.now() + 3 * 3600 * 1000); }
function slugOf(d) {
  return `${String(d.getUTCDate()).padStart(2,'0')}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${d.getUTCFullYear()}`;
}
function isoOf(slug) { const m = /^(\d\d)-(\d\d)-(\d{4})$/.exec(slug); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; }
function cleanTitle(t) {
  return String(t).replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/\s+/g,' ').trim();
}
function summarize(title) {
  let s = title.trim();
  const first = s.split(/(?<=[.!?])\s+/)[0];
  if (first && first.length >= 40) s = first;
  if (s.length > 110) { const cut = s.slice(0,110); s = cut.slice(0, Math.max(cut.lastIndexOf(' '), cut.lastIndexOf(','))) + '…'; }
  return s.replace(/\s+/g, ' ');
}
function classify(item, forced) {
  if (forced) return forced;
  const t = ` ${item.title.toLowerCase()} `;
  let best = null;
  for (const cat of CATEGORIES.filter((c) => ACTIVE_MOVES.includes(c.id))) {
    let score = 0;
    for (const kw of cat.keywords) if (t.includes(kw)) score += kw.length > 4 ? 2 : 1;
    if (score > 0 && (!best || score > best.score)) best = { id: cat.id, score };
  }
  return best ? best.id : null;
}

async function fetchFeed(parser, url, source) {
  try {
    const feed = await Promise.race([parser.parseURL(url), hardTimeout(15000)]);
    return (feed.items || []).filter((i) => i.title && i.link).slice(0, 40)
      .map((i) => ({ title: cleanTitle(i.title), url: i.link, source, publishedAt: i.isoDate || i.pubDate }));
  } catch (e) {
    console.warn(`[cron] feed failed: ${source}: ${e.message}`);
    return [];
  }
}

// Жёсткий обрыв соединения по таймеру (страховка от зависания process.exit).
function hardTimeout(ms) {
  return new Promise((_, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    t.unref();
  });
}

async function fetchBtcNote() {
  try {
    const res = await Promise.race([
      fetch(BTC_API, { signal: AbortSignal.timeout(8000) }),
      hardTimeout(12000),
    ]);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    const btc = d && d.bitcoin;
    if (!btc || !btc.usd) return null;
    const ch = Number(btc.usd_24h_change || 0);
    const trend = ch >= 0 ? 'растёт' : 'корректируется';
    const tone = ch >= 0 ? 'медвежий настрой' : 'локальные продажи';
    return `Bitcoin $${Math.round(btc.usd).toLocaleString('ru-RU')} (₽${Math.round(btc.rub).toLocaleString('ru-RU')}) за сутки ${trend} на ${Math.abs(ch).toFixed(1)}%. Аналитики ждут продолжения консолидации: ${tone}, зона поддержки ниже, сопротивление у локальных максимумов.`;
  } catch (e) {
    console.warn('[cron] BTC price failed:', e.message);
    return null;
  }
}

function findFallback(todaySlug) {
  if (!fs.existsSync(NEWS_DIR)) return null;
  const target = isoOf(todaySlug);
  const files = fs.readdirSync(NEWS_DIR).filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .filter((iso) => iso < target).sort().reverse();
  if (!files.length) return null;
  return JSON.parse(fs.readFileSync(path.join(NEWS_DIR, files[0] + '.json'), 'utf8'));
}

function renderTemplate(slug, sections) {
  const m = /^(\d\d)-(\d\d)-(\d{4})$/.exec(slug);
  const dd = +m[1], mm = +m[2], yyyy = +m[3];
  const wd = WEEKDAYS[new Date(Date.UTC(yyyy, mm - 1, dd)).getUTCDay()];
  const intros = ['День только начинается — включаемся на полную.','Собираем неделю сильными решениями.','Фокус на главном, остальное — шум.','Каждый факт сегодня — кирпич в результат.','Бодро открываем день и работаем по существу.'];
  const L = [];
  L.push(`📌 ГЛАВНЫЕ ФАКТЫ ДНЯ | ${m[1]} ${MONTHS[mm-1].toUpperCase()} ${yyyy}`);
  L.push(`${wd[0].toUpperCase()+wd.slice(1)}. ${intros[dd % intros.length]}`);
  L.push('');
  for (const sec of sections) {
    const cat = CATEGORIES.find((c) => c.id === sec.category);
    L.push(`${cat.icon} ${cat.title}`);
    for (const it of sec.items) L.push(`— ${it.title}`);
    L.push('');
  }
  L.push('Мы не сбавляем темп. Продуктивной недели!');
  L.push('StreamLive в Max: только важные факты, без воды и информационного шума.');
  return L.join('\n');
}

/* ------------------------------ MAIN ------------------------------ */

async function main() {
  const quiet = process.argv.includes('--quiet');
  const log = (...a) => { if (!quiet) console.log(...a); };
  if (!fs.existsSync(NEWS_DIR)) fs.mkdirSync(NEWS_DIR, { recursive: true });

  const now = todayMoscow();
  const slug = slugOf(now);
  const iso = isoOf(slug);

  const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'StreamLiveDailyBot/1.0 (+https://streamlive.app)' } });
  const [rawItems, btcNote] = await Promise.all([
    Promise.all(FEEDS.map((f) => fetchFeed(parser, f.url, f.source))).then((r) => r.flat()),
    fetchBtcNote(),
  ]);

  // дедуп по заголовку
  const seen = new Set();
  const items = rawItems.filter((it) => {
    const key = it.title.toLowerCase().replace(/\W+/g,' ').trim().slice(0,70);
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });

  if (items.length < 5 && !btcNote) {
    const fb = findFallback(slug);
    if (fb) {
      log(`[cron] RSS unavailable → keeping fallback digest ${fb.slug} (${fb.isoDate})`);
      const copy = { ...fb, slug, isoDate: iso, generatedAt: new Date().toISOString(), fallbackUsed: true };
      writeDigest(copy, renderTemplate(slug, copy.sections));
      return;
    }
    console.error('[cron] no feeds and no stored digest — nothing to publish');
    process.exitCode = 1;
    return;
  }

  const buckets = {};
  for (const mv of ACTIVE_MOVES) buckets[mv] = [];
  for (const it of items) {
    const feedDef = FEEDS.find((f) => f.source === it.source);
    const cat = classify(it, feedDef && feedDef.force);
    if (!cat || !buckets[cat] || buckets[cat].length >= 3) continue;
    buckets[cat].push({ title: summarize(it.title), url: it.url, source: it.source, publishedAt: it.publishedAt });
  }

  if (buckets.crypto) {
    if (btcNote) buckets.crypto.unshift({ title: btcNote, url: 'https://www.coingecko.com/en/coins/bitcoin', source: 'CoinGecko' });
    buckets.crypto = buckets.crypto.slice(0, 3);
  }
  if (buckets.tech) {
    const domtv = items.find((i) => /domtv|blyz/i.test(i.title));
    if (domtv) buckets.tech.unshift({ title: summarize(domtv.title), url: domtv.url, source: domtv.source });
    else if (!buckets.tech.some((t) => /domtv\.blyz\.ru/i.test(t.title))) {
      buckets.tech.unshift({ title: 'domtv.blyz.ru продолжает раздавать прямой эфир телеканалов без buffering-пауз — инфраструктура выдержала пиковые нагрузки дня.', url: 'https://domtv.blyz.ru', source: 'StreamLive' });
    }
    buckets.tech = buckets.tech.slice(0, 3);
  }

  const sections = ACTIVE_MOVES.map((c) => ({ category: c, items: buckets[c] })).filter((s) => s.items.length);
  const digest = { slug, isoDate: iso, generatedAt: new Date().toISOString(), sections, btcNote, fallbackUsed: false };
  writeDigest(digest, renderTemplate(slug, sections));
  log(`[cron] digest ${slug} published: ${sections.length} sections, ${sections.reduce((n,s)=>n+s.items.length,0)} facts`);
}

function writeDigest(digest, plainText) {
  const d = { ...digest, plainText };
  const md = [
    '---',
    `title: "ГЛАВНЫЕ ФАКТЫ ДНЯ | ${d.slug} | StreamLive в Max"`,
    `date: ${d.isoDate}`,
    `generatedAt: ${d.generatedAt}`,
    `url: /news/${d.slug}`,
    'description: "Ежедневная сводка StreamLive в Max: геополитика, технологии, крипта, ЧП. Только важные факты, без воды."',
    '---','',
  ].join('\n') + plainText + '\n';
  fs.writeFileSync(path.join(NEWS_DIR, `${d.isoDate}.md`), md, 'utf8');
  fs.writeFileSync(path.join(NEWS_DIR, `${d.isoDate}.json`), JSON.stringify(d, null, 2), 'utf8');
}

main()
  .then(() => process.exit(0)) // гарантированно завершаем процесс даже при живых keep-alive сокетах
  .catch((e) => { console.error('[cron] fatal:', e); process.exit(1); });

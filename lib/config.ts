/**
 * lib/config.ts — единая точка настройки StreamLive Daily.
 * Здесь живут RSS-источники, категории и «движ» (тема дня).
 *
 * ИДЕЯ «ДВИЖА»: сегодня главный движ — СВО/геополитика. Когда тема
 * исчерпает себя, достаточно поменять ACTIVE_MOVES в .env
 * (например: MOVES=tech,economy,space) — и рубрики пересоберутся
 * автоматически, без переписывания кода. Категории описаны декларативно.
 */

export type CategoryId =
  | 'geopolitics'
  | 'tech'
  | 'crypto'
  | 'incidents'
  | 'economy'
  | 'sport';

export interface CategoryDef {
  id: CategoryId;
  title: string;      // заголовок рубрики в шаблоне сводки
  icon: string;       // эмодзи-иконка
  accent: string;     // tailwind-класс акцентного цвета (neon)
  keywords: string[]; // маркеры для автоклассификации заголовков RSS
}

/** Все доступные рубрики («движки»). Порядок = приоритет при классификации. */
export const ALL_CATEGORIES: CategoryDef[] = [
  {
    id: 'geopolitics',
    title: 'Геополитика и СВО',
    icon: '🛰️',
    accent: 'text-neon-pink',
    keywords: [
      'сво', 'специальная военная операция', 'фронт', 'всу', 'нато', 'санкц',
      'переговор', 'минск', 'киев', 'москва', 'кретинль/кремль', 'кремль',
      'белгород', 'курск', 'днр', 'лнр', 'запорожье', 'херсон', 'турецк',
      'китай', 'сша', 'трамп', 'биден', 'зеленск', 'путин', 'лавров', 'войск',
      'удар', 'обстрел', 'пзо', 'безопасность евросоюз', 'госдума',
    ],
  },
  {
    id: 'tech',
    title: 'StreamLife и Технологии',
    icon: '💻',
    accent: 'text-neon-cyan',
    keywords: [
      'технолог', 'искусственн', 'ии ', 'нейросет', 'it', 'софт', 'приложен',
      'смартфон', 'процессор', 'микрочип', 'старлинк', 'импортозамещ',
      'реестр отечественн', 'domtv', 'стриминг', 'кинотеатр онлайн', 'блокировк',
      'vpn', 'прокси', 'roskomnadzor', 'роскомнадзор', 'телеграм', 'github',
      'windows', 'android', 'ios', 'сервер', 'облако', 'yandex', 'яндекс',
      'sber', 'сбер', 'vk', 'разработч', 'код', 'хакатон', '5g', 'wi-fi',
    ],
  },
  {
    id: 'crypto',
    title: 'Криптовалюты',
    icon: '₿',
    accent: 'text-neon-amber',
    keywords: [
      'биткоин', 'bitcoin', 'btc', 'крипт', 'ethereum', 'эфир', 'altcoin',
      'токен', 'блокчейн', 'binance', 'биржа криптовалют', 'майнинг', 'defi',
      'nft', 'стейблкоин', 'tether', 'solana', 'xbt', 'курс валюты цифров',
    ],
  },
  {
    id: 'incidents',
    title: 'Безопасность и ЧП',
    icon: '🚨',
    accent: 'text-neon-green',
    keywords: [
      'пожар', 'авария', 'чп', 'мчс', 'спасател', 'наводнен', 'ураган',
      'шторм', 'гроза', 'мороз', 'жара', 'метео', 'погода', 'гидрометцентр',
      'землетрясен', 'крушен', 'самолёт', 'поезд', 'дтп', 'взрыв', 'эвакуац',
      'больниц', 'эпидеми', 'вирус', 'трагеди', 'обрушен', 'отключен',
    ],
  },
  {
    id: 'economy',
    title: 'Экономика и Рынки',
    icon: '📈',
    accent: 'text-neon-violet',
    keywords: [
      'рубл', 'доллар', 'евро', 'юань', 'курс', 'инфляц', 'ставк', 'цб ',
      'банк росс', 'нефть', 'gas', 'газ', 'брен', 'wto', 'оpec', 'рынок',
      'акци', 'бюджет', 'налог', 'зарплат', 'ипотек', 'цен', 'экономи',
      'золото', 'млн', 'млрд',
    ],
  },
  {
    id: 'sport',
    title: 'Спорт и Движ',
    icon: '🏆',
    accent: 'text-neon-cyan',
    keywords: [
      'футбол', 'хоккей', 'кхл', 'рпл', 'бокс', 'мма', 'теннис', 'олимпиад',
      'чемпион', 'турнир', 'матч', 'спортсмен', 'фигурн', 'баскетбол',
    ],
  },
];

/**
 * Активный «движ» — какие рубрики публикуются в сводке и в каком порядке.
 *
 * ВАЖНО: состав движков ФИКСИРОВАН владельцем сайта и НЕ меняется автоматически.
 * Никакой самоподстройки под новости нет — сводка всегда идёт строго по списку ниже.
 * Чтобы сменить движ (например, когда СВО закончится), владелец вручную редактирует
 * массив DEFAULT_MOVES (или ACTIVE_MOVES в .env, если он задан явно).
 */
const DEFAULT_MOVES: CategoryId[] = [
  'geopolitics', // ГЛАВНЫЙ ДВИЖ: Геополитика и СВО
  'tech',        // StreamLife и Технологии
  'crypto',      // Криптовалюты
  'incidents',   // Безопасность и ЧП
];

// Если в .env прописан ACTIVE_MOVES — используем его (только ручная смена владельцем).
// Если нет — всегда фиксированный список выше. Автоматической ротации не существует.
export function getActiveMoves(): CategoryId[] {
  const raw = process.env.ACTIVE_MOVES;
  if (!raw) return DEFAULT_MOVES;
  const parsed = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is CategoryId => ALL_CATEGORIES.some((c) => c.id === s));
  return parsed.length ? parsed : DEFAULT_MOVES;
}

export function getCategory(id: CategoryId): CategoryDef {
  const cat = ALL_CATEGORIES.find((c) => c.id === id);
  if (!cat) throw new Error(`Unknown category: ${id}`);
  return cat;
}

/**
 * RSS-ленты открытых источников. Разбросаны по нескольким доменам,
 * чтобы при падении одного фида остальные вытягивали сводку.
 */
export interface FeedDef {
  url: string;
  source: string; // человекочитаемое имя для ссылок в статье
  /** Принудительная категория (для крипто-лент), иначе — автоклассификация. */
  forceCategory?: CategoryId;
}

export const RSS_FEEDS: FeedDef[] = [
  // Проверены на доступность (2026-10). Упавший фид не ломает сводку —
  // fetchFeed() возвращает [] и генератор продолжает с остальными.
  // Главные российские ленты: политика, экономика, ЧП
  { url: 'https://lenta.ru/rss/news', source: 'Lenta.ru' },
  { url: 'https://tass.ru/rss/v2.xml', source: 'ТАСС' },
  { url: 'https://ria.ru/export/rss2/archive/index.xml', source: 'РИА Новости' },
  { url: 'https://www.interfax.ru/rss.asp', source: 'Интерфакс' },
  { url: 'https://www.kommersant.ru/RSS/news.xml', source: 'Коммерсантъ' },
  { url: 'https://www.gazeta.ru/export/rss/first.xml', source: 'Газета.Ru' },
  // Технологии / импортозамещение / софт
  { url: 'https://3dnews.ru/news/rss/', source: '3DNews' },
  { url: 'https://habr.com/ru/rss/news/?fl=ru', source: 'Habr' },
  // Крипта — курсы и аналитика
  { url: 'https://cryptopotato.com/feed/', source: 'CryptoPotato', forceCategory: 'crypto' },
  // Резервные крипто-ленты (CoinDesk/Bits.media могут отдавать 403 из дата-центров):
  { url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', source: 'CoinDesk', forceCategory: 'crypto' },
  { url: 'https://bits.media/rss', source: 'Bits.media', forceCategory: 'crypto' },
];

/** Живой курс BTC (JSON-API CoinGecko) — реальные цифры, не мок. */
export const BTC_PRICE_API =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=rub,usd&include_24hr_change=true';

export const SITE = {
  name: 'StreamLive Daily',
  brand: 'StreamLive в Max',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://streamlive.app',
  // Официальные площадки «StreamLive в Max» — везде ведут на подписку.
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL || 'https://t.me/streamliveru',
  max: process.env.NEXT_PUBLIC_MAX_URL || 'https://max.ru/channel_StreamLive',
  vk: process.env.NEXT_PUBLIC_VK_URL || 'https://vk.com/streamliveru',
} as const;

/** Соцсети для кнопок подписки (порядок = приоритет показа). */
export const SOCIALS = [
  { id: 'telegram', name: 'Telegram', url: SITE.telegram, icon: '✈️', accent: 'neon-cyan' },
  { id: 'max', name: 'MAX', url: SITE.max, icon: '🟣', accent: 'neon-pink' },
  { id: 'vk', name: 'ВКонтакте', url: SITE.vk, icon: '🔷', accent: 'neon-blue' },
] as const;

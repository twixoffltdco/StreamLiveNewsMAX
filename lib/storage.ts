/**
 * lib/storage.ts — локальная файловая «база» сводок.
 * Каждая сводка хранится как Markdown-файл content/news/YYYY-MM-DD.md
 * с YAML-frontmatter (для людей и поисковиков) + sidecar JSON
 * content/news/YYYY-MM-DD.json со структурированными данными для UI.
 */

import fs from 'fs';
import path from 'path';
import { CategoryId } from './config';

export interface NewsItemData {
  title: string;      // факт в одну строку (без воды)
  url: string;        // ссылка на первоисточник
  source: string;     // имя источника (Lenta.ru, РБК…)
  publishedAt?: string;
}

export interface DigestSectionData {
  category: CategoryId;
  items: NewsItemData[];
  /** Если задан — переопределяет title из config (напр. «Геополитика» вместо «Геополитика и СВО»). */
  dynamicTitle?: string;
}

export interface DigestData {
  slug: string;        // 26-10-2026
  isoDate: string;     // 2026-10-26
  generatedAt: string; // ISO timestamp
  /** Текст строго по шаблону «StreamLive в Max» (см. ТЗ). */
  plainText: string;
  sections: DigestSectionData[];
  btcNote: string | null; // живая строка про курс BTC из CoinGecko
  fallbackUsed: boolean;  // true, если сегодня RSS упал и показана вчерашняя сводка
}

const NEWS_DIR = path.join(process.cwd(), 'content', 'news');

function ensureDir() {
  if (!fs.existsSync(NEWS_DIR)) fs.mkdirSync(NEWS_DIR, { recursive: true });
}

export function saveDigest(d: DigestData): void {
  ensureDir();
  const mdPath = path.join(NEWS_DIR, `${d.isoDate}.md`);
  const jsonPath = path.join(NEWS_DIR, `${d.isoDate}.json`);

  const frontMatter = [
    '---',
    `title: "ГЛАВНЫЕ ФАКТЫ ДНЯ | ${d.slug} | StreamLive в Max"`,
    `date: ${d.isoDate}`,
    `generatedAt: ${d.generatedAt}`,
    `url: /news/${d.slug}`,
    'description: "Ежедневная сводка StreamLive в Max: геополитика, технологии, крипта, ЧП. Только важные факты, без воды."',
    '---',
    '',
  ].join('\n');

  fs.writeFileSync(mdPath, frontMatter + d.plainText + '\n', 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify(d, null, 2), 'utf8');
}

export function loadDigestBySlug(slug: string): DigestData | null {
  const iso = slugToIso(slug);
  if (!iso) return null;
  const jsonPath = path.join(NEWS_DIR, `${iso}.json`);
  try {
    if (fs.existsSync(jsonPath)) {
      return JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as DigestData;
    }
  } catch (e) {
    console.error('[storage] failed to read digest', iso, e);
  }
  return null;
}

export function listDigestSlugs(): string[] {
  ensureDir();
  return fs
    .readdirSync(NEWS_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''))
    .filter((iso) => /^\d{4}-\d{2}-\d{2}$/.test(iso))
    .sort() // ISO-lexicographic == chronological
    .map(isoToSlug);
}

export function latestDigest(): DigestData | null {
  const slugs = listDigestSlugs();
  if (!slugs.length) return null;
  return loadDigestBySlug(slugs[slugs.length - 1]);
}

/** Ищет ближайшую сводку ДО указанной даты (fallback: «вчерашняя»). */
export function previousDigest(beforeSlug: string): DigestData | null {
  const target = slugToIso(beforeSlug);
  if (!target) return null;
  const slugs = listDigestSlugs()
    .map((s) => ({ slug: s, iso: slugToIso(s) }))
    .filter((x): x is { slug: string; iso: string } => !!x.iso && x.iso < target)
    .sort((a, b) => b.iso.localeCompare(a.iso));
  if (!slugs.length) return null;
  return loadDigestBySlug(slugs[0].slug);
}

function slugToIso(slug: string): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(slug);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function isoToSlug(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  return `${m[3]}-${m[2]}-${m[1]}`;
}

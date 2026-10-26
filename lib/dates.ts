/**
 * lib/dates.ts — работа с датами в формате StreamLive.
 * Формат URL-даты: ДД-ММММ-ГГГГ, например 26-10-2026 (dd-mm-yyyy).
 */

export const MONTHS_NOM = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

export const WEEKDAYS = [
  'воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота',
];

export interface ParsedDate {
  yyyy: number;
  mm: number; // 1..12
  dd: number; // 1..31
  date: Date;
}

/** Парсит "26-10-2026" → объект даты. Возвращает null при мусоре (защита от SEO-мусорных URL). */
export function parseSlugDate(slug: string): ParsedDate | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(slug);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const date = new Date(Date.UTC(yyyy, mm - 1, dd));
  if (date.getUTCFullYear() !== yyyy || date.getUTCMonth() !== mm - 1 || date.getUTCDate() !== dd) {
    return null; // несуществующая дата (например 31-02-2026)
  }
  return { yyyy, mm, dd, date };
}

/** Date → slug "26-10-2026" (по московскому времени, т.к. редакция живёт в MSK). */
export function toSlug(date: Date): string {
  const msk = toMoscow(date);
  const dd = String(msk.getUTCDate()).padStart(2, '0');
  const mm = String(msk.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = msk.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/** ISO-дата для файлов content/news/YYYY-MM-DD.md */
export function toIsoFileDate(date: Date): string {
  const msk = toMoscow(date);
  return `${msk.getUTCFullYear()}-${String(msk.getUTCMonth() + 1).padStart(2, '0')}-${String(msk.getUTCDate()).padStart(2, '0')}`;
}

export function todayMoscow(): Date {
  return new Date(Date.now() + 3 * 60 * 60 * 1000); // MSK = UTC+3
}

function toMoscow(d: Date): Date {
  return new Date(d.getTime() + 3 * 60 * 60 * 1000);
}

/** Человекочитаемая дата: "26 октября 2026" */
export function humanDate(p: ParsedDate): string {
  return `${p.dd} ${MONTHS_NOM[p.mm - 1]} ${p.yyyy}`;
}

/** "ГЛАВНЫЕ ФАКТЫ ДНЯ | 26 ОКТЯБРЯ 2026" — заголовок шаблона */
export function headerDate(p: ParsedDate): string {
  return `${String(p.dd).padStart(2, '0')} ${MONTHS_NOM[p.mm - 1].toUpperCase()} ${p.yyyy}`;
}

export function weekdayName(p: ParsedDate): string {
  return WEEKDAYS[p.date.getUTCDay()];
}

/** Календарный сосед без TZ-сдвигов: "27-10-2026" → "26-10-2026". */
function shiftSlug(slug: string, days: number): string {
  const p = parseSlugDate(slug);
  if (!p) return slug;
  const d = new Date(Date.UTC(p.yyyy, p.mm - 1, p.dd + days));
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getUTCFullYear()}`;
}

export function prevSlug(slug: string): string { return shiftSlug(slug, -1); }
export function nextSlug(slug: string): string { return shiftSlug(slug, +1); }

/**
 * lib/db.ts — лёгкая локальная база данных SQLite (better-sqlite3).
 *
 * Почему SQLite, а не файловая система:
 *  — данные накапливаются с апреля 2026 и гарантированно переживают
 *    перезагрузку/ребилд сервера (Vercel / Tatnet / VPS);
 *  — атомарные записи, никаких битых JSON-файлов при конкурентном cron;
 *  — один файл streamlive.db — легко бэкапить (`sqlite3 .dump`).
 *
 * Путь к БД: process.env.DATABASE_PATH || ./data/streamlive.db
 * На Vercel используйте Serverless Persistence: DATABASE_PATH=/mnt/data/streamlive.db
 */

import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

/* ===================== Типы (шаблон данных ТЗ) ===================== */

export interface DigestSection {
  icon: string;   // 🛰️ / 💻 / ₿ / 🚨
  title: string;  // название рубрики
  items: string[];// факты в одну строку, без воды
}

export interface DigestInput {
  date: string;            // YYYY-MM-DD
  title: string;           // «ГЛАВНЫЕ ФАКТЫ ДНЯ | DD MMMM YYYY»
  intro: string;           // «[День недели]. Фокус на главном, остальное — шум.»
  sections: DigestSection[];
  outro: string;
}

export interface DigestRow extends DigestInput {
  id: number;
  created_at: string;
}

/* ===================== Инициализация БД ===================== */

const DB_FILENAME = 'streamlive.db';

let db: Database.Database | null = null;

function resolveDbPath(): string {
  const envPath = process.env.DATABASE_PATH;
  if (envPath) return envPath;
  // По умолчанию — <cwd>/data/streamlive.db (persist на Tatnet/VPS).
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, DB_FILENAME);
}

function getDb(): Database.Database {
  if (db) return db;

  const file = resolveDbPath();
  const dir = path.dirname(file);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  } catch {
    /* read-only FS (serverless без persistence) — упадём в :memory: ниже */
  }

  let target = file;
  try {
    db = new Database(file);
  } catch (e) {
    console.error('[db] cannot open', file, e, '— falling back to in-memory DB');
    target = ':memory:';
    db = new Database(':memory:');
  }

  // WAL — надёжнее при обрывах процесса; busy_timeout — на случай конкурентных cron.
  try {
    db.pragma('journal_mode = WAL');
  } catch {
    try { db.pragma('journal_mode = DELETE'); } catch { /* memory DB */ }
  }
  db.pragma('busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS digests (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      date          TEXT    NOT NULL UNIQUE,
      title         TEXT    NOT NULL,
      intro         TEXT    NOT NULL,
      sections_json TEXT    NOT NULL,
      outro         TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_digests_date ON digests(date DESC);
  `);

  console.log(`[db] SQLite ready: ${target}`);
  return db;
}

/* ===================== API ===================== */

interface RawRow {
  id: number; date: string; title: string; intro: string;
  sections_json: string; outro: string; created_at: string;
}

function rowToDigest(row: RawRow): DigestRow {
  let sections: DigestSection[] = [];
  try {
    sections = JSON.parse(row.sections_json) as DigestSection[];
  } catch (e) {
    console.error('[db] corrupt sections_json in row', row.id, e);
  }
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    intro: row.intro,
    sections,
    outro: row.outro,
    created_at: row.created_at,
  };
}

/**
 * Сохраняет выпуск накопительным итогом.
 * UPSERT по дате: повторный cron в тот же день (08:00/14:00/20:00)
 * обновляет выпуск, не создавая дублей.
 */
export function saveDigest(data: DigestInput): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    throw new Error(`[db] invalid date "${data.date}", expected YYYY-MM-DD`);
  }
  const stmt = getDb().prepare(`
    INSERT INTO digests (date, title, intro, sections_json, outro, created_at)
    VALUES (@date, @title, @intro, @sections_json, @outro, datetime('now'))
    ON CONFLICT(date) DO UPDATE SET
      title = excluded.title,
      intro = excluded.intro,
      sections_json = excluded.sections_json,
      outro = excluded.outro
  `);
  stmt.run({
    date: data.date,
    title: data.title,
    intro: data.intro,
    sections_json: JSON.stringify(data.sections ?? []),
    outro: data.outro,
  });
}

/** Последний выпуск (самый свежий по дате). */
export function getLatestDigest(): DigestRow | null {
  const row = getDb()
    .prepare('SELECT * FROM digests ORDER BY date DESC LIMIT 1')
    .get() as RawRow | undefined;
  return row ? rowToDigest(row) : null;
}

/** Все выпуски от новых к старым (архив с апреля 2026). */
export function getAllDigests(): DigestRow[] {
  const rows = getDb()
    .prepare('SELECT * FROM digests ORDER BY date DESC')
    .all() as RawRow[];
  return rows.map(rowToDigest);
}

/** Выпуск за конкретную дату YYYY-MM-DD. */
export function getDigestByDate(date: string): DigestRow | null {
  const row = getDb()
    .prepare('SELECT * FROM digests WHERE date = ?')
    .get(date) as RawRow | undefined;
  return row ? rowToDigest(row) : null;
}

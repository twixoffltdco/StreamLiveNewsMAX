/**
 * scripts/seed.ts — необязательный скрипт первичного наполнения SQLite.
 *
 * Использование:
 *   npx tsx scripts/seed.ts                 — собрать сегодняшний выпуск из RSS и сохранить
 *   npx tsx scripts/seed.ts 2026-04-15      — принудительная дата (для истории архива)
 *
 * Полезно при первом деплое, чтобы архив не был пустым до ближайшего cron.
 */

import { buildDigest } from '../lib/digest-generator';
import { saveDigest, getAllDigests } from '../lib/db';

async function main() {
  const dateArg = process.argv[2];
  console.log('[seed] generating digest…', dateArg ? `for ${dateArg}` : '(today MSK)');
  const digest = await buildDigest(dateArg ? { date: dateArg } : undefined);
  saveDigest(digest);
  console.log('[seed] saved:', digest.title);
  for (const s of digest.sections) {
    console.log(`  ${s.icon} ${s.title}: ${s.items.length} items`);
  }
  console.log('[seed] total rows in DB:', getAllDigests().length);
}

main().catch((e) => {
  console.error('[seed] failed:', e);
  process.exit(1);
});

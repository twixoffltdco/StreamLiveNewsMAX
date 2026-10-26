#!/usr/bin/env node
/**
 * scripts/cron-daemon.js — локальный cron-демон (node-cron).
 * Для Vercel используйте vercel.json + app/api/cron/update-news/route.ts.
 * Для self-hosted/VPS: `npm run cron` (или systemd/pm2 unit).
 * Запуск: 08:00, 14:00 и 20:00 по Москве (MSK = UTC+3 → 05:00, 11:00, 17:00 UTC).
 */

const cron = require('node-cron');
const { execFileSync } = require('child_process');

const SCHEDULES = ['0 5 * * *', '0 11 * * *', '0 17 * * *']; // UTC == 08/14/20 MSK

function run() {
  const ts = new Date().toISOString();
  console.log(`[cron-daemon] ${ts} → generating digest…`);
  try {
    execFileSync(process.execPath, ['scripts/generate-digest.js'], { stdio: 'inherit' });
    console.log(`[cron-daemon] ${ts} → done`);
  } catch (e) {
    console.error(`[cron-daemon] ${ts} → failed:`, e.message);
  }
}

for (const expr of SCHEDULES) {
  cron.schedule(expr, run, { timezone: 'UTC' });
  console.log(`[cron-daemon] scheduled: ${expr} (UTC)`);
}

console.log('[cron-daemon] StreamLive Daily cron running. Ctrl+C to stop.');

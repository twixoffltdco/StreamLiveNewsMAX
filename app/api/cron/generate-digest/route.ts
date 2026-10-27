/**
 * app/api/cron/generate-digest/route.ts — защищённый роут для внешнего планировщика.
 *
 * Вызов (cron-job.org / Vercel Cron / системный crontab):
 *   GET https://твой-домен.ru/api/cron/generate-digest?secret=ТВОЙ_CRON_SECRET
 *   или заголовок:  Authorization: Bearer ТВОЙ_CRON_SECRET
 *
 * Алгоритм:
 *   1. Проверяем токен process.env.CRON_SECRET (401 при ошибке).
 *   2. rss-parser тянет топ-2 новости на каждую рубрику из Lenta/RBC/CoinDesk/3DNews
 *      с каскадом запасных источников (graceful degradation).
 *   3. Строка про domtv.blyz.ru жёстко внедряется в раздел IT.
 *   4. Выпуск сохраняется в SQLite (lib/db.ts) накопительным итогом.
 *   5. Ответ: { success: true, date: "YYYY-MM-DD" }.
 *
 * НИКАКИХ GitHub Actions — только API + внешний cron + SQLite.
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildDigest } from '@/lib/digest-generator';
import { saveDigest } from '@/lib/db';

// Роут всегда динамический и никогда не кешируется прокси.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs'; // better-sqlite3 требует Node.js runtime

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Если секрет не задан — доступ закрыт (fail-closed).
    console.error('[cron] CRON_SECRET is not set — refusing to run');
    return false;
  }
  const qSecret = req.nextUrl.searchParams.get('secret');
  const authHeader = req.headers.get('authorization') ?? '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const custom = req.headers.get('x-cron-secret');
  const candidate = qSecret ?? bearer ?? custom;
  return !!candidate && candidate === secret;
}

async function handle(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: invalid or missing secret' },
      { status: 401 },
    );
  }

  try {
    const digest = await buildDigest();
    saveDigest(digest);
    console.log(`[cron] digest saved for ${digest.date} (${digest.sections.length} sections)`);
    return NextResponse.json({ success: true, date: digest.date });
  } catch (e) {
    console.error('[cron] generation failed:', e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'internal error' },
      { status: 500 },
    );
  }
}

export { handle as GET, handle as POST };

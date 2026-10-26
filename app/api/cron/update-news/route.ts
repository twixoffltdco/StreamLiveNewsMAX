import { NextRequest, NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import path from 'path';

/**
 * GET/POST /api/cron/update-news
 *
 * Точка входа для Vercel Cron (см. vercel.json: 05:00/11:00/17:00 UTC =
 * 08:00/14:00/20:00 МСК) и для внешних планировщиков (GitHub Actions,
 * cron на VPS, UptimeRobot).
 *
 * Что делает:
 *  1. Проверяет секрет CRON_SECRET (Vercel автоматически шлёт его в
 *     заголовке Authorization: Bearer <CRON_SECRET>).
 *  2. Запускает standalone-генератор сводки (реальный парсинг RSS).
 *  3. Пересобирает sitemap.xml через next-sitemap.
 *  4. Пингует поисковые системы (Яндекс ping + Google Indexing API/Sitemap ping),
 *     чтобы новая страница проиндексировалась мгновенно.
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel:cron-функции до 60 сек

async function pingSearchEngines(siteUrl: string): Promise<string[]> {
  const results: string[] = [];
  const sitemap = `${siteUrl}/sitemap.xml`;
  try {
    // Яндекс: переобход sitemap по API (нужен YANDEX_WEBMASTER_TOKEN из Яндекс.Webmaster)
    if (process.env.YANDEX_WEBMASTER_TOKEN) {
      const r = await fetch(
        `https://webmaster.yandex.ru/v3/sitemap/?text=${encodeURIComponent(sitemap)}&host=${encodeURIComponent(siteUrl)}&token=${process.env.YANDEX_WEBMASTER_TOKEN}`,
        { method: 'POST' },
      );
      results.push(`yandex:${r.status}`);
    } else {
      results.push('yandex:skipped(no-token)');
    }
    // Google: классический ping-хук карты сайта
    const g = await fetch(
      `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemap)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    results.push(`google:${g.status}`);
  } catch (e) {
    results.push(`ping-error:${(e as Error).message}`);
  }
  return results;
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}

async function handle(req: NextRequest) {
  // 1. Защита роута
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  const querySecret = req.nextUrl.searchParams.get('secret');
  if (secret && auth !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://streamlive.app';

  try {
    // 2. Генерация свежей сводки (тот же код, что и npm run generate)
    execFileSync(process.execPath, [path.join(process.cwd(), 'scripts', 'generate-digest.js'), '--quiet'], {
      stdio: 'pipe',
      timeout: 50_000,
    });

    // 3. Обновление sitemap.xml — новые страницы сразу в карте
    try {
      execFileSync(path.join(process.cwd(), 'node_modules', '.bin', 'next-sitemap'), [], {
        cwd: process.cwd(),
        stdio: 'pipe',
        timeout: 30_000,
      });
    } catch (e) {
      console.warn('[cron] next-sitemap regen failed:', (e as Error).message);
    }

    // 4. Пинг Яндекса и Google для мгновенной индексации
    const pings = await pingSearchEngines(siteUrl);

    return NextResponse.json({
      ok: true,
      ranAt: new Date().toISOString(),
      timezone: 'MSK schedule 08:00 / 14:00 / 20:00',
      pings,
    });
  } catch (e) {
    console.error('[cron] update-news failed:', e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}

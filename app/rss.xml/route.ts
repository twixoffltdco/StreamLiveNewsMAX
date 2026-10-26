/** app/rss.xml/route.ts — собственный RSS-фид сводок (для Telegram-ботов и агрегаторов). */
import { NextResponse } from 'next/server';
import { listDigestSlugs, loadDigestBySlug } from '@/lib/storage';
import { SITE } from '@/lib/config';

export const dynamic = 'force-dynamic';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function GET() {
  const slugs = listDigestSlugs().slice(-30).reverse();
  const items = slugs
    .map((slug) => loadDigestBySlug(slug))
    .filter(Boolean)
    .map((d) => {
      const iso = d!.isoDate;
      return [
        '<item>',
        `<title>${esc(`ГЛАВНЫЕ ФАКТЫ ДНЯ | ${d!.slug} | StreamLive в Max`)}</title>`,
        `<link>${SITE.url}/news/${d!.slug}</link>`,
        `<guid isPermaLink="true">${SITE.url}/news/${d!.slug}</guid>`,
        `<pubDate>${new Date(`${iso}T08:00:00+03:00`).toUTCString()}</pubDate>`,
        `<description><![CDATA[${d!.plainText}]]></description>`,
        '</item>',
      ].join('');
    });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '<channel>',
    `<title>${esc(SITE.name)} — ${esc(SITE.brand)}</title>`,
    `<link>${SITE.url}</link>`,
    `<atom:link href="${SITE.url}/rss.xml" rel="self" type="application/rss+xml"/>`,
    '<description>Ежедневная сводка главных фактов: геополитика, технологии, крипта, ЧП. Без воды.</description>',
    '<language>ru</language>',
    ...items,
    '</channel>',
    '</rss>',
  ].join('\n');

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
  });
}

/**
 * app/news/today/page.tsx — канонический URL «сегодняшнего» выпуска.
 * Always-dynamic: роботы всегда получают актуальную сводку, независимо от сборки.
 */
import { redirect, notFound } from 'next/navigation';
import { toSlug, todayMoscow } from '@/lib/dates';
import { getDigestOrFallback } from '@/lib/news-generator';
import { DigestView } from '@/components/DigestView';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Главные факты дня — сегодня | StreamLive в Max',
  description: 'Живая сводка StreamLive в Max за сегодня: геополитика, технологии, крипта, ЧП.',
  alternates: { canonical: undefined },
  robots: { index: true, follow: true },
};

export default function TodayPage() {
  const slug = toSlug(todayMoscow());
  const res = getDigestOrFallback(slug);
  if (!res) notFound();
  // Если сегодняшней сводки нет — сразу редирект на ближайшую актуальную страницу
  if (res.isFallback) redirect(`/news/${res.digest.slug}`);
  return <DigestView digest={res.digest} />;
}

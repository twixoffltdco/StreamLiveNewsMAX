import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getAllDigests, getDigestByDate } from '@/lib/db';
import { DigestView } from '@/components/DigestView';

/**
 * app/digest/[date]/page.tsx — страница конкретного выпуска.
 *
 * Рендеринг: force-dynamic + generateStaticParams как подсказка для prerender
 * уже существующих в SQLite дат (ISR-френдли на VPS; на Vercel данные динамические).
 * SEO: уникальные title/description/OG/canonical + JSON-LD Article на каждый выпуск.
 */

export const dynamic = 'force-dynamic';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://streamlive-max.ru';

interface Params { params: { date: string } }

/** Подсказка Next.js: какие страницы можно прогреть (даты из БД). */
export async function generateStaticParams() {
  try {
    return getAllDigests().map((d) => ({ date: d.date }));
  } catch {
    return []; // БД недоступна на билде — рендерим полностью динамически
  }
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const digest = getDigestByDate(params.date);
  if (!digest) return { title: 'Выпуск не найден | StreamLive в Max', robots: { index: false } };

  const prettyDate = format(parseISO(digest.date), 'dd MMMM yyyy', { locale: ru });
  const desc = `${digest.intro} В выпуске: ${digest.sections.map((s) => s.title.toLowerCase()).join(', ')}.`;

  return {
    title: `${digest.title} | StreamLive в Max`,
    description: desc,
    keywords: ['главные факты дня', prettyDate, 'дайджест новостей', 'StreamLive', ...digest.sections.map((s) => s.title)],
    alternates: { canonical: `/digest/${digest.date}` },
    openGraph: {
      type: 'article',
      publishedTime: digest.created_at,
      modifiedTime: digest.created_at,
      locale: 'ru_RU',
      url: `${SITE_URL}/digest/${digest.date}`,
      siteName: 'StreamLive в Max',
      title: digest.title,
      description: desc,
      images: [{ url: '/og.png', width: 1200, height: 630, alt: digest.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: digest.title,
      description: desc,
      images: ['/og.png'],
    },
  };
}

export default function DigestPage({ params }: Params) {
  const digest = getDigestByDate(params.date);
  if (!digest) notFound();

  // JSON-LD для поисковиков: каждый выпуск — отдельная Article.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: digest.title,
    description: digest.intro,
    datePublished: digest.created_at,
    dateModified: digest.created_at,
    inLanguage: 'ru',
    isPartOf: { '@type': 'WebSite', name: 'StreamLive в Max', url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/digest/${digest.date}`,
    articleSection: digest.sections.map((s) => s.title),
    publisher: { '@type': 'Organization', name: 'StreamLive в Max' },
  };

  const prevDates = getAllDigests()
    .map((d) => d.date)
    .filter((dt) => dt < digest.date)
    .slice(0, 1);

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Хлебные крошки */}
      <nav aria-label="Хлебные крошки" style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 12 }}>
        <Link href="/" style={{ color: 'var(--cyan)' }}>Главная</Link>
        {' / '}
        <Link href="/archive" style={{ color: 'var(--cyan)' }}>Архив</Link>
        {' / '}
        <span>{format(parseISO(digest.date), 'dd.MM.yyyy', { locale: ru })}</span>
      </nav>

      <DigestView digest={digest} />

      {/* Навигация к предыдущему выпуску */}
      {prevDates.length > 0 && (
        <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13.5 }}>
          <Link href={`/digest/${prevDates[0]}`} className="sl-btn sl-btn--ghost">
            ← Предыдущий выпуск
          </Link>
        </p>
      )}
    </div>
  );
}

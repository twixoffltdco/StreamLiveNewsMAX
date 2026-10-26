import { notFound } from 'next/navigation';
import type { Metadata, Viewport } from 'next';
import { getDigestOrFallback } from '@/lib/news-generator';
import { DigestData } from '@/lib/storage';
import { listDigestSlugs } from '@/lib/storage';
import { parseSlugDate, humanDate, prevSlug, nextSlug } from '@/lib/dates';
import { DigestView, SubscribeButton } from '@/components/DigestView';
import { SITE } from '@/lib/config';

/**
 * app/news/[date]/page.tsx — динамическая SEO-страница сводки.
 * SSG: страницы генерируются из content/news в момент сборки (быстро для роботов).
 * Fallback blocking: свежая дата, ещё не собранная при build, рендерится на лету
 * и кешируется CDN. Если сводки за дату нет — показываем предыдущую (ТЗ: «RSS упал → вчерашняя»).
 */

export const dynamicParams = true;
export const revalidate = 3600; // 1 час — между cron-волнами контент не устаревает

export function generateStaticParams() {
  return listDigestSlugs().map((slug) => ({ date: slug }));
}

interface Props {
  params: { date: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = params;
  const p = parseSlugDate(date);
  if (!p) return {};
  const res = getDigestOrFallback(date);
  if (!res) return {};
  const { digest } = res;
  const title = `ГЛАВНЫЕ ФАКТЫ ДНЯ | ${humanDate(p)} — StreamLive в Max`;
  const description = `${humanDate(p)}. Сводка ${SITE.brand}: ${digest.sections
    .map((s) => s.items[0]?.title)
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ')}`.slice(0, 200);
  const url = `${SITE.url}/news/${date}`;
  return {
    title,
    description,
    keywords: [humanDate(p), 'главные факты дня', 'сводка новостей', SITE.brand, 'StreamLive Daily'],
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: SITE.brand,
      locale: 'ru_RU',
      publishedTime: digest.generatedAt,
      modifiedTime: digest.generatedAt,
      images: [{ url: `${SITE.url}/og.png`, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og.png'] },
    alternates: { canonical: url },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { themeColor: '#000000' };

/** Schema.org NewsArticle — микроразметка для Яндекса и Google Rich Results. */
function newsArticleJsonLd(digest: DigestData, date: string) {
  const p = parseSlugDate(date)!;
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: `ГЛАВНЫЕ ФАКТЫ ДНЯ | ${humanDate(p)} | StreamLive в Max`,
    description: `Ежедневная сводка: ${digest.sections.map((s) => s.items.slice(0, 1).map((i) => i.title)).flat().join('. ')}`.slice(0, 300),
    inLanguage: 'ru-RU',
    datePublished: digest.generatedAt,
    dateModified: digest.generatedAt,
    isAccessibleForFree: true,
    author: { '@type': 'Organization', name: SITE.name, url: SITE.url },
    publisher: {
      '@type': 'Organization',
      name: SITE.brand,
      logo: { '@type': 'ImageObject', url: `${SITE.url}/logo.png` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE.url}/news/${date}` },
    url: `${SITE.url}/news/${date}`,
    articleSection: digest.sections.map((s) => s.category),
    about: digest.sections.flatMap((s) => s.items.map((i) => ({ '@type': 'Thing', name: i.title.slice(0, 80) }))),
  };
}

export default function NewsDatePage({ params }: Props) {
  const { date } = params;
  const parsed = parseSlugDate(date);
  if (!parsed) notFound();

  const res = getDigestOrFallback(date);
  if (!res) notFound();

  const { digest, isFallback } = res;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(newsArticleJsonLd(digest, date)) }}
      />

      {/* Быстрые кнопки «что посмотреть» — навигация по рубрикам (для всех возрастов) */}
      <nav aria-label="Рубрики дня" className="mb-5 flex flex-wrap gap-2">
        {digest.sections.map((s) => (
          <a
            key={s.category}
            href={`/category/${s.category}`}
            className="rounded-full border border-line bg-panel px-4 py-2 text-sm font-semibold text-gray-200 hover:border-neon-cyan hover:text-neon-cyan"
          >
            🔎 Важное: {s.category === 'geopolitics' ? 'СВО и геополитика' : s.category === 'tech' ? 'IT и технологии' : s.category === 'crypto' ? 'Крипта' : s.category === 'incidents' ? 'ЧП и безопасность' : 'Экономика'}
          </a>
        ))}
      </nav>

      {isFallback && (
        <p className="mb-4 rounded-md border border-neon-amber/40 bg-neon-amber/10 px-3 py-2 text-sm text-neon-amber">
          ⚠️ Выпуск за {humanDate(parsed)} ещё не сформирован — показываем последнюю сводку
          ({digest.slug}). Обновление: 08:00 / 14:00 / 20:00 МСК.
        </p>
      )}

      <DigestView digest={digest} />

      {/* CTA-подписка: все площадки StreamLive в Max */}
      <section className="neon-frame mt-8 rounded-xl bg-panel p-5 text-center" aria-label="Подписаться на StreamLive в Max">
        <p className="text-base font-bold text-white">📲 Читайте «ГЛАВНЫЕ ФАКТЫ ДНЯ» там, где удобно:</p>
        <SubscribeButton />
      </section>

      {/* Перелинковка день↔день — сильный SEO-сигнал для новостных архивов */}
      <nav className="mt-8 flex items-center justify-between text-sm">
        <a href={`/news/${prevSlug(date)}`} className="text-gray-400 hover:text-neon-cyan">← {prevSlug(date)}</a>
        <a href="/news" className="text-neon-pink hover:underline">Архив всех выпусков</a>
        <a href={`/news/${nextSlug(date)}`} className="text-gray-400 hover:text-neon-cyan">{nextSlug(date)} →</a>
      </nav>
    </>
  );
}

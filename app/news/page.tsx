/** app/news/page.tsx — архив выпусков (SEO-хаб с кластерной перелинковкой). */
import { listDigestSlugs, loadDigestBySlug } from '@/lib/storage';
import { parseSlugDate, humanDate } from '@/lib/dates';
import { SubscribeButton } from '@/components/DigestView';
import type { Metadata } from 'next';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Архив сводок StreamLive в Max — все выпуски по дням',
  description:
    'Полный архив ежедневных дайджестов «Главные факты дня»: геополитика, технологии, криптовалюты, ЧП. Каждый выпуск — отдельная страница для быстрого поиска.',
};

export default function NewsArchivePage() {
  const slugs = listDigestSlugs().reverse(); // свежие сверху
  return (
    <div>
      <h1 className="scanline-title mb-6 text-2xl font-extrabold text-white">🗂 Архив выпусков</h1>
      <ul className="space-y-3">
        {slugs.map((slug) => {
          const p = parseSlugDate(slug);
          const d = loadDigestBySlug(slug);
          return (
            <li key={slug} className="neon-frame rounded-lg bg-panel px-4 py-3">
              <a href={`/news/${slug}`} className="font-bold text-neon-cyan hover:underline">
                ГЛАВНЫЕ ФАКТЫ ДНЯ | {p ? humanDate(p) : slug}
              </a>
              {d && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-400">
                  {d.sections.map((s) => s.items[0]?.title).filter(Boolean).join(' · ')}
                </p>
              )}
            </li>
          );
        })}
        {!slugs.length && (
          <li className="text-gray-400">Выпусков пока нет — запустите <code>npm run generate</code>.</li>
        )}
      </ul>
      <div className="mt-8 text-center">
        <p className="mb-1 text-sm text-gray-300">Не хотите заходить каждый день? Подпишитесь — пришлём все выпуски:</p>
        <SubscribeButton />
      </div>
    </div>
  );
}

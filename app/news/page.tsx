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
  // Архив с апреля 2026 — даты раньше апреля не показываем (начало постинга сводок)
  const APRIL_2026 = '2026-04-01';
  const slugs = listDigestSlugs()
    .filter((slug) => {
      const p = parseSlugDate(slug);
      if (!p) return false;
      const iso = `${p.yyyy}-${String(p.mm).padStart(2, '0')}-${String(p.dd).padStart(2, '0')}`;
      return iso >= APRIL_2026;
    })
    .reverse(); // свежие сверху
  return (
    <div>
      <h1 className="scanline-title mb-2 text-xl font-extrabold text-white sm:mb-6 sm:text-2xl">
        🗂 Архив выпусков
      </h1>
      <p className="mb-5 text-sm text-gray-400">
        Сводки StreamLive в Max с апреля 2026 года. Обновление 3 раза в день.
      </p>
      <ul className="space-y-2.5 sm:space-y-3">
        {slugs.map((slug) => {
          const p = parseSlugDate(slug);
          const d = loadDigestBySlug(slug);
          return (
            <li key={slug} className="neon-frame rounded-lg bg-panel px-3 py-2.5 sm:px-4 sm:py-3">
              <a href={`/news/${slug}`} className="text-sm font-bold text-neon-cyan hover:underline sm:text-base">
                ГЛАВНЫЕ ФАКТЫ ДНЯ | {p ? humanDate(p) : slug}
              </a>
              {d && (
                <p className="mt-1 line-clamp-2 text-xs text-gray-400 sm:text-sm">
                  {d.sections.map((s) => s.items[0]?.title).filter(Boolean).join(' · ')}
                </p>
              )}
            </li>
          );
        })}
        {!slugs.length && (
          <li className="text-gray-400">
            Выпусков с апреля 2026 пока нет — запустите <code className="text-neon-cyan">npm run generate</code>.
          </li>
        )}
      </ul>
      <div className="mt-8 text-center">
        <p className="mb-1 text-sm text-gray-300">Не хотите заходить каждый день? Подпишитесь — пришлём все выпуски:</p>
        <SubscribeButton />
      </div>
    </div>
  );
}

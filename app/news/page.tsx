/** app/news/page.tsx — архив выпусков (SEO-хаб с кластерной перелинковкой). */
import { listDigestSlugs, loadDigestBySlug } from '@/lib/storage';
import { parseSlugDate, humanDate } from '@/lib/dates';
import { SubscribeButton } from '@/components/DigestView';
import type { Metadata } from 'next';

export const revalidate = 3600;

/** Нижняя граница архива: выпуски раньше этой даты не показываем. */
const ARCHIVE_FROM_ISO = '2026-04-01';

export const metadata: Metadata = {
  title: 'Архив сводок StreamLive в Max — все выпуски по дням',
  description:
    'Полный архив ежедневных дайджестов «Главные факты дня»: геополитика, технологии, криптовалюты, ЧП. Каждый выпуск — отдельная страница для быстрого поиска.',
};

/** ISO-дата из slug «ДД-ММММ-ГГГГ». */
function slugToIso(slug: string): string | null {
  const p = parseSlugDate(slug);
  if (!p) return null;
  return `${p.yyyy}-${String(p.mm).padStart(2, '0')}-${String(p.dd).padStart(2, '0')}`;
}

export default function NewsArchivePage() {
  // Нижняя граница архива: показываем сводки не дальше этой даты (см. ARCHIVE_FROM_ISO).
  // Ограничение нужно, чтобы страница архива не разрасталась бесконечно.
  const slugs = listDigestSlugs()
    .filter((slug) => {
      const iso = slugToIso(slug);
      if (!iso) return false;
      return iso >= ARCHIVE_FROM_ISO;
    })
    .reverse(); // свежие сверху

  const earliestIso = slugs.length ? slugToIso(slugs[slugs.length - 1]) : null;
  const earliestLabel = earliestIso
    ? humanDate(parseSlugDate(`${earliestIso.slice(8, 10)}-${earliestIso.slice(5, 7)}-${earliestIso.slice(0, 4)}`)!)
    : null;
  const hasEarlier = listDigestSlugs().some((s) => {
    const iso = slugToIso(s);
    return !!iso && iso < ARCHIVE_FROM_ISO;
  });

  return (
    <div>
      <h1 className="scanline-title mb-2 text-xl font-extrabold text-white sm:mb-6 sm:text-2xl">
        🗂 Архив выпусков
      </h1>
      <p className="mb-5 text-sm text-gray-400">
        {earliestLabel
          ? `Сводки StreamLive в Max c ${earliestLabel} года.`
          : 'Сводки StreamLive в Max.'}{' '}
        Обновление 3 раза в день.
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

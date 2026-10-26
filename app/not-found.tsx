import { toSlug, todayMoscow } from '@/lib/dates';
import { getDigestOrFallback } from '@/lib/news-generator';
import { DigestView, SubscribeButton } from '@/components/DigestView';

export const dynamic = 'force-dynamic';

/** Не найден выпуск за дату → не 404-тупик, а живой fallback на последний. */
export default function NotFoundPage() {
  const slug = toSlug(todayMoscow());
  const res = getDigestOrFallback(slug);
  if (!res) {
    return (
      <div className="neon-frame rounded-xl bg-panel p-8 text-center">
        <h1 className="scanline-title text-xl font-bold text-neon-pink">404 · Выпуск не найден</h1>
        <p className="mt-3 text-gray-300">Такой даты ещё нет, и архив пуст. Дождитесь ближайшего cron-выпуска (08:00 / 14:00 / 20:00 МСК).</p>
        <a href="/" className="mt-4 inline-block text-neon-cyan underline">На главную ⚡</a>
      </div>
    );
  }
  // SEO-деликатно: показываем актуальный контент вместо пустой 404
  return (
    <>
      <DigestView digest={res.digest} />
      <div className="mt-8 text-center">
        <SubscribeButton />
      </div>
    </>
  );
}

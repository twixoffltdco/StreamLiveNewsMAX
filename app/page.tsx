/**
 * app/page.tsx — главная StreamLive Daily: свежий выпуск + навигация по «движам».
 */
import { getDigestOrFallback } from '@/lib/news-generator';
import { toSlug, todayMoscow, parseSlugDate, humanDate } from '@/lib/dates';
import { DigestView, SubscribeButton } from '@/components/DigestView';
import { SITE } from '@/lib/config';
import type { Metadata } from 'next';

export const revalidate = 600;

export const metadata: Metadata = {
  title: `${SITE.brand}: главные факты дня — ${SITE.name}`,
  description:
    'Автоматическая сводка новостей 3 раза в день: СВО и геополитика, технологии и импортозамещение, курс биткоина, ЧП и погода. Без воды — только факты.',
};

const MOVES = [
  { href: '/category/geopolitics', label: '🛰️ Геополитика', hint: 'СВО, переговоры, международка — авто-адаптация' },
  { href: '/category/tech', label: '💻 IT и стриминг', hint: 'софт, импортозамещение, domtv' },
  { href: '/category/crypto', label: '₿ Крипта', hint: 'BTC и альты' },
  { href: '/category/economy', label: '📈 Курсы и экономика', hint: 'USD EUR KZT UAH, рубль, нефть' },
  { href: '/category/incidents', label: '🚨 ЧП и МЧС', hint: 'происшествия и погода' },
];

export default function HomePage() {
  const slug = toSlug(todayMoscow());
  const res = getDigestOrFallback(slug);
  const parsed = parseSlugDate(slug);

  return (
    <div>
      <section className="neon-frame mb-8 rounded-xl bg-panel p-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-neon-pink">Daily Digest · 08:00 / 14:00 / 20:00 МСК</p>
        <h1 className="scanline-title mt-2 text-2xl font-extrabold text-white sm:text-3xl">
          ⚡ StreamLive в Max
        </h1>
        <p className="mt-2 text-gray-300">
          {parsed ? `Выпуск за ${humanDate(parsed)}` : 'Свежие главные факты дня'} — без воды и
          информационного шума.
        </p>

        {/* Кнопки «посмотреть важное» — крупные, понятные всем возрастам */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {MOVES.map((m) => (
            <a
              key={m.href}
              href={m.href}
              title={m.hint}
              className="rounded-lg border border-line bg-ink px-4 py-2.5 text-sm font-semibold text-gray-100 hover:border-neon-cyan hover:text-neon-cyan"
            >
              {m.label}
            </a>
          ))}
        </div>
      </section>

      {res ? (
        <DigestView digest={res.digest} />
      ) : (
        <p className="neon-frame rounded-xl bg-panel p-6 text-center text-gray-300">
          Первый выпуск ещё не сформирован. Запустите генерацию: <code className="text-neon-cyan">npm run generate</code>.
        </p>
      )}

      <div className="mt-8 text-center">
        <SubscribeButton />
      </div>
    </div>
  );
}

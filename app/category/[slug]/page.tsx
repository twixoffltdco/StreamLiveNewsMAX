/**
 * app/category/[slug]/page.tsx — страницы «движов».
 * «Что посмотреть по теме СВО», а когда движ сменится — ECONOMY/TECH и т.д.
 * Страница собирает последние N выпусков и показывает все факты рубрики.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ALL_CATEGORIES, SITE } from '@/lib/config';
import { listDigestSlugs, loadDigestBySlug } from '@/lib/storage';
import { SubscribeButton } from '@/components/DigestView';

export const revalidate = 3600;

const TITLES: Record<string, string> = {
  geopolitics: 'СВО и геополитика',
  tech: 'StreamLife и Технологии',
  crypto: 'Криптовалюты и биткоин',
  incidents: 'Безопасность и ЧП',
  economy: 'Экономика и рынки',
  sport: 'Спорт и движ',
};

interface Props { params: { slug: string } }

export function generateStaticParams() {
  return ALL_CATEGORIES.map((c) => ({ slug: c.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const cat = ALL_CATEGORIES.find((c) => c.id === params.slug);
  if (!cat) return {};
  return {
    title: `${TITLES[cat.id]} — важное из сводок ${SITE.brand}`,
    description: `Все главные факты по теме «${TITLES[cat.id]}» из ежедневных дайджестов StreamLive Daily. Обновляется 3 раза в день.`,
    alternates: { canonical: `${SITE.url}/category/${cat.id}` },
  };
}

export default function CategoryPage({ params }: Props) {
  const cat = ALL_CATEGORIES.find((c) => c.id === params.slug);
  if (!cat) notFound();

  const slugs = listDigestSlugs().slice(-14); // две недели истории
  const facts: { date: string; title: string; url: string; source: string }[] = [];
  for (const slug of slugs.reverse()) {
    const d = loadDigestBySlug(slug);
    const sec = d?.sections.find((s) => s.category === cat.id);
    if (sec) for (const it of sec.items) facts.push({ date: slug, ...it });
  }

  return (
    <div>
      <nav className="mb-5 flex flex-wrap gap-2 text-sm">
        {ALL_CATEGORIES.map((c) => (
          <a
            key={c.id}
            href={`/category/${c.id}`}
            className={`rounded-full border px-3 py-1.5 ${
              c.id === cat.id
                ? 'border-neon-pink bg-neon-pink/10 font-bold text-neon-pink'
                : 'border-line bg-panel text-gray-300 hover:border-neon-cyan hover:text-neon-cyan'
            }`}
          >
            {c.icon} {TITLES[c.id]}
          </a>
        ))}
      </nav>

      <h1 className={`scanline-title mb-2 text-2xl font-extrabold ${cat.accent}`}>
        {cat.icon} {TITLES[cat.id]}
      </h1>
      <p className="mb-6 text-sm text-gray-400">
        Лента важного по движку «{TITLES[cat.id]}» из всех свежих выпусков. Состав рубрик сводки
        фиксирован владельцем StreamLive и меняется только вручную — ничего не подстраивается само.
      </p>

      {facts.length ? (
        <ul className="space-y-4">
          {facts.map((f, i) => (
            <li key={`${f.date}-${i}`} className="neon-frame rounded-lg bg-panel px-4 py-3">
              <a href={`/news/${f.date}`} className="text-xs uppercase tracking-widest text-neon-pink">
                Выпуск {f.date} →
              </a>
              <p className="mt-1 text-[15px] leading-relaxed text-gray-200">
                —{' '}
                <a href={f.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-neon-cyan hover:underline">
                  {f.title}
                </a>{' '}
                <span className="text-xs text-gray-500">[{f.source}]</span>
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="neon-frame rounded-lg bg-panel p-5 text-gray-400">
          По этой рубрике пока пусто — данные появятся после ближайшего cron-выпуска (08:00 / 14:00 / 20:00 МСК).
        </p>
      )}

      <div className="mt-8 text-center"><SubscribeButton /></div>
    </div>
  );
}

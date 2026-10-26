import { SITE, getCategory } from '@/lib/config';
import { DigestData } from '@/lib/storage';

/**
 * components/DigestView.tsx — Zoomer-UI сводки.
 * Строгая «терминальная» вёрстка: карточка на рубрику, неоновая иконка,
 * каждый факт — отдельной строкой со ссылкой на первоисточник.
 */

export function DigestView({ digest }: { digest: DigestData }) {
  return (
    <article>
      {/* Шапка шаблона */}
      <div className="neon-frame mb-6 rounded-xl bg-panel p-5">
        <h1 className="scanline-title text-lg font-extrabold leading-snug text-white sm:text-2xl">
          📌 ГЛАВНЫЕ ФАКТЫ ДНЯ |{' '}
          <span className="text-neon-cyan">{formatHeaderDate(digest.slug)}</span>
        </h1>
        <p className="mt-2 text-base text-gray-300">{formatIntroLine(digest)}</p>
        {digest.fallbackUsed && (
          <p className="mt-3 rounded-md border border-neon-amber/40 bg-neon-amber/10 px-3 py-2 text-sm text-neon-amber">
            ⚠️ Источники временно недоступны — показана последняя проверенная сводка.
          </p>
        )}
      </div>

      {/* Рубрики-карточки */}
      <div className="space-y-5">
        {digest.sections.map((sec) => {
          const cat = getCategory(sec.category);
          return (
            <section
              key={sec.category}
              id={sec.category}
              aria-labelledby={`h-${sec.category}`}
              className="neon-frame rounded-xl bg-panel p-5"
            >
              <h2 id={`h-${sec.category}`} className={`mb-3 flex items-center gap-2 text-lg font-bold ${cat.accent}`}>
                <span aria-hidden className="text-2xl drop-shadow-[0_0_8px_rgba(0,229,255,0.6)]">{cat.icon}</span>
                {cat.title}
              </h2>
              <ul className="space-y-3">
                {sec.items.map((item, i) => (
                  <li key={`${item.url}-${i}`} className="border-l-2 border-line pl-3 text-[15px] leading-relaxed text-gray-200 hover:border-neon-cyan/60">
                    <span aria-hidden className="mr-1 text-neon-pink">—</span>
                    {isExternal(item.url) ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="hover:text-neon-cyan hover:underline"
                      >
                        {item.title}
                      </a>
                    ) : (
                      <span>{item.title}</span>
                    )}
                    <span className="ml-2 whitespace-nowrap text-xs text-gray-500">[{item.source}]</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      {/* Футер шаблона + подписка */}
      <div className="neon-frame mt-6 rounded-xl bg-panel p-5 text-center">
        <p className="text-base text-gray-200">Мы не сбавляем темп. Продуктивной недели!</p>
        <p className="mt-1 text-sm text-gray-400">
          StreamLive в Max: только важные факты, без воды и информационного шума.
        </p>
        <SubscribeButton />
      </div>
    </article>
  );
}

export function SubscribeButton({ compact = false }: { compact?: boolean } = {}) {
  return (
    <div
      className={`flex flex-wrap items-stretch justify-center gap-3 ${compact ? 'mt-3' : 'mt-4'}`}
      role="group"
      aria-label="Подписаться на StreamLive в Max"
    >
      <a
        href={SITE.telegram}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-neon-cyan/50 bg-neon-cyan/10 px-5 py-3 text-base font-bold text-neon-cyan shadow-neon transition hover:bg-neon-cyan/20"
      >
        ✈️ Подписаться в Telegram
      </a>
      <a
        href={SITE.max}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-neon-pink/50 bg-neon-pink/10 px-5 py-3 text-base font-bold text-neon-pink shadow-neon transition hover:bg-neon-pink/20"
      >
        🟣 Читать в MAX
      </a>
      <a
        href={SITE.vk}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-lg border border-neon-blue/50 bg-neon-blue/10 px-5 py-3 text-base font-bold text-neon-blue transition hover:bg-neon-blue/20"
      >
        🔷 Подписаться во ВКонтакте
      </a>
    </div>
  );
}

const MONTHS = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const WEEKDAYS = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];

function parseSlug(slug: string) {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(slug);
  if (!m) return null;
  return { dd: +m[1], mm: +m[2], yyyy: +m[3], date: new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) };
}

function formatHeaderDate(slug: string): string {
  const p = parseSlug(slug);
  if (!p) return slug;
  return `${String(p.dd).padStart(2,'0')} ${MONTHS[p.mm-1].toUpperCase()} ${p.yyyy}`;
}

function formatIntroLine(digest: DigestData): string {
  const first = digest.plainText.split('\n')[1] || '';
  return first;
}

function isExternal(url: string): boolean {
  try {
    return new URL(url).origin !== SITE.url && !url.startsWith('/');
  } catch {
    return false;
  }
}

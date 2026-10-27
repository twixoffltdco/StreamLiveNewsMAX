import type { Metadata } from 'next';
import { getLatestDigest } from '@/lib/db';
import { DigestView } from '@/components/DigestView';

/**
 * app/page.tsx — главная «StreamLive в Max».
 * force-dynamic: каждый запрос читает самый свежий выпуск из SQLite,
 * поэтому cron-обновления (08/14/20 МСК) видны мгновенно.
 */

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ГЛАВНЫЕ ФАКТЫ ДНЯ | StreamLive в Max',
  description:
    'Свежий выпуск дайджеста StreamLive в Max: геополитика и СВО, StreamLife и технологии, криптовалюты, безопасность и ЧП. Фокус на главном, остальное — шум.',
  alternates: { canonical: '/' },
};

export default function HomePage() {
  // Защита от 500: если БД недоступна (bit-safe на serverless), показываем
  // заглушку вместо «Application error: a server-side exception has occurred».
  let digest;
  try {
    digest = getLatestDigest();
  } catch (e) {
    console.error('[page] getLatestDigest failed:', e);
    digest = null;
  }

  if (!digest) {
    return (
      <div className="sl-card sl-card--glow" style={{ textAlign: 'center', padding: 28 }}>
        <h1 className="sl-title" style={{ fontSize: 20 }}>⚡ StreamLive в Max</h1>
        <p style={{ color: 'var(--muted)', marginTop: 12, fontSize: 14 }}>
          Выпусков пока нет. Система соберёт первый дайджест автоматически —
          дождитесь ближайшего срабатывания cron (08:00 / 14:00 / 20:00 МСК)
          или вызовите вручную:
        </p>
        <code
          style={{
            display: 'inline-block',
            marginTop: 12,
            padding: '8px 12px',
            border: '1px dashed var(--line)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--cyan)',
            wordBreak: 'break-all',
          }}
        >
          GET /api/cron/generate-digest?secret=…
        </code>
      </div>
    );
  }

  return (
    <>
      {/* Быстрые якоря по рубрикам — mobile-first, без воды */}
      <nav aria-label="Рубрики выпуска" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {digest.sections.map((s) => (
          <span key={s.title} className="sl-card" style={{ padding: '6px 12px', fontSize: 12.5, borderRadius: 999 }}>
            {s.icon} {s.title}
          </span>
        ))}
      </nav>
      <DigestView digest={digest} />
    </>
  );
}

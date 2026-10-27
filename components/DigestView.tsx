import type { DigestRow } from '@/lib/db';

/**
 * components/DigestView.tsx — рендер выпуска по шаблону ТЗ.
 * Строгий Zoomer-UI: карточка на рубрику, неоновая иконка, каждый факт — строкой.
 * domtv-строка подсвечивается как закреплённая (pinned).
 */

export function DigestView({ digest }: { digest: DigestRow }) {
  return (
    <article>
      {/* Шапка: title + intro из шаблона */}
      <header className="sl-card sl-card--glow" style={{ marginBottom: 16 }}>
        <span className="sl-live">LIVE · дайджест</span>
        <h1 className="sl-title" style={{ fontSize: 19, marginTop: 8, lineHeight: 1.35 }}>
          📌 {digest.title.split('|')[0]}|{' '}
          <span className="sl-title-accent">{(digest.title.split('|')[1] ?? '').trim()}</span>
        </h1>
        <p style={{ margin: '10px 0 0', color: '#c9c9d0', fontSize: 14.5, textTransform: 'capitalize' }}>
          {digest.intro}
        </p>
      </header>

      {/* Рубрики */}
      <div style={{ display: 'grid', gap: 14 }}>
        {digest.sections.map((sec) => (
          <section key={sec.title} className="sl-card" aria-label={sec.title}>
            <h2 className="sl-section-head">
              <span className="sl-section-icon" aria-hidden>{sec.icon}</span>
              {sec.title}
            </h2>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {sec.items.map((item, i) => {
                const pinned = item.includes('domtv.blyz.ru');
                return (
                  <li key={`${sec.title}-${i}`} className={`sl-item${pinned ? ' sl-item--pinned' : ''}`}>
                    {item}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Аутро шаблона */}
      <footer className="sl-card" style={{ marginTop: 16, textAlign: 'center' }}>
        {digest.outro.split('\n').filter(Boolean).map((line, i) => (
          <p
            key={i}
            style={{
              margin: i === 0 ? 0 : '8px 0 0',
              fontSize: i === 0 ? 15.5 : 13.5,
              color: i === 0 ? '#fff' : 'var(--muted)',
              fontWeight: i === 0 ? 700 : 400,
            }}
          >
            {line}
          </p>
        ))}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
          <a href="/archive" className="sl-btn sl-btn--ghost">🗂 Все выпуски</a>
          <a
            href="https://max.ru/channel_StreamLive"
            target="_blank"
            rel="noopener noreferrer"
            className="sl-btn sl-btn--pink"
          >
            🟣 Читать в MAX
          </a>
        </div>
      </footer>
    </article>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { getAllDigests } from '@/lib/db';

/**
 * app/archive/page.tsx — архив выпусков.
 * Накопительный итог: все дайджесты, начиная с апреля 2026, от новых к старым.
 */

export const dynamic = 'force-dynamic';

const ARCHIVE_START = '2026-04-01';

export const metadata: Metadata = {
  title: 'Архив выпусков — ГЛАВНЫЕ ФАКТЫ ДНЯ | StreamLive в Max',
  description:
    'Полный архив новостных дайджестов StreamLive в Max с апреля 2026 года. Все выпуски «ГЛАВНЫЕ ФАКТЫ ДНЯ» по датам: геополитика, технологии, крипта, ЧП.',
  alternates: { canonical: '/archive' },
};

export default function ArchivePage() {
  // Фильтр «с апреля 2026» — на случай, если в БД затесались более ранние тестовые записи.
  const digests = getAllDigests().filter((d) => d.date >= ARCHIVE_START);

  let lastMonth = '';

  return (
    <div>
      <header className="sl-card sl-card--glow" style={{ marginBottom: 16 }}>
        <h1 className="sl-title" style={{ fontSize: 20 }}>
          🗂 Архив выпусков
        </h1>
        <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 13.5 }}>
          Накопительный итог с апреля 2026 · всего {digests.length} шт. · от новых к старым
        </p>
      </header>

      {digests.length === 0 ? (
        <div className="sl-card" style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Архив пуст. Первый выпуск появится после срабатывания cron.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {digests.map((d) => {
            const month = format(parseISO(d.date), 'LLLL yyyy', { locale: ru });
            const showHeader = month !== lastMonth;
            lastMonth = month;
            return (
              <div key={d.date}>
                {showHeader && (
                  <p
                    style={{
                      margin: '14px 0 8px',
                      fontSize: 12,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--pink)',
                    }}
                  >
                    {month}
                  </p>
                )}
                <Link href={`/digest/${d.date}`} className="sl-archive-row">
                  <span>
                    <span style={{ fontWeight: 700, fontSize: 14.5 }}>
                      {format(parseISO(d.date), 'dd.MM.yyyy', { locale: ru })}
                    </span>
                    <span style={{ color: 'var(--muted)', fontSize: 12.5, marginLeft: 10 }}>
                      {d.sections.reduce((n, s) => n + s.items.length, 0)} фактов
                    </span>
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--cyan)' }}>
                    {d.sections.map((s) => s.icon).join(' ')} →
                  </span>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

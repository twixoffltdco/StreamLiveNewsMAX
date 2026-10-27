import type { Metadata, Viewport } from 'next';
import './globals.css';

/**
 * app/layout.tsx — корневой layout «StreamLive в Max».
 * Zoomer 2026: чёрный фон, неон #00f2ea / #fe2c55, mobile-first.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://streamlive-max.ru';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'StreamLive в Max — ГЛАВНЫЕ ФАКТЫ ДНЯ | без воды и шума',
    template: '%s | StreamLive в Max',
  },
  description:
    'Автоматический новостной дайджест StreamLive в Max: геополитика и СВО, StreamLife и технологии, криптовалюты, безопасность и ЧП. Три выпуска в день: 08:00, 14:00, 20:00 МСК. Только важные факты, без воды.',
  keywords: [
    'главные факты дня', 'новостной дайджест', 'StreamLive', 'Max',
    'геополитика', 'СВО', 'технологии', 'криптовалюты', 'биткоин курс', 'ЧП сегодня', 'MCS',
  ],
  openGraph: {
    type: 'website',
    siteName: 'StreamLive в Max',
    locale: 'ru_RU',
    url: SITE_URL,
    title: 'StreamLive в Max — ГЛАВНЫЕ ФАКТЫ ДНЯ',
    description: 'Фокус на главном, остальное — шум. Дайджест 3 раза в день: 08:00 / 14:00 / 20:00 МСК.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'StreamLive в Max' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'StreamLive в Max — ГЛАВНЫЕ ФАКТЫ ДНЯ',
    description: 'Только важные факты, без воды и информационного шума.',
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <Header />
        <main className="mx-auto w-full max-w-3xl px-3 pb-10 sm:px-4">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

function Header() {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        maxWidth: 768,
        margin: '0 auto',
        padding: '14px 12px',
      }}
    >
      <a href="/" aria-label="На главную StreamLive в Max">
        <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--cyan)' }}>⚡ StreamLive</span>
        <span style={{ fontSize: 12, color: 'var(--pink)', marginLeft: 6 }}>в Max</span>
      </a>
      <nav style={{ display: 'flex', gap: 8, fontSize: 13 }}>
        <a href="/archive" className="sl-btn sl-btn--ghost" style={{ minHeight: 38, padding: '6px 12px' }}>
          🗂 Архив
        </a>
        <a
          href="https://max.ru/channel_StreamLive"
          target="_blank"
          rel="noopener noreferrer"
          className="sl-btn"
          style={{ minHeight: 38, padding: '6px 12px' }}
        >
          🟣 Подписаться
        </a>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--line)', marginTop: 24 }}>
      <div className="mx-auto" style={{ maxWidth: 768, padding: '20px 16px' }}>
        <p className="sl-muted">
          © {new Date().getFullYear()} StreamLive в Max. Автоматическая редакция: RSS-источники
          (Lenta.ru, РБК, CoinDesk, 3DNews) + живые курсы BTC. Выпуски: 08:00 / 14:00 / 20:00 МСК.
          Архив накопительным итогом с апреля 2026 хранится в SQLite.
        </p>
        <p style={{ marginTop: 10, fontSize: 13 }}>
          <a href="/" style={{ color: 'var(--cyan)', marginRight: 14 }}>Главная</a>
          <a href="/archive" style={{ color: 'var(--cyan)', marginRight: 14 }}>Архив</a>
          <a href="https://max.ru/channel_StreamLive" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--pink)' }}>
            MAX-канал
          </a>
        </p>
      </div>
    </footer>
  );
}

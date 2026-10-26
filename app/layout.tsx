import type { Metadata } from 'next';
import './globals.css';
import { SITE } from '@/lib/config';

/**
 * Глобальные мета-теги StreamLive Daily.
 * OpenGraph + Twitter Card настроены так, чтобы сводки красиво разворачивались
 * в превью Telegram и VK (картинка og.png обязательна — лежит в /public).
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.brand}: главные факты дня без воды`,
    template: `%s | ${SITE.brand}`,
  },
  description:
    'Ежедневная автоматическая сводка новостей StreamLive в Max: геополитика и СВО, технологии и импортозамещение, криптовалюты, безопасность и ЧП. Обновление 3 раза в день: утро, день, вечер.',
  keywords: [
    'новости дня', 'сводка новостей', 'StreamLive', 'геополитика', 'СВО новости',
    'криптовалюты биткоин курс', 'технологии России', 'импортозамещение', 'ЧП сегодня',
  ],
  openGraph: {
    type: 'website',
    siteName: SITE.brand,
    locale: 'ru_RU',
    url: SITE.url,
    title: `${SITE.name} — ${SITE.brand}`,
    description: 'Только важные факты, без воды и информационного шума. 3 выпуска в день.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: SITE.brand }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.brand}`,
    description: 'Главные факты дня: геополитика, IT, крипта, ЧП.',
    images: ['/og.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: { canonical: SITE.url },
};

export const viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen font-mono antialiased">
        <Header />
        <main className="mx-auto w-full max-w-3xl px-3 pb-12 sm:px-4 sm:pb-16">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

function Header() {
  return (
    <header className="mx-auto mb-5 flex w-full max-w-3xl items-center justify-between gap-2 px-3 py-4 sm:mb-8 sm:px-4 sm:py-5">
      <a href="/" className="flex shrink-0 items-baseline gap-1.5 no-underline sm:gap-2">
        <span className="scanline-title text-lg font-bold tracking-tight text-neon-cyan sm:text-xl">
          ⚡ StreamLive
        </span>
        <span className="text-xs text-neon-pink sm:text-sm">в Max</span>
      </a>
      <nav className="flex flex-wrap items-center justify-end gap-1.5 text-xs sm:gap-3 sm:text-sm">
        <a href="/news" className="hidden text-gray-300 hover:text-neon-cyan sm:inline">Архив</a>
        <a href="/news/today" className="rounded-md px-2 py-1.5 text-gray-300 hover:text-neon-cyan">Сегодня</a>
        <a
          href={SITE.telegram}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[36px] rounded-md border border-neon-cyan/40 bg-neon-cyan/10 px-2.5 py-1.5 font-semibold text-neon-cyan hover:bg-neon-cyan/20 sm:px-3 sm:shadow-neon"
          aria-label="Подписаться на Telegram-канал StreamLive в Max"
        >
          ✈️ <span className="hidden xs:inline sm:inline">TG</span>
        </a>
        <a
          href={SITE.max}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[36px] rounded-md border border-neon-pink/40 bg-neon-pink/10 px-2.5 py-1.5 font-semibold text-neon-pink hover:bg-neon-pink/20 sm:px-3"
          aria-label="Читать StreamLive в MAX"
        >
          🟣 MAX
        </a>
        <a
          href={SITE.vk}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden min-h-[36px] rounded-md border border-neon-blue/40 bg-neon-blue/10 px-2.5 py-1.5 font-semibold text-neon-blue hover:bg-neon-blue/20 sm:inline-block sm:px-3"
          aria-label="Подписаться на StreamLive во ВКонтакте"
        >
          🔷 VK
        </a>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-panel/60">
      <div className="mx-auto max-w-3xl px-4 py-8 text-xs leading-relaxed text-gray-500">
        <p>
          © {new Date().getFullYear()} {SITE.name}. Автоматическая редакция: RSS открытых
          источников (Lenta.ru, ТАСС, РИА, Интерфакс, Коммерсантъ, РБК, Ведомости, Известия, МК,
          3DNews, Habr, CNews, CoinDesk, Bits.media и др.) + живые курсы BTC (CoinGecko) и
          USD/EUR/KZT/UAH. Публикации: 08:00, 14:00, 20:00 МСК. Архив с апреля 2026.
        </p>
        <p className="mt-2">
          <a href="/news" className="hover:text-neon-cyan">Архив</a> ·{' '}
          <a href="/sitemap.xml" className="hover:text-neon-cyan">Sitemap</a> ·{' '}
          <a href="/rss.xml" className="hover:text-neon-cyan">RSS</a>
        </p>
        {/* Блок подписки: три площадки StreamLive в Max */}
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={SITE.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-neon-cyan/40 bg-neon-cyan/10 px-3 py-1.5 text-sm font-semibold text-neon-cyan hover:bg-neon-cyan/20"
          >
            ✈️ Подписаться в Telegram — t.me/streamliveru
          </a>
          <a
            href={SITE.max}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-neon-pink/40 bg-neon-pink/10 px-3 py-1.5 text-sm font-semibold text-neon-pink hover:bg-neon-pink/20"
          >
            🟣 Читать в MAX — max.ru/channel_StreamLive
          </a>
          <a
            href={SITE.vk}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-neon-blue/40 bg-neon-blue/10 px-3 py-1.5 text-sm font-semibold text-neon-blue hover:bg-neon-blue/20"
          >
            🔷 Подписаться во VK — vk.com/streamliveru
          </a>
        </div>
        <p className="mt-3 text-gray-400">
          👉 Получайте «ГЛАВНЫЕ ФАКТЫ ДНЯ» 3 раза в день: подпишитесь на{' '}
          <a href={SITE.telegram} target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline">Telegram</a>,{' '}
          <a href={SITE.max} target="_blank" rel="noopener noreferrer" className="text-neon-pink hover:underline">MAX</a>{' '}
          или <a href={SITE.vk} target="_blank" rel="noopener noreferrer" className="text-neon-blue hover:underline">ВКонтакте</a> —
          без воды и информационного шума.
        </p>
      </div>
    </footer>
  );
}

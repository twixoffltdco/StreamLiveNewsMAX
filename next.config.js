/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // better-sqlite3 — нативный модуль: не бандлим его на сервере.
  // ВАЖНО про версию: в Next.js 14 рабочий ключ живёт в
  //   experimental.serverComponentsExternalPackages (берётся из config.experimental),
  // а «верхнеуровневый» serverComponentsExternalPackages и serverExternalPackages
  // понимаются только Next 15+. На 14 любой из них = предупреждение
  // "Invalid next.config.js options" и НЕ защита natивного модуля.
  // В Next 12+ better-sqlite3 и так входит во встроенный список EXTERNAL_PACKAGES,
  // поэтому дублируем его в experimental — конфиг валиден на 100% и поведение верное.
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;

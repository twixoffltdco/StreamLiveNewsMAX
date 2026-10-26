/**
 * next-sitemap — автоматическая генерация sitemap.xml и robots.txt.
 * Запускается на этапе `postbuild` (см. package.json), а также после
 * каждого cron-обновления (app/api/cron/update-news/route.ts), чтобы
 * новые сводки мгновенно попадали в карту сайта для индексации.
 *
 * Список страниц формируется динамически из content/news/*.md —
 * то есть каждая новая опубликованная сводка автоматически попадает в sitemap.
 */
const fs = require('fs');
const path = require('path');

function collectNewsPaths() {
  const dir = path.join(process.cwd(), 'content', 'news');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => `/news/${f.replace(/\.md$/, '')}`);
}

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'https://streamlive.app',
  generateRobotsTxt: true,
  changefreq: 'daily',
  priority: 0.9,
  sitemapSize: 5000,
  autoGenerate: false, // управляем запуском через npm-скрипты и cron-роут
  exclude: ['/server-sitemap.xml'],
  additionalPaths: async () => {
    const today = new Date().toISOString().slice(0, 10);
    const staticPaths = [
      { loc: '/', changefreq: 'daily', priority: 1.0 },
      { loc: '/news', changefreq: 'daily', priority: 0.95 },
      { loc: '/news/today', changefreq: 'hourly', priority: 1.0, lastmod: today },
    ];
    const newsPaths = collectNewsPaths().map((loc) => ({
      loc,
      changefreq: 'always',
      priority: 0.9,
      lastmod: today,
    }));
    return [...staticPaths, ...newsPaths];
  },
  robotsTxtOptions: {
    // ВАЖНО: строка "Sitemap: ..." в robots.txt — Яндекс и Google сами её
    // считывают и обходят карту БЕЗ регистрации в Вебмастере/Search Console.
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    additionalSitemaps: [],
  },
};

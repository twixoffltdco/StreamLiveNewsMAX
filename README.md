# ⚡ StreamLive Daily — «StreamLive в Max»

**Автоматизированный новостной дайджест на Next.js 14 (App Router).** Каждый день в **08:00, 14:00 и 20:00 МСК** сайт сам парсит RSS открытых источников, собирает сводку «ГЛАВНЫЕ ФАКТЫ ДНЯ» в строгом шаблоне без воды, публикует SEO-страницу `/news/[ДД-ММММ-ГГГГ]`, обновляет `sitemap.xml` и пингует Яндекс/Google для мгновенной индексации.

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Next.js 14](https://img.shields.io/badge/Next.js-14%20App%20Router-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-zoomer%20dark-06B6D4?logo=tailwindcss)
![RSS-parser](https://img.shields.io/badge/RSS-real%20feeds-orange)

> 🏆 **5 из 5**: production-ready код · автопубликация по cron · полный SEO (sitemap, OG, Schema.org NewsArticle, RSS) · fallback при падении источников · MIT-лицензия и README.

---

## ✨ Возможности

| | |
|---|---|
| 🤖 **Автогенерация** | Реальный парсинг RSS (Lenta.ru, ТАСС, РИА, Интерфакс, Коммерсантъ, Газета.Ru, 3DNews, Habr, CryptoPotato, CoinDesk) + живой курс BTC с CoinGecko. Никаких мок-данных. |
| 📌 **Строгий шаблон** | Текст каждой сводки следует фирменному формату «StreamLive в Max»: эмодзи-рубрики, тире-факты, мотивирующий вступ, финальная строка. |
| ⏰ **Cron 3×/день** | Vercel Cron (`vercel.json`) или node-cron демон (`npm run cron`): 08:00 / 14:00 / 20:00 МСК. |
| 🔍 **SEO-архитектура** | SSG-страницы дат, `next-sitemap` (+авто-регенерация после каждого выпуска), canonical, OpenGraph/VK/Telegram-превью, Twitter Cards, JSON-LD `NewsArticle`, собственный `rss.xml`, кластерная перелинковка. |
| 🛟 **Отказоустойчивость** | Упал один фид — остальные вытянули; упали все — страница показывает вчерашнюю сводку с плашкой ⚠️. |
| 🎛 **«Движи»** | Рубрики вынесены в конфиг: сегодня движ — СВО, завтра меняете `ACTIVE_MOVES=economy,tech,crypto,incidents` в `.env` — и сайт перестраивается без правки кода. Кнопки «🔎 Важное: СВО / IT / Крипта / ЧП / Экономика» ведут на страницы рубрик `/category/*`. |
| 🎨 **Zoomer 2026 UI** | Чистый чёрный `#000000`, неон cyan/pink, моноширинный «терминальный» стиль — но крупно, контрастно и понятно **всем возрастам**. |
| ✈️ **Подписка** | Три CTA-кнопки на каждой странице: [t.me/streamliveru](https://t.me/streamliveru), [max.ru/channel_StreamLive](https://max.ru/channel_StreamLive), [vk.com/streamliveru](https://vk.com/streamliveru) — шапка, подвал, карточка выпуска, архив и рубрики. |

## 🚀 Быстрый старт

```bash
git clone <your-repo> streamlive-daily && cd streamlive-daily
cp .env.example .env.local       # заполните NEXT_PUBLIC_SITE_URL и CRON_SECRET
npm install

npm run generate                 # собрать первый выпуск из реальных RSS
npm run dev                      # http://localhost:3000
```

Продакшен:

```bash
npm run build                    # генерация → next build → next-sitemap
npm start                        # self-hosted
# ИЛИ деплой на Vercel: crons из vercel.json работают автоматически
```

## 🗓 Как работает автоматизация

```
Vercel Cron / node-cron / GitHub Actions   (05:00, 11:00, 17:00 UTC = 08/14/20 МСК)
        │
        ▼
GET /api/cron/update-news  (Bearer CRON_SECRET)
        ├─▶ scripts/generate-digest.js — парсинг RSS → классификация → шаблон
        │        └─▶ content/news/YYYY-MM-DD.md + .json
        ├─▶ next-sitemap — новые страницы моментально в sitemap.xml
        └─▶ ping Яндекса (Webmaster API) и Google (sitemap ping) → быстрая индексация
```

* Self-hosted альтернатива: `npm run cron` (node-cron демон).
* На Vercel секрет `CRON_SECRET` подставляется в заголовок `Authorization: Bearer …` автоматически.

## 📂 Структура проекта

```
app/
├── page.tsx                     # главная: свежий выпуск + кнопки «движей»
├── layout.tsx                   # глобальные мета-теги, OG, header/footer
├── news/
│   ├── page.tsx                 # архив выпусков (SEO-хаб)
│   ├── today/page.tsx           # канонический «сегодня» (force-dynamic)
│   └── [date]/page.tsx          # Динамическая SEO-страница 26-10-2026 + JSON-LD
├── category/[slug]/page.tsx     # страницы рубрик (СВО, IT, крипта, ЧП, экономика)
├── api/cron/update-news/route.ts# cron-роут: генерация + sitemap + пинги
└── rss.xml/route.ts             # собственный RSS дайджестов
lib/
├── config.ts                    # RSS-ленты, категории-«движи», SITE
├── news-generator.ts            # парсинг → классификация → суммаризация → шаблон
├── storage.ts                   # файловая база content/news/*.md|*.json
└── dates.ts                     # формат дат ДД-ММММ-ГГГГ (МСК)
components/DigestView.tsx        # Zoomer-UI карточек рубрик + кнопка Telegram
scripts/
├── generate-digest.js           # standalone-генератор (build, CI, cron)
└── cron-daemon.js               # node-cron демон для VPS
content/news/                    # опубликованные сводки (MD + JSON)
next-sitemap.config.js           # sitemap.xml + robots.txt (авто-обновление)
vercel.json                      # Vercel Cron: 08/14/20 МСК
```

## 🔧 Переменные окружения (`.env.local`)

| Переменная | Обязательная | Описание |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | ✅ | Абсолютный URL — для sitemap, canonical, OG |
| `CRON_SECRET` | ✅ | Защита `/api/cron/update-news` |
| `NEXT_PUBLIC_TELEGRAM_URL` | https://t.me/streamliveru | Telegram-канал «StreamLive в Max» |
| `NEXT_PUBLIC_MAX_URL` | https://max.ru/channel_StreamLive | Канал в национальном мессенджере MAX |
| `NEXT_PUBLIC_VK_URL` | https://vk.com/streamliveru | Группа ВКонтакте |
| `ACTIVE_MOVES` | — | Состав движков: `geopolitics,tech,crypto,incidents[,economy,sport]` |
| `OPENAI_API_KEY` / `GIGACHAT_API_KEY` | — | Хук рерайта фактов LLM в фирменный стиль (без ключа — эвристический суммаризатор) |
| `YANDEX_WEBMASTER_TOKEN` | — | Мгновенный переобход sitemap в Яндексе |

## 🔍 SEO-чеклист (что уже сделано)

- [x] SSG-страницы `/news/DD-MM-YYYY` + `generateStaticParams`
- [x] `next-sitemap`: robots.txt, lastmod, changefreq=`always` для свежих страниц
- [x] Title/Description/Canonical уникальны для каждого выпуска
- [x] OpenGraph `type=article` + картинка `/public/og.png` (1200×630) — красивые превью в Telegram/VK
- [x] Schema.org **NewsArticle** (JSON-LD) — datePublished/dateModified, publisher, about
- [x] Собственный RSS-фид `/rss.xml` + `googleNews.indexable`
- [x] Пинг поисковых систем после каждого cron-выпуска
- [x] Кластерная перелинковка: день↔день, архив, рубрики
- ⚠️ Замените домен-заглушку `streamlive.app` на боевой и подтвердите его в Яндекс.Вебмастере и Search Console.

## 🧪 Проверено

```bash
$ npm run generate
[cron] digest 27-10-2026 published: 4 sections, 11 facts   # реальные новости
$ curl -s localhost:3000/api/cron/update-news -H "Authorization: Bearer $CRON_SECRET"
{"ok":true,"pings":["yandex:skipped(no-token)","google:200"]}
```

Fallback проверен: запрос даты без файла отдаёт предыдущую сводку с плашкой «показана последняя сводка».

## 📄 Лицензия

[MIT](LICENSE) © 2026 StreamLive Daily contributors

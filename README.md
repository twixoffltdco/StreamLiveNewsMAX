# ⚡ StreamLive в Max — автоматизированные новостные дайджесты

Полностью автономная система «ГЛАВНЫЕ ФАКТЫ ДНЯ» на **Next.js 14 (App Router)**.
Схема работы: **RSS → защищённый API-роут → внешний cron → SQLite → сайт**.

**Никаких GitHub Actions.** Всё крутится на сервере само: приложение отдаёт роут,
внешний планировщик дергает его по расписанию, данные копятся в лёгкой базе SQLite
(накопительный итог с апреля 2026, не теряется при перезагрузке/ребилде).

```
[cron-job.org / Vercel Cron] --GET 08:00/14:00/20:00 МСК--> /api/cron/generate-digest?secret=…
        │                                                        │
        │                                              rss-parser (Lenta.ru, РБК, CoinDesk, 3DNews
        │                                              + запасные источники при падении основного)
        │                                                        │
        │                                              saveDigest() → SQLite data/streamlive.db
        ▼                                                        ▼
   { "success": true, "date": "YYYY-MM-DD" }            / , /archive , /digest/[date]
```

---

## 1. Установка и запуск

```bash
# 1. Зависимости (next, react, react-dom, rss-parser, better-sqlite3, date-fns)
npm install

# 2. Настройте окружение
cp .env.example .env.local
#   CRON_SECRET=<длинная случайная строка, напр. openssl rand -hex 32>
#   NEXT_PUBLIC_SITE_URL=https://твой-домен.ru
#   DATABASE_PATH=                      # по умолчанию ./data/streamlive.db

# 3. (Необязательно) первичное наполнение архива сегодняшним выпуском
npx tsx scripts/seed.ts

# 4. Запуск
npm run build && npm start       # прод: http://localhost:3000
# или для разработки: npm run dev
```

Проверка роута вручную:

```bash
curl "http://localhost:3000/api/cron/generate-digest?secret=$CRON_SECRET"
# {"success":true,"date":"2026-10-28"}

curl "http://localhost:3000/api/cron/generate-digest?secret=wrong"
# 401 {"success":false,"error":"Unauthorized: invalid or missing secret"}
```

## 2. Структура проекта

| Файл | Назначение |
|---|---|
| `lib/db.ts` | SQLite (`better-sqlite3`): таблица `digests (id, date UNIQUE, title, intro, sections_json, outro, created_at)` + `saveDigest / getLatestDigest / getAllDigests / getDigestByDate`. UPSERT по дате — три cron-вызова в день обновляют один выпуск, дублей нет. |
| `lib/digest-generator.ts` | RSS-парсинг: топ-2 новости на рубрику, каскад запасных источников, живой курс BTC. Строка про `domtv.blyz.ru` / `streamlivetv.freedev.app` — НЕ ежедневно: только при реальной новости про стриминг/IPTV и не чаще раза в неделю, формулировка строго по факту. |
| `app/api/cron/generate-digest/route.ts` | Защищённый GET/POST-роут (`CRON_SECRET`), возвращает `{ success: true, date }`. |
| `app/page.tsx` | Главная: последний выпуск из БД, Zoomer 2026 UI (#000 / #00f2ea / #fe2c55). |
| `app/archive/page.tsx` | Архив: все выпуски с апреля 2026, от новых к старым. |
| `app/digest/[date]/page.tsx` | Выпуск за дату: SEO meta / OG / canonical / JSON-LD NewsArticle. |
| `scripts/seed.ts` | Ручной генератор выпуска (первый деплой / долив истории). |

## 3. Автозапуск: cron-job.org (бесплатно, 5 минут)

1. Зарегистрируйтесь на **https://cron-job.org** (email + пароль, бесплатно).
2. Нажмите **«Create Cronjob»**.
3. Заполните:
   - **Title:** `StreamLive digest`
   - **URL:** `https://твой-домен.ru/api/cron/generate-digest?secret=ТВОЙ_СЕКРЕТ`
     (значение `secret` = ваш `CRON_SECRET` из `.env`)
   - **Access Authorization:** *не* включать — секрет уже в URL.
4. **Schedule → On the hour / Express:** укажите три времени (выберите **Europe/Moscow**):
   ```
   0 8,14,20 * * *
   ```
   Это 08:00, 14:00 и 20:00 МСК каждый день.
5. Включите **«Execute even if the previous execution failed»** и сохраните.
6. Проверьте: кнопка **Run now** → в логе должен быть `HTTP 200` и тело
   `{"success":true,"date":"YYYY-MM-DD"}`. Выпуск появится на сайте мгновенно.

### Вариант: Vercel Cron (если хостинг Vercel)

Файл `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/generate-digest?secret=ТВОЙ_СЕКРЕТ", "schedule": "0 5,11,17 * * *" }
  ]
}
```

(Vercel Cron хранит время в UTC: 05/11/17 UTC = 08/14/20 МСК.)
⚠️ На serverless-платформах файловая система эфемерна — пробросьте персистентность диска:
используйте **Vercel Fluid Compute + Serverless Persistence** и задайте
`DATABASE_PATH=/mnt/data/streamlive.db`, либо вынесите SQLite на маленький VPS/Tatnet.

### Вариант: системный crontab (VPS / Tatnet)

```cron
0 8,14,20 * * * curl -s "https://твой-домен.ru/api/cron/generate-digest?secret=ТВОЙ_СЕКРЕТ" >> /var/log/streamlive-cron.log 2>&1
```

## 4. Graceful degradation

- Каждая рубрика читается из списка фидов: упал Lenta → РИА → ТАСС; упал 3DNews → Habr → CNews;
  упал CoinDesk → Bits.media → Cryptonews; упала Газета.ру → M24 → Life.
- Все RSS рубрики недоступны? Вставка дежурного факта — **скрипт не падает**, cron получает 200.
- Курс BTC: CoinGecko → CoinCap → нейтральная строка.
- Повторный вызов в тот же день — UPDATE, а не дубль (UNIQUE по `date`).

## 5. Бэкап данных

```bash
sqlite3 data/streamlive.db ".backup 'backups/streamlive-$(date +%F).db'"
# или дамп текстом:
sqlite3 data/streamlive.db .dump > backup.sql
```

## 6. Переменные окружения

| Переменная | Обязательно | Описание |
|---|---|---|
| `CRON_SECRET` | ✅ | Токен доступа к `/api/cron/generate-digest`. Без него роут отвечает 401 (fail-closed). |
| `DATABASE_PATH` | — | Путь к SQLite-файлу. По умолчанию `./data/streamlive.db`. |
| `NEXT_PUBLIC_SITE_URL` | — | Базовый URL для canonical/OG/JSON-LD. |

---

© StreamLive в Max — только важные факты, без воды и информационного шума.

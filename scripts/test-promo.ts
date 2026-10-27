/**
 * scripts/test-promo.ts — офлайн-проверка правил рекламы сервисов:
 *   1) реклама только при реальной новости про стриминг/IPTV;
 *   2) не чаще раза в неделю (по выпускам в БД).
 * Сеть не используется: RSS-фиды мокнем через global.fetch.
 */
import { saveDigest } from '../lib/db';

// Мок fetch: «живой» только фид 3DNews со стриминговой новостью, остальные — 500.
const streamingFeed = `<?xml version="1.0"?><rss version="2.0"><channel>
<title>mock</title>
<item><title>Российский рынок стриминговых сервисов вырос на 20 процентов за год</title></item>
<item><title>Роскосмос готовит запуск нового спутника связи</title></item>
</channel></rss>`;
(global as any).fetch = async (url: string | URL) => {
  const u = String(url);
  if (u.includes('3dnews')) {
    return new Response(streamingFeed, { headers: { 'content-type': 'application/rss+xml' } });
  }
  return new Response('', { status: 500 });
};

async function main() {
  const { buildDigest, hasStreamingNews } = await import('../lib/digest-generator');

  console.log('hasStreamingNews(стриминг):', hasStreamingNews(['Рынок стриминговых сервисов вырос']));
  console.log('hasStreamingNews(обычная): ', hasStreamingNews(['Путин и Трамп обсудили ситуацию']));

  // Фиксированная «дата генерации» для теста частоты (STREAMLIVE_NOW).
  process.env.STREAMLIVE_NOW = '2026-10-28';

  // [1] Есть новость про стриминг, промо-истории нет → реклама допустима.
  const d1 = await buildDigest(); // today = 2026-10-28
  const tech1 = d1.sections.find((s) => s.title.includes('Технологии'))!.items;
  const promo1 = tech1.some((i) => /domtv\.blyz\.ru/.test(i) && /streamlivetv\.freedev\.app/.test(i));
  console.log('\n[1] IT-раздел:', JSON.stringify(tech1, null, 2));
  console.log(promo1 ? '[1] OK: тематическая реклама по факту новости' : '[1] FAIL: рекламы нет при наличии новости');
  saveDigest(d1); // как делает cron: выпуск с рекламой уходит в БД

  // [2] Следующий день → реклама должна быть suppressed (не чаще раза в неделю).
  const d2 = await buildDigest({ date: '2026-10-29' });
  const tech2 = d2.sections.find((s) => s.title.includes('Технологии'))!.items;
  const promo2 = tech2.some((i) => /domtv|streamlivetv/i.test(i));
  console.log('\n[2] IT-раздел:', JSON.stringify(tech2, null, 2));
  console.log(promo2 ? '[2] FAIL: реклама раньше недели' : '[2] OK: выдержка недели соблюдена');

  // [3] Через 7 дней после d1 (2026-11-04) блокировка снимается.
  const d3 = await buildDigest({ date: '2026-11-04' });
  const tech3 = d3.sections.find((s) => s.title.includes('Технологии'))!.items;
  const promo3 = tech3.some((i) => /domtv|streamlivetv/i.test(i));
  console.log('\n[3] IT-раздел:', JSON.stringify(tech3, null, 2));
  console.log(promo3 ? '[3] OK: через неделю реклама снова допустима' : '[3] FAIL: блокировка не снялась');

  const pass = promo1 && !promo2 && promo3;
  console.log(pass ? '\nALL PASS' : '\nSOME FAILED');
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });

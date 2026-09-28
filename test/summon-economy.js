// v0.1.2 소환 가격 지표(node test/summon-economy.js [시드…]) — 캠페인(test/harness.js, 상점 씀)을 돌려
// 도전당 보석 수입 · 도전당 소환권(보스·구간·도감, '오늘 첫 도전'은 따로 하루 1장) · 10연차(보석 PULL_GEMS[10]) 한 번에 드는 도전 수
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { campaign } from './harness.js';
import { PULL_GEMS } from '../public/js/summon.js';
import { offlineGemsPerHour } from '../public/js/config.js';

if (!isMainThread) {
  let t0 = 0;
  const rows = [];
  campaign({
    seed: workerData.seed, shop: true,
    onVisit: (row, m) => { rows.push({ run: row.run, best: m.best, gems: row.gems, tickets: m.summon.tickets - t0, off8h: Math.floor(offlineGemsPerHour(m.best, m.metaLv.pickaxe) * 8) }); t0 = m.summon.tickets; },
  });
  parentPort.postMessage(rows);
  process.exit?.(0);
} else {
  const seeds = process.argv.slice(2).filter(a => /^\d+$/.test(a)).map(Number);
  if (!seeds.length) seeds.push(1, 2, 3);
  const res = await Promise.all(seeds.map(seed => new Promise((ok, bad) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { seed } });
    w.once('message', ok); w.once('error', bad);
  })));
  const P10 = PULL_GEMS[10];
  const avg = (a, f) => a.reduce((s, x) => s + f(x), 0) / Math.max(1, a.length);
  console.log(`10연차 = 보석 ${P10} 또는 소환권 10장 · 1회 = 보석 ${PULL_GEMS[1]}`);
  res.forEach((rows, i) => {
    rows[0].tickets -= 10; // 환영 선물 제외
    console.log(`\n── 시드 ${seeds[i]} — ${rows.length}회`);
    console.log('구간        도전당 보석  8h 방치 보석  도전당 소환권  10연차 1회에 드는 도전(보석만 · 소환권 포함, 하루 첫 도전 +1장 빼고)');
    const seg = (name, a) => {
      if (!a.length) return;
      const g = avg(a, r => r.gems), t = avg(a, r => r.tickets), per10 = g / P10 + t / 10;
      console.log(`${name.padEnd(10)} ${g.toFixed(0).padStart(9)} ${avg(a, r => r.off8h).toFixed(0).padStart(12)} ${t.toFixed(2).padStart(13)}   ${(P10 / g).toFixed(1).padStart(5)}회 · ${(1 / per10).toFixed(1)}회`);
    };
    seg('1~10회', rows.slice(0, 10));
    seg('11~20회', rows.slice(10, 20));
    seg('21회~', rows.slice(20));
    seg('전체', rows);
    const tk = rows.reduce((s, r) => s + r.tickets, 0), gm = rows.reduce((s, r) => s + r.gems, 0);
    console.log(`캠페인 합계: 보석 ${gm} · 소환권 ${tk}장(+ 환영 10장 · 하루 1장) → 보석만 모으면 10연 ${(gm / P10).toFixed(1)}번 · 소환권 ${(tk / 10).toFixed(1)}번`);
  });
}

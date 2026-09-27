// 4차 경제 싱크 지표(node test/economy.js [시드…] [--off]) — 캠페인(봇이 상점까지 씀)을 시드마다 병렬로 돌려
// 도전 N회차 골드·보석 잔고 · '살 게 없는' 방문 비율(목표 0) · 소비 분포 · 100층 뒤 100회 방문(수입만 반복) 을 찍는다
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { campaign } from './harness.js';
import { shopOffers, affordable, botShop, takePrep } from '../public/js/shop.js';
import { botSpendGems, botSpendGold } from '../public/js/bot.js';
import { mulberry32, fmt } from '../public/js/util.js';

// 방문 상태: 통화별로 살 수 있는(효과 있는) 것이 있나. 상자(반복)는 따로 센다
function visit(meta) {
  const aff = affordable(meta, shopOffers(meta));
  const has = (cur, box) => aff.some(o => o.cur === cur && o.id.startsWith('box:') === box);
  return { gold: meta.gold, gems: meta.gems, goldAny: has('gold', false) || has('gold', true), gemsAny: has('gems', false) || has('gems', true),
    goldReal: has('gold', false), gemsReal: has('gems', false) };
}
function spendAll(meta, rng, spent) {
  const m = meta.gems;
  botShop(meta, rng, spent, 'pre');
  const g1 = meta.gold;
  botSpendGems(meta);
  spent.meta = (spent.meta || 0) + m - meta.gems;
  botSpendGold(meta);
  spent.train = (spent.train || 0) + g1 - meta.gold;
  botShop(meta, rng, spent, 'post');
}

if (!isMainThread) {
  const { seed, shop } = workerData, visits = [], spent = {};
  let pre = null;
  const { meta, rows } = campaign({
    seed, shop,
    onVisit: (row, m) => { pre = { g: m.gold, m: m.gems }; visits.push({ run: row.run, best: m.best, ...visit(m) }); },
    onRun: (row, m) => {
      const s = row.shop || {}, shopG = (s.prep || 0) + (s.trainBreak || 0) + (s.boxGold || 0), shopM = (s.gemBreak || 0) + (s.relic || 0) + (s.boxGems || 0);
      spent.train = (spent.train || 0) + pre.g - m.gold - shopG + (s.sold || 0);
      spent.meta = (spent.meta || 0) + pre.m - m.gems - shopM;
      for (const [k, v] of Object.entries(s)) spent[k] = (spent[k] || 0) + v;
      Object.assign(visits[visits.length - 1], { goldAfter: m.gold, gemsAfter: m.gems });
    },
  });
  // 100층 뒤: 마지막 세 도전의 평균 수입으로 100번 더 정비(전투 없이) — 끝없는 소비처가 수입을 계속 받아 주나
  const last = rows.slice(-3), inG = last.reduce((a, r) => a + r.gold, 0) / last.length, inM = last.reduce((a, r) => a + r.gems, 0) / last.length;
  const post = [], rng = mulberry32(seed + 7), postSpent = {};
  for (let i = 0; i < 100 && shop; i++) {
    meta.gold += Math.round(inG); meta.gems += Math.round(inM);
    post.push(visit(meta));
    spendAll(meta, rng, postSpent);
    takePrep(meta); // 다음 도전이 출정 준비를 쓴다
    post[post.length - 1].goldAfter = meta.gold; post[post.length - 1].gemsAfter = meta.gems;
  }
  parentPort.postMessage({ rows: rows.map(r => ({ run: r.run, reached: r.reached, gold: r.gold, gems: r.gems, time: r.time, total: r.total, fusions: r.fusions })),
    visits, spent, post, postSpent, inG, inM, trainBreak: meta.trainBreak, gemBreak: meta.gemBreak, relics: (meta.relicUnlocked || []).length });
  process.exit?.(0);
} else {
  const args = process.argv.slice(2), shop = !args.includes('--off');
  const seeds = args.filter(a => /^\d+$/.test(a)).map(Number);
  if (!seeds.length) seeds.push(1, 2, 3);
  const res = await Promise.all(seeds.map(seed => new Promise((ok, bad) => {
    const w = new Worker(new URL(import.meta.url), { workerData: { seed, shop } });
    w.once('message', ok); w.once('error', bad);
  })));
  const pct = (a, f) => `${Math.round(100 * a.filter(f).length / Math.max(1, a.length))}%`;
  const share = sp => { const t = Object.values(sp).reduce((a, b) => a + b, 0) || 1; return Object.entries(sp).filter(([, v]) => v > 0).map(([k, v]) => `${k} ${Math.round(100 * v / t)}%`).join(' · '); };
  const G = ['train', 'trainBreak', 'prep', 'boxGold'], M = ['meta', 'gemBreak', 'relic', 'boxGems'];
  const pick = (sp, ks) => Object.fromEntries(ks.map(k => [k, sp[k] || 0]));
  res.forEach((r, i) => {
    const runs = r.rows.length, last = r.rows[runs - 1];
    console.log(`\n── 시드 ${seeds[i]} (상점 ${shop ? '씀' : '안 씀'}) — ${runs}회 · 도전당 +${(last.reached / runs).toFixed(2)}층 · ${(last.total / 3600).toFixed(1)}시간 · 3회차부터 합체 ${(r.rows.slice(2).reduce((a, x) => a + x.fusions, 0) / Math.max(1, runs - 2)).toFixed(2)}/도전`);
    console.log('회차 최고  골드(방문→소비 뒤)       보석(방문→소비 뒤)  살것(골드/보석, 상자 제외)');
    for (const v of r.visits) if (v.run <= 3 || v.run % 5 === 0 || v.run === runs)
      console.log(`${String(v.run).padStart(3)} ${String(v.best).padStart(4)}  ${fmt(v.gold).padStart(7)} → ${fmt(v.goldAfter).padStart(7)}   ${fmt(v.gems).padStart(6)} → ${fmt(v.gemsAfter).padStart(6)}   ${v.goldAny ? 'O' : 'X'}${v.goldReal ? '' : '(상자만)'} / ${v.gemsAny ? 'O' : 'X'}${v.gemsReal ? '' : '(상자만)'}`);
    console.log(`살 게 없는 방문: 골드 ${pct(r.visits, v => !v.goldAny)} · 보석 ${pct(r.visits, v => !v.gemsAny)} · 둘 다 ${pct(r.visits, v => !v.goldAny && !v.gemsAny)} (상자 빼면 골드 ${pct(r.visits, v => !v.goldReal)} · 보석 ${pct(r.visits, v => !v.gemsReal)})`);
    console.log(`소비 분포(캠페인) 골드: ${share(pick(r.spent, G))} | 보석: ${share(pick(r.spent, M))} · 유물 해금 ${r.relics}종`);
    if (r.post.length) {
      const p = r.post;
      console.log(`100층 뒤 100회(도전당 +${fmt(r.inG)}골드 · +${Math.round(r.inM)}보석): 살 게 없는 방문 골드 ${pct(p, v => !v.goldAny)} · 보석 ${pct(p, v => !v.gemsAny)} · 100회 뒤 잔고 ${fmt(p[99].goldAfter)}골드 · ${fmt(p[99].gemsAfter)}보석`);
      console.log(`  소비 분포 골드: ${share(pick(r.postSpent, G))} | 보석: ${share(pick(r.postSpent, M))}`);
      console.log(`  돌파: 수련 ${JSON.stringify(r.trainBreak)} · 보석 ${JSON.stringify(r.gemBreak)}`);
    }
  });
}

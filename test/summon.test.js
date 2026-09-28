// v0.1.2 외형 소환 코어 셀프 체크: node test/summon.test.js
// 10만 회 시뮬레이션이 확률표와 맞고 천장 초과 0 · 10연차 보장 · 픽업 확정 · 별조각 · 소환권 멱등 · 이전 · 백업 왕복
import assert from 'node:assert/strict';
import {
  COSMETICS, COS_KEYS, COS_BY_KEY, COS_RARITY, PITY, PULL_GEMS, SHARD_DUP, SHARD_PRICE, HIST_MAX, WELCOME_TICKETS,
  oddsTable, effLegendRate, pickupBanner, banners, pull, pullPrice, exchange, equipCos, unequipCos, loadoutOf, collection,
  normSummon, grantRunTickets, history, giftPending, markGiftSeen, dayKey, sourceText,
} from '../public/js/summon.js';
import { defaults, normalize, exportSave, importSave } from '../public/js/save.js';
import { newRun, endRun, campAct } from '../public/js/run.js';
import { HERO_CLASS_KEYS } from '../public/js/hero.js';
import { CODEX_SYN } from '../public/js/config.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };
const T = new Date(2026, 8, 29, 12).getTime(); // 2026-09-29(화) 현지 정오
const RK = COS_RARITY.map(r => r.key), RATE = Object.fromEntries(COS_RARITY.map(r => [r.key, r.rate]));
const rich = (seed = 1) => { const m = defaults(); m.gems = 1e9; m.summon.rng = seed; return m; };
// 표준편차 k배 안인가
const near = (got, want, sd, k = 5, msg = '') => assert.ok(Math.abs(got - want) <= k * sd, `${msg} ${got.toFixed(5)} vs ${want.toFixed(5)} (±${(k * sd).toFixed(5)})`);

console.log('카탈로그 · 확률표');
ok('36종 = 코스튬 20(클래스마다 4등급) + 로브 8 + 스킨 8, 등급마다 9 · 키 접두 = 그림 id', () => {
  assert.equal(COSMETICS.length, 36);
  assert.equal(new Set(COS_KEYS).size, 36);
  assert.equal(new Set(COSMETICS.map(c => c.name)).size, 36, '이름 중복 없음');
  for (const r of RK) assert.equal(COSMETICS.filter(c => c.rarity === r).length, 9, r);
  for (const cls of HERO_CLASS_KEYS) assert.deepEqual(COSMETICS.filter(c => c.cls === cls).map(c => c.rarity), RK, cls);
  const pre = { knight: 'kn_', ranger: 'rg_', sorcerer: 'so_', cleric: 'cl_', assassin: 'as_' };
  for (const c of COSMETICS) {
    assert.ok(c.key.startsWith(c.slot === 'costume' ? pre[c.cls] : c.slot === 'robe' ? 'rb_' : 'sk_'), c.key);
    assert.ok(c.desc && c.name, c.key);
  }
  assert.ok(sourceText('kn_solar').includes('1,500'));
});
ok('확률표: 두 배너 합 1 · 등급 합 = 기본 확률 · 픽업 전설 1%/영웅 각 2.5% · 규칙 문구', () => {
  for (const b of ['standard', 'pickup']) {
    const t = oddsTable(b, T);
    near(t.items.reduce((a, x) => a + x.rate, 0), 1, 1e-12, 1, b);
    for (const r of RK) near(t.items.filter(x => x.rarity === r).reduce((a, x) => a + x.rate, 0), RATE[r], 1e-12, 1, b + r);
    assert.equal(t.pity, PITY);
    assert.ok(t.rules.length >= 5);
  }
  const t = oddsTable('pickup', T), pb = pickupBanner(T);
  assert.equal(t.items.find(x => x.key === pb.legend).rate, 0.01);
  for (const e of pb.epics) near(t.items.find(x => x.key === e).rate, 0.025, 1e-12, 1);
  assert.equal(oddsTable('nope'), null);
  near(effLegendRate(), 0.02496, 0.00001, 1, '천장 포함');
});
ok('픽업 순환: 월요일 0시(현지)마다 · 전설 9종이 한 번씩 · 2026-09-28 주 = 태양왕', () => {
  const b = pickupBanner(T);
  assert.equal(b.legend, 'kn_solar');
  assert.equal(b.start, '2026-09-28'); assert.equal(b.end, '2026-10-05'); assert.equal(b.daysLeft, 6);
  assert.equal(pickupBanner(new Date(2026, 9, 4, 23, 59).getTime()).legend, 'kn_solar', '일요일 밤까지 같은 픽업');
  assert.notEqual(pickupBanner(new Date(2026, 9, 5, 0, 1).getTime()).legend, 'kn_solar', '월요일 0시에 바뀜');
  const seen = new Set();
  for (let w = 0; w < 9; w++) { const x = pickupBanner(T + w * 7 * 864e5); seen.add(x.legend); assert.ok(x.epics.every(e => COS_BY_KEY[e].rarity === 'epic')); }
  assert.equal(seen.size, 9);
  assert.equal(banners(T)[0].key, 'standard');
});

console.log('10만 회 시뮬레이션');
ok('상시 1회 × 10만: 등급 확률표와 일치 · 전설 = 천장 포함 확률 · 등급 안 균등 · 천장 초과 0', () => {
  const m = rich(7), N = 100_000, S = m.summon, cnt = {}, base = Object.fromEntries(RK.map(r => [r, 0])), item = {};
  let since = 0, maxGap = 0, legends = 0, free = 0, forced = 0;
  for (let i = 0; i < N; i++) {
    const r = pull(m, 'standard', 1, { pay: 'gems', now: T }).results[0];
    since++;
    item[r.key] = (item[r.key] || 0) + 1;
    cnt[r.rarity] = (cnt[r.rarity] || 0) + 1;
    if (r.pity) forced++; else { base[r.rarity]++; free++; }
    if (r.rarity === 'legend') { legends++; maxGap = Math.max(maxGap, since); since = 0; }
    assert.ok(S.pity.standard <= PITY - 1);
  }
  assert.ok(maxGap <= PITY, `전설 간격 최대 ${maxGap}`);
  for (const r of RK) near(base[r] / free, RATE[r], Math.sqrt(RATE[r] * (1 - RATE[r]) / free), 5, `기본 ${r}`);
  near(legends / N, effLegendRate(), Math.sqrt(0.025 / N), 5, '전설(천장 포함)');
  assert.ok(forced > 0, '천장 발동');
  for (const k of COS_KEYS) { const want = cnt[COS_BY_KEY[k].rarity] / 9; near(item[k], want, Math.sqrt(want), 5, k); }
  console.log(`    전설 ${(legends / N * 100).toFixed(3)}%(표 ${(effLegendRate() * 100).toFixed(3)}%) · 천장 발동 ${forced}회 · 최대 간격 ${maxGap}`);
});
ok('픽업 10연 × 1만(10만 장): 10연마다 희귀 이상 · 천장 초과 0 · 비픽업 전설 다음 전설은 픽업 확정 · 픽업 비율 ≈ 2/3', () => {
  const m = rich(11), S = m.summon;
  const pb = pickupBanner(T);
  let since = 0, maxGap = 0, lost = false, legends = 0, pickups = 0, guars = 0, epicPu = 0, epics = 0, rescued = 0;
  for (let i = 0; i < 10_000; i++) {
    const res = pull(m, 'pickup', 10, { pay: 'gems', now: T });
    assert.ok(res.results.some(r => r.rarity !== 'common'), '10연 희귀 이상');
    if (res.results.slice(0, 9).every(r => r.rarity === 'common')) rescued++;
    for (const r of res.results) {
      since++;
      if (r.rarity === 'epic') { epics++; if (pb.epics.includes(r.key)) epicPu++; }
      if (r.rarity !== 'legend') continue;
      legends++; maxGap = Math.max(maxGap, since); since = 0;
      if (lost) { assert.equal(r.key, pb.legend, '확정 규칙'); assert.ok(r.guar); guars++; }
      if (r.key === pb.legend) pickups++;
      lost = r.key !== pb.legend;
    }
    assert.equal(S.guar, lost, '확정 상태 저장');
    assert.ok(S.pity.pickup <= PITY - 1);
  }
  assert.ok(maxGap <= PITY, `전설 간격 최대 ${maxGap}`);
  near(pickups / legends, 2 / 3, Math.sqrt(0.25 / legends), 5, '픽업 비율');
  near(epicPu / epics, 0.5, Math.sqrt(0.25 / epics), 5, '픽업 영웅 비율');
  assert.ok(rescued > 20, `보장 발동 ${rescued}`);
  assert.equal(S.pity.standard, 0, '픽업은 상시 천장을 건드리지 않는다');
  console.log(`    전설 ${legends}개(픽업 ${pickups} · 확정 ${guars}) · 10연 보장 발동 ${rescued}회 · 최대 간격 ${maxGap}`);
});
ok('천장: 79회 뒤 80번째는 전설 확정(pity) · 픽업 배너 확정 상태면 그 전설은 픽업', () => {
  const m = rich(3);
  m.summon.pity.standard = PITY - 1;
  const r = pull(m, 'standard', 1, { pay: 'gems', now: T }).results[0];
  assert.equal(r.rarity, 'legend'); assert.ok(r.pity); assert.equal(m.summon.pity.standard, 0);
  m.summon.pity.pickup = PITY - 1; m.summon.guar = true;
  const p = pull(m, 'pickup', 1, { pay: 'gems', now: T }).results[0];
  assert.equal(p.key, pickupBanner(T).legend); assert.ok(p.guar && p.pity && p.pickup); assert.equal(m.summon.guar, false);
});
ok('소환 RNG는 저장된 소환 시드만 쓴다(Math.random 안 씀) · 같은 시드 = 같은 결과', () => {
  const a = rich(99), b = rich(99), mr = Math.random;
  Math.random = () => { throw new Error('Math.random'); };
  try {
    const x = pull(a, 'pickup', 10, { pay: 'gems', now: T }), y = pull(b, 'pickup', 10, { pay: 'gems', now: T });
    assert.deepEqual(x.results, y.results);
    assert.equal(a.summon.rng, b.summon.rng);
  } finally { Math.random = mr; }
});

console.log('가격 · 별조각 · 장착');
ok('가격: 소환권 먼저(n장 이상일 때) · 아니면 보석 · 10연 할인 · 부족하면 아무것도 안 바뀜', () => {
  assert.ok(PULL_GEMS[10] < PULL_GEMS[1] * 10);
  const m = defaults(); // 환영 선물 10장
  assert.equal(m.summon.tickets, WELCOME_TICKETS);
  m.gems = PULL_GEMS[1];
  assert.deepEqual(pullPrice(m, 10), { cur: 'tickets', cost: 10, ok: true });
  assert.deepEqual(pullPrice(m, 10, 'gems'), { cur: 'gems', cost: PULL_GEMS[10], ok: false });
  const r = pull(m, 'standard', 10, { now: T });
  assert.ok(r.ok); assert.equal(r.cur, 'tickets'); assert.equal(m.summon.tickets, 0); assert.equal(m.gems, PULL_GEMS[1]);
  assert.equal(r.results.length, 10); assert.equal(m.summon.pulls, 10);
  assert.deepEqual(pullPrice(m, 1), { cur: 'gems', cost: PULL_GEMS[1], ok: true });
  const before = JSON.stringify(m);
  const f = pull(m, 'standard', 10, { now: T });
  assert.equal(f.ok, false); assert.equal(f.error, '보석이 부족해요');
  assert.equal(JSON.stringify(m), before, '실패는 저장을 안 바꾼다');
  assert.equal(pull(m, 'standard', 1, { pay: 'tickets', now: T }).error, '소환권이 부족해요');
  assert.equal(pull(m, 'nope', 1).ok, false); assert.equal(pull(m, 'standard', 5).ok, false);
  assert.ok(pull(m, 'standard', 1, { now: T }).ok); assert.equal(m.gems, 0);
  assert.equal(campAct(m, { type: 'summon', banner: 'standard', n: 1 }), false, 'campAct 실패 = false');
});
ok('중복 → 별조각(등급별) · 교환소: 미보유만 · 가격 차감 · 모자라면 실패', () => {
  const m = rich(5);
  let shards = 0;
  for (let i = 0; i < 30; i++) {
    const r = pull(m, 'standard', 10, { pay: 'gems', now: T });
    assert.equal(r.shards, r.results.reduce((a, x) => a + (x.isNew ? 0 : SHARD_DUP[x.rarity]), 0));
    shards += r.shards;
  }
  assert.equal(m.summon.shards, shards);
  assert.equal(new Set(m.summon.owned).size, m.summon.owned.length);
  const miss = COS_KEYS.find(k => !m.summon.owned.includes(k));
  const have = m.summon.owned[0];
  assert.equal(exchange(m, have), false, '보유품은 교환 안 됨');
  m.summon.shards = SHARD_PRICE[COS_BY_KEY[miss].rarity] - 1;
  assert.equal(exchange(m, miss), false);
  m.summon.shards += 1;
  assert.equal(campAct(m, { type: 'cosExchange', key: miss }), true);
  assert.equal(m.summon.shards, 0); assert.ok(m.summon.owned.includes(miss));
  assert.equal(exchange(m, 'nope'), false);
});
ok('장착: 보유한 것만 · 자기 칸/클래스 · 해제 · loadoutOf 모양 · 수집률', () => {
  const m = defaults();
  assert.equal(equipCos(m, 'kn_solar'), false);
  m.summon.owned.push('kn_solar', 'rb_void', 'sk_star', 'as_fox');
  assert.equal(campAct(m, { type: 'cosEquip', key: 'kn_solar' }), true);
  equipCos(m, 'rb_void'); equipCos(m, 'sk_star'); equipCos(m, 'as_fox');
  assert.deepEqual(loadoutOf(m), { costume: { knight: 'kn_solar', assassin: 'as_fox' }, robe: 'rb_void', skin: 'sk_star' });
  assert.equal(unequipCos(m, 'costume', 'assassin'), true);
  assert.equal(unequipCos(m, 'costume', 'assassin'), false);
  assert.equal(campAct(m, { type: 'cosUnequip', slot: 'skin' }), true);
  assert.deepEqual(loadoutOf(m), { costume: { knight: 'kn_solar' }, robe: 'rb_void', skin: null });
  const c = collection(m);
  assert.equal(c.n, 4); assert.equal(c.total, 36); assert.deepEqual(c.rarity.legend, [2, 9]); assert.deepEqual(c.slot.costume, [2, 20]);
  // 저장이 깨져 미보유·다른 칸 외형이 장착돼 있으면 버린다
  const s = normSummon({ ...m.summon, owned: ['kn_solar'], equip: { costume: { knight: 'kn_solar', ranger: 'kn_solar', cleric: 'x' }, robe: 'sk_star', skin: 'rb_void' } });
  assert.deepEqual(s.equip, { costume: { knight: 'kn_solar' }, robe: null, skin: null });
});
ok(`내역: 최근 ${HIST_MAX}회만 · 최근 것부터 · 중복 표시`, () => {
  const m = rich(8);
  for (let i = 0; i < 12; i++) pull(m, 'pickup', 10, { pay: 'gems', now: T + i });
  assert.equal(m.summon.hist.length, HIST_MAX);
  const h = history(m);
  assert.equal(h[0].t, T + 11); assert.equal(h[h.length - 1].t, T + 2);
  assert.ok(h.some(x => x.dup) && h.every(x => x.banner === 'pickup' && x.rarity));
});

console.log('소환권 · 이전 · 백업');
ok('보상: 보스 첫 처치·10층 구간(50·100층 3장)·오늘 첫 도전·도감 단계 — 두 번 불러도 한 번만', () => {
  const m = defaults(); m.summon.tickets = 0;
  m.best = 23;
  let g = grantRunTickets(m, { cleared: 23, now: T });
  assert.deepEqual(g.map(x => x.src).sort(), ['boss', 'boss', 'daily', 'floor', 'floor']);
  assert.ok(g[0].label.includes('킹 슬라임'));
  assert.equal(m.summon.tickets, 5);
  assert.deepEqual(grantRunTickets(m, { cleared: 23, now: T }), [], '같은 날·같은 기록 = 없음');
  assert.deepEqual(grantRunTickets(m, { cleared: 0, now: T + 864e5 }), [], '다음 날이라도 0층 돌파(즉시 포기)는 없음');
  assert.deepEqual(grantRunTickets(m, { cleared: 3, now: T + 864e5 }).map(x => x.src), ['daily']);
  m.best = 50;
  g = grantRunTickets(m, { cleared: 50, now: T + 864e5 });
  assert.equal(g.filter(x => x.src === 'boss').length, 3);
  assert.deepEqual(g.filter(x => x.src === 'floor').map(x => x.n), [1, 1, 3]);
  m.discovered = CODEX_SYN.slice(0, 12).map(s => s.key);
  assert.deepEqual(grantRunTickets(m, { cleared: 1, now: T + 864e5 }).map(x => x.n), [1, 1]);
  m.discovered = CODEX_SYN.map(s => s.key);
  assert.deepEqual(grantRunTickets(m, { cleared: 1, now: T + 864e5 }).map(x => x.n), [2, 2, 2, 3, 5]);
  assert.deepEqual(grantRunTickets(m, { cleared: 1, now: T + 864e5 }), []);
  assert.equal(dayKey(T), '2026-09-29');
});
ok('endRun이 소환권을 준다(sum.tickets) · 0층 포기는 오늘 첫 도전이 아님', () => {
  const m = defaults(); m.hero.cls = 'knight';
  const t0 = m.summon.tickets;
  let g = newRun(m, { cls: 'knight' }, 1);
  let sum = endRun(g, m, { now: T });
  assert.deepEqual(sum.tickets, []);
  g = newRun(m, { cls: 'knight' }, 2);
  g.run.floors = 12; // 12층까지 돌파한 셈
  sum = endRun(g, m, { now: T });
  assert.deepEqual(sum.tickets.map(x => x.src).sort(), ['boss', 'daily', 'floor']);
  assert.equal(m.summon.tickets, t0 + 3);
  assert.equal(endRun(g, m, { now: T }), null, '두 번 정산 없음');
});
ok('이전: summon 없던 저장 → 지금까지 단계는 받은 것으로(소급 없음) + 환영 선물 10장 한 번 · 다시 불러도 그대로', () => {
  const old = normalize({ v: 3, best: 57, gems: 30, discovered: CODEX_SYN.slice(0, 12).map(s => s.key) });
  assert.equal(old.summon.tickets, WELCOME_TICKETS);
  assert.deepEqual([old.summon.mBoss, old.summon.mFloor, old.summon.mCodex], [50, 50, 2]);
  assert.ok(giftPending(old));
  assert.equal(campAct(old, { type: 'giftSeen' }), true);
  assert.equal(markGiftSeen(old), false);
  const again = normalize(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(again.summon, old.summon, '다시 정규화해도 선물·시드 그대로');
  old.best = 60;
  assert.deepEqual(grantRunTickets(old, { cleared: 60, now: T }).map(x => x.src).sort(), ['boss', 'daily', 'floor']);
  // 새 저장도 선물(단계 0부터)
  const fresh = defaults();
  assert.equal(fresh.summon.tickets, WELCOME_TICKETS); assert.equal(fresh.summon.mFloor, 0); assert.ok(giftPending(fresh));
  // 깨진 값
  const bad = normSummon({ owned: ['kn_solar', 'x', 'kn_solar', 7], shards: -5, tickets: 'lots', pity: { standard: 999, pickup: -1 }, guar: 1, gift: true, rng: -3, daily: '<b>', hist: [{ b: 'x', k: 'kn_solar' }, { b: 'standard', k: 'kn_solar', t: 5, d: 1 }] });
  assert.deepEqual(bad.owned, ['kn_solar']);
  assert.deepEqual([bad.shards, bad.tickets, bad.pity.standard, bad.pity.pickup, bad.guar, bad.daily], [0, 0, PITY - 1, 0, false, '']);
  assert.ok(Number.isInteger(bad.rng) && bad.rng >= 0);
  assert.deepEqual(bad.hist, [{ t: 5, b: 'standard', k: 'kn_solar', d: 1 }]);
});
ok('백업 코드: 보유·장착·별조각·소환권·천장·확정·단계·시드는 담고 내역은 뺀다 · 옛 코드(summon 없음)도 복원', () => {
  const m = rich(21);
  for (let i = 0; i < 9; i++) pull(m, 'pickup', 10, { pay: 'gems', now: T });
  equipCos(m, m.summon.owned[0]);
  m.summon.daily = '2026-09-29'; m.summon.guar = true;
  const code = exportSave(m);
  assert.ok(!code.includes('"hist"'));
  const r = importSave(code, m);
  assert.ok(r.ok);
  const { hist, ...want } = normalize(JSON.parse(JSON.stringify(m))).summon;
  assert.deepEqual(r.data.summon, { ...want, hist: [] });
  assert.ok(hist.length > 0);
  const len = code.length;
  // 옛 코드(v0.1.1 — summon 필드 없음)
  const o = normalize({ v: 3, best: 31 }); delete o.summon;
  const body = Buffer.from(JSON.stringify(o)).toString('base64url');
  let h = 0x811c9dc5; for (let i = 0; i < body.length; i++) h = Math.imul(h ^ body.charCodeAt(i), 0x01000193);
  const oldCode = `WD3-${body}-${(h >>> 0).toString(16).padStart(8, '0')}`;
  const r2 = importSave(oldCode, m);
  assert.ok(r2.ok);
  assert.equal(r2.data.summon.tickets, WELCOME_TICKETS); assert.equal(r2.data.summon.mFloor, 30); assert.deepEqual(r2.data.summon.owned, []);
  console.log(`    백업 코드 길이 ${len}자(보유 ${m.summon.owned.length}종 · 내역 제외)`);
});

console.log('FIX 패스 회귀');
ok('매일 첫 도전: 시계를 되돌려도 다시 안 준다(날짜는 앞으로만)', () => {
  const m = defaults(); m.summon.tickets = 0; m.best = 0;
  let got = 0;
  for (let i = 0; i < 10; i++) got += grantRunTickets(m, { cleared: 1, now: T + (i % 2 ? -864e5 : 0) }).length;
  assert.equal(got, 1, '같은 날 ↔ 어제 번갈아 = 1장');
  assert.equal(grantRunTickets(m, { cleared: 1, now: T + 864e5 }).length, 1, '진짜 다음 날은 준다');
  assert.equal(m.summon.daily, dayKey(T + 864e5));
});
ok("n = '10'(문자열)도 10연 보장 · 가격이 같다 · 1/10 말고는 거절", () => {
  const m = rich(5);
  for (let i = 0; i < 3000; i++) assert.ok(pull(m, 'standard', '10', { pay: 'gems', now: T }).results.some(r => r.rarity !== 'common'));
  assert.deepEqual(pullPrice(m, '10', 'gems'), pullPrice(m, 10, 'gems'));
  assert.equal(pull(m, 'standard', 3, { pay: 'gems', now: T }).ok, false);
});
ok('픽업이 바뀐 뒤(보인 week ≠ 지금 week) 소환은 거절 · 아무것도 안 바뀜 · 맞으면 소환', () => {
  const m = rich(7), pb = pickupBanner(T), gems = m.gems;
  const r = pull(m, 'pickup', 10, { pay: 'gems', now: T + 7 * 864e5, week: pb.week });
  assert.equal(r.ok, false); assert.ok(r.stale); assert.equal(m.gems, gems); assert.equal(m.summon.hist.length, 0);
  assert.ok(pull(m, 'pickup', 1, { pay: 'gems', now: T, week: pb.week }).ok);
  assert.ok(pull(m, 'standard', 1, { pay: 'gems', now: T + 7 * 864e5, week: pb.week }).ok, '상시는 week와 무관');
  assert.equal(campAct(m, { type: 'summon', banner: 'pickup', n: 1, pay: 'gems', week: pb.week - 1 }), false);
});
ok('내역: 천장(p)·픽업 확정(g) 표시가 남고 저장 왕복된다', () => {
  const m = rich(3);
  m.summon.pity.pickup = PITY - 1; m.summon.guar = true;
  pull(m, 'pickup', 1, { pay: 'gems', now: T });
  m.summon.pity.standard = PITY - 1;
  pull(m, 'standard', 1, { pay: 'gems', now: T });
  const h = history(normalize(JSON.parse(JSON.stringify(m))));
  assert.deepEqual([h[0].pity, h[0].guar, h[1].guar], [true, false, true]);
  assert.ok(oddsTable('pickup', T).rules.some(x => x.includes('1.66%')));
});

console.log(`summon.test: ${n}개 통과`);

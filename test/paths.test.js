// v0.1.6 갈림길 단위 테스트: node test/paths.test.js
// 표 · 언제 뜨나 · 고르기(상인·제단·정예·샘) · 대기 카드 · 적 체력 배율 · 체크포인트/이어하기 · 자동 선택 · 봇 정책 · 저장 검증
import assert from 'node:assert/strict';
import { DT } from '../public/js/config.js';
import { createGame, step, act, drainEvents, startStage, serializeRun, normalizeRun } from '../public/js/sim.js';
import { newRun, restoreRun } from '../public/js/run.js';
import { defaults, normalize } from '../public/js/save.js';
import { PATHS, PATH_KEYS, FORK_N, PATH_AUTO_T, CURSE_HP, ELITE_HP, CURSE_FLOORS, forkAt, pickPath, tickPath, pathHpMul, normPath, merchantCost, nextForkAt } from '../public/js/paths.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };
const game = (o = {}) => createGame({ stage: o.stage ?? 3, seed: o.seed ?? 7, players: [{ kind: 'human', gold: o.gold ?? 1000, ...(o.p0 || {}) }, {}], run: o.run });
const clearNow = g => { g.pick = null; g.spawnIdx = g.spawns.length; g.enemies.length = 0; step(g, DT); };
const forkWith = (g, key) => { g.path.fork = { opts: [key], autoLeft: null }; return act(g, 0, { type: 'path', index: 0 }); };

console.log('갈림길 표 · 시점');
ok('4갈래 · 문구 · 끝자리 3·7만(보스·지역 첫 층·100층 없음)', () => {
  assert.equal(PATHS.length, 4);
  for (const p of PATHS) assert.ok(p.name && p.up && p.down && p.icon && p.tone, p.key);
  const at = []; for (let s = 1; s <= 100; s++) if (forkAt(s)) at.push(s);
  assert.equal(at.length, 20);
  assert.ok(at.every(s => s % 10 === 3 || s % 10 === 7));
});
ok('끝자리 3층 클리어 → 3갈래 · pathOffer · 다음 층 체크포인트에 갈래 · startStage가 지우지 않음', () => {
  const g = game({ stage: 3 });
  drainEvents(g);
  clearNow(g);
  assert.equal(g.phase, 'clear');
  assert.equal(g.path.fork.opts.length, FORK_N);
  assert.ok(g.path.fork.opts.every(k => PATH_KEYS.includes(k)));
  assert.ok(drainEvents(g).some(e => e.type === 'pathOffer'));
  assert.equal(g.run.checkpoint.stage, 4);
  assert.deepEqual(g.run.checkpoint.path.fork, g.path.fork.opts);
  const h = game({ stage: 4 }); clearNow(h); assert.equal(h.path.fork, null, '4층은 없음');
});
ok('골드가 없으면 상인은 안 나온다', () => {
  for (let s = 1; s < 8; s++) {
    const g = game({ stage: 3, gold: 0, seed: s }); clearNow(g);
    assert.deepEqual(g.path.fork.opts, ['altar', 'elite', 'spring']);
  }
});

console.log('고르기');
ok('상인: 골드 30% → 다음 층 시작에 카드 1장 · 체크포인트는 골드 뺀 값 + 대기 카드', () => {
  const g = game({ stage: 3, gold: 1000 }); clearNow(g);
  const gold = g.players[0].gold, c = merchantCost(g);
  assert.ok(forkWith(g, 'merchant'));
  assert.equal(g.players[0].gold, gold - c);
  assert.equal(g.path.fork, null);
  assert.equal(g.pick, null, '클리어 중엔 카드 없음(다음 층 시작에)');
  assert.equal(g.run.checkpoint.stage, 4);
  assert.equal(g.run.checkpoint.path.cards, 1);
  assert.equal(g.run.checkpoint.players[0].gold, gold - c);
  startStage(g, 4);
  assert.ok(g.pick, '층 시작에 카드');
  assert.equal(g.path.cards, 0);
  assert.equal(g.run.checkpoint.path.cards, 1, '층 도중에 끄면 이어하기가 다시 준다');
  assert.equal(act(g, 0, { type: 'path', index: 0 }), false, '갈래 없으면 거부');
});
ok('제단: 카드 2장 · 저주 3층(적 체력 ×1.3) 뒤 풀림', () => {
  const g = game({ stage: 3 }); clearNow(g);
  forkWith(g, 'altar');
  startStage(g, 4);
  assert.ok(g.pick);
  assert.equal(g.pickQ, 1, '두 번째 카드 대기');
  for (let s = 4; s < 4 + CURSE_FLOORS; s++) {
    assert.equal(pathHpMul(g), CURSE_HP, s + '층 저주');
    clearNow(g); startStage(g, s + 1);
  }
  assert.equal(pathHpMul(g), 1, '저주 끝');
});
ok('정예: 다음 층 체력 ×1.5 → 깨면 카드 2장(그다음 층 시작)', () => {
  const g = game({ stage: 3 }); clearNow(g);
  forkWith(g, 'elite');
  startStage(g, 4);
  assert.equal(g.pick, null);
  assert.equal(pathHpMul(g), ELITE_HP);
  let hp0 = null;
  for (let t = 0; t < 20 && !g.enemies.length; t += DT) step(g, DT);
  hp0 = g.enemies[0].maxHp;
  const plain = game({ stage: 4, seed: 7 });
  for (let t = 0; t < 20 && !plain.enemies.length; t += DT) step(plain, DT);
  assert.ok(Math.abs(hp0 / plain.enemies.find(e => e.type === g.enemies[0].type).maxHp - ELITE_HP) < 1e-9, '적 체력 배율');
  clearNow(g);
  assert.equal(g.path.elite, false);
  assert.equal(g.run.checkpoint.path.cards, 2);
  startStage(g, 5);
  assert.ok(g.pick && g.pickQ === 1);
});
ok('샘: 새로고침 +2 · 망각 +1', () => {
  const g = game({ stage: 3 }); clearNow(g);
  const r = g.rerollLeft, f = g.forgetLeft;
  forkWith(g, 'spring');
  assert.equal(g.rerollLeft, r + 2);
  assert.equal(g.forgetLeft, f + 1);
});
ok('잘못된 입력 거부(인덱스 · 협동 자리)', () => {
  const g = game({ stage: 3 }); clearNow(g);
  for (const i of [-1, 3, 1.5, '0', null]) assert.equal(act(g, 0, { type: 'path', index: i }), false);
  assert.equal(act(g, 1, { type: 'path', index: 0 }), false);
  assert.ok(g.path.fork);
});

console.log('저장 · 이어하기');
ok('클리어 화면에서 끄면 이어하기(다음 층 시작)에 갈래가 다시 → 고르면 효과는 그 층', () => {
  const meta = defaults();
  const g = newRun(meta, { cls: 'knight' }, 5);
  g.pick = null; g.pickQ = 0;
  startStage(g, 3); g.players[0].gold = 500;
  clearNow(g);
  const opts = [...g.path.fork.opts];
  meta.run = JSON.parse(JSON.stringify(g.run.checkpoint));
  const back = normalize(JSON.parse(JSON.stringify(meta)));
  const r = restoreRun(back, back.run, 9);
  assert.equal(r.stage, 4);
  assert.deepEqual(r.path.fork.opts, opts);
  const altar = opts.includes('altar'), i = opts.indexOf(altar ? 'altar' : 'elite'); // 3/4라 둘 중 하나는 늘 있다
  assert.ok(act(r, 0, { type: 'path', index: i }));
  assert.equal(r.run.checkpoint.stage, 4);
  assert.equal(r.run.checkpoint.path.fork, null);
  if (altar) {
    assert.ok(r.pick, '층 시작에서 고르면 카드 바로');
    assert.equal(r.run.checkpoint.path.cards, 2);
    assert.equal(pathHpMul(r), CURSE_HP);
  } else assert.equal(pathHpMul(r), ELITE_HP, '정예는 이 층');
});
ok('normPath 멱등 · 쓰레기 입력 · 옛 저장', () => {
  const a = normPath({ fork: ['altar', 'nope', 'altar', 'spring'], cards: 99, curse: -3, elite: 1, taken: ['x', 'elite'] });
  assert.deepEqual(a, { fork: ['altar', 'spring'], cards: 9, curse: 0, elite: true, taken: ['elite'] });
  assert.deepEqual(normPath(a), a);
  for (const x of [null, 5, 'x', [], { fork: 'altar' }]) assert.doesNotThrow(() => normPath(x));
  assert.deepEqual(normalizeRun({}).path, { fork: null, cards: 0, curse: 0, elite: false, taken: [] });
  const g = game({ stage: 3 }); clearNow(g);
  const s = serializeRun(g);
  assert.deepEqual(normalizeRun(normalizeRun(s)).path, normalizeRun(s).path);
});

console.log('자동 선택 · 봇');
ok('자동 선택 OFF면 기다림 · ON이면 PATH_AUTO_T 뒤 추천', () => {
  const g = game({ stage: 3 }); clearNow(g);
  tickPath(g, 5);
  assert.ok(g.path.fork, 'OFF');
  g.players[0].autoPick = true;
  tickPath(g, PATH_AUTO_T * 0.5);
  assert.ok(g.path.fork);
  const rec = g.path.fork.opts[pickPath(g)];
  tickPath(g, PATH_AUTO_T);
  assert.equal(g.path.fork, null);
  assert.equal(g.path.taken.at(-1), rec);
});
ok('봇: 최전선 = 상인/샘, 한참 아래 = 정예/제단', () => {
  const g = game({ stage: 13 });
  g.run.startBest = 14;
  assert.equal(pickPath(g, ['altar', 'elite', 'merchant']), 2);
  assert.equal(pickPath(g, ['altar', 'elite', 'spring']), 2);
  g.run.startBest = 40;
  assert.equal(pickPath(g, ['merchant', 'spring', 'elite']), 2);
  assert.equal(pickPath(g, ['merchant', 'spring', 'altar']), 2);
});

console.log('수정 검증(fix)');
ok('정복한 층엔 갈림길 없음 · nextForkAt = 첫 갈림길 층(HUD 안내)', () => {
  const g = game({ stage: 3 }); g.run.startBest = 25; assert.equal(nextForkAt(g), 17); clearNow(g);
  assert.equal(g.path.fork, null);
  const h = game({ stage: 17 }); h.run.startBest = 25; assert.equal(nextForkAt(h), 0, '최전선이면 0');
});
ok('모래시계 봉인(noReroll)이면 샘이 안 나오고 새로고침도 거부', () => {
  const g = game({ stage: 3, run: { relics: ['hourglass'] } });
  assert.ok(g.rfx.noReroll);
  for (let s = 1; s < 6; s++) { const h = game({ stage: 3, seed: s, run: { relics: ['hourglass'] } }); clearNow(h); assert.ok(!h.path.fork.opts.includes('spring')); }
  g.rerollLeft = 2; g.pick = null; startStage(g, 4); if (!g.pick) g.pick = { cards: [], autoLeft: null };
  assert.equal(act(g, 0, { type: 'reroll' }), false);
});
ok('저주·정예 체력 배율은 보스 제외', () => {
  const g = game(); g.path.curse = 2; g.path.elite = true;
  assert.equal(pathHpMul(g, false), CURSE_HP * ELITE_HP);
  assert.equal(pathHpMul(g, true), 1);
});
ok('갈림길이 떠 있으면 전투 조작(스킬·궁극기) 거부', () => {
  const g = game({ stage: 4 }); g.pick = null; g.path.fork = { opts: ['spring'], autoLeft: null };
  assert.equal(act(g, 0, { type: 'skill', skill: 'meteor' }), false);
});

console.log(`paths: ${n}개 통과`);

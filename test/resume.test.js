// 이어하기 리필 버그 회귀: 쓰고 → 저장(main.js syncData = syncCheckpoint → JSON) → 불러오기(save normalize → restoreRun) → 쓴 게 되살아나지 않는다
// node test/resume.test.js
import assert from 'node:assert/strict';
import { DT, WALL_Y } from '../public/js/config.js';
import { act, step, drainEvents, syncCheckpoint, normalizeRun, serializeRun } from '../public/js/sim.js';
import { newRun, restoreRun } from '../public/js/run.js';
import { defaults, normalize } from '../public/js/save.js';
import { FORGET_PER_RUN, forgetRefund, normalizeRelicRun, RELIC_KEYS, RELIC_PICK_N } from '../public/js/relics.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} ≠ ${b}`);
const meta0 = (o = {}) => Object.assign(normalize({ v: 3, best: 45, seenSpells: ['fireball', 'iceLance', 'tornado'] }), o);
const start = (meta, spells = []) => { const g = newRun(meta, { cls: 'knight', startSpells: spells }, 7); g.pick = null; return g; };
// 앱을 껐다 켜기: main.js syncData → 저장소(JSON) → load normalize → 이어하기
function reload(meta, g) {
  syncCheckpoint(g);
  meta.run = g.run.checkpoint;
  const back = normalize(JSON.parse(JSON.stringify(meta)));
  const r = restoreRun(back, back.run, 9);
  r.pick = null; // 1층 체크포인트면 도전 시작 무료 카드가 다시 뜬다(전투 조작이 막히지 않게 치운다)
  return r;
}
const play = (g, secs) => { for (let t = 0; t < secs && g.phase === 'play'; t += DT) { g.pick = null; step(g, DT); } };
const wallHit = g => { g.freezeT = 0; g.eshots.push({ x: 360, y: WALL_Y + 1, vx: 0, vy: 0, kind: 'bone', dmg: g.wall.max * 5 }); step(g, DT); };

ok('운석·빙결: 쓰고 껐다 켜도 남은 쿨타임 그대로(리필 없음)', () => {
  const meta = meta0(), g = start(meta);
  play(g, 2);
  assert.ok(act(g, 0, { type: 'skill', skill: 'meteor' }) && act(g, 0, { type: 'skill', skill: 'freeze' }));
  play(g, 3);
  const { meteor, freeze } = g.players[0].cd;
  assert.ok(meteor > 0 && freeze > 0);
  const r = reload(meta, g);
  near(r.players[0].cd.meteor, meteor, '운석');
  near(r.players[0].cd.freeze, freeze, '빙결');
  assert.ok(!act(r, 0, { type: 'skill', skill: 'meteor' }), '이어하자마자 다시 쓸 수 없다');
  // 층 시작 체크포인트도 쿨타임을 품는다(앞 층에서 쓰고 다음 층 시작에 저장 → 켜기)
  const r2 = reload(meta, r);
  near(r2.players[0].cd.meteor, meteor, '두 번 왕복');
});

ok('층 사이 이월: 클리어 뒤 다음 층 체크포인트에도 운석 쿨타임', () => {
  const meta = meta0(), g = start(meta);
  play(g, 1);
  act(g, 0, { type: 'skill', skill: 'meteor' });
  g.spawnIdx = g.spawns.length; g.enemies.length = 0; step(g, DT); // 바로 클리어
  assert.equal(g.phase, 'clear');
  const cd = g.players[0].cd.meteor, r = reload(meta, g);
  assert.equal(r.stage, 2);
  near(r.players[0].cd.meteor, cd, '다음 층');
});

ok('영웅 궁극기: 층 도중에 쓴 쿨타임 유지 · 다음 층 체크포인트면 0(원래대로 새로 걸어 나옴)', () => {
  const meta = meta0(), g = start(meta);
  play(g, 1);
  assert.ok(act(g, 0, { type: 'heroUlt' }));
  play(g, 2);
  const u = g.heroUnit.ultCd;
  assert.ok(u > 0);
  const r = reload(meta, g);
  near(r.heroUnit.ultCd, u, '궁극기');
  assert.ok(!act(r, 0, { type: 'heroUlt' }));
  near(serializeRun(r).ultCd, u, '이어한 층의 체크포인트도');
  r.spawnIdx = r.spawns.length; r.enemies.length = 0; step(r, DT);
  assert.equal(r.phase, 'clear');
  assert.equal(reload(meta, r).heroUnit.ultCd, 0, '클리어 뒤 = 새 층');
});

ok('새로고침: 쓴 횟수는 돌아오지 않는다 · 도중 Lv5 +1은 남는다', () => {
  const meta = meta0(), g = newRun(meta, { cls: 'knight', startSpells: [] }, 7);
  g.rerollLeft = g.run.checkpoint.rerollLeft = 2; // 층 시작에 2회
  assert.ok(g.pick && act(g, 0, { type: 'reroll' }));
  assert.equal(reload(meta, g).rerollLeft, 1);
  g.rerollLeft += 1; // heroGainXp 'reroll1'(영웅 레벨은 되돌아가지 않으니 층을 다시 해도 다시 안 준다)
  assert.equal(reload(meta, g).rerollLeft, 2);
});

ok('망각: 횟수 차감 + 뺀 스킬·환급을 체크포인트에(되살아나지도, 망각만 날아가지도 않게)', () => {
  const meta = meta0(), g = start(meta);
  for (const [k, v] of [['fireball', 4], ['iceLance', 1], ['tornado', 1]]) g.spells[k] = g.run.checkpoint.spells[k] = v; // 층 시작에 스킬 3개
  const left = g.forgetLeft;
  assert.equal(left, FORGET_PER_RUN);
  assert.ok(act(g, 0, { type: 'forget', spell: 'fireball' }));
  const r = reload(meta, g);
  assert.equal(r.forgetLeft, left - 1);
  assert.equal(r.run.forgets, 1);
  assert.ok(!r.spells.fireball, '뺀 스킬은 돌아오지 않는다');
  assert.equal(r.forgetBonus, forgetRefund('fireball', 4), '환급은 남는다');
  // 층 도중에 배운(체크포인트에 없는) 스킬을 비우면 체크포인트 스킬·환급은 그대로 — 이어하면 그 스킬이 없으니 망각 횟수도 돌려준다
  g.spells.lightningStrike = 1;
  assert.ok(act(g, 0, { type: 'forget', spell: 'lightningStrike' }));
  assert.equal(g.forgetLeft, left - 2);
  const r2 = reload(meta, g);
  assert.equal(r2.forgetLeft, left - 1);
  assert.equal(r2.run.forgets, 1);
  assert.equal(r2.forgetBonus, forgetRefund('fireball', 4));
  assert.deepEqual(Object.keys(r2.spells).sort(), ['iceLance', 'tornado']);
});

ok('부활 결계 · 보스 결계석 · 불사조 깃털: 층 도중에 쓰면 이어해도 없다', () => {
  const meta = meta0({ metaLv: { ...meta0().metaLv, revive: 1 } });
  const g = createRun(meta, 40, { ward: true }, ['phoenix']);
  for (let k = 0; k < 3; k++) wallHit(g);
  assert.equal(g.phase, 'play');
  assert.ok(g.run.prep.wardUsed && g.run.reviveUsed && g.run.relicRevives === 1);
  const ev = drainEvents(g).filter(e => e.type === 'revive');
  assert.equal(ev.length, 3);
  const r = reload(meta, g);
  assert.ok(r.run.prep.wardUsed && r.run.reviveUsed && r.run.relicRevives === 1);
  wallHit(r);
  assert.equal(r.phase, 'defeat', '이어한 판은 부활 없이 무너진다');
});
// 40층(네임드 보스 층) 도전: 체크포인트 JSON을 직접 만들어 이어하기로 연다
function createRun(meta, stage, prep, relics) {
  const base = serializeRun(start(meta));
  const g = restoreRun(meta, { ...base, stage, floors: stage - 1, prep, relics }, 5);
  g.pick = null; g.relicPick = null;
  meta.run = g.run.checkpoint;
  return g;
}

ok('성직자 부활 결계 강화도 동기화 · 다른 값(대기 카드·비전 충전·골드)은 층 시작 값 그대로', () => {
  const meta = meta0(), g = start(meta);
  const c0 = JSON.parse(JSON.stringify(g.run.checkpoint));
  g.run.heroRevive = true; // sim damageWall 성직자 분기(sim.test가 실제 경로를 본다)
  g.players[0].gold += 500; g.run.arcane = 0.9; g.path.cards = 0;
  syncCheckpoint(g);
  const c = g.run.checkpoint;
  assert.equal(c.heroRevive, true);
  assert.equal(c.players[0].gold, c0.players[0].gold, '처치 골드는 층을 다시 하며 다시 번다');
  assert.equal(c.arcane, c0.arcane);
  assert.deepEqual(c.path, c0.path);
});

ok('옛 체크포인트(쿨타임 필드 없음)도 그대로 열린다 · 정규화는 멱등', () => {
  const meta = meta0(), g = start(meta);
  const old = JSON.parse(JSON.stringify(g.run.checkpoint));
  old.players = old.players.map(p => ({ gold: p.gold }));
  delete old.ultCd;
  const r = restoreRun(meta, old, 3);
  assert.deepEqual(r.players[0].cd, { meteor: 0, freeze: 0 });
  assert.equal(r.heroUnit.ultCd, 0);
  const bad = normalizeRun({ players: [{ cd: { meteor: 'x', freeze: -5 } }], ultCd: 1e9 });
  assert.deepEqual(bad.players[0].cd, { meteor: 0, freeze: 0 });
  assert.equal(bad.ultCd, 999);
  const once = normalizeRun(serializeRun(g));
  assert.deepEqual(normalizeRun(JSON.parse(JSON.stringify(once))), once);
});

ok('탐구자 나침반(유물 후보 +1) 카드도 이어하면 그대로', () => {
  const cards = RELIC_KEYS.slice(0, RELIC_PICK_N + 1);
  assert.deepEqual(normalizeRelicRun({ relicPick: cards }).relicPick, cards);
});

console.log(`resume.test OK (${n})`);

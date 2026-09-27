// 4차 던전(지역) 특성 단위 테스트: 데이터 · 원소 배율(융합 포함) · 지역 규칙 5종 · 봇 가산. node test/dungeons.test.js
import assert from 'node:assert/strict';
import { THEMES, FUSIONS, SPELLS, REACH, FRONT_Y, WALL_Y, DT, inReach } from '../public/js/config.js';
import { createGame, step, drainEvents, refreshFusion } from '../public/js/sim.js';
import { spellRateMul } from '../public/js/spells.js';
import { enemySpeedMul } from '../public/js/stages.js';
import { pickCard } from '../public/js/bot.js';
import {
  DUNGEON_TRAITS, REGION_KEYS, ELEM_MUL, DG_TEST, elemMul, skillAffinity, pickBias, skillElements, regionView, undying, regionKill, applyReach,
} from '../public/js/dungeons.js';

const W = ELEM_MUL.weak, R = ELEM_MUL.resist;
const near = (a, b) => Math.abs(a - b) < 1e-9;
const game = (stage, spells = {}, extra = {}) => createGame({ stage, seed: 7, players: [{}, {}], run: { spells, awaken: { power: 0, haste: 0, ward: 999, fortune: 0 } }, ...extra });
const ev = [];
const emit = (g, e) => ev.push(e);
const trash = (g, x, y) => { const e = { id: 9000 + g.enemies.length, x, y, r: 16, hp: 10, maxHp: 10, shield: 0, reduce: 1, dead: false, isBoss: false, named: false, burn: 0, burnT: 0, slowT: 0, hit0: -1, born: 0, gold: 1, share: 1 }; g.enemies.push(e); return e; };

// ── 데이터: 5지역 = 테마 키, 원소 6종이 각각 약점·내성으로 한 번 이상, 규칙은 한국어 이름·설명 ──
assert.deepEqual(REGION_KEYS, THEMES.map(t => t.key));
assert.deepEqual(Object.keys(DUNGEON_TRAITS), REGION_KEYS);
for (const el of ['fire', 'lightning', 'frost', 'wind', 'holy', 'dark']) {
  assert.ok(REGION_KEYS.some(k => DUNGEON_TRAITS[k].weak.includes(el)), el + ' 약점 지역');
  assert.ok(REGION_KEYS.some(k => DUNGEON_TRAITS[k].resist.includes(el)), el + ' 내성 지역');
}
for (const k of REGION_KEYS) {
  const t = DUNGEON_TRAITS[k];
  assert.ok(t.weak.every(el => !t.resist.includes(el)), k + ' 약점·내성 겹침');
  assert.ok(/[가-힣]/.test(t.rule.name) && /[가-힣]/.test(t.rule.desc) && t.rule.key, k + ' 규칙');
}
assert.equal(regionView(2).name, '언데드 묘지');
assert.deepEqual(regionView(4).floors, [81, 100]);

// ── 원소 배율: 기본 스킬 · 융합(두 원소 평균) · 소환·피해 없는 스킬 · kind 대체 · 끄기 ──
const cave = game(25), meadow = game(5), abyss = game(85);
assert.equal(elemMul(cave, 'lightningStrike'), W);
assert.equal(elemMul(cave, 'tornado'), R);
assert.ok(near(elemMul(cave, 'stormEye'), (W + R) / 2), '폭풍의 눈 = 번개(약점) + 바람(내성)');
assert.ok(near(elemMul(cave, 'superconduct'), (W + 1) / 2), '초전도 = 냉기(보통) + 번개(약점)');
assert.ok(near(elemMul(meadow, 'steamBurst'), (W + 1) / 2), '증기 폭발 = 화염(약점) + 냉기(보통)');
assert.ok(near(elemMul(game(45), 'steamBurst'), (1 + R) / 2), '묘지: 화염(보통) + 냉기(내성)');
assert.ok(near(elemMul(abyss, 'twilight'), (R + W) / 2), '황혼 = 신성(내성) + 암흑(약점)');
assert.ok(near(elemMul(abyss, 'ghostLegion'), (W + 1) / 2), '망령 군단 = 암흑(약점) + 소환(보통)');
assert.equal(elemMul(abyss, 'babyDragon'), 1, '소환은 늘 보통');
assert.equal(elemMul(cave, 'gale'), 1);
assert.equal(elemMul(cave, null, 'lightning'), W, '스킬 키 없으면 피해 원소(kind)');
assert.equal(elemMul(cave, null, 'fireball'), 1, '기본 주문 kind는 원소 없음');
for (const f of FUSIONS) assert.equal(skillElements(f.key).length, 2);
DG_TEST.off = true;
assert.equal(elemMul(cave, 'lightningStrike'), 1);
DG_TEST.off = false;

// 실제 명중: 동굴 낙뢰 hit 이벤트 em = 1.3, 초원 낙뢰 = 1 / 폭풍의 눈(재료 낙뢰+회오리 → 벼락은 stormEye 원소)
function hits(g, secs) {
  const out = [];
  for (let t = 0; t < secs && g.phase === 'play'; t += DT) { if (g.pick) { g.pick = null; continue; } step(g, DT); out.push(...drainEvents(g)); }
  return out.filter(e => e.type === 'hit' && e.o === 3);
}
const hc = hits(game(25, { lightningStrike: 3 }), 25);
assert.ok(hc.length && hc.every(e => e.em === W), '동굴 낙뢰 = 약점');
const hm = hits(game(5, { lightningStrike: 3 }), 25);
assert.ok(hm.length && hm.every(e => e.em === 1), '초원 낙뢰 = 보통');
const gse = game(25, { lightningStrike: 6, tornado: 6 });
assert.ok(gse.fusions.includes('stormEye'));
const hs = hits(gse, 30);
assert.ok(hs.some(e => e.kind === 'lightning' && near(e.em, (W + R) / 2)), '폭풍의 눈 벼락 = 두 원소 평균');
assert.ok(hs.some(e => e.kind === 'wind' && e.em === R), '품은 회오리는 바람(내성)');
// 불꽃 마탄 화상은 제 원소(화산 = 화염 내성)로: 얼음 창(약점 ×1.3) 명중이 붙인 화상도 ×0.75
{
  const g = game(65, { iceLance: 3, flameBullet: 3 });
  g.players[0].stats.crit = 0;
  const e = trash(g, 360, 700);
  e.hp = e.maxHp = 1e12;
  g._src = 'iceLance';
  const api = { damage: () => 0, chainArc() {}, emit() {} };
  const raw = 100;
  const b0 = e.burn;
  // sim.spellHit이 onSpellHit에 원소 배율 전 raw를 넘긴다 → 화상 = raw × burn × 화염 배율
  const { onSpellHit } = await import('../public/js/spells.js');
  onSpellHit(g, e, raw, 0, api);
  assert.ok(near(e.burn - b0, raw * SPELLS.find(s => s.key === 'flameBullet').lv[2].burn * R), '화산: 불꽃 마탄 화상 ×0.75');
  g._src = null;
}

// ── 규칙 1: 동굴 '칠흑의 어둠' — 사거리 윗선이 내려간다(스텝마다) ──
{
  const g = game(25);
  step(g, DT);
  const y = FRONT_Y + (WALL_Y - FRONT_Y) * (1 - DUNGEON_TRAITS.cave.rule.reach);
  assert.equal(REACH.y, y);
  assert.equal(inReach({ dead: false, named: false, y: (FRONT_Y + y) / 2 }), false, '어둠 속 적은 사거리 밖');
  assert.equal(inReach({ dead: false, named: true, y: 100 }), true, '네임드 보스는 어디서든');
  const m = game(5);
  step(m, DT);
  assert.equal(REACH.y, FRONT_Y);
  DG_TEST.off = true; applyReach(g); assert.equal(REACH.y, FRONT_Y); DG_TEST.off = false;
}

// ── 규칙 2: 화산 '들끓는 열기' — 냉기 스킬이 없으면 시전 속도 ×0.85 ──
{
  const g = game(65, { fireball: 2 });
  assert.equal(spellRateMul(g), DUNGEON_TRAITS.volcano.rule.rate);
  g.spells.iceLance = 1; refreshFusion(g);
  assert.equal(spellRateMul(g), 1, '냉기 스킬이 열기를 식힌다');
  const s = game(65, { steamBurst: 1 }); // 증기 폭발이 품은 냉기 재료(g.book)도 인정
  s.fusionParts.steamBurst = ['fireball', 'iceLance']; refreshFusion(s);
  assert.equal(spellRateMul(s), 1);
  assert.equal(spellRateMul(game(45, { fireball: 2 })), 1, '묘지엔 열기 없음');
  assert.deepEqual(skillAffinity(g, 'frostWard', 3), { mul: 1, tag: null, cure: false }, '이미 냉기가 있으면 해소 표시 없음');
  const g2 = game(65, { fireball: 2 });
  assert.equal(skillAffinity(g2, 'frostWard').cure, true);
  assert.equal(skillAffinity(g2, 'iceLance').tag, 'weak');
  assert.equal(skillAffinity(g2, 'fireball').tag, 'resist');
}

// ── 규칙 3: 묘지 '되살아나는 망자' — 25%(한 번) · 불타면·신성 스킬이면 안 일어남 · 보스 제외 ──
{
  const g = game(45);
  g.rng = () => 0;
  ev.length = 0;
  const e = trash(g, 300, 600);
  e.hp = 0;
  assert.equal(undying(g, e, emit), true);
  assert.ok(near(e.hp, e.maxHp * DUNGEON_TRAITS.graveyard.rule.hp) && e.risen && ev[0].type === 'rise');
  e.hp = 0;
  assert.equal(undying(g, e, emit), false, '한 번만');
  const b = trash(g, 300, 600); b.hp = 0; b.burnT = 1;
  assert.equal(undying(g, b, emit), false, '불타는 적');
  const h = trash(g, 300, 600); h.hp = 0; g._hitSrc = 'judgment';
  assert.equal(undying(g, h, emit), false, '신성 스킬');
  g._hitSrc = 'twilight'; const h2 = trash(g, 300, 600); h2.hp = 0;
  assert.equal(undying(g, h2, emit), false, '황혼(신성+암흑)도 신성');
  g._hitSrc = 'fire'; const f = trash(g, 300, 600); f.hp = 0;
  assert.equal(undying(g, f, emit), true, '화염 명중은 되살아남(불타는 중이 아니면)');
  g._hitSrc = null;
  const boss = trash(g, 300, 600); boss.isBoss = true; boss.hp = 0;
  assert.equal(undying(g, boss, emit), false, '엘리트·보스 제외');
  g.rng = () => 0.99; const r = trash(g, 300, 600); r.hp = 0;
  assert.equal(undying(g, r, emit), false, '75%는 그대로 쓰러짐');
  assert.equal(undying(game(25), trash(game(25), 1, 1), emit), false, '묘지 밖');
  // 실제 흐름: 묘지 한 층을 돌면 rise 이벤트가 나오고 층은 끝난다(진행도 합이 맞다)
  const run = game(45, { fireball: 5, iceLance: 5 }); run.players[0].stats.dmg *= 1000;
  const all = [];
  for (let t = 0; t < 300 && run.phase === 'play'; t += DT) { if (run.pick) { run.pick = null; continue; } step(run, DT); all.push(...drainEvents(run)); }
  assert.equal(run.phase, 'clear');
  assert.ok(all.some(e => e.type === 'rise'), '묘지에서 망자가 일어난다');
}

// ── 규칙 4: 초원 '번지는 들불' — 불타는 적이 쓰러지면 가까운 3마리에게 화상 ──
{
  const g = game(5);
  g.enemies.length = 0;
  ev.length = 0;
  const e = trash(g, 300, 600); e.burn = 5; e.burnT = 1; e.burnSk = true;
  const ns = [trash(g, 320, 600), trash(g, 300, 640), trash(g, 260, 600), trash(g, 340, 640)], far = trash(g, 600, 200);
  regionKill(g, e, emit);
  const R0 = DUNGEON_TRAITS.meadow.rule, amt = (5 + 10 * R0.base) * R0.share;
  assert.equal(ns.filter(q => near(q.burn, amt) && q.burnT >= 2 && q.burnSk).length, 3, '가까운 3마리');
  assert.equal(far.burn, 0);
  assert.equal(ev[0].type, 'wildfire');
  assert.equal(ev[0].pts.length, 3);
  const cold = trash(g, 300, 600);
  ev.length = 0; regionKill(g, cold, emit);
  assert.equal(ev.length, 0, '안 불타면 안 번짐');
}

// ── 규칙 5: 심연 '광기의 행진' = 옛 심연 이동 속도 ×1.1 그대로 ──
assert.ok(near(enemySpeedMul(81) / (1 + 80 * 0.008), 1.1));
assert.ok(near(enemySpeedMul(80) / (1 + 79 * 0.008), 1));

// ── 봇: 지금 지역 약점 원소 새 스킬을 고르고, 지역 끝 5층이면 다음 지역도 본다 ──
{
  const g = game(25, { fireball: 2 });
  const cards = [{ spell: 'iceLance', level: 1 }, { spell: 'lightningStrike', level: 1 }];
  assert.equal(pickCard(g, cards), 1, '동굴: 낙뢰(약점)');
  assert.equal(pickCard(game(65, { fireball: 2 }), cards), 0, '화산: 얼음 창(약점 + 열기 해소)');
  assert.equal(pickBias(game(10), 'lightningStrike'), 0, '초원 중반: 다음 지역 안 봄');
  assert.equal(pickBias(game(18), 'lightningStrike'), 0.75 * 4, '초원 끝: 다음 지역(동굴) 약점');
  assert.equal(pickBias(game(18), 'fireball'), 4, '초원 화염 약점(동굴은 보통)');
  DG_TEST.off = true; assert.equal(pickBias(g, 'lightningStrike'), 0); DG_TEST.off = false;
}
REACH.y = FRONT_Y;
console.log('던전 특성 테스트 통과');

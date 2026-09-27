// 4차 경제 싱크 단위 테스트: node test/shop.test.js
// 가격(단조·지수·체감) · 구매 검증(음수 없음·잠김·상한·환불) · 상자(되팔기 이득 없음·가방 넘침) · 출정 준비(도전에 넘어가고 소모) · 보스 결계석 · 저장 마이그레이션 · 방치 골드
import assert from 'node:assert/strict';
import { DT, TRAIN_KEYS, trainMax, trainCost, META_KEYS, metaMax, START_CARDS } from '../public/js/config.js';
import { createGame, step, act, drainEvents, serializeRun, normalizeRun } from '../public/js/sim.js';
import { rollItem, sellValue, BAG_SIZE } from '../public/js/hero.js';
import { newRun, restoreRun, endRun, campAct, applyOffline } from '../public/js/run.js';
import { defaults, normalize, computeOffline, exportSave, importSave } from '../public/js/save.js';
import { mulberry32 } from '../public/js/util.js';
import {
  priceScale, breakBonus, trainBreakCost, trainBreakText, gemBreakCost, GEM_BREAK, runBonus, PREP, PREP_KEYS, prepCost, BOXES, boxOdds, boxCost,
  offlineGoldPerHour, shopOffers, affordable, botShop, buyTrainBreak, buyGemBreak, togglePrep, openBox,
} from '../public/js/shop.js';
import { lockedRelics, relicUnlockCost } from '../public/js/relics.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };
const maxTraining = m => { for (const k of TRAIN_KEYS) m.training[k] = trainMax(k); return m; };
const maxMeta = m => { for (const k of META_KEYS) m.metaLv[k] = metaMax(k); return m; };

ok('가격: 최고 층에 따라 오르고, 돌파는 지수로 오른다', () => {
  for (const b of [0, 10, 30, 60, 100]) assert.ok(priceScale(b + 1) >= priceScale(b));
  assert.equal(priceScale(0), priceScale(10), '10층 아래는 같은 값');
  for (const k of PREP_KEYS) { assert.ok(prepCost(k, 0) > 0); assert.ok(prepCost(k, 100) > prepCost(k, 20)); }
  assert.ok(boxCost('gear', 80) > boxCost('gear', 10) && boxCost('fine', 0) === boxCost('fine', 100));
  for (const k of TRAIN_KEYS) {
    assert.ok(trainBreakCost(k, 0) > trainCost(k, trainMax(k) - 1), '돌파 1단 > 마지막 수련');
    for (let i = 0; i < 20; i++) assert.ok(trainBreakCost(k, i + 1) / trainBreakCost(k, i) > 1.25);
  }
  for (const b of GEM_BREAK) assert.ok(gemBreakCost(b.key, 5) > gemBreakCost(b.key, 4));
  assert.ok(Number.isFinite(trainBreakCost('atk', 999)), '상한 단계도 숫자');
});

ok('돌파 효과는 끝없이 조금씩 · 체감 · 상한(원래 5레벨어치)', () => {
  let last = 0, lastD = Infinity;
  for (let i = 1; i < 60; i++) {
    const v = breakBonus(0.04, i), d = v - last;
    assert.ok(d > 0 && d < lastD, '늘 오르되 증가폭은 줄어든다');
    last = v; lastD = d;
  }
  assert.ok(breakBonus(0.04, 999) <= 0.2 + 1e-12);
  assert.equal(breakBonus(0.04, 0), 0);
  assert.equal(breakBonus(0.04, -3), 0);
  assert.match(trainBreakText('atk', 1), /피해 \+2%/);
  const b = runBonus({ trainBreak: { atk: 3, rate: 0, crit: 2, multi: 1, wall: 0 }, gemBreak: { greed: 2 } });
  assert.ok(b.atkMul > 1 && b.rateMul === 1 && b.critAdd > 0 && b.echoAdd > 0 && b.goldMul > 1);
  assert.deepEqual(runBonus({}), { atkMul: 1, rateMul: 1, wallMul: 1, critAdd: 0, echoAdd: 0, goldMul: 1 });
});

ok('수련·보석 돌파: 만렙 전엔 잠김 · 부족하면 실패(재화 그대로) · 성공하면 정확히 차감', () => {
  const m = defaults();
  m.gold = 1e12; m.gems = 1e9;
  assert.equal(buyTrainBreak(m, 'atk'), false, '만렙 전 잠김');
  assert.equal(buyGemBreak(m, 'greed'), false);
  maxTraining(m); maxMeta(m);
  assert.equal(buyTrainBreak(m, 'nope'), false);
  assert.equal(buyGemBreak(m, 'choice'), false, '돌파 없는 강화');
  const g0 = m.gold, c = trainBreakCost('rate', 0);
  assert.ok(campAct(m, { type: 'trainBreak', stat: 'rate' }));
  assert.equal(m.gold, g0 - c); assert.equal(m.trainBreak.rate, 1);
  const m0 = m.gems, gc = gemBreakCost('pickaxe', 0);
  assert.ok(campAct(m, { type: 'gemBreak', key: 'pickaxe' }));
  assert.equal(m.gems, m0 - gc); assert.equal(m.gemBreak.pickaxe, 1);
  m.gold = trainBreakCost('wall', 0) - 1;
  assert.equal(buyTrainBreak(m, 'wall'), false);
  assert.equal(m.gold, trainBreakCost('wall', 0) - 1, '실패하면 재화 그대로');
  m.gold = NaN;
  assert.equal(buyTrainBreak(m, 'wall'), false, '깨진 재화');
  m.gold = 1e300; m.trainBreak.crit = 999;
  assert.equal(buyTrainBreak(m, 'crit'), false, '단계 상한');
});

ok('출정 준비: 사고 · 다시 누르면 전액 환불 · 부족하면 실패 · 음수 없음', () => {
  const m = defaults();
  m.best = 30; m.gold = prepCost('card', 30);
  assert.ok(campAct(m, { type: 'prep', key: 'card' }) && m.prep.card && m.gold === 0);
  assert.equal(campAct(m, { type: 'prep', key: 'ward' }), false, '골드 부족');
  assert.equal(m.gold, 0);
  assert.ok(campAct(m, { type: 'prep', key: 'card' }) && !m.prep.card && m.gold === prepCost('card', 30), '환불');
  assert.equal(campAct(m, { type: 'prep', key: 'x' }), false);
});

ok('출정 준비 → 도전: 시작 카드 +1 · 망각 +1 · 체크포인트·이어하기 · meta.prep 소모', () => {
  const m = defaults();
  m.gold = 1e6;
  for (const k of PREP_KEYS) togglePrep(m, k);
  const g = newRun(m, { cls: 'knight' }, 3);
  assert.deepEqual(m.prep, { card: false, rare: false, ward: false, forget: false }, '정비의 준비는 비워진다');
  assert.ok(g.run.prep.card && g.run.prep.ward && !g.run.prep.wardUsed);
  assert.ok(g.pick && g.pickQ === START_CARDS, `시작 카드 ${START_CARDS}+1장`);
  const plain = newRun(defaults(), { cls: 'knight' }, 3);
  assert.equal(g.forgetLeft, plain.forgetLeft + 1, '망각 +1');
  const saved = JSON.parse(JSON.stringify(g.run.checkpoint));
  assert.ok(normalizeRun(saved).prep.card, '체크포인트에 남는다');
  m.run = saved;
  const r = restoreRun(m, saved, 3);
  assert.ok(r.pick && r.pickQ === START_CARDS, '1층 이어하기도 두 장');
  assert.equal(normalizeRun({ prep: { card: 'yes', wardUsed: 1, junk: 5 } }).prep.card, true);
  assert.deepEqual(Object.keys(normalizeRun(null).prep).sort(), [...PREP_KEYS, 'wardUsed'].sort());
});

ok('행운의 부적: 1층 카드의 희귀·전설 비율이 오른다', () => {
  const share = rare => {
    let hi = 0, all = 0;
    for (let s = 1; s <= 120; s++) {
      const g = createGame({ seed: s, stage: 1, startCards: 1, players: [{}, {}], run: { prep: { rare } } });
      for (const c of g.pick.cards) { all++; if (c.rarity !== 'common') hi++; }
    }
    return hi / all;
  };
  const a = share(false), b = share(true);
  assert.ok(b > a + 0.1, `희귀 이상 ${a.toFixed(2)} → ${b.toFixed(2)}`);
});

function breakWall(stage, prep, metaLv) {
  const g = createGame({ stage, seed: 6, players: [{}, {}], run: { prep }, metaLv });
  const ev = [];
  for (let t = 0; t < 600 && g.phase === 'play'; t += DT) {
    if (g.relicPick) { act(g, 0, { type: 'relic', index: -1 }); continue; }
    if (g.pick) { act(g, 0, { type: 'pick', index: 0 }); ev.push(...drainEvents(g)); continue; }
    step(g, DT);
    ev.push(...drainEvents(g));
  }
  return { g, ev };
}
ok('보스 결계석: 네임드 보스 층에서만 1회 50% · 부활 결계보다 먼저 · 저장에 남음', () => {
  const { g, ev } = breakWall(40, { ward: true }, { revive: 1 });
  const rv = ev.filter(e => e.type === 'revive');
  assert.equal(g.phase, 'defeat');
  assert.equal(rv.length, 2, '결계석 + 부활 결계');
  assert.equal(rv[0].prep, true, '결계석이 먼저');
  assert.ok(Math.abs(rv[0].hp - g.wall.max * 0.5) < 1e-6);
  assert.ok(g.run.prep.wardUsed && g.run.reviveUsed);
  assert.equal(normalizeRun(JSON.parse(JSON.stringify(serializeRun(g)))).prep.wardUsed, true);
  const off = breakWall(41, { ward: true });
  assert.ok(!off.ev.some(e => e.type === 'revive'), '보스 층이 아니면 없음');
  assert.ok(!off.g.run.prep.wardUsed);
});

ok('수련·보석 돌파가 도전 배율에 들어간다', () => {
  const m = maxTraining(defaults());
  const base = newRun(m, { cls: 'knight' }, 1);
  m.trainBreak = { atk: 10, rate: 10, crit: 10, multi: 10, wall: 10 };
  m.gemBreak.greed = 10;
  const g = newRun(m, { cls: 'knight' }, 1);
  const a = base.players[0].stats, b = g.players[0].stats;
  assert.ok(b.dmg > a.dmg && b.rate > a.rate && b.crit > a.crit && b.echo > a.echo && g.wall.max > base.wall.max && g.fx.goldMul > base.fx.goldMul);
  assert.ok(b.dmg / a.dmg < 1.2, '돌파 10단도 피해 +20% 미만(스킬이 주력)');
  const r = restoreRun(m, g.run.checkpoint, 1);
  assert.ok(Math.abs(r.players[0].stats.dmg - b.dmg) < 1e-6, '이어하기도 같은 배율');
});

ok('장비 상자: 값 차감 · 가방/장착 · 가방이 차면 자동 판매 · 잠김·부족·잘못된 키', () => {
  const m = defaults();
  m.best = 50; m.gold = boxCost('gear', 50) * 2; m.gems = 59;
  assert.equal(openBox(m, 'fine'), false, '보석 부족');
  assert.equal(m.gems, 59);
  assert.equal(openBox(m, 'nope'), false);
  const rng = mulberry32(9);
  const r = campAct(m, { type: 'box', key: 'gear' });
  assert.ok(r && r.item && r.item.ilvl === 50);
  assert.equal(m.gold, boxCost('gear', 50) + (r.sold || 0));
  m.hero.autoEquip = false;
  while (m.hero.bag.length < BAG_SIZE) m.hero.bag.push(rollItem(1, 'normal', rng, 'knight'));
  m.gems = 300;
  const g0 = m.gold, r2 = openBox(m, 'legend', rng);
  assert.equal(r2.item.rarity, 'legend');
  assert.equal(m.gems, 0);
  assert.ok(r2.sold > 0 && m.gold === g0 + r2.sold && m.hero.bag.length === BAG_SIZE, '넘친 장비는 판매');
  for (const k of ['fine', 'legend']) assert.ok(boxOdds(k, 0).slice(0, 2).every(x => x === 0), '보석 상자는 희귀 이상');
  assert.ok(boxOdds('gear', 100)[4] > boxOdds('gear', 0)[4] && boxOdds('gear', 100)[0] < boxOdds('gear', 0)[0], '최고 층이 높을수록 좋은 등급');
});

ok('되팔기로 이득 없음: 장비 상자 기대 판매가 < 값의 25%', () => {
  const rng = mulberry32(3);
  for (const best of [1, 10, 30, 60, 100]) {
    let s = 0;
    for (let i = 0; i < 3000; i++) s += sellValue(rollItem(Math.max(1, best), boxOdds('gear', best), rng, 'knight'));
    assert.ok(s / 3000 < boxCost('gear', best) * 0.25, `${best}층: ${Math.round(s / 3000)} / ${boxCost('gear', best)}`);
  }
  let s = 0;
  for (let i = 0; i < 2000; i++) s += sellValue(rollItem(100, boxOdds('legend', 100), rng, 'knight'));
  assert.ok(s / 2000 < 1500, '전설 상자(보석)를 팔아도 골드 몇 판어치가 아니다');
});

ok('유물 해금(보석): 잠긴 것만 · 값 차감 · 부족하면 실패', () => {
  const m = defaults();
  const k = lockedRelics(m)[0], c = relicUnlockCost(k);
  m.gems = c - 1;
  assert.equal(campAct(m, { type: 'relic', key: k }), false);
  m.gems = c;
  assert.ok(campAct(m, { type: 'relic', key: k }) && m.gems === 0 && m.relicUnlocked.includes(k));
  assert.equal(campAct(m, { type: 'relic', key: k }), false, '이미 해금');
});

ok('살 것 목록: 언제나 효과 있는 것만 · 만렙이면 돌파로 바뀐다', () => {
  const m = maxMeta(maxTraining(defaults()));
  const ids = shopOffers(m).map(o => o.id);
  assert.ok(TRAIN_KEYS.every(k => ids.includes(`trainBreak:${k}`) && !ids.includes(`train:${k}`)));
  assert.ok(GEM_BREAK.every(b => ids.includes(`gemBreak:${b.key}`)));
  assert.ok(!ids.some(i => i.startsWith('meta:')));
  m.prep.card = true;
  assert.ok(!shopOffers(m).some(o => o.id === 'prep:card'), '산 준비는 빠진다');
  m.gold = 0; m.gems = 0;
  assert.equal(affordable(m, shopOffers(m)).length, 0);
  m.gold = 1e12; m.gems = 1e9;
  const spent = botShop(m, mulberry32(1));
  assert.ok(spent.prep > 0 && spent.trainBreak > 0 && spent.gemBreak > 0 && spent.boxGold > 0 && spent.boxGems > 0);
  assert.ok(m.gold >= 0 && m.gems >= 0);
});

ok('저장: 옛 저장(필드 없음)·깨진 값 → 0/false · 백업 코드 왕복', () => {
  const d = defaults();
  assert.deepEqual(d.trainBreak, { atk: 0, rate: 0, crit: 0, multi: 0, wall: 0 });
  assert.deepEqual(d.gemBreak, { greed: 0, pickaxe: 0 });
  assert.deepEqual(d.prep, { card: false, rare: false, ward: false, forget: false });
  const old = normalize({ v: 3, best: 12, gold: 50, training: { atk: 3 } }); // v0.0.8 저장
  assert.equal(old.trainBreak.atk, 0); assert.equal(old.prep.ward, false); assert.equal(old.gold, 50);
  const bad = normalize({ v: 3, trainBreak: { atk: -4, rate: 'x', crit: 1e9, multi: 2.7 }, gemBreak: 'no', prep: { card: 1, rare: 'yes', ward: 0 } });
  assert.deepEqual(bad.trainBreak, { atk: 0, rate: 0, crit: 999, multi: 2, wall: 0 });
  assert.deepEqual(bad.gemBreak, { greed: 0, pickaxe: 0 });
  assert.deepEqual(bad.prep, { card: true, rare: true, ward: false, forget: false });
  const m = defaults();
  m.trainBreak.atk = 7; m.gemBreak.pickaxe = 2; m.prep.forget = true;
  const back = importSave(exportSave(m));
  assert.ok(back.ok);
  assert.equal(back.data.trainBreak.atk, 7); assert.equal(back.data.gemBreak.pickaxe, 2); assert.equal(back.data.prep.forget, true);
});

ok('방치 보상: 골드 추가 · 심층 채굴이 셋 다 올린다 · 지급', () => {
  const base = { lastSeen: 1_000_000, best: 40, metaLv: { pickaxe: 5 } };
  const t = 1_000_000 + 2 * 3_600_000;
  const a = computeOffline(base, t);
  assert.equal(a.gold, Math.floor(offlineGoldPerHour(40) * 2));
  const b = computeOffline({ ...base, gemBreak: { pickaxe: 4 } }, t);
  assert.ok(b.gold > a.gold && b.gems >= a.gems && b.xp > a.xp);
  assert.deepEqual(computeOffline({ ...base, lastSeen: 0 }, t), { gems: 0, gold: 0, xp: 0, minutes: 0 });
  const m = defaults();
  applyOffline(m, a);
  assert.equal(m.gold, a.gold);
  applyOffline(m, { gold: -50, gems: -3, xp: 0 });
  assert.equal(m.gold, a.gold, '음수 지급 없음');
  assert.ok(offlineGoldPerHour(100) > offlineGoldPerHour(10));
});

ok('도전 정산 뒤에도 출정 준비는 다시 사야 한다(반복 소비)', () => {
  const m = defaults();
  m.gold = 1e6;
  togglePrep(m, 'card');
  const g = newRun(m, { cls: 'knight' }, 2);
  g.run.over = true; g.phase = 'defeat';
  endRun(g, m);
  assert.equal(m.prep.card, false);
  assert.ok(shopOffers(m).some(o => o.id === 'prep:card'));
});

console.log(`shop.test: ${n}개 통과 (보석 상자 ${BOXES.length}종 · 출정 준비 ${PREP.length}종)`);

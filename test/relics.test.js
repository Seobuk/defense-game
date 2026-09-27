// 4차 유물 · 망각 단위 테스트: node test/relics.test.js
// 유물 표 · 보스 보상 흐름(전투 정지·체크포인트·이어하기 복원·건너뛰기·자동 선택) · 유물 20종 효과 훅 · 망각 한도 · 해금 API · 봇 정책
import assert from 'node:assert/strict';
import { DT, WALL_Y, SKILLS, SPELL_SLOTS, SPELL_MAX_LV, SKILL_BY_KEY } from '../public/js/config.js';
import { createGame, step, act, drainEvents, startStage, serializeRun, cardCount, reofferPick, refreshFusion, slotsUsed } from '../public/js/sim.js';
import { spellCooldown } from '../public/js/spells.js';
import { newHero } from '../public/js/hero.js';
import { newRun, restoreRun, endRun } from '../public/js/run.js';
import { defaults, normalize } from '../public/js/save.js';
import {
  RELICS, RELIC_KEYS, RELIC_BY_KEY, START_RELICS, FORGET_PER_RUN, RELIC_AUTO_T, relicFx, relicPool, lockedRelics, relicUnlockCost, unlockRelic,
  relicHitMul, slotCap, offerRelics, tickRelic, onRelicKill, pickRelic, forgetChoice,
} from '../public/js/relics.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };
const me = (extra = {}) => ({ kind: 'human', ...extra });
const game = (o = {}) => createGame({ stage: o.stage ?? 5, seed: o.seed ?? 7, players: [me(o.p0), {}], run: { spells: o.spells || {}, relics: o.relics || [], ...(o.run || {}) }, hero: o.hero, bonusForgets: o.bonusForgets, metaLv: o.metaLv, relicPool: o.pool });
// 층을 바로 클리어(스폰·적 비우고 한 스텝)
const clearNow = g => { g.spawnIdx = g.spawns.length; g.enemies.length = 0; step(g, DT); };
// 죽지 않는 허수아비 한 마리만 남긴 전장에서 secs초 — 명중 이벤트 합(card = 스킬, basic = 기본 주문)
function dummy(g, boss = false) {
  g.spawns = []; g.spawnIdx = 0; g.enemies.length = 0;
  g.enemies.push({ id: 9e6, type: 'slime', name: '허수아비', x: 360, y: 600, r: 20, hp: 1e15, maxHp: 1e15, shield: 0, frozen: false, isBoss: boss, named: false, elite: boss,
    hitT: 0, state: 'walk', beh: 'walk', speed: 0, vx: 0, vy: 0, dmg: 0, gold: 1, share: 1, reduce: 1, stopY: 0, t: 0, t2: 0, t3: 0, atkT: 0, cycle: 0,
    enraged: false, dead: false, burn: 0, burnT: 0, burnO: 0, burnSk: false, slowT: 0, born: 0, hit0: -1 });
}
function measure(o, secs = 12, boss = false) {
  const g = game(o);
  if (o.setup) o.setup(g);
  dummy(g, boss);
  drainEvents(g);
  const s = { card: 0, basic: 0, basicN: 0, hero: 0 };
  for (let t = 0; t < secs; t += DT) {
    step(g, DT);
    for (const e of drainEvents(g)) if (e.type === 'hit') { if (e.o === 3) s.card += e.dmg; else if (e.o === 0) { s.basic += e.dmg; s.basicN++; } }
  }
  s.hero = g.dmgDone[2];
  return s;
}
const near = (a, b, tol = 0.01, msg) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} ≈ ${b}`);
const knight = () => { const h = newHero(); h.cls = 'knight'; h.level = 30; return h; };

console.log('유물 표');
ok('20종 · 시작 풀 8 · 해금 12(가격 60~150) · 문구 · 효과 키', () => {
  assert.equal(RELICS.length, 20);
  assert.equal(new Set(RELIC_KEYS).size, 20);
  assert.equal(START_RELICS.length, 8);
  const neutral = relicFx([]);
  for (const r of RELICS) {
    assert.ok(r.name && r.up && r.down, r.key);
    for (const k of Object.keys(r.fx)) assert.ok(k in neutral, `${r.key}.${k}`);
    if (!r.start) assert.ok(r.cost >= 60 && r.cost <= 150, r.key);
    for (const x of r.excl || []) assert.ok(RELIC_BY_KEY[x], `${r.key} excl ${x}`);
  }
  assert.equal(relicFx(['thief', 'sage']).cdMul.toFixed(3), (1 / 0.8 * 0.8).toFixed(3), '배율은 곱');
  assert.equal(relicFx(['grail', 'gambler']).choices, 0, '선택지는 합');
  assert.deepEqual(relicFx(['phoenix', 'glacier']).seal, ['meteor', 'meteor']);
});
ok('해금 API: 풀 · 잠김 · 가격 · 보석 차감 · 저장 검증', () => {
  const m = defaults();
  assert.deepEqual(relicPool(m), START_RELICS);
  assert.equal(lockedRelics(m).length, 12);
  assert.equal(unlockRelic(m, 'crown'), false, '시작 풀은 살 수 없음');
  m.gems = 50;
  assert.equal(unlockRelic(m, 'hourglass'), false, '보석 부족');
  m.gems = 1000;
  assert.ok(unlockRelic(m, 'hourglass') && m.gems === 1000 - relicUnlockCost('hourglass'));
  assert.ok(relicPool(m).includes('hourglass') && !lockedRelics(m).includes('hourglass'));
  assert.equal(unlockRelic(m, 'hourglass'), false, '이미 해금');
  const back = normalize(JSON.parse(JSON.stringify({ ...m, relicUnlocked: ['hourglass', 'crown', 'nope', 'hourglass'] })));
  assert.deepEqual(back.relicUnlocked, ['hourglass']);
  assert.deepEqual(normalize({}).relicUnlocked, []);
  const g = newRun(m, { cls: 'knight' }, 3);
  assert.ok(g.relicPool.includes('hourglass'), 'newRun이 meta 풀을 넘긴다');
});

console.log('유물 흐름');
ok('네임드 보스 층 클리어 → 3장 · 전투 정지 · startStage가 지우지 않음 · 체크포인트 · 고르기', () => {
  const g = game({ stage: 10 });
  clearNow(g);
  assert.equal(g.phase, 'clear');
  assert.equal(g.relicPick.cards.length, 3);
  assert.ok(g.relicPick.cards.every(k => START_RELICS.includes(k)));
  assert.ok(drainEvents(g).some(e => e.type === 'relicOffer'));
  assert.deepEqual(g.run.checkpoint.relicPick, g.relicPick.cards, '다음 층 체크포인트에 후보');
  assert.equal(g.run.checkpoint.stage, 11);
  startStage(g, 11);
  assert.ok(g.relicPick, 'startStage는 유물을 지우지 않는다');
  assert.ok(!act(g, 0, { type: 'skill', skill: 'freeze' }), '유물 중엔 다른 조작 불가');
  const t0 = g.phaseT;
  for (let i = 0; i < 30; i++) step(g, DT);
  assert.equal(g.phaseT, t0, '유물 중 전투 정지');
  const key = g.relicPick.cards[1];
  assert.ok(!act(g, 0, { type: 'relic', index: 7 }));
  assert.ok(act(g, 0, { type: 'relic', index: 1 }));
  assert.deepEqual(g.relics, [key]);
  assert.equal(g.relicPick, null);
  assert.ok(drainEvents(g).some(e => e.type === 'relicPick' && e.key === key));
  assert.deepEqual(g.run.checkpoint.relics, [key]);
  assert.equal(g.run.checkpoint.relicPick, null);
  step(g, DT);
  assert.ok(g.phaseT > t0, '고르면 전투 재개');
});
ok('보스 층이 아니면 · 100층(도전 완료)이면 유물 없음', () => {
  const g = game({ stage: 9 }); clearNow(g); assert.equal(g.relicPick, null);
  const w = game({ stage: 100 }); clearNow(w); assert.equal(w.relicPick, null); assert.ok(w.run.over);
});
ok('이어하기: 떠 있던 유물 후보가 다시 뜨고 고르기 전엔 전투 정지', () => {
  const m = defaults();
  const g0 = newRun(m, { cls: 'knight' }, 4);
  g0.stage = 20; startStage(g0, 20); clearNow(g0);
  const cards = [...g0.relicPick.cards];
  m.run = JSON.parse(JSON.stringify(g0.run.checkpoint)); // 앱이 꺼짐 → 저장
  const saved = normalize(JSON.parse(JSON.stringify(m)));
  const g = restoreRun(saved, saved.run, 9);
  assert.equal(g.stage, 21);
  assert.deepEqual(g.relicPick.cards, cards);
  assert.ok(drainEvents(g).some(e => e.type === 'relicOffer'));
  for (let i = 0; i < 20; i++) step(g, DT);
  assert.equal(g.phaseT, 0);
  assert.ok(act(g, 0, { type: 'relic', index: 2 }));
  assert.equal(g.run.checkpoint.stage, 21, '층 시작 체크포인트(이 층)');
  assert.deepEqual(g.run.checkpoint.relics, [cards[2]]);
  const g2 = restoreRun(saved, g.run.checkpoint, 9);
  assert.deepEqual(g2.relics, [cards[2]]);
  assert.equal(g2.relicPick, null);
});
ok('건너뛰기(index −1) · 자동 선택(카드 자동 선택 ON) · 끄면 기다림', () => {
  const g = game({ stage: 10 }); clearNow(g);
  assert.ok(act(g, 0, { type: 'relic', index: -1 }));
  assert.deepEqual(g.relics, []);
  assert.ok(drainEvents(g).some(e => e.type === 'relicPick' && e.key === null));
  const a = game({ stage: 10, p0: { autoPick: true } }); clearNow(a);
  assert.equal(a.relicPick.autoLeft, RELIC_AUTO_T);
  tickRelic(a, RELIC_AUTO_T - 0.5); assert.ok(a.relicPick);
  tickRelic(a, 1); assert.equal(a.relics.length, 1, '자동 선택');
  const h = game({ stage: 10 }); clearNow(h);
  tickRelic(h, 60); assert.ok(h.relicPick && h.relicPick.autoLeft == null, 'OFF면 무한 대기');
});
ok('후보: 이미 가진 유물·겹침 금지(excl) 제외 · 풀이 모자라면 적게 · 없으면 건너뜀', () => {
  const g = game({ relics: ['thief'], pool: ['thief', 'sage', 'crown'] });
  offerRelics(g);
  assert.deepEqual(g.relicPick.cards, ['crown']);
  const e = game({ relics: ['crown'], pool: ['crown'] });
  assert.equal(offerRelics(e), false);
  assert.equal(e.relicPick, null);
});

console.log('유물 효과 훅');
const base = measure({ spells: { fireball: 3 } });
const boss = measure({ spells: { fireball: 3 } }, 12, true);
assert.ok(base.card > 0 && base.basic > 0 && base.basicN > 0, '기준 측정');
ok('광기의 왕관: 스킬 피해 ×1.4 · 칸 5 · 5칸이면 새 스킬 카드 없음 · 꽉 찬 6칸이면 가장 약한 스킬을 잃는다', () => {
  near(measure({ spells: { fireball: 3 }, relics: ['crown'] }).card / base.card, 1.4, 0.01, '스킬');
  const f = game({ stage: 10, spells: { plasma: 1, fireball: 4, tornado: 2, gale: 1, judgment: 3, iceLance: 2 }, run: { fusionParts: { plasma: ['fireball', 'lightningStrike'] } } });
  delete f.spells.fireball; f.spells.stoneGolem = 1; refreshFusion(f); // 6칸: 융합 1 + 기본 5
  clearNow(f); f.relicPick.cards = ['crown']; drainEvents(f);
  act(f, 0, { type: 'relic', index: 0 });
  assert.equal(slotsUsed(f), 5);
  assert.ok(!f.spells.gale || !f.spells.stoneGolem, 'Lv1 기본 스킬 하나를 잃음'); assert.ok(f.spells.plasma, '융합은 지킨다');
  assert.ok(drainEvents(f).some(e => e.type === 'relicProc' && e.key === 'crown' && e.lost));
  const g = game({ relics: ['crown'], spells: { fireball: 1, tornado: 1, gale: 1, judgment: 1, iceLance: 1 } });
  assert.equal(slotCap(g), SPELL_SLOTS - 1);
  for (let i = 0; i < 20; i++) { reofferPick(g, { starter: false }); assert.ok(g.pick.cards.every(c => c.awaken || g.spells[c.spell]), '강화만'); }
});
ok('탐욕의 성배: 선택지 +1 · 성벽 -15%', () => {
  const a = game(), b = game({ relics: ['grail'] });
  assert.equal(cardCount(b), cardCount(a) + 1);
  near(b.wall.max / a.wall.max, 0.85, 0.01, '성벽');
});
ok('유리 대포: 모든 피해 ×1.3 · 성벽 -35%', () => {
  const s = measure({ spells: { fireball: 3 }, relics: ['glass'] });
  near(s.card / base.card, 1.3, 0.01, '스킬'); near(s.basic / base.basic, 1.3, 0.01, '기본');
  near(game({ relics: ['glass'] }).wall.max / game().wall.max, 0.65, 0.01, '성벽');
});
ok('시간 도둑: 쿨타임 -20% · 기본 주문 봉인 · 성벽 -15%', () => {
  const s = measure({ spells: { fireball: 3 }, relics: ['thief'] });
  assert.equal(s.basicN, 0, '기본 주문 없음');
  near(spellCooldown(game({ spells: { fireball: 3 }, relics: ['thief'] }), 'fireball').total / spellCooldown(game({ spells: { fireball: 3 } }), 'fireball').total, 0.8, 0.001, '쿨');
  near(game({ relics: ['thief'] }).wall.max / game().wall.max, 0.85, 0.01, '성벽');
});
ok('쌍둥이 달: 카드가 2레벨 · 만렙 넘지 않음 · 합체 ✦ · 마나 카드는 두 번에 한 번(저장)', () => {
  const g = game({ relics: ['twinMoon'], spells: { fireball: 5, tornado: 6 } });
  // 실제 층 4개(6~9층, 보스 없음 = 층마다 마나 카드 1장): 쌍둥이 달이면 2장 · 혼돈의 구슬이면 0장
  const offers = relics => {
    const h = game({ stage: 6, relics, spells: { fireball: 4, lightningStrike: 4 }, run: { awaken: { power: 60, haste: 0, ward: 999, fortune: 0 } } });
    let n = 0;
    for (let f = 0; f < 4; f++) {
      for (let t = 0; t < 400 && h.phase === 'play'; t += DT) { if (h.pick) { n++; act(h, 0, { type: 'pick', index: 0 }); continue; } step(h, DT); }
      assert.equal(h.phase, 'clear');
      startStage(h, h.stage + 1);
    }
    return { n, save: serializeRun(h).relicCards };
  };
  const o0 = offers([]), o2 = offers(['twinMoon']);
  assert.equal(o0.n, 4); assert.equal(o2.n, 2); assert.equal(o2.save, 4, '카운터 저장');
  assert.equal(offers(['chaos']).n, 0, '혼돈의 구슬: 마나 카드 없음');
  for (let i = 0; i < 20; i++) {
    reofferPick(g, { starter: false });
    for (const c of g.pick.cards) if (c.spell) assert.equal(c.level, Math.min(SPELL_MAX_LV, (g.spells[c.spell] || 0) + 2));
    const fb = g.pick.cards.find(c => c.spell === 'fireball');
    if (fb) assert.ok(fb.fusionHint, 'Lv5 → 6(MAX) = 합체');
  }
  const t = game({ relics: ['twinMoon'], spells: { fireball: 4, tornado: 6 } });
  for (let i = 0; i < 20; i++) { reofferPick(t, { starter: false }); const fb = t.pick.cards.find(c => c.spell === 'fireball'); if (fb) assert.ok(fb.fusionHint && fb.level === 6, 'Lv4 + 2 = 합체'); }
});
ok('사냥꾼의 표식: 엘리트·보스 스킬 ×1.7 · 일반 ×0.85 · 기본 주문은 그대로', () => {
  near(measure({ spells: { fireball: 3 }, relics: ['hunter'] }, 12, true).card / boss.card, 1.7, 0.01, '보스');
  const s = measure({ spells: { fireball: 3 }, relics: ['hunter'] });
  near(s.card / base.card, 0.85, 0.01, '일반'); near(s.basic / base.basic, 1, 0.001, '기본');
});
ok('수전노의 금고: 골드 ×2.5 · 모든 피해 -10%', () => {
  near(game({ relics: ['miser'] }).fx.goldMul / game().fx.goldMul, 2.5, 0.001, '골드');
  near(measure({ spells: { fireball: 3 }, relics: ['miser'] }).card / base.card, 0.9, 0.01, '피해');
});
ok('불사조 깃털: 한 번 더 부활(50%) · 운석 봉인', () => {
  const g = game({ relics: ['phoenix'] });
  assert.ok(!act(g, 0, { type: 'skill', skill: 'meteor' }), '운석 봉인');
  const hit = () => { g.freezeT = 0; g.eshots.push({ x: 360, y: WALL_Y + 1, vx: 0, vy: 0, kind: 'bone', dmg: g.wall.max * 5 }); step(g, DT); };
  hit();
  assert.equal(g.phase, 'play');
  near(g.wall.hp / g.wall.max, 0.5, 0.01, '50%');
  const ev = drainEvents(g);
  assert.ok(ev.some(e => e.type === 'revive' && e.relic) && ev.some(e => e.type === 'relicProc' && e.key === 'phoenix'));
  assert.equal(serializeRun(g).relicRevives, 1, '저장');
  hit();
  assert.equal(g.phase, 'defeat', '두 번째는 붕괴');
});
ok('원소 공명: 같은 원소 2칸(융합은 두 원소) → 그 원소 ×1.4 · 다른 원소 ×0.8 · 공명 없으면 그대로', () => {
  const e = { isBoss: false };
  const g = game({ relics: ['resonance'], spells: { fireball: 1, flameBullet: 1, iceLance: 1 } });
  near(relicHitMul(g, e, 'fire'), 1.4, 0.001, '화염'); near(relicHitMul(g, e, 'frost'), 0.8, 0.001, '냉기');
  const f = game({ relics: ['resonance'], spells: { blazeTornado: 1, gale: 1 }, run: { fusionParts: { blazeTornado: ['fireball', 'tornado'] } } });
  near(relicHitMul(f, e, 'wind'), 1.4, 0.001, '융합 바람 + 질풍');
  near(relicHitMul(game({ relics: ['resonance'], spells: { fireball: 1, iceLance: 1 } }), e, 'fire'), 1, 0.001, '공명 없음');
  const s = measure({ spells: { fireball: 3, flameBullet: 1 }, relics: ['resonance'] }), s0 = measure({ spells: { fireball: 3, flameBullet: 1 } });
  near(s.card / s0.card, 1.4, 0.01, '실전 화염');
});
ok('영웅의 깃발: 궁극기 → 쿨타임 스킬 즉시 준비 · 궁극기 쿨타임 ×1.5', () => {
  const a = game({ spells: { fireball: 3 }, hero: knight() }), b = game({ spells: { fireball: 3 }, hero: knight(), relics: ['banner'] });
  for (const g of [a, b]) { g.spellT.fireball = 9; assert.ok(act(g, 0, { type: 'heroUlt' })); }
  assert.equal(b.spellT.fireball, 0); assert.equal(a.spellT.fireball, 9);
  near(b.heroUnit.ultCd / a.heroUnit.ultCd, 1.5, 0.001, '쿨');
  assert.ok(drainEvents(b).some(e => e.type === 'relicProc' && e.key === 'banner'));
});
ok('도박사의 주사위: 전설 확률 ↑ · 선택지 -1', () => {
  const legend = relics => { const g = game({ relics, seed: 11 }); let L = 0, N = 0; for (let i = 0; i < 400; i++) { reofferPick(g, { starter: false }); for (const c of g.pick.cards) { N++; if (c.rarity === 'legend') L++; } } return L / N; };
  assert.ok(legend(['gambler']) > legend([]) * 1.8, '전설 ×3');
  assert.equal(cardCount(game({ relics: ['gambler'] })), cardCount(game()) - 1);
});
ok('망각의 모래시계: 망각 +2 · 새로고침 봉인', () => {
  const g = game({ stage: 10 }); g.rerollLeft = 2; clearNow(g);
  g.relicPick.cards = ['hourglass'];
  act(g, 0, { type: 'relic', index: 0 });
  assert.equal(g.forgetLeft, FORGET_PER_RUN + 2); assert.equal(g.rerollLeft, 0);
});
ok('별똥별 인장 · 빙하의 심장: 쿨타임·지속 · 반대쪽 봉인', () => {
  const m = game({ relics: ['meteorSeal'] });
  assert.ok(!act(m, 0, { type: 'skill', skill: 'freeze' }));
  assert.ok(act(m, 0, { type: 'skill', skill: 'meteor' })); near(m.players[0].cd.meteor, SKILLS.meteor.cd * 0.4, 0.001, '운석 쿨');
  const f = game({ relics: ['glacier'] });
  assert.ok(!act(f, 0, { type: 'skill', skill: 'meteor' }));
  assert.ok(act(f, 0, { type: 'skill', skill: 'freeze' }));
  near(f.players[0].cd.freeze, SKILLS.freeze.cd * 0.5, 0.001, '빙결 쿨'); near(f.freezeT, SKILLS.freeze.dur * 1.5, 0.001, '빙결 지속');
});
ok('영웅의 서약: 영웅 피해 ×1.6 · 스킬 ×0.8', () => {
  const o = { spells: { fireball: 3 }, hero: knight() };
  const a = measure(o, 15), b = measure({ ...o, hero: knight(), relics: ['oath'] }, 15);
  assert.ok(a.hero > 0, '영웅이 싸움');
  near(b.hero / a.hero, 1.6, 0.02, '영웅'); near(b.card / a.card, 0.8, 0.02, '스킬');
});
ok('메아리 반지: 연속 시전 +30%p · 스킬 ×0.85(시전당)', () => {
  near(game({ relics: ['echo'] }).players[0].stats.echo - game().players[0].stats.echo, 0.3, 0.001, '연속 시전');
  assert.equal(relicFx(['echo']).skillMul, 0.85);
});
ok('흡혈 수정: 처치마다 성벽 0.6% · 성벽 -20%', () => {
  const g = game({ relics: ['vampire'] });
  near(g.wall.max / game().wall.max, 0.8, 0.01, '성벽');
  g.wall.hp = g.wall.max / 2;
  onRelicKill(g, { share: 1 });
  near(g.wall.hp / g.wall.max, 0.506, 0.0001, '회복');
});
ok('대마법사의 지팡이: 융합 전용 시전 ×1.8 · 그 밖의 스킬 ×0.8', () => {
  near(measure({ spells: { fireball: 3 }, relics: ['archStaff'] }).card / base.card, 0.8, 0.01, '기본 스킬');
  const only = g => { g.fusionParts.plasma = ['fireball', 'lightningStrike']; refreshFusion(g); g.book = {}; }; // 융합 전용 시전만 남긴다
  const f0 = measure({ spells: { plasma: 2 }, setup: only }), f1 = measure({ spells: { plasma: 2 }, relics: ['archStaff'], setup: only });
  assert.ok(f0.card > 0);
  near(f1.card / f0.card, 1.8, 0.01, '융합 시전');
});
ok('현자의 외알 안경: 기본 주문 ×10 · 쿨타임 +25%', () => {
  near(measure({ spells: { fireball: 3 }, relics: ['sage'] }).basic / base.basic, 10, 0.01, '기본');
  near(spellCooldown(game({ spells: { fireball: 3 }, relics: ['sage'] }), 'fireball').total / spellCooldown(game({ spells: { fireball: 3 } }), 'fireball').total, 1.25, 0.001, '쿨');
});
ok('혼돈의 구슬: 층을 깨면 무작위 스킬 2개(서로 다르게) Lv+1 · 체크포인트 반영 · 만렙이면 합체', () => {
  const g = game({ relics: ['chaos'], spells: { fireball: 2, gale: 1 } });
  clearNow(g);
  assert.deepEqual([g.spells.fireball, g.spells.gale], [3, 2]);
  const ev = drainEvents(g).filter(e => e.type === 'relicProc' && e.key === 'chaos');
  assert.equal(ev.length, 2);
  assert.equal(serializeRun(g).spells.fireball, 3, '다음 층 체크포인트에 반영');
  const f = game({ relics: ['chaos'], spells: { fireball: 5, tornado: 6 } });
  clearNow(f);
  assert.ok(f.spells.blazeTornado >= 1 && !f.spells.fireball, '만렙 → 합체(두 번째 상승은 융합 스킬로 갈 수 있다)');
});
ok('20종 모두 위 훅 테스트가 있다', () => {
  assert.deepEqual(RELIC_KEYS.slice().sort(), ['archStaff', 'banner', 'chaos', 'crown', 'echo', 'gambler', 'glacier', 'glass', 'grail', 'hourglass', 'hunter', 'meteorSeal', 'miser', 'oath', 'phoenix', 'resonance', 'sage', 'thief', 'twinMoon', 'vampire']);
});

console.log('망각');
ok('카드 선택 중에만 · 도전당 2회 · 저장 · 카드를 새로 뽑음', () => {
  const g = game({ spells: { fireball: 4, tornado: 2, gale: 1 } });
  assert.equal(g.forgetLeft, FORGET_PER_RUN);
  assert.ok(!act(g, 0, { type: 'forget', spell: 'fireball' }), '카드가 없으면 불가');
  reofferPick(g, { starter: false });
  const p0 = g.pick;
  assert.ok(!act(g, 0, { type: 'forget', spell: 'iceLance' }), '없는 스킬');
  assert.ok(act(g, 0, { type: 'forget', spell: 'fireball' }));
  assert.ok(!g.spells.fireball && g.forgetLeft === 1 && g.run.forgets === 1);
  assert.notEqual(g.pick, p0, '카드 새로 뽑음');
  assert.ok(drainEvents(g).some(e => e.type === 'forget' && e.spell === 'fireball' && e.level === 4 && !e.fusion));
  for (let i = 0; i < 40; i++) { reofferPick(g, g.pick); const fb = g.pick.cards.find(c => c.spell === 'fireball'); if (fb) assert.equal(fb.level, 1, '버린 스킬은 Lv1부터'); }
  assert.ok(act(g, 0, { type: 'forget', spell: 'gale' }));
  assert.ok(!act(g, 0, { type: 'forget', spell: 'tornado' }), '2회 한도');
  const s = serializeRun(g);
  assert.equal(s.forgetLeft, 0); assert.equal(s.forgets, 2);
  assert.equal(createGame({ stage: 5, seed: 1, players: [me(), {}], run: s }).forgetLeft, 0, '이어하기도 0');
});
ok('융합을 비우면 칸이 열리고 두 재료가 다시 카드로(Lv1) · 변이 기록 삭제', () => {
  const g = game({ spells: { blazeTornado: 3, gale: 2 }, run: { fusionParts: { blazeTornado: ['fireball', 'tornado'] } } });
  g.mutations = { blazeTornado: 'x', gale: 'y' };
  assert.ok(g.book.fireball === SPELL_MAX_LV);
  reofferPick(g, { starter: false });
  assert.ok(act(g, 0, { type: 'forget', spell: 'blazeTornado' }));
  assert.equal(slotsUsed(g), 1);
  assert.deepEqual(g.fusionParts, {}); assert.ok(!g.book.fireball && !g.book.tornado && !g.fusions.length);
  assert.ok(!('blazeTornado' in (g.mutations || {})), '버린 스킬의 변이 기록 삭제');
  assert.ok(drainEvents(g).some(e => e.type === 'forget' && e.fusion));
  let seen = false;
  for (let i = 0; i < 60; i++) { reofferPick(g, g.pick); for (const c of g.pick.cards) if (c.spell === 'fireball' || c.spell === 'tornado') { seen = true; assert.equal(c.level, 1); } }
  assert.ok(seen, '재료가 다시 카드로');
});
ok('횟수: 보석 강화(fx.forgets) · 출정 준비(bonusForgets)', () => {
  assert.equal(game({ bonusForgets: 1 }).forgetLeft, FORGET_PER_RUN + 1);
  assert.equal(game({ metaLv: { forget: 1 } }).forgetLeft, FORGET_PER_RUN + (game({ metaLv: { forget: 1 } }).fx.forgets | 0));
});
ok('결과 화면 Summary: relics · forgets', () => {
  const m = defaults(); const g = newRun(m, { cls: 'knight' }, 2);
  g.relics.push('crown'); g.run.forgets = 1;
  const s = endRun(g, m);
  assert.deepEqual(s.relics, ['crown']); assert.equal(s.forgets, 1);
});

console.log('봇');
ok('pickRelic: 문맥 점수(공명 · 융합 지팡이) · 범위 안 인덱스', () => {
  const g = game({ spells: { fireball: 1, flameBullet: 1 } });
  assert.equal(pickRelic(g, ['miser', 'resonance', 'sage']), 1);
  const i = pickRelic(g, ['crown', 'grail']); assert.ok(i === 0 || i === 1);
});
ok('forgetChoice: 칸이 다 차고 8층 이상 · 짝·협공이 아닌 낮은 레벨만', () => {
  const sp = { fireball: 5, gale: 1, judgment: 3, curseMark: 2, iceLance: 4, stoneGolem: 1 };
  const g = game({ stage: 12, spells: sp });
  reofferPick(g, { starter: false });
  g.pick.cards.forEach(c => { c.fusionHint = false; });
  const k = forgetChoice(g);
  assert.ok(k && sp[k] <= 3, k);
  assert.equal(forgetChoice(game({ stage: 5, spells: sp })), null, '카드 없음');
  const low = game({ stage: 4, spells: sp }); reofferPick(low, { starter: false }); assert.equal(forgetChoice(low), null, '초반');
  const open = game({ stage: 12, spells: { fireball: 1 } }); reofferPick(open, { starter: false }); assert.equal(forgetChoice(open), null, '빈 칸');
});

console.log(`유물·망각 테스트 ${n}개 통과`);

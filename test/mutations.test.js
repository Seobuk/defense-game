// 변이(4차 1·5) 단위 테스트 + 변이 44종 효과 스모크·강도 표: node test/mutations.test.js
import assert from 'node:assert/strict';
import { DT, SPELL_MAX_LV, FUSION_BY_KEY, SPELL_SLOTS } from '../public/js/config.js';
import { createGame, step, act, drainEvents, refreshFusion, serializeRun, normalizeRun } from '../public/js/sim.js';
import { MUTATIONS, MUT_BY_KEY, MUT_KEYS, pendingMutations } from '../public/js/mutations.js';
import { pickCard } from '../public/js/bot.js';

const M = SPELL_MAX_LV;
const WALL = { awaken: { power: 0, haste: 0, ward: 999, fortune: 0 } }; // 성벽 ×81 — 오래 버틴다
const mk = (spells, extra = {}) => createGame({ stage: 12, players: [{}, {}], seed: 7, run: { ...WALL, spells, ...extra } });
// 카드 뽑기만(새로고침 경로 재사용)
function offer(g) {
  g.pick = { cards: [], autoLeft: null };
  g.rerollLeft = 1;
  assert.ok(act(g, 0, { type: 'reroll' }));
  const cards = g.pick.cards;
  g.pick = null;
  drainEvents(g);
  return cards;
}
const muts = cards => cards.filter(c => c.mutate);

// ── 1) 데이터: 기본 14 + 융합 8 = 22종 × 2 = 44 ──
assert.equal(Object.keys(MUTATIONS).length, 22);
assert.equal(MUT_KEYS.length, 44);
for (const [k, list] of Object.entries(MUTATIONS)) {
  assert.equal(list.length, 2, k);
  for (const m of list) assert.ok(m.name && m.short && m.desc && /^#[0-9a-f]{6}$/i.test(m.col), m.key);
}

// ── 2) 변이 카드는 Lv6에서만 · 스킬당 한 번 ──
{
  const g = mk({ fireball: M - 1, iceLance: 2 });
  for (let i = 0; i < 20; i++) assert.equal(muts(offer(g)).length, 0, 'Lv5엔 변이 카드 없음');
  g.spells.fireball = M;
  for (let i = 0; i < 20; i++) {
    const c = muts(offer(g));
    assert.equal(c.length, 1, 'Lv6 → 변이 카드가 한 장은 늘 나온다');
    assert.deepEqual(c[0].muts, MUTATIONS.fireball.map(m => m.key));
  }
  // 고르기: choice 1 = B 갈래
  g.pick = { cards: offer(g), autoLeft: null };
  const idx = g.pick.cards.findIndex(c => c.mutate);
  assert.ok(act(g, 0, { type: 'pick', index: idx, choice: 1 }));
  assert.equal(g.mutations.fireball, 'sunOrb');
  const ev = drainEvents(g).find(e => e.type === 'spellPick');
  assert.ok(ev && ev.mutate === 'sunOrb' && ev.level == null, 'spellPick{mutate} — MAX 연출 없음');
  for (let i = 0; i < 20; i++) assert.equal(muts(offer(g)).length, 0, '한 번 변이한 스킬은 다시 안 나온다');
  // 잘못된 갈래 → 추천 갈래(throw 없음), 봇 추천 카드도 변이를 고른다
  const g2 = mk({ judgment: M, tornado: 3 });
  g2.pick = { cards: offer(g2), autoLeft: null };
  assert.ok(g2.pick.cards[pickCard(g2)].mutate, '봇: 합체와 무관한 Lv6 스킬은 변이 먼저');
  assert.ok(act(g2, 0, { type: 'pick', index: g2.pick.cards.findIndex(c => c.mutate), choice: 7 }));
  assert.ok(MUTATIONS.judgment.some(m => m.key === g2.mutations.judgment));
  // 융합 스킬도 Lv6이면 변이
  const g3 = mk({ plasma: M }, { fusionParts: { plasma: ['fireball', 'lightningStrike'] } });
  assert.deepEqual(muts(offer(g3)).map(c => c.spell), ['plasma']);
}

// ── 3) 선택은 이어하기에 남는다 · 옛 저장·이상한 값은 조용히 버린다 ──
{
  const g = mk({ fireball: M, judgment: M, gale: 3 }); // 합체하지 않는 두 만렙
  g.mutations.fireball = 'splitFire';
  g.mutations.judgment = 'sweepRay';
  const back = createGame({ stage: 12, players: [{}, {}], seed: 8, run: JSON.parse(JSON.stringify(serializeRun(g))) });
  assert.deepEqual(back.mutations, { fireball: 'splitFire', judgment: 'sweepRay' });
  assert.deepEqual(normalizeRun({ spells: { fireball: M } }).mutations, {}, '옛 저장(변이 없음)');
  const bad = normalizeRun({ spells: { fireball: M, iceLance: 5, gale: M }, mutations: { fireball: 'glacierSpear', iceLance: 'iceFan', gale: 'windBlades', nope: 'x' } });
  assert.deepEqual(bad.mutations, { gale: 'windBlades' }, '남의 변이·Lv6 미만·없는 스킬은 버림');
  for (const raw of [null, 3, 'x', [], { mutations: 'x' }, { mutations: [1] }]) assert.doesNotThrow(() => normalizeRun(raw));
}

// ── 4) 변이한 재료가 합체하면 변이는 사라진다(융합 Lv1) ──
{
  const g = mk({ fireball: M, tornado: M - 1, gale: 2 });
  g.mutations.fireball = 'splitFire';
  g.spells.tornado = M;
  refreshFusion(g);
  assert.equal(g.spells.blazeTornado, 1);
  assert.equal(g.mutations.fireball, undefined, '합체하면 재료 변이 소멸');
  assert.deepEqual(pendingMutations(g), [], '융합 Lv1은 아직 변이 대기 아님');
}

// ── 5) 각성은 최후의 선택: 강화·변이·빈 칸이 모두 없을 때만 ──
{
  const six = ['fireball', 'lightningStrike', 'iceLance', 'tornado', 'judgment', 'curseMark'];
  const g = mk(Object.fromEntries(six.map(k => [k, M])));
  // 6칸 전부 만렙(짝 재료가 다 합쳐지지 않는 조합 — 파이어볼·낙뢰는 플라즈마 짝이라 둘 중 하나만)
  refreshFusion(g);
  for (let n = 0; n < 12 && pendingMutations(g).length; n++) {
    const c = offer(g);
    assert.ok(c.length && c.every(x => x.mutate), '만렙뿐이면 변이 카드만(각성 없음)');
    g.pick = { cards: c, autoLeft: null };
    act(g, 0, { type: 'pick', index: 0, choice: n % 2 });
    drainEvents(g);
  }
  assert.equal(pendingMutations(g).length, 0);
  const full = Object.keys(g.spells).length >= SPELL_SLOTS;
  const last = offer(g);
  if (full) assert.ok(last.length && last.every(c => c.awaken), '모두 변이 · 칸도 가득 → 이제 각성');
  else assert.ok(last.every(c => !c.awaken), '빈 칸이 남으면 새 스킬(각성 아님)');
  // 빈 칸이 있으면 각성 대신 새 스킬
  const g2 = mk({ fireball: M, iceLance: M, judgment: M }); // 3칸
  Object.assign(g2.mutations, { fireball: 'splitFire', iceLance: 'iceFan', judgment: 'sweepRay' });
  assert.ok(offer(g2).every(c => !c.awaken && !c.mutate && c.level === 1), '빈 칸 → 새 스킬 카드');
}

// ── 6) 44종 효과 스모크 + 강도 표(같은 시드 Lv6 기본 대비 내 전체 피해) ──
const CD_FU = { blazeTornado: ['fireball', 'tornado'], superconduct: ['iceLance', 'lightningStrike'], steamBurst: ['fireball', 'iceLance'],
  stormEye: ['lightningStrike', 'tornado'], twilight: ['judgment', 'curseMark'], plasma: ['fireball', 'lightningStrike'],
  ghostLegion: ['curseMark', 'babyDragon'], guardianDragon: ['judgment', 'babyDragon'] };
// helper = 처치를 내 줄 보조 스킬(Lv3 — 만렙이 아니라 합체하지 않는다). 강도 표는 보조 없이 따로 잰다
const helperFor = skill => ([skill, ...(CD_FU[skill] || [])].includes('judgment') ? 'iceLance' : 'judgment');
function trial(skill, mut, { secs = 30, stage = 8, helper = true, pw = 20 } = {}) {
  const spells = { [skill]: M, ...(helper ? { [helperFor(skill)]: 3 } : {}) }, extra = FUSION_BY_KEY[skill] ? { fusionParts: { [skill]: CD_FU[skill] } } : {};
  const g = createGame({ stage, players: [{ lv: { atk: 10 } }, {}], seed: 31, run: { awaken: { power: pw, haste: 0, ward: 999, fortune: 0 }, spells, ...extra } });
  if (mut) g.mutations[skill] = mut;
  const ev = [];
  for (let t = 0; t < secs && g.phase === 'play'; t += DT) {
    if (g.pick) { g.pick = null; g.pickQ = 0; continue; }
    if (mut === 'golemRebirth' && g.spellFx.golem && t > 3 && t < 3.02) g.spellFx.golem.hp = 0; // 부서뜨려 재조립 확인
    step(g, DT);
    ev.push(...drainEvents(g));
  }
  return { dmg: g.dmgDone[0], ev, g }; // 내 전체 피해(지속형 변이는 보조 스킬·기본 주문에 얹힌다)
}
// 대표 이벤트 이름이 변이 키와 다른 것
const ALIAS = { iceMirror: ['mirrorFlash', 'mirrorThorn'], windSpirits: ['spiritHit'], diveBomber: ['diveStart', 'diveBoom'], golemRebirth: ['golemBoom', 'golemReform'] };
const rows = [];
for (const [skill, list] of Object.entries(MUTATIONS)) {
  const base = trial(skill, null, { stage: 14, secs: 20 });
  for (const m of list) {
    const r = trial(skill, m.key, m.key === 'iceMirror' ? { stage: 45, helper: false, pw: 0 } : {}), solo = trial(skill, m.key, { stage: 14, secs: 20 });
    const seen = r.ev.some(e => e.mut === m.key || (e.type === 'mutFx' && (e.m === m.key || (ALIAS[m.key] || []).includes(e.m))));
    const fx = r.ev.filter(e => e.type === 'mutFx').map(e => e.m);
    assert.ok(seen, `${m.key}: 변이 효과(이벤트)가 한 번은 나온다`);

    rows.push(`${skill.padEnd(15)} ${m.key.padEnd(15)} ×${(solo.dmg / Math.max(1, base.dmg)).toFixed(2)}  fx:${[...new Set(fx)].join(',')}`);
  }
}
console.log('변이 강도(14층·같은 시드·20초, 보조 스킬 Lv3와 함께 — Lv6 기본 대비 내 전체 피해):\n' + rows.join('\n'));
console.log('변이 테스트 통과');

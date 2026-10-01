// 장비 v0.1.7 단위 테스트: node test/items.test.js
// 굴림(품질 · 아이템 레벨 · 부옵션 22종 · 고유 · 세트) · 전투력(클래스) · 효과 합산 · 저장 이전 · 전설 고유 31종이 실제 전투에서 뭔가 바꾸는가
import assert from 'node:assert/strict';
import { DT } from '../public/js/config.js';
import { createGame, step, drainEvents } from '../public/js/sim.js';
import { newHero, heroTb, autoEquipAll, gearBonuses, heroPower, heroTakeDamage, CAP_DUP_ATK } from '../public/js/hero.js';
import { botTalents } from '../public/js/bot.js';
import { offerRelics } from '../public/js/relics.js';
import { spellCooldown } from '../public/js/spells.js';
import { normalize } from '../public/js/save.js';
import { mulberry32 } from '../public/js/util.js';
import { resolvePick, botPlayer } from './harness.js';
import {
  rollItem, itemPower, itemLines, compareItems, isTop, statText, uniqueOn, gearFx, setProgress, migrateItem, gearCdRate, gearSpellMul,
  AFFIXES, AFFIX_BY_KEY, UNIQUES, UNIQUE_BY_KEY, SETS, SLOTS, RARITY_KEYS, TOP_Q, ITEM_VER, SET_MIN_ILVL,
} from '../public/js/items.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };
const CLS = ['knight', 'ranger', 'sorcerer', 'cleric', 'assassin'];
const blank = (slot, rarity = 'rare', extra = {}) => ({ id: 'i' + Math.random().toString(36).slice(2), v: 2, slot, rarity, ilvl: 30, name: 't',
  main: { key: { weapon: 'atkPct', helm: 'heroHpPct', armor: 'dmgReducePct', trinket: 'critDmgPct', cape: 'atkSpeedPct' }[slot], value: 10, q: 0.5 }, subs: [], unique: null, set: null, cls: null, ...extra });

ok('표 크기: 부옵션 22종 · 전설 고유 31(공용 11 + 클래스 4×5) · 영웅 고유 12 · 세트 6', () => {
  assert.equal(AFFIXES.length, 22);
  const leg = UNIQUES.filter(u => u.rarity === 'legend');
  assert.equal(leg.length, 31);
  assert.equal(leg.filter(u => !u.cls).length, 11);
  for (const c of CLS) assert.equal(leg.filter(u => u.cls === c).length, 4, c);
  assert.equal(UNIQUES.filter(u => u.rarity === 'epic').length, 12);
  assert.equal(SETS.length, 6);
  assert.equal(new Set(UNIQUES.map(u => u.key)).size, UNIQUES.length, '키 중복 없음');
  for (const u of UNIQUES) assert.ok(u.name && u.desc && u.title && u.fx && Object.keys(u.fx).length, u.key);
});

ok('굴림: v2 모양 · 품질 q 0~1 · 서로 다른 부옵션 · 전설 = 고유 늘 1개(그 클래스 풀) · 세트는 희귀·영웅만', () => {
  const rng = mulberry32(11);
  const seen = { uniqEpic: 0, epic: 0, set: 0, legend: 0 }, subKeys = new Set();
  for (let i = 0; i < 6000; i++) {
    const cls = CLS[i % 5], ilvl = 1 + (i % 100);
    const it = rollItem(ilvl, i % 3 ? 'chest' : 'boss', rng, cls);
    assert.equal(it.v, ITEM_VER);
    assert.ok(SLOTS.includes(it.slot) && RARITY_KEYS.includes(it.rarity));
    assert.equal(it.ilvl, ilvl);
    assert.equal(it.cls, cls);
    for (const s of [it.main, ...it.subs]) { assert.ok(s.q >= 0 && s.q <= 1); assert.ok(s.value > 0); }
    assert.equal(new Set(it.subs.map(s => s.key)).size, it.subs.length);
    for (const s of it.subs) { assert.ok(AFFIX_BY_KEY[s.key]); subKeys.add(s.key); }
    if (it.rarity === 'legend') {
      seen.legend++;
      const u = UNIQUE_BY_KEY[it.unique];
      assert.ok(u && u.rarity === 'legend' && (!u.cls || u.cls === cls), `전설 고유 ${it.unique}`);
      assert.ok(it.name.startsWith(u.title), it.name);
    }
    if (it.rarity === 'epic') { seen.epic++; if (it.unique) { seen.uniqEpic++; assert.equal(UNIQUE_BY_KEY[it.unique].rarity, 'epic'); } }
    if (!['legend', 'epic'].includes(it.rarity)) assert.equal(it.unique, null);
    if (it.set) { seen.set++; assert.ok(['rare', 'epic'].includes(it.rarity) && ilvl >= SET_MIN_ILVL); }
  }
  assert.equal(subKeys.size, AFFIXES.length, '부옵션 22종이 모두 나온다');
  assert.ok(seen.uniqEpic / seen.epic > 0.25 && seen.uniqEpic / seen.epic < 0.55, `영웅 고유 비율 ${seen.uniqEpic}/${seen.epic}`);
  assert.ok(seen.set > 100 && seen.legend > 300);
});

ok('아이템 레벨: 높은 층일수록 같은 등급·품질의 값이 크다', () => {
  const avgMain = ilvl => { const rng = mulberry32(3); let s = 0; for (let i = 0; i < 500; i++) { const it = rollItem(ilvl, [0, 0, 1, 0, 0], rng, 'knight'); s += it.main.value / (it.main.q + 1); } return s; };
  assert.ok(avgMain(90) > avgMain(5) * 1.5);
  // 낮은 층 드롭의 전설은 드물게(상자 가중치 배열은 그대로)
  const legends = (ilvl, src) => { const rng = mulberry32(9); let n = 0; for (let i = 0; i < 4000; i++) if (rollItem(ilvl, src, rng, 'knight').rarity === 'legend') n++; return n; };
  assert.ok(legends(2, 'boss') < legends(30, 'boss') * 0.2, '2층 보스 전설 < 30층의 20%');
  assert.equal(legends(2, [0, 0, 0, 0, 1]), 4000, '전설 상자는 낮은 층에서도 전설');
});

ok('최고 굴림 표시 · 부호 · UI 줄 · 비교', () => {
  assert.ok(isTop({ q: TOP_Q }) && !isTop({ q: TOP_Q - 0.01 }));
  assert.equal(statText({ key: 'cdFireball', value: 3.24 }), '−3.2%');
  assert.equal(statText({ key: 'fire', value: 5 }), '+5.0%');
  const it = blank('weapon', 'legend', { unique: 'emberBastion', subs: [{ key: 'fire', value: 9, q: 0.95 }] });
  const lines = itemLines(it, 'ranger');
  assert.deepEqual(lines.map(l => l.kind), ['main', 'sub', 'uniq']);
  assert.ok(lines[1].top && !lines[0].top);
  assert.ok(lines[2].off, '기사 전용 고유는 궁수에선 꺼짐');
  assert.ok(!itemLines(it, 'knight')[2].off);
  const set = itemLines(blank('helm', 'rare', { set: 'storm' }))[1];
  assert.equal(set.kind, 'set');
  const cmp = compareItems(blank('weapon', 'rare', { subs: [{ key: 'gold', value: 3 }] }), blank('weapon', 'rare', { subs: [{ key: 'boss', value: 5 }] }));
  assert.deepEqual(cmp.map(r => [r.key, r.diff]), [['atkPct', 0], ['gold', 3], ['boss', -5]]);
  assert.equal(compareItems(it, null)[0].diff, 10, '빈 칸과 비교');
});

ok('전투력: 고유 · 세트 몫, 다른 클래스 전용 고유는 cls를 주면 0 · 자동 장착은 지금 클래스 기준', () => {
  const plain = blank('weapon', 'legend'), uniq = blank('weapon', 'legend', { unique: 'stormQuiver' });
  assert.ok(itemPower(uniq) > itemPower(plain));
  assert.equal(itemPower(uniq, 'knight'), itemPower(plain), '궁수 전용 → 기사에겐 몫 없음');
  assert.ok(itemPower(uniq, 'ranger') > itemPower(plain));
  assert.ok(itemPower(blank('helm', 'rare', { set: 'ember' })) > itemPower(blank('helm', 'rare')));
  const hero = { ...newHero(), cls: 'knight' };
  const knightish = blank('weapon', 'legend', { unique: 'meteorCore', main: { key: 'atkPct', value: 9, q: 0 } });
  const rangerish = blank('weapon', 'legend', { unique: 'stormQuiver', main: { key: 'atkPct', value: 10, q: 0 } });
  hero.bag.push(knightish, rangerish);
  autoEquipAll(hero);
  assert.equal(hero.equip.weapon, knightish, '기사는 쓸 수 있는 고유를 고른다');
  assert.ok(heroPower(hero) > 0);
});

ok('효과 합산: 부옵션 → 원소·쿨타임·특성 · 고유(클래스) · 세트 2/4 · 같은 고유는 한 번 · 캐시', () => {
  const hero = { ...newHero(), cls: 'sorcerer' };
  hero.equip.weapon = blank('weapon', 'legend', { unique: 'splitFlame', subs: [{ key: 'fire', value: 10 }, { key: 'cdTornado', value: 20 }, { key: 'collab', value: 5 }] });
  hero.equip.helm = blank('helm', 'legend', { unique: 'splitFlame' });
  hero.equip.armor = blank('armor', 'rare', { set: 'ember' });
  hero.equip.trinket = blank('trinket', 'rare', { set: 'ember' });
  let f = gearFx(hero);
  assert.equal(f.tb.split, 2, '분열 화염 한 번만');
  assert.ok(Math.abs(f.el.fire - (0.1 + 0.15)) < 1e-9, '부옵션 10% + 잿불 2세트 15%');
  assert.equal(f.cd.tornado, 0.2);
  assert.equal(f.tb.collab, 0.05);
  assert.ok(!f.tb.burn, '4세트 아직');
  assert.equal(gearFx(hero), f, '장착이 그대로면 캐시');
  hero.equip.cape = blank('cape', 'epic', { set: 'ember' });
  hero.equip.helm = blank('helm', 'epic', { set: 'ember' });
  f = gearFx(hero);
  assert.ok(f.tb.burn === 0.2 && f.tb.overheat === 0.3, '잿불 4세트');
  assert.deepEqual(setProgress(hero).map(s => [s.key, s.n, s.b2.on, s.b4.on]), [['ember', 4, true, true]]);
  const tb = heroTb(hero, 'sorcerer');
  assert.ok(tb.split === 1 * 2 && tb.burn >= 0.2 && tb.collab >= 0.05, 'heroTb = 특성 + 장비');
  assert.ok(!heroTb(hero, 'knight').split, '마법사 전용 고유는 기사에게 꺼짐');
  hero.equip.weapon = blank('weapon', 'legend', { unique: 'meteorCore' });
  assert.ok(heroTb(hero, 'knight').cap.meteor, '공용 고유 궁극 특성 → 다른 클래스도');
  assert.ok(gearBonuses(hero).fire === 0 && 'cdIce' in gearBonuses(hero), 'gearBonuses에 새 부옵션 키(표시용 합계)');
  // 특성으로 이미 가진 궁극 특성 → 영웅 피해 +12%(버리는 전설 없음)
  const sor = { ...newHero(), cls: 'sorcerer', level: 99 };
  botTalents(sor, 'sorcerer');
  const caps = Object.keys(heroTb(sor, 'sorcerer').cap), U2 = UNIQUES.find(u => u.fx.cap && caps.includes(u.fx.cap) && (!u.cls || u.cls === 'sorcerer'));
  if (U2) {
    const atk0 = heroTb(sor, 'sorcerer').atk;
    sor.equip.weapon = blank('weapon', 'legend', { unique: U2.key });
    assert.ok(Math.abs(heroTb(sor, 'sorcerer').atk - atk0 - CAP_DUP_ATK) < 1e-9, `중복 궁극 특성 ${U2.fx.cap}`);
  }
});

ok('저장 이전: 옛 아이템 → v2(q 역산 · 옛 전설에 공용 고유 · 멱등) · 잠금/NEW 보존 · 잘못된 키 버림', () => {
  const old = { id: 'legacy01', slot: 'cape', rarity: 'legend', ilvl: 40, name: '옛 망토', main: { key: 'atkSpeedPct', value: 20 }, subs: [{ key: 'gold', value: 5 }, { key: 'nope', value: 3 }], lock: true, n: 1 };
  const m = migrateItem(old);
  assert.equal(m.v, 2);
  assert.ok(m.main.q >= 0 && m.main.q <= 1);
  assert.deepEqual(m.subs.map(s => s.key), ['gold']);
  const u = UNIQUE_BY_KEY[m.unique];
  assert.ok(u && u.rarity === 'legend' && !u.cls, '옛 전설 = 공용 고유');
  assert.equal(migrateItem({ ...old }).unique, m.unique, 'id로 고정');
  assert.deepEqual(migrateItem(m), m, '멱등');
  assert.ok(m.lock === 1 && m.n === 1);
  const bad = migrateItem({ ...m, unique: 'emberCharm', set: 'storm', cls: 'wizard' });
  assert.notEqual(bad.unique, 'emberCharm', '등급이 안 맞는 고유는 버림(전설 → 공용 고유로)');
  assert.equal(bad.set, null, '전설은 세트 아님');
  assert.equal(bad.cls, null);
  assert.equal(migrateItem({ ...old, rarity: 'rare' }).unique, null);
  assert.equal(migrateItem({ id: 'x', slot: 'hat' }), null);
  const d = normalize({ hero: { cls: 'knight', equip: { cape: old }, bag: [old, { junk: 1 }] } });
  assert.equal(d.hero.equip.cape.unique, m.unique);
  assert.equal(d.hero.bag.length, 1);
  assert.deepEqual(normalize(JSON.parse(JSON.stringify(d))).hero.equip.cape, d.hero.equip.cape, '저장 왕복');
});

// ── 전투: 고유 옵션이 실제로 전투를 바꾸는가 ──
const SPELLS = { fireball: 3, lightningStrike: 3, iceLance: 3, judgment: 2, tornado: 2 };
function fight(cls, unique, secs = 40, seed = 5) {
  const hero = { ...newHero(), cls, level: 45 };
  if (unique) hero.equip.trinket = blank('trinket', UNIQUE_BY_KEY[unique].rarity, { unique });
  const g = createGame({ stage: 8, best: 40, seed, players: [{ lv: { atk: 10, crit: 10 } }, {}], hero, run: { spells: { ...SPELLS }, awaken: { power: 10, haste: 0, ward: 999, fortune: 0 } } });
  botPlayer(g);
  const ev = [];
  for (let t = 0; t < secs && g.phase === 'play'; t += DT) {
    if (g.relicPick || g.path.fork) break;
    if (g.pick) { resolvePick(g, ev); continue; }
    step(g, DT);
    ev.push(...drainEvents(g));
  }
  return { g, ev, sig: `${Math.round(g.dmgDone[0])}/${Math.round(g.dmgDone[2])}/${g.progress.killed}/${ev.length}` };
}
ok('전설 고유 31종: 끼면 같은 시드 전투가 달라진다(효과가 실제 훅을 탄다)', () => {
  const base = {};
  const dead = [];
  for (const u of UNIQUES.filter(x => x.rarity === 'legend')) {
    if (u.fx.relic || ['arcaneBattery', 'ironReprisal'].includes(u.key)) continue; // 유물 후보 · 층을 넘겨 쌓이는 비전 충전 · 맞아야 터지는 반격은 아래에서 따로
    const cls = u.cls || 'knight';
    base[cls] ??= fight(cls, null).sig;
    if (fight(cls, u.key).sig === base[cls]) dead.push(u.key);
  }
  assert.deepEqual(dead, [], '효과 없는 고유');
});
ok('영웅 고유 12종도 전투를 바꾼다', () => {
  const b = fight('ranger', null).sig, dead = [];
  for (const u of UNIQUES.filter(x => x.rarity === 'epic')) if (fight('ranger', u.key).sig === b) dead.push(u.key);
  assert.deepEqual(dead, []);
});
ok('전용 훅: 망령 소환 · 궁극기 뒤 쿨타임 가속 · 도발 원소 · 유물 후보 +1 · 번개 궁극 충전', () => {
  const ghost = fight('knight', 'soulLantern', 40);
  assert.ok(ghost.ev.some(e => e.type === 'gearProc' && e.key === 'ghost'), '망령');
  const crown = fight('knight', 'thunderCrown', 40);
  assert.ok(crown.ev.some(e => e.type === 'gearProc' && e.key === 'ultBoost'), '궁극기 창');
  // 창 안: 번개 스킬만 2배, 다른 스킬은 그대로
  const g = crown.g, h = g.heroUnit;
  h.gearUltAt = g.phaseT;
  assert.equal(gearCdRate(g, 'lightningStrike'), 1.6);
  assert.equal(gearCdRate(g, 'fireball'), 1);
  h.gearUltAt = g.phaseT - 6;
  assert.equal(gearCdRate(g, 'lightningStrike'), 1, '5초 지나면 끝');
  // 쿨타임 부옵션: 쿨타임 링(spellCooldown)은 그대로, 도는 속도만
  g.hero.equip.helm = blank('helm', 'rare', { subs: [{ key: 'cdFireball', value: 20 }] });
  assert.ok(Math.abs(gearCdRate(g, 'fireball') - 1.25) < 1e-9);
  assert.ok(spellCooldown(g, 'fireball'));
  // 기사 도발 원소: 도발 중인 적만
  const k = fight('knight', 'emberBastion', 1).g;
  k._src = 'fireball';
  assert.equal(gearSpellMul(k, null, 'fire', true), 1.4);
  assert.equal(gearSpellMul(k, null, 'fire', false), 1);
  k._src = null;
  // 비전 축전: 첫 마나 지점에서 비전 충전이 쌓인다(층을 넘겨 100%면 카드)
  assert.ok(fight('knight', 'arcaneBattery').g.run.arcane > fight('knight', null).g.run.arcane);
  // 반격의 성벽: 맞으면 가시 반사(+ 25% 방패 강타)
  const rb = fight('knight', 'ironReprisal', 1).g, src = rb.enemies.find(e => !e.dead) || { x: 0, y: 0, r: 10, dead: false, hp: 1e9, maxHp: 1e9, shield: 0, reduce: 1 };
  drainEvents(rb);
  heroTakeDamage(rb, 1, { damage: () => 1, emit: (gg, ev) => rb.events.push(ev) }, src);
  assert.ok(drainEvents(rb).some(e => e.type === 'thorns'), '가시 반사');
  // 유물 후보
  const r = fight('knight', 'seekerCompass', 1).g;
  r.relicPool = ['glass', 'thief', 'miser', 'hunter', 'grail', 'crown', 'phoenix'];
  offerRelics(r);
  assert.equal(r.relicPick.cards.length, 4);
  // 뇌명 4세트: 번개 스킬 명중이 궁극기 쿨을 줄인다(0.5초에 최대 한 번)
  const s = fight('knight', null, 1).g;
  for (const sl of ['weapon', 'helm', 'armor', 'cape']) s.hero.equip[sl] = blank(sl, 'epic', { set: 'storm' });
  const hu = s.heroUnit;
  hu.ultCd = 10;
  s._src = 'lightningStrike';
  for (let i = 0; i < 400; i++) gearSpellMul(s, null, 'lightning', false);
  s._src = null;
  assert.equal(hu.ultCd, 9.5, '같은 순간 400번 맞아도 한 번');
  assert.ok(uniqueOn({ unique: 'stormQuiver' }, 'ranger') && !uniqueOn({ unique: 'stormQuiver' }, 'knight'));
});

console.log(`items.test: ${n}개 통과`);

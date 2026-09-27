// 특성 택1(4차) — 두 쪽이 '싸우는 방식'을 바꾸는지: 테이블 규칙 · 저장 이전(2 → 3) · hero.js 훅 단위 검사(가짜 게임) · 표식(sim.js spellHit)
import assert from 'node:assert/strict';
import { mulberry32 } from '../public/js/util.js';
import { WALL_Y } from '../public/js/config.js';
import { newHero, spawnHeroUnit, updateHeroUnit, heroTakeDamage, castHeroUlt, heroOnKill, heroCombatStats, HERO_GATE } from '../public/js/hero.js';
import { TALENTS, TALENT_HYBRIDS, TALENT_TAGS, TALENT_RECOMMEND, TALENT_VER, talentBonus, migrateTalents, normalizeTalents, talentNode } from '../public/js/talents.js';
import { normalize } from '../public/js/save.js';
import { createGame, step, drainEvents } from '../public/js/sim.js';

const DT = 1 / 30;

// ── 1) 테이블: 택1 30쌍 = 두 쪽 모두 분류·한 줄 요약·숫자, 서로 다른 효과 키 ──
for (const [cls, bs] of Object.entries(TALENTS)) for (const b of bs) {
  const pairs = {};
  for (const n of b.nodes) if (n.or) (pairs[n.or] ||= []).push(n);
  assert.equal(Object.keys(pairs).length, 2, `${b.key}: 택1 2쌍`);
  for (const [o, [x, y]] of Object.entries(pairs)) {
    for (const n of [x, y]) {
      assert.ok(TALENT_TAGS.includes(n.tag) && n.brief && n.brief.length <= 10 && /\d/.test(n.desc) && n.max === 2, `${n.key}: 분류·요약·숫자`);
      assert.ok(Object.keys(n.fx).length === 1, `${n.key}: 효과 하나(한 줄로 읽힌다)`);
    }
    assert.notDeepEqual(Object.keys(x.fx), Object.keys(y.fx), `${b.key}.${o}: 두 쪽 효과가 다르다`);
    assert.notEqual(x.brief, y.brief);
  }
  // 한 클래스 안에서 같은 효과 키가 두 택1 묶음에 겹치지 않는다(갈래마다 다른 결정)
}
for (const cls of Object.keys(TALENTS)) {
  const keys = TALENTS[cls].flatMap(b => b.nodes.filter(n => n.or).map(n => Object.keys(n.fx)[0]));
  assert.equal(new Set(keys).size, keys.length, `${cls}: 택1 효과 키 중복 없음`);
  for (const k of TALENT_RECOMMEND[cls].picks) assert.ok(talentNode(cls, k), `${cls} 추천 ${k}`);
}
// 혼합 노드도 순수 수치 둘 섞기(공격력+치명타 같은)가 아니다
for (const hs of Object.values(TALENT_HYBRIDS)) for (const n of hs) assert.ok(!(n.fx.atk && Object.keys(n.fx).length === 2), `${n.key}: 수치 섞기 아님`);

// ── 2) 저장 이전: 2 → 3은 바뀐 노드(X4·X5·X9·X10 · 혼합 4종)를 찍은 클래스만 환불 ──
assert.equal(TALENT_VER, 3);
assert.deepEqual(migrateTalents({ knight: { crusade1: 3 } }, 2, 30), { talents: { knight: { crusade1: 3 } }, notice: false }, '안 바뀐 노드만 = 유지');
const mg = migrateTalents({ knight: { crusade1: 3, crusade2: 3, crusade4: 1 }, ranger: { rapid1: 2 }, sorcerer: { fire1: 1 } }, 2, 30);
assert.deepEqual(mg, { talents: { ranger: { rapid1: 2 }, sorcerer: { fire1: 1 } }, notice: true }, '택1을 찍은 기사만 환불');
assert.equal(migrateTalents({ ranger: { windShot: 1 } }, 2, 99).notice, true, '바뀐 혼합 노드도 환불');
assert.deepEqual(migrateTalents({ knight: { guard1: 3 } }, undefined, 30), { talents: {}, notice: true }, '버전 없음 = 전부 환불(그대로)');
const sv = normalize({ v: 3, hero: { cls: 'knight', level: 30, talentVer: 2, talents: { knight: { guard1: 3, guard2: 3, guard5: 2 }, cleric: { heal1: 2 } } } }).hero;
assert.deepEqual(sv.talents, { cleric: { heal1: 2 } });
assert.ok(sv.talentVer === 3 && sv.talentNotice, 'save.js: 개편 안내(talentNotice) 재사용');
assert.deepEqual(normalizeTalents(sv.talents, 30), sv.talents);

// ── 3) hero.js 훅(가짜 게임 — 적·성벽·마법사 스탯만) ──
const api = {
  damage: (g, e, d) => { if (e.dead) return 0; const x = Math.min(e.hp, d); e.hp -= d; if (e.hp <= 0) { e.dead = true; heroOnKill(g, e, api, 2); } return x; },
  emit: (g, ev) => g.ev.push(ev), chainArc() {}, collabProc() {}, spellHit() {}, killEnemy() {},
};
let nid = 1;
const foe = (x, y, o = {}) => ({ id: nid++, type: 'goblin', x, y, r: 14, hp: 1e6, maxHp: 1e6, shield: 0, burn: 0, burnT: 0, slowT: 0, stunT: 0, poison: 0, poisonT: 0, dead: false, isBoss: false, named: false, ...o });
function mock(cls, fx, enemies) {
  const hero = { ...newHero(), cls, level: 60 };
  const g = {
    hero, enemies, summons: [], wall: { hp: 5000, max: 10000 }, players: [{ stats: { dmg: 40, crit: 0, critMult: 2 }, gold: 0 }],
    book: {}, fusions: [], spells: {}, collabs: [], phaseT: 0, heroRng: mulberry32(1), nextId: 1000, stage: 5, fx: { xpMul: 1 }, spellT: {}, ev: [],
  };
  g.heroUnit = spawnHeroUnit(hero);
  g.heroUnit.tb = { ...talentBonus(hero, cls), ...fx };
  g.heroUnit.tbT = 1e9; // 특성 합산을 다시 하지 않게(수치를 직접 준다)
  return g;
}
const run = (g, secs) => { for (let t = 0; t < secs; t += DT) { g.phaseT += DT; updateHeroUnit(g, DT, api); } return g; };
const tgtAfter = (cls, fx, es) => { const g = mock(cls, fx, es); run(g, DT); return g.heroUnit.tgtE; };
const proc = (g, sub) => g.ev.filter(e => e.type === 'heroProc' && (e.sub === sub || e.kind === sub)).length;

// 표적: 보스 우선 · 성벽 앞 우선 · 약한 적 우선 · 표적 고정
{
  const near = () => foe(HERO_GATE.x, 880), boss = () => foe(360, 450, { isBoss: true });
  let a = near(), b = boss();
  assert.equal(tgtAfter('knight', {}, [a, b]), a, '기본: 가까운 적');
  a = near(); b = boss();
  assert.equal(tgtAfter('knight', { hunt: 0.1 }, [a, b]), b, 'hunt: 보스 우선');
  a = foe(HERO_GATE.x, 750); b = foe(60, 900);
  assert.equal(tgtAfter('ranger', {}, [a, b]), a);
  a = foe(HERO_GATE.x, 750); b = foe(60, 900);
  assert.equal(tgtAfter('ranger', { guardWall: 0.1 }, [a, b]), b, 'guardWall: 성벽 앞 우선');
  a = foe(HERO_GATE.x, 850); b = foe(400, 800, { hp: 2e5 });
  assert.equal(tgtAfter('assassin', {}, [a, b]), a);
  a = foe(HERO_GATE.x, 850); b = foe(400, 800, { hp: 2e5 });
  assert.equal(tgtAfter('assassin', { cull: 0.12 }, [a, b]), b, 'cull: 약한 적 우선');
  const g = mock('ranger', { focus: 0.04 }, [a = foe(HERO_GATE.x, 850), b = foe(200, 600)]);
  g.heroUnit.tgtE = b;
  run(g, DT);
  assert.equal(g.heroUnit.tgtE, b, 'focus: 지금 표적을 잘 안 바꾼다');
}
// 위치: 진지 사수(선 밖은 안 쫓음) · 성전 돌격 · 근접 속사 · 냉기 오라
{
  const g = run(mock('knight', { hold: 0.08 }, [foe(360, 500)]), 3);
  assert.ok(g.heroUnit.y >= WALL_Y - 240 && !g.heroUnit.tgtE, 'hold: 성벽 앞 240 밖으로 안 나간다');
  const g0 = run(mock('knight', {}, [foe(360, 500)]), 3);
  assert.ok(g0.heroUnit.y < WALL_Y - 240, '없으면 쫓아 나간다');
  assert.ok(heroCombatStats(g, g.hero, g.heroUnit.tb).dmgReduce >= 0.08 && heroCombatStats(g, g.hero, g.heroUnit.tb).engageR === heroCombatStats(g0, g0.hero, g0.heroUnit.tb).engageR + 16);
  const e = foe(360, 600), gc = run(mock('knight', { charge: 0.8 }, [e]), 2);
  assert.ok(proc(gc, 'charge') === 1 && e.stunT > 0 && e.hp < e.maxHp, 'charge: 돌진 착지 피해 + 기절');
  const pb = (() => { const t = foe(360, 560), g2 = run(mock('ranger', { pointBlank: 0.1 }, [t]), 3); return Math.hypot(g2.heroUnit.x - t.x, g2.heroUnit.y - t.y); })();
  const kite = (() => { const t = foe(360, 560), g2 = run(mock('ranger', {}, [t]), 3); return Math.hypot(g2.heroUnit.x - t.x, g2.heroUnit.y - t.y); })();
  assert.ok(pb <= 215 && kite > 300, `pointBlank: 붙어서 쏜다 (${pb.toFixed(0)} vs ${kite.toFixed(0)})`);
  const c1 = foe(HERO_GATE.x + 40, HERO_GATE.y - 20), c2 = foe(100, 500), ga = run(mock('sorcerer', { chillAura: 70 }, [c1, c2]), DT);
  assert.ok(c1.slowT > 0 && !(c2.slowT > 0) && proc(ga, 'chill') === 1, 'chillAura: 주변만 둔화 + 파동');
}
// 발동: 3타 강타 · 휩쓸기 · 도탄 · 분열 화염 · 처치 폭발 · 회피 반격
{
  const t = foe(HERO_GATE.x, 890), g = run(mock('knight', { heavy: 0.25 }, [t]), 4);
  assert.ok(proc(g, 'heavy') >= 1 && t.stunT > 0, 'heavy: 3타마다 기절');
  const hits = (cls, fx) => { const a = foe(HERO_GATE.x, 890), b = foe(HERO_GATE.x + 40, 890); run(mock(cls, fx, [a, b]), 2); return b.maxHp - b.hp; };
  assert.ok(hits('knight', { cleave: 0.15 }) > 0 && hits('knight', {}) === 0, 'cleave: 옆 적도 맞는다');
  const bb = foe(360, 640), gb = run(mock('ranger', { bounce: 1 }, [foe(360, 560), bb]), 2);
  assert.ok(proc(gb, 'bolt') > 0 && bb.hp < bb.maxHp, 'bounce: 근처 적에게 튄다');
  const sp = foe(470, 520), gs = run(mock('sorcerer', { split: 1 }, [foe(360, 560), sp]), 3);
  assert.ok(proc(gs, 'bolt') > 0 && sp.hp < sp.maxHp, 'split: 갈래 화염');
  const weak = foe(HERO_GATE.x, 890, { hp: 1 }), nb = foe(HERO_GATE.x + 50, 890), gk = run(mock('cleric', { corpse: 0.5 }, [weak, nb]), 2);
  assert.ok(weak.dead && proc(gk, 'corpse') >= 1 && nb.hp < nb.maxHp, 'corpse: 처치 폭발');
  const src = foe(HERO_GATE.x, 900), ge = mock('assassin', { evade: 1 }, [src]);
  run(ge, DT);
  const hp0 = ge.heroUnit.hp;
  heroTakeDamage(ge, 999, api, src);
  assert.ok(ge.heroUnit.hp === hp0 && src.hp < src.maxHp && proc(ge, 'evade') === 1, 'evade: 피하고 반격');
}
// 자원: 때리면 궁극기 · 처치 → 마법사 스킬 가속 · 그림자 도약 · 생명 흡수(버티기) · 위기에 강함
{
  const g = mock('knight', { ultCharge: 0.12 }, [foe(HERO_GATE.x, 890)]);
  g.heroUnit.ultCd = 20;
  run(g, 3);
  const g0 = mock('knight', {}, [foe(HERO_GATE.x, 890)]);
  g0.heroUnit.ultCd = 20;
  run(g0, 3);
  assert.ok(g.heroUnit.ultCd < g0.heroUnit.ultCd - 0.2, 'ultCharge: 공격마다 궁극기 대기 감소');
  const gs = mock('assassin', { soulFeed: 0.2, killBlink: 1 }, [foe(HERO_GATE.x, 890, { hp: 1 })]);
  gs.spellT = { meteor: 10 };
  run(gs, 1);
  assert.ok(gs.spellT.meteor <= 9.8 + 1e-9, 'soulFeed: 처치 → 마법사 스킬 대기 감소');
  assert.ok(gs.heroUnit.hop === true && gs.heroUnit.blinkT <= 0, 'killBlink: 처치 후 곧장 도약 준비');
  const low = fx => { const gl = mock('cleric', fx, [foe(HERO_GATE.x, 890)]); run(gl, DT); gl.heroUnit.hp = gl.heroUnit.maxHp * 0.2; run(gl, DT); return gl.heroUnit.mode; };
  assert.equal(low({}), 'retreat');
  assert.notEqual(low({ lifesteal: 0.01 }), 'retreat', 'lifesteal: 15%까지 버틴다');
  assert.notEqual(low({ berserk: 0.15 }), 'retreat', 'berserk: 15%까지 버틴다');
}
// 협동: 표식(주 표적) · 끌어모으기 · 축복의 함성 · 늑대 소집
{
  const t = foe(HERO_GATE.x, 890), g = run(mock('knight', { mark: 0.06 }, [t]), 2);
  assert.ok(t.markAt > g.phaseT, 'mark: 때린 적 표식');
  const c = foe(360, 700), side = foe(500, 700), gp = mock('sorcerer', { pull: 0.3 }, [c, side]);
  gp.heroUnit.tgtE = c;
  run(gp, 3.1);
  assert.ok(side.x < 500 - 30 && proc(gp, 'pull') === 1, 'pull: 표적 쪽으로 끌려온다');
  const gu = mock('cleric', { ultBless: 0.12 }, []);
  run(gu, DT);
  assert.ok(castHeroUlt(gu, api) && gu.heroBuff && Math.abs(gu.heroBuff.mul - 1.12) < 1e-9, 'ultBless: 궁극기 → 5초 피해 버프');
  const gw = mock('ranger', { wolf: 1, wolfUlt: 1 }, [foe(360, 600)]);
  run(gw, 0.3);
  assert.equal(gw.summons.length, 1);
  castHeroUlt(gw, api);
  run(gw, 0.3);
  assert.equal(gw.summons.length, 2, 'wolfUlt: 궁극기 뒤 늑대 +1');
  run(gw, 8.5);
  assert.equal(gw.summons.length, 1, '8초 뒤 돌아간다');
}
// 늑대 표적: 사냥 늑대(영웅 표적) · 호위 늑대(성벽에 가장 가까운 적) · 목덜미 물기(기절)
{
  const wolfTgt = fx => { const top = foe(200, 500), wall = foe(620, 900), g = mock('ranger', { wolf: 1, ...fx }, [top, wall]); g.heroUnit.x = 200; g.heroUnit.y = 560; g.heroUnit.tgtE = top; g.heroUnit.retargetT = 9; run(g, 0.5); return [g.summons[0].tgtE, top, wall]; };
  let [w, top, wall] = wolfTgt({ wolfFocus: 0.15 });
  assert.equal(w, top, 'wolfFocus: 영웅 표적');
  [w, top, wall] = wolfTgt({ wolfGuard: 0.15 });
  assert.equal(w, wall, 'wolfGuard: 성벽 앞 적');
  const bit = foe(HERO_GATE.x, 890), gs = mock('ranger', { wolf: 1, wolfStun: 1 }, [bit]);
  run(gs, 3);
  assert.ok(bit.stunT > 0, 'wolfStun: 물면 기절');
}
// 바람 사수(혼합 longshot): 사거리 + 먼 적 피해
{
  const g = mock('ranger', { longshot: 0.12 }, []), g0 = mock('ranger', {}, []);
  assert.ok(heroCombatStats(g, g.hero, g.heroUnit.tb).range > heroCombatStats(g0, g0.hero, g0.heroUnit.tb).range * 1.05);
}

// ── 4) 표식은 마법사 주문 피해를 실제로 올린다(sim.js spellHit) — 영웅을 재워 두고 한 적만 표식 ──
{
  const mageDmgOn = mark => {
    const g = createGame({ stage: 3, seed: 7, best: 10, players: [{}, {}], hero: { ...newHero(), cls: 'knight', level: 30 } });
    let e = null;
    for (let t = 0; t < 20 && !e; t += DT) { step(g, DT); e = g.enemies.find(q => !q.dead && q.y > 300); }
    assert.ok(e, '적이 나온다');
    e.hp = e.maxHp = 1e9;
    e.markAt = 1e9;
    const h = g.heroUnit;
    h.state = 'down'; h.respawnT = 1e9;
    h.tb = { ...h.tb, mark }; h.tbT = 1e9;
    drainEvents(g);
    let sum = 0;
    for (let t = 0; t < 6; t += DT) {
      step(g, DT);
      for (const ev of drainEvents(g)) if (ev.type === 'hit' && ev.o !== 2 && Math.abs(ev.x - e.x) < 1 && Math.abs(ev.y - e.y) < 1) sum += ev.dmg;
    }
    return sum;
  };
  const on = mageDmgOn(1), off = mageDmgOn(0);
  assert.ok(off > 0 && on > off * 1.6, `mark: 표식 적 마법사 피해 ${off.toFixed(0)} → ${on.toFixed(0)}`);
}
console.log('talents.test OK (택1 30쌍 · 이전 2→3 · 훅 27종)');

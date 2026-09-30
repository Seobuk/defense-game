// 헤드리스 스모크 + 로그라이트 캠페인 밸런스 러너: node test/sim.test.js [--full] [--seed=N] [--unit]
//   기본: 단위 테스트 + 캠페인 1회(시드 1) + 클래스 동등성(추천 특성, 최고 50층 시점) + 협공 강도
//   --full: 캠페인 3시드 + 동등성 50·80층 + 무작위 특성 동등성
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { fmt, mulberry32 } from '../public/js/util.js';
import {
  DT, cannonStats, floorPower, CRIT_MULT, SOLO_MAGE, PICK_AUTO_T, BASIC_SPELLS, SKILLS, SPELL_KEYS, FUSIONS, FUSION_KEYS, FUSION_BY_KEY, SPELL_SLOTS, SPELL_MAX_LV,
  AWAKEN_KEYS, META_KEYS, metaCost, metaMax, metaFx, RUN_GEMS, MAX_STAGE, TRAIN_KEYS, MAGE_TRAINING, trainCost, trainMax, trainDisplay,
  goldPerKill, EARLY_FLOORS, START_CARDS, COLLABS, COLLAB_KEYS, COLLAB_FX, SYNERGIES, SKILL_BY_KEY, CODEX_SYN, codexFound,
} from '../public/js/config.js';
import { createGame, startStage, step, act, drainEvents, setPlayer, tickPick, refreshFusion, serializeRun, normalizeRun, cardCount, slotsUsed, collabSlots, reofferPick, STARTER } from '../public/js/sim.js';
import { pickCard, botSpendGems, botSpendGold, botLoadout, botTalents, randomTalents, TALENT_BUILDS, ultWorth, autoHero } from '../public/js/bot.js';
import { newRun, restoreRun, endRun, buyMeta, buyTraining, validLoadout, startSpellChoices, campAct, applyOffline } from '../public/js/run.js';
import { defaults } from '../public/js/save.js';
import { spellCooldown } from '../public/js/spells.js';
import { MUTATIONS } from '../public/js/mutations.js'; // 4차 변이: 각성은 만렙 + 변이까지 끝난 뒤
import { campaign, playRun, playStage, resolvePick, earlyPacing, humanPlayer, HERO_CLASS_KEYS as CLASS_KEYS } from './harness.js';
import {
  newHero, HERO_CLASSES, HERO_CLASS_KEYS, unlockedClasses, xpToNext, heroTier, hasMilestone, MILESTONES,
  rollItem, itemPower, heroPower, sellValue, equipItem, sellItem, sellItemsByRarity, autoEquipAll, addToBag,
  BAG_SIZE, SLOTS, RARITIES, SUBSTATS, heroTakeDamage, heroGainXp, heroCombatStats, HERO_GATE, HERO_RALLY, MAX_HERO_LV,
} from '../public/js/hero.js';
import {
  TALENTS, TALENT_FX_KEYS, CAPSTONES, talentPoints, canAllocate, allocateTalent, resetTalents, talentBonus, talentSpent,
  talentMaxRanks, talentLeft, talentNode, normalizeTalents, branchSpent, branchMax, talentBlock, talentCap, nextTierNeed, talentRank,
  TALENT_HYBRIDS, migrateTalents, TALENT_VER,
} from '../public/js/talents.js';

const FULL = process.argv.includes('--full');
const seedArg = process.argv.find(a => a.startsWith('--seed='));
const SEED = seedArg ? +seedArg.slice(7) : 1;
const lv0 = () => ({ atk: 0, rate: 0, crit: 0, multi: 0, wall: 0 });
const bot = name => ({ name, kind: 'bot', gold: 0, lv: lv0(), auto: true });
const TR_MAX = Object.fromEntries(TRAIN_KEYS.map(k => [k, trainMax(k)])); // 마법사 수련 전부 최대
// 수련은 상한이 낮으므로, 테스트에서 강한 마법사·튼튼한 성벽은 런 배율(각성 누적)로 만든다: power 1 = 마력 +5%, ward 1 = 성벽 +8%
const buff = (power = 0, ward = 0, extra = {}) => ({ awaken: { power, haste: 0, ward, fortune: 0 }, ...extra });
const WALL = buff(0, 999); // 성벽 ×81 — 적이 쌓여도 버틴다

// 페이즈가 바뀌거나 시간 초과까지 진행, 이벤트 수집
function runUntilEnd(g, maxT = 600, collect = null) {
  for (let t = 0; t < maxT && g.phase === 'play'; t += DT) {
    if (g.relicPick) { act(g, 0, { type: 'relic', index: 0 }); continue; } // 4차 유물: 보스 층 클리어 뒤 유물 후보(전투 정지)
    if (g.pick) { resolvePick(g, collect); continue; }
    step(g, DT);
    const ev = drainEvents(g);
    if (collect) collect.push(...ev);
  }
}

// ── 1) 스모크 ──
function smoke() {
  assert.equal(fmt(0), '0');
  // 도감(솔로): 협동 전용 4종은 목록·분모에서 뺀다(발견 불가라 100% 불가능하던 문제)
  assert.equal(CODEX_SYN.length, SYNERGIES.length - 4);
  assert.ok(!CODEX_SYN.some(s => s.kind === 'duo') && CODEX_SYN.some(s => s.kind === 'fusion') && CODEX_SYN.some(s => s.kind === 'collab'));
  assert.equal(codexFound(['flame', 'twin', 'plasma']), 2);
  assert.equal(fmt(999), '999');
  assert.equal(fmt(999.9), '999');
  assert.equal(fmt(1000), '1.00K');
  assert.equal(fmt(1234), '1.23K');
  assert.equal(fmt(12345), '12.3K');
  assert.equal(fmt(123456), '123K');
  assert.equal(fmt(1.5e6), '1.50M');
  assert.equal(fmt(2e9), '2.00B');
  assert.equal(fmt(3e12), '3.00T');
  assert.equal(fmt(1e15), '1.00Qa');
  assert.equal(fmt(1e18), '1.00Qi');
  assert.equal(fmt(1e36), '1.00aa');
  assert.equal(fmt(-1500), '-1.50K');
  assert.equal(fmt(NaN), '0');
  assert.ok(/^[\d.]+[a-z]{2}$/.test(fmt(1e300)), fmt(1e300));

  // 생성/스텝
  const g = createGame({ stage: 1, players: [bot('P1'), bot('P2')], seed: 1 });
  assert.equal(g.phase, 'play');
  assert.ok(g.wall.hp > 0 && g.wall.hp === g.wall.max);
  for (let k = 0; k < 600; k++) step(g, DT);
  assert.ok(g.enemies.length > 0 || g.progress.killed > 0, '적 스폰');
  const evs = drainEvents(g);
  assert.ok(evs.some(e => e.type === 'shoot' && Array.isArray(e.angles)));
  assert.equal(g.events.length, 0);

  // 도전 중 골드 강화는 없다(마법사 수련은 정비 화면): 'upgrade' 액션은 항상 실패, 골드도 그대로
  const h = createGame({ stage: 1, players: [{ name: 'A', gold: 1000 }, { name: 'B' }], seed: 2 });
  for (const stat of TRAIN_KEYS) assert.ok(!act(h, 0, { type: 'upgrade', stat }), `도전 중 ${stat} 강화 없음`);
  assert.equal(h.players[0].gold, 1000);
  assert.deepEqual(h.players[0].lv, lv0());
  // players[i].lv = 마법사 수련 레벨(상한으로 자름) → 스탯: 마력 = 층 공명 × (1 + 4%/레벨)
  const m = createGame({ stage: 7, players: [{ lv: { atk: 999, multi: 9, crit: -2 } }, { lv: { wall: 3 } }], seed: 3 });
  assert.deepEqual(m.players[0].lv, { atk: trainMax('atk'), rate: 0, crit: 0, multi: trainMax('multi'), wall: 0 });
  assert.ok(Math.abs(m.players[0].stats.dmg - floorPower(7) * (1 + 0.04 * trainMax('atk'))) < 1e-6, '층 공명 × 마력 수련');
  assert.ok(Math.abs(m.players[1].stats.dmg - floorPower(7)) < 1e-6);
  assert.ok(floorPower(30) > floorPower(10) * 100, '마력은 층을 오르며 자연히 오른다');
  assert.equal(m.players[0].stats.shots, 5);
  assert.ok(act(m, 0, { type: 'auto', on: true }) && m.players[0].auto);

  // 운석: 잡몹 전멸 + 골드, 쿨타임
  const mg = createGame({ stage: 5, players: [{}, {}], seed: 4 });
  for (let k = 0; k < 60 * 20; k++) step(mg, DT);
  const alive = mg.enemies.length, gold0 = mg.players[0].gold, sleep0 = mg.players[1].gold, killed0 = mg.progress.killed;
  assert.ok(alive > 0);
  assert.ok(act(mg, 0, { type: 'skill', skill: 'meteor' }));
  assert.ok(mg.enemies.every(e => e.dead));
  assert.equal(mg.progress.killed, killed0 + alive);
  assert.ok(mg.players[0].gold > gold0 && mg.players[1].gold === sleep0, '운석 처치 골드는 나만(솔로: 잠든 협동 자리는 안 받는다)');
  while (mg.pick) resolvePick(mg); // 대량 처치로 마나가 찼을 수 있음 — 다른 조작 전에 해소
  assert.ok(!act(mg, 0, { type: 'skill', skill: 'meteor' }), '쿨타임');
  assert.equal(mg.players[0].cd.meteor, SKILLS.meteor.cd);
  assert.ok(act(mg, 0, { type: 'skill', skill: 'freeze' }) && mg.freezeT > 0);
  step(mg, DT);
  assert.ok(mg.enemies.every(e => e.frozen || e.dead));

  // 클리어: 결과 + 이벤트
  const strong = { lv: TR_MAX };
  const cg = createGame({ stage: 10, players: [strong, strong], seed: 5, run: buff(150, 20) });
  const cev = [];
  runUntilEnd(cg, 600, cev);
  assert.equal(cg.phase, 'clear');
  assert.ok(cg.result && cg.result.stars >= 1 && cg.result.gems[0] > 0 && cg.result.firstClear === true);
  assert.ok(cev.some(e => e.type === 'clear' && e.stage === 10));
  assert.ok(cev.some(e => e.type === 'bossSpawn' && e.named));
  assert.equal(cg.progress.killed, cg.progress.total);
  step(cg, DT); // 클리어 후엔 전투 정지
  assert.equal(cg.phase, 'clear');
  startStage(cg, 10);
  runUntilEnd(cg);
  assert.equal(cg.result.firstClear, false, '재클리어는 첫 클리어 아님');

  // 패배: 성벽 붕괴
  const dg = createGame({ stage: 40, players: [{}, {}], seed: 6 });
  const dev = [];
  runUntilEnd(dg, 600, dev);
  assert.equal(dg.phase, 'defeat');
  assert.equal(dg.wall.hp, 0);
  assert.ok(dev.some(e => e.type === 'defeat' && e.stage === 40));
  assert.ok(dev.some(e => e.type === 'runOver' && e.stage === 40 && e.victory === false), '성벽 붕괴 = 도전 종료');
  assert.ok(dg.run.over && !dg.run.victory);
  assert.equal(dg.result, null);

  // 슬롯 교체(협동 모드 자리 — 솔로 게임은 늘 1인)
  const sg = createGame({ players: [bot('P1'), bot('AI')], seed: 7, coop: true });
  setPlayer(sg, 1, { name: '친구', kind: 'remote', gold: 50, lv: { wall: 3 } });
  assert.equal(sg.players[1].name, '친구');
  assert.equal(sg.players[1].kind, 'remote');
  assert.equal(sg.players[1].gold, 50);
  assert.ok(sg.wall.max > g.wall.max);
  setPlayer(sg, 1, { name: 'x', kind: 'hacker', gold: -5, lv: { atk: 'a' } });
  assert.equal(sg.players[1].kind, 'human');
  assert.equal(sg.players[1].gold, 0);
  assert.equal(sg.players[1].lv.atk, 0);
  console.log('스모크 통과');
}

// ── 1b) 중독성 레이어 스모크 ──
function run(g, secs, evs = null) {
  for (let t = 0; t < secs && g.phase === 'play'; t += DT) {
    if (g.pick) { resolvePick(g, evs); continue; }
    step(g, DT);
    const ev = drainEvents(g);
    if (evs) evs.push(...ev);
  }
}
const of = (evs, type) => evs.filter(e => e.type === type);
// 대포가 약하고 성벽만 튼튼 → 적이 쌓임
const crowd = (stage, secs, extra = {}) => {
  const g = createGame({ stage, players: [{}, {}], seed: 11, run: WALL, ...extra });
  run(g, secs);
  return g;
};

function addiction() {
  // 콤보 단계 + 골드 배율, 광란
  const g = crowd(39, 55);
  const n = g.enemies.length;
  assert.ok(n >= 30, `적 누적 ${n}`);
  const base = g.enemies.map(e => e.gold);
  drainEvents(g);
  assert.ok(act(g, 0, { type: 'skill', skill: 'meteor' }));
  const ev = drainEvents(g);
  const kills = of(ev, 'kill');
  assert.equal(kills.length, n);
  const mult = k => (k >= 50 ? 1.5 : k >= 30 ? 1.25 : k >= 10 ? 1.1 : 1); // k = 이번 처치까지 콤보 수
  kills.forEach((e, k) => assert.equal(e.gold, Math.ceil(base[k] * mult(k + 1)), `처치 ${k + 1} 골드`));
  assert.deepEqual(of(ev, 'combo').map(e => [e.count, e.tier, e.label]), [[10, 1, '좋아!'], [30, 2, '대단해!'], [50, 3, '광란!']].filter(c => c[0] <= n));
  assert.equal(g.combo.count, n);
  assert.equal(g.combo.best, n);
  assert.equal(of(ev, 'frenzy').length, 1, '2초 안 20킬 → 광란');
  assert.equal(g.frenzyT, 5);
  assert.ok(ev.some(e => e.type === 'synergy' && e.key === 'frenzy' && e.first && e.o === -1));
  assert.ok(ev.some(e => e.type === 'hitstop' && e.ms === 200), '운석 히트스톱');
  assert.ok(ev.some(e => e.type === 'hitstop' && e.ms === 350), '첫 발견 히트스톱');
  // 콤보 끊김: 위험 구역에 적이 있는데 1.5초 동안 처치 없음
  const cev = [];
  run(g, 25, cev);
  assert.ok(of(cev, 'comboEnd').some(e => e.count >= n), '콤보 끝 이벤트');
  // 전설: 콤보 100 → 골드 2배 10초
  const lg = crowd(25, 30);
  lg.combo.count = 99; lg.combo.tier = 3; lg.combo.timer = 1;
  const lgold = lg.enemies[0].gold;
  drainEvents(lg);
  act(lg, 0, { type: 'skill', skill: 'meteor' });
  const lev = drainEvents(lg);
  assert.ok(lev.some(e => e.type === 'combo' && e.tier === 4 && e.label === '전설!' && e.count === 100));
  assert.ok(lev.some(e => e.type === 'synergy' && e.key === 'legend'));
  assert.equal(lg.legendT, 10);
  assert.equal(of(lev, 'kill')[1].gold, Math.ceil(lg.enemies[1].gold * 2 * 2), '전설 단계 2배 × 전설 2배');
  assert.ok(lgold > 0);

  // 광란: 기본 주문 시전 속도 2배
  const fr = createGame({ stage: 25, players: [{ lv: { rate: 15 } }, {}], seed: 11, run: WALL });
  run(fr, 20);
  const shots = () => { const e = []; run(fr, 5, e); return e.filter(x => x.type === 'shoot' && x.o === 0).length; };
  const normal = shots();
  fr.frenzyT = 5;
  const fast = shots();
  assert.ok(normal >= 7 && normal <= 10 && fast >= normal * 1.8, `광란 발사 ${normal} → ${fast}`);

  // 마법사 조합: 수련 레벨로 켜짐, 첫 발견 1회만
  const LV = {
    flame: { atk: 20, multi: 2, crit: 8 },
    pierce: { atk: 15, multi: 0 },
    chain: { atk: 20, crit: 12, rate: 10, multi: 1 },
    homing: { atk: 20, multi: 5 },
    thorns: { atk: 5, wall: 15, multi: 1 },
    giant: { atk: 20, crit: 20, multi: 1 },
  };
  for (const [key, lv] of Object.entries(LV)) {
    const sg = createGame({ stage: key === 'giant' ? 5 : 12, players: [{ lv }, {}], seed: 3, run: buff(key === 'giant' ? 80 : 0, 999) });
    const sev = drainEvents(sg);
    assert.ok(sg.players[0].syn.includes(key), `${key} 활성`);
    assert.ok(sev.some(e => e.type === 'synergy' && e.key === key && e.o === 0 && e.first), `${key} 발견 이벤트`);
    assert.ok(sg.discovered.has(key));
    const rev = [];
    let pierced = false, homed = false, burned = false;
    const mods = new Set();
    for (let t = 0; t < 90 && sg.phase === 'play'; t += DT) {
      if (sg.pick) { resolvePick(sg, rev); continue; }
      step(sg, DT);
      rev.push(...drainEvents(sg));
      pierced ||= sg.bullets.some(b => b.owner === 0 && b.hit.length >= 2);
      homed ||= sg.bullets.some(b => b.tgt && typeof b.tgt === 'object');
      burned ||= sg.enemies.some(e => e.burnT > 0);
      for (const b of sg.bullets) if (b.owner === 0) mods.add(b.syn);
      const boss = key === 'giant' && sg.enemies.find(e => e.isBoss && !e.tough);
      if (boss) Object.assign(boss, { tough: true, hp: 1e15, maxHp: 1e15 }); // 거인 사냥꾼: 엘리트가 오래 버티며 기본 주문 치명타를 맞게
      if (key === 'giant' && sg.enemies.some(e => e.tough) && sg.phaseT > 80) break;
    }
    const kinds = new Set(of(rev, 'hit').filter(e => e.o === 0).map(e => e.kind));
    assert.deepEqual([...kinds], ['fireball'], `${key}: P1 기본 주문 = 화염구`);
    if (key === 'flame') assert.ok(burned && mods.has('flame') && of(rev, 'shards').some(e => e.o === 0 && e.pts.length > 0), '화상 + 화염구 파편');
    if (key === 'pierce') assert.ok(pierced && mods.has('pierce'), '관통');
    if (key === 'chain') assert.ok(of(rev, 'chain').some(e => e.o === 0 && e.pts.length >= 2), '체인');
    if (key === 'homing') assert.ok(homed && mods.has('homing'), '유도');
    if (key === 'thorns') assert.ok(of(rev, 'thorns').length > 0, '가시 반사');
    if (key === 'giant') {
      const d = sg.players[0].stats.dmg;
      assert.ok(of(rev, 'hit').some(e => e.o === 0 && e.dmg > d * BASIC_SPELLS[0].dmg * CRIT_MULT * 1.9), '거인 사냥꾼: 보스 치명타 피해 2배');
    }
    assert.ok(of(rev, 'hit').every(e => typeof e.big === 'boolean' && typeof e.kind === 'string'));
  }
  // 이미 발견한 조합은 first:false, 새로 발견은 true, 꺼졌다 다시 켜지면 false
  const dg = createGame({ stage: 1, players: [{ gold: 1e12, lv: { atk: 20, multi: 2, crit: 10 } }, {}], discovered: ['flame', 'bogus'], seed: 4 });
  const dev = drainEvents(dg);
  assert.ok(dev.some(e => e.type === 'synergy' && e.key === 'flame' && !e.first));
  assert.ok(!dev.some(e => e.type === 'hitstop'));
  assert.ok(!dg.discovered.has('bogus'));
  const pg = createGame({ stage: 1, players: [{ lv: { atk: 14 } }, {}], seed: 4 });
  drainEvents(pg);
  setPlayer(pg, 0, { lv: { atk: 15 } }); // 수련이 오른 마법사가 다시 들어오면
  let pev = drainEvents(pg);
  assert.equal(pev.filter(e => e.type === 'synergy' && e.key === 'pierce' && e.first).length, 1);
  setPlayer(pg, 0, { lv: { atk: 15, multi: 1 } }); // 다중 시전 → 관통 꺼짐
  assert.ok(!pg.players[0].syn.includes('pierce'));
  drainEvents(pg);
  setPlayer(pg, 0, { gold: 0, lv: { atk: 15 } });
  pev = drainEvents(pg);
  assert.ok(pev.some(e => e.type === 'synergy' && e.key === 'pierce' && !e.first), '재활성은 first:false');

  // 협동 레벨 조합(협동 모드에서만): 쌍둥이 포화, 황금비 — 솔로에선 꺼져 있다
  assert.deepEqual(createGame({ stage: 25, players: [{ lv: { multi: 3, atk: 10 } }, { lv: { multi: 3, atk: 10 } }], seed: 11 }).duo, [], '솔로: 협동 조합 없음');
  const tg = createGame({ stage: 25, players: [{ lv: { multi: 3, atk: 10 } }, { lv: { multi: 3, atk: 10 } }], seed: 11, run: WALL, coop: true });
  const tev = drainEvents(tg);
  assert.deepEqual([...tg.duo].sort(), ['golden', 'twin']);
  assert.ok(tev.some(e => e.type === 'synergy' && e.key === 'twin' && e.o === -1));
  run(tg, 30);
  const tb = tg.enemies.map(e => e.gold);
  act(tg, 0, { type: 'skill', skill: 'meteor' });
  const tk = of(drainEvents(tg), 'kill');
  assert.equal(tk[0].gold, Math.ceil(tb[0] * 1.5), '황금비 +50%');
  const hg = createGame({ stage: 5, players: [{ lv: { multi: 3, atk: 10 } }, { lv: { multi: 3, atk: 10 } }], seed: 5, coop: true });
  const hev = [];
  run(hg, 15, hev);
  const hd = hg.players[0].stats.dmg;
  assert.ok(of(hev, 'hit').some(e => Math.abs(e.dmg - hd * BASIC_SPELLS[0].dmg * 1.25) < 1e-6), '쌍둥이 +25%');

  // 빙하 운석: 한쪽 빙결 → 3초 안 다른 쪽 운석 → 보스 운석 피해 3배
  const bg = createGame({ stage: 10, players: [{}, {}], seed: 8, run: WALL, coop: true });
  run(bg, 50);
  const boss = bg.enemies.find(e => e.named);
  assert.ok(boss, '보스 등장');
  act(bg, 0, { type: 'skill', skill: 'freeze' });
  run(bg, 1);
  const hp0 = boss.hp;
  act(bg, 1, { type: 'skill', skill: 'meteor' });
  const gev = drainEvents(bg);
  assert.ok(gev.some(e => e.type === 'synergy' && e.key === 'glacier' && e.first));
  assert.ok(of(gev, 'shatter').length >= 1);
  assert.ok(Math.abs(hp0 - boss.hp - boss.maxHp * SKILLS.meteor.bossPct * 3) < boss.maxHp * 1e-9, '보스 3배');
  // 같은 사람의 빙결 → 운석은 조합 아님
  const sg2 = createGame({ stage: 10, players: [{}, {}], seed: 8, run: WALL, coop: true });
  run(sg2, 20);
  act(sg2, 0, { type: 'skill', skill: 'freeze' });
  act(sg2, 0, { type: 'skill', skill: 'meteor' });
  assert.ok(!drainEvents(sg2).some(e => e.key === 'glacier'));

  // 이중 필살: 1.5초 안에 같은 스킬 → 운석 2번, 빙결 10초
  const wg = crowd(10, 50, { coop: true });
  const bossW = wg.enemies.find(e => e.named);
  act(wg, 0, { type: 'skill', skill: 'freeze' });
  run(wg, 1);
  act(wg, 1, { type: 'skill', skill: 'freeze' });
  assert.equal(wg.freezeT, 10);
  let wev = drainEvents(wg);
  assert.ok(wev.some(e => e.type === 'synergy' && e.key === 'double'));
  run(wg, 5); // 빙하 창(3초) 밖
  act(wg, 0, { type: 'skill', skill: 'meteor' });
  const bh = bossW.hp;
  run(wg, 0.5);
  act(wg, 1, { type: 'skill', skill: 'meteor' });
  wev = drainEvents(wg);
  assert.equal(wev.filter(e => e.type === 'boom' && e.kind === 'meteor').length, 2, '운석 두 번');
  assert.ok(!wev.some(e => e.key === 'glacier'));
  assert.ok(bh - bossW.hp >= bossW.maxHp * SKILLS.meteor.bossPct * 2 - 1e-6);

  // 연쇄 폭발: 자폭병 무리 하나가 터지면 골드 비
  const cg = crowd(61, 12);
  const bomber = cg.enemies.find(e => e.type === 'bomber');
  assert.ok(bomber, '자폭병 등장');
  for (const e of cg.enemies) if (e !== bomber) e.dead = true; // 다른 적 정리
  run(cg, DT);
  const nb = [];
  for (let k = 0; k < 6; k++) {
    const c = { ...bomber, id: 9000 + k, x: 300 + k * 25, y: 700, hp: 1, maxHp: 1, shield: 0, dead: false };
    nb.push(c);
    cg.enemies.push(c);
    cg.progress.total++;
  }
  bomber.dead = true;
  const g0 = cg.players[0].gold;
  const cev2 = [];
  run(cg, 2, cev2);
  const rain = of(cev2, 'goldRain');
  assert.equal(rain.length, 1, '골드 비');
  assert.ok(cev2.some(e => e.type === 'synergy' && e.key === 'chainboom' && e.first));
  const chainGold = of(cev2, 'kill').filter(e => nb.some(b => b.x === e.x && b.y === e.y)).reduce((s, e) => s + e.gold, 0);
  assert.equal(rain[0].amount, chainGold * 5);
  assert.ok(cg.players[0].gold >= g0 + chainGold * 6);

  // 무결점: 성벽 100%로 클리어 → 보석 +50%
  const fg = createGame({ stage: 3, players: [{ lv: TR_MAX }, { lv: TR_MAX }], seed: 9, run: buff(150) });
  const fev = [];
  run(fg, 200, fev);
  assert.equal(fg.phase, 'clear');
  assert.equal(fg.result.flawless, true);
  assert.equal(fg.result.gems[0], Math.ceil(RUN_GEMS.floor(3) * 1.5) + RUN_GEMS.first(3), '런 보석: 층 +50%(무결점) + 첫 돌파');
  assert.equal(fg.run.flawless, 1);
  assert.ok(fev.some(e => e.type === 'synergy' && e.key === 'flawless'));
  assert.ok(of(fev, 'hit').some(e => e.big), 'big 타격');
  assert.ok(fev.some(e => e.type === 'hitstop' && e.ms === 120), '엘리트 처치 히트스톱');

  // 네임드 보스 처치 500, 보스 치명타 60 (0.3초 간격 제한)
  const ng = createGame({ stage: 10, players: [{ lv: TR_MAX }, { lv: TR_MAX }], seed: 10, run: buff(150, 20) });
  const nev = [];
  run(ng, 300, nev);
  assert.equal(ng.phase, 'clear');
  assert.ok(nev.some(e => e.type === 'hitstop' && e.ms === 500));
  let lastT = -1, ok60 = true, n60 = 0;
  // 시간 복원: 60ms 히트스톱 사이엔 최소 18스텝(0.3초)
  const ng2 = createGame({ stage: 10, players: [{ lv: TR_MAX }, { lv: TR_MAX }], seed: 10, run: buff(150, 20) });
  for (let s = 0, n = 0; n < 60 * 300 && ng2.phase === 'play'; n++) {
    if (ng2.pick) { resolvePick(ng2); continue; }
    step(ng2, DT);
    s++;
    for (const e of drainEvents(ng2)) if (e.type === 'hitstop' && e.ms === 60) {
      n60++;
      if (lastT >= 0 && s - lastT < 17) ok60 = false;
      lastT = s;
    }
  }
  assert.ok(n60 > 0 && ok60, `보스 치명타 히트스톱 ${n60}`);

  // 넉백: 잡몹은 밀려나고 보스는 그대로
  const kg = createGame({ stage: 2, players: [{ lv: { atk: 3 } }, {}], seed: 12 });
  run(kg, 6);
  const ys = kg.enemies.map(e => [e, e.y]);
  kg.freezeT = 3; // 이동 멈춤
  run(kg, 2);
  assert.ok(ys.some(([e, y0]) => e.dead || e.y < y0), '넉백');
  console.log('중독성 레이어 통과');
}

// ── 2) 성벽 마법사 = 주문만 시전 (기본 공격 없음) · 솔로 = 성벽 중앙의 나 한 명 ──
function mageSpells() {
  // 솔로: 성벽 중앙(SOLO_MAGE)의 나만 시전(화염구). players[1]은 잠든 협동 자리 — 시전·비상 스킬·조합·성벽에 영향 없음
  const g = createGame({ stage: 5, players: [{ lv: { atk: 5 } }, { lv: { atk: 5, wall: 20 } }], seed: 60 });
  const ev = [];
  const kinds = new Set();
  for (let t = 0; t < 20 && g.phase === 'play'; t += DT) {
    if (g.pick) { resolvePick(g, ev); continue; }
    step(g, DT);
    ev.push(...drainEvents(g));
    for (const b of g.bullets) kinds.add(`${b.caster}:${b.kind}:${b.pierce}`);
  }
  assert.deepEqual([...kinds], ['0:fireball:1'], '솔로: 발사체 = 내 화염구뿐');
  const casts = of(ev, 'cast');
  const ok = e => [e.x, e.y, e.tx, e.ty].every(Number.isFinite);
  assert.ok(casts.length && casts.every(e => e.o === 0 && e.x === SOLO_MAGE.x && e.y === SOLO_MAGE.y && ok(e)), '시전 위치 = 성벽 중앙의 나');
  assert.ok(SOLO_MAGE.x === 360, '성벽 중앙');
  assert.ok(casts.some(e => e.spell === 'fireball' && e.basic), '화염구 시전 이벤트');
  assert.ok(of(ev, 'boom').some(e => e.kind === 'fireball' && e.o === 0), '화염구 폭발');
  assert.ok(of(ev, 'hit').every(e => e.o !== 1) && g.dmgDone[1] === 0, '동료 피해 없음');
  assert.equal(g.wall.max, createGame({ stage: 5, players: [{ lv: { atk: 5 } }, {}], seed: 60 }).wall.max, '동료 수련은 성벽에 영향 없음');
  assert.ok(!act(g, 1, { type: 'skill', skill: 'meteor' }) && !act(g, 1, { type: 'auto', on: true }), '솔로: 동료 조작 불가');
  // 네임드 보스를 잡아도 동료 주문(옛 allySpells)은 없다 · 옛 저장의 allySpells는 버린다
  const strong = { lv: TR_MAX };
  const ag = createGame({ stage: 10, players: [strong, strong], seed: 5, run: buff(150, 20) });
  const aev = [];
  runUntilEnd(ag, 600, aev);
  assert.equal(ag.phase, 'clear');
  assert.ok(!aev.some(e => e.type === 'allySpell') && !('allySpells' in ag.run.checkpoint), '동료 주문 없음');
  assert.ok(!('allySpells' in normalizeRun({ allySpells: { iceLance: 3 }, spells: { fireball: 2 } })), '옛 동료 주문 저장은 버림');

  // 협동 모드(g.coop — 후일을 위한 자리): 동료가 깨어나 서리 화살(2마리 관통·둔화)
  const cg0 = createGame({ stage: 5, players: [{ lv: { atk: 5 } }, { lv: { atk: 5 } }], seed: 60, coop: true });
  const ev0 = [], kinds0 = new Set();
  let slowed = false;
  for (let t = 0; t < 20 && cg0.phase === 'play'; t += DT) {
    if (cg0.pick) { resolvePick(cg0, ev0); continue; }
    step(cg0, DT);
    ev0.push(...drainEvents(cg0));
    for (const b of cg0.bullets) kinds0.add(`${b.caster}:${b.kind}:${b.pierce}`);
    slowed ||= cg0.enemies.some(e => !e.dead && e.slowT > 0);
  }
  assert.deepEqual([...kinds0].sort(), ['0:fireball:1', '1:frostbolt:2'], '협동: 화염구(나) · 서리 화살(동료)');
  assert.ok(of(ev0, 'cast').some(e => e.o === 1 && e.spell === 'frostbolt' && e.basic && ok(e)) && slowed, '협동: 서리 화살 시전·둔화');

  // 카드 스킬은 내 주문서에서 각자 쿨타임대로 시전(cast basic:false, 스킬 레벨 lv) + 주문 치명타
  const cg = createGame({ stage: 5, players: [{ lv: TR_MAX }, {}], seed: 61, run: buff(20, 999, { spells: { judgment: 3, iceLance: 3 } }) });
  const cev = [];
  run(cg, 8, cev);
  for (const k of ['judgment', 'iceLance']) {
    assert.ok(of(cev, 'cast').some(e => e.o === 0 && e.spell === k && !e.basic && ok(e) && e.lv === 3), `${k} 시전 이벤트(lv)`);
    assert.ok(of(cev, 'spell').filter(e => e.key === k).every(e => e.lv === 3), `${k} spell 이벤트 lv`);
  }
  assert.ok(of(cev, 'hit').some(e => e.o === 3 && e.caster === 0 && e.crit), '스킬 피해도 치명타');

  // 시전 속도 = 쿨타임 단축(상한), 다중 시전 = 연속 시전 확률
  const casts60 = lv => {
    const sg = createGame({ stage: 25, players: [{ lv }, {}], seed: 62, run: buff(0, 999, { spells: { judgment: 1 } }) });
    const e = []; run(sg, 150, e);
    return of(e, 'cast').filter(x => x.spell === 'judgment').length;
  };
  const base = casts60({}), fast = casts60({ rate: 15 }), echo = casts60({ multi: 5 });
  assert.ok(fast > base * 1.2 && echo > base * 1.1, `심판 광선 시전 ${base} → 시전 속도 ${fast} · 다중 시전 ${echo}`);
  assert.ok(cannonStats({ rate: 15 }, { rateMul: 9 }).cdMul <= 1 / 0.6 + 1e-9, '쿨타임 단축 상한');
  console.log('성벽 마법사 주문 시전(솔로) 통과');
}

// ── 3) 판타지 스킬 선택 (런 전체 누적 빌드: 슬롯 6 · Lv1~5 · 각성) ──
function fantasyPick() {
  // 마나 → 카드 → 전투 정지(시간도 멈춤), 카드 3장은 서로 다른 스킬
  const g = createGame({ stage: 1, players: [{ lv: { atk: 20 } }, {}], seed: 21, run: buff(20, 20) });
  for (let n = 0; !g.pick && g.phase === 'play' && n < 60 * 200; n++) { step(g, DT); drainEvents(g); }
  assert.ok(g.pick, '마나가 가득 차면 카드가 뜬다');
  assert.equal(g.mana.cur, g.mana.max);
  assert.ok(g.progress.killed >= Math.ceil(g.progress.total * 0.3) && g.progress.killed < Math.ceil(g.progress.total * 0.6), '1~5층: 처치 진행률 30%에서 첫 장');
  assert.equal(g.pick.cards.length, 3, '카드 3장');
  assert.equal(new Set(g.pick.cards.map(c => c.spell)).size, 3, '서로 다른 스킬');
  for (const c of g.pick.cards) assert.equal(c.level, 1, '처음 뽑으면 Lv1');
  const before = { killed: g.progress.killed, phaseT: g.phaseT, n: g.enemies.length };
  for (let k = 0; k < 30; k++) step(g, DT);
  assert.deepEqual({ killed: g.progress.killed, phaseT: g.phaseT, n: g.enemies.length }, before, '선택 중엔 전투 정지(시간도 멈춤)');
  assert.ok(!act(g, 0, { type: 'skill', skill: 'freeze' }), '선택 중엔 다른 조작도 불가');
  assert.ok(!act(g, 1, { type: 'pick', index: 0 }), 'AI 동료는 카드를 고르지 않음');
  const key = g.pick.cards[0].spell;
  drainEvents(g);
  assert.ok(act(g, 0, { type: 'pick', index: 0 }));
  assert.equal(g.spells[key], 1);
  assert.ok(g.seenSpells.has(key), '뽑아 본 스킬 기록(시작 스킬 후보)');
  assert.equal(g.pick, null, '선택하면 정지 해제');
  assert.ok(drainEvents(g).some(e => e.type === 'spellPick' && e.spell === key && e.level === 1));
  assert.ok(!act(g, 0, { type: 'pick', index: 0 }), '카드가 없을 때 pick은 실패');
  // 1~5층은 70%에서 한 장 더, 그 뒤로는 없다(1층엔 네임드 보스 없음)
  let again = 0;
  for (let n = 0; g.phase === 'play' && n < 60 * 300; n++) {
    step(g, DT); drainEvents(g);
    if (g.pick) { again++; assert.ok(g.progress.killed >= Math.ceil(g.progress.total * 0.7), '두 번째는 70%'); act(g, 0, { type: 'pick', index: 0 }); }
  }
  assert.equal(again, 1, `초반 층은 마나 카드 2장(${again + 1})`);
  // 6층부터는 60%에서 1장
  const g6 = createGame({ stage: EARLY_FLOORS + 1, players: [{ lv: TR_MAX }, {}], seed: 21, run: buff(60, 60) });
  let n6 = 0;
  for (let n = 0; g6.phase === 'play' && n < 60 * 300; n++) {
    step(g6, DT); drainEvents(g6);
    if (g6.pick) { n6++; assert.ok(g6.progress.killed >= Math.ceil(g6.progress.total * 0.6)); act(g6, 0, { type: 'pick', index: 0 }); }
  }
  assert.equal(n6, 1, '6층부터는 층당 1장');

  // 빌드는 층이 바뀌어도 유지(런 전체)
  startStage(g, 2);
  assert.ok(g.book[key] >= 1, '다음 층에도 빌드 유지(합체됐으면 융합 스킬 안에)');
  assert.equal(g.mana.cur, 0);

  // 슬롯 6칸: 차면 보유 스킬 강화 카드만. 각성 카드는 강화할 것도 새로 넣을 것도 없을 때만
  const sg = createGame({ stage: 5, players: [{}, {}], seed: 22 });
  const six = SPELL_KEYS.slice(0, SPELL_SLOTS);
  six.forEach(k => { sg.spells[k] = 2; });
  for (let i = 0; i < 20; i++) {
    for (const c of genOffer(sg)) assert.ok(c.awaken || six.includes(c.spell), '슬롯이 차면 보유 스킬만');
  }
  six.forEach(k => { sg.spells[k] = SPELL_MAX_LV; sg.mutations[k] = MUTATIONS[k][0].key; }); // 4차: 변이까지 끝낸 만렙(변이 카드는 test/mutations.test.js)
  sg.spells[six[0]] = SPELL_MAX_LV - 1;
  let cards = genOffer(sg);
  assert.deepEqual(cards.map(c => [c.spell, c.level]), [[six[0], SPELL_MAX_LV]], '남은 강화 1장뿐(각성 카드로 채우지 않는다)');
  sg.spells[six[0]] = SPELL_MAX_LV;
  cards = genOffer(sg);
  assert.ok(cards.length === 3 && cards.every(c => c.awaken && AWAKEN_KEYS.includes(c.awaken)), '모든 슬롯 만렙 → 각성 카드만');
  assert.ok(!cards.fixed, '각성 4종 중 3장 = 새로고침하면 달라질 수 있다');
  sg.fx.choices += 1; // 4장 = 각성 4종 전부 → 새로고침해도 같은 카드: 새로고침 막음(횟수 보존)
  cards = genOffer(sg);
  assert.ok(cards.length === 4 && cards.fixed);
  sg.pick = { cards, autoLeft: null }; sg.rerollLeft = 1;
  assert.ok(!act(sg, 0, { type: 'reroll' }) && sg.rerollLeft === 1, '같은 카드로 새로고침 금지');
  sg.pick = null; sg.fx.choices -= 1;
  // 각성 선택: 런 동안 스탯 누적
  const d0 = sg.players[0].stats.dmg;
  sg.pick = { cards: [{ spell: null, awaken: 'power', level: 1, rarity: 'common', fusionHint: false }], autoLeft: null };
  drainEvents(sg);
  assert.ok(act(sg, 0, { type: 'pick', index: 0 }));
  assert.equal(sg.run.awaken.power, 1);
  assert.ok(Math.abs(sg.players[0].stats.dmg - d0 * 1.05) < 1e-9, '각성: 마력 +5%');
  assert.ok(drainEvents(sg).some(e => e.type === 'spellPick' && e.awaken === 'power'));
  const w0 = sg.wall.max;
  sg.pick = { cards: [{ spell: null, awaken: 'ward', level: 1, rarity: 'common', fusionHint: false }], autoLeft: null };
  act(sg, 0, { type: 'pick', index: 0 });
  assert.ok(sg.wall.max > w0 && sg.wall.hp === sg.wall.max, '각성: 성벽 결계 → 최대치·현재치 증가');

  // 카드는 기본적으로 직접 고른다 — 자동 진행(auto) ON이어도 카운트다운·자동 선택 없음
  const ag = createGame({ stage: 2, players: [{ lv: { atk: 20 }, auto: true }, {}], seed: 23, run: buff(20, 20) });
  for (let n = 0; !ag.pick && n < 60 * 60; n++) { step(ag, DT); drainEvents(ag); }
  assert.ok(ag.pick && ag.pick.autoLeft === null, '자동 진행 ON이어도 카드는 직접(카운트다운 없음)');
  tickPick(ag, 999); step(ag, 1);
  assert.ok(ag.pick, '자동 진행 ON: 고를 때까지 기다린다');
  // 카드 화면 '자동 선택'(autoPick, 자동 진행과 별개): 켜면 PICK_AUTO_T초 뒤 추천 카드
  // v0.1.6 템포: 자동 선택은 추천 카드를 잠깐 보여 주고 바로(PICK_AUTO_T ≤ 0.4초)
  assert.ok(act(ag, 0, { type: 'autoPick', on: true }) && ag.pick.autoLeft === PICK_AUTO_T && PICK_AUTO_T > 0 && PICK_AUTO_T <= 0.4, '선택 중 자동 선택 ON → 짧은 카운트다운');
  tickPick(ag, PICK_AUTO_T * 0.7);
  assert.ok(ag.pick, '카운트다운 전엔 그대로');
  tickPick(ag, PICK_AUTO_T * 0.4);
  assert.ok(!ag.pick, '지나면 추천 카드 자동 선택');
  assert.equal(Object.keys(ag.spells).length, 1);
  // 자동 선택 OFF(기본): 카운트다운도 자동 선택도 없이 고를 때까지 기다린다 · 선택 중 토글은 즉시 반영
  const mg = createGame({ stage: 2, players: [{ lv: { atk: 20 } }, {}], seed: 23, run: buff(20, 20) });
  for (let n = 0; !mg.pick && n < 60 * 60; n++) { step(mg, DT); drainEvents(mg); }
  assert.ok(mg.pick && mg.pick.autoLeft === null, 'OFF: 카운트다운 없음');
  const frozen = mg.phaseT;
  tickPick(mg, 999); step(mg, 1);
  assert.ok(mg.pick && mg.phaseT === frozen, 'OFF: 몇 초가 지나도 전투를 멈춘 채 기다린다');
  assert.ok(act(mg, 0, { type: 'auto', on: true }) && mg.pick.autoLeft === null, '선택 중 자동 진행 ON → 카드는 그대로 직접');
  assert.ok(act(mg, 0, { type: 'autoPick', on: true }) && mg.pick.autoLeft === PICK_AUTO_T, '선택 중 자동 선택 ON → 카운트다운 시작');
  assert.ok(act(mg, 0, { type: 'autoPick', on: false }) && mg.pick.autoLeft === null, '선택 중 자동 선택 OFF → 카운트다운 사라짐');
  tickPick(mg, 999);
  assert.ok(mg.pick, 'OFF면 그대로');
  assert.ok(act(mg, 0, { type: 'pick', index: 0 }) && !mg.pick, '직접 선택');
  // 이어하기로 선택 중 상태가 복원돼도(자동 진행 ON) 기다린다
  const rm = defaults();
  rm.settings.autoNext = true;
  const rg = newRun(rm, { cls: 'knight' }, 1);
  assert.ok(rg.pick && rg.pick.autoLeft === null, '새 도전 무료 카드: 기다린다');
  const rr = restoreRun(rm, rm.run, 2);
  assert.ok(rr.pick && rr.pick.autoLeft === null && rr.players[0].auto, '이어하기(자동 진행 ON): 카드는 기다린다');
  // 저장값: settings.autoNext(자동 진행, 새 저장 ON) · settings.autoPick(카드 자동 선택, 새 저장 OFF)
  const dm = defaults();
  assert.equal(dm.settings.autoNext, true, '새 저장 = 자동 진행 ON');
  assert.equal(dm.settings.autoPick, false, '새 저장 = 카드 자동 선택 OFF');
  assert.equal(newRun(dm, { cls: 'knight' }, 1).players[0].auto, true);
  dm.settings.autoNext = false;
  assert.equal(newRun(dm, { cls: 'knight' }, 1).players[0].auto, false);
  dm.settings.autoPick = true;
  const ap = newRun(dm, { cls: 'knight' }, 1);
  assert.ok(ap.players[0].autoPick && ap.pick.autoLeft === PICK_AUTO_T, '자동 선택 저장값 → 카운트다운');
  // 영웅 궁극기: 자동 진행 ON일 때만 자동(OFF면 버튼으로 직접)
  const ults = auto => { const u = createGame({ stage: 3, seed: 5, players: [{ auto }, {}], hero: { ...newHero(), cls: 'knight', level: 20 }, run: WALL }); const e = []; run(u, 30, e); return of(e, 'heroUlt').length; };
  assert.ok(ults(true) > 0 && ults(false) === 0, '궁극기 자동은 자동 진행 ON일 때만');

  // 선택지 수: 3 + 영웅 Lv15(+1) + 영구 강화 '카드 선택지'(+1)
  const hero15 = () => ({ ...newHero(), cls: 'knight', level: 15 });
  assert.equal(cardCount(createGame({ seed: 1 })), 3);
  assert.equal(cardCount(createGame({ seed: 1, hero: hero15() })), 4);
  const cg = createGame({ seed: 1, hero: hero15(), metaLv: { choice: 1 } });
  assert.equal(cardCount(cg), 5);
  assert.equal(genOffer(cg).length, 5);
  // 미뤄 둔 카드(main.js holdPicks)는 다시 띄울 때 지금 빌드로 새로 뽑는다(낡은 레벨·7번째 슬롯 방지)
  const hg = createGame({ stage: 5, players: [{}, {}], seed: 56 });
  hg.spells = { fireball: 2, lightningStrike: 2, iceLance: 2, tornado: 2, holyLight: 2, curseMark: 1 };
  const stale = { cards: [{ spell: 'gale', level: 1, rarity: 'common', fusionHint: false }, { spell: 'curseMark', level: 1, rarity: 'common', fusionHint: false }], autoLeft: null };
  assert.ok(reofferPick(hg, stale) && hg.pick.cards.every(c => c.awaken || (hg.spells[c.spell] && c.level === hg.spells[c.spell] + 1)), '다시 띄운 카드 = 지금 빌드 기준');
  console.log('판타지 스킬(런 빌드·슬롯·각성) 통과');
}

// 카드 뽑기만 확인(새로고침 경로 재사용: 1회 지급 후 즉시 받아 버림)
function genOffer(g) {
  g.pick = { cards: [], autoLeft: null };
  g.rerollLeft = 1;
  assert.ok(act(g, 0, { type: 'reroll' }));
  const cards = g.pick.cards;
  g.pick = null;
  drainEvents(g);
  return cards;
}

// 14종 스킬이 각자 눈에 보이는 효과·피해를 내는지
function fantasySpellEffects() {
  const strongLv = { atk: 20, rate: 6 };
  const mk = (key, stage = 5, seed = 40) => {
    const g = createGame({ stage, players: [{ lv: { ...strongLv } }, {}], seed, run: buff(20, 999, { spells: { [key]: 3 } }) });
    run(g, 6); // 적이 접근로를 지나 전선(사거리)에 들어올 때까지
    drainEvents(g);
    return g;
  };

  { const g = mk('fireball'); const ev = []; run(g, 8, ev); assert.ok(of(ev, 'spell').some(e => e.key === 'fireball'), '파이어볼'); }
  { const g = mk('flameBullet'); run(g, 6); assert.ok(g.enemies.some(e => e.burnT > 0) || g.progress.killed > 0, '불꽃 탄환'); }
  { const g = mk('lightningStrike'); const ev = []; run(g, 5, ev); assert.ok(of(ev, 'spell').some(e => e.key === 'lightningStrike'), '낙뢰'); }
  { const g = mk('chainLightning'); const ev = []; run(g, 12, ev); assert.ok(of(ev, 'chain').length > 0, '연쇄 번개'); }
  { const g = mk('iceLance'); const ev = []; run(g, 5, ev); assert.ok(of(ev, 'spell').some(e => e.key === 'iceLance'), '얼음 창'); }
  { const g = mk('frostWard'); run(g, 0.1); assert.ok(g.spellFx.frostWard && g.spellFx.frostWard.r > 0, '서리 결계'); }
  { const g = mk('tornado'); const ev = []; run(g, 6, ev); assert.ok(of(ev, 'spell').some(e => e.key === 'tornado'), '회오리'); }
  {
    const g = mk('gale'), g0 = createGame({ stage: 5, players: [{ lv: strongLv }, {}], seed: 40, run: buff(20, 999) });
    const shots = gg => { const e = []; run(gg, 6, e); return e.filter(x => x.type === 'shoot' && x.o === 0).length; };
    run(g0, 6);
    assert.ok(shots(g) > shots(g0), '질풍: 공격속도 상승');
  }
  {
    const g = mk('holyLight');
    g.wall.hp = g.wall.max * 0.5;
    run(g, 5);
    assert.ok(g.wall.hp > g.wall.max * 0.5, '수호의 빛: 성벽 재생');
  }
  { const g = mk('judgment'); const ev = []; run(g, 5, ev); assert.ok(of(ev, 'spell').some(e => e.key === 'judgment'), '심판 광선'); }
  {
    const g = mk('curseMark'); const ev = []; run(g, 3, ev);
    const st = g.players[0].stats;
    assert.ok(of(ev, 'hit').some(e => e.o === 0 && !e.crit && e.dmg > st.dmg * BASIC_SPELLS[0].dmg * 1.3), '저주 낙인: 받는 피해 증가');
  }
  {
    const g = mk('soulHarvest');
    g.wall.hp = g.wall.max * 0.5;
    const gold0 = g.players[0].gold;
    const ev = []; run(g, 15, ev);
    const killGold = of(ev, 'kill').reduce((s, e) => s + e.gold, 0);
    assert.ok(g.players[0].gold - gold0 > killGold, '영혼 수확: 처치 골드 보너스');
    assert.ok(g.wall.hp > g.wall.max * 0.5, '영혼 수확: 성벽 회복');
  }
  {
    const g = mk('babyDragon'); const ev = []; run(g, 6, ev);
    assert.ok(g.spellFx.dragon, '새끼 드래곤 등장');
    assert.ok(of(ev, 'spell').some(e => e.key === 'babyDragon'), '드래곤 브레스');
  }
  {
    // 돌 골렘: 성벽 대신 맞아준다 (약공+튼튼한 성벽 build로 적이 성벽에서 계속 두들기게 함)
    const g = createGame({ stage: 5, players: [{}, {}], seed: 41, run: buff(0, 999, { spells: { stoneGolem: 3 } }) });
    run(g, 40);
    assert.ok(g.spellFx.golem, '돌 골렘 등장');
    assert.equal(g.wall.hp, g.wall.max, '골렘이 대신 맞아 성벽은 그대로');
    assert.ok(g.spellFx.golem.hp < g.spellFx.golem.maxHp, '골렘 체력 감소');
  }
  console.log('판타지 스킬(14종 효과) 통과');
}

// 원소 융합 8종 = 합체: 두 재료가 모두 만렙(Lv6)이 되는 순간 융합 스킬 Lv1 하나로 합쳐지고 슬롯 1칸이 열린다
// (재료 효과는 만렙 그대로 + 전용 시전) · 첫 발견만 first:true · 카드로 Lv6까지 · ✦는 이 카드가 합체를 완성할 때만
const noPick = (g, secs) => { for (let t = 0; t < secs && g.phase === 'play'; t += DT) { if (g.pick) { g.pick = null; continue; } step(g, DT); drainEvents(g); } };
function fantasyFusions() {
  const M = SPELL_MAX_LV;
  const CD = ['fireball', 'lightningStrike', 'iceLance', 'tornado', 'judgment', 'babyDragon'];
  const pairOf = f => f.groups.map(gr => gr.find(k => CD.includes(k)) || gr[0]);
  const rows = [];
  for (const f of FUSIONS) {
    const [a, b] = pairOf(f);
    assert.ok(f.test({ [a]: 1, [b]: 1 }) && !f.test({ [a]: M }), `${f.key}: 재료 짝`);
    assert.ok(f.ready({ [a]: M, [b]: M }) && !f.ready({ [a]: M, [b]: M - 1 }), `${f.key}: 합체 조건 = 둘 다 만렙`);
    assert.ok(SKILL_BY_KEY[f.key].desc.length === M && f.lv.length === M && f.shape, `${f.key}: Lv1~6 수치·문구·시전 모양`);
    const g = createGame({ stage: 5, players: [{}, {}], seed: 50, run: WALL });
    Object.assign(g.spells, { [a]: M, [b]: M - 2, gale: 1 });
    refreshFusion(g);
    drainEvents(g);
    assert.ok(!g.fusions.includes(f.key) && slotsUsed(g) === 3, `${f.key}: 한쪽만 만렙이면 미합체`);
    // 진행도(스택 금빛 연결선·툴팁): 도감에 오른 융합만
    assert.ok(!g.fusionProgress.some(p => p.key === f.key), `${f.key}: 미발견 융합은 진행도에 없다`);
    g.discovered.add(f.key); refreshFusion(g);
    assert.deepEqual(g.fusionProgress.find(p => p.key === f.key), { key: f.key, parts: [a, b], lv: [M, M - 2], max: M }, `${f.key}: 진행도`);
    // ✦: 짝이 만렙이고 이 카드가 만렙을 만들 때만
    const cardFor = () => { g.pick = { cards: [], autoLeft: null }; g.rerollLeft = 99; let c = null; for (let k = 0; k < 80 && !c; k++) { act(g, 0, { type: 'reroll' }); c = g.pick.cards.find(x => x.spell === b); } g.pick = null; return c; };
    let c = cardFor();
    assert.ok(c && c.level === M - 1 && !c.fusionHint, `${f.key}: 아직 만렙이 안 되는 카드엔 ✦ 없음`);
    g.spells[b] = M - 1;
    c = cardFor();
    assert.ok(c && c.level === M && c.fusionHint, `${f.key}: 합체를 완성하는 카드에 ✦`);
    g.pick = { cards: [c], autoLeft: null };
    drainEvents(g);
    assert.ok(act(g, 0, { type: 'pick', index: 0 }));
    const ev = drainEvents(g);
    assert.deepEqual(g.spells, { gale: 1, [f.key]: 1 }, `${f.key}: 두 재료 → 융합 스킬 Lv1 1칸`);
    assert.equal(slotsUsed(g), 2, `${f.key}: 슬롯 1칸 해제(3 → 2)`);
    assert.ok(ev.some(e => e.type === 'fusionMerge' && e.fusion === f.key && e.level === 1 && e.slotFreed && e.from.includes(a) && e.from.includes(b)), `${f.key}: fusionMerge 이벤트`);
    assert.ok(ev.some(e => e.type === 'synergy' && e.key === f.key && !e.first), `${f.key}: 도감에 있던 융합은 first:false`);
    assert.ok(g.fusions.includes(f.key) && !g.fusionProgress.some(p => p.key === f.key));
    assert.ok(g.book[a] === M && g.book[b] === M, `${f.key}: 재료 효과는 만렙 그대로`);
    assert.deepEqual(g.fusionParts[f.key], [a, b]);
    // 전용 시전(모양이 다르다) + 레벨(lv)
    const cev = [];
    run(g, 12, cev);
    assert.ok(of(cev, 'spell').some(e => e.key === f.key && e.shape === f.shape && e.lv >= 1) && of(cev, 'cast').some(e => e.spell === f.key && !e.basic && e.lv >= 1), `${f.key}: 전용 시전 ${f.shape}`);
    // 강화 카드로 Lv6까지(새 카드로는 나오지 않는다)
    g.spells[f.key] = 1;
    refreshFusion(g);
    let up = null;
    for (let k = 0; k < 300 && !up; k++) up = genOffer(g).find(x => x.spell === f.key);
    assert.ok(up && up.fusion && up.level === 2, `${f.key}: 융합 스킬 강화 카드`);
    for (let k = 0; k < 60; k++) assert.ok(genOffer(g).every(x => x.spell !== a && x.spell !== b), `${f.key}: 합체된 재료는 새 카드로 다시 나오지 않는다`);
    const fresh = createGame({ stage: 5, players: [{}, {}], seed: 52 });
    for (let k = 0; k < 30; k++) assert.ok(genOffer(fresh).every(x => !x.fusion), '융합 스킬은 합체로만 생긴다');
    // 런 안에서 유지 + 이어하기 저장
    startStage(g, 6);
    assert.ok(g.fusions.includes(f.key) && g.book[a] === M, `${f.key}: 다음 층에도 유지`);
    const back = createGame({ players: [{}, {}], seed: 53, run: normalizeRun(JSON.parse(JSON.stringify(serializeRun(g)))) });
    assert.deepEqual([back.spells, back.book, back.fusionParts], [g.spells, g.book, g.fusionParts], `${f.key}: 이어하기`);
    // 시작 스킬(Lv1)은 바로 합체하지 않는다 · 만렙 두 개로 시작하면(이어하기 등) 바로 합체
    const g2 = createGame({ stage: 1, players: [{}, {}], seed: 51, discovered: [...g.discovered], run: { spells: { [a]: 1, [b]: 1 } } });
    assert.deepEqual(g2.spells, { [a]: 1, [b]: 1 }, `${f.key}: Lv1 두 개는 미합체`);
    const g3 = createGame({ stage: 1, players: [{}, {}], seed: 51, run: { spells: { [a]: M, [b]: M } } });
    assert.deepEqual(g3.spells, { [f.key]: 1 });
    assert.ok(drainEvents(g3).some(e => e.type === 'synergy' && e.key === f.key && e.first), `${f.key}: 첫 발견`);
    // 강도: 재료 둘 만렙(따로) 대비 — Lv1은 조금 세고(합체가 손해가 아니다), Lv6은 확실히 세다
    const dmgOf = lv => {
      let sum = 0;
      for (const seed of [54, 55]) {
        const t = createGame({ stage: 20, players: [{}, {}], seed, run: WALL });
        t.spells = { [a]: M, [b]: M };
        if (lv) { refreshFusion(t); t.spells[f.key] = lv; refreshFusion(t); } else t.book = { [a]: M, [b]: M }; // 합체 없이 두 스킬 그대로
        noPick(t, 30);
        sum += t.dmgSkill[0];
      }
      return sum;
    };
    const off = dmgOf(0), l1 = dmgOf(1) / off, l6 = dmgOf(M) / off;
    rows.push(`${f.key} Lv1 ×${l1.toFixed(2)} Lv6 ×${l6.toFixed(2)}`);
    assert.ok(l1 > 1.03 && l1 < 1.8, `${f.key}: 융합 Lv1은 재료 둘 만렙보다 조금 세다 (×${l1.toFixed(2)})`);
    assert.ok(l6 > 1.7, `${f.key}: 융합 Lv6은 확실히 세다 (×${l6.toFixed(2)})`);
  }
  // 슬롯이 꽉 찬 상태에서는 새 스킬 카드가 없다 — 합체로 칸이 열리면 다시 나온다
  const s = createGame({ stage: 5, players: [{}, {}], seed: 55 });
  s.spells = { fireball: M, lightningStrike: M, iceLance: M, tornado: M, holyLight: 2, curseMark: 2 };
  s.book = { ...s.spells };
  for (let k = 0; k < 20; k++) assert.ok(genOffer(s).every(c => s.spells[c.spell]), '6칸이 차면 보유 스킬 강화만');
  refreshFusion(s); // 만렙 짝이 모두 합체된다
  assert.ok(slotsUsed(s) < SPELL_SLOTS && s.fusions.length >= 2, `합체로 칸이 열린다: ${JSON.stringify(s.spells)}`);
  let fresh = false;
  for (let k = 0; k < 20 && !fresh; k++) fresh = genOffer(s).some(c => c.spell && !s.spells[c.spell]);
  assert.ok(fresh, '열린 칸에 새 스킬 카드');
  // 스킬 스택 쿨타임 링: 쿨타임 스킬·융합 스킬은 { left, total }, 지속형·없는 스킬은 null
  {
    const g = createGame({ stage: 3, seed: 1, players: [{}, {}], run: { spells: { fireball: M, iceLance: M, gale: 1 } } });
    run(g, 10);
    const cd = spellCooldown(g, 'steamBurst');
    assert.ok(g.spells.steamBurst && cd && cd.total > 0 && cd.left >= 0 && cd.left <= cd.total, '융합 스킬 쿨타임');
    assert.equal(spellCooldown(g, 'gale'), null);
    assert.equal(spellCooldown(g, 'fireball'), null, '합쳐진 재료는 슬롯에 없다');
  }
  console.log('판타지 스킬(융합 합체 8종) 통과 — 융합 강도(재료 둘 만렙 대비): ' + rows.join(' · '));
}

// ── 4) 영웅: 클래스 · 필드 유닛 ──
function heroClasses() {
  assert.deepEqual(unlockedClasses(0).sort(), ['knight', 'ranger', 'sorcerer'].sort());
  assert.ok(!unlockedClasses(19).includes('cleric') && unlockedClasses(20).includes('cleric'));
  assert.ok(!unlockedClasses(39).includes('assassin') && unlockedClasses(40).includes('assassin'));
  for (const k of HERO_CLASS_KEYS) {
    const c = HERO_CLASSES[k];
    assert.ok(c.name && c.role && c.weapon && c.ult && c.ult.name && c.ult.cd > 0, `${k} 클래스 테이블`);
    assert.ok(c.base.hp > 0 && c.base.atk > 0 && c.base.range > 0 && c.base.atkSpd > 0 && c.base.moveSpd > 0, `${k} 기본 스탯`);
  }
  assert.equal(heroTier(1), 0);
  assert.ok(heroTier(99) > heroTier(1), '레벨이 높을수록 티어도 높음');
  console.log('영웅 클래스 통과');
}

function heroUnitLifecycle() {
  const g = createGame({ stage: 1, players: [{}, {}], seed: 200, hero: newHero() });
  assert.ok(!act(g, 0, { type: 'heroClass', cls: 'cleric' }), '미해금 클래스는 선택 불가');
  assert.ok(act(g, 0, { type: 'heroClass', cls: 'knight' }));
  assert.equal(g.hero.cls, 'knight');
  assert.ok(g.heroUnit && g.heroUnit.state === 'walk', '성문에서 걸어 나감');
  for (let k = 0; k < 60; k++) { step(g, DT); drainEvents(g); }
  assert.ok(!act(g, 0, { type: 'heroClass', cls: 'ranger' }), '전투 중엔 클래스 변경 불가');

  // 탭 이동: 지정 위치로 걸어가 6초 홀드 후 자동 복귀
  assert.ok(act(g, 0, { type: 'heroMove', x: 100, y: 500 }));
  assert.ok(g.heroUnit.moveTo);
  for (let k = 0; k < 60 * 8; k++) step(g, DT);
  assert.ok(!g.heroUnit.moveTo, '홀드 종료 후 자동 복귀');

  // 궁극기: 사용 성공 + 이벤트 + 쿨타임
  drainEvents(g);
  assert.ok(act(g, 0, { type: 'heroUlt' }));
  assert.ok(drainEvents(g).some(e => e.type === 'heroUlt' && e.cls === 'knight'));
  assert.ok(g.heroUnit.ultCd > 0);
  assert.ok(!act(g, 0, { type: 'heroUlt' }), '쿨타임 중엔 실패');
  console.log('영웅 생애주기(이동/궁극기) 통과');
}

// 도발: 기사가 근접해 있으면 적이 성벽 대신 영웅을 공격
function heroTaunt() {
  const g = createGame({ stage: 3, players: [{}, {}], seed: 201, hero: newHero() });
  act(g, 0, { type: 'heroClass', cls: 'knight' });
  for (let k = 0; k < 180 && g.enemies.length === 0; k++) { step(g, DT); drainEvents(g); }
  const src = g.enemies.find(e => !e.dead && e.beh === 'walk') || g.enemies[0];
  assert.ok(src, '적 존재');
  src.hp = src.maxHp = 1e9; // 이 테스트에서는 죽지 않게
  src.x = 360; src.y = 500; // 전장 한가운데(스폰 구역 밖)
  g.heroUnit.x = src.x; g.heroUnit.y = src.y; g.heroUnit.moveTo = null;
  const hp0 = g.heroUnit.hp;
  for (let k = 0; k < 60 * 2; k++) { step(g, DT); drainEvents(g); }
  assert.equal(src.state, 'attackHero', '도발: 성벽 대신 영웅을 공격');
  assert.ok(g.heroUnit.hp < hp0, '영웅이 피해를 입음');
  console.log('영웅 도발 통과');
}

function heroRangedAttack() {
  const g = createGame({ stage: 5, players: [{ lv: { atk: 0 } }, {}], seed: 202, hero: newHero() });
  act(g, 0, { type: 'heroClass', cls: 'ranger' });
  const ev = [];
  for (let k = 0; k < 60 * 20; k++) { step(g, DT); ev.push(...drainEvents(g)); }
  assert.ok(ev.some(e => e.type === 'heroAttack' && e.cls === 'ranger'), '궁수 원거리 공격');
  console.log('영웅 원거리 공격 통과');
}

// 5종 궁극기 모두 동작 확인
function heroUlts() {
  for (const cls of HERO_CLASS_KEYS) {
    const best = HERO_CLASSES[cls].unlock(0) ? 0 : cls === 'assassin' ? 40 : 20;
    const g = createGame({ stage: 10, players: [{}, {}], seed: 203, best, hero: newHero() });
    assert.ok(act(g, 0, { type: 'heroClass', cls }), `${cls} 선택`);
    for (let k = 0; k < 60 * 3; k++) { step(g, DT); drainEvents(g); }
    drainEvents(g);
    assert.ok(act(g, 0, { type: 'heroUlt' }), `${cls} 궁극기 사용`);
    assert.ok(drainEvents(g).some(e => e.type === 'heroUlt' && e.cls === cls), `${cls} 궁극기 이벤트`);
    if (cls === 'knight') {
      assert.ok(g.heroUnit.invulnT > 0, '기사: 무적');
      const stunned = g.enemies.filter(e => e.stunT > 0 && !e.dead && !e.isBoss);
      if (stunned.length) { // 기절한 적은 1.5초 동안 제자리
        const e = stunned[0], y0 = e.y;
        for (let k = 0; k < 30; k++) step(g, DT);
        assert.ok(e.dead || e.y === y0, '기사 궁극기: 기절한 적은 멈춘다');
      }
    }
  }
  console.log('영웅 궁극기(5종) 통과');
}

// 클래스별 패시브: 궁수 관통 · 마법사 광역 · 성직자 회복 · 암살자 순간이동 — 실제 전투에서 한 번씩 나오는지
function heroClassPassives() {
  for (const cls of HERO_CLASS_KEYS) {
    // 밸런스 러너의 10층 무렵 빌드
    const g = createGame({ stage: 10, players: [{ lv: { atk: 5, rate: 3, crit: 3, wall: 5 } }, { lv: { wall: 5 } }], seed: 206, best: 40, hero: { ...newHero(), level: 9 }, run: buff(0, 30, { spells: { fireball: 2, iceLance: 2 } }) });
    act(g, 0, { type: 'heroClass', cls });
    const ev = [], wall = [];
    for (let k = 0; k < 60 * 60 && g.phase === 'play'; k++) {
      if (g.pick) { resolvePick(g, ev); continue; }
      if (cls === 'cleric' && k % 60 === 0) { g.wall.hp = g.wall.max * 0.5; wall.push(g.wall.hp); }
      step(g, DT); ev.push(...drainEvents(g));
      if (cls === 'cleric' && k % 60 === 59) wall[wall.length - 1] = g.wall.hp - wall[wall.length - 1];
    }
    const atk = ev.filter(e => e.type === 'heroAttack' && e.cls === cls);
    assert.ok(atk.length > 5, `${cls}: 전장에서 싸운다`);
    if (cls === 'assassin') assert.ok(ev.some(e => e.type === 'heroBlink'), '암살자: 순간이동');
    if (cls === 'cleric') assert.ok(wall.some(d => d > 0), '성직자: 공격하며 성벽 회복');
  }
  console.log('영웅 클래스 패시브 통과');
}

function heroDownRespawn() {
  const g = createGame({ stage: 3, players: [{}, {}], seed: 204, hero: newHero() });
  act(g, 0, { type: 'heroClass', cls: 'knight' });
  const api = { emit: (gg, ev) => gg.events.push(ev) };
  heroTakeDamage(g, 1e9, api);
  assert.equal(g.heroUnit.state, 'down');
  assert.ok(drainEvents(g).some(e => e.type === 'heroDown'));
  const respawnT = g.heroUnit.respawnT;
  assert.ok(respawnT >= 6, '레벨에 따라 스케일되는 부활 시간');
  for (let k = 0; k < 60 * Math.ceil(respawnT + 1); k++) { step(g, DT); drainEvents(g); }
  assert.ok(g.heroUnit.state === 'walk' || g.heroUnit.state === 'idle', '성문에서 부활');
  assert.ok(g.heroUnit.hp > 0);
  console.log('영웅 다운·부활 통과');
}

function heroXpAndMilestones() {
  assert.ok(!hasMilestone(4, 'reroll1') && hasMilestone(5, 'reroll1'));
  assert.ok(hasMilestone(15, 'choose4') && hasMilestone(30, 'extraCard') && hasMilestone(50, 'legendBoost'));

  const g = createGame({ stage: 1, players: [{}, {}], seed: 205, hero: newHero(), run: buff(60, 60) }); // 스킬 없는 솔로 마법사라 마력을 올려 둔다
  act(g, 0, { type: 'heroClass', cls: 'knight' });
  const api = { emit: (gg, ev) => gg.events.push(ev) };
  heroGainXp(g, xpToNext(1), api);
  assert.equal(g.hero.level, 2);
  assert.ok(drainEvents(g).some(e => e.type === 'heroLevelUp' && e.level === 2));

  // Lv15 마일스톤: 카드 4장
  g.hero.level = 15;
  for (let n = 0; !g.pick && n < 60 * 200; n++) { step(g, DT); drainEvents(g); }
  assert.ok(g.pick, '마나가 찬다');
  assert.equal(g.pick.cards.length, 4, 'Lv15: 카드 4장 중 선택');

  // Lv5 마일스톤: 도전마다 카드 새로고침 1회 (Lv4 이하는 불가) + 영구 강화 '카드 새로고침'
  assert.equal(g.rerollLeft, 0, 'Lv1 도전 → 새로고침 없음');
  assert.ok(!act(g, 0, { type: 'reroll' }));
  g.hero.level = 4; g.hero.xp = 0;
  heroGainXp(g, xpToNext(4), api);
  assert.equal(g.rerollLeft, 1, '도전 도중 Lv5 달성 → 그 도전부터 새로고침 1회');
  g.rerollLeft = 0;
  const rg = createGame({ stage: 1, players: [{ lv: { atk: 20 } }, {}], seed: 205, hero: { ...newHero(), cls: 'knight', level: 5 }, metaLv: { reroll: 2 }, run: buff(20, 20) });
  assert.equal(rg.rerollLeft, 3, 'Lv5(1) + 영구 강화(2)');
  for (let n = 0; !rg.pick && n < 60 * 200; n++) { step(rg, DT); drainEvents(rg); }
  const old = rg.pick;
  assert.ok(!act(rg, 1, { type: 'reroll' }), 'AI 동료는 새로고침 불가');
  assert.ok(act(rg, 0, { type: 'reroll' }));
  assert.ok(rg.pick && rg.pick !== old && rg.pick.cards.length === 3, '새 카드 3장');
  assert.ok(drainEvents(rg).some(e => e.type === 'pickOffer' && e.reroll));
  startStage(rg, 2);
  assert.equal(rg.rerollLeft, 2, '새로고침 횟수는 층이 바뀌어도 이어진다(도전 단위)');
  console.log('영웅 경험치·마일스톤 통과');
}

function heroItemRolls() {
  const rng = mulberry32(7);
  for (let i = 0; i < 200; i++) {
    const source = ['normal', 'elite', 'boss', 'chest'][i % 4];
    const item = rollItem(1 + (i % 100), source, rng, HERO_CLASS_KEYS[i % HERO_CLASS_KEYS.length]);
    assert.ok(SLOTS.includes(item.slot));
    assert.ok(RARITIES.some(r => r.key === item.rarity));
    if (source === 'boss') assert.notEqual(item.rarity, 'common', '보스는 희귀 이상 확정');
    assert.ok(item.name && typeof item.name === 'string' && item.name.includes('의'));
    assert.ok(item.main.value > 0);
    assert.ok(item.subs.length <= 3);
    for (const s of item.subs) assert.ok(SUBSTATS.some(x => x.key === s.key));
  }
  console.log('아이템 롤 통과');
}

function heroPowerMonotonic() {
  const base = { slot: 'weapon', rarity: 'common', ilvl: 1, name: 'x', main: { key: 'atkPct', value: 10 }, subs: [] };
  assert.ok(itemPower({ ...base, main: { key: 'atkPct', value: 20 } }) > itemPower(base), 'main 값↑ → 전투력↑');
  assert.ok(itemPower({ ...base, subs: [{ key: 'crit', value: 5 }] }) > itemPower(base), '부옵션 있으면 전투력↑');
  assert.ok(itemPower({ ...base, ilvl: 50 }) > itemPower(base), 'ilvl↑ → 전투력↑');

  const hero0 = newHero(); hero0.cls = 'knight';
  const hero1 = { ...hero0, level: 10 };
  assert.ok(heroPower(hero1) > heroPower(hero0), '레벨↑ → 전투력↑');
  const hero2 = { ...hero0, equip: { ...hero0.equip, weapon: base } };
  assert.ok(heroPower(hero2) > heroPower(hero0), '장비 있으면 전투력↑');
  console.log('전투력 단조성 통과');
}

function heroBagAndEquip() {
  const hero = newHero(); hero.cls = 'knight';
  const weak = { id: 'a', slot: 'weapon', rarity: 'common', ilvl: 1, name: 'w1', main: { key: 'atkPct', value: 5 }, subs: [] };
  const strong = { id: 'b', slot: 'weapon', rarity: 'legend', ilvl: 50, name: 'w2', main: { key: 'atkPct', value: 40 }, subs: [{ key: 'crit', value: 5 }] };
  assert.equal(addToBag(hero, weak), null);
  assert.ok(equipItem(hero, 'a'));
  assert.equal(hero.equip.weapon.id, 'a');
  assert.equal(addToBag(hero, strong), null);
  assert.ok(autoEquipAll(hero));
  assert.equal(hero.equip.weapon.id, 'b', '전투력 높은 장비로 자동 교체');
  assert.equal(hero.bag[0].id, 'a', '밀려난 장비는 가방으로');

  for (let i = 0; i < BAG_SIZE + 5; i++) {
    addToBag(hero, { id: 'c' + i, slot: 'helm', rarity: 'common', ilvl: 1, name: 'h', main: { key: 'heroHpPct', value: 1 }, subs: [] });
  }
  assert.equal(hero.bag.length, BAG_SIZE, '가방 초과 시 가장 낮은 등급 자동 판매');

  const v = sellItem(hero, hero.bag[0].id);
  assert.ok(v > 0);
  assert.equal(sellItem(hero, 'nope'), null);
  const total = sellItemsByRarity(hero, 'common');
  assert.ok(total >= 0);
  assert.ok(!hero.bag.some(it => it.rarity === 'common'), '해당 등급 전체 판매');
  console.log('가방·자동장착·판매 통과');
}

function heroJsonRoundtrip() {
  const hero = newHero();
  hero.cls = 'ranger'; hero.level = 12; hero.xp = 33; hero.autoEquip = true;
  hero.equip.weapon = rollItem(20, 'elite', mulberry32(3), 'ranger');
  hero.bag.push(rollItem(5, 'normal', mulberry32(9), 'ranger'));
  assert.deepEqual(JSON.parse(JSON.stringify(hero)), hero);
  console.log('영웅 JSON 라운드트립 통과');
}

// ── 4b) 영웅 특성 트리 ── 갈래 3개 × 6단(단은 그 갈래 포인트로 열림) · 택1 · 핵심 노드 · 궁극 특성 하나 · 혼합 노드
const KO = /[가-힣]/;
function talentTable() {
  assert.deepEqual(Object.keys(TALENTS).sort(), [...HERO_CLASS_KEYS].sort());
  const caps = new Set(), hooked = new Set(Object.keys(talentBonus({ level: 1 }, 'knight')));
  for (const cls of HERO_CLASS_KEYS) {
    const bs = TALENTS[cls];
    assert.equal(bs.length, 3, `${cls}: 3갈래`);
    const keys = new Set();
    for (const b of bs) {
      assert.ok(KO.test(b.name) && KO.test(b.desc), `${cls}.${b.key} 이름·설명`);
      const tiers = [...new Set(b.nodes.map(n => n.tier))].sort();
      assert.ok(tiers.length >= 5 && tiers.length <= 6 && tiers[0] === 0, `${cls}.${b.key}: 5~6단`);
      for (const t of tiers) { const k = b.nodes.filter(n => n.tier === t).length; assert.ok(k >= 2 && k <= 3, `${b.key} ${t + 1}단 노드 ${k}개`); }
      const cap = b.nodes.filter(n => n.cap), ks = b.nodes.filter(n => n.ks);
      assert.ok(cap.length === 1 && cap[0].tier === tiers[tiers.length - 1] && cap[0].max === 1, `${b.key}: 마지막 단에 궁극 특성 1개`);
      assert.ok(ks.length >= 1 && ks.length <= 2 && ks.every(n => n.max === 1 && n.tier >= 1 && n.tier <= 4), `${b.key}: 중간 단 핵심 노드 1~2개`);
      const ors = {};
      for (const n of b.nodes) if (n.or) (ors[n.or] ||= []).push(n);
      assert.ok(Object.keys(ors).length >= 1 && Object.values(ors).every(g => g.length === 2 && g[0].tier === g[1].tier), `${b.key}: 같은 단 택1 묶음`);
      assert.ok(b.nodes.some(n => n.max === 1) && b.nodes.some(n => n.max >= 2), `${b.key}: 랭크형 + 1랭크 섞임`);
      assert.ok(b.nodes.every(n => n.max <= 5));
      for (const n of b.nodes) {
        assert.ok(!keys.has(n.key), `${n.key} 중복`);
        keys.add(n.key);
        assert.ok(KO.test(n.name) && KO.test(n.desc) && /\d/.test(n.desc), `${n.key} 한국어 이름·숫자 있는 설명`);
        for (const k of Object.keys(n.fx)) assert.ok(TALENT_FX_KEYS.includes(k) && hooked.has(k), `${n.key}: 모르는 효과 ${k}`);
        if (n.cap) { assert.ok(!caps.has(n.cap), `${n.cap} 중복`); caps.add(n.cap); } else assert.ok(Object.keys(n.fx).length > 0, `${n.key}: 효과가 있다`);
        assert.equal(talentNode(cls, n.key).node, n);
      }
    }
    const hy = TALENT_HYBRIDS[cls];
    assert.ok(hy.length >= 1 && hy.length <= 2 && hy.every(n => n.req.length === 2 && n.req.every(k => bs.some(b => b.key === k)) && KO.test(n.name) && Object.keys(n.fx).length), `${cls}: 혼합 노드`);
  }
  assert.equal(caps.size, 15);
  assert.deepEqual([...caps].sort(), [...CAPSTONES].sort());
  // 효과 키는 전투 코드가 실제로 읽는다(hero.js / sim.js / config.js에 tb.키 참조)
  const src = ['hero.js', 'sim.js', 'config.js'].map(f => readFileSync(new URL(`../public/js/${f}`, import.meta.url), 'utf8')).join('\n');
  for (const k of TALENT_FX_KEYS) assert.ok(new RegExp(`(\\btb|heroTb\\(g\\))\\??\\.${k}\\b`).test(src), `효과 키 ${k}: 전투 코드 훅 없음`);
  console.log('특성 테이블 통과');
}

function talentRules() {
  // 예산: Lv20까지 레벨당 1점, 이후 0.44점. Lv99 = 한 갈래 전부 + 나머지 두 갈래 절반 정도(= 두 갈래 분량)
  assert.deepEqual([1, 10, 20, 40, 76, 99].map(level => talentPoints({ level })), [1, 10, 20, 28, 44, 54]);
  for (const cls of HERO_CLASS_KEYS) {
    const P = talentPoints({ level: MAX_HERO_LV }), bm = TALENTS[cls].map(b => branchMax(cls, b.key)).sort((a, b) => b - a);
    assert.ok(P >= bm[0] + (bm[1] + bm[2]) * 0.4 && P <= bm[0] + (bm[1] + bm[2]) * 0.6 + 4, `${cls}: 예산 ${P} (갈래 ${bm})`);
    assert.ok(P < talentMaxRanks(cls), `${cls}: 만렙이어도 다 못 찍는다`);
  }
  const hero = { ...newHero(), cls: 'knight', level: 12 }; // 12포인트
  // 단 해금: 2단 = 그 갈래 3점(앞 노드를 만렙 찍을 필요 없음 — 두 노드에 나눠도 된다)
  assert.equal(talentBlock(hero, 'knight', 'crusade3').code, 'tier');
  assert.ok(allocateTalent(hero, 'knight', 'crusade1') && allocateTalent(hero, 'knight', 'crusade2') && !canAllocate(hero, 'knight', 'crusade3'));
  assert.equal(nextTierNeed(hero, 'knight', 'crusade'), 1);
  assert.ok(allocateTalent(hero, 'knight', 'crusade2') && allocateTalent(hero, 'knight', 'crusade3'), '갈래 3점 → 2단');
  assert.equal(talentBlock(hero, 'knight', 'guard3').code, 'tier', '다른 갈래 포인트는 이 갈래 단을 열지 않는다');
  // 택1: 같은 or 묶음은 하나만(찍은 쪽은 계속 랭크업)
  assert.ok(allocateTalent(hero, 'knight', 'crusade4'));
  assert.equal(talentBlock(hero, 'knight', 'crusade5').code, 'or');
  assert.ok(allocateTalent(hero, 'knight', 'crusade4'), '찍은 쪽은 랭크업 가능');
  assert.equal(branchSpent(hero, 'knight', 'crusade'), 6);
  assert.ok(allocateTalent(hero, 'knight', 'crusade6'), '3단 핵심 노드');
  assert.equal(talentBonus(hero, 'knight').critBurst, 0.6);
  while (allocateTalent(hero, 'knight', 'guard1'));
  assert.equal(talentLeft(hero, 'knight'), 2);
  while (allocateTalent(hero, 'knight', 'guard2'));
  assert.equal(talentLeft(hero, 'knight'), 0);
  assert.equal(talentBlock(hero, 'knight', 'crusade7').code, 'points');
  assert.equal(talentLeft(hero, 'ranger'), 12, '포인트는 클래스마다 따로(레벨 공유)');
  assert.ok(!allocateTalent(hero, 'knight', 'nope') && !allocateTalent(hero, 'nope', 'crusade1') && !allocateTalent(hero, 'ranger', 'crusade1'));
  assert.ok(resetTalents(hero, 'knight'), '무료 초기화');
  assert.equal(talentLeft(hero, 'knight'), 12);
  assert.ok(!resetTalents(hero, 'knight'), '초기화할 것이 없음');
  // 궁극 특성은 하나만(다른 갈래 궁극은 잠김) · 혼합 노드는 두 갈래 각각 8점 · 저장 검증
  const top = { ...newHero(), cls: 'knight', level: MAX_HERO_LV };
  top.talents = { knight: branchAlloc('knight', 'crusade', true) };
  assert.equal(talentCap(top, 'knight'), 'judgeBolt');
  assert.equal(talentBlock(top, 'knight', 'oath').code, 'hybrid');
  assert.equal(talentBlock(top, 'knight', 'guard13').code, 'cap', '단이 안 열렸어도 궁극 잠김이 먼저(점수를 더 찍어도 소용없다)');
  for (const k of ['guard1', 'guard1', 'guard1', 'guard2', 'guard2', 'guard2', 'guard3', 'guard3']) assert.ok(allocateTalent(top, 'knight', k));
  assert.ok(allocateTalent(top, 'knight', 'oath'), '혼합: 수호 8 + 성전사 8');
  assert.ok(!canAllocate(top, 'knight', 'field'), '혼합: 지휘관 0점');
  top.talents.knight = { ...top.talents.knight, ...branchAlloc('knight', 'guard', false) };
  assert.equal(talentBlock(top, 'knight', 'guard13').code, 'cap', '궁극 특성은 하나만');
  assert.deepEqual(normalizeTalents(top.talents, top.level).knight, top.talents.knight, '합법 배분은 저장 검증을 통과');
  assert.equal(normalizeTalents({ knight: { ...top.talents.knight, guard13: 1 } }, 99).knight, undefined, '궁극 특성 2개 = 무효(비움)');
  assert.equal(normalizeTalents({ knight: { crusade4: 1, crusade5: 1, crusade1: 3 } }, 99).knight, undefined, '택1 둘 다 = 무효');
  assert.equal(normalizeTalents({ knight: { crusade3: 1 } }, 99).knight, undefined, '단 조건 위반 = 무효');
  assert.equal(normalizeTalents({ knight: { oath: 1 } }, 99).knight, undefined, '혼합 조건 위반 = 무효');
  assert.equal(normalizeTalents({ knight: { crusade1: 3, bogus: 1 } }, 99).knight, undefined, '모르는 노드 = 무효');
  // 저장 이전: 옛 구조(버전 없음) = 모든 클래스 환불 + 안내 1회
  assert.deepEqual(migrateTalents({ knight: { guard1: 3 }, ranger: { rapid1: 2 } }, undefined, 30), { talents: {}, notice: true });
  assert.deepEqual(migrateTalents({}, undefined, 30), { talents: {}, notice: false }, '찍은 게 없던 저장은 안내 없음');
  assert.deepEqual(migrateTalents({ knight: { crusade1: 2 } }, TALENT_VER, 30), { talents: { knight: { crusade1: 2 } }, notice: false });

  // 정비 화면(campAct): 찍기 · 초기화 · 자동 배분 토글 · 안내 닫기, 미해금 클래스 불가
  const m = defaults();
  m.hero.level = 12;
  assert.ok(campAct(m, { type: 'talent', cls: 'knight', key: 'guard1' }));
  assert.ok(!campAct(m, { type: 'talent', cls: 'cleric', key: 'heal1' }), '미해금 클래스');
  assert.ok(campAct(m, { type: 'talentReset', cls: 'knight' }) && talentSpent(m.hero, 'knight') === 0);
  assert.ok(campAct(m, { type: 'autoTalent', on: true, cls: 'knight' }) && m.hero.autoTalent);
  assert.ok(talentSpent(m.hero, 'knight') > 0 && talentLeft(m.hero, 'knight') === 0, '자동 배분을 켜는 즉시 남은 포인트를 추천대로');
  campAct(m, { type: 'talentReset', cls: 'knight' });
  m.hero.autoTalent = false;
  assert.ok(!campAct(m, { type: 'talentNoticeSeen' }));
  m.hero.talentNotice = true;
  assert.ok(campAct(m, { type: 'talentNoticeSeen' }) && !m.hero.talentNotice);

  // 도전 중: 현재 클래스만 찍기(레벨업 포인트), 초기화는 정비 화면 전용
  const g = newRun(m, { cls: 'ranger', startSpells: [] }, 1);
  while (g.pick) resolvePick(g); // 도전 시작 무료 카드
  assert.ok(act(g, 0, { type: 'talent', key: 'rapid1' }));
  assert.equal(m.hero.talents.ranger.rapid1, 1, '영구 영웅 객체에 저장');
  assert.ok(drainEvents(g).some(e => e.type === 'talent' && e.key === 'rapid1'));
  assert.ok(!act(g, 0, { type: 'talent', key: 'crusade1' }) && !act(g, 0, { type: 'talentReset' }));
  step(g, DT);
  assert.equal(g.heroUnit.tb.aspd, 0.07, '찍은 특성이 바로 반영');

  // 특성이 전투 스탯에 들어간다
  const sg = createGame({ stage: 5, seed: 1, best: 40, players: [{ lv: { wall: 20 } }, {}], hero: { ...newHero(), cls: 'knight', level: 40 } });
  const s0 = heroCombatStats(sg, sg.hero);
  sg.hero.talents = { knight: branchAlloc('knight', 'guard', false) };
  const s1 = heroCombatStats(sg, sg.hero);
  assert.ok(s1.dmg > s0.dmg * 1.2 && s1.atkSpd > s0.atkSpd && s1.maxHp > s0.maxHp * 1.25 && s1.dmgReduce > s0.dmgReduce && s1.engageR === s0.engageR + 45);

  // 봇 배분: 추천 빌드는 주력 갈래를 궁극 특성까지(Lv20이면 궁극), 만렙이면 주력 마스터 + 나머지 절반씩. 무작위 빌드도 규칙을 지킨다
  for (const cls of HERO_CLASS_KEYS) {
    const main = TALENT_BUILDS[cls][0], mainCap = TALENTS[cls].find(b => b.key === main).nodes.find(n => n.cap).cap;
    const hb = { ...newHero(), level: 20 };
    assert.equal(botTalents(hb, cls), talentPoints(hb));
    assert.ok(talentBonus(hb, cls).cap[mainCap], `${cls} 추천 빌드 Lv20 궁극 특성`);
    const hm = { ...newHero(), level: MAX_HERO_LV };
    botTalents(hm, cls);
    assert.equal(branchSpent(hm, cls, main), branchMax(cls, main), `${cls}: 주력 갈래 마스터`);
    for (const k of TALENT_BUILDS[cls].slice(1)) { const r = branchSpent(hm, cls, k) / branchMax(cls, k); assert.ok(r >= 0.3 && r <= 0.6, `${cls}.${k}: 절반 정도 ${r.toFixed(2)}`); }
    assert.ok(TALENT_HYBRIDS[cls].some(n => talentRank(hm, cls, n.key) > 0), `${cls}: 만렙 추천 빌드는 혼합 노드도`);
    const hr = { ...newHero(), level: 60 };
    assert.equal(randomTalents(hr, cls, mulberry32(7)), talentPoints(hr));
    assert.ok(Object.keys(talentBonus(hr, cls).cap).length <= 1);
    assert.deepEqual(normalizeTalents(hr.talents, hr.level), hr.talents, '무작위 빌드도 유효');
  }
  console.log('특성 배분·초기화 규칙 통과(예산 · 단 해금 · 택1 · 궁극 하나 · 혼합 · 이전)');
}

// 한 갈래 전부(택1은 앞 노드, 궁극 특성 포함/제외)
function branchAlloc(cls, bkey, withCap) {
  const a = {}, seen = new Set();
  for (const n of TALENTS[cls].find(b => b.key === bkey).nodes) {
    if ((n.cap && !withCap) || (n.or && seen.has(n.or))) continue;
    if (n.or) seen.add(n.or);
    a[n.key] = n.max;
  }
  return a;
}
const CAP_BRANCH = Object.fromEntries(Object.entries(TALENTS).flatMap(([cls, bs]) => bs.map(b => [b.nodes.find(n => n.cap).cap, [cls, b.key]])));
function capGame(cap, withCap, extra = {}) {
  const [cls, bkey] = CAP_BRANCH[cap];
  return createGame({
    stage: 8, best: 40, seed: 300, players: [{ lv: { atk: 20, rate: 3, wall: 20 } }, { lv: { wall: 20 } }], run: buff(0, 20),
    hero: { ...newHero(), cls, level: 60, talents: { [cls]: branchAlloc(cls, bkey, withCap) } }, ...extra,
  });
}
function runHero(g, secs, ult = true) {
  const ev = [];
  for (let t = 0; t < secs && g.phase === 'play'; t += DT) {
    if (g.pick) { resolvePick(g, ev); continue; }
    if (ult && g.heroUnit.ultCd <= 0 && g.heroUnit.state !== 'down' && ultWorth(g, g.heroUnit)) act(g, 0, { type: 'heroUlt' });
    step(g, DT);
    ev.push(...drainEvents(g));
  }
  return ev;
}

// 궁극 특성 15종: 켜면 전투 방식이 눈에 띄게 달라진다(전용 이벤트·소환물·상태), 끄면 그 동작이 없다
function talentCapstones() {
  const proc = k => ev => ev.filter(e => e.type === 'heroProc' && e.kind === k).length;
  const summ = k => (ev, g) => g.summons.filter(s => s.kind === k).length;
  const SIGNAL = {
    shieldToss: proc('shieldToss'), judgeBolt: proc('judgeBolt'), warcry: proc('warcry'), snipe: proc('snipe'), arrowStorm: proc('arrowStorm'),
    meteor: proc('meteor'), pillar: proc('pillar'), scythe: proc('scythe'), plague: proc('plague'),
    absZero: ev => ev.filter(e => e.type === 'heroUlt' && e.variant === 'absZero').length,
    wolfPack: summ('wolf'), shadowTwins: summ('shadow'), arcaneClone: summ('arcane'),
  };
  const rows = [];
  for (const [cap, sig] of Object.entries(SIGNAL)) {
    const on = capGame(cap, true), off = capGame(cap, false);
    const a = sig(runHero(on, 25), on), b = sig(runHero(off, 25), off);
    rows.push(`${cap} ${a}/${b}`);
    assert.ok(a > b, `${cap}: 궁극 특성이 동작을 바꾼다 (${a} vs ${b})`);
    if (cap !== 'wolfPack') assert.equal(b, 0, `${cap}: 궁극 특성 없이는 그 동작이 없다`);
    // 절대영도는 궁극기가 양쪽 다 한 방에 끝내면(초과 피해 제외) 피해가 같을 수 있다 — 아래 빙결 검사로 본다
    if (cap !== 'absZero') assert.notEqual(on.dmgDone[2], off.dmgDone[2], `${cap}: 영웅 피해량이 달라진다`);
  }
  // 절대영도: 궁극기에 맞은 적이 얼어붙는다
  const az = capGame('absZero', true);
  runHero(az, 3, false);
  const tgt = az.enemies.find(e => !e.dead && !e.named);
  if (tgt) { az.heroUnit.x = tgt.x; az.heroUnit.y = tgt.y; az.heroUnit.ultCd = 0; act(az, 0, { type: 'heroUlt' }); assert.ok(tgt.dead || tgt.stunT >= 2.5, '절대영도 빙결'); }
  // 비전 분신: 영웅 공격을 따라 한다
  const ac = capGame('arcaneClone', true), aev = runHero(ac, 15);
  assert.ok(aev.some(e => e.type === 'summonAttack' && e.kind === 'arcane'), '비전 분신 공격');
  // 부활 결계 강화: 성벽이 무너지면 도전마다 1회 성직자가 되살린다
  for (const withCap of [true, false]) {
    const g = createGame({ stage: 40, seed: 6, best: 40, players: [{}, {}], hero: { ...newHero(), cls: 'cleric', level: 60, talents: { cleric: branchAlloc('cleric', 'heal', withCap) } } });
    const ev = [];
    runUntilEnd(g, 600, ev);
    const rv = ev.filter(e => e.type === 'revive' && e.hero);
    assert.equal(rv.length, withCap ? 1 : 0, '부활 결계 강화 1회');
    if (withCap) {
      assert.ok(Math.abs(rv[0].hp - g.wall.max * 0.4) < 1e-6 && g.run.heroRevive);
      assert.equal(normalizeRun(JSON.parse(JSON.stringify(serializeRun(g)))).heroRevive, true, '이어하기에도 남는다');
    }
  }
  // 카드 축복: 스킬 카드를 고르면 30% 확률로 레벨 +1
  for (const withCap of [true, false]) {
    const g = capGame('cardBless', withCap);
    let blessed = 0;
    for (let k = 0; k < 60; k++) {
      g.spells = {};
      g.pick = { cards: [{ spell: 'iceLance', level: 1, rarity: 'common', fusionHint: false }], autoLeft: null };
      act(g, 0, { type: 'pick', index: 0 });
      if (g.spells.iceLance === 2) blessed++;
    }
    assert.ok(withCap ? blessed >= 8 && blessed <= 30 : blessed === 0, `카드 축복 ${blessed}/60`);
  }
  // 비전 충전: 층마다 쌓여 100%가 되면 그 층에 카드 1장 더
  const pk = arcane => {
    const g = createGame({ stage: 8, seed: 21, best: 40, players: [{ lv: TR_MAX }, { lv: TR_MAX }], hero: { ...newHero(), cls: 'sorcerer', level: 60, talents: { sorcerer: arcane ? branchAlloc('sorcerer', 'arcane', true) : {} } }, run: buff(40, 40, { arcane: 0.9 }) });
    const ev = [];
    runUntilEnd(g, 600, ev);
    return ev.filter(e => e.type === 'pickOffer').length;
  };
  assert.ok(pk(true) > pk(false), '비전 충전 추가 카드');
  console.log('궁극 특성 15종 통과: ' + rows.join(' · '));
}

// 핵심 노드(ks)·혼합 노드: 켜면 전투가 실제로 달라진다(전용 nova 이벤트 · 피해량 · 성벽 회복)
function talentKeystones() {
  const rows = [];
  for (const [cls, bs] of Object.entries(TALENTS)) for (const b of bs) for (const n of b.nodes.filter(x => x.ks)) {
    const fxKey = Object.keys(n.fx)[0];
    const mk = withKs => {
      const a = branchAlloc(cls, b.key, false);
      if (!withKs) delete a[n.key];
      const g = createGame({ stage: 8, best: 40, seed: 301, players: [{ lv: { atk: 20, rate: 3, wall: 20 } }, { lv: { wall: 20 } }], run: buff(0, 20),
        hero: { ...newHero(), cls, level: 60, talents: { [cls]: a } } });
      if (fxKey === 'emergency') g.wall.hp = g.wall.max * 0.3;
      return g;
    };
    const secs = fxKey === 'emergency' ? 14 : 25, on = mk(true), off = mk(false), ult = fxKey !== 'emergency', evOn = runHero(on, secs, ult), evOff = runHero(off, secs, ult);
    const nova = ev => ev.filter(e => e.type === 'heroProc' && e.kind === 'nova' && e.sub === fxKey).length;
    const sig = fxKey === 'emergency' ? on.wall.hp > off.wall.hp : nova(evOn) > 0 || on.dmgDone[2] !== off.dmgDone[2];
    rows.push(`${n.key}(${fxKey}) ${nova(evOn)}`);
    assert.ok(sig, `${cls}.${n.key} ${n.name}: 핵심 노드가 전투를 바꾼다`);
    assert.equal(nova(evOff), 0, `${n.key}: 없으면 발동 없음`);
  }
  // 혼합 노드도 수치가 실제로 들어간다
  for (const [cls, hs] of Object.entries(TALENT_HYBRIDS)) for (const n of hs) {
    const h = { ...newHero(), cls, level: MAX_HERO_LV, talents: {} };
    for (const bk of n.req) h.talents[cls] = { ...h.talents[cls], ...branchAlloc(cls, bk, false) };
    const before = talentBonus(h, cls);
    assert.ok(allocateTalent(h, cls, n.key), `${n.key} 찍힘`);
    const after = talentBonus(h, cls);
    for (const [k, v] of Object.entries(n.fx)) assert.ok(Math.abs(after[k] - before[k] - v) < 1e-9, `${n.key}.${k}`);
  }
  console.log('핵심 노드 15종 · 혼합 노드 통과: ' + rows.join(' · '));
}

// 소환물: 늑대(야수)가 필드 유닛으로 나오고, 영웅이 쓰러지면 사라졌다가 부활과 함께 돌아온다
function heroSummons() {
  const g = capGame('wolfPack', true);
  const ev = runHero(g, 0.1, false);
  const wolves = g.summons.filter(s => s.kind === 'wolf');
  assert.equal(wolves.length, 4, '야생의 부름 + 짝늑대 + 늑대 무리 2');
  assert.equal(ev.filter(e => e.type === 'summonSpawn' && e.kind === 'wolf').length, 4);
  for (const k of ['id', 'kind', 'x', 'y', 'facing', 'dir', 'speed', 'gait', 'state', 'windup']) assert.ok(k in wolves[0], `소환물 렌더 필드 ${k}`);
  const ev2 = runHero(g, 15, false);
  assert.ok(ev2.some(e => e.type === 'summonAttack' && e.kind === 'wolf'), '늑대가 싸운다');
  assert.ok(ev2.some(e => e.type === 'hit' && e.o === 2 && e.kind === 'wolf'), '늑대 피해는 영웅 몫(o:2)');
  heroTakeDamage(g, 1e30, { emit: (gg, e) => gg.events.push(e), damage: () => 0 });
  assert.equal(g.heroUnit.state, 'down');
  assert.equal(g.summons.length, 0, '영웅이 쓰러지면 소환물도 사라진다');
  assert.equal(drainEvents(g).filter(e => e.type === 'summonDespawn').length, 4);
  runHero(g, g.heroUnit.respawnT + 0.5, false);
  assert.ok(g.heroUnit.state !== 'down' && g.summons.length === 4, '부활하면 다시 나온다');
  const sh = capGame('shadowTwins', true);
  runHero(sh, 0.1, false);
  assert.equal(sh.summons.filter(s => s.kind === 'shadow').length, 2, '그림자 분신 2체');
  startStage(sh, 7);
  assert.equal(sh.summons.length, 0, '새 층에서 영웅과 함께 다시 나온다');
  runHero(sh, 0.1, false);
  assert.equal(sh.summons.length, 2);
  console.log('소환물 통과');
}

// ── 4c) 필드 자율 전투 AI ──
// 스폰을 멈추고 첫 적 하나만 남겨 원하는 곳에 세워 둔다(죽지 않고 움직이지 않게)
function roamGame(cls, x, y, seed = 400) {
  const g = createGame({ stage: 3, best: 40, seed, players: [{ lv: { wall: 20 } }, { lv: { wall: 20 } }], hero: { ...newHero(), cls, level: 20 } });
  for (let k = 0; k < 600 && !g.enemies.length; k++) step(g, DT);
  g.spawns.length = g.spawnIdx;
  const e = g.enemies[0];
  g.enemies.length = 1;
  Object.assign(e, { x, y, hp: 1e15, maxHp: 1e15, speed: 0 });
  drainEvents(g);
  return { g, e };
}
const d2h = (h, p) => Math.hypot(h.x - p.x, h.y - p.y);
function heroRoaming() {
  // 1) 적이 전장(전선 아래) 어디에 나타나든 성문을 떠나 찾아간다(옛 520px 목줄 밖: 성문에서 ~570px)
  for (const cls of ['knight', 'ranger']) {
    const { g, e } = roamGame(cls, 620, 420);
    const h = g.heroUnit;
    h.x = HERO_GATE.x; h.y = HERO_GATE.y;
    const d0 = d2h(h, e);
    runHero(g, 1, false);
    assert.ok(h.speed > 0 && h.gait === 'run' && (h.mode === 'engage' || h.mode === 'kite'), `${cls}: 달려간다 (${h.gait}, ${h.mode})`);
    runHero(g, 2, false);
    assert.ok(HERO_GATE.y - h.y > 150 && d2h(h, e) < d0 - 150, `${cls}: 3초 안에 성문을 떠나 적에게 간다`);
    const ev = runHero(g, 9, false);
    assert.ok(ev.some(x => x.type === 'heroAttack'), `${cls}: 도착해서 싸운다`);
    if (cls === 'ranger') assert.ok(d2h(h, e) <= g.heroUnit.st.range + e.r && d2h(h, e) > 120, '궁수: 사거리 끝에서 쏜다');
    else assert.ok(d2h(h, e) <= g.heroUnit.st.range + e.r + 2, '기사: 붙어서 벤다');
  }
  // 2) 원거리 카이팅: 적이 바짝 붙으면 물러나면서 계속 쏜다
  {
    const { g, e } = roamGame('ranger', 360, 450);
    const h = g.heroUnit;
    h.x = 360; h.y = 480;
    e.speed = 40;
    let movingShots = 0;
    for (let t = 0; t < 3; t += DT) {
      step(g, DT);
      for (const x of drainEvents(g)) if (x.type === 'heroAttack' && h.speed > 5) movingShots++;
    }
    assert.ok(d2h(h, e) > 110, `궁수: 거리를 벌린다 (${d2h(h, e).toFixed(0)})`);
    assert.ok(movingShots > 0, '궁수: 이동 사격');
  }
  // 3) 체력 30% 아래 → 성벽 쪽으로 후퇴해 회복 → 다시 전진
  {
    const { g, e } = roamGame('knight', 360, 400);
    const h = g.heroUnit;
    runHero(g, 6, false);
    assert.equal(h.mode, 'engage');
    h.hp = h.maxHp * 0.2;
    let ev = runHero(g, 0.2, false);
    assert.ok(h.mode === 'retreat' && ev.some(x => x.type === 'heroRetreat'), '후퇴 시작');
    assert.equal(h.engageR, 0, '후퇴 중엔 도발하지 않는다');
    ev = runHero(g, 30, false);
    assert.ok(ev.some(x => x.type === 'heroAdvance'), '회복 후 재진격');
    assert.ok(h.hp >= h.maxHp * 0.8 - 1, '회복');
    assert.ok(h.mode === 'engage' && d2h(h, e) < 200, '다시 적에게');
  }
  // 4) 적이 없으면 전장 중앙 집결 지점에서 두리번(성문에 박혀 있지 않음)
  {
    const { g } = roamGame('sorcerer', 360, 60, 401); // 적은 스폰 구역(y < ROAM_TOP)에만 — 쫓지 않는다
    const h = g.heroUnit;
    let flips = 0, f0 = h.facing;
    for (let t = 0; t < 14; t += DT) {
      step(g, DT);
      if (h.facing !== f0) { flips++; f0 = h.facing; }
    }
    assert.ok(d2h(h, HERO_RALLY) < 100 && HERO_GATE.y - h.y > 250, `집결 지점 (${h.x.toFixed(0)},${h.y.toFixed(0)})`);
    assert.ok(h.mode === 'rally' && flips >= 3, `두리번 ${flips}`);
  }
  // 5) 탭 이동은 유지: 지정 위치로 가서 머물다 자율 전투로 복귀
  {
    const { g } = roamGame('knight', 600, 420);
    const h = g.heroUnit;
    act(g, 0, { type: 'heroMove', x: 120, y: 800 });
    runHero(g, 4, false);
    assert.ok(h.mode === 'move' && d2h(h, { x: 120, y: 800 }) < 5, '탭 이동');
    runHero(g, 4, false);
    assert.ok(!h.moveTo && h.mode === 'engage', '홀드 후 자율 전투');
  }
  // 6) 영웅이 대신 맞은 피해는 성벽 손실이 아니다(자동 강화가 성벽을 과하게 사지 않게)
  {
    const g = createGame({ stage: 3, seed: 402, players: [{}, {}], hero: { ...newHero(), cls: 'knight', level: 20 } });
    step(g, DT);
    const lost = g.wallLost;
    heroTakeDamage(g, 50, { emit: () => {} });
    assert.equal(g.wallLost, lost);
  }
  console.log('필드 자율 전투 AI 통과');
}

// ── 5) 로그라이트: 메타 ↔ 런 ──
function metaUpgrades() {
  // 보석 강화 = 편의·구조만(마력·시전 속도·성벽·시작 골드는 없다)
  const m = defaults();
  assert.deepEqual(Object.keys(m.metaLv).sort(), [...META_KEYS].sort());
  assert.ok(['power', 'haste', 'ward', 'startGold'].every(k => !META_KEYS.includes(k)), '겹치던 보석 강화 정리');
  assert.ok(['greed', 'wisdom', 'choice', 'reroll', 'startSlot', 'revive', 'critBoom', 'pickaxe'].every(k => META_KEYS.includes(k)));
  assert.ok(!buyMeta(m, 'greed'), '보석 부족');
  m.gems = 1e6;
  const c0 = metaCost('greed', 0);
  assert.ok(buyMeta(m, 'greed') && campAct(m, { type: 'meta', key: 'greed' }));
  assert.equal(m.gems, 1e6 - c0 - metaCost('greed', 1));
  assert.equal(m.metaLv.greed, 2);
  assert.ok(!buyMeta(m, 'nope') && !buyMeta(m, 'power'));
  while (buyMeta(m, 'revive'));
  assert.equal(m.metaLv.revive, metaMax('revive'), '최대 레벨');
  for (const k of META_KEYS) assert.ok(metaCost(k, 1) >= metaCost(k, 0), `${k} 비용 증가`);
  assert.ok(Math.abs(metaFx({ greed: 2 }).goldMul - 1.05 ** 2) < 1e-12 && metaFx({}).atkMul === 1);

  // 마법사 수련(골드): 5종 · 상한 낮음 · 비용 증가 · 두 마법사 공통
  assert.deepEqual(MAGE_TRAINING.map(t => t.key), ['atk', 'rate', 'crit', 'multi', 'wall']);
  for (const t of MAGE_TRAINING) {
    assert.ok(t.max <= 25 && t.per <= 0.05 && /[가-힣]/.test(t.name + t.desc), `${t.key}: 레벨당 작고 상한 낮다`);
    assert.ok(trainCost(t.key, 1) > trainCost(t.key, 0) && trainDisplay(t.key, 3).length > 0);
  }
  const t = defaults();
  assert.deepEqual(t.training, lv0());
  assert.ok(!buyTraining(t, 'atk'), '골드 부족');
  t.gold = 1e9;
  const g0 = t.gold, ac = trainCost('atk', 0);
  assert.ok(buyTraining(t, 'atk') && t.training.atk === 1 && t.gold === g0 - ac);
  assert.ok(campAct(t, { type: 'train', stat: 'crit' }) && t.training.crit === 1);
  assert.ok(!buyTraining(t, 'nope') && !campAct(t, { type: 'train', stat: 'power' }));
  while (buyTraining(t, 'multi'));
  assert.equal(t.training.multi, trainMax('multi'), '수련 상한');
  const spent = 1e9 - t.gold;
  assert.equal(botSpendGold({ ...defaults(), gold: 0 }).length, 0);
  // 수련 효과: 마력 +4%/레벨, 치명타 +1.5%p, 다중 시전 = 발사체·연속 시전, 성벽 +5% — 두 마법사(AI 동료 포함) 모두
  t.training = { atk: 10, rate: 10, crit: 10, multi: 4, wall: 10 };
  t.metaLv.reroll = 1; t.metaLv.critBoom = 2;
  const g = newRun(t, { cls: 'knight' }, 1);
  const base = newRun(defaults(), { cls: 'knight' }, 1);
  for (const i of [0, 1]) {
    assert.deepEqual(g.players[i].lv, t.training, `마법사 ${i}: 같은 수련`);
    assert.ok(Math.abs(g.players[i].stats.dmg - floorPower(1) * 1.4) < 1e-9, '마력 +40%');
    assert.ok(Math.abs(g.players[i].stats.crit - (base.players[i].stats.crit + 0.15)) < 1e-9, '치명타 +15%p');
    assert.ok(g.players[i].stats.rate > base.players[i].stats.rate && g.players[i].stats.cdMul > 1, '시전 속도');
    assert.ok(g.players[i].stats.shots === 3 && g.players[i].stats.echo > 0, '다중 시전');
  }
  assert.ok(Math.abs(g.wall.max / base.wall.max - 1.5) < 0.01, '성벽 +50%');
  assert.ok(g.players[0].stats.boomR > 0, '치명타 폭발 적용');
  assert.equal(g.rerollLeft, 1);
  assert.equal(g.players[0].gold, 0, '도전은 골드 0에서 시작(번 골드만 센다)');
  assert.ok(spent > 0);
  console.log('영구 강화 · 마법사 수련 통과');
}

function runLifecycle() {
  const m = defaults();
  m.hero.autoEquip = true;
  // 로드아웃 검증: 해금 안 된 클래스·뽑아 본 적 없는 스킬·슬롯 초과는 걸러진다
  m.seenSpells = ['fireball', 'tornado', 'gale'];
  assert.deepEqual(validLoadout(m, { cls: 'assassin', startSpells: ['fireball'] }), { cls: 'knight', startSpells: [] }, '슬롯 0');
  m.metaLv.startSlot = 2;
  assert.deepEqual(validLoadout(m, { cls: 'ranger', startSpells: ['judgment', 'fireball', 'fireball', 'tornado', 'gale'] }), { cls: 'ranger', startSpells: ['fireball', 'tornado'] });
  assert.deepEqual(startSpellChoices(m), ['fireball', 'tornado', 'gale']);

  // 시작 스킬은 Lv1이라 융합 짝이어도 바로 합체하지 않는다(두 재료 만렙이 조건) + 도전 시작 무료 카드
  const g = newRun(m, { cls: 'ranger', startSpells: ['fireball', 'tornado'] }, 7);
  assert.equal(m.hero.cls, 'ranger');
  assert.deepEqual(g.spells, { fireball: 1, tornado: 1 });
  assert.ok(!g.fusions.length, '시작하자마자 합체하지 않는다');
  assert.ok(g.pick && g.pick.cards.length === 3 && START_CARDS === 1, '도전 시작 무료 카드');
  assert.equal(g.stage, 1);
  assert.deepEqual(m.run, g.run.checkpoint, '새 도전 → 이어하기 저장 생성');
  assert.deepEqual(m.lastLoadout, { cls: 'ranger', startSpells: ['fireball', 'tornado'] });
  assert.ok(!act(g, 0, { type: 'heroClass', cls: 'knight' }) || g.phaseT === 0, '도전 중 클래스 고정');
  g.players[0].auto = true;

  // 몇 층 진행 → 체크포인트는 스테이지 시작 시점
  const ev = [];
  let cleared = 0;
  while (cleared < 3) {
    playStage(g, 900, ev);
    assert.equal(g.phase, 'clear', `${g.stage}층 클리어`);
    cleared++;
    // 클리어 화면에서 앱이 꺼져도: 체크포인트는 이미 다음 층(첫 돌파 보석·골드가 들어 있다)
    assert.deepEqual([g.run.checkpoint.stage, g.run.checkpoint.floors, g.run.checkpoint.gems.first, g.run.checkpoint.players[0].gold],
      [g.stage + 1, g.run.floors, g.run.gems.first, g.players[0].gold], '클리어 즉시 다음 층 체크포인트');
    const cpClear = g.run.checkpoint;
    startStage(g, g.stage + 1);
    assert.deepEqual(g.run.checkpoint, cpClear, '다음 층 시작 체크포인트와 같다');
  }
  assert.equal(g.run.floors, 3);
  const cp = g.run.checkpoint;
  assert.equal(cp.stage, 4);
  assert.equal(cp.floors, 3);
  assert.equal(cp.players[0].gold, g.players[0].gold);
  assert.ok(!act(g, 0, { type: 'heroClass', cls: 'knight' }), '2층부터 클래스 변경 불가');
  // 도전 중 판매 골드는 체크포인트에도(아이템은 영웅에서 바로 빠진다 — 이어하기·포기로 되돌아가지 않게)
  g.hero.bag.push(rollItem(10, 'elite', mulberry32(9), g.hero.cls));
  const cg0 = cp.players[0].gold, pg0 = g.players[0].gold;
  assert.ok(act(g, 0, { type: 'sell', itemId: g.hero.bag[g.hero.bag.length - 1].id }));
  assert.ok(g.players[0].gold > pg0 && cp.players[0].gold - cg0 === g.players[0].gold - pg0, '판매 골드 → 체크포인트');

  // 이어하기: JSON 왕복 → 같은 스테이지 시작 상태
  const saved = JSON.parse(JSON.stringify(cp));
  const r = restoreRun(m, saved, 99);
  assert.equal(r.stage, 4);
  assert.deepEqual(serializeRun(r), cp, '복원 직후 = 체크포인트');
  assert.equal(r.wall.max, g.wall.max);
  assert.equal(r.players[0].stats.dmg, g.players[0].stats.dmg);
  assert.equal(r.rerollLeft, g.rerollLeft);
  assert.equal(restoreRun(m, null), null);
  // 깨진 런 저장도 throw 없이 1층 빈 런
  for (const bad of [5, 'x', [], { stage: 'NaN', players: 3, spells: { fireball: 99, nope: 1 }, awaken: { power: -3 } }]) {
    const n = normalizeRun(bad);
    assert.ok(n.stage >= 1 && n.players.length === 2 && Object.values(n.spells).every(v => v >= 1 && v <= SPELL_MAX_LV));
  }
  const n7 = normalizeRun({ spells: Object.fromEntries(SPELL_KEYS.map(k => [k, 2])) });
  assert.equal(Object.keys(n7.spells).length, SPELL_SLOTS, '슬롯 초과 스킬은 버림');

  // 성벽 붕괴 → 도전 종료 → 정산
  playStage(r, 900);
  while (r.phase === 'clear') { startStage(r, r.stage + 1); playStage(r, 900); }
  assert.equal(r.phase, 'defeat');
  assert.ok(r.run.over && !r.run.victory);
  const deadCp = r.run.checkpoint;
  startStage(r, r.stage); // 옛 '재도전' 경로
  assert.ok(r.phase === 'defeat' && r.run.checkpoint === deadCp, '끝난 도전은 다시 시작되지 않는다(체크포인트 유지)');
  const gems0 = m.gems, best0 = m.best;
  const sum = endRun(r, m);
  assert.equal(sum.floorsCleared, r.run.floors);
  assert.equal(sum.stageReached, r.stage);
  assert.equal(sum.rewards.gems, sum.rewards.floor + sum.rewards.first + sum.rewards.boss + sum.rewards.flawless + sum.rewards.best);
  assert.equal(m.gems, gems0 + sum.rewards.gems);
  assert.equal(m.best, Math.max(best0, sum.floorsCleared));
  assert.equal(sum.newBest, sum.floorsCleared > best0);
  assert.equal(sum.rewards.best, RUN_GEMS.best(best0, sum.floorsCleared), '신기록 보너스');
  assert.ok(sum.rewards.first > 0, '첫 돌파 보석');
  assert.equal(m.run, null, '이어하기 저장 삭제');
  assert.equal(m.runs, 1);
  // 골드는 영구 재화: 이번 도전에서 번 골드가 meta.gold에 쌓이고 다음 도전에도 남는다
  assert.ok(sum.rewards.gold > 0 && sum.rewards.gold === Math.floor(r.players[0].gold));
  assert.equal(m.gold, sum.rewards.gold);
  const next = newRun(m, { cls: 'ranger' }, 8);
  assert.equal(m.gold, sum.rewards.gold, '새 도전을 시작해도 골드는 그대로');
  assert.equal(next.players[0].gold, 0);
  const s2 = endRun(next, m);
  assert.equal(m.gold, sum.rewards.gold + s2.rewards.gold, '도전마다 누적');
  assert.ok(botSpendGold(m).length > 0 && m.gold < sum.rewards.gold + s2.rewards.gold && Object.values(m.training).some(v => v > 0), '골드 → 마법사 수련');
  m.runs = 1;
  assert.ok(m.seenSpells.includes('fireball'));
  assert.equal(endRun(r, m), null, '두 번 정산 없음');
  if (sum.floorsCleared >= 10) assert.ok(sum.bossesKilled >= 1 && sum.rewards.boss > 0);

  // 클래스 해금은 최고 기록 기준(20층 성직자)
  const u = defaults();
  u.best = 19;
  const ug = newRun(u, { cls: 'knight' }, 3);
  ug.run.floors = 20; // 20층까지 돌파한 것으로
  u.best = 20; // UI가 클리어마다 data.best를 올려 둔 경우에도
  assert.deepEqual(endRun(ug, u).newClasses, ['cleric']);

  // 정비 화면 영웅 조작: 해금된 클래스만, 판매 골드는 바로 영구 골드로
  assert.ok(campAct(u, { type: 'heroClass', cls: 'cleric' }) && u.hero.cls === 'cleric');
  assert.ok(!campAct(u, { type: 'heroClass', cls: 'assassin' }));
  assert.ok(!campAct(u, { type: 'sell', itemId: 'x' }));
  u.hero.bag.push(rollItem(10, 'elite', mulberry32(4), 'cleric'));
  const ug0 = u.gold;
  assert.ok(campAct(u, { type: 'sell', itemId: u.hero.bag[u.hero.bag.length - 1].id }) && u.gold > ug0, '정비 화면 판매 → 골드');
  assert.ok(campAct(u, { type: 'autoEquip', on: true }) && u.hero.autoEquip);
  // 오프라인 보상 지급
  const lv0h = u.hero.level;
  const ups = applyOffline(u, { gems: 7, xp: 1e5, minutes: 60 });
  assert.ok(u.hero.level > lv0h && ups.length === u.hero.level - lv0h);
  console.log('런 생애주기(로드아웃·이어하기·정산) 통과');
}

function reviveWard() {
  const g = createGame({ stage: 40, players: [{}, {}], seed: 6, metaLv: { revive: 1 } });
  const ev = [];
  runUntilEnd(g, 600, ev);
  assert.equal(g.phase, 'defeat');
  const rv = ev.filter(e => e.type === 'revive');
  assert.equal(rv.length, 1, '부활 결계는 도전마다 1회');
  assert.ok(g.run.reviveUsed);
  const i = ev.indexOf(rv[0]);
  assert.ok(ev.slice(0, i).every(e => e.type !== 'defeat'), '부활이 먼저');
  assert.ok(Math.abs(rv[0].hp - g.wall.max * 0.5) < 1e-6, '성벽 50%로 회복');
  // 이어하기에도 사용 여부가 남는다
  assert.equal(normalizeRun(JSON.parse(JSON.stringify(serializeRun(g)))).reviveUsed, true);
  // 부활 없으면 바로 패배
  const g2 = createGame({ stage: 40, players: [{}, {}], seed: 6 });
  const ev2 = [];
  runUntilEnd(g2, 600, ev2);
  assert.ok(!ev2.some(e => e.type === 'revive'));
  console.log('부활 결계 통과');
}

// 학살 가속: 압도적이면 층이 15~25초, 적이 남아 있으면 가속 없음 · 광폭화로 교착 없음
function slaughterPace() {
  const lv = TR_MAX;
  for (const s of [1, 5, 15]) {
    const g = createGame({ stage: s, players: [{ lv }, { lv }], seed: 30 + s, run: buff(999, 100, { spells: { fireball: 5, iceLance: 5, lightningStrike: 5 } }) });
    runUntilEnd(g, 300);
    assert.equal(g.phase, 'clear');
    assert.ok(g.result.time >= 10 && g.result.time <= 30, `${s}층 압도: ${g.result.time.toFixed(1)}초`); // 접근로(전선 위)를 지나는 시간만큼 옛 15~25초보다 조금 길다
  }
  // 약한 쪽(적이 남음)은 원래 스폰 일정대로
  const w = createGame({ stage: 1, players: [bot('P1'), bot('P2')], seed: 34, run: WALL });
  runUntilEnd(w, 300);
  assert.ok(w.result.time > 30, `1층 기본 ${w.result.time.toFixed(1)}초`);
  // 광폭화: 80초를 넘기면 이벤트 + 적 피해 배율, 서리·회오리 교착도 결국 끝난다
  const b = createGame({ stage: 12, players: [{ lv: { atk: 20, wall: 20 } }, { lv: { wall: 20 } }], seed: 35, run: buff(0, 20, { spells: { frostWard: 5, tornado: 5, holyLight: 5 } }) });
  const ev = [];
  runUntilEnd(b, 400, ev);
  assert.notEqual(b.phase, 'play', '교착 없음');
  if (ev.some(e => e.type === 'berserk')) assert.ok(b.berserk > 1);
  console.log('학살 가속·광폭화 통과');
}

// ── 5c) 초반 템포(사용자: "마법이 터지는 와중 영웅이 가운데서 싸워야") ──
// 새 저장 첫 도전 1~10층(기사·궁수·마법사 × 시드 2): 적이 전장 가운데까지 밀려와 버티고, 영웅이 가운데서 싸우고, 스킬이 끊임없이 터진다
function earlyPace() {
  const rs = [];
  for (const cls of ['knight', 'ranger', 'sorcerer']) for (const seed of [1, 2]) rs.push({ cls, seed, ...earlyPacing({ seed, cls }) });
  const m = k => avg(rs.map(r => r[k]));
  console.log(`초반 템포(1~10층): 적 교전 생존 ${m('fought').toFixed(2)}초(중앙값 평균) · 중앙 띠 처치 ${(m('midKill') * 100).toFixed(0)}% · 영웅 중앙 띠 ${(m('heroMid') * 100).toFixed(0)}% · 스킬 시전 ${m('castsPerMin').toFixed(0)}/분 · 도달 ${rs.map(r => r.reached).join(',')}`);
  assert.ok(m('fought') >= 1.5 && m('fought') <= 3, `적 교전 생존 ${m('fought').toFixed(2)}초 (목표 1.5~3)`);
  assert.ok(m('midKill') >= 0.7, `중앙 띠(y 380~700) 처치 ${(m('midKill') * 100).toFixed(0)}% (목표 대부분)`);
  assert.ok(m('heroMid') >= 0.6, `영웅이 싸우는 시간 중 중앙 띠 ${(m('heroMid') * 100).toFixed(0)}% (목표 60%+)`);
  assert.ok(rs.every(r => r.reached >= 9), '1~9층 패배 없음');
  assert.ok(rs.every(r => r.castsPerMin >= 12), '스킬 시전 5초에 1번 이상');
  // 1층부터: 무료 카드 스킬이 3~5초마다(또는 더 자주) 시전
  for (const cls of ['knight', 'ranger', 'sorcerer']) {
    const r = earlyPacing({ seed: 3, cls, floors: 1 });
    assert.ok(r.castsPerMin >= 12, `${cls} 1층 스킬 시전 ${r.castsPerMin.toFixed(1)}/분`);
  }
  console.log('초반 템포 통과');
}

// ── 5d) 사람처럼 하는 첫 도전(자동 진행 + 카드 자동 선택 — 4차부터 자동 진행이 운석·빙결도 누른다, 망각은 안 씀) ──
// 새 저장에서 열린 클래스 × 시작 무료 카드(STARTER) 전부: 1~2층에서 지지 않는다(회오리 + 기사 1층 패배 재발 방지). 첫 도전 층수도 목표(8~15) 안
function humanFirstRun() {
  const play = (cls, seed, first) => {
    const g = newRun(defaults(), { cls, startSpells: [] }, seed);
    humanPlayer(g);
    if (first) { assert.ok(g.pick.starter); g.pick.cards[0] = { spell: first, level: 1, rarity: SKILL_BY_KEY[first].rarity, fusionHint: false }; act(g, 0, { type: 'pick', index: 0 }); }
    for (;;) {
      playStage(g);
      if (g.phase !== 'clear' || g.run.over || (first && g.stage >= 2)) break;
      startStage(g, g.stage + 1);
    }
    return g.phase === 'clear' ? g.stage : g.stage - 1;
  };
  const melee = cls => HERO_CLASSES[cls].melee;
  for (const cls of HERO_CLASS_KEYS) { // 근접 영웅의 시작 무료 카드엔 회오리가 나오지 않는다
    for (let s = 1; s <= 12; s++) {
      const g = newRun(defaults(), { cls, startSpells: [] }, s);
      assert.ok(g.pick.starter && !(melee(g.hero.cls) && g.pick.cards.some(c => c.spell === 'tornado')), `${g.hero.cls} 시작 카드에 회오리`);
    }
  }
  for (const cls of unlockedClasses(0)) for (const first of STARTER.filter(k => !(melee(cls) && k === 'tornado'))) for (const seed of [1, 2, 3]) {
    assert.ok(play(cls, seed, first) >= 2, `${cls} + ${first} 시작(시드 ${seed}): 1~2층 돌파`);
  }
  const floors = [];
  for (const cls of unlockedClasses(0)) for (const seed of [1, 2, 3, 4]) floors.push(play(cls, seed));
  const m = avg(floors);
  console.log(`사람 첫 도전(자동 진행): 평균 ${m.toFixed(1)}층 (${floors.join(',')})`);
  assert.ok(m >= 8 && m <= 15, `사람 첫 도전 ${m.toFixed(1)}층 (목표 8~15)`);
  console.log('사람 첫 도전 통과');
}

// ── 6) 캠페인 밸런스 러너: 새 저장 → 도전 반복 → 100층 ──
// 카드 운으로 도전 하나하나의 도달 층이 크게 흔들려(같은 메타·클래스에서 25~70층) 캠페인 한 번의 결과도 시드마다 흔들린다
// → 시드 여러 개를 worker_threads로 동시에 돌려 **시드 평균**을 목표와 비교한다(100층 돌파·스킬 비중은 시드마다)
function avg(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN; }
const job = data => new Promise((resolve, reject) => {
  const w = new Worker(new URL('./worker.js', import.meta.url), { workerData: data });
  w.once('message', resolve);
  w.once('error', reject);
});

function campaignReport(seed, rows, ms) {
  console.log(`\n캠페인 시드 ${seed}: 도전 ${rows.length}회, ${(rows[rows.length - 1].total / 3600).toFixed(1)}시간, 실행 ${(ms / 1000).toFixed(0)}s`);
  console.log(' run cls      start spells                reach  time   gems   gold  cum(h)  half  new  heroLv  hero%(*=특성 완성) skill%  융합(첫 층)  수련');
  const half = [], nw = [];
  for (const r of rows) {
    const h = r.floors.filter(f => f.s <= r.prevBest / 2).map(f => f.t), n = r.floors.filter(f => f.s > r.prevBest).map(f => f.t);
    half.push(...h); nw.push(...n);
    console.log(`${String(r.run).padStart(4)} ${r.cls.padEnd(8)} ${(r.start.join(',') || '-').padEnd(26)} ${String(r.reached).padStart(5)} ${(r.time / 60).toFixed(0).padStart(4)}m ${String(r.gems).padStart(6)} ${String(r.gold).padStart(6)} ${(r.total / 3600).toFixed(1).padStart(6)} ${avg(h).toFixed(0).padStart(5)} ${avg(n).toFixed(0).padStart(4)} ${String(r.heroLv).padStart(6)} ${(r.share * 100).toFixed(0).padStart(5)}${r.full ? '*' : ' '} ${r.skillShare == null ? '    -' : (r.skillShare * 100).toFixed(0).padStart(5)}  ${String(r.fusions).padStart(2)}(${r.firstFuse ?? '-'})`.padEnd(8) + `  ${r.train}`);
  }
  const first = rows[0], last = rows[rows.length - 1], hours = last.total / 3600;
  const gain = (last.reached - first.reached) / (rows.length - 1);
  const sk = rows.filter(r => r.skillShare != null).map(r => r.skillShare);
  const res = {
    runs: rows.length, hours, first: first.reached, gain, half: avg(half), newT: avg(nw), heroLv: last.heroLv, cleared: last.reached >= MAX_STAGE,
    fullShare: avg(rows.filter(r => r.full).map(r => r.share)), skill: avg(sk), skillMin: Math.min(...sk),
    // 융합: 두세 번째 도전부터 도전당 합체 횟수 · 후반(마지막 1/3) 도전의 합체 수 · 첫 합체 층(합체한 도전 평균)
    fus: avg(rows.slice(2).map(r => r.fusions)), fusLate: avg(rows.slice(-Math.max(3, Math.ceil(rows.length / 3))).map(r => r.fusions)),
    firstFuse: avg(rows.filter(r => r.firstFuse != null).map(r => r.firstFuse)),
  };
  console.log(`결과: 첫 도전 ${res.first}층 · 도전당 +${gain.toFixed(2)}층 · ${res.runs}회 · ${hours.toFixed(1)}h · 절반 이하 층 평균 ${res.half.toFixed(1)}s · 새 층 평균 ${res.newT.toFixed(1)}s · 영웅 Lv${res.heroLv} · 특성 완성 영웅 기여도 ${(res.fullShare * 100).toFixed(1)}% · 11층부터 마법사 스킬 비중 평균 ${(res.skill * 100).toFixed(1)}%(최저 ${(res.skillMin * 100).toFixed(0)}%) · 수련 ${last.train}`);
  console.log(`융합: 3번째 도전부터 도전당 ${res.fus.toFixed(2)}회 · 후반 도전 ${res.fusLate.toFixed(2)}개 · 첫 합체 평균 ${res.firstFuse.toFixed(1)}층`);
  // 4차 전략 지표: 초반을 넘긴 도전(20층+)마다 변이·유물·망각 중 무엇을 썼나 · 유물 분포 · 도전이 끝난 지역 · '살 게 없는' 정비 방문
  const mid = rows.filter(r => r.reached >= 20), cnt = {}, ends = [0, 0, 0, 0, 0];
  for (const r of rows) { for (const k of r.relics || []) cnt[k] = (cnt[k] || 0) + 1; if (!(r.reached >= MAX_STAGE)) ends[Math.min(4, Math.floor(r.reached / 20))]++; }
  Object.assign(res, {
    mid: mid.length, choiceless: mid.filter(r => !(r.muts || []).length && !(r.relics || []).length && !r.forgets).length,
    muts: avg(mid.map(r => (r.muts || []).length)), relicN: avg(mid.map(r => (r.relics || []).length)), forgets: avg(mid.map(r => r.forgets || 0)),
    idleGold: rows.filter(r => r.idle && r.idle.gold).length, idleGems: rows.filter(r => r.idle && r.idle.gems).length, shop: rows.some(r => r.idle),
  });
  console.log(`전략(20층+ 도전 ${res.mid}회): 변이 ${res.muts.toFixed(1)} · 유물 ${res.relicN.toFixed(1)} · 망각 ${res.forgets.toFixed(1)} /도전 · 셋 다 없는 도전 ${res.choiceless}회 · 끝난 지역(초원/동굴/묘지/화산/심연) ${ends.join('/')} · 살 게 없는 방문 골드 ${res.idleGold} · 보석 ${res.idleGems}${res.shop ? '' : '(상점 안 씀)'}`);
  console.log(`유물 분포: ${Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  return res;
}

function campaignCheck(all) {
  const m = k => avg(all.map(r => r[k]));
  console.log(`\n시드 ${all.length}개 평균: 첫 도전 ${m('first').toFixed(1)}층 · 도전당 +${m('gain').toFixed(2)}층 · ${m('runs').toFixed(1)}회 · ${m('hours').toFixed(1)}h · 절반 이하 층 ${m('half').toFixed(1)}s · 새 층 ${m('newT').toFixed(1)}s · 특성 완성 영웅 기여도 ${(m('fullShare') * 100).toFixed(1)}% · 스킬 비중 ${(m('skill') * 100).toFixed(1)}%`);
  const bad = [];
  all.forEach((r, i) => {
    if (!r.cleared) bad.push(`시드 ${i}: 100층 미돌파`);
    if (!(r.skillMin >= 0.6)) bad.push(`시드 ${i}: 11층부터 마법사 스킬 비중 최저 ${(r.skillMin * 100).toFixed(0)}% (목표 60~75% 이상)`);
  });
  if (m('first') < 8 || m('first') > 15) bad.push(`첫 도전 ${m('first').toFixed(1)}층 (목표 8~15)`);
  if (m('gain') < 3 || m('gain') > 6) bad.push(`도전당 +${m('gain').toFixed(2)}층 (목표 3~6)`);
  if (m('runs') < 20 || m('runs') > 35) bad.push(`도전 ${m('runs').toFixed(1)}회 (목표 20~35)`);
  if (m('hours') < 15 || m('hours') > 25) bad.push(`총 ${m('hours').toFixed(1)}시간 (목표 15~25)`);
  if (!(m('half') <= 30)) bad.push(`절반 이하 층 평균 ${m('half').toFixed(1)}s (목표 ≤30)`);
  if (!(m('newT') >= 60 && m('newT') <= 120)) bad.push(`새 층 평균 ${m('newT').toFixed(1)}s (목표 60~120)`);
  console.log(`융합(시드 평균): 3번째 도전부터 도전당 ${m('fus').toFixed(2)}회 · 후반 빌드 ${m('fusLate').toFixed(2)}개 · 첫 합체 ${m('firstFuse').toFixed(1)}층`);
  if (!(m('fus') >= 1)) bad.push(`3번째 도전부터 도전당 합체 ${m('fus').toFixed(2)}회 (목표 1~2회 이상)`);
  if (!(m('fusLate') >= 2 && m('fusLate') <= 4)) bad.push(`후반 빌드 융합 ${m('fusLate').toFixed(2)}개 (목표 2~4)`);
  all.forEach((r, i) => { // 4차: 초반을 넘긴 도전은 늘 변이·유물·망각 중 하나 이상을 썼다 · 상점 캠페인이면 정비 방문마다 살 것이 있다
    if (r.choiceless) bad.push(`시드 ${i}: 20층+ 도전 중 변이·유물·망각이 하나도 없는 도전 ${r.choiceless}회`);
    if (r.idleGold || r.idleGems) bad.push(`시드 ${i}: 살 게 없는 정비 방문 골드 ${r.idleGold} · 보석 ${r.idleGems} (목표 0)`);
  });
  if (!(m('fullShare') >= 0.25 && m('fullShare') <= 0.4)) bad.push(`특성 완성 영웅 기여도 ${(m('fullShare') * 100).toFixed(1)}% (목표 25~40%)`);
  assert.deepEqual(bad, [], bad.join('\n'));
}

// 같은 메타 상태에서 클래스별 평균 도달 층이 전체 평균의 ±15% 안(특성 포함). 클래스마다 worker 하나.
// mode 'build' = 봇 추천 빌드(+ 특성을 다 찍은 클래스는 영웅 기여도 25~40%), 'random' = 무작위 빌드
const RANDOM_LV = 24; // 무작위 빌드 동등성: 26점(클래스 총 39~42랭크의 약 60%)
const COLLAB_GAIN = [0.08, 0.25]; // 협공 빌드 도달 층 이득 허용 범위(목표 +10~20%, 표본 잡음 여유)
// collab = 같은 도전을 협공 효과 없이(collabOff) 한 번 더 돌려 협공 빌드의 도달 층 이득도 잰다
// snaps = 캠페인 시드마다의 같은 시점 메타(여러 메타에서 n회씩 — 메타 하나의 우연을 줄인다). (메타 × 클래스)마다 worker 하나
async function classParity(snaps, n, mode = 'build', collab = false) {
  const maxLv = mode === 'random' ? RANDOM_LV : 0; // 특성을 다 못 찍는 레벨이어야 빌드가 갈린다
  const out = await Promise.all(CLASS_KEYS.flatMap(cls => snaps.map(snap => job({ job: 'class', snap, cls, n, mode, collab, maxLv }).then(o => ({ cls, ...o })))));
  const res = {}, share = {}, off = {};
  for (const cls of CLASS_KEYS) {
    const o = out.filter(x => x.cls === cls);
    res[cls] = avg(o.flatMap(x => x.r)); share[cls] = avg(o.flatMap(x => x.sh)); off[cls] = avg(o.flatMap(x => x.ro));
  }
  const snap = snaps[0], nAll = n * snaps.length;
  if (collab) {
    const gain = avg(Object.values(res)) / avg(Object.values(off)) - 1;
    console.log(`협공 강도(최고 ${snaps.map(x => JSON.parse(x).best).join('·')}층 메타, 클래스별 ${nAll}회): 협공 켬 ${avg(Object.values(res)).toFixed(1)}층 · 끔 ${avg(Object.values(off)).toFixed(1)}층 → +${(gain * 100).toFixed(0)}% (` +
      CLASS_KEYS.map(k => `${k} ${((res[k] / off[k] - 1) * 100).toFixed(0)}%`).join(' · ') + ')');
    assert.ok(gain >= COLLAB_GAIN[0] && gain <= COLLAB_GAIN[1], `협공 빌드 도달 층 +${(gain * 100).toFixed(0)}% (목표 +10~20%)`);
  }
  const mean = avg(Object.values(res));
  console.log(`클래스 동등성(${mode === 'random' ? '무작위' : '추천'} 특성, 최고 ${snaps.map(x => JSON.parse(x).best).join('·')}층 메타 · 영웅 Lv${snaps.map(x => Math.min(JSON.parse(x).hero.level, maxLv || 999)).join('·')}, ${nAll}회씩): ` +
    Object.entries(res).map(([k, v]) => `${k} ${v.toFixed(1)}(${((v / mean - 1) * 100).toFixed(0)}%${share[k] >= 0 ? `, 영웅 ${(share[k] * 100).toFixed(0)}%` : ''})`).join(' · '));
  for (const [k, v] of Object.entries(res)) assert.ok(Math.abs(v / mean - 1) <= 0.15, `${k} 평균 ${v.toFixed(1)}층, 전체 ${mean.toFixed(1)}층 대비 ±15% 밖`);
  if (mode !== 'build') return;
  // 영웅 기여도: 도전마다 빌드(카드 스킬 비중)에 따라 20~55%로 흔들리므로 클래스 평균은 20~45%, 전체 평균이 목표 25~40%
  const all = Object.values(share).filter(v => v >= 0);
  for (const [k, v] of Object.entries(share)) assert.ok(!(v >= 0) || (v >= 0.2 && v <= 0.45), `${k} 특성 완성 영웅 기여도 ${(v * 100).toFixed(0)}% (클래스 평균 20~45%)`);
  assert.ok(!all.length || (avg(all) >= 0.25 && avg(all) <= 0.4), `특성 완성 영웅 기여도 전체 평균 ${(avg(all) * 100).toFixed(0)}% (목표 25~40%)`);
}

// ── 5b) 영웅 × 마법사 협공 ──
// 협공 게임: 클래스(+ 갈래 조건이면 그 갈래 5노드) × 협공 스킬 하나(Lv3)
function collabGame(c, extra = {}) {
  const talents = c.branch ? { [c.cls]: branchAlloc(c.cls, c.branch, false) } : {};
  return createGame({
    stage: 8, best: 40, seed: 700, players: [{ lv: { atk: 10, crit: 10 } }, {}],
    hero: { ...newHero(), cls: c.cls, level: 45, talents }, run: buff(10, 999, { spells: { [c.spells[0]]: 3 } }), ...extra,
  });
}
// 영웅 궁극기는 쓸 수 있을 때마다 적 옆에서 — 궁극기형 협공(폭풍 소환)도 확인
function runCollab(g, secs) {
  const ev = [];
  for (let t = 0; t < secs && g.phase === 'play'; t += DT) {
    if (g.pick) { resolvePick(g, ev); continue; }
    const h = g.heroUnit;
    const e = h.ultCd <= 0 && h.state !== 'down' && g.enemies.find(q => !q.dead && q.y > 60);
    if (e) { h.x = e.x; h.y = e.y + 40; act(g, 0, { type: 'heroUlt' }); } // 적 무리 옆에서 궁극기
    step(g, DT);
    ev.push(...drainEvents(g));
  }
  return ev;
}
function collabs() {
  { // 자동 특성(자동 진행 봇)도 act 'talent'로 찍는다 → 갈래 조건 협공(서리 방벽)이 다음 층까지 기다리지 않고 바로 켜진다
    const hero = newHero();
    Object.assign(hero, { cls: 'knight', level: 60, autoTalent: true });
    const g = createGame({ stage: 5, players: [{}, {}], seed: 3, hero, run: { spells: { frostWard: 1 } } });
    drainEvents(g);
    assert.ok(!g.collabs.includes('frostBastion'));
    autoHero(g);
    assert.ok(g.collabs.includes('frostBastion') && drainEvents(g).some(e => e.type === 'talent'), '자동 특성 → 협공 즉시 재계산');
  }
  const table = COLLABS.filter(c => c.cls);
  assert.ok(table.length >= 12 && COLLABS.length <= 15, `협공 ${COLLABS.length}종`);
  for (const cls of HERO_CLASS_KEYS) assert.ok(table.filter(c => c.cls === cls).length >= 2, `${cls}: 협공 2~3종`);
  // 도감: 히든 조합 '협공' 카테고리(kind:'collab'), 한국어 이름·힌트·설명
  assert.deepEqual(SYNERGIES.filter(s => s.kind === 'collab').map(s => s.key), COLLAB_KEYS);
  for (const c of COLLABS) assert.ok(/[가-힣]/.test(c.name + c.hint + c.desc) && c.spells.every(k => SPELL_KEYS.includes(k)), c.key);
  const rows = [];
  for (const c of table) {
    // 조건: 클래스 + 스킬(+ 갈래). 켜지면 synergy(o:2, 첫 발견) + collab{spells: 엮인 슬롯}
    const g = collabGame(c);
    const ev = drainEvents(g);
    assert.ok(g.collabs.includes(c.key), `${c.key}: 켜짐`);
    assert.ok(ev.some(e => e.type === 'synergy' && e.key === c.key && e.o === 2 && e.first), `${c.key}: 첫 발견`);
    assert.ok(ev.some(e => e.type === 'collab' && e.key === c.key && e.cls === c.cls && e.spells.includes(c.spells[0])), `${c.key}: collab 이벤트`);
    assert.deepEqual(collabSlots(g, c.key), [c.spells[0]]);
    // 다른 클래스·스킬 없음·갈래 부족이면 꺼짐
    const other = HERO_CLASS_KEYS.find(k => k !== c.cls);
    assert.ok(!collabGame({ ...c, cls: other, branch: null }).collabs.includes(c.key), `${c.key}: 다른 클래스는 아님`);
    assert.ok(!createGame({ stage: 8, best: 40, seed: 700, players: [{}, {}], hero: { ...newHero(), cls: c.cls, level: 45, talents: c.branch ? { [c.cls]: branchAlloc(c.cls, c.branch, false) } : {} } }).collabs.includes(c.key), `${c.key}: 스킬 없으면 아님`);
    if (c.branch) assert.ok(!createGame({ stage: 8, best: 40, seed: 700, players: [{}, {}], hero: { ...newHero(), cls: c.cls, level: 45 }, run: { spells: { [c.spells[0]]: 3 } } }).collabs.includes(c.key), `${c.key}: 갈래 조건`);
    // 재료 스킬이 융합으로 합쳐져도 협공은 이어진다
    const fus = FUSIONS.find(f => f.groups.some(gr => gr[0] === c.spells[0]));
    if (fus) {
      const other2 = fus.groups.find(gr => gr[0] !== c.spells[0])[0];
      const fg = collabGame(c, { run: buff(10, 999, { spells: { [c.spells[0]]: SPELL_MAX_LV, [other2]: SPELL_MAX_LV } }) });
      assert.ok(fg.spells[fus.key] && fg.collabs.includes(c.key) && collabSlots(fg, c.key).includes(fus.key), `${c.key}: 융합 뒤에도 유지`);
    }
    // 두 번째 발견은 first:false(도감 1회)
    const g2 = collabGame(c, { discovered: [c.key] });
    assert.ok(drainEvents(g2).some(e => e.type === 'synergy' && e.key === c.key && !e.first), `${c.key}: 재발견 first:false`);
    // 실제 효과: 효과가 적용되는 자리에서만 collabProc(연출 트리거)가 나온다 — 켜면 전투 중 나오고, 끄면(collabOff) 없다
    const on = collabGame(c), off = collabGame(c, { collabOff: true });
    const eOn = runCollab(on, 40), eOff = runCollab(off, 40);
    const nOn = eOn.filter(e => e.type === 'collabProc' && e.key === c.key).length, nOff = eOff.filter(e => e.type === 'collabProc').length;
    rows.push(`${c.key} ${nOn}`);
    assert.ok(nOn > 0 && nOff === 0, `${c.key}: 협공 효과 발동 (${nOn} vs ${nOff})`);
  }
  // 특성: 협공 효과 +%(collab)와 기사 '합동 작전'(도발한 적 마법 피해 +%)
  assert.ok(Object.values(TALENTS).every(bs => bs.some(b => b.nodes.some(n => n.fx.collab))), '클래스마다 협공 강화 노드');
  assert.ok(TALENTS.knight.find(b => b.key === 'command').nodes.some(n => n.fx.tauntAmp > 0), '기사 지휘관: 도발한 적 마법 피해');
  const kc = collabGame(COLLABS.find(c => c.key === 'anvil'));
  kc.hero.talents.knight = branchAlloc('knight', 'command', false);
  kc.heroUnit.tbT = 0;
  step(kc, DT);
  assert.ok(kc.heroUnit.tb.tauntAmp > 0);
  assert.equal(branchSpent(kc.hero, 'knight', 'command'), Object.values(branchAlloc('knight', 'command', false)).reduce((s, v) => s + v, 0));
  console.log('협공 통과: ' + rows.join(' · '));
}

// 합동 필살: 영웅 궁극기 3초 안의 첫 성벽 마법사(P1) 쿨타임 스킬 = 2배 위력 + 슬로 모션 + 도감(협공 unison)
function linkedFinisher() {
  const mk = () => {
    const g = createGame({ stage: 8, best: 40, seed: 710, players: [{}, {}], hero: { ...newHero(), cls: 'knight', level: 30 }, run: buff(0, 999, { spells: { lightningStrike: 3 } }) });
    run(g, 12);
    drainEvents(g);
    return g;
  };
  const g = mk();
  g.heroUnit.ultCd = 0;
  g.spellT.lightningStrike = 1.5;
  assert.ok(act(g, 0, { type: 'heroUlt' }) && g.linkT === COLLAB_FX.linkT);
  const ev = [];
  run(g, 2, ev);
  const lf = of(ev, 'linkFinish');
  assert.equal(lf.length, 1, '합동 필살 1회');
  assert.equal(lf[0].spell, 'lightningStrike');
  assert.ok(of(ev, 'cast').some(e => e.spell === 'lightningStrike' && e.linked), '강화 시전 표시');
  assert.ok(ev.some(e => e.type === 'slowmo' && e.ms > 0 && e.scale < 1), '슬로 모션');
  assert.ok(ev.some(e => e.type === 'synergy' && e.key === 'unison' && e.first) && g.discovered.has('unison'), '도감 등록');
  assert.equal(g.linkT, 0, '한 번만');
  const st = g.players[0].stats.dmg;
  const linkedHits = ev.filter(e => e.type === 'hit' && e.o === 3 && e.kind === 'lightning');
  assert.ok(linkedHits.some(e => e.dmg > st * 1.9 * 1.9), '2배 위력');
  // 창(3초)이 지나면 없음
  const g2 = mk();
  g2.heroUnit.ultCd = 0;
  g2.spellT.lightningStrike = 4;
  act(g2, 0, { type: 'heroUlt' });
  const ev2 = [];
  run(g2, 5, ev2);
  assert.ok(!ev2.some(e => e.type === 'linkFinish'), '3초 뒤 시전은 보통');
  console.log('합동 필살 통과');
}

// 지원 사격: 단일 대상 스킬(얼음 창·낙뢰·심판 광선)은 영웅이 치고 있는 적을 먼저 노린다(없으면 가장 앞선 적)
function supportFire() {
  const g = createGame({ stage: 3, best: 40, seed: 720, players: [{}, {}], hero: { ...newHero(), cls: 'knight', level: 20 }, run: buff(0, 999, { spells: { iceLance: 2, judgment: 2 } }) });
  for (let k = 0; k < 900 && g.enemies.length < 2; k++) { if (g.pick) resolvePick(g); else step(g, DT); }
  g.spawns.length = g.spawnIdx;
  const [front, far] = g.enemies;
  g.enemies.length = 2;
  Object.assign(front, { x: 100, y: 880, hp: 1e15, maxHp: 1e15, speed: 0 });
  Object.assign(far, { x: 600, y: 420, hp: 1e15, maxHp: 1e15, speed: 0 });
  act(g, 0, { type: 'heroMove', x: 600, y: 470 });
  const h = g.heroUnit;
  h.x = 600; h.y = 460;
  g.spellT.iceLance = g.spellT.judgment = 0.1; // 영웅이 먼저 붙고 나서 시전
  drainEvents(g);
  const ev = [];
  for (let t = 0; t < 8; t += DT) {
    h.x = 600; h.y = 460; if (h.moveTo) h.moveTo.holdT = 6;
    step(g, DT);
    ev.push(...drainEvents(g));
  }
  assert.equal(h.fightE, far, '영웅은 먼 적과 싸운다');
  const casts = of(ev, 'cast').filter(e => !e.basic && (e.spell === 'iceLance' || e.spell === 'judgment'));
  assert.ok(casts.length >= 4, `스킬 시전 ${casts.length}`);
  assert.ok(casts.every(e => e.support && Math.abs(e.tx - far.x) < 1 && Math.abs(e.ty - far.y) < 1), '영웅이 싸우는 적을 노린다(가장 앞선 적이 아니라)');
  // 영웅이 싸우지 않으면 가장 앞선 적
  const g2 = createGame({ stage: 3, seed: 720, players: [{}, {}], run: buff(0, 999, { spells: { iceLance: 2 } }) });
  const ev2 = [];
  run(g2, 20, ev2);
  assert.ok(of(ev2, 'cast').some(e => e.spell === 'iceLance' && !e.support), '영웅 없으면 앞선 적');
  console.log('지원 사격 통과');
}

smoke();
addiction();
mageSpells();
fantasyPick();
fantasySpellEffects();
fantasyFusions();
heroClasses();
heroUnitLifecycle();
heroTaunt();
heroRangedAttack();
heroUlts();
heroClassPassives();
heroDownRespawn();
heroXpAndMilestones();
heroItemRolls();
heroPowerMonotonic();
heroBagAndEquip();
heroJsonRoundtrip();
talentTable();
talentRules();
talentCapstones();
talentKeystones();
heroSummons();
heroRoaming();
metaUpgrades();
runLifecycle();
reviveWard();
slaughterPace();
collabs();
linkedFinisher();
supportFire();
earlyPace();
humanFirstRun();

if (process.argv.includes('--unit')) process.exit(0); // 단위 테스트만(캠페인 생략)
// 동등성 시점: 최고 50층(영웅이 특성을 거의 다 찍은 메타) · --full이면 80층도 + 무작위 특성 빌드
const parityAt = FULL ? [50, 80] : [50];
const seeds = Array.from({ length: FULL ? 6 : 3 }, (_, i) => SEED + i);
const camps = await Promise.all(seeds.map(seed => job({ job: 'campaign', seed, parityAt })));
campaignCheck(camps.map((c, i) => campaignReport(seeds[i], c.rows, c.ms)));
// 동등성: 캠페인 시드 3개의 같은 시점 메타에서 클래스마다 8회씩(24회)
const at = b => camps.slice(0, 3).map(c => c.snaps[b]).filter(Boolean);
for (const b of parityAt) await classParity(at(b), 8, 'build', b === parityAt[0]);
if (FULL) await classParity(at(parityAt[0]), 8, 'random');
console.log('캠페인 밸런스 통과');

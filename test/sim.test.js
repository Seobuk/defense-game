// 헤드리스 스모크 + 로그라이트 캠페인 밸런스 러너: node test/sim.test.js [--full] [--seed=N]
//   기본: 단위 테스트 + 캠페인 1회(시드 1) + 클래스 동등성(최고 40층 시점)   --full: 캠페인 3시드 + 동등성 40·80층
import assert from 'node:assert/strict';
import { fmt, mulberry32 } from '../public/js/util.js';
import {
  DT, upgradeCost, cannonStats, ALLY_SPELLS, BASIC_SPELLS, SKILLS, SPELL_KEYS, FUSIONS, SPELL_SLOTS, SPELL_MAX_LV, AWAKEN_KEYS, META_KEYS, metaCost, metaMax, metaFx,
  startGoldAmount, RUN_GEMS, MAX_STAGE,
} from '../public/js/config.js';
import { createGame, startStage, step, act, drainEvents, setPlayer, tickPick, refreshFusion, serializeRun, normalizeRun, cardCount } from '../public/js/sim.js';
import { pickCard, botSpendGems, botLoadout } from '../public/js/bot.js';
import { newRun, restoreRun, endRun, buyMeta, validLoadout, startSpellChoices, campAct, applyOffline } from '../public/js/run.js';
import { defaults } from '../public/js/save.js';
import { campaign, playRun, playStage, resolvePick, HERO_CLASS_KEYS as CLASS_KEYS } from './harness.js';
import {
  newHero, HERO_CLASSES, HERO_CLASS_KEYS, unlockedClasses, xpToNext, heroTier, hasMilestone, MILESTONES,
  rollItem, itemPower, heroPower, sellValue, equipItem, sellItem, sellItemsByRarity, autoEquipAll, addToBag,
  BAG_SIZE, SLOTS, RARITIES, SUBSTATS, heroTakeDamage, heroGainXp,
} from '../public/js/hero.js';

const FULL = process.argv.includes('--full');
const seedArg = process.argv.find(a => a.startsWith('--seed='));
const SEED = seedArg ? +seedArg.slice(7) : 1;
const lv0 = () => ({ atk: 0, rate: 0, crit: 0, multi: 0, wall: 0 });
const bot = name => ({ name, kind: 'bot', gold: 0, lv: lv0(), auto: true });

// 페이즈가 바뀌거나 시간 초과까지 진행, 이벤트 수집
function runUntilEnd(g, maxT = 600, collect = null) {
  for (let t = 0; t < maxT && g.phase === 'play'; t += DT) {
    if (g.pick) { resolvePick(g, collect); continue; }
    step(g, DT);
    const ev = drainEvents(g);
    if (collect) collect.push(...ev);
  }
}

// ── 1) 스모크 ──
function smoke() {
  assert.equal(fmt(0), '0');
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

  // 업그레이드: 골드 차감, 최대치
  const h = createGame({ stage: 1, players: [{ name: 'A', gold: 1000 }, { name: 'B' }], seed: 2 });
  const c = upgradeCost('atk', 0);
  assert.ok(act(h, 0, { type: 'upgrade', stat: 'atk' }));
  assert.equal(h.players[0].gold, 1000 - c);
  assert.equal(h.players[0].lv.atk, 1);
  assert.ok(!act(h, 1, { type: 'upgrade', stat: 'atk' }), '골드 부족');
  assert.ok(!act(h, 0, { type: 'upgrade', stat: 'nope' }));
  assert.ok(!act(h, 5, { type: 'upgrade', stat: 'atk' }));
  const w0 = h.wall.max;
  assert.ok(act(h, 0, { type: 'upgrade', stat: 'wall' }));
  assert.ok(h.wall.max > w0 && h.wall.hp === h.wall.max);
  const m = createGame({ players: [{ gold: 1e30, lv: { multi: 5 } }, {}], seed: 3 });
  assert.ok(!act(m, 0, { type: 'upgrade', stat: 'multi' }), 'multi 최대');
  assert.ok(act(m, 0, { type: 'auto', on: true }) && m.players[0].auto);

  // 운석: 잡몹 전멸 + 골드, 쿨타임
  const mg = createGame({ stage: 5, players: [{}, {}], seed: 4 });
  for (let k = 0; k < 60 * 20; k++) step(mg, DT);
  const alive = mg.enemies.length, gold0 = mg.players[1].gold, killed0 = mg.progress.killed;
  assert.ok(alive > 0);
  assert.ok(act(mg, 0, { type: 'skill', skill: 'meteor' }));
  assert.ok(mg.enemies.every(e => e.dead));
  assert.equal(mg.progress.killed, killed0 + alive);
  assert.ok(mg.players[1].gold > gold0, '운석 처치 골드는 두 명 모두');
  while (mg.pick) resolvePick(mg); // 대량 처치로 마나가 찼을 수 있음 — 다른 조작 전에 해소
  assert.ok(!act(mg, 0, { type: 'skill', skill: 'meteor' }), '쿨타임');
  assert.equal(mg.players[0].cd.meteor, SKILLS.meteor.cd);
  assert.ok(act(mg, 1, { type: 'skill', skill: 'freeze' }) && mg.freezeT > 0);
  step(mg, DT);
  assert.ok(mg.enemies.every(e => e.frozen || e.dead));

  // 클리어: 결과 + 이벤트
  const strong = { lv: { atk: 90, rate: 12, crit: 10, multi: 3, wall: 30 } };
  const cg = createGame({ stage: 10, players: [strong, strong], seed: 5 });
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

  // 슬롯 교체
  const sg = createGame({ players: [bot('P1'), bot('AI')], seed: 7 });
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
  const g = createGame({ stage, players: [{ lv: { wall: 400 } }, { lv: { wall: 400 } }], seed: 11, ...extra });
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
  const mult = k => (k >= 30 ? 1.25 : k >= 10 ? 1.1 : 1); // k = 이번 처치까지 콤보 수
  kills.forEach((e, k) => assert.equal(e.gold, Math.ceil(base[k] * mult(k + 1)), `처치 ${k + 1} 골드`));
  assert.deepEqual(of(ev, 'combo').map(e => [e.count, e.tier, e.label]), [[10, 1, '좋아!'], [30, 2, '대단해!']]);
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
  act(lg, 1, { type: 'skill', skill: 'meteor' });
  const lev = drainEvents(lg);
  assert.ok(lev.some(e => e.type === 'combo' && e.tier === 4 && e.label === '전설!' && e.count === 100));
  assert.ok(lev.some(e => e.type === 'synergy' && e.key === 'legend'));
  assert.equal(lg.legendT, 10);
  assert.equal(of(lev, 'kill')[1].gold, Math.ceil(lg.enemies[1].gold * 2 * 2), '전설 단계 2배 × 전설 2배');
  assert.ok(lgold > 0);

  // 광란: 발사 속도 2배 (상한 30)
  const fr = createGame({ stage: 25, players: [{ lv: { wall: 400, rate: 15 } }, { lv: { wall: 400 } }], seed: 11 });
  run(fr, 20);
  const shots = () => { const e = []; run(fr, 1, e); return e.filter(x => x.type === 'shoot' && x.o === 0).length; };
  const normal = shots();
  fr.frenzyT = 5;
  const fast = shots();
  assert.ok(normal >= 14 && normal <= 16 && fast >= 28 && fast <= 31, `광란 발사 ${normal} → ${fast}`);

  // 대포 조합: 레벨로 켜짐, 첫 발견 1회만
  const LV = {
    flame: { atk: 30, multi: 2, crit: 10 },
    pierce: { atk: 25, multi: 0 },
    chain: { atk: 30, crit: 12, rate: 12, multi: 1 },
    homing: { atk: 30, multi: 5 },
    thorns: { atk: 5, wall: 30, multi: 1 },
    giant: { atk: 60, crit: 15, multi: 1 },
  };
  for (const [key, lv] of Object.entries(LV)) {
    const sg = createGame({ stage: key === 'giant' ? 5 : 12, players: [{ lv }, { lv: { wall: 200 } }], seed: 3 });
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
      assert.ok(of(rev, 'hit').some(e => e.o === 0 && e.dmg > d * 2.6), '거인 사냥꾼: 보스 피해 2배');
    }
    assert.ok(of(rev, 'hit').every(e => typeof e.big === 'boolean' && typeof e.kind === 'string'));
  }
  // 이미 발견한 조합은 first:false, 새로 발견은 true, 꺼졌다 다시 켜지면 false
  const dg = createGame({ stage: 1, players: [{ gold: 1e12, lv: { atk: 30, multi: 2, crit: 10 } }, {}], discovered: ['flame', 'bogus'], seed: 4 });
  const dev = drainEvents(dg);
  assert.ok(dev.some(e => e.type === 'synergy' && e.key === 'flame' && !e.first));
  assert.ok(!dev.some(e => e.type === 'hitstop'));
  assert.ok(!dg.discovered.has('bogus'));
  const pg = createGame({ stage: 1, players: [{ gold: 1e12, lv: { atk: 24 } }, {}], seed: 4 });
  drainEvents(pg);
  act(pg, 0, { type: 'upgrade', stat: 'atk' });
  let pev = drainEvents(pg);
  assert.equal(pev.filter(e => e.type === 'synergy' && e.key === 'pierce' && e.first).length, 1);
  act(pg, 0, { type: 'upgrade', stat: 'multi' }); // 다중 발사 → 관통 꺼짐
  assert.ok(!pg.players[0].syn.includes('pierce'));
  drainEvents(pg);
  setPlayer(pg, 0, { gold: 0, lv: { atk: 25 } });
  pev = drainEvents(pg);
  assert.ok(pev.some(e => e.type === 'synergy' && e.key === 'pierce' && !e.first), '재활성은 first:false');

  // 협동 레벨 조합: 쌍둥이 포화, 황금비
  const tg = createGame({ stage: 25, players: [{ lv: { wall: 400, multi: 3, atk: 10 } }, { lv: { wall: 400, multi: 3, atk: 10 } }], seed: 11 });
  const tev = drainEvents(tg);
  assert.deepEqual([...tg.duo].sort(), ['golden', 'twin']);
  assert.ok(tev.some(e => e.type === 'synergy' && e.key === 'twin' && e.o === -1));
  run(tg, 30);
  const tb = tg.enemies.map(e => e.gold);
  act(tg, 0, { type: 'skill', skill: 'meteor' });
  const tk = of(drainEvents(tg), 'kill');
  assert.equal(tk[0].gold, Math.ceil(tb[0] * 1.5), '황금비 +50%');
  const hg = createGame({ stage: 5, players: [{ lv: { multi: 3, atk: 10 } }, { lv: { multi: 3, atk: 10 } }], seed: 5 });
  const hev = [];
  run(hg, 15, hev);
  const hd = hg.players[0].stats.dmg;
  assert.ok(of(hev, 'hit').some(e => Math.abs(e.dmg - hd * BASIC_SPELLS[0].dmg * 1.25) < 1e-6), '쌍둥이 +25%');

  // 빙하 운석: 한쪽 빙결 → 3초 안 다른 쪽 운석 → 보스 운석 피해 3배
  const bg = createGame({ stage: 10, players: [{ lv: { wall: 400 } }, { lv: { wall: 400 } }], seed: 8 });
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
  const sg2 = createGame({ stage: 10, players: [{ lv: { wall: 400 } }, {}], seed: 8 });
  run(sg2, 20);
  act(sg2, 0, { type: 'skill', skill: 'freeze' });
  act(sg2, 0, { type: 'skill', skill: 'meteor' });
  assert.ok(!drainEvents(sg2).some(e => e.key === 'glacier'));

  // 이중 필살: 1.5초 안에 같은 스킬 → 운석 2번, 빙결 10초
  const wg = crowd(10, 50);
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
  const fg = createGame({ stage: 3, players: [{ lv: { atk: 80, rate: 10 } }, { lv: { atk: 80, rate: 10 } }], seed: 9 });
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
  const ng = createGame({ stage: 10, players: [{ lv: { atk: 90, rate: 12, crit: 15, wall: 60 } }, { lv: { atk: 90, rate: 12, crit: 15, wall: 60 } }], seed: 10 });
  const nev = [];
  run(ng, 300, nev);
  assert.equal(ng.phase, 'clear');
  assert.ok(nev.some(e => e.type === 'hitstop' && e.ms === 500));
  let lastT = -1, ok60 = true, n60 = 0;
  // 시간 복원: 60ms 히트스톱 사이엔 최소 18스텝(0.3초)
  const ng2 = createGame({ stage: 10, players: [{ lv: { atk: 90, rate: 12, crit: 15, wall: 60 } }, { lv: { atk: 90, rate: 12, crit: 15, wall: 60 } }], seed: 10 });
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
  kg.freezeT = 1; // 이동 멈춤
  run(kg, 0.5);
  assert.ok(ys.some(([e, y0]) => e.dead || e.y < y0), '넉백');
  console.log('중독성 레이어 통과');
}

// ── 2) 성벽 마법사 = 주문만 시전 (기본 공격 없음) ──
function mageSpells() {
  // 기본 주문: P1 화염구(작은 폭발), P2 서리 화살(관통·둔화). 발사체 kind·caster, 시전마다 cast 이벤트
  const g = createGame({ stage: 5, players: [{ lv: { atk: 5 } }, { lv: { atk: 5 } }], seed: 60 });
  const ev = [];
  const kinds = new Set();
  let slowed = false;
  for (let t = 0; t < 20 && g.phase === 'play'; t += DT) {
    if (g.pick) { resolvePick(g, ev); continue; }
    step(g, DT);
    ev.push(...drainEvents(g));
    for (const b of g.bullets) kinds.add(`${b.caster}:${b.kind}:${b.pierce}`);
    slowed ||= g.enemies.some(e => !e.dead && e.slowT > 0);
  }
  assert.deepEqual([...kinds].sort(), ['0:fireball:1', '1:frostbolt:2'], '발사체 = 화염구(P1) · 서리 화살(P2, 2마리 관통)');
  const casts = of(ev, 'cast');
  const ok = e => [e.x, e.y, e.tx, e.ty].every(Number.isFinite);
  assert.ok(casts.some(e => e.o === 0 && e.spell === 'fireball' && e.basic && ok(e)), '화염구 시전 이벤트');
  assert.ok(casts.some(e => e.o === 1 && e.spell === 'frostbolt' && e.basic && ok(e)), '서리 화살 시전 이벤트');
  assert.ok(of(ev, 'boom').some(e => e.kind === 'fireball' && e.o === 0), '화염구 폭발');
  assert.ok(slowed, '서리 화살 둔화');
  const hits = of(ev, 'hit');
  assert.ok(hits.every(e => (e.o !== 0 || e.kind === 'fireball') && (e.o !== 1 || e.kind === 'frostbolt')), '기본 공격(매직 미사일) 없음');

  // 카드 스킬은 P1 주문서에서 각자 쿨타임대로 시전(cast basic:false) + 주문 치명타
  const cg = createGame({ stage: 5, players: [{ lv: { atk: 150, crit: 15, wall: 300 } }, { lv: { wall: 300 } }], seed: 61, run: { spells: { judgment: 3, iceLance: 3 } } });
  const cev = [];
  run(cg, 8, cev);
  for (const k of ['judgment', 'iceLance']) assert.ok(of(cev, 'cast').some(e => e.o === 0 && e.spell === k && !e.basic && ok(e)), `${k} 시전 이벤트`);
  assert.ok(of(cev, 'hit').some(e => e.o === 3 && e.caster === 0 && e.crit), '스킬 피해도 치명타');

  // 시전 속도 = 쿨타임 단축(상한), 다중 시전 = 연속 시전 확률
  const casts60 = lv => {
    const sg = createGame({ stage: 25, players: [{ lv: { wall: 400, ...lv } }, { lv: { wall: 400 } }], seed: 62, run: { spells: { judgment: 1 } } });
    const e = []; run(sg, 60, e);
    return of(e, 'cast').filter(x => x.spell === 'judgment').length;
  };
  const base = casts60({}), fast = casts60({ rate: 15 }), echo = casts60({ multi: 5 });
  assert.ok(fast > base * 1.25 && echo > base * 1.2, `심판 광선 시전 ${base} → 시전 속도 ${fast} · 다중 시전 ${echo}`);
  assert.ok(cannonStats({ rate: 15 }, { rateMul: 9 }).cdMul <= 1 / 0.6 + 1e-9, '쿨타임 단축 상한');

  // AI 동료: 네임드 보스를 잡을 때마다 냉기·번개 주문 1개(런당 최대 3), 이어하기에 남는다
  const strong = { lv: { atk: 90, rate: 12, crit: 10, multi: 3, wall: 30 } };
  const ag = createGame({ stage: 10, players: [strong, strong], seed: 5 });
  const aev = [];
  runUntilEnd(ag, 600, aev);
  assert.equal(ag.phase, 'clear');
  assert.deepEqual(ag.allySpells, { [ALLY_SPELLS[0]]: 1 });
  assert.ok(aev.some(e => e.type === 'allySpell' && e.spell === ALLY_SPELLS[0] && e.level === 1));
  startStage(ag, 11);
  assert.deepEqual(ag.run.checkpoint.allySpells, ag.allySpells, '체크포인트에 저장');
  const lev = [];
  run(ag, 10, lev);
  assert.ok(of(lev, 'cast').some(e => e.o === 1 && e.spell === ALLY_SPELLS[0]), 'AI 동료가 익힌 주문 시전');
  ag.allySpells = Object.fromEntries(ALLY_SPELLS.map(k => [k, 2]));
  while (ag.pick) resolvePick(ag);
  ag.enemies.push({ id: 99999, named: true, isBoss: true, dead: false, hp: 1, maxHp: 1, shield: 0, x: 300, y: 300, r: 30, reduce: 1, gold: 1, beh: 'walk', type: 'slime' });
  assert.ok(act(ag, 0, { type: 'skill', skill: 'meteor' }), '운석으로 네임드 처치');
  assert.equal(Object.keys(ag.allySpells).length, 3, '최대 3개');
  assert.deepEqual(normalizeRun({ allySpells: { iceLance: 9, fireball: 2 } }).allySpells, { iceLance: 5 }, '동료 주문 검증');
  console.log('성벽 마법사 주문 시전 통과');
}

// ── 3) 판타지 스킬 선택 (런 전체 누적 빌드: 슬롯 6 · Lv1~5 · 각성) ──
function fantasyPick() {
  // 마나 → 카드 → 전투 정지(시간도 멈춤), 카드 3장은 서로 다른 스킬
  const g = createGame({ stage: 1, players: [{ lv: { atk: 20 } }, {}], seed: 21 });
  for (let n = 0; !g.pick && g.phase === 'play' && n < 60 * 200; n++) { step(g, DT); drainEvents(g); }
  assert.ok(g.pick, '마나가 가득 차면 카드가 뜬다');
  assert.equal(g.mana.cur, g.mana.max);
  assert.ok(g.progress.killed >= Math.ceil(g.progress.total * 0.6), '처치 진행률 60%에서');
  assert.equal(g.pick.cards.length, 3, '카드 3장');
  assert.equal(new Set(g.pick.cards.map(c => c.spell)).size, 3, '서로 다른 스킬');
  for (const c of g.pick.cards) assert.equal(c.level, 1, '처음 뽑으면 Lv1');
  const before = { killed: g.progress.killed, phaseT: g.phaseT, n: g.enemies.length };
  for (let k = 0; k < 30; k++) step(g, DT);
  assert.deepEqual({ killed: g.progress.killed, phaseT: g.phaseT, n: g.enemies.length }, before, '선택 중엔 전투 정지(시간도 멈춤)');
  assert.ok(!act(g, 0, { type: 'upgrade', stat: 'atk' }), '선택 중엔 다른 조작도 불가');
  assert.ok(!act(g, 1, { type: 'pick', index: 0 }), 'AI 동료는 카드를 고르지 않음');
  const key = g.pick.cards[0].spell;
  drainEvents(g);
  assert.ok(act(g, 0, { type: 'pick', index: 0 }));
  assert.equal(g.spells[key], 1);
  assert.ok(g.seenSpells.has(key), '뽑아 본 스킬 기록(시작 스킬 후보)');
  assert.equal(g.pick, null, '선택하면 정지 해제');
  assert.ok(drainEvents(g).some(e => e.type === 'spellPick' && e.spell === key && e.level === 1));
  assert.ok(!act(g, 0, { type: 'pick', index: 0 }), '카드가 없을 때 pick은 실패');
  // 층당 마나 카드는 1번뿐(1층엔 네임드 보스 없음)
  let again = false;
  for (let n = 0; g.phase === 'play' && n < 60 * 300; n++) { step(g, DT); drainEvents(g); if (g.pick) { again = true; break; } }
  assert.ok(!again, '같은 층에서 마나 카드는 다시 뜨지 않는다');

  // 빌드는 층이 바뀌어도 유지(런 전체)
  startStage(g, 2);
  assert.equal(g.spells[key], 1, '다음 층에도 빌드 유지');
  assert.equal(g.mana.cur, 0);

  // 슬롯 6칸: 차면 보유 스킬 강화 카드만. 모자라는 자리는 각성 카드
  const sg = createGame({ stage: 5, players: [{}, {}], seed: 22 });
  const six = SPELL_KEYS.slice(0, SPELL_SLOTS);
  six.forEach(k => { sg.spells[k] = 2; });
  for (let i = 0; i < 20; i++) {
    for (const c of genOffer(sg)) assert.ok(c.awaken || six.includes(c.spell), '슬롯이 차면 보유 스킬만');
  }
  six.forEach(k => { sg.spells[k] = SPELL_MAX_LV; });
  sg.spells[six[0]] = SPELL_MAX_LV - 1;
  let cards = genOffer(sg);
  assert.equal(cards.length, 3);
  assert.equal(cards.filter(c => c.spell === six[0]).length, 1, '남은 강화 1장');
  assert.equal(cards.filter(c => c.awaken).length, 2, '나머지는 각성 카드');
  assert.ok(cards.every(c => !c.spell || c.level <= SPELL_MAX_LV), 'Lv5 최대');
  sg.spells[six[0]] = SPELL_MAX_LV;
  cards = genOffer(sg);
  assert.ok(cards.every(c => c.awaken && AWAKEN_KEYS.includes(c.awaken)), '모든 슬롯 최대 → 각성 카드만');
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

  // 자동 선택: auto 켜져 있으면 tickPick 3초 뒤 봇 휴리스틱으로 자동 선택
  const ag = createGame({ stage: 2, players: [{ lv: { atk: 20 }, auto: true }, {}], seed: 23 });
  for (let n = 0; !ag.pick && n < 60 * 60; n++) { step(ag, DT); drainEvents(ag); }
  assert.ok(ag.pick && ag.pick.autoLeft === 3, 'auto면 카드에 3초 카운트다운');
  tickPick(ag, 1.5);
  assert.ok(ag.pick, '3초 전엔 그대로');
  tickPick(ag, 1.6);
  assert.ok(!ag.pick, '3초 지나면 자동 선택');
  assert.equal(Object.keys(ag.spells).length, 1);

  // 선택지 수: 3 + 영웅 Lv15(+1) + 영구 강화 '카드 선택지'(+1)
  const hero15 = () => ({ ...newHero(), cls: 'knight', level: 15 });
  assert.equal(cardCount(createGame({ seed: 1 })), 3);
  assert.equal(cardCount(createGame({ seed: 1, hero: hero15() })), 4);
  const cg = createGame({ seed: 1, hero: hero15(), metaLv: { choice: 1 } });
  assert.equal(cardCount(cg), 5);
  assert.equal(genOffer(cg).length, 5);
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
  const strongLv = { atk: 150, rate: 6, wall: 300 };
  const mk = (key, stage = 5, seed = 40) => {
    const g = createGame({ stage, players: [{ lv: { ...strongLv } }, { lv: { wall: 300 } }], seed });
    g.spells[key] = 3;
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
    const g = mk('gale'), g0 = createGame({ stage: 5, players: [{ lv: strongLv }, { lv: { wall: 300 } }], seed: 40 });
    const shots = gg => { const e = []; run(gg, 2, e); return e.filter(x => x.type === 'shoot' && x.o === 0).length; };
    run(g, 2); run(g0, 2);
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
    const ev = []; run(g, 6, ev);
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
    const g = createGame({ stage: 5, players: [{ lv: { wall: 400 } }, { lv: { wall: 400 } }], seed: 41 });
    g.spells.stoneGolem = 3;
    run(g, 40);
    assert.ok(g.spellFx.golem, '돌 골렘 등장');
    assert.equal(g.wall.hp, g.wall.max, '골렘이 대신 맞아 성벽은 그대로');
    assert.ok(g.spellFx.golem.hp < g.spellFx.golem.maxHp, '골렘 체력 감소');
  }
  console.log('판타지 스킬(14종 효과) 통과');
}

// 원소 융합 8종: game.spells 두 조건이 갖춰지면 활성 + 첫 발견만 first:true (기존 발견 목록 재사용)
function fantasyFusions() {
  const fusionPair = f => {
    for (const a of SPELL_KEYS) for (const b of SPELL_KEYS) {
      if (a === b) continue;
      if (f.test({ [a]: 1, [b]: 1 })) return [a, b];
    }
    return null;
  };
  for (const f of FUSIONS) {
    const pair = fusionPair(f);
    assert.ok(pair, `${f.key}: 조건을 만족하는 스킬 조합이 있어야 함`);
    const g = createGame({ stage: 5, players: [{}, {}], seed: 50 });
    g.spells[pair[0]] = 1;
    refreshFusion(g);
    drainEvents(g);
    assert.ok(!g.fusions.includes(f.key), `${f.key}: 한 쪽만으로는 미활성`);
    g.spells[pair[1]] = 1;
    refreshFusion(g);
    const ev = drainEvents(g);
    assert.ok(g.fusions.includes(f.key), `${f.key}: 활성`);
    assert.ok(ev.some(e => e.type === 'synergy' && e.key === f.key && e.first), `${f.key}: 첫 발견`);
    assert.ok(g.discovered.has(f.key));
    // 런 안에서 유지: 다음 층에도 융합이 켜져 있다
    startStage(g, 6);
    assert.ok(g.fusions.includes(f.key), `${f.key}: 다음 층에도 유지`);
    // 다음 도전(발견 기록 유지)에서 다시 켜지면 first:false — 시작 스킬 두 개로 바로 융합
    const g2 = createGame({ stage: 1, players: [{}, {}], seed: 51, discovered: [...g.discovered], run: { spells: { [pair[0]]: 1, [pair[1]]: 1 } } });
    assert.ok(g2.fusions.includes(f.key));
    assert.ok(drainEvents(g2).some(e => e.type === 'synergy' && e.key === f.key && !e.first), `${f.key}: 재발견은 first:false`);
  }
  console.log('판타지 스킬(융합 8종) 통과');
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
    const g = createGame({ stage: 10, players: [{ lv: { atk: 54, rate: 8, crit: 6, multi: 1, wall: 34 } }, { lv: { wall: 38 } }], seed: 206, best: 40, hero: { ...newHero(), level: 9 } });
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

  const g = createGame({ stage: 1, players: [{}, {}], seed: 205, hero: newHero() });
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
  const rg = createGame({ stage: 1, players: [{ lv: { atk: 20 } }, {}], seed: 205, hero: { ...newHero(), cls: 'knight', level: 5 }, metaLv: { reroll: 2 } });
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

// ── 5) 로그라이트: 메타 ↔ 런 ──
function metaUpgrades() {
  const m = defaults();
  assert.deepEqual(Object.keys(m.metaLv).sort(), [...META_KEYS].sort());
  assert.ok(!buyMeta(m, 'power'), '보석 부족');
  m.gems = 1e6;
  const c0 = metaCost('power', 0);
  assert.ok(buyMeta(m, 'power'));
  assert.equal(m.gems, 1e6 - c0);
  assert.equal(m.metaLv.power, 1);
  assert.ok(!buyMeta(m, 'nope'));
  while (buyMeta(m, 'revive'));
  assert.equal(m.metaLv.revive, metaMax('revive'), '최대 레벨');
  for (const k of META_KEYS) assert.ok(metaCost(k, 1) >= metaCost(k, 0), `${k} 비용 증가`);
  // 배율형은 복리, 옛 퍼크 3종 포함
  assert.ok(Math.abs(metaFx({ power: 2 }).atkMul - 1.1 ** 2) < 1e-12);
  assert.equal(metaFx({ startGold: 3 }).startGold, startGoldAmount(3));
  assert.ok(['pickaxe', 'critBoom', 'startGold'].every(k => META_KEYS.includes(k)));
  // 새 도전에 적용: 시작 골드(두 마법사), 배율, 새로고침, 부활
  m.metaLv.startGold = 3; m.metaLv.power = 5; m.metaLv.reroll = 1; m.metaLv.critBoom = 2;
  const g = newRun(m, { cls: 'knight' }, 1);
  assert.equal(g.players[0].gold, startGoldAmount(3));
  assert.equal(g.players[1].gold, startGoldAmount(3));
  assert.ok(Math.abs(g.players[0].stats.dmg - 10 * 1.1 ** 5) < 1e-9, '기본 마력 적용(Lv0 마력 10)');
  assert.ok(g.players[0].stats.boomR > 0, '치명타 폭발 적용');
  assert.equal(g.rerollLeft, 1);
  console.log('영구 강화 통과');
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

  // 시작 스킬 두 개가 융합이면 1층부터 발동
  const g = newRun(m, { cls: 'ranger', startSpells: ['fireball', 'tornado'] }, 7);
  assert.equal(m.hero.cls, 'ranger');
  assert.deepEqual(g.spells, { fireball: 1, tornado: 1 });
  assert.ok(g.fusions.includes('blazeTornado'), '불꽃 회오리 즉시');
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
    startStage(g, g.stage + 1);
  }
  assert.equal(g.run.floors, 3);
  const cp = g.run.checkpoint;
  assert.equal(cp.stage, 4);
  assert.equal(cp.floors, 3);
  assert.equal(cp.players[0].gold, g.players[0].gold);
  assert.ok(!act(g, 0, { type: 'heroClass', cls: 'knight' }), '2층부터 클래스 변경 불가');

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

  // 정비 화면 영웅 조작: 해금된 클래스만, 판매는 도전 중에만
  assert.ok(campAct(u, { type: 'heroClass', cls: 'cleric' }) && u.hero.cls === 'cleric');
  assert.ok(!campAct(u, { type: 'heroClass', cls: 'assassin' }));
  assert.ok(!campAct(u, { type: 'sell', itemId: 'x' }));
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
  const lv = { atk: 200, rate: 15, crit: 15, multi: 5, wall: 100 };
  for (const s of [1, 5, 15]) {
    const g = createGame({ stage: s, players: [{ lv }, { lv }], seed: 30 + s });
    runUntilEnd(g, 300);
    assert.equal(g.phase, 'clear');
    assert.ok(g.result.time >= 12 && g.result.time <= 25, `${s}층 압도: ${g.result.time.toFixed(1)}초`);
  }
  // 약한 쪽(적이 남음)은 원래 스폰 일정대로
  const w = createGame({ stage: 1, players: [bot('P1'), bot('P2')], seed: 34 });
  runUntilEnd(w, 300);
  assert.ok(w.result.time > 30, `1층 기본 ${w.result.time.toFixed(1)}초`);
  // 광폭화: 80초를 넘기면 이벤트 + 적 피해 배율, 서리·회오리 교착도 결국 끝난다
  const b = createGame({ stage: 12, players: [{ lv: { atk: 30, wall: 60 } }, { lv: { wall: 60 } }], seed: 35, run: { spells: { frostWard: 5, tornado: 5, holyLight: 5 } } });
  const ev = [];
  runUntilEnd(b, 400, ev);
  assert.notEqual(b.phase, 'play', '교착 없음');
  if (ev.some(e => e.type === 'berserk')) assert.ok(b.berserk > 1);
  console.log('학살 가속·광폭화 통과');
}

// ── 6) 캠페인 밸런스 러너: 새 저장 → 도전 반복 → 100층 ──
function avg(a) { return a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN; }

function campaignCheck(seed, parityAt) {
  const t0 = Date.now();
  const snaps = {};
  const { rows, meta } = campaign({
    seed, maxRuns: 60,
    onRun: (r, m) => { for (const b of parityAt) if (m.best >= b && !snaps[b]) snaps[b] = JSON.stringify(m); },
  });
  console.log(`\n캠페인 시드 ${seed}: 도전 ${rows.length}회, ${(rows[rows.length - 1].total / 3600).toFixed(1)}시간, 실행 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  console.log(' run cls      start spells                reach  time   gems  cum(h)  half  new  heroLv');
  const half = [], nw = [];
  for (const r of rows) {
    const h = r.floors.filter(f => f.s <= r.prevBest / 2).map(f => f.t), n = r.floors.filter(f => f.s > r.prevBest).map(f => f.t);
    half.push(...h); nw.push(...n);
    console.log(`${String(r.run).padStart(4)} ${r.cls.padEnd(8)} ${(r.start.join(',') || '-').padEnd(26)} ${String(r.reached).padStart(5)} ${(r.time / 60).toFixed(0).padStart(4)}m ${String(r.gems).padStart(6)} ${(r.total / 3600).toFixed(1).padStart(6)} ${avg(h).toFixed(0).padStart(5)} ${avg(n).toFixed(0).padStart(4)} ${String(r.heroLv).padStart(6)}`);
  }
  const first = rows[0], last = rows[rows.length - 1], hours = last.total / 3600;
  const gain = (last.reached - first.reached) / (rows.length - 1);
  const res = { runs: rows.length, hours, first: first.reached, gain, half: avg(half), newT: avg(nw), heroLv: last.heroLv, cleared: last.reached >= MAX_STAGE };
  console.log(`결과: 첫 도전 ${res.first}층 · 도전당 +${gain.toFixed(2)}층 · ${res.runs}회 · ${hours.toFixed(1)}h · 절반 이하 층 평균 ${res.half.toFixed(1)}s · 새 층 평균 ${res.newT.toFixed(1)}s · 영웅 Lv${res.heroLv}`);
  const bad = [];
  if (!res.cleared) bad.push('100층 미돌파');
  if (res.first < 8 || res.first > 15) bad.push(`첫 도전 ${res.first}층 (목표 8~15)`);
  if (gain < 3 || gain > 6) bad.push(`도전당 +${gain.toFixed(2)}층 (목표 3~6)`);
  if (res.runs < 20 || res.runs > 35) bad.push(`도전 ${res.runs}회 (목표 20~35)`);
  if (hours < 15 || hours > 25) bad.push(`총 ${hours.toFixed(1)}시간 (목표 15~25)`);
  if (!(res.half <= 30)) bad.push(`절반 이하 층 평균 ${res.half.toFixed(1)}s (목표 ≤30)`);
  if (!(res.newT >= 60 && res.newT <= 120)) bad.push(`새 층 평균 ${res.newT.toFixed(1)}s (목표 60~120)`);
  assert.deepEqual(bad, [], bad.join('\n'));
  return { res, snaps };
}

// 같은 메타 상태에서 클래스별 평균 도달 층이 전체 평균의 ±15% 안
function classParity(snap, n) {
  const res = {};
  for (const cls of CLASS_KEYS) {
    const r = [];
    for (let s = 0; s < n; s++) {
      const m = JSON.parse(snap);
      r.push(playRun(m, botLoadout(m, cls), 5000 + s).summary.floorsCleared);
    }
    res[cls] = avg(r);
  }
  const mean = avg(Object.values(res));
  const best = JSON.parse(snap).best;
  console.log(`클래스 동등성(최고 ${best}층 메타, ${n}회씩): ` + Object.entries(res).map(([k, v]) => `${k} ${v.toFixed(1)}(${((v / mean - 1) * 100).toFixed(0)}%)`).join(' · '));
  for (const [k, v] of Object.entries(res)) assert.ok(Math.abs(v / mean - 1) <= 0.15, `${k} 평균 ${v.toFixed(1)}층, 전체 ${mean.toFixed(1)}층 대비 ±15% 밖`);
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
metaUpgrades();
runLifecycle();
reviveWard();
slaughterPace();

if (process.argv.includes('--unit')) process.exit(0); // 단위 테스트만(캠페인 생략)
const parityAt = FULL ? [40, 80] : [40];
const seeds = FULL ? [SEED, SEED + 1, SEED + 2] : [SEED];
let snaps = null;
for (const s of seeds) {
  const c = campaignCheck(s, parityAt);
  snaps ||= c.snaps;
}
for (const b of parityAt) classParity(snaps[b], FULL ? 4 : 3);
console.log('캠페인 밸런스 통과');

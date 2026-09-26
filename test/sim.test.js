// 헤드리스 스모크 + 밸런스 러너: node test/sim.test.js [--quick]
import assert from 'node:assert/strict';
import { fmt, mulberry32 } from '../public/js/util.js';
import { DT, PERK_KEYS, perkCost, perkMax, upgradeCost, SKILLS, SPELL_KEYS, FUSIONS } from '../public/js/config.js';
import { enemyHp, enemyDmg } from '../public/js/stages.js';
import { createGame, startStage, step, act, drainEvents, setPlayer, tickPick, refreshFusion } from '../public/js/sim.js';
import { pickCard, autoHero } from '../public/js/bot.js';
import {
  newHero, HERO_CLASSES, HERO_CLASS_KEYS, unlockedClasses, xpToNext, heroTier, hasMilestone, MILESTONES,
  rollItem, itemPower, heroPower, sellValue, equipItem, sellItem, sellItemsByRarity, autoEquipAll, addToBag,
  BAG_SIZE, SLOTS, RARITIES, SUBSTATS, heroTakeDamage, heroGainXp,
} from '../public/js/hero.js';

const quick = process.argv.includes('--quick');
const seedArg = process.argv.find(a => a.startsWith('--seed='));
const SEED = seedArg ? +seedArg.slice(7) : 12345;
const clsArg = process.argv.find(a => a.startsWith('--cls=')); // 밸런스 러너 영웅 클래스 고정(예: --cls=knight)
const CLS = clsArg ? clsArg.slice(6) : null;
const lv0 = () => ({ atk: 0, rate: 0, crit: 0, multi: 0, wall: 0 });
const perks0 = () => ({ pickaxe: 0, critBoom: 0, startGold: 0 });
const bot = name => ({ name, kind: 'bot', gold: 0, lv: lv0(), perks: perks0(), auto: true });

// 판타지 스킬 카드가 뜨면(마나 가득/보스 등장) 봇 휴리스틱으로 즉시 선택 — 시간은 흐르지 않는다(실제 일시정지와 동일)
function resolvePick(g, collect) {
  const ev0 = drainEvents(g);
  if (collect) collect.push(...ev0);
  act(g, 0, { type: 'pick', index: pickCard(g) });
  const ev1 = drainEvents(g);
  if (collect) collect.push(...ev1);
}

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
  const strong = { lv: { atk: 60, rate: 10, crit: 5, multi: 2, wall: 10 } };
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

// ── 2) 밸런스 러너 ──
function balance(last) {
  const t0 = Date.now();
  const g = createGame({ stage: 1, players: [bot('P1'), bot('P2')], seed: SEED, best: CLS ? 40 : 0, hero: CLS ? { ...newHero(), cls: CLS, autoEquip: true } : newHero() });
  const gems = [0, 0];
  let attempts = 0;
  const rows = [];
  const buyPerks = () => {
    for (let i = 0; i < 2; i++) {
      const pk = g.players[i].perks;
      for (;;) {
        let key = null;
        for (const k of PERK_KEYS) if (pk[k] < perkMax(k) && (!key || perkCost(k, pk[k]) < perkCost(key, pk[key]))) key = k;
        if (!key || perkCost(key, pk[key]) > gems[i]) break;
        gems[i] -= perkCost(key, pk[key]);
        pk[key]++; // 스탯 반영은 다음 startStage에서
      }
    }
  };
  let ev = [];
  const play = s => {
    attempts++;
    startStage(g, s);
    ev = [];
    runUntilEnd(g, 900, ev);
    if (g.phase === 'play') { g.phase = 'defeat'; g.lastLoss = 1; } // 시간 초과 = 패배
    if (g.phase === 'clear') {
      gems[0] += g.result.gems[0];
      gems[1] += g.result.gems[1];
      buyPerks();
    }
    return g.phase === 'clear';
  };
  let fails = 0;
  for (let s = 1; s <= last; s++) {
    let tries = 0, streak = 0, ok = false;
    while (!ok) {
      tries++;
      ok = play(s);
      if (ok) break;
      streak++;
      assert.ok(tries <= 9, `스테이지 ${s} 재도전 8회 초과`);
      if (streak >= 3 && s > 1) { play(s - 1); streak = 0; }
    }
    const p = g.players[0];
    rows.push({ s, tries, t: g.result.time, stars: g.result.stars, dmg: p.stats.dmg, gold: p.gold, hp: enemyHp(s), loss: 1 - g.wall.hp / g.wall.max, hits: g.wall.max / enemyDmg(s), lv: { ...p.lv }, lv2: { ...g.players[1].lv }, heroLv: g.hero.level, heroCls: g.hero.cls, heroPow: heroPower(g.hero), downs: ev.filter(e => e.type === 'heroDown').length });
    fails += tries - 1;
  }
  const secs = (Date.now() - t0) / 1000;
  console.log('stage tries  time stars      dmg     gold   enemyHP  HP/dmg  loss%  wallHits  P1 atk/rate/crit/multi/wall  P2 wall  heroLv/cls/pow/downs');
  for (const r of rows) {
    console.log(`${String(r.s).padStart(5)} ${String(r.tries).padStart(5)} ${r.t.toFixed(0).padStart(5)} ${String(r.stars).padStart(5)} ${fmt(r.dmg).padStart(8)} ${fmt(r.gold).padStart(8)} ${fmt(r.hp).padStart(9)} ${(r.hp / r.dmg).toFixed(1).padStart(7)} ${(r.loss * 100).toFixed(0).padStart(6)} ${r.hits.toFixed(0).padStart(9)}  ${r.lv.atk}/${r.lv.rate}/${r.lv.crit}/${r.lv.multi}/${r.lv.wall}  ${r.lv2.wall}  ${r.heroLv}/${r.heroCls}/${r.heroPow}/${r.downs}`);
  }
  console.log(`총 시도 ${attempts}, 패배 ${fails}, 실행 ${secs.toFixed(1)}s`);
  const bad = [];
  for (const r of rows) {
    if (r.t < 60 || r.t > 120) bad.push(`스테이지 ${r.s} 소요 ${r.t.toFixed(1)}s`);
    if (r.s <= 9 && r.tries > 1) bad.push(`스테이지 ${r.s} 패배`);
  }
  if (last >= 100) {
    if (attempts > 140) bad.push(`총 시도 ${attempts} > 140`);
    const d = rows[rows.length - 1].dmg;
    if (d < 1e6 || d > 1e11) bad.push(`100층 데미지 ${fmt(d)}`);
    const hl = rows[rows.length - 1].heroLv;
    if (hl < 55 || hl > 85) bad.push(`100층 영웅 레벨 ${hl}`);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
  console.log('밸런스 통과');
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
    const sg = createGame({ stage: key === 'giant' ? 1 : 12, players: [{ lv }, { lv: { wall: 200 } }], seed: 3 });
    const sev = drainEvents(sg);
    assert.ok(sg.players[0].syn.includes(key), `${key} 활성`);
    assert.ok(sev.some(e => e.type === 'synergy' && e.key === key && e.o === 0 && e.first), `${key} 발견 이벤트`);
    assert.ok(sg.discovered.has(key));
    const rev = [];
    let pierced = false, homed = false, burned = false;
    for (let t = 0; t < 90 && sg.phase === 'play'; t += DT) {
      if (sg.pick) { resolvePick(sg, rev); continue; }
      step(sg, DT);
      rev.push(...drainEvents(sg));
      pierced ||= sg.bullets.some(b => b.hit && b.hit.length >= 2);
      homed ||= sg.bullets.some(b => b.tgt && typeof b.tgt === 'object');
      burned ||= sg.enemies.some(e => e.burnT > 0);
    }
    const kinds = new Set(of(rev, 'hit').map(e => e.kind));
    if (key === 'flame') assert.ok(burned && kinds.has('flame'), '화상');
    if (key === 'pierce') assert.ok(pierced && kinds.has('pierce'), '관통');
    if (key === 'chain') assert.ok(of(rev, 'chain').some(e => e.o === 0 && e.pts.length >= 2), '체인');
    if (key === 'homing') assert.ok(homed && kinds.has('homing'), '유도');
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
  assert.ok(of(hev, 'hit').some(e => Math.abs(e.dmg - hd * 1.25) < 1e-6), '쌍둥이 +25%');

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
  assert.equal(fg.result.gems[0], Math.ceil((fg.result.stars + 0 + 0) * 1.5));
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
  const tgt = kg.enemies[0];
  const y0 = tgt.y;
  kg.freezeT = 1; // 이동 멈춤
  run(kg, 0.5);
  assert.ok(tgt.dead || tgt.y < y0, '넉백');
  console.log('중독성 레이어 통과');
}

// ── 3) 판타지 스킬 선택 ──
function fantasyPick() {
  // 마나 → 카드 → 전투 정지(시간도 멈춤), 카드 3장은 서로 다른 스킬
  const g = createGame({ stage: 1, players: [{ lv: { atk: 20 } }, {}], seed: 21 });
  for (let n = 0; !g.pick && g.phase === 'play' && n < 60 * 200; n++) { step(g, DT); drainEvents(g); }
  assert.ok(g.pick, '마나가 가득 차거나(또는 보스 등장) 카드가 뜬다');
  assert.equal(g.mana.cur, g.mana.max);
  assert.equal(g.pick.cards.length, 3, '카드 3장');
  assert.equal(new Set(g.pick.cards.map(c => c.spell)).size, 3, '서로 다른 스킬');
  for (const c of g.pick.cards) assert.equal(c.level, 1, '처음 뽑으면 Lv1');
  const before = { killed: g.progress.killed, phaseT: g.phaseT, n: g.enemies.length };
  for (let k = 0; k < 30; k++) step(g, DT);
  assert.deepEqual({ killed: g.progress.killed, phaseT: g.phaseT, n: g.enemies.length }, before, '선택 중엔 전투 정지(시간도 멈춤)');
  assert.ok(!act(g, 0, { type: 'upgrade', stat: 'atk' }), '선택 중엔 다른 조작도 불가');
  assert.ok(!act(g, 1, { type: 'pick', index: 0 }), 'AI 동료는 카드를 고르지 않음');

  // 선택 적용: 레벨 · spellPick 이벤트 · game.spells 반영
  const key = g.pick.cards[0].spell;
  drainEvents(g);
  assert.ok(act(g, 0, { type: 'pick', index: 0 }));
  assert.equal(g.spells[key], 1);
  assert.equal(g.pick, null, '선택하면 정지 해제');
  assert.ok(drainEvents(g).some(e => e.type === 'spellPick' && e.spell === key && e.level === 1));
  assert.ok(!act(g, 0, { type: 'pick', index: 0 }), '카드가 없을 때 pick은 실패');

  // 만렙 3 · 만렙뿐이면 카드가 뜨지 않음(마나·보스 트리거 모두)
  for (const k of SPELL_KEYS) g.spells[k] = 3;
  const killed0 = g.progress.killed;
  for (let n = 0; !g.pick && n < 60 * 40 && g.progress.killed < g.progress.total; n++) { step(g, DT); drainEvents(g); }
  assert.ok(g.progress.killed > killed0, '그동안 처치는 계속 진행');
  assert.ok(!g.pick, '스킬이 모두 만렙이면 마나가 차도 카드가 뜨지 않는다');

  // 자동 선택: auto 켜져 있으면 tickPick 3초 뒤 봇 휴리스틱으로 자동 선택
  g.spells = {};
  g.players[0].auto = true;
  startStage(g, 2);
  for (let n = 0; !g.pick && n < 60 * 60; n++) { step(g, DT); drainEvents(g); }
  assert.ok(g.pick && g.pick.autoLeft === 3, 'auto면 카드에 3초 카운트다운');
  tickPick(g, 1.5);
  assert.ok(g.pick, '3초 전엔 그대로');
  tickPick(g, 1.6);
  assert.ok(!g.pick, '3초 지나면 자동 선택');
  assert.equal(Object.keys(g.spells).length, 1);

  // 스테이지 시작은 빌드를 리셋한다
  startStage(g, 3);
  assert.deepEqual(g.spells, {});
  assert.deepEqual(g.fusions, []);
  assert.equal(g.pick, null);
  assert.equal(g.mana.cur, 0);
  console.log('판타지 스킬(카드) 통과');
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
    assert.ok(of(ev, 'hit').some(e => e.o === 0 && !e.crit && e.dmg > st.dmg * 1.3), '저주 낙인: 받는 피해 증가');
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
    // 스테이지가 바뀌면 스킬 빌드는 리셋되지만 발견 기록은 유지 → 재활성은 first:false
    startStage(g, 6);
    g.spells[pair[0]] = 1;
    g.spells[pair[1]] = 1;
    refreshFusion(g);
    assert.ok(drainEvents(g).some(e => e.type === 'synergy' && e.key === f.key && !e.first), `${f.key}: 재발견은 first:false`);
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

  // Lv5 마일스톤: 스테이지당 카드 새로고침 1회 (Lv4 이하는 불가)
  assert.equal(g.rerollLeft, 0, '스테이지 시작 때 Lv1 → 새로고침 없음');
  assert.ok(!act(g, 0, { type: 'reroll' }));
  g.hero.level = 5;
  startStage(g, 1);
  for (let n = 0; !g.pick && n < 60 * 200; n++) { step(g, DT); drainEvents(g); }
  assert.equal(g.rerollLeft, 1);
  const old = g.pick;
  assert.ok(!act(g, 1, { type: 'reroll' }), 'AI 동료는 새로고침 불가');
  assert.ok(act(g, 0, { type: 'reroll' }));
  assert.ok(g.pick && g.pick !== old && g.pick.cards.length === 3, '새 카드 3장');
  assert.ok(drainEvents(g).some(e => e.type === 'pickOffer' && e.reroll));
  assert.ok(!act(g, 0, { type: 'reroll' }), '스테이지당 1회');
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

if (!CLS) { // --cls=... 는 밸런스 러너만
smoke();
addiction();
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
}
balance(quick ? 15 : 100);

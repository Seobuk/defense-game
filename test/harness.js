// 로그라이트 헤드리스 봇 러너(테스트 공용): 새 저장에서 도전 → 정산 → 보석·골드(마법사 수련) 소비 → 다시 도전
import { DT, MAX_STAGE, TRAIN_KEYS } from '../public/js/config.js';
import { startStage, step, act, drainEvents } from '../public/js/sim.js';
import { pickCard, botSpendGems, botSpendGold, botLoadout, botTalents, randomTalents } from '../public/js/bot.js';
import { TALENTS, branchSpent, branchMax } from '../public/js/talents.js';
import { mulberry32 } from '../public/js/util.js';
import { newRun, endRun } from '../public/js/run.js';
import { defaults } from '../public/js/save.js';
import { HERO_CLASS_KEYS, unlockedClasses } from '../public/js/hero.js';

// 카드가 뜨면 봇 휴리스틱으로 즉시 선택(시간은 멈춰 있음)
export function resolvePick(g, collect) {
  const ev0 = drainEvents(g);
  if (collect) collect.push(...ev0);
  act(g, 0, { type: 'pick', index: pickCard(g) });
  const ev1 = drainEvents(g);
  if (collect) collect.push(...ev1);
}

// 한 층을 끝날 때까지(클리어/패배/시간 초과) 진행
export function playStage(g, maxT = 900, collect = null) {
  for (let t = 0; t < maxT && g.phase === 'play'; t += DT) {
    if (g.pick) { resolvePick(g, collect); continue; }
    step(g, DT);
    const ev = drainEvents(g);
    if (collect) collect.push(...ev);
  }
}

// 봇 플레이어: 자동 진행 ON(궁극기) + kind 'bot'(봇 전용 경로: 카드 자동 선택 · 운석·빙결 autoSkill). 플레이어 UI는 kind를 바꿀 수 없다
export function botPlayer(g) {
  g.players[0].auto = true;
  g.players[0].kind = 'bot';
}
// 사람 플레이어(폰에서 자동 진행 ON + 카드 '자동 선택' ON): 궁극기·다음 층·카드는 자동, 운석·빙결은 안 누른다(autoSkill 없음)
export function humanPlayer(g) {
  g.players[0].auto = true;
  g.players[0].kind = 'human';
  g.players[0].autoPick = true;
}

// 도전 1회: 1층부터 성벽이 무너질 때까지. → { summary, floors:[{ s, t }], share, skillShare, full, fusions, firstFuse }
// fusions = 이번 도전의 합체 횟수, firstFuse = 첫 합체 층(없으면 null)
// talents: 'build'(추천 빌드, 레벨업 포인트도 자동) | 'random'(시작 시 무작위 배분) | 'none'(특성 없음)
// opts.collabOff: 협공 효과 끄기(협공 강도 비교용)
// skillShare = 11층부터 성벽 마법사의 피해 중 고른 스킬(카드·융합) 비중(10층 이전에 끝나면 null)
export function playRun(meta, loadout, seed, talents = 'build', opts = {}) {
  meta.hero.autoTalent = talents === 'build';
  const cls = loadout.cls;
  if (talents === 'build') botTalents(meta.hero, cls);
  else if (talents === 'random') randomTalents(meta.hero, cls, mulberry32(seed + 77));
  const saved = talents === 'none' ? meta.hero.talents : null;
  if (saved) meta.hero.talents = {};
  const g = newRun(meta, loadout, seed);
  botPlayer(g); // 상한(운석·빙결을 제때 누르는 플레이어). 사람 기준 확인은 humanPlayer — sim.test humanFirstRun
  g.collabOff = !!opts.collabOff;
  const floors = [];
  let snap = null, firstFuse = null;
  for (;;) {
    playStage(g);
    if (firstFuse == null && g.fusions.length) firstFuse = g.stage;
    if (g.phase === 'play') { // 시간 초과 = 패배 처리(발생하면 밸런스 문제)
      g.phase = 'defeat'; g.run.over = true; g.run.time += g.phaseT;
    }
    if (g.phase === 'clear') floors.push({ s: g.stage, t: g.result.time });
    if (g.run.over) break;
    if (g.stage === 10) snap = { all: g.dmgDone[0] + g.dmgDone[1], sk: g.dmgSkill[0] + g.dmgSkill[1] };
    startStage(g, g.stage + 1);
  }
  const skillShare = snap ? (g.dmgSkill[0] + g.dmgSkill[1] - snap.sk) / Math.max(1, g.dmgDone[0] + g.dmgDone[1] - snap.all) : null;
  if (saved) meta.hero.talents = saved;
  const full = !saved && TALENTS[g.hero.cls].some(b => branchSpent(meta.hero, g.hero.cls, b.key) >= branchMax(g.hero.cls, b.key)); // 특성 완성 = 도전이 끝날 때 한 갈래를 마스터했나
  const d = g.dmgDone, share = d[2] / Math.max(1, d[0] + d[1] + d[2]);
  return { g, summary: endRun(g, meta), floors, share, skillShare, full, collabs: [...g.collabs], fusions: g.fusions.length, firstFuse };
}

// 새 저장부터 100층 돌파까지 도전 반복. cls: 고정 클래스(없으면 해금된 클래스 순환)
export function campaign({ seed = 1, maxRuns = 60, cls = null, onRun = null, until = () => false } = {}) {
  const meta = defaults();
  meta.hero.autoEquip = true;
  const rows = [];
  let total = 0;
  for (let i = 0; i < maxRuns; i++) {
    const open = unlockedClasses(meta.best);
    const c = cls || open[i % open.length];
    const lo = botLoadout(meta, c);
    const { summary, floors, share, skillShare, full, collabs, fusions, firstFuse } = playRun(meta, lo, seed * 1000 + i);
    total += summary.time;
    const row = {
      run: i + 1, cls: lo.cls, start: lo.startSpells, reached: summary.floorsCleared, stage: summary.stageReached,
      prevBest: summary.prevBest, time: summary.time, gems: summary.rewards.gems, gold: summary.rewards.gold, total, floors, heroLv: meta.hero.level,
      share, skillShare, full, collabs, fusions, firstFuse, train: TRAIN_KEYS.map(k => meta.training[k]).join('/'),
    };
    rows.push(row);
    botSpendGems(meta);
    botSpendGold(meta);
    if (onRun) onRun(row, meta);
    if (summary.victory || until(meta, row)) break;
  }
  return { meta, rows };
}

export { HERO_CLASS_KEYS, MAX_STAGE };

// 초반 템포 지표(1~floors층, 새 저장 첫 도전): 마법과 영웅 전투가 전장 가운데에서 계속 보이는가
// fought = 적이 첫 피해를 입고 죽기까지(초, 중앙값) · age = 등장부터 처치까지(중앙값) · midKill = 중앙 띠(y 380~700) 처치 비율
// heroMid = 영웅이 싸우는 시간(fightE 있음) 중 중앙 띠에 있던 비율 · castsPerMin = 나(P1)의 스킬 시전/분
export const MID_BAND = [380, 700];
export function earlyPacing({ seed = 1, cls = 'knight', floors = 10, meta = defaults() } = {}) {
  meta.hero.autoEquip = true;
  meta.hero.autoTalent = true;
  botTalents(meta.hero, cls);
  const g = newRun(meta, botLoadout(meta, cls), seed);
  botPlayer(g);
  const kills = [], casts = [];
  let playT = 0, fightT = 0, midT = 0;
  const inBand = y => y >= MID_BAND[0] && y <= MID_BAND[1];
  for (;;) {
    for (let t = 0; t < 900 && g.phase === 'play'; t += DT) {
      const ev = [];
      if (g.pick) { resolvePick(g, ev); } else {
        step(g, DT);
        ev.push(...drainEvents(g));
        playT += DT;
        const h = g.heroUnit;
        if (h && h.state !== 'down' && h.fightE) { fightT += DT; if (inBand(h.y)) midT += DT; }
      }
      for (const e of ev) {
        if (e.type === 'kill' && !e.isBoss) kills.push(e);
        else if (e.type === 'cast' && !e.basic && e.o === 0) casts.push(e);
      }
    }
    if (g.phase !== 'clear' || g.stage >= floors) break;
    startStage(g, g.stage + 1);
  }
  const med = a => { a = [...a].sort((x, y) => x - y); return a.length ? a[a.length >> 1] : NaN; };
  return {
    reached: g.phase === 'clear' ? g.stage : g.stage - 1,
    fought: med(kills.map(k => k.fought)), age: med(kills.map(k => k.age)),
    midKill: kills.filter(k => inBand(k.y)).length / Math.max(1, kills.length),
    heroMid: midT / Math.max(1e-9, fightT), castsPerMin: casts.length / (playT / 60),
    kills: kills.length, playT,
  };
}

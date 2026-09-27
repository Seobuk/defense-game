// 로그라이트 헤드리스 봇 러너(테스트 공용): 새 저장에서 도전 → 정산 → 보석 소비 → 다시 도전
import { DT, MAX_STAGE } from '../public/js/config.js';
import { startStage, step, act, drainEvents } from '../public/js/sim.js';
import { pickCard, botSpendGems, botLoadout } from '../public/js/bot.js';
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

// 도전 1회: 1층부터 성벽이 무너질 때까지. → { summary, floors:[{ s, t }] }
export function playRun(meta, loadout, seed) {
  const g = newRun(meta, loadout, seed);
  g.players[0].auto = true; // 봇: 자동 강화
  const floors = [];
  for (;;) {
    playStage(g);
    if (g.phase === 'play') { // 시간 초과 = 패배 처리(발생하면 밸런스 문제)
      g.phase = 'defeat'; g.run.over = true; g.run.time += g.phaseT;
    }
    if (g.phase === 'clear') floors.push({ s: g.stage, t: g.result.time });
    if (g.run.over) break;
    startStage(g, g.stage + 1);
  }
  return { g, summary: endRun(g, meta), floors };
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
    const { summary, floors } = playRun(meta, lo, seed * 1000 + i);
    total += summary.time;
    const row = {
      run: i + 1, cls: lo.cls, start: lo.startSpells, reached: summary.floorsCleared, stage: summary.stageReached,
      prevBest: summary.prevBest, time: summary.time, gems: summary.rewards.gems, total, floors, heroLv: meta.hero.level,
    };
    rows.push(row);
    botSpendGems(meta);
    if (onRun) onRun(row, meta);
    if (summary.victory || until(meta, row)) break;
  }
  return { meta, rows };
}

export { HERO_CLASS_KEYS, MAX_STAGE };

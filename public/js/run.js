// 메타(영구) ↔ 런(도전) 연결 — 정비 화면·결과 화면·이어하기가 부르는 함수. DOM 없음
// meta = save.js normalize() 결과 객체(제자리에서 바꾼다):
//   { gems, best, metaLv, hero, discovered, seenSpells, runs, lastLoadout, auto, name, run, ... }
import { META_KEYS, metaMax, metaCost, metaFx, RUN_GEMS, SPELL_KEYS } from './config.js';
import { createGame, serializeRun, normalizeRun } from './sim.js';
import { unlockedClasses, addXp, equipItem, autoEquipAll } from './hero.js';
import { allocateTalent, resetTalents } from './talents.js';

export { serializeRun, normalizeRun };

// 영구 강화 구매(보석). 성공하면 true
export function buyMeta(meta, key) {
  if (!META_KEYS.includes(key)) return false;
  const lv = meta.metaLv[key] | 0;
  if (lv >= metaMax(key)) return false;
  const cost = metaCost(key, lv);
  if (!(meta.gems >= cost)) return false;
  meta.gems -= cost;
  meta.metaLv[key] = lv + 1;
  return true;
}

// 시작 스킬: 영구 강화로 연 슬롯 수(0~2)만큼, 한 번이라도 뽑아 본 스킬 중에서
export const startSlots = meta => metaFx(meta.metaLv).startSlots;
export const startSpellChoices = meta => SPELL_KEYS.filter(k => meta.seenSpells.includes(k));

// 로드아웃 검증: 해금된 클래스(없으면 현재/첫 클래스), 시작 스킬은 뽑아 본 것만·중복 없이·슬롯 수까지
export function validLoadout(meta, lo) {
  lo = lo && typeof lo === 'object' ? lo : {};
  const classes = unlockedClasses(meta.best);
  const cls = classes.includes(lo.cls) ? lo.cls : classes.includes(meta.hero.cls) ? meta.hero.cls : classes[0];
  const startSpells = [...new Set(Array.isArray(lo.startSpells) ? lo.startSpells : [])]
    .filter(k => meta.seenSpells.includes(k)).slice(0, startSlots(meta));
  return { cls, startSpells };
}

const players = (meta, p0, p1, auto) => [
  { name: meta.name, kind: 'human', auto, ...p0 },
  { name: 'AI 동료', kind: 'bot', auto: true, ...p1 },
];
const common = (meta, seed) => ({
  best: meta.best, seed, discovered: meta.discovered, seenSpells: meta.seenSpells, hero: meta.hero, metaLv: meta.metaLv,
});

// 새 도전(1층부터). 영구 강화 적용: 시작 골드(두 마법사), 배율, 새로고침, 시작 스킬 Lv1
export function newRun(meta, loadout, seed) {
  const lo = validLoadout(meta, loadout);
  meta.hero.cls = lo.cls;
  meta.lastLoadout = lo;
  const gold = metaFx(meta.metaLv).startGold;
  const game = createGame({
    ...common(meta, seed), stage: 1,
    players: players(meta, { gold }, { gold }, !!meta.auto),
    run: { spells: Object.fromEntries(lo.startSpells.map(k => [k, 1])), startBest: meta.best, loadout: lo },
  });
  meta.run = game.run.checkpoint;
  return game;
}

// 이어하기: 저장된 스테이지 시작 시점부터. 저장이 없으면 null
export function restoreRun(meta, saved = meta.run, seed) {
  if (!saved || typeof saved !== 'object') return null;
  const r = normalizeRun(saved);
  if (r.loadout.cls && unlockedClasses(meta.best).includes(r.loadout.cls)) meta.hero.cls = r.loadout.cls;
  const [a, b] = r.players;
  return createGame({ ...common(meta, seed), players: players(meta, a, b, r.auto), run: r });
}

// 도전 종료 정산(성벽 붕괴·100층 돌파·포기 모두). meta에 보석·최고 기록·도감·뽑아 본 스킬을 반영하고 run 저장을 지운다.
// 두 번 부르면 두 번째는 null
export function endRun(game, meta) {
  const r = game.run;
  if (r.ended) return null;
  r.ended = true;
  const cleared = r.floors, prevBest = r.startBest;
  const bestBonus = RUN_GEMS.best(prevBest, cleared);
  const rewards = { ...r.gems, best: bestBonus };
  rewards.gems = rewards.floor + rewards.first + rewards.boss + rewards.flawless + bestBonus;
  const before = unlockedClasses(prevBest); // 도전 중 UI가 meta.best를 올려도 이번 해금을 놓치지 않게
  meta.gems += rewards.gems;
  meta.best = Math.max(meta.best, cleared);
  meta.discovered = [...new Set([...meta.discovered, ...game.discovered])];
  meta.seenSpells = SPELL_KEYS.filter(k => meta.seenSpells.includes(k) || game.seenSpells.has(k));
  meta.runs = (meta.runs | 0) + 1;
  meta.run = null;
  return {
    stageReached: game.stage, floorsCleared: cleared, victory: r.victory,
    prevBest, best: meta.best, newBest: cleared > prevBest,
    bossesKilled: r.bosses, time: r.time, rewards,
    spells: { ...game.spells }, loadout: r.loadout,
    newClasses: unlockedClasses(meta.best).filter(c => !before.includes(c)),
  };
}

// 오프라인 보상 지급(save.js computeOffline 결과). 오른 영웅 레벨 목록 반환
export function applyOffline(meta, off) {
  if (!off) return [];
  meta.gems += Math.max(0, off.gems | 0);
  return addXp(meta.hero, off.xp);
}

// 정비 화면(도전 사이)의 영웅 조작. 판매는 도전 중에만(골드가 런 한정이라)
// 특성: {type:'talent', cls, key}(1랭크) · {type:'talentReset', cls}(무료 초기화 — 정비 화면 전용) · {type:'autoTalent', on}
export function campAct(meta, a) {
  const hero = meta.hero;
  if (!a || typeof a !== 'object') return false;
  switch (a.type) {
    case 'heroClass':
      if (!unlockedClasses(meta.best).includes(a.cls)) return false;
      hero.cls = a.cls;
      return true;
    case 'equip': return equipItem(hero, a.itemId);
    case 'talent': return unlockedClasses(meta.best).includes(a.cls) && allocateTalent(hero, a.cls, a.key);
    case 'talentReset': return resetTalents(hero, a.cls);
    case 'autoTalent': hero.autoTalent = !!a.on; return true;
    case 'autoEquip':
      hero.autoEquip = !!a.on;
      if (hero.autoEquip) autoEquipAll(hero);
      return true;
  }
  return false;
}

// 메타(영구) ↔ 런(도전) 연결 — 정비 화면·결과 화면·이어하기가 부르는 함수. DOM 없음
// meta = save.js normalize() 결과 객체(제자리에서 바꾼다):
//   { gems, gold, best, metaLv, training, hero, discovered, seenSpells, runs, lastLoadout, settings:{ autoNext, ... }, name, run, ... }
import { META_KEYS, metaMax, metaCost, metaFx, RUN_GEMS, SPELL_KEYS, TRAIN_KEYS, trainMax, trainCost, START_CARDS } from './config.js';
import { createGame, serializeRun, normalizeRun } from './sim.js';
import { unlockedClasses, addXp, equipItem, autoEquipAll, sellItem, sellItemsByRarity } from './hero.js';
import { allocateTalent, resetTalents, recommendNext } from './talents.js';
import { runBonus, takePrep, buyTrainBreak, buyGemBreak, togglePrep, openBox, unlockRelic } from './shop.js'; // 4차 경제 싱크
import { relicPool } from './relics.js'; // 4차 유물

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

// 마법사 수련 구매(골드, 정비 화면). 두 성벽 마법사 공통. 성공하면 true
export function buyTraining(meta, key) {
  if (!TRAIN_KEYS.includes(key)) return false;
  const lv = meta.training[key] | 0;
  if (lv >= trainMax(key)) return false;
  const cost = trainCost(key, lv);
  if (!(meta.gold >= cost)) return false;
  meta.gold -= cost;
  meta.training[key] = lv + 1;
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

// 성벽 마법사 = 나 한 명(마법사 수련 meta.training). auto = 자동 진행(settings.autoNext) · autoPick = 카드 자동 선택(settings.autoPick)
// ponytail: players[1]은 협동 모드용 잠든 자리(sim은 g.coop일 때만 깨운다)
const players = (meta, p0, p1) => [
  { name: meta.name, kind: 'human', auto: !!meta.settings?.autoNext, autoPick: !!meta.settings?.autoPick, lv: meta.training, ...p0 },
  { name: '동료', kind: 'human', auto: false, lv: meta.training, ...p1 },
];
const common = (meta, seed) => ({
  best: meta.best, seed, discovered: meta.discovered, seenSpells: meta.seenSpells, hero: meta.hero, metaLv: meta.metaLv,
  bonus: runBonus(meta), // 수련 돌파 · 보석 돌파(shop.js) → sim computeFx
  relicPool: relicPool(meta), // 유물 후보 풀(시작 8종 + 보석으로 해금한 유물 — relics.js)
});

// 새 도전(1층부터). 마법사 수련 · 영구 강화(새로고침·선택지 등) · 시작 스킬 Lv1 적용. 1층 시작 시 무료 카드
export function newRun(meta, loadout, seed) {
  const lo = validLoadout(meta, loadout);
  meta.hero.cls = lo.cls;
  meta.lastLoadout = lo;
  const prep = takePrep(meta); // 출정 준비(shop.js): 이번 도전에서 쓰고 meta.prep은 비운다
  const game = createGame({
    ...common(meta, seed), stage: 1, startCards: START_CARDS + (prep.card ? 1 : 0), bonusForgets: prep.forget ? 1 : 0,
    players: players(meta, { gold: 0 }, { gold: 0 }),
    run: { spells: Object.fromEntries(lo.startSpells.map(k => [k, 1])), startBest: meta.best, loadout: lo, prep },
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
  // 1층 시작 체크포인트면 도전 시작 무료 카드도 다시(체크포인트는 카드를 고르기 전 상태)
  return createGame({ ...common(meta, seed), players: players(meta, a, b), run: r, startCards: r.stage === 1 && r.floors === 0 ? START_CARDS + (r.prep?.card ? 1 : 0) : 0 });
}

// 도전 종료 정산(성벽 붕괴·100층 돌파·포기 모두). meta에 보석·골드(이번 도전에서 번 P1 골드)·최고 기록·도감·뽑아 본 스킬을 반영하고 run 저장을 지운다.
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
  const g0 = Number(game.players[0].gold);
  rewards.gold = Number.isFinite(g0) && g0 > 0 ? Math.floor(g0) : 0; // 골드가 깨져도(NaN/Infinity) 영구 재화는 지켜야 함
  meta.gems += rewards.gems;
  meta.gold = (meta.gold || 0) + rewards.gold;
  meta.best = Math.max(meta.best, cleared);
  meta.discovered = [...new Set([...meta.discovered, ...game.discovered])];
  meta.seenSpells = SPELL_KEYS.filter(k => meta.seenSpells.includes(k) || game.seenSpells.has(k));
  meta.runs = (meta.runs | 0) + 1;
  meta.run = null;
  return {
    stageReached: game.stage, floorsCleared: cleared, victory: r.victory, abandoned: !r.victory && game.phase !== 'defeat', // 도전 포기
    prevBest, best: meta.best, newBest: cleared > prevBest,
    bossesKilled: r.bosses, time: r.time, rewards,
    spells: { ...game.spells }, mutations: { ...game.mutations }, loadout: r.loadout, // 변이 — 결과 화면 스킬 줄
    relics: [...game.relics], forgets: r.forgets, // 유물(고른 순서) · 쓴 망각 수 — 결과 화면
    newClasses: unlockedClasses(meta.best).filter(c => !before.includes(c)),
  };
}

// 오프라인 보상 지급(save.js computeOffline 결과). 오른 영웅 레벨 목록 반환
export function applyOffline(meta, off) {
  if (!off) return [];
  meta.gems += Math.max(0, off.gems | 0);
  meta.gold += Math.max(0, Math.floor(Number(off.gold) || 0));
  return addXp(meta.hero, off.xp);
}

// 정비 화면(도전 사이) 조작: 마법사 수련 {type:'train', stat} · 영구 강화 {type:'meta', key} · 영웅 클래스·장착·판매(골드는 바로 meta.gold)
// 특성: {type:'talent', cls, key}(1랭크) · {type:'talentReset', cls}(무료 초기화 — 정비 화면 전용) · {type:'autoTalent', on, cls?}
// · {type:'talentNoticeSeen'}(hero.talentNotice — '특성이 개편되어 포인트를 돌려받았어요' 1회 안내를 닫음)
export function campAct(meta, a) {
  const hero = meta.hero;
  if (!a || typeof a !== 'object') return false;
  switch (a.type) {
    case 'heroClass':
      if (!unlockedClasses(meta.best).includes(a.cls)) return false;
      hero.cls = a.cls;
      return true;
    case 'train': return buyTraining(meta, a.stat);
    case 'meta': return buyMeta(meta, a.key);
    case 'equip': return equipItem(hero, a.itemId);
    case 'sell': {
      const v = sellItem(hero, a.itemId);
      if (v == null) return false;
      meta.gold += v;
      return true;
    }
    case 'sellRarity': {
      const v = sellItemsByRarity(hero, a.rarity);
      if (!v) return false;
      meta.gold += v;
      return true;
    }
    case 'talent': return unlockedClasses(meta.best).includes(a.cls) && allocateTalent(hero, a.cls, a.key);
    case 'talentReset': return resetTalents(hero, a.cls);
    case 'autoTalent': { // 켜는 즉시 남은 포인트를 추천 빌드로 배분(특성 개편 환불 뒤 빈 트리 방지). cls = 보고 있는 클래스 탭
      hero.autoTalent = !!a.on;
      const c = unlockedClasses(meta.best).includes(a.cls) ? a.cls : hero.cls;
      if (hero.autoTalent && c) for (let n = recommendNext(hero, c); n && allocateTalent(hero, c, n.key); n = recommendNext(hero, c));
      return true;
    }
    case 'talentNoticeSeen': if (!hero.talentNotice) return false; hero.talentNotice = false; return true; // 특성 개편 환불 안내를 봤다
    case 'autoEquip':
      hero.autoEquip = !!a.on;
      if (hero.autoEquip) autoEquipAll(hero);
      return true;
    // 4차 경제(shop.js): 수련 돌파 {stat} · 보석 돌파 {key} · 출정 준비 {key}(다시 누르면 환불) · 장비 상자 {key} → { item, sold, equipped }
    case 'trainBreak': return buyTrainBreak(meta, a.stat);
    case 'gemBreak': return buyGemBreak(meta, a.key);
    case 'prep': return togglePrep(meta, a.key);
    case 'box': return openBox(meta, a.key);
    case 'relic': return unlockRelic(meta, a.key); // 유물 해금(보석, relics.js)
  }
  return false;
}

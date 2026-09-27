// 자동 진행 봇(카드 자동 선택·영웅 궁극기) · 테스트 봇 비상 스킬 + 헤드리스 테스트용 메타 정책(골드 수련·보석 소비·로드아웃)
import { WALL_Y, META_KEYS, metaCost, metaMax, SPELL_SLOTS, TRAIN_KEYS, trainCost, trainMax, COLLABS, FUSION_BY_KEY, FUSIONS, fusionParts } from './config.js';
import { act } from './sim.js';
import { unlockedClasses, autoEquipAll } from './hero.js';
import { buyMeta, buyTraining, startSlots } from './run.js';
import { TALENTS, TALENT_RECOMMEND, recommendNext, classNodes, canAllocate, allocateTalent, resetTalents } from './talents.js';

// 판타지 스킬 카드 선택 휴리스틱(자동 진행 · 헤드리스 봇 공용) — 융합을 노린다(두 재료를 모두 Lv6으로):
// 융합 완성(합체) > 협공이 켜지는 스킬 > 가진 융합 스킬 강화(카드 한 장당 가장 큰 화력 — Lv1 ×1.1~1.4 → Lv6 ×1.9~3.8)
// > 목표 짝(레벨 합이 가장 높은 짝) 강화 > 다른 짝 강화 > 보유 스킬 강화
// > 새 스킬(보유 스킬과 짝이 되는 것 · 공격 스킬 우선) > 각성
const NEW_VALUE = { fireball: 3, lightningStrike: 3, iceLance: 3, judgment: 3, babyDragon: 3, tornado: 2, curseMark: 2, flameBullet: 2,
  chainLightning: 2, gale: 2, frostWard: 1, holyLight: 1, soulHarvest: 1, stoneGolem: 1 };
// 아직 없는 융합 중 짝(두 재료 칸)이 모인 것들의 재료 → { 목표 짝(레벨 합 최고), 짝에 든 스킬 전부 }
function fusionPlan(g) {
  let target = [], bs = -1;
  const inPair = new Set();
  for (const f of FUSIONS) {
    if (g.spells[f.key] || !f.test(g.spells)) continue;
    const parts = fusionParts(f, g.spells), s = parts.reduce((a, k) => a + g.spells[k], 0);
    parts.forEach(k => inPair.add(k));
    if (s > bs) { bs = s; target = parts; }
  }
  return { target, inPair };
}
// 이 새 스킬을 넣으면 가진 스킬과 짝이 되는 융합이 있나(합체된 재료·이미 가진 융합은 빼고)
const pairsWith = (g, k) => FUSIONS.some(f => !g.spells[f.key] && f.groups.some(gr => gr.includes(k)) && f.test({ ...g.spells, [k]: 1 }));
export function pickCard(g, cards) {
  cards = cards || (g.pick && g.pick.cards) || [];
  const cls = g.hero && g.hero.cls;
  const collab = k => !!cls && COLLABS.some(c => c.cls === cls && !g.collabs.includes(c.key) && c.spells.includes(k));
  const { target, inPair } = fusionPlan(g);
  let idx = 0, best = -1;
  cards.forEach((c, i) => {
    const k = c.spell, owned = (g.spells[k] || 0) > 0;
    const score = c.awaken ? (c.awaken === 'power' ? 2 : 1)
      : (c.fusionHint ? 100 : 0) + (collab(k) ? 40 : 0)
        + (owned ? (target.includes(k) ? 30 + g.spells[k] : inPair.has(k) ? 18 : FUSION_BY_KEY[k] ? 35 : 12)
          : 8 + (NEW_VALUE[k] || 0) + (pairsWith(g, k) ? 6 : 0));
    if (score > best) { best = score; idx = i; }
  });
  return idx;
}

// ── 메타 정책(테스트·밸런스 러너용) ──
// 휴리스틱 가치(레벨이 오를수록 체감) ÷ 비용이 가장 좋은 것을 살 수 있는 만큼 산다
function buyBest(keys, lvOf, max, cost, value, wallet, buy) {
  const bought = [];
  for (;;) {
    let key = null, bestV = 0;
    for (const k of keys) {
      const lv = lvOf(k);
      if (lv >= max(k) || cost(k, lv) > wallet()) continue;
      const v = value(k, lv) / cost(k, lv);
      if (v > bestV) { bestV = v; key = k; }
    }
    if (!key || !buy(key)) return bought;
    bought.push(key);
  }
}

// 보석: 편의·구조 강화
function metaValue(k, lv) {
  switch (k) {
    case 'greed': return 3 * 0.05 / (1 + 0.05 * lv);
    case 'wisdom': return 2 * 0.1 / (1 + 0.1 * lv);
    case 'choice': return 1;
    case 'reroll': return 0.3;
    case 'startSlot': return 0.8;
    case 'revive': return 1.2;
    case 'critBoom': return 0.25 / (1 + 0.2 * lv);
    case 'awaken': return 1.5 / (1 + 0.15 * lv);
  }
  return 0.05; // pickaxe: 방치 보상만(남는 보석)
}
export function botSpendGems(meta) {
  return buyBest(META_KEYS, k => meta.metaLv[k] | 0, metaMax, metaCost, metaValue, () => meta.gems, k => buyMeta(meta, k));
}

// 골드: 마법사 수련(효과 ÷ 현재 배율)
function trainValue(k, lv) {
  switch (k) {
    case 'atk': return 0.04 / (1 + 0.04 * lv);
    case 'rate': return 0.025 / (1 + 0.02 * lv);
    case 'crit': return 0.015 * 1.5 / (1.075 + 0.0225 * lv);
    case 'multi': return 0.04 / (1 + 0.04 * lv);
    case 'wall': return 0.02 / (1 + 0.05 * lv);
  }
  return 0;
}
export function botSpendGold(meta) {
  return buyBest(TRAIN_KEYS, k => meta.training[k] | 0, trainMax, trainCost, trainValue, () => meta.gold, k => buyTraining(meta, k));
}

// 로드아웃: 지정 클래스(해금 안 됐으면 가장 최근 해금 클래스) + 선호 순서대로 뽑아 본 시작 스킬
const START_PREF = ['fireball', 'lightningStrike', 'babyDragon', 'judgment', 'curseMark', 'iceLance', 'tornado', 'chainLightning',
  'flameBullet', 'gale', 'soulHarvest', 'frostWard', 'holyLight', 'stoneGolem'];
export function botLoadout(meta, cls) {
  const classes = unlockedClasses(meta.best);
  return {
    cls: classes.includes(cls) ? cls : classes[classes.length - 1],
    startSpells: START_PREF.filter(k => meta.seenSpells.includes(k)).slice(0, Math.min(SPELL_SLOTS, startSlots(meta))),
  };
}

// ── 특성 배분 정책 ──
// 추천 빌드: talents.js TALENT_RECOMMEND — 주력 갈래 하나를 궁극 특성까지 마스터하고, 추천 혼합 노드, 나머지 두 갈래는 번갈아 절반씩
export const TALENT_BUILDS = Object.fromEntries(Object.entries(TALENT_RECOMMEND).map(([c, r]) => [c, r.order])); // [주력, 나머지…]
// 남은 포인트를 전부 배분. mode 'build' = 추천 빌드, 'random' = 찍을 수 있는 노드 중 무작위(동등성 테스트용, rng 필요)
// alloc = 한 랭크 찍기(기본: 게임 없이 직접. 도전 중엔 act 'talent'로 — 협공 갈래 조건·저장 이벤트까지)
export function botTalents(hero, cls, mode = 'build', rng = Math.random, alloc = k => allocateTalent(hero, cls, k)) {
  if (!TALENTS[cls]) return 0;
  let n = 0;
  for (;;) {
    let pick;
    if (mode === 'random') {
      const open = classNodes(cls).filter(nd => canAllocate(hero, cls, nd.key));
      pick = open.length ? open[Math.floor(rng() * open.length)] : null;
    } else pick = recommendNext(hero, cls);
    if (!pick || !alloc(pick.key)) return n;
    n++;
  }
}
// 무작위 빌드로 다시 찍기(초기화 후)
export function randomTalents(hero, cls, rng) {
  resetTalents(hero, cls);
  return botTalents(hero, cls, 'random', rng);
}

// 영웅 자동 처리(sim.step이 0.25초마다): 자동 특성(hero.autoTalent) · 자동 장착(hero.autoEquip)은 늘,
// 클래스 자동 선택 · 궁극기 자동 사용은 자동 진행 ON(players[0].auto)일 때만 — OFF면 궁극기는 버튼으로 직접
export function autoHero(g) {
  const hero = g.hero;
  if (!hero) return;
  const auto = g.players[0].auto;
  if (!hero.cls && auto) {
    const opts = unlockedClasses(g.best);
    if (opts.length) {
      act(g, 0, { type: 'heroClass', cls: opts[opts.length - 1] });
      act(g, 0, { type: 'autoEquip', on: true });
    }
  }
  if (hero.cls && hero.autoTalent) botTalents(hero, hero.cls, 'build', Math.random, key => act(g, 0, { type: 'talent', key })); // 레벨업으로 생긴 포인트
  if (hero.autoEquip) autoEquipAll(hero); // lootDrop도 즉시 장착하지만, 레벨업 등으로 스탯이 바뀐 뒤에도 재확인
  const h = g.heroUnit;
  if (auto && h && h.state !== 'down' && h.ultCd <= 0 && ultWorth(g, h)) act(g, 0, { type: 'heroUlt' });
}

// 궁극기를 쓸 만한가: 주변(반경 180)에 적이 있거나, 성직자는 성벽이 70% 아래
export function ultWorth(g, h) {
  if (g.hero.cls === 'cleric' && g.wall.hp < g.wall.max * 0.7) return true;
  return g.enemies.some(e => !e.dead && (e.x - h.x) ** 2 + (e.y - h.y) ** 2 < 180 * 180);
}

// 비상 스킬 자동 사용(kind 'bot' 마법사 — 헤드리스 테스트 러너가 플레이어의 운석·빙결 버튼 대신)
export function autoSkill(g, i) {
  const p = g.players[i];
  if (g.phase !== 'play') return;
  const ratio = g.wall.hp / g.wall.max;
  let near = 0, named = null, threat = false;
  for (const e of g.enemies) {
    if (e.dead) continue;
    if (e.y + e.r > WALL_Y - 220) near++;
    if (e.named) {
      named = e;
      if (e.state === 'warn' || (e.state === 'charge' && e.y > WALL_Y - 450) || e.y + e.r > WALL_Y - 200) threat = true;
    }
  }
  if (p.cd.freeze <= 0 && g.freezeT <= 0.5 && (threat || near >= 10 || (ratio < 0.45 && near >= 3))) {
    act(g, i, { type: 'skill', skill: 'freeze' });
  } else if (p.cd.meteor <= 0 && ((near >= 8 && ratio < 0.5) || (ratio < 0.45 && (near >= 3 || named)) || (named && threat && ratio < 0.7))) {
    act(g, i, { type: 'skill', skill: 'meteor' });
  }
}

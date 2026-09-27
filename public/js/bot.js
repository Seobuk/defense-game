// 자동 강화 / AI 동료 로직 + 헤드리스 테스트용 메타 정책(보석 소비·로드아웃)
import { UPGRADE_KEYS, upgradeCost, upgradeMax, cannonStats, wallMax, WALL_Y, META_KEYS, metaCost, metaMax, SPELL_SLOTS } from './config.js';
import { act } from './sim.js';
import { unlockedClasses, autoEquipAll } from './hero.js';
import { buyMeta, startSlots } from './run.js';

// 대포 1문의 기대 DPS 지표 (부채꼴 추가 탄은 일부만 맞는다고 가정)
function power(lv) {
  const s = cannonStats(lv);
  return s.dmg * s.rate * (1 + s.crit * (s.critMult - 1)) * (1 + (s.shots - 1) * 0.35);
}

// 슬롯별 취향: 오른쪽 대포(AI 동료)는 연사·치명·성벽 선호 → 두 대포 빌드가 자연히 갈라짐
const TASTE = [{}, { rate: 1.3, crit: 1.3, wall: 6 }];

// 골드당 효율이 가장 좋은 업그레이드를 살 수 있는 만큼 구매
export function autoUpgrade(g, i) {
  const p = g.players[i], taste = TASTE[i];
  // 위험도: 직전 스테이지/이번 스테이지 성벽 손실 비율
  const danger = Math.max(g.lastLoss, g.wall.max > 0 ? g.wallLost / g.wall.max : 0);
  const wallW = 0.02 + danger * 2.5;
  for (let n = 0; n < 60; n++) {
    const base = power(p.lv);
    const sum = g.players[0].lv.wall + g.players[1].lv.wall;
    let best = null, bestV = 0, aff = null, affV = 0;
    for (const k of UPGRADE_KEYS) {
      const lv = p.lv[k];
      if (lv >= upgradeMax(k)) continue;
      const cost = upgradeCost(k, lv);
      const gain = k === 'wall'
        ? (wallMax(sum + 1) / wallMax(sum) - 1) * wallW
        : power({ ...p.lv, [k]: lv + 1 }) / base - 1;
      const v = gain * (taste[k] ?? 1) / cost;
      if (v > bestV) { bestV = v; best = k; }
      if (cost <= p.gold && v > affV) { affV = v; aff = k; }
    }
    // 최선이 비싸면 모으되, 절반 이상 효율의 대안은 바로 산다
    const pick = best && upgradeCost(best, p.lv[best]) <= p.gold ? best : affV >= bestV * 0.5 ? aff : null;
    if (!pick || !act(g, i, { type: 'upgrade', stat: pick })) break;
  }
}

// 판타지 스킬 카드 선택 휴리스틱(자동 강화 · 헤드리스 봇 공용): 융합 완성 > 보유 스킬 강화 > 새 스킬(희귀도) > 각성
const RARITY_RANK = { common: 0, rare: 1, legend: 2 };
export function pickCard(g, cards) {
  cards = cards || (g.pick && g.pick.cards) || [];
  let idx = 0, best = -1;
  cards.forEach((c, i) => {
    const score = c.awaken ? (c.awaken === 'power' ? 2 : 1)
      : (c.fusionHint ? 100 : 0) + ((g.spells[c.spell] || 0) > 0 ? 10 : 8) + RARITY_RANK[c.rarity];
    if (score > best) { best = score; idx = i; }
  });
  return idx;
}

// ── 메타 정책(테스트·밸런스 러너용) ──
// 휴리스틱 가치(레벨이 오를수록 체감) ÷ 비용이 가장 좋은 영구 강화를 살 수 있는 만큼 산다
function metaValue(k, lv) {
  switch (k) {
    case 'power': return 10 * 0.06 / (1 + 0.06 * lv);
    case 'haste': return 8 * 0.03 / (1 + 0.03 * lv);
    case 'ward': return 3 * 0.08 / (1 + 0.08 * lv);
    case 'greed': return 7 * 0.05 / (1 + 0.05 * lv);
    case 'startGold': return 0.3 / (1 + 0.3 * lv);
    case 'wisdom': return 2 * 0.1 / (1 + 0.1 * lv);
    case 'choice': return 1;
    case 'reroll': return 0.3;
    case 'startSlot': return 0.8;
    case 'revive': return 1.2;
    case 'critBoom': return 0.25 / (1 + 0.2 * lv);
  }
  return 0; // pickaxe: 방치 보상만
}
export function botSpendGems(meta) {
  const bought = [];
  for (;;) {
    let key = null, bestV = 0;
    for (const k of META_KEYS) {
      const lv = meta.metaLv[k] | 0;
      if (lv >= metaMax(k) || metaCost(k, lv) > meta.gems) continue;
      const v = metaValue(k, lv) / metaCost(k, lv);
      if (v > bestV) { bestV = v; key = k; }
    }
    if (!key || !buyMeta(meta, key)) return bought;
    bought.push(key);
  }
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

// 영웅 자동 처리(자동 강화 on일 때만 호출): 클래스 없으면 해금된 것 중 하나 선택 + 자동 장착 on, 궁극기 사용
export function autoHero(g) {
  const hero = g.hero;
  if (!hero) return;
  if (!hero.cls) {
    const opts = unlockedClasses(g.best);
    if (opts.length) {
      act(g, 0, { type: 'heroClass', cls: opts[opts.length - 1] });
      act(g, 0, { type: 'autoEquip', on: true });
    }
  }
  if (hero.autoEquip) autoEquipAll(hero); // lootDrop도 즉시 장착하지만, 레벨업 등으로 스탯이 바뀐 뒤에도 재확인
  const h = g.heroUnit;
  if (h && h.state !== 'down' && h.ultCd <= 0) act(g, 0, { type: 'heroUlt' });
}

// 비상 스킬 자동 사용
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

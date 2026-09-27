// 영웅(클래스 필드 유닛) · 장비 — 순수 함수, DOM 없음 (sim.js가 호출)
// api = sim.js가 넘겨주는 { damage, killEnemy, damageWall, emit, chainArc, frontMost, spellHit, aimTarget, collabProc } (spells.js와 동일한 SPELL_API)
import { WALL_Y, WORLD_W, SOLO_MAGE, SPELL_BY_KEY, COLLAB_FX, collabOn, collabPow, FRONT_Y } from './config.js';
import { clamp } from './util.js';
import { talentBonus, TALENT_VER } from './talents.js';

// ── 클래스 5종 ──
export const HERO_CLASSES = {
  knight: {
    name: '기사', role: '근접 탱커 — 도발로 적을 붙잡는다', weapon: '검',
    base: { hp: 260, atk: 12, range: 48, atkSpd: 1.0, moveSpd: 95 },
    passive: '반경 120 안의 적은 성벽 대신 기사를 노린다(도발)',
    taunt: 120, melee: true, dps: 1.38,
    ult: { name: '성스러운 방패', cd: 26, dur: 3, r: 170 },
    ultDesc: '3초간 무적 + 주변 적 기절',
    unlock: () => true,
  },
  ranger: {
    name: '궁수', role: '원거리 속사 — 관통 화살', weapon: '활',
    base: { hp: 150, atk: 9, range: 400, atkSpd: 2.6, moveSpd: 115 },
    passive: '화살이 최대 2마리를 관통하고, 맞은 적을 살짝 밀어낸다',
    pierce: 2, push: 20, melee: false, dps: 0.95,
    ult: { name: '화살비', cd: 20, dur: 2.2, r: 170 },
    ultDesc: '전방 넓은 범위에 화살비',
    unlock: () => true,
  },
  sorcerer: {
    name: '마법사', role: '원거리 광역 마법', weapon: '지팡이',
    base: { hp: 150, atk: 11, range: 340, atkSpd: 0.9, moveSpd: 100 },
    passive: '공격이 착탄 지점 주변에도 피해를 준다',
    splash: 60, melee: false, dps: 0.88,
    ult: { name: '블리자드', cd: 30, dur: 4, r: 220 },
    ultDesc: '넓은 범위에 냉기 폭풍(큰 피해)',
    unlock: () => true,
  },
  cleric: {
    name: '성직자', role: '근접·신성 광역, 성벽·자신 회복', weapon: '철퇴',
    base: { hp: 220, atk: 10, range: 72, atkSpd: 1.1, moveSpd: 95 },
    passive: '공격할 때마다 성벽과 자신을 소량 회복, 언데드에 추가 피해',
    healOnHit: 0.006, undeadBonus: 1.5, melee: true, dps: 0.9,
    ult: { name: '천상의 치유', cd: 28, dur: 0, r: 260 },
    ultDesc: '성벽 대량 회복 + 주변 신성 폭발',
    unlock: best => best >= 20,
  },
  assassin: {
    name: '암살자', role: '순간이동 연속 베기, 보스 특화', weapon: '단검',
    base: { hp: 170, atk: 13, range: 56, atkSpd: 1.6, moveSpd: 130 },
    passive: '치명타 확률 +20%p, 보스 피해 +30%',
    critBonus: 0.2, bossBonus: 1.3, melee: true, dps: 0.95, blink: 1.6, // blink = 그림자 순간이동 쿨타임(초)
    ult: { name: '그림자 난무', cd: 24, dur: 1.6, n: 5 },
    ultDesc: '적 최대 5마리를 순식간에 베어넘긴다',
    unlock: best => best >= 40,
  },
};
export const HERO_CLASS_KEYS = Object.keys(HERO_CLASSES);
export const unlockedClasses = best => HERO_CLASS_KEYS.filter(k => HERO_CLASSES[k].unlock(best));
const UNDEAD_TYPES = ['skeleton', 'boneThrower', 'shieldSkel', 'lichLord'];

// ── 성장(티어 · 경험치 · 마일스톤) ──
const TIER_NAMES = ['견습', '숙련', '정예', '영웅', '전설'];
const TIER_LV = [1, 12, 28, 48, 72];
export const HERO_TIERS = TIER_NAMES.map((name, i) => ({ name, lv: TIER_LV[i] }));
export function heroTier(level) {
  let t = 0;
  for (let i = 0; i < TIER_LV.length; i++) if (level >= TIER_LV[i]) t = i;
  return t;
}
const CLASS_TITLE = {
  knight: ['견습 기사', '기사', '성기사', '영웅 기사', '전설의 성기사'],
  ranger: ['견습 궁수', '숙련 궁수', '정예 궁수', '영웅 궁수', '전설의 궁성'],
  sorcerer: ['견습 마법사', '마법사', '정예 마법사', '영웅 대마법사', '전설의 현자'],
  cleric: ['견습 성직자', '성직자', '정예 성직자', '영웅 성기사', '전설의 대주교'],
  assassin: ['견습 암살자', '암살자', '정예 암살자', '영웅 암살자', '전설의 그림자'],
};
export const heroTitle = (cls, level) => (CLASS_TITLE[cls] || CLASS_TITLE.knight)[heroTier(level)];

export const MAX_HERO_LV = 99;
// ponytail: 곡선은 로그라이트 밸런스 러너(누적 도전) 결과로 맞춤 — 수치 바꾸면 npm test로 재확인
export const xpToNext = level => Math.floor(100 * 1.06 ** (level - 1));
export const heroClearXp = (stage, firstClear) => Math.ceil((stage * 0.5 + 5) * (firstClear ? 2.4 : 1));
const XP_KILL = { normal: 0.4, elite: 3, named: 15 };
export const xpForKill = (e, stage) => (e.named ? XP_KILL.named : e.isBoss ? XP_KILL.elite : XP_KILL.normal * (e.share || 1)) * (1 + stage * 0.03);

export const MILESTONES = [
  { lv: 5, key: 'reroll1', desc: '도전마다 카드 새로고침 1회' },
  { lv: 8, key: 'skillUp1', desc: '클래스 스킬 강화' },
  { lv: 15, key: 'choose4', desc: '카드 4장 중 선택' },
  { lv: 20, key: 'skillUp2', desc: '클래스 스킬 강화' },
  { lv: 30, key: 'extraCard', desc: '도전 시작 시 카드 1장 추가' },
  { lv: 35, key: 'skillUp3', desc: '클래스 스킬 강화' },
  { lv: 50, key: 'legendBoost', desc: '전설 카드 확률 상승' },
];
export const hasMilestone = (level, key) => MILESTONES.some(m => m.key === key && level >= m.lv);
export const milestoneAt = level => MILESTONES.find(m => m.lv === level) || null;

// ── 장비 ──
export const SLOTS = ['weapon', 'helm', 'armor', 'trinket', 'cape'];
const SLOT_NAME = { weapon: '무기', helm: '머리', armor: '갑옷', trinket: '장신구', cape: '망토' };
const SLOT_MAIN_KEY = { weapon: 'atkPct', helm: 'heroHpPct', armor: 'dmgReducePct', trinket: 'critDmgPct', cape: 'atkSpeedPct' };
export const SLOT_NAMES = SLOT_NAME;

export const RARITIES = [
  { key: 'common', name: '일반', color: '#b7bdc6', mainMul: 1, subMul: 1, subN: [0, 1] },
  { key: 'uncommon', name: '고급', color: '#4ade80', mainMul: 1.15, subMul: 1.2, subN: [0, 2] },
  { key: 'rare', name: '희귀', color: '#60a5fa', mainMul: 1.35, subMul: 1.5, subN: [1, 2] },
  { key: 'epic', name: '영웅', color: '#c084fc', mainMul: 1.6, subMul: 2, subN: [2, 3] },
  { key: 'legend', name: '전설', color: '#fbbf24', mainMul: 1.9, subMul: 2.8, subN: [3, 3] },
];
export const RARITY_KEYS = RARITIES.map(r => r.key);
const RARITY_BY_KEY = Object.fromEntries(RARITIES.map(r => [r.key, r]));
const rarityRank = r => RARITY_KEYS.indexOf(r);

export const SUBSTATS = [
  { key: 'gold', name: '골드 획득', scope: 'global' },
  { key: 'boss', name: '보스 피해', scope: 'hero' },
  { key: 'mana', name: '마나 충전', scope: 'global' },
  { key: 'spell', name: '스킬 피해', scope: 'global' },
  { key: 'crit', name: '치명타 확률', scope: 'hero' },
  { key: 'heroHp', name: '체력', scope: 'hero' },
];
const SUB_KEYS = SUBSTATS.map(s => s.key);

export const BAG_SIZE = 30;

export function newHero() {
  return {
    cls: null, level: 1, xp: 0, autoEquip: true, // 자동 장착 기본 켬(주운 장비가 바로 영웅을 바꾼다 — 가방 토글로 끌 수 있다)
    talents: {},        // 클래스별 특성 배분 { [cls]: { [nodeKey]: rank } } — talents.js
    autoTalent: false,  // 자동 강화 on일 때 남는 특성 포인트를 추천 빌드로 자동 배분(bot.js)
    talentVer: TALENT_VER, talentNotice: false, // 특성 구조 버전 · 개편 환불 안내(정비 화면 1회, campAct 'talentNoticeSeen')
    equip: { weapon: null, helm: null, armor: null, trinket: null, cape: null },
    bag: [],
  };
}

// 등급별 드롭 가중치. boss = 확정 희귀 이상(일반/고급 가중치 0)
const DROP_WEIGHTS = {
  normal: [70, 22, 6, 1.8, 0.2],
  elite: [28, 30, 26, 13, 3],
  boss: [0, 0, 45, 40, 15],
  chest: [15, 26, 32, 20, 7],
};
function pickRarity(source, rng) {
  const w = Array.isArray(source) ? source : DROP_WEIGHTS[source] || DROP_WEIGHTS.normal; // 배열 = 직접 가중치(shop.js 장비 상자)
  let sum = 0;
  for (const x of w) sum += x;
  let x = rng() * sum;
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return RARITY_KEYS[i]; }
  return RARITY_KEYS[RARITY_KEYS.length - 1];
}

const MAIN_RANGE = { atkPct: [8, 16], heroHpPct: [10, 18], dmgReducePct: [4, 9], critDmgPct: [12, 22], atkSpeedPct: [6, 13] };
// gold/mana/spell은 전역 경제에 누적 복리로 영향을 주므로 낮게(hero/boss/crit/heroHp는 영웅 자신에게만 영향)
const SUB_RANGE = { gold: [1, 2.5], boss: [5, 10], mana: [1, 2.5], spell: [1, 2.5], crit: [2, 5], heroHp: [5, 10] };
const randIn = ([lo, hi], rng) => lo + rng() * (hi - lo);
const round1 = v => Math.round(v * 10) / 10;

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ELEMENT_PREFIX = ['용암', '서리', '천둥', '심연', '황금', '유령', '태양', '월광', '폭풍', '철혈'];
const CLASS_FLAVOR = {
  knight: ['수호자', '성기사', '철벽', '기사단장'],
  ranger: ['사냥꾼', '저격수', '추적자', '궁성'],
  sorcerer: ['현자', '비전학자', '원소술사', '마도사'],
  cleric: ['성자', '사제', '치유사', '대주교'],
  assassin: ['그림자', '밤의 칼날', '살수', '암살자'],
};
function itemName(cls, slot, rng) {
  const flavor = CLASS_FLAVOR[cls] || CLASS_FLAVOR.knight;
  const pre = ELEMENT_PREFIX[Math.floor(rng() * ELEMENT_PREFIX.length)];
  const who = flavor[Math.floor(rng() * flavor.length)];
  const noun = slot === 'weapon' ? (HERO_CLASSES[cls] || HERO_CLASSES.knight).weapon : SLOT_NAME[slot];
  return `${pre} ${who}의 ${noun}`;
}

// stage(=ilvl), source: 'normal'|'elite'|'boss'|'chest' | 등급 가중치 배열(장비 상자)
export function rollItem(stage, source, rng, cls) {
  const ilvl = clamp(Math.floor(stage) || 1, 1, 100);
  const rarity = pickRarity(source, rng);
  const R = RARITY_BY_KEY[rarity];
  const slot = SLOTS[Math.floor(rng() * SLOTS.length)];
  const scale = 1 + (ilvl - 1) * 0.008; // ponytail: 완만하게 — 아이템 운이 밸런스를 크게 흔들지 않게

  const mainKey = SLOT_MAIN_KEY[slot];
  const main = { key: mainKey, value: round1(randIn(MAIN_RANGE[mainKey], rng) * R.mainMul * scale) };
  const [subLo, subHi] = R.subN;
  const subCount = subLo + Math.floor(rng() * (subHi - subLo + 1));
  const subs = shuffled(SUB_KEYS, rng).slice(0, subCount)
    .map(k => ({ key: k, value: round1(randIn(SUB_RANGE[k], rng) * R.subMul * scale) }));
  return { id: rng().toString(36).slice(2, 10) + rng().toString(36).slice(2, 6), slot, rarity, ilvl, name: itemName(cls, slot, rng), main, subs };
}

const MAIN_POWER_W = { atkPct: 3.5, heroHpPct: 2.5, dmgReducePct: 5, critDmgPct: 3, atkSpeedPct: 3.5 };
export function itemPower(item) {
  if (!item) return 0;
  let p = item.main.value * (MAIN_POWER_W[item.main.key] || 3);
  for (const s of item.subs) p += s.value * 2;
  return Math.round(p * (1 + item.ilvl * 0.01));
}

export function heroPower(hero) {
  if (!hero || !hero.cls) return 0;
  let p = hero.level * 12;
  for (const slot of SLOTS) p += itemPower(hero.equip[slot]);
  return Math.round(p);
}

const SELL_MUL = { common: 1, uncommon: 1.6, rare: 2.6, epic: 4.2, legend: 7 };
// 판매 골드(영구 재화 — 마법사 수련에 쓴다)
export function sellValue(item) {
  if (!item) return 0;
  return Math.ceil(itemPower(item) * 0.06 * (SELL_MUL[item.rarity] || 1) * (1 + item.ilvl / 25)); // 층 비례(4차 경제): 장비 상자 값의 ~5~12%라 되팔아 이득은 없다
}

// 가방(30칸). 초과 시 가장 낮은 등급(동급이면 가장 낮은 전투력)을 자동 판매하고 그 아이템을 반환
export function addToBag(hero, item) {
  hero.bag.push(item);
  return trimBag(hero);
}
// 가방이 넘치면 가장 약한 장비(낮은 등급 → 낮은 전투력) 하나를 빼서 돌려준다(팔 것). export: shop.js 상자 = 자동 장착 뒤에 정리
export function trimBag(hero) {
  if (hero.bag.length <= BAG_SIZE) return null;
  let worst = 0;
  for (let i = 1; i < hero.bag.length; i++) {
    const a = hero.bag[i], b = hero.bag[worst];
    if (rarityRank(a.rarity) < rarityRank(b.rarity) || (rarityRank(a.rarity) === rarityRank(b.rarity) && itemPower(a) < itemPower(b))) worst = i;
  }
  return hero.bag.splice(worst, 1)[0];
}

export function equipItem(hero, itemId) {
  const idx = hero.bag.findIndex(it => it.id === itemId);
  if (idx < 0) return false;
  const item = hero.bag.splice(idx, 1)[0];
  const old = hero.equip[item.slot];
  hero.equip[item.slot] = item;
  if (old) hero.bag.push(old);
  return true;
}

export function sellItem(hero, itemId) {
  const idx = hero.bag.findIndex(it => it.id === itemId);
  if (idx < 0) return null;
  return sellValue(hero.bag.splice(idx, 1)[0]);
}

export function sellItemsByRarity(hero, rarity) {
  let total = 0;
  hero.bag = hero.bag.filter(it => {
    if (it.rarity !== rarity) return true;
    total += sellValue(it);
    return false;
  });
  return total;
}

// 전투력이 더 높은 가방 아이템으로 자동 교체(부위별). 밀려난 장비는 가방으로
export function autoEquipAll(hero) {
  let changed = false;
  for (const slot of SLOTS) {
    let bestIdx = -1, bestP = itemPower(hero.equip[slot]);
    hero.bag.forEach((it, i) => { if (it.slot === slot && itemPower(it) > bestP) { bestP = itemPower(it); bestIdx = i; } });
    if (bestIdx < 0) continue;
    const item = hero.bag.splice(bestIdx, 1)[0];
    const old = hero.equip[slot];
    hero.equip[slot] = item;
    if (old) hero.bag.push(old);
    changed = true;
  }
  return changed;
}

// 장비 합산(부위 주스탯 + 부옵션). scope 구분 없이 키별로 합산 — 사용은 heroCombatStats/heroBonuses가 나눠서 한다
// 장착 장비가 그대로면 캐시(스킬 틱·처치마다 불려서) — 반환값은 읽기 전용
const GEAR_CACHE = new WeakMap();
export function gearBonuses(hero) {
  const b = { atkPct: 0, heroHpPct: 0, dmgReducePct: 0, critDmgPct: 0, atkSpeedPct: 0, gold: 0, boss: 0, mana: 0, spell: 0, crit: 0, heroHp: 0 };
  if (!hero) return b;
  const e = hero.equip, sig = [e.weapon, e.helm, e.armor, e.trinket, e.cape];
  const c = GEAR_CACHE.get(hero);
  if (c && c.equip === e && c.sig.every((it, i) => it === sig[i])) return c.b;
  GEAR_CACHE.set(hero, { equip: e, sig, b });
  for (const slot of SLOTS) {
    const it = hero.equip[slot];
    if (!it) continue;
    b[it.main.key] += it.main.value;
    for (const s of it.subs) b[s.key] += s.value;
  }
  return b;
}

// 대포·경제에 적용되는 소소한 전역 보너스(골드%, 마나 충전%, 스킬 피해%)
export function heroBonuses(hero) {
  const g = gearBonuses(hero);
  return { goldMul: 1 + g.gold / 100, manaMul: 1 + g.mana / 100, spellMul: 1 + g.spell / 100 };
}

// ── 영웅 전투 스탯 ──
// 피해 기준 = P1 성벽 마법사의 마력(층 공명 × 수련 × 각성) × 치명타 기대값 × (기본 + 스킬 레벨 합). 마법사가 스킬로 강해지는 만큼
// 영웅도 같은 비중을 유지한다. 영웅 DPS = 기준 × HERO_K × 클래스 배율(dps) × 레벨 배율 × (장비·특성). 특성을 다 찍으면 전체 화력의 25~40%(test/sim.test.js)
export const HERO_K = 0.17;
const REF0 = 3, REF1 = 0.6; // 기준 = 마력 × (REF0 + REF1 × 스킬 레벨 합)
export function mageRef(g) {
  const s = g.players[0] && g.players[0].stats;
  if (!s) return 10;
  let lv = 0;
  for (const v of Object.values(g.book || {})) lv += v;
  for (const k of g.fusions || []) lv += g.spells[k]; // 융합 스킬은 재료 둘 + 전용 시전
  return s.dmg * (1 + s.crit * (s.critMult - 1)) * (REF0 + REF1 * lv);
}
const buffMul = g => (g.heroBuff ? g.heroBuff.mul : 1);

export function heroCombatStats(g, hero, tb = talentBonus(hero, hero.cls)) {
  const cls = HERO_CLASSES[hero.cls] || HERO_CLASSES.knight;
  const gear = gearBonuses(hero);
  const lvl = hero.level;
  const skillUp = (hasMilestone(lvl, 'skillUp1') ? 0.1 : 0) + (hasMilestone(lvl, 'skillUp2') ? 0.1 : 0) + (hasMilestone(lvl, 'skillUp3') ? 0.15 : 0);
  const lvMul = 0.7 + 0.008 * lvl + skillUp;
  // 체력 = 성벽 최대체력의 일부 × 클래스 기본 체력(기사 260 ~ 궁수 150). 근접 클래스가 몇 초는 버티며 적을 붙잡을 수 있게
  const hpFrac = (0.05 + 0.003 * lvl) * (cls.base.hp / 200) * (1 + gear.heroHpPct / 100 + gear.heroHp / 100 + tb.hp);
  const dps = mageRef(g) * HERO_K * cls.dps * lvMul * (1 + gear.atkPct / 250 + tb.atk) * buffMul(g);
  return {
    dmg: dps / cls.base.atkSpd, // 1타 피해(공격 속도 보너스는 atkSpd로 따로)
    maxHp: Math.max(60, Math.round((g.wall ? g.wall.max : 200) * hpFrac)),
    range: cls.base.range * (1 + tb.range + tb.longshot / 2), // 바람 사수(혼합)
    atkSpd: cls.base.atkSpd * (1 + gear.atkSpeedPct / 100 + tb.aspd + (g.collabs && collabOn(g, 'galeArrow') ? COLLAB_FX.galeArrow * collabPow(g) : 0)), // 질풍 화살
    moveSpd: cls.base.moveSpd * (1 + tb.move),
    critChance: clamp(0.05 + (cls.critBonus || 0) + gear.crit / 100 + tb.crit, 0, 0.9),
    critMult: 1.5 + gear.critDmgPct / 100 + tb.critDmg,
    bossMul: 1 + (cls.bossBonus ? cls.bossBonus - 1 : 0) + gear.boss / 100 + tb.boss,
    dmgReduce: clamp(gear.dmgReducePct / 100 + tb.dr + tb.hold, 0, 0.85), // 진지 사수: 피해 감소 + 도발 반경(아래)
    melee: !!cls.melee,
    // 적이 성벽 대신 영웅을 노리는 반경: 기사 도발(+특성), 다른 근접은 접촉, 원거리는 바짝 붙었을 때만
    engageR: cls.melee ? (cls.taunt || 50) + tb.taunt + tb.hold * 200 : 44,
  };
}

// ── 필드 유닛 ──
// 영웅 성문: 성벽 중앙의 솔로 마법사(SOLO_MAGE 360) 오른쪽 옆 — 층 시작·부활 때 영웅이 마법사를 가리지 않게.
// ponytail: 협동 모드가 돌아오면 두 마법사 사이((CANNONS[0].x + CANNONS[1].x) / 2)로
export const HERO_GATE = { x: SOLO_MAGE.x + 130, y: WALL_Y - 30 };
export const HERO_RALLY = { x: WORLD_W / 2, y: 520 }; // 적이 없을 때 모이는 전장 중앙
export const HERO_MELEE_R = 26; // 도발 근접 판정 여유 반경(sim.js의 walk()도 이 값을 쓴다)
export const ROAM_TOP = FRONT_Y;  // 전선 위 접근로(y < ROAM_TOP)의 적은 쫓지 않는다 — 영웅은 전장 가운데가 전선
const RETREAT_HP = 0.3, RETURN_HP = 0.8;  // 30% 아래 후퇴 → 80% 회복 후 재진격
const REGEN = { rest: 0.03, retreat: 0.04, wall: 0.14 }; // 초당 최대 체력 비율: 비전투 / 후퇴 중 / 성벽 곁
const RETARGET_T = 0.25;
const WALK = 0.45; // 걷기 속도 = 이동 속도 × WALK (집결·배회)
const HOLD_Y = WALL_Y - 240; // 진지 사수(특성 hold): 이 선 위로 나가지 않는다
const SPLIT_K = 0.3;          // 분열 화염(특성 split) 갈래 피해 배율 — talents.js 문구와 같이

export function spawnHeroUnit(hero) {
  return {
    cls: hero.cls, x: HERO_GATE.x, y: HERO_GATE.y, hp: -1, maxHp: 1,
    // 렌더러용 이동·공격 상태
    state: 'walk',            // 'walk'|'attack'|'idle'|'down' (기존 호환)
    mode: 'rally',            // 'engage'(근접 돌진) | 'kite'(원거리 거리 유지) | 'rally'(집결·두리번) | 'retreat' | 'move'(탭 이동)
    gait: 'walk',             // 'idle'|'walk'|'run'
    speed: 0, dir: -Math.PI / 2, vx: 0, vy: 0, facing: 1,
    atkT: 0, windup: 0, atkN: 0, tgt: null, fightE: null, // fightE = 지금 실제로 치고 있는 적(성벽 마법사 지원 사격이 노린다)
    ultCd: 0, ultT: 0, invulnT: 0, blinkT: 0, ambushT: 0,
    moveTo: null, respawnT: 0,
    level: hero.level, tier: heroTier(hero.level),
    engageR: 0, tb: talentBonus(hero, hero.cls), tbT: 0.5, st: null, stT: 0,
    procT: { shieldToss: 2, pillar: 2.5, pull: 3 }, lookT: 0, wander: null, retargetT: 0, tgtE: null,
  };
}

// 이동: 도착하면 true. 속도·방향·바라보는 쪽을 렌더러용으로 갱신
function go(h, x, y, spd, dt) {
  const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const s = Math.min(d, spd * dt);
  const nx = clamp(h.x + dx / d * s, 20, WORLD_W - 20), ny = clamp(h.y + dy / d * s, ROAM_TOP - 40, WALL_Y - 10);
  h.vx = (nx - h.x) / dt; h.vy = (ny - h.y) / dt;
  h.x = nx; h.y = ny;
  h.speed = Math.hypot(h.vx, h.vy);
  if (h.speed > 1) h.dir = Math.atan2(h.vy, h.vx);
  if (Math.abs(dx) > 2) h.facing = dx >= 0 ? 1 : -1;
  return s >= d;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const alive = e => !e.dead && e.y >= ROAM_TOP;

// 가장 위험한 적: 성벽에 가까울수록 · 밀집할수록 · 보스일수록, 영웅에게서 멀수록 감점(현재 표적은 약간 가산해 흔들림 방지)
// ponytail: O(n²) 밀집도 — 0.25초마다라 적 100마리까지 문제없음. 더 많아지면 격자 버킷으로
// 특성 택1(표적)이 점수를 바꾼다: 보스 우선 · 성벽 앞 우선 · 약한 적 우선 · 표적 고정, 진지 사수는 선 밖 적을 무시
function pickTarget(g, h) {
  let best = null, bs = -Infinity;
  const es = g.enemies, tb = h.tb;
  for (const e of es) {
    if (!alive(e) || (tb.hold && e.y < HOLD_Y - 40)) continue;
    let n = 0;
    for (const q of es) if (!q.dead && (q.x - e.x) ** 2 + (q.y - e.y) ** 2 < 10000) n++;
    let s = 3 * e.y / WALL_Y + 0.3 * Math.min(n, 8) + (e.isBoss ? 1.2 : 0) - dist(e, h) / 350 + (e === h.tgtE ? 0.5 : 0);
    if (tb.hunt && e.isBoss) s += 3;
    if (tb.guardWall) s += 3 * e.y / WALL_Y;
    if (tb.cull) s += 2.5 * (1 - e.hp / e.maxHp);
    if (tb.focus && e === h.tgtE) s += 2;
    if (s > bs) { bs = s; best = e; }
  }
  return best;
}
function densest(g) {
  let best = null, bn = 0;
  for (const e of g.enemies) {
    if (!alive(e)) continue;
    let n = 0;
    for (const q of g.enemies) if (!q.dead && (q.x - e.x) ** 2 + (q.y - e.y) ** 2 < 12100) n++;
    if (n > bn) { bn = n; best = e; }
  }
  return best;
}
const wallMost = g => { let b = null; for (const e of g.enemies) if (alive(e) && (!b || e.y > b.y)) b = e; return b; }; // 성벽에 가장 가까운 적
function nearestTo(g, x, y, maxD, skip) {
  let best = null, bd = maxD * maxD;
  for (const e of g.enemies) {
    if (e.dead || e === skip || skip?.includes?.(e)) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}
const inRange = (h, e, r) => e && !e.dead && dist(h, e) <= r + e.r;

// 영웅 피해 = damage() 반환값을 그대로 hit 이벤트로(o:2 — 소환물 피해도 영웅 몫)
function heroHit(g, api, e, dmg, crit, kind) {
  if (e.dead) return 0;
  const tb = g.heroUnit ? g.heroUnit.tb : null;
  if (tb) { // 특성: 부식·신경독 / 무리 사냥 / 과열 / 산산조각
    if (e.poisonT > 0) dmg *= 1 + tb.poisonAmp;
    if (tb.packHunt && e.huntAt > g.phaseT) dmg *= 1 + tb.packHunt;
    if (tb.overheat && e.burnT > 0) dmg *= 1 + tb.overheat;
    if (tb.shatter && (e.slowT > 0 || e.stunT > 0 || e.frozen)) dmg *= 1 + tb.shatter;
  }
  const dealt = api.damage(g, e, dmg, 2);
  api.emit(g, { type: 'hit', x: e.x, y: e.y, dmg: dealt, o: 2, crit, big: crit, kind: kind || 'hero' });
  return dealt;
}
const aoe = (g, api, x, y, r, dmg, kind, skip) => {
  for (const e of g.enemies) if (e !== skip && !e.dead && (e.x - x) ** 2 + (e.y - y) ** 2 <= (r + e.r) ** 2) heroHit(g, api, e, dmg, false, kind);
};

// 기본 공격 1회: 클래스 패시브 + 특성 효과 + 궁극 특성(동작 변화)
function performAttack(g, hero, h, cls, st, target, api) {
  const tb = h.tb, cap = tb.cap;
  h.atkN++;
  const rng = g.heroRng;
  const undead = UNDEAD_TYPES.includes(target.type);
  // 협공(영웅 × 마법사 스킬) — config.js COLLABS
  const pow = collabPow(g), on = k => collabOn(g, k);
  const thunder = on('thunderArrow'), frostShot = on('frostShot'), gale = on('galeArrow'), purge = on('purgeFlame'), shadowExec = on('shadowExec');
  const mul = e => {
    let m = 1 + tb.holy * (UNDEAD_TYPES.includes(e.type) ? 2 : 1);
    if (e.isBoss) m *= st.bossMul;
    if (UNDEAD_TYPES.includes(e.type)) m *= cls.undeadBonus || 1;
    if (purge && e.burnT > 0) m *= 1 + COLLAB_FX.purgeAmp * pow;                                  // 정화의 불꽃
    if (shadowExec && e.isBoss && e.hp < e.maxHp * 0.3) m *= 1 + COLLAB_FX.shadowBoss * pow;       // 그림자 처형
    // 특성 택1: 보스 우선 · 약한 적 우선 · 성벽 앞 우선 · 근접 속사 · 바람 사수(먼 적일수록)
    if (tb.hunt && e.isBoss) m *= 1 + tb.hunt;
    if (tb.cull && e.hp < e.maxHp * 0.5) m *= 1 + tb.cull;
    if (tb.guardWall && e.y > WALL_Y - 200) m *= 1 + tb.guardWall;
    if (tb.pointBlank && dist(h, e) < 200 + e.r) m *= 1 + tb.pointBlank;
    if (tb.longshot) m *= 1 + tb.longshot * Math.min(1, dist(h, e) / st.range);
    return m;
  };
  const chill = e => e.slowT > 0 || e.frozen || e.stunT > 0;
  const crit = rng() < st.critChance || (tb.firstCrit > 0 && target.id !== h.lastTgt); // 조준 사격: 새 표적 첫 발은 치명타
  h.lastTgt = target.id;
  let dmg = st.dmg * (crit ? st.critMult : 1);
  if (h.ambushT > 0) { dmg *= 1 + tb.ambush; h.ambushT = 0; }
  if (h.momentum) { dmg *= 1 + tb.momentum; h.momentum = false; } // 연쇄 처형
  if (tb.frenzy) { h.frenzyN = Math.min(10, (h.frenzyN | 0) + 1); h.frenzyAt = g.phaseT; } // 연사 가속(공격 간격은 updateHeroUnit)
  // 특성 택1: 한 놈 집중(같은 표적 중첩) · 3타 강타 · 위기에 강함 · 때리면 궁극기 · 생명 흡수
  if (tb.focus) { h.focusN = target === h.focusE ? Math.min(5, (h.focusN | 0) + 1) : 0; h.focusE = target; dmg *= 1 + tb.focus * h.focusN; }
  const heavy = tb.heavy > 0 && h.atkN % 3 === 0;
  if (heavy) dmg *= 1 + tb.heavy;
  if (tb.berserk && h.hp < h.maxHp * 0.5) dmg *= 1 + tb.berserk;
  if (tb.ultCharge && h.ultCd > 0) h.ultCd = Math.max(0, h.ultCd - tb.ultCharge);
  if (tb.lifesteal) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * tb.lifesteal);
  api.emit(g, { type: 'heroAttack', x: h.x, y: h.y, tx: target.x, ty: target.y, cls: hero.cls, crit, n: h.atkN });

  // 궁수: 3연사(화살 폭풍) · 다중 화살 · 관통
  const shots = cap.arrowStorm ? 3 : 1, shotMul = cap.arrowStorm ? 0.45 : 1;
  for (let s = 0; s < shots; s++) {
    const t = target.dead ? nearestTo(g, h.x, h.y, st.range + 40) : target;
    if (!t) break;
    shoot(t, dmg * shotMul * mul(t), crit);
  }
  if (tb.multi && rng() < tb.multi) {
    const t2 = nearestTo(g, target.x, target.y, 200, target);
    if (t2) shoot(t2, dmg * mul(t2), false);
  }
  if (cap.arrowStorm) api.emit(g, { type: 'heroProc', kind: 'arrowStorm', x: h.x, y: h.y, tx: target.x, ty: target.y });
  if (heavy) { // 3타 강타: 표적 0.5초 기절(네임드 제외)
    if (!target.dead && !target.named) target.stunT = Math.max(target.stunT || 0, 0.5);
    api.emit(g, { type: 'heroProc', kind: 'nova', sub: 'heavy', col: '#ffb03a', x: target.x, y: target.y, r: 46 });
  }
  function shoot(t, d, c) {
    if (frostShot && !c && chill(t)) { d *= st.critMult; c = true; api.collabProc(g, 'frostShot', t.x, t.y); } // 빙결 사격: 차가운 적에게 치명타
    heroHit(g, api, t, d, c);
    if (tb.mark) t.markAt = g.phaseT + 3; // 표식(주 표적만): 3초간 마법사 주문 피해 +(sim.js spellHit)
    onHitFx(t, d);
    if (cls.push && !t.dead && !t.isBoss) t.y = Math.max(Math.min(t.y, FRONT_Y), t.y - cls.push); // 궁수: 밀어내기(전선 위로는 안 밀림)
    if (gale) api.collabProc(g, 'galeArrow', t.x, t.y);
    if (frostShot && !t.dead) t.slowT = Math.max(t.slowT, 1.2);
    if (thunder) { // 뇌전 화살: 성벽 마법사의 번개가 화살을 타고 튄다(마법사 스킬 피해로 집계)
      const prev = g._skill;
      g._skill = true;
      api.chainArc(g, t, d * COLLAB_FX.thunderArrow * pow, 0, 2);
      g._skill = prev;
      api.collabProc(g, 'thunderArrow', t.x, t.y);
    }
    const pierce = (cls.pierce || 0) + (gale ? 1 : 0);
    let n = 0;
    for (const e of g.enemies) {
      if (n >= pierce || e === t || e.dead) continue;
      if (Math.hypot(e.x - t.x, e.y - t.y) <= 50) { heroHit(g, api, e, d, c); n++; }
    }
    if (tb.cleave) aoe(g, api, t.x, t.y, 60, d * tb.cleave, 'hero', t); // 휩쓸기 · 착탄 폭발
    // 도탄 · 비전 연쇄: 표적에서 근처 적으로 랭크당 1번 튄다(30%)
    for (let k = 0, from = t, used = [t]; k < tb.bounce; k++) {
      const b = nearestTo(g, from.x, from.y, 160, used);
      if (!b) break;
      used.push(b);
      api.emit(g, { type: 'heroProc', kind: 'bolt', cls: hero.cls, x: from.x, y: from.y, tx: b.x, ty: b.y });
      heroHit(g, api, b, d * 0.3, false);
      from = b;
    }
  }
  // 화상·둔화·빙결·독 (특성)
  function onHitFx(e, d) {
    if (e.dead) return;
    if (tb.burn) { e.burn += d * tb.burn; e.burnT = Math.max(e.burnT, 2); e.burnO = 2; }
    if (tb.slow && rng() < tb.slow) e.slowT = Math.max(e.slowT, 1.5);
    if (tb.freeze && !e.named && rng() < tb.freeze) e.stunT = Math.max(e.stunT || 0, 0.8);
    if (tb.poison) { e.poison = (e.poison || 0) + d * tb.poison * (cap.plague ? 2 : 1); e.poisonT = 4; }
    if (tb.neuro && e.poisonT > 0) e.slowT = Math.max(e.slowT, 1.5); // 신경독
    if (purge) { e.burn += d * COLLAB_FX.purgeBurn * pow; e.burnT = Math.max(e.burnT, 2); e.burnO = 2; api.collabProc(g, 'purgeFlame', e.x, e.y); }
    const exe = tb.execute + (shadowExec ? COLLAB_FX.shadowExec * pow : 0);
    if (exe && !e.isBoss && e.hp > 0 && e.hp <= e.maxHp * exe) {
      api.damage(g, e, e.hp + e.shield, 2);
      api.emit(g, { type: 'heroProc', kind: 'execute', x: e.x, y: e.y });
      if (shadowExec) api.collabProc(g, 'shadowExec', e.x, e.y);
    }
  }

  // 마법사 광역 / 작은 운석 — c = 착탄 표적, k = 피해 배율(분열 화염 갈래 0.5)
  const blast = (c, k) => {
    const r = (cap.meteor ? 100 : cls.splash) * (1 + tb.splash);
    const m = (cap.meteor ? 1.4 : 1) * k;
    if (cap.meteor) api.emit(g, { type: 'heroProc', kind: 'meteor', x: c.x, y: c.y, r });
    for (const e of g.enemies) {
      if (e === c || e.dead) continue;
      if (Math.hypot(e.x - c.x, e.y - c.y) <= r + e.r) {
        heroHit(g, api, e, dmg * 0.6 * m * mul(e), false);
        if (cap.meteor && !e.dead) { e.burn += dmg * 0.3 * k; e.burnT = Math.max(e.burnT, 2); e.burnO = 2; }
        if (on('frostEcho') && !e.dead) e.slowT = Math.max(e.slowT, 1.5); // 서리 메아리: 광역도 둔화
      }
    }
    if (cap.meteor && !c.dead) heroHit(g, api, c, dmg * 0.4 * k * mul(c), false);
  };
  if (cls.splash || cap.meteor) blast(target, 1);
  // 분열 화염: 근처 적에게 랭크당 1갈래 더(SPLIT_K 피해, 광역 포함)
  for (let k = 0, used = [target]; k < tb.split; k++) {
    const t = nearestTo(g, target.x, target.y, 200, used);
    if (!t) break;
    used.push(t);
    api.emit(g, { type: 'heroProc', kind: 'bolt', cls: hero.cls, x: h.x, y: h.y, tx: t.x, ty: t.y });
    heroHit(g, api, t, dmg * SPLIT_K * mul(t), crit);
    onHitFx(t, dmg * SPLIT_K);
    if (cls.splash || cap.meteor) blast(t, SPLIT_K);
  }
  if (on('frostEcho') && !target.dead) target.slowT = Math.max(target.slowT, 1.5);
  // 쌍화염: 영웅의 공격마다 착탄 지점에 성벽 마법사(P1)의 파이어볼 폭발
  if (on('twinFlame')) {
    const lv = Math.max(g.book.fireball || 0, g.book.flameBullet || 0, 1), p = SPELL_BY_KEY.fireball.lv[lv - 1];
    const fd = g.players[0].stats.dmg * p.mul * COLLAB_FX.twinFlame * pow, x = target.x, y = target.y;
    for (const e of g.enemies) if (!e.dead && (e.x - x) ** 2 + (e.y - y) ** 2 <= (p.r + e.r) ** 2) api.spellHit(g, e, fd, 0, 'fire', true);
    api.emit(g, { type: 'spell', key: 'fireball', o: 0, x, y, r: p.r, collab: 'twinFlame' });
    api.collabProc(g, 'twinFlame', x, y);
  }
  // 성직자: 공격마다 성벽·자신 회복 + 신성 폭발
  if (cls.healOnHit) {
    const k = cls.healOnHit * (1 + tb.heal) * (tb.emergency && g.wall.hp < g.wall.max * 0.5 ? 2 : 1); // 긴급 치유
    g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * k);
    h.hp = Math.min(h.maxHp, h.hp + h.maxHp * k);
    const gl = g.spellFx && g.spellFx.golem;
    if (on('sanctuary') && gl && gl.hp < gl.maxHp) { // 수호 성벽: 골렘도 치유
      gl.hp = Math.min(gl.maxHp, gl.hp + gl.maxHp * k * 2 * pow);
      api.collabProc(g, 'sanctuary', gl.x, gl.y);
    }
  }
  if (tb.smite) aoe(g, api, h.x, h.y, 70, dmg * tb.smite, 'holy', target);
  // 핵심 노드: 신성 연격(치명타 폭발) · 천벌 연타(4타마다)
  if (tb.critBurst && crit) {
    aoe(g, api, target.x, target.y, 80, dmg * tb.critBurst, 'holy', target);
    api.emit(g, { type: 'heroProc', kind: 'nova', sub: 'critBurst', x: target.x, y: target.y, r: 80 });
  }
  if (tb.holyNova && h.atkN % 4 === 0) {
    aoe(g, api, target.x, target.y, 100, dmg * tb.holyNova, 'holy');
    api.emit(g, { type: 'heroProc', kind: 'nova', sub: 'holyNova', x: target.x, y: target.y, r: 100 });
  }
  // 궁극 특성(N타마다)
  if (cap.judgeBolt && h.atkN % 3 === 0) {
    aoe(g, api, target.x, target.y, 90, dmg * 2 * (undead ? 1.5 : 1), 'holy');
    api.emit(g, { type: 'heroProc', kind: 'judgeBolt', x: target.x, y: target.y, r: 90 });
  }
  if (cap.snipe && h.atkN % 4 === 0) snipe(g, api, h, target, dmg * 3);
  if (cap.scythe && h.atkN % 5 === 0) {
    for (const e of g.enemies) {
      if (e.dead || Math.hypot(e.x - h.x, e.y - h.y) > 130 + e.r) continue;
      if (!e.isBoss && e.hp <= e.maxHp * 0.1) api.damage(g, e, e.hp + e.shield, 2);
      else heroHit(g, api, e, dmg * 2.5 * mul(e), false, 'dark');
    }
    api.emit(g, { type: 'heroProc', kind: 'scythe', x: h.x, y: h.y, r: 130 });
  }
  // 비전 분신: 영웅의 공격을 따라 한다
  for (const s of g.summons) {
    if (s.kind !== 'arcane') continue;
    const t = nearestTo(g, s.x, s.y, st.range + 60) || target;
    if (t.dead) continue;
    heroHit(g, api, t, dmg * 0.6 * mul(t), false, 'arcane');
    s.state = 'attack'; s.windup = 1; s.facing = t.x >= s.x ? 1 : -1;
    api.emit(g, { type: 'summonAttack', id: s.id, kind: s.kind, x: s.x, y: s.y, tx: t.x, ty: t.y });
  }
}

// 관통 저격: 영웅 → 표적 방향으로 화면 끝까지 직선
function snipe(g, api, h, target, dmg) {
  const dx = target.x - h.x, dy = target.y - h.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
  for (const e of g.enemies) {
    if (e.dead) continue;
    const px = e.x - h.x, py = e.y - h.y, along = px * ux + py * uy;
    if (along > 0 && Math.abs(px * uy - py * ux) <= 22 + e.r) heroHit(g, api, e, dmg * (e.isBoss ? 1.3 : 1), true, 'snipe');
  }
  api.emit(g, { type: 'heroProc', kind: 'snipe', x: h.x, y: h.y, tx: h.x + ux * 1400, ty: h.y + uy * 1400 });
}

// 주기형 궁극 특성: 튕기는 방패(4초) · 천벌 기둥(5초)
function updateProcs(g, h, st, api, dt) {
  const tb = h.tb, cap = tb.cap, pt = h.procT;
  // 사슬 도발 · 서리 사슬 · 축성의 사슬(특성 pull): 6초마다 표적 주변 200 안 적을 표적 쪽으로 끌어모은다 — 마법사 광역에 한데 몰아 준다
  if (tb.pull && (pt.pull -= dt) <= 0) {
    const c = h.tgtE && !h.tgtE.dead ? h.tgtE : null, pts = [];
    pt.pull = c ? 6 : 0.3;
    if (c) for (const e of g.enemies) {
      if (e === c || e.dead || e.isBoss || (e.x - c.x) ** 2 + (e.y - c.y) ** 2 > 40000) continue;
      pts.push([e.x, e.y]);
      e.x += (c.x - e.x) * tb.pull; e.y += (c.y - e.y) * tb.pull;
    }
    if (pts.length) api.emit(g, { type: 'heroProc', kind: 'nova', sub: 'pull', col: '#8fd0ff', x: c.x, y: c.y, r: 200, pts });
  }
  if (cap.shieldToss && (pt.shieldToss -= dt) <= 0) {
    let cur = nearestTo(g, h.x, h.y, 320);
    if (cur) {
      pt.shieldToss = 4;
      const used = [], pts = [[h.x, h.y]];
      for (let k = 0; k < 5 && cur; k++) {
        used.push(cur); pts.push([cur.x, cur.y]);
        heroHit(g, api, cur, st.dmg * 1.5, false, 'shield');
        if (!cur.dead && !cur.named) cur.stunT = Math.max(cur.stunT || 0, 0.6);
        cur = nearestTo(g, cur.x, cur.y, 180, used);
      }
      api.emit(g, { type: 'heroProc', kind: 'shieldToss', x: h.x, y: h.y, pts });
    } else pt.shieldToss = 0.3;
  }
  if (cap.pillar && (pt.pillar -= dt) <= 0) {
    const c = densest(g);
    if (c) {
      pt.pillar = 5;
      aoe(g, api, c.x, c.y, 110, st.dmg * 4, 'holy');
      api.emit(g, { type: 'heroProc', kind: 'pillar', x: c.x, y: c.y, r: 110 });
    } else pt.pillar = 0.3;
  }
}

// 중독: 남은 독 피해를 남은 시간에 걸쳐(영웅 몫 o:2)
function tickPoison(g, dt, api) {
  for (const e of g.enemies) {
    if (e.dead || !(e.poisonT > 0)) continue;
    const d = e.poison * Math.min(1, dt / e.poisonT);
    e.poison -= d;
    e.poisonT -= dt;
    if (e.poisonT <= 0) e.poison = e.poisonT = 0;
    api.damage(g, e, d, 2, false);
  }
}

// ── 소환물(늑대 · 그림자 분신 · 비전 분신) — g.summons, 렌더러가 그대로 그린다. 무적, 영웅이 쓰러지면 사라진다 ──
const SUMMON = {
  wolf: { spd: 190, atkSpd: 1.3, range: 30, share: 0.12 },   // share = 1마리 DPS / 영웅 기본 DPS
  shadow: { spd: 210, atkSpd: 0, range: 34, share: 0.3 },   // atkSpd 0 = 영웅 공격 속도
  arcane: { spd: 0, atkSpd: 0, range: 0, share: 0 },        // 영웅 공격을 따라 함(performAttack)
};
function wantedSummons(h) {
  const tb = h.tb, cap = tb.cap;
  if (h.state === 'down') return { wolf: 0, shadow: 0, arcane: 0 };
  return { wolf: tb.wolf + (cap.wolfPack ? 2 : 0) + (h.packT > 0 ? tb.wolfUlt : 0), shadow: cap.shadowTwins ? 2 : 0, arcane: cap.arcaneClone ? 1 : 0 }; // 늑대 소집: 궁극기 뒤 8초
}
function syncSummons(g, h, api) {
  const want = wantedSummons(h);
  for (const kind of Object.keys(SUMMON)) {
    const have = g.summons.filter(s => s.kind === kind);
    for (let k = have.length; k < want[kind]; k++) {
      const a = (g.summons.length + 1) * 2.1;
      const s = {
        id: g.nextId++, kind, x: clamp(h.x + Math.cos(a) * 36, 20, WORLD_W - 20), y: clamp(h.y + Math.sin(a) * 24, ROAM_TOP - 40, WALL_Y - 10),
        facing: h.facing, dir: h.dir, speed: 0, vx: 0, vy: 0, gait: 'idle', state: 'idle', atkT: 0, windup: 0, slot: g.summons.length, tgtE: null,
      };
      g.summons.push(s);
      api.emit(g, { type: 'summonSpawn', id: s.id, kind, x: s.x, y: s.y });
    }
    for (let k = have.length; k > want[kind]; k--) {
      const s = have[k - 1];
      g.summons.splice(g.summons.indexOf(s), 1);
      api.emit(g, { type: 'summonDespawn', id: s.id, kind, x: s.x, y: s.y });
    }
  }
}
function updateSummons(g, h, st, api, dt) {
  const cls = HERO_CLASSES[g.hero.cls];
  g.summons.forEach((s, i) => {
    const S = SUMMON[s.kind];
    s.speed = 0; s.vx = s.vy = 0;
    if (s.windup > 0 && s.kind === 'arcane') s.windup = Math.max(0, s.windup - dt * 3);
    const a = i * 2.1 + 1;
    if (s.kind === 'arcane') { // 영웅 곁에 떠 있는다
      go(s, h.x - h.facing * 34, h.y - 26, Math.max(260, st.moveSpd * 2), dt);
      if (s.windup <= 0) s.state = s.speed > 5 ? 'walk' : 'idle';
      s.gait = s.speed > 5 ? 'walk' : 'idle';
      return;
    }
    // 늑대·그림자: 영웅 주변 260 안의 적을 쫓아 문다, 없으면 영웅 곁으로
    // 특성 택1: 사냥 늑대 = 영웅의 표적만 · 호위 늑대 = 성벽에 가장 가까운 적(영웅 곁 목줄 없음)
    const wolf = s.kind === 'wolf', tb = h.tb;
    let t = s.tgtE && !s.tgtE.dead && dist(s.tgtE, h) < 300 ? s.tgtE : null;
    if (wolf && tb.wolfFocus && h.tgtE && !h.tgtE.dead) t = s.tgtE = h.tgtE;
    else if (wolf && tb.wolfGuard) t = s.tgtE = wallMost(g);
    else {
      if (!t) t = s.tgtE = nearestTo(g, s.x, s.y, 260) || (h.tgtE && !h.tgtE.dead ? h.tgtE : null);
      if (t && dist(t, h) > 320) t = s.tgtE = null;
    }
    const iv = 1 / (S.atkSpd || st.atkSpd);
    if (t && dist(s, t) <= S.range + t.r) {
      s.state = 'attack';
      s.facing = t.x >= s.x ? 1 : -1;
      s.atkT += dt;
      s.windup = Math.min(1, s.atkT / iv);
      if (s.atkT >= iv) {
        s.atkT -= iv;
        // 1타 = 영웅 기본 DPS × share ÷ 소환물 공격 속도
        let d = st.dmg * cls.base.atkSpd * S.share / (S.atkSpd || st.atkSpd);
        if (wolf) d *= 1 + tb.wolfPow + tb.wolfGuard + tb.wolfFocus + (tb.cap.wolfPack ? 0.5 : 0);
        if (t.isBoss) d *= st.bossMul;
        heroHit(g, api, t, d, false, s.kind);
        if (tb.mark) t.markAt = g.phaseT + 3; // 사냥 표식(혼합): 늑대가 문 적도
        if (wolf && tb.packHunt) t.huntAt = g.phaseT + 3; // 무리 사냥: 물린 적 표식(heroHit가 읽음)
        if (wolf && tb.wolfStun && !t.dead && !t.named && g.heroRng() < tb.wolfStun) t.stunT = Math.max(t.stunT || 0, 0.8); // 목덜미 물기
        api.emit(g, { type: 'summonAttack', id: s.id, kind: s.kind, x: s.x, y: s.y, tx: t.x, ty: t.y });
      }
    } else {
      s.windup = 0;
      s.atkT = Math.min(s.atkT + dt, iv);
      if (t) go(s, t.x, t.y, S.spd, dt);
      else go(s, h.x + Math.cos(a) * 40, h.y + Math.sin(a) * 26, S.spd * 0.6, dt);
      s.state = s.speed > 5 ? 'walk' : 'idle';
    }
    s.gait = s.speed < 5 ? 'idle' : s.speed > S.spd * 0.7 ? 'run' : 'walk';
  });
}

// ── 매 프레임(phase === 'play'일 때만 호출): 전장 자율 전투 AI ──
export function updateHeroUnit(g, dt, api) {
  const hero = g.hero, h = g.heroUnit;
  if (!hero || !hero.cls || !h) return;
  const cls = HERO_CLASSES[hero.cls];
  // 특성 합산은 0.5초마다(도전 중 특성을 찍으면 act가 tbT = 0으로 즉시 갱신)
  // 전투 스탯은 0.2초마다(장비·마법사 강화·버프 반영 지연 ≤ 0.2초)
  if ((h.tbT -= dt) <= 0) { h.tb = talentBonus(hero, hero.cls); h.tbT = 0.5; h.stT = 0; }
  const fresh = (h.stT -= dt) <= 0 || !h.st;
  if (fresh) { h.st = heroCombatStats(g, hero, h.tb); h.stT = 0.2; }
  const tb = h.tb, st = h.st;
  const prevMax = h.maxHp;
  h.maxHp = st.maxHp;
  if (h.hp > 0 && prevMax > 1 && h.maxHp > prevMax) h.hp *= h.maxHp / prevMax; // 성벽 결계 강화로 최대치가 오르면 비율 유지(바가 줄어 보이던 버그)
  h.hp = h.hp < 0 ? h.maxHp : Math.min(h.hp, h.maxHp);
  h.level = hero.level;
  h.tier = heroTier(hero.level);
  if (h.invulnT > 0) h.invulnT -= dt;
  if (h.ultCd > 0) h.ultCd = Math.max(0, h.ultCd - dt);
  if (h.ultT > 0) h.ultT -= dt;
  if (h.blinkT > 0) h.blinkT -= dt;
  if (h.ambushT > 0) h.ambushT -= dt;
  if (h.chargeCd > 0) h.chargeCd -= dt; // 성전 돌격
  if (h.packT > 0) h.packT -= dt;       // 늑대 소집
  if (g.heroBuff && (g.heroBuff.t -= dt) <= 0) g.heroBuff = null;
  if (tb.wallRegen) g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * tb.wallRegen * dt);
  tickPoison(g, dt, api);

  if (h.state === 'down') {
    h.engageR = 0; h.speed = 0; h.gait = 'idle'; h.charging = null;
    h.respawnT -= dt;
    if (h.respawnT <= 0) respawnHero(g, api);
    syncSummons(g, h, api);
    return;
  }
  h.speed = 0; h.vx = h.vy = 0;
  if (tb.chillAura) { // 냉기 오라: 주변 적 계속 둔화(2초마다 파동 연출)
    const r = tb.chillAura;
    for (const e of g.enemies) if (!e.dead && (e.x - h.x) ** 2 + (e.y - h.y) ** 2 <= (r + e.r) ** 2) e.slowT = Math.max(e.slowT, 0.3);
    if ((h.auraT = (h.auraT || 0) - dt) <= 0) { h.auraT = 2; api.emit(g, { type: 'heroProc', kind: 'nova', sub: 'chill', col: '#9fe8ff', x: h.x, y: h.y, r }); }
  }

  // 후퇴 판단: 30% 아래 → 성벽 쪽으로, 80% 회복하면 재진격(생명 흡수·피의 광기는 15%까지 버틴다)
  const wasRetreat = h.mode === 'retreat';
  const retreat = !h.moveTo && (wasRetreat ? h.hp < h.maxHp * RETURN_HP : h.hp < h.maxHp * (tb.lifesteal || tb.berserk ? 0.15 : RETREAT_HP));
  if (retreat && !wasRetreat) api.emit(g, { type: 'heroRetreat', x: h.x, y: h.y });
  if (!retreat && wasRetreat) api.emit(g, { type: 'heroAdvance', x: h.x, y: h.y });
  h.engageR = retreat ? 0 : st.engageR; // 후퇴 중엔 적을 끌지 않는다(치고 빠지기)

  // 표적(0.25초마다 재평가)
  if ((h.retargetT -= dt) <= 0 || !h.tgtE || h.tgtE.dead) {
    h.retargetT = RETARGET_T;
    h.tgtE = pickTarget(g, h);
  }
  let target = h.tgtE;
  h.tgt = target ? target.id : null;
  const near = nearestTo(g, h.x, h.y, 400);
  // 회복: 비전투 · 후퇴 중 · 성벽 곁
  const calm = !near || dist(near, h) > 200;
  const rate = (retreat ? (h.y > WALL_Y - 110 ? REGEN.wall : REGEN.retreat) : calm ? REGEN.rest : 0) + tb.regen;
  if (rate) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * rate * dt);

  let attackT = null; // 이번 프레임 공격 대상
  if (retreat || h.moveTo || !target) h.charging = null; // 돌격 중단
  if (h.moveTo) {
    h.mode = 'move';
    h.moveTo.holdT -= dt;
    go(h, h.moveTo.x, h.moveTo.y, st.moveSpd, dt);
    if (h.moveTo.holdT <= 0) h.moveTo = null;
    attackT = [target, near].find(e => inRange(h, e, st.range)) || null;
  } else if (retreat) {
    h.mode = 'retreat';
    go(h, clamp(h.x, 140, WORLD_W - 140), WALL_Y - 40, st.moveSpd, dt);
    if (!cls.melee) attackT = [target, near].find(e => inRange(h, e, st.range)) || null; // 원거리는 물러나며 쏜다
  } else if (!target) {
    rally(g, h, st, dt);
  } else if (cls.melee) {
    h.mode = 'engage';
    const d = dist(h, target);
    if (d > st.range + target.r) {
      if (cls.blink && !(h.blinkT > 0) && (d > 120 || h.hop)) blink(g, h, cls, target, api); // hop = 그림자 도약(처치 직후)
      else {
        if (tb.charge && !(h.chargeCd > 0) && d > 150) { h.charging = target; h.chargeCd = 5; } // 성전 돌격: 4배 속도로 달려든다
        go(h, target.x, target.y, st.moveSpd * (h.charging ? 4 : 1), dt);
      }
    }
    if (h.charging && (h.charging !== target || dist(h, target) <= st.range + target.r + 6)) chargeHit(g, h, st, api);
    attackT = inRange(h, target, st.range) ? target : inRange(h, near, st.range) ? near : null;
  } else {
    h.mode = 'kite';
    // 근접 속사·냉기 오라: 물러나지 않고 바짝 붙어 싸운다
    const close = tb.pointBlank || tb.chillAura, far = Math.min(st.range * 0.9, tb.pointBlank ? 190 : tb.chillAura ? tb.chillAura + 30 : Infinity);
    const d = dist(h, target), safe = Math.max(90, st.range * 0.3);
    if (!close && near && dist(near, h) < safe + near.r) { // 너무 가까움: 반대쪽(성벽 쪽으로 기울여)으로 물러나며 쏜다
      const nd = dist(near, h) || 1;
      go(h, h.x + (h.x - near.x) / nd * 80, h.y + (h.y - near.y) / nd * 80 + 30, st.moveSpd, dt);
    } else if (d > far + target.r) go(h, target.x, target.y, st.moveSpd, dt);
    else if (!close && d < st.range * 0.5) go(h, h.x - (target.x - h.x) / d * 40, h.y - (target.y - h.y) / d * 40, st.moveSpd * WALK, dt);
    attackT = inRange(h, target, st.range) ? target : inRange(h, near, st.range) ? near : null;
  }
  if (tb.hold && !h.moveTo && h.y < HOLD_Y) h.y = HOLD_Y; // 진지 사수: 선 위로 나가지 않는다

  h.fightE = attackT;
  // 특성 공격 간격: 연사 가속(쏠 때마다 쌓이고 2초 쉬면 사라짐) · 비전 쇄도(궁극기 뒤 6초)
  if (h.frenzyN && g.phaseT - h.frenzyAt > 2) h.frenzyN = 0;
  if (h.surgeT > 0) h.surgeT -= dt;
  const iv = 1 / (st.atkSpd * (1 + tb.frenzy * (h.frenzyN | 0) + (h.surgeT > 0 ? tb.surge : 0)));
  if (attackT) {
    h.state = 'attack';
    h.facing = attackT.x >= h.x ? 1 : -1; // 물러나며 쏠 때도 표적을 본다(뒷걸음 카이팅)
    h.atkT += dt;
    h.windup = Math.min(1, h.atkT / iv);
    if (h.atkT >= iv) { h.atkT -= iv; performAttack(g, hero, h, cls, st, attackT, api); }
  } else {
    h.atkT = Math.min(h.atkT + dt, iv); // 준비 완료 상태로 대기(닿자마자 첫 타)
    h.windup = 0;
    if (h.mode !== 'rally') h.state = h.speed > 5 ? 'walk' : 'idle';
  }
  h.gait = h.speed < 5 ? 'idle' : h.speed > st.moveSpd * 0.7 ? 'run' : 'walk';
  updateProcs(g, h, st, api, dt);
  if (fresh) syncSummons(g, h, api); // 스탯 갱신 주기에 맞춰(쓰러짐은 즉시 따로 부른다)
  updateSummons(g, h, st, api, dt);
}

// 적이 없을 때: 전장 중앙 집결 지점 주변을 천천히 배회하며 두리번거린다(성문에 박혀 있지 않음)
function rally(g, h, st, dt) {
  h.mode = 'rally';
  if (!h.wander) h.wander = { x: HERO_RALLY.x, y: HERO_RALLY.y };
  if (h.tb.hold) h.wander.y = Math.max(h.wander.y, HOLD_Y + 30); // 진지 사수: 성벽 앞에서 대기
  const far = Math.hypot(h.wander.x - h.x, h.wander.y - h.y) > 100; // 멀면 잰걸음, 가까우면 천천히 배회
  const arrived = go(h, h.wander.x, h.wander.y, st.moveSpd * (far ? 0.75 : WALK), dt);
  h.state = arrived || h.speed < 5 ? 'idle' : 'walk';
  if (!arrived) return;
  if ((h.lookT -= dt) > 0) return;
  h.lookT = 1.1 + g.heroRng() * 0.8;
  h.facing = -h.facing; // 두리번
  if (g.heroRng() < 0.35) h.wander = { x: HERO_RALLY.x + (g.heroRng() - 0.5) * 120, y: HERO_RALLY.y + (g.heroRng() - 0.5) * 70 };
}

// 성전 돌격 착지: 영웅 주변 반경 80 피해 + 0.6초 기절(네임드 제외)
function chargeHit(g, h, st, api) {
  h.charging = null;
  for (const e of g.enemies) {
    if (e.dead || (e.x - h.x) ** 2 + (e.y - h.y) ** 2 > (80 + e.r) ** 2) continue;
    heroHit(g, api, e, st.dmg * h.tb.charge, false, 'shield');
    if (!e.dead && !e.named) e.stunT = Math.max(e.stunT || 0, 0.6);
  }
  api.emit(g, { type: 'heroProc', kind: 'nova', sub: 'charge', col: '#ffe07a', x: h.x, y: h.y, r: 80 });
}

// 암살자: 먼 표적 옆으로 그림자 순간이동
function blink(g, h, cls, target, api) {
  const x0 = h.x, y0 = h.y, a = Math.atan2(h.y - target.y, h.x - target.x), d = target.r + 18;
  h.x = clamp(target.x + Math.cos(a) * d, 20, WORLD_W - 20);
  h.y = clamp(target.y + Math.sin(a) * d, ROAM_TOP - 40, WALL_Y - 10);
  h.facing = target.x >= h.x ? 1 : -1;
  h.blinkT = cls.blink * (1 - h.tb.blink);
  h.hop = false;
  h.ambushT = h.tb.ambush ? 1 : 0;
  h.state = 'walk';
  api.emit(g, { type: 'heroBlink', x0, y0, x: h.x, y: h.y });
  if (h.tb.shadowStrike && h.st) { // 그림자 습격: 도착 지점 반경 90
    aoe(g, api, h.x, h.y, 90, h.st.dmg * h.tb.shadowStrike, 'dark');
    api.emit(g, { type: 'heroProc', kind: 'nova', sub: 'shadowStrike', x: h.x, y: h.y, r: 90 });
  }
}

// 성벽 대신 영웅이 맞는다(도발/근접). src = 때린 적(가시 갑옷 반사 대상)
// 영웅이 막은 피해는 성벽 손실(wallLost)이 아니다 — 더하면 자동 강화가 성벽 결계를 과하게 산다
export function heroTakeDamage(g, dmg, api, src = null) {
  const h = g.heroUnit;
  if (!h || h.state === 'down' || h.invulnT > 0) return;
  const stats = h.st || heroCombatStats(g, g.hero, h.tb);
  if (h.tb.evade && g.heroRng() < h.tb.evade) { // 그림자 회피: 피하고 때린 적에게 반격(공격력 100%)
    if (src && !src.dead) heroHit(g, api, src, stats.dmg, false, 'dark');
    api.emit(g, { type: 'heroProc', kind: 'nova', sub: 'evade', col: '#c070ff', x: h.x, y: h.y, r: 44 });
    return;
  }
  const iron =collabOn(g, 'ironLine') ? Math.min(0.6, COLLAB_FX.ironLine * collabPow(g)) : 0; // 철벽 전선
  const dealt = dmg * (1 - stats.dmgReduce) * (1 - iron);
  if (iron) api.collabProc(g, 'ironLine', h.x, h.y);
  h.hp -= dealt;
  api.emit(g, { type: 'heroHit', x: h.x, y: h.y, dmg });
  if (src && !src.dead && h.tb.thorns) {
    heroHit(g, api, src, stats.dmg * h.tb.thorns, false, 'thorns');
    api.emit(g, { type: 'thorns', x: src.x, y: src.y + src.r, o: 2 });
  }
  if (h.tb.bash && !(h.bashAt > g.phaseT) && g.heroRng() < 0.25) { // 반격의 방패: 25%, 0.5초마다 최대 1번
    h.bashAt = g.phaseT + 0.5;
    for (const e of g.enemies) {
      if (e.dead || (e.x - h.x) ** 2 + (e.y - h.y) ** 2 > (110 + e.r) ** 2) continue;
      heroHit(g, api, e, stats.dmg * h.tb.bash, false, 'shield');
      if (!e.dead && !e.named) e.stunT = Math.max(e.stunT || 0, 0.5);
    }
    api.emit(g, { type: 'heroProc', kind: 'nova', sub: 'bash', x: h.x, y: h.y, r: 110 });
  }
  if (h.hp <= 0) {
    h.hp = 0;
    h.state = 'down';
    h.mode = 'rally';
    h.moveTo = null;
    h.respawnT = clamp(6 + h.level * 0.12, 6, 18);
    api.emit(g, { type: 'heroDown', x: h.x, y: h.y });
    syncSummons(g, h, api);
  }
}

function respawnHero(g, api) {
  const h = g.heroUnit;
  h.x = HERO_GATE.x; h.y = HERO_GATE.y; h.state = 'walk'; h.mode = 'rally'; h.hp = -1; h.moveTo = null; h.wander = null;
  api.emit(g, { type: 'heroRespawn', x: h.x, y: h.y });
}

// 궁극기: 전부 즉발형(연출은 렌더러가 heroUlt 이벤트로 표현) — 기사만 지속(무적) 상태를 남긴다.
// 특성: 쿨타임 -ultCd, 효과 +ultPow, 궁극 특성 warcry(전군 강화 함성) · absZero(절대영도)
export function castHeroUlt(g, api) {
  const hero = g.hero, h = g.heroUnit;
  if (!hero || !h || h.state === 'down' || h.ultCd > 0) return false;
  const cls = HERO_CLASSES[hero.cls], tb = h.tb, stats = heroCombatStats(g, hero, tb), pow = 1 + tb.ultPow;
  h.ultCd = cls.ult.cd * Math.max(0.4, 1 - tb.ultCd);
  h.ultT = 0.5;
  const absZero = hero.cls === 'sorcerer' && tb.cap.absZero;
  const r = absZero ? 280 : cls.ult.r || 0;
  api.emit(g, { type: 'heroUlt', cls: hero.cls, x: h.x, y: h.y, r, variant: absZero ? 'absZero' : null });
  const enemiesIn = rr => g.enemies.filter(e => !e.dead && Math.hypot(e.x - h.x, e.y - h.y) <= rr);
  switch (hero.cls) {
    case 'knight':
      h.invulnT = cls.ult.dur;
      for (const e of enemiesIn(cls.ult.r)) e.stunT = Math.max(e.stunT || 0, 1.5 * pow);
      break;
    case 'ranger':
      for (const e of enemiesIn(cls.ult.r)) heroHit(g, api, e, stats.dmg * 2.2 * pow, false);
      break;
    case 'sorcerer': {
      const inR = enemiesIn(r);
      for (const e of inR) {
        heroHit(g, api, e, stats.dmg * (absZero ? 5 : 3.5) * pow, false, 'frost');
        if (absZero && !e.dead) e.stunT = Math.max(e.stunT || 0, e.named ? 1.5 : 3);
      }
      if (collabOn(g, 'stormCall') && inR.length) { // 폭풍 소환: 궁극기 범위 안 모든 적에게 성벽 마법사(P1)의 낙뢰
        const lv = Math.max(g.book.lightningStrike || 0, g.book.tornado || 0, 1);
        const ld = g.players[0].stats.dmg * SPELL_BY_KEY.lightningStrike.lv[lv - 1].mul * collabPow(g);
        inR.forEach((e, k) => {
          if (k < 12) api.emit(g, { type: 'spell', key: 'lightningStrike', o: 0, x: e.x, y: e.y, collab: 'stormCall' });
          if (!e.dead) api.spellHit(g, e, ld, 0, 'lightning', true);
        });
        api.collabProc(g, 'stormCall', h.x, h.y);
      }
      break;
    }
    case 'cleric':
      g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * 0.25 * pow);
      h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.5);
      for (const e of enemiesIn(cls.ult.r)) heroHit(g, api, e, stats.dmg * 3 * pow, false);
      break;
    case 'assassin': {
      const picked = g.enemies.filter(e => !e.dead).sort((a, b) => (b.isBoss ? 1 : 0) - (a.isBoss ? 1 : 0)).slice(0, cls.ult.n);
      for (const e of picked) heroHit(g, api, e, stats.dmg * stats.critMult * 1.6 * pow, true);
      break;
    }
  }
  if (tb.cap.warcry) { // 전군 강화 함성: 마법사 + 영웅 피해 +40% (sim.js spellHit · heroCombatStats가 g.heroBuff를 읽는다)
    g.heroBuff = { t: 8, mul: 1.4 };
    h.stT = 0;
    api.emit(g, { type: 'heroProc', kind: 'warcry', x: h.x, y: h.y, t: 8 });
  }
  // 핵심 노드: 작전 지휘(마법사 스킬 대기 -N초, 영혼 사냥과 같은 방식) · 은총(성벽 회복 + 무적) · 비전 쇄도(공속, updateHeroUnit)
  if (tb.ultRefresh && g.spellT) for (const k of Object.keys(g.spellT)) if (typeof g.spellT[k] === 'number' && k !== 'dragon') g.spellT[k] -= tb.ultRefresh;
  if (tb.grace) {
    g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * tb.grace);
    h.invulnT = Math.max(h.invulnT, 1.5);
  }
  if (tb.surge) h.surgeT = 6;
  if (tb.wolfUlt) h.packT = 8; // 늑대 소집(wantedSummons)
  if (tb.ultBless && !(g.heroBuff && g.heroBuff.mul >= 1 + tb.ultBless)) { // 축복의 함성: 5초간 마법사·영웅 피해 +(g.heroBuff — 전군 강화 함성과 같은 통로)
    g.heroBuff = { t: 5, mul: 1 + tb.ultBless };
    h.stT = 0;
    api.emit(g, { type: 'heroProc', kind: 'nova', sub: 'ultBless', col: '#ffe07a', x: h.x, y: h.y, r: 180 });
  }
  if (tb.ultRefresh || tb.grace || tb.surge) api.emit(g, { type: 'heroProc', kind: 'nova', sub: tb.grace ? 'grace' : tb.surge ? 'surge' : 'ultRefresh', x: h.x, y: h.y, r: 140 });
  return true;
}

// ── 성장(경험치/레벨업) · 처치 보상(경험치+드롭) ──
// 경험치 적립(순수). 오른 레벨마다 { level, tier, milestone } 반환 — 오프라인 보상도 이걸 쓴다
export function addXp(hero, amt) {
  const ups = [];
  if (!hero || !(amt > 0)) return ups;
  hero.xp += amt;
  let need = xpToNext(hero.level);
  while (hero.xp >= need && hero.level < MAX_HERO_LV) {
    hero.xp -= need;
    hero.level++;
    const m = milestoneAt(hero.level);
    ups.push({ level: hero.level, tier: heroTier(hero.level), milestone: m ? m.key : null });
    need = xpToNext(hero.level);
  }
  return ups;
}

// 런 중 경험치(영구 강화 '영웅 경험치' 배율 g.fx.xpMul × 특성 '지혜')
export function heroGainXp(g, amt, api) {
  const hero = g.hero;
  if (!hero || !hero.cls) return;
  const tb = g.heroUnit ? g.heroUnit.tb : null;
  for (const u of addXp(hero, amt * (g.fx ? g.fx.xpMul : 1) * (1 + (tb ? tb.xp : 0)))) {
    if (u.milestone === 'reroll1') g.rerollLeft = (g.rerollLeft | 0) + 1; // 도전 도중 Lv5 달성: 이번 도전부터 바로 1회
    api.emit(g, { type: 'heroLevelUp', ...u });
  }
}

const DROP_CHANCE = { normal: 0.02, elite: 0.35, named: 1 };
const CORPSE_COL = { sorcerer: '#ff8a3a', cleric: '#ffd23a', assassin: '#9dff5a' }; // 처치 폭발 색(불씨 · 천벌 · 독)
// o = 처치한 쪽(2 = 영웅·소환물)
export function heroOnKill(g, e, api, o) {
  const hero = g.hero;
  if (!hero || !hero.cls) return;
  heroGainXp(g, xpForKill(e, g.stage), api);
  const h = g.heroUnit, tb = h && h.tb;
  if (tb) {
    // 독 확산 / 역병: 중독된 적이 죽으면(누가 잡았든) 주변으로 독이 번진다
    if (e.poison > 0 && (tb.spread || tb.cap.plague)) {
      const r = tb.cap.plague ? 150 : 90, pts = [];
      const near = g.enemies.filter(q => !q.dead && q !== e && (q.x - e.x) ** 2 + (q.y - e.y) ** 2 <= (r + q.r) ** 2);
      // 번지는 독은 남은 독을 나눠 갖는다(총량 보존 — 밀집한 무리에서 독이 기하급수로 불어나지 않게)
      const frac = (tb.cap.plague ? 1 : tb.spread) * Math.min(1, 1 / Math.max(1, near.length));
      for (const q of near) {
        q.poison = (q.poison || 0) + e.poison * frac;
        q.poisonT = 4;
        pts.push([q.x, q.y]);
      }
      if (tb.cap.plague && pts.length) api.emit(g, { type: 'heroProc', kind: 'plague', x: e.x, y: e.y, r, pts });
    }
    if (o === 2 && h.state !== 'down') {
      if (tb.killHeal) h.hp = Math.min(h.maxHp, h.hp + h.maxHp * tb.killHeal);
      if (tb.momentum) h.momentum = true; // 연쇄 처형: 다음 공격 강화(performAttack)
      if (tb.wallKill) g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * tb.wallKill);
      // 특성 택1: 처치 폭발(연쇄 — 폭발로 죽은 적도 터진다) · 처치 → 마법사 스킬 가속 · 그림자 도약
      if (tb.corpse && h.st) {
        aoe(g, api, e.x, e.y, 80, h.st.dmg * tb.corpse, 'hero', e);
        api.emit(g, { type: 'heroProc', kind: 'nova', sub: 'corpse', col: CORPSE_COL[g.hero.cls] || '#ff8a3a', x: e.x, y: e.y, r: 80 });
      }
      if (tb.soulFeed && g.spellT) for (const k of Object.keys(g.spellT)) if (typeof g.spellT[k] === 'number' && k !== 'dragon') g.spellT[k] -= tb.soulFeed;
      if (tb.killBlink && g.heroRng() < tb.killBlink) { h.blinkT = 0; h.hop = true; }
      if (collabOn(g, 'soulHunt') && g.spellT) { // 영혼 사냥: 영웅의 처치가 성벽 마법사 스킬 대기 시간을 줄인다
        const cut = COLLAB_FX.soulHunt * collabPow(g);
        for (const k of Object.keys(g.spellT)) if (typeof g.spellT[k] === 'number' && k !== 'dragon') g.spellT[k] -= cut;
        api.collabProc(g, 'soulHunt', e.x, e.y);
      }
    }
  }
  const chance = e.named ? DROP_CHANCE.named : e.isBoss ? DROP_CHANCE.elite : DROP_CHANCE.normal;
  if (g.heroRng() < chance) {
    const source = e.named ? 'boss' : e.isBoss ? 'elite' : 'normal';
    lootDrop(g, source, e.x, e.y, api);
  }
}

export function lootDrop(g, source, x, y, api) {
  const hero = g.hero;
  const item = rollItem(g.stage, source, g.heroRng, hero.cls);
  hero.bag.push(item);
  if (hero.autoEquip) autoEquipAll(hero); // 장착 먼저 — 가방이 가득 차도 더 좋은 드롭이 팔려 나가지 않게(상자와 같은 순서)
  const overflow = trimBag(hero);
  if (overflow) { // 가방이 넘치면 판매 — 판매 골드는 이어하기 체크포인트에도(sim.js saleGold와 같은 이유)
    const v = sellValue(overflow);
    g.players[0].gold += v;
    if (g.run?.checkpoint) g.run.checkpoint.players[0].gold += v;
  }
  api.emit(g, { type: 'loot', item, x, y });
}

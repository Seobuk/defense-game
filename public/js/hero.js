// 영웅(클래스 필드 유닛) · 장비 — 순수 함수, DOM 없음 (sim.js가 호출)
// api = sim.js가 넘겨주는 { damage, killEnemy, damageWall, emit, chainArc, frontMost } (spells.js와 동일한 SPELL_API 재사용)
import { WALL_Y, CANNONS, WORLD_W } from './config.js';
import { clamp } from './util.js';

// ── 클래스 5종 ──
export const HERO_CLASSES = {
  knight: {
    name: '기사', role: '근접 탱커 — 도발로 적을 붙잡는다', weapon: '검',
    base: { hp: 260, atk: 12, range: 48, atkSpd: 1.0, moveSpd: 95 },
    passive: '반경 150 안의 적은 성벽 대신 기사를 노린다(도발)',
    taunt: 150, melee: true,
    ult: { name: '성스러운 방패', cd: 26, dur: 3, r: 170 },
    ultDesc: '3초간 무적 + 주변 적 기절',
    unlock: () => true,
  },
  ranger: {
    name: '궁수', role: '원거리 속사 — 관통 화살', weapon: '활',
    base: { hp: 150, atk: 9, range: 400, atkSpd: 2.6, moveSpd: 115 },
    passive: '화살이 최대 2마리를 관통한다',
    pierce: 2, melee: false,
    ult: { name: '화살비', cd: 20, dur: 2.2, r: 170 },
    ultDesc: '전방 넓은 범위에 화살비',
    unlock: () => true,
  },
  sorcerer: {
    name: '마법사', role: '원거리 광역 마법', weapon: '지팡이',
    base: { hp: 150, atk: 11, range: 340, atkSpd: 0.9, moveSpd: 100 },
    passive: '공격이 착탄 지점 주변에도 피해를 준다',
    splash: 60, melee: false,
    ult: { name: '블리자드', cd: 30, dur: 4, r: 220 },
    ultDesc: '넓은 범위에 냉기 폭풍(큰 피해)',
    unlock: () => true,
  },
  cleric: {
    name: '성직자', role: '근접·신성 광역, 성벽·자신 회복', weapon: '철퇴',
    base: { hp: 220, atk: 10, range: 72, atkSpd: 1.1, moveSpd: 95 },
    passive: '공격할 때마다 성벽과 자신을 소량 회복, 언데드에 추가 피해',
    healOnHit: 0.006, undeadBonus: 1.5, melee: true,
    ult: { name: '천상의 치유', cd: 28, dur: 0, r: 260 },
    ultDesc: '성벽 대량 회복 + 주변 신성 폭발',
    unlock: best => best >= 20,
  },
  assassin: {
    name: '암살자', role: '순간이동 연속 베기, 보스 특화', weapon: '단검',
    base: { hp: 170, atk: 13, range: 56, atkSpd: 1.6, moveSpd: 130 },
    passive: '치명타 확률 +20%p, 보스 피해 +30%',
    critBonus: 0.2, bossBonus: 1.3, melee: true, blink: 1.6, // blink = 그림자 순간이동 쿨타임(초)
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
// ponytail: 곡선은 밸런스 러너(100층) 결과로 맞춤(레벨 60~80) — 수치 바꾸면 npm test로 재확인
export const xpToNext = level => Math.floor(90 * 1.05 ** (level - 1));
export const heroClearXp = (stage, firstClear) => Math.ceil((stage * 1.6 + 12) * (firstClear ? 2.4 : 1));
const XP_KILL = { normal: 1.4, elite: 9, named: 45 };
export const xpForKill = (e, stage) => (e.named ? XP_KILL.named : e.isBoss ? XP_KILL.elite : XP_KILL.normal) * (1 + stage * 0.03);

export const MILESTONES = [
  { lv: 5, key: 'reroll1', desc: '스테이지당 카드 새로고침 1회' },
  { lv: 8, key: 'skillUp1', desc: '클래스 스킬 강화' },
  { lv: 15, key: 'choose4', desc: '카드 4장 중 선택' },
  { lv: 20, key: 'skillUp2', desc: '클래스 스킬 강화' },
  { lv: 30, key: 'extraCard', desc: '스테이지 시작 시 카드 1장 추가' },
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
    cls: null, level: 1, xp: 0, autoEquip: false,
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
  const w = DROP_WEIGHTS[source] || DROP_WEIGHTS.normal;
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

// stage(=ilvl), source: 'normal'|'elite'|'boss'|'chest'
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
export function sellValue(item) {
  if (!item) return 0;
  return Math.ceil(itemPower(item) * 0.8 * (SELL_MUL[item.rarity] || 1));
}

// 가방(30칸). 초과 시 가장 낮은 등급(동급이면 가장 낮은 전투력)을 자동 판매하고 그 아이템을 반환
export function addToBag(hero, item) {
  hero.bag.push(item);
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
export function gearBonuses(hero) {
  const b = { atkPct: 0, heroHpPct: 0, dmgReducePct: 0, critDmgPct: 0, atkSpeedPct: 0, gold: 0, boss: 0, mana: 0, spell: 0, crit: 0, heroHp: 0 };
  if (!hero) return b;
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

// 영웅 유닛 전투 스탯. dmg/maxHp는 대포 공격력·성벽 최대체력에 비례(스테이지가 진행돼도 계속 유효하도록)
export function heroCombatStats(g, hero) {
  const cls = HERO_CLASSES[hero.cls] || HERO_CLASSES.knight;
  const gear = gearBonuses(hero);
  const lvl = hero.level;
  const skillUp = (hasMilestone(lvl, 'skillUp1') ? 0.1 : 0) + (hasMilestone(lvl, 'skillUp2') ? 0.1 : 0) + (hasMilestone(lvl, 'skillUp3') ? 0.15 : 0);
  const dmgMul = (0.02 + 0.02 * lvl + skillUp) * (1 + gear.atkPct / 250);
  // 체력 = 성벽 최대체력의 일부 × 클래스 기본 체력(기사 260 ~ 궁수 150). 근접 클래스가 몇 초는 버티며 적을 붙잡을 수 있게
  const hpFrac = (0.05 + 0.003 * lvl) * (cls.base.hp / 200) * (1 + gear.heroHpPct / 100 + gear.heroHp / 100);
  const dmg = (g.players[0] ? g.players[0].stats.dmg : 10) * dmgMul;
  const maxHp = Math.max(60, Math.round((g.wall ? g.wall.max : 200) * hpFrac));
  return {
    dmg, maxHp, range: cls.base.range,
    atkSpd: cls.base.atkSpd * (1 + gear.atkSpeedPct / 100),
    moveSpd: cls.base.moveSpd,
    critChance: clamp(0.05 + (cls.critBonus || 0) + gear.crit / 100, 0, 0.9),
    critMult: 1.5 + gear.critDmgPct / 100,
    bossMul: 1 + (cls.bossBonus ? cls.bossBonus - 1 : 0) + gear.boss / 100,
    dmgReduce: clamp(gear.dmgReducePct / 100, 0, 0.85),
    melee: !!cls.melee,
  };
}

// ── 필드 유닛 ──
export const HERO_GATE = { x: (CANNONS[0].x + CANNONS[1].x) / 2, y: WALL_Y - 30 };
export const HERO_MELEE_R = 26; // 도발 근접 판정 여유 반경(sim.js의 walk()도 이 값을 쓴다)

export function spawnHeroUnit(hero) {
  return {
    cls: hero.cls, x: HERO_GATE.x, y: HERO_GATE.y, hp: -1, maxHp: 1,
    state: 'walk', facing: 1, atkT: 0,
    ultCd: 0, ultT: 0, invulnT: 0,
    moveTo: null, respawnT: 0,
    level: hero.level, tier: heroTier(hero.level),
  };
}

// 도발/근접: 근접 클래스가 이 반경 안에 있으면 적이 성벽 대신 영웅을 노린다(기사는 넓게 도발, 다른 근접 클래스는 닿으면).
// 원거리 클래스(궁수·마법사)는 사거리 확보차 성벽 근처에 자주 서 있어도 적을 끌어들이지 않는다(0이면 사실상 비활성)
export function heroEngageRadius(hero) {
  const cls = HERO_CLASSES[hero.cls];
  if (!cls || !cls.melee) return 0;
  return cls.taunt || 50;
}

function moveToward(h, x, y, spd, dt) {
  const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy);
  if (d < 1) return true;
  const step = Math.min(d, spd * dt);
  h.x += dx / d * step;
  h.y += dy / d * step;
  h.facing = dx >= 0 ? 1 : -1;
  return step >= d;
}

const HERO_LEASH = 520; // 성문에서 이 거리 안의 적만 쫓아간다(먼 스폰까지 몰려가 고립되지 않도록)

function nearestInRange(g, h, range) {
  let best = null, bd = Infinity;
  for (const e of g.enemies) {
    if (e.dead) continue;
    const d = (e.x - h.x) ** 2 + (e.y - h.y) ** 2;
    if (d <= (range + e.r) ** 2 && d < bd) { bd = d; best = e; }
  }
  return best;
}

// 영웅 피해 = damage() 반환값을 그대로 hit 이벤트로(FX 데미지 숫자가 체력 감소 추정 대신 이걸 씀, o:2)
function heroHit(g, api, e, dmg, crit) {
  const dealt = api.damage(g, e, dmg, 2);
  api.emit(g, { type: 'hit', x: e.x, y: e.y, dmg: dealt, o: 2, crit, big: crit });
  return dealt;
}

function performAttack(g, hero, h, cls, stats, target, api) {
  const crit = g.heroRng() < stats.critChance;
  let dmg = stats.dmg * (crit ? stats.critMult : 1);
  if (target.isBoss) dmg *= stats.bossMul;
  if (cls.undeadBonus && UNDEAD_TYPES.includes(target.type)) dmg *= cls.undeadBonus;
  api.emit(g, { type: 'heroAttack', x: h.x, y: h.y, tx: target.x, ty: target.y, cls: hero.cls, crit });
  heroHit(g, api, target, dmg, crit);
  if (cls.pierce) {
    let n = 0;
    for (const e of g.enemies) {
      if (n >= cls.pierce || e === target || e.dead) continue;
      if (Math.hypot(e.x - target.x, e.y - target.y) <= 50) { heroHit(g, api, e, dmg, crit); n++; }
    }
  }
  if (cls.splash) {
    for (const e of g.enemies) {
      if (e === target || e.dead) continue;
      if (Math.hypot(e.x - target.x, e.y - target.y) <= cls.splash) heroHit(g, api, e, dmg * 0.6, false);
    }
  }
  if (cls.healOnHit) {
    g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * cls.healOnHit);
    h.hp = Math.min(h.maxHp, h.hp + h.maxHp * cls.healOnHit);
  }
}

// 매 프레임(phase === 'play'일 때만 호출)
export function updateHeroUnit(g, dt, api) {
  const hero = g.hero, h = g.heroUnit;
  if (!hero || !hero.cls || !h) return;
  const cls = HERO_CLASSES[hero.cls];
  const stats = heroCombatStats(g, hero);
  h.maxHp = stats.maxHp;
  h.hp = h.hp < 0 ? h.maxHp : Math.min(h.hp, h.maxHp);
  h.level = hero.level;
  h.tier = heroTier(hero.level);
  if (h.invulnT > 0) h.invulnT -= dt;
  if (h.ultCd > 0) h.ultCd = Math.max(0, h.ultCd - dt);
  if (h.ultT > 0) h.ultT -= dt;
  if (h.blinkT > 0) h.blinkT -= dt;

  if (h.state === 'down') {
    h.respawnT -= dt;
    if (h.respawnT <= 0) respawnHero(g, api);
    return;
  }

  if (h.moveTo) {
    h.moveTo.holdT -= dt;
    h.state = moveToward(h, h.moveTo.x, h.moveTo.y, stats.moveSpd, dt) ? 'idle' : 'walk'; // 탭 이동 중 걷기 모션
    if (h.moveTo.holdT <= 0) h.moveTo = null;
  }

  let target = nearestInRange(g, h, stats.range);
  if (!target) {
    const fm = api.frontMost(g);
    if (fm && HERO_GATE.y - fm.y <= HERO_LEASH) target = fm; // 성문에서 너무 먼 적은 쫓지 않음(고립 방지)
  }
  const inRange = target && Math.hypot(target.x - h.x, target.y - h.y) <= stats.range + target.r;

  if (!h.moveTo) {
    if (target && !inRange && cls.blink && !(h.blinkT > 0) && Math.hypot(target.x - h.x, target.y - h.y) > 120) {
      // 암살자: 먼 표적 옆으로 그림자 순간이동
      const x0 = h.x, y0 = h.y, a = Math.atan2(h.y - target.y, h.x - target.x), d = target.r + 18;
      h.x = clamp(target.x + Math.cos(a) * d, 20, WORLD_W - 20);
      h.y = Math.min(WALL_Y - 10, target.y + Math.sin(a) * d);
      h.facing = target.x >= h.x ? 1 : -1;
      h.blinkT = cls.blink;
      h.state = 'walk';
      api.emit(g, { type: 'heroBlink', x0, y0, x: h.x, y: h.y });
    } else if (target && !inRange) { moveToward(h, target.x, target.y, stats.moveSpd, dt); h.state = 'walk'; }
    else if (!target) { const arrived = moveToward(h, HERO_GATE.x, HERO_GATE.y, stats.moveSpd, dt); h.state = arrived ? 'idle' : 'walk'; }
  }
  if (target && inRange) {
    h.state = 'attack';
    h.facing = target.x >= h.x ? 1 : -1;
    h.atkT += dt;
    const iv = 1 / stats.atkSpd;
    if (h.atkT >= iv) { h.atkT -= iv; performAttack(g, hero, h, cls, stats, target, api); }
  }
}

// 성벽 대신 영웅이 맞는다(도발/근접). src = 때린 적(주로 성벽 반사류 조합에서 쓰는 것과 동일 패턴)
export function heroTakeDamage(g, dmg, api) {
  const h = g.heroUnit;
  if (!h || h.state === 'down' || h.invulnT > 0) return;
  const stats = heroCombatStats(g, g.hero);
  const dealt = dmg * (1 - stats.dmgReduce);
  h.hp -= dealt;
  // 이 피해는 원래 성벽이 받았을 위협이므로 자동 강화의 위험도 판단에도 반영한다(영웅이 막아준다고 봇이 방심하지 않도록)
  g.wallLost += dealt;
  api.emit(g, { type: 'heroHit', x: h.x, y: h.y, dmg });
  if (h.hp <= 0) {
    h.hp = 0;
    h.state = 'down';
    h.respawnT = clamp(6 + h.level * 0.12, 6, 18);
    api.emit(g, { type: 'heroDown', x: h.x, y: h.y });
  }
}

function respawnHero(g, api) {
  const h = g.heroUnit;
  h.x = HERO_GATE.x; h.y = HERO_GATE.y; h.state = 'walk'; h.hp = -1; h.moveTo = null;
  api.emit(g, { type: 'heroRespawn', x: h.x, y: h.y });
}

// 궁극기: 전부 즉발형(연출은 렌더러가 heroUlt 이벤트로 표현) — knight만 지속(무적) 상태를 남긴다
export function castHeroUlt(g, api) {
  const hero = g.hero, h = g.heroUnit;
  if (!hero || !h || h.state === 'down' || h.ultCd > 0) return false;
  const cls = HERO_CLASSES[hero.cls], stats = heroCombatStats(g, hero);
  h.ultCd = cls.ult.cd;
  h.ultT = 0.5;
  api.emit(g, { type: 'heroUlt', cls: hero.cls, x: h.x, y: h.y, r: cls.ult.r || 0 });
  const enemiesIn = r => g.enemies.filter(e => !e.dead && Math.hypot(e.x - h.x, e.y - h.y) <= r);
  switch (hero.cls) {
    case 'knight':
      h.invulnT = cls.ult.dur;
      for (const e of enemiesIn(cls.ult.r)) e.stunT = Math.max(e.stunT || 0, 1.5);
      break;
    case 'ranger':
      for (const e of enemiesIn(cls.ult.r)) heroHit(g, api, e, stats.dmg * 2.2, false);
      break;
    case 'sorcerer':
      for (const e of enemiesIn(cls.ult.r)) heroHit(g, api, e, stats.dmg * 3.5, false);
      break;
    case 'cleric':
      g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * 0.25);
      h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.5);
      for (const e of enemiesIn(cls.ult.r)) heroHit(g, api, e, stats.dmg * 3, false);
      break;
    case 'assassin': {
      const picked = g.enemies.filter(e => !e.dead).sort((a, b) => (b.isBoss ? 1 : 0) - (a.isBoss ? 1 : 0)).slice(0, cls.ult.n);
      for (const e of picked) heroHit(g, api, e, stats.dmg * stats.critMult * 1.6, true);
      break;
    }
  }
  return true;
}

// ── 성장(경험치/레벨업) · 처치 보상(경험치+드롭) ──
export function heroGainXp(g, amt, api) {
  const hero = g.hero;
  if (!hero || !hero.cls || !(amt > 0)) return;
  hero.xp += amt;
  let need = xpToNext(hero.level);
  while (hero.xp >= need && hero.level < MAX_HERO_LV) {
    hero.xp -= need;
    hero.level++;
    const m = milestoneAt(hero.level);
    api.emit(g, { type: 'heroLevelUp', level: hero.level, tier: heroTier(hero.level), milestone: m ? m.key : null });
    need = xpToNext(hero.level);
  }
}

const DROP_CHANCE = { normal: 0.02, elite: 0.35, named: 1 };
export function heroOnKill(g, e, api) {
  const hero = g.hero;
  if (!hero || !hero.cls) return;
  heroGainXp(g, xpForKill(e, g.stage), api);
  const chance = e.named ? DROP_CHANCE.named : e.isBoss ? DROP_CHANCE.elite : DROP_CHANCE.normal;
  if (g.heroRng() < chance) {
    const source = e.named ? 'boss' : e.isBoss ? 'elite' : 'normal';
    lootDrop(g, source, e.x, e.y, api);
  }
}

export function lootDrop(g, source, x, y, api) {
  const hero = g.hero;
  const item = rollItem(g.stage, source, g.heroRng, hero.cls);
  const overflow = addToBag(hero, item);
  if (overflow) g.players[0].gold += sellValue(overflow);
  if (hero.autoEquip) autoEquipAll(hero);
  api.emit(g, { type: 'loot', item, x, y });
}

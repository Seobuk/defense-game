// 상수 · 업그레이드/퍼크 정의 · 비용/효과/보상 공식 (밸런스 수치는 여기와 stages.js에만)
import { fmt } from './util.js';

// ── 월드 ──
export const WORLD_W = 720;
export const WORLD_H = 1100;
export const WALL_Y = 960;          // 성벽 윗면
export const WALL_H = 60;           // 성벽 두께 (960~1020)
export const CANNONS = [{ x: 240, y: 985 }, { x: 480, y: 985 }];
export const DT = 1 / 60;
export const BULLET_SPEED = 1400;   // px/s
export const BULLET_R = 6;
export const GOLD_POS = { x: 70, y: 40 }; // 동전이 날아갈 HUD 위치(월드 좌표)
export const MAX_STAGE = 100;

// ── 인게임 업그레이드 ──
// 마법 판타지 개편(DESIGN.md 최신 사용자 결정): 대포 → 성벽 마법사 2인, 탄환 → 마력 구체. 키는 그대로 유지
export const UPGRADES = [
  { key: 'atk', name: '마력', desc: '마력 구체 데미지 상승' },
  { key: 'rate', name: '시전 속도', desc: '시전 간격 단축 (최대 초당 15회)' },
  { key: 'crit', name: '치명타', desc: '치명타 확률 상승 (최대 80%, 2.5배)' },
  { key: 'multi', name: '다중 시전', desc: '한 번에 여러 발의 마력 구체를 부채꼴로 시전' },
  { key: 'wall', name: '성벽 결계', desc: '성벽에 두른 룬 방어막의 최대 내구력 증가' },
];
export const UPGRADE_KEYS = UPGRADES.map(u => u.key);

// [기본 비용, 레벨당 배율]
const COST = { atk: [6, 1.075], rate: [15, 1.55], crit: [20, 1.5], multi: [60, 13], wall: [8, 1.075] };
export function upgradeCost(stat, lv) {
  const c = COST[stat];
  return Math.ceil(c[0] * c[1] ** lv);
}
const MAX = { rate: 15, crit: 15, multi: 5 };
export const upgradeMax = stat => MAX[stat] ?? Infinity;

const SHOTS = [1, 3, 5, 7, 9, 12];
const SPREAD = [0, 0.35, 0.8, 1.3, 1.9, 2.97]; // 부채꼴 전체 각도(rad), 12발 ≈ 170°
export const CRIT_MULT = 2.5;

export const atkDmg = lv => 10 * (1 + 0.1 * lv) * 1.065 ** lv;
export const fireRate = lv => Math.min(15, 1.5 + 0.9 * lv);
export const critChance = lv => Math.min(0.8, 0.05 + 0.05 * lv);

// 치명타 폭발 퍼크
export const critBoomRadius = lv => (lv > 0 ? 50 + 8 * lv : 0);
export const critBoomRatio = lv => (lv > 0 ? 0.2 + 0.06 * lv : 0);

export function cannonStats(lv, perks = {}) {
  const m = Math.min(5, lv.multi | 0);
  return {
    dmg: atkDmg(lv.atk | 0),
    rate: fireRate(lv.rate | 0),
    crit: critChance(lv.crit | 0),
    critMult: CRIT_MULT,
    shots: SHOTS[m],
    spread: SPREAD[m],
    boomR: critBoomRadius(perks.critBoom | 0),
    boomRatio: critBoomRatio(perks.critBoom | 0),
  };
}

// 성벽 최대 체력: 두 플레이어 wall 레벨 합
export const wallMax = lvSum => Math.floor(150 * (1 + 0.1 * lvSum) * 1.03 ** lvSum);

// UI "현재 → 다음" 표시값. wall은 상대 wall 레벨을 더해 성벽 최대 체력으로 표시
export function statDisplay(stat, lv, partnerWallLv = 0) {
  switch (stat) {
    case 'atk': return fmt(atkDmg(lv));
    case 'rate': return fireRate(lv).toFixed(1) + '/초';
    case 'crit': return Math.round(critChance(lv) * 100) + '%';
    case 'multi': return SHOTS[Math.min(5, lv)] + '발';
    case 'wall': return fmt(wallMax(lv + partnerWallLv));
  }
  return '';
}

// ── 보상 ──
export const goldPerKill = stage => 3 * 1.18 ** (stage - 1);

export function gemReward(stage, stars, firstClear) {
  let g = stars + Math.floor(stage / 10);
  if (firstClear && stage % 10 === 0) g += 20 + stage; // 10층 단위 첫 클리어 대박
  return g;
}

export const starsFor = ratio => (ratio >= 0.7 ? 3 : ratio >= 0.35 ? 2 : 1);

// ── 영구 퍼크 (보석) ──
export const PERKS = [
  { key: 'pickaxe', name: '황금 곡괭이', desc: '오프라인(방치) 골드 보상 증가 (최대 8시간)' },
  { key: 'critBoom', name: '치명타 폭발', desc: '치명타 시 주변 적에게 스플래시 데미지' },
  { key: 'startGold', name: '시작 골드', desc: '스테이지 시작 시 골드 지급' },
];
export const PERK_KEYS = PERKS.map(p => p.key);
const PERK_COST = { pickaxe: [3, 2], critBoom: [4, 3], startGold: [3, 2] };
const PERK_MAX = { pickaxe: 20, critBoom: 10, startGold: 20 };
export const perkCost = (key, lv) => PERK_COST[key][0] + PERK_COST[key][1] * lv;
export const perkMax = key => PERK_MAX[key];

export const startGoldAmount = (stage, lv) => (lv > 0 ? Math.floor(goldPerKill(stage) * 4 * lv) : 0);
export const OFFLINE_CAP_HOURS = 8;
export const offlineGoldPerMin = (best, pickaxeLv) => Math.floor(goldPerKill(Math.max(1, best)) * (3 + 1.5 * pickaxeLv));

// 퍼크 효과 설명(상점 표시용)
export function perkDisplay(key, lv) {
  switch (key) {
    case 'pickaxe': return `분당 처치 ${3 + 1.5 * lv}마리분`;
    case 'critBoom': return lv > 0 ? `반경 ${critBoomRadius(lv)} · ${Math.round(critBoomRatio(lv) * 100)}%` : '없음';
    case 'startGold': return lv > 0 ? `처치 ${4 * lv}마리분` : '없음';
  }
  return '';
}

// ── 비상 스킬 ──
export const SKILLS = {
  meteor: { name: '운석 낙하', cd: 180, bossPct: 0.15 },
  freeze: { name: '빙결', cd: 40, dur: 5 },
};

// ── 중독성 레이어: 콤보 · 광란 · 히든 조합 ──
export const COMBO_WINDOW = 1.5; // 이 시간 안에 다음 처치가 없으면 콤보 끊김
export const COMBO_TIERS = [       // tier 1..4
  { n: 10, label: '좋아!', gold: 1.1 },
  { n: 30, label: '대단해!', gold: 1.25 },
  { n: 50, label: '광란!', gold: 1.5 },
  { n: 100, label: '전설!', gold: 2 },
];
export const FRENZY = { kills: 20, window: 2, dur: 5, rateMul: 2, rateCap: 30 };
export const LEGEND_T = 10;        // 전설의 학살: 골드 2배 지속(초)

// 조합 효과 수치
export const SYN_FX = {
  burn: 0.3, burnT: 2,              // 불꽃: 적중 피해의 30%를 2초에 걸쳐
  pierce: 3,                        // 관통: 최대 3마리
  chainN: 3, chainPct: 0.5, chainR: 180, // 체인: 3마리, 50%, 반경
  homingTurn: 7,                    // 유도: 초당 회전(rad)
  thorns: 20,                       // 요새화: 반사 = 내 탄환 피해 × 20
  giant: 2,                         // 거인 사냥꾼: 엘리트/보스 피해 ×2
  twin: 1.25, golden: 1.5,
  glacierWindow: 3, glacier: 3,     // 빙결 후 3초 안에 상대 운석 → 보스 운석 피해 ×3
  doubleWindow: 1.5, doubleFreeze: 10,
  chainboomKills: 5, goldRain: 5,
  flawlessGem: 1.5,
};

// 히든 조합 도감. test: 대포 조합(lv) / 협동 레벨 조합(a, b). 스킬·이벤트형은 sim이 직접 판정
export const SYNERGIES = [
  { key: 'flame', name: '불꽃 산탄', kind: 'cannon', test: lv => lv.multi >= 2 && lv.crit >= 10,
    hint: '흩어지는 마력에 날카로운 눈이 깃들면, 불씨가 된다.',
    desc: '다중 시전 2 이상 + 치명타 10 이상: 맞은 적이 2초 동안 타오르며 피해의 30%를 더 입는다.' },
  { key: 'pierce', name: '관통탄', kind: 'cannon', test: lv => lv.multi === 0 && lv.atk >= 25,
    hint: '한 발만 고집하는 자의 마력은 멈추지 않는다.',
    desc: '다중 시전 0 + 마력 25 이상: 마력 구체가 적을 최대 3마리까지 꿰뚫는다.' },
  { key: 'chain', name: '체인 라이트닝', kind: 'cannon', test: lv => lv.crit >= 12 && lv.rate >= 12,
    hint: '빠르고 날카로운 손끝에서 번개가 튄다.',
    desc: '치명타 12 이상 + 시전 속도 12 이상: 치명타가 주변 적 최대 3마리에게 50% 피해로 번진다.' },
  { key: 'homing', name: '유도 미사일', kind: 'cannon', test: lv => lv.multi >= 5,
    hint: '하늘을 가득 메운 마력은 스스로 길을 찾는다.',
    desc: '다중 시전 MAX: 마력 구체가 진행 방향의 적을 쫓아간다.' },
  { key: 'thorns', name: '요새화', kind: 'cannon', test: lv => lv.wall >= 25 && lv.wall > lv.atk,
    hint: '창보다 방패를 믿는 자의 성벽엔 가시가 돋는다.',
    desc: '성벽 결계 25 이상이고 마력 레벨보다 높음: 성벽을 때린 적이 내 마력 구체 피해의 20배를 되돌려 받는다.' },
  { key: 'giant', name: '거인 사냥꾼', kind: 'cannon', test: lv => lv.atk >= 60 && lv.crit >= 15,
    hint: '거대한 것일수록 급소도 크다.',
    desc: '마력 60 이상 + 치명타 MAX: 엘리트·보스에게 주는 피해 +100%.' },
  { key: 'glacier', name: '빙하 운석', kind: 'duo',
    hint: '얼음이 녹기 전에 하늘이 무너진다면…',
    desc: '한 마법사의 빙결 후 3초 안에 다른 마법사가 운석: 얼어붙은 적이 산산조각, 보스는 운석 피해 3배.' },
  { key: 'twin', name: '쌍둥이 포화', kind: 'duo', test: (a, b) => a.multi === b.multi && a.multi >= 3,
    hint: '두 마법사가 같은 부채꼴을 펼칠 때.',
    desc: '두 마법사의 다중 시전 레벨이 같고 3 이상: 두 마법사 모두 피해 +25%.' },
  { key: 'golden', name: '황금비', kind: 'duo', test: (a, b) => a.atk === b.atk && a.atk >= 10,
    hint: '두 힘이 한 치의 어긋남 없이 맞물리면 금이 흐른다.',
    desc: '두 마법사의 마력 레벨이 정확히 같고 10 이상: 처치 골드 +50%.' },
  { key: 'double', name: '이중 필살', kind: 'duo',
    hint: '같은 순간, 같은 외침.',
    desc: '두 마법사가 1.5초 안에 같은 비상 스킬 사용: 운석은 두 번 떨어지고 빙결은 10초 지속.' },
  { key: 'chainboom', name: '연쇄 폭발', kind: 'event',
    hint: '불붙은 바위들은 서로를 부른다.',
    desc: '자폭 용암괴 폭발 연쇄로 5마리 이상 처치: 그 처치 골드의 5배가 골드 비로 쏟아진다.' },
  { key: 'flawless', name: '무결점', kind: 'event',
    hint: '성벽에 흠집 하나 없이.',
    desc: '성벽 체력 100%로 스테이지 클리어: 보석 +50%.' },
  { key: 'frenzy', name: '광란', kind: 'event',
    hint: '멈추지 않는 학살은 지팡이를 달군다.',
    desc: '2초 안에 20마리 처치: 5초 동안 시전 속도 2배.' },
  { key: 'legend', name: '전설의 학살', kind: 'event',
    hint: '백 번의 숨이 끊기기 전에.',
    desc: '콤보 100 달성: 10초 동안 처치 골드 2배.' },
];

// ── 판타지 스킬 선택 (스테이지 한정 빌드) ──
export const MANA_MAX = 100;
export const MANA_FRACS = [0.25, 0.55, 0.85]; // 처치 진행률 기준 마나가 가득 차는 지점
export const PICK_AUTO_T = 3;                 // 자동 강화 on일 때 카드 자동 선택까지(초)
export const RARITY_WEIGHT = { common: 60, rare: 32, legend: 8 };

// 스킬 14종 (7원소 × 2). lv[0..2] = Lv1~3 수치, desc[0..2] = Lv별 한국어 설명.
// 피해 관련 mul 은 game.players[0].stats.dmg(공격력) 배율 — 대포가 강해지면 스킬도 강해진다.
export const SPELLS = [
  { key: 'fireball', name: '파이어볼', element: 'fire', rarity: 'rare', icon: '🔥',
    lv: [{ mul: 2.5, r: 100, cd: 3.5 }, { mul: 3.5, r: 120, cd: 3.0 }, { mul: 5, r: 140, cd: 2.5 }],
    desc: ['가장 앞선 적 주변에 3.5초마다 폭발(공격력 250%, 반경 100)',
      '폭발 강화(공격력 350%, 반경 120), 3.0초마다',
      '폭발 최대(공격력 500%, 반경 140), 2.5초마다'] },
  { key: 'flameBullet', name: '불꽃 마탄', element: 'fire', rarity: 'common', icon: '🔥',
    lv: [{ burn: 0.25, dur: 2 }, { burn: 0.4, dur: 2.5 }, { burn: 0.6, dur: 3 }],
    desc: ['내 마력 구체에 맞은 적이 2초간 피해의 25%를 화상으로 추가 입는다',
      '화상 피해 40%, 2.5초', '화상 피해 60%, 3초'] },
  { key: 'lightningStrike', name: '낙뢰', element: 'lightning', rarity: 'common', icon: '⚡',
    lv: [{ mul: 3, n: 1, cd: 2.2 }, { mul: 3.5, n: 2, cd: 2.0 }, { mul: 4, n: 3, cd: 1.8 }],
    desc: ['2.2초마다 무작위 적 1마리에게 낙뢰(공격력 300%)',
      '2마리에게 350%, 2.0초마다', '3마리에게 400%, 1.8초마다'] },
  { key: 'chainLightning', name: '연쇄 번개', element: 'lightning', rarity: 'rare', icon: '⚡',
    lv: [{ chance: 0.25, mul: 0.6, n: 2 }, { chance: 0.35, mul: 0.8, n: 3 }, { chance: 0.5, mul: 1, n: 4 }],
    desc: ['내 마력 구체 명중 시 25% 확률로 번개가 주변 2마리에게 전이(60%)',
      '35% 확률, 3마리, 80%', '50% 확률, 4마리, 100%'] },
  { key: 'iceLance', name: '얼음 창', element: 'frost', rarity: 'common', icon: '❄️',
    lv: [{ mul: 2, cd: 1.8 }, { mul: 2.6, cd: 1.5 }, { mul: 3.4, cd: 1.2 }],
    desc: ['1.8초마다 관통하는 얼음 창 시전(공격력 200%)',
      '260%, 1.5초마다', '340%, 1.2초마다'] },
  { key: 'frostWard', name: '서리 결계', element: 'frost', rarity: 'rare', icon: '❄️',
    lv: [{ r: 260, slow: 0.35 }, { r: 300, slow: 0.5 }, { r: 340, slow: 0.65 }],
    desc: ['성벽 근처(반경 260) 적의 이동속도 35% 감소',
      '반경 300, 50% 감소', '반경 340, 65% 감소'] },
  { key: 'tornado', name: '회오리', element: 'wind', rarity: 'rare', icon: '🌪️',
    lv: [{ mul: 0.8, r: 70, spd: 170, cd: 5 }, { mul: 1.1, r: 85, spd: 180, cd: 4.2 }, { mul: 1.5, r: 100, spd: 190, cd: 3.6 }],
    desc: ['5초마다 토네이도가 올라가며 주변 적을 밀어내고 초당 공격력 80%',
      '4.2초마다, 반경 85, 초당 110%', '3.6초마다, 반경 100, 초당 150%'] },
  { key: 'gale', name: '질풍', element: 'wind', rarity: 'common', icon: '🌪️',
    lv: [{ mul: 0.15 }, { mul: 0.25 }, { mul: 0.4 }],
    desc: ['공격속도 +15%', '공격속도 +25%', '공격속도 +40%'] },
  { key: 'holyLight', name: '수호의 빛', element: 'holy', rarity: 'common', icon: '✨',
    lv: [{ rate: 0.006 }, { rate: 0.012 }, { rate: 0.02 }],
    desc: ['성벽이 매초 최대 체력의 0.6% 재생', '1.2% 재생', '2% 재생'] },
  { key: 'judgment', name: '심판 광선', element: 'holy', rarity: 'rare', icon: '✨',
    lv: [{ mul: 3, w: 50, cd: 4 }, { mul: 4, w: 60, cd: 3.4 }, { mul: 5.5, w: 70, cd: 2.8 }],
    desc: ['4초마다 세로 광선이 폭 50 범위 적에게 공격력 300%',
      '3.4초마다, 폭 60, 400%', '2.8초마다, 폭 70, 550%'] },
  { key: 'curseMark', name: '저주 낙인', element: 'dark', rarity: 'rare', icon: '🌑',
    lv: [{ mul: 0.15 }, { mul: 0.25 }, { mul: 0.4 }],
    desc: ['모든 적이 받는 피해 +15%', '+25%', '+40%'] },
  { key: 'soulHarvest', name: '영혼 수확', element: 'dark', rarity: 'common', icon: '🌑',
    lv: [{ goldMul: 0.2, heal: 0.004 }, { goldMul: 0.35, heal: 0.008 }, { goldMul: 0.5, heal: 0.014 }],
    desc: ['처치 시 골드 +20%, 성벽 최대 체력의 0.4% 회복',
      '골드 +35%, 0.8% 회복', '골드 +50%, 1.4% 회복'] },
  { key: 'babyDragon', name: '새끼 드래곤', element: 'summon', rarity: 'legend', icon: '🐉',
    lv: [{ mul: 2, cd: 2.5, breathT: 0.6 }, { mul: 2.8, cd: 2.1, breathT: 0.7 }, { mul: 3.8, cd: 1.7, breathT: 0.8 }],
    desc: ['따라다니는 새끼 드래곤이 2.5초마다 0.6초간 브레스(초당 공격력 200%)',
      '2.1초마다 0.7초, 초당 280%', '1.7초마다 0.8초, 초당 380%'] },
  { key: 'stoneGolem', name: '돌 골렘', element: 'summon', rarity: 'legend', icon: '🗿',
    lv: [{ hpMul: 0.6 }, { hpMul: 0.9 }, { hpMul: 1.3 }],
    desc: ['성벽 앞에 골렘이 서서 적의 공격을 대신 받는다(체력 성벽 최대치의 60%)',
      '체력 90%', '체력 130%'] },
];
export const SPELL_KEYS = SPELLS.map(s => s.key);
export const SPELL_BY_KEY = Object.fromEntries(SPELLS.map(s => [s.key, s]));

// 융합 효과 수치
export const FUSION_FX = {
  blazeGrow: 6, blazeBurn: 0.3,              // 불꽃 회오리: 반경 초당 성장(px), 화상 비율
  superconduct: 2,                           // 초전도: 얼어붙은/둔화된 적 낙뢰 피해 ×2
  steamMul: 1.5,                             // 증기 폭발: 화상+둔화 적 처치 시 폭발 피해 배율
  stormEyeMul: 3,                            // 폭풍의 눈: 낙뢰 발생 빈도 ×3(쿨타임 ÷3)
  twilightHeal: 0.02,                        // 황혼: 저주 걸린 적 처치 시 회복량(성벽 최대 비율)
  plasmaMul: 0.5,                            // 플라즈마: 파이어볼 폭발 시 연쇄 번개 추가 피해 비율
  ghostDmg: 1.2, ghostSpeed: 500,            // 망령 군단: 유령 피해 배율·이동속도
  guardHeal: 0.01,                           // 수호룡: 브레스 중 성벽·골렘 초당 회복(성벽 최대 비율)
};

const hasSpell = (s, k) => (s[k] || 0) > 0;
const hasAny = (s, ks) => ks.some(k => hasSpell(s, k));
const FIRE = ['fireball', 'flameBullet'], LIGHTN = ['lightningStrike', 'chainLightning'],
  FROST = ['iceLance', 'frostWard'], WIND = ['tornado', 'gale'],
  HOLY = ['holyLight', 'judgment'], DARK = ['curseMark', 'soulHarvest'],
  SUMMON = ['babyDragon', 'stoneGolem'];

// 원소 융합 8종 = 히든 조합. test(game.spells) — 두 원소(또는 특정 스킬)를 함께 가지면 진화
export const FUSIONS = [
  { key: 'blazeTornado', name: '불꽃 회오리', elements: ['fire', 'wind'],
    test: s => hasAny(s, FIRE) && hasSpell(s, 'tornado'),
    hint: '타오르는 바람은 스스로 몸을 불린다.',
    desc: '화염 + 회오리: 토네이도가 불타며 시간이 지날수록 반경이 커진다.' },
  { key: 'superconduct', name: '초전도', elements: ['frost', 'lightning'],
    test: s => hasAny(s, FROST) && hasAny(s, LIGHTN),
    hint: '얼어붙은 살갗에 번개가 파고든다.',
    desc: '냉기 + 번개: 둔화·빙결된 적은 낙뢰 피해를 2배로 받는다.' },
  { key: 'steamBurst', name: '증기 폭발', elements: ['fire', 'frost'],
    test: s => hasAny(s, FIRE) && hasAny(s, FROST),
    hint: '뜨거움과 차가움이 만나면 터진다.',
    desc: '화염 + 냉기: 화상 입고 둔화된 적이 죽으면 주변에 폭발을 일으킨다.' },
  { key: 'stormEye', name: '폭풍의 눈', elements: ['lightning', 'wind'],
    test: s => hasSpell(s, 'lightningStrike') && hasSpell(s, 'tornado'),
    hint: '회오리 속에서 벼락이 길을 찾는다.',
    desc: '낙뢰 + 회오리: 낙뢰가 토네이도 주변에 3배 자주 떨어진다.' },
  { key: 'twilight', name: '황혼', elements: ['holy', 'dark'],
    test: s => hasAny(s, HOLY) && hasAny(s, DARK),
    hint: '빛과 어둠이 함께 저녁을 부른다.',
    desc: '신성 + 암흑: 심판 광선이 저주를 남기고, 저주 걸린 적을 처치하면 성벽이 크게 회복된다.' },
  { key: 'plasma', name: '플라즈마', elements: ['fire', 'lightning'],
    test: s => hasSpell(s, 'fireball') && hasAny(s, LIGHTN),
    hint: '불씨가 번개를 부른다.',
    desc: '파이어볼 + 번개: 폭발이 번개로 이어져 추가 피해를 준다.' },
  { key: 'ghostLegion', name: '망령 군단', elements: ['dark', 'summon'],
    test: s => hasAny(s, DARK) && hasAny(s, SUMMON),
    hint: '죽음은 죽음을 부른다.',
    desc: '암흑 + 소환: 처치한 적이 유령이 되어 다른 적에게 날아가 부딪힌다.' },
  { key: 'guardianDragon', name: '수호룡', elements: ['holy', 'summon'],
    test: s => hasAny(s, HOLY) && hasSpell(s, 'babyDragon'),
    hint: '빛을 두른 날개가 성벽을 감싼다.',
    desc: '신성 + 새끼 드래곤: 브레스가 성벽과 골렘도 함께 치유한다.' },
];
SYNERGIES.push(...FUSIONS.map(f => ({ key: f.key, name: f.name, kind: 'fusion', test: f.test, hint: f.hint, desc: f.desc })));
export const SYN_KEYS = SYNERGIES.map(s => s.key);

export const SPEEDS = [1, 2, 3];
export const SPEED3_UNLOCK = 20; // best ≥ 20 이면 3배속

export const THEMES = [
  { key: 'meadow', name: '슬라임 초원' },
  { key: 'cave', name: '고블린 동굴' },
  { key: 'graveyard', name: '언데드 묘지' },
  { key: 'volcano', name: '화산 용암지대' },
  { key: 'abyss', name: '심연의 마왕성' },
];

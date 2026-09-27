// 상수 · 업그레이드/퍼크 정의 · 비용/효과/보상 공식 (밸런스 수치는 여기와 stages.js에만)
// ── 월드 ──
export const WORLD_W = 720;
export const WORLD_H = 1100;
export const WALL_Y = 960;          // 성벽 윗면
export const WALL_H = 60;           // 성벽 두께 (960~1020)
export const CANNONS = [{ x: 240, y: 985 }, { x: 480, y: 985 }]; // 협동 모드용 두 자리(P1 왼쪽 · P2 오른쪽)
// 솔로: 성벽 위 마법사는 플레이어 한 명, 성벽 중앙에 선다(그림·시전 시작점 모두).
// ponytail: P2(동료)는 협동 모드(g.coop)에서만 깨어난다 — 지금은 늘 솔로라 CANNONS는 잠들어 있다
export const SOLO_MAGE = { x: 360, y: 985 };
export const mageAt = (g, o) => (g && g.coop ? CANNONS[o] || CANNONS[0] : SOLO_MAGE);
export const DT = 1 / 60;
export const BULLET_SPEED = 1400;   // px/s
export const BULLET_R = 6;
export const GOLD_POS = { x: 70, y: 40 }; // 동전이 날아갈 HUD 위치(월드 좌표)
export const MAX_STAGE = 100;
// 전선: 성벽 마법사 사거리의 윗선. 이 선 위(y < FRONT_Y)는 적이 몰려 내려오는 접근로 — 마법사는 선을 넘은 적만 노리고
// (네임드 보스는 어디서든), 적은 접근로를 ENTRY_RUSH배로 빠르게 내려온다. 밀쳐내기도 적을 선 위로 되돌리지 않는다.
// 영웅도 이 선 아래 전장 가운데를 전선으로 싸운다.
// → 적이 스폰 직후 녹지 않고 전장 중앙까지 밀려와, 마법과 영웅 전투가 화면 가운데에서 계속 보인다(DESIGN.md '초반 난이도와 연출')
export const FRONT_Y = 380, ENTRY_RUSH = 2.5;
export const inReach = e => !e.dead && (e.named || e.y >= FRONT_Y);

// ── 마법사 수련 (정비 화면, 골드로 사는 영구 강화) ──
// 도전 중 골드 강화는 없다. 옛 인게임 강화 5종(키 atk/rate/crit/multi/wall 그대로)이 정비 화면의 영구 수련으로 옮겨 왔고,
// 레벨당 효과는 작고 상한은 낮다 — 마법사의 힘은 고른 스킬에서 나온다.
// 비용 = ceil(c0 × (lv + 1)^TRAIN_POW) 골드(다항식 — 도전마다 비슷한 속도로 오르게). per = 레벨당 효과(덧셈)
export const MAGE_TRAINING = [
  { key: 'atk', name: '마력', desc: '마법사의 모든 주문 피해 +4%', max: 25, c0: 20, per: 0.04 },
  { key: 'rate', name: '시전 속도', desc: '기본 주문 시전 속도 +3% · 쿨타임 주문 쿨타임 -2%', max: 15, c0: 30, per: 0.03 },
  { key: 'crit', name: '치명타', desc: '주문 치명타 확률 +1.5%p (치명타 2.5배)', max: 20, c0: 20, per: 0.015 },
  { key: 'multi', name: '다중 시전', desc: '기본 주문 발사체 1 → 3(2레벨) → 5(5레벨) · 쿨타임 주문 연속 시전 확률 +4%', max: 5, c0: 600, per: 0.04 },
  { key: 'wall', name: '성벽 결계', desc: '성벽 최대 내구력 +5%', max: 20, c0: 15, per: 0.05 },
];
export const TRAIN_KEYS = MAGE_TRAINING.map(t => t.key);
export const TRAIN_BY_KEY = Object.fromEntries(MAGE_TRAINING.map(t => [t.key, t]));
export const trainMax = key => TRAIN_BY_KEY[key]?.max ?? 0;
const TRAIN_POW = 2.6, TRAIN_K = 2.2;
export const trainCost = (key, lv) => Math.ceil(TRAIN_K * TRAIN_BY_KEY[key].c0 * (lv + 1) ** TRAIN_POW);
const tr = (key, lv) => TRAIN_BY_KEY[key].per * (lv | 0);

const SHOTS = [1, 1, 3, 3, 3, 5];
const SPREAD = [0, 0, 0.3, 0.3, 0.3, 0.5]; // 부채꼴 전체 각도(rad) — 발사체는 늘 홀수(가운데 한 발이 조준선)
export const CRIT_MULT = 2.5;
const CRIT_BASE = 0.05;
// 쿨타임 주문: 시전 속도 수련 레벨당 쿨타임 cdPer 단축(배율 상한 cdCap = 쿨타임 -40%). 연속 시전은 첫 시전 echoDelay초 뒤
export const SPELL_CAST = { cdPer: 0.02, cdCap: 1 / 0.6, echoDelay: 0.3 };

// 마법사별 고유 기본 주문 — 약한 견제. 마법사 화력의 대부분은 고른 스킬에서 나온다. [0] = 나, [1] = 협동 모드 동료(잠듦)
export const BASIC_RATE = 1.2; // 기본 주문 시전/초(수련 전)
export const BASIC_SPELLS = [
  { key: 'fireball', name: '화염구', desc: '마력 40% 화염구가 작게 폭발해 주변 적에게도 30% 피해', dmg: 0.4, pierce: 1, splashR: 40, splashPct: 0.3 },
  { key: 'frostbolt', name: '서리 화살', desc: '마력 35% 서리 화살이 적 2마리를 꿰뚫고 1.2초간 25% 둔화', dmg: 0.35, pierce: 2, slow: 0.25, slowT: 1.2 },
];

// 층 공명: 도전 중 골드 강화 대신 성벽 마법사의 마력이 층을 오를수록 자연히 오른다.
// 적 체력 기본 곡선(stages.js enemyHp)과 같은 모양이라 층별 난이도는 stages.js DIFF 한 표로 정한다
export function floorPower(stage) {
  const a = Math.min(stage, 31);
  return 10 * 1.19 ** (a - 1) * 1.18 ** (stage - a) * (1 + 8 / 3 * (a - 1) ** 2);
}

// 치명타 폭발 (영구 강화 critBoom) — 모든 주문 치명타(지속 피해 제외)
export const critBoomRadius = lv => (lv > 0 ? 50 + 8 * lv : 0);
export const critBoomRatio = lv => (lv > 0 ? 0.2 + 0.06 * lv : 0);

// lv = 마법사 수련 레벨 {atk,rate,crit,multi,wall}, fx = 런 배율(각성 · 영구 강화), stage = 층(층 공명)
export function cannonStats(lv, fx = {}, stage = 1) {
  const m = Math.min(5, lv.multi | 0);
  return {
    dmg: floorPower(stage) * (1 + tr('atk', lv.atk)) * (fx.atkMul || 1),
    rate: BASIC_RATE * (1 + tr('rate', lv.rate)) * (fx.rateMul || 1),
    crit: CRIT_BASE + tr('crit', lv.crit),
    critMult: CRIT_MULT,
    cdMul: Math.min(SPELL_CAST.cdCap, (1 + SPELL_CAST.cdPer * (lv.rate | 0)) * (fx.rateMul || 1)), // 쿨타임 주문 쿨타임 ÷ cdMul
    echo: tr('multi', m),                                                                             // 쿨타임 주문 연속 시전 확률
    shots: SHOTS[m],
    spread: SPREAD[m],
    boomR: critBoomRadius(fx.critBoom | 0),
    boomRatio: critBoomRatio(fx.critBoom | 0),
  };
}

// 성벽 최대 내구력: 층 공명(적 공격력 곡선 × 완만한 램프) × 성벽 결계 수련 × 런 배율
export const wallBase = stage => 150 * 1.18 ** (stage - 1) * (1 + 0.3 * (stage - 1));
export const wallMax = (stage, wallLv = 0, mul = 1) => Math.floor(wallBase(stage) * (1 + tr('wall', wallLv)) * mul);

// 정비 화면 수련 표시 문구(현재 레벨의 누적 효과)
export function trainDisplay(key, lv) {
  const v = Math.round(tr(key, lv) * 1000) / 10;
  switch (key) {
    case 'atk': return `피해 +${v}%`;
    case 'rate': return `시전 +${v}% · 쿨타임 -${Math.round((1 - 1 / (1 + SPELL_CAST.cdPer * lv)) * 100)}%`;
    case 'crit': return `치명타 ${Math.round((CRIT_BASE + tr('crit', lv)) * 1000) / 10}%`;
    case 'multi': return `${SHOTS[Math.min(5, lv)]}발 · 연속 시전 ${v}%`;
    case 'wall': return `내구력 +${v}%`;
  }
  return '';
}

// ── 보상 ──
// 처치 골드는 영구 재화(정비 화면 마법사 수련) — 층에 따라 완만하게만 오른다
export const goldPerKill = stage => 1 + stage * 0.03;
export const starsFor = ratio => (ratio >= 0.7 ? 3 : ratio >= 0.35 ? 2 : 1);

// 런 보석: 층마다 적립 → 도전 종료(endRun) 때 한 번에 지급
export const RUN_GEMS = {
  floor: s => 1 + Math.floor(s / 15),          // 층 클리어
  first: s => 3 + Math.floor(s / 8),           // 첫 돌파(최고 기록보다 높은 층)
  boss: s => 4 + Math.floor(s / 8),            // 네임드 보스 처치
  best: (prev, now) => (now > prev ? 8 + 3 * (now - prev) : 0), // 신기록 보너스
};

// ── 영구 강화 (보석, 정비 화면) — 편의·구조 강화만. 마력·시전 속도·성벽은 마법사 수련(골드)으로 옮겼다 ──
// 비용 = ceil(c0 × grow^lv). 배율형(per)은 레벨마다 곱연산: (1 + per)^lv
export const META_UPGRADES = [
  { key: 'greed', name: '골드 획득', desc: '처치 골드 증가(마법사 수련 재화)', max: 20, c0: 24, grow: 1.12, per: 0.05 },
  { key: 'wisdom', name: '영웅 경험치', desc: '영웅 경험치 획득 증가', max: 10, c0: 20, grow: 1.2, per: 0.1 },
  { key: 'choice', name: '카드 선택지', desc: '스킬 카드 선택지 +1 (3 → 4장)', max: 1, c0: 150, grow: 1 },
  { key: 'reroll', name: '카드 새로고침', desc: '도전마다 카드 새로고침 +1회', max: 3, c0: 60, grow: 2 },
  { key: 'startSlot', name: '시작 스킬 슬롯', desc: '뽑아 본 스킬 중 골라 Lv1로 들고 시작', max: 2, c0: 100, grow: 2.5 },
  { key: 'revive', name: '부활 결계', desc: '도전마다 1회, 성벽이 무너질 때 50%로 회복', max: 1, c0: 300, grow: 1 },
  { key: 'critBoom', name: '치명타 폭발', desc: '치명타 시 주변 적에게 스플래시 피해', max: 10, c0: 20, grow: 1.25 },
  { key: 'awaken', name: '각성 숙련', desc: '각성 카드(슬롯이 다 찬 뒤의 카드) 효과 +15%', max: 10, c0: 80, grow: 1.35 },
  { key: 'pickaxe', name: '황금 곡괭이', desc: '오프라인(방치) 보상 증가 (최대 8시간)', max: 20, c0: 10, grow: 1.18 },
];
export const META_KEYS = META_UPGRADES.map(m => m.key);
export const META_BY_KEY = Object.fromEntries(META_UPGRADES.map(m => [m.key, m]));
export const metaMax = key => META_BY_KEY[key]?.max ?? 0;
export const metaCost = (key, lv) => Math.ceil(META_BY_KEY[key].c0 * META_BY_KEY[key].grow ** lv);

// 배율형 강화는 레벨마다 곱연산(복리): (1 + per)^lv
export const metaMul = (key, lv) => (1 + (META_BY_KEY[key].per || 0)) ** lv;

// 영구 강화 레벨 → 런에 적용되는 효과(atkMul·rateMul·wallMul은 각성 카드가 곱한다)
export function metaFx(m = {}) {
  const lv = k => m[k] | 0, mul = k => metaMul(k, lv(k));
  return {
    atkMul: 1, rateMul: 1, wallMul: 1, goldMul: mul('greed'),
    xpMul: mul('wisdom'), choices: lv('choice'),
    rerolls: lv('reroll'), startSlots: lv('startSlot'), revive: lv('revive') > 0, critBoom: lv('critBoom'),
    awakenMul: 1 + 0.15 * lv('awaken'),
  };
}

// 상점 표시용 효과 문구
export function metaDisplay(key, lv) {
  const d = META_BY_KEY[key];
  if (!d) return '';
  if (d.per) return `+${Math.round((metaMul(key, lv) - 1) * 100)}%`;
  switch (key) {
    case 'choice': return `카드 ${3 + lv}장`;
    case 'reroll': return `도전마다 ${lv}회`;
    case 'startSlot': return `${lv}칸`;
    case 'revive': return lv > 0 ? '1회 부활' : '없음';
    case 'critBoom': return lv > 0 ? `반경 ${critBoomRadius(lv)} · ${Math.round(critBoomRatio(lv) * 100)}%` : '없음';
    case 'awaken': return `각성 효과 +${lv * 15}%`;
    case 'pickaxe': return `방치 보상 +${lv * 15}%`;
  }
  return '';
}

// 오프라인(방치) 보상: 골드는 런 한정이라 보석(소량) + 영웅 경험치
export const OFFLINE_CAP_HOURS = 8;
export const offlineGemsPerHour = (best, pickaxeLv) => (1 + best / 25) * (1 + 0.15 * pickaxeLv);
export const offlineXpPerMin = (best, pickaxeLv) => (2 + best * 0.4) * (1 + 0.15 * pickaxeLv);

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
  pierce: 2,                        // 관통탄: 기본 주문 관통 +2마리
  chainN: 3, chainPct: 0.5, chainR: 180, // 체인: 3마리, 50%, 반경
  homingTurn: 7,                    // 유도: 초당 회전(rad)
  thorns: 20,                       // 요새화: 반사 = 내 탄환 피해 × 20
  giant: 2,                         // 거인 사냥꾼: 엘리트/보스 주문 치명타 피해 ×2
  shardN: 4, shardR: 140, shardPct: 0.3, // 불꽃 산탄: 화염구 파편 수·반경·피해 비율
  twin: 1.25, golden: 1.5,
  glacierWindow: 3, glacier: 3,     // 빙결 후 3초 안에 상대 운석 → 보스 운석 피해 ×3
  doubleWindow: 1.5, doubleFreeze: 10,
  chainboomKills: 5, goldRain: 5,
  flawlessGem: 1.5,
};

// 히든 조합 도감. test: 대포 조합(lv) / 협동 레벨 조합(a, b). 스킬·이벤트형은 sim이 직접 판정
export const SYNERGIES = [
  { key: 'flame', name: '불꽃 산탄', kind: 'cannon', test: lv => lv.multi >= 2 && lv.crit >= 8,
    hint: '흩어지는 마력에 날카로운 눈이 깃들면, 불씨가 된다.',
    desc: '수련 다중 시전 2 이상 + 치명타 8 이상: 화염구가 터지며 불꽃 파편이 주변 적에게 흩어지고, 기본 주문에 맞은 적은 2초 동안 피해의 30%를 더 입는다.' },
  { key: 'pierce', name: '관통탄', kind: 'cannon', test: lv => lv.multi === 0 && lv.atk >= 15,
    hint: '한 발만 고집하는 자의 마력은 멈추지 않는다.',
    desc: '수련 다중 시전 0 + 마력 15 이상: 기본 주문이 적을 2마리 더 꿰뚫는다.' },
  { key: 'chain', name: '체인 라이트닝', kind: 'cannon', test: lv => lv.crit >= 12 && lv.rate >= 10,
    hint: '빠르고 날카로운 손끝에서 번개가 튄다.',
    desc: '수련 치명타 12 이상 + 시전 속도 10 이상: 주문 치명타가 주변 적 최대 3마리에게 50% 피해로 번진다.' },
  { key: 'homing', name: '유도 미사일', kind: 'cannon', test: lv => lv.multi >= 5,
    hint: '하늘을 가득 메운 마력은 스스로 길을 찾는다.',
    desc: '수련 다중 시전 MAX: 기본 주문이 진행 방향의 적을 쫓아간다.' },
  { key: 'thorns', name: '요새화', kind: 'cannon', test: lv => lv.wall >= 15 && lv.wall > lv.atk,
    hint: '창보다 방패를 믿는 자의 성벽엔 가시가 돋는다.',
    desc: '수련 성벽 결계 15 이상이고 마력 레벨보다 높음: 성벽을 때린 적이 내 주문 피해의 20배를 되돌려 받는다.' },
  { key: 'giant', name: '거인 사냥꾼', kind: 'cannon', test: lv => lv.atk >= 20 && lv.crit >= 20,
    hint: '거대한 것일수록 급소도 크다.',
    desc: '수련 마력 20 이상 + 치명타 MAX: 엘리트·보스에게 주문 치명타가 터지면 피해 +100%.' },
  { key: 'glacier', name: '빙하 운석', kind: 'duo',
    hint: '얼음이 녹기 전에 하늘이 무너진다면…',
    desc: '협동 모드 — 한 마법사의 빙결 후 3초 안에 다른 마법사가 운석: 얼어붙은 적이 산산조각, 보스는 운석 피해 3배.' },
  { key: 'twin', name: '쌍둥이 포화', kind: 'duo', test: (a, b) => a.multi === b.multi && a.multi >= 3,
    hint: '두 마법사가 같은 부채꼴을 펼칠 때.',
    desc: '협동 모드 — 두 마법사의 다중 시전 수련이 같고 3 이상: 두 마법사 모두 피해 +25%.' },
  { key: 'golden', name: '황금비', kind: 'duo', test: (a, b) => a.atk === b.atk && a.atk >= 10,
    hint: '두 힘이 한 치의 어긋남 없이 맞물리면 금이 흐른다.',
    desc: '협동 모드 — 두 마법사의 마력 수련이 정확히 같고 10 이상: 처치 골드 +50%.' },
  { key: 'double', name: '이중 필살', kind: 'duo',
    hint: '같은 순간, 같은 외침.',
    desc: '협동 모드 — 두 마법사가 1.5초 안에 같은 비상 스킬 사용: 운석은 두 번 떨어지고 빙결은 10초 지속.' },
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

// ── 판타지 스킬 선택 (런 전체 누적 빌드) ──
export const MANA_MAX = 100;
export const MANA_FRAC = 0.6;                 // 층마다 처치 진행률 60% 지점에서 마나가 가득 참 → 카드 1장
export const EARLY_FLOORS = 5, EARLY_MARKS = [0.3, 0.7]; // 1~5층은 처치 30%·70%에서 카드 2장(스킬 맛을 빨리)
export const START_CARDS = 1;                 // 도전 시작(1층) 무료 카드
export const SPELL_SLOTS = 6;                 // 스킬 슬롯
export const SPELL_MAX_LV = 6;
export const PICK_AUTO_T = 2;                 // 카드 화면 '자동 선택' ON일 때 추천 카드 자동 선택까지(초). OFF(기본)면 고를 때까지 기다린다
export const RARITY_WEIGHT = { common: 60, rare: 32, legend: 8 };

// 각성 카드: 더 강화할 것도 새로 넣을 것도 없을 때만 나오는 소폭 스탯 카드. 런 동안 누적
export const AWAKENINGS = [
  { key: 'power', name: '각성: 마력', desc: '마력 +5%', atk: 0.05 },
  { key: 'haste', name: '각성: 시전 속도', desc: '시전 속도 +3%', rate: 0.03 },
  { key: 'ward', name: '각성: 성벽 결계', desc: '성벽 최대 내구력 +8%', wall: 0.08 },
  { key: 'fortune', name: '각성: 황금', desc: '처치 골드 +6%', gold: 0.06 },
];
export const AWAKEN_KEYS = AWAKENINGS.map(a => a.key);
export const AWAKEN_BY_KEY = Object.fromEntries(AWAKENINGS.map(a => [a.key, a]));

// 스킬 14종 (7원소 × 2). lv[0..5] = Lv1~6 수치, desc[0..5] = Lv별 한국어 설명. Lv6 = 만렙(융합 재료 조건)
// 피해 관련 mul 은 시전자 마법사의 stats.dmg(마력) 배율 — 마법사가 강해지면 스킬도 강해진다. 쿨타임(cd)은 시전 속도로 줄어든다.
export const SPELLS = [
  { key: 'fireball', name: '파이어볼', element: 'fire', rarity: 'rare', icon: '🔥',
    lv: [{ mul: 1.2, r: 100, cd: 2.4 }, { mul: 1.7, r: 120, cd: 2.1 }, { mul: 2.4, r: 140, cd: 1.8 }, { mul: 3.1, r: 155, cd: 1.6 }, { mul: 4, r: 170, cd: 1.4 }, { mul: 5, r: 185, cd: 1.25 }],
    desc: ['가장 앞선 적 주변에 2.4초마다 폭발(마력 120%, 반경 100)',
      '폭발 강화(마력 170%, 반경 120), 2.1초마다',
      '폭발 강화(마력 240%, 반경 140), 1.8초마다',
      '폭발 강화(마력 310%, 반경 155), 1.6초마다',
      '폭발 강화(마력 400%, 반경 170), 1.4초마다',
      '폭발 최대(마력 500%, 반경 185), 1.25초마다'] },
  { key: 'flameBullet', name: '불꽃 마탄', element: 'fire', rarity: 'common', icon: '🔥',
    lv: [{ burn: 0.2, dur: 2 }, { burn: 0.28, dur: 2 }, { burn: 0.36, dur: 2.5 }, { burn: 0.45, dur: 2.5 }, { burn: 0.55, dur: 3 }, { burn: 0.65, dur: 3 }],
    desc: ['내 모든 주문에 맞은 적이 2초간 피해의 20%를 화상으로 추가 입는다',
      '화상 피해 28%, 2초', '화상 피해 36%, 2.5초', '화상 피해 45%, 2.5초', '화상 피해 55%, 3초', '화상 피해 65%, 3초'] },
  { key: 'lightningStrike', name: '낙뢰', element: 'lightning', rarity: 'common', icon: '⚡',
    lv: [{ mul: 1.45, n: 1, cd: 1.6 }, { mul: 1.7, n: 2, cd: 1.45 }, { mul: 1.9, n: 3, cd: 1.3 }, { mul: 2.3, n: 4, cd: 1.15 }, { mul: 2.8, n: 5, cd: 1 }, { mul: 3.3, n: 6, cd: 0.9 }],
    desc: ['1.6초마다 적 1마리에게 낙뢰(마력 145%) — 영웅이 싸우는 적을 먼저 노린다',
      '2마리에게 170%, 1.45초마다', '3마리에게 190%, 1.3초마다', '4마리에게 230%, 1.15초마다', '5마리에게 280%, 1.0초마다', '6마리에게 330%, 0.9초마다'] },
  { key: 'chainLightning', name: '연쇄 번개', element: 'lightning', rarity: 'rare', icon: '⚡',
    lv: [{ chance: 0.12, mul: 0.35, n: 2 }, { chance: 0.15, mul: 0.4, n: 3 }, { chance: 0.18, mul: 0.45, n: 3 }, { chance: 0.22, mul: 0.5, n: 4 }, { chance: 0.26, mul: 0.6, n: 4 }, { chance: 0.3, mul: 0.7, n: 5 }],
    desc: ['내 주문 명중 시 12% 확률로 번개가 주변 2마리에게 전이(35%)',
      '15% 확률, 3마리, 40%', '18% 확률, 3마리, 45%', '22% 확률, 4마리, 50%', '26% 확률, 4마리, 60%', '30% 확률, 5마리, 70%'] },
  { key: 'iceLance', name: '얼음 창', element: 'frost', rarity: 'common', icon: '❄️',
    lv: [{ mul: 0.95, cd: 1.3 }, { mul: 1.25, cd: 1.1 }, { mul: 1.6, cd: 0.9 }, { mul: 2.05, cd: 0.75 }, { mul: 2.6, cd: 0.6 }, { mul: 3.2, cd: 0.5 }],
    desc: ['1.3초마다 관통하는 얼음 창 시전(마력 95%) — 영웅이 싸우는 적을 먼저 노린다',
      '125%, 1.1초마다', '160%, 0.9초마다', '205%, 0.75초마다', '260%, 0.6초마다', '320%, 0.5초마다'] },
  { key: 'frostWard', name: '서리 결계', element: 'frost', rarity: 'rare', icon: '❄️',
    lv: [{ r: 260, slow: 0.35 }, { r: 300, slow: 0.5 }, { r: 340, slow: 0.65 }, { r: 370, slow: 0.7 }, { r: 400, slow: 0.75 }, { r: 430, slow: 0.8 }],
    desc: ['성벽 근처(반경 260) 적의 이동속도 35% 감소',
      '반경 300, 50% 감소', '반경 340, 65% 감소', '반경 370, 70% 감소', '반경 400, 75% 감소', '반경 430, 80% 감소'] },
  { key: 'tornado', name: '회오리', element: 'wind', rarity: 'rare', icon: '🌪️',
    lv: [{ mul: 0.4, r: 70, spd: 170, cd: 3.6 }, { mul: 0.55, r: 85, spd: 180, cd: 3 }, { mul: 0.72, r: 100, spd: 190, cd: 2.6 },
      { mul: 0.9, r: 110, spd: 195, cd: 2.3 }, { mul: 1.15, r: 120, spd: 200, cd: 2 }, { mul: 1.4, r: 130, spd: 205, cd: 1.8 }],
    desc: ['3.6초마다 토네이도가 올라가며 주변 적을 밀어내고 초당 마력 40%',
      '3.0초마다, 반경 85, 초당 55%', '2.6초마다, 반경 100, 초당 72%', '2.3초마다, 반경 110, 초당 90%', '2.0초마다, 반경 120, 초당 115%', '1.8초마다, 반경 130, 초당 140%'] },
  { key: 'gale', name: '질풍', element: 'wind', rarity: 'common', icon: '🌪️',
    lv: [{ mul: 0.12 }, { mul: 0.2 }, { mul: 0.3 }, { mul: 0.4 }, { mul: 0.5 }, { mul: 0.6 }],
    desc: ['내 모든 주문 시전 속도 +12%(쿨타임 스킬 포함)', '시전 속도 +20%', '시전 속도 +30%', '시전 속도 +40%', '시전 속도 +50%', '시전 속도 +60%'] },
  { key: 'holyLight', name: '수호의 빛', element: 'holy', rarity: 'common', icon: '✨',
    lv: [{ rate: 0.006 }, { rate: 0.012 }, { rate: 0.02 }, { rate: 0.028 }, { rate: 0.036 }, { rate: 0.044 }],
    desc: ['성벽이 매초 최대 체력의 0.6% 재생', '1.2% 재생', '2% 재생', '2.8% 재생', '3.6% 재생', '4.4% 재생'] },
  { key: 'judgment', name: '심판 광선', element: 'holy', rarity: 'rare', icon: '✨',
    lv: [{ mul: 1.45, w: 50, cd: 2.8 }, { mul: 1.9, w: 60, cd: 2.4 }, { mul: 2.6, w: 70, cd: 2 }, { mul: 3.35, w: 80, cd: 1.8 }, { mul: 4.3, w: 90, cd: 1.6 }, { mul: 5.3, w: 100, cd: 1.45 }],
    desc: ['2.8초마다 세로 광선이 폭 50 범위 적에게 마력 145% — 영웅이 싸우는 적을 먼저 노린다',
      '2.4초마다, 폭 60, 190%', '2.0초마다, 폭 70, 260%', '1.8초마다, 폭 80, 335%', '1.6초마다, 폭 90, 430%', '1.45초마다, 폭 100, 530%'] },
  { key: 'curseMark', name: '저주 낙인', element: 'dark', rarity: 'rare', icon: '🌑',
    lv: [{ mul: 0.15 }, { mul: 0.25 }, { mul: 0.4 }, { mul: 0.55 }, { mul: 0.7 }, { mul: 0.85 }],
    desc: ['모든 적이 받는 피해 +15%', '+25%', '+40%', '+55%', '+70%', '+85%'] },
  { key: 'soulHarvest', name: '영혼 수확', element: 'dark', rarity: 'common', icon: '🌑',
    lv: [{ goldMul: 0.2, heal: 0.004 }, { goldMul: 0.35, heal: 0.008 }, { goldMul: 0.5, heal: 0.014 }, { goldMul: 0.65, heal: 0.018 }, { goldMul: 0.8, heal: 0.024 }, { goldMul: 0.95, heal: 0.03 }],
    desc: ['처치 시 골드 +20%, 성벽 최대 체력의 0.4% 회복',
      '골드 +35%, 0.8% 회복', '골드 +50%, 1.4% 회복', '골드 +65%, 1.8% 회복', '골드 +80%, 2.4% 회복', '골드 +95%, 3% 회복'] },
  { key: 'babyDragon', name: '새끼 드래곤', element: 'summon', rarity: 'legend', icon: '🐉',
    lv: [{ mul: 1.2, cd: 2.5, breathT: 0.6 }, { mul: 1.68, cd: 2.1, breathT: 0.7 }, { mul: 2.28, cd: 1.7, breathT: 0.8 },
      { mul: 2.88, cd: 1.5, breathT: 0.9 }, { mul: 3.6, cd: 1.3, breathT: 1.0 }, { mul: 4.4, cd: 1.15, breathT: 1.1 }],
    desc: ['따라다니는 새끼 드래곤이 2.5초마다 0.6초간 브레스(초당 마력 120%)',
      '2.1초마다 0.7초, 초당 168%', '1.7초마다 0.8초, 초당 228%', '1.5초마다 0.9초, 초당 288%', '1.3초마다 1.0초, 초당 360%', '1.15초마다 1.1초, 초당 440%'] },
  { key: 'stoneGolem', name: '돌 골렘', element: 'summon', rarity: 'legend', icon: '🗿',
    lv: [{ hpMul: 0.6 }, { hpMul: 0.9 }, { hpMul: 1.3 }, { hpMul: 1.7 }, { hpMul: 2.2 }, { hpMul: 2.8 }],
    desc: ['성벽 앞에 골렘이 서서 적의 공격을 대신 받는다(체력 성벽 최대치의 60%)',
      '체력 90%', '체력 130%', '체력 170%', '체력 220%', '체력 280%'] },
];
export const SPELL_KEYS = SPELLS.map(s => s.key);
export const SPELL_BY_KEY = Object.fromEntries(SPELLS.map(s => [s.key, s]));

// 융합 효과 수치
export const FUSION_FX = {
  blazeGrow: 6, blazeBurn: 0.3,              // 불꽃 회오리: 반경 초당 성장(px), 화상 비율
  superconduct: 2,                           // 초전도: 얼어붙은/둔화된 적 낙뢰 피해 ×2
  steamMul: 1.5,                             // 증기 폭발: 화상+둔화 적 처치 시 폭발 피해 배율
  stormEyeMul: 1.5,                          // 폭풍의 눈: 낙뢰 발생 빈도 ×1.5(쿨타임 ÷1.5)
  twilightHeal: 0.02,                        // 황혼: 저주 걸린 적 처치 시 회복량(성벽 최대 비율)
  plasmaMul: 0.5,                            // 플라즈마: 파이어볼 폭발 시 연쇄 번개 추가 피해 비율
  ghostDmg: 1.2, ghostSpeed: 500,            // 망령 군단: 유령 피해 배율·이동속도
  guardHeal: 0.01,                           // 수호룡: 브레스 중 성벽·골렘 초당 회복(성벽 최대 비율)
  cursedAmp: 0.25,                           // 황혼: 저주받은 적이 받는 피해 +25%
  stormZap: 0.35, stormLife: 4, stormPull: 40, // 폭풍의 눈: 벼락 간격(초) · 지속(초) · 끌어당김(px/초)
  firestormLife: 3,                          // 불꽃 회오리 합체 시전: 제자리 지속(초)
};

const hasSpell = (s, k) => (s[k] || 0) > 0;
const hasAny = (s, ks) => ks.some(k => hasSpell(s, k));
const FIRE = ['fireball', 'flameBullet'], LIGHTN = ['lightningStrike', 'chainLightning'],
  FROST = ['iceLance', 'frostWard'], HOLY = ['holyLight', 'judgment'], DARK = ['curseMark', 'soulHarvest'],
  SUMMON = ['babyDragon', 'stoneGolem'];
const L = (keys, rows) => rows[0].map((_, i) => Object.fromEntries(keys.map((k, j) => [k, rows[j][i]])));
// 원소 융합 8종 = 히든 조합이자 **합체 스킬**. groups = 재료 칸 2개(각 칸에서 하나씩, 가진 것 중 레벨이 높은 것)
// 두 재료가 **모두 만렙(Lv6)**이 되는 순간 하나의 융합 스킬 Lv1로 합쳐지고 슬롯 1칸이 열린다(카드로 Lv6까지).
// 융합 스킬은 재료 두 스킬의 효과를 만렙으로 그대로 품고(g.book) 전용 쿨타임 시전(shape)과 조합 효과를 더한다
// → Lv1도 재료 둘보다 조금 세고(합체가 손해가 아니다), Lv6은 확실히 강하다(test 출력 '융합 강도').
export const FUSIONS = [
  { key: 'blazeTornado', name: '불꽃 회오리', elements: ['fire', 'wind'], groups: [FIRE, ['tornado']], icon: '🔥', shape: 'firestorm',
    lv: L(['mul', 'r', 'cd'], [[0.6, 0.9, 1.2, 1.6, 2, 2.5], [95, 105, 115, 125, 140, 160], [4.2, 3.8, 3.4, 3, 2.6, 2.2]]),
    hint: '타오르는 바람은 스스로 몸을 불린다.',
    desc: '화염 + 회오리 합체: 가장 밀집한 무리에 거대한 불꽃 회오리가 3초간 머물며 태운다. 토네이도가 불타며 점점 커진다.',
    lvDesc: ['4.2초마다 불꽃 회오리(반경 95, 초당 마력 60% + 화상)', '3.8초마다, 반경 105, 초당 90%', '3.4초마다, 반경 115, 초당 120%', '3.0초마다, 반경 125, 초당 160%', '2.6초마다, 반경 140, 초당 200%', '2.2초마다, 반경 160, 초당 250% — 하늘까지 닿는 화염 기둥'] },
  { key: 'superconduct', name: '초전도', elements: ['frost', 'lightning'], groups: [FROST, LIGHTN], icon: '⚡', shape: 'thunderFrost',
    lv: L(['mul', 'n', 'cd'], [[2, 2.6, 3.3, 4.2, 5.4, 7], [3, 4, 5, 6, 8, 10], [3, 2.7, 2.4, 2.1, 1.85, 1.6]]),
    hint: '얼어붙은 살갗에 번개가 파고든다.',
    desc: '냉기 + 번개 합체: 얼음 번개가 여러 적을 내리쳐 얼리고, 둔화·빙결된 적은 번개 피해를 2배로 받는다.',
    lvDesc: ['3.0초마다 얼음 번개 3줄기(마력 200%, 둔화 + 0.5초 빙결)', '2.7초마다 4줄기, 260%', '2.4초마다 5줄기, 330%', '2.1초마다 6줄기, 420%', '1.85초마다 8줄기, 540%', '1.6초마다 10줄기, 700%'] },
  { key: 'steamBurst', name: '증기 폭발', elements: ['fire', 'frost'], groups: [FIRE, FROST], icon: '💨', shape: 'steamNova',
    lv: L(['mul', 'r', 'cd'], [[2.5, 3.6, 5, 7, 9.5, 13], [115, 125, 135, 150, 165, 185], [3.4, 3, 2.7, 2.4, 2.1, 1.8]]),
    hint: '뜨거움과 차가움이 만나면 터진다.',
    desc: '화염 + 냉기 합체: 밀집한 무리 한가운데 증기 폭발(화상 + 둔화). 화상 입고 둔화된 적이 죽으면 다시 터진다.',
    lvDesc: ['3.4초마다 증기 폭발(반경 115, 마력 250%)', '3.0초마다, 반경 125, 360%', '2.7초마다, 반경 135, 500%', '2.4초마다, 반경 150, 700%', '2.1초마다, 반경 165, 950%', '1.8초마다, 반경 185, 1300%'] },
  { key: 'stormEye', name: '폭풍의 눈', elements: ['lightning', 'wind'], groups: [['lightningStrike'], ['tornado']], icon: '🌀', shape: 'stormEye',
    lv: L(['mul', 'r', 'cd'], [[0.6, 1.2, 2, 3, 4.3, 6], [135, 150, 165, 180, 195, 215], [5.6, 5.2, 4.7, 4.2, 3.7, 3.2]]),
    hint: '회오리 속에서 벼락이 길을 찾는다.',
    desc: '낙뢰 + 회오리 합체: 4초간 머무는 폭풍의 눈이 적을 끌어당기며 벼락을 쉴 새 없이 떨어뜨린다. 낙뢰가 1.5배 자주 떨어진다.',
    lvDesc: ['5.6초마다 폭풍의 눈(반경 135, 벼락 1회 마력 60%)', '5.2초마다, 반경 150, 120%', '4.7초마다, 반경 165, 200%', '4.2초마다, 반경 180, 300%', '3.7초마다, 반경 195, 430%', '3.2초마다, 반경 215, 600%'] },
  { key: 'twilight', name: '황혼', elements: ['holy', 'dark'], groups: [HOLY, DARK], icon: '🌗', shape: 'eclipse',
    lv: L(['mul', 'w', 'cd'], [[1.2, 2, 3, 4.3, 5.8, 7.4], [95, 110, 125, 140, 155, 175], [3, 2.7, 2.4, 2.1, 1.85, 1.6]]),
    hint: '빛과 어둠이 함께 저녁을 부른다.',
    desc: '신성 + 암흑 합체: 황혼의 광선이 적을 태우고 저주를 남긴다(저주받은 적 피해 +25%). 저주받은 적을 처치하면 성벽이 크게 회복된다.',
    lvDesc: ['3.0초마다 황혼의 광선(폭 95, 마력 120% + 저주)', '2.7초마다, 폭 110, 200%', '2.4초마다, 폭 125, 300%', '2.1초마다, 폭 140, 430%', '1.85초마다, 폭 155, 580%', '1.6초마다, 폭 175, 740%'] },
  { key: 'plasma', name: '플라즈마', elements: ['fire', 'lightning'], groups: [['fireball'], LIGHTN], icon: '🔮', shape: 'plasmaOrb',
    lv: L(['mul', 'r', 'n', 'cd'], [[4, 6, 8.5, 11.5, 15, 20], [105, 115, 125, 140, 155, 175], [4, 5, 6, 7, 8, 10], [2.8, 2.5, 2.2, 2, 1.8, 1.55]]),
    hint: '불씨가 번개를 부른다.',
    desc: '파이어볼 + 번개 합체: 플라즈마 구체가 터지며 번개가 주변 적들로 이어진다. 파이어볼 폭발도 번개를 부른다.',
    lvDesc: ['2.8초마다 플라즈마 폭발(반경 105, 마력 400%) + 번개 4갈래', '2.5초마다, 반경 115, 600%, 5갈래', '2.2초마다, 반경 125, 850%, 6갈래', '2.0초마다, 반경 140, 1150%, 7갈래', '1.8초마다, 반경 155, 1500%, 8갈래', '1.55초마다, 반경 175, 2000%, 10갈래'] },
  { key: 'ghostLegion', name: '망령 군단', elements: ['dark', 'summon'], groups: [DARK, SUMMON], icon: '👻', shape: 'ghostWave',
    lv: L(['mul', 'n', 'cd'], [[1.5, 1.9, 2.4, 3, 3.7, 4.6], [4, 5, 6, 7, 8, 10], [3.8, 3.4, 3, 2.7, 2.4, 2.1]]),
    hint: '죽음은 죽음을 부른다.',
    desc: '암흑 + 소환 합체: 망령의 문이 열려 유령 무리가 적에게 날아가 부딪힌다. 처치한 적도 유령이 된다.',
    lvDesc: ['3.8초마다 유령 4마리(마력 150%씩)', '3.4초마다 5마리, 190%', '3.0초마다 6마리, 240%', '2.7초마다 7마리, 300%', '2.4초마다 8마리, 370%', '2.1초마다 10마리, 460% — 망령의 문이 활짝'] },
  { key: 'guardianDragon', name: '수호룡', elements: ['holy', 'summon'], groups: [HOLY, ['babyDragon']], icon: '🐲', shape: 'dragonDive',
    lv: L(['mul', 'heal', 'cd'], [[1.6, 2.6, 4, 6, 8.5, 12], [0.02, 0.025, 0.03, 0.035, 0.04, 0.05], [3.8, 3.4, 3, 2.7, 2.4, 2.1]]),
    hint: '빛을 두른 날개가 성벽을 감싼다.',
    desc: '신성 + 새끼 드래곤 합체: 수호룡이 전장을 가로질러 강하하며 한 줄을 불태우고 성벽을 치유한다. 브레스도 성벽·골렘을 치유한다.',
    lvDesc: ['3.8초마다 강하(가로 띠 마력 160%, 성벽 2% 회복)', '3.4초마다, 260%, 2.5%', '3.0초마다, 400%, 3%', '2.7초마다, 600%, 3.5%', '2.4초마다, 850%, 4%', '2.1초마다, 1200%, 5%'] },
];
// test = 두 재료 칸을 다 가졌나(짝이 모였다) · ready = 두 재료가 모두 만렙(합체 조건)
const maxed = (s, k) => (s[k] || 0) >= SPELL_MAX_LV;
for (const f of FUSIONS) {
  f.test = s => f.groups.every(gr => hasAny(s, gr));
  f.ready = s => f.groups.every(gr => gr.some(k => maxed(s, k)));
  f.rarity = 'legend';
  f.element = 'fusion';
}
export const FUSION_KEYS = FUSIONS.map(f => f.key);
export const FUSION_BY_KEY = Object.fromEntries(FUSIONS.map(f => [f.key, f]));
// 합체 재료: 칸마다 가진 것 중 레벨이 가장 높은 스킬(같으면 앞 순서)
export function fusionParts(f, s) {
  return f.groups.map(gr => gr.reduce((a, k) => ((s[k] || 0) > (s[a] || 0) ? k : a), gr.find(k => hasSpell(s, k))));
}
// UI(스킬 스택 금빛 연결선 · 툴팁 "불꽃 회오리까지: 화염구 6/6 · 회오리 3/6"): 도감에 오른(발견한) 융합 중
// 아직 없고 재료 두 칸을 다 가진 것의 진행도. spells = g.spells, discovered = Set 또는 배열(g.discovered · meta.discovered)
// → [{ key, parts:[a, b], lv:[la, lb], max }]. 미발견 융합은 드러내지 않는다(카드 ✦ 힌트만)
export function fusionProgress(spells, discovered) {
  const known = discovered instanceof Set ? discovered : new Set(discovered || []);
  const out = [];
  for (const f of FUSIONS) {
    if (spells[f.key] || !known.has(f.key) || !f.test(spells)) continue;
    const parts = fusionParts(f, spells);
    out.push({ key: f.key, parts, lv: parts.map(k => spells[k] | 0), max: SPELL_MAX_LV });
  }
  return out;
}
export const SKILL_BY_KEY = { ...SPELL_BY_KEY, ...Object.fromEntries(FUSIONS.map(f => [f.key, { ...f, desc: f.lvDesc }])) };
SYNERGIES.push(...FUSIONS.map(f => ({ key: f.key, name: f.name, kind: 'fusion', test: f.test, hint: f.hint, desc: f.desc })));

// ── 영웅 × 마법사 협공 (히든 조합 '협공') ──
// 영웅 클래스(+ 일부는 특성 갈래 3점 이상) × 마법사가 가진 스킬(spells 중 하나 — 융합 스킬에 재료로 들어간 것도 인정)이면 켜진다.
// 조건은 숨기고(hint만), 첫 발견은 컷인 + 도감. 수치는 협공 효과 +%(특성 collab)로 커진다.
// unison(합동 필살)은 이벤트형: 영웅 궁극기 3초 안에 마법사 쿨타임 스킬이 발동하면.
export const COLLAB_BRANCH_RANKS = 3;
export const COLLABS = [
  { key: 'anvil', name: '모루와 망치', cls: 'knight', spells: ['fireball', 'tornado'],
    hint: '방패가 붙잡고, 하늘이 내리친다.',
    desc: '기사 + 파이어볼/회오리: 기사가 도발한 적이 받는 성벽 마법사 주문 피해 +25%, 파이어볼이 기사 주변 무리를 우선 노린다.' },
  { key: 'ironLine', name: '철벽 전선', cls: 'knight', spells: ['stoneGolem'],
    hint: '돌과 강철이 어깨를 맞댄다.',
    desc: '기사 + 돌 골렘: 골렘 최대 체력 +45%, 기사가 받는 피해 -30%.' },
  { key: 'frostBastion', name: '서리 방벽', cls: 'knight', spells: ['frostWard', 'iceLance'], branch: 'guard',
    hint: '방패 앞의 땅이 얼어붙는다.',
    desc: '기사(수호 갈래 3점 이상) + 서리 결계/얼음 창: 기사가 도발한 적이 얼어붙듯 느려지고(둔화), 얼음 창 피해 +70%.' },
  { key: 'thunderArrow', name: '뇌전 화살', cls: 'ranger', spells: ['chainLightning', 'lightningStrike'],
    hint: '시위에 번개가 걸린다.',
    desc: '궁수 + 연쇄 번개/낙뢰: 화살이 맞은 적에게서 번개가 주변 2마리로 튄다(화살 피해의 30%).' },
  { key: 'frostShot', name: '빙결 사격', cls: 'ranger', spells: ['iceLance', 'frostWard'],
    hint: '얼어붙은 과녁은 빗나가지 않는다.',
    desc: '궁수 + 얼음 창/서리 결계: 화살에 맞은 적이 둔화되고, 둔화·빙결된 적에게 화살이 항상 치명타.' },
  { key: 'galeArrow', name: '질풍 화살', cls: 'ranger', spells: ['gale', 'tornado'],
    hint: '바람을 등에 업은 화살.',
    desc: '궁수 + 질풍/회오리: 궁수 공격 속도 +15%, 화살 관통 +1.' },
  { key: 'twinFlame', name: '쌍화염', cls: 'sorcerer', spells: ['fireball', 'flameBullet'],
    hint: '두 지팡이 끝에서 같은 불꽃이 핀다.',
    desc: '마법사 영웅 + 화염 스킬: 영웅의 공격마다 착탄 지점에 성벽 마법사의 파이어볼 폭발이 한 번 더 일어난다(125%).' },
  { key: 'stormCall', name: '폭풍 소환', cls: 'sorcerer', spells: ['lightningStrike', 'tornado'], branch: 'arcane',
    hint: '눈보라 속에서 하늘이 울린다.',
    desc: '마법사 영웅(비전 갈래 3점 이상) + 낙뢰/회오리: 영웅 궁극기 범위 안 모든 적에게 성벽 마법사의 낙뢰가 떨어진다.' },
  { key: 'frostEcho', name: '서리 메아리', cls: 'sorcerer', spells: ['iceLance', 'frostWard'],
    hint: '두 겹의 냉기는 뼛속까지 스민다.',
    desc: '마법사 영웅 + 얼음 창/서리 결계: 영웅의 공격이 적을 둔화시키고, 둔화된 적에게 얼음 창 피해 +100%.' },
  { key: 'holyAssault', name: '성광 협공', cls: 'cleric', spells: ['holyLight', 'judgment'],
    hint: '하늘의 빛이 사제의 기도에 답한다.',
    desc: '성직자 + 수호의 빛/심판 광선: 심판 광선이 영웅을 최대 체력 10% 치유하고 피해 +60%, 수호의 빛이 영웅도 치유한다.' },
  { key: 'sanctuary', name: '수호 성벽', cls: 'cleric', spells: ['stoneGolem'],
    hint: '축복받은 돌은 무너지지 않는다.',
    desc: '성직자 + 돌 골렘: 골렘 최대 체력 +45%, 성직자의 회복이 골렘도 치유한다.' },
  { key: 'purgeFlame', name: '정화의 불꽃', cls: 'cleric', spells: ['fireball', 'flameBullet'],
    hint: '성스러운 불은 부정한 것을 태운다.',
    desc: '성직자 + 화염 스킬: 성직자의 공격이 적을 불태우고(피해 40% 화상), 불타는 적에게 영웅 피해 +35%.' },
  { key: 'shadowExec', name: '그림자 처형', cls: 'assassin', spells: ['curseMark'],
    hint: '낙인찍힌 자의 그림자는 짧다.',
    desc: '암살자 + 저주 낙인: 처형 기준이 체력 15%p 올라가고, 체력 30% 이하 보스에게 영웅 피해 +60%.' },
  { key: 'soulHunt', name: '영혼 사냥', cls: 'assassin', spells: ['soulHarvest'],
    hint: '거둔 영혼은 마법사의 손으로 간다.',
    desc: '암살자 + 영혼 수확: 영웅이 적을 처치할 때마다 성벽 마법사의 쿨타임 스킬 대기 시간이 0.9초 줄어든다.' },
  { key: 'unison', name: '합동 필살', cls: null, spells: [],
    hint: '영웅의 외침에 마법사가 답한다.',
    desc: '영웅 궁극기를 쓰고 3초 안에 성벽 마법사의 쿨타임 스킬이 발동하면: 그 스킬이 2배 위력으로 터진다(짧은 슬로 모션).' },
];
export const COLLAB_KEYS = COLLABS.map(c => c.key);
export const COLLAB_BY_KEY = Object.fromEntries(COLLABS.map(c => [c.key, c]));
export const COLLAB_FX = {
  anvil: 0.25, ironLine: 0.3, ironGolem: 0.45, frostBastion: 0.7, thunderArrow: 0.3, galeArrow: 0.15,
  twinFlame: 1.25, frostEcho: 1, holyHeal: 0.1, holyAmp: 0.6, sanctuary: 0.45, purgeBurn: 0.4, purgeAmp: 0.35,
  shadowExec: 0.15, shadowBoss: 0.6, soulHunt: 0.9, procGap: 0.35,
  linkT: 3, linkMul: 2, // 합동 필살: 궁극기 뒤 창(초) · 위력
};
// 켜진 협공인가(g.collabOff = 테스트용 전체 끄기) · 협공 효과 배율(특성 collab)
export const collabOn = (g, key) => !g.collabOff && g.collabs.includes(key);
export const collabPow = g => 1 + (g.heroUnit && g.heroUnit.tb ? g.heroUnit.tb.collab : 0);
SYNERGIES.push(...COLLABS.map(c => ({ key: c.key, name: c.name, kind: 'collab', cls: c.cls, spells: c.spells, branch: c.branch || null, hint: c.hint, desc: c.desc })));
export const SYN_KEYS = SYNERGIES.map(s => s.key);
// 도감에 보이고 세는 조합(융합·협공 push 뒤). ponytail: 협동(duo) 4종은 협동 모드가 생기면 다시 넣는다(솔로에선 발견 불가)
export const CODEX_SYN = SYNERGIES.filter(s => s.kind !== 'duo');
export const codexFound = d => { const s = new Set(d || []); return CODEX_SYN.filter(x => s.has(x.key)).length; };

export const SPEEDS = [1, 2, 3];
export const SPEED3_UNLOCK = 20; // best ≥ 20 이면 3배속

export const THEMES = [
  { key: 'meadow', name: '슬라임 초원' },
  { key: 'cave', name: '고블린 동굴' },
  { key: 'graveyard', name: '언데드 묘지' },
  { key: 'volcano', name: '화산 용암지대' },
  { key: 'abyss', name: '심연의 마왕성' },
];

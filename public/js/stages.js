// 스테이지 → 테마, 적/보스 정의, 스케일링, 스폰 스케줄
import { MAX_STAGE } from './config.js';

export const themeOf = stage => Math.min(4, Math.max(0, Math.floor((stage - 1) / 20)));

// 행동(beh): walk | charger | thrower | shield | bomber
// hp/dmg/gold 는 해당 스테이지 기본값 대비 배율
export const ENEMY_TYPES = {
  slime:       { name: '슬라임',      theme: 0, r: 16, speed: 40, hp: 1,   dmg: 1,   gold: 1,   beh: 'walk' },
  mushroom:    { name: '버섯돌이',    theme: 0, r: 18, speed: 30, hp: 1.8, dmg: 1.2, gold: 1.4, beh: 'walk' },
  goblin:      { name: '고블린',      theme: 1, r: 17, speed: 42, hp: 1,   dmg: 1,   gold: 1,   beh: 'charger' },
  wolf:        { name: '늑대',        theme: 1, r: 16, speed: 66, hp: 0.7, dmg: 0.8, gold: 1,   beh: 'walk' },
  skeleton:    { name: '해골병',      theme: 2, r: 17, speed: 36, hp: 1,   dmg: 1,   gold: 1,   beh: 'walk' },
  boneThrower: { name: '해골 투척병', theme: 2, r: 16, speed: 40, hp: 0.8, dmg: 0.7, gold: 1.2, beh: 'thrower' },
  shieldSkel:  { name: '해골 방패병', theme: 2, r: 19, speed: 30, hp: 1,   dmg: 1.2, gold: 1.5, beh: 'shield' },
  imp:         { name: '불꽃 임프',   theme: 3, r: 16, speed: 46, hp: 0.9, dmg: 1,   gold: 1,   beh: 'walk' },
  bomber:      { name: '자폭 용암괴', theme: 3, r: 18, speed: 40, hp: 0.8, dmg: 1.5, gold: 1.2, beh: 'bomber' },
  demon:       { name: '마족 병사',   theme: 4, r: 18, speed: 44, hp: 1.1, dmg: 1.1, gold: 1,   beh: 'walk' },
  wraith:      { name: '망령 투척수', theme: 4, r: 17, speed: 42, hp: 0.9, dmg: 0.8, gold: 1.2, beh: 'thrower' },
};

// 스테이지 마지막 엘리트 = 테마 대표 몹의 대형판
export const ELITES = ['slime', 'goblin', 'skeleton', 'imp', 'demon'];
export const ELITE = { hp: 12, r: 2.1, dmg: 4, gold: 12, speed: 0.75 };

// 네임드 보스 (10층마다)
export const BOSSES = {
  kingSlime:     { name: '자이언트 킹 슬라임', r: 64, speed: 22, hp: 55, dmg: 6,  gold: 40,  beh: 'kingSlime' },
  goblinChariot: { name: '돌격 고블린 전차',   r: 56, speed: 60, hp: 30, dmg: 14, gold: 50,  beh: 'chariot' },
  lichLord:      { name: '리치 로드',          r: 52, speed: 30, hp: 15, dmg: 4,  gold: 60,  beh: 'lich' },
  magmaGolem:    { name: '마그마 골렘',        r: 66, speed: 20, hp: 42, dmg: 8,  gold: 70,  beh: 'golem' },
  demonLord:     { name: '심연의 마왕',        r: 62, speed: 26, hp: 44, dmg: 8,  gold: 90,  beh: 'demonLord' },
  doomDragon:    { name: '종말의 드래곤',      r: 80, speed: 40, hp: 45, dmg: 14, gold: 150, beh: 'dragon' },
};

export function bossOf(stage) {
  if (stage % 10 !== 0) return null;
  if (stage === 100) return 'doomDragon';
  if (stage === 90) return 'demonLord';
  return ['kingSlime', 'goblinChariot', 'lichLord', 'magmaGolem'][Math.floor((stage - 10) / 20)];
}

// ── 스케일링 ──
const THEME_HP = [1, 1, 1.2, 2.4, 1.6]; // 테마별 난이도 보정
// 잡몹 기본 체력: 1~31층은 제곱 램프(업그레이드 배수 획득 속도에 맞춤), 이후 완만한 지수 성장
export function enemyHp(stage) {
  const a = Math.min(stage, 31);
  return 22 * 1.19 ** (a - 1) * 1.18 ** (stage - a) * (3 + 8 * (a - 1) ** 2) * THEME_HP[themeOf(stage)] * knots(SYN_HP, stage);
}

// 히든 조합(불꽃·체인·쌍둥이·유도·거인 사냥꾼)이 자연히 켜지는 구간의 화력 보정 [스테이지, 배율] 선형 보간
const SYN_HP = [[4, 1], [10, 1.7], [15, 2], [30, 2.4], [50, 2.3], [55, 2.6], [62, 4.4], [100, 5.4]];
// 엘리트·보스는 체인·다중 발사 효과가 덜 먹으므로 따로: 최종 체력 배율 (SYN_HP 대신 적용)
const SYN_BOSS = [[5, 1], [10, 1.1], [20, 1.3], [30, 1.5], [40, 3], [42, 2.3], [50, 2.1], [55, 2.4], [60, 6], [70, 7.5], [80, 6.3], [90, 6.2], [100, 7]];
function knots(k, s) {
  if (s <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (s <= k[i][0]) return k[i - 1][1] + (k[i][1] - k[i - 1][1]) * (s - k[i - 1][0]) / (k[i][0] - k[i - 1][0]);
  }
  return k[k.length - 1][1];
}
export const enemyDmg = stage => 18 * 1.18 ** (stage - 1);
export const enemySpeedMul = stage => (1 + (stage - 1) * 0.008) * (themeOf(stage) === 4 ? 1.1 : 1);
// 엘리트/네임드 체력 배율 보정: 후반일수록 잡몹 대비 배율을 낮춤(단일 대상 화력 한계)
export const bossHpMul = stage => knots(SYN_BOSS, stage) / knots(SYN_HP, stage) / (1 + (stage - 1) / 15);

// 테마별 잡몹 풀: [타입, 가중치, 등장 시작(테마 내 0~19)]
const POOLS = [
  [['slime', 3, 0], ['mushroom', 1, 4]],
  [['goblin', 3, 0], ['wolf', 2, 3]],
  [['skeleton', 3, 0], ['boneThrower', 2, 2], ['shieldSkel', 2, 6]],
  [['imp', 3, 0], ['bomber', 3, 0]],
  [['demon', 3, 0], ['goblin', 1, 0], ['wolf', 1, 0], ['boneThrower', 1, 0], ['shieldSkel', 1, 0], ['bomber', 2, 0], ['wraith', 1, 0]],
];

function pick(pool, k, rng) {
  let sum = 0;
  for (const p of pool) if (k >= p[2]) sum += p[1];
  let x = rng() * sum;
  for (const p of pool) if (k >= p[2] && (x -= p[1]) < 0) return p[0];
  return pool[0][0];
}

// → { theme, total, spawns:[{ t, type, x, elite?, boss? }] } (t 오름차순)
export function buildStage(stage, rng) {
  stage = Math.min(MAX_STAGE, Math.max(1, stage | 0));
  const th = themeOf(stage), k = (stage - 1) % 20, abyss = th === 4;
  const boss = bossOf(stage);
  const trash = 29 + k;               // 잡몹 29~48 + 엘리트 (+ 보스)
  const dur = boss ? 66 : 56 + k * 0.8; // 마지막 등장 시각(초)
  const end = dur - (boss ? 28 : 5);  // 잡몹 러시 종료 시각 (보스 층은 보스를 일찍)
  // 버스트(몰려오기) 단위로 나눔. 심연은 더 큰 덩어리
  const lo = abyss ? 6 : 3, hi = abyss ? 10 : 6;
  const bursts = [];
  for (let left = trash; left > 0;) {
    const n = Math.min(left, lo + Math.floor(rng() * (hi - lo + 1)));
    bursts.push(n);
    left -= n;
  }
  const gap = (end - 1) / Math.max(1, bursts.length - 1);
  const spawns = [];
  bursts.forEach((n, bi) => {
    const t0 = 1 + bi * gap;
    for (let j = 0; j < n; j++) {
      spawns.push({ t: t0 + j * (abyss ? 0.18 : 0.35), type: pick(POOLS[th], k, rng), x: 50 + rng() * 620 });
    }
  });
  spawns.push({ t: boss ? dur - 26 : dur, type: ELITES[th], x: 200 + rng() * 320, elite: true });
  if (boss) spawns.push({ t: dur - 20, type: boss, x: 360, boss: true });
  spawns.sort((a, b) => a.t - b.t);
  return { theme: th, total: spawns.length, spawns };
}

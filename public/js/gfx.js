// 그래픽 품질(설정 '그래픽'): 자동(기본) · 높음 · 보통 · 절전 — 폰 발열·배터리 (DOM·캔버스 없음, node 테스트 가능)
// 단계마다: fps 상한 · 캔버스 해상도(DPR) 상한 · 연출 예산 fx(입자·빛 배율, 1 = 전부) · 배경 잔입자
// 발열 2차: 폰에서 미지근하게 — 화질보다 발열 우선. 60fps 는 높음만, 보통 45 · 절전 30. 전장 해상도는 보통 1.25 · 절전 1(CSS 로 키움 —
// 글자 HUD 는 DOM 이라 선명). 자동: 폰(터치 + 좁은 화면)은 보통, 그 밖(태블릿·데스크톱)은 높음에서 시작해 전투가 계속 무거우면 한 단계씩 내린다.
// 한 판 안에선 올리지 않는다(오르내림 반복 = 끊김·발열) — 배운 단계는 settings.gfxAuto 에 남고, 설정에서 '자동'을 다시 누르면 시작 단계부터 다시 잰다.
// 절전은 앱을 켤 때마다 보통부터 다시(autoStart). 폰이 충전 중이거나 배터리 20% 이하면 자동은 절전(main.js — navigator.getBattery 지원 시만).
export const GFX_KEYS = ['auto', 'high', 'mid', 'low'];
export const GFX_NAME = { auto: '자동', high: '높음', mid: '보통', low: '절전' };
export const GFX_HELP = { // 설정 화면 설명(지금 단계)
  high: '60fps · 선명한 해상도 · 연출 전부 — 가장 뜨거워요',
  mid: '45fps · 해상도와 입자를 줄여 덜 뜨거워요',
  low: '30fps · 낮은 해상도 · 반복 장식 멈춤 — 배터리·발열 최소',
};
export const GFX = {
  high: { fps: 60, dpr: 2, fx: 1 },
  mid: { fps: 45, dpr: 1.25, fx: 0.6 },
  low: { fps: 30, dpr: 1, fx: 0.35 },
};
const DOWN = { high: 'mid', mid: 'low', low: 'low' };

// 자동의 기본 시작 단계: 폰은 보통(높음은 직접 고를 때만), 큰 화면은 높음
const first = phone => (phone ? 'mid' : 'high');
// 설정값 → 실제 단계
export const levelOf = (setting, learned, phone = false) => (GFX[setting] ? setting : GFX[learned] ? learned : first(phone));
// 자동의 이번 실행 시작 단계: 배운 단계, 단 절전은 보통부터 다시 잰다 — 한 번 무거웠던 판(또는 데워진 폰) 때문에 영영 30fps·저해상도로 묶이지 않게
export const autoStart = (learned, phone = false) => (learned === 'low' ? 'mid' : levelOf('auto', learned, phone));
// 3배속: 시뮬이 한 프레임에 3배로 돌아 프레임이 무겁다 → 높음이 아니면 30fps 로 그린다(시뮬은 그대로 — 그리는 횟수만)
export const fpsAt = (g, speed) => (speed >= 3 && g.fps < 60 ? Math.min(g.fps, 30) : g.fps);

// 자동 조절기: 전투가 실제로 그려지는 프레임만 sample(작업 ms, 프레임 간격 ms). 반환 = 새 단계(바뀐 순간만) 또는 null
// 창(WIN_MS 동안의 프레임)마다 판정, 무거운 창이 BAD_WINS 번 연달아면 한 단계 내림
// · 높음 → 보통: 작업 중앙값 > WORK_MS(굽기·GC 같은 한두 프레임 튐은 중앙값에 묻힌다) 또는 목표 fps 미달
// · 보통 → 절전: 상한의 90%(45fps 면 40.5fps) 미달 또는 작업 중앙값 > MID_WORK_MS(45fps 예산의 70% — 코어가 거의 쉬지 못한다).
//   상한을 못 채우는 폰은 메인 스레드가 포화 — 상한이 아껴 주는 게 없어 35fps 로 버텨도 발열은 그대로다(높음은 그대로 43fps 기준)
export const WIN_MS = 2000, BAD_WINS = 3;
export const WORK_MS = 12;  // 프레임 JS 작업 중앙값이 이보다 크면(60fps 예산의 70% 이상) 코어가 쉬지 못한다 = 발열
export const MID_WORK_MS = 16; // 보통(45fps, 22ms 간격)의 같은 기준
export const SLOW_K = 1.4;  // 평균 프레임 간격 > 목표 간격 × 1.4(60fps 목표면 43fps, 45fps 목표면 32fps 미만) = 목표 fps 를 못 지킨다.
                            // 평균(= 실제 fps): 90Hz 화면의 60fps 는 11/22ms 가 번갈아 중앙값이 22ms 로 튄다 · 90Hz 에서 한 칸 걸러(45fps)도 무겁다고 하지 않는다
export const SAT_K = 1 / 0.9; // 보통: 평균 간격 > 상한 간격 × 1.11 = 상한을 못 채운다(포화). 60·90·120Hz 화면의 45fps·30fps 박자는 평균이 상한 그대로라 걸리지 않는다
export function createGovernor(start = 'high') {
  let level = GFX[start] ? start : 'high', work = [], acc = 0, bad = 0, cap = 1e9;
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
  return {
    get level() { return level; },
    reset() { work = []; acc = 0; cap = 1e9; }, // 전투가 멈추면(일시정지·정비) 창을 비운다 — 연속된 전투 시간만 잰다
    sample(workMs, gapMs, fps = GFX[level].fps) { // fps = 이번 프레임의 상한(3배속은 fpsAt 로 낮다 — 일부러 늦춘 걸 무겁다고 보지 않는다)
      if (level === 'low') return null;
      work.push(workMs); acc += Math.min(gapMs, 250); cap = Math.min(cap, fps);
      if (acc < WIN_MS) return null;
      const heavy = med(work) > (level === 'high' ? WORK_MS : MID_WORK_MS) || acc / work.length > (1000 / cap) * (level === 'high' ? SLOW_K : SAT_K);
      work = []; acc = 0; cap = 1e9;
      bad = heavy ? bad + 1 : 0;
      if (bad < BAD_WINS) return null;
      bad = 0;
      level = DOWN[level];
      return level;
    },
  };
}

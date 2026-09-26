// 월드 — 5개 테마 배경(+여백 BLEED)·주변 입자·성벽(테마 스킨·결계·균열·가시·체력바)·두 마법사 단·영웅 성문·보물상자·동전·장비 드롭 빛기둥.
// docs/ART.md §2.2, §9.6, §10.2, §10.18
// 소유: 월드 에이전트. 계약(아래 export 목록과 render.js 호출 순서)은 docs/ART.md §14 참고.
import { WORLD_W, WORLD_H, WALL_Y, CANNONS } from '../config.js';
import { fmt, clamp } from '../util.js';
import {
  TAU, bake, tint, circ, ell, rrect, fs, rad, lin, poly, shine, mulberry, cache, RARITY_COL, TIER_RARITY, BAG_POS, GOLD_POS, OWN,
  ctx, T, RT, topExtra,
  shake, flash, rnd, easeBack, pool, take,
  wt, place, spr, txt, rr, additive, groundRune,
} from './core.js';
import { gl, part, burst, ring, sprPop, K_STAR, K_SPARK, K_SMOKE, K_DEBRIS, soft, runeCircle, runeBand, starFlash, beamSpr, rays } from './fx.js';
import { itemIcon, MAGE_FEET } from './units.js';

// 테마별 주변 입자: 색, 개수, 상승 속도
const AMB = [
  { col: '#fff8c0', n: 24, vy: -6 }, { col: '#8fe8ff', n: 22, vy: -4 }, { col: '#b8ff7a', n: 20, vy: -3 },
  { col: '#ff8a2a', n: 34, vy: -55 }, { col: '#c080ff', n: 28, vy: -22 },
];
const COINS = pool(180, () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, t: 0, dur: 0, fly: false, sx: 0, sy: 0, gy: 0, spin: 0 }));
const LOOTS = pool(10, () => ({ on: false, t: 0, x: 0, y: 0, item: null, cls: 'knight', hold: 1.2, ri: 0 }));
const SPIKES = pool(16, () => ({ life: 0, x: 0 }));
let amb = [], ambTheme = -1;
let wallFlash = 0, wallShake = 0, wallLag = 1;
let coinsArrived = 0;
// 이번 프레임에 HUD에 도착한 동전 수 (효과음용) — render.js 가 frame() 반환값으로 넘긴다
export const takeCoinsArrived = () => { const n = coinsArrived; coinsArrived = 0; return n; };

// ═════════════ 텍스처 (오프스크린 캐시) ═════════════
export function coin() {
  return bake('coin', 9, 9, x => {
    circ(x, 0, 0, 8);
    fs(x, rad(x, 0, 0, 0, 8, [[0, '#fff6b0'], [0.6, '#ffc83a'], [1, '#d08a10']], -3, -3), 1.4, '#7a4a08');
    circ(x, 0, 0, 5); x.lineWidth = 1; x.strokeStyle = 'rgba(150,90,10,0.8)'; x.stroke();
    x.fillStyle = '#b87810'; x.fillRect(-1, -3, 2, 6);
    shine(x, -3, -3.5, 2.4, 1.2, -0.7, 0.9);
  });
}

// ── 성벽 (테마 5종 스킨, ART.md §10.18) ──
const WALL_TOP = 960, WALL_BOT = 1020, MERLON = 18;
const wallHW = 380, wallHH = (WALL_BOT - WALL_TOP + MERLON) / 2 + 4;
export const WALL_CY = WALL_TOP - MERLON + wallHH - 2; // 스프라이트 중심 y (월드)
// 테마별 벽 재질: 본체 밝음/중간/어둠 + 소품 색
const WALL_SKIN = [
  { hi: '#d9c99a', mid: '#b8a06a', lo: '#7a6440', line: 'rgba(60,44,20,0.5)' },   // 초원: 나무 난간
  { hi: '#9a8ec0', mid: '#6a5a94', lo: '#3a2f62', line: 'rgba(20,12,40,0.55)' },  // 동굴: 수정 박힌 돌
  { hi: '#9ab0a4', mid: '#6e8478', lo: '#3e4e46', line: 'rgba(15,25,20,0.55)' },  // 묘지: 이끼 돌
  { hi: '#5a4a4a', mid: '#302428', lo: '#140e12', line: 'rgba(255,110,30,0.35)' }, // 화산: 흑요석
  { hi: '#6a5a8a', mid: '#3a2e5e', lo: '#1c1436', line: 'rgba(217,164,65,0.45)' }, // 마왕성: 금장 흑석
];
export function wall(theme = 0) {
  const sk = WALL_SKIN[theme] || WALL_SKIN[0];
  return bake('wall|' + theme, wallHW, wallHH, x => {
    x.translate(-360, -WALL_CY);
    const rnd = mulberry(7);
    // 톱니(흉벽)
    for (let mx = -20; mx < 740; mx += 72) {
      rrect(x, mx, WALL_TOP - MERLON, 46, MERLON + 8, 3);
      fs(x, lin(x, 0, WALL_TOP - MERLON, 0, WALL_TOP, [[0, sk.hi], [1, sk.mid]]), 2.5, '#20180f');
    }
    // 본체
    x.fillStyle = lin(x, 0, WALL_TOP, 0, WALL_BOT, [[0, sk.hi], [0.18, sk.mid], [1, sk.lo]]);
    x.fillRect(-20, WALL_TOP, 760, WALL_BOT - WALL_TOP);
    x.fillStyle = 'rgba(255,255,255,0.3)';
    x.fillRect(-20, WALL_TOP, 760, 4);
    // 벽돌(석재 결)
    x.strokeStyle = sk.line; x.lineWidth = 1.6;
    const rows = [WALL_TOP + 6, WALL_TOP + 24, WALL_TOP + 42, WALL_BOT];
    for (let i = 0; i < rows.length - 1; i++) {
      x.beginPath(); x.moveTo(-20, rows[i]); x.lineTo(740, rows[i]); x.stroke();
      for (let bx = -20 + (i % 2) * 24; bx < 740; bx += 48) {
        x.beginPath(); x.moveTo(bx, rows[i]); x.lineTo(bx, rows[i + 1]); x.stroke();
        const sh = rnd() * 0.12 - 0.06;
        x.fillStyle = sh > 0 ? `rgba(255,255,255,${sh})` : `rgba(0,0,0,${-sh})`;
        x.fillRect(bx + 1, rows[i] + 1, 46, rows[i + 1] - rows[i] - 2);
      }
    }
    // 테마 소품
    if (theme === 0) { // 나무 난간 + 담쟁이
      x.fillStyle = '#5a3c1e'; x.fillRect(-20, WALL_TOP - MERLON - 6, 760, 6);
      x.fillStyle = 'rgba(70,150,50,0.75)';
      for (let k = 0; k < 20; k++) {
        const vx = rnd() * 720, vy = WALL_TOP + 4 + rnd() * 40;
        for (let s = 0; s < 4; s++) { circ(x, vx + (rnd() - 0.5) * 10, vy + s * 8, 4 + rnd() * 3); x.fill(); }
      }
    } else if (theme === 1) { // 박힌 수정
      for (let k = 0; k < 10; k++) {
        const cx = 20 + rnd() * 680, cy = WALL_TOP + 10 + rnd() * 30, s = 5 + rnd() * 4;
        poly(x, [cx, cy - s, cx + s * 0.7, cy, cx, cy + s, cx - s * 0.7, cy]);
        fs(x, rnd() < 0.5 ? '#7ff2ff' : '#c08bff', 1.2, 'rgba(10,10,30,0.7)');
      }
    } else if (theme === 2) { // 이끼 + 해골 장식
      x.fillStyle = 'rgba(100,150,80,0.4)';
      for (let k = 0; k < 16; k++) { ell(x, rnd() * 720, WALL_TOP + rnd() * 55, 10 + rnd() * 14, 4 + rnd() * 4); x.fill(); }
      for (let mx = 16; mx < 720; mx += 144) {
        circ(x, mx, WALL_TOP - MERLON / 2 - 2, 6);
        fs(x, '#e8e2c8', 1.2, '#2a2a20');
        x.fillStyle = '#2a2a20'; x.fillRect(mx - 2.6, WALL_TOP - MERLON / 2 - 3, 1.6, 2); x.fillRect(mx + 1, WALL_TOP - MERLON / 2 - 3, 1.6, 2);
      }
    } else if (theme === 3) { // 균열 발광(흑요석)
      x.strokeStyle = 'rgba(255,120,30,0.7)'; x.lineWidth = 1.6;
      for (let k = 0; k < 9; k++) {
        let px = 20 + rnd() * 680, py = WALL_TOP + rnd() * 10;
        x.beginPath(); x.moveTo(px, py);
        for (let s = 0; s < 3; s++) { px += (rnd() - 0.5) * 24; py += 8 + rnd() * 8; x.lineTo(px, Math.min(WALL_BOT - 2, py)); }
        x.stroke();
      }
    } else { // 금장 라인(마왕성)
      x.strokeStyle = 'rgba(217,164,65,0.8)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(-20, WALL_TOP + 8); x.lineTo(740, WALL_TOP + 8); x.stroke();
      for (let mx = 16; mx < 720; mx += 72) { x.fillStyle = '#d9a441'; circ(x, mx, WALL_TOP - MERLON / 2 - 2, 3.6); x.fill(); }
    }
    // 밑동 그림자
    x.fillStyle = 'rgba(0,0,0,0.35)';
    x.fillRect(-20, WALL_BOT - 3, 760, 3);
  });
}
export function wallTint(theme = 0) { return tint(wall(theme), 'wall|' + theme + '|r', '#ff2a2a', 0.55); }
// 균열 1..3 (누적, 테마 무관 — 검은 잔해라 어느 스킨에도 얹힌다)
export function cracks(level) {
  return bake('crack|' + level, wallHW, wallHH, x => {
    x.translate(-360, -WALL_CY);
    const rnd = mulberry(99);
    const n = [0, 5, 10, 17][level];
    for (let k = 0; k < n; k++) {
      let px = 30 + rnd() * 660, py = WALL_TOP + rnd() * 20;
      x.beginPath(); x.moveTo(px, py);
      for (let s = 0; s < 5; s++) { px += (rnd() - 0.5) * 22; py += 5 + rnd() * 8; x.lineTo(px, Math.min(WALL_BOT, py)); }
      x.lineWidth = 3.2; x.strokeStyle = 'rgba(20,14,10,0.85)'; x.stroke();
      x.lineWidth = 1; x.strokeStyle = 'rgba(255,255,255,0.25)'; x.stroke();
    }
    if (level >= 3) { // 떨어져 나간 톱니
      x.fillStyle = 'rgba(30,24,18,0.7)';
      for (let k = 0; k < 4; k++) poly(x, [60 + k * 170, WALL_TOP - 18, 90 + k * 170, WALL_TOP - 18, 80 + k * 170, WALL_TOP - 4]), x.fill();
    }
  });
}

// ── 마법사 단 · 영웅 성문 (성벽 앞 바닥, ART.md 원문: P1/P2 시전 단 + 룬 마법진, 영웅의 단) ──
function platform(theme, side) {
  const sk = WALL_SKIN[theme] || WALL_SKIN[0], acc = side < 0 ? OWN[0].c : side > 0 ? OWN[1].c : '#e8d9ff';
  const w = 62;
  return bake('plat|' + theme + '|' + side, w, w, x => {
    x.translate(-w, -w);
    ell(x, w, w * 1.62, w * 0.92, w * 0.34); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fill();
    ell(x, w, w, w * 0.92, w * 0.34);
    fs(x, rad(x, w, w - 6, 2, w, [[0, sk.hi], [0.6, sk.mid], [1, sk.lo]]), 2.4, '#140e12');
    x.strokeStyle = acc; x.lineWidth = 1.6; x.globalAlpha = 0.85;
    ell(x, w, w, w * 0.68, w * 0.25); x.stroke();
    ell(x, w, w, w * 0.42, w * 0.155); x.stroke();
    x.globalAlpha = 1;
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6; circ(x, w + Math.cos(a) * w * 0.68, w + Math.sin(a) * w * 0.25, 2.2); x.fillStyle = acc; x.fill(); }
  });
}
function heroGatePlatform(theme) {
  const sk = WALL_SKIN[theme] || WALL_SKIN[0];
  const w = 74;
  return bake('plat|hero|' + theme, w, w, x => {
    x.translate(-w, -w);
    ell(x, w, w * 1.55, w * 1.05, w * 0.36); x.fillStyle = 'rgba(0,0,0,0.42)'; x.fill();
    ell(x, w, w, w * 1.05, w * 0.36);
    fs(x, rad(x, w, w - 6, 2, w * 1.1, [[0, sk.hi], [0.6, sk.mid], [1, sk.lo]]), 2.8, '#140e12');
    x.strokeStyle = '#e8d9ff'; x.lineWidth = 1.8; x.globalAlpha = 0.9;
    ell(x, w, w, w * 0.78, w * 0.27); x.stroke();
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8; x.beginPath(); x.moveTo(w + Math.cos(a) * w * 0.5, w + Math.sin(a) * w * 0.17); x.lineTo(w + Math.cos(a) * w * 0.78, w + Math.sin(a) * w * 0.27); x.stroke(); }
    x.globalAlpha = 1;
  });
}
// 보물상자 (안뜰 장식 소품, ART.md 원문)
function chest(theme) {
  const sk = WALL_SKIN[theme] || WALL_SKIN[0];
  return bake('chest|' + theme, 24, 20, x => {
    x.translate(-24, -20);
    ell(x, 24, 37, 22, 5); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fill();
    rrect(x, 6, 20, 36, 16, 3); fs(x, lin(x, 0, 20, 0, 36, [[0, sk.hi], [1, sk.lo]]), 2, '#1a1008');
    x.beginPath(); x.moveTo(6, 20); x.quadraticCurveTo(24, 4, 42, 20); x.closePath();
    fs(x, lin(x, 0, 4, 0, 20, [[0, sk.mid], [1, sk.lo]]), 2, '#1a1008');
    x.fillStyle = '#ffc92e'; x.fillRect(21, 4, 6, 30); x.strokeStyle = '#7a4a00'; x.lineWidth = 1; x.strokeRect(21, 4, 6, 30);
    circ(x, 24, 20, 4); x.fillStyle = '#ffe45a'; x.fill(); x.strokeStyle = '#7a4a00'; x.lineWidth = 1.2; x.stroke();
    shine(x, 12, 10, 5, 2.4, -0.6, 0.7);
  });
}

// ── 테마 배경 (월드 720x1100 + 여백 BLEED, 흔들림 대비) ──
export const BLEED = 30;

export function background(theme) {
  const key = 'bg|' + theme;
  if (!cache.has(key)) for (const k of [...cache.keys()]) if (k.startsWith('bg|')) cache.delete(k); // 현재 테마만 보관(메모리)
  return bake(key, 360 + BLEED, 550 + BLEED, x => {
    x.translate(-360, -550);
    const rnd = mulberry(1234 + theme * 77);
    (BG[theme] || BG[0])(x, rnd);
    courtyard(x, theme);
  });
}
// 위 여분(topExtra) 원경 레이어 — 테마별 하늘/먼 배경(§2.2). 세로로 긴 화면에서만 보인다.
// 텍스처 안 좌표계: v=0(맨 위, 가장 먼 곳) ~ v=HH(맨 아래, 지평선/월드 y=0과 만남).
const FAR_HH = 260;
function farBg(theme) {
  const key = 'far|' + theme;
  return bake(key, 360 + BLEED, FAR_HH / 2, x => {
    x.translate(-360, -FAR_HH / 2);
    const rnd = mulberry(555 + theme * 31);
    FAR[theme](x, rnd, FAR_HH);
  });
}

function fillAll(x, stops) {
  x.fillStyle = lin(x, 0, -BLEED, 0, 1100 + BLEED, stops);
  x.fillRect(-BLEED, -BLEED, 720 + BLEED * 2, 1100 + BLEED * 2);
}
function blobs(x, rnd, n, col, rmin, rmax, y0 = -BLEED, y1 = 960) {
  x.fillStyle = col;
  for (let k = 0; k < n; k++) { ell(x, rnd() * 780 - 30, y0 + rnd() * (y1 - y0), rmin + rnd() * (rmax - rmin), (rmin + rnd() * (rmax - rmin)) * 0.6, rnd() * 3); x.fill(); }
}
// 성벽 뒤 안뜰 (1020~1100) + 보물상자
function courtyard(x, theme) {
  const tone = ['#7a7266', '#5e5650', '#5a5c66', '#5a4a44', '#4a3e56'][theme];
  x.fillStyle = tone;
  x.fillRect(-BLEED, 1016, 720 + BLEED * 2, 1100 - 1016 + BLEED);
  x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1.5;
  for (let y = 1030, i = 0; y < 1100 + BLEED; y += 22, i++) {
    x.beginPath(); x.moveTo(-BLEED, y); x.lineTo(720 + BLEED, y); x.stroke();
    for (let bx = -BLEED + (i % 2) * 30; bx < 720 + BLEED; bx += 60) { x.beginPath(); x.moveTo(bx, y); x.lineTo(bx, y + 22); x.stroke(); }
  }
  x.fillStyle = lin(x, 0, 1016, 0, 1060, [[0, 'rgba(0,0,0,0.5)'], [1, 'rgba(0,0,0,0)']]);
  x.fillRect(-BLEED, 1016, 720 + BLEED * 2, 44);
  // 보물상자(장식) — 안뜰 오른쪽 구석(성벽 체력 명판 폭 60~660 밖이라 가려지지 않는다)
  x.save(); x.translate(695, 1060); x.drawImage(chest(theme), -24, -20, 48, 40); x.restore();
}

const BG = [
  // 슬라임 초원 — 밝고 탁한 풀밭(적 대비를 위해 노이즈 절반), 길 뚜렷
  (x, rnd) => {
    fillAll(x, [[0, '#96d67e'], [0.5, '#78c85a'], [1, '#5f9f4e']]);
    blobs(x, rnd, 18, 'rgba(255,255,200,0.06)', 40, 110);
    blobs(x, rnd, 18, 'rgba(30,90,20,0.06)', 40, 120);
    // 흙길
    x.strokeStyle = 'rgba(214,180,120,0.5)'; x.lineWidth = 120;
    x.beginPath(); x.moveTo(300, -BLEED); x.bezierCurveTo(520, 250, 160, 550, 380, 960); x.stroke();
    x.strokeStyle = 'rgba(233,214,164,0.4)'; x.lineWidth = 80; x.stroke();
    for (let k = 0; k < 40; k++) { ell(x, 250 + rnd() * 250, rnd() * 950, 3 + rnd() * 5, 2 + rnd() * 3); x.fillStyle = 'rgba(150,120,80,0.3)'; x.fill(); }
    // 풀(개수 절반)
    for (let k = 0; k < 160; k++) {
      const gx = rnd() * 760 - 20, gy = rnd() * 980, h = 5 + rnd() * 8;
      x.strokeStyle = rnd() < 0.5 ? 'rgba(40,110,30,0.5)' : 'rgba(170,230,110,0.45)';
      x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(gx - 3, gy - h * 0.8); x.lineTo(gx, gy); x.lineTo(gx + 1, gy - h); x.moveTo(gx, gy); x.lineTo(gx + 4, gy - h * 0.7); x.stroke();
    }
    // 꽃
    const pet = ['#ffffff', '#fff27a', '#ff9cc0', '#b8a0ff'];
    for (let k = 0; k < 46; k++) {
      const fx = rnd() * 740 - 10, fy = rnd() * 950, c = pet[(rnd() * 4) | 0];
      x.fillStyle = c;
      for (let p = 0; p < 5; p++) { const a = p * TAU / 5; circ(x, fx + Math.cos(a) * 3, fy + Math.sin(a) * 3, 2.3); x.fill(); }
      circ(x, fx, fy, 1.7); x.fillStyle = '#ffb020'; x.fill();
    }
    // 가장자리 덤불
    for (let k = 0; k < 16; k++) {
      const side = k % 2, bx = side ? 700 + rnd() * 40 : rnd() * 40 - 20, by = rnd() * 950;
      for (let j = 0; j < 4; j++) {
        circ(x, bx + (rnd() - 0.5) * 40, by + (rnd() - 0.5) * 24, 14 + rnd() * 12);
        fs(x, rad(x, bx, by - 10, 2, 34, [[0, '#8ad860'], [1, '#3f7f3c']]), 2, 'rgba(20,70,20,0.55)');
      }
    }
    // 돌
    for (let k = 0; k < 10; k++) {
      const sx = 40 + rnd() * 640, sy = 120 + rnd() * 800;
      ell(x, sx, sy, 8 + rnd() * 8, 5 + rnd() * 5);
      fs(x, rad(x, sx - 3, sy - 3, 1, 14, [[0, '#e0dcd0'], [1, '#8a8478']]), 1.5, 'rgba(50,50,40,0.55)');
    }
  },
  // 고블린 동굴 — 회갈색 → 보라빛 슬레이트
  (x, rnd) => {
    fillAll(x, [[0, '#3a3552'], [0.55, '#4a4260'], [1, '#56506e']]);
    // 자갈 바닥(개수 절반)
    for (let k = 0; k < 130; k++) {
      const cx = rnd() * 780 - 30, cy = rnd() * 990, s = 8 + rnd() * 22, pts = [];
      for (let p = 0; p < 6; p++) { const a = p * TAU / 6 + rnd() * 0.5; pts.push(cx + Math.cos(a) * s * (0.7 + rnd() * 0.3), cy + Math.sin(a) * s * 0.6 * (0.7 + rnd() * 0.3)); }
      poly(x, pts);
      x.fillStyle = `rgba(${100 + rnd() * 30 | 0},${92 + rnd() * 26 | 0},${120 + rnd() * 30 | 0},${0.1 + rnd() * 0.12})`;
      x.fill();
      x.lineWidth = 1; x.strokeStyle = 'rgba(10,6,20,0.3)'; x.stroke();
    }
    // 균열
    x.strokeStyle = 'rgba(10,6,12,0.45)'; x.lineWidth = 2;
    for (let k = 0; k < 14; k++) { let px = rnd() * 720, py = rnd() * 900; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 6; s++) { px += (rnd() - 0.5) * 50; py += rnd() * 30; x.lineTo(px, py); } x.stroke(); }
    // 수정(가장자리 위주 — 중앙 시야는 비움)
    const crystal = (cx, cy, s, col, dark) => {
      circ(x, cx, cy - s, s * 2.4);
      x.fillStyle = rad(x, cx, cy - s, 0, s * 2.4, [[0, col.replace('1)', '0.32)')], [1, 'rgba(0,0,0,0)']]); x.fill();
      for (const [dx, h, a] of [[-0.5, 1.6, -0.35], [0, 2.4, 0], [0.55, 1.4, 0.4]]) {
        x.save(); x.translate(cx + dx * s, cy); x.rotate(a);
        poly(x, [-s * 0.3, 0, -s * 0.3, -h * s * 0.75, 0, -h * s, s * 0.3, -h * s * 0.75, s * 0.3, 0]);
        fs(x, lin(x, -s * 0.3, 0, s * 0.3, 0, [[0, '#ffffff'], [0.4, col], [1, dark]]), 1.5, 'rgba(10,10,30,0.75)');
        x.restore();
      }
    };
    for (let k = 0; k < 9; k++) {
      const side = k % 2, cx = side ? 685 + rnd() * 35 : rnd() * 35, cy = 60 + rnd() * 880;
      crystal(cx, cy, 8 + rnd() * 6, rnd() < 0.5 ? 'rgba(90,220,255,1)' : 'rgba(200,120,255,1)', rnd() < 0.5 ? '#1a4a8a' : '#4a1a8a');
    }
    // 종유석(가장자리)
    for (let k = 0; k < 14; k++) {
      const side = k % 2, bx = side ? 707 + rnd() * 28 : rnd() * 28 + 10, by = rnd() * 950, h = 30 + rnd() * 40;
      poly(x, [bx - 14, by, bx, by - h, bx + 14, by]);
      fs(x, lin(x, bx - 14, 0, bx + 14, 0, [[0, '#7a6a8a'], [1, '#332a48']]), 1.5, 'rgba(0,0,0,0.55)');
    }
    // 횃불 빛웅덩이(§2.2)
    for (const tx of [120, 600]) {
      circ(x, tx, 940, 260);
      x.fillStyle = rad(x, tx, 940, 0, 260, [[0, 'rgba(255,179,71,0.25)'], [1, 'rgba(255,120,40,0)']]); x.fill();
    }
  },
  // 언데드 묘지 — 위장 얼룩 제거, 넓은 안개 띠로 대체(적을 살린다)
  (x, rnd) => {
    fillAll(x, [[0, '#2c4442'], [0.5, '#3a5250'], [1, '#43605c']]);
    circ(x, 600, 60, 260);
    x.fillStyle = rad(x, 600, 60, 0, 260, [[0, 'rgba(214,236,255,0.3)'], [1, 'rgba(160,180,255,0)']]); x.fill();
    // 풀(옅게)
    for (let k = 0; k < 120; k++) {
      const gx = rnd() * 760 - 20, gy = rnd() * 980, h = 4 + rnd() * 7;
      x.strokeStyle = 'rgba(130,160,120,0.3)'; x.lineWidth = 1.3;
      x.beginPath(); x.moveTo(gx - 2, gy - h); x.lineTo(gx, gy); x.lineTo(gx + 3, gy - h * 0.8); x.stroke();
    }
    // 묘비
    const stone = (sx, sy, s, cross) => {
      ell(x, sx, sy + 2, s * 0.9, s * 0.25); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fill();
      if (cross) {
        x.fillStyle = '#9aa6a8'; x.strokeStyle = '#2a2c34'; x.lineWidth = 2;
        x.fillRect(sx - s * 0.12, sy - s * 1.6, s * 0.24, s * 1.6); x.strokeRect(sx - s * 0.12, sy - s * 1.6, s * 0.24, s * 1.6);
        x.fillRect(sx - s * 0.5, sy - s * 1.25, s, s * 0.22); x.strokeRect(sx - s * 0.5, sy - s * 1.25, s, s * 0.22);
      } else {
        x.beginPath(); x.moveTo(sx - s * 0.5, sy); x.lineTo(sx - s * 0.5, sy - s * 0.9); x.arc(sx, sy - s * 0.9, s * 0.5, Math.PI, 0); x.lineTo(sx + s * 0.5, sy); x.closePath();
        fs(x, lin(x, sx - s * 0.5, 0, sx + s * 0.5, 0, [[0, '#b6bcc4'], [1, '#6a6e78']]), 2, '#23252c');
        x.strokeStyle = 'rgba(40,40,50,0.6)'; x.lineWidth = 1.5;
        x.beginPath(); x.moveTo(sx, sy - s * 1.1); x.lineTo(sx, sy - s * 0.45); x.moveTo(sx - s * 0.2, sy - s * 0.9); x.lineTo(sx + s * 0.2, sy - s * 0.9); x.stroke();
      }
      x.fillStyle = 'rgba(90,130,70,0.4)'; ell(x, sx - s * 0.3, sy - 2, s * 0.25, s * 0.1); x.fill();
    };
    for (let k = 0; k < 18; k++) {
      const edge = rnd() < 0.6, sx = edge ? (rnd() < 0.5 ? 20 + rnd() * 90 : 610 + rnd() * 90) : 140 + rnd() * 440;
      stone(sx, 80 + rnd() * 860, 12 + rnd() * 8, rnd() < 0.3);
    }
    // 죽은 나무(가장자리)
    const tree = (tx, ty, s, dir) => {
      x.strokeStyle = '#1a1418'; x.lineCap = 'round';
      const br = (bx, by, a, len, w) => {
        if (w < 1.2) return;
        const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
        x.lineWidth = w; x.beginPath(); x.moveTo(bx, by); x.lineTo(ex, ey); x.stroke();
        br(ex, ey, a - 0.45 + rnd() * 0.2, len * 0.7, w * 0.62);
        br(ex, ey, a + 0.4 + rnd() * 0.2, len * 0.65, w * 0.6);
      };
      br(tx, ty, -Math.PI / 2 + dir * 0.2, s, s * 0.22);
    };
    tree(15, 420, 70, 1); tree(705, 700, 80, -1); tree(10, 900, 60, 1); tree(712, 220, 60, -1);
    // 넓은 안개 띠(정적 2겹, 동적 안개는 drawAmbient) — 바닥 위장 대신 층 분리감만 준다
    x.fillStyle = 'rgba(191,238,224,0.1)'; x.fillRect(-BLEED, 300, 720 + BLEED * 2, 90);
    x.fillStyle = 'rgba(191,238,224,0.08)'; x.fillRect(-BLEED, 680, 720 + BLEED * 2, 110);
  },
  // 화산 용암지대 — 차가운 현무암, 육각 대비 절반, 용암 강 폭 2/3
  (x, rnd) => {
    fillAll(x, [[0, '#1c1720'], [0.5, '#241d28'], [1, '#2e2733']]);
    // 현무암 판(개수·대비 절반)
    for (let k = 0; k < 90; k++) {
      const cx = rnd() * 780 - 30, cy = rnd() * 990, s = 20 + rnd() * 34, pts = [];
      for (let p = 0; p < 6; p++) { const a = p * TAU / 6 + rnd() * 0.4; pts.push(cx + Math.cos(a) * s * (0.75 + rnd() * 0.25), cy + Math.sin(a) * s * 0.7 * (0.75 + rnd() * 0.25)); }
      poly(x, pts);
      x.fillStyle = `rgba(${58 + rnd() * 20 | 0},${48 + rnd() * 16 | 0},${58 + rnd() * 18 | 0},0.45)`; x.fill();
      x.lineWidth = 1.4; x.strokeStyle = 'rgba(255,90,30,0.12)'; x.stroke();
    }
    // 용암 강(폭 2/3, 채도 유지)
    const river = pts => {
      for (const [c, w] of [['rgba(255,60,10,0.22)', 47], ['rgba(255,90,20,0.55)', 29], ['#ff6a1f', 20], ['#ffc23a', 9], ['#fff0a0', 3]]) {
        x.strokeStyle = c; x.lineWidth = w;
        x.beginPath(); x.moveTo(pts[0], pts[1]); x.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]); x.stroke();
      }
    };
    river([-40, 180, 160, 260, 60, 520, -40, 640]);
    river([760, 380, 560, 480, 700, 760, 760, 880]);
    // 용암 웅덩이
    for (let k = 0; k < 7; k++) {
      const px = 120 + rnd() * 480, py = 80 + rnd() * 820, s = 9 + rnd() * 12;
      ell(x, px, py, s * 2.2, s * 1.4);
      x.fillStyle = rad(x, px, py, 0, s * 2.2, [[0, 'rgba(255,120,30,0.3)'], [1, 'rgba(255,60,0,0)']]); x.fill();
      ell(x, px, py, s, s * 0.6);
      fs(x, rad(x, px, py, 0, s, [[0, '#fff0a0'], [0.4, '#ffb030'], [1, '#e0400e']]), 2, '#2a0e08');
    }
    // 재 얼룩
    blobs(x, rnd, 20, 'rgba(10,8,10,0.28)', 20, 60);
  },
  // 심연의 마왕성 — 카펫 채도↓(와인)로 붉은 보스를 살린다
  (x, rnd) => {
    fillAll(x, [[0, '#1b1538'], [0.5, '#231a44'], [1, '#2a2050']]);
    // 바닥 타일
    for (let ty = -BLEED, r = 0; ty < 1000; ty += 60, r++) {
      for (let tx = -BLEED + (r % 2) * 30; tx < 760; tx += 60) {
        x.fillStyle = `rgba(${52 + rnd() * 16 | 0},${34 + rnd() * 14 | 0},${68 + rnd() * 20 | 0},0.45)`;
        x.fillRect(tx + 2, ty + 2, 56, 56);
        x.fillStyle = 'rgba(255,255,255,0.04)'; x.fillRect(tx + 2, ty + 2, 56, 3);
      }
    }
    // 붉은 융단 → 와인(채도↓) + 금테
    x.fillStyle = lin(x, 250, 0, 470, 0, [[0, '#3e0f26'], [0.5, '#5a1a3c'], [1, '#3e0f26']]);
    x.fillRect(260, -BLEED, 200, 1000 + BLEED);
    x.strokeStyle = '#d9a441'; x.lineWidth = 4;
    x.beginPath(); x.moveTo(270, -BLEED); x.lineTo(270, 1000); x.moveTo(450, -BLEED); x.lineTo(450, 1000); x.stroke();
    // 마법진
    x.strokeStyle = 'rgba(200,107,255,0.22)'; x.lineWidth = 3;
    circ(x, 360, 520, 150); x.stroke();
    circ(x, 360, 520, 120); x.stroke();
    x.beginPath();
    for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + k * TAU * 2 / 5; const px = 360 + Math.cos(a) * 120, py = 520 + Math.sin(a) * 120; k ? x.lineTo(px, py) : x.moveTo(px, py); }
    x.stroke();
    // 기둥 + 화로(보라 불꽃)
    for (let py = 60; py < 960; py += 180) {
      for (const px of [22, 698]) {
        x.fillStyle = 'rgba(0,0,0,0.4)'; ell(x, px + 6, py + 50, 28, 10); x.fill();
        rrect(x, px - 22, py - 60, 44, 110, 6);
        fs(x, lin(x, px - 22, 0, px + 22, 0, [[0, '#4a3a5a'], [0.4, '#7a6a8a'], [1, '#2a2034']]), 2, '#100818');
        circ(x, px, py - 70, 70);
        x.fillStyle = rad(x, px, py - 70, 0, 70, [[0, 'rgba(200,107,255,0.4)'], [1, 'rgba(120,40,200,0)']]); x.fill();
        ell(x, px, py - 62, 18, 6); fs(x, '#2a2034', 2, '#100818');
        x.beginPath(); x.moveTo(px - 12, py - 64); x.quadraticCurveTo(px - 10, py - 84, px, py - 96); x.quadraticCurveTo(px + 10, py - 84, px + 12, py - 64); x.closePath();
        x.fillStyle = lin(x, 0, py - 96, 0, py - 64, [[0, '#ffe0ff'], [0.5, '#c86bff'], [1, '#5a1fa8']]); x.fill();
      }
    }
  },
];

// 위 여분(topExtra) 원경 — 테마별 하늘/먼 배경(§2.2 표 마지막 줄)
const FAR = [
  (x, rnd, HH) => { // 초원: 먼 언덕 + 하늘
    x.fillStyle = lin(x, 0, 0, 0, HH, [[0, '#bfe6ff'], [0.7, '#dff3d8'], [1, '#eef7dd']]); x.fillRect(-BLEED, 0, 720 + BLEED * 2, HH);
    x.fillStyle = '#9fcf82';
    for (let k = 0; k < 3; k++) { const hy = HH - 30 - k * 26, hs = 260 - k * 40; for (let hx = -60 + k * 90; hx < 800; hx += hs * 1.4) { ell(x, hx, hy + 40, hs, 60); x.fill(); } }
  },
  (x, rnd, HH) => { // 동굴: 천장 종유석 + 어둠
    x.fillStyle = lin(x, 0, 0, 0, HH, [[0, '#161228'], [1, '#2a2440']]); x.fillRect(-BLEED, 0, 720 + BLEED * 2, HH);
    for (let k = 0; k < 12; k++) { const bx = rnd() * 760 - 20, h = 26 + rnd() * 60; poly(x, [bx - 12, 0, bx, h, bx + 12, 0]); x.fillStyle = '#332a48'; x.fill(); }
  },
  (x, rnd, HH) => { // 묘지: 달 + 교회 첨탑 실루엣
    x.fillStyle = lin(x, 0, 0, 0, HH, [[0, '#182430'], [1, '#28403c']]); x.fillRect(-BLEED, 0, 720 + BLEED * 2, HH);
    circ(x, 560, 60, 44); x.fillStyle = '#e8f4ee'; x.fill();
    x.fillStyle = 'rgba(20,32,30,0.9)';
    poly(x, [120, HH, 150, 40, 180, HH]); x.fill();
    x.fillRect(140, 30, 20, 14);
  },
  (x, rnd, HH) => { // 화산: 연기 기둥
    x.fillStyle = lin(x, 0, 0, 0, HH, [[0, '#241016'], [1, '#3a1c16']]); x.fillRect(-BLEED, 0, 720 + BLEED * 2, HH);
    x.fillStyle = 'rgba(80,60,60,0.35)';
    for (let k = 0; k < 5; k++) circ(x, 300 + k * 30 - 60, HH - 20 - k * 30, 40 + k * 10), x.fill();
  },
  (x, rnd, HH) => { // 마왕성: 첨탑 + 보라 하늘
    x.fillStyle = lin(x, 0, 0, 0, HH, [[0, '#100a20'], [1, '#241a44']]); x.fillRect(-BLEED, 0, 720 + BLEED * 2, HH);
    x.fillStyle = '#1c1436';
    for (const tx of [70, 640]) { poly(x, [tx - 20, HH, tx - 20, 40, tx, 10, tx + 20, 40, tx + 20, HH]); x.fill(); }
  },
];

// ═════════════ 전장 그리기 ═════════════
export function coins(x, y, n, rain = false) {
  for (let i = 0; i < n; i++) {
    const c = take(COINS);
    c.on = true; c.fly = false; c.t = 0; c.x = rain ? x + (rnd() - 0.5) * 440 : x; c.y = rain ? y - 60 - rnd() * 260 : y;
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4, sp = 140 + rnd() * 240;
    c.vx = rain ? (rnd() - 0.5) * 60 : Math.cos(a) * sp;
    c.vy = rain ? 150 + rnd() * 250 : Math.sin(a) * sp - 60;
    c.dur = rain ? 0.7 + rnd() * 0.5 : 0.45 + rnd() * 0.3;
    c.gy = rain ? y + 40 + rnd() * 120 : y + 16 + rnd() * 30;
    c.spin = rnd() * TAU;
  }
}

function lootFx(view, ev) {
  const it = ev.item;
  if (!it) return;
  const L = take(LOOTS), ri = Math.max(0, TIER_RARITY.indexOf(it.rarity));
  L.on = true; L.t = 0; L.x = clamp(+ev.x || 360, 40, WORLD_W - 40); L.y = clamp(+ev.y || 800, 300, WALL_Y - 10); // 보스 드롭도 HUD·보스바 밑이 아니라 전장 안에서
  L.item = it; L.ri = ri; L.cls = (view.hero && view.hero.cls) || 'knight'; L.hold = [0.7, 1, 1.2, 1.35, 1.6][ri];
  const col = RARITY_COL[it.rarity] ? RARITY_COL[it.rarity][0] : '#ffffff';
  ring(L.x, L.y, 8, 50 + ri * 18, 0.4, col, 5);
  if (ri >= 3) ring(L.x, L.y, 8, 120, 0.6, '#ffffff', 4);
  if (ri >= 4) {
    flash(0.3, '#ffd23a'); shake(0.2);
    sprPop(starFlash('#ffd23a'), L.x, L.y - 60, 0.6, 3.4, 0.45);
    ring(L.x, L.y, 10, 220, 0.8, '#ffd23a', 10);
    burst(K_STAR, L.x, L.y - 40, 24, 120, 420, 1.1, 18, ['#ffffff', '#ffe07a', '#ffb020'], -60, 1.2, 160);
  }
}

export function drawAmbient(theme, da) {
  const A = AMB[theme];
  if (ambTheme !== theme) {
    ambTheme = theme;
    amb = [];
    for (let i = 0; i < A.n; i++) amb.push({ x: rnd() * WORLD_W, y: rnd() * WALL_Y, ph: rnd() * TAU, s: 0.5 + rnd(), v: 0.5 + rnd() });
  }
  // 묘지 안개(동적, 부드럽게 흐름)
  if (theme === 2) {
    const f = soft('rgba(190,210,220,0.5)');
    for (let k = 0; k < 4; k++) {
      const fx = ((T * (12 + k * 5) + k * 260) % 1100) - 200, fy = 200 + k * 190;
      ctx.globalAlpha = 0.16;
      spr(f, fx, fy, 420, 170);
    }
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'lighter';
  const g = gl(A.col);
  for (const p of amb) {
    p.y += A.vy * p.v * da;
    p.x += Math.sin(T * 0.8 + p.ph) * 12 * da;
    if (p.y < -20) { p.y = WALL_Y; p.x = rnd() * WORLD_W; }
    const tw = 0.45 + 0.55 * Math.sin(T * 2.2 + p.ph);
    ctx.globalAlpha = Math.max(0, tw) * 0.8;
    const s = (theme === 3 ? 7 : 10) * p.s;
    spr(g, p.x, p.y, s, s);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // 위 여분(topExtra) 안: 테마별 잔잔한 움직임 — 세로로 긴 화면에서만 보인다
  if (topExtra > 20) {
    if (theme === 0) { // 흘러가는 구름
      x_cloud(-140, 0.35); x_cloud(-260, 0.22);
    } else if (theme === 1) { // 박쥐 몇 마리
      ctx.fillStyle = 'rgba(20,14,30,0.8)';
      for (let k = 0; k < 3; k++) {
        const bx = ((T * 46 + k * 260) % (WORLD_W + 160)) - 80, by = -topExtra * 0.55 + Math.sin(T * 3 + k) * 14 - k * 18;
        const wf = Math.sin(T * 12 + k) * 5;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx - 8, by - wf); ctx.lineTo(bx - 2, by + 2); ctx.lineTo(bx + 2, by + 2); ctx.lineTo(bx + 8, by - wf); ctx.closePath(); ctx.fill();
      }
    } else if (theme === 3) { // 위로 흐르는 연기
      ctx.globalCompositeOperation = 'lighter';
      const g2 = gl('#7a5a5a');
      for (let k = 0; k < 3; k++) {
        const sy = -((T * 20 + k * 60) % (topExtra + 40));
        ctx.globalAlpha = 0.18 * Math.max(0, 1 - -sy / (topExtra + 40));
        spr(g2, 300 + k * 24 - 24, sy, 70, 90);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    } else if (theme === 4) { // 별처럼 반짝이는 먼 하늘
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 6; k++) {
        const sxp = (k * 131) % (WORLD_W + 40) - 20, syp = -topExtra * (0.2 + (k % 3) * 0.25);
        ctx.globalAlpha = 0.3 + 0.3 * Math.sin(T * 2 + k * 1.7);
        spr(g, sxp, syp, 6, 6);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }
  // 초원 나비
  if (theme === 0) {
    for (let k = 0; k < 4; k++) {
      const bx = (T * 30 + k * 200) % 820 - 50, by = 180 + k * 180 + Math.sin(T * 1.3 + k) * 40;
      const f = Math.abs(Math.sin(T * 14 + k)) * 0.8 + 0.2;
      ctx.fillStyle = ['#ffffff', '#ffe36a', '#ff9ac0', '#b8a0ff'][k];
      ctx.beginPath();
      ctx.ellipse(bx - 4 * f, by, 4.5 * f, 3.5, 0, 0, TAU);
      ctx.ellipse(bx + 4 * f, by, 4.5 * f, 3.5, 0, 0, TAU);
      ctx.fill();
    }
  }
  function x_cloud(baseY, spd) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (let k = 0; k < 2; k++) {
      const cx = ((T * 18 * spd + k * 420) % (WORLD_W + 300)) - 150, cy = -topExtra * 0.6 + baseY;
      for (const [dx, dy, r] of [[0, 0, 30], [24, 4, 22], [-26, 6, 20], [10, -10, 18]]) { circ(x_ctx(), cx + dx, cy + dy, r); ctx.fill(); }
    }
  }
  function x_ctx() { return ctx; }
}

export function drawWall(view) {
  const theme = clamp(view.theme | 0, 0, 4);
  const w = wall(theme);
  const ws = wallShake > 0 ? Math.sin(RT * 70) * wallShake * 5 : 0;
  const x = 360 + ws - w.hw, y = WALL_CY - w.hh;
  ctx.drawImage(w, x, y, w.hw * 2, w.hh * 2);
  const ratio = view.wall && view.wall.max > 0 ? clamp(view.wall.hp / view.wall.max, 0, 1) : 1;
  const lvl = ratio < 0.25 ? 3 : ratio < 0.5 ? 2 : ratio < 0.75 ? 1 : 0;
  if (lvl) ctx.drawImage(cracks(lvl), x, y, w.hw * 2, w.hh * 2);
  const red = Math.max(wallFlash * 0.85, ratio < 0.3 && view.phase === 'play' ? 0.25 + 0.2 * Math.sin(RT * 8) : 0);
  if (red > 0) {
    ctx.globalAlpha = red;
    ctx.drawImage(wallTint(theme), x, y, w.hw * 2, w.hh * 2);
    ctx.globalAlpha = 1;
  }
  // 마법사 단(P1 금 / P2 청록) + 영웅 성문 — 마법사·영웅 스프라이트보다 먼저(발밑)
  const heroGateX = (CANNONS[0].x + CANNONS[1].x) / 2, heroGateY = WALL_Y - 30;
  ctx.drawImage(platform(theme, -1), CANNONS[0].x - 62, MAGE_FEET - 62, 124, 124);
  ctx.drawImage(platform(theme, 1), CANNONS[1].x - 62, MAGE_FEET - 62, 124, 124);
  ctx.drawImage(heroGatePlatform(theme), heroGateX - 74, heroGateY - 74, 148, 148);
  // 성벽 결계: 성벽 강화(두 마법사 합)가 오를수록 진해지는 룬 방어막
  const ls = ((view.players[0] && view.players[0].lv ? view.players[0].lv.wall : 0) | 0) + ((view.players[1] && view.players[1].lv ? view.players[1].lv.wall : 0) | 0);
  const ba = clamp(0.16 + 0.11 * Math.log2(1 + ls), 0.16, 0.8);
  additive(true);
  ctx.globalAlpha = ba * 0.5;
  spr(gl('#6fb8ff'), 360, WALL_Y - 14, 840, 60);
  ctx.globalAlpha = ba * (0.75 + 0.25 * Math.sin(RT * 2.2));
  ctx.drawImage(runeBand('#9fd0ff'), -30 - (RT * 16) % 48, WALL_Y - 36, 820, 24);
  ctx.globalAlpha = ba * (0.5 + 0.3 * Math.sin(RT * 3.1));
  ctx.fillStyle = '#e0f4ff';
  ctx.fillRect(-30, WALL_Y - 40, 780, 2);
  if (view.spells && view.spells.holyLight) { // 수호의 빛: 성벽을 따라 흐르는 금빛 파동
    for (let k = 0; k < 2; k++) {
      ctx.globalAlpha = 0.55;
      spr(gl('#ffe07a'), ((RT * 220 + k * 450) % 900) - 90, WALL_Y + 12, 200, 46);
    }
  }
  ctx.globalAlpha = 1;
  additive(false);
  // 성문 룬(느리게 맥동)
  groundRune(runeCircle('#e8d9ff'), heroGateX, heroGateY + 4, 1.3, RT * 0.15, 0.28 + 0.1 * Math.sin(RT * 1.4));
  // 요새화 가시
  for (const s of SPIKES) {
    if (s.life <= 0) continue;
    const t = 1 - s.life / 0.4, hgt = 34 * Math.sin(Math.min(1, t * 2.2) * Math.PI * 0.5) * (t > 0.7 ? (1 - t) / 0.3 : 1);
    for (let k = -2; k <= 2; k++) {
      const bx = s.x + k * 13, hh = hgt * (1 - Math.abs(k) * 0.22);
      ctx.beginPath();
      ctx.moveTo(bx - 6, WALL_Y - 12); ctx.lineTo(bx, WALL_Y - 12 - hh); ctx.lineTo(bx + 6, WALL_Y - 12);
      ctx.closePath();
      ctx.fillStyle = '#e8eef8'; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#3a4050'; ctx.stroke();
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = s.life / 0.4;
    spr(gl('#ffffff'), s.x, WALL_Y - 26, 90, 60);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // 성벽 체력바 — 석판 명판 + 젤리 바 (§10.18)
  const bx = 60, by = 1058, bw = 600, bh = 22;
  rr(bx - 10, by - 10, bw + 20, bh + 20, 10);
  fs(ctx, lin(ctx, 0, by - 10, 0, by + bh + 10, [[0, '#5a5248'], [1, '#2c2620']]), 2, '#140e12');
  ctx.fillStyle = 'rgba(15,8,20,0.85)';
  rr(bx - 3, by - 3, bw + 6, bh + 6, 8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(bx, by, Math.max(0, bw * wallLag), bh);
  const g = ctx.createLinearGradient(0, by, 0, by + bh);
  const col = ratio > 0.5 ? ['#9aff7a', '#36b83a'] : ratio > 0.25 ? ['#ffe27a', '#e0a010'] : ['#ff8a7a', '#d0201a'];
  g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
  ctx.fillStyle = g;
  rr(bx, by, Math.max(6, bw * ratio), bh, 6); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  rr(bx, by, Math.max(6, bw * ratio), bh * 0.45, 5); ctx.fill();
  if (ratio > 0.03) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8; spr(gl('#ffffff'), bx + bw * ratio, by + bh / 2, 16, bh + 6); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  ctx.strokeStyle = '#22163a'; ctx.lineWidth = 2.4; rr(bx, by, bw, bh, 6); ctx.stroke();
  ctx.textBaseline = 'middle';
  txt(`성벽  ${fmt(view.wall ? view.wall.hp : 0)} / ${fmt(view.wall ? view.wall.max : 0)}`, 360, by + bh / 2 + 1, 15, '#ffffff', '#1a0a14', 4);
}

// 장비 드롭: 희귀도 빛기둥 → 가방으로 비행
export function drawLoots() {
  for (const L of LOOTS) {
    if (!L.on) continue;
    const t = L.t, R = RARITY_COL[L.item.rarity] || RARITY_COL.common, ri = L.ri;
    const drop = t < 0.35 ? t / 0.35 : 1;
    let ix = L.x, iy = L.y - 70 * (1 - drop) ** 2 - (drop >= 1 ? Math.abs(Math.sin(Math.min(1, (t - 0.35) / 0.3) * Math.PI)) * 10 * (1 - Math.min(1, (t - 0.35) / 0.3)) : 0) - 16;
    let k = 1;
    if (t >= L.hold) { // 가방으로
      const u = Math.min(1, (t - L.hold) / 0.55), e = u * u, a = 1 - e;
      const cx = (L.x + BAG_POS.x) / 2, cy = Math.min(L.y, BAG_POS.y) - 60;
      ix = a * a * L.x + 2 * a * e * cx + e * e * BAG_POS.x;
      iy = a * a * (L.y - 16) + 2 * a * e * cy + e * e * BAG_POS.y;
      k = 1 - 0.4 * e;
      if (ri >= 2 && rnd() < 0.7) part(K_STAR, ix, iy, (rnd() - 0.5) * 40, (rnd() - 0.5) * 40, 0.35, ri >= 4 ? 14 : 10, R[1], 0, 2); // 비행 꼬리
    } else if (ri >= 1) { // 빛기둥
      // 전설 = 화면 끝까지 닿는 금빛 기둥 + 회전 후광, 영웅 이하 = 등급 높이 기둥 (ART §9.6)
      const bh = ri >= 4 ? L.y + topExtra : [0, 110, 190, 240, 310][ri], a = Math.min(1, t / 0.15) * Math.min(1, (L.hold - t) / 0.3);
      const bw = (ri >= 4 ? 48 : ri >= 3 ? 26 : 22) - (ri >= 4 ? 14 : 10) * Math.min(1, t / 0.8);
      additive(true);
      ctx.globalAlpha = a;
      ctx.drawImage(beamSpr(R[0]), L.x - bw, L.y - bh, bw * 2, bh);
      ctx.globalAlpha = a * 0.8;
      spr(gl(R[0]), L.x, L.y, ri >= 4 ? 190 : 100, ri >= 4 ? 56 : 30);
      if (ri >= 3) groundRune(runeCircle(R[0]), L.x, L.y, ri >= 4 ? 2.4 : 1.6, RT * 1.5, a * 0.9);
      if (ri >= 4) {
        place(L.x, iy, RT * 1.6, 1, 1);
        ctx.globalAlpha = a * 0.9;
        spr(rays(R[0]), 0, 0, 200, 200);
        wt();
        if (rnd() < 0.5) part(K_STAR, L.x + (rnd() - 0.5) * 40, L.y - rnd() * 200, 0, -80, 0.7, 12, rnd() < 0.5 ? '#ffffff' : '#ffe07a', 0, 1);
      }
      additive(false);
      ctx.globalAlpha = 1;
      if (ri === 3 && t > 0.3) { // 전설은 HUD '전설 획득!' 배너가 이름을 보여 준다
        ctx.globalAlpha = a;
        txt(String(L.item.name || ''), clamp(L.x, 110, WORLD_W - 110), iy - 36, 15, R[1], '#22163a', 4);
        ctx.globalAlpha = 1;
      }
    }
    additive(true);
    ctx.globalAlpha = 0.7;
    spr(gl(R[0]), ix, iy, 64 * k, 64 * k);
    additive(false);
    ctx.globalAlpha = 1;
    const s = (ri >= 4 ? 56 : ri >= 3 ? 44 : 36) * k * (t < 0.12 ? easeBack(t / 0.12) : 1);
    place(ix, iy, t < 0.35 ? (1 - drop) * 3 : 0, 1, 1);
    ctx.drawImage(itemIcon(L.item.slot, L.item.rarity, L.cls), -s / 2, -s / 2, s, s);
    wt();
  }
}

export function drawCoins() {
  const cs = coin();
  for (const c of COINS) {
    if (!c.on) continue;
    const f = Math.cos(c.spin + (c.fly ? 0 : c.t * 14) + RT * 10);
    const s = c.fly ? 16 - 5 * Math.min(1, c.t / 0.5) : 16;
    ctx.drawImage(cs, c.x - s * Math.abs(f) / 2 - 0.5, c.y - s / 2, s * Math.abs(f) + 1, s);
  }
}

// 테마 배경 (맨 아래 층, 월드 변환 wt() 상태에서 호출)
export function drawBackground(theme) {
  const bg = background(theme);
  ctx.drawImage(bg, -BLEED, -BLEED, WORLD_W + BLEED * 2, WORLD_H + BLEED * 2);
  // 세로로 긴 화면: 월드 위 여분(topExtra)을 테마별 원경(하늘·먼 배경)으로 채운다(§2.2) — 전체 타일을 topExtra 높이에 맞춰 늘린다(맨 아래 = 지평선)
  if (topExtra > 0.5) ctx.drawImage(farBg(theme), -BLEED, -topExtra, WORLD_W + BLEED * 2, topExtra);
  // 어두운 테마(동굴·묘지·화산·마왕성): 적이 걷는 전장 가운데에 넓은 빛 웅덩이(가산 1장) → 중간 톤을 올려 적이 배경에서 떠 보이게 (§2.2)
  const LP = LIGHT_POOL[theme];
  if (LP) {
    additive(true);
    ctx.globalAlpha = LP[1];
    spr(gl(LP[0]), 360, 470, 1000, 1150);
    ctx.globalAlpha = 1;
    additive(false);
  }
}
const LIGHT_POOL = [null, ['#8a7ad8', 0.22], ['#7ac8b8', 0.14], ['#ff8a4a', 0.16], ['#9a6ae8', 0.18]];

// ═════════════ 이벤트 → 월드 반응 ═════════════
export function events(view, evs, opts) {
  for (const ev of evs) {
    switch (ev.type) {
      case 'loot': lootFx(view, ev); break;
      case 'wall': {
        const mx = view.wall && view.wall.max > 0 ? view.wall.max : 1;
        shake(0.07 + Math.min(0.35, ev.dmg / mx * 2.5));
        wallFlash = 1;
        wallShake = Math.min(1, wallShake + 0.45);
        const x = 40 + rnd() * 640;
        sprPop(runeCircle('#9fd0ff'), x, WALL_Y - 24, 0.3, 1.1, 0.3, Math.PI / 2, 3, 0.4); // 결계 파문
        burst(K_DEBRIS, x, WALL_Y, 4, 80, 240, 0.7, 5, ['#a8a08e', '#6a6254', '#d8d2c4'], 900, 0.5, 160);
        part(K_SMOKE, x, WALL_Y, 0, -30, 0.6, 40, 'rgba(200,190,170,0.5)', 0, 1);
        break;
      }
      case 'thorns': {
        const s = take(SPIKES);
        s.x = ev.x; s.life = 0.4;
        burst(K_SPARK, ev.x, WALL_Y - 10, 5, 300, 600, 0.15, 3, '#ffffff', 0, 6);
        shake(0.04);
        break;
      }
    }
  }
}

// ═════════════ 갱신 ═════════════
export function update(view, da, dt) {
  for (const s of SPIKES) if (s.life > 0) s.life -= da;
  for (const c of COINS) {
    if (!c.on) continue;
    c.t += da;
    if (!c.fly) {
      c.vy += 1100 * da;
      c.x += c.vx * da;
      c.y += c.vy * da;
      if (c.y > c.gy && c.vy > 0) { c.y = c.gy; c.vy *= -0.45; c.vx *= 0.6; }
      if (c.t >= c.dur) { c.fly = true; c.t = 0; c.sx = c.x; c.sy = c.y; }
    } else {
      const u = Math.min(1, c.t / 0.5), e = u * u;
      const cx = c.sx + (GOLD_POS.x - c.sx) * 0.15, cy = Math.min(c.sy, 400) - 160;
      c.x = (1 - e) * (1 - e) * c.sx + 2 * (1 - e) * e * cx + e * e * GOLD_POS.x;
      c.y = (1 - e) * (1 - e) * c.sy + 2 * (1 - e) * e * cy + e * e * GOLD_POS.y;
      if (u >= 1) {
        c.on = false;
        coinsArrived++;
        if (rnd() < 0.3) part(K_STAR, GOLD_POS.x + (rnd() - 0.5) * 30, GOLD_POS.y, 0, 0, 0.25, 16, '#ffe68a');
      }
    }
  }
  for (const L of LOOTS) {
    if (!L.on) continue;
    L.t += dt;
    if (L.ri >= 3 && L.t < L.hold && rnd() < 0.5) part(K_STAR, L.x + (rnd() - 0.5) * 30, L.y - rnd() * 60, 0, -60 - rnd() * 60, 0.7, 12, RARITY_COL[L.item.rarity][1], 0, 1);
    if (L.t >= L.hold + 0.55) {
      L.on = false;
      burst(K_STAR, BAG_POS.x, BAG_POS.y, 8, 60, 200, 0.5, 14, ['#ffffff', RARITY_COL[L.item.rarity][0]], 0, 2);
      ring(BAG_POS.x, BAG_POS.y, 6, 44, 0.3, RARITY_COL[L.item.rarity][0], 4);
    }
  }
  wallFlash = Math.max(0, wallFlash - dt * 5);
  wallShake = Math.max(0, wallShake - dt * 4);
  const wr = view.wall && view.wall.max > 0 ? clamp(view.wall.hp / view.wall.max, 0, 1) : 1;
  wallLag = Math.max(wr, wallLag - 0.35 * dt);
}

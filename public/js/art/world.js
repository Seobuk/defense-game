// 월드 — 5개 테마 배경(+여백 BLEED)·주변 입자·성벽(테마 스킨·결계·균열·가시·체력바)·마법사 단·영웅 성문·보물상자·동전·장비 드롭 빛기둥.
// docs/ART.md §2.2, §9.6, §10.2, §10.18
// 소유: 월드 에이전트. 계약(아래 export 목록과 render.js 호출 순서)은 docs/ART.md §14 참고.
import { WORLD_W, WORLD_H, WALL_Y, CANNONS } from '../config.js';
import { HERO_GATE } from '../hero.js';
import { fmt, clamp } from '../util.js';
import {
  TAU, bake, tint, circ, ell, rrect, fs, rad, lin, poly, shine, mulberry, cache, RARITY_COL, TIER_RARITY, BAG_POS, GOLD_POS, OWN,
  ctx, T, RT, topExtra, sideX,
  shake, flash, rnd, easeBack, pool, take,
  wt, place, spr, txt, rr, additive, groundRune,
} from './core.js';
import { gl, part, burst, ring, sprPop, K_STAR, K_SPARK, K_SMOKE, K_DEBRIS, soft, shadow, runeCircle, runeBand, starFlash, beamSpr, rays } from './fx.js';
import { itemIcon, MAGE_FEET, mageOn, mageX } from './units.js';

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
const WALL_PAD = 26; // 흉벽 위 장식(목책 끝·묘비형 톱니·수정 군집)이 잘리지 않게 위 여유
const wallHW = 380, wallHH = (WALL_BOT - WALL_TOP + MERLON + WALL_PAD) / 2 + 4;
export const WALL_CY = WALL_TOP - MERLON - WALL_PAD + wallHH - 2; // 스프라이트 중심 y (월드)
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
    // 흉벽: 테마별 실루엣 — 초원 = 뾰족 통나무 목책, 묘지 = 둥근 묘비형 톱니 + 쇠창살, 동굴 = 거친 바위 + 수정 군집, 그 외 = 돌 톱니
    if (theme === 0) {
      for (let lx = -16; lx < 740; lx += 17) {
        const h = MERLON + 10 + (rnd() * 6 | 0), top = WALL_TOP + 6 - h;
        x.beginPath(); x.moveTo(lx, WALL_TOP + 8); x.lineTo(lx, top + 7); x.lineTo(lx + 7.5, top); x.lineTo(lx + 15, top + 7); x.lineTo(lx + 15, WALL_TOP + 8); x.closePath();
        fs(x, lin(x, lx, 0, lx + 15, 0, [[0, '#d8a868'], [0.45, '#a8743e'], [1, '#6a4422']]), 2.2, '#2a1a0c');
        x.strokeStyle = 'rgba(60,36,14,0.45)'; x.lineWidth = 1; x.beginPath(); x.moveTo(lx + 5, top + 12); x.lineTo(lx + 5, WALL_TOP + 2); x.stroke();
      }
      x.fillStyle = '#5a3c1e'; x.strokeStyle = '#2a1a0c'; x.lineWidth = 2;
      rrect(x, -20, WALL_TOP - 12, 760, 7, 3); x.fill(); x.stroke(); // 가로 난간 보
    } else if (theme === 2) {
      for (let mx = -20; mx < 740; mx += 72) {
        x.beginPath(); x.moveTo(mx, WALL_TOP + 8); x.lineTo(mx, WALL_TOP - MERLON + 8); x.arc(mx + 23, WALL_TOP - MERLON + 8, 23, Math.PI, 0); x.lineTo(mx + 46, WALL_TOP + 8); x.closePath();
        fs(x, lin(x, 0, WALL_TOP - MERLON - 16, 0, WALL_TOP, [[0, sk.hi], [1, sk.mid]]), 2.5, '#141c18');
        x.strokeStyle = 'rgba(20,30,26,0.55)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(mx + 23, WALL_TOP - MERLON - 6); x.lineTo(mx + 23, WALL_TOP + 2); x.moveTo(mx + 15, WALL_TOP - MERLON + 2); x.lineTo(mx + 31, WALL_TOP - MERLON + 2); x.stroke();
      }
      x.strokeStyle = '#1a1a20'; x.lineWidth = 2.4; // 톱니 사이 쇠창살
      for (let mx = 34; mx < 740; mx += 72) for (let k = 0; k < 3; k++) {
        const px = mx + k * 9; x.beginPath(); x.moveTo(px, WALL_TOP + 2); x.lineTo(px, WALL_TOP - MERLON - 4); x.stroke();
        poly(x, [px - 3, WALL_TOP - MERLON - 3, px, WALL_TOP - MERLON - 10, px + 3, WALL_TOP - MERLON - 3]); x.fillStyle = '#3a3a44'; x.fill();
      }
    } else if (theme === 1) {
      for (let mx = -20; mx < 740; mx += 72) {
        poly(x, [mx, WALL_TOP + 8, mx - 2, WALL_TOP - MERLON + 6, mx + 10, WALL_TOP - MERLON - 2, mx + 30, WALL_TOP - MERLON, mx + 46, WALL_TOP - MERLON + 5, mx + 48, WALL_TOP + 8]);
        fs(x, lin(x, 0, WALL_TOP - MERLON, 0, WALL_TOP, [[0, sk.hi], [1, sk.mid]]), 2.5, '#140e26');
      }
    } else {
      for (let mx = -20; mx < 740; mx += 72) {
        rrect(x, mx, WALL_TOP - MERLON, 46, MERLON + 8, 3);
        fs(x, lin(x, 0, WALL_TOP - MERLON, 0, WALL_TOP, [[0, sk.hi], [1, sk.mid]]), 2.5, '#20180f');
      }
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
    if (theme === 0) { // 목책 아래 담쟁이(잎 + 덩굴) + 작은 꽃
      for (let k = 0; k < 14; k++) {
        let vx = 20 + k * 52 + rnd() * 20, vy = WALL_TOP + 2;
        x.strokeStyle = '#2e6a24'; x.lineWidth = 2;
        x.beginPath(); x.moveTo(vx, vy);
        const len = 3 + (rnd() * 4 | 0), pts = [];
        for (let q = 0; q < len; q++) { vx += (rnd() - 0.5) * 14; vy += 8 + rnd() * 5; x.lineTo(vx, vy); pts.push([vx, vy]); }
        x.stroke();
        for (const [px, py] of pts) for (const sd of [-1, 1]) {
          x.save(); x.translate(px + sd * 4, py); x.rotate(sd * 0.6 + (rnd() - 0.5) * 0.4);
          ell(x, 0, 0, 5.5, 3.4); fs(x, rnd() < 0.5 ? '#6ec24a' : '#4a9a36', 1.2, '#1e4a18');
          x.restore();
        }
        if (rnd() < 0.5) { const [px, py] = pts[pts.length - 1]; x.fillStyle = '#ffe8f0'; for (let q = 0; q < 5; q++) { const a = q * TAU / 5; circ(x, px + Math.cos(a) * 2.6, py + 4 + Math.sin(a) * 2.6, 2); x.fill(); } circ(x, px, py + 4, 1.4); x.fillStyle = '#ffb020'; x.fill(); }
      }
    } else if (theme === 1) { // 박힌 수정 + 흉벽 위로 솟은 수정 군집
      for (let mx = 2; mx < 740; mx += 144) {
        const cx = mx + 10, cy = WALL_TOP - MERLON + 2, col = (mx / 144) % 2 ? '#c08bff' : '#7ff2ff', dk = (mx / 144) % 2 ? '#4a1a8a' : '#1a4a8a';
        x.fillStyle = rad(x, cx, cy - 8, 0, 30, [[0, col + '66'], [1, col + '00']]); x.fillRect(cx - 30, cy - 38, 60, 60);
        for (const [dx, h, a] of [[-7, 16, -0.4], [0, 24, 0], [7, 14, 0.45]]) {
          x.save(); x.translate(cx + dx, cy + 2); x.rotate(a);
          poly(x, [-3.5, 0, -3.5, -h * 0.75, 0, -h, 3.5, -h * 0.75, 3.5, 0]);
          fs(x, lin(x, -3.5, 0, 3.5, 0, [[0, '#ffffff'], [0.4, col], [1, dk]]), 1.4, 'rgba(10,10,30,0.8)');
          x.restore();
        }
      }
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
  const sk = WALL_SKIN[theme] || WALL_SKIN[0], acc = side < 0 ? OWN[0].c : side > 0 ? OWN[1].c : '#ffc94a';
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
    fs(x, rad(x, w, w - 6, 2, w * 1.1, [[0, sk.mid], [0.6, sk.lo], [1, '#140e12']]), 2.8, '#140e12'); // 밝은 원판이 눈에 튀지 않게 한 톤 어둡게
    x.strokeStyle = '#c8b8ff'; x.lineWidth = 1.8; x.globalAlpha = 0.55;
    ell(x, w, w, w * 0.78, w * 0.27); x.stroke();
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8; x.beginPath(); x.moveTo(w + Math.cos(a) * w * 0.5, w + Math.sin(a) * w * 0.17); x.lineTo(w + Math.cos(a) * w * 0.78, w + Math.sin(a) * w * 0.27); x.stroke(); }
    x.globalAlpha = 1;
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
    depth(x, theme);
    courtyard(x, theme);
  });
}
// 공통 깊이감(한 번 굽기 — 프레임 비용 0): 먼 곳(위)은 옅은 대기 안개로 대비를 낮추고, 가까운 곳(성벽 앞)은 따뜻한 빛 웅덩이,
// 양옆·위는 부드러운 비네트 → 평평한 매트가 아니라 안쪽으로 깊어지는 전장
const HAZE = ['rgba(236,248,255,', 'rgba(150,140,200,', 'rgba(170,215,220,', 'rgba(120,70,70,', 'rgba(120,90,190,'];
const NEAR = ['rgba(255,240,190,', 'rgba(255,179,90,', 'rgba(200,255,230,', 'rgba(255,140,60,', 'rgba(230,150,255,'];
function depth(x, theme) {
  x.fillStyle = lin(x, 0, -BLEED, 0, 520, [[0, HAZE[theme] + '0.3)'], [0.55, HAZE[theme] + '0.1)'], [1, HAZE[theme] + '0)']]);
  x.fillRect(-BLEED, -BLEED, 720 + BLEED * 2, 520 + BLEED);
  x.fillStyle = rad(x, 360, 930, 0, 420, [[0, NEAR[theme] + '0.16)'], [1, NEAR[theme] + '0)']]);
  x.fillRect(-BLEED, 500, 720 + BLEED * 2, 520);
  // 양옆 비네트는 굽지 않는다 — 화면 가장자리에 맞춰 edgeShade()가 그린다(넓은 화면에서 전장 경계에 줄이 생기지 않게)
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
}

// 화산 용암 강 두 줄기(베지어 제어점) — 배경 굽기와 흐름 연출(drawAmbient)이 같이 쓴다
const RIVERS = [[-40, 180, 160, 260, 60, 520, -40, 640], [760, 380, 560, 480, 700, 760, 760, 880]];
const bz = (p, t) => { const u = 1 - t; return [u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6], u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7]]; };
const BG = [
  // 슬라임 초원 — 밝고 탁한 풀밭(적 대비를 위해 노이즈 절반), 길 뚜렷
  (x, rnd) => {
    fillAll(x, [[0, '#96d67e'], [0.5, '#78c85a'], [1, '#5f9f4e']]);
    blobs(x, rnd, 18, 'rgba(255,255,200,0.06)', 40, 110);
    blobs(x, rnd, 18, 'rgba(30,90,20,0.06)', 40, 120);
    // 햇빛 얼룩(빛 웅덩이) — 부드러운 밝은 원 몇 개
    for (let k = 0; k < 7; k++) {
      const lx = 60 + rnd() * 600, ly = 120 + rnd() * 760, lr = 60 + rnd() * 70;
      x.fillStyle = rad(x, lx, ly, 0, lr, [[0, 'rgba(255,250,200,0.2)'], [1, 'rgba(255,250,200,0)']]);
      x.fillRect(lx - lr, ly - lr, lr * 2, lr * 2);
    }
    // 흙길 (어두운 가장자리 → 흙 → 밝은 가운데, 가까울수록 넓게)
    // 길은 좁고 차분하게(주인공은 적) — 가장자리 풀이 살짝 덮는다
    x.strokeStyle = 'rgba(110,100,50,0.22)'; x.lineWidth = 104;
    x.beginPath(); x.moveTo(300, -BLEED); x.bezierCurveTo(520, 250, 160, 550, 380, 960); x.stroke();
    x.strokeStyle = 'rgba(200,176,120,0.34)'; x.lineWidth = 88;
    x.beginPath(); x.moveTo(300, -BLEED); x.bezierCurveTo(520, 250, 160, 550, 380, 960); x.stroke();
    x.strokeStyle = 'rgba(226,210,164,0.22)'; x.lineWidth = 52; x.stroke();
    for (let k = 0; k < 40; k++) { ell(x, 250 + rnd() * 250, rnd() * 950, 3 + rnd() * 5, 2 + rnd() * 3); x.fillStyle = 'rgba(150,120,80,0.3)'; x.fill(); }
    // 풀 — 가까울수록(아래) 크게: 원근
    for (let k = 0; k < 160; k++) {
      const gx = rnd() * 760 - 20, gy = rnd() * 980, h = (5 + rnd() * 8) * (0.7 + gy / 900);
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
    // 가장자리 덤불 — 가까울수록 크게 + 바닥 그림자
    for (let k = 0; k < 16; k++) {
      const side = k % 2, by = rnd() * 950, sc = 0.7 + by / 1000, bx = side ? 700 + rnd() * 40 : rnd() * 40 - 20;
      ell(x, bx + 10, by + 22 * sc, 46 * sc, 12 * sc); x.fillStyle = 'rgba(20,60,20,0.25)'; x.fill();
      for (let j = 0; j < 4; j++) {
        circ(x, bx + (rnd() - 0.5) * 40 * sc, by + (rnd() - 0.5) * 24 * sc, (14 + rnd() * 12) * sc);
        fs(x, rad(x, bx - 6, by - 14 * sc, 2, 36 * sc, [[0, '#a4e870'], [0.5, '#6ab84a'], [1, '#3f7f3c']]), 2, 'rgba(20,70,20,0.55)');
      }
    }
    // 앞쪽 나무 두 그루(성벽 양옆, 큰 소품 — 깊이 기준점)
    for (const [tx, ty, sc] of [[34, 800, 1.25], [690, 700, 1.1], [12, 330, 0.8], [712, 180, 0.7]]) {
      ell(x, tx + 30 * sc, ty + 30 * sc, 70 * sc, 18 * sc); x.fillStyle = 'rgba(20,60,20,0.3)'; x.fill();
      x.fillStyle = '#6a4a2a'; x.fillRect(tx - 7 * sc, ty - 10 * sc, 14 * sc, 40 * sc);
      for (const [dx, dy, r] of [[-26, -30, 34], [24, -34, 32], [0, -62, 36], [-4, -26, 30]]) {
        circ(x, tx + dx * sc, ty + dy * sc, r * sc);
        fs(x, rad(x, tx + (dx - 12) * sc, ty + (dy - 14) * sc, 2, r * 1.3 * sc, [[0, '#b0ec7a'], [0.45, '#5fae44'], [1, '#2f6a2c']]), 2.2, 'rgba(20,60,20,0.6)');
      }
    }
    // 돌
    for (let k = 0; k < 10; k++) {
      const sx = 40 + rnd() * 640, sy = 120 + rnd() * 800;
      ell(x, sx, sy, 8 + rnd() * 8, 5 + rnd() * 5);
      fs(x, rad(x, sx - 3, sy - 3, 1, 14, [[0, '#e0dcd0'], [1, '#8a8478']]), 1.5, 'rgba(50,50,40,0.55)');
    }
    // 중경 소품: 바위 무더기 · 나무 울타리 토막 · 이정표 · 꽃 덤불 — 가운데 통로(길)는 비운다
    const rocks = (rx, ry, sc) => {
      ell(x, rx + 4, ry + 10 * sc, 34 * sc, 9 * sc); x.fillStyle = 'rgba(20,60,20,0.25)'; x.fill();
      for (const [dx, dy, r] of [[-14, 0, 15], [10, 2, 12], [0, -9, 11]]) {
        ell(x, rx + dx * sc, ry + dy * sc, r * sc, r * 0.78 * sc);
        fs(x, rad(x, rx + (dx - 4) * sc, ry + (dy - 5) * sc, 1, r * 1.3 * sc, [[0, '#eeeadf'], [0.55, '#b0aa9a'], [1, '#6e685c']]), 2, 'rgba(40,40,30,0.7)');
      }
    };
    rocks(150, 300, 1); rocks(590, 610, 1.15); rocks(110, 760, 1.2);
    const fence = (fx0, fy0, n, sc) => {
      ell(x, fx0 + n * 15 * sc, fy0 + 4, n * 18 * sc, 6 * sc); x.fillStyle = 'rgba(20,60,20,0.22)'; x.fill();
      x.fillStyle = '#8a5e32'; x.strokeStyle = '#3a2412'; x.lineWidth = 1.6;
      for (const yy of [-16, -8]) { rrect(x, fx0 - 4, fy0 + yy * sc, (n - 1) * 30 * sc + 8, 4 * sc, 1.5); x.fill(); x.stroke(); }
      for (let i = 0; i < n; i++) { const px = fx0 + i * 30 * sc; rrect(x, px - 4 * sc, fy0 - 26 * sc, 8 * sc, 28 * sc, 2); fs(x, lin(x, px - 4, 0, px + 4, 0, [[0, '#b88a54'], [1, '#6a4422']]), 1.6, '#3a2412'); }
    };
    fence(560, 250, 3, 0.9); fence(70, 520, 3, 1.05);
    // 이정표
    x.fillStyle = 'rgba(20,60,20,0.25)'; ell(x, 562, 866, 22, 6); x.fill();
    rrect(x, 558, 818, 7, 48, 2); fs(x, '#7a5230', 1.6, '#3a2412');
    x.save(); x.translate(562, 826); x.rotate(-0.08); poly(x, [-26, -9, 18, -9, 28, 0, 18, 9, -26, 9]); fs(x, lin(x, 0, -9, 0, 9, [[0, '#d8a868'], [1, '#9a6a36']]), 2, '#3a2412');
    x.strokeStyle = 'rgba(60,36,14,0.6)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(-18, 0); x.lineTo(10, 0); x.stroke(); x.restore();
    // 꽃 덤불(원근: 아래일수록 크게)
    for (const [bx, by] of [[200, 460], [520, 380], [470, 820], [230, 900], [610, 140]]) {
      const sc = 0.7 + by / 1100;
      for (let j = 0; j < 9; j++) {
        const px = bx + (rnd() - 0.5) * 40 * sc, py = by + (rnd() - 0.5) * 14 * sc, c = pet[(rnd() * 4) | 0];
        x.fillStyle = c; for (let q = 0; q < 5; q++) { const a = q * TAU / 5; circ(x, px + Math.cos(a) * 3.4 * sc, py + Math.sin(a) * 3.4 * sc, 2.6 * sc); x.fill(); }
        circ(x, px, py, 1.9 * sc); x.fillStyle = '#ffb020'; x.fill();
      }
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
    x.strokeStyle = 'rgba(10,6,12,0.2)'; x.lineWidth = 2;
    for (let k = 0; k < 10; k++) { let px = rnd() * 720, py = rnd() * 900; x.beginPath(); x.moveTo(px, py); for (let s = 0; s < 6; s++) { px += (rnd() - 0.5) * 50; py += rnd() * 30; x.lineTo(px, py); } x.stroke(); }
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
    // 횃불(벽걸이) + 빛웅덩이(§2.2) — 양옆 3쌍, 가까울수록 크게
    for (const [tx, ty, sc] of [[28, 860, 1.2], [692, 860, 1.2], [26, 520, 1], [694, 520, 1], [24, 200, 0.8], [696, 200, 0.8]]) {
      circ(x, tx, ty, 200 * sc);
      x.fillStyle = rad(x, tx, ty, 0, 200 * sc, [[0, 'rgba(255,179,71,0.3)'], [0.5, 'rgba(255,140,50,0.1)'], [1, 'rgba(255,120,40,0)']]); x.fill();
      x.fillStyle = '#3a2a1a'; x.fillRect(tx - 3 * sc, ty - 4 * sc, 6 * sc, 26 * sc);
      x.beginPath(); x.moveTo(tx - 7 * sc, ty - 2 * sc); x.quadraticCurveTo(tx - 6 * sc, ty - 18 * sc, tx, ty - 26 * sc); x.quadraticCurveTo(tx + 6 * sc, ty - 18 * sc, tx + 7 * sc, ty - 2 * sc); x.closePath();
      x.fillStyle = lin(x, 0, ty - 26 * sc, 0, ty, [[0, '#fff6c0'], [0.5, '#ffb347'], [1, '#e0501a']]); x.fill();
    }
    // 가운데: 은은히 밝은 흙길 + 수정 빛 웅덩이 · 중경 석순 · 빛나는 버섯 · 광차와 레일(깊이·이야기)
    x.strokeStyle = 'rgba(150,120,110,0.16)'; x.lineWidth = 120;
    x.beginPath(); x.moveTo(360, -BLEED); x.bezierCurveTo(250, 300, 470, 600, 360, 960); x.stroke();
    x.strokeStyle = 'rgba(190,160,140,0.12)'; x.lineWidth = 60; x.stroke();
    for (const [px, py, c] of [[200, 380, '120,230,255'], [520, 640, '200,140,255'], [240, 820, '120,230,255']]) {
      x.fillStyle = rad(x, px, py, 0, 130, [[0, 'rgba(' + c + ',0.18)'], [1, 'rgba(' + c + ',0)']]); x.fillRect(px - 130, py - 130, 260, 260);
    }
    const mite = (bx, by, h, sc) => {
      ell(x, bx, by + 2, 18 * sc, 5 * sc); x.fillStyle = 'rgba(0,0,0,0.35)'; x.fill();
      poly(x, [bx - 14 * sc, by, bx - 3 * sc, by - h * sc, bx + 2 * sc, by - h * 0.85 * sc, bx + 13 * sc, by]);
      fs(x, lin(x, bx - 14 * sc, 0, bx + 14 * sc, 0, [[0, '#8a7a9e'], [0.45, '#5a4c72'], [1, '#2a2240']]), 2, 'rgba(10,6,20,0.8)');
    };
    for (const [bx, by, h] of [[130, 250, 44], [150, 262, 26], [600, 470, 52], [575, 482, 30], [120, 640, 40], [630, 820, 46]]) mite(bx, by, h, 0.8 + by / 1200);
    const shroom = (mx, my, sc, col) => {
      x.fillStyle = rad(x, mx, my - 8 * sc, 0, 30 * sc, [[0, 'rgba(' + col + ',0.35)'], [1, 'rgba(' + col + ',0)']]); x.fillRect(mx - 30 * sc, my - 38 * sc, 60 * sc, 60 * sc);
      rrect(x, mx - 2.5 * sc, my - 10 * sc, 5 * sc, 11 * sc, 2); fs(x, '#e8e0f0', 1.2, 'rgba(10,6,20,0.7)');
      x.beginPath(); x.ellipse(mx, my - 10 * sc, 9 * sc, 6 * sc, 0, Math.PI, 0); x.closePath();
      fs(x, rad(x, mx - 3 * sc, my - 14 * sc, 1, 10 * sc, [[0, '#ffffff'], [0.4, 'rgb(' + col + ')'], [1, 'rgba(' + col + ',0.7)']]), 1.4, 'rgba(10,6,20,0.7)');
    };
    for (const [mx, my, c] of [[180, 300, '120,240,255'], [196, 306, '120,240,255'], [548, 520, '220,140,255'], [560, 530, '220,140,255'], [540, 534, '220,140,255'], [150, 700, '120,240,255'], [610, 880, '120,240,255']]) shroom(mx, my, 0.9 + my / 1400, c);
    // 광차 + 레일(오른쪽 중경)
    x.strokeStyle = '#5a4a3a'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(610, 150); x.lineTo(650, 420); x.moveTo(632, 150); x.lineTo(676, 420); x.stroke();
    x.strokeStyle = '#4a3a2a'; x.lineWidth = 4;
    for (let t = 0; t <= 1; t += 0.1) { const yy = 150 + t * 270; x.beginPath(); x.moveTo(605 + t * 40, yy); x.lineTo(638 + t * 44, yy); x.stroke(); }
    x.save(); x.translate(642, 300); x.rotate(-0.12);
    ell(x, 2, 22, 30, 7); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fill();
    poly(x, [-26, -14, 26, -14, 20, 12, -20, 12]); fs(x, lin(x, 0, -14, 0, 12, [[0, '#8a6a4a'], [1, '#4a3424']]), 2, '#1a1008');
    x.fillStyle = '#6a6a78'; x.fillRect(-27, -16, 54, 4);
    for (const [ox2, oy2, c] of [[-10, -18, '#7ff2ff'], [6, -20, '#c08bff'], [14, -16, '#ffd06a']]) { poly(x, [ox2 - 5, oy2 + 3, ox2, oy2 - 6, ox2 + 5, oy2 + 3]); fs(x, c, 1, 'rgba(10,10,30,0.7)'); }
    for (const wx of [-14, 14]) { circ(x, wx, 14, 5); fs(x, '#3a3a44', 1.6, '#101014'); }
    x.restore();
    // 앞쪽 종유석 실루엣(아래 모서리, 크게) — 깊이
    for (const [bx, sc, d] of [[-10, 1.6, 1], [60, 1.1, 1], [730, 1.5, -1], [660, 1, -1]]) {
      poly(x, [bx - 34 * sc, 1000, bx - 6 * sc * d, 1000 - 150 * sc, bx + 30 * sc, 1000]);
      fs(x, lin(x, bx - 30 * sc, 0, bx + 30 * sc, 0, [[0, '#4a3f5e'], [1, '#1c1630']]), 2, 'rgba(0,0,0,0.6)');
    }
  },
  // 언데드 묘지 — 위장 얼룩 제거, 넓은 안개 띠로 대체(적을 살린다)
  (x, rnd) => {
    fillAll(x, [[0, '#22363a'], [0.5, '#2c4244'], [1, '#34504e']]); // 한 톤 어둡게 — 밝은 해골이 떠 보이게
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
      const edge = rnd() < 0.6, sx = edge ? (rnd() < 0.5 ? 20 + rnd() * 90 : 610 + rnd() * 90) : 140 + rnd() * 440, sy = 80 + rnd() * 860;
      stone(sx, sy, (12 + rnd() * 8) * (0.75 + sy / 700), rnd() < 0.3); // 가까울수록 크게
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
    // 낮게 깔린 안개 덩어리(정적, 동적 안개는 drawAmbient) — 줄무늬 띠 대신 부드러운 타원
    for (let k = 0; k < 9; k++) {
      const fx = rnd() * 720, fy = 150 + k * 95 + rnd() * 40, fw = 160 + rnd() * 160;
      x.save(); x.translate(fx, fy); x.scale(1, 0.32);
      x.fillStyle = rad(x, 0, 0, 0, fw, [[0, 'rgba(200,240,228,0.16)'], [1, 'rgba(200,240,228,0)']]);
      x.fillRect(-fw, -fw, fw * 2, fw * 2);
      x.restore();
    }
    // 가운데 판석 길 + 등불 기둥 빛 웅덩이 + 앞쪽 큰 묘비(깊이)
    for (let k = 0; k < 26; k++) {
      const t = k / 25, px = 360 + Math.sin(t * 5.2) * 70 + (rnd() - 0.5) * 30, py = t * 960, s = 12 + t * 12;
      ell(x, px, py, s * 1.3, s * 0.5, (rnd() - 0.5) * 0.4);
      fs(x, 'rgba(' + (120 + rnd() * 20 | 0) + ',' + (128 + rnd() * 20 | 0) + ',' + (128 + rnd() * 16 | 0) + ',0.32)', 1.2, 'rgba(10,20,20,0.35)');
    }
    for (const [lx, ly, sc] of [[190, 330, 0.9], [540, 560, 1], [170, 800, 1.15]]) {
      x.fillStyle = rad(x, lx, ly + 40 * sc, 0, 140 * sc, [[0, 'rgba(255,214,140,0.22)'], [0.5, 'rgba(255,190,110,0.08)'], [1, 'rgba(255,180,100,0)']]);
      x.fillRect(lx - 140 * sc, ly - 100 * sc, 280 * sc, 280 * sc);
      ell(x, lx + 3, ly + 42 * sc, 12 * sc, 4 * sc); x.fillStyle = 'rgba(0,0,0,0.4)'; x.fill();
      x.fillStyle = '#1e1a1e'; x.fillRect(lx - 2.5 * sc, ly - 6 * sc, 5 * sc, 48 * sc);
      rrect(x, lx - 8 * sc, ly - 24 * sc, 16 * sc, 20 * sc, 3); fs(x, rad(x, lx, ly - 14 * sc, 1, 12 * sc, [[0, '#fff6c8'], [0.5, '#ffc860'], [1, '#c07020']]), 2, '#1e1a1e');
      poly(x, [lx - 10 * sc, ly - 24 * sc, lx, ly - 32 * sc, lx + 10 * sc, ly - 24 * sc]); fs(x, '#2a2428', 1.5, '#100c10');
    }
    for (const [sx, sy, sz, cr] of [[40, 980, 34, false], [676, 960, 30, true]]) stone(sx, sy, sz, cr);
    // 비뚤어진 나무 울타리(양옆)
    for (const side of [0, 1]) {
      const fx0 = side ? 668 : 52;
      x.strokeStyle = '#2a2622'; x.lineWidth = 3;
      for (let py = 120; py < 950; py += 46) {
        const tilt = (rnd() - 0.5) * 0.25, h = 30 + rnd() * 10;
        x.save(); x.translate(fx0 + (rnd() - 0.5) * 6, py); x.rotate(tilt);
        rrect(x, -4, -h, 8, h, 2); fs(x, '#6a5e52', 2, '#1e1a18');
        x.restore();
      }
      x.beginPath(); x.moveTo(fx0 - 6, 110); x.lineTo(fx0 + 6, 960); x.stroke();
    }
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
      x.lineWidth = 1.4; x.strokeStyle = `rgba(255,90,30,${0.12 * clamp(Math.abs(cx - 360) / 300, 0.3, 1)})`; x.stroke(); // 가운데(적 통로)는 옅게
    }
    // 용암 강(폭 2/3, 채도 유지)
    // 용암 강: 곡선을 따라 폭이 들쭉날쭉한 띠(굳은 검은 껍질 가장자리 → 주황 → 노랑 속살) + 떠다니는 껍질 조각
    const river = pts => {
      const P = [], N = 40;
      for (let i = 0; i <= N; i++) {
        const t = i / N, u = 1 - t;
        P.push([u * u * u * pts[0] + 3 * u * u * t * pts[2] + 3 * u * t * t * pts[4] + t * t * t * pts[6], u * u * u * pts[1] + 3 * u * u * t * pts[3] + 3 * u * t * t * pts[5] + t * t * t * pts[7]]);
      }
      const W = P.map((_, i) => 0.75 + 0.35 * Math.sin(i * 0.9 + pts[0]) + 0.2 * rnd());
      const band = (w, fill) => {
        x.beginPath();
        for (let i = 0; i <= N; i++) {
          const [px, py] = P[i], [qx, qy] = P[Math.min(N, i + 1)], [rx, ry] = P[Math.max(0, i - 1)];
          const dx = qx - rx, dy = qy - ry, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
          i ? x.lineTo(px + nx * w * W[i], py + ny * w * W[i]) : x.moveTo(px + nx * w * W[i], py + ny * w * W[i]);
        }
        for (let i = N; i >= 0; i--) {
          const [px, py] = P[i], [qx, qy] = P[Math.min(N, i + 1)], [rx, ry] = P[Math.max(0, i - 1)];
          const dx = qx - rx, dy = qy - ry, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
          x.lineTo(px - nx * w * W[i], py - ny * w * W[i]);
        }
        x.closePath(); x.fillStyle = fill; x.fill();
      };
      band(30, 'rgba(255,80,20,0.1)'); // 채도 높은 주황은 이펙트 몫 — 강은 한 톤 낮춤(약 -35%)
      band(19, '#1a0c0c');
      band(14, '#8e2c10');
      band(9, '#b85a1e');
      band(4, '#d09a36');
      for (let i = 3; i < N; i += 5) { // 껍질 조각
        const [px, py] = P[i];
        ell(x, px + (rnd() - 0.5) * 8, py + (rnd() - 0.5) * 8, 4 + rnd() * 4, 2.5 + rnd() * 2, rnd() * 3);
        x.fillStyle = '#2a1410'; x.fill();
      }
    };
    for (const rv of RIVERS) river(rv);
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
    // 가운데 통로: 식은 현무암 길 + 길가에서 새어 나오는 가는 빛 균열
    x.strokeStyle = 'rgba(70,56,64,0.35)'; x.lineWidth = 110;
    x.beginPath(); x.moveTo(360, -BLEED); x.bezierCurveTo(420, 300, 300, 640, 360, 960); x.stroke();
    for (let k = 0; k < 16; k++) {
      let px = (k % 2 ? 420 : 300) + (rnd() - 0.5) * 60, py = 40 + k * 58 + rnd() * 30;
      x.beginPath(); x.moveTo(px, py);
      for (let q = 0; q < 4; q++) { px += (rnd() - 0.5) * 26; py += 6 + rnd() * 12; x.lineTo(px, py); }
      x.lineWidth = 4; x.strokeStyle = 'rgba(255,90,20,0.14)'; x.stroke();
      x.lineWidth = 1.4; x.strokeStyle = 'rgba(255,170,60,0.55)'; x.stroke();
    }
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
    x.fillStyle = lin(x, 250, 0, 470, 0, [[0, '#140c26'], [0.5, '#2a1a4a'], [1, '#140c26']]); // 깊은 보라·검정(붉은 보스와 대비)
    x.fillRect(260, -BLEED, 200, 1000 + BLEED);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(260, -BLEED, 10, 1000 + BLEED); x.fillRect(450, -BLEED, 10, 1000 + BLEED);
    x.fillStyle = 'rgba(217,164,65,0.45)'; x.fillRect(266, -BLEED, 3, 1000 + BLEED); x.fillRect(451, -BLEED, 3, 1000 + BLEED); // 금테 선
    x.fillStyle = 'rgba(217,164,65,0.6)'; // 가장자리 금실 마름모 무늬(점선처럼 끊겨 안내선으로 읽히지 않게)
    for (let yy = -BLEED + 10; yy < 1000; yy += 34) for (const ex of [272, 448]) poly(x, [ex, yy - 7, ex + 5, yy, ex, yy + 7, ex - 5, yy]), x.fill();
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
    // 달은 여기 굽지 않는다 — 이 타일은 topExtra 높이로 늘어나 원이 찌그러진다(drawBackground의 graveMoon이 비율 그대로 그린다)
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
  const aw = WORLD_W + sideX * 2;
  if (ambTheme !== theme || amb.length !== Math.round(A.n * aw / WORLD_W)) { // 넓은 화면이면 폭만큼 더
    ambTheme = theme;
    amb = [];
    for (let i = 0, n = Math.round(A.n * aw / WORLD_W); i < n; i++) amb.push({ x: rnd() * aw - sideX, y: rnd() * WALL_Y, ph: rnd() * TAU, s: 0.5 + rnd(), v: 0.5 + rnd() });
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
  if (theme === 3) { // 용암이 흐른다: 강을 따라 밝은 맥동이 천천히 흘러 내려감(가산 글로우 16장)
    additive(true);
    const lg = gl('#ffb03a');
    for (const rv of RIVERS) for (let k = 0; k < 8; k++) {
      const t = ((T * 0.05 + k / 8) % 1), [px, py] = bz(rv, t);
      ctx.globalAlpha = 0.2 + 0.12 * Math.sin(T * 3 + k * 1.7);
      spr(lg, px, py, 60, 60);
    }
    ctx.globalAlpha = 1;
    additive(false);
  }
  ctx.globalCompositeOperation = 'lighter';
  const g = gl(A.col);
  for (const p of amb) {
    p.y += A.vy * p.v * da;
    p.x += Math.sin(T * 0.8 + p.ph) * 12 * da;
    if (p.y < -20 - topExtra * 0.5) { p.y = WALL_Y; p.x = rnd() * aw - sideX; }
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
  const ratio = view.wall && view.wall.max > 0 ? clamp(view.wall.hp / view.wall.max, 0, 1) : 1;
  const lvl = ratio < 0.25 ? 3 : ratio < 0.5 ? 2 : ratio < 0.75 ? 1 : 0;
  if (COLLAPSE.t >= 0) drawCollapse(w, x, y);
  else {
    if (sideX > 0.5) { sides(w, -20, y, w.hh * 2); ctx.save(); ctx.translate(ws, 0); mid(w, -20, y, w.hh * 2); ctx.restore(); } // 넓은 화면: 성벽이 양옆으로 이어진다
    else ctx.drawImage(w, x, y, w.hw * 2, w.hh * 2);
    if (lvl) ctx.drawImage(cracks(lvl), x, y, w.hw * 2, w.hh * 2);
  }
  const red = Math.max(wallFlash * 0.85, ratio < 0.3 && view.phase === 'play' ? 0.25 + 0.2 * Math.sin(RT * 8) : 0);
  if (red > 0) {
    ctx.globalAlpha = red;
    ctx.drawImage(wallTint(theme), x, y, w.hw * 2, w.hh * 2);
    ctx.globalAlpha = 1;
  }
  // 마법사 단(P1 금 / P2 청록) + 영웅 성문 — 마법사·영웅 스프라이트보다 먼저(발밑)
  const heroGateX = HERO_GATE.x, heroGateY = HERO_GATE.y; // 솔로: 마법사 단 오른쪽 옆
  ctx.drawImage(platform(theme, mageOn(view, 1) ? -1 : 0), mageX(view, 0) - 62, MAGE_FEET - 62, 124, 124); // 솔로: 가운데 단 하나(B)
  if (mageOn(view, 1)) ctx.drawImage(platform(theme, 1), mageX(view, 1) - 62, MAGE_FEET - 62, 124, 124);
  ctx.drawImage(heroGatePlatform(theme), heroGateX - 74, heroGateY - 74, 148, 148);
  // 성벽 결계: 성벽 강화(협동이면 두 마법사 합)가 오를수록 진해지는 룬 방어막 (무너진 뒤엔 꺼짐)
  const ls = COLLAPSE.t >= 0 ? 0 : ((view.players[0] && view.players[0].lv ? view.players[0].lv.wall : 0) | 0) + (mageOn(view, 1) && view.players[1].lv ? view.players[1].lv.wall | 0 : 0);
  const ba = clamp(0.16 + 0.11 * Math.log2(1 + ls), 0.16, 0.8);
  additive(true);
  ctx.globalAlpha = ba * 0.5;
  spr(gl('#6fb8ff'), 360, WALL_Y - 14, 840 + sideX * 2, 60);
  ctx.globalAlpha = ba * (0.75 + 0.25 * Math.sin(RT * 2.2));
  const rbW = 820 + Math.ceil(sideX / 48) * 96;
  ctx.drawImage(runeBand('#9fd0ff'), -30 - Math.ceil(sideX / 48) * 48 - (RT * 16) % 48, WALL_Y - 36, rbW, 24);
  ctx.globalAlpha = ba * (0.5 + 0.3 * Math.sin(RT * 3.1));
  ctx.fillStyle = '#e0f4ff';
  ctx.fillRect(-30 - sideX, WALL_Y - 40, 780 + sideX * 2, 2);
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
  // 룬 결계 명판: 바 위를 흐르는 룬 띠 + 왼쪽 방패 문장(결계 강도만큼 빛남)
  additive(true);
  ctx.save(); rr(bx, by, bw * ratio, bh, 6); ctx.clip();
  ctx.globalAlpha = 0.35;
  ctx.drawImage(runeBand('#ffffff'), bx - 48 + (RT * 20) % 48, by + bh / 2 - 8, 820, 16);
  ctx.restore();
  ctx.globalAlpha = 0.5 + 0.3 * Math.sin(RT * 2.2);
  spr(gl('#6fb8ff'), bx - 4, by + bh / 2, 90, 90);
  ctx.globalAlpha = 1;
  additive(false);
  ctx.drawImage(wardCap(), bx - 30, by + bh / 2 - 26, 52, 52);
  ctx.textBaseline = 'middle';
  txt(`성벽 결계  ${fmt(view.wall ? view.wall.hp : 0)} / ${fmt(view.wall ? view.wall.max : 0)}`, 372, by + bh / 2 + 1, 15, '#ffffff', '#1a0a14', 4);
}
// 도전 종료(성벽 붕괴): 성벽이 8토막으로 갈라져 차례로 주저앉는다 — 금 간 돌 + 기울어짐 + 흙먼지
const COLLAPSE = { t: -1 };
function drawCollapse(w, x, y) {
  const t = COLLAPSE.t, n = 8, cw = w.width / n, pw = w.hw * 2 / n;
  const top = WALL_Y - 90, bot = 1046; // 체력 명판 위까지만 가라앉는다
  ctx.save(); ctx.beginPath(); ctx.rect(-40, top, WORLD_W + 80, bot - top); ctx.clip();
  const cr = cracks(3);
  // 무너진 틈 뒤로 보이는 어두운 잔해 구덩이
  ctx.globalAlpha = Math.min(1, t * 3) * 0.92; ctx.fillStyle = '#1a1016';
  ctx.fillRect(-40, y + w.hh * 0.35, WORLD_W + 80, bot - (y + w.hh * 0.35)); ctx.globalAlpha = 1;
  for (let k = 0; k < n; k++) {
    const d = clamp(t - (k * 0.37 % 1) * 0.35, 0, 1.2), e = easeIn(Math.min(1, d / 0.7));
    const dy = e * (38 + (k % 3) * 16), rot = (k % 2 ? 1 : -1) * e * (0.07 + (k % 3) * 0.03);
    const cx = x + pw * (k + 0.5), cy = y + w.hh * 2;
    ctx.save();
    ctx.translate(cx, cy + dy); ctx.rotate(rot);
    const g2 = 3 * e; // 토막 사이 틈
    ctx.drawImage(w, k * cw, 0, cw, w.height, -pw / 2 + g2, -w.hh * 2, pw - g2 * 2, w.hh * 2);
    ctx.drawImage(cr, k * cr.width / n, 0, cr.width / n, cr.height, -pw / 2 + g2, -w.hh * 2, pw - g2 * 2, w.hh * 2);
    ctx.globalAlpha = 0.35 * e; ctx.fillStyle = '#1a0f14'; ctx.fillRect(-pw / 2, -w.hh * 2, pw, w.hh * 2); ctx.globalAlpha = 1;
    ctx.restore();
  }
  ctx.restore();
}
const easeIn = u => u * u;
// 성벽 체력바 왼쪽 방패 문장 (금 테 + 푸른 방패 + 룬)
function wardCap() {
  return bake('w:wardcap', 26, 26, x => {
    circ(x, 0, 0, 23); fs(x, rad(x, 0, 0, 2, 23, [[0, '#5a4a8a'], [1, '#231a44']], -6, -8), 3, '#140e12');
    circ(x, 0, 0, 20); x.lineWidth = 3; x.strokeStyle = '#ffc92e'; x.stroke();
    x.beginPath(); x.moveTo(0, -14); x.lineTo(11, -9); x.lineTo(10, 2); x.quadraticCurveTo(8, 10, 0, 15); x.quadraticCurveTo(-8, 10, -10, 2); x.lineTo(-11, -9); x.closePath();
    fs(x, lin(x, -11, -14, 11, 15, [[0, '#d8f4ff'], [0.45, '#6fb8ff'], [0.5, '#2a78e0'], [1, '#1450b8']]), 2.4, '#140e12');
    x.strokeStyle = '#ffffff'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, -8); x.lineTo(0, 8); x.moveTo(-5, -2); x.lineTo(5, -2); x.stroke();
    shine(x, -5, -9, 3.5, 1.8, -0.6, 0.8);
  });
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
    const s = (ri >= 4 ? 76 : ri >= 3 ? 62 : 52) * k * (t < 0.12 ? easeBack(t / 0.12) : 1); // 바닥 드롭 1.4배 — 전리품이 읽히게
    if (t < L.hold) { ctx.globalAlpha = 0.5 * drop; spr(shadow(), L.x, L.y + 8, s * 0.9 * (0.6 + 0.4 * drop), s * 0.26); ctx.globalAlpha = 1; } // 접지 그림자
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
  const wide = sideX > 0.5;
  if (wide) { sides(bg, -BLEED, -BLEED, WORLD_H + BLEED * 2); mid(bg, -BLEED, -BLEED, WORLD_H + BLEED * 2); }
  else ctx.drawImage(bg, -BLEED, -BLEED, WORLD_W + BLEED * 2, WORLD_H + BLEED * 2);
  // 세로로 긴 화면: 월드 위 여분(topExtra)을 테마별 원경(하늘·먼 배경)으로 채운다(§2.2) — 전체 타일을 topExtra 높이에 맞춰 늘린다(맨 아래 = 지평선)
  if (topExtra > 0.5) {
    const far = farBg(theme), sh = Math.min(90, topExtra), sm = seam(theme);
    if (wide) { sides(far, -BLEED, -topExtra, topExtra); mid(far, -BLEED, -topExtra, topExtra); sides(sm, -BLEED, -sh, sh); mid(sm, -BLEED, -sh, sh); }
    else { ctx.drawImage(far, -BLEED, -topExtra, WORLD_W + BLEED * 2, topExtra); ctx.drawImage(sm, -BLEED, -sh, WORLD_W + BLEED * 2, sh); }
  }
  if (theme === 2) graveMoon();
  // 어두운 테마(동굴·묘지·화산·마왕성): 적이 걷는 전장 가운데에 넓은 빛 웅덩이(가산 1장) → 중간 톤을 올려 적이 배경에서 떠 보이게 (§2.2)
  const LP = LIGHT_POOL[theme];
  if (LP) {
    additive(true);
    ctx.globalAlpha = LP[1];
    spr(gl(LP[0]), 360, 470, 1000, 1150);
    ctx.globalAlpha = 1;
    additive(false);
  }
  edgeShade();
}
// 묘지 달: 위 여분 하늘에 비율 그대로(늘어난 원경 타일에 굽지 않음). 상단 HUD 띠(월드 y < 90 - topExtra) 아래 · 지평선(y 0) 위에
// 둘 자리가 없으면(짧은 화면) 그리지 않는다 — HUD 알약 뒤로 납작한 원이 비치던 문제. 후광 + 음영 + 분화구
const MOON_R = 26;
function graveMoon() {
  const y = 90 - topExtra + MOON_R * 1.6;
  if (y > -MOON_R - 8) return;
  const m = bake('graveMoon', MOON_R * 2.6, MOON_R * 2.6, x => {
    const r = MOON_R;
    circ(x, 0, 0, r * 2.6); x.fillStyle = rad(x, 0, 0, r * 0.8, r * 2.6, [[0, 'rgba(200,240,225,0.35)'], [1, 'rgba(200,240,225,0)']]); x.fill();
    circ(x, 0, 0, r); x.fillStyle = rad(x, 0, 0, 0, r, [[0, '#fbfff6'], [0.7, '#e2f2e8'], [1, '#b9d6c8']], -r * 0.35, -r * 0.35); x.fill();
    x.lineWidth = 2; x.strokeStyle = 'rgba(40,70,64,0.55)'; x.stroke();
    x.fillStyle = 'rgba(120,160,148,0.35)';
    for (const [cx, cy, cr] of [[-8, -6, 6], [9, 5, 4.5], [-2, 11, 3.5], [10, -10, 3]]) { circ(x, cx, cy, cr); x.fill(); }
  });
  ctx.drawImage(m, 560 - m.hw, y - m.hh, m.hw * 2, m.hh * 2);
}

// 넓은 화면(폴더블 펼침·가로·데스크톱): 월드 밖 양옆을 같은 테마 그림으로 잇는다.
// 가장자리 띠(STRIP)를 거울처럼 번갈아 뒤집어 붙인다(핑퐁) → 이음매 없음, 가운데 길·강이 복제되지 않음, 늘린 그림 없음.
// img 는 월드 x = left 부터 가로로 놓인 텍스처(hw = 반폭). ponytail: 핑퐁 타일 — 테마별 전용 옆 지형 그림은 필요해지면 추가
const STRIP = 240;
function sides(img, left, y, h) {
  const k = img.width / (img.hw * 2), o = 2; // o = 안쪽으로 겹쳐 그리는 폭(반픽셀 틈 방지)
  for (let n = 0, d = 0; d < sideX + 1 && n < 10; n++, d += STRIP) {
    const w = Math.min(STRIP, sideX + 1 - d), flip = n % 2 === 0; // 짝수 칸 = 거울, 홀수 칸 = 원본 그대로
    for (const side of [-1, 1]) {
      const dx = side < 0 ? -d - w : WORLD_W + d - o; // 그릴 자리(월드 x), 폭 w + o
      const src = side < 0 ? (flip ? -o : STRIP - w) : (flip ? WORLD_W - w : WORLD_W - STRIP - o); // 원본 띠(월드 x)
      ctx.save();
      if (flip) { ctx.translate(dx * 2 + w + o, 0); ctx.scale(-1, 1); }
      ctx.drawImage(img, (src - left) * k, 0, (w + o) * k, img.height, dx, y, w + o, h);
      ctx.restore();
    }
  }
}
// 넓은 화면: 가운데는 월드 0~720만(굽힌 여백 BLEED가 거울 띠 위에 겹쳐 이음매가 생기지 않게)
function mid(img, left, y, h) {
  const k = img.width / (img.hw * 2);
  ctx.drawImage(img, (0 - left) * k, 0, WORLD_W * k, img.height, 0, y, WORLD_W, h);
}
// 화면 양옆 가장자리 비네트: 좁은 화면은 전장 가장자리 100, 넓은 화면은 옆 여분 전체에 걸쳐 바깥으로 어두워진다
// → 전장(720 폭)이 자연스럽게 중심이 되고, 옆 여분의 UI(스킬 스택·영웅 상태)도 읽힌다
function edgeShade() {
  const w = 100 + sideX, a = 0.34 + 0.3 * Math.min(1, sideX / 160);
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -sideX : WORLD_W + sideX, x1 = x0 - side * w;
    ctx.fillStyle = lin(ctx, x0, 0, x1, 0, [[0, `rgba(8,4,20,${a})`], [0.55, `rgba(10,6,24,${a * 0.3})`], [1, 'rgba(10,6,24,0)']]);
    ctx.fillRect(Math.min(x0, x1), -topExtra - 40, w, 1016 + topExtra + 40);
  }
}
// 이음매 텍스처: 전장 배경 맨 위 90줄을 위아래로 뒤집고 위로 갈수록 투명하게(한 번 굽기)
function seam(theme) {
  return bake('w:seam|' + theme, 360 + BLEED, 45, x => {
    const bg = background(theme), c = x.canvas;
    x.setTransform(1, 0, 0, 1, 0, 0);
    const sy = BLEED / (1100 + BLEED * 2) * bg.height, sh2 = 90 / (1100 + BLEED * 2) * bg.height;
    x.save(); x.translate(0, c.height); x.scale(1, -1);
    x.drawImage(bg, 0, sy, bg.width, sh2, 0, 0, c.width, c.height);
    x.restore();
    x.globalCompositeOperation = 'destination-in';
    const g = x.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  }, 0.5);
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
      case 'runOver':
        if (ev.victory) break;
        COLLAPSE.t = 0;
        shake(0.9);
        for (let k = 0; k < 8; k++) { // 토막마다 흙먼지·돌 조각
          const bx = 45 + k * 90;
          burst(K_DEBRIS, bx, WALL_Y, 5, 120, 380, 1.2, 8, ['#a8a08e', '#6a6254', '#d8d2c4', '#4a4238'], 900, 0.4, 260);
          part(K_SMOKE, bx, WALL_Y - 10, (rnd() - 0.5) * 60, -50 - rnd() * 40, 1.8, 110, 'rgba(150,135,120,0.6)', 0, 0.6);
        }
        break;
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
  if (COLLAPSE.t >= 0) {
    const t0 = COLLAPSE.t;
    COLLAPSE.t += dt;
    if (t0 < 0.9 && rnd() < dt * 20) burst(K_DEBRIS, 40 + rnd() * 640, WALL_Y - 20, 2, 60, 200, 0.9, 6, ['#a8a08e', '#6a6254'], 900, 0.4, 80);
    if (t0 < 2.5 && rnd() < dt * 6) part(K_SMOKE, 40 + rnd() * 640, WALL_Y + 10, (rnd() - 0.5) * 30, -30, 2, 90, 'rgba(160,145,130,0.45)', 0, 0.5); // 흙먼지가 한동안 피어오른다
    if (view.phase === 'play' && view.wall && view.wall.hp > 0) COLLAPSE.t = -1; // 새 도전
  }
  wallFlash = Math.max(0, wallFlash - dt * 5);
  wallShake = Math.max(0, wallShake - dt * 4);
  const wr = view.wall && view.wall.max > 0 ? clamp(view.wall.hp / view.wall.max, 0, 1) : 1;
  wallLag = Math.max(wr, wallLag - 0.35 * dt);
}

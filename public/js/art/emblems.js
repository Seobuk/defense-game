// 엠블럼 — 판타지 스킬 14종 · 원소 융합 8종 · 히든 조합 14종 · 협공 15종의 "그린" 아이콘(캔버스 경로 → 오프스크린 캐시).
// 한 벌의 손: 굵은 잉크 외곽(INK2) + 3단 셀 셰이딩 + 좌상단 광택 + 뒤 빛. 카드 선택·스킬 칩·도감(DOM, dataURL)과
// 컷인·조합 줄(캔버스)이 같은 그림을 쓴다. ART.md §8 · §10.4 · §10.9
// 좌표: 100 × 100 (중심 0,0), 그림은 ±44 안.
import { FUSIONS, COLLABS } from '../config.js';
import { TAU, INK2, EL, bake, cel, lin, rad, rgb, shine } from './core.js';

const LW = 4.2;
const ca = (c, a) => { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; };
const C = (x, cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, TAU); };
const E = (x, cx, cy, rx, ry, rot = 0) => { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, TAU); };
function P(x, pts) { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]); x.closePath(); }
function ink(x, fill, lw = LW) { x.fillStyle = fill; x.fill(); if (lw) { x.lineWidth = lw; x.strokeStyle = INK2; x.stroke(); } }
// 굵은 잉크 선 위에 색 선(곡선 획용)
function stroke2(x, col, w, hi) {
  x.lineWidth = w + LW * 2; x.strokeStyle = INK2; x.stroke();
  x.lineWidth = w; x.strokeStyle = col; x.stroke();
  if (hi) { x.lineWidth = Math.max(1.5, w * 0.28); x.strokeStyle = 'rgba(255,255,255,0.75)'; x.stroke(); }
}
function glowBack(x, col, r, cx = 0, cy = 0, a = 0.55) {
  x.fillStyle = rad(x, cx, cy, 0, r, [[0, ca(col, a)], [0.55, ca(col, a * 0.35)], [1, ca(col, 0)]]);
  x.fillRect(cx - r, cy - r, r * 2, r * 2);
}
function orb(x, cx, cy, r, core, main, edge, lw = LW) {
  C(x, cx, cy, r);
  ink(x, rad(x, cx, cy, r * 0.08, r, [[0, core], [0.42, main], [1, edge]], cx - r * 0.35, cy - r * 0.4), lw);
  shine(x, cx - r * 0.38, cy - r * 0.42, r * 0.32, r * 0.18, -0.7, 0.85);
}
// 물방울 불꽃 혀: (cx,cy) 둥근 쪽 반지름 r, ang 방향으로 len 만큼 뾰족
function tongue(x, cx, cy, r, len, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), T2 = (u, v) => [cx + u * c - v * s, cy + u * s + v * c];
  x.beginPath();
  let p = T2(0, -r); x.moveTo(p[0], p[1]);
  const a = T2(len * 0.45, -r * 1.05), b = T2(len * 0.8, -r * 0.35), t = T2(len, 0);
  x.bezierCurveTo(a[0], a[1], b[0], b[1], t[0], t[1]);
  const d = T2(len * 0.8, r * 0.35), e = T2(len * 0.45, r * 1.05); p = T2(0, r);
  x.bezierCurveTo(d[0], d[1], e[0], e[1], p[0], p[1]);
  x.arc(cx, cy, r, ang + Math.PI / 2, ang + Math.PI * 1.5);
  x.closePath();
}
function fireGrad(x, x0, y0, x1, y1) { return lin(x, x0, y0, x1, y1, [[0, '#fff2a0'], [0.35, '#ffb030'], [0.7, '#ff6a1f'], [1, '#c22a10']]); }
function bolt(x, pts, w = 1) { // 번개 지그재그 (노랑 + 잉크)
  P(x, pts);
  ink(x, lin(x, 0, -40, 0, 40, [[0, '#ffffff'], [0.3, '#fff27a'], [1, '#ffc21a']]), LW * w);
}
function star4(x, cx, cy, r, col = '#ffffff') {
  x.beginPath();
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 - Math.PI / 2, rr = k % 2 ? r * 0.28 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath(); x.fillStyle = col; x.fill();
}
function burstShape(x, cx, cy, r, n, inner) {
  x.beginPath();
  for (let k = 0; k < n * 2; k++) { const a = k * Math.PI / n - Math.PI / 2, rr = k % 2 ? r * inner : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath();
}
function cloud(x, cx, cy, s, base) {
  x.beginPath();
  for (const [dx, dy, r] of [[-18, 4, 12], [-6, -6, 15], [10, -4, 13], [20, 6, 10], [0, 8, 14]]) x.moveTo(cx + (dx + r) * s, cy + dy * s), x.arc(cx + dx * s, cy + dy * s, r * s, 0, TAU);
  ink(x, cel(x, cx - 30 * s, cy - 20 * s, cx + 30 * s, cy + 20 * s, base, 0.3, 0.25));
}
function leaf(x, cx, cy, s, ang, col = '#8ae070') {
  x.save(); x.translate(cx, cy); x.rotate(ang);
  x.beginPath(); x.moveTo(-7 * s, 0); x.quadraticCurveTo(0, -6 * s, 7 * s, 0); x.quadraticCurveTo(0, 6 * s, -7 * s, 0); x.closePath();
  x.restore();
  ink(x, col, 2.4);
}
function skull(x, cx, cy, s, bone = '#fff1d6') {
  x.beginPath(); x.arc(cx, cy - 4 * s, 16 * s, Math.PI * 0.85, Math.PI * 0.15); x.lineTo(cx + 10 * s, cy + 14 * s); x.lineTo(cx - 10 * s, cy + 14 * s); x.closePath();
  ink(x, cel(x, cx - 16 * s, cy - 20 * s, cx + 16 * s, cy + 14 * s, bone, 0.2, 0.25));
  for (const d of [-1, 1]) { E(x, cx + d * 6.5 * s, cy - 2 * s, 4.6 * s, 5.4 * s); x.fillStyle = INK2; x.fill(); }
  P(x, [cx, cy + 3 * s, cx - 2.5 * s, cy + 8 * s, cx + 2.5 * s, cy + 8 * s]); x.fillStyle = INK2; x.fill();
}
function coinG(x, cx, cy, r) {
  E(x, cx, cy, r, r * 0.92);
  ink(x, rad(x, cx, cy, 1, r, [[0, '#fff6b0'], [0.6, '#ffc83a'], [1, '#d08a10']], cx - r * 0.3, cy - r * 0.35), 3);
  E(x, cx, cy, r * 0.6, r * 0.55); x.lineWidth = 2; x.strokeStyle = 'rgba(150,90,10,0.8)'; x.stroke();
  shine(x, cx - r * 0.35, cy - r * 0.4, r * 0.3, r * 0.16, -0.7, 0.9);
}
function gem(x, cx, cy, s, main = '#4fd8ff', dark = '#1a7ff0') {
  P(x, [cx - 16 * s, cy - 6 * s, cx - 8 * s, cy - 16 * s, cx + 8 * s, cy - 16 * s, cx + 16 * s, cy - 6 * s, cx, cy + 18 * s]);
  ink(x, lin(x, cx - 16 * s, cy - 16 * s, cx + 16 * s, cy + 18 * s, [[0, '#ffffff'], [0.3, main], [0.7, main], [1, dark]]));
  x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,0.7)';
  x.beginPath(); x.moveTo(cx - 16 * s, cy - 6 * s); x.lineTo(cx + 16 * s, cy - 6 * s); x.moveTo(cx - 8 * s, cy - 16 * s); x.lineTo(cx - 4 * s, cy - 6 * s); x.lineTo(cx, cy + 16 * s); x.stroke();
}

// ═════════ 스킬 14종 ═════════
const SPELL_ART = {
  fireball: x => { // 불꽃 혀를 길게 끄는 화염구(오른쪽 위로 날아감)
    glowBack(x, '#ff6a1f', 50, -4, 6);
    for (const [r, len, a, ox, oy] of [[17, 70, 2.36, 0, 0], [11, 52, 2.0, 4, 6], [11, 52, 2.72, -6, -2]]) { tongue(x, 8 + ox, -8 + oy, r, len, a); ink(x, fireGrad(x, 8, -8, -40, 40), 3.4); }
    orb(x, 10, -10, 19, '#fffbe0', '#ffb030', '#d8400e');
    C(x, 8, -12, 7); x.fillStyle = 'rgba(255,255,220,0.9)'; x.fill();
  },
  flameBullet: x => { // 불꽃 마탄: 불꽃을 두른 마력탄 하나 + 작은 탄 둘 (혜성처럼 비스듬히)
    glowBack(x, '#ffb030', 48);
    for (const [cx, cy, s] of [[-24, -10, 0.6], [4, 30, 0.55]]) { tongue(x, cx, cy, 11 * s, 44 * s, 2.36); ink(x, fireGrad(x, cx, cy, cx - 30, cy + 30), 3); orb(x, cx, cy, 11 * s, '#fffbe0', '#ffc94a', '#b86a08', 3); }
    tongue(x, 14, -12, 15, 62, 2.36); ink(x, fireGrad(x, 14, -12, -30, 32));
    orb(x, 14, -12, 16, '#ffffff', '#ffd23a', '#c26a00');
    star4(x, 13, -13, 9, '#fffbe0');
  },
  lightningStrike: x => {
    glowBack(x, '#ffe53a', 46, 4, 18);
    cloud(x, 0, -22, 1.25, '#c8c0f0');
    bolt(x, [2, -10, -14, 12, -2, 12, -12, 40, 18, 4, 4, 4, 14, -10]);
    for (const [cx, cy] of [[-24, 36], [-2, 42]]) star4(x, cx, cy, 7, '#fff6a0');
  },
  chainLightning: x => {
    glowBack(x, '#ffe53a', 50);
    x.beginPath(); x.moveTo(-30, 22); x.lineTo(-18, -2); x.lineTo(-8, 10); x.lineTo(2, -18); x.lineTo(12, -2); x.lineTo(22, -14); x.lineTo(30, 10);
    x.lineJoin = 'round'; stroke2(x, '#ffe53a', 6, true);
    orb(x, -30, 22, 10, '#ffffff', '#fff27a', '#b08a00', 3.4);
    orb(x, 2, -18, 10, '#ffffff', '#fff27a', '#b08a00', 3.4);
    orb(x, 30, 10, 10, '#ffffff', '#fff27a', '#b08a00', 3.4);
    star4(x, -8, 10, 8, '#ffffff'); star4(x, 22, -14, 7, '#ffffff');
  },
  iceLance: x => {
    glowBack(x, '#7fe3ff', 48);
    x.save(); x.rotate(-Math.PI / 4);
    P(x, [0, -46, 9, -30, 7, 30, 0, 38, -7, 30, -9, -30]);
    ink(x, lin(x, -9, 0, 9, 0, [[0, '#ffffff'], [0.45, '#bff4ff'], [0.5, '#7fe3ff'], [1, '#2a78e0']]));
    x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,0.8)'; x.beginPath(); x.moveTo(0, -42); x.lineTo(0, 34); x.stroke();
    P(x, [-16, 26, 16, 26, 10, 34, -10, 34]); ink(x, cel(x, -16, 24, 16, 36, '#5fb8f0'));
    x.restore();
    for (const [cx, cy, r] of [[-26, -18, 6], [24, 20, 5], [-14, 30, 4]]) { P(x, [cx, cy - r, cx + r * 0.7, cy, cx, cy + r, cx - r * 0.7, cy]); ink(x, '#dff8ff', 2.4); }
  },
  frostWard: x => {
    glowBack(x, '#7fe3ff', 50);
    x.beginPath(); x.moveTo(0, -40); x.lineTo(32, -28); x.lineTo(30, 4); x.quadraticCurveTo(26, 30, 0, 42); x.quadraticCurveTo(-26, 30, -30, 4); x.lineTo(-32, -28); x.closePath();
    ink(x, cel(x, -32, -40, 32, 42, '#3fa9ff', 0.35, 0.3));
    x.beginPath(); x.moveTo(0, -30); x.lineTo(22, -21); x.lineTo(21, 3); x.quadraticCurveTo(18, 22, 0, 31); x.quadraticCurveTo(-18, 22, -21, 3); x.lineTo(-22, -21); x.closePath();
    x.lineWidth = 2.5; x.strokeStyle = 'rgba(220,250,255,0.8)'; x.stroke();
    x.lineCap = 'round'; x.strokeStyle = '#ffffff'; x.lineWidth = 4;
    for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; x.beginPath(); x.moveTo(Math.cos(a) * 15, 2 + Math.sin(a) * 15); x.lineTo(-Math.cos(a) * 15, 2 - Math.sin(a) * 15); x.stroke(); }
    x.lineWidth = 2.5;
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, px = Math.cos(a) * 10, py = 2 + Math.sin(a) * 10; x.beginPath(); x.moveTo(px + Math.cos(a + 2.2) * 4, py + Math.sin(a + 2.2) * 4); x.lineTo(px, py); x.lineTo(px + Math.cos(a - 2.2) * 4, py + Math.sin(a - 2.2) * 4); x.stroke(); }
    shine(x, -16, -22, 7, 3.5, -0.5, 0.8);
  },
  tornado: x => {
    glowBack(x, '#6ff0c0', 50);
    // 소용돌이 띠 5겹: 위는 넓고 아래로 좁아지며 S자로 휜다(깔때기 아이콘처럼 곧지 않게)
    const bands = [[-2, -30, 34, 9], [6, -14, 27, 8], [-4, 0, 20, 7], [4, 14, 13, 6], [-2, 26, 7, 5]];
    for (const [cx, cy, rx, ry] of bands) {
      E(x, cx, cy, rx, ry, -0.12);
      stroke2(x, '#6ff0c0', 5.5, true);
    }
    x.beginPath(); x.moveTo(-2, 32); x.quadraticCurveTo(-8, 38, -4, 44); stroke2(x, '#6ff0c0', 4);
    leaf(x, 30, -8, 1.2, 0.8); leaf(x, -30, 10, 1, -0.6, '#c8f08a'); leaf(x, 22, 26, 0.9, 2.2);
  },
  gale: x => {
    glowBack(x, '#6ff0c0', 48);
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(-38, -14); x.lineTo(12, -14); x.bezierCurveTo(26, -14, 28, -34, 14, -34); x.bezierCurveTo(6, -34, 4, -26, 10, -22); stroke2(x, '#6ff0c0', 6.5, true);
    x.beginPath(); x.moveTo(-38, 4); x.lineTo(24, 4); x.bezierCurveTo(40, 4, 42, 26, 26, 26); x.bezierCurveTo(16, 26, 16, 16, 22, 14); stroke2(x, '#9ff8d8', 6.5, true);
    x.beginPath(); x.moveTo(-30, 22); x.lineTo(4, 22); stroke2(x, '#6ff0c0', 5.5);
    leaf(x, -14, -30, 1.2, -0.4); leaf(x, 4, 38, 1, 0.5, '#c8f08a');
  },
  holyLight: x => {
    glowBack(x, '#fff0a8', 52, 0, 0, 0.75);
    // 날개 두 짝 + 가운데 빛 구슬(후광 링)
    for (const d of [-1, 1]) {
      x.save(); x.scale(d, 1);
      x.beginPath(); x.moveTo(8, 4); x.bezierCurveTo(22, -26, 40, -30, 46, -22); x.bezierCurveTo(40, -16, 44, -10, 38, -6); x.bezierCurveTo(42, 0, 36, 6, 30, 6); x.bezierCurveTo(32, 12, 22, 16, 8, 12); x.closePath();
      x.restore();
      ink(x, lin(x, 0, -30, 0, 16, [[0, '#ffffff'], [0.6, '#fff4d0'], [1, '#e8c878']]));
      x.save(); x.scale(d, 1); x.lineWidth = 2; x.strokeStyle = 'rgba(200,160,80,0.7)';
      x.beginPath(); x.moveTo(20, -6); x.lineTo(36, -18); x.moveTo(20, 2); x.lineTo(34, -4); x.stroke(); x.restore();
    }
    E(x, 0, -24, 16, 5); x.lineWidth = 8; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 4.5; x.strokeStyle = '#ffd23a'; x.stroke();
    orb(x, 0, 12, 15, '#ffffff', '#fff0a8', '#e0a72e');
    star4(x, 0, 11, 11, '#ffffff');
  },
  judgment: x => {
    glowBack(x, '#fff0a8', 50, 0, 10, 0.7);
    x.fillStyle = lin(x, 0, -48, 0, 40, [[0, 'rgba(255,250,210,0)'], [0.4, 'rgba(255,245,190,0.7)'], [1, 'rgba(255,230,140,0.9)']]);
    x.fillRect(-10, -48, 20, 80);
    E(x, 0, 36, 32, 9); x.lineWidth = 7; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 3.5; x.strokeStyle = '#ffd23a'; x.stroke();
    // 아래를 향한 금빛 검
    P(x, [0, 34, -8, 18, -8, -18, 8, -18, 8, 18]); ink(x, lin(x, -8, 0, 8, 0, [[0, '#ffffff'], [0.5, '#e8eef8'], [0.52, '#b8c4d8'], [1, '#8a98b0']]));
    x.lineWidth = 2; x.strokeStyle = 'rgba(120,130,160,0.8)'; x.beginPath(); x.moveTo(0, 28); x.lineTo(0, -16); x.stroke();
    x.beginPath(); x.moveTo(-20, -22); x.quadraticCurveTo(0, -14, 20, -22); x.lineTo(18, -28); x.quadraticCurveTo(0, -20, -18, -28); x.closePath();
    ink(x, cel(x, -20, -28, 20, -16, '#ffc92e'));
    x.beginPath(); x.rect(-4, -42, 8, 14); ink(x, '#8a4a1a', 3);
    C(x, 0, -44, 5.5); ink(x, '#ffc92e', 3);
    star4(x, 12, 30, 7); star4(x, -14, 28, 5);
  },
  curseMark: x => {
    glowBack(x, '#9a3dff', 50);
    P(x, [0, -42, 36, 0, 0, 42, -36, 0]); ink(x, cel(x, -36, -42, 36, 42, '#7a2ad8', 0.3, 0.35));
    P(x, [0, -30, 25, 0, 0, 30, -25, 0]); x.lineWidth = 2.5; x.strokeStyle = 'rgba(242,200,255,0.7)'; x.stroke();
    x.beginPath(); x.moveTo(-22, 0); x.quadraticCurveTo(0, -18, 22, 0); x.quadraticCurveTo(0, 18, -22, 0); x.closePath();
    ink(x, '#f2c8ff', 3.4);
    C(x, 0, 0, 7.5); ink(x, rad(x, 0, 0, 1, 7.5, [[0, '#ff6ad8'], [1, '#6a0a8a']]), 2.5);
    C(x, 0, 0, 2.6); x.fillStyle = INK2; x.fill();
    for (const [dx, h] of [[-10, 14], [4, 20], [14, 10]]) { x.beginPath(); x.moveTo(dx - 3, 28); x.quadraticCurveTo(dx, 28 + h, dx + 3, 28); x.closePath(); ink(x, '#9a3dff', 2.4); }
  },
  soulHarvest: x => {
    glowBack(x, '#b86aff', 50);
    // 낫: 손잡이 + 휘어진 날
    x.beginPath(); x.moveTo(-26, 42); x.lineTo(10, -34); stroke2(x, '#8a5a3a', 6);
    x.beginPath(); x.moveTo(8, -36); x.bezierCurveTo(30, -44, 46, -26, 44, -6); x.bezierCurveTo(36, -22, 24, -28, 6, -26); x.closePath();
    ink(x, lin(x, 8, -44, 40, -6, [[0, '#ffffff'], [0.4, '#d8d0f0'], [0.45, '#a89ad0'], [1, '#6a5a9a']]));
    // 영혼(도깨비불): 둥근 머리 + 말려 올라가는 꼬리
    x.beginPath(); x.moveTo(-26, -4); x.bezierCurveTo(-26, -24, 2, -24, 2, -4); x.bezierCurveTo(2, 10, -6, 14, -2, 26); x.bezierCurveTo(-12, 20, -10, 12, -16, 14); x.bezierCurveTo(-20, 18, -28, 12, -24, 6); x.bezierCurveTo(-30, 4, -26, -2, -26, -4); x.closePath();
    ink(x, lin(x, -26, -24, 0, 26, [[0, '#f4f0ff'], [0.5, '#c8a8ff'], [1, '#7a4ad8']]));
    for (const d of [-17, -7]) { E(x, d, -6, 3, 4.2); x.fillStyle = INK2; x.fill(); }
    shine(x, -18, -16, 5, 2.4, -0.6, 0.9);
  },
  babyDragon: x => {
    glowBack(x, '#ff6fd2', 50);
    // 날개(뒤)
    x.beginPath(); x.moveTo(-4, -6); x.lineTo(-36, -36); x.lineTo(-28, -14); x.lineTo(-40, -12); x.lineTo(-24, 2); x.closePath();
    ink(x, cel(x, -40, -36, -4, 4, '#b06ae8'));
    // 머리 + 주둥이
    x.beginPath(); x.moveTo(-18, 10); x.bezierCurveTo(-22, -16, 6, -26, 20, -12); x.bezierCurveTo(30, -8, 40, -2, 40, 10); x.bezierCurveTo(40, 20, 28, 24, 16, 22); x.bezierCurveTo(4, 30, -16, 28, -18, 10); x.closePath();
    ink(x, cel(x, -20, -24, 40, 28, '#ff6fd2', 0.32, 0.28));
    E(x, 26, 16, 12, 6); x.fillStyle = '#ffd0ee'; x.fill(); // 배·턱
    // 뿔
    for (const [bx, by, tx, ty] of [[-6, -18, -14, -38], [6, -20, 4, -40]]) { P(x, [bx - 5, by, tx, ty, bx + 5, by + 2]); ink(x, cel(x, bx - 6, ty, bx + 6, by, '#fff1d6'), 3); }
    // 눈 · 콧구멍 · 볼
    E(x, 8, -4, 6.5, 7.5); ink(x, '#ffffff', 2.4); C(x, 10, -3, 4); x.fillStyle = INK2; x.fill(); C(x, 8.6, -5, 1.6); x.fillStyle = '#fff'; x.fill();
    C(x, 34, 4, 1.8); x.fillStyle = INK2; x.fill();
    E(x, -4, 10, 5, 3); x.fillStyle = 'rgba(255,120,180,0.6)'; x.fill();
    // 작은 불꽃 숨
    tongue(x, 44, 12, 6, 16, 0.2); ink(x, fireGrad(x, 60, 12, 40, 12), 2.4);
  },
  stoneGolem: x => {
    glowBack(x, '#ff6fd2', 46);
    x.beginPath(); x.moveTo(-32, -26); x.lineTo(-20, -38); x.lineTo(22, -38); x.lineTo(34, -24); x.lineTo(36, 22); x.lineTo(24, 38); x.lineTo(-24, 38); x.lineTo(-36, 20); x.closePath();
    ink(x, cel(x, -36, -38, 36, 38, '#b8ae9e', 0.3, 0.32));
    x.lineWidth = 2.4; x.strokeStyle = 'rgba(60,50,40,0.6)';
    x.beginPath(); x.moveTo(-36, 4); x.lineTo(-18, 8); x.moveTo(20, -38); x.lineTo(14, -24); x.lineTo(22, -18); x.moveTo(8, 24); x.lineTo(18, 38); x.stroke();
    // 이끼
    x.fillStyle = '#6ab84a';
    for (const [mx, my, r] of [[-20, -38, 7], [-10, -40, 6], [26, -30, 6], [-34, 16, 5]]) { C(x, mx, my, r); x.fill(); }
    // 빛나는 눈 + 이마 룬
    for (const d of [-1, 1]) { x.fillStyle = rad(x, d * 13, -4, 0, 14, [[0, 'rgba(255,230,120,0.9)'], [1, 'rgba(255,200,60,0)']]); x.fillRect(d * 13 - 14, -18, 28, 28); P(x, [d * 13 - 8, -8, d * 13 + 8, -8, d * 13 + 5, 0, d * 13 - 5, 0]); ink(x, '#ffd23a', 2.6); }
    x.lineWidth = 3; x.strokeStyle = '#ff9ae6'; x.beginPath(); x.moveTo(0, -30); x.lineTo(-5, -20); x.lineTo(5, -20); x.closePath(); x.stroke();
    x.beginPath(); x.moveTo(-14, 18); x.lineTo(14, 18); x.lineWidth = 4; x.strokeStyle = INK2; x.stroke();
  },
};

// ═════════ 히든 조합 14종 ═════════
const SYN_ART = {
  flame: x => { // 불꽃 산탄: 부채꼴로 퍼지는 불꽃탄 세 발(발사점에서 갈라짐)
    glowBack(x, '#ff6a1f', 50);
    for (const a of [-0.6, 0, 0.6]) {
      const cx = -22 + Math.cos(a - 0.78) * 50, cy = 26 + Math.sin(a - 0.78) * 50, ang = a - 0.78 + Math.PI;
      tongue(x, cx, cy, 9, 34, ang); ink(x, fireGrad(x, cx, cy, -22, 26), 3);
      orb(x, cx, cy, 10, '#fffbe0', '#ffb030', '#d8400e', 3.2);
    }
    burstShape(x, -26, 30, 12, 6, 0.45); ink(x, '#fff3a8', 2.6);
  },
  pierce: x => { // 관통탄: 과녁 2개를 꿰뚫는 금빛 창
    glowBack(x, '#ffd23a', 50);
    for (const cx of [-14, 14]) { E(x, cx, 0, 9, 22); ink(x, '#fff1d6', 3.2); E(x, cx, 0, 5, 12); ink(x, '#ff5a5a', 2.4); }
    P(x, [44, 0, 26, -10, 26, -4, -40, -4, -40, 4, 26, 4, 26, 10]);
    ink(x, lin(x, 0, -10, 0, 10, [[0, '#fff3a8'], [0.5, '#ffc92e'], [0.52, '#e08a00'], [1, '#a65200']]));
    for (const d of [-1, 1]) { P(x, [-40, 0, -46, d * 10, -34, d * 4]); ink(x, '#ff8a3a', 2.6); }
  },
  chain: x => { SPELL_ART.chainLightning(x); },
  homing: x => { // 유도 미사일: 휘어 들어가는 도깨비불 → 조준경
    glowBack(x, '#ff8ad8', 50);
    C(x, 22, -18, 18); x.lineWidth = 7; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 3.5; x.strokeStyle = '#ff5a5a'; x.stroke();
    x.beginPath(); for (const [a, b, c, d] of [[22, -40, 22, -30], [22, -6, 22, 4], [0, -18, 10, -18], [34, -18, 44, -18]]) { x.moveTo(a, b); x.lineTo(c, d); } x.lineWidth = 3.5; x.strokeStyle = INK2; x.stroke();
    x.beginPath(); x.moveTo(-36, 36); x.bezierCurveTo(-40, 0, -10, 6, 6, -6); x.setLineDash([2, 9]); x.lineWidth = 5; x.strokeStyle = '#ffd0f0'; x.stroke(); x.setLineDash([]);
    tongue(x, 6, -6, 9, 28, Math.PI * 0.8); ink(x, lin(x, -20, 10, 6, -6, [[0, '#8a1f7a'], [1, '#ff8ad8']]), 3);
    orb(x, 6, -6, 10, '#ffffff', '#ff8ad8', '#8a1f7a', 3.2);
  },
  thorns: x => { // 요새화: 가시 돋친 성벽
    glowBack(x, '#9fd0ff', 46);
    for (let k = -2; k <= 2; k++) { P(x, [k * 16 - 7, -2, k * 16, -34 + Math.abs(k) * 6, k * 16 + 7, -2]); ink(x, lin(x, k * 16 - 7, 0, k * 16 + 7, 0, [[0, '#ffffff'], [0.5, '#dfe8f4'], [0.52, '#a8b4c8'], [1, '#6a7890']]), 3.2); }
    x.beginPath(); x.rect(-40, -4, 80, 38); ink(x, cel(x, -40, -4, 40, 34, '#a89a86'));
    x.lineWidth = 2.4; x.strokeStyle = 'rgba(40,30,20,0.55)';
    x.beginPath(); x.moveTo(-40, 14); x.lineTo(40, 14); for (const bx of [-20, 0, 20]) { x.moveTo(bx, -4); x.lineTo(bx, 14); } for (const bx of [-30, -10, 10, 30]) { x.moveTo(bx, 14); x.lineTo(bx, 34); } x.stroke();
  },
  giant: x => { // 거인 사냥꾼: 거대한 뿔 해골 + 꽂히는 검
    glowBack(x, '#ff5a5a', 50);
    for (const d of [-1, 1]) { x.beginPath(); x.moveTo(d * 14, -10); x.quadraticCurveTo(d * 40, -16, d * 40, -42); x.quadraticCurveTo(d * 30, -24, d * 10, -22); x.closePath(); ink(x, cel(x, d * 40, -42, d * 10, -10, '#e8dcc8'), 3.2); }
    skull(x, 0, 6, 1.9);
    x.save(); x.translate(18, -8); x.rotate(0.62);
    P(x, [0, -44, 6, -34, 6, 6, -6, 6, -6, -34]); ink(x, lin(x, -6, 0, 6, 0, [[0, '#ffffff'], [0.5, '#e8eef8'], [0.52, '#a8b4c8'], [1, '#7a88a0']]), 3.4);
    x.beginPath(); x.rect(-14, 6, 28, 7); ink(x, '#ffc92e', 3); x.beginPath(); x.rect(-3.5, 13, 7, 14); ink(x, '#8a4a1a', 3);
    x.restore();
  },
  glacier: x => { // 빙하 운석: 얼음 바위 + 서리 꼬리
    glowBack(x, '#7fe3ff', 50);
    for (const [r, len, a] of [[14, 50, -2.3], [10, 40, -2.0], [9, 38, -2.6]]) { tongue(x, 6, 8, r, len, a); ink(x, lin(x, -40, -40, 6, 8, [[0, 'rgba(200,245,255,0.3)'], [1, '#9fe8ff']]), 3); }
    P(x, [6, -14, 24, -6, 28, 12, 16, 28, -4, 26, -14, 10, -8, -8]);
    ink(x, cel(x, -14, -14, 28, 28, '#5fb8f0', 0.4, 0.35));
    x.lineWidth = 2.2; x.strokeStyle = 'rgba(255,255,255,0.8)'; x.beginPath(); x.moveTo(-6, -4); x.lineTo(8, 6); x.lineTo(20, -2); x.moveTo(8, 6); x.lineTo(10, 22); x.stroke();
    star4(x, 30, -20, 8); star4(x, -24, 30, 6, '#dff8ff');
  },
  twin: x => { // 쌍둥이 포화: 금 · 청록 마력구 한 쌍
    glowBack(x, '#ffc94a', 40, -12, 0); glowBack(x, '#4fe0ff', 40, 12, 0);
    orb(x, -13, 4, 19, '#fffbe0', '#ffc94a', '#9a5a08');
    orb(x, 15, -4, 19, '#ffffff', '#4fe0ff', '#0a6a94');
    star4(x, 0, -28, 9); star4(x, 2, 32, 7);
  },
  golden: x => { // 황금비: 쏟아지는 금화
    glowBack(x, '#ffd23a', 50, 0, 8, 0.6);
    for (const [cx, cy, r] of [[-22, -26, 8], [4, -36, 7], [26, -22, 8]]) coinG(x, cx, cy, r);
    for (let k = 0; k < 3; k++) { E(x, 0, 30 - k * 9, 24, 8); ink(x, lin(x, -24, 0, 24, 0, [[0, '#d08a10'], [0.3, '#ffe27a'], [0.6, '#ffc83a'], [1, '#b87810']]), 3); }
    coinG(x, 2, 0, 15);
  },
  double: x => { // 이중 필살: 겹친 두 치명 별
    glowBack(x, '#ff5a3a', 50);
    burstShape(x, -10, 6, 30, 8, 0.5); ink(x, cel(x, -40, -24, 20, 36, '#ff8a2a'));
    burstShape(x, 12, -8, 26, 8, 0.5); ink(x, cel(x, -14, -34, 38, 18, '#ffd23a'));
    star4(x, 12, -8, 12); star4(x, -10, 6, 9, '#fff3a8');
  },
  chainboom: x => { // 연쇄 폭발: 이어지는 폭발 세 개
    glowBack(x, '#ff8a1e', 50);
    for (const [cx, cy, r] of [[-22, 20, 15], [18, 16, 13], [-2, -16, 20]]) {
      burstShape(x, cx, cy, r, 9, 0.62); ink(x, rad(x, cx, cy, 1, r, [[0, '#fffbe0'], [0.45, '#ffc23a'], [1, '#e0400e']]), 3.2);
    }
    x.beginPath(); x.moveTo(-22, 20); x.lineTo(-2, -16); x.lineTo(18, 16); x.setLineDash([3, 7]); x.lineWidth = 4; x.strokeStyle = '#fff3a8'; x.stroke(); x.setLineDash([]);
  },
  flawless: x => { // 무결점: 흠 없는 보석 방패
    glowBack(x, '#4fd8ff', 50);
    x.beginPath(); x.moveTo(0, -42); x.lineTo(34, -28); x.lineTo(32, 6); x.quadraticCurveTo(26, 30, 0, 42); x.quadraticCurveTo(-26, 30, -32, 6); x.lineTo(-34, -28); x.closePath();
    ink(x, cel(x, -34, -42, 34, 42, '#ffc92e', 0.35, 0.3));
    gem(x, 0, 0, 1.3);
    star4(x, 22, -24, 9); star4(x, -20, 22, 6);
  },
  frenzy: x => { // 광란: 분노한 불꽃 정령
    glowBack(x, '#ff3a3a', 52);
    for (const [cx, r, len, a] of [[-14, 12, 44, -1.9], [14, 12, 44, -1.25], [0, 14, 54, -1.57]]) { tongue(x, cx, 10, r, len, a); ink(x, fireGrad(x, 0, -44, 0, 14), 3.2); }
    C(x, 0, 12, 24); ink(x, rad(x, 0, 12, 2, 24, [[0, '#fff2a0'], [0.5, '#ff6a1f'], [1, '#c22a10']], -6, 4));
    for (const d of [-1, 1]) { P(x, [d * 4, 6, d * 16, 2, d * 14, 12]); x.fillStyle = INK2; x.fill(); }
    x.beginPath(); x.moveTo(-9, 24); x.quadraticCurveTo(0, 18, 9, 24); x.lineWidth = 3.4; x.strokeStyle = INK2; x.stroke();
  },
  legend: x => { // 전설의 학살: 왕관 쓴 해골 + 월계
    glowBack(x, '#ffd23a', 52, 0, 0, 0.7);
    for (const d of [-1, 1]) for (let k = 0; k < 4; k++) { const a = Math.PI / 2 + d * (0.5 + k * 0.42); leaf(x, Math.cos(a) * 36, 8 + Math.sin(a) * 30, 1.3, a + d * 1.2, '#ffd23a'); }
    skull(x, 0, 12, 1.5);
    x.beginPath(); x.moveTo(-20, -12); x.lineTo(-22, -34); x.lineTo(-10, -24); x.lineTo(0, -40); x.lineTo(10, -24); x.lineTo(22, -34); x.lineTo(20, -12); x.closePath();
    ink(x, cel(x, -22, -40, 22, -12, '#ffc92e', 0.35, 0.3));
    for (const [cx, col] of [[-11, '#ff4d5e'], [0, '#4fd8ff'], [11, '#5fe06e']]) { C(x, cx, -18, 3.4); ink(x, col, 2); }
  },
};

// ═════════ 보석 상점 퍼크 · 상점 머리 그림 ═════════
const PERK_ART = {
  pickaxe: x => { // 황금 곡괭이 + 금덩이
    glowBack(x, '#ffd23a', 48, 8, 18);
    x.beginPath(); x.moveTo(-30, 38); x.lineTo(16, -20); stroke2(x, '#a8683a', 7);
    x.beginPath(); x.moveTo(-18, -34); x.quadraticCurveTo(14, -40, 40, -8); x.quadraticCurveTo(30, -12, 22, -16); x.quadraticCurveTo(4, -30, -16, -26); x.closePath();
    ink(x, lin(x, -18, -40, 40, -8, [[0, '#fff3a8'], [0.45, '#ffc92e'], [0.5, '#e08a00'], [1, '#a65200']]));
    P(x, [16, 26, 30, 18, 40, 28, 34, 40, 18, 40]); ink(x, cel(x, 16, 18, 40, 40, '#ffc92e'), 3.2);
    star4(x, 30, 24, 6);
  },
  critBoom: x => { // 치명타 폭발: 과녁 + 터지는 불꽃
    glowBack(x, '#ff5a3a', 50);
    burstShape(x, 6, 4, 38, 10, 0.55); ink(x, rad(x, 6, 4, 2, 38, [[0, '#fffbe0'], [0.4, '#ffb030'], [1, '#e0400e']]));
    C(x, 6, 4, 13); ink(x, '#ffffff', 3.2); C(x, 6, 4, 6); ink(x, '#ff4d5e', 2.6);
    for (const [cx, cy] of [[-30, -26], [34, -30], [-28, 30]]) star4(x, cx, cy, 8, '#fff3a8');
  },
  startGold: x => { // 금화 주머니
    glowBack(x, '#ffd23a', 48, 0, 10);
    x.beginPath(); x.moveTo(-10, -22); x.quadraticCurveTo(-36, 4, -30, 26); x.quadraticCurveTo(-24, 42, 0, 42); x.quadraticCurveTo(24, 42, 30, 26); x.quadraticCurveTo(36, 4, 10, -22); x.closePath();
    ink(x, cel(x, -36, -22, 36, 42, '#c8844a', 0.3, 0.3));
    x.beginPath(); x.moveTo(-14, -30); x.lineTo(14, -30); x.lineTo(8, -20); x.lineTo(-8, -20); x.closePath(); ink(x, cel(x, -14, -30, 14, -20, '#c8844a'), 3.2);
    x.beginPath(); x.moveTo(-12, -20); x.quadraticCurveTo(0, -14, 12, -20); x.lineWidth = 4; x.strokeStyle = '#ffc92e'; x.stroke();
    coinG(x, 0, 14, 13);
    coinG(x, -22, -36, 7); coinG(x, 24, -32, 6);
  },
  treasure: x => { // 오프라인 보상: 금화가 넘치는 보물상자 + 황금 곡괭이
    glowBack(x, '#ffd23a', 54, 0, 0, 0.8);
    x.save(); x.translate(26, -8); x.rotate(0.5); x.scale(0.62, 0.62); PERK_ART.pickaxe(x); x.restore();
    x.beginPath(); x.moveTo(-36, -2); x.lineTo(36, -2); x.lineTo(32, 36); x.lineTo(-32, 36); x.closePath();
    ink(x, cel(x, -36, -2, 36, 36, '#b0703a', 0.3, 0.3));
    for (const cx of [-34, 30]) { x.beginPath(); x.rect(cx, -2, 5, 38); ink(x, '#ffc92e', 2.4); }
    for (const [cx, cy, r] of [[-18, -6, 11], [2, -12, 12], [20, -4, 10], [-6, -2, 10], [12, 2, 9]]) coinG(x, cx, cy, r);
    x.beginPath(); x.moveTo(-38, -4); x.quadraticCurveTo(0, -46, 38, -4); x.lineTo(34, -12); x.quadraticCurveTo(0, -54, -34, -12); x.closePath();
    ink(x, cel(x, -38, -54, 38, -4, '#9a5a2a', 0.3, 0.3));
    x.beginPath(); x.rect(-6, 8, 12, 12); ink(x, '#ffd23a', 2.6);
    star4(x, -30, -30, 9); star4(x, 34, 26, 7);
  },
  wallBroken: x => { // 패배: 금 가고 무너지는 성벽 + 꺼져 가는 결계 룬
    glowBack(x, '#ff3a4a', 54, 0, 6, 0.6);
    const stone = '#9a8ec0';
    // 흉벽 톱니(하나는 떨어져 나감)
    for (const [mx, off] of [[-34, 0], [-12, 0], [10, 10], [32, 0]]) { x.save(); x.translate(mx, -20 + off); x.rotate(off ? 0.5 : 0); x.beginPath(); x.rect(-8, -12, 16, 14); x.restore(); ink(x, cel(x, mx - 8, -32, mx + 8, -18, stone), 3.2); }
    x.beginPath(); x.moveTo(-44, -18); x.lineTo(-4, -18); x.lineTo(2, -4); x.lineTo(-2, 10); x.lineTo(4, 30); x.lineTo(-44, 30); x.closePath();
    ink(x, cel(x, -44, -18, 4, 30, stone, 0.3, 0.3));
    x.beginPath(); x.moveTo(8, -14); x.lineTo(44, -18); x.lineTo(44, 30); x.lineTo(12, 30); x.lineTo(6, 12); x.lineTo(10, 0); x.closePath();
    ink(x, cel(x, 6, -18, 44, 30, stone, 0.3, 0.3));
    x.lineWidth = 2.2; x.strokeStyle = 'rgba(30,20,50,0.55)';
    x.beginPath(); x.moveTo(-44, 6); x.lineTo(0, 6); x.moveTo(8, 8); x.lineTo(44, 6); x.moveTo(-24, -18); x.lineTo(-24, 6); x.moveTo(26, -16); x.lineTo(26, 6); x.moveTo(-34, 6); x.lineTo(-34, 30); x.moveTo(30, 6); x.lineTo(30, 30); x.stroke();
    // 붉게 빛나는 균열
    x.beginPath(); x.moveTo(2, -18); x.lineTo(6, -6); x.lineTo(2, 4); x.lineTo(8, 14); x.lineTo(4, 30);
    x.lineWidth = 6; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 3; x.strokeStyle = '#ff5a4a'; x.stroke();
    // 떨어지는 파편
    for (const [cx, cy, r, a] of [[-4, 40, 5, 0.4], [14, 42, 4, 1.2], [26, 38, 3.5, 2]]) { x.save(); x.translate(cx, cy); x.rotate(a); x.beginPath(); x.rect(-r, -r * 0.8, r * 2, r * 1.6); x.restore(); ink(x, stone, 2.4); }
  },
  gems: x => { // 보석 더미(상점 머리)
    glowBack(x, '#4fd8ff', 52, 0, 8, 0.7);
    gem(x, -20, 14, 0.95, '#b85cff', '#5a1fa8');
    gem(x, 22, 14, 0.95, '#5fe06e', '#1d8a3a');
    gem(x, 0, -6, 1.35);
    star4(x, 26, -28, 9); star4(x, -30, -14, 6);
  },
};

// 원소 → 대표 스킬(융합 엠블럼용)
const EL_SPELL = { fire: 'fireball', lightning: 'lightningStrike', frost: 'iceLance', wind: 'tornado', holy: 'holyLight', dark: 'curseMark', summon: 'babyDragon' };
const FUSION_EL = Object.fromEntries(FUSIONS.map(f => [f.key, f.elements]));
function fusionArt(key) {
  const els = FUSION_EL[key];
  return x => {
    const a = EL[els[0]], b = EL[els[1]];
    glowBack(x, a[1], 44, -12, -10); glowBack(x, b[1], 44, 12, 12);
    x.save(); x.translate(-13, -12); x.scale(0.66, 0.66); SPELL_ART[EL_SPELL[els[0]]](x); x.restore();
    x.save(); x.translate(14, 14); x.scale(0.66, 0.66); SPELL_ART[EL_SPELL[els[1]]](x); x.restore();
    burstShape(x, 0, 0, 13, 4, 0.3); ink(x, '#ffffff', 2.6);
  };
}

// ═════════ 협공(영웅 × 마법사) — 영웅 클래스 무기 문장 + 마법사 스킬 ═════════
const MET = c => lin(c, -20, -40, 20, 40, [[0, '#ffffff'], [0.35, '#dfe8f4'], [0.62, '#9aa8c0'], [1, '#5a6478']]);
const WEAPON = { // 오른쪽 위를 향한 무기(중심 0,0, ±40)
  knight: x => { // 넓은 장검 + 금 가드
    P(x, [-6, 26, -6, -30, 0, -42, 6, -30, 6, 26]); ink(x, MET(x));
    x.beginPath(); x.moveTo(0, -34); x.lineTo(0, 22); x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,0.8)'; x.stroke();
    P(x, [-20, 26, 20, 26, 16, 34, -16, 34]); ink(x, '#ffc92e');
    P(x, [-4, 34, 4, 34, 4, 46, -4, 46]); ink(x, '#8a4a1a', 3); C(x, 0, 48, 5); ink(x, '#ffc92e', 3);
  },
  ranger: x => { // 활 + 초록 깃 화살
    x.beginPath(); x.arc(-22, 0, 40, -1.1, 1.1); x.lineWidth = 7; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 3.4; x.strokeStyle = '#c8843a'; x.stroke();
    x.beginPath(); x.moveTo(-22 + Math.cos(-1.1) * 40, Math.sin(-1.1) * 40); x.lineTo(-22 + Math.cos(1.1) * 40, Math.sin(1.1) * 40); x.lineWidth = 1.6; x.strokeStyle = '#fff6dc'; x.stroke();
    P(x, [-20, -2, 30, -2, 30, -6, 44, 0, 30, 6, 30, 2, -20, 2]); ink(x, '#e8eef8', 3);
    for (const d of [-1, 1]) { P(x, [-24, 0, -14, 0, -20, d * 9, -30, d * 9]); ink(x, '#5fe06e', 2.6); }
  },
  sorcerer: x => { // 지팡이 + 보라 오브
    x.beginPath(); x.moveTo(-26, 40); x.lineTo(14, -18); stroke2(x, '#a0683a', 5);
    orb(x, 20, -26, 13, '#ffffff', '#c08aff', '#5a1fa8', 3.6); star4(x, 34, -40, 8);
  },
  cleric: x => { // 철퇴 + 후광
    x.beginPath(); x.ellipse(10, -34, 20, 6, 0, 0, TAU); x.lineWidth = 7; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 3.4; x.strokeStyle = '#ffe07a'; x.stroke();
    x.beginPath(); x.moveTo(-24, 38); x.lineTo(4, -2); stroke2(x, '#8a5a2a', 5);
    burstShape(x, 10, -12, 18, 6, 0.62); ink(x, cel(x, -8, -30, 28, 6, '#ffd23a'));
  },
  assassin: x => { // 쌍단검 교차
    for (const d of [-1, 1]) {
      x.save(); x.rotate(d * 0.6);
      P(x, [-4, 18, -4, -26, 0, -38, 4, -26, 4, 18]); ink(x, MET(x), 3.4);
      P(x, [-12, 18, 12, 18, 10, 23, -10, 23]); ink(x, '#b04dff', 3);
      P(x, [-3, 23, 3, 23, 3, 34, -3, 34]); ink(x, '#2a1b36', 2.6);
      x.restore();
    }
  },
};
const COLLAB_ART = Object.fromEntries(COLLABS.filter(c => c.cls).map(c => [c.key, x => {
  glowBack(x, '#ff6fd2', 50, 0, 0, 0.45);
  x.save(); x.translate(-14, -12); x.scale(0.64, 0.64); SPELL_ART[c.spells[0]](x); x.restore();
  x.save(); x.translate(16, 14); x.scale(0.62, 0.62); WEAPON[c.cls](x); x.restore();
  burstShape(x, 0, 2, 12, 4, 0.3); ink(x, '#ffe0f4', 2.6); // 두 힘이 만나는 불꽃
}]));
COLLAB_ART.unison = x => { // 합동 필살: 검과 지팡이가 교차 + 큰 별
  glowBack(x, '#ffd23a', 50, 0, 0, 0.6);
  x.save(); x.rotate(-0.5); x.scale(0.9, 0.9); WEAPON.knight(x); x.restore();
  x.save(); x.rotate(0.6); x.translate(6, 4); x.scale(0.9, 0.9); WEAPON.sorcerer(x); x.restore();
  burstShape(x, 0, -4, 22, 4, 0.32); ink(x, lin(x, 0, -26, 0, 18, [[0, '#ffffff'], [1, '#ffb0e0']]), 3);
};

export const hasEmblem = key => !!(SPELL_ART[key] || SYN_ART[key] || PERK_ART[key] || FUSION_EL[key] || COLLAB_ART[key]);
// 엠블럼 캔버스(반폭 50 월드 단위). res = 1 단위당 픽셀
export function emblem(key, res = 1.6) {
  const art = SPELL_ART[key] || SYN_ART[key] || PERK_ART[key] || COLLAB_ART[key] || (FUSION_EL[key] ? fusionArt(key) : null);
  if (!art) return null;
  return bake('em|' + key + '|' + res.toFixed(2), 50, 50, x => { x.lineJoin = 'round'; x.lineCap = 'round'; art(x); }, res);
}
// 융합을 이루는 두 원소의 대표 스킬(컷인에서 두 엠블럼이 날아와 합쳐지는 연출용)
export const fusionParts = key => { const els = FUSION_EL[key]; return els ? [EL_SPELL[els[0]], EL_SPELL[els[1]]] : null; };
const URLS = new Map();
export function emblemURL(key, px = 128) {
  const k = key + '|' + px;
  let u = URLS.get(k);
  if (u === undefined) { const c = emblem(key, px / 100); u = c ? c.toDataURL('image/png') : ''; URLS.set(k, u); }
  return u;
}
// DOM: <img> 한 줄 (없으면 빈 문자열)
export const emblemImg = (key, cls = 'em') => { const u = hasEmblem(key) ? emblemURL(key) : ''; return u ? `<img class="${cls}" src="${u}" alt="" draggable="false">` : ''; };
// 4차 유물 엠블럼(art/relicart.js)이 같은 손(잉크 외곽·셀 셰이딩·광택)으로 그리게 그리기 도구를 내보낸다
export const EM = { C, E, P, ink, stroke2, glowBack, orb, star4, burstShape, coinG, gem, skull, bolt, tongue, fireGrad, ca, LW };

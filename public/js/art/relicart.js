// 유물 엠블럼 20종 — 금테 메달 + 가운데 물건(캔버스 경로 → 오프스크린 캐시 → dataURL). emblems.js와 같은 손(EM 도구).
// 좌표 100 × 100(중심 0,0). 메달 테두리는 공통, 바탕색(col)과 물건만 유물마다. DOM: relicImg(key) · 캔버스: relicEmblem(key, res)
import { TAU, INK2, bake, cel, lin, rad, shine } from './core.js';
import { EM } from './emblems.js';

const { C, E, P, ink, stroke2, orb, star4, burstShape, coinG, gem, tongue, fireGrad } = EM;
const MET = x => lin(x, -20, -30, 20, 30, [[0, '#ffffff'], [0.35, '#dfe8f4'], [0.62, '#9aa8c0'], [1, '#5a6478']]);
const GOLD = (x, y0 = -30, y1 = 30) => lin(x, 0, y0, 0, y1, [[0, '#fff6b0'], [0.45, '#ffc92e'], [0.5, '#e08a00'], [1, '#a65200']]);

// 유물 바탕색 · 물건
const ART = {
  crown: ['#8a3dff', x => { // 금이 간 왕관 + 보라 광기
    P(x, [-30, 14, -34, -18, -16, -2, 0, -26, 16, -2, 34, -18, 30, 14]); ink(x, GOLD(x, -26, 14));
    x.beginPath(); x.rect(-31, 12, 62, 12); ink(x, cel(x, -31, 12, 31, 24, '#ffc92e'));
    for (const [cx, col] of [[-16, '#ff4d5e'], [0, '#4fd8ff'], [16, '#5fe06e']]) { C(x, cx, 18, 4.5); ink(x, col, 2.4); }
    for (const [cx, cy] of [[-34, -20], [0, -28], [34, -20]]) { C(x, cx, cy, 5); ink(x, '#fff3a8', 2.6); }
    x.beginPath(); x.moveTo(6, -14); x.lineTo(1, -4); x.lineTo(7, 4); x.lineTo(3, 12); x.lineWidth = 2.4; x.strokeStyle = '#5a1fa8'; x.stroke();
  }],
  grail: ['#e0a020', x => { // 금 성배 + 넘치는 동전
    x.beginPath(); x.moveTo(-26, -24); x.quadraticCurveTo(-26, 6, 0, 8); x.quadraticCurveTo(26, 6, 26, -24); x.closePath(); ink(x, GOLD(x, -24, 8));
    P(x, [-4, 8, 4, 8, 6, 24, -6, 24]); ink(x, '#e0a020', 3);
    E(x, 0, 28, 18, 6); ink(x, cel(x, -18, 22, 18, 34, '#ffc92e'), 3);
    E(x, 0, -24, 26, 6); ink(x, '#7a3a00', 3);
    for (const [cx, cy, r] of [[-12, -30, 8], [6, -33, 9], [20, -28, 7]]) coinG(x, cx, cy, r);
    C(x, 0, -8, 5); ink(x, '#ff4d5e', 2.4);
  }],
  glass: ['#3fa9ff', x => { // 유리 대포: 투명한 수정 포신 + 금 간 자국
    x.save(); x.rotate(-0.55);
    x.beginPath(); x.rect(-12, -34, 24, 52); ink(x, lin(x, -12, 0, 12, 0, [[0, 'rgba(210,245,255,.95)'], [0.4, 'rgba(140,220,255,.9)'], [1, 'rgba(40,120,220,.95)']]));
    E(x, 0, -34, 13, 5); ink(x, '#bff4ff', 3);
    x.beginPath(); x.moveTo(-4, -22); x.lineTo(3, -10); x.lineTo(-2, 0); x.lineWidth = 2; x.strokeStyle = '#ffffff'; x.stroke();
    x.restore();
    for (const cx of [-18, 14]) { C(x, cx, 26, 11); ink(x, cel(x, cx - 11, 15, cx + 11, 37, '#a0683a'), 3.4); C(x, cx, 26, 3); x.fillStyle = INK2; x.fill(); }
    star4(x, 24, -28, 8, '#ffffff');
  }],
  thief: ['#2fb8a0', x => { // 회중시계 + 단검
    C(x, -4, 4, 28); ink(x, GOLD(x, -24, 32));
    C(x, -4, 4, 21); ink(x, '#fff6e6', 3);
    x.beginPath(); x.moveTo(-4, 4); x.lineTo(-4, -11); x.moveTo(-4, 4); x.lineTo(7, 9); x.lineWidth = 3.4; x.strokeStyle = INK2; x.stroke();
    x.beginPath(); x.rect(-9, -30, 10, 6); ink(x, '#ffc92e', 2.6);
    x.save(); x.translate(10, -2); x.rotate(0.8);
    P(x, [-3, 12, -3, -26, 0, -34, 3, -26, 3, 12]); ink(x, MET(x), 3);
    P(x, [-9, 12, 9, 12, 8, 16, -8, 16]); ink(x, '#b04dff', 2.6);
    P(x, [-2, 16, 2, 16, 2, 26, -2, 26]); ink(x, INK2, 2);
    x.restore();
  }],
  twinMoon: ['#4535a0', x => { // 쌍둥이 초승달
    for (const [cx, cy, r, s] of [[-10, -6, 22, 1], [14, 12, 16, -1]]) {
      x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.arc(cx + s * r * 0.45, cy - r * 0.3, r * 0.82, 0, TAU, true);
      ink(x, lin(x, cx - r, cy - r, cx + r, cy + r, [[0, '#ffffff'], [0.5, '#fff0a8'], [1, '#e0a72e']]), 3.2);
    }
    star4(x, 22, -24, 7); star4(x, -26, 24, 6);
  }],
  hunter: ['#d0283c', x => { // 과녁 + 꽂힌 화살
    for (const [r, col] of [[30, '#fff6e6'], [21, '#ff4d5e'], [12, '#fff6e6'], [5, '#ff4d5e']]) { C(x, 0, 4, r); ink(x, col, 3); }
    x.beginPath(); x.moveTo(2, 2); x.lineTo(34, -30); stroke2(x, '#c8843a', 3.6);
    P(x, [-4, 8, 6, -4, 9, 6]); ink(x, MET(x), 2.6);
    for (const d of [-1, 1]) { P(x, [30, -26, 38, -34, 38 + d * 6, -30 + d * 6, 30 + d * 4, -22 - d * 4]); ink(x, '#5fe06e', 2.4); }
  }],
  miser: ['#b0703a', x => { // 자물쇠 달린 금고 + 금화
    x.beginPath(); x.rect(-30, -8, 60, 38); ink(x, cel(x, -30, -8, 30, 30, '#9a5a2a', 0.3, 0.3));
    x.beginPath(); x.moveTo(-32, -6); x.quadraticCurveTo(0, -38, 32, -6); x.closePath(); ink(x, cel(x, -32, -30, 32, -6, '#b0703a', 0.3, 0.3));
    for (const cx of [-24, 20]) { x.beginPath(); x.rect(cx, -8, 4, 38); ink(x, '#ffc92e', 2); }
    x.beginPath(); x.arc(0, 4, 7, Math.PI, 0); x.lineWidth = 6; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 3; x.strokeStyle = '#dfe8f4'; x.stroke();
    x.beginPath(); x.rect(-9, 4, 18, 15); ink(x, GOLD(x, 4, 19), 3);
    coinG(x, -22, -26, 8); coinG(x, 24, -24, 7);
  }],
  phoenix: ['#ff6a1f', x => { // 불타는 깃털
    tongue(x, 4, 18, 14, 60, -1.9); ink(x, fireGrad(x, 0, 30, 0, -40), 3.2);
    x.beginPath(); x.moveTo(-14, 34); x.quadraticCurveTo(-4, 0, 16, -30); x.quadraticCurveTo(22, -8, 6, 16); x.quadraticCurveTo(-4, 26, -14, 34); x.closePath();
    ink(x, lin(x, -14, 34, 16, -30, [[0, '#ff4d5e'], [0.5, '#ffb030'], [1, '#fff3a8']]));
    x.beginPath(); x.moveTo(-16, 38); x.quadraticCurveTo(0, 6, 14, -24); x.lineWidth = 2.4; x.strokeStyle = '#fff6e6'; x.stroke();
    star4(x, 22, -30, 7, '#fff3a8'); star4(x, -22, 6, 5, '#fff3a8');
  }],
  resonance: ['#7a3cff', x => { // 소리굽쇠 + 공명 고리
    for (const r of [34, 26]) { C(x, 0, -4, r); x.lineWidth = 2.4; x.strokeStyle = 'rgba(255,255,255,.55)'; x.stroke(); }
    x.beginPath(); x.moveTo(-10, -30); x.lineTo(-10, 0); x.quadraticCurveTo(-10, 12, 0, 12); x.quadraticCurveTo(10, 12, 10, 0); x.lineTo(10, -30);
    stroke2(x, '#dfe8f4', 5, true);
    x.beginPath(); x.moveTo(0, 12); x.lineTo(0, 34); stroke2(x, '#ffc92e', 5);
    for (const [cx, cy, col] of [[-30, -18, '#ff6a1f'], [30, -18, '#ffe53a'], [0, -38, '#7fe3ff']]) orb(x, cx, cy, 7, '#ffffff', col, '#3a2a60', 2.6);
  }],
  banner: ['#e0402e', x => { // 깃대 + 휘날리는 깃발 + 별
    x.beginPath(); x.moveTo(-24, 38); x.lineTo(-24, -34); stroke2(x, '#a0683a', 4);
    C(x, -24, -36, 5); ink(x, '#ffc92e', 2.6);
    x.beginPath(); x.moveTo(-22, -30); x.quadraticCurveTo(0, -38, 30, -28); x.quadraticCurveTo(22, -14, 32, 0); x.quadraticCurveTo(4, -8, -22, 0); x.closePath();
    ink(x, cel(x, -22, -38, 32, 0, '#ff4d5e', 0.3, 0.3));
    x.save(); x.translate(4, -16); x.scale(0.55, 0.55); burstShape(x, 0, 0, 20, 5, 0.45); ink(x, '#fff3a8', 4); x.restore();
  }],
  gambler: ['#1e8a3a', x => { // 주사위 둘
    const die = (cx, cy, a, pips) => {
      x.save(); x.translate(cx, cy); x.rotate(a);
      x.beginPath(); x.roundRect(-16, -16, 32, 32, 7); ink(x, cel(x, -16, -16, 16, 16, '#fff6e6', 0.3, 0.2));
      for (const [px, py] of pips) { C(x, px, py, 3.6); x.fillStyle = '#d0283c'; x.fill(); }
      x.restore();
    };
    die(-12, 8, -0.3, [[-8, -8], [0, 0], [8, 8]]);
    die(14, -12, 0.35, [[-8, -8], [8, -8], [-8, 8], [8, 8], [0, 0]]);
    star4(x, 28, 22, 7, '#fff3a8');
  }],
  hourglass: ['#5a46d6', x => { // 모래시계(보라 모래)
    for (const cy of [-32, 32]) { x.beginPath(); x.rect(-24, cy - 4, 48, 8); ink(x, cel(x, -24, cy - 4, 24, cy + 4, '#a0683a'), 3); }
    x.beginPath(); x.moveTo(-18, -28); x.lineTo(18, -28); x.quadraticCurveTo(16, -8, 3, 0); x.quadraticCurveTo(16, 8, 18, 28); x.lineTo(-18, 28); x.quadraticCurveTo(-16, 8, -3, 0); x.quadraticCurveTo(-16, -8, -18, -28); x.closePath();
    ink(x, 'rgba(220,240,255,.75)', 3);
    P(x, [-10, -14, 10, -14, 2, -2, -2, -2]); x.fillStyle = '#c08aff'; x.fill();
    P(x, [-14, 26, 14, 26, 6, 14, -6, 14]); x.fillStyle = '#b04dff'; x.fill();
    x.beginPath(); x.moveTo(0, -2); x.lineTo(0, 14); x.lineWidth = 2; x.strokeStyle = '#c08aff'; x.stroke();
    shine(x, -10, -18, 4, 8, 0.3, 0.8);
  }],
  meteorSeal: ['#d0402e', x => { // 별똥별 + 인장 고리
    C(x, 0, 0, 32); x.lineWidth = 5; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 2.6; x.strokeStyle = '#ffc92e'; x.stroke();
    tongue(x, 8, -8, 13, 52, 2.36); ink(x, fireGrad(x, 8, -8, -30, 30), 3.2);
    orb(x, 8, -8, 13, '#fff6e6', '#b0703a', '#5a3018', 3.4);
    for (const [cx, cy] of [[6, -12], [12, -4]]) { C(x, cx, cy, 2.4); x.fillStyle = 'rgba(40,20,10,.6)'; x.fill(); }
  }],
  glacier: ['#1f86f0', x => { // 얼음 심장
    x.beginPath(); x.moveTo(0, 32); x.bezierCurveTo(-40, 6, -30, -32, 0, -14); x.bezierCurveTo(30, -32, 40, 6, 0, 32); x.closePath();
    ink(x, lin(x, -30, -30, 30, 30, [[0, '#ffffff'], [0.35, '#bff4ff'], [0.7, '#7fe3ff'], [1, '#2a78e0']]));
    x.beginPath(); x.moveTo(-14, -12); x.lineTo(-4, 4); x.lineTo(-10, 16); x.moveTo(12, -12); x.lineTo(6, 2); x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,.9)'; x.stroke();
    for (const [cx, cy, r] of [[-28, -26, 6], [28, -24, 5]]) { P(x, [cx, cy - r, cx + r * 0.7, cy, cx, cy + r, cx - r * 0.7, cy]); ink(x, '#dff8ff', 2.2); }
  }],
  oath: ['#e0a020', x => { // 세운 검 + 붉은 서약 띠
    P(x, [-6, 22, -6, -30, 0, -40, 6, -30, 6, 22]); ink(x, MET(x));
    x.beginPath(); x.moveTo(0, -34); x.lineTo(0, 18); x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,.8)'; x.stroke();
    P(x, [-20, 22, 20, 22, 16, 30, -16, 30]); ink(x, '#ffc92e');
    P(x, [-4, 30, 4, 30, 4, 40, -4, 40]); ink(x, '#8a4a1a', 3);
    x.beginPath(); x.moveTo(-30, -6); x.quadraticCurveTo(0, 6, 30, -6); x.lineTo(26, 4); x.quadraticCurveTo(0, 16, -26, 4); x.closePath(); ink(x, cel(x, -30, -6, 30, 16, '#ff4d5e'), 3);
  }],
  echo: ['#26b98e', x => { // 반지 + 메아리 물결
    for (const [r, a] of [[36, 0.35], [29, 0.6]]) { x.beginPath(); x.arc(0, 6, r, -2.6, -0.54); x.lineWidth = 3.4; x.strokeStyle = `rgba(255,255,255,${a})`; x.stroke(); }
    E(x, 0, 12, 20, 16); x.lineWidth = 12; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 7; x.strokeStyle = '#ffc92e'; x.stroke();
    x.lineWidth = 2; x.strokeStyle = '#fff3a8'; x.beginPath(); x.ellipse(0, 12, 20, 16, 0, -2.6, -1.2); x.stroke();
    gem(x, 0, -8, 0.62, '#6ff0c0', '#0a6e50');
  }],
  vampire: ['#a3132b', x => { // 붉은 수정 송곳니
    P(x, [-18, -30, 18, -30, 26, -16, 0, 34, -26, -16]); ink(x, lin(x, -20, -30, 20, 30, [[0, '#ffd0d4'], [0.35, '#ff4d5e'], [1, '#6a0816']]));
    x.beginPath(); x.moveTo(-18, -30); x.lineTo(0, -12); x.lineTo(18, -30); x.moveTo(0, -12); x.lineTo(0, 34); x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,.55)'; x.stroke();
    x.beginPath(); x.moveTo(22, 14); x.quadraticCurveTo(30, 26, 22, 32); x.quadraticCurveTo(14, 26, 22, 14); ink(x, '#ff4d5e', 2.4);
    shine(x, -8, -22, 6, 3, -0.5, 0.9);
  }],
  archStaff: ['#5a1fa8', x => { // 두 원소 구슬을 두른 대마법사 지팡이
    x.beginPath(); x.moveTo(-22, 38); x.lineTo(10, -14); stroke2(x, '#a0683a', 5);
    orb(x, 14, -20, 14, '#ffffff', '#c08aff', '#5a1fa8', 3.6);
    orb(x, -16, -22, 7, '#ffffff', '#ff6a1f', '#8a2008', 2.6);
    orb(x, 32, 4, 7, '#ffffff', '#7fe3ff', '#1a5aa0', 2.6);
    star4(x, 14, -20, 9, '#ffffff');
  }],
  sage: ['#4a6fb8', x => { // 외알 안경 + 사슬
    C(x, -2, -4, 22); ink(x, lin(x, -24, -26, 20, 18, [[0, 'rgba(255,255,255,.95)'], [0.4, 'rgba(200,235,255,.8)'], [1, 'rgba(120,180,255,.85)']]), 0);
    C(x, -2, -4, 22); x.lineWidth = 9; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 5; x.strokeStyle = '#ffc92e'; x.stroke();
    shine(x, -10, -14, 8, 4, -0.6, 0.9);
    x.beginPath(); x.moveTo(16, 10); x.quadraticCurveTo(30, 26, 18, 38); x.setLineDash([4, 4]); x.lineWidth = 3; x.strokeStyle = '#ffc92e'; x.stroke(); x.setLineDash([]);
    star4(x, -2, -4, 6, '#fff3a8');
  }],
  chaos: ['#2a1b36', x => { // 여러 원소가 소용돌이치는 구슬
    orb(x, 0, 0, 30, '#ffffff', '#9a3dff', '#180830');
    const cols = ['#ff6a1f', '#ffe53a', '#7fe3ff', '#6ff0c0'];
    cols.forEach((c, i) => { x.beginPath(); x.arc(0, 0, 18 - i * 3, i * 1.6, i * 1.6 + 2.4); x.lineWidth = 3.4; x.strokeStyle = c; x.stroke(); });
    star4(x, 0, 0, 8, '#ffffff');
    shine(x, -12, -14, 8, 4, -0.7, 0.8);
  }],
};

// 공통 메달: 바탕(유물 색 원) + 금테 + 광택
function medal(x, col, draw) {
  x.lineJoin = 'round'; x.lineCap = 'round';
  C(x, 0, 0, 47); ink(x, lin(x, 0, -47, 0, 47, [[0, '#fff6b0'], [0.5, '#ffc92e'], [0.52, '#e08a00'], [1, '#8a4a00']]), 4);
  C(x, 0, 0, 40); ink(x, rad(x, 0, -8, 4, 44, [[0, col], [0.7, col], [1, '#140f2e']], 0, -14), 3);
  x.save(); C(x, 0, 0, 39); x.clip();
  x.fillStyle = rad(x, 0, -10, 0, 36, [[0, 'rgba(255,255,255,.28)'], [1, 'rgba(255,255,255,0)']]); x.fillRect(-40, -40, 80, 80);
  x.scale(0.8, 0.8); draw(x);
  x.restore();
  shine(x, -18, -30, 12, 5, -0.5, 0.55);
}

export const hasRelicArt = key => !!ART[key];
export function relicEmblem(key, res = 1.6) {
  const a = ART[key];
  if (!a) return null;
  return bake('relic|' + key + '|' + res.toFixed(2), 50, 50, x => medal(x, a[0], a[1]), res);
}
const URLS = new Map();
export function relicURL(key, px = 128) {
  const k = key + '|' + px;
  let u = URLS.get(k);
  if (u === undefined) { const c = relicEmblem(key, px / 100); u = c ? c.toDataURL('image/png') : ''; URLS.set(k, u); }
  return u;
}
export const relicImg = (key, cls = 'rl-em') => { const u = relicURL(key); return u ? `<img class="${cls}" src="${u}" alt="" draggable="false">` : ''; };
export const relicColor = key => ART[key]?.[0] || '#7b6cff';

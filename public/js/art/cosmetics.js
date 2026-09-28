// 외형(v0.1.2 외형 소환) 그림 — 영웅 코스튬 20 · 대마법사 로브·지팡이 8 · 마법 이펙트 스킨 8. 전투력 0: 그림만 바꾼다.
// 코스튬·로브 = 기존 몸 도안(units.js)을 **색 바꾸기(굽는 순간만 컨텍스트 색을 갈아 끼움)** + 장식(앞·뒤) + 전설 오라·대기 동작.
// 스킨 = 내 마법탄 머리·꼬리·입자 + 내 스킬 이벤트의 입자·고리 색(그라데이션 맵) + 스킨 고유 입자. 모두 구운 캐시 → 프레임 비용 ≈ drawImage 몇 장.
// 계약: docs/DESIGN.md 'v0.1.2 외형 소환 계약 · 외형 그림'. 훅: units.heroBody/mage*·drawHero·drawMages, fx.drawBullets·part·ring, render.js events/draw.
import {
  TAU, INK2, bake, circ, ell, rrect, fs, rad, lin, poly, shine, cel, mix, lite, dim, rgb, RARITY_COL,
  ctx, T, RT, place, wt, rnd, tintOf,
} from './core.js';
import { heroBody, heroWeapon, mageBody, mageCape, mageStaff, STAFF_ORB, MAGE_GRIP, HERO_GRIP, MF } from './units.js';

// ═════════════ 장착 상태 ═════════════
let LOAD = { costume: {}, robe: null, skin: null };
let SKIN = null; // 지금 스킨 그림(없으면 기본)
export function setLoadout(eq) {
  const e = eq && typeof eq === 'object' ? eq : {};
  const c = e.costume && typeof e.costume === 'object' ? e.costume : {};
  LOAD = { costume: { ...c }, robe: e.robe || null, skin: e.skin || null };
  const s = ART[LOAD.skin];
  SKIN = s && s.kind === 'skin' ? s : null;
}
export const artOf = id => (typeof id === 'string' && Object.prototype.hasOwnProperty.call(ART, id) ? ART[id] : null);
export const kindOf = id => artOf(id)?.kind || (/^(kn|rg|so|cl|as)_/.test(id) ? 'costume' : /^rb_/.test(id) ? 'robe' : /^sk_/.test(id) ? 'skin' : null);
// 코스튬: cos === undefined → 장착한 것, null/'' → 없음(기본). 다른 클래스 코스튬은 무시
export function heroCos(cls, cos) {
  const a = artOf(cos === undefined ? LOAD.costume[cls] : cos);
  return a && a.kind === 'costume' && a.cls === cls ? a : null;
}
export function robeCos(rb) {
  const a = artOf(rb === undefined ? LOAD.robe : rb);
  return a && a.kind === 'robe' ? a : null;
}
export const cosLegs = cls => heroCos(cls)?.legs || null;           // 영웅 다리 색
export const robeOrb = () => robeCos()?.pal.orb[1] || null;        // 성벽 위 내 마법사 오브 빛
export const skinCol = () => SKIN?.main || null;                   // 내 기본 주문 시전 색
export const skinFx = () => SKIN;                                  // fx.drawBullets: { main, core, head(v), trail(x, y, vx, vy) }

// ═════════════ 색 바꾸기 (굽는 순간만) ═════════════
// 도안의 원래 색 s → 새 색 d. 셀 셰이딩이 만든 밝음(s→흰)·그림자(s→#1c1238) 섞음도 같은 비율로 d 쪽에서 다시 섞는다
const WHITE = [255, 255, 255], DARK = rgb('#1c1238');
const hex = v => '#' + v.map(n => Math.round(n).toString(16).padStart(2, '0')).join('');
function along(v, s, E) {
  let bi = 0, span = 0;
  for (let i = 0; i < 3; i++) { const d = Math.abs(E[i] - s[i]); if (d > span) { span = d; bi = i; } }
  if (span < 20) return -1;
  const t = (v[bi] - s[bi]) / (E[bi] - s[bi]);
  if (t <= 0.01 || t >= 0.99) return -1;
  for (let i = 0; i < 3; i++) if (Math.abs(s[i] + (E[i] - s[i]) * t - v[i]) > 2.6) return -1;
  return t;
}
function remapper(pairs) {
  const src = pairs.map(([s, d]) => [rgb(s), d]), memo = new Map();
  return c => {
    if (typeof c !== 'string' || c[0] !== '#' || (c.length !== 7 && c.length !== 9)) return c;
    let r = memo.get(c);
    if (r !== undefined) return r;
    r = c;
    const v = rgb(c.slice(0, 7)), a = c.slice(7);
    for (const [s, d] of src) {
      if (v[0] === s[0] && v[1] === s[1] && v[2] === s[2]) { r = d + a; break; }
      const tw = along(v, s, WHITE);
      if (tw > 0) { r = lite(d, tw) + a; break; }
      const td = along(v, s, DARK);
      if (td > 0) { r = dim(d, td) + a; break; }
    }
    memo.set(c, r);
    return r;
  };
}
// 그라데이션 맵(스킨): 밝기 → 스킨 램프 4색. 알파 접미사 유지, rgba()·짧은 색은 그대로(연기·그림자)
function rampMap(ramp) {
  const R = ramp.map(rgb), st = [0, 0.38, 0.72, 1], memo = new Map();
  return c => {
    if (typeof c !== 'string' || c[0] !== '#' || (c.length !== 7 && c.length !== 9)) return c;
    let r = memo.get(c);
    if (r !== undefined) return r;
    const v = rgb(c.slice(0, 7)), L = Math.min(1, (0.3 * v[0] + 0.59 * v[1] + 0.11 * v[2]) / 235);
    let i = 0;
    while (i < 2 && L > st[i + 1]) i++;
    const u = (L - st[i]) / (st[i + 1] - st[i]);
    r = hex(R[i].map((n, k) => n + (R[i + 1][k] - n) * u)) + c.slice(7);
    memo.set(c, r);
    return r;
  };
}
// 도안을 그리는 동안만 컨텍스트의 fillStyle/strokeStyle/그라데이션 색을 map 으로 통과시킨다(인스턴스에만 덮어쓰고 끝나면 지움)
function withMap(x, map, draw) {
  if (!map) return draw();
  const P = Object.getPrototypeOf(x), fd = Object.getOwnPropertyDescriptor(P, 'fillStyle'), sd = Object.getOwnPropertyDescriptor(P, 'strokeStyle');
  const m = v => (typeof v === 'string' ? map(v) : v);
  const wrap = g => { const add = g.addColorStop; g.addColorStop = (o, c) => add.call(g, o, m(c)); return g; };
  const cl = P.createLinearGradient, cr = P.createRadialGradient;
  Object.defineProperty(x, 'fillStyle', { configurable: true, get() { return fd.get.call(this); }, set(v) { fd.set.call(this, m(v)); } });
  Object.defineProperty(x, 'strokeStyle', { configurable: true, get() { return sd.get.call(this); }, set(v) { sd.set.call(this, m(v)); } });
  x.createLinearGradient = function () { return wrap(cl.apply(this, arguments)); };
  x.createRadialGradient = function () { return wrap(cr.apply(this, arguments)); };
  try { draw(); } finally { delete x.fillStyle; delete x.strokeStyle; delete x.createLinearGradient; delete x.createRadialGradient; }
}
const mapOf = a => a.map ? (a._m || (a._m = remapper(a.map))) : null;
// units.heroBody 가 굽는 중에 부른다: 뒤 장식 → (색 바꾼) 기본 몸 → 앞 장식
export function paintCostume(x, a, tier, base) {
  if (a.under) a.under(x, tier);
  withMap(x, mapOf(a), base);
  if (a.over) a.over(x, tier);
}
// units.mageBody/mageCape/mageStaff: part = 'body' | 'cape' | 'staff'
export function paintRobe(x, a, part, tier, base) {
  if (!a) return base();
  withMap(x, mapOf(a), base);
  if (part === 'body' && a.over) a.over(x, tier);
  if (part === 'staff' && a.staff) a.staff(x, STAFF_ORB[tier] || STAFF_ORB[0], tier);
}

// ═════════════ 그리기 도구 ═════════════
function star4(x, cx, cy, r, k = 0.3) {
  x.beginPath();
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 - Math.PI / 2, q = i % 2 ? r * k : r; i ? x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q) : x.moveTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
  x.closePath();
}
function star5(x, cx, cy, r) {
  x.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * 0.45 : r; k ? x.lineTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q) : x.moveTo(cx + Math.cos(a) * q, cy + Math.sin(a) * q); }
  x.closePath();
}
// 잎·깃털 한 장: (cx,cy)에서 ang 방향으로 len, 폭 w
function leafP(x, cx, cy, len, w, ang) {
  const c = Math.cos(ang), s = Math.sin(ang), P = (u, v) => [cx + c * u - s * v, cy + s * u + c * v];
  const a = P(len * 0.5, -w), b = P(len, 0), d = P(len * 0.5, w);
  x.beginPath(); x.moveTo(cx, cy); x.quadraticCurveTo(a[0], a[1], b[0], b[1]); x.quadraticCurveTo(d[0], d[1], cx, cy); x.closePath();
}
// 뿔: 뿌리(bx,by) 폭 w → 끝(tx,ty), bend = 휘는 쪽(법선 방향 배율)
function horn(x, bx, by, tx, ty, w, c0, c1, bend = 1) {
  const dx = tx - bx, dy = ty - by, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  const mx = bx + dx * 0.5 + nx * w * 1.4 * bend, my = by + dy * 0.5 + ny * w * 1.4 * bend;
  x.beginPath();
  x.moveTo(bx + nx * w / 2, by + ny * w / 2);
  x.quadraticCurveTo(mx + nx * w * 0.3, my + ny * w * 0.3, tx, ty);
  x.quadraticCurveTo(mx - nx * w * 0.3, my - ny * w * 0.3, bx - nx * w / 2, by - ny * w / 2);
  x.closePath();
  fs(x, lin(x, bx, by, tx, ty, [[0, c0], [0.55, mix(c0, c1, 0.35)], [1, c1]]), 2.2, INK2);
}
function flower(x, cx, cy, r, petal, heart = '#ffe45a', rot = 0) {
  for (let k = 0; k < 5; k++) {
    const a = rot + k * TAU / 5;
    ell(x, cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.55, r * 0.4, a);
    fs(x, petal, 1.2, INK2);
  }
  circ(x, cx, cy, r * 0.3); fs(x, heart, 1, INK2);
}
// 작은 날개(깃 3장 부채): 위·바깥(dir)으로
function wingFan(x, bx, by, dir, s, col, tip) {
  for (let k = 2; k >= 0; k--) {
    leafP(x, bx, by, (15 - k * 3.2) * s, 3.6 * s, -Math.PI / 2 - dir * (0.35 + k * 0.42));
    fs(x, lin(x, bx, by - 14 * s, bx, by, [[0, tip], [1, col]]), 1.7, INK2);
  }
}
// 셀 셰이딩 단색 채움 + 외곽선
const cf = (x, x0, y0, x1, y1, col, lw = 2) => fs(x, cel(x, x0, y0, x1, y1, col), lw, INK2);
// 열린 투구(얼굴은 보임): 기사 투구 도안과 같은 선
function openHelm(x, col, trim) {
  x.beginPath(); x.arc(1, -58, 19.5, Math.PI * 0.95, Math.PI * 2.05); x.lineTo(20, -50); x.lineTo(15, -50); x.lineTo(15, -58); x.lineTo(-12, -58); x.lineTo(-12, -48); x.lineTo(-18, -48); x.closePath();
  cf(x, -18, -78, 20, -48, col, 3.2);
  x.beginPath(); x.moveTo(-12, -58.6); x.lineTo(15, -58.6); x.lineWidth = 2.4; x.strokeStyle = trim; x.stroke();
  x.beginPath(); x.arc(1, -58, 15, Math.PI * 1.2, Math.PI * 1.55); x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,0.55)'; x.stroke();
}

// ═════════════ 카탈로그(그림) ═════════════
// 등급 r: c 일반(팔레트) · r 희귀(팔레트+장식) · e 영웅(팔레트+큰 장식) · l 전설(고유 실루엣 + 오라 + 대기 동작)
const ART = {};
const def = (id, o) => { ART[id] = { id, ...o }; };
export const RAR = { c: 'common', r: 'rare', e: 'epic', l: 'legend' };

// 영웅 기본 색(units.js HERO_ART 도안 그대로) — 여기서 바꿀 색을 짝지어 준다
// 기사: 강철 #9fb2cf · 휘장/방패 #3a6ee8 · 금 #ffc92e · 머리 #8a5226 · 눈 #5a8cff · 십자 #eef2f7
def('kn_crimson', {
  kind: 'costume', cls: 'knight', r: 'c', legs: '#4a2430',
  map: [['#3a6ee8', '#d8283e'], ['#9fb2cf', '#8d90a6'], ['#8a5226', '#3a2a2a'], ['#5a8cff', '#e8384f']],
});
def('kn_jade', {
  kind: 'costume', cls: 'knight', r: 'r', legs: '#2a5a4a',
  map: [['#3a6ee8', '#1aa878'], ['#9fb2cf', '#e4ecf2'], ['#ffc92e', '#ffe07a'], ['#8a5226', '#e8cf8a'], ['#5a8cff', '#1fc88a']],
  over(x) { // 날개 달린 은 서클릿 + 비취 보석
    wingFan(x, -15, -66, 1, 1, '#f4f8fb', '#bff4e0');
    rrect(x, -16, -69, 35, 5.5, 2.7); cf(x, -16, -69, 19, -63.5, '#eef4f8');
    wingFan(x, 18.5, -66, -1, 0.62, '#f4f8fb', '#bff4e0');
    circ(x, 1.5, -66.3, 3.8); fs(x, rad(x, 1.5, -66.3, 0, 3.8, [[0, '#eafff4'], [0.45, '#3fe0a0'], [1, '#0e7a4a']], 0.5, -67.5), 1.6, INK2);
  },
});
def('kn_obsidian', {
  kind: 'costume', cls: 'knight', r: 'e', legs: '#1e1a2a',
  map: [['#9fb2cf', '#3a3444'], ['#3a6ee8', '#2a2230'], ['#ffc92e', '#ff8a1e'], ['#8a5226', '#1a1426'], ['#5a8cff', '#ffb020'], ['#eef2f7', '#ff6a1f'], ['#ffd23a', '#ffb020']],
  over(x) { // 뿔 투구 + 갑주 틈으로 새는 용암빛(흑요석)
    horn(x, -8, -74, -31, -97, 8, '#fff1d6', '#e0400f', -1);
    openHelm(x, '#2e2a38', '#ff8a1e');
    horn(x, 12, -75, 25, -97, 6.5, '#fff1d6', '#e0400f', 1);
    poly(x, [1, -80, 4, -70, 1, -66, -2, -70]); fs(x, '#ff8a1e', 1.4, INK2);
    for (const [w, c] of [[3.2, '#ff6a1f'], [1.3, '#ffe45a']]) {
      x.lineWidth = w; x.strokeStyle = c; x.beginPath();
      x.moveTo(-9, -36); x.lineTo(-5, -31); x.lineTo(-8, -26); x.lineTo(-4, -20);
      x.moveTo(8, -38); x.lineTo(5, -33); x.lineTo(9, -28);
      x.moveTo(-13, -70); x.lineTo(-9, -66); x.lineTo(-12, -62);
      x.stroke();
    }
  },
});
def('kn_solar', {
  kind: 'costume', cls: 'knight', r: 'l', legs: '#8a5a1a', glow: '#ffd23a',
  map: [['#9fb2cf', '#fff0c8'], ['#3a6ee8', '#ff9a1a'], ['#ffc92e', '#fff3a8'], ['#8a5226', '#ffe07a'], ['#5a8cff', '#ff9a1a'], ['#eef2f7', '#fff8e0'], ['#ffd23a', '#ff6a1f']],
  over(x) { // 태양 문장 투구(고유 실루엣): 광선 10 + 원판 + 루비 · 금 날개
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k - 4.5) * 0.3, c = Math.cos(a), s = Math.sin(a), L = k % 2 ? 15 : 19;
      poly(x, [1 + c * 7 - s * 2.6, -84 + s * 7 + c * 2.6, 1 + c * L, -84 + s * L, 1 + c * 7 + s * 2.6, -84 + s * 7 - c * 2.6]);
      fs(x, k % 2 ? '#ffb020' : '#ffe45a', 1.6, INK2);
    }
    circ(x, 1, -84, 8.5); fs(x, rad(x, 1, -84, 0, 8.5, [[0, '#fffbe0'], [0.5, '#ffd23a'], [1, '#e08a00']], -1.5, -86.5), 2.2, INK2);
    wingFan(x, -16, -64, 1, 1.05, '#fff3a8', '#ffffff');
    openHelm(x, '#ffd970', '#fff6d0');
    circ(x, 1, -84, 3); fs(x, '#ff3b5c', 1.2, INK2);
    shine(x, -0.5, -85.5, 1.3, 0.8, -0.6, 0.95);
  },
  aura: auraSolar,
});
// 궁수: 튜닉 #4f9a4a · 두건 #3e8a3a · 어깨 #6aa84a/#8ae05a · 벨트 #6a4a2a · 장식 #c9853a · 머리 #e8a84a · 눈 #4fd06a
def('rg_autumn', {
  kind: 'costume', cls: 'ranger', r: 'c', legs: '#5a2a1a',
  map: [['#4f9a4a', '#c8662a'], ['#3e8a3a', '#a8421e'], ['#6aa84a', '#e0a040'], ['#8ae05a', '#ffc24a'], ['#e8a84a', '#7a3a1e'], ['#4fd06a', '#e07a2a'], ['#c9853a', '#ffd23a']],
});
def('rg_snow', {
  kind: 'costume', cls: 'ranger', r: 'r', legs: '#3a5a7a',
  map: [['#4f9a4a', '#6aa8d8'], ['#3e8a3a', '#e8f2fa'], ['#6aa84a', '#bfe0f0'], ['#8ae05a', '#e8f8ff'], ['#e8a84a', '#f4f8ff'], ['#4fd06a', '#2ab0f0'], ['#c9853a', '#7fe3ff'], ['#6a4a2a', '#3a5a7a']],
  over(x) { // 털 두건 테 + 얼음 깃
    x.beginPath(); x.arc(1, -57, 21.6, Math.PI * 1.0, Math.PI * 2.0);
    x.lineWidth = 11; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 8; x.strokeStyle = '#f4f9ff'; x.stroke();
    for (let k = 0; k <= 6; k++) { const a = Math.PI * 1.02 + k * Math.PI * 0.96 / 6, px = 1 + Math.cos(a) * 22.5, py = -57 + Math.sin(a) * 22.5; circ(x, px, py, 4.6); fs(x, rad(x, px, py, 0, 4.6, [[0, '#ffffff'], [0.6, '#f4f9ff'], [1, '#c8dcf0']], px - 1.5, py - 1.8), 0); }
    x.beginPath(); x.arc(1, -57, 18.2, Math.PI * 1.08, Math.PI * 1.92); x.lineWidth = 1.2; x.strokeStyle = '#a8c4e0'; x.stroke();
    leafP(x, 15, -71, 20, 4.2, -0.75); fs(x, lin(x, 15, -71, 30, -86, [[0, '#ffffff'], [1, '#7fe3ff']]), 1.6, INK2);
  },
});
def('rg_raven', {
  kind: 'costume', cls: 'ranger', r: 'e', legs: '#1a1426',
  map: [['#4f9a4a', '#2e2848'], ['#3e8a3a', '#1c1830'], ['#6aa84a', '#4a3a6a'], ['#8ae05a', '#6a4a9a'], ['#e8a84a', '#2a1e3a'], ['#4fd06a', '#ffcf4a'], ['#c9853a', '#b04dff'], ['#6a4a2a', '#2a2040']],
  over(x) { // 까마귀 부리 챙 + 깃털 어깨
    for (const s of [-1, 1]) for (let k = 3; k >= 0; k--) {
      leafP(x, s * 9, -42, 13 - k, 3.4, s > 0 ? 0.25 + k * 0.32 : Math.PI - 0.25 - k * 0.32);
      fs(x, lin(x, s * 9, -42, s * 20, -30, [[0, '#3a3058'], [1, '#9a6ae8']]), 1.5, INK2);
    }
    // 뒤 어깨 위의 까마귀
    x.beginPath(); x.moveTo(-27, -41); x.lineTo(-40, -33); x.lineTo(-36, -39); x.closePath(); fs(x, '#3a3460', 1.5, INK2);
    ell(x, -25, -44, 8, 5.6, -0.3); fs(x, cel(x, -33, -50, -17, -38, '#46407a'), 2, INK2);
    leafP(x, -21, -45, 12, 3.4, 2.75); fs(x, lin(x, -21, -45, -33, -42, [[0, '#5a4a9a'], [1, '#2a2448']]), 1.3, INK2);
    circ(x, -19, -51, 4.8); fs(x, cel(x, -24, -56, -14, -46, '#46407a'), 2, INK2);
    poly(x, [-15.5, -52.5, -8, -50.5, -15.5, -49]); fs(x, '#ffc24a', 1.2, INK2);
    circ(x, -18, -52.2, 1.5); x.fillStyle = '#ffe45a'; x.fill();
    circ(x, -17.8, -52.3, 0.6); x.fillStyle = INK2; x.fill();
    x.beginPath(); x.moveTo(6, -77); x.quadraticCurveTo(22, -76, 33, -67); x.quadraticCurveTo(21, -67, 11, -66); x.closePath();
    fs(x, lin(x, 6, -77, 33, -66, [[0, '#3a3058'], [1, '#141020']]), 2, INK2);
    x.beginPath(); x.moveTo(10, -74); x.quadraticCurveTo(20, -73, 27, -69); x.lineWidth = 1.4; x.strokeStyle = '#b88aff'; x.stroke();
  },
});
def('rg_sylvan', {
  kind: 'costume', cls: 'ranger', r: 'l', legs: '#2a4a2a', glow: '#8dff6a',
  map: [['#4f9a4a', '#35b060'], ['#3e8a3a', '#2a7a44'], ['#6aa84a', '#c8e070'], ['#8ae05a', '#e8ff9a'], ['#e8a84a', '#f0f8d0'], ['#4fd06a', '#7affb0'], ['#c9853a', '#ffd23a']],
  over(x) { // 세계수 뿔 왕관(고유 실루엣): 가지 두 줄기 + 잎 + 꽃
    const branch = pts => { for (const [w, c] of [[6.2, INK2], [3.4, '#b08050']]) { x.beginPath(); x.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 4) x.quadraticCurveTo(pts[i], pts[i + 1], pts[i + 2], pts[i + 3]); x.lineWidth = w; x.strokeStyle = c; x.stroke(); } };
    branch([-6, -76, -10, -88, -16, -96, -20, -101, -26, -105]);
    branch([-11, -88, -20, -88, -25, -86]);
    branch([10, -77, 14, -89, 17, -97, 19, -102, 16, -107]);
    branch([15, -90, 22, -92, 27, -91]);
    const lf = [[-26, -105, -2.3], [-25, -86, -2.9], [16, -107, -1.4], [27, -91, -0.5], [-18, -99, -1.9], [19, -99, -0.9]];
    for (const [lx, ly, a] of lf) { leafP(x, lx, ly, 9, 3.2, a); fs(x, lin(x, lx, ly, lx + Math.cos(a) * 9, ly + Math.sin(a) * 9, [[0, '#3fbf5a'], [1, '#bfff7a']]), 1.3, INK2); }
    flower(x, -14, -72, 5.5, '#fff0f6', '#ffcf4a', 0.3);
  },
  aura: auraSylvan,
});
// 마법사: 로브 #7a4ad8 · 모자 #5a2fb0 · 장식 #ffcf4a · 띠 #3a1f7a · 보석 #7fe3ff · 머리 #4a3470 · 눈 #b27aff
def('so_azure', {
  kind: 'costume', cls: 'sorcerer', r: 'c', legs: '#1e2a4a',
  map: [['#7a4ad8', '#2a7ad8'], ['#5a2fb0', '#1f5cb0'], ['#3a1f7a', '#123a7a'], ['#4a3470', '#1e2a4a'], ['#ffcf4a', '#e8f4ff'], ['#b27aff', '#3fa9ff']],
});
def('so_pumpkin', {
  kind: 'costume', cls: 'sorcerer', r: 'r', legs: '#2a2040',
  map: [['#7a4ad8', '#ff8a1e'], ['#5a2fb0', '#2e2448'], ['#3a1f7a', '#5a1e8a'], ['#4a3470', '#7a2a9a'], ['#ffcf4a', '#8ae05a'], ['#b27aff', '#ff8a1e'], ['#7fe3ff', '#8ae05a']],
  over(x) { // 초록 띠 + 은 버클 + 호박 장식 + 누빈 천
    rrect(x, -13, -77.5, 28, 5.5, 2.4); cf(x, -13, -77.5, 15, -72, '#6ac83a');
    rrect(x, -1, -79.5, 9, 9, 1.8); fs(x, '#e8ecf4', 1.8, INK2);
    rrect(x, 1.6, -77, 3.8, 4, 0.8); fs(x, '#2e2448', 0, INK2);
    ell(x, -19, -70, 6.5, 5.2); fs(x, cel(x, -25.5, -75, -12.5, -65, '#ff9a2a'), 1.8, INK2);
    x.beginPath(); x.moveTo(-19, -74.5); x.quadraticCurveTo(-21.5, -70, -19, -65.5); x.moveTo(-19, -74.5); x.quadraticCurveTo(-16.5, -70, -19, -65.5); x.lineWidth = 1.2; x.strokeStyle = '#a84a0a'; x.stroke();
    rrect(x, -20, -78.5, 2.4, 4, 1); fs(x, '#4fb03a', 1.1, INK2);
    rrect(x, 4, -25, 8, 8, 1.4); fs(x, '#ffc24a', 1.4, INK2);
    x.setLineDash([1.6, 1.6]); x.strokeStyle = '#8a4a0a'; x.lineWidth = 0.9; x.strokeRect(5.2, -23.8, 5.6, 5.6); x.setLineDash([]);
  },
});
def('so_nebula', {
  kind: 'costume', cls: 'sorcerer', r: 'e', legs: '#141848',
  map: [['#7a4ad8', '#1c2268'], ['#5a2fb0', '#161c52'], ['#3a1f7a', '#4a2a9a'], ['#4a3470', '#e0e8ff'], ['#ffcf4a', '#c8d8ff'], ['#b27aff', '#8ab8ff'], ['#7fe3ff', '#fff0a8']],
  over(x) { // 별 무늬 + 모자 끝 초승달
    for (const [sx, sy, r] of [[-6, -86, 2.8], [8, -80, 2.1], [13, -93, 2.3], [-9, -30, 2.6], [9, -21, 2.1], [-3, -17, 1.6], [4, -34, 1.5]]) { star4(x, sx, sy, r); fs(x, '#fff4c0', 0.9, '#3a3a8a'); }
    x.beginPath(); x.moveTo(22, -96); x.lineTo(23, -87); x.lineWidth = 1.2; x.strokeStyle = '#c8d8ff'; x.stroke();
    x.beginPath(); x.arc(23, -81.5, 5.8, 0, TAU); x.arc(25.2, -83, 4.8, 0, TAU, true);
    fs(x, lin(x, 18, -87, 28, -76, [[0, '#fffbe0'], [1, '#ffd23a']]), 1.4, INK2);
  },
});
def('so_phoenix', {
  kind: 'costume', cls: 'sorcerer', r: 'l', legs: '#4a0a14', glow: '#ff6a1f',
  map: [['#7a4ad8', '#d8283e'], ['#5a2fb0', '#b01e2a'], ['#3a1f7a', '#5a0a1a'], ['#4a3470', '#ffcf6a'], ['#ffcf4a', '#ffd23a'], ['#b27aff', '#ff8a1e'], ['#7fe3ff', '#ffb020']],
  over(x) { // 불사조 깃 세 가닥(고유 실루엣) + 금 깃 목장식
    const plume = (bx, by, tx, ty, w) => {
      const dx = tx - bx, dy = ty - by;
      x.beginPath(); x.moveTo(bx, by);
      x.bezierCurveTo(bx + dx * 0.3 - dy * 0.35 * w, by + dy * 0.3 + dx * 0.35 * w, tx - dx * 0.2, ty - dy * 0.1 - 4, tx, ty);
      x.bezierCurveTo(tx - dx * 0.1, ty + 6, bx + dx * 0.4 + dy * 0.25 * w, by + dy * 0.4 - dx * 0.2 * w, bx, by);
      x.closePath();
      fs(x, lin(x, bx, by, tx, ty, [[0, '#ffe45a'], [0.45, '#ff8a1e'], [1, '#e0280f']]), 2, INK2);
    };
    plume(-10, -76, -34, -78, 0.35);
    plume(-9, -78, -38, -92, 0.4);
    plume(-7, -80, -30, -106, 0.45);
    for (let k = -2; k <= 2; k++) { leafP(x, k * 4.4, -40.5, 6.5, 2.4, Math.PI / 2 + k * 0.3); fs(x, k % 2 ? '#ffd23a' : '#ffb020', 1.2, INK2); }
  },
  aura: auraPhoenix,
});
// 성직자: 로브 #f4eedc · 금 #ffc92e · 영대 #6a8ad8 · 머리 #f4d27a · 눈 #c8782a (흰 십자·후광은 그대로)
def('cl_rose', {
  kind: 'costume', cls: 'cleric', r: 'c', legs: '#d8a0b4',
  map: [['#f4eedc', '#ffe4ee'], ['#ffc92e', '#ff6a9a'], ['#6a8ad8', '#d84a7a'], ['#f4d27a', '#a8423a'], ['#c8782a', '#d8406a']],
});
def('cl_tide', {
  kind: 'costume', cls: 'cleric', r: 'r', legs: '#5aa8c0',
  map: [['#f4eedc', '#e0fbff'], ['#ffc92e', '#3ad0e0'], ['#6a8ad8', '#1a7ab0'], ['#f4d27a', '#5ae0d0'], ['#c8782a', '#1a8ab0']],
  over(x) { // 조개 머리 장식 + 진주 목걸이
    const cx = -12, cy = -66;
    x.beginPath(); x.moveTo(cx, cy + 3); x.arc(cx, cy, 8.5, Math.PI * 0.95 - 0.35, Math.PI * 2.05 - 0.35); x.closePath();
    fs(x, lin(x, cx, cy - 8, cx, cy + 3, [[0, '#fff0e8'], [1, '#ffb8a8']]), 1.8, INK2);
    x.lineWidth = 1; x.strokeStyle = '#d88070';
    for (let k = 1; k < 6; k++) { const a = Math.PI * 0.95 - 0.35 + k * (Math.PI * 1.1) / 6; x.beginPath(); x.moveTo(cx, cy + 2); x.lineTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8); x.stroke(); }
    circ(x, cx, cy + 2, 2.2); fs(x, '#ffffff', 1, INK2);
    for (let k = 0; k < 7; k++) { const a = 0.2 * Math.PI + k * 0.1 * Math.PI; circ(x, Math.cos(a) * 11.5, -44 + Math.sin(a) * 4.5, 1.9); fs(x, '#fbfdff', 1, INK2); }
  },
});
def('cl_eclipse', {
  kind: 'costume', cls: 'cleric', r: 'e', legs: '#2a2440',
  map: [['#f4eedc', '#3a3258'], ['#ffc92e', '#d0d8f0'], ['#6a8ad8', '#8a4ad8'], ['#f4d27a', '#eceaf8'], ['#c8782a', '#8a6aff']],
  under(x) { // 등 뒤 은빛 초승달
    x.beginPath(); x.arc(-2, -62, 26, 0, TAU); x.arc(5, -67, 22, 0, TAU, true);
    fs(x, lin(x, -28, -88, 20, -40, [[0, '#ffffff'], [0.5, '#c8d0f0'], [1, '#7a6ab8']]), 2.4, INK2);
  },
  over(x) { // 어둠 베일(뒤로 늘어짐) + 은 테
    x.beginPath(); x.arc(1, -58, 20.5, Math.PI * 0.98, Math.PI * 1.9); x.quadraticCurveTo(12, -70, 4, -72); x.quadraticCurveTo(-8, -70, -14, -56);
    x.quadraticCurveTo(-14, -46, -9, -38); x.lineTo(-19, -36); x.quadraticCurveTo(-22, -46, -19.5, -58); x.closePath();
    fs(x, lin(x, 0, -80, 0, -36, [[0, '#4a3e70'], [1, '#231c3a']]), 2.4, INK2);
    x.beginPath(); x.arc(1, -58, 18.6, Math.PI * 1.08, Math.PI * 1.82); x.lineWidth = 1.6; x.strokeStyle = '#dfe4ff'; x.stroke();
    circ(x, 1, -76, 2.6); fs(x, '#dfe4ff', 1.2, INK2);
  },
});
def('cl_seraph', {
  kind: 'costume', cls: 'cleric', r: 'l', legs: '#e8dcb8', glow: '#fff0a8',
  map: [['#f4eedc', '#fffaf0'], ['#ffc92e', '#ffd23a'], ['#6a8ad8', '#ffb0d8'], ['#f4d27a', '#fff2b0'], ['#c8782a', '#4ab0ff']],
  under(x) { // 여섯 깃 날개 한 쌍(고유 실루엣) — 등 뒤에서 위로
    const wing = (bx, by, dir, s, a0) => {
      for (let k = 5; k >= 0; k--) {
        leafP(x, bx, by, (33 - k * 3.2) * s, 5.4 * s, -Math.PI / 2 - dir * (a0 + k * 0.26));
        fs(x, lin(x, bx - dir * 26 * s, by - 26 * s, bx, by, [[0, '#fff3c0'], [0.35, '#ffffff'], [1, '#dfe6f4']]), 1.9, INK2);
      }
    };
    wing(-9, -40, 1, 1, 0.45);   // 뒤쪽 큰 날개(위 → 옆으로 부채)
    wing(8, -44, -1, 0.8, 0.2);  // 앞쪽 날개(어깨 너머로)
  },
  over(x) { // 금 월계관
    for (let k = 0; k < 7; k++) { const a = Math.PI * 1.08 + k * Math.PI * 0.14; leafP(x, 1 + Math.cos(a) * 18, -60 + Math.sin(a) * 18, 7.5, 2.6, a + Math.PI * 0.55); fs(x, k % 2 ? '#ffd23a' : '#ffe98a', 1.2, INK2); }
  },
  aura: auraSeraph,
});
// 암살자: 목도리 #e8384f · 가죽 #40345a · 두건 #2a2040 · 복면 #4a3a6a · 머리 #1e1a2e
def('as_teal', {
  kind: 'costume', cls: 'assassin', r: 'c', legs: '#12242a',
  map: [['#e8384f', '#1fc8b0'], ['#40345a', '#1e3a44'], ['#2a2040', '#14282e'], ['#4a3a6a', '#2a4a52'], ['#1e1a2e', '#0e2024']],
});
def('as_fox', {
  kind: 'costume', cls: 'assassin', r: 'r', legs: '#3a1e14',
  map: [['#e8384f', '#ff8a1e'], ['#40345a', '#5a2e1e'], ['#2a2040', '#4a2618'], ['#4a3a6a', '#fff2e0'], ['#1e1a2e', '#2a140e']],
  under(x) { // 복슬 꼬리
    x.beginPath(); x.moveTo(-6, -24); x.bezierCurveTo(-26, -24, -40, -34, -36, -54); x.bezierCurveTo(-30, -48, -24, -40, -10, -34);
    x.quadraticCurveTo(-4, -30, -6, -24); x.closePath();
    fs(x, lin(x, -6, -24, -36, -54, [[0, '#e0661a'], [0.6, '#ff9a3a'], [0.78, '#ffe8d0'], [1, '#ffffff']]), 2.4, INK2);
  },
  over(x) { // 여우 귀 + 가면 붉은 무늬
    for (const [a, b, c] of [[[-10, -73], [-17, -95], [-1, -78]], [[7, -77], [13, -96], [18, -72]]]) {
      poly(x, [a[0], a[1], b[0], b[1], c[0], c[1]]); fs(x, '#e0661a', 2, INK2);
      poly(x, [a[0] * 0.7 + c[0] * 0.3, a[1] * 0.7 + c[1] * 0.3 - 1, b[0] * 0.8 + (a[0] + c[0]) * 0.1, b[1] * 0.8 + (a[1] + c[1]) * 0.1, a[0] * 0.3 + c[0] * 0.7, a[1] * 0.3 + c[1] * 0.7 - 1]);
      x.fillStyle = '#ffe8d0'; x.fill();
    }
    x.lineWidth = 1.5; x.strokeStyle = '#e8303a';
    x.beginPath(); x.moveTo(-12, -47); x.quadraticCurveTo(-8, -46, -7, -42); x.moveTo(17, -47); x.quadraticCurveTo(13, -46, 12, -42); x.stroke();
    circ(x, 9, -33, 3.2); fs(x, rad(x, 9, -33, 0, 3.2, [[0, '#fff3a8'], [0.6, '#ffc92e'], [1, '#b8700a']], 8, -34.3), 1.2, INK2); // 목도리에 단 방울
    x.beginPath(); x.moveTo(7.3, -32); x.lineTo(10.7, -32); x.lineWidth = 0.9; x.strokeStyle = INK2; x.stroke();
  },
});
def('as_oni', {
  kind: 'costume', cls: 'assassin', r: 'e', legs: '#1a0e0e',
  map: [['#e8384f', '#ff2a2a'], ['#40345a', '#2e1a1e'], ['#2a2040', '#1a0e10'], ['#4a3a6a', '#c81e2a'], ['#1e1a2e', '#1a0808'], ['#dfe6f2', '#ffd8c8']],
  over(x) { // 두건을 뚫은 도깨비 뿔 + 가면 송곳니
    horn(x, -6, -76, -13, -95, 6.5, '#fff1d6', '#e82a2a', -1);
    horn(x, 9, -77, 17, -95, 6, '#fff1d6', '#e82a2a', 1);
    for (const fx of [-2, 8]) { poly(x, [fx - 2, -38.6, fx, -44, fx + 2, -38.6]); fs(x, '#ffffff', 1.1, INK2); }
    x.lineWidth = 1.3; x.strokeStyle = '#ffd23a';
    x.beginPath(); x.moveTo(-14, -47); x.lineTo(-4, -45); x.moveTo(18, -47); x.lineTo(11, -45); x.stroke();
  },
});
def('as_moon', {
  kind: 'costume', cls: 'assassin', r: 'l', legs: '#22223e', glow: '#9fdcff',
  map: [['#e8384f', '#9fd8ff'], ['#40345a', '#2c2c4e'], ['#2a2040', '#e4ecf8'], ['#4a3a6a', '#34345e'], ['#1e1a2e', '#cfe0ff']],
  under(x) { // 달빛 목도리 두 가닥(고유 실루엣)
    const tail = (y0, x1, y1, amp) => {
      x.beginPath(); x.moveTo(-4, y0 - 3);
      x.bezierCurveTo(-18, y0 - 10 - amp, -28, y1 + amp, x1, y1 - 2);
      x.lineTo(x1 - 3, y1 + 4);
      x.bezierCurveTo(-26, y1 + amp + 6, -16, y0 - 2 - amp, -4, y0 + 3);
      x.closePath();
      fs(x, lin(x, -4, y0, x1, y1, [[0, '#e8f6ff'], [0.6, '#9fd8ff'], [1, '#5a7ad8']]), 2.2, INK2);
    };
    tail(-42, -44, -36, 5);
    tail(-40, -41, -22, -4);
  },
  over(x) { // 두건 이마의 초승달
    x.beginPath(); x.arc(1, -72, 5, 0, TAU); x.arc(3.4, -73.6, 4.2, 0, TAU, true);
    fs(x, lin(x, -4, -77, 6, -67, [[0, '#fffbe0'], [1, '#9fd8ff']]), 1.3, INK2);
  },
  aura: auraMoon,
});

// 대마법사 로브 — 팔레트(MAGE_PAL 모양) + 지팡이 나무·금 색 + 장식. 지팡이 기본 나무 #c89058/#8a5a30/#4a2a14, 4단계 금 #fff6b0/#ffc92e/#c27a10/#e0a010
const robe = (id, r, pal, o = {}) => def(id, { kind: 'robe', r, pal: { ...MAGE_PAL_DEF, ...pal }, ...o });
const MAGE_PAL_DEF = { robe: '#c8263e', trim: '#ffc92e', trimD: '#a8600a', inner: '#fff1d6', hat: '#b01e3a', lining: '#ffb020', hair: '#f6f2ff', iris: '#ff8a1e', orb: ['#fff2a0', '#ffb030', '#b3230f'] }; // = MAGE_PAL[0]
robe('rb_forest', 'c', { robe: '#3f8a3a', trim: '#e8c86a', trimD: '#8a6a2a', inner: '#f4f0d8', hat: '#2f6a2a', lining: '#a8d84a', hair: '#e8e0c8', iris: '#4fd06a', orb: ['#f0fff0', '#6ff06a', '#1d8a3a'] },
  { map: [['#c89058', '#b08a58'], ['#8a5a30', '#6a5a2a']] });
robe('rb_ash', 'c', { robe: '#6a6a7e', trim: '#e8ecf4', trimD: '#8a90a0', inner: '#f4f4f8', hat: '#4a4a5e', lining: '#b8c0d0', hair: '#f4f4f8', iris: '#8a9ab0', orb: ['#ffffff', '#c8d8ff', '#6a7ab0'] },
  { map: [['#c89058', '#a8a8b8'], ['#8a5a30', '#5a5a6a'], ['#4a2a14', '#2a2a3a']] });
robe('rb_royal', 'r', { robe: '#2a3ab8', trim: '#ffc92e', trimD: '#a8600a', inner: '#fff6e0', hat: '#1e2a8a', lining: '#e84a5a', hair: '#f6f2ff', iris: '#3fa9ff', orb: ['#e8f8ff', '#3fa9ff', '#1450b8'] }, {
  map: [['#c89058', '#fff3a8'], ['#8a5a30', '#e0a010'], ['#4a2a14', '#8a5000']],
  over(x) { // 흰 담비 깃 + 작은 왕관
    x.beginPath(); x.moveTo(-25, -52); x.quadraticCurveTo(0, -61, 25, -52); x.quadraticCurveTo(27, -44, 19, -42); x.quadraticCurveTo(0, -48, -19, -42); x.quadraticCurveTo(-27, -44, -25, -52); x.closePath();
    fs(x, cel(x, -27, -60, 27, -42, '#fbfbff', 0.2, 0.16), 2.6, INK2);
    for (const [sx, sy] of [[-15, -48], [-5, -51.5], [6, -51.5], [16, -48]]) { x.beginPath(); x.moveTo(sx, sy - 2.2); x.quadraticCurveTo(sx + 1.8, sy + 1, sx, sy + 2.6); x.quadraticCurveTo(sx - 1.8, sy + 1, sx, sy - 2.2); x.fillStyle = INK2; x.fill(); }
    poly(x, [-8, -95, -8, -104, -4, -99, 1, -107, 6, -99, 10, -104, 10, -95]);
    fs(x, lin(x, 0, -107, 0, -95, [[0, '#fff6b0'], [0.5, '#ffc92e'], [1, '#c27a10']]), 1.8, INK2);
    circ(x, 1, -98, 1.8); fs(x, '#3fa9ff', 1, INK2);
  },
  staff(x, ob) { // 홀 끝 백합 장식
    const t = ob.y - ob.r;
    poly(x, [0, t - 13, 2.6, t - 5, 0, t - 1, -2.6, t - 5]); fs(x, '#ffd23a', 1.6, INK2);
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 1.5, t - 2); x.quadraticCurveTo(s * 9, t - 6, s * 6, t - 11); x.quadraticCurveTo(s * 5, t - 6, s * 1.5, t - 4); x.closePath(); fs(x, '#ffc92e', 1.4, INK2); }
  },
});
robe('rb_sakura', 'r', { robe: '#ffa8c8', trim: '#fff4f8', trimD: '#d87a9a', inner: '#fff8fb', hat: '#ff84ae', lining: '#fff0f5', hair: '#ffe8f0', iris: '#ff5a8a', orb: ['#ffffff', '#ff9ad0', '#d8408a'] }, {
  map: [['#c89058', '#9a5a5a'], ['#8a5a30', '#6a3a3a'], ['#4a2a14', '#3a1a1a']],
  over(x) { // 모자의 벚꽃 가지 + 옷자락 꽃잎
    leafP(x, 16, -90, 10, 3, -0.4); fs(x, '#6ad06a', 1.2, INK2);
    leafP(x, 14, -88, 9, 3, 0.5); fs(x, '#4fb05a', 1.2, INK2);
    flower(x, 20, -92, 6.5, '#ffd0e4', '#ff5a8a', 0.2);
    flower(x, 27, -86, 5, '#ffffff', '#ff8ab8', 0.9);
    flower(x, 12, -97, 4.2, '#ffb8d4', '#ff5a8a', 0.5);
    for (const [px, py, a] of [[-18, -11, 0.6], [15, -7, -0.4], [-5, -21, 1.8], [7, -30, 2.6]]) { leafP(x, px, py, 6, 2.6, a); fs(x, '#ffc4dc', 1, INK2); }
  },
  staff(x, ob) {
    flower(x, 4.5, -28, 4.4, '#ffd0e4', '#ff5a8a', 0.3);
    flower(x, -4, -8, 3.6, '#ffffff', '#ff8ab8', 1.1);
    leafP(x, 3, ob.y + ob.r + 2, 8, 2.6, -0.6); fs(x, '#6ad06a', 1.1, INK2);
  },
});
robe('rb_frost', 'e', { robe: '#9fd8f8', trim: '#ffffff', trimD: '#5aa0d8', inner: '#f0fbff', hat: '#6ab8f0', lining: '#e0f6ff', hair: '#e8fbff', iris: '#2ad0ff', orb: ['#ffffff', '#9ff0ff', '#2a8ae0'] }, {
  map: [['#c89058', '#e8f8ff'], ['#8a5a30', '#8ac8e8'], ['#4a2a14', '#3a6a9a'], ['#ffc92e', '#bff4ff'], ['#fff6b0', '#ffffff'], ['#c27a10', '#3a8ae0'], ['#e0a010', '#5ab0f0']],
  over(x) { // 얼음 왕관 + 어깨 결정
    const sp = [[-15, 9], [-8, 13], [0, 18], [8, 13], [15, 9]];
    for (const [sx, h] of sp) { poly(x, [sx - 3.6, -89, sx, -89 - h, sx + 3.6, -89]); fs(x, lin(x, sx, -89 - h, sx, -89, [[0, '#ffffff'], [0.5, '#bff4ff'], [1, '#5ab0f0']]), 1.6, '#1e4a8a'); }
    for (const [cx, cy, s] of [[-24, -50, -1], [22, -44, 1]]) for (const [dx, h, a] of [[-2, 9, -0.35], [2, 12, 0.1], [5, 7, 0.55]]) {
      x.save(); x.translate(cx + dx * s, cy); x.rotate(a * s); poly(x, [-2.2, 0, 0, -h, 2.2, 0]); x.restore();
      fs(x, lin(x, cx, cy - h, cx, cy, [[0, '#ffffff'], [1, '#7fd0ff']]), 1.3, '#1e4a8a');
    }
  },
  staff(x, ob) { // 결정 송이
    for (const [a, L] of [[-0.9, 13], [0.9, 13], [-0.35, 9], [0.35, 9]]) {
      x.save(); x.translate(Math.sin(a) * ob.r * 0.7, ob.y + ob.r * 0.5); x.rotate(a); poly(x, [-2.4, 0, 0, -L - ob.r, 2.4, 0]); x.restore();
      fs(x, lin(x, 0, ob.y - ob.r - L, 0, ob.y, [[0, '#ffffff'], [1, '#7fd0ff']]), 1.3, '#1e4a8a');
    }
  },
});
robe('rb_void', 'e', { robe: '#2e1650', trim: '#b86bff', trimD: '#5a1fa8', inner: '#1c1030', hat: '#1e0e36', lining: '#6a2ab0', hair: '#d8c8ff', iris: '#c86bff', orb: ['#f2c8ff', '#9a3dff', '#2a0a4a'] }, {
  map: [['#c89058', '#6a4a8a'], ['#8a5a30', '#3a2258'], ['#4a2a14', '#1a0e2a'], ['#ffc92e', '#b86bff'], ['#fff6b0', '#f2c8ff'], ['#c27a10', '#5a1fa8'], ['#e0a010', '#8a3dff']],
  over(x) { // 모자 양옆 뿔 + 모자의 눈
    horn(x, -23, -88, -40, -112, 7, '#8a5ad8', '#f2d8ff', 1);
    horn(x, 23, -88, 40, -112, 7, '#8a5ad8', '#f2d8ff', -1);
    x.beginPath(); x.moveTo(-1, -103); x.quadraticCurveTo(6, -110, 13, -103); x.quadraticCurveTo(6, -96, -1, -103); x.closePath();
    fs(x, '#fff0ff', 1.5, INK2);
    ell(x, 6, -103, 2.8, 3.4); x.fillStyle = '#b04dff'; x.fill();
    ell(x, 6, -103, 0.8, 2.6); x.fillStyle = INK2; x.fill();
  },
  staff(x, ob) { // 오브를 감싼 눈꺼풀 + 촉수
    for (const s of [-1, 1]) {
      x.beginPath(); x.moveTo(s * 3, ob.y + ob.r + 2);
      x.bezierCurveTo(s * (ob.r + 12), ob.y + ob.r, s * (ob.r + 10), ob.y - ob.r - 6, s * 4, ob.y - ob.r - 10);
      x.lineWidth = 5; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 2.6; x.strokeStyle = '#6a2ab0'; x.stroke();
    }
    x.beginPath(); x.moveTo(-ob.r * 0.9, ob.y); x.quadraticCurveTo(0, ob.y - ob.r * 0.95, ob.r * 0.9, ob.y); x.quadraticCurveTo(0, ob.y + ob.r * 0.95, -ob.r * 0.9, ob.y); x.closePath();
    x.lineWidth = 1.8; x.strokeStyle = INK2; x.stroke();
    ell(x, 0, ob.y, ob.r * 0.18, ob.r * 0.62); x.fillStyle = INK2; x.fill();
  },
});
robe('rb_celestial', 'l', { robe: '#18246a', trim: '#ffe07a', trimD: '#b8860a', inner: '#e8f0ff', hat: '#111a52', lining: '#4a6ae8', hair: '#f4f8ff', iris: '#8ab8ff', orb: ['#ffffff', '#bfe0ff', '#4a6ae8'] }, {
  glow: '#9fc8ff',
  map: [['#c89058', '#f0f2fa'], ['#8a5a30', '#aab4d8'], ['#4a2a14', '#4a5488']],
  over(x) { // 별자리 무늬 + 별 왕관
    const con = (pts) => {
      x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (const p of pts) x.lineTo(p[0], p[1]);
      x.lineWidth = 0.9; x.strokeStyle = 'rgba(255,224,122,0.8)'; x.stroke();
      for (const [px, py, r] of pts) { star4(x, px, py, r || 2.2); fs(x, '#fff4c0', 0.7, '#6a5a1a'); }
    };
    con([[-15, -38, 2.6], [-7, -29], [-11, -17, 1.8], [-2, -11, 2.4]]);
    con([[11, -40, 2], [17, -27, 2.6], [8, -19, 1.8]]);
    con([[-8, -99, 1.8], [2, -106, 2.4], [12, -101, 1.6]]);
    for (const [sx, h] of [[-12, 6], [0, 9], [12, 6]]) { star5(x, sx, -92 - h * 0.5, 3 + h * 0.25); fs(x, lin(x, 0, -100, 0, -88, [[0, '#fffbe0'], [1, '#ffc92e']]), 1.4, INK2); }
  },
  staff(x, ob) { // 혼천의 고리 두 줄 + 꼭대기 별
    const R = ob.r + 7;
    for (const rot of [0.55, -0.55]) for (const [w, c] of [[3.4, INK2], [1.6, '#ffe07a']]) { x.beginPath(); x.ellipse(0, ob.y, R, R * 0.34, rot, 0, TAU); x.lineWidth = w; x.strokeStyle = c; x.stroke(); }
    star4(x, 0, ob.y - ob.r - 10, 5, 0.32); fs(x, '#fffbe0', 1.4, INK2);
  },
  aura: auraCelestial,
});
robe('rb_dragon', 'l', { robe: '#8a1426', trim: '#ffb020', trimD: '#a65200', inner: '#2e0a0e', hat: '#5a0e1a', lining: '#ff6a1f', hair: '#ffe8d8', iris: '#ffb020', orb: ['#fff2a0', '#ff6a1f', '#b3230f'] }, {
  glow: '#ff6a1f',
  map: [['#c89058', '#5a2a24'], ['#8a5a30', '#3a1414'], ['#4a2a14', '#1e0808']],
  over(x) { // 뒤로 휜 용뿔 + 비늘 어깨 + 용의 눈 보석
    horn(x, -21, -90, -44, -113, 7.5, '#f4e0c0', '#6a2a1a', 1);
    horn(x, 21, -90, 44, -113, 7.5, '#f4e0c0', '#6a2a1a', -1);
    for (const [cx, cy, s] of [[-22, -50, -1], [20, -44, 1]]) for (let k = 0; k < 3; k++) {
      x.beginPath(); x.arc(cx + s * k * 3, cy + k * 3.4, 6.2 - k, Math.PI * 0.05, Math.PI * 0.95);
      x.closePath(); fs(x, cel(x, cx - 7, cy - 2, cx + 7, cy + 10, '#b01e2a'), 1.5, INK2);
      x.beginPath(); x.arc(cx + s * k * 3, cy + k * 3.4, 6.2 - k, Math.PI * 0.12, Math.PI * 0.88); x.lineWidth = 1; x.strokeStyle = '#ffb020'; x.stroke();
    }
    ell(x, 0, -93, 4.2, 3); fs(x, rad(x, 0, -93, 0, 4.2, [[0, '#fff2a0'], [0.6, '#ffb020'], [1, '#c24a00']]), 1.4, INK2);
    ell(x, 0, -93, 0.9, 2.4); x.fillStyle = INK2; x.fill();
  },
  staff(x, ob) { // 오브를 문 용 두개골 뿔
    for (const s of [-1, 1]) horn(x, s * 4, ob.y + ob.r + 3, s * (ob.r + 6), ob.y - ob.r - 8, 5, '#f4e0c0', '#8a3a1a', s);
    x.beginPath(); x.moveTo(-7, ob.y + ob.r + 1); x.quadraticCurveTo(0, ob.y + ob.r + 13, 7, ob.y + ob.r + 1); x.quadraticCurveTo(0, ob.y + ob.r + 5, -7, ob.y + ob.r + 1); x.closePath();
    fs(x, '#f4e0c0', 1.6, INK2);
    for (const s of [-1, 1]) { circ(x, s * 2.6, ob.y + ob.r + 5, 1.2); x.fillStyle = '#ff6a1f'; x.fill(); }
  },
  aura: auraDragon,
});

// 마법 이펙트 스킨 — [코어, 메인, 에지] + 램프(밝기 → 색) + 입자 + 탄 머리 모양
const skin = (id, r, core, main, edge, ramp, mote, head, o = {}) => def(id, { kind: 'skin', r, core, main, edge, ramp, mote, headK: head, ...o });
skin('sk_jade', 'c', '#eafff0', '#3fe08a', '#0e7a4a', ['#0a4a30', '#1faa6a', '#6ff0a8', '#effff4'], 'glint', 'orb');
skin('sk_sunset', 'c', '#fff0c8', '#ff7a6a', '#8a2a7a', ['#4a1a5a', '#c83a6a', '#ff9a5a', '#fff0c8'], 'glint', 'orb');
skin('sk_gold', 'r', '#fffbe0', '#ffc92e', '#a65200', ['#6b3300', '#e08a00', '#ffcf3a', '#fff8d0'], 'coin', 'orb');
skin('sk_sakura', 'r', '#fff4f8', '#ff8ab8', '#c02a6a', ['#6a1a4a', '#e0508a', '#ffa8cc', '#fff4f8'], 'petal', 'petal');
skin('sk_crystal', 'e', '#ffffff', '#9ff0ff', '#3a7ae0', ['#1a3a8a', '#3a9ae8', '#a8f0ff', '#ffffff'], 'hex', 'shard');
skin('sk_neon', 'e', '#ffffff', '#ff3ad8', '#2af0ff', ['#4a0a6a', '#ff2ad0', '#3af0ff', '#f4ffff'], 'ring', 'neon');
skin('sk_abyss', 'l', '#f2c8ff', '#9a3dff', '#1a0630', ['#12041e', '#5a1ab0', '#b066ff', '#f2d8ff'], 'wisp', 'void', { sigil: 'eye' });
skin('sk_star', 'l', '#ffffff', '#bfd8ff', '#6a4ae8', ['#1a1a5a', '#6a6ae8', '#bfd8ff', '#ffffff'], 'star', 'star', { sigil: 'star' });
for (const id in ART) { const a = ART[id]; if (a.kind === 'skin') { a.map = rampMap(a.ramp); a.head = v => skinHead(a, v); a.trail = (x, y, vx, vy) => trailMote(a, x, y, vx, vy); } }

// 카탈로그 확인용 목록(종류별 id)
export const ART_IDS = Object.freeze({
  costume: Object.keys(ART).filter(k => ART[k].kind === 'costume'),
  robe: Object.keys(ART).filter(k => ART[k].kind === 'robe'),
  skin: Object.keys(ART).filter(k => ART[k].kind === 'skin'),
});
// 기본 외형(옷장 '기본 외형' 칸) — 미리보기 전용 id. 코스튬·로브는 id: null(= 기본 그림), 스킨은 기본 화염구 색. 장착·전장엔 안 쓰인다
const BASE = { rb_base: { id: null, kind: 'robe', r: 'c', pal: MAGE_PAL_DEF } };
for (const [p, cls] of [['kn', 'knight'], ['rg', 'ranger'], ['so', 'sorcerer'], ['cl', 'cleric'], ['as', 'assassin']]) BASE[p + '_base'] = { id: null, kind: 'costume', cls, r: 'c' };
BASE.sk_base = { id: 'sk_base', kind: 'skin', r: 'c', core: '#ffd23a', main: '#ff7a1e', edge: '#b3230f', ramp: ['#5a1a0a', '#c8400f', '#ff8a2a', '#fff2c0'], mote: 'glint', headK: 'orb' };
BASE.sk_base.head = v => skinHead(BASE.sk_base, v);

// ═════════════ 빛·장식 스프라이트 (고정 해상도로 한 번 굽기) ═════════════
const RES = 3;
const gRes = (key, hw, hh, f) => bake('cz:' + key, hw, hh, f, RES);
const glowS = col => gRes('g|' + col, 16, 16, x => { circ(x, 0, 0, 16); x.fillStyle = rad(x, 0, 0, 0, 16, [[0, col], [0.4, col + '88'], [1, col + '00']]); x.fill(); });
const starS = col => gRes('s|' + col, 12, 12, x => {
  x.fillStyle = rad(x, 0, 0, 0, 12, [[0, col + 'aa'], [1, col + '00']]); circ(x, 0, 0, 12); x.fill();
  star4(x, 0, 0, 11, 0.16); x.fillStyle = '#ffffff'; x.fill();
});
const sunS = () => gRes('sun', 64, 64, x => {
  for (let k = 0; k < 16; k++) {
    const a = k * TAU / 16, L = k % 2 ? 44 : 62;
    x.save(); x.rotate(a);
    poly(x, [-5, 0, 0, -L, 5, 0]); x.fillStyle = lin(x, 0, 0, 0, -L, [[0, '#ffd23aaa'], [1, '#ffd23a00']]); x.fill();
    x.restore();
  }
  circ(x, 0, 0, 26); x.fillStyle = rad(x, 0, 0, 0, 26, [[0, '#ffe98a66'], [1, '#ffd23a00']]); x.fill();
});
const leafS = col => gRes('lf|' + col, 8, 8, x => { leafP(x, -7, 0, 14, 4.2, 0); fs(x, lin(x, -7, 0, 7, 0, [[0, dim(col, 0.2)], [1, lite(col, 0.35)]]), 1.2, INK2); x.beginPath(); x.moveTo(-6, 0); x.lineTo(5, 0); x.lineWidth = 0.8; x.strokeStyle = dim(col, 0.45); x.stroke(); });
const featherS = () => gRes('fe', 10, 10, x => { leafP(x, -9, 0, 18, 4.4, 0); fs(x, lin(x, -9, 0, 9, 0, [[0, '#e8eef8'], [0.7, '#ffffff'], [1, '#fff3c0']]), 1.2, INK2); x.beginPath(); x.moveTo(-9, 0); x.lineTo(7, 0); x.lineWidth = 0.7; x.strokeStyle = '#c8d0e0'; x.stroke(); });
const wingS = (key, c0, c1, c2) => gRes('w|' + key, 44, 40, x => { // 빛 날개 한쪽(뿌리 = 오른쪽 아래, 왼쪽 위로 펼침) — 가산
  for (let k = 0; k < 7; k++) { // 긴 깃(위) → 짧은 깃(옆), 깃마다 끝이 옅어짐
    const a = -Math.PI * 0.5 - k * 0.19, L = 58 - k * 4.5;
    leafP(x, 34, 30, L, 11 - k * 0.6, a);
    x.fillStyle = lin(x, 34, 30, 34 + Math.cos(a) * L, 30 + Math.sin(a) * L, [[0, c0], [0.55, c1], [1, c2]]); x.fill();
  }
});
const flameWingS = () => wingS('fire', '#ffe45aff', '#ff8a1ee0', '#e0280f30');
const moonS = () => gRes('moon', 30, 30, x => {
  x.fillStyle = rad(x, 0, 0, 0, 30, [[0, '#bfe0ff55'], [1, '#bfe0ff00']]); circ(x, 0, 0, 30); x.fill();
  x.beginPath(); x.arc(0, 0, 20, 0, TAU); x.arc(7, -5, 17, 0, TAU, true);
  x.fillStyle = lin(x, -20, -20, 20, 20, [[0, '#ffffff'], [1, '#9fc8ff']]); x.fill('evenodd');
});
const wispS = col => gRes('ws|' + col, 12, 12, x => { circ(x, 0, 0, 12); x.fillStyle = rad(x, 0, 0, 0, 12, [[0, col + 'cc'], [0.6, col + '66'], [1, col + '00']]); x.fill(); });
const planetS = (col, ringed) => gRes('pl|' + col + ringed, 12, 12, x => {
  if (ringed) { x.beginPath(); x.ellipse(0, 0, 11, 3.2, -0.35, Math.PI, TAU); x.lineWidth = 1.6; x.strokeStyle = '#ffe07a'; x.stroke(); }
  circ(x, 0, 0, 6.2); fs(x, rad(x, 0, 0, 0, 6.2, [[0, lite(col, 0.5)], [0.6, col], [1, dim(col, 0.35)]], -2, -2.4), 1.3, INK2);
  if (ringed) { x.beginPath(); x.ellipse(0, 0, 11, 3.2, -0.35, 0, Math.PI); x.lineWidth = 1.6; x.strokeStyle = '#ffe07a'; x.stroke(); }
});

// ═════════════ 전설 오라 · 대기 동작 ═════════════
// c = 그릴 컨텍스트(변환 = 발 원점 · 몸 단위, +x = 바라보는 쪽), pass 0 = 몸 뒤 · 1 = 몸 앞, t = 초, body = 몸 스프라이트(잔상용)
// 입자는 상태 없이 시간 함수로(같은 식이 전장·미리보기 모두) — 풀·할당 없음
const ADD = (c, on) => { c.globalCompositeOperation = on ? 'lighter' : 'source-over'; };
const img = (c, s, x, y, w, h, a = 1) => { c.globalAlpha = a; c.drawImage(s, x - w / 2, y - h / 2, w, h); };
const fr = v => v - Math.floor(v);
function rising(c, t, n, spd, x0, w, y0, h, sprite, sz, a = 0.9) {
  for (let k = 0; k < n; k++) {
    const ph = fr(t * spd + k / n), x = x0 + Math.sin(k * 2.39 + t * 1.3) * w, y = y0 - ph * h;
    img(c, sprite, x, y, sz, sz, Math.sin(ph * Math.PI) * a);
  }
}
function auraSolar(c, pass, t) {
  ADD(c, true);
  if (!pass) {
    for (const s of [-1, 1]) { // 빛의 날개
      c.save(); c.translate(-2, -42); c.scale(s, 1 + 0.06 * Math.sin(t * 2.6)); c.globalAlpha = 0.6; c.drawImage(wingS('lw', '#ffffffee', '#ffe07acc', '#ffb02030'), -80, -70, 88, 80); c.restore();
    }
    c.save(); c.translate(1, -64); c.rotate(t * 0.25);
    img(c, sunS(), 0, 0, 132, 132, 0.34 + 0.08 * Math.sin(t * 2));
    c.restore();
    img(c, glowS('#ffd23a'), 0, -8, 110, 30, 0.35);
  } else {
    rising(c, t, 4, 0.45, 0, 24, -18, 96, starS('#ffd23a'), 8);
    const g = fr(t / 3) * 3 / 0.4; // 3초마다 투구 문장에서 반짝
    if (g < 1) { const s = Math.sin(g * Math.PI); img(c, starS('#fff3a8'), 1, -84, 34 * s, 34 * s, s); }
  }
  ADD(c, false); c.globalAlpha = 1;
}
function auraSylvan(c, pass, t) {
  if (!pass) { ADD(c, true); img(c, glowS('#8dff6a'), 0, -6, 104, 30, 0.38); ADD(c, false); }
  for (let k = 0; k < 5; k++) { // 몸을 도는 잎 다섯(뒤 반 → 앞 반)
    const a = t * 1.1 + k * TAU / 5, s = Math.sin(a);
    if ((s >= 0) !== !!pass) continue;
    const x = Math.cos(a) * 36, y = -48 + s * 10 + Math.sin(t * 2 + k) * 3;
    c.save(); c.translate(x, y); c.rotate(a * 1.5 + k); c.globalAlpha = 0.95; c.drawImage(leafS(k % 2 ? '#7ae05a' : '#c8f06a'), -6, -6, 12, 12); c.restore();
  }
  if (pass) { ADD(c, true); rising(c, t, 4, 0.35, 0, 30, -4, 80, starS('#c8ff8a'), 7, 0.8); ADD(c, false); }
  c.globalAlpha = 1;
}
function auraPhoenix(c, pass, t) {
  if (pass) { ADD(c, true); rising(c, t, 6, 0.6, -4, 20, -30, 90, glowS('#ff8a1e'), 9); ADD(c, false); c.globalAlpha = 1; return; }
  ADD(c, true);
  const flare = fr(t / 3.2) < 0.18 ? 0.25 : 0, f = 1 + 0.08 * Math.sin(t * 3.2), w = flameWingS();
  for (const s of [-1, 1]) {
    c.save(); c.translate(-2, -46); c.scale(s, f); c.rotate(-0.1 * Math.sin(t * 3.2));
    c.globalAlpha = 0.72 + flare; c.drawImage(w, -80, -70, 88, 80);
    c.restore();
  }
  img(c, glowS('#ff6a1f'), 0, -50, 120, 130, 0.18);
  ADD(c, false); c.globalAlpha = 1;
}
function auraSeraph(c, pass, t) {
  if (!pass) {
    ADD(c, true);
    img(c, glowS('#fff0a8'), 0, -60, 90, 150, 0.22 + 0.06 * Math.sin(t * 2));
    c.globalAlpha = 0.55; c.lineWidth = 2; c.strokeStyle = '#ffe07a';
    c.beginPath(); c.ellipse(2, -92, 25, 7, 0, 0, TAU); c.stroke();
    for (let k = 0; k < 3; k++) { const a = t * 1.6 + k * TAU / 3; img(c, starS('#fff3a8'), 2 + Math.cos(a) * 25, -92 + Math.sin(a) * 7, 9, 9, 0.9); }
    ADD(c, false);
  } else {
    for (let k = 0; k < 3; k++) { // 떨어지는 깃털(좌우로 흔들림)
      const ph = fr(t * 0.22 + k / 3), x = -26 + k * 22 + Math.sin(t * 1.7 + k * 2) * 12, y = -110 + ph * 110;
      c.save(); c.translate(x, y); c.rotate(Math.sin(t * 1.7 + k * 2) * 0.8 + 0.4); c.globalAlpha = Math.sin(ph * Math.PI) * 0.9; c.drawImage(featherS(), -8, -8, 16, 16); c.restore();
    }
  }
  c.globalAlpha = 1;
}
function auraMoon(c, pass, t, body) {
  if (!pass) {
    ADD(c, true); img(c, moonS(), -6, -74, 78, 78, 0.5 + 0.08 * Math.sin(t * 1.4)); ADD(c, false);
    for (let k = 0; k < 4; k++) { const ph = fr(t * 0.4 + k / 4); img(c, wispS('#3a2a6a'), Math.sin(k * 2.2 + t) * 20, -4 - ph * 60, 26 + ph * 20, 26 + ph * 20, Math.sin(ph * Math.PI) * 0.35); }
  } else if (body) { // 2.6초마다 푸른 잔상이 뒤로 흩어짐
    const g = fr(t / 2.6) * 2.6 / 0.55;
    if (g < 1) {
      const s = tintOf(body, '#9fdcff');
      c.globalAlpha = 0.4 * (1 - g); ADD(c, true);
      c.drawImage(s, -s.hw - 10 - 22 * g, -s.hh - (s.oy || 0), s.hw * 2, s.hh * 2);
      ADD(c, false);
    }
  }
  c.globalAlpha = 1;
}
function auraCelestial(c, pass, t) {
  const P = [['#ffcf6a', 1], ['#8ab8ff', 0], ['#ff8ab8', 0]];
  if (!pass) {
    ADD(c, true); img(c, glowS('#4a6ae8'), 0, -60, 150, 160, 0.2);
    for (let k = 0; k < 6; k++) { const tw = 0.5 + 0.5 * Math.sin(t * 3 + k * 1.9), a = k * 1.1; img(c, starS('#bfe0ff'), Math.cos(a * 2.3) * 62, -30 - k * 17, 10 * tw + 3, 10 * tw + 3, tw); }
    ADD(c, false);
  }
  for (let k = 0; k < 3; k++) { // 공전하는 행성 셋
    const a = t * (0.9 + k * 0.25) + k * TAU / 3, s = Math.sin(a);
    if ((s >= 0) !== !!pass) continue;
    const sz = 14 + s * 3;
    img(c, planetS(P[k][0], P[k][1]), Math.cos(a) * 60, -62 + s * 15, sz * (P[k][1] ? 1.8 : 1), sz * (P[k][1] ? 1.8 : 1), 1);
  }
  if (pass) { // 3.5초마다 별똥별
    const g = fr(t / 3.5) * 3.5 / 0.6;
    if (g < 1) {
      ADD(c, true);
      const x = -70 + g * 120, y = -150 + g * 44;
      c.save(); c.translate(x, y); c.rotate(0.35); c.globalAlpha = Math.sin(g * Math.PI);
      c.drawImage(glowS('#bfe0ff'), -30, -3, 36, 6); c.drawImage(starS('#ffffff'), -6, -6, 12, 12); c.restore();
      ADD(c, false);
    }
  }
  c.globalAlpha = 1;
}
function auraDragon(c, pass, t) {
  ADD(c, true);
  if (!pass) { // 등 뒤 불꽃 날개 + 열기
    img(c, glowS('#ff4a1a'), 0, -56, 150, 170, 0.2 + 0.06 * Math.sin(t * 2.5));
    const w = flameWingS(), f = 1 + 0.07 * Math.sin(t * 2.4);
    for (const s of [-1, 1]) { c.save(); c.translate(0, -56); c.scale(s * 1.2, f * 1.15); c.globalAlpha = 0.6; c.drawImage(w, -80, -70, 88, 80); c.restore(); }
  }
  else {
    rising(c, t, 7, 0.55, 0, 34, -10, 110, glowS('#ff8a1e'), 8);
    const g = fr(t / 3) * 3 / 0.35;
    if (g < 1) { const s = Math.sin(g * Math.PI); img(c, starS('#ffb020'), 0, -93, 30 * s, 30 * s, s); }
  }
  ADD(c, false); c.globalAlpha = 1;
}

// ═════════════ 전장 훅 (units.js) ═════════════
// 영웅 발(x, y) · face(±, 뒤집힘 포함) · s = 필드 배율. pass 0 = 몸 뒤, 1 = 몸 앞
export function heroAura(pass, cls, x, y, face, s, body) {
  const a = heroCos(cls);
  if (!a || !a.aura) return;
  place(x, y, 0, face * s, s);
  a.aura(ctx, pass, RT, body);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  wt();
}
// 성벽 위 내 마법사(0번)만
export function mageAura(pass, x, y, sx, s) {
  const a = robeCos();
  if (!a || !a.aura) return;
  place(x, y, 0, sx, s);
  a.aura(ctx, pass, RT);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  wt();
}

// ═════════════ 스킨: 탄 머리 · 입자 ═════════════
// 탄 머리(+x 방향, fx.fireHead 와 같은 크기 36×16) — v = 0/1 두 프레임(깜빡임)
function tongue(x, v, s, col, rim) {
  x.save(); x.translate(5, 0); x.scale(s, s);
  x.beginPath(); x.moveTo(11, 0); x.bezierCurveTo(11, -9, 2, -12, -6, -10);
  x.quadraticCurveTo(-16, -9, v ? -36 : -32, v ? -9 : -6); x.quadraticCurveTo(-20, -3, v ? -28 : -33, 2);
  x.quadraticCurveTo(-18, 4, v ? -30 : -25, 11); x.quadraticCurveTo(-10, 12, -4, 10); x.bezierCurveTo(4, 11, 11, 8, 11, 0);
  x.closePath(); x.fillStyle = col; x.fill();
  if (rim) { x.lineWidth = 1.6 / s; x.strokeStyle = rim; x.stroke(); }
  x.restore();
}
function skinHead(a, v) {
  return bake('cz:h|' + a.id + v, 36, 16, x => {
    const m = a.main, e = a.edge, c0 = a.core;
    switch (a.headK) {
      case 'petal': // 꽃잎 불꽃 + 벚꽃 머리
        tongue(x, v, 1, mix(e, m, 0.4), dim(e, 0.4)); tongue(x, v, 0.75, m); tongue(x, v, 0.5, lite(m, 0.5));
        flower(x, 8, 0, 8.5, '#ffd8e8', '#ff5a8a', v ? 0.6 : 0);
        break;
      case 'shard': // 얼음 결정 창
        for (const sd of [-1, 1]) { poly(x, [-4, sd * 3, -14, sd * 9, -9, sd * 2]); fs(x, lite(m, 0.6), 1.3, dim(e, 0.3)); }
        poly(x, [20, 0, 8, -7, -12, -4.5, -20, 0, -12, 4.5, 8, 7]);
        fs(x, lin(x, 0, -7, 0, 7, [[0, '#ffffff'], [0.45, lite(m, 0.4)], [0.5, m], [1, e]]), 2, dim(e, 0.3));
        x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 1.1; x.beginPath(); x.moveTo(18, 0); x.lineTo(-15, 0); x.moveTo(8, -6); x.lineTo(3, 0); x.lineTo(8, 6); x.stroke();
        if (v) { star4(x, 12, -6, 5, 0.25); x.fillStyle = '#ffffff'; x.fill(); }
        break;
      case 'neon': // 네온 캡슐: 어두운 심 + 두 색 테
        rrect(x, -22, -6.5, 36, 13, 6.5); x.fillStyle = e + '55'; x.fill();
        rrect(x, -8, -6, 24, 12, 6); fs(x, '#1a0a2e', 3.2, v ? m : e);
        rrect(x, -5, -3, 18, 6, 3); x.lineWidth = 1.6; x.strokeStyle = '#ffffff'; x.stroke();
        x.beginPath(); x.moveTo(-10, -8); x.lineTo(-28, -8); x.moveTo(-10, 8); x.lineTo(-24, 8); x.lineWidth = 2; x.strokeStyle = v ? e : m; x.stroke();
        break;
      case 'void': // 검은 핵 + 보랏빛 코로나
        tongue(x, v, 1, '#2a0a4a', m); tongue(x, v, 0.72, dim(m, 0.35));
        circ(x, 8, 0, 7); fs(x, rad(x, 8, 0, 0, 7, [[0, '#000000'], [0.7, '#1a0630'], [1, m]]), 1.6, lite(m, 0.4));
        circ(x, 10, -2.5, 1.4); x.fillStyle = c0; x.fill();
        break;
      case 'star': // 네 갈래 별 + 라벤더 꼬리
        tongue(x, v, 0.9, e + 'cc'); tongue(x, v, 0.62, m);
        star4(x, 8, 0, v ? 12 : 10.5, 0.3); fs(x, lin(x, 8, -12, 8, 12, [[0, '#ffffff'], [1, m]]), 1.6, dim(e, 0.3));
        circ(x, 8, 0, 2.6); x.fillStyle = '#ffffff'; x.fill();
        break;
      default: // 구슬 불꽃(팔레트)
        tongue(x, v, 1, dim(e, 0.05), dim(e, 0.45)); tongue(x, v, 0.8, m); tongue(x, v, 0.58, lite(m, 0.45));
        circ(x, 8, 0, 6.2); x.fillStyle = c0; x.fill();
        circ(x, 8.5, -0.5, 3.6); x.fillStyle = '#ffffff'; x.fill();
        if (a.mote === 'coin' && v) { star4(x, 3, -6, 4.5, 0.25); x.fillStyle = '#ffffff'; x.fill(); }
    }
  }, 2);
}
// 입자 스프라이트(스킨별 한 장). add = 가산으로 그림
function moteSpr(a) {
  return bake('cz:m|' + a.id, 8, 8, x => {
    const m = a.main, e = a.edge;
    switch (a.mote) {
      case 'petal': x.beginPath(); x.moveTo(0, -7); x.bezierCurveTo(6, -4, 5, 4, 0, 7); x.bezierCurveTo(-2, 4, -2, 2, 0, 1); x.bezierCurveTo(-2, -1, -5, -4, 0, -7); x.closePath(); fs(x, lin(x, 0, -7, 0, 7, [[0, '#ffe8f2'], [1, m]]), 1.1, dim(e, 0.2)); break;
      case 'coin': poly(x, [0, -7, 4.4, 0, 0, 7, -4.4, 0]); fs(x, lin(x, -4, -7, 4, 7, [[0, '#fff8d0'], [0.5, m], [1, e]]), 1.1, dim(e, 0.4)); star4(x, -1, -2, 3, 0.25); x.fillStyle = '#ffffff'; x.fill(); break;
      case 'hex': poly(x, [0, -7, 6, -3.5, 6, 3.5, 0, 7, -6, 3.5, -6, -3.5]); fs(x, lin(x, 0, -7, 0, 7, [[0, '#ffffff'], [1, m]]), 1.2, dim(e, 0.2)); x.beginPath(); x.moveTo(0, -5); x.lineTo(0, 5); x.moveTo(-4.3, -2.5); x.lineTo(4.3, 2.5); x.moveTo(4.3, -2.5); x.lineTo(-4.3, 2.5); x.lineWidth = 0.8; x.strokeStyle = '#ffffff'; x.stroke(); break;
      case 'ring': circ(x, 0, 0, 5.2); x.lineWidth = 2.2; x.strokeStyle = m; x.stroke(); circ(x, 0, 0, 5.2); x.lineWidth = 0.9; x.strokeStyle = '#ffffff'; x.stroke(); break;
      case 'wisp': circ(x, 0, 0, 7.5); x.fillStyle = rad(x, 0, 0, 0, 7.5, [[0, '#1a0630'], [0.55, '#3a0a6acc'], [0.8, m + 'aa'], [1, m + '00']]); x.fill(); break;
      case 'star': x.fillStyle = rad(x, 0, 0, 0, 8, [[0, m + 'aa'], [1, m + '00']]); circ(x, 0, 0, 8); x.fill(); star4(x, 0, 0, 7.5, 0.2); x.fillStyle = '#ffffff'; x.fill(); break;
      default: x.fillStyle = rad(x, 0, 0, 0, 8, [[0, m + 'cc'], [1, m + '00']]); circ(x, 0, 0, 8); x.fill(); poly(x, [0, -5, 1.4, 0, 0, 5, -1.4, 0]); x.fillStyle = '#ffffff'; x.fill();
    }
  }, 2);
}
const MOTE_ADD = { ring: 1, star: 1, glint: 1 };
// 전설 스킨의 스킬 문장(심연의 눈 · 별자리 고리) — 일반 합성, 짧게 떴다 사라짐
function sigilSpr(a) {
  return bake('cz:sg|' + a.id, 34, 34, x => {
    if (a.sigil === 'eye') {
      for (let k = 0; k < 8; k++) { const r = k * TAU / 8; x.beginPath(); x.moveTo(Math.cos(r) * 20, Math.sin(r) * 20); x.quadraticCurveTo(Math.cos(r + 0.4) * 28, Math.sin(r + 0.4) * 28, Math.cos(r + 0.2) * 33, Math.sin(r + 0.2) * 33); x.lineWidth = 2.4; x.strokeStyle = '#6a2ab0cc'; x.stroke(); }
      x.beginPath(); x.moveTo(-22, 0); x.quadraticCurveTo(0, -17, 22, 0); x.quadraticCurveTo(0, 17, -22, 0); x.closePath();
      fs(x, '#1a0630e6', 2.4, '#b066ff');
      circ(x, 0, 0, 8); fs(x, rad(x, 0, 0, 0, 8, [[0, '#f2d8ff'], [0.5, '#b066ff'], [1, '#5a1ab0']]), 1.2, '#12041e');
      ell(x, 0, 0, 1.8, 6.5); x.fillStyle = '#12041e'; x.fill();
    } else {
      const pts = [];
      for (let k = 0; k < 7; k++) { const r = k * TAU / 7 - Math.PI / 2, q = k % 2 ? 20 : 28; pts.push([Math.cos(r) * q, Math.sin(r) * q]); }
      x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); x.closePath();
      x.lineWidth = 1.4; x.strokeStyle = '#bfd8ffcc'; x.stroke();
      circ(x, 0, 0, 31); x.lineWidth = 1; x.strokeStyle = '#8a8affaa'; x.stroke();
      for (const [px, py] of pts) { star4(x, px, py, 4.5, 0.25); x.fillStyle = '#ffffff'; x.fill(); }
    }
  }, 2);
}

// 스킨 입자 풀(내 스킬·탄에서만 생김). 위치는 월드 좌표
const MOTES = Array.from({ length: 96 }, () => ({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, g: 0, size: 8, rot: 0, vr: 0, a: null }));
let mi = 0;
function mote(a, x, y, vx, vy, life, size, g = 0) {
  const p = MOTES[mi]; mi = (mi + 1) % MOTES.length;
  p.a = a; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.size = size; p.g = g; p.rot = rnd() * TAU; p.vr = (rnd() - 0.5) * 8;
}
const SIGILS = Array.from({ length: 6 }, () => ({ life: 0, max: 1, x: 0, y: 0, a: null, s: 1 }));
let si = 0;
function spray(a, x, y, n, sp0, sp1, life, size) {
  const fall = a.mote === 'petal' ? 60 : a.mote === 'wisp' ? -50 : a.mote === 'hex' || a.mote === 'coin' ? 260 : 0;
  for (let k = 0; k < n; k++) { const r = rnd() * TAU, v = sp0 + rnd() * (sp1 - sp0); mote(a, x, y, Math.cos(r) * v, Math.sin(r) * v - v * 0.3, life * (0.7 + rnd() * 0.6), size * (0.7 + rnd() * 0.6), fall); }
}
function trailMote(a, x, y, vx, vy) { mote(a, x - vx * 0.016 + (rnd() - 0.5) * 6, y - vy * 0.016 + (rnd() - 0.5) * 6, (rnd() - 0.5) * 40, (rnd() - 0.5) * 40 - 10, 0.35, 7, a.mote === 'petal' ? 40 : 0); }
function sigil(a, x, y, s) {
  if (!a.sigil) return;
  const q = SIGILS[si]; si = (si + 1) % SIGILS.length;
  q.a = a; q.x = x; q.y = y; q.s = s; q.life = q.max = 0.7;
}
// 내 것만(o 0): 탄 명중·스킬·시전·연쇄·파편·빙결. 적 폭발(bomber·shock·breath)·영웅(o 2·3)은 제외
const MINE = { hit: 1, spell: 1, cast: 1, chain: 1, shards: 1, shatter: 1, skill: 1, boom: 1 };
const BOOM_OK = { fireball: 1, meteor: 1, steam: 1, crit: 1 };
const mine = ev => !!MINE[ev.type] && (ev.o | 0) === 0 && (ev.type !== 'boom' || !!BOOM_OK[ev.kind]);
// fx.js 가 이벤트 하나를 처리하는 동안 part/ring 색을 통과시키는 함수(내 스킬이 아니면 null)
// 기본 탄(명중 o0 · 화염구 탄 폭발 · 시전)은 스킨 램프 그대로, 스킬(주문·연쇄·파편·메테오…)은 원소 색 65% + 스킨 35%로만 물들인다
// — 불은 여전히 불, 얼음은 얼음으로 읽혀야 약점/내성 원소를 알아본다(v0.1.2 FIX)
const BASIC_EV = ev => ev.type === 'hit' || ev.type === 'cast' || (ev.type === 'boom' && ev.kind === 'fireball' && ev.o != null);
function softMap(a) {
  if (a._soft) return a._soft;
  const memo = new Map();
  return (a._soft = c => {
    if (typeof c !== 'string' || c[0] !== '#' || (c.length !== 7 && c.length !== 9)) return c;
    let r = memo.get(c);
    if (r === undefined) { r = mix(c.slice(0, 7), a.map(c).slice(0, 7), 0.35) + c.slice(7); memo.set(c, r); }
    return r;
  });
}
export const skinMap = ev => (SKIN && ev && mine(ev) ? (BASIC_EV(ev) ? SKIN.map : softMap(SKIN)) : null);
export function events(view, evs) {
  const a = SKIN;
  if (!a || !evs.length) return;
  let hits = 0, big = 0;
  for (const ev of evs) {
    if (!mine(ev)) continue;
    const x = +ev.x || 0, y = +ev.y || 0;
    switch (ev.type) {
      case 'hit': if (hits++ < 3 && rnd() < 0.5) spray(a, x, y, 1, 60, 160, 0.5, 8); break;
      case 'spell': {
        const yy = ev.y == null ? 560 : y;
        if (big++ < 3) { spray(a, x, yy, 8, 90, 260, 0.8, 10); if (big < 3) sigil(a, x, yy, (+ev.r || 90) / 70); }
        break;
      }
      case 'cast': if (!ev.basic) spray(a, MF[0].ox, MF[0].oy, 6, 60, 180, 0.6, 9); break;
      case 'chain': if (Array.isArray(ev.pts)) for (let k = 0; k < ev.pts.length && k < 5; k++) spray(a, ev.pts[k][0], ev.pts[k][1], 2, 40, 140, 0.5, 8); break;
      case 'boom': case 'shards': case 'shatter': if (big++ < 4) spray(a, x, y, 4, 80, 220, 0.6, 9); break;
      case 'skill': spray(a, MF[0].ox, MF[0].oy, 10, 80, 300, 0.9, 11); break;
    }
  }
}
let lastT = 0;
export function draw() {
  const da = Math.max(0, Math.min(0.1, T - lastT));
  lastT = T;
  let any = false;
  for (const p of MOTES) {
    if (p.life <= 0) continue;
    p.life -= da;
    if (p.life <= 0) continue;
    any = true;
    p.vy += p.g * da; p.vx *= 1 - 1.6 * da; p.vy *= 1 - 0.8 * da;
    p.x += p.vx * da; p.y += p.vy * da; p.rot += p.vr * da;
    const u = p.life / p.max, s = p.size * (p.a.mote === 'wisp' ? 1.6 - u * 0.6 : 0.6 + 0.4 * u);
    ADD(ctx, !!MOTE_ADD[p.a.mote]);
    ctx.globalAlpha = Math.min(1, u * 2.2) * (p.a.mote === 'wisp' ? 0.75 : 1);
    place(p.x, p.y, p.rot, s / 8, s / 8);
    ctx.drawImage(moteSpr(p.a), -8, -8, 16, 16);
  }
  for (const q of SIGILS) {
    if (q.life <= 0) continue;
    q.life -= da;
    if (q.life <= 0) continue;
    any = true;
    const u = 1 - q.life / q.max, s = q.s * (0.6 + 0.5 * Math.min(1, u * 3));
    ADD(ctx, false);
    ctx.globalAlpha = Math.min(1, (1 - u) * 2.5) * 0.9;
    place(q.x, q.y, q.a.sigil === 'star' ? u * 1.2 : 0, s, s * (q.a.sigil === 'eye' ? Math.min(1, u * 5) : 1));
    ctx.drawImage(sigilSpr(q.a), -34, -34, 68, 68);
  }
  if (any) { ctx.globalAlpha = 1; ADD(ctx, false); wt(); }
}

// ═════════════ 미리보기 (옷장 · 제단 · 도감) ═════════════
const IDLE_W = { knight: 0.45, cleric: 0.45, assassin: 1.7, ranger: 0.12, sorcerer: 0.15 };
const LEG_DEF = { cleric: '#c8b888', assassin: '#1e1a2e' };
const drawO = (x, s) => x.drawImage(s, -s.hw, -s.hh - (s.oy || 0), s.hw * 2, s.hh * 2);
// 바닥 원판: 등급색 빛 + 가는 고리
function floor(x, k, cx, fy, col, w) {
  x.setTransform(k, 0, 0, k, cx, fy);
  ADD(x, true);
  img(x, glowS(col), 0, 0, w * 1.5, w * 0.42, 0.55);
  ADD(x, false);
  x.globalAlpha = 0.5; x.lineWidth = 1.6; x.strokeStyle = col;
  x.beginPath(); x.ellipse(0, 0, w * 0.52, w * 0.13, 0, 0, TAU); x.stroke();
  x.globalAlpha = 0.35; x.fillStyle = '#22163a'; x.beginPath(); x.ellipse(0, 0, w * 0.34, w * 0.09, 0, 0, TAU); x.fill();
  x.globalAlpha = 1;
}
function previewCostume(x, a, t, W, H, o) {
  const cls = a.cls, tier = o.tier ?? 2, k = Math.min(H / 138, W / 118), cx = W / 2, fy = H - 14 * k;
  const br = Math.sin(t * 2.4), bob = -1.2 * (0.5 + 0.5 * br);
  const aura = !o.silhouette && a.aura; // 미보유 실루엣은 몸 모양만(오라·바닥 빛이 덩어리로 보이지 않게)
  if (!o.silhouette) floor(x, k, cx, fy, RARITY_COL[RAR[a.r]][0], 90);
  const at = (tx, ty, rot = 0, sy = 1) => { x.setTransform(k, 0, 0, k * sy, cx + tx * k, fy + ty * k); if (rot) x.rotate(rot); };
  const body = heroBody(cls, tier, o.armor || null, o.helm || null, k, a.id); // 기본 외형 미리보기는 옷장이 지금 장비(o.armor·o.helm)를 넘긴다 — 코스튬이면 무시됨
  if (aura) { at(0, bob); aura(x, 0, t, body); }
  at(0, 0);
  for (const s of [-1, 1]) { rrect(x, s * 5 - 4.5, -17, 9, 16, 4); fs(x, a.legs || LEG_DEF[cls] || '#5a3a2a', 2.6, INK2); }
  at(0, bob, 0, 1 + 0.018 * br); drawO(x, body);
  at(HERO_GRIP.x, HERO_GRIP.y + bob, (IDLE_W[cls] ?? 0.3) + Math.sin(t * 2.4) * 0.05); drawO(x, heroWeapon(cls, o.weapon || 'common', k));
  if (cls === 'cleric') { at(2, -84 + bob + Math.sin(t * 2.2) * 1.5); ADD(x, true); x.lineWidth = 4; x.strokeStyle = '#ffe07a'; x.beginPath(); x.ellipse(0, 0, 17, 5.5, 0, 0, TAU); x.stroke(); ADD(x, false); }
  if (aura) { at(0, bob); aura(x, 1, t, body); }
}
function previewRobe(x, a, t, W, H, o) {
  const tier = o.tier ?? 3, k = Math.min(H / 150, W / 150), cx = W / 2, fy = H - 12 * k;
  const br = Math.sin(t * 2.2), sy = 1 + 0.018 * br;
  const aura = !o.silhouette && a.aura;
  if (!o.silhouette) floor(x, k, cx, fy, RARITY_COL[RAR[a.r]][0], 110);
  const at = (tx, ty, rot = 0, s2 = 1) => { x.setTransform(k, 0, 0, k * s2, cx + tx * k, fy + ty * k); if (rot) x.rotate(rot); };
  if (aura) { at(0, 0); aura(x, 0, t); }
  if (tier >= 1) { at(0, -54 * sy); x.transform(1, 0, 0.07 * Math.sin(t * 1.6), 1, 0, 0); drawO(x, mageCape(0, tier, k, a.id)); }
  at(0, 0, 0, sy); drawO(x, mageBody(0, tier, k, a.id));
  const sa = -0.2 + 0.03 * br, gx = MAGE_GRIP.x, gy = MAGE_GRIP.y * sy, ob = STAFF_ORB[tier];
  at(gx, gy, sa); drawO(x, mageStaff(0, tier, k, a.id));
  const ox = gx - ob.y * Math.sin(sa), oy = gy + ob.y * Math.cos(sa), og = 30 + tier * 3 + 3 * br;
  if (!o.silhouette) { at(0, 0); ADD(x, true); img(x, glowS(a.pal.orb[1]), ox, oy, og, og, 0.85); if (tier >= 3) img(x, glowS(a.pal.orb[1]), ox, oy, og * 2.2, og * 2.2, 0.3); ADD(x, false); x.globalAlpha = 1; }
  if (aura) { at(0, 0); aura(x, 1, t); }
}
// 스킨 시연: 오브(왼쪽 아래)에서 과녁(오른쪽 위)으로 0.6초마다 탄, 명중 입자 · 2.4초마다 스킬 폭발(+ 전설 문장)
function previewSkin(x, a, t, W, H) {
  const k = Math.min(W / 200, H / 150), ox0 = (W - 200 * k) / 2, oy0 = (H - 150 * k) / 2;
  const at = (tx, ty, rot = 0, s = 1) => { x.setTransform(k * s, 0, 0, k * s, ox0 + tx * k, oy0 + ty * k); if (rot) x.rotate(rot); };
  const O = [36, 118], G = [160, 44];
  // 과녁: 룬 고리 두 겹
  at(G[0], G[1]);
  x.globalAlpha = 0.9; x.lineWidth = 3; x.strokeStyle = '#4535a0'; x.beginPath(); x.arc(0, 0, 17, 0, TAU); x.stroke();
  x.lineWidth = 2; x.strokeStyle = '#7b6cff'; x.beginPath(); x.arc(0, 0, 10, 0, TAU); x.stroke();
  x.fillStyle = '#2b2366'; x.beginPath(); x.arc(0, 0, 4.5, 0, TAU); x.fill(); x.globalAlpha = 1;
  // 오브
  at(O[0], O[1]); ADD(x, true); img(x, glowS(a.main), 0, 0, 50 + 4 * Math.sin(t * 5), 50 + 4 * Math.sin(t * 5), 0.7); ADD(x, false);
  circ(x, 0, 0, 9); fs(x, rad(x, 0, 0, 0, 9, [[0, '#ffffff'], [0.3, a.core], [0.7, a.main], [1, a.edge]], -3, -3), 2.2, INK2);
  shine(x, -3, -3.5, 2.6, 1.4, -0.6, 0.9);
  const dx = G[0] - O[0], dy = G[1] - O[1], ang = Math.atan2(dy, dx), per = 0.6, fly = 0.45;
  // 탄(비행 중인 것) + 명중 입자(상태 없이: 명중 시각부터의 나이로 위치 계산)
  for (let j = 0; j < 4; j++) {
    const t0 = (Math.floor(t / per) - j) * per, age = t - t0;
    if (age < 0) continue;
    const off = Math.sin(t0 * 7.3) * 10;
    if (age < fly) {
      const u = age / fly, px = O[0] + dx * u - Math.sin(ang) * off * Math.sin(u * Math.PI), py = O[1] + dy * u + Math.cos(ang) * off * Math.sin(u * Math.PI);
      at(px, py, ang); ADD(x, true);
      x.globalAlpha = 0.85; x.drawImage(glowS(a.main), -40, -5, 44, 10);
      img(x, glowS(a.main), 0, 0, 26, 26, 0.6); ADD(x, false); x.globalAlpha = 1;
      const h = a.head(((t * 18) | 0) & 1); x.drawImage(h, -h.hw - 5, -h.hh, h.hw * 2, h.hh * 2);
    } else if (age < fly + 0.6) {
      const g = age - fly;
      for (let m = 0; m < 5; m++) {
        const r = m * 1.3 + t0 * 3.1 + Math.sin(m * 5.3), v = 30 + (m * 41 % 70);
        partAt(x, a, k, ox0, oy0, G[0] + Math.cos(r) * v * g, G[1] + Math.sin(r) * v * g + fallOf(a) * g * g * 0.5, g / 0.6, m + t0);
      }
    }
  }
  const sk = t % 2.4; // 스킬 폭발
  if (sk < 0.9) {
    const u = sk / 0.9, cxs = 150, cys = 60;
    at(cxs, cys); ADD(x, true); x.globalAlpha = 1 - u; x.lineWidth = 4 * (1 - u) + 1; x.strokeStyle = a.main; x.beginPath(); x.arc(0, 0, 10 + 40 * u, 0, TAU); x.stroke(); img(x, glowS(a.main), 0, 0, 90 * (1 - u * 0.5), 90 * (1 - u * 0.5), 0.5 * (1 - u)); ADD(x, false); x.globalAlpha = 1;
    if (a.sigil) { at(cxs, cys, a.sigil === 'star' ? u * 1.2 : 0, 0.8 + 0.4 * Math.min(1, u * 3)); x.globalAlpha = Math.min(1, (1 - u) * 2.5) * 0.9; x.drawImage(sigilSpr(a), -34, -34, 68, 68); x.globalAlpha = 1; }
    for (let m = 0; m < 12; m++) { const r = m * TAU / 12 + Math.sin(m * 7.1) * 0.45, v = 35 + (m * 37 % 70); partAt(x, a, k, ox0, oy0, cxs + Math.cos(r) * v * sk, cys + Math.sin(r) * v * sk + fallOf(a) * sk * sk * 0.5, u, m); }
  }
  x.globalAlpha = 1;
}
// 스킨 정지 컷(카드·목록 썸네일): 큰 탄 머리 + 빛 + 테 + 고유 입자 6개(전설은 문장) — 작은 칸에서도 점이 아니라 '이펙트'로 읽히게 틀의 ~70%를 채운다
function skinEmblem(x, a, W, H) {
  const k = Math.min(W, H) / 100, cx = W / 2, cy = H / 2;
  const at = (tx, ty, rot = 0, s = 1) => { x.setTransform(k * s, 0, 0, k * s, cx + tx * k, cy + ty * k); if (rot) x.rotate(rot); };
  at(0, 0); ADD(x, true); img(x, glowS(a.main), 0, 0, 100, 100, 0.55); ADD(x, false); x.globalAlpha = 1;
  if (a.sigil) { at(0, 0, 0, 1.3); x.globalAlpha = 0.9; x.drawImage(sigilSpr(a), -34, -34, 68, 68); x.globalAlpha = 1; }
  at(0, 0); x.lineWidth = 3.2; x.strokeStyle = a.edge; x.beginPath(); x.arc(0, 0, 36, 0, TAU); x.stroke();
  x.lineWidth = 1.4; x.strokeStyle = lite(a.main, 0.5); x.beginPath(); x.arc(0, 0, 36, 0, TAU); x.stroke();
  for (let m = 0; m < 6; m++) {
    const r = m * TAU / 6 + 0.5, v = 30 + (m % 2) * 9;
    at(Math.cos(r) * v, Math.sin(r) * v, m * 1.7, 1.25 - (m % 3) * 0.2);
    ADD(x, !!MOTE_ADD[a.mote]); x.drawImage(moteSpr(a), -8, -8, 16, 16); ADD(x, false);
  }
  at(-6, 5, -0.62, 1.05); ADD(x, true); x.globalAlpha = 0.9; x.drawImage(glowS(a.main), -58, -8, 62, 16); img(x, glowS(a.main), 4, 0, 40, 40, 0.7); ADD(x, false); x.globalAlpha = 1;
  const h = a.head(1); x.drawImage(h, -h.hw - 5, -h.hh, h.hw * 2, h.hh * 2);
}
const fallOf = a => (a.mote === 'petal' ? 60 : a.mote === 'wisp' ? -50 : a.mote === 'hex' || a.mote === 'coin' ? 200 : 0);
function partAt(x, a, k, ox0, oy0, px, py, u, seed) {
  const s = 9 * (a.mote === 'wisp' ? 1 + u * 0.6 : 1 - u * 0.4);
  x.setTransform(k, 0, 0, k, ox0 + px * k, oy0 + py * k); x.rotate(seed * 1.7 + u * 3);
  ADD(x, !!MOTE_ADD[a.mote]); x.globalAlpha = Math.min(1, (1 - u) * 2.2);
  x.drawImage(moteSpr(a), -s, -s, s * 2, s * 2);
  ADD(x, false); x.globalAlpha = 1;
}
let SCR = null; // 실루엣용 임시 캔버스
// 한 프레임 그리기. cv = 캔버스(백킹 크기 그대로 씀), t = 초, o = { silhouette, tier, weapon }
export function renderPreview(cv, id, t = 0, o = {}) {
  const a = artOf(id) || (Object.hasOwn(BASE, id) ? BASE[id] : null), W = cv.width, H = cv.height;
  let x = cv.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; ADD(x, false); x.clearRect(0, 0, W, H);
  if (!a) return false;
  const out = x;
  if (o.silhouette) {
    if (!SCR) SCR = document.createElement('canvas');
    SCR.width = W; SCR.height = H;
    x = SCR.getContext('2d');
  }
  x.lineJoin = 'round'; x.lineCap = 'round';
  if (a.kind === 'costume') previewCostume(x, a, o.silhouette ? 0.6 : t, W, H, o);
  else if (a.kind === 'robe') previewRobe(x, a, o.silhouette ? 0.6 : t, W, H, o);
  else if (o.emblem) skinEmblem(x, a, W, H);
  else previewSkin(x, a, o.silhouette ? 0.72 : t, W, H);
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1; ADD(x, false);
  if (o.silhouette) { // 미보유: 같은 모양의 짙은 남보라 실루엣 + 은은한 테
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = '#2b2366'; x.fillRect(0, 0, W, H);
    x.globalCompositeOperation = 'source-over';
    out.globalAlpha = 0.9;
    for (const [dx, dy] of [[-1.5, 0], [1.5, 0], [0, -1.5], [0, 1.5]]) out.drawImage(SCR, dx, dy);
    out.globalCompositeOperation = 'source-in'; out.fillStyle = '#7b6cff'; out.fillRect(0, 0, W, H);
    out.globalCompositeOperation = 'source-over'; out.globalAlpha = 1;
    out.drawImage(SCR, 0, 0);
  }
  return true;
}
// 움직이는 미리보기: 캔버스가 문서에서 빠지면 스스로 멈춤. 반환 = stop()
export function playPreview(cv, id, o = {}) {
  let on = true, t0 = 0, raf = 0;
  const step = ts => {
    if (!on || !cv.isConnected) { on = false; return; }
    if (!t0) t0 = ts;
    renderPreview(cv, id, (ts - t0) / 1000, o);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  renderPreview(cv, id, 0, o);
  return () => { on = false; cancelAnimationFrame(raf); };
}
// 정지 초상 dataURL(카드·목록). 정사각 px, 캐시
const URLS = new Map();
export function cosmeticURL(id, px = 256, o = {}) {
  const key = id + '|' + px + (o.silhouette ? '|s' : '');
  let u = URLS.get(key);
  if (u) return u;
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const sk = kindOf(id) === 'skin';
  if (!renderPreview(c, id, sk ? 0.32 : 0.9, sk ? { ...o, emblem: true } : o)) return ''; // 스킨 정지 컷 = 큰 문장(skinEmblem — 카드·목록에서 빈약해 보이지 않게)
  u = c.toDataURL('image/png');
  URLS.set(key, u);
  return u;
}

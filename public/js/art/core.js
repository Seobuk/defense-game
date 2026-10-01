// 아트 공용 코어 — 굽기(bake) 캐시 · 도형 도우미 · 팔레트 · 프레임 상태 · 카메라(흔들림/섬광) · 좌표 변환.
// units.js / world.js / fx.js / hud.js 가 모두 여기서 가져다 쓴다. render.js 만 프레임 상태를 바꾼다(set* 함수).
// 소유: 아트 리드. 제작 에이전트는 이 파일을 고치지 말고 자기 모듈 안에 도우미를 둔다(공용이 꼭 필요하면 요청).
// 스프라이트 규약: 모든 구운 캔버스는 월드 단위 반폭/반높이(c.hw, c.hh)를 가진다 → drawImage(c, x - c.hw, y - c.hh, c.hw * 2, c.hh * 2)
//   bakeO 로 구운 것은 기준점(발·손잡이)이 중심에서 c.oy 만큼 아래 → put(c) 로 그린다.
import { GOLD_POS as CFG_GOLD, WORLD_W, WORLD_H } from '../config.js';

export const TAU = Math.PI * 2;
export const INK = '#2a1b36';
export let S = 1; // 월드 → 백킹 픽셀 배율
export const cache = new Map();

export function setScale(s) {
  s = Math.min(4, Math.max(0.25, s || 1));
  if (Math.abs(s - S) < 1e-3) return;
  S = s;
  cache.clear();
}

export function bake(key, hw, hh, draw, res = S) {
  let c = cache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(hw * 2 * res));
  c.height = Math.max(1, Math.ceil(hh * 2 * res));
  const x = c.getContext('2d');
  x.setTransform(c.width / (hw * 2), 0, 0, c.height / (hh * 2), c.width / 2, c.height / 2);
  x.lineJoin = 'round';
  x.lineCap = 'round';
  draw(x);
  c.hw = hw;
  c.hh = hh;
  cache.set(key, c);
  return c;
}

// 같은 모양에 색만 덮은 변형 (흰 번쩍임, 빙결, 색수차 등)
export function tint(src, key, color, a) { // 원본과 같은 해상도로 굽는다(해상도가 다르면 잘려 사각형처럼 보이던 버그)
  return bake(key + '|' + src.width, src.hw, src.hh, x => {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.drawImage(src, 0, 0, x.canvas.width, x.canvas.height);
    x.globalCompositeOperation = 'source-atop';
    x.globalAlpha = a;
    x.fillStyle = color;
    x.fillRect(0, 0, x.canvas.width, x.canvas.height);
  }, src.width / (src.hw * 2));
}


// ── 그리기 도우미 ──
export function circ(x, cx, cy, r) { x.beginPath(); x.arc(cx, cy, r, 0, TAU); }
export function ell(x, cx, cy, rx, ry, rot = 0) { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, TAU); }
export function rrect(x, l, t, w, h, r) {
  x.beginPath();
  x.moveTo(l + r, t);
  x.arcTo(l + w, t, l + w, t + h, r);
  x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r);
  x.arcTo(l, t, l + w, t, r);
  x.closePath();
}
export function fs(x, fill, lw, stroke = INK) {
  x.fillStyle = fill;
  x.fill();
  if (lw) { x.lineWidth = lw; x.strokeStyle = stroke; x.stroke(); }
}
export function rad(x, cx, cy, r0, r1, stops, fx = cx, fy = cy) {
  const g = x.createRadialGradient(fx, fy, r0, cx, cy, r1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  return g;
}
export function lin(x, x0, y0, x1, y1, stops) {
  const g = x.createLinearGradient(x0, y0, x1, y1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  return g;
}
export function poly(x, pts) {
  x.beginPath();
  x.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
  x.closePath();
}

export function shine(x, cx, cy, rx, ry, rot = -0.6, a = 0.8) {
  x.fillStyle = `rgba(255,255,255,${a})`;
  ell(x, cx, cy, rx, ry, rot);
  x.fill();
}

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const INK2 = '#22163a';
export const SKIN = '#ffdcbc';
export const EL = { // [코어, 메인, 에지] ART §2.4
  fire: ['#fff2a0', '#ff6a1f', '#b3230f'],
  lightning: ['#ffffff', '#ffe53a', '#7b5cff'],
  frost: ['#ffffff', '#7fe3ff', '#2a78e0'],
  wind: ['#f0fff8', '#6ff0c0', '#169a78'],
  holy: ['#ffffff', '#fff0a8', '#e0a72e'],
  dark: ['#f2c8ff', '#9a3dff', '#2a0a4a'],
  summon: ['#fff0fb', '#ff6fd2', '#8a1f7a'],
};
export const RARITY_COL = { // [메인, 밝음, 어둠] ART §2.3
  common: ['#b9c2d0', '#eef2f7', '#5a6478'],
  uncommon: ['#5fe06e', '#d4ffd8', '#1d8a3a'],
  rare: ['#3fa9ff', '#d2ecff', '#1450b8'],
  epic: ['#b85cff', '#efd6ff', '#5a1fa8'],
  legend: ['#ffb020', '#fff0b8', '#a65200'],
};
export const TIER_RARITY = ['common', 'uncommon', 'rare', 'epic', 'legend'];

export function rgb(c) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
export function mix(a, b, t) {
  const A = rgb(a), B = rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
export const lite = (c, t) => mix(c, '#ffffff', t);
export const dim = (c, t) => mix(c, '#1c1238', t);
// 3단 셀 셰이딩: 좌상단 밝음 | 기본 | 우하단 그림자 (경계가 딱 끊김)
export function cel(x, x0, y0, x1, y1, base, l = 0.32, d = 0.3) {
  return lin(x, x0, y0, x1, y1, [[0, lite(base, l)], [0.2, lite(base, l)], [0.21, base], [0.64, base], [0.65, dim(base, d)], [1, dim(base, d)]]);
}
// 원점 = 기준점(발·손잡이 등). c.oy 만큼 스프라이트 중심에서 아래로 떨어져 있다 → render의 put() 로 그린다
export function bakeO(key, hw, hh, oy, draw, res) {
  const c = bake(key, hw, hh, x => { x.translate(0, oy); draw(x); }, res);
  c.oy = oy;
  c.key = key;
  return c;
}
// 같은 모양 단색 덮개 (피격 번쩍임·잔상·쓰러짐)
export function tintOf(c, color, a = 1) {
  const t = tint(c, (c.key || 'k') + '|t' + color + a, color, a);
  t.oy = c.oy || 0;
  return t;
}

// ═════════════ 프레임 상태 (render.js 가 매 프레임 설정, 다른 모듈은 읽기만: ES 모듈 live binding) ═════════════
export let ctx = null;                         // 화면 캔버스 2D 컨텍스트
export let W = 1, H = 1;                       // 백킹 픽셀 크기
export let scale = 1, ox = 0, oy = 0;          // 월드 → 화면 (흔들림 없음, HUD용)
export let topExtra = 0;                       // 월드 y=0 위로 보이는 여분 높이(월드 단위, 세로로 긴 화면). 0 이상
export let sideX = 0;                          // 월드 x=0 왼쪽(= x=720 오른쪽)으로 보이는 여분 폭(월드 단위, 넓은 화면·폴더블). 0 이상
export let K = 1, BX = 0, BY = 0;              // 월드 → 화면 (흔들림·히트스톱 줌 포함)
export let T = 0, RT = 0;                      // T = 애니메이션 시계(히트스톱 중 정지), RT = 실제 시계
export let frameDt = 0, frameNo = 0;           // 이번 프레임 실제 dt, 프레임 번호
export function setCanvas(c) { ctx = c; }
export function setView(w, h, s, x, y, extra = 0, side = 0) { W = w; H = h; scale = s; ox = x; oy = y; topExtra = extra; sideX = side; }
export function setWorldTransform(k, bx, by) { K = k; BX = bx; BY = by; }
export function setClock(t, rt, dt, n) { T = t; RT = rt; frameDt = dt; frameNo = n; }

// ═════════════ 카메라: 흔들림 · 섬광 · 히트스톱 줌 (어느 모듈이든 호출) ═════════════
export let trauma = 0, flashA = 0, flashCol = '#fff', colA = 0, zoom = 0;
export const shake = a => { trauma = Math.min(1, trauma + a); };
// 섬광(E 백색 과부하): 한 번은 120ms 안에 사라지고, 이미 번쩍이는 중에 또 오면 절반만 더한다(겹쳐도 하얗게 날아가지 않게)
let flashPk = 0, colPk = 0;
export function flash(a, col = '#fff') {
  if (col === '#fff') { flashA = flashA > 0.02 ? Math.max(flashA, a * 0.5) : a; flashPk = flashA; }
  else { colA = colA > 0.02 ? Math.max(colA, a * 0.5) : a; colPk = colA; flashCol = col; }
}
export function punchZoom(z) { zoom = Math.max(zoom, z); }
export function decayCamera(dt) {
  trauma = Math.max(0, trauma - dt * 1.7);
  flashA = Math.max(0, flashA - dt * Math.max(3.2, flashPk / 0.12));
  colA = Math.max(0, colA - dt * Math.max(2.5, colPk / 0.12));
  zoom = Math.max(0, zoom - dt * 3);
}
// 가산 빛 예산(E): render.js 가 'lighter' 로 그린 빛의 화면 면적 × 알파를 세어, 넘치면 다음 프레임 가산 빛 전체를 이 배율로 누른다
export let lightK = 1;
export function setLightK(k) { lightK = k; }
// 우선 빛(Lv6 완전체·MAX 연출): 예산 배율을 덜 받는다(√k) — 후반 전장이 전부 40% 밝기로 납작해지지 않게. render.js lightMeter 가 읽는다
export let lightPrio = false;
export function setLightPrio(v) { lightPrio = v; }
// 망령 계열(망령·영혼·저주) 발광: 어두운 보라가 예산 감쇠에 묻히지 않게 예산에서 뺀다(작은 빛만 — 큰 글로우에 쓰지 말 것)
export const LIGHT_EXEMPT = 2;
// 연출 예산(설정 '그래픽' — gfx.js fx): 1 = 전부(높음). 입자 묶음(burst) 수 · 프레임당 새 입자 상한 · 배경 잔입자에 곱한다
export let fxQ = 1;
export function setFxQ(q) { fxQ = q > 0 ? Math.min(1, q) : 1; }

// ═════════════ 공용 상수 · 이징 · 풀 ═════════════
// UI 정렬용 월드 좌표: 장비 드롭이 날아가 꽂히는 영웅(가방) 버튼 / 마나 게이지가 가득 찰 때 반짝이는 위치
// 세로로 긴 화면에선 DOM HUD가 월드 y=0 보다 topExtra 위에 있으므로 y는 getter (월드 좌표)
export const BAG_POS = { x: 652, get y() { return 170 - topExtra; } };
export const MANA_POS = { x: 360, get y() { return 80 - topExtra; } };
export const GOLD_POS = { x: CFG_GOLD.x, get y() { return CFG_GOLD.y - topExtra; } }; // 동전이 날아갈 골드 알약
export const hudY = y => y - topExtra; // HUD(화면 위쪽) 기준 월드 y → 실제 월드 y
// 화면 전체(위 여분 + 양옆 여분)를 덮는 채우기·이미지 — 오버레이·딤·섬광용
export const fillView = () => ctx.fillRect(-sideX, -topExtra, WORLD_W + sideX * 2, WORLD_H + topExtra);
export const drawView = img => ctx.drawImage(img, -sideX, -topExtra, WORLD_W + sideX * 2, WORLD_H + topExtra);
// 캔버스 글꼴: 따옴표 포함 정확한 패밀리 이름(css/fonts.css). ART.md §5, §11
export const FONT = '"WD Display","Jua","Do Hyeon","Black Han Sans","Malgun Gothic","Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR",system-ui,sans-serif';
export const NUM_FONT = '"WD Impact","Black Han Sans",' + FONT;
export const BODY_FONT = '"WD Body",' + FONT;
// 플레이어별 색 (0 = 나 · 금빛, 1 = AI 동료 · 청록)
export const OWN = [
  { c: '#ffc94a', d: '#9a5a08', num: '#fff1b8', ink: '#4a2000' },
  { c: '#4fe0ff', d: '#0a6a94', num: '#c8f6ff', ink: '#002a44' },
];
export const rnd = Math.random;
export const easeOut = t => 1 - (1 - t) ** 3;
export const easeBack = t => { const c = 1.9; t -= 1; return 1 + (c + 1) * t * t * t + c * t * t; };
export const lerp = (a, b, t) => a + (b - a) * t;
export function pool(n, make) { const a = []; for (let i = 0; i < n; i++) a.push(make()); a.i = 0; return a; }
export function take(a) { const o = a[a.i]; a.i = (a.i + 1) % a.length; return o; } // 가장 오래된 것부터 재활용

// ═════════════ 글꼴 로드 (캔버스는 로드된 글꼴로만 그린다) ═════════════
// 글자를 구워 캐시하는 모듈은 onFontsReady(캐시 비우기)를 등록한다. 늦게 로드돼도 다시 굽는다.
const fontHooks = [];
export function onFontsReady(fn) { fontHooks.push(fn); }
onFontsReady(() => TXT.clear()); // 글꼴이 늦게 오면 구운 글자를 다시
export let fontsLoaded = false;
export function waitFonts(ms = 1500) {
  const fonts = typeof document !== 'undefined' && document.fonts;
  if (!fonts) return Promise.resolve();
  const want = ['64px "WD Impact"', '32px "WD Display"', '16px "WD Body"'];
  const done = () => { fontsLoaded = true; for (const f of fontHooks) f(); };
  const all = Promise.all(want.map(f => fonts.load(f, '0123456789가나다KMB!'))).then(done, done);
  fonts.ready.then(done, () => {});
  return Promise.race([all, new Promise(r => setTimeout(r, ms))]);
}

// ═════════════ 화면 그리기 도우미 (ctx 기준) ═════════════
// 월드 좌표 그리기는 wt(), HUD(흔들림 없음)는 ht(). place/placeH 는 회전·배율 포함 변환
export const put = c => ctx.drawImage(c, -c.hw, -c.hh - (c.oy || 0), c.hw * 2, c.hh * 2);
// ── 변환 도우미 ──
export const wt = () => ctx.setTransform(K, 0, 0, K, BX, BY);
export const ht = () => ctx.setTransform(scale, 0, 0, scale, ox, oy);
export function place(x, y, rot, sx, sy) {
  const c = Math.cos(rot), s = Math.sin(rot);
  ctx.setTransform(K * c * sx, K * s * sx, -K * s * sy, K * c * sy, BX + K * x, BY + K * y);
}
export function placeH(x, y, s) { ctx.setTransform(scale * s, 0, 0, scale * s, ox + scale * x, oy + scale * y); }
export function spr(c, x, y, w, h) { ctx.drawImage(c, x - w / 2, y - h / 2, w, h); }
// 테두리 글자(가운데 정렬 기준선 middle). 발열 2차: 화면 캔버스에 ctx.font 를 쓰면 HUD DOM 이 바뀐 프레임마다 문서 스타일 계산을 강제한다(ART §12) —
// 글자를 문서 밖 캔버스에 한 번 구워(지금 변환 배율 ¼ 단위로 — 선명) drawImage 한다. 같은 글자·크기·색이면 재사용, 300개 넘으면 가장 오래 안 쓴 것부터 버린다
// ponytail: 자주 바뀌는 글자(성벽 체력)는 부르는 쪽이 갱신을 솎는다(world.js — 0.1초) — 숫자마다 굽는 것보단 싸고 아틀라스보단 단순
const TXT = new Map();
let tctx = null;
// fam: 다른 글꼴(예: NUM_FONT — 굵기 지정 없이). 반환 = 글자 폭(월드 단위)
export function txt(str, x, y, size, fill, ink, lw, align = 'center', fam = '') {
  // 지금 변환 배율: render.js 빛 계량기가 화면 ctx 의 변환 호출을 따라가며 ctx.det(행렬식)로 준다 — getTransform 은 부를 때마다 DOMMatrix 할당
  const d = ctx.det ?? ((m) => Math.abs(m.a * m.d - m.b * m.c))(ctx.getTransform()), k = Math.ceil(Math.sqrt(d) * 4) / 4 || 1;
  const key = str + '|' + size + fam + '|' + fill + '|' + (ink ? ink + lw : '') + '|' + k;
  let c = TXT.get(key);
  if (c) { TXT.delete(key); TXT.set(key, c); } // 쓴 것은 맨 뒤로(Map 순서 = 오래 안 쓴 순)
  else {
    if (TXT.size >= 300) TXT.delete(TXT.keys().next().value); // 늘 보이는 글자(보스바·이름표)는 살아남는다
    const f = fam ? `${size}px ${fam}` : `900 ${size}px ${FONT}`;
    if (!tctx) tctx = document.createElement('canvas').getContext('2d');
    tctx.font = f;
    const tw = tctx.measureText(str).width, pad = (ink ? lw / 2 : 0) + 2, h = size * 1.5 + pad * 2;
    c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil((tw + pad * 2) * k)); c.height = Math.max(1, Math.ceil(h * k));
    const x2 = c.getContext('2d');
    x2.scale(c.width / (tw + pad * 2), c.height / h);
    x2.font = f; x2.textAlign = 'left'; x2.textBaseline = 'middle'; x2.lineJoin = 'round';
    if (ink) { x2.lineWidth = lw; x2.strokeStyle = ink; x2.strokeText(str, pad, h / 2); }
    x2.fillStyle = fill;
    x2.fillText(str, pad, h / 2);
    c.tw = tw; c.pad = pad; c.w = tw + pad * 2; c.h = h;
    TXT.set(key, c);
  }
  ctx.drawImage(c, (align === 'center' ? x - c.tw / 2 : align === 'right' ? x - c.tw : x) - c.pad, y - c.h / 2, c.w, c.h);
  return c.tw;
}

export function rr(l, t, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(l + r, t);
  ctx.arcTo(l + w, t, l + w, t + h, r);
  ctx.arcTo(l + w, t + h, l, t + h, r);
  ctx.arcTo(l, t + h, l, t, r);
  ctx.arcTo(l, t, l + w, t, r);
  ctx.closePath();
}

// ══ 마법 판타지 그리기 ══
export const additive = on => { ctx.globalCompositeOperation = on ? 'lighter' : 'source-over'; };

// 땅에 눕힌 마법진 (y로 납작)
export function groundRune(img, x, y, s, spin, a) {
  ctx.globalAlpha = a;
  place(x, y, Math.PI / 2, s * 0.38, s);
  ctx.rotate(spin);
  ctx.drawImage(img, -img.hw, -img.hh, img.hw * 2, img.hh * 2);
  wt();
}

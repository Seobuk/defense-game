// 유닛 — 적·엘리트·네임드 보스·영웅(클래스×티어·장비)·성벽 마법사 2명(P1 나, P2 AI 동료)·소환수(새끼 드래곤·돌 골렘·망령).
// 스프라이트(오프스크린 캐시) + 전장 그리기 + 유닛별 연출 상태(피격 번쩍임·찌그러짐·시전 자세 등). docs/ART.md §3, §10.5
// 소유: 유닛 에이전트. 계약(아래 export 목록과 render.js 호출 순서)은 docs/ART.md §14 참고.
import { WALL_Y, CANNONS, SPELL_BY_KEY } from '../config.js';
import { HERO_CLASSES } from '../hero.js';
import { clamp } from '../util.js';
import {
  TAU, INK, bake, tint, circ, ell, rrect, fs, rad, lin, poly, shine, mulberry, INK2, SKIN, RARITY_COL, TIER_RARITY, EL,
  mix, lite, dim, cel, bakeO, tintOf, cache, S,
  ctx, T, RT, frameNo, frameDt, topExtra, hudY,
  shake, flash, FONT, OWN, rnd, easeOut, easeBack, lerp, pool, take,
  wt, place, spr, put, txt, rr, additive, groundRune,
} from './core.js';
import {
  gl, part, burst, ring, sprPop, lightBeam, K_GLOW, K_SPARK, K_STAR, K_SMOKE, K_DEBRIS, K_SHARD, MSTY,
  glyph, shadow, flame, bubble, ice, reticle, sparkle, rays, runeCircle, magicCore, curseSigil, shieldDome, lightWings,
  numZone, arrowSpr, warcryUntil,
} from './fx.js';
import { emblem } from './emblems.js';

export const MAGE_FEET = 1004;             // 성벽 위 마법사 발 위치(y)
const mageTier = lv => (lv ? clamp(Math.floor(((lv.multi | 0) + Math.min(5, (lv.atk | 0) / 12)) / 2), 0, 4) : 0);
// 적 종류별 걸음 애니메이션
const ANIM = {
  slime: 'jelly', kingSlime: 'jelly', bomber: 'jelly', mushroom: 'hop', goblin: 'hop', imp: 'hop', wolf: 'trot',
  skeleton: 'waddle', boneThrower: 'waddle', shieldSkel: 'waddle', demon: 'waddle',
  wraith: 'float', lichLord: 'float', doomDragon: 'float', magmaGolem: 'heavy', demonLord: 'heavy', goblinChariot: 'heavy',
};

// ── 유닛 연출 상태 (fx.js 가 이벤트에서 직접 쓰는 것도 있다: MF.cast/aim, HF.atk/tx/ty, visOf(e).hitD/punch/chroma, stuns) ──
const vis = new Map(); // 적 id → 연출 상태 (스냅샷으로 재구성된 view에서도 유지되게 id 기준)
const order = [];
// 성벽 마법사 [0, 1]: cast 시전 자세(1→0), aim 조준각, ox/oy 지팡이 오브(마법탄 발사 위치), hx/hy 빈손
export const MF = [0, 1].map(i => ({ cast: 0, aim: -Math.PI / 2, runeT: 0, ox: CANNONS[i].x, oy: 940, hx: CANNONS[i].x, hy: 970, col: i ? '#8fe8ff' : '#ff8a2a', big: 0, ground: 0, fanT: 0 }));
const ALLY = { t: 9, key: '', level: 1 }; // AI 동료 새 주문 습득 연출
// 영웅: atk 공격 후 경과, tx/ty 공격 표적, hurt 피격 번쩍임, down 쓰러진 뒤 경과, pop 등장 스프링, walk 걸음 위상, body 현재 몸 스프라이트
export const HF = { atk: 9, tx: 0, ty: 0, hurt: 0, down: 0, pop: 1, walk: 0, lx: 0, ly: 0, mvKey: '', body: null, cmd: 0 };
const GF = { on: false, pop: 1, hit: 0, lastHp: 0 };   // 돌 골렘
const DF = { on: false, pop: 1 };                      // 새끼 드래곤
export const stuns = new Map();          // 적 id → 기절 표시 끝 시각(RT)
export const upGlow = [0, 0];            // 강화 직후 마법사 빛
const AFTER = pool(14, () => ({ life: 0, max: 0.4, x: 0, y: 0, face: 1, img: null }));
// 영웅 잔상 (암살자 공격·궁극기)
export function afterImage(x, y, face, life) {
  const a = take(AFTER);
  a.life = a.max = life; a.x = x; a.y = y; a.face = face; a.img = HF.body;
}

// ═════════════ 텍스처 (오프스크린 캐시) ═════════════
// 도안 규약: 적·보스 도안은 "100 공간"(몸 반경 = 100, 발 ≈ +90, 성벽 = 아래)에 그린다. 굽는 크기는 시각 반경(ART §3.4)으로 정해지고
// 선 두께는 월드 단위 고정(ART §3.1) → LW(내부 선)를 100 공간으로 환산해 둔다. 바깥 외곽선·림·그림자 초승달은 굽기 후처리(finish)가 한 번에 입힌다.
let LW = 2;             // 내부 디테일 선 (100 공간)
let BLINK = false;      // 눈 감은 포즈
let RAGE = false;       // 분노 포즈 (보스 시전·돌진·격노)
const PA = f => { const p = new Path2D(); f(p); return p; };
const pC = (cx, cy, r) => PA(p => p.arc(cx, cy, r, 0, TAU));
const pE = (cx, cy, rx, ry, rot = 0) => PA(p => p.ellipse(cx, cy, rx, ry, rot, 0, TAU));
const pP = pts => PA(p => { p.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]); p.closePath(); });
const pR = (l, t, w, h, r) => PA(p => {
  p.moveTo(l + r, t); p.arcTo(l + w, t, l + w, t + h, r); p.arcTo(l + w, t + h, l, t + h, r);
  p.arcTo(l, t + h, l, t, r); p.arcTo(l, t, l + w, t, r); p.closePath();
});
const MOVE = (dx, dy) => new DOMMatrix([1, 0, 0, 1, dx, dy]);
// p 안에서, p 를 (dx,dy) 옮긴 모양의 바깥을 칠한다 → 가장자리 초승달
function edge(x, p, dx, dy, col) {
  const q = new Path2D();
  q.rect(-1e4, -1e4, 2e4, 2e4);
  q.addPath(p, MOVE(dx, dy));
  x.fillStyle = col;
  x.fill(q, 'evenodd');
}
// 셀 셰이딩 한 조각: 기본 → 우하단 그림자 → 좌상단 밝음 → 좌상단 림 선 → 외곽선 (ART §3.2). k = 조각 크기(반경)
function paint(x, p, base, k = 40, o = {}) {
  x.fillStyle = base;
  x.fill(p);
  x.save();
  x.clip(p);
  if (o.sh !== 0) edge(x, p, -k * (o.sd ?? 0.2), -k * (o.sd ?? 0.2) * 1.3, dim(base, o.sh ?? 0.32));
  if (o.li !== 0) edge(x, p, k * 0.14, k * 0.18, lite(base, o.li ?? 0.28));
  if (o.rim !== 0) edge(x, p, LW * 0.8, LW * 0.8, lite(base, o.rim ?? 0.72));
  if (o.fn) o.fn();
  x.restore();
  if (o.lw !== 0) { x.lineWidth = o.lw ?? LW; x.strokeStyle = o.ink || INK2; x.stroke(p); }
}
function gloss(x, cx, cy, rx, ry, rot = -0.6, a = 0.85) {
  x.fillStyle = `rgba(255,255,255,${a})`;
  x.fill(pE(cx, cy, rx, ry, rot));
  x.fill(pC(cx + rx * 0.9, cy + ry * 1.6, ry * 0.45));
}
function line(x, pts, w, col = INK2) {
  x.beginPath();
  x.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) x.lineTo(pts[i], pts[i + 1]);
  x.lineWidth = w; x.strokeStyle = col; x.stroke();
}
function curve(x, x0, y0, cx, cy, x1, y1, w, col = INK2) {
  x.beginPath(); x.moveTo(x0, y0); x.quadraticCurveTo(cx, cy, x1, y1);
  x.lineWidth = w; x.strokeStyle = col; x.stroke();
}
// 큰 눈 (살짝 아래 = 성벽을 본다). BLINK 면 감은 눈
function eye(x, cx, cy, rw, rh, iris, o = {}) {
  if (BLINK) {
    x.beginPath(); x.moveTo(cx - rw, cy + rh * 0.05); x.quadraticCurveTo(cx, cy + rh * 0.6, cx + rw, cy + rh * 0.05);
    x.lineWidth = LW * 1.3; x.strokeStyle = INK2; x.stroke();
    return;
  }
  const p = pE(cx, cy, rw, rh);
  x.fillStyle = '#ffffff'; x.fill(p);
  x.save(); x.clip(p);
  const ir = rw * (o.ir ?? 0.8), iy = cy + rh * 0.2;
  x.fillStyle = iris; x.fill(pC(cx + (o.lx || 0), iy, ir));
  x.fillStyle = lite(iris, 0.45); x.fill(pE(cx + (o.lx || 0), iy + ir * 0.55, ir * 0.62, ir * 0.3));
  x.fillStyle = INK2; x.fill(o.slit ? pE(cx + (o.lx || 0), iy, ir * 0.22, ir * 0.72) : pC(cx + (o.lx || 0), iy + ir * 0.08, ir * (RAGE ? 0.34 : 0.48)));
  x.fillStyle = 'rgba(34,22,58,0.28)'; x.fill(pE(cx, cy - rh * 0.95, rw * 1.3, rh * 0.5));
  x.restore();
  x.lineWidth = LW; x.strokeStyle = INK2; x.stroke(p);
  x.fillStyle = '#ffffff';
  x.fill(pC(cx - rw * 0.3 + (o.lx || 0), cy - rh * 0.12, rw * 0.3));
  x.fill(pC(cx + rw * 0.32 + (o.lx || 0), cy + rh * 0.42, rw * 0.13));
}
// 빛나는 눈 (언데드·악마): 어두운 눈구멍 + 발광 눈동자
function glowEye(x, cx, cy, rw, rh, col, rot = 0) {
  const p = pE(cx, cy, rw, rh, rot);
  x.fillStyle = '#1e1430'; x.fill(p);
  if (BLINK) return;
  x.save(); x.clip(p);
  x.fillStyle = rad(x, cx, cy + rh * 0.1, 0, rw * 1.3, [[0, col], [0.45, mix(col, '#1e1430', 0.35)], [1, 'rgba(30,20,48,0)']]);
  x.fill(p);
  x.restore();
  const s = RAGE ? 1.25 : 1;
  x.fillStyle = col; x.fill(pE(cx, cy + rh * 0.1, rw * 0.42 * s, rh * 0.38 * s));
  x.fillStyle = '#ffffff'; x.fill(pC(cx - rw * 0.1, cy, rw * 0.18 * s));
}
function brows(x, cx, cy, gap, w, tilt, lw) { // tilt > 0 = 화난 눈썹 (안쪽이 아래)
  const t = RAGE ? tilt + 8 : tilt;
  for (const s of [-1, 1]) {
    x.beginPath();
    x.moveTo(cx + s * gap, cy + t * 0.5);
    x.lineTo(cx + s * (gap + w), cy - t * 0.5);
    x.lineWidth = lw; x.strokeStyle = INK2; x.stroke();
  }
}
function blush(x, cx, cy, gap, rw = 12) {
  x.fillStyle = 'rgba(255,100,140,0.45)';
  x.fill(pE(cx - gap, cy, rw, rw * 0.55));
  x.fill(pE(cx + gap, cy, rw, rw * 0.55));
}
// 입: 벌린 입 (혀 포함). open 0~1
function mouth(x, cx, cy, w, open, o = {}) {
  const h = w * (0.25 + open * 0.6);
  const p = PA(q => { q.moveTo(cx - w, cy); q.quadraticCurveTo(cx, cy - h * 0.25, cx + w, cy); q.quadraticCurveTo(cx + w * 0.6, cy + h * 1.3, cx, cy + h * 1.3); q.quadraticCurveTo(cx - w * 0.6, cy + h * 1.3, cx - w, cy); q.closePath(); });
  x.fillStyle = o.col || '#5a1030'; x.fill(p);
  x.save(); x.clip(p);
  if (o.tongue !== false) { x.fillStyle = '#ff7a8e'; x.fill(pE(cx + w * 0.1, cy + h * 1.25, w * 0.6, h * 0.55)); }
  if (o.teeth) { x.fillStyle = '#ffffff'; x.fillRect(cx - w, cy - h, w * 2, h * 0.55); }
  x.restore();
  if (o.fangs) for (const s of [-1, 1]) { x.fillStyle = '#ffffff'; x.fill(pP([cx + s * w * 0.55, cy - 1, cx + s * w * 0.3, cy - 1, cx + s * w * 0.42, cy + h * 0.75])); }
  x.lineWidth = LW * 0.9; x.strokeStyle = INK2; x.stroke(p);
}
// 금 왕관
function crown(x, cx, by, w, h, tilt = 0) {
  x.save(); x.translate(cx, by); x.rotate(tilt);
  const l = -w / 2;
  const p = pP([l, 0, l - w * 0.04, -h * 0.62, l + w * 0.2, -h * 0.34, -w * 0.18, -h * 0.95, 0, -h * 0.5, w * 0.18, -h * 0.95, w * 0.3, -h * 0.34, w / 2 + w * 0.04, -h * 0.62, w / 2, 0]);
  paint(x, p, '#ffc93a', w * 0.4, { li: 0.45, sh: 0.35 });
  const band = pR(l - w * 0.02, -h * 0.26, w * 1.04, h * 0.3, h * 0.1);
  paint(x, band, '#f0a820', w * 0.2, { li: 0.4 });
  for (const [px, c] of [[0, '#ff3b5c'], [-w * 0.3, '#3bc3ff'], [w * 0.3, '#3bff8a']]) {
    const g = pE(px, -h * 0.11, w * 0.075, h * 0.1);
    paint(x, g, c, w * 0.07, { li: 0.5, lw: LW * 0.7 });
    x.fillStyle = '#fff'; x.fill(pC(px - w * 0.025, -h * 0.15, w * 0.02));
  }
  for (const [px, py] of [[l - w * 0.04, -h * 0.62], [-w * 0.18, -h * 0.95], [w * 0.18, -h * 0.95], [w / 2 + w * 0.04, -h * 0.62]]) paint(x, pC(px, py, w * 0.06), '#fff3a0', w * 0.06, { lw: LW * 0.7 });
  x.restore();
}
// 용암 균열 (3겹: 번짐 → 주황 → 노랑 심)
function lava(x, lines, w) {
  for (const [c, lw] of [['rgba(255,90,20,0.45)', w * 2.4], ['#ff7a1a', w], ['#ffe45a', w * 0.42]]) {
    x.strokeStyle = c; x.lineWidth = lw;
    for (const l of lines) {
      x.beginPath(); x.moveTo(l[0], l[1]);
      for (let i = 2; i < l.length; i += 2) x.lineTo(l[i], l[i + 1]);
      x.stroke();
    }
  }
}
// 뼈 한 토막 (양끝 둥근 마디)
const IVORY = '#fff1d6';
function boneP(x0, y0, x1, y1, w) {
  const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = -dy / d * w * 0.5, ny = dx / d * w * 0.5;
  return PA(p => {
    p.moveTo(x0 + nx * 0.7, y0 + ny * 0.7); p.lineTo(x1 + nx * 0.7, y1 + ny * 0.7); p.lineTo(x1 - nx * 0.7, y1 - ny * 0.7); p.lineTo(x0 - nx * 0.7, y0 - ny * 0.7); p.closePath();
    for (const [px, py] of [[x0, y0], [x1, y1]]) for (const s of [-1, 1]) { p.moveTo(px + nx * s + w * 0.62, py + ny * s); p.arc(px + nx * s, py + ny * s, w * 0.62, 0, TAU); }
  });
}
function boneLimb(x, x0, y0, x1, y1, w) {
  const p = boneP(x0, y0, x1, y1, w);
  x.lineWidth = LW * 2; x.strokeStyle = INK2; x.stroke(p);
  x.fillStyle = IVORY; x.fill(p);
  x.fillStyle = 'rgba(160,120,90,0.35)';
  x.save(); x.clip(p); x.translate(w * 0.25, w * 0.3); x.fill(p); x.restore();
  x.save(); x.clip(p); x.translate(-w * 0.1, -w * 0.12); x.fillStyle = IVORY; x.fill(p); x.restore();
}
// 해골 머리 (cx, cy 중심, s = 반경)
function skull(x, cx, cy, s, eyeCol, o = {}) {
  const head = PA(p => {
    p.moveTo(cx - s * 0.98, cy + s * 0.05);
    p.bezierCurveTo(cx - s * 1.04, cy - s * 0.9, cx - s * 0.5, cy - s * 1.05, cx, cy - s * 1.05);
    p.bezierCurveTo(cx + s * 0.5, cy - s * 1.05, cx + s * 1.04, cy - s * 0.9, cx + s * 0.98, cy + s * 0.05);
    p.quadraticCurveTo(cx + s * 0.95, cy + s * 0.55, cx + s * 0.62, cy + s * 0.62);
    p.lineTo(cx - s * 0.62, cy + s * 0.62);
    p.quadraticCurveTo(cx - s * 0.95, cy + s * 0.55, cx - s * 0.98, cy + s * 0.05);
    p.closePath();
  });
  paint(x, head, IVORY, s, { sh: 0.3, li: 0.3 });
  const jaw = pR(cx - s * 0.58, cy + s * 0.46, s * 1.16, s * 0.52, s * 0.22);
  paint(x, jaw, dim(IVORY, 0.06), s * 0.4, { sh: 0.35 });
  x.save(); x.clip(jaw);
  for (let i = -2; i <= 2; i++) line(x, [cx + i * s * 0.2, cy + s * 0.5, cx + i * s * 0.2, cy + s * 0.9], LW * 0.8);
  x.restore();
  line(x, [cx - s * 0.56, cy + s * 0.7, cx + s * 0.56, cy + s * 0.7], LW * 0.8);
  for (const sd of [-1, 1]) glowEye(x, cx + sd * s * 0.4, cy + s * 0.05, s * 0.27, s * 0.3, eyeCol, sd * 0.25);
  if (!RAGE) brows(x, cx, cy - s * 0.3, s * 0.12, s * 0.42, 10 * s / 60, LW * 1.1);
  x.fillStyle = '#1e1430'; x.fill(pP([cx, cy + s * 0.28, cx - s * 0.1, cy + s * 0.45, cx + s * 0.1, cy + s * 0.45]));
  if (o.crack !== false) line(x, [cx - s * 0.5, cy - s * 0.85, cx - s * 0.36, cy - s * 0.6, cx - s * 0.46, cy - s * 0.42], LW * 0.8, '#8a6a5a');
}
// 휘어진 뿔: 뿌리(bx,by)에서 바깥으로 뻗다가 끝(tx,ty)으로 휜다. 마디 줄 + 어두운 끝
function horn(x, sx, bx, by, tx, ty, w, base = '#fff1d6', tip = '#5a3a3a') {
  const cx = tx, cy = by + (ty - by) * 0.12;
  const p = PA(q => {
    q.moveTo(bx - sx * w * 0.2, by + w);
    q.quadraticCurveTo(cx + sx * w * 0.9, cy + w * 0.9, tx, ty);
    q.quadraticCurveTo(cx - sx * w * 0.9, cy - w * 0.7, bx - sx * w * 0.2, by - w);
    q.closePath();
  });
  paint(x, p, base, w * 1.2, { sh: 0.34, fn: () => {
    x.fillStyle = tip; x.globalAlpha = 0.9;
    x.fill(pC(tx, ty, Math.hypot(tx - bx, ty - by) * 0.34));
    x.globalAlpha = 1;
    for (const t of [0.28, 0.48, 0.66]) {
      const u = 1 - t, px = u * u * bx + 2 * u * t * cx + t * t * tx, py = u * u * by + 2 * u * t * cy + t * t * ty;
      const gx = 2 * u * (cx - bx) + 2 * t * (tx - cx), gy = 2 * u * (cy - by) + 2 * t * (ty - cy), gd = Math.hypot(gx, gy) || 1;
      const hw = w * (1.1 - t);
      line(x, [px - gy / gd * hw, py + gx / gd * hw, px + gy / gd * hw, py - gx / gd * hw], LW * 0.7, 'rgba(90,60,50,0.55)');
    }
  } });
}

// 깎인 바위 한 덩이: 셀 셰이딩 + 좌상단 면(밝음) + 면 경계선
function rockP(x, pts, k, base) {
  let cx = 0, cy = 0, top = 0;
  const n = pts.length / 2;
  for (let i = 0; i < pts.length; i += 2) { cx += pts[i] / n; cy += pts[i + 1] / n; if (pts[i + 1] + pts[i] * 0.3 < pts[top + 1] + pts[top] * 0.3) top = i; }
  const nx = (top + 2) % pts.length, pv = (top - 2 + pts.length) % pts.length;
  paint(x, pP(pts), base, k, { sh: 0.4, li: 0.32, fn: () => {
    x.fillStyle = 'rgba(255,240,225,0.2)'; x.fill(pP([cx, cy, pts[pv], pts[pv + 1], pts[top], pts[top + 1], pts[nx], pts[nx + 1]]));
    line(x, [cx, cy, pts[pv], pts[pv + 1]], LW * 0.6, 'rgba(40,24,40,0.35)'); line(x, [cx, cy, pts[nx], pts[nx + 1]], LW * 0.6, 'rgba(40,24,40,0.35)');
  } });
}

// ── 적 도안 (100 공간, 원점 = 몸 중심, 정면 = 아래) ──
const ART = {
  slime(x) {
    const body = PA(p => {
      p.moveTo(-98, 62);
      p.bezierCurveTo(-108, -18, -66, -92, -12, -95);
      p.quadraticCurveTo(0, -112, 30, -126);
      p.quadraticCurveTo(22, -104, 30, -92);
      p.bezierCurveTo(78, -80, 108, -22, 98, 62);
      p.quadraticCurveTo(96, 90, 62, 90); p.lineTo(-62, 90); p.quadraticCurveTo(-96, 90, -98, 62);
      p.closePath();
    });
    paint(x, body, '#46d65c', 100, { sh: 0.34, li: 0.26, fn: () => {
      x.fillStyle = 'rgba(20,120,50,0.35)'; x.fill(pE(0, 78, 78, 18));
      x.fillStyle = 'rgba(210,255,190,0.5)';
      for (const [bx, by, br] of [[58, 30, 9], [70, 8, 5], [-66, 44, 6], [40, 58, 4]]) x.fill(pC(bx, by, br));
    } });
    gloss(x, -52, -48, 24, 12, -0.8, 0.9);
    eye(x, -36, -6, 18, 22, '#1f6a34');
    eye(x, 36, -6, 18, 22, '#1f6a34');
    blush(x, 0, 26, 58, 13);
    mouth(x, 0, 28, 14, 0.5);
  },
  mushroom(x) {
    for (const s of [-1, 1]) paint(x, pE(s * 34, 86, 24, 13), '#9a6440', 22);
    const stem = pR(-54, -22, 108, 106, 38);
    paint(x, stem, '#fff0d6', 60, { sh: 0.22 });
    eye(x, -24, 28, 13, 16, '#6a3a1e');
    eye(x, 24, 28, 13, 16, '#6a3a1e');
    brows(x, 0, 6, 8, 20, 8, LW * 1.1);
    blush(x, 0, 52, 40, 10);
    mouth(x, 0, 56, 10, 0.25, { tongue: false });
    const cap = PA(p => {
      p.moveTo(-122, 8);
      p.bezierCurveTo(-126, -72, -64, -122, 0, -122);
      p.bezierCurveTo(64, -122, 126, -72, 122, 8);
      p.quadraticCurveTo(100, 18, 70, 6); p.quadraticCurveTo(36, -6, 0, -4); p.quadraticCurveTo(-36, -6, -70, 6); p.quadraticCurveTo(-100, 18, -122, 8);
      p.closePath();
    });
    paint(x, cap, '#f0364a', 120, { sh: 0.34, li: 0.3, fn: () => {
      for (const [dx, dy, rw, rh] of [[-60, -64, 21, 16], [8, -96, 16, 11], [62, -58, 19, 15], [-14, -46, 11, 9], [-100, -20, 10, 8], [100, -18, 10, 8], [34, -30, 8, 6]]) {
        paint(x, pE(dx, dy, rw, rh), '#fff6ea', rw, { sh: 0.12, li: 0, rim: 0, lw: LW * 0.7 });
      }
    } });
    gloss(x, -46, -90, 20, 8, -0.4, 0.7);
  },
  goblin(x) {
    // 발·몸
    for (const s of [-1, 1]) paint(x, pE(s * 26, 90, 18, 11), '#5a3a20', 18);
    paint(x, pR(-44, 20, 88, 68, 26), '#8a5a34', 50);
    paint(x, pR(-46, 58, 92, 12, 5), '#4a2e18', 20);
    paint(x, pC(0, 64, 7), '#ffd23a', 7, { lw: LW * 0.7 });
    for (const s of [-1, 1]) paint(x, pC(s * 56, 50, 15), '#7fcf4a', 15);
    // 귀 (가장 큰 돌출부)
    for (const s of [-1, 1]) {
      const ear = pP([s * 42, -40, s * 152, -82, s * 118, -44, s * 58, 8]);
      paint(x, ear, '#7fcf4a', 50, { fn: () => { x.fillStyle = '#e8928a'; x.fill(pP([s * 56, -30, s * 128, -70, s * 104, -40, s * 60, -4])); } });
    }
    const head = pC(0, -16, 72);
    paint(x, head, '#86d450', 72);
    // 머리 가시털
    paint(x, pP([-30, -80, -18, -108, -6, -84, 6, -112, 18, -84, 32, -102, 36, -74]), '#3a2a4a', 30, { li: 0.35 });
    eye(x, -28, -18, 19, 21, '#ffc21e', { ir: 0.7 });
    eye(x, 28, -18, 19, 21, '#ffc21e', { ir: 0.7 });
    brows(x, 0, -44, 6, 30, 16, LW * 1.6);
    paint(x, pE(0, 8, 11, 8), '#5fae34', 10, { lw: LW * 0.8 });
    mouth(x, 0, 24, 30, 0.35, { fangs: true, tongue: false, col: '#4a1422' });
    // 단검 (왼손, 바깥으로 치켜듦 — 귀 아래로 보이게 맨 앞)
    x.save(); x.translate(-60, 46); x.rotate(-0.95);
    paint(x, pP([-7, -6, 7, -6, 5, -60, 0, -72, -5, -60]), '#e8eef8', 40, { sh: 0.3 });
    paint(x, pR(-15, -8, 30, 9, 4), '#a8703a', 12);
    x.restore();
    paint(x, pC(-58, 48, 14), '#7fcf4a', 14);
  },
  wolf(x) {
    for (const s of [-1, 1]) {
      paint(x, pE(s * 36, 86, 22, 14), '#b8c2d4', 22);
      for (const k of [-1, 0, 1]) line(x, [s * 36 + k * 8, 80, s * 36 + k * 8, 92], LW * 0.7);
    }
    paint(x, pE(0, 56, 60, 40), '#8a96ae', 60);
    x.save(); x.translate(0, -16);
    for (const s of [-1, 1]) {
      paint(x, pP([s * 24, -64, s * 84, -140, s * 94, -46]), '#6f7c96', 50, { fn: () => { x.fillStyle = '#f0a6b4'; x.fill(pP([s * 40, -64, s * 80, -118, s * 84, -58])); } });
    }
    const head = PA(p => {
      p.moveTo(0, -88); p.bezierCurveTo(62, -88, 94, -42, 90, 0);
      p.lineTo(108, 14); p.lineTo(84, 22); p.quadraticCurveTo(72, 50, 40, 60); p.lineTo(0, 68);
      p.lineTo(-40, 60); p.quadraticCurveTo(-72, 50, -84, 22); p.lineTo(-108, 14); p.lineTo(-90, 0);
      p.bezierCurveTo(-94, -42, -62, -88, 0, -88); p.closePath();
    });
    paint(x, head, '#c3ccdc', 90, { fn: () => {
      x.fillStyle = '#7d8aa6';
      x.fill(PA(p => { p.moveTo(-70, -80); p.quadraticCurveTo(0, -110, 70, -80); p.quadraticCurveTo(40, -50, 0, -14); p.quadraticCurveTo(-40, -50, -70, -80); p.closePath(); }));
    } });
    for (const s of [-1, 1]) paint(x, pP([s * 60, 0, s * 112, 22, s * 76, 30, s * 96, 46, s * 56, 44]), '#dfe5ee', 30, { sh: 0.2 });
    paint(x, PA(p => { p.moveTo(-36, 8); p.quadraticCurveTo(0, -4, 36, 8); p.quadraticCurveTo(40, 58, 0, 70); p.quadraticCurveTo(-40, 58, -36, 8); p.closePath(); }), '#f4f6fa', 40, { sh: 0.22 });
    eye(x, -36, -28, 17, 15, '#ffb21e', { ir: 0.72 });
    eye(x, 36, -28, 17, 15, '#ffb21e', { ir: 0.72 });
    brows(x, 0, -46, 12, 30, 16, LW * 1.5);
    paint(x, PA(p => { p.moveTo(-18, 22); p.quadraticCurveTo(0, 14, 18, 22); p.quadraticCurveTo(14, 36, 0, 38); p.quadraticCurveTo(-14, 36, -18, 22); p.closePath(); }), '#2a1d3a', 16, { li: 0.5, lw: LW * 0.8 });
    x.fillStyle = '#fff'; x.fill(pE(-6, 23, 5, 2.6));
    mouth(x, 0, 50, 20, 0.35, { fangs: true, tongue: true, col: '#5a1030' });
    x.restore();
    // 목도리 (고블린단)
    paint(x, pP([-50, 52, 50, 52, 20, 100, 0, 88, -20, 100]), '#e8404e', 50, { fn: () => { x.fillStyle = '#fff'; for (const [a, b] of [[-26, 60], [10, 66], [-4, 80], [30, 58]]) x.fill(pC(a, b, 4)); } });
  },
  skeleton(x) {
    // 녹슨 칼 (뒤)
    x.save(); x.translate(64, 44); x.rotate(-0.7);
    paint(x, pP([-7, -8, 7, -8, 6, -92, 0, -104, -6, -92]), '#c8cdd8', 40, { fn: () => { x.fillStyle = 'rgba(170,90,40,0.55)'; x.fill(pE(3, -40, 5, 9)); x.fill(pE(-2, -70, 4, 6)); } });
    paint(x, pR(-18, -12, 36, 10, 4), '#8a5a30', 14);
    paint(x, pR(-5, -4, 10, 22, 4), '#4a2e18', 10);
    x.restore();
    for (const s of [-1, 1]) { boneLimb(x, s * 22, 50, s * 32, 82, 12); paint(x, pE(s * 34, 90, 16, 9), IVORY, 14); }
    // 골반 + 척추 + 갈비
    paint(x, pE(0, 50, 30, 14), IVORY, 26);
    paint(x, pR(-40, 2, 80, 44, 20), '#3b2f46', 40, { li: 0.2, sh: 0.2 });
    x.save(); x.clip(pR(-40, 2, 80, 44, 20));
    for (let i = 0; i < 3; i++) curve(x, -34 + i * 3, 12 + i * 12, 0, 22 + i * 12, 34 - i * 3, 12 + i * 12, 9, IVORY);
    x.restore();
    line(x, [0, 4, 0, 48], 8, IVORY);
    for (const s of [-1, 1]) boneLimb(x, s * 44, 8, s * 64, 44, 11);
    skull(x, 0, -34, 62, '#ff3a3a');
  },
  boneThrower(x) {
    // 망토 (보라)
    paint(x, PA(p => { p.moveTo(-52, -20); p.quadraticCurveTo(-78, 40, -80, 92); p.lineTo(-40, 80); p.lineTo(-10, 94); p.lineTo(20, 80); p.lineTo(52, 92); p.quadraticCurveTo(64, 30, 52, -20); p.closePath(); }), '#8e46d8', 70);
    for (const s of [-1, 1]) { boneLimb(x, s * 20, 50, s * 28, 82, 11); paint(x, pE(s * 30, 90, 14, 8), IVORY, 12); }
    paint(x, pR(-34, 4, 68, 40, 18), '#3b2f46', 36);
    x.save(); x.clip(pR(-34, 4, 68, 40, 18));
    for (let i = 0; i < 3; i++) curve(x, -30, 14 + i * 11, 0, 22 + i * 11, 30, 14 + i * 11, 8, IVORY);
    x.restore();
    boneLimb(x, -42, 6, -58, 42, 10);
    // 치켜든 팔 + 던질 뼈
    boneLimb(x, 42, 2, 74, -44, 10);
    boneLimb(x, 50, -84, 104, -46, 15);
    skull(x, 0, -34, 58, '#ffae2a');
    // 두건
    const hood = PA(p => { p.moveTo(-66, -26); p.bezierCurveTo(-74, -110, 74, -110, 66, -26); p.quadraticCurveTo(60, -70, 0, -76); p.quadraticCurveTo(-60, -70, -66, -26); p.closePath(); });
    paint(x, hood, '#a45cf0', 70, { sh: 0.4 });
    paint(x, pP([-60, -64, -104, -40, -92, -78]), '#8e46d8', 30);
  },
  shieldSkel(x) {
    for (const s of [-1, 1]) { boneLimb(x, s * 22, 56, s * 30, 84, 12); paint(x, pE(s * 32, 92, 16, 9), IVORY, 14); }
    skull(x, 0, -40, 58, '#ff3a3a', { crack: false });
    // 투구 + 붉은 깃
    paint(x, PA(p => { p.moveTo(-8, -98); p.quadraticCurveTo(-6, -150, 40, -150); p.quadraticCurveTo(14, -130, 14, -98); p.closePath(); }), '#e83a4a', 30);
    const helm = PA(p => { p.moveTo(-66, -38); p.bezierCurveTo(-70, -118, 70, -118, 66, -38); p.lineTo(40, -44); p.lineTo(8, -40); p.lineTo(8, -10); p.lineTo(-8, -10); p.lineTo(-8, -40); p.lineTo(-40, -44); p.closePath(); });
    paint(x, helm, '#a8b6cc', 70, { sh: 0.4, li: 0.35 });
    paint(x, pR(-70, -52, 140, 14, 7), '#6a7892', 40);
    for (const k of [-48, -24, 24, 48]) paint(x, pC(k, -45, 4), '#ffd84a', 4, { lw: LW * 0.6 });
    // 방패 (큰 원, 파랑 + 금테 + 별 문장)
    const sh = pC(0, 40, 74);
    paint(x, sh, '#9aa8c0', 74, { sh: 0.4 });
    const inner = pC(0, 40, 58);
    paint(x, inner, '#3f6ad0', 58, { sh: 0.38, li: 0.3 });
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8; paint(x, pC(Math.cos(a) * 66, 40 + Math.sin(a) * 66, 4.5), '#ffd84a', 4, { lw: LW * 0.6 }); }
    const star = PA(p => { for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 14 : 32; k ? p.lineTo(Math.cos(a) * rr, 40 + Math.sin(a) * rr) : p.moveTo(Math.cos(a) * rr, 40 + Math.sin(a) * rr); } p.closePath(); });
    paint(x, star, '#ffd23a', 30, { li: 0.45 });
    gloss(x, -32, 6, 16, 7, -0.7, 0.55);
    // 방패 잡은 손
    for (const s of [-1, 1]) paint(x, pC(s * 72, 30, 11), IVORY, 11);
  },
  imp(x) {
    // 꼬리
    x.beginPath(); x.moveTo(40, 60); x.quadraticCurveTo(110, 70, 96, 0);
    x.lineWidth = 14 + LW * 2; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 14; x.strokeStyle = '#e8502e'; x.stroke();
    paint(x, pP([96, -30, 80, 4, 112, 4]), '#e8502e', 16);
    for (const s of [-1, 1]) paint(x, pE(s * 30, 88, 18, 11), '#c8381e', 18);
    const body = pC(0, 6, 78);
    paint(x, body, '#ff6a3a', 78, { sh: 0.36, fn: () => { x.fillStyle = '#ffc07a'; x.fill(pE(0, 52, 46, 34)); } });
    for (const s of [-1, 1]) {
      horn(x, s, s * 36, -56, s * 62, -108, 12, '#fff1d6', '#8a5a3a');
      paint(x, pC(s * 70, 44, 14), '#ff6a3a', 14);
    }
    // 머리 위 불꽃 한 줄기 (촛불처럼)
    const fl = PA(p => { p.moveTo(-22, -70); p.quadraticCurveTo(-30, -104, -4, -150); p.quadraticCurveTo(0, -120, 14, -118); p.quadraticCurveTo(26, -100, 22, -70); p.quadraticCurveTo(0, -60, -22, -70); p.closePath(); });
    paint(x, fl, '#ff7a1e', 40, { li: 0.55, sh: 0.2, fn: () => { x.fillStyle = '#ffe45a'; x.fill(PA(p => { p.moveTo(-10, -72); p.quadraticCurveTo(-14, -96, -2, -122); p.quadraticCurveTo(2, -100, 10, -96); p.quadraticCurveTo(14, -84, 10, -72); p.closePath(); })); } });
    eye(x, -28, -12, 19, 21, '#ffe23a', { ir: 0.68, slit: true });
    eye(x, 28, -12, 19, 21, '#ffe23a', { ir: 0.68, slit: true });
    brows(x, 0, -38, 8, 30, 16, LW * 1.5);
    mouth(x, 0, 26, 26, 0.4, { fangs: true, tongue: false });
  },
  bomber(x) {
    // 도화선
    x.beginPath(); x.moveTo(0, -84); x.bezierCurveTo(6, -120, 44, -110, 38, -140);
    x.lineWidth = 12 + LW * 2; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 12; x.strokeStyle = '#d8b07a'; x.stroke();
    paint(x, pR(-18, -96, 36, 16, 5), '#6a5a70', 18);
    const body = pC(0, 6, 92);
    // 녹은 속살 (빛남) 위에 현무암 판들 → 틈이 균열처럼 빛난다
    x.fillStyle = rad(x, 0, 16, 4, 92, [[0, '#fff4a0'], [0.35, '#ffb02e'], [1, '#e8401a']]);
    x.fill(body);
    x.save(); x.clip(body);
    const plates = [
      [-96, -60, -40, -92, -6, -54, -34, -12, -92, -4],
      [4, -90, 62, -78, 96, -30, 40, -18, 6, -46],
      [-98, 4, -40, 0, -52, 60, -80, 80, -102, 50],
      [48, -8, 100, -18, 100, 56, 62, 78, 40, 36],
      [-40, 70, 30, 50, 60, 90, 0, 110, -60, 100],
    ];
    for (const pl of plates) paint(x, pP(pl), '#76564c', 40, { sh: 0.35, li: 0.3, lw: LW * 0.9 });
    x.restore();
    // 발광 얼굴 (가운데 녹은 창)
    x.fillStyle = 'rgba(255,240,160,0.55)'; x.fill(pE(0, 22, 40, 26));
    for (const s of [-1, 1]) {
      x.save(); x.translate(s * 26, 6); x.rotate(s * 0.35);
      x.fillStyle = BLINK ? '#ffb02e' : '#fffbe0'; x.fill(pE(0, 0, 14, BLINK ? 2 : 6));
      x.restore();
      line(x, [s * 10, -10, s * 40, -22], LW * 1.6);
    }
    x.fillStyle = '#5a1a08'; x.fill(pP([-26, 30, -14, 40, 0, 30, 14, 40, 26, 30, 18, 50, -18, 50]));
    x.lineWidth = LW * 1.4; x.strokeStyle = INK2; x.stroke(body);
    gloss(x, -52, -56, 16, 7, -0.7, 0.35);
  },
  demon(x) {
    // 삼지창 (오른쪽 뒤)
    x.save(); x.translate(70, 40); x.rotate(0.12);
    paint(x, pR(-5, -140, 10, 150, 5), '#5a3a2a', 10);
    paint(x, PA(p => { p.moveTo(-26, -134); p.lineTo(-24, -170); p.lineTo(-14, -142); p.lineTo(-4, -146); p.lineTo(0, -182); p.lineTo(4, -146); p.lineTo(14, -142); p.lineTo(24, -170); p.lineTo(26, -134); p.closePath(); }), '#c8cfdc', 30);
    x.restore();
    for (const s of [-1, 1]) paint(x, pE(s * 26, 88, 18, 11), '#2a1a30', 18);
    paint(x, pR(-46, 14, 92, 72, 24), '#3a2a52', 50, { fn: () => { x.fillStyle = '#ffc93a'; x.fillRect(-46, 52, 92, 8); } });
    paint(x, pP([0, 22, -12, 40, 0, 58, 12, 40]), '#ff3a5c', 16, { li: 0.5, lw: LW * 0.8 });
    for (const s of [-1, 1]) {
      paint(x, pC(s * 62, 60, 14), '#e8405a', 14);
      const pd = pE(s * 54, 16, 30, 22);
      paint(x, pd, '#4a3a66', 30);
      paint(x, pP([s * 44, 0, s * 70, -30, s * 70, 4]), '#e8dcc8', 14, { lw: LW * 0.8 });
    }
    const head = pC(0, -30, 60);
    paint(x, head, '#e8405a', 60);
    for (const s of [-1, 1]) horn(x, s, s * 36, -70, s * 92, -128, 13);
    // 투구 반쪽
    paint(x, PA(p => { p.moveTo(-60, -40); p.bezierCurveTo(-62, -100, 62, -100, 60, -40); p.quadraticCurveTo(0, -60, -60, -40); p.closePath(); }), '#3a2a52', 60, { fn: () => { x.fillStyle = '#ffc93a'; x.fill(pP([-6, -80, 6, -80, 0, -52])); } });
    for (const s of [-1, 1]) glowEye(x, s * 22, -26, 13, 10, '#ffd21e', s * 0.3);
    brows(x, 0, -40, 6, 22, 14, LW * 1.4);
    mouth(x, 0, 0, 20, 0.25, { fangs: true, tongue: false });
  },
  wraith(x) {
    const robe = PA(p => {
      p.moveTo(0, -104);
      p.bezierCurveTo(74, -104, 90, -24, 80, 50);
      p.quadraticCurveTo(70, 80, 58, 110); p.quadraticCurveTo(38, 74, 20, 100); p.quadraticCurveTo(2, 66, -18, 98);
      p.quadraticCurveTo(-38, 72, -56, 108); p.quadraticCurveTo(-68, 80, -80, 50);
      p.bezierCurveTo(-90, -24, -74, -104, 0, -104); p.closePath();
    });
    paint(x, robe, '#62cce8', 90, { sh: 0.4, li: 0.35 });
    // 소매 + 뼈 손 (앞으로 뻗음)
    for (const s of [-1, 1]) {
      paint(x, PA(p => { p.moveTo(s * 56, -4); p.quadraticCurveTo(s * 110, 6, s * 104, 46); p.lineTo(s * 76, 40); p.quadraticCurveTo(s * 76, 20, s * 50, 20); p.closePath(); }), '#4cb6d8', 40);
      for (const k of [-1, 0, 1]) boneLimb(x, s * 92 + k * 7, 46, s * 94 + k * 9, 66, 5);
    }
    // 두건 속 어둠 + 눈
    const hood = pE(0, -40, 50, 46);
    x.fillStyle = rad(x, 0, -34, 0, 50, [[0, '#050814'], [1, '#1c2c54']]); x.fill(hood);
    x.lineWidth = LW; x.strokeStyle = INK2; x.stroke(hood);
    for (const s of [-1, 1]) glowEye(x, s * 20, -36, 12, 9, '#ff5af0', -s * 0.3);
    // 가슴 영혼 구슬
    paint(x, pC(0, 30, 16), '#e89aff', 16, { li: 0.55, fn: () => { x.fillStyle = '#fff'; x.fill(pC(-5, 25, 5)); } });
    gloss(x, -44, -80, 16, 7, -0.8, 0.6);
    // 아래로 흐려지는 꼬리
    x.save(); x.globalCompositeOperation = 'destination-out';
    x.fillStyle = lin(x, 0, 50, 0, 115, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.75)']]);
    x.fillRect(-120, 50, 240, 70);
    x.restore();
  },

  // ── 네임드 보스 (100 공간, 시각 반경 ≥ 110 월드) ──
  kingSlime(x) {
    // 왕홀 (오른쪽 촉수가 쥠)
    x.save(); x.translate(92, 18); x.rotate(0.28);
    paint(x, pR(-5, -100, 10, 110, 5), '#e0a020', 10, { li: 0.5 });
    paint(x, pC(0, -110, 17), '#ff3b5c', 17, { li: 0.45, fn: () => { x.fillStyle = '#fff'; x.fill(pC(-5, -116, 5)); } });
    for (const s of [-1, 1]) paint(x, pP([0, -96, s * 16, -86, s * 12, -100]), '#ffc93a', 10, { lw: LW * 0.8 });
    x.restore();
    const body = PA(p => {
      p.moveTo(-100, 58);
      p.bezierCurveTo(-110, -30, -68, -98, 0, -98);
      p.bezierCurveTo(68, -98, 110, -30, 100, 58);
      p.quadraticCurveTo(98, 92, 64, 92); p.lineTo(-64, 92); p.quadraticCurveTo(-98, 92, -100, 58); p.closePath();
    });
    paint(x, body, '#3f8cff', 100, { sh: 0.36, li: 0.26, fn: () => {
      x.fillStyle = 'rgba(20,50,160,0.35)'; x.fill(pE(0, 80, 80, 18));
      x.fillStyle = 'rgba(210,235,255,0.55)';
      for (const [bx, by, br] of [[56, 40, 8], [66, 16, 5], [-64, 50, 6], [36, 66, 4], [-30, 70, 5], [74, -20, 4]]) x.fill(pC(bx, by, br));
    } });
    // 망토 칼라 (흰 담비털)
    const col = PA(p => { p.moveTo(-98, 60); p.quadraticCurveTo(0, 104, 98, 60); p.quadraticCurveTo(100, 84, 64, 94); p.lineTo(-64, 94); p.quadraticCurveTo(-100, 84, -98, 60); p.closePath(); });
    paint(x, col, '#f6f2ea', 40, { sh: 0.2, fn: () => { x.fillStyle = INK2; for (let k = -3; k <= 3; k++) x.fill(pP([k * 24, 80, k * 24 - 3, 88, k * 24 + 3, 88])); } });
    gloss(x, -56, -52, 24, 11, -0.8, 0.9);
    eye(x, -34, -16, 19, 22, '#1a3a8a');
    eye(x, 34, -16, 19, 22, '#1a3a8a');
    brows(x, 0, -48, 12, 30, 12, LW * 1.8);
    blush(x, 0, 18, 60, 13);
    mouth(x, 0, 30, RAGE ? 22 : 16, RAGE ? 0.9 : 0.45, { teeth: RAGE });
    // 콧수염
    for (const s of [-1, 1]) {
      const m = PA(p => { p.moveTo(0, 16); p.bezierCurveTo(s * 18, 6, s * 34, 18, s * 50, 8); p.quadraticCurveTo(s * 56, 4, s * 52, 16); p.bezierCurveTo(s * 40, 32, s * 16, 26, 0, 26); p.closePath(); });
      paint(x, m, '#fff3dc', 24, { sh: 0.25 });
    }
    crown(x, 6, -86, 92, 62, 0.12);
  },
  goblinChariot(x) {
    // 깃발 두 개 (뒤)
    for (const s of [-1, 1]) {
      paint(x, pR(s * 70 - 3, -150, 6, 110, 3), '#5a3a20', 6);
      const fl = PA(p => { p.moveTo(s * 70, -150); p.quadraticCurveTo(s * 100, -160, s * 126, -138); p.lineTo(s * 116, -124); p.lineTo(s * 128, -110); p.quadraticCurveTo(s * 100, -118, s * 70, -106); p.closePath(); });
      paint(x, fl, '#e83a3a', 40, { fn: () => { x.fillStyle = '#ffe07a'; x.fill(pC(s * 96, -130, 9)); } });
    }
    // 바퀴
    for (const s of [-1, 1]) {
      const wh = pE(s * 96, 16, 26, 66);
      paint(x, wh, '#8a5a34', 40, { sh: 0.4 });
      x.save(); x.clip(wh);
      for (let k = -3; k <= 3; k++) line(x, [s * 72, 16 + k * 18, s * 120, 16 + k * 18], LW, '#4a2e18');
      x.restore();
      x.lineWidth = LW * 3; x.strokeStyle = '#8a95a8'; x.stroke(wh);
      x.lineWidth = LW; x.strokeStyle = INK2; x.stroke(wh);
      paint(x, pE(s * 96, 16, 9, 16), '#c8cfdc', 12);
    }
    // 운전수 고블린 (수레 위로)
    x.save(); x.translate(0, -12);
    for (const s of [-1, 1]) paint(x, pP([s * 18, -88, s * 70, -118, s * 30, -64]), '#7fcf4a', 30);
    paint(x, pC(0, -74, 34), '#86d450', 34);
    paint(x, PA(p => { p.moveTo(-36, -76); p.bezierCurveTo(-38, -122, 38, -122, 36, -76); p.closePath(); }), '#8a95a8', 36, { li: 0.4 });
    for (const s of [-1, 1]) horn(x, s, s * 22, -104, s * 40, -134, 6);
    for (const s of [-1, 1]) {
      paint(x, pE(s * 13, -72, 11, 9), '#6a5a70', 10);
      x.fillStyle = '#ffe45a'; x.fill(pE(s * 13, -72, 6, 5));
    }
    mouth(x, 0, -54, 14, 0.4, { fangs: true, tongue: false });
    x.restore();
    // 수레 본체
    const cart = PA(p => { p.moveTo(-86, -54); p.lineTo(86, -54); p.lineTo(78, 60); p.quadraticCurveTo(0, 74, -78, 60); p.closePath(); });
    paint(x, cart, '#b87a44', 86, { fn: () => {
      for (let k = -3; k <= 3; k++) line(x, [k * 24, -54, k * 22, 70], LW * 0.7, '#7a4a24');
      x.fillStyle = '#6a7486'; x.fillRect(-90, -36, 180, 12); x.fillRect(-90, 30, 180, 12);
      x.fillStyle = '#e8ecf4'; for (let k = -3; k <= 3; k++) { x.fill(pC(k * 26, -30, 3.5)); x.fill(pC(k * 26, 36, 3.5)); }
    } });
    // 앞 가시
    for (let k = -3; k <= 3; k++) paint(x, pP([k * 24 - 8, -54, k * 24, -76, k * 24 + 8, -54]), '#d8dee8', 12, { lw: LW * 0.8 });
    // 해골 문장
    skull(x, 0, 0, 22, '#ff3a3a', { crack: false });
    // 충각 (성벽 쪽으로 뾰족)
    paint(x, pR(-18, 54, 36, 56, 10), '#7a4a24', 20, { fn: () => { x.fillStyle = '#5a6478'; x.fillRect(-20, 66, 40, 8); x.fillRect(-20, 88, 40, 8); } });
    const cap = PA(p => { p.moveTo(-28, 104); p.quadraticCurveTo(-28, 138, 0, 142); p.quadraticCurveTo(28, 138, 28, 104); p.closePath(); });
    paint(x, cap, '#8a95a8', 30, { li: 0.4 });
    for (const [sx, sy, ex, ey] of [[-20, 128, -34, 146], [0, 140, 0, 160], [20, 128, 34, 146]]) paint(x, pP([sx - 5, sy - 4, ex, ey, sx + 5, sy - 2]), '#e8ecf4', 8, { lw: LW * 0.7 });
    for (const s of [-1, 1]) paint(x, pP([s * 78, 40, s * 108, 70, s * 80, 60]), '#d8dee8', 14, { lw: LW * 0.8 });
    // 횃불
    for (const s of [-1, 1]) {
      paint(x, pR(s * 80 - 4, -76, 8, 26, 3), '#5a3a20', 6);
      paint(x, PA(p => { p.moveTo(s * 80 - 9, -76); p.quadraticCurveTo(s * 80 - 10, -96, s * 80, -110); p.quadraticCurveTo(s * 80 + 10, -96, s * 80 + 9, -76); p.closePath(); }), '#ffb02e', 14, { li: 0.5, lw: LW * 0.7 });
    }
  },
  lichLord(x) {
    // 지팡이 (오른쪽)
    paint(x, pR(70, -96, 11, 200, 5), '#4a2e40', 11);
    for (const a of [-0.7, -0.25, 0.25, 0.7]) {
      x.save(); x.translate(75, -96); x.rotate(a);
      paint(x, pP([-4, 0, 4, 0, 2, -34, 0, -40, -2, -34]), '#e8d8b8', 8, { lw: LW * 0.8 });
      x.restore();
    }
    paint(x, pC(75, -118, 20), '#5affc8', 20, { li: 0.6, fn: () => { x.fillStyle = '#ffffff'; x.fill(pC(68, -124, 7)); x.fillStyle = 'rgba(20,150,110,0.5)'; x.fill(pE(80, -104, 14, 6)); } });
    // 로브 (너덜너덜한 밑단)
    const robe = PA(p => {
      p.moveTo(-50, -30); p.lineTo(50, -30);
      p.quadraticCurveTo(84, 30, 96, 96); p.lineTo(72, 84); p.lineTo(58, 104); p.lineTo(38, 86); p.lineTo(18, 108); p.lineTo(0, 88);
      p.lineTo(-18, 108); p.lineTo(-38, 86); p.lineTo(-58, 104); p.lineTo(-72, 84); p.lineTo(-96, 96);
      p.quadraticCurveTo(-84, 30, -50, -30); p.closePath();
    });
    paint(x, robe, '#6a34b0', 90, { sh: 0.42, fn: () => {
      x.fillStyle = '#2a1044'; x.fill(pP([-18, -30, 18, -30, 30, 100, -30, 100]));
      x.lineWidth = LW * 1.6; x.strokeStyle = '#f0c040';
      x.beginPath(); x.moveTo(-18, -28); x.lineTo(-30, 96); x.moveTo(18, -28); x.lineTo(30, 96); x.stroke();
    } });
    paint(x, pP([-10, 14, 10, 14, 0, 36]), '#56f0c8', 12, { li: 0.5, lw: LW * 0.8 });
    // 뼈 어깨받이
    for (const s of [-1, 1]) {
      paint(x, pE(s * 54, -26, 30, 22), '#4a1f78', 30);
      for (const k of [0, 1, 2]) paint(x, pP([s * (34 + k * 14), -38, s * (40 + k * 16), -70 + k * 6, s * (48 + k * 14), -40]), IVORY, 14, { lw: LW * 0.8 });
      paint(x, pC(s * 76, 22, 13), IVORY, 13);
    }
    // 두건 + 해골 + 뼈 왕관
    const hood = PA(p => { p.moveTo(-54, -24); p.bezierCurveTo(-64, -118, 64, -118, 54, -24); p.quadraticCurveTo(0, -12, -54, -24); p.closePath(); });
    paint(x, hood, '#5a2a8a', 60, { sh: 0.4, fn: () => { x.lineWidth = LW * 2; x.strokeStyle = '#f0c040'; x.stroke(hood); } });
    x.lineWidth = LW; x.strokeStyle = INK2; x.stroke(hood);
    x.fillStyle = '#12061e'; x.fill(pE(0, -46, 40, 40));
    skull(x, 0, -52, 32, '#5ff0ff', { crack: false });
    crown(x, 0, -86, 62, 40);
  },
  magmaGolem(x) {
    const rock = (pts, k, base = '#806c66') => rockP(x, pts, k, base);
    for (const s of [-1, 1]) rock([s * 20, 70, s * 64, 66, s * 70, 104, s * 18, 106], 30, '#6e5c58');
    // 팔 + 주먹
    for (const s of [-1, 1]) {
      rock([s * 58, -44, s * 106, -40, s * 120, 10, s * 80, 22], 40);
      rock([s * 82, 8, s * 138, 20, s * 142, 76, s * 108, 96, s * 72, 74], 44, '#86706a');
    }
    // 몸통
    rock([-76, -60, 76, -60, 92, 30, 56, 92, -56, 92, -92, 30], 90);
    // 어깨 바위 + 작은 불꽃 분화구
    for (const s of [-1, 1]) {
      rock([s * 44, -70, s * 70, -92, s * 108, -76, s * 110, -40, s * 60, -40], 36, '#8e7872');
      paint(x, pE(s * 84, -80, 12, 5), '#ffb02e', 10, { li: 0.5, lw: LW * 0.7 });
    }
    // 머리 (작게, 몸에 박힘)
    rock([-32, -66, -24, -104, 24, -104, 32, -66, 0, -58], 34, '#8e7872');
    ART.magmaGolemGlow(x);
    x.fillStyle = INK2; x.fill(pP([-26, -96, 26, -96, 20, -86, -20, -86]));
  },
  // 균열 빛 (본체에 한 번 구워지고, 맥동용으로 따로 가산 합성)
  magmaGolemGlow(x) {
    lava(x, [
      [-60, -40, -30, -20, -35, 20, -10, 50, -20, 80],
      [60, -45, 35, -10, 45, 30, 20, 70],
      [-30, -20, 30, -10],
      [-120, 35, -95, 50, -105, 75],
      [120, 30, 95, 50, 110, 70],
      [-90, -25, -80, 0, -95, 10],
      [90, -25, 80, 0, 95, 10],
    ], 7);
    x.fillStyle = rad(x, 0, 6, 0, 34, [[0, 'rgba(255,245,170,0.98)'], [0.45, 'rgba(255,150,30,0.85)'], [1, 'rgba(255,60,0,0)']]);
    x.fill(pC(0, 6, 34));
    for (const s of [-1, 1]) {
      x.save(); x.translate(s * 11, -80); x.rotate(s * 0.3);
      x.fillStyle = '#fff4a0'; x.fill(pE(0, 0, 8, BLINK ? 1.5 : 4));
      x.restore();
    }
  },
  demonLord(x) {
    // 망토 (넓게 펼침)
    const cape = PA(p => {
      p.moveTo(-50, -40); p.quadraticCurveTo(-130, 0, -150, 96); p.lineTo(-118, 80); p.lineTo(-100, 104); p.lineTo(-74, 84); p.lineTo(-50, 104);
      p.lineTo(50, 104); p.lineTo(74, 84); p.lineTo(100, 104); p.lineTo(118, 80); p.lineTo(150, 96); p.quadraticCurveTo(130, 0, 50, -40); p.closePath();
    });
    paint(x, cape, '#b01830', 130, { sh: 0.45, fn: () => { x.lineWidth = LW * 2.2; x.strokeStyle = '#e0a830'; x.stroke(cape); } });
    x.lineWidth = LW; x.strokeStyle = INK2; x.stroke(cape);
    // 불꽃 대검 (오른쪽)
    x.save(); x.translate(92, 50); x.rotate(-0.3);
    paint(x, pP([-11, -10, 11, -10, 9, -150, 0, -170, -9, -150]), '#3a2a44', 40, { li: 0.35, fn: () => { x.fillStyle = '#ff3a2a'; for (let k = 0; k < 4; k++) x.fill(pP([-3, -34 - k * 30, 3, -34 - k * 30, 0, -48 - k * 30])); } });
    paint(x, pR(-30, -16, 60, 12, 5), '#e0a830', 30, { li: 0.45 });
    paint(x, pR(-6, -6, 12, 30, 5), '#4a2a1e', 10);
    x.restore();
    // 갑옷 몸통
    const ar = pR(-56, -34, 112, 124, 26);
    paint(x, ar, '#3a2440', 60, { sh: 0.4, li: 0.3, fn: () => {
      x.lineWidth = LW * 1.4; x.strokeStyle = '#e0a830';
      x.beginPath(); x.moveTo(-40, 56); x.lineTo(0, 76); x.lineTo(40, 56); x.moveTo(-44, 26); x.lineTo(44, 26); x.stroke();
    } });
    for (const s of [-1, 1]) paint(x, pP([s * 8, 60, s * 52, 60, s * 58, 96, s * 12, 100]), '#4a2e50', 30, { fn: () => { x.lineWidth = LW; x.strokeStyle = '#e0a830'; x.stroke(pP([s * 14, 66, s * 48, 66, s * 52, 90, s * 16, 93])); } });
    paint(x, pR(-58, 44, 116, 18, 7), '#2a1a24', 30, { li: 0.3 });
    skull(x, 0, 50, 13, '#ff3050', { crack: false });
    paint(x, pP([0, -6, -16, 14, 0, 38, 16, 14]), '#ff3050', 20, { li: 0.5 });
    // 어깨받이 + 가시
    for (const s of [-1, 1]) {
      for (const k of [0, 1, 2]) paint(x, pP([s * (44 + k * 16), -40 + k * 6, s * (52 + k * 22), -86 + k * 12, s * (60 + k * 16), -36 + k * 6]), IVORY, 16, { lw: LW * 0.8 });
      paint(x, pE(s * 62, -22, 34, 28), '#4a2e50', 34, { fn: () => { x.lineWidth = LW * 1.2; x.strokeStyle = '#e0a830'; x.stroke(pE(s * 62, -22, 26, 20)); } });
      paint(x, pC(s * 84, 56, 16), '#6a2238', 16);
    }
    // 뿔 (크게 휘어짐)
    for (const s of [-1, 1]) horn(x, s, s * 34, -72, s * 124, -150, 16, '#fff1d6', '#3a2030');
    // 머리
    const head = pC(0, -50, 46);
    paint(x, head, '#9a2a48', 46);
    for (const s of [-1, 1]) glowEye(x, s * 18, -52, 13, 8, '#ffd21e', s * 0.35);
    brows(x, 0, -66, 5, 24, 16, LW * 1.6);
    mouth(x, 0, -28, 16, RAGE ? 0.7 : 0.25, { fangs: true, tongue: false });
    // 불꽃 왕관
    for (let k = -2; k <= 2; k++) {
      const fx = k * 14, h = 44 - Math.abs(k) * 9;
      paint(x, PA(p => { p.moveTo(fx - 9, -80); p.quadraticCurveTo(fx - 11, -80 - h * 0.6, fx, -80 - h); p.quadraticCurveTo(fx + 11, -80 - h * 0.6, fx + 9, -80); p.closePath(); }), '#ff8a1e', 14, { li: 0.55, lw: LW * 0.8 });
    }
    paint(x, pR(-40, -86, 80, 12, 5), '#e0a830', 30, { li: 0.45 });
  },
  doomDragon(x) {
    // 꼬리 (위로 말림, 가시 끝)
    x.beginPath(); x.moveTo(0, -70); x.bezierCurveTo(-20, -130, 56, -136, 40, -178);
    x.lineWidth = 28 + LW * 2; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 28; x.strokeStyle = '#8a1a2a'; x.stroke();
    x.lineWidth = 8; x.strokeStyle = '#b8323f'; x.beginPath(); x.moveTo(-6, -76); x.bezierCurveTo(-22, -128, 48, -134, 34, -172); x.stroke();
    paint(x, pP([40, -206, 18, -168, 50, -174, 64, -160]), '#3a0a18', 22);
    // 몸통 (위쪽, 머리 뒤)
    const body = pE(0, -34, 66, 70);
    paint(x, body, '#b0283a', 70, { sh: 0.42 });
    for (let k = 0; k < 4; k++) paint(x, pP([-10, -96 + k * 24, 0, -114 + k * 24, 10, -96 + k * 24]), '#3a0a18', 10, { lw: LW * 0.8 });
    // 앞발 (발톱)
    for (const s of [-1, 1]) {
      paint(x, pE(s * 58, 26, 20, 28, s * 0.35), '#9a2030', 24);
      for (const k of [-1, 0, 1]) paint(x, pP([s * 60 + k * 9 - 4, 48, s * 60 + k * 9, 64, s * 60 + k * 9 + 4, 48]), '#fff1d6', 5, { lw: LW * 0.6 });
    }
    // 목
    paint(x, pR(-26, -4, 52, 60, 22), '#a0222f', 34, { fn: () => { x.fillStyle = '#f0c078'; x.fill(pR(-14, 0, 28, 56, 12)); for (let k = 0; k < 4; k++) line(x, [-14, 8 + k * 13, 14, 8 + k * 13], LW * 0.7, '#a86a30'); } });
    // 뿔 (머리 위에서 뒤·위로 휩쓸림)
    for (const s of [-1, 1]) horn(x, s, s * 30, 52, s * 84, -18, 11, '#fff1d6', '#2a1020');
    // 머리 (성벽 쪽 = 아래, 크게)
    const head = PA(p => {
      p.moveTo(-48, 58); p.quadraticCurveTo(-46, 36, 0, 34); p.quadraticCurveTo(46, 36, 48, 58);
      p.lineTo(56, 80); p.quadraticCurveTo(44, 92, 34, 104); p.quadraticCurveTo(30, 134, 16, 146); p.lineTo(-16, 146);
      p.quadraticCurveTo(-30, 134, -34, 104); p.quadraticCurveTo(-44, 92, -56, 80); p.closePath();
    });
    paint(x, head, '#c43040', 52, { sh: 0.4, li: 0.26 });
    // 뺨 가시
    for (const s of [-1, 1]) paint(x, pP([s * 52, 68, s * 80, 76, s * 56, 88]), '#3a0a18', 12, { lw: LW * 0.8 });
    // 주둥이 · 이빨 · 콧구멍
    const jaw = PA(p => { p.moveTo(-30, 112); p.quadraticCurveTo(0, RAGE ? 134 : 122, 30, 112); p.lineTo(22, 130); p.quadraticCurveTo(0, 150, -22, 130); p.closePath(); });
    paint(x, jaw, RAGE ? '#ffb03a' : '#8a1424', 26, { li: RAGE ? 0.5 : 0.2 });
    for (const s of [-1, 1]) for (const k of [0, 1]) paint(x, pP([s * (10 + k * 10), 112, s * (15 + k * 10), 112, s * (12 + k * 10), 124]), '#ffffff', 4, { lw: LW * 0.6 });
    for (const s of [-1, 1]) { x.fillStyle = INK2; x.fill(pE(s * 9, 138, 3.5, 2.2, s * 0.4)); }
    for (const s of [-1, 1]) glowEye(x, s * 24, 70, 13, 8, RAGE ? '#ff4a1e' : '#ffc21e', -s * 0.35);
    // 눈썹 뼈
    for (const s of [-1, 1]) paint(x, pP([s * 8, 56, s * 42, 50, s * 44, 60, s * 12, 66]), '#7a1422', 16, { lw: LW * 0.8 });
    paint(x, pP([-6, 40, 6, 40, 0, 60]), '#fff1d6', 8, { lw: LW * 0.7 });
  },
  unknown(x) {
    paint(x, pC(0, 0, 90), '#b27aff', 90);
    eye(x, -30, -10, 18, 20, '#3a1a6a');
    eye(x, 30, -10, 18, 20, '#3a1a6a');
  },
};

// 스프라이트 여백 (100 공간 반폭·반높이) · 발밑 피벗 (반경 비율)
const PAD = {
  slime: [112, 128], mushroom: [130, 128], goblin: [158, 118], wolf: [116, 160], skeleton: [96, 110], boneThrower: [112, 112], shieldSkel: [80, 154],
  imp: [118, 154], bomber: [100, 146], demon: [104, 186], wraith: [116, 116],
  kingSlime: [128, 158], goblinChariot: [134, 172], lichLord: [104, 144], magmaGolem: [146, 116], demonLord: [156, 176], doomDragon: [96, 212],
  magmaGolemGlow: [146, 110],
};
export const FEET = { doomDragon: 0.62, lichLord: 1.0, goblinChariot: 0.95, wraith: 1.0, kingSlime: 0.92 };
const VARIANT = { w: ['#ffffff', 1], f: ['#a8e8ff', 0.55], r: ['#ff2050', 1], c: ['#20e8ff', 1] };
// 테마별 키라이트 (림 색, 방향: 좌상단 / 화산은 아래) ART §2.2
const HOME = { slime: 0, mushroom: 0, kingSlime: 0, goblin: 1, wolf: 1, goblinChariot: 1, skeleton: 2, boneThrower: 2, shieldSkel: 2, lichLord: 2, imp: 3, bomber: 3, magmaGolem: 3, demon: 4, wraith: 4, demonLord: 4, doomDragon: 4 };
const KEY = [['#fff4c8', 1, 1], ['#bfe9ff', 1, 1], ['#d6ecff', 1, 1], ['#ffb46a', 0, -1.3], ['#e2c8ff', 1, 1]];
const NAMED = { kingSlime: 1, goblinChariot: 1, lichLord: 1, magmaGolem: 1, demonLord: 1, doomDragon: 1 };
// 시각 크기 (ART §3.4): 잡몹 ×1.7, 엘리트 ×1.75, 네임드 ×1.45 (최소 반경 124) — 보스는 화면을 채우는 존재감
export function visR(e) {
  return NAMED[e.type] && e.named !== false ? Math.max(e.r * 1.45, 124) : e.r * (e.elite ? 1.75 : 1.7);
}
const LINES = { n: [3.5, 2], e: [5, 3], b: [6.5, 3.5] };

// 굽기 후처리: 두꺼운 바깥 외곽선(팽창) + 우하단 그림자 초승달 + 키라이트 림 (월드 단위 고정)
function sil(src, col) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = col;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}
function crescent(src, dx, dy, col) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'destination-out';
  x.drawImage(src, dx, dy);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = col;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}
function finish(x, draw, L, rim, rimW, shadeW) {
  const c = x.canvas, k = x.getTransform().a; // 백킹 px / 월드
  const raw = document.createElement('canvas');
  raw.width = c.width; raw.height = c.height;
  const r = raw.getContext('2d');
  r.setTransform(x.getTransform());
  r.lineJoin = 'round'; r.lineCap = 'round';
  draw(r);
  x.save();
  x.setTransform(1, 0, 0, 1, 0, 0);
  if (L > 0) {
    const s = sil(raw, INK2), Lp = L * k;
    for (let i = 0; i < 16; i++) { const a = i * TAU / 16; x.drawImage(s, Math.cos(a) * Lp, Math.sin(a) * Lp); }
    for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.4; x.drawImage(s, Math.cos(a) * Lp * 0.55, Math.sin(a) * Lp * 0.55); }
  }
  x.drawImage(raw, 0, 0);
  if (shadeW) x.drawImage(crescent(raw, -shadeW * k, -shadeW * k * 1.2, 'rgba(34,22,58,0.26)'), 0, 0);
  if (rim) x.drawImage(crescent(raw, rim[1] * rimW * k, rim[2] * rimW * k, rim[0]), 0, 0);
  x.restore();
}

// type: ENEMY_TYPES/BOSSES 키, r: 판정 반경, v: 'n' 기본 | 'w' 흰색 | 'f' 빙결 | 'r'/'c' 색수차, cls: 'n' 잡몹 | 'e' 엘리트 | 'b' 네임드, pose: 0 기본 | 1 눈 감음 | 2 분노
export function enemy(type, r, v = 'n', cls, pose = 0) {
  const art = ART[type] ? type : 'unknown';
  cls = cls || (NAMED[art] ? 'b' : 'n');
  const vr = cls === 'b' ? Math.max(r * 1.45, 124) : r * (cls === 'e' ? 1.75 : 1.7); // visR 과 같게
  const rk = Math.max(4, Math.round(vr * 2) / 2);
  const key = `u:e|${art}|${rk}|${cls}|${pose}`;
  const n = cache.get(key) || bakeEnemy(key, art, rk, cls, pose);
  if (v === 'n' || !VARIANT[v]) return n;
  return tint(n, key + '|' + v, VARIANT[v][0], VARIANT[v][1]);
}
function bakeEnemy(key, art, rk, cls, pose) {
  const [L, D] = LINES[cls], u = rk / 100, pad = PAD[art] || [110, 110];
  const K = KEY[HOME[art] ?? 0];
  return bake(key, pad[0] * u + L + 2, pad[1] * u + L + 2, x => {
    finish(x, r => {
      r.scale(u, u);
      LW = D / u; BLINK = pose === 1; RAGE = pose === 2;
      ART[art](r);
      BLINK = RAGE = false;
    }, L, K, Math.min(5, Math.max(2, rk * 0.075)), rk * 0.1);
  });
}

// 따로 퍼덕이는 날개 (왼쪽 날개, 뿌리 = 원점, 100 공간). at = 몸 중심 기준 뿌리 위치
const WINGS = {
  imp: { at: [-40, -10], hw: 120, hh: 84, draw(x) {
    const w = PA(p => { p.moveTo(6, -8); p.quadraticCurveTo(-40, -70, -112, -76); p.quadraticCurveTo(-98, -50, -106, -28); p.quadraticCurveTo(-84, -34, -80, -12); p.quadraticCurveTo(-62, -22, -54, 4); p.quadraticCurveTo(-30, -6, 6, 12); p.closePath(); });
    paint(x, w, '#e0405a', 60, { sh: 0.42, li: 0.25, fn: () => { for (const [tx, ty] of [[-112, -76], [-106, -28], [-80, -12], [-54, 4]]) curve(x, 0, 0, tx * 0.5, ty * 0.5 - 16, tx, ty, LW * 1.1, '#7a1030'); } });
  } },
};
function wingTex(type, r, cls) {
  const W = WINGS[type], vr = cls === 'e' ? r * 1.75 : r * 1.7, rk = Math.round(vr * 2) / 2, u = rk / 100, [L, D] = LINES[cls];
  return bake(`u:wg|${type}|${rk}|${cls}`, W.hw * u + L + 2, W.hh * u + L + 2, x => {
    finish(x, q => { q.scale(u, u); LW = D / u; W.draw(q); }, L, KEY[HOME[type] ?? 0], 2, 0);
  });
}

// 드래곤 날개 (왼쪽 날개, 뿌리가 오른쪽 끝 중앙). rk = 시각 반경
export function dragonWing(r) {
  const rk = Math.round(r * 2) / 2, u = rk / 100;
  return bake('u:wing|' + rk, rk * 0.84 + 8, rk * 0.8 + 8, x => {
    finish(x, q => {
      q.scale(u, u); q.translate(80, 0);
      LW = 3.5 / u;
      const tips = [[-155, -60], [-146, -6], [-122, 40], [-82, 64]];
      const wing = PA(p => {
        p.moveTo(0, -16);
        p.quadraticCurveTo(-70, -84, tips[0][0], tips[0][1]);
        for (let k = 1; k < tips.length; k++) {
          const [px, py] = tips[k - 1], [qx, qy] = tips[k];
          p.quadraticCurveTo((px + qx) / 2 + 22, (py + qy) / 2 - 4, qx, qy);
        }
        p.quadraticCurveTo(-40, 32, 0, 20);
        p.closePath();
      });
      paint(q, wing, '#8a1a3a', 90, { sh: 0.45, li: 0.25, fn: () => {
        q.fillStyle = 'rgba(255,90,60,0.25)'; q.fill(pE(-70, 10, 50, 30));
      } });
      for (const [tx, ty] of tips) { q.beginPath(); q.moveTo(-8, -10); q.quadraticCurveTo(tx * 0.5, ty * 0.5 - 24, tx, ty); q.lineWidth = LW * 2.2; q.strokeStyle = '#3a0a18'; q.stroke(); }
      paint(q, pP([tips[0][0], tips[0][1], tips[0][0] - 10, tips[0][1] - 18, tips[0][0] + 8, tips[0][1] - 4]), IVORY, 10, { lw: LW * 0.8 });
    }, 5, KEY[4], 3, 6);
  });
}

export function golemGlow(r) {
  const rk = Math.round(r * 2) / 2, u = rk / 100;
  return bake('u:ggl|' + rk, 146 * u + 8, 110 * u + 8, x => { x.scale(u, u); LW = 3.5 / u; ART.magmaGolemGlow(x); });
}

export function bone() {
  return bake('u:bone', 14, 14, x => { LW = 1.4; boneLimb(x, -8, 0, 8, 0, 4.4); x.lineWidth = 1.6; x.strokeStyle = INK2; });
}

// 망령 (귀여운 유령, 오른쪽을 봄)
export function ghostSpr(col = '#d8c0ff') {
  return bake('u:gh|' + col, 19, 21, x => finish(x, x => {
    x.beginPath();
    x.moveTo(-12, 8);
    x.bezierCurveTo(-14, -8, -8, -16, 0, -16);
    x.bezierCurveTo(9, -16, 14, -8, 13, 4);
    x.quadraticCurveTo(12, 12, 16, 16);
    x.quadraticCurveTo(9, 15, 7, 11);
    x.quadraticCurveTo(4, 16, 0, 12);
    x.quadraticCurveTo(-5, 17, -8, 11);
    x.quadraticCurveTo(-11, 15, -12, 8);
    x.closePath();
    fs(x, lin(x, 0, -16, 0, 16, [[0, '#ffffff'], [0.45, col], [1, dim(col, 0.35)]]), 2.4, '#3a1466');
    ell(x, 1, -4, 2.2, 3); x.fillStyle = INK2; x.fill();
    ell(x, 7, -4, 2.2, 3); x.fill();
    circ(x, 0.5, -5, 0.8); x.fillStyle = '#fff'; x.fill();
    circ(x, 6.5, -5, 0.8); x.fill();
    ell(x, 4, 2, 1.8, 2.2); x.fillStyle = '#5a2a7a'; x.fill();
    x.fillStyle = 'rgba(255,120,200,0.5)'; ell(x, -2, 0, 2.2, 1.2); x.fill(); ell(x, 10, 0, 2.2, 1.2); x.fill();
    shine(x, -6, -10, 3, 1.6, -0.7, 0.85);
  }, 1, ['#ffffff', 1, 1], 1.2, 2));
}

// 새끼 드래곤 몸통 (오른쪽을 봄). holy = 수호룡(융합)
export function babyDragon(holy) {
  const B = holy ? ['#fff3c8', '#ffd35a', '#ffffff', '#e0a72e', '#3fa9ff'] : ['#ff8a4a', '#e84a3a', '#ffe8b0', '#b8321e', '#ffcc2a'];
  return bake('u:bd|' + (holy ? 1 : 0), 48, 38, x => finish(x, x => {
    x.beginPath(); x.moveTo(-12, 6); x.quadraticCurveTo(-30, 16, -38, 2); x.quadraticCurveTo(-34, 10, -12, 14); x.closePath();
    fs(x, B[0], 3, INK2);
    poly(x, [-38, 2, -44, -6, -35, -4, -40, 6]); fs(x, B[1], 2.4, INK2);
    for (const lx of [-6, 8]) { rrect(x, lx - 4, 12, 9, 10, 4); fs(x, cel(x, lx - 4, 12, lx + 5, 22, B[0]), 2.4, INK2); }
    ell(x, 0, 4, 19, 15); fs(x, cel(x, -19, -11, 19, 19, B[0]), 3.2, INK2);
    ell(x, 5, 8, 10, 9); fs(x, B[2], 2, INK2);
    x.strokeStyle = dim(B[2], 0.25); x.lineWidth = 1.2;
    for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(-2, 2 + k * 5); x.quadraticCurveTo(5, 4 + k * 5, 13, 2 + k * 5); x.stroke(); }
    for (let k = 0; k < 3; k++) { poly(x, [-14 + k * 8, -8 - k * 1.5, -10 + k * 8, -16 - k * 1.5, -6 + k * 8, -9 - k * 1.5]); fs(x, B[1], 2, INK2); }
    for (const s of [0, 1]) {
      poly(x, [10 + s * 9, -20, 6 + s * 9, -33, 15 + s * 9, -22]); fs(x, holy ? '#ffc92e' : '#fff3d0', 2.2, INK2);
    }
    circ(x, 18, -12, 15); fs(x, cel(x, 3, -27, 33, 3, B[0]), 3.2, INK2);
    ell(x, 31, -7, 10, 7.5); fs(x, cel(x, 21, -14, 41, 0, B[0]), 3, INK2);
    circ(x, 36, -9, 1.3); x.fillStyle = INK2; x.fill();
    x.beginPath(); x.moveTo(26, -3); x.quadraticCurveTo(32, 1, 39, -3); x.lineWidth = 1.8; x.strokeStyle = INK2; x.stroke();
    ell(x, 22, -15, 5, 6); fs(x, '#ffffff', 2, INK2);
    circ(x, 23.5, -14.5, 3.6); x.fillStyle = B[4]; x.fill();
    circ(x, 24, -14.5, 1.8); x.fillStyle = INK2; x.fill();
    circ(x, 22.3, -16.5, 1.5); x.fillStyle = '#fff'; x.fill();
    x.fillStyle = 'rgba(255,110,140,0.5)'; ell(x, 20, -6, 3, 1.6); x.fill();
    shine(x, 10, -20, 4, 2, -0.6, 0.7);
  }, 1.5, HERO_RIM, 1.5, 3));
}
// 새끼 드래곤 날개 (뿌리 = 원점, 위·뒤로 펼침)
export function babyWing(holy) {
  return bakeO('bw|' + (holy ? 1 : 0), 30, 18, 14, x => {
    x.beginPath();
    x.moveTo(0, 0);
    x.quadraticCurveTo(-4, -24, -26, -30);
    x.quadraticCurveTo(-22, -22, -28, -16);
    x.quadraticCurveTo(-20, -12, -24, -5);
    x.quadraticCurveTo(-12, -6, -10, 2);
    x.closePath();
    fs(x, lin(x, -26, -30, 0, 0, holy ? [[0, '#ffffff'], [1, '#ffd35a']] : [[0, '#ffb08a'], [1, '#e84a3a']]), 2.6, INK2);
    x.strokeStyle = holy ? '#e0a72e' : '#9a2a1e'; x.lineWidth = 1.4;
    x.beginPath(); x.moveTo(-2, -3); x.lineTo(-24, -26); x.moveTo(-3, -2); x.lineTo(-24, -15); x.moveTo(-4, 0); x.lineTo(-20, -5); x.stroke();
  });
}

// 돌 골렘 (발 = 원점, 정면)
const STONE = '#ab9e8e';
export function golemSpr() {
  return bakeO('u:golem', 66, 64, 50, x => finish(x, x => {
    LW = 2.4;
    const R = (pts, k, c = STONE) => rockP(x, pts, k, c);
    R([-28, -26, -8, -26, -6, 0, -30, 0], 14, '#978a7a');
    R([8, -26, 28, -26, 30, 0, 6, 0], 14, '#978a7a');
    for (const s of [-1, 1]) { R([s * 32, -84, s * 52, -80, s * 58, -48, s * 42, -40, s * 32, -58], 16); R([s * 40, -46, s * 60, -46, s * 62, -20, s * 52, -10, s * 36, -14, s * 34, -30], 16, '#b8ab9a'); }
    R([-36, -88, 36, -88, 44, -54, 32, -20, -32, -20, -44, -54], 44);
    // 소환 룬 균열 (분홍 발광)
    x.lineWidth = 6; x.strokeStyle = '#8a1f7a';
    x.beginPath(); x.moveTo(0, -78); x.lineTo(-7, -62); x.lineTo(6, -50); x.lineTo(-1, -32); x.moveTo(-7, -62); x.lineTo(-22, -58); x.moveTo(6, -50); x.lineTo(20, -46); x.stroke();
    x.lineWidth = 2.6; x.strokeStyle = '#ffb0ee'; x.stroke();
    paint(x, pC(0, -56, 8), '#ff8ae0', 8, { li: 0.6, lw: 2.2, fn: () => { x.fillStyle = '#fff'; x.fill(pC(-2, -58, 3)); } });
    // 이끼
    for (const [mx, my, rw] of [[-24, -88, 13], [22, -89, 10], [-48, -82, 7]]) paint(x, pE(mx, my, rw, rw * 0.38), '#6fbf4a', rw, { lw: 1.6 });
    x.fillStyle = '#b8f08a'; x.fill(pE(-27, -90, 5, 1.6));
    // 머리
    R([-15, -108, 15, -108, 19, -88, -19, -88], 16, '#c2b6a4');
    paint(x, pR(-12, -102, 24, 7, 3), '#2a1030', 8, { li: 0, sh: 0, rim: 0, lw: 1.4 });
    for (const s of [-1, 1]) { x.fillStyle = BLINK ? '#8a3a7a' : '#ffc0f4'; x.fill(pE(s * 5.5, -98.5, 3.8, 2)); }
  }, 4.5, ['#fff0fa', 1, 1], 2, 3));
}
export function rubbleSpr() {
  return bakeO('rubble', 58, 22, 16, x => {
    const rnd = mulberry(31);
    for (let k = 0; k < 9; k++) {
      const cx = -44 + k * 11 + rnd() * 6, cy = -6 - rnd() * 14 + Math.abs(k - 4) * 2, s = 8 + rnd() * 7, pts = [];
      for (let p = 0; p < 6; p++) { const a = p * TAU / 6 + rnd() * 0.4; pts.push(cx + Math.cos(a) * s, cy + Math.sin(a) * s * 0.75); }
      poly(x, pts); fs(x, cel(x, cx - s, cy - s, cx + s, cy + s, STONE), 3, INK2);
    }
  });
}

// ── 성벽 마법사 2명 (P1 금빛·화염 / P2 청록·냉기) ──
export const MAGE_PAL = [
  { robe: '#c8263e', trim: '#ffc92e', trimD: '#a8600a', inner: '#fff1d6', hat: '#b01e3a', lining: '#ffb020', hair: '#f6f2ff', iris: '#ff8a1e', orb: ['#fff2a0', '#ffb030', '#b3230f'] },
  { robe: '#2a74d0', trim: '#c8f6ff', trimD: '#3a7ab0', inner: '#e4f8ff', hat: '#1f5cb0', lining: '#7fe3ff', hair: '#8fe0ff', iris: '#2ad0ff', orb: ['#ffffff', '#7fe3ff', '#2a78e0'] },
];
export const STAFF_ORB = [{ y: -58, r: 7 }, { y: -59, r: 8 }, { y: -61, r: 9 }, { y: -63, r: 10 }, { y: -66, r: 11.5 }];
export const MAGE_GRIP = { x: -26, y: -44 };   // 지팡이 손 (몸 스프라이트 기준, 발 = 원점)
export const MAGE_HAND = { x: 24, y: -31 };    // 빈손 (시전할 때 빛남)

function eyeUp(x, cx, cy, rr, iris) {
  ell(x, cx, cy, rr, rr * 1.2); fs(x, '#ffffff', 1.8, INK2);
  circ(x, cx, cy - rr * 0.18, rr * 0.78); x.fillStyle = iris; x.fill();
  circ(x, cx, cy - rr * 0.1, rr * 0.4); x.fillStyle = INK2; x.fill();
  circ(x, cx - rr * 0.3, cy - rr * 0.5, rr * 0.3); x.fillStyle = '#ffffff'; x.fill();
  circ(x, cx + rr * 0.3, cy + rr * 0.25, rr * 0.14); x.fill();
}
function star5(x, cx, cy, r) {
  x.beginPath();
  for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? r * 0.45 : r; k ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
  x.closePath();
}

// 망토 (어깨 = 원점, 아래로). 정면을 보므로 안감이 보인다
export function mageCape(o, tier, res) {
  const P = MAGE_PAL[o], len = tier >= 2 ? 52 : 38;
  return bakeO(`mcp|${o}|${tier}${res ? '|r' + res.toFixed(2) : ''}`, 42, 34, -28, x => finish(x, x => {
    const path = () => {
      x.beginPath();
      x.moveTo(-12, 0);
      x.quadraticCurveTo(-30, len * 0.5, -37, len);
      x.quadraticCurveTo(-25, len - 5, -14, len + 1);
      x.quadraticCurveTo(-6, len - 4, 0, len + 1);
      x.quadraticCurveTo(6, len - 4, 14, len + 1);
      x.quadraticCurveTo(25, len - 5, 37, len);
      x.quadraticCurveTo(30, len * 0.5, 12, 0);
      x.closePath();
    };
    path(); x.fillStyle = cel(x, -37, 0, 37, len, P.lining); x.fill();
    x.save(); path(); x.clip();
    x.fillStyle = dim(P.robe, 0.1);
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 12, -2); x.quadraticCurveTo(s * 30, len * 0.5, s * 37, len + 2); x.lineTo(s * 44, len + 2); x.lineTo(s * 44, -2); x.closePath(); x.fill(); }
    if (tier >= 3) {
      x.strokeStyle = P.trim; x.lineWidth = 1.6;
      for (let k = 0; k < 5; k++) glyph(x, -16 + k * 8, len - 9, 2.6, k);
    }
    if (tier >= 4) { x.fillStyle = lite(P.trim, 0.3); for (const [sx, sy] of [[-20, 16], [18, 22], [-6, 30], [8, 10]]) { star5(x, sx, sy, 3); x.fill(); } }
    x.restore();
    path(); x.lineWidth = 3.5; x.strokeStyle = INK2; x.stroke();
  }, 0, HERO_RIM, 1.3, 2.5), res || S * MS);
}

// 몸 (발 = 원점). 지팡이 팔이 -x, 빈손이 +x
export function mageBody(o, tier, res) {
  const P = MAGE_PAL[o];
  return bakeO(`mb|${o}|${tier}${res ? '|r' + res.toFixed(2) : ''}`, 46, 66, 58, x => finish(x, x => {
    x.beginPath(); x.moveTo(-19, -76); x.quadraticCurveTo(-26, -54, -18, -44); x.lineTo(18, -44); x.quadraticCurveTo(26, -54, 19, -76); x.closePath();
    fs(x, cel(x, -26, -80, 26, -44, P.hair), 3, INK2);
    const robe = () => {
      x.beginPath(); x.moveTo(-12, -53); x.quadraticCurveTo(-19, -30, -30, -5);
      x.quadraticCurveTo(-23, 1, -15, -2); x.quadraticCurveTo(-7, 2, 0, -1); x.quadraticCurveTo(7, 2, 15, -2); x.quadraticCurveTo(23, 1, 30, -5);
      x.quadraticCurveTo(19, -30, 12, -53); x.quadraticCurveTo(0, -57, -12, -53); x.closePath();
    };
    robe(); x.fillStyle = cel(x, -30, -55, 30, 0, P.robe); x.fill();
    x.save(); robe(); x.clip();
    poly(x, [-5, -54, 5, -54, 12, 3, -12, 3]); x.fillStyle = cel(x, -12, -54, 12, 3, P.inner, 0.3, 0.12); x.fill();
    x.lineWidth = 3; x.strokeStyle = P.trim;
    x.beginPath(); x.moveTo(-5, -54); x.lineTo(-12, 3); x.moveTo(5, -54); x.lineTo(12, 3); x.stroke();
    if (tier >= 1) {
      x.lineWidth = 6; x.strokeStyle = P.trim;
      x.beginPath(); x.moveTo(-34, -6); x.quadraticCurveTo(-23, 0, -15, -3); x.quadraticCurveTo(-7, 1, 0, -2); x.quadraticCurveTo(7, 1, 15, -3); x.quadraticCurveTo(23, 0, 34, -6); x.stroke();
    }
    if (tier >= 3) {
      x.lineWidth = 1.5; x.strokeStyle = lite(P.trim, 0.5);
      for (let k = 0; k < 4; k++) glyph(x, -22 + k * 14 + (k > 1 ? 2 : -2), -14, 2.8, k + o);
    }
    x.restore();
    robe(); x.lineWidth = 3.5; x.strokeStyle = INK2; x.stroke();
    rrect(x, -16, -33, 32, 6, 3); fs(x, P.trimD, 2, INK2);
    circ(x, 0, -30, tier >= 2 ? 4.6 : 3.2);
    fs(x, tier >= 2 ? rad(x, 0, -30, 0, 4.6, [[0, P.orb[0]], [0.5, P.orb[1]], [1, P.orb[2]]], -1.5, -32) : P.trim, 1.8, INK2);
    x.beginPath(); x.moveTo(-10, -52); x.quadraticCurveTo(-24, -55, -31, -45); x.lineTo(-22, -38); x.quadraticCurveTo(-16, -45, -8, -42); x.closePath();
    fs(x, cel(x, -31, -56, -8, -38, P.robe), 3, INK2);
    x.beginPath(); x.moveTo(10, -52); x.quadraticCurveTo(23, -49, 28, -36); x.lineTo(19, -32); x.quadraticCurveTo(16, -43, 8, -42); x.closePath();
    fs(x, cel(x, 8, -52, 28, -32, P.robe), 3, INK2);
    ell(x, 23.5, -34, 6, 3.5); fs(x, P.trim, 2, INK2);
    circ(x, MAGE_HAND.x, MAGE_HAND.y, 5); fs(x, SKIN, 2.5, INK2);
    if (tier >= 2) {
      x.beginPath(); x.moveTo(-18, -51); x.quadraticCurveTo(0, -61, 18, -51); x.quadraticCurveTo(15, -43, 9, -45);
      x.quadraticCurveTo(4, -40, 0, -44); x.quadraticCurveTo(-4, -40, -9, -45); x.quadraticCurveTo(-15, -43, -18, -51); x.closePath();
      fs(x, cel(x, -18, -58, 18, -40, P.trim), 2.6, INK2);
      if (tier >= 3) { circ(x, 0, -47, 3); fs(x, P.orb[1], 1.6, INK2); }
    }
    circ(x, 0, -70, 18.5); fs(x, rad(x, 0, -70, 2, 19, [[0, '#fff0e0'], [0.65, SKIN], [1, '#f0b890']], -6, -76), 3.5, INK2);
    x.fillStyle = 'rgba(255,110,140,0.45)'; ell(x, -11, -61, 3.6, 2); x.fill(); ell(x, 11, -61, 3.6, 2); x.fill();
    eyeUp(x, -7, -66, 4.4, P.iris);
    eyeUp(x, 7, -66, 4.4, P.iris);
    x.beginPath(); x.arc(0, -59.5, 3, 0.25, Math.PI - 0.25); x.lineWidth = 1.8; x.strokeStyle = INK2; x.stroke();
    for (const s of [-1, 1]) {
      x.beginPath(); x.moveTo(s * 13, -80); x.quadraticCurveTo(s * 22, -68, s * 19, -50); x.quadraticCurveTo(s * 15, -60, s * 13, -64); x.closePath();
      fs(x, cel(x, s * 13 - 6, -80, s * 13 + 8, -50, P.hair), 2.4, INK2);
    }
    x.beginPath(); x.moveTo(-19, -73); x.quadraticCurveTo(-18, -90, 0, -90); x.quadraticCurveTo(18, -90, 19, -73);
    x.quadraticCurveTo(12, -80, 6, -75); x.quadraticCurveTo(2, -81, -3, -75); x.quadraticCurveTo(-9, -82, -14, -74); x.closePath();
    fs(x, cel(x, -19, -90, 19, -73, P.hair), 3, INK2);
    x.beginPath(); x.moveTo(-17, -86); x.quadraticCurveTo(-8, -104, 4, -114); x.quadraticCurveTo(14, -121, 25, -110);
    x.quadraticCurveTo(15, -111, 10, -103); x.quadraticCurveTo(12, -95, 17, -86); x.closePath();
    fs(x, cel(x, -17, -120, 25, -86, P.hat), 3.5, INK2);
    if (tier >= 1) {
      x.beginPath(); x.moveTo(-17.5, -88); x.lineTo(17.5, -88); x.lineTo(15.5, -95); x.quadraticCurveTo(0, -98, -15, -95); x.closePath();
      fs(x, cel(x, -17, -98, 17, -88, P.trim), 2.4, INK2);
      circ(x, 0, -92.5, 3.4); fs(x, rad(x, 0, -92.5, 0, 3.4, [[0, '#ffffff'], [0.5, P.orb[1]], [1, P.orb[2]]]), 1.6, INK2);
    }
    if (tier >= 3) { star5(x, 5, -106, 5); fs(x, P.trim, 1.6, INK2); }
    ell(x, 0, -84, 31, 8.5); fs(x, cel(x, -31, -93, 31, -75, P.hat), 3.5, INK2);
    x.beginPath(); x.ellipse(0, -85, 25, 4.5, 0, Math.PI * 1.1, Math.PI * 1.9); x.lineWidth = 1.8; x.strokeStyle = 'rgba(255,255,255,0.35)'; x.stroke();
    if (tier >= 4) {
      poly(x, [-18, -83, -18, -93, -12, -88, -6, -97, 0, -89, 6, -97, 12, -88, 18, -93, 18, -83]);
      fs(x, lin(x, 0, -97, 0, -83, [[0, '#fff6b0'], [0.5, '#ffc92e'], [1, '#c27a10']]), 2.2, INK2);
      circ(x, 0, -86, 2.4); fs(x, '#ff3b5c', 1.2, INK2);
      star5(x, 26, -110, 5.5); fs(x, '#ffe45a', 1.8, INK2);
    }
    if (o === 1) mageP2(x, tier);
  }, 0, HERO_RIM, 1.3, 2.5), res || S * MS);
}

// AI 동료 마법사 표식: 흰 털 목도리 + 모자의 서리 결정 (P1 과 한눈에 구분)
function mageP2(x, tier) {
  x.beginPath(); x.moveTo(-17, -53); x.quadraticCurveTo(0, -45, 17, -53); x.quadraticCurveTo(19, -46, 13, -43); x.quadraticCurveTo(0, -38, -13, -43); x.quadraticCurveTo(-19, -46, -17, -53); x.closePath();
  fs(x, cel(x, -19, -54, 19, -38, '#f2fbff', 0.2, 0.18), 2.4, INK2);
  x.beginPath(); x.moveTo(9, -44); x.quadraticCurveTo(13, -34, 10, -26); x.lineTo(16, -28); x.quadraticCurveTo(17, -36, 14, -45); x.closePath();
  fs(x, '#e4f6ff', 2, INK2);
  const cx = 3, cy = -104 + (tier >= 3 ? 12 : 0);
  for (const [w, c] of [[4.2, INK2], [2, '#e8fbff']]) {
    x.lineWidth = w; x.strokeStyle = c; x.beginPath();
    for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; x.moveTo(cx - Math.cos(a) * 6, cy - Math.sin(a) * 6); x.lineTo(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6); }
    x.stroke();
  }
  circ(x, cx, cy, 2); fs(x, '#7fe3ff', 1, INK2);
}

// 지팡이 (손잡이 = 원점, 위쪽이 머리). 손 포함
export function mageStaff(o, tier, res) {
  const P = MAGE_PAL[o], ob = STAFF_ORB[tier];
  return bakeO(`ms|${o}|${tier}${res ? '|r' + res.toFixed(2) : ''}`, 27, 62, 28, x => finish(x, x => {
    if (tier >= 3) for (const s of [-1, 1]) {
      x.beginPath(); x.moveTo(s * 4, ob.y + 6);
      x.quadraticCurveTo(s * 20, ob.y + 2, s * 24, ob.y - 14);
      x.quadraticCurveTo(s * 17, ob.y - 8, s * 18, ob.y - 3);
      x.quadraticCurveTo(s * 11, ob.y - 3, s * 4, ob.y + 1);
      x.closePath();
      fs(x, cel(x, s * 4 - 12, ob.y - 14, s * 4 + 12, ob.y + 6, P.trim), 2.2, INK2);
    }
    rrect(x, -3.2, -50, 6.4, 82, 3.2);
    fs(x, lin(x, -3.2, 0, 3.2, 0, [[0, '#c89058'], [0.35, '#8a5a30'], [1, '#4a2a14']]), 2.5, INK2);
    if (tier >= 1) for (const yy of [-24, 10]) { rrect(x, -4.8, yy, 9.6, 4.4, 2); fs(x, P.trim, 1.8, INK2); }
    if (tier === 0) {
      for (const s of [-1, 1]) {
        x.beginPath(); x.moveTo(s * 1.5, -49); x.quadraticCurveTo(s * (ob.r + 5), ob.y + 4, s * 2, ob.y - ob.r - 3);
        x.lineWidth = 5.5; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 2.8; x.strokeStyle = '#8a5a30'; x.stroke();
      }
    } else {
      x.beginPath(); x.arc(0, ob.y + 1, ob.r + 5.5, 0.15 * Math.PI, 0.85 * Math.PI); x.arc(0, ob.y - 1, ob.r + 1.5, 0.8 * Math.PI, 0.2 * Math.PI, true); x.closePath();
      fs(x, cel(x, -ob.r - 5, ob.y, ob.r + 5, ob.y + ob.r + 6, P.trim), 2.2, INK2);
    }
    if (tier >= 4) {
      x.beginPath();
      for (let k = 0; k < 16; k++) { const a = k * TAU / 16 - Math.PI / 2, rr = k % 2 ? ob.r + 3.5 : ob.r + (k % 4 ? 8 : 13); k ? x.lineTo(Math.cos(a) * rr, ob.y + Math.sin(a) * rr) : x.moveTo(Math.cos(a) * rr, ob.y + Math.sin(a) * rr); }
      x.closePath(); fs(x, lin(x, 0, ob.y - 20, 0, ob.y + 20, [[0, '#fff6b0'], [1, '#e0a010']]), 2, INK2);
    }
    circ(x, 0, ob.y, ob.r);
    fs(x, rad(x, 0, ob.y, 0, ob.r, [[0, '#ffffff'], [0.25, P.orb[0]], [0.6, P.orb[1]], [1, P.orb[2]]], -ob.r * 0.3, ob.y - ob.r * 0.35), 2.4, INK2);
    shine(x, -ob.r * 0.35, ob.y - ob.r * 0.42, ob.r * 0.36, ob.r * 0.2, -0.6, 0.9);
    ell(x, 0, 6, 6.5, 4); fs(x, P.robe, 2, INK2);
    circ(x, 0, 0, 5.5); fs(x, SKIN, 2.5, INK2);
  }, 0, HERO_RIM, 1.1, 0), res || S * MS);
}

// ── 영웅 (5 클래스 · 티어 · 장비 희귀도) ──
export const HERO_PAL = {
  knight: { icon: '#5a8cff', hair: '#8a5226' },
  ranger: { icon: '#4fd06a', hair: '#e8a84a' },
  sorcerer: { icon: '#b27aff', hair: '#4a3470' },
  cleric: { icon: '#ffd23a', hair: '#f4d27a', iris: '#c8782a' },
  assassin: { icon: '#e8384f', hair: '#1e1a2e' },
};
export const HERO_GRIP = { x: 11, y: -30 };
const HS = 1.35;                           // 영웅 필드 배율 (키 ≈ 110, ART §3.4)
const MS = 1.25;                           // 성벽 마법사 배율 (키 ≈ 120)
const HERO_RIM = ['#fff6dc', 1, 1]; // 앞손(무기) 위치, 발 = 원점, 오른쪽을 봄

function heroHead(x, P) {
  circ(x, 1, -56, 17.5); fs(x, rad(x, 1, -56, 2, 18, [[0, '#fff0e0'], [0.65, SKIN], [1, '#f0b890']], -5, -62), 3.5, INK2);
  x.fillStyle = 'rgba(255,110,140,0.45)'; ell(x, -6, -49, 3.2, 1.8); x.fill(); ell(x, 13, -49, 3.2, 1.8); x.fill();
  for (const [ex, er] of [[-1, 3.8], [9, 4.2]]) {
    ell(x, ex, -54, er, er * 1.25); fs(x, '#ffffff', 1.6, INK2);
    circ(x, ex + 1.2, -53.5, er * 0.72); x.fillStyle = P.iris || P.icon; x.fill();
    circ(x, ex + 1.5, -53.5, er * 0.38); x.fillStyle = INK2; x.fill();
    circ(x, ex, -55.5, er * 0.3); x.fillStyle = '#fff'; x.fill();
  }
  x.beginPath(); x.arc(5, -46.5, 2.6, 0.2, Math.PI - 0.2); x.lineWidth = 1.7; x.strokeStyle = INK2; x.stroke();
}
function heroTorso(x, base, trim, tier) {
  rrect(x, -12.5, -41, 25, 27, 9); fs(x, cel(x, -12.5, -41, 12.5, -14, base), 3.2, INK2);
  rrect(x, -12.5, -23, 25, 5, 2); fs(x, trim, 2, INK2);
  if (tier >= 2) { circ(x, 0, -20.5, 3.2); fs(x, '#ffe45a', 1.6, INK2); }
}
function pauldron(x, cx, cy, r, col, tier) {
  if (tier >= 3) { poly(x, [cx - r * 0.6, cy - r * 0.5, cx - r * 0.2, cy - r * 1.7, cx + r * 0.2, cy - r * 0.6]); fs(x, '#ffe7a0', 1.6, INK2); }
  ell(x, cx, cy, r, r * 0.8); fs(x, cel(x, cx - r, cy - r, cx + r, cy + r, col), 2.6, INK2);
  if (tier >= 2) { x.beginPath(); x.ellipse(cx, cy, r * 0.8, r * 0.6, 0, Math.PI * 0.1, Math.PI * 0.9); x.lineWidth = 1.8; x.strokeStyle = '#ffd23a'; x.stroke(); }
}
function backArm(x, col) {
  x.beginPath(); x.moveTo(-9, -39); x.quadraticCurveTo(-18, -34, -17, -22); x.lineTo(-10, -22); x.quadraticCurveTo(-10, -30, -5, -33); x.closePath();
  fs(x, cel(x, -18, -39, -5, -22, col), 2.6, INK2);
  circ(x, -13.5, -21, 4.3); fs(x, SKIN, 2.2, INK2);
}
const rc = (r, i) => (r ? RARITY_COL[r][i] : null);
// 장비 희귀도 색 입히기 (전설은 본색 유지 + 금 장식으로 구분 — 금을 섞으면 탁해진다)
const tintR = (base, r, t) => (!r || r === 'legend' ? base : mix(base, rc(r, 0), t));

const HERO_ART = {
  knight(x, t, A, H) {
    const steel = A === 'legend' ? '#ffd970' : tintR('#9fb2cf', A, 0.4), trim = A ? rc(A, 0) : '#ffc92e';
    poly(x, [-12, -18, 12, -18, 10, -8, 3, -11, -3, -8, -10, -11]); fs(x, '#3a6ee8', 2.4, INK2);
    backArm(x, steel);
    heroTorso(x, steel, trim, t);
    circ(x, 0, -30, 5); fs(x, trim, 2, INK2);
    x.beginPath(); x.moveTo(0, -34); x.lineTo(0, -26); x.moveTo(-3.5, -30); x.lineTo(3.5, -30); x.lineWidth = 1.6; x.strokeStyle = INK2; x.stroke();
    if (t >= 1) { pauldron(x, -12, -39, 7.5, steel, t); pauldron(x, 12, -39, 7.5, steel, t); }
    x.beginPath(); x.moveTo(-26, -40); x.lineTo(-8, -40); x.lineTo(-8, -28); x.quadraticCurveTo(-9, -16, -17, -11); x.quadraticCurveTo(-25, -16, -26, -28); x.closePath();
    fs(x, cel(x, -26, -40, -8, -11, A ? rc(A, 0) : '#3a6ee8'), 3, INK2);
    x.beginPath(); x.moveTo(-17, -37); x.lineTo(-17, -16); x.moveTo(-23, -30); x.lineTo(-11, -30); x.lineWidth = 3; x.strokeStyle = t >= 2 ? '#ffd23a' : '#eef2f7'; x.stroke();
    heroHead(x, HERO_PAL.knight);
    if (H) {
      x.beginPath(); x.arc(1, -58, 19.5, Math.PI * 0.95, Math.PI * 2.05); x.lineTo(20, -50); x.lineTo(15, -50); x.lineTo(15, -58); x.lineTo(-12, -58); x.lineTo(-12, -48); x.lineTo(-18, -48); x.closePath();
      fs(x, cel(x, -18, -78, 20, -48, H === 'legend' ? '#ffd970' : tintR('#b8c6dc', H, 0.3)), 3.2, INK2);
      x.beginPath(); x.moveTo(1, -77); x.bezierCurveTo(-6, -92, -22, -88, -26, -74); x.quadraticCurveTo(-14, -80, 1, -71); x.closePath();
      fs(x, cel(x, -26, -92, 1, -71, rc(H, 0)), 2.4, INK2);
      rrect(x, -13, -61, 28, 4, 2); fs(x, rc(H, 2), 1.6, INK2);
    } else {
      x.beginPath(); x.moveTo(-17, -54); x.quadraticCurveTo(-20, -76, 2, -76); x.quadraticCurveTo(20, -76, 19, -58);
      x.lineTo(14, -64); x.lineTo(10, -58); x.lineTo(5, -66); x.lineTo(-1, -60); x.lineTo(-6, -66); x.lineTo(-11, -58); x.closePath();
      fs(x, cel(x, -20, -76, 19, -54, HERO_PAL.knight.hair), 3, INK2);
      rrect(x, -16, -66, 34, 4.5, 2); fs(x, '#3a6ee8', 1.6, INK2);
    }
  },
  ranger(x, t, A, H) {
    const tunic = tintR('#4f9a4a', A, 0.35), trim = A ? rc(A, 0) : '#c9853a';
    x.save(); x.translate(-12, -36); x.rotate(-0.45);
    rrect(x, -5, -8, 10, 26, 3); fs(x, cel(x, -5, -8, 5, 18, '#8a5a30'), 2.4, INK2);
    for (const [fx, c] of [[-3, '#ff6a4a'], [0, '#fff3c0'], [3, '#5fe06e']]) { poly(x, [fx, -9, fx - 2.4, -16, fx + 2.4, -16]); fs(x, c, 1.2, INK2); }
    x.restore();
    backArm(x, tunic);
    heroTorso(x, tunic, '#6a4a2a', t);
    poly(x, [-5, -41, 5, -41, 0, -30]); fs(x, trim, 1.6, INK2);
    if (t >= 1) {
      for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * 11, -39, 8, 4.5, s * 0.4, 0, TAU); fs(x, cel(x, s * 11 - 8, -44, s * 11 + 8, -34, t >= 3 ? '#8ae05a' : '#6aa84a'), 2.2, INK2); }
    }
    const hood = tintR('#3e8a3a', H, 0.5);
    x.beginPath(); x.arc(1, -57, 22, Math.PI * 0.72, Math.PI * 2.28); x.quadraticCurveTo(12, -34, 1, -38); x.quadraticCurveTo(-10, -34, -15, -40); x.closePath();
    fs(x, cel(x, -21, -79, 23, -36, hood), 3.2, INK2);
    heroHead(x, HERO_PAL.ranger);
    x.beginPath(); x.moveTo(-17, -55); x.quadraticCurveTo(-16, -74, 2, -74); x.quadraticCurveTo(19, -74, 19, -56);
    x.quadraticCurveTo(12, -64, 6, -62); x.quadraticCurveTo(0, -68, -6, -62); x.quadraticCurveTo(-12, -62, -17, -55); x.closePath();
    fs(x, cel(x, -17, -74, 19, -55, HERO_PAL.ranger.hair), 2.6, INK2);
    x.beginPath(); x.arc(1, -57, 22, Math.PI * 1.02, Math.PI * 1.98); x.lineWidth = 4.5; x.strokeStyle = H === 'legend' ? '#ffd23a' : hood; x.stroke();
    x.lineWidth = 1.4; x.strokeStyle = INK2; x.stroke();
    if (H) { poly(x, [16, -72, 30, -84, 21, -68]); fs(x, rc(H, 0), 1.8, INK2); }
  },
  sorcerer(x, t, A, H) {
    const robe = tintR('#7a4ad8', A, 0.35), trim = A ? rc(A, 0) : '#ffcf4a';
    backArm(x, robe);
    x.beginPath(); x.moveTo(-11, -41); x.lineTo(11, -41); x.quadraticCurveTo(14, -24, 18, -12); x.lineTo(-18, -12); x.quadraticCurveTo(-14, -24, -11, -41); x.closePath();
    fs(x, cel(x, -18, -41, 18, -12, robe), 3.2, INK2);
    x.lineWidth = 3; x.strokeStyle = trim; x.beginPath(); x.moveTo(-17, -14); x.lineTo(17, -14); x.moveTo(0, -40); x.lineTo(0, -14); x.stroke();
    rrect(x, -12, -27, 24, 4.5, 2); fs(x, '#3a1f7a', 1.8, INK2);
    circ(x, 0, -25, t >= 2 ? 3.8 : 2.6); fs(x, t >= 2 ? '#7fe3ff' : trim, 1.6, INK2);
    if (t >= 2) { x.beginPath(); x.moveTo(-14, -42); x.quadraticCurveTo(0, -34, 14, -42); x.lineTo(12, -46); x.quadraticCurveTo(0, -40, -12, -46); x.closePath(); fs(x, trim, 2, INK2); }
    heroHead(x, HERO_PAL.sorcerer);
    x.beginPath(); x.moveTo(-17, -50); x.quadraticCurveTo(-21, -72, 2, -72); x.quadraticCurveTo(21, -72, 19, -52);
    x.quadraticCurveTo(15, -60, 10, -60); x.quadraticCurveTo(3, -64, -4, -60); x.quadraticCurveTo(-11, -60, -17, -50); x.closePath();
    fs(x, cel(x, -21, -72, 19, -50, HERO_PAL.sorcerer.hair), 2.8, INK2);
    const hat = tintR('#5a2fb0', H, 0.45);
    x.beginPath(); x.moveTo(-14, -70); x.quadraticCurveTo(-6, -86, 2, -96); x.quadraticCurveTo(10, -104, 22, -96); x.quadraticCurveTo(12, -95, 9, -88); x.quadraticCurveTo(11, -78, 16, -70); x.closePath();
    fs(x, cel(x, -14, -104, 22, -70, hat), 3.2, INK2);
    ell(x, 1, -69, 25, 6.5); fs(x, cel(x, -24, -76, 26, -62, hat), 3.2, INK2);
    if (H || t >= 1) { rrect(x, -12, -76, 26, 4.5, 2); fs(x, H === 'legend' ? '#ffd23a' : trim, 1.6, INK2); }
    if (t >= 3) { star5(x, 4, -86, 4.5); fs(x, trim, 1.4, INK2); }
  },
  cleric(x, t, A, H) {
    const robe = A && A !== 'legend' ? mix('#f4eedc', rc(A, 1), 0.3) : '#f4eedc', gold = A ? rc(A, 0) : '#ffc92e';
    backArm(x, robe);
    x.beginPath(); x.moveTo(-11, -41); x.lineTo(11, -41); x.quadraticCurveTo(14, -24, 16, -11); x.lineTo(-16, -11); x.quadraticCurveTo(-14, -24, -11, -41); x.closePath();
    fs(x, cel(x, -16, -41, 16, -11, robe, 0.3, 0.18), 3.2, INK2);
    rrect(x, -5.5, -40, 11, 29, 2); fs(x, cel(x, -5.5, -40, 5.5, -11, gold), 2, INK2);
    x.beginPath(); x.moveTo(0, -36); x.lineTo(0, -18); x.moveTo(-3.5, -31); x.lineTo(3.5, -31); x.lineWidth = 2.2; x.strokeStyle = '#ffffff'; x.stroke();
    if (t >= 2) { for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 6, -41); x.quadraticCurveTo(s * 13, -30, s * 10, -12); x.lineWidth = 3; x.strokeStyle = '#6a8ad8'; x.stroke(); } }
    if (t >= 1) { pauldron(x, -11, -39, 6.5, gold, t); pauldron(x, 11, -39, 6.5, gold, t); }
    heroHead(x, HERO_PAL.cleric);
    x.beginPath(); x.moveTo(-17, -52); x.quadraticCurveTo(-20, -73, 2, -73); x.quadraticCurveTo(20, -73, 19, -54);
    x.quadraticCurveTo(13, -64, 5, -61); x.quadraticCurveTo(-4, -66, -10, -60); x.quadraticCurveTo(-14, -58, -17, -52); x.closePath();
    fs(x, cel(x, -20, -73, 19, -52, HERO_PAL.cleric.hair), 2.8, INK2);
    if (H) {
      x.beginPath(); x.moveTo(-12, -68); x.quadraticCurveTo(-12, -86, 2, -94); x.quadraticCurveTo(16, -86, 16, -68); x.closePath();
      fs(x, cel(x, -12, -94, 16, -68, tintR('#ffffff', H, 0.25), 0.2, 0.15), 3, INK2);
      x.beginPath(); x.moveTo(2, -88); x.lineTo(2, -72); x.moveTo(-3, -82); x.lineTo(7, -82); x.lineWidth = 2.6; x.strokeStyle = rc(H, 0); x.stroke();
    } else { rrect(x, -15, -67, 33, 4, 2); fs(x, gold, 1.6, INK2); }
  },
  assassin(x, t, A, H) {
    const leather = tintR('#40345a', A, 0.3);
    x.beginPath(); x.moveTo(-6, -42); x.quadraticCurveTo(-22, -44, -30, -34); x.quadraticCurveTo(-24, -38, -20, -32); x.quadraticCurveTo(-14, -38, -4, -37); x.closePath();
    fs(x, cel(x, -30, -44, -4, -32, '#e8384f'), 2.4, INK2);
    backArm(x, leather);
    heroTorso(x, leather, '#e8384f', t);
    x.lineWidth = 2; x.strokeStyle = 'rgba(255,255,255,0.25)'; x.beginPath(); x.moveTo(-9, -38); x.lineTo(7, -26); x.stroke();
    x.save(); x.translate(-12, -18); x.rotate(0.9);
    poly(x, [0, -14, 2.6, -2, -2.6, -2]); fs(x, '#dfe6f2', 1.4, INK2);
    rrect(x, -4, -2, 8, 2.6, 1); fs(x, '#e8384f', 1.2, INK2);
    x.restore();
    if (t >= 1) { pauldron(x, 11, -39, 6.5, dim(leather, 0.1), t); }
    const hood = tintR('#2a2040', H, 0.4);
    x.beginPath(); x.arc(1, -57, 21, Math.PI * 0.75, Math.PI * 2.25); x.quadraticCurveTo(10, -38, 1, -40); x.quadraticCurveTo(-8, -38, -14, -42); x.closePath();
    fs(x, cel(x, -20, -78, 22, -38, hood), 3.2, INK2);
    heroHead(x, HERO_PAL.assassin);
    x.beginPath(); x.moveTo(-15, -50); x.quadraticCurveTo(2, -45, 19, -50); x.quadraticCurveTo(18, -39, 2, -38); x.quadraticCurveTo(-13, -39, -15, -50); x.closePath();
    fs(x, cel(x, -15, -50, 19, -38, '#4a3a6a'), 2.4, INK2);
    x.beginPath(); x.moveTo(-13, -45); x.quadraticCurveTo(2, -41, 18, -45); x.lineWidth = 1.4; x.strokeStyle = '#e8384f'; x.stroke();
    x.beginPath(); x.arc(1, -57, 21, Math.PI * 1.05, Math.PI * 1.95); x.lineWidth = 4; x.strokeStyle = H === 'legend' ? '#ffd23a' : hood; x.stroke();
    if (t >= 3) { for (const ex of [-1, 9]) { ell(x, ex + 1, -53.5, 2.4, 1.6); x.fillStyle = '#ff3a5a'; x.fill(); } }
  },
};

export function heroBody(cls, tier, armorR, helmR, res) {
  if (!HERO_ART[cls]) cls = 'knight';
  return bakeO(`hb|${cls}|${tier}|${armorR}|${helmR}${res ? '|r' + res.toFixed(2) : ''}`, 36, 62, 45, x => finish(x, q => HERO_ART[cls](q, tier | 0, armorR || null, helmR || null), 0, HERO_RIM, 1.4, 2.4), res || S * HS);
}

// 망토 (장비 착용 시만). 목 = 원점, 뒤(-x)로 휘날림
export function heroCape(rarity, res) {
  const R = RARITY_COL[rarity] || RARITY_COL.common;
  return bakeO('hcp|' + rarity + (res ? '|r' + res.toFixed(2) : ''), 24, 22, -18, x => finish(x, x => {
    x.beginPath(); x.moveTo(-4, 0); x.quadraticCurveTo(-18, 10, -22, 34); x.quadraticCurveTo(-14, 30, -8, 36); x.quadraticCurveTo(-2, 30, 6, 32); x.quadraticCurveTo(4, 14, 6, 0); x.closePath();
    fs(x, cel(x, -22, 0, 6, 36, R[0]), 3, INK2);
    if (rarity === 'legend' || rarity === 'epic') { x.lineWidth = 2; x.strokeStyle = rarity === 'legend' ? '#fff0b8' : '#efd6ff'; x.beginPath(); x.moveTo(-20, 31); x.quadraticCurveTo(-14, 28, -8, 33); x.quadraticCurveTo(-2, 28, 5, 30); x.stroke(); }
  }, 0, HERO_RIM, 1.4, 2), res || S * HS);
}

// 무기 (손잡이 = 원점, 위를 향함). 손 포함
const WEAPON_ART = {
  knight(x, R, rar) {
    const blade = rar === 'common' ? '#eef2f7' : lite(R[0], 0.55);
    poly(x, [-3.8, -6, 3.8, -6, 3.2, -44, 0, -52, -3.2, -44]);
    fs(x, lin(x, -3.8, 0, 3.8, 0, [[0, '#ffffff'], [0.5, blade], [0.51, dim(blade, 0.15)], [1, dim(blade, 0.3)]]), 2.4, INK2);
    x.beginPath(); x.moveTo(0, -10); x.lineTo(0, -42); x.lineWidth = 1.2; x.strokeStyle = rar === 'common' ? 'rgba(80,90,110,0.6)' : R[2]; x.stroke();
    rrect(x, -10, -8.5, 20, 5, 2.5); fs(x, rar === 'legend' ? '#ffd23a' : R[0], 2, INK2);
    rrect(x, -2.2, -4, 4.4, 10, 2); fs(x, '#6a3a1e', 1.6, INK2);
    circ(x, 0, 7.5, 3); fs(x, R[0], 1.6, INK2);
  },
  ranger(x, R, rar) {
    x.beginPath(); x.moveTo(-2, -32); x.lineTo(-2, 32); x.lineWidth = 1.4; x.strokeStyle = '#f4f0e0'; x.stroke();
    x.beginPath(); x.moveTo(-2, -32); x.quadraticCurveTo(18, -16, 4, 0); x.quadraticCurveTo(18, 16, -2, 32);
    x.lineWidth = 7; x.strokeStyle = INK2; x.stroke();
    x.lineWidth = 3.8; x.strokeStyle = rar === 'common' ? '#a8703a' : R[0]; x.stroke();
    for (const s of [-1, 1]) { circ(x, -2, s * 32, 2.6); fs(x, rar === 'common' ? '#e8d8a8' : R[1], 1.4, INK2); }
  },
  sorcerer(x, R, rar) {
    rrect(x, -2.6, -40, 5.2, 60, 2.6); fs(x, lin(x, -2.6, 0, 2.6, 0, [[0, '#c89058'], [1, '#4a2a14']]), 2.2, INK2);
    const cc = rar === 'common' ? '#b27aff' : R[0];
    poly(x, [0, -58, 6, -46, 0, -38, -6, -46]); fs(x, lin(x, -6, -58, 6, -38, [[0, '#ffffff'], [0.4, lite(cc, 0.3)], [1, cc]]), 2.2, INK2);
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 2, -38); x.quadraticCurveTo(s * 9, -42, s * 7, -50); x.lineWidth = 2.2; x.strokeStyle = '#ffcf4a'; x.stroke(); }
  },
  cleric(x, R, rar) {
    rrect(x, -2.4, -30, 4.8, 36, 2.4); fs(x, '#8a5a30', 2, INK2);
    const m = rar === 'common' ? '#d8dee8' : R[0];
    for (let k = 0; k < 4; k++) { x.save(); x.translate(0, -36); x.rotate(k * Math.PI / 2 + Math.PI / 4); poly(x, [-3, 0, 0, -12, 3, 0]); fs(x, dim(m, 0.15), 1.6, INK2); x.restore(); }
    circ(x, 0, -36, 7.5); fs(x, cel(x, -7.5, -43.5, 7.5, -28.5, m), 2.4, INK2);
    circ(x, 0, -36, 2.4); x.fillStyle = '#ffe45a'; x.fill();
  },
  assassin(x, R, rar) {
    const b = rar === 'common' ? '#dfe6f2' : lite(R[0], 0.45);
    x.beginPath(); x.moveTo(-3, -5); x.quadraticCurveTo(-4, -18, 3, -30); x.quadraticCurveTo(4, -16, 3, -5); x.closePath();
    fs(x, lin(x, -4, 0, 4, 0, [[0, '#ffffff'], [0.5, b], [1, dim(b, 0.3)]]), 2.2, INK2);
    rrect(x, -7, -7, 14, 3.6, 1.8); fs(x, '#e8384f', 1.6, INK2);
    rrect(x, -2, -4, 4, 8, 2); fs(x, '#2a2040', 1.4, INK2);
  },
};
export function heroWeapon(cls, rarity, res) {
  if (!WEAPON_ART[cls]) cls = 'knight';
  const R = RARITY_COL[rarity] || RARITY_COL.common;
  return bakeO(`hw|${cls}|${rarity}${res ? '|r' + res.toFixed(2) : ''}`, 20, 48, 12, x => finish(x, x => {
    WEAPON_ART[cls](x, R, rarity || 'common');
    circ(x, 0, 0, 4.6); fs(x, SKIN, 2.2, INK2);
  }, 0, HERO_RIM, 1.2, 0), res || S * HS);
}

// ═════════════ DOM 초상 (클래스 선택 · 영웅 화면 · 영웅 버튼) ═════════════
// 필드 스프라이트와 같은 그림(몸·망토·무기·장비 색)을 고해상도로 구워 dataURL 로 캐시 → <img>. 캐릭터가 화면마다 달라 보이지 않게.
// eq: hero.equip({slot: item}) 또는 {slot: rarity}. px = 결과 이미지 높이(백킹 픽셀)
const PORTRAITS = new Map();
const IDLE_W = { knight: 0.45, cleric: 0.45, assassin: 1.7, ranger: 0.12, sorcerer: 0.15 };
export function heroPortraitURL(cls, tier = 0, eq = null, px = 360) {
  if (!HERO_ART[cls]) cls = 'knight';
  tier = clamp(tier | 0, 0, 4);
  const r = k => { const v = eq && eq[k]; return (v && (typeof v === 'string' ? v : v.rarity)) || null; };
  const key = [cls, tier, r('armor'), r('helm'), r('weapon'), r('cape'), px].join('|');
  let url = PORTRAITS.get(key);
  if (url) return url;
  const W0 = 104, H0 = 134, k = px / H0; // 로컬(몸) 단위 상자: x -52..52, y -116..18 (발 = 0)
  const c = document.createElement('canvas');
  c.width = Math.round(W0 * k); c.height = Math.round(px);
  const x = c.getContext('2d');
  const at = (tx, ty, rot = 0) => { x.setTransform(k, 0, 0, k, c.width / 2 + tx * k, c.height - 18 * k + ty * k); if (rot) x.rotate(rot); };
  const draw = img => x.drawImage(img, -img.hw, -img.hh - (img.oy || 0), img.hw * 2, img.hh * 2);
  if (r('cape')) { at(-3, -40); x.transform(1, 0, -0.06, 1, 0, 0); draw(heroCape(r('cape'), k)); }
  at(0, 0);
  for (const s of [-1, 1]) { // 다리 (drawHero 와 같은 모양)
    rrect(x, s * 5 - 4.5, -17, 9, 16, 4);
    x.fillStyle = cls === 'cleric' ? '#c8b888' : cls === 'assassin' ? '#1e1a2e' : '#5a3a2a'; x.fill();
    x.lineWidth = 2.6; x.strokeStyle = INK2; x.stroke();
  }
  draw(heroBody(cls, tier, r('armor'), r('helm'), k));
  at(HERO_GRIP.x, HERO_GRIP.y, IDLE_W[cls] ?? 0.3);
  draw(heroWeapon(cls, r('weapon') || 'common', k));
  if (cls === 'cleric') { at(2, -84); x.lineWidth = 4; x.strokeStyle = '#ffe07a'; x.beginPath(); x.ellipse(0, 0, 17, 5.5, 0, 0, TAU); x.stroke(); }
  url = c.toDataURL('image/png');
  PORTRAITS.set(key, url);
  return url;
}
// 장비 아이콘 dataURL (가방·상세·슬롯) — 캔버스 드롭 아이콘과 같은 그림
const ICONS = new Map();
export function itemIconURL(slot, rarity, cls, px = 128) {
  const key = slot + '|' + rarity + '|' + cls + '|' + px;
  let url = ICONS.get(key);
  if (url) return url;
  const img = itemIcon(slot, rarity, cls, px / 34, true);
  url = img.toDataURL('image/png');
  ICONS.set(key, url);
  return url;
}
// 성벽 마법사(o = 0 나 · 1 AI) 전신 dataURL — 타이틀 키아트용. 지팡이는 몸 옆에 세운 자세
export function magePortraitURL(o, tier = 2, px = 360) {
  const key = 'mage|' + o + '|' + tier + '|' + px;
  let url = PORTRAITS.get(key);
  if (url) return url;
  const W0 = 130, H0 = 150, k = px / H0;
  const c = document.createElement('canvas');
  c.width = Math.round(W0 * k); c.height = Math.round(px);
  const x = c.getContext('2d'), side = o === 0 ? 1 : -1;
  const at = (tx, ty, rot = 0, sx = 1) => { x.setTransform(k * sx, 0, 0, k, c.width / 2 + tx * k, c.height - 12 * k + ty * k); if (rot) x.rotate(rot); };
  const draw = img => x.drawImage(img, -img.hw, -img.hh - (img.oy || 0), img.hw * 2, img.hh * 2);
  if (tier >= 1) { at(0, -54, 0, side); draw(mageCape(o, tier, k)); }
  at(0, 0, 0, side); draw(mageBody(o, tier, k));
  at(side * MAGE_GRIP.x, MAGE_GRIP.y, -side * 0.2); draw(mageStaff(o, tier, k));
  url = c.toDataURL('image/png');
  PORTRAITS.set(key, url);
  return url;
}
// 적 스프라이트 dataURL (타이틀 전경)
export function enemyURL(type, r, px = 160) {
  const key = 'en|' + type + '|' + px;
  let url = PORTRAITS.get(key);
  if (url) return url;
  const img = enemy(type, r);
  const c = document.createElement('canvas'), k = px / (img.hh * 2);
  c.width = Math.round(img.hw * 2 * k); c.height = Math.round(px);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  url = c.toDataURL('image/png');
  PORTRAITS.set(key, url);
  return url;
}

// 클래스 아이콘 배지 (HP바 옆)
export function classIcon(cls) {
  const P = HERO_PAL[cls] || HERO_PAL.knight;
  return bake('ci|' + cls, 13, 13, x => {
    circ(x, 0, 0, 11.5); fs(x, cel(x, -11, -11, 11, 11, P.icon), 2.6, INK2);
    x.save(); circ(x, 0, 0, 10); x.clip();
    x.rotate(cls === 'ranger' ? 0 : 0.7); x.scale(0.4, 0.4); x.translate(0, cls === 'ranger' ? 0 : 22);
    (WEAPON_ART[cls] || WEAPON_ART.knight)(x, RARITY_COL.legend, 'common');
    x.restore();
  });
}

// 장비 아이콘 (희귀도 타일 + 부위 그림)
export function itemIcon(slot, rarity, cls, res, bare = false) {
  const R = RARITY_COL[rarity] || RARITY_COL.common, ri = Math.max(0, TIER_RARITY.indexOf(rarity));
  return bake(`it|${slot}|${rarity}|${cls}${res ? '|r' + res.toFixed(2) : ''}${bare ? '|b' : ''}`, 17, 17, x => {
    if (bare) x.scale(1.12, 1.12); // DOM 칸(k-slot)이 등급 타일을 그리므로 그림만 크게
    else {
      rrect(x, -15, -15, 30, 30, 7); fs(x, lin(x, 0, -15, 0, 15, [[0, R[1]], [0.5, R[0]], [0.52, dim(R[0], 0.12)], [1, R[2]]]), 2.6, INK2);
      rrect(x, -12, -12.5, 24, 3, 1.5); x.fillStyle = 'rgba(255,255,255,0.45)'; x.fill();
      x.scale(0.8, 0.8); // 타일 안쪽에 들어가게
    }
    // 등급이 오를수록 실루엣에 장식이 붙는다: 고급 = 등급색 포인트 · 희귀 = 보석 · 영웅 = 금 세공 · 전설 = 뒤 후광
    if (ri >= 4) {
      x.save(); x.globalAlpha = 0.9;
      for (let k = 0; k < 8; k++) { x.rotate(Math.PI / 4); poly(x, [-1.6, -6, 0, -14.5, 1.6, -6]); x.fillStyle = '#fff0b8'; x.fill(); }
      x.restore();
    }
    const metal = ri >= 3 ? '#fff0c8' : '#eef2f7', acc = ri >= 1 ? R[0] : '#b9c2d0', gold = '#ffc92e';
    const gem = (cx, cy, r) => { if (ri < 2) return; circ(x, cx, cy, r); fs(x, rad(x, cx, cy, 0, r, [[0, '#ffffff'], [0.45, R[1]], [1, R[2]]], cx - r * 0.3, cy - r * 0.3), 1.2, INK2); };
    switch (slot) {
      case 'weapon':
        x.save(); x.rotate(cls === 'ranger' ? 0 : 0.75); x.scale(0.46, 0.46); x.translate(0, cls === 'ranger' ? 0 : 20);
        (WEAPON_ART[cls] || WEAPON_ART.knight)(x, R, rarity === 'common' ? 'rare' : rarity);
        x.restore();
        if (ri >= 3) { x.save(); x.globalAlpha = 0.85; poly(x, [9, -12, 10.5, -9, 14, -8, 10.5, -7, 9, -4, 7.5, -7, 4, -8, 7.5, -9]); x.fillStyle = '#ffffff'; x.fill(); x.restore(); }
        break;
      case 'helm': { // 투구: 깃털 장식 + 둥근 투구 + 면갑 틈
        x.beginPath(); x.moveTo(-1, -9); x.bezierCurveTo(4, -17, 12, -15, 14, -8); x.bezierCurveTo(9, -11, 6, -9, 4, -6); x.closePath();
        fs(x, cel(x, -1, -17, 14, -6, acc), 1.8, INK2);
        x.beginPath(); x.arc(0, 1, 10.5, Math.PI, 0); x.lineTo(10.5, 8); x.quadraticCurveTo(0, 12, -10.5, 8); x.closePath();
        fs(x, cel(x, -10, -9, 10, 11, metal), 2.2, INK2);
        rrect(x, -9, 1, 18, 4.4, 2); fs(x, '#3a3450', 1.4, INK2);
        x.beginPath(); x.moveTo(0, -9); x.lineTo(0, 1); x.lineWidth = 1.6; x.strokeStyle = ri >= 3 ? gold : 'rgba(80,90,110,0.7)'; x.stroke();
        gem(0, 8.5, 2.4);
        shine(x, -5, -4, 2.8, 1.4, -0.6, 0.8);
        break;
      }
      case 'armor': { // 흉갑: 어깨 보호대 2 + 몸통 + 복부 판
        for (const d of [-1, 1]) { circ(x, d * 10, -6, 5.5); fs(x, cel(x, d * 10 - 5, -11, d * 10 + 5, -1, acc), 1.8, INK2); }
        x.beginPath(); x.moveTo(-8, -10); x.quadraticCurveTo(0, -6, 8, -10); x.lineTo(8.5, 5); x.quadraticCurveTo(0, 13, -8.5, 5); x.closePath();
        fs(x, cel(x, -8, -10, 8, 12, metal), 2.2, INK2);
        x.lineWidth = 1.3; x.strokeStyle = ri >= 3 ? gold : 'rgba(80,90,110,0.65)';
        x.beginPath(); x.moveTo(0, -7); x.lineTo(0, 9); x.moveTo(-6.5, 2); x.quadraticCurveTo(0, 5, 6.5, 2); x.stroke();
        gem(0, -3, 2.6);
        shine(x, -4, -6, 2.4, 1.2, -0.6, 0.8);
        break;
      }
      case 'trinket': { // 목걸이: 금 사슬 + 테두리 받침 + 보석
        x.beginPath(); x.moveTo(-8, -12); x.quadraticCurveTo(-7, -2, 0, 0); x.quadraticCurveTo(7, -2, 8, -12); x.lineWidth = 2; x.strokeStyle = gold; x.stroke();
        circ(x, 0, 5, 8); fs(x, cel(x, -8, -3, 8, 13, gold), 2, INK2);
        circ(x, 0, 5, 5.2); fs(x, rad(x, 0, 5, 0, 5.2, [[0, '#ffffff'], [0.45, R[1]], [1, R[2]]], -1.6, 3.4), 1.4, INK2);
        if (ri >= 3) for (const d of [-1, 1]) { circ(x, d * 8.5, 5, 1.6); x.fillStyle = '#fff6c8'; x.fill(); }
        break;
      }
      default: { // 망토: 걸쇠 + 펄럭이는 자락(물결 밑단) + 안감
        x.beginPath(); x.moveTo(-6, -11); x.lineTo(6, -11); x.quadraticCurveTo(10, 0, 12, 10); x.quadraticCurveTo(8, 7, 5, 11); x.quadraticCurveTo(1, 7, -2, 11); x.quadraticCurveTo(-6, 7, -9, 11); x.quadraticCurveTo(-10, 0, -6, -11); x.closePath();
        fs(x, cel(x, -12, -11, 12, 11, ri >= 1 ? dim(R[0], 0.12) : '#8a8fa8'), 2.2, INK2);
        x.beginPath(); x.moveTo(4, -9); x.quadraticCurveTo(8, 0, 9, 8); x.lineWidth = 2; x.strokeStyle = ri >= 1 ? R[1] : '#c8ccd8'; x.stroke();
        rrect(x, -7, -13, 14, 4, 2); fs(x, ri >= 3 ? gold : '#b9c2d0', 1.6, INK2);
        circ(x, 0, -11, 2.6); fs(x, ri >= 2 ? R[1] : '#eef2f7', 1.4, INK2);
      }
    }
  }, res);
}

// ═════════════ 전장 그리기 ═════════════
export function visOf(e) {
  let v = vis.get(e.id);
  if (!v) { v = { pop: e.y > 0 && !e.named ? 0 : 1, punch: 0, chroma: -1, fl: 0, lastH: 0, seen: 0, hpv: e.hp + (e.shield || 0), hitD: 0, age: 0, top: !e.named, landed: false, intro: e.named ? 0 : 1, flT: -1 }; vis.set(e.id, v); }
  v.seen = frameNo;
  return v;
}

// ── 네임드 보스 시각 위치 · 등장 (ART §3.4, §10.10) ──
// 판정 좌표(e.y)는 그대로 두고 그림만 내린다: 보스 머리가 HUD·보스바·스킬 칩 줄(HUD 기준 y 176) 아래에 오도록
// '바닥선'을 잡고, 등장 지점(Y0)~Y2 구간을 [바닥선, Y2]로 눌러 그린다(Y2 아래는 실제 위치 그대로 → 이음매 없음).
// 이 공간 왜곡은 warpY()로 마법탄·타격·영웅·스킬 연출에도 똑같이 적용해 탄이 빈 곳에 맞는 것처럼 보이지 않게 한다.
// 등장: 위에서 떨어져(0.6초) 착지 → 흔들림 + 먼지 링 + 포효 링 (드래곤은 날아 내려옴, 전차는 돌진이라 그대로).
const BOSS_TOP = 232; // HUD 기준 y: 보스바(94~152) + 보스전 스킬 칩 줄(~196) 아래
const WB = { on: false, x: 0, ey: 0, yv: 0, vr: 0, D: 0 }; // 이번 프레임 왜곡 기준 보스
function stageDY(e) {
  if (!e.named) return 0;
  const v = visOf(e), vr = visR(e), floor = hudY(BOSS_TOP) + vr * 1.02, Y2 = floor + 230;
  if (v.y0 === undefined) v.y0 = Math.min(e.y, floor - 1);
  if (e.y >= Y2) return 0;
  const yv = floor + (Y2 - floor) * clamp((e.y - v.y0) / (Y2 - v.y0), 0, 1);
  return Math.max(0, yv - e.y);
}
export function bossDY(e) {
  if (!e.named) return 0;
  const v = visOf(e), d = stageDY(e);
  if (v.intro >= 1 || e.type === 'goblinChariot') return d;
  const u = clamp(v.intro, 0, 1);
  return d - (e.type === 'doomDragon' ? (1 - easeOut(u)) * 150 : (1 - u * u) * 110); // 짧게 떨어짐(가속) / 날아 내려옴(감속) — 보스바 위로는 안 올라감
}
// 보스 주변 점의 그려질 y (마법탄·타격·영웅 등). 보스에서 가로로 멀면 영향 없음
export function warpY(x, y) {
  if (!WB.on) return y;
  const wx = clamp(1 - (Math.abs(x - WB.x) - WB.vr) / 140, 0, 1);
  if (wx <= 0) return y;
  const lo = WB.yv + WB.vr + 160;
  if (y >= lo) return y;
  const m = y <= WB.ey ? y + WB.D : WB.yv + (y - WB.ey) * (lo - WB.yv) / (lo - WB.ey);
  return y + (m - y) * wx;
}
function setWarp(view) {
  WB.on = false;
  let best = null;
  for (const e of view.enemies) if (e.named && !e.dead && (!best || e.r > best.r)) best = e;
  if (!best) return;
  const D = stageDY(best);
  if (D < 1) return;
  WB.on = true; WB.x = best.x; WB.ey = best.y; WB.D = D; WB.yv = best.y + D; WB.vr = visR(best);
}
function landFx(e, x, y, vr) { // 보스 착지: 흔들림 + 먼지 링 + 파편
  const fly = e.type === 'doomDragon';
  shake(fly ? 0.3 : 0.45);
  ring(x, y, vr * 0.4, vr * 1.3, 0.4, fly ? '#c89070' : '#a89478', 6); // 먼지 고리(흙빛, 낮은 알파)
  burst(K_SMOKE, x, y, 10, 60, 220, 1.0, 60, fly ? 'rgba(255,200,170,0.4)' : 'rgba(210,195,175,0.55)', -20, 1.6, 20);
  if (!fly) burst(K_DEBRIS, x, y - 10, 10, 160, 420, 0.8, 7, ['#8a7a6a', '#c8b8a0', '#5a4a3a'], 900, 0.5, 200);
}

// 드래곤 브레스 예고 기둥
export function drawWarn(view) {
  for (const e of view.enemies) {
    if (e.state !== 'warn') continue;
    const p = clamp(1 - (Number.isFinite(e.t2) ? e.t2 : 0.6) / 1.2, 0, 1);
    const w = 190 - 60 * p, top = e.y + bossDY(e) + visR(e) * 1.35;
    const a = 0.25 + 0.35 * p + 0.12 * Math.sin(RT * 30);
    const g = ctx.createLinearGradient(0, top, 0, WALL_Y);
    g.addColorStop(0, 'rgba(255,120,30,0)');
    g.addColorStop(0.25, `rgba(255,150,40,${a})`);
    g.addColorStop(1, `rgba(255,210,80,${Math.min(1, a * 1.5)})`);
    ctx.globalCompositeOperation = 'lighter'; // 붉은 바닥 위에서도 보이게 가산
    ctx.fillStyle = g;
    ctx.fillRect(e.x - w / 2, top, w, WALL_Y - top);
    ctx.fillStyle = `rgba(255,230,120,${0.12 + 0.2 * p})`;
    for (let yy = top + ((RT * 260) % 60); yy < WALL_Y; yy += 60) ctx.fillRect(e.x - w / 2, yy, w, 14);
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([16, 12]);
    ctx.lineDashOffset = -RT * 120;
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255,220,120,${0.5 + 0.5 * p})`;
    ctx.beginPath();
    ctx.moveTo(e.x - w / 2, top); ctx.lineTo(e.x - w / 2, WALL_Y);
    ctx.moveTo(e.x + w / 2, top); ctx.lineTo(e.x + w / 2, WALL_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    const s = 1 + 0.15 * Math.sin(RT * 20);
    ctx.save();
    ctx.translate(e.x, WALL_Y - 70);
    ctx.scale(s, s);
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(28, 20); ctx.lineTo(-28, 20); ctx.closePath();
    ctx.fillStyle = '#ffd23a'; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = '#3a0a00'; ctx.stroke();
    txt('!', 0, 5, 30, '#3a0a00');
    ctx.restore();
  }
}

// 처치 팝 (흰 실루엣이 부풀며 사라짐) — 적은 처치 즉시 view 에서 빠지므로 지난 프레임 목록에서 찾는다
const POPS = pool(24, () => ({ life: 0, img: null, x: 0, y: 0, fo: 0 }));
function deathPop(ev) {
  let best = null, bd = 1e9;
  for (const e of order) {
    if (e.type !== ev.enemy) continue;
    const d = (e.x - ev.x) ** 2 + (e.y - ev.y) ** 2;
    if (d < bd) { bd = d; best = e; }
  }
  if (!best || bd > 90 * 90) return;
  const cls = best.named ? 'b' : best.elite ? 'e' : 'n', p = take(POPS);
  p.img = enemy(best.type, best.r, 'w', cls);
  p.life = best.isBoss ? 0.3 : 0.16; p.max = p.life;
  p.x = best.x; p.y = best.y + bossDY(best);
}
function drawPops() {
  for (const p of POPS) {
    if (p.life <= 0) continue;
    const u = 1 - p.life / p.max, k = 1 + 0.35 * easeOut(u);
    ctx.globalAlpha = (1 - u) * (1 - u);
    place(p.x, p.y, 0, k * (1 + 0.15 * u), k * (1 - 0.1 * u));
    ctx.drawImage(p.img, -p.img.hw, -p.img.hh, p.img.hw * 2, p.img.hh * 2);
  }
  ctx.globalAlpha = 1;
  wt();
}

const FLY = { doomDragon: 70, wraith: 16, lichLord: 18 };
const GOO_COL = { kingSlime: '#6fb6ff', goblinChariot: '#e0a060', lichLord: '#b27aff', magmaGolem: '#ff7a2a', demonLord: '#ff4060', doomDragon: '#ff6a4a' };
let berserkOn = false;
export function drawEnemies(view) {
  fadeTop = hudY(72);
  berserkOn = view.berserk > 1 && view.phase === 'play';
  setWarp(view);
  order.length = 0;
  for (const e of view.enemies) if (!e.dead && e.y + e.r * 2 > -60 - topExtra) order.push(e);
  // 네임드 보스는 늘 맨 위(잡몹·엘리트가 얼굴을 덮지 않게), 보스와 겹친 잡몹은 흐리게(fadeA)
  order.sort((a, b) => (a.named ? 5000 + a.y : a.y) - (b.named ? 5000 + b.y : b.y));
  BB.on = false;
  for (const e of order) if (e.named && (!BB.on || e.r > BB.r0)) { BB.on = true; BB.r0 = e.r; BB.x = e.x; BB.y = e.y + bossDY(e); BB.r = visR(e); }
  // 접지 그림자 (ART §3.2 7번)
  const sh = shadow();
  for (const e of order) {
    const fly = FLY[e.type] || 0, vr = visR(e), v = visOf(e);
    const w = vr * (fly ? 2.1 : 1.8) * (fly ? 0.9 + 0.1 * Math.sin(T * 2.4 + e.id) : 1);
    ctx.globalAlpha = (fly ? 0.55 : 0.9) * fadeA(v, e);
    spr(sh, e.x, e.y + bossDY(e) + vr * (FEET[e.type] ?? 0.88) + fly * 0.5, w, w * 0.34);
  }
  ctx.globalAlpha = 1;
  // 엘리트 발밑 붉은 링 (ART §3.3)
  ctx.lineWidth = 3;
  for (const e of order) {
    if (!e.elite) continue;
    const vr = visR(e);
    ctx.globalAlpha = (0.55 + 0.25 * Math.sin(T * 5 + e.id)) * fadeA(visOf(e), e);
    ctx.strokeStyle = '#ff3a4a';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + vr * 0.88, vr * 0.95, vr * 0.3, 0, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // 보스 오라 (가산)
  ctx.globalCompositeOperation = 'lighter';
  for (const e of order) {
    if (!e.isBoss) continue;
    const col = e.named ? (e.type === 'doomDragon' && e.state === 'enrage' ? '#ff2020' : '#ff3a8a') : '#ff4a2a';
    ctx.globalAlpha = (e.named ? 0.16 : 0.14) + 0.05 * Math.sin(T * 3 + e.id); // 우윳빛 방지: 반경 ≤ 1.3배, 알파 ≤ 0.2
    const s = visR(e) * 2.5;
    spr(gl(col), e.x, e.y + bossDY(e), s, s);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  for (const e of order) drawBody(e);
  wt();
  drawPops();
  // 보호막 · 조준경
  const giant = view.players.some(p => p.syn && p.syn.includes('giant'));
  for (const e of order) {
    const ey = e.y + bossDY(e), vr = visR(e);
    if (e.shield > 0) {
      ctx.globalAlpha = 0.6 + 0.25 * Math.sin(T * 5 + e.id);
      const s = vr * 2.3;
      spr(bubble(), e.x, ey - vr * 0.05, s, s);
      ctx.globalAlpha = 1;
    }
    if (giant && e.isBoss) {
      const s = vr * 2.1 * (1 + 0.05 * Math.sin(RT * 6));
      place(e.x, ey, RT * 1.4, 1, 1);
      ctx.globalAlpha = 0.5;
      spr(reticle(), 0, 0, s, s);
      ctx.globalAlpha = 1;
      wt();
    }
  }
  drawEnemyMarks(view, order);
  // 체력바: 어두운 트랙 + 2단 채움 + 잉크 테 (네임드는 HUD 보스바)
  for (const e of order) {
    if (e.named || !(e.hp < e.maxHp) || e.maxHp <= 0 || e.y < fadeTop + 30) continue;
    const vr = visR(e), w = e.isBoss ? vr * 1.5 : Math.max(34, vr * 1.5), h = e.isBoss ? 9 : 7;
    const x = e.x - w / 2, y = e.y - vr * 1.05 - 14;
    const r = clamp(e.hp / e.maxHp, 0, 1);
    ctx.fillStyle = INK2; ctx.fillRect(x - 2.5, y - 2.5, w + 5, h + 5);
    ctx.fillStyle = '#3a2a52'; ctx.fillRect(x, y, w, h);
    const c = r > 0.5 ? HPC[0] : r > 0.25 ? HPC[1] : HPC[2];
    ctx.fillStyle = c[1]; ctx.fillRect(x, y, w * r, h);
    ctx.fillStyle = c[0]; ctx.fillRect(x, y, w * r, h * 0.45);
    if (e.shield > 0) { ctx.fillStyle = '#8ff4ff'; ctx.fillRect(x, y - 4, w * clamp(e.shield / e.maxHp * 2, 0, 1), 3); }
  }
}
const HPC = [['#b6ff8a', '#3fcf4a'], ['#fff09a', '#f0b020'], ['#ffa08a', '#e8302a']];
let fadeTop = 0; // 이 y(HUD 아래) 위의 잡몹은 흐리게 → HUD 알약 밑에서 걸어 나오며 나타난다
const BB = { on: false, x: 0, y: 0, r: 0, r0: 0 }; // 이번 프레임 네임드 보스 시각 원
const fadeA = (v, e) => (v.intro < 1 ? Math.min(1, v.intro * 4) : v.top && e ? clamp((e.y - fadeTop) / 40, 0, 1) : 1)
  * (BB.on && e && !e.named && Math.abs(e.x - BB.x) < BB.r * 0.9 && Math.abs(e.y - BB.y) < BB.r ? 0.55 : 1);

function drawBody(e) {
  const v = visOf(e);
  const ph = (e.id % 97) * 0.77;
  const vr = visR(e), cls = e.named ? 'b' : e.elite ? 'e' : 'n';
  let sx = 1, sy = 1, dx = 0, dy = 0, rot = 0;
  let rage = false;
  if (!e.frozen) {
    const a = ANIM[e.type] || 'waddle';
    if (a === 'jelly') { const s = Math.sin(T * 5 + ph); sx = 1 + 0.08 * s; sy = 1 - 0.08 * s; dy = -Math.max(0, -s) * vr * 0.05; }
    else if (a === 'hop') { const s = Math.abs(Math.sin(T * 7 + ph)); dy = -s * vr * 0.22; sy = 0.92 + 0.1 * s; sx = 1.05 - 0.07 * s; rot = Math.sin(T * 7 + ph) * 0.07; }
    else if (a === 'trot') { dy = -Math.abs(Math.sin(T * 10 + ph)) * vr * 0.13; rot = Math.sin(T * 10 + ph) * 0.06; sy = 1 + 0.04 * Math.sin(T * 20 + ph); }
    else if (a === 'waddle') { rot = Math.sin(T * 8 + ph) * 0.1; dy = -Math.abs(Math.sin(T * 8 + ph)) * vr * 0.09; }
    else if (a === 'float') { dy = Math.sin(T * 2.4 + ph) * vr * 0.08; sx = 1 + 0.025 * Math.sin(T * 2.4 + ph); rot = Math.sin(T * 1.2 + ph) * 0.03; }
    else { dy = -Math.abs(Math.sin(T * 3 + ph)) * vr * 0.04; rot = Math.sin(T * 3 + ph) * 0.025; sy = 1 + 0.015 * Math.sin(T * 1.6 + ph); }
    switch (e.state) {
      case 'attack': { // 뒤로 젖혔다가(와인드업) 앞으로 들이받기
        const s = Math.sin(T * 7 + ph);
        if (s < 0) { sy *= 1 - 0.1 * s; sx *= 1 + 0.05 * s; dy += s * vr * 0.12; rot += s * 0.06; }
        else { dy += s * vr * 0.26; sx *= 1 + 0.12 * s; sy *= 1 - 0.1 * s; }
        rage = true;
        break;
      }
      case 'attackHero': { const s = Math.sin(T * 9 + ph); rot += s * 0.12; dy += Math.max(0, s) * vr * 0.12; rage = true; break; }
      case 'dash': sy *= 1.14; sx *= 0.9; rage = true; break;
      case 'throw': { const s = Math.sin(T * 5 + ph); rot = s * 0.16; sy *= 1 + 0.05 * Math.max(0, s); break; }
      case 'fuse': { const s = 1 + 0.1 * Math.sin(T * 36); sx *= s; sy *= s; rage = true; break; }
      case 'charge': dx = Math.sin(T * 45) * 2.5; sy *= 1.06; sx *= 0.96; rage = true; break;
      case 'retreat': rot = Math.sin(T * 12) * 0.04; break;
      case 'cast': sy *= 1.07 + 0.03 * Math.sin(T * 20); sx *= 0.97; rage = true; break;
      case 'warn': sy *= 1.07; sx *= 0.96; rage = true; break;
      case 'enrage': rage = true; break;
    }
  }
  // 피격: 흰 번쩍임 + 찌그러짐(x1.15/y0.88) + 뒤로 밀림
  const h = v.fl, pu = v.punch;
  const kb = e.isBoss ? 0.35 : 1;
  sx *= 1 + (0.15 * h + 0.24 * pu) * kb;
  sy *= 1 - (0.12 * h + 0.2 * pu) * kb;
  dy -= (h * 4 + pu * 8) * kb;
  if (v.pop < 1) { const p = easeBack(v.pop); sx *= p; sy *= p; }
  const fo = vr * (FEET[e.type] ?? 0.88); // 발밑 피벗
  const ey = e.y + bossDY(e);
  const px = e.x + dx, py = ey + fo + dy;
  const blink = !rage && ((T + e.id * 0.37) % 3.4) < 0.13;
  const body = enemy(e.type, e.r, 'n', cls, rage ? 2 : blink ? 1 : 0);
  const hw = body.hw, hh = body.hh;
  const fa = fadeA(v, e);
  ctx.globalAlpha = fa;

  if (e.type === 'doomDragon') { // 날개짓
    const wing = dragonWing(vr);
    const f = 0.78 + 0.22 * Math.sin(T * (e.state === 'enrage' ? 9 : 5.5));
    const wy = -fo - vr * 0.22;
    place(px, py, rot, sx, sy);
    ctx.transform(f, 0, 0, 1, -vr * 0.4, wy);
    ctx.drawImage(wing, -wing.hw * 2, -wing.hh, wing.hw * 2, wing.hh * 2);
    place(px, py, rot, sx, sy);
    ctx.transform(-f, 0, 0, 1, vr * 0.4, wy);
    ctx.drawImage(wing, -wing.hw * 2, -wing.hh, wing.hw * 2, wing.hh * 2);
  }
  const bx = -hw, by = -hh - fo;
  if (WINGS[e.type] && !e.named) { // 퍼덕이는 날개 (몸 뒤)
    const W = WINGS[e.type], wing = wingTex(e.type, e.r, cls), u = vr / 100;
    const f = e.frozen ? 0.9 : 0.72 + 0.28 * Math.sin(T * 16 + ph);
    for (const sd of [-1, 1]) {
      place(px, py, rot, sx * sd, sy);
      ctx.translate(W.at[0] * u, -fo + W.at[1] * u);
      ctx.rotate(-0.25 * (1 - f));
      ctx.scale(f, 1);
      ctx.drawImage(wing, -wing.hw, -wing.hh, wing.hw * 2, wing.hh * 2);
    }
  }
  if (e.elite) { // 엘리트: 붉은 외곽 번짐
    place(px, py - vr * 0.08, rot, sx * 1.08, sy * 1.08);
    ctx.globalAlpha = fa * (0.5 + 0.25 * Math.sin(T * 6 + ph));
    ctx.drawImage(enemy(e.type, e.r, 'r', cls), bx, by, hw * 2, hh * 2);
    ctx.globalAlpha = fa;
  }
  place(px, py, rot, sx, sy);
  ctx.drawImage(body, bx, by, hw * 2, hh * 2);
  if (e.elite) { // 엘리트 금 왕관 장식
    const c = eliteCrown(), k = vr / 46;
    ctx.drawImage(c, -c.hw * k, -fo - vr * 1.0 - c.hh * 1.6 * k, c.hw * 2 * k, c.hh * 2 * k);
  }
  if (e.frozen) {
    ctx.globalAlpha = 0.6 * fa;
    ctx.drawImage(enemy(e.type, e.r, 'f', cls), bx, by, hw * 2, hh * 2);
    ctx.globalAlpha = fa;
    const s = vr * 2.1;
    ctx.drawImage(ice(), -s / 2, -fo - s / 2 + vr * 0.12, s, s);
  }
  if (!e.frozen && e.slowT > 0) { // 서리 화살 둔화: 푸른 서리 덮개(빙결보다 옅게)
    ctx.globalAlpha = 0.4 * fa * Math.min(1, e.slowT * 3);
    ctx.drawImage(enemy(e.type, e.r, 'f', cls), bx, by, hw * 2, hh * 2);
    ctx.globalAlpha = fa;
  }
  if (berserkOn && !e.frozen) { // 광폭화: 붉게 맥동
    ctx.globalAlpha = fa * (0.14 + 0.2 * (0.5 + 0.5 * Math.sin(T * 7 + ph)));
    ctx.drawImage(enemy(e.type, e.r, 'r', cls), bx, by, hw * 2, hh * 2);
    ctx.globalAlpha = fa;
  }
  // 흰 번쩍임: 보스는 계속 맞아도 형체가 보이게 약하게, 큰 타격(punch)만 강하게
  const fl = e.isBoss ? Math.max(h * 0.2, pu * 0.28) : Math.max(h * 0.4, pu * 0.36); // 흰 틴트 ≤ 40% → 연타에도 형체·색 유지
  if (e.state === 'fuse' && (T * 10) % 1 < 0.5) {
    ctx.globalAlpha = 0.7 * fa;
    ctx.drawImage(enemy(e.type, e.r, 'r', cls), bx, by, hw * 2, hh * 2);
  }
  if (fl > 0) {
    ctx.globalAlpha = Math.min(1, fl * 1.1) * fa;
    ctx.drawImage(enemy(e.type, e.r, 'w', cls), bx, by, hw * 2, hh * 2);
  }
  ctx.globalAlpha = fa;
  // 가산 합성 장식
  ctx.globalCompositeOperation = 'lighter';
  if (v.chroma > 0) { // 순간 색수차
    ctx.globalAlpha = 0.3 * fa;
    ctx.drawImage(enemy(e.type, e.r, 'r', cls), bx - 4, by, hw * 2, hh * 2);
    ctx.drawImage(enemy(e.type, e.r, 'c', cls), bx + 4, by, hw * 2, hh * 2);
  }
  const u = vr / 100;
  if (e.type === 'doomDragon' && e.state === 'enrage') {
    ctx.globalAlpha = 0.22 + 0.14 * Math.sin(T * 8);
    ctx.drawImage(enemy(e.type, e.r, 'r', cls), bx, by, hw * 2, hh * 2);
  }
  if (e.type === 'magmaGolem') {
    const g = golemGlow(vr);
    ctx.globalAlpha = e.state === 'cast' ? 1 : 0.3 + 0.3 * Math.sin(T * 3);
    ctx.drawImage(g, -g.hw, -g.hh - fo, g.hw * 2, g.hh * 2);
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(T * 6); // 눈빛: 이글거리는 두 눈(표정)
    for (const sd of [-1, 1]) spr(gl('#fff0a0'), sd * 11 * u, -fo - 80 * u, 26 * u * 2, 16 * u * 2);
  } else if (e.type === 'lichLord') {
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(T * 4);
    const s = vr * (e.state === 'cast' ? 1.4 : 0.8);
    spr(gl('#6affd8'), 75 * u, -fo - 118 * u, s, s);
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(T * 3.3);
    spr(gl('#5ff0ff'), 0, -fo - 50 * u, vr * 0.7, vr * 0.5);
  } else if (e.type === 'bomber' && !e.frozen) {
    ctx.globalAlpha = 1;
    const s = vr * (e.state === 'fuse' ? 1.3 : 0.7) * (0.8 + rnd() * 0.4);
    spr(gl('#ffb03a'), 38 * u, -fo - 142 * u, s, s);
    ctx.globalAlpha = 0.3 + 0.15 * Math.sin(T * 6 + ph);
    spr(gl('#ff8a1e'), 0, -fo + 16 * u, vr * 1.2, vr * 1.2);
  } else if (e.type === 'goblinChariot') {
    for (const s of [-1, 1]) { ctx.globalAlpha = 0.6 + 0.3 * rnd(); spr(gl('#ffb03a'), s * 80 * u, -fo - 100 * u, vr * 0.5, vr * 0.6); }
  } else if (e.type === 'demonLord') {
    ctx.globalAlpha = 0.5 + 0.25 * Math.sin(T * 7);
    spr(gl('#ff8a1e'), 0, -fo - 110 * u, vr * 0.9, vr * 0.6);
    if (e.state === 'cast') { ctx.globalAlpha = 0.6; spr(gl('#ff3050'), 0, -fo + 10 * u, vr * 1.6, vr * 1.6); }
  } else if (e.type === 'doomDragon' && e.state === 'warn') {
    ctx.globalAlpha = 0.9;
    const s = vr * (1.0 + 0.35 * Math.sin(T * 25));
    spr(gl('#ff6a1a'), 0, -fo + 136 * u, s, s);
  }
  if (e.burnT > 0) {
    const f0 = flame();
    for (let k = 0; k < 3; k++) {
      const fx = (k - 1) * vr * 0.45, f = 0.75 + 0.35 * Math.sin(T * 17 + k * 2.1 + ph);
      ctx.globalAlpha = 0.9;
      ctx.drawImage(f0, fx - vr * 0.3 * f, -fo - vr * (0.55 + (k === 1 ? 0.35 : 0)) - vr * 0.8 * f, vr * 0.6 * f, vr * 0.85 * f);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
// 엘리트 금관 (작은 왕관 + 붉은 보석)
function eliteCrown() {
  return bake('u:ecrown', 22, 16, x => { LW = 2.4; x.translate(0, 10); crown(x, 0, 0, 30, 20); });
}

// 바닥 연출: 도발 오라 · 이동 마커 · 궁극기 바닥 마법진 · 심판 예고
export function drawGroundFx(view) {
  const h = view.heroUnit, hero = view.hero;
  if (h && hero && h.state !== 'down') {
    const R = h.engageR || 0;
    if ((h.cls || hero.cls) === 'knight' && R > 60) { // 도발 오라
      // 바닥에 눕힌 옅은 룬 고리(원근) — 채운 빛 없음. 도발 범위 안에 적이 들어오면(끌어당길 때만) 잠깐 밝아진다
      let pull = false;
      for (const e of view.enemies) if (!e.dead && (e.x - h.x) ** 2 + (e.y - h.y) ** 2 < R * R) { pull = true; break; }
      HF.taunt = clamp((HF.taunt || 0) + (pull ? 3 : -1.5) * frameDt, 0, 1);
      additive(true);
      groundRune(runeCircle('#ffc070'), h.x, h.y + 14, R / 31, RT * 0.25, 0.08 + HF.taunt * (0.1 + 0.04 * Math.sin(RT * 6))); // 옅은 바닥 룬 고리
      additive(false);
      ctx.globalAlpha = 1;
    }
    const m = h.moveTo;
    if (m) { // 탭 이동 마커
      const key = m.x + ',' + m.y;
      if (key !== HF.mvKey) { HF.mvKey = key; HF.cmd = 0.0001; ring(m.x, m.y, 6, 60, 0.35, '#bff4ff', 5); burst(K_STAR, m.x, m.y, 6, 60, 160, 0.4, 12, ['#ffffff', '#8fe8ff'], 0, 3); }
      const a = clamp(m.holdT / 0.8, 0, 1);
      const dist = Math.hypot(m.x - h.x, m.y - h.y);
      if (dist > 24) {
        ctx.globalAlpha = 0.45 * a;
        ctx.setLineDash([6, 8]); ctx.lineDashOffset = -RT * 40;
        ctx.lineWidth = 3; ctx.strokeStyle = '#bff4ff';
        ctx.beginPath(); ctx.moveTo(h.x, h.y + 14); ctx.lineTo(m.x, m.y); ctx.stroke();
        ctx.setLineDash([]);
      }
      additive(true);
      groundRune(runeCircle('#8fe8ff'), m.x, m.y, 0.95 + 0.06 * Math.sin(RT * 6), RT * 2, 0.9 * a);
      ctx.globalAlpha = 0.5 * a;
      spr(gl('#8fe8ff'), m.x, m.y, 80, 30);
      additive(false);
      const by = m.y - 30 - Math.abs(Math.sin(RT * 6)) * 9;
      ctx.globalAlpha = a;
      ctx.beginPath(); ctx.moveTo(m.x - 9, by - 8); ctx.lineTo(m.x + 9, by - 8); ctx.lineTo(m.x, by + 4); ctx.closePath();
      ctx.fillStyle = '#bff4ff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#22163a'; ctx.stroke();
      ctx.globalAlpha = 1;
    } else HF.mvKey = '';
  }
}

// 돌 골렘
export function drawGolem(view) {
  const g = view.spellFx && view.spellFx.golem;
  if (!g) return;
  const feet = g.y + 38;
  spr(shadow(), g.x, feet, 120, 30);
  if (g.hp <= 0) { place(g.x, feet, 0, 1, 1); put(rubbleSpr()); wt(); return; }
  const drop = GF.pop < 0.5 ? -((1 - GF.pop / 0.5) ** 2) * 140 : 0;
  const pop = GF.pop < 0.5 ? 1 : easeBack(Math.min(1, (GF.pop - 0.5) / 0.5)) * 0.1 + 0.9;
  const br = Math.sin(T * 1.8) * 0.015, hit = GF.hit;
  const body = golemSpr();
  place(g.x + Math.sin(RT * 60) * hit * 3, feet + drop, 0, pop * (1 + 0.08 * hit), pop * (1 + br - 0.07 * hit));
  put(body);
  if (hit > 0) { ctx.globalAlpha = hit * 0.8; put(tintOf(body, '#ffffff')); ctx.globalAlpha = 1; }
  additive(true);
  ctx.globalAlpha = 0.55 + 0.3 * Math.sin(T * 3);
  spr(gl('#ff6fd2'), 0, -55, 44, 44);
  ctx.globalAlpha = 0.9;
  spr(gl('#ff9ae6'), -5.5, -95, 16, 12);
  spr(gl('#ff9ae6'), 5.5, -95, 16, 12);
  additive(false);
  ctx.globalAlpha = 1;
  wt();
  // 체력바
  const w = 84, x = g.x - w / 2, y = feet - 134 + drop, r = clamp(g.hp / Math.max(1, g.maxHp), 0, 1);
  ctx.fillStyle = 'rgba(20,12,36,0.85)'; rr(x - 2, y - 2, w + 4, 11, 5); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#ff9ae6'; ctx.stroke();
  const gg = ctx.createLinearGradient(0, y, 0, y + 7);
  gg.addColorStop(0, '#9dff9a'); gg.addColorStop(0.5, '#9dff9a'); gg.addColorStop(0.52, '#27ae4a'); gg.addColorStop(1, '#27ae4a');
  ctx.fillStyle = gg; ctx.fillRect(x, y, w * r, 7);
}
// 저주 낙인 + 기절 별 (적 위)
function drawEnemyMarks(view, order) {
  const curse = !!(view.spells && view.spells.curseMark);
  // 저주 낙인(전체 저주)은 잡몹 머리 위 문양 대신 발밑 보라 빛 웅덩이 — 떼 전체에 아이콘이 떠 어지럽지 않게.
  // 머리 위 문양은 보스와 개별 저주(주황)만
  const sig = e => e.cursed || e.isBoss;
  const cg = gl('#b04dff');
  additive(true);
  for (const e of order) {
    if (!(curse || e.cursed)) continue;
    const vr = visR(e), fa = fadeA(visOf(e), e);
    if (!sig(e)) {
      ctx.globalAlpha = (0.42 + 0.12 * Math.sin(T * 3 + e.id)) * fa;
      spr(cg, e.x, e.y + bossDY(e) + vr * (FEET[e.type] ?? 0.88), vr * 2.4, vr * 0.8);
      continue;
    }
    ctx.globalAlpha = 0.45 * fa;
    spr(gl(e.cursed && !curse ? '#ffb84a' : '#b04dff'), e.x, e.y + bossDY(e) - vr * 1.15 - 16, 40, 40);
  }
  additive(false);
  ctx.globalAlpha = 1;
  for (const e of order) {
    if (!(curse || e.cursed) || !sig(e)) continue;
    const s = (e.isBoss ? 32 : 22) * (1 + 0.06 * Math.sin(T * 4 + e.id));
    place(e.x, e.y + bossDY(e) - visR(e) * 1.15 - 16 + Math.sin(T * 2.5 + e.id) * 2, Math.sin(T * 1.5 + e.id) * 0.2, 1, 1);
    const img = curseSigil(e.cursed ? '#ffae3a' : '#b04dff');
    ctx.drawImage(img, -s / 2, -s / 2, s, s);
  }
  wt();
  if (!stuns.size) return;
  additive(true);
  for (const e of order) {
    const t = stuns.get(e.id);
    if (!(t > RT)) continue;
    for (let k = 0; k < 3; k++) {
      const a = RT * 5 + k * TAU / 3;
      const vr = visR(e);
      spr(sparkle('#ffe45a'), e.x + Math.cos(a) * vr * 0.7, e.y + bossDY(e) - vr * 1.0 + Math.sin(a) * vr * 0.2, 16, 16);
    }
  }
  additive(false);
}

// ── 영웅 ──
// 전장 전체를 누비는 자율 전투(DESIGN '영웅 특성 트리 & 자율 전투'): 걸음/달리기(gait) · 바라보는 쪽 전환(종이 뒤집듯) ·
// 클래스별 공격 준비(windup) → 타격 · 후퇴(절뚝임·몸 기울임·붉은 맥박) · 집결 지점 두리번 · 뒷걸음 카이팅(다리가 거꾸로)
const LEG_COL = { cleric: '#c8b888', assassin: '#1e1a2e' };
// 몸 한 벌(다리 + 망토 + 몸 + 무기). 영웅과 소환 분신이 같이 쓴다. o.tint = 덮개 색(분신), o.glowTip = 무기 끝 충전 빛
function figure(cls, tier, eq, x, fy, face, o) {
  const rar = k => (eq && eq[k] && eq[k].rarity) || null;
  const body = heroBody(cls, tier, rar('armor'), rar('helm'));
  const sx = face * (o.pop || 1) * HS, sy = (o.pop || 1) * HS * (o.sy || 1), bob = o.bob || 0, lean = o.lean || 0;
  const tintC = o.tint, tA = o.tintA || 0;
  if (eq && eq.cape && !tintC) {
    place(x - face * 3 * HS, fy - 40 * HS + bob, lean, sx, sy);
    ctx.transform(1, 0, -0.1 * Math.sin(RT * 3.2) - (o.moving ? (o.run ? 0.34 : 0.2) : 0.04), 1, 0, 0);
    put(heroCape(rar('cape')));
  }
  // 다리: 걸음 위상 ph, 달리기는 보폭·들림이 크다
  place(x, fy, lean, sx, (o.pop || 1) * HS);
  const stride = o.run ? 7 : 5, lift = o.run ? 5 : 3;
  for (const k of [-1, 1]) {
    const q = o.ph + (k > 0 ? 0 : Math.PI);
    const sw = o.moving ? Math.sin(q) * stride : 0, up = o.moving ? Math.max(0, Math.sin(q)) * lift : 0;
    rr(k * 5 + sw - 4.5, -17 - up, 9, 16, 4);
    ctx.fillStyle = tintC || LEG_COL[cls] || '#5a3a2a'; ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = '#22163a'; ctx.stroke();
  }
  place(x + (o.recoil || 0) * face, fy + bob, lean, sx, sy);
  put(body);
  if (tintC) { ctx.globalAlpha = (o.alpha ?? 1) * tA; put(tintOf(body, tintC)); ctx.globalAlpha = o.alpha ?? 1; }
  if (o.hurt > 0) { ctx.globalAlpha = o.hurt; put(tintOf(body, '#ffffff')); ctx.globalAlpha = 1; }
  if (o.redA > 0) { ctx.globalAlpha = o.redA; put(tintOf(body, '#ff4a5a')); ctx.globalAlpha = 1; }
  if (o.gold > 0) { ctx.globalAlpha = o.gold; put(tintOf(body, '#ffe07a')); ctx.globalAlpha = 1; }
  // 무기
  ctx.translate(HERO_GRIP.x, HERO_GRIP.y);
  ctx.rotate(o.wAng);
  const wr = rar('weapon') || 'common', wimg = heroWeapon(cls, wr);
  if (!tintC && (wr === 'epic' || wr === 'legend' || wr === 'rare')) {
    additive(true);
    ctx.globalAlpha = 0.35 + 0.2 * Math.sin(RT * 5);
    spr(gl(RARITY_COL[wr][0]), 0, -26, 30, 62);
    additive(false);
    ctx.globalAlpha = 1;
  }
  put(wimg);
  if (tintC) { ctx.globalAlpha = (o.alpha ?? 1) * tA; put(tintOf(wimg, tintC)); ctx.globalAlpha = o.alpha ?? 1; }
  if (o.glowTip > 0) { // 공격 준비: 지팡이 오브·철퇴 머리에 모이는 빛
    const tip = cls === 'sorcerer' ? -50 : cls === 'cleric' ? -36 : -40, c = cls === 'sorcerer' ? '#c08aff' : cls === 'cleric' ? '#ffe07a' : '#ffffff';
    additive(true);
    ctx.globalAlpha = o.glowTip;
    spr(gl(c), 0, tip, 20 + 34 * o.glowTip, 20 + 34 * o.glowTip);
    additive(false);
    ctx.globalAlpha = 1;
  }
  wt();
  return body;
}

export function drawHero(view) {
  const h = view.heroUnit, hero = view.hero;
  if (!h || !hero) return;
  const cls = h.cls || hero.cls;
  if (!cls) return;
  const eq = hero.equip || {}, rar = k => (eq[k] && eq[k].rarity) || null;
  const tier = clamp(h.tier | 0, 0, 4);
  const body = heroBody(cls, tier, rar('armor'), rar('helm'));
  HF.body = body;
  const dt = frameDt, fx = h.x, fy = warpY(h.x, h.y) + 14; // 보스 등장 구간에선 보스와 같은 왜곡
  const down = h.state === 'down';
  // 바라보는 쪽: 종이를 뒤집듯 0.1초에 걸쳐 돈다(두리번·표적 전환이 딱 끊기지 않게)
  const want = h.facing < 0 ? -1 : 1;
  if (!HF.face) HF.face = want;
  const pf = HF.face;
  HF.face = clamp(HF.face + clamp(want - HF.face, -14 * dt, 14 * dt), -1, 1);
  if (Math.sign(pf) !== Math.sign(HF.face) && h.mode === 'rally') HF.turn = 1; // 두리번 순간 톡
  HF.turn = Math.max(0, (HF.turn || 0) - dt * 5);
  const face = HF.face >= 0 ? 1 : -1, fscale = Math.max(0.12, Math.abs(HF.face));
  const mv = Math.hypot(h.x - HF.lx, h.y - HF.ly);
  HF.lx = h.x; HF.ly = h.y;
  const gait = down ? 'idle' : h.gait || (mv > 0.3 && mv < 40 ? 'walk' : 'idle');
  const moving = gait !== 'idle', run = gait === 'run', retreat = h.mode === 'retreat';
  // 뒷걸음(카이팅): 이동 방향이 바라보는 쪽과 반대면 다리를 거꾸로 돌린다
  const back = moving && (h.vx || 0) * face < -20 ? -1 : 1;
  if (moving) HF.walk += (retreat ? 8 : run ? 15 : 10) * dt * back;
  const ph = HF.walk;
  // 걸음 들썩임: 후퇴는 한쪽 다리를 저는 비대칭 박자
  const s = Math.sin(ph);
  let bob = moving ? -Math.abs(s) * (run ? 4.5 : 3.2) : 0;
  if (retreat && moving) bob = -(Math.sin(ph) > 0 ? Math.abs(s) * 5.5 : Math.abs(s) * 1.2);
  const tierCol = RARITY_COL[TIER_RARITY[tier]][0];
  // 그림자 + 티어 오라
  ctx.globalAlpha = 0.9;
  spr(shadow(), fx, fy, 64, 19);
  ctx.globalAlpha = 1;
  if (tier >= 2 && !down) {
    additive(true);
    ctx.globalAlpha = 0.4 + 0.15 * Math.sin(RT * 3);
    spr(gl(tierCol), fx, fy, 110, 34);
    if (tier >= 3) groundRune(runeCircle(tierCol), fx, fy, 1.25, RT * 1.2, 0.55);
    additive(false);
    ctx.globalAlpha = 1;
  }
  if (down) { drawHeroDown(h, body, face, fx, fy); return; }
  // 달리기: 발밑 흙먼지
  if (run && rnd() < dt * 9) part(K_SMOKE, fx - face * 10, fy - 2, -face * 30, -12, 0.45, 18, 'rgba(215,200,170,0.45)', 0, 2);
  const pop = HF.pop < 1 ? easeBack(HF.pop) : 1;
  // 공격: 준비(h.windup 0→1, 타격 전) → 타격(heroAttack 이벤트 후 HF.atk 0→0.3)
  const au = clamp(HF.atk / 0.3, 0, 1), striking = HF.atk < 0.3, wu = h.state === 'attack' ? clamp(h.windup || 0, 0, 1) : 0;
  const prep = !striking ? clamp((wu - 0.45) / 0.55, 0, 1) : 0, pe = easeOut(prep);
  let wAng, lean = 0, recoil = 0, sy = 1, glowTip = 0;
  if (cls === 'knight' || cls === 'cleric' || cls === 'assassin') {
    const idle = cls === 'assassin' ? 1.7 : 0.45;
    const back = cls === 'assassin' ? 2.6 : -1.35; // 암살자는 단검을 뒤로 젖힌다
    if (striking) {
      wAng = au < 0.35 ? lerp(back, cls === 'assassin' ? -0.6 : 2.3, easeOut(au / 0.35)) : lerp(cls === 'assassin' ? -0.6 : 2.3, idle, (au - 0.35) / 0.65);
      lean = au < 0.5 ? 0.12 : 0;
    } else if (prep > 0) { wAng = lerp(idle, back, pe); lean = -0.06 * pe; sy = 1 - (cls === 'assassin' ? 0.06 : 0.02) * pe; }
    else wAng = idle + Math.sin(RT * 2.4) * 0.05 + (moving ? Math.sin(ph) * (run ? 0.3 : 0.15) : 0);
    if (cls === 'cleric') glowTip = Math.max(pe, striking ? 1 - au : 0) * 0.9;
  } else if (cls === 'ranger') {
    const aim = Math.atan2(HF.ty - (fy - 30 * HS), Math.max(1, (HF.tx - fx) * face));
    wAng = striking || prep > 0 ? clamp(aim, -1.2, 1.2) : 0.12 + (moving ? Math.sin(ph) * 0.1 : 0);
    if (striking) recoil = -3 * (1 - au);
    else if (prep > 0) { recoil = -2 * pe; lean = -0.04 * pe; }
  } else { // 마법사: 지팡이를 들어 오브에 마력을 모은다 → 휘둘러 발사
    wAng = striking ? lerp(1.1, 0.15, au) : prep > 0 ? lerp(0.15, -0.5, pe) : 0.15 + Math.sin(RT * 2) * 0.05;
    lean = striking && au < 0.5 ? 0.06 : 0;
    glowTip = Math.max(pe, striking ? 1 - au : 0);
  }
  if (moving && !striking && prep <= 0) lean += (run ? 0.12 : 0.05) * back; // 달릴 땐 앞으로 기운다
  if (retreat) { lean = -0.1; wAng += cls === 'ranger' ? 0 : 0.5; } // 후퇴: 몸을 뒤로 빼고 무기를 늘어뜨림
  // 명령 제스처: 탭 이동 직후 무기를 앞으로 겨누며 살짝 뛰어오름
  const cmd = HF.cmd > 0 ? Math.sin(Math.min(1, HF.cmd) * Math.PI) : 0;
  if (cmd > 0 && !striking) wAng = lerp(wAng, cls === 'ranger' ? -0.5 : -1.25, cmd);
  const hop = -cmd * 6 - Math.sin(HF.turn * Math.PI) * 3;
  sy *= 1 + (moving ? 0 : 0.018 * Math.sin(RT * 2.4)) + cmd * 0.04;
  if (tier >= 4) { // 전설: 빛의 날개
    additive(true);
    ctx.globalAlpha = 0.65 + 0.2 * Math.sin(RT * 3);
    const wf = 1 + 0.06 * Math.sin(RT * 4);
    spr(lightWings('#ffd23a'), fx, fy - 42 * HS + bob, 150 * wf, 80);
    additive(false);
    ctx.globalAlpha = 1;
  }
  const buff = RT < warcryUntil;
  if (buff) { // 전군 강화: 발밑 금빛 룬 + 불꽃
    additive(true); groundRune(runeCircle('#ffb03a'), fx, fy, 1.5, RT * 2, 0.6); additive(false);
    if (rnd() < 0.3) part(K_GLOW, fx + (rnd() - 0.5) * 50, fy - rnd() * 20, 0, -150, 0.5, 11, '#ffd23a', 0, 1);
  }
  // 궁수: 시위에 건 화살(준비 중 당겨짐)
  figure(cls, tier, eq, fx, fy + hop, face * fscale, {
    pop, ph, moving, run, wAng, lean: lean * face, bob, sy, recoil, glowTip, hurt: HF.hurt,
    redA: retreat ? 0.12 + 0.12 * Math.sin(RT * 9) : 0,
    gold: h.invulnT > 0 ? 0.25 + 0.15 * Math.sin(RT * 12) : 0,
  });
  if (cls === 'ranger' && prep > 0.2) {
    const a = wAng, gx = fx + face * (HERO_GRIP.x + recoil) * HS, gy = fy + hop + bob + HERO_GRIP.y * HS;
    place(gx, gy, face > 0 ? a : Math.PI - a, 1.1, 1.1);
    ctx.drawImage(arrowSpr(), -18 - 8 * pe + 6, -5, 36, 10);
    wt();
  }
  if (retreat && rnd() < dt * 3) part(K_GLOW, fx + face * 12, fy - 92, face * 30, -40, 0.5, 10, '#bfe9ff', 300, 1); // 땀방울
  const wr = rar('weapon') || 'common';
  if (wr === 'legend' && rnd() < 0.25) part(K_STAR, fx + face * 18 + (rnd() - 0.5) * 26, fy - 66 - rnd() * 40, 0, -40, 0.5, 10, '#ffe45a', 0, 1);
  // 무적 방패 돔
  if (h.invulnT > 0) {
    const da2 = Math.min(1, h.invulnT * 3);
    additive(true);
    groundRune(runeCircle('#ffc94a'), fx, fy, 2.6, -RT * 0.8, 0.5 * da2);
    additive(false);
    ctx.globalAlpha = da2 * (0.85 + 0.15 * Math.sin(RT * 8));
    place(fx, fy - 48, RT * 0.35, 1, 1);
    spr(shieldDome(), 0, 0, 170, 170);
    wt();
    ctx.globalAlpha = 1;
  }
  if (cls === 'cleric') { // 성직자 후광 링 (실루엣 표식)
    additive(true);
    const hy = fy - 84 * HS + bob + hop + Math.sin(RT * 2.2) * 1.5;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 4; ctx.strokeStyle = '#ffe07a';
    ctx.beginPath(); ctx.ellipse(fx + face * 2, hy, 17, 5.5, 0, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.5;
    spr(gl('#fff0a8'), fx + face * 2, hy, 56, 22);
    additive(false);
    ctx.globalAlpha = 1;
  }
  heroBar(h, fx, fy - (cls === 'sorcerer' ? 116 : 104) * HS - 4, cls, retreat);
}

// ── 영웅 소환물 (늑대 · 그림자 분신 · 비전 분신) — game.summons ──
const SUM = new Map(); // id → { pop, walk, face, lx, ly, atk }
// 영혼 늑대(옆모습, 발 = 원점, 오른쪽을 봄). 다리는 그릴 때 따로(걸음)
function wolfSpr() {
  return bakeO('u:wolf', 40, 30, 12, x => finish(x, q => {
    q.beginPath(); q.moveTo(-18, -24); q.quadraticCurveTo(-34, -30, -36, -44); q.quadraticCurveTo(-28, -38, -22, -40); q.quadraticCurveTo(-30, -30, -16, -18); q.closePath();
    fs(q, cel(q, -36, -44, -16, -18, '#bcd8f4'), 3, INK2);
    ell(q, -2, -22, 21, 12); fs(q, cel(q, -23, -34, 19, -10, '#d8ecff'), 3.2, INK2);
    q.beginPath(); q.moveTo(8, -30); q.quadraticCurveTo(14, -18, 8, -12); q.quadraticCurveTo(2, -18, 4, -28); q.closePath(); fs(q, '#f4faff', 1.6, INK2);
    for (const [a, b] of [[10, 22], [17, 28]]) { poly(q, [a, -38, a + 3, -52, b, -38]); fs(q, cel(q, a, -52, b, -38, '#c8e0fa'), 2.6, INK2); poly(q, [a + 2.5, -40, a + 3.5, -48, b - 2.5, -40]); q.fillStyle = '#ffb8d8'; q.fill(); }
    circ(q, 18, -32, 11.5); fs(q, cel(q, 6.5, -43.5, 29.5, -20.5, '#e4f2ff'), 3.2, INK2);
    ell(q, 29, -28, 8, 5.5); fs(q, '#f4faff', 2.6, INK2);
    circ(q, 36, -30, 2.6); q.fillStyle = INK2; q.fill();
    ell(q, 21, -34, 2.6, 3.2); fs(q, '#5ff0ff', 1.4, INK2);
    circ(q, 20.5, -35, 1); q.fillStyle = '#fff'; q.fill();
    rrect(q, 4, -28, 6, 10, 2); fs(q, '#5ff0ff', 1.4, INK2); // 룬 목걸이
    circ(q, 7, -20, 2.4); fs(q, '#ffe45a', 1.2, INK2);
  }, 0, HERO_RIM, 1.4, 2.2), S * 1.25);
}
export function drawSummons(view) {
  const ss = view.summons, hero = view.hero;
  if (!ss || !ss.length || !hero || !hero.cls) { if (SUM.size) SUM.clear(); return; }
  const dt = frameDt, h = view.heroUnit, tier = clamp((h && h.tier) | 0, 0, 4), eq = hero.equip || {};
  const seen = new Set();
  for (const s of ss) {
    seen.add(s.id);
    let v = SUM.get(s.id);
    if (!v) SUM.set(s.id, v = { pop: 0, walk: rnd() * 6, face: s.facing < 0 ? -1 : 1, atk: 9 });
    v.pop = Math.min(1, v.pop + dt * 2.6);
    v.face = clamp(v.face + clamp((s.facing < 0 ? -1 : 1) - v.face, -12 * dt, 12 * dt), -1, 1);
    const moving = s.gait && s.gait !== 'idle', run = s.gait === 'run';
    if (moving) v.walk += (run ? 16 : 10) * dt;
    if (s.state === 'attack' && s.windup < 0.15 && v.atk > 0.25) v.atk = 0; // 방금 물었다/베었다
    v.atk += dt;
    const face = v.face >= 0 ? 1 : -1, fsc = Math.max(0.15, Math.abs(v.face)), pop = easeBack(v.pop);
    const x = s.x, fy = warpY(s.x, s.y) + 10;
    if (s.kind === 'wolf') {
      const lunge = v.atk < 0.2 ? Math.sin(v.atk / 0.2 * Math.PI) * 12 : s.state === 'attack' ? -3 * clamp(s.windup, 0, 1) : 0;
      spr(shadow(), x, fy, 56, 15);
      additive(true); ctx.globalAlpha = 0.35 + 0.1 * Math.sin(RT * 4 + s.id); spr(gl('#8fe8ff'), x, fy - 22, 90, 60); additive(false); ctx.globalAlpha = 1;
      const bob = moving ? -Math.abs(Math.sin(v.walk)) * (run ? 5 : 3) : Math.sin(RT * 3 + s.id) * 0.8;
      place(x + face * lunge, fy, 0, face * fsc * pop, pop);
      for (const [lx, o2] of [[-15, 0], [-8, Math.PI], [9, Math.PI * 0.5], [16, Math.PI * 1.5]]) { // 네 다리 (대각 박자)
        const q = v.walk + o2, sw = moving ? Math.sin(q) * (run ? 6 : 4) : 0, up = moving ? Math.max(0, Math.sin(q)) * 3 : 0;
        rr(lx + sw - 3, -14 - up, 6, 14, 3); ctx.fillStyle = '#b8d4f0'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = INK2; ctx.stroke();
      }
      place(x + face * lunge, fy + bob, moving ? 0.05 : 0, face * fsc * pop, pop * (1 + 0.02 * Math.sin(RT * 3 + s.id)));
      put(wolfSpr());
      wt();
      if (run && rnd() < dt * 6) part(K_GLOW, x - face * 20, fy - 20, -face * 30, -20, 0.4, 10, '#bff4ff', 0, 1);
    } else {
      // 그림자 분신 = 보랏빛 어둠의 영웅 · 비전 분신 = 떠 있는 반투명 보라 영웅(바닥 룬)
      const arc = s.kind === 'arcane', fl = arc ? -12 + Math.sin(RT * 2.4 + s.id) * 4 : 0;
      const wu = s.state === 'attack' ? clamp(s.windup, 0, 1) : 0, strike = v.atk < 0.3;
      const cls = hero.cls, melee = cls === 'knight' || cls === 'cleric' || cls === 'assassin';
      const wAng = melee ? (strike ? lerp(2.3, 0.45, v.atk / 0.3) : lerp(0.45, -1.2, wu)) : strike ? 0.6 : 0.15 + wu * -0.5;
      spr(shadow(), x, fy, 56, 16);
      additive(true);
      if (arc) groundRune(runeCircle('#c08aff'), x, fy, 1.1, RT * 1.4, 0.55);
      ctx.globalAlpha = arc ? 0.5 : 0.4; spr(gl(arc ? '#a07aff' : '#7a2ac8'), x, fy - 45, 90, 120);
      additive(false);
      ctx.globalAlpha = arc ? 0.62 : 0.82;
      figure(cls, tier, eq, x, fy + fl, face * fsc, { pop, ph: v.walk, moving: moving && !arc, run, wAng, bob: 0, tint: arc ? '#a88aff' : '#5a2a9a', tintA: arc ? 0.55 : 0.62, alpha: ctx.globalAlpha });
      ctx.globalAlpha = 1;
      additive(true); // 눈빛 / 가장자리 빛
      ctx.globalAlpha = 0.8;
      spr(gl(arc ? '#e0d0ff' : '#ff5ab0'), x + face * 7 * HS, fy + fl - 54 * HS, 16, 10);
      additive(false);
      ctx.globalAlpha = 1;
      if (!arc && rnd() < dt * 5) part(K_SMOKE, x + (rnd() - 0.5) * 30, fy - rnd() * 60, 0, -30, 0.6, 24, 'rgba(60,20,90,0.45)', 0, 1);
      if (arc && rnd() < dt * 6) part(K_STAR, x + (rnd() - 0.5) * 40, fy - 20 - rnd() * 80, 0, -40, 0.6, 10, '#d8c0ff', 0, 1);
    }
  }
  for (const id of SUM.keys()) if (!seen.has(id)) SUM.delete(id);
  wt();
}

function drawHeroDown(h, body, face, fx, fy) {
  const t = HF.down, e = Math.min(1, t / 0.35);
  place(fx, fy, -face * 1.45 * easeOut(e), face * HS, HS);
  put(body);
  ctx.globalAlpha = 0.5 * e;
  put(tintOf(body, '#3a3050'));
  ctx.globalAlpha = 1;
  wt();
  if (t > 0.3) { // 영혼이 떠오름
    const g = ((t - 0.3) % 2.2) / 2.2;
    place(fx + Math.sin(t * 3) * 6, fy - 10 - g * 90, 0, face * HS, HS);
    ctx.globalAlpha = (1 - g) * 0.55;
    put(tintOf(body, '#dff4ff', 0.9));
    ctx.globalAlpha = 1;
    wt();
  }
  // 부활 카운트다운 링
  const max = clamp(6 + (h.level | 0) * 0.12, 6, 18), left = Math.max(0, h.respawnT || 0);
  const cx = fx, cy = fy - 84;
  ctx.fillStyle = 'rgba(20,12,36,0.8)';
  ctx.beginPath(); ctx.arc(cx, cy, 17, 0, TAU); ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#ffd23a';
  ctx.beginPath(); ctx.arc(cx, cy, 14, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - left / max)); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = '#22163a';
  ctx.beginPath(); ctx.arc(cx, cy, 17, 0, TAU); ctx.stroke();
  txt(String(Math.ceil(left)), cx, cy + 1, 16, '#ffffff', '#22163a', 4);
}
function heroBar(h, x, y, cls, hurt) {
  numZone('hero', x + 6, y + 4, 108, 30); // 영웅 체력바·Lv 위엔 데미지 숫자를 올리지 않는다
  const w = 56, bh = 8, r = h.hp < 0 ? 1 : clamp(h.hp / Math.max(1, h.maxHp), 0, 1); // hp -1 = 방금 생성(가득)
  ctx.fillStyle = 'rgba(20,12,36,0.85)';
  rr(x - w / 2 - 2, y - 2, w + 4, bh + 4, 5); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#22163a'; ctx.stroke();
  const c = r > 0.5 ? ['#9dff9a', '#27ae4a'] : r > 0.25 ? ['#ffe27a', '#e0a010'] : ['#ff8a7a', '#d0201a'];
  if (hurt) { ctx.lineWidth = 2.5; ctx.strokeStyle = `rgba(255,80,90,${0.5 + 0.5 * Math.sin(RT * 10)})`; rr(x - w / 2 - 3, y - 3, w + 6, bh + 6, 6); ctx.stroke(); }
  const g = ctx.createLinearGradient(0, y, 0, y + bh);
  g.addColorStop(0, c[0]); g.addColorStop(0.5, c[0]); g.addColorStop(0.52, c[1]); g.addColorStop(1, c[1]);
  ctx.fillStyle = g;
  ctx.fillRect(x - w / 2, y, w * r, bh);
  spr(classIcon(cls), x - w / 2 - 11, y + bh / 2, 26, 26);
  txt('Lv' + (h.level | 0), x + w / 2 + 4, y + bh / 2 + 1, 13, '#ffffff', '#22163a', 4, 'left');
}
export function drawAfter() {
  for (const a of AFTER) {
    if (a.life <= 0 || !a.img) continue;
    ctx.globalAlpha = (a.life / a.max) * 0.6;
    place(a.x, a.y, 0, a.face * HS, HS);
    put(tintOf(a.img, '#6a2a9a'));
  }
  wt();
  ctx.globalAlpha = 1;
}

export function drawGhosts(view) {
  const gs = view.spellFx && view.spellFx.ghosts;
  if (!gs || !gs.length) return;
  const img = ghostSpr();
  additive(true);
  for (const q of gs) {
    const t = q.tgt, face = t && t.x < q.x ? -1 : 1;
    ctx.globalAlpha = 0.55;
    spr(gl('#b48aff'), q.x - face * 12, q.y + 4, 44, 30);
    ctx.globalAlpha = 0.3;
    spr(gl('#9a3dff'), q.x - face * 26, q.y + 6, 30, 20);
  }
  additive(false);
  ctx.globalAlpha = 0.92;
  for (const q of gs) {
    const t = q.tgt, face = t && t.x < q.x ? -1 : 1;
    place(q.x, q.y + Math.sin(RT * 8 + q.x * 0.05) * 3, Math.sin(RT * 6 + q.y) * 0.12, face, 1);
    ctx.drawImage(img, -img.hw, -img.hh, img.hw * 2, img.hh * 2);
  }
  wt();
  ctx.globalAlpha = 1;
}

export function drawDragon(view) {
  const d = view.spellFx && view.spellFx.dragon;
  if (!d) return;
  const holy = (view.fusions || []).includes('guardianDragon');
  const face = Math.cos(d.angle) >= 0 ? 1 : -1, breath = d.breathT > 0;
  const x = d.x, y = d.y + Math.sin(RT * 3.2) * 6;
  const pop = (DF.pop < 1 ? easeBack(DF.pop) : 1) * 1.35;
  const tilt = breath ? 0.4 : Math.sin(RT * 2) * 0.06;
  additive(true);
  if (breath) { // 아래로 쏟아지는 브레스
    const mx = x + face * 44, my = y + 16, hgt = WALL_Y - my, fl = 0.85 + 0.15 * Math.sin(RT * 40);
    ctx.globalAlpha = 0.5 * fl;
    spr(gl(holy ? '#fff0a8' : '#ff8a1e'), mx, my + hgt / 2, 130, hgt * 1.05);
    ctx.globalAlpha = 0.7 * fl;
    spr(gl(holy ? '#ffffff' : '#ffe45a'), mx, my + hgt / 2, 54, hgt);
    ctx.globalAlpha = 0.8;
    spr(gl(holy ? '#ffffff' : '#ffb040'), mx, WALL_Y - 20, 180, 60);
  }
  ctx.globalAlpha = holy ? 0.6 : 0.35;
  spr(gl(holy ? '#ffe07a' : '#ff9ae6'), x, y, 110, 90);
  additive(false);
  ctx.globalAlpha = 1;
  const body = babyDragon(holy), wing = babyWing(holy);
  const flap = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(RT * (breath ? 24 : 13)));
  place(x, y, face * tilt, face * pop, pop);
  ctx.save(); ctx.translate(-8, -8); ctx.scale(0.85, flap * 0.9); ctx.globalAlpha = 0.85; put(wing); ctx.restore();
  ctx.globalAlpha = 1;
  ctx.drawImage(body, -body.hw, -body.hh, body.hw * 2, body.hh * 2);
  ctx.save(); ctx.translate(2, -6); ctx.scale(1, flap); put(wing); ctx.restore();
  if (holy) { // 수호룡 후광
    additive(true);
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffe07a';
    ctx.beginPath(); ctx.ellipse(18, -36, 14, 4.5, 0, 0, TAU); ctx.stroke();
    additive(false);
    ctx.globalAlpha = 1;
  }
  wt();
}

// ── 성벽 위 마법사 2명 ──
export function drawMages(view, opts) {
  const duo = view.duo || [];
  const golden = duo.includes('golden'), twin = duo.includes('twin'), frenzy = view.frenzyT > 0;
  const gale = !!(view.spells && view.spells.gale), fireP1 = !!(view.spells && view.spells.flameBullet);
  const pose = [], tiers = [];
  for (let i = 0; i < 2; i++) { // 자세 먼저 (지팡이 오브 위치를 이펙트가 쓴다)
    const p = view.players[i], c = CANNONS[i], M = MF[i];
    const tier = p ? mageTier(p.lv) : 0, side = i === 0 ? 1 : -1;
    const cst = M.cast * M.cast * (3 - 2 * M.cast), br = Math.sin(RT * 2.2 + i * 1.7);
    // 큰 시전(쿨타임 주문): 지팡이를 머리 위로 곧게 치켜들고 몸을 편다
    const bg = M.big > 0.5 ? 1 : M.big * M.big * (3 - 2 * M.big) * 2;
    const sy = 1 + 0.018 * br + 0.05 * cst + 0.05 * bg, sx = 1 - 0.012 * br - 0.03 * cst;
    const gx = c.x + side * MAGE_GRIP.x * sx * MS + side * 8 * bg, gy = MAGE_FEET + MAGE_GRIP.y * sy * MS - 7 * cst - 22 * bg + 30 * (MF.fall || 0);
    const idle = -side * 0.2 + 0.03 * br, aimA = idle + (clamp(M.aim + Math.PI / 2, -1.2, 1.2) - idle) * cst;
    const fall = MF.fall || 0; // 도전 종료: 무너진 성벽 위에서 휘청이며 주저앉음
    const sa = lerp(lerp(aimA, side * 0.06, bg), side * -0.9, fall);
    const ob = STAFF_ORB[tier];
    M.ox = gx - ob.y * MS * Math.sin(sa); M.oy = gy + ob.y * MS * Math.cos(sa);
    M.hx = c.x + side * MAGE_HAND.x * sx * MS; M.hy = MAGE_FEET + MAGE_HAND.y * sy * MS;
    pose.push({ side, cst, br, sx, sy, gx, gy, sa, ob });
    tiers.push(tier);
  }
  if (twin) { // 쌍둥이 포화: 두 오브를 잇는 마력의 호
    additive(true);
    const a = 0.5 + 0.3 * Math.sin(RT * 8);
    for (const [c, w] of [[OWN[0].c, 10], [OWN[1].c, 6], ['#ffffff', 2]]) {
      ctx.globalAlpha = a * (w === 2 ? 1 : 0.5);
      ctx.strokeStyle = c; ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(MF[0].ox, MF[0].oy);
      ctx.quadraticCurveTo(360, MF[0].oy - 90 - 10 * Math.sin(RT * 5), MF[1].ox, MF[1].oy);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    additive(false);
  }
  for (let i = 0; i < 2; i++) {
    const p = view.players[i], c = CANNONS[i], M = MF[i], P = pose[i], tier = tiers[i];
    if (!p) continue;
    const baseCol = i === 0 ? (fireP1 ? '#ff6a1f' : MAGE_PAL[0].orb[1]) : MAGE_PAL[1].orb[1];
    const orbCol = M.cast > 0.15 || M.big > 0.1 ? M.col : baseCol; // 시전 중 오브 = 그 주문 색
    const n = clamp(p.lv ? p.lv.multi | 0 : 0, 0, 5);
    // 오라
    additive(true);
    if (M.ground > 0.02) groundRune(runeCircle(M.col), c.x, MAGE_FEET - 2, 1.5 + 0.5 * (1 - M.ground) + 0.25 * M.big, RT * (1.2 + M.big * 2) * P.side, M.ground * 0.85); // 발밑 룬 (시전 색)
    if (RT < warcryUntil) { // 전군 강화: 발밑 금빛 룬 + 솟아오르는 불꽃(몸을 빛으로 덮지 않게)
      groundRune(runeCircle('#ffb03a'), c.x, MAGE_FEET - 2, 1.9, -RT * 2 * P.side, 0.55 + 0.2 * Math.sin(RT * 9 + i));
      if (rnd() < 0.25) part(K_GLOW, c.x + (rnd() - 0.5) * 70, MAGE_FEET - rnd() * 30, 0, -170, 0.5, 12, rnd() < 0.5 ? '#ffd23a' : '#ff8a2a', 0, 1);
    }
    if (golden) { place(c.x, MAGE_FEET - 70, RT * 0.8 * (i ? -1 : 1), 1, 1); ctx.globalAlpha = 0.55 + 0.2 * Math.sin(RT * 4); spr(rays('#ffd23a'), 0, 0, 180, 180); wt(); }
    if (frenzy) { ctx.globalAlpha = 0.55 + 0.3 * Math.sin(RT * 14); spr(gl('#ff3a1a'), c.x, MAGE_FEET - 70, 180, 210); }
    if (upGlow[i] > 0) { ctx.globalAlpha = upGlow[i]; spr(gl(OWN[i].c), c.x, MAGE_FEET - 70, 160, 190); }
    if (tier >= 2) { ctx.globalAlpha = 0.32 + 0.12 * Math.sin(RT * 2.5 + i); spr(gl(orbCol), c.x, MAGE_FEET - 2, 150, 44); }
    if (tier >= 4) groundRune(runeCircle(orbCol), c.x, MAGE_FEET - 2, 1.85, RT * 0.8 * P.side, 0.6);
    ctx.globalAlpha = 1;
    additive(false);
    spr(shadow(), c.x, MAGE_FEET, 96, 25);
    orbit(i, n, c.x, MAGE_FEET - 60, orbCol, false);
    if (tier >= 1) { // 망토 (흔들림)
      place(c.x, MAGE_FEET - 54 * P.sy * MS + 30 * (MF.fall || 0), 0, P.side * P.sx * MS, P.sy * MS);
      ctx.transform(1, 0, 0.07 * Math.sin(RT * 1.6 + i * 2) - 0.14 * P.cst, 1, 0, 0);
      put(mageCape(i, tier));
    }
    place(c.x, MAGE_FEET + 30 * (MF.fall || 0), -P.side * 0.14 * (MF.fall || 0), P.side * P.sx * MS, P.sy * MS * (1 - 0.08 * (MF.fall || 0)));
    put(mageBody(i, tier));
    if (P.cst > 0.05 || M.big > 0.05) { // 빈손 마력 (큰 시전: 손을 들어 올린 자리까지 빛)
      additive(true);
      ctx.globalAlpha = Math.max(P.cst, M.big);
      spr(gl(orbCol), MAGE_HAND.x, MAGE_HAND.y - 14 * M.big, 28 + 20 * M.big, 28 + 20 * M.big);
      additive(false);
      ctx.globalAlpha = 1;
    }
    place(P.gx, P.gy, P.sa, MS, MS);
    put(mageStaff(i, tier));
    wt();
    // 오브 빛
    additive(true);
    const og = (30 + 14 * P.cst + 10 * M.big + 3 * P.br + tier * 3) * MS;
    ctx.globalAlpha = 0.85;
    spr(gl(orbCol), M.ox, M.oy, og, og);
    if (tier >= 3) { ctx.globalAlpha = 0.35; spr(gl(orbCol), M.ox, M.oy, og * 2.2, og * 2.2); }
    if (frenzy) { ctx.globalAlpha = 0.7; spr(gl('#ff5a1a'), M.ox, M.oy, 50, 50); }
    if (gale && i === 0) { // 질풍: 민트 바람
      ctx.lineWidth = 3; ctx.strokeStyle = '#6ff0c0';
      for (let k = 0; k < 3; k++) {
        const a0 = RT * (5 + k) + k * 2.1;
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.ellipse(c.x, MAGE_FEET - 62, 54 + k * 8, 32 + k * 6, 0, a0, a0 + 1.1); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    additive(false);
    orbit(i, n, c.x, MAGE_FEET - 60, orbCol, true);
    // 이름표
    const tag = i === (opts.myIndex | 0) ? '나' : p.kind === 'bot' ? 'AI' : p.kind === 'remote' ? String(p.name || '').slice(0, 8) : '';
    if (tag) {
      ctx.font = `900 13px ${FONT}`;
      const tw = Math.max(26, ctx.measureText(tag).width + 14);
      ctx.fillStyle = 'rgba(15,8,20,0.8)';
      rr(c.x - tw / 2, MAGE_FEET + 8, tw, 18, 9); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = OWN[i].c; ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = OWN[i].c;
      ctx.fillText(tag, c.x, MAGE_FEET + 17.5);
    }
    if (i === 1) drawAllyBook(view, c);
  }
}
// AI 동료 주문서: 익힌 주문(game.allySpells)을 마법사 오른쪽에 작은 엠블럼 세로 줄로 + 새로 익힐 때 하늘에서 내려와 박힘
function drawAllyBook(view, c) {
  const book = view.allySpells || {}, keys = Object.keys(book);
  const slot = k => ({ x: c.x + 64, y: MAGE_FEET - 104 + k * 34 });
  keys.forEach((key, k) => {
    const learning = key === ALLY.key && ALLY.t < 0.9;
    if (learning) return;
    const { x, y } = slot(k), em = emblem(key);
    ctx.fillStyle = 'rgba(14,20,48,0.88)'; ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#8fe8ff'; ctx.stroke();
    if (em) ctx.drawImage(em, x - 13, y - 13, 26, 26);
    txt(String(book[key] | 0), x + 11, y + 10, 11, '#ffffff', '#0a1a3a', 3.5);
  });
  if (ALLY.t < 1.6 && ALLY.key) { // 새 주문: 빛나는 엠블럼이 위에서 내려와 자리에 박힌다
    const k = Math.max(0, keys.indexOf(ALLY.key)), to = slot(k), u = clamp(ALLY.t / 0.9, 0, 1), e = easeOut(u);
    const x = lerp(c.x, to.x, e), y = lerp(MAGE_FEET - 320, to.y, e), sc = u < 1 ? 1.8 - 0.8 * e : 1 + 0.3 * Math.max(0, 1 - (ALLY.t - 0.9) / 0.3);
    additive(true);
    ctx.globalAlpha = Math.min(1, (1.6 - ALLY.t) * 2);
    place(x, y, RT * 1.5, 1, 1); spr(rays('#8fe8ff'), 0, 0, 120 * sc, 120 * sc); wt();
    spr(gl('#8fe8ff'), x, y, 70 * sc, 70 * sc);
    additive(false);
    ctx.globalAlpha = 1;
    const em = emblem(ALLY.key);
    if (em && u < 1) ctx.drawImage(em, x - 16 * sc, y - 16 * sc, 32 * sc, 32 * sc);
    if (u >= 1 && ALLY.t - frameDt < 0.9) { ring(to.x, to.y, 6, 60, 0.35, '#8fe8ff', 5); burst(K_STAR, to.x, to.y, 10, 60, 200, 0.5, 12, ['#ffffff', '#8fe8ff'], 0, 2); }
  }
}
// 다중 시전 레벨만큼 몸 주위를 도는 마력 구슬 (뒤쪽 반/앞쪽 반)
function orbit(i, n, cx, cy, col, front) {
  if (!n) return;
  const st = i === 0 ? MSTY.p0fire : MSTY.p1;
  for (let k = 0; k < n; k++) {
    const a = RT * 2.2 + k * TAU / n + i, s = Math.sin(a);
    if ((s >= 0) !== front) continue;
    const x = cx + Math.cos(a) * 50, y = cy + s * 15, sz = 10 + 3 * s;
    additive(true);
    ctx.globalAlpha = 0.8;
    spr(gl(col), x, y, 30, 30);
    additive(false);
    ctx.globalAlpha = 1;
    spr(magicCore(st[0], col, st[2]), x, y, sz, sz);
  }
}

// ═════════════ 이벤트 → 유닛 반응 (render.js 가 매 프레임 한 번 호출) ═════════════
export function events(view, evs, opts) {
  let ups = 0, pops = 0;
  for (const ev of evs) {
    switch (ev.type) {
      case 'cast': { // 주문 시전: 지팡이를 겨누고(기본 주문) / 머리 위로 치켜들고(쿨타임 주문) + 오브 앞 마법진 + 발밑 룬
        const o = ev.o === 1 ? 1 : 0, M = MF[o], c = CANNONS[o];
        // 기본 주문(basic)은 SPELL_BY_KEY를 보지 않는다 — 카드 '파이어볼'과 기본 '화염구'가 같은 키
        const sp = ev.basic ? null : SPELL_BY_KEY[ev.spell];
        const col = ev.basic ? (ev.spell === 'frostbolt' ? '#8fe8ff' : '#ff8a2a') : sp && EL[sp.element] ? EL[sp.element][1] : '#ffffff';
        M.cast = 1; M.col = col;
        M.aim = Math.atan2((+ev.ty || 0) - c.y, (+ev.tx || c.x) - c.x);
        if (!ev.basic) {
          M.big = 1; M.ground = 1;
          ring(M.ox, M.oy, 8, 70, 0.35, col, 6);
          burst(K_STAR, M.ox, M.oy, 6, 60, 200, 0.4, 12, ['#ffffff', col], 0, 3);
        } else {
          M.ground = Math.max(M.ground, 0.5);
          if (M.runeT <= 0) { // 오브 앞 마법진 (연사 중엔 0.11초마다)
            M.runeT = 0.11;
            sprPop(runeCircle(col), M.ox, M.oy, 0.45, 0.85, 0.22, M.aim, 4, 0.38);
            part(K_GLOW, M.ox, M.oy, 0, 0, 0.12, 56, col);
          }
        }
        break;
      }
      case 'shoot': { // 다중 시전: 오브에서 부채꼴로 갈라지는 빛 (0.15초마다)
        const o = ev.o === 1 ? 1 : 0, M = MF[o];
        if (!Array.isArray(ev.angles) || ev.angles.length < 3 || M.fanT > 0) break;
        M.fanT = 0.15;
        for (const a of ev.angles) part(K_GLOW, M.ox + Math.cos(a) * 18, M.oy + Math.sin(a) * 18, Math.cos(a) * 260, Math.sin(a) * 260, 0.1, 20, M.col, 0, 4);
        break;
      }
      case 'allySpell':
        ALLY.t = 0; ALLY.key = String(ev.spell || ''); ALLY.level = ev.level | 0;
        break;
      case 'upgrade': {
        const o = ev.o === 1 ? 1 : 0, c = { x: CANNONS[o].x, y: MAGE_FEET - 62 };
        upGlow[o] = 1;
        if (ups++ < 3) {
          ring(c.x, c.y, 20, 70, 0.35, OWN[o].c, 4);
          sprPop(runeCircle(OWN[o].c), c.x, MAGE_FEET - 2, 0.4, 1.3, 0.45, Math.PI / 2, 2, 0.36);
          burst(K_STAR, c.x, c.y - 10, 3, 40, 120, 0.5, 14, OWN[o].c, -60, 2, 80);
        }
        break;
      }
      case 'kill': if (pops++ < 10) deathPop(ev); break;
      case 'heroHit':
        HF.hurt = 1;
        burst(K_SPARK, ev.x, ev.y - 20, 4, 200, 420, 0.16, 2.6, ['#ff5a5a', '#ffffff'], 0, 6);
        break;
      case 'heroDown':
        HF.down = 0.0001;
        burst(K_SMOKE, ev.x, ev.y + 10, 6, 30, 120, 0.9, 40, 'rgba(200,190,210,0.6)', -30, 1.5);
        burst(K_STAR, ev.x, ev.y - 30, 6, 60, 180, 0.6, 14, ['#d8e8ff', '#ffffff'], -40, 2);
        shake(0.15);
        break;
      case 'heroRespawn':
        HF.pop = 0;
        // 성문 부활: 빛기둥 대신 바닥에 펼쳐지는 은은한 룬 고리(+ 작은 반짝) — 전장을 가르는 기둥 없음
        ring(ev.x, ev.y + 10, 10, 90, 0.5, '#ffe07a', 6);
        sprPop(runeCircle('#ffd23a'), ev.x, ev.y + 14, 0.6, 1.8, 0.9, Math.PI / 2, 1.5, 0.36);
        burst(K_STAR, ev.x, ev.y - 30, 14, 80, 260, 0.8, 16, ['#ffffff', '#ffe07a'], -60, 2);
        flash(0.12, '#fff0a8');
        break;
    }
  }
}

// ═════════════ 갱신 ═════════════
export function update(view, da, dt) {
  // 사라진 적의 연출 상태 정리
  if (frameNo % 120 === 0) for (const [id, v] of vis) if (frameNo - v.seen > 60) vis.delete(id);
  for (const e of view.enemies) {
    const v = visOf(e);
    v.age += dt;
    if (v.pop < 1) v.pop = Math.min(1, v.pop + da * 4);
    if (e.named && !e.dead && v.intro < 1) { // 보스 등장: 떨어져 착지 (ART §10.10)
      v.intro = Math.min(1, v.intro + dt / 0.6);
      if (v.intro >= 1 && !v.landed) {
        v.landed = true;
        const vr = visR(e), fy = e.y + bossDY(e);
        if (e.type !== 'goblinChariot') landFx(e, e.x, fy + vr * (FEET[e.type] ?? 0.88), vr);
        ring(e.x, fy + vr * 0.5, vr * 0.5, vr * 1.35, 0.4, GOO_COL[e.type] || '#ff4a6a', 7); // 포효: 보스 색, 작게·짧게
        flash(0.08, '#ff3050');
      }
    }
    if (v.punch > 0) v.punch = Math.max(0, v.punch - da * 7);
    if (v.chroma > -1) v.chroma -= dt;
    // 피격 번쩍임: 새로 맞을 때마다 켜졌다 빨리 꺼짐 (연타 중에도 형체가 보이게)
    const hT = e.hitT || 0;
    if (hT > v.lastH + 0.005 && RT - v.flT >= 0.15) { v.fl = 1; v.flT = RT; } // 적당 150ms에 한 번, 60ms만
    v.lastH = hT;
    v.fl = Math.max(0, v.fl - da * 16);
    // 불타는 적: 불씨
    if (e.slowT > 0 && !e.dead && rnd() < da * 4) part(K_SHARD, e.x + (rnd() - 0.5) * e.r * 1.4, e.y - e.r * rnd(), (rnd() - 0.5) * 20, 30, 0.5, 3.5, rnd() < 0.5 ? '#ffffff' : '#bff4ff', 200, 1);
    if (e.poisonT > 0 && !e.dead && rnd() < da * 5) part(K_GLOW, e.x + (rnd() - 0.5) * e.r, e.y - e.r * 0.5, 0, -50, 0.6, 10, rnd() < 0.5 ? '#9dff5a' : '#4fd02a', 0, 1);
    if (e.burnT > 0 && !e.dead && rnd() < da * 10) part(K_GLOW, e.x + (rnd() - 0.5) * e.r, e.y - e.r * 0.3, (rnd() - 0.5) * 30, -60 - rnd() * 60, 0.5, 9, rnd() < 0.5 ? '#ffb030' : '#ff5a1a', 0, 1);
    if (e.state === 'fuse' && rnd() < da * 20) part(K_SPARK, e.x + e.r * 0.35, e.y - e.r * 1.3, (rnd() - 0.5) * 300, -rnd() * 300, 0.15, 2.5, '#ffe45a', 400, 2);
    if (e.state === 'charge' && rnd() < da * 20) part(K_SMOKE, e.x + (rnd() - 0.5) * e.r * 1.6, e.y - e.r * 0.6, 0, -40, 0.6, 30, 'rgba(160,130,100,0.5)', 0, 1);
    if (e.state === 'cast' && rnd() < da * 30) part(K_GLOW, e.x + (rnd() - 0.5) * e.r * 2, e.y + e.r * 0.5, 0, -120, 0.6, 14, e.type === 'magmaGolem' ? '#ff8a2a' : '#c07aff', 0, 1);
  }
  for (let i = 0; i < 2; i++) upGlow[i] = Math.max(0, upGlow[i] - dt * 3);
  for (const a of AFTER) if (a.life > 0) a.life -= da;
  for (const p of POPS) if (p.life > 0) p.life -= dt;
  MF.fall = view.phase === 'defeat' ? Math.min(1, (MF.fall || 0) + dt * 2.5) : 0;
  for (let i = 0; i < 2; i++) { const M = MF[i]; M.cast = Math.max(0, M.cast - dt * 5); M.runeT -= dt; M.fanT -= dt; M.big = Math.max(0, M.big - dt * 2.2); M.ground = Math.max(0, M.ground - dt * 1.8); }
  ALLY.t += dt;
  HF.atk += da;
  if (HF.cmd > 0) HF.cmd = HF.cmd >= 1 ? 0 : HF.cmd + dt * 3.2;
  HF.hurt = Math.max(0, HF.hurt - dt * 6);
  HF.pop = Math.min(1, HF.pop + da * 2.5);
  const h = view.heroUnit;
  if (h && h.state === 'down') HF.down += da; else HF.down = 0;
  if (frameNo % 60 === 0) for (const [id, t] of stuns) if (t < RT) stuns.delete(id);
  const fx = view.spellFx;
  if (!fx) return;
  // 골렘: 소환 / 피격 반응 / 붕괴
  const g = fx.golem;
  if (g) {
    const feet = g.y + 38;
    if (!GF.on) {
      GF.on = true; GF.pop = 0; GF.lastHp = g.hp;
      sprPop(runeCircle('#ff6fd2'), g.x, feet, 0.8, 2.4, 1, Math.PI / 2, 2, 0.36);
      ring(g.x, feet - 40, 10, 120, 0.5, '#ff9ae6', 8);
    }
    if (g.hp < GF.lastHp - 1e-6) {
      GF.hit = 1;
      burst(K_DEBRIS, g.x, feet - 60, 3, 100, 260, 0.6, 5, ['#a99c8c', '#6a5a50'], 900, 0.5, 100);
      if (g.hp <= 0) { // 붕괴
        burst(K_DEBRIS, g.x, feet - 50, 14, 150, 420, 1, 8, ['#a99c8c', '#6a5a50', '#d8ccb8'], 900, 0.4, 200);
        burst(K_SMOKE, g.x, feet - 20, 8, 40, 140, 1.1, 60, 'rgba(180,170,160,0.6)', -30, 1);
        shake(0.25);
      }
    } else if (g.hp > 0 && GF.lastHp <= 0) GF.pop = 0.4; // 수호룡 치유로 부활
    GF.lastHp = g.hp;
  } else GF.on = false;
  GF.pop = Math.min(1, GF.pop + da * 2);
  GF.hit = Math.max(0, GF.hit - dt * 6);
  // 새끼 드래곤: 소환 + 브레스 입자
  const d = fx.dragon;
  if (d) {
    if (!DF.on) {
      DF.on = true; DF.pop = 0;
      sprPop(runeCircle('#ff6fd2'), d.x, d.y, 0.6, 2, 0.8, 0, 2);
      burst(K_STAR, d.x, d.y, 14, 80, 260, 0.7, 16, ['#ffffff', '#ff9ae6'], 0, 2);
    }
    if (d.breathT > 0) {
      const holy = (view.fusions || []).includes('guardianDragon');
      const face = Math.cos(d.angle) >= 0 ? 1 : -1, mx = d.x + face * 44, my = d.y + 16;
      for (let k = 0; k < 3; k++) {
        part(K_GLOW, mx + (rnd() - 0.5) * 14, my, (rnd() - 0.5) * 140, 520 + rnd() * 300, 0.6 + rnd() * 0.5, 26 + rnd() * 18,
          holy ? (k ? '#fff0a8' : '#ffffff') : ['#ffe45a', '#ff8a1e', '#ff4a1a'][k], 0, 1.5);
      }
      if (holy && rnd() < 0.3) part(K_STAR, 60 + rnd() * 600, WALL_Y - 10, 0, -80, 0.6, 14, '#9dff9a', 0, 1);
    }
  } else DF.on = false;
  DF.pop = Math.min(1, DF.pop + da * 2);
}

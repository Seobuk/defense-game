// 변이(4차) 연출 — 44 변이 각자의 모양(Lv6 완전체 품질). 시뮬 쪽은 mutations.js:
//   · 전장 물체 view.spellFx.mut[{ k, m, t, x, y, … }] (태양 구체·먹구름·빙하 창·소용돌이·낫·기사…) → draw/drawGround가 그린다
//   · 순간 연출 이벤트 mutFx{ m, … } + spell{…, mut} → events가 파티클·번개·광선을 띄운다
//   · 스킬 스택 옆 타이머 view.spellFx.mt(영혼 수·빛의 샘 충전·바람 정령 각도·둘째 용 d2·저주 장막 y)
// 빛은 흰 코어 없는 hu()·원소 색, 형태(창·낫·기사·거울·얼음 감옥)는 보통 합성 — render.js 광량 예산(DESIGN E)을 따른다.
// render.js: events → update → drawGround(서리 결계 위) → draw(새끼 드래곤 뒤, 파티클 앞)
import { WORLD_W, WALL_Y, FRONT_Y, SPELL_BY_KEY } from '../config.js';
import { clamp } from '../util.js';
import { TAU, ctx, RT, T, bake, circ, poly, rad, lin, fs, INK2, wt, place, spr, additive, groundRune, rnd, lerp, easeOut, shake, flash, topExtra, sideX, mulberry, frameNo, setLightPrio, LIGHT_EXEMPT } from './core.js';
import { part, burst, ring, sprPop, hu, soft, flame, runeCircle, starFlash, sparkle, rays, comet, magicCore, iceSpear, curseSigil, slashArc, lightBeam, K_GLOW, K_SPARK, K_STAR, K_SHARD, K_SMOKE, K_DEBRIS } from './fx.js';
import { MF, babyDragon, babyWing, ghostSpr } from './units.js';
import { pop } from './hud.js';
import { MUT_BY_KEY, HEX_H, SPIRITS, spiritAt, MIRRORS } from '../mutations.js';

// ── 순간 연출 풀(번개·광선·레일·베기·예고) ──
const FX = [];
const MAX_FX = 90;
function add(o) { if (FX.length >= MAX_FX) FX.shift(); o.t = 0; o.sd = (rnd() * 1e9) | 0; FX.push(o); return o; }
const BOLT_CAP = 5; // 동시에 보이는 변이 번개 줄기 상한(FX 균형) — 넘치면 가장 최근 줄기를 굵게
function addBolt(o) {
  let live = 0, last = null;
  for (const q of FX) if (q.k === 'bolt') { live++; last = q; }
  if (live >= BOLT_CAP && last) { last.w = Math.min(last.w + 0.15, 1.6); last.t = Math.min(last.t, last.life * 0.3); return last; }
  return add(o);
}
const zig = (x0, y0, x1, y1, n, amp, r = rnd) => { // r: 순간 번개는 자기 시드(프레임마다 떨림 — 다른 연출 수와 무관)
  const pts = [x0, y0], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
  for (let i = 1; i < n; i++) { const u = i / n, o = (r() - 0.5) * 2 * amp * Math.sin(u * Math.PI); pts.push(x0 + dx * u + nx * o, y0 + dy * u + ny * o); }
  pts.push(x1, y1);
  return pts;
};
function path(pts) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); }
// 번개 한 줄기: 헤일로(넓고 옅게) + 원소 색 + 가는 흰 심(≤1.6px) — FX 균형: 번개가 화면을 독점하지 않게 가늘게
function boltLine(pts, col, halo, w, a) {
  additive(true);
  path(pts);
  ctx.globalAlpha = a * 0.26; ctx.strokeStyle = halo; ctx.lineWidth = w * 6; ctx.stroke();
  ctx.globalAlpha = a * 0.85; ctx.strokeStyle = col; ctx.lineWidth = w * 2; ctx.stroke();
  ctx.globalAlpha = a * 0.7; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = Math.min(1.6, w * 0.6); ctx.stroke();
  additive(false);
  ctx.globalAlpha = 1;
}
// 세로 광선(위 → 아래): 넓은 헤일로 + 원소 색 기둥 + 가는 심
function vbeam(x, w, y0, y1, a, col, halo) {
  additive(true);
  ctx.globalAlpha = a * 0.45; spr(hu(halo), x, (y0 + y1) / 2, w * 2.6, y1 - y0 + w);
  ctx.globalAlpha = a * 0.6; spr(hu(col), x, (y0 + y1) / 2, w * 1.1, y1 - y0);
  const cw = Math.min(8, w * 0.1); // 가는 심(흰 기둥 금지)
  ctx.globalAlpha = a * 0.8; ctx.fillStyle = '#fff3c0'; ctx.fillRect(x - cw / 2, y0, cw, y1 - y0);
  additive(false);
  ctx.globalAlpha = 1;
}

// ── 구운 형태(보통 합성) ──
function scytheSpr() { // 사신의 낫: 검은 자루 + 보라 빛 날(+x로 휜 초승달). 원점 = 날 가운데
  return bake('m:scythe', 90, 70, x => {
    x.beginPath(); x.moveTo(-10, 60); x.lineTo(6, -52); x.lineWidth = 7; x.strokeStyle = INK2; x.stroke(); x.lineWidth = 4; x.strokeStyle = '#4a2a6a'; x.stroke();
    x.beginPath(); x.moveTo(6, -52); x.quadraticCurveTo(80, -60, 86, 10); x.quadraticCurveTo(60, -30, 4, -34); x.closePath();
    fs(x, lin(x, 4, -50, 86, 10, [[0, '#2a1440'], [0.55, '#9a3dff'], [1, '#f0d0ff']]), 3, INK2);
    x.beginPath(); x.moveTo(12, -46); x.quadraticCurveTo(70, -50, 80, 0); x.lineWidth = 2; x.strokeStyle = '#ffe0ff'; x.stroke();
  });
}
function mirrorSpr() { // 얼음 거울: 세로 육각 판 + 반사광
  return bake('m:mirror', 26, 44, x => {
    poly(x, [0, -44, 22, -26, 22, 26, 0, 44, -22, 26, -22, -26]);
    fs(x, lin(x, -22, -44, 22, 44, [[0, 'rgba(240,253,255,0.95)'], [0.4, 'rgba(150,225,255,0.75)'], [1, 'rgba(40,110,200,0.8)']]), 3, '#1e4a8a');
    x.globalAlpha = 0.85; x.strokeStyle = '#ffffff'; x.lineWidth = 3;
    x.beginPath(); x.moveTo(-12, -20); x.lineTo(6, -34); x.moveTo(-14, -4); x.lineTo(12, -24); x.stroke();
    x.globalAlpha = 1; poly(x, [0, -34, 14, -20, 14, 20, 0, 34, -14, 20, -14, -20]); x.lineWidth = 1.5; x.strokeStyle = 'rgba(255,255,255,0.6)'; x.stroke();
  });
}
function iceBlockSpr() { // 얼음 감옥: 각진 반투명 결정 덩어리. 원점 = 가운데
  return bake('m:block', 34, 38, x => {
    poly(x, [-26, -30, 6, -38, 30, -18, 32, 22, 4, 36, -28, 26, -34, -6]);
    fs(x, lin(x, -30, -38, 30, 36, [[0, 'rgba(245,253,255,0.8)'], [0.5, 'rgba(140,220,255,0.55)'], [1, 'rgba(50,130,220,0.7)']]), 3, '#1e4a8a');
    x.strokeStyle = 'rgba(255,255,255,0.8)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(-18, -24); x.lineTo(-2, -30); x.moveTo(-24, -10); x.lineTo(-10, -20); x.moveTo(10, 10); x.lineTo(20, -6); x.lineTo(12, -16); x.stroke();
  });
}
function knightMutSpr() { // 망령 기사: 불투명 연보라 갑주 + 청록 발광 외곽선 + 빛나는 눈 + 긴 검(+x). 원점 = 발 (FX 균형: 어두운 동굴·묘지에서도 읽히게)
  return bake('m:knight2', 38, 46, x => {
    const ink = '#1a0c2c', rim = '#9ffcff';
    const torso = () => { x.beginPath(); x.moveTo(-14, 30); x.quadraticCurveTo(-18, 0, -10, -8); x.lineTo(10, -8); x.quadraticCurveTo(18, 0, 14, 30); x.quadraticCurveTo(0, 22, -14, 30); };
    for (const [w, a] of [[9, 0.28], [5.5, 0.7]]) { // 청록 발광 외곽선(몸·투구)
      x.globalAlpha = a; x.lineWidth = w; x.strokeStyle = rim;
      torso(); x.stroke(); circ(x, 0, -20, 11); x.stroke();
    }
    x.globalAlpha = 1;
    const body = lin(x, 0, -32, 0, 30, [[0, '#e6d6ff'], [0.35, '#a98af0'], [1, '#5a3aa8']]);
    torso(); fs(x, body, 2.5, ink);
    circ(x, 0, -20, 11); fs(x, body, 2.5, ink);
    x.beginPath(); x.moveTo(-9, -24); x.lineTo(9, -24); x.lineWidth = 3; x.strokeStyle = ink; x.stroke();
    x.fillStyle = '#1a0838'; x.beginPath(); x.ellipse(0, -19, 8, 3.6, 0, 0, TAU); x.fill(); // 투구 틈
    x.fillStyle = '#8ffcff'; circ(x, -4, -19, 2.4); x.fill(); circ(x, 4, -19, 2.4); x.fill();
    x.fillStyle = '#ffffff'; circ(x, -4, -19.5, 1); x.fill(); circ(x, 4, -19.5, 1); x.fill();
    x.beginPath(); x.moveTo(0, -31); x.quadraticCurveTo(12, -42, 20, -34); x.quadraticCurveTo(9, -34, 4, -28); fs(x, '#9a3dff', 1.6, ink);
    x.beginPath(); x.moveTo(-22, -6); x.lineTo(-12, -8); x.lineTo(-12, 12); x.quadraticCurveTo(-18, 18, -24, 10); x.closePath(); fs(x, '#3a2a58', 2, ink);
    x.beginPath(); x.moveTo(10, 0); x.lineTo(32, -30); x.lineTo(34, -27); x.lineTo(13, 3); x.closePath(); fs(x, '#ece2ff', 1.8, ink);
    x.strokeStyle = rim; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-8, 4); x.quadraticCurveTo(0, 7, 8, 4); x.stroke();
  });
}
function iceFieldSpr() { // 영구 동토: 얼어붙은 땅(육각 결 + 금). 원점 = 가운데, 가로 타원
  return bake('m:field', 110, 82, x => {
    x.save(); x.scale(1, 0.74);
    circ(x, 0, 0, 108);
    x.fillStyle = rad(x, 0, 0, 20, 108, [[0, 'rgba(210,245,255,0.62)'], [0.7, 'rgba(130,210,255,0.48)'], [0.92, 'rgba(160,230,255,0.7)'], [1, 'rgba(160,230,255,0)']]);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 2;
    for (let q = -3; q <= 3; q++) for (let r = -2; r <= 2; r++) {
      const cx = q * 30 + (r & 1) * 15, cy = r * 26;
      if (cx * cx + cy * cy > 90 * 90) continue;
      x.beginPath(); for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + Math.PI / 6; x[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * 14, cy + Math.sin(a) * 14); } x.closePath(); x.stroke();
    }
    x.strokeStyle = 'rgba(40,110,200,0.55)'; x.lineWidth = 2.5;
    x.beginPath(); x.moveTo(-70, -10); x.lineTo(-30, 6); x.lineTo(-6, -8); x.lineTo(30, 14); x.lineTo(74, 4); x.moveTo(-6, -8); x.lineTo(4, -50); x.stroke();
    x.restore();
  });
}
function crystalSpr() { // 결정 가시 한 개(얼어붙은 땅 가장자리·가시 반격)
  return bake('m:crys', 7, 18, x => {
    poly(x, [0, -18, 6, -4, 4, 18, -4, 18, -6, -4]);
    fs(x, lin(x, -6, -18, 6, 18, [[0, '#f4fdff'], [0.5, '#9fe8ff'], [1, '#2a78e0']]), 1.6, '#1e4a8a');
  });
}
function mineSpr() { // 플라즈마 지뢰: 금속 받침 + 보라 코어
  return bake('m:mine', 20, 14, x => {
    x.save(); x.scale(1, 0.55); circ(x, 0, 6, 18); fs(x, '#3a2a58', 2.5, INK2); x.restore();
    circ(x, 0, -2, 9); fs(x, rad(x, -3, -5, 1, 10, [[0, '#ffe0ff'], [0.5, '#c860ff'], [1, '#5a1fa8']]), 2.2, INK2);
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(s * 12, 2); x.lineTo(s * 17, -3); x.lineWidth = 2.4; x.strokeStyle = INK2; x.stroke(); }
  });
}
function darkSunSpr() { // 일식: 검은 해 + 금빛 테
  return bake('m:dsun', 40, 40, x => {
    circ(x, 0, 0, 38); x.fillStyle = rad(x, 0, 0, 20, 38, [[0, 'rgba(255,220,140,0)'], [0.6, 'rgba(255,208,120,0.9)'], [1, 'rgba(255,160,60,0)']]); x.fill();
    circ(x, 0, 0, 24); fs(x, rad(x, -6, -8, 2, 24, [[0, '#3a1a50'], [1, '#08030f']]), 3, '#ffd08a');
    x.strokeStyle = 'rgba(224,160,255,0.8)'; x.lineWidth = 1.5; circ(x, 0, 0, 29); x.stroke();
  });
}

// ── 이벤트 ──
const mageO = () => MF[0];
export function events(view, evs) {
  for (const ev of evs) {
    if (ev.type === 'spellPick' && ev.mutate) { reveal(ev); continue; }
    if (ev.type === 'spell' && ev.mut) { spellMut(view, ev); continue; }
    if (ev.type !== 'mutFx') continue;
    const x = +ev.x || 0, y = +ev.y || 0, col = MUT_BY_KEY[ev.m]?.col;
    switch (ev.m) {
      case 'splitChain': // 분열 화염구 연쇄 폭발
        part(K_GLOW, x, y, 0, 0, 0.3, ev.r * 1.8, '#ff6a1f');
        burst(K_GLOW, x, y, 6, 60, 220, 0.45, 18, ['#ffd23a', '#ff8a1e', '#ff4a1a'], -120, 3);
        burst(K_SPARK, x, y, 5, 250, 600, 0.2, 3, ['#ffe45a', '#ffffff'], 0, 6);
        ring(x, y, 6, ev.r * 1.1, 0.3, '#ffb040', 5);
        burst(K_SMOKE, x, y, 2, 20, 70, 0.8, 34, 'rgba(70,40,30,0.5)', -60, 1);
        break;
      case 'sunOrb': ring(x, y, 20, 160, 0.5, '#ffd23a', 8); sprPop(rays('#ffc21a'), x, y, 0.5, 2.2, 0.5, 0, 2); break;
      case 'scorch': burst(K_GLOW, x, y, 3, 20, 70, 0.4, 16, ['#ffb040', '#ff6a1f'], -140, 2); break;
      case 'wildfire': // 들불: 불길이 옮겨붙는 곡선
        for (const q of ev.pts || []) add({ k: 'arc', life: 0.4, x0: x, y0: y, x1: q[0], y1: q[1], col: '#ff8a1e', halo: '#ff3a1a', h: 50 });
        burst(K_GLOW, x, y, 5, 40, 160, 0.5, 18, ['#ffd23a', '#ff6a1f'], -180, 2);
        break;
      case 'focusBolt': // 천벌: 같은 자리에 겹겹이
        // 첫 벼락만 하늘 끝에서 — 이어지는 벼락은 표적 위 짧은 줄기(전체 높이 기둥을 줄인다)
        addBolt({ k: 'bolt', life: 0.16, x0: x + (rnd() - 0.5) * ((ev.i | 0) ? 60 : 120), y0: (ev.i | 0) ? y - 200 : -topExtra - 20, x1: x, y1: y, col: '#ffe53a', halo: '#7b5cff', w: 1.1 + 0.12 * (ev.i | 0), n: (ev.i | 0) ? 6 : 10, amp: (ev.i | 0) ? 26 : 44 });
        part(K_GLOW, x, y, 0, 0, 0.14, 64, '#7b5cff');
        burst(K_SPARK, x, y, 4, 300, 640, 0.14, 2.6, ['#ffe53a', '#ffffff'], 0, 6);
        if (!(ev.i | 0)) { sprPop(runeCircle('#ffe53a'), x, y + 8, 0.4, 2.2, 0.6, Math.PI / 2, 3, 0.36); add({ k: 'pillar', life: 0.45, x, y, col: '#ffe53a', halo: '#7b5cff', w: 44 }); }
        ring(x, y, 6, 60 + 14 * (ev.i | 0), 0.3, '#ffe53a', 4);
        shake(0.05);
        break;
      case 'thunderCloud': burst(K_SMOKE, x, y - 150, 8, 30, 120, 0.9, 60, 'rgba(60,50,110,0.6)', 0, 2); ring(x, y, 10, 150, 0.5, '#9a8cff', 6); break;
      case 'cloudZap':
        addBolt({ k: 'bolt', life: 0.13, x0: ev.cx + (rnd() - 0.5) * 80, y0: ev.cy - 135, x1: x, y1: y, col: '#e0d8ff', halo: '#7b5cff', w: 0.8, n: 7, amp: 26 });
        burst(K_SPARK, x, y, 2, 200, 460, 0.13, 2.2, ['#ffe53a', '#ffffff'], 0, 6);
        part(K_GLOW, x, y, 0, 0, 0.12, 34, '#9a8cff');
        break;
      case 'ballLightning': ring(x, y, 4, 60, 0.3, '#7fdcff', 4); burst(K_SPARK, x, y, 6, 200, 500, 0.2, 2.4, ['#bff4ff', '#ffffff'], 0, 6); break;
      case 'ballZap': for (const q of ev.pts || []) addBolt({ k: 'bolt', life: 0.12, x0: x, y0: y, x1: q[0], y1: q[1], col: '#bff4ff', halo: '#2a78e0', w: 0.7, n: 5, amp: 14 }); break;
      case 'arcTether': addBolt({ k: 'bolt', life: 0.16, x0: x, y0: y, x1: ev.x1, y1: ev.y1, col: '#e0c8ff', halo: '#9a3dff', w: 0.9, n: 7, amp: 22 }); break;
      case 'glacierSpear': sprPop(runeCircle('#5fb8ff'), x, y, 0.5, 2.6, 0.5, 0, -3); burst(K_SHARD, x, y, 10, 150, 400, 0.6, 7, ['#ffffff', '#bff4ff', '#5fb8ff'], 300, 1); break;
      case 'glacierShatter':
        burst(K_SHARD, x, y, 16, 200, 560, 0.8, 9, ['#ffffff', '#bff4ff', '#2a78e0'], 500, 1, 60);
        sprPop(sparkle('#bff4ff'), x, y, 0.5, 2.8, 0.45, 0, 3);
        ring(x, y, 10, 150, 0.4, '#bff4ff', 7);
        part(K_GLOW, x, y, 0, 0, 0.3, 160, '#5fb8ff');
        shake(0.1);
        break;
      case 'permafrost': burst(K_SHARD, x, y, 8, 80, 260, 0.7, 7, ['#ffffff', '#bff4ff'], 300, 1, 80); ring(x, y, 10, 120, 0.5, '#bff4ff', 6); break;
      case 'mirrorFlash': add({ k: 'glint', life: 0.3, x, y, col: '#e8fbff' }); burst(K_SHARD, x, y, 4, 80, 220, 0.4, 6, ['#ffffff', '#9fe8ff'], 200, 1); break;
      case 'mirrorThorn': for (let k = 0; k < 4; k++) add({ k: 'spike', life: 0.5, x: x + (rnd() - 0.5) * 30, y: y + 14, a: -Math.PI / 2 + (rnd() - 0.5) * 0.9, s: 1 + rnd() * 0.5 }); burst(K_SHARD, x, y, 4, 80, 200, 0.4, 5, ['#ffffff', '#9fe8ff'], 300, 1); break;
      case 'shardHit': burst(K_SHARD, x, y, 5, 100, 300, 0.4, 6, ['#ffffff', '#9fe8ff'], 300, 1); part(K_GLOW, x, y, 0, 0, 0.15, 40, '#7fe3ff'); break;
      case 'vortex': ring(x, y, ev.r * 1.3, 10, 0.5, '#6ff0c0', 7); break;
      case 'vortexBurst':
        ring(x, y, 10, ev.r * 1.6, 0.45, '#aef7d8', 10); ring(x, y, 10, ev.r * 1.1, 0.35, '#ffffff', 4);
        burst(K_SMOKE, x, y, 8, 120, 320, 0.8, 40, 'rgba(170,235,210,0.5)', -20, 2);
        burst(K_DEBRIS, x, y, 8, 200, 500, 0.8, 6, ['#6aa84a', '#c8b48a'], 700, 1, 200);
        part(K_GLOW, x, y, 0, 0, 0.3, ev.r * 2.2, '#3fd8a8');
        shake(0.14);
        break;
      case 'crossWind': for (const s of [-1, 1]) add({ k: 'windLine', life: 0.9, y: y + s * 30, dir: s }); break;
      case 'windBlades': ring(x, y, 6, 70, 0.3, '#7af0c8', 4); break;
      case 'spiritHit': sprPop(slashArc('#aef7d8'), x, y, 0.5, 1.1, 0.2, rnd() * TAU); burst(K_SPARK, x, y, 3, 150, 380, 0.18, 2.4, ['#c8fff0', '#ffffff'], 0, 6); break;
      case 'holyPulse': sprPop(runeCircle('#ffe07a'), x, y - 20, 0.5, 3.2, 0.6, Math.PI / 2, 2, 0.36); break;
      case 'lightWell': part(K_GLOW, x, y, 0, 0, 0.35, 120, '#ffe07a'); ring(x, y, 10, 110, 0.4, '#fff3a8', 7); break;
      case 'wellSpear':
        add({ k: 'lance', life: 0.3, x0: ev.x0, y0: ev.y0, x1: x, y1: y, col: '#ffe07a', halo: '#e0a72e', w: 10 });
        sprPop(starFlash('#fff0a8'), x, y, 0.3, 1, 0.22);
        burst(K_STAR, x, y, 4, 60, 200, 0.5, 10, '#fff0a8', 200, 1);
        break;
      case 'crossJudgment': add({ k: 'hbeam', life: 0.42, x, y, w: ev.w * 0.8, col: '#fff0a8', halo: '#e0a72e' }); sprPop(sparkle('#fff6d0'), x, y, 0.5, 3.4, 0.45, 0, 2); shake(0.08); break;
      case 'sweepRay': sprPop(runeCircle('#ffd23a'), x, WALL_Y - 30, 0.5, 2.2, 0.5, Math.PI / 2, 2, 0.36); break;
      case 'doomMark': sprPop(curseSigil('#c050ff'), x, y - 50, 0.3, 1.2, 0.45); break;
      case 'doomBoom':
        ring(x, y, ev.r * 1.3, 8, 0.2, '#e0a0ff', 6);
        add({ k: 'delayRing', life: 0.5, x, y, r: ev.r * 1.3, col: '#c050ff' });
        burst(K_SMOKE, x, y, 10, 60, 260, 1, 46, 'rgba(70,20,110,0.6)', -40, 2);
        burst(K_GLOW, x, y, 10, 100, 360, 0.6, 20, ['#e0a0ff', '#9a3dff', '#5a1fa8'], -60, 3);
        sprPop(curseSigil('#9a3dff'), x, y - 20, 0.8, 2.6, 0.5);
        part(K_GLOW, x, y, 0, 0, 0.4, ev.r * 2.2, '#7a1fd0');
        shake(0.14);
        break;
      case 'hexZone': add({ k: 'hexIn', life: 0.8, y: +ev.y }); break;
      case 'soulVolley': burst(K_GLOW, x, y, 10, 60, 200, 0.6, 18, ['#e0c0ff', '#8ff6ff'], -60, 2); ring(x, y, 10, 90, 0.4, '#9ff6ff', 6); break;
      case 'soulHit': burst(K_GLOW, x, y, 5, 40, 160, 0.4, 16, ['#e0c0ff', '#8ff6ff'], -40, 3); part(K_GLOW, x, y, 0, 0, 0.2, 50, '#b48aff'); break;
      case 'reaper': flash(0.05, '#9a3dff'); break;
      case 'reapKill': sprPop(curseSigil('#b47aff', '#e8fcff'), x, y - 16, 0.4, 1.2, 0.5); ring(x, y, 6, 56, 0.35, '#9ff6ff', 4); burst(K_GLOW, x, y - 10, 5, 40, 140, 0.6, 16, ['#e0c8ff', '#8ff6ff'], -120, 2); break;
      case 'diveStart': add({ k: 'dash', life: 0.5, x0: x, y0: y, x1: ev.x1, y1: ev.y1 }); ring(x, y, 10, 70, 0.3, '#ffb040', 5); break;
      case 'diveBoom':
        part(K_GLOW, x, y, 0, 0, 0.4, ev.r * 2.4, '#ff6a1f');
        burst(K_GLOW, x, y, 16, 100, 420, 0.7, 26, ['#ffe45a', '#ff8a1e', '#ff3a1a'], -200, 2);
        burst(K_DEBRIS, x, y, 10, 200, 520, 0.9, 7, ['#6a4a3a', '#3a2a24'], 900, 1, 300);
        burst(K_SMOKE, x, y, 6, 40, 160, 1.1, 60, 'rgba(60,36,30,0.55)', -80, 1);
        ring(x, y, 10, ev.r * 1.5, 0.45, '#ffb040', 10);
        sprPop(runeCircle('#ff8a1e'), x, y + 10, 0.5, ev.r / 30, 0.5, Math.PI / 2, 2, 0.36);
        shake(0.2);
        break;
      case 'golemSmash':
        ring(x, y, 10, ev.r * 1.3, 0.45, '#d8b48a', 10); ring(x, y, 10, ev.r * 0.9, 0.35, '#ff9ae6', 5);
        burst(K_DEBRIS, x, y, 12, 150, 420, 0.9, 7, ['#ab9e8e', '#8a7a6a', '#6aa84a'], 900, 1, 250);
        burst(K_SMOKE, x, y, 7, 60, 220, 1, 50, 'rgba(170,150,120,0.5)', -20, 2);
        add({ k: 'cracks', life: 1.4, x, y, r: ev.r, seed: rnd() * 1000 });
        shake(0.16);
        break;
      case 'golemBoom':
        burst(K_DEBRIS, x, y, 18, 200, 620, 1, 9, ['#ab9e8e', '#c2b6a4', '#8a7a6a'], 900, 1, 300);
        burst(K_GLOW, x, y, 12, 100, 380, 0.6, 22, ['#ffb0ee', '#ff6fd2'], -80, 2);
        part(K_GLOW, x, y, 0, 0, 0.35, ev.r * 2, '#ff6fd2');
        ring(x, y, 10, ev.r * 1.3, 0.5, '#ff9ae6', 10);
        shake(0.22);
        break;
      case 'golemReform': ring(x, y, 120, 10, 0.4, '#ff9ae6', 7); burst(K_GLOW, x, y - 40, 10, 60, 200, 0.5, 18, ['#ffb0ee', '#ffffff'], -80, 2); sprPop(runeCircle('#ff9ae6'), x, y, 0.5, 3, 0.6, Math.PI / 2, 2, 0.36); break;
      case 'golemSpike': add({ k: 'rock', life: 0.28, x0: x, y0: y, x1: ev.x1, y1: ev.y1 }); break;
      case 'infernoRing': ring(x, y, 10, 150, 0.5, '#ffb040', 8); break;
      case 'chainCircuit': {
        const p = ev.pts || [];
        if (p.length > 1) add({ k: 'chain', life: 0.4, pts: p.flat(), col: '#e8fbff', halo: '#2a9bff' });
        for (const q of p) { sprPop(sparkle('#bff4ff'), q[0], q[1], 0.3, 1.2, 0.35, 0, 3); burst(K_SHARD, q[0], q[1], 3, 60, 180, 0.5, 6, ['#ffffff', '#9fe8ff'], 300, 1); }
        if (p[0]) flash(0.03, '#7fe3ff');
        break;
      }
      case 'icePrison': for (const q of ev.pts || []) { ring(q[0], q[1], 60, 10, 0.25, '#bff4ff', 5); burst(K_SHARD, q[0], q[1], 4, 60, 160, 0.4, 6, ['#ffffff', '#9fe8ff'], 200, 1); } break;
      case 'prisonBreak':
        burst(K_SHARD, x, y, 12, 180, 480, 0.7, 8, ['#ffffff', '#bff4ff', '#5fc8ff'], 600, 1, 80);
        ring(x, y, 10, 100, 0.35, '#bff4ff', 6); part(K_GLOW, x, y, 0, 0, 0.2, 90, '#5fc8ff');
        break;
      case 'geysers': ring(x, y, 10, 140, 0.4, '#bfeaff', 6); break;
      case 'geyserErupt':
        for (let k = 0; k < 5; k++) part(K_SMOKE, x + (rnd() - 0.5) * 20, y - k * 18, (rnd() - 0.5) * 30, -240 - k * 60, 0.9, 40 - k * 4, 'rgba(210,240,255,0.55)', 0, 1.2);
        burst(K_SHARD, x, y, 5, 80, 220, 0.6, 5, ['#ffffff', '#bff4ff'], 500, 1, 260);
        part(K_GLOW, x, y - 30, 0, 0, 0.25, 70, '#ff8a3a');
        ring(x, y, 6, ev.r, 0.3, '#bfeaff', 5);
        break;
      case 'pressure': sprPop(runeCircle('#ffb070'), x, y + 8, 0.5, ev.r / 30, 1.2, Math.PI / 2, -3, 0.36); break;
      case 'pressBoom': ring(x, y, 10, ev.r * 1.7, 0.55, '#ffffff', 5); shake(0.18); break;
      case 'eclipseOrb': sprPop(rays('#e0a0ff'), x, y, 0.5, 2.6, 0.6, 0, 1); break;
      case 'eclipseRay':
        add({ k: 'lance', life: 0.16, x0: ev.x0, y0: ev.y0, x1: x, y1: y, col: '#ffe0a0', halo: '#9a3dff', w: 5 });
        burst(K_GLOW, x, y, 3, 40, 140, 0.35, 14, ['#ffe07a', '#c070ff'], -40, 3);
        break;
      case 'duskWave': flash(0.04, '#ffd08a'); break;
      case 'plasmaRail': {
        add({ k: 'rail', life: 0.4, x0: ev.x0, y0: ev.y0, x1: ev.x1, y1: ev.y1 });
        burst(K_SPARK, ev.x1, ev.y1, 8, 300, 700, 0.2, 3, ['#f0b0ff', '#ffffff'], 0, 6);
        flash(0.03, '#c860ff'); shake(0.1);
        break;
      }
      case 'plasmaMine': for (const q of ev.pts || []) add({ k: 'lob', life: 0.3, x0: mageO().ox, y0: mageO().oy, x1: q[0], y1: q[1] }); break;
      case 'mineBoom':
        part(K_GLOW, x, y, 0, 0, 0.35, ev.r * 2, '#c860ff');
        burst(K_GLOW, x, y, 12, 80, 320, 0.55, 22, ['#f0b0ff', '#c860ff', '#6a3aff'], -100, 3);
        burst(K_SPARK, x, y, 8, 300, 800, 0.2, 3, ['#f0b0ff', '#ffffff'], 0, 6);
        ring(x, y, 8, ev.r * 1.2, 0.35, '#e07aff', 7);
        shake(0.1);
        break;
      case 'wraithKnights': sprPop(runeCircle('#c9a2ff'), x, y + 10, 0.6, 3, 0.8, Math.PI / 2, 2, 0.38); ring(x, y, 10, 150, 0.5, '#8ff6ff', 7); burst(K_SMOKE, x, y, 8, 40, 160, 0.9, 40, 'rgba(150,110,230,0.45)', -40, 1.5); break;
      case 'knightSlash':
        sprPop(slashArc('#bff8ff'), x, y - 6, 0.7, 1.7, 0.24, (ev.face < 0 ? Math.PI : 0) + (rnd() - 0.5) * 0.6);
        burst(K_GLOW, x, y, 4, 60, 180, 0.3, 14, ['#8ff6ff', '#c9a2ff'], 0, 4);
        break;
      case 'spectralCharge': for (const cx of ev.xs || []) { sprPop(runeCircle('#c9a2ff'), cx, y + 10, 0.3, 1.2, 0.5, Math.PI / 2, 2, 0.36); ring(cx, y, 6, 50, 0.35, '#8ff6ff', 4); } flash(0.04, '#9a3dff'); break;
      case 'dragonAegis': ring(x, WALL_Y - 100, 20, 380, 0.6, '#fff0a8', 8); break;
      case 'aegisBlock': sprPop(starFlash('#ffe07a'), x, y, 0.3, 0.9, 0.2); burst(K_SPARK, x, y, 4, 150, 400, 0.2, 2.6, ['#fff0a8', '#ffffff'], 0, 6); break;
      case 'starfall': add({ k: 'comet', life: 0.45, x, y }); break;
      case 'starfallBoom':
        lightBeam(x, 120, -topExtra - 40, y + 20, 0.6, '#fff6d0', '#e0a72e');
        part(K_GLOW, x, y, 0, 0, 0.45, ev.r * 2.2, '#ffd23a');
        burst(K_STAR, x, y, 14, 100, 420, 0.8, 14, ['#fff0a8', '#ffd23a'], 200, 1, 100);
        burst(K_DEBRIS, x, y, 10, 200, 520, 0.9, 7, ['#8a7a6a', '#c2b6a4'], 900, 1, 300);
        ring(x, y, 10, ev.r * 1.3, 0.5, '#fff0a8', 10);
        sprPop(runeCircle('#ffd23a'), x, y + 10, 0.5, ev.r / 26, 0.7, Math.PI / 2, 2, 0.36);
        flash(0.08, '#ffe07a'); shake(0.24);
        break;
      default: if (col) ring(x, y, 8, 80, 0.35, col, 5);
    }
  }
}

// 기본 spell 이벤트에 붙은 변이(mut) — 기본 연출 위에 더한다
function spellMut(view, ev) {
  const x = +ev.x || 0, y = +ev.y || 0;
  switch (ev.mut) {
    case 'splitFire': sprPop(runeCircle('#ff8a1e'), x, y + 8, 0.4, (ev.r || 100) / 34, 0.4, Math.PI / 2, 2, 0.36); break;
    case 'iceFan': { const M = mageO(); for (let k = -2; k <= 2; k++) sprPop(sparkle('#bff4ff'), M.ox + k * 14, M.oy - 10, 0.2, 0.8, 0.25, 0, 2); ring(M.ox, M.oy, 6, 90, 0.3, '#9fe8ff', 5); break; }
    case 'twinDragons': ring(x, y, 10, 70, 0.3, '#ffb040', 4); break;
    case 'firewalker': sprPop(runeCircle('#ff6a1f'), x, y + 20, 0.4, 3, 0.6, Math.PI / 2, -2, 0.36); break;
    case 'wanderStorm': case 'twinEyes': ring(x, y, 10, (ev.r || 120) * 1.2, 0.4, '#ffe53a', 5); break;
    case 'focusBolt': break;
  }
}

// 변이를 고른 순간: 마법사에게 프리즘 폭발 + '변이!' 알약
function reveal(ev) {
  const m = MUT_BY_KEY[ev.mutate];
  if (!m) return;
  const M = mageO(), cols = ['#ff7ad9', '#9a7bff', '#7fe3ff', '#9dff9a', '#ffe45a'];
  burst(K_GLOW, M.ox, M.oy - 20, 20, 120, 420, 0.8, 20, cols, -120, 2);
  burst(K_STAR, M.ox, M.oy - 20, 10, 80, 300, 1, 12, cols, 200, 1);
  for (let k = 0; k < 3; k++) ring(M.ox, M.oy - 20, 10, 140 + k * 70, 0.5 + k * 0.12, cols[k * 2], 7 - k * 2);
  sprPop(runeCircle(m.col), M.ox, M.oy + 20, 0.5, 4, 0.9, Math.PI / 2, 3, 0.36);
  add({ k: 'prism', life: 1.1, x: M.ox, y: M.oy - 30 });
  pop('변이!', m.name, m.col, WORLD_W / 2, 520);
  shake(0.12);
}

// ── 갱신: 순간 연출 수명 + 물체에서 흘러나오는 입자(불씨·눈가루·먼지) ──
let emitT = 0;
export function update(view, da) {
  for (let i = FX.length - 1; i >= 0; i--) if ((FX[i].t += da) >= FX[i].life) FX.splice(i, 1);
  const a = view && view.spellFx && view.spellFx.mut;
  if (!(da > 0)) return;
  emitT += da;
  if (emitT < 0.05) return; // 20Hz로 흘린다(파티클 예산 §12)
  emitT = 0;
  if (a) for (const q of a) {
    switch (q.k) {
      case 'sun': part(K_GLOW, q.x + (rnd() - 0.5) * q.r, q.y + q.r * 0.6, (rnd() - 0.5) * 40, 60 + rnd() * 60, 0.6, 20, rnd() < 0.5 ? '#ff8a1e' : '#ffd23a', 0, 1); break;
      case 'patch': part(K_GLOW, q.x + (rnd() - 0.5) * q.r * 1.6, q.y + (rnd() - 0.5) * q.r * 0.6, 0, -60 - rnd() * 60, 0.6, 10, '#ff8a1e', 0, 1); break;
      case 'glacier': part(K_SHARD, q.x, q.y, (rnd() - 0.5) * 80, (rnd() - 0.5) * 80, 0.6, 6, rnd() < 0.5 ? '#ffffff' : '#bff4ff', 200, 1); break;
      case 'frost': if (rnd() < 0.5) part(K_STAR, q.x + (rnd() - 0.5) * q.r * 1.6, q.y + (rnd() - 0.5) * q.r * 0.9, 0, -20, 0.6, 7, '#e8fbff', 0, 1); break;
      case 'press': { const an = rnd() * TAU; part(K_SMOKE, q.x + Math.cos(an) * q.r, q.y + Math.sin(an) * q.r * 0.6, -Math.cos(an) * q.r * 1.3, -Math.sin(an) * q.r * 0.8, 0.7, 34, 'rgba(220,240,255,0.5)', 0, 0); break; }
      case 'soul': part(K_GLOW, q.x, q.y, 0, 0, 0.35, 14, '#b48aff'); break;
      case 'knight': if (rnd() < 0.5) part(K_SMOKE, q.x, q.y + 20, 0, -30, 0.6, 20, 'rgba(90,40,140,0.45)', 0, 1); break;
      case 'geyser': if (rnd() < 0.4) part(K_SMOKE, q.x + (rnd() - 0.5) * 16, q.y, 0, -50, 0.7, 20, 'rgba(210,240,255,0.4)', 0, 1); break;
    }
  }
  const fx = view && view.spellFx;
  if (fx) for (const tn of fx.tornadoes) if (tn.mut === 'firewalker' || tn.mut === 'infernoRing') part(K_GLOW, tn.x + (rnd() - 0.5) * tn.r, tn.y + tn.r * 0.5, 0, -40, 0.9, 12, '#ff6a1f', 0, 1);
  if (fx && fx.golem && view.mutations?.stoneGolem === 'golemSmash' && fx.golem.hp > 0 && Math.abs(fx.golem.y - (WALL_Y - 70)) > 20 && rnd() < 0.4) part(K_SMOKE, fx.golem.x + (rnd() - 0.5) * 50, fx.golem.y + 36, 0, -20, 0.6, 26, 'rgba(170,150,120,0.45)', 0, 1);
}

// ── 바닥 층(적 아래): 장판·고리·예고 ──
export function drawGround(view) {
  const fx = view.spellFx, a = fx && fx.mut, mu = view.mutations || {};
  wt();
  if (mu.curseMark === 'hexZone' && fx && fx.mt && fx.mt.hexY != null && view.book?.curseMark) drawHex(fx.mt.hexY);
  if (a) for (const q of a) {
    switch (q.k) {
      case 'patch': { // 불바다: 그을린 땅 + 흔들리는 불꽃 혀
        const f = fade(q, 0.2, 0.4);
        ctx.globalAlpha = 0.7 * f; spr(soft('rgba(40,14,6,0.8)'), q.x, q.y, q.r * 2.3, q.r * 0.9);
        additive(true); ctx.globalAlpha = 0.5 * f; spr(hu('#ff5a1a'), q.x, q.y, q.r * 2.2, q.r * 0.9); additive(false);
        const img = flame();
        for (let k = 0; k < 5; k++) {
          const u = k / 4 - 0.5, fl = 0.75 + 0.25 * Math.sin(T * 14 + k * 1.7 + q.x);
          ctx.globalAlpha = 0.9 * f;
          place(q.x + u * q.r * 1.5, q.y + Math.sin(k * 2.1) * q.r * 0.15, Math.sin(T * 6 + k) * 0.15, 1.4 * fl, 1.9 * fl);
          ctx.drawImage(img, -img.hw, -img.hh * 1.6, img.hw * 2, img.hh * 2);
        }
        wt();
        break;
      }
      case 'frost': { // 영구 동토: 육각 얼음 땅 + 가장자리 가시
        const f = fade(q, 0.3, 0.8), img = iceFieldSpr(), s = q.r / 100;
        ctx.globalAlpha = 0.95 * f;
        spr(img, q.x, q.y, img.hw * 2 * s, img.hh * 2 * s);
        additive(true); ctx.globalAlpha = (0.25 + 0.1 * Math.sin(RT * 3 + q.x)) * f; spr(hu('#7fe3ff'), q.x, q.y, q.r * 2.4, q.r * 1.3); additive(false);
        const cr = crystalSpr();
        for (let k = 0; k < 7; k++) {
          const an = k * TAU / 7 + q.x * 0.01, gx = q.x + Math.cos(an) * q.r * 0.95, gy = q.y + Math.sin(an) * q.r * 0.7;
          ctx.globalAlpha = f; place(gx, gy, Math.cos(an) * 0.35, 1, 0.8 + 0.4 * Math.min(1, q.t * 3)); ctx.drawImage(cr, -cr.hw, -cr.hh * 1.8, cr.hw * 2, cr.hh * 2);
        }
        wt();
        break;
      }
      case 'vortex': { // 진공 소용돌이: 바닥에 누운 나선 팔 3 + 검은 눈
        const f = fade(q, 0.2, 0.2), r = q.r * (0.8 + 0.2 * Math.min(1, q.t * 3));
        ctx.globalAlpha = 0.55 * f; spr(soft('rgba(20,50,45,0.8)'), q.x, q.y, r * 1.2, r * 0.5);
        additive(true);
        for (let arm = 0; arm < 3; arm++) {
          ctx.beginPath();
          for (let s = 0; s <= 24; s++) {
            const u = s / 24, an = -T * 7 + arm * TAU / 3 + u * 5.2, rr = r * (1 - u * 0.9);
            const px = q.x + Math.cos(an) * rr, py = q.y + Math.sin(an) * rr * 0.42;
            if (s) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          }
          ctx.globalAlpha = 0.75 * f; ctx.lineWidth = 6; ctx.strokeStyle = arm ? '#6ff0c0' : '#c8fff0'; ctx.stroke();
          ctx.globalAlpha = 0.3 * f; ctx.lineWidth = 16; ctx.strokeStyle = '#3fd8a8'; ctx.stroke();
        }
        ctx.globalAlpha = 0.5 * f; spr(hu('#3fd8a8'), q.x, q.y, r * 2, r * 0.9);
        additive(false);
        groundRune(runeCircle('#6ff0c0'), q.x, q.y, r / 28, -T * 3, 0.5 * f);
        ctx.globalAlpha = 1;
        break;
      }
      case 'mine': { // 플라즈마 지뢰: 받침 + 깜빡이는 무장 고리
        const armed = q.t > 0.35, img = mineSpr(), bl = 0.5 + 0.5 * Math.sin(RT * (armed ? 14 : 6) + q.x);
        ctx.globalAlpha = 1; spr(img, q.x, q.y, img.hw * 2.2, img.hh * 2.2);
        additive(true);
        ctx.globalAlpha = (0.4 + 0.5 * bl) * (armed ? 1 : 0.5); spr(hu('#c860ff'), q.x, q.y - 4, 60, 44);
        ctx.globalAlpha = armed ? 0.7 : 0.3; ctx.lineWidth = 2.5; ctx.strokeStyle = '#e07aff';
        ctx.beginPath(); ctx.ellipse(q.x, q.y + 4, 44, 18, 0, RT * 3, RT * 3 + TAU * 0.8); ctx.stroke();
        additive(false); ctx.globalAlpha = 1;
        break;
      }
      case 'geyser': { // 간헐천 구멍
        const f = fade(q, 0.15, 0.3);
        ctx.globalAlpha = 0.8 * f; spr(soft('rgba(30,40,60,0.8)'), q.x, q.y, 70, 26);
        ctx.lineWidth = 3; ctx.strokeStyle = '#bfeaff'; ctx.beginPath(); ctx.ellipse(q.x, q.y, 26, 10, 0, 0, TAU); ctx.stroke();
        additive(true); ctx.globalAlpha = (0.3 + 0.3 * Math.sin(RT * 12 + q.x)) * f; spr(hu('#ff8a3a'), q.x, q.y, 50, 20); additive(false);
        ctx.globalAlpha = 1;
        break;
      }
      case 'ray': // 쓸어내는 광선: 지나간 자리 그을음
        ctx.globalAlpha = 0.5 * fade(q, 0, 0.3); ctx.fillStyle = 'rgba(80,50,10,0.5)';
        ctx.fillRect(Math.min(q.x, q.x - q.vx * q.t), WALL_Y - 30, Math.abs(q.vx * q.t), 16);
        ctx.globalAlpha = 1;
        break;
      case 'press': { // 압력 폭발: 조여드는 증기 고리
        const u = Math.min(1, q.t / q.life), r = q.r * (1 - 0.75 * u);
        ctx.globalAlpha = 0.55; ctx.lineWidth = 8 + 10 * u; ctx.strokeStyle = 'rgba(220,240,255,0.7)';
        ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * 0.55, 0, 0, TAU); ctx.stroke();
        additive(true); ctx.globalAlpha = 0.25 + 0.6 * u; spr(hu('#ffb070'), q.x, q.y, 40 + 120 * u, 30 + 80 * u); additive(false);
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
  // 화염 고리(불꽃 회오리 넷의 중심): 땅의 불 고리
  if (fx) {
    const rg = fx.tornadoes.find(tn => tn.mut === 'infernoRing');
    if (rg) {
      const f = clamp((rg.life - rg.t) / 0.5, 0, 1) * Math.min(1, rg.t * 3), img = flame();
      additive(true); ctx.globalAlpha = 0.35 * f; ctx.lineWidth = 22; ctx.strokeStyle = '#ff6a1f';
      ctx.beginPath(); ctx.ellipse(rg.cx, rg.cy, 125, 72, 0, 0, TAU); ctx.stroke(); additive(false);
      for (let k = 0; k < 14; k++) {
        const an = k * TAU / 14 + T * 0.8, fl = 0.7 + 0.3 * Math.sin(T * 13 + k * 2.3);
        ctx.globalAlpha = 0.9 * f; place(rg.cx + Math.cos(an) * 125, rg.cy + Math.sin(an) * 72, 0, 1.3 * fl, 1.8 * fl);
        ctx.drawImage(img, -img.hw, -img.hh * 1.6, img.hw * 2, img.hh * 2);
      }
      wt(); ctx.globalAlpha = 1;
    }
  }
  // 바람 정령 궤도(옅은 바닥 고리)
  if (mu.gale === 'windSpirits' && view.book?.gale) {
    ctx.globalAlpha = 0.18; ctx.lineWidth = 3; ctx.setLineDash([14, 12]); ctx.lineDashOffset = -RT * 40; ctx.strokeStyle = '#c8fff0';
    ctx.beginPath(); ctx.ellipse(SPIRITS.cx, SPIRITS.cy + 20, SPIRITS.rx, SPIRITS.ry, 0, 0, TAU); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  for (const o of FX) if (o.k === 'cracks') drawCracks(o);
}
const fade = (q, fin, fout) => clamp(Math.min(fin > 0 ? q.t / fin : 1, fout > 0 && q.life ? (q.life - q.t) / fout : 1), 0, 1);
// ponytail: 띠 그라디언트는 ctx마다 한 번(원점 기준) 만들고 translate로 옮겨 그린다 — 매 프레임 할당 없음
let gCtx = null, hexG = null, duskG = null;
function bandGrads() {
  if (gCtx === ctx) return;
  gCtx = ctx;
  hexG = ctx.createLinearGradient(0, 0, 0, HEX_H * 2);
  hexG.addColorStop(0, 'rgba(154,61,255,0)'); hexG.addColorStop(0.18, 'rgba(120,40,200,0.2)'); hexG.addColorStop(0.5, 'rgba(90,20,150,0.26)'); hexG.addColorStop(0.82, 'rgba(120,40,200,0.2)'); hexG.addColorStop(1, 'rgba(154,61,255,0)');
  duskG = ctx.createLinearGradient(0, 0, 0, 170);
  duskG.addColorStop(0, 'rgba(255,208,138,0)'); duskG.addColorStop(0.12, 'rgba(255,200,120,0.55)'); duskG.addColorStop(0.35, 'rgba(160,70,220,0.35)'); duskG.addColorStop(1, 'rgba(90,30,140,0)');
}
function drawHex(y) { // 저주 장막: 전장을 가로지르는 보라 띠 + 떠도는 문양
  const x0 = -sideX, w = WORLD_W + sideX * 2, top = y - HEX_H, h = HEX_H * 2;
  bandGrads();
  ctx.translate(0, top); ctx.fillStyle = hexG; ctx.fillRect(x0, 0, w, h); ctx.translate(0, -top);
  additive(true);
  for (const s of [-1, 1]) { ctx.globalAlpha = 0.35 + 0.15 * Math.sin(RT * 2 + s); ctx.fillStyle = '#b04dff'; ctx.fillRect(x0, y + s * HEX_H * 0.82 - 1.5, w, 3); }
  const sig = curseSigil('#b04dff');
  for (let k = 0; k < 6; k++) {
    const px = ((k * 157 + RT * 22) % (WORLD_W + 120)) - 60, py = y + Math.sin(RT * 0.9 + k * 1.9) * HEX_H * 0.5;
    ctx.globalAlpha = 0.28; spr(sig, px, py, 34, 34);
  }
  additive(false); ctx.globalAlpha = 1;
}
function drawCracks(o) { // 대지 강타 균열
  const a = 1 - o.t / o.life, rng = n => (Math.sin(o.seed + n * 12.9898) * 43758.5453) % 1;
  ctx.globalAlpha = 0.7 * a; ctx.strokeStyle = '#3a2a24'; ctx.lineWidth = 3;
  for (let k = 0; k < 7; k++) {
    const an = k * TAU / 7 + rng(k), L = o.r * (0.6 + 0.4 * Math.abs(rng(k + 9)));
    ctx.beginPath(); ctx.moveTo(o.x, o.y);
    ctx.lineTo(o.x + Math.cos(an) * L * 0.5 + rng(k + 3) * 10, o.y + Math.sin(an) * L * 0.25);
    ctx.lineTo(o.x + Math.cos(an) * L, o.y + Math.sin(an) * L * 0.45); ctx.stroke();
  }
  additive(true); ctx.globalAlpha = 0.4 * a; spr(hu('#ff9ae6'), o.x, o.y, o.r * 1.4, o.r * 0.5); additive(false);
  ctx.globalAlpha = 1;
}

// ── 위 층(마법사·드래곤 뒤, 파티클 앞): 물체 · 광선 · 번개 ──
export function draw(view) {
  const fx = view.spellFx, a = fx && fx.mut, mt = fx && fx.mt, mu = view.mutations || {};
  wt();
  if (mu.frostWard === 'iceMirror' && view.book?.frostWard) drawMirrors(view);
  if (mu.gale === 'windSpirits' && view.book?.gale && mt) drawSpirits(mt.wsA || 0);
  if (mu.holyLight === 'lightWell' && view.book?.holyLight && mt) drawWell(Math.min(1, (mt.well || 0) / 0.11));
  if (mu.soulHarvest === 'soulVolley' && view.book?.soulHarvest && mt) drawSoulRing(mt.souls | 0);
  if (mt && mt.d2 && mu.babyDragon === 'twinDragons') drawDragon2(mt.d2);
  if (fx && fx.dragon && fx.dragon.st === 'dive') drawDiveTrail(fx.dragon);
  if (fx && fx.golem && fx.golem.hp <= 0 && mu.stoneGolem === 'golemRebirth' && mt && mt.reT > 0) drawReform(fx.golem, 1 - mt.reT / 5);
  if (fx) for (const tn of fx.tornadoes) if (tn.mut === 'crossWind') drawWake(tn);
  if (fx) for (const s of fx.storms) if (s.mut === 'wanderStorm') drawStormTrail(s);
  if (a) for (const q of a) {
    switch (q.k) {
      case 'blast': if (q.t < 0) { additive(true); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(RT * 30); spr(hu('#ff8a1e'), q.x, q.y, 30, 30); additive(false); ctx.globalAlpha = 1; } break;
      case 'sun': drawSun(q); break;
      case 'cloud': drawCloud(q); break;
      case 'ball': drawBall(q); break;
      case 'tether': if (!q.a.dead && !q.b.dead) boltLine(zig(q.a.x, q.a.y, q.b.x, q.b.y, 8, 16), '#e0c8ff', '#9a3dff', 0.95, 0.85 * fade(q, 0.1, 0.3)); break;
      case 'glacier': drawGlacier(q); break;
      case 'shard': {
        const an = Math.atan2(q.vy, q.vx), sp = iceSpear();
        additive(true); ctx.globalAlpha = 0.8; place(q.x, q.y, an, 1.4, 0.8); ctx.drawImage(comet('#bff4ff'), -66, -10, 72, 20); additive(false);
        ctx.globalAlpha = 1; place(q.x, q.y, an, 0.7, 0.7); ctx.drawImage(sp, -38, -11, 76, 22); wt();
        break;
      }
      case 'blade': {
        const an = Math.atan2(q.vy, q.vx), img = slashArc('#7af0c8');
        additive(true);
        for (let j = 2; j >= 0; j--) { ctx.globalAlpha = j ? 0.25 / j : 0.95; place(q.x - q.vx * 0.02 * j, q.y - q.vy * 0.02 * j, an, 0.9, 1.3); ctx.drawImage(img, -img.hw, -img.hh, img.hw * 2, img.hh * 2); }
        wt(); additive(false); ctx.globalAlpha = 1;
        break;
      }
      case 'pulse': drawPulse(q); break;
      case 'ray': {
        const f = fade(q, 0.1, 0.25), top = -topExtra - 30, w = q.w * (0.9 + 0.1 * Math.sin(RT * 40));
        vbeam(q.x, w, top, WALL_Y, f, '#ffc21a', '#e07a1e');
        additive(true); ctx.globalAlpha = 0.8 * f; spr(hu('#ffd23a'), q.x, WALL_Y - 20, w * 2.4, 60); additive(false); ctx.globalAlpha = 1;
        if (rnd() < 0.5) part(K_SPARK, q.x + (rnd() - 0.5) * w, WALL_Y - 20 - rnd() * 300, (rnd() - 0.5) * 200, -100 - rnd() * 200, 0.3, 2.4, '#fff0a8', 400, 2);
        break;
      }
      case 'doom': drawDoom(q); break;
      case 'soul': { // 추적 영혼: 청록·연보라 꼬리 + 발광(광량 예산 제외) + 작은 유령 머리
        const an = Math.atan2(q.vy, q.vx), gh = ghostSpr('#e0d0ff');
        setLightPrio(LIGHT_EXEMPT); additive(true);
        ctx.globalAlpha = 0.9; place(q.x, q.y, an, 1.3, 1); ctx.drawImage(comet('#8ff6ff'), -66, -10, 72, 20); wt();
        ctx.globalAlpha = 0.7; spr(hu('#b48aff'), q.x, q.y, 44, 44);
        additive(false); setLightPrio(false);
        ctx.globalAlpha = 1; place(q.x, q.y, 0, (q.vx < 0 ? -1 : 1) * 0.62, 0.62); ctx.drawImage(gh, -gh.hw, -gh.hh, gh.hw * 2, gh.hh * 2); wt();
        break;
      }
      case 'reap': drawScythe(q); break;
      case 'prison': {
        const e = q.e, s = (e.r + 14) / 30, img = iceBlockSpr(), crack = q.t / q.life;
        ctx.globalAlpha = 0.9; place(q.x, q.y, Math.sin(q.x) * 0.2, s, s); ctx.drawImage(img, -img.hw, -img.hh, img.hw * 2, img.hh * 2); wt();
        additive(true); ctx.globalAlpha = 0.3 + 0.4 * crack * (0.5 + 0.5 * Math.sin(RT * 20)); spr(hu('#7fe3ff'), q.x, q.y, e.r * 3, e.r * 3); additive(false);
        ctx.globalAlpha = 1;
        break;
      }
      case 'link': if (q.t < q.life) { const f = fade(q, 0.2, 0.4); boltLine(zig(q.a.x, q.a.y, q.b.x, q.b.y, 12, 30), '#fff3a0', '#ffb020', 1.15, 0.85 * f); boltLine(zig(q.a.x, q.a.y, q.b.x, q.b.y, 9, 18), '#ffe53a', '#7b5cff', 0.7, 0.5 * f); } break;
      case 'eclipse': drawEclipse(q); break;
      case 'dusk': drawDusk(q); break;
      case 'knight': { // 망령 기사: 불투명 몸 + 청록 외곽선(구운 것) + 발광·잔상(광량 예산 제외)
        const img = knightMutSpr(), f = fade(q, 0.3, 0.5), bob = Math.sin(RT * 5 + q.x) * 3, s = 2.2;
        setLightPrio(LIGHT_EXEMPT); additive(true);
        groundRune(runeCircle('#8ff6ff'), q.x, q.y + 4, 1.5, RT * 2, 0.75 * f);
        ctx.globalAlpha = 0.45 * f; spr(hu('#7fe8ff'), q.x, q.y - 38, 110, 136);
        ctx.globalAlpha = 0.3 * f; spr(hu('#b48aff'), q.x - q.face * 30, q.y - 30, 80, 90);
        additive(false); setLightPrio(false);
        ctx.globalAlpha = 0.25 * f; place(q.x - q.face * 22, q.y + bob + 2, 0, q.face * s, s); ctx.drawImage(img, -img.hw, -img.hh * 1.7, img.hw * 2, img.hh * 2);
        ctx.globalAlpha = f; place(q.x, q.y + bob, 0, q.face * s, s); ctx.drawImage(img, -img.hw, -img.hh * 1.7, img.hw * 2, img.hh * 2); wt();
        ctx.globalAlpha = 1;
        break;
      }
      case 'charge': { // 유령 돌격: 크게 + 세로 청록 잔상 기둥
        const img = ghostSpr('#c8a0ff');
        setLightPrio(LIGHT_EXEMPT); additive(true);
        for (const x of q.xs) { ctx.globalAlpha = 0.4; spr(hu('#6ff6ff'), x, q.y + 100, 36, 230); ctx.globalAlpha = 0.3; spr(hu('#b48aff'), x, q.y + 40, 60, 110); }
        additive(false); setLightPrio(false);
        for (const x of q.xs) { ctx.globalAlpha = 1; place(x, q.y + Math.sin(RT * 9 + x) * 4, -Math.PI / 2, 1.6, 1.6); ctx.drawImage(img, -img.hw, -img.hh, img.hw * 2, img.hh * 2); }
        wt(); ctx.globalAlpha = 1;
        break;
      }
      case 'aegis': drawAegis(q); break;
      case 'star': break; // 낙하는 순간 연출(comet)
    }
  }
  drawFx();
}

function drawSun(q) { // 태양 구체: 헤일로 + 도는 코로나 + 코어
  const r = q.r, f = Math.min(1, q.t * 3) * clamp((q.y - (FRONT_Y - 40)) / 60, 0, 1);
  ctx.globalAlpha = 0.4 * f; spr(soft('rgba(60,20,0,0.6)'), q.x, q.y + r * 1.2, r * 2.2, r * 0.5);
  additive(true);
  ctx.globalAlpha = 0.5 * f; spr(hu('#ff6a1f'), q.x, q.y, r * 3.4, r * 3.4);
  ctx.globalAlpha = 0.8 * f; place(q.x, q.y, RT * 0.8, r / 22, r / 22); const ry = rays('#ffc21a'); ctx.drawImage(ry, -ry.hw, -ry.hh, ry.hw * 2, ry.hh * 2); wt();
  ctx.globalAlpha = 0.7 * f; spr(hu('#ffd23a'), q.x, q.y, r * 2, r * 2);
  additive(false);
  ctx.globalAlpha = f; spr(magicCore('#fff4c0', '#ffb21a', '#e0501a'), q.x, q.y, r * 1.25, r * 1.25);
  additive(true); ctx.globalAlpha = 0.5 * f; ctx.lineWidth = 3; ctx.strokeStyle = '#fff0a0';
  ctx.beginPath(); ctx.arc(q.x, q.y, r * 0.66 + Math.sin(RT * 9) * 3, 0, TAU); ctx.stroke(); additive(false);
  ctx.globalAlpha = 1;
}
function drawCloud(q) { // 뇌운: 바닥이 평평한 먹구름(어두운 몸 + 밝은 윗면) + 속에서 번쩍이는 번개
  const f = fade(q, 0.3, 0.5), cy = q.y - 150;
  ctx.globalAlpha = 0.3 * f; spr(soft('rgba(20,16,40,0.8)'), q.x, q.y + 6, 190, 38); // 땅 그림자
  for (let k = 0; k < 7; k++) {
    const u = k / 6 - 0.5, ox = u * 190 + Math.sin(RT * 0.7 + k) * 8, oy = -Math.cos(u * Math.PI) * 26 + Math.sin(RT * 0.9 + k * 2) * 4, s = 1 - Math.abs(u) * 0.6;
    ctx.globalAlpha = 0.95 * f; spr(soft('rgba(66,58,116,0.93)'), q.x + ox, cy + oy, 130 * s + 40, 90 * s + 30);
    ctx.globalAlpha = 0.7 * f; spr(soft('rgba(176,166,226,0.85)'), q.x + ox * 0.95, cy + oy - 16 * s, 80 * s + 24, 44 * s + 14);
  }
  ctx.globalAlpha = 0.9 * f; spr(soft('rgba(40,34,80,0.9)'), q.x, cy + 26, 230, 40); // 평평한 바닥
  const fl = Math.max(0, Math.sin(RT * 23 + q.x)) ** 6;
  additive(true); ctx.globalAlpha = (0.2 + 0.6 * fl) * f; spr(hu('#9a8cff'), q.x + Math.sin(RT * 7) * 50, cy, 180, 80); additive(false);
  if (fl > 0.5) boltLine(zig(q.x - 70, cy - 6, q.x + 60, cy + 10, 6, 12), '#e0d8ff', '#7b5cff', 0.7, fl * f);
  ctx.globalAlpha = 1;
}
function drawBall(q) { // 구전: 코어 + 튀는 작은 번개
  const f = fade(q, 0.1, 0.4);
  additive(true); ctx.globalAlpha = 0.7 * f; spr(hu('#2a78e0'), q.x, q.y, 80, 80); additive(false);
  ctx.globalAlpha = f; spr(magicCore('#ffffff', '#7fdcff', '#2a78e0'), q.x, q.y, 26, 26);
  for (let k = 0; k < 2; k++) { const an = rnd() * TAU, L = 22 + rnd() * 18; boltLine(zig(q.x, q.y, q.x + Math.cos(an) * L, q.y + Math.sin(an) * L, 3, 6), '#bff4ff', '#2a78e0', 0.5, 0.75 * f); }
  ctx.globalAlpha = 1;
}
function drawGlacier(q) { // 빙하 창: 거대한 결정 창 + 서리 꼬리
  const an = Math.atan2(q.vy, q.vx), sp = iceSpear(), k = 2.8;
  additive(true);
  ctx.globalAlpha = 0.8; place(q.x, q.y, an, 4.2, 2.6); ctx.drawImage(comet('#9fe8ff'), -66, -10, 72, 20); wt();
  ctx.globalAlpha = 0.6; spr(hu('#5fb8ff'), q.x, q.y, 130, 130);
  additive(false);
  ctx.globalAlpha = 0.35;
  for (let j = 1; j <= 3; j++) { place(q.x - q.vx * 0.03 * j, q.y - q.vy * 0.03 * j, an, k * (1 - j * 0.12), k * (1 - j * 0.12)); ctx.drawImage(sp, -38, -11, 76, 22); }
  ctx.globalAlpha = 1; place(q.x, q.y, an, k, k); ctx.drawImage(sp, -38, -11, 76, 22);
  wt();
  additive(true); ctx.globalAlpha = 0.6; place(q.x, q.y, RT * 5, 1.6, 1.6); const sk = sparkle('#e8fbff'); ctx.drawImage(sk, -sk.hw, -sk.hh, sk.hw * 2, sk.hh * 2); wt(); additive(false);
  ctx.globalAlpha = 1;
}
function drawPulse(q) { // 성역 파동: 성벽에서 반원으로 퍼지는 금빛 고리 + 룬
  const u = q.t / q.life, r = q.r, a = 1 - u, cx = WORLD_W / 2, cy = WALL_Y;
  additive(true);
  ctx.globalAlpha = 0.35 * a; ctx.lineWidth = 34; ctx.strokeStyle = '#e0a72e';
  ctx.beginPath(); ctx.ellipse(cx, cy, r, r / 1.6, 0, Math.PI, TAU); ctx.stroke();
  ctx.globalAlpha = 0.85 * a; ctx.lineWidth = 7; ctx.strokeStyle = '#ffe07a'; ctx.stroke();
  ctx.globalAlpha = 0.9 * a; ctx.lineWidth = 2; ctx.strokeStyle = '#fff6d0'; ctx.stroke();
  const st = starFlash('#fff0a8');
  for (let k = 1; k < 8; k++) { const an = Math.PI + k * Math.PI / 8; ctx.globalAlpha = 0.7 * a; spr(st, cx + Math.cos(an) * r, cy + Math.sin(an) * r / 1.6, 22, 22); }
  additive(false); ctx.globalAlpha = 1;
}
function drawDoom(q) { // 파멸 낙인: 머리 위 해골 문양 + 줄어드는 시계 고리
  const e = q.e;
  if (e.dead) return;
  const x = e.x, y = e.y - e.r - 34, u = clamp(q.t / q.life, 0, 1), pulse = 1 + 0.12 * Math.sin(RT * (6 + u * 16));
  additive(true); ctx.globalAlpha = 0.5 + 0.3 * u; spr(hu('#9a3dff'), x, y, 70 * pulse, 70 * pulse); additive(false);
  ctx.globalAlpha = 1; spr(curseSigil('#c050ff'), x, y, 40 * pulse, 40 * pulse);
  ctx.lineWidth = 4; ctx.strokeStyle = INK2; ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = u > 0.7 ? '#ff5aa0' : '#e0a0ff';
  ctx.beginPath(); ctx.arc(x, y, 26, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - u)); ctx.stroke();
  additive(true); ctx.globalAlpha = 0.25 + 0.35 * u; spr(hu('#7a1fd0'), e.x, e.y, e.r * 3.2, e.r * 2.4); additive(false);
  ctx.globalAlpha = 1;
}
function drawScythe(q) { // 사신의 낫: 거대한 초승달 날이 한 줄을 가로지른다(잔상 셋)
  const dir = Math.sign(q.vx) || 1, img = scytheSpr();
  additive(true); ctx.globalAlpha = 0.45; spr(hu('#8a4dff'), q.x, q.y, 260, 170); additive(false);
  for (let j = 3; j >= 0; j--) {
    ctx.globalAlpha = j ? 0.18 : 1;
    place(q.x - q.vx * 0.03 * j, q.y, dir * (0.5 + Math.sin(q.t * 8) * 0.25) + (dir < 0 ? Math.PI : 0), 1.7 * dir, 1.7);
    ctx.drawImage(img, -img.hw, -img.hh, img.hw * 2, img.hh * 2);
  }
  wt();
  additive(true); ctx.globalAlpha = 0.6; ctx.fillStyle = '#b04dff'; ctx.fillRect(Math.min(q.x, q.x - q.vx * 0.2), q.y + 30, Math.abs(q.vx * 0.2), 4); additive(false);
  ctx.globalAlpha = 1;
}
function drawEclipse(q) { // 일식: 검은 해 + 금·보라 코로나
  const f = fade(q, 0.3, 0.4), s = 1 + 0.06 * Math.sin(RT * 4);
  additive(true);
  ctx.globalAlpha = 0.55 * f; spr(hu('#9a3dff'), q.x, q.y, 220 * s, 220 * s);
  ctx.globalAlpha = 0.75 * f; place(q.x, q.y, -RT * 0.6, 3.2 * s, 3.2 * s); const ry = rays('#ffd08a'); ctx.drawImage(ry, -ry.hw, -ry.hh, ry.hw * 2, ry.hh * 2); wt();
  additive(false);
  const img = darkSunSpr(); ctx.globalAlpha = f; spr(img, q.x, q.y, 84 * s, 84 * s);
  ctx.globalAlpha = 1;
}
function drawDusk(q) { // 황혼의 물결: 금빛 물마루 + 보라 안개 꼬리(성벽 쪽)
  const x0 = -sideX, w = WORLD_W + sideX * 2, y = q.y, a = clamp((q.y - (FRONT_Y - 30)) / 80, 0, 1);
  bandGrads();
  ctx.globalAlpha = a; ctx.translate(0, y - 20); ctx.fillStyle = duskG; ctx.fillRect(x0, 0, w, 170); ctx.translate(0, 20 - y);
  additive(true);
  ctx.globalAlpha = 0.8 * a; ctx.strokeStyle = '#ffe0a0'; ctx.lineWidth = 4;
  ctx.beginPath(); for (let k = 0; k <= 24; k++) { const px = x0 + w * k / 24, py = y + Math.sin(k * 0.9 + RT * 10) * 6; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke();
  ctx.globalAlpha = 0.35 * a; ctx.lineWidth = 16; ctx.strokeStyle = '#e0a0ff'; ctx.stroke();
  additive(false); ctx.globalAlpha = 1;
}
function drawAegis(q) { // 용의 비호: 성벽 위 금빛 용 + 성벽 앞 화염 장막
  const f = fade(q, 0.3, 0.4), img = flame(), y0 = WALL_Y - 190;
  additive(true); ctx.globalAlpha = 0.3 * f; spr(hu('#ffb020'), WORLD_W / 2, WALL_Y - 110, WORLD_W + sideX * 2, 190); additive(false);
  for (let k = 0; k < 18; k++) {
    const px = -sideX + (WORLD_W + sideX * 2) * (k + 0.5) / 18, fl = 0.7 + 0.3 * Math.sin(T * 12 + k * 1.9);
    ctx.globalAlpha = 0.85 * f; place(px, WALL_Y - 40 - (k % 3) * 22, Math.sin(T * 5 + k) * 0.12, 2 * fl, 3 * fl);
    ctx.drawImage(img, -img.hw, -img.hh * 1.6, img.hw * 2, img.hh * 2);
  }
  wt();
  // 용
  const body = babyDragon(true), wing = babyWing(true), face = Math.cos(q.t * 2.1) >= 0 ? 1 : -1, x = q.x, y = y0 - 20 + Math.sin(RT * 3) * 8, s = 2.4 * f;
  additive(true); ctx.globalAlpha = 0.6 * f; spr(hu('#ffe07a'), x, y, 200, 160); additive(false);
  const flap = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(RT * 14));
  ctx.globalAlpha = f;
  place(x, y, face * 0.25, face * s, s);
  ctx.save(); ctx.translate(-8, -8); ctx.scale(0.85, flap * 0.9); ctx.globalAlpha = 0.85 * f; ctx.drawImage(wing, -wing.hw, -wing.hh - (wing.oy || 0), wing.hw * 2, wing.hh * 2); ctx.restore();
  ctx.globalAlpha = f; ctx.drawImage(body, -body.hw, -body.hh, body.hw * 2, body.hh * 2);
  ctx.save(); ctx.translate(2, -6); ctx.scale(1, flap); ctx.drawImage(wing, -wing.hw, -wing.hh - (wing.oy || 0), wing.hw * 2, wing.hh * 2); ctx.restore();
  wt();
  // 아래로 쏟는 금빛 불
  additive(true); ctx.globalAlpha = 0.55 * f; spr(hu('#ffb020'), x + face * 40, (y + WALL_Y) / 2, 110, WALL_Y - y); additive(false);
  ctx.globalAlpha = 1;
}
function drawMirrors(view) { // 얼음 거울 셋: 결계 안에 떠서 천천히 돈다
  const lv = view.book.frostWard, p = SPELL_BY_KEY.frostWard.lv[lv - 1], y = WALL_Y - p.r * 0.55 + 30, img = mirrorSpr();
  MIRRORS.forEach((x, k) => {
    const bob = Math.sin(RT * 1.6 + k * 2) * 6, turn = Math.cos(RT * 0.9 + k * 1.7);
    ctx.globalAlpha = 0.4; spr(soft('rgba(20,40,80,0.5)'), x, y + 60, 50, 14);
    additive(true); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(RT * 3 + k); spr(hu('#7fe3ff'), x, y + bob, 90, 110); additive(false);
    ctx.globalAlpha = 0.95; place(x, y + bob, 0, 0.35 + 0.65 * Math.abs(turn), 1); ctx.drawImage(img, -img.hw, -img.hh, img.hw * 2, img.hh * 2); wt();
  });
  ctx.globalAlpha = 1;
}
function drawSpirits(an) { // 바람 정령 셋: 소용돌이 몸 + 꼬리
  for (let k = 0; k < SPIRITS.n; k++) {
    const [x, y] = spiritAt(an, k);
    additive(true);
    for (let j = 1; j <= 4; j++) { const [tx, ty] = spiritAt(an - j * 0.07, k); ctx.globalAlpha = 0.3 - j * 0.06; spr(hu('#6ff0c0'), tx, ty, 50 - j * 6, 50 - j * 6); }
    ctx.globalAlpha = 0.6; spr(hu('#3fd8a8'), x, y, 84, 84);
    ctx.lineWidth = 3;
    for (let r = 0; r < 3; r++) { ctx.globalAlpha = 0.8 - r * 0.2; ctx.strokeStyle = r ? '#8ff0c8' : '#e8fff6'; ctx.beginPath(); ctx.ellipse(x, y + 6 - r * 11, 26 - r * 5, 9 - r, 0, T * 9 + r, T * 9 + r + 4.2); ctx.stroke(); }
    additive(false);
    ctx.globalAlpha = 1; spr(magicCore('#ffffff', '#aef7d8', '#2aa888'), x, y + 2, 18, 18);
  }
  ctx.globalAlpha = 1;
}
function drawWell(u) { // 빛의 샘: 성벽 가운데 분수 + 차오르는 빛 구슬
  const x = WORLD_W / 2, y = WALL_Y - 70, r = 10 + 22 * u;
  groundRune(runeCircle('#ffe07a'), x, y + 40, 2.2, RT * 0.8, 0.45 + 0.4 * u);
  additive(true);
  ctx.globalAlpha = 0.3 + 0.5 * u; spr(hu('#e0a72e'), x, y, r * 4, r * 4);
  ctx.globalAlpha = 0.25 + 0.35 * u; vbeamThin(x, y - r, y + 40);
  additive(false);
  ctx.globalAlpha = 0.6 + 0.4 * u; spr(magicCore('#fffbe0', '#ffe07a', '#e0a72e'), x, y, r, r);
  ctx.globalAlpha = 1;
}
function vbeamThin(x, y0, y1) { ctx.fillStyle = '#fff0a8'; ctx.fillRect(x - 2, y0, 4, y1 - y0); }
function drawSoulRing(n) { // 영혼 일제 사격: 마법사 머리 위를 도는 영혼(모인 만큼)
  if (!n) return;
  const M = mageO(), cx = M.ox, cy = M.oy - 60, img = magicCore('#fbeaff', '#c89aff', '#5a1fa8');
  additive(true);
  for (let k = 0; k < Math.min(12, n); k++) {
    const an = RT * 2 + k * TAU / 12, x = cx + Math.cos(an) * 46, y = cy + Math.sin(an) * 14;
    ctx.globalAlpha = 0.55; spr(hu('#9a3dff'), x, y, 26, 26);
  }
  additive(false);
  for (let k = 0; k < Math.min(12, n); k++) { const an = RT * 2 + k * TAU / 12; ctx.globalAlpha = 0.95; spr(img, cx + Math.cos(an) * 46, cy + Math.sin(an) * 14, 10, 10); }
  ctx.globalAlpha = 1;
}
function drawDragon2(d) { // 쌍둥이 용의 둘째(첫째는 units.drawDragon)
  const face = Math.cos(d.angle) >= 0 ? 1 : -1, breath = d.breathT > 0, x = d.x, y = d.y + Math.sin(RT * 3.6 + 1) * 6, s = 1.15;
  additive(true);
  if (breath) {
    const mx = x + face * 38, my = y + 14, hgt = WALL_Y - my, fl = 0.85 + 0.15 * Math.sin(RT * 40);
    ctx.globalAlpha = 0.5 * fl; spr(hu('#ff8a1e'), mx, my + hgt / 2, 110, hgt * 1.05);
    ctx.globalAlpha = 0.7 * fl; spr(hu('#ffe45a'), mx, my + hgt / 2, 44, hgt);
  }
  ctx.globalAlpha = 0.35; spr(hu('#ff9ae6'), x, y, 90, 74);
  additive(false);
  const body = babyDragon(false), wing = babyWing(false), flap = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(RT * (breath ? 24 : 13) + 1));
  ctx.globalAlpha = 1;
  place(x, y, face * (breath ? 0.4 : Math.sin(RT * 2) * 0.06), face * s, s);
  ctx.save(); ctx.translate(-8, -8); ctx.scale(0.85, flap * 0.9); ctx.globalAlpha = 0.85; ctx.drawImage(wing, -wing.hw, -wing.hh - (wing.oy || 0), wing.hw * 2, wing.hh * 2); ctx.restore();
  ctx.globalAlpha = 1; ctx.drawImage(body, -body.hw, -body.hh, body.hw * 2, body.hh * 2);
  ctx.save(); ctx.translate(2, -6); ctx.scale(1, flap); ctx.drawImage(wing, -wing.hw, -wing.hh - (wing.oy || 0), wing.hw * 2, wing.hh * 2); ctx.restore();
  wt();
}
function drawDiveTrail(d) { // 급강하: 몸 뒤로 불꼬리
  const an = Math.atan2(d.y - d.y0, d.x - d.x0);
  additive(true);
  ctx.globalAlpha = 0.9; place(d.x, d.y, an, 3.4, 1.8); ctx.drawImage(comet('#ff8a1e'), -66, -10, 72, 20); wt();
  ctx.globalAlpha = 0.6; spr(hu('#ff5a1a'), d.x, d.y, 110, 110);
  additive(false); ctx.globalAlpha = 1;
}
function drawReform(g, u) { // 파편 재조립: 돌 조각들이 떠올라 모여든다
  const n = 9;
  for (let k = 0; k < n; k++) {
    const an = k * TAU / n + RT * (1 + u * 3), r = 90 * (1 - u) + 12, x = g.x + Math.cos(an) * r, y = g.y - 20 - u * 40 + Math.sin(an) * r * 0.4;
    ctx.globalAlpha = 0.9; ctx.fillStyle = k % 2 ? '#ab9e8e' : '#8a7a6a'; ctx.strokeStyle = INK2; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.rect(x - 6, y - 5, 12, 10); ctx.fill(); ctx.stroke();
  }
  additive(true); ctx.globalAlpha = 0.2 + 0.5 * u; spr(hu('#ff6fd2'), g.x, g.y - 30, 160, 140); additive(false);
  ctx.globalAlpha = 1;
}
function drawWake(tn) { // 횡단 돌풍: 가로 속도선
  const dir = Math.sign(tn.vx) || 1;
  additive(true); ctx.lineWidth = 3;
  for (let k = 0; k < 5; k++) {
    const yy = tn.y - tn.r * 0.8 + k * tn.r * 0.4, L = 80 + (k % 2) * 50;
    ctx.globalAlpha = 0.35; ctx.strokeStyle = k % 2 ? '#aef7d8' : '#e8fff6';
    ctx.beginPath(); ctx.moveTo(tn.x - dir * tn.r * 0.9, yy); ctx.lineTo(tn.x - dir * (tn.r * 0.9 + L), yy); ctx.stroke();
  }
  additive(false); ctx.globalAlpha = 1;
}
function drawStormTrail(s) { // 떠도는 폭풍: 지나간 자리 번개 자국
  const dir = Math.sign(s.vx) || 1;
  additive(true); ctx.globalAlpha = 0.25; spr(hu('#7b5cff'), s.x - dir * s.r * 0.8, s.y, s.r * 1.6, s.r * 0.6); additive(false);
  if (rnd() < 0.3) addBolt({ k: 'bolt', life: 0.12, x0: s.x - dir * s.r * 0.6, y0: s.y + (rnd() - 0.5) * 30, x1: s.x - dir * s.r * 1.4, y1: s.y + (rnd() - 0.5) * 40, col: '#ffe53a', halo: '#7b5cff', w: 0.8, n: 4, amp: 12 });
  ctx.globalAlpha = 1;
}

// 순간 연출 그리기
function drawFx() {
  for (const o of FX) {
    const u = o.t / o.life, a = 1 - u;
    switch (o.k) {
      case 'bolt': boltLine(zig(o.x0, o.y0, o.x1, o.y1, o.n || 6, o.amp || 20, mulberry(o.sd + frameNo * 7919)), o.col, o.halo, o.w, a ** 1.6); break; // 번쩍 → 빨리 사라짐
      case 'chain': { const p = []; for (let i = 0; i + 3 < o.pts.length; i += 2) p.push(...zig(o.pts[i], o.pts[i + 1], o.pts[i + 2], o.pts[i + 3], 4, 14).slice(i ? 2 : 0)); boltLine(p, o.col, o.halo, 1.1, a * a); break; }
      case 'arc': { // 들불: 튀어 오르는 불 곡선
        const mx = (o.x0 + o.x1) / 2, my = Math.min(o.y0, o.y1) - o.h, e = easeOut(Math.min(1, u * 1.6));
        additive(true); ctx.globalAlpha = a; ctx.lineWidth = 5; ctx.strokeStyle = o.col;
        ctx.beginPath(); ctx.moveTo(o.x0, o.y0);
        for (let s = 1; s <= 10; s++) { const v = s / 10 * e; ctx.lineTo((1 - v) ** 2 * o.x0 + 2 * (1 - v) * v * mx + v * v * o.x1, (1 - v) ** 2 * o.y0 + 2 * (1 - v) * v * my + v * v * o.y1); }
        ctx.stroke(); ctx.globalAlpha = 0.35 * a; ctx.lineWidth = 14; ctx.strokeStyle = o.halo; ctx.stroke();
        additive(false); ctx.globalAlpha = 1;
        break;
      }
      case 'pillar': vbeam(o.x, o.w * (1 - u * 0.5), -topExtra - 30, o.y, a * 0.8, o.col, o.halo); break;
      case 'lance': { // 빛의 창·일식 광선: 시작 → 끝 직선 빛
        additive(true);
        ctx.globalAlpha = 0.4 * a; ctx.strokeStyle = o.halo; ctx.lineWidth = o.w * 2.6; ctx.beginPath(); ctx.moveTo(o.x0, o.y0); ctx.lineTo(o.x1, o.y1); ctx.stroke();
        ctx.globalAlpha = a; ctx.strokeStyle = o.col; ctx.lineWidth = o.w * 0.8; ctx.stroke();
        additive(false); ctx.globalAlpha = 1;
        break;
      }
      case 'hbeam': { // 십자 심판의 가로 광선
        const x0 = -sideX, w = WORLD_W + sideX * 2, h = o.w * (0.4 + 0.6 * (1 - u));
        additive(true);
        ctx.globalAlpha = 0.45 * a; spr(hu(o.halo), o.x, o.y, w, h * 2.6);
        ctx.globalAlpha = 0.8 * a; spr(hu(o.col), o.x, o.y, w, h * 1.1);
        ctx.globalAlpha = 0.9 * a; ctx.fillStyle = o.col; ctx.fillRect(x0, o.y - h * 0.12, w, h * 0.24);
        additive(false); ctx.globalAlpha = 1;
        break;
      }
      case 'rail': { // 플라즈마 레일: 굵은 보라 빔 + 코일 고리
        const dx = o.x1 - o.x0, dy = o.y1 - o.y0, an = Math.atan2(dy, dx), L = Math.hypot(dx, dy), w = 34 * (1 - u * 0.6);
        additive(true);
        ctx.globalAlpha = 0.5 * a; ctx.strokeStyle = '#6a3aff'; ctx.lineWidth = w * 2.2; ctx.beginPath(); ctx.moveTo(o.x0, o.y0); ctx.lineTo(o.x1, o.y1); ctx.stroke();
        ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = '#e07aff'; ctx.lineWidth = w * 0.7; ctx.stroke();
        ctx.globalAlpha = a; ctx.strokeStyle = '#fbe0ff'; ctx.lineWidth = 3; ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = '#f0b0ff';
        for (let s = 0; s < 8; s++) {
          const v = ((s / 8) + u * 1.5) % 1, px = o.x0 + dx * v, py = o.y0 + dy * v;
          ctx.globalAlpha = 0.8 * a; ctx.beginPath(); ctx.ellipse(px, py, w * 0.9, w * 0.3, an + Math.PI / 2, 0, TAU); ctx.stroke();
        }
        additive(false); ctx.globalAlpha = 1;
        if (L > 0 && rnd() < 0.5) boltLine(zig(o.x0, o.y0, o.x1, o.y1, 14, 26), '#f0b0ff', '#c860ff', 0.8, 0.6 * a);
        break;
      }
      case 'lob': { // 지뢰 던지기(포물선)
        const v = easeOut(u), px = lerp(o.x0, o.x1, v), py = lerp(o.y0, o.y1, v) - Math.sin(v * Math.PI) * 140;
        additive(true); ctx.globalAlpha = 0.8; spr(hu('#c860ff'), px, py, 36, 36); additive(false);
        ctx.globalAlpha = 1; spr(magicCore('#ffe0ff', '#c860ff', '#5a1fa8'), px, py, 14, 14);
        break;
      }
      case 'comet': { // 성룡 낙하: 하늘에서 금빛 용 혜성
        const top = -topExtra - 60, py = lerp(top, o.y, u * u), px = o.x + (1 - u) * 60;
        additive(true);
        ctx.globalAlpha = 0.9; place(px, py, Math.atan2(o.y - top, -60), 5, 2.6); ctx.drawImage(comet('#ffe07a'), -66, -10, 72, 20); wt();
        ctx.globalAlpha = 0.7; spr(hu('#ffd23a'), px, py, 150, 150);
        additive(false);
        const body = babyDragon(true);
        ctx.globalAlpha = 1; place(px, py, Math.PI / 2 - 0.3, 2.2, 2.2); ctx.drawImage(body, -body.hw, -body.hh, body.hw * 2, body.hh * 2); wt();
        groundRune(runeCircle('#ffd23a'), o.x, o.y + 10, 1 + 3 * u, RT * 4, 0.3 + 0.6 * u);
        ctx.globalAlpha = 1;
        break;
      }
      case 'dash': { // 급강하 예고선
        ctx.globalAlpha = 0.5 * a; ctx.setLineDash([12, 10]); ctx.lineDashOffset = -RT * 120; ctx.lineWidth = 3; ctx.strokeStyle = '#ffb040';
        ctx.beginPath(); ctx.moveTo(o.x0, o.y0); ctx.lineTo(o.x1, o.y1); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
        break;
      }
      case 'rock': { // 가시 파편
        const px = lerp(o.x0, o.x1, u), py = lerp(o.y0, o.y1, u) - Math.sin(u * Math.PI) * 40, cr = crystalSpr();
        ctx.globalAlpha = 1; place(px, py, Math.atan2(o.y1 - o.y0, o.x1 - o.x0) + Math.PI / 2, 1.2, 1.2); ctx.drawImage(cr, -cr.hw, -cr.hh, cr.hw * 2, cr.hh * 2); wt();
        break;
      }
      case 'spike': { // 거울 반격 얼음 가시(땅에서 솟음)
        const cr = crystalSpr(), g = Math.min(1, u * 5) * (1 - Math.max(0, u - 0.6) / 0.4);
        ctx.globalAlpha = g; place(o.x, o.y, o.a + Math.PI / 2, o.s * 1.3, o.s * 1.6 * g); ctx.drawImage(cr, -cr.hw, -cr.hh * 2, cr.hw * 2, cr.hh * 2); wt();
        ctx.globalAlpha = 1;
        break;
      }
      case 'glint': additive(true); ctx.globalAlpha = a; place(o.x, o.y, u * 3, 1.2, 1.2); { const sk = sparkle(o.col); ctx.drawImage(sk, -sk.hw, -sk.hh, sk.hw * 2, sk.hh * 2); } wt(); additive(false); ctx.globalAlpha = 1; break;
      case 'windLine': {
        additive(true); ctx.lineWidth = 3;
        for (let k = 0; k < 6; k++) { const yy = o.y + (k - 2.5) * 14, x = (u * 1.4 - 0.2) * (WORLD_W + 200) - 100; ctx.globalAlpha = 0.4 * a; ctx.strokeStyle = '#c8fff0'; ctx.beginPath(); ctx.moveTo(o.dir > 0 ? WORLD_W - x : x, yy); ctx.lineTo(o.dir > 0 ? WORLD_W - x - 120 : x + 120, yy); ctx.stroke(); }
        additive(false); ctx.globalAlpha = 1;
        break;
      }
      case 'delayRing': if (u > 0.3 && !o.done) { o.done = true; ring(o.x, o.y, 8, o.r, 0.45, o.col, 9); } break; // 파멸 낙인: 빨려 든 뒤 터지는 고리
      case 'hexIn': { // 저주 장막이 펼쳐진다
        const h = HEX_H * easeOut(Math.min(1, u * 2));
        additive(true); ctx.globalAlpha = 0.5 * a; ctx.fillStyle = '#9a3dff'; ctx.fillRect(-sideX, o.y - h, WORLD_W + sideX * 2, 3); ctx.fillRect(-sideX, o.y + h, WORLD_W + sideX * 2, 3); additive(false);
        ctx.globalAlpha = 1;
        break;
      }
      case 'prism': { // 변이 순간: 마법사 둘레 무지개 고리
        const cols = ['#ff7ad9', '#9a7bff', '#7fe3ff', '#9dff9a', '#ffe45a'];
        additive(true); ctx.lineWidth = 5;
        cols.forEach((c, k) => { ctx.globalAlpha = 0.8 * a; ctx.strokeStyle = c; ctx.beginPath(); ctx.arc(o.x, o.y, 30 + k * 7 + u * 60, RT * 3 + k, RT * 3 + k + 4.4); ctx.stroke(); });
        additive(false); ctx.globalAlpha = 1;
        break;
      }
    }
  }
}

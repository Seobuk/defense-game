// 이펙트(VFX) — 파티클·빛(글로우)·마법진·충격 프레임·마법탄/투사체·원소 스킬 연출·데미지 숫자·화면 틴트.
// 이벤트 → 연출 매핑의 대부분(hit/kill/boom/spell/영웅 공격·궁극기/스킬/광란 등)이 여기 있다. docs/ART.md §5.3, §6, §9
// 소유: FX 에이전트. 계약(아래 export 목록과 render.js 호출 순서)은 docs/ART.md §14 참고.
import { WORLD_W, WORLD_H, WALL_Y, SPELL_BY_KEY, FUSION_BY_KEY, SPELL_MAX_LV } from '../config.js';
import { fmt, clamp } from '../util.js';
import { BOSSES } from '../stages.js';
import {
  TAU, S, bake, bakeO, circ, poly, rad, lin, fs, shine, lite, dim, cel, mulberry, INK2, EL,
  ctx, K, BX, BY, T, RT, topExtra, sideX, scale, fillView, drawView, GOLD_POS, hudY, frameNo,
  shake, flash, punchZoom, colA, flashA, flashCol, MANA_POS, NUM_FONT, OWN, rnd, easeOut, easeBack, lerp, pool, take,
  wt, ht, place, placeH, spr, put, ell, additive, groundRune, setLightPrio, LIGHT_EXEMPT, fxQ,
} from './core.js';
import { MF, mageOn, HF, visOf, stuns, afterImage, MAGE_FEET, bone, visR, bossDY, warpY, babyDragon, babyWing, ghostSpr } from './units.js';
import { emblem } from './emblems.js';
import { coins } from './world.js';
import { stamp, pop } from './hud.js';
import { numStyle } from './dungeonfx.js'; // 4차 던전: 약점·내성 피해 숫자 색
import { skinFx, skinMap } from './cosmetics.js'; // v0.1.2 외형 스킨(내 탄·내 스킬 입자 색) — 숫자 색은 안 건드림

// 기본 주문 탄 팔레트 [코어, 메인, 에지, 꼬리 길이, 크기] — p0fire = P1 화염구, p1 = P2 서리 화살
export const MSTY = {
  p0fire: ['#fff2a0', '#ff6a1f', '#8a1a08', 1.15, 1.1],
  p1: ['#ffffff', '#7fe3ff', '#2a78e0', 1, 1],
};
export const mstyle = (kind, owner) => kind === 'frostbolt' || (kind !== 'fireball' && owner === 1) ? MSTY.p1 : MSTY.p0fire;
export const HERO_NUM = ['#ffb8f6', '#3a0636'];   // 영웅 피해 숫자 [채움, 테두리]
export const CANDY = ['#ff5a8a', '#ffd23a', '#5ae0ff', '#7aff6a', '#b88aff', '#ff9a3a', '#ffffff'];
const GOO = {
  slime: '#6be35a', mushroom: '#ff5a5a', goblin: '#8ad04a', wolf: '#c0c8d6', skeleton: '#f4efe0', boneThrower: '#f4efe0',
  shieldSkel: '#c8d4e4', imp: '#ff7a3a', bomber: '#ffb13a', demon: '#a86ae8', wraith: '#8ff0ff', kingSlime: '#6fb6ff',
  goblinChariot: '#c08a50', lichLord: '#b27aff', magmaGolem: '#ff7a2a', demonLord: '#ff4060', doomDragon: '#ff4a4a',
};

// 파티클 종류 (part/burst 의 k)
export const K_GLOW = 0, K_SPARK = 1, K_STAR = 2, K_CONF = 3, K_SHARD = 4, K_SMOKE = 5, K_GOO = 6, K_DEBRIS = 7;

// ── 효과 풀 ──
const P = pool(400, () => ({ life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, size: 1, col: '#fff', k: 0, rot: 0, vr: 0 }));
const RINGS = pool(90, () => ({ life: 0, max: 1, x: 0, y: 0, r0: 0, r1: 0, col: '#fff', w: 2 }));
const NUMS = pool(24, () => ({ on: false, x: 0, y: 0, vy: 0, t: 0, mt: 0, age: 0, life: 1, txt: '', col: '#fff', top: '#fff', ink: '#000', s: 1, s0: 1, crit: false, val: 0, cls: '', o: 0, tgt: null, w: 0, punch: 0 }));
const BOLTS = pool(32, () => ({ life: 0, max: 1, pts: null, col: '#8ff', halo: '#3aa8ff', w: 1, kind: '' }));
const METEORS = pool(20, () => ({ on: false, x0: 0, y0: 0, x1: 0, y1: 0, t: 0, delay: 0, dur: 0.3, kills: null, r: 110 }));
const DECALS = pool(24, () => ({ life: 0, max: 1, x: 0, y: 0, r: 0 }));
const BEAMS = pool(4, () => ({ life: 0, max: 1, x: 0, y0: 0 }));
const SPRS = pool(150, () => ({ life: 0, max: 1, x: 0, y: 0, s0: 1, s1: 1, ang: 0, spin: 0, vs: 0, sq: 1, img: null }));
const FIREBALLS = pool(10, () => ({ on: false, t: 0, dur: 0.28, x0: 0, y0: 0, x1: 0, y1: 0, r: 100, plasma: false, kills: [], lv: 3 }));
const SOULS = pool(48, () => ({ on: false, t: 0, dur: 0.8, x0: 0, y0: 0, cx: 0, cy: 0 }));
const WISPS = pool(48, () => ({ life: 0, max: 1, x: 0, y: 0, s: 1, face: 1 })); // 흩어지는 망령(유령이 적을 치고 사라진 자리 · 망령이 거둔 처치)
const HSHOTS = pool(24, () => ({ on: false, t: 0, delay: 0, dur: 0.1, cls: '', x0: 0, y0: 0, x1: 0, y1: 0, crit: false }));
const ULTS = pool(6, () => ({ on: false, t: 0, dur: 1, cls: '', x: 0, y: 0, r: 0, tg: [], k: 0 }));
const ARROWS = pool(64, () => ({ on: false, t: 0, delay: 0, x: 0, y: 0 }));
const LBEAMS = pool(8, () => ({ life: 0, max: 1, x: 0, w: 50, y0: 0, y1: WALL_Y, core: '#fff', halo: '#fa0' }));
const PICKORB = { on: false, t: 0, col: '#fff' };
const meteorKills = []; // 이번 프레임 운석 처치 (운석 착탄 때 연출)
const fbFrame = [];
const lanceHits = new WeakMap();
const bulletSeed = new WeakMap();   // 탄 객체 → 고정 위상(꼬리 간격·스파클 공전 편차, "벽지" 패턴 제거용)
const seedOf = b => { let s = bulletSeed.get(b); if (s === undefined) bulletSeed.set(b, s = rnd()); return s; };
let ghostPrev = new Map();        // 망령 객체 → 마지막 위치
let healAcc = 0, healT = 0, lastWallHp = -1, lastWallMax = -1, lastPhase = '', lastStage = 0;
let pickA = 0, manaWasFull = false, defeatA = 0;
let numBudget = 0, numCap = 8, lastMode = 'full', numRef = 1; // numRef = 최근 큰 피해(상대 크기 기준, 천천히 줄어듦)
let bossPresent = false, bossTicker = 0, bossShow = 0, bossTickT = 9, bossPunch = 0, bossE = null; // 보스 누적 피해 티커(§6)
export const dmgMode = () => lastMode;

// 빛 스프라이트 캐시 (색 → 구운 글로우, 문자열 키 생성·GC 줄임). 해상도가 바뀌면 resetGlows()
const glows = new Map();
export const gl = col => { let c = glows.get(col); if (!c) glows.set(col, c = glow(col)); return c; };
// 흰 심 없는 색 빛(E 백색 과부하): 큰 빛·광선 헤일로는 이걸로 — 멋은 채도로, 흰색은 작은 심에만
const hues = new Map();
export const hu = col => { let c = hues.get(col); if (!c && !/^#[0-9a-f]{6}$/i.test(col)) return gl(col); if (!c) hues.set(col, c = bake('f:hue|' + col, 16, 16, x => { circ(x, 0, 0, 16); x.fillStyle = rad(x, 0, 0, 0, 16, [[0, col], [0.45, col + '8c'], [1, col + '00']]); x.fill(); }, Math.min(S, 1.5))); return c; };
export function resetGlows() { glows.clear(); ringCache.clear(); hues.clear(); atlases.clear(); }

// 수직 빛기둥 (부활·레벨업·심판·성직자 타격) — 다른 모듈용 생성 함수
export function lightBeam(x, w, y0, y1, life, core, halo) {
  const b = take(LBEAMS);
  b.x = x; b.w = w; b.y0 = y0; b.y1 = y1; b.life = b.max = life; b.core = core; b.halo = halo;
  return b;
}

// ═════════════ 텍스처 (오프스크린 캐시) ═════════════
// ── 이펙트 스프라이트 ──
// 가산 합성용 빛 방울 (중심 흰색 → 색 → 투명)
// 빛 고리 텍스처 (충격파·링): 안쪽 투명 → 원소색 띠 → 흰 가장자리 → 부드럽게 사라짐
const ringCache = new Map();
function ringSpr(col) {
  let c = ringCache.get(col);
  if (c) return c;
  const h = /^#[0-9a-f]{3}$/i.test(col) ? '#' + col[1] + col[1] + col[2] + col[2] + col[3] + col[3] : /^#[0-9a-f]{6}$/i.test(col) ? col : '#ffffff';
  if (!c) ringCache.set(col, c = bake('f:ring|' + h, 64, 64, x => {
    circ(x, 0, 0, 64);
    x.fillStyle = rad(x, 0, 0, 0, 64, [[0, 'rgba(0,0,0,0)'], [0.6, 'rgba(0,0,0,0)'], [0.8, h + '88'], [0.9, '#ffffff'], [0.94, h], [1, 'rgba(0,0,0,0)']]);
    x.fill();
  }, 2));
  return c;
}
export function glow(color) {
  return bake('g|' + color, 16, 16, x => {
    circ(x, 0, 0, 16);
    x.fillStyle = rad(x, 0, 0, 0, 16, [[0, '#ffffff'], [0.25, color], [1, 'rgba(0,0,0,0)']]);
    x.fill();
  }, Math.min(S, 2));
}
// 부드러운 원 (연기, 그림자용)
export function soft(color) {
  return bake('s|' + color, 16, 16, x => {
    circ(x, 0, 0, 16);
    x.fillStyle = rad(x, 0, 0, 0, 16, [[0, color], [0.5, color], [1, 'rgba(0,0,0,0)']]);
    x.globalAlpha = 1;
    x.fill();
  }, Math.min(S, 1.5));
}
export function shadow() {
  return bake('shadow', 16, 8, x => {
    x.scale(1, 0.5);
    circ(x, 0, 0, 16);
    x.fillStyle = rad(x, 0, 0, 0, 16, [[0, 'rgba(10,5,20,0.45)'], [0.6, 'rgba(10,5,20,0.3)'], [1, 'rgba(10,5,20,0)']]);
    x.fill();
  }, Math.min(S, 1.5));
}

export function flame() {
  return bake('flame', 10, 14, x => {
    x.beginPath();
    x.moveTo(0, -14);
    x.quadraticCurveTo(9, -2, 7, 5);
    x.quadraticCurveTo(4, 12, 0, 12);
    x.quadraticCurveTo(-4, 12, -7, 5);
    x.quadraticCurveTo(-9, -2, 0, -14);
    x.fillStyle = rad(x, 0, 5, 0, 14, [[0, '#fffbe0'], [0.3, '#ffd23a'], [0.7, 'rgba(255,100,20,0.85)'], [1, 'rgba(200,30,0,0)']]);
    x.fill();
  });
}
export function bubble() {
  return bake('bubble', 32, 32, x => {
    circ(x, 0, 0, 29);
    x.fillStyle = rad(x, 0, 0, 10, 30, [[0, 'rgba(120,230,255,0.05)'], [0.8, 'rgba(120,230,255,0.22)'], [1, 'rgba(180,250,255,0.55)']]);
    x.fill();
    x.lineWidth = 2.5; x.strokeStyle = 'rgba(190,250,255,0.9)'; x.stroke();
    x.beginPath(); x.arc(0, 0, 23, Math.PI * 1.1, Math.PI * 1.45);
    x.lineWidth = 4; x.strokeStyle = 'rgba(255,255,255,0.85)'; x.stroke();
    // 육각 무늬
    x.strokeStyle = 'rgba(160,240,255,0.35)'; x.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      const a = k * TAU / 6;
      x.beginPath(); x.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); x.lineTo(Math.cos(a + TAU / 6) * 12, Math.sin(a + TAU / 6) * 12); x.lineTo(Math.cos(a + TAU / 6) * 27, Math.sin(a + TAU / 6) * 27); x.stroke();
    }
  });
}
// 얼음 결정 (빙결 적 위에 덮음)
export function ice() {
  return bake('ice', 32, 32, x => {
    const shard = (cx, cy, a, len, w) => {
      x.save(); x.translate(cx, cy); x.rotate(a);
      poly(x, [0, -len, w, 0, 0, len * 0.25, -w, 0]);
      fs(x, lin(x, -w, 0, w, 0, [[0, '#ffffff'], [0.5, '#b8f0ff'], [1, '#5ac8f0']]), 1.2, '#2a7aa8');
      x.restore();
    };
    shard(-18, 14, -0.5, 16, 5);
    shard(20, 12, 0.6, 14, 4.5);
    shard(-4, 22, 0.1, 12, 4);
    shard(10, 22, 0.35, 10, 3.5);
    shard(-22, -6, -1.2, 10, 3.5);
    shard(22, -10, 1.3, 9, 3);
    shard(0, -24, 0, 8, 3);
  });
}
export function reticle() {
  return bake('ret', 32, 32, x => {
    x.strokeStyle = 'rgba(255,40,60,0.95)'; x.lineWidth = 2.5;
    for (let k = 0; k < 4; k++) {
      x.beginPath(); x.arc(0, 0, 26, k * TAU / 4 + 0.25, (k + 1) * TAU / 4 - 0.25); x.stroke();
      const a = k * TAU / 4;
      poly(x, [Math.cos(a) * 20, Math.sin(a) * 20, Math.cos(a + 0.15) * 31, Math.sin(a + 0.15) * 31, Math.cos(a - 0.15) * 31, Math.sin(a - 0.15) * 31]);
      x.fillStyle = '#ff2840'; x.fill();
    }
    circ(x, 0, 0, 18); x.lineWidth = 1.2; x.strokeStyle = 'rgba(255,80,90,0.6)'; x.stroke();
  });
}

export function sparkle(color) {
  return bake('sp|' + color, 12, 12, x => {
    x.beginPath();
    x.moveTo(0, -12); x.quadraticCurveTo(1.5, -1.5, 12, 0); x.quadraticCurveTo(1.5, 1.5, 0, 12);
    x.quadraticCurveTo(-1.5, 1.5, -12, 0); x.quadraticCurveTo(-1.5, -1.5, 0, -12);
    x.fillStyle = color; x.fill();
    circ(x, 0, 0, 3); x.fillStyle = '#fff'; x.fill();
  });
}
// 황금비 오라 광선
export function rays(color) {
  return bake('rays|' + color, 60, 60, x => {
    for (let k = 0; k < 12; k++) {
      x.save(); x.rotate(k * TAU / 12);
      poly(x, [0, 0, -5, -58, 5, -58]);
      x.fillStyle = lin(x, 0, 0, 0, -58, [[0, color], [1, 'rgba(0,0,0,0)']]);
      x.fill();
      x.restore();
    }
  }, Math.min(S, 1.5));
}

// 화면 가장자리 비네트 (저해상도로 구워 늘려 그림)
export function vignette(color, inner = 0.55) {
  return bake('vig|' + color + inner, 360, 550, x => {
    x.scale(1, 550 / 360);
    circ(x, 0, 0, 900);
    x.fillStyle = rad(x, 0, 0, 360 * inner, 470, [[0, 'rgba(0,0,0,0)'], [1, color]]);
    x.fill();
  }, 0.25);
}
// 빙결 화면: 가장자리 서리 + 결정
export function frost() {
  return bake('frost', 360, 550, x => {
    x.save(); x.scale(1, 550 / 360);
    circ(x, 0, 0, 900);
    x.fillStyle = rad(x, 0, 0, 200, 470, [[0, 'rgba(160,230,255,0)'], [0.7, 'rgba(160,230,255,0.35)'], [1, 'rgba(230,250,255,0.85)']]);
    x.fill();
    x.restore();
    const rnd = mulberry(5);
    x.strokeStyle = 'rgba(255,255,255,0.8)';
    for (let k = 0; k < 60; k++) {
      const side = k % 4, t = rnd();
      const px = side === 0 ? -360 : side === 1 ? 360 : -360 + t * 720, py = side < 2 ? -550 + t * 1100 : side === 2 ? -550 : 550;
      const a = Math.atan2(-py, -px) + (rnd() - 0.5) * 1.2, len = 20 + rnd() * 50;
      x.lineWidth = 1.5 + rnd() * 1.5;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); x.stroke();
      for (const s of [-1, 1]) {
        const mx = px + Math.cos(a) * len * 0.5, my = py + Math.sin(a) * len * 0.5;
        x.beginPath(); x.moveTo(mx, my); x.lineTo(mx + Math.cos(a + s * 0.7) * len * 0.35, my + Math.sin(a + s * 0.7) * len * 0.35); x.stroke();
      }
    }
  }, 0.5);
}

// ── 룬 문자 (6종) ──
export function glyph(x, cx, cy, s, k) {
  x.beginPath();
  switch (k % 6) {
    case 0: x.moveTo(cx, cy - s); x.lineTo(cx, cy + s); x.moveTo(cx - s * 0.6, cy - s * 0.3); x.lineTo(cx + s * 0.6, cy + s * 0.3); break;
    case 1: x.moveTo(cx - s * 0.6, cy + s); x.lineTo(cx, cy - s); x.lineTo(cx + s * 0.6, cy + s); x.moveTo(cx - s * 0.3, cy + s * 0.2); x.lineTo(cx + s * 0.3, cy + s * 0.2); break;
    case 2: x.moveTo(cx + s * 0.6, cy); x.arc(cx, cy, s * 0.6, 0, TAU); x.moveTo(cx, cy - s); x.lineTo(cx, cy + s); break;
    case 3: x.moveTo(cx - s * 0.5, cy - s); x.lineTo(cx + s * 0.6, cy); x.lineTo(cx - s * 0.5, cy + s); break;
    case 4: x.moveTo(cx - s * 0.6, cy - s * 0.6); x.lineTo(cx + s * 0.6, cy + s * 0.6); x.moveTo(cx + s * 0.6, cy - s * 0.6); x.lineTo(cx - s * 0.6, cy + s * 0.6); break;
    default: x.moveTo(cx, cy - s); x.lineTo(cx + s * 0.6, cy); x.lineTo(cx, cy + s); x.lineTo(cx - s * 0.6, cy); x.closePath();
  }
  x.stroke();
}

// 마법진 (가산 합성용, 반경 32)
export function runeCircle(col) {
  return bake('rc|' + col, 34, 34, x => {
    const pass = (w, c, a) => {
      x.globalAlpha = a; x.strokeStyle = c; x.lineWidth = w;
      circ(x, 0, 0, 31); x.stroke();
      circ(x, 0, 0, 24); x.stroke();
      circ(x, 0, 0, 10); x.stroke();
      x.beginPath();
      for (const o of [0, Math.PI]) {
        for (let j = 0; j <= 3; j++) {
          const a2 = -Math.PI / 2 + o + j * TAU / 3;
          j ? x.lineTo(Math.cos(a2) * 24, Math.sin(a2) * 24) : x.moveTo(Math.cos(a2) * 24, Math.sin(a2) * 24);
        }
      }
      x.stroke();
      x.lineWidth = w * 0.7;
      for (let k = 0; k < 10; k++) {
        const a2 = k * TAU / 10;
        x.save(); x.translate(Math.cos(a2) * 27.5, Math.sin(a2) * 27.5); x.rotate(a2 + Math.PI / 2);
        glyph(x, 0, 0, 2.4, k);
        x.restore();
      }
    };
    pass(5, col, 0.35);
    pass(2.2, col, 1);
    pass(0.9, '#ffffff', 0.85);
    x.globalAlpha = 1;
  }, Math.min(S, 2));
}

// 성벽 결계 룬 띠 (가로로 반복, 가산 합성). 폭 820, 룬 간격 48
export function runeBand(col) {
  return bake('rb|' + col, 410, 12, x => {
    for (const [w, c, a] of [[4, col, 0.4], [1.8, col, 1], [0.7, '#ffffff', 0.8]]) {
      x.globalAlpha = a; x.strokeStyle = c; x.lineWidth = w;
      for (let k = 0; k < 18; k++) glyph(x, -410 + 24 + k * 48, 0, 6.5, k);
      x.beginPath(); x.moveTo(-410, -10); x.lineTo(410, -10); x.moveTo(-410, 10); x.lineTo(410, 10); x.stroke();
    }
    x.globalAlpha = 1;
  }, Math.min(S, 1.5));
}

// 치명타·임팩트 별빛 (4각 별 + 대각 작은 별 + 번짐)
export function starFlash(col) {
  return bake('sf|' + col, 32, 32, x => {
    circ(x, 0, 0, 30);
    x.fillStyle = rad(x, 0, 0, 0, 30, [[0, col], [0.35, col + '66'], [1, 'rgba(0,0,0,0)']]);
    x.fill();
    const star = (s, w, c) => {
      x.beginPath();
      x.moveTo(0, -s); x.quadraticCurveTo(w, -w, s, 0); x.quadraticCurveTo(w, w, 0, s);
      x.quadraticCurveTo(-w, w, -s, 0); x.quadraticCurveTo(-w, -w, 0, -s);
      x.fillStyle = c; x.fill();
    };
    star(31, 3.5, col);
    star(24, 2.2, '#ffffff');
    x.rotate(Math.PI / 4);
    star(14, 2, '#ffffff');
  }, Math.min(S, 2));
}

// 마법탄 꼬리 (머리 = +x 30, 꼬리 = -36). 가산 합성
export function comet(col) {
  return bake('cm|' + col, 36, 10, x => {
    x.beginPath();
    x.moveTo(33, 0); x.quadraticCurveTo(30, -9, 18, -8); x.quadraticCurveTo(-8, -4, -36, 0);
    x.quadraticCurveTo(-8, 4, 18, 8); x.quadraticCurveTo(30, 9, 33, 0);
    x.globalAlpha = 0.8;
    x.fillStyle = lin(x, 33, 0, -36, 0, [[0, col], [0.3, col], [1, 'rgba(0,0,0,0)']]);
    x.fill();
    x.beginPath();
    x.moveTo(31, 0); x.quadraticCurveTo(18, -3.5, -22, 0); x.quadraticCurveTo(18, 3.5, 31, 0);
    x.globalAlpha = 0.95;
    x.fillStyle = lin(x, 31, 0, -22, 0, [[0, '#ffffff'], [1, 'rgba(255,255,255,0)']]);
    x.fill();
  }, Math.min(S, 2));
}

// 마법탄 코어 (일반 합성: 밝은 배경에서도 읽히게 얇은 에지 외곽)
export function magicCore(core, main, edge) {
  return bake('mc|' + main + edge, 8, 8, x => {
    circ(x, 0, 0, 6.4);
    fs(x, rad(x, 0, 0, 0, 6.4, [[0, '#ffffff'], [0.45, core], [0.8, main], [1, main]], -1.2, -1.5), 1.3, edge + 'b0');
    shine(x, -2, -2.4, 1.8, 1, -0.6, 0.95);
  });
}

// 마법탄 리본 꼬리 (§9.7 개정): 머리 +x 4, 꼬리 -60 로 가늘어지는 두 겹 리본(원소 메인 → 투명, 안쪽 흰 심). 가산
export function missileTrail(main, core) {
  return bake('f:mt|' + main + core, 64, 12, x => {
    const rib = (w, c0, c1, a) => {
      x.beginPath();
      x.moveTo(6, 0); x.quadraticCurveTo(2, -w, -14, -w * 0.8); x.quadraticCurveTo(-40, -w * 0.4, -62, 0);
      x.quadraticCurveTo(-40, w * 0.4, -14, w * 0.8); x.quadraticCurveTo(2, w, 6, 0);
      x.globalAlpha = a;
      x.fillStyle = lin(x, 6, 0, -62, 0, [[0, c0], [0.35, c1], [1, 'rgba(0,0,0,0)']]);
      x.fill();
    };
    rib(11, main, main, 0.7);
    x.scale(0.7, 1);
    rib(4.5, '#ffffff', core, 0.75); // 흰 심은 머리 쪽 짧게
    x.globalAlpha = 1;
  }, Math.min(S, 2));
}
// 마법탄 백열 코어: 외곽선 없는 흰 심 → 코어색 → 투명 (가산)
export function hotCore(core) {
  return bake('f:hc|' + core, 12, 12, x => {
    circ(x, 0, 0, 12);
    x.fillStyle = rad(x, 0, 0, 0, 12, [[0, '#ffffff'], [0.38, '#ffffff'], [0.6, core], [1, 'rgba(0,0,0,0)']]);
    x.fill();
  }, Math.min(S, 2));
}

// 얼음 창 (+x 방향 결정)
export function iceSpear() {
  return bake('icesp', 38, 11, x => {
    for (const s of [-1, 1]) {
      poly(x, [-6, s * 4, -18, s * 10, -12, s * 3]);
      fs(x, '#bff4ff', 1.5, '#1e4a8a');
    }
    poly(x, [32, 0, 10, -7.5, -26, -4, -36, 0, -26, 4, 10, 7.5]);
    fs(x, '#9fe8ff', 2.5, '#1e4a8a');
    poly(x, [32, 0, 10, -7.5, -26, -4, -36, 0]);
    x.fillStyle = '#e8fbff'; x.fill();
    x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(30, 0); x.lineTo(-30, 0); x.moveTo(10, -7); x.lineTo(4, 0); x.lineTo(10, 7); x.stroke();
    poly(x, [32, 0, 10, -7.5, -26, -4, -36, 0, -26, 4, 10, 7.5]);
    x.lineWidth = 2.5; x.strokeStyle = '#1e4a8a'; x.stroke();
  });
}

// 서리 결계 띠: 성벽(아래)에서 위로 r 만큼, 아래가 진함. 원점 = 띠 아래 가운데
export function frostBand(r) {
  r = Math.round(r);
  return bakeO('fb|' + r, 390, r / 2 + 10, r / 2 + 7, x => {
    const top = -r, bot = 0;
    x.fillStyle = lin(x, 0, top, 0, bot, [[0, 'rgba(160,235,255,0)'], [0.35, 'rgba(160,235,255,0.14)'], [1, 'rgba(190,245,255,0.42)']]);
    x.fillRect(-390, top, 780, r);
    const s = 26, h = s * Math.sqrt(3) / 2;
    x.lineWidth = 1.6;
    for (let row = 0, yy = bot; yy > top; row++, yy -= h) {
      const a = 0.05 + 0.34 * ((yy - top) / r) ** 1.6;
      x.strokeStyle = `rgba(235,252,255,${a.toFixed(3)})`;
      for (let xx = -390 + (row % 2) * s * 0.75; xx < 400; xx += s * 1.5) {
        x.beginPath();
        for (let k = 0; k <= 6; k++) { const aa = k * TAU / 6; const px = xx + Math.cos(aa) * s * 0.5, py = yy + Math.sin(aa) * s * 0.5; k ? x.lineTo(px, py) : x.moveTo(px, py); }
        x.stroke();
      }
    }
    const rnd = mulberry(r);
    for (let xx = -390; xx < 400; xx += 14 + rnd() * 14) {
      const hh = 6 + rnd() * 12, ww = 3 + rnd() * 3;
      poly(x, [xx - ww, top + 4, xx, top + 4 - hh, xx + ww, top + 4]);
      fs(x, 'rgba(225,250,255,0.75)', 1.2, 'rgba(42,120,224,0.6)');
    }
  }, Math.min(S, 1));
}

// 저주 낙인 (머리 위 룬)
export function curseSigil(col = '#b04dff', eyeCol = '#ffe0ff') {
  return bake('cs|' + col, 17, 17, x => {
    for (let k = 0; k < 4; k++) {
      x.save(); x.rotate(k * Math.PI / 2);
      poly(x, [-3, -11, 0, -16.5, 3, -11]); fs(x, col, 1.4, INK2);
      x.restore();
    }
    circ(x, 0, 0, 11.5); x.lineWidth = 5; x.strokeStyle = INK2; x.stroke();
    x.lineWidth = 2.8; x.strokeStyle = col; x.stroke();
    x.lineWidth = 1.2; x.strokeStyle = lite(col, 0.4);
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6; glyph(x, Math.cos(a) * 11.5, Math.sin(a) * 11.5, 1.6, k); }
    x.beginPath(); x.moveTo(-7.5, 0); x.quadraticCurveTo(0, -7, 7.5, 0); x.quadraticCurveTo(0, 7, -7.5, 0); x.closePath();
    fs(x, eyeCol, 1.8, INK2);
    circ(x, 0, 0, 3); x.fillStyle = col; x.fill();
    circ(x, 0, 0, 1.4); x.fillStyle = INK2; x.fill();
  });
}

// 수직 빛기둥 (아래가 진함, 가산 합성용). 중심 = 기둥 한가운데
export function beamSpr(col) {
  return bake('bm|' + col, 12, 100, x => {
    x.fillStyle = lin(x, -12, 0, 12, 0, [[0, 'rgba(0,0,0,0)'], [0.3, col], [0.5, '#ffffff'], [0.7, col], [1, 'rgba(0,0,0,0)']]);
    x.fillRect(-12, -100, 24, 200);
    x.globalCompositeOperation = 'destination-in';
    x.fillStyle = lin(x, 0, -100, 0, 100, [[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0.75)'], [1, 'rgba(0,0,0,1)']]);
    x.fillRect(-12, -100, 24, 200);
  }, Math.min(S, 1.5));
}

// 베기 초승달 (가산). 원점 중심, +x 방향으로 휘어짐
export function slashArc(col) {
  return bake('sl|' + col, 36, 36, x => {
    x.beginPath();
    x.arc(0, 0, 34, -1.25, 1.25);
    x.arc(-9, 0, 28, 1.1, -1.1, true);
    x.closePath();
    x.fillStyle = lin(x, -10, 0, 34, 0, [[0, 'rgba(0,0,0,0)'], [0.55, col], [0.85, '#ffffff'], [1, '#ffffff']]);
    x.fill();
  }, Math.min(S, 2));
}

// 무적 방패 돔 (기사 궁극기)
export function shieldDome() { // 성스러운 방패: 채움은 거의 없이(≤0.12) 테두리 룬 띠 + 옅은 육각 결 + 금빛 림 — 마법진 계열과 같은 손
  return bake('dome2', 62, 62, x => {
    circ(x, 0, 0, 60);
    x.fillStyle = rad(x, 0, 0, 30, 60, [[0, 'rgba(255,230,140,0)'], [0.85, 'rgba(255,215,90,0.1)'], [1, 'rgba(255,240,190,0.3)']]);
    x.fill();
    x.save(); circ(x, 0, 0, 50); x.clip();
    x.strokeStyle = 'rgba(255,230,150,0.2)'; x.lineWidth = 1.1;
    const s = 16, h = s * Math.sqrt(3) / 2;
    for (let row = 0, yy = -64; yy < 64; row++, yy += h) {
      for (let xx = -64 + (row % 2) * s * 0.75; xx < 64; xx += s * 1.5) {
        x.beginPath();
        for (let k = 0; k <= 6; k++) { const aa = k * TAU / 6; const px = xx + Math.cos(aa) * s * 0.5, py = yy + Math.sin(aa) * s * 0.5; k ? x.lineTo(px, py) : x.moveTo(px, py); }
        x.stroke();
      }
    }
    x.restore();
    for (const [w, c, al] of [[5, '#ffc94a', 0.35], [2.2, '#ffd86a', 1], [0.9, '#ffffff', 0.9]]) { // 룬 띠
      x.globalAlpha = al; x.strokeStyle = c; x.lineWidth = w;
      circ(x, 0, 0, 59); x.stroke();
      circ(x, 0, 0, 51); x.stroke();
      x.lineWidth = w * 0.7;
      for (let k = 0; k < 14; k++) {
        const a2 = k * TAU / 14;
        x.save(); x.translate(Math.cos(a2) * 55, Math.sin(a2) * 55); x.rotate(a2 + Math.PI / 2);
        glyph(x, 0, 0, 2.6, k); x.restore();
      }
    }
    x.globalAlpha = 1;
    x.beginPath(); x.arc(0, 0, 45, Math.PI * 1.12, Math.PI * 1.42); x.lineWidth = 4; x.strokeStyle = 'rgba(255,255,255,0.55)'; x.stroke();
  }, Math.min(S, 1.5));
}

// 빛의 날개 (전설 티어 영웅, 가산). 원점 = 등
export function lightWings(col) {
  return bake('lw|' + col, 56, 30, x => {
    for (const s of [-1, 1]) {
      x.beginPath();
      x.moveTo(0, 6);
      x.bezierCurveTo(s * 20, -26, s * 44, -30, s * 54, -22);
      x.quadraticCurveTo(s * 44, -16, s * 50, -8);
      x.quadraticCurveTo(s * 38, -6, s * 42, 4);
      x.quadraticCurveTo(s * 28, 2, s * 28, 12);
      x.quadraticCurveTo(s * 14, 8, 0, 6);
      x.fillStyle = lin(x, 0, 0, s * 54, -20, [[0, '#ffffff'], [0.4, col], [1, 'rgba(0,0,0,0)']]);
      x.fill();
    }
  }, Math.min(S, 1.5));
}

// 화살 (+x 방향, 길이 34)
export function arrowSpr(col = '#5fe06e') {
  return bake('ar|' + col, 18, 5, x => {
    x.lineWidth = 3.4; x.strokeStyle = INK2;
    x.beginPath(); x.moveTo(-16, 0); x.lineTo(10, 0); x.stroke();
    x.lineWidth = 1.8; x.strokeStyle = '#d8a860'; x.stroke();
    poly(x, [17, 0, 8, -4, 10, 0, 8, 4]); fs(x, '#eef4ff', 1.6, INK2);
    poly(x, [-16, 0, -10, -4.5, -7, -4.5, -12, 0, -7, 4.5, -10, 4.5]); fs(x, col, 1.4, INK2);
  });
}

// ═════════════ 생성 · 이벤트 연출 · 그리기 ═════════════
// ── 생성 ──
let SKM = null; // v0.1.2 외형 스킨: events 가 내 스킬 이벤트를 처리하는 동안만 part/ring 색을 스킨 램프로 바꾼다(끝나면 null)
// 프레임당 새 입자 상한(events 가 매 프레임 채운다): 3배속에서 한 프레임에 스텝 여러 개의 이벤트가 몰려도 입자 비용이 배로 늘지 않게.
// 넘친 입자는 풀 밖 빈 객체에 쓰고 버린다(호출부는 그대로)
const PART_FRAME = 90, P_SPARE = { life: 0, max: 1, x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 0, size: 1, col: '#fff', k: 0, rot: 0, vr: 0 };
let partLeft = PART_FRAME;
// 그래픽 보통·절전: 낱개 잔입자(크기 ≤ 20 — 꼬리·불씨·먼지; 묶음 burst 는 수를 이미 줄였다)도 fxQ 비율만 남긴다 — 그리기·갱신 호출을 같이 던다(발열 2차).
// 큰 낱개 빛(착탄 섬광 등)은 그대로
let bursting = false;
export function part(k, x, y, vx, vy, life, size, col, g = 0, drag = 0) {
  const p = --partLeft < 0 || (fxQ < 1 && size <= 20 && !bursting && rnd() > fxQ) ? P_SPARE : take(P);
  p.k = k; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.size = size; p.col = SKM ? SKM(col) : col; p.g = g; p.drag = drag;
  p.rot = rnd() * TAU; p.vr = (rnd() - 0.5) * 14;
  return p;
}
export function burst(k, x, y, n, sp0, sp1, life, size, cols, g = 0, drag = 0, up = 0) {
  if (fxQ < 1 && n > 1) n = Math.max(1, Math.round(n * fxQ)); // 그래픽 보통·절전: 묶음 입자 수를 줄인다(모양은 그대로)
  bursting = true;
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, sp = sp0 + rnd() * (sp1 - sp0);
    part(k, x, y, Math.cos(a) * sp, Math.sin(a) * sp - up, life * (0.7 + rnd() * 0.6), size * (0.6 + rnd() * 0.8), typeof cols === 'string' ? cols : cols[(rnd() * cols.length) | 0], g, drag);
  }
  bursting = false;
}
export function ring(x, y, r0, r1, life, col, w) {
  const r = take(RINGS);
  r.x = x; r.y = y; r.r0 = r0; r.r1 = r1; r.life = r.max = life; r.col = SKM ? SKM(col) : col; r.w = w;
}

// ═════════════ 데미지 숫자 (ART §6) ═════════════
// 규칙: 대상별로 0.15초 안 연타는 한 숫자로 합친다(굴러가는 숫자) · 화면에 최대 8개(간소 5) ·
// 크기 = 등급(일반/치명/큰 치명) × 최근 최대 피해 대비 상대값 · 자리는 실제 글자 폭으로 재서 위·옆 칸 →
// 빈 칸이 없으면 **겹쳐 그리지 않고 버린다** · 한 줄(±60)에 최대 4개 · 천장(HUD·보스바 아래)에 닿으면 멈춰 사라짐 ·
// 헤드라인(LEVEL UP·전설 획득·보스 경고·영웅 머리 위) 금지 구역 · 화면 끝 44 안쪽 · '!'는 치명만 · 받은 피해는 빨강 '−'.
// 글자는 숫자마다 오프스크린 캔버스에 한 번 구워 drawImage 로만 그린다(매 프레임 텍스트·그라데이션 없음).
const NUM_PX = 26;                       // 기준 글자 크기(월드 px) — s 배율로 22~56
const RANK_S = { N: 0.85, C: 1.2, B: 1.6, H: 0.9 }; // H = 받은 피해
const NX0 = 44, NX1 = WORLD_W - 44;      // 좌우 안전선
let bossBand = false;                    // 보스바가 떠 있으면 숫자 안전선이 더 아래
const numTop = () => (bossBand ? 204 : 162) - topExtra;
const numH = n => NUM_PX * n.s0 * 1.1; // 테두리·팝 확대까지 포함한 칸 높이
function numW(n) { let w = 0; for (const ch of n.txt) w += adv(ch); return w * n.s0 + 14; }
// 금지 구역: 키별 사각형(중심 x,y · 폭 · 높이) + 남은 시간. 헤드라인을 그리는 쪽이 매 프레임 갱신한다
const ZONES = new Map();
export function numZone(key, x, y, w, h, life = 0.1) {
  let z = ZONES.get(key);
  if (!z) ZONES.set(key, z = {});
  z.x = x; z.y = y; z.w = w; z.h = h; z.t = life;
}
function inZone(x, y, w, h) {
  for (const z of ZONES.values()) if (z.t > 0 && Math.abs(z.x - x) * 2 < z.w + w && Math.abs(z.y - y) * 2 < z.h + h) return true;
  return false;
}
function hitsAny(n, x, y, w, h) {
  let row = 0;
  for (const o of NUMS) {
    if (!o.on || o === n) continue;
    const oh = numH(o);
    if (Math.abs(o.x - x) * 2 < o.w + w && Math.abs(o.y - y) * 2 < oh + h) return true;
    if (Math.abs(o.y - y) < 60 && ++row >= 4) return true; // 한 줄 과밀
  }
  return n.cls !== 'H' && inZone(x, y, w, h);
}
// 새 숫자 자리 잡기: 제자리 → 위 → 좌상/우상 → 더 위 … 전부 막히면 false (겹쳐 그리지 않는다)
const CAND = [[0, 0], [0, -1], [-0.6, -0.5], [0.6, -0.5], [0, -2], [-0.6, -1.5], [0.6, -1.5], [-1.1, 0], [1.1, 0], [0, 1]];
function placeNum(n, x, y) {
  const w = n.w, h = numH(n), top = numTop() + h / 2;
  for (const [cx, cy] of CAND) {
    const py = y + cy * h;
    if (py < top) continue; // 천장 위로는 올리지 않는다(평평하게 눌려 겹치던 원인)
    const maxX = py < 280 - topExtra ? 582 : NX1; // 영웅 버튼(BAG_POS 주변) 피하기
    const px = clamp(x + cx * w, NX0 + w / 2, maxX - w / 2);
    if (!hitsAny(n, px, py, w, h)) { n.x = px; n.y = py; return true; }
  }
  if (y < top) return placeNum(n, x, top + 1); // 천장보다 위에서 난 숫자는 천장 바로 아래로
  return false;
}
function freeSlot(rank) {
  let n = 0, victim = null;
  for (const o of NUMS) {
    if (!o.on) continue;
    n++;
    // 가장 약하고 오래된 숫자부터 비킨다
    if (!victim || RANK_S[o.cls] < RANK_S[victim.cls] || (o.cls === victim.cls && o.t > victim.t)) victim = o;
  }
  if (n < numCap) return true;
  if (!victim || RANK_S[victim.cls] > RANK_S[rank]) return false;
  victim.on = false;
  return true;
}
function styleNum(n) {
  n.s0 = RANK_S[n.cls] * (n.cls === 'H' ? 1 : 0.78 + 0.34 * Math.sqrt(clamp(n.val / numRef, 0, 1)));
  n.txt = (n.cls === 'H' ? '−' : '') + fmt(Math.max(1, n.val)) + (n.crit ? '!' : ''); // 1층 소수 피해가 '0'으로 보이지 않게
  n.w = numW(n);
  // 숫자 폭 ≤ 맞은 적 시각 폭 × 1.25(최소 84) — 잡몹을 통째로 덮는 큰 숫자 금지
  if (n.tgt && typeof n.tgt === 'object' && n.cls !== 'H') {
    const maxW = Math.max(84, visR(n.tgt) * 2.5), k = Math.max(0.72, Math.min(1, maxW / n.w));
    if (k < 1) { n.s0 *= k; n.w = numW(n); }
  }
}
// 고정 문자열 숫자(골드 +N, 회복 +N 등). 합치지 않음
export function num(x, y, str, col, ink, s, crit, life = 0.75) {
  if (!freeSlot(crit ? 'C' : 'N')) return null;
  const n = take(NUMS);
  n.on = true; n.t = 0; n.mt = 0; n.age = 0; n.life = life; n.punch = 0;
  n.txt = str; n.col = col; n.top = lite(col, 0.7); n.ink = ink; n.s = n.s0 = Math.min(2.1, s); n.crit = crit; n.val = 0; n.cls = crit ? 'C' : 'N'; n.tgt = null; n.o = -1;
  n.w = numW(n);
  n.vy = -36;
  if (!placeNum(n, x, y - 10)) { n.on = false; return null; }
  return n;
}
// 피해 숫자. tgt = 맞은 적 객체(같은 대상 연타 합치기 키), 없으면 자리로 합친다
export function dmgNum(x, y, dmg, o, cls, col, ink, s, crit, life, suffix, tgt = null, top = null) {
  if (!(dmg > 0)) return;
  numRef = Math.max(numRef, dmg);
  for (const n of NUMS) {
    if (!n.on || n.cls === '' || n.age > 1.1 || n.mt > 0.25 || (n.cls === 'H') !== (cls === 'H')) continue;
    if (tgt ? n.tgt !== tgt : (n.tgt || Math.abs(n.x - x) > 40 || Math.abs(n.y - y) > 60)) continue;
    n.val += dmg;
    if (RANK_S[cls] > RANK_S[n.cls]) { n.cls = cls; n.col = col; n.top = top || lite(col, 0.7); n.ink = ink; n.life = Math.max(n.life, life); }
    n.crit = n.crit || crit;
    n.mt = 0; n.t = Math.min(n.t, 0.12); n.punch = 1;
    const w0 = n.w, x0 = n.x, y0 = n.y;
    styleNum(n);
    if (n.w > w0 + 4 && !placeNum(n, x0, y0)) { n.x = x0; n.y = y0; } // 커졌으면 다시 비키기(못 비키면 제자리 — 같은 숫자라 겹침 아님)
    return;
  }
  if (numBudget <= 0 || dmg < 0.5 || !freeSlot(cls)) return; // 지속 피해 부스러기는 새 숫자를 띄우지 않는다
  const n = take(NUMS);
  n.on = true; n.t = 0; n.mt = 0; n.age = 0; n.life = life; n.punch = 0;
  n.val = dmg; n.cls = cls; n.o = o; n.tgt = tgt; n.crit = crit;
  n.col = col; n.top = top || lite(col, 0.7); n.ink = ink;
  styleNum(n);
  n.s = n.s0;
  n.vy = cls === 'H' ? -24 : -40;
  if (!placeNum(n, x, y)) { n.on = false; return; }
  numBudget--;
}
// ── 숫자 글자 아틀라스: 글자(0-9 . K M B … − ! +)를 색·크기 단계마다 한 번만 굽고, 숫자는 그 조각을 이어 붙여 그린다 ──
// 숫자마다 캔버스를 굽던 방식은 굴러가는 합계가 바뀔 때마다 캔버스를 GPU로 다시 올려(전투 그리기의 ~40%) 폰을 달궜다.
// 모양은 같다: 글자마다 아래 층(바닥 그림자 + 테두리 0.2em)과 위 층(딱 끊긴 2단 그라데이션, §5.3)을 따로 구워 두고,
// 한 숫자의 아래 층을 전부 그린 뒤 위 층을 그린다(= 문자열 통째로 stroke → fill 과 같은 겹침). 자간은 글자 폭 합(숫자 글꼴은 커닝 없음)
const NUM_STEP = 1.25;                    // 크기 단계(굽는 크기 ÷ 그리는 크기 = 0.89~1.12 — 흐려지지 않게)
const mctx = document.createElement('canvas').getContext('2d'); // 문서 밖 캔버스: 글꼴 설정이 문서 스타일 계산을 강제하지 않는다
const advs = new Map(), atlases = new Map();
function adv(ch) { // NUM_PX 크기 글자 폭
  let a = advs.get(ch);
  if (a === undefined) { mctx.font = `${NUM_PX}px ${NUM_FONT}`; advs.set(ch, a = mctx.measureText(ch).width); }
  return a;
}
// 글꼴이 늦게 도착하면(첫 실행) 대체 글꼴로 잰 폭·구운 글자를 버린다
document.fonts?.addEventListener?.('loadingdone', () => { advs.clear(); atlases.clear(); });
function atlasOf(n, R) {
  const b = Math.round(Math.log(n.s0) / Math.log(NUM_STEP)), key = n.col + n.top + n.ink + b + '|' + R;
  let A = atlases.get(key);
  if (!A) {
    if (atlases.size >= 64) atlases.clear(); // ponytail: 색·크기 조합은 수십 개 — 넘치면 통째로 새로
    const fs = NUM_PX * NUM_STEP ** b, pad = fs * 0.3;
    A = { fs, pad, R, k: fs / NUM_PX, col: n.col, top: n.top, ink: n.ink, rowH: Math.ceil((fs * 1.2 + pad * 2) * R), x: 0, g: new Map(), cv: document.createElement('canvas') };
    A.cv.width = Math.ceil((fs + pad * 2) * R * 8); A.cv.height = A.rowH * 2;
    atlases.set(key, A);
  }
  return A;
}
function numGlyph(A, ch) {
  let g = A.g.get(ch);
  if (g) return g;
  const fs = A.fs, a = adv(ch) * A.k, sw = Math.ceil((a + A.pad * 2) * A.R);
  if (A.x + sw > A.cv.width) { // 자리가 없으면 두 배 폭 캔버스로 옮긴다
    const c = document.createElement('canvas');
    c.width = Math.max(A.cv.width * 2, A.x + sw); c.height = A.cv.height;
    c.getContext('2d').drawImage(A.cv, 0, 0);
    A.cv = c;
  }
  const x = A.cv.getContext('2d'), ox = A.x / A.R + A.pad, cy = A.rowH / A.R / 2;
  x.setTransform(A.R, 0, 0, A.R, 0, 0);
  x.font = `${fs}px ${NUM_FONT}`;
  x.textAlign = 'left'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  x.lineWidth = fs * 0.2;
  x.strokeStyle = A.ink; x.fillStyle = A.ink; // 아래 층: 바닥 그림자 + 테두리
  x.strokeText(ch, ox, cy + fs * 0.085); x.fillText(ch, ox, cy + fs * 0.085);
  x.strokeText(ch, ox, cy);
  const oy = cy + A.rowH / A.R, gr = x.createLinearGradient(0, oy - fs * 0.42, 0, oy + fs * 0.42); // 위 층: 2단 그라데이션
  gr.addColorStop(0, A.top); gr.addColorStop(0.5, A.top); gr.addColorStop(0.53, A.col); gr.addColorStop(1, A.col);
  x.fillStyle = gr;
  x.fillText(ch, ox, oy);
  g = { sx: A.x, sw, a };
  A.x += sw;
  A.g.set(ch, g);
  return g;
}
// 현재 변환(숫자 가운데 = 원점, 월드 단위)에 숫자 하나: 아래 층 전부 → 위 층 전부
function drawNumGlyphs(n, R) {
  const A = atlasOf(n, R), sc = n.s0 / A.k;
  let w = 0;
  for (const ch of n.txt) w += numGlyph(A, ch).a;
  const h = A.rowH / A.R * sc, y = -h / 2;
  for (let row = 0; row < 2; row++) {
    let cx = -w * sc / 2;
    for (const ch of n.txt) {
      const g = A.g.get(ch);
      ctx.drawImage(A.cv, g.sx, row * A.rowH, g.sw, A.rowH, cx - A.pad * sc, y, g.sw / A.R * sc, h);
      cx += g.a * sc;
    }
  }
}
export function nearest(view, x, y, maxD) {
  let best = null, bd = maxD * maxD;
  const es = view.enemies;
  for (let j = 0; j < es.length; j++) {
    const e = es[j], dx = e.x - x, dy = e.y - y, d = dx * dx + dy * dy - e.r * e.r;
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// ══ 마법 판타지 이벤트 연출 ══
export function sprPop(img, x, y, s0, s1, life, ang = 0, spin = 0, sq = 1) {
  const s = take(SPRS);
  s.img = img; s.x = x; s.y = y; s.s0 = s0; s.s1 = s1; s.life = s.max = life; s.ang = ang; s.spin = spin; s.vs = rnd() * TAU; s.sq = sq; s.norm = false;
  return s;
}
// 일반 합성 팝(외곽선 있는 모양 — 밝은 바닥에서도 하얗게 뜨지 않고 형태로 읽힌다). 회전 = ang 그대로
function shapePop(img, x, y, s0, s1, life, ang = 0) { const s = sprPop(img, x, y, s0, s1, life, ang, 0); s.vs = 0; s.norm = true; return s; }
// 만화풍 불꽃 혀(셀 셰이딩 + 굵은 테). 원점 = 뿌리, 끝 = -y
function petal() {
  return bake('f:petal', 12, 22, x => {
    const path = () => { x.beginPath(); x.moveTo(0, -21); x.bezierCurveTo(9, -8, 11, 6, 0, 20); x.bezierCurveTo(-11, 6, -9, -8, 0, -21); };
    path(); fs(x, lin(x, 0, -21, 0, 20, [[0, '#ff4a1a'], [0.45, '#ff8a1e'], [1, '#ffd23a']]), 2.6, '#5a1400');
    x.beginPath(); x.moveTo(0, -6); x.bezierCurveTo(5, 2, 5, 10, 0, 16); x.bezierCurveTo(-5, 10, -5, 2, 0, -6);
    x.fillStyle = '#fff2a0'; x.fill();
    shine(x, -3.5, -2, 1.6, 4, 0.2, 0.7);
  }, Math.min(S, 2));
}
function soul(x, y) {
  const s = take(SOULS);
  s.on = true; s.t = 0; s.dur = 1.4 + rnd() * 0.3; s.x0 = x; s.y0 = y;
  s.cx = x + (GOLD_POS.x - x) * 0.15 + (rnd() - 0.5) * 120; s.cy = Math.min(y, 500) - 180 - rnd() * 80;
  soulPop(x, y);
  wisp(x, y - 12, 1, rnd() < 0.5 ? -1 : 1); // 몸을 떠나는 영혼(제자리에서 솟으며 흩어짐) — 날아가는 영혼과 함께 '거뒀다'가 읽힌다
}
// 영혼 해방(처치 순간): 청록 고리 + 연보라 빛 + 솟는 불씨 — 망령 계열이 적을 거둔 게 또렷하게
function soulPop(x, y) {
  ring(x, y, 6, 64, 0.38, '#9ff6ff', 5);
  part(K_GLOW, x, y - 6, 0, -40, 0.34, 52, '#c070ff');
  burst(K_GLOW, x, y - 8, 3, 30, 90, 0.6, 14, ['#e0c8ff', '#8ff6ff'], -140, 2);
}
function wisp(x, y, s = 1, face = 1) { const w = take(WISPS); w.x = x; w.y = y; w.s = s; w.face = face; w.life = w.max = 1; }
const ghostNear = (view, x, y) => { const gs = view.spellFx && view.spellFx.ghosts; if (gs) for (const q of gs) if ((q.x - x) ** 2 + (q.y - y) ** 2 < 90 * 90) return true; return false; };
// 마나 가득: 바를 따라 흐르는 작은 빛 + 반짝이(큰 흰 원판·고리가 웨이브 바·보석 알약을 덮지 않게)
export function manaSparkle() {
  burst(K_STAR, MANA_POS.x, MANA_POS.y, 12, 40, 180, 0.7, 12, ['#ffffff', '#e0a0ff', '#ff9ad8'], 160, 1.2, 30);
  for (let k = 0; k < 6; k++) part(K_GLOW, MANA_POS.x - 110 + k * 44, MANA_POS.y, 90, 0, 0.18 + k * 0.05, 34, k % 2 ? '#ffffff' : '#d890ff');
}
// 증기 폭발 (화염 + 냉기 융합) — 흰 원판 대신 하늘색 증기 + 주황 심(백색 과부하 금지)
function steamFx(x, y, r, t = tier(3)) {
  part(K_GLOW, x, y, 0, 0, 0.12, r * 0.8, '#ffffff');
  part(K_GLOW, x, y, 0, 0, 0.3, r * 1.6, '#ff8a3a');
  burst(K_SMOKE, x, y, cnt(9, t), 60, 190, 1.0, 46, 'rgba(190,228,255,0.6)', -60, 1.6);
  burst(K_SHARD, x, y, cnt(6, t), 150, 380, 0.6, 6, ['#ffffff', '#bff4ff', '#7fe3ff'], 500, 1, 80);
  if (t.two) burst(K_GLOW, x, y, cnt(6, t), 80, 240, 0.4, 20, ['#ffb040', '#ff6a1f'], -80, 3);
  ring(x, y, 8, r * 1.2, 0.4, '#bfeaff', 9);
  sprPop(starFlash('#7fe3ff'), x, y, 0.4, 0.9 + 0.6 * t.f, 0.22);
  shk(0.05, t);
}
// ═════════════ 스킬 레벨 연출 (DESIGN E): Lv1 소박 → Lv2~3 크기·입자·색 → Lv4~5 보조 레이어 → Lv6 완전체 마무리 ═════════════
// 레벨 = 이벤트 lv(sim) → 없으면 view.spells / view.book(융합이 품은 재료)
export function skillLv(view, key, ev) {
  const v = +(ev && ev.lv) || (view && view.spells && view.spells[key]) || (view && view.book && view.book[key]) || 1;
  return clamp(v | 0, 1, SPELL_MAX_LV);
}
// 등급: s 크기 · n 입자 배율 · two 둘째 색 레이어 · sec 보조 레이어(잔상·룬·2차 폭발) · max 완전체 · sh 흔들림(Lv1 = 0)
function tierOf(lv) {
  const f = (lv - 1) / Math.max(1, SPELL_MAX_LV - 1);
  return Object.freeze({ lv, f, s: 0.7 + 0.4 * f, n: 0.35 + 0.75 * f, two: lv >= 2, sec: lv >= 4, max: lv >= SPELL_MAX_LV, sh: lv < 2 ? 0 : 0.4 + 0.6 * f });
}
const TIERS = Array.from({ length: SPELL_MAX_LV + 1 }, (_, l) => tierOf(Math.max(1, l))); // 매 프레임 새 객체 대신 미리 구운 표(읽기 전용)
export const tier = lv => TIERS[clamp(lv | 0, 1, SPELL_MAX_LV)];
const cnt = (n, t) => Math.max(1, Math.round(n * t.n * (0.4 + 0.6 * glowK))); // 붐비면(glowK↓) 입자 수도 줄인다(LOD)
const shk = (a, t) => { if (t.sh > 0) shake(a * t.sh); };

// 완전체(Lv6) 마무리 연출: 스킬마다 고유한 한 방. 같은 스킬은 gap초에 한 번, 동시에 2개까지(LOD — 폰 60fps) — 막히면 Lv5 모양으로
const FIN = pool(6, () => ({ on: false, t: 0, dur: 1, key: '', x: 0, y: 0, r: 0, dir: 1, pts: null, k: 0 }));
const finAt = new Map();
const CUT = { t: 9, key: '' };      // Lv6 전용 시전 컷(짧게): 마법사 위 스킬 문장 + 원소 베기
const MAXFX = { t: 9, key: '' };    // 만렙 도달 'MAX!' 각성 연출(한 번)
function finale(key, x, y, r, dur, gap = 2.2) {
  if (RT - (finAt.get(key) ?? -9) < gap) return null;
  let live = 0;
  for (const f of FIN) if (f.on) live++;
  if (live >= 2 && key !== 'ghostLegion') return null; // 망령의 문은 번개·융합 마무리에 밀리지 않는다(FX 균형 — 망령 계열 존재감)
  finAt.set(key, RT);
  const f = take(FIN);
  f.on = true; f.t = 0; f.dur = dur; f.key = key; f.x = x; f.y = y; f.r = r; f.dir = rnd() < 0.5 ? 1 : -1; f.pts = null; f.k = 0;
  CUT.t = 0; CUT.key = key;
  const M = MF[0];
  M.big = 1; M.ground = 1;
  return f;
}

// ── 완전체 텍스처 ──
function gateSpr() { // 망령의 문: 돌기둥 두 개 + 아치 + 룬 + 쐐기돌 해골. 원점 = 문 아래 가운데
  return bakeO('f:gate', 96, 118, 110, x => {
    const ink = '#140a22';
    x.fillStyle = rad(x, 0, -80, 4, 90, [[0, 'rgba(154,61,255,0.55)'], [0.6, 'rgba(58,16,96,0.75)'], [1, 'rgba(18,6,31,0.9)']]);
    x.beginPath(); x.moveTo(-62, 0); x.lineTo(-62, -96); x.arc(0, -96, 62, Math.PI, 0); x.lineTo(62, 0); x.closePath(); x.fill();
    for (const s of [-1, 1]) {
      x.beginPath(); x.rect(s * 62 - 13, -104, 26, 104);
      fs(x, lin(x, s * 62 - 13, 0, s * 62 + 13, 0, [[0, '#5a4478'], [0.5, '#3a2a58'], [1, '#231838']]), 3, ink);
      x.beginPath(); x.rect(s * 62 - 17, -112, 34, 12); fs(x, '#4a3868', 3, ink);
      x.beginPath(); x.rect(s * 62 - 17, -6, 34, 8); fs(x, '#4a3868', 3, ink);
    }
    x.beginPath(); x.arc(0, -100, 76, Math.PI, 0); x.arc(0, -100, 58, 0, Math.PI, true); x.closePath();
    fs(x, lin(x, 0, -176, 0, -100, [[0, '#6a5290'], [1, '#2e2048']]), 3, ink);
    x.strokeStyle = '#d8b0ff'; x.lineWidth = 2;
    for (let k = 0; k < 9; k++) { const a = Math.PI + (k + 0.5) * Math.PI / 9; glyph(x, Math.cos(a) * 67, -100 + Math.sin(a) * 67, 4, k); }
    circ(x, 0, -170, 12); fs(x, '#e8e0f0', 2.5, ink);
    x.fillStyle = '#9a3dff'; circ(x, -4.5, -171, 3); x.fill(); circ(x, 4.5, -171, 3); x.fill();
  }, Math.min(S, 1.5));
}
function knightSpr() { // 해골 기사 실루엣(반투명 망령): 투구 깃 · 빛나는 눈 · 방패 · 치켜든 검. 원점 = 발
  return bakeO('f:knight', 30, 44, 40, x => {
    const ink = '#1a0c2c', body = 'rgba(58,30,96,0.92)', rim = '#c9a8ff';
    x.beginPath(); x.moveTo(-12, 0); x.lineTo(-9, -30); x.lineTo(9, -30); x.lineTo(12, 0); x.closePath(); fs(x, body, 2.5, ink);
    x.strokeStyle = rim; x.lineWidth = 1.4;
    for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(-7, -26 + k * 6); x.quadraticCurveTo(0, -23 + k * 6, 7, -26 + k * 6); x.stroke(); }
    ell(x, -12, -30, 7, 5); fs(x, body, 2.2, ink); ell(x, 12, -30, 7, 5); fs(x, body, 2.2, ink);
    circ(x, 0, -44, 11); fs(x, body, 2.5, ink);
    x.beginPath(); x.moveTo(0, -55); x.quadraticCurveTo(10, -66, 18, -58); x.quadraticCurveTo(8, -58, 3, -52); fs(x, '#9a3dff', 1.6, ink);
    x.fillStyle = '#f2c8ff'; circ(x, -4, -44, 2.4); x.fill(); circ(x, 4, -44, 2.4); x.fill();
    x.beginPath(); x.moveTo(-26, -34); x.lineTo(-14, -36); x.lineTo(-14, -14); x.quadraticCurveTo(-20, -8, -26, -14); x.closePath(); fs(x, '#3a2a58', 2.2, ink);
    x.strokeStyle = rim; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-20, -32); x.lineTo(-20, -14); x.stroke();
    x.beginPath(); x.moveTo(14, -28); x.lineTo(22, -70); x.lineTo(25, -69); x.lineTo(18, -27); x.closePath(); fs(x, '#e8e0ff', 1.8, ink);
    x.beginPath(); x.moveTo(10, -30); x.lineTo(22, -32); fs(x, rim, 3, ink);
  }, Math.min(S, 1.5));
}
function crystalSpr() { // 초전도 얼음 왕관의 결정 한 개(세로 육각 기둥, 끝 뾰족)
  return bake('f:crys', 10, 28, x => {
    poly(x, [0, -28, 9, -12, 9, 14, 0, 28, -9, 14, -9, -12]);
    fs(x, lin(x, -9, -28, 9, 28, [[0, '#f0fdff'], [0.45, '#9fe8ff'], [1, '#2a78e0']]), 2, '#1e4a8a');
    x.strokeStyle = 'rgba(255,255,255,0.85)'; x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(0, -26); x.lineTo(0, 26); x.moveTo(-8, -12); x.lineTo(0, -4); x.lineTo(8, -12); x.stroke();
  }, Math.min(S, 2));
}
function maxSpr() { // 'MAX!' 각성 글자 (Impact 계열 + 금 그라데이션 + 굵은 테)
  return bake('f:max', 80, 30, x => {
    x.font = `46px ${NUM_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineJoin = 'round'; x.lineWidth = 10; x.strokeStyle = '#4a1400';
    x.strokeText('MAX!', 0, 4); x.strokeText('MAX!', 0, 0);
    x.fillStyle = lin(x, 0, -20, 0, 20, [[0, '#fffbe0'], [0.48, '#ffe066'], [0.52, '#ffa21a'], [1, '#ff7a1a']]);
    x.fillText('MAX!', 0, 0);
  }, Math.min(S, 2));
}

// 거대 수호룡(완전체): 황금 비늘 몸통(+x 방향) · 날개는 어깨(원점) 기준 따로 구워 퍼덕인다
const GD = { ink: '#3a2008', hi: '#fff0b0', base: '#ffc94a', lo: '#c07a18', mem: '#ffdf80', memLo: '#e8a030' };
function gDragonBody() {
  return bake('f:gdb', 190, 80, x => {
    x.lineJoin = 'round';
    x.beginPath(); x.moveTo(-60, 4); x.bezierCurveTo(-110, 10, -140, 40, -186, 22); x.bezierCurveTo(-150, 52, -104, 34, -56, 26); x.closePath(); // 꼬리
    fs(x, cel(x, 0, -10, 0, 40, GD.base), 3.4, GD.ink);
    poly(x, [-186, 22, -170, 8, -176, 30]); fs(x, GD.lo, 2.4, GD.ink);
    ell(x, -6, 12, 74, 28, -0.06); fs(x, cel(x, 0, -16, 0, 40, GD.base), 3.6, GD.ink); // 몸통
    x.beginPath(); x.moveTo(-50, 26); x.quadraticCurveTo(0, 44, 50, 22); x.lineWidth = 9; x.strokeStyle = GD.hi; x.stroke(); // 배 비늘
    x.strokeStyle = GD.lo; x.lineWidth = 1.6;
    for (let k = -3; k <= 3; k++) { x.beginPath(); x.moveTo(k * 13 - 3, 22 + Math.abs(k)); x.lineTo(k * 13 + 3, 32 - Math.abs(k)); x.stroke(); }
    x.beginPath(); x.moveTo(52, 0); x.bezierCurveTo(78, -8, 88, -30, 108, -34); x.lineTo(118, -18); x.bezierCurveTo(96, -12, 84, 10, 58, 22); x.closePath(); // 목
    fs(x, cel(x, 0, -30, 0, 20, GD.base), 3.4, GD.ink);
    poly(x, [100, -46, 150, -40, 164, -30, 150, -20, 108, -14, 96, -30]); fs(x, cel(x, 0, -46, 0, -14, GD.base), 3.4, GD.ink); // 머리
    poly(x, [104, -44, 80, -68, 92, -42]); fs(x, GD.hi, 2.6, GD.ink); poly(x, [116, -44, 100, -72, 118, -46]); fs(x, GD.hi, 2.6, GD.ink); // 뿔
    circ(x, 130, -34, 4.4); x.fillStyle = '#ffffff'; x.fill(); circ(x, 131.5, -34, 2.4); x.fillStyle = '#2a78e0'; x.fill();
    x.beginPath(); x.moveTo(150, -24); x.lineTo(128, -22); x.lineWidth = 2; x.strokeStyle = GD.ink; x.stroke();
    for (const lx of [-40, 30]) { x.beginPath(); x.moveTo(lx, 32); x.quadraticCurveTo(lx - 6, 50, lx + 8, 54); x.lineWidth = 7; x.strokeStyle = GD.ink; x.stroke(); x.lineWidth = 4; x.strokeStyle = GD.lo; x.stroke(); }
    for (let k = 0; k < 5; k++) poly(x, [-60 + k * 26, -12 + Math.abs(k - 2) * 2, -52 + k * 26, -26 + Math.abs(k - 2) * 2, -44 + k * 26, -12 + Math.abs(k - 2) * 2]), fs(x, GD.hi, 2, GD.ink); // 등 가시
    shine(x, -20, -2, 22, 5, -0.05, 0.55);
  }, Math.min(S, 1.5));
}
function gDragonWing(far) {
  return bake('f:gdw|' + far, 120, 130, x => { // 원점 = 어깨, 날개는 위·뒤로 펼쳐진다
    const m = far ? GD.memLo : GD.mem, pts = [[0, 0], [-40, -60], [-100, -86], [-70, -40], [-110, -40], [-60, -10], [-80, 6]];
    x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(10, -80, 40, -124); x.quadraticCurveTo(0, -100, -100, -86);
    for (let k = 3; k < pts.length; k++) x.lineTo(pts[k][0], pts[k][1]);
    x.closePath();
    fs(x, lin(x, 0, -124, 0, 10, [[0, lite(m, 0.3)], [1, m]]), 3.4, GD.ink);
    x.strokeStyle = far ? GD.lo : '#b8741a'; x.lineWidth = 3;
    for (const [px, py] of [[-100, -86], [-110, -40], [-80, 6]]) { x.beginPath(); x.moveTo(34, -118); x.quadraticCurveTo(px * 0.4, py * 0.6 - 30, px, py); x.stroke(); }
    x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(10, -80, 40, -124); x.lineWidth = 7; x.strokeStyle = GD.ink; x.stroke(); x.lineWidth = 4; x.strokeStyle = far ? GD.lo : GD.base; x.stroke();
  }, Math.min(S, 1.5));
}

// 낙뢰: 하늘에서 지그재그 볼트 (+ Lv2 가지·헤일로, Lv4 바닥 룬·옆 줄기, Lv6 첫 줄기에 하늘 균열 + 번개 왕관)
// ── 번개 존재감(FX 균형 — 사용자: "번개 이펙트만 보여"): 짧고 선명하게 ──
// 동시에 보이는 번개는 종류(kind: 낙뢰·연쇄·융합…)마다 BOLT_CAP 줄(완전체 *Max는 BOLT_FIN), 전부 BOLT_ALL 줄까지(종류의 첫 줄기는 예외). 넘치면 새 줄기를 그리지 않고
// 같은 종류의 가장 최근 번개를 굵게(여러 번개 = 한 줄기 큰 번개로 읽힘) — 종류별 상한이라 연쇄 번개가 낙뢰에 먹히지 않는다.
// 하늘 끝부터 내리꽂는 기둥은 PILLAR_GAP초에 한 번, 나머지 낙뢰는 표적 위 짧은 줄기. 번개 화면 섬광은 BFLASH_GAP초에 한 번·옅게.
const BOLT_CAP = 3, BOLT_FIN = 5, BOLT_ALL = 8, PILLAR_GAP = 0.4, BFLASH_GAP = 0.9;
let pillarAt = -9, bflashAt = -9;
function bolt(pts, life, col, halo, w, kind = 'fx') {
  let all = 0, same = 0, fresh = null;
  for (const b of BOLTS) {
    if (b.life <= 0) continue;
    all++;
    if (b.kind === kind) { same++; if (!fresh || b.life / b.max > fresh.life / fresh.max) fresh = b; }
  }
  // 완전체 피날레(*Max)는 한 번에 터지는 갈래 수(플라즈마 5·초전도 4)를 지킨다. 종류의 첫 줄기는 전체 상한과 무관하게 그린다
  const fin = kind.endsWith('Max');
  if (same >= (fin ? BOLT_FIN : BOLT_CAP) || (same && !fin && all >= BOLT_ALL)) {
    if (fresh) { fresh.w = Math.max(fresh.w, Math.min(fresh.w + 0.15, 1.8)); fresh.life = Math.min(fresh.max, fresh.life + life * 0.25); } // 합쳐진 번개는 가늘어지지 않는다
    return null;
  }
  const b = take(BOLTS);
  b.pts = pts; b.life = b.max = life; b.col = col; b.halo = halo; b.w = w; b.kind = kind; b.sd = (rnd() * 1e9) | 0;
  return b;
}
function boltFlash(a, col) { if (RT - bflashAt < BFLASH_GAP) return; bflashAt = RT; flash(a, col); }
function strike(x, y, sup, first, t = tier(3)) {
  const col = sup ? '#dff8ff' : '#ffe53a', halo = t.two ? (sup ? '#2a78e0' : '#7b5cff') : (sup ? '#7fe3ff' : '#c8a020');
  const tall = first && RT - pillarAt >= PILLAR_GAP; // 하늘 끝 기둥은 가끔만 — 나머지는 표적 위 짧은 줄기
  if (tall) pillarAt = RT;
  const y0 = tall ? -40 : y - 150 - rnd() * 70, x0 = x + (rnd() - 0.5) * (tall ? 140 : 70), mx = (x + x0) / 2 + (rnd() - 0.5) * (tall ? 70 : 36), my = (y0 + y) / 2;
  const kd = sup ? 'sc' : 'ls';
  bolt([[x0, y0], [mx, my], [x, y]], 0.13 + 0.05 * t.f, col, halo, 0.7 + 0.5 * t.f, kd);
  if (t.two && tall) bolt([[mx, my], [mx + (rnd() - 0.5) * 140, my + 70 + rnd() * 60]], 0.11, col, halo, 0.55, kd);
  part(K_GLOW, x, y, 0, 0, 0.07, 26 + 10 * t.f, '#ffffff'); // 흰 섬광은 작고 짧게 — 맞은 적이 빛에 묻히지 않게
  part(K_GLOW, x, y, 0, 0, 0.16, 64 * t.s, sup ? '#2a78e0' : '#7b5cff'); // 헤일로는 보라/파랑(밝은 바닥에 더해도 하얗게 안 뜬다)
  burst(K_SPARK, x, y, cnt(5, t), 300, 640, 0.14, 2.6, [col, '#ffffff'], 0, 6);
  if (first) sprPop(starFlash(sup ? '#7fe3ff' : '#ffe53a'), x, y, 0.3, 0.4 + 0.2 * t.f, 0.12);
  ring(x, y, 8, 50 * t.s, 0.22, col, 4);
  if (t.sec) { // 보조: 바닥 룬 + 그을음
    if (first) sprPop(runeCircle(sup ? '#7fe3ff' : '#ffd23a'), x, y + 6, 0.4, 1.1, 0.3, Math.PI / 2, 2, 0.36);
    const d = take(DECALS); d.x = x; d.y = y + 8; d.r = 24; d.life = d.max = 2.5;
  }
  if (sup) burst(K_SHARD, x, y, cnt(5, t), 150, 380, 0.5, 6, ['#ffffff', '#bff4ff', '#7fe3ff'], 600, 1, 80);
  if (first && t.max && !sup && finale('lightningStrike', x, y, 0, 0.4, 1.8)) { // 완전체: 하늘이 갈라지는 가로 번개 + 두 갈래 낙뢰(짧게)
    const top = Math.max(hudY(200), 60);
    bolt([[x - 300, top + 10], [x - 110, top - 14], [x, top + 6], [x + 140, top - 10], [x + 310, top + 12]], 0.3, col, '#7b5cff', 1, 'lsMax');
    for (const s2 of [-1, 1]) bolt([[x + s2 * 140, top], [x + s2 * 80 + (rnd() - 0.5) * 60, (top + y) / 2], [x + s2 * 30, y]], 0.24, col, '#7b5cff', 0.85, 'lsMax');
    part(K_GLOW, x, top, 0, 0, 0.3, 150, '#7b5cff');
    sprPop(runeCircle('#ffe53a'), x, y + 6, 0.5, 2.6, 0.5, Math.PI / 2, 2.5, 0.36);
    ring(x, y, 12, 150, 0.35, '#ffe53a', 7);
  }
  if (first) boltFlash(0.03 + 0.03 * t.f);
  shk(0.05, t);
}
function judgmentFx(x, w, twi, t = tier(3)) {
  const b = take(LBEAMS);
  b.x = x; b.w = w * (0.35 + 0.6 * t.s); b.y0 = -60 - topExtra; b.y1 = WALL_Y + 10; b.life = b.max = 0.4 + 0.2 * t.f; // Lv1 가는 광선 → Lv6 굵은 광선
  b.core = twi ? '#fff0c0' : '#fff6d0'; b.halo = twi ? '#9a3dff' : '#e0a72e';
  const sc = twi ? '#e0a0ff' : '#fff0a8';
  for (let k = 0; k < cnt(6, t); k++) sprPop(starFlash(sc), x + (rnd() - 0.5) * w, 200 + rnd() * 700, 0.2, 0.7, 0.3);
  for (let k = 0; k < cnt(14, t); k++) part(K_GLOW, x + (rnd() - 0.5) * w, 140 + rnd() * 800, 0, 180 + rnd() * 220, 0.5, 18, k % 2 && t.two ? sc : '#ffe07a', 0, 1);
  if (t.two) sprPop(runeCircle(twi ? '#c070ff' : '#ffd23a'), x, WALL_Y - 26, 0.5, 1.2 + 0.6 * t.f, 0.5, Math.PI / 2, 2, 0.35);
  ring(x, WALL_Y - 26, 10, w * 1.4 * t.s, 0.4, sc, 6);
  if (t.sec) { // 보조: 양옆 가는 쌍둥이 광선 + 떨어지는 빛 깃털
    for (const s of [-1, 1]) lightBeam(x + s * w * 0.9, w * 0.25, 60, WALL_Y, 0.3, sc, twi ? '#9a3dff' : '#e0a72e');
    for (let k = 0; k < 6; k++) part(K_STAR, x + (rnd() - 0.5) * w * 2, 120 + rnd() * 300, (rnd() - 0.5) * 40, 90 + rnd() * 80, 1, 12, sc, 0, 0.6);
  }
  if (t.max && !twi && finale('judgment', x, Math.max(hudY(140), 40), w, 1.1)) { /* 완전체: 천상의 문(날개 + 십자 룬) — drawFinales */ }
  shk(0.08, t);
}
function spellFx(view, ev, n) {
  const fus = view.fusions || [];
  const x = +ev.x || 0, y = warpY(x, +ev.y || 0), t = tier(skillLv(view, ev.key, ev));
  switch (ev.key) {
    case 'lightningStrike': strike(x, y, fus.includes('superconduct'), n === 0, t); break;
    case 'iceLance': {
      const M = MF[ev.o === 1 ? 1 : 0];
      ring(M.ox, M.oy, 6, 56 * t.s, 0.3, '#bff4ff', 4);
      if (!t.max) sprPop(starFlash('#7fe3ff'), M.ox, M.oy, 0.3, 0.6 + 0.3 * t.f, 0.2);
      burst(K_SHARD, M.ox, M.oy, cnt(6, t), 80, 240, 0.45, 5, t.two ? ['#ffffff', '#7fe3ff'] : '#bff4ff', 300, 2);
      if (t.sec) sprPop(runeCircle('#7fe3ff'), M.ox, M.oy, 0.4, 1.3, 0.3, 0, 3);
      if (t.max && finale('iceLance', M.ox, M.oy, 0, 0.6, 1.6)) { // 완전체: 오브 앞 거대한 눈꽃 결정 + 서리 룬 두 겹
        sprPop(sparkle('#5fc8ff'), M.ox, M.oy - 10, 0.5, 2.6, 0.5, 0, 2);
        sprPop(runeCircle('#2a9bff'), M.ox, M.oy, 0.5, 2.6, 0.5, 0, -3);
        burst(K_SHARD, M.ox, M.oy, 14, 200, 520, 0.7, 7, ['#ffffff', '#bff4ff', '#2a78e0'], 400, 1);
      }
      break;
    }
    case 'tornado': {
      const blaze = fus.includes('blazeTornado');
      burst(K_SMOKE, x, y + 24, cnt(7, t), 40, 150, 0.8, 42, blaze ? 'rgba(255,150,70,0.5)' : 'rgba(170,235,210,0.5)', -20, 1.5);
      ring(x, y + 24, 10, 100 * t.s, 0.45, blaze ? '#ffb040' : '#8ff0c8', 6);
      if (t.two) sprPop(runeCircle(blaze ? '#ff8a3a' : '#6ff0c0'), x, y + 26, 0.5, 1.2 + 0.8 * t.f, 0.55, Math.PI / 2, 2, 0.36);
      if (t.max) finale('tornado', x, y, 0, 0.1); // 완전체 표시는 drawTornadoes(하늘까지 닿는 기둥 + 구름 모자)
      break;
    }
    case 'judgment': judgmentFx(x, +ev.w || 50, fus.includes('twilight'), t); break;
    // ── 융합(합체) 스킬: 재료 둘과 확실히 다른 모양 (DESIGN 3) 융합) + 레벨 성장 ──
    case 'blazeTornado': { // 불꽃 회오리: 바닥 불꽃 마법진 + 솟구치는 불기둥 (회오리 몸통은 drawTornadoes)
      const r = +ev.r || 90;
      sprPop(runeCircle('#ff8a3a'), x, y + 20, 0.5, r / 30 * t.s, 0.6, Math.PI / 2, 2, 0.36);
      ring(x, y + 20, 10, r * 1.3 * t.s, 0.45, '#ffb040', 9);
      burst(K_GLOW, x, y, cnt(14, t), 80, 320, 0.7, 24, t.two ? ['#ffd23a', '#ff8a1e', '#ff4a1a'] : '#ff8a1e', -260, 2);
      lightBeam(x, 50 * t.s, y - 160 - 200 * t.f, y + 20, 0.3, '#ffd080', '#ff6a1f');
      if (t.sec) { for (const s of [-1, 1]) shapePop(petal(), x + s * r * 0.6, y - 10, 0.5, 1.8, 0.5, s * 0.3); sprPop(runeCircle('#ffd23a'), x, y + 20, 0.4, r / 44, 0.6, Math.PI / 2, -3, 0.36); }
      if (t.max && finale('blazeTornado', x, y + 20, r, 1.5)) { // 완전체: 하늘까지 닿는 화염 기둥
        burst(K_GLOW, x, y, 18, 120, 420, 1, 22, ['#ffd23a', '#ff6a1f', '#ff2a1a'], -420, 1.2);
        shake(0.2);
      }
      shk(0.08, t);
      break;
    }
    case 'superconduct': { // 초전도: 얼음 번개 여러 줄기 + 서리 섬광
      const pts = Array.isArray(ev.pts) ? ev.pts : [[x, y]];
      pts.slice(0, 8).forEach((q, i) => { // 줄기는 넷까지 — 나머지는 얼음 착탄만(여러 번개 = 한 번의 큰 번개)
        const qy = warpY(q[0], q[1]);
        if (i < 4) strike(q[0], qy, true, i === 0, t);
        else { part(K_GLOW, q[0], qy, 0, 0, 0.14, 44, '#7fe3ff'); burst(K_SHARD, q[0], qy, 3, 120, 300, 0.45, 6, ['#ffffff', '#bff4ff'], 500, 1, 60); }
      });
      boltFlash(0.03 + 0.03 * t.f, '#7fe3ff');
      if (t.sec) for (const q of pts.slice(0, 4)) burst(K_SHARD, q[0], warpY(q[0], q[1]) - 6, 5, 60, 160, 0.9, 9, ['#e8fbff', '#9fe8ff'], -120, 3, 120);
      if (t.max) { const f = finale('superconduct', x, hudY(250), 0, 1.2); if (f) f.pts = pts.slice(0, 8).map(q => [q[0], warpY(q[0], q[1])]); }
      break;
    }
    case 'steamBurst': { // 증기 폭발: 흰 충격파 + 불·얼음 파편
      const r = (+ev.r || 110) * (0.85 + 0.15 * t.s);
      steamFx(x, y, r, t);
      ring(x, y, 10, r * 1.6, 0.5, '#bfeaff', 8);
      sprPop(runeCircle('#ff8a3a'), x, y + 10, 0.5, r / 34, 0.5, Math.PI / 2, 2, 0.36);
      if (t.two) sprPop(runeCircle('#7fe3ff'), x, y + 10, 0.4, r / 44, 0.5, Math.PI / 2, -2, 0.36);
      if (t.sec) for (let k = 0; k < 3; k++) { const a = rnd() * TAU; ring(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.4, 6, r * 0.5, 0.35, k % 2 ? '#ffb040' : '#9fe8ff', 5); }
      if (t.max && finale('steamBurst', x, y, r, 1.4)) { // 완전체: 불·얼음 고리를 두른 증기 간헐천 + 버섯구름
        for (let k = 0; k < 6; k++) part(K_SMOKE, x + (rnd() - 0.5) * 30, y - k * 30, (rnd() - 0.5) * 30, -160 - k * 40, 1.4, 70 - k * 6, 'rgba(190,225,255,0.5)', 0, 1);
      }
      shk(0.12, t);
      break;
    }
    case 'stormEye': { // 폭풍의 눈: 안으로 조여드는 고리 + 보랏빛 섬광 (머무는 폭풍은 drawStorms)
      const r = +ev.r || 130;
      sprPop(runeCircle('#b8a0ff'), x, y, 0.6, r / 28 * t.s, 0.6, Math.PI / 2, 2, 0.42);
      ring(x, y, r * 1.5 * t.s, 12, 0.5, '#b8a0ff', 7);
      if (t.sec) ring(x, y, r * 1.1, 8, 0.4, '#ffe53a', 5);
      boltFlash(0.025 + 0.02 * t.f, '#b8a0ff');
      if (t.max) finale('stormEye', x, y, r, 1.6, 6); // 완전체 구름 벽: 짧게·가끔(FX 균형 — 폭풍이 화면을 덮지 않게)
      break;
    }
    case 'twilight': { // 황혼: 금빛 코어 + 보라 헤일로 광선
      judgmentFx(x, +ev.w || 90, true, t);
      burst(K_SMOKE, x, WALL_Y - 40, cnt(6, t), 30, 120, 0.8, 40, 'rgba(90,40,140,0.5)', -40, 1.5);
      if (t.max && finale('twilight', x, hudY(230), +ev.w || 150, 1.4)) { // 완전체: 광선 위에 일식 — 검은 해 + 금빛 코로나
        lightBeam(x - 30, 40, -topExtra, WALL_Y, 0.9, '#ffe07a', '#e0a72e');
        lightBeam(x + 30, 40, -topExtra, WALL_Y, 0.9, '#e0a0ff', '#6a1fb0');
      }
      break;
    }
    case 'plasma': // 플라즈마 구체: 날아가는 구체는 FIREBALLS(events), 착탄은 fireballBoom
      if (t.max) finale('plasma', x, y, +ev.r || 120, 1.1);
      break;
    case 'ghostLegion': // 망령 군단: 성벽 앞 망령의 문(연보라 룬 + 청록 고리 — 어두운 바닥에서도 보이게)
      sprPop(runeCircle('#c9a2ff'), x, y + 10, 0.6, 2 + t.f * 1.5, 0.8, Math.PI / 2, 2, 0.38);
      burst(K_SMOKE, x, y, cnt(8, t), 40, 160, 0.9, 40, 'rgba(150,110,230,0.4)', -40, 1.5);
      ring(x, y, 10, 160 * t.s, 0.5, '#8ff6ff', 8);
      if (t.sec) sprPop(runeCircle('#9ff6ff'), x, y + 10, 0.5, 1.6, 0.8, Math.PI / 2, -2, 0.38);
      for (let k = 0, n = 2 + Math.round(t.f); k < n; k++) wisp(x + (k - (n - 1) / 2) * 34, y - 16 - rnd() * 16, 1 + 0.2 * t.f, k % 2 ? -1 : 1); // 문에서 솟는 망령
      if (t.max && finale('ghostLegion', x, y + 10, 0, 2.2, 3.2)) shake(0.18);
      break;
    case 'guardianDragon': // 수호룡: 금빛 드래곤이 한 줄을 가로질러 강하 + 성벽 치유 파동
      if (t.max && finale('guardianDragon', x, y - 10, 0, 1.3, 2.6)) { lightBeam(360, 900 + sideX * 2, WALL_Y - 40, WALL_Y + 10, 0.8, '#fff0a8', '#5fe06e'); shake(0.2); }
      else dive(y - 10, t.s);
      ring(x, y, 10, 200 * t.s, 0.5, '#fff0a8', 8);
      lightBeam(360, 900 + sideX * 2, WALL_Y - 30, WALL_Y + 10, 0.4, '#fff0a8', '#9dff9a');
      break;
    case 'babyDragon': {
      const holy = fus.includes('guardianDragon');
      ring(x, y, 10, 80 * t.s, 0.35, holy ? '#fff0a8' : '#ffb040', 5);
      burst(K_GLOW, x, y + 10, cnt(8, t), 60, 200, 0.4, 18, holy ? ['#ffffff', '#fff0a8'] : ['#ffe45a', '#ff8a1e'], 200, 2);
      if (t.max && finale('babyDragon', x, y, 0, 0.1)) sprPop(rays(holy ? '#ffe07a' : '#ff8a1e'), x, y, 0.5, 2.6, 0.6, 0, 2);
      break;
    }
  }
}

function fireballBoom(fb) {
  const { x1: x, y1: y, r } = fb, t = tier(fb.lv || 3);
  const C = fb.plasma ? ['#f0b0ff', '#c860ff', '#6a3aff', '#e090ff'] : ['#fff2a0', '#ff8a1e', '#ff4a1a', '#ffe45a'];
  part(K_GLOW, x, y, 0, 0, 0.12, Math.min(fb.plasma ? 34 : 60, r * (fb.plasma ? 0.2 + 0.1 * t.f : 0.35 + 0.2 * t.f)), '#ffffff'); // 플라즈마 흰 심은 작게(밝은 초원에서 안의 적 윤곽이 남게)
  part(K_GLOW, x, y, 0, 0, fb.plasma ? 0.3 : 0.38, r * (fb.plasma ? 1.2 + 0.5 * t.f : 1.6 + 0.8 * t.f), C[1]); // 플라즈마(번개 계열)는 작고 짧게 — FX 균형
  burst(K_GLOW, x, y, cnt(16, t), 70, 340, 0.6, 26, t.two ? [C[0], C[1], C[2]] : C[1], -140, 3);
  burst(K_SPARK, x, y, cnt(9, t), 400, 900, 0.2, 3.2, [C[3], '#ffffff'], 0, 6);
  if (t.two) { // 연기 + 버섯구름 기둥
    burst(K_SMOKE, x, y, cnt(5, t), 20, 90, 1.1, 54, fb.plasma ? 'rgba(80,30,110,0.5)' : 'rgba(60,36,30,0.55)', -90, 1);
    for (let k = 0; k < 4; k++) part(K_SMOKE, x + (rnd() - 0.5) * 16, y - k * 16, (rnd() - 0.5) * 20, -70 - k * 25, 1.1, 46 - k * 6, fb.plasma ? 'rgba(120,60,160,0.45)' : 'rgba(80,50,40,0.5)', 0, 1);
    burst(K_DEBRIS, x, y, cnt(5, t), 150, 380, 0.8, 6, ['#3a2a28', '#6a5552', C[1]], 900, 0.5, 150);
  }
  ring(x, y, 10, r, 0.35, C[3], 9);
  if (t.two) ring(x, y, 6, r * 0.7, 0.3, C[0], 4);
  sprPop(starFlash(C[1]), x, y, 0.5, r / (fb.plasma ? 60 : 45) * t.s, fb.plasma ? 0.18 : 0.24);
  if (t.two) sprPop(runeCircle(C[1]), x, y, 0.4, r / 30, 0.4, Math.PI / 2, 2, 0.4);
  if (t.sec) { // 보조: 2차 작은 폭발 셋 + 불꽃 잔상 고리
    for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + rnd(), d = r * 0.55; part(K_GLOW, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, 0, 0, 0.3, r * 0.7, C[2]); ring(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, 4, r * 0.4, 0.3, C[3], 5); }
    ring(x, y, r * 0.5, r * 1.35, 0.5, C[2], 6);
  }
  if (t.max && finale(fb.plasma ? 'plasmaBall' : 'fireball', x, y, r, 0.1)) { // 완전체: 태양 꽃잎 — 불꽃 혀 10장이 방사형으로 피어난다 + 짧은 불기둥
    for (let k = 0; k < 10; k++) { const a = k * TAU / 10, d = r * 0.5; shapePop(petal(), x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, 0.5, 1.9, 0.55, a + Math.PI / 2); }
    lightBeam(x, 60, y - 280, y + 10, 0.45, C[0], C[2]);
    sprPop(runeCircle(C[2]), x, y, 0.5, r / 20, 0.6, Math.PI / 2, -2, 0.4);
  }
  const d = take(DECALS);
  d.x = x; d.y = y; d.r = r * 0.7; d.life = d.max = 3;
  fb.kills.forEach((kv, i) => killFx(kv, i < 4, lastMode));
  fb.kills.length = 0;
  shk(0.13, t);
}
// 영웅 원거리 투사체
function shot(cls, x0, y0, x1, y1, crit, speed, delay = 0) {
  const s = take(HSHOTS);
  s.on = true; s.t = 0; s.delay = delay; s.cls = cls; s.x0 = x0; s.y0 = y0; s.x1 = x1; s.y1 = y1; s.crit = crit;
  s.dur = clamp(Math.hypot(x1 - x0, y1 - y0) / speed, 0.05, 0.32);
}
function heroAttackFx(view, ev) {
  const h = view.heroUnit;
  HF.atk = 0; HF.tx = ev.tx; HF.ty = ev.ty;
  const face = ev.tx >= ev.x ? 1 : -1, hx = ev.x, hy = warpY(ev.x, ev.y), tx = ev.tx, ty = warpY(ev.tx, ev.ty);
  const ang = Math.atan2(ty - hy, tx - hx);
  switch (ev.cls) {
    case 'ranger': shot('ranger', hx + face * 16, hy - 16, tx, ty, ev.crit, 1400); break;
    case 'sorcerer': shot('sorcerer', hx + face * 18, hy - 44, tx, ty, ev.crit, 900); break;
    case 'knight':
      sprPop(slashArc(ev.crit ? '#ffe07a' : '#bfe0ff'), tx - Math.cos(ang) * 10, ty - Math.sin(ang) * 10, 0.75, 1.2, 0.2, ang, 0);
      burst(K_SPARK, tx, ty, 4, 250, 520, 0.14, 2.6, ['#ffffff', '#bfe0ff'], 0, 6);
      break;
    case 'cleric': {
      const b = take(LBEAMS);
      b.x = tx; b.w = 30; b.y0 = ty - 170; b.y1 = ty + 12; b.life = b.max = 0.32; b.core = '#ffffff'; b.halo = '#ffc92e';
      ring(tx, ty, 6, 60, 0.3, '#ffe07a', 5);
      burst(K_STAR, tx, ty - 10, 4, 60, 200, 0.4, 12, ['#ffffff', '#ffe07a'], -60, 2);
      break;
    }
    case 'assassin': {
      afterImage(hx - face * 22, hy + 14, face, 0.35);
      for (const r2 of [-0.8, 0.8]) sprPop(slashArc('#ff6a8a'), tx, ty, 0.6, 1, 0.18, ang + r2, 0);
      burst(K_SMOKE, tx, ty, 3, 20, 80, 0.5, 26, 'rgba(90,40,120,0.5)', -20, 2);
      burst(K_SPARK, tx, ty, 4, 250, 520, 0.14, 2.6, ['#ff9ab0', '#ffffff'], 0, 6);
      break;
    }
  }
  if (ev.crit) {
    sprPop(starFlash('#ff8ae8'), tx, ty, 0.4, 1.3, 0.24);
    shake(0.02);
  }
}
const ULT_CALL = { absZero: ['절대영도', '#bff8ff'], knight: ['성스러운 방패', '#ffe07a'], ranger: ['화살비', '#8dff6a'], sorcerer: ['블리자드', '#9fe8ff'], cleric: ['천상의 치유', '#fff3a8'], assassin: ['그림자 난무', '#ff8ad8'] };
function heroUltFx(view, ev) {
  const u = take(ULTS), x = +ev.x || 360, y = +ev.y || 900, r = +ev.r || 170;
  u.on = true; u.t = 0; u.cls = ev.cls; u.x = x; u.y = y + 14; u.r = r; u.tg.length = 0; u.k = 0;
  shake(0.3);
  const cn = ULT_CALL[ev.variant === 'absZero' ? 'absZero' : ev.cls];
  if (cn) stamp(cn[0] + '!', cn[1], 300, 58, 1.1); // 궁극기 이름 외침(클래스 색) — 효과만 번쩍이고 끝나지 않게
  switch (ev.cls) {
    case 'knight':
      u.dur = 0.8;
      // 바닥 룬 서클이 펼쳐지며(원근) 테두리 금빛 고리 하나 — 흰 충격파 없음
      sprPop(runeCircle('#ffc94a'), x, y + 14, 0.6, r / 31, 0.7, Math.PI / 2, 1.2, 0.38);
      ring(x, y, 20, r, 0.45, '#ffc94a', 8);
      sprPop(starFlash('#ffd23a'), x, y - 34, 0.4, 1.1, 0.25);
      burst(K_STAR, x, y - 30, 16, 120, 360, 0.7, 18, ['#ffffff', '#ffe07a'], 0, 2);
      flash(0.12, '#ffd23a');
      for (const e of view.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) <= r + e.r) stuns.set(e.id, RT + 1.5);
      break;
    case 'ranger': {
      u.dur = 1.5;
      for (let k = 0; k < 36; k++) {
        const a = take(ARROWS), aa = rnd() * TAU, d = Math.sqrt(rnd()) * r;
        a.on = true; a.t = 0; a.delay = rnd() * 1.1; a.x = x + Math.cos(aa) * d; a.y = y + Math.sin(aa) * d * 0.8;
      }
      flash(0.12, '#b8ffb0');
      break;
    }
    case 'sorcerer':
      u.dur = 2;
      if (ev.variant === 'absZero') { // 절대영도: 반경 280 전체가 얼어붙는다 — 거대한 서리 룬 + 얼음 결정 폭발 + 기절 별
        u.dur = 2.6;
        sprPop(runeCircle('#e8fbff'), x, y + 14, 0.5, r / 28, 1.2, Math.PI / 2, 0.8, 0.38);
        ring(x, y, 20, r * 1.05, 0.7, '#7fe3ff', 8);
        burst(K_SHARD, x, y - 20, 40, 200, 720, 1.1, 9, ['#ffffff', '#bff4ff', '#7fe3ff'], 300, 1);
        for (const e of view.enemies) if (!e.dead && Math.hypot(e.x - x, e.y - y) <= r + e.r) stuns.set(e.id, RT + (e.named ? 1.5 : 3));
      }
      flash(0.3, '#bff4ff');
      ring(x, y, 20, r, 0.6, '#7fe3ff', 9);
      burst(K_SHARD, x, y - 20, 24, 150, 520, 0.9, 8, ['#ffffff', '#bff4ff', '#7fe3ff'], 300, 1);
      break;
    case 'cleric': {
      u.dur = 1.3;
      const b = take(LBEAMS);
      b.x = x; b.w = 120; b.y0 = -60; b.y1 = y + 16; b.life = b.max = 1.3; b.core = '#ffffff'; b.halo = '#ffc92e';
      ring(x, y, 20, r, 0.7, '#fff0a8', 14);
      ring(x, y, 10, r * 0.6, 0.5, '#ffffff', 6);
      burst(K_STAR, x, y - 30, 26, 120, 460, 1, 18, ['#ffffff', '#fff0a8', '#7dff8a'], -60, 1.5);
      flash(0.3, '#fff0a8');
      break;
    }
    case 'assassin': {
      u.dur = 0.8;
      const es = view.enemies.filter(e => !e.dead).sort((a, b) => (b.isBoss ? 1 : 0) - (a.isBoss ? 1 : 0)).slice(0, 5);
      for (const e of es) u.tg.push(e.x, e.y);
      flash(0.3, '#5a1a8a');
      burst(K_SMOKE, x, y, 8, 40, 160, 0.8, 50, 'rgba(60,20,90,0.6)', -20, 1.5);
      break;
    }
  }
}

// ═════════════ 성벽 마법사 주문 · 영웅 궁극 특성 · 로그라이트 순간 ═════════════
const FRAGS = pool(40, () => ({ on: false, t: 0, dur: 0.2, x0: 0, y0: 0, x1: 0, y1: 0 }));      // 불꽃 산탄 파편
const MOTES = pool(24, () => ({ on: false, t: 0, dur: 0.3, x0: 0, y0: 0, x1: 0, y1: 0, arc: 60, col: '#fff', big: 1 })); // 시전 → 표적으로 날아가는 마력 구슬
const TOSS = pool(4, () => ({ on: false, t: 0, pts: [], seg: 0.1 }));                             // 튕기는 방패
const LINES = pool(8, () => ({ life: 0, max: 0.3, x0: 0, y0: 0, x1: 0, y1: 0, col: '#fff', halo: '#fff', w: 1 })); // 관통 저격 직선
const REVIVE = { t: 9, hero: false };                                                             // 부활 결계(성벽 방패 폭발)
export const SUMMON_COL = { wolf: '#8fe8ff', shadow: '#b04dff', arcane: '#c08aff' };
let fbBooms = 0, frags = 0, berserkRT = -9;
export let warcryUntil = -9; // 전군 강화 함성: 마법사·영웅 금빛 오라(units)

// 불꽃 산탄: 화염구 파편이 가까운 적들에게 흩어진다
function shardsFx(ev) {
  if (!Array.isArray(ev.pts) || frags > 10) return;
  frags++;
  const y0 = warpY(ev.x, ev.y);
  for (const pt of ev.pts) {
    const f = take(FRAGS);
    f.on = true; f.t = 0; f.x0 = ev.x; f.y0 = y0; f.x1 = pt[0]; f.y1 = warpY(pt[0], pt[1]);
    f.dur = clamp(Math.hypot(f.x1 - f.x0, f.y1 - f.y0) / 900, 0.08, 0.2);
  }
}
function mote(x0, y0, x1, y1, col, dur, arc = 60, big = 1) {
  const m = take(MOTES);
  m.on = true; m.t = 0; m.x0 = x0; m.y0 = y0; m.x1 = x1; m.y1 = y1; m.col = col; m.dur = dur; m.arc = arc; m.big = big;
}
// 쿨타임 주문 시전: 주문이 '허공에서'가 아니라 마법사 지팡이에서 출발한다
// 스킬이 주인공(DESIGN 스킬 중심 개편): 시전마다 오브 섬광 + 원소색 마력 구슬이 표적으로. 융합 = 두 원소 줄기가 꼬여 날아감
const castFlashAt = [-9, -9];
function castLaunch(ev) {
  const o = ev.o === 1 ? 1 : 0, M = MF[o], [col, col2] = skillCols(ev.spell), ox = M.ox, oy = M.oy, fused = !!FUSION_BY_KEY[ev.spell];
  const tx = +ev.tx || 360, ty = warpY(tx, +ev.ty || 500);
  // 지팡이 섬광: 오브 크기 정도로(마법사를 하얗게 덮지 않게), 같은 마법사는 0.3초에 한 번만(분당 160회 시전에 계속 번쩍이지 않게)
  if (RT - castFlashAt[o] > 0.3 || ev.linked) { castFlashAt[o] = RT; sprPop(starFlash(col), ox, oy, 0.3, fused ? 0.8 : 0.6, 0.18); }
  if (fused) { // 합체 스킬: 두 원소 마법진이 겹쳐 돈다 + 두 줄기가 꼬여 표적으로
    sprPop(runeCircle(col), ox, oy, 0.5, 1.5, 0.35, 0, 3);
    sprPop(runeCircle(col2), ox, oy, 0.5, 1.2, 0.35, 0.4, -3);
    mote(ox, oy, tx, ty, col, 0.32, 90, 1.3);
    mote(ox, oy, tx, ty, col2, 0.32, -90, 1.3);
  } else switch (ev.spell) {
    case 'lightningStrike': { // 지팡이에서 하늘로 번개를 쏘아 올린다 → 낙뢰가 떨어짐
      const top = Math.max(oy - 220, 80);
      bolt([[ox, oy], [ox + (rnd() - 0.5) * 40, (oy + top) / 2], [ox + (rnd() - 0.5) * 70, top]], 0.12, '#ffe53a', '#7b5cff', 0.55, 'ls');
      part(K_GLOW, ox, oy, 0, 0, 0.14, 44, '#ffe53a');
      break;
    }
    case 'tornado': mote(ox, oy, tx, ty - 20, '#6ff0c0', 0.3, 40); break;
    case 'judgment': // 지팡이에서 가는 빛줄기가 하늘로 → 심판 광선이 내려온다
      lightBeam(ox, 12, oy - 420, oy, 0.3, '#ffffff', '#e0a72e');
      break;
    case 'iceLance': part(K_GLOW, ox, oy, 0, 0, 0.18, 60, '#7fe3ff'); break;
    default: part(K_GLOW, ox, oy, 0, 0, 0.16, 56, col);
  }
  if (ev.support) supportLink(ox, oy, tx, ty, col); // 지원 사격: 영웅이 싸우는 적을 노린다
  if (ev.linked) { // 합동 필살: 하늘까지 솟는 기둥 + 큰 마법진
    lightBeam(ox, 46, oy - 700, oy, 0.5, '#ffffff', '#ff6fd2');
    sprPop(runeCircle('#ffb0e0'), ox, oy, 0.6, 2.6, 0.5, 0, 2);
    ring(ox, oy, 10, 160, 0.45, '#ffd0f0', 10);
  }
}

// ═════════════ 완전체(Lv6) 마무리 · Lv6 시전 컷 · MAX! 각성 — 갱신/그리기 ═════════════
// 스킬 레벨이 만렙에 닿는 순간(spellPick level = 만렙) 한 번: 마법사 자리 금빛 기둥 + 스킬 문장 + 'MAX!'
function maxFx(key) {
  const M = MF[0];
  MAXFX.t = 0; MAXFX.key = key;
  ring(M.cx, MAGE_FEET - 60, 10, 190, 0.6, '#ffd23a', 10);
  burst(K_STAR, M.cx, MAGE_FEET - 150, 22, 120, 380, 0.9, 16, ['#fff6c8', '#ffd23a', ...skillCols(key)], 80, 1.6);
  flash(0.14, '#ffb020');
  shake(0.14);
}
function updateFinales(da) {
  CUT.t += da; MAXFX.t += da;
  for (const f of FIN) {
    if (!f.on) continue;
    const u0 = f.t / f.dur;
    f.t += da;
    const u = f.t / f.dur;
    if (u >= 1) { f.on = false; continue; }
    switch (f.key) {
      case 'blazeTornado': // 기둥을 타고 솟는 불티
        if (rnd() < da * 30) part(K_GLOW, f.x + (rnd() - 0.5) * f.r * 0.6, f.y - rnd() * 500, (rnd() - 0.5) * 60, -220 - rnd() * 200, 0.7, 14, rnd() < 0.5 ? '#ffd23a' : '#ff6a1f', 0, 1);
        break;
      case 'superconduct': // 얼음 왕관이 뜬 뒤 결정마다 표적으로 얼음 번개
        if (u0 < 0.15 && u >= 0.15 && f.pts) f.pts.forEach((p, i) => {
          const cx = crownX(f) + (i - (f.pts.length - 1) / 2) * 34;
          bolt([[cx, f.y + 20], [(cx + p[0]) / 2 + (rnd() - 0.5) * 60, (f.y + p[1]) / 2], [p[0], p[1]]], 0.26, '#dff8ff', '#2a78e0', 0.8, 'scMax');
          burst(K_SHARD, p[0], p[1], 6, 120, 360, 0.7, 8, ['#ffffff', '#bff4ff', '#2a78e0'], 500, 1, 90);
          sprPop(sparkle('#e8fbff'), p[0], p[1], 0.4, 2.2, 0.4, rnd() * TAU, 3);
        });
        break;
      case 'stormEye': // 구름 벽에서 쉴 새 없이 벼락
        if (rnd() < da * 6) {
          const a = rnd() * TAU, cy = f.y - f.r * 1.7;
          bolt([[f.x + Math.cos(a) * f.r * 1.8, cy + Math.sin(a) * f.r * 0.45], [f.x + (rnd() - 0.5) * f.r * 1.4, f.y + (rnd() - 0.5) * f.r * 0.5]], 0.12, '#ece4ff', '#7b5cff', 0.75, 'se');
        }
        break;
      case 'plasma': // 조여들던 전기 고리가 터지며 번개 8갈래가 화면 끝까지
        if (u0 < 0.62 && u >= 0.62) {
          for (let k = 0; k < 5; k++) { // 번개 다섯 갈래(화면 끝까지 대신 반경 두 배쯤)
            const a = k * TAU / 5 + rnd() * 0.4;
            bolt([[f.x, f.y], [f.x + Math.cos(a) * 170 + (rnd() - 0.5) * 50, f.y + Math.sin(a) * 170], [f.x + Math.cos(a) * 400, f.y + Math.sin(a) * 400]], 0.22, '#ffc8ff', '#9a3dff', 0.9, 'plMax');
          }
          ring(f.x, f.y, 10, f.r * 2.2, 0.5, '#e07aff', 10);
          flash(0.06, '#c040ff');
          shake(0.22);
        }
        break;
      case 'ghostLegion': // 문 안에서 새어 나오는 망령 불빛
        if (rnd() < da * 18) part(K_GLOW, f.x + (rnd() - 0.5) * 110, f.y - rnd() * 170, (rnd() - 0.5) * 30, -50, 0.9, 16, rnd() < 0.5 ? '#b48aff' : '#7a3aff', 0, 1);
        break;
      case 'guardianDragon': { // 날개 끝에서 떨어지는 금빛 불씨
        const p = dragonAt(f, u);
        if (rnd() < da * 40) part(K_GLOW, p[0] - f.dir * 80 + (rnd() - 0.5) * 120, p[1] + 30 + (rnd() - 0.5) * 60, (rnd() - 0.5) * 50, 80 + rnd() * 90, 0.8, 18, rnd() < 0.5 ? '#ffe07a' : '#9dff9a', 0, 1);
        break;
      }
    }
  }
}
const crownX = f => clamp(f.x, 200, 520);
const dragonAt = (f, u) => [lerp(-sideX - 300, WORLD_W + sideX + 300, f.dir > 0 ? u : 1 - u), f.y - 150 + Math.sin(u * 6) * 22];
// back = 적 아래 층(drawUltGround 에서): 기둥·문·구름·일식 / front = 이펙트 위 층(drawCollab 에서): 행렬·드래곤·구체·컷·MAX
export function drawFinales(back) { // 가장 눈에 띄어야 할 빛 = 우선 빛(예산에 덜 눌림)
  setLightPrio(true);
  drawFinales0(back);
  setLightPrio(false);
}
function drawFinales0(back) {
  for (const f of FIN) {
    if (!f.on) continue;
    const u = f.t / f.dur, a = Math.min(1, u * 6) * Math.min(1, (1 - u) * 4), e = easeOut(Math.min(1, u * 3));
    if (back) switch (f.key) {
      case 'blazeTornado': { // 하늘까지 닿는 화염 기둥
        const top = -topExtra - 20, H = f.y - top, w = f.r * 0.8 * (0.85 + 0.15 * Math.sin(T * 22)) * e;
        additive(true);
        ctx.globalAlpha = 0.45 * a; spr(hu('#ff3a1a'), f.x, top + H / 2, f.r * 2 * e, H * 1.05);
        ctx.globalAlpha = 0.8 * a; ctx.drawImage(beamSpr('#ff6a1f'), f.x - w / 2, top + H * (1 - e), w, H * e);
        groundRune(runeCircle('#ff6a1f'), f.x, f.y, f.r / 26, T * 3, 0.8 * a);
        ctx.globalAlpha = 0.5 * a; spr(hu('#ffb040'), f.x, top + 60, f.r * 2.6, 160);
        additive(false);
        const fl = petal(); // 기둥을 휘감고 솟는 불꽃 혀(형태로 읽히게 일반 합성)
        for (let k = 0; k < 16; k++) {
          const v = (k / 16 + T * 0.9) % 1, py = f.y - v * H * e, px = f.x + Math.sin(v * 14 - T * 8) * f.r * 0.45 * (1 - 0.5 * v), s = 1.9 - 1.1 * v;
          ctx.globalAlpha = a * (1 - v * 0.7);
          place(px, py, Math.sin(v * 9 + T * 5) * 0.35, s, s);
          ctx.drawImage(fl, -fl.hw, -fl.hh, fl.hw * 2, fl.hh * 2);
        }
        wt();
        break;
      }
      case 'superconduct': { // 하늘의 얼음 왕관
        const X = crownX(f), cr = crystalSpr();
        additive(true);
        ctx.globalAlpha = 0.5 * a; spr(hu('#2a78e0'), X, f.y, 420 * e, 170);
        ctx.globalAlpha = 0.6 * a; spr(hu('#7fe3ff'), X, f.y, 260 * e, 90);
        additive(false);
        for (let k = -3; k <= 3; k++) {
          const s = (1.5 - Math.abs(k) * 0.22) * e;
          ctx.globalAlpha = a;
          place(X + k * 34, f.y + Math.abs(k) * 9 - 6 + Math.sin(T * 4 + k) * 3, k * 0.12, s, s);
          ctx.drawImage(cr, -cr.hw, -cr.hh, cr.hw * 2, cr.hh * 2);
        }
        wt();
        break;
      }
      case 'steamBurst': { // 불·얼음 고리를 두른 증기 간헐천: 솟는 증기 기둥 + 올라가는 불·얼음 고리 + 버섯 머리
        const H = 440 * e, top = f.y - H, sm = soft('rgba(185,222,255,0.6)');
        additive(true);
        ctx.globalAlpha = 0.5 * a; spr(hu('#ff6a1f'), f.x, f.y - 10, f.r * 1.6, f.r * 0.7);
        ctx.globalAlpha = 0.35 * a; spr(hu('#5fb8ff'), f.x, f.y - H / 2, f.r * 1.1, H * 1.1);
        ctx.globalAlpha = 0.7 * a; ctx.drawImage(beamSpr('#7fd0ff'), f.x - 22, top, 44, H);
        groundRune(runeCircle('#ff8a3a'), f.x, f.y + 8, f.r / 26, T * 2.5, 0.8 * a);
        groundRune(runeCircle('#7fe3ff'), f.x, f.y + 8, f.r / 34, -T * 3, 0.8 * a);
        ctx.lineWidth = 4;
        for (let k = 0; k < 4; k++) { // 기둥을 타고 올라가는 고리(불·얼음 번갈아)
          const v = (k / 4 + T * 0.7) % 1, ry = f.y - v * H, rr = f.r * (0.35 + 0.25 * v);
          ctx.globalAlpha = a * (1 - v) * 0.9; ctx.strokeStyle = k % 2 ? '#ff8a3a' : '#7fe3ff';
          ctx.beginPath(); ctx.ellipse(f.x, ry, rr, rr * 0.3, 0, 0, TAU); ctx.stroke();
        }
        additive(false);
        for (let k = 0; k < 9; k++) { // 소용돌이치며 솟는 증기(아래 가늘고 위로 퍼진다)
          const v = ((k / 9) + T * 0.35) % 1, s2 = 50 + 110 * v;
          ctx.globalAlpha = 0.6 * a * Math.sin(v * Math.PI);
          spr(sm, f.x + Math.sin(T * 4 + k * 1.3) * 22 * v, f.y - v * H, s2 * 1.4, s2);
        }
        ctx.globalAlpha = 0.6 * a; spr(sm, f.x - 60 * e, top, 200 * e, 110 * e); spr(sm, f.x + 60 * e, top, 200 * e, 110 * e); spr(sm, f.x, top - 40 * e, 240 * e, 130 * e);
        break;
      }
      case 'stormEye': { // 하늘을 덮는 폭풍 구름 벽(도는 먹구름 고리) + 가운데 금빛 눈 + 땅까지 이어진 깔때기
        const cy = f.y - f.r * 1.7, cl = soft('rgba(44,30,92,0.85)');
        additive(true);
        ctx.globalAlpha = 0.2 * a; spr(hu('#7b5cff'), f.x, (cy + f.y) / 2, f.r * 1.1, f.y - cy + f.r);
        additive(false);
        for (let k = 0; k < 10; k++) { // 먹구름 고리(뒤쪽 반은 옅게) — 화면 폭을 다 덮지 않게 반경·크기를 줄였다
          const an = T * 0.9 + k * TAU / 10, rx = f.r * 1.35 * e, s2 = f.r * (0.62 + 0.18 * Math.sin(k * 2.3));
          ctx.globalAlpha = a * (Math.sin(an) > 0 ? 0.55 : 0.3);
          spr(cl, f.x + Math.cos(an) * rx, cy + Math.sin(an) * rx * 0.28, s2 * 1.5, s2 * 0.8);
        }
        additive(true);
        ctx.lineWidth = 4;
        for (let k = 0; k < 3; k++) {
          const rr = f.r * (0.8 + k * 0.35) * e, a0 = T * (1.6 - k * 0.35) + k * 2;
          ctx.globalAlpha = 0.5 * a; ctx.strokeStyle = k % 2 ? '#7b5cff' : '#c8b8ff';
          ctx.beginPath(); ctx.ellipse(f.x, cy, rr, rr * 0.3, 0, a0, a0 + 4.2); ctx.stroke();
        }
        ctx.globalAlpha = a * (0.6 + 0.2 * Math.sin(T * 12)); spr(hu('#ffe53a'), f.x, cy, 90, 38);
        spr(gl('#ffe53a'), f.x, cy, 24, 14);
        additive(false);
        break;
      }
      case 'twilight': { // 일식: 검은 해 + 금빛 코로나 + 보랏빛 번짐
        const R = 52 * e;
        additive(true);
        ctx.globalAlpha = 0.35 * a; spr(hu('#9a3dff'), f.x, f.y, R * 7, R * 7);
        ctx.globalAlpha = 0.6 * a; spr(hu('#e0a72e'), f.x, f.y, R * 4, R * 4);
        ctx.globalAlpha = 0.85 * a; place(f.x, f.y, T * 0.6, R / 26, R / 26); ctx.drawImage(rays('#ffd23a'), -60, -60, 120, 120); wt();
        additive(false);
        ctx.globalAlpha = a; circ(ctx, f.x, f.y, R); ctx.fillStyle = '#14061f'; ctx.fill();
        additive(true);
        ctx.lineWidth = 3; ctx.strokeStyle = '#ffe07a'; ctx.stroke();
        ctx.globalAlpha = a * 0.9; spr(sparkle('#fff0a8'), f.x - R * 0.72, f.y - R * 0.72, 30 * e, 30 * e);
        additive(false);
        break;
      }
      case 'ghostLegion': { // 거대한 망령의 문 + 걸어 나오는 해골 기사
        const g = gateSpr(), kn = knightSpr(), sc = 1.75;
        ctx.globalAlpha = 0.9 * a;
        place(f.x, f.y, 0, sc, sc * e);
        put(g);
        wt();
        additive(true);
        ctx.globalAlpha = a * (0.5 + 0.15 * Math.sin(T * 6)); spr(hu('#9a3dff'), f.x, f.y - 110 * sc * e, 150, 200 * e);
        ctx.globalAlpha = 0.7 * a; place(f.x, f.y - 100 * sc * e, 0, 1, 1); ctx.rotate(T * 2); ctx.drawImage(runeCircle('#c890ff'), -60, -60, 120, 120); wt();
        additive(false);
        for (let k = 0; k < 4; k++) {
          const kt = clamp((u - 0.12 - k * 0.07) / 0.62, 0, 1);
          if (kt <= 0) continue;
          const kx = f.x + (k - 1.5) * 46 * (1 + kt), ky = f.y - 10 - kt * 280, bob = Math.abs(Math.sin(T * 9 + k)) * 5;
          additive(true); ctx.globalAlpha = 0.45 * a; spr(hu('#7a3aff'), kx, ky - 40, 70, 90); additive(false);
          ctx.globalAlpha = a * Math.min(1, kt * 4) * 0.9;
          place(kx, ky - bob, Math.sin(T * 9 + k) * 0.05, 1.3, 1.3);
          put(kn);
          wt();
        }
        break;
      }
      case 'judgment': { // 천상의 문: 광선 꼭대기에 거대한 빛의 날개 + 십자 룬
        const lw = lightWings('#ffd23a');
        additive(true);
        ctx.globalAlpha = 0.4 * a; spr(hu('#e0a72e'), f.x, f.y, 320 * e, 200 * e);
        ctx.globalAlpha = 0.6 * a; place(f.x, f.y, 0, 3.4 * e, 3.4 * e); ctx.drawImage(lw, -lw.hw, -lw.hh, lw.hw * 2, lw.hh * 2); wt();
        ctx.globalAlpha = 0.8 * a; place(f.x, f.y, 0, 1, 1); ctx.rotate(-T); ctx.drawImage(runeCircle('#ffd23a'), -70 * e, -70 * e, 140 * e, 140 * e); wt();
        additive(false);
        break;
      }
    }
    else switch (f.key) {
      case 'plasma': { // 조여드는 전기 고리 세 겹
        const R = f.r * 0.6 * (u < 0.62 ? 1.2 - 0.6 * (u / 0.62) : 0.6 + 1.4 * ((u - 0.62) / 0.38));
        additive(true);
        ctx.globalAlpha = 0.6 * a; spr(hu('#c040ff'), f.x, f.y, R * 2.6, R * 2.6);
        ctx.lineWidth = 3.5;
        ['#e07aff', '#ffb0ff', '#7b5cff'].forEach((c, k) => {
          ctx.globalAlpha = 0.85 * a; ctx.strokeStyle = c;
          ctx.beginPath(); ctx.ellipse(f.x, f.y, R, R * 0.34, T * (2 + k) + k * 1.05, 0, TAU); ctx.stroke();
        });
        ctx.globalAlpha = a; spr(gl('#e07aff'), f.x, f.y, 40, 40);
        additive(false);
        break;
      }
      case 'ghostLegion': { // 화면을 가로지르는 유령 행렬
        const gs = ghostSpr('#d8c0ff');
        for (let k = 0; k < 12; k++) {
          const p = clamp(u * 1.5 - k * 0.04, 0, 1);
          if (p <= 0 || p >= 1) continue;
          const x = lerp(-sideX - 80, WORLD_W + sideX + 80, f.dir > 0 ? p : 1 - p), y = hudY(400) + 60 + Math.sin(k * 1.7) * 80 + Math.sin(T * 5 + k) * 12;
          additive(true); ctx.globalAlpha = 0.45 * a; spr(hu('#9a3dff'), x - f.dir * 30, y + 4, 90, 36); additive(false);
          ctx.globalAlpha = 0.85 * a;
          place(x, y, Math.sin(T * 6 + k) * 0.12, f.dir * 1.25, 1.25);
          ctx.drawImage(gs, -gs.hw, -gs.hh, gs.hw * 2, gs.hh * 2);
          wt();
        }
        break;
      }
      case 'guardianDragon': { // 하늘을 가르는 거대한 황금 수호룡 + 금·초록 빛의 꼬리
        const [x, y] = dragonAt(f, u), body = gDragonBody(), wn = gDragonWing(false), wf = gDragonWing(true), sc = 1.5;
        const flap = Math.sin(RT * 7), d = f.dir;
        additive(true);
        for (let k = 1; k <= 6; k++) { ctx.globalAlpha = 0.3 * a * (1 - k / 7); spr(hu(k % 2 ? '#ffe07a' : '#5fe06e'), x - d * (k * 70 + 120), y + 20, 220 - k * 18, 90 - k * 8); }
        ctx.globalAlpha = 0.4 * a; spr(hu('#ffc94a'), x, y - 20, 480, 300);
        additive(false);
        ctx.globalAlpha = 0.97 * a;
        place(x, y, 0.06 * d + 0.04 * flap, d * sc, sc);
        ctx.save(); ctx.translate(-4, -6); ctx.scale(1.35, 1.35 * (0.55 + 0.45 * flap)); ctx.rotate(-0.15); ctx.drawImage(wf, -wf.hw, -wf.hh, wf.hw * 2, wf.hh * 2); ctx.restore();
        ctx.drawImage(body, -body.hw, -body.hh, body.hw * 2, body.hh * 2);
        ctx.save(); ctx.translate(14, -4); ctx.scale(1.45, 1.45 * (0.6 + 0.4 * flap)); ctx.drawImage(wn, -wn.hw, -wn.hh, wn.hw * 2, wn.hh * 2); ctx.restore();
        wt();
        break;
      }
    }
  }
  ctx.globalAlpha = 1;
  if (back) { // MAX 각성 기둥·발밑 룬은 마법사 뒤로(마법사를 하얗게 덮지 않게)
    if (MAXFX.t < 1.8 && MAXFX.key) {
      const x = MF[0].cx, feet = MAGE_FEET, t = MAXFX.t, al = Math.min(1, (1.8 - t) / 0.4), h = 520 * Math.min(1, t * 4);
      additive(true);
      ctx.globalAlpha = 0.5 * al; spr(hu('#ffb020'), x, feet - 260, 130, 560);
      ctx.globalAlpha = 0.6 * al; ctx.drawImage(beamSpr('#ffc94a'), x - 22, feet - h, 44, h);
      groundRune(runeCircle('#ffd23a'), x, feet - 2, 2.6, T * 2.5, 0.9 * al);
      additive(false);
      ctx.globalAlpha = 1;
    }
    return;
  }
  if (CUT.t < 0.7 && CUT.key) { // Lv6 전용 시전 컷: 마법사 위로 스킬 문장이 톡 + 원소 두 색 빛살
    const M = MF[0], x = M.ox, y = M.oy - 92, e = easeBack(Math.min(1, CUT.t / 0.2)), al = Math.min(1, (0.7 - CUT.t) / 0.25), [c1, c2] = skillCols(CUT.key);
    additive(true);
    ctx.globalAlpha = 0.5 * al; place(x, y, T * 1.2, e * 1.5, e * 1.5); ctx.drawImage(rays(c1), -60, -60, 120, 120); wt();
    ctx.globalAlpha = 0.35 * al; place(x, y, -T * 0.8 + 0.26, e * 1.1, e * 1.1); ctx.drawImage(rays(c2), -60, -60, 120, 120); wt();
    additive(false);
    const em = emblem(CUT.key, 1.2);
    if (em) { ctx.globalAlpha = al; spr(em, x, y, 64 * e, 64 * e); }
    ctx.globalAlpha = 1;
  }
  if (MAXFX.t < 1.8 && MAXFX.key) { // 만렙 각성: 금빛 기둥 + 발밑 룬 + 스킬 문장 + MAX!
    const x = MF[0].cx, feet = MAGE_FEET, t = MAXFX.t, al = Math.min(1, (1.8 - t) / 0.4), e = easeBack(Math.min(1, t / 0.28));
    const em = emblem(MAXFX.key, 1.4), my = feet - 200 - 20 * Math.min(1, t);
    ctx.globalAlpha = al;
    if (em) spr(em, x, my, 78 * e, 78 * e);
    const mt = maxSpr(), ms = e * (1 + 0.08 * Math.sin(RT * 10));
    place(x, my - 64, -0.06, ms, ms);
    ctx.drawImage(mt, -mt.hw, -mt.hh, mt.hw * 2, mt.hh * 2);
    wt();
    ctx.globalAlpha = 1;
  }
}

// ═════════════ 스킬 중심 개편: 융합 합체 · 협공 · 합동 필살 · 지원 사격 (drawCollab 층) ═════════════
// 스킬(기본 14 + 융합 8) → [원소 메인색, 둘째 색]
export function skillCols(key) {
  const f = FUSION_BY_KEY[key];
  if (f) return [EL[f.elements[0]][1], EL[f.elements[1]][1]];
  const sp = SPELL_BY_KEY[key], c = sp && EL[sp.element] ? EL[sp.element][1] : '#ffffff';
  return [c, c];
}
const COLLAB_COL = ['#ff8ae8', '#ffd23a'];                                   // 협공 = 영웅 분홍 × 마법사 금
const LINKS = pool(8, () => ({ life: 0, max: 0.45, x0: 0, y0: 0, x1: 0, y1: 0, col: '#fff' })); // 지원 사격 조준선
const TETHERS = pool(4, () => ({ life: 0, max: 1, w: 1, c0: '#fff', c1: '#fff' }));             // 영웅 ↔ 내 마법사 빛줄기
const STREAMS = pool(4, () => ({ on: false, t: 0, dur: 0.6, x0: 0, y0: 0, col: '#fff', arc: 1 })); // 융합 합체: 스택 → 마법사
const DIVES = pool(3, () => ({ on: false, t: 0, dur: 0.75, y: 500, dir: 1, s: 1 }));                  // 수호룡 강하
const MERGE = { t: 9, cols: ['#fff', '#fff'], key: '' };
const emPop = new Map(); // 협공 엠블럼 톡(키별 2.5초에 한 번 — 연타 협공이 화면을 도배하지 않게)
function supportLink(x0, y0, x1, y1, col) {
  const L = take(LINKS);
  L.life = L.max = 0.45; L.x0 = x0; L.y0 = y0; L.x1 = x1; L.y1 = y1; L.col = col;
}
function tether(life, w, c0 = COLLAB_COL[0], c1 = COLLAB_COL[1]) {
  const t = take(TETHERS);
  t.life = t.max = life; t.w = w; t.c0 = c0; t.c1 = c1;
}
function emblemPop(key, x, y, s = 1) {
  if (RT - (emPop.get(key) ?? -9) < 2.5) return;
  emPop.set(key, RT);
  const em = emblem(key, 1.2);
  if (em) sprPop(em, x, y, 0.4 * s, 0.95 * s, 0.9);
}
// 협공 효과가 실제로 터질 때(collabProc) — 협공마다 모양이 다르다
const CPROC = {
  anvil(x, y) { // 모루와 망치: 하늘에서 금빛 망치가 도발당한 무리에 내리꽂힘
    lightBeam(x, 64, y - 320, y + 6, 0.28, '#ffffff', '#ffb03a');
    ring(x, y, 10, 150, 0.4, '#ffd23a', 11);
    sprPop(starFlash('#ffd23a'), x, y, 0.5, 2.2, 0.3);
    burst(K_DEBRIS, x, y, 8, 150, 420, 0.8, 7, ['#a8a08e', '#6a6254', '#ffd23a'], 900, 0.5, 200);
    burst(K_SPARK, x, y, 10, 400, 900, 0.2, 3.4, ['#ffe45a', '#ffffff'], 0, 6);
    const d = take(DECALS); d.x = x; d.y = y + 6; d.r = 40; d.life = d.max = 2;
    shake(0.12);
  },
  ironLine(x, y) { // 철벽 전선: 강철빛 방패 결계가 펼쳐짐
    ring(x, y, 20, 130, 0.5, '#bfe0ff', 9);
    sprPop(runeCircle('#9fd0ff'), x, y + 12, 0.6, 1.8, 0.5, Math.PI / 2, 2, 0.36);
    burst(K_SPARK, x, y - 30, 8, 200, 500, 0.2, 3, ['#ffffff', '#bfe0ff'], 0, 6);
  },
  frostBastion(x, y) { ring(x, y + 10, 10, 110, 0.5, '#bff4ff', 8); burst(K_SHARD, x, y, 8, 120, 360, 0.6, 6, ['#ffffff', '#bff4ff', '#7fe3ff'], 500, 1, 60); sprPop(runeCircle('#7fe3ff'), x, y + 14, 0.5, 1.6, 0.5, Math.PI / 2, 1.5, 0.36); },
  thunderArrow(x, y) { // 뇌전 화살: 화살 끝에서 번개가 튄다(작고 짧게 — 번개가 화면을 독점하지 않게)
    sprPop(starFlash('#ffe53a'), x, y, 0.3, 0.7, 0.14);
    ring(x, y, 6, 42, 0.2, '#ffe53a', 4);
    burst(K_SPARK, x, y, 4, 300, 620, 0.13, 2.4, ['#ffe53a', '#ffffff', '#b8a0ff'], 0, 6);
  },
  frostShot(x, y) { sprPop(sparkle('#e8fbff'), x, y, 0.5, 1.6, 0.3, rnd() * TAU, 4); burst(K_SHARD, x, y, 6, 120, 340, 0.5, 5, ['#ffffff', '#7fe3ff'], 400, 2); },
  galeArrow(x, y) { for (let k = 0; k < 5; k++) part(K_SPARK, x, y - 20 + k * 10, -260 - rnd() * 200, (rnd() - 0.5) * 60, 0.22, 3, '#6ff0c0', 0, 3); ring(x, y, 6, 50, 0.25, '#b8ffe8', 4); },
  twinFlame(x, y) { // 쌍화염: 영웅 분홍 불꽃과 마법사 주황 불꽃이 겹친다
    ring(x, y, 8, 110, 0.4, '#ff8a2a', 8);
    ring(x, y, 4, 80, 0.35, '#ff8ae8', 6);
    sprPop(starFlash('#ff6fd2'), x, y, 0.4, 1.5, 0.25, 0.4);
  },
  stormCall(x, y) { ring(x, y, 10, 140, 0.4, '#b8a0ff', 8); boltFlash(0.04, '#b8a0ff'); },
  frostEcho(x, y) { ring(x, y, 6, 70, 0.35, '#bff4ff', 6); sprPop(sparkle('#e8fbff'), x, y - 10, 0.4, 1.3, 0.3, rnd() * TAU, 3); },
  holyAssault(x, y) { // 성광 협공: 광선이 영웅을 치유 — 영웅 위로 금빛 기둥 + 초록 치유 입자
    lightBeam(x, 70, y - 420, y + 12, 0.5, '#ffffff', '#ffe07a');
    ring(x, y + 10, 10, 90, 0.45, '#9dff9a', 6);
    for (let k = 0; k < 10; k++) part(K_STAR, x + (rnd() - 0.5) * 60, y - rnd() * 80, 0, -90 - rnd() * 60, 0.8, 12, k % 2 ? '#9dff9a' : '#ffffff', 0, 1);
  },
  sanctuary(x, y) { ring(x, y, 10, 110, 0.5, '#ffe07a', 7); for (let k = 0; k < 6; k++) part(K_STAR, x + (rnd() - 0.5) * 70, y - rnd() * 60, 0, -80, 0.7, 12, '#9dff9a', 0, 1); },
  purgeFlame(x, y) { burst(K_GLOW, x, y, 8, 60, 200, 0.5, 18, ['#fff0a8', '#ffb030', '#ff6a1f'], -160, 2); sprPop(starFlash('#ffd23a'), x, y, 0.3, 1.1, 0.22); },
  shadowExec(x, y) { // 그림자 처형: 보랏빛 X 베기 + 연기
    sprPop(slashArc('#b04dff'), x, y, 0.6, 1.7, 0.28, 0.8, 0, 0.5);
    sprPop(slashArc('#ff8ad8'), x, y, 0.6, 1.7, 0.28, -0.8 + Math.PI, 0, 0.5);
    sprPop(starFlash('#c070ff'), x, y, 0.4, 1.6, 0.25);
    burst(K_SMOKE, x, y, 5, 30, 120, 0.6, 34, 'rgba(70,30,110,0.55)', -20, 2);
  },
  soulHunt(x, y) { const M = MF[0]; mote(x, y, M.ox, M.oy, '#c070ff', 0.5, 90, 0.9); ring(M.ox, M.oy, 6, 50, 0.3, '#c070ff', 5); },
};
function collabFx(view, ev) {
  const h = view.heroUnit, x = +ev.x || (h ? h.x : 360), y = warpY(x, +ev.y || (h ? h.y : 500));
  switch (ev.type) {
    case 'collab': { // 협공이 켜진 순간: 영웅 ↔ 내 마법사 빛줄기 + 영웅 위 협공 엠블럼
      tether(1.4, 1.3);
      if (h) {
        const hy = warpY(h.x, h.y);
        ring(h.x, hy - 40, 10, 120, 0.5, COLLAB_COL[0], 8);
        emblemPop(ev.key, h.x, hy - 170, 1.3);
        burst(K_STAR, h.x, hy - 60, 14, 80, 260, 0.7, 14, ['#ffffff', ...COLLAB_COL], -40, 2);
      }
      break;
    }
    case 'collabProc': {
      const f = CPROC[ev.key];
      if (f) f(x, y);
      emblemPop(ev.key, x, y - 110, 0.8);
      if (ev.key !== 'holyAssault' && ev.key !== 'sanctuary') tether(0.35, 0.6);
      break;
    }
    case 'linkFinish': { // 합동 필살: 큰 섬광 + 링 + 영웅 자리 기둥 + 두껍게 이어진 빛줄기 (슬로 모션은 hud)
      flash(0.45); flash(0.5, '#ff9ae6');
      punchZoom(0.9); shake(0.35);
      ring(x, y, 20, 420, 0.7, '#ffb0e0', 16);
      ring(x, y, 10, 260, 0.55, '#fff0a8', 9);
      lightBeam(x, 120, y - 560, y + 12, 0.7, '#ffffff', '#ff6fd2');
      sprPop(rays('#ffd23a'), x, y - 60, 0.5, 3.2, 0.7, 0, 1.5);
      burst(K_STAR, x, y - 40, 34, 150, 520, 0.9, 20, ['#ffffff', '#ffd23a', '#ff8ae8'], 60, 1.6);
      tether(1.1, 2.4, '#ff6fd2', '#ffd23a');
      break;
    }
    case 'fusionMerge': { // 합체: 오른쪽 스킬 스택 쪽에서 두 원소 줄기가 날아와 내 마법사 오브에서 합쳐진다
      const from = Array.isArray(ev.from) ? ev.from : [];
      const ca = skillCols(from[0])[0], cb = skillCols(from[1])[0];
      for (let i = 0; i < 2; i++) {
        const st = take(STREAMS);
        st.on = true; st.t = 0; st.dur = 0.62 + i * 0.06; st.x0 = WORLD_W + sideX - 50; st.y0 = hudY(320 + i * 120); st.col = i ? cb : ca; st.arc = i ? -1 : 1;
      }
      MERGE.t = 0; MERGE.cols = [ca, cb]; MERGE.key = String(ev.fusion || '');
      break;
    }
  }
}
function updateCollab(da) {
  for (const L of LINKS) if (L.life > 0) L.life -= da;
  for (const t of TETHERS) if (t.life > 0) t.life -= da;
  for (const st of STREAMS) {
    if (!st.on) continue;
    st.t += da;
    const p = streamAt(st, Math.min(1, st.t / st.dur));
    if (rnd() < 0.8) part(K_GLOW, p[0], p[1], (rnd() - 0.5) * 40, (rnd() - 0.5) * 40, 0.35, 16, st.col, 0, 2);
    if (st.t >= st.dur) st.on = false;
  }
  if (MERGE.t < 0.7 && (MERGE.t += da) >= 0.7) { // 두 줄기가 오브에 닿는 순간
    const M = MF[0], [ca, cb] = MERGE.cols;
    M.big = 1; M.ground = 1; M.cast = 1; M.col = ca;
    flash(0.3); shake(0.25);
    ring(M.ox, M.oy, 10, 220, 0.55, ca, 10);
    ring(M.ox, M.oy, 6, 150, 0.45, cb, 8);
    sprPop(starFlash('#ffffff'), M.ox, M.oy, 0.5, 2.6, 0.35);
    sprPop(runeCircle(ca), MF[0].cx, MAGE_FEET - 2, 0.6, 2.6, 0.8, Math.PI / 2, 2, 0.38);
    burst(K_STAR, M.ox, M.oy, 24, 120, 420, 0.8, 18, ['#ffffff', ca, cb], 0, 2);
    const em = emblem(MERGE.key, 1.4);
    if (em) sprPop(em, M.ox, M.oy - 90, 0.4, 1.3, 1.1);
  }
  for (const d of DIVES) {
    if (!d.on) continue;
    d.t += da;
    const u = d.t / d.dur, x = lerp(-sideX - 120, WORLD_W + sideX + 120, d.dir > 0 ? u : 1 - u);
    if (x > -20 && x < WORLD_W + 20) for (let k = 0; k < 2; k++) part(K_GLOW, x - d.dir * 30 + (rnd() - 0.5) * 30, d.y + 20 + (rnd() - 0.5) * 30, (rnd() - 0.5) * 60, 60 + rnd() * 80, 0.6, 26, k ? '#fff0a8' : '#ffb030', 0, 2);
    if (d.t >= d.dur) d.on = false;
  }
}
function streamAt(st, u) {
  const M = MF[0], e = u * u * (3 - 2 * u);
  const cx = (st.x0 + M.ox) / 2 - 60, cy = Math.min(st.y0, M.oy) - 120 * st.arc;
  const a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
  return [a * st.x0 + b * cx + c * M.ox, a * st.y0 + b * cy + c * M.oy];
}
function dive(y, s = 1) {
  const d = take(DIVES);
  d.on = true; d.t = 0; d.y = y; d.dir = rnd() < 0.5 ? 1 : -1; d.s = s;
}
// 층: 파티클·운석·영혼 위 (render.js). 빛줄기 · 조준선 · 합체 줄기 · 수호룡
export function drawCollab(view) {
  const h = view.heroUnit, M = MF[0];
  additive(true);
  // 영웅 ↔ 내 마법사 빛줄기: 협공 순간(TETHERS) + 합동 필살 창(linkT)이 열려 있는 동안 맥동
  if (h && h.state !== 'down') {
    let w = 0, c0 = COLLAB_COL[0], c1 = COLLAB_COL[1];
    for (const t of TETHERS) if (t.life > 0) { const a = t.life / t.max; if (t.w * a > w) { w = t.w * a; c0 = t.c0; c1 = t.c1; } }
    if (view.linkT > 0) w = Math.max(w, 0.5 + 0.15 * Math.sin(RT * 5)); // 느린 맥동(빠른 떨림은 지저분한 낙서처럼 보인다)
    if (w > 0.02) {
      const hx = h.x, hy = warpY(h.x, h.y) - 60, mx = (hx + M.ox) / 2, my = Math.min(hy, M.oy) - 90;
      for (const [c, lw, al] of [[c0, 10, 0.25], [c1, 4, 0.7], ['#ffffff', 1.8, 0.95]]) { // 가는 빛줄기(굵기 상한 1.3배)
        ctx.globalAlpha = Math.min(1, w) * al; ctx.strokeStyle = c; ctx.lineWidth = lw * Math.min(1.3, 0.6 + w * 0.4);
        ctx.beginPath(); ctx.moveTo(M.ox, M.oy); ctx.quadraticCurveTo(mx, my, hx, hy); ctx.stroke();
      }
      const g = gl('#ffffff');
      for (let k = 0; k < 4; k++) { // 흐르는 빛 알갱이 (마법사 → 영웅)
        const u = (RT * 1.6 + k / 4) % 1, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u;
        ctx.globalAlpha = Math.min(1, w) * 0.9;
        spr(g, a * M.ox + b * mx + c * hx, a * M.oy + b * my + c * hy, 18, 18);
      }
      ctx.globalAlpha = Math.min(1, w) * 0.5;
      spr(gl(c0), hx, hy, 90, 90);
    }
  }
  // 지원 사격 조준선: 마법사 오브 → 영웅이 싸우는 적
  for (const L of LINKS) {
    if (L.life <= 0) continue;
    const a = L.life / L.max;
    for (const [c, lw, al] of [[L.col, 7, 0.3], ['#ffffff', 1.8, 0.85]]) {
      ctx.globalAlpha = a * al; ctx.strokeStyle = c; ctx.lineWidth = lw;
      ctx.setLineDash([14, 10]); ctx.lineDashOffset = -RT * 120;
      ctx.beginPath(); ctx.moveTo(L.x0, L.y0); ctx.lineTo(L.x1, L.y1); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  // 융합 합체 줄기: 굵은 빛 꼬리 + 원소 구슬 머리(일반 합성 — 밝은 바닥에서도 또렷)
  for (const st of STREAMS) {
    if (!st.on) continue;
    const u = Math.min(1, st.t / st.dur), g = gl(st.col);
    for (let k = 9; k >= 0; k--) {
      const p = streamAt(st, Math.max(0, u - k * 0.03));
      ctx.globalAlpha = (1 - k / 10) * 0.9;
      spr(k < 2 ? gl('#ffffff') : g, p[0], p[1], 90 - k * 7, 90 - k * 7);
    }
  }
  additive(false);
  ctx.globalAlpha = 1;
  for (const st of STREAMS) {
    if (!st.on) continue;
    const p = streamAt(st, Math.min(1, st.t / st.dur));
    spr(magicCore('#ffffff', st.col, dim(st.col, 0.5)), p[0], p[1], 34, 34);
  }
  for (const L of LINKS) { // 조준경
    if (L.life <= 0) continue;
    const a = L.life / L.max;
    ctx.globalAlpha = a;
    place(L.x1, L.y1, RT * 3, 0.9 + 0.3 * a, 0.9 + 0.3 * a);
    ctx.drawImage(reticle(), -32, -32, 64, 64);
    wt();
  }
  // 수호룡 강하: 금빛 드래곤이 전장을 가로지르며 한 줄을 불태운다
  for (const d of DIVES) {
    if (!d.on) continue;
    const u = d.t / d.dur, x = lerp(-sideX - 120, WORLD_W + sideX + 120, d.dir > 0 ? u : 1 - u), img = babyDragon(true);
    ctx.globalAlpha = Math.min(1, Math.sin(u * Math.PI) * 3);
    additive(true); spr(hu('#ffe07a'), x, d.y, 260 * d.s, 160 * d.s); additive(false);
    place(x, d.y + Math.sin(u * 9) * 8, 0.1 * d.dir, 2.4 * d.dir * d.s, 2.4 * d.s);
    ctx.drawImage(img, -img.hw, -img.hh, img.hw * 2, img.hh * 2);
    wt();
  }
  ctx.globalAlpha = 1;
  drawFinales(false); // 완전체 앞층(유령 행렬·거대 수호룡·플라즈마 고리) + Lv6 시전 컷 + MAX!
}
// 폭풍의 눈(머무는 폭풍): 끌어당기는 소용돌이 구름 + 바닥 번개 룬 — drawTornadoes가 부른다
function drawStorms(view) {
  const ss = view.spellFx && view.spellFx.storms;
  if (!ss || !ss.length) return;
  for (const st of ss) {
    const a = Math.min(1, st.t * 3) * clamp((st.life - st.t) / 0.5, 0, 1), r = st.r, y = warpY(st.x, st.y);
    ctx.globalAlpha = 0.22 * a;
    spr(soft('rgba(50,40,110,0.75)'), st.x, y, r * 2, r * 0.82);
    additive(true);
    groundRune(runeCircle('#ffe53a'), st.x, y, r / 48, T * 1.6, 0.42 * a);
    ctx.lineWidth = 3;
    for (let k = 0; k < 4; k++) { // 안쪽으로 감기는 바람 호
      const a0 = -T * (3 + k * 0.6) + k * 1.6, rr2 = r * (0.9 - k * 0.16);
      ctx.globalAlpha = 0.45 * a; ctx.strokeStyle = k % 2 ? '#b8a0ff' : '#e8f0ff';
      ctx.beginPath(); ctx.ellipse(st.x, y, rr2, rr2 * 0.42, 0, a0, a0 + 1.9); ctx.stroke();
    }
    ctx.globalAlpha = 0.26 * a * (0.7 + 0.3 * Math.sin(T * 20));
    spr(hu('#b8a0ff'), st.x, y - r * 0.2, r * 1.4, r * 1.05);
    additive(false);
    if (rnd() < 0.5) { const an = rnd() * TAU; part(K_SPARK, st.x + Math.cos(an) * r, y + Math.sin(an) * r * 0.42, -Math.cos(an) * 220, -Math.sin(an) * 90, 0.35, 2.6, '#e8f0ff', 0, 2); }
  }
  ctx.globalAlpha = 1;
}

// 영웅 궁극 특성·특성 효과 (heroProc)
const HP_COL = { judgeBolt: '#fff0a8', pillar: '#ffd23a', scythe: '#b04dff', plague: '#9dff5a', meteor: '#ff8a1e' };
function heroProcFx(view, ev) {
  const x = +ev.x || 360, y = warpY(x, +ev.y || 500), r = +ev.r || 90;
  switch (ev.kind) {
    case 'shieldToss': { // 금빛 방패가 적 사이를 튕겨 다닌다
      if (!Array.isArray(ev.pts) || ev.pts.length < 2) break;
      const s = take(TOSS);
      s.on = true; s.t = 0; s.pts = ev.pts.map(p => [p[0], warpY(p[0], p[1]) - 20]); s.seg = 0.09;
      break;
    }
    case 'judgeBolt': { // 심판의 번개: 하늘에서 금빛 번개 + 바닥 룬
      bolt([[x + (rnd() - 0.5) * 80, y - 520], [x + (rnd() - 0.5) * 50, y - 240], [x, y]], 0.24, '#fff6c0', '#e0a72e', 1.2, 'hero');
      sprPop(runeCircle('#ffd23a'), x, y + 6, 0.5, r / 30, 0.4, Math.PI / 2, 2, 0.38);
      ring(x, y, 10, r, 0.3, '#fff0a8', 6);
      part(K_GLOW, x, y, 0, 0, 0.2, r * 1.4, '#ffe07a');
      burst(K_SPARK, x, y, 8, 300, 700, 0.18, 3, ['#ffffff', '#ffe07a'], 0, 6);
      shake(0.06);
      break;
    }
    case 'warcry': { // 전군 강화 함성: 영웅에서 금빛 파동 3겹 → 마법사에게 번짐
      warcryUntil = RT + (+ev.t || 8);
      for (let k = 0; k < 3; k++) ring(x, y - 30, 10 + k * 20, 160 + k * 90, 0.5 + k * 0.12, k === 1 ? '#ffffff' : '#ffb03a', 8 - k * 2);
      for (const M of MF) if (M === MF[0] || mageOn(view, 1)) mote(x, y - 40, M.ox, M.oy, '#ffc94a', 0.35, 90);
      stamp('전군 강화!', '#ffc23a', 390, 56, 1);
      break;
    }
    case 'snipe': { // 관통 저격: 화면 끝까지 뻗는 초록·흰 직선
      const L = take(LINES);
      L.x0 = x + (ev.tx > x ? 16 : -16); L.y0 = y - 20; L.x1 = +ev.tx; L.y1 = warpY(+ev.tx, +ev.ty);
      L.life = L.max = 0.32; L.col = '#f4ffe8'; L.halo = '#6aff5a'; L.w = 1;
      sprPop(starFlash('#b8ffb0'), L.x0, L.y0, 0.4, 1.4, 0.2);
      shake(0.05);
      break;
    }
    case 'arrowStorm': { // 화살 폭풍: 3연사(첫 발은 heroAttack이 쏜다)
      const tx = +ev.tx, ty = warpY(tx, +ev.ty);
      for (let k = 1; k < 3; k++) shot('ranger', x + (ev.tx >= x ? 16 : -16), y - 16 - k * 6, tx + (rnd() - 0.5) * 30, ty + (rnd() - 0.5) * 20, false, 1400, k * 0.06);
      break;
    }
    case 'meteor': { // 작은 운석: 하늘에서 떨어져 표적 주변 폭발
      const m = take(METEORS);
      m.on = true; m.x1 = x; m.y1 = y; m.x0 = x - 140; m.y0 = y - 520; m.t = 0; m.delay = 0; m.dur = 0.2; m.kills = null; m.r = r;
      break;
    }
    case 'pillar': // 천벌 기둥: 가장 밀집한 무리에 굵은 금빛 기둥 + 바닥 룬
      lightBeam(x, r * 0.8, -60, y + 10, 0.6, '#ffffff', '#ffc92e');
      sprPop(runeCircle('#ffd23a'), x, y + 8, 0.6, r / 28, 0.6, Math.PI / 2, 1.5, 0.38);
      ring(x, y, 10, r * 1.1, 0.4, '#fff0a8', 8);
      burst(K_STAR, x, y - 20, 14, 80, 320, 0.8, 16, ['#ffffff', '#ffe07a'], -60, 2);
      shake(0.12);
      break;
    case 'scythe': { // 처형자의 낫: 보라 초승달이 영웅 주위를 한 바퀴 휩쓸고 지나감
      for (let k = 0; k < 2; k++) sprPop(slashArc('#8a2ae0'), x, y - 20, r / 70, r / 44, 0.3, k * Math.PI, TAU * 0.6); // 낫 두 번 휘두름(보라, 흰 원판 금지)
      ring(x, y - 10, 20, r, 0.3, '#b04dff', 6);
      burst(K_SMOKE, x, y - 10, 6, 40, 160, 0.6, 34, 'rgba(60,20,90,0.5)', -20, 2);
      shake(0.1);
      break;
    }
    case 'plague': { // 역병: 독 구름이 터지며 주변 적에게 번진다
      burst(K_SMOKE, x, y, 7, 30, 140, 0.9, 40, 'rgba(90,170,40,0.45)', -30, 1.5);
      ring(x, y, 10, r, 0.4, '#9dff5a', 6);
      if (Array.isArray(ev.pts)) for (const p of ev.pts.slice(0, 6)) mote(x, y, p[0], warpY(p[0], p[1]), '#9dff5a', 0.25, 30, 0.7);
      break;
    }
    case 'execute': // 즉사: 붉은 X 베기 + 해골 섬광(짧게)
      for (const r2 of [-0.8, 0.8]) sprPop(slashArc('#ff3a4a'), x, y, 0.5, 0.9, 0.18, r2 + Math.PI / 2, 0);
      sprPop(starFlash('#ff5a6a'), x, y, 0.3, 0.9, 0.2);
      break;
    case 'nova': { // [특성 트랙] 핵심 노드 발동(talents.js ks): 색 고리 + 불꽃 몇 개 — 짧고 하얗게 덮지 않는다
      const col = { bash: '#8fd0ff', critBurst: '#ffe07a', holyNova: '#ffd23a', shadowStrike: '#b04dff', grace: '#fff0a8', surge: '#c07aff', ultRefresh: '#7cf0ff' }[ev.sub] || ev.col || '#ffe07a';
      if (ev.sub === 'pull') { // [특성 4차] 끌어모으기: 고리가 조여 들고 끌려온 적 자리에서 빛 알갱이가 모인다
        ring(x, y, r, 12, 0.34, col, 6);
        if (Array.isArray(ev.pts)) for (const p of ev.pts.slice(0, 6)) mote(p[0], warpY(p[0], p[1]), x, y, col, 0.3, 20, 0.7);
        break;
      }
      ring(x, y, 8, r, 0.28, col, 5);
      burst(K_SPARK, x, y, 6, 200, 480, 0.18, 2.4, [col, '#ffffff'], 0, 6);
      break;
    }
    case 'bolt': // [특성 4차] 도탄·비전 연쇄·분열 화염: 한 적에서 다음 적으로 튀는 작은 탄
      shot(ev.cls === 'sorcerer' ? 'sorcerer' : 'ranger', x, y - 16, +ev.tx, warpY(+ev.tx, +ev.ty), false, 1300);
      break;
    case 'cardBless': { // 카드 축복: 영웅 → 내 마법사로 금빛 구슬 + 알림
      const h = view.heroUnit, M = MF[0];
      if (h) mote(h.x, h.y - 50, M.ox, M.oy, '#ffe07a', 0.45, 120, 1.4);
      pop('카드 축복!', '스킬 레벨 +1', '#ffd23a', 360, 700);
      break;
    }
  }
}
// 소환물 공격: 늑대 물기(흰 초승달 2개) · 그림자 분신 X 베기 · 비전 분신 보라 마력탄
function summonAtkFx(ev) {
  const tx = +ev.tx, ty = warpY(tx, +ev.ty), x = +ev.x, y = warpY(x, +ev.y), ang = Math.atan2(ty - y, tx - x);
  if (ev.kind === 'wolf') {
    sprPop(slashArc('#dff8ff'), tx, ty - 6, 0.45, 0.7, 0.16, ang + 0.6, 0);
    sprPop(slashArc('#dff8ff'), tx, ty + 6, 0.45, 0.7, 0.16, ang - 0.6, 0);
    burst(K_SPARK, tx, ty, 3, 200, 420, 0.12, 2.2, ['#ffffff', '#8fe8ff'], 0, 6);
  } else if (ev.kind === 'shadow') {
    for (const r2 of [-0.8, 0.8]) sprPop(slashArc('#c070ff'), tx, ty, 0.5, 0.85, 0.16, ang + r2, 0);
    burst(K_SMOKE, tx, ty, 2, 20, 70, 0.4, 22, 'rgba(70,20,100,0.5)', -20, 2);
  } else shot('sorcerer', x, y - 30, tx, ty, false, 1000);
}
// 부활 결계: 무너지던 성벽에 룬 방패가 되살아나며 폭발(금 → 청록), 1.5초 빙결
function reviveFx(ev) {
  REVIVE.t = 0; REVIVE.hero = !!ev.hero;
  const col = ev.hero ? '#ffe07a' : '#8ff4ff';
  stamp(ev.hero ? '성스러운 부활!' : '부활 결계!', ev.hero ? '#ffd23a' : '#8ff4ff', 420, 70, 1.5);
  for (let k = 0; k < 3; k++) ring(360, WALL_Y - 20, 30 + k * 30, 420 + k * 120, 0.6 + k * 0.15, k === 1 ? '#ffffff' : col, 12 - k * 3);
  for (let k = 0; k < 40; k++) part(K_STAR, 20 + rnd() * 680, WALL_Y - rnd() * 30, (rnd() - 0.5) * 60, -160 - rnd() * 260, 1.1, 14, rnd() < 0.5 ? '#ffffff' : col, 80, 1);
  flash(0.3, col);
  shake(0.4);
}
function drawRevive() {
  const t = REVIVE.t;
  if (t > 1.6) return;
  const a = t < 0.15 ? t / 0.15 : Math.max(0, 1 - (t - 0.15) / 1.45), col = REVIVE.hero ? '#ffd86a' : '#9ff4ff';
  additive(true);
  // 성벽을 따라 되살아나는 룬 방패: 룬 띠 두 줄이 가운데에서 양옆으로 펼쳐진다 + 벽 위 빛 커튼(알파 ≤ 0.2)
  const open = easeOut(Math.min(1, t / 0.35)), half = 400 * open;
  ctx.save(); ctx.beginPath(); ctx.rect(360 - half, WALL_Y - 260, half * 2, 320); ctx.clip();
  ctx.globalAlpha = a;
  ctx.drawImage(runeBand(col), -40 + (RT * 60) % 48, WALL_Y - 44, 820, 26);
  ctx.drawImage(runeBand(col), -(RT * 60) % 48, WALL_Y - 110, 820, 20);
  ctx.globalAlpha = a * 0.2;
  ctx.drawImage(beamSpr(col), -40, WALL_Y - 250, 800, 250);
  ctx.restore();
  ctx.globalAlpha = a * 0.6;
  spr(gl(col), 360, WALL_Y - 30, 900 * open, 90);
  groundRune(runeCircle(col), 360, WALL_Y - 12, 3.2 * open, RT * 0.6, a * 0.8);
  ctx.globalAlpha = 1;
  additive(false);
}

// 파편 · 마력 구슬 · 튕기는 방패 · 저격선 (drawFireballs 층에서 함께)
function drawProcs() {
  additive(true);
  for (const f of FRAGS) {
    if (!f.on) continue;
    const u = easeOut(f.t / f.dur), x = lerp(f.x0, f.x1, u), y = lerp(f.y0, f.y1, u) - Math.sin(u * Math.PI) * 24;
    ctx.globalAlpha = 1;
    spr(gl('#ff7a1e'), x, y, 30, 30);
    spr(hotCore('#ffd23a'), x, y, 12, 12);
  }
  for (const m of MOTES) {
    if (!m.on) continue;
    const u = m.t / m.dur, e = u * u * (3 - 2 * u), cx = (m.x0 + m.x1) / 2, cy = Math.min(m.y0, m.y1) - m.arc;
    for (let k = 3; k >= 0; k--) {
      const q = Math.max(0, e - k * 0.06), a = 1 - q;
      const x = a * a * m.x0 + 2 * a * q * cx + q * q * m.x1, y = a * a * m.y0 + 2 * a * q * cy + q * q * m.y1;
      ctx.globalAlpha = 1 - k * 0.22;
      spr(gl(k ? m.col : '#ffffff'), x, y, (30 - k * 5) * m.big, (30 - k * 5) * m.big);
    }
  }
  for (const L of LINES) {
    if (L.life <= 0) continue;
    const u = L.life / L.max, ang = Math.atan2(L.y1 - L.y0, L.x1 - L.x0), len = Math.hypot(L.x1 - L.x0, L.y1 - L.y0);
    place(L.x0, L.y0, ang, 1, 1);
    for (const [c, w, al] of [[L.halo, 22, 0.35], [L.halo, 9, 0.8], [L.col, 3.5, 1]]) {
      ctx.globalAlpha = u * al;
      ctx.fillStyle = c;
      ctx.fillRect(0, -w * u / 2, len, w * u);
    }
    wt();
  }
  ctx.globalAlpha = 1;
  additive(false);
  const sh = tossShield();
  for (const s of TOSS) {
    if (!s.on) continue;
    const n = s.pts.length - 1, k = Math.min(n - 1, Math.floor(s.t / s.seg)), u = clamp(s.t / s.seg - k, 0, 1);
    const [x0, y0] = s.pts[k], [x1, y1] = s.pts[k + 1], x = lerp(x0, x1, u), y = lerp(y0, y1, u) - Math.sin(u * Math.PI) * 18;
    additive(true); ctx.globalAlpha = 0.8; spr(gl('#ffd23a'), x, y, 64, 64); additive(false);
    ctx.globalAlpha = 1;
    place(x, y, RT * 22, 1, 1);
    ctx.drawImage(sh, -sh.hw, -sh.hh, sh.hw * 2, sh.hh * 2);
    wt();
  }
}
// 튕기는 방패(기사 수호 궁극 특성): 둥근 금테 방패 + 십자
function tossShield() {
  return bake('f:toss', 16, 16, x => {
    circ(x, 0, 0, 14); fs(x, rad(x, 0, 0, 1, 14, [[0, '#8fc0ff'], [0.7, '#3a6ee8'], [1, '#1a3a9a']], -4, -5), 2.6, INK2);
    circ(x, 0, 0, 11); x.lineWidth = 2.6; x.strokeStyle = '#ffd23a'; x.stroke();
    x.beginPath(); x.moveTo(0, -8); x.lineTo(0, 8); x.moveTo(-6, -2); x.lineTo(6, -2); x.lineWidth = 3; x.strokeStyle = '#ffffff'; x.stroke();
    shine(x, -5, -6, 3, 1.6, -0.6, 0.8);
  }, Math.min(S, 2));
}
function updateProcs(da) {
  for (const f of FRAGS) {
    if (!f.on || (f.t += da) < f.dur) continue;
    f.on = false;
    part(K_GLOW, f.x1, f.y1, 0, 0, 0.14, 40, '#ff8a1e');
    burst(K_SPARK, f.x1, f.y1, 3, 150, 380, 0.12, 2.2, ['#ffd23a', '#ffffff'], 0, 6);
  }
  for (const m of MOTES) {
    if (!m.on || (m.t += da) < m.dur) continue;
    m.on = false;
    ring(m.x1, m.y1, 4, 36 * m.big, 0.25, m.col, 4);
    part(K_GLOW, m.x1, m.y1, 0, 0, 0.18, 50 * m.big, m.col);
  }
  for (const L of LINES) if (L.life > 0) L.life -= da;
  for (const s of TOSS) {
    if (!s.on) continue;
    const k0 = Math.floor(s.t / s.seg);
    s.t += da;
    const k1 = Math.floor(s.t / s.seg);
    if (k1 > k0 && k1 < s.pts.length) { const [bx, by] = s.pts[k1]; burst(K_SPARK, bx, by, 5, 200, 480, 0.14, 2.6, ['#ffffff', '#ffe07a'], 0, 6); ring(bx, by, 4, 40, 0.2, '#ffe07a', 4); }
    if (s.t >= s.seg * (s.pts.length - 1)) s.on = false;
  }
  REVIVE.t += da;
}

// 처치: 번쩍 + 고리 + 색종이 + 점액 + 동전 (보스는 크게)
export function killFx(ev, full, mode) {
  const boss = ev.isBoss, col = GOO[ev.enemy] || '#ffffff';
  part(K_GLOW, ev.x, ev.y, 0, 0, 0.2, boss ? 220 : 64, '#ffffff');
  ring(ev.x, ev.y, 6, boss ? 190 : 50, boss ? 0.5 : 0.3, '#ffffff', boss ? 10 : 4);
  burst(K_CONF, ev.x, ev.y, boss ? 46 : full ? 9 : 3, 120, boss ? 560 : 340, 0.9, 6, CANDY, 700, 1.2, 140);
  burst(K_GOO, ev.x, ev.y, boss ? 14 : full ? 5 : 2, 80, 260, 0.6, 6, col, 900, 1, 120);
  coins(ev.x, ev.y, boss ? 20 : full ? 3 + ((rnd() * 4) | 0) : 2);
  if (boss) {
    burst(K_SPARK, ev.x, ev.y, 26, 500, 1100, 0.3, 4, ['#ffffff', '#ffe68a', col], 0, 5);
    burst(K_GLOW, ev.x, ev.y, 24, 100, 420, 0.7, 26, ['#ffb13a', '#ff5a3a', '#ffe68a'], 0, 3);
    ring(ev.x, ev.y, 20, 320, 0.7, col, 14);
    ring(ev.x, ev.y, 10, 240, 0.55, '#ffe68a', 6);
    const named = Object.hasOwn(BOSSES, ev.enemy);
    shake(named ? 0.95 : 0.5);
    flash(named ? 0.55 : 0.3);
    if (named) stamp('보스 격파!', '#ffd23a', 380, 76, 1.5);
  } else if (full) shake(0.02);
  if (mode !== 'off' && boss) num(ev.x, ev.y - 26, '+' + fmt(ev.gold), '#ffe24a', '#4a2a00', 1.4, false, 1.4); // 잡몹 골드는 동전이 말해 준다
}

function boom(view, ev) {
  const x = ev.x, y = ev.y, r = +ev.r || 60;
  switch (ev.kind) {
    case 'steam': steamFx(x, y, r, tier(skillLv(view, 'steamBurst'))); break; // 증기 폭발(융합)
    case 'fireball': { // 화염구 명중: 작은 폭발(반경 r) — 불꽃 링 + 불티 + 가끔 연기. 연사 중엔 예산 안에서만 크게
      const fy = warpY(x, y);
      if (fbBooms++ < 7) {
        part(K_GLOW, x, fy, 0, 0, 0.16, r * 1.6, '#ff6a1f'); // 작은 적이 빛 덩어리에 묻히지 않게 흰 심은 작게
        part(K_GLOW, x, fy, 0, 0, 0.06, r * 0.6, '#ffd23a');
        ring(x, fy, r * 0.3, r * 1.05, 0.22, '#ffb040', 5);
        burst(K_GLOW, x, fy, 4, 40, 170, 0.35, 12, ['#ffe45a', '#ff6a1f', '#ff4a1a'], -140, 3);
        if (rnd() < 0.3) part(K_SMOKE, x, fy - 6, (rnd() - 0.5) * 20, -40, 0.7, 26, 'rgba(70,40,30,0.4)', 0, 1);
      } else if (fbBooms < 24) part(K_GLOW, x, fy, 0, 0, 0.12, r * 1.6, '#ff7a1e');
      break;
    }
    case 'crit':
      ring(x, y, 6, r, 0.28, '#ffb040', 5);
      part(K_GLOW, x, y, 0, 0, 0.2, r * 1.6, '#ff9a30');
      burst(K_SPARK, x, y, 5, 300, 600, 0.14, 3, '#ffe08a', 0, 6);
      break;
    case 'bomber': {
      part(K_GLOW, x, y, 0, 0, 0.14, r * 1.5, '#ffffff');
      part(K_GLOW, x, y, 0, 0, 0.35, r * 2.8, '#ff9a2a');
      burst(K_GLOW, x, y, 14, 60, 320, 0.55, 26, ['#ffe45a', '#ff8a1e', '#ff4a1a'], -120, 3);
      burst(K_SMOKE, x, y, 6, 20, 90, 1.0, 50, 'rgba(60,40,36,0.55)', -80, 1);
      burst(K_DEBRIS, x, y, 6, 150, 380, 0.8, 6, ['#3a2a28', '#6a5552', '#ffb13a'], 900, 0.5, 150);
      ring(x, y, 10, r, 0.35, '#ffd080', 8);
      const d = take(DECALS);
      d.x = x; d.y = y; d.r = r * 0.8; d.life = d.max = 5;
      shake(y + r > WALL_Y ? 0.3 : 0.18);
      break;
    }
    case 'meteor': {
      const n = 9;
      for (let k = 0; k < n; k++) {
        const m = take(METEORS);
        const kv = meteorKills[k];
        const tx = kv ? kv.x : 60 + rnd() * 600, ty = kv ? kv.y : 200 + rnd() * 700;
        m.on = true; m.x1 = tx; m.y1 = ty; m.x0 = tx - 220 - rnd() * 120; m.y0 = ty - 900 - rnd() * 200;
        m.t = 0; m.delay = k * 0.045 + rnd() * 0.06; m.dur = 0.28; m.r = 110;
        m.kills = meteorKills.filter((_, i) => i % n === k);
      }
      meteorKills.length = 0; // 이중 운석의 두 번째는 빈 하늘에
      flash(0.6);
      flash(0.3, '#ff8a2a');
      shake(0.6);
      break;
    }
    case 'shock':
      ring(x, y, 10, r, 0.6, '#ffe8b0', 16);
      ring(x, y, 10, r * 0.8, 0.5, '#ff8a3a', 7);
      for (let k = 0; k < 10; k++) part(K_SMOKE, rnd() * WORLD_W, WALL_Y - 5, (rnd() - 0.5) * 80, -30 - rnd() * 40, 0.9, 40, 'rgba(180,150,120,0.5)', 0, 1);
      burst(K_DEBRIS, x, Math.min(y, WALL_Y), 8, 100, 360, 0.8, 7, ['#8a7a6a', '#5a4a3a'], 900, 0.5, 120);
      shake(0.38);
      break;
    case 'breath': {
      let y0 = 170;
      for (const e of view.enemies) if (e.type === 'doomDragon') { y0 = e.y + e.r * 0.9; break; }
      const b = take(BEAMS);
      b.x = x; b.y0 = y0; b.life = b.max = 0.5;
      for (let k = 0; k < 36; k++) {
        const py = y0 + rnd() * (WALL_Y - y0);
        part(K_GLOW, x + (rnd() - 0.5) * 100, py, (rnd() - 0.5) * 90, 200 + rnd() * 300, 0.5, 26 + rnd() * 20, ['#ffe45a', '#ff8a1e', '#ff3a1a'][k % 3], 0, 2);
      }
      part(K_GLOW, x, WALL_Y, 0, 0, 0.45, 300, '#ff7a1e');
      burst(K_SMOKE, x, WALL_Y, 8, 40, 140, 1.1, 60, 'rgba(50,30,30,0.55)', -60, 1);
      ring(x, WALL_Y, 20, r * 1.4, 0.5, '#ffb040', 12);
      shake(0.55);
      flash(0.3, '#ff5a1a');
      break;
    }
    default:
      ring(x, y, 6, r, 0.3, '#ffffff', 5);
  }
}

// 영웅·스킬 피해는 이제 sim이 직접 hit 이벤트를 쏘므로(§6, hero.js/spells.js) 여기선 더 이상 체력 감소로
// 추정하지 않는다(보스 티커 자체는 update()에서 관리). 데미지 숫자 끔 설정만 즉시 반영.
export function dmgScan(view, mode) {
  if (mode === 'off') { bossTicker = 0; bossShow = 0; }
}
function bez(fb, u) {
  const cx = (fb.x0 + fb.x1) / 2, cy = Math.min(fb.y0, fb.y1) - 170, a = 1 - u;
  return [a * a * fb.x0 + 2 * a * u * cx + u * u * fb.x1, a * a * fb.y0 + 2 * a * u * cy + u * u * fb.y1];
}

export function drawDecals() {
  const s = soft('rgba(20,8,4,0.55)');
  for (const d of DECALS) {
    if (d.life <= 0) continue;
    ctx.globalAlpha = Math.min(1, d.life / d.max * 2) * 0.7;
    spr(s, d.x, d.y, d.r * 2.4, d.r * 1.5);
  }
  ctx.globalAlpha = 1;
}

export function drawEshots(view) {
  const es = view.eshots;
  if (!es.length) return;
  const boneImg = bone();
  for (const q of es) {
    if (q.kind === 'bone') {
      place(q.x, q.y, T * 14, 1, 1);
      ctx.drawImage(boneImg, -13, -13, 26, 26);
    }
  }
  wt();
  ctx.globalCompositeOperation = 'lighter';
  const g = gl('#b86aff');
  for (const q of es) {
    if (q.kind === 'bone') continue;
    for (let k = 3; k >= 0; k--) {
      const s = 34 - k * 6;
      ctx.globalAlpha = 1 - k * 0.22;
      spr(g, q.x - q.vx * 0.02 * k, q.y - q.vy * 0.02 * k, s, s);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// ═════════════ 기본 주문 탄 (성벽 마법사) — DESIGN '성벽 마법사 주문 시전 구현 계약' ═════════════
// P1 화염구(fireball): 불꽃 혀가 뒤로 날리는 불덩이 + 불티 꼬리 → 명중 시 작은 폭발(boom kind 'fireball').
// P2 서리 화살(frostbolt): 각진 얼음 결정 + 서리 꼬리 + 떨어지는 결정 가루 → 관통, 맞은 적은 푸른 서리(slowT).
// 히든 조합(b.syn): 관통 = 길게 늘어난 화염 창/얼음 창 · 불꽃 산탄 = 더 크고 거센 불꽃 · 유도 = 휘어진 도깨비불 궤적.
// 탄이 많으면(다중 시전 × 최고 시전 속도) 고정 시드로 약 30발만 '주탄'(모양·꼬리)으로, 나머지는 작은 빛(성능 §12).
const MAIN_BOLTS = 30;
let BY_ = new Float32Array(256), BA_ = new Float32Array(256); // 탄별 그려질 y(보스 왜곡) · 알파(HUD·화면 끝 페이드)
// 불덩이 머리(+x 방향, 머리 중심 = 원점 +5). v = 불꽃 혀 모양 변형(깜빡임용 2장)
function fireHead(v) {
  return bake('f:fh|' + v, 36, 16, x => {
    const tongue = (s, col, rim) => {
      x.save(); x.translate(5, 0); x.scale(s, s);
      x.beginPath();
      x.moveTo(11, 0);
      x.bezierCurveTo(11, -9, 2, -12, -6, -10);
      x.quadraticCurveTo(-16, -9, v ? -36 : -32, v ? -9 : -6);
      x.quadraticCurveTo(-20, -3, v ? -28 : -33, 2);
      x.quadraticCurveTo(-18, 4, v ? -30 : -25, 11);
      x.quadraticCurveTo(-10, 12, -4, 10);
      x.bezierCurveTo(4, 11, 11, 8, 11, 0);
      x.closePath();
      x.fillStyle = col; x.fill();
      if (rim) { x.lineWidth = 1.6 / s; x.strokeStyle = rim; x.stroke(); }
      x.restore();
    };
    tongue(1, '#e0400f', 'rgba(110,16,4,0.9)');
    tongue(0.8, '#ff8a1e');
    tongue(0.58, '#ffd23a');
    circ(x, 8, 0, 6.2); x.fillStyle = '#fff4c0'; x.fill();
    circ(x, 8.5, -0.5, 3.6); x.fillStyle = '#ffffff'; x.fill();
  }, Math.min(S, 2));
}
// 얼음 결정 화살(+x 방향). 외곽선 = 짙은 청색(밝은 풀밭에서도 읽히게)
function frostShard() {
  return bake('f:frs', 20, 9, x => {
    for (const sd of [-1, 1]) { poly(x, [-4, sd * 3, -13, sd * 8.5, -9, sd * 2]); fs(x, '#d8f8ff', 1.3, '#1e4a8a'); }
    poly(x, [19, 0, 7, -6, -12, -4, -18, 0, -12, 4, 7, 6]);
    fs(x, lin(x, 0, -6, 0, 6, [[0, '#ffffff'], [0.45, '#bff4ff'], [0.5, '#7fe3ff'], [1, '#3aa8e8']]), 2, '#1e4a8a');
    x.strokeStyle = 'rgba(255,255,255,0.9)'; x.lineWidth = 1.1;
    x.beginPath(); x.moveTo(17, 0); x.lineTo(-14, 0); x.moveTo(7, -5); x.lineTo(2, 0); x.lineTo(7, 5); x.stroke();
  }, Math.min(S, 2));
}
// 유도탄 궤적: 탄마다 최근 위치 8개(링 버퍼) → 휘어진 도깨비불 꼬리
const HIST = new WeakMap();
function histOf(b, y) {
  let h = HIST.get(b);
  if (!h) HIST.set(b, h = { p: new Float32Array(16), n: 0, i: 0, f: -1 });
  if (h.f !== frameNo) { h.f = frameNo; h.p[h.i * 2] = b.x; h.p[h.i * 2 + 1] = y; h.i = (h.i + 1) % 8; h.n = Math.min(8, h.n + 1); }
  return h;
}
const isFrost = b => b.kind === 'frostbolt' || (b.kind !== 'fireball' && b.owner === 1);
export function drawBullets(view) {
  const bs = view.bullets;
  if (!bs.length) return;
  const n = bs.length, twin = view.duo && view.duo.includes('twin'), frz = view.frenzyT > 0; // 광란: 불꽃이 더 거세게
  const keep = n <= MAIN_BOLTS ? 2 : MAIN_BOLTS / n, dense = n > MAIN_BOLTS;
  // 기본 주문은 약한 견제지만 초반(탄이 적을 때)엔 마법으로 또렷이 보이게 크게, 탄이 많아지면 스킬보다 작게
  const sp = Math.min(0.3, 24 / n), tk = (n <= 16 ? 1.3 : n <= 40 ? 1.05 : 0.8) * (twin ? 1.12 : 1) * (dense ? 1.1 : 1);
  const top = hudY(96);
  const SK = skinFx(); // v0.1.2 외형 스킨: 내 탄(owner 0)은 스킨 색·머리·꼬리 입자
  if (BY_.length < n) { BY_ = new Float32Array(n * 2); BA_ = new Float32Array(n * 2); }
  for (let i = 0; i < n; i++) {
    const b = bs[i], y = warpY(b.x, b.y);
    BY_[i] = y;
    BA_[i] = clamp((y - top) / 110, 0, 1) * clamp(Math.min(b.x, WORLD_W - b.x) / 50, 0, 1);
  }
  const isMain = (b, seed) => seed < (b.owner === 1 ? keep * 0.6 : keep);
  additive(true);
  // 1) 빛 층(가산): 보조탄 = 작은 빛 + 코어 · 주탄 = 헤일로 + 꼬리(유도 = 휘어진 궤적)
  for (let i = 0; i < n; i++) {
    const b = bs[i], fade = BA_[i];
    if (fade <= 0) continue;
    const seed = seedOf(b), frost = isFrost(b), by = BY_[i];
    if (!isMain(b, seed)) { // 보조탄: 옅은 빛만(몸은 아래 몸 층에서 작게)
      ctx.globalAlpha = 0.4 * fade;
      spr(gl(SK && b.owner !== 1 ? SK.main : frost ? '#7fe3ff' : '#ff7a1e'), b.x, by, 22, 22);
      continue;
    }
    const own = b.owner === 1 ? 0.88 : 1, jr = (0.92 + 0.16 * seed) * own * tk, spd = Math.hypot(b.vx, b.vy) || 1;
    const syn = b.syn, flame = syn === 'flame' || (!frost && frz), pierce = syn === 'pierce', homing = syn === 'homing';
    const sk = SK && b.owner !== 1, main = sk ? SK.main : frost ? '#7fe3ff' : flame ? '#ff4a1a' : '#ff7a1e', core = sk ? SK.core : frost ? '#e8fbff' : '#ffd23a';
    const puls = 1 + 0.07 * Math.sin(RT * (18 + seed * 8) + seed * 20), hs = 44 * jr * puls * (flame ? 1.2 : 1);
    ctx.globalAlpha = 0.55 * fade;
    spr(gl(main), b.x, by, hs, hs);
    if (homing) { // 휘어진 궤적: 지난 위치를 따라 작아지는 도깨비불
      const h = histOf(b, by), wc = frost ? '#b89aff' : '#ff8ad8', g = gl(wc);
      let px = b.x, py = by;
      for (let k = 1; k < h.n; k++) { // 지난 위치를 잇는 가늘어지는 리본(구간마다 늘인 빛)
        const j = (h.i - 1 - k + 16) % 8, qx = h.p[j * 2], qy = h.p[j * 2 + 1], u = 1 - k / 8, L = Math.hypot(px - qx, py - qy);
        if (L > 0.5) {
          ctx.globalAlpha = fade * u * 0.85;
          place((px + qx) / 2, (py + qy) / 2, Math.atan2(py - qy, px - qx), (L + 14) / 32, (18 * u + 4) * jr / 32);
          ctx.drawImage(g, -16, -16, 32, 32);
        }
        px = qx; py = qy;
      }
      wt();
    } else {
      const len = clamp(spd / 1600, 0.6, 1) * (pierce ? 1.9 : flame ? 1.25 : 1) * jr;
      ctx.globalAlpha = 0.9 * fade;
      place(b.x, by, Math.atan2(b.vy, b.vx), len * 0.8, jr * (frost ? 0.75 : 0.95));
      const tr = missileTrail(main, core);
      ctx.drawImage(tr, -tr.hw, -tr.hh, tr.hw * 2, tr.hh * 2);
      wt();
    }
    // 꼬리 입자: 불티(위로 솟음) / 결정 가루(떨어짐)
    if (rnd() < sp * (flame ? 0.6 : 0.3)) { // 꼬리 바로 뒤에서 짧게(전장에 점이 흩뿌려지지 않게)
      if (sk) SK.trail(b.x, by, b.vx, b.vy);
      else if (frost) part(K_SHARD, b.x - b.vx * 0.015, by - b.vy * 0.015, (rnd() - 0.5) * 40, (rnd() - 0.5) * 40, 0.25, 3.5, rnd() < 0.5 ? '#ffffff' : '#bff4ff', 200, 4);
      else part(K_GLOW, b.x - b.vx * 0.018 + (rnd() - 0.5) * 6, by - b.vy * 0.018 + (rnd() - 0.5) * 6, (rnd() - 0.5) * 30, -30 - rnd() * 40, 0.26, flame ? 12 : 9, rnd() < 0.5 ? '#ff9a2a' : '#ff5a1a', -40, 4);
    }
  }
  additive(false);
  // 2) 몸 층(일반 합성): 불덩이 / 얼음 결정 — 가산만으로는 밝은 바닥에서 흰 덩어리로 날아가므로 테가 있는 실체를 올린다
  const fh0 = fireHead(0), fh1 = fireHead(1), fr = frostShard();
  for (let i = 0; i < n; i++) {
    const b = bs[i], seed = seedOf(b), fade = BA_[i];
    if (fade <= 0) continue;
    const main = isMain(b, seed); // 보조탄은 같은 모양을 60% 크기·반투명으로(점 벽지 대신 작은 불덩이·결정 떼)
    const frost = isFrost(b), syn = b.syn, pierce = syn === 'pierce', flame = syn === 'flame' || (!frost && frz);
    const jr = (0.92 + 0.16 * seed) * (b.owner === 1 ? 0.88 : 1) * tk * (main ? 1 : 0.62), a = Math.atan2(b.vy, b.vx);
    ctx.globalAlpha = fade * (main ? 1 : 0.8);
    if (SK && b.owner !== 1) { // v0.1.2 스킨 탄 머리(화염구와 같은 크기·흔들림)
      const img = SK.head(((RT * 18 + seed * 7) | 0) & 1), s = 0.72 * jr * (flame ? 1.2 : 1);
      place(b.x, BY_[i], a, s * (pierce ? 1.6 : 1) * (1 + 0.06 * Math.sin(RT * 30 + seed * 9)), s * (pierce ? 0.8 : 1));
      ctx.drawImage(img, -img.hw - 5, -img.hh, img.hw * 2, img.hh * 2);
    } else if (frost) {
      place(b.x, BY_[i], a, jr * (pierce ? 1.45 : 0.95), jr * 0.95);
      ctx.drawImage(fr, -fr.hw - 4, -fr.hh, fr.hw * 2, fr.hh * 2);
    } else {
      const img = ((RT * 18 + seed * 7) | 0) & 1 ? fh1 : fh0, s = 0.72 * jr * (flame ? 1.2 : 1);
      place(b.x, BY_[i], a, s * (pierce ? 1.6 : 1) * (1 + 0.06 * Math.sin(RT * 30 + seed * 9)), s * (pierce ? 0.8 : 1));
      ctx.drawImage(img, -img.hw - 5, -img.hh, img.hw * 2, img.hh * 2);
    }
  }
  wt();
  ctx.globalAlpha = 1;
  // 3) 반짝: 서리 화살 주위를 도는 눈꽃 (탄이 적을 때만)
  if (n < 90) {
    const sk = sparkle('#e8fbff');
    additive(true);
    for (let i = 0; i < n; i++) {
      const b = bs[i], seed = seedOf(b);
      if (!isFrost(b) || !isMain(b, seed) || BA_[i] <= 0 || (SK && b.owner !== 1)) continue;
      const ph = RT * (TAU / 0.35) + seed * TAU, tw = 0.5 + 0.5 * Math.sin(RT * 20 + seed * 12);
      ctx.globalAlpha = BA_[i];
      spr(sk, b.x + Math.cos(ph) * 11, BY_[i] + Math.sin(ph) * 7, 11 * tw, 11 * tw);
    }
    additive(false);
    ctx.globalAlpha = 1;
  }
}

export function drawBeams() {
  ctx.globalCompositeOperation = 'lighter';
  for (const b of BEAMS) {
    if (b.life <= 0) continue;
    const a = b.life / b.max;
    ctx.globalAlpha = a;
    ctx.drawImage(gl('#ff7a1e'), b.x - 110, b.y0 - 40, 220, WALL_Y - b.y0 + 80);
    ctx.drawImage(gl('#fff0a0'), b.x - 40, b.y0, 80, WALL_Y - b.y0);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

// 가산 빛 밀도 감쇠: 스킬이 겹치는 붐비는 층에서 빛 스프라이트·빛 입자·광선이 전부 더해져 화면 가운데가 하얗게 타고
// 적·보스·영웅이 사라지던 문제 → 한꺼번에 떠 있는 가산 빛이 많을수록 각각을 옅게(적을 땐 그대로). 매 프레임 drawSprs가 센다
let glowK = 1;
const NORMS = [false, true];
export function drawSprs() {
  let live = 0;
  for (const s of SPRS) if (s.life > 0) live++;
  for (const b of LBEAMS) if (b.life > 0) live += 6;
  glowK = clamp(1.2 - live / 70, 0.45, 1);
  for (const norm of NORMS) { // 빛(가산) 먼저, 그 위에 형태(일반 합성)
    additive(!norm);
    for (const s of SPRS) {
      if (s.life <= 0 || s.norm !== norm) continue;
      const u = 1 - s.life / s.max, k = s.s0 + (s.s1 - s.s0) * easeOut(u);
      ctx.globalAlpha = Math.min(1, (1 - u) * 1.8) * (norm ? 1 : glowK);
      place(s.x, s.y, s.ang, k * s.sq, k);
      ctx.rotate(s.vs + s.spin * u);
      ctx.drawImage(s.img, -s.img.hw, -s.img.hh, s.img.hw * 2, s.img.hh * 2);
    }
  }
  wt();
  ctx.globalAlpha = 1;
  additive(false);
}

// 성벽 쪽 바닥: 서리 결계
export function drawFrostWard(view) {
  const fw = view.spellFx && view.spellFx.frostWard;
  if (!fw) return;
  const band = frostBand(fw.r);
  ctx.globalAlpha = 0.92;
  ctx.drawImage(band, 360 - band.hw, WALL_Y - band.hh - band.oy, band.hw * 2, band.hh * 2);
  additive(true);
  ctx.globalAlpha = 0.22 + 0.08 * Math.sin(RT * 2);
  spr(gl('#7fe3ff'), 360, WALL_Y - fw.r + 6, 820, 34);
  ctx.globalAlpha = 0.3;
  spr(gl('#bff4ff'), 360, WALL_Y - 20, 860, 60);
  additive(false);
  ctx.globalAlpha = 1;
}

// 심판 광선 예고 (다음 광선이 떨어질 가장 앞선 적)
export function drawTelegraph(view) {
  const sp = view.spells, st = view.spellT;
  if (!sp || !sp.judgment || !st || !(st.judgment < 0.75) || view.phase !== 'play' || view.pick) return;
  let f = null;
  for (const e of view.enemies) if (!e.dead && e.y + e.r > 0 && (!f || e.y > f.y)) f = e;
  if (!f) return;
  const p = clamp(1 - st.judgment / 0.75, 0, 1), L = SPELL_BY_KEY.judgment.lv[clamp(sp.judgment, 1, 3) - 1];
  const twi = (view.fusions || []).includes('twilight'), col = twi ? '#c880ff' : '#ffe07a', w = L.w * (1.5 - 0.5 * p);
  additive(true);
  ctx.globalAlpha = 0.1 + 0.22 * p;
  spr(gl(col), f.x, (f.y + 120) / 2, w * 1.6, f.y + 200);
  groundRune(runeCircle(col), f.x, f.y + f.r * 0.6, (L.w / 30) * (1.4 - 0.4 * p), RT * 4, 0.4 + 0.5 * p);
  additive(false);
  ctx.globalAlpha = 0.35 + 0.55 * p;
  ctx.setLineDash([10, 8]); ctx.lineDashOffset = RT * 60;
  ctx.lineWidth = 2.5; ctx.strokeStyle = col;
  ctx.beginPath(); ctx.moveTo(f.x - w / 2, 110); ctx.lineTo(f.x - w / 2, f.y + f.r); ctx.moveTo(f.x + w / 2, 110); ctx.lineTo(f.x + w / 2, f.y + f.r); ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

export function drawHeroShots() {
  for (const s of HSHOTS) {
    if (!s.on || s.delay > 0) continue;
    const u = s.t / s.dur, x = lerp(s.x0, s.x1, u), y = lerp(s.y0, s.y1, u) - Math.sin(u * Math.PI) * (s.cls === 'ranger' ? 14 : 6);
    const a = Math.atan2(s.y1 - s.y0, s.x1 - s.x0);
    additive(true);
    place(x, y, a, s.cls === 'ranger' ? 1.3 : 1.1, s.cls === 'ranger' ? 0.7 : 1.3);
    ctx.drawImage(comet(s.cls === 'ranger' ? '#b8ffb0' : '#c08aff'), -66, -10, 72, 20);
    wt();
    if (s.cls === 'sorcerer') {
      spr(gl('#c08aff'), x, y, 34, 34);
      additive(false);
      spr(magicCore('#f0e0ff', '#c08aff', '#5a1fa8'), x, y, 13, 13);
    } else {
      additive(false);
      place(x, y, a, 1.1, 1.1);
      ctx.drawImage(arrowSpr(), -18, -5, 36, 10);
      wt();
    }
  }
  // 화살비
  const img = arrowSpr('#ffe45a');
  for (const a of ARROWS) {
    if (!a.on || a.delay > 0) continue;
    const u = a.t / 0.2, x = a.x - 70 * (1 - u), y = a.y - 320 * (1 - u);
    additive(true);
    place(x, y, Math.atan2(320, 70), 1.4, 0.8);
    ctx.drawImage(comet('#d8ffb0'), -66, -10, 72, 20);
    additive(false);
    place(x, y, Math.atan2(320, 70), 1.1, 1.1);
    ctx.drawImage(img, -18, -5, 36, 10);
  }
  wt();
}

// ── 스킬: 회오리 · 망령 · 얼음 창 · 드래곤 · 파이어볼 · 영혼 ──
const TN_GRAD = new Map();
export function drawTornadoes(view) {
  drawStorms(view);
  const fx = view.spellFx;
  if (!fx || !fx.tornadoes.length) return;
  const fus = view.fusions || [];
  const blaze = fus.includes('blazeTornado'), storm = fus.includes('stormEye');
  for (const tn of fx.tornadoes) {
    const hot = tn.fire || blaze, t = tier(skillLv(view, hot ? 'blazeTornado' : 'tornado'));
    const C = hot ? ['#ffe45a', '#ff8a2a', '#ff4a1a'] : ['#d8fff0', '#8ff0d0', '#3fd8a8'];
    // Lv6 완전체: 깔때기가 하늘까지 닿고 꼭대기에 폭풍 구름 모자
    const r = tn.r, base = tn.y + r * 0.5, hgt = t.max ? base + topExtra + 20 : r * (1.9 + 0.6 * t.s), top = base - hgt, streaks = 4 + Math.round(7 * t.f);
    const a = Math.min(1, tn.t * 3) * clamp((6 - tn.t) / 0.5, 0, 1) * clamp((tn.y + 40) / 80, 0, 1);
    ctx.globalAlpha = 0.55 * a;
    spr(soft(hot ? 'rgba(90,40,20,0.6)' : 'rgba(190,220,200,0.55)'), tn.x, base, r * 2.4, r * 0.7);
    if (storm) { ctx.globalAlpha = 0.6 * a; spr(soft('rgba(60,50,110,0.7)'), tn.x, top, r * 3.2, r * 1.1); }
    // 깔때기 몸통 (반투명, 휘청임)
    const sw = Math.sin(T * 3) * r * 0.18;
    if (t.max) { ctx.globalAlpha = 0.6 * a; spr(soft(hot ? 'rgba(110,40,20,0.75)' : 'rgba(60,90,100,0.7)'), tn.x + sw, top + 20, r * 4, r * 1.2); }
    ctx.globalAlpha = 0.42 * a;
    ctx.translate(tn.x, 0); // 회오리 x 기준으로 그려 그라데이션을 (색·반경)마다 한 번만 만든다(발열 2차)
    ctx.beginPath();
    ctx.moveTo(-r * 0.22, base);
    ctx.bezierCurveTo(-r * 0.4 + sw * 0.3, base - hgt * 0.45, -r * 1.05 + sw, top + hgt * 0.2, -r * 1.2 + sw, top);
    ctx.lineTo(r * 1.2 + sw, top);
    ctx.bezierCurveTo(r * 1.05 + sw, top + hgt * 0.2, r * 0.4 + sw * 0.3, base - hgt * 0.45, r * 0.22, base);
    ctx.closePath();
    const gk = (hot ? 'h' : 'c') + Math.round(r);
    let fg = TN_GRAD.get(gk);
    if (!fg) {
      fg = ctx.createLinearGradient(-r, 0, r, 0);
      fg.addColorStop(0, hot ? 'rgba(255,90,30,0.15)' : 'rgba(120,220,190,0.12)'); // 몸통은 채도 있는 반투명(흰 기둥 금지)
      fg.addColorStop(0.35, hot ? 'rgba(255,150,60,0.6)' : 'rgba(170,245,215,0.5)');
      fg.addColorStop(1, hot ? 'rgba(200,50,20,0.25)' : 'rgba(60,170,140,0.2)');
      if (TN_GRAD.size > 32) TN_GRAD.clear();
      TN_GRAD.set(gk, fg);
    }
    ctx.fillStyle = fg;
    ctx.fill();
    wt();
    additive(true);
    ctx.globalAlpha = 0.3 * a;
    spr(hu(storm ? '#7b5cff' : C[2]), tn.x, (top + base) / 2, r * 1.9, hgt * 1.1);
    for (let k = 0; k < streaks; k++) { // 회전하는 바람 줄기 (레벨만큼 늘어난다, Lv1 = 한 색)
      const u = k / (streaks - 1), ry = base - u * hgt, rx = r * (0.22 + 0.98 * Math.min(1, u * (t.max ? 1.6 : 1)));
      const off = sw * u, ph0 = T * 9 * (1 + u) + k * 2.3;
      ctx.globalAlpha = (0.3 + 0.4 * u) * a;
      ctx.lineWidth = 2 + u * 2.5;
      ctx.strokeStyle = t.two ? C[k % 3] : C[1];
      ctx.beginPath(); ctx.ellipse(tn.x + off, ry, rx, rx * 0.26, 0, ph0, ph0 + 1.6 + (k % 3) * 0.7); ctx.stroke();
    }
    additive(false);
    // 휘말린 잎·돌 (불꽃 회오리는 불씨)
    if (t.sec) { additive(true); groundRune(runeCircle(C[1]), tn.x, base, r / 30, T * 3, 0.5 * a); additive(false); } // 보조: 발밑 룬
    for (let j = 0; j < cnt(8, t); j++) {
      const uj = (j * 0.37 + T * 0.45) % 1, rx = r * (0.22 + 0.95 * uj), ang = T * 7 + j * 2.1;
      const px = tn.x + Math.cos(ang) * rx, py = base - uj * hgt + Math.sin(ang) * rx * 0.28;
      ctx.globalAlpha = a;
      if (blaze) { additive(true); spr(gl(j % 2 ? '#ffe45a' : '#ff6a1f'), px, py, 14, 14); additive(false); }
      else {
        ctx.fillStyle = j % 3 ? '#6aa84a' : '#c8b48a';
        ctx.save(); ctx.translate(px, py); ctx.rotate(ang * 2);
        ctx.fillRect(-4, -2, 8, 4);
        ctx.restore();
      }
    }
  }
  ctx.globalAlpha = 1;
}

export function drawLances(view) {
  const ls = view.spellFx && view.spellFx.lances;
  if (!ls || !ls.length) return;
  const t = tier(skillLv(view, 'iceLance')), k = 0.8 + 0.35 * t.s; // Lv1 가는 창 → Lv6 빙하 창
  for (const l of ls) {
    const a = Math.atan2(l.vy, l.vx), sp = iceSpear();
    if (t.sec) { // 보조: 뒤따르는 얼음 잔상 셋
      ctx.globalAlpha = 0.35;
      for (let j = 1; j <= 3; j++) { place(l.x - l.vx * 0.022 * j, l.y - l.vy * 0.022 * j, a, k * (1 - j * 0.15), k * (1 - j * 0.15)); ctx.drawImage(sp, -38, -11, 76, 22); ctx.globalAlpha *= 0.6; }
      wt();
    }
    additive(true);
    place(l.x, l.y, a, 2.4 * k, 1.5 * k);
    ctx.drawImage(comet(t.two ? '#7fe3ff' : '#bff4ff'), -66, -10, 72, 20);
    wt();
    ctx.globalAlpha = 0.6;
    spr(gl('#7fe3ff'), l.x, l.y, 56 * k, 56 * k);
    if (t.max) { ctx.globalAlpha = 0.5; place(l.x, l.y, T * 6, 1, 1); ctx.drawImage(sparkle('#e8fbff'), -26, -26, 52, 52); wt(); }
    ctx.globalAlpha = 1;
    additive(false);
    place(l.x, l.y, a, 1.25 * k, 1.25 * k);
    ctx.drawImage(sp, -38, -11, 76, 22);
    wt();
  }
}

export function drawFireballs() {
  drawProcs();
  for (const fb of FIREBALLS) {
    if (!fb.on) continue;
    const u = fb.t / fb.dur;
    const C = fb.plasma ? ['#ffe0ff', '#e07aff', '#7b5cff'] : ['#fff2a0', '#ff8a1e', '#ff3a1a'], fs2 = tier(fb.lv || 3).s;
    additive(true);
    for (let k = fb.lv >= 2 ? 8 : 4; k >= 0; k--) { // Lv1 = 짧은 꼬리
      const p = bez(fb, Math.max(0, u - k * 0.04));
      ctx.globalAlpha = 1 - k / 9;
      const s = (96 - k * 8) * fs2;
      spr(gl(k < 2 ? C[0] : k < 5 ? C[1] : C[2]), p[0], p[1], s, s);
    }
    const p = bez(fb, u), q = bez(fb, Math.max(0, u - 0.08));
    ctx.globalAlpha = 1;
    place(p[0], p[1], Math.atan2(p[1] - q[1], p[0] - q[0]), 1.5, 1.9);
    ctx.drawImage(comet(C[1]), -66, -10, 72, 20);
    place(p[0], p[1], RT * 9, 1, 1);
    ctx.drawImage(starFlash(C[1]), -30, -30, 60, 60);
    wt();
    additive(false);
    spr(magicCore(C[0], C[1], fb.plasma ? '#5a1fa8' : '#8a1a08'), p[0], p[1], 30, 30);
  }
  ctx.globalAlpha = 1;
}
let atX = 0, atY = 0; // soulAt 결과(프레임마다 배열을 만들지 않게)
function soulAt(s, e) { const a = 1 - e; atX = a * a * s.x0 + 2 * a * e * s.cx + e * e * GOLD_POS.x; atY = a * a * s.y0 + 2 * a * e * s.cy + e * e * GOLD_POS.y; }
export function drawSouls() {
  // 영혼 수확: 청록·연보라 꼬리(광량 예산 제외) + 작은 유령 머리(일반 합성 — 어느 바닥에서도 형태로 읽힘)
  let any = false;
  setLightPrio(LIGHT_EXEMPT);
  additive(true);
  for (const s of SOULS) {
    if (!s.on) continue;
    any = true;
    const u = s.t / s.dur, e = u * u * (3 - 2 * u);
    for (let k = 4; k >= 0; k--) {
      soulAt(s, Math.max(0, e - k * 0.045));
      ctx.globalAlpha = 0.95 - k * 0.17;
      spr(hu(k % 2 ? '#b48aff' : '#6ff6ff'), atX, atY, 64 - k * 7, 64 - k * 7);
    }
  }
  for (const w of WISPS) {
    if (w.life <= 0) continue;
    any = true;
    const u = w.life / w.max;
    ctx.globalAlpha = 0.6 * u; spr(hu('#6ff6ff'), w.x, w.y - (1 - u) * 60, 60 * w.s, 60 * w.s);
  }
  additive(false);
  setLightPrio(false);
  if (any) {
    const gh = ghostSpr('#e0d0ff');
    for (const s of SOULS) {
      if (!s.on) continue;
      const u = s.t / s.dur, e = u * u * (3 - 2 * u), sc = 0.8 + 0.3 * Math.sin(Math.min(1, u * 2) * Math.PI / 2);
      soulAt(s, Math.max(0, e - 0.03)); const px = atX;
      soulAt(s, e); const x = atX, y = atY;
      ctx.globalAlpha = Math.min(1, (1 - u) * 5);
      place(x, y, 0, (x < px ? -1 : 1) * sc, sc);
      ctx.drawImage(gh, -gh.hw, -gh.hh, gh.hw * 2, gh.hh * 2);
    }
    for (const w of WISPS) { // 흩어지는 망령: 솟으며 커지고 옅어진다
      if (w.life <= 0) continue;
      const u = w.life / w.max, sc = w.s * (1 + 0.35 * (1 - u));
      ctx.globalAlpha = u * 0.85;
      place(w.x, w.y - (1 - u) * 60, Math.sin(u * 9) * 0.15, w.face * sc, sc * (1 + 0.2 * (1 - u)));
      ctx.drawImage(gh, -gh.hw, -gh.hh, gh.hw * 2, gh.hh * 2);
    }
    wt();
  }
  additive(true);
  if (PICKORB.on) { // 고른 카드의 원소 광구 → 내 마법사
    const u = easeOut(PICKORB.t / 0.5), M = MF[0], a = 1 - u;
    const x = a * a * 360 + 2 * a * u * 360 + u * u * M.ox, y = a * a * 560 + 2 * a * u * 700 + u * u * M.oy;
    ctx.globalAlpha = 1;
    spr(gl(PICKORB.col), x, y, 70, 70);
    spr(gl('#ffffff'), x, y, 26, 26);
    if (rnd() < 0.8) part(K_STAR, x, y, (rnd() - 0.5) * 60, (rnd() - 0.5) * 60, 0.4, 12, PICKORB.col, 0, 2);
  }
  ctx.globalAlpha = 1;
  additive(false);
}
// 심판 광선 · 성직자 타격 · 부활/레벨업 빛기둥
export function drawLBeams() {
  drawRevive();
  additive(true);
  let nb = 0;
  for (const b of LBEAMS) if (b.life > 0) nb++;
  const bk = nb > 2 ? Math.max(0.5, 2 / nb) : 1; // 전신 광선이 여러 줄 겹치면 줄마다 옅게
  for (const b of LBEAMS) {
    if (b.life <= 0) continue;
    const u = b.life / b.max, hgt = b.y1 - b.y0, w = b.w * (0.55 + 0.6 * u);
    // 굵은 기둥도 흰 심은 가늘게(≤ 20) — 폭은 원소색 헤일로가 맡는다(E 백색 과부하)
    ctx.globalAlpha = Math.min(1, u * 1.5) * 0.55 * bk;
    spr(hu(b.halo), b.x, b.y0 + hgt / 2, w * 2.2, hgt + 60);
    ctx.globalAlpha = Math.min(1, u * 2) * (w > 60 ? 0.6 : 0.9) * bk;
    ctx.drawImage(beamSpr(b.halo), b.x - w * 0.55, b.y0, w * 1.1, hgt);
    ctx.globalAlpha = Math.min(1, u * 2) * 0.7 * bk;
    spr(gl(b.core), b.x, b.y0 + hgt / 2, Math.min(20, w * 0.45), hgt);
    ctx.globalAlpha = u * 0.55 * bk;
    spr(hu(b.halo), b.x, b.y1 - 6, w * 2.6, w * 0.8);
  }
  ctx.globalAlpha = 1;
  additive(false);
}

// LEVEL UP! (영웅 위 슬램)
export function numText(str, x, y, size, top, bot, ink) {
  ctx.font = `${size}px ${NUM_FONT}`;
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.22;
  ctx.strokeStyle = ink; ctx.fillStyle = ink;
  ctx.fillText(str, x, y + size * 0.08); ctx.strokeText(str, x, y + size * 0.08); ctx.strokeText(str, x, y);
  const g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2);
  g.addColorStop(0, top); g.addColorStop(0.5, top); g.addColorStop(0.52, bot); g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillText(str, x, y);
}

export function drawParticles() {
  // 일반 합성: 색종이, 파편, 연기, 점액
  const smokeCache = {};
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (p.life <= 0 || p.k < K_CONF) continue;
    const a = Math.min(1, p.life / p.max * 2);
    ctx.globalAlpha = a;
    switch (p.k) {
      case K_CONF: {
        const w = p.size * Math.abs(Math.cos(p.rot)), h = p.size * 0.6;
        ctx.fillStyle = p.col;
        ctx.fillRect(p.x - w / 2, p.y - h / 2, w, h);
        break;
      }
      case K_SHARD: {
        const c = Math.cos(p.rot) * p.size, s = Math.sin(p.rot) * p.size;
        ctx.beginPath();
        ctx.moveTo(p.x + c, p.y + s); ctx.lineTo(p.x - s * 0.4, p.y + c * 0.4); ctx.lineTo(p.x - c * 0.6, p.y - s * 0.6);
        ctx.closePath();
        ctx.fillStyle = p.col; ctx.fill();
        break;
      }
      case K_SMOKE: {
        const sm = smokeCache[p.col] || (smokeCache[p.col] = soft(p.col));
        const s = p.size * (1.6 - p.life / p.max * 0.6);
        ctx.globalAlpha = a * 0.8;
        spr(sm, p.x, p.y, s, s);
        break;
      }
      case K_GOO: {
        const s = p.size * (0.5 + 0.5 * p.life / p.max);
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, TAU); ctx.fill();
        break;
      }
      case K_DEBRIS: {
        ctx.fillStyle = p.col;
        const s = p.size;
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s * 0.8);
        break;
      }
    }
  }
  // 가산 합성: 빛, 불꽃, 별
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (p.life <= 0 || p.k >= K_CONF) continue;
    const u = p.life / p.max;
    if (p.k === K_GLOW) { // 큰 빛일수록 옅게(화면이 우윳빛으로 덮이지 않게 — 반경 220 넘으면 비례 감쇠) · 붐비면 glowK
      const ga = Math.min(1, u * 1.6) * (p.size > 220 ? Math.max(0.3, 220 / p.size) : 1) * glowK, s = p.size * (0.4 + 0.6 * u);
      if (ga < 0.04 || s * K < 2) continue; // 안 보이는 빛(거의 투명 · 2 화면 px 미만)은 그리기 호출을 아낀다(발열 2차)
      ctx.globalAlpha = ga;
      if (s > 80) { if (p.col === '#ffffff') ctx.globalAlpha *= Math.min(1, 120 / s); spr(p.col === '#ffffff' ? gl(p.col) : hu(p.col), p.x, p.y, s, s); } // 큰 빛은 흰 심 없이 색으로만(흰 섬광은 클수록 옅게)
      else spr(gl(p.col), p.x, p.y, s, s);
    } else if (p.k === K_SPARK) {
      ctx.globalAlpha = Math.min(1, u * 2);
      ctx.strokeStyle = p.col;
      ctx.lineWidth = p.size * u + 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
      ctx.stroke();
    } else {
      const s = p.size * (0.3 + 0.9 * Math.sin(u * Math.PI));
      if (s * K < 2) continue;
      ctx.globalAlpha = Math.min(1, u * 2);
      spr(sparkle(p.col), p.x, p.y, s, s);
    }
  }
  // 고리
  for (const r of RINGS) { // 충격파: 가는 선 대신 구운 빛 고리(가산) — 두께는 w 로 살짝 조절
    if (r.life <= 0) continue;
    const u = 1 - r.life / r.max, e = 1 - (1 - u) * (1 - u);
    const R = r.r0 + (r.r1 - r.r0) * e, k = 1 + Math.min(0.35, r.w * 0.02) * (1 - u);
    ctx.globalAlpha = (1 - u) * 0.95 * clamp(1 - (r.r1 - 110) / 320, 0.3, 1); // 큰 고리일수록 옅게(화면·영웅을 우윳빛 원판으로 덮지 않게)
    if (R * k > 120) { // 큰 충격파: 구운 띠(반경의 30% 두께)는 원판처럼 보이므로 가는 선 고리 두 겹으로
      ctx.strokeStyle = r.col; ctx.lineWidth = Math.max(3, r.w * 1.2) * (1 - u * 0.5);
      ctx.beginPath(); ctx.arc(r.x, r.y, R * k, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth *= 0.35;
      ctx.stroke();
      continue;
    }
    const img = ringSpr(r.col);
    ctx.drawImage(img, r.x - R * k, r.y - R * k, R * 2 * k, R * 2 * k);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

const BOLT_W = [9, 3.4, 1.1], BOLT_A = [0.28, 0.8, 0.7];
export function drawBolts() {
  let any = false;
  for (const b of BOLTS) if (b.life > 0) { any = true; break; }
  if (!any) return;
  ctx.globalCompositeOperation = 'lighter';
  for (const b of BOLTS) {
    if (b.life <= 0) continue;
    const a = (b.life / b.max) ** 1.6; // 번쩍 → 빨리 사라짐(짧고 선명하게)
    ctx.beginPath();
    const pts = b.pts, jr = mulberry(b.sd + frameNo * 7919); // 지그재그는 번개마다 자기 시드(프레임마다 떨림) — 다른 번개 수와 무관
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      const seg = 6;
      for (let s = 1; s < seg; s++) {
        const u = s / seg, j = (jr() - 0.5) * Math.min(28, len * 0.25);
        ctx.lineTo(x0 + dx * u + nx * j, y0 + dy * u + ny * j);
      }
      ctx.lineTo(x1, y1);
    }
    for (let li = 0; li < 3; li++) { // 헤일로 · 원소색 · 가는 흰 심(얇게 — 흰 번개 기둥 금지)
      const w = BOLT_W[li];
      ctx.globalAlpha = a * BOLT_A[li];
      ctx.strokeStyle = li === 0 ? b.halo : li === 1 ? b.col : '#ffffff';
      ctx.lineWidth = w * b.w;
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

export function drawMeteors() {
  for (const m of METEORS) {
    if (!m.on || m.delay > 0) continue;
    const u = m.t / m.dur, x = m.x0 + (m.x1 - m.x0) * u, y = m.y0 + (m.y1 - m.y0) * u;
    const dx = (m.x1 - m.x0), dy = (m.y1 - m.y0), d = Math.hypot(dx, dy);
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 7; k >= 0; k--) {
      const b = k * 22;
      ctx.globalAlpha = 1 - k / 8;
      const s = 64 - k * 5;
      spr(gl(k < 2 ? '#fff0a0' : k < 5 ? '#ff8a1e' : '#ff3a1a'), x - dx / d * b, y - dy / d * b, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU);
    ctx.fillStyle = '#3a2420'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffb040'; ctx.stroke();
  }
}

export function drawNums() {
  const R = Math.max(0.5, scale * 1.3); // 구운 글자 해상도(팝 1.25배에도 선명하게). 히트스톱 줌(K)은 빼고 — 줌마다 아틀라스를 새로 굽지 않게
  for (const n of NUMS) {
    if (!n.on) continue;
    const t = n.t;
    // 팝 인 90ms(0.3→1.25→1, back) · 합쳐질 때 1.15 톡 · 마지막 0.2초 페이드
    let k = t < 0.09 ? 0.3 + 0.95 * easeOut(t / 0.09) : t < 0.2 ? 1.25 - 0.25 * easeOut((t - 0.09) / 0.11) : 1;
    k *= 1 + n.punch * 0.15;
    const a = t > n.life - 0.2 ? Math.max(0, (n.life - t) / 0.2) : 1;
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    const wobble = n.crit && t < 0.15 ? Math.sin(t * 90) * 3 * (1 - t / 0.15) : 0; // 치명 좌우 흔들림 1회(§6)
    ctx.setTransform(K * k, 0, 0, K * k, BX + K * (n.x + wobble), BY + K * n.y);
    drawNumGlyphs(n, R);
  }
  ctx.globalAlpha = 1;
  wt(); // 공용 규약: draw*는 wt()로 끝난다
  // 보스 누적 피해 티커(§6): 보스 얼굴 대신 옆 어깨 높이에 굴러가는 합계 하나. 1.1초 동안 안 맞으면 페이드 → 다음 연타는 0부터
  if (bossPresent && bossE && bossShow > 0.5 && bossTickT < 1.4) {
    const vr = visR(bossE), side = bossE.x < 360 ? 1 : -1, by = bossE.y + bossDY(bossE);
    const x = clamp(bossE.x + side * (vr * 0.9 + 70), 110, 610), y = Math.max(numTop() + 40, by - vr * 0.45);
    const a = bossTickT > 1.1 ? Math.max(0, 1 - (bossTickT - 1.1) / 0.3) : 1;
    const sz = 30 + Math.min(14, Math.log10(Math.max(10, bossShow)) * 1.6), k = 1 + bossPunch * 0.14;
    ctx.globalAlpha = a;
    place(x, y, side * -0.05, k, k);
    numText(fmt(bossShow), 0, 0, sz, '#fff6c8', '#ff9a1a', '#4a1400');
    wt();
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
  }
}

// 화면 전체 틴트 (흔들림 없이)
export function drawOverlays(view) {
  ht();
  const pulse = 0.5 + 0.5 * Math.sin(RT * 9);
  if (pickA > 0) { // 카드 선택 중: 전장을 살짝 어둡게 + 마력 빛 (DOM 카드가 위에 뜬다)
    ctx.globalAlpha = pickA * 0.66; // 카드 뒤 전장(보스 몸통)이 비쳐 산만하지 않게 충분히 어둡게
    ctx.fillStyle = '#0e0a22';
    fillView();
    ctx.globalAlpha = pickA * 0.7;
    drawView(vignette('rgba(120,50,200,0.8)', 0.55));
    additive(true);
    ctx.globalAlpha = pickA * (0.14 + 0.04 * Math.sin(RT * 2));
    placeH(360, 560, 1);
    ctx.rotate(RT * 0.25);
    const rc = runeCircle('#c890ff');
    ctx.drawImage(rc, -260, -260, 520, 520);
    ht();
    additive(false);
  }
  if (view.freezeT > 0) {
    const a = Math.min(1, view.freezeT / 0.4);
    ctx.globalAlpha = a * 0.06;
    ctx.fillStyle = '#9fe0ff';
    fillView();
    ctx.globalAlpha = a * 0.65; // 서리 테두리만 — 전장이 하얗게 날아가지 않게
    drawView(frost());
  }
  if (view.frenzyT > 0) { // 광란: 가장자리 붉은 비네트 + 양옆 속도선(가산) — 전장 가운데는 깨끗하게
    const fa = Math.min(1, view.frenzyT / 0.5);
    additive(true); // 마법사 불꽃 오라(지팡이 끝 + 발밑)
    for (const M of MF) {
      if (M !== MF[0] && !mageOn(view, 1)) continue;
      ctx.globalAlpha = fa * (0.45 + 0.2 * Math.sin(RT * 14 + M.ox));
      spr(gl('#ff5a1a'), M.ox, M.oy, 80, 80);
      if (rnd() < 0.5) part(K_GLOW, M.ox + (rnd() - 0.5) * 50, MAGE_FEET - rnd() * 80, (rnd() - 0.5) * 30, -140 - rnd() * 100, 0.5, 12, rnd() < 0.5 ? '#ffb030' : '#ff5a1a', 0, 1);
    }
    additive(false);
    ctx.globalAlpha = fa * (0.62 + 0.2 * pulse);
    drawView(vignette('rgba(255,30,20,0.8)', 0.6));
    additive(true);
    const span = WORLD_H + topExtra;
    for (let k = 0; k < 12; k++) {
      const side = k % 2, u = ((RT * (1.6 + (k % 3) * 0.4) + k * 0.37) % 1);
      const x = side ? WORLD_W + sideX - 14 - (k * 13) % 60 : 14 - sideX + (k * 17) % 60, y = -topExtra + span * (1 - u);
      ctx.globalAlpha = fa * 0.5 * Math.sin(u * Math.PI);
      spr(gl(k % 3 ? '#ff5a2a' : '#ffd23a'), x, y, 10, 150);
    }
    additive(false);
  }
  if (view.legendT > 0) {
    ctx.globalAlpha = Math.min(1, view.legendT / 0.5) * (0.45 + 0.2 * Math.sin(RT * 5));
    drawView(vignette('rgba(255,200,40,0.8)', 0.62));
    // 금빛 테두리 (밝은 배경에서도 보이게)
    ctx.globalAlpha = Math.min(1, view.legendT / 0.5) * (0.6 + 0.4 * Math.sin(RT * 6));
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffd23a';
    ctx.strokeRect(5 - sideX, 5 - topExtra, WORLD_W + sideX * 2 - 10, WORLD_H + topExtra - 10);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff6c0';
    ctx.strokeRect(5 - sideX, 5 - topExtra, WORLD_W + sideX * 2 - 10, WORLD_H + topExtra - 10);
  }
  const ratio = view.wall && view.wall.max > 0 ? view.wall.hp / view.wall.max : 1;
  if (ratio < 0.3 && view.phase === 'play') {
    ctx.globalAlpha = (0.3 - ratio) / 0.3 * (0.4 + 0.4 * pulse);
    drawView(vignette('rgba(200,0,20,0.8)', 0.6));
  }
  if (view.berserk > 1 && view.phase === 'play') { // 광폭화: 가장자리 붉은 맥박(느리게, 가운데는 깨끗하게). 광란 비네트와 겹치면 약하게
    const bp = 0.5 + 0.5 * Math.sin(RT * 4.5);
    ctx.globalAlpha = Math.min(1, (RT - berserkRT) / 0.6 + 0.3) * (0.28 + 0.22 * bp) * (view.frenzyT > 0 ? 0.35 : 1);
    drawView(vignette('rgba(190,0,20,0.85)', 0.62));
  }
  if (defeatA > 0) { // 패배: 전장 채도를 빼고(회색 톤) 붉은 비네트 — 패배 모달 뒤가 "무너진 순간"처럼
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = defeatA * 0.75;
    ctx.fillStyle = '#808080';
    fillView();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = defeatA * 0.35;
    ctx.fillStyle = '#2a0008';
    fillView();
    ctx.globalAlpha = defeatA * 0.8;
    drawView(vignette('rgba(200,0,20,0.85)', 0.5));
  }
  ctx.globalAlpha = 1;
}

// ═════════════ 이벤트 → 연출 (render.js 가 매 프레임 한 번 호출) ═════════════
export function events(view, evs, opts) {
  const mode = opts.dmgNumbers || 'full';
  lastMode = mode;
  const me = opts.myIndex | 0;
  let hits = 0, kills = 0, shatters = 0, shields = 0, bigs = 0, crits = 0;
  numCap = mode === 'simple' ? 4 : 6; // 동시 표시 상한(§6) — 넘치면 가장 약하고 오래된 숫자부터 비킨다
  numBudget = mode === 'simple' ? 2 : 3; // 새 숫자: 프레임당 생성 상한(합쳐지는 건 제외)
  partLeft = Math.round(PART_FRAME * fxQ);
  bossBand = !!view.boss;
  meteorKills.length = 0;
  let meteorFrame = false;
  const fus = view.fusions || [];
  let runes = 0, souls = 0, strikes = 0;
  const soulOn = !!(view.spells && view.spells.soulHarvest);
  fbFrame.length = 0;
  for (const ev of evs) {
    if (ev.type === 'boom' && ev.kind === 'meteor') meteorFrame = true;
    // 파이어볼: 처치 이벤트보다 늦게 오므로 먼저 띄워 두고, 반경 안 처치 연출은 착탄 때 터뜨린다
    else if (ev.type === 'spell' && (ev.key === 'fireball' || ev.key === 'plasma')) {
      const fb = take(FIREBALLS), M = MF[ev.o === 1 ? 1 : 0];
      fb.on = true; fb.t = 0; fb.x0 = M.ox; fb.y0 = M.oy; fb.x1 = +ev.x || 360; fb.y1 = +ev.y || 400; fb.r = +ev.r || 100;
      fb.dur = clamp(Math.hypot(fb.x1 - fb.x0, fb.y1 - fb.y0) / 2600, 0.16, 0.3);
      fb.plasma = ev.key === 'plasma' || fus.includes('plasma'); fb.kills.length = 0; fb.lv = skillLv(view, ev.key, ev);
      fbFrame.push(fb);
    }
  }
  fbBooms = 0; frags = 0;
  for (let i = 0; i < evs.length; i++) {
    const ev = evs[i];
    SKM = skinMap(ev); // v0.1.2 외형 스킨(내 것만)
    switch (ev.type) {
      case 'hit': {
        if (ev.o === 2 || ev.o === 3) { // 영웅·스킬 피해(§6): 시각은 heroAttack/spellFx가 맡고 여기선 숫자·보스 티커만
          const e2 = nearest(view, ev.x, ev.y, 40), boss2 = !!(e2 && e2.isBoss), d2 = +ev.dmg || 0;
          if (boss2) bossTicker += d2;
          if (mode !== 'off' && !boss2 && (mode === 'full' || ev.crit)) {
            const hero = ev.o === 2, el = EL[ev.kind];
            const col = hero ? '#ff6fd8' : el ? el[1] : '#c89aff', ink = hero ? HERO_NUM[1] : el ? dim(el[2], 0.35) : '#3a1a5a';
            const y2 = e2 ? e2.y + bossDY(e2) - visR(e2) * 0.85 : ev.y - 20;
            const dg = !hero && numStyle(ev.em); // 던전: 약점 = 라임 · 내성 = 흐린 회색(dungeonfx.js)
            dmgNum(ev.x, y2, d2, ev.o, ev.crit ? 'C' : 'N', dg ? dg[0] : col, dg ? dg[1] : ink, 1, !!ev.crit, ev.crit ? 0.75 : 0.45, '', e2, dg ? dg[2] : hero ? '#ffe8fb' : '#ffffff');
          }
          break;
        }
        const o = ev.o === 1 ? 1 : 0, full = hits++ < (view.speed >= 3 ? 6 : 12); // 프레임당 풀 연출 12개까지(3배속은 6 — 파티클 예산 §12)
        const st = mstyle(ev.kind, o), kc = st[1], frostK = st === MSTY.p1;
        // 맞은 적의 성벽 쪽 표면에 튀김 (보스 얼굴을 가리지 않게)
        const e = nearest(view, ev.x, ev.y, 40), er = e ? e.r : 0;
        const ha = Math.PI * (0.2 + rnd() * 0.6);
        const hx = ev.x + Math.cos(ha) * er * 0.75, hy = warpY(ev.x, ev.y) + Math.sin(ha) * er * 0.75;
        const hs = e ? clamp(visR(e) / 36, 0.45, 1.2) : 0.8; // 타격 빛은 맞은 적 크기에 맞춘다(잡몹이 빛 덩어리에 묻히지 않게)
        if (full) {
          if (frostK) { // 서리 화살: 얼음 결정이 부서지며 눈꽃 + 결정 파편(관통하며 박힐 때마다)
            if (runes++ < 8) sprPop(sparkle('#e8fbff'), hx, hy, 0.4, 1.3 * hs, 0.2, rnd() * TAU, 3);
            part(K_GLOW, hx, hy, 0, 0, 0.12, 40 * hs, '#7fe3ff');
            burst(K_SHARD, hx, hy, ev.big ? 6 : 4, 120, 320, 0.45, 5, ['#ffffff', '#bff4ff', '#7fe3ff'], 500, 2, 60);
          } else { // 화염구: 폭발은 boom(kind 'fireball')이 그리고, 여기선 불티만
            part(K_GLOW, hx, hy, 0, 0, 0.1, 34 * hs, '#ffb040');
            burst(K_SPARK, hx, hy, ev.crit ? 5 : 3, 250, 520, 0.14, 2.6, ['#ffd23a', '#ffffff'], 0, 6);
          }
        } else if (hits < 40) part(K_GLOW, ev.x, warpY(ev.x, ev.y), 0, 0, 0.12, 30 * hs, kc);
        if (ev.crit && full && crits++ < 2) { // 별빛 폭발 (프레임당 2개까지 — 연타에 적이 흰 덩어리로 묻히지 않게)
          sprPop(starFlash(kc), hx, hy, 0.3, (ev.big ? 1.35 : 0.95) * Math.max(0.6, hs), 0.2, 0, 0.6);
          burst(K_STAR, hx, hy, 3, 80, 220, 0.4, 14, ['#ffffff', st[0]], 0, 3);
          shake(0.012);
        }
        if (ev.big && full && bigs++ < 3) {
          const v = e && visOf(e), bossHit = !!(e && e.isBoss);
          // 보스는 연타 중 형체가 안 보이지 않게 0.3초에 한 번만 크게
          if (!bossHit || v.chroma < -0.2) {
            part(K_GLOW, hx, hy, 0, 0, 0.1, bossHit ? 70 : 80 * hs, kc); // 흰 원판 대신 원소색 빛(떼가 흰 덩어리로 뭉개지지 않게)
            for (let k = 0; k < 7; k++) {
              const a = k * TAU / 7 + rnd() * 0.5;
              part(K_SPARK, hx, hy, Math.cos(a) * 760, Math.sin(a) * 760, 0.15, 3.5, k % 2 ? kc : '#ffffff', 0, 7);
            }
            if (bossHit) { v.chroma = 0.12; shake(0.06); if (ev.crit) flash(0.08, kc); }
          }
          if (v) {
            if (!bossHit) v.punch = 1;
            else if (v.punch < 0.05) v.punch = 0.7;
          }
        }
        const boss = !!(e && e.isBoss);
        if (mode !== 'off') {
          const d = +ev.dmg || 0;
          if (boss) bossTicker += d;
          if (mode === 'full' || ev.crit) {
            const ny = e ? e.y + bossDY(e) - visR(e) * 0.85 : ev.y - 8;
            // 치명 = 주황 금(큰 치명은 흰→주황, 더 크게) · 일반 = 소유자 색(나 금빛 흰색 / AI 청록). 빨강은 받은 피해 전용
            // 한 등급 = 한 모양(§6): 일반 흰색 · 치명 주황 '!' · 큰 치명 붉은 주황 '!' · AI 동료 청록 · 영웅 분홍 · 스킬 원소색. 보스는 티커 하나로만
            if (boss) { /* 보스 누적 티커가 말해 준다 */ }
            else if (ev.crit) dmgNum(ev.x, ny, d, o, ev.big ? 'B' : 'C', ev.big ? '#ff6a1a' : '#ffa21a', '#4a1400', 1, true, ev.big ? 0.85 : 0.75, '', e, ev.big ? '#fff3c0' : '#fff3a8');
            else dmgNum(ev.x, ny, d, o, 'N', o === me ? '#e6ecff' : '#9fe8ff', o === me ? '#241a3e' : OWN[o].ink, 1, false, 0.45, '', e, '#ffffff');
          }
        }
        break;
      }
      case 'kill': {
        if (soulOn && souls++ < 5) soul(ev.x, ev.y);
        else if (!soulOn && souls < 4 && ghostNear(view, ev.x, ev.y)) { souls++; soulPop(ev.x, ev.y); wisp(ev.x, ev.y - 10, 1.1, rnd() < 0.5 ? -1 : 1); } // 망령이 거둔 처치
        // 운석·파이어볼로 죽은 적은 떨어질 때 터뜨림
        if (meteorFrame && !ev.isBoss) { meteorKills.push(ev); break; }
        const fb = !ev.isBoss && fbFrame.length ? fbFrame.find(f => (f.x1 - ev.x) ** 2 + (f.y1 - ev.y) ** 2 <= (f.r + 40) ** 2) : null;
        if (fb) fb.kills.push(ev);
        else killFx(ev, kills++ < 12, mode);
        break;
      }
      case 'boom': boom(view, ev); break;
      case 'shards': shardsFx(ev); break;
      case 'cast': if (!ev.basic) castLaunch(ev); break;
      case 'collab': case 'collabProc': case 'linkFinish': case 'fusionMerge': collabFx(view, ev); break;
      case 'heroProc': heroProcFx(view, ev); break;
      case 'summonAttack': summonAtkFx(ev); break;
      case 'summonSpawn': // 소환진 확산 → 소환물이 오버슈트로 착지(units)
        sprPop(runeCircle(SUMMON_COL[ev.kind] || '#ff6fd2'), ev.x, ev.y + 16, 0.4, 1.5, 0.6, Math.PI / 2, 2, 0.38);
        ring(ev.x, ev.y, 6, 60, 0.35, SUMMON_COL[ev.kind] || '#ff6fd2', 5);
        burst(K_STAR, ev.x, ev.y - 10, 8, 60, 200, 0.5, 12, ['#ffffff', SUMMON_COL[ev.kind] || '#ff6fd2'], 0, 2);
        break;
      case 'summonDespawn':
        burst(K_SMOKE, ev.x, ev.y - 6, 5, 20, 90, 0.6, 30, ev.kind === 'shadow' ? 'rgba(60,20,90,0.5)' : 'rgba(200,220,255,0.45)', -30, 2);
        break;
      case 'heroRetreat': // 후퇴: 땀방울 + 먼지(units가 절뚝이는 자세)
        burst(K_SMOKE, ev.x, ev.y + 12, 3, 20, 70, 0.5, 22, 'rgba(210,200,170,0.5)', -10, 2);
        break;
      case 'heroAdvance': // 재진격: 기합 링 + 불꽃
        ring(ev.x, ev.y - 30, 10, 70, 0.3, '#ffe07a', 5);
        burst(K_STAR, ev.x, ev.y - 40, 6, 80, 220, 0.4, 12, ['#ffffff', '#ffe07a'], 0, 2);
        break;
      case 'talent': { // 도전 중 특성 습득: 영웅 발밑 룬 + 별
        const h = view.heroUnit;
        if (h) { sprPop(runeCircle('#ffd23a'), h.x, h.y + 14, 0.5, 1.4, 0.5, Math.PI / 2, 2, 0.38); burst(K_STAR, h.x, h.y - 40, 10, 60, 200, 0.6, 14, ['#ffffff', '#ffe07a'], -60, 2); }
        break;
      }
      case 'revive': reviveFx(ev); break;
      case 'berserk':
        stamp('광폭화!', '#ff3a3a', 360, 84, 1.4);
        flash(0.3, '#ff1a1a');
        shake(0.35);
        berserkRT = RT;
        break;
      case 'runOver':
        if (ev.victory) { for (let k = 0; k < 120; k++) part(K_CONF, rnd() * WORLD_W, -20 - rnd() * 300, (rnd() - 0.5) * 140, 120 + rnd() * 220, 3.6, 9, CANDY[(rnd() * CANDY.length) | 0], 60, 0.4); flash(0.2, '#ffe07a'); }
        break;
      case 'spell': spellFx(view, ev, strikes++); break;
      case 'spellPick': {
        PICKORB.on = true; PICKORB.t = 0; PICKORB.col = skillCols(ev.spell)[0];
        // 만렙 도달: MAX! 각성(한 번). 같은 순간 융합으로 사라진 재료면 생략 — 합체 컷인이 주인공
        if (ev.spell && (ev.level | 0) >= SPELL_MAX_LV && view.spells?.[ev.spell]) maxFx(ev.spell);
        break;
      }
      case 'pickOffer':
        manaSparkle();
        ring(360, 560, 20, 420, 0.6, '#d8b0ff', 8);
        break;
      case 'heroAttack': heroAttackFx(view, ev); break;
      case 'heroUlt': heroUltFx(view, ev); break;
      case 'heroBlink': // 암살자 그림자 순간이동: 출발·도착 연기 + 도착 불꽃
        burst(K_SMOKE, ev.x0, ev.y0, 6, 30, 140, 0.5, 34, 'rgba(70,30,110,0.55)', -20, 2);
        burst(K_SMOKE, ev.x, ev.y, 5, 30, 120, 0.4, 28, 'rgba(70,30,110,0.5)', -20, 2);
        burst(K_SPARK, ev.x, ev.y, 6, 200, 480, 0.16, 2.4, ['#ff9ab0', '#ffffff'], 0, 6);
        ring(ev.x, ev.y, 6, 50, 0.25, '#c88aff', 4);
        break;
      case 'skill': {
        const o = ev.o === 1 ? 1 : 0, c = { x: MF[o].ox, y: MF[o].oy };
        MF[o].cast = 1;
        if (ev.skill === 'freeze') {
          stamp('빙결!', '#aef0ff', 320, 72);
          flash(0.35, '#c8f4ff');
          for (let k = 0; k < 40; k++) part(K_SHARD, rnd() * WORLD_W, rnd() * WALL_Y, (rnd() - 0.5) * 120, -40 - rnd() * 80, 0.9, 7, rnd() < 0.5 ? '#ffffff' : '#9fe8ff', 120, 1);
          ring(c.x, c.y, 10, 900, 0.7, '#bff4ff', 16);
        } else {
          stamp('운석 낙하!', '#ffb040', 320, 68);
        }
        break;
      }
      case 'shield':
        if (shields++ < 30) { ring(ev.x, ev.y, 8, 40, 0.4, '#8ff4ff', 4); part(K_STAR, ev.x, ev.y - 10, 0, -40, 0.4, 18, '#bff8ff'); }
        break;
      case 'clear':
        for (let k = 0; k < 90; k++) part(K_CONF, rnd() * WORLD_W, -20 - rnd() * 200, (rnd() - 0.5) * 120, 120 + rnd() * 200, 3.2, 8, CANDY[(rnd() * CANDY.length) | 0], 60, 0.4);
        flash(0.25);
        break;
      case 'defeat':
        flash(0.5, '#ff1a1a');
        shake(0.85);
        for (let k = 0; k < 40; k++) part(K_DEBRIS, rnd() * WORLD_W, WALL_Y + rnd() * 30, (rnd() - 0.5) * 300, -150 - rnd() * 400, 1.4, 9, ['#a8a08e', '#6a6254', '#d8d2c4'][k % 3], 900, 0.3);
        for (let k = 0; k < 12; k++) part(K_SMOKE, rnd() * WORLD_W, WALL_Y, (rnd() - 0.5) * 60, -40, 1.6, 80, 'rgba(120,110,100,0.6)', 0, 0.5);
        break;
      case 'wall': // 받은 피해: 빨강 '−', 성벽 체력판 위에 한 숫자로 굴린다
        if (mode === 'full' && ev.dmg > 0) dmgNum(596, 1044, +ev.dmg, 4, 'H', '#ff4d5e', '#4a0610', 1, false, 0.9, '', 'wall', '#ffe0e0');
        break;
      case 'heroHit':
        if (mode === 'full' && ev.dmg > 0) dmgNum(ev.x, ev.y - 158, +ev.dmg, 4, 'H', '#ff4d5e', '#4a0610', 1, false, 0.8, '', 'hero', '#ffe0e0');
        break;
      case 'warn': shake(0.08); break;
      case 'enrage':
        ring(ev.x, ev.y, 20, 360, 0.7, '#ff3030', 16);
        burst(K_GLOW, ev.x, ev.y, 20, 100, 400, 0.6, 24, ['#ff3030', '#ff8a30'], 0, 2);
        stamp('격노!', '#ff4a3a', 330, 80);
        shake(0.5);
        flash(0.35, '#ff2020');
        break;
      case 'frenzy':
        stamp('광란!', '#ff4a3a', 380, 116, 1.4);
        flash(0.28, '#ff2a1a');
        shake(0.25);
        break;
      case 'chain': {
        if (!Array.isArray(ev.pts) || ev.pts.length < 2) break;
        const plasma = ev.o === 0 && fus.includes('plasma');
        const col = plasma ? '#ffb0ff' : ev.o === 1 ? '#8ff8ff' : '#ffe53a';
        // 연쇄 번개는 적 사이 짧은 줄기라 화면을 덮지 않는다 — 굵기·수명은 원래 수준(알아볼 수 있게), 흰 심만 얇게
        bolt(ev.pts, 0.22, col, plasma ? '#c040ff' : ev.o === 1 ? '#2a78e0' : '#7b5cff', 1.1 + 0.1 * skillLv(view, 'chainLightning'), 'ch');
        for (const pt of ev.pts) part(K_GLOW, pt[0], pt[1], 0, 0, 0.2, 46, col);
        break;
      }
      case 'shatter':
        if (shatters++ < 40) {
          burst(K_SHARD, ev.x, ev.y, 6, 120, 420, 0.7, 9, ['#ffffff', '#bff4ff', '#6fd0ff'], 700, 1, 80);
          part(K_GLOW, ev.x, ev.y, 0, 0, 0.25, 70, '#9fe8ff');
        }
        break;
      case 'goldRain':
        coins(ev.x, 200, 60, true);
        num(ev.x, ev.y - 30, '+' + fmt(ev.amount), '#ffe24a', '#4a2a00', 2.0, true, 1.8);
        stamp('골드 비!', '#ffd23a', 330, 70);
        shake(0.3);
        break;
      case 'hitstop': {
        const ms = +ev.ms || 0;
        flash(ms >= 300 ? 0.5 : ms >= 120 ? 0.32 : 0.1);
        punchZoom(Math.min(1, ms / 350));
        break;
      }
    }
  }
  SKM = null;
}

// ═════════════ 갱신 (render.js 가 매 프레임 호출) ═════════════
// da = 애니메이션 dt(히트스톱 중 0), dt = 실제 dt
export function update(view, da, dt) {
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (p.life <= 0) continue;
    p.life -= da;
    p.vy += p.g * da;
    if (p.drag) { const f = Math.max(0, 1 - p.drag * da); p.vx *= f; p.vy *= f; }
    p.x += p.vx * da;
    p.y += p.vy * da;
    p.rot += p.vr * da;
  }
  for (const r of RINGS) if (r.life > 0) r.life -= da;
  for (const b of BOLTS) if (b.life > 0) b.life -= da;
  for (const w of WISPS) if (w.life > 0) w.life -= da;
  for (const d of DECALS) if (d.life > 0) d.life -= da;
  for (const b of BEAMS) if (b.life > 0) b.life -= da;
  numRef = Math.max(1, numRef * (1 - 0.35 * dt)); // 상대 크기 기준은 천천히 식는다
  const nTop = numTop();
  for (const z of ZONES.values()) z.t -= dt;
  for (const n of NUMS) {
    if (!n.on) continue;
    n.t += dt; n.mt += dt; n.age += dt; // 숫자는 실시간(히트스톱 중에도 읽히게 떠오름 유지)
    n.punch = Math.max(0, n.punch - dt * 8);
    const ceil = nTop + numH(n) / 2;
    n.y += n.vy * dt * (n.t < 0.12 ? 0.2 : 1); // 팝 동안은 거의 제자리 → 이후 위로 흐름
    if (n.y < ceil) { n.y = ceil; n.life = Math.min(n.life, n.t + 0.2); } // 천장에 닿으면 멈춰 사라짐(한 줄로 눌려 겹치지 않게)
    n.vy *= Math.max(0, 1 - 1.6 * dt);
    if (n.cls !== 'H' && n.t > 0.1 && inZone(n.x, n.y, n.w, numH(n))) n.life = Math.min(n.life, n.t + 0.12); // 헤드라인이 뜨면 비킨다
    if (n.t >= n.life) n.on = false;
  }
  // 떠오르다 겹치면: 위쪽 숫자를 위로 민다. 천장이라 못 밀면 더 오래된 쪽을 빨리 지운다(옆으로 밀어 겹치지 않게)
  for (let i = 0; i < NUMS.length; i++) {
    const a = NUMS[i];
    if (!a.on) continue;
    for (let j = i + 1; j < NUMS.length; j++) {
      const b = NUMS[j];
      if (!b.on) continue;
      const ox2 = (a.w + b.w) / 2 - Math.abs(a.x - b.x), oy2 = (numH(a) + numH(b)) / 2 - Math.abs(a.y - b.y);
      if (ox2 <= 0 || oy2 <= 0) continue;
      const [up] = a.y < b.y || (a.y === b.y && a.t < b.t) ? [a, b] : [b, a];
      if (up.y - oy2 >= nTop + numH(up) / 2) up.y -= oy2;
      else { const old = a.t > b.t ? a : b; old.life = Math.min(old.life, old.t + 0.1); }
    }
  }
  for (const m of METEORS) {
    if (!m.on) continue;
    if (m.delay > 0) { m.delay -= da; continue; }
    m.t += da;
    if (m.t >= m.dur) {
      m.on = false;
      const mr = m.r / 110; // 영웅 작은 운석은 반경에 맞춰 작게
      part(K_GLOW, m.x1, m.y1, 0, 0, 0.3, 200 * mr, '#ff9a2a');
      part(K_GLOW, m.x1, m.y1, 0, 0, 0.12, 90 * mr, '#ffffff');
      burst(K_GLOW, m.x1, m.y1, mr < 1 ? 5 : 8, 80, 300 * mr, 0.5, 26, ['#ffe45a', '#ff8a1e', '#ff4a1a'], -100, 3);
      burst(K_DEBRIS, m.x1, m.y1, mr < 1 ? 3 : 5, 150, 400, 0.8, 7, ['#3a2a28', '#6a5552'], 900, 0.5, 150);
      ring(m.x1, m.y1, 10, m.r, 0.4, '#ffd080', 9);
      if (m.kills) { m.kills.forEach((kv, i) => killFx(kv, i < 3, lastMode)); m.kills = null; }
      const d = take(DECALS);
      d.x = m.x1; d.y = m.y1; d.r = 60 * mr; d.life = d.max = mr < 1 ? 3 : 6;
      shake(0.1 * mr);
    }
  }
  defeatA = view.phase === 'defeat' ? Math.min(1, defeatA + dt * 2) : Math.max(0, defeatA - dt * 3);
  updateMagic(view, da, dt);
  // 보스 누적 피해 티커(§6): 0.5초마다 갱신, 보스가 없으면 리셋
  bossPresent = false;
  for (const e of view.enemies) if (e.isBoss && !e.dead) { bossPresent = true; break; }
  bossE = null;
  for (const e of view.enemies) if (e.isBoss && !e.dead && (!bossE || e.r > bossE.r)) bossE = e;
  bossTickT += dt; bossPunch = Math.max(0, bossPunch - dt * 6);
  if (bossTicker > 0) { if (bossTickT > 1.4) bossShow = 0; bossShow += bossTicker; bossTicker = 0; bossTickT = 0; bossPunch = 1; }
  if (!bossPresent) { bossShow = 0; bossTickT = 9; }
  else if (bossE && bossE.named) { // 보스 얼굴 금지 구역 — 다른 숫자가 얼굴을 덮지 않게
    const vr = visR(bossE);
    numZone('bossFace', bossE.x, bossE.y + bossDY(bossE) - vr * 0.1, vr * 1.7, vr * 1.9);
  }
}

function updateMagic(view, da, dt) {
  updateProcs(da);
  updateFinales(da);
  updateCollab(da);
  for (const s of SPRS) if (s.life > 0) s.life -= da;
  for (const b of LBEAMS) if (b.life > 0) b.life -= da;
  for (const fb of FIREBALLS) {
    if (!fb.on) continue;
    fb.t += da;
    if (fb.t >= fb.dur) { fb.on = false; fireballBoom(fb); }
    else if (rnd() < 0.8) {
      const u = fb.t / fb.dur, p = bez(fb, u);
      part(K_GLOW, p[0], p[1], (rnd() - 0.5) * 60, (rnd() - 0.5) * 60, 0.35, 14, fb.plasma ? '#e07aff' : rnd() < 0.5 ? '#ffe45a' : '#ff6a1f', -60, 2);
    }
  }
  for (const s of SOULS) {
    if (!s.on) continue;
    if ((s.t += da) >= s.dur) { s.on = false; part(K_STAR, GOLD_POS.x + (rnd() - 0.5) * 24, GOLD_POS.y, 0, 0, 0.3, 18, '#e0a0ff'); }
  }
  for (const s of HSHOTS) {
    if (!s.on) continue;
    if (s.delay > 0) { s.delay -= da; continue; }
    if ((s.t += da) < s.dur) continue;
    s.on = false;
    if (s.cls === 'sorcerer') {
      ring(s.x1, s.y1, 8, 60, 0.3, '#d8b0ff', 6);
      sprPop(starFlash('#c08aff'), s.x1, s.y1, 0.3, s.crit ? 1.5 : 1.1, 0.24);
      burst(K_SHARD, s.x1, s.y1, 5, 120, 300, 0.4, 5, ['#ffffff', '#c08aff'], 400, 2);
    } else {
      burst(K_SPARK, s.x1, s.y1, 4, 200, 450, 0.14, 2.4, ['#ffffff', '#b8ffb0'], 0, 6);
      ring(s.x1, s.y1, 4, 26, 0.2, '#d8ffd0', 3);
    }
  }
  for (const a of ARROWS) {
    if (!a.on) continue;
    if (a.delay > 0) { a.delay -= da; continue; }
    if ((a.t += da) >= 0.2) {
      a.on = false;
      burst(K_SPARK, a.x, a.y, 3, 150, 380, 0.14, 2.2, ['#ffffff', '#b8ffb0'], 0, 6);
      part(K_SMOKE, a.x, a.y, 0, -20, 0.4, 22, 'rgba(210,200,170,0.5)', 0, 1);
    }
  }
  for (const u of ULTS) {
    if (!u.on) continue;
    u.t += da;
    if (u.t >= u.dur) { u.on = false; continue; }
    if (u.cls === 'sorcerer' && rnd() < 0.9) { // 블리자드: 소용돌이치는 얼음 파편
      for (let k = 0; k < 3; k++) {
        const a = rnd() * TAU, d = u.r * (0.3 + rnd() * 0.7);
        part(K_SHARD, u.x + Math.cos(a) * d, u.y - 10 + Math.sin(a) * d * 0.7, -Math.sin(a) * 260, Math.cos(a) * 180 + 60, 0.5, 6, rnd() < 0.5 ? '#ffffff' : '#bff4ff', 0, 1);
      }
      if (rnd() < 0.15) { const a = rnd() * TAU, d = rnd() * u.r; sprPop(starFlash('#bff4ff'), u.x + Math.cos(a) * d, u.y + Math.sin(a) * d * 0.7, 0.2, 0.8, 0.25); }
    } else if (u.cls === 'cleric' && rnd() < 0.8) {
      part(K_GLOW, u.x + (rnd() - 0.5) * 120, u.y - rnd() * 40, 0, -120 - rnd() * 120, 0.8, 14, rnd() < 0.5 ? '#fff0a8' : '#9dff9a', 0, 1);
    } else if (u.cls === 'assassin') { // 그림자 난무: 0.13초마다 다음 표적
      while (u.k * 2 < u.tg.length && u.t >= u.k * 0.13) {
        const tx = u.tg[u.k * 2], ty = u.tg[u.k * 2 + 1];
        afterImage(tx - 24 + (u.k % 2) * 48, ty + 20, u.k % 2 ? -1 : 1, 0.45);
        for (const r2 of [-0.8, 0.8]) sprPop(slashArc('#ff5a8a'), tx, ty, 0.8, 1.4, 0.24, r2 + u.k, 0);
        sprPop(starFlash('#ff8ae8'), tx, ty, 0.4, 1.4, 0.24);
        burst(K_SMOKE, tx, ty, 3, 20, 90, 0.6, 30, 'rgba(70,20,100,0.55)', -20, 2);
        shake(0.08);
        u.k++;
      }
    }
  }
  if (PICKORB.on && (PICKORB.t += dt) >= 0.5) {
    PICKORB.on = false;
    const M = MF[0];
    ring(M.ox, M.oy, 10, 90, 0.4, PICKORB.col, 8);
    sprPop(starFlash(PICKORB.col), M.ox, M.oy, 0.5, 2, 0.3);
    burst(K_STAR, M.ox, M.oy, 14, 80, 300, 0.7, 16, ['#ffffff', PICKORB.col], 0, 2);
    M.cast = 1;
  }
  pickA = view.pick ? Math.min(1, pickA + dt * 4) : Math.max(0, pickA - dt * 5);
  if (view.pick && rnd() < dt * 12) part(K_GLOW, rnd() * WORLD_W, 200 + rnd() * 760, 0, -30 - rnd() * 40, 1.6, 12, rnd() < 0.5 ? '#c890ff' : '#ffd6ff', 0, 0.5);
  // 마나 가득 → 반짝
  const m = view.mana, full = !!(m && m.max > 0 && m.cur >= m.max);
  if (full && !manaWasFull) manaSparkle();
  manaWasFull = full;
  // 성벽 회복 숫자 (수호의 빛·영혼 수확·성직자·수호룡 등 출처와 무관하게 초록)
  const W = view.wall;
  if (W && view.phase === 'play' && lastPhase === 'play' && view.stage === lastStage && W.max === lastWallMax && lastWallHp >= 0) {
    const d = W.hp - lastWallHp;
    if (d > 0 && d < W.max * 0.4) healAcc += d;
  }
  lastWallHp = W ? W.hp : -1; lastWallMax = W ? W.max : -1; lastPhase = view.phase; lastStage = view.stage;
  if ((healT += dt) >= 0.6) {
    healT = 0;
    if (W && healAcc >= Math.max(1, W.max * 0.0015) && lastMode !== 'off') {
      const hx = 70 + rnd() * 580;
      num(hx, WALL_Y - 26, '+' + fmt(healAcc), '#4fe06a', '#0e4a1e', 0.8, false, 0.9);
      burst(K_GLOW, hx, WALL_Y - 10, 4, 30, 90, 0.6, 14, ['#9dff9a', '#ffffff'], -60, 1.5);
    }
    healAcc = 0;
  }
  // 판타지 스킬 지속 연출
  const sp = view.spells || {}, fx = view.spellFx;
  const bk = view.book || sp, lvHoly = bk.holyLight || sp.holyLight || 0, lvGale = bk.gale || sp.gale || 0;
  if (lvHoly && rnd() < dt * (4 + 3 * lvHoly)) { // 수호의 빛: 레벨만큼 빛 입자가 늘어난다
    part(K_GLOW, rnd() * WORLD_W, WALL_Y + rnd() * 30 - 10, (rnd() - 0.5) * 20, -50 - rnd() * 70, 1.3, 11, rnd() < 0.3 ? '#ffffff' : '#ffe89a', -15, 0.3);
  }
  if (lvGale && rnd() < dt * (6 + 3 * lvGale)) {
    const a = rnd() * TAU;
    part(K_GLOW, MF[0].cx + Math.cos(a) * 46, MAGE_FEET - 50 + Math.sin(a) * 30, -Math.sin(a) * 160, Math.cos(a) * 60 - 60, 0.4, 9, '#9fffe0', 0, 2);
  }
  if (!fx) return;
  if (fx.frostWard && rnd() < dt * 10) part(K_SHARD, rnd() * WORLD_W, WALL_Y - rnd() * fx.frostWard.r, (rnd() - 0.5) * 20, -20 - rnd() * 20, 1.4, 4, rnd() < 0.5 ? '#ffffff' : '#bff4ff', -8, 0.5);
  for (const l of fx.lances) {
    const n = l.hit ? l.hit.length : 0, p = lanceHits.get(l) || 0;
    if (n > p) {
      burst(K_SHARD, l.x, l.y, 6, 120, 360, 0.5, 6, ['#ffffff', '#bff4ff', '#7fe3ff'], 500, 1.5);
      sprPop(starFlash('#7fe3ff'), l.x, l.y, 0.3, 1, 0.2);
    }
    lanceHits.set(l, n);
    if (rnd() < 0.7) part(K_SHARD, l.x - l.vx * 0.02, l.y - l.vy * 0.02, (rnd() - 0.5) * 60, (rnd() - 0.5) * 60, 0.45, 4, rnd() < 0.5 ? '#ffffff' : '#9fe8ff', 0, 2);
  }
  // 망령: 새로 생기면 링, 사라지면(부딪힘) 보라 폭발
  const now = new Map();
  for (const q of fx.ghosts) {
    if (!ghostPrev.has(q)) ring(q.x, q.y, 4, 40, 0.3, '#8ff6ff', 3);
    now.set(q, [q.x, q.y, q.tgt && q.tgt.x < q.x ? -1 : 1]);
  }
  for (const [q, p] of ghostPrev) {
    if (now.has(q)) continue;
    burst(K_GLOW, p[0], p[1], 6, 60, 200, 0.4, 18, ['#e0c8ff', '#8ff6ff'], 0, 3);
    sprPop(starFlash('#9ff6ff'), p[0], p[1], 0.3, 1, 0.22);
    wisp(p[0], p[1], 1.5, p[2]); // 친 자리에서 망령이 흩어지며 솟는다(짧게 사는 유령이 또렷하게 남도록)
  }
  ghostPrev = now;
  // 불꽃 회오리 불씨 / 폭풍의 눈 번개
  const fus = view.fusions || [];
  for (const tn of fx.tornadoes) {
    if (fus.includes('blazeTornado') && rnd() < 0.6) part(K_GLOW, tn.x + (rnd() - 0.5) * tn.r, tn.y - rnd() * tn.r * 2, (rnd() - 0.5) * 80, -100 - rnd() * 100, 0.6, 12, rnd() < 0.5 ? '#ffe45a' : '#ff6a1f', 0, 1);
    if (fus.includes('stormEye') && rnd() < dt * 7) {
      const top = tn.y - tn.r * 2.6;
      bolt([[tn.x + (rnd() - 0.5) * tn.r, top], [tn.x + (rnd() - 0.5) * tn.r * 1.6, tn.y + tn.r * 0.3]], 0.1, '#ffe53a', '#7b5cff', 0.6, 'se');
    }
  }
}

// 화면 섬광 (HUD 위 맨 마지막 층)
export function drawFlash() {
  ht();
  if (colA > 0) { // 색 섬광: 가장자리 빛 + 아주 옅은 전체 틴트(≤0.12) — 전장이 우윳빛으로 날아가지 않게
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, colA * 1.2);
    drawView(vignette(flashCol, 0.4));
    ctx.globalAlpha = Math.min(0.12, colA * 0.25);
    ctx.fillStyle = flashCol;
    fillView();
    ctx.globalCompositeOperation = 'source-over';
  }
  if (flashA > 0) {
    ctx.globalAlpha = Math.min(0.2, flashA * 0.35); // 전체 흰 채움 ≤ 0.2 — 우윳빛으로 날아가지 않게
    ctx.fillStyle = '#ffffff';
    fillView();
  }
  ctx.globalAlpha = 1;
}

// 영웅 궁극기 바닥 마법진 (마법사·궁수·성직자) — 영웅 바닥 연출(units.drawGroundFx) 바로 뒤에 그린다
export function drawUltGround() {
  drawFinales(true); // 완전체 연출 뒤층(기둥·문·구름·일식) — 적 아래
  additive(true);
  for (const u of ULTS) {
    if (!u.on) continue;
    const a = Math.min(1, u.t * 5) * Math.min(1, (u.dur - u.t) * 3);
    if (u.cls === 'sorcerer') {
      groundRune(runeCircle('#5fc8ff'), u.x, u.y, u.r / 30, RT * 1.5, 0.6 * a);
      ctx.globalAlpha = 0.16 * a;
      spr(gl('#7fd8ff'), u.x, u.y - 20, u.r * 2.2, u.r * 1.3);
      ctx.globalAlpha = 0.4 * a;
      ctx.lineWidth = 3; ctx.strokeStyle = '#bff4ff';
      for (let k = 0; k < 4; k++) { // 회전하는 눈보라 호
        const rr = u.r * (0.35 + k * 0.2), a0 = RT * (3 - k * 0.4) + k * 1.7;
        ctx.beginPath(); ctx.ellipse(u.x, u.y - 16, rr, rr * 0.55, 0, a0, a0 + 1.6); ctx.stroke();
      }
    } else if (u.cls === 'ranger') {
      groundRune(runeCircle('#8aff8a'), u.x, u.y, u.r / 30, RT, 0.6 * a);
    } else if (u.cls === 'cleric') {
      groundRune(runeCircle('#ffd23a'), u.x, u.y, u.r / 32, RT, 0.7 * a);
    }
  }
  ctx.globalAlpha = 1;
  additive(false);
}

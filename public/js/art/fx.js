// 이펙트(VFX) — 파티클·빛(글로우)·마법진·충격 프레임·마법탄/투사체·원소 스킬 연출·데미지 숫자·화면 틴트.
// 이벤트 → 연출 매핑의 대부분(hit/kill/boom/spell/영웅 공격·궁극기/스킬/광란 등)이 여기 있다. docs/ART.md §5.3, §6, §9
// 소유: FX 에이전트. 계약(아래 export 목록과 render.js 호출 순서)은 docs/ART.md §14 참고.
import { WORLD_W, WORLD_H, WALL_Y, CANNONS, SPELL_BY_KEY } from '../config.js';
import { fmt, clamp } from '../util.js';
import { BOSSES } from '../stages.js';
import {
  TAU, S, bake, bakeO, circ, poly, rad, lin, fs, shine, lite, dim, mulberry, INK2, EL,
  ctx, K, BX, BY, T, RT, topExtra, GOLD_POS, hudY,
  shake, flash, punchZoom, colA, flashA, flashCol, MANA_POS, NUM_FONT, OWN, rnd, easeOut, lerp, pool, take,
  wt, ht, place, placeH, spr, additive, groundRune,
} from './core.js';
import { MF, HF, visOf, stuns, afterImage, MAGE_FEET, bone, visR, bossDY, warpY } from './units.js';
import { coins } from './world.js';
import { stamp } from './hud.js';

// 마법탄 원소 스타일 [코어, 메인, 에지, 꼬리 길이, 크기]
export const MSTY = {
  p0: ['#fff2a0', '#ffb030', '#b3230f', 1, 1],
  p0fire: ['#fff2a0', '#ff6a1f', '#8a1a08', 1.15, 1.1],
  p1: ['#ffffff', '#7fe3ff', '#2a78e0', 1, 1],
  flame: ['#fff2a0', '#ff5a1a', '#8a1a08', 1.25, 1.15],
  pierce: ['#ffffff', '#ffd23a', '#a65200', 2.1, 1.05],   // 관통: 길게 뻗는 마력 창
  pierce1: ['#ffffff', '#9fe8ff', '#2a78e0', 2.1, 1.05],
  homing: ['#fff0fb', '#ff8ad8', '#8a1f7a', 1.3, 1],      // 유도: 휘어 들어가는 도깨비불
  homing1: ['#f4f0ff', '#b89aff', '#4a2aa8', 1.3, 1],
};
export const mstyle = (kind, owner, fireP1) => kind === 'flame' ? MSTY.flame
  : kind === 'pierce' || kind === 'homing' ? MSTY[owner === 1 ? kind + '1' : kind]
  : owner === 1 ? MSTY.p1 : fireP1 ? MSTY.p0fire : MSTY.p0;
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
const BOLTS = pool(32, () => ({ life: 0, max: 1, pts: null, col: '#8ff', halo: '#3aa8ff', w: 1 }));
const METEORS = pool(20, () => ({ on: false, x0: 0, y0: 0, x1: 0, y1: 0, t: 0, delay: 0, dur: 0.3, kills: null }));
const DECALS = pool(24, () => ({ life: 0, max: 1, x: 0, y: 0, r: 0 }));
const BEAMS = pool(4, () => ({ life: 0, max: 1, x: 0, y0: 0 }));
const SPRS = pool(150, () => ({ life: 0, max: 1, x: 0, y: 0, s0: 1, s1: 1, ang: 0, spin: 0, vs: 0, sq: 1, img: null }));
const FIREBALLS = pool(10, () => ({ on: false, t: 0, dur: 0.28, x0: 0, y0: 0, x1: 0, y1: 0, r: 100, plasma: false, kills: [] }));
const SOULS = pool(48, () => ({ on: false, t: 0, dur: 0.8, x0: 0, y0: 0, cx: 0, cy: 0 }));
const HSHOTS = pool(24, () => ({ on: false, t: 0, dur: 0.1, cls: '', x0: 0, y0: 0, x1: 0, y1: 0, crit: false }));
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
export function resetGlows() { glows.clear(); ringCache.clear(); }

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
export function part(k, x, y, vx, vy, life, size, col, g = 0, drag = 0) {
  const p = take(P);
  p.k = k; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.size = size; p.col = col; p.g = g; p.drag = drag;
  p.rot = rnd() * TAU; p.vr = (rnd() - 0.5) * 14;
  return p;
}
export function burst(k, x, y, n, sp0, sp1, life, size, cols, g = 0, drag = 0, up = 0) {
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, sp = sp0 + rnd() * (sp1 - sp0);
    part(k, x, y, Math.cos(a) * sp, Math.sin(a) * sp - up, life * (0.7 + rnd() * 0.6), size * (0.6 + rnd() * 0.8), typeof cols === 'string' ? cols : cols[(rnd() * cols.length) | 0], g, drag);
  }
}
export function ring(x, y, r0, r1, life, col, w) {
  const r = take(RINGS);
  r.x = x; r.y = y; r.r0 = r0; r.r1 = r1; r.life = r.max = life; r.col = col; r.w = w;
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
function numW(n) { ctx.font = `${NUM_PX}px ${NUM_FONT}`; return ctx.measureText(n.txt).width * n.s0 + 14; }
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
  n.txt = (n.cls === 'H' ? '−' : '') + fmt(n.val) + (n.crit ? '!' : '');
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
  if (numBudget <= 0 || !freeSlot(cls)) return;
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
// 숫자 한 개를 오프스크린에 굽는다: 테두리(0.2em) + 바닥 그림자 + 딱 끊긴 2단 그라데이션(§5.3)
function bakeNum(n, R) {
  const fs = NUM_PX * n.s0, pad = fs * 0.3;
  const cw = Math.ceil((n.w + pad * 2) * R), ch = Math.ceil((fs * 1.2 + pad * 2) * R);
  const c = n.cv || (n.cv = document.createElement('canvas'));
  if (c.width < cw || c.height < ch || c.width > cw * 2) { c.width = cw; c.height = ch; }
  const x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, c.width, c.height);
  x.setTransform(R, 0, 0, R, c.width / 2, c.height / 2);
  x.font = `${fs}px ${NUM_FONT}`;
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  x.lineWidth = fs * 0.2;
  x.strokeStyle = n.ink; x.fillStyle = n.ink;
  x.strokeText(n.txt, 0, fs * 0.085); x.fillText(n.txt, 0, fs * 0.085);
  x.strokeText(n.txt, 0, 0);
  const g = x.createLinearGradient(0, -fs * 0.42, 0, fs * 0.42);
  g.addColorStop(0, n.top); g.addColorStop(0.5, n.top); g.addColorStop(0.53, n.col); g.addColorStop(1, n.col);
  x.fillStyle = g;
  x.fillText(n.txt, 0, 0);
  n.cw = c.width / R; n.ch = c.height / R;
  n.key = n.txt + n.col + n.ink + n.s0 + '|' + R;
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
  s.img = img; s.x = x; s.y = y; s.s0 = s0; s.s1 = s1; s.life = s.max = life; s.ang = ang; s.spin = spin; s.vs = rnd() * TAU; s.sq = sq;
  return s;
}
function soul(x, y) {
  const s = take(SOULS);
  s.on = true; s.t = 0; s.dur = 0.7 + rnd() * 0.25; s.x0 = x; s.y0 = y;
  s.cx = x + (GOLD_POS.x - x) * 0.15 + (rnd() - 0.5) * 120; s.cy = Math.min(y, 500) - 180 - rnd() * 80;
  part(K_GLOW, x, y, 0, -30, 0.3, 40, '#b04dff');
}
export function manaSparkle() {
  burst(K_STAR, MANA_POS.x, MANA_POS.y, 18, 60, 260, 0.8, 16, ['#ffffff', '#e0a0ff', '#ff9ad8'], 160, 1.4, 40);
  part(K_GLOW, MANA_POS.x, MANA_POS.y, 0, 0, 0.35, 160, '#d890ff');
  ring(MANA_POS.x, MANA_POS.y, 10, 140, 0.45, '#f0d0ff', 5);
}
// 증기 폭발 (화염 + 냉기 융합)
function steamFx(x, y, r) {
  part(K_GLOW, x, y, 0, 0, 0.14, r * 1.3, '#ffffff');
  part(K_GLOW, x, y, 0, 0, 0.3, r * 1.8, '#ff8a3a');
  burst(K_SMOKE, x, y, 9, 60, 190, 1.0, 46, 'rgba(236,248,255,0.75)', -60, 1.6);
  burst(K_SHARD, x, y, 6, 150, 380, 0.6, 6, ['#ffffff', '#bff4ff', '#7fe3ff'], 500, 1, 80);
  burst(K_GLOW, x, y, 6, 80, 240, 0.4, 20, ['#ffb040', '#ff6a1f'], -80, 3);
  ring(x, y, 8, r * 1.2, 0.4, '#e8fbff', 9);
  sprPop(starFlash('#bff4ff'), x, y, 0.4, 1.5, 0.22);
  shake(0.05);
}
// 낙뢰: 하늘에서 지그재그 볼트 2겹 + 섬광 + 그을음 (초전도면 얼음 파편)
function strike(x, y, sup, first) {
  const col = sup ? '#dff8ff' : '#ffe53a', halo = sup ? '#2a78e0' : '#7b5cff';
  const x0 = x + (rnd() - 0.5) * 140, mx = (x + x0) / 2 + (rnd() - 0.5) * 70, my = y * 0.5;
  const b = take(BOLTS);
  b.pts = [[x0, -40], [mx, my], [x, y]]; b.life = b.max = 0.3; b.col = col; b.halo = halo; b.w = 1.4;
  const b2 = take(BOLTS);
  b2.pts = [[mx, my], [mx + (rnd() - 0.5) * 160, my + 90 + rnd() * 80]]; b2.life = b2.max = 0.18; b2.col = col; b2.halo = halo; b2.w = 0.7;
  part(K_GLOW, x, y, 0, 0, 0.15, 110, '#ffffff');
  part(K_GLOW, x, y, 0, 0, 0.32, 170, sup ? '#7fe3ff' : '#ffe53a');
  burst(K_SPARK, x, y, 8, 300, 720, 0.18, 3, [col, '#ffffff'], 0, 6);
  sprPop(starFlash(sup ? '#7fe3ff' : '#ffe53a'), x, y, 0.4, 1.4, 0.24);
  ring(x, y, 8, 72, 0.32, col, 5);
  const d = take(DECALS);
  d.x = x; d.y = y + 8; d.r = 24; d.life = d.max = 2.5;
  if (sup) burst(K_SHARD, x, y, 7, 150, 380, 0.6, 7, ['#ffffff', '#bff4ff', '#7fe3ff'], 600, 1, 80);
  if (first) flash(0.1);
  shake(0.05);
}
function judgmentFx(x, w, twi) {
  const b = take(LBEAMS);
  b.x = x; b.w = w; b.y0 = -60; b.y1 = WALL_Y + 10; b.life = b.max = 0.55;
  b.core = twi ? '#fff0c0' : '#ffffff'; b.halo = twi ? '#9a3dff' : '#e0a72e';
  const sc = twi ? '#e0a0ff' : '#fff0a8';
  for (let k = 0; k < 6; k++) sprPop(starFlash(sc), x + (rnd() - 0.5) * w, 200 + rnd() * 700, 0.2, 0.7, 0.3);
  for (let k = 0; k < 14; k++) part(K_GLOW, x + (rnd() - 0.5) * w, 140 + rnd() * 800, 0, 180 + rnd() * 220, 0.5, 18, k % 2 ? sc : '#ffffff', 0, 1);
  sprPop(runeCircle(twi ? '#c070ff' : '#ffd23a'), x, WALL_Y - 26, 0.5, 1.5, 0.5, Math.PI / 2, 2, 0.35);
  ring(x, WALL_Y - 26, 10, w * 1.4, 0.4, sc, 6);
  shake(0.08);
}
function spellFx(view, ev, n) {
  const fus = view.fusions || [];
  const x = +ev.x || 0, y = warpY(x, +ev.y || 0);
  switch (ev.key) {
    case 'lightningStrike': strike(x, y, fus.includes('superconduct'), n === 0); break;
    case 'iceLance': {
      const M = MF[0];
      M.cast = 1;
      ring(M.ox, M.oy, 6, 56, 0.3, '#bff4ff', 4);
      sprPop(starFlash('#7fe3ff'), M.ox, M.oy, 0.3, 1, 0.22);
      burst(K_SHARD, M.ox, M.oy, 6, 80, 240, 0.45, 5, ['#ffffff', '#7fe3ff'], 300, 2);
      break;
    }
    case 'tornado': {
      const blaze = fus.includes('blazeTornado');
      burst(K_SMOKE, x, y + 24, 7, 40, 150, 0.8, 42, blaze ? 'rgba(255,170,90,0.5)' : 'rgba(220,240,230,0.55)', -20, 1.5);
      ring(x, y + 24, 10, 100, 0.45, blaze ? '#ffb040' : '#d8fff0', 6);
      sprPop(runeCircle(blaze ? '#ff8a3a' : '#6ff0c0'), x, y + 26, 0.5, 1.8, 0.55, Math.PI / 2, 2, 0.36);
      break;
    }
    case 'judgment': judgmentFx(x, +ev.w || 50, fus.includes('twilight')); break;
    case 'babyDragon': {
      const holy = fus.includes('guardianDragon');
      ring(x, y, 10, 80, 0.35, holy ? '#fff0a8' : '#ffb040', 5);
      burst(K_GLOW, x, y + 10, 8, 60, 200, 0.4, 18, holy ? ['#ffffff', '#fff0a8'] : ['#ffe45a', '#ff8a1e'], 200, 2);
      break;
    }
  }
}
function fireballBoom(fb) {
  const { x1: x, y1: y, r } = fb;
  const C = fb.plasma ? ['#ffffff', '#e07aff', '#7b5cff', '#ffb0ff'] : ['#fff2a0', '#ff8a1e', '#ff4a1a', '#ffe45a'];
  part(K_GLOW, x, y, 0, 0, 0.13, r * 1.5, '#ffffff');
  part(K_GLOW, x, y, 0, 0, 0.38, r * 2.6, C[1]);
  burst(K_GLOW, x, y, 16, 70, 340, 0.6, 26, [C[0], C[1], C[2]], -140, 3);
  burst(K_SPARK, x, y, 9, 400, 900, 0.2, 3.2, [C[3], '#ffffff'], 0, 6);
  burst(K_SMOKE, x, y, 5, 20, 90, 1.1, 54, fb.plasma ? 'rgba(80,30,110,0.5)' : 'rgba(60,36,30,0.55)', -90, 1);
  for (let k = 0; k < 4; k++) part(K_SMOKE, x + (rnd() - 0.5) * 16, y - k * 16, (rnd() - 0.5) * 20, -70 - k * 25, 1.1, 46 - k * 6, fb.plasma ? 'rgba(120,60,160,0.45)' : 'rgba(80,50,40,0.5)', 0, 1); // 버섯구름 기둥
  burst(K_DEBRIS, x, y, 5, 150, 380, 0.8, 6, ['#3a2a28', '#6a5552', C[1]], 900, 0.5, 150);
  ring(x, y, 10, r, 0.35, C[3], 9);
  ring(x, y, 6, r * 0.7, 0.3, '#ffffff', 4);
  sprPop(starFlash(C[1]), x, y, 0.5, r / 45, 0.24);
  sprPop(runeCircle(C[1]), x, y, 0.4, r / 30, 0.4, Math.PI / 2, 2, 0.4);
  const d = take(DECALS);
  d.x = x; d.y = y; d.r = r * 0.7; d.life = d.max = 3;
  fb.kills.forEach((kv, i) => killFx(kv, i < 4, lastMode));
  fb.kills.length = 0;
  shake(0.13);
}
// 영웅 원거리 투사체
function shot(cls, x0, y0, x1, y1, crit, speed) {
  const s = take(HSHOTS);
  s.on = true; s.t = 0; s.cls = cls; s.x0 = x0; s.y0 = y0; s.x1 = x1; s.y1 = y1; s.crit = crit;
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
const ULT_CALL = { knight: ['성스러운 방패', '#ffe07a'], ranger: ['화살비', '#8dff6a'], sorcerer: ['블리자드', '#9fe8ff'], cleric: ['천상의 치유', '#fff3a8'], assassin: ['그림자 난무', '#ff8ad8'] };
function heroUltFx(view, ev) {
  const u = take(ULTS), x = +ev.x || 360, y = +ev.y || 900, r = +ev.r || 170;
  u.on = true; u.t = 0; u.cls = ev.cls; u.x = x; u.y = y + 14; u.r = r; u.tg.length = 0; u.k = 0;
  shake(0.3);
  const cn = ULT_CALL[ev.cls];
  if (cn) stamp(cn[0] + '!', cn[1], 300, 58, 1.1); // 궁극기 이름 외침(클래스 색) — 효과만 번쩍이고 끝나지 않게
  switch (ev.cls) {
    case 'knight':
      u.dur = 0.8;
      // 바닥 룬 서클이 펼쳐지며(원근) 테두리 금빛 고리 하나 — 흰 충격파 없음
      sprPop(runeCircle('#ffc94a'), x, y + 14, 0.6, r / 31, 0.7, Math.PI / 2, 1.2, 0.38);
      ring(x, y, 20, r, 0.45, '#ffc94a', 8);
      sprPop(starFlash('#ffd23a'), x, y - 34, 0.5, 1.8, 0.3);
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
      flash(0.3, '#bff4ff');
      ring(x, y, 20, r, 0.6, '#e8fbff', 12);
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
    case 'steam': steamFx(x, y, r); break; // 증기 폭발(융합)
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
        m.t = 0; m.delay = k * 0.045 + rnd() * 0.06; m.dur = 0.28;
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

// 마법탄: 원소색 꼬리(가산) + 헤일로 + 반짝 입자 + 코어. 다중 시전은 부채꼴 그대로
// 마법탄(§9.7): 곧은 스미어 하나로 "핀·막대"처럼 보이던 것을 — 짧은 연결 스미어(속도 방향 정렬)
// + 점점 작아지는 잔상 구슬 사슬(원소 메인→에지, 탄마다 위상·간격을 살짝 어긋내 "벽지" 패턴 제거)
// + 헤드 주위를 도는 반짝 스파클로 바꾼다. 위 여분(y<0)으로 나가 사라지기 직전엔 부드럽게 페이드.
// 마법탄 (§9.7). 탄이 많을 때(다중 시전 + 최고 시전 속도 = 140발+) 전부 같은 크기로 그리면 "점 벽지"가 된다 →
// 탄마다 고정 시드로 약 44발만 '주탄'(크게·꼬리·반짝)으로, 나머지는 '보조탄'(60% 크기·반투명 헤드 + 옅은 빛)으로 그린다.
// 판정·개수는 그대로이고 그리기 호출 수가 크게 줄어든다(성능 §12).
const MAIN_BOLTS = 30;
let BY_ = new Float32Array(256), BA_ = new Float32Array(256); // 탄별 그려질 y(보스 왜곡) · 알파(HUD·화면 끝 페이드)
export function drawBullets(view) {
  const bs = view.bullets;
  if (!bs.length) return;
  const n = bs.length, twin = view.duo && view.duo.includes('twin'), fireP1 = !!(view.spells && view.spells.flameBullet), frz = view.frenzyT > 0; // 광란: 내 탄 붉은 금빛
  const keep = n <= MAIN_BOLTS ? 2 : MAIN_BOLTS / n, dense = n > MAIN_BOLTS;
  const sp = Math.min(0.3, 24 / n), tk = (twin ? 1.18 : 1) * (dense ? 1.2 : 1);
  const top = hudY(96);
  if (BY_.length < n) { BY_ = new Float32Array(n * 2); BA_ = new Float32Array(n * 2); }
  // 빗나간 탄이 화면 위(HUD 밑)·양옆 끝으로 날아가며 "색종이"처럼 쌓이지 않게 가까워지면 사라진다. AI 동료 탄은 한 톤 약하게
  for (let i = 0; i < n; i++) {
    const b = bs[i], y = warpY(b.x, b.y);
    BY_[i] = y;
    BA_[i] = clamp((y - top) / 110, 0, 1) * clamp(Math.min(b.x, WORLD_W - b.x) / 50, 0, 1) * (b.owner === 1 ? 0.78 : 1);
  }
  const isMain = (b, seed) => seed < (b.owner === 1 ? keep * 0.45 : keep);
  additive(true);
  // 1) 보조탄: 옅은 빛만 (가산)
  if (dense) for (let i = 0; i < n; i++) {
    const b = bs[i];
    if (isMain(b, seedOf(b)) || BA_[i] <= 0) continue;
    const st = mstyle(b.kind, b.owner, fireP1);
    ctx.globalAlpha = 0.3 * BA_[i];
    spr(gl(st[1]), b.x, BY_[i], 16, 16);
  }
  // 2) 주탄: 가늘어지는 리본 꼬리(속도 방향, 길이는 속도 비례) + 원소 헤일로 + 흰 백열 코어 — 전부 가산, 어두운 테 없음
  for (let i = 0; i < n; i++) {
    const b = bs[i], seed = seedOf(b), fade = BA_[i];
    if (!isMain(b, seed) || fade <= 0) continue;
    const by = BY_[i], own = b.owner === 1 ? 0.8 : 1;
    const st = frz && b.owner === 0 ? MSTY.flame : mstyle(b.kind, b.owner, fireP1), jr = (0.92 + 0.16 * seed) * own, spd = Math.hypot(b.vx, b.vy) || 1;
    const len = clamp(spd / 1600, 0.6, 1) * Math.min(st[3], 1.6) * tk * jr, wid = st[4] * tk * jr;
    const puls = 1 + 0.08 * Math.sin(RT * (16 + seed * 8) + seed * 20);
    ctx.globalAlpha = fade;
    place(b.x, by, Math.atan2(b.vy, b.vx), len, wid * 1.1);
    const tr = missileTrail(st[1], st[0]);
    ctx.drawImage(tr, -tr.hw, -tr.hh, tr.hw * 2, tr.hh * 2);
    wt();
    ctx.globalAlpha = 0.8 * fade;
    spr(gl(st[1]), b.x, by, 46 * wid * puls, 46 * wid * puls);
    ctx.globalAlpha = fade;
    spr(hotCore(st[0]), b.x, by, 24 * wid * puls, 24 * wid * puls);
  }
  ctx.globalAlpha = 1;
  if (n < 100) { // 3) 주탄 헤드 주위를 0.3초 주기로 도는 반짝
    const sk = sparkle('#ffffff');
    for (let i = 0; i < n; i++) {
      const b = bs[i], seed = seedOf(b);
      if (!isMain(b, seed) || BA_[i] <= 0) continue;
      const st = mstyle(b.kind, b.owner, fireP1);
      const ph = RT * (TAU / 0.3) + seed * TAU, orbR = 12 * st[4] * tk, tw = 0.5 + 0.5 * Math.sin(RT * 20 + seed * 12);
      ctx.globalAlpha = BA_[i];
      spr(sk, b.x + Math.cos(ph) * orbR, BY_[i] + Math.sin(ph) * orbR * 0.6, 12 * tw * tk, 12 * tw * tk);
    }
    ctx.globalAlpha = 1;
  }
  // 4) 보조탄 코어 + 주탄 마력 입자(꼬리 뒤로 떨어지는 반짝 — 파티클 예산 §12 안에서)
  for (let i = 0; i < n; i++) {
    const b = bs[i], fade = BA_[i];
    if (fade <= 0) continue;
    const st = mstyle(b.kind, b.owner, fireP1), seed = seedOf(b), main = isMain(b, seed);
    if (!main) { ctx.globalAlpha = 0.6 * fade; spr(hotCore(st[0]), b.x, BY_[i], 11, 11); continue; }
    if (rnd() < sp * 0.5) {
      const fire = b.kind === 'flame' || (fireP1 && b.owner === 0);
      part(fire ? K_GLOW : rnd() < 0.4 ? K_STAR : K_GLOW, b.x - b.vx * 0.02 + (rnd() - 0.5) * 8, BY_[i] - b.vy * 0.02 + (rnd() - 0.5) * 8,
        (rnd() - 0.5) * 40, (rnd() - 0.5) * 40 - (fire ? 50 : 0), 0.36, fire ? 11 : 10, rnd() < 0.5 ? st[1] : st[0], 0, 2);
    }
  }
  additive(false);
  ctx.globalAlpha = 1;
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

export function drawSprs() {
  additive(true);
  for (const s of SPRS) {
    if (s.life <= 0) continue;
    const u = 1 - s.life / s.max, k = s.s0 + (s.s1 - s.s0) * easeOut(u);
    ctx.globalAlpha = Math.min(1, (1 - u) * 1.8);
    place(s.x, s.y, s.ang, k * s.sq, k);
    ctx.rotate(s.vs + s.spin * u);
    ctx.drawImage(s.img, -s.img.hw, -s.img.hh, s.img.hw * 2, s.img.hh * 2);
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
    if (!s.on) continue;
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
export function drawTornadoes(view) {
  const fx = view.spellFx;
  if (!fx || !fx.tornadoes.length) return;
  const fus = view.fusions || [];
  const blaze = fus.includes('blazeTornado'), storm = fus.includes('stormEye');
  const C = blaze ? ['#ffe45a', '#ff8a2a', '#ff4a1a'] : ['#f0fff8', '#9ff0d8', '#6ff0c0'];
  for (const tn of fx.tornadoes) {
    const r = tn.r, base = tn.y + r * 0.5, hgt = r * 2.5, top = base - hgt;
    const a = Math.min(1, tn.t * 3) * clamp((6 - tn.t) / 0.5, 0, 1) * clamp((tn.y + 40) / 80, 0, 1);
    ctx.globalAlpha = 0.55 * a;
    spr(soft(blaze ? 'rgba(90,40,20,0.6)' : 'rgba(190,220,200,0.55)'), tn.x, base, r * 2.4, r * 0.7);
    if (storm) { ctx.globalAlpha = 0.6 * a; spr(soft('rgba(60,50,110,0.7)'), tn.x, top, r * 3.2, r * 1.1); }
    // 깔때기 몸통 (반투명, 휘청임)
    const sw = Math.sin(T * 3) * r * 0.18;
    ctx.globalAlpha = 0.42 * a;
    ctx.beginPath();
    ctx.moveTo(tn.x - r * 0.22, base);
    ctx.bezierCurveTo(tn.x - r * 0.4 + sw * 0.3, base - hgt * 0.45, tn.x - r * 1.05 + sw, top + hgt * 0.2, tn.x - r * 1.2 + sw, top);
    ctx.lineTo(tn.x + r * 1.2 + sw, top);
    ctx.bezierCurveTo(tn.x + r * 1.05 + sw, top + hgt * 0.2, tn.x + r * 0.4 + sw * 0.3, base - hgt * 0.45, tn.x + r * 0.22, base);
    ctx.closePath();
    const fg = ctx.createLinearGradient(tn.x - r, 0, tn.x + r, 0);
    fg.addColorStop(0, blaze ? 'rgba(255,90,30,0.15)' : 'rgba(160,230,210,0.12)');
    fg.addColorStop(0.35, blaze ? 'rgba(255,190,90,0.75)' : 'rgba(235,255,248,0.7)');
    fg.addColorStop(1, blaze ? 'rgba(200,50,20,0.25)' : 'rgba(120,200,180,0.2)');
    ctx.fillStyle = fg;
    ctx.fill();
    additive(true);
    ctx.globalAlpha = 0.3 * a;
    spr(gl(storm ? '#7b5cff' : C[2]), tn.x, (top + base) / 2, r * 1.9, hgt * 1.1);
    for (let k = 0; k < 11; k++) { // 회전하는 바람 줄기 (길이가 제각각)
      const u = k / 10, ry = base - u * hgt, rx = r * (0.22 + 0.98 * u);
      const off = sw * u, ph0 = T * 9 * (1 + u) + k * 2.3;
      ctx.globalAlpha = (0.3 + 0.4 * u) * a;
      ctx.lineWidth = 2 + u * 2.5;
      ctx.strokeStyle = C[k % 3];
      ctx.beginPath(); ctx.ellipse(tn.x + off, ry, rx, rx * 0.26, 0, ph0, ph0 + 1.6 + (k % 3) * 0.7); ctx.stroke();
    }
    additive(false);
    // 휘말린 잎·돌 (불꽃 회오리는 불씨)
    for (let j = 0; j < 8; j++) {
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
  for (const l of ls) {
    const a = Math.atan2(l.vy, l.vx);
    additive(true);
    place(l.x, l.y, a, 2.4, 1.5);
    ctx.drawImage(comet('#7fe3ff'), -66, -10, 72, 20);
    wt();
    ctx.globalAlpha = 0.6;
    spr(gl('#7fe3ff'), l.x, l.y, 56, 56);
    ctx.globalAlpha = 1;
    additive(false);
    place(l.x, l.y, a, 1.25, 1.25);
    ctx.drawImage(iceSpear(), -38, -11, 76, 22);
    wt();
  }
}

export function drawFireballs() {
  for (const fb of FIREBALLS) {
    if (!fb.on) continue;
    const u = fb.t / fb.dur;
    const C = fb.plasma ? ['#ffffff', '#e07aff', '#7b5cff'] : ['#fff2a0', '#ff8a1e', '#ff3a1a'];
    additive(true);
    for (let k = 8; k >= 0; k--) {
      const p = bez(fb, Math.max(0, u - k * 0.04));
      ctx.globalAlpha = 1 - k / 9;
      const s = 96 - k * 8;
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
export function drawSouls() {
  additive(true);
  for (const s of SOULS) {
    if (!s.on) continue;
    const u = s.t / s.dur, e = u * u * (3 - 2 * u);
    for (let k = 3; k >= 0; k--) {
      const q = Math.max(0, e - k * 0.05), a = 1 - q;
      const x = a * a * s.x0 + 2 * a * q * s.cx + q * q * GOLD_POS.x, y = a * a * s.y0 + 2 * a * q * s.cy + q * q * GOLD_POS.y;
      ctx.globalAlpha = 1 - k * 0.22;
      spr(gl(k ? '#9a3dff' : '#f2c8ff'), x, y, 28 - k * 5, 28 - k * 5);
    }
  }
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
  additive(true);
  for (const b of LBEAMS) {
    if (b.life <= 0) continue;
    const u = b.life / b.max, hgt = b.y1 - b.y0, w = b.w * (0.55 + 0.6 * u);
    ctx.globalAlpha = Math.min(1, u * 1.5) * 0.55;
    spr(gl(b.halo), b.x, b.y0 + hgt / 2, w * 2.2, hgt + 60);
    ctx.globalAlpha = Math.min(1, u * 2) * 0.9;
    ctx.drawImage(beamSpr(b.halo), b.x - w * 0.55, b.y0, w * 1.1, hgt);
    ctx.globalAlpha = Math.min(1, u * 2) * 0.7;
    spr(gl(b.core), b.x, b.y0 + hgt / 2, w * 0.45, hgt);
    ctx.globalAlpha = u * 0.55;
    spr(gl(b.halo), b.x, b.y1 - 6, w * 2.6, w * 0.8);
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
    if (p.k === K_GLOW) { // 큰 빛일수록 옅게(화면이 우윳빛으로 덮이지 않게 — 반경 220 넘으면 비례 감쇠)
      ctx.globalAlpha = Math.min(1, u * 1.6) * (p.size > 220 ? Math.max(0.3, 220 / p.size) : 1);
      const s = p.size * (0.4 + 0.6 * u);
      spr(gl(p.col), p.x, p.y, s, s);
    } else if (p.k === K_SPARK) {
      ctx.globalAlpha = Math.min(1, u * 2);
      ctx.strokeStyle = p.col;
      ctx.lineWidth = p.size * u + 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
      ctx.stroke();
    } else {
      ctx.globalAlpha = Math.min(1, u * 2);
      const s = p.size * (0.3 + 0.9 * Math.sin(u * Math.PI));
      spr(sparkle(p.col), p.x, p.y, s, s);
    }
  }
  // 고리
  for (const r of RINGS) { // 충격파: 가는 선 대신 구운 빛 고리(가산) — 두께는 w 로 살짝 조절
    if (r.life <= 0) continue;
    const u = 1 - r.life / r.max, e = 1 - (1 - u) * (1 - u);
    const R = r.r0 + (r.r1 - r.r0) * e, k = 1 + Math.min(0.35, r.w * 0.02) * (1 - u);
    ctx.globalAlpha = (1 - u) * 0.95 * clamp(1 - (r.r1 - 220) / 500, 0.4, 1); // 큰 고리일수록 옅게(화면을 하얗게 덮지 않게)
    const img = ringSpr(r.col);
    ctx.drawImage(img, r.x - R * k, r.y - R * k, R * 2 * k, R * 2 * k);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

export function drawBolts() {
  let any = false;
  for (const b of BOLTS) if (b.life > 0) { any = true; break; }
  if (!any) return;
  ctx.globalCompositeOperation = 'lighter';
  for (const b of BOLTS) {
    if (b.life <= 0) continue;
    const a = b.life / b.max;
    ctx.beginPath();
    const pts = b.pts;
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let k = 1; k < pts.length; k++) {
      const [x0, y0] = pts[k - 1], [x1, y1] = pts[k];
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      const seg = 6;
      for (let s = 1; s < seg; s++) {
        const u = s / seg, j = (rnd() - 0.5) * Math.min(28, len * 0.25);
        ctx.lineTo(x0 + dx * u + nx * j, y0 + dy * u + ny * j);
      }
      ctx.lineTo(x1, y1);
    }
    for (const [c, w, al] of [[b.halo, 13, 0.35], [b.col, 5.5, 0.8], ['#ffffff', 2.2, 1]]) {
      ctx.globalAlpha = a * al;
      ctx.strokeStyle = c;
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
  const R = Math.max(0.5, K * 1.3); // 구운 글자 해상도(팝 1.25배에도 선명하게)
  for (const n of NUMS) {
    if (!n.on) continue;
    const t = n.t;
    // 팝 인 90ms(0.3→1.25→1, back) · 합쳐질 때 1.15 톡 · 마지막 0.2초 페이드
    let k = t < 0.09 ? 0.3 + 0.95 * easeOut(t / 0.09) : t < 0.2 ? 1.25 - 0.25 * easeOut((t - 0.09) / 0.11) : 1;
    k *= 1 + n.punch * 0.15;
    const a = t > n.life - 0.2 ? Math.max(0, (n.life - t) / 0.2) : 1;
    if (a <= 0) continue;
    if (n.key !== n.txt + n.col + n.ink + n.s0 + '|' + R) bakeNum(n, R);
    ctx.globalAlpha = a;
    const wobble = n.crit && t < 0.15 ? Math.sin(t * 90) * 3 * (1 - t / 0.15) : 0; // 치명 좌우 흔들림 1회(§6)
    ctx.setTransform(K * k, 0, 0, K * k, BX + K * (n.x + wobble), BY + K * n.y);
    ctx.drawImage(n.cv, 0, 0, n.cw * R, n.ch * R, -n.cw / 2, -n.ch / 2, n.cw, n.ch);
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
    ctx.fillRect(0, -topExtra, WORLD_W, WORLD_H + topExtra);
    ctx.globalAlpha = pickA * 0.7;
    ctx.drawImage(vignette('rgba(120,50,200,0.8)', 0.55), 0, -topExtra, WORLD_W, WORLD_H + topExtra);
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
    ctx.fillRect(0, -topExtra, WORLD_W, WORLD_H + topExtra);
    ctx.globalAlpha = a * 0.65; // 서리 테두리만 — 전장이 하얗게 날아가지 않게
    ctx.drawImage(frost(), 0, -topExtra, WORLD_W, WORLD_H + topExtra);
  }
  if (view.frenzyT > 0) { // 광란: 가장자리 붉은 비네트 + 양옆 속도선(가산) — 전장 가운데는 깨끗하게
    const fa = Math.min(1, view.frenzyT / 0.5);
    additive(true); // 두 마법사 불꽃 오라(지팡이 끝 + 발밑)
    for (const M of MF) {
      ctx.globalAlpha = fa * (0.45 + 0.2 * Math.sin(RT * 14 + M.ox));
      spr(gl('#ff5a1a'), M.ox, M.oy, 80, 80);
      if (rnd() < 0.5) part(K_GLOW, M.ox + (rnd() - 0.5) * 50, MAGE_FEET - rnd() * 80, (rnd() - 0.5) * 30, -140 - rnd() * 100, 0.5, 12, rnd() < 0.5 ? '#ffb030' : '#ff5a1a', 0, 1);
    }
    additive(false);
    ctx.globalAlpha = fa * (0.62 + 0.2 * pulse);
    ctx.drawImage(vignette('rgba(255,30,20,0.8)', 0.6), 0, -topExtra, WORLD_W, WORLD_H + topExtra);
    additive(true);
    const span = WORLD_H + topExtra;
    for (let k = 0; k < 12; k++) {
      const side = k % 2, u = ((RT * (1.6 + (k % 3) * 0.4) + k * 0.37) % 1);
      const x = side ? WORLD_W - 14 - (k * 13) % 60 : 14 + (k * 17) % 60, y = -topExtra + span * (1 - u);
      ctx.globalAlpha = fa * 0.5 * Math.sin(u * Math.PI);
      spr(gl(k % 3 ? '#ff5a2a' : '#ffd23a'), x, y, 10, 150);
    }
    additive(false);
  }
  if (view.legendT > 0) {
    ctx.globalAlpha = Math.min(1, view.legendT / 0.5) * (0.45 + 0.2 * Math.sin(RT * 5));
    ctx.drawImage(vignette('rgba(255,200,40,0.8)', 0.62), 0, -topExtra, WORLD_W, WORLD_H + topExtra);
    // 금빛 테두리 (밝은 배경에서도 보이게)
    ctx.globalAlpha = Math.min(1, view.legendT / 0.5) * (0.6 + 0.4 * Math.sin(RT * 6));
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#ffd23a';
    ctx.strokeRect(5, 5 - topExtra, WORLD_W - 10, WORLD_H + topExtra - 10);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff6c0';
    ctx.strokeRect(5, 5 - topExtra, WORLD_W - 10, WORLD_H + topExtra - 10);
  }
  const ratio = view.wall && view.wall.max > 0 ? view.wall.hp / view.wall.max : 1;
  if (ratio < 0.3 && view.phase === 'play') {
    ctx.globalAlpha = (0.3 - ratio) / 0.3 * (0.4 + 0.4 * pulse);
    ctx.drawImage(vignette('rgba(200,0,20,0.8)', 0.6), 0, -topExtra, WORLD_W, WORLD_H + topExtra);
  }
  if (defeatA > 0) { // 패배: 전장 채도를 빼고(회색 톤) 붉은 비네트 — 패배 모달 뒤가 "무너진 순간"처럼
    ctx.globalCompositeOperation = 'saturation';
    ctx.globalAlpha = defeatA * 0.75;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, -topExtra, WORLD_W, WORLD_H + topExtra);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = defeatA * 0.35;
    ctx.fillStyle = '#2a0008';
    ctx.fillRect(0, -topExtra, WORLD_W, WORLD_H + topExtra);
    ctx.globalAlpha = defeatA * 0.8;
    ctx.drawImage(vignette('rgba(200,0,20,0.85)', 0.5), 0, -topExtra, WORLD_W, WORLD_H + topExtra);
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
  bossBand = !!view.boss;
  meteorKills.length = 0;
  let meteorFrame = false;
  const fireP1 = !!(view.spells && view.spells.flameBullet);
  const fus = view.fusions || [];
  let runes = 0, souls = 0, strikes = 0;
  const soulOn = !!(view.spells && view.spells.soulHarvest);
  fbFrame.length = 0;
  for (const ev of evs) {
    if (ev.type === 'boom' && ev.kind === 'meteor') meteorFrame = true;
    // 파이어볼: 처치 이벤트보다 늦게 오므로 먼저 띄워 두고, 반경 안 처치 연출은 착탄 때 터뜨린다
    else if (ev.type === 'spell' && ev.key === 'fireball') {
      const fb = take(FIREBALLS), M = MF[0];
      fb.on = true; fb.t = 0; fb.x0 = M.ox; fb.y0 = M.oy; fb.x1 = +ev.x || 360; fb.y1 = +ev.y || 400; fb.r = +ev.r || 100;
      fb.dur = clamp(Math.hypot(fb.x1 - fb.x0, fb.y1 - fb.y0) / 2600, 0.16, 0.3);
      fb.plasma = fus.includes('plasma'); fb.kills.length = 0;
      fbFrame.push(fb);
      MF[0].cast = 1;
    }
  }
  for (let i = 0; i < evs.length; i++) {
    const ev = evs[i];
    switch (ev.type) {
      case 'hit': {
        if (ev.o === 2 || ev.o === 3) { // 영웅·스킬 피해(§6): 시각은 heroAttack/spellFx가 맡고 여기선 숫자·보스 티커만
          const e2 = nearest(view, ev.x, ev.y, 40), boss2 = !!(e2 && e2.isBoss), d2 = +ev.dmg || 0;
          if (boss2) bossTicker += d2;
          if (mode !== 'off' && !boss2 && (mode === 'full' || ev.crit)) {
            const hero = ev.o === 2, el = EL[ev.kind];
            const col = hero ? '#ff6fd8' : el ? el[1] : '#c89aff', ink = hero ? HERO_NUM[1] : el ? dim(el[2], 0.35) : '#3a1a5a';
            const y2 = e2 ? e2.y + bossDY(e2) - visR(e2) * 0.85 : ev.y - 20;
            dmgNum(ev.x, y2, d2, ev.o, ev.crit ? 'C' : 'N', col, ink, 1, !!ev.crit, ev.crit ? 0.75 : 0.45, '', e2, hero ? '#ffe8fb' : '#ffffff');
          }
          break;
        }
        const o = ev.o === 1 ? 1 : 0, full = hits++ < (view.speed >= 3 ? 6 : 12); // 프레임당 풀 연출 12개까지(3배속은 6 — 파티클 예산 §12)
        const st = mstyle(ev.kind, o, fireP1), kc = st[1];
        // 맞은 적의 대포 쪽 표면에 튀김 (보스 얼굴을 가리지 않게)
        const e = nearest(view, ev.x, ev.y, 40), er = e ? e.r : 0;
        const ha = Math.PI * (0.2 + rnd() * 0.6);
        const hx = ev.x + Math.cos(ha) * er * 0.75, hy = warpY(ev.x, ev.y) + Math.sin(ha) * er * 0.75;
        const hs = e ? clamp(visR(e) / 36, 0.45, 1.2) : 0.8; // 타격 빛은 맞은 적 크기에 맞춘다(잡몹이 빛 덩어리에 묻히지 않게)
        if (full) { // 마력 폭발: 룬 섬광 + 파편 + 불티
          if (runes++ < 8) sprPop(runeCircle(kc), hx, hy, 0.16, (ev.crit ? 0.8 : 0.5) * hs, 0.2, 0, 3);
          part(K_GLOW, hx, hy, 0, 0, 0.1, (ev.crit ? 56 : 38) * hs, kc);
          burst(K_SHARD, hx, hy, ev.big ? 5 : 3, 120, 300, 0.35, 4.5, [st[1], st[0]], 500, 2, 60);
          burst(K_SPARK, hx, hy, ev.crit ? 5 : 3, 250, 520, 0.14, 2.6, [kc, '#ffffff'], 0, 6);
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
        // 운석·파이어볼로 죽은 적은 떨어질 때 터뜨림
        if (meteorFrame && !ev.isBoss) { meteorKills.push(ev); break; }
        const fb = !ev.isBoss && fbFrame.length ? fbFrame.find(f => (f.x1 - ev.x) ** 2 + (f.y1 - ev.y) ** 2 <= (f.r + 40) ** 2) : null;
        if (fb) fb.kills.push(ev);
        else killFx(ev, kills++ < 12, mode);
        break;
      }
      case 'boom': boom(view, ev); break;
      case 'spell': spellFx(view, ev, strikes++); break;
      case 'spellPick': {
        const sp = SPELL_BY_KEY[ev.spell];
        PICKORB.on = true; PICKORB.t = 0; PICKORB.col = EL[sp ? sp.element : 'holy'][1];
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
        const b = take(BOLTS);
        const plasma = ev.o === 0 && fus.includes('plasma');
        b.pts = ev.pts; b.life = b.max = 0.22; b.w = 1;
        b.col = plasma ? '#ffb0ff' : ev.o === 1 ? '#8ff8ff' : '#ffe53a';
        b.halo = plasma ? '#c040ff' : ev.o === 1 ? '#2a78e0' : '#7b5cff';
        for (const pt of ev.pts) part(K_GLOW, pt[0], pt[1], 0, 0, 0.2, 44, b.col);
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
      part(K_GLOW, m.x1, m.y1, 0, 0, 0.3, 200, '#ff9a2a');
      part(K_GLOW, m.x1, m.y1, 0, 0, 0.12, 90, '#ffffff');
      burst(K_GLOW, m.x1, m.y1, 8, 80, 300, 0.5, 26, ['#ffe45a', '#ff8a1e', '#ff4a1a'], -100, 3);
      burst(K_DEBRIS, m.x1, m.y1, 5, 150, 400, 0.8, 7, ['#3a2a28', '#6a5552'], 900, 0.5, 150);
      ring(m.x1, m.y1, 10, 110, 0.4, '#ffd080', 9);
      if (m.kills) { m.kills.forEach((kv, i) => killFx(kv, i < 3, lastMode)); m.kills = null; }
      const d = take(DECALS);
      d.x = m.x1; d.y = m.y1; d.r = 60; d.life = d.max = 6;
      shake(0.1);
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
  if (sp.holyLight && rnd() < dt * [6, 11, 18][sp.holyLight - 1]) {
    part(K_GLOW, rnd() * WORLD_W, WALL_Y + rnd() * 30 - 10, (rnd() - 0.5) * 20, -50 - rnd() * 70, 1.3, 11, rnd() < 0.3 ? '#ffffff' : '#ffe89a', -15, 0.3);
  }
  if (sp.gale && rnd() < dt * 14) {
    const a = rnd() * TAU;
    part(K_GLOW, CANNONS[0].x + Math.cos(a) * 46, MAGE_FEET - 50 + Math.sin(a) * 30, -Math.sin(a) * 160, Math.cos(a) * 60 - 60, 0.4, 9, '#9fffe0', 0, 2);
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
    if (!ghostPrev.has(q)) ring(q.x, q.y, 4, 34, 0.3, '#d8b0ff', 3);
    now.set(q, [q.x, q.y]);
  }
  for (const [q, p] of ghostPrev) {
    if (now.has(q)) continue;
    burst(K_GLOW, p[0], p[1], 6, 60, 200, 0.4, 18, ['#d8b0ff', '#9a3dff'], 0, 3);
    sprPop(starFlash('#c080ff'), p[0], p[1], 0.3, 1, 0.22);
  }
  ghostPrev = now;
  // 불꽃 회오리 불씨 / 폭풍의 눈 번개
  const fus = view.fusions || [];
  for (const tn of fx.tornadoes) {
    if (fus.includes('blazeTornado') && rnd() < 0.6) part(K_GLOW, tn.x + (rnd() - 0.5) * tn.r, tn.y - rnd() * tn.r * 2, (rnd() - 0.5) * 80, -100 - rnd() * 100, 0.6, 12, rnd() < 0.5 ? '#ffe45a' : '#ff6a1f', 0, 1);
    if (fus.includes('stormEye') && rnd() < dt * 7) {
      const b = take(BOLTS), top = tn.y - tn.r * 2.6;
      b.pts = [[tn.x + (rnd() - 0.5) * tn.r, top], [tn.x + (rnd() - 0.5) * tn.r * 1.6, tn.y + tn.r * 0.3]];
      b.life = b.max = 0.14; b.col = '#ffe53a'; b.halo = '#7b5cff'; b.w = 0.7;
    }
  }
}

// 화면 섬광 (HUD 위 맨 마지막 층)
export function drawFlash() {
  ht();
  if (colA > 0) { // 색 섬광: 가장자리 빛 + 아주 옅은 전체 틴트(≤0.12) — 전장이 우윳빛으로 날아가지 않게
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, colA * 1.2);
    ctx.drawImage(vignette(flashCol, 0.4), 0, -topExtra, WORLD_W, WORLD_H + topExtra);
    ctx.globalAlpha = Math.min(0.12, colA * 0.25);
    ctx.fillStyle = flashCol;
    ctx.fillRect(0, -topExtra, WORLD_W, WORLD_H + topExtra);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (flashA > 0) {
    ctx.globalAlpha = Math.min(0.45, flashA * 0.6);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, -topExtra, WORLD_W, WORLD_H + topExtra);
  }
  ctx.globalAlpha = 1;
}

// 영웅 궁극기 바닥 마법진 (마법사·궁수·성직자) — 영웅 바닥 연출(units.drawGroundFx) 바로 뒤에 그린다
export function drawUltGround() {
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

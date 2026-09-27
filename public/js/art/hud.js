// 캔버스 HUD 연출 — 보스 체력바·콤보 카운터·광란/전설 표시·도장(빙결!/광란!)·조합 팝업·보스 경고·히든 조합 엠블럼 컷인·전설 획득·LEVEL UP.
// DOM HUD(골드·층·웨이브·마나·메뉴·영웅 버튼)는 ui.js/style.css 몫이고, 여기는 전장 위에 캔버스로 그리는 층만.
// docs/ART.md §4.5, §10.2, §10.8~10.11
// 소유: UI 에이전트(kit.css · 아이콘 · ui.js/heroui.js 와 함께). 계약은 docs/ART.md §14 참고.
import { WORLD_W, WORLD_H, WALL_Y, SYNERGIES, COMBO_TIERS, COMBO_WINDOW, FRENZY, LEGEND_T, THEMES, SPELL_BY_KEY } from '../config.js';
import { clamp } from '../util.js';
import { MILESTONES } from '../hero.js';
const MS_DESC = Object.fromEntries(MILESTONES.map(m => [m.key, m.desc]));
import {
  ctx, scale, ox, oy, RT, frameDt, topExtra, sideX, fillView, TAU, tint, BAG_POS,
  shake, flash, FONT, NUM_FONT, BODY_FONT, easeBack, easeOut, lerp, pool, take,
  wt, ht, place, placeH, spr, txt, rr, additive,
} from './core.js';
import { burst, ring, sprPop, lightBeam, numText, numZone, K_STAR, sparkle, rays, runeCircle, runeBand } from './fx.js';
import { enemy, itemIcon } from './units.js';
import { iconImage } from '../icons.js';
import { emblem, fusionParts } from './emblems.js';

const SYN = Object.fromEntries(SYNERGIES.map(s => [s.key, s]));
const KIND_COL = { cannon: ['#2a0848', '#8a2ac8', '#ff8aff'], duo: ['#06243e', '#1a86c0', '#7ff4ff'], event: ['#3e1400', '#d06a0a', '#ffd84a'], fusion: ['#1a0838', '#6a2ac0', '#ffc8ff'], collab: ['#3a0828', '#c8306a', '#ffb0e0'] };
const TIER_COL = ['#ffffff', '#7fe3ff', '#ffc23a', '#ff5a3a']; // x3 흰 · x10 하늘 · x30 금 · x50 불꽃 · x100 금빛 일렁임
const STAMPS = pool(5, () => ({ life: 0, max: 1, txt: '', col: '#fff', y: 0, size: 60, delay: 0 }));
const POPS = pool(8, () => ({ life: 0, max: 1, txt: '', sub: '', col: '#fff', x: 0, y: 0 }));
const LVUPS = pool(3, () => ({ on: false, t: 0, x: 0, y: 0, level: 1, ms: null }));
let bossLag = 1, bossName = '', bossA = 0, bossNamed = false;
const combo = { shown: 0, prev: 0, tier: 0, a: 0, punch: 0, tierPunch: 0 };

export function stamp(str, col, y = 400, size = 64, life = 1.1) {
  // 도장은 한 번에 하나: 떠 있는 도장이 거의 끝날 때까지 기다렸다 찍힌다(두 글자가 겹쳐 읽히지 않게)
  let wait = 0;
  for (const q of STAMPS) if (q.life > 0) wait = Math.max(wait, q.delay + q.life - 0.2);
  const s = take(STAMPS);
  s.txt = str; s.col = col; s.y = y; s.size = size; s.life = s.max = life; s.delay = Math.min(wait, 2);
}
export function pop(str, sub, col, x, y) {
  x = clamp(x, 130, WORLD_W - 130); y = clamp(y, 210 - topExtra, 880);
  // 같은 자리에 떠 있는 알약이 있으면 위로 한 칸씩(겹침 금지)
  for (let k = 0; k < 6; k++) {
    let hit = false;
    for (const q of POPS) if (q.life > 0 && Math.abs(q.x - x) < 240 && Math.abs(q.y - (q.max - q.life) * 18 - y) < 66) { hit = true; break; }
    if (!hit) break;
    y -= 66;
  }
  const p = take(POPS);
  p.txt = str; p.sub = sub; p.col = col; p.x = x; p.y = y; p.life = p.max = 1.6;
}

export function drawLevelUps() {
  for (const L of LVUPS) {
    if (!L.on) continue;
    const t = L.t;
    if (t <= 0) continue; // 대기 중
    const k = t < 0.28 ? easeBack(t / 0.28) : 1, a = (t > 1.5 ? Math.max(0, 1 - (t - 1.5) / 0.4) : 1) * (1 - quietA);
    const x = clamp(L.x, 170, WORLD_W - 170), y = Math.max(260 - topExtra, L.y - 300) - Math.min(t, 1) * 14;
    if (a <= 0) continue;
    numZone('lvup', x, y + 50, 320, 200);
    ctx.globalAlpha = a;
    additive(true);
    place(x, y, RT * 0.8, 1, 1);
    ctx.globalAlpha = a * 0.6;
    spr(rays('#ffd23a'), 0, 0, 260 * k, 260 * k);
    wt();
    additive(false);
    ctx.globalAlpha = a;
    place(x, y, -0.04, k, k);
    numText('LEVEL UP!', 0, 0, 60, '#fff8c0', '#ffb020', '#5a2600');
    const lk = t > 0.35 && t < 0.55 ? 1 + 0.3 * Math.sin((t - 0.35) / 0.2 * Math.PI) : 1;
    ctx.scale(lk, lk);
    numText('Lv.' + L.level, 0, 44 / lk, 28, '#ffffff', '#bfe8ff', '#1a2a5a');
    wt();
    if (L.ms && t > 0.45) { // 마일스톤 카드: 리본 머리 + 해금된 능력 한 줄
      const mk = t < 0.65 ? easeBack((t - 0.45) / 0.2) : 1, desc = MS_DESC[L.ms] || '';
      place(x, y + 96, 0, mk, mk);
      ctx.font = `19px ${FONT}`;
      const cw = Math.max(200, ctx.measureText(desc).width + 40);
      rr(-cw / 2, -26, cw, 52, 16);
      ctx.fillStyle = 'rgba(16,24,58,0.94)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#22163a'; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = '#8ff8ff'; rr(-cw / 2 + 3, -23, cw - 6, 46, 13); ctx.stroke();
      rr(-54, -38, 108, 22, 11); ctx.fillStyle = '#2aa8e0'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#22163a'; ctx.stroke();
      txt('새 능력 해금', 0, -27, 14, '#ffffff', '#0a2a4a', 4);
      txt(desc, 0, 6, 19, '#e8fbff', '#0a1a3a', 5);
      wt();
    }
  }
  ctx.globalAlpha = 1;
}

// ═════════════ 한 번에 하나 — 연출 대기열 (ART §10.9 · §10.10) ═════════════
// 보스 WARNING · 히든 조합/융합 컷인 · 전설 획득은 겹치지 않고 차례로. 컷인·전설은 클리어/모달/카드 선택 중엔 보류.
// 연출(또는 클리어·모달·카드 선택)이 떠 있으면 콤보·광란 표시·도장은 숨긴다.
const MQ = [];
let moment = null;          // { kind: 'boss'|'cut'|'loot', t, life, ... }
let quiet = false, quietA = 0, domChk = 0;
const MOMENT_LIFE = { boss: 2.2, cut: 2.6, loot: 2.1 };
// ui.js 가 카드 선택 오버레이를 띄우기 전에 묻는다: 지금 연출이 몇 초 남았나(보스 경고가 끝난 뒤 카드가 뜨게)
// main.js 가 전투 시간 배율로 쓴다: 전체 화면 컷인(히든 조합·융합) 동안은 0.3배 — 어두운 동안 적이 몰래 진군하지 않게
// 합동 필살 슬로 모션(slowmo 이벤트): 실시간 ms 동안 시뮬·연출 시계를 scale 배로
let slowUntil = -9, slowK = 1;
export const slowmoScale = () => (RT < slowUntil ? slowK : 1);
export const simSlow = () => Math.min(moment && moment.kind === 'cut' ? 0.3 : 1, slowmoScale());
// 보스 경고가 끝난 뒤에도 0.8초는 착지한 보스를 맨눈으로 보여 준 다음 카드를 띄운다
let bossEndRT = -9, meteorRT = -9; // 운석이 떨어지는 순간도 카드가 덮지 않게 0.9초 기다린다
export const momentLeft = () => Math.max(0, 0.9 - (RT - meteorRT)) + (moment ? Math.max(0, moment.life - moment.t) + (moment.kind === 'boss' ? 0.8 : 0) : Math.max(0, 0.8 - (RT - bossEndRT)))
  + (MQ.some(m => m.kind === 'boss') ? MOMENT_LIFE.boss + 0.8 : 0);
function domBusy() {
  if (typeof document === 'undefined') return false;
  return !!document.querySelector('#layer .modal:not([hidden]), #clear:not([hidden]), #defeat:not([hidden]), #pick:not([hidden]), .hu-cp:not([hidden]), .hu-main:not([hidden])');
}

// 새 층: 층 숫자가 쿵 찍히고 룬 띠가 양옆으로 펼쳐진다. 테마가 바뀌는 층(21·41…)은 테마 이름 리본이 크게
const FLOOR = { t: 9, stage: 0, theme: 0, newTheme: false };
let lastFloor = 0;
function drawFloor() {
  const t = FLOOR.t;
  if (t > 1.6 || moment) return;
  const a = t < 0.12 ? t / 0.12 : t > 1.25 ? Math.max(0, (1.6 - t) / 0.35) : 1, y = midY() - 40;
  const k = t < 0.28 ? easeBack(t / 0.28) : 1, open = easeOut(Math.min(1, t / 0.45));
  numZone('floor', 360, y + 20, 480, 170);
  additive(true);
  ctx.globalAlpha = a * 0.9;
  const rb = runeBand(FLOOR.newTheme ? '#ffd86a' : '#bfe0ff'), half = 330 * open;
  ctx.save(); ctx.beginPath(); ctx.rect(360 - half, y - 70, half * 2, 150); ctx.clip();
  ctx.drawImage(rb, -50 + (RT * 50) % 48, y - 52, 820, 18);
  ctx.drawImage(rb, -(RT * 50) % 48, y + 58, 820, 18);
  ctx.restore();
  ctx.globalAlpha = a * 0.5;
  spr(rays(FLOOR.newTheme ? '#ffd23a' : '#8fd8ff'), 360, y, 300 * k, 300 * k);
  additive(false);
  ctx.globalAlpha = a;
  placeH(360, y, k);
  numText(FLOOR.stage + '층', 0, 0, 72, '#fffbe0', '#ffc92e', '#4a2000');
  ht();
  if (FLOOR.newTheme || FLOOR.stage === 1) {
    const rk = t < 0.4 ? easeBack(clamp((t - 0.12) / 0.28, 0, 1)) : 1;
    placeH(360, y + 64, rk);
    ribbon(0, 0, 260, 44, '#8fd0ff', '#2a78e0', '#123a8a');
    txt(THEMES[FLOOR.theme] ? THEMES[FLOOR.theme].name : '', 0, 2, 22, '#ffffff', '#0a2050', 6);
    ht();
  }
  ctx.globalAlpha = 1;
}

export function drawHud(view) {
  ht();
  ctx.textBaseline = 'middle';
  drawFloor();
  drawBossBar(view);
  const hideA = Math.max(quietA, moment ? 1 : 0);
  if (hideA < 1) drawCombo(view, 1 - hideA);
  // 스탬프 (연출 중엔 가림)
  if (!moment) for (const s of STAMPS) {
    if (s.life <= 0 || s.delay > 0) continue;
    const t = s.max - s.life;
    const k = t < 0.18 ? easeBack(t / 0.18) : 1;
    const a = (s.life < 0.3 ? s.life / 0.3 : 1) * (1 - quietA);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.setTransform(scale * k, 0, 0, scale * k, ox + scale * 360, oy + scale * (s.y - t * 16));
    ctx.rotate(-0.06);
    // 스티커 테두리: 흰 바깥선 → 잉크선 → 색 (어떤 바닥색 위에서도 읽히게)
    ctx.font = `${s.size}px ${NUM_FONT}`; ctx.textAlign = 'center';
    ctx.lineWidth = s.size * 0.36; ctx.strokeStyle = '#ffffff'; ctx.strokeText(s.txt, 0, 0);
    ctx.lineWidth = s.size * 0.2; ctx.strokeStyle = '#1a0612'; ctx.strokeText(s.txt, 0, 0);
    ctx.fillStyle = s.col; ctx.fillText(s.txt, 0, 0);
    ctx.globalAlpha = a * 0.45;
    ctx.save(); ctx.beginPath(); ctx.rect(-400, -s.size, 800, s.size * 0.52); ctx.clip();
    ctx.fillStyle = '#ffffff'; ctx.fillText(s.txt, 0, 0); ctx.restore();
    numZone('stamp', 360, s.y, s.size * s.txt.length * 0.9 + 40, s.size * 1.2);
  }
  ht();
  // 알림 알약(카드 축복·AI 동료 새 주문 등): 톡 튀어나와 살짝 떠오르고 사라짐
  if (!moment) for (const p of POPS) {
    if (p.life <= 0) continue;
    const t = p.max - p.life, k = t < 0.2 ? easeBack(t / 0.2) : 1, a = Math.min(1, p.life / 0.3) * (1 - quietA);
    if (a <= 0) continue;
    ctx.font = `20px ${FONT}`;
    const w1 = ctx.measureText(p.txt).width;
    ctx.font = `15px ${FONT}`;
    const w = Math.max(w1, ctx.measureText(p.sub).width) + 40, y = p.y - t * 18;
    ctx.globalAlpha = a;
    placeH(p.x, y, k);
    rr(-w / 2, -26, w, p.sub ? 52 : 36, 18);
    ctx.fillStyle = 'rgba(16,12,40,0.92)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#22163a'; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = p.col; rr(-w / 2 + 3, -23, w - 6, (p.sub ? 52 : 36) - 6, 15); ctx.stroke();
    txt(p.txt, 0, p.sub ? -9 : -8, 20, p.col, '#1a0612', 5);
    if (p.sub) txt(p.sub, 0, 13, 15, '#ffffff', '#1a0612', 4);
    numZone('pop', p.x, y, w, 56);
    ht();
  }
  ctx.globalAlpha = 1;
  drawChips(view, 1 - Math.max(quietA, moment ? 0.6 : 0));
  ht();
  ctx.globalAlpha = 1;
  if (moment) {
    if (moment.kind === 'boss') drawBanner(moment);
    else if (moment.kind === 'cut') drawCut(moment);
    else drawLootBanner(moment);
  }
  ctx.globalAlpha = 1;
  ht();
}

// ═════════════ 조합 아이콘 줄 (왼쪽 가장자리, 상시) ═════════════
// 켜져 있는 조합(내 마법사 · 협동 · 원소 융합 · AI)은 작은 색 타일로 한 줄에 하나씩 — 재발동 알약을 쌓지 않는다.
// 다시 발동하면 그 타일만 톡 튀고 오른쪽에 이름표가 잠깐 나온다(행마다 자리가 정해져 있어 겹치지 않음).
// 순간 조합(연쇄 폭발·이중 필살 등)은 발동할 때만 3초 동안 줄 끝에 붙는다.
const CHIPS = new Map(); // key → { punch, label, until, o }
const CHIP_MAX = 8, CHIP_GAP = 44;
const chipList = [];
function chipHit(key, o) {
  let c = CHIPS.get(key);
  if (!c) CHIPS.set(key, c = { punch: 0, label: 0, until: 0, o });
  c.punch = 1; c.label = 1.5; c.until = RT + 3; c.o = o;
}
function buildChips(view) {
  chipList.length = 0;
  // 융합은 오른쪽 스킬 스택, 협공은 영웅 상태(UI)가 보여 준다 → 여기엔 마법사 조합·순간 조합만
  const add = (key, o) => { const s = SYN[key]; if (s && s.kind !== 'fusion' && s.kind !== 'collab' && !chipList.some(c => c.key === key) && chipList.length < CHIP_MAX) chipList.push({ key, o }); };
  const ps = view.players || [];
  if (ps[0] && ps[0].syn) for (const k of ps[0].syn) add(k, 0);
  for (const k of view.duo || []) add(k, -1);
  if (ps[1] && ps[1].syn) for (const k of ps[1].syn) add(k, 1);
  for (const [k, c] of CHIPS) if (c.until > RT) add(k, c.o);
}
function chipIcon(key, sz) {
  const em = emblem(key, 0.9);
  if (em) ctx.drawImage(em, -sz * 0.62, -sz * 0.62, sz * 1.24, sz * 1.24);
}
function drawChips(view, vis) {
  if (view.phase !== 'play' || vis <= 0.01) return;
  buildChips(view);
  const x0 = 34, y0 = 262 - topExtra;
  for (let i = 0; i < chipList.length; i++) {
    const { key } = chipList[i], s = SYN[key], c = CHIPS.get(key), col = KIND_COL[s.kind] || KIND_COL.event;
    const pu = c ? c.punch : 0, y = y0 + i * CHIP_GAP;
    const k = 1 + 0.4 * Math.sin(Math.min(1, pu) * Math.PI) * (pu > 0 ? 1 : 0);
    ctx.globalAlpha = vis * 0.92;
    if (pu > 0) { // 톡: 빛 번짐
      additive(true);
      ctx.globalAlpha = vis * pu;
      placeH(x0, y, 1);
      spr(sparkle(col[2]), 0, 0, 90 * pu, 90 * pu);
      additive(false);
      ctx.globalAlpha = vis * 0.92;
    }
    const g = ctx.createLinearGradient(0, -17, 0, 17);
    g.addColorStop(0, col[2]); g.addColorStop(0.46, col[1]); g.addColorStop(0.52, col[0]); g.addColorStop(1, col[0]);
    // 이름표: 늘 붙어 있는 작은 이름 칩(아이콘 + 이름 한 줄) — 재발동하면 밝아지며 톡
    const hot = c && c.label > 0 ? Math.min(1, c.label / 0.3) : 0;
    ctx.globalAlpha = vis * (0.8 + 0.2 * hot);
    placeH(x0 + 22, y, 1);
    ctx.font = `15px ${FONT}`;
    const tw = ctx.measureText(s.name).width + 18;
    rr(0, -12, tw, 24, 12);
    ctx.fillStyle = 'rgba(20,8,34,0.78)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = hot > 0 ? col[2] : 'rgba(255,255,255,0.18)'; ctx.stroke();
    txt(s.name, 10, 1, 15, hot > 0 ? '#ffffff' : '#e8e0ff', '#22163a', 4, 'left');
    // 아이콘 타일을 이름표 위에 다시 얹는다(겹침 순서)
    placeH(x0, y, k);
    rr(-17, -17, 34, 34, 10);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#22163a'; ctx.stroke();
    chipIcon(key, 24);
  }
  ctx.globalAlpha = 1;
  ht();
}

// ── 보스 체력바: 초상 배지 + 이름 + % + 10칸 눈금 (ART §4.5). 오른쪽 영웅 버튼 자리는 비운다 ──
let bossIntro = 0, bossType = '', bossR = 60;
function drawBossBar(view) {
  const b = view.phase === 'play' ? view.boss : null; // 클리어·패배 화면에선 보스바를 거둔다
  if (b && b.maxHp > 0) {
    const ratio = clamp(b.hp / b.maxHp, 0, 1);
    if (b.name !== bossName) bossIntro = 0;
    if (b.name !== bossName || ratio > bossLag + 0.001) { bossName = b.name; bossLag = ratio; }
    bossLag = Math.max(ratio, bossLag - Math.max(0.01, (bossLag - ratio) * 2.2) * frameDt); // 흰 '최근 피해' 조각이 따라 줄어듦
    bossA = Math.min(1, bossA + 5 * frameDt);
    bossIntro = Math.min(1, bossIntro + frameDt / 0.7);
    const e = view.enemies.find(q => q.named && !q.dead) || view.enemies.find(q => q.isBoss && !q.dead); // 초상 = 네임드 보스 자신의 스프라이트
    if (e) { bossType = e.type; bossR = e.r; bossNamed = !!e.named; }
  } else {
    bossA = Math.max(0, bossA - 3.5 * frameDt);
    if (bossA <= 0) return;
  }
  const named = bossNamed;
  const ratio = b && b.maxHp > 0 ? clamp(b.hp / b.maxHp, 0, 1) : 0;
  const ei = easeOut(bossIntro), shown = ratio * ei, lag = Math.max(shown, bossLag * ei);
  const L = 16, R = 582, x = 90, w = R - 12 - x, y = 118, h = 20, cy = 122;
  placeH(-(1 - ei) * 40, -topExtra, 1); // DOM HUD 바로 아래, 왼쪽에서 미끄러져 들어오며 차오름
  ctx.globalAlpha = bossA;
  const low = ratio < 0.5 && ratio > 0;
  ctx.fillStyle = 'rgba(22,8,34,0.92)';
  rr(L, 94, R - L, 58, 18); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#22163a'; ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = low ? `rgba(255,80,110,${0.55 + 0.45 * Math.sin(RT * 8)})` : named ? '#ff6a8a' : '#ffb04a';
  rr(L + 3, 97, R - L - 6, 52, 15); ctx.stroke();
  // 초상 배지 (금 테 원 + 보스 스프라이트)
  ctx.save();
  ctx.beginPath(); ctx.arc(53, cy, 27, 0, TAU); ctx.clip();
  const bg = ctx.createRadialGradient(53, cy - 8, 2, 53, cy, 30);
  bg.addColorStop(0, named ? '#b0305a' : '#b06a20'); bg.addColorStop(1, named ? '#3a0820' : '#3a1a06');
  ctx.fillStyle = bg; ctx.fillRect(20, cy - 30, 66, 60);
  if (bossType) {
    const img = enemy(bossType, bossR, 'n', bossNamed ? 'b' : 'e');
    const k = 46 / Math.max(img.hw, img.hh);
    ctx.drawImage(img, 53 - img.hw * k, cy - img.hh * k + 10, img.hw * 2 * k, img.hh * 2 * k);
  }
  ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = '#22163a'; ctx.beginPath(); ctx.arc(53, cy, 29, 0, TAU); ctx.stroke();
  ctx.lineWidth = 3.5; ctx.strokeStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(53, cy, 27, 0, TAU); ctx.stroke();
  // 여러 겹 체력(xN): 네임드 10겹 · 엘리트 3겹 — 한 겹씩 색이 바뀌며 깎여 진행이 보인다
  const N = named ? 10 : 3, lay = Math.max(1, Math.ceil(shown * N - 1e-6)), f = clamp(shown * N - (lay - 1), 0, 1);
  const lf = clamp(lag * N - (lay - 1), f, 1);
  // 이름 · 겹수 · %
  txt(bossName, x + 2, 104, 17, named ? '#ffe0ea' : '#ffe8c0', '#10040e', 5, 'left');
  ctx.font = `17px ${NUM_FONT}`; ctx.textAlign = 'right';
  const pct = Math.ceil(ratio * 100) + '%';
  ctx.lineWidth = 5; ctx.strokeStyle = '#10040e'; ctx.strokeText(pct, x + w, 104);
  ctx.fillStyle = '#ffffff'; ctx.fillText(pct, x + w, 104);
  if (ratio > 0) {
    const pw = ctx.measureText(pct).width;
    ctx.font = `20px ${NUM_FONT}`;
    const ls = 'x' + lay, lw = ctx.measureText(ls).width;
    ctx.lineWidth = 5; ctx.strokeStyle = '#10040e'; ctx.strokeText(ls, x + w - pw - 10, 103);
    ctx.fillStyle = LAYER_COL[(lay - 1) % LAYER_COL.length][0]; ctx.fillText(ls, x + w - pw - 10, 103);
    void lw;
  }
  // 바: 아래 겹 색(바탕) → 흰 최근 피해 조각 → 현재 겹 색
  rr(x, y, w, h, 8); ctx.fillStyle = '#2a0814'; ctx.fill();
  ctx.save(); rr(x, y, w, h, 8); ctx.clip();
  const layerFill = (c, fx) => {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, c[0]); g.addColorStop(0.46, c[1]); g.addColorStop(0.5, c[2]); g.addColorStop(1, c[2]);
    ctx.fillStyle = g; ctx.fillRect(x, y, w * fx, h);
  };
  if (lay > 1 && ratio > 0) { layerFill(LAYER_COL[(lay - 2) % LAYER_COL.length], 1); ctx.fillStyle = 'rgba(20,4,16,0.35)'; ctx.fillRect(x, y, w, h); }
  if (ratio > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(x, y, w * lf, h);
    layerFill(LAYER_COL[(lay - 1) % LAYER_COL.length], f);
  }
  const shownW = ratio > 0 ? f : 0;
  if (b && b.shield > 0) {
    const sw = w * clamp(b.shield / b.maxHp, 0, 1 - ratio + 0.2);
    const sx = Math.min(x + w * shownW, x + w - sw);
    ctx.fillStyle = 'rgba(120,240,255,0.85)'; ctx.fillRect(sx, y, sw, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = sx - 10 + ((RT * 30) % 10); k < sx + sw; k += 10) { ctx.moveTo(Math.max(sx, k), y + h); ctx.lineTo(Math.min(sx + sw, k + 8), y); }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y + 2, w * shownW, 4);
  ctx.fillStyle = 'rgba(20,4,16,0.55)';
  for (let k = 1; k < 10; k++) ctx.fillRect(x + w * k / 10 - 1, y, 2, h);
  ctx.restore();
  rr(x, y, w, h, 8); ctx.lineWidth = 2.5; ctx.strokeStyle = '#22163a'; ctx.stroke();
  ctx.globalAlpha = 1;
  ht();
}

// 콤보 카운터(오른쪽 중단, 전용 세로 칸 y 520~660): 킬마다 톡, 단계가 오르면 1→1.4→1 back 슬램 + 단계 색 링.
// 그 위 칸(y 440~500)은 광란·전설 상태 알약(남은 시간 바) — 도장·조합 줄과 자리를 나눠 겹치지 않는다.
let frMax = FRENZY.dur, lgMax = LEGEND_T;
// 보스 체력 겹 색 [밝음, 메인, 어둠] — 마지막 겹(x1)은 붉은색
const LAYER_COL = [['#ff9ab4', '#ff5a80', '#c0103a'], ['#ffd89a', '#ffa040', '#c05a00'], ['#fff3a0', '#ffd23a', '#c08a00'], ['#c8ff9a', '#6ad84a', '#2a8a1a'], ['#b8f4ff', '#4fc8ff', '#1a70c0'], ['#e0c8ff', '#b07aff', '#6a2ac0']];
const CX = 662; // 콤보·상태 알약 오른쪽 끝(월드 폭 720 — 가장자리에서 58 안쪽, 테두리·기울임 포함 여백)
function drawCombo(view, vis) {
  if (combo.a > 0) {
    const x = CX, y = 580, tier = clamp(combo.tier, 0, 4);
    const col = tier >= 4 ? `hsl(${42 + 14 * Math.sin(RT * 7)},100%,${62 + 10 * Math.sin(RT * 11)}%)` : TIER_COL[tier]; // 전설: 금빛 일렁임
    const a = combo.a * vis;
    const u = 1 - combo.tierPunch; // 단계 슬램: 0.3초에 1.4(전설 1.6)까지 → back 으로 1
    const peak = tier >= 4 ? 0.6 : 0.4;
    const ts = combo.tierPunch > 0 ? (u < 0.3 ? 1 + peak * easeOut(u / 0.3) : 1 + peak * (1 - easeBack((u - 0.3) / 0.7))) : 1;
    const size = 50 + tier * 7, str = 'x' + combo.shown; // 단계마다 글자가 커지고 색이 바뀐다
    ctx.font = `${size}px ${NUM_FONT}`; ctx.textAlign = 'right';
    const tw = ctx.measureText(str).width;
    const drop = (1 - combo.a) * 30;
    if (tier >= 3) { // x50·x100: 숫자 뒤 불꽃/에너지 후광(가산, 회전 광선)
      additive(true);
      ctx.globalAlpha = a * (0.45 + 0.15 * Math.sin(RT * 8));
      placeH(x - tw / 2, y + drop, ts);
      ctx.rotate(RT * 0.9);
      spr(rays(tier >= 4 ? '#ffd23a' : '#ff5a2a'), 0, 0, tw + 90, tw + 90);
      additive(false);
    }
    ctx.globalAlpha = a;
    placeH(x, y + drop, (1 + combo.punch * 0.16) * ts); // 한 킬마다 톡
    txt('COMBO', 0, -size * 0.72, 19, '#ffffff', '#1a0612', 5, 'right');
    ctx.font = `${size}px ${NUM_FONT}`; ctx.textAlign = 'right';
    if (tier >= 2) { ctx.lineWidth = 12; ctx.strokeStyle = '#ffffff'; ctx.strokeText(str, 0, 0); }
    ctx.lineWidth = 8; ctx.strokeStyle = '#1a0612'; ctx.strokeText(str, 0, 0);
    const g = ctx.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, tier ? '#ffffff' : '#fff6e6'); g.addColorStop(0.5, col); g.addColorStop(1, col);
    ctx.fillStyle = tier ? g : '#ffffff'; ctx.fillText(str, 0, 0);
    if (tier > 0 && COMBO_TIERS[tier - 1]) {
      placeH(x, y + size * 0.62 + 18 + drop, 1 + combo.tierPunch * 0.5);
      ctx.rotate(-0.05);
      txt(COMBO_TIERS[tier - 1].label, 0, 0, 24 + tier * 3, col, '#1a0612', 7, 'right');
    }
    const c = view.combo; // 남은 시간 바
    if (c && c.count >= 3) {
      ht();
      const bw = 120, uu = clamp(c.timer / COMBO_WINDOW, 0, 1), by = y + size * 0.5;
      ctx.fillStyle = 'rgba(20,6,20,0.6)';
      rr(x - bw - 2, by, bw + 4, 10, 5); ctx.fill();
      ctx.fillStyle = col;
      rr(x - bw * uu, by + 2, Math.max(4, bw * uu), 6, 3); ctx.fill();
    }
    numZone('combo', x - 110, y + 10, 240, 150);
  }
  ht();
  // 광란 / 전설 상태 알약 (아이콘 + 이름 + 남은 시간 바)
  let ly = 472;
  if (view.frenzyT > 0) { frMax = Math.max(frMax, view.frenzyT); statusPill(ly, '광란 시전 x2', 'el-fire', '#ff6a3a', view.frenzyT / frMax, vis, 14); ly -= 46; }
  else frMax = FRENZY.dur;
  if (view.legendT > 0) { lgMax = Math.max(lgMax, view.legendT); statusPill(ly, '전설의 학살 골드 x2', 'coin', '#ffd23a', view.legendT / lgMax, vis, 8); ly -= 46; }
  else lgMax = LEGEND_T;
  if (view.berserk > 1 && view.phase === 'play') { // 광폭화: 적 피해 배율 + 다음 2배까지 남은 시간
    const m = view.berserk, lab = '광폭화 적 피해 x' + (m < 10 ? m.toFixed(1) : Math.round(m));
    statusPill(ly, lab, 'el-fire', '#ff3a3a', 1 - (((view.phaseT || 0) - 80) % 10) / 10, vis, 6);
  }
  ctx.globalAlpha = 1;
}
function statusPill(y, label, ico, col, u, vis, hz) {
  ctx.font = `18px ${FONT}`;
  const tw = ctx.measureText(label).width + 58, x = CX + 4 - tw;
  ctx.globalAlpha = vis;
  placeH(x + tw / 2, y, 1 + 0.04 * Math.sin(RT * hz));
  rr(-tw / 2, -18, tw, 36, 18);
  ctx.fillStyle = 'rgba(24,8,30,0.92)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#22163a'; ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = col; rr(-tw / 2 + 3, -15, tw - 6, 30, 15); ctx.stroke();
  ctx.fillStyle = col; rr(-tw / 2 + 36, 9, (tw - 50) * clamp(u, 0, 1), 4, 2); ctx.fill(); // 남은 시간
  const im = iconImage(ico);
  if (im) ctx.drawImage(im, -tw / 2 + 4, -15, 30, 30);
  txt(label, -tw / 2 + 38, -2, 18, '#ffffff', '#1a0612', 5, 'left');
  ht();
}

// 접힌 끝 리본 (캔버스) — kit.css .k-ribbon 과 같은 모양. (cx, cy) 기준 로컬 좌표
function ribbon(cx, cy, w, h, top, bot, lip) {
  const l = cx - w / 2;
  for (const sd of [-1, 1]) {
    const ix = sd < 0 ? l + 8 : l + w - 8, ex = sd < 0 ? l - 20 : l + w + 20;
    ctx.beginPath();
    ctx.moveTo(ix, cy - h / 2 + 10); ctx.lineTo(ex, cy - h / 2 + 10); ctx.lineTo(ex - sd * 9, cy + 10); ctx.lineTo(ex, cy + h / 2 + 10); ctx.lineTo(ix, cy + h / 2 + 10);
    ctx.closePath();
    ctx.fillStyle = lip; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#22163a'; ctx.stroke();
  }
  rr(l, cy - h / 2, w, h, 12);
  const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  g.addColorStop(0, top); g.addColorStop(0.5, top); g.addColorStop(0.54, bot); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = '#22163a'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; rr(l + 8, cy - h / 2 + 4, w - 16, 3, 1.5); ctx.fill();
}
const midY = () => 430 - topExtra * 0.45; // 보이는 전장의 가운데쯤 (HUD 좌표)

// 보스 경고: 어두워짐 → 경고 띠 슬램 → 이름 (무겁게, 오버슈트 없이 — ART §7.2)
function drawBanner(m) {
  const t = m.t, a = t < 0.2 ? t / 0.2 : t > m.life - 0.3 ? Math.max(0, (m.life - t) / 0.3) : 1;
  ctx.globalAlpha = a * 0.28;
  ctx.fillStyle = m.named ? '#1a0008' : '#140a00';
  fillView();
  ctx.globalAlpha = a;
  const y = midY() + 150; // 보스(HUD 아래 y 170~390에 착지)를 가리지 않게 아래쪽 띠
  numZone('banner', 360, y, 720, 170);
  if (m.named) { // 마법 봉인 띠: 룬 테두리 + 회전 마법진 속 보스 실루엣 → 빛이 들어오며 정체 공개 + 이름
    const k = t < 0.22 ? easeOut(t / 0.22) : 1, hh = 74 * k;
    const g = ctx.createLinearGradient(0, y - hh, 0, y + hh);
    g.addColorStop(0, 'rgba(30,4,20,0.95)'); g.addColorStop(0.5, 'rgba(92,10,40,0.95)'); g.addColorStop(1, 'rgba(30,4,20,0.95)');
    ctx.fillStyle = g; ctx.fillRect(0, y - hh, WORLD_W, hh * 2);
    const rb = runeBand('#ffb04a'), off = (RT * 40) % 48;
    ctx.globalAlpha = a * k;
    ctx.drawImage(rb, -48 + off, y - hh - 12, 820, 24);
    ctx.drawImage(rb, -off, y + hh - 12, 820, 24);
    // 마법진 + 보스 초상 (실루엣 → 공개)
    const px = 128, reveal = clamp((t - 0.45) / 0.4, 0, 1), ps = t < 0.3 ? easeBack(t / 0.3) : 1;
    additive(true);
    ctx.globalAlpha = a * 0.9;
    placeH(px, y, ps); ctx.rotate(RT * 0.8);
    spr(runeCircle('#ff5a7a'), 0, 0, 170, 170);
    ctx.rotate(-RT * 1.9); ctx.globalAlpha = a * 0.5;
    spr(rays('#ff3a5a'), 0, 0, 260, 260);
    additive(false);
    ht();
    if (m.type) {
      const img = enemy(m.type, m.r || 60, 'n', 'b'), sc = 112 / Math.max(img.hw, img.hh) * ps;
      ctx.save(); ctx.beginPath(); ctx.arc(px, y, 64 * ps, 0, TAU); ctx.clip();
      ctx.fillStyle = 'rgba(20,0,10,0.85)'; ctx.fillRect(px - 70, y - 70, 140, 140);
      ctx.globalAlpha = a;
      ctx.drawImage(img, px - img.hw * sc, y - img.hh * sc + 16, img.hw * 2 * sc, img.hh * 2 * sc);
      if (reveal < 1) { ctx.globalAlpha = a * (1 - reveal); ctx.drawImage(tint(img, 'h:sil|' + m.type + '|' + (m.r || 60), '#14020c', 1), px - img.hw * sc, y - img.hh * sc + 16, img.hw * 2 * sc, img.hh * 2 * sc); }
      ctx.restore();
      ctx.globalAlpha = a;
      ctx.lineWidth = 7; ctx.strokeStyle = '#22163a'; ctx.beginPath(); ctx.arc(px, y, 66 * ps, 0, TAU); ctx.stroke();
      ctx.lineWidth = 4; ctx.strokeStyle = '#ffc94a'; ctx.beginPath(); ctx.arc(px, y, 63 * ps, 0, TAU); ctx.stroke();
    }
    // 글자: 작은 경고 문구 → 이름 슬램(무겁게, 오버슈트 없이)
    const ta = clamp((t - 0.2) / 0.2, 0, 1), s2 = t < 0.34 ? 1.35 - 0.35 * clamp((t - 0.2) / 0.14, 0, 1) : 1;
    ctx.globalAlpha = a * ta;
    txt('강력한 적이 나타났다!', 432, y - 34, 20, '#ffd27a', '#2a0010', 6);
    placeH(432, y + 12, s2);
    ctx.font = `46px ${NUM_FONT}`; ctx.textAlign = 'center';
    ctx.lineWidth = 12; ctx.strokeStyle = '#2a0010'; ctx.strokeText(m.name, 0, 0);
    const ng = ctx.createLinearGradient(0, -22, 0, 22);
    ng.addColorStop(0, '#ffffff'); ng.addColorStop(0.5, '#ffe0ea'); ng.addColorStop(0.53, '#ff7a9a'); ng.addColorStop(1, '#ff4a70');
    ctx.fillStyle = ng; ctx.fillText(m.name, 0, 0);
  } else {
    const k = t < 0.2 ? easeBack(t / 0.2) : 1;
    placeH(360, y, k);
    ribbon(0, 0, 340, 58, '#ffb86a', '#e0600a', '#8a3000');
    txt(m.name + ' 등장!', 0, 2, 30, '#ffffff', '#3a1400', 7);
  }
  ht();
  ctx.globalAlpha = 1;
}

function wrap(str, maxW, size, font = FONT) {
  ctx.font = `${size}px ${font}`;
  const out = [];
  let line = '';
  for (const ch of str) {
    if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ch.trim(); } else line += ch;
  }
  if (line) out.push(line);
  return out;
}

const FUSE_PRE = 0.5;
function drawFusePre(m, parts) {
  const u = Math.min(1, m.t / FUSE_PRE), e = u * u * u, cy = midY() - 70;
  ctx.globalAlpha = Math.min(1, m.t / 0.2) * 0.74;
  ctx.fillStyle = '#0a0418';
  fillView();
  for (let i = 0; i < 2; i++) {
    const em = emblem(parts[i], 1.6);
    if (!em) continue;
    const x = lerp(i ? 600 : 120, 360, e), y = cy - Math.sin(u * Math.PI) * 60, s = 104 - 30 * e;
    additive(true);
    ctx.globalAlpha = 0.8;
    placeH(x, y, 1); spr(sparkle('#ffffff'), 0, 0, s * 1.3, s * 1.3);
    additive(false);
    ctx.globalAlpha = 1;
    placeH(x, y, 1); ctx.rotate((i ? 1 : -1) * u * 3);
    ctx.drawImage(em, -s / 2, -s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  ht();
}

// 히든 조합 발견 — 중앙 엠블럼(회전 후광 + 룬 서클 + 색 타일 아이콘) 슬램 → 리본 + 이름 + 효과 → 도감(메뉴) 버튼으로 날아감
function drawCut(m) {
  const s = m.s, life = m.life, parts = s.kind === 'fusion' ? fusionParts(s.key) : null;
  const pre = parts ? FUSE_PRE : 0, t = m.t - pre; // 융합: 앞 0.5초는 두 스킬 엠블럼이 양쪽에서 날아와 합쳐진다
  if (t < 0) { drawFusePre(m, parts); return; }
  const col = KIND_COL[s.kind] || KIND_COL.event;
  // out 이후 엠블럼이 메뉴(도감) 버튼으로 날아감
  const out = life - pre - 0.5, env = pre ? (t > out ? Math.max(0, 1 - (t - out) / 0.5) : 1) : t < 0.2 ? t / 0.2 : t > out ? Math.max(0, 1 - (t - out) / 0.5) : 1;
  const cy = midY(), ex = 690, ey = 34 - topExtra; // 메뉴 버튼 (HUD 우상단)
  ctx.globalAlpha = env * 0.74;
  ctx.fillStyle = '#0a0418';
  fillView();
  ctx.globalAlpha = 1;
  const fu = t > out ? easeOut(Math.min(1, (t - out) / 0.5)) : 0;
  const k = t < 0.3 ? easeBack(t / 0.3) : 1;
  const px = lerp(360, ex, fu), py = lerp(cy - 70, ey, fu), es = k * (1 - fu * 0.78);
  // 후광 + 룬 (가산)
  additive(true);
  ctx.globalAlpha = env * 0.8;
  placeH(px, py, es);
  ctx.rotate(RT * 0.6);
  spr(rays(col[2]), 0, 0, 460, 460);
  ctx.rotate(-RT * 1.5);
  ctx.globalAlpha = (1 - fu) * env * 0.9;
  spr(runeCircle(col[2]), 0, 0, 250, 250);
  additive(false);
  // 색 타일
  placeH(px, py, es);
  ctx.globalAlpha = 1;
  ctx.rotate(-0.08 + 0.03 * Math.sin(RT * 3));
  rr(-62, -62, 124, 124, 26);
  const g = ctx.createLinearGradient(0, -62, 0, 62);
  g.addColorStop(0, col[2]); g.addColorStop(0.48, col[1]); g.addColorStop(0.52, col[0]); g.addColorStop(1, col[0]);
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#22163a'; ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = '#ffe27a'; rr(-55, -55, 110, 110, 21); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(-48, -51, 96, 7, 3.5); ctx.fill();
  const em = emblem(s.key, 2.2);
  if (em) ctx.drawImage(em, -64, -64, 128, 128);
  ht();
  // 글자 (엠블럼이 떠나기 전까지)
  const ta = t < 0.25 ? 0 : t < 0.45 ? (t - 0.25) / 0.2 : t > out ? Math.max(0, 1 - (t - out) / 0.2) : 1;
  if (ta > 0) {
    ctx.globalAlpha = ta;
    const rk = t < 0.45 ? easeBack(Math.min(1, (t - 0.25) / 0.2)) : 1;
    placeH(360, cy + 26, rk);
    ribbon(0, 0, 300, 46, '#ffe45a', '#ffb21a', '#c26a00');
    txt(s.kind === 'fusion' ? '원소 융합 발견!' : s.kind === 'collab' ? '협공 발견!' : '히든 조합 발견!', 0, 1, 24, '#ffffff', '#7a3a00', 6);
    ht();
    ctx.globalAlpha = ta;
    ctx.font = `50px ${NUM_FONT}`; ctx.textAlign = 'center';
    ctx.lineWidth = 12; ctx.strokeStyle = '#22163a'; ctx.strokeText(s.name, 360, cy + 90);
    const ng = ctx.createLinearGradient(0, cy + 66, 0, cy + 114);
    ng.addColorStop(0, '#fffbe0'); ng.addColorStop(0.5, '#fffbe0'); ng.addColorStop(0.53, '#ffc92e'); ng.addColorStop(1, '#ffb020');
    ctx.fillStyle = ng; ctx.fillText(s.name, 360, cy + 90);
    const desc = String(s.desc || ''), ci = desc.indexOf(':');
    const effect = ci >= 0 ? desc.slice(ci + 1).trim() : desc, cond = ci >= 0 ? desc.slice(0, ci).trim() : '';
    const lines = wrap(effect, 600, 21, BODY_FONT).slice(0, 2);
    ctx.font = `21px ${BODY_FONT}`;
    lines.forEach((ln, i) => {
      ctx.lineWidth = 6; ctx.strokeStyle = '#140a24'; ctx.strokeText(ln, 360, cy + 140 + i * 28);
      ctx.fillStyle = '#ffffff'; ctx.fillText(ln, 360, cy + 140 + i * 28);
    });
    if (s.kind === 'fusion') { // 두 스킬이 하나로 → 슬롯 1칸이 열린다
      const sy = cy + 150 + lines.length * 28, sk = 1 + 0.08 * Math.sin(RT * 8);
      placeH(360, sy, sk);
      ribbon(0, 0, 210, 40, '#7affc8', '#20c080', '#0a6a44');
      txt('슬롯 해제!', 0, 1, 22, '#ffffff', '#064a2e', 6);
      ht();
    } else if (cond) txt('조건 · ' + wrap(cond, 580, 15)[0], 360, cy + 146 + lines.length * 28, 15, '#d8c8ff', '#140a24', 4);
  }
  ctx.globalCompositeOperation = 'lighter'; // 반짝이
  for (let i = 0; i < 10; i++) {
    const sx = 80 + ((i * 131) % 560), sy = cy - 190 + ((i * 53) % 230), tw = Math.sin(RT * 7 + i * 1.7);
    if (tw <= 0) continue;
    ctx.globalAlpha = tw * env;
    spr(sparkle(i % 2 ? '#ffe68a' : col[2]), sx, sy, 26 * tw, 26 * tw);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ht();
}

// 전설 장비 획득: 회전 후광 + 등급 프레임 카드(큰 아이콘) 팝 + 리본 + 이름 → 영웅(가방) 버튼으로 날아감 (빛기둥은 world.js)
function drawLootBanner(m) {
  const t = m.t, life = m.life, out = life - 0.45;
  const k = t < 0.3 ? easeBack(t / 0.3) : 1, fu = t > out ? easeOut(Math.min(1, (t - out) / 0.45)) : 0;
  const a = t < 0.12 ? t / 0.12 : 1, cy0 = midY() - 110;
  const cx = lerp(360, BAG_POS.x, fu * fu), cy = lerp(cy0, BAG_POS.y, fu), cs = k * (1 - 0.8 * fu);
  numZone('loot', 360, cy0 + 20, 420, 380);
  ctx.globalAlpha = a * 0.55 * (1 - fu);
  ctx.fillStyle = '#0a0418'; fillView();
  additive(true);
  placeH(cx, cy, cs); ctx.rotate(RT * 0.5);
  ctx.globalAlpha = a * 0.85;
  spr(rays('#ffd23a'), 0, 0, 520, 520);
  ctx.rotate(-RT * 1.2); ctx.globalAlpha = a * 0.6;
  spr(runeCircle('#ffd23a'), 0, 0, 300, 300);
  additive(false);
  // 카드: 전설 3단 프레임 + 안쪽 방사광 + 아이콘
  placeH(cx, cy, cs);
  ctx.globalAlpha = a;
  ctx.rotate(-0.05 + 0.02 * Math.sin(RT * 3));
  rr(-92, -112, 184, 224, 24);
  const fg = ctx.createLinearGradient(-92, -112, 92, 112);
  fg.addColorStop(0, '#fff0b8'); fg.addColorStop(0.45, '#ffb020'); fg.addColorStop(0.46, '#e08a00'); fg.addColorStop(1, '#a65200');
  ctx.fillStyle = fg; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#22163a'; ctx.stroke();
  rr(-78, -98, 156, 196, 16);
  const ig = ctx.createRadialGradient(0, -20, 6, 0, 0, 130);
  ig.addColorStop(0, '#fff6c8'); ig.addColorStop(0.45, '#c86a10'); ig.addColorStop(1, '#3a1400');
  ctx.fillStyle = ig; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#6b3300'; ctx.stroke();
  if (m.item) {
    const ic = itemIcon(m.item.slot, m.item.rarity, m.cls, 4.4, true);
    ctx.drawImage(ic, -70, -80, 140, 140);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; rr(-70, -93, 140, 6, 3); ctx.fill();
  const sw = ((RT * 0.8) % 1.6) - 0.3; // 반짝 스윕
  if (sw < 1) {
    ctx.save(); rr(-78, -98, 156, 196, 16); ctx.clip();
    ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#ffffff';
    const sx = -160 + sw * 320;
    ctx.beginPath(); ctx.moveTo(sx, -110); ctx.lineTo(sx + 36, -110); ctx.lineTo(sx - 24, 110); ctx.lineTo(sx - 60, 110); ctx.fill();
    ctx.restore();
  }
  ht();
  // 리본 + 이름 (카드가 날아가기 전까지)
  const ta = (t < 0.2 ? 0 : Math.min(1, (t - 0.2) / 0.15)) * (1 - Math.min(1, fu * 3));
  if (ta > 0) {
    ctx.globalAlpha = ta;
    placeH(360, cy0 - 132, t < 0.35 ? easeBack(Math.min(1, (t - 0.2) / 0.15)) : 1);
    ribbon(0, 0, 280, 54, '#ffe45a', '#ffb21a', '#c26a00');
    ctx.font = `32px ${NUM_FONT}`; ctx.textAlign = 'center';
    ctx.lineWidth = 8; ctx.strokeStyle = '#7a3a00'; ctx.strokeText('전설 획득!', 0, 2);
    ctx.fillStyle = '#ffffff'; ctx.fillText('전설 획득!', 0, 2);
    ht();
    ctx.font = `24px ${FONT}`;
    const nw = ctx.measureText(m.name).width + 44;
    ctx.globalAlpha = ta;
    rr(360 - nw / 2, cy0 + 126, nw, 44, 22);
    ctx.fillStyle = 'rgba(30,10,4,0.92)'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#ffd23a'; ctx.stroke();
    txt(m.name, 360, cy0 + 149, 24, '#fff0b8', '#3a1a00', 6);
  }
  ctx.globalCompositeOperation = 'lighter'; // 반짝이
  for (let i = 0; i < 8; i++) {
    const tw = Math.sin(RT * 6 + i * 2.1);
    if (tw <= 0) continue;
    ctx.globalAlpha = tw * a * (1 - fu);
    spr(sparkle(i % 2 ? '#ffe68a' : '#ffffff'), 360 + Math.cos(i * 0.8) * 150, cy0 + Math.sin(i * 1.9) * 120, 30 * tw, 30 * tw);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ht();
}

// ═════════════ 이벤트 → HUD 연출 ═════════════
export function events(view, evs, opts) {
  for (const ev of evs) {
    switch (ev.type) {
      case 'bossSpawn': {
        // 진행 중인 컷인·전설 배너는 잠깐 뒤로 밀고 경고부터
        if (moment && moment.kind !== 'boss') { MQ.unshift({ ...moment, t: Math.min(moment.t, 0.3) }); moment = null; }
        const be = view.enemies.find(q => q.isBoss && q.name === ev.name) || view.enemies.find(q => q.isBoss);
        MQ.unshift({ kind: 'boss', name: String(ev.name || ''), named: !!ev.named, type: be ? be.type : '', r: be ? be.r : 60, t: 0, life: ev.named ? MOMENT_LIFE.boss : 1.3 });
        shake(ev.named ? 0.35 : 0.12);
        flash(ev.named ? 0.3 : 0.12, ev.named ? '#ff2040' : '#ff9a30');
        break;
      }
      case 'boom': if (ev.kind === 'meteor') meteorRT = RT; break;
      case 'slowmo': slowUntil = RT + clamp(+ev.ms || 0, 0, 1500) / 1000; slowK = clamp(+ev.scale || 0.3, 0.1, 1); break;
      case 'linkFinish': stamp('합동 필살!', '#ffb8ec', 300, 84, 1.0); break;
      case 'fusionMerge': // 첫 발견이면 컷인이 '슬롯 해제!'를 말한다. 다시 합체하면 알림 알약만
        if (!evs.some(e => e.type === 'synergy' && e.key === ev.fusion && e.first)) pop('슬롯 해제!', (SYN[ev.fusion] ? SYN[ev.fusion].name : '') + ' 합체', '#ffc8ff', 300, 846); // 내 마법사 머리 위(합체 줄기가 닿는 곳)
        break;
      case 'allySpell': { // AI 동료가 네임드 보스를 잡고 새 주문을 익혔다
        const sp = SPELL_BY_KEY[ev.spell];
        pop('AI 동료 새 주문!', (sp ? sp.name : '') + ' Lv' + (ev.level | 0), '#8fe8ff', 480, 780);
        break;
      }
      case 'combo': {
        combo.tierPunch = 1;
        if (quiet || moment) break;
        const col = ev.tier >= 4 ? '#ffd23a' : TIER_COL[clamp(ev.tier | 0, 0, 3)] || '#ffd23a';
        burst(K_STAR, CX - 50, 580, 10 + ev.tier * 4, 80, 320, 0.7, 20, [col, '#ffffff'], 200, 1.5, 60);
        if (ev.tier >= 4) ring(CX - 60, 575, 20, 170, 0.45, '#ffd23a', 8); // x100: 카운터 자리 금빛 고리 하나
        if (ev.tier >= 3) shake(0.15);
        break;
      }
      case 'synergy': {
        const s = SYN[ev.key];
        if (!s) break;
        // 콤보 x100(전설의 학살)은 카운터의 x100 슬램이 먼저 보이고 0.45초 뒤 컷인(원인과 결과가 끊기지 않게)
        if (ev.first) MQ.push({ kind: 'cut', s, t: 0, life: MOMENT_LIFE.cut + (s.kind === 'fusion' ? FUSE_PRE : 0), hold: ev.key === 'legend' ? 0.45 : 0 });
        if (ev.key !== 'frenzy') chipHit(ev.key, ev.o === 0 || ev.o === 1 ? ev.o : -1); // 광란은 '광란!' 도장이 말해 준다
        break;
      }
      case 'loot':
        if (ev.item && ev.item.rarity === 'legend') MQ.push({ kind: 'loot', name: String(ev.item.name || ''), item: ev.item, cls: (view.hero && view.hero.cls) || 'knight', t: 0, life: MOMENT_LIFE.loot });
        break;
      case 'heroLevelUp': {
        const h = view.heroUnit, x = h ? h.x : 360, y = h ? h.y + 14 : WALL_Y - 20;
        const L = take(LVUPS);
        L.on = true; L.t = 0; L.x = x; L.y = y; L.level = ev.level | 0; L.ms = ev.milestone || null;
        lightBeam(x, 80, y - 360, y + 6, 1.1, '#fff6d0', '#ffc92e');
        for (let k = 0; k < 3; k++) ring(x, y - 30, 10 + k * 16, 90 + k * 50, 0.5 + k * 0.15, k === 1 ? '#ffffff' : '#ffd23a', 8 - k * 2);
        sprPop(runeCircle('#ffd23a'), x, y, 0.5, 2, 0.9, Math.PI / 2, 2.5, 0.38);
        burst(K_STAR, x, y - 40, 22, 100, 360, 0.9, 18, ['#ffffff', '#ffe07a', '#ffb020'], -80, 1.6, 120);
        shake(0.12);
        flash(0.15, '#ffe07a');
        break;
      }
    }
  }
}

// ═════════════ 갱신 ═════════════
export function update(view, da, dt) {
  FLOOR.t += dt;
  if (view.stage !== lastFloor) { // 새 층(도전 시작 포함)
    const th = clamp(view.theme | 0, 0, 4);
    if (view.phase === 'play') { FLOOR.t = 0; FLOOR.stage = view.stage | 0; FLOOR.newTheme = th !== FLOOR.theme && lastFloor > 0; FLOOR.theme = th; }
    lastFloor = view.stage;
  }
  if (!moment) for (const s of STAMPS) if (s.life > 0) { if (s.delay > 0) s.delay -= dt; else s.life -= dt; } // 연출 중엔 멈춤 → 끝나면 보인다
  for (const p of POPS) if (p.life > 0) p.life -= dt;
  for (const c of CHIPS.values()) { c.punch = Math.max(0, c.punch - dt * 3.2); c.label = Math.max(0, c.label - dt); }
  if (view.phase !== 'play' && CHIPS.size) CHIPS.clear();
  for (const m of MQ) if (m.hold > 0) m.hold -= dt;
  if (++domChk % 6 === 0 || quiet) quiet = view.phase !== 'play' || !!view.pick || domBusy();
  quietA = quiet ? Math.min(1, quietA + dt * 8) : Math.max(0, quietA - dt * 4);
  if (moment && (moment.t += dt * (moment.kind === 'cut' && MQ.some(m => m.kind === 'cut') ? 1.4 : 1)) >= moment.life) { if (moment.kind === 'boss') bossEndRT = RT; moment = null; }
  if (moment && moment.kind !== 'boss' && quiet && moment.t < 0.2) { MQ.unshift(moment); moment = null; } // 막 시작한 컷인은 보류
  if (moment && moment.kind === 'cut' && moment.s.kind === 'fusion' && !moment.merged && moment.t >= FUSE_PRE) { // 두 엠블럼이 합쳐지는 순간
    moment.merged = true;
    const col = (KIND_COL.fusion)[2], y = midY() - 70;
    flash(0.55); shake(0.35);
    ring(WORLD_W / 2, y, 20, 520, 0.6, '#ffffff', 12);
    ring(WORLD_W / 2, y, 10, 360, 0.5, col, 8);
    burst(K_STAR, WORLD_W / 2, y, 30, 150, 700, 0.9, 26, ['#ffffff', '#ffe68a', col], 0, 2.2);
  }
  if (!moment && MQ.length) {
    const i = MQ.findIndex(m => m.kind === 'boss' || (!quiet && !(m.hold > 0) && RT - meteorRT > 0.9)); // 보스 경고는 바로, 나머지는 조용할 때만(운석 착탄 직후 제외)
    if (i >= 0) {
      moment = MQ.splice(i, 1)[0];
      if (moment.t === 0 && moment.kind === 'cut' && moment.s.kind !== 'fusion') {
        const col = (KIND_COL[moment.s.kind] || KIND_COL.event)[2], y = midY() - 70;
        flash(0.5); shake(0.3);
        burst(K_STAR, WORLD_W / 2, y, 34, 150, 700, 0.9, 26, ['#ffffff', '#ffe68a', col], 0, 2.2);
        ring(WORLD_W / 2, y, 20, 480, 0.6, '#ffffff', 10);
      } else if (moment.t === 0 && moment.kind === 'loot') { flash(0.26); flash(0.35, '#ffe07a'); shake(0.2); } // 80ms 흰 섬광
    }
  }
  if (MQ.length > 6) MQ.splice(1, MQ.length - 6); // 폭주 방지
  // 콤보 표시
  const c = view.combo, cnt = c ? c.count | 0 : 0;
  if (cnt >= 3) {
    if (cnt > combo.prev) combo.punch = 1;
    combo.shown = cnt; combo.tier = c.tier | 0; combo.a = 1;
  } else if (combo.a > 0) combo.a = Math.max(0, combo.a - dt * 1.4);
  combo.prev = cnt;
  combo.punch = Math.max(0, combo.punch - dt * 7);
  combo.tierPunch = Math.max(0, combo.tierPunch - dt * 3);
  for (const L of LVUPS) { // 컷인·배너가 떠 있으면 LEVEL UP 은 시작을 미룬다(큰 연출은 한 번에 하나)
    if (!L.on || (moment && L.t < 0.05)) continue;
    if ((L.t += dt) > 1.9) L.on = false;
  }
}

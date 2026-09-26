// 캔버스 HUD 연출 — 보스 체력바·콤보 카운터·광란/전설 표시·도장(빙결!/광란!)·조합 팝업·보스 경고·히든 조합 엠블럼 컷인·전설 획득·LEVEL UP.
// DOM HUD(골드·층·웨이브·마나·메뉴·영웅 버튼)는 ui.js/style.css 몫이고, 여기는 전장 위에 캔버스로 그리는 층만.
// docs/ART.md §4.5, §10.2, §10.8~10.11
// 소유: UI 에이전트(kit.css · 아이콘 · ui.js/heroui.js 와 함께). 계약은 docs/ART.md §14 참고.
import { WORLD_W, WORLD_H, WALL_Y, SYNERGIES, FUSIONS, COMBO_TIERS, COMBO_WINDOW } from '../config.js';
import { clamp } from '../util.js';
import {
  ctx, scale, ox, oy, RT, frameDt, topExtra, TAU,
  shake, flash, FONT, NUM_FONT, BODY_FONT, easeBack, easeOut, lerp, pool, take,
  wt, ht, place, placeH, spr, txt, rr, additive,
} from './core.js';
import { burst, ring, sprPop, lightBeam, numText, K_STAR, sparkle, rays, runeCircle } from './fx.js';
import { enemy } from './units.js';
import { iconImage } from '../icons.js';

const SYN = Object.fromEntries(SYNERGIES.map(s => [s.key, s]));
const KIND_COL = { cannon: ['#2a0848', '#8a2ac8', '#ff8aff'], duo: ['#06243e', '#1a86c0', '#7ff4ff'], event: ['#3e1400', '#d06a0a', '#ffd84a'], fusion: ['#1a0838', '#6a2ac0', '#ffc8ff'] };
const TIER_COL = ['#ffffff', '#8dff6a', '#ffc23a', '#ff5a3a'];
const STAMPS = pool(5, () => ({ life: 0, max: 1, txt: '', col: '#fff', y: 0, size: 60 }));
const POPS = pool(8, () => ({ life: 0, max: 1, txt: '', sub: '', col: '#fff', x: 0, y: 0 }));
const LVUPS = pool(3, () => ({ on: false, t: 0, x: 0, y: 0, level: 1, ms: null }));
let bossLag = 1, bossName = '', bossA = 0, bossNamed = false;
const combo = { shown: 0, prev: 0, tier: 0, a: 0, punch: 0, tierPunch: 0 };

export function stamp(str, col, y = 400, size = 64, life = 1.1) {
  const s = take(STAMPS);
  s.txt = str; s.col = col; s.y = y; s.size = size; s.life = s.max = life;
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
    const k = t < 0.28 ? easeBack(t / 0.28) : 1, a = t > 1.5 ? Math.max(0, 1 - (t - 1.5) / 0.4) : 1;
    const x = clamp(L.x, 140, WORLD_W - 140), y = Math.max(260 - topExtra, L.y - 205) - Math.min(t, 1) * 14;
    ctx.globalAlpha = a;
    additive(true);
    place(x, y, RT * 0.8, 1, 1);
    ctx.globalAlpha = a * 0.6;
    spr(rays('#ffd23a'), 0, 0, 260 * k, 260 * k);
    wt();
    additive(false);
    ctx.globalAlpha = a;
    place(x, y, -0.04, k, k);
    numText('LEVEL UP!', 0, 0, 50, '#fff8c0', '#ffb020', '#5a2600');
    const lk = t > 0.35 && t < 0.55 ? 1 + 0.3 * Math.sin((t - 0.35) / 0.2 * Math.PI) : 1;
    ctx.scale(lk, lk);
    numText('Lv.' + L.level, 0, 44 / lk, 28, '#ffffff', '#bfe8ff', '#1a2a5a');
    wt();
    if (L.ms && t > 0.45) {
      const mk = t < 0.65 ? easeBack((t - 0.45) / 0.2) : 1;
      place(x, y + 84, 0, mk, mk);
      txt('새 능력 해금!', 0, 0, 20, '#8ff8ff', '#0a2a4a', 6);
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
const MOMENT_LIFE = { boss: 2.0, cut: 2.6, loot: 1.7 };
// ui.js 가 카드 선택 오버레이를 띄우기 전에 묻는다: 지금 연출이 몇 초 남았나(보스 경고가 끝난 뒤 카드가 뜨게)
export const momentLeft = () => (moment ? Math.max(0, moment.life - moment.t) : 0) + (MQ.some(m => m.kind === 'boss') ? MOMENT_LIFE.boss : 0);
function domBusy() {
  if (typeof document === 'undefined') return false;
  return !!document.querySelector('#layer .modal:not([hidden]), #clear:not([hidden]), #defeat:not([hidden]), #pick:not([hidden]), .hu-cp:not([hidden]), .hu-main:not([hidden])');
}
// 조합 엠블럼 아이콘 (assets/icons). 융합은 두 원소 아이콘을 겹친다
const HIDE_ICON = { flame: 'el-fire', chain: 'el-lightning', glacier: 'el-frost', double: 'multi', golden: 'coin', flawless: 'gem', frenzy: 'el-fire',
  chainboom: 'crit', pierce: 'atk', homing: 'el-wind', thorns: 'wall', giant: 'atk', twin: 'partner', legend: 'chest' };
const FUSION_EL = Object.fromEntries(FUSIONS.map(f => [f.key, f.elements]));

export function drawHud(view) {
  ht();
  ctx.textBaseline = 'middle';
  drawBossBar(view);
  const hideA = Math.max(quietA, moment ? 1 : 0);
  if (hideA < 1) drawCombo(view, 1 - hideA);
  // 스탬프 (연출 중엔 가림)
  if (!moment) for (const s of STAMPS) {
    if (s.life <= 0) continue;
    const t = s.max - s.life;
    const k = t < 0.18 ? easeBack(t / 0.18) : 1;
    const a = (s.life < 0.3 ? s.life / 0.3 : 1) * (1 - quietA);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.setTransform(scale * k, 0, 0, scale * k, ox + scale * 360, oy + scale * (s.y - t * 16));
    ctx.rotate(-0.06);
    txt(s.txt, 0, 0, s.size, s.col, '#1a0612', s.size * 0.2);
    ctx.globalAlpha = a * 0.5;
    txt(s.txt, 0, -s.size * 0.06, s.size, '#ffffff');
    ctx.globalAlpha = a;
    txt(s.txt, 0, 0, s.size, s.col);
  }
  ht();
  // 조합 재발동 알약 (세로로 쌓임 — pop()이 자리를 잡는다)
  for (const p of POPS) {
    if (p.life <= 0) continue;
    const t = p.max - p.life;
    const k = t < 0.15 ? easeBack(t / 0.15) : 1;
    ctx.globalAlpha = (p.life < 0.35 ? p.life / 0.35 : 1) * (1 - hideA);
    if (ctx.globalAlpha <= 0) continue;
    placeH(p.x, p.y - t * 18, k);
    ctx.font = `20px ${FONT}`;
    const tw = ctx.measureText(p.txt).width + 34;
    ctx.fillStyle = 'rgba(20,6,30,0.9)';
    rr(-tw / 2, -18, tw, 36, 18); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#22163a'; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = p.col; rr(-tw / 2 + 3, -15, tw - 6, 30, 15); ctx.stroke();
    txt(p.txt, 0, 1, 20, '#ffffff', '#22163a', 5);
    txt(p.sub, 0, -27, 13, p.col, '#14061e', 4);
  }
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

// ── 보스 체력바: 초상 배지 + 이름 + % + 10칸 눈금 (ART §4.5). 오른쪽 영웅 버튼 자리는 비운다 ──
let bossIntro = 0, bossType = '', bossR = 60;
function drawBossBar(view) {
  const b = view.phase === 'play' ? view.boss : null; // 클리어·패배 화면에선 보스바를 거둔다
  if (b && b.maxHp > 0) {
    const ratio = clamp(b.hp / b.maxHp, 0, 1);
    if (b.name !== bossName) bossIntro = 0;
    if (b.name !== bossName || ratio > bossLag + 0.001) { bossName = b.name; bossLag = ratio; }
    bossLag = Math.max(ratio, bossLag - 0.25 * frameDt);
    bossA = Math.min(1, bossA + 5 * frameDt);
    bossIntro = Math.min(1, bossIntro + frameDt / 0.7);
    const e = view.enemies.find(q => q.isBoss && !q.dead);
    if (e) { bossType = e.type; bossR = e.r; bossNamed = !!e.named; }
  } else {
    bossA = Math.max(0, bossA - 3.5 * frameDt);
    if (bossA <= 0) return;
  }
  const named = bossNamed;
  const ratio = b && b.maxHp > 0 ? clamp(b.hp / b.maxHp, 0, 1) : 0;
  const ei = easeOut(bossIntro), shown = ratio * ei, lag = Math.max(shown, bossLag * ei);
  const L = 16, R = 594, x = 90, w = R - 12 - x, y = 118, h = 20, cy = 122;
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
    const img = enemy(bossType, bossR, 'n');
    const k = 46 / Math.max(img.hw, img.hh);
    ctx.drawImage(img, 53 - img.hw * k, cy - img.hh * k + 10, img.hw * 2 * k, img.hh * 2 * k);
  }
  ctx.restore();
  ctx.lineWidth = 6; ctx.strokeStyle = '#22163a'; ctx.beginPath(); ctx.arc(53, cy, 29, 0, TAU); ctx.stroke();
  ctx.lineWidth = 3.5; ctx.strokeStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(53, cy, 27, 0, TAU); ctx.stroke();
  // 이름 · %
  txt(bossName, x + 2, 104, 17, named ? '#ffe0ea' : '#ffe8c0', '#10040e', 5, 'left');
  ctx.font = `17px ${NUM_FONT}`; ctx.textAlign = 'right';
  const pct = Math.ceil(ratio * 100) + '%';
  ctx.lineWidth = 5; ctx.strokeStyle = '#10040e'; ctx.strokeText(pct, x + w, 104);
  ctx.fillStyle = '#ffffff'; ctx.fillText(pct, x + w, 104);
  // 바
  rr(x, y, w, h, 8); ctx.fillStyle = '#2a0814'; ctx.fill();
  ctx.save(); rr(x, y, w, h, 8); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x, y, w * lag, h);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  if (named) { g.addColorStop(0, '#ff9ab4'); g.addColorStop(0.46, '#ff5a80'); g.addColorStop(0.5, '#d8123e'); g.addColorStop(1, '#a00a2e'); }
  else { g.addColorStop(0, '#ffd89a'); g.addColorStop(0.46, '#ffa040'); g.addColorStop(0.5, '#e0700a'); g.addColorStop(1, '#b04e00'); }
  ctx.fillStyle = g; ctx.fillRect(x, y, w * shown, h);
  if (b && b.shield > 0) {
    const sw = w * clamp(b.shield / b.maxHp, 0, 1 - ratio + 0.2);
    const sx = Math.min(x + w * ratio, x + w - sw);
    ctx.fillStyle = 'rgba(120,240,255,0.85)'; ctx.fillRect(sx, y, sw, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = sx - 10 + ((RT * 30) % 10); k < sx + sw; k += 10) { ctx.moveTo(Math.max(sx, k), y + h); ctx.lineTo(Math.min(sx + sw, k + 8), y); }
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, y + 2, w * shown, 4);
  ctx.fillStyle = 'rgba(20,4,16,0.55)';
  for (let k = 1; k < 10; k++) ctx.fillRect(x + w * k / 10 - 1, y, 2, h);
  ctx.restore();
  rr(x, y, w, h, 8); ctx.lineWidth = 2.5; ctx.strokeStyle = '#22163a'; ctx.stroke();
  ctx.globalAlpha = 1;
  ht();
}

function drawCombo(view, vis) {
  if (combo.a > 0) {
    const x = 704, y = 560, tier = clamp(combo.tier, 0, 4);
    const col = tier >= 4 ? `hsl(${42 + 14 * Math.sin(RT * 7)},100%,${62 + 10 * Math.sin(RT * 11)}%)` : TIER_COL[tier]; // 전설: 금빛 일렁임
    const a = combo.a * vis;
    ctx.globalAlpha = a;
    const drop = (1 - combo.a) * 30;
    placeH(x, y + drop, 1 + combo.punch * 0.22); // 한 킬마다 톡
    txt('COMBO', 0, -46, 20, '#ffffff', '#1a0612', 5, 'right');
    ctx.font = `62px ${NUM_FONT}`; ctx.textAlign = 'right';
    ctx.lineWidth = 11; ctx.strokeStyle = '#1a0612'; ctx.strokeText('x' + combo.shown, 0, 0);
    ctx.fillStyle = col; ctx.fillText('x' + combo.shown, 0, 0);
    ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#ffffff'; ctx.fillText('x' + combo.shown, 0, -3);
    ctx.globalAlpha = a;
    if (tier > 0 && COMBO_TIERS[tier - 1]) {
      const k = 1 + combo.tierPunch * 0.6;
      placeH(x, y + 64 + drop, k);
      ctx.rotate(-0.05);
      txt(COMBO_TIERS[tier - 1].label, 0, 0, 30, col, '#1a0612', 7, 'right');
    }
    const c = view.combo; // 남은 시간 바
    if (c && c.count >= 3) {
      ht();
      const tw = 120, u = clamp(c.timer / COMBO_WINDOW, 0, 1);
      ctx.fillStyle = 'rgba(20,6,20,0.6)';
      rr(x - tw - 2, y + 33, tw + 4, 10, 5); ctx.fill();
      ctx.fillStyle = col;
      rr(x - tw * u, y + 35, Math.max(4, tw * u), 6, 3); ctx.fill();
    }
  }
  ht();
  ctx.globalAlpha = vis;
  let ly = 470; // 광란 / 전설 상태 표시
  if (view.frenzyT > 0) {
    placeH(704, ly, 1 + 0.08 * Math.sin(RT * 14));
    txt('광란 시전 x2', 0, 0, 22, '#ff5a3a', '#1a0612', 6, 'right');
    ht();
    ly -= 30;
  }
  if (view.legendT > 0) {
    placeH(704, ly, 1 + 0.06 * Math.sin(RT * 8));
    txt('전설의 학살 골드 x2', 0, 0, 20, '#ffd23a', '#1a0612', 6, 'right');
    ht();
  }
  ctx.globalAlpha = 1;
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
  ctx.globalAlpha = a * 0.45;
  ctx.fillStyle = m.named ? '#1a0008' : '#140a00';
  ctx.fillRect(0, -topExtra, WORLD_W, WORLD_H + topExtra);
  ctx.globalAlpha = a;
  const y = midY() - 60;
  if (m.named) {
    const k = t < 0.18 ? easeOut(t / 0.18) : 1;
    ctx.fillStyle = 'rgba(120,0,20,0.9)';
    ctx.fillRect(0, y - 46 * k, WORLD_W, 92 * k);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y - 46 * k, WORLD_W, 12); ctx.rect(0, y + 46 * k - 12, WORLD_W, 12); ctx.clip();
    ctx.fillStyle = '#ffd23a'; ctx.fillRect(0, y - 46, WORLD_W, 92);
    ctx.fillStyle = '#1a0a00';
    const off = (RT * 80) % 40;
    for (let q = -40; q < WORLD_W + 40; q += 40) {
      ctx.beginPath(); ctx.moveTo(q + off, y - 46); ctx.lineTo(q + off + 20, y - 46); ctx.lineTo(q + off - 4, y + 46); ctx.lineTo(q + off - 24, y + 46); ctx.fill();
    }
    ctx.restore();
    const s = t < 0.12 ? 1.4 - 0.4 * (t / 0.12) : 1;
    placeH(360, y - 8, s);
    txt('WARNING', 0, -6, 24, '#ffd23a', '#2a0000', 6);
    ctx.font = `38px ${NUM_FONT}`; ctx.textAlign = 'center';
    ctx.lineWidth = 9; ctx.strokeStyle = '#3a0008'; ctx.strokeText(m.name, 0, 24);
    ctx.fillStyle = '#ffffff'; ctx.fillText(m.name, 0, 24);
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

// 히든 조합 발견 — 중앙 엠블럼(회전 후광 + 룬 서클 + 색 타일 아이콘) 슬램 → 리본 + 이름 + 효과 → 도감(메뉴) 버튼으로 날아감
function drawCut(m) {
  const s = m.s, t = m.t, life = m.life;
  const col = KIND_COL[s.kind] || KIND_COL.event;
  const out = life - 0.5; // 이 뒤로 엠블럼이 메뉴 버튼으로 날아감
  const env = t < 0.2 ? t / 0.2 : t > out ? Math.max(0, 1 - (t - out) / 0.5) : 1;
  const cy = midY(), ex = 690, ey = 34 - topExtra; // 메뉴 버튼 (HUD 우상단)
  ctx.globalAlpha = env * 0.74;
  ctx.fillStyle = '#0a0418';
  ctx.fillRect(0, -topExtra, WORLD_W, WORLD_H + topExtra);
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
  const els = FUSION_EL[s.key];
  if (els) {
    const a1 = iconImage('el-' + els[0]), a2 = iconImage('el-' + els[1]);
    if (a1) ctx.drawImage(a1, -50, -48, 64, 64);
    if (a2) ctx.drawImage(a2, -14, -16, 64, 64);
  } else {
    const im = iconImage(HIDE_ICON[s.key] || 'new');
    if (im) ctx.drawImage(im, -44, -44, 88, 88);
  }
  ht();
  // 글자 (엠블럼이 떠나기 전까지)
  const ta = t < 0.25 ? 0 : t < 0.45 ? (t - 0.25) / 0.2 : t > out ? Math.max(0, 1 - (t - out) / 0.2) : 1;
  if (ta > 0) {
    ctx.globalAlpha = ta;
    const rk = t < 0.45 ? easeBack(Math.min(1, (t - 0.25) / 0.2)) : 1;
    placeH(360, cy + 26, rk);
    ribbon(0, 0, 300, 46, '#ffe45a', '#ffb21a', '#c26a00');
    txt(s.kind === 'fusion' ? '원소 융합 발견!' : '히든 조합 발견!', 0, 1, 24, '#ffffff', '#7a3a00', 6);
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
    if (cond) txt('조건 · ' + wrap(cond, 580, 15)[0], 360, cy + 146 + lines.length * 28, 15, '#d8c8ff', '#140a24', 4);
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

// 전설 장비 획득 배너 (빛기둥·비행은 world.js 드롭 연출)
function drawLootBanner(m) {
  const t = m.t, a = t < 0.15 ? t / 0.15 : t > m.life - 0.3 ? Math.max(0, (m.life - t) / 0.3) : 1;
  const k = t < 0.25 ? easeBack(t / 0.25) : 1, y = midY() - 160;
  additive(true);
  placeH(360, y, 1);
  ctx.rotate(RT * 0.5);
  ctx.globalAlpha = a * 0.7;
  spr(rays('#ffd23a'), 0, 0, 400 * k, 400 * k);
  additive(false);
  ctx.globalAlpha = a;
  placeH(360, y, k);
  ribbon(0, 0, 300, 58, '#ffe45a', '#ffb21a', '#c26a00');
  ctx.font = `34px ${NUM_FONT}`; ctx.textAlign = 'center';
  ctx.lineWidth = 8; ctx.strokeStyle = '#7a3a00'; ctx.strokeText('전설 획득!', 0, 2);
  ctx.fillStyle = '#ffffff'; ctx.fillText('전설 획득!', 0, 2);
  txt(m.name, 0, 52, 22, '#fff0b8', '#3a1a00', 6);
  ht();
  ctx.globalAlpha = 1;
}

// ═════════════ 이벤트 → HUD 연출 ═════════════
export function events(view, evs, opts) {
  const me = opts.myIndex | 0;
  for (const ev of evs) {
    switch (ev.type) {
      case 'bossSpawn': {
        // 진행 중인 컷인·전설 배너는 잠깐 뒤로 밀고 경고부터
        if (moment && moment.kind !== 'boss') { MQ.unshift({ ...moment, t: Math.min(moment.t, 0.3) }); moment = null; }
        MQ.unshift({ kind: 'boss', name: String(ev.name || ''), named: !!ev.named, t: 0, life: ev.named ? MOMENT_LIFE.boss : 1.3 });
        shake(ev.named ? 0.35 : 0.12);
        flash(ev.named ? 0.3 : 0.12, ev.named ? '#ff2040' : '#ff9a30');
        break;
      }
      case 'combo': {
        combo.tierPunch = 1;
        if (quiet || moment) break;
        const col = TIER_COL[clamp(ev.tier | 0, 0, 3)] || '#ffd23a';
        burst(K_STAR, 620, 590, 10 + ev.tier * 4, 80, 320, 0.7, 20, [col, '#ffffff'], 200, 1.5, 60);
        if (ev.tier >= 3) shake(0.15);
        break;
      }
      case 'synergy': {
        const s = SYN[ev.key];
        if (!s) break;
        if (ev.first) MQ.push({ kind: 'cut', s, t: 0, life: MOMENT_LIFE.cut });
        else if (ev.key !== 'frenzy') { // 광란 재발동은 '광란!' 도장으로 충분
          const o = ev.o === 0 || ev.o === 1 ? ev.o : -1;
          const c = KIND_COL[s.kind] || KIND_COL.event;
          const who = o === me ? '내 마법사' : view.players[o] && view.players[o].kind === 'bot' ? 'AI 마법사' : '동료 마법사';
          pop(s.name, s.kind === 'cannon' ? who : s.kind === 'duo' ? '협동 조합' : '발동!', c[2],
            Number.isFinite(ev.x) ? ev.x : WORLD_W / 2, (Number.isFinite(ev.y) ? ev.y : 900) - 40);
        }
        break;
      }
      case 'loot':
        if (ev.item && ev.item.rarity === 'legend') MQ.push({ kind: 'loot', name: String(ev.item.name || ''), t: 0, life: MOMENT_LIFE.loot });
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
  for (const s of STAMPS) if (s.life > 0) s.life -= dt;
  for (const p of POPS) if (p.life > 0) p.life -= dt;
  if (++domChk % 6 === 0 || quiet) quiet = view.phase !== 'play' || !!view.pick || domBusy();
  quietA = quiet ? Math.min(1, quietA + dt * 8) : Math.max(0, quietA - dt * 4);
  if (moment && (moment.t += dt * (moment.kind === 'cut' && MQ.some(m => m.kind === 'cut') ? 1.4 : 1)) >= moment.life) moment = null;
  if (moment && moment.kind !== 'boss' && quiet && moment.t < 0.2) { MQ.unshift(moment); moment = null; } // 막 시작한 컷인은 보류
  if (!moment && MQ.length) {
    const i = MQ.findIndex(m => m.kind === 'boss' || !quiet); // 보스 경고는 바로, 나머지는 조용할 때만
    if (i >= 0) {
      moment = MQ.splice(i, 1)[0];
      if (moment.t === 0 && moment.kind === 'cut') {
        const col = (KIND_COL[moment.s.kind] || KIND_COL.event)[2], y = midY() - 70;
        flash(0.5); shake(0.3);
        burst(K_STAR, WORLD_W / 2, y, 34, 150, 700, 0.9, 26, ['#ffffff', '#ffe68a', col], 0, 2.2);
        ring(WORLD_W / 2, y, 20, 480, 0.6, '#ffffff', 10);
      } else if (moment.t === 0 && moment.kind === 'loot') flash(0.35, '#ffe07a');
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
  for (const L of LVUPS) if (L.on && (L.t += dt) > 1.9) L.on = false;
}

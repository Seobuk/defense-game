// v0.1.2 소환의 제단 — 배너 캐러셀 · 1회/10연 · 천장 · 확률 정보 · 소환 연출(마법진 → 빛 기둥 → 전설 컷인 → 카드 뒤집기) · 결과 · 내역 · 별조각 교환소 · 환영 선물.
// 메타는 읽기만(summon.js 순수 함수), 바꾸는 건 ctx.act({type:'summon'|'cosExchange'|'giftSeen'…}) → main.js → run.js campAct + 저장.
// 자기 전체 화면 층(z 260, 영웅 화면 위)과 자기 뒤로 가기 스택. 재질 kit.css, 배치 css/summon.css. docs/DESIGN.md 'v0.1.2 외형 소환 계약'
import { COSMETICS, COS_BY_KEY, SLOT_NAME, COS_RARITY, PITY, banners, oddsTable, pullPrice, history, sourceText, summonDot, giftPending, SHARD_PRICE, owns, loadoutOf } from './summon.js';
import { HERO_CLASSES } from './hero.js';
import { runeRingURL } from './heroui.js';
import { cosmeticURL as artURL, playPreview as artPlay, setLoadout } from './art/cosmetics.js';
import { dateText } from './recordui.js';
import { createWardrobe } from './wardrobeui.js';
import { icon } from './icons.js';
import { fmt } from './util.js';

export { summonDot };
const INK = '#22163a';
const R_ORDER = ['common', 'rare', 'epic', 'legend'];
const RAR = Object.fromEntries(COS_RARITY.map(r => [r.key, r]));
const rarName = r => RAR[r]?.name || r;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// ── 그림(COSMETIC ART art/cosmetics.js). '기본 외형'(kn_base · rb_base · sk_base)도 그림 모듈이 미리보기로 그린다(장착한 외형이 아니라 진짜 기본 모습) ──
export const cosmeticURL = (key, px = 256) => artURL(key, px);
export const playPreview = (cv, key, o) => artPlay(cv, key, o);
export const syncLoadout = () => { try { setLoadout(loadoutOf(meta())); } catch { /* 그림 오류는 전투와 무관 */ } }; // 부팅 · 백업 복원 · 장착 뒤
export const kindName = c => (c.slot === 'costume' ? HERO_CLASSES[c.cls]?.name || '코스튬' : c.slot === 'robe' ? '로브' : '이펙트');

// ── 그림(인라인 SVG, ART §8: 잉크 외곽 3px · 2톤 · 좌상단 광택) ──
const SVG = {
  ticket: `<g transform="rotate(-10 24 24)"><path d="M5 13h38v7a4 4 0 0 0 0 8v7H5v-7a4 4 0 0 0 0-8z" fill="#9b4dff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M8 16h32v4.5a6.5 6.5 0 0 0-2 3.5H8z" fill="#d7a6ff"/><path d="M15 15v18" stroke="${INK}" stroke-width="2.4" stroke-dasharray="3 3"/><path d="M30 16.5l2.3 4.7 5.2.8-3.8 3.6.9 5.1-4.6-2.4-4.6 2.4.9-5.1-3.8-3.6 5.2-.8z" fill="#ffe45a" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/><path d="M8 18h4" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></g>`,
  shard: `<path d="M24 3l6.5 14.5L45 24l-14.5 6.5L24 45l-6.5-14.5L3 24l14.5-6.5z" fill="#3fb0ff"/><path d="M24 3l6.5 14.5L24 24zM45 24l-14.5 6.5L24 24z" fill="#d8fbff"/><path d="M24 3v21L17.5 17.5zM3 24h21l-6.5-6.5z" fill="#7fe3ff"/><path d="M24 3l6.5 14.5L45 24l-14.5 6.5L24 45l-6.5-14.5L3 24l14.5-6.5z" fill="none" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="37" cy="10" r="2.6" fill="#ff9ae8"/><circle cx="19" cy="15" r="1.8" fill="#fff"/>`,
  altar: `<ellipse cx="24" cy="37" rx="20" ry="7.5" fill="#5a46d6" stroke="${INK}" stroke-width="3"/><ellipse cx="24" cy="37" rx="12.5" ry="4.2" fill="none" stroke="#d8ccff" stroke-width="2"/><path d="M16.5 37L20 12h8l3.5 25z" fill="#ffe45a" opacity=".8"/><path d="M20.5 37L22.5 14h3l2 23z" fill="#fff" opacity=".85"/><path d="M24 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="#ffc92e" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`,
  robe: `<path d="M16 7l8 5 8-5 10 8-5.5 7.5-3.5-2.5v21H15V20l-3.5 2.5L6 15z" fill="#b85cff" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M24 12v28" stroke="#ffc92e" stroke-width="3.2"/><path d="M15 36h18" stroke="#ffc92e" stroke-width="3"/><path d="M11 13l4-3" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>`,
  star: `<path d="M24 5l5.6 11.4 12.6 1.8-9.1 8.9 2.1 12.5L24 33.7l-11.2 5.9 2.1-12.5-9.1-8.9 12.6-1.8z" fill="#fff3a8" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M24 11l3.6 7.4 8.2 1.2-5.9 5.8" fill="none" stroke="#ffc92e" stroke-width="3" stroke-linejoin="round"/>`,
  gift: `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><rect x="7" y="20" width="34" height="22" rx="3" fill="#b85cff"/><rect x="5" y="14" width="38" height="8" rx="3" fill="#d7a6ff"/><path d="M21 14h6v28h-6z" fill="#ffc92e"/><path d="M24 14c-4-7-12-8-12-3s8 3 12 3zM24 14c4-7 12-8 12-3s-8 3-12 3z" fill="#ffc92e"/></g>`,
};
export const svg = (k, cls = 'sm-ic') => `<span class="${cls}" aria-hidden="true"><svg viewBox="0 0 48 48">${SVG[k]}</svg></span>`;
let svgURLs = {};
export const svgURL = k => (svgURLs[k] ||= 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${SVG[k]}</svg>`));
// 캠프 하단 탭 아이콘(<img class="k-ico"> — 탭 CSS가 그대로 먹는다)
export const altarTabIcon = () => `<img class="k-ico" src="${svgURL('altar')}" alt="" aria-hidden="true" draggable="false">`;
export const wardrobeIcon = () => svg('robe');

// 썸네일(정지 초상, cosmetics.js 캐시)
export const thumb = (key, px = 128, cls = 'sm-th') => {
  const c = COS_BY_KEY[key];
  let src = '';
  try { src = cosmeticURL(key, px); } catch { /* 그림 오류는 빈 칸으로 */ }
  return `<span class="${cls}" data-r="${c?.rarity || 'common'}">${src ? `<img src="${src}" alt="" draggable="false">` : ''}</span>`;
};
const curIco = cur => (cur === 'tickets' ? svg('ticket') : icon('gem'));
const num = n => (n < 1e5 ? Math.floor(n).toLocaleString('ko-KR') : fmt(n)); // 가격·별조각은 1,500처럼
const pct = r => `${(r * 100).toFixed(3)}%`;
// 픽업 끝(기기 날짜 end 0시)까지 남은 시간
function leftText(end) {
  const [y, m, d] = String(end).split('-').map(Number);
  const ms = new Date(y, (m || 1) - 1, d || 1).getTime() - Date.now();
  if (!(ms > 0)) return '곧 교체';
  const s = Math.floor(ms / 1000), dd = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
  const two = n => String(n).padStart(2, '0');
  return dd ? `${dd}일 ${two(hh)}:${two(mm)}:${two(ss)}` : `${two(hh)}:${two(mm)}:${two(ss)}`;
}

let ctx = null, R = null, W = null;
const layers = []; // 뒤로 가기 스택 { el, close }

// ctx = { getMeta, act(a) → 결과(저장 포함), play(k) }
export function initSummonUI(root, c) {
  ctx = c;
  const host = document.createElement('div');
  host.className = 'sm-root';
  host.style.display = 'contents';
  root.append(host);
  R = { host };
  W = createWardrobe({ host, meta, act: a => ctx.act(a), play, toast, push, pop, thumb, svg, rarName, kindName, openItem, playPreview, syncLoadout, onClose: () => ctx.onClose?.() });
  syncLoadout(); // 부팅: 저장된 장착 외형을 전장 그림에
  try { W.unseen(); } catch { /* 새 외형 점 기준(지금 보유 = 본 것)만 잡아 둔다 */ }
  // Esc: 이 층이 떠 있으면 아래 모달(ui.js 스택)보다 먼저 받는다(문서 캡처 단계)
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && summonOpen()) { e.preventDefault(); e.stopImmediatePropagation(); summonHandleBack(); } }, true);
}
const meta = () => ctx.getMeta();
const play = k => { try { ctx.play?.(k); } catch { /* 소리 실패 무시 */ } };
function push(el, close) { R.host.inert = false; layers.push({ el, close }); under(); } // 영웅 화면이 형제 요소를 inert로 잠가도 이 층은 연다
function pop(el) { const i = layers.findIndex(l => l.el === el); if (i >= 0) layers.splice(i, 1); under(); }
// 뒤에 더 연 전체 화면(.sm-scr — 제단 위 옷장)에 가린 전체 화면은 반복 애니메이션 멈춤(kit.css .sm-under). 창(.sm-ov)은 반투명이라 그대로
function under() {
  const scr = layers.filter(l => l.el.classList.contains('sm-scr'));
  scr.forEach((l, i) => l.el.classList.toggle('sm-under', i < scr.length - 1));
}

export function summonHandleBack() {
  if (!R) return false;
  if (fx && !fx.el.hidden) { fx.ph === 'done' ? closeFx() : skipFx(); return true; }
  const top = layers[layers.length - 1];
  if (!top) return false;
  top.close();
  return true;
}
export const summonOpen = () => layers.length > 0 || !!(fx && !fx.el.hidden);

// ── 토스트(이 층 전용) ──
let toastEl = null, toastT = 0;
function toast(msg, ico = '') {
  toastEl?.remove();
  toastEl = document.createElement('div');
  toastEl.className = 'sm-toast';
  toastEl.innerHTML = `${ico ? (SVG[ico] ? svg(ico) : icon(ico)) : ''}<span></span>`;
  toastEl.lastChild.textContent = msg;
  R.host.append(toastEl);
  clearTimeout(toastT);
  const t = toastEl;
  toastT = setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 200); }, 1900);
}
const shake = b => { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); };

// ── 시트(확률 정보 · 내역 · 교환소 · 외형 상세 · 선물) ──
function sheet(title, body, { ribbon = 'gold', narrow = false, onClose } = {}) {
  const ov = document.createElement('div');
  ov.className = 'sm-ov';
  ov.innerHTML = `<div class="k-modal dark${narrow ? ' narrow' : ''}" role="dialog" aria-modal="true" tabindex="-1">
    <div class="k-ribbon ${ribbon}"><h2></h2></div>
    <button class="k-close" aria-label="닫기">${icon('close')}</button>
    <div class="k-sheet">${body}</div></div>`;
  ov.querySelector('h2').textContent = title;
  const close = () => { if (!ov.isConnected) return; pop(ov); ov.remove(); onClose?.(); };
  ov.querySelector('.k-close').addEventListener('click', close);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  R.host.append(ov);
  push(ov, close);
  ov.querySelector('.k-modal').focus({ preventScroll: true });
  return { ov, sheet: ov.querySelector('.k-sheet'), close };
}

// ═══════════ 제단 ═══════════
let A = null, bIdx = 0, tick = 0, stops = [];
function buildAltar() {
  const el = document.createElement('section');
  el.className = 'sm-scr sm-altar';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', '소환의 제단');
  el.innerHTML = `
    <i class="sm-stars" aria-hidden="true"></i>
    <header class="sm-head cw">
      <button class="k-btn round s danger sm-back" aria-label="닫기">${icon('close')}</button>
      <h1 class="sm-title">소환의 제단</h1>
      <div class="sm-cur">
        <span class="sm-pill gm" aria-label="보석">${icon('gem')}<b class="k-num gem-n">0</b></span>
        <span class="sm-pill tk" aria-label="소환권">${svg('ticket')}<b class="k-num">0</b></span>
        <span class="sm-pill sd" aria-label="별조각">${svg('shard')}<b class="k-num">0</b></span>
      </div>
    </header>
    <div class="sm-body cw">
      <div class="sm-banners" role="list"></div>
      <div class="sm-dots" role="tablist" aria-label="배너"></div>
      <div class="sm-pity">
        <span class="sm-pity-ico">${svg('star', '')}</span>
        <div class="sm-pity-top"><span class="sm-pity-l"></span><b class="sm-pity-n"></b></div>
        <div class="k-bar sm-pity-bar"><i></i></div>
        <div class="sm-pity-note"><i></i><span></span></div>
      </div>
      <div class="sm-pulls">
        <button class="k-btn sm-pull x1" data-n="1"><b>1회 소환</b><span class="sm-cost"></span></button>
        <button class="k-btn sm-pull x10" data-n="10"><span class="sm-flag g">희귀 이상 확정</span><span class="sm-flag r">10% 할인</span><b>10회 소환</b><span class="sm-cost"></span></button>
      </div>
      <p class="sm-free"></p>
      <nav class="sm-links">
        <button class="sm-link" data-go="odds">${icon('dice')}확률 정보</button>
        <button class="sm-link" data-go="hist">${icon('codex')}소환 내역</button>
        <button class="sm-link" data-go="shop">${svg('shard')}교환소</button>
        <button class="sm-link" data-go="ward">${svg('robe')}옷장</button>
      </nav>
    </div>`;
  R.host.append(el);
  const $ = s => el.querySelector(s);
  A = { el, $ };
  $('.sm-back').addEventListener('click', closeAltar);
  for (const b of el.querySelectorAll('.sm-pull')) b.addEventListener('click', () => doPull(+b.dataset.n, b));
  for (const b of el.querySelectorAll('.sm-link')) b.addEventListener('click', () => ({ odds: () => openOdds(curBanner().key), hist: openHist, shop: openShop, ward: () => W.open({}) })[b.dataset.go]());
  const strip = $('.sm-banners');
  let raf = 0;
  strip.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const i = Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth));
      if (i !== bIdx && i >= 0 && i < A.bs.length) { bIdx = i; renderAltar(); }
    });
  }, { passive: true });
}
const curBanner = () => A.bs[bIdx] || A.bs[0];
const sigOf = bs => bs.map(b => b.key + (b.legend || '') + (b.end || '')).join();

function bannerHTML(b) {
  const pk = b.key === 'pickup';
  const feat = pk ? COS_BY_KEY[b.legend] : COS_BY_KEY[COSMETICS.filter(c => c.rarity === 'legend')[0]?.key];
  const lines = pk
    ? `<span data-r="legend"><i></i>${esc(COS_BY_KEY[b.legend]?.name)} 확률 UP</span>` + (b.epics || []).map(k => `<span data-r="epic"><i></i>${esc(COS_BY_KEY[k]?.name)}</span>`).join('')
    : `<span data-r="legend"><i></i>전설 ${COSMETICS.filter(c => c.rarity === 'legend').length}종 · 영웅 ${COSMETICS.filter(c => c.rarity === 'epic').length}종</span><span data-r="rare"><i></i>모든 외형 등장</span>`;
  return `<article class="sm-bn" role="listitem" data-kind="${b.key}" aria-label="${esc(b.name)}">
    <i class="sm-bn-rays" aria-hidden="true"></i>
    <div class="sm-bn-txt">
      <span class="sm-bn-tag">${pk ? '픽업' : '상시'}</span>
      <h2 class="sm-bn-name">${esc(b.name)}</h2>
      <p class="sm-bn-sub">${pk ? '기간 한정! 픽업 전설 확률 상승 · 전설이 픽업이 아니면 다음 전설은 픽업 확정' : '언제나 열려 있는 제단 · 모든 외형이 나와요'}</p>
      <div class="sm-bn-feat">${lines}</div>
      ${pk ? `<span class="sm-bn-time">${icon('speed')}남은 시간 <b class="sm-left"></b></span>` : ''}
    </div>
    <div class="sm-bn-art"><i class="sm-bn-plate"></i>${feat ? `<canvas class="sm-bn-hero" width="320" height="320" data-k="${feat.key}"></canvas><span class="sm-rtag sm-bn-rar" data-r="legend">${esc(feat.name)}</span>` : ''}</div>
  </article>`;
}

export function openAltar() {
  if (!R) return;
  if (!A) buildAltar();
  A.bs = banners();
  const sig = sigOf(A.bs);
  if (A.sig !== sig) { // 픽업이 바뀌면(주 단위) 다시 그림
    A.sig = sig;
    A.$('.sm-banners').innerHTML = A.bs.map(bannerHTML).join('');
    A.$('.sm-dots').innerHTML = A.bs.map((b, i) => `<button role="tab" aria-label="${esc(b.name)}" data-i="${i}"></button>`).join('');
    for (const d of A.el.querySelectorAll('.sm-dots button')) d.addEventListener('click', () => scrollTo(+d.dataset.i));
    for (const c of A.el.querySelectorAll('.sm-bn')) c.addEventListener('click', e => { if (!e.target.closest('button')) openOdds(c.dataset.kind); });
    bIdx = Math.max(0, A.bs.findIndex(b => b.key === 'pickup'));
    if (!A.el.hidden) { startPreviews(); requestAnimationFrame(() => scrollTo(bIdx, 'instant')); } // 열린 채 교체: 새 배너 그림 다시 돌림
  }
  if (!A.el.hidden) return renderAltar();
  A.el.hidden = false;
  push(A.el, closeAltar);
  startPreviews();
  renderAltar();
  requestAnimationFrame(() => scrollTo(bIdx, 'instant'));
  clearInterval(tick);
  tick = setInterval(() => { if (!A.el.hidden) tickTime(); }, 1000);
}
function scrollTo(i, behavior = 'smooth') {
  const s = A.$('.sm-banners');
  s.scrollTo({ left: i * s.clientWidth, behavior });
  bIdx = i;
  renderAltar();
}
function startPreviews() {
  stopPreviews();
  for (const cv of A.el.querySelectorAll('canvas.sm-bn-hero')) { try { stops.push(playPreview(cv, cv.dataset.k)); } catch { /* 그림 없음 */ } }
}
function stopPreviews() { for (const s of stops) try { s?.(); } catch { /* */ } stops = []; }
function closeAltar() {
  if (!A || A.el.hidden) return;
  A.el.hidden = true;
  pop(A.el);
  stopPreviews();
  clearInterval(tick);
  ctx.onClose?.();
}
function tickTime() {
  for (const [i, b] of A.bs.entries()) if (b.end) {
    const t = leftText(b.end), e = A.el.querySelectorAll('.sm-bn')[i]?.querySelector('.sm-left');
    if (t === '곧 교체' && refreshBanners()) return; // 0시를 넘김 → 새 픽업으로
    if (e) e.textContent = t;
  }
}
function setNum(e, v) { const s = fmt(v); if (e.textContent !== s) { if (e.textContent) e.parentElement.classList.remove('bump'), void e.offsetWidth, e.parentElement.classList.add('bump'); e.textContent = s; } }
function renderAltar() {
  if (!A || A.el.hidden) return;
  const m = meta(), s = m.summon, b = curBanner();
  setNum(A.$('.sm-pill.gm b'), m.gems);
  setNum(A.$('.sm-pill.tk b'), s.tickets);
  setNum(A.$('.sm-pill.sd b'), s.shards);
  for (const [i, d] of [...A.el.querySelectorAll('.sm-dots button')].entries()) d.setAttribute('aria-current', String(i === bIdx));
  tickTime();
  // 천장
  const p = s.pity?.[b.key] | 0;
  A.$('.sm-pity-l').textContent = `${b.key === 'pickup' ? '픽업' : '상시'} 천장 · 전설 확정까지`;
  A.$('.sm-pity-n').textContent = `${PITY - p}회`;
  A.$('.sm-pity-bar').style.setProperty('--p', (p / PITY).toFixed(3));
  const note = A.$('.sm-pity-note');
  note.classList.toggle('on', b.key === 'pickup');
  note.lastChild.textContent = s.guar ? '다음 전설은 픽업 확정!' : '전설이 픽업이 아니면 다음 전설은 픽업 확정';
  // 버튼
  for (const btn of A.el.querySelectorAll('.sm-pull')) {
    const n = +btn.dataset.n, pr = pullPrice(m, n);
    btn.querySelector('.sm-cost').innerHTML = `${curIco(pr.cur)}<b class="k-cost">${fmt(pr.cost)}</b>`;
    btn.classList.toggle('is-poor', !pr.ok);
    btn.querySelector('.sm-flag.r')?.toggleAttribute('hidden', pr.cur === 'tickets');
    btn.setAttribute('aria-label', `${b.name} ${n}회 소환, ${pr.cur === 'tickets' ? '소환권' : '보석'} ${pr.cost}`);
  }
  const wl = A.$('.sm-link[data-go="ward"]'), un = W.unseen(m) > 0; // 아직 안 본 새 외형 → 옷장 링크에 점
  if (!!wl.querySelector('.k-dot') !== un) un ? wl.insertAdjacentHTML('beforeend', '<i class="k-dot"></i>') : wl.querySelector('.k-dot').remove();
  A.$('.sm-free').textContent = s.tickets > 0 ? `소환권 ${s.tickets}장 — 소환권이 있으면 먼저 써요` : '소환권: 네임드 보스 첫 처치 · 매일 첫 도전 · 10층마다 신기록 · 도감 발견';
}

const POOR = { gems: '보석이 부족해요 · 도전으로 모아요', tickets: '소환권이 부족해요' };
// week = '한 번 더'가 넘기는, 방금 결과를 낸 픽업 주(그사이 바뀌었으면 소환하지 않음)
function doPull(n, btn, week) {
  if (fx && !fx.el.hidden) return;
  if (refreshBanners()) return;
  const m = meta(), b = curBanner(), pr = pullPrice(m, n);
  if (week != null && b.key === 'pickup' && b.week !== week) { toast('픽업이 바뀌었어요! 새 픽업을 확인해 주세요', 'speed'); return; }
  if (!pr.ok) { if (btn) shake(btn); toast(POOR[pr.cur], pr.cur === 'gems' ? 'gem' : 'ticket'); return; }
  const go = () => {
    if (refreshBanners()) return;
    // 화면에 보인 픽업(week)을 코어에 넘긴다 — 그사이 월요일 0시를 넘겼으면 코어가 거절(보인 것 ≠ 낸 것 방지)
    const r = ctx.act({ type: 'summon', banner: b.key, n, week: b.week });
    if (!r || !r.ok) { toast(r?.error || '소환할 수 없어요', 'gem'); renderAltar(); return; }
    playFx(r, n, b.key);
  };
  if (pr.cur === 'gems') confirmGems(n, pr.cost, go); else go();
}
// 픽업 교체(월요일 0시)를 지났으면 제단을 새 픽업으로 다시 그리고 알린다 → true
function refreshBanners() {
  if (!A || A.sig === sigOf(banners())) return false;
  openAltar();
  toast('픽업이 바뀌었어요! 새 픽업을 확인해 주세요', 'speed');
  return true;
}

// 보석 소환 확인(보석은 강화·돌파·상자에도 쓴다 — 한 번 탭 실수 방지). 소환권은 묻지 않음. '다시 묻지 않기' = 이 기기만(localStorage, UI 설정)
const NOASK = 'wd.sm.noGemAsk';
const noAsk = () => { try { return localStorage.getItem(NOASK) === '1'; } catch { return false; } };
function confirmGems(n, cost, go) {
  if (noAsk()) return go();
  const g = meta().gems;
  const s = sheet('보석 소환', `<div class="sm-detail sm-confirm">
      <p>보석 <b>${num(cost)}</b>개로 <b>${n}회 소환</b>할까요?</p>
      <div class="sm-src sm-gemrow">${icon('gem')}<span class="k-num">${num(g)}</span><i aria-hidden="true">→</i><b class="k-num">${num(g - cost)}</b></div>
      <label class="sm-noask"><input type="checkbox"><span>다시 묻지 않기</span></label>
      <div class="sm-btnrow"><button class="k-btn gray sm-c-x">취소</button><button class="k-btn sm-c-ok"><span>소환</span><span class="k-sub">${icon('gem')}<b class="k-cost">${num(cost)}</b></span></button></div>
    </div>`, { narrow: true });
  s.ov.querySelector('.sm-c-x').addEventListener('click', s.close);
  s.ov.querySelector('.sm-c-ok').addEventListener('click', () => {
    if (s.ov.querySelector('.sm-noask input').checked) { try { localStorage.setItem(NOASK, '1'); } catch { /* 이 기기에 못 남기면 다음에 다시 물음 */ } }
    s.close();
    go();
  });
}

// ═══════════ 소환 연출 ═══════════
let fx = null;
const T_CHARGE = 900, T_PILLAR = 950, T_CUT = 1500, T_DEAL = 50, T_FLIP = 90;
function buildFx() {
  const el = document.createElement('div');
  el.className = 'sm-fx';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', '소환');
  el.style.setProperty('--rune', `url("${runeRingURL()}")`);
  el.innerHTML = `
    <div class="sm-fx-circle" aria-hidden="true"><i></i><i></i></div>
    <div class="sm-fx-motes" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => { const a = i / 14 * Math.PI * 2, r = 110 + (i % 3) * 40; return `<i style="--mx:${Math.round(Math.cos(a) * r)}px;--my:${Math.round(Math.sin(a) * r * 0.6)}px;animation-delay:${(i % 5) * 0.14}s"></i>`; }).join('')}</div>
    <div class="sm-fx-pillar" aria-hidden="true"></div>
    <div class="sm-fx-flash" aria-hidden="true"></div>
    <div class="sm-cut" aria-live="polite"><i class="sm-cut-band"></i><i class="sm-cut-rays"></i><div class="sm-cut-art"></div>
      <div class="sm-cut-txt"><span class="sm-rtag" data-r="legend">전설</span><b class="sm-cut-name"></b><span class="sm-cut-kind"></span><span class="sm-cut-dup"></span></div></div>
    <div class="sm-fx-head"><div class="k-ribbon gold"><h2>소환 결과</h2></div></div>
    <div class="sm-cards"></div>
    <div class="sm-fx-foot">
      <div class="sm-fx-sum"></div>
      <div class="sm-fx-btns">
        <button class="k-btn gray sm-fx-ok">확인</button>
        <button class="k-btn sm-fx-again"><span>한 번 더</span><span class="k-sub"></span></button>
      </div>
    </div>
    <p class="sm-fx-tap">화면을 누르면 빨리 넘겨요</p>
    <button class="k-btn s neutral sm-fx-skip">건너뛰기 ▶</button>`;
  R.host.append(el);
  fx = { el, timers: [], ph: '', $: s => el.querySelector(s) };
  fx.$('.sm-fx-skip').addEventListener('click', e => { e.stopPropagation(); skipFx(); });
  fx.$('.sm-fx-ok').addEventListener('click', closeFx);
  fx.$('.sm-fx-again').addEventListener('click', e => {
    const b = e.currentTarget;
    if (b.classList.contains('is-poor')) { shake(b); toast(POOR[pullPrice(meta(), fx.n).cur], 'gem'); return; }
    const { n, banner, week } = fx;
    closeFx();
    const i = A.bs.findIndex(x => x.key === banner);
    if (i >= 0) bIdx = i;
    doPull(n, null, week);
  });
  // 화면 탭 = 다음 단계로
  el.addEventListener('click', e => {
    if (e.target.closest('button')) return;
    if (fx.ph === 'charge') toPillar();
    else if (fx.ph === 'pillar') afterPillar();
    else if (fx.ph === 'cut') nextCut();
    else if (fx.ph === 'cards') finishCards();
  });
}
const T = (ms, fn) => fx.timers.push(setTimeout(fn, ms));
const clearT = () => { for (const t of fx.timers) clearTimeout(t); fx.timers = []; };
function setPh(p) { fx.ph = p; fx.el.dataset.ph = p; fx.$('.sm-fx-skip').hidden = p === 'done'; }

function playFx(r, n, banner, o = {}) {
  if (!fx) buildFx();
  clearT();
  fx.r = r; fx.n = n; fx.banner = banner; fx.week = r.banner?.week; fx.xchg = !!o.xchg;
  fx.el.classList.toggle('xchg', fx.xchg); // 교환 공개: 한 번 더 · 천장 줄 없음
  fx.legends = r.results.filter(x => x.rarity === 'legend');
  fx.cutI = 0;
  fx.el.dataset.best = r.top || 'common';
  fx.el.hidden = false;
  const cards = fx.$('.sm-cards');
  cards.className = `sm-cards n${n === 1 ? 1 : 10}`;
  cards.innerHTML = r.results.map((x, i) => {
    const c = COS_BY_KEY[x.key] || { name: x.key, slot: 'skin' };
    let src = '';
    try { src = cosmeticURL(x.key, n === 1 ? 360 : 200); } catch { /* */ }
    return `<div class="sm-card" data-r="${x.rarity}" style="--d:${(i * T_DEAL / 1000).toFixed(2)}s" aria-label="${esc(rarName(x.rarity))} ${esc(c.name)}${x.isNew ? ' 새 외형' : ` 중복 별조각 ${x.shards}`}">
      <div class="sm-card-in"><div class="sm-card-back"></div>
        <div class="sm-card-front"><span class="sm-card-kind">${esc(kindName(c))}</span><div class="sm-card-art">${src ? `<img src="${src}" alt="" draggable="false">` : ''}</div><b class="sm-card-name">${esc(c.name)}</b></div></div>
      ${x.isNew ? '<span class="k-badge new sm-card-new">NEW</span>' : `<span class="sm-card-dup">${svg('shard')}+${x.shards}</span>`}
    </div>`;
  }).join('');
  setPh('charge');
  play('pickShow');
  T(T_CHARGE, toPillar);
}
function toPillar() {
  clearT();
  setPh('pillar');
  const top = fx.r.top;
  play(top === 'legend' ? 'fusion' : top === 'epic' ? 'synergy' : 'big');
  T(T_PILLAR, afterPillar);
}
function afterPillar() {
  clearT();
  if (fx.legends.length) showCut();
  else dealCards();
}
let cutStop = null;
function showCut() {
  clearT();
  setPh('cut');
  const x = fx.legends[fx.cutI], c = COS_BY_KEY[x.key] || { name: x.key, slot: 'skin' };
  const art = fx.$('.sm-cut-art');
  cutStop?.(); cutStop = null;
  art.innerHTML = '<canvas width="480" height="480"></canvas>';
  try { cutStop = playPreview(art.firstChild, x.key); } catch { /* */ }
  // 다시 붙여 CSS 등장 애니메이션을 다시 돌린다
  const cut = fx.$('.sm-cut'), clone = cut.cloneNode(false);
  cut.replaceWith(clone);
  clone.append(...cut.childNodes);
  fx.$('.sm-cut-name').textContent = c.name;
  fx.$('.sm-cut-kind').textContent = `${SLOT_NAME[c.slot] || ''}${c.slot === 'costume' ? ' · ' + kindName(c) : ''}${x.guar ? ' · 픽업 확정' : x.pity ? ' · 천장' : x.pickup ? ' · 픽업' : ''}`;
  fx.$('.sm-cut-dup').innerHTML = x.isNew ? '<span class="k-badge new">NEW</span>' : `<span class="sm-cut-shard">${svg('shard')}중복 · 별조각 +${x.shards | 0}</span>`;
  play('synergy');
  T(T_CUT, nextCut);
}
function nextCut() {
  clearT();
  fx.cutI++;
  if (fx.cutI < fx.legends.length) showCut();
  else { cutStop?.(); cutStop = null; dealCards(); }
}
function dealCards() {
  clearT();
  setPh('cards');
  play('cardFlip');
  const cards = [...fx.el.querySelectorAll('.sm-card')], dealt = 380 + cards.length * T_DEAL;
  let last = 0;
  cards.forEach((c, i) => {
    const hi = c.dataset.r === 'epic' || c.dataset.r === 'legend';
    const at = dealt + i * T_FLIP + (hi ? 260 : 0);
    if (hi) T(at - 380, () => c.classList.add('tease'));
    T(at, () => flip(c));
    last = Math.max(last, at);
  });
  T(last + 520, done);
}
function flip(c) {
  if (c.classList.contains('flip')) return;
  c.classList.remove('tease');
  c.classList.add('flip');
  const r = c.dataset.r;
  if (r === 'legend' || r === 'epic') { play(r === 'legend' ? 'fusion' : 'pickConfirm'); setTimeout(() => c.classList.add('pop'), 220); }
}
function finishCards() {
  clearT();
  for (const c of fx.el.querySelectorAll('.sm-card')) { c.style.setProperty('--d', '0s'); flip(c); }
  T(450, done);
}
function done() {
  clearT();
  for (const c of fx.el.querySelectorAll('.sm-card:not(.flip)')) flip(c);
  setPh('done');
  const r = fx.r, nw = r.results.filter(x => x.isNew).length, m = meta();
  const best = R_ORDER.indexOf(r.top);
  fx.$('.sm-fx-sum').innerHTML = fx.xchg ? `<span>${svg('shard')}별조각 교환 완료 · 옷장에서 장착해 보세요</span>`
    : `<span>새 외형 <b class="k-num">${nw}</b></span>${r.shards ? `<span>${svg('shard')}별조각 <b class="k-num">+${fmt(r.shards)}</b></span>` : ''}`
    + `<span>전설 천장까지 <b class="k-num">${PITY - (m.summon.pity?.[fx.banner] | 0)}</b>회</span>`;
  if (r.shards) play('coin');
  const pr = pullPrice(m, fx.n), again = fx.$('.sm-fx-again');
  again.querySelector('.k-sub').innerHTML = `${curIco(pr.cur)}<b class="k-cost">${fmt(pr.cost)}</b>`; // .is-poor면 kit.css가 값을 붉게
  again.classList.toggle('is-poor', !pr.ok);
  again.firstElementChild.textContent = pr.ok ? '한 번 더' : pr.cur === 'gems' ? '보석 부족' : '소환권 부족';
  again.classList.toggle('secondary', best < 3);
  fx.$('.sm-fx-ok').focus({ preventScroll: true });
}
function skipFx() {
  if (!fx || fx.el.hidden) return;
  cutStop?.(); cutStop = null;
  for (const c of fx.el.querySelectorAll('.sm-card')) { c.style.setProperty('--d', '0s'); c.classList.add('flip'); }
  done();
}
function closeFx() {
  if (!fx || fx.el.hidden) return;
  clearT();
  cutStop?.(); cutStop = null;
  fx.el.hidden = true;
  fx.$('.sm-cards').innerHTML = '';
  renderAltar();
  W.refresh();
}

// ═══════════ 확률 정보 ═══════════
function openOdds(bk) {
  const s = sheet('확률 정보', '<div class="k-tabs sm-odds-tabs" role="tablist"></div><div class="sm-odds-body"></div>');
  const tabs = s.sheet.querySelector('.sm-odds-tabs'), body = s.sheet.querySelector('.sm-odds-body');
  const bs = banners();
  tabs.innerHTML = bs.map(b => `<button class="k-tab" role="tab" data-k="${b.key}">${b.key === 'pickup' ? '픽업' : '상시'}</button>`).join('');
  const show = k => {
    for (const t of tabs.children) t.setAttribute('aria-selected', String(t.dataset.k === k));
    const t = oddsTable(k), maxR = Math.max(...t.rarities.map(r => r.rate));
    body.innerHTML = `<h3 class="sm-sec-h">${esc(t.banner?.name || '')}<em>천장 ${t.pity}회</em></h3>
      <ul class="sm-rules">${t.rules.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <h3 class="sm-sec-h">등급별 확률</h3>
      <table class="sm-rtbl"><tbody>${[...t.rarities].reverse().map(r => `<tr data-r="${r.key}"><td><span class="sm-rtag" data-r="${r.key}">${esc(r.name)}</span><i class="sm-rbar" style="transform:scaleX(${(r.rate / maxR).toFixed(3)})"></i></td><td>${pct(r.rate)}</td></tr>`).join('')}</tbody></table>
      <h3 class="sm-sec-h">외형별 확률<em>${t.items.length}종</em></h3>
      <ul class="sm-ilist">${t.items.map(it => `<li data-r="${it.rarity}" class="${it.pickup ? 'pk' : ''}">${thumb(it.key, 72)}<span>${esc(it.name)}${it.pickup ? '<i class="sm-pk">픽업</i>' : ''}<em>${esc(rarName(it.rarity))} · ${esc(kindName(COS_BY_KEY[it.key] || {}))}</em></span><b>${pct(it.rate)}</b></li>`).join('')}</ul>`;
  };
  for (const t of tabs.children) t.addEventListener('click', () => show(t.dataset.k));
  show(bk);
}

// ═══════════ 소환 내역 ═══════════
function openHist() {
  const h = history(meta());
  sheet('소환 내역', h.length
    ? `<h3 class="sm-sec-h">최근 소환<em>최근 100회 · 이 기기에만 저장</em></h3><ol class="sm-hist">${h.map(x => {
      const c = COS_BY_KEY[x.key];
      const chip = x.guar ? '<i class="sm-hchip g">확정</i>' : x.pity ? '<i class="sm-hchip">천장</i>' : '';
      return c ? `<li data-r="${x.rarity}">${thumb(x.key, 72)}<div><b>${esc(c.name)}${chip}</b><span>${esc(rarName(x.rarity))} · ${x.banner === 'pickup' ? '픽업 배너' : '상시 배너'}${x.dup ? ' · 중복 → 별조각' : ''}</span></div><em>${esc(dateText(x.t))}</em></li>` : '';
    }).join('')}</ol>`
    : `<div class="sm-empty">${svg('altar')}<b>아직 소환 기록이 없어요</b><span>제단에서 소환하면 여기에 남아요</span></div>`);
}

// ═══════════ 별조각 교환소 ═══════════
function openShop() {
  const s = sheet('별조각 교환소', '<div class="sm-shop-top"></div><div class="sm-grid sm-shop-grid"></div>', { ribbon: 'blue' });
  const render = () => {
    const m = meta(), sd = m.summon.shards;
    s.sheet.querySelector('.sm-shop-top').innerHTML = `${svg('shard')}<div><b class="k-num">${num(sd)}</b><br>중복으로 나온 외형은 별조각이 돼요. 원하는 외형을 골라 바로 가져가세요.</div>`;
    const list = [...COSMETICS].sort((a, b) => owns(m, a.key) - owns(m, b.key) || R_ORDER.indexOf(b.rarity) - R_ORDER.indexOf(a.rarity));
    const g = s.sheet.querySelector('.sm-shop-grid');
    g.innerHTML = list.map(c => {
      const own = owns(m, c.key), cost = SHARD_PRICE[c.rarity];
      return `<button class="sm-tile${own ? ' owned' : ''}${!own && sd < cost ? ' poor' : ''}" data-r="${c.rarity}" data-k="${c.key}" aria-label="${esc(c.name)} ${own ? '보유 중' : `별조각 ${cost}`}">
        ${thumb(c.key, 128)}<b>${esc(c.name)}</b>${own ? `<span class="sm-own">${icon('check')}</span><span class="sm-price">보유</span>` : `<span class="sm-price">${svg('shard')}${num(cost)}</span>`}</button>`;
    }).join('');
    for (const b of g.querySelectorAll('.sm-tile')) b.addEventListener('click', () => openItem(b.dataset.k, { onChange: render }));
  };
  render();
}

// ═══════════ 외형 상세(교환소 · 옷장 · 도감 공용) ═══════════
export function openItem(key, { onChange } = {}) {
  const c = COS_BY_KEY[key];
  if (!c) return;
  const m = meta(), own = owns(m, key), cost = SHARD_PRICE[c.rarity];
  const s = sheet(c.name, `<div class="sm-detail">
      <span class="sm-th" data-r="${c.rarity}"><canvas width="300" height="300"></canvas></span>
      <div><span class="sm-rtag" data-r="${c.rarity}">${esc(rarName(c.rarity))}</span> <span class="sm-rtag" data-r="common">${esc(SLOT_NAME[c.slot])}${c.slot === 'costume' ? ' · ' + esc(kindName(c)) : ''}</span></div>
      <p>${esc(c.desc || '')}</p>
      <div class="sm-src">획득처: <b>${esc(sourceText(key))}</b></div>
      <p class="sm-note">외형은 전투력에 영향을 주지 않아요.</p>
      <div class="sm-btnrow">${own ? `<button class="k-btn gray sm-d-x">닫기</button><button class="k-btn neutral sm-d-ward">${svg('robe')}옷장에서 보기</button>`
    : `<button class="k-btn gray sm-d-x">닫기</button><button class="k-btn secondary sm-d-buy${m.summon.shards < cost ? ' is-poor' : ''}"><span>교환</span><span class="k-sub">${svg('shard')}${num(cost)}</span></button>`}</div>
    </div>`, { ribbon: '', narrow: true, onClose: () => stop?.() });
  s.ov.querySelector('.k-ribbon').dataset.r = c.rarity;
  let stop = null;
  try { stop = playPreview(s.ov.querySelector('canvas'), key); } catch { /* */ } // 상세(교환 창)는 미보유도 제 모습 — 무엇을 사는지 보여 준다(이름·교환소 격자도 공개)
  s.ov.querySelector('.sm-d-x').addEventListener('click', s.close);
  s.ov.querySelector('.sm-d-ward')?.addEventListener('click', () => { s.close(); W.open({ key }); });
  s.ov.querySelector('.sm-d-buy')?.addEventListener('click', e => {
    const b = e.currentTarget;
    if (b.classList.contains('is-poor')) { shake(b); toast(`별조각이 ${num(cost - meta().summon.shards)}개 모자라요`, 'shard'); return; }
    if (!ctx.act({ type: 'cosExchange', key })) { toast('교환할 수 없어요', 'shard'); return; }
    s.close();
    onChange?.();
    renderAltar();
    W.refresh();
    if (c.rarity === 'epic' || c.rarity === 'legend') { // 영웅·전설 교환은 소환처럼 공개(빛 기둥 → 컷인 → 카드)
      playFx({ results: [{ key, rarity: c.rarity, isNew: true, shards: 0, pickup: false, pity: false, guar: false }], top: c.rarity, shards: 0 }, 1, null, { xchg: true });
      return;
    }
    play('pickConfirm');
    toast(`${c.name} 획득! 옷장에서 장착해 보세요`, 'robe');
  });
}

// ═══════════ 환영 선물(한 번) ═══════════
let giftOpen = false;
export function maybeGift() {
  if (!R || giftOpen || !giftPending(meta())) return false;
  giftOpen = true;
  const s = sheet('환영 선물!', `<div class="sm-detail">
      <span class="sm-th sm-gift" data-r="legend" aria-hidden="true"><i class="sm-gift-rays"></i>${svg('gift', 'sm-gift-box')}${[0, 1, 2].map(i => svg('ticket', `sm-gift-tk t${i}`)).join('')}</span>
      <p><b>외형 소환</b>이 열렸어요! 영웅·대마법사·마법 이펙트의 모습을 바꾸는 외형을 모아 보세요.<br>외형은 <b>전투력에 영향이 없어요.</b></p>
      <div class="sm-src">${svg('ticket')} 소환권 <b>10장</b> — 10회 소환 한 번!</div>
      <div class="sm-btnrow"><button class="k-btn gray sm-g-later">나중에</button><button class="k-btn sm-g-go">소환하러 가기</button></div>
    </div>`, { narrow: true, onClose: () => { giftOpen = false; ctx.act({ type: 'giftSeen' }); } });
  s.ov.querySelector('.sm-g-later').addEventListener('click', s.close);
  s.ov.querySelector('.sm-g-go').addEventListener('click', () => { s.close(); openAltar(); });
  play('synergy');
  return true;
}

// ═══════════ 옷장 · 도감 '외형' 탭(wardrobeui.js) ═══════════
export const openWardrobe = (o = {}) => { if (R) W.open(o); };
export const renderCosmeticCodex = (host, m) => W?.codex(host, m);
export const refreshSummonUI = () => { renderAltar(); W?.refresh(); };

// ── 결과 화면 '획득 소환권' 카드(ui.js renderResult 한 줄 — endRun 요약 sum.tickets = [{ src, n, label }]) ──
export function resultTickets(after, list) {
  let c = after?.parentElement?.querySelector('.sm-res-tk');
  if (!after || !Array.isArray(list) || !list.length) { c?.remove(); return; }
  if (!c) { c = document.createElement('div'); c.className = 'res-card sm-res-tk'; after.after(c); }
  const n = list.reduce((a, x) => a + (x.n | 0), 0);
  c.innerHTML = `<h3>획득 소환권</h3><ul>${list.map((x, i) => `<li style="--i:${i}">${svg('ticket')}<span>${esc(x.label)}</span><b class="k-num">+${x.n | 0}</b></li>`).join('')}</ul>`
    + `<p class="sm-res-tk-foot">${svg('altar')}정비 화면 <em>소환</em>에서 외형을 뽑아요 · 합계 <b class="k-num">+${n}</b></p>`;
}

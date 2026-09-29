// v0.1.2 보석 충전 화면 — 추천 패키지(초보자 · 월정액) · 보석 팩 6단계 · '결제 준비 중' 시트. 결제·지급·네트워크 없음.
// 상품 = gemstore.js GEM_PRODUCTS, 구매 버튼 = requestPurchase(id) 하나(지금은 준비 중 시트만 연다).
// 여는 곳: 정비 상단 보석 (+) · 상점 탭 '보석 충전' 배너(camp.js). 자기 전체 화면 층(z 262)과 뒤로 가기 스택. 배치 css/gemstore.css
import { GEM_PRODUCTS, requestPurchase, setPurchaseHandler, totalGems, wonText } from './gemstore.js';
import { svgURL } from './summonui.js';
import { icon } from './icons.js';

const INK = '#22163a';
const num = n => Math.floor(n).toLocaleString('ko-KR');

// ── 그림(인라인 SVG → data URL, ART §8: 잉크 외곽 · 2톤 · 좌상단 광택) ──
const PAL = { b: ['#4fd8ff', '#1a7ff0', '#d8fbff', '#0b3a8a'], p: ['#c98bff', '#7a2fe0', '#f3e0ff', '#3d1180'], k: ['#ff8fd0', '#e0307f', '#ffe0f2', '#7a0f45'] };
const gem = (x, y, s, r = 0, k = 'b') => {
  const [c, lo, hi, ln] = PAL[k];
  return `<g transform="translate(${x} ${y}) rotate(${r}) scale(${s}) translate(-24 -24)"><path d="M24 5 41 17 24 44 7 17z" fill="${c}"/><path d="M7 17h34L24 44z" fill="${lo}" opacity=".55"/><path d="M15 17 24 7l9 10z" fill="${hi}"/><path d="M7 17h34M15 17l9 27 9-27" fill="none" stroke="${ln}" stroke-width="1.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><path d="M24 5 41 17 24 44 7 17z" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><ellipse cx="17" cy="13" rx="3.5" ry="2" transform="rotate(-35 17 13)" fill="#fff" opacity=".75"/></g>`;
};
const spark = (x, y, s = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0-7 1.6-1.6 7 0 1.6 1.6 0 7-1.6 1.6-7 0-1.6-1.6z" fill="#fff"/>`;
const shadow = (w = 30) => `<ellipse cx="48" cy="88" rx="${w}" ry="5" fill="rgba(0,0,0,.32)"/>`;
const heap = y => gem(30, y + 8, .62, -24, 'p') + gem(66, y + 8, .62, 22, 'k') + gem(40, y, .7, -10) + gem(57, y, .7, 12, 'p') + gem(48, y - 10, .8, 0);
const chest = (c, big) => `${shadow(38)}
  <g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round">
    <path d="M16 52 21 22H75l5 30z" fill="${c.lid}"/><path d="M28 24l-3 28M68 24l3 28" stroke="${c.band}" stroke-width="5"/>
  </g>${heap(44)}${big ? gem(24, 40, .5, -30, 'k') + gem(74, 38, .52, 28) : ''}
  <g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round">
    <rect x="12" y="52" width="72" height="34" rx="5" fill="${c.body}"/><rect x="22" y="52" width="8" height="34" fill="${c.band}"/><rect x="66" y="52" width="8" height="34" fill="${c.band}"/>
    <rect x="40" y="56" width="16" height="17" rx="3" fill="${c.band}"/>
  </g><path d="M48 60l3.4 4-3.4 4.6-3.4-4.6z" fill="#ff5a6e" stroke="${INK}" stroke-width="1.6"/>
  <path d="M16 57h8" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>
  ${big ? gem(24, 84, .46, -18, 'p') + gem(76, 85, .44, 20, 'b') + `<path d="M34 16l4-9 7 6 3-9 3 9 7-6 4 9z" fill="#ffd23a" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>` : ''}`;
const ART = {
  1: () => shadow(16) + gem(48, 50, 1.25) + spark(72, 26, .8),
  2: () => shadow(24) + gem(32, 60, .85, -16, 'p') + gem(64, 60, .85, 16, 'k') + gem(48, 44, 1.05) + spark(76, 24, .8) + spark(20, 34, .55),
  3: () => shadow(32) + gem(26, 70, .72, -22, 'p') + gem(70, 70, .72, 22, 'k') + gem(48, 72, .78) + gem(36, 50, .82, -10) + gem(61, 50, .82, 12, 'p') + gem(48, 32, .92) + spark(78, 26, .9) + spark(16, 44, .6),
  4: () => `${shadow(32)}${gem(48, 26, .7, 0, 'p') + gem(34, 32, .62, -18) + gem(62, 32, .62, 18, 'k')}
    <g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"><path d="M26 44c-8 10-10 22-6 32 3 7 12 11 28 11s25-4 28-11c4-10 2-22-6-32z" fill="#8a4bd8"/>
    <rect x="22" y="38" width="52" height="10" rx="5" fill="#ffc92e"/></g><path d="M30 56c-3 7-3 14 0 19" stroke="#c9a2ff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".7"/>
    ${gem(48, 66, .6, 0) + gem(26, 84, .44, -20, 'k') + gem(72, 84, .44, 20)}${spark(80, 24, .85)}`,
  5: () => chest({ lid: '#e0a860', body: '#a8622a', band: '#ffc92e' }) + spark(82, 20, .9) + spark(14, 30, .6),
  6: () => chest({ lid: '#d58cff', body: '#6a2bc0', band: '#ffd23a' }, true) + spark(86, 22, 1) + spark(10, 26, .7) + spark(84, 60, .55),
  starter: () => `${shadow(32)}<g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"><rect x="18" y="42" width="60" height="42" rx="5" fill="#b85cff"/><rect x="14" y="32" width="68" height="14" rx="5" fill="#d7a6ff"/>
    <path d="M42 32h12v52H42z" fill="#ffc92e"/><path d="M48 32c-7-13-22-14-22-5s15 5 22 5zM48 32c7-13 22-14 22-5s-15 5-22 5z" fill="#ffc92e"/></g>
    <path d="M22 50h8" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>${gem(74, 70, .56, 16) + gem(22, 74, .5, -14, 'k')}${spark(84, 26, .9)}`,
  pass: () => `${shadow(30)}<g stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"><rect x="16" y="16" width="64" height="70" rx="10" fill="#2b2366"/><rect x="16" y="16" width="64" height="18" rx="9" fill="#5a46d6"/>
    <circle cx="32" cy="16" r="4" fill="#ffc92e"/><circle cx="64" cy="16" r="4" fill="#ffc92e"/></g>
    <path d="M58 46a15 15 0 1 0 6 22 12 12 0 1 1-6-22z" fill="#ffe45a" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>
    ${spark(34, 50, .6)}${spark(30, 72, .45)}${gem(70, 76, .52, 12)}`,
};
const artURLs = {};
const artURL = k => (artURLs[k] ||= 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">${ART[k]()}</svg>`));
export const gemStoreBannerArt = () => `<img class="gs-bn-art" src="${artURL(3)}" alt="" aria-hidden="true" draggable="false">`;

const PACKS = GEM_PRODUCTS.filter(p => p.kind === 'pack');
const artKey = p => (p.kind === 'pack' ? PACKS.indexOf(p) + 1 : p.kind);
const img = (k, cls) => `<img class="${cls}" src="${artURL(k)}" alt="" draggable="false">`;
const gemIco = () => icon('gem');
const title = p => (p.kind === 'pack' ? `보석 ${num(p.gems)}` : p.name);

function packCard(p) {
  const t = artKey(p);
  return `<button class="gs-pack" data-id="${p.id}" data-t="${t}" aria-label="보석 ${num(p.gems)}${p.bonus ? ` + 보너스 ${num(p.bonus)}` : ''} · ${wonText(p.price)}${p.first2x ? ' · 첫 구매 2배' : ''}">
    ${p.first2x ? '<span class="gs-x2" aria-hidden="true"><b>첫 구매</b>2배</span>' : ''}${p.tag ? `<span class="gs-tag" aria-hidden="true">${p.tag}</span>` : ''}
    <span class="gs-art-wrap" aria-hidden="true"><i class="gs-glow"></i>${img(t, 'gs-art')}</span>
    <b class="k-num gem-n gs-amt">${num(p.gems)}</b>
    <span class="gs-bonus${p.bonus ? '' : ' none'}">${p.bonus ? `${gemIco()}+${num(p.bonus)} 보너스` : '기본 팩'}</span>
    <span class="k-btn s gs-price" aria-hidden="true">${wonText(p.price)}</span>
  </button>`;
}
function featCard(p) {
  const pass = p.kind === 'pass';
  const items = pass
    ? `<span class="gs-chip">${gemIco()}즉시 <b>${num(p.gems)}</b></span><span class="gs-chip">${gemIco()}매일 <b>${num(p.daily)}</b> · ${p.days}일</span>`
    : `<span class="gs-chip">${gemIco()}<b>${num(p.gems)}</b></span><span class="gs-chip"><img class="k-ico" src="${svgURL('ticket')}" alt="">소환권 <b>${p.tickets}</b></span>`;
  return `<button class="gs-feat-card ${pass ? 'pass' : 'starter'}" data-id="${p.id}" aria-label="${p.name} · ${wonText(p.price)}">
    <span class="gs-ribbon" aria-hidden="true">${pass ? '월정액' : '1회 한정'}</span>
    <span class="gs-art-wrap" aria-hidden="true"><i class="gs-glow"></i>${img(artKey(p), 'gs-art')}</span>
    <span class="gs-feat-body"><b class="gs-feat-name">${p.name}</b>
      <span class="gs-feat-desc">${pass ? `30일 동안 매일 보석 · 총 <em>${num(totalGems(p))}</em> 보석` : '처음 한 번만 · 모험 시작에 딱 좋은 구성'}</span>
      <span class="gs-chips">${items}</span></span>
    <span class="k-btn s gs-price" aria-hidden="true">${wonText(p.price)}</span>
  </button>`;
}

let S = null; // { el, sheet, back, focus }
const layers = [];

function build() {
  const el = document.createElement('section');
  el.className = 'gs-scr';
  el.hidden = true;
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', '보석 충전');
  el.innerHTML = `
    <i class="gs-bg" aria-hidden="true"></i>
    <header class="gs-head cw">
      <button class="k-btn round s danger gs-back" aria-label="닫기">${icon('close')}</button>
      <h1 class="gs-title">보석 충전</h1>
      <span class="gs-pill" aria-label="보유 보석">${gemIco()}<b class="k-num gem-n gs-have">0</b></span>
    </header>
    <div class="gs-body"><div class="cw gs-wrap">
      <div class="gs-promo">
        ${img(2, 'gs-promo-art')}
        <div><b class="gs-promo-h">첫 구매 보석 <em>2배</em>!</b><span>팩마다 첫 1회는 보너스 대신 기본 보석 2배</span></div>
      </div>
      <h2 class="gs-h">추천 패키지</h2>
      <div class="gs-feat">${GEM_PRODUCTS.filter(p => p.kind !== 'pack').sort((a, b) => (a.kind === 'starter' ? -1 : 1) - (b.kind === 'starter' ? -1 : 1)).map(featCard).join('')}</div>
      <h2 class="gs-h">보석</h2>
      <div class="gs-grid">${PACKS.map(packCard).join('')}</div>
      <footer class="gs-foot">
        <p>결제 기능은 준비 중입니다. 실제 결제는 이루어지지 않습니다.</p>
        <p>청약철회·환불 정책은 결제 오픈 시 안내해 드립니다.</p>
      </footer>
    </div></div>`;
  document.getElementById('app').append(el);
  el.querySelector('.gs-back').addEventListener('click', closeStore);
  for (const b of el.querySelectorAll('[data-id]')) b.addEventListener('click', () => requestPurchase(b.dataset.id));
  // Esc: 이 층이 떠 있으면 아래 모달보다 먼저 받는다(문서 캡처 단계)
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && layers.length) { e.preventDefault(); e.stopImmediatePropagation(); gemStoreHandleBack(); } }, true);
  setPurchaseHandler(openPending);
  S = { el };
}

// '결제 준비 중' 시트 — requestPurchase가 부른다. 보석·저장은 그대로.
function openPending(p) {
  if (!S) return;
  const ov = document.createElement('div');
  ov.className = 'gs-ov';
  const sub = p.kind === 'pack' ? (p.bonus ? `+ 보너스 ${num(p.bonus)}` : '') : p.kind === 'pass' ? `즉시 ${num(p.gems)} + 매일 ${num(p.daily)} · ${p.days}일` : `보석 ${num(p.gems)} · 소환권 ${p.tickets}장`;
  ov.innerHTML = `<div class="k-modal dark narrow" role="alertdialog" aria-modal="true" aria-labelledby="gs-pd-h" aria-describedby="gs-pd-msg" tabindex="-1">
    <div class="k-ribbon gold"><h2 id="gs-pd-h">결제 준비 중</h2></div>
    <button class="k-close" aria-label="닫기">${icon('close')}</button>
    <div class="k-sheet gs-pd">
      <span class="gs-art-wrap" data-t="${artKey(p)}" aria-hidden="true"><i class="gs-glow"></i>${img(artKey(p), 'gs-art')}</span>
      <b class="gs-pd-name">${title(p)}</b>${sub ? `<span class="gs-pd-sub">${sub}</span>` : ''}
      <span class="gs-pd-price">${wonText(p.price)}</span>
      <p class="gs-pd-msg" id="gs-pd-msg">결제 준비 중이에요. 곧 열려요!</p>
      <p class="gs-pd-note">지금은 결제가 이루어지지 않고, 보석도 지급되지 않아요.</p>
      <button class="k-btn wide gs-pd-ok">확인</button>
    </div></div>`;
  const close = () => { if (!ov.isConnected) return; pop(ov); ov.remove(); S.el.querySelector(`[data-id="${p.id}"]`)?.focus({ preventScroll: true }); };
  ov.querySelector('.k-close').addEventListener('click', close);
  ov.querySelector('.gs-pd-ok').addEventListener('click', close);
  ov.addEventListener('click', e => { if (e.target === ov) close(); });
  S.el.append(ov);
  layers.push({ el: ov, close });
  ov.querySelector('.gs-pd-ok').focus({ preventScroll: true });
}
const pop = el => { const i = layers.findIndex(l => l.el === el); if (i >= 0) layers.splice(i, 1); };

// gems = 보유 보석(표시만 — 이 화면은 보석을 바꾸지 않는다)
export function openGemStore(gems = 0) {
  if (!S) build();
  const el = S.el;
  el.querySelector('.gs-have').textContent = num(Number(gems) || 0);
  if (!el.hidden) return;
  S.focus = document.activeElement;
  el.hidden = false;
  el.querySelector('.gs-body').scrollTop = 0;
  layers.push({ el, close: closeStore });
  el.querySelector('.gs-back').focus({ preventScroll: true });
}
function closeStore() {
  if (!S || S.el.hidden) return;
  while (layers.length && layers[layers.length - 1].el !== S.el) layers[layers.length - 1].close();
  pop(S.el);
  S.el.hidden = true;
  S.focus?.focus?.({ preventScroll: true });
}
// 안드로이드 뒤로 가기 · Esc: 맨 위 시트 → 화면
export function gemStoreHandleBack() {
  const top = layers[layers.length - 1];
  if (!top) return false;
  top.close();
  return true;
}

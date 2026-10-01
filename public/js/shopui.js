// 정비 화면 상점 UI(4차 경제 싱크) — '상점' 탭의 [상자 | 강화 | 유물] 세그먼트 · 출정 탭의 '출정 준비' 카드 · 상자 개봉 연출.
// camp.js가 만들고 부른다. 메타는 읽기만, 구매는 H.onCampAct({type:'box'|'prep'|'relic', key}) → main.js → run.js campAct → shop.js
import { PREP, prepCost, BOXES, boxCost, boxOdds, boxIlvl, shopOffers } from './shop.js';
import { RELICS, lockedRelics, relicUnlockCost } from './relics.js';
import { RARITIES, SLOT_NAMES, SUBSTATS, itemPower } from './hero.js';
import { MAIN_STAT_NAME } from './heroui.js';
import { itemIconURL } from './art/units.js';
import { relicImg } from './art/relicart.js'; // 유물 메달(유물 트랙 그림)
import { icon } from './icons.js';
import { fmt } from './util.js';
import { bagJammed } from './loot.js'; // v0.1.7

const RAR = Object.fromEntries(RARITIES.map(r => [r.key, r]));
const SUB_NAME = Object.fromEntries(SUBSTATS.map(s => [s.key, s.name]));
const INK = '#22163a';

// ── 그림(인라인 SVG, ART §8: 잉크 외곽 3px · 2톤 · 좌상단 광택) ──
const CHEST = {
  gear: { lid: '#e0a860', body: '#a8622a', band: '#ffc92e', gem: '#4fd8ff' },
  fine: { lid: '#9fdcff', body: '#2f7fe0', band: '#eef4ff', gem: '#b85cff' },
  legend: { lid: '#d58cff', body: '#6a2bc0', band: '#ffd23a', gem: '#ff5a6e', crown: true },
};
const chestSVG = k => {
  const c = CHEST[k];
  return `<svg class="sh-chest" viewBox="0 0 64 64" aria-hidden="true">
    <ellipse cx="32" cy="58" rx="23" ry="4" fill="rgba(0,0,0,.35)"/>
    <g stroke="${INK}" stroke-width="3" stroke-linejoin="round">
      <g class="sh-lid"><path d="M9 29C9 16 19 11 32 11s23 5 23 18z" fill="${c.lid}"/><path d="M17 27c0-9 2-12 5-14M47 27c0-9-2-12-5-14" fill="none" stroke="${c.band}" stroke-width="5"/>
      ${c.crown ? `<path d="M24 11l2-7 6 4 6-4 2 7z" fill="#ffd23a"/>` : ''}</g>
      <rect x="9" y="28" width="46" height="27" rx="4" fill="${c.body}"/>
      <rect x="16" y="28" width="7" height="27" fill="${c.band}"/><rect x="41" y="28" width="7" height="27" fill="${c.band}"/>
      <rect x="26" y="23" width="12" height="15" rx="3" fill="${c.band}"/>
    </g>
    <path d="M32 26l3.5 4.5L32 35l-3.5-4.5z" fill="${c.gem}" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
    <ellipse cx="17" cy="18" rx="4" ry="2" transform="rotate(-32 17 18)" fill="#fff" opacity=".75"/>
  </svg>`;
};
const PREP_SVG = {
  card: `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><path d="M13 11h22v27H13z" fill="#fff3d6"/><rect x="9" y="7" width="30" height="8" rx="4" fill="#e0a860"/><rect x="9" y="34" width="30" height="8" rx="4" fill="#e0a860"/></g><path d="M19 21h10M19 27h7" stroke="#b85cff" stroke-width="3" stroke-linecap="round"/><path d="M33 18l1.5 3 3 1.5-3 1.5-1.5 3-1.5-3-3-1.5 3-1.5z" fill="#ffc92e"/>`,
  rare: `<path d="M24 4v7" stroke="${INK}" stroke-width="3"/><circle cx="24" cy="27" r="15" fill="#ffc92e" stroke="${INK}" stroke-width="3"/><circle cx="24" cy="27" r="10" fill="#e08a00"/><g fill="#5fe06e" stroke="${INK}" stroke-width="2"><circle cx="20" cy="23" r="4.2"/><circle cx="28" cy="23" r="4.2"/><circle cx="20" cy="31" r="4.2"/><circle cx="28" cy="31" r="4.2"/></g><ellipse cx="17" cy="19" rx="3" ry="1.8" transform="rotate(-35 17 19)" fill="#fff" opacity=".7"/>`,
  ward: `<path d="M24 5l16 6v11c0 11-7 18-16 22C15 40 8 33 8 22V11z" fill="#4fd06a" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M24 11l10 4v7c0 7-4 12-10 15" fill="#9dffb0" opacity=".55"/><path d="M24 15v16M18 21l6-6 6 6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  forget: `<g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><rect x="19" y="5" width="10" height="6" rx="2" fill="#c8894a"/><path d="M20 11v6c-7 3-11 8-11 14 0 8 7 13 15 13s15-5 15-13c0-6-4-11-11-14v-6z" fill="#efd6ff"/></g><path d="M11.5 30c4-2 8 2 12.5 0s8.5-2 12.5 0c0 7-6 11-12.5 11S11.5 37 11.5 30z" fill="#b85cff"/><circle cx="20" cy="34" r="2" fill="#fff" opacity=".8"/><ellipse cx="16" cy="23" rx="2.5" ry="1.6" transform="rotate(-40 16 23)" fill="#fff" opacity=".8"/>`,
};
const prepArt = k => `<svg viewBox="0 0 48 48" aria-hidden="true">${PREP_SVG[k]}</svg>`;
const curIco = cur => icon(cur === 'gold' ? 'coin' : 'gem');
const oddsHTML = odds => {
  const sum = odds.reduce((a, b) => a + b, 0) || 1;
  const bar = RARITIES.map((r, i) => (odds[i] > 0 ? `<i data-r="${r.key}" style="flex:${odds[i]}"></i>` : '')).join('');
  const leg = RARITIES.map((r, i) => (odds[i] > 0 ? `<span data-r="${r.key}"><i></i>${r.name} ${Math.round(odds[i] / sum * 1000) / 10}%</span>` : '')).join('');
  return `<div class="sh-odds">${bar}</div><div class="sh-odds-leg">${leg}</div>`;
};

export function createShopUI(el, pane, prepHost, H = {}) {
  const $ = s => el.querySelector(s);
  const on = (e, ev, fn) => e.addEventListener(ev, fn);
  const shake = b => { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); };
  let meta = null, sec = null;

  // ── 상점 탭: 세그먼트 + 상자 · 유물 절(강화 절은 camp.js의 보석 강화 목록) ──
  pane.insertAdjacentHTML('afterbegin', `
    <div class="k-tabs sh-seg" role="tablist" aria-label="상점 분류">
      <button class="k-tab" data-sec="box" role="tab">상자<i class="k-dot" hidden></i></button>
      <button class="k-tab" data-sec="meta" role="tab">보석 강화<i class="k-dot" hidden></i></button>
      <button class="k-tab" data-sec="relic" role="tab">유물<i class="k-dot" hidden></i></button>
    </div>
    <div class="sh-sec" data-sec="box">
      <p class="cp-note sh-lead">상자는 도전 중 드롭과 같은 장비를 줘요. <b>강화는 없고</b>, 가방(30칸)이 차면 가장 약한 장비를 자동으로 팔아요.</p>
      <div class="sh-boxes">${BOXES.map(b => `
        <div class="sh-box" data-k="${b.key}">
          <span class="sh-box-art">${chestSVG(b.key)}</span>
          <div class="sh-box-body"><b class="sh-box-name">${b.name}</b><p>${b.desc}<span class="sh-ilvl"></span></p><div class="sh-box-odds"></div></div>
          <button class="k-btn s ${b.cur === 'gold' ? '' : 'secondary '}sh-buy">${curIco(b.cur)}<b class="k-cost k-num"></b></button>
        </div>`).join('')}
      </div>
    </div>
    <div class="sh-sec" data-sec="relic">
      <div class="sh-relic-top"><div><b>유물 도감</b><span class="sh-relic-n"></span></div><p>네임드 보스(10층마다)를 잡으면 <b>풀에 든 유물 3개 중 하나</b>를 골라요. 보석으로 새 유물을 풀에 넣어요.</p></div>
      <div class="sh-relics"></div>
    </div>`);
  const secs = [...pane.querySelectorAll('.sh-sec')], tabs = [...pane.querySelectorAll('.sh-seg .k-tab')];
  for (const t of tabs) on(t, 'click', () => { setSec(t.dataset.sec); render(true); });
  let rlOrder = null; // 유물 도감 줄 순서(renderRelics)
  function setSec(s) {
    sec = s;
    rlOrder = null; // 유물 줄 순서는 탭을 열 때 한 번만 정한다(아래 renderRelics)
    for (const t of tabs) t.setAttribute('aria-selected', String(t.dataset.sec === s));
    for (const x of secs) x.hidden = x.dataset.sec !== s;
  }

  for (const row of pane.querySelectorAll('.sh-box')) {
    const b = row.querySelector('.sh-buy');
    on(b, 'click', () => buyBox(row.dataset.k, b));
  }
  function buyBox(k, btn) {
    const box = BOXES.find(x => x.key === k);
    if (!(meta[box.cur] >= boxCost(k, meta.best))) { if (btn) shake(btn); H.toast?.(box.cur === 'gold' ? '골드가 부족해요' : '보석이 부족해요', box.cur === 'gold' ? 'coin' : 'gem'); return; }
    if (bagJammed(meta.hero)) { if (btn) shake(btn); H.toast?.('가방이 잠근 장비로 가득 찼어요 — 잠금을 풀거나 팔아 주세요', 'bag'); return; } // shop.js openBox도 막는다
    const before = Object.fromEntries(Object.entries(meta.hero.equip).map(([s, it]) => [s, it]));
    const r = H.onCampAct?.({ type: 'box', key: k });
    if (!r || !r.item) return;
    reveal(k, r, before[r.item.slot]);
    render(true);
  }

  // ── 상자 개봉 연출: 상자 흔들림(0.55초) → 빛 터짐 → 등급 카드 등장. 탭하면 바로 결과 ──
  el.insertAdjacentHTML('beforeend', `
    <div class="cp-ov sh-rv-ov" hidden>
      <div class="sh-rv" role="dialog" aria-modal="true" aria-label="상자 결과">
        <div class="sh-rv-rays" aria-hidden="true"></div>
        <div class="sh-rv-chest" aria-hidden="true"></div>
        <div class="sh-rv-card">
          <div class="sh-rv-rib"><b class="sh-rv-rar"></b></div>
          <div class="sh-rv-ico"><img alt="" draggable="false"></div>
          <b class="sh-rv-name"></b>
          <span class="sh-rv-sub"></span>
          <div class="sh-rv-stats"></div>
          <div class="sh-rv-note"></div>
        </div>
        <div class="sh-rv-btns">
          <button class="k-btn gray sh-rv-ok">확인</button>
          <button class="k-btn sh-rv-again"><span>한 번 더</span><span class="k-sub"></span></button>
        </div>
      </div>
    </div>`);
  const ov = $('.sh-rv-ov'), rv = $('.sh-rv');
  let rvKey = null, rvTimer = 0;
  function reveal(k, r, prev) {
    const it = r.item, R = RAR[it.rarity];
    rvKey = k;
    rv.dataset.r = it.rarity;
    rv.classList.remove('open', 'skip');
    $('.sh-rv-chest').innerHTML = chestSVG(k);
    $('.sh-rv-rar').textContent = R.name;
    $('.sh-rv-ico img').src = itemIconURL(it.slot, it.rarity, meta.hero.cls || 'knight', 240);
    $('.sh-rv-name').textContent = it.name;
    $('.sh-rv-sub').textContent = `${SLOT_NAMES[it.slot]} · 아이템 Lv.${it.ilvl} · 전투력 ${fmt(itemPower(it))}`;
    $('.sh-rv-stats').innerHTML = `<div class="hu-stat main"><span>${MAIN_STAT_NAME[it.main.key] || it.main.key}</span><b class="k-num">+${it.main.value.toFixed(1)}%</b></div>`
      + it.subs.map(s => `<div class="hu-stat"><span>${SUB_NAME[s.key] || s.key}</span><b class="k-num">+${s.value.toFixed(1)}%</b></div>`).join('');
    const diff = itemPower(it) - itemPower(prev);
    $('.sh-rv-note').innerHTML = r.soldItem === it // 가방이 가득 차고 이 장비가 가장 약했다 = 바로 팔림
      ? `<span class="sold">${icon('coin')}가방이 가득 차 바로 팔았어요 <b class="k-num gold">+${fmt(r.sold)}</b></span>`
      : ((r.equipped
      ? `<span class="up">${icon('check')}자동 장착! 전투력 <b class="k-num ok">${prev ? '+' + fmt(diff) : '+' + fmt(itemPower(it))}</b></span>`
      : `<span>${icon('bag')}가방에 넣었어요${prev ? ` · 착용 중 대비 <b class="k-num ${diff >= 0 ? 'ok' : 'bad'}">${diff >= 0 ? '+' : ''}${fmt(diff)}</b>` : ''}</span>`)
      + (r.sold ? `<span class="sold">${icon('coin')}가방이 가득 차 약한 장비를 팔았어요 <b class="k-num gold">+${fmt(r.sold)}</b></span>` : ''));
    ov.hidden = false;
    void rv.offsetWidth;
    rv.classList.add('shaking');
    clearTimeout(rvTimer);
    rvTimer = setTimeout(openCard, 560);
    renderAgain();
  }
  function openCard() {
    clearTimeout(rvTimer);
    if (!rv.classList.contains('shaking')) return;
    rv.classList.remove('shaking');
    rv.classList.add('open');
    $('.sh-rv-ok').focus({ preventScroll: true });
  }
  function renderAgain() {
    const box = BOXES.find(x => x.key === rvKey), c = boxCost(rvKey, meta.best), b = $('.sh-rv-again');
    b.querySelector('.k-sub').innerHTML = `${curIco(box.cur)}${fmt(c)}`;
    b.classList.toggle('secondary', box.cur === 'gems');
    b.classList.toggle('is-poor', !(meta[box.cur] >= c));
  }
  function closeReveal() { if (ov.hidden) return false; clearTimeout(rvTimer); ov.hidden = true; rv.classList.remove('shaking', 'open'); return true; }
  on(rv, 'click', e => { if (rv.classList.contains('shaking') && !e.target.closest('button')) openCard(); });
  on(ov, 'click', e => { if (e.target === ov) (rv.classList.contains('shaking') ? openCard() : closeReveal()); });
  on($('.sh-rv-ok'), 'click', closeReveal);
  on($('.sh-rv-again'), 'click', e => {
    const b = e.currentTarget;
    if (b.classList.contains('is-poor')) { shake(b); return; }
    buyBox(rvKey, b);
  });

  // ── 유물 도감 ──
  function renderRelics() {
    const locked = lockedRelics(meta);
    // 살 수 있는(잠긴) 유물 먼저 — 탭을 연 순간에만 정렬. 사자마자 줄이 움직이면 두 번 탭이 다음 유물을 사 버린다
    if (!rlOrder) rlOrder = [...RELICS].sort((a, b) => locked.includes(b.key) - locked.includes(a.key));
    txt(pane.querySelector('.sh-relic-n'), `풀 ${RELICS.length - locked.length}/${RELICS.length}`);
    const host = pane.querySelector('.sh-relics'), sig = [meta.gems, locked.join()].join('|');
    if (host.dataset.sig === sig) return;
    host.dataset.sig = sig;
    host.innerHTML = rlOrder.map(r => {
      const lk = locked.includes(r.key), c = relicUnlockCost(r.key);
      return `<div class="sh-rl${lk ? ' locked' : ''}" data-k="${r.key}">
        <span class="sh-rl-art">${relicImg(r.key, 'sh-rl-img')}</span>
        <div class="sh-rl-body"><b>${r.name}</b><span class="up">${r.up}</span><span class="dn">${r.down}</span></div>
        ${lk ? `<button class="k-btn s secondary sh-rl-buy${meta.gems >= c ? '' : ' is-poor'}" aria-label="${r.name} 해금, 보석 ${c}개">${icon('gem')}<b class="k-cost k-num">${c}</b></button>`
          : `<span class="sh-rl-own">${icon('check')}${r.start ? '기본' : '해금'}</span>`}
      </div>`;
    }).join('');
    for (const b of host.querySelectorAll('.sh-rl-buy')) on(b, 'click', () => {
      const row = b.closest('.sh-rl');
      if (b.classList.contains('is-poor')) { shake(b); H.toast?.('보석이 부족해요', 'gem'); return; }
      if (!H.onCampAct?.({ type: 'relic', key: row.dataset.k })) return;
      H.toast?.(`${RELICS.find(r => r.key === row.dataset.k)?.name} — 보스 보상 풀에 들어갔어요`, 'gem');
      render(true);
    });
  }

  // ── 출정 준비(출정 탭 카드) ──
  prepHost.innerHTML = `
    <h3 class="cp-h">${icon('bag')}출정 준비<em class="cp-h-sub">이번 도전 한 번 · 다시 누르면 환불</em></h3>
    <div class="sh-prep-grid">${PREP.map(p => `
      <button class="sh-pp" data-k="${p.key}" data-tone="${p.tone}" aria-pressed="false">
        <span class="sh-pp-art">${prepArt(p.key)}</span>
        <span class="sh-pp-txt"><b>${p.name}</b><span>${p.short}</span></span>
        <span class="sh-pp-cost"></span>
        <i class="sh-pp-chk" aria-hidden="true">${icon('check')}</i>
      </button>`).join('')}
    </div>
    <p class="cp-note sh-prep-note"></p>`;
  for (const b of prepHost.querySelectorAll('.sh-pp')) on(b, 'click', () => {
    const k = b.dataset.k, owned = !!meta.prep?.[k];
    if (!owned && b.classList.contains('is-poor')) { shake(b); H.toast?.('골드가 부족해요 — 도전에서 모아 와요', 'coin'); return; }
    if (!H.onCampAct?.({ type: 'prep', key: k })) return;
    if (!owned) b.animate([{ scale: 1 }, { scale: 1.06, offset: 0.35 }, { scale: 1 }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    render(true);
  });
  function renderPrep() {
    let total = 0, n = 0;
    for (const b of prepHost.querySelectorAll('.sh-pp')) {
      const k = b.dataset.k, c = prepCost(k, meta.best), owned = !!meta.prep?.[k];
      if (owned) { total += c; n++; }
      b.setAttribute('aria-pressed', String(owned));
      b.classList.toggle('is-poor', !owned && meta.gold < c);
      b.querySelector('.sh-pp-cost').innerHTML = owned ? '준비됨' : `${icon('coin')}<b class="k-num">${fmt(c)}</b>`;
      b.setAttribute('aria-label', `${PREP.find(p => p.key === k).name}: ${PREP.find(p => p.key === k).desc}. ${owned ? '준비됨, 누르면 환불' : `골드 ${fmt(c)}`}`);
      b.title = PREP.find(p => p.key === k).desc;
    }
    txt(prepHost.querySelector('.sh-prep-note'), n ? `${n}개 준비 · ${fmt(total)}골드 — '도전 시작'을 누르면 이번 도전에 써요.` : '값은 최고 기록에 맞춰 올라요. 도전이 끝나면 사라지니 매번 새로 준비해요.');
    prepHost.querySelector('.cp-h-sub').textContent = n ? `${n}/${PREP.length} 준비` : '이번 도전 한 번 · 다시 누르면 환불';
  }

  function txt(e, s) { if (e && e.textContent !== s) e.textContent = s; }

  function renderBoxes() {
    for (const row of pane.querySelectorAll('.sh-box')) {
      const k = row.dataset.k, box = BOXES.find(x => x.key === k), c = boxCost(k, meta.best), b = row.querySelector('.sh-buy');
      txt(b.querySelector('b'), fmt(c));
      b.classList.toggle('is-poor', !(meta[box.cur] >= c));
      b.setAttribute('aria-label', `${box.name} 열기, ${box.cur === 'gold' ? '골드' : '보석'} ${fmt(c)}`);
      txt(row.querySelector('.sh-ilvl'), ` · 아이템 Lv.${boxIlvl(meta)}`);
      const odds = boxOdds(k, meta.best), os = odds.join();
      const oh = row.querySelector('.sh-box-odds');
      if (oh.dataset.o !== os) { oh.dataset.o = os; oh.innerHTML = oddsHTML(odds); }
    }
  }

  // 탭 알림: 보석 강화·보석 돌파·유물 해금 중 살 수 있는 것(상자는 늘 살 수 있는 반복 소비라 점을 켜지 않는다)
  function dots(m = meta) {
    const aff = shopOffers(m).filter(o => m[o.cur] >= o.cost);
    const d = { meta: aff.some(o => o.id.startsWith('meta:') || o.id.startsWith('gemBreak:')), relic: aff.some(o => o.id.startsWith('relic:')), box: false };
    return { ...d, any: d.meta || d.relic };
  }

  let sig = '';
  function render(force = false) {
    if (!meta) return;
    renderPrep();
    if (pane.hidden) return;
    if (!sec) setSec(dots().meta ? 'meta' : 'box');
    const s = [meta.gold, meta.gems, meta.best, sec, (meta.relicUnlocked || []).join()].join('|');
    if (!force && s === sig) return;
    sig = s;
    const d = dots();
    for (const t of tabs) t.querySelector('.k-dot').hidden = !d[t.dataset.sec] || t.dataset.sec === sec;
    if (sec === 'box') renderBoxes();
    if (sec === 'relic') renderRelics();
  }

  return {
    setMeta(m) { meta = m; sig = ''; rlOrder = null; },
    render, dots,
    isMetaSec: () => sec === 'meta',
    reset() { sec = null; },
    handleBack: () => closeReveal(),
    hide() { closeReveal(); },
  };
}

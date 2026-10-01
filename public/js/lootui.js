// 전리품 연출 · 알림 (DOM) — 좋은 드롭 획득 카드(1초 이내, 탭하면 넘김) · 자동 장착 알림 · 자동 판매 묶음 알림 ·
// 결과 화면 '이번 도전 최고 획득' · 설정 화면 '장비 자동 판매' 줄. 정책은 loot.js, 가방 화면은 heroui.js. docs/DESIGN.md 'v0.1.7 전리품' 절
import { RARITIES, SLOT_NAMES, itemPower } from './hero.js';
import { UNIQUE_BY_KEY, SET_BY_KEY, setCounts } from './items.js';
import { goodDrop, autoSellCfg, AUTO_SELL_UPTO, AUTO_SELL_NAME } from './loot.js';
import { itemIconURL } from './art/units.js';
import { fmt } from './util.js';

const R_BY = Object.fromEntries(RARITIES.map(r => [r.key, r]));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const RIBBON = { legend: '전설 획득!', epic: '영웅 획득!', rare: '희귀 획득', uncommon: '고급 획득', common: '획득' };
const CARD_MS = { in: 170, hold: 560, out: 230 }; // 합계 0.96초(스펙: 1초 이내)
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// 고유 · 세트 한 줄(카드·결과·가방 공용)
export function uniqLine(it) {
  const u = it && UNIQUE_BY_KEY[it.unique];
  return u ? `<p class="lt-uniq" data-r="${u.rarity}"><em>${esc(u.title)}</em>${esc(u.desc)}</p>` : '';
}
export function setLine(it, hero) {
  const s = it && SET_BY_KEY[it.set];
  if (!s) return '';
  const n = hero ? setCounts(hero)[s.key] || 0 : 0;
  return `<p class="lt-set" style="--sc:${s.color}"><em>세트</em>${esc(s.name)}${hero ? ` <b>${n}/4</b>` : ''}</p>`;
}

export function createLootUI(root, { getHero, persist } = {}) {
  const col = root.querySelector('#col') || root;
  const rv = document.createElement('div');
  rv.className = 'lt-reveal';
  rv.hidden = true;
  rv.innerHTML = '<i class="lt-rays" aria-hidden="true"></i><button class="lt-card" aria-label="획득 장비(탭하면 넘김)"></button>';
  const card = rv.lastChild;
  const pill = document.createElement('div');
  pill.className = 'lt-sold';
  pill.hidden = true;
  pill.setAttribute('aria-live', 'polite');
  const eqNote = document.createElement('div');
  eqNote.className = 'lt-eq';
  eqNote.hidden = true;
  col.append(rv, pill, eqNote);

  // ── 획득 카드(좋은 드롭만): 뒤집히며 등장 → 잠깐 → 영웅 버튼으로 날아감. 탭하면 바로 넘김. 전투는 멈추지 않는다 ──
  const queue = [];
  let anim = null, showing = false;
  function heroBtnDelta() {
    const b = root.querySelector('#btn-hero'), cr = card.getBoundingClientRect();
    if (!b || b.hidden || !cr.width) return [0, -80];
    const br = b.getBoundingClientRect();
    return [br.left + br.width / 2 - (cr.left + cr.width / 2), br.top + br.height / 2 - (cr.top + cr.height / 2)];
  }
  function show(ev, hero) {
    const it = ev.item, R = R_BY[it.rarity] || R_BY.common, cls = hero?.cls || 'knight';
    rv.dataset.r = it.rarity;
    const cmp = ev.lost ? '<p class="lt-cmp">가방이 가득 차 바로 팔았어요</p>' // loot.js gainItem lost
      : ev.equipped ? `<p class="lt-cmp eq">자동 장착! 전투력 <b>▲ ${fmt(Math.max(0, ev.gain | 0))}</b></p>`
      : ev.up > 0 ? `<p class="lt-cmp up">지금 장비보다 좋아요 <b>▲ ${fmt(ev.up | 0)}</b></p>` : '';
    card.innerHTML = `<span class="lt-rb">${RIBBON[it.rarity] || '획득'}</span>
      <span class="lt-art"><img src="${itemIconURL(it.slot, it.rarity, cls, 144)}" alt="" draggable="false"></span>
      <b class="lt-name">${esc(it.name)}</b>
      <span class="lt-meta">${esc(R.name)} · ${esc(SLOT_NAMES[it.slot] || '')} · Lv.${it.ilvl | 0}</span>
      ${uniqLine(it)}${setLine(it, hero)}${cmp}`;
    rv.hidden = false;
    showing = true;
    const [dx, dy] = heroBtnDelta();
    const T = CARD_MS.in + CARD_MS.hold + CARD_MS.out, a = CARD_MS.in / T, b = (CARD_MS.in + CARD_MS.hold) / T;
    anim = card.animate(reduce()
      ? [{ opacity: 0 }, { opacity: 1, offset: a }, { opacity: 1, offset: b }, { opacity: 0 }]
      : [
        { opacity: 0, transform: 'perspective(600px) rotateY(-100deg) scale(.7)' },
        { opacity: 1, transform: 'perspective(600px) rotateY(8deg) scale(1.04)', offset: a * 0.75 },
        { opacity: 1, transform: 'perspective(600px) rotateY(0) scale(1)', offset: a },
        { opacity: 1, transform: 'perspective(600px) rotateY(0) scale(1)', offset: b },
        { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(.18)`, easing: 'cubic-bezier(.5,0,.9,.4)' },
      ], { duration: T, easing: 'linear' });
    anim.onfinish = done;
  }
  function done() {
    anim = null; showing = false;
    rv.hidden = true;
    const next = queue.shift();
    if (next) show(next.ev, next.hero);
  }
  function skip() { // 탭 · 다음 카드가 기다리면: 남은 연출을 짧게 날려 보낸다
    if (!anim) return;
    const T = anim.effect.getTiming().duration, flyAt = CARD_MS.in + CARD_MS.hold;
    if (anim.currentTime < flyAt) anim.currentTime = flyAt;
    anim.playbackRate = Math.max(anim.playbackRate, (T - flyAt) / 120);
  }
  card.addEventListener('pointerdown', e => { e.stopPropagation(); skip(); });
  function reveal(ev, hero) {
    if (showing) { if (queue.length < 2) queue.push({ ev, hero }); skip(); } // ponytail: 몰려 오면 최대 2장만 줄 세운다(나머지는 가방 NEW)
    else show(ev, hero);
  }

  // ── 자동 판매 묶음 알림: 층 진행 막대 밑 '+골드 · 자동 판매 N개'(알약이 떠 있으면 숫자만 늘린다) ──
  let sold = { n: 0, gold: 0 }, soldT = 0;
  function soldNote(n, gold) {
    sold.n += n; sold.gold += gold;
    pill.innerHTML = `<span class="coin" aria-hidden="true"></span><b>+${fmt(sold.gold)}</b><span>자동 판매 ${sold.n}개</span>`;
    if (pill.hidden) { pill.hidden = false; pill.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 160 }); }
    else pill.animate([{ scale: 1.12 }, { scale: 1 }], { duration: 180 });
    clearTimeout(soldT);
    soldT = setTimeout(() => { pill.hidden = true; sold = { n: 0, gold: 0 }; }, 1800);
  }
  // ── 자동 장착 알림(카드를 띄우지 않는 평범한 드롭): 영웅 버튼 옆 작은 말풍선 ──
  let eqT = 0;
  function equipNote(ev) {
    eqNote.innerHTML = `<span>자동 장착</span><b>▲ ${fmt(Math.max(0, ev.gain | 0))}</b>`;
    eqNote.dataset.r = ev.item.rarity;
    eqNote.hidden = false;
    eqNote.animate([{ opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1 }], { duration: 160, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    clearTimeout(eqT);
    eqT = setTimeout(() => { eqNote.hidden = true; }, 1400);
  }

  function onEvents(events, g) {
    const hero = g?.hero;
    for (const ev of events) {
      if (ev.type === 'lootSold') soldNote(ev.n | 0 || 1, ev.gold | 0);
      else if (ev.type === 'loot' && ev.item) {
        if (ev.soldN) soldNote(ev.soldN, ev.soldGold | 0); // 가방이 차서 다른 장비를 판 몫
        if (goodDrop(ev.item, ev)) reveal(ev, hero);
        else if (ev.equipped) equipNote(ev);
      }
    }
  }
  function reset() { queue.length = 0; if (anim) { anim.onfinish = null; anim.cancel(); anim = null; } showing = false; rv.hidden = true; pill.hidden = true; eqNote.hidden = true; sold = { n: 0, gold: 0 }; }

  // ── 결과 화면: '이번 도전 최고 획득' 카드 + '자동 판매 N개 · +골드' 한 줄 (ui.js renderResult 뒤, 획득 골드 카드 다음) ──
  function renderResult(game) {
    reset(); // 도전이 끝났다 — 떠 있던 카드·알림 정리
    const m = document.getElementById('m-result'), anchor = document.getElementById('res-gold-card');
    if (!m || !anchor) return;
    let c = m.querySelector('.res-loot');
    if (!c) { c = document.createElement('div'); c.className = 'res-card res-loot'; anchor.after(c); }
    const hero = game?.hero, L = hero?.runLoot, id = game?.run?.log?.id;
    const ok = L && L.id === id && id != null;
    const best = ok ? L.best : null, cls = hero?.cls || 'knight';
    c.hidden = !(best || (ok && L.n));
    if (c.hidden) return;
    const R = best && (R_BY[best.rarity] || R_BY.common);
    c.innerHTML = '<h3>이번 도전 최고 획득</h3>' + (best ? `<div class="lt-best" data-r="${best.rarity}">
        <span class="k-slot lt-best-ico" data-r="${best.rarity}"><img src="${itemIconURL(best.slot, best.rarity, cls, 112)}" alt="" draggable="false"><span class="k-lv">${best.ilvl | 0}</span></span>
        <div class="lt-best-txt"><b class="lt-name">${esc(best.name)}</b><span class="lt-meta">${esc(R.name)} · ${esc(SLOT_NAMES[best.slot] || '')} · 전투력 ${fmt(itemPower(best, cls))}</span>${uniqLine(best)}${setLine(best)}</div>
      </div>` : '<p class="lt-none">이번 도전에선 남길 만한 장비가 없었어요</p>')
      + (ok && L.n ? `<p class="lt-soldline"><span class="coin" aria-hidden="true"></span>자동 판매 <b>${L.n}개</b> · <b class="k-num gold">+${fmt(L.gold)}</b> 골드</p>` : '');
  }

  // ── 설정 화면 줄: '장비 자동 판매' 등급 기준(세부 설정은 가방) ──
  const setModal = document.getElementById('m-settings');
  const sheet = setModal?.querySelector('.k-sheet.settings');
  if (sheet) {
    const row = document.createElement('div');
    row.className = 'set-row lt-set-row';
    row.innerHTML = `<span class="set-l"><img class="k-ico set-ico" src="assets/icons/coin.svg" alt="">장비 자동 판매</span>
      <div class="seg" role="radiogroup" aria-label="장비 자동 판매">${AUTO_SELL_UPTO.map(k => `<button role="radio" data-lt-upto="${k}">${AUTO_SELL_NAME[k]}</button>`).join('')}</div>`;
    const help = document.createElement('p');
    help.className = 'set-help lt-set-help';
    help.textContent = '전설·세트·고유 옵션·잠근 장비와 부위마다 지금보다 좋은 장비 1개는 팔지 않아요. 세부 설정은 영웅 → 가방에서.';
    const before = sheet.querySelector('#btn-check-update')?.closest('.set-row');
    sheet.insertBefore(row, before || null);
    sheet.insertBefore(help, before || null);
    const sync = () => {
      const h = getHero?.();
      if (!h) return;
      const c = autoSellCfg(h);
      for (const b of row.querySelectorAll('[data-lt-upto]')) b.setAttribute('aria-checked', String(b.dataset.ltUpto === c.upto));
    };
    for (const b of row.querySelectorAll('[data-lt-upto]')) b.addEventListener('click', () => {
      const h = getHero?.();
      if (!h) return;
      const c = autoSellCfg(h);
      c.upto = b.dataset.ltUpto; c.asked = true;
      sync(); persist?.();
    });
    new MutationObserver(sync).observe(setModal, { attributes: true, attributeFilter: ['hidden'] }); // 열릴 때마다 지금 값
    sync();
  }

  return { onEvents, renderResult, reset };
}

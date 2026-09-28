// v0.1.2 옷장 — 영웅 코스튬(클래스별) · 대마법사 로브 · 마법 이펙트 스킨을 살아 움직이는 미리보기로 보고 장착. 미보유는 실루엣 + 획득처.
// + 도감 '외형' 탭(수집률). summonui.js가 만들고(createWardrobe) 같은 층 · 같은 뒤로 가기 스택을 쓴다.
// 장착은 ctx.act({type:'cosEquip'|'cosUnequip'}) → 저장, 그리고 COSMETIC ART setLoadout(loadoutOf(meta)) 한 번(전장 그림 다시 굽기).
import { COSMETICS, COS_BY_KEY, SLOT_NAME, SHARD_PRICE, owns, loadoutOf, collection, sourceText } from './summon.js';
import { HERO_CLASSES, HERO_CLASS_KEYS, heroTier } from './hero.js';
import { CLS_INFO, runeRingURL } from './heroui.js';
import { heroPortraitURL } from './art/units.js';
import { icon } from './icons.js';
import { fmt } from './util.js';

const SLOTS = ['costume', 'robe', 'skin'];
const R_ORDER = ['common', 'rare', 'epic', 'legend'];
const PRE = { knight: 'kn', ranger: 'rg', sorcerer: 'so', cleric: 'cl', assassin: 'as' };
const SLOT_COL = { costume: null, robe: '#ff7a4a', skin: '#4fd8ff' };
// 기본 외형 id: 모르는 id는 종류 접두로 기본 그림에 떨어진다(COSMETIC ART 계약)
const baseId = (slot, cls) => (slot === 'costume' ? PRE[cls] || 'kn' : slot === 'robe' ? 'rb' : 'sk') + '_base';
// 새 외형 표시(UI 전용 · 이 기기만 localStorage): 보유했지만 옷장에서 아직 안 눌러 본 외형에 빨간 점. 처음 읽을 때 지금 보유는 본 것으로
const SEEN_K = 'wd.sm.seen';
let seen = null;
const saveSeen = () => { try { localStorage.setItem(SEEN_K, JSON.stringify([...seen])); } catch { /* 저장 못 해도 점만 다시 뜸 */ } };
function seenSet(mm) {
  if (seen) return seen;
  let v = null;
  try { v = JSON.parse(localStorage.getItem(SEEN_K)); } catch { /* 없음 */ }
  seen = new Set(Array.isArray(v) ? v : mm.summon?.owned || []);
  if (!Array.isArray(v)) saveSeen();
  return seen;
}
const isFresh = (mm, k) => owns(mm, k) && !seenSet(mm).has(k);
const markSeen = k => { if (seen && COS_BY_KEY[k] && !seen.has(k)) { seen.add(k); saveSeen(); } };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createWardrobe(ctx) {
  const { host, meta, act, play, toast, push, pop, thumb, svg, rarName, kindName, openItem, onClose, playPreview, syncLoadout } = ctx;
  let el = null, slot = 'costume', cls = 'knight', sel = null, stop = null, sig = '';

  function build() {
    el = document.createElement('section');
    el.className = 'sm-scr sm-ward';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '옷장');
    el.innerHTML = `
      <i class="sm-stars" aria-hidden="true"></i>
      <header class="sm-head cw">
        <button class="k-btn round s danger sm-back" aria-label="닫기">${icon('close')}</button>
        <h1 class="sm-title">옷장</h1>
        <div class="sm-cur"><span class="sm-pill sd" aria-label="별조각">${svg('shard')}<b class="k-num">0</b></span><span class="sm-pill sm-coll" aria-label="수집">${svg('robe')}<b class="k-num">0</b></span></div>
      </header>
      <div class="sm-body cw">
        <div class="k-tabs sm-wtabs" role="tablist" aria-label="외형 종류">${SLOTS.map(s => `<button class="k-tab" role="tab" data-s="${s}">${s === 'costume' ? '영웅' : s === 'robe' ? '대마법사' : '마법 이펙트'}</button>`).join('')}</div>
        <div class="sm-wsub" role="tablist" aria-label="영웅 클래스"></div>
        <div class="sm-wstage">
          <div class="hu-rays" aria-hidden="true"></div>
          <div class="hu-pedestal" aria-hidden="true"><i style="--rune:url(${runeRingURL()})"></i></div>
          <div class="sm-wcv"><canvas></canvas></div>
          <div class="sm-winfo"><div><b class="sm-wname"></b><span class="k sm-wkind"></span></div><span class="sm-wcount"></span></div>
          <div class="sm-wact"></div>
        </div>
        <div class="sm-grid sm-wgrid"></div>
      </div>`;
    host.append(el);
    el.querySelector('.sm-back').addEventListener('click', close);
    for (const t of el.querySelectorAll('.sm-wtabs .k-tab')) t.addEventListener('click', () => { slot = t.dataset.s; sel = null; render(true); });
    // 좁은 화면 회전·폴드 펼침: 캔버스 백킹 크기 다시 맞춤
    new ResizeObserver(() => { if (!el.hidden) preview(); }).observe(el.querySelector('.sm-wcv'));
  }

  const m = () => meta();
  const equipped = () => { const lo = loadoutOf(m()) || {}; return slot === 'costume' ? lo.costume?.[cls] || null : lo[slot] || null; };
  const items = () => {
    const mm = m(), list = COSMETICS.filter(c => c.slot === slot && (slot !== 'costume' || c.cls === cls));
    return list.sort((a, b) => owns(mm, b.key) - owns(mm, a.key) || R_ORDER.indexOf(b.rarity) - R_ORDER.indexOf(a.rarity));
  };

  function open({ cls: c, key, slot: s } = {}) {
    if (!el) build();
    const it = key && COS_BY_KEY[key];
    slot = it ? it.slot : s || slot;
    cls = it?.cls || (HERO_CLASSES[c] ? c : m().hero?.cls || cls);
    sel = it ? key : null;
    if (it) { seenSet(m()); markSeen(key); }
    if (el.hidden) { el.hidden = false; push(el, close); }
    render(true);
  }
  function close() {
    if (!el || el.hidden) return;
    el.hidden = true;
    pop(el);
    stop?.(); stop = null;
    sig = pvSig = '';
    onClose?.();
  }

  let pvSig = '';
  function preview() {
    const cv = el.querySelector('.sm-wcv canvas'), key = sel || baseId(slot, cls), own = !COS_BY_KEY[key] || owns(m(), key);
    const r = cv.getBoundingClientRect(), k = Math.min(2, devicePixelRatio || 1), w = Math.max(64, Math.round(r.width * k)), h = Math.max(64, Math.round(r.height * k));
    // 기본 외형(코스튬)은 지금 영웅의 단계·장비 모습 그대로 — 해제하면 정비 무대에서 보이는 그 모습(v0.1.2 FIX)
    const hr = m().hero || {}, gr = q => { const v = hr.equip?.[q]; return (v && (typeof v === 'string' ? v : v.rarity)) || null; };
    const look = slot === 'costume' && !COS_BY_KEY[key] ? { tier: heroTier(hr.level || 1), armor: gr('armor'), helm: gr('helm'), weapon: gr('weapon') || undefined } : {};
    const s = [key, own, w, h, JSON.stringify(look)].join('|');
    if (s === pvSig) return; // 같은 외형·크기면 도는 미리보기 그대로
    pvSig = s;
    stop?.(); stop = null;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    el.querySelector('.sm-wcv').classList.toggle('locked', !own);
    try { stop = playPreview(cv, key, { silhouette: !own, ...look }); } catch { /* 그림 없음 */ }
  }

  function render(force = false) {
    if (!el || el.hidden) return;
    const mm = m(), eq = equipped();
    if (!sel) sel = eq || baseId(slot, cls);
    const s = [slot, cls, sel, eq, mm.summon.shards, (mm.summon.owned || []).length].join('|');
    if (!force && s === sig) return;
    sig = s;
    el.style.setProperty('--cc', SLOT_COL[slot] || CLS_INFO[cls]?.col || '#7b6cff');
    el.dataset.slot = slot; // 스킨 무대는 받침대 없이 넓게(css)
    seenSet(mm);
    for (const t of el.querySelectorAll('.sm-wtabs .k-tab')) {
      t.setAttribute('aria-selected', String(t.dataset.s === slot));
      const f = COSMETICS.some(c => c.slot === t.dataset.s && isFresh(mm, c.key));
      if (!!t.querySelector('.k-dot') !== f) f ? t.insertAdjacentHTML('beforeend', '<i class="k-dot"></i>') : t.querySelector('.k-dot').remove();
    }
    el.querySelector('.sm-pill.sd b').textContent = fmt(mm.summon.shards);
    const col = collection(mm);
    el.querySelector('.sm-coll b').textContent = `${col.n}/${col.total}`;
    // 클래스 고르기(코스튬만)
    const sub = el.querySelector('.sm-wsub');
    sub.hidden = slot !== 'costume';
    if (slot === 'costume') {
      const lo = loadoutOf(mm) || {};
      sub.innerHTML = HERO_CLASS_KEYS.map(k => `<button role="tab" data-c="${k}" aria-selected="${k === cls}" aria-label="${HERO_CLASSES[k].name}" style="--c:${CLS_INFO[k].col}">
        <img src="${heroPortraitURL(k, heroTier(mm.hero?.level || 1), null, 120)}" alt="" draggable="false">${lo.costume?.[k] ? '<i class="dot"></i>' : ''}${COSMETICS.some(c => c.cls === k && isFresh(mm, c.key)) ? '<i class="k-dot"></i>' : ''}</button>`).join('');
      for (const b of sub.children) b.addEventListener('click', () => { cls = b.dataset.c; sel = null; render(true); });
    }
    // 무대 정보 + 버튼
    const c = COS_BY_KEY[sel], isBase = !c, own = isBase || owns(mm, sel), on = isBase ? !eq : eq === sel;
    const list = items(), ownN = list.filter(x => owns(mm, x.key)).length;
    el.querySelector('.sm-wname').textContent = isBase ? '기본 외형' : c.name;
    el.querySelector('.sm-wkind').innerHTML = isBase ? esc(slot === 'costume' ? HERO_CLASSES[cls].name : SLOT_NAME[slot])
      : `<span class="sm-rtag" data-r="${c.rarity}">${esc(rarName(c.rarity))}</span> ${esc(SLOT_NAME[slot])}${slot === 'costume' ? ' · ' + esc(kindName(c)) : ''}`;
    el.querySelector('.sm-wcount').textContent = `보유 ${ownN}/${list.length}`;
    const actEl = el.querySelector('.sm-wact');
    if (!own) {
      const cost = SHARD_PRICE[c.rarity], poor = mm.summon.shards < cost;
      actEl.innerHTML = `<div class="sm-wlock">${icon('lock')}<span>획득처: <b>${esc(sourceText(sel))}</b></span></div>`
        + `<button class="k-btn s secondary sm-w-buy${poor ? ' is-poor' : ''}"><span>${svg('shard')}${cost.toLocaleString('ko-KR')}</span></button>`;
      actEl.querySelector('.sm-w-buy').addEventListener('click', () => openItem(sel, { onChange: () => render(true) }));
    } else if (on) {
      actEl.innerHTML = `<button class="k-btn s gray" disabled>${icon('check')}장착 중</button>${isBase ? '' : '<button class="k-btn s neutral sm-w-off">기본으로</button>'}`;
      actEl.querySelector('.sm-w-off')?.addEventListener('click', () => equip(null));
    } else {
      actEl.innerHTML = `<button class="k-btn s success sm-w-on">${isBase ? '기본 외형으로' : '장착'}</button>`;
      actEl.querySelector('.sm-w-on').addEventListener('click', () => equip(isBase ? null : sel));
    }
    // 목록(기본 + 보유 먼저, 등급 높은 순)
    const grid = el.querySelector('.sm-wgrid'), bk = baseId(slot, cls);
    grid.innerHTML = `<button class="sm-tile${!eq ? ' eq' : ''}${sel === bk ? ' sel' : ''}" data-r="common" data-k="${bk}" aria-label="기본 외형${!eq ? ', 장착 중' : ''}">${thumb(bk, 128)}<b>기본 외형</b>${!eq ? '<span class="sm-eqb">장착</span>' : ''}</button>`
      + list.map(x => {
        const o = owns(mm, x.key), e = eq === x.key;
        return `<button class="sm-tile${o ? '' : ' locked'}${e ? ' eq' : ''}${sel === x.key ? ' sel' : ''}" data-r="${x.rarity}" data-k="${x.key}" aria-label="${esc(x.name)} ${esc(rarName(x.rarity))}${o ? (e ? ', 장착 중' : ', 보유') : ', 미보유'}">
          ${thumb(x.key, 128)}<b>${o ? esc(x.name) : '???'}</b>${e ? '<span class="sm-eqb">장착</span>' : ''}${isFresh(mm, x.key) ? '<span class="k-badge new sm-tnew">NEW</span>' : ''}</button>`;
      }).join('');
    for (const b of grid.children) b.addEventListener('click', () => { if (sel === b.dataset.k) return; sel = b.dataset.k; markSeen(sel); play('cardFlip'); render(true); });
    preview();
  }

  function equip(key) {
    const ok = key ? act({ type: 'cosEquip', key }) : act({ type: 'cosUnequip', slot, cls: slot === 'costume' ? cls : undefined });
    if (!ok) { toast('장착할 수 없어요', 'robe'); return; }
    syncLoadout(); // 전장 그림(영웅·마법사·마법탄) 다시 굽기
    play('pickConfirm');
    toast(key ? `${COS_BY_KEY[key].name} 장착!` : '기본 외형으로 바꿨어요', 'robe');
    const cv = el.querySelector('.sm-wcv');
    cv.animate([{ scale: 1 }, { scale: 1.08, offset: 0.35 }, { scale: 1 }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    render(true);
  }

  // ── 도감 '외형' 탭: 수집률 + 종류별 격자(누르면 상세) ──
  function codex(hostEl, mm = m()) {
    const col = collection(mm), p = col.total ? col.n / col.total : 0;
    const sec = s => {
      const list = COSMETICS.filter(c => c.slot === s).sort((a, b) => (a.cls || '').localeCompare(b.cls || '') || R_ORDER.indexOf(b.rarity) - R_ORDER.indexOf(a.rarity));
      const [n, t] = col.slot?.[s] || [0, list.length];
      return `<h4>${esc(SLOT_NAME[s])}<em>${n}/${t}</em></h4><div class="sm-grid">${list.map(c => {
        const o = owns(mm, c.key);
        return `<button class="sm-tile${o ? '' : ' locked'}" data-r="${c.rarity}" data-k="${c.key}" aria-label="${esc(c.name)}${o ? '' : ' 미보유'}">${thumb(c.key, 128)}<b>${o ? esc(c.name) : '???'}</b></button>`;
      }).join('')}</div>`;
    };
    hostEl.innerHTML = `<div class="sm-cdx">
      <div class="sm-cdx-top"><b class="k-num">${col.n}/${col.total} · ${Math.round(p * 100)}%</b><div class="k-bar gold"><i style="transform:scaleX(${p.toFixed(3)})"></i></div></div>
      <div class="sm-cdx-r">${R_ORDER.map(r => { const [n, t] = col.rarity?.[r] || [0, 0]; return `<span class="sm-rtag" data-r="${r}">${esc(rarName(r))} ${n}/${t}</span>`; }).join(' ')}</div>
      ${SLOTS.map(sec).join('')}
      <button class="k-btn s neutral sm-go">${svg('robe')}옷장 열기</button>
    </div>`;
    for (const b of hostEl.querySelectorAll('.sm-tile')) b.addEventListener('click', () => openItem(b.dataset.k, { onChange: () => codex(hostEl) }));
    hostEl.querySelector('.sm-go').addEventListener('click', () => open({}));
  }

  // 아직 안 본 새 외형 수(제단 '옷장' 링크 점)
  const unseen = (mm = m()) => { seenSet(mm); return COSMETICS.filter(c => isFresh(mm, c.key)).length; }; // seenSet 먼저: 첫 읽기 = 지금 보유를 본 것으로
  return { open, close, refresh: () => render(true), codex, unseen, isOpen: () => !!el && !el.hidden };
}

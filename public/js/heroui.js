// 영웅 · 장비 화면 (DOM). 클래스 선택(영웅 쇼케이스) + 캐릭터/가방 화면 + 아이템 상세.
// 이 파일은 자기 DOM을 스스로 만들어 root에 붙인다(index.html 수정 없음). 재질은 kit.css(.k-*), 배치는 hero.css.
// 캐릭터 그림은 전장 스프라이트를 고해상도로 구운 것(art/units.js heroPortraitURL) — 화면마다 같은 캐릭터로 보이게. docs/ART.md §10.5, §10.6, §10.15
import {
  HERO_CLASSES, HERO_CLASS_KEYS, HERO_TIERS, heroTier, heroTitle,
  xpToNext, MILESTONES, hasMilestone, SLOTS, SLOT_NAMES, RARITIES, RARITY_KEYS, SUBSTATS, BAG_SIZE,
  heroPower, itemPower, sellValue, gearBonuses,
} from './hero.js';
import { fmt, clamp } from './util.js';
import { icon } from './icons.js';
import { heroPortraitURL, itemIconURL } from './art/units.js';
import { emblemImg } from './art/emblems.js';
import { glyph } from './art/fx.js';
import { createTalentTree } from './talentui.js';
import { talentLeft } from './talents.js';

// 받침대 룬 서클(고해상도, 한 번 굽기) — 전장 마법진과 같은 문양(동심원 + 육망성 + 룬 10자)
let runeURL = '';
export function runeRingURL() {
  if (runeURL) return runeURL;
  const c = document.createElement('canvas'), R = 256;
  c.width = c.height = R;
  const x = c.getContext('2d');
  x.translate(R / 2, R / 2); x.scale(R / 68, R / 68);
  x.lineJoin = x.lineCap = 'round';
  const pass = (w, col, a) => {
    x.globalAlpha = a; x.strokeStyle = col; x.lineWidth = w;
    for (const r of [31, 24, 10]) { x.beginPath(); x.arc(0, 0, r, 0, Math.PI * 2); x.stroke(); }
    x.beginPath();
    for (const o of [0, Math.PI]) for (let j = 0; j <= 3; j++) { const a2 = -Math.PI / 2 + o + j * Math.PI * 2 / 3; j ? x.lineTo(Math.cos(a2) * 24, Math.sin(a2) * 24) : x.moveTo(Math.cos(a2) * 24, Math.sin(a2) * 24); }
    x.stroke();
    x.lineWidth = w * 0.7;
    for (let k = 0; k < 10; k++) { const a2 = k * Math.PI / 5; x.save(); x.translate(Math.cos(a2) * 27.5, Math.sin(a2) * 27.5); x.rotate(a2 + Math.PI / 2); glyph(x, 0, 0, 2.4, k); x.restore(); }
  };
  pass(3.2, '#b8a8ff', 0.35); pass(1.4, '#d8ccff', 1); pass(0.6, '#ffffff', 0.9);
  runeURL = c.toDataURL();
  return runeURL;
}

// 클래스 선택 화면: [패시브, 궁극기] 엠블럼
const ABILITY_EM = { knight: ['thorns', 'flawless'], ranger: ['pierce', 'homing'], sorcerer: ['chainboom', 'glacier'], cleric: ['holyLight', 'judgment'], assassin: ['double', 'soulHarvest'] };
const RARITY_BY_KEY = Object.fromEntries(RARITIES.map(r => [r.key, r]));
const SUB_NAME = Object.fromEntries(SUBSTATS.map(s => [s.key, s.name]));
// hero.js 내부 SLOT_MAIN_KEY와 동일(문서 §캐릭터 성장 & 장비) — export가 없어 여기서 재정의
const MAIN_STAT_NAME = { atkPct: '영웅 공격력', heroHpPct: '영웅 체력', dmgReducePct: '피해 감소', critDmgPct: '치명타 피해', atkSpeedPct: '영웅 공격 속도' };
const SLOT_MAIN_KEY = { weapon: 'atkPct', helm: 'heroHpPct', armor: 'dmgReducePct', trinket: 'critDmgPct', cape: 'atkSpeedPct' };
// 클래스 쇼케이스 수치(장식용, 1~5) · 역할 배지 · 대표 색 — 조정은 이 표만
export const CLS_INFO = {
  knight: { diff: 2, pow: 2, surv: 5, role: '탱커', col: '#5a8cff' },
  ranger: { diff: 2, pow: 4, surv: 2, role: '원거리', col: '#4fd06a' },
  sorcerer: { diff: 3, pow: 4, surv: 2, role: '광역', col: '#b27aff' },
  cleric: { diff: 3, pow: 2, surv: 4, role: '회복', col: '#ffc92e' },
  assassin: { diff: 4, pow: 5, surv: 1, role: '암살', col: '#ff4d6a' },
};
export const UNLOCK_TEXT = { cleric: '20층 클리어 시 해금', assassin: '40층 클리어 시 해금' };
const TIER_R = ['common', 'uncommon', 'rare', 'epic', 'legend']; // 티어 배지 색 = 희귀도 색
const SLOT_ORDER_L = ['helm', 'armor', 'cape'], SLOT_ORDER_R = ['weapon', 'trinket'];
// 빈 장비 칸 실루엣 (부위 모양, 반투명)
const SLOT_SIL = {
  weapon: '<path d="M30 6h4l1 30h-6z M22 36h20v5H22z M30 41h4v12h-4z"/>',
  helm: '<path d="M14 36a18 18 0 0 1 36 0v8H14z M27 22h10v10H27z" fill-rule="evenodd"/>',
  armor: '<path d="M18 12l8-3q6 5 12 0l8 3-2 34q-12 6-24 0z"/>',
  trinket: '<path d="M24 8l8 12 8-12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><circle cx="32" cy="36" r="11"/>',
  cape: '<path d="M22 10h20q6 18 8 38-18-6-36 0 2-20 8-38z"/>',
};
export const slotSil = slot => `<svg class="hu-sil" viewBox="0 0 64 64" aria-hidden="true" fill="currentColor">${SLOT_SIL[slot] || ''}</svg>`;

export const bestRarityIdx = hero => {
  let best = -1;
  if (hero) for (const slot of SLOTS) { const it = hero.equip[slot]; if (it) best = Math.max(best, RARITY_KEYS.indexOf(it.rarity)); }
  return best;
};
const portraitSrc = (hero, px) => heroPortraitURL(hero.cls, heroTier(hero.level), hero.equip, px);

// HUD 영웅 버튼 초상 (전장 스프라이트 상반신)
export function heroPortrait(hero) {
  return `<img class="hb-img" src="${portraitSrc(hero, 220)}" alt="" draggable="false">`;
}

function countUp(el, from, to, ms = 650) {
  if (el._raf) { cancelAnimationFrame(el._raf); el._raf = null; }
  from = Number.isFinite(from) ? from : to;
  if (to <= from) { el.textContent = fmt(to); el.dataset.text = fmt(to); return; }
  const t0 = performance.now();
  const tick = now => {
    const t = Math.min(1, (now - t0) / ms);
    const eased = 1 - (1 - t) ** 3;
    el.textContent = el.dataset.text = fmt(Math.round(from + (to - from) * eased));
    el._raf = t < 1 ? requestAnimationFrame(tick) : null;
  };
  el._raf = requestAnimationFrame(tick);
}

const heroSig = (hero, ctx) => {
  if (!hero) return 'none';
  let s = `${hero.cls}|${hero.level}|${Math.floor(hero.xp)}|${hero.autoEquip ? 1 : 0}`;
  for (const slot of SLOTS) s += '|' + (hero.equip[slot] ? hero.equip[slot].id : '-');
  s += '|' + hero.bag.length;
  for (const it of hero.bag) s += ',' + it.id;
  s += '|' + JSON.stringify(hero.talents || {}) + (hero.autoTalent ? 1 : 0);
  return s + '|' + Math.floor(ctx.stage || 0) + '|' + Math.floor(ctx.gold || 0) + '|' + (ctx.camp ? 1 : 0);
};
const bars = (n, max = 5) => Array.from({ length: max }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');

export function createHeroUI(root, handlers = {}) {
  const H = handlers;
  const wrap = document.createElement('div');
  wrap.className = 'hero-ui';
  wrap.hidden = false; // 자식들이 각자 hidden을 관리(레벨업 배너는 항상 떠 있을 수 있어야 함)
  wrap.innerHTML = `
    <div class="hu-cp hu-screen" hidden role="dialog" aria-modal="true" aria-labelledby="hu-cp-h">
      <div class="hu-light" aria-hidden="true"></div>
      <header class="hu-head">
        <button class="k-btn round s neutral hu-cp-back" hidden aria-label="닫기">${icon('close')}</button>
        <div class="k-ribbon gold hu-rb"><h1 id="hu-cp-h">영웅 선택</h1></div>
      </header>
      <div class="hu-stage hu-cp-stage">
        <div class="hu-rays" aria-hidden="true"></div>
        <div class="hu-pedestal" aria-hidden="true"><i style="--rune:url(${runeRingURL()})"></i></div>
        <img class="hu-hero hu-cp-hero" alt="" draggable="false">
        <div class="hu-cp-lock" hidden>${icon('lock')}<span></span></div>
        <button class="hu-nav prev" aria-label="이전 영웅">‹</button><button class="hu-nav next" aria-label="다음 영웅">›</button>
      </div>
      <div class="hu-cp-info">
        <div class="hu-cp-namerow"><h2 class="hu-cp-name"></h2><span class="hu-role"></span><span class="hu-cur" hidden>사용 중</span></div>
        <p class="hu-cp-desc"></p>
        <div class="hu-stats">
          <div><span>난이도</span><b class="hu-pips d"></b></div>
          <div><span>화력</span><b class="hu-pips p"></b></div>
          <div><span>생존</span><b class="hu-pips s"></b></div>
        </div>
        <div class="hu-skill"><span class="hu-skill-ico">${icon('check')}</span><div><b>패시브</b><p class="hu-cp-passive"></p></div></div>
        <div class="hu-skill ult"><span class="hu-skill-ico">${icon('crit')}</span><div><b class="hu-cp-ultname"></b><p class="hu-cp-ult"></p></div></div>
      </div>
      <div class="hu-thumbs" role="tablist" aria-label="클래스"></div>
      <div class="hu-cp-foot"><button class="k-btn l wide hu-cp-go">이 영웅으로!</button></div>
    </div>

    <div class="hu-main hu-screen" hidden role="dialog" aria-modal="true" aria-labelledby="hu-h">
      <div class="hu-light" aria-hidden="true"></div>
      <header class="hu-head">
        <button class="k-btn round s danger hu-close" aria-label="닫기">${icon('close')}</button>
        <div class="k-ribbon hu-rb"><h1 id="hu-h">영웅</h1></div>
        <div class="hu-goldpill"><span class="hu-coin"></span><b class="hu-gold k-num gold">0</b></div>
      </header>
      <div class="hu-scroll">
        <div class="hu-stage hu-main-stage">
          <div class="hu-rays" aria-hidden="true"></div>
          <div class="hu-motes" aria-hidden="true">${'<i></i>'.repeat(9)}</div>
          <div class="hu-pedestal" aria-hidden="true"><i style="--rune:url(${runeRingURL()})"></i></div>
          <img class="hu-hero hu-main-hero" alt="" draggable="false">
          <div class="hu-slotcol l">${SLOT_ORDER_L.map(s => `<button class="k-slot hu-eq" data-slot="${s}" aria-label="${SLOT_NAMES[s]}"></button>`).join('')}</div>
          <div class="hu-slotcol r">${SLOT_ORDER_R.map(s => `<button class="k-slot hu-eq" data-slot="${s}" aria-label="${SLOT_NAMES[s]}"></button>`).join('')}</div>
        </div>
        <div class="hu-plate">
          <div class="hu-titlerow"><span class="hu-tier"></span><b class="hu-title"></b></div>
          <div class="hu-lvrow"><b class="hu-lvnum k-num">Lv.1</b><div class="k-bar xp hu-xp"><i></i><span class="hu-xptext"></span></div></div>
          <div class="hu-power"><span>전투력</span><b class="hu-powernum k-num k-grad gold" data-text="0">0</b></div>
        </div>
        <div class="k-tabs hu-tabs" role="tablist">
          <button class="k-tab" data-tab="char" role="tab" aria-selected="true">영웅</button>
          <button class="k-tab" data-tab="talent" role="tab" aria-selected="false">특성<span class="hu-newdot hu-tdot" hidden>0</span></button>
          <button class="k-tab" data-tab="bag" role="tab" aria-selected="false">가방<span class="hu-newdot hu-bdot" hidden>0</span></button>
        </div>
        <section class="hu-panel hu-panel-char" data-panel="char">
          <button class="k-btn s neutral hu-changeclass">${icon('hero')}클래스 변경</button>
          <h3 class="hu-sec-h">장비 보너스</h3>
          <div class="hu-bonuses"></div>
          <h3 class="hu-sec-h">성장 마일스톤</h3>
          <div class="hu-milestones"></div>
        </section>
        <section class="hu-panel hu-panel-talent" data-panel="talent" hidden></section>
        <section class="hu-panel hu-panel-bag" data-panel="bag" hidden>
          <div class="hu-toolbar">
            <label class="hu-autoeq-l"><button class="k-toggle hu-autoeq" aria-pressed="false" aria-label="자동 장착"></button><span>자동 장착</span></label>
            <div class="k-tabs hu-sorts" role="tablist" aria-label="정렬">
              <button class="k-tab" data-sort="new" aria-selected="true">최신순</button><button class="k-tab" data-sort="pow" aria-selected="false">전투력순</button>
            </div>
          </div>
          <div class="hu-baggrid"></div>
          <div class="hu-sellrow"></div>
          <p class="hu-campnote" hidden>${icon('coin')}<span>판매는 도전 중에 할 수 있어요. 판 골드는 마법사 수련에 쓰여요.</span></p>
        </section>
      </div>
    </div>

    <div class="hu-sheet-ov hu-itemsheet-ov" hidden>
      <div class="k-modal dark narrow hu-item">
        <div class="k-ribbon hu-is-rb"><h2 class="hu-is-name"></h2></div>
        <button class="k-close hu-is-close" aria-label="닫기">${icon('close')}</button>
        <div class="k-sheet">
          <div class="hu-is-art"><i class="hu-is-rays" aria-hidden="true"></i><img class="hu-is-icon" alt="" draggable="false"></div>
          <div class="hu-is-meta"><span class="hu-is-rarity"></span><span class="hu-is-ilvl"></span></div>
          <div class="hu-is-stats"></div>
          <div class="hu-is-cmp"></div>
          <div class="hu-is-actions">
            <button class="k-btn danger hu-is-sell">판매</button>
            <button class="k-btn success hu-is-equip">장착</button>
          </div>
        </div>
      </div>
    </div>

    <div class="hu-sheet-ov hu-sellconfirm-ov" hidden>
      <div class="k-modal narrow">
        <div class="k-ribbon red"><h2>일괄 판매</h2></div>
        <div class="k-sheet center">
          <div class="hu-sc-body"></div>
          <div class="hu-is-actions">
            <button class="k-btn gray hu-sc-no">취소</button>
            <button class="k-btn danger hu-sc-yes">판매</button>
          </div>
        </div>
      </div>
    </div>

    <div class="hu-levelup" hidden>
      <div class="hu-lu-box">
        <div class="hu-lu-title">LEVEL UP!</div>
        <div class="hu-lu-lv k-num"></div>
        <div class="hu-lu-tier"></div>
        <div class="hu-lu-milestone" hidden></div>
      </div>
    </div>
    <div class="hu-toastwrap" aria-live="polite"></div>
  `;
  root.appendChild(wrap);

  const $ = sel => wrap.querySelector(sel);
  const $$ = sel => [...wrap.querySelectorAll(sel)];
  const on = (el, ev, fn) => el.addEventListener(ev, fn);

  const cp = $('.hu-cp'), cpBack = $('.hu-cp-back'), cpHero = $('.hu-cp-hero'), cpThumbs = $('.hu-thumbs'), cpGo = $('.hu-cp-go');
  const cpLock = $('.hu-cp-lock');
  const main = $('.hu-main');
  const panels = { char: $('.hu-panel-char'), talent: $('.hu-panel-talent'), bag: $('.hu-panel-bag') };
  const tabs = $$('.hu-tabs .k-tab');
  const goldEl = $('.hu-gold');
  const slotBtns = Object.fromEntries($$('.hu-eq').map(b => [b.dataset.slot, b]));
  const heroImg = $('.hu-main-hero');
  const titleEl = $('.hu-title'), tierEl = $('.hu-tier'), lvEl = $('.hu-lvnum'), xpBar = $('.hu-xp'), xpText = $('.hu-xptext');
  const powerNum = $('.hu-powernum');
  const bonusesEl = $('.hu-bonuses'), milestonesEl = $('.hu-milestones');
  const autoEqBtn = $('.hu-autoeq'), sortBtns = $$('.hu-sorts .k-tab'), sellRow = $('.hu-sellrow'), bagGrid = $('.hu-baggrid');
  const newDot = $('.hu-bdot'), tDot = $('.hu-tdot');
  // 특성 트리: 정비 화면이면 무료 초기화까지(onReset), 도전 중이면 찍기만
  const th = {
    onAllocate: key => { const ok = H.onTalent?.(key); forceRender(); return ok !== false; },
    onReset: null,
    onAutoToggle: v => { H.onToggleAutoTalent?.(v); forceRender(); },
  };
  const tree = createTalentTree(panels.talent, main, th);
  const isOv = $('.hu-itemsheet-ov'), isBox = $('.hu-item'), isRb = $('.hu-is-rb'), isName = $('.hu-is-name'), isIcon = $('.hu-is-icon'), isRarity = $('.hu-is-rarity');
  const isIlvl = $('.hu-is-ilvl'), isStats = $('.hu-is-stats'), isCmp = $('.hu-is-cmp'), isEquipBtn = $('.hu-is-equip'), isSellBtn = $('.hu-is-sell');
  const scOv = $('.hu-sellconfirm-ov'), scBody = $('.hu-sc-body');
  const luEl = $('.hu-levelup'), luLv = $('.hu-lu-lv'), luTier = $('.hu-lu-tier'), luMs = $('.hu-lu-milestone');
  const toastWrap = $('.hu-toastwrap');

  let curHero = null, curCtx = {};
  let openView = null;      // null | 'classpick' | 'main'
  let cpMode = 'pick';      // 'pick'(첫 선택, 뒤로가기 불가) | 'change'(변경, 취소 가능)
  let cpSel = 'knight';     // 쇼케이스에 보이는 클래스(확정 전)
  let activeTab = 'char';
  let sortByPower = false;
  let lastSig = '';
  let itemSheetItem = null, itemSheetEquipped = false;
  let sellRarityTarget = null;
  const newItemIds = new Set();
  let prevFocus = null, luTimer = 0;

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'k-toast';
    t.textContent = String(msg);
    toastWrap.append(t);
    while (toastWrap.childElementCount > 2) toastWrap.firstElementChild.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 250); }, 1800);
  }

  function setSiblingsInert(v) {
    for (const el of root.children) if (el !== wrap) el.inert = v;
  }
  function txt(el, s) { if (el.textContent !== s) el.textContent = s; }
  const clsCol = cls => (CLS_INFO[cls] || CLS_INFO.knight).col;

  // ── 클래스 선택: 큰 영웅 쇼케이스 + 썸네일 줄 + 확정 버튼 (한 번 탭으로 바로 확정하지 않음) ──
  function renderClassPick() {
    const best = curCtx.stage || 0;
    const lvl = curHero ? curHero.level : 1;
    const eq = curHero ? curHero.equip : null;
    cpThumbs.innerHTML = HERO_CLASS_KEYS.map(cls => {
      const c = HERO_CLASSES[cls], unlocked = c.unlock(best);
      return `<button class="hu-thumb${unlocked ? '' : ' locked'}${cls === cpSel ? ' sel' : ''}" role="tab" aria-selected="${cls === cpSel}" data-cls="${cls}" style="--cc:${clsCol(cls)}" aria-label="${c.name}${unlocked ? '' : ' (잠김)'}">
        <img src="${heroPortraitURL(cls, unlocked ? heroTier(lvl) : 0, unlocked ? eq : null, 160)}" alt="" draggable="false">
        ${unlocked ? '' : `<span class="hu-thumb-lock">${icon('lock')}</span>`}<span class="hu-thumb-name">${c.name}</span>${unlocked ? '' : `<span class="hu-thumb-req">${({ cleric: 20, assassin: 40 })[cls] || ''}층 클리어</span>`}
      </button>`;
    }).join('');
    for (const b of cpThumbs.children) on(b, 'click', () => selectPreview(b.dataset.cls));
    showcase();
  }
  function showcase() {
    const cls = cpSel, c = HERO_CLASSES[cls], info = CLS_INFO[cls];
    const unlocked = c.unlock(curCtx.stage || 0);
    const lvl = curHero ? curHero.level : 1;
    cp.style.setProperty('--cc', info.col);
    cp.classList.toggle('locked', !unlocked);
    cpHero.src = heroPortraitURL(cls, unlocked ? heroTier(lvl) : 0, unlocked && curHero ? curHero.equip : null, 480);
    cpHero.classList.remove('in'); void cpHero.offsetWidth; cpHero.classList.add('in');
    const [, desc] = c.role.split(' — ');
    txt($('.hu-cp-name'), c.name);
    txt($('.hu-role'), info.role);
    txt($('.hu-cp-desc'), desc || c.role);
    $('.hu-cur').hidden = !(curHero && curHero.cls === cls);
    $('.hu-pips.d').innerHTML = bars(info.diff); $('.hu-pips.p').innerHTML = bars(info.pow); $('.hu-pips.s').innerHTML = bars(info.surv);
    txt($('.hu-cp-passive'), c.passive);
    txt($('.hu-cp-ultname'), '궁극기 · ' + c.ult.name);
    // 패시브·궁극기 아이콘 = 클래스별 그린 엠블럼(체크박스·같은 과녁이 모든 클래스에 반복되던 문제)
    const ab = ABILITY_EM[cls] || ABILITY_EM.knight, ic = $$('.hu-cp .hu-skill-ico');
    if (ic[0]) ic[0].innerHTML = emblemImg(ab[0]); if (ic[1]) ic[1].innerHTML = emblemImg(ab[1]);
    txt($('.hu-cp-ult'), c.ultDesc);
    cpLock.hidden = unlocked;
    if (!unlocked) txt(cpLock.querySelector('span'), UNLOCK_TEXT[cls] || '잠김');
    const cur = curHero && curHero.cls === cls;
    cpGo.disabled = !unlocked || (cur && cpMode === 'change');
    txt(cpGo, !unlocked ? (UNLOCK_TEXT[cls] || '잠김') : cur && cpMode === 'change' ? '사용 중인 영웅' : cpMode === 'change' ? '이 영웅으로 변경' : '이 영웅으로!');
    for (const b of cpThumbs.children) { const s = b.dataset.cls === cls; b.classList.toggle('sel', s); b.setAttribute('aria-selected', String(s)); }
  }
  function selectPreview(cls) {
    if (cpSel === cls) return;
    cpSel = cls;
    showcase();
  }
  function stepClass(d) {
    const i = HERO_CLASS_KEYS.indexOf(cpSel);
    selectPreview(HERO_CLASS_KEYS[(i + d + HERO_CLASS_KEYS.length) % HERO_CLASS_KEYS.length]);
  }
  on($('.hu-nav.prev'), 'click', () => stepClass(-1));
  on($('.hu-nav.next'), 'click', () => stepClass(1));
  { // 무대 좌우 스와이프
    let sx = null;
    const st = $('.hu-cp-stage');
    on(st, 'pointerdown', e => { sx = e.clientX; });
    on(st, 'pointerup', e => { if (sx != null && Math.abs(e.clientX - sx) > 40) stepClass(e.clientX < sx ? 1 : -1); sx = null; });
  }
  on(cpGo, 'click', () => { if (!cpGo.disabled) attemptSelectClass(cpSel); });
  function attemptSelectClass(cls) {
    if (!curHero) return;
    const first = curHero.cls === null;
    H.onSelectClass?.(cls);
    if (curHero.cls === cls) {
      if (first) { hideAll(); toast(`${HERO_CLASSES[cls].name}와 함께 출발!`); } else { closeClassPick(); toast('클래스를 변경했어요'); } // 첫 선택은 바로 전투로
      forceRender();
    } else if (!first) {
      toast('전투 중에는 클래스를 바꿀 수 없어요');
    }
  }
  function showClassPick(mode) {
    cpMode = mode;
    cpSel = curHero && curHero.cls ? curHero.cls : 'knight';
    cpBack.hidden = mode !== 'change';
    main.hidden = true;
    cp.hidden = false;
    openView = 'classpick';
    renderClassPick();
    setSiblingsInert(true);
    (cpBack.hidden ? cpGo : cpBack).focus({ preventScroll: true });
  }
  function closeClassPick() {
    cp.hidden = true;
    if (curHero && curHero.cls) showMain();
    else { openView = null; setSiblingsInert(false); }
  }
  on(cpBack, 'click', () => closeClassPick());

  // ── 메인(캐릭터/가방) ──
  function showMain() {
    cp.hidden = true;
    main.hidden = false;
    openView = 'main';
    lastSig = '';
    setSiblingsInert(true);
    renderAll();
    $('.hu-close').focus({ preventScroll: true });
  }
  function userClose() {
    hideAll();
    H.onClose?.();
  }
  function hideAll() {
    tree.close();
    cp.hidden = true; main.hidden = true; isOv.hidden = true; scOv.hidden = true;
    openView = null;
    setSiblingsInert(false);
    if (prevFocus?.isConnected) prevFocus.focus({ preventScroll: true });
  }
  on($('.hu-close'), 'click', userClose);
  on($('.hu-changeclass'), 'click', () => showClassPick('change'));
  for (const b of tabs) on(b, 'click', () => setTab(b.dataset.tab));
  function setTab(tab) {
    if (activeTab === tab) return;
    activeTab = tab;
    for (const b of tabs) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    for (const k in panels) panels[k].hidden = tab !== k;
    const sc = $('.hu-scroll'); if (sc) sc.scrollLeft = 0; // 가로로 밀린 채 남아 탭 글자가 잘리던 문제
    if (tab === 'bag') newDot.hidden = true; // 가방 탭을 보면 NEW 카운트 확인한 것으로 간주(타일별 표시는 유지)
    renderPanel();
  }

  // 가방을 떠난 아이템 id(장착 외 경로: 일괄판매·가방 초과 자동판매·영웅 교체)는 NEW 카운트에서 걷어낸다
  function pruneNewItems() {
    if (!newItemIds.size) return;
    const live = curHero ? new Set(curHero.bag.map(it => it.id)) : null;
    for (const id of newItemIds) if (!live || !live.has(id)) newItemIds.delete(id);
  }
  const noSell = () => !!curCtx.camp && !Number.isFinite(curCtx.gold); // 정비 화면인데 영구 골드를 모르면 판매를 감춘다
  function renderAll() {
    pruneNewItems();
    updateNewDot();
    txt(goldEl, fmt(curCtx.gold || 0));
    goldEl.parentElement.hidden = noSell(); // 정비 화면은 호출측이 영구 골드(ctx.gold)를 주면 판매·골드 표시
    $('.hu-changeclass').hidden = !curCtx.classChange;
    th.onReset = curCtx.camp ? () => !!H.onTalentReset?.() : null;
    const tl = curHero && curHero.cls ? talentLeft(curHero, curHero.cls) : 0;
    tDot.hidden = !(tl > 0) || activeTab === 'talent';
    tDot.textContent = '+' + tl;
    renderStage();
    renderPanel();
  }
  function renderPanel() {
    if (!curHero) return;
    if (activeTab === 'char') renderCharacter(); else if (activeTab === 'talent') tree.render(curHero, curHero.cls, true); else renderBag();
  }

  // 무대(초상 + 장비 칸 + 이름판) — 두 탭 공통
  function renderStage() {
    const hero = curHero;
    if (!hero || !hero.cls) return;
    const tier = heroTier(hero.level);
    main.style.setProperty('--cc', clsCol(hero.cls));
    const best = bestRarityIdx(hero);
    main.dataset.r = best >= 0 ? RARITY_KEYS[best] : '';
    const src = portraitSrc(hero, 480);
    if (heroImg.getAttribute('src') !== src) heroImg.src = src;
    txt(titleEl, heroTitle(hero.cls, hero.level));
    tierEl.dataset.r = TIER_R[tier];
    txt(tierEl, (HERO_TIERS[tier] || HERO_TIERS[0]).name);
    txt(lvEl, 'Lv.' + hero.level);
    const need = xpToNext(hero.level);
    xpBar.style.setProperty('--p', clamp(hero.xp / need, 0, 1).toFixed(3));
    txt(xpText, `${fmt(Math.floor(hero.xp))} / ${fmt(need)}`);
    const p = heroPower(hero);
    const prev = Number(powerNum.dataset.v || 0);
    if (prev !== p) {
      countUp(powerNum, prev, p);
      if (prev && p > prev) powerNum.animate([{ scale: 1 }, { scale: 1.2, offset: 0.35 }, { scale: 1 }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      powerNum.dataset.v = String(p);
    }
    for (const slot of SLOTS) {
      const btn = slotBtns[slot];
      const it = hero.equip[slot];
      btn.classList.toggle('empty', !it);
      // 장착 유도: 가방에 이 칸보다 센 장비가 있으면 칸이 맥동 + ▲ (전설을 가방에 넣어 두고 잊지 않게)
      const cur = it ? itemPower(it) : -1;
      btn.classList.toggle('can-up', hero.bag.some(b => b.slot === slot && itemPower(b) > cur));
      if (it) { btn.dataset.r = it.rarity; btn.innerHTML = `<img src="${itemIconURL(slot, it.rarity, hero.cls, 112)}" alt="" draggable="false"><span class="k-lv">${it.ilvl}</span>`; }
      else { delete btn.dataset.r; btn.innerHTML = slotSil(slot) + `<span class="hu-eq-name">${SLOT_NAMES[slot]}</span>`; }
      btn.title = it ? `${SLOT_NAMES[slot]} · ${it.name}` : `${SLOT_NAMES[slot]} (비어 있음)`;
      btn.onclick = () => { if (it) openItemSheet(it, slot, true); else { setTab('bag'); } };
    }
  }

  function renderCharacter() {
    const hero = curHero;
    const g = gearBonuses(hero);
    const rows = [];
    for (const slot of SLOTS) { const k = SLOT_MAIN_KEY[slot]; if (g[k]) rows.push([MAIN_STAT_NAME[k], g[k]]); }
    for (const s of SUBSTATS) if (g[s.key]) rows.push([s.name, g[s.key]]);
    bonusesEl.innerHTML = rows.length
      ? rows.map(([n, v]) => `<div class="hu-bonus"><span>${n}</span><b class="k-num ok">+${v.toFixed(1)}%</b></div>`).join('')
      : SLOTS.map(sl => `<div class="hu-bonus zero"><span>${MAIN_STAT_NAME[SLOT_MAIN_KEY[sl]]}</span><b class="k-num">+0%</b></div>`).join(''); // 빈 장비여도 표(0) — 안내 문장 대신
    milestonesEl.innerHTML = MILESTONES.map(m => {
      const done = hasMilestone(hero.level, m.key);
      return `<div class="hu-ms${done ? ' done' : ''}"><span class="hu-ms-lv k-num">Lv.${m.lv}</span><span class="hu-ms-desc">${m.desc}</span><span class="hu-ms-state">${icon(done ? 'check' : 'lock')}</span></div>`;
    }).join('');
  }

  function renderBag() {
    const hero = curHero;
    autoEqBtn.setAttribute('aria-pressed', String(!!hero.autoEquip));
    for (const b of sortBtns) b.setAttribute('aria-selected', String((b.dataset.sort === 'pow') === sortByPower));
    const counts = {}, gold = {};
    for (const it of hero.bag) { counts[it.rarity] = (counts[it.rarity] || 0) + 1; gold[it.rarity] = (gold[it.rarity] || 0) + sellValue(it); }
    sellRow.innerHTML = '<span class="hu-sell-h">등급별 일괄 판매</span>' + RARITIES.map(r => `<button class="hu-chip" data-r="${r.key}" data-rarity="${r.key}" ${counts[r.key] ? '' : 'disabled'}><i></i>${r.name}<b class="k-num">${counts[r.key] || 0}</b></button>`).join('');
    for (const b of sellRow.querySelectorAll('.hu-chip')) on(b, 'click', () => openSellConfirm(b.dataset.rarity));
    sellRow.hidden = noSell();
    $('.hu-campnote').hidden = !noSell();

    const items = sortByPower ? hero.bag.slice().sort((a, b) => itemPower(b) - itemPower(a)) : hero.bag;
    let html = items.map((it, i) => `<button class="k-slot hu-tile" data-r="${it.rarity}" data-id="${it.id}" aria-label="${it.name}" style="--i:${Math.min(i, 8)}">
      <img src="${itemIconURL(it.slot, it.rarity, hero.cls, 112)}" alt="" draggable="false"><span class="k-lv">${it.ilvl}</span>${newItemIds.has(it.id) ? '<span class="k-badge new hu-tile-new">N</span>' : ''}${itemPower(it) > (hero.equip[it.slot] ? itemPower(hero.equip[it.slot]) : -1) ? '<i class="hu-up" aria-label="장착하면 강해짐"></i>' : ''}
    </button>`).join('');
    for (let i = items.length; i < BAG_SIZE; i++) html += `<div class="k-slot empty hu-tile" aria-hidden="true">${i === items.length ? '' : ''}</div>`;
    bagGrid.innerHTML = html;
    for (const b of bagGrid.querySelectorAll('.hu-tile[data-id]')) {
      on(b, 'click', () => {
        const it = hero.bag.find(x => x.id === b.dataset.id);
        if (!it) return;
        newItemIds.delete(it.id);
        b.querySelector('.hu-tile-new')?.remove();
        openItemSheet(it, it.slot, false);
      });
    }
    updateNewDot();
  }
  for (const b of sortBtns) on(b, 'click', () => { sortByPower = b.dataset.sort === 'pow'; renderBag(); });
  on(autoEqBtn, 'click', () => H.onToggleAutoEquip?.(!curHero.autoEquip));

  function updateNewDot() {
    const n = newItemIds.size;
    newDot.hidden = n === 0 || activeTab === 'bag';
    if (n) newDot.textContent = String(n);
  }

  // ── 아이템 상세: 등급 색 리본 + 큰 아이콘 + 수치 + 착용 장비와 전투력 비교 + 젤리 버튼 ──
  function openItemSheet(item, slot, equipped) {
    itemSheetItem = item; itemSheetEquipped = equipped;
    const R = RARITY_BY_KEY[item.rarity];
    isBox.dataset.r = item.rarity;
    isRb.dataset.r = item.rarity;
    isName.textContent = item.name;
    isIcon.src = itemIconURL(slot, item.rarity, curHero.cls, 240);
    isRarity.textContent = `${R.name} · ${SLOT_NAMES[slot]}`;
    isRarity.dataset.r = item.rarity;
    isIlvl.textContent = `아이템 Lv.${item.ilvl}`;
    const mainName = MAIN_STAT_NAME[item.main.key] || item.main.key;
    let stats = `<div class="hu-stat main"><span>${mainName}</span><b class="k-num">+${item.main.value.toFixed(1)}%</b></div>`;
    stats += item.subs.map(s => `<div class="hu-stat"><span>${SUB_NAME[s.key] || s.key}</span><b class="k-num">+${s.value.toFixed(1)}%</b></div>`).join('');
    isStats.innerHTML = stats;
    const equippedNow = curHero.equip[slot];
    const diff = itemPower(item) - itemPower(equippedNow);
    isCmp.innerHTML = equipped
      ? `<div class="hu-cmp">${icon('check')}<span>지금 장착 중 · 전투력 <b class="k-num gold">${fmt(itemPower(item))}</b></span></div>`
      : equippedNow
        ? `<div class="hu-cmp ${diff >= 0 ? 'up' : 'down'}"><span>착용 중인 ${equippedNow.name} 대비</span><b class="k-num ${diff >= 0 ? 'ok' : 'bad'}"><i class="hu-arrow"></i>${diff >= 0 ? '+' : ''}${fmt(diff)}</b></div>`
        : `<div class="hu-cmp up"><span>빈 칸 — 장착하면 바로 강해져요</span><b class="k-num ok"><i class="hu-arrow"></i>+${fmt(itemPower(item))}</b></div>`;
    isEquipBtn.hidden = equipped;
    isSellBtn.hidden = equipped || noSell();
    isSellBtn.innerHTML = `판매 <span class="hu-coin"></span>${fmt(sellValue(item))}`;
    isOv.hidden = false;
    isEquipBtn.focus?.({ preventScroll: true });
  }
  function closeItemSheet() { isOv.hidden = true; itemSheetItem = null; }
  on($('.hu-is-close'), 'click', closeItemSheet);
  on(isOv, 'click', e => { if (e.target === isOv) closeItemSheet(); });
  on(isEquipBtn, 'click', () => {
    if (!itemSheetItem) return;
    H.onEquip?.(itemSheetItem.id);
    closeItemSheet();
    forceRender();
    toast('장착했어요');
  });
  on(isSellBtn, 'click', () => {
    if (!itemSheetItem) return;
    H.onSell?.(itemSheetItem.id);
    closeItemSheet();
    forceRender();
    toast('판매했어요');
  });

  // ── 등급별 일괄 판매 확인 ──
  function openSellConfirm(rarity) {
    sellRarityTarget = rarity;
    const R = RARITY_BY_KEY[rarity];
    const items = curHero.bag.filter(it => it.rarity === rarity);
    const gold = items.reduce((s, it) => s + sellValue(it), 0);
    scBody.innerHTML = `<p><b class="hu-rname" data-r="${rarity}">${R.name}</b> 아이템 <b>${items.length}개</b>를 판매할까요?</p><p class="hu-sc-gold"><span class="hu-coin"></span><b class="k-num gold">+${fmt(gold)}</b></p>`;
    scOv.hidden = false;
  }
  on($('.hu-sc-no'), 'click', () => { scOv.hidden = true; });
  on(scOv, 'click', e => { if (e.target === scOv) scOv.hidden = true; });
  on($('.hu-sc-yes'), 'click', () => {
    if (sellRarityTarget) H.onSellRarity?.(sellRarityTarget);
    scOv.hidden = true;
    forceRender();
    toast('판매했어요');
  });

  function forceRender() { lastSig = ''; if (openView === 'main') renderAll(); }

  // ── 레벨업 배너 ──
  function notifyLevelUp(level, tier, milestone) {
    clearTimeout(luTimer);
    txt(luLv, `Lv.${level}`);
    txt(luTier, (HERO_TIERS[tier] || HERO_TIERS[0]).name + ' 티어');
    const m = MILESTONES.find(x => x.key === milestone);
    luMs.hidden = !m;
    if (m) txt(luMs, m.desc);
    luEl.hidden = false;
    void luEl.offsetWidth;
    luEl.classList.add('show');
    luTimer = setTimeout(() => { luEl.classList.remove('show'); setTimeout(() => { luEl.hidden = true; }, 260); }, 2600);
  }

  function notifyLoot(item) {
    if (!item?.id) return;
    newItemIds.add(item.id);
    updateNewDot();
    if (openView === 'main' && activeTab === 'bag') renderBag();
  }

  // ctx: { stage: 최고 기록(클래스 해금), gold: 골드(도전 중 = 이번 도전 골드, 정비 화면 = 영구 골드 data.gold — 없으면 판매 숨김),
  //        camp: 정비 화면이면 true(특성 무료 초기화, 판매는 campAct {type:'sell'|'sellRarity'} → meta.gold), classChange: 클래스 변경 버튼 }
  // opt.tab: 'char' | 'talent' | 'bag'
  function open(hero, ctx = {}, opt = {}) {
    prevFocus = document.activeElement;
    curHero = hero; curCtx = ctx || {};
    if (!hero || !hero.cls) { showClassPick('pick'); return; }
    if (opt.tab && panels[opt.tab]) { activeTab = ''; setTab(opt.tab); }
    showMain();
  }
  function close() { hideAll(); }
  function isOpen() { return openView !== null; }
  function update(hero, ctx = {}) {
    curHero = hero; curCtx = ctx || {};
    if (openView === null) return;
    if (openView === 'classpick') return; // 쇼케이스는 사용자가 넘길 때만 다시 그린다
    const sig = heroSig(hero, ctx);
    if (sig === lastSig) return;
    lastSig = sig;
    renderAll();
  }
  function handleBack() {
    if (openView === 'main' && tree.handleBack()) return true;
    if (!isOv.hidden) { closeItemSheet(); return true; }
    if (!scOv.hidden) { scOv.hidden = true; return true; }
    if (openView === 'classpick') {
      if (cpMode === 'change') { closeClassPick(); return true; }
      return true; // 첫 선택은 강제 — 뒤로가기를 삼킨다
    }
    if (openView === 'main') { userClose(); return true; }
    return false;
  }

  return { open, close, isOpen, update, notifyLoot, notifyLevelUp, handleBack };
}

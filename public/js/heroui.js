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
// v0.1.7 가방: 옵션 줄(최고 굴림 금색) · 옵션별 ▲▼ · 세트 진행도(items.js) · 잠금 · NEW · 자동 판매 설정 · 일괄 정리(loot.js)
import { itemLines, compareItems, setProgress, setCounts, UNIQUE_BY_KEY, SET_BY_KEY, statText } from './items.js';
import { cleanPreview, autoSellCfg, AUTO_SELL_UPTO, AUTO_SELL_NAME } from './loot.js';

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
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`); // v0.1.7 아이템 이름·옵션 문구
// hero.js 내부 SLOT_MAIN_KEY와 동일(문서 §캐릭터 성장 & 장비) — export가 없어 여기서 재정의
export const MAIN_STAT_NAME = { atkPct: '영웅 공격력', heroHpPct: '영웅 체력', dmgReducePct: '피해 감소', critDmgPct: '치명타 피해', atkSpeedPct: '영웅 공격 속도' };
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
  return s + '|' + Math.floor(ctx.stage || 0) + '|' + Math.floor(ctx.gold || 0) + '|' + (ctx.camp ? 1 : 0) + '|' + (ctx.cos || ''); // v0.1.2 cos = 장착 코스튬(초상이 바뀌게)
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
          <button class="k-btn s secondary hu-wardrobe">${icon('new')}옷장 · 외형 바꾸기</button>
          <div class="lt-sets lt-sets-char"></div>
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
          <div class="lt-bagbar">
            <button class="lt-as-btn" aria-label="자동 판매 설정">${icon('coin')}<span>자동 판매</span><b class="lt-as-cur"></b><i class="lt-gear" aria-hidden="true">${icon('settings')}</i></button>
            <button class="k-btn s success lt-clean">일괄 정리<b class="lt-clean-n"></b></button>
          </div>
          <div class="lt-sets lt-sets-bag"></div>
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
          <div class="hu-is-meta"><span class="hu-is-rarity"></span><span class="hu-is-ilvl"></span><button class="lt-lock" aria-pressed="false">${icon('lock')}<span>잠금</span></button></div>
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

    <div class="hu-sheet-ov lt-as-ov" hidden>
      <div class="k-modal narrow lt-as">
        <div class="k-ribbon"><h2>하위 장비 자동 판매</h2></div>
        <button class="k-close lt-as-close" aria-label="닫기">${icon('close')}</button>
        <div class="k-sheet">
          <p class="lt-as-h">이 등급 이하는 주우면 바로 골드로</p>
          <div class="seg lt-as-seg" role="radiogroup" aria-label="자동 판매 등급">${AUTO_SELL_UPTO.map(k => `<button role="radio" data-upto="${k}">${AUTO_SELL_NAME[k]}</button>`).join('')}</div>
          <label class="lt-as-row"><span><b>장착 중인 것보다 약하면</b><em>등급과 상관없이 자동 판매</em></span><button class="k-toggle lt-as-weaker" aria-pressed="false" aria-label="장착 중인 것보다 약하면 자동 판매"></button></label>
          <label class="lt-as-row"><span><b>특별한 장비 보호</b><em>전설 · 세트 조각 · 고유 옵션은 팔지 않아요</em></span><button class="k-toggle lt-as-keep" aria-pressed="true" aria-label="특별한 장비 보호"></button></label>
          <p class="lt-as-note">${icon('lock')}<span>잠근 장비와 부위마다 지금보다 좋은 장비 1개는 절대 팔지 않아요. 가방이 차면 기준에 걸리는 것부터 정리해요.</span></p>
        </div>
      </div>
    </div>

    <div class="hu-sheet-ov lt-cl-ov" hidden>
      <div class="k-modal narrow lt-cl">
        <div class="k-ribbon gold"><h2 class="lt-cl-h">일괄 정리</h2></div>
        <div class="k-sheet center">
          <p class="lt-cl-lead"></p>
          <div class="lt-cl-grid"></div>
          <p class="lt-cl-gold"><span class="hu-coin"></span><b class="k-num gold"></b></p>
          <p class="lt-cl-note"></p>
          <div class="hu-is-actions">
            <button class="k-btn gray lt-cl-no">취소</button>
            <button class="k-btn success lt-cl-yes">정리하기</button>
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
  // 특성 트리: 정비 화면이면 1랭크 빼기(onRefund)·무료 초기화(onReset)까지, 도전 중이면 찍기만
  const th = {
    onAllocate: key => { const ok = H.onTalent?.(key); forceRender(); return ok !== false; },
    onReset: null,
    onRefund: null,
    toast: m => toast(m),
    onAutoToggle: v => { H.onToggleAutoTalent?.(v); forceRender(); },
  };
  const tree = createTalentTree(panels.talent, main, th);
  const isOv = $('.hu-itemsheet-ov'), isBox = $('.hu-item'), isRb = $('.hu-is-rb'), isName = $('.hu-is-name'), isIcon = $('.hu-is-icon'), isRarity = $('.hu-is-rarity');
  const isIlvl = $('.hu-is-ilvl'), isStats = $('.hu-is-stats'), isCmp = $('.hu-is-cmp'), isEquipBtn = $('.hu-is-equip'), isSellBtn = $('.hu-is-sell');
  const scOv = $('.hu-sellconfirm-ov'), scBody = $('.hu-sc-body');
  const luEl = $('.hu-levelup'), luLv = $('.hu-lu-lv'), luTier = $('.hu-lu-tier'), luMs = $('.hu-lu-milestone');
  const toastWrap = $('.hu-toastwrap');
  // v0.1.7 자동 판매 · 일괄 정리 · 잠금
  const asOv = $('.lt-as-ov'), asCur = $('.lt-as-cur'), cleanBtn = $('.lt-clean'), cleanN = $('.lt-clean-n');
  const clOv = $('.lt-cl-ov'), lockBtn = $('.lt-lock');
  let clAsk = false; // 일괄 정리 창이 '기존 가방 정리할까요?'(처음 한 번) 모드인가

  let curHero = null, curCtx = {};
  let openView = null;      // null | 'classpick' | 'main'
  let cpMode = 'pick';      // 'pick'(첫 선택, 뒤로가기 불가) | 'change'(변경, 취소 가능)
  let cpSel = 'knight';     // 쇼케이스에 보이는 클래스(확정 전)
  let activeTab = 'char';
  let sortByPower = false;
  let lastSig = '';
  let itemSheetItem = null, itemSheetEquipped = false;
  let sellRarityTarget = null;
  const newCount = () => (curHero ? curHero.bag.reduce((n, it) => n + (it.n ? 1 : 0), 0) : 0); // v0.1.7 NEW = 아이템의 n 표시(저장됨, loot.js)
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
    cp.hidden = true; main.hidden = true; isOv.hidden = true; scOv.hidden = true; asOv.hidden = true; clOv.hidden = true;
    openView = null;
    setSiblingsInert(false);
    if (prevFocus?.isConnected) prevFocus.focus({ preventScroll: true });
  }
  on($('.hu-close'), 'click', userClose);
  on($('.hu-changeclass'), 'click', () => showClassPick('change'));
  on($('.hu-wardrobe'), 'click', () => H.onOpenWardrobe?.(curHero?.cls)); // v0.1.2 옷장(summonui.js 층이 이 화면 위에 뜬다)
  for (const b of tabs) on(b, 'click', () => setTab(b.dataset.tab));
  function setTab(tab) {
    if (activeTab === tab) return;
    activeTab = tab;
    for (const b of tabs) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    for (const k in panels) panels[k].hidden = tab !== k;
    const sc = $('.hu-scroll'); if (sc) sc.scrollLeft = 0; // 가로로 밀린 채 남아 탭 글자가 잘리던 문제
    if (tab === 'bag') newDot.hidden = true; // 가방 탭을 보면 NEW 카운트 확인한 것으로 간주(타일별 표시는 유지)
    renderPanel();
    if (tab === 'bag') maybeAskClean();
  }

  const noSell = () => !!curCtx.camp && !Number.isFinite(curCtx.gold); // 정비 화면인데 영구 골드를 모르면 판매를 감춘다
  function renderAll() {
    updateNewDot();
    txt(goldEl, fmt(curCtx.gold || 0));
    goldEl.parentElement.hidden = noSell(); // 정비 화면은 호출측이 영구 골드(ctx.gold)를 주면 판매·골드 표시
    $('.hu-changeclass').hidden = !curCtx.classChange;
    th.onReset = curCtx.camp ? () => !!H.onTalentReset?.() : null;
    th.onRefund = curCtx.camp ? key => !!H.onTalentRefund?.(key) : null; // 1랭크 빼기도 정비 화면만
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
    for (const s of SUBSTATS) if (g[s.key]) rows.push([s.name, g[s.key], s.key]);
    renderSets($('.lt-sets-char'), '<h3 class="hu-sec-h">세트 효과</h3>');
    bonusesEl.innerHTML = rows.length
      ? rows.map(([n, v, k]) => `<div class="hu-bonus"><span>${n}</span><b class="k-num ok">${statText({ key: k, value: v })}</b></div>`).join('') // v0.1.7 items.js statText — 쿨타임 부옵션은 −
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
    for (const it of hero.bag) if (!it.lock) { counts[it.rarity] = (counts[it.rarity] || 0) + 1; gold[it.rarity] = (gold[it.rarity] || 0) + sellValue(it); }
    sellRow.innerHTML = '<span class="hu-sell-h">등급별 일괄 판매</span>' + RARITIES.map(r => `<button class="hu-chip" data-r="${r.key}" data-rarity="${r.key}" ${counts[r.key] ? '' : 'disabled'}><i></i>${r.name}<b class="k-num">${counts[r.key] || 0}</b></button>`).join('');
    for (const b of sellRow.querySelectorAll('.hu-chip')) on(b, 'click', () => openSellConfirm(b.dataset.rarity));
    sellRow.hidden = noSell();
    $('.hu-campnote').hidden = !noSell();

    // v0.1.7 자동 판매 기준 · 일괄 정리 개수 · 세트 진행도
    const asc = autoSellCfg(hero);
    txt(asCur, AUTO_SELL_NAME[asc.upto] + (asc.weaker ? ' · 약한 것' : ''));
    const pv = cleanPreview(hero);
    cleanBtn.hidden = noSell();
    cleanBtn.disabled = !pv.items.length;
    txt(cleanN, pv.items.length ? String(pv.items.length) : '');
    renderSets($('.lt-sets-bag'));
    const P = it => itemPower(it, hero.cls);
    const items = sortByPower ? hero.bag.slice().sort((a, b) => P(b) - P(a)) : hero.bag;
    const setN = setCounts(hero);
    // 타일: NEW · 잠금 · 고유(보석) · 세트(색 띠 + 장착 수) · ▲(장착하면 강해짐)
    let html = items.map((it, i) => `<button class="k-slot hu-tile${it.lock ? ' lt-locked' : ''}" data-r="${it.rarity}" data-id="${it.id}" aria-label="${esc(it.name)}${it.lock ? ' (잠금)' : ''}" style="--i:${Math.min(i, 8)}${SET_BY_KEY[it.set] ? `;--sc:${SET_BY_KEY[it.set].color}` : ''}">
      <img src="${itemIconURL(it.slot, it.rarity, hero.cls, 112)}" alt="" draggable="false"><span class="k-lv">${it.ilvl}</span>${it.n ? '<span class="k-badge new hu-tile-new">NEW</span>' : ''}${P(it) > (hero.equip[it.slot] ? P(hero.equip[it.slot]) : -1) ? '<i class="hu-up" aria-label="장착하면 강해짐"></i>' : ''}${it.lock ? `<i class="lt-tlock" aria-hidden="true">${icon('lock')}</i>` : ''}${UNIQUE_BY_KEY[it.unique] ? `<i class="lt-tuniq" data-r="${UNIQUE_BY_KEY[it.unique].rarity}" aria-hidden="true"></i>` : ''}${SET_BY_KEY[it.set] ? `<i class="lt-tset" aria-hidden="true">${setN[it.set] || 0}/4</i>` : ''}
    </button>`).join('');
    for (let i = items.length; i < BAG_SIZE; i++) html += `<div class="k-slot empty hu-tile" aria-hidden="true">${i === items.length ? '' : ''}</div>`;
    bagGrid.innerHTML = html;
    for (const b of bagGrid.querySelectorAll('.hu-tile[data-id]')) {
      on(b, 'click', () => {
        const it = hero.bag.find(x => x.id === b.dataset.id);
        if (!it) return;
        if (it.n) { delete it.n; H.onChange?.(); } // NEW 확인(저장)
        b.querySelector('.hu-tile-new')?.remove();
        updateNewDot();
        openItemSheet(it, it.slot, false);
      });
    }
    updateNewDot();
  }
  for (const b of sortBtns) on(b, 'click', () => { sortByPower = b.dataset.sort === 'pow'; renderBag(); });
  on(autoEqBtn, 'click', () => H.onToggleAutoEquip?.(!curHero.autoEquip));

  function updateNewDot() {
    const n = newCount();
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
    // v0.1.7 옵션 줄(items.js itemLines): 최고 굴림 = 금색 · 고유 옵션 · 세트(장착 수) — 설명이 한눈에
    const cls = curHero.cls, setN = setCounts(curHero);
    isStats.innerHTML = itemLines(item, cls).map(l => {
      if (l.kind === 'uniq') {
        const U = UNIQUE_BY_KEY[l.key];
        return `<div class="lt-uniqbox${l.off ? ' off' : ''}" data-r="${U?.rarity || 'epic'}"><span class="lt-ub-h"><em>고유</em>${esc(U?.title || '')} · ${esc(l.name)}</span><p>${esc(l.text)}</p>${l.off ? `<small>${esc(HERO_CLASSES[l.cls]?.name || '다른 클래스')} 전용 — 지금 클래스에선 꺼져 있어요</small>` : ''}</div>`;
      }
      if (l.kind === 'set') {
        const S = SET_BY_KEY[l.key], n = setN[l.key] || 0;
        return `<div class="lt-setbox" style="--sc:${l.color}"><span class="lt-ub-h"><em>세트</em>${esc(l.name)}<b>${n}/4 장착</b></span><p class="${n >= 2 ? 'on' : ''}"><i>2</i>${esc(S.b2.desc)}</p><p class="${n >= 4 ? 'on' : ''}"><i>4</i>${esc(S.b4.desc)}</p></div>`;
      }
      return `<div class="hu-stat${l.kind === 'main' ? ' main' : ''}${l.top ? ' lt-top' : ''}"><span>${esc(l.name)}${l.top ? '<i class="lt-topmark">최고</i>' : ''}</span><b class="k-num">${esc(l.text)}</b></div>`;
    }).join('');
    const equippedNow = curHero.equip[slot];
    const P = it => itemPower(it, cls);
    const diff = P(item) - P(equippedNow);
    // 옵션별 ▲▼(장착 중 대비) — 고유 옵션을 잃으면 그것도 한 줄
    const rows = !equipped && equippedNow ? compareItems(item, equippedNow).filter(r => r.diff !== 0).map(r =>
      `<li class="${r.diff > 0 ? 'up' : 'down'}"><span>${esc(r.name)}</span><b class="k-num">${r.diff > 0 ? '▲' : '▼'} ${Math.abs(r.diff).toFixed(1)}%</b></li>`).join('') : '';
    const lostU = !equipped && equippedNow && equippedNow.unique && equippedNow.unique !== item.unique && UNIQUE_BY_KEY[equippedNow.unique]
      ? `<li class="down lt-lostu"><span>고유 옵션 '${esc(UNIQUE_BY_KEY[equippedNow.unique].title)}' 사라짐</span><b class="k-num">▼</b></li>` : '';
    isCmp.innerHTML = (equipped
      ? `<div class="hu-cmp">${icon('check')}<span>지금 장착 중 · 전투력 <b class="k-num gold">${fmt(P(item))}</b></span></div>`
      : equippedNow
        ? `<div class="hu-cmp ${diff >= 0 ? 'up' : 'down'}"><span>${diff > 0 ? '지금 장비보다 좋아요' : diff < 0 ? '지금 장비보다 약해요' : '지금 장비와 비슷해요'}</span><b class="k-num ${diff >= 0 ? 'ok' : 'bad'}"><i class="hu-arrow"></i>${diff >= 0 ? '+' : ''}${fmt(diff)}</b></div>`
        : `<div class="hu-cmp up"><span>빈 칸 — 장착하면 바로 강해져요</span><b class="k-num ok"><i class="hu-arrow"></i>+${fmt(P(item))}</b></div>`)
      + (rows || lostU ? `<ul class="lt-cmp-rows" aria-label="착용 중인 장비 대비">${rows}${lostU}</ul>` : '');
    isEquipBtn.hidden = equipped;
    isSellBtn.hidden = equipped || noSell();
    isSellBtn.disabled = !!item.lock;
    isSellBtn.innerHTML = item.lock ? `${icon('lock')}잠김` : `판매 <span class="hu-coin"></span>${fmt(sellValue(item))}`;
    syncLock(item);
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

  // ── v0.1.7 잠금(자물쇠): 잠근 장비는 판매·자동 판매·가방 정리에서 빠진다 ──
  function syncLock(item) {
    lockBtn.setAttribute('aria-pressed', String(!!item.lock));
    txt(lockBtn.querySelector('span'), item.lock ? '잠김' : '잠금');
  }
  on(lockBtn, 'click', () => {
    const it = itemSheetItem;
    if (!it) return;
    if (it.lock) delete it.lock; else it.lock = 1;
    H.onChange?.();
    syncLock(it);
    isSellBtn.disabled = !!it.lock;
    isSellBtn.innerHTML = it.lock ? `${icon('lock')}잠김` : `판매 <span class="hu-coin"></span>${fmt(sellValue(it))}`;
    forceRender();
    toast(it.lock ? '잠갔어요 — 팔리지 않아요' : '잠금을 풀었어요');
  });

  // ── v0.1.7 세트 진행도(장착 중 세트: n/4 · 2세트/4세트 효과 켜짐) — 가방·영웅 탭 ──
  function renderSets(el, head = '') {
    if (!el) return;
    const sp = curHero ? setProgress(curHero) : [];
    el.hidden = !sp.length;
    el.innerHTML = head + sp.map(s => `<div class="lt-setp" style="--sc:${s.color}">
      <span class="lt-setp-h"><b>${esc(s.name)}</b><span class="lt-pips" aria-label="${s.n}/4">${[1, 2, 3, 4].map(i => `<i class="${i <= s.n ? 'on' : ''}"></i>`).join('')}</span></span>
      <p class="${s.b2.on ? 'on' : ''}"><i>2</i>${esc(s.b2.desc)}</p><p class="${s.b4.on ? 'on' : ''}"><i>4</i>${esc(s.b4.desc)}</p></div>`).join('');
  }

  // ── v0.1.7 하위 장비 자동 판매 설정(가방) ──
  function syncAutoSell() {
    const c = autoSellCfg(curHero);
    for (const b of asOv.querySelectorAll('[data-upto]')) b.setAttribute('aria-checked', String(b.dataset.upto === c.upto));
    $('.lt-as-weaker').setAttribute('aria-pressed', String(!!c.weaker));
    $('.lt-as-keep').setAttribute('aria-pressed', String(!!c.keep));
  }
  function setAutoSell(patch) {
    Object.assign(autoSellCfg(curHero), patch, { asked: true }); // 기준을 직접 만졌으면 '기존 가방 정리' 질문은 이제 안 한다(일괄 정리 버튼이 있다)
    H.onChange?.();
    syncAutoSell();
    forceRender();
  }
  on($('.lt-as-btn'), 'click', () => { if (!curHero) return; syncAutoSell(); asOv.hidden = false; });
  on($('.lt-as-close'), 'click', () => { asOv.hidden = true; });
  on(asOv, 'click', e => { if (e.target === asOv) asOv.hidden = true; });
  for (const b of asOv.querySelectorAll('[data-upto]')) on(b, 'click', () => setAutoSell({ upto: b.dataset.upto }));
  on($('.lt-as-weaker'), 'click', () => setAutoSell({ weaker: !autoSellCfg(curHero).weaker }));
  on($('.lt-as-keep'), 'click', () => setAutoSell({ keep: !autoSellCfg(curHero).keep }));

  // ── v0.1.7 일괄 정리(지금 기준으로 한 번에 판매, 결과 미리 보기) · 처음 한 번 '기존 가방 정리할까요?' ──
  function openClean(ask) {
    const pv = cleanPreview(curHero);
    if (!pv.items.length) return false;
    clAsk = ask;
    txt($('.lt-cl-h'), ask ? '가방 정리' : '일괄 정리');
    txt($('.lt-cl-lead'), ask ? `새 자동 판매 기준(${AUTO_SELL_NAME[autoSellCfg(curHero).upto]})에 맞는 장비가 ${pv.items.length}개 있어요. 지금 정리할까요?` : `지금 기준으로 ${pv.items.length}개를 판매해요.`);
    const show = pv.items.slice(0, 15);
    $('.lt-cl-grid').innerHTML = show.map(it => `<span class="k-slot lt-cl-tile" data-r="${it.rarity}"><img src="${itemIconURL(it.slot, it.rarity, curHero.cls, 80)}" alt="" draggable="false"><span class="k-lv">${it.ilvl}</span></span>`).join('')
      + (pv.items.length > show.length ? `<span class="lt-cl-more k-num">+${pv.items.length - show.length}</span>` : '');
    txt($('.lt-cl-gold b'), '+' + fmt(pv.gold));
    txt($('.lt-cl-note'), '잠근 장비 · 부위마다 지금보다 좋은 장비 1개' + (autoSellCfg(curHero).keep ? ' · 전설 · 세트 · 고유 옵션' : '') + '은 남아요');
    txt($('.lt-cl-no'), ask ? '그대로 둘게요' : '취소');
    clOv.hidden = false;
    $('.lt-cl-yes').focus?.({ preventScroll: true });
    return true;
  }
  function closeClean(answered) {
    clOv.hidden = true;
    if (clAsk && answered && curHero) { autoSellCfg(curHero).asked = true; H.onChange?.(); }
    clAsk = false;
  }
  function maybeAskClean() {
    if (!curHero || noSell() || autoSellCfg(curHero).asked || !clOv.hidden) return;
    if (!openClean(true)) { autoSellCfg(curHero).asked = true; H.onChange?.(); } // 걸리는 게 없으면 물을 것도 없다
  }
  on(cleanBtn, 'click', () => { if (curHero) openClean(false); });
  on($('.lt-cl-no'), 'click', () => closeClean(true));
  on(clOv, 'click', e => { if (e.target === clOv) closeClean(false); });
  on($('.lt-cl-yes'), 'click', () => {
    const pv = cleanPreview(curHero);
    const got = H.onClean?.(pv.items.map(it => it.id)) || 0; // 도전 중 = 이번 도전 골드, 정비 화면 = 보유 골드(main.js heroDo)
    closeClean(true);
    forceRender();
    toast(got ? `${pv.items.length}개 정리 · +${fmt(got)} 골드` : '정리했어요');
  });

  // ── 등급별 일괄 판매 확인 ──
  function openSellConfirm(rarity) {
    sellRarityTarget = rarity;
    const R = RARITY_BY_KEY[rarity];
    const items = curHero.bag.filter(it => it.rarity === rarity && !it.lock); // v0.1.7 잠금 제외
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

  function notifyLoot(item) { // NEW 표시는 아이템에 붙어 온다(loot.js gainItem · shop.js openBox — item.n)
    if (!item?.id) return;
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
    if (!clOv.hidden) { closeClean(false); return true; }
    if (!asOv.hidden) { asOv.hidden = true; return true; }
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

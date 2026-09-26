// DOM HUD · 하단 패널 · 메뉴/모달 (캔버스 안 연출은 render.js 몫)
import {
  UPGRADES, upgradeCost, upgradeMax, statDisplay, SKILLS, THEMES, SYNERGIES,
  PERKS, perkCost, perkMax, perkDisplay, MAX_STAGE, SPEED3_UNLOCK, OFFLINE_CAP_HOURS,
  SPELLS, SPELL_BY_KEY, FUSIONS, MANA_MAX, PICK_AUTO_T,
} from './config.js';
import { HERO_CLASSES, heroTitle, RARITIES, MILESTONES, heroPower } from './hero.js';
import { heroPortrait, bestRarityIdx } from './heroui.js';
import { fmt } from './util.js';
import { icon } from './icons.js';
import { momentLeft } from './art/hud.js';
import { heroPortraitURL, magePortraitURL, enemyURL } from './art/units.js';

const SYN_BY_KEY = Object.fromEntries(SYNERGIES.map(s => [s.key, s]));
const KIND_TAG = { cannon: '마법', duo: '협동', event: '이벤트' };
const HIDDEN_SYN = SYNERGIES.filter(s => s.kind !== 'fusion');   // 도감: 히든 조합 14
const FUSION_LIST = SYNERGIES.filter(s => s.kind === 'fusion');  // 도감: 원소 융합 8
const FUSION_BY_KEY = Object.fromEntries(FUSIONS.map(f => [f.key, f]));
const ELEMENT_NAME = { fire: '화염', lightning: '번개', frost: '냉기', wind: '바람', holy: '신성', dark: '암흑', summon: '소환' };
const RARITY_BY_KEY = Object.fromEntries(RARITIES.map(r => [r.key, r]));
const MILESTONE_BY_KEY = Object.fromEntries(MILESTONES.map(m => [m.key, m]));
const TIPS = [
  '번 골드는 그대로 남아요. 강화하고 다시 도전!',
  '빙결로 시간을 벌고, 운석으로 한 번에 쓸어버리세요.',
  '자동 강화를 켜 두면 골드를 알아서 써요.',
  '성벽 결계가 모자라면 보스 한 방에 무너져요.',
  '막히면 이전 층에서 골드를 모아 오세요.',
  '두 마법사의 레벨이 묘하게 맞아떨어지면… 무슨 일이 생길까요?',
  '마나가 차면 판타지 스킬 카드를 골라요. 스테이지가 끝나면 빌드가 초기화돼요.',
];
const CLEAR_SHOW_MS = 2200;
const HOLD_DELAY = 350;           // 누르고 있으면 이 뒤부터 연타
const HOLD_RATE = [4, 20];        // 초당 구매 시도: 시작 → 최대
const PICK_RING_C = 2 * Math.PI * 17; // pick-ring 원 둘레(반지름 17)

const txt = (el, s) => { if (el._t !== s) { el._t = s; el.textContent = s; } };
const html = (el, s) => { if (el._h !== s) { el._h = s; el.innerHTML = s; } };
const prop = (el, name, v) => { if (el['_' + name] !== v) { el['_' + name] = v; el.style.setProperty(name, v); } };
const attr = (el, name, v) => { if (el.getAttribute(name) !== v) el.setAttribute(name, v); };
const frac = x => (x > 0 ? (x < 1 ? x : 1) : 0).toFixed(3);
const BUMP = [{ transform: 'scale(1)' }, { transform: 'scale(1.2)', offset: 0.35 }, { transform: 'scale(1)' }];
const BUMP_SOFT = [{ transform: 'scale(1)' }, { transform: 'scale(1.04)', offset: 0.35 }, { transform: 'scale(1)' }];
const SPRING = 'cubic-bezier(.34,1.56,.64,1)';
const bumpOpts = { duration: 260, easing: SPRING };

// ── 마법 판타지 아이콘: 이모지 대신 굵은 인라인 SVG (docs/ART.md §8) ──
const svg = (view, inner) => `<svg viewBox="0 0 ${view} ${view}" aria-hidden="true">${inner}</svg>`;
const ELEMENT_ICON = {
  fire: svg(48, '<path d="M24 4c-7 9-11 15-11 22a11 11 0 0 0 22 0c0-5-2-8-5-11 0 5-3 8-6 8a4.5 4.5 0 1 1 0-9c1 0 2 .3 2 .3-1-4-3-7-2-10z" fill="currentColor"/>'),
  lightning: svg(48, '<path d="M27 2 9 27h10l-5 19 24-29H26z" fill="currentColor"/>'),
  frost: svg(48, '<g stroke="currentColor" stroke-width="4" stroke-linecap="round"><line x1="24" y1="5" x2="24" y2="43"/><line x1="7" y1="14.5" x2="41" y2="33.5"/><line x1="7" y1="33.5" x2="41" y2="14.5"/></g>'),
  wind: svg(48, '<path d="M5 17c9-11 22-10 27-2 3.5 5.5.5 13-7 13-4.5 0-7-3-6-7" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M9 31c7-6 17-6 23 1 2.6 3 0 7.5-4.5 7.5-3 0-4.5-2-4-4" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".65"/>'),
  holy: svg(48, '<circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" stroke-width="3" opacity=".45"/><path d="M20 5h8v14h14v8H28v14h-8V27H6v-8h14z" fill="currentColor"/>'),
  dark: svg(48, '<path d="M31 5a19 19 0 1 0 0 38 24 24 0 0 1 0-38z" fill="currentColor"/><circle cx="17" cy="24" r="2.4" fill="#fff" opacity=".85"/>'),
  summon: svg(48, '<circle cx="24" cy="24" r="16" fill="none" stroke="currentColor" stroke-width="4"/><path d="M24 14l6 10-6 10-6-10z" fill="currentColor"/>'),
};
const STAT_ICON = {
  atk: svg(48, '<circle cx="24" cy="24" r="16" fill="currentColor"/><path d="M24 12l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" fill="#fff" opacity=".55"/>'),
  rate: svg(48, '<path d="M6 18c8-3 16-3 24 0M4 28c10-3 20-3 30 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M34 10l6 14-6 14-6-14z" fill="currentColor"/>'),
  crit: svg(48, '<circle cx="21" cy="27" r="13" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="21" cy="27" r="4.5" fill="currentColor"/><path d="M31 3 16 25h8l-4 17 19-25h-9z" fill="currentColor"/>'),
  multi: svg(48, '<circle cx="11" cy="34" r="7" fill="currentColor"/><circle cx="24" cy="13" r="8" fill="currentColor"/><circle cx="37" cy="34" r="7" fill="currentColor"/>'),
  wall: svg(48, '<path d="M24 4 42 11v13c0 12-8 18-18 20-10-2-18-8-18-20V11z" fill="currentColor"/><path d="M24 12v24M15 20h18" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".55"/>'),
};
const CLASS_ICON = {
  knight: svg(32, '<path d="M20 2l10 10-3 3-3-3-11 11-4 4-3-3 4-4 11-11-3-3z" fill="currentColor"/>'),
  ranger: svg(32, '<path d="M7 4c11 2 15 10 15 12S18 26 7 28l2-4a14 14 0 0 0 0-16z" fill="currentColor"/><path d="M3 16h20M19 16l-4.5-4M19 16l-4.5 4" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/>'),
  sorcerer: svg(32, '<path d="M14 30V11" stroke="currentColor" stroke-width="3"/><path d="M14 2l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" fill="currentColor"/>'),
  cleric: svg(32, '<path d="M12 2h8v6h-8z" fill="currentColor"/><path d="M9 8h14v6H9z" fill="currentColor"/><path d="M13 14h6v16h-6z" fill="currentColor"/>'),
  assassin: svg(32, '<path d="M6 26 22 5l3 3-16 21z" fill="currentColor"/><path d="M26 26 10 5 7 8l16 21z" fill="currentColor" opacity=".8"/>'),
};
const elementIcon = el => ELEMENT_ICON[el] || '';
// 스펠별 고유 아이콘 (같은 원소 두 스펠이 같은 그림이 되지 않게) — 원소색 채움 + --ink 외곽 + 흰 광택, 48 그리드
const spI = inner => `<svg viewBox="0 0 48 48" aria-hidden="true"><g fill="currentColor" stroke="#22163a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">${inner}</g></svg>`;
const HL = (d, o = .7) => `<path d="${d}" fill="#fff" stroke="none" opacity="${o}"/>`;
const SPELL_ICON = {
  fireball: spI('<path d="M31 5c-1 7 7 10 7 20a13 13 0 1 1-26 1c0-8 6-11 9-16 1 5 3 7 6 7 0-5 1-9 4-12z"/>' + HL('M19 25a6 6 0 0 1 6-5', .8) + '<circle cx="25" cy="31" r="5" fill="#fff6d0" stroke="none"/>'),
  flameBullet: spI('<path d="M22 26 6 42l3-12-6 1 13-11z"/><circle cx="30" cy="18" r="11"/><circle cx="30" cy="18" r="5" fill="#fff6d0" stroke="none"/>'),
  lightningStrike: spI('<path d="M10 20a8 8 0 0 1 14-6 8 8 0 0 1 14 5 5 5 0 0 1-1 10H12a5 5 0 0 1-2-9z" fill="#e8e4ff"/><path d="M25 24l-7 11h6l-4 10 13-14h-6l4-7z"/>'),
  chainLightning: spI('<path d="M5 36l11-16 8 11 9-16 10 13" fill="none" stroke-width="6"/><circle cx="5" cy="36" r="4"/><circle cx="24" cy="31" r="4"/><circle cx="43" cy="28" r="4"/>'),
  iceLance: spI('<path d="M43 5 29 29l-9-9z"/><path d="M20 20l9 9-18 14-5-5z"/>' + HL('M38 10 30 22', .8)),
  frostWard: spI('<path d="M24 4 41 10v13c0 11-7 18-17 21C14 41 7 34 7 23V10z"/><path d="M24 13v20M16 18l16 10M32 18 16 28" fill="none" stroke="#fff" stroke-width="3"/>'),
  tornado: spI('<path d="M6 10h36l-6 8H14zM12 20h24l-5 8H17zM17 30h14l-4 7h-6zM21 39h6l-2 5h-2z"/>'),
  gale: spI('<path d="M4 16h26a6 6 0 1 0-6-6" fill="none" stroke-width="6"/><path d="M4 26h34a6 6 0 1 1-6 6" fill="none" stroke-width="6"/><path d="M4 36h16" fill="none" stroke-width="6"/>'),
  holyLight: spI('<circle cx="24" cy="24" r="18" fill="#fff6c8"/><path d="M20 8h8v12h12v8H28v12h-8V28H8v-8h12z"/>'),
  judgment: spI('<path d="M17 2h14l-2 32H19z"/><ellipse cx="24" cy="40" rx="18" ry="6"/>' + HL('M21 6h3l-1 24h-1z', .9)),
  curseMark: spI('<path d="M24 3l20 21-20 21L4 24z"/><path d="M11 24c7-9 19-9 26 0-7 9-19 9-26 0z" fill="#f2c8ff"/><circle cx="24" cy="24" r="4.5" fill="#22163a" stroke="none"/>'),
  soulHarvest: spI('<path d="M24 4c10 0 16 8 16 18v20l-5-4-5 5-6-5-6 5-5-5-5 4V22C8 12 14 4 24 4z"/><circle cx="18" cy="20" r="3.5" fill="#fff" stroke="none"/><circle cx="30" cy="20" r="3.5" fill="#fff" stroke="none"/>'),
  babyDragon: spI('<path d="M6 30c2-10 10-16 20-16l4-8 3 9c6 2 10 7 10 13l-6-2c0 7-6 12-14 12S8 36 6 30z"/><circle cx="32" cy="24" r="2.8" fill="#22163a" stroke="none"/><path d="M14 22 6 12l12 4z"/>'),
  stoneGolem: spI('<rect x="8" y="8" width="32" height="32" rx="8" fill="#b8b0a4"/><rect x="14" y="18" width="7" height="6" rx="2" fill="#ffd23a"/><rect x="27" y="18" width="7" height="6" rx="2" fill="#ffd23a"/><path d="M16 32h16M24 8l-3 7" fill="none"/>'),
};
const spellIcon = (key, el) => SPELL_ICON[key] || elementIcon(el);
const classIcon = cls => CLASS_ICON[cls] || '';
const SPARK_ICON = svg(24, '<path d="M12 1l2.4 8.6L23 12l-8.6 2.4L12 23l-2.4-8.6L1 12l8.6-2.4z" fill="currentColor"/>');
// AI 동료 마법사(청록·냉기 계열) — 로봇 이모지 대신 지팡이+서리 아이콘
const AI_ICON = svg(32, '<path d="M22 2 4 20l3 3L25 5z" fill="currentColor"/><circle cx="24" cy="8" r="6" fill="#fff" opacity=".9"/><path d="M24 3v10M19 8h10" stroke="currentColor" stroke-width="2"/>');
// 사람 실루엣(협동 상대 표시용, 미사용에 가까움) — 이모지 대신 최소 도형
const PERSON_ICON = svg(32, '<circle cx="16" cy="9" r="6" fill="currentColor"/><path d="M4 30c0-8 5-13 12-13s12 5 12 13z" fill="currentColor"/>');
// 히든 조합 도감 아이콘: 이모지 대신 기존 원소·수치 아이콘을 재사용하거나(있으면) 최소 도형을 새로 그린다
const SYN_ICON = {
  flame: ELEMENT_ICON.fire, chain: ELEMENT_ICON.lightning, glacier: ELEMENT_ICON.frost, double: STAT_ICON.multi,
  golden: icon('coin'), flawless: icon('gem'), frenzy: ELEMENT_ICON.fire, chainboom: SPARK_ICON,
  pierce: svg(48, '<circle cx="18" cy="24" r="13" fill="none" stroke="currentColor" stroke-width="4"/><circle cx="18" cy="24" r="5" fill="currentColor"/><path d="M20 24h22m0 0-7-7m7 7-7 7" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'),
  homing: svg(48, '<path d="M6 30C10 12 26 6 40 12" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/><path d="M40 12l-9 1 4 8z" fill="currentColor"/>'),
  thorns: svg(48, '<path d="M24 44V4M24 44l-9-14M24 30 33 16M24 20l-8-10M24 20l8-10" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" fill="none"/>'),
  giant: svg(48, '<rect x="20" y="2" width="8" height="30" rx="2.5" fill="currentColor"/><path d="M14 30h20l-3 8H17z" fill="currentColor"/><rect x="19" y="38" width="10" height="8" rx="2" fill="currentColor" opacity=".8"/>'),
  twin: svg(48, '<circle cx="18" cy="24" r="15" fill="currentColor" opacity=".85"/><circle cx="30" cy="24" r="15" fill="currentColor"/>'),
  legend: svg(48, '<path d="M6 16l9 8 9-16 9 16 9-8-4 24H10z" fill="currentColor"/><circle cx="24" cy="10" r="4" fill="currentColor"/>'),
};
const PERK_ICON = {
  pickaxe: svg(48, '<path d="M8 40 30 18" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M12 6c10 0 20 8 24 18-9 0-19-8-24-18z" fill="currentColor"/><path d="M36 6c-10 0-20 8-24 18 9 0 19-8 24-18z" fill="currentColor" opacity=".8"/>'),
  critBoom: STAT_ICON.crit, startGold: icon('coin'),
};
const KIND_ICON = { remote: PERSON_ICON, human: PERSON_ICON };

export function createUI(root, handlers = {}) {
  const H = handlers;
  const $ = id => root.querySelector('#' + id);
  const on = (el, ev, fn) => el.addEventListener(ev, fn);
  const E = {};
  for (const id of [
    'stage-wrap', 'panel', 'title', 'hud-gold', 'gold', 'stage-no', 'theme-name', 'wave', 'wave-text', 'gems',
    'btn-menu', 'menu-new', 'mana', 'spell-row',
    'toasts', 'clear', 'clear-stage', 'clear-gems', 'badge-flawless', 'badge-first', 'btn-next',
    'defeat', 'defeat-stage', 'defeat-tip', 'defeat-kills', 'defeat-prog', 'defeat-rec', 'btn-retry', 'btn-prev', 'end-codex', 'end-hero',
    'pick', 'pick-ring', 'pick-ring-fg', 'pick-ring-n', 'pick-cards', 'pick-reroll', 'pick-reroll-n',
    'btn-hero', 'hb-portrait', 'hb-lv', 'hb-pow', 'hb-new',
    'hero-status', 'hero-icon', 'hero-title', 'hero-lv', 'hero-hp-fill', 'hero-down', 'sk-heroult', 'heroult-ico', 'heroult-name',
    'p2-icon', 'p2-name', 'p2-gold', 'p2-lv', 'p2-syn', 'btn-auto', 'btn-speed', 'speed-text', 'speed-lock', 'btn-autonext',
    'upgrades', 'btn-start', 'start-sub', 'title-ver', 'codex-count', 'codex-fill', 'codex-list', 'codex-list-fusion',
    'ctab-hidden', 'ctab-fusion', 'shop-gems', 'shop-list',
    'set-ver', 'btn-check-update', 'btn-reset', 'reset-confirm', 'btn-reset-yes', 'btn-reset-no',
    'off-time', 'off-gold', 'btn-claim', 'm-ending', 'upd-h', 'upd-size', 'upd-notes', 'btn-upd-now', 'btn-upd-later',
    'btn-open-settings', 'upd-progress', 'upd-progress-text', 'upd-progress-fill',
  ]) {
    E[id] = $(id);
    if (!E[id]) throw new Error('ui: #' + id + ' 없음');
  }
  const stage = root.querySelector('#stage');
  const stars = [...E.clear.querySelectorAll('.star')];

  let view = null, meta = {};
  let lastGold = 0, lastGems = 0;
  const fresh = new Set();   // 새로 발견, 도감을 아직 안 봄(NEW 배지)
  const seen = new Set();    // synergy 이벤트로 본 키 (meta.discovered가 늦게 와도 도감에 반영)

  // 말풍선 툴팁(탭으로 열고 닫음, 스킬 아이콘 줄 · 판타지 카드 융합 힌트가 공용으로 씀)
  const spellTip = document.createElement('div');
  spellTip.id = 'spell-tip';
  spellTip.hidden = true;
  stage.append(spellTip);
  let spellTipTimer = 0;
  function hideSpellTip() { spellTip.hidden = true; }
  function showTip(anchor, cls, htmlText) {
    clearTimeout(spellTipTimer);
    spellTip.className = 'k-tip ' + cls;
    spellTip.innerHTML = htmlText;
    const sr = stage.getBoundingClientRect(), cr = anchor.getBoundingClientRect();
    spellTip.style.left = Math.min(sr.width - 12, Math.max(12, cr.left - sr.left + cr.width / 2)) + 'px';
    spellTip.style.top = (cr.bottom - sr.top + 8) + 'px';
    spellTip.style.transform = 'translateX(-50%)';
    spellTip.hidden = false;
    spellTipTimer = setTimeout(hideSpellTip, 2600);
  }
  function showSpellTip(chip, key) {
    const s = SPELL_BY_KEY[key], lv = (view?.spells?.[key] || 1);
    if (!s) return;
    showTip(chip, 'el-' + s.element, `<b>${s.name} Lv.${lv}</b><br>${s.desc[lv - 1]}`);
  }
  function showFusionTip(anchor) {
    showTip(anchor, '', '<b>✦</b> 무언가 일어날 것 같다…');
  }
  on(stage, 'pointerdown', e => { if (!e.target.closest('.spell-chip, .pc-spark')) hideSpellTip(); });

  // ── 모달 스택 ──
  const stack = []; // { el, prev, onClose }
  let z = 30;
  for (const m of root.querySelectorAll('.modal')) {
    m.querySelector('.k-modal')?.setAttribute('tabindex', '-1');
    on(m, 'click', e => { if (e.target === m) closeModal(m.id); });
    for (const b of m.querySelectorAll('[data-close]')) on(b, 'click', () => closeModal(m.id));
  }
  function openModal(id, onClose) {
    const el = $(id);
    if (stack.some(m => m.el === el)) closeModal(id); // 다시 열면 앞의 것은 정리(콜백 1회 보장)
    const prev = document.activeElement;
    holds.forEach(stop => stop());
    el.hidden = false;
    el.style.zIndex = String(++z);
    stack.push({ el, prev, onClose });
    syncInert();
    (el.querySelector('[data-autofocus]') || el.querySelector('.k-modal'))?.focus({ preventScroll: true });
  }
  function closeModal(id, reason) {
    const i = stack.findIndex(m => m.el.id === id);
    if (i < 0) return;
    const [m] = stack.splice(i, 1);
    m.el.hidden = true;
    syncInert();
    if (m.prev?.isConnected && !m.prev.closest('[hidden],[inert]')) m.prev.focus({ preventScroll: true });
    m.onClose?.(reason);
  }
  const isOpen = id => stack.some(m => m.el.id === id);
  // 모달 뒤는 조작·포커스 불가
  function syncInert() {
    const modal = stack.length > 0;
    E['stage-wrap'].inert = modal || !E.title.hidden;
    E.panel.inert = modal || !E.title.hidden || pickOpen; // 카드 선택 중엔 하단 패널도 잠금(sim도 거부)
    E.panel.classList.toggle('dim', pickOpen);
    E.title.inert = modal;
  }

  // ── 상단 HUD ──
  on(E['btn-menu'], 'click', () => openModal('m-menu'));
  const panels = { codex: openCodex, shop: openShop, settings: openSettings };
  for (const b of root.querySelectorAll('[data-open]')) {
    on(b, 'click', () => {
      if (b.closest('#m-menu')) closeModal('m-menu');
      panels[b.dataset.open]?.();
    });
  }

  // ── 업그레이드 버튼 (누르고 있으면 가속 연타, 길게 누르면 현재→다음 수치 k-tip) ──
  const holds = [];
  const upg = UPGRADES.map(u => {
    const b = document.createElement('button');
    b.className = 'upg';
    b.dataset.stat = u.key;
    // 이름 / 현재 수치 / 비용 — 레벨은 좌상단 배지 (ART §10.3). 현재→다음 수치는 길게 누르면 k-tip
    b.innerHTML = `<span class="u-lv"></span><span class="u-ico" aria-hidden="true">${icon(u.key)}</span><span class="u-name">${u.name}</span><span class="u-val"></span>`
      + '<span class="u-cost"><span class="coin"></span><b></b></span>';
    E.upgrades.append(b);
    holds.push(holdRepeat(b, () => H.onUpgrade?.(u.key)));
    const o = {
      key: u.key, name: u.name, b, lv: b.querySelector('.u-lv'), val: b.querySelector('.u-val'), cost: b.querySelector('.u-cost b'),
      curTxt: '', nxtTxt: '', last: '', costN: Infinity, max: false, dis: null, spT: 0,
    };
    let tipTimer = 0;
    const armTip = () => { clearTimeout(tipTimer); tipTimer = setTimeout(() => {
      showTip(b, '', `<b>${o.name}</b><br>${o.curTxt}${o.max ? ' (최대)' : ' → ' + o.nxtTxt}`);
    }, 420); };
    const disarmTip = () => clearTimeout(tipTimer);
    on(b, 'pointerdown', armTip);
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) on(b, ev, disarmTip);
    return o;
  });
  addEventListener('blur', () => holds.forEach(stop => stop()));

  function holdRepeat(b, fire) {
    let timer = 0, t0 = 0;
    const stop = () => { clearTimeout(timer); timer = 0; b.classList.remove('held'); };
    const tick = () => {
      fire();
      const held = (performance.now() - t0 - HOLD_DELAY) / 1000;
      const rate = Math.min(HOLD_RATE[1], HOLD_RATE[0] + 8 * Math.max(0, held));
      timer = setTimeout(tick, 1000 / rate);
    };
    on(b, 'pointerdown', e => {
      if (e.button !== 0) return;
      stop();
      t0 = performance.now();
      b.classList.add('held');
      fire();
      timer = setTimeout(tick, HOLD_DELAY);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) on(b, ev, stop);
    // 터치는 암묵적 포인터 캡처 때문에 pointerleave가 늦게 오므로 직접 범위 확인
    on(b, 'pointermove', e => {
      if (!timer) return;
      const r = b.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) stop();
    });
    on(b, 'click', e => { if (e.detail === 0) fire(); }); // 키보드(Enter/Space)
    return stop;
  }
  // 롱프레스 메뉴 막기
  on(root, 'contextmenu', e => { if (!e.target.closest('.upd-notes')) e.preventDefault(); });

  function updateUpg(o, me, pa) {
    const lv = me.lv[o.key], pw = o.key === 'wall' ? pa.lv.wall : 0;
    const key = lv + '|' + pw;
    if (o.last !== key) {
      o.last = key;
      o.max = lv >= upgradeMax(o.key);
      o.costN = o.max ? Infinity : upgradeCost(o.key, lv);
      const cur = statDisplay(o.key, lv, pw), nxt = o.max ? '' : statDisplay(o.key, lv + 1, pw);
      o.curTxt = cur; o.nxtTxt = nxt;
      txt(o.lv, 'Lv.' + lv);
      txt(o.val, cur);
      txt(o.cost, o.max ? 'MAX' : fmt(o.costN));
      o.b.classList.toggle('max', o.max);
      o.b.setAttribute('aria-label', o.max
        ? `${o.name} 레벨 ${lv}, 최대 (${cur})`
        : `${o.name} 레벨 ${lv}, ${cur}에서 ${nxt}로, 비용 ${fmt(o.costN)} 골드`);
      o.dis = null;
    }
    const poor = !o.max && !(me.gold >= o.costN);
    const dis = o.max || poor;
    if (o.dis !== dis) {
      o.dis = dis;
      o.b.classList.toggle('poor', poor);
      o.b.setAttribute('aria-disabled', String(dis));
    }
  }

  function sparkle(stat) {
    const o = upg.find(u => u.key === stat);
    const t = performance.now();
    if (!o || t - o.spT < 90) return;
    o.spT = t;
    const s = document.createElement('span');
    s.className = 'spark';
    o.b.append(s);
    setTimeout(() => s.remove(), 550);
    o.lv.animate(BUMP, bumpOpts);
  }

  // ── 스킬 · 토글 · 배속 ──
  const skills = ['meteor', 'freeze'].map(k => {
    const b = $('sk-' + k);
    on(b, 'click', () => H.onSkill?.(k));
    return { k, b, cd: b.querySelector('.sk-cd'), ready: null, cool: null, label: '' };
  });

  // ── 영웅 궁극기 버튼 ──
  const heroUlt = { b: E['sk-heroult'], cd: E['sk-heroult'].querySelector('.sk-cd'), ready: null, cool: null, cls: null, label: '' };
  on(heroUlt.b, 'click', () => H.onHeroUlt?.());
  function updateHeroUlt(h) {
    if (!h) { if (!heroUlt.b.hidden) heroUlt.b.hidden = true; return; }
    if (heroUlt.b.hidden) heroUlt.b.hidden = false;
    if (heroUlt.cls !== h.cls) {
      heroUlt.cls = h.cls;
      html(E['heroult-ico'], classIcon(h.cls));
      txt(E['heroult-name'], (HERO_CLASSES[h.cls]?.ult.name || '궁극기').slice(0, 4));
    }
    const cls = HERO_CLASSES[h.cls] || HERO_CLASSES.knight;
    const down = h.state === 'down';
    // hero.js respawnHero(): clamp(6 + level*0.12, 6, 18) — 다운 중엔 궁극기 쿨타임 링을 부활 카운트다운으로 재사용
    const cdLeft = down ? h.respawnT : h.ultCd;
    const tot = down ? Math.max(6, Math.min(18, 6 + h.level * 0.12)) : cls.ult.cd;
    prop(heroUlt.b, '--cd', frac(tot > 0 ? Math.ceil(cdLeft / tot * 360) / 360 : 0));
    const sec = cdLeft > 0 ? Math.ceil(cdLeft) : 0;
    txt(heroUlt.cd, sec ? String(sec) : '');
    const cool = sec > 0 || down, ready = !cool && view?.phase === 'play';
    if (heroUlt.cool !== cool) { heroUlt.cool = cool; heroUlt.b.classList.toggle('cool', cool); }
    if (heroUlt.ready !== ready) {
      if (ready && heroUlt.ready === false) heroUlt.b.animate(BUMP, bumpOpts);
      heroUlt.ready = ready;
      heroUlt.b.classList.toggle('ready', ready);
    }
    heroUlt.b.classList.toggle('off', view?.phase !== 'play');
    const label = `${cls.ult.name}, ${down ? '영웅이 쓰러짐' : cool ? `남은 시간 ${sec}초` : ready ? '준비됨' : '전투 중에만 사용'}`;
    if (heroUlt.label !== label) { heroUlt.label = label; heroUlt.b.setAttribute('aria-label', label); }
  }

  // ── 영웅 버튼 (초상화 + 레벨 + 전투력, 장비 드롭이 날아와 꽂히는 곳) ──
  let heroBtnKey = '', heroPow = -1;
  on(E['btn-hero'], 'click', () => { E['hb-new'].hidden = true; H.onOpenHero?.(); });
  function updateHeroBtn(hero) {
    const b = E['btn-hero'], show = !!(hero && hero.cls);
    if (b.hidden === show) b.hidden = !show;
    if (!show) { heroBtnKey = ''; return; }
    let key = hero.cls + '|' + hero.level;
    for (const k in hero.equip) key += '|' + (hero.equip[k]?.id || '');
    if (key === heroBtnKey) return;
    heroBtnKey = key;
    html(E['hb-portrait'], heroPortrait(hero));
    txt(E['hb-lv'], String(hero.level));
    const r = RARITIES[bestRarityIdx(hero)];
    b.dataset.r = r ? r.key : '';
    prop(b, '--rc', r ? r.color : '#b9c2d0');
    prop(b, '--rcg', r && r.key !== 'common' ? r.color + '88' : 'transparent');
    const p = heroPower(hero);
    if (heroPow >= 0 && p > heroPow) b.animate(BUMP, bumpOpts);
    heroPow = p;
    txt(E['hb-pow'], fmt(p));
    b.setAttribute('aria-label', `영웅 · 장비: ${heroTitle(hero.cls, hero.level)} Lv.${hero.level}, 전투력 ${fmt(p)}`);
  }

  // ── 영웅 상태 줄 ──
  let heroKey = '';
  function updateHeroStatus(h, hero) {
    if (!h) { if (!E['hero-status'].hidden) E['hero-status'].hidden = true; return; }
    if (E['hero-status'].hidden) E['hero-status'].hidden = false;
    const lv = hero ? hero.level : h.level; // heroUnit.level은 전투 중에만 갱신됨(클리어 후 레벨업 반영)
    const key = h.cls + '|' + lv;
    if (heroKey !== key) {
      heroKey = key;
      html(E['hero-icon'], classIcon(h.cls));
      txt(E['hero-title'], heroTitle(h.cls, lv));
      txt(E['hero-lv'], String(lv));
    }
    const down = h.state === 'down';
    const ratio = down ? 0 : h.hp < 0 || !(h.maxHp > 0) ? 1 : h.hp / h.maxHp; // hp -1 = 막 생성(풀피)
    prop(E['hero-hp-fill'], '--p', frac(ratio));
    E['hero-hp-fill'].parentElement.classList.toggle('low', ratio < 0.35 && !down);
    attr(E['hero-hp-fill'].parentElement, 'aria-valuenow', String(Math.round(Math.max(0, Math.min(1, ratio)) * 100)));
    if (down) {
      E['hero-down'].hidden = false;
      txt(E['hero-down'], `다운 ${Math.max(1, Math.ceil(h.respawnT))}초`);
    } else if (!E['hero-down'].hidden) E['hero-down'].hidden = true;
  }
  on(E['btn-auto'], 'click', () => H.onToggleAuto?.(!view?.players[0].auto));
  on(E['btn-autonext'], 'click', () => H.onToggleAutoNext?.(!meta.autoNext));
  on(E['btn-speed'], 'click', () => {
    if (!meta.unlocked3x && view && view.speed >= 2) toast(`3배속은 ${SPEED3_UNLOCK}층을 클리어하면 열려요`);
    H.onSpeed?.();
  });

  function updateSkill(s, cdLeft, phase) {
    const tot = SKILLS[s.k].cd;
    prop(s.b, '--cd', frac(Math.ceil(cdLeft / tot * 360) / 360));
    const sec = cdLeft > 0 ? Math.ceil(cdLeft) : 0;
    txt(s.cd, sec ? (sec >= 60 ? `${sec / 60 | 0}:${String(sec % 60).padStart(2, '0')}` : String(sec)) : '');
    const cool = sec > 0, ready = !cool && phase === 'play';
    if (s.cool !== cool) { s.cool = cool; s.b.classList.toggle('cool', cool); }
    if (s.ready !== ready) {
      if (ready && s.ready === false) s.b.animate(BUMP, bumpOpts); // 준비 완료 순간 톡
      s.ready = ready;
      s.b.classList.toggle('ready', ready);
    }
    s.b.classList.toggle('off', phase !== 'play'); // 값이 같으면 DOM 변경 없음
    const label = `${SKILLS[s.k].name}, ${cool ? `남은 시간 ${sec}초` : ready ? '준비됨' : '전투 중에만 사용'}`;
    if (s.label !== label) { s.label = label; s.b.setAttribute('aria-label', label); }
  }

  // ── 마나 게이지 · 보유 스킬 아이콘 줄 ──
  let manaWasFull = false, spellRowKey = '';
  function updateMana(v) {
    if (E.mana.hidden) E.mana.hidden = false;
    const p = v.mana.max > 0 ? v.mana.cur / v.mana.max : 0;
    prop(E.mana, '--p', frac(p));
    attr(E.mana, 'aria-valuenow', String(Math.round(Math.max(0, Math.min(1, p)) * 100)));
    const full = p >= 1;
    if (full !== manaWasFull) {
      manaWasFull = full;
      E.mana.classList.remove('full');
      if (full) { void E.mana.offsetWidth; E.mana.classList.add('full'); }
    }
  }
  function updateSpellRow(v) {
    const s = v.spells || {};
    const keys = Object.keys(s);
    const key = keys.map(k => k + s[k]).join(',');
    if (key === spellRowKey) return;
    spellRowKey = key;
    E['spell-row'].hidden = keys.length === 0;
    if (!keys.length) return;
    E['spell-row'].innerHTML = keys.map(k => {
      const sp = SPELL_BY_KEY[k];
      return sp ? `<button type="button" class="spell-chip el-${sp.element}" data-spell="${k}" aria-label="${sp.name} Lv${s[k]}">${spellIcon(k, sp.element)}<span class="lvb">${s[k]}</span></button>` : '';
    }).join('');
    for (const chip of E['spell-row'].children) on(chip, 'click', () => showSpellTip(chip, chip.dataset.spell));
  }

  // ── 판타지 스킬 카드 선택 오버레이 ──
  const MAX_PICK_CARDS = 4;
  E['pick-cards'].innerHTML = Array.from({ length: MAX_PICK_CARDS }, () =>
    `<button class="pick-card" type="button"><span class="pc-tag" hidden></span><span class="pc-spark" hidden>${SPARK_ICON}</span>`
    + '<span class="pc-icowrap"></span><span class="pc-body"><span class="pc-name"></span>'
    + '<span class="pc-pips"><i></i><i></i><i></i></span><span class="pc-desc"></span><span class="pc-rar"></span></span></button>').join('');
  const pickCardEls = [...E['pick-cards'].children].map((b, i) => {
    on(b, 'click', () => { if (pickOpen && !pickClosing) H.onPick?.(i); });
    const spark = b.querySelector('.pc-spark');
    on(spark, 'click', e => { e.stopPropagation(); if (!spark.hidden) showFusionTip(spark); }); // 조건은 숨긴 채 문구만 살짝
    return {
      b, tag: b.querySelector('.pc-tag'), spark, ico: b.querySelector('.pc-icowrap'),
      name: b.querySelector('.pc-name'), pips: [...b.querySelectorAll('.pc-pips i')], desc: b.querySelector('.pc-desc'), rar: b.querySelector('.pc-rar'), spell: null,
    };
  });
  let pickOpen = false, pickClosing = false, pickResolveTimer = 0, pickRef = null, pickWaitRef = null, pickWaitT = 0;
  on(E['pick-reroll'], 'click', () => { if (pickOpen && !pickClosing) H.onReroll?.(); });
  function syncReroll(n) {
    const show = pickOpen && !pickClosing && n > 0;
    if (E['pick-reroll'].hidden === show) E['pick-reroll'].hidden = !show;
    if (show) txt(E['pick-reroll-n'], String(n));
  }

  function openPick(pick) {
    pickOpen = true; pickClosing = false;
    hideSpellTip();
    const n = pick.cards.length;
    E['pick-cards'].classList.toggle('four', n >= 4); // 영웅 Lv15: 4장은 2×2로 크게
    pickCardEls.forEach((c, i) => {
      c.b.classList.remove('in', 'chosen', 'faded');
      if (i >= n) { c.b.hidden = true; c.spell = null; return; }
      c.b.hidden = false;
      const card = pick.cards[i], sp = SPELL_BY_KEY[card.spell];
      c.spell = card.spell;
      c.b.className = `pick-card el-${sp.element} rar-${card.rarity}`;
      html(c.ico, spellIcon(card.spell, sp.element));
      txt(c.name, sp.name);
      c.pips.forEach((p, pi) => p.classList.toggle('on', pi < card.level));
      txt(c.desc, sp.desc[card.level - 1]);
      txt(c.rar, { common: '일반', rare: '희귀', legend: '전설' }[card.rarity] || '일반');
      c.tag.hidden = false;
      if (card.level > 1) { c.tag.className = 'pc-tag up'; txt(c.tag, 'Lv' + card.level); }
      else { c.tag.className = 'pc-tag'; txt(c.tag, 'NEW'); }
      c.spark.hidden = !card.fusionHint;
      c.b.setAttribute('aria-label', `${sp.name}, ${card.level > 1 ? 'Lv' + card.level + ' 강화' : '새 스킬'}. ${sp.desc[card.level - 1]}${card.fusionHint ? '. 무언가 일어날 것 같다…' : ''}`);
    });
    void E['pick-cards'].offsetWidth; // 등장 애니메이션 재시작(rar-legend 후광 포함)
    pickCardEls.forEach((c, i) => { if (i < n) setTimeout(() => c.b.classList.add('in'), 90 * i); });
    syncPickRing(pick);
    E.pick.hidden = false;
    syncInert();
    pickCardEls[0].b.focus?.({ preventScroll: true });
  }
  function syncPickRing(pick) {
    const has = pick.autoLeft != null;
    E['pick-ring'].hidden = !has;
    if (!has) return;
    const left = Math.max(0, pick.autoLeft);
    E['pick-ring-fg'].style.strokeDashoffset = String(PICK_RING_C * (1 - Math.max(0, Math.min(1, left / PICK_AUTO_T))));
    txt(E['pick-ring-n'], String(Math.max(1, Math.ceil(left))));
  }
  function resolvePick(spell) {
    if (!pickOpen || pickClosing) return;
    pickClosing = true;
    let chosen = null;
    for (const c of pickCardEls) {
      if (c.b.hidden) continue;
      if (c.spell === spell && !chosen) { chosen = c; c.b.classList.add('chosen'); } else c.b.classList.add('faded');
    }
    clearTimeout(pickResolveTimer);
    pickResolveTimer = setTimeout(hidePick, 380);
  }
  function hidePick() {
    E.pick.hidden = true;
    E['pick-ring'].hidden = true;
    pickOpen = false; pickClosing = false;
    syncInert();
  }

  // ── 타이틀 ──
  on(E['btn-start'], 'click', () => H.onStart?.());
  // 타이틀 키아트: 전장 스프라이트를 구워 그대로 쓴다(영웅·마법사 2명·먼 적) — 한 번만
  let titleArt = false;
  function paintTitle() {
    if (titleArt) return;
    titleArt = true;
    const q = sel => E.title.querySelector(sel);
    q('.t-hero').src = heroPortraitURL('knight', 3, { weapon: 'epic', armor: 'rare', helm: 'rare', cape: 'legend' }, 420);
    q('.t-mage.l').src = magePortraitURL(0, 3, 420);
    q('.t-mage.r').src = magePortraitURL(1, 3, 420);
    [['slime', '.f1'], ['goblin', '.f2'], ['skeleton', '.f3'], ['imp', '.f4']].forEach(([t, c]) => { q('.t-foes ' + c).src = enemyURL(t, 18, 120); });
  }
  function showTitle({ best = 0, stage = 1 } = {}) {
    try { paintTitle(); } catch (e) { console.warn(e); }
    txt(E['start-sub'], best > 0 || stage > 1 ? `이어하기 · ${stage}층 (최고 ${best}층)` : '1층부터 시작');
    hideClear(false);
    E.defeat.hidden = true;
    E.title.hidden = false;
    syncInert();
  }
  function hideTitle() {
    E.title.hidden = true;
    syncInert();
  }

  // ── 클리어 · 패배 (보스 경고 배너는 render.js 캔버스 몫) ──
  let clearTimer = 0, clearWait = false, endingPending = false;
  function showClear(v) {
    const r = v.result;
    if (!r) return;
    clearTimeout(clearTimer);
    E.defeat.hidden = true;
    txt(E['clear-stage'], `${v.stage}층 클리어`);
    stars.forEach((s, i) => { s.className = i < r.stars ? 'star on' : 'star'; });
    txt(E['clear-gems'], fmt(r.gems?.[0] ?? 0));
    E['badge-flawless'].hidden = !r.flawless;
    E['badge-first'].hidden = !r.firstClear;
    clearWait = !meta.autoNext;
    E['btn-next'].hidden = !clearWait;
    endingPending = v.stage >= MAX_STAGE && !!r.firstClear;
    E.clear.hidden = true;
    void E.clear.offsetWidth; // 별 애니메이션 재시작
    E.clear.hidden = false;
    if (clearWait) E['btn-next'].focus({ preventScroll: true });
    else clearTimer = setTimeout(hideClear, CLEAR_SHOW_MS);
  }
  function hideClear(ending = true) {
    clearTimeout(clearTimer);
    const was = !E.clear.hidden;
    E.clear.hidden = true;
    clearWait = false;
    if (was && ending && endingPending) openEnding();
    endingPending = false;
  }
  on(E['btn-next'], 'click', () => { hideClear(); H.onNext?.(); });

  function showDefeat(stage) {
    hideClear(false);
    txt(E['defeat-stage'], `${stage}층 방어 실패`);
    const pr = view?.progress, tot = pr?.total || 0, kd = Math.min(pr?.killed || 0, tot);
    txt(E['defeat-kills'], `${kd}/${tot}`);
    txt(E['defeat-prog'], `${tot ? Math.floor(kd / tot * 100) : 0}%`);
    // 추천 강화: 살 수 있는 것 중 성벽 결계 우선, 없으면 가장 싼 것 → 버튼이 반짝이고 한 줄 안내
    const me = view?.players?.[0];
    const can = upg.filter(o => !o.max && me && me.gold >= o.costN);
    const rec = can.find(o => o.key === 'wall') || can.sort((a, b) => a.costN - b.costN)[0];
    for (const o of upg) o.b.classList.toggle('is-rec', o === rec);
    E['defeat-rec'].hidden = !rec;
    if (rec) E['defeat-rec'].innerHTML = `${icon(rec.key)}<span>추천: <b>${rec.name}</b> 강화하고 재도전!</span>`;
    txt(E['defeat-tip'], TIPS[Math.floor(Math.random() * TIPS.length)]);
    E['btn-prev'].disabled = stage <= 1;
    E.defeat.hidden = false;
    E['btn-retry'].focus({ preventScroll: true });
  }
  const clearRec = () => { for (const o of upg) o.b.classList.remove('is-rec'); };
  on(E['btn-retry'], 'click', () => { E.defeat.hidden = true; clearRec(); H.onRetry?.(); });
  on(E['btn-prev'], 'click', () => { E.defeat.hidden = true; clearRec(); H.onPrevStage?.(); });

  function openEnding() {
    const c = E['m-ending'].querySelector('.confetti');
    if (!c.childElementCount) {
      const colors = ['#ffd23f', '#ff5a7a', '#5fd8ff', '#7ee36b', '#c77dff', '#ff9f1a'];
      for (let i = 0; i < 48; i++) {
        const p = document.createElement('i');
        p.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};`
          + `animation-duration:${2.4 + Math.random() * 2.6}s;animation-delay:${-Math.random() * 5}s`;
        c.append(p);
      }
    }
    txt(E['end-codex'], `${discovered().size}/${SYNERGIES.length}`);
    txt(E['end-hero'], view?.hero?.cls ? `Lv.${view.hero.level}` : '-');
    openModal('m-ending');
  }

  // ── 도감 (히든 조합 14 + 원소 융합 8) ──
  E['codex-list'].innerHTML = HIDDEN_SYN.map(s => `<li class="syn-card" data-key="${s.key}"><div class="syn-ico" aria-hidden="true"></div>`
    + '<div class="syn-body"><div class="syn-name"></div><div class="syn-text"></div></div>'
    + `<span class="syn-tag ${s.kind}">${KIND_TAG[s.kind]}</span><span class="syn-new" hidden>NEW</span></li>`).join('');
  E['codex-list-fusion'].innerHTML = FUSION_LIST.map(s => `<li class="syn-card fusion" data-key="${s.key}"><div class="syn-ico fusion-ico" aria-hidden="true"></div>`
    + '<div class="syn-body"><div class="syn-name"></div><div class="syn-text"></div></div>'
    + '<span class="syn-tag fusion"></span><span class="syn-new" hidden>NEW</span></li>').join('');
  const mkCards = (list, root2) => [...root2.children].map((li, i) => ({
    s: list[i], li, ico: li.querySelector('.syn-ico'), name: li.querySelector('.syn-name'),
    text: li.querySelector('.syn-text'), tag: li.querySelector('.syn-tag'), nw: li.querySelector('.syn-new'),
  }));
  const cards = mkCards(HIDDEN_SYN, E['codex-list']);
  const fusionCards = mkCards(FUSION_LIST, E['codex-list-fusion']);
  let codexNew = new Set(), codexCount = -1, codexTab = 'hidden';
  function discovered() {
    const d = meta.discovered;
    const set = d instanceof Set ? new Set(d) : new Set(Array.isArray(d) ? d : []);
    for (const k of seen) set.add(k);
    return set;
  }
  function renderCodexCard(c, d) {
    const known = d.has(c.s.key);
    c.li.classList.toggle('locked', !known);
    txt(c.name, known ? c.s.name : '???');
    txt(c.text, known ? c.s.desc : c.s.hint);
    c.nw.hidden = !(codexNew.has(c.s.key) || fresh.has(c.s.key));
    if (c.s.kind === 'fusion') { // 원소 융합: 발견 전엔 원소 조합을 절대 드러내지 않는다
      const f = FUSION_BY_KEY[c.s.key];
      if (known && f) {
        const [a, b] = f.elements;
        html(c.ico, SPARK_ICON);
        c.ico.style.background = `linear-gradient(135deg, var(--elc-${a}) 50%, var(--elc-${b}) 50%)`;
        txt(c.tag, `${ELEMENT_NAME[a]}+${ELEMENT_NAME[b]}`);
      } else {
        c.ico.style.background = '';
        html(c.ico, '');
        txt(c.tag, '');
      }
    } else {
      html(c.ico, known ? SYN_ICON[c.s.key] : '?');
      txt(c.tag, KIND_TAG[c.s.kind] ?? '');
    }
    return known;
  }
  function renderCodex() {
    const d = discovered();
    codexCount = d.size;
    let n = 0;
    for (const c of cards) if (renderCodexCard(c, d)) n++;
    for (const c of fusionCards) if (renderCodexCard(c, d)) n++;
    txt(E['codex-count'], `${n}/${SYNERGIES.length} 발견`);
    prop(E['codex-fill'], '--p', frac(n / SYNERGIES.length));
  }
  function setCodexTab(t) {
    codexTab = t;
    E['codex-list'].hidden = t !== 'hidden';
    E['codex-list-fusion'].hidden = t !== 'fusion';
    attr(E['ctab-hidden'], 'aria-selected', String(t === 'hidden'));
    attr(E['ctab-fusion'], 'aria-selected', String(t === 'fusion'));
  }
  on(E['ctab-hidden'], 'click', () => setCodexTab('hidden'));
  on(E['ctab-fusion'], 'click', () => setCodexTab('fusion'));
  function openCodex() {
    codexNew = new Set(fresh);
    fresh.clear();
    setCodexTab(codexTab);
    renderCodex();
    syncNewDots();
    openModal('m-codex');
  }
  function syncNewDots() {
    const has = fresh.size > 0;
    E['menu-new'].hidden = !has;
    for (const el of root.querySelectorAll('#m-menu .new-tag, #title [data-open="codex"] .dot')) el.hidden = !has;
  }

  // ── 보석 상점 ──
  E['shop-list'].innerHTML = PERKS.map(p => `<div class="perk"><div class="perk-icon" aria-hidden="true">${PERK_ICON[p.key]}</div>`
    + `<div class="perk-body"><div class="perk-name">${p.name} <span class="perk-lv num"></span></div>`
    + `<div class="perk-desc">${p.desc}</div><div class="perk-fx"></div></div>`
    + `<button class="k-btn s secondary gem-btn">${icon('gem')}<b></b></button></div>`).join('');
  const perkRows = [...E['shop-list'].children].map((el, i) => {
    const p = PERKS[i], btn = el.querySelector('button');
    on(btn, 'click', () => {
      if (btn.disabled) return;
      el.animate(BUMP_SOFT, bumpOpts);
      H.onBuyPerk?.(p.key);
    });
    return { p, btn, lv: el.querySelector('.perk-lv'), fx: el.querySelector('.perk-fx'), cost: btn.querySelector('b') };
  });
  let shopKey = '';
  function renderShop() {
    const gems = Number(meta.gems) || 0, perks = meta.perks || {};
    const key = gems + '|' + PERKS.map(p => perks[p.key] | 0).join(',');
    if (key === shopKey) return;
    shopKey = key;
    txt(E['shop-gems'], fmt(gems));
    for (const r of perkRows) {
      const k = r.p.key, lv = perks[k] | 0, max = perkMax(k), isMax = lv >= max, cost = perkCost(k, lv);
      txt(r.lv, `Lv.${lv}/${max}`);
      txt(r.fx, isMax ? `${perkDisplay(k, lv)} (최대)` : `${perkDisplay(k, lv)} → ${perkDisplay(k, lv + 1)}`);
      txt(r.cost, isMax ? 'MAX' : fmt(cost));
      r.btn.disabled = isMax || gems < cost;
      r.btn.setAttribute('aria-label', isMax ? `${r.p.name} 최대 레벨` : `${r.p.name} 강화, 보석 ${cost}개`);
    }
  }
  function openShop() {
    shopKey = '';
    renderShop();
    openModal('m-shop');
  }

  // ── 설정 ──
  const segBtns = [...root.querySelectorAll('#m-settings [data-dmg]')];
  const switches = [...root.querySelectorAll('#m-settings [data-set]')];
  const setSettings = patch => {
    const next = { ...meta.settings, ...patch };
    meta = { ...meta, settings: next }; // 다음 update 전에도 바로 반영
    renderSettings();
    H.onSettings?.(next);
  };
  for (const b of segBtns) on(b, 'click', () => setSettings({ dmgNumbers: b.dataset.dmg }));
  for (const b of switches) on(b, 'click', () => setSettings({ [b.dataset.set]: !meta.settings?.[b.dataset.set] }));
  function renderSettings() {
    const s = meta.settings || {};
    for (const b of segBtns) attr(b, 'aria-checked', String(b.dataset.dmg === (s.dmgNumbers || 'full')));
    for (const b of switches) attr(b, 'aria-checked', String(!!s[b.dataset.set]));
  }
  function resetConfirm(open) {
    E['btn-reset'].hidden = open;
    E['reset-confirm'].hidden = !open;
  }
  on(E['btn-reset'], 'click', () => { resetConfirm(true); E['btn-reset-no'].focus({ preventScroll: true }); });
  on(E['btn-reset-no'], 'click', () => { resetConfirm(false); E['btn-reset'].focus({ preventScroll: true }); });
  on(E['btn-reset-yes'], 'click', () => {
    resetConfirm(false);
    closeModal('m-settings');
    fresh.clear();
    seen.clear();
    syncNewDots();
    H.onResetSave?.();
  });
  on(E['btn-check-update'], 'click', () => {
    const b = E['btn-check-update'];
    b.disabled = true;
    setTimeout(() => { b.disabled = false; }, 2500);
    H.onCheckUpdate?.();
  });
  function openSettings() {
    resetConfirm(false);
    renderSettings();
    openModal('m-settings');
  }

  // ── 오프라인 보상 ──
  function showOfflineReward({ gold = 0, minutes = 0 } = {}, onClaim) {
    const h = Math.floor(minutes / 60), m = minutes % 60;
    const capped = minutes >= OFFLINE_CAP_HOURS * 60 ? ' (최대)' : '';
    txt(E['off-time'], `${h ? h + '시간 ' : ''}${m ? m + '분' : ''}${capped} 동안 황금 곡괭이가 골드를 모았어요!`);
    txt(E['off-gold'], fmt(gold));
    openModal('m-offline', () => onClaim?.());
  }
  E['btn-claim'].dataset.autofocus = '';
  on(E['btn-claim'], 'click', () => closeModal('m-offline'));

  // ── 업데이트 ──
  E['btn-upd-now'].dataset.autofocus = '';
  E['btn-open-settings'].dataset.autofocus = '';
  E['m-ending'].querySelector('[data-close]').dataset.autofocus = '';
  function showUpdateReady({ version = '', notes = '', size = 0 } = {}) {
    const ver = String(version).replace(/^v/i, '');
    txt(E['upd-h'], `새 버전 v${ver} 준비 완료`);
    txt(E['upd-size'], size > 0 ? `${(size / 1048576).toFixed(1)} MB · 다운로드 완료` : '다운로드 완료');
    txt(E['upd-notes'], cleanNotes(notes) || '버그 수정과 개선이 들어 있어요.');
    openModal('m-update', r => (r === 'now' ? H.onUpdateNow?.() : H.onUpdateLater?.()));
  }
  on(E['btn-upd-now'], 'click', () => closeModal('m-update', 'now'));
  on(E['btn-upd-later'], 'click', () => closeModal('m-update'));
  function showUpdateProgress(pct) {
    const el = E['upd-progress'];
    if (pct == null || !Number.isFinite(Number(pct))) { el.hidden = true; return; }
    pct = Number(pct);
    el.hidden = false;
    el.classList.toggle('indet', pct < 0);
    txt(E['upd-progress-text'], pct < 0 ? '업데이트 받는 중…' : `업데이트 받는 중 ${Math.round(Math.min(100, pct))}%`);
    prop(E['upd-progress-fill'], '--p', frac(pct / 100));
  }
  function showInstallPermissionHelp() {
    openModal('m-install');
  }
  on(E['btn-open-settings'], 'click', () => { closeModal('m-install'); H.onOpenInstallSettings?.(); });

  function setVersion(text) {
    const s = String(text ?? '');
    txt(E['title-ver'], s);
    txt(E['set-ver'], s || '-');
  }

  // ── 토스트 ──
  function toast(msg, ico = '') {
    const t = document.createElement('div');
    t.className = 'k-toast';
    t.innerHTML = (ico ? icon(ico) : '') + '<span></span>';
    t.lastChild.textContent = String(msg);
    E.toasts.append(t);
    while (E.toasts.childElementCount > 3) E.toasts.firstElementChild.remove();
    setTimeout(() => {
      t.classList.add('out');
      setTimeout(() => t.remove(), 300);
    }, 2000);
  }

  // ── 매 프레임 ──
  let p2Syn = '';
  // v = ViewState (타이틀처럼 게임이 없으면 null: 메타 부분만 갱신)
  function update(v, m = {}) {
    meta = m || {};
    if (meta.version) setVersion(meta.version);
    if (isOpen('m-shop')) renderShop();
    if (isOpen('m-settings')) renderSettings();
    if (isOpen('m-codex') && discovered().size !== codexCount) renderCodex();
    if (!v) return;
    view = v;
    const me = v.players[0], pa = v.players[1];

    txt(E['stage-no'], v.stage + '층');
    txt(E['theme-name'], THEMES[v.theme]?.name ?? '');
    const tot = v.progress.total, k = Math.min(v.progress.killed, tot);
    const pf = frac(tot > 0 ? k / tot : 0);
    attr(E.wave, 'aria-valuenow', String(Math.round(pf * 100)));
    prop(E.wave, '--p', pf);
    txt(E['wave-text'], `${k}/${tot}`);
    if (v.mana) updateMana(v);
    updateSpellRow(v);
    stage.classList.toggle('boss-on', !!v.boss);
    if (v.pick) {
      if (pickRef !== v.pick) {
        // 보스 WARNING·컷인이 끝난 뒤 카드가 뜨게 잠깐 기다린다(최대 1.6초 — 자동 선택 3초 안에 카드를 볼 수 있게)
        const now = performance.now();
        if (pickWaitRef !== v.pick) { pickWaitRef = v.pick; pickWaitT = now; }
        if (momentLeft() <= 0.3 || now - pickWaitT > 1600) { pickRef = v.pick; openPick(v.pick); }
      } else syncPickRing(v.pick);
    } else { pickRef = null; pickWaitRef = null; if (pickOpen && !pickClosing) hidePick(); } // 이벤트 없이 사라진 경우(재도전 등) 방어적으로 즉시 닫음
    syncReroll(v.rerollLeft | 0);
    updateHeroBtn(v.hero);

    const gs = fmt(me.gold);
    if (gs !== E.gold._t && me.gold > lastGold) bump(E['hud-gold']);
    txt(E.gold, gs);
    lastGold = me.gold;
    const gems = Number(meta.gems) || 0;
    if (gems > lastGems) bump(E.gems.parentElement);
    txt(E.gems, fmt(gems));
    lastGems = gems;

    for (const o of upg) updateUpg(o, me, pa);
    updateSkill(skills[0], me.cd.meteor, v.phase);
    updateSkill(skills[1], me.cd.freeze, v.phase);
    attr(E['btn-auto'], 'aria-pressed', String(!!me.auto));
    attr(E['btn-autonext'], 'aria-pressed', String(!!meta.autoNext));
    txt(E['speed-text'], v.speed + 'x');
    if (E['speed-lock'].hidden !== !!meta.unlocked3x) E['speed-lock'].hidden = !!meta.unlocked3x;

    updateHeroStatus(v.heroUnit, v.hero);
    updateHeroUlt(v.heroUnit);

    html(E['p2-icon'], pa.kind === 'bot' ? AI_ICON : (KIND_ICON[pa.kind] ?? PERSON_ICON));
    txt(E['p2-name'], pa.kind === 'bot' ? 'AI 동료 마법사' : pa.name);
    txt(E['p2-gold'], fmt(pa.gold));
    let lvSum = 0;
    for (const key in pa.lv) lvSum += pa.lv[key];
    txt(E['p2-lv'], String(lvSum));
    const synKey = (pa.syn || []).join() + '|' + (v.duo || []).join();
    if (synKey !== p2Syn) {
      p2Syn = synKey;
      const synIcon = key => `<span title="${SYN_BY_KEY[key]?.name ?? ''}" aria-label="${SYN_BY_KEY[key]?.name ?? ''}">${SYN_ICON[key] ?? ''}</span>`;
      const duo = (v.duo || []).filter(k => SYN_ICON[k]);
      E['p2-syn'].innerHTML = (pa.syn || []).filter(k => SYN_ICON[k]).map(synIcon).join('')
        + (duo.length ? `<span class="sep" aria-hidden="true">${icon('partner')}</span>` + duo.map(synIcon).join('') : '');
    }

    // 다른 경로로 다음 판이 시작되면 대기 중인 창 정리
    if (v.phase === 'play') {
      if (clearWait) hideClear();
      if (!E.defeat.hidden) { E.defeat.hidden = true; clearRec(); }
    }
  }
  function bump(el) {
    const t = performance.now();
    if (t - (el._bt || 0) < 120) return;
    el._bt = t;
    el.animate(BUMP, bumpOpts);
  }

  function onEvents(events, v) {
    for (const ev of events) {
      switch (ev.type) {
        case 'clear': showClear(v); break;
        case 'defeat': showDefeat(ev.stage ?? v.stage); break;
        case 'upgrade': if (ev.o === 0) sparkle(ev.stat); break;
        case 'spellPick': resolvePick(ev.spell); break;
        case 'heroLevelUp': {
          const m = MILESTONE_BY_KEY[ev.milestone];
          if (m) toast(`영웅 Lv.${ev.level}! ${m.desc} 해금`); // 일반 레벨업은 캔버스 LEVEL UP 연출만
          break;
        }
        case 'loot': {
          E['hb-new'].hidden = false;
          const hold = { common: 0.7, uncommon: 1, rare: 1.2, epic: 1.35, legend: 1.6 }[ev.item?.rarity] ?? 1; // render.js lootFx: 빛기둥 → 가방 비행
          setTimeout(() => bump(E['btn-hero']), (hold + 0.55) * 1000);
          if (ev.item && ev.item.rarity === 'epic') toast(`${RARITY_BY_KEY.epic?.name ?? ''} 획득 · ${ev.item.name}`, 'chest'); // 전설은 캔버스 '전설 획득!' 배너
          break;
        }
        case 'synergy':
          if (SYN_BY_KEY[ev.key]) seen.add(ev.key);
          if (ev.first && SYN_BY_KEY[ev.key]) {
            fresh.add(ev.key);
            syncNewDots();
            if (isOpen('m-codex')) renderCodex();
          }
          break;
      }
    }
  }

  function isBusy() {
    return stack.length > 0 || !E.defeat.hidden || !E.clear.hidden || pickOpen;
  }

  // 안드로이드 뒤로가기: 모달을 닫으면 true. 선택을 기다리는 패배·클리어 창은 삼키고 true(앱 종료 방지)
  // 판타지 카드 선택 중엔 아무 것도 하지 않고 그냥 삼킨다(뒤로가기로 선택을 피할 수 없게)
  function handleBack() {
    if (pickOpen) return true;
    if (stack.length) {
      closeModal(stack[stack.length - 1].el.id);
      return true;
    }
    return !E.defeat.hidden || clearWait;
  }
  on(document, 'keydown', e => {
    if (e.key === 'Escape' && stack.length) { e.preventDefault(); handleBack(); }
  });

  syncInert();
  return {
    showTitle, hideTitle, update, onEvents, toast, showOfflineReward, isBusy, handleBack,
    showUpdateReady, showUpdateProgress, showInstallPermissionHelp, setVersion,
  };
}

// 릴리스 노트(마크다운) → 읽기 좋은 평문
function cleanNotes(s) {
  return String(s ?? '').replace(/\r/g, '').split('\n')
    .map(l => l.replace(/^\s*#+\s*/, '').replace(/^\s*[-*]\s+/, '• ').replace(/\*\*|__|`/g, ''))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000);
}

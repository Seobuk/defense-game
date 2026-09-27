// DOM HUD · 하단 패널 · 메뉴/모달 · 정비 화면(camp.js) · 결과 화면 · 이어하기 · 저장 백업 (캔버스 안 연출은 render.js 몫)
// 로그라이트 구조(docs/DESIGN.md '로그라이트 구현 계약'): 타이틀 → (이어하기 | 정비) → 도전 → 결과 → 정비.
// 모든 상태 변경은 handlers(H.*)로 호출측(main.js)에 넘긴다 — 아래 createUI 주석이 계약이다.
import {
  UPGRADES, upgradeCost, upgradeMax, statDisplay, SKILLS, THEMES, SYNERGIES, SPEED3_UNLOCK, OFFLINE_CAP_HOURS,
  SPELL_BY_KEY, FUSIONS, PICK_AUTO_T, SPELL_SLOTS, SPELL_MAX_LV, AWAKENINGS, AWAKEN_BY_KEY, MAX_STAGE,
} from './config.js';
import { HERO_CLASSES, heroTitle, RARITIES, MILESTONES, heroPower, heroClearXp, heroTier } from './hero.js';
import { heroPortrait, bestRarityIdx, CLS_INFO } from './heroui.js';
import { talentLeft } from './talents.js';
import { createCamp } from './camp.js';
import { fmt } from './util.js';
import { icon } from './icons.js';
import { momentLeft } from './art/hud.js';
import { heroPortraitURL, magePortraitURL, enemyURL, itemIconURL } from './art/units.js';
import { emblemImg } from './art/emblems.js';

const SYN_BY_KEY = Object.fromEntries(SYNERGIES.map(s => [s.key, s]));
const KIND_TAG = { cannon: '마법', duo: '협동', event: '이벤트' };
const HIDDEN_SYN = SYNERGIES.filter(s => s.kind !== 'fusion');   // 도감: 히든 조합 14
const FUSION_LIST = SYNERGIES.filter(s => s.kind === 'fusion');  // 도감: 원소 융합 8
const FUSION_BY_KEY = Object.fromEntries(FUSIONS.map(f => [f.key, f]));
const ELEMENT_NAME = { fire: '화염', lightning: '번개', frost: '냉기', wind: '바람', holy: '신성', dark: '암흑', summon: '소환' };
const RARITY_BY_KEY = Object.fromEntries(RARITIES.map(r => [r.key, r]));
const MILESTONE_BY_KEY = Object.fromEntries(MILESTONES.map(m => [m.key, m]));
const AWAKEN_ICON = { power: 'atk', haste: 'rate', ward: 'wall', fortune: 'coin' };
const AWAKEN_STAT = { power: 'atk', haste: 'rate', ward: 'wall', fortune: 'gold' }; // AWAKENINGS 의 수치 필드
const GEM_ROWS = [['floor', '층 클리어', 'wall'], ['first', '첫 돌파', 'new'], ['boss', '네임드 보스', 'trophy'], ['flawless', '무결점', 'check'], ['best', '신기록 보너스', 'crit']];
const CLEAR_SHOW_MS = 3200;
const DEFEAT_HOLD_MS = 1600;      // 패배 도장을 보여 주는 최소 시간 → 결과 화면
const BERSERK_T = 80;             // sim.js BERSERK_T 와 같은 값(광폭화 시작 초) — 10초 전부터 경고
const HOLD_DELAY = 350;           // 누르고 있으면 이 뒤부터 연타
const HOLD_RATE = [4, 20];        // 초당 구매 시도: 시작 → 최대
const ULT_SHORT = { knight: '성방패', ranger: '화살비', sorcerer: '블리자드', cleric: '천상치유', assassin: '그림자' };
const PICK_RING_C = 2 * Math.PI * 17; // pick-ring 원 둘레(반지름 17)
const MAX_PICK_CARDS = 5;         // 3 + 영웅 Lv15 + 영구 강화 '카드 선택지'

const txt = (el, s) => { if (el._t !== s) { el._t = s; el.textContent = s; } };
const html = (el, s) => { if (el._h !== s) { el._h = s; el.innerHTML = s; } };
const prop = (el, name, v) => { if (el['_' + name] !== v) { el['_' + name] = v; el.style.setProperty(name, v); } };
const attr = (el, name, v) => { if (el.getAttribute(name) !== v) el.setAttribute(name, v); };
const frac = x => (x > 0 ? (x < 1 ? x : 1) : 0).toFixed(3);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const BUMP = [{ transform: 'scale(1)' }, { transform: 'scale(1.2)', offset: 0.35 }, { transform: 'scale(1)' }];
const bumpOpts = { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' };
const fmtTime = sec => {
  sec = Math.max(0, Math.round(sec || 0));
  const h = sec / 3600 | 0, m = (sec % 3600) / 60 | 0, s = sec % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
};

// ── 아이콘: 이모지 대신 SVG · 그린 엠블럼 (docs/ART.md §8) ──
const svg = (view, inner) => `<svg viewBox="0 0 ${view} ${view}" aria-hidden="true">${inner}</svg>`;
const CLASS_ICON = {
  knight: svg(32, '<path d="M20 2l10 10-3 3-3-3-11 11-4 4-3-3 4-4 11-11-3-3z" fill="currentColor"/>'),
  ranger: svg(32, '<path d="M7 4c11 2 15 10 15 12S18 26 7 28l2-4a14 14 0 0 0 0-16z" fill="currentColor"/><path d="M3 16h20M19 16l-4.5-4M19 16l-4.5 4" stroke="currentColor" stroke-width="2.6" fill="none" stroke-linecap="round"/>'),
  sorcerer: svg(32, '<path d="M14 30V11" stroke="currentColor" stroke-width="3"/><path d="M14 2l3 6 6 1-5 4 1 6-5-3-5 3 1-6-5-4 6-1z" fill="currentColor"/>'),
  cleric: svg(32, '<path d="M12 2h8v6h-8z" fill="currentColor"/><path d="M9 8h14v6H9z" fill="currentColor"/><path d="M13 14h6v16h-6z" fill="currentColor"/>'),
  assassin: svg(32, '<path d="M6 26 22 5l3 3-16 21z" fill="currentColor"/><path d="M26 26 10 5 7 8l16 21z" fill="currentColor" opacity=".8"/>'),
};
const spellIcon = (key, el) => emblemImg(key) || icon('el-' + el);
const synIcon = key => emblemImg(key);
const classIcon = cls => CLASS_ICON[cls] || '';
const SPARK_ICON = svg(24, '<path d="M12 1l2.4 8.6L23 12l-8.6 2.4L12 23l-2.4-8.6L1 12l8.6-2.4z" fill="currentColor"/>');
const AI_ICON = svg(32, '<path d="M22 2 4 20l3 3L25 5z" fill="currentColor"/><circle cx="24" cy="8" r="6" fill="#fff" opacity=".9"/><path d="M24 3v10M19 8h10" stroke="currentColor" stroke-width="2"/>');
const pips = (n, max = SPELL_MAX_LV) => Array.from({ length: max }, (_, i) => `<i${i < n ? ' class="on"' : ''}></i>`).join('');

/*
  createUI(root, handlers) — root = #app. 반환 API와 handlers 계약:

  ── 반환 메서드 ──
  showTitle({ best, run, hero })  타이틀 표시. run(= data.run, 저장된 도전)이 있으면 시작 버튼이 '이어하기'가 되고
                                   0.7초 뒤 이어하기 창(showContinue)을 자동으로 띄운다. hero = data.hero(초상화 레벨·장비용)
  hideTitle()
  showContinue(run, hero)          이어하기 창: 층·클래스·스킬·적립 보석 + [이어하기] / [포기하고 정산하기 → 확인]
  showCamp(meta)                   정비 화면(meta = save 객체 data, 읽기 전용 — 바꾸는 건 handlers). data 객체를 통째로 바꿨으면 다시 부른다
  hideCamp() · isCampOpen()
  refreshCamp()                    강제로 다시 그리기(보통 필요 없음: update(null, …) 마다 서명 비교로 자동 갱신)
  showResult(summary, game)        결과 화면(run.js endRun 의 Summary + 끝난 game — 영웅 기여도 game.dmgDone).
                                   패배 도장·클리어 연출이 떠 있으면 그 뒤에 자연스럽게 이어서 뜬다. [정비하러 가기] → H.onResultDone()
  update(view | null, meta)        매 프레임. view = game(ViewState) 또는 null(타이틀·정비 화면). meta = { gems, best, speed, autoNext,
                                   unlocked3x, settings, discovered, version? }
  onEvents(events, view)           매 프레임 drainEvents 결과
  toast(msg, iconName?) · showOfflineReward({ gems, xp, minutes }, onClaim) · isBusy() · handleBack()
  showUpdateReady({version,notes,size}) · showUpdateProgress(pct|null) · showInstallPermissionHelp() · setVersion(text)

  ── handlers (H) ──
  onStart()                        타이틀 '시작하기'(저장된 도전 없음) → 호출측이 ui.hideTitle(); ui.showCamp(data)
  onContinueRun()                  이어하기 → game = restoreRun(data) 로 전투 시작(타이틀·정비 화면은 호출측이 hide)
  onAbandonRun()                   이어하기 창의 포기 확인 · 일시정지 메뉴 '도전 포기' 확인 → endRun(game | restoreRun(data), data) + store.flush()
                                   → ui.showResult(summary, game) 권장
  onResultDone()                   결과 화면 닫힘 → ui.showCamp(data)
  -- 정비 화면 --
  onCampAct(action) → bool         run.js campAct(data, action) + 저장. action: {type:'heroClass',cls} · {type:'talent',cls,key}
                                   · {type:'talentReset',cls} · {type:'autoTalent',on}  (장비는 영웅 화면 → heroui handlers)
  onBuyMeta(key) → bool            run.js buyMeta(data, key) + 저장
  onStartRun(loadout)              { cls, startSpells[] } → newRun(data, loadout). '도전 시작'은 현재 선택, '같은 조합'은 data.lastLoadout 을 넘긴다
  onOpenHero({ tab })              영웅 화면 열기 tab = 'char' | 'talent' | 'bag'. 정비 화면에서면 heroUI.open(data.hero, { stage: data.best, camp: true }, { tab }),
                                   도전 중이면 heroUI.open(game.hero, { stage: data.best, gold: game.players[0].gold }, { tab })
  -- 전투 --
  onUpgrade(stat) · onToggleAuto(on) · onSkill(skill) · onSpeed() · onToggleAutoNext(on) · onNext()
  onPick(index) · onReroll() · onHeroUlt()
  -- 설정 --
  onSettings(settings) · onResetSave() · onCheckUpdate() · onUpdateNow() · onUpdateLater() · onOpenInstallSettings()
  onBackupSave() → string          지금 저장을 백업 코드 문자열로(save.js). UI가 클립보드에 복사(실패하면 선택 가능한 글상자)
  onRestoreSave(code, preview)     preview === true → 코드를 풀어 검증만: 복원될 저장 객체({ best, gems, runs, hero:{cls,level}, discovered })
                                   또는 null(잘못된 코드). preview 없이 → 실제로 덮어쓰기, 성공 true/실패 false
                                   (성공 뒤 호출측이 data 를 바꾸고 타이틀/정비 화면을 다시 보여 준다)
*/
export function createUI(root, handlers = {}) {
  const H = handlers;
  const $ = id => root.querySelector('#' + id);
  const on = (el, ev, fn) => el.addEventListener(ev, fn);
  const E = {};
  for (const id of [
    'stage-wrap', 'panel', 'title', 'hud-gold', 'gold', 'stage-no', 'theme-name', 'wave', 'wave-text', 'gems',
    'btn-menu', 'menu-new', 'mana', 'spell-row', 'berserk', 'berserk-text', 'st-revive', 'st-awaken', 'st-awaken-n',
    'toasts', 'clear', 'clear-stage', 'clear-gems', 'clear-gold', 'clear-xp', 'clear-drops', 'badge-flawless', 'badge-first', 'btn-next',
    'defeat', 'defeat-stage', 'defeat-icon',
    'pick', 'pick-ring', 'pick-ring-fg', 'pick-ring-n', 'pick-cards', 'pick-reroll', 'pick-reroll-n',
    'btn-hero', 'hb-portrait', 'hb-lv', 'hb-pow', 'hb-new', 'hb-tal',
    'hero-status', 'hero-icon', 'hero-title', 'hero-lv', 'hero-hp-fill', 'hero-down', 'sk-heroult', 'heroult-ico', 'heroult-name',
    'p2-icon', 'p2-name', 'p2-lv', 'p2-spells', 'btn-auto', 'btn-speed', 'speed-text', 'speed-lock', 'btn-autonext',
    'upgrades', 'btn-start', 'start-sub', 'title-ver', 'codex-count', 'codex-fill', 'codex-list', 'codex-list-fusion', 'ctab-hidden', 'ctab-fusion',
    'set-ver', 'btn-check-update', 'btn-reset', 'reset-confirm', 'btn-reset-yes', 'btn-reset-no', 'btn-backup', 'btn-restore',
    'bk-lead', 'bk-code', 'btn-bk-copy', 'rs-step1', 'rs-step2', 'rs-code', 'rs-err', 'btn-rs-check', 'rs-sum', 'btn-rs-back', 'btn-rs-yes',
    'off-time', 'off-art', 'off-gems', 'off-xp', 'btn-claim', 'upd-h', 'upd-size', 'upd-notes', 'btn-upd-now', 'btn-upd-later',
    'btn-open-settings', 'upd-progress', 'upd-progress-text', 'upd-progress-fill',
    'm-result', 'res-art', 'res-rb', 'res-h', 'res-floor', 'res-floor-l', 'res-best', 'res-best-txt', 'res-sub', 'res-boss', 'res-time', 'res-hero',
    'res-share', 'res-bar', 'res-legend', 'res-gem-list', 'res-gem-total', 'res-spells-card', 'res-spells', 'res-unlock', 'btn-res-done',
    'cont-por', 'cont-stage', 'cont-who', 'cont-spells', 'cont-gems', 'cont-main', 'cont-confirm', 'cont-warn', 'btn-cont-go', 'btn-cont-quit', 'btn-cont-no', 'btn-cont-yes',
    'ab-txt', 'btn-ab-yes',
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

  // 말풍선 툴팁(탭으로 열고 닫음 — 스킬 슬롯 · 상태 칩 · 융합 힌트 · 강화 버튼 길게 누르기)
  const spellTip = document.createElement('div');
  spellTip.id = 'spell-tip';
  spellTip.hidden = true;
  stage.append(spellTip);
  let spellTipTimer = 0;
  function hideSpellTip() { spellTip.hidden = true; }
  function showTip(anchor, cls, htmlText, ms = 2800) {
    clearTimeout(spellTipTimer);
    spellTip.className = 'k-tip ' + cls;
    spellTip.innerHTML = htmlText;
    const sr = stage.getBoundingClientRect(), cr = anchor.getBoundingClientRect();
    spellTip.hidden = false;
    const w = spellTip.offsetWidth;
    spellTip.style.left = Math.min(sr.width - 8 - w / 2, Math.max(8 + w / 2, cr.left - sr.left + cr.width / 2)) + 'px';
    const below = cr.bottom - sr.top + 8;
    spellTip.style.top = (below + spellTip.offsetHeight > sr.height - 8 ? cr.top - sr.top - 8 - spellTip.offsetHeight : below) + 'px';
    spellTip.style.transform = 'translateX(-50%)';
    spellTipTimer = setTimeout(hideSpellTip, ms);
  }
  on(stage, 'pointerdown', e => { if (!e.target.closest('.spell-chip, .pc-spark, .st-chip')) hideSpellTip(); });

  // ── 모달 스택 ──
  const stack = []; // { el, prev, onClose }
  let z = 30;
  for (const m of root.querySelectorAll('.modal')) {
    m.querySelector('.k-modal')?.setAttribute('tabindex', '-1');
    if (m.id !== 'm-result' && m.id !== 'm-continue') on(m, 'click', e => { if (e.target === m) closeModal(m.id); });
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
    (el.querySelector('[data-autofocus]') || el.querySelector('.k-modal') || el).focus?.({ preventScroll: true });
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
  // 모달 뒤는 조작·포커스 불가. 타이틀·정비 화면이 떠 있으면 전장·하단 패널도 잠금
  function syncInert() {
    const modal = stack.length > 0, cover = !E.title.hidden || camp.isOpen();
    E['stage-wrap'].inert = modal || cover;
    E.panel.inert = modal || cover || pickOpen; // 카드 선택 중엔 하단 패널도 잠금(sim도 거부)
    E.panel.classList.toggle('dim', pickOpen);
    E.title.inert = modal;
    camp.el.inert = modal;
  }

  // ── 상단 HUD · 메뉴 ──
  on(E['btn-menu'], 'click', () => openModal('m-menu'));
  const panels = {
    codex: openCodex, settings: openSettings, abandon: openAbandon,
    hero: () => H.onOpenHero?.({ tab: view?.hero?.cls && talentLeft(view.hero, view.hero.cls) > 0 ? 'talent' : 'char' }),
  };
  for (const b of root.querySelectorAll('[data-open]')) {
    on(b, 'click', () => {
      if (b.closest('#m-menu')) closeModal('m-menu');
      for (const id of ['m-codex', 'm-settings']) if (isOpen(id)) closeModal(id); // 패널은 한 번에 하나(겹쳐 쌓지 않음)
      panels[b.dataset.open]?.();
    });
  }

  // ── 업그레이드 버튼 (누르고 있으면 가속 연타, 길게 누르면 현재→다음 수치 k-tip) ──
  const holds = [];
  const upg = UPGRADES.map(u => {
    const b = document.createElement('button');
    b.className = 'upg';
    b.dataset.stat = u.key;
    b.innerHTML = `<span class="u-lv"></span><span class="u-ico" aria-hidden="true">${icon(u.key)}</span><span class="u-name">${u.name}</span><span class="u-val"></span>`
      + '<span class="u-cost"><span class="coin"></span><b></b></span>';
    E.upgrades.append(b);
    holds.push(holdRepeat(b, () => H.onUpgrade?.(u.key)));
    const o = { key: u.key, name: u.name, b, lv: b.querySelector('.u-lv'), val: b.querySelector('.u-val'), cost: b.querySelector('.u-cost b'),
      curTxt: '', nxtTxt: '', last: '', costN: Infinity, max: false, dis: null, spT: 0 };
    let tipTimer = 0;
    on(b, 'pointerdown', () => { clearTimeout(tipTimer); tipTimer = setTimeout(() => showTip(b, '', `<b>${o.name}</b><br>${o.curTxt}${o.max ? ' (최대)' : ' → ' + o.nxtTxt}`), 420); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) on(b, ev, () => clearTimeout(tipTimer));
    return o;
  });
  addEventListener('blur', () => holds.forEach(stop => stop()));

  function holdRepeat(b, fire) {
    let timer = 0, t0 = 0;
    const stop = () => { clearTimeout(timer); timer = 0; b.classList.remove('held'); };
    const tick = () => {
      fire();
      const held = (performance.now() - t0 - HOLD_DELAY) / 1000;
      timer = setTimeout(tick, 1000 / Math.min(HOLD_RATE[1], HOLD_RATE[0] + 8 * Math.max(0, held)));
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
  on(root, 'contextmenu', e => { if (!e.target.closest('.upd-notes, textarea')) e.preventDefault(); }); // 롱프레스 메뉴 막기

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
      o.b.setAttribute('aria-label', o.max ? `${o.name} 레벨 ${lv}, 최대 (${cur})` : `${o.name} 레벨 ${lv}, ${cur}에서 ${nxt}로, 비용 ${fmt(o.costN)} 골드`);
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

  // ── 비상 스킬 · 토글 · 배속 ──
  const skills = ['meteor', 'freeze'].map(k => {
    const b = $('sk-' + k);
    on(b, 'click', () => H.onSkill?.(k));
    return { k, b, cd: b.querySelector('.sk-cd'), ready: null, cool: null, label: '' };
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
    s.b.classList.toggle('off', phase !== 'play');
    const label = `${SKILLS[s.k].name}, ${cool ? `남은 시간 ${sec}초` : ready ? '준비됨' : '전투 중에만 사용'}`;
    if (s.label !== label) { s.label = label; s.b.setAttribute('aria-label', label); }
  }
  on(E['btn-auto'], 'click', () => H.onToggleAuto?.(!view?.players[0].auto));
  on(E['btn-autonext'], 'click', () => H.onToggleAutoNext?.(!meta.autoNext));
  on(E['btn-speed'], 'click', () => {
    if (!meta.unlocked3x && view && view.speed >= 2) toast(`3배속은 ${SPEED3_UNLOCK}층을 클리어하면 열려요`, 'speed');
    H.onSpeed?.();
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
      txt(E['heroult-name'], ULT_SHORT[h.cls] || (HERO_CLASSES[h.cls]?.ult.name || '궁극기').slice(0, 4));
    }
    const cls = HERO_CLASSES[h.cls] || HERO_CLASSES.knight;
    const down = h.state === 'down';
    // hero.js respawnHero(): clamp(6 + level*0.12, 6, 18) — 다운 중엔 쿨타임 링을 부활 카운트다운으로 재사용
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

  // ── 영웅 버튼 (초상화 + 레벨 + 전투력 + 남은 특성 포인트, 장비 드롭이 날아와 꽂히는 곳) ──
  let heroBtnKey = '', heroPow = -1, talLeft = 0;
  on(E['btn-hero'], 'click', () => { E['hb-new'].hidden = true; H.onOpenHero?.({ tab: talLeft > 0 ? 'talent' : 'char' }); });
  function updateHeroBtn(hero) {
    const b = E['btn-hero'], show = !!(hero && hero.cls);
    if (b.hidden === show) b.hidden = !show;
    if (!show) { heroBtnKey = ''; return; }
    const tl = talentLeft(hero, hero.cls);
    if (tl !== talLeft) {
      if (tl > talLeft) E['hb-tal'].animate(BUMP, bumpOpts);
      talLeft = tl;
      E['hb-tal'].hidden = !(tl > 0);
      txt(E['hb-tal'].querySelector('b'), '+' + tl);
    }
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
    b.setAttribute('aria-label', `영웅 · 특성 · 장비: ${heroTitle(hero.cls, hero.level)} Lv.${hero.level}, 전투력 ${fmt(p)}`);
  }

  // ── 영웅 상태 줄 ──
  let heroKey = '';
  function updateHeroStatus(h, hero) {
    if (!h) { if (!E['hero-status'].hidden) E['hero-status'].hidden = true; return; }
    if (E['hero-status'].hidden) E['hero-status'].hidden = false;
    const lv = hero ? hero.level : h.level;
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
    E['hero-status'].classList.toggle('retreat', h.mode === 'retreat');
    if (down) {
      E['hero-down'].hidden = false;
      txt(E['hero-down'], `다운 ${Math.max(1, Math.ceil(h.respawnT))}초`);
    } else if (h.mode === 'retreat') {
      E['hero-down'].hidden = false;
      txt(E['hero-down'], '후퇴 중');
    } else if (!E['hero-down'].hidden) E['hero-down'].hidden = true;
  }

  // ── 마나 게이지(층마다 한 번 → 카드) · 스킬 슬롯 6칸 ──
  let manaWasFull = false, manaSpent = -1;
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
    E.mana.classList.toggle('spent', full && manaSpent === v.stage && !v.pick); // 이 층 카드는 이미 받음
  }
  E['spell-row'].innerHTML = Array.from({ length: SPELL_SLOTS }, () => '<button type="button" class="spell-chip empty" disabled><span class="sc-art"></span><span class="sc-pips"></span></button>').join('');
  const slotEls = [...E['spell-row'].children];
  let spellRowKey = '';
  for (const chip of slotEls) on(chip, 'click', () => {
    const k = chip.dataset.spell, s = SPELL_BY_KEY[k], lv = view?.spells?.[k] || 1;
    if (!s) return;
    showTip(chip, 'el-' + s.element, `<b>${esc(s.name)} Lv.${lv}</b><br>${esc(s.desc[lv - 1])}${lv < SPELL_MAX_LV ? `<br><small>다음 Lv.${lv + 1}: ${esc(s.desc[lv])}</small>` : '<br><small>최대 레벨</small>'}`, 3600);
  });
  function updateSpellRow(v) {
    const s = v.spells || {}, keys = Object.keys(s);
    const key = keys.map(k => k + s[k]).join(',');
    if (key === spellRowKey) return;
    const prevLv = Object.fromEntries(slotEls.map(c => [c.dataset.spell, c._lv]));
    spellRowKey = key;
    E['spell-row'].hidden = false;
    slotEls.forEach((chip, i) => {
      const k = keys[i], sp = SPELL_BY_KEY[k];
      if (!sp) {
        chip.className = 'spell-chip empty'; chip.disabled = true; delete chip.dataset.spell; chip._lv = 0;
        chip.firstChild.innerHTML = ''; chip.lastChild.innerHTML = '';
        chip.setAttribute('aria-label', `빈 스킬 슬롯 ${i + 1}`);
        return;
      }
      chip.className = `spell-chip el-${sp.element}${s[k] >= SPELL_MAX_LV ? ' max' : ''}`;
      chip.disabled = false; chip.dataset.spell = k; chip._lv = s[k];
      chip.firstChild.innerHTML = spellIcon(k, sp.element);
      chip.lastChild.innerHTML = pips(s[k]);
      chip.setAttribute('aria-label', `${sp.name} Lv${s[k]}`);
      if (prevLv[k] !== s[k]) { chip.animate(BUMP, bumpOpts); }
    });
  }

  // ── 상태 칩: 부활 결계 · 각성 · 광폭화 경고 ──
  let reviveKey = '', awakenKey = '', berserkKey = '';
  const reviveInfo = v => {
    const meta1 = !!v.fx?.revive, hero1 = !!v.heroUnit?.tb?.cap?.reviveWard;
    const ready = (meta1 && !v.run?.reviveUsed) || (hero1 && !v.run?.heroRevive);
    return { own: meta1 || hero1, ready, n: (meta1 && !v.run?.reviveUsed ? 1 : 0) + (hero1 && !v.run?.heroRevive ? 1 : 0) };
  };
  on(E['st-revive'], 'click', () => {
    const r = view ? reviveInfo(view) : { ready: false };
    showTip(E['st-revive'], '', r.ready ? `<b>부활 결계 준비됨</b><br>성벽이 무너지는 순간 한 번 되살아나요${r.n > 1 ? ` (${r.n}회)` : ''}.` : '<b>부활 결계 사용함</b><br>이번 도전에서는 더 없어요.');
  });
  on(E['st-awaken'], 'click', () => {
    const a = view?.run?.awaken || {};
    const rows = AWAKENINGS.filter(w => a[w.key] > 0).map(w => `${esc(w.name.replace('각성: ', ''))} <b>+${Math.round(w[AWAKEN_STAT[w.key]] * a[w.key] * 100)}%</b> <span class="tip-dim">x${a[w.key]}</span>`);
    showTip(E['st-awaken'], '', `<b>각성 누적</b><br>${rows.join('<br>')}`, 3600);
  });
  function updateStatus(v) {
    const r = reviveInfo(v), rk = r.own + '|' + r.ready;
    if (rk !== reviveKey) {
      reviveKey = rk;
      E['st-revive'].hidden = !r.own;
      E['st-revive'].classList.toggle('used', !r.ready);
      E['st-revive'].setAttribute('aria-label', r.ready ? '부활 결계 준비됨' : '부활 결계 사용함');
    }
    const a = v.run?.awaken || {};
    let n = 0;
    for (const k in a) n += a[k] | 0;
    const ak = String(n);
    if (ak !== awakenKey) {
      if (n > (+awakenKey || 0)) E['st-awaken'].animate(BUMP, bumpOpts);
      awakenKey = ak;
      E['st-awaken'].hidden = !n;
      txt(E['st-awaken-n'], String(n));
    }
    const bz = v.berserk > 1 ? 'on|' + (v.berserk >= 10 ? Math.round(v.berserk) : v.berserk.toFixed(1))
      : v.phase === 'play' && !v.pick && v.phaseT >= BERSERK_T - 10 ? 'warn|' + Math.ceil(BERSERK_T - v.phaseT) : '';
    if (bz !== berserkKey) {
      const [mode, val] = bz.split('|');
      if (mode === 'on' && !berserkKey.startsWith('on')) E.berserk.animate([{ transform: 'scale(1.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.3,1.9,.5,1)' });
      berserkKey = bz;
      E.berserk.hidden = !mode;
      E.berserk.classList.toggle('warn', mode === 'warn');
      if (mode) txt(E['berserk-text'], mode === 'on' ? `광폭화! 적 피해 x${val}` : `광폭화까지 ${val}초`);
    }
  }

  // ── 판타지 스킬 카드 선택 오버레이 (스킬 카드 + 각성 카드, 3~5장) ──
  E['pick-cards'].innerHTML = Array.from({ length: MAX_PICK_CARDS }, () =>
    `<button class="pick-card" type="button"><span class="pc-tag" hidden></span><span class="pc-spark" hidden>${SPARK_ICON}</span>`
    + '<span class="pc-icowrap"></span><span class="pc-body"><span class="pc-name"></span>'
    + `<span class="pc-pips">${pips(0)}</span><span class="pc-desc"></span><span class="pc-rar"></span></span></button>`).join('');
  const pickCardEls = [...E['pick-cards'].children].map((b, i) => {
    on(b, 'click', () => { if (pickOpen && !pickClosing) H.onPick?.(i); });
    const spark = b.querySelector('.pc-spark');
    on(spark, 'click', e => { e.stopPropagation(); if (!spark.hidden) showTip(spark, '', '<b>✦</b> 무언가 일어날 것 같다…'); }); // 조건은 숨긴 채 문구만 살짝
    return { b, tag: b.querySelector('.pc-tag'), spark, ico: b.querySelector('.pc-icowrap'), name: b.querySelector('.pc-name'),
      pips: [...b.querySelectorAll('.pc-pips i')], pipRow: b.querySelector('.pc-pips'), desc: b.querySelector('.pc-desc'), rar: b.querySelector('.pc-rar'), key: null };
  });
  let pickOpen = false, pickClosing = false, pickResolveTimer = 0, pickRef = null, pickWaitRef = null, pickWaitT = 0;
  on(E['pick-reroll'], 'click', () => { if (pickOpen && !pickClosing) H.onReroll?.(); });
  function syncReroll(n) {
    const show = pickOpen && !pickClosing && n > 0;
    if (E['pick-reroll'].hidden === show) E['pick-reroll'].hidden = !show;
    if (show) txt(E['pick-reroll-n'], String(n));
  }
  function openPick(pick) {
    clearTimeout(pickResolveTimer);
    pickOpen = true; pickClosing = false;
    hideSpellTip();
    const n = pick.cards.length;
    E['pick-cards'].classList.toggle('four', n === 4); // 4장 = 2×2, 5장 = 3 + 2
    E['pick-cards'].classList.toggle('five', n >= 5);
    pickCardEls.forEach((c, i) => {
      c.b.classList.remove('in', 'chosen', 'faded');
      if (i >= n) { c.b.hidden = true; c.key = null; return; }
      c.b.hidden = false;
      const card = pick.cards[i];
      if (card.awaken) { // 각성 카드: 슬롯이 다 찼을 때 나오는 소폭 스탯(런 누적)
        const a = AWAKEN_BY_KEY[card.awaken];
        c.key = 'aw:' + card.awaken;
        c.b.className = 'pick-card awaken el-holy rar-common';
        html(c.ico, `<span class="pc-aw">${icon(AWAKEN_ICON[card.awaken] || 'new')}</span>`);
        txt(c.name, a.name.replace('각성: ', '각성 · '));
        c.pipRow.hidden = true;
        txt(c.desc, `${a.desc}\n이번 도전 동안 계속 쌓여요`);
        c.desc.classList.remove('long');
        txt(c.rar, '각성');
        c.tag.hidden = false; c.tag.className = 'pc-tag up'; txt(c.tag, `x${card.level - 1} → ${card.level}`);
        c.spark.hidden = true;
        c.b.setAttribute('aria-label', `${a.name}, ${a.desc}, 누적 ${card.level}`);
        return;
      }
      const sp = SPELL_BY_KEY[card.spell];
      c.key = card.spell;
      c.b.className = `pick-card el-${sp.element} rar-${card.rarity}`;
      html(c.ico, spellIcon(card.spell, sp.element));
      txt(c.name, sp.name);
      c.pipRow.hidden = false;
      c.pips.forEach((p, pi) => { p.classList.toggle('on', pi < card.level); p.classList.toggle('nx', pi === card.level - 1); });
      const dsc = sp.desc[card.level - 1] || '';
      txt(c.desc, dsc);
      c.desc.classList.toggle('long', dsc.length > 30); // 고정 칸에 맞춰 한 단계 작게
      txt(c.rar, { common: '일반', rare: '희귀', legend: '전설' }[card.rarity] || '일반');
      c.tag.hidden = false;
      if (card.level > 1) { c.tag.className = 'pc-tag up'; txt(c.tag, `Lv${card.level - 1} → ${card.level}`); }
      else { c.tag.className = 'pc-tag'; txt(c.tag, 'NEW'); }
      c.spark.hidden = !card.fusionHint;
      c.b.setAttribute('aria-label', `${sp.name}, ${card.level > 1 ? 'Lv' + card.level + ' 강화' : '새 스킬'}. ${dsc}${card.fusionHint ? '. 무언가 일어날 것 같다…' : ''}`);
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
  function resolvePick(ev) {
    if (!pickOpen || pickClosing) return;
    pickClosing = true;
    const key = ev.spell || 'aw:' + ev.awaken;
    let chosen = null;
    for (const c of pickCardEls) {
      if (c.b.hidden) continue;
      if (c.key === key && !chosen) { chosen = c; c.b.classList.add('chosen'); } else c.b.classList.add('faded');
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

  // ── 정비 화면 ──
  const camp = createCamp(root, {
    onCampAct: a => !!H.onCampAct?.(a),
    onBuyMeta: k => !!H.onBuyMeta?.(k),
    onStartRun: lo => H.onStartRun?.(lo),
    onOpenHero: o => H.onOpenHero?.(o),
    onOpenCodex: () => openCodex(),
    onOpenSettings: () => openSettings(),
    codexNew: () => fresh.size > 0,
    toast: (m, i) => toast(m, i),
  });
  function showCamp(m) {
    hideTitle();
    hideClear(); E.defeat.hidden = true;
    if (pickOpen) hidePick();
    camp.show(m);
    syncInert();
  }
  function hideCamp() { camp.hide(); syncInert(); }

  // ── 타이틀 ──
  let titleRun = null, titleHero = null, contTimer = 0;
  on(E['btn-start'], 'click', () => (titleRun ? showContinue(titleRun, titleHero) : H.onStart?.()));
  let titleArt = false;
  function paintTitle() { // 전장 스프라이트를 구워 그대로 쓴다(영웅·마법사 2명) — 한 번만
    if (titleArt) return;
    titleArt = true;
    const q = sel => E.title.querySelector(sel);
    q('.t-hero').src = heroPortraitURL('knight', 3, { weapon: 'epic', armor: 'rare', helm: 'rare', cape: 'legend' }, 420);
    q('.t-mage.l').src = magePortraitURL(0, 3, 420);
    q('.t-mage.r').src = magePortraitURL(1, 3, 420);
    [['slime', '.f1'], ['goblin', '.f2'], ['skeleton', '.f3'], ['imp', '.f4']].forEach(([t, c]) => { q('.t-foes ' + c).src = enemyURL(t, 18, 120); });
  }
  function showTitle({ best = 0, run = null, hero = null } = {}) {
    try { paintTitle(); } catch (e) { console.warn(e); }
    titleRun = run; titleHero = hero;
    txt(E['btn-start'].querySelector('.b-main'), run ? '이어하기' : '시작하기');
    txt(E['start-sub'], run ? `${run.stage}층 · ${HERO_CLASSES[run.loadout?.cls]?.name || '도전 중'}` : best > 0 ? `최고 기록 ${best}층` : '100층 탑에 도전!');
    hideClear(); E.defeat.hidden = true;
    camp.hide();
    E.title.hidden = false;
    syncInert();
    clearTimeout(contTimer);
    if (run) contTimer = setTimeout(() => { if (!E.title.hidden && !stack.length) showContinue(run, hero); }, 700);
  }
  function hideTitle() {
    clearTimeout(contTimer);
    E.title.hidden = true;
    syncInert();
  }

  // ── 이어하기 ──
  const gemSum = g => (g ? (g.floor | 0) + (g.first | 0) + (g.boss | 0) + (g.flawless | 0) : 0);
  function showContinue(run, hero) {
    const cls = run.loadout?.cls || hero?.cls || 'knight';
    E['cont-por'].src = heroPortraitURL(cls, hero ? heroTier(hero.level) : 0, hero?.equip, 360);
    E['cont-por'].parentElement.style.setProperty('--cc', CLS_INFO[cls]?.col || '#7b6cff');
    const st = `${run.stage}층`;
    E['cont-stage'].textContent = st; E['cont-stage'].dataset.text = st;
    txt(E['cont-who'], `${HERO_CLASSES[cls]?.name || ''}${hero ? ` Lv.${hero.level}` : ''} · ${run.floors | 0}층까지 돌파`);
    const sp = Object.entries(run.spells || {});
    E['cont-spells'].innerHTML = sp.length ? sp.map(([k, lv]) => SPELL_BY_KEY[k] ? `<span class="cont-sp el-${SPELL_BY_KEY[k].element}" title="${esc(SPELL_BY_KEY[k].name)}">${spellIcon(k, SPELL_BY_KEY[k].element)}<b class="num">${lv}</b></span>` : '').join('')
      : '<span class="cont-none">아직 고른 스킬이 없어요</span>';
    const g = gemSum(run.gems);
    E['cont-gems'].innerHTML = `${icon('gem')}적립 보석 <b class="k-num gem-n">${fmt(g)}</b>`;
    E['cont-main'].hidden = false; E['cont-confirm'].hidden = true;
    txt(E['cont-warn'], `포기하면 ${run.floors | 0}층까지의 기록과 적립 보석 ${fmt(g)}개로 정산하고 도전이 끝나요.`);
    E['btn-cont-go'].dataset.autofocus = '';
    openModal('m-continue');
  }
  on(E['btn-cont-go'], 'click', () => { closeModal('m-continue'); titleRun = null; H.onContinueRun?.(); });
  on(E['btn-cont-quit'], 'click', () => { E['cont-main'].hidden = true; E['cont-confirm'].hidden = false; E['btn-cont-no'].focus({ preventScroll: true }); });
  on(E['btn-cont-no'], 'click', () => { E['cont-main'].hidden = false; E['cont-confirm'].hidden = true; });
  on(E['btn-cont-yes'], 'click', () => { closeModal('m-continue'); titleRun = null; H.onAbandonRun?.(); });

  // 도전 중 포기(일시정지 메뉴)
  function openAbandon() {
    const r = view?.run;
    txt(E['ab-txt'], r ? `지금 포기하면 ${r.floors | 0}층까지의 기록과 적립 보석 ${fmt(gemSum(r.gems))}개로 정산하고 정비 화면으로 돌아가요.` : '도전을 끝내고 정비 화면으로 돌아갈까요?');
    openModal('m-abandon');
  }
  on(E['btn-ab-yes'], 'click', () => { closeModal('m-abandon'); H.onAbandonRun?.(); });

  // ── 클리어 · 패배 도장 (보스 경고 배너는 render.js 캔버스 몫) ──
  let clearTimer = 0, clearWait = false, clearDelay = 0, clearDueAt = 0, bossKillAt = -1e9, defeatAt = -1e9, clearAt = -1e9;
  let runStage = -1, runGold = 0;
  const runDrops = [];
  function showClear(v) {
    const r = v.result;
    if (!r) return;
    clearTimeout(clearTimer);
    clearAt = performance.now();
    E.defeat.hidden = true;
    txt(E['clear-stage'], `${v.stage}층 돌파!`);
    stars.forEach((s, i) => { s.className = i < r.stars ? 'star on' : 'star'; });
    txt(E['clear-gems'], fmt(r.gems?.[0] ?? 0));
    txt(E['clear-gold'], '+' + fmt(runGold));
    const cls = v.hero?.cls;
    E['clear-xp'].parentElement.hidden = !cls;
    if (cls) txt(E['clear-xp'], '+' + fmt(heroClearXp(v.stage, !!r.firstClear)));
    const RK = ['common', 'uncommon', 'rare', 'epic', 'legend'];
    const drops = runDrops.slice().sort((a, b) => RK.indexOf(b.rarity) - RK.indexOf(a.rarity)).slice(0, 6);
    E['clear-drops'].innerHTML = drops.map((it, i) => `<span class="k-slot cr-drop" data-r="${it.rarity}" style="--i:${i}"><img src="${itemIconURL(it.slot, it.rarity, cls || 'knight', 96)}" alt="${esc(it.name)}" draggable="false"></span>`).join('')
      + (runDrops.length > 6 ? `<span class="cr-more num">+${runDrops.length - 6}</span>` : '');
    E['clear-drops'].hidden = !drops.length;
    E['badge-flawless'].hidden = !r.flawless;
    E['badge-first'].hidden = !r.firstClear;
    clearWait = !meta.autoNext && !v.run?.over; // 100층 돌파(도전 끝)면 다음 층 버튼 없음 — 곧 결과 화면
    E['btn-next'].hidden = !clearWait;
    E.clear.hidden = true;
    void E.clear.offsetWidth; // 별 애니메이션 재시작
    E.clear.hidden = false;
    if (clearWait) E['btn-next'].focus({ preventScroll: true });
    else clearTimer = setTimeout(hideClear, CLEAR_SHOW_MS);
  }
  function hideClear() {
    clearTimeout(clearTimer);
    E.clear.hidden = true;
    clearWait = false;
  }
  on(E['btn-next'], 'click', () => { hideClear(); H.onNext?.(); });

  function showDefeat(stage) {
    hideClear();
    if (!E['defeat-icon'].firstChild) E['defeat-icon'].innerHTML = emblemImg('wallBroken') || icon('wall-broken');
    txt(E['defeat-stage'], `${stage}층에서 성벽이 무너졌어요`);
    defeatAt = performance.now();
    E.defeat.hidden = true;
    void E.defeat.offsetWidth;
    E.defeat.hidden = false;
  }

  // ── 결과 화면 ──
  let resultTimer = 0;
  function showResult(sum, game = null) {
    if (!sum) return;
    clearTimeout(resultTimer);
    const now = performance.now();
    // 패배 도장(≥1.6초)·100층 클리어 연출(≥2.6초)을 먼저 보여 준 뒤
    const wait = !E.defeat.hidden ? DEFEAT_HOLD_MS - (now - defeatAt) : !E.clear.hidden ? 2600 - (now - clearAt) : clearDueAt > now ? clearDueAt - now + 2600 : 0; // 100층: 클리어 연출이 곧 뜬다
    if (wait > 30) { resultTimer = setTimeout(() => showResult(sum, game), wait); return; }
    E.defeat.hidden = true;
    hideClear();
    if (pickOpen) hidePick();
    renderResult(sum, game);
    openModal('m-result');
  }
  function renderResult(sum, game) {
    const win = !!sum.victory, nb = !!sum.newBest;
    const hero = game?.hero, cls = sum.loadout?.cls || hero?.cls || 'knight';
    const m = E['m-result'];
    m.classList.toggle('win', win); m.classList.toggle('best', nb);
    m.style.setProperty('--cc', CLS_INFO[cls]?.col || '#7b6cff');
    E['res-art'].innerHTML = `<i class="res-glow"></i><img class="res-por" src="${heroPortraitURL(cls, hero ? heroTier(hero.level) : 0, hero?.equip, 420)}" alt="">`
      + (win ? `<span class="res-cup">${icon('trophy')}</span>` : '');
    E['res-rb'].className = 'k-ribbon res-rb ' + (win || nb ? 'gold' : 'gray');
    txt(E['res-h'], win ? '100층 돌파!' : nb ? '신기록 달성!' : '도전 종료');
    E['res-floor'].dataset.text = '0';
    countUp(E['res-floor'], sum.floorsCleared | 0, 900, v => { E['res-floor'].dataset.text = v; });
    txt(E['res-floor-l'], '층 돌파');
    E['res-best'].hidden = !nb;
    if (nb) txt(E['res-best-txt'], `최고 기록 ${sum.prevBest}층 → ${sum.best}층`);
    txt(E['res-sub'], win ? '종말의 드래곤이 쓰러졌어요! 성벽은 끝까지 버텼습니다.'
      : sum.stageReached > (sum.floorsCleared | 0) ? `${sum.stageReached}층에서 성벽이 무너졌어요. 강해져서 다시 도전!` : '도전을 마쳤어요.');
    txt(E['res-boss'], String(sum.bossesKilled | 0));
    txt(E['res-time'], fmtTime(sum.time));
    // 피해 비중: game.dmgDone = [나, AI 동료, 영웅(소환물 포함)]
    const d = game?.dmgDone || [0, 0, 0], tot = d[0] + d[1] + d[2];
    E['res-share'].hidden = !(tot > 0);
    txt(E['res-hero'], tot > 0 && d[2] > 0 ? Math.round(d[2] / tot * 100) + '%' : '-');
    if (tot > 0) {
      const parts = [['me', '나', d[0]], ['ai', 'AI 동료', d[1]], ['hero', `영웅(${HERO_CLASSES[cls]?.name || ''})`, d[2]]];
      E['res-bar'].innerHTML = parts.map(([k, , v]) => `<i class="${k}" style="--w:${(v / tot * 100).toFixed(2)}%"></i>`).join('');
      E['res-legend'].innerHTML = parts.map(([k, n, v]) => `<span class="${k}"><i></i>${esc(n)} <b class="k-num">${Math.round(v / tot * 100)}%</b></span>`).join('');
    }
    // 보석 내역(카운트업 스태거)
    const rw = sum.rewards || {};
    const rows = GEM_ROWS.filter(([k]) => rw[k] > 0);
    E['res-gem-list'].innerHTML = (rows.length ? rows : [['floor', '층 클리어', 'wall']]).map(([k, n, ic], i) =>
      `<li style="--i:${i}" class="${k === 'best' ? 'hot' : ''}">${icon(ic)}<span>${n}</span><b class="k-num gem-n" data-v="${rw[k] | 0}">+0</b></li>`).join('');
    [...E['res-gem-list'].querySelectorAll('b')].forEach((b, i) => setTimeout(() => countUp(b, +b.dataset.v, 600, null, '+'), 500 + i * 160));
    E['res-gem-total'].textContent = '+0';
    setTimeout(() => { countUp(E['res-gem-total'], rw.gems | 0, 900, null, '+'); E['res-gem-total'].parentElement.animate(BUMP, { ...bumpOpts, delay: 900 }); }, 500 + rows.length * 160);
    // 이번 도전의 스킬
    const sp = Object.entries(sum.spells || {});
    E['res-spells-card'].hidden = !sp.length;
    E['res-spells'].innerHTML = sp.map(([k, lv]) => { const s = SPELL_BY_KEY[k]; return s ? `<span class="res-sp el-${s.element}"><span class="res-sp-art">${spellIcon(k, s.element)}</span><span class="res-sp-name">${esc(s.name)}</span><span class="sc-pips">${pips(lv)}</span></span>` : ''; }).join('');
    // 새로 해금된 영웅
    const nc = sum.newClasses || [];
    E['res-unlock'].hidden = !nc.length;
    E['res-unlock'].innerHTML = nc.map(c => `<div class="res-new" style="--cc:${CLS_INFO[c]?.col}"><img src="${heroPortraitURL(c, 0, null, 240)}" alt=""><div><span class="k-badge new">NEW</span><b>새 영웅 해금!</b><em>${esc(HERO_CLASSES[c]?.name)}</em><p>${esc(HERO_CLASSES[c]?.role)}</p></div></div>`).join('');
    confetti(m.querySelector('.confetti'), win || nb);
    m.querySelector('.res-scroll').scrollTop = 0;
    E['btn-res-done'].dataset.autofocus = '';
  }
  on(E['btn-res-done'], 'click', () => { closeModal('m-result'); H.onResultDone?.(); });
  function confetti(c, show) {
    c.hidden = !show;
    if (!show || c.childElementCount) return;
    const colors = ['#ffd23f', '#ff5a7a', '#5fd8ff', '#7ee36b', '#c77dff', '#ff9f1a'];
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('i');
      p.style.cssText = `left:${Math.random() * 100}%;background:${colors[i % colors.length]};animation-duration:${2.4 + Math.random() * 2.6}s;animation-delay:${-Math.random() * 5}s`;
      c.append(p);
    }
  }

  // ── 도감 (히든 조합 14 + 원소 융합 8) ──
  E['codex-list'].innerHTML = HIDDEN_SYN.map(s => `<li class="syn-card" data-key="${s.key}"><div class="syn-ico" aria-hidden="true"></div>`
    + '<div class="syn-body"><div class="syn-name"></div><div class="syn-text"></div></div>'
    + `<span class="syn-tag ${s.kind}">${KIND_TAG[s.kind]}</span><span class="syn-new" hidden>NEW</span></li>`).join('');
  E['codex-list-fusion'].innerHTML = FUSION_LIST.map(s => `<li class="syn-card fusion" data-key="${s.key}"><div class="syn-ico fusion-ico" aria-hidden="true"></div>`
    + '<div class="syn-body"><div class="syn-name"></div><div class="syn-text"></div></div>'
    + '<span class="syn-tag fusion"></span><span class="syn-new" hidden>NEW</span></li>').join('');
  const mkCards = (list, host) => [...host.children].map((li, i) => ({
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
        html(c.ico, synIcon(c.s.key));
        c.ico.style.background = `linear-gradient(135deg, var(--elc-${a}) 50%, var(--elc-${b}) 50%)`;
        txt(c.tag, `${ELEMENT_NAME[a]}+${ELEMENT_NAME[b]}`);
      } else {
        c.ico.style.background = '';
        html(c.ico, '');
        txt(c.tag, '');
      }
    } else {
      html(c.ico, synIcon(c.s.key)); // 잠김 = 같은 그림의 어두운 실루엣(CSS)
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
    camp.refresh();
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

  // ── 저장 백업 · 복원 (APK·PWA 공통: 코드 문자열 하나로 기기 사이 이동) ──
  async function copyText(s) {
    try { await navigator.clipboard.writeText(s); return true; } catch { /* 권한 없음 → 아래 */ }
    try { E['bk-code'].focus(); E['bk-code'].select(); return document.execCommand('copy'); } catch { return false; }
  }
  const backupLead = ok => txt(E['bk-lead'], ok ? '백업 코드를 복사했어요! 안전한 곳에 붙여 넣어 두세요.' : '아래 코드를 길게 눌러 전체 선택한 뒤 복사해 주세요.');
  on(E['btn-backup'], 'click', async () => {
    let code = '';
    try { code = String(H.onBackupSave?.() || ''); } catch (e) { console.warn(e); }
    if (!code) { toast('백업 코드를 만들지 못했어요'); return; }
    E['bk-code'].value = code;
    txt(E['bk-lead'], '백업 코드를 만드는 중…');
    openModal('m-backup');
    backupLead(await copyText(code));
  });
  on(E['bk-code'], 'focus', () => E['bk-code'].select());
  on(E['btn-bk-copy'], 'click', async () => {
    const ok = await copyText(E['bk-code'].value);
    backupLead(ok);
    if (ok) toast('복사했어요', 'check');
  });
  on(E['btn-restore'], 'click', () => {
    E['rs-code'].value = '';
    E['rs-err'].hidden = true;
    E['rs-step1'].hidden = false; E['rs-step2'].hidden = true;
    openModal('m-restore');
    E['rs-code'].focus({ preventScroll: true });
  });
  let rsCode = '';
  on(E['btn-rs-check'], 'click', () => {
    rsCode = E['rs-code'].value.trim();
    let p = null;
    try { p = rsCode ? H.onRestoreSave?.(rsCode, true) : null; } catch { p = null; }
    if (!p || typeof p !== 'object' || p.error) {
      txt(E['rs-err'], p?.error || '코드가 올바르지 않아요. 빠진 글자 없이 전체를 붙여 넣었는지 확인해 주세요.');
      E['rs-err'].hidden = false;
      E['btn-rs-check'].classList.remove('shake'); void E['btn-rs-check'].offsetWidth; E['btn-rs-check'].classList.add('shake');
      return;
    }
    const h = p.hero || {}, cls = HERO_CLASSES[h.cls];
    E['rs-sum'].innerHTML = `
      ${cls ? `<img class="rs-por" src="${heroPortraitURL(h.cls, heroTier(h.level | 0 || 1), h.equip, 200)}" alt="">` : ''}
      <div class="rs-grid">
        <span>${icon('trophy')}최고 기록</span><b class="k-num gold">${p.best | 0}층</b>
        <span>${icon('hero')}영웅</span><b class="k-num">${cls ? esc(cls.name) + ' ' : ''}Lv.${h.level | 0 || 1}</b>
        <span>${icon('gem')}보석</span><b class="k-num gem-n">${fmt(p.gems || 0)}</b>
        <span>${icon('codex')}도감 · 도전</span><b class="k-num">${(p.discovered || []).length}/${SYNERGIES.length} · ${p.runs | 0}회</b>
      </div>`;
    E['rs-step1'].hidden = true; E['rs-step2'].hidden = false;
  });
  on(E['btn-rs-back'], 'click', () => { E['rs-step1'].hidden = false; E['rs-step2'].hidden = true; });
  on(E['btn-rs-yes'], 'click', () => {
    let ok = false;
    try { ok = !!H.onRestoreSave?.(rsCode); } catch { ok = false; }
    if (!ok) { toast('복원하지 못했어요. 코드를 다시 확인해 주세요'); return; }
    closeModal('m-restore'); closeModal('m-settings');
    fresh.clear(); seen.clear(); syncNewDots();
    toast('기록을 복원했어요!', 'check');
  });

  // ── 오프라인 보상 (보석 + 영웅 경험치) ──
  function showOfflineReward({ gems = 0, xp = 0, minutes = 0 } = {}, onClaim) {
    const h = Math.floor(minutes / 60), m = minutes % 60;
    const capped = minutes >= OFFLINE_CAP_HOURS * 60 ? ' (최대)' : '';
    txt(E['off-time'], `${h ? h + '시간 ' : ''}${m ? m + '분' : ''}${capped} 동안 황금 곡괭이가 보석을 캐고, 영웅은 수련했어요!`);
    if (!E['off-art'].firstChild) E['off-art'].innerHTML = emblemImg('treasure');
    E['off-gems'].textContent = '0';
    countUp(E['off-gems'], gems, 900);
    txt(E['off-xp'], '+' + fmt(xp));
    openModal('m-offline', () => onClaim?.());
  }
  E['btn-claim'].dataset.autofocus = '';
  on(E['btn-claim'], 'click', () => closeModal('m-offline'));
  // 숫자 카운트업(보상 화면, ease-out)
  function countUp(el, to, ms, onTick = null, prefix = '') {
    const t0 = performance.now();
    const tick = now => {
      const u = Math.min(1, (now - t0) / ms), e = 1 - (1 - u) ** 3;
      const s = prefix + fmt(Math.round(to * e));
      el.textContent = s;
      onTick?.(s);
      if (u < 1 && el.isConnected) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(() => { el.textContent = prefix + fmt(to); onTick?.(prefix + fmt(to)); }, ms + 120); // 가려진 창(rAF 멈춤)에서도 최종값
  }

  // ── 업데이트 ──
  E['btn-upd-now'].dataset.autofocus = '';
  E['btn-open-settings'].dataset.autofocus = '';
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
  function showInstallPermissionHelp() { openModal('m-install'); }
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
  let p2Key = '';
  function update(v, m = {}) {
    meta = m || {};
    if (meta.version) setVersion(meta.version);
    if (isOpen('m-settings')) renderSettings();
    if (isOpen('m-codex') && discovered().size !== codexCount) renderCodex();
    if (camp.isOpen()) camp.refresh();
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
    updateStatus(v);
    stage.classList.toggle('boss-on', !!v.boss);
    if (v.pick) {
      if (pickRef !== v.pick) {
        // 보스 WARNING·컷인이 끝난 뒤 카드가 뜨게 잠깐 기다린다(최대 4초)
        const now = performance.now();
        if (pickWaitRef !== v.pick) { pickWaitRef = v.pick; pickWaitT = now; }
        if (momentLeft() <= 0.15 || now - pickWaitT > 4000) { pickRef = v.pick; openPick(v.pick); }
      } else syncPickRing(v.pick);
    } else { pickRef = null; pickWaitRef = null; if (pickOpen && !pickClosing) hidePick(); } // 이벤트 없이 사라진 경우(클리어·패배) 즉시 닫음
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

    // AI 동료 칩: 아이콘 · 'AI 동료' · 강화 합계 · 네임드 보스 처치로 익힌 주문(최대 3)
    let lvSum = 0;
    for (const key in pa.lv) lvSum += pa.lv[key];
    const al = v.allySpells || {};
    const pk = lvSum + '|' + Object.entries(al).join();
    if (pk !== p2Key) {
      p2Key = pk;
      html(E['p2-icon'], AI_ICON);
      txt(E['p2-name'], pa.kind === 'bot' ? 'AI 동료' : pa.name);
      txt(E['p2-lv'], String(lvSum));
      E['p2-spells'].innerHTML = Object.entries(al).map(([key, lv]) => SPELL_BY_KEY[key] ? `<span class="p2-sp el-${SPELL_BY_KEY[key].element}" title="${esc(SPELL_BY_KEY[key].name)} Lv${lv}">${spellIcon(key, SPELL_BY_KEY[key].element)}<b class="num">${lv}</b></span>` : '').join('');
    }

    if (v.phase === 'play' && clearWait) hideClear(); // 다른 경로로 다음 층이 시작되면 대기 창 정리
  }
  function bump(el) {
    const t = performance.now();
    if (t - (el._bt || 0) < 120) return;
    el._bt = t;
    el.animate(BUMP, bumpOpts);
  }

  let taughtTalent = false;
  function onEvents(events, v) {
    for (const ev of events) {
      switch (ev.type) {
        case 'clear': { // 보스를 쓰러뜨린 판은 격파 연출이 먼저 보이고 1.2초 뒤 클리어
          clearTimeout(clearDelay);
          const boss = performance.now() - bossKillAt < 1500;
          clearDueAt = performance.now() + (boss ? 1200 : 350);
          clearDelay = setTimeout(() => { if (v.phase === 'clear') showClear(v); }, boss ? 1200 : 350);
          break;
        }
        case 'kill':
          if (ev.isBoss) bossKillAt = performance.now();
          if (v.stage !== runStage) { runStage = v.stage; runGold = 0; runDrops.length = 0; }
          runGold += ev.gold || 0;
          break;
        case 'defeat': clearTimeout(clearDelay); showDefeat(ev.stage ?? v.stage); break;
        case 'upgrade': if (ev.o === 0) sparkle(ev.stat); break;
        case 'spellPick': manaSpent = v.stage; resolvePick(ev); break;
        case 'revive':
          toast(ev.hero ? '부활 결계 강화 발동! 성벽 40% 회복' : '부활 결계 발동! 성벽 50% 회복', 'wall');
          E['st-revive'].animate([{ transform: 'scale(1.5)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'none' }], { duration: 600, easing: 'ease-out' });
          break;
        case 'allySpell': {
          const s = SPELL_BY_KEY[ev.spell];
          if (s) toast(`AI 동료가 〈${s.name}〉 Lv${ev.level}을 익혔어요!`, 'partner');
          break;
        }
        case 'heroLevelUp': {
          const m = MILESTONE_BY_KEY[ev.milestone];
          if (m) toast(`영웅 Lv.${ev.level}! ${m.desc} 해금`, 'hero');
          else if (!taughtTalent && v.hero?.cls) { taughtTalent = true; toast('특성 포인트 획득 — 영웅 버튼에서 찍어요', 'crit'); }
          break;
        }
        case 'loot': {
          if (v.stage !== runStage) { runStage = v.stage; runGold = 0; runDrops.length = 0; }
          if (ev.item) runDrops.push(ev.item);
          E['hb-new'].hidden = false;
          const hold = { common: 0.7, uncommon: 1, rare: 1.2, epic: 1.35, legend: 1.6 }[ev.item?.rarity] ?? 1; // 빛기둥 → 가방 비행
          setTimeout(() => bump(E['btn-hero']), (hold + 0.55) * 1000);
          if (ev.item && ev.item.rarity === 'epic') toast(`${RARITY_BY_KEY.epic?.name ?? ''} 획득 · ${ev.item.name}`, 'chest'); // 전설은 캔버스 배너
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

  // 전투를 멈춰야 하는 동안 true(모달 · 클리어/패배 연출 · 카드 선택 · 정비 화면)
  function isBusy() {
    return stack.length > 0 || !E.defeat.hidden || !E.clear.hidden || pickOpen || camp.isOpen();
  }

  // 안드로이드 뒤로가기: 처리했으면 true. 카드 선택·결과·이어하기는 삼킨다(선택을 피할 수 없게)
  function handleBack() {
    if (pickOpen) return true;
    if (stack.length) {
      const top = stack[stack.length - 1].el.id;
      if (top === 'm-result') { E['btn-res-done'].click(); return true; }
      if (top === 'm-continue') return true;
      closeModal(top);
      return true;
    }
    if (camp.handleBack()) return true;
    return !E.defeat.hidden || clearWait;
  }
  on(document, 'keydown', e => {
    if (e.key === 'Escape' && stack.length) { e.preventDefault(); handleBack(); }
  });

  syncInert();
  return {
    showTitle, hideTitle, showContinue, showCamp, hideCamp, isCampOpen: () => camp.isOpen(), refreshCamp: () => camp.refresh(),
    showResult, update, onEvents, toast, showOfflineReward, isBusy, handleBack,
    showUpdateReady, showUpdateProgress, showInstallPermissionHelp, setVersion,
  };
}

// 릴리스 노트(마크다운) → 읽기 좋은 평문
function cleanNotes(s) {
  return String(s ?? '').replace(/\r/g, '').split('\n')
    .map(l => l.replace(/^\s*#+\s*/, '').replace(/^\s*[-*]\s+/, '• ').replace(/\*\*|__|`/g, ''))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000);
}

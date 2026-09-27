// DOM HUD · 하단 패널 · 메뉴/모달 · 정비 화면(camp.js) · 결과 화면 · 이어하기 · 저장 백업 (캔버스 안 연출은 render.js 몫)
// 로그라이트 구조(docs/DESIGN.md '로그라이트 구현 계약'): 타이틀 → (이어하기 | 정비) → 도전 → 결과 → 정비.
// 모든 상태 변경은 handlers(H.*)로 호출측(main.js)에 넘긴다 — 아래 createUI 주석이 계약이다.
import {
  SKILLS, THEMES, SYNERGIES, SPEED3_UNLOCK, OFFLINE_CAP_HOURS,
  SPELL_BY_KEY, SKILL_BY_KEY, FUSION_BY_KEY, COLLAB_BY_KEY, COLLAB_FX, PICK_AUTO_T, SPELL_SLOTS, SPELL_MAX_LV, AWAKENINGS, AWAKEN_BY_KEY,
} from './config.js';
import { collabSlots } from './sim.js';
import { spellCooldown } from './spells.js';
import { HERO_CLASSES, heroTitle, RARITIES, MILESTONES, heroPower, heroClearXp, heroTier } from './hero.js';
import { heroPortrait, bestRarityIdx, CLS_INFO } from './heroui.js';
import { TALENTS, talentLeft } from './talents.js';
import { createCamp } from './camp.js';
import { fmt } from './util.js';
import { icon } from './icons.js';
import { momentLeft } from './art/hud.js';
import { heroPortraitURL, magePortraitURL, enemyURL, itemIconURL } from './art/units.js';
import { emblemImg } from './art/emblems.js';

const SYN_BY_KEY = Object.fromEntries(SYNERGIES.map(s => [s.key, s]));
const KIND_TAG = { cannon: '마법', duo: '협동', event: '이벤트' };
const HIDDEN_SYN = SYNERGIES.filter(s => s.kind !== 'fusion' && s.kind !== 'collab'); // 도감: 히든 조합 14
const FUSION_LIST = SYNERGIES.filter(s => s.kind === 'fusion');  // 도감: 원소 융합 8
const COLLAB_LIST = SYNERGIES.filter(s => s.kind === 'collab');  // 도감: 협공 15 (영웅 클래스 × 마법사 스킬 + 합동 필살)
const ELEMENT_NAME = { fire: '화염', lightning: '번개', frost: '냉기', wind: '바람', holy: '신성', dark: '암흑', summon: '소환' };
const RARITY_BY_KEY = Object.fromEntries(RARITIES.map(r => [r.key, r]));
const MILESTONE_BY_KEY = Object.fromEntries(MILESTONES.map(m => [m.key, m]));
const AWAKEN_ICON = { power: 'atk', haste: 'rate', ward: 'wall', fortune: 'coin' };
const AWAKEN_STAT = { power: 'atk', haste: 'rate', ward: 'wall', fortune: 'gold' }; // AWAKENINGS 의 수치 필드
const GEM_ROWS = [['floor', '층 클리어', 'wall'], ['first', '첫 돌파', 'new'], ['boss', '네임드 보스', 'trophy'], ['flawless', '무결점', 'check'], ['best', '신기록 보너스', 'crit']];
const CLEAR_SHOW_MS = 3200;
const DEFEAT_HOLD_MS = 1600;      // 패배 도장을 보여 주는 최소 시간 → 결과 화면
const BERSERK_T = 80;             // sim.js BERSERK_T 와 같은 값(광폭화 시작 초) — 10초 전부터 경고
const WIDE_SIDE = 120;            // 전장 옆 여백(px)이 이 이상이면 옆 열을 여백으로 뺀다(폴더블 펼침·태블릿·데스크톱)
const SLIM_SIDE = 200;            // 이보다 좁은 여백은 이름 없이 구슬만 2열
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
const synIcon = key => emblemImg(key);
const classIcon = cls => CLASS_ICON[cls] || '';
const SPARK_ICON = svg(24, '<path d="M12 1l2.4 8.6L23 12l-8.6 2.4L12 23l-2.4-8.6L1 12l8.6-2.4z" fill="currentColor"/>');
const AI_ICON = svg(32, '<path d="M22 2 4 20l3 3L25 5z" fill="currentColor"/><circle cx="24" cy="8" r="6" fill="#fff" opacity=".9"/><path d="M24 3v10M19 8h10" stroke="currentColor" stroke-width="2"/>');
const pips = (n, max = SPELL_MAX_LV) => Array.from({ length: max }, (_, i) => `<i${i < n ? ' class="on"' : ''}></i>`).join('');
// 스킬 한 칸의 색 클래스 + 융합이면 두 원소 색(--fa/--fb). 기본 스킬 14 + 융합 스킬 8 공용
const skillTone = key => {
  const f = FUSION_BY_KEY[key];
  if (f) return { cls: 'fusion', style: `--fa:var(--elc-${f.elements[0]});--fb:var(--elc-${f.elements[1]})` };
  return { cls: 'el-' + (SKILL_BY_KEY[key]?.element || 'holy'), style: '' };
};
const skillArt = key => emblemImg(key) || icon('el-' + (SKILL_BY_KEY[key]?.element || 'holy'));
// 스킬 아이콘 타일(결과·이어하기·AI 동료 공용): 융합은 금 테
const skillChip = (key, lv, cls) => {
  const d = SKILL_BY_KEY[key];
  if (!d) return '';
  const t = skillTone(key);
  return `<span class="${cls} ${t.cls}" style="${t.style}" title="${esc(d.name)}">${skillArt(key)}${lv ? `<b class="num">${lv}</b>` : ''}</span>`;
};
const collabNames = c => {
  if (!c.cls) return '모든 영웅 × 쿨타임 스킬';
  const br = c.branch ? (TALENTS[c.cls] || []).find(b => b.key === c.branch) : null;
  return `${HERO_CLASSES[c.cls]?.name || ''}${br ? `(${br.name})` : ''} × ${c.spells.map(k => SKILL_BY_KEY[k]?.name || k).join(' · ')}`;
};

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
                                   unlocked3x, settings, discovered, gold?(영구 골드 — 결과 화면 '보유 골드'), version? }
  onEvents(events, view)           매 프레임 drainEvents 결과 — 반드시 renderer.frame 뒤, update 앞(합체 연출이 바뀌기 전 스택 위치를 읽는다)
  toast(msg, iconName?) · showOfflineReward({ gems, xp, minutes }, onClaim) · isBusy() · handleBack()
  showUpdateReady({version,notes,size}) · showUpdateProgress(pct|null) · showInstallPermissionHelp() · setVersion(text)
  slotRects() → [{ key, x, y, r }]  스킬 스택 구슬 중심(무대 #stage 기준 CSS px, 빈 칸 제외) — 캔버스가 협공 빛줄기를 그리고 싶을 때
  heroAnchor() → { x, y } | null    영웅 버튼 초상 중심(같은 좌표계). DOM 빛줄기(#beams)는 ui.js 가 이미 그린다

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
  onOpenHero({ tab })              영웅 화면 열기 tab = 'char' | 'talent' | 'bag'. 정비 화면에서면 heroUI.open(data.hero, { stage: data.best, camp: true, gold: data.gold }, { tab }),
                                   도전 중이면 heroUI.open(game.hero, { stage: data.best, gold: game.players[0].gold }, { tab })
                                   (정비 화면 action {type:'train', stat} = 마법사 수련(골드), {type:'meta', key} = 보석 강화 — onCampAct 로 온다)
  -- 전투 --
  onToggleAuto(on)                 자동 전투(카드 자동 선택 · 궁극기 · 특성) = act {type:'auto', on}. 강화 버튼·자동 강화는 없다
  onSkill(skill) · onSpeed() · onToggleAutoNext(on) · onNext() · onPick(index) · onReroll() · onHeroUlt()
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
    'btn-menu', 'menu-new', 'mana', 'berserk', 'berserk-text', 'st-revive', 'st-awaken', 'st-awaken-n',
    'side-l', 'side-r', 'stack', 'stack-count', 'beams', 'hero-card', 'hc-img', 'hc-cls', 'hc-title', 'hc-lv', 'hc-hp-fill', 'hc-ring-fg', 'hc-state',
    'link-chip', 'link-bar', 'collab-h', 'collab-list', 'partner',
    'toasts', 'clear', 'clear-stage', 'clear-gems', 'clear-gold', 'clear-xp', 'clear-drops', 'badge-flawless', 'badge-first', 'btn-next',
    'defeat', 'defeat-stage', 'defeat-icon',
    'pick', 'pick-h', 'pick-ring', 'pick-ring-fg', 'pick-ring-n', 'pick-cards', 'pick-reroll', 'pick-reroll-n',
    'btn-hero', 'hb-portrait', 'hb-lv', 'hb-pow', 'hb-new', 'hb-tal',
    'sk-heroult', 'heroult-ico', 'heroult-name',
    'p2-icon', 'p2-name', 'p2-spells', 'btn-auto', 'btn-speed', 'speed-text', 'speed-lock', 'btn-autonext',
    'btn-start', 'start-sub', 'title-ver', 'codex-count', 'codex-fill', 'codex-list', 'codex-list-fusion', 'codex-list-collab', 'ctab-hidden', 'ctab-fusion', 'ctab-collab',
    'set-ver', 'btn-check-update', 'btn-reset', 'reset-confirm', 'btn-reset-yes', 'btn-reset-no', 'btn-backup', 'btn-restore',
    'bk-lead', 'bk-code', 'btn-bk-copy', 'rs-step1', 'rs-step2', 'rs-code', 'rs-err', 'btn-rs-check', 'rs-sum', 'btn-rs-back', 'btn-rs-yes',
    'off-time', 'off-art', 'off-gems', 'off-xp', 'btn-claim', 'upd-h', 'upd-size', 'upd-notes', 'btn-upd-now', 'btn-upd-later',
    'btn-open-settings', 'upd-progress', 'upd-progress-text', 'upd-progress-fill',
    'm-result', 'res-art', 'res-rb', 'res-h', 'res-floor', 'res-floor-l', 'res-best', 'res-best-txt', 'res-sub', 'res-boss', 'res-time', 'res-hero',
    'res-share', 'res-bar', 'res-legend', 'res-gem-list', 'res-gem-total', 'res-spells-card', 'res-spells', 'res-unlock', 'btn-res-done',
    'res-gold-card', 'res-gold', 'res-gold-total', 'res-combos-card', 'res-combos',
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
  const runFound = new Set(); // 이번 도전에서 처음 발견한 조합(결과 화면 '새로 발견!')

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
    const w = spellTip.offsetWidth, h = spellTip.offsetHeight;
    const side = anchor.closest('.side-r') ? -1 : anchor.closest('.side-l') ? 1 : 0; // 옆 열: 전장 쪽으로 옆에 띄운다
    if (side) {
      const x = side < 0 ? cr.left - sr.left - 10 - w : cr.right - sr.left + 10;
      spellTip.style.left = Math.min(sr.width - 8 - w, Math.max(8, x)) + 'px';
      spellTip.style.top = Math.min(sr.height - 8 - h, Math.max(8, cr.top - sr.top + cr.height / 2 - h / 2)) + 'px';
      spellTip.style.transform = 'none';
    } else {
      spellTip.style.left = Math.min(sr.width - 8 - w / 2, Math.max(8 + w / 2, cr.left - sr.left + cr.width / 2)) + 'px';
      const below = cr.bottom - sr.top + 8;
      spellTip.style.top = (below + h > sr.height - 8 ? cr.top - sr.top - 8 - h : below) + 'px';
      spellTip.style.transform = 'translateX(-50%)';
    }
    spellTipTimer = setTimeout(hideSpellTip, ms);
  }
  on(stage, 'pointerdown', e => { if (!e.target.closest('.ss, .cb, .hero-card, .pc-spark, .st-chip')) hideSpellTip(); });

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

  on(root, 'contextmenu', e => { if (!e.target.closest('.upd-notes, textarea')) e.preventDefault(); }); // 롱프레스 메뉴 막기

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

  // ── 레이아웃: 넓은 화면(옆 여백 ≥ WIDE_SIDE)은 옆 열을 전장 밖으로, 좁으면 전장 가장자리에 겹친다 ──
  // 접기·펼치기·회전은 ResizeObserver 가 바로 받는다(상태는 그대로, 배치만 바뀜)
  let layoutGen = 0, layW = 0, layH = 0;
  function layout() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!(w > 0 && h > 0)) return;
    layW = w; layH = h;
    const colW = Math.min(w, h * 720 / 1100), side = (w - colW) / 2;
    stage.classList.toggle('wide', side >= WIDE_SIDE);
    stage.classList.toggle('slim', side >= WIDE_SIDE && side < SLIM_SIDE);
    root.style.setProperty('--toast-boss', Math.round(colW / 720 * 205) + 'px'); // 보스전 토스트 = 보스바 아래
    layoutGen++;
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(layout).observe(stage);
  addEventListener('resize', layout); // 폴더블 접기·펼치기(창 크기 변경) 즉시 — 관찰자가 늦는 웹뷰 대비
  layout();
  const relRect = el => { // 무대 기준 사각형(CSS px)
    const sr = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height, cx: r.left - sr.left + r.width / 2, cy: r.top - sr.top + r.height / 2 };
  };

  // ── 왼쪽: 영웅 카드 (초상 + 체력 고리 · 넓으면 이름·Lv·체력 바) ──
  let heroKey = '', heroP = -1;
  on(E['hero-card'], 'click', () => H.onOpenHero?.({ tab: talLeft > 0 ? 'talent' : 'char' }));
  function updateHeroCard(h, hero) {
    const card = E['hero-card'];
    if (!h) { if (!card.hidden) card.hidden = true; return; }
    if (card.hidden) card.hidden = false;
    const lv = hero ? hero.level : h.level, tier = heroTier(lv);
    let key = h.cls + '|' + lv;
    if (hero) for (const k in hero.equip) key += '|' + (hero.equip[k]?.rarity || '');
    if (heroKey !== key) {
      heroKey = key;
      card.style.setProperty('--cc', CLS_INFO[h.cls]?.col || '#7b6cff');
      html(E['hc-img'], `<img src="${heroPortraitURL(h.cls, tier, hero?.equip, 180)}" alt="" draggable="false">`);
      html(E['hc-cls'], classIcon(h.cls));
      txt(E['hc-title'], heroTitle(h.cls, lv));
      txt(E['hc-lv'], String(lv));
      card.setAttribute('aria-label', `${heroTitle(h.cls, lv)} Lv.${lv}`);
    }
    const down = h.state === 'down';
    const ratio = down ? 0 : h.hp < 0 || !(h.maxHp > 0) ? 1 : Math.max(0, Math.min(1, h.hp / h.maxHp)); // hp -1 = 막 생성(풀피)
    const q = Math.round(ratio * 100);
    if (q !== heroP) {
      heroP = q;
      prop(E['hc-ring-fg'], '--p', frac(ratio));
      prop(E['hc-hp-fill'], '--p', frac(ratio));
      attr(E['hc-hp-fill'].parentElement, 'aria-valuenow', String(q));
      card.classList.toggle('low', ratio < 0.35 && !down);
    }
    card.classList.toggle('down', down);
    card.classList.toggle('retreat', h.mode === 'retreat' && !down);
    if (down) { E['hc-state'].hidden = false; txt(E['hc-state'], `부활 ${Math.max(1, Math.ceil(h.respawnT))}`); }
    else if (h.mode === 'retreat') { E['hc-state'].hidden = false; txt(E['hc-state'], '후퇴'); }
    else if (!E['hc-state'].hidden) E['hc-state'].hidden = true;
  }

  // ── 마나 게이지(층마다 한 번 → 카드) ──
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

  // ── 오른쪽: 스킬 스택 6칸 (game.spells 삽입 순서 · 융합 스킬은 맨 뒤 · 쿨타임 고리 · Lv 점) ──
  E.stack.innerHTML = Array.from({ length: SPELL_SLOTS }, (_, i) => `<button type="button" class="ss empty" data-i="${i}" aria-label="빈 스킬 칸 ${i + 1}">`
    + `<span class="ss-orb"><span class="ss-ring"></span><span class="ss-art"></span></span><span class="ss-pips">${pips(0)}</span>`
    + '<span class="ss-txt"><b class="ss-name">빈 칸</b><span class="ss-lv"></span></span></button>').join('');
  const slots = [...E.stack.children].map(b => ({
    b, orb: b.querySelector('.ss-orb'), art: b.querySelector('.ss-art'), pips: [...b.querySelectorAll('.ss-pips i')],
    name: b.querySelector('.ss-name'), lv: b.querySelector('.ss-lv'), key: null, level: 0, p: -1, passive: null, flashT: 0,
  }));
  let stackKey = '';
  for (const s of slots) on(s.b, 'click', () => {
    const k = s.key, d = SKILL_BY_KEY[k];
    if (!d) { showTip(s.b, '', `<b>빈 칸</b><br>카드로 새 스킬을 배울 수 있어요. 두 스킬이 <b>융합</b>하면 칸이 하나 비어요.`, 3000); return; }
    const lv = s.level, f = FUSION_BY_KEY[k], parts = view?.fusionParts?.[k];
    showTip(s.b, f ? '' : 'el-' + d.element, `<b>${esc(d.name)} Lv.${lv}</b>${f ? ` <span class="tip-dim">융합</span>` : ''}<br>${esc(d.desc[lv - 1] || '')}`
      + (f && parts ? `<span class="tip-fu">${parts.map(p => esc(SKILL_BY_KEY[p]?.name || p)).join(' + ')} 합체 — 둘의 효과를 모두 품었어요</span>` : '')
      + (lv < SPELL_MAX_LV ? `<small>다음 Lv.${lv + 1}: ${esc(d.desc[lv] || '')}</small>` : '<small>최대 레벨</small>'), 4200);
  });
  function paintSlot(s, key, lv) {
    const prevKey = s.key, prevLv = s.level;
    s.key = key || null; s.level = lv || 0; s.p = -1; s.passive = null;
    const d = key && SKILL_BY_KEY[key];
    if (!d) {
      s.b.className = 'ss empty'; s.b.removeAttribute('style');
      s.art.innerHTML = ''; txt(s.name, '빈 칸'); txt(s.lv, '');
      s.b.setAttribute('aria-label', `빈 스킬 칸 ${+s.b.dataset.i + 1}`);
      return;
    }
    const t = skillTone(key);
    s.b.className = `ss ${t.cls}${lv >= SPELL_MAX_LV ? ' max' : ''}`;
    if (t.style) s.b.setAttribute('style', t.style); else s.b.removeAttribute('style');
    if (prevKey !== key) s.art.innerHTML = skillArt(key);
    s.pips.forEach((p, i) => p.classList.toggle('on', i < lv));
    txt(s.name, d.name);
    txt(s.lv, lv >= SPELL_MAX_LV ? 'MAX' : `Lv.${lv}`);
    s.b.setAttribute('aria-label', `${d.name} Lv${lv}${FUSION_BY_KEY[key] ? ' (융합 스킬)' : ''}`);
    if (!prevKey && !pendingMerge) s.orb.animate([{ transform: 'scale(.2)', opacity: 0 }, { transform: 'scale(1.3)', opacity: 1, offset: 0.55 }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.3,1.9,.5,1)' });
    else if (prevKey === key && lv > prevLv) s.b.querySelector('.ss-pips').animate(BUMP, bumpOpts);
  }
  function updateStack(v) {
    const sp = v.spells || {}, keys = Object.keys(sp);
    const key = keys.map(k => k + sp[k]).join(',');
    if (key !== stackKey) {
      stackKey = key;
      slots.forEach((s, i) => { const k = keys[i]; if (s.key !== (k || null) || s.level !== (sp[k] || 0)) paintSlot(s, k, sp[k]); });
      const n = Math.min(SPELL_SLOTS, keys.length);
      txt(E['stack-count'], `${n}/${SPELL_SLOTS}`);
      E['stack-count'].parentElement.classList.toggle('full', n >= SPELL_SLOTS);
    }
    // 쿨타임 고리(지속형 = 도는 빛) · 합동 필살 창(다음 쿨타임 스킬 2배)
    const link = (v.linkT || 0) > 0;
    for (const s of slots) {
      if (!s.key) continue;
      const cd = spellCooldown(v, s.key);
      const passive = !cd;
      if (passive !== s.passive) { s.passive = passive; s.b.classList.toggle('passive', passive); }
      if (cd) {
        const p = Math.round((cd.total > 0 ? 1 - cd.left / cd.total : 1) * 48) / 48;
        if (p !== s.p) { s.p = p; s.b.style.setProperty('--p', p.toFixed(3)); }
      }
      s.b.classList.toggle('hl', link && !passive);
    }
  }
  // 시전 순간: 그 칸(또는 그 스킬을 품은 융합 칸)이 톡
  function slotOf(v, spell) {
    let s = slots.find(x => x.key === spell);
    if (!s && v?.fusionParts) s = slots.find(x => x.key && (v.fusionParts[x.key] || []).includes(spell));
    return s || null;
  }
  function flashSlot(s, strong = false) {
    const t = performance.now();
    if (!s || (!strong && t - s.flashT < 140)) return;
    s.flashT = t;
    s.orb.animate(strong
      ? [{ transform: 'scale(1.5)', filter: 'brightness(2.2)' }, { transform: 'scale(1)', filter: 'none' }]
      : [{ transform: 'scale(1.16)', filter: 'brightness(1.7)' }, { transform: 'scale(1)', filter: 'none' }], { duration: strong ? 520 : 240, easing: 'cubic-bezier(.22,1,.36,1)' });
  }

  // ── 융합 합체 연출: 두 구슬이 날아와 하나로 → 폭발 → 빈 칸 반짝 + '슬롯 해제!' ──
  let pendingMerge = null;
  function captureMerge(ev) { // 스택이 바뀌기 전(같은 프레임 update 앞)에 재료 두 칸의 자리를 기억
    const from = (ev.from || []).map(k => { const s = slots.find(x => x.key === k); return s ? { key: k, r: relRect(s.orb) } : null; }).filter(Boolean);
    pendingMerge = { fusion: ev.fusion, from };
  }
  function playMerge(pm) {
    const tgt = slots.find(s => s.key === pm.fusion);
    if (!tgt) return;
    const tr = relRect(tgt.orb), cx = tr.cx, cy = tr.cy;
    const wide = stage.classList.contains('wide');
    const mx = wide ? cx : cx - Math.min(110, stage.clientWidth * 0.22), my = wide ? cy - 70 : cy - 30; // 모이는 곳: 전장 쪽 허공
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const T = reduce ? 10 : 820;
    tgt.orb.style.opacity = '0';
    pm.from.forEach((f, i) => {
      const t = skillTone(f.key), g = document.createElement('div');
      g.className = `merge-ghost ss ${t.cls}`;
      if (t.style) g.setAttribute('style', t.style);
      g.style.left = f.r.x + 'px'; g.style.top = f.r.y + 'px'; g.style.width = f.r.w + 'px'; g.style.height = f.r.h + 'px';
      g.innerHTML = `<span class="ss-orb"><span class="ss-art">${skillArt(f.key)}</span></span>`;
      stage.append(g);
      const ox = f.r.cx, oy = f.r.cy, sd = i ? 1 : -1;
      g.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${mx - ox + sd * 34}px, ${my - oy}px) scale(1.55) rotate(${sd * 20}deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${mx - ox + sd * 6}px, ${my - oy}px) scale(1.2) rotate(${sd * 200}deg)`, opacity: 1, offset: 0.72 },
        { transform: `translate(${cx - ox}px, ${cy - oy}px) scale(.35) rotate(${sd * 360}deg)`, opacity: 0.2 },
      ], { duration: T, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' }).onfinish = () => g.remove();
    });
    setTimeout(() => {
      tgt.orb.style.opacity = '';
      const b = document.createElement('i');
      b.className = 'merge-burst';
      b.style.left = cx + 'px'; b.style.top = cy + 'px';
      stage.append(b);
      b.animate([{ transform: 'scale(.2) rotate(0deg)', opacity: 1 }, { transform: 'scale(1.5) rotate(40deg)', opacity: 0 }], { duration: 560, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => b.remove();
      tgt.orb.animate([{ transform: 'scale(.3)' }, { transform: 'scale(1.45)', offset: 0.5 }, { transform: 'scale(1)' }], { duration: 520, easing: 'cubic-bezier(.3,1.9,.5,1)' });
      // 비워진 칸 반짝 + '슬롯 해제!'
      const free = slots.find(s => !s.key);
      if (free) {
        free.b.classList.remove('freed'); void free.b.offsetWidth; free.b.classList.add('freed');
        setTimeout(() => free.b.classList.remove('freed'), 1500);
        const fr = relRect(free.orb), tag = document.createElement('div');
        tag.className = 'merge-tag';
        tag.innerHTML = `슬롯 해제!<small>${esc(SKILL_BY_KEY[pm.fusion]?.name || '')} 합체</small>`;
        stage.append(tag);
        const tw = tag.offsetWidth, th = tag.offsetHeight;
        const lx = wide ? fr.cx - tw / 2 : fr.x - tw - 10;
        tag.style.left = Math.max(6, Math.min(stage.clientWidth - tw - 6, lx)) + 'px';
        tag.style.top = Math.max(6, (wide ? fr.y - th - 10 : fr.cy - th / 2)) + 'px';
        tag.animate([{ transform: 'scale(2) rotate(-12deg)', opacity: 0 }, { transform: 'scale(1) rotate(-4deg)', opacity: 1, offset: 0.2 }, { transform: 'scale(1) rotate(-4deg)', opacity: 1, offset: 0.8 }, { transform: 'translateY(-14px) rotate(-4deg)', opacity: 0 }],
          { duration: 1800, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => tag.remove();
      }
      beamKey = ''; // 합체로 칸 순서가 바뀌었다 → 빛줄기 다시
    }, T - 40);
  }

  // ── 왼쪽: 켜진 협공 타일 (영웅 클래스 문장 + 엮인 스킬) ──
  let collabKey = '';
  function updateCollabs(v) {
    const list = (v.collabs || []).filter(k => COLLAB_BY_KEY[k]);
    const key = list.join(',') + '|' + (v.heroUnit?.cls || '');
    if (key === collabKey) return;
    collabKey = key;
    E['collab-h'].hidden = !list.length;
    E['collab-list'].innerHTML = list.map(k => {
      const c = COLLAB_BY_KEY[k], col = CLS_INFO[c.cls]?.col || '#ffd23a';
      const sk = collabSlots(v, k)[0] || c.spells.find(x => v.spells?.[x]) || c.spells[0];
      const t = sk ? skillTone(sk) : null;
      return `<li class="cb" data-key="${k}" style="--cc:${col}" aria-label="협공 ${esc(c.name)}"><span class="cb-ico">${classIcon(c.cls)}`
        + (t ? `<span class="cb-sp ${t.cls}" style="${t.style}">${skillArt(sk)}</span>` : '')
        + `</span><span class="cb-name">${esc(c.name)}<small>${esc(HERO_CLASSES[c.cls]?.name || '')} × ${esc(SKILL_BY_KEY[sk]?.name || '')}</small></span></li>`;
    }).join('');
    beamKey = '';
  }
  on(E['collab-list'], 'click', e => {
    const li = e.target.closest('.cb'), c = li && COLLAB_BY_KEY[li.dataset.key];
    if (c) showTip(li, '', `<b>협공 · ${esc(c.name)}</b><br>${esc(c.desc)}`, 4200);
  });
  function procCollab(key) {
    const li = E['collab-list'].querySelector(`.cb[data-key="${key}"]`);
    if (li) { li.classList.remove('proc'); void li.offsetWidth; li.classList.add('proc'); }
    const g = E.beams.querySelector(`g[data-key="${key}"]`);
    if (g) { g.classList.remove('proc'); void g.getBoundingClientRect(); g.classList.add('proc'); }
  }
  // 합동 필살 창(영웅 궁극기 뒤 3초): 왼쪽 금빛 칩 + 스택 강조
  function updateLink(v) {
    const t = v.phase === 'play' ? v.linkT || 0 : 0;
    if ((t > 0) === E['link-chip'].hidden) E['link-chip'].hidden = !(t > 0);
    if (t > 0) prop(E['link-bar'], '--p', frac(t / (COLLAB_FX.linkT || 3)));
    E['sk-heroult'].classList.toggle('linked', t > 0);
  }

  // ── 협공 빛줄기: 영웅 버튼 초상 ↔ 엮인 스킬 구슬 (SVG, 배치가 바뀔 때만 다시 그림) ──
  let beamKey = '';
  const SVGNS = 'http://www.w3.org/2000/svg';
  function updateBeams(v) {
    const on1 = v.phase === 'play' && !E['btn-hero'].hidden && (v.collabs || []).length > 0;
    const key = on1 ? `${layoutGen}|${stackKey}|${(v.collabs || []).join(',')}|${stage.classList.contains('wide')}` : '';
    if (key === beamKey) return;
    beamKey = key;
    E.beams.replaceChildren();
    for (const s of slots) s.b.classList.remove('linked-on');
    if (!on1) return;
    const a = relRect(E['hb-portrait']);
    for (const k of v.collabs) {
      const c = COLLAB_BY_KEY[k];
      if (!c) continue;
      const col = CLS_INFO[c.cls]?.col || '#ffd23a';
      const g = document.createElementNS(SVGNS, 'g');
      g.dataset.key = k;
      for (const sk of collabSlots(v, k)) {
        const s = slots.find(x => x.key === sk);
        if (!s) continue;
        s.b.classList.add('linked-on');
        s.b.style.setProperty('--cb', col);
        const b = relRect(s.orb);
        // 전장 쪽으로 살짝 휜 곡선(직선보다 '마력이 흐르는' 느낌). 끝점은 초상·구슬 테두리(아이콘을 가리지 않게)
        const dx = b.cx - a.cx, dy = b.cy - a.cy, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        const ra = a.w / 2 + 4, rb = b.w / 2 + 8;
        if (len < ra + rb + 6) continue;
        const x1 = a.cx + ux * ra, y1 = a.cy + uy * ra, x2 = b.cx - ux * rb, y2 = b.cy - uy * rb, bend = (len - ra - rb) * 0.16 * Math.sign(dy || 1);
        const qx = (x1 + x2) / 2 - uy * bend, qy = (y1 + y2) / 2 + ux * bend;
        const d = `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
        for (const [cls, stroke] of [['bm-glow', col], ['bm-core', col], ['bm-flow', '#fffbe8']]) {
          const p = document.createElementNS(SVGNS, 'path');
          p.setAttribute('d', d); p.setAttribute('class', cls); p.setAttribute('stroke', stroke);
          g.append(p);
        }
      }
      if (g.childElementCount) E.beams.append(g);
    }
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
    // 머리글: 도전 시작 무료 카드 · 칸이 다 찼으면 '강화만'
    const full = Object.keys(view?.spells || {}).length >= SPELL_SLOTS;
    txt(E.pick.querySelector('.pick-ribbon'), pick.starter ? '출정의 축복!' : full ? `스킬 칸 ${SPELL_SLOTS}/${SPELL_SLOTS}` : '마나 폭주!');
    txt(E['pick-h'], pick.starter ? '첫 마법을 고르세요' : full ? '스킬을 강화하세요' : '스킬을 선택하세요');
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
      const sp = SKILL_BY_KEY[card.spell], tone = skillTone(card.spell), fu = tone.cls === 'fusion';
      c.key = card.spell;
      c.b.className = `pick-card ${tone.cls} rar-${card.rarity}`;
      if (tone.style) c.b.setAttribute('style', tone.style); else c.b.removeAttribute('style');
      html(c.ico, skillArt(card.spell));
      txt(c.name, sp.name);
      c.pipRow.hidden = false;
      c.pips.forEach((p, pi) => { p.classList.toggle('on', pi < card.level); p.classList.toggle('nx', pi === card.level - 1); });
      const dsc = sp.desc[card.level - 1] || '';
      txt(c.desc, dsc);
      c.desc.classList.toggle('long', dsc.length > 30); // 고정 칸에 맞춰 한 단계 작게
      txt(c.rar, { common: '일반', rare: '희귀', legend: '전설' }[card.rarity] || '일반');
      c.tag.hidden = false;
      if (card.level > 1) { c.tag.className = fu ? 'pc-tag up fu' : 'pc-tag up'; txt(c.tag, `${fu ? '융합 ' : ''}Lv${card.level - 1} → ${card.level}`); }
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
    E['cont-spells'].innerHTML = sp.length ? sp.map(([k, lv]) => skillChip(k, lv, 'cont-sp')).join('')
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
    // 획득 골드(영구 재화 → 마법사 수련)
    const gold = Math.floor(rw.gold || 0);
    E['res-gold'].textContent = '+0';
    setTimeout(() => { countUp(E['res-gold'], gold, 900, null, '+'); E['res-gold-card'].animate(BUMP, { ...bumpOpts, delay: 900 }); }, 700);
    const total = Number(meta.gold);
    E['res-gold-total'].hidden = !Number.isFinite(total);
    if (Number.isFinite(total)) E['res-gold-total'].innerHTML = `보유 골드 <b class="k-num gold">${fmt(total)}</b>`;
    // 이번 도전의 조합: 합체한 융합 스킬 + 켜진 협공 (처음 발견 = NEW)
    const fus = [...new Set([...Object.keys(sum.spells || {}).filter(k => FUSION_BY_KEY[k]), ...(game?.fusions || [])])];
    const cols = (game?.collabs || []).filter(k => COLLAB_BY_KEY[k]);
    if (runFound.has('unison')) cols.push('unison'); // 합동 필살은 이벤트형(켜진 목록에 없음)
    E['res-combos-card'].hidden = !(fus.length + cols.length);
    E['res-combos'].innerHTML = fus.map(k => { const t = skillTone(k); return `<span class="res-cmb fusion" style="${t.style}"><span class="res-cmb-art">${skillArt(k)}</span><b>${esc(FUSION_BY_KEY[k].name)}</b><em>원소 융합</em>${runFound.has(k) ? '<i class="k-badge new">NEW</i>' : ''}</span>`; }).join('')
      + cols.map(k => { const c = COLLAB_BY_KEY[k]; return `<span class="res-cmb collab" style="--cc:${CLS_INFO[c.cls]?.col || '#ffd23a'}"><span class="res-cmb-art">${c.cls ? classIcon(c.cls) : icon('crit')}</span><b>${esc(c.name)}</b><em>협공</em>${runFound.has(k) ? '<i class="k-badge new">NEW</i>' : ''}</span>`; }).join('');
    runFound.clear();
    // 이번 도전의 스킬
    const sp = Object.entries(sum.spells || {});
    E['res-spells-card'].hidden = !sp.length;
    E['res-spells'].innerHTML = sp.map(([k, lv]) => { const s = SKILL_BY_KEY[k], t = skillTone(k); return s ? `<span class="res-sp ${t.cls}" style="${t.style}"><span class="res-sp-art">${skillArt(k)}</span><span class="res-sp-name">${esc(s.name)}</span><span class="sc-pips">${pips(lv)}</span></span>` : ''; }).join('');
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

  // ── 도감 (히든 조합 14 + 원소 융합 8 + 협공 15) ──
  E['codex-list'].innerHTML = HIDDEN_SYN.map(s => `<li class="syn-card" data-key="${s.key}"><div class="syn-ico" aria-hidden="true"></div>`
    + '<div class="syn-body"><div class="syn-name"></div><div class="syn-text"></div></div>'
    + `<span class="syn-tag ${s.kind}">${KIND_TAG[s.kind]}</span><span class="syn-new" hidden>NEW</span></li>`).join('');
  E['codex-list-fusion'].innerHTML = FUSION_LIST.map(s => `<li class="syn-card fusion" data-key="${s.key}"><div class="syn-ico fusion-ico" aria-hidden="true"></div>`
    + '<div class="syn-body"><div class="syn-name"></div><div class="syn-text"></div></div>'
    + '<span class="syn-tag fusion"></span><span class="syn-new" hidden>NEW</span></li>').join('');
  E['codex-list-collab'].innerHTML = COLLAB_LIST.map(s => `<li class="syn-card collab" data-key="${s.key}" style="--cc:${CLS_INFO[s.cls]?.col || '#ffc92e'}"><div class="syn-ico collab-ico" aria-hidden="true"></div>`
    + '<div class="syn-body"><div class="syn-name"></div><div class="syn-who"></div><div class="syn-text"></div></div>'
    + '<span class="syn-tag collab"></span><span class="syn-new" hidden>NEW</span></li>').join('');
  const mkCards = (list, host) => [...host.children].map((li, i) => ({
    s: list[i], li, ico: li.querySelector('.syn-ico'), name: li.querySelector('.syn-name'),
    text: li.querySelector('.syn-text'), tag: li.querySelector('.syn-tag'), nw: li.querySelector('.syn-new'), who: li.querySelector('.syn-who'),
  }));
  const cards = mkCards(HIDDEN_SYN, E['codex-list']);
  const fusionCards = mkCards(FUSION_LIST, E['codex-list-fusion']);
  const collabCards = mkCards(COLLAB_LIST, E['codex-list-collab']);
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
    } else if (c.s.kind === 'collab') { // 협공: 발견 = 클래스 문장 + 엮인 스킬 · 누가 × 무엇 / 잠김 = ??? + 힌트(조건 비공개)
      const sk = c.s.spells[0];
      html(c.ico, known ? (c.s.cls ? classIcon(c.s.cls) : icon('crit')) + (sk ? `<span class="cb-sp ${skillTone(sk).cls}">${skillArt(sk)}</span>` : '') : '');
      txt(c.who, known ? collabNames(c.s) : '');
      c.who.hidden = !known;
      txt(c.tag, known ? (c.s.cls ? HERO_CLASSES[c.s.cls]?.name || '' : '연계기') : '');
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
    let nc = 0;
    for (const c of collabCards) if (renderCodexCard(c, d)) nc++;
    n += nc;
    txt(E['ctab-collab'], nc ? `협공 ${nc}` : '협공');
    txt(E['codex-count'], `${n}/${SYNERGIES.length} 발견`);
    prop(E['codex-fill'], '--p', frac(n / SYNERGIES.length));
  }
  function setCodexTab(t) {
    codexTab = t;
    E['codex-list'].hidden = t !== 'hidden';
    E['codex-list-fusion'].hidden = t !== 'fusion';
    E['codex-list-collab'].hidden = t !== 'collab';
    attr(E['ctab-hidden'], 'aria-selected', String(t === 'hidden'));
    attr(E['ctab-fusion'], 'aria-selected', String(t === 'fusion'));
    attr(E['ctab-collab'], 'aria-selected', String(t === 'collab'));
  }
  on(E['ctab-hidden'], 'click', () => setCodexTab('hidden'));
  on(E['ctab-fusion'], 'click', () => setCodexTab('fusion'));
  on(E['ctab-collab'], 'click', () => setCodexTab('collab'));
  function openCodex() {
    const last = [...fresh].pop(), kind = last && SYN_BY_KEY[last]?.kind; // 방금 발견한 조합의 탭으로
    if (kind) codexTab = kind === 'fusion' ? 'fusion' : kind === 'collab' ? 'collab' : 'hidden';
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
    if (stage.clientWidth !== layW || stage.clientHeight !== layH) layout(); // 관찰자·resize 이벤트를 놓친 크기 변경(가려진 웹뷰 등) 보정
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
    updateStack(v);
    if (pendingMerge) { const pm = pendingMerge; pendingMerge = null; playMerge(pm); }
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

    updateSkill(skills[0], me.cd.meteor, v.phase);
    updateSkill(skills[1], me.cd.freeze, v.phase);
    attr(E['btn-auto'], 'aria-pressed', String(!!me.auto));
    attr(E['btn-autonext'], 'aria-pressed', String(!!meta.autoNext));
    txt(E['speed-text'], v.speed + 'x');
    if (E['speed-lock'].hidden !== !!meta.unlocked3x) E['speed-lock'].hidden = !!meta.unlocked3x;

    updateHeroCard(v.heroUnit, v.hero);
    updateHeroUlt(v.heroUnit);
    updateCollabs(v);
    updateLink(v);
    updateBeams(v);

    // AI 동료(넓은 화면 왼쪽 열): 네임드 보스 처치로 익힌 주문(최대 3)
    const al = v.allySpells || {};
    const pk = Object.entries(al).join();
    if (pk !== p2Key) {
      p2Key = pk;
      html(E['p2-icon'], AI_ICON);
      txt(E['p2-name'], pa.kind === 'bot' ? 'AI 동료' : pa.name);
      E['p2-spells'].innerHTML = Object.entries(al).map(([key, lv]) => skillChip(key, lv, 'p2-sp')).join('');
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
        case 'fusionMerge': captureMerge(ev); break;
        case 'cast': if (ev.o === 0 && !ev.basic) flashSlot(slotOf(v, ev.spell), !!ev.linked); break;
        case 'linkFinish': flashSlot(slotOf(v, ev.spell), true); break;
        case 'collabProc': procCollab(ev.key); break;
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
            runFound.add(ev.key);
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
    slotRects: () => slots.filter(x => x.key).map(x => { const r = relRect(x.orb); return { key: x.key, x: r.cx, y: r.cy, r: r.w / 2 }; }),
    heroAnchor: () => { if (E['btn-hero'].hidden) return null; const r = relRect(E['hb-portrait']); return { x: r.cx, y: r.cy }; },
  };
}

// 릴리스 노트(마크다운) → 읽기 좋은 평문
function cleanNotes(s) {
  return String(s ?? '').replace(/\r/g, '').split('\n')
    .map(l => l.replace(/^\s*#+\s*/, '').replace(/^\s*[-*]\s+/, '• ').replace(/\*\*|__|`/g, ''))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000);
}

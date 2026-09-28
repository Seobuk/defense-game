// DOM HUD · 하단 패널 · 메뉴/모달 · 정비 화면(camp.js) · 결과 화면 · 이어하기 · 저장 백업 (캔버스 안 연출은 render.js 몫)
// 로그라이트 구조(docs/DESIGN.md '로그라이트 구현 계약'): 타이틀 → (이어하기 | 정비) → 도전 → 결과 → 정비.
// 모든 상태 변경은 handlers(H.*)로 호출측(main.js)에 넘긴다 — 아래 createUI 주석이 계약이다.
import {
  SKILLS, THEMES, SYNERGIES, CODEX_SYN, codexFound, SPEED_UNLOCK, SPEEDS, OFFLINE_CAP_HOURS, FUSIONS, fusionParts, fusionProgress,
  SKILL_BY_KEY, FUSION_BY_KEY, COLLAB_BY_KEY, COLLAB_FX, PICK_AUTO_T, SPELL_SLOTS, SPELL_MAX_LV, AWAKENINGS, AWAKEN_BY_KEY,
} from './config.js';
import { collabSlots, BERSERK_T } from './sim.js';
import { COMBO_TIERS, COMBO_WINDOW, FRENZY, LEGEND_T } from './config.js'; // 4차 전투 상태 한 줄
import { ultWorth, pickCard } from './bot.js';
import { spellCooldown } from './spells.js';
import { HERO_CLASSES, heroTitle, RARITIES, MILESTONES, heroPower, heroClearXp, heroTier } from './hero.js';
import { heroPortrait, bestRarityIdx, CLS_INFO } from './heroui.js';
import { TALENTS, talentLeft } from './talents.js';
import { createCamp } from './camp.js';
import { createRelicUI } from './relicui.js'; // 4차 유물·망각 화면
import { slotCap } from './relics.js';
import { fmt, clamp } from './util.js';
import { icon } from './icons.js';
import { momentLeft } from './art/hud.js';
import { heroPortraitURL, magePortraitURL, enemyURL, itemIconURL } from './art/units.js';
import { emblemImg } from './art/emblems.js';
import { createDungeonUI } from './dungeonui.js'; // 4차 던전(지역) 특성: 배너 · HUD 칩 · 카드/칸 배지
import { mutOptionsHTML, mutCardLabel, mutBadgeHTML, mutName, mutTipHTML, upgradeHTML, createMutSheet } from './mutui.js'; // 4차 변이: 카드 A/B · 칸 배지 · 강화 수치 줄
import { mutChoice } from './mutations.js';
import { createNameUI } from './nameui.js'; // 4차 닉네임 입력 창
import { createRecordUI } from './recordui.js'; // v0.1.1 도전 기록 화면
import { renderCosmeticCodex, resultTickets } from './summonui.js'; // v0.1.2 도감 '외형' 탭 · 결과 화면 소환권
import { giftPending } from './summon.js'; // v0.1.2 타이틀 'NEW 외형 소환' 리본

const SYN_BY_KEY = Object.fromEntries(SYNERGIES.map(s => [s.key, s]));
const KIND_TAG = { cannon: '마법', duo: '협동', event: '이벤트' };
const HIDDEN_SYN = CODEX_SYN.filter(s => s.kind !== 'fusion' && s.kind !== 'collab'); // 도감: 히든 조합 10(협동 4종 제외)
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
const BERSERK_WARN = 15;         // 광폭화(sim.js BERSERK_T) 15초 전부터 카운트다운
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
const PAUSE_ICON = svg(24, '<rect x="5" y="4" width="5" height="16" rx="1.5" fill="currentColor"/><rect x="14" y="4" width="5" height="16" rx="1.5" fill="currentColor"/>');
const pips = (n, max = SPELL_MAX_LV) => Array.from({ length: max }, (_, i) => `<i${i < n ? ' class="on"' : ''}></i>`).join('');
// 스킬 한 칸의 색 클래스 + 융합이면 두 원소 색(--fa/--fb). 기본 스킬 14 + 융합 스킬 8 공용
const skillTone = key => {
  const f = FUSION_BY_KEY[key];
  if (f) return { cls: 'fusion', style: `--fa:var(--elc-${f.elements[0]});--fb:var(--elc-${f.elements[1]})` };
  return { cls: 'el-' + (SKILL_BY_KEY[key]?.element || 'holy'), style: '' };
};
const skillArt = key => emblemImg(key) || icon('el-' + (SKILL_BY_KEY[key]?.element || 'holy'));
// 스킬 아이콘 타일(결과·이어하기 공용): 융합은 금 테
const skillChip = (key, lv, cls) => {
  const d = SKILL_BY_KEY[key];
  if (!d) return '';
  const t = skillTone(key);
  return `<span class="${cls} ${t.cls}" style="${t.style}" title="${esc(d.name)}">${skillArt(key)}${lv ? `<b class="num">${lv}</b>` : ''}</span>`;
};
// 이 카드를 찍으면 완성되는 융합(카드의 fusionHint 가 켜졌을 때 이름을 찾는 용도 — 발견한 융합만 이름을 보여 준다)
function fusionOf(spells, key, level) {
  const hyp = { ...spells, [key]: level };
  return FUSIONS.find(f => !spells[f.key] && !f.ready(spells) && f.ready(hyp) && fusionParts(f, hyp).includes(key)) || null;
}
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
                                   speedCap(열린 최고 배속), settings, discovered, gold?(영구 골드 — 결과 화면 '보유 골드'), version? }
  onEvents(events, view)           매 프레임 drainEvents 결과 — 반드시 renderer.frame 뒤, update 앞(합체 연출이 바뀌기 전 스택 위치를 읽는다)
  toast(msg, iconName?) · showOfflineReward({ gems, xp, minutes }, onClaim) · isBusy() · handleBack()
  isPickShown()                    카드가 화면에 떠 있나('자동 선택' 카운트다운은 카드가 보일 때만 흐른다 — 합체·보스 연출 뒤로 밀린 동안엔 멈춤)
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
  onToggleAutoNext(on)             '자동 진행' 하나 = 다음 층 자동 · 영웅 궁극기 자동, 카드는 늘 직접(act {type:'auto', on} + settings.autoNext).
                                   카드 선택 중에도 누를 수 있다(하단 패널에서 이 토글만 살아 있음)
  onToggleAutoPick(on)             카드 화면의 '자동 선택'(자동 진행과 별개, 기본 OFF) → act {type:'autoPick', on} + settings.autoPick.
                                   설정 화면의 같은 스위치는 onSettings({ autoPick })로 온다
  onSkill(skill) · onSpeed() · onNext() · onPick(index) · onReroll() · onHeroUlt()
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
    'btn-menu', 'menu-new', 'mana', 'berserk', 'berserk-text', 'combo', 'combo-n', 'combo-t', 'combo-g', 'st-frenzy', 'frenzy-g', 'st-legend', 'legend-g', 'st-revive', 'st-awaken', 'st-awaken-n',
    'side-l', 'side-r', 'stack', 'stack-count', 'beams', 'hero-card', 'hc-img', 'hc-cls', 'hc-title', 'hc-lv', 'hc-hp-fill', 'hc-ring-fg', 'hc-state',
    'link-chip', 'link-bar', 'collab-h', 'collab-list', 'flinks',
    'toasts', 'clear', 'clear-stage', 'clear-gems', 'clear-gold', 'clear-xp', 'clear-drops', 'badge-flawless', 'badge-first', 'btn-next',
    'defeat', 'defeat-stage', 'defeat-icon',
    'pick', 'pick-h', 'pick-sub', 'pick-ring', 'pick-ring-fg', 'pick-ring-n', 'pick-cards', 'pick-reroll', 'pick-reroll-n', 'pick-auto',
    'btn-hero', 'hb-portrait', 'hb-lv', 'hb-pow', 'hb-new', 'hb-tal',
    'sk-heroult', 'heroult-ico', 'heroult-name',
    'controls', 'btn-speed', 'speed-text', 'speed-lock', 'btn-autonext',
    'btn-start', 'start-sub', 'title-ver', 'codex-count', 'codex-fill', 'codex-list', 'codex-list-fusion', 'codex-list-collab', 'ctab-hidden', 'ctab-fusion', 'ctab-collab',
    'set-ver', 'btn-check-update', 'btn-reset', 'reset-confirm', 'btn-reset-yes', 'btn-reset-no', 'btn-backup', 'btn-restore',
    'bk-lead', 'bk-code', 'btn-bk-copy', 'rs-step1', 'rs-step2', 'rs-code', 'rs-err', 'btn-rs-check', 'rs-sum', 'btn-rs-back', 'btn-rs-yes',
    'off-time', 'off-art', 'off-gems', 'off-xp', 'btn-claim', 'upd-h', 'upd-size', 'upd-notes', 'btn-upd-now', 'btn-upd-later',
    'btn-open-settings', 'upd-progress', 'upd-progress-text', 'upd-progress-fill',
    'm-result', 'res-art', 'res-rb', 'res-h', 'res-floor', 'res-floor-l', 'res-best', 'res-best-txt', 'res-sub', 'res-boss', 'res-time', 'res-hero',
    'res-share', 'res-bar', 'res-legend', 'res-gem-list', 'res-gem-total', 'res-spells-card', 'res-spells', 'res-unlock', 'btn-res-done',
    'res-gold-card', 'res-gold', 'res-gold-total', 'res-combos-card', 'res-combos', 'res-who', 'res-nick', 'res-no', 'set-nick', 'btn-nick', 'set-store', 'set-help',
    'cont-por', 'cont-stage', 'cont-who', 'cont-spells', 'cont-gems', 'cont-main', 'cont-confirm', 'cont-warn', 'btn-cont-go', 'btn-cont-quit', 'btn-cont-no', 'btn-cont-yes',
    'ab-txt', 'btn-ab-yes',
  ]) {
    E[id] = $(id);
    if (!E[id]) throw new Error('ui: #' + id + ' 없음');
  }
  const stage = root.querySelector('#stage');
  const stars = [...E.clear.querySelectorAll('.star')];
  let dg = null; // 던전 특성 화면(dungeonui.js) — showTip 뒤에 만든다

  let view = null, meta = {};
  let rel = null; // 유물·망각 화면(relicui.js) — 아래 카드 선택 절에서 만든다
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
  dg = createDungeonUI({ stage, hudLeft: $('hud-left'), showTip }); // 던전
  on(stage, 'pointerdown', e => { if (!e.target.closest('.ss, .cb, .hero-card, .pc-spark, .st-chip')) hideSpellTip(); });

  // ── 모달 스택 ──
  const stack = []; // { el, prev, onClose }
  let z = 30;
  for (const m of root.querySelectorAll('.modal')) {
    m.querySelector('.k-modal')?.setAttribute('tabindex', '-1');
    if (m.id !== 'm-result' && m.id !== 'm-continue' && m.id !== 'm-name') on(m, 'click', e => { if (e.target === m) closeModal(m.id); });
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
  const nameUI = createNameUI(root, { openModal, closeModal, isOpen }); // 필수 모드는 닫기·뒤로 가기·배경 탭 불가
  const records = createRecordUI(root, { openModal, closeModal }); // v0.1.1 기록 화면(정비 화면 '기록' 탭)
  // 모달 뒤는 조작·포커스 불가. 타이틀·정비 화면이 떠 있으면 전장·하단 패널도 잠금
  function syncInert() {
    const modal = stack.length > 0, cover = !E.title.hidden || camp.isOpen();
    E['stage-wrap'].inert = modal || cover;
    E.panel.inert = modal || cover;
    // 카드 선택 중엔 하단 패널을 잠그되(sim도 거부) '자동 진행'만 살려 둔다 — 고르는 도중에 켜고 끌 수 있게
    const picking = pickOpen || !!rel?.isOpen(); // 유물 3택도 카드처럼 전투 정지
    for (const c of E.controls.children) if (c !== E['btn-autonext']) c.inert = picking;
    E.panel.classList.toggle('dim', picking);
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
    const tot = SKILLS[s.k].cd * (view?.rfx?.[s.k === 'meteor' ? 'meteorCd' : 'freezeCd'] ?? 1); // 유물 인장·심장
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
  on(E['btn-autonext'], 'click', () => {
    const next = !meta.autoNext;
    meta = { ...meta, autoNext: next }; // 다음 update 전에도 바로 반영(카드 링·다음 층 버튼)
    attr(E['btn-autonext'], 'aria-pressed', String(next));
    H.onToggleAutoNext?.(next);
    if (view && !camp.isOpen()) toast(next ? '자동 진행 켜짐 — 다음 층·궁극기·운석·빙결 자동' : '자동 진행 꺼짐 — 다음 층·궁극기·운석·빙결은 직접', next ? 'auto' : 'hero');
  });
  // 4차 배속 해금: 열린 단계만 돈다. 끝(최고 열린 단계)에서 누르면 다음 잠긴 단계를 알려 준다
  on(E['btn-speed'], 'click', () => {
    const cap = meta.speedCap || 1, cur = view ? view.speed : meta.speed;
    if (cap < SPEEDS.length && cur >= cap) toast(`${cap + 1}배속: ${SPEED_UNLOCK[cap + 1]}층 돌파 시 해금`, 'lock');
    H.onSpeed?.();
  });
  function speedUnlocked(n) { // main.js: 최고 기록이 해금 층을 넘은 순간
    toast(`${n}배속 해금! 배속 버튼을 눌러 보세요`, 'speed');
    E['btn-speed'].classList.remove('unlock'); void E['btn-speed'].offsetWidth; E['btn-speed'].classList.add('unlock');
    setTimeout(() => E['btn-speed'].classList.remove('unlock'), 2600);
  }

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
    const idle = ready && !!view?.hero && !ultWorth(view, h); // 닿는 곳에 적이 없으면 흐리게(쓰면 헛방 — 막을 필요는 없다)
    if (heroUlt.idle !== idle) { heroUlt.idle = idle; heroUlt.b.classList.toggle('idle', idle); }
    const label = `${cls.ult.name}, ${down ? '영웅이 쓰러짐' : cool ? `남은 시간 ${sec}초` : idle ? '준비됨 — 주변에 적이 없어요' : ready ? '준비됨' : '전투 중에만 사용'}`;
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
    // 발견한 융합의 진행도: '불꽃 회오리까지: 파이어볼 6/6 · 회오리 3/6'
    const road = fusionProgress(view?.spells || {}, discovered()).filter(l => l.parts.includes(k))
      .map(l => `<span class="tip-fu">${esc(FUSION_BY_KEY[l.key].name)}까지: ${l.parts.map((p, i) => `<span class="nw">${esc(SKILL_BY_KEY[p]?.name || p)} <b>${l.lv[i]}/${l.max}</b></span>`).join(' · ')}</span>`).join('');
    showTip(s.b, f ? '' : 'el-' + d.element, `<b>${esc(d.name)} Lv.${lv}</b>${f ? ` <span class="tip-dim">융합</span>` : ''}<br>${esc(d.desc[lv - 1] || '')}`
      + (f && parts ? `<span class="tip-fu">${parts.map(p => esc(SKILL_BY_KEY[p]?.name || p)).join(' + ')} 합체 — 둘의 효과를 모두 품었어요</span>` : '')
      + road
      + dg.tip(view, k) // 던전: 이 지역 약점·내성
      + mutTipHTML(k, lv, view?.mutations?.[k]) // 변이
      + (lv < SPELL_MAX_LV ? `<small>다음 Lv.${lv + 1}: ${esc(d.desc[lv] || '')}</small>` : '<small>최대 레벨 MAX</small>'), 4600);
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
    else if (prevKey === key && lv > prevLv) {
      s.b.querySelector('.ss-pips').animate(BUMP, bumpOpts);
      if (lv >= SPELL_MAX_LV && prevLv < SPELL_MAX_LV) maxBurst(s);
    }
  }
  // 변이 배지(4차): 칸 왼쪽 위 보석(갈래 A/B · 변이 색) + 넓은 화면 이름 줄 '변이 · 이름'. 새로 변이하면 프리즘 폭발
  function paintMut(s, mk) {
    if (mk) txt(s.lv, '변이 · ' + mutName(mk));
    if (s.mk === mk) return;
    const fresh = !!mk && s.mk == null && s.key && !pendingMerge;
    s.mk = mk;
    if (!s.mb) { s.mb = document.createElement('span'); s.mb.className = 'ss-mut'; s.b.append(s.mb); }
    s.mb.hidden = !mk;
    s.mb.innerHTML = mk ? mutBadgeHTML(mk) : '';
    s.b.classList.toggle('mut', !!mk);
    if (fresh) { s.b.classList.remove('mut-now'); void s.b.offsetWidth; s.b.classList.add('mut-now'); setTimeout(() => s.b.classList.remove('mut-now'), 1400); }
  }
  // 만렙(Lv6) 도달: 칸이 금빛으로 터지고 'MAX!' 도장 한 번(합체로 바로 사라지는 칸은 합체 연출이 대신한다)
  function maxBurst(s) {
    s.b.classList.remove('max-now'); void s.b.offsetWidth; s.b.classList.add('max-now');
    setTimeout(() => s.b.classList.remove('max-now'), 1300);
    const r = relRect(s.orb), tag = document.createElement('div'), wide = stage.classList.contains('wide');
    tag.className = 'max-tag';
    tag.textContent = 'MAX!';
    stage.append(tag);
    const tw = tag.offsetWidth, th = tag.offsetHeight;
    tag.style.left = Math.max(6, Math.min(stage.clientWidth - tw - 6, wide ? r.cx - tw / 2 : r.x - tw - 6)) + 'px';
    tag.style.top = Math.max(6, wide ? r.y - th + 4 : r.cy - th / 2) + 'px';
    tag.animate([{ transform: 'scale(2.4) rotate(-14deg)', opacity: 0 }, { transform: 'scale(1) rotate(-6deg)', opacity: 1, offset: 0.18 }, { transform: 'scale(1) rotate(-6deg)', opacity: 1, offset: 0.78 }, { transform: 'translateY(-12px) rotate(-6deg)', opacity: 0 }],
      { duration: 1500, easing: 'cubic-bezier(.22,1,.36,1)' }).onfinish = () => tag.remove();
  }
  // ── 발견한 융합의 재료 두 칸을 잇는 금빛 연결선(스택 바깥쪽 괄호 모양) — 배치·빌드·도감이 바뀔 때만 다시 ──
  let flinkKey = '';
  function updateFLinks(v) {
    const on1 = v.phase === 'play' || v.phase === 'clear', d = meta.discovered;
    const key = on1 ? `${layoutGen}|${stackKey}|${d?.size ?? d?.length ?? 0}|${seen.size}` : '';
    if (key === flinkKey) return;
    flinkKey = key;
    E.flinks.replaceChildren();
    const links = on1 ? fusionProgress(v.spells || {}, discovered()) : [];
    const used = new Map(); // 같은 칸에서 여러 선이 나가면 괄호를 한 겹씩 바깥으로
    const lim = stage.classList.contains('wide') ? relRect(E.stack).x + 3 : -1e9; // 넓은 화면: 괄호가 '마법서' 유리 패널 밖으로 삐져나가지 않게
    links.forEach(l => {
      const [a, b] = l.parts.map(k => slots.find(x => x.key === k));
      if (!a || !b) return;
      const ra = relRect(a.orb), rb = relRect(b.orb), r = ra.w / 2;
      const depth = Math.max(used.get(a) || 0, used.get(b) || 0);
      used.set(a, depth + 1); used.set(b, depth + 1);
      const p = (l.lv[0] + l.lv[1]) / (2 * l.max);
      let d;
      if (Math.abs(ra.cx - rb.cx) < r) { // 같은 세로줄: 왼쪽(전장 쪽)으로 휜 괄호
        const x = Math.min(ra.cx, rb.cx) - r - 4, bend = Math.max(2, Math.min(10 + depth * 7 + Math.abs(rb.cy - ra.cy) * 0.08, (x - lim) / 0.75));
        d = `M${(ra.cx - r - 1).toFixed(1)} ${ra.cy.toFixed(1)} C${(x - bend).toFixed(1)} ${ra.cy.toFixed(1)} ${(x - bend).toFixed(1)} ${rb.cy.toFixed(1)} ${(rb.cx - r - 1).toFixed(1)} ${rb.cy.toFixed(1)}`;
      } else { // 두 줄(좁은 여백 2열): 마주 보는 가장자리끼리 살짝 휜 선
        const dx = rb.cx - ra.cx, dy = rb.cy - ra.cy, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
        const x1 = ra.cx + ux * (r + 2), y1 = ra.cy + uy * (r + 2), x2 = rb.cx - ux * (r + 2), y2 = rb.cy - uy * (r + 2), bend = 8 + depth * 6;
        d = `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${((x1 + x2) / 2 + uy * bend).toFixed(1)} ${((y1 + y2) / 2 - ux * bend).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
      }
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', l.lv[0] + l.lv[1] >= 2 * l.max - 1 ? 'fl near' : 'fl'); // 한 장만 더 찍으면 합체
      g.style.setProperty('--p', p.toFixed(3));
      for (const cls of ['fl-ink', 'fl-gold', 'fl-flow']) {
        const e = document.createElementNS(SVGNS, 'path');
        e.setAttribute('d', d); e.setAttribute('class', cls);
        g.append(e);
      }
      E.flinks.append(g);
    });
  }
  function updateStack(v) {
    const sp = v.spells || {}, keys = Object.keys(sp);
    const cap = slotCap(v); // 유물 광기의 왕관: 5칸
    const mu = v.mutations || {}; // 변이(칸 배지)
    const key = keys.map(k => k + sp[k] + (mu[k] || '')).join(',') + '|' + cap;
    if (key !== stackKey) {
      stackKey = key;
      slots.forEach((s, i) => { const k = keys[i]; if (s.key !== (k || null) || s.level !== (sp[k] || 0)) paintSlot(s, k, sp[k]); paintMut(s, (k && mu[k]) || null); });
      const n = Math.min(SPELL_SLOTS, keys.length);
      txt(E['stack-count'], `${n}/${cap}`);
      E['stack-count'].parentElement.classList.toggle('full', n >= cap);
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
    dg.slots(v, slots); // 던전: 칸 ▲ 약점 · ▼ 내성
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
  let pendingMerge = null, mergeUntil = 0; // 합체 연출이 끝나는 시각(다음 카드는 그 뒤에 뜬다)
  function captureMerge(ev) { // 스택이 바뀌기 전(같은 프레임 update 앞)에 재료 두 칸의 자리를 기억
    const from = (ev.from || []).map(k => { const s = slots.find(x => x.key === k); return s ? { key: k, r: relRect(s.orb) } : null; }).filter(Boolean);
    pendingMerge = { fusion: ev.fusion, from, full: ev.full !== false };
  }
  function playMerge(pm) {
    const tgt = slots.find(s => s.key === pm.fusion);
    if (!tgt) return;
    const tr = relRect(tgt.orb), cx = tr.cx, cy = tr.cy;
    const wide = stage.classList.contains('wide');
    const mx = wide ? cx : cx - Math.min(110, stage.clientWidth * 0.22), my = wide ? cy - 70 : cy - 30; // 모이는 곳: 전장 쪽 허공
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const T = reduce ? 10 : 820;
    mergeUntil = performance.now() + T + (pm.full ? 900 : 200);
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
      if (free && pm.full) { // '슬롯 해제!'는 꽉 찬 슬롯에서 합체했을 때만(빈 칸이 남아 있으면 의미 없는 말)
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
  const newCollabs = []; // 이번에 켜진 협공(collab 이벤트) — 빛줄기를 다시 그린 뒤 한 번 흐르게
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
    for (const k of newCollabs.splice(0)) procCollab(k); // 방금 켜진 협공: 빛이 한 번 흐른다
  }

  // ── 상태 칩: 부활 결계 · 각성 · 광폭화 경고 ──
  let reviveKey = '', awakenKey = '', berserkKey = '';
  const reviveInfo = v => {
    const meta1 = !!v.fx?.revive, hero1 = !!v.heroUnit?.tb?.cap?.reviveWard, prep1 = !!v.run?.prep?.ward; // prep1 = 출정 준비 '보스 결계석'(shop.js)
    const ready = (meta1 && !v.run?.reviveUsed) || (hero1 && !v.run?.heroRevive) || (prep1 && !v.run.prep.wardUsed);
    return { own: meta1 || hero1 || prep1, ready, n: (meta1 && !v.run?.reviveUsed ? 1 : 0) + (hero1 && !v.run?.heroRevive ? 1 : 0) + (prep1 && !v.run.prep.wardUsed ? 1 : 0),
      boss: prep1 && !v.run.prep.wardUsed };
  };
  on(E['st-revive'], 'click', () => {
    const r = view ? reviveInfo(view) : { ready: false };
    showTip(E['st-revive'], '', r.ready ? `<b>부활 결계 준비됨</b><br>성벽이 무너지는 순간 한 번 되살아나요${r.n > 1 ? ` (${r.n}회)` : ''}.${r.boss ? '<br>보스 결계석: 네임드 보스 층에서 먼저 1회' : ''}` : '<b>부활 결계 사용함</b><br>이번 도전에서는 더 없어요.');
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
    // 광폭화: 전투 중에만(클리어·유물 화면엔 숨김). x1.1 전까지는 'x1.0'(효과 없어 보임) 대신 '광폭화!'
    const bz = v.berserk > 1 && v.phase === 'play' ? 'on|' + (v.berserk >= 10 ? Math.round(v.berserk) : v.berserk < 1.1 ? '!' : v.berserk.toFixed(1))
      : v.phase === 'play' && !v.pick && v.phaseT >= BERSERK_T - BERSERK_WARN ? 'warn|' + Math.ceil(BERSERK_T - v.phaseT) : '';
    if (bz !== berserkKey) {
      const [mode, val] = bz.split('|');
      if (mode === 'on' && !berserkKey.startsWith('on')) E.berserk.animate([{ transform: 'scale(1.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 320, easing: 'cubic-bezier(.3,1.9,.5,1)' });
      berserkKey = bz;
      E.berserk.hidden = !mode;
      E.berserk.classList.toggle('warn', mode === 'warn');
      if (mode) txt(E['berserk-text'], mode === 'on' ? (val === '!' ? '광폭화!' : `광폭화 x${val}`) : `광폭화 ${val}초`); // 4차: 상태 줄에 맞게 짧게
    }
  }

  // ── 4차 전투 상태 한 줄: 콤보 알약(숫자 · 단계 · 남은 시간 게이지) · 광란 · 전설의 학살 (광폭화는 위 updateStatus) ──
  // 단계가 오르는 순간만 캔버스(art/hud.js comboPop)가 0.8초 크게 띄우고, 끝나면 여기 알약이 받아 톡 튄다
  let comboKey = '', frMax = FRENZY.dur, lgMax = LEGEND_T;
  const gauge = (el, u) => { const t = `scaleX(${clamp(u, 0, 1).toFixed(2)})`; if (el.style.transform !== t) el.style.transform = t; };
  function updateCombo(v) {
    const c = v.combo, n = c && c.count >= 3 ? c.count | 0 : 0, t = n ? clamp(c.tier | 0, 0, 4) : 0, k = n + '|' + t;
    if (k !== comboKey) {
      const [pn, pt] = comboKey.split('|').map(Number);
      comboKey = k;
      E.combo.hidden = !n;
      if (n) {
        txt(E['combo-n'], String(n));
        txt(E['combo-t'], t ? COMBO_TIERS[t - 1].label.replace('!', '') : '');
        E.combo.dataset.t = t;
        if (t > (pt || 0)) setTimeout(() => E.combo.animate([{ scale: 1.4, filter: 'brightness(1.8)' }, { scale: 1, filter: 'none' }], { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' }), 760);
        else if (n > (pn || 0)) E.combo.animate([{ scale: 1 }, { scale: 1.08, offset: 0.4 }, { scale: 1 }], { duration: 180 });
      }
    }
    if (n) gauge(E['combo-g'], c.timer / COMBO_WINDOW);
    E['st-frenzy'].hidden = !(v.frenzyT > 0);
    if (v.frenzyT > 0) gauge(E['frenzy-g'], v.frenzyT / (frMax = Math.max(frMax, v.frenzyT))); else frMax = FRENZY.dur;
    E['st-legend'].hidden = !(v.legendT > 0);
    if (v.legendT > 0) gauge(E['legend-g'], v.legendT / (lgMax = Math.max(lgMax, v.legendT))); else lgMax = LEGEND_T;
  }

  // ── 판타지 스킬 카드 선택 오버레이 (스킬 카드 + 각성 카드, 3~5장) ──
  E['pick-cards'].innerHTML = Array.from({ length: MAX_PICK_CARDS }, () =>
    `<button class="pick-card" type="button"><span class="pc-tag" hidden></span>`
    + `<svg class="pc-rec" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="1.5" y="1.5" width="97" height="97" rx="7" ry="5" pathLength="100"/></svg>`
    + `<span class="pc-icowrap"></span><span class="pc-fuse" hidden>${SPARK_ICON}<b>이걸 찍으면 융합!</b><em></em></span><span class="pc-body"><span class="pc-name"></span>`
    + `<span class="pc-pips">${pips(0)}</span><span class="pc-desc"></span><span class="pc-rar"></span></span></button>`).join('');
  let pickCards = null; // 지금 떠 있는 카드(변이 카드의 갈래 판정)
  const pickCardEls = [...E['pick-cards'].children].map((b, i) => {
    on(b, 'click', ev => {
      if (!pickOpen || pickClosing) return;
      const card = pickCards?.[i];
      if (!card?.mutate) { H.onPick?.(i); return; }
      if (b.classList.contains('narrow')) { mutSheet.open(card, i, view ? mutChoice(view, card) : -1); return; } // 좁은 카드: 갈래 글이 잘리니 A/B 시트에서
      const o = ev.target.closest?.('.pm-opt'); // 변이 카드: 누른 갈래(A/B)
      if (o) H.onPick?.(i, +o.dataset.c);
      else if (ev.detail === 0) H.onPick?.(i, mutChoice(view, card)); // 키보드: 추천 갈래
      else b.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 220 }); // 갈래를 누르세요
    });
    const fuse = b.querySelector('.pc-fuse');
    return { b, tag: b.querySelector('.pc-tag'), fuse, fuseTo: fuse.querySelector('em'), ico: b.querySelector('.pc-icowrap'), name: b.querySelector('.pc-name'),
      pips: [...b.querySelectorAll('.pc-pips i')], pipRow: b.querySelector('.pc-pips'), desc: b.querySelector('.pc-desc'), rar: b.querySelector('.pc-rar'),
      rec: b.querySelector('.pc-rec rect'), key: null };
  });
  const mutSheet = createMutSheet(E.pick, (i, c) => { if (pickOpen && !pickClosing) H.onPick?.(i, c); }, k => skillArt(k)); // 4차 FIX: 좁은 화면 변이 A/B 시트
  let pickOpen = false, pickClosing = false, pickResolveTimer = 0, pickRef = null, pickWaitRef = null, pickWaitT = 0, pickRec = -1;
  on(E['pick-reroll'], 'click', () => { if (pickOpen && !pickClosing) H.onReroll?.(); });
  // 카드 화면의 '자동 선택'(자동 진행과 별개, 기본 OFF, 저장됨): 켜면 추천 카드 테두리가 차오르고 PICK_AUTO_T초 뒤 자동 선택
  on(E['pick-auto'], 'click', () => {
    if (!pickOpen || pickClosing) return;
    const next = !meta.settings?.autoPick;
    meta = { ...meta, settings: { ...meta.settings, autoPick: next } }; // 다음 update 전에도 바로 반영
    attr(E['pick-auto'], 'aria-checked', String(next));
    H.onToggleAutoPick?.(next);
  });
  function syncReroll(n) {
    const show = pickOpen && !pickClosing && n > 0;
    if (E['pick-reroll'].hidden === show) E['pick-reroll'].hidden = !show;
    if (show) txt(E['pick-reroll-n'], String(n));
  }
  // 변이 카드(4차): 'Lv6 변이' 띠 + 스킬 그림 + A/B 두 갈래(무엇이 바뀌나). 누른 갈래가 선택, 추천 갈래는 자동 선택 ON일 때 금빛
  function paintMutCard(c, card) {
    const sp = SKILL_BY_KEY[card.spell], tone = skillTone(card.spell);
    c.key = 'mut:' + card.spell;
    c.b.className = `pick-card mutate ${tone.cls} rar-legend`; // 갈래 글이 잘리면 openPick이 'narrow'(누르면 A/B 시트)
    if (tone.style) c.b.setAttribute('style', tone.style); else c.b.removeAttribute('style');
    html(c.ico, skillArt(card.spell));
    txt(c.name, sp.name);
    c.pipRow.hidden = true;
    c.desc._t = undefined;
    html(c.desc, mutOptionsHTML(card, view ? mutChoice(view, card) : 0));
    c.desc.classList.add('pm');
    c.desc.classList.remove('long');
    txt(c.rar, '변이');
    c.tag.hidden = false; c.tag.className = 'pc-tag mut'; txt(c.tag, 'Lv6 변이');
    c.fuse.hidden = true;
    c.b.setAttribute('aria-label', mutCardLabel(card));
  }
  function openPick(pick) {
    clearTimeout(pickResolveTimer);
    mutSheet.close();
    pickOpen = true; pickClosing = false;
    pickCards = pick.cards; // 변이 카드 갈래 판정
    hideSpellTip();
    const n = pick.cards.length;
    // 머리글: 도전 시작 무료 카드 · 칸이 다 찼으면 '강화만'
    const used = Object.keys(view?.spells || {}).length, cap = view ? slotCap(view) : SPELL_SLOTS, full = used >= cap; // 유물 왕관이면 5칸
    // 1층 처치 0에서 뜨는 (무료 카드 아닌) 카드 = 영웅 Lv30 보너스 카드 — 마나를 모으기 전이라 '마나 폭주'가 아니다
    const gift = !pick.starter && view?.stage === 1 && !(view?.progress?.killed > 0);
    txt(E.pick.querySelector('.pick-ribbon'), pick.starter ? '출정의 축복!' : gift ? '영웅의 선물!' : full ? `스킬 칸 ${used}/${cap}` : '마나 폭주!');
    txt(E['pick-h'], pick.starter ? '첫 마법을 고르세요' : gift ? '영웅 Lv30 보너스 카드' : full ? '스킬을 강화하세요' : '스킬을 고르세요');
    E['pick-cards'].classList.toggle('four', n === 4); // 4장 = 2×2, 5장 = 3 + 2
    E['pick-cards'].classList.toggle('five', n >= 5);
    const narrowPick = n >= 4 && innerWidth < 480; // 폰 4~5장: 카드가 좁아 강화 수치는 2줄까지
    pickCardEls.forEach((c, i) => {
      c.b.classList.remove('in', 'chosen', 'faded');
      if (i >= n) { c.b.hidden = true; c.key = null; return; }
      c.b.hidden = false;
      const card = pick.cards[i];
      c.desc.classList.remove('pm', 'pu'); // 변이 갈래 · 강화 수치 줄(아래에서 다시)
      dg.card(c.b, card.awaken ? null : card.spell, view); // 던전: '약점!'·'내성' 배지(변이 카드도 — 그 칸의 옛 배지가 남지 않게)
      if (card.mutate) { paintMutCard(c, card); return; } // 변이 카드(4차)
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
        c.fuse.hidden = true;
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
      const from = card.from ?? card.level - 1; // 지금 레벨(0 = 새 스킬) — 쌍둥이 달·따라잡기는 한 장에 2레벨
      c.pips.forEach((p, pi) => { p.classList.toggle('on', pi < card.level); p.classList.toggle('nx', pi >= from && pi < card.level); });
      const dsc = sp.desc[card.level - 1] || '';
      const up = from > 0 ? upgradeHTML(card.spell, card.level, from, narrowPick ? 2 : 3) : ''; // 강화: '마력 240% → 310%' 수치 줄(+ Lv6 완전체·변이 해금) — 좁은 화면 4~5장이면 2줄
      if (up) { c.desc._t = undefined; html(c.desc, up); c.desc.classList.add('pu'); } else { c.desc._h = undefined; txt(c.desc, dsc); }
      c.desc.classList.toggle('long', !up && dsc.length > 30); // 고정 칸에 맞춰 한 단계 작게
      txt(c.rar, ({ common: '일반', rare: '희귀', legend: '전설' }[card.rarity] || '일반') + (card.catchUp ? ' · 따라잡기 +1' : '')); // 20층 뒤 Lv3 미만 = 한 장에 +1레벨 더
      c.tag.hidden = false;
      if (from > 0) { c.tag.className = fu ? 'pc-tag up fu' : 'pc-tag up'; txt(c.tag, `${fu ? '융합 ' : ''}Lv${from} → ${card.level >= SPELL_MAX_LV ? 'MAX' : card.level}`); }
      else { c.tag.className = 'pc-tag'; txt(c.tag, card.level > 1 ? `NEW Lv${card.level}` : 'NEW'); }
      // ✦ 이 카드로 합체가 완성된다(sim fusionHint). 발견한 융합이면 이름까지, 미발견이면 짝 조건을 숨긴 채 '???'
      const fz = card.fusionHint ? fusionOf(view?.spells || {}, card.spell, card.level) : null;
      const fzName = fz && discovered().has(fz.key) ? fz.name : '';
      c.fuse.hidden = !card.fusionHint;
      c.b.classList.toggle('will-fuse', !!card.fusionHint);
      const lost = fz && Object.keys(view?.mutations || {}).some(k => fz.groups.some(gr => gr.includes(k))); // 변이한 재료는 합체하면 변이가 사라진다
      if (card.fusionHint) txt(c.fuseTo, (fzName ? `→ ${fzName}` : '→ ???') + (lost ? ' · 변이 소멸' : ''));
      c.b.setAttribute('aria-label', `${sp.name}, ${from > 0 ? `Lv${from} → ${card.level} 강화` : `새 스킬${card.level > 1 ? ' Lv' + card.level : ''}`}${card.level >= SPELL_MAX_LV ? ' (최대 레벨)' : ''}. ${dsc}${card.fusionHint ? `. 이걸 찍으면 융합${fzName ? ': ' + fzName : ''}!` : ''}`);
    });
    // 추천 카드(자동 선택이 고를 카드 = sim tickPick과 같은 bot.pickCard) — 자동 선택 ON일 때 테두리가 차오른다
    pickRec = view ? pickCard(view, pick.cards) : 0;
    pickCardEls.forEach((c, i) => c.b.classList.toggle('rec', i === pickRec));
    pickMode = '';
    void E['pick-cards'].offsetWidth; // 등장 애니메이션 재시작(rar-legend 후광 포함)
    pickCardEls.forEach((c, i) => { if (i < n) setTimeout(() => c.b.classList.add('in'), 90 * i); });
    syncPickRing(pick);
    E.pick.hidden = false;
    fitPickDescs(n);
    // 변이 카드의 갈래 설명이 잘리면(폰 · 카드 4~5장) 'narrow': 갈래 이름만 보이고, 누르면 A/B 시트에서 전문을 보고 고른다
    for (let i = 0; i < n; i++) {
      const c = pickCardEls[i];
      if (!pick.cards[i].mutate) continue;
      c.b.classList.toggle('narrow', [...c.desc.querySelectorAll('.pm-short')].some(e => e.scrollHeight > e.clientHeight + 1));
    }
    syncInert();
    pickCardEls[0].b.focus?.({ preventScroll: true });
  }
  // 고정 설명 칸에 글이 넘치면 글자를 반 px씩 줄인다(줄 수 제한으로 마지막 줄이 반만 잘려 한글이 부서져 보이던 문제).
  // 가장 작게 해도 넘치면 칸에 온전히 들어가는 줄 수까지만(반쪽 줄 없음)
  function fitPickDescs(n) {
    const over = d => d.scrollHeight > d.clientHeight + 1;
    for (let i = 0; i < n; i++) {
      const d = pickCardEls[i].desc, full = d.textContent;
      if (d.classList.contains('pm')) continue; // 변이 갈래는 제 칸 모양(CSS)
      d.style.fontSize = ''; d.style.webkitLineClamp = 'unset'; d.style.flex = '';
      const fs0 = parseFloat(getComputedStyle(d).fontSize) || 12;
      const shrink = () => { let fs = fs0; d.style.fontSize = ''; while (over(d) && fs > 9.5) { fs -= 0.5; d.style.fontSize = fs + 'px'; } };
      shrink();
      if (d.classList.contains('pu')) { // 강화 수치 줄: 넘치면 마지막 수치 줄부터 뺀다(만렙 'Lv6 완전체' 줄은 남김)
        d._h = undefined; // 줄을 지웠으니 다음 html()이 다시 그리게
        for (let ls = d.querySelectorAll('.pu-l'); over(d) && ls.length > (d.querySelector('.pu-max') ? 0 : 1); ls = d.querySelectorAll('.pu-l')) ls[ls.length - 1].remove();
        continue;
      }
      const cut = full.indexOf(' — '); // 지원 사격 꼬리말('— 영웅이 싸우는 적을 먼저 노린다')은 자리가 모자라면 뺀다(툴팁·aria엔 그대로)
      if (over(d) && cut > 0) { d.textContent = full.slice(0, cut); shrink(); }
      if (over(d)) { // 그래도 넘치면 온전히 들어가는 줄 수까지만 — 칸도 그 높이로 줄여 잘린 반쪽 줄이 보이지 않게
        const cs = getComputedStyle(d), lh = parseFloat(cs.lineHeight) || fs0 * 1.25;
        d.style.webkitLineClamp = String(Math.max(1, Math.floor((d.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / lh)));
        d.style.flex = '0 1 auto';
      }
    }
  }
  // 카드는 기본적으로 직접 고른다(자동 진행과 무관): 링 없이 '전투 정지 — 천천히 고르세요'.
  // 카드 화면 '자동 선택' ON이면 카운트다운 링 + 추천 카드 테두리가 차오르고 PICK_AUTO_T초 뒤 그 카드(탭하면 직접 고른 게 우선)
  let pickMode = '';
  function syncPickRing(pick) {
    const has = pick.autoLeft != null, mode = has ? 'auto' : 'manual';
    if (mode !== pickMode) {
      pickMode = mode;
      E['pick-ring'].hidden = !has;
      E.pick.classList.toggle('manual', !has);
      attr(E['pick-auto'], 'aria-checked', String(has));
      const ico = E['pick-sub'].querySelector('.ps-ico');
      ico.hidden = has;
      if (!ico.firstChild) ico.innerHTML = PAUSE_ICON;
      txt(E['pick-sub'].querySelector('.ps-txt'), has ? '추천 카드 자동 선택 · 탭하면 직접' : '전투 정지 — 천천히 고르세요');
      if (has && pickOpen) E['pick-ring'].animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 300, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    }
    const f = has ? 1 - Math.max(0, Math.min(1, pick.autoLeft / PICK_AUTO_T)) : 0; // 0 → 1로 차오름
    const rc = pickCardEls[pickRec];
    if (rc && rc.fill !== f) { rc.fill = f; rc.rec.style.strokeDashoffset = String(100 * (1 - f)); }
    if (!has) return;
    const left = Math.max(0, pick.autoLeft);
    E['pick-ring-fg'].style.strokeDashoffset = String(PICK_RING_C * f);
    txt(E['pick-ring-n'], String(Math.max(1, Math.ceil(left))));
  }
  function resolvePick(ev) {
    if (!pickOpen || pickClosing) return;
    pickClosing = true;
    mutSheet.close();
    const key = ev.mutate ? 'mut:' + ev.spell : ev.spell || 'aw:' + ev.awaken; // 변이 카드 = 'mut:스킬'
    let chosen = null;
    for (const c of pickCardEls) {
      if (c.b.hidden) continue;
      if (c.key === key && !chosen) { chosen = c; c.b.classList.add('chosen'); } else c.b.classList.add('faded');
    }
    if (chosen && ev.mutate) chosen.desc.querySelector(`[data-m="${ev.mutate}"]`)?.classList.add('chosen'); // 고른 갈래
    clearTimeout(pickResolveTimer);
    pickResolveTimer = setTimeout(hidePick, 380);
  }
  function hidePick() {
    E.pick.hidden = true;
    E['pick-ring'].hidden = true;
    pickMode = '';
    pickOpen = false; pickClosing = false;
    syncInert();
  }

  // ── 유물 3택 · 망각(비우기) · 유물 줄 · 결과 화면 유물 (relicui.js) ──
  rel = createRelicUI(root, { onRelic: i => H.onRelic?.(i), onForget: k => H.onForget?.(k), showTip, toast, sync: () => syncInert() });

  // ── 정비 화면 ──
  const camp = createCamp(root, {
    onCampAct: a => H.onCampAct?.(a), // 장비 상자는 결과 객체를 돌려준다(shopui.js 개봉 연출)
    onBuyMeta: k => !!H.onBuyMeta?.(k),
    onStartRun: lo => H.onStartRun?.(lo),
    onOpenHero: o => H.onOpenHero?.(o),
    onOpenCodex: () => openCodex(),
    onOpenRecords: m => records.open(m), // m = 정비 화면이 보고 있는 저장 객체(history · lifetime)
    onOpenSettings: () => openSettings(),
    codexNew: () => fresh.size > 0,
    toast: (m, i) => toast(m, i),
  });
  function showCamp(m) {
    hideTitle();
    hideClear(); E.defeat.hidden = true;
    if (pickOpen) hidePick();
    rel.hide();
    camp.show(m);
    syncInert();
  }
  function hideCamp() { camp.hide(); syncInert(); }

  // ── 타이틀 ──
  let titleRun = null, titleHero = null, contTimer = 0;
  on(E['btn-start'], 'click', () => (titleRun ? showContinue(titleRun, titleHero) : H.onStart?.()));
  let titleArt = false;
  function paintTitle() { // 전장 스프라이트를 구워 그대로 쓴다(영웅 + 성벽 위 대마법사) — 한 번만
    if (titleArt) return;
    titleArt = true;
    const q = sel => E.title.querySelector(sel);
    q('.t-hero').src = heroPortraitURL('knight', 3, { weapon: 'epic', armor: 'rare', helm: 'rare', cape: 'legend' }, 420);
    q('.t-mage').src = magePortraitURL(0, 3, 420);
    [['slime', '.f1'], ['goblin', '.f2'], ['skeleton', '.f3'], ['imp', '.f4']].forEach(([t, c]) => { q('.t-foes ' + c).src = enemyURL(t, 18, 120); });
  }
  function showTitle({ best = 0, run = null, hero = null } = {}) {
    try { paintTitle(); } catch (e) { console.warn(e); }
    titleRun = run; titleHero = hero;
    txt(E['btn-start'].querySelector('.b-main'), run ? '이어하기' : '시작하기');
    syncTeaser();
    txt(E['start-sub'], run ? `${run.stage}층 · ${HERO_CLASSES[run.loadout?.cls]?.name || '도전 중'}` : best > 0 ? `최고 기록 ${best}층` : '100층 탑에 도전!');
    hideClear(); E.defeat.hidden = true;
    camp.hide();
    E.title.hidden = false;
    syncInert();
    clearTimeout(contTimer);
    if (run) contTimer = setTimeout(() => { if (!E.title.hidden && !stack.length) showContinue(run, hero); }, 700);
  }
  // v0.1.2: 환영 선물을 아직 안 봤으면 시작 버튼에 새 기능 예고 리본(css/summon.css) — 부팅 땐 meta가 첫 update에 오므로 update에서도 부른다
  function syncTeaser() {
    const on = !!(meta?.summon && giftPending(meta)), b = E['btn-start'];
    if (b._tz === on) return;
    b._tz = on;
    b.querySelector('.sm-teaser')?.remove();
    if (on) b.insertAdjacentHTML('beforeend', '<span class="sm-teaser" aria-hidden="true">NEW 외형 소환</span>');
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
    const mu = run.mutations || {};
    E['cont-spells'].innerHTML = (sp.length ? sp.map(([k, lv]) => skillChip(k, lv, 'cont-sp').replace(/<\/span>$/, `${mu[k] ? mutBadgeHTML(mu[k]) : ''}</span>`)).join('') // 변이 갈래 보석
      : '<span class="cont-none">아직 고른 스킬이 없어요</span>') + (run.relicPick ? '<span class="cont-relic">유물 선택 대기 중</span>' : '');
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
  // 클리어 화면이 떠 있는 동안 자동 진행을 바꾸면 '다음 층' 버튼도 바로 따라간다
  function syncClearWait(v) {
    if (v.phase !== 'clear' || v.run?.over) return;
    const wait = !meta.autoNext;
    if (E.clear.hidden) { // 패널이 이미 자동으로 닫힌 뒤 자동 진행을 끄면 '다음 층' 버튼과 함께 다시 띄운다(버튼 없는 빈 전장 방지)
      if (wait && clearDueAt <= performance.now()) showClear(v);
      return;
    }
    if (wait === clearWait) return;
    clearWait = wait;
    E['btn-next'].hidden = !wait;
    clearTimeout(clearTimer);
    if (!wait) clearTimer = setTimeout(hideClear, 1200);
  }

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
    rel.hide();
    renderResult(sum, game);
    rel.renderResult(sum);
    resultTickets(E['m-result'].querySelector('.res-gems'), sum.tickets); // v0.1.2 획득 소환권
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
    E['res-who'].hidden = !sum.name; // 〈닉네임〉의 N번째 도전(이름은 textContent로만)
    txt(E['res-nick'], sum.name || '');
    txt(E['res-no'], `〉의 ${sum.runNo | 0}번째 도전`);
    E['res-floor'].dataset.text = '0';
    countUp(E['res-floor'], sum.floorsCleared | 0, 900, v => { E['res-floor'].dataset.text = v; });
    txt(E['res-floor-l'], '층 돌파');
    E['res-best'].hidden = !nb;
    if (nb) txt(E['res-best-txt'], `최고 기록 ${sum.prevBest}층 → ${sum.best}층`);
    txt(E['res-sub'], win ? '종말의 드래곤이 쓰러졌어요! 성벽은 끝까지 버텼습니다.'
      : !sum.abandoned && sum.stageReached > (sum.floorsCleared | 0) ? `${sum.stageReached}층에서 성벽이 무너졌어요. 강해져서 다시 도전!` : sum.abandoned ? `${sum.stageReached}층에서 도전을 마쳤어요.` : '도전을 마쳤어요.');
    txt(E['res-boss'], String(sum.bossesKilled | 0));
    txt(E['res-time'], fmtTime(sum.time));
    // 피해 비중: game.dmgDone = [마법사, (협동 모드 자리), 영웅(소환물 포함)] — 솔로는 마법사 + 영웅 둘
    const d = game?.dmgDone || [0, 0, 0], mage = (d[0] || 0) + (d[1] || 0), tot = mage + (d[2] || 0);
    E['res-share'].hidden = !(tot > 0);
    txt(E['res-hero'], tot > 0 && d[2] > 0 ? Math.round(d[2] / tot * 100) + '%' : '-');
    if (tot > 0) {
      const parts = [['me', '대마법사(나)', mage], ['hero', `영웅(${HERO_CLASSES[cls]?.name || ''})`, d[2] || 0]];
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
    E['res-spells'].innerHTML = sp.map(([k, lv]) => { const s = SKILL_BY_KEY[k], t = skillTone(k); const mk = sum.mutations?.[k]; return s ? `<span class="res-sp ${t.cls}" style="${t.style}"><span class="res-sp-art">${skillArt(k)}${mk ? mutBadgeHTML(mk) : ''}</span><span class="res-sp-name">${esc(s.name)}</span>${mk ? `<span class="res-sp-mut">${esc(mutName(mk))}</span>` : ''}<span class="sc-pips">${pips(lv)}</span></span>` : ''; }).join(''); // 변이: 갈래 보석 + 이름
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
  E['codex-list-fusion'].innerHTML = '<li class="codex-note">재료 두 스킬을 모두 <b>Lv6</b>까지 찍으면 <b>융합 스킬 Lv1</b>로 합체하고 칸이 하나 열려요</li>' + FUSION_LIST.map(s => `<li class="syn-card fusion" data-key="${s.key}"><div class="syn-ico fusion-ico" aria-hidden="true"></div>`
    + '<div class="syn-body"><div class="syn-name"></div><div class="syn-text"></div></div>'
    + '<span class="syn-tag fusion"></span><span class="syn-new" hidden>NEW</span></li>').join('');
  E['codex-list-collab'].innerHTML = COLLAB_LIST.map(s => `<li class="syn-card collab" data-key="${s.key}" style="--cc:${CLS_INFO[s.cls]?.col || '#ffc92e'}"><div class="syn-ico collab-ico" aria-hidden="true"></div>`
    + '<div class="syn-body"><div class="syn-name"></div><div class="syn-who"></div><div class="syn-text"></div></div>'
    + '<span class="syn-tag collab"></span><span class="syn-new" hidden>NEW</span></li>').join('');
  const mkCards = (list, host) => [...host.querySelectorAll('.syn-card')].map((li, i) => ({
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
    let nh = 0, nf = 0, nc = 0;
    for (const c of cards) if (renderCodexCard(c, d)) nh++;
    for (const c of fusionCards) if (renderCodexCard(c, d)) nf++;
    for (const c of collabCards) if (renderCodexCard(c, d)) nc++;
    const n = nh + nf + nc;
    // 세 탭 모두 같은 규칙으로 발견 수(0이면 이름만)
    txt(E['ctab-hidden'], nh ? `히든 조합 ${nh}` : '히든 조합');
    txt(E['ctab-fusion'], nf ? `원소 융합 ${nf}` : '원소 융합');
    txt(E['ctab-collab'], nc ? `협공 ${nc}` : '협공');
    txt(E['codex-count'], `${n}/${CODEX_SYN.length} 발견`);
    prop(E['codex-fill'], '--p', frac(n / CODEX_SYN.length));
  }
  function setCodexTab(t) {
    codexTab = t;
    E['codex-list'].hidden = t !== 'hidden';
    E['codex-list-fusion'].hidden = t !== 'fusion';
    E['codex-list-collab'].hidden = t !== 'collab';
    attr(E['ctab-hidden'], 'aria-selected', String(t === 'hidden'));
    attr(E['ctab-fusion'], 'aria-selected', String(t === 'fusion'));
    attr(E['ctab-collab'], 'aria-selected', String(t === 'collab'));
    cosList.hidden = t !== 'cos'; attr(cosTab, 'aria-selected', String(t === 'cos')); // v0.1.2 외형 탭
    root.querySelector('#m-codex .codex-top').style.display = t === 'cos' ? 'none' : ''; txt(root.querySelector('#codex-h'), t === 'cos' ? '외형 도감' : '조합 도감'); // v0.1.2: 외형 탭은 자기 수집 막대만
    if (t === 'cos') renderCosmeticCodex(cosList);
  }
  // v0.1.2 도감 '외형' 탭(summonui.js — 수집률 + 외형 격자, 누르면 상세)
  E['ctab-collab'].insertAdjacentHTML('afterend', '<button class="k-tab" role="tab" id="ctab-cos" aria-selected="false" data-tab="cos">외형</button>');
  E['codex-list-collab'].insertAdjacentHTML('afterend', '<div id="codex-list-cos" class="sh-body" role="tabpanel" hidden></div>');
  const cosTab = root.querySelector('#ctab-cos'), cosList = root.querySelector('#codex-list-cos');
  on(cosTab, 'click', () => setCodexTab('cos'));
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
    txt(E['set-nick'], meta.profile?.name || '');
    // v0.1.1 저장 보호: 웹은 영구 저장소 요청 결과(main.js protectStorage), APK는 앱 저장소. 웹에서 못 받았으면 백업 안내를 조금 더 강조(팝업 없음)
    const on = !meta.native && s.storage === 'on', weak = !meta.native && (s.storage === 'off' || s.storage === 'na');
    txt(E['set-store'], meta.native ? '앱 저장소' : on ? '켜짐' : '브라우저 기본');
    E['set-store'].classList.toggle('on', on || !!meta.native);
    E['set-help'].classList.toggle('warn', weak);
    txt(E['set-help'], weak ? '이 브라우저는 저장 공간이 부족하면 기록을 지울 수 있어요. 백업 코드를 메모에 꼭 보관해 두세요 — 기기를 바꿔도(안드로이드 ↔ 아이폰) 이어서 할 수 있어요.'
      : '앱을 지우거나 기기를 바꾸면(안드로이드 ↔ 아이폰) 기록이 사라져요. 백업 코드를 메모에 보관해 두면 어디서든 이어서 할 수 있어요.');
  }
  on(E['btn-nick'], 'click', () => nameUI.ask({ current: meta.profile?.name }, n => {
    H.onRename?.(n);
    renderSettings();
    toast('이름을 바꿨어요', 'check');
  }));
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
        <span>${icon('codex')}도감 · 도전</span><b class="k-num">${codexFound(p.discovered)}/${CODEX_SYN.length} · ${p.runs | 0}회</b>
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
  function showOfflineReward({ gems = 0, gold = 0, xp = 0, minutes = 0 } = {}, onClaim) {
    const h = Math.floor(minutes / 60), m = minutes % 60;
    const capped = minutes >= OFFLINE_CAP_HOURS * 60 ? ' (최대)' : '';
    txt(E['off-time'], `${h ? h + '시간 ' : ''}${m ? m + '분' : ''}${capped} 동안 황금 곡괭이가 보석과 골드를 캐고, 영웅은 수련했어요!`);
    if (!E['off-art'].firstChild) E['off-art'].innerHTML = emblemImg('treasure');
    E['off-gems'].textContent = '0';
    countUp(E['off-gems'], gems, 900);
    txt(E['off-xp'], '+' + fmt(xp));
    const og = document.getElementById('off-gold'); // 방치 골드(4차 경제, shop.js offlineGoldPerHour)
    if (og) { og.textContent = '+' + fmt(gold); og.parentElement.hidden = !(gold > 0); }
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
  function update(v, m = {}) {
    meta = m || {};
    if (stage.clientWidth !== layW || stage.clientHeight !== layH) layout(); // 관찰자·resize 이벤트를 놓친 크기 변경(가려진 웹뷰 등) 보정
    if (meta.version) setVersion(meta.version);
    if (!E.title.hidden) syncTeaser(); // v0.1.2
    if (isOpen('m-settings')) renderSettings();
    if (isOpen('m-codex') && discovered().size !== codexCount) renderCodex();
    if (camp.isOpen()) camp.refresh();
    if (!v) return;
    view = v;
    const me = v.players[0];

    txt(E['stage-no'], v.stage + '층');
    txt(E['theme-name'], THEMES[v.theme]?.name ?? '');
    const tot = v.progress.total, k = Math.min(v.progress.killed, tot);
    const pf = frac(tot > 0 ? k / tot : 0);
    attr(E.wave, 'aria-valuenow', String(Math.round(pf * 100)));
    prop(E.wave, '--p', pf);
    txt(E['wave-text'], `${k}/${tot}`);
    if (v.mana) updateMana(v);
    updateStack(v);
    dg.update(v, pickOpen || !!v.relicPick || stack.length > 0); // 던전: 지역 칩 · 지역 시작 배너
    if (pendingMerge) { const pm = pendingMerge; pendingMerge = null; playMerge(pm); }
    updateFLinks(v);
    updateStatus(v);
    updateCombo(v); // 4차 상태 줄
    stage.classList.toggle('boss-on', !!v.boss);
    if (v.pick) {
      if (pickRef !== v.pick) {
        // 보스 WARNING·컷인이 끝난 뒤 카드가 뜨게 잠깐 기다린다(최대 4초)
        const now = performance.now();
        if (pickWaitRef !== v.pick) { pickWaitRef = v.pick; pickWaitT = now; }
        if ((momentLeft() <= 0.15 && now >= mergeUntil) || now - pickWaitT > 4000) { pickRef = v.pick; openPick(v.pick); } // 합체 연출('슬롯 해제!')이 끝난 뒤에
      } else syncPickRing(v.pick);
    } else { pickRef = null; pickWaitRef = null; if (pickOpen && !pickClosing) hidePick(); } // 이벤트 없이 사라진 경우(클리어·패배) 즉시 닫음
    syncReroll(v.pick?.cards?.fixed ? 0 : v.rerollLeft | 0); // 새로 뽑아도 같은 카드면 버튼 숨김
    rel.update(v); // 유물 3택 · 유물 줄 · 비우기 버튼 · 봉인
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
    attr(E['btn-autonext'], 'aria-pressed', String(!!meta.autoNext));
    syncClearWait(v);
    txt(E['speed-text'], v.speed + 'x');
    const cap = meta.speedCap || 1, lockTxt = cap < SPEEDS.length ? `${cap + 1}x` : ''; // 다음 잠긴 단계(없으면 숨김)
    if (E['speed-lock'].hidden !== !lockTxt) E['speed-lock'].hidden = !lockTxt;
    if (lockTxt && E['speed-lock'].firstChild.nodeValue !== lockTxt + ' ') E['speed-lock'].firstChild.nodeValue = lockTxt + ' ';

    updateHeroCard(v.heroUnit, v.hero);
    updateHeroUlt(v.heroUnit);
    updateCollabs(v);
    updateLink(v);
    updateBeams(v);

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
    rel.onEvents(events, v); // 유물 획득·발동·망각 알림
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
        case 'defeat': clearTimeout(clearDelay); E.toasts.replaceChildren(); showDefeat(ev.stage ?? v.stage); break; // 패배 도장 위에 남은 알림은 치운다
        case 'fusionMerge': captureMerge(ev); break;
        case 'cast': if (ev.o === 0 && !ev.basic) flashSlot(slotOf(v, ev.spell), !!ev.linked); break;
        case 'linkFinish': flashSlot(slotOf(v, ev.spell), true); break;
        case 'collabProc': procCollab(ev.key); break;
        case 'collab': newCollabs.push(ev.key); break;
        case 'spellPick': manaSpent = v.stage; resolvePick(ev); break;
        case 'revive':
          if (!ev.relic) toast(ev.hero ? '부활 결계 강화 발동! 성벽 40% 회복' : ev.prep ? '보스 결계석 발동! 성벽 50% 회복' : '부활 결계 발동! 성벽 50% 회복', 'wall'); // 불사조 깃털은 relicui가 알린다
          E['st-revive'].animate([{ transform: 'scale(1.5)', filter: 'brightness(2)' }, { transform: 'scale(1)', filter: 'none' }], { duration: 600, easing: 'ease-out' });
          break;
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
    return stack.length > 0 || !E.defeat.hidden || !E.clear.hidden || pickOpen || rel.isOpen() || camp.isOpen();
  }

  // 안드로이드 뒤로가기: 처리했으면 true. 카드 선택·유물 3택은 삼킨다(선택을 피할 수 없게). 이어하기 창은 false(두 번 눌러 종료)
  function handleBack() {
    if (mutSheet.isOpen()) { mutSheet.close(); return true; } // 변이 A/B 시트
    if (rel.handleBack()) return true; // 비우기 시트 닫기 · 유물 3택은 삼킨다
    if (pickOpen) return true;
    if (stack.length) {
      const top = stack[stack.length - 1].el.id;
      if (top === 'm-result') { E['btn-res-done'].click(); return true; }
      if (top === 'm-continue') { // 포기 확인 중이면 되돌리기, 아니면 앱의 첫 화면 → main.js의 '한 번 더 누르면 종료'로
        if (!E['cont-confirm'].hidden) { E['btn-cont-no'].click(); return true; }
        return false;
      }
      if (top === 'm-name') return nameUI.handleBack();
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
    askName: (o, cb) => nameUI.ask(o, cb), // 4차 닉네임: { required, current }, 확인 시 cb(name)
    showTitle, hideTitle, showContinue, showCamp, hideCamp, isCampOpen: () => camp.isOpen(), refreshCamp: () => camp.refresh(),
    showResult, update, onEvents, toast, speedUnlocked, showOfflineReward, isBusy, handleBack, isPickShown: () => pickOpen && !pickClosing && !rel.forgetOpen() && !mutSheet.isOpen(), // 비우기·변이 시트가 열린 동안 자동 선택 카운트다운 멈춤
    isRelicShown: () => rel.isOpen(),
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

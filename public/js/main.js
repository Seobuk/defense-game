// 부팅 · 게임 루프 · 저장/업데이트 배선 — 로그라이트: 타이틀 → (이어하기 | 정비) → 도전 → 결과 → 정비 (docs/DESIGN.md '로그라이트 구현 계약')
// 솔로: 성벽 위 마법사는 나 한 명(players[1]은 협동 모드 자리 — 잠들어 있다)
import { startStage, step, act, drainEvents, tickPick, refreshFusion, reofferPick } from './sim.js';
import { tickRelic } from './relics.js'; // 4차 유물: 카드 '자동 선택' ON이면 유물도 자동
import { DT, speedCap, nextSpeed, SPEED_UNLOCK, SPELL_KEYS, SPELL_MAX_LV, SYNERGIES, WALL_Y, WORLD_W, MAX_STAGE } from './config.js';
import { MAX_HERO_LV, RARITY_KEYS, rollItem, addToBag } from './hero.js';
import { newRun, restoreRun, endRun, applyOffline, campAct, buyMeta } from './run.js';
import { createRenderer, fontsReady } from './render.js';
import { simSlow } from './art/hud.js';
import { createUI } from './ui.js';
import { createHeroUI } from './heroui.js';
import { createAudio } from './audio.js';
import * as store from './save.js';
import * as updater from './updater.js';
import * as pwa from './pwa.js';
import { gemStoreHandleBack } from './gemstoreui.js'; // v0.1.2 보석 충전(결제 미연결)
import { initSummonUI, summonHandleBack, openWardrobe, syncLoadout } from './summonui.js'; // v0.1.2 소환의 제단 · 옷장(자기 전체 화면 층)
import { GFX, autoStart, createGovernor } from './gfx.js'; // 설정 '그래픽'(발열·배터리)
import { createAwake, wantAwake } from './awake.js'; // 설정 '화면 꺼짐 방지'

const HITSTOP_CAP = 500;          // ms
const HITSTOP_SCALE = [1, 0.75, 0.5]; // 배속별 히트스톱 축소
const NEXT_DELAY = 3900;          // 클리어 후 자동 진행까지(ms) — 보상 패널을 볼 최소 시간
const SAVE_EVERY = 3000;
const MAX_STEPS = 8;              // 한 프레임 최대 시뮬 스텝(넘는 시간은 버림): 느린 폰의 3배속이 '느린 프레임 → 더 많은 스텝 → 더 느린 프레임'으로
                                  // 달아오르지 않게 — 3배속은 22fps 까지(절전 30fps = 6스텝) 제 속도, 그보다 느리면 조금 느리게 돈다(전투 규칙은 그대로)
const IDLE_MS = 250;              // 전장이 없는 화면(타이틀·정비·결과): 4Hz 로만 갱신(입력이 오면 바로 — wake)
const STILL_MS = 100;             // 멈춘 전투(카드·메뉴·영웅 화면·도장·결과): 전장 그림은 멈추고 UI 만 10Hz
const SETTLE_MS = 800;            // 멈춘 뒤 이만큼은 계속 그린다(카드 뒤 어둡게·패배 회색이 다 깔리게) → 그 뒤 마지막 그림 그대로
const HUD_H = 90;                 // 전장 탭 무시: 월드 y < 90 은 상단 HUD
// 카드가 네임드 보스 등장 배너·운석 착탄을 덮지 않게: 그동안 전투는 계속 돌고 카드는 뒤에 뜬다
const PICK_HOLD_BOSS = 1800, PICK_HOLD_METEOR = 800, PICK_HOLD_ULT = 1400; // 궁극기·합동 필살 연출을 카드가 가리지 않게
const FUSION_KEYS = new Set(SYNERGIES.filter(s => s.kind === 'fusion').map(s => s.key));

const native = updater.isNative();
let appTag = native ? 'apk' : 'web'; // 도전 기록의 app(버전을 알면 '0.1.1-web')
// ponytail: UA 버전으로 판별(HTML 글자 paint-order 지원 여부를 직접 재는 방법이 없다). Chrome 123부터 지원
if (+(/Chrome\/(\d+)/.exec(navigator.userAgent)?.[1] || 999) < 123) document.documentElement.classList.add('no-po');
const App = window.Capacitor?.Plugins?.App;

let data = store.load();
// 4차 배속 해금: 옛 저장 배속이 해금 범위를 넘어 내려갔으면(save.js normalize) 첫 도전 시작 때 한 번 알린다
let speedClamped = 0;
try { const s = JSON.parse(localStorage.getItem(store.STORAGE_KEY))?.settings?.speed; if (s > data.settings.speed && SPEED_UNLOCK[s]) speedClamped = s; } catch { /* 저장소 막힘 */ }
let game = null;
let mode = 'title';               // 'title' | 'camp' | 'run' | 'result'
let acc = 0, lastT = performance.now(), stopUntil = 0, nextAt = 0, saveAt = 0, backAt = 0;
let pickHoldUntil = 0;
let stackAt = 0, stackLeft = NaN, comboAt = null; // 오른쪽 스킬 스택 왼쪽 끝(월드 x) · 4차 콤보 알약 가운데(HUD 좌표)
const heldPicks = [];             // 미뤄 둔 카드(보스 배너·운석 뒤에 띄움)
let pendingResult = null;         // runOver → 이번 프레임 UI 이벤트(패배 도장) 뒤에 결과 화면
let pendingUpdate = null, updSnooze = false;
let stillFrom = 0, sampling = false, live = false; // 멈춘 전투의 시작 시각 · 이번 프레임이 자동 그래픽 측정 대상(실제 전투를 그림)인가
let dbgSpells = null, dbgLoot = null; // 디버그(브라우저 전용): ?spells ?loot

const audio = createAudio();
audio.setEnabled(data.settings.sound);
const renderer = createRenderer(document.getElementById('game'));
const meta = {};
// ── 그래픽 단계(gfx.js): 설정값 → fps 상한 · 해상도 · 연출 예산. 자동이면 조절기가 전투 프레임을 재서 내린다 ──
let gfx = GFX.high, gfxSet = '', gov = null;
function applyGfx() {
  const s = data.settings;
  if (s.gfx !== gfxSet || !gov) { gfxSet = s.gfx; gov = createGovernor(autoStart(s.gfxAuto)); }
  const lv = GFX[s.gfx] ? s.gfx : gov.level; // 자동 = 이번 실행에서 조절기가 정한 단계(배운 절전은 보통부터 다시 — gfx.js autoStart)
  gfx = GFX[lv];
  renderer.setQuality(gfx);
  document.documentElement.dataset.gfx = lv; // CSS: 절전은 꾸밈 반복 애니메이션을 한 번만(css/kit.css)
  meta.gfxLevel = lv; // 설정 화면 '지금: 보통'
}
applyGfx();
const awake = createAwake(updater.plugin());
meta.awakeOk = awake.supported; // 설정 화면: 미지원이면 안내
const inRun = () => mode === 'run' && !!game;
const persistOk = ok => { if (ok) persist(true); return !!ok; };

// 4차 닉네임: 이름이 없는 저장(첫 실행 · 옛 저장 · 프로필 없던 백업)은 타이틀 '시작' 뒤 한 번 묻고 나서 넘어간다
function setName(name) {
  data.profile.name = name;
  if (game) game.players[0].name = name; // 성벽 위 이름표
  persist(true);
}
const named = go => () => {
  audio.unlock();
  if (!store.needsName(data)) return go();
  ui.askName({ required: true }, n => { setName(n); go(); });
};

const ui = createUI(document.getElementById('app'), {
  onStart: named(() => showCamp()),
  onContinueRun: named(() => {
    startRun(restoreRun(data));
    if (inRun() && data.hero.talentNotice) setTimeout(() => ui.toast('특성 개편! 이번 도전은 추천 빌드로 다시 찍어 두었어요', 'hero'), 600); // save.js normalize
  }),
  onRename: setName,
  onAbandonRun: named(onAbandonRun),
  onResultDone: () => { if (mode === 'result') showCamp(); },
  onCampAct: a => { // 장비 상자는 결과 객체 { item, sold, equipped }를 그대로 돌려준다(shopui.js 개봉 연출)
    const ok = campAct(data, a);
    if (ok) audio.play(a.type === 'box' ? (ok.item?.rarity === 'legend' ? 'fusion' : 'pickConfirm') : a.type === 'prep' ? 'coin' : a.type === 'train' || /Break$/.test(a.type) ? 'upgrade' : a.type === 'relic' ? 'synergy' : '');
    persistOk(ok);
    return ok;
  },
  onBuyMeta: k => { const ok = buyMeta(data, k); if (ok) audio.play('upgrade'); return persistOk(ok); },
  onStartRun: lo => startRun(newRun(data, lo)),
  onOpenHero: ({ tab } = {}) => (inRun() ? heroUI.open(game.hero, runCtx(), { tab }) : heroUI.open(data.hero, campCtx(), { tab })),
  onSkill: skill => inRun() && act(game, 0, { type: 'skill', skill }),
  onSpeed,
  onToggleAutoNext: on => setAuto(on),
  onToggleAutoPick: on => setAutoPick(on),
  onNext: () => nextStage(),
  onPick: (index, choice) => inRun() && act(game, 0, { type: 'pick', index, choice }), // choice: 변이 카드 갈래 0|1(4차)
  onReroll: () => inRun() && act(game, 0, { type: 'reroll' }),
  onRelic: index => inRun() && act(game, 0, { type: 'relic', index }),   // 4차 유물 3택(−1 = 유물 없이)
  onForget: spell => inRun() && act(game, 0, { type: 'forget', spell }), // 4차 망각(비우기)
  onHeroUlt: () => inRun() && act(game, 0, { type: 'heroUlt' }),
  onSettings: s => {
    const pickChanged = !!s.autoPick !== !!data.settings.autoPick;
    data.settings = { ...data.settings, ...s };
    if (pickChanged && inRun()) act(game, 0, { type: 'autoPick', on: !!data.settings.autoPick }); // 설정 화면의 '카드 자동 선택'
    audio.setEnabled(data.settings.sound);
    if (s.gfx === 'auto' && gfxSet !== 'auto') data.settings.gfxAuto = ''; // '자동'을 다시 고르면 높음부터 다시 잰다
    applyGfx();
    persist();
  },
  onResetSave,
  onBackupSave: () => { persist(true); return store.exportSave(data); },
  onRestoreSave,
  onCheckUpdate,
  onUpdateNow,
  onUpdateLater: () => { updSnooze = true; },
  onOpenInstallSettings,
});

// 영웅 · 장비 · 특성 화면. 도전 중엔 sim act(판매 골드 = 이번 도전 골드), 정비 화면에선 run.js campAct(판매 골드 = 보유 골드)
const heroDo = (runAction, campAction = runAction) => persistOk(inRun() ? act(game, 0, runAction) : !!campAction && campAct(data, campAction));
const heroUI = createHeroUI(document.getElementById('app'), {
  onSelectClass: cls => heroDo({ type: 'heroClass', cls }),
  onEquip: itemId => heroDo({ type: 'equip', itemId }),
  onSell: itemId => heroDo({ type: 'sell', itemId }),
  onSellRarity: rarity => heroDo({ type: 'sellRarity', rarity }),
  onToggleAutoEquip: on => heroDo({ type: 'autoEquip', on }),
  onTalent: key => heroDo({ type: 'talent', key }, { type: 'talent', cls: data.hero.cls, key }),
  onTalentReset: () => !inRun() && persistOk(campAct(data, { type: 'talentReset', cls: data.hero.cls })),
  onTalentRefund: key => !inRun() && persistOk(campAct(data, { type: 'talentRefund', cls: data.hero.cls, key })),
  onToggleAutoTalent: on => persistOk(campAct(data, { type: 'autoTalent', on })),
  onOpenWardrobe: cls => openWardrobe({ cls }), // v0.1.2 옷장(영웅 화면 '영웅' 탭)
  onClose: () => {},
});
// v0.1.2 외형 소환: 바꾸는 건 전부 campAct(summon.js) + 저장, 화면을 닫으면 정비 화면(보석·소환권 점) 다시 그림
initSummonUI(document.getElementById('app'), {
  getMeta: () => data,
  act: a => { const r = campAct(data, a); persistOk(r); return r; },
  play: k => audio.play(k),
  onClose: () => ui.refreshCamp(),
});
// 클래스 해금은 최고 기록(best) 기준
const runCtx = () => ({ stage: data.best, gold: game.players[0].gold });
const campCtx = () => ({ stage: data.best, camp: true, gold: data.gold, cos: JSON.stringify(data.summon?.equip?.costume) }); // v0.1.2 cos: 옷장에서 바꾸면 영웅 화면 초상 다시

// ── 디버그 파라미터 (브라우저 전용): ?spells=fireball:3,tornado ?herolv=N ?loot=rarity|all ?gems=N ?best=N ──
if (!native) {
  const q = new URLSearchParams(location.search);
  const int = (k, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(Number(q.get(k))) || lo));
  if (q.has('spells')) {
    dbgSpells = {};
    for (const part of q.get('spells').split(',')) {
      const [k, n] = part.split(':');
      if (SPELL_KEYS.includes(k)) dbgSpells[k] = Math.min(SPELL_MAX_LV, Math.max(1, Math.floor(Number(n)) || 1));
    }
  }
  if (q.has('herolv')) { data.hero.level = int('herolv', 1, MAX_HERO_LV); data.hero.xp = 0; }
  if (q.has('gems')) data.gems = int('gems', 0, 1e9);
  if (q.has('best')) data.best = int('best', 0, MAX_STAGE);
  if (q.has('loot')) dbgLoot = q.get('loot');
  // 콘솔 테스트용: __wd.frame(ms) 로 창이 가려져 있어도 프레임을 직접 돌릴 수 있다
  window.__wd = {
    get game() { return game; }, get data() { return data; }, get mode() { return mode; },
    frame: t => frame(t), ui, heroUI, loot: r => dropLoot(r), pwa, store,
  };
}

// ── 화면 전환 ──
function showCamp() {
  mode = 'camp';
  game = null;
  heldPicks.length = 0;
  pendingResult = null;
  heroUI.close();
  ui.showCamp(data);
}

function startRun(g) {
  if (!g) { data.run = null; persist(true); showCamp(); return; }
  game = g;
  mode = 'run';
  game.speed = allowedSpeed(data.settings.speed);
  acc = 0; stopUntil = 0; nextAt = 0; pickHoldUntil = 0;
  if (speedClamped) { const s = speedClamped; speedClamped = 0; setTimeout(() => ui.toast(`${s}배속은 이제 최고 ${SPEED_UNLOCK[s]}층 돌파 때 열려요`, 'lock'), 900); }
  heldPicks.length = 0;
  grantDebugSpells();
  ui.hideTitle();
  ui.hideCamp();
  heroUI.close();
  audio.unlock();
  persist(true); // 체크포인트(이어하기)
}

// 도전 포기(이어하기 창 · 일시정지 메뉴): 체크포인트까지 적립한 보석·기록으로 정산
function onAbandonRun() {
  const g = inRun() ? game : restoreRun(data);
  const sum = g && finishRun(g);
  if (sum) ui.showResult(sum, g);
  else { data.run = null; persist(true); showCamp(); }
}

// 정산은 도전이 끝난 '즉시' + 바로 기록: 결과 화면 중에 앱을 꺼도 죽은 층이 이어하기로 살아나지 않게.
// endRun 뒤엔 game.run.checkpoint 를 data.run 에 다시 쓰지 않는다(syncData 가 run.ended 를 본다)
function finishRun(g) {
  const sum = endRun(g, data, { app: appTag }); // 도전 기록 한 건 + 평생 통계(records.js)
  if (!sum) return null;
  mode = 'result';
  if (g !== game) game = null; // 이어하기 창에서 포기: 뒤에 그릴 전장 없음
  heldPicks.length = 0;
  store.save(data);
  store.flush();
  updSnooze = false;
  return sum;
}

// 층 시작마다 체크포인트 저장(startStage 가 game.run.checkpoint 를 새로 만든다)
function nextStage() {
  if (!inRun() || game.run.over || game.phase !== 'clear' || game.relicPick) return; // 유물을 고르기 전엔 다음 층 없음
  startStage(game, game.stage + 1);
  acc = 0;
  heldPicks.length = 0;
  grantDebugSpells();
  persist(true);
}

// ── 디버그 (브라우저 전용) ──
function grantDebugSpells() {
  if (!dbgSpells || !game) return;
  const fused = Object.values(game.fusionParts).flat(); // 이미 합체된 재료는 다시 넣지 않는다(융합 + 재료가 함께 슬롯에 남던 문제)
  for (const [k, v] of Object.entries(dbgSpells)) if (!fused.includes(k)) game.spells[k] = v;
  refreshFusion(game);
  if (game.pick) reofferPick(game, game.pick); // 이미 떠 있는 카드(시작 무료 카드)는 바뀐 빌드로 다시 뽑는다(합체된 재료 카드 방지)
}
// 지정 등급 장비를 전장에 떨어뜨린다(빛기둥 연출 확인용). 'all' = 등급별 1개씩
function dropLoot(r) {
  if (!inRun() || !game.hero?.cls) return false;
  const list = r === 'all' ? RARITY_KEYS : RARITY_KEYS.includes(r) ? [r] : [];
  list.forEach((rarity, i) => {
    let item = null;
    for (let n = 0; n < 500 && item?.rarity !== rarity; n++) item = rollItem(game.stage, rarity === 'common' ? 'normal' : 'chest', Math.random, game.hero.cls);
    if (item.rarity !== rarity) return;
    addToBag(game.hero, item);
    game.events.push({ type: 'loot', item, x: 120 + i * 120, y: 640 });
  });
  return list.length > 0;
}

// '자동 진행' 하나 = 다음 층 자동(settings.autoNext) + 영웅 궁극기 자동(sim players[0].auto). 카드는 늘 직접 고른다.
// 새 도전·이어하기는 run.js가 settings.autoNext로 players[0].auto를 만든다
function setAuto(on) {
  on = !!on;
  data.settings.autoNext = on;
  if (inRun()) act(game, 0, { type: 'auto', on });
  nextAt = performance.now() + (inRun() && game.phase === 'clear' ? 1200 : NEXT_DELAY); // 클리어 화면에서 켜면 곧 다음 층
  persist();
}

// 카드 화면 '자동 선택'(자동 진행과 별개, 기본 OFF): 선택 중이면 sim이 카운트다운을 바로 켜고 끈다
function setAutoPick(on) {
  data.settings.autoPick = !!on;
  if (inRun()) act(game, 0, { type: 'autoPick', on: !!on });
  persist();
}

const allowedSpeed = s => Math.min(s || 1, speedCap(data.best)); // 4차 배속 해금(config SPEED_UNLOCK)
let speedUnlockDue = 0; // 유물 화면이 끝나면 보여 줄 배속 해금(n배속)
function onSpeed() {
  const cur = inRun() ? game.speed : data.settings.speed;
  const s = nextSpeed(cur, data.best);
  data.settings.speed = s;
  if (inRun()) game.speed = s;
  persist();
}

function resetState() {
  game = null;
  heldPicks.length = 0;
  pendingResult = null;
  heroUI.close();
  audio.setEnabled(data.settings.sound);
  gov = null; applyGfx(); // 저장이 바뀌었다(초기화·복원): 그래픽 설정도 그 저장 것으로
  syncLoadout(); // v0.1.2 저장이 바뀌면(초기화·백업 복원) 장착 외형도 전장 그림에 다시
}
function showHome() { // 저장이 바뀐 뒤: 도전 중이면 타이틀(이어하기), 아니면 정비 화면
  if (data.run) { mode = 'title'; ui.showTitle({ best: data.best, run: data.run, hero: data.hero }); } else showCamp();
}

function onResetSave() {
  const { id, createdAt } = data.profile; // 기기 id는 유지(나중에 서버 계정과 잇는 열쇠), 이름은 다시 묻는다
  store.clear();
  data = store.defaults();
  data.profile = { id, createdAt, name: '' };
  persist(true); // 비운 저장소에 id를 바로 적는다(숨김 이벤트 없이 꺼져도 id 유지)
  resetState();
  mode = 'title';
  ui.showTitle({ best: 0, run: null, hero: data.hero });
  ui.toast('저장을 초기화했어요');
}

// 백업 코드 복원: preview → 요약 객체 또는 { error }(ui가 문구를 보여 줌), 아니면 덮어쓰고 true/false
function onRestoreSave(code, preview) {
  const r = store.importSave(code, data); // 프로필 없던 옛 코드: 이 기기 id를 잇고 이름은 다시 묻는다
  if (preview === true) return r.ok ? r.data : { error: r.error };
  if (!r.ok) return false;
  store.clear();
  r.data.settings.storage = data.settings.storage; // 저장 보호 상태는 이 기기 값(코드를 만든 기기 값이 아님)
  r.data.settings.gfxAuto = data.settings.gfxAuto; // 자동 그래픽이 배운 단계도 이 기기 값
  data = r.data;
  store.save(data);
  if (!store.flush()) return false;
  resetState();
  showHome();
  if (mode === 'camp' && store.needsName(data)) setTimeout(() => ui.askName({ required: true }, setName), 350); // 복원 창이 닫힌 뒤
  return true;
}

// ── 저장 ──
function syncData() {
  if (!game || game.run.ended || game.run.over) return; // 끝난 도전은 이어하기로 되살리지 않는다
  data.run = game.run.checkpoint;
  if (data.run?.log) { const l = game.run.log; Object.assign(data.run.log, { ps: l.ps, sp: l.sp, ap: l.ap }); } // 플레이 시간은 층 도중까지(처치 수는 체크포인트 기준 — 다시 하는 층을 두 번 세지 않게)
  data.discovered = [...new Set([...data.discovered, ...game.discovered])];
  data.seenSpells = SPELL_KEYS.filter(k => data.seenSpells.includes(k) || game.seenSpells.has(k));
  if (game.hero) data.hero = game.hero; // 같은 객체(sim이 제자리 변경)
}
function persist(now = false) {
  syncData();
  store.save(data);
  if (now) store.flush();
}

// ── 오프라인 보상 (부팅 · 앱 복귀): 보석 + 영웅 경험치 ──
function checkOffline() {
  const r = store.computeOffline(data);
  data.lastSeen = Date.now(); // 복귀 이벤트가 두 번 와도 한 번만 지급
  if (!(r.gems > 0 || r.gold > 0 || r.xp > 0)) return;
  if (!(r.gems > 0 || r.gold > 0) || r.minutes < 10) { // 잠깐 비운 정도(보석 0)는 창 없이 조용히 지급 — 카드 선택 위로 팝업하지 않는다
    applyOffline(data, r);
    persist(true);
    if (r.xp > 0 || r.gold > 0) ui.toast(`돌아오셨네요! ${r.gold > 0 ? `골드 +${r.gold} · ` : ''}영웅 경험치 +${r.xp}`, r.gold > 0 ? 'coin' : 'hero'); // 방치 골드(shop.js)
    if (mode === 'title' && data.run && !ui.isBusy()) ui.showContinue(data.run, data.hero); // 이름 입력 창 등 다른 창 위로는 안 띄운다
    return;
  }
  ui.showOfflineReward(r, () => {
    applyOffline(data, r);
    audio.play('coin');
    persist(true);
    if (mode === 'title' && data.run && !ui.isBusy()) ui.showContinue(data.run, data.hero); // 이름 입력 창 등 다른 창 위로는 안 띄운다
  });
}

let away = false; // 앱이 뒤로 갔다(APK appStateChange — 웹뷰가 hidden 을 알리지 않는 기기 대비): 루프·소리를 멈춘다
function syncAwake() { awake.sync(wantAwake(data.settings.screenOn, { run: inRun(), visible: !document.hidden && !away })); }
function onHide() { awake.sync(false); persist(true); }
function onShow() {
  lastT = performance.now();
  acc = 0;
  away = false;
  wake();
  syncAwake();
  checkOffline();
}
document.addEventListener('visibilitychange', () => (document.hidden ? onHide() : onShow()));
addEventListener('pagehide', onHide);
App?.addListener('appStateChange', s => { if (s.isActive) onShow(); else { away = true; audio.nap(); onHide(); } });

// ── 이벤트 → 효과음 · 저장 · 도전 흐름 ──
function handleEvents(events, now) {
  let stop = 0;
  for (const ev of events) {
    switch (ev.type) {
      case 'hitstop': stop = Math.max(stop, +ev.ms || 0); break;
      case 'cast': if (ev.o === 0 && !ev.basic) audio.play('spell', ev.spell); break;
      case 'shoot': if (ev.o === 0) audio.play('shoot'); break;
      case 'hit': audio.play(ev.crit ? 'crit' : 'hit'); break;
      case 'kill': audio.play(ev.isBoss ? 'big' : 'kill'); break;
      case 'boom': if (ev.kind !== 'meteor') audio.play(ev.kind === 'crit' ? 'crit' : 'big'); break;
      case 'wall': case 'thorns': audio.play('hit'); break;
      case 'skill': audio.play(ev.skill); break;
      case 'bossSpawn': case 'warn': case 'enrage': case 'berserk': audio.play('boss'); break;
      case 'collabProc': audio.play('crit'); break;
      case 'linkFinish': audio.play('big'); audio.play('fusion'); break;
      case 'combo': audio.play('combo', ev.tier); break;
      case 'frenzy': audio.play('frenzy'); break;
      case 'chain': audio.play('crit'); break;
      case 'shatter': case 'shield': audio.play('freeze'); break;
      case 'goldRain': audio.play('coin'); break;
      case 'synergy':
        if (FUSION_KEYS.has(ev.key)) audio.play('fusion'); // 원소 융합은 카드로 직접 만든 순간이라 매번 웅장하게
        else if (ev.first) audio.play('synergy');
        if (ev.first) persist(true); // 발견은 즉시 저장
        break;
      case 'pickOffer':
        audio.play('pickShow');
        for (let i = 0; i < (game.pick?.cards.length || 3); i++) setTimeout(() => audio.play('cardFlip'), 90 * i + 60);
        break;
      case 'spellPick': audio.play('pickConfirm', ev.rarity); break;
      // 4차 유물·망각: 고른 즉시 저장(체크포인트가 유물을 품는다) · 고른 뒤 다음 층까지 잠깐 여유
      case 'relicOffer': audio.play('pickShow'); break;
      case 'relicPick':
        audio.play(ev.key ? 'synergy' : 'pickConfirm', 'legend'); nextAt = Math.max(nextAt, now + 1500); persist(true);
        if (speedUnlockDue) { const n = speedUnlockDue; speedUnlockDue = 0; setTimeout(() => ui.speedUnlocked(n), 900); } // 미뤄 둔 배속 해금 연출
        break;
      case 'relicProc': audio.play(ev.key === 'phoenix' ? 'synergy' : 'crit'); break;
      case 'forget': audio.play('upgrade'); break;
      case 'spell': audio.play('spell', ev.key); break;
      case 'revive': audio.play('synergy'); break;
      case 'talent': audio.play('upgrade'); persist(true); break;
      // 영웅
      case 'heroUlt': audio.play('big'); break;
      case 'heroDown': audio.play('defeat'); break;
      case 'heroRespawn': audio.play('upgrade'); break;
      case 'heroLevelUp':
        audio.play('clear');
        if (heroUI.isOpen()) heroUI.notifyLevelUp(ev.level, ev.tier, ev.milestone);
        persist(true);
        break;
      case 'loot':
        heroUI.notifyLoot(ev.item);
        audio.play(ev.item?.rarity === 'legend' || ev.item?.rarity === 'epic' ? 'synergy' : 'coin');
        persist();
        break;
      case 'clear': {
        audio.play('clear');
        const prev = data.best;
        data.best = Math.max(data.best, game.stage); // 3배속 해금용(신기록 보석은 endRun이 도전 시작 기록 기준으로 계산)
        if (speedCap(data.best) > speedCap(prev)) { // 4차: '2배속 해금!' — 10·30층은 유물 층이라 유물을 고른 뒤에(유물 화면에 묻히지 않게)
          if (game.relicPick) speedUnlockDue = speedCap(data.best);
          else setTimeout(() => ui.speedUnlocked(speedCap(data.best)), 1600);
        }
        nextAt = now + NEXT_DELAY;
        updSnooze = false;
        persist(true);
        break;
      }
      case 'defeat': audio.play('defeat'); break;
      case 'runOver': {
        const sum = finishRun(game);
        if (sum) pendingResult = { sum, g: game };
        break;
      }
    }
  }
  if (stop > 0) {
    const ms = Math.min(HITSTOP_CAP, stop) * HITSTOP_SCALE[(game.speed | 0) - 1 || 0];
    stopUntil = Math.max(stopUntil, now + ms);
  }
}

// 새 카드가 보스 배너·운석 착탄 시간 안에 뜨면 잠시 빼 두고(전투 계속) 뒤에 다시 올린다
function holdPicks(events, now) {
  let offered = false;
  for (const e of events) {
    if (e.type === 'pickOffer') offered = true;
    else if (e.type === 'bossSpawn' && e.named) pickHoldUntil = Math.max(pickHoldUntil, now + PICK_HOLD_BOSS);
    else if (e.type === 'boom' && e.kind === 'meteor') pickHoldUntil = Math.max(pickHoldUntil, now + PICK_HOLD_METEOR);
    else if (e.type === 'heroUlt' || e.type === 'linkFinish') pickHoldUntil = Math.max(pickHoldUntil, now + PICK_HOLD_ULT);
  }
  if (game.pick && offered && now < pickHoldUntil) {
    heldPicks.push(game.pick);
    game.pick = null;
    return events.filter(e => e.type !== 'pickOffer');
  }
  if (game.phase !== 'play') heldPicks.length = 0; // 클리어·패배 순간 떠 있던 카드는 sim도 버린다
  else if (!game.pick && heldPicks.length && now >= pickHoldUntil) {
    if (reofferPick(game, heldPicks.shift())) { // 카드는 지금 빌드로 새로 뽑는다(그사이 다른 카드를 골랐을 수 있다)
      events.push({ type: 'pickOffer' });
    }
  }
  return events;
}

// ── 업데이트: APK(네이티브) = updater.js, 웹·PWA = pwa.js. 둘 다 전투 중이 아닌 안전한 순간에만 ──
const modalOpen = id => !document.getElementById(id).hidden;
const anyModal = () => document.querySelector('#layer .modal:not([hidden])');
function maybeShowUpdate() {
  if (!pendingUpdate || updSnooze || heroUI.isOpen() || game?.pick) return;
  const m = anyModal();
  if (m && m.id !== 'm-menu') return;
  if (!(mode === 'title' || mode === 'camp' || (inRun() && game.phase !== 'play') || m)) return;
  updSnooze = true; // [나중에] 뒤엔 다음 클리어/정비 때 다시
  ui.showUpdateReady(pendingUpdate);
}
function maybeApplyPwa() {
  if (!pwa.isUpdateReady() || !(mode === 'camp' || mode === 'title') || anyModal() || heroUI.isOpen()) return;
  persist(true);
  pwa.applyUpdate();
}

async function onUpdateNow() {
  persist(true);
  const r = await updater.install();
  if (r.needsPermission) { ui.showInstallPermissionHelp(); return; }
  if (r.ok === false) ui.toast(r.message || '업데이트를 시작하지 못했어요');
}

async function onOpenInstallSettings() {
  const { allowed } = await updater.openInstallSettings();
  if (!allowed) { ui.toast("'이 출처 허용'을 켜야 업데이트할 수 있어요"); return; }
  const r = await updater.install();
  if (r.ok === false) ui.toast(r.message || '업데이트를 시작하지 못했어요');
}

async function onCheckUpdate() {
  if (!native) {
    ui.toast(pwa.isUpdateReady() ? '새 버전이 있어요. 정비 화면에서 자동으로 적용돼요' : '웹 버전은 항상 최신이에요');
    return;
  }
  const info = await updater.check({ force: true });
  if (!info.available) {
    ui.toast(info.error === 'offline' ? '인터넷 연결을 확인해 주세요'
      : info.error ? '지금은 확인할 수 없어요. 잠시 뒤 다시 시도해 주세요' : '최신 버전입니다');
    return;
  }
  ui.toast('새 버전 다운로드 중...');
  try {
    ui.showUpdateProgress(0);
    await updater.download(p => ui.showUpdateProgress(p));
  } catch (e) {
    ui.toast(e?.message || '다운로드에 실패했어요');
    return;
  } finally {
    ui.showUpdateProgress(null);
  }
  const ready = updater.ready();
  if (ready) { pendingUpdate = ready; updSnooze = true; ui.showUpdateReady(ready); }
}

if (native) {
  updater.start(info => {
    if (pendingUpdate?.version === info.version) return; // 설정의 '업데이트 확인'으로 이미 띄운 버전
    pendingUpdate = info;
    updSnooze = false;
  });
  updater.getCurrentVersion().then(v => { ui.setVersion(v ? 'v' + v.versionName : ''); if (v?.versionName) appTag = v.versionName + '-apk'; }).catch(() => {});
} else {
  fetch(new URL('../version.json', import.meta.url), { cache: 'no-store' }).then(r => r.json())
    .then(v => { ui.setVersion(`웹 v${v.version}${v.build && v.build !== 'dev' ? ' · ' + String(v.build).slice(0, 7) : ''}`); if (v.version) appTag = v.version + '-web'; })
    .catch(() => ui.setVersion('웹 버전'));
  protectStorage();
}

// 웹(PWA) 저장 보호: 브라우저가 저장소를 임의로 비우지 않게 영구 저장소를 요청하고 결과만 조용히 기록(팝업 없음).
// 브라우저 탭에선 첫 실행에 한 번, 아직 못 받았으면 홈 화면 앱(standalone)으로 켤 때마다 다시(크롬은 설치 후에야 허락). APK에선 부르지 않는다
async function protectStorage() {
  const st = navigator.storage;
  let v = 'na';
  const ask = !data.settings.storage || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  try { if (st?.persist && st.persisted) v = (await st.persisted()) || (ask && await st.persist()) ? 'on' : 'off'; } catch { v = 'na'; }
  if (data.settings.storage !== v) { data.settings.storage = v; persist(); }
}

// ── 안드로이드 뒤로가기: 시트·모달 닫기 → 도전 중이면 일시정지 메뉴, 정비·타이틀에선 두 번 눌러 종료 ──
App?.addListener('backButton', () => {
  wake(); // 포인터·키가 아닌 입력: 저속 틱(4Hz)을 기다리지 않고 바로 다음 프레임
  if (gemStoreHandleBack()) return; // v0.1.2 보석 충전 화면(정비 위)
  if (summonHandleBack()) return; // v0.1.2 소환·옷장 층이 영웅 화면 위
  if (heroUI.handleBack()) return;
  if (ui.handleBack()) return;
  if (inRun()) { document.getElementById('btn-menu').click(); return; }
  const now = performance.now();
  if (now - backAt < 2000) { persist(true); App.exitApp(); } else { backAt = now; ui.toast('한 번 더 누르면 게임을 종료해요'); }
});

addEventListener('keydown', e => { if (e.key === 'Escape' && heroUI.handleBack()) e.preventDefault(); });

// 첫 터치에서 오디오 잠금 해제 (자동재생 정책)
addEventListener('pointerdown', () => audio.unlock(), { capture: true });

// 전장 탭 → 영웅 이동 (상단 HUD 띠·성벽 아래는 무시, sim이 좌표를 한 번 더 검증)
document.getElementById('game').addEventListener('pointerdown', e => {
  if (!inRun() || game.phase !== 'play' || !game.heroUnit || game.pick || ui.isBusy() || heroUI.isOpen()) return;
  const p = renderer.toWorld(e.clientX, e.clientY);
  if (p.y < HUD_H - renderer.topExtra || p.y > WALL_Y || p.x < 0 || p.x > WORLD_W) return;
  act(game, 0, { type: 'heroMove', x: p.x, y: p.y });
});

// ── 메인 루프 ──
// 전투가 움직일 때만 매 화면 프레임(그래픽 fps 상한 — 90·120·144Hz 화면도 평균 60) · 멈춘 전투는 10Hz · 전장 없는 화면은 4Hz.
// 저속 틱은 setTimeout → rAF 라 숨김·백그라운드에선 rAF 가 멈추면서 같이 멈춘다. 입력이 오면 wake()로 바로 다음 프레임
// fps 상한 = 마감 시각(due): 마감 PACE_TOL 전부터 오는 화면 프레임에 그린다. 60Hz 는 매번, 120Hz 는 한 칸 걸러, 90Hz 는 11/22ms 번갈아(평균 60).
// ponytail: 옛 규칙 '지난 그림에서 1000/fps-2ms' 는 90Hz 에서 22ms(45fps)로 떨어져 자동이 절전까지 내려갔다
const PACE_TOL = 5;
let rafId = 0, idleTimer = 0, drawnAt = -1e9, due = 0;
function schedule(ms) {
  if (ms > 0) idleTimer = setTimeout(() => { idleTimer = 0; if (!rafId) rafId = requestAnimationFrame(loop); }, ms);
  else rafId = requestAnimationFrame(loop);
}
// 손대지 않고 멈춰 있는 화면(타이틀·정비·결과·카드·메뉴): CALM_MS 뒤 무한 반복 꾸밈 애니메이션을 그 자리에 멈춘다 — 60Hz 합성·GPU 가 쉰다(발열).
// 한 번 도는 등장·퇴장은 건드리지 않는다. 멈춤 = 요소에 data-calm(css/kit.css) — 애니메이션 API pause() 는 CSS 멈춤 규칙(cv-*)을 영영 무시하게 만들어서 안 쓴다
const CALM_MS = 10000, CALM_LOW_MS = 3000; // 절전은 금방(몇 번 돌고 멈춤)
let busyAt = 0;
const calmed = new Set();
function calmDown() { // 저속 틱마다: 새로 뜬 화면의 반복도 잡는다
  for (const a of document.getAnimations()) {
    const el = a.effect?.target;
    if (el && a.playState === 'running' && a.effect.getTiming().iterations === Infinity && el.id !== 'upd-progress-fill') { el.setAttribute('data-calm', ''); calmed.add(el); }
  }
}
function calmUp() { for (const el of calmed) el.removeAttribute('data-calm'); calmed.clear(); }
function wake() {
  busyAt = performance.now(); calmUp();
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = 0; }
  if (!rafId && !away) rafId = requestAnimationFrame(loop);
}
for (const t of ['pointerdown', 'pointerup', 'keydown']) addEventListener(t, wake, { capture: true, passive: true });

function loop(now) {
  rafId = 0;
  if (away) return;
  const iv = 1000 / gfx.fps;
  if (game && now < due - PACE_TOL) { schedule(0); return; } // fps 상한: 마감 전 화면 프레임은 건너뜀
  due = Math.max(due + iv, now + iv - PACE_TOL); // 밀렸으면(느린 프레임·쉬다 옴) 지금부터 다시
  const gap = now - drawnAt;
  drawnAt = now;
  const t0 = performance.now();
  const wait = frame(now);
  if (sampling && data.settings.gfx === 'auto') { // 자동 그래픽: 실제 전투 프레임의 작업 시간·간격
    const lv = gov.sample(performance.now() - t0, gap);
    if (lv) { data.settings.gfxAuto = lv; applyGfx(); persist(); }
  } else gov.reset();
  if (!wait) { busyAt = now; if (calmed.size) calmUp(); } else if (now - busyAt > (gfx === GFX.low ? CALM_LOW_MS : CALM_MS)) calmDown();
  schedule(wait || (game ? due - 12 - performance.now() : 0)); // 다음 그림 직전(12ms 앞)까지는 rAF 도 걸지 않는다 — 절전 30fps 에서 쉬는 화면 프레임에 페이지가 깨지 않게
}

// 전체 화면 층에 가려 안 보이는 화면: 반복 CSS 애니메이션 멈춤(css/kit.css html.cv-*)
const titleEl = document.getElementById('title'), rootCl = document.documentElement.classList;
function syncCover() {
  const hero = heroUI.isOpen(), camp = ui.isCampOpen(), full = !!document.querySelector('.sm-scr:not([hidden]), .gs-scr:not([hidden])');
  rootCl.toggle('cv-camp', camp && (hero || full));
  rootCl.toggle('cv-stage', camp || !titleEl.hidden || modalOpen('m-result') || (inRun() && (hero || full)));
}

// 한 번 갱신. 반환 = 다음 갱신까지 쉴 ms(0 = 다음 화면 프레임)
function frame(now) {
  const wallDt = Math.min(0.5, Math.max(0, (now - lastT) / 1000)); // 저속 틱에서도 실제 흐른 시간(카드 카운트다운·플레이 시간)
  const dt = Math.min(0.1, wallDt);
  lastT = now;
  sampling = false;
  syncCover();
  meta.gems = data.gems;
  meta.gold = data.gold;
  meta.best = data.best;
  meta.speed = inRun() ? game.speed : data.settings.speed;
  meta.autoNext = data.settings.autoNext;
  meta.speedCap = speedCap(data.best);
  meta.settings = data.settings;
  meta.profile = data.profile;
  meta.native = native; // 설정 '기록 보호' 줄(APK = 앱 저장소)
  meta.discovered = game ? game.discovered : data.discovered;
  meta.summon = data.summon; // v0.1.2 타이틀 'NEW 외형 소환' 리본(ui.js syncTeaser — giftPending)
  syncAwake(); // 화면이 바뀌면(도전 ↔ 정비·타이틀) 바로 따라간다 — 바뀔 때만 실제 호출

  if (!game) { // 타이틀 · 정비 화면 · (전장 없는) 결과 화면
    ui.update(null, meta);
    heroUI.update(data.hero, campCtx());
    maybeShowUpdate();
    maybeApplyPwa();
    if (now >= saveAt) { saveAt = now + SAVE_EVERY; persist(); }
    return IDLE_MS;
  }

  // 카드 선택 중: 전투 정지(sim도 스스로 멈춤). 카드 화면 '자동 선택'을 켰을 때만 실시간 카운트다운(sim이 판단), 아니면 고를 때까지 기다린다
  const picking = !!game.pick;
  if (picking && !heroUI.isOpen() && ui.isPickShown()) tickPick(game, wallDt);
  if (game.relicPick && !heroUI.isOpen() && ui.isRelicShown()) tickRelic(game, wallDt); // 유물 3택(자동 선택 ON일 때만 카운트다운)
  // 모달(메뉴·영웅 화면·결과 등)이 열리면 일시정지
  const paused = picking || !!game.relicPick || ui.isBusy() || heroUI.isOpen();
  const holding = now < stopUntil;
  if (mode === 'run' && !game.run.over) { // 도전 기록: 실제 플레이 초(배속 전) — 메뉴·영웅 화면·백그라운드(rAF 멈춤)는 빼고, 카드 고르는 시간은 넣는다
    const lg = game.run.log;
    if (!heroUI.isOpen() && !anyModal()) lg.ps += wallDt;
    if (!paused) lg.sp = Math.max(lg.sp, game.speed);
    if (game.players[0].autoPick) lg.ap = true;
  }
  if (dbgLoot && game.hero?.cls && game.phase === 'play' && !paused) { dropLoot(dbgLoot); dbgLoot = null; }
  if (!paused && !holding) {
    acc += dt * game.speed * simSlow();
    let n = 0;
    while (acc >= DT && n < MAX_STEPS) { step(game, DT); acc -= DT; n++; }
    if (n >= MAX_STEPS) acc = 0;
  } else acc = 0;

  const g = game;
  let events = drainEvents(g);
  if (mode === 'run') events = holdPicks(events, now);
  handleEvents(events, now);
  if (now >= stackAt) { // 스킬 스택(전장 위에 겹칠 때) 왼쪽 끝 — 레이아웃 읽기라 0.5초마다만
    stackAt = now + 500;
    const r = document.getElementById('side-r').getBoundingClientRect();
    stackLeft = r.width > 0 ? renderer.toWorld(r.left, r.top).x : NaN;
    const c = document.getElementById('combo'), cr = (c.hidden ? document.getElementById('st-row') : c).getBoundingClientRect(); // 4차: 콤보 알약 가운데(단계 팝이 빨려 드는 곳)
    comboAt = renderer.toWorld(cr.left + cr.width / 2, cr.top + cr.height / 2);
  }
  // 멈춘 전투: 어둡게 깔리는 동안(SETTLE_MS)만 그리고 그 뒤엔 마지막 그림 그대로(히트스톱 시계도 멈춰 있어 바뀌는 게 없다).
  // 이벤트가 오면(카드 고름·유물·다시 뽑기) 그 연출을 위해 다시 그린다
  // 캔버스 연출(층 배너·보스 경고·컷인·팝)이 아직 움직이면(live) 그것도 끝까지 그린 뒤에 멈춘다 — 카드 뒤에 반쯤 그린 배너가 얼어붙지 않게
  if (!paused || events.length || live) stillFrom = paused ? now : 0;
  else if (!stillFrom) stillFrom = now;
  const still = paused && now - stillFrom > SETTLE_MS;
  const out = still ? { coins: 0 } : renderer.frame(g, events, dt, {
    dmgNumbers: data.settings.dmgNumbers, shake: data.settings.shake, hitstop: holding || paused, myIndex: 0, stackLeft, comboAt,
  });
  live = !!out.live;
  sampling = !paused && g.phase === 'play';
  if (out.coins > 0) audio.play('coin');
  ui.onEvents(events, g);
  ui.update(g, meta);
  heroUI.update(g.hero, mode === 'run' ? runCtx() : campCtx());
  if (pendingResult) { // 패배 도장(ui.onEvents)이 뜬 다음에: 결과 화면은 도장을 보여 준 뒤 스스로 이어서 뜬다
    ui.showResult(pendingResult.sum, pendingResult.g);
    pendingResult = null;
  }

  if (inRun() && game.phase === 'clear' && !game.run.over && !game.relicPick && data.settings.autoNext && now >= nextAt && !ui.isBusy() && !heroUI.isOpen()) {
    if (pendingUpdate && !updSnooze) maybeShowUpdate();
    else nextStage();
  } else maybeShowUpdate();

  if (now >= saveAt) { saveAt = now + SAVE_EVERY; persist(); }
  if (!still) return 0;
  return inRun() && (game.pick?.autoLeft != null || game.relicPick?.autoLeft != null) ? 33 : STILL_MS; // 자동 선택 고리가 차오르는 동안은 30Hz
}

// ── 부팅 ──
fontsReady(); // 번들 글꼴 로드 시작(캔버스 글자용)
ui.showTitle({ best: data.best, run: data.run, hero: data.hero });
checkOffline();
if (pwa.justUpdated()) setTimeout(() => ui.toast('업데이트 완료! 최신 버전이에요', 'check'), 400);
loop(lastT = performance.now()); // 첫 프레임은 바로

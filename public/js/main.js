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

const HITSTOP_CAP = 500;          // ms
const HITSTOP_SCALE = [1, 0.75, 0.5]; // 배속별 히트스톱 축소
const NEXT_DELAY = 3900;          // 클리어 후 자동 진행까지(ms) — 보상 패널을 볼 최소 시간
const SAVE_EVERY = 3000;
const MAX_STEPS = 20;             // 한 프레임 최대 시뮬 스텝(큰 공백은 버림)
const HUD_H = 90;                 // 전장 탭 무시: 월드 y < 90 은 상단 HUD
// 카드가 네임드 보스 등장 배너·운석 착탄을 덮지 않게: 그동안 전투는 계속 돌고 카드는 뒤에 뜬다
const PICK_HOLD_BOSS = 1800, PICK_HOLD_METEOR = 800, PICK_HOLD_ULT = 1400; // 궁극기·합동 필살 연출을 카드가 가리지 않게
const FUSION_KEYS = new Set(SYNERGIES.filter(s => s.kind === 'fusion').map(s => s.key));

const native = updater.isNative();
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
let dbgSpells = null, dbgLoot = null; // 디버그(브라우저 전용): ?spells ?loot

const audio = createAudio();
audio.setEnabled(data.settings.sound);
const renderer = createRenderer(document.getElementById('game'));
const meta = {};
const inRun = () => mode === 'run' && !!game;
const persistOk = ok => { if (ok) persist(true); return !!ok; };

const ui = createUI(document.getElementById('app'), {
  onStart: () => { audio.unlock(); showCamp(); },
  onContinueRun: () => {
    startRun(restoreRun(data));
    if (inRun() && data.hero.talentNotice) setTimeout(() => ui.toast('특성 개편! 이번 도전은 추천 빌드로 다시 찍어 두었어요', 'hero'), 600); // save.js normalize
  },
  onAbandonRun,
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
  onToggleAutoTalent: on => persistOk(campAct(data, { type: 'autoTalent', on })),
  onClose: () => {},
});
// 클래스 해금은 최고 기록(best) 기준
const runCtx = () => ({ stage: data.best, gold: game.players[0].gold });
const campCtx = () => ({ stage: data.best, camp: true, gold: data.gold });

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
  const sum = endRun(g, data);
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
}
function showHome() { // 저장이 바뀐 뒤: 도전 중이면 타이틀(이어하기), 아니면 정비 화면
  if (data.run) { mode = 'title'; ui.showTitle({ best: data.best, run: data.run, hero: data.hero }); } else showCamp();
}

function onResetSave() {
  store.clear();
  data = store.defaults();
  resetState();
  mode = 'title';
  ui.showTitle({ best: 0, run: null, hero: data.hero });
  ui.toast('저장을 초기화했어요');
}

// 백업 코드 복원: preview → 요약 객체 또는 { error }(ui가 문구를 보여 줌), 아니면 덮어쓰고 true/false
function onRestoreSave(code, preview) {
  const r = store.importSave(code);
  if (preview === true) return r.ok ? r.data : { error: r.error };
  if (!r.ok) return false;
  store.clear();
  data = r.data;
  store.save(data);
  if (!store.flush()) return false;
  resetState();
  showHome();
  return true;
}

// ── 저장 ──
function syncData() {
  if (!game || game.run.ended || game.run.over) return; // 끝난 도전은 이어하기로 되살리지 않는다
  data.run = game.run.checkpoint;
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
    if (mode === 'title' && data.run) ui.showContinue(data.run, data.hero);
    return;
  }
  ui.showOfflineReward(r, () => {
    applyOffline(data, r);
    audio.play('coin');
    persist(true);
    if (mode === 'title' && data.run) ui.showContinue(data.run, data.hero);
  });
}

function onHide() { persist(true); }
function onShow() {
  lastT = performance.now();
  acc = 0;
  checkOffline();
}
document.addEventListener('visibilitychange', () => (document.hidden ? onHide() : onShow()));
addEventListener('pagehide', onHide);
App?.addListener('appStateChange', s => (s.isActive ? onShow() : onHide()));

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
  updater.getCurrentVersion().then(v => ui.setVersion(v ? 'v' + v.versionName : '')).catch(() => {});
} else {
  fetch(new URL('../version.json', import.meta.url), { cache: 'no-store' }).then(r => r.json())
    .then(v => ui.setVersion(`웹 v${v.version}${v.build && v.build !== 'dev' ? ' · ' + String(v.build).slice(0, 7) : ''}`))
    .catch(() => ui.setVersion('웹 버전'));
  navigator.storage?.persist?.().catch(() => {}); // 브라우저가 저장소를 임의로 비우지 않게(iPhone PWA)
}

// ── 안드로이드 뒤로가기: 시트·모달 닫기 → 도전 중이면 일시정지 메뉴, 정비·타이틀에선 두 번 눌러 종료 ──
App?.addListener('backButton', () => {
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
function loop(now) {
  requestAnimationFrame(loop);
  frame(now);
}

function frame(now) {
  const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  meta.gems = data.gems;
  meta.gold = data.gold;
  meta.best = data.best;
  meta.speed = inRun() ? game.speed : data.settings.speed;
  meta.autoNext = data.settings.autoNext;
  meta.speedCap = speedCap(data.best);
  meta.settings = data.settings;
  meta.discovered = game ? game.discovered : data.discovered;

  if (!game) { // 타이틀 · 정비 화면 · (전장 없는) 결과 화면
    ui.update(null, meta);
    heroUI.update(data.hero, campCtx());
    maybeShowUpdate();
    maybeApplyPwa();
    if (now >= saveAt) { saveAt = now + SAVE_EVERY; persist(); }
    return;
  }

  // 카드 선택 중: 전투 정지(sim도 스스로 멈춤). 카드 화면 '자동 선택'을 켰을 때만 실시간 카운트다운(sim이 판단), 아니면 고를 때까지 기다린다
  const picking = !!game.pick;
  if (picking && !heroUI.isOpen() && ui.isPickShown()) tickPick(game, dt);
  if (game.relicPick && !heroUI.isOpen() && ui.isRelicShown()) tickRelic(game, dt); // 유물 3택(자동 선택 ON일 때만 카운트다운)
  // 모달(메뉴·영웅 화면·결과 등)이 열리면 일시정지
  const paused = picking || !!game.relicPick || ui.isBusy() || heroUI.isOpen();
  const holding = now < stopUntil;
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
  const out = renderer.frame(g, events, dt, {
    dmgNumbers: data.settings.dmgNumbers, shake: data.settings.shake, hitstop: holding || paused, myIndex: 0, stackLeft, comboAt,
  });
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
}

// ── 부팅 ──
fontsReady(); // 번들 글꼴 로드 시작(캔버스 글자용)
ui.showTitle({ best: data.best, run: data.run, hero: data.hero });
checkOffline();
if (pwa.justUpdated()) setTimeout(() => ui.toast('업데이트 완료! 최신 버전이에요', 'check'), 400);
loop(lastT = performance.now()); // 첫 프레임은 바로

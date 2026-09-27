// 부팅 · 게임 루프 · 저장/업데이트 배선 (1차: 싱글 플레이, 슬롯 1 = AI 동료)
import { createGame, startStage, step, act, drainEvents, tickPick, refreshFusion } from './sim.js';
import { DT, MAX_STAGE, SPEED3_UNLOCK, PERK_KEYS, perkCost, perkMax, cannonStats, UPGRADE_KEYS, SPELL_KEYS, SYNERGIES, WALL_Y, WORLD_W } from './config.js';
import { MAX_HERO_LV, RARITY_KEYS, rollItem, addToBag } from './hero.js';
import { createRenderer, fontsReady } from './render.js';
import { simSlow } from './art/hud.js';
import { createUI } from './ui.js';
import { createHeroUI } from './heroui.js';
import { createAudio } from './audio.js';
import * as store from './save.js';
import * as updater from './updater.js';

const HITSTOP_CAP = 500;          // ms
const HITSTOP_SCALE = [1, 0.75, 0.5]; // 배속별 히트스톱 축소
const NEXT_DELAY = 3900;          // 클리어 후 자동 진행까지(ms) — 보상 패널을 볼 최소 시간(보스 판은 1.2초 늦게 뜬다)
const SAVE_EVERY = 3000;
const MAX_STEPS = 20;             // 한 프레임 최대 시뮬 스텝(큰 공백은 버림)
const HUD_H = 90;                 // 전장 탭 무시: 월드 y < 90 은 상단 HUD
const FUSION_KEYS = new Set(SYNERGIES.filter(s => s.kind === 'fusion').map(s => s.key));

const native = updater.isNative();
const App = window.Capacitor?.Plugins?.App;

let data = store.load();
let game = null;
let onTitle = true;
let acc = 0, lastT = performance.now(), stopUntil = 0, nextAt = 0, saveAt = 0, backAt = 0;
let pendingUpdate = null, updSnooze = false;
let dbgSpells = null, dbgLoot = null; // 디버그(브라우저 전용): ?spells ?loot

const audio = createAudio();
audio.setEnabled(data.settings.sound);
const renderer = createRenderer(document.getElementById('game'));
const meta = {};
const ui = createUI(document.getElementById('app'), {
  onStart,
  onUpgrade: stat => game && act(game, 0, { type: 'upgrade', stat }),
  onToggleAuto: on => { if (game && !act(game, 0, { type: 'auto', on })) return; data.auto = !!on; },
  onSkill: skill => game && act(game, 0, { type: 'skill', skill }),
  onSpeed,
  onToggleAutoNext: on => { data.settings.autoNext = !!on; nextAt = performance.now() + NEXT_DELAY; persist(); },
  onNext: () => nextStage(),
  onRetry: () => { if (game) beginStage(game.stage); },
  onPrevStage: () => { if (game) { data.stage = Math.max(1, game.stage - 1); beginStage(data.stage); persist(); } },
  onBuyPerk,
  onSettings: s => {
    data.settings = { ...data.settings, ...s };
    audio.setEnabled(data.settings.sound);
    persist();
  },
  onResetSave,
  onCheckUpdate,
  onUpdateNow,
  onUpdateLater: () => { updSnooze = true; },
  onOpenInstallSettings,
  onPick: index => game && act(game, 0, { type: 'pick', index }),
  onReroll: () => game && act(game, 0, { type: 'reroll' }),
  onHeroUlt: () => game && act(game, 0, { type: 'heroUlt' }),
  onOpenHero: () => { if (game) heroUI.open(game.hero, heroCtx()); },
});

// 영웅 · 장비 화면. 클래스/장비/판매는 sim act 로만 바꾸고 바로 저장
const heroAct = action => { if (game && act(game, 0, action)) persist(true); };
const heroUI = createHeroUI(document.getElementById('app'), {
  onSelectClass: cls => heroAct({ type: 'heroClass', cls }),
  onEquip: itemId => heroAct({ type: 'equip', itemId }),
  onSell: itemId => heroAct({ type: 'sell', itemId }),
  onSellRarity: rarity => heroAct({ type: 'sellRarity', rarity }),
  onToggleAutoEquip: on => heroAct({ type: 'autoEquip', on }),
  onClose: () => {},
});
// 클래스 해금은 최고 기록(best) 기준
const heroCtx = () => ({ stage: data.best, gold: game ? game.players[0].gold : data.gold });

// ── 디버그 파라미터 (브라우저 전용): ?stage=N ?gold=N ?lv=N | ?lv=atk:25,multi:0 ──
if (!native) {
  const q = new URLSearchParams(location.search);
  if (q.has('stage')) data.stage = Math.min(MAX_STAGE, Math.max(1, Math.floor(Number(q.get('stage'))) || 1));
  if (q.has('gold')) data.gold = Math.max(0, Number(q.get('gold')) || 0);
  if (q.has('lv')) {
    const v = q.get('lv');
    for (const part of v.split(',')) {
      const [k, n] = part.includes(':') ? part.split(':') : [null, part];
      for (const key of k ? [k] : UPGRADE_KEYS) if (UPGRADE_KEYS.includes(key)) data.lv[key] = Math.max(0, Math.floor(Number(n)) || 0);
    }
  }
  // ?spells=fireball:3,tornado → 스테이지 시작마다 스킬 지급(레벨 생략 = 1) · ?herolv=N · ?loot=rarity|all
  if (q.has('spells')) {
    dbgSpells = {};
    for (const part of q.get('spells').split(',')) {
      const [k, n] = part.split(':');
      if (SPELL_KEYS.includes(k)) dbgSpells[k] = Math.min(3, Math.max(1, Math.floor(Number(n)) || 1));
    }
  }
  if (q.has('herolv')) { data.hero.level = Math.min(MAX_HERO_LV, Math.max(1, Math.floor(Number(q.get('herolv'))) || 1)); data.hero.xp = 0; }
  if (q.has('loot')) dbgLoot = q.get('loot');
  // 콘솔 테스트용: __wd.frame(ms) 로 창이 가려져 있어도 프레임을 직접 돌릴 수 있다
  window.__wd = {
    get game() { return game; }, get data() { return data; }, frame: t => frame(t), ui, heroUI,
    loot: r => dropLoot(r),
  };
}

// ── 게임 생성 · 진행 ──
function playerInits() {
  return [
    { name: data.name, kind: 'human', gold: data.gold, lv: data.lv, perks: { ...data.perks }, auto: data.auto },
    // ponytail: 동료는 내 퍼크를 같이 씀(밸런스 테스트와 같은 조건). 협동 때 이 슬롯을 원격 플레이어로 교체
    { name: 'AI 동료', kind: 'bot', gold: data.partner.gold, lv: data.partner.lv, perks: { ...data.perks }, auto: true },
  ];
}

function onStart() {
  audio.unlock();
  ui.hideTitle();
  onTitle = false;
  // 영웅은 data.hero 를 그대로 넘긴다: sim이 제자리에서 바꾸므로 저장 객체와 늘 같다
  game = createGame({ stage: data.stage, best: data.best, players: playerInits(), discovered: data.discovered, hero: data.hero });
  game.speed = allowedSpeed(data.settings.speed);
  acc = 0;
  stopUntil = 0;
  grantDebugSpells();
  if (!game.hero.cls) heroUI.open(game.hero, heroCtx()); // 처음 시작: 클래스 선택(필수) 뒤 1층
}

function beginStage(stage) {
  startStage(game, stage);
  acc = 0;
  grantDebugSpells();
}

function nextStage() {
  if (!game) return;
  data.stage = Math.min(MAX_STAGE, game.stage + 1);
  beginStage(data.stage);
  persist();
}

// ── 디버그 (브라우저 전용) ──
function grantDebugSpells() {
  if (!dbgSpells || !game) return;
  Object.assign(game.spells, dbgSpells);
  refreshFusion(game);
}
// 지정 등급 장비를 전장에 떨어뜨린다(빛기둥 연출 확인용). 'all' = 등급별 1개씩
function dropLoot(r) {
  if (!game?.hero?.cls) return false;
  const list = r === 'all' ? RARITY_KEYS : RARITY_KEYS.includes(r) ? [r] : [];
  list.forEach((rarity, i) => {
    let item = null;
    for (let n = 0; n < 500 && item?.rarity !== rarity; n++) item = rollItem(game.stage, rarity === 'common' ? 'normal' : 'chest', Math.random, game.hero.cls);
    if (item.rarity !== rarity) return;
    addToBag(game.hero, item); // 가방이 가득 차면 최하위 자동 판매(디버그라 골드 생략)
    game.events.push({ type: 'loot', item, x: 120 + i * 120, y: 640 });
  });
  return list.length > 0;
}

const allowedSpeed = s => (s >= 3 && data.best < SPEED3_UNLOCK ? 1 : s);
function onSpeed() {
  const cur = game ? game.speed : data.settings.speed;
  const s = allowedSpeed(cur >= 3 ? 1 : cur + 1);
  data.settings.speed = s;
  if (game) game.speed = s;
  persist();
}

function onBuyPerk(key) {
  if (!PERK_KEYS.includes(key)) return;
  const lv = data.perks[key];
  if (lv >= perkMax(key)) return;
  const cost = perkCost(key, lv);
  if (data.gems < cost) { ui.toast('보석이 부족해요'); return; }
  data.gems -= cost;
  data.perks[key] = lv + 1;
  if (game) {
    for (const p of game.players) {
      p.perks[key] = lv + 1;
      p.stats = cannonStats(p.lv, p.perks);
    }
  }
  audio.play('upgrade');
  persist(true);
}

function onResetSave() {
  store.clear();
  data = store.defaults();
  game = null;
  heroUI.close();
  onTitle = true;
  audio.setEnabled(data.settings.sound);
  ui.showTitle({ best: 0, stage: 1 });
  ui.toast('저장을 초기화했어요');
}

// ── 저장 ──
function syncData() {
  if (!game) return;
  const [me, pa] = game.players;
  data.gold = me.gold;
  data.lv = { ...me.lv };
  data.auto = me.auto;
  data.partner = { gold: pa.gold, lv: { ...pa.lv } };
  data.discovered = [...game.discovered];
  if (game.hero) data.hero = game.hero; // 같은 객체(sim이 제자리 변경) — 방어적으로 다시 연결
}
function persist(now = false) {
  syncData();
  store.save(data);
  if (now) store.flush();
}

// ── 오프라인 보상 (부팅 · 앱 복귀) ──
function checkOffline() {
  const r = store.computeOffline(data);
  data.lastSeen = Date.now(); // 복귀 이벤트가 두 번 와도 한 번만 지급
  if (!(r.gold > 0)) return;
  ui.showOfflineReward(r, () => {
    if (game) game.players[0].gold += r.gold;
    else data.gold += r.gold;
    audio.play('coin');
    persist(true);
  });
}

function onHide() {
  persist(true);
}
function onShow() {
  lastT = performance.now();
  acc = 0;
  checkOffline();
}
document.addEventListener('visibilitychange', () => (document.hidden ? onHide() : onShow()));
addEventListener('pagehide', onHide);
App?.addListener('appStateChange', s => (s.isActive ? onShow() : onHide()));

// ── 이벤트 → 효과음 · 저장 ──
function handleEvents(events, now) {
  let stop = 0;
  for (const ev of events) {
    switch (ev.type) {
      case 'hitstop': stop = Math.max(stop, +ev.ms || 0); break;
      case 'shoot': if (ev.o === 0) audio.play('shoot'); break;
      case 'hit': audio.play(ev.crit ? 'crit' : 'hit'); break;
      case 'kill': audio.play(ev.isBoss ? 'big' : 'kill'); break;
      case 'boom': if (ev.kind !== 'meteor') audio.play(ev.kind === 'crit' ? 'crit' : 'big'); break;
      case 'wall': case 'thorns': audio.play('hit'); break;
      case 'skill': audio.play(ev.skill); break;
      case 'bossSpawn': case 'warn': case 'enrage': audio.play('boss'); break;
      case 'upgrade': if (ev.o === 0) audio.play('upgrade'); break;
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
      // 판타지 스킬 카드
      case 'pickOffer':
        audio.play('pickShow');
        for (let i = 0; i < (game.pick?.cards.length || 3); i++) setTimeout(() => audio.play('cardFlip'), 90 * i + 60);
        break;
      case 'spellPick': audio.play('pickConfirm', ev.rarity); break;
      case 'spell': audio.play('spell', ev.key); break;
      // 영웅
      case 'heroUlt': audio.play('big'); break;
      case 'heroDown': audio.play('defeat'); break;
      case 'heroRespawn': audio.play('upgrade'); break;
      case 'heroLevelUp':
        audio.play('clear');
        // 전장에선 캔버스 LEVEL UP 연출 + 마일스톤 토스트(ui.js)로 충분 — 영웅 화면이 전장을 가릴 때만 배너
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
        const r = game.result;
        data.best = Math.max(data.best, game.stage);
        data.gems += r?.gems?.[0] ?? 0;
        data.stage = Math.min(MAX_STAGE, game.stage + 1);
        nextAt = now + NEXT_DELAY;
        updSnooze = false;
        persist(true);
        break;
      }
      case 'defeat':
        audio.play('defeat');
        updSnooze = false;
        persist(true);
        break;
    }
  }
  if (stop > 0) {
    const ms = Math.min(HITSTOP_CAP, stop) * HITSTOP_SCALE[(game.speed | 0) - 1 || 0];
    stopUntil = Math.max(stopUntil, now + ms);
  }
}

// ── 업데이트 (네이티브 전용) ──
const modalOpen = id => !document.getElementById(id).hidden;
function maybeShowUpdate() {
  if (!pendingUpdate || updSnooze || modalOpen('m-update') || modalOpen('m-offline') || modalOpen('m-ending')) return;
  if (game?.pick || heroUI.isOpen()) return; // 카드 선택 · 영웅 화면(클래스 선택 포함) 중엔 띄우지 않음
  if (!(onTitle || (game && game.phase !== 'play') || modalOpen('m-menu'))) return;
  updSnooze = true; // [나중에] 뒤엔 다음 클리어/패배 때 다시
  ui.showUpdateReady(pendingUpdate);
}

async function onUpdateNow() {
  persist(true);
  let r = await updater.install();
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
  if (!native) { ui.toast('웹 버전은 항상 최신이에요'); return; }
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
  ui.setVersion('웹 버전');
}

// ── 안드로이드 뒤로가기: 모달 닫기 → 메뉴 열기, 타이틀에선 두 번 눌러 종료 ──
App?.addListener('backButton', () => {
  if (heroUI.handleBack()) return;
  if (ui.handleBack()) return;
  if (!onTitle) { document.getElementById('btn-menu').click(); return; }
  const now = performance.now();
  if (now - backAt < 2000) App.exitApp();
  else { backAt = now; ui.toast('한 번 더 누르면 종료돼요'); }
});

addEventListener('keydown', e => { if (e.key === 'Escape' && heroUI.handleBack()) e.preventDefault(); });

// 첫 터치에서 오디오 잠금 해제 (자동재생 정책)
addEventListener('pointerdown', () => audio.unlock(), { capture: true });

// 전장 탭 → 영웅 이동 (상단 HUD 띠·성벽 아래는 무시, sim이 좌표를 한 번 더 검증)
document.getElementById('game').addEventListener('pointerdown', e => {
  if (!game || game.phase !== 'play' || !game.heroUnit || game.pick || ui.isBusy() || heroUI.isOpen()) return;
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
  meta.best = data.best;
  meta.speed = game ? game.speed : data.settings.speed;
  meta.autoNext = data.settings.autoNext;
  meta.unlocked3x = data.best >= SPEED3_UNLOCK;
  meta.settings = data.settings;
  meta.perks = data.perks;
  meta.discovered = game ? game.discovered : data.discovered;

  if (onTitle || !game) {
    ui.update(null, meta);
    maybeShowUpdate();
    return;
  }

  // 카드 선택 중: 전투 정지(sim도 스스로 멈춤), 자동 강화면 실시간 카운트다운
  const picking = !!game.pick;
  if (picking && game.players[0].auto && !heroUI.isOpen()) tickPick(game, dt);
  // 전투 중 모달(메뉴·상점·영웅 화면 등)이 열리면 일시정지
  const paused = picking || (game.phase === 'play' && (ui.isBusy() || heroUI.isOpen()));
  const holding = now < stopUntil;
  if (dbgLoot && game.hero?.cls && game.phase === 'play' && !paused) { dropLoot(dbgLoot); dbgLoot = null; }
  if (!paused && !holding) {
    acc += dt * game.speed * simSlow();
    let n = 0;
    while (acc >= DT && n < MAX_STEPS) { step(game, DT); acc -= DT; n++; }
    if (n >= MAX_STEPS) acc = 0;
  } else acc = 0;

  const events = drainEvents(game);
  handleEvents(events, now);
  const out = renderer.frame(game, events, dt, {
    dmgNumbers: data.settings.dmgNumbers, shake: data.settings.shake, hitstop: holding || paused, myIndex: 0,
  });
  if (out.coins > 0) audio.play('coin');
  ui.onEvents(events, game);
  ui.update(game, meta);
  heroUI.update(game.hero, heroCtx());

  if (game.phase === 'clear' && data.settings.autoNext && now >= nextAt && !ui.isBusy() && !heroUI.isOpen()) {
    if (pendingUpdate && !updSnooze) maybeShowUpdate();
    else nextStage();
  } else maybeShowUpdate();

  if (now >= saveAt) { saveAt = now + SAVE_EVERY; persist(); }
}

// ── 부팅 ──
fontsReady(); // 번들 글꼴 로드 시작(캔버스 글자용). 전투는 타이틀 뒤라 보통 그 전에 끝난다
ui.showTitle({ best: data.best, stage: data.stage });
checkOffline();
loop(lastT = performance.now()); // 첫 프레임은 바로: 루프 전에 열린 도감·상점도 값이 채워지게

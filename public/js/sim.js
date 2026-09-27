// 순수 시뮬레이션 (DOM 없음, node 실행 가능)
import {
  WORLD_W, WORLD_H, WALL_Y, CANNONS, BULLET_SPEED, BULLET_R, MAX_STAGE,
  UPGRADE_KEYS, upgradeCost, upgradeMax, cannonStats, wallMax,
  goldPerKill, starsFor, RUN_GEMS, META_KEYS, metaMax, metaFx, SKILLS,
  COMBO_WINDOW, COMBO_TIERS, FRENZY, LEGEND_T, SYN_FX as FX, SYNERGIES, SYN_KEYS,
  SPELL_KEYS, SPELL_BY_KEY, RARITY_WEIGHT, MANA_MAX, MANA_FRAC, PICK_AUTO_T,
  SPELL_SLOTS, SPELL_MAX_LV, AWAKEN_KEYS, AWAKEN_BY_KEY,
} from './config.js';
import { themeOf, ENEMY_TYPES, BOSSES, ELITE, buildStage, enemyHp, enemyDmg, enemySpeedMul, bossHpMul } from './stages.js';
import { mulberry32, clamp, toInt } from './util.js';
import { autoUpgrade, autoSkill, autoHero, pickCard } from './bot.js';
import { initSpells, updateSpells, onCannonHit, onKill as onSpellKill, frostSlowMul, spellRateMul, curseMul, golemAbsorb } from './spells.js';
import {
  HERO_CLASSES, HERO_MELEE_R, spawnHeroUnit, updateHeroUnit, heroTakeDamage, heroEngageRadius,
  heroOnKill, heroGainXp, heroClearXp, castHeroUlt, heroBonuses, lootDrop,
  equipItem, sellItem, sellItemsByRarity, autoEquipAll, hasMilestone,
} from './hero.js';

const KINDS = ['human', 'bot', 'remote'];
const LV_CAP = 3000; // 무한 업그레이드의 안전 상한(수치 폭주 방지)
const BOT_INTERVAL = 0.25;
const MAX_EVENTS = 4000;
const CANNON_SYN = SYNERGIES.filter(s => s.kind === 'cannon');
const DUO_SYN = SYNERGIES.filter(s => s.kind === 'duo' && s.test);
const FUSION_SYN = SYNERGIES.filter(s => s.kind === 'fusion' && s.test);
// spells.js 에 넘기는 콜백 묶음 (함수 선언은 호이스팅되어 이 시점에 미리 참조해도 안전)
const SPELL_API = { damage, killEnemy, damageWall, emit, chainArc, frontMost };
const KB_K = 20, KB_MAX = 4;  // 넉백: 피해/최대체력 비례, 1타 최대 px
const BOMB_LINK = 1.8;          // 자폭병끼리 유폭 반경 배율
const FUSE_T = 1;               // 자폭병 성벽 도착 후 자폭까지(초)
const BULLET_LIFE = 1.5;         // 탄 수명(초)
const COMBO_ZONE = WALL_Y - 750; // 이 선을 넘은 적이 있어야 콤보 시간이 줄어듦
const HERO_MOVE_HOLD = 6;        // 탭 이동 후 자동 복귀까지(초)
const ACCEL_LEAD = 1.2, RUSH = 2; // 학살 가속: 필드가 비면 다음 스폰 묶음을 1.2초 뒤로 당기고 그 묶음은 2배 빠르게(압도적이면 층당 15~25초)
const REVIVE_HP = 0.5, REVIVE_FREEZE = 1.5; // 부활 결계: 성벽 50% 회복 + 잠깐 빙결
// 광폭화: 층이 BERSERK_T초를 넘기면 적 피해가 BERSERK_STEP초마다 2배, 이동은 감속·밀쳐내기 무시 — 버티기만 하는 교착을 끝낸다
const BERSERK_T = 80, BERSERK_STEP = 10;
// hero.js 에 넘기는 콜백 묶음(spells.js와 동일한 모양)
const HERO_API = SPELL_API;

const lvOf = src => {
  const lv = {};
  for (const k of UPGRADE_KEYS) lv[k] = toInt(src?.[k], 0, Math.min(LV_CAP, upgradeMax(k)));
  return lv;
};
const posNum = v => { v = Number(v); return Number.isFinite(v) && v > 0 ? v : 0; };

function makePlayer(init, i, fx) {
  init = init && typeof init === 'object' ? init : {};
  const lv = lvOf(init.lv);
  const gold = Number(init.gold);
  return {
    name: String(init.name ?? `P${i + 1}`).slice(0, 16),
    kind: KINDS.includes(init.kind) ? init.kind : 'human',
    gold: Number.isFinite(gold) && gold > 0 ? gold : 0,
    auto: !!init.auto,
    lv,
    cd: { meteor: 0, freeze: 0 },
    angle: -Math.PI / 2,
    stats: cannonStats(lv, fx),
    syn: [],       // 활성 대포 조합 키 (refreshSyn 이 채움)
    fireT: 0,
  };
}

const lvSum = g => g.players[0].lv.wall + g.players[1].lv.wall;
const wallCap = g => Math.floor(wallMax(lvSum(g)) * g.fx.wallMul);

// ── 런(도전) 상태 ──
// 런 필드(저장·이어하기 대상). spells/rerollLeft 는 game 최상위(g.spells, g.rerollLeft)에 둔다
const GEM_KEYS = ['floor', 'first', 'boss', 'flawless'];

// 신뢰할 수 없는 런 저장값 → 올바른 모양(절대 throw 없음). serializeRun()의 역
export function normalizeRun(raw) {
  const o = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const r = o(raw);
  const spells = {};
  for (const k of SPELL_KEYS) {
    const v = toInt(o(r.spells)[k], 0, SPELL_MAX_LV);
    if (v > 0 && Object.keys(spells).length < SPELL_SLOTS) spells[k] = v;
  }
  const awaken = {}, gems = {};
  for (const k of AWAKEN_KEYS) awaken[k] = toInt(o(r.awaken)[k], 0, 999);
  for (const k of GEM_KEYS) gems[k] = toInt(o(r.gems)[k], 0, 1e7);
  const pl = Array.isArray(r.players) ? r.players : [];
  const lo = o(r.loadout);
  return {
    v: 1,
    stage: toInt(r.stage, 1, MAX_STAGE),
    players: [0, 1].map(i => ({ gold: posNum(o(pl[i]).gold), lv: lvOf(o(o(pl[i]).lv)) })),
    auto: !!r.auto,
    spells,
    rerollLeft: r.rerollLeft == null ? null : toInt(r.rerollLeft, 0, 99),
    awaken, gems,
    reviveUsed: !!r.reviveUsed,
    floors: toInt(r.floors, 0, MAX_STAGE),
    bosses: toInt(r.bosses, 0, MAX_STAGE),
    firstClears: toInt(r.firstClears, 0, MAX_STAGE),
    flawless: toInt(r.flawless, 0, MAX_STAGE),
    time: posNum(r.time),
    startBest: toInt(r.startBest, 0, MAX_STAGE),
    loadout: {
      cls: typeof lo.cls === 'string' && Object.hasOwn(HERO_CLASSES, lo.cls) ? lo.cls : null,
      startSpells: [...new Set(Array.isArray(lo.startSpells) ? lo.startSpells : [])].filter(k => SPELL_KEYS.includes(k)).slice(0, SPELL_SLOTS),
    },
  };
}

// 스테이지 시작 시점의 런 상태(이어하기용 JSON). startStage가 g.run.checkpoint 에 자동으로 남긴다
export function serializeRun(g) {
  const r = g.run;
  return {
    v: 1, stage: g.stage,
    players: g.players.map(p => ({ gold: p.gold, lv: { ...p.lv } })),
    auto: g.players[0].auto,
    spells: { ...g.spells }, rerollLeft: g.rerollLeft,
    awaken: { ...r.awaken }, gems: { ...r.gems },
    reviveUsed: r.reviveUsed, floors: r.floors, bosses: r.bosses, firstClears: r.firstClears, flawless: r.flawless,
    time: r.time, startBest: r.startBest,
    loadout: { cls: r.loadout.cls, startSpells: [...r.loadout.startSpells] },
  };
}

// 영구 강화 × 각성 → 런 배율
function computeFx(g) {
  const f = metaFx(g.metaLv), a = g.run.awaken, A = AWAKEN_BY_KEY;
  f.atkMul *= 1 + A.power.atk * a.power;
  f.rateMul *= 1 + A.haste.rate * a.haste;
  f.wallMul *= 1 + A.ward.wall * a.ward;
  f.goldMul *= 1 + A.fortune.gold * a.fortune;
  return f;
}
function refreshFx(g) {
  g.fx = computeFx(g);
  for (const p of g.players) p.stats = cannonStats(p.lv, g.fx);
  const max = wallCap(g);
  g.wall.hp = Math.min(max, g.wall.hp + Math.max(0, max - g.wall.max));
  g.wall.max = max;
}

function emit(g, ev) {
  if (g.events.length < MAX_EVENTS) g.events.push(ev);
}

// opts: { stage, players, best, seed, discovered, hero, metaLv:{key:lv}, run:(serializeRun 모양, 없으면 새 런), seenSpells }
export function createGame(opts = {}) {
  const pl = Array.isArray(opts.players) ? opts.players : [];
  const run = normalizeRun(opts.run);
  const metaLv = {};
  for (const k of META_KEYS) metaLv[k] = toInt(opts.metaLv?.[k], 0, metaMax(k));
  const g = {
    stage: 1, theme: 0, phase: 'play', phaseT: 0, speed: 1,
    wall: { hp: 0, max: 0 },
    progress: { total: 0, killed: 0 },
    boss: null, freezeT: 0, berserk: 1,
    enemies: [], bullets: [], eshots: [],
    players: [],
    result: null,
    events: [],
    // 내부 상태
    best: toInt(opts.best, 0, MAX_STAGE),
    rng: mulberry32(opts.seed ?? (Math.random() * 2 ** 32)),
    // 영웅 전용 rng: 대포·스폰 rng 스트림과 분리해 영웅 드롭/치명타가 기존 밸런스 타이밍에 영향을 주지 않게 한다
    heroRng: mulberry32(((opts.seed ?? (Math.random() * 2 ** 32)) >>> 0) + 0x9e3779b9),
    spawns: [], spawnIdx: 0, nextId: 1,
    wallLost: 0,   // 이번 스테이지 성벽 피해 누적
    lastLoss: 0,   // 직전 스테이지 성벽 손실 비율(패배=1) — 봇 판단용
    botT: 0,
    bossBar: { name: '', hp: 0, maxHp: 0, shield: 0 },
    // 중독성 레이어
    combo: { count: 0, timer: 0, tier: 0, best: 0 },
    frenzyT: 0, legendT: 0,
    duo: [],
    discovered: new Set(Array.isArray(opts.discovered) ? opts.discovered.filter(k => SYN_KEYS.includes(k)) : []),
    killTimes: [], lastSkill: { meteor: null, freeze: null }, chain: null, critStopT: 0,
    // 판타지 스킬 (런 전체 누적 빌드)
    mana: { cur: 0, max: MANA_MAX }, spells: { ...run.spells }, fusions: [], pick: null,
    seenSpells: new Set(Array.isArray(opts.seenSpells) ? opts.seenSpells.filter(k => SPELL_KEYS.includes(k)) : []),
    // 런(도전): 영구 강화 레벨 · 런 기록. fx = 영구 강화 × 각성 배율
    metaLv, fx: null,
    run: {
      awaken: run.awaken, gems: run.gems, reviveUsed: run.reviveUsed, floors: run.floors, bosses: run.bosses,
      firstClears: run.firstClears, flawless: run.flawless, time: run.time,
      startBest: opts.run ? run.startBest : toInt(opts.best, 0, MAX_STAGE), loadout: run.loadout,
      over: false, victory: false, ended: false, checkpoint: null,
    },
    rerollLeft: 0,
    spawnT: 0,
    // 영웅(클래스 필드 유닛) — opts.hero 없으면 완전히 비활성(기존 동작과 100% 동일)
    hero: opts.hero && typeof opts.hero === 'object' ? opts.hero : null,
    heroUnit: null,
  };
  for (const k of Object.keys(g.spells)) g.seenSpells.add(k);
  g.fx = computeFx(g);
  g.players = [makePlayer(pl[0], 0, g.fx), makePlayer(pl[1], 1, g.fx)];
  // 새로고침: 영웅 Lv5(1회) + 영구 강화. 런 전체에서 쓰는 횟수(이어하기면 저장값)
  g.rerollLeft = run.rerollLeft ?? (g.hero && hasMilestone(g.hero.level, 'reroll1') ? 1 : 0) + g.fx.rerolls;
  initSpells(g);
  refreshFusion(g);
  startStage(g, opts.stage ?? (opts.run ? run.stage : 1));
  refreshSyn(g);
  return g;
}

export function startStage(g, stage) {
  stage = toInt(stage, 1, MAX_STAGE);
  const carry = g.phase === 'clear'; // 클리어 직후 다음 판이면 콤보·광란·전설 이어감
  g.stage = stage;
  g.theme = themeOf(stage);
  g.phase = 'play';
  g.phaseT = 0;
  g.freezeT = 0;
  g.berserk = 1;
  g.result = null;
  g.boss = null;
  g.enemies.length = 0;
  g.bullets.length = 0;
  g.eshots.length = 0;
  const plan = buildStage(stage, g.rng);
  g.spawns = plan.spawns;
  g.spawnIdx = 0;
  g.progress.total = plan.total;
  g.progress.killed = 0;
  g.spawnT = g.rushT = 0;
  g.wall.max = wallCap(g);
  g.wall.hp = g.wall.max;
  g.wallLost = 0;
  if (!carry) {
    g.combo.count = g.combo.timer = g.combo.tier = 0;
    g.frenzyT = g.legendT = 0;
  }
  g.critStopT = 0;
  g.killTimes.length = 0;
  g.lastSkill.meteor = g.lastSkill.freeze = null;
  g.chain = null;
  g.pick = null;
  initSpells(g); // 스킬 빌드(g.spells)는 런 전체 유지, 전장 효과·쿨타임만 새로
  g._manaMark = Math.max(1, Math.ceil(plan.total * MANA_FRAC));
  g._manaDone = false;
  g.mana = { cur: 0, max: MANA_MAX };
  for (const p of g.players) {
    p.stats = cannonStats(p.lv, g.fx);
    p.fireT = 0;
  }
  // 영웅: 스테이지마다 성문에서 다시 걸어 나간다(레벨·장비는 g.hero에 영구 보존)
  g.heroUnit = g.hero && g.hero.cls ? spawnHeroUnit(g.hero) : null;
  g.run.checkpoint = serializeRun(g); // 이어하기: 이 스테이지 시작부터
  // 영웅 Lv30: 도전 시작(1층) 시 카드 1장 추가
  if (stage === 1 && g.run.floors === 0 && g.hero && g.hero.cls && hasMilestone(g.hero.level, 'extraCard')) triggerPick(g);
}

export function setPlayer(g, i, init) {
  if (i !== 0 && i !== 1) return;
  const ratio = g.wall.max > 0 ? g.wall.hp / g.wall.max : 1;
  g.players[i] = makePlayer(init, i, g.fx);
  g.wall.max = wallCap(g);
  g.wall.hp = g.wall.max * ratio;
  refreshSyn(g);
}

// ── 히든 조합 ──
// 레벨 기반 조합 재계산. 새로 켜진 것만 synergy 이벤트
function refreshSyn(g) {
  for (let i = 0; i < 2; i++) {
    const p = g.players[i], old = p.syn;
    p.syn = CANNON_SYN.filter(s => s.test(p.lv)).map(s => s.key);
    for (const k of p.syn) if (!old.includes(k)) synergy(g, k, i, CANNONS[i].x, CANNONS[i].y - 40);
  }
  const old = g.duo, [a, b] = g.players;
  g.duo = DUO_SYN.filter(s => s.test(a.lv, b.lv)).map(s => s.key);
  for (const k of g.duo) if (!old.includes(k)) synergy(g, k, -1, WORLD_W / 2, CANNONS[0].y - 40);
}

function synergy(g, key, o, x, y) {
  const first = !g.discovered.has(key);
  g.discovered.add(key);
  emit(g, { type: 'synergy', key, o, first, x, y });
  if (first) emit(g, { type: 'hitstop', ms: 350 });
}

export function drainEvents(g) {
  const ev = g.events;
  g.events = [];
  return ev;
}

// ── 판타지 스킬 카드 뽑기 ──
// 아직 발견 못 한 융합을 완성시키는 카드인지(참일 때 UI는 조건 없이 ✦ 표시만)
function wouldFuse(g, key) {
  const hyp = { ...g.spells, [key]: (g.spells[key] || 0) + 1 };
  return FUSION_SYN.some(f => !g.discovered.has(f.key) && f.test(hyp));
}

// 영웅 Lv50 마일스톤: 전설 카드 확률 상승
function rarityWeight(g, key) {
  const w = RARITY_WEIGHT[SPELL_BY_KEY[key].rarity];
  const boosted = g.hero && SPELL_BY_KEY[key].rarity === 'legend' && hasMilestone(g.hero.level, 'legendBoost');
  return boosted ? w * 2 : w;
}
function weightedKey(g, keys) {
  let sum = 0;
  for (const k of keys) sum += rarityWeight(g, k);
  let x = g.rng() * sum;
  for (const k of keys) { x -= rarityWeight(g, k); if (x < 0) return k; }
  return keys[keys.length - 1];
}

// 선택지 수 = 3 + 영웅 Lv15(+1) + 영구 강화 '카드 선택지'(+1)
export const cardCount = g => 3 + (g.hero && hasMilestone(g.hero.level, 'choose4') ? 1 : 0) + g.fx.choices;

// 슬롯 6칸 · Lv1~5. 슬롯이 차면 보유 스킬 강화 카드만, 모자라는 자리는 각성 카드로 채운다(중복 없음)
function genCards(g) {
  const n = cardCount(g);
  const full = Object.keys(g.spells).length >= SPELL_SLOTS;
  let pool = SPELL_KEYS.filter(k => (g.spells[k] || 0) < SPELL_MAX_LV && (!full || g.spells[k] > 0));
  const cards = [];
  while (cards.length < n && pool.length) {
    const k = weightedKey(g, pool);
    pool = pool.filter(x => x !== k);
    const spell = SPELL_BY_KEY[k];
    cards.push({ spell: k, level: (g.spells[k] || 0) + 1, rarity: spell.rarity, fusionHint: wouldFuse(g, k) });
  }
  const aw = AWAKEN_KEYS.slice();
  while (cards.length < n && aw.length) {
    const k = aw.splice(Math.floor(g.rng() * aw.length), 1)[0];
    cards.push({ spell: null, awaken: k, level: g.run.awaken[k] + 1, rarity: 'common', fusionHint: false });
  }
  return cards;
}

function triggerPick(g) {
  if (g.pick) return; // 이미 선택 중이면 새로 띄우지 않음(마나만 계속 쌓일 수 있음)
  const cards = genCards(g);
  if (!cards.length) return; // 모든 스킬 만렙인 극단적 상황
  g.pick = { cards, autoLeft: g.players[0].auto ? PICK_AUTO_T : null };
  emit(g, { type: 'pickOffer' });
}

// 층마다 처치 진행률 60%(MANA_FRAC) 지점에서 마나가 가득 차 카드 1장.
// 영웅 장비의 마나 충전%만큼 그 지점이 앞당겨진다
function gainMana(g) {
  if (g.pick || g._manaDone) return;
  const manaMul = g.hero ? heroBonuses(g.hero).manaMul : 1;
  const mark = Math.max(1, g._manaMark / manaMul);
  g.mana.cur = clamp(MANA_MAX * g.progress.killed / mark, 0, MANA_MAX);
  if (g.progress.killed >= mark) {
    g._manaDone = true;
    g.mana.cur = MANA_MAX;
    triggerPick(g);
  }
}

// 원소 융합 재계산 (스킬 레벨이 바뀔 때). 새로 켜진 것만 synergy 이벤트(기존 발견 목록 재사용)
// export: applyPick이 내부에서 부르지만, 테스트가 game.spells를 직접 바꾼 뒤 재계산시키는 용도로도 씀
export function refreshFusion(g) {
  const old = g.fusions;
  const cur = FUSION_SYN.filter(s => s.test(g.spells)).map(s => s.key);
  for (const k of cur) if (!old.includes(k)) synergy(g, k, -1, WORLD_W / 2, WALL_Y / 2 - 100);
  g.fusions = cur;
}

function applyPick(g, i, index) {
  if (i !== 0 || !g.pick) return false; // 카드는 플레이어(0번) 전용
  const cards = g.pick.cards;
  if (!Number.isInteger(index) || index < 0 || index >= cards.length) return false;
  const card = cards[index];
  g.pick = null;
  if (card.awaken) { // 각성: 런 동안 소폭 스탯 누적
    g.run.awaken[card.awaken]++;
    refreshFx(g);
    emit(g, { type: 'spellPick', spell: null, awaken: card.awaken, level: card.level, rarity: card.rarity });
    return true;
  }
  g.spells[card.spell] = card.level;
  g.seenSpells.add(card.spell);
  emit(g, { type: 'spellPick', spell: card.spell, level: card.level, rarity: card.rarity });
  refreshFusion(g);
  return true;
}

// 카드 새로고침(런 전체 rerollLeft회: 영웅 Lv5 + 영구 강화). 자동 선택 카운트다운도 처음부터
function rerollPick(g, i) {
  if (i !== 0 || !g.pick || !(g.rerollLeft > 0)) return false;
  const cards = genCards(g);
  if (!cards.length) return false;
  g.rerollLeft--;
  g.pick = { cards, autoLeft: g.pick.autoLeft == null ? null : PICK_AUTO_T };
  emit(g, { type: 'pickOffer', reroll: true });
  return true;
}

// 카드가 떠 있는 동안(전투 정지) 호출측이 매 프레임 넘기는 실시간 델타(초).
// 자동 강화가 켜져 있으면 3초 뒤 봇 휴리스틱으로 자동 선택
export function tickPick(g, dtReal) {
  if (!g.pick || g.pick.autoLeft == null || !(dtReal > 0)) return;
  g.pick.autoLeft -= dtReal;
  if (g.pick.autoLeft <= 0) applyPick(g, 0, pickCard(g, g.pick.cards));
}

// 플레이어 행동 (게스트 입력이 그대로 들어오므로 전부 검증)
export function act(g, i, action) {
  if ((i !== 0 && i !== 1) || !action || typeof action !== 'object') return false;
  if (action.type === 'pick') return applyPick(g, i, action.index);
  if (action.type === 'reroll') return rerollPick(g, i);
  if (g.pick) return false; // 카드 선택 중엔 다른 조작 불가(전투 정지)
  const p = g.players[i];
  if (action.type === 'upgrade') {
    const stat = action.stat;
    if (!UPGRADE_KEYS.includes(stat)) return false;
    const lv = p.lv[stat];
    if (lv >= upgradeMax(stat) || lv >= LV_CAP) return false;
    const cost = upgradeCost(stat, lv);
    if (!(p.gold >= cost)) return false;
    p.gold -= cost;
    p.lv[stat] = lv + 1;
    p.stats = cannonStats(p.lv, g.fx);
    if (stat === 'wall') {
      const max = wallCap(g);
      g.wall.hp += max - g.wall.max;
      g.wall.max = max;
    }
    emit(g, { type: 'upgrade', o: i, stat, lv: lv + 1 });
    refreshSyn(g);
    return true;
  }
  if (action.type === 'skill') {
    const sk = action.skill;
    if (g.phase !== 'play' || !Object.hasOwn(SKILLS, sk) || p.cd[sk] > 0) return false;
    p.cd[sk] = SKILLS[sk].cd;
    emit(g, { type: 'skill', o: i, skill: sk });
    // 이중 필살: 상대가 1.5초 안에 같은 스킬을 썼으면 효과 2배
    const prev = g.lastSkill[sk];
    const dbl = !!prev && prev.o !== i && g.phaseT - prev.t <= FX.doubleWindow;
    g.lastSkill[sk] = { o: i, t: g.phaseT }; // 상대 쿨타임(≥40초)이 창(1.5초)보다 길어 3연속은 불가
    if (dbl) synergy(g, 'double', -1, WORLD_W / 2, WALL_Y / 2);
    if (sk === 'freeze') g.freezeT = Math.max(g.freezeT, dbl ? FX.doubleFreeze : SKILLS.freeze.dur);
    else meteor(g, i, dbl);
    return true;
  }
  if (action.type === 'auto') {
    p.auto = !!action.on;
    return true;
  }
  if (action.type === 'heroClass') {
    const hero = g.hero;
    if (!hero) return false;
    if (hero.cls && (g.phaseT > 0 || g.run.floors > 0)) return false; // 클래스는 도전 단위: 도전이 시작되면 고정
    const cls = Object.hasOwn(HERO_CLASSES, action.cls) && HERO_CLASSES[action.cls];
    if (!cls || !cls.unlock(g.best)) return false;
    hero.cls = action.cls;
    g.run.loadout.cls = action.cls;
    g.heroUnit = spawnHeroUnit(hero);
    return true;
  }
  if (action.type === 'heroMove') {
    if (!g.heroUnit || g.heroUnit.state === 'down') return false;
    const x = toInt(action.x, 0, WORLD_W), y = toInt(action.y, 0, WALL_Y);
    g.heroUnit.moveTo = { x, y, holdT: HERO_MOVE_HOLD };
    return true;
  }
  if (action.type === 'heroUlt') {
    return !!g.heroUnit && castHeroUlt(g, HERO_API);
  }
  if (action.type === 'equip') {
    return !!g.hero && equipItem(g.hero, action.itemId);
  }
  if (action.type === 'sell') {
    if (!g.hero) return false;
    const v = sellItem(g.hero, action.itemId);
    if (v == null) return false;
    g.players[0].gold += v;
    return true;
  }
  if (action.type === 'sellRarity') {
    if (!g.hero) return false;
    const v = sellItemsByRarity(g.hero, action.rarity);
    if (!v) return false;
    g.players[0].gold += v;
    return true;
  }
  if (action.type === 'autoEquip') {
    if (!g.hero) return false;
    g.hero.autoEquip = !!action.on;
    if (g.hero.autoEquip) autoEquipAll(g.hero);
    return true;
  }
  return false;
}

function meteor(g, o, dbl) {
  // 빙하 운석: 다른 대포의 빙결 후 3초 안 (빙결 5초 > 3초라 적은 아직 얼어 있음)
  const fz = g.lastSkill.freeze;
  const glacier = !!fz && fz.o !== o && g.phaseT - fz.t <= FX.glacierWindow && g.freezeT > 0;
  if (glacier) synergy(g, 'glacier', -1, WORLD_W / 2, WALL_Y / 2);
  const pct = SKILLS.meteor.bossPct * (glacier ? FX.glacier : 1);
  const es = g.enemies;
  for (let s = dbl ? 2 : 1; s > 0; s--) {
    for (let j = 0; j < es.length; j++) {
      const e = es[j];
      if (e.dead) continue;
      if (glacier) emit(g, { type: 'shatter', x: e.x, y: e.y });
      if (e.isBoss) { // 엘리트·네임드는 최대 체력의 일부만
        e.hp -= e.maxHp * pct;
        e.hitT = 0.12;
        if (e.hp <= 0) killEnemy(g, e, o, true);
      } else killEnemy(g, e, o, false);
    }
    emit(g, { type: 'boom', x: WORLD_W / 2, y: WALL_Y / 2, r: 700, kind: 'meteor' });
  }
  g.eshots.length = 0;
  emit(g, { type: 'hitstop', ms: 200 });
}

// ── 메인 스텝 ──
export function step(g, dt) {
  if (!(dt > 0)) return;
  if (g.pick) return; // 카드 선택 중엔 전투 정지(시간도 멈춤). 실시간 진행은 tickPick()이 맡는다
  if (dt > 0.1) dt = 0.1;
  g.phaseT += dt;
  // 자동 강화 / AI 스킬
  g.botT += dt;
  if (g.botT >= BOT_INTERVAL) {
    g.botT -= BOT_INTERVAL;
    for (let i = 0; i < 2; i++) {
      const p = g.players[i];
      if (p.auto) autoUpgrade(g, i);
      if (p.kind === 'bot' && g.phase === 'play') autoSkill(g, i);
    }
    if (g.players[0].auto) autoHero(g); // 영웅은 플레이어(0번) 소유
  }
  if (g.phase !== 'play') return;

  for (const p of g.players) {
    if (p.cd.meteor > 0) p.cd.meteor = Math.max(0, p.cd.meteor - dt);
    if (p.cd.freeze > 0) p.cd.freeze = Math.max(0, p.cd.freeze - dt);
  }
  if (g.freezeT > 0) g.freezeT = Math.max(0, g.freezeT - dt);
  if (g.frenzyT > 0) g.frenzyT = Math.max(0, g.frenzyT - dt);
  if (g.legendT > 0) g.legendT = Math.max(0, g.legendT - dt);
  if (g.critStopT > 0) g.critStopT -= dt;
  if (g.phaseT > BERSERK_T) {
    if (g.berserk === 1) emit(g, { type: 'berserk' });
    g.berserk = 2 ** ((g.phaseT - BERSERK_T) / BERSERK_STEP);
  }

  // 학살 가속: 필드가 비면 다음 스폰 묶음(burst)을 바로 당긴다(압도적인 층은 빨리 지나간다)
  g.spawnT += g.spawnT < g.rushT ? dt * RUSH : dt;
  if (g.enemies.length === 0 && g.spawnIdx < g.spawns.length && g.spawns[g.spawnIdx].t - ACCEL_LEAD > g.spawnT) {
    const sp = g.spawns, b = sp[g.spawnIdx].burst;
    let j = g.spawnIdx;
    while (j + 1 < sp.length && sp[j + 1].burst === b) j++;
    g.spawnT = sp[g.spawnIdx].t - ACCEL_LEAD;
    g.rushT = sp[j].t;
  }
  while (g.spawnIdx < g.spawns.length && g.spawns[g.spawnIdx].t <= g.spawnT) {
    const s = g.spawns[g.spawnIdx++];
    spawnEnemy(g, s.type, s.x, null, s.elite, s.boss);
  }

  updateCannons(g, dt);
  updateEnemies(g, dt);
  updateEshots(g, dt);
  updateBullets(g, dt);
  updateSpells(g, dt, SPELL_API);
  if (g.hero && g.hero.cls) updateHeroUnit(g, dt, HERO_API);

  // 죽은 적 제거 (swap-remove)
  const es = g.enemies;
  for (let j = es.length - 1; j >= 0; j--) {
    if (es[j].dead) { es[j] = es[es.length - 1]; es.pop(); }
  }

  updateBossBar(g);
  // 콤보 시간은 적이 성벽 쪽 위험 구역에 있을 때만 흐름 (멀리서 다 잡아내는 동안엔 안 끊김)
  const f = g.combo.timer > 0 ? frontMost(g) : null;
  if (f && f.y + f.r > COMBO_ZONE && (g.combo.timer -= dt) <= 0) endCombo(g);

  if (g.phase === 'play' && g.spawnIdx >= g.spawns.length && es.length === 0) {
    const ratio = g.wall.hp / g.wall.max;
    const stars = starsFor(ratio);
    const firstClear = g.stage > g.best;
    const flawless = g.wall.hp >= g.wall.max;
    // 런 보석 적립(도전 종료 때 지급): 층 + 무결점 50% + 첫 돌파
    const run = g.run, base = RUN_GEMS.floor(g.stage), fl = flawless ? Math.ceil(base * FX.flawlessGem) - base : 0;
    const first = firstClear ? RUN_GEMS.first(g.stage) : 0;
    run.gems.floor += base; run.gems.flawless += fl; run.gems.first += first;
    run.floors++; run.time += g.phaseT;
    if (firstClear) run.firstClears++;
    if (flawless) run.flawless++;
    const gem = base + fl + first;
    g.result = { stars, gems: [gem, gem], firstClear, time: g.phaseT, flawless };
    g.best = Math.max(g.best, g.stage);
    g.lastLoss = 1 - ratio;
    g.phase = 'clear';
    g.phaseT = 0;
    g.pick = null; // 마지막 처치와 같은 스텝에 뜬 카드는 버린다(드묾)
    g.bullets.length = 0;
    g.eshots.length = 0;
    emit(g, { type: 'clear', stage: g.stage, stars, gems: [gem, gem] });
    if (flawless) synergy(g, 'flawless', -1, WORLD_W / 2, WALL_Y);
    if (g.hero && g.hero.cls) {
      heroGainXp(g, heroClearXp(g.stage, firstClear), HERO_API);
      lootDrop(g, 'chest', WORLD_W / 2, WALL_Y - 120, HERO_API); // 클리어 보물상자
    }
    if (g.stage >= MAX_STAGE) endOfRun(g, true); // 100층 돌파 = 도전 완료
  }
}

// ── 적 생성 ──
function spawnEnemy(g, type, x, y, elite, boss) {
  const B = boss ? BOSSES[type] : null;
  const T = B || ENEMY_TYPES[type];
  if (!T) return null;
  const st = g.stage;
  const em = elite ? ELITE : null;
  const r = elite ? T.r * em.r : T.r;
  const hp = enemyHp(st) * T.hp * (em ? em.hp : 1) * (elite || boss ? bossHpMul(st) : 1);
  const e = {
    id: g.nextId++, type, name: elite ? '거대 ' + T.name : T.name,
    x: clamp(x, r, WORLD_W - r), y: y ?? -r, r,
    hp, maxHp: hp, shield: 0, frozen: g.freezeT > 0,
    isBoss: !!(elite || boss), named: !!boss, elite: !!elite,
    hitT: 0, state: boss && B.beh === 'chariot' ? 'charge' : 'walk',
    beh: T.beh,
    speed: T.speed * enemySpeedMul(st) * (em ? em.speed : 1),
    vx: 0, vy: 0,
    dmg: enemyDmg(st) * T.dmg * (em ? em.dmg : 1),
    gold: Math.ceil(goldPerKill(st) * T.gold * (em ? em.gold : 1)),
    reduce: T.beh === 'shield' ? 0.4 : 1,
    stopY: T.beh === 'thrower' ? 520 + g.rng() * 160 : 0,
    t: 0, t2: 0, t3: 0, atkT: 0, cycle: 0, enraged: false, dead: false,
    burn: 0, burnT: 0, burnO: 0, // 불꽃 산탄: 남은 화상 피해, 남은 시간, 가해자
  };
  if (boss) {
    e.stopY = { lich: 260, golem: 520, demonLord: 300, dragon: 170 }[T.beh] ?? 0;
  }
  g.enemies.push(e);
  if (e.isBoss) emit(g, { type: 'bossSpawn', name: e.name, named: e.named });
  if (boss) triggerPick(g); // 네임드 보스 등장 시 추가 카드 1장
  return e;
}

// 소환/분열: 진행도 total 도 증가. 소환수는 체력 절반
function summon(g, type, x, y) {
  const e = spawnEnemy(g, type, x, y, false, false);
  if (e) {
    g.progress.total++;
    e.hp = e.maxHp = e.maxHp * 0.5;
  }
  return e;
}

// ── 대포 ──
function frontMost(g) {
  let best = null;
  const es = g.enemies;
  for (let j = 0; j < es.length; j++) {
    const e = es[j];
    if (!e.dead && e.y + e.r > 0 && (!best || e.y > best.y)) best = e;
  }
  return best;
}

function updateCannons(g, dt) {
  const tgt = frontMost(g);
  for (let i = 0; i < 2; i++) {
    const p = g.players[i], c = CANNONS[i];
    const rate = p.stats.rate * (i === 0 ? spellRateMul(g) : 1); // 질풍: 플레이어 공격속도만
    const iv = 1 / (g.frenzyT > 0 ? Math.min(FRENZY.rateCap, rate * FRENZY.rateMul) : rate);
    p.fireT += dt;
    if (!tgt) {
      if (p.fireT > iv) p.fireT = iv;
      continue;
    }
    // 리드 조준 (2회 반복 근사)
    let tx = tgt.x, ty = tgt.y;
    for (let k = 0; k < 2; k++) {
      const tt = Math.hypot(tx - c.x, ty - c.y) / BULLET_SPEED;
      tx = tgt.x + tgt.vx * tt;
      ty = tgt.y + tgt.vy * tt;
    }
    p.angle = Math.atan2(ty - c.y, tx - c.x);
    if (p.fireT >= iv) {
      p.fireT -= iv;
      if (p.fireT > iv) p.fireT = iv;
      fire(g, i, p, c);
    }
  }
}

function fire(g, i, p, c) {
  const n = p.stats.shots, sp = p.stats.spread;
  const mx = c.x + Math.cos(p.angle) * 30, my = c.y + Math.sin(p.angle) * 30;
  const angles = new Array(n);
  const syn = p.syn, pierce = syn.includes('pierce'), homing = syn.includes('homing');
  const kind = pierce ? 'pierce' : syn.includes('flame') ? 'flame' : homing ? 'homing' : 'normal';
  // 조준선에 항상 탄이 가도록: 짝수 발이면 가운데 두 발을 조준선 양옆 0.02rad에 둔다
  const half = (n - 1) / 2, even = n % 2 === 0;
  const stepA = n > 1 ? sp / (2 * (even ? half - 0.5 : half)) : 0;
  for (let k = 0; k < n; k++) {
    const u = k - half;
    const a = even ? p.angle + Math.sign(u) * ((Math.abs(u) - 0.5) * stepA + 0.02) : p.angle + u * stepA;
    angles[k] = a;
    g.bullets.push({
      x: mx, y: my, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, owner: i, kind,
      hit: pierce ? [] : null,       // 관통탄: 이미 맞은 적 id
      tgt: homing ? null : false,    // 유도: null=탐색 필요, false=안 함
      life: 0,
    });
  }
  emit(g, { type: 'shoot', o: i, x: mx, y: my, angles });
}

// ── 탄환 ──
function updateBullets(g, dt) {
  const bs = g.bullets, es = g.enemies;
  // 적이 있는 세로 구간 밖의 탄은 충돌 검사 생략(성능)
  let y0 = Infinity, y1 = -Infinity;
  for (let j = 0; j < es.length; j++) {
    const e = es[j];
    if (e.dead) continue;
    if (e.y - e.r < y0) y0 = e.y - e.r;
    if (e.y + e.r > y1) y1 = e.y + e.r;
  }
  y0 -= BULLET_R; y1 += BULLET_R;
  for (let bi = bs.length - 1; bi >= 0; bi--) {
    const b = bs[bi];
    if (b.tgt !== false) steer(g, b, dt);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // 수명: 직진탄은 1초 안에 화면을 벗어남. 유도탄이 회전 반경 안의 표적 주위를 영원히 도는 것 방지
    let gone = (b.life += dt) > BULLET_LIFE || b.x < -20 || b.x > WORLD_W + 20 || b.y < -60 || b.y > WORLD_H;
    if (!gone && b.y >= y0 && b.y <= y1) {
      for (let j = 0; j < es.length; j++) {
        const e = es[j];
        if (e.dead) continue;
        const rr = e.r + BULLET_R, dy = b.y - e.y;
        if (dy > rr || dy < -rr) continue;
        const dx = b.x - e.x;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (b.hit) {
          if (b.hit.includes(e.id)) continue;
          b.hit.push(e.id);
          hitEnemy(g, e, b.owner, b.kind);
          if (b.hit.length < FX.pierce) continue;
        } else hitEnemy(g, e, b.owner, b.kind);
        gone = true;
        break;
      }
    }
    if (gone) { bs[bi] = bs[bs.length - 1]; bs.pop(); }
  }
}

const HOMING_COS = Math.cos(0.7);

// 유도 미사일: 진행 방향 ±0.7rad 안에서 각도가 가장 가까운 적을 쫓음 (표적이 죽으면 재탐색). 삼각함수 대신 내적/외적
function steer(g, b, dt) {
  let t = b.tgt;
  if (!t || t.dead) {
    t = null;
    let best = HOMING_COS;
    const es = g.enemies, hx = b.vx / BULLET_SPEED, hy = b.vy / BULLET_SPEED;
    for (let j = 0; j < es.length; j++) {
      const e = es[j];
      if (e.dead || e.y + e.r < 0) continue;
      const dx = e.x - b.x, dy = e.y - b.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const c = (dx * hx + dy * hy) / d;
      if (c > best) { best = c; t = e; }
    }
    b.tgt = t || false; // 못 찾으면 직진
    if (!t) return;
  }
  const mx = FX.homingTurn * dt, dx = t.x - b.x, dy = t.y - b.y;
  const da = clamp(Math.atan2(b.vx * dy - b.vy * dx, b.vx * dx + b.vy * dy), -mx, mx);
  const c = Math.cos(da), s = Math.sin(da), vx = b.vx * c - b.vy * s;
  b.vy = b.vx * s + b.vy * c;
  b.vx = vx;
}

function hitEnemy(g, e, o, kind = 'normal') {
  const p = g.players[o], st = p.stats;
  const crit = g.rng() < st.crit;
  let raw = st.dmg * (crit ? st.critMult : 1);
  if (g.duo.includes('twin')) raw *= FX.twin;
  if (e.isBoss && p.syn.includes('giant')) raw *= FX.giant;
  const maxHp = e.maxHp;
  const dealt = damage(g, e, raw, o);
  const big = dealt >= maxHp * 0.05 || (e.isBoss && crit);
  emit(g, { type: 'hit', x: e.x, y: e.y, dmg: dealt, crit, o, kind, big });
  if (!e.dead) {
    if (!e.isBoss) e.y -= Math.min(KB_MAX, KB_K * dealt / maxHp); // 넉백 (보스 면역)
    if (p.syn.includes('flame')) { e.burn += raw * FX.burn; e.burnT = FX.burnT; e.burnO = o; }
  }
  if (crit && e.isBoss && g.critStopT <= 0) {
    g.critStopT = 0.3;
    emit(g, { type: 'hitstop', ms: 60 });
  }
  if (crit && p.syn.includes('chain')) chainArc(g, e, raw * FX.chainPct, o);
  if (crit && st.boomR > 0) {
    const splash = raw * st.boomRatio, es = g.enemies;
    for (let j = 0; j < es.length; j++) {
      const q = es[j];
      if (q === e || q.dead) continue;
      const dx = q.x - e.x, dy = q.y - e.y, rr = st.boomR + q.r;
      if (dx * dx + dy * dy <= rr * rr) damage(g, q, splash, o);
    }
    emit(g, { type: 'boom', x: e.x, y: e.y, r: st.boomR, kind: 'crit' });
  }
  onCannonHit(g, e, raw, o, SPELL_API); // 불꽃 탄환·연쇄 번개(판타지 스킬)
}

// 체인 라이트닝: 가장 가까운 적으로 차례차례 전이. n = 전이 최대 마리 수
function chainArc(g, e, dmg, o, n = FX.chainN) {
  const pts = [[e.x, e.y]], used = [e], es = g.enemies;
  let cur = e;
  for (let k = 0; k < n; k++) {
    let best = null, bd = FX.chainR * FX.chainR;
    for (let j = 0; j < es.length; j++) {
      const q = es[j];
      if (q.dead || used.includes(q)) continue;
      const dx = q.x - cur.x, dy = q.y - cur.y, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = q; }
    }
    if (!best) break;
    used.push(best);
    pts.push([best.x, best.y]);
    damage(g, best, dmg, o);
    cur = best;
  }
  if (pts.length > 1) emit(g, { type: 'chain', o, pts });
}

// 방어(방패병 감소) → 보호막 → 체력. 실제 피해량 반환
function damage(g, e, dmg, o, flash = true) {
  if (e.dead) return 0;
  dmg *= e.reduce * curseMul(g); // 저주 낙인(판타지 스킬): 받는 피해 배율
  let d = dmg;
  if (e.shield > 0) {
    const a = e.shield < d ? e.shield : d;
    e.shield -= a;
    d -= a;
  }
  e.hp -= d;
  if (flash) e.hitT = 0.12;
  if (e.hp <= 0) killEnemy(g, e, o, true);
  return dmg;
}

function killEnemy(g, e, o, effects) {
  if (e.dead) return;
  e.dead = true;
  e.hp = 0;
  g.progress.killed++;
  gainMana(g); // 판타지 스킬: 처치 진행률로 마나 채우기
  addCombo(g, e);
  countFrenzy(g, e);
  const tier = g.combo.tier;
  const heroGoldMul = g.hero ? heroBonuses(g.hero).goldMul : 1;
  const mult = (tier ? COMBO_TIERS[tier - 1].gold : 1) * (g.duo.includes('golden') ? FX.golden : 1) * (g.legendT > 0 ? 2 : 1) * heroGoldMul * g.fx.goldMul;
  const gold = Math.ceil(e.gold * mult);
  for (const p of g.players) p.gold += gold; // 두 플레이어 모두 전액
  if (g.chain) { g.chain.kills++; g.chain.gold += gold; }
  emit(g, { type: 'kill', x: e.x, y: e.y, enemy: e.type, gold, isBoss: e.isBoss, o });
  onSpellKill(g, e, o, gold, SPELL_API); // 영혼 수확·황혼·증기 폭발·망령 군단
  if (g.hero && g.hero.cls) heroOnKill(g, e, HERO_API); // 영웅 경험치 + 장비 드롭
  if (e.named) {
    g.run.bosses++;
    g.run.gems.boss += RUN_GEMS.boss(g.stage);
    emit(g, { type: 'hitstop', ms: 500 });
  }
  else if (e.elite) emit(g, { type: 'hitstop', ms: 120 });
  if (effects && e.beh === 'bomber') explode(g, e, o, gold);
  if (e.beh === 'kingSlime') {
    for (let k = 0; k < 4; k++) {
      const m = summon(g, 'slime', e.x + (k - 1.5) * 40, e.y + (k % 2) * 20);
      if (!m) continue;
      m.r = 30;
      m.hp = m.maxHp = e.maxHp * 0.08;
      m.dmg *= 3;
      m.gold = Math.ceil(e.gold * 0.1);
      m.name = '중형 슬라임';
    }
  }
}

// ── 콤보 / 광란 ──
function addCombo(g, e) {
  const c = g.combo;
  c.count++;
  c.timer = COMBO_WINDOW;
  if (c.count > c.best) c.best = c.count;
  if (c.tier < COMBO_TIERS.length && c.count >= COMBO_TIERS[c.tier].n) {
    c.tier++;
    emit(g, { type: 'combo', count: c.count, tier: c.tier, label: COMBO_TIERS[c.tier - 1].label });
    if (c.tier === COMBO_TIERS.length) {
      g.legendT = LEGEND_T;
      synergy(g, 'legend', -1, e.x, e.y);
    }
  }
}

function endCombo(g) {
  const c = g.combo;
  if (c.count >= COMBO_TIERS[0].n) emit(g, { type: 'comboEnd', count: c.count });
  c.count = c.timer = c.tier = 0;
}

// 2초 안 20킬 → 광란 (광란 중엔 집계 안 함)
function countFrenzy(g, e) {
  if (g.frenzyT > 0) return;
  const kt = g.killTimes, now = g.phaseT;
  kt.push(now);
  while (now - kt[0] > FRENZY.window) kt.shift();
  if (kt.length >= FRENZY.kills) {
    kt.length = 0;
    g.frenzyT = FRENZY.dur;
    emit(g, { type: 'frenzy' });
    synergy(g, 'frenzy', -1, e.x, e.y);
  }
}

// 자폭병 폭발: 주변 적 피해(연쇄), 반경 안이면 성벽 피해
function explode(g, e, o, gold) {
  const root = !g.chain; // 연쇄의 시작 폭발이 집계를 맡음 (시작 자폭병 포함)
  if (root) g.chain = { kills: 1, gold };
  const R = e.elite ? 160 : 90;
  emit(g, { type: 'boom', x: e.x, y: e.y, r: R, kind: 'bomber' });
  const dmg = e.maxHp * 0.5, es = g.enemies;
  for (let j = 0; j < es.length; j++) {
    const q = es[j];
    if (q.dead) continue;
    // 일반 자폭병은 더 넓은 반경에서 무조건 유폭 (연쇄 폭발), 나머지는 반경 안에서 절반 피해
    const link = q.beh === 'bomber' && !q.isBoss;
    const dx = q.x - e.x, dy = q.y - e.y, rr = R * (link ? BOMB_LINK : 1) + q.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    damage(g, q, link ? q.hp + q.shield : dmg, o);
  }
  if (e.y + R >= WALL_Y) damageWall(g, e.dmg * 3);
  if (!root) return;
  const c = g.chain;
  g.chain = null;
  if (c.kills >= FX.chainboomKills) { // 연쇄 폭발: 골드 비
    const amount = c.gold * FX.goldRain;
    for (const p of g.players) p.gold += amount;
    emit(g, { type: 'goldRain', x: e.x, y: e.y, amount });
    synergy(g, 'chainboom', o, e.x, e.y);
  }
}

// 도전 종료(성벽 붕괴 또는 100층 돌파). 보상 정산은 호출측이 endRun(game, meta)로
function endOfRun(g, victory) {
  g.run.over = true;
  g.run.victory = victory;
  emit(g, { type: 'runOver', stage: g.stage, victory, floors: g.run.floors });
}

// src: 성벽을 직접 때린 적 (요새화 반사 대상)
function damageWall(g, dmg, src = null) {
  if (g.phase !== 'play') return;
  dmg = golemAbsorb(g, dmg * g.berserk); // 돌 골렘(판타지 스킬)이 먼저 맞아준다
  if (dmg <= 0) return;
  g.wall.hp -= dmg;
  g.wallLost += dmg;
  emit(g, { type: 'wall', dmg });
  if (g.wall.hp <= 0) {
    if (g.fx.revive && !g.run.reviveUsed) { // 부활 결계: 도전마다 1회
      g.run.reviveUsed = true;
      g.wall.hp = g.wall.max * REVIVE_HP;
      g.freezeT = Math.max(g.freezeT, REVIVE_FREEZE);
      emit(g, { type: 'revive', x: WORLD_W / 2, y: WALL_Y, hp: g.wall.hp });
      emit(g, { type: 'hitstop', ms: 400 });
      return;
    }
    g.wall.hp = 0;
    g.phase = 'defeat';
    g.pick = null;
    g.lastLoss = 1;
    g.run.time += g.phaseT;
    g.phaseT = 0;
    endCombo(g);
    emit(g, { type: 'defeat', stage: g.stage });
    endOfRun(g, false);
    return;
  }
  if (!src) return;
  for (let i = 0; i < 2 && !src.dead; i++) {
    const p = g.players[i];
    if (!p.syn.includes('thorns')) continue;
    damage(g, src, p.stats.dmg * FX.thorns, i);
    emit(g, { type: 'thorns', x: src.x, y: src.y + src.r });
  }
}

// ── 적 행동 ──
function updateEnemies(g, dt) {
  const es = g.enemies, frozen = g.freezeT > 0;
  for (let j = 0; j < es.length; j++) {
    const e = es[j];
    if (e.hitT > 0) e.hitT -= dt;
    e.frozen = frozen;
    if (e.dead) continue;
    if (e.burnT > 0) { // 화상: 남은 피해를 남은 시간에 걸쳐
      const d = e.burn * Math.min(1, dt / e.burnT);
      e.burn -= d;
      e.burnT -= dt;
      if (e.burnT <= 0) e.burn = e.burnT = 0;
      damage(g, e, d, e.burnO, false);
      if (e.dead) continue;
    }
    if (e.stunT > 0) { e.stunT -= dt; e.vx = e.vy = 0; continue; } // 기사 궁극기 기절
    if (frozen) { e.vx = e.vy = 0; continue; }
    switch (e.beh) {
      case 'walk': case 'shield': case 'kingSlime': walk(g, e, dt, e.speed); break;
      case 'charger': {
        e.t += dt;
        if (e.t >= 3) e.t = 0;
        const dash = e.t >= 2.4;
        if (!walk(g, e, dt, dash ? e.speed * 3 : e.speed)) e.state = dash ? 'dash' : 'walk';
        break;
      }
      case 'bomber':
        if (e.y + e.r < WALL_Y) walk(g, e, dt, e.speed);
        else { // 성벽 도달 → 도화선(fuse) 후 자폭: 성벽만 피해(골드 없음). 그 전에 쏘면 적 무리 속에서 터짐
          e.y = WALL_Y - e.r;
          e.vy = 0;
          e.state = 'fuse';
          e.atkT += dt;
          if (e.atkT < FUSE_T) break;
          e.dead = true;
          g.progress.killed++;
          emit(g, { type: 'boom', x: e.x, y: e.y, r: e.elite ? 160 : 90, kind: 'bomber' });
          damageWall(g, e.dmg * 3);
        }
        break;
      case 'thrower':
        if (e.y < e.stopY) walk(g, e, dt, e.speed);
        else {
          e.vy = 0;
          e.state = 'throw';
          e.t += dt;
          if (e.t >= 2.5) { e.t = 0; throwShot(g, e, e.x, 300, 'bone', e.dmg); }
        }
        break;
      case 'chariot': chariot(g, e, dt); break;
      case 'lich': caster(g, e, dt, 'lich'); break;
      case 'golem': caster(g, e, dt, 'golem'); break;
      case 'demonLord': caster(g, e, dt, 'demonLord'); break;
      case 'dragon': dragon(g, e, dt); break;
    }
  }
}

// 아래로 이동. 성벽에 닿으면 공격하고 true. 영웅이 도발/근접 범위 안이면 성벽 대신 영웅을 노린다
function walk(g, e, dt, spd) {
  // 서리 결계(판타지 스킬): 성벽 근처 감속. 광폭화 중엔 감속 무시 + 최대 3배속
  spd *= g.berserk > 1 ? Math.min(3, g.berserk) : frostSlowMul(g, e);
  const h = g.heroUnit;
  if (h && h.state !== 'down') {
    const r = heroEngageRadius(g.hero);
    const dx = h.x - e.x, dy = h.y - e.y, d2 = dx * dx + dy * dy;
    if (d2 <= r * r) {
      const d = Math.sqrt(d2) || 1;
      if (d <= e.r + HERO_MELEE_R) {
        e.vx = e.vy = 0;
        e.state = 'attackHero';
        e.atkT += dt;
        if (e.atkT >= 1) { e.atkT -= 1; heroTakeDamage(g, e.dmg * g.berserk, HERO_API); }
        return true;
      }
      e.x += dx / d * spd * dt;
      e.y += dy / d * spd * dt;
      e.state = 'walk';
      return false;
    }
  }
  if (e.y + e.r >= WALL_Y) {
    e.y = WALL_Y - e.r;
    e.vy = 0;
    e.state = 'attack';
    e.atkT += dt;
    if (e.atkT >= 1) { e.atkT -= 1; damageWall(g, e.dmg, e); }
    return true;
  }
  e.vy = spd;
  e.y += spd * dt;
  if (e.state === 'attack') e.state = 'walk';
  return false;
}

function throwShot(g, e, tx, speed, kind, dmg) {
  const x = e.x, y = e.y + e.r * 0.5;
  const dx = clamp(tx, 20, WORLD_W - 20) - x, dy = WALL_Y - y, d = Math.hypot(dx, dy) || 1;
  g.eshots.push({ x, y, vx: dx / d * speed, vy: dy / d * speed, kind, dmg });
}

function updateEshots(g, dt) {
  if (g.freezeT > 0) return; // 빙결 중엔 투사체도 정지
  const s = g.eshots;
  for (let k = s.length - 1; k >= 0; k--) {
    const q = s[k];
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if (q.y >= WALL_Y) {
      damageWall(g, q.dmg);
      s[k] = s[s.length - 1];
      s.pop();
    }
  }
}

// 돌격 고블린 전차: 돌진 → 성벽 강타 → 튕겨나가 후퇴 → 반복
function chariot(g, e, dt) {
  if (e.state === 'charge') {
    e.vy = e.speed * 3;
    e.y += e.vy * dt;
    if (e.y + e.r >= WALL_Y) {
      e.y = WALL_Y - e.r;
      damageWall(g, e.dmg, e);
      emit(g, { type: 'boom', x: e.x, y: WALL_Y, r: 120, kind: 'shock' });
      e.state = 'retreat';
    }
  } else if (e.state === 'retreat') {
    e.vy = -240;
    e.y += e.vy * dt;
    if (e.y <= 300) { e.state = 'idle'; e.t = 0; }
  } else {
    e.vy = 0;
    e.state = 'idle';
    e.t += dt;
    if (e.t >= 1.5) e.state = 'charge';
  }
}

function shieldAll(g) {
  const es = g.enemies;
  for (let j = 0; j < es.length; j++) {
    const q = es[j];
    if (q.dead) continue;
    q.shield = Math.max(q.shield, q.maxHp * (q.named ? 0.05 : 0.2));
    emit(g, { type: 'shield', x: q.x, y: q.y });
  }
}

function shockwave(g, e) {
  damageWall(g, e.dmg);
  emit(g, { type: 'boom', x: e.x, y: e.y, r: 520, kind: 'shock' });
}

// 보스 소환 횟수 상한 (무한 소환으로 보스가 영영 안 맞는 상황 방지)
const MAX_SUMMONS = 3;

// 리치 로드 / 마그마 골렘 / 심연의 마왕: 중간에 멈춰 주기적으로 기믹
function caster(g, e, dt, kind) {
  if (e.y < e.stopY) { e.vy = e.speed; e.y += e.speed * dt; e.state = 'walk'; return; }
  e.vy = 0;
  e.state = e.t2 > 0 ? 'cast' : 'idle';
  if (e.t2 > 0) e.t2 -= dt;
  e.t += dt;
  if (kind === 'lich') {
    e.t3 += dt;
    if (e.t3 >= 2.2) { e.t3 = 0; throwShot(g, e, e.x + (g.rng() - 0.5) * 400, 320, 'bolt', e.dmg); }
    if (e.t >= 8) {
      e.t = 0; e.t2 = 0.6;
      shieldAll(g);
      if (e.cycle++ < MAX_SUMMONS) {
        summon(g, 'skeleton', e.x - 50, e.y + 40);
        summon(g, 'skeleton', e.x + 50, e.y + 40);
      }
    }
  } else if (kind === 'golem') {
    if (e.t >= 5) { e.t = 0; e.t2 = 0.5; shockwave(g, e); }
  } else if (e.t >= 4) { // 마왕: 보호막 → 소환 → 충격파 순환
    e.t = 0; e.t2 = 0.6;
    const c = e.cycle++ % 3;
    if (c === 0) shieldAll(g);
    else if (c === 1 && e.cycle < MAX_SUMMONS * 3) {
      summon(g, 'demon', e.x - 70, e.y + 40);
      summon(g, 'demon', e.x + 70, e.y + 40);
      summon(g, 'bomber', e.x, e.y + 60);
    } else shockwave(g, e);
  }
}

// 종말의 드래곤: 상단 좌우 비행, 1.2초 경고 후 브레스, 소환, 50% 이하 격노
const WARN_T = 1.2;
function dragon(g, e, dt) {
  if (e.y < e.stopY) { e.vy = e.speed; e.y += e.speed * dt; e.state = 'walk'; return; }
  e.vy = 0;
  if (!e.enraged && e.hp < e.maxHp * 0.5) {
    e.enraged = true;
    emit(g, { type: 'enrage', x: e.x, y: e.y, name: e.name });
  }
  const f = e.enraged ? 0.6 : 1;
  if (e.state === 'warn') {
    e.vx = 0;
    e.t2 -= dt;
    if (e.t2 <= 0) {
      damageWall(g, e.dmg);
      emit(g, { type: 'boom', x: e.x, y: WALL_Y, r: 150, kind: 'breath' });
      e.state = e.enraged ? 'enrage' : 'hover';
      e.t = 0;
    }
    return;
  }
  e.state = e.enraged ? 'enrage' : 'hover';
  const spd = 90 / f;
  if (e.vx === 0) e.vx = spd;
  e.vx = Math.sign(e.vx) * spd;
  e.x += e.vx * dt;
  if (e.x < 110) { e.x = 110; e.vx = spd; } else if (e.x > WORLD_W - 110) { e.x = WORLD_W - 110; e.vx = -spd; }
  e.t += dt;
  e.t3 += dt;
  if (e.t3 >= 10 * f && e.cycle < MAX_SUMMONS) {
    e.t3 = 0;
    e.cycle++;
    summon(g, 'demon', e.x - 60, e.y + 60);
    summon(g, g.rng() < 0.5 ? 'bomber' : 'wraith', e.x + 60, e.y + 60);
  }
  if (e.t >= 7 * f) {
    e.state = 'warn';
    e.t2 = WARN_T;
    e.vx = 0;
    emit(g, { type: 'warn', x: e.x, y: e.y, t: WARN_T });
  }
}

function updateBossBar(g) {
  let b = null;
  const es = g.enemies;
  for (let j = 0; j < es.length; j++) {
    const e = es[j];
    if (e.isBoss && (!b || (e.named && !b.named))) b = e;
  }
  if (!b) { g.boss = null; return; }
  const bb = g.bossBar;
  bb.name = b.name; bb.hp = b.hp; bb.maxHp = b.maxHp; bb.shield = b.shield;
  g.boss = bb;
}

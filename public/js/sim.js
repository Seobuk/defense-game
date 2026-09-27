// 순수 시뮬레이션 (DOM 없음, node 실행 가능)
import {
  WORLD_W, WORLD_H, WALL_Y, CANNONS, BULLET_SPEED, BULLET_R, MAX_STAGE,
  TRAIN_KEYS, trainMax, cannonStats, wallMax,
  goldPerKill, starsFor, RUN_GEMS, META_KEYS, metaMax, metaFx, SKILLS,
  COMBO_WINDOW, COMBO_TIERS, FRENZY, LEGEND_T, SYN_FX as FX, SYNERGIES, SYN_KEYS,
  SPELL_KEYS, RARITY_WEIGHT, MANA_MAX, MANA_FRAC, PICK_AUTO_T,
  SPELL_SLOTS, SPELL_MAX_LV, AWAKEN_KEYS, AWAKEN_BY_KEY, BASIC_SPELLS, ALLY_SPELLS, allySpellLv,
  FUSIONS, FUSION_KEYS, FUSION_BY_KEY, FUSION_FX, fusionParts, SKILL_BY_KEY, EARLY_FLOORS, EARLY_MARKS,
  COLLABS, COLLAB_BY_KEY, COLLAB_BRANCH_RANKS, COLLAB_FX, collabOn, collabPow, FRONT_Y, ENTRY_RUSH, inReach,
} from './config.js';
import { themeOf, ENEMY_TYPES, BOSSES, ELITE, buildStage, enemyHp, enemyDmg, enemySpeedMul, bossHpMul, DENSITY } from './stages.js';
import { mulberry32, clamp, toInt } from './util.js';
import { autoSkill, autoHero, pickCard } from './bot.js';
import { initSpells, updateSpells, onSpellHit, onKill as onSpellKill, frostSlowMul, spellRateMul, curseMul, golemAbsorb } from './spells.js';
import {
  HERO_CLASSES, HERO_MELEE_R, spawnHeroUnit, updateHeroUnit, heroTakeDamage,
  heroOnKill, heroGainXp, heroClearXp, castHeroUlt, heroBonuses, lootDrop,
  equipItem, sellItem, sellItemsByRarity, autoEquipAll, hasMilestone,
} from './hero.js';
import { allocateTalent, branchSpent } from './talents.js';

const KINDS = ['human', 'bot', 'remote'];
const BOT_INTERVAL = 0.25;
const MAX_EVENTS = 4000;
const CANNON_SYN = SYNERGIES.filter(s => s.kind === 'cannon');
const DUO_SYN = SYNERGIES.filter(s => s.kind === 'duo' && s.test);
const SKILL_KEYS = [...SPELL_KEYS, ...FUSION_KEYS]; // 슬롯에 들어가는 스킬(기본 14 + 융합 8)
// spells.js · hero.js 에 넘기는 콜백 묶음 (함수 선언은 호이스팅되어 이 시점에 미리 참조해도 안전)
const SPELL_API = { damage, killEnemy, damageWall, emit, chainArc, frontMost, spellHit, aimTarget, collabProc };
const KB_K = 20, KB_MAX = 4;  // 넉백: 피해/최대체력 비례, 1타 최대 px
const BOMB_LINK = 1.8;          // 자폭병끼리 유폭 반경 배율
const FUSE_T = 1;               // 자폭병 성벽 도착 후 자폭까지(초)
const BULLET_LIFE = 1.5;         // 기본 주문 발사체 수명(초)
const FROST_SLOW = BASIC_SPELLS[1].slow; // 서리 화살 둔화(이동속도 감소 비율)
const COMBO_ZONE = WALL_Y - 750; // 이 선을 넘은 적이 있어야 콤보 시간이 줄어듦
const HERO_MOVE_HOLD = 6;        // 탭 이동 후 자동 복귀까지(초)
const ACCEL_LEAD = 1.2, RUSH = 3; // 학살 가속: 전선이 비면 다음 스폰 묶음을 1.2초 뒤로 당기고 그 묶음은 3배 빠르게(압도적이면 층당 약 20~30초)
const FAST_SPAWN = 3.5, FAST_FRAC = 0.6; // 정복한 층(도전 시작 때 최고 기록의 60% 이하): 스폰 일정이 3.5배 빠르게 흐른다
const ARCANE_AT = 0.85;         // 비전 충전 추가 카드가 뜨는 처치 진행률
const HERO_REVIVE_HP = 0.4;      // 성직자 부활 결계 강화
const REVIVE_HP = 0.5, REVIVE_FREEZE = 1.5; // 부활 결계: 성벽 50% 회복 + 잠깐 빙결
// 광폭화: 층이 BERSERK_T초를 넘기면 적 피해가 BERSERK_STEP초마다 2배, 이동은 감속·밀쳐내기 무시 — 버티기만 하는 교착을 끝낸다
const BERSERK_T = 70, BERSERK_STEP = 10;
// hero.js 에 넘기는 콜백 묶음(spells.js와 동일한 모양)
const HERO_API = SPELL_API;

// 마법사 수련 레벨(정비 화면 영구 강화) — 두 마법사 모두 run.js가 meta.training을 넘긴다
const lvOf = src => {
  const lv = {};
  for (const k of TRAIN_KEYS) lv[k] = toInt(src?.[k], 0, trainMax(k));
  return lv;
};
const posNum = v => { v = Number(v); return Number.isFinite(v) && v > 0 ? v : 0; };

function makePlayer(init, i, fx, stage = 1) {
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
    stats: cannonStats(lv, fx, stage),
    syn: [],       // 활성 마법사 조합 키 (refreshSyn 이 채움)
    fireT: 0,
  };
}

// 영웅 특성 합산(영웅이 없으면 null). heroUnit.tb는 updateHeroUnit이 0.5초마다(특성을 찍으면 즉시) 갱신
const heroTb = g => (g.heroUnit ? g.heroUnit.tb : null);
const wallCap = g => wallMax(g.stage, Math.max(g.players[0].lv.wall, g.players[1].lv.wall), g.fx.wallMul);

// ── 런(도전) 상태 ──
// 런 필드(저장·이어하기 대상). spells/rerollLeft 는 game 최상위(g.spells, g.rerollLeft)에 둔다
const GEM_KEYS = ['floor', 'first', 'boss', 'flawless'];

// 신뢰할 수 없는 런 저장값 → 올바른 모양(절대 throw 없음). serializeRun()의 역
export function normalizeRun(raw) {
  const o = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const r = o(raw);
  const spells = {}, fusionParts = {};
  for (const k of Object.keys(o(r.spells))) { // 저장된 순서 = 스킬 스택 순서
    if (!SKILL_KEYS.includes(k)) continue;
    const v = toInt(r.spells[k], 0, SPELL_MAX_LV);
    if (v > 0 && Object.keys(spells).length < SPELL_SLOTS) spells[k] = v;
  }
  // 융합 스킬이 품은 재료 두 스킬(없거나 틀리면 재료 칸의 첫 스킬)
  for (const k of FUSION_KEYS) {
    if (!spells[k]) continue;
    const gr = FUSION_BY_KEY[k].groups, p = Array.isArray(o(r.fusionParts)[k]) ? r.fusionParts[k] : [];
    fusionParts[k] = gr.map((ks, i) => (ks.includes(p[i]) ? p[i] : ks[0]));
  }
  const allySpells = {};
  for (const k of ALLY_SPELLS) {
    const v = toInt(o(r.allySpells)[k], 0, SPELL_MAX_LV);
    if (v > 0) allySpells[k] = v;
  }
  const awaken = {}, gems = {};
  for (const k of AWAKEN_KEYS) awaken[k] = toInt(o(r.awaken)[k], 0, 999);
  for (const k of GEM_KEYS) gems[k] = toInt(o(r.gems)[k], 0, 1e7);
  const pl = Array.isArray(r.players) ? r.players : [];
  const lo = o(r.loadout);
  return {
    v: 2,
    stage: toInt(r.stage, 1, MAX_STAGE),
    players: [0, 1].map(i => ({ gold: posNum(o(pl[i]).gold) })), // 이번 도전에서 번 골드(도전 종료 때 meta.gold로)
    auto: !!r.auto,
    spells, fusionParts, allySpells,
    rerollLeft: r.rerollLeft == null ? null : toInt(r.rerollLeft, 0, 99),
    awaken, gems,
    reviveUsed: !!r.reviveUsed,
    heroRevive: !!r.heroRevive,
    arcane: Math.min(2, posNum(r.arcane)),
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
    v: 2, stage: g.stage,
    players: g.players.map(p => ({ gold: p.gold })),
    auto: g.players[0].auto,
    spells: { ...g.spells }, fusionParts: JSON.parse(JSON.stringify(g.fusionParts)), allySpells: { ...g.allySpells }, rerollLeft: g.rerollLeft,
    awaken: { ...r.awaken }, gems: { ...r.gems },
    reviveUsed: r.reviveUsed, heroRevive: r.heroRevive, arcane: r.arcane, floors: r.floors, bosses: r.bosses, firstClears: r.firstClears, flawless: r.flawless,
    time: r.time, startBest: r.startBest,
    loadout: { cls: r.loadout.cls, startSpells: [...r.loadout.startSpells] },
  };
}

// 영구 강화 × 각성 → 런 배율(각성 효과는 보석 강화 '각성 숙련'만큼 커진다)
function computeFx(g) {
  const f = metaFx(g.metaLv), a = g.run.awaken, A = AWAKEN_BY_KEY, k = f.awakenMul;
  f.atkMul *= 1 + A.power.atk * k * a.power;
  f.rateMul *= 1 + A.haste.rate * k * a.haste;
  f.wallMul *= 1 + A.ward.wall * k * a.ward;
  f.goldMul *= 1 + A.fortune.gold * k * a.fortune;
  return f;
}
function refreshFx(g) {
  g.fx = computeFx(g);
  for (const p of g.players) p.stats = cannonStats(p.lv, g.fx, g.stage);
  const max = wallCap(g);
  g.wall.hp = Math.min(max, g.wall.hp + Math.max(0, max - g.wall.max));
  g.wall.max = max;
}

function emit(g, ev) {
  if (g.events.length < MAX_EVENTS) g.events.push(ev);
}

// opts: { stage, players, best, seed, discovered, hero, metaLv:{key:lv}, run:(serializeRun 모양, 없으면 새 런), seenSpells,
//         startCards(도전 시작 무료 카드 수 — run.js newRun이 START_CARDS), collabOff(테스트: 협공 효과 끄기) }
// players[i].lv = 마법사 수련 레벨(run.js가 meta.training을 넘긴다)
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
    // 영웅 전용 rng: 마법사·스폰 rng 스트림과 분리해 영웅 드롭/치명타가 기존 밸런스 타이밍에 영향을 주지 않게 한다
    heroRng: mulberry32(((opts.seed ?? (Math.random() * 2 ** 32)) >>> 0) + 0x9e3779b9),
    spawns: [], spawnIdx: 0, nextId: 1,
    wallLost: 0,   // 이번 스테이지 성벽 피해 누적
    botT: 0,
    bossBar: { name: '', hp: 0, maxHp: 0, shield: 0 },
    // 중독성 레이어
    combo: { count: 0, timer: 0, tier: 0, best: 0 },
    frenzyT: 0, legendT: 0,
    duo: [],
    discovered: new Set(Array.isArray(opts.discovered) ? opts.discovered.filter(k => SYN_KEYS.includes(k)) : []),
    killTimes: [], lastSkill: { meteor: null, freeze: null }, chain: null, critStopT: 0,
    // 판타지 스킬 (런 전체 누적 빌드)
    mana: { cur: 0, max: MANA_MAX }, spells: { ...run.spells }, fusions: [], pick: null, pickQ: 0,
    fusionParts: run.fusionParts, // { [융합 키]: [재료 a, 재료 b] }
    book: {},          // 실제로 발동하는 스킬 레벨 = 기본 스킬 + 융합 스킬이 품은 재료(융합 레벨) — spells.js가 읽는다
    collabs: [], collabT: {}, collabOff: !!opts.collabOff, // 켜진 협공 키 · collabProc 간격 · 테스트용 끄기
    linkT: 0,          // 합동 필살: 영웅 궁극기 뒤 남은 창(초)
    allySpells: { ...run.allySpells }, // AI 동료(P2) 주문서: 네임드 보스 처치마다 ALLY_SPELLS 순서로 1개(런당 최대 3)
    seenSpells: new Set(Array.isArray(opts.seenSpells) ? opts.seenSpells.filter(k => SPELL_KEYS.includes(k)) : []),
    // 런(도전): 영구 강화 레벨 · 런 기록. fx = 영구 강화 × 각성 배율
    metaLv, fx: null,
    run: {
      awaken: run.awaken, gems: run.gems, reviveUsed: run.reviveUsed, heroRevive: run.heroRevive, arcane: run.arcane, floors: run.floors, bosses: run.bosses,
      firstClears: run.firstClears, flawless: run.flawless, time: run.time,
      startBest: opts.run ? run.startBest : toInt(opts.best, 0, MAX_STAGE), loadout: run.loadout,
      over: false, victory: false, ended: false, checkpoint: null,
    },
    rerollLeft: 0,
    spawnT: 0,
    // 영웅(클래스 필드 유닛) — opts.hero 없으면 완전히 비활성(기존 동작과 100% 동일)
    hero: opts.hero && typeof opts.hero === 'object' ? opts.hero : null,
    heroUnit: null,
    summons: [],        // 영웅 소환물(늑대·그림자 분신·비전 분신) — hero.js가 관리, 렌더러가 그린다
    heroBuff: null,     // 전군 강화 함성 { t, mul }: 두 마법사 + 영웅 피해 배율
    dmgDone: [0, 0, 0], // 이번 도전 실제 피해 [P1, P2, 영웅(소환물 포함)] — 기여도 표시·밸런스 러너용
    dmgSkill: [0, 0],   // 그중 고른 스킬(카드·융합·동료 주문)이 낸 피해 [P1, P2] — 나머지는 기본 주문
    _skill: false,      // 지금 들어가는 피해가 스킬 피해인가(dmgSkill 집계용)
    _env: false,        // 자폭병 연쇄 폭발 중(기여도 집계 제외)
  };
  for (const k of Object.keys(g.spells)) g.seenSpells.add(k);
  g.fx = computeFx(g);
  const st0 = toInt(opts.stage ?? (opts.run ? run.stage : 1), 1, MAX_STAGE);
  g.players = [makePlayer(pl[0], 0, g.fx, st0), makePlayer(pl[1], 1, g.fx, st0)];
  // 새로고침: 영웅 Lv5(1회) + 영구 강화. 런 전체에서 쓰는 횟수(이어하기면 저장값)
  g.rerollLeft = run.rerollLeft ?? (g.hero && hasMilestone(g.hero.level, 'reroll1') ? 1 : 0) + g.fx.rerolls;
  initSpells(g);
  refreshFusion(g); // 시작 스킬끼리 융합 조건이면 바로 합체
  startStage(g, st0);
  refreshSyn(g);
  // 도전 시작 무료 카드(첫 층부터 스킬 맛 — 눈에 띄는 쿨타임 공격 스킬만) + 영웅 Lv30 카드 1장
  for (let k = toInt(opts.startCards, 0, 3); k > 0; k--) triggerPick(g, true);
  if (g.stage === 1 && g.run.floors === 0 && g.hero && g.hero.cls && hasMilestone(g.hero.level, 'extraCard')) triggerPick(g);
  return g;
}

export function startStage(g, stage) {
  if (g.run.over) return; // 끝난 도전은 이어갈 수 없다(재도전·100층 뒤 자동 진행이 체크포인트를 덮어써 죽은 런이 이어하기로 살아나는 것 방지)
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
  g.fastFloor = stage <= Math.floor(g.run.startBest * FAST_FRAC); // 정복한 층 빠른 진행(UI 표시용)
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
  g.pickQ = 0;
  g.linkT = 0;
  g.collabT = {};
  initSpells(g); // 스킬 빌드(g.spells)는 런 전체 유지, 전장 효과·쿨타임만 새로
  // 카드 지점(처치 수): 1~5층은 30%·70% 두 장, 이후 60% 한 장. 비전 충전이 차면 85%에 한 장 더(gainMana)
  g._marks = (stage <= EARLY_FLOORS ? EARLY_MARKS : [MANA_FRAC]).map(f => Math.max(1, Math.ceil(plan.total * f)));
  g._manaN = 0;
  g.mana = { cur: 0, max: MANA_MAX };
  for (const p of g.players) {
    p.stats = cannonStats(p.lv, g.fx, stage);
    p.fireT = 0;
  }
  // 영웅: 스테이지마다 성문에서 다시 걸어 나간다(레벨·장비는 g.hero에 영구 보존)
  g.heroUnit = g.hero && g.hero.cls ? spawnHeroUnit(g.hero) : null;
  g.summons.length = 0; // 소환물은 영웅을 따라 다시 나온다
  g.heroBuff = null;
  refreshCollab(g); // 클래스·특성이 바뀌었을 수 있다
  g.run.checkpoint = serializeRun(g); // 이어하기: 이 스테이지 시작부터
}

export function setPlayer(g, i, init) {
  if (i !== 0 && i !== 1) return;
  const ratio = g.wall.max > 0 ? g.wall.hp / g.wall.max : 1;
  g.players[i] = makePlayer(init, i, g.fx, g.stage);
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
// 이 카드를 고르면 아직 없는 융합이 완성(합체)되는가(참일 때 UI는 조건 없이 ✦ 표시만)
function wouldFuse(g, key) {
  if (FUSION_BY_KEY[key]) return false;
  const hyp = { ...g.spells, [key]: (g.spells[key] || 0) + 1 };
  return FUSIONS.some(f => !g.spells[f.key] && f.test(hyp));
}

// 영웅 Lv50 마일스톤: 전설 카드 확률 상승
function rarityWeight(g, key) {
  const r = SKILL_BY_KEY[key].rarity, w = RARITY_WEIGHT[r];
  return g.hero && r === 'legend' && hasMilestone(g.hero.level, 'legendBoost') ? w * 2 : w;
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
// 쓰는 슬롯 수(기본 스킬·융합 스킬 모두 1칸)
export const slotsUsed = g => Object.keys(g.spells).length;

// 슬롯 6칸 · Lv1~5. 슬롯이 차면 보유 스킬(융합 스킬 포함) 강화 카드만, 모자라는 자리는 각성 카드로 채운다(중복 없음).
// 융합 스킬은 새 카드로 나오지 않고(합체로만 생긴다) 가진 뒤에 강화 카드로 나온다. starter = 도전 시작 무료 카드(쿨타임 공격 스킬만)
const STARTER = ['fireball', 'lightningStrike', 'iceLance', 'tornado', 'judgment'];
function genCards(g, starter = false) {
  const n = cardCount(g);
  const full = slotsUsed(g) >= SPELL_SLOTS;
  const fused = new Set(Object.values(g.fusionParts).flat()); // 보유 융합이 품은 재료는 새 카드로 다시 나오지 않는다(이미 융합 안에서 발동)
  let pool = SKILL_KEYS.filter(k => (g.spells[k] || 0) < SPELL_MAX_LV && (g.spells[k] > 0 || (!full && !FUSION_BY_KEY[k] && !fused.has(k))));
  if (starter && pool.some(k => STARTER.includes(k))) pool = pool.filter(k => STARTER.includes(k));
  const cards = [];
  while (cards.length < n && pool.length) {
    const k = weightedKey(g, pool);
    pool = pool.filter(x => x !== k);
    cards.push({ spell: k, level: (g.spells[k] || 0) + 1, rarity: SKILL_BY_KEY[k].rarity, fusionHint: wouldFuse(g, k), fusion: !!FUSION_BY_KEY[k] });
  }
  const aw = AWAKEN_KEYS.slice();
  while (cards.length < n && aw.length) {
    const k = aw.splice(Math.floor(g.rng() * aw.length), 1)[0];
    cards.push({ spell: null, awaken: k, level: g.run.awaken[k] + 1, rarity: 'common', fusionHint: false });
  }
  return cards;
}

// 카드 선택을 띄운다. 이미 떠 있으면 대기열(pickQ)에 쌓았다가 고르는 즉시 다음 카드를 띄운다
function triggerPick(g, starter = false) {
  if (g.pick) { g.pickQ++; return; }
  const cards = genCards(g, starter);
  if (!cards.length) return; // 모든 스킬 만렙인 극단적 상황
  g.pick = { cards, autoLeft: g.players[0].auto ? PICK_AUTO_T : null, starter };
  emit(g, { type: 'pickOffer', queued: g.pickQ });
}

// 층마다 처치 진행률 지점(g._marks: 1~5층 30%·70%, 이후 60%)에서 마나가 가득 차 카드 1장.
// 영웅 장비의 마나 충전%만큼 지점이 앞당겨진다. 비전 충전(마법사 비전 특성)이 1 이상이면 층 막바지(85%)에 1장 더
function gainMana(g) {
  const marks = g._marks, n = g._manaN;
  if (n >= marks.length) return;
  const manaMul = g.hero ? heroBonuses(g.hero).manaMul : 1;
  const at = Math.max(1, marks[n] / manaMul), from = n === 0 ? 0 : marks[n - 1] / manaMul;
  g.mana.cur = clamp(MANA_MAX * (g.progress.killed - from) / Math.max(1, at - from), 0, MANA_MAX);
  if (g.progress.killed < at) return;
  g._manaN = n + 1;
  if (n === 0) {
    g.run.arcane = Math.min(2, g.run.arcane + (heroTb(g) ? heroTb(g).mana : 0));
    if (g.run.arcane >= 1) { // 비전 충전: 이 층 막바지에 1장 더
      g.run.arcane -= 1;
      marks.push(Math.max(marks[marks.length - 1] + 1, Math.ceil(g.progress.total * ARCANE_AT)));
    }
  }
  g.mana.cur = MANA_MAX;
  triggerPick(g);
}

// 실제로 발동하는 스킬 레벨: 기본 스킬 + 융합 스킬이 품은 재료 두 스킬(융합 레벨)
function bookOf(g) {
  const b = {};
  for (const [k, v] of Object.entries(g.spells)) if (!FUSION_BY_KEY[k]) b[k] = v;
  for (const f of g.fusions) for (const k of g.fusionParts[f] || []) b[k] = Math.max(b[k] || 0, g.spells[f]);
  return b;
}

// 융합 = 합체: 두 재료를 모두 가진 융합이 있으면 재료 둘을 빼고 융합 스킬 하나를 넣는다(슬롯 1칸 해제, 레벨 = 평균 내림).
// fusionMerge 이벤트 + 히든 조합 발견(첫 발견이면 synergy first + hitstop). 그다음 book·협공 재계산.
// export: applyPick이 부르지만, 테스트가 game.spells를 직접 바꾼 뒤 재계산시키는 용도로도 씀
export function refreshFusion(g) {
  for (let merged = true; merged;) {
    merged = false;
    for (const f of FUSIONS) {
      if (g.spells[f.key] || !f.test(g.spells)) continue;
      const from = fusionParts(f, g.spells);
      const level = Math.max(1, Math.floor((g.spells[from[0]] + g.spells[from[1]]) / 2));
      const full = slotsUsed(g) >= SPELL_SLOTS; // 꽉 찬 슬롯에서 합체했나(UI는 이때만 '슬롯 해제!'를 외친다)
      delete g.spells[from[0]];
      delete g.spells[from[1]];
      g.spells[f.key] = level;
      g.fusionParts[f.key] = from;
      emit(g, { type: 'fusionMerge', fusion: f.key, from, level, slotFreed: true, full });
      synergy(g, f.key, -1, WORLD_W / 2, WALL_Y / 2 - 100);
      merged = true;
    }
  }
  for (const k of Object.keys(g.fusionParts)) if (!g.spells[k]) delete g.fusionParts[k];
  g.fusions = FUSION_KEYS.filter(k => g.spells[k] > 0);
  g.book = bookOf(g);
  refreshCollab(g);
}

// ── 영웅 × 마법사 협공 ──
// 켜진 협공 재계산(스킬·클래스·특성이 바뀔 때). 새로 켜진 것만 synergy(o:2) + collab 이벤트
function refreshCollab(g) {
  const hero = g.hero, cls = hero && hero.cls, old = g.collabs;
  g.collabs = !cls ? [] : COLLABS.filter(c => c.cls === cls && c.spells.some(k => g.book[k] > 0)
    && (!c.branch || branchSpent(hero, cls, c.branch) >= COLLAB_BRANCH_RANKS)).map(c => c.key);
  const h = g.heroUnit, x = h ? h.x : WORLD_W / 2, y = h ? h.y - 40 : WALL_Y - 80;
  for (const k of g.collabs) {
    if (old.includes(k)) continue;
    synergy(g, k, 2, x, y);
    emit(g, { type: 'collab', key: k, cls, spells: collabSlots(g, k) });
  }
}

// 협공에 엮인 내 슬롯 스킬 키(기본 스킬 또는 그 스킬을 품은 융합 스킬) — UI가 영웅 초상 ↔ 스킬 아이콘 빛줄기를 잇는다
export function collabSlots(g, key) {
  const c = COLLAB_BY_KEY[key];
  if (!c) return [];
  return Object.keys(g.spells).filter(k => c.spells.includes(k) || (g.fusionParts[k] || []).some(p => c.spells.includes(p)));
}

// 협공 효과가 실제로 터진 순간(연출용). 같은 협공은 procGap초에 한 번만
function collabProc(g, key, x, y) {
  const t = g.collabT[key];
  if (t != null && g.phaseT - t < COLLAB_FX.procGap) return;
  g.collabT[key] = g.phaseT;
  emit(g, { type: 'collabProc', key, x, y });
}

// 잠시 빼 둔 카드(main.js holdPicks)를 다시 띄울 때: 그사이 다른 카드를 골라 옛 카드가 낡았을 수 있어 지금 빌드로 새로 뽑는다
// (낡은 카드는 이미 가진 레벨을 다시 주거나 · 레벨을 내리거나 · 7번째 슬롯 · 합체된 재료를 되살릴 수 있다)
export function reofferPick(g, pick) {
  const cards = pick && genCards(g, pick.starter);
  if (!cards || !cards.length) return false;
  g.pick = { ...pick, cards };
  return true;
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
  } else {
    let level = card.level;
    const tb = heroTb(g);
    if (tb && tb.cap.cardBless && level < SPELL_MAX_LV && g.heroRng() < 0.3) { // 카드 축복(성직자 궁극 특성): 레벨 +1
      level++;
      emit(g, { type: 'heroProc', kind: 'cardBless', spell: card.spell, level });
    }
    g.spells[card.spell] = level;
    if (!FUSION_BY_KEY[card.spell]) g.seenSpells.add(card.spell);
    emit(g, { type: 'spellPick', spell: card.spell, level, rarity: card.rarity });
    refreshFusion(g);
  }
  if (g.pickQ > 0) { g.pickQ--; triggerPick(g); } // 대기 중인 카드
  return true;
}

// 카드 새로고침(런 전체 rerollLeft회: 영웅 Lv5 + 영구 강화). 자동 선택 카운트다운도 처음부터
function rerollPick(g, i) {
  if (i !== 0 || !g.pick || !(g.rerollLeft > 0)) return false;
  const cards = genCards(g, g.pick.starter);
  if (!cards.length) return false;
  g.rerollLeft--;
  g.pick = { cards, autoLeft: g.pick.autoLeft == null ? null : PICK_AUTO_T, starter: g.pick.starter };
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
  // 도전 중 골드 강화('upgrade')는 없다 — 마법사 수련은 정비 화면(run.js buyTraining)
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
  if (action.type === 'auto') { // 자동 진행 봇(카드 자동 선택·영웅 자동 궁극기). 테스트·봇용 — 전투 화면에는 토글이 없다
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
    refreshCollab(g);
    return true;
  }
  if (action.type === 'heroMove') {
    if (!g.heroUnit || g.heroUnit.state === 'down') return false;
    const x = toInt(action.x, 0, WORLD_W), y = toInt(action.y, 0, WALL_Y);
    g.heroUnit.moveTo = { x, y, holdT: HERO_MOVE_HOLD };
    return true;
  }
  if (action.type === 'talent') { // 도전 중 특성 찍기(현재 클래스). 초기화는 정비 화면(run.js campAct)에서만
    if (!g.hero || !g.hero.cls) return false;
    const ok = allocateTalent(g.hero, g.hero.cls, action.key);
    if (ok) {
      if (g.heroUnit) g.heroUnit.tbT = 0; // 다음 프레임에 효과 반영
      emit(g, { type: 'talent', cls: g.hero.cls, key: action.key });
      refreshCollab(g); // 갈래 조건 협공
    }
    return ok;
  }
  if (action.type === 'heroUlt') {
    if (!g.heroUnit || !castHeroUlt(g, HERO_API)) return false;
    g.linkT = COLLAB_FX.linkT; // 합동 필살: 3초 안에 마법사 쿨타임 스킬이 터지면 2배(spells.js)
    return true;
  }
  if (action.type === 'equip') {
    return !!g.hero && equipItem(g.hero, action.itemId);
  }
  if (action.type === 'sell') {
    if (!g.hero) return false;
    const v = sellItem(g.hero, action.itemId);
    if (v == null) return false;
    saleGold(g, v);
    return true;
  }
  if (action.type === 'sellRarity') {
    if (!g.hero) return false;
    const v = sellItemsByRarity(g.hero, action.rarity);
    if (!v) return false;
    saleGold(g, v);
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

// 도전 중 판매 골드: 아이템은 영웅(메타)에서 바로 빠지므로 이어하기 체크포인트에도 넣는다(층을 다시 해도 되찾을 수 없는 골드)
function saleGold(g, v) {
  g.players[0].gold += v;
  if (g.run.checkpoint) g.run.checkpoint.players[0].gold += v;
}

function meteor(g, o, dbl) {
  // 빙하 운석: 다른 마법사의 빙결 후 3초 안 (빙결 5초 > 3초라 적은 아직 얼어 있음)
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
  // AI 비상 스킬 · 자동 진행 봇(영웅)
  g.botT += dt;
  if (g.botT >= BOT_INTERVAL) {
    g.botT -= BOT_INTERVAL;
    for (let i = 0; i < 2; i++) if (g.players[i].kind === 'bot' && g.phase === 'play') autoSkill(g, i);
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
  if (g.linkT > 0) g.linkT = Math.max(0, g.linkT - dt);
  if (g.phaseT > BERSERK_T) {
    if (g.berserk === 1) emit(g, { type: 'berserk' });
    g.berserk = 2 ** ((g.phaseT - BERSERK_T) / BERSERK_STEP);
  }

  // 학살 가속: 전선(사거리) 안에 적이 없고 접근로 윗부분도 비면 다음 스폰 묶음(burst)을 바로 당긴다
  // (압도적이면 묶음이 접근로에서 줄지어 쏟아져 층이 빨리 지나간다. 전선에 적이 버티고 있으면 원래 일정)
  g.spawnT += (g.spawnT < g.rushT ? dt * RUSH : dt) * (g.fastFloor ? FAST_SPAWN : 1);
  if (!g.enemies.some(e => inReach(e) || e.y < FRONT_Y / 3) && g.spawnIdx < g.spawns.length && g.spawns[g.spawnIdx].t - ACCEL_LEAD > g.spawnT) {
    const sp = g.spawns, b = sp[g.spawnIdx].burst;
    let j = g.spawnIdx;
    while (j + 1 < sp.length && sp[j + 1].burst === b) j++;
    g.spawnT = sp[g.spawnIdx].t - ACCEL_LEAD;
    g.rushT = sp[j].t;
  }
  while (g.spawnIdx < g.spawns.length && g.spawns[g.spawnIdx].t <= g.spawnT) {
    const s = g.spawns[g.spawnIdx++];
    const e = spawnEnemy(g, s.type, s.x, null, s.elite, s.boss);
    if (e && !e.isBoss) { // 잡몹 밀도(stages.js DENSITY): 수가 많은 만큼 한 마리는 약하다
      e.share = 1 / DENSITY;
      e.hp = e.maxHp *= e.share; e.dmg *= e.share; e.gold *= e.share;
    }
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
    g.phase = 'clear';
    g.phaseT = 0;
    g.pick = null; // 마지막 처치와 같은 스텝에 뜬 카드는 버린다(드묾)
    g.pickQ = 0;
    g.bullets.length = 0;
    g.eshots.length = 0;
    emit(g, { type: 'clear', stage: g.stage, stars, gems: [gem, gem] });
    if (flawless) synergy(g, 'flawless', -1, WORLD_W / 2, WALL_Y);
    if (g.hero && g.hero.cls) {
      heroGainXp(g, heroClearXp(g.stage, firstClear), HERO_API);
      lootDrop(g, 'chest', WORLD_W / 2, WALL_Y - 120, HERO_API); // 클리어 보물상자
    }
    if (g.stage >= MAX_STAGE) endOfRun(g, true); // 100층 돌파 = 도전 완료
    // 이어하기는 다음 층부터(클리어 화면에서 앱이 꺼져도 첫 돌파 보석·경험치를 다시 잃지 않게). startStage가 같은 모양으로 덮어쓴다
    else g.run.checkpoint = { ...serializeRun(g), stage: g.stage + 1 };
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
  const hp = enemyHp(st) * T.hp * (em ? em.hp : 1) * (elite || boss ? bossHpMul(st, !!boss) : 1);
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
    gold: goldPerKill(st) * T.gold * (em ? em.gold : 1), share: 1, // share = 잡몹 밀도 몫(경험치)
    reduce: T.beh === 'shield' ? 0.4 : 1,
    stopY: T.beh === 'thrower' ? 520 + g.rng() * 160 : 0,
    t: 0, t2: 0, t3: 0, atkT: 0, cycle: 0, enraged: false, dead: false,
    burn: 0, burnT: 0, burnO: 0, burnSk: false, // 화상: 남은 피해, 남은 시간, 가해자, 스킬 화상인가
    slowT: 0,                    // 서리 화살 둔화 남은 시간
    born: g.phaseT, hit0: -1,    // 등장 시각 · 첫 피해 시각(kill 이벤트의 age/fought — 초반 템포 지표)
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

// ── 성벽 마법사: 기본 주문 시전 ──
// 가장 앞선(성벽에 가까운) 적 — 전선(FRONT_Y)을 넘은 적만(사거리)
function frontMost(g) {
  let best = null;
  const es = g.enemies;
  for (let j = 0; j < es.length; j++) {
    const e = es[j];
    if (inReach(e) && e.y + e.r > 0 && (!best || e.y > best.y)) best = e;
  }
  return best;
}

// 지원 사격: 영웅이 싸우고 있는 적 → 없으면 화면 안의 보스·엘리트 → 가장 앞선 적. 성벽 마법사의 단일 대상 스킬이 노린다
function aimTarget(g) {
  const h = g.heroUnit, t = h && h.state !== 'down' ? h.fightE : null;
  if (t && !t.dead && t.y + t.r > 0) return t;
  return g.enemies.find(e => e.isBoss && inReach(e) && e.y + e.r > 0) || frontMost(g);
}

function updateCannons(g, dt) {
  const tgt = frontMost(g), tb = heroTb(g);
  const aura = tb && g.heroUnit.state !== 'down' ? 1 + tb.aura : 1;
  for (let i = 0; i < 2; i++) {
    const p = g.players[i], c = CANNONS[i];
    const rate = p.stats.rate * (i === 0 ? spellRateMul(g) : 1) * aura; // 질풍: P1만 · 지휘관 오라: 두 마법사
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
      fire(g, i, p, c, tx, ty);
    }
  }
}

// 기본 주문 1회 시전: 다중 시전 = 발사체 수(부채꼴). kind = 'fireball'(P1) | 'frostbolt'(P2)
function fire(g, i, p, c, tx, ty) {
  const n = p.stats.shots, sp = p.stats.spread, B = BASIC_SPELLS[i];
  const mx = c.x + Math.cos(p.angle) * 30, my = c.y + Math.sin(p.angle) * 30;
  const angles = new Array(n);
  const syn = p.syn, pierce = syn.includes('pierce'), homing = syn.includes('homing');
  const mod = pierce ? 'pierce' : syn.includes('flame') ? 'flame' : homing ? 'homing' : null; // 렌더용 히든 조합 표시
  // 조준선에 항상 탄이 가도록: 짝수 발이면 가운데 두 발을 조준선 양옆 0.02rad에 둔다
  const half = (n - 1) / 2, even = n % 2 === 0;
  const stepA = n > 1 ? sp / (2 * (even ? half - 0.5 : half)) : 0;
  for (let k = 0; k < n; k++) {
    const u = k - half;
    const a = even ? p.angle + Math.sign(u) * ((Math.abs(u) - 0.5) * stepA + 0.02) : p.angle + u * stepA;
    angles[k] = a;
    g.bullets.push({
      x: mx, y: my, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, owner: i, caster: i, kind: B.key, syn: mod,
      hit: [], pierce: B.pierce + (pierce ? FX.pierce : 0), // 이미 맞은 적 id · 최대 명중 수(서리 화살 2, 관통탄 +2)
      tgt: homing ? null : false,    // 유도: null=탐색 필요, false=안 함
      life: 0,
    });
  }
  emit(g, { type: 'cast', o: i, spell: B.key, basic: true, x: c.x, y: c.y, tx, ty, n });
  emit(g, { type: 'shoot', o: i, x: mx, y: my, angles }); // 호환(발사 부채꼴 각도)
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
        if (!inReach(e)) continue; // 접근로의 적은 사거리 밖
        const rr = e.r + BULLET_R, dy = b.y - e.y;
        if (dy > rr || dy < -rr) continue;
        const dx = b.x - e.x;
        if (dx * dx + dy * dy > rr * rr) continue;
        if (b.hit.includes(e.id)) continue;
        b.hit.push(e.id);
        basicHit(g, e, b);
        if (b.hit.length < b.pierce) continue;
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

// 주문 피해 공통(기본 주문·스킬): 시전자 o의 치명타 · 쌍둥이 포화 · 거인 사냥꾼(치명타 시 엘리트·보스 ×2) · 체인 라이트닝(치명타)
// · 모루와 망치/합동 작전(기사가 도발한 적). card = 쿨타임/카드 스킬(hit 이벤트 o:3, caster = 시전자, dmgSkill 집계),
// dot = 지속 피해(치명타는 기댓값만, 체인·히트스톱 없음). 치명타 등 적용 후 원피해 반환
function spellHit(g, e, raw, o, kind, card = false, dot = false, crit = !dot && g.rng() < g.players[o].stats.crit) {
  const p = g.players[o], st = p.stats, prev = g._skill;
  if (card) g._skill = true;
  raw *= dot ? 1 + st.crit * (st.critMult - 1) : crit ? st.critMult : 1;
  if (g.duo.includes('twin')) raw *= FX.twin;
  if (g.heroBuff) raw *= g.heroBuff.mul; // 전군 강화 함성
  if (crit && e.isBoss && p.syn.includes('giant')) raw *= FX.giant;
  const h = g.heroUnit;
  if (h && h.state !== 'down' && h.engageR > 0 && (e.x - h.x) ** 2 + (e.y - h.y) ** 2 <= (h.engageR + e.r) ** 2) {
    const anvil = collabOn(g, 'anvil');
    const amp = (anvil ? COLLAB_FX.anvil * collabPow(g) : 0) + (h.tb ? h.tb.tauntAmp : 0);
    if (amp > 0) raw *= 1 + amp;
    if (anvil && !dot) collabProc(g, 'anvil', e.x, e.y);
  }
  const maxHp = e.maxHp, dealt = damage(g, e, raw, o, !dot);
  emit(g, { type: 'hit', x: e.x, y: e.y, dmg: dealt, crit, o: card ? 3 : o, caster: o, kind, big: dealt >= maxHp * 0.05 || (e.isBoss && crit) });
  if (crit && e.isBoss && g.critStopT <= 0) {
    g.critStopT = 0.3;
    emit(g, { type: 'hitstop', ms: 60 });
  }
  if (crit && p.syn.includes('chain')) chainArc(g, e, raw * FX.chainPct, o);
  if (crit) critBoom(g, e, st, raw, o);
  if (!dot) { g._skill = true; onSpellHit(g, e, raw, o, SPELL_API); } // 불꽃 마탄·연쇄 번개(고른 스킬의 피해)
  g._skill = prev;
  return raw;
}

// 치명타 폭발(영구 강화 critBoom): 모든 주문 치명타(지속 피해 제외)
function critBoom(g, e, st, raw, o) {
  if (!(st.boomR > 0)) return;
  const splash = raw * st.boomRatio, es = g.enemies;
  for (let j = 0; j < es.length; j++) {
    const q = es[j];
    if (q === e || q.dead) continue;
    const dx = q.x - e.x, dy = q.y - e.y, rr = st.boomR + q.r;
    if (dx * dx + dy * dy <= rr * rr) damage(g, q, splash, o);
  }
  emit(g, { type: 'boom', x: e.x, y: e.y, r: st.boomR, kind: 'crit' });
}

// 기본 주문 명중: 화염구는 작은 폭발(주변 splashPct), 서리 화살은 둔화. 불꽃 산탄 = 화상 + 화염구 파편
function basicHit(g, e, b) {
  const o = b.owner, p = g.players[o], B = BASIC_SPELLS[o];
  const x = e.x, y = e.y, raw = spellHit(g, e, p.stats.dmg * B.dmg, o, b.kind);
  const flame = p.syn.includes('flame'), es = g.enemies;
  const burn = q => { if (flame && !q.dead) { q.burn += raw * FX.burn; q.burnT = FX.burnT; q.burnO = o; } };
  if (!e.dead) {
    if (!e.isBoss) e.y = Math.max(Math.min(e.y, FRONT_Y), e.y - Math.min(KB_MAX, KB_K * raw / e.maxHp)); // 넉백 (보스 면역, 전선 위로는 안 밀림)
    if (B.slow) e.slowT = B.slowT;
    burn(e);
  }
  if (B.splashR) {
    for (let j = 0; j < es.length; j++) {
      const q = es[j];
      if (q === e || q.dead) continue;
      const rr = B.splashR + q.r;
      if ((q.x - x) ** 2 + (q.y - y) ** 2 > rr * rr) continue;
      damage(g, q, raw * B.splashPct, o, false);
      burn(q);
    }
    emit(g, { type: 'boom', x, y, r: B.splashR, kind: 'fireball', o });
    if (flame) { // 불꽃 산탄: 화염구가 가까운 적들에게 파편으로 흩어진다
      const d2 = q => (q.x - x) ** 2 + (q.y - y) ** 2;
      const near = es.filter(q => q !== e && !q.dead && d2(q) <= FX.shardR ** 2).sort((a, c) => d2(a) - d2(c)).slice(0, FX.shardN);
      for (const q of near) { damage(g, q, raw * FX.shardPct, o); burn(q); }
      if (near.length) emit(g, { type: 'shards', o, x, y, pts: near.map(q => [q.x, q.y]) });
    }
  }
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
  if (e.cursed && g.fusions.includes('twilight')) dmg *= 1 + FUSION_FX.cursedAmp; // 황혼의 저주
  let d = dmg;
  if (e.shield > 0) {
    const a = e.shield < d ? e.shield : d;
    e.shield -= a;
    d -= a;
  }
  const dealt = Math.min(dmg, dmg - d + Math.max(0, e.hp)); // 실제로 깎은 양(초과 피해 제외)
  const who = o === 2 ? 2 : o === 1 ? 1 : 0;
  if (e.hit0 < 0) e.hit0 = g.phaseT;
  if (!g._env) { // 자폭병 폭발(환경 피해)은 누구의 기여도도 아니다
    g.dmgDone[who] += dealt;
    if (who < 2 && g._skill) g.dmgSkill[who] += dealt;
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
  const tb = heroTb(g);
  const heroGoldMul = (g.hero ? heroBonuses(g.hero).goldMul : 1) * (1 + (tb ? tb.gold : 0));
  const mult = (tier ? COMBO_TIERS[tier - 1].gold : 1) * (g.duo.includes('golden') ? FX.golden : 1) * (g.legendT > 0 ? 2 : 1) * heroGoldMul * g.fx.goldMul;
  const gold = Math.ceil(e.gold * mult);
  for (const p of g.players) p.gold += gold; // 두 플레이어 모두 전액
  if (g.chain) { g.chain.kills++; g.chain.gold += gold; }
  emit(g, { type: 'kill', x: e.x, y: e.y, enemy: e.type, gold, isBoss: e.isBoss, o, age: g.phaseT - e.born, fought: e.hit0 < 0 ? 0 : g.phaseT - e.hit0 });
  const prev = g._skill;
  g._skill = true;
  onSpellKill(g, e, o, gold, SPELL_API); // 영혼 수확·황혼·증기 폭발·망령 군단
  g._skill = prev;
  if (g.hero && g.hero.cls) heroOnKill(g, e, HERO_API, o); // 영웅 경험치 + 장비 드롭
  if (e.named) {
    learnAllySpell(g);
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

// AI 동료 마법사: 네임드 보스를 잡을 때마다 냉기·번개 주문을 하나씩 익힌다(런당 최대 3, 층이 높을수록 높은 레벨).
// 다 익힌 뒤에는 익힌 주문이 그 층 레벨까지 오른다
function learnAllySpell(g) {
  const level = allySpellLv(g.stage), key = ALLY_SPELLS.find(k => !g.allySpells[k]);
  const keys = key ? [key] : ALLY_SPELLS.filter(k => g.allySpells[k] < level);
  for (const k of keys) {
    g.allySpells[k] = Math.max(g.allySpells[k] || 0, level);
    emit(g, { type: 'allySpell', spell: k, level: g.allySpells[k], x: CANNONS[1].x, y: CANNONS[1].y - 40 });
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
  const dmg = e.maxHp * 0.5, es = g.enemies, env = g._env;
  g._env = true;
  for (let j = 0; j < es.length; j++) {
    const q = es[j];
    if (q.dead) continue;
    // 일반 자폭병은 더 넓은 반경에서 무조건 유폭 (연쇄 폭발), 나머지는 반경 안에서 절반 피해
    const link = q.beh === 'bomber' && !q.isBoss;
    const dx = q.x - e.x, dy = q.y - e.y, rr = R * (link ? BOMB_LINK : 1) + q.r;
    if (dx * dx + dy * dy > rr * rr) continue;
    damage(g, q, link ? q.hp + q.shield : dmg, o);
  }
  g._env = env;
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
    const tb = heroTb(g);
    if (tb && tb.cap.reviveWard && !g.run.heroRevive) { // 부활 결계 강화(성직자 궁극 특성): 도전마다 1회, 40%
      g.run.heroRevive = true;
      g.wall.hp = g.wall.max * HERO_REVIVE_HP;
      g.freezeT = Math.max(g.freezeT, REVIVE_FREEZE);
      emit(g, { type: 'revive', x: WORLD_W / 2, y: WALL_Y, hp: g.wall.hp, hero: true });
      emit(g, { type: 'heroProc', kind: 'reviveWard', x: WORLD_W / 2, y: WALL_Y });
      emit(g, { type: 'hitstop', ms: 400 });
      return;
    }
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
    g.pickQ = 0;
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
    if (e.slowT > 0) e.slowT -= dt;
    e.frozen = frozen;
    if (e.dead) continue;
    if (e.burnT > 0) { // 화상: 남은 피해를 남은 시간에 걸쳐
      const d = e.burn * Math.min(1, dt / e.burnT);
      e.burn -= d;
      e.burnT -= dt;
      if (e.burnT <= 0) e.burn = e.burnT = 0;
      const prev = g._skill;
      g._skill = !!e.burnSk; // 스킬(불꽃 마탄·불꽃 회오리)이 붙인 화상
      damage(g, e, d, e.burnO, false);
      g._skill = prev;
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
  if (!e.named && e.y < FRONT_Y) spd *= ENTRY_RUSH; // 접근로는 몰려 내려온다
  // 서리 결계(판타지 스킬): 성벽 근처 감속. 광폭화 중엔 감속 무시 + 최대 3배속
  spd *= g.berserk > 1 ? Math.min(3, g.berserk) : frostSlowMul(g, e) * (e.slowT > 0 ? 1 - FROST_SLOW : 1); // + 서리 화살 둔화
  const h = g.heroUnit;
  if (h && h.state !== 'down' && h.engageR > 0) {
    const r = h.engageR;
    const dx = h.x - e.x, dy = h.y - e.y, d2 = dx * dx + dy * dy;
    if (d2 <= r * r) {
      const d = Math.sqrt(d2) || 1;
      if (collabOn(g, 'frostBastion')) { // 서리 방벽: 기사가 붙잡은 적은 얼어붙듯 느려진다
        e.slowT = Math.max(e.slowT, 0.5);
        collabProc(g, 'frostBastion', e.x, e.y);
      }
      if (d <= e.r + HERO_MELEE_R) {
        e.vx = e.vy = 0;
        e.state = 'attackHero';
        e.atkT += dt;
        if (e.atkT >= 1) { e.atkT -= 1; heroTakeDamage(g, e.dmg * g.berserk, HERO_API, e); }
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

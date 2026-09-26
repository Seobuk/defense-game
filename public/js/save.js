// localStorage 저장/불러오기 + 오프라인 보상 계산. 절대 throw 하지 않는다.
import {
  UPGRADE_KEYS, upgradeMax, PERK_KEYS, perkMax, SYN_KEYS, SPEEDS, MAX_STAGE,
  offlineGoldPerMin, OFFLINE_CAP_HOURS,
} from './config.js';
import { toInt } from './util.js';
import { newHero, HERO_CLASS_KEYS, MAX_HERO_LV, SLOTS, RARITY_KEYS, SUBSTATS, BAG_SIZE } from './hero.js';

export const STORAGE_KEY = 'wallDefense.save.v1';
const LV_CAP = 3000; // sim.js 와 같은 무한 업그레이드 상한
const SAVE_DELAY = 1000;
const DMG_MODES = ['full', 'simple', 'off'];

const num = v => { v = Number(v); return Number.isFinite(v) && v > 0 ? v : 0; };
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

function levels(src) {
  src = obj(src);
  const lv = {};
  for (const k of UPGRADE_KEYS) lv[k] = toInt(src[k], 0, Math.min(LV_CAP, upgradeMax(k)));
  return lv;
}

// 어떤 입력이 와도 올바른 저장 객체로 (기본값 채우기 + 범위 검증 + 이전 버전 필드 보충)
export function normalize(d) {
  d = obj(d);
  const s = obj(d.settings);
  const perks = {};
  for (const k of PERK_KEYS) perks[k] = toInt(obj(d.perks)[k], 0, perkMax(k));
  const best = toInt(d.best, 0, MAX_STAGE);
  const p = obj(d.partner);
  return {
    v: 1,
    name: typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 16) : '나',
    stage: toInt(d.stage, 1, Math.min(MAX_STAGE, best + 1)), // 최고 기록 다음 층까지만
    best,
    gems: Math.floor(num(d.gems)),
    gold: num(d.gold),
    lv: levels(d.lv),
    perks,
    auto: bool(d.auto, false),
    partner: { gold: num(p.gold), lv: levels(p.lv) },
    settings: {
      dmgNumbers: DMG_MODES.includes(s.dmgNumbers) ? s.dmgNumbers : 'full',
      sound: bool(s.sound, true),
      shake: bool(s.shake, true),
      speed: SPEEDS.includes(s.speed) ? s.speed : 1,
      autoNext: bool(s.autoNext, true),
    },
    hero: hero(d.hero),
    discovered: Array.isArray(d.discovered) ? [...new Set(d.discovered.filter(k => SYN_KEYS.includes(k)))] : [],
    lastSeen: num(d.lastSeen),
  };
}

// 영웅(클래스·레벨·장비·가방). 없거나 깨졌으면 새 영웅(이전 버전 저장 마이그레이션 포함)
const MAIN_KEYS = ['atkPct', 'heroHpPct', 'dmgReducePct', 'critDmgPct', 'atkSpeedPct'];
const SUB_KEYS = SUBSTATS.map(x => x.key);
function item(it) {
  it = obj(it);
  const main = obj(it.main);
  if (typeof it.id !== 'string' || !it.id || !SLOTS.includes(it.slot) || !RARITY_KEYS.includes(it.rarity) || !MAIN_KEYS.includes(main.key)) return null;
  return {
    id: it.id.slice(0, 32), slot: it.slot, rarity: it.rarity, ilvl: toInt(it.ilvl, 1, MAX_STAGE),
    name: typeof it.name === 'string' ? it.name.slice(0, 40) : '장비',
    main: { key: main.key, value: num(main.value) },
    subs: (Array.isArray(it.subs) ? it.subs : []).map(obj).filter(x => SUB_KEYS.includes(x.key)).slice(0, 3)
      .map(x => ({ key: x.key, value: num(x.value) })),
  };
}
function hero(h) {
  const n = newHero();
  h = obj(h);
  n.cls = HERO_CLASS_KEYS.includes(h.cls) ? h.cls : null;
  n.level = toInt(h.level, 1, MAX_HERO_LV);
  n.xp = num(h.xp);
  n.autoEquip = bool(h.autoEquip, false);
  const eq = obj(h.equip);
  for (const slot of SLOTS) { const it = item(eq[slot]); n.equip[slot] = it && it.slot === slot ? it : null; }
  n.bag = (Array.isArray(h.bag) ? h.bag : []).map(item).filter(Boolean).slice(0, BAG_SIZE);
  return n;
}

export const defaults = () => normalize({});

export function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : defaults();
  } catch {
    return defaults(); // 저장소 막힘 / 깨진 JSON
  }
}

// 1초 모아서 한 번에 기록 (매 프레임 불러도 됨)
let last = null, timer = 0;
export function save(data) {
  last = data;
  if (!timer) timer = setTimeout(flush, SAVE_DELAY);
}

// 마지막으로 받은 데이터를 지금 기록 (lastSeen 갱신 포함)
export function flush() {
  clearTimeout(timer);
  timer = 0;
  if (!last) return false;
  try {
    last.lastSeen = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(last));
    return true;
  } catch {
    return false; // 용량 초과 / 저장소 막힘: 게임은 계속
  }
}

export function clear() {
  last = null;
  clearTimeout(timer);
  timer = 0;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* 무시 */ }
}

// 앱이 백그라운드로 가거나 닫힐 때 놓치지 않게
if (typeof addEventListener === 'function' && typeof document !== 'undefined') {
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
}

// 방치 보상: 1분 미만 무시, 최대 8시간, 시계가 거꾸로 가면 0
export function computeOffline(data, nowMs = Date.now()) {
  const seen = Number(data?.lastSeen), now = Number(nowMs);
  if (!(seen > 0) || !(now > seen)) return { gold: 0, minutes: 0 };
  const minutes = Math.min(OFFLINE_CAP_HOURS * 60, Math.floor((now - seen) / 60000));
  if (minutes < 1) return { gold: 0, minutes: 0 };
  return { gold: offlineGoldPerMin(toInt(data.best, 0, MAX_STAGE), toInt(data.perks?.pickaxe, 0, perkMax('pickaxe'))) * minutes, minutes };
}

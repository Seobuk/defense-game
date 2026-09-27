// localStorage 저장/불러오기 + 오프라인 보상 계산. 절대 throw 하지 않는다.
// v2(로그라이트): 메타(영구) + 진행 중 도전(run, 스테이지 시작 시점). v1 → v2 마이그레이션 포함
import {
  META_KEYS, metaMax, SYN_KEYS, SPEEDS, MAX_STAGE, SPELL_KEYS,
  offlineGemsPerHour, offlineXpPerMin, OFFLINE_CAP_HOURS,
} from './config.js';
import { toInt } from './util.js';
import { newHero, HERO_CLASS_KEYS, MAX_HERO_LV, SLOTS, RARITY_KEYS, SUBSTATS, BAG_SIZE } from './hero.js';
import { normalizeRun } from './sim.js';
import { normalizeTalents } from './talents.js';

export const STORAGE_KEY = 'wallDefense.save.v1'; // 키는 그대로, 안의 스키마가 v:2
export const SAVE_VERSION = 2;
export const MIGRATE_GEMS_PER_BEST = 3; // v1 → v2: 사라지는 골드·강화 레벨 대신 최고 기록 × 3 보석
const SAVE_DELAY = 1000;
const DMG_MODES = ['full', 'simple', 'off'];

const num = v => { v = Number(v); return Number.isFinite(v) && v > 0 ? v : 0; };
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const keys = (v, all) => (Array.isArray(v) ? [...new Set(v.filter(k => all.includes(k)))] : []);

// 어떤 입력이 와도 올바른 v2 저장 객체로 (기본값 채우기 + 범위 검증 + v1 마이그레이션)
// v1: 영웅·보석·최고 기록·도감·설정 유지, 퍼크 3종 → 같은 키의 영구 강화 레벨, 골드·강화 레벨·동료·층은 버리고 최고 기록 × 3 보석
export function normalize(d) {
  d = obj(d);
  const s = obj(d.settings);
  const v1 = d.v !== SAVE_VERSION;
  const best = toInt(d.best, 0, MAX_STAGE);
  const src = obj(v1 ? d.perks : d.metaLv);
  const metaLv = {};
  for (const k of META_KEYS) metaLv[k] = toInt(src[k], 0, metaMax(k));
  const lo = obj(d.lastLoadout);
  return {
    v: SAVE_VERSION,
    name: typeof d.name === 'string' && d.name.trim() ? d.name.trim().slice(0, 16) : '나',
    best,
    gems: Math.floor(num(d.gems)) + (v1 ? best * MIGRATE_GEMS_PER_BEST : 0),
    metaLv,
    auto: bool(d.auto, false),
    settings: {
      dmgNumbers: DMG_MODES.includes(s.dmgNumbers) ? s.dmgNumbers : 'full',
      sound: bool(s.sound, true),
      shake: bool(s.shake, true),
      speed: SPEEDS.includes(s.speed) ? s.speed : 1,
      autoNext: bool(s.autoNext, true),
    },
    hero: hero(d.hero),
    discovered: keys(d.discovered, SYN_KEYS),
    seenSpells: keys(d.seenSpells, SPELL_KEYS),      // 한 번이라도 뽑아 본 스킬(시작 스킬 후보)
    runs: toInt(d.runs, 0, 1e6),                      // 끝낸 도전 수
    lastLoadout: {                                     // '같은 조합으로 도전'
      cls: HERO_CLASS_KEYS.includes(lo.cls) ? lo.cls : null,
      startSpells: keys(lo.startSpells, SPELL_KEYS).slice(0, 2),
    },
    run: !v1 && d.run && typeof d.run === 'object' ? normalizeRun(d.run) : null, // 이어하기(스테이지 시작 시점)
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
  n.talents = normalizeTalents(h.talents, n.level); // 특성이 없던 저장 → 전 클래스 빈 배분(포인트는 레벨로 계산)
  n.autoTalent = bool(h.autoTalent, false);
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

// ── 저장 백업 코드 (기기 이동: APK ↔ iPhone PWA) ──
// 형식: 'WD' + 저장 버전 + '-' + base64url(UTF-8 JSON) + '-' + 체크섬(FNV-1a 32비트, 16진 8자리)
// 옛 버전 코드도 받는다(normalize가 마이그레이션). 공백·줄바꿈은 무시(메신저가 끊어 붙여도 됨)
const CODE_RE = /^WD(\d{1,3})-([A-Za-z0-9_-]+)-([0-9a-f]{8})$/;
const CODE_MAX = 400_000;
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}
const b64url = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

export function exportSave(data) {
  try {
    const body = b64url(new TextEncoder().encode(JSON.stringify(normalize(data))));
    return `WD${SAVE_VERSION}-${body}-${fnv(body)}`;
  } catch {
    return '';
  }
}

// → { ok: true, data } | { ok: false, error: 한국어 문구 }. 절대 throw 없음
export function importSave(code) {
  const bad = error => ({ ok: false, error });
  const s = String(code ?? '').replace(/\s+/g, '');
  if (!s) return bad('백업 코드를 붙여 넣어 주세요.');
  if (s.length > CODE_MAX) return bad('코드가 너무 길어요. 백업 코드만 붙여 넣어 주세요.');
  const m = CODE_RE.exec(s);
  if (!m) return bad(/^WD\d/.test(s) ? '코드가 잘렸거나 바뀌었어요. 빠진 글자 없이 전체를 붙여 넣어 주세요.' : '대마법사의 용사 키우기 백업 코드가 아니에요.');
  if (+m[1] > SAVE_VERSION) return bad('더 새로운 버전에서 만든 코드예요. 게임을 업데이트한 뒤 복원해 주세요.');
  if (fnv(m[2]) !== m[3]) return bad('코드가 잘렸거나 바뀌었어요. 빠진 글자 없이 전체를 붙여 넣어 주세요.');
  let raw;
  try { raw = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(unb64url(m[2]))); } catch { return bad('코드를 읽을 수 없어요. 다시 복사해 주세요.'); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !('hero' in raw || 'best' in raw)) return bad('대마법사의 용사 키우기 백업 코드가 아니에요.');
  return { ok: true, data: normalize(raw) };
}

// 방치 보상: 보석(소량) + 영웅 경험치. 1분 미만 무시, 최대 8시간, 시계가 거꾸로 가면 0
export function computeOffline(data, nowMs = Date.now()) {
  const none = { gems: 0, xp: 0, minutes: 0 };
  const seen = Number(data?.lastSeen), now = Number(nowMs);
  if (!(seen > 0) || !(now > seen)) return none;
  const minutes = Math.min(OFFLINE_CAP_HOURS * 60, Math.floor((now - seen) / 60000));
  if (minutes < 1) return none;
  const best = toInt(data.best, 0, MAX_STAGE), pick = toInt(data.metaLv?.pickaxe, 0, metaMax('pickaxe'));
  return {
    gems: Math.floor(offlineGemsPerHour(best, pick) * minutes / 60),
    xp: Math.floor(offlineXpPerMin(best, pick) * minutes),
    minutes,
  };
}

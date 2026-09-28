// localStorage 저장/불러오기 + 오프라인 보상 계산. 절대 throw 하지 않는다.
// v3(스킬 중심): 메타(영구, 골드·마법사 수련 포함) + 진행 중 도전(run, 스테이지 시작 시점). v1·v2 → v3 마이그레이션 포함
import {
  META_KEYS, metaMax, SYN_KEYS, SPEEDS, speedCap, MAX_STAGE, SPELL_KEYS, TRAIN_KEYS, trainMax, goldPerKill,
  offlineGemsPerHour, offlineXpPerMin, OFFLINE_CAP_HOURS,
} from './config.js';
import { toInt } from './util.js';
import { newHero, HERO_CLASS_KEYS, MAX_HERO_LV, SLOTS, RARITY_KEYS, SUBSTATS, BAG_SIZE } from './hero.js';
import { normalizeRun } from './sim.js';
import { migrateTalents, TALENT_VER, recommendNext, allocateTalent } from './talents.js';
import { normShop, offlineGoldPerHour, offlineMul } from './shop.js'; // 4차 경제: 돌파·출정 준비 저장 · 방치 골드
import { lockedRelics } from './relics.js'; // 4차 유물: 보석으로 해금한 유물(meta.relicUnlocked)

export const STORAGE_KEY = 'wallDefense.save.v1'; // 키는 그대로, 안의 스키마가 v:3
export const SAVE_VERSION = 3;
export const MIGRATE_GEMS_PER_BEST = 3; // v1 → v2: 사라지는 골드·강화 레벨 대신 최고 기록 × 3 보석

// v2 → v3: 보석 강화 기본 마력·시전 속도·성벽 결계 → 마법사 수련(같은 비율 위치, 올림), 없어진 시작 골드 → 쓴 보석 환불,
// 진행 중 도전의 옛 골드(층마다 ×1.18로 불어나던 런 재화) → 같은 '처치 수'만큼의 새 골드(도전이 끝나면 meta.gold로)
export const MIGRATE_TRAIN = { power: ['atk', 30], haste: ['rate', 20], ward: ['wall', 20] }; // 옛 키: [수련 키, 옛 최대 레벨]
const oldStartGoldGems = lv => { let s = 0; for (let i = 0; i < lv; i++) s += Math.ceil(12 * 1.25 ** i); return s; };
const oldGoldPerKill = stage => 3 * 1.18 ** (stage - 1);
export function migrateTraining(oldMetaLv) {
  const t = {};
  for (const k of TRAIN_KEYS) t[k] = 0;
  for (const [old, [k, oldMax]] of Object.entries(MIGRATE_TRAIN)) {
    const lv = toInt(oldMetaLv[old], 0, oldMax);
    t[k] = Math.min(trainMax(k), Math.ceil(lv * trainMax(k) / oldMax));
  }
  return t;
}
function migrateRun(r) {
  r = obj(r);
  const stage = toInt(r.stage, 1, MAX_STAGE), pl = Array.isArray(r.players) ? r.players : [];
  return { ...r, players: pl.map(p => ({ gold: Math.floor(num(obj(p).gold) / oldGoldPerKill(stage) * goldPerKill(stage)) })) };
}
const SAVE_DELAY = 1000;
const DMG_MODES = ['full', 'simple', 'off'];

const num = v => { v = Number(v); return Number.isFinite(v) && v > 0 ? v : 0; };
const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const keys = (v, all) => (Array.isArray(v) ? [...new Set(v.filter(k => all.includes(k)))] : []);

// 어떤 입력이 와도 올바른 v3 저장 객체로 (기본값 채우기 + 범위 검증 + v1·v2 마이그레이션)
// v1: 영웅·보석·최고 기록·도감·설정 유지, 퍼크 pickaxe/critBoom → 같은 키의 영구 강화 레벨, 골드·강화 레벨·동료·층은 버리고 최고 기록 × 3 보석
// v2: 위 MIGRATE_TRAIN 설명대로(손해 없이). 퍼크 startGold(v1)도 쓴 보석으로 환불
export function normalize(d) {
  d = obj(d);
  const s = obj(d.settings);
  const ver = d.v === SAVE_VERSION ? 3 : d.v === 2 ? 2 : 1;
  const best = toInt(d.best, 0, MAX_STAGE);
  const src = obj(ver === 1 ? d.perks : d.metaLv);
  const metaLv = {};
  for (const k of META_KEYS) metaLv[k] = toInt(src[k], 0, metaMax(k));
  const training = {};
  if (ver === 2) Object.assign(training, migrateTraining(src));
  else for (const k of TRAIN_KEYS) training[k] = toInt(obj(d.training)[k], 0, trainMax(k));
  const refund = ver < 3 ? oldStartGoldGems(toInt(src.startGold, 0, 15)) : 0;
  const lo = obj(d.lastLoadout);
  const out = {
    v: SAVE_VERSION,
    profile: profile(d.profile), // 닉네임(옛 최상위 name '나'는 버린다 — 이름이 없으면 시작할 때 한 번 묻는다)
    best,
    gems: Math.floor(num(d.gems)) + (ver === 1 ? best * MIGRATE_GEMS_PER_BEST : 0) + refund,
    gold: ver === 3 ? Math.floor(num(d.gold)) : 0, // 영구 골드(마법사 수련 재화)
    metaLv,
    training,                                       // 마법사 수련 레벨 {atk, rate, crit, multi, wall}
    settings: {
      dmgNumbers: DMG_MODES.includes(s.dmgNumbers) ? s.dmgNumbers : 'full',
      sound: bool(s.sound, true),
      shake: bool(s.shake, true),
      speed: SPEEDS.includes(s.speed) ? Math.min(s.speed, speedCap(best)) : 1, // 4차: 해금 범위를 넘는 저장 배속은 가능한 최대로
      // '자동 진행' 하나(다음 층 자동 · 영웅 궁극기 자동 — sim players[0].auto). 카드는 늘 직접 고른다. 옛 '자동 전투'(최상위 auto)는 버리고
      // 기존 저장은 autoNext 값을 따른다. 새 저장은 ON(카드는 어차피 직접 고르므로)
      autoNext: bool(s.autoNext, true),
      autoPick: bool(s.autoPick, false), // 카드 화면의 '자동 선택'(자동 진행과 별개, 기본 OFF) — sim players[0].autoPick
    },
    hero: hero(d.hero),
    discovered: keys(d.discovered, SYN_KEYS),
    seenSpells: keys(d.seenSpells, SPELL_KEYS),      // 한 번이라도 뽑아 본 스킬(시작 스킬 후보)
    runs: toInt(d.runs, 0, 1e6),                      // 끝낸 도전 수
    lastLoadout: {                                     // '같은 조합으로 도전'
      cls: HERO_CLASS_KEYS.includes(lo.cls) ? lo.cls : null,
      startSpells: keys(lo.startSpells, SPELL_KEYS).slice(0, 2),
    },
    run: ver > 1 && d.run && typeof d.run === 'object' ? normalizeRun(ver === 2 ? migrateRun(d.run) : d.run) : null, // 이어하기(스테이지 시작 시점)
    lastSeen: num(d.lastSeen),
    ...normShop(d), // 4차 경제(shop.js): trainBreak · gemBreak · prep — 없던 저장은 0/false
    relicUnlocked: keys(d.relicUnlocked, lockedRelics({})), // 4차 유물: 해금한 유물(시작 풀 8종은 늘 열려 있어 빼고 저장)
  };
  // 특성 개편 환불 + 진행 중 도전: 그 도전의 클래스는 추천 빌드로 한 번 다시 찍어 전력을 지킨다(정비에서 무료 초기화 가능)
  const c = out.run?.loadout?.cls;
  if (c && out.hero.talentNotice && obj(d.hero).talentVer !== TALENT_VER)
    for (let n = recommendNext(out.hero, c); n && allocateTalent(out.hero, c, n.key); n = recommendNext(out.hero, c));
  return out;
}

// ── 프로필(닉네임) ── 나중에 서버 계정과 id로 잇는다(지금은 서버·로그인 없음). id = 프로필 UUID(기기에서 처음 한 번 만들고, 백업 코드로 옮기면 따라간다)
export const NAME_MIN = 2, NAME_MAX = 10;
const NAME_RE = /^[가-힣A-Za-z0-9]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// → { ok, name(앞뒤 공백 자름), error(한국어) }
export function checkName(v) {
  const name = typeof v === 'string' ? v.normalize('NFC').trim() : '', n = [...name].length; // NFC: 풀어 쓴(NFD) 한글도 받는다
  const error = !n ? '이름을 적어 주세요'
    : /[ㄱ-ㆎᄀ-ᇿ]/.test(name) ? '완성된 글자로 적어 주세요'
    : !NAME_RE.test(name) ? '한글·영문·숫자만 쓸 수 있어요'
    : n < NAME_MIN ? `${NAME_MIN}자 이상 적어 주세요`
    : n > NAME_MAX ? `${NAME_MAX}자까지 쓸 수 있어요` : '';
  return { ok: !error, name, error };
}
export function newId() {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16); // 대체 구현(RFC 4122 v4)
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(b); else for (let i = 0; i < 16; i++) b[i] = Math.random() * 256 | 0;
  b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
function profile(p) {
  p = obj(p);
  const nm = checkName(p.name);
  return {
    id: typeof p.id === 'string' && UUID_RE.test(p.id) ? p.id.toLowerCase() : newId(),
    name: nm.ok ? nm.name : '', // '' = 아직 없음 → 타이틀 '시작' 뒤 입력 창(needsName)
    createdAt: Math.min(Date.now(), Math.floor(num(p.createdAt))) || Date.now(), // 미래·터무니없는 값은 지금으로
  };
}
export const needsName = d => !d?.profile?.name;
// 🎲 판타지풍 이름(최대 3 + 3 + 1 = 7자)
const NAME_A = ['푸른', '붉은', '별빛', '달빛', '황혼', '서리', '폭풍', '은빛', '새벽', '잿빛', '천둥', '심연', '금빛', '바람', '밤하늘', '태양'];
const NAME_B = ['불꽃', '현자', '마도사', '늑대', '까마귀', '수정', '구름', '룬', '불사조', '용', '가시', '방랑자', '예언자', '마녀', '기사', '여우'];
export function randomName(rand = Math.random) {
  const pick = a => a[Math.floor(rand() * a.length) % a.length];
  return pick(NAME_A) + pick(NAME_B) + (rand() < 0.35 ? String(1 + Math.floor(rand() * 9)) : '');
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
  n.autoEquip = bool(h.autoEquip, true);
  // 특성: 구조 버전(talentVer)이 다르면(v0.0.7까지 = 없음) 모든 클래스 배분을 비워 포인트를 돌려주고 정비 화면에서 1회 안내
  const tm = migrateTalents(h.talents, h.talentVer, n.level);
  n.talents = tm.talents;
  n.talentVer = TALENT_VER;
  n.talentNotice = tm.notice || (h.talentVer === TALENT_VER && bool(h.talentNotice, false));
  n.autoTalent = bool(h.autoTalent, false);
  const eq = obj(h.equip);
  for (const slot of SLOTS) { const it = item(eq[slot]); n.equip[slot] = it && it.slot === slot ? it : null; }
  n.bag = (Array.isArray(h.bag) ? h.bag : []).map(item).filter(Boolean).slice(0, BAG_SIZE);
  // v0.0.7까지는 기본이 꺼짐이라 토글을 몰라 알몸으로 싸우던 영웅이 많다: 아무것도 안 낀 영웅은 자동 장착을 켠다
  if (!SLOTS.some(slot => n.equip[slot])) n.autoEquip = true;
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
// current(지금 저장): 프로필이 없던 옛 코드는 이 기기의 id를 이어 쓰고 이름은 비워 둔다(시작할 때 다시 묻는다)
export function importSave(code, current = null) {
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
  const data = normalize(raw);
  // 프로필 없는·id가 깨진 코드: 이 기기의 프로필(id·만든 시각·이름)을 잇는다. 코드에 올바른 이름이 있으면 그 이름
  if (!UUID_RE.test(String(obj(raw.profile).id)) && current?.profile?.id) data.profile = { ...profile(current.profile), ...(data.profile.name ? { name: data.profile.name } : {}) };
  return { ok: true, data };
}

// 방치 보상: 보석(소량) + 골드(shop.js offlineGoldPerHour) + 영웅 경험치. 1분 미만 무시, 최대 8시간, 시계가 거꾸로 가면 0
// 보석 돌파 '심층 채굴'(gemBreak.pickaxe)이 셋 다 곱한다
export function computeOffline(data, nowMs = Date.now()) {
  const none = { gems: 0, gold: 0, xp: 0, minutes: 0 };
  const seen = Number(data?.lastSeen), now = Number(nowMs);
  if (!(seen > 0) || !(now > seen)) return none;
  const minutes = Math.min(OFFLINE_CAP_HOURS * 60, Math.floor((now - seen) / 60000));
  if (minutes < 1) return none;
  const best = toInt(data.best, 0, MAX_STAGE), pick = toInt(data.metaLv?.pickaxe, 0, metaMax('pickaxe'));
  const k = offlineMul({ gemBreak: { pickaxe: toInt(data.gemBreak?.pickaxe, 0, 999) } });
  return {
    gems: Math.floor(offlineGemsPerHour(best, pick) * k * minutes / 60),
    gold: Math.floor(offlineGoldPerHour(best) * k * minutes / 60),
    xp: Math.floor(offlineXpPerMin(best, pick) * k * minutes),
    minutes,
  };
}

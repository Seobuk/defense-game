// v0.1.1 도전 기록(run history) + 평생 통계(lifetime) — 기기 안에만 쌓는다(네트워크 전송 없음). DOM 없음.
// 저장 위치: save.js 저장 객체의 history(오래된 → 최근, 최대 HISTORY_MAX건) · lifetime. 스키마·축약 키·서버 매핑은 docs/DESIGN.md 'v0.1.1 도전 기록·저장 보호 계약'
import { MAX_STAGE } from './config.js';
import { HERO_CLASS_KEYS, MAX_HERO_LV } from './hero.js';
import { REGION_KEYS } from './dungeons.js';
import { TALENTS, branchSpent, branchMax, talentCap } from './talents.js';
import { toInt, UUID_RE } from './util.js';

export const REC_VER = 1;        // 기록 한 건의 스키마 버전(r.v)
export const LIFE_VER = 1;       // 평생 통계 스키마 버전(lifetime.v)
export const HISTORY_MAX = 300;  // 기기에 두는 최근 도전 수(넘치면 오래된 것부터)
export const BACKUP_RUNS = 20;   // 백업 코드에 넣는 최근 도전 수
export const BUCKETS = 10;       // 종료 층 구간(10층 단위: 1~10 · 11~20 · … · 91~100)
export const RESULTS = ['fall', 'abandon', 'clear100']; // 성벽 붕괴 · 포기 · 100층 돌파

const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const arr = v => (Array.isArray(v) ? v : []);
const KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/; // 스킬·유물·특성 키 — 모르는(새 버전) 키도 모양만 맞으면 둔다(화면은 아는 것만 그린다)
const key = v => (typeof v === 'string' && KEY_RE.test(v) && !(v in Object.prototype) ? v : null); // 'constructor' 등은 표 조회에서 Object 멤버로 잡힌다
const keyList = (v, n) => [...new Set(arr(v).map(key).filter(Boolean))].slice(0, n);
const uuid = v => (typeof v === 'string' && UUID_RE.test(v) ? v.toLowerCase() : null);
const when = v => { const t = Math.floor(Number(v)); return t > 0 && t <= Date.now() + 864e5 ? t : 0; }; // ms, 미래(하루 넘게)는 모름(0)
export const bucketOf = floor => Math.min(BUCKETS - 1, Math.floor((toInt(floor, 1, MAX_STAGE) - 1) / 10));

// 기록 한 건(신뢰할 수 없는 입력 → 올바른 모양, id가 없으면 null). 두 번 넣어도 그대로
export function normRecord(x) {
  x = Array.isArray(x) ? unpack(x) : obj(x); // 백업 코드의 자리 배열도 받는다
  const id = uuid(x.id);
  if (!id) return null;
  const sk = [];
  for (const s of arr(x.sk).slice(0, 8)) {
    const k = key(obj(s).k);
    if (!k || sk.some(o => o.k === k)) continue;
    const o = { k, lv: toInt(s.lv, 1, 99) }, m = key(s.m), p = keyList(s.p, 2);
    if (m) o.m = m;
    if (p.length) o.p = p;
    sk.push(o);
  }
  return {
    v: REC_VER, id, pid: uuid(x.pid) || '', app: typeof x.app === 'string' ? x.app.replace(/[^\w.-]/g, '').slice(0, 24) : '',
    t0: when(x.t0), t1: when(x.t1), ps: toInt(x.ps, 0, 1e7),
    fl: toInt(x.fl, 1, MAX_STAGE), cl: toInt(x.cl, 0, MAX_STAGE), res: RESULTS.includes(x.res) ? x.res : 'fall',
    cls: HERO_CLASS_KEYS.includes(x.cls) ? x.cls : null, hl: toInt(x.hl, 1, MAX_HERO_LV), tm: keyList(x.tm, 3), tc: key(x.tc),
    sk, rl: keyList(x.rl, 24), fg: toInt(x.fg, 0, 99), rg: REGION_KEYS.includes(x.rg) ? x.rg : REGION_KEYS[0],
    go: toInt(x.go, 0, 1e15), ge: toInt(x.ge, 0, 1e12), k: toInt(x.k, 0, 1e9), bk: toInt(x.bk, 0, MAX_STAGE), cb: toInt(x.cb, 0, 1e7),
    sp: toInt(x.sp, 1, 9), ap: !!x.ap,
  };
}

// 백업 코드용 자리 배열: 키 이름을 빼서 한 건이 절반 크기. REC_FIELDS 순서는 바꾸지 말고 뒤에만 붙인다.
// pid가 코드의 프로필 id와 같으면 ''(복원할 때 normHistory가 채운다), sk = [[k, lv, m|0, p?]], ap = 0|1
const REC_FIELDS = ['id', 'pid', 'app', 't0', 't1', 'ps', 'fl', 'cl', 'res', 'cls', 'hl', 'tm', 'tc', 'sk', 'rl', 'fg', 'rg', 'go', 'ge', 'k', 'bk', 'cb', 'sp', 'ap'];
export const packRecord = (r, pid) => REC_FIELDS.map(f => (f === 'pid' ? (r.pid === pid ? '' : r.pid) : f === 'ap' ? +r.ap
  : f === 'sk' ? r.sk.map(s => [s.k, s.lv, s.m || 0, ...(s.p ? [s.p] : [])]) : r[f]));
function unpack(a) {
  const o = Object.fromEntries(REC_FIELDS.map((f, i) => [f, a[i]]));
  o.sk = arr(o.sk).map(s => (Array.isArray(s) ? { k: s[0], lv: s[1], m: s[2] || null, p: s[3] } : s));
  return o;
}

// 기록 목록: 깨진 건 버리고, id 중복은 뒤(최근) 것만, 최근 max건. pid가 빈 기록은 이 저장의 프로필 id
export function normHistory(v, max = HISTORY_MAX, pid = '') {
  const out = [], seen = new Set();
  for (const r of arr(v).slice(-max * 2).map(normRecord).reverse()) if (r && !seen.has(r.id)) { seen.add(r.id); if (!r.pid) r.pid = uuid(pid) || ''; out.push(r); }
  return out.slice(0, max).reverse();
}

// 평생 통계. 없던 저장(v0.1.0까지)은 알 수 있는 만큼 시드: 도전 수 = runs, 첫/마지막 플레이 = 프로필 생성·마지막 접속(도전이 있을 때만)
export function normLifetime(v, seed = {}) {
  const has = v && typeof v === 'object' && !Array.isArray(v), L = obj(v), c = obj(L.byCls);
  const runs = toInt(seed.runs, 0, 1e7);
  const ends = Array.from({ length: BUCKETS }, (_, i) => toInt(arr(L.ends)[i], 0, 1e7));
  const byCls = {};
  for (const k of HERO_CLASS_KEYS) if (c[k]) byCls[k] = { runs: toInt(c[k].runs, 0, 1e7), best: toInt(c[k].best, 0, MAX_STAGE) };
  return has ? {
    v: LIFE_VER, playSec: toInt(L.playSec, 0, 1e10), runs: toInt(L.runs, 0, 1e7), kills: toInt(L.kills, 0, 1e13), bossKills: toInt(L.bossKills, 0, 1e9),
    byCls, ends, firstAt: when(L.firstAt), lastAt: when(L.lastAt),
  } : {
    v: LIFE_VER, playSec: 0, runs, kills: 0, bossKills: 0, byCls: {}, ends,
    firstAt: runs ? when(seed.createdAt) : 0, lastAt: runs ? when(seed.lastSeen) : 0,
  };
}

// 끝난 도전 → 기록 한 건. game = 끝난 판(sim), sum = run.js endRun 요약, ctx = { app: '0.1.1-web', now }
export function runRecord(game, meta, sum, ctx = {}) {
  const r = game.run, lg = r.log || {}, hero = game.hero || meta.hero || {}, cls = r.loadout?.cls || hero.cls || null;
  const branches = cls ? TALENTS[cls] || [] : [];
  return normRecord({
    id: lg.id, pid: meta.profile?.id, app: ctx.app, t0: lg.t0, t1: ctx.now ?? Date.now(), ps: Math.round(lg.ps || 0),
    fl: sum.stageReached, cl: sum.floorsCleared, res: sum.victory ? 'clear100' : sum.abandoned ? 'abandon' : 'fall',
    cls, hl: hero.level, tm: branches.filter(b => branchSpent(hero, cls, b.key) >= branchMax(cls, b.key)).map(b => b.key), tc: cls && talentCap(hero, cls),
    sk: Object.entries(game.spells || {}).map(([k, lv]) => ({ k, lv, m: game.mutations?.[k], p: game.fusionParts?.[k] })),
    rl: sum.relics, fg: sum.forgets, rg: REGION_KEYS[game.theme | 0],
    go: sum.rewards?.gold, ge: sum.rewards?.gems, k: lg.k, bk: sum.bossesKilled, cb: Math.max(lg.cb | 0, game.combo?.best | 0),
    sp: lg.sp, ap: lg.ap,
  });
}

// 기록 한 건 추가 + 평생 통계 누적(meta = 저장 객체, 제자리). 같은 id는 두 번 세지 않는다. 추가했으면 true
export function addRecord(meta, rec) {
  rec = normRecord(rec);
  const hist = arr(meta.history);
  if (!rec || hist.some(x => x.id === rec.id)) return false;
  meta.history = [...hist, rec].slice(-HISTORY_MAX);
  const L = meta.lifetime && typeof meta.lifetime === 'object' ? meta.lifetime : (meta.lifetime = normLifetime({}));
  L.runs++;
  L.playSec += rec.ps;
  L.kills += rec.k;
  L.bossKills += rec.bk;
  if (rec.cls) { const c = (L.byCls[rec.cls] ||= { runs: 0, best: 0 }); c.runs++; c.best = Math.max(c.best, rec.cl); }
  L.ends[bucketOf(rec.fl)]++;
  const t = rec.t1 || Date.now();
  if (!L.firstAt) L.firstAt = rec.t0 || t;
  L.lastAt = Math.max(L.lastAt, t);
  return true;
}

// 가장 많이 도전한 클래스(같으면 최고 층이 높은 쪽). 없으면 null
export function favClass(L) {
  let best = null;
  for (const [k, c] of Object.entries(obj(L?.byCls))) if (c.runs > 0 && (!best || c.runs > best.runs || (c.runs === best.runs && c.best > best.best))) best = { cls: k, ...c };
  return best;
}

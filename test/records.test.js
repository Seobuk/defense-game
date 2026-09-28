// v0.1.1 도전 기록 · 평생 통계 · 백업 · 저장 보호 셀프 체크: node test/records.test.js
import assert from 'node:assert/strict';
import { DT } from '../public/js/config.js';
import { step, act, normalizeRun, serializeRun } from '../public/js/sim.js';
import { newRun, restoreRun, endRun } from '../public/js/run.js';
import { defaults, normalize, exportSave, importSave, save, flush, STORAGE_KEY } from '../public/js/save.js';
import { normRecord, normHistory, addRecord, favClass, HISTORY_MAX, BACKUP_RUNS, REC_VER } from '../public/js/records.js';
import { newId } from '../public/js/util.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };
const T = Date.UTC(2026, 8, 1);
const rec = (i, o = {}) => ({ id: newId(), pid: newId(), app: '0.1.1-web', t0: T + i * 6e5, t1: T + i * 6e5 + 3e5, ps: 300, fl: 12, cl: 11, res: 'fall', cls: 'knight', hl: 20,
  sk: [{ k: 'fireball', lv: 6, m: 'fb_a' }, { k: 'blazeTornado', lv: 2, p: ['fireball', 'tornado'] }], rl: ['crown'], rg: 'meadow', go: 900, ge: 40, k: 150, bk: 1, cb: 88, sp: 2, ap: false, ...o });
// 한 판 조금 싸우기(카드는 첫 장) — 처치 수가 쌓이게
function fight(g, secs = 25) {
  for (let t = 0; t < secs && g.phase === 'play'; t += DT) {
    if (g.pick) act(g, 0, { type: 'pick', index: 0 });
    step(g, DT);
    g.events.length = 0;
  }
}

console.log('기록 한 건');
ok('normRecord: 모양 · 두 번 넣어도 그대로 · id 없으면 null · 깨진 값 정리', () => {
  const r = normRecord(rec(1));
  assert.equal(r.v, REC_VER);
  assert.deepEqual(normRecord(r), r);
  assert.equal(normRecord({ ...r, id: 'nope' }), null);
  assert.equal(normRecord(null), null);
  const bad = normRecord({ ...r, fl: 9e9, res: 'x', cls: '<b>', rl: ['crown', '<img>', 'crown'], sk: [{ k: 'a b' }, { k: 'fireball', lv: 'x' }], t1: Date.now() + 9e9, app: '<script>' });
  assert.equal(bad.fl, 100); assert.equal(bad.res, 'fall'); assert.equal(bad.cls, null);
  assert.deepEqual(bad.rl, ['crown']); assert.deepEqual(bad.sk, [{ k: 'fireball', lv: 1 }]);
  assert.equal(bad.t1, 0, '미래 시각 = 모름'); assert.equal(bad.app, 'script');
  assert.ok(JSON.stringify(r).length < 600, `한 건 ${JSON.stringify(r).length}B`);
});

console.log('추가 · 잘라내기 · 평생 통계');
ok(`addRecord: 최근 ${HISTORY_MAX}건만, 평생 통계는 계속 누적 · 같은 id는 한 번`, () => {
  const m = defaults();
  const all = Array.from({ length: HISTORY_MAX + 5 }, (_, i) => rec(i, { cls: i % 3 ? 'knight' : 'ranger', cl: i % 50, fl: (i % 50) + 1, k: 10, bk: i % 2, ps: 60 }));
  for (const r of all) assert.equal(addRecord(m, r), true);
  assert.equal(addRecord(m, all.at(-1)), false, '중복');
  assert.equal(m.history.length, HISTORY_MAX);
  assert.equal(m.history[0].id, all[5].id, '오래된 5건 버림');
  assert.equal(m.history.at(-1).id, all.at(-1).id);
  const L = m.lifetime;
  assert.equal(L.runs, HISTORY_MAX + 5);
  assert.equal(L.playSec, 60 * (HISTORY_MAX + 5));
  assert.equal(L.kills, 10 * (HISTORY_MAX + 5));
  assert.equal(L.bossKills, Math.floor((HISTORY_MAX + 5) / 2));
  assert.equal(L.byCls.knight.runs + L.byCls.ranger.runs, HISTORY_MAX + 5);
  assert.equal(L.byCls.knight.best, 49);
  assert.equal(L.ends.reduce((a, b) => a + b, 0), HISTORY_MAX + 5);
  assert.equal(L.ends[0], all.filter(r => r.fl <= 10).length);
  assert.equal(L.firstAt, all[0].t0);
  assert.equal(L.lastAt, all.at(-1).t1);
  assert.equal(favClass(L).cls, 'knight');
  assert.deepEqual(normalize(m).history, m.history, '저장 왕복');
  assert.deepEqual(normalize(m).lifetime, m.lifetime);
});
ok('normHistory: 중복 id는 최근 것 · 깨진 건 버림', () => {
  const a = rec(1), b = rec(2);
  const h = normHistory([a, 'x', null, b, { ...a, fl: 30 }]);
  assert.deepEqual(h.map(r => r.id), [b.id, a.id]);
  assert.equal(h[1].fl, 30);
});

console.log('결과 3종 (실제 도전)');
ok('성벽 붕괴 · 포기 · 100층 돌파 → res · 필드', () => {
  const m = defaults();
  m.profile.name = '테스트';
  const g = newRun(m, { cls: 'knight' }, 3);
  fight(g);
  assert.ok(g.run.log.k > 0, '처치 수가 쌓인다');
  g.run.log.ps = 123.4; g.run.log.sp = 2; g.run.log.ap = true;
  g.phase = 'defeat';
  const s = endRun(g, m, { app: '0.1.1-web', now: T });
  const r = m.history.at(-1);
  assert.equal(r.res, 'fall');
  assert.equal(r.id, g.run.log.id);
  assert.equal(r.pid, m.profile.id);
  assert.equal(r.app, '0.1.1-web');
  assert.equal(r.t1, T);
  assert.ok(r.t0 > 0);
  assert.equal(r.ps, 123);
  assert.equal(r.fl, s.stageReached); assert.equal(r.cl, s.floorsCleared);
  assert.equal(r.cls, 'knight'); assert.equal(r.hl, m.hero.level);
  assert.equal(r.k, g.run.log.k); assert.equal(r.go, s.rewards.gold); assert.equal(r.ge, s.rewards.gems);
  assert.equal(r.sp, 2); assert.equal(r.ap, true); assert.equal(r.rg, 'meadow');
  assert.deepEqual(r.sk.map(x => x.k), Object.keys(g.spells));
  assert.equal(m.lifetime.runs, 1); assert.equal(m.lifetime.kills, r.k); assert.equal(m.lifetime.playSec, 123);
  assert.equal(endRun(g, m), null); assert.equal(m.history.length, 1, '두 번 정산 없음');

  const a = newRun(m, { cls: 'knight' }, 4);
  endRun(a, m); // 전투 중 끝 = 포기
  assert.equal(m.history.at(-1).res, 'abandon');

  const v = newRun(m, { cls: 'knight' }, 5);
  v.stage = 100; v.run.floors = 100; v.run.victory = true; v.phase = 'clear';
  endRun(v, m);
  const c = m.history.at(-1);
  assert.equal(c.res, 'clear100'); assert.equal(c.fl, 100); assert.equal(c.cl, 100);
  assert.equal(m.lifetime.ends[9], 1); assert.equal(m.lifetime.runs, 3);
  assert.equal(new Set(m.history.map(x => x.id)).size, 3, '도전마다 다른 id');
});
ok('융합 재료 · 변이 · 유물 · 망각 · 특성 요약', () => {
  const m = defaults();
  const g = newRun(m, { cls: 'knight' }, 6);
  g.spells = { blazeTornado: 2, fireball: 6 }; g.fusionParts = { blazeTornado: ['fireball', 'tornado'] }; g.mutations = { fireball: 'fb_a' };
  g.relics.push('crown'); g.run.forgets = 1; g.combo.best = 77;
  endRun(g, m);
  const r = m.history.at(-1);
  assert.deepEqual(r.sk, [{ k: 'blazeTornado', lv: 2, p: ['fireball', 'tornado'] }, { k: 'fireball', lv: 6, m: 'fb_a' }]);
  assert.deepEqual(r.rl, ['crown']); assert.equal(r.fg, 1); assert.equal(r.cb, 77);
  assert.deepEqual(r.tm, []); assert.equal(r.tc, null);
});
ok('이어하기: id · 시작 시각 · 처치 · 플레이 시간이 체크포인트를 따라간다', () => {
  const m = defaults();
  const g = newRun(m, { cls: 'knight' }, 8);
  fight(g, 8);
  g.run.log.ps = 50;
  const cp = serializeRun(g);
  const r = restoreRun(m, cp, 9);
  assert.equal(r.run.log.id, g.run.log.id); assert.equal(r.run.log.t0, g.run.log.t0);
  assert.equal(r.run.log.k, g.run.log.k); assert.equal(r.run.log.ps, 50);
  assert.deepEqual(serializeRun(r), { ...cp, log: { ...cp.log } }, '복원 직후 = 체크포인트');
  // v0.1.0 체크포인트(log 없음) → 새 id, 시작 시각 모름
  const old = { ...cp }; delete old.log;
  const o = normalizeRun(old);
  assert.match(o.log.id, /^[0-9a-f-]{36}$/); assert.equal(o.log.t0, 0); assert.equal(o.log.k, 0);
  const og = restoreRun(m, old, 10); endRun(og, m);
  assert.equal(m.history.at(-1).t0, 0);
});

ok("키 모양 검사: 'constructor' · 'toString' 같은 Object 멤버 이름은 버린다", () => {
  const r = normRecord(rec(1, { sk: [{ k: 'constructor', lv: 3 }, { k: 'fireball', lv: 2, m: 'toString' }], rl: ['valueOf', 'crown'], tm: ['__proto__'], tc: 'hasOwnProperty' }));
  assert.deepEqual(r.sk, [{ k: 'fireball', lv: 2 }]); assert.deepEqual(r.rl, ['crown']); assert.deepEqual(r.tm, []); assert.equal(r.tc, null);
});
ok('도전 중 백업을 복원하면 판의 기록 id가 새로 — 두 기기·같은 기기에서 id가 겹치지 않는다', () => {
  const m = defaults();
  const g = newRun(m, { cls: 'knight' }, 3);
  m.run = g.run.checkpoint;
  const code = exportSave(m), A = importSave(code).data, B = importSave(code).data;
  assert.ok(A.run.log.id !== B.run.log.id && A.run.log.id !== g.run.log.id);
  endRun(restoreRun(A, A.run, 1), A); endRun(g, m);
  assert.notEqual(A.history.at(-1).id, m.history.at(-1).id);
});

console.log('이전 저장 · 백업');
ok('v0.1.0 저장: 기록 없음 → 빈 목록, 평생 통계 시드(도전 수 · 첫/마지막 플레이)', () => {
  const d = normalize({ v: 3, runs: 7, best: 23, profile: { id: newId(), name: '옛사람', createdAt: T }, lastSeen: T + 5e8 });
  assert.deepEqual(d.history, []);
  assert.equal(d.lifetime.runs, 7); assert.equal(d.lifetime.firstAt, T); assert.equal(d.lifetime.lastAt, T + 5e8);
  assert.equal(d.lifetime.kills, 0); assert.deepEqual(d.lifetime.byCls, {});
  assert.deepEqual(normalize(d), d, '다시 넣어도 그대로');
  const z = normalize({ v: 3, runs: 0 });
  assert.equal(z.lifetime.firstAt, 0, '도전 없으면 첫 플레이 모름');
});
ok(`백업 왕복: 평생 통계 + 최근 ${BACKUP_RUNS}건 · 옛 코드(기록 없음)도 복원 · 코드 길이`, () => {
  const m = defaults();
  m.profile.name = '백업왕';
  const base = exportSave(m);
  for (let i = 0; i < 40; i++) addRecord(m, rec(i, { pid: m.profile.id }));
  const code = exportSave(m);
  const r = importSave(code);
  assert.ok(r.ok, r.error);
  assert.equal(r.data.history.length, BACKUP_RUNS);
  assert.deepEqual(r.data.history, m.history.slice(-BACKUP_RUNS));
  assert.deepEqual(r.data.lifetime, m.lifetime);
  assert.equal(m.history.length, 40, '내보내기가 원본을 자르지 않는다');
  console.log(`    백업 코드 길이: 기록 없음 ${base.length}자 → 평생 통계 + 최근 ${BACKUP_RUNS}건 ${code.length}자 (+${code.length - base.length})`);
  assert.ok(code.length < 16000, '메신저로 보낼 수 있는 길이');
  // 옛 코드(v0.1.0: history·lifetime 없음)
  const old = normalize(m); delete old.history; delete old.lifetime; old.runs = 4;
  const body = Buffer.from(JSON.stringify(old)).toString('base64url');
  let h = 0x811c9dc5; for (let i = 0; i < body.length; i++) h = Math.imul(h ^ body.charCodeAt(i), 0x01000193);
  const oc = importSave(`WD3-${body}-${(h >>> 0).toString(16).padStart(8, '0')}`);
  assert.ok(oc.ok, oc.error);
  assert.deepEqual(oc.data.history, []); assert.equal(oc.data.lifetime.runs, 4);
});

console.log('저장 보호');
function mockStorage(limit) {
  const s = new Map();
  const ls = {
    getItem: k => (s.has(k) ? s.get(k) : null),
    setItem: (k, v) => {
      v = String(v);
      if (limit === 'blocked') { const e = new Error('blocked'); e.name = 'SecurityError'; throw e; }
      if (v.length > limit) { const e = new Error('quota'); e.name = 'QuotaExceededError'; e.code = 22; throw e; }
      s.set(k, v);
    },
    removeItem: k => s.delete(k),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });
  return s;
}
ok('용량 초과: 기록만 줄여 다시 — 게임 저장(영웅·보석·도전)은 그대로', () => {
  const m = defaults();
  m.gems = 4321; m.best = 33; m.hero.level = 41;
  for (let i = 0; i < HISTORY_MAX; i++) addRecord(m, rec(i));
  const full = JSON.stringify({ ...m, history: [] }).length;
  const all = [...m.history];
  const s = mockStorage(full + 40 * 400); // 기록 수십 건만 들어가는 저장소
  save(m);
  assert.equal(flush(), true);
  const back = normalize(JSON.parse(s.get(STORAGE_KEY)));
  assert.equal(back.gems, 4321); assert.equal(back.best, 33); assert.equal(back.hero.level, 41);
  assert.ok(back.history.length > 0 && back.history.length < HISTORY_MAX, `기록 ${back.history.length}건`);
  assert.equal(back.history.at(-1).id, m.history.at(-1).id, '최근 기록이 남는다');
  assert.equal(back.lifetime.runs, HISTORY_MAX, '평생 통계는 그대로');
  // 기록을 다 비워도 안 들어가면 실패 — 이전 저장은 그대로
  const prev = s.get(STORAGE_KEY);
  mockStorage(10).set(STORAGE_KEY, prev);
  const s2 = globalThis.localStorage;
  const mem = { ...m, history: [...all] };
  save(mem);
  assert.equal(flush(), false);
  assert.equal(s2.getItem(STORAGE_KEY), prev);
  assert.equal(mem.history.length, HISTORY_MAX, '실패하면 메모리의 기록도 그대로(다음 저장이 빈 목록으로 덮지 않게)');
  // 저장소 막힘(용량 문제 아님): 기록을 버리지 않는다
  mockStorage('blocked');
  const keep = { ...m, history: [...all] };
  save(keep);
  assert.equal(flush(), false);
  assert.equal(keep.history.length, HISTORY_MAX);
  delete globalThis.localStorage;
});
ok('settings.storage: on/off/na만 · 기본 빈 값', () => {
  assert.equal(defaults().settings.storage, '');
  assert.equal(normalize({ settings: { storage: 'on' } }).settings.storage, 'on');
  assert.equal(normalize({ settings: { storage: 'maybe' } }).settings.storage, '');
});

console.log(`도전 기록 테스트 ${n}개 통과`);

// 화면 꺼짐 방지 셀프 체크: node test/awake.test.js
import assert from 'node:assert/strict';
import { SCREEN_ON_KEYS, wantAwake, createAwake } from '../public/js/awake.js';
import { normalize } from '../public/js/save.js';

// 모드 × 도전 중 × 보임 → 켜 둘까
const W = (mode, run, visible) => wantAwake(mode, { run, visible });
assert.equal(W('battle', true, true), true);   // 전투 중(카드 고르는 중 포함 — 도전 화면이면 켬)
assert.equal(W('battle', false, true), false); // 타이틀·정비·결과
assert.equal(W('always', false, true), true);
assert.equal(W('always', true, true), true);
assert.equal(W('off', true, true), false);
for (const m of SCREEN_ON_KEYS) for (const r of [true, false]) assert.equal(W(m, r, false), false); // 숨김·백그라운드는 늘 끔

// 저장: 없던 설정·이상한 값 → '전투 중', 올바른 값은 그대로
assert.equal(normalize({}).settings.screenOn, 'battle');
assert.equal(normalize({ v: 3, settings: { screenOn: 'nope' } }).settings.screenOn, 'battle');
for (const k of SCREEN_ON_KEYS) assert.equal(normalize({ v: 3, settings: { screenOn: k } }).settings.screenOn, k);

// 네이티브: 바뀔 때만 한 번씩 부른다
const calls = [];
const a = createAwake({ keepAwake: o => { calls.push(o.on); return Promise.resolve(); } });
assert.equal(a.supported, true);
a.sync(true); a.sync(true); a.sync(false); a.sync(false); a.sync(true);
assert.deepEqual(calls, [true, false, true]);
const c2 = [];
createAwake({ keepAwake: o => { c2.push(o.on); return Promise.resolve(); } }).sync(false); // 첫 sync(끔)도 보낸다
assert.deepEqual(c2, [false]);
let fail = true; const c3 = [];
const f = createAwake({ keepAwake: o => { c3.push(o.on); return fail ? Promise.reject(new Error('x')) : Promise.resolve(); } });
f.sync(true); await new Promise(r => setTimeout(r, 0)); fail = false;
f.sync(true); f.sync(true); // 실패한 뒤엔 한 번 더 보낸다
assert.deepEqual(c3, [true, true]);

// 웹(Wake Lock 스텁): 잡고 · 풀고 · 시스템이 풀면 다시 잡고 · 잡는 중에 끄면 받자마자 푼다
const locks = [];
const stub = { request: () => { const l = new EventTarget(); l.released = false; l.release = () => { l.released = true; l.dispatchEvent(new Event('release')); return Promise.resolve(); }; locks.push(l); return Promise.resolve(l); } };
Object.defineProperty(globalThis, 'navigator', { value: { wakeLock: stub }, configurable: true });
const tick = () => new Promise(r => setTimeout(r, 0));
const w = createAwake(null);
assert.equal(w.supported, true);
w.sync(true); await tick();
assert.equal(locks.length, 1);
w.sync(false);
assert.equal(locks[0].released, true);
w.sync(true); await tick();
assert.equal(locks.length, 2);
locks[1].release(); // 탭 숨김 등으로 시스템이 풀었다
w.sync(true); await tick();
assert.equal(locks.length, 3);
w.sync(false);
assert.equal(locks[2].released, true);
w.sync(true); w.sync(false); await tick(); // 잡는 중에 끔 → 받자마자 푼다
assert.equal(locks.length, 4);
assert.equal(locks[3].released, true);
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
assert.equal(createAwake(null).supported, false); // 미지원: 조용히
createAwake(null).sync(true);

console.log('awake ok');

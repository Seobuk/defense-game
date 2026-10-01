// 그래픽 단계 · 자동 조절기 셀프 체크: node test/gfx.test.js
import assert from 'node:assert/strict';
import { GFX, GFX_KEYS, levelOf, autoStart, fpsAt, createGovernor, WIN_MS, BAD_WINS, WORK_MS, MID_WORK_MS } from '../public/js/gfx.js';
import { normalize } from '../public/js/save.js';

// 단계 표: 위로 갈수록 가볍다(fps·해상도·연출 모두 내려가거나 같음)
assert.deepEqual(GFX_KEYS, ['auto', 'high', 'mid', 'low']);
for (const [a, b] of [['high', 'mid'], ['mid', 'low']]) for (const k of ['fps', 'dpr', 'fx']) assert.ok(GFX[b][k] <= GFX[a][k], `${b}.${k} <= ${a}.${k}`);
assert.equal(GFX.low.fps, 30);
// 발열 2차: 60fps 는 높음만 · 보통 45 · 폰 해상도는 보통 1.25 · 절전 1
assert.equal(GFX.high.fps, 60); assert.equal(GFX.mid.fps, 45);
assert.equal(GFX.mid.dpr, 1.25); assert.equal(GFX.low.dpr, 1);
// 3배속은 높음이 아니면 30fps 로 그린다
assert.equal(fpsAt(GFX.mid, 3), 30); assert.equal(fpsAt(GFX.mid, 2), 45); assert.equal(fpsAt(GFX.high, 3), 60); assert.equal(fpsAt(GFX.low, 3), 30);

// 설정값 → 단계: 직접 고르면 그대로, 자동은 배운 단계(없으면 높음)
assert.equal(levelOf('mid', 'low'), 'mid');
assert.equal(levelOf('auto', 'low'), 'low');
assert.equal(levelOf('auto', ''), 'high');
assert.equal(levelOf('x', 'y'), 'high');
// 자동의 시작 단계: 절전은 앱을 켤 때마다 보통부터 다시(한 판의 무거움에 영영 묶이지 않게)
assert.equal(autoStart('low'), 'mid');
assert.equal(autoStart('mid'), 'mid');
assert.equal(autoStart(''), 'high');
// 폰(터치 + 좁은 화면): 자동은 보통에서 시작(높음은 직접 고를 때만)
assert.equal(levelOf('auto', '', true), 'mid');
assert.equal(autoStart('', true), 'mid');
assert.equal(autoStart('low', true), 'mid');
assert.equal(levelOf('high', '', true), 'high');

// 한 창(WIN_MS)만큼 같은 프레임을 넣는다 → 반환된 새 단계(없으면 null)
const feed = (g, work, gap) => { let r = null; for (let t = 0; t < WIN_MS; t += gap) r = g.sample(work, gap) ?? r; return r; };

// 가벼운 프레임: 절대 내리지 않는다
let g = createGovernor();
for (let i = 0; i < 20; i++) assert.equal(feed(g, 3, 16.7), null);
assert.equal(g.level, 'high');

// 무거운 창이 BAD_WINS 번 연달아야 한 단계 — 중간에 가벼운 창이 끼면 처음부터
g = createGovernor();
for (let i = 0; i < BAD_WINS - 1; i++) assert.equal(feed(g, WORK_MS + 3, 16.7), null);
assert.equal(feed(g, 3, 16.7), null);
for (let i = 0; i < BAD_WINS - 1; i++) assert.equal(feed(g, WORK_MS + 3, 16.7), null);
assert.equal(feed(g, WORK_MS + 3, 16.7), 'mid');
assert.equal(g.level, 'mid');

// 튀는 몇 프레임(굽기·GC)은 중앙값에 묻힌다
g = createGovernor();
for (let w = 0; w < BAD_WINS * 2; w++) for (let t = 0; t < WIN_MS; t += 16.7) g.sample(t < 200 ? 60 : 4, 16.7);
assert.equal(g.level, 'high');

// 목표 fps 를 못 지키는 느린 프레임(작업은 가벼워도 — GPU·스타일 병목)도 내린다
g = createGovernor('mid');
for (let i = 0; i < BAD_WINS; i++) feed(g, 5, 33);
assert.equal(g.level, 'low');

// 절전 아래는 없다 · 절대 올리지 않는다(오르내림 반복 금지)
for (let i = 0; i < 10; i++) { assert.equal(feed(g, 40, 80), null); assert.equal(feed(g, 1, 16.7), null); }
assert.equal(g.level, 'low');

// 보통(45fps): 높음 기준(WORK_MS)보단 너그럽게 — 45fps 를 지키고 작업이 MID_WORK_MS 아래면 그대로, 넘으면 절전
g = createGovernor('mid');
for (let i = 0; i < BAD_WINS * 3; i++) feed(g, WORK_MS + 2, 22.2);
assert.equal(g.level, 'mid');
for (let i = 0; i < BAD_WINS; i++) feed(g, MID_WORK_MS + 3, 22.2);
assert.equal(g.level, 'low');
// 60Hz 화면의 45fps(16.7/33.3ms 번갈음)는 목표를 지킨 것
g = createGovernor('mid');
for (let w = 0; w < BAD_WINS * 3; w++) for (let t = 0, i = 0; t < WIN_MS; i++) { const d = i % 3 === 2 ? 33.3 : 16.7; g.sample(4, d); t += d; }
assert.equal(g.level, 'mid');
// 포화: 상한(45)을 못 채우고 35fps 로 버티는 폰도 절전으로(메인 스레드가 꽉 차 상한이 아끼는 게 없다) · 41fps 이상이면 그대로
g = createGovernor('mid');
for (let i = 0; i < BAD_WINS; i++) feed(g, 10, 1000 / 35);
assert.equal(g.level, 'low');
g = createGovernor('mid');
for (let i = 0; i < BAD_WINS * 3; i++) feed(g, 10, 1000 / 41);
assert.equal(g.level, 'mid');
// 높음은 그대로 43fps 기준(50fps 로 도는 태블릿을 보통으로 떨구지 않는다)
g = createGovernor('high');
for (let i = 0; i < BAD_WINS * 3; i++) feed(g, 6, 20);
assert.equal(g.level, 'high');
// 3배속(일부러 30fps 로 그림)은 느리다고 보지 않는다
g = createGovernor('mid');
for (let i = 0; i < BAD_WINS * 3; i++) for (let t = 0; t < WIN_MS; t += 33.3) g.sample(6, 33.3, fpsAt(GFX.mid, 3));
assert.equal(g.level, 'mid');

// 90Hz 화면: 매 화면 프레임(11.1ms)·60fps 로 솎은 11/22ms 번갈음·한 칸 걸러(22.2ms, 45fps) 모두 가벼운 작업이면 높음 그대로
for (const gaps of [[11.1], [11.1, 22.2], [22.2]]) {
  g = createGovernor();
  for (let w = 0; w < BAD_WINS * 3; w++) for (let t = 0, i = 0; t < WIN_MS; i++) { const d = gaps[i % gaps.length]; g.sample(3, d); t += d; }
  assert.equal(g.level, 'high', `90Hz ${gaps}`);
}

// reset: 멈춘 동안 창을 비운다(멈춤 전후 프레임이 한 창에 섞이지 않게)
g = createGovernor();
for (let t = 0; t < WIN_MS - 100; t += 16.7) g.sample(50, 16.7);
g.reset();
for (let t = 0; t < WIN_MS - 100; t += 16.7) g.sample(3, 16.7);
assert.equal(g.level, 'high');

// 저장: 새 설정은 자동 · 옛 저장(설정 없음)도 자동 · 이상한 값은 버린다 · 배운 단계 보존
assert.equal(normalize({}).settings.gfx, 'auto');
assert.equal(normalize({ v: 3, settings: { dmgNumbers: 'simple' } }).settings.gfx, 'auto');
assert.equal(normalize({ v: 3, settings: { gfx: 'low' } }).settings.gfx, 'low');
assert.equal(normalize({ v: 3, settings: { gfx: 'ultra', gfxAuto: 'boom' } }).settings.gfx, 'auto');
assert.equal(normalize({ v: 3, settings: { gfxAuto: 'mid' } }).settings.gfxAuto, 'mid');
assert.equal(normalize({ v: 3, settings: { gfxAuto: 'auto' } }).settings.gfxAuto, '');

console.log('gfx tests ok');

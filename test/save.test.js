// 저장 검증 · 오프라인 보상 셀프 체크: node test/save.test.js
import assert from 'node:assert/strict';
import { normalize, computeOffline, load, STORAGE_KEY } from '../public/js/save.js';
import { offlineGoldPerMin, OFFLINE_CAP_HOURS } from '../public/js/config.js';

// 깨진 입력 → 기본값, 절대 throw 없음
for (const bad of [null, undefined, 42, 'x', [], { lv: 'x', perks: [1], settings: 5, partner: null }]) {
  const d = normalize(bad);
  assert.equal(d.stage, 1);
  assert.equal(d.best, 0);
  assert.equal(d.gold, 0);
  assert.deepEqual(d.lv, { atk: 0, rate: 0, crit: 0, multi: 0, wall: 0 });
  assert.deepEqual(d.settings, { dmgNumbers: 'full', sound: true, shake: true, speed: 1, autoNext: true });
  assert.deepEqual(d.discovered, []);
}
assert.equal(STORAGE_KEY, 'wallDefense.save.v1');
assert.equal(load().stage, 1); // node: localStorage 없음 → 기본값

// 범위 검증 · 이전 버전(발견·흔들림 필드 없음) 보충
const d = normalize({
  v: 1, stage: 50, best: 12, gems: -5, gold: 'NaN', lv: { atk: 5.7, rate: 99, crit: -1, multi: 9, wall: 1e9 },
  perks: { pickaxe: 999, critBoom: 2 }, partner: { gold: 100, lv: { atk: 3 } },
  settings: { dmgNumbers: 'huge', sound: false, speed: 7, autoNext: false },
  discovered: ['flame', 'flame', 'nope', 3], lastSeen: -1,
});
assert.equal(d.stage, 13);           // 최고+1 까지만
assert.equal(d.gems, 0);
assert.equal(d.gold, 0);
assert.deepEqual(d.lv, { atk: 5, rate: 15, crit: 0, multi: 5, wall: 3000 });
assert.deepEqual(d.perks, { pickaxe: 20, critBoom: 2, startGold: 0 });
assert.equal(d.partner.gold, 100);
assert.equal(d.partner.lv.atk, 3);
assert.deepEqual(d.settings, { dmgNumbers: 'full', sound: false, shake: true, speed: 1, autoNext: false });
assert.deepEqual(d.discovered, ['flame']);
assert.equal(d.lastSeen, 0);

// 영웅: 이전 저장(필드 없음) → 새 영웅, 깨진 장비는 버림
assert.deepEqual(d.hero, { cls: null, level: 1, xp: 0, autoEquip: false, equip: { weapon: null, helm: null, armor: null, trinket: null, cape: null }, bag: [] });
const sword = { id: 'x1', slot: 'weapon', rarity: 'epic', ilvl: 12, name: '검', main: { key: 'atkPct', value: 12.5 }, subs: [{ key: 'gold', value: 2 }, { key: 'bad', value: 1 }] };
const h = normalize({ hero: { cls: 'ranger', level: 500, xp: 7, autoEquip: true, equip: { weapon: sword, helm: sword, cape: 'x' }, bag: [sword, null, { id: 3 }] } }).hero;
assert.equal(h.cls, 'ranger');
assert.equal(h.level, 99);
assert.equal(h.equip.weapon.id, 'x1');
assert.deepEqual(h.equip.weapon.subs, [{ key: 'gold', value: 2 }]);
assert.equal(h.equip.helm, null, '다른 부위 장비는 거부');
assert.equal(h.bag.length, 1);
assert.equal(normalize({ hero: { cls: 'wizard' } }).hero.cls, null);

// 오프라인 보상
const base = { best: 10, perks: { pickaxe: 2 }, lastSeen: 1_000_000 };
assert.deepEqual(computeOffline(base, 1_000_000 + 59_000), { gold: 0, minutes: 0 });         // 1분 미만
assert.deepEqual(computeOffline(base, 1_000_000 - 999_999), { gold: 0, minutes: 0 });        // 시계 역행
assert.deepEqual(computeOffline({ ...base, lastSeen: 0 }, 5e9), { gold: 0, minutes: 0 });   // 기록 없음
assert.deepEqual(computeOffline(base, 1_000_000 + 5 * 60_000 + 30_000), { gold: offlineGoldPerMin(10, 2) * 5, minutes: 5 });
const cap = OFFLINE_CAP_HOURS * 60;
assert.deepEqual(computeOffline(base, 1_000_000 + 3 * 86_400_000), { gold: offlineGoldPerMin(10, 2) * cap, minutes: cap });
console.log('save.test OK');

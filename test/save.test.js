// 저장 검증 · v1 → v2 마이그레이션 · 오프라인 보상 셀프 체크: node test/save.test.js
import assert from 'node:assert/strict';
import { normalize, computeOffline, load, defaults, STORAGE_KEY, SAVE_VERSION, MIGRATE_GEMS_PER_BEST } from '../public/js/save.js';
import { offlineGemsPerHour, offlineXpPerMin, OFFLINE_CAP_HOURS, META_KEYS } from '../public/js/config.js';
import { newRun } from '../public/js/run.js';

const zeroMeta = Object.fromEntries(META_KEYS.map(k => [k, 0]));
const SETTINGS0 = { dmgNumbers: 'full', sound: true, shake: true, speed: 1, autoNext: true };

// 깨진 입력 → 기본값, 절대 throw 없음
for (const bad of [null, undefined, 42, 'x', [], { lv: 'x', perks: [1], settings: 5, partner: null, run: 'x' }, { v: 2, run: 7, metaLv: 'x', seenSpells: 'x' }]) {
  const d = normalize(bad);
  assert.equal(d.v, SAVE_VERSION);
  assert.equal(d.best, 0);
  assert.equal(d.gems, 0);
  assert.deepEqual(d.metaLv, zeroMeta);
  assert.deepEqual(d.settings, SETTINGS0);
  assert.deepEqual(d.discovered, []);
  assert.deepEqual(d.seenSpells, []);
  assert.equal(d.run, null);
}
assert.equal(STORAGE_KEY, 'wallDefense.save.v1'); // 키는 유지(스키마만 v2)
assert.equal(load().v, SAVE_VERSION); // node: localStorage 없음 → 기본값
assert.ok(!('gold' in defaults()) && !('lv' in defaults()) && !('stage' in defaults()), '골드·강화 레벨·층은 런 한정(저장 최상위에 없음)');

// v1 → v2 마이그레이션: 영웅·보석·최고 기록·도감·설정 유지, 퍼크 → 영구 강화, 골드·레벨·동료·층 버림 + 최고 기록 × 3 보석
const v1 = normalize({
  v: 1, stage: 50, best: 12, gems: 40, gold: 1e9, lv: { atk: 55 }, partner: { gold: 5, lv: { wall: 9 } },
  perks: { pickaxe: 999, critBoom: 2, startGold: 4 },
  settings: { dmgNumbers: 'simple', sound: false, speed: 2, autoNext: false },
  discovered: ['flame', 'flame', 'nope', 3], hero: { cls: 'ranger', level: 30, xp: 5 }, lastSeen: 123,
});
assert.equal(v1.v, 2);
assert.equal(v1.best, 12);
assert.equal(v1.gems, 40 + 12 * MIGRATE_GEMS_PER_BEST);
assert.deepEqual(v1.metaLv, { ...zeroMeta, pickaxe: 20, critBoom: 2, startGold: 4 });
assert.deepEqual(v1.settings, { dmgNumbers: 'simple', sound: false, shake: true, speed: 2, autoNext: false });
assert.deepEqual(v1.discovered, ['flame']);
assert.equal(v1.hero.cls, 'ranger');
assert.equal(v1.hero.level, 30);
assert.equal(v1.run, null, '진행 중 층은 이어하지 않음');
assert.equal(v1.lastSeen, 123);
assert.deepEqual(normalize(v1), v1, 'v2는 다시 넣어도 그대로(보석 중복 지급 없음)');

// v2 범위 검증
const d = normalize({
  v: 2, best: 500, gems: -5, metaLv: { power: 1e9, revive: 3, bogus: 1 }, seenSpells: ['fireball', 'fireball', 'x'],
  runs: -2, lastLoadout: { cls: 'wizard', startSpells: ['tornado', 'nope', 'gale', 'fireball'] },
});
assert.equal(d.best, 100);
assert.equal(d.gems, 0);
assert.equal(d.metaLv.power, 30);
assert.equal(d.metaLv.revive, 1);
assert.ok(!('bogus' in d.metaLv));
assert.deepEqual(d.seenSpells, ['fireball']);
assert.equal(d.runs, 0);
assert.deepEqual(d.lastLoadout, { cls: null, startSpells: ['tornado', 'gale'] });

// 영웅: 이전 저장(필드 없음) → 새 영웅, 깨진 장비는 버림
assert.deepEqual(defaults().hero, { cls: null, level: 1, xp: 0, autoEquip: false, talents: {}, autoTalent: false, equip: { weapon: null, helm: null, armor: null, trinket: null, cape: null }, bag: [] });
const sword = { id: 'x1', slot: 'weapon', rarity: 'epic', ilvl: 12, name: '검', main: { key: 'atkPct', value: 12.5 }, subs: [{ key: 'gold', value: 2 }, { key: 'bad', value: 1 }] };
const h = normalize({ hero: { cls: 'ranger', level: 500, xp: 7, autoEquip: true, equip: { weapon: sword, helm: sword, cape: 'x' }, bag: [sword, null, { id: 3 }] } }).hero;
assert.equal(h.cls, 'ranger');
assert.equal(h.level, 99);
assert.deepEqual(h.equip.weapon.subs, [{ key: 'gold', value: 2 }]);
assert.equal(h.equip.helm, null, '다른 부위 장비는 거부');
assert.equal(h.bag.length, 1);
assert.deepEqual(h.talents, {}, '특성 필드가 없던 영웅 → 빈 배분');

// 특성 배분 검증: 순서·최대 랭크·포인트를 지킨 클래스만 유지, 어긴 클래스는 비움(초기화는 무료)
const th = normalize({ hero: { cls: 'knight', level: 10, autoTalent: true, talents: {
  knight: { crusade1: 3, crusade2: 1 },        // 정상(4점, 포인트 11)
  ranger: { rapid2: 1 },                       // 앞 노드 안 찍음 → 비움
  sorcerer: { fire1: 9 },                      // 최대 랭크 초과 → 비움
  cleric: { punish1: 3, punish2: 3, punish3: 2, punish4: 3, punish5: 1 }, // 12점 > 11포인트 → 비움
  assassin: 'x', bogus: { a: 1 },
} } }).hero;
assert.deepEqual(th.talents, { knight: { crusade1: 3, crusade2: 1 } });
assert.equal(th.autoTalent, true);

// 진행 중 도전(run): JSON 왕복 후 그대로, 깨진 필드는 교정
const meta = defaults();
meta.seenSpells = ['fireball'];
meta.metaLv.startSlot = 1;
newRun(meta, { cls: 'knight', startSpells: ['fireball'] }, 1);
const back = normalize(JSON.parse(JSON.stringify(meta)));
assert.deepEqual(back.run, meta.run, '이어하기 저장 왕복');
assert.deepEqual(back.lastLoadout, { cls: 'knight', startSpells: ['fireball'] });
const broken = normalize({ v: 2, run: { stage: 999, players: [{ gold: -1, lv: { atk: 'x' } }], spells: { fireball: 9 }, gems: { floor: 'NaN' } } }).run;
assert.equal(broken.stage, 100);
assert.equal(broken.players[0].gold, 0);
assert.equal(broken.players[0].lv.atk, 0);
assert.equal(broken.spells.fireball, 5);
assert.equal(broken.gems.floor, 0);

// 오프라인 보상: 보석(소량) + 영웅 경험치, 골드 없음
const base = { best: 10, metaLv: { pickaxe: 2 }, lastSeen: 1_000_000 };
const none = { gems: 0, xp: 0, minutes: 0 };
assert.deepEqual(computeOffline(base, 1_000_000 + 59_000), none);         // 1분 미만
assert.deepEqual(computeOffline(base, 1_000_000 - 999_999), none);        // 시계 역행
assert.deepEqual(computeOffline({ ...base, lastSeen: 0 }, 5e9), none);   // 기록 없음
assert.deepEqual(computeOffline(base, 1_000_000 + 90 * 60_000 + 30_000), {
  gems: Math.floor(offlineGemsPerHour(10, 2) * 90 / 60), xp: Math.floor(offlineXpPerMin(10, 2) * 90), minutes: 90,
});
const cap = OFFLINE_CAP_HOURS * 60, full = computeOffline(base, 1_000_000 + 3 * 86_400_000);
assert.equal(full.minutes, cap);
assert.equal(full.gems, Math.floor(offlineGemsPerHour(10, 2) * OFFLINE_CAP_HOURS));
assert.ok(full.gems > 0 && full.gems < 100, `방치 보석은 소량(${full.gems})`);
assert.ok(!('gold' in full));
assert.ok(computeOffline({ ...base, metaLv: { pickaxe: 10 } }, 1_000_000 + 3 * 86_400_000).gems > full.gems, '황금 곡괭이');
console.log('save.test OK');

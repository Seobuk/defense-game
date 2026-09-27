// 저장 검증 · v1/v2 → v3 마이그레이션 · 오프라인 보상 셀프 체크: node test/save.test.js
import assert from 'node:assert/strict';
import { normalize, computeOffline, load, defaults, exportSave, importSave, STORAGE_KEY, SAVE_VERSION, MIGRATE_GEMS_PER_BEST, MIGRATE_TRAIN } from '../public/js/save.js';
import { offlineGemsPerHour, offlineXpPerMin, OFFLINE_CAP_HOURS, META_KEYS, TRAIN_KEYS, trainMax, goldPerKill } from '../public/js/config.js';
import { newRun } from '../public/js/run.js';

const zeroMeta = Object.fromEntries(META_KEYS.map(k => [k, 0]));
const zeroTrain = Object.fromEntries(TRAIN_KEYS.map(k => [k, 0]));
const SETTINGS0 = { dmgNumbers: 'full', sound: true, shake: true, speed: 1, autoNext: true };
const oldStartGoldGems = lv => { let s = 0; for (let i = 0; i < lv; i++) s += Math.ceil(12 * 1.25 ** i); return s; };

// 깨진 입력 → 기본값, 절대 throw 없음
for (const bad of [null, undefined, 42, 'x', [], { lv: 'x', perks: [1], settings: 5, partner: null, run: 'x' }, { v: 3, run: 7, metaLv: 'x', seenSpells: 'x', training: 'x', gold: 'x' }]) {
  const d = normalize(bad);
  assert.equal(d.v, SAVE_VERSION);
  assert.equal(d.best, 0);
  assert.equal(d.gems, 0);
  assert.equal(d.gold, 0);
  assert.deepEqual(d.metaLv, zeroMeta);
  assert.deepEqual(d.training, zeroTrain);
  assert.deepEqual(d.settings, SETTINGS0);
  assert.deepEqual(d.discovered, []);
  assert.deepEqual(d.seenSpells, []);
  assert.equal(d.run, null);
}
assert.equal(SAVE_VERSION, 3);
assert.equal(STORAGE_KEY, 'wallDefense.save.v1'); // 키는 유지(스키마만 v3)
assert.equal(load().v, SAVE_VERSION); // node: localStorage 없음 → 기본값
assert.ok(!('lv' in defaults()) && !('stage' in defaults()), '층·인게임 강화 레벨은 저장 최상위에 없음');
assert.equal(defaults().gold, 0, '골드는 영구 재화(최상위)');

// v1 → v3 마이그레이션: 영웅·보석·최고 기록·도감·설정 유지, 퍼크 → 영구 강화(시작 골드는 보석 환불), 골드·레벨·동료·층 버림 + 최고 기록 × 3 보석
const v1 = normalize({
  v: 1, stage: 50, best: 12, gems: 40, gold: 1e9, lv: { atk: 55 }, partner: { gold: 5, lv: { wall: 9 } },
  perks: { pickaxe: 999, critBoom: 2, startGold: 4 },
  settings: { dmgNumbers: 'simple', sound: false, speed: 2, autoNext: false },
  discovered: ['flame', 'flame', 'nope', 3], hero: { cls: 'ranger', level: 30, xp: 5 }, lastSeen: 123,
});
assert.equal(v1.v, 3);
assert.equal(v1.best, 12);
assert.equal(v1.gems, 40 + 12 * MIGRATE_GEMS_PER_BEST + oldStartGoldGems(4));
assert.equal(v1.gold, 0, 'v1 인게임 골드(옛 경제)는 버림');
assert.deepEqual(v1.metaLv, { ...zeroMeta, pickaxe: 20, critBoom: 2 });
assert.deepEqual(v1.training, zeroTrain);
assert.deepEqual(v1.settings, { dmgNumbers: 'simple', sound: false, shake: true, speed: 2, autoNext: false });
assert.deepEqual(v1.discovered, ['flame']);
assert.equal(v1.hero.cls, 'ranger');
assert.equal(v1.hero.level, 30);
assert.equal(v1.run, null, '진행 중 층은 이어하지 않음');
assert.equal(v1.lastSeen, 123);
assert.deepEqual(normalize(v1), v1, 'v3는 다시 넣어도 그대로(보석 중복 지급 없음)');

// v2 → v3: 기본 마력·시전 속도·성벽 결계(보석) → 마법사 수련(같은 비율 위치, 올림) · 시작 골드 → 보석 환불 ·
// 남는 강화(골드 획득·카드 선택지 등)는 그대로 · 진행 중 도전의 옛 골드 → 같은 처치 수만큼의 새 골드(강화 레벨은 버림)
const oldGpk = s => 3 * 1.18 ** (s - 1);
const v2 = normalize({
  v: 2, best: 30, gems: 100, metaLv: { power: 15, haste: 20, ward: 1, startGold: 3, greed: 4, choice: 1, revive: 1, bogus: 2 },
  run: { v: 1, stage: 21, players: [{ gold: oldGpk(21) * 500, lv: { atk: 90 } }, { gold: 7, lv: { wall: 3 } }], spells: { fireball: 3, tornado: 2 }, floors: 20 },
});
assert.equal(v2.v, 3);
assert.equal(v2.gems, 100 + oldStartGoldGems(3));
assert.deepEqual(v2.training, {
  ...zeroTrain,
  atk: Math.ceil(15 * trainMax('atk') / MIGRATE_TRAIN.power[1]),
  rate: trainMax('rate'),
  wall: Math.ceil(1 * trainMax('wall') / MIGRATE_TRAIN.ward[1]),
});
assert.deepEqual(v2.metaLv, { ...zeroMeta, greed: 4, choice: 1, revive: 1 });
assert.equal(v2.run.stage, 21);
assert.equal(v2.run.players[0].gold, Math.floor(500 * goldPerKill(21)), '옛 런 골드 → 처치 500마리 분량의 새 골드');
assert.ok(!('lv' in v2.run.players[0]), '인게임 강화 레벨은 없어짐');
assert.equal(v2.run.floors, 20);
assert.ok(v2.run.spells.blazeTornado === undefined && v2.run.spells.fireball === 3, '저장된 스킬은 그대로(합체는 도전을 이어할 때)');
assert.deepEqual(normalize(JSON.parse(JSON.stringify(v2))), v2, 'v3 왕복');

// v3 범위 검증
const d = normalize({
  v: 3, best: 500, gems: -5, gold: 12.7, metaLv: { greed: 1e9, revive: 3, bogus: 1 }, training: { atk: 1e9, crit: -3, multi: 2.5 },
  seenSpells: ['fireball', 'fireball', 'x'], runs: -2, lastLoadout: { cls: 'wizard', startSpells: ['tornado', 'nope', 'gale', 'fireball'] },
});
assert.equal(d.best, 100);
assert.equal(d.gems, 0);
assert.equal(d.gold, 12);
assert.equal(d.metaLv.greed, 20);
assert.equal(d.metaLv.revive, 1);
assert.ok(!('bogus' in d.metaLv) && !('power' in d.metaLv) && !('startGold' in d.metaLv));
assert.deepEqual(d.training, { ...zeroTrain, atk: trainMax('atk'), multi: 2 });
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
meta.training.atk = 3;
newRun(meta, { cls: 'knight', startSpells: ['fireball'] }, 1);
const back = normalize(JSON.parse(JSON.stringify(meta)));
assert.deepEqual(back.run, meta.run, '이어하기 저장 왕복');
assert.deepEqual(back.training, meta.training);
assert.deepEqual(back.lastLoadout, { cls: 'knight', startSpells: ['fireball'] });
const broken = normalize({ v: 3, run: { stage: 999, players: [{ gold: -1 }], spells: { fireball: 9, plasma: 2 }, fusionParts: { plasma: ['x', 'y'] }, gems: { floor: 'NaN' } } }).run;
assert.equal(broken.stage, 100);
assert.equal(broken.players[0].gold, 0);
assert.equal(broken.spells.fireball, 5);
assert.equal(broken.spells.plasma, 2);
assert.deepEqual(broken.fusionParts.plasma, ['fireball', 'lightningStrike'], '깨진 융합 재료 → 재료 칸의 첫 스킬');
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

// 백업 코드: 왕복 = 동일, 손상·남의 코드·미래 버전은 한국어 오류, 옛 버전(v1) 내용은 마이그레이션
{
  const src = normalize({ v: 2, best: 33, gems: 1234, runs: 7, name: '용사', discovered: ['flame', 'twin'], seenSpells: ['fireball'],
    metaLv: { power: 5, revive: 1 }, hero: { cls: 'cleric', level: 42, talents: { cleric: { heal1: 1 } } } });
  src.run = newRun(src, { cls: 'cleric', startSpells: [] }).run.checkpoint;
  const code = exportSave(src);
  assert.match(code, new RegExp(`^WD${SAVE_VERSION}-[A-Za-z0-9_-]+-[0-9a-f]{8}$`));
  const back = importSave(' \n' + code.slice(0, 20) + '\n ' + code.slice(20) + '\n'); // 메신저가 끊어 붙인 코드
  assert.ok(back.ok);
  assert.deepEqual(back.data, normalize(JSON.parse(JSON.stringify(src))));
  assert.equal(exportSave(back.data), code, '다시 백업해도 같은 코드');
  const flip = code.slice(0, 10) + (code[10] === 'A' ? 'B' : 'A') + code.slice(11);
  for (const bad of [null, '', 'hello', code.slice(0, -3), flip, 'WD9-' + code.slice(4), '{"best":3}']) {
    const r = importSave(bad);
    assert.equal(r.ok, false, String(bad).slice(0, 20));
    assert.ok(/[가-힣]/.test(r.error), r.error);
  }
  const foreign = Buffer.from(JSON.stringify([1, 2])).toString('base64url');
  assert.equal(importSave(`WD2-${foreign}-${code.slice(-8)}`).ok, false);
  const oldBody = Buffer.from(JSON.stringify({ v: 1, best: 12, gems: 5, perks: { pickaxe: 2 }, hero: { cls: 'ranger', level: 9 } })).toString('base64url');
  let h = 0x811c9dc5; for (const c of oldBody) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  const old = importSave(`WD1-${oldBody}-${(h >>> 0).toString(16).padStart(8, '0')}`);
  assert.ok(old.ok);
  assert.equal(old.data.gems, 5 + 12 * MIGRATE_GEMS_PER_BEST);
  assert.equal(old.data.metaLv.pickaxe, 2);
}
console.log('save.test OK');

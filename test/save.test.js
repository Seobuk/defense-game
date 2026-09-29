// 저장 검증 · v1/v2 → v3 마이그레이션 · 오프라인 보상 셀프 체크: node test/save.test.js
import assert from 'node:assert/strict';
import { offlineGoldPerHour } from '../public/js/shop.js';
import { normalize, computeOffline, load, defaults, exportSave, importSave, STORAGE_KEY, SAVE_VERSION, MIGRATE_GEMS_PER_BEST, MIGRATE_TRAIN, checkName, needsName, randomName, newId } from '../public/js/save.js';
import { offlineGemsPerHour, offlineXpPerMin, OFFLINE_CAP_HOURS, META_KEYS, TRAIN_KEYS, trainMax, goldPerKill, speedCap, nextSpeed } from '../public/js/config.js';
import { newRun, restoreRun } from '../public/js/run.js';
import { serializeRun } from '../public/js/sim.js';

const zeroMeta = Object.fromEntries(META_KEYS.map(k => [k, 0]));
const zeroTrain = Object.fromEntries(TRAIN_KEYS.map(k => [k, 0]));
const SETTINGS0 = { dmgNumbers: 'full', sound: true, shake: true, speed: 1, autoNext: true, autoPick: false, storage: '', gfx: 'auto', gfxAuto: '' }; // 새 저장 = 자동 진행 ON(카드는 늘 직접) · 카드 자동 선택 OFF
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
// '자동 진행' 저장값은 하나(settings.autoNext): 기존 저장은 그 값을 따르고, 옛 '자동 전투'(최상위 auto)는 버린다
assert.equal(normalize({ v: 3, auto: true, settings: { autoNext: true } }).settings.autoNext, true, '기존 저장: autoNext 유지(ON)');
assert.equal(normalize({ v: 3, auto: true, settings: { autoNext: false } }).settings.autoNext, false, '기존 저장: autoNext 유지(OFF) — 옛 자동 전투 ON은 무시');
assert.ok(!('auto' in normalize({ v: 3, auto: true })), '최상위 auto 없음(저장값 하나)');
assert.equal(normalize({ v: 3, settings: { autoPick: true } }).settings.autoPick, true, '카드 자동 선택 저장');

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
assert.deepEqual(v1.settings, { dmgNumbers: 'simple', sound: false, shake: true, speed: 2, autoNext: false, autoPick: false, storage: '', gfx: 'auto', gfxAuto: '' });
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
assert.deepEqual(defaults().hero, { cls: null, level: 1, xp: 0, autoEquip: true, talents: {}, autoTalent: false, talentVer: 3, talentNotice: false, equip: { weapon: null, helm: null, armor: null, trinket: null, cape: null }, bag: [] });
const sword = { id: 'x1', slot: 'weapon', rarity: 'epic', ilvl: 12, name: '검', main: { key: 'atkPct', value: 12.5 }, subs: [{ key: 'gold', value: 2 }, { key: 'bad', value: 1 }] };
const h = normalize({ hero: { cls: 'ranger', level: 500, xp: 7, autoEquip: true, equip: { weapon: sword, helm: sword, cape: 'x' }, bag: [sword, null, { id: 3 }] } }).hero;
assert.equal(h.cls, 'ranger');
assert.equal(h.level, 99);
assert.deepEqual(h.equip.weapon.subs, [{ key: 'gold', value: 2 }]);
assert.equal(h.equip.helm, null, '다른 부위 장비는 거부');
assert.equal(h.bag.length, 1);
assert.deepEqual(h.talents, {}, '특성 필드가 없던 영웅 → 빈 배분');
assert.equal(normalize({ hero: { autoEquip: false } }).hero.autoEquip, true, '아무것도 안 낀 옛 영웅 → 자동 장착 켬');
assert.equal(normalize({ hero: { cls: 'knight', autoEquip: false, equip: { weapon: sword } } }).hero.autoEquip, false, '장비를 낀 영웅은 설정 유지');

// 특성 배분 검증(talentVer 3 = 현재 구조): 단 해금·택1·최대 랭크·포인트를 지킨 클래스만 유지, 어긴 클래스는 비움(초기화는 무료)
const th = normalize({ hero: { cls: 'knight', level: 10, autoTalent: true, talentVer: 3, talents: {
  knight: { crusade1: 3, crusade2: 1, crusade3: 2 },  // 정상(6점, 포인트 10)
  ranger: { rapid3: 1 },                              // 2단인데 갈래 0점 → 비움
  sorcerer: { fire1: 9 },                             // 최대 랭크 초과 → 비움
  cleric: { punish1: 3, punish2: 3, punish3: 3, punish6: 1, punish7: 1 }, // 11점 > 10포인트 → 비움
  assassin: 'x', bogus: { a: 1 },
} } }).hero;
assert.deepEqual(th.talents, { knight: { crusade1: 3, crusade2: 1, crusade3: 2 } });
assert.equal(th.autoTalent, true);
assert.equal(th.talentNotice, false);
// 특성 개편 이전: 옛 구조(talentVer 없음 — v0.0.7까지)는 모든 클래스 포인트를 돌려주고 정비 화면 안내 1회. 다시 넣어도 안내는 유지(닫기 전까지)
const old7 = normalize({ v: 3, hero: { cls: 'knight', level: 40, talents: { knight: { crusade1: 3, crusade2: 3, crusade3: 2 }, ranger: { rapid1: 1 } } } });
assert.deepEqual(old7.hero.talents, {});
assert.equal(old7.hero.talentVer, 3);
assert.equal(old7.hero.talentNotice, true);
assert.deepEqual(normalize(JSON.parse(JSON.stringify(old7))), old7, '이전은 한 번만(포인트 중복 없음, 안내 유지)');
assert.equal(normalize({ hero: { cls: 'knight', level: 40 } }).hero.talentNotice, false, '찍은 게 없던 옛 저장은 안내 없음');
// 이전 + 진행 중 도전: 그 도전의 클래스만 추천 빌드로 다시 찍어 이어하기 전력 유지(다른 클래스는 환불 그대로)
const old7r = normalize({ v: 3, hero: { cls: 'cleric', level: 48, talents: { cleric: { x: 3 }, knight: { crusade1: 3 } } }, run: { stage: 27, loadout: { cls: 'cleric', startSpells: [] } } });
assert.ok(Object.keys(old7r.hero.talents.cleric || {}).length > 0 && !old7r.hero.talents.knight, '이어하기 클래스는 추천 빌드로');
assert.equal(old7r.hero.talentNotice, true);
assert.deepEqual(normalize(JSON.parse(JSON.stringify(old7r))).hero.talents, old7r.hero.talents, '두 번째 불러오기에서 다시 찍지 않는다');

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
assert.equal(broken.spells.fireball, 6, '스킬 만렙 6으로 자름');
assert.equal(broken.spells.plasma, 2);
assert.deepEqual(broken.fusionParts.plasma, ['fireball', 'lightningStrike'], '깨진 융합 재료 → 재료 칸의 첫 스킬');
assert.equal(broken.gems.floor, 0);
// 옛 도전 저장의 AI 동료 주문(allySpells)·auto는 조용히 버린다(오류 없음), 옛 Lv5 스킬·융합은 그대로
const oldRun = normalize({ v: 3, run: { stage: 12, allySpells: { iceLance: 2, bogus: 9 }, auto: true, spells: { fireball: 5, blazeTornado: 3 }, fusionParts: { blazeTornado: ['flameBullet', 'tornado'] } } }).run;
assert.ok(!('allySpells' in oldRun) && !('auto' in oldRun));
assert.deepEqual(oldRun.spells, { fireball: 5, blazeTornado: 3 });
assert.deepEqual(oldRun.fusionParts.blazeTornado, ['flameBullet', 'tornado']);
// v0.0.7 도전(run v:2)의 융합은 옛 규칙(평균 레벨로 바로 합체)이라 재료를 만렙으로 치지 않는다: 재료는 Lv1로만 발동, 이어하기 왕복에도 유지
const lgRun = normalize({ v: 3, run: { v: 2, stage: 13, spells: { stormEye: 5, fireball: 3 }, fusionParts: { stormEye: ['lightningStrike', 'tornado'] } } }).run;
assert.deepEqual(lgRun.legacy, ['stormEye']);
const lg = restoreRun(defaults(), lgRun, 1);
assert.equal(lg.book.lightningStrike, 1);
assert.equal(lg.book.tornado, 1);
assert.deepEqual(serializeRun(lg).legacy, ['stormEye']);
const nw = restoreRun(defaults(), { ...lgRun, v: 3, legacy: [] }, 1);
assert.equal(nw.book.tornado, 6, '새 규칙 융합의 재료는 만렙으로 발동');

// 오프라인 보상: 보석(소량) + 골드(4차 경제, shop.js offlineGoldPerHour) + 영웅 경험치
const base = { best: 10, metaLv: { pickaxe: 2 }, lastSeen: 1_000_000 };
const none = { gems: 0, gold: 0, xp: 0, minutes: 0 };
assert.deepEqual(computeOffline(base, 1_000_000 + 59_000), none);         // 1분 미만
assert.deepEqual(computeOffline(base, 1_000_000 - 999_999), none);        // 시계 역행
assert.deepEqual(computeOffline({ ...base, lastSeen: 0 }, 5e9), none);   // 기록 없음
assert.deepEqual(computeOffline(base, 1_000_000 + 90 * 60_000 + 30_000), {
  gems: Math.floor(offlineGemsPerHour(10, 2) * 90 / 60), gold: Math.floor(offlineGoldPerHour(10) * 90 / 60), xp: Math.floor(offlineXpPerMin(10, 2) * 90), minutes: 90,
});
const cap = OFFLINE_CAP_HOURS * 60, full = computeOffline(base, 1_000_000 + 3 * 86_400_000);
assert.equal(full.minutes, cap);
assert.equal(full.gems, Math.floor(offlineGemsPerHour(10, 2) * OFFLINE_CAP_HOURS));
assert.ok(full.gems > 0 && full.gems < 100, `방치 보석은 소량(${full.gems})`);
assert.equal(full.gold, Math.floor(offlineGoldPerHour(10) * OFFLINE_CAP_HOURS));
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
  const exp = normalize(JSON.parse(JSON.stringify(src)));
  assert.notEqual(back.data.run.log.id, exp.run.log.id, '도전 중 코드 → 복원한 판은 새 기록 id(갈래)');
  exp.run.log.id = back.data.run.log.id;
  assert.deepEqual(back.data, exp);
  assert.equal(exportSave(back.data), exportSave(exp), '다시 백업해도 같은 코드(판 id만 새로)');
  const idle = { ...src, run: null };
  assert.equal(exportSave(importSave(exportSave(idle)).data), exportSave(idle), '도전 없는 저장은 코드까지 그대로');
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
// 4차 배속 해금: 1배 → 최고 10층 2배 → 30층 3배, 버튼은 열린 단계만 순환, 저장 배속은 해금 범위로 낮춤
assert.deepEqual([0, 9, 10, 29, 30, 100].map(speedCap), [1, 1, 2, 2, 3, 3]);
assert.deepEqual([[1, 0], [1, 10], [2, 10], [2, 30], [3, 30], [3, 10]].map(([c, b]) => nextSpeed(c, b)), [1, 2, 1, 3, 1, 1]);
assert.deepEqual([5, 15, 40].map(best => normalize({ v: 3, best, settings: { speed: 3 } }).settings.speed), [1, 2, 3], '저장 배속 클램프');

// 닉네임(프로필): 2~10자 한글·영문·숫자, 앞뒤 공백 자름 · 저장/백업 왕복 · 옛 저장은 이름 없음 → 입력 창 1회
{
  for (const ok of ['푸른불꽃', '별빛현자7', 'Mage', 'ab', '가나다라마바사아자차', '  용사  ']) assert.ok(checkName(ok).ok, ok);
  assert.equal(checkName('  용사  ').name, '용사');
  for (const bad of ['', '   ', '가', 'a', '가나다라마바사아자차카', '용 사', '<b>x</b>', 'ㅎㅎ', '용사!', 'name😀', null, 42]) {
    const r = checkName(bad);
    assert.equal(r.ok, false, String(bad));
    assert.ok(/[가-힣]/.test(r.error), r.error);
  }
  for (let i = 0; i < 300; i++) assert.ok(checkName(randomName()).ok, '🎲 추천 이름은 늘 규칙을 지킨다');
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  assert.match(newId(), UUID);
  const rc = globalThis.crypto.randomUUID; // 대체 구현(randomUUID 없는 옛 WebView)
  try { globalThis.crypto.randomUUID = undefined; assert.match(newId(), UUID); assert.notEqual(newId(), newId()); } finally { globalThis.crypto.randomUUID = rc; }

  // 새 저장·옛 저장(프로필 없음, 옛 최상위 name '나') → id·createdAt은 생기고 이름은 비어 있다 → 입력 창
  const d0 = defaults(), old = normalize({ v: 3, best: 12, name: '나' });
  for (const d of [d0, old]) { assert.match(d.profile.id, UUID); assert.ok(d.profile.createdAt > 0); assert.equal(d.profile.name, ''); assert.ok(needsName(d)); assert.ok(!('name' in d)); }
  assert.notEqual(d0.profile.id, old.profile.id);
  // 이름을 정하면 다시 불러와도 그대로(id·createdAt 유지 → 다시 묻지 않음), 깨진 이름은 비워서 다시 묻는다
  old.profile.name = '별빛현자7';
  const again = normalize(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(again.profile, old.profile);
  assert.ok(!needsName(again));
  assert.equal(normalize({ v: 3, profile: { ...old.profile, name: '<img onerror=x>' } }).profile.name, '');
  assert.equal(normalize({ v: 3, profile: { id: 'x', name: '용사' } }).profile.name, '용사');
  assert.match(normalize({ v: 3, profile: { id: 'x', name: '용사' } }).profile.id, UUID, '깨진 id는 새로 만든다');

  // 백업 코드 왕복: 프로필(id·이름·만든 시각) 그대로
  const code = exportSave(again), back = importSave(code, defaults());
  assert.ok(back.ok);
  assert.deepEqual(back.data.profile, again.profile);
  // 프로필 없던 옛 코드: 복원은 되고, 이 기기의 프로필(id·이름)을 이어 쓴다
  const body = Buffer.from(JSON.stringify({ v: 3, best: 20, gems: 9, name: '나', hero: { cls: 'ranger', level: 9 } })).toString('base64url');
  let h = 0x811c9dc5; for (const c of body) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  const oc = `WD3-${body}-${(h >>> 0).toString(16).padStart(8, '0')}`;
  const r1 = importSave(oc, again);
  assert.ok(r1.ok);
  assert.equal(r1.data.best, 20);
  assert.equal(r1.data.profile.id, again.profile.id);
  assert.equal(r1.data.profile.createdAt, again.profile.createdAt);
  assert.equal(r1.data.profile.name, again.profile.name);
  const enc = o => { const b = Buffer.from(JSON.stringify(o)).toString('base64url'); let k = 0x811c9dc5; for (const c of b) k = Math.imul(k ^ c.charCodeAt(0), 0x01000193); return `WD3-${b}-${(k >>> 0).toString(16).padStart(8, '0')}`; };
  assert.equal(importSave(enc({ v: 3, best: 5, hero: {}, profile: { id: 'not-a-uuid' } }), again).data.profile.id, again.profile.id, '깨진 id의 코드도 기기 id 유지');
  const far = importSave(enc({ v: 3, best: 5, hero: {}, profile: { id: again.profile.id, name: '용사', createdAt: 1e300 } }), again).data.profile.createdAt;
  assert.ok(far <= Date.now(), '미래 createdAt은 지금으로');
  assert.equal(checkName('한글용사'.normalize('NFD')).name, '한글용사');
  assert.ok(checkName('한글용사'.normalize('NFD')).ok);
  assert.equal(checkName('용사ㅎ').error, '완성된 글자로 적어 주세요');
  assert.ok(importSave(oc).ok && needsName(importSave(oc).data), '지금 저장 없이도 복원');
  // 도전의 마법사 이름표 = 닉네임
  assert.equal(newRun(again, { cls: 'knight', startSpells: [] }).players[0].name, '별빛현자7');
}
console.log('save.test OK');

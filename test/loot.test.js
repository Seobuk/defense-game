// v0.1.7 전리품 · 하위 장비 자동 판매(public/js/loot.js) — 기준 · 보호(잠금·장착·더 좋은 것·특별한 장비) · 넘침 정리 · 도전 집계 · 저장
import assert from 'node:assert/strict';
import { rollItem, itemPower, sellValue, BAG_SIZE, newHero, sellItem, sellItemsByRarity, trimBag } from '../public/js/hero.js';
import { autoSells, cleanPreview, gainItem, trashIdx, goodDrop, normAutoSell } from '../public/js/loot.js';
import { autoEquipAll, SET_BREAK, heroTb } from '../public/js/hero.js';
import { setCounts } from '../public/js/items.js';
import { openBox } from '../public/js/shop.js';
import { normalize } from '../public/js/save.js';
import { mulberry32 } from '../public/js/util.js';

const rng = mulberry32(7);
const make = (rarity, slot = 'weapon', ilvl = 10, extra = {}) => {
  let it = null;
  for (let i = 0; i < 5000 && !(it && it.rarity === rarity && it.slot === slot); i++) it = rollItem(ilvl, rarity === 'common' ? 'normal' : 'chest', rng, 'knight');
  assert.ok(it.rarity === rarity && it.slot === slot, 'roll ' + rarity);
  return Object.assign(it, { unique: null, set: null }, extra); // 기본은 평범한 장비(고유·세트는 테스트가 붙인다)
};
const hero = () => { const h = newHero(); h.cls = 'knight'; h.autoEquip = false; return h; };

// 기본 = 희귀 이하 자동 판매, 지금보다 좋은 장비(빈 칸 포함)는 절대 아님
{
  const h = hero();
  const c = make('common');
  assert.equal(autoSells(h, c), false, '빈 칸이면 일반도 팔지 않는다(장착하면 강해짐)');
  h.equip.weapon = make('epic', 'weapon', 60);
  const weak = make('rare', 'weapon', 1);
  assert.ok(itemPower(weak) < itemPower(h.equip.weapon));
  assert.equal(autoSells(h, weak), true, '희귀 이하 + 더 약함 → 판매');
  assert.equal(autoSells(h, { ...weak, lock: 1 }), false, '잠금은 절대 아님');
  assert.equal(autoSells(h, h.equip.weapon), false, '장착 중은 아님');
  const epic = make('epic', 'weapon', 1);
  assert.equal(autoSells(h, epic), false, '영웅 등급은 기본 기준 밖');
  h.autoSell.weaker = true;
  assert.equal(autoSells(h, epic), itemPower(epic) < itemPower(h.equip.weapon), '약하면 자동 처리');
  const leg = make('legend', 'weapon', 1);
  h.equip.weapon = make('legend', 'weapon', 100);
  if (itemPower(leg) < itemPower(h.equip.weapon)) {
    assert.equal(autoSells(h, leg), false, '전설은 기본 보호');
    h.autoSell.keep = false;
    assert.equal(autoSells(h, leg), true, '보호를 풀면 약한 전설도');
    h.autoSell.keep = true;
  }
  assert.equal(autoSells(h, { ...epic, set: 'x' }), false, '세트 조각 보호');
  assert.equal(autoSells(h, { ...epic, unique: { key: 'x' } }), false, '고유 옵션 보호');
  h.autoSell = { ...h.autoSell, upto: 'off', weaker: false };
  assert.equal(autoSells(h, weak), false, '끄기');
}

// 드롭 획득: 자동 판매 → 골드 · 집계, 남는 드롭은 NEW + 최고 획득
{
  const h = hero();
  h.equip.weapon = make('legend', 'weapon', 100);
  const junk = make('common', 'weapon', 1);
  const r = gainItem(h, junk, 'run1');
  assert.ok(r.sold && r.gold === sellValue(junk) && r.n === 1 && !h.bag.includes(junk), '하위 장비 즉시 판매');
  const keep = make('epic', 'helm', 30);
  const r2 = gainItem(h, keep, 'run1');
  assert.ok(!r2.sold && h.bag.includes(keep) && keep.n === 1 && r2.up > 0, '빈 칸 영웅 장비는 남고 NEW · 더 좋아요');
  assert.equal(h.runLoot.n, 1); assert.equal(h.runLoot.gold, sellValue(junk));
  assert.equal(h.runLoot.best.id, keep.id, '최고 획득');
  assert.ok(!('n' in h.runLoot.best), '집계 사본엔 NEW 없음');
  assert.ok(goodDrop(keep, r2) && !goodDrop(make('uncommon', 'cape'), {}), '좋은 드롭만 카드');
  gainItem(h, make('rare', 'armor'), 'run2');
  assert.equal(h.runLoot.id, 'run2'); assert.equal(h.runLoot.n, 0, '새 도전이면 집계 새로');
  h.autoEquip = true;
  const up = make('rare', 'trinket', 20);
  const r3 = gainItem(h, up, 'run2');
  assert.ok(r3.equipped && r3.gain === itemPower(up) && h.equip.trinket === up, '자동 장착 알림 값');
}

// 가방이 차면: 잠금 제외 · 기준에 걸리는 것부터 · 특별한 장비는 나중 · 전부 잠겼으면 새 드롭을 판다
{
  const h = hero();
  h.equip.weapon = make('legend', 'weapon', 100);
  h.autoSell.upto = 'off';
  for (let i = 0; i < BAG_SIZE; i++) h.bag.push(make('epic', 'weapon', 50, { lock: 1 }));
  h.bag[3].lock = 0; h.bag[3].set = 's';       // 잠기지 않은 세트 조각
  h.bag[7].lock = 0;                            // 잠기지 않은 평범한 영웅
  h.bag.push(make('rare', 'weapon', 1));
  const victim = h.bag[7];
  // 평범한 영웅(특별하지 않음) vs 희귀(더 낮음) — 둘 다 기준 밖: 특별하지 않은 것 중 낮은 등급
  assert.equal(h.bag[trashIdx(h)].rarity, 'rare');
  h.bag.pop();
  h.autoSell.weaker = true;                     // 이제 평범한 영웅이 기준(더 약함)에 걸린다
  h.bag.push(make('common', 'helm', 1));         // 빈 칸 머리 = 더 좋음 → 기준 밖
  assert.equal(trimBag(h), victim, '기준에 걸리는 것부터');
  assert.equal(h.bag.length, BAG_SIZE);
  for (const it of h.bag) it.lock = 1;
  const nw = make('uncommon', 'cape', 1);
  const r = gainItem(h, nw, 'r');
  assert.ok(r.sold && !h.bag.includes(nw) && h.bag.length === BAG_SIZE, '전부 잠기면 새 드롭을 판다');
  assert.equal(sellItem(h, h.bag[0].id), null, '잠금은 개별 판매도 안 됨');
  const n0 = h.bag.length; sellItemsByRarity(h, 'epic');
  assert.equal(h.bag.length, n0, '등급 일괄 판매도 잠금 제외');
}

// 일괄 정리 미리 보기
{
  const h = hero();
  h.equip.helm = make('legend', 'helm', 100);
  const a = make('common', 'helm', 1), b = make('rare', 'helm', 1), c = make('epic', 'helm', 1), d = make('common', 'cape', 1);
  h.bag.push(a, b, c, d, { ...make('common', 'helm', 1), lock: 1 });
  const p = cleanPreview(h);
  assert.deepEqual(p.items.map(x => x.id), [a.id, b.id], '희귀 이하 · 빈 칸(망토)·잠금·영웅 제외');
  assert.equal(p.gold, sellValue(a) + sellValue(b));
}

// 저장: 잠금 · NEW · 설정 · 집계 라운드트립, 옛 저장은 기본값 + 1회 묻기
{
  const h = hero();
  const it = make('rare', 'cape', 9, { lock: 1, n: 1 });
  h.bag.push(it);
  h.autoSell = { upto: 'epic', weaker: true, keep: false, asked: true };
  h.runLoot = { id: 'abc', n: 3, gold: 42, best: it };
  const back = normalize({ hero: JSON.parse(JSON.stringify(h)) }).hero;
  assert.equal(back.bag[0].lock, 1); assert.equal(back.bag[0].n, 1);
  assert.deepEqual(back.autoSell, h.autoSell);
  assert.equal(back.runLoot.best.id, it.id); assert.equal(back.runLoot.gold, 42);
  const old = normalize({ hero: { cls: 'knight', bag: [] } }).hero;
  assert.deepEqual(old.autoSell, { upto: 'rare', weaker: false, keep: true, asked: false });
  assert.deepEqual(normAutoSell({ upto: 'bogus', weaker: 1 }), { upto: 'rare', weaker: false, keep: true, asked: false });
}

// 통합: 빈 칸(자동 장착 끔)이어도 '지금보다 좋음' 보호는 그 부위 가방 최고 하나만 — 하위 장비가 쌓이지 않게
{
  const h = hero();
  const good = make('rare', 'trinket', 60), low = make('common', 'trinket', 1);
  assert.ok(itemPower(good, 'knight') > itemPower(low, 'knight'));
  h.bag.push(good);
  const r = gainItem(h, low, 'x');
  assert.equal(r.sold, true, '가방에 더 좋은 같은 부위가 있으면 일반은 팔린다');
  assert.equal(autoSells(h, good), false, '그 부위 최고 후보는 남는다');
  assert.deepEqual(h.bag.map(i => i.id), [good.id]);
}

// 플레이 테스트 수정(v0.1.7): 자동 장착이 켜진 세트를 깨지 않는다 · 잠근 장착 장비는 고정 · 밀려난 하위 장비는 바로 판매
// · 가방 정리는 약한 중복 고유 → 약한 전설 순, 세트 조각은 나중 · 잠금으로 꽉 찬 가방은 상자를 막는다 · 반경 효과는 합하지 않는다
{
  const h = hero(); h.autoEquip = true;
  h.equip.weapon = make('epic', 'weapon', 40, { set: 'storm' }); h.equip.helm = make('epic', 'helm', 40, { set: 'storm' });
  const leg = make('legend', 'helm', 40);
  assert.ok(itemPower(leg, 'knight') > itemPower(h.equip.helm, 'knight') && itemPower(leg, 'knight') < itemPower(h.equip.helm, 'knight') * SET_BREAK);
  h.bag.push(leg);
  autoEquipAll(h);
  assert.equal(setCounts(h).storm, 2, '켜진 2세트 조각은 SET_BREAK배 안쪽 전설에 밀리지 않는다');
  const big = make('legend', 'helm', 40); big.main.value = itemPower(h.equip.helm, 'knight'); // 확실히 2배 넘게
  assert.ok(itemPower(big, 'knight') > itemPower(h.equip.helm, 'knight') * SET_BREAK);
  h.bag.push(big); autoEquipAll(h);
  assert.equal(h.equip.helm, big, '2배 넘으면 바꾼다');
  h.equip.armor = make('common', 'armor', 1, { lock: 1 }); h.bag.push(make('rare', 'armor', 60));
  autoEquipAll(h);
  assert.equal(h.equip.armor.rarity, 'common', '잠근 장착 장비는 고정');
  // 밀려난 일반 장비는 가방에 남지 않는다
  const h2 = hero(); h2.autoEquip = true;
  h2.equip.cape = make('common', 'cape', 1);
  const r = gainItem(h2, make('rare', 'cape', 30), 'x');
  assert.ok(r.equipped && r.n === 1 && r.gold > 0 && h2.bag.length === 0, '밀려난 하위 장비 자동 판매');
}
{
  const h = hero();
  h.equip.weapon = make('legend', 'weapon', 90, { unique: 'warHorn' });
  for (let i = 0; i < BAG_SIZE - 2; i++) h.bag.push(make('epic', 'weapon', 30, { set: 'frost', lock: i > 0 ? 1 : 0 }));
  const dup = make('legend', 'weapon', 10, { unique: 'warHorn' }), weakLeg = make('legend', 'weapon', 20, { unique: 'luckyCoin' });
  h.bag.push(dup, weakLeg);
  const setIn = make('epic', 'weapon', 30, { set: 'storm' });
  let r = gainItem(h, setIn, 'x');
  assert.ok(!h.bag.includes(dup) && h.bag.includes(setIn) && !r.sold, '약한 중복 고유 전설이 세트 조각보다 먼저 정리');
  r = gainItem(h, make('epic', 'weapon', 30, { set: 'storm' }), 'x');
  assert.ok(!h.bag.includes(weakLeg) && !r.sold, '장착보다 약한 전설도 세트 조각보다 먼저');
  // 남은 건 잠금 + 세트 조각 1개(잠금 안 함) — 다음 특별한 드롭이 가장 약하면 팔리지만 lost로 카드는 뜬다
  const weakest = make('legend', 'weapon', 1, { unique: 'luckyCoin' });
  r = gainItem(h, weakest, 'x');
  assert.ok(r.sold && r.lost, '가방이 가득 차 팔린 특별한 드롭 = lost(획득 카드)');
}
{
  const meta = normalize({ v: 3, best: 40 }); meta.gems = 1000; meta.hero.cls = 'knight';
  for (let i = 0; i < BAG_SIZE; i++) meta.hero.bag.push(make('common', 'cape', 1, { lock: 1 }));
  assert.equal(openBox(meta, 'legend'), false, '잠금으로 꽉 찬 가방이면 상자를 열지 않는다');
  assert.equal(meta.gems, 1000, '보석도 그대로');
}
{
  const h = newHero(); h.cls = 'sorcerer';
  h.equip.weapon = make('legend', 'weapon', 40, { unique: 'frostCrown' });
  for (const s of ['helm', 'armor', 'trinket', 'cape']) h.equip[s] = make('epic', s, 40, { set: 'frost' });
  assert.equal(heroTb(h, 'sorcerer').chillAura, 140, '냉기 오라 반경은 가장 큰 것(합 260이 아님)');
}

console.log('loot.test OK');

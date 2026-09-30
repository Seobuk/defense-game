// 4차 리뷰·플레이테스트 수정 회귀 테스트: node test/fix4.test.js
// 따라잡기 카드 · 카드 '전 → 후'(card.from) · 망각 카운트다운 · 옛 융합 legacy 정리 · 지역 사거리 전역(REACH) · 상자 장착 먼저 · 왕관이 잃을 스킬 · 공명 캐시
import assert from 'node:assert/strict';
import { DT, REACH, FRONT_Y, PICK_AUTO_T, SPELL_MAX_LV } from '../public/js/config.js';
import { createGame, step, act, reofferPick, refreshFusion, tickPick, CATCHUP_FROM } from '../public/js/sim.js';
import { weakestSkill, resonant } from '../public/js/relics.js';
import { upgradeLines } from '../public/js/mutui.js';
import { defaults } from '../public/js/save.js';
import { openBox } from '../public/js/shop.js';
import { BAG_SIZE, rollItem, itemPower } from '../public/js/hero.js';

const game = (o = {}) => createGame({ stage: o.stage ?? 5, seed: o.seed ?? 7, players: [{ kind: 'human', ...(o.p0 || {}) }, {}], run: { spells: o.spells || {}, relics: o.relics || [], ...(o.run || {}) } });
const offer = g => { reofferPick(g, { starter: false }); return g.pick.cards.filter(c => c.spell && !c.mutate); };

// 카드 from · 따라잡기(CATCHUP_FROM층 뒤 Lv3 미만 기본 스킬 +1) · 쌍둥이 달
for (const c of offer(game({ stage: 12, spells: { fireball: 3, gale: 1 } }))) assert.equal(c.level, Math.min(SPELL_MAX_LV, c.from + 1), `12층 ${c.spell}`);
for (const c of offer(game({ stage: CATCHUP_FROM + 1, spells: { fireball: 3, gale: 1 } })))
  assert.equal(c.level, c.from + (c.from < 3 ? 2 : 1), `${CATCHUP_FROM + 1}층 따라잡기 ${c.spell} ${c.from}→${c.level}`), assert.equal(c.catchUp, c.from < 3);
for (const c of offer(game({ stage: 12, spells: { fireball: 3, tornado: 2 }, relics: ['twinMoon'] }))) assert.equal(c.level, Math.min(SPELL_MAX_LV, c.from + 2), '쌍둥이 달');
// 수치 줄은 지금 레벨 → 카드 레벨(쌍둥이 달 Lv3→5 = 마력 240% → 400%), 새 스킬(from 0)은 줄 없음
assert.match(upgradeLines('fireball', 5, 3)[0], /240%.*400%/);
assert.deepEqual(upgradeLines('fireball', 2, 0), []);

// 망각 뒤 새 카드 = 자동 선택 카운트다운도 처음부터(새로고침과 같게)
{
  const g = game({ stage: 12, spells: { fireball: 3, tornado: 2, gale: 1 }, p0: { autoPick: true } });
  reofferPick(g, { starter: false });
  tickPick(g, PICK_AUTO_T * 0.6); // 카운트다운 도중(PICK_AUTO_T가 0.3초로 짧아져도)
  assert.ok(act(g, 0, { type: 'forget', spell: 'gale' }));
  assert.equal(g.pick.autoLeft, PICK_AUTO_T);
}
// 옛 도전(v2) 융합을 비우면 legacy에서 빠져, 다시 만든 융합은 재료 만렙으로 발동
{
  const g = game({ stage: 12, spells: { plasma: 3, gale: 1 }, run: { fusionParts: { plasma: ['fireball', 'lightningStrike'] }, legacy: ['plasma'] } });
  assert.equal(g.book.fireball, 1);
  g.pick = { cards: [], autoLeft: null, starter: false };
  assert.ok(act(g, 0, { type: 'forget', spell: 'plasma' }));
  g.pick = null;
  g.spells.fireball = 6; g.spells.lightningStrike = 6; refreshFusion(g);
  assert.ok(g.spells.plasma);
  assert.deepEqual(g.run.legacy, []);
  assert.equal(g.book.fireball, SPELL_MAX_LV);
}
// 동굴 어둠(전역 REACH.y)이 다음 판 층 시작(카드가 떠 step이 멈춘 동안)까지 남지 않는다
{
  const c = game({ stage: 25, spells: { fireball: 1 } });
  step(c, DT);
  assert.ok(REACH.y > FRONT_Y);
  game({ stage: 1 });
  assert.equal(REACH.y, FRONT_Y);
}
// 광기의 왕관이 잃을 스킬 = 낮은 레벨 기본 스킬(같으면 먼저 배운 것), 융합은 뒤
assert.equal(weakestSkill(game({ spells: { plasma: 1, iceLance: 2, frostWard: 1, chainLightning: 1 }, run: { fusionParts: { plasma: ['fireball', 'lightningStrike'] } } })), 'frostWard');
// 원소 공명 캐시: 스킬이 바뀌면(refreshFusion) 다시 센다
{
  const g = game({ spells: { fireball: 1, iceLance: 1 } });
  assert.deepEqual(resonant(g), []);
  g.spells.flameBullet = 1; refreshFusion(g);
  assert.deepEqual(resonant(g), ['fire']);
}
// 장비 상자: 가방이 가득 차도 더 좋은 새 장비는 먼저 장착되고, 팔리는 건 가장 약한 것
{
  const m = defaults(); m.best = 80; m.gems = 1e6; m.hero.cls = 'knight'; m.hero.autoEquip = true;
  let s = 3; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (const slot of Object.keys(m.hero.equip)) { let it; do it = rollItem(5, 'normal', rng, 'knight'); while (it.slot !== slot); m.hero.equip[slot] = it; }
  while (m.hero.bag.length < BAG_SIZE) m.hero.bag.push(rollItem(5, 'normal', rng, 'knight'));
  let upgrades = 0;
  for (let k = 0; k < 20; k++) {
    const before = { ...m.hero.equip }, r = openBox(m, 'fine', rng);
    assert.ok(r && m.hero.bag.length <= BAG_SIZE);
    if (itemPower(r.item) > itemPower(before[r.item.slot])) { upgrades++; assert.ok(r.equipped && r.soldItem !== r.item, '더 좋은 상자 장비가 팔렸다'); }
  }
  assert.ok(upgrades > 0);
}
console.log('fix4.test OK');

// v0.1.2 보석 충전 스토어 셀프 체크: node test/gemstore.test.js
// 상품 데이터 형식 · requestPurchase는 저장을 절대 바꾸지 않고 네트워크도 부르지 않는다(결제 미연결)
import assert from 'node:assert/strict';
import { GEM_PRODUCTS, PRODUCT_BY_ID, requestPurchase, setPurchaseHandler, totalGems, wonText } from '../public/js/gemstore.js';
import { defaults } from '../public/js/save.js';

let n = 0;
const ok = (name, fn) => { fn(); n++; console.log('  ✓ ' + name); };

console.log('보석 충전 스토어');
ok('상품: 보석 팩 6단계(보석·가격 오름차순) + 월정액 1 + 초보자 패키지(1회 한정) 1 · 원화 ₩1,200~₩99,000', () => {
  const packs = GEM_PRODUCTS.filter(p => p.kind === 'pack');
  assert.equal(packs.length, 6);
  for (let i = 1; i < packs.length; i++) { assert.ok(packs[i].gems > packs[i - 1].gems); assert.ok(packs[i].price > packs[i - 1].price); }
  assert.equal(GEM_PRODUCTS.filter(p => p.kind === 'pass' && p.daily > 0 && p.days > 0).length, 1);
  assert.equal(GEM_PRODUCTS.filter(p => p.kind === 'starter' && p.limit === 'once').length, 1);
  assert.equal(new Set(GEM_PRODUCTS.map(p => p.id)).size, GEM_PRODUCTS.length);
  for (const p of GEM_PRODUCTS) {
    assert.ok(Number.isInteger(p.price) && p.price >= 1200 && p.price <= 99000, p.id);
    assert.ok(Number.isInteger(p.gems) && Number.isInteger(p.bonus) && p.bonus >= 0, p.id);
    assert.equal(PRODUCT_BY_ID[p.id], p);
  }
  assert.equal(totalGems(PRODUCT_BY_ID.pass_moon), 300 + 90 * 30);
  assert.equal(wonText(99000), '₩99,000');
});

ok('requestPurchase: 모든 상품 · 없는 id 모두 저장 그대로 · 보석 지급 없음 · 네트워크 호출 0 · 준비 중 시트만', () => {
  const net = [];
  const trap = name => function () { net.push(name); throw new Error('network: ' + name); };
  const saved = {};
  for (const k of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource']) { saved[k] = globalThis[k]; globalThis[k] = trap(k); }
  const store = {};
  const ls = globalThis.localStorage;
  globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k) => net.push('localStorage.setItem ' + k), removeItem: k => net.push('localStorage.removeItem ' + k) };
  try {
    const meta = defaults();
    meta.gems = 123;
    const before = JSON.stringify(meta);
    const opened = [];
    setPurchaseHandler(p => opened.push(p.id));
    for (const p of GEM_PRODUCTS) {
      const r = requestPurchase(p.id);
      assert.equal(r.ok, false);
      assert.equal(r.pending, true);
      assert.equal(r.product, p);
    }
    const bad = requestPurchase('nope');
    assert.equal(bad.ok, false);
    assert.ok(!bad.pending);
    requestPurchase(undefined); requestPurchase({ id: 'gems_60' }); requestPurchase('__proto__');
    assert.deepEqual(opened, GEM_PRODUCTS.map(p => p.id)); // 상품마다 시트 한 번, 없는 상품은 안 염
    assert.equal(JSON.stringify(meta), before);
    assert.equal(meta.gems, 123);
    assert.deepEqual(net, []);
    setPurchaseHandler(() => { throw new Error('ui'); }); // 시트가 터져도 구매 결과는 같다
    assert.equal(requestPurchase('starter').pending, true);
  } finally {
    setPurchaseHandler(null);
    for (const k in saved) globalThis[k] = saved[k];
    globalThis.localStorage = ls;
  }
});

console.log(`gemstore: ${n} ok`);

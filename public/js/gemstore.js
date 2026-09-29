// v0.1.2 보석 충전 스토어 — 상품 데이터 + 구매 진입점 하나. DOM 없음 · 네트워크 없음 · 결제 없음 · 보석 지급 없음.
// PG(포트원·토스페이먼츠 · 카카오페이·네이버페이)를 붙일 때는 requestPurchase 한 곳만 바꾼다:
//   결제창 → 서버 영수증 검증 → 서버가 지급 → 앱은 저장을 다시 받는다(클라이언트가 스스로 보석을 더하지 않는다).
// 화면은 gemstoreui.js. docs/DESIGN.md 'v0.1.2 보석 충전 스토어'

// kind: 'pack'(보석 팩) · 'pass'(월정액 — 즉시 gems + 매일 daily × days) · 'starter'(초보자 패키지)
// limit: null(반복) · 'once'(계정당 1회) · 'monthly'(30일마다) · first2x: 첫 구매 보석 2배 대상(보너스 대신 기본 보석 ×2)
// price: 원화 정수(VAT 포함 표시가). tag: 카드 띠('인기' · '최고 가치').
export const GEM_PRODUCTS = [
  { id: 'gems_60', kind: 'pack', gems: 60, bonus: 0, price: 1200, limit: null, first2x: true },
  { id: 'gems_300', kind: 'pack', gems: 300, bonus: 30, price: 5900, limit: null, first2x: true },
  { id: 'gems_980', kind: 'pack', gems: 980, bonus: 110, price: 19000, limit: null, first2x: true, tag: '인기' },
  { id: 'gems_1980', kind: 'pack', gems: 1980, bonus: 260, price: 39000, limit: null, first2x: true },
  { id: 'gems_3280', kind: 'pack', gems: 3280, bonus: 600, price: 65000, limit: null, first2x: true },
  { id: 'gems_6480', kind: 'pack', gems: 6480, bonus: 1600, price: 99000, limit: null, first2x: true, tag: '최고 가치' },
  { id: 'pass_moon', kind: 'pass', name: '달빛 계약', gems: 300, bonus: 0, daily: 90, days: 30, price: 5900, limit: 'monthly', first2x: false },
  { id: 'starter', kind: 'starter', name: '초보 마법사 패키지', gems: 680, bonus: 0, tickets: 10, price: 3300, limit: 'once', first2x: false },
];
export const PRODUCT_BY_ID = Object.fromEntries(GEM_PRODUCTS.map(p => [p.id, p]));

// 받는 보석 합계(월정액은 30일 전부) — 카드 문구용
export const totalGems = p => p.gems + p.bonus + (p.daily || 0) * (p.days || 0);
export const wonText = n => '₩' + Math.round(n).toLocaleString('ko-KR');

let onPending = null;
// UI가 '결제 준비 중' 시트를 여는 함수를 건다(gemstoreui.js)
export const setPurchaseHandler = fn => { onPending = typeof fn === 'function' ? fn : null; };

// 구매 진입점(유일). 지금은 결제가 없다 → 준비 중 시트만 연다. 저장·보석·네트워크를 건드리지 않는다.
export function requestPurchase(productId) {
  const product = Object.hasOwn(PRODUCT_BY_ID, productId) ? PRODUCT_BY_ID[productId] : null; // '__proto__' 같은 키 막기
  if (!product) return { ok: false, error: '없는 상품이에요' };
  try { onPending?.(product); } catch { /* 시트 오류는 구매와 무관 */ }
  return { ok: false, pending: true, product }; // ponytail: 결제 미연결 — PG 연동 시 여기서 결제창 → 서버 검증 → 서버 지급
}

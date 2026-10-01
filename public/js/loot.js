// 전리품 정책(DOM 없음) — 하위 장비 자동 판매 · 가방 정리 · NEW · 이번 도전 최고 획득. docs/DESIGN.md 'v0.1.7 전리품 · 자동 판매' 절
// hero.js lootDrop · trimBag이 부른다(순환 import — 이 파일은 최상위에서 hero.js 값을 쓰지 않는다)
import { itemPower, sellValue, autoEquipAll, trimBag, BAG_SIZE } from './hero.js';

const RANK = ['common', 'uncommon', 'rare', 'epic', 'legend'];
const rank = r => RANK.indexOf(r);

// 등급 기준: 이 등급 '이하'를 자동 판매(off = 등급 기준 끔)
export const AUTO_SELL_UPTO = ['off', 'common', 'rare', 'epic'];
export const AUTO_SELL_NAME = { off: '끄기', common: '일반', rare: '희귀 이하', epic: '영웅 이하' };
// upto 등급 기준 · weaker '장착 중인 것보다 약하면' · keep 전설·세트·고유 옵션 보호 · asked 기존 가방 정리 물어봄
export const newAutoSell = () => ({ upto: 'rare', weaker: false, keep: true, asked: false });
export function normAutoSell(v) {
  const d = newAutoSell();
  if (!v || typeof v !== 'object') return d;
  return {
    upto: AUTO_SELL_UPTO.includes(v.upto) ? v.upto : d.upto,
    weaker: typeof v.weaker === 'boolean' ? v.weaker : d.weaker,
    keep: typeof v.keep === 'boolean' ? v.keep : d.keep,
    asked: !!v.asked,
  };
}
export const autoSellCfg = hero => hero.autoSell || (hero.autoSell = newAutoSell()); // 테스트·옛 객체처럼 필드가 없으면 처음 쓸 때 만든다

// 전설 · 세트 조각 · 고유 옵션 = '특별한 장비'(기본으로 절대 자동 처리하지 않는다). 필드는 ITEM 트랙 계약(hero.js)
export const isSpecial = it => !!it && (it.rarity === 'legend' || !!it.set || !!it.unique);

// 이 장비를 자동 판매하나? 잠금 · 장착 중 · 지금보다 좋은 장비(빈 칸 포함)는 기준과 상관없이 절대 아니다
export function autoSells(hero, it, cfg = autoSellCfg(hero)) {
  if (!it || it.lock) return false;
  const eq = hero.equip[it.slot];
  if (eq === it) return false;
  const p = itemPower(it, hero.cls), cur = eq ? itemPower(eq, hero.cls) : -1; // 지금 클래스 기준(items.js — 다른 클래스 전용 고유는 0)
  // 통합 v0.1.7: '지금보다 좋음' 보호는 그 부위 가방 후보 중 최고 하나만(자동 장착을 끈 빈 칸이면 일반 부적까지 전부 쌓이던 것)
  const best = hero.bag.reduce((b, x) => (x.slot === it.slot && (!b || itemPower(x, hero.cls) > itemPower(b, hero.cls)) ? x : b), null);
  if (p > cur && (best === it || !hero.bag.includes(it))) return false;
  if (cfg.keep && isSpecial(it)) return false;
  return (cfg.upto !== 'off' && rank(it.rarity) <= rank(cfg.upto)) || (cfg.weaker && p < cur);
}

// 일괄 정리 미리 보기: 지금 기준으로 팔릴 가방 장비
export function cleanPreview(hero) {
  const items = hero.bag.filter(it => autoSells(hero, it));
  return { items, gold: items.reduce((s, it) => s + sellValue(it), 0) };
}

const lexLess = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };
// 버려도 되는 정도(세트 조각은 늘 0): 장착 중보다 약하면 1, 게다가 같은 고유 옵션을 더 센 장비가(장착·가방) 이미 가졌으면 2
// (플레이 테스트: 가방이 약한 옛 전설·중복 고유로 가득 차 새 세트 조각·영웅 고유가 들어오자마자 팔려 나가던 것)
function spare(hero, it) {
  const P = x => itemPower(x, hero.cls), eq = hero.equip[it.slot];
  if (it.set || !eq || P(it) >= P(eq)) return 0;
  const dup = !!it.unique && [...Object.values(hero.equip), ...hero.bag].some(x => x && x !== it && x.unique === it.unique && P(x) >= P(it));
  return dup ? 2 : 1;
}
// 가방이 넘칠 때 버릴 칸(hero.js trimBag): 잠금 제외 → 기준에 걸리는 것 → 약한 중복 고유 → 특별하지 않은 것 → 장착 중보다 약한 것
// (세트 조각은 여기서 늦게) → 낮은 등급 → 낮은 전투력. 없으면 -1
export function trashIdx(hero) {
  let w = -1, wk = null;
  hero.bag.forEach((it, i) => {
    if (it.lock) return;
    const sp = spare(hero, it);
    const k = [autoSells(hero, it) ? 0 : 1, sp === 2 ? 0 : 1, isSpecial(it) ? 1 : 0, sp ? 0 : 1, rank(it.rarity), itemPower(it, hero.cls)];
    if (w < 0 || lexLess(k, wk)) { w = i; wk = k; }
  });
  return w;
}

const better = (a, b) => !b || rank(a.rarity) > rank(b.rarity) || (rank(a.rarity) === rank(b.rarity) && itemPower(a) > itemPower(b)); // 도전 최고 획득(클래스 무관 — 결과 카드용)
// 이번 도전 전리품 집계(영구 hero에 둔다 — 판매는 되돌릴 수 없어 이어하기 체크포인트와 무관, 도전 id가 바뀌면 새로)
export function runLoot(hero, id) {
  if (!hero.runLoot || hero.runLoot.id !== id) hero.runLoot = { id, n: 0, gold: 0, best: null };
  return hero.runLoot;
}

// 드롭 하나를 얻는다(hero.js lootDrop): NEW 표시 → 자동 장착 → 자동 판매 → 넘치면 정리 → 도전 집계
// → { sold: 자동 판매됐나, lost: 그게 가방이 가득 차 팔린 특별한 장비인가, gold: 판매 골드 합(넘침 정리 포함), n: 판매 개수, equipped, gain: 장착 전투력 증가, up: 장착 안 했지만 더 좋음 }
export function gainItem(hero, item, runId) {
  const P = it => itemPower(it, hero.cls);
  const before = P(hero.equip[item.slot]);
  item.n = 1;
  hero.bag.push(item);
  let sold = false, gold = 0, n = 0;
  const sell = it => { hero.bag.splice(hero.bag.indexOf(it), 1); gold += sellValue(it); n++; };
  if (hero.autoEquip) {
    const old = { ...hero.equip };
    autoEquipAll(hero);
    for (const s in old) if (old[s] && hero.equip[s] !== old[s] && autoSells(hero, old[s])) sell(old[s]); // 밀려난 하위 장비도 기준대로 바로 판매(가방에 쌓이지 않게)
  }
  const equipped = hero.equip[item.slot] === item;
  if (equipped) delete item.n; // 바로 낀 장비는 NEW 대신 '자동 장착' 알림
  if (!equipped && autoSells(hero, item)) { sell(item); sold = true; }
  const over = trimBag(hero);
  if (over) { gold += sellValue(over); n++; if (over === item) sold = true; }
  const lost = over === item && isSpecial(item); // 가방이 (잠금·더 나은 특별한 장비로) 가득 차 특별한 드롭이 팔림 → 그래도 획득 카드는 띄운다(lootDrop)
  const L = runLoot(hero, runId);
  L.n += n; L.gold += gold;
  if (!sold && better(item, L.best)) { L.best = JSON.parse(JSON.stringify(item)); delete L.best.n; }
  const eq = hero.equip[item.slot];
  return { sold, lost, gold, n, equipped, gain: equipped ? P(item) - before : 0, up: !sold && !equipped && P(item) > P(eq) ? P(item) - P(eq) : 0 };
}

// 좋은 드롭(획득 카드를 띄울 것): 영웅 이상 · 특별한 장비 · 희귀 이상인데 장착했거나 더 좋음
export const goodDrop = (it, r = {}) => !!it && (rank(it.rarity) >= 3 || isSpecial(it) || (rank(it.rarity) >= 2 && (r.equipped || r.up > 0)));

// 가방이 잠근 장비로만 가득 참 — 상자를 열면 산 장비가 바로 팔리므로 상점이 막는다(shop.js openBox · shopui 안내)
export const bagJammed = hero => hero.bag.length >= BAG_SIZE && hero.bag.every(it => it.lock);

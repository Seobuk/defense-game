// 재화 사용처(경제 싱크) — 수련 돌파 · 장비 상자 · 출정 준비 · 보석 돌파 · 유물 해금 · 방치 골드. DOM 없음, meta를 제자리에서 바꾼다.
// 원칙: 스킬 선택이 주력이다 — 돌파는 끝이 없지만 효과가 체감(점근)하고, 출정 준비는 이번 도전 한 번만. docs/DESIGN.md '4차 — 경제 싱크'
import { TRAIN_KEYS, trainMax, trainCost, metaMax, metaCost, MAX_STAGE } from './config.js';
import { rollItem, trimBag, sellValue, autoEquipAll } from './hero.js';
import { toInt } from './util.js';
import { bagJammed } from './loot.js'; // v0.1.7 가방이 잠근 장비로만 가득 차면 상자를 열지 않는다
import { lockedRelics, relicUnlockCost, unlockRelic } from './relics.js'; // 유물 해금 API(유물 트랙)

const BREAK_CAP = 999; // 돌파 단계 저장 상한(비용이 먼저 천문학적이 된다)

// 가격 기준 = 최고 층에서 한 번 도전하면 버는 골드 정도(캠페인 실측: 15층 ≈ 1.8K · 59층 ≈ 20K · 100층 ≈ 90K)
export const priceScale = best => 6 * Math.max(10, toInt(best, 0, MAX_STAGE)) ** 2;
const round = v => (v < 1000 ? Math.ceil(v / 10) * 10 : Math.ceil(v / 100) * 100);

// ── 돌파(끝없음, 체감) — n단 누적 효과 = per × 5 × (1 − 0.9^n): 1단 = 원래 1레벨의 절반, 끝까지 가도 원래 5레벨어치 ──
export const breakBonus = (per, n) => per * 5 * (1 - 0.9 ** Math.max(0, n | 0));

// 수련 돌파(골드): 수련 만렙 뒤 상한을 올린다. 비용 = 마지막 수련 비용 × 1.3^(n+1)
export const TRAIN_BREAK = { atk: 0.04, rate: 0.03, crit: 0.015, multi: 0.04, wall: 0.05 }; // per = 수련 1레벨 효과(MAGE_TRAINING과 같은 값)
export const trainBreakOpen = (meta, key) => (meta.training?.[key] | 0) >= trainMax(key);
export const trainBreakCost = (key, n) => Math.ceil(trainCost(key, trainMax(key) - 1) * 1.3 ** ((n | 0) + 1));
export function trainBreakText(key, n) {
  const v = Math.round(breakBonus(TRAIN_BREAK[key], n) * 1000) / 10;
  return { atk: `피해 +${v}%`, rate: `시전 속도 +${v}%`, crit: `치명타 +${v}%p`, multi: `연속 시전 +${v}%p`, wall: `내구력 +${v}%` }[key] || '';
}

// 보석 돌파: 보석 강화 만렙 뒤 편의 보너스(끝없음). 비용 = 마지막 강화 비용 × 1.25^(n+1)
export const GEM_BREAK = [
  { key: 'greed', name: '황금 손길', desc: '처치 골드 추가 증가', per: 0.05 },
  { key: 'pickaxe', name: '심층 채굴', desc: '방치 보상(보석·골드·경험치) 추가 증가', per: 0.15 },
];
const GEM_BREAK_KEYS = GEM_BREAK.map(b => b.key);
export const gemBreakOpen = (meta, key) => (meta.metaLv?.[key] | 0) >= metaMax(key);
export const gemBreakCost = (key, n) => Math.ceil(metaCost(key, metaMax(key) - 1) * 1.25 ** ((n | 0) + 1));
export const gemBreakText = (key, n) => `+${Math.round(breakBonus(GEM_BREAK.find(b => b.key === key).per, n) * 1000) / 10}%`;

// 런 보너스(sim.js computeFx가 곱한다): 수련 돌파 + 보석 돌파 '황금 손길'
export function runBonus(meta) {
  const t = meta?.trainBreak || {}, b = k => breakBonus(TRAIN_BREAK[k], t[k]);
  return {
    atkMul: 1 + b('atk'), rateMul: 1 + b('rate'), wallMul: 1 + b('wall'), critAdd: b('crit'), echoAdd: b('multi'),
    goldMul: 1 + breakBonus(0.05, meta?.gemBreak?.greed),
  };
}

// sim computeFx 끝에서(유물 다음): 런 배율 f에 runBonus를 곱한다. echo·critAdd는 config cannonStats가 읽는다
export function applyShopBonus(f, b) {
  if (!b) return f;
  f.atkMul *= b.atkMul || 1; f.rateMul *= b.rateMul || 1; f.wallMul *= b.wallMul || 1; f.goldMul *= b.goldMul || 1;
  f.echo = (f.echo || 0) + (b.echoAdd || 0); f.critAdd = (f.critAdd || 0) + (b.critAdd || 0);
  return f;
}

// ── 출정 준비(골드, 이번 도전 한 번) — 정비에서 사 두면 newRun이 run.prep으로 옮기고 meta.prep을 비운다 ──
export const PREP = [
  { key: 'card', short: '시작 카드 +1장', name: '비전 두루마리', desc: '도전 시작 카드 +1장', k: 0.08, tone: 'p' },
  { key: 'rare', short: '1층 희귀·전설 ×3', name: '행운의 부적', desc: '1층 카드의 희귀·전설 확률 ×3', k: 0.04, tone: 'y' },
  { key: 'ward', short: '보스 층 부활 1회', name: '보스 결계석', desc: '네임드 보스 층에서 성벽이 무너지면 1회 50%로 회복', k: 0.07, tone: 'g' },
  { key: 'forget', short: '망각 +1회', name: '망각의 물약', desc: '이번 도전 망각(스킬 비우기) +1회', k: 0.06, tone: 'b' },
];
export const PREP_KEYS = PREP.map(p => p.key);
export const PREP_RARE_MUL = 3;
export const prepCost = (key, best) => round(PREP.find(p => p.key === key).k * priceScale(best));
export const normPrep = v => Object.fromEntries(PREP_KEYS.map(k => [k, !!(v && typeof v === 'object' && v[k])]));
// 도전 중 prep: 산 것 + 보스 결계 사용 여부(체크포인트에 저장)
export const normRunPrep = v => ({ ...normPrep(v), wardUsed: !!(v && v.wardUsed) });
export const prepWardReady = (g, bossFloor) => !!(bossFloor && g.run.prep?.ward && !g.run.prep.wardUsed);
// 출정 준비를 이번 도전으로 넘긴다(meta.prep → run.prep)
export function takePrep(meta) {
  const p = normPrep(meta.prep);
  meta.prep = normPrep(null);
  return p;
}

// ── 장비 상자 — 드롭과 같은 rollItem(강화 없음). 등급 가중치 [일반, 고급, 희귀, 영웅, 전설] ──
const GEAR_ODDS_0 = [55, 30, 12, 2.6, 0.4], GEAR_ODDS_100 = [5, 20, 40, 27, 8];
export const BOXES = [
  { key: 'gear', name: '장비 상자', cur: 'gold', desc: '최고 층이 높을수록 좋은 등급' },
  { key: 'fine', name: '고급 장비 상자', cur: 'gems', desc: '희귀 이상 확정' },
  { key: 'legend', name: '전설 장비 상자', cur: 'gems', desc: '전설 확정' },
];
export function boxOdds(key, best) {
  if (key === 'fine') return [0, 0, 62, 30, 8];
  if (key === 'legend') return [0, 0, 0, 0, 100];
  const t = toInt(best, 0, MAX_STAGE) / MAX_STAGE;
  return GEAR_ODDS_0.map((a, i) => Math.round((a + (GEAR_ODDS_100[i] - a) * t) * 10) / 10);
}
export const boxCost = (key, best) => (key === 'fine' ? 60 : key === 'legend' ? 300 : round(0.1 * priceScale(best)));
export const boxIlvl = meta => Math.max(1, toInt(meta.best, 0, MAX_STAGE));

// ── 방치 골드(시간당) — 한 시간 플레이의 약 5% ──
export const offlineGoldPerHour = best => Math.floor(12 * (1 + toInt(best, 0, MAX_STAGE)) ** 1.35);
export const offlineMul = meta => 1 + breakBonus(0.15, meta?.gemBreak?.pickaxe);

// ── 저장(save.js normalize가 펼친다) — 없으면 0/false(기존 저장 그대로 불러짐) ──
export function normShop(d) {
  d = d && typeof d === 'object' ? d : {};
  const ints = (src, keys) => Object.fromEntries(keys.map(k => [k, toInt(src && src[k], 0, BREAK_CAP)]));
  return { trainBreak: ints(d.trainBreak, TRAIN_KEYS), gemBreak: ints(d.gemBreak, GEM_BREAK_KEYS), prep: normPrep(d.prep) };
}

// ── 구매(campAct가 부른다) — 성공하면 truthy, 실패(잠김·부족·상한)면 false. 재화는 절대 음수가 되지 않는다 ──
const pay = (meta, cur, cost) => {
  if (!(cost > 0) || !(meta[cur] >= cost)) return false;
  meta[cur] -= cost;
  return true;
};
export function buyTrainBreak(meta, key) {
  if (!TRAIN_KEYS.includes(key) || !trainBreakOpen(meta, key)) return false;
  const n = meta.trainBreak[key] | 0;
  if (n >= BREAK_CAP || !pay(meta, 'gold', trainBreakCost(key, n))) return false;
  meta.trainBreak[key] = n + 1;
  return true;
}
export function buyGemBreak(meta, key) {
  if (!GEM_BREAK_KEYS.includes(key) || !gemBreakOpen(meta, key)) return false;
  const n = meta.gemBreak[key] | 0;
  if (n >= BREAK_CAP || !pay(meta, 'gems', gemBreakCost(key, n))) return false;
  meta.gemBreak[key] = n + 1;
  return true;
}
// 출정 준비: 누르면 사고, 산 것을 다시 누르면 전액 환불(도전 전이라 아직 쓰지 않았다)
export function togglePrep(meta, key) {
  if (!PREP_KEYS.includes(key)) return false;
  const cost = prepCost(key, meta.best);
  if (meta.prep[key]) { meta.prep[key] = false; meta.gold += cost; return true; }
  if (!pay(meta, 'gold', cost)) return false;
  meta.prep[key] = true;
  return true;
}
// 상자 열기 → { item, sold, equipped } | false. 가방이 넘치면 가장 약한 장비를 자동 판매(골드는 바로 meta.gold)
export function openBox(meta, key, rng = Math.random) {
  const box = BOXES.find(b => b.key === key);
  if (!box || bagJammed(meta.hero) || !pay(meta, box.cur, boxCost(key, meta.best))) return false; // 잠금으로 꽉 찬 가방 = 산 장비가 바로 팔린다 → 값을 받기 전에 막는다
  const hero = meta.hero;
  const item = rollItem(boxIlvl(meta), boxOdds(key, meta.best), rng, hero.cls || 'knight');
  item.n = 1; // v0.1.7 가방 NEW 표시(loot.js) — 산 장비는 자동 판매하지 않는다
  hero.bag.push(item);
  if (hero.autoEquip) autoEquipAll(hero); // 먼저 장착(가방이 가득 차도 산 장비가 더 좋으면 끼운다) → 넘친 만큼 정리
  const over = trimBag(hero);
  const sold = over ? sellValue(over) : 0;
  meta.gold += sold;
  return { item, sold, soldItem: over, equipped: Object.values(hero.equip).includes(item) };
}
// 유물 해금(보석) = relics.js unlockRelic(meta, key) — 목록·가격(60~150)·시작 풀은 유물 트랙이 정한다
export { unlockRelic };

// ── 살 수 있는 것(UI 탭 알림 · 하네스 '살 게 없는 방문' 지표) ──
// → [{ id, cur, cost }] — 효과가 있는 것만(만렙·이미 산 것 제외). 상자는 반복 소비처라 늘 포함
export function shopOffers(meta) {
  const out = [], best = meta.best;
  for (const k of TRAIN_KEYS) {
    const lv = meta.training[k] | 0;
    if (lv < trainMax(k)) out.push({ id: `train:${k}`, cur: 'gold', cost: trainCost(k, lv) });
    else out.push({ id: `trainBreak:${k}`, cur: 'gold', cost: trainBreakCost(k, meta.trainBreak[k]) });
  }
  for (const p of PREP) if (!meta.prep[p.key]) out.push({ id: `prep:${p.key}`, cur: 'gold', cost: prepCost(p.key, best) });
  for (const b of BOXES) out.push({ id: `box:${b.key}`, cur: b.cur, cost: boxCost(b.key, best) });
  for (const k of Object.keys(meta.metaLv)) {
    const lv = meta.metaLv[k] | 0;
    if (lv < metaMax(k)) out.push({ id: `meta:${k}`, cur: 'gems', cost: metaCost(k, lv) });
  }
  for (const b of GEM_BREAK) if (gemBreakOpen(meta, b.key)) out.push({ id: `gemBreak:${b.key}`, cur: 'gems', cost: gemBreakCost(b.key, meta.gemBreak[b.key]) });
  for (const k of lockedRelics(meta)) out.push({ id: `relic:${k}`, cur: 'gems', cost: relicUnlockCost(k) });
  return out;
}
export const affordable = (meta, offers) => offers.filter(o => meta[o.cur] >= o.cost);

// ── 테스트·밸런스 러너용 소비 정책(게임 UI는 쓰지 않는다) ──
// phase 'pre' = 출정 준비(수련보다 먼저 — 지갑의 25% 이하인 것) · 'post' = (수련·보석 강화는 bot.js 뒤) 돌파 → 유물 → 상자 1개 · 'all' = 둘 다
// spent = { [분류]: 금액 } 누적(하네스 소비 분포)
export function botShop(meta, rng, spent = {}, phase = 'all') {
  const add = (k, v) => { spent[k] = (spent[k] || 0) + v; };
  if (phase !== 'post') for (const p of PREP) {
    const c = prepCost(p.key, meta.best);
    if (!meta.prep[p.key] && c <= meta.gold * 0.25 && togglePrep(meta, p.key)) add('prep', c);
  }
  if (phase === 'pre') return spent;
  for (let again = true; again;) { // 돌파: 가장 싼 것부터
    again = false;
    const k = TRAIN_KEYS.filter(k => trainBreakOpen(meta, k)).sort((a, b) => trainBreakCost(a, meta.trainBreak[a]) - trainBreakCost(b, meta.trainBreak[b]))[0];
    const c = k && trainBreakCost(k, meta.trainBreak[k]);
    if (k && buyTrainBreak(meta, k)) { add('trainBreak', c); again = true; }
  }
  for (let again = true; again;) {
    again = false;
    for (const b of GEM_BREAK) { const c = gemBreakCost(b.key, meta.gemBreak[b.key]); if (buyGemBreak(meta, b.key)) { add('gemBreak', c); again = true; } }
  }
  for (const k of lockedRelics(meta)) { const c = relicUnlockCost(k); if (unlockRelic(meta, k)) add('relic', c); } // 싼 것부터가 아니라 표 순서(가격 60~150)
  const box = (k, cat) => { const c = boxCost(k, meta.best), r = openBox(meta, k, rng); if (r) { add(cat, c); add('sold', r.sold); } return r; };
  if (meta.gold >= boxCost('gear', meta.best)) box('gear', 'boxGold');
  const metaLeft = Object.keys(meta.metaLv).some(k => (meta.metaLv[k] | 0) < metaMax(k));
  for (const k of ['legend', 'fine']) if (!metaLeft && meta.gems >= boxCost(k, meta.best)) box(k, 'boxGems'); // 보석 상자는 보석 강화를 다 찍은 뒤
  return spent;
}

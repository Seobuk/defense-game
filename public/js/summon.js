// v0.1.2 외형 소환(가챠) 코어 — DOM·네트워크·결제 없음. 외형은 전투력 0(sim에 들어가지 않음)
// 저장: meta.summon(normSummon) · 계약: docs/DESIGN.md '### v0.1.2 외형 소환 계약 > 코어 · 저장'
import { toInt } from './util.js';
import { RARITIES, HERO_CLASS_KEYS } from './hero.js';
import { CODEX_SYN, codexFound, MAX_STAGE } from './config.js';
import { BOSSES, bossOf } from './stages.js';

// ── 카탈로그(키 = art/cosmetics.js 그림 id) ──
const C = (key, slot, rarity, name, desc, cls) => ({ key, slot, rarity, name, desc, ...(cls ? { cls } : {}) });
export const COSMETICS = [
  // 영웅 코스튬 — 클래스별 일반·희귀·영웅·전설
  C('kn_crimson', 'costume', 'common', '진홍 기사', '붉은 망토를 두른 왕국 기사단의 정복.', 'knight'),
  C('kn_jade', 'costume', 'rare', '비취 수호자', '비취빛 판금에 새긴 수호의 문장.', 'knight'),
  C('kn_obsidian', 'costume', 'epic', '흑요 기사', '흑요석을 벼린 갑주, 틈마다 용암빛이 새어 나온다.', 'knight'),
  C('kn_solar', 'costume', 'legend', '태양왕', '태양 왕관과 빛의 날개 — 걸음마다 금빛 오라가 번진다.', 'knight'),
  C('rg_autumn', 'costume', 'common', '단풍 사냥꾼', '가을 숲 사냥꾼의 가죽옷.', 'ranger'),
  C('rg_snow', 'costume', 'rare', '설원 추적자', '흰 털망토로 눈보라 속에 숨는 추적자.', 'ranger'),
  C('rg_raven', 'costume', 'epic', '밤까마귀', '검은 깃털 외투, 어깨 위의 까마귀가 과녁을 노린다.', 'ranger'),
  C('rg_sylvan', 'costume', 'legend', '세계수의 사수', '세계수 잎 관과 정령의 활 — 등 뒤에 푸른 잎이 흩날린다.', 'ranger'),
  C('so_azure', 'costume', 'common', '청옥 견습생', '마탑 견습생의 푸른 법복.', 'sorcerer'),
  C('so_pumpkin', 'costume', 'rare', '호박 마녀', '호박등 모자와 주황 망토의 장난꾸러기 마녀.', 'sorcerer'),
  C('so_nebula', 'costume', 'epic', '성운 점성술사', '성운이 흐르는 로브, 소매에서 별가루가 떨어진다.', 'sorcerer'),
  C('so_phoenix', 'costume', 'legend', '불사조 현자', '불사조 깃 장식과 불꽃 날개 — 재에서 다시 타오른다.', 'sorcerer'),
  C('cl_rose', 'costume', 'common', '장미 수녀', '장미 자수를 놓은 수녀복.', 'cleric'),
  C('cl_tide', 'costume', 'rare', '파도 사제', '바다 신전의 물빛 제의.', 'cleric'),
  C('cl_eclipse', 'costume', 'epic', '월식 사제', '해와 달이 겹친 문장, 어둠과 빛을 함께 다룬다.', 'cleric'),
  C('cl_seraph', 'costume', 'legend', '세라핌', '여섯 날개와 빛의 고리 — 천상의 성가가 들린다.', 'cleric'),
  C('as_teal', 'costume', 'common', '청록 그림자', '청록 두건을 쓴 밤길의 도적.', 'assassin'),
  C('as_fox', 'costume', 'rare', '여우 가면', '흰 여우 가면과 방울 달린 끈.', 'assassin'),
  C('as_oni', 'costume', 'epic', '오니', '붉은 뿔 가면과 도깨비불.', 'assassin'),
  C('as_moon', 'costume', 'legend', '월영', '초승달 칼날과 달그림자 잔상 — 베는 곳마다 은빛이 남는다.', 'assassin'),
  // 대마법사 로브·지팡이(성벽 위 내 마법사)
  C('rb_forest', 'robe', 'common', '숲의 현자', '이끼빛 로브와 떡갈나무 지팡이.'),
  C('rb_ash', 'robe', 'common', '잿빛 현자', '잿빛 로브와 흑단 지팡이.'),
  C('rb_royal', 'robe', 'rare', '왕실 궁정 마법사', '금실 자수 로브와 왕실 홀.'),
  C('rb_sakura', 'robe', 'rare', '벚꽃 마도사', '벚꽃 가지 지팡이, 소매에서 꽃잎이 흩날린다.'),
  C('rb_frost', 'robe', 'epic', '서리 여왕', '얼음 왕관과 수정 지팡이, 입김마다 서리가 핀다.'),
  C('rb_void', 'robe', 'epic', '심연의 군주', '공허를 두른 로브와 눈이 달린 지팡이.'),
  C('rb_celestial', 'robe', 'legend', '천구의 대마법사', '별자리 망토와 천구의 — 주위를 행성 구슬이 돈다.'),
  C('rb_dragon', 'robe', 'legend', '용혈 대마법사', '용비늘 로브와 용의 두개골 지팡이 — 등 뒤로 불꽃 날개가 인다.'),
  // 마법 이펙트 스킨(내 마법탄·스킬 입자 색과 테마)
  C('sk_jade', 'skin', 'common', '비취', '마법탄이 맑은 비취빛으로.'),
  C('sk_sunset', 'skin', 'common', '노을', '마법탄이 저녁노을 빛으로.'),
  C('sk_gold', 'skin', 'rare', '황금', '금빛 탄과 동전 같은 반짝임.'),
  C('sk_sakura', 'skin', 'rare', '벚꽃', '분홍 탄 꼬리에 꽃잎이 흩날린다.'),
  C('sk_crystal', 'skin', 'epic', '얼음 결정', '육각 결정이 부서지며 흩어진다.'),
  C('sk_neon', 'skin', 'epic', '네온', '형광 분홍·하늘빛 선이 번쩍인다.'),
  C('sk_abyss', 'skin', 'legend', '심연', '검보라 탄이 공허의 소용돌이를 남긴다.'),
  C('sk_star', 'skin', 'legend', '별빛', '별가루 꼬리와 별 모양 폭발.'),
];
export const COS_KEYS = COSMETICS.map(c => c.key);
export const COS_BY_KEY = Object.fromEntries(COSMETICS.map(c => [c.key, c]));
export const SLOT_NAME = { costume: '영웅 코스튬', robe: '대마법사 로브', skin: '마법 이펙트' };
export const COS_SLOTS = Object.keys(SLOT_NAME);

// ── 확률 · 천장 · 가격 ──
const RATE = { common: 0.55, rare: 0.33, epic: 0.10, legend: 0.02 };
const HCOL = Object.fromEntries(RARITIES.map(r => [r.key, r]));
export const COS_RARITY = Object.keys(RATE).map(key => ({ key, name: HCOL[key].name, color: HCOL[key].color, rate: RATE[key] }));
const RKEYS = Object.keys(RATE);
const BY_RARITY = Object.fromEntries(RKEYS.map(r => [r, COS_KEYS.filter(k => COS_BY_KEY[k].rarity === r)]));
export const PITY = 80;            // 80회 안에 전설 1개
export const PICKUP_SHARE = 0.5;   // 픽업 배너: 전설·영웅 확률의 절반이 픽업 몫
export const PULL_GEMS = { 1: 100, 10: 900 }; // test/summon-economy.js 실측으로 정함(DESIGN 계약)
export const SHARD_DUP = { common: 5, rare: 15, epic: 50, legend: 200 };
export const SHARD_PRICE = { common: 40, rare: 120, epic: 400, legend: 1500 };
export const HIST_MAX = 100;
export const WELCOME_TICKETS = 10;
const CAP = 1e9;

// 천장 포함 실제 전설 확률 = 1 / 전설까지 평균 소환 수
export function effLegendRate() {
  let e = 0;
  for (let k = 0; k < PITY; k++) e += (1 - RATE.legend) ** k;
  return 1 / e;
}

// 확정 규칙 포함, 나온 전설 중 픽업 몫: 한 주기 = 픽업(확률 s, 1개) 또는 픽업 아님 → 다음은 픽업(2개) → 1 / (2 - s)
export const pickupLegendShare = () => 1 / (2 - PICKUP_SHARE);

// ── 날짜(기기 현지) ──
const pad = n => String(n).padStart(2, '0');
export const dayKey = (now = Date.now()) => { const d = new Date(now); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dayNum = now => { const d = new Date(now); return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); }; // 현지 날짜의 일련번호(서머타임 무관)
const numKey = n => new Date(n * 864e5).toISOString().slice(0, 10);
const keyNum = k => (/^\d{4}-\d\d-\d\d$/.test(k) ? Math.round(Date.parse(k + 'T00:00:00Z') / 864e5) : -Infinity); // 'YYYY-MM-DD' → dayNum

// ── 배너 ── 픽업: 월요일 0시(현지)마다 전설 9종을 돌아가며 1종 + 영웅 2종
const ROTA = [
  ['kn_solar', 'kn_obsidian', 'sk_neon', '태양왕의 강림'],
  ['rb_celestial', 'so_nebula', 'sk_crystal', '천구의 문'],
  ['sk_star', 'cl_eclipse', 'rb_frost', '별이 쏟아지는 밤'],
  ['rg_sylvan', 'rg_raven', 'sk_crystal', '세계수의 노래'],
  ['rb_dragon', 'rb_void', 'as_oni', '용혈의 서약'],
  ['sk_abyss', 'rb_void', 'cl_eclipse', '심연의 부름'],
  ['so_phoenix', 'so_nebula', 'sk_neon', '불사조의 재'],
  ['cl_seraph', 'rb_frost', 'kn_obsidian', '세라핌의 날개'],
  ['as_moon', 'as_oni', 'rg_raven', '달그림자 연회'],
];
export const BANNER_KEYS = ['standard', 'pickup'];
export function pickupBanner(now = Date.now()) {
  const d = dayNum(now), w = Math.floor((d - 4) / 7); // 1970-01-05(월) = 일련번호 4
  const i = w - 2960; // 2026-09-28 주 = 첫 픽업(태양왕)
  const [legend, e1, e2, name] = ROTA[((i % ROTA.length) + ROTA.length) % ROTA.length];
  const start = 4 + w * 7, end = start + 7;
  return { key: 'pickup', name, legend, epics: [e1, e2], week: w, start: numKey(start), end: numKey(end), daysLeft: end - d };
}
export const banners = (now = Date.now()) => [{ key: 'standard', name: '별의 제단' }, pickupBanner(now)];
const bannerOf = (key, now) => (key === 'pickup' ? pickupBanner(now) : key === 'standard' ? banners(now)[0] : null);

// 배너의 아이템별 확률(합 1)
function itemRates(b) {
  const out = [];
  for (const r of RKEYS) {
    const keys = BY_RARITY[r], pu = b.key === 'pickup' ? (r === 'legend' ? [b.legend] : r === 'epic' ? b.epics : []) : [];
    for (const k of keys) {
      const rate = pu.length ? (pu.includes(k) ? RATE[r] * PICKUP_SHARE / pu.length : RATE[r] * (1 - PICKUP_SHARE) / (keys.length - pu.length)) : RATE[r] / keys.length;
      out.push({ key: k, name: COS_BY_KEY[k].name, rarity: r, rate, pickup: pu.includes(k) });
    }
  }
  return out;
}

// 확률표(공개용): 등급별 · 아이템별 · 천장 규칙
export function oddsTable(bannerKey, now = Date.now()) {
  const b = bannerOf(bannerKey, now);
  if (!b) return null;
  const rank = r => -RKEYS.indexOf(r);
  const items = itemRates(b).sort((x, y) => rank(x.rarity) - rank(y.rarity) || y.rate - x.rate || COS_KEYS.indexOf(x.key) - COS_KEYS.indexOf(y.key));
  const eff = effLegendRate();
  const rules = [
    `${PITY}회 안에 전설 1개 확정(천장). 전설이 나오면 천장 횟수는 0부터 다시 셉니다.`,
    '10연차는 희귀 이상 1개 이상을 보장합니다.',
    `천장을 포함한 전설 실제 확률은 1회 소환 기준 약 ${(eff * 100).toFixed(2)}%(평균 ${Math.round(1 / eff)}회)입니다. 10연차 보장이 더해지면 조금 더 높습니다.`,
    b.key === 'pickup'
      ? `픽업 전설 ${COS_BY_KEY[b.legend].name}: 전설이 나오면 ${PICKUP_SHARE * 100}% 확률로 픽업. 픽업이 아닌 전설이 나오면 다음 전설은 픽업 확정(픽업이 바뀌어도 이어짐). 확정 규칙을 포함한 픽업 전설 실제 확률은 약 ${(eff * pickupLegendShare() * 100).toFixed(2)}%입니다.`
      : '같은 등급 안의 외형은 모두 같은 확률입니다.',
    '천장 횟수는 상시 배너와 픽업 배너가 따로 셉니다.',
    `이미 가진 외형이 나오면 별조각으로 바뀝니다(일반 ${SHARD_DUP.common} · 희귀 ${SHARD_DUP.rare} · 영웅 ${SHARD_DUP.epic} · 전설 ${SHARD_DUP.legend}).`,
    '외형은 전투 능력에 영향을 주지 않습니다.',
  ];
  return { banner: b, rarities: COS_RARITY.map(({ key, name, rate }) => ({ key, name, rate })), items, pity: PITY, effLegend: eff, rules };
}

// ── 저장 정규화 ──
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const CODEX_STEPS = [[5, 1], [10, 1], [15, 2], [20, 2], [25, 2], [30, 3], [CODEX_SYN.length, 5]]; // [도감 발견 수, 소환권]
const codexStep = found => CODEX_STEPS.filter(([n]) => found >= n).length;
const newSeed = () => { const c = globalThis.crypto; if (c?.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0]; return (Math.random() * 2 ** 32) >>> 0; };
const tens = best => Math.floor(Math.min(best, MAX_STAGE) / 10) * 10;

// base = 정규화된 저장(best · discovered) — summon이 없던 저장의 이전에 쓴다
export function normSummon(v, base = {}) {
  const fresh = !v || typeof v !== 'object' || Array.isArray(v);
  v = obj(v);
  const owned = Array.isArray(v.owned) ? [...new Set(v.owned.filter(k => typeof k === 'string' && COS_BY_KEY[k]))] : [];
  const has = new Set(owned), e = obj(v.equip), ec = obj(e.costume);
  const ok = (k, slot, cls) => typeof k === 'string' && has.has(k) && COS_BY_KEY[k].slot === slot && (!cls || COS_BY_KEY[k].cls === cls);
  const costume = {};
  for (const c of HERO_CLASS_KEYS) if (ok(ec[c], 'costume', c)) costume[c] = ec[c];
  const p = obj(v.pity), best = toInt(base.best, 0, MAX_STAGE);
  const s = {
    owned,
    equip: { costume, robe: ok(e.robe, 'robe') ? e.robe : null, skin: ok(e.skin, 'skin') ? e.skin : null },
    shards: toInt(v.shards, 0, CAP),
    tickets: toInt(v.tickets, 0, CAP),
    pity: { standard: toInt(p.standard, 0, PITY - 1), pickup: toInt(p.pickup, 0, PITY - 1) },
    guar: v.guar === true,
    pulls: toInt(v.pulls, 0, CAP),
    hist: (Array.isArray(v.hist) ? v.hist : []).map(obj).filter(h => COS_BY_KEY[h.k] && BANNER_KEYS.includes(h.b)).slice(-HIST_MAX)
      .map(h => ({ t: toInt(h.t, 0, 9e15), b: h.b, k: h.k, ...(h.d ? { d: 1 } : {}), ...(h.g ? { g: 1 } : h.p ? { p: 1 } : {}) })),
    gift: v.gift === true,
    giftSeen: v.giftSeen === true,
    daily: typeof v.daily === 'string' && /^\d{4}-\d\d-\d\d$/.test(v.daily) ? v.daily : '',
    // 받은 보상 단계. 없던 저장(기존 저장 이전)은 지금까지를 받은 것으로 — 소급 없이 환영 선물로 대신
    mBoss: fresh ? tens(best) : toInt(v.mBoss, 0, MAX_STAGE),
    mFloor: fresh ? tens(best) : toInt(v.mFloor, 0, MAX_STAGE),
    mCodex: fresh ? codexStep(codexFound(base.discovered)) : toInt(v.mCodex, 0, CODEX_STEPS.length),
    rng: Number.isInteger(v.rng) && v.rng >= 0 && v.rng < 2 ** 32 ? v.rng : newSeed(),
  };
  if (!s.gift) { s.gift = true; s.giftSeen = false; s.tickets = Math.min(CAP, s.tickets + WELCOME_TICKETS); } // 환영 선물(딱 한 번)
  return s;
}
// 백업 코드용: 내역만 뺀다
export const packSummon = s => { const { hist, ...rest } = obj(s); return rest; };

// ── 소환 ──
// 소환 전용 난수(mulberry32 — 상태를 저장에 둔다, 전투 시드와 무관)
function rand(S) {
  let t = S.rng = (S.rng + 0x6D2B79F5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pickOf = (S, a) => a[Math.min(a.length - 1, Math.floor(rand(S) * a.length))];
function rollRarity(S, rarePlus) {
  const ks = rarePlus ? RKEYS.slice(1) : RKEYS;
  let x = rand(S) * ks.reduce((a, k) => a + RATE[k], 0);
  for (const k of ks) { x -= RATE[k]; if (x < 0) return k; }
  return ks[ks.length - 1];
}
// 한 장: 천장 → 등급 → 픽업 규칙 → 아이템
function rollOne(S, b, rarePlus) {
  const forced = S.pity[b.key] >= PITY - 1;
  const rarity = forced ? 'legend' : rollRarity(S, rarePlus);
  let key, guar = false;
  const pu = b.key === 'pickup' ? (rarity === 'legend' ? [b.legend] : rarity === 'epic' ? b.epics : null) : null;
  if (rarity === 'legend' && pu && S.guar) { key = b.legend; guar = true; }
  else if (pu) key = rand(S) < PICKUP_SHARE ? pickOf(S, pu) : pickOf(S, BY_RARITY[rarity].filter(k => !pu.includes(k)));
  else key = pickOf(S, BY_RARITY[rarity]);
  if (rarity === 'legend') { S.pity[b.key] = 0; if (b.key === 'pickup') S.guar = key !== b.legend; }
  else S.pity[b.key]++;
  return { key, rarity, pickup: !!pu && pu.includes(key), pity: forced, guar };
}

// 가격: pay 없으면 소환권이 n장 이상이면 소환권, 아니면 보석(섞어 내지 않음)
const pullN = n => (n === 1 || n === '1' ? 1 : n === 10 || n === '10' ? 10 : 0); // '10'(문자열)도 10연 보장이 걸리게
export function pullPrice(meta, n, pay) {
  n = pullN(n);
  const S = meta.summon, gems = PULL_GEMS[n];
  if (!gems) return { cur: 'gems', cost: 0, ok: false };
  const cur = pay === 'gems' ? 'gems' : pay === 'tickets' ? 'tickets' : S.tickets >= n ? 'tickets' : 'gems';
  const cost = cur === 'tickets' ? n : gems;
  return { cur, cost, ok: cur === 'tickets' ? S.tickets >= cost : meta.gems >= cost };
}

// week = 화면에 보인 픽업의 week(선택). 그사이 월요일 0시를 넘겨 픽업이 바뀌었으면 소환하지 않는다(보인 것 ≠ 낸 것 방지)
export function pull(meta, bannerKey, n, { pay, now = Date.now(), week } = {}) {
  n = pullN(n);
  const S = meta.summon, b = bannerOf(bannerKey, now);
  if (!S || !b || !PULL_GEMS[n]) return { ok: false, error: '소환할 수 없어요' };
  if (b.key === 'pickup' && week != null && week !== b.week) return { ok: false, stale: true, error: '픽업이 바뀌었어요' };
  const price = pullPrice(meta, n, pay);
  if (!price.ok) return { ok: false, error: price.cur === 'tickets' ? '소환권이 부족해요' : '보석이 부족해요' };
  if (price.cur === 'tickets') S.tickets -= price.cost; else meta.gems -= price.cost;
  const results = [], has = new Set(S.owned);
  let shards = 0, rarePlus = false;
  for (let i = 0; i < n; i++) {
    const r = rollOne(S, b, n === 10 && i === 9 && !rarePlus); // 10연차: 앞 9장이 모두 일반이면 마지막은 희귀 이상
    if (r.rarity !== 'common') rarePlus = true;
    r.isNew = !has.has(r.key);
    r.shards = r.isNew ? 0 : SHARD_DUP[r.rarity];
    if (r.isNew) { has.add(r.key); S.owned.push(r.key); }
    shards += r.shards;
    S.hist.push({ t: now, b: b.key, k: r.key, ...(r.isNew ? {} : { d: 1 }), ...(r.guar ? { g: 1 } : r.pity ? { p: 1 } : {}) }); // g = 픽업 확정 · p = 천장
    results.push(r);
  }
  if (S.hist.length > HIST_MAX) S.hist.splice(0, S.hist.length - HIST_MAX);
  S.shards = Math.min(CAP, S.shards + shards);
  S.pulls = Math.min(CAP, S.pulls + n);
  const top = RKEYS[Math.max(...results.map(r => RKEYS.indexOf(r.rarity)))];
  return { ok: true, banner: b, cur: price.cur, cost: price.cost, results, shards, top };
}

// ── 별조각 교환 · 보유 · 장착 ──
export const owns = (meta, key) => !!meta.summon?.owned.includes(key);
export function exchange(meta, key) {
  const c = COS_BY_KEY[key], S = meta.summon;
  if (!c || !S || S.owned.includes(key) || S.shards < SHARD_PRICE[c.rarity]) return false;
  S.shards -= SHARD_PRICE[c.rarity];
  S.owned.push(key);
  return true;
}
export function equipCos(meta, key) {
  const c = COS_BY_KEY[key], S = meta.summon;
  if (!c || !S || !S.owned.includes(key)) return false;
  if (c.slot === 'costume') S.equip.costume[c.cls] = key; else S.equip[c.slot] = key;
  return true;
}
export function unequipCos(meta, slot, cls) {
  const e = meta.summon?.equip;
  if (!e || !COS_SLOTS.includes(slot)) return false;
  if (slot === 'costume') { if (!e.costume[cls]) return false; delete e.costume[cls]; return true; }
  if (!e[slot]) return false;
  e[slot] = null;
  return true;
}
// art/cosmetics.js setLoadout(eq)에 그대로
export const loadoutOf = meta => { const e = meta.summon?.equip || {}; return { costume: { ...e.costume }, robe: e.robe || null, skin: e.skin || null }; };
export function collection(meta) {
  const has = new Set(meta.summon?.owned || []), cnt = f => { const a = COSMETICS.filter(f); return [a.filter(c => has.has(c.key)).length, a.length]; };
  return {
    n: has.size, total: COSMETICS.length,
    rarity: Object.fromEntries(RKEYS.map(r => [r, cnt(c => c.rarity === r)])),
    slot: Object.fromEntries(COS_SLOTS.map(s => [s, cnt(c => c.slot === s)])),
  };
}
export const sourceText = key => (COS_BY_KEY[key] ? `소환의 제단 · 별조각 ${SHARD_PRICE[COS_BY_KEY[key].rarity].toLocaleString('ko-KR')}개로 교환` : '');
export const summonDot = meta => (meta.summon?.tickets | 0) >= 1;
export const giftPending = meta => !!meta.summon && !meta.summon.giftSeen;
export function markGiftSeen(meta) { if (!giftPending(meta)) return false; meta.summon.giftSeen = true; return true; }
// 최근 → 오래된 순
export const history = meta => (meta.summon?.hist || []).slice().reverse()
  .map(h => ({ t: h.t, banner: h.b, key: h.k, rarity: COS_BY_KEY[h.k].rarity, dup: !!h.d, pity: !!h.p, guar: !!h.g }));

// ── 소환권 지급(run.js endRun 끝에서) — 모두 멱등: 받은 단계·날짜를 저장해 두 번 주지 않는다 ──
// ctx = { cleared(이번 도전 돌파 층), now } → [{ src, n, label }]
export function grantRunTickets(meta, { cleared = 0, now = Date.now() } = {}) {
  const S = meta.summon, out = [];
  if (!S) return out;
  const top = tens(toInt(meta.best, 0, MAX_STAGE));
  for (let f = S.mBoss + 10; f <= top; f += 10) out.push({ src: 'boss', n: 1, label: `${BOSSES[bossOf(f)]?.name || '네임드 보스'} 첫 처치 (${f}층)` });
  for (let f = S.mFloor + 10; f <= top; f += 10) out.push({ src: 'floor', n: f % 50 === 0 ? 3 : 1, label: `최고 기록 ${f}층 달성` });
  S.mBoss = Math.max(S.mBoss, top);
  S.mFloor = Math.max(S.mFloor, top);
  // 날짜는 앞으로만: 기기 시계를 되돌려 같은 날을 '새 날'로 만들 수 없다(받은 가장 늦은 날보다 뒤여야 지급)
  const dn = dayNum(now);
  if (cleared >= 1 && dn > keyNum(S.daily)) { S.daily = numKey(dn); out.push({ src: 'daily', n: 1, label: '오늘의 첫 도전 완료' }); }
  const found = codexFound(meta.discovered);
  for (; S.mCodex < CODEX_STEPS.length && found >= CODEX_STEPS[S.mCodex][0]; S.mCodex++)
    out.push({ src: 'codex', n: CODEX_STEPS[S.mCodex][1], label: `도감 ${CODEX_STEPS[S.mCodex][0]}종 발견` });
  S.tickets = Math.min(CAP, S.tickets + out.reduce((a, g) => a + g.n, 0));
  return out;
}

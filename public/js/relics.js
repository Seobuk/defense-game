// 유물(네임드 보스 보상) · 망각(스킬 비우기) — 표 · 효과 합산 · sim 훅 · 봇 정책. DOM 없음 (docs/DESIGN.md '4차 변경 구현 계약 · 유물 · 망각')
// 유물 = 규칙을 바꾸는 트레이드오프. up = 장점, down = 대가(카드 문구 그대로). fx = 효과(아래 NEUTRAL 필드만)
// 나중에 던전(지역)마다 다른 유물 풀을 붙일 수 있게 풀은 키 목록(relicPool)으로만 다룬다.
import { SPELL_SLOTS, SPELL_MAX_LV, MAX_STAGE, SKILL_BY_KEY, FUSION_BY_KEY, FUSIONS, COLLABS, PICK_AUTO_T } from './config.js';
import { bossOf } from './stages.js';
import { refreshFx, refreshFusion, reofferPick, serializeRun, slotsUsed } from './sim.js';
import { toInt } from './util.js';

export const RELIC_PICK_N = 3;   // 보스 보상 후보 수
export const RELIC_AUTO_T = 0.5; // 카드 '자동 선택' ON이면 유물도 이 초 뒤 추천 유물(v0.1.6 템포: 4초 → 0.5초 — 보스 층 처치→다음 층 2초 안쪽)
export const FORGET_PER_RUN = 2; // 망각(비우기) 기본 횟수
export const FORGET_REFUND_MAX = 3; // 망각 환급 상한(다음 스킬 카드 +레벨)

export const RELICS = [
  // ── 시작 풀(8) ──
  { key: 'crown', name: '광기의 왕관', up: '모든 스킬 피해 +40%', down: '스킬 칸 -1 · 칸이 차 있으면 가장 약한 스킬을 잃는다', fx: { skillMul: 1.4, slots: -1 }, start: true },
  { key: 'grail', name: '탐욕의 성배', up: '카드 선택지 +1장', down: '성벽 최대 내구력 -15%', fx: { choices: 1, wallMul: 0.85 }, start: true },
  { key: 'glass', name: '유리 대포', up: '모든 피해 +30%', down: '성벽 최대 내구력 -35%', fx: { atkMul: 1.3, wallMul: 0.65 }, start: true },
  { key: 'thief', name: '시간 도둑', up: '스킬 쿨타임 -20%', down: '기본 주문 봉인 · 성벽 최대 내구력 -15%', fx: { cdMul: 1 / 0.8, basicOff: true, wallMul: 0.85 }, start: true, excl: ['sage'] },
  { key: 'twinMoon', name: '쌍둥이 달', up: '고른 스킬이 2레벨씩 오른다', down: '마나 카드가 두 번에 한 번만 뜬다', fx: { step: 1, manaHalf: true }, start: true, excl: ['chaos'] },
  { key: 'hunter', name: '사냥꾼의 표식', up: '엘리트·보스에게 스킬 피해 +70%', down: '일반 적에게 스킬 피해 -15%', fx: { bossMul: 1.7, trashMul: 0.85 }, start: true },
  { key: 'miser', name: '수전노의 금고', up: '골드 획득 ×2.5', down: '모든 피해 -10%', fx: { goldMul: 2.5, atkMul: 0.9 }, start: true },
  { key: 'phoenix', name: '불사조 깃털', up: '성벽이 무너지면 한 번 더 부활(50%)', down: '운석 봉인', fx: { revives: 1, seal: ['meteor'] }, start: true, excl: ['meteorSeal'] },
  // ── 보석으로 해금(12) ──
  { key: 'resonance', name: '원소 공명', up: '같은 원소 스킬이 2칸 이상이면 그 원소 피해 +40%', down: '다른 원소 피해 -20%', fx: { resonance: 1 }, cost: 120 },
  { key: 'banner', name: '영웅의 깃발', up: '영웅 궁극기 때 모든 쿨타임 스킬 즉시 시전', down: '궁극기 쿨타임 +50%', fx: { banner: true, ultCdMul: 1.5 }, cost: 100 },
  { key: 'gambler', name: '도박사의 주사위', up: '전설 카드 확률 ×3 · 희귀 ×1.5', down: '카드 선택지 -1장', fx: { legendMul: 3, rareMul: 1.5, choices: -1 }, cost: 80 },
  { key: 'hourglass', name: '망각의 모래시계', up: '망각(비우기) +2회', down: '카드 새로고침 봉인', fx: { forgets: 2, noReroll: true }, cost: 60 },
  { key: 'meteorSeal', name: '별똥별 인장', up: '운석 쿨타임 -60%', down: '빙결 봉인', fx: { meteorCd: 0.4, seal: ['freeze'] }, cost: 80, excl: ['phoenix', 'glacier'] },
  { key: 'glacier', name: '빙하의 심장', up: '빙결 쿨타임 -50% · 지속 +50%', down: '운석 봉인', fx: { freezeCd: 0.5, freezeDur: 1.5, seal: ['meteor'] }, cost: 80, excl: ['meteorSeal'] },
  { key: 'oath', name: '영웅의 서약', up: '영웅 피해 +60%', down: '마법사 스킬 피해 -20%', fx: { heroMul: 1.6, skillMul: 0.8 }, cost: 100 },
  { key: 'echo', name: '메아리 반지', up: '스킬 연속 시전 확률 +30%p', down: '스킬 피해 -15%', fx: { echo: 0.3, skillMul: 0.85 }, cost: 120 },
  { key: 'vampire', name: '흡혈 수정', up: '적을 처치할 때마다 성벽 0.6% 회복', down: '성벽 최대 내구력 -20%', fx: { leech: 0.006, wallMul: 0.8 }, cost: 100 },
  { key: 'archStaff', name: '대마법사의 지팡이', up: '융합 스킬 전용 시전 피해 +80%', down: '그 밖의 스킬 피해 -20%', fx: { skillMul: 0.8, fusionCastMul: 1.8 / 0.8 }, cost: 150 },
  { key: 'sage', name: '현자의 외알 안경', up: '기본 주문 피해 ×10 · 관통 +2', down: '스킬 쿨타임 +25%', fx: { basicMul: 10, basicPierce: 2, cdMul: 0.8 }, cost: 80, excl: ['thief'] },
  { key: 'chaos', name: '혼돈의 구슬', up: '층을 깰 때마다 무작위 스킬 2개 Lv+1', down: '마나 카드가 뜨지 않는다(보스 카드만)', fx: { chaos: 2, noMana: true }, cost: 150, excl: ['twinMoon'] },
];
export const RELIC_KEYS = RELICS.map(r => r.key);
export const RELIC_BY_KEY = Object.fromEntries(RELICS.map(r => [r.key, r]));
export const START_RELICS = RELICS.filter(r => r.start).map(r => r.key);

// ── 해금(보석 상점 — ECONOMY 트랙이 부른다). meta.relicUnlocked = 산 유물 키 ──
const bought = meta => (Array.isArray(meta?.relicUnlocked) ? meta.relicUnlocked : []);
export const relicPool = meta => RELIC_KEYS.filter(k => RELIC_BY_KEY[k].start || bought(meta).includes(k));
export const lockedRelics = meta => RELIC_KEYS.filter(k => !RELIC_BY_KEY[k].start && !bought(meta).includes(k));
export const relicUnlockCost = key => RELIC_BY_KEY[key]?.cost ?? 0;
export function unlockRelic(meta, key) {
  if (!meta || !lockedRelics(meta).includes(key)) return false;
  const cost = relicUnlockCost(key);
  if (!(meta.gems >= cost)) return false;
  meta.gems -= cost;
  meta.relicUnlocked = [...bought(meta), key];
  return true;
}

// ── 효과 합산 ──
const NEUTRAL = {
  skillMul: 1, atkMul: 1, wallMul: 1, goldMul: 1, cdMul: 1, basicMul: 1, legendMul: 1, rareMul: 1, meteorCd: 1, freezeCd: 1, freezeDur: 1,
  heroMul: 1, bossMul: 1, trashMul: 1, ultCdMul: 1, fusionCastMul: 1,
  choices: 0, slots: 0, echo: 0, basicPierce: 0, step: 0, revives: 0, leech: 0, chaos: 0, forgets: 0, resonance: 0,
  basicOff: false, noReroll: false, noNew: false, banner: false, manaHalf: false, noMana: false, seal: [],
};
const MULS = new Set(Object.keys(NEUTRAL).filter(k => NEUTRAL[k] === 1));
export function relicFx(keys = []) {
  const f = { ...NEUTRAL, seal: [] };
  for (const k of keys) {
    for (const [n, v] of Object.entries(RELIC_BY_KEY[k]?.fx || {})) {
      if (n === 'seal') f.seal.push(...v);
      else if (typeof v === 'boolean') f[n] = f[n] || v;
      else if (MULS.has(n)) f[n] *= v;
      else f[n] += v;
    }
  }
  return f;
}
// sim computeFx가 부른다: 런 배율에 유물을 곱한다(cdMul·echo는 config cannonStats가 읽음)
export function applyRelicFx(f, r) {
  f.atkMul *= r.atkMul; f.wallMul *= r.wallMul; f.goldMul *= r.goldMul;
  f.choices += r.choices; f.cdMul = (f.cdMul || 1) * r.cdMul; f.echo = (f.echo || 0) + r.echo;
  return f;
}

// ── sim 훅 ──
export const slotCap = g => SPELL_SLOTS + (g.rfx ? g.rfx.slots : 0);      // 광기의 왕관: 5칸(이미 6칸이면 그대로 두고 새 스킬만 막힘)
export const cardStep = g => 1 + (g.rfx ? g.rfx.step : 0);               // 쌍둥이 달: 카드 한 장에 2레벨
export const relicSealed = (g, skill) => !!g.rfx && g.rfx.seal.includes(skill); // 운석·빙결 봉인
const EL_OF_KIND = { fire: 'fire', lightning: 'lightning', frost: 'frost', wind: 'wind', holy: 'holy', dark: 'dark' };
// 슬롯 원소 수(융합 스킬은 두 원소 모두) → 2칸 이상인 원소(원소마다 기본 스킬이 2종뿐이라 2칸 = 공명).
// 명중마다 불리므로 g._res에 담아 두고 스킬이 바뀌면(sim refreshFusion이 g._res = null) 다시 센다
export function resonant(g) {
  if (g._res) return g._res;
  const n = {};
  for (const k of Object.keys(g.spells)) for (const el of FUSION_BY_KEY[k]?.elements || [SKILL_BY_KEY[k]?.element]) n[el] = (n[el] || 0) + 1;
  return (g._res = Object.keys(n).filter(el => n[el] >= 2 && el !== 'summon'));
}
// 스킬 피해 배율(sim spellHit, 카드 스킬 명중만): 사냥꾼의 표식 · 원소 공명
export function relicHitMul(g, e, kind) {
  const r = g.rfx;
  let m = e.isBoss ? r.bossMul : r.trashMul;
  if (r.resonance) {
    const el = EL_OF_KIND[kind], on = resonant(g);
    if (el && on.length) m *= on.includes(el) ? 1.4 : 0.8;
  }
  return m;
}

const emit = (g, ev) => { if (g.events.length < 4000) g.events.push(ev); };
const picker = g => !!(g.players[0].autoPick || g.players[0].kind === 'bot');

// 네임드 보스 층 클리어 → 유물 후보. 혼돈의 구슬(층을 깰 때마다 무작위 스킬 Lv+1)도 여기서
export function onRelicClear(g) {
  const up = new Set();
  for (let n = g.rfx.chaos; n > 0; n--) { // 혼돈의 구슬: 무작위 스킬(서로 다르게) Lv+1 — 만렙이 되면 합체도
    const ks = Object.keys(g.spells).filter(k => g.spells[k] < SPELL_MAX_LV && !up.has(k));
    if (!ks.length) break;
    const k = ks[Math.floor(g.rng() * ks.length)];
    up.add(k);
    g.spells[k]++;
    emit(g, { type: 'relicProc', key: 'chaos', spell: k, level: g.spells[k] });
    refreshFusion(g);
  }
  if (bossOf(g.stage) && g.stage < MAX_STAGE) offerRelics(g);
}
export function offerRelics(g) {
  const own = g.relics, bad = new Set(own.flatMap(k => RELIC_BY_KEY[k].excl || []));
  let pool = g.relicPool.filter(k => !own.includes(k) && !bad.has(k) && !(RELIC_BY_KEY[k].excl || []).some(x => own.includes(x)));
  const cards = [];
  while (cards.length < RELIC_PICK_N && pool.length) {
    const k = pool[Math.floor(g.rng() * pool.length)];
    pool = pool.filter(x => x !== k);
    cards.push(k);
  }
  if (!cards.length) return false;
  g.relicPick = { cards, autoLeft: picker(g) ? RELIC_AUTO_T : null };
  emit(g, { type: 'relicOffer', cards });
  return true;
}

// 층마다 마나 카드(sim gainMana)를 띄울까: 혼돈의 구슬 = 안 띄움 · 쌍둥이 달 = 두 번에 한 번(저장되는 카운터)
export function relicManaCard(g) {
  const r = g.rfx;
  if (r.noMana) return false;
  if (!r.manaHalf) return true;
  return (g.run.relicCards = (g.run.relicCards | 0) + 1) % 2 === 1;
}
// 광기의 왕관이 칸을 줄일 때 잃는 스킬 = 가장 약한 스킬(낮은 레벨 기본 스킬 → 융합 스킬 순, 같으면 먼저 배운 것). relicui가 카드에 미리 보여 준다
export function weakestSkill(g) {
  const ks = Object.keys(g.spells), w = v => (FUSION_BY_KEY[v] ? 100 : 0) + g.spells[v];
  return ks.length ? ks.reduce((a, b) => (w(b) < w(a) ? b : a), ks[0]) : null;
}
// 광기의 왕관: 칸이 줄어 넘치면 가장 약한 스킬을 잃는다
function dropOverCap(g, key) {
  while (slotsUsed(g) > slotCap(g)) {
    const k = weakestSkill(g), level = g.spells[k];
    delete g.spells[k];
    if (g.mutations) delete g.mutations[k];
    emit(g, { type: 'relicProc', key, spell: k, level, lost: true });
    refreshFusion(g);
  }
}

// 유물 고르기(index −1 = 유물 없이 계속). 체크포인트: 클리어 화면이면 다음 층, 층 시작(이어하기)이면 이 층
export function chooseRelic(g, index) {
  const rp = g.relicPick;
  if (!rp || !Number.isInteger(index) || index < -1 || index >= rp.cards.length) return false;
  const key = index < 0 ? null : rp.cards[index];
  g.relicPick = null;
  if (key) {
    g.relics.push(key);
    g.rfx = relicFx(g.relics);
    const fx = RELIC_BY_KEY[key].fx;
    if (fx.forgets) g.forgetLeft += fx.forgets;
    if (fx.noReroll) g.rerollLeft = 0;
    if (fx.slots) dropOverCap(g, key);
    refreshFx(g);
  }
  emit(g, { type: 'relicPick', key });
  g.run.checkpoint = g.phase === 'clear' ? { ...serializeRun(g), stage: g.stage + 1 } : serializeRun(g);
  return true;
}

// 유물 화면이 보이는 동안 실시간 델타(main.js). 카드 '자동 선택' ON·봇이면 RELIC_AUTO_T초 뒤 추천 유물
export function tickRelic(g, dtReal) {
  const rp = g.relicPick;
  if (!rp || !(dtReal > 0)) return;
  if (!picker(g)) { rp.autoLeft = null; return; }
  if (rp.autoLeft == null) rp.autoLeft = RELIC_AUTO_T;
  if ((rp.autoLeft -= dtReal) <= 0) chooseRelic(g, pickRelic(g, rp.cards));
}

// 망각(비우기) — 카드 화면 · 전투 중 스킬 칸(탭 → 비우기) 어디서든. 스킬을 빼고(융합이면 두 재료도 함께)
// 환급: 비운 레벨의 절반(융합 3)이 다음 스킬 카드에 +레벨로 붙는다(g.forgetBonus → sim cardGain · 스킬 카드를 고르면 0).
// 카드 화면이면 떠 있는 카드를 지금 빌드로 다시 뽑는다(환급 반영). 카드 한 장 더는 없음 — 봇 A/B에서 도전 수 −15~20%라 뺐다
export const forgetRefund = (key, level) => (FUSION_BY_KEY[key] ? FORGET_REFUND_MAX : Math.min(FORGET_REFUND_MAX, Math.ceil(level / 2)));
export const canForget = g => g.forgetLeft > 0 && !g.relicPick && (!!g.pick || g.phase === 'play');
export function forgetSkill(g, key) {
  if (!canForget(g) || !(g.spells[key] > 0)) return false;
  const n = Object.keys(g.spells).length;
  if (!g.pick && n < 3 && n < slotCap(g)) return false; // 전투 중 칸에서: 스킬 3개 이상이거나 칸이 찼을 때만(relicui.tipHTML과 같은 규칙 — 책을 비우지 않게)
  const level = g.spells[key], refund = forgetRefund(key, level), pick = g.pick;
  delete g.spells[key];
  if (g.mutations) delete g.mutations[key]; // 변이 기록(MUTATIONS 트랙)
  g.forgetLeft--;
  g.run.forgets++;
  g.forgetBonus = (g.forgetBonus | 0) + refund;
  refreshFusion(g);
  emit(g, { type: 'forget', spell: key, level, fusion: !!FUSION_BY_KEY[key], refund });
  if (pick) {
    reofferPick(g, pick);
    if (g.pick) g.pick.autoLeft = picker(g) ? PICK_AUTO_T : null; // 새 카드 = 카운트다운도 처음부터(새로고침과 같게)
  }
  return true;
}

// sim act: {type:'relic', index} · {type:'forget', spell}
export function relicAct(g, i, a) {
  if (i !== 0) return false;
  return a.type === 'relic' ? chooseRelic(g, a.index) : forgetSkill(g, a.spell);
}

// 영웅 궁극기 성공 직후(sim act heroUlt): 궁극기 쿨타임 배율 · 영웅의 깃발(쿨타임 스킬 전부 바로 준비 — 합동 필살 창과 겹친다)
export function onRelicUlt(g) {
  const h = g.heroUnit, r = g.rfx;
  if (!h) return;
  h.ultCd *= r.ultCdMul;
  if (!r.banner) return;
  for (const k of Object.keys(g.spellT)) if (k !== 'dragon' && typeof g.spellT[k] === 'number' && (g.book[k] > 0 || g.spells[k] > 0)) g.spellT[k] = 0;
  emit(g, { type: 'relicProc', key: 'banner', x: h.x, y: h.y });
}
// 처치마다(sim killEnemy): 흡혈 수정
export function onRelicKill(g, e) {
  const l = g.rfx.leech;
  if (l && g.phase === 'play') g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * l * (e.share || 1));
}
// 성벽이 무너질 때(sim damageWall): 불사조 깃털 부활이 남았으면 쓰고 true
export function relicRevive(g) {
  if (!(g.rfx.revives > g.run.relicRevives)) return false;
  g.run.relicRevives++;
  emit(g, { type: 'relicProc', key: 'phoenix' });
  return true;
}

// ── 저장 ──
export function relicRunSave(g) {
  return { relics: [...g.relics], relicPick: g.relicPick ? [...g.relicPick.cards] : null, forgetLeft: g.forgetLeft, forgets: g.run.forgets, forgetBonus: g.forgetBonus | 0, relicRevives: g.run.relicRevives, relicCards: g.run.relicCards | 0 };
}
// 신뢰할 수 없는 런 저장값 → 모양 검증(throw 없음). forgetLeft null = 새 도전(createGame이 채움)
export function normalizeRelicRun(r) {
  const relics = [...new Set(Array.isArray(r.relics) ? r.relics : [])].filter(k => RELIC_KEYS.includes(k)).slice(0, 12);
  const rp = Array.isArray(r.relicPick) ? [...new Set(r.relicPick)].filter(k => RELIC_KEYS.includes(k) && !relics.includes(k)).slice(0, RELIC_PICK_N) : [];
  return {
    relics, relicPick: rp.length ? rp : null,
    forgetLeft: r.forgetLeft == null ? null : toInt(r.forgetLeft, 0, 99),
    forgets: toInt(r.forgets, 0, 99), forgetBonus: toInt(r.forgetBonus, 0, 9), relicRevives: toInt(r.relicRevives, 0, 9), relicCards: toInt(r.relicCards, 0, 1e4),
  };
}
// createGame: 런 저장(normalizeRun 결과)에서 유물 상태를 세운다(g.fx가 계산된 뒤, startStage 전)
export function initRelics(g, run, opts) {
  g.forgetLeft = run.forgetLeft ?? FORGET_PER_RUN + (g.fx.forgets | 0) + toInt(opts.bonusForgets, 0, 9);
  g.forgetBonus = run.forgetBonus | 0; // 망각 환급(다음 스킬 카드 +레벨)
  g.relicPick = run.relicPick ? { cards: run.relicPick, autoLeft: picker(g) ? RELIC_AUTO_T : null } : null;
  if (g.relicPick) emit(g, { type: 'relicOffer', cards: g.relicPick.cards });
}

// ── 봇 정책(헤드리스 러너 · 유물 '자동 선택' 추천) ──
const VALUE = { crown: 6, grail: 6, glass: 5, thief: 6, twinMoon: 7, hunter: 6, miser: 3, phoenix: 7, resonance: 4, banner: 5, gambler: 4,
  hourglass: 3, meteorSeal: 4, glacier: 4, oath: 4, echo: 6, vampire: 5, archStaff: 3, sage: 2, chaos: 5 };
export function pickRelic(g, cards = g.relicPick?.cards || []) {
  const full = slotsUsed(g) >= SPELL_SLOTS;
  const score = k => (VALUE[k] || 1) + (k === 'resonance' && resonant(g).length ? 6 : 0) + (k === 'archStaff' ? 3 * g.fusions.length : 0)
    + (k === 'crown' && full ? -2 : 0);
  let best = 0;
  cards.forEach((k, i) => { if (score(k) > score(cards[best])) best = i; });
  return best;
}
// 망각을 쓸 만한가(헤드리스 봇): 카드가 떠 있고 이번 카드로 합체가 안 되면 forgetHint(6층부터). 없으면 null
export function forgetChoice(g, minStage = 6) {
  const p = g.pick;
  if (!p || p.starter || p.cards.some(c => c.fusionHint)) return null;
  return forgetHint(g, minStage);
}
// 비울 만한 스킬(봇 · UI 추천 공용 — g 대신 뷰도 된다): 칸이 다 찼고, 어떤 짝(융합 재료)에도 들지 않고 협공도 켜지 않는
// 낮은 레벨(≤4) 기본 스킬 — 비우면 환급 +레벨로 짝이 될 새 스킬을 노린다. 가장 낮은 레벨부터
export function forgetHint(g, minStage = 3) {
  if (!(g.forgetLeft > 0) || g.rfx?.noNew || g.stage < minStage || slotsUsed(g) < slotCap(g)) return null;
  const inPair = k => FUSIONS.some(f => !g.spells[f.key] && f.test(g.spells) && f.groups.some(gr => gr.includes(k)));
  const collab = k => COLLABS.some(c => (g.collabs || []).includes(c.key) && c.spells.includes(k));
  const c = Object.keys(g.spells).filter(k => !FUSION_BY_KEY[k] && g.spells[k] <= 4 && !inPair(k) && !collab(k))
    .sort((a, b) => g.spells[a] - g.spells[b]);
  return c[0] || null;
}

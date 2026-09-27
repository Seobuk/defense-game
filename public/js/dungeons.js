// 4차 변경 — 던전(지역) 특성: 지역마다 적의 원소 약점·내성 + 지역 규칙 1개. DOM 없음(sim·봇·UI 공용).
// DUNGEON_TRAITS = 지역별 순수 데이터(나중에 세계 지도의 던전마다 그대로 붙일 수 있게). 지금은 5테마(stages.js themeOf)에 붙는다.
// 판에 쓰이는 특성 = g.traits(있으면 — 후일 던전별) || 지금 테마의 특성. docs/DESIGN.md '4차 변경 구현 계약 · 던전 특성'
import { THEMES, SPELL_BY_KEY, FUSION_BY_KEY, FRONT_Y, WALL_Y, REACH } from './config.js';

export const ELEM_MUL = { weak: 1.3, resist: 0.75 }; // 약점 +30% · 내성 −25%
// 규칙 key(short = HUD 칩 한 단어): wildfire(화상 전염) · darkness(사거리) · undying(부활) · heat(시전 속도) · frenzy(이동 속도)
export const DUNGEON_TRAITS = {
  meadow: {
    weak: ['fire'], resist: ['dark'], lore: '마른 풀과 점액은 잘 타고, 햇살 가득한 초원엔 어둠이 스미지 못한다.',
    rule: { key: 'wildfire', short: '들불', name: '번지는 들불', desc: '불타는 적이 쓰러지면 화상이 주변 적에게 번진다.', r: 110, n: 3, share: 0.6, base: 0.12 },
  },
  cave: {
    weak: ['lightning'], resist: ['wind'], lore: '젖은 바위벽을 타고 번개가 번지고, 좁은 굴에선 바람이 흩어진다.',
    rule: { key: 'darkness', short: '어둠', name: '칠흑의 어둠', desc: '마법사 사거리 −20% — 어둠 속 적은 노리지 못한다. 영웅은 어둠 속에서도 싸운다.', reach: 0.8 },
  },
  graveyard: {
    weak: ['holy'], resist: ['frost'], lore: '망자는 빛에 타고, 식은 몸은 추위를 모른다.',
    rule: { key: 'undying', short: '망자', name: '되살아나는 망자', desc: '쓰러진 잡몹의 25%가 체력 40%로 한 번 일어난다. 신성 스킬로 쓰러뜨리거나 불타는 적은 일어나지 못한다.', chance: 0.25, hp: 0.4, bane: ['holy'] },
  },
  volcano: {
    weak: ['frost'], resist: ['fire'], lore: '용암 몸뚱이는 냉기에 굳고, 불은 먹이일 뿐이다.',
    rule: { key: 'heat', short: '열기', name: '들끓는 열기', desc: '모든 주문 시전 속도 −15%. 냉기 스킬을 하나라도 가지면 열기가 식는다.', rate: 0.85, cure: 'frost' },
  },
  abyss: {
    weak: ['dark', 'wind'], resist: ['holy', 'lightning'], lore: '마족은 더 깊은 저주에 삼켜지고, 마왕의 결계는 빛과 번개를 막는다.',
    rule: { key: 'frenzy', short: '광기', name: '광기의 행진', desc: '적 이동 속도 +10% — 둔화와 밀쳐내기가 빛난다.', speed: 1.1 },
  },
};
export const REGION_KEYS = THEMES.map(t => t.key);
export const ELEM_NAME = { fire: '화염', lightning: '번개', frost: '냉기', wind: '바람', holy: '신성', dark: '암흑', summon: '소환' };
// 피해를 주지 않는 스킬(약점·내성 배지 없음 — 배율이 닿지 않는다)
const NO_DMG = new Set(['frostWard', 'gale', 'holyLight', 'curseMark', 'soulHarvest', 'stoneGolem']);
const KIND_EL = { fire: 'fire', lightning: 'lightning', frost: 'frost', wind: 'wind', holy: 'holy', dark: 'dark' };
// ponytail: 밸런스 A/B 측정용 프로세스 전체 스위치(테스트·하네스 워커만 켠다). 광기의 행진 속도(옛 심연 ×1.1)는 끄지 않는다
export const DG_TEST = { off: false };

// 테마 번호(0~4) → 특성(+ key·name·floors). 범위 밖은 가장 가까운 지역
export function regionTraits(theme) {
  const i = Math.max(0, Math.min(REGION_KEYS.length - 1, theme | 0)), key = REGION_KEYS[i];
  return { key, name: THEMES[i].name, floors: [i * 20 + 1, i * 20 + 20], ...DUNGEON_TRAITS[key] };
}
const cache = REGION_KEYS.map((_, i) => regionTraits(i));
export const traitsOf = g => (DG_TEST.off || !g ? null : g.traits || cache[g.theme | 0] || null);
// stages.js enemySpeedMul: 광기의 행진(스위치와 무관 — 옛 심연 ×1.1과 같은 값)
export const regionSpeed = theme => cache[Math.max(0, Math.min(cache.length - 1, theme | 0))].rule.speed || 1;

// 스킬 키(기본 14 · 융합 8) → 원소 배열. 융합은 두 원소. 명중마다 불리므로 미리 만든 상수 배열(바꾸지 말 것)
const NONE = Object.freeze([]);
const EL_ARR = Object.fromEntries([...Object.keys(SPELL_BY_KEY), ...Object.keys(FUSION_BY_KEY)]
  .map(k => [k, Object.freeze(FUSION_BY_KEY[k]?.elements ? [...FUSION_BY_KEY[k].elements] : [SPELL_BY_KEY[k].element])]));
const KIND_ARR = Object.fromEntries(Object.keys(KIND_EL).map(k => [k, Object.freeze([KIND_EL[k]])]));
export const skillElements = key => EL_ARR[key] || NONE;
const factor = (t, el) => (t.weak.includes(el) ? ELEM_MUL.weak : t.resist.includes(el) ? ELEM_MUL.resist : 1);
// 원소 배열의 배율 = 원소별 배율의 평균(융합: 약점 + 보통 = ×1.15, 약점 + 내성 = ×1.025)
function mulOf(t, els) {
  if (!els.length) return 1;
  let s = 0;
  for (let i = 0; i < els.length; i++) s += factor(t, els[i]);
  return s / els.length;
}

// 스킬 피해 배율(sim.js spellHit이 카드·융합 피해에 곱한다). key = 시전 중인 스킬(g._src), 없으면 kind(피해 원소)로
export function elemMul(g, key, kind) {
  const t = traitsOf(g);
  if (!t) return 1;
  return mulOf(t, key && !NO_DMG.has(key) ? skillElements(key) : KIND_ARR[kind] || NONE);
}

// UI · 봇: 이 스킬이 지금 지역에서 어떤가 → { mul, tag: 'weak'|'resist'|null, cure }.
// cure = 이 스킬이 지역 규칙을 푼다(화산: 냉기 스킬이 아직 없을 때). 피해 없는 스킬은 mul 1. theme 생략 = 지금 판
export function skillAffinity(g, key, theme) {
  const t = theme == null ? traitsOf(g) : DG_TEST.off ? null : cache[theme];
  if (!t || !key) return { mul: 1, tag: null, cure: false };
  const els = skillElements(key), mul = NO_DMG.has(key) ? 1 : mulOf(t, els);
  const cure = !!t.rule.cure && els.includes(t.rule.cure) && !ownsElement(g, t.rule.cure);
  return { mul, tag: mul > 1.001 ? 'weak' : mul < 0.999 ? 'resist' : null, cure };
}

// 봇 카드 점수 가산(bot.pickCard): 지금 지역 + 지역 끝 5층 안이면 다음 지역도 조금. 약점 +4 · 내성 −3 · 열기 해소 +6
const BIAS = { weak: 4, resist: -3 };
const biasOf = a => (BIAS[a.tag] || 0) + (a.cure ? 6 : 0);
export function pickBias(g, key) {
  if (DG_TEST.off || !g || g.traits) return 0; // ponytail: 던전별 특성(g.traits)이 생기면 '다음 던전'은 지도가 알려 준다
  const th = g.theme | 0, left = 20 - ((g.stage - 1) % 20);
  let b = biasOf(skillAffinity(g, key, th));
  if (left <= 5 && th + 1 < cache.length) b += 0.75 * biasOf(skillAffinity(g, key, th + 1));
  return b;
}

const ownsElement = (g, el) => { for (const k in g.book || {}) if (SPELL_BY_KEY[k]?.element === el) return true; return false; };

// ── 지역 규칙 훅 ──
// 칠흑의 어둠: config.REACH.y(사거리 윗선)를 내린다. sim.step이 매 스텝 부른다(여러 판이 한 프로세스에 있어도 지금 판 기준)
export function applyReach(g) {
  const t = traitsOf(g);
  REACH.y = t && t.rule.key === 'darkness' ? FRONT_Y + (WALL_Y - FRONT_Y) * (1 - t.rule.reach) : FRONT_Y;
}
// 들끓는 열기: 주문 시전 속도 배율(spells.spellRateMul에 곱). 냉기 스킬(g.book — 융합이 품은 재료 포함)이 있으면 1
export function castRateMul(g) {
  const t = traitsOf(g);
  return t && t.rule.key === 'heat' && !ownsElement(g, t.rule.cure) ? t.rule.rate : 1;
}
// 되살아나는 망자: 잡몹이 쓰러지는 순간(sim.damage) — 되살렸으면 true(처치 아님). g._hitSrc = 지금 명중한 스킬 키/원소(spellHit)
export function undying(g, e, emit) {
  const t = traitsOf(g);
  if (!t || t.rule.key !== 'undying' || e.isBoss || e.risen || e.burnT > 0) return false;
  const src = g._hitSrc;
  if (src && (KIND_ARR[src] || skillElements(src)).some(el => t.rule.bane.includes(el))) return false;
  e.risen = true; // 한 번만
  if (g.rng() >= t.rule.chance) return false;
  e.hp = e.maxHp * t.rule.hp;
  e.slowT = Math.max(e.slowT || 0, 0.6); // 일어나는 동안 잠깐 굼뜨다
  emit(g, { type: 'rise', x: e.x, y: e.y, r: e.r });
  return true;
}
// 번지는 들불: 불타는 적이 쓰러지면 남은 화상(+ 최대 체력 base)의 share만큼 가까운 n마리에게(sim.killEnemy)
export function regionKill(g, e, emit) {
  const t = traitsOf(g);
  if (!t || t.rule.key !== 'wildfire' || !(e.burnT > 0)) return;
  const R = t.rule, amt = (e.burn + e.maxHp * R.base) * R.share, rr = R.r * R.r, near = [];
  for (const q of g.enemies) {
    if (q === e || q.dead) continue;
    const d = (q.x - e.x) ** 2 + (q.y - e.y) ** 2;
    if (d <= rr) near.push([d, q]);
  }
  if (!near.length) return;
  near.sort((a, b) => a[0] - b[0]);
  const hit = near.slice(0, R.n).map(([, q]) => {
    q.burn += amt; q.burnT = Math.max(q.burnT, 2); q.burnO = e.burnO; q.burnSk = e.burnSk;
    return [q.x, q.y];
  });
  emit(g, { type: 'wildfire', x: e.x, y: e.y, pts: hit });
}

// UI: 지역 한 장 요약(배너·칩·툴팁) → { key, name, floors, weak:[{el,name}], resist:[…], rule, lore, weakPct, resistPct }
export function regionView(theme) {
  const t = cache[Math.max(0, Math.min(cache.length - 1, theme | 0))];
  const els = a => a.map(el => ({ el, name: ELEM_NAME[el] }));
  return { key: t.key, name: t.name, floors: t.floors, weak: els(t.weak), resist: els(t.resist), rule: t.rule, lore: t.lore,
    weakPct: Math.round((ELEM_MUL.weak - 1) * 100), resistPct: Math.round((1 - ELEM_MUL.resist) * 100) };
}

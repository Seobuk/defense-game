// 변이(스킬 진화 분기, 4차 1·5) — Lv6(만렙) 스킬·융합 스킬마다 두 갈래 중 하나(스킬당 1회). 데이터 + 규칙 + 시뮬 효과(DOM 없음).
// 변이는 수치가 아니라 **작동 방식**을 바꾼다: 시전형(쿨타임 5종 + 융합 8종)은 MUT_CAST가 기본 시전(spells.js CAST/FCAST)을 대신하고,
// 지속형·소환형은 mutTick(매 프레임)·mutOnHit·mutOnKill·mutSlow·mutCurse가 기본 효과에 더한다.
// 전장 물체는 g.spellFx.mut(스테이지마다 새로 — initSpells), 타이머는 g.spellFx.mt. 그림은 art/mutfx.js(view.spellFx.mut · mutFx 이벤트).
// 변이한 재료가 합체하면 변이는 사라진다(pruneMutations — sim refreshFusion이 부른다). 저장: g.mutations = { [스킬]: 변이 키 }.
import { WORLD_W, WALL_Y, FRONT_Y, SPELL_MAX_LV, FUSION_BY_KEY, FUSION_FX, inReach, mageAt } from './config.js';

const TAU = Math.PI * 2;
// key · name · short(카드 한 줄: 무엇이 바뀌나) · desc(툴팁) · col(연출·배지 색) · cd(시전형: 쿨타임 배율) · bot(자동 선택 선호)
const M = (key, name, short, desc, col, cd = 1, bot = 1) => ({ key, name, short, desc, col, cd, bot });
export const MUTATIONS = {
  fireball: [
    M('splitFire', '분열 화염구', '3갈래로 갈라져 착탄마다 연쇄 폭발', '화염구가 세 갈래로 갈라져 서로 다른 무리에 떨어지고, 착탄 지점마다 작은 폭발이 연달아 터진다.', '#ff7a1e', 1.2, 2),
    M('sunOrb', '태양 구체', '느리고 거대한 구체가 관통하며 태움', '거대한 태양 구체가 성벽에서 전선까지 천천히 떠오르며 닿는 모든 적을 태운다.', '#ffc21a', 2.6, 1),
  ],
  flameBullet: [
    M('wildfire', '들불', '불탄 적이 쓰러지면 불이 옮겨붙음', '화상 입은 적이 쓰러지면 불길이 가까운 적 셋에게 옮겨붙는다(연쇄).', '#ff5a1a', 1, 2),
    M('scorch', '불바다', '맞힌 자리에 타오르는 장판', '내 주문이 맞힌 자리에 2.5초간 불바다가 남아 밟은 적을 태운다.', '#ff9a2a', 1, 1),
  ],
  lightningStrike: [
    M('focusBolt', '천벌', '모든 벼락이 가장 강한 적 하나에', '낙뢰가 가장 강한 적(보스 먼저) 하나에 연달아 내리꽂혀 잠깐씩 기절시킨다.', '#ffe53a', 1.35, 1),
    M('thunderCloud', '뇌운', '무리를 따라다니며 벼락 치는 먹구름', '적 무리 위에 먹구름이 떠 4초간 따라다니며 아래 적에게 쉴 새 없이 벼락을 떨어뜨린다.', '#9a8cff', 3.3, 2),
  ],
  chainLightning: [
    M('ballLightning', '구전', '튀는 대신 떠도는 번개 구체', '번개가 튀는 대신 번개 구체가 생겨 적에게 다가가며 주변을 계속 지진다.', '#7fdcff', 1, 2),
    M('arcTether', '전류 사슬', '두 적을 전류로 묶어 계속 지짐', '번개가 적 둘을 2초간 전류로 묶어 두 적과 그 사이를 지나는 적을 계속 지진다.', '#b88aff', 1, 1),
  ],
  iceLance: [
    M('iceFan', '빙창 부채', '창 다섯 자루를 부채꼴로', '얼음 창 다섯 자루를 부채꼴로 흩뿌린다(창마다 3마리 관통).', '#9fe8ff', 1.15, 2),
    M('glacierSpear', '빙하 창', '거대한 창이 얼리고 끝에서 파편', '거대한 빙하 창이 느리게 날아가 닿는 적을 모두 얼리고, 끝에서 얼음 파편 여섯 조각으로 부서진다.', '#5fb8ff', 2.6, 1),
  ],
  frostWard: [
    M('permafrost', '영구 동토', '적 무리 밑에 얼어붙은 땅', '결계가 전장으로 번져 적 무리 밑에 6초간 얼어붙은 땅이 생긴다(강한 둔화 + 냉기 피해).', '#7fe3ff', 1, 2),
    M('iceMirror', '얼음 거울', '적 투사체 반사 · 성벽 공격에 반격', '결계에 얼음 거울이 서서 날아오는 적 투사체를 되쏘고, 성벽을 치는 적에게 냉기로 반격한다.', '#c8f4ff', 1, 1),
  ],
  tornado: [
    M('vortex', '진공 소용돌이', '빨아들인 뒤 한꺼번에 폭발', '밀집한 무리 한가운데 소용돌이가 적을 빨아들이고, 사라질 때 한꺼번에 터뜨린다.', '#6ff0c0', 1.5, 2),
    M('crossWind', '횡단 돌풍', '양옆에서 무리를 가로질러 휩쓴다', '좌우 끝에서 회오리 두 개가 적 무리를 가로질러 휩쓸며 밀어낸다.', '#aef7d8', 1.7, 1),
  ],
  gale: [
    M('windBlades', '바람 칼날', '관통하는 칼날 바람 세 줄기', '시전 속도 증가는 그대로, 마법사가 주기적으로 관통하는 바람 칼날 세 줄기를 부채꼴로 날린다.', '#7af0c8', 1, 2),
    M('windSpirits', '바람 정령', '성벽 앞을 도는 정령 셋', '시전 속도 증가는 그대로, 바람 정령 셋이 성벽 앞을 돌며 닿는 적을 베고 밀어낸다.', '#c8fff0', 1, 1),
  ],
  holyLight: [
    M('holyPulse', '성역 파동', '성벽에서 퍼지는 빛의 고리', '재생은 그대로, 3초마다 성벽에서 빛의 고리가 퍼져 닿는 적을 태우고 밀어낸다.', '#ffe07a', 1, 2),
    M('lightWell', '빛의 샘', '넘친 치유가 빛의 창으로', '재생은 그대로, 넘친 치유가 빛의 샘에 모이고 차오르면 가장 앞선 적 다섯에게 빛의 창을 쏜다.', '#fff3a8', 1, 1),
  ],
  judgment: [
    M('crossJudgment', '십자 심판', '세로 + 가로 십자 광선', '심판 광선이 표적을 가로지르는 가로 광선과 함께 십자로 떨어진다.', '#ffd23a', 1.2, 2),
    M('sweepRay', '쓸어내는 광선', '광선이 1.4초간 옆으로 쓸어냄', '광선이 사라지지 않고 1.4초 동안 옆으로 쓸고 지나가며 닿는 적을 계속 태운다.', '#fff0a8', 1.55, 1),
  ],
  curseMark: [
    M('doomMark', '파멸 낙인', '받은 피해를 모아 3초 뒤 폭발', '가장 강한 적에게 파멸 낙인. 3초 뒤(또는 쓰러지면) 그동안 받은 피해의 일부가 주변으로 터진다.', '#c050ff', 1, 1),
    M('hexZone', '저주 장막', '장막 안 피해 크게 ↑ · 밖은 조금', '저주가 적 무리를 따라다니는 장막으로 모인다. 장막 안 적은 받는 피해가 크게 늘고, 밖은 조금만 는다.', '#9a3dff', 1, 2),
  ],
  soulHarvest: [
    M('soulVolley', '영혼 일제 사격', '영혼 12개가 모이면 추적 영혼 6발', '골드·회복은 그대로, 거둔 영혼이 마법사 곁에 모이고 12개가 되면 적을 쫓는 영혼 여섯 발로 쏟아진다.', '#c89aff', 1, 2),
    M('reaper', '사신의 낫', '10처치마다 낫이 한 줄 처형', '골드·회복은 그대로, 10마리를 처치할 때마다 거대한 낫이 한 줄을 휩쓸어 체력 20% 이하 적을 처형한다.', '#8a4dff', 1, 1),
  ],
  babyDragon: [
    M('twinDragons', '쌍둥이 용', '용 두 마리가 번갈아 브레스', '새끼 드래곤이 둘이 되어 서로 다른 높이에서 번갈아 브레스를 쏟는다.', '#ff8a4a', 1, 2),
    M('diveBomber', '급강하', '브레스 대신 무리로 급강하 폭발', '브레스 대신 가장 밀집한 무리에 급강하해 화염 폭발을 일으키고 다시 날아오른다.', '#ff5a2a', 1, 1),
  ],
  stoneGolem: [
    M('golemSmash', '대지 강타', '전장으로 나가 땅을 내려찍음', '골렘이 적 무리 앞으로 걸어 나가 주기적으로 땅을 내려찍어 주변 적을 기절시킨다.', '#d8b48a', 1, 2),
    M('golemRebirth', '파편 재조립', '부서지면 폭발 → 5초 뒤 재조립', '골렘이 부서지면 파편이 폭발하고 5초 뒤 다시 조립된다. 성벽을 치는 적에게 가시 파편이 박힌다.', '#ff9ae6', 1, 1),
  ],
  blazeTornado: [
    M('firewalker', '방랑 화염', '적을 쫓아 떠도는 불꽃 회오리', '불꽃 회오리가 머물지 않고 가장 가까운 적을 쫓아 5초 동안 전장을 떠돈다.', '#ff6a1f', 1.5, 1),
    M('infernoRing', '화염 고리', '작은 회오리 넷이 원을 그리며 태움', '작은 불꽃 회오리 넷이 적 무리를 둘러싸고 빙글빙글 돌며 고리 안을 태운다.', '#ffb040', 1.2, 2),
  ],
  superconduct: [
    M('chainCircuit', '결빙 회로', '한 줄기가 적에서 적으로 이어짐', '얼음 번개 한 줄기가 적에서 적으로 차례로 이어지며 모두 얼린다.', '#9fe8ff', 1, 2),
    M('icePrison', '얼음 감옥', '앞선 적을 2초 가둔 뒤 파쇄', '앞선 적들을 얼음 감옥에 2초간 가두고, 감옥이 깨질 때 파편이 주변을 벤다.', '#5fc8ff', 1.15, 1),
  ],
  steamBurst: [
    M('geysers', '간헐천', '간헐천 셋이 3초간 연달아 분출', '적 무리 주위에 간헐천 셋이 솟아 3초 동안 연달아 증기를 뿜는다.', '#bfeaff', 1.3, 1),
    M('pressure', '압력 폭발', '빨아들인 뒤 한꺼번에 대폭발', '증기가 1.2초간 적을 한가운데로 빨아들인 뒤 한꺼번에 터진다.', '#ffb070', 1.35, 2),
  ],
  stormEye: [
    M('wanderStorm', '떠도는 폭풍', '전장을 가로지르며 끌고 벼락', '폭풍의 눈이 머물지 않고 전장을 가로질러 이동하며 적을 끌어당기고 벼락을 친다.', '#b8a0ff', 1.2, 2),
    M('twinEyes', '쌍둥이 눈', '두 폭풍 사이를 번개 다리가 잇다', '두 무리에 작은 폭풍의 눈이 하나씩 열리고, 둘 사이를 번개 다리가 이어 지나는 적을 지진다.', '#ffe53a', 1.1, 1),
  ],
  twilight: [
    M('eclipseOrb', '일식', '떠 있는 검은 해가 광선 난사', '검은 해가 3초간 적 무리 위에 떠 가는 광선을 쉴 새 없이 내리꽂는다(저주).', '#e0a0ff', 1.5, 1),
    M('duskWave', '황혼의 물결', '가로 물결이 전장 전체를 훑음', '황혼이 가로 물결이 되어 성벽에서 전선까지 전장 전체를 훑고 지나간다(저주 + 밀어냄).', '#ffd08a', 1.25, 2),
  ],
  plasma: [
    M('plasmaRail', '플라즈마 레일', '일직선 관통 레일 + 번개 갈래', '성벽에서 전선까지 일직선으로 꿰뚫는 레일을 쏘고, 끝에서 번개가 갈라진다.', '#e07aff', 1.1, 1),
    M('plasmaMine', '플라즈마 지뢰', '길목에 지뢰 셋 · 밟으면 폭발', '적이 오는 길목에 플라즈마 지뢰 셋을 깔아, 밟으면 번개와 함께 터진다.', '#c860ff', 1.3, 2),
  ],
  ghostLegion: [
    M('wraithKnights', '망령 기사', '6초간 싸우는 망령 기사 둘', '유령 대신 망령 기사 둘이 나와 6초 동안 적 사이를 누비며 벤다.', '#c8a0ff', 1.6, 2),
    M('spectralCharge', '유령 돌격', '유령이 세로로 일제히 꿰뚫음', '유령들이 성벽에 한 줄로 늘어섰다가 세로로 일제히 돌격해 지나는 모든 적을 꿰뚫는다.', '#d8c0ff', 1.2, 1),
  ],
  guardianDragon: [
    M('dragonAegis', '용의 비호', '성벽 위 화염 장막 + 투사체 차단', '수호룡이 3초간 성벽 위를 맴돌며 성벽 앞을 불태우고, 날아오는 투사체를 막고 성벽을 치유한다.', '#ffe07a', 1.6, 1),
    M('starfall', '성룡 낙하', '가장 강한 적에 수직 낙하', '수호룡이 하늘에서 가장 강한 적(보스 먼저)에게 수직으로 내리꽂혀 큰 피해와 충격파를 준다.', '#fff0a8', 1.3, 2),
  ],
};
export const MUT_SKILLS = Object.keys(MUTATIONS);
export const MUT_BY_KEY = {};
for (const [skill, list] of Object.entries(MUTATIONS)) for (const m of list) MUT_BY_KEY[m.key] = { ...m, skill };
export const MUT_KEYS = Object.keys(MUT_BY_KEY);

// ── 규칙 (sim.js가 부른다) ──
const muts = g => g.mutations || (g.mutations = {});
export const mutOf = (g, key) => (g.mutations ? g.mutations[key] : undefined);
// 변이 대기: Lv6인데 아직 변이를 고르지 않은 스킬(슬롯 순서)
export const pendingMutations = g => Object.keys(g.spells).filter(k => (g.spells[k] | 0) >= SPELL_MAX_LV && MUTATIONS[k] && !mutOf(g, k));
// 변이 카드: { spell, mutate:true, muts:[A, B], level, rarity:'legend', fusion, fusionHint:false } — act pick { index, choice: 0|1 }
export const mutationCard = (g, k) => ({ spell: k, mutate: true, muts: MUTATIONS[k].map(m => m.key), level: g.spells[k], rarity: 'legend', fusion: !!FUSION_BY_KEY[k], fusionHint: false });
// 자동 선택·봇이 고를 갈래(선호 점수가 높은 쪽, 같으면 A)
export function mutChoice(g, card) {
  const [a, b] = (card && card.muts) || [];
  return (MUT_BY_KEY[b]?.bot || 0) > (MUT_BY_KEY[a]?.bot || 0) ? 1 : 0;
}
// 카드 적용 → 고른 변이 키(잘못된 카드·이미 변이했으면 null). choice가 0|1이 아니면 추천 갈래
export function applyMutation(g, card, choice) {
  const k = card && card.spell, list = MUTATIONS[k];
  if (!list || (g.spells[k] | 0) < SPELL_MAX_LV || mutOf(g, k)) return null;
  const c = choice === 0 || choice === 1 ? choice : mutChoice(g, card);
  return (muts(g)[k] = list[c].key);
}
// 스킬이 빠졌거나(합체·망각) 만렙이 아니면 그 변이를 지운다
export function pruneMutations(g) {
  const m = muts(g);
  for (const k of Object.keys(m)) if ((g.spells[k] | 0) < SPELL_MAX_LV || MUT_BY_KEY[m[k]]?.skill !== k) delete m[k];
}
// 저장값 → 올바른 모양(throw 없음). 지금 가진 Lv6 스킬의 제 변이만
export function normalizeMutations(raw, spells) {
  const out = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const k of Object.keys(spells)) {
    const m = raw[k];
    if ((spells[k] | 0) >= SPELL_MAX_LV && typeof m === 'string' && MUT_BY_KEY[m]?.skill === k) out[k] = m;
  }
  return out;
}
// 쿨타임 링(spells.js spellCooldown): 변이한 시전형 스킬의 쿨타임 배율
export const mutCdMul = (g, key) => MUT_BY_KEY[mutOf(g, key)]?.cd || 1;
// 기본 동작을 통째로 대신하는 지속형(새끼 드래곤: 두 변이 모두 자체 비행)
export const mutOwns = (g, key) => key === 'babyDragon' && !!mutOf(g, key);

// ── 공용 도구 ──
const ents = g => g.spellFx.mut || (g.spellFx.mut = []);
const timers = g => g.spellFx.mt || (g.spellFx.mt = {});
const MAX_ENTS = 64;
function spawn(g, o) { const a = ents(g); if (a.length < MAX_ENTS) a.push(o); return o; }
const count = (g, k) => { let n = 0; for (const q of ents(g)) if (q.k === k) n++; return n; };
const fxEv = (g, api, ev) => api.emit(g, { type: 'mutFx', ...ev });
const noBoss = e => !e.isBoss;
// 가장 강한 적: 네임드 > 엘리트 > 체력
const power = e => (e.named ? 2e15 : e.isBoss ? 1e15 : 0) + e.hp;
function strongest(g) {
  let b = null;
  for (const e of g.enemies) if (inReach(e) && e.y + e.r > 0 && (!b || power(e) > power(b))) b = e;
  return b;
}
function nearest(g, x, y, maxD = Infinity, skip = null) {
  let b = null, bd = maxD * maxD;
  for (const e of g.enemies) {
    if (e === skip || !inReach(e)) continue;
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; b = e; }
  }
  return b;
}
// 원 안 적에게: fn(e) (죽은 적 제외)
function each(g, x, y, r, fn) {
  const es = g.enemies;
  for (let i = 0; i < es.length; i++) {
    const e = es[i];
    if (!e.dead && (e.x - x) ** 2 + (e.y - y) ** 2 <= (r + e.r) ** 2) fn(e);
  }
}
const segD2 = (px, py, x0, y0, x1, y1) => {
  const dx = x1 - x0, dy = y1 - y0, L = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / L));
  return (px - x0 - u * dx) ** 2 + (py - y0 - u * dy) ** 2;
};
// 넉백(성벽에서 먼 쪽 = 위). 전선 위로는 안 밀고, 광폭화 중·보스는 무시
const knock = (g, e, d) => { if (g.berserk === 1 && !e.isBoss && !e.dead) e.y = Math.max(Math.min(e.y, FRONT_Y), e.y - d); };
const stun = (e, t) => { if (e.dead) return; if (e.named) e.slowT = Math.max(e.slowT, t * 2); else e.stunT = Math.max(e.stunT || 0, t); };
// 끌어당김(보스 제외, 광폭화 중엔 안 함)
function pull(g, x, y, r, spd, dt) {
  if (g.berserk !== 1) return;
  each(g, x, y, r, e => {
    if (e.isBoss) return;
    const dx = x - e.x, dy = y - e.y, d = Math.hypot(dx, dy) || 1;
    if (d > 10) { e.x += dx / d * spd * dt; e.y = Math.max(FRONT_Y, e.y + dy / d * spd * dt); }
  });
}

// ── 시전형 변이: spells.js tick이 CAST[key]/FCAST[key] 대신 부른다. (g, api, o, p, K) → 쿨타임(초) 또는 null(표적 없음)
// p = 그 스킬의 지금 레벨 수치(변이는 Lv6에만), K = spells.js 공용 도구(pd · sHit · cast · densest · burnOn · chilled · isSupport · base · rate)
const cd = (p, key) => p.cd * MUT_BY_KEY[key].cd;
export const MUT_CAST = {
  splitFire(g, api, o, p, K) {
    const t0 = api.frontMost(g);
    if (!t0) return null;
    const far = g.enemies.filter(e => inReach(e) && (e.x - t0.x) ** 2 + (e.y - t0.y) ** 2 > 140 * 140), tg = [t0];
    for (let k = 0; k < 2 && far.length; k++) {
      const e = far.splice(Math.floor(g.rng() * far.length), 1)[0];
      if (tg.every(q => (q.x - e.x) ** 2 + (q.y - e.y) ** 2 > 100 * 100)) tg.push(e);
    }
    while (tg.length < 3) tg.push({ x: t0.x + (tg.length === 1 ? -1 : 1) * 130, y: t0.y - 40 }); // 무리가 하나면 양옆으로 갈라진다
    K.cast(g, api, o, 'fireball', t0.x, t0.y);
    const r = p.r * 0.62, dmg = K.pd(g, o) * p.mul * 0.5;
    for (const t of tg) {
      const x = t.x, y = t.y;
      each(g, x, y, r, e => K.sHit(g, api, e, dmg, o, 'fire'));
      api.emit(g, { type: 'spell', key: 'fireball', o, x, y, r, mut: 'splitFire' });
      for (let j = 0; j < 3; j++) {
        const a = j * TAU / 3 + g.rng();
        spawn(g, { k: 'blast', m: 'splitFire', t: -(0.2 + 0.1 * j), x: x + Math.cos(a) * r * 0.8, y: y + Math.sin(a) * r * 0.55, r: r * 0.55, dmg: dmg * 0.32, o });
      }
    }
    return cd(p, 'splitFire');
  },
  sunOrb(g, api, o, p, K) {
    const t = K.densest(g, api);
    if (!t) return null;
    const c = mageAt(g, o);
    K.cast(g, api, o, 'fireball', t.x, t.y);
    spawn(g, { k: 'sun', m: 'sunOrb', t: 0, x: c.x, y: WALL_Y - 40, tx: t.x, r: 100, dps: K.pd(g, o) * p.mul * 1.25, o });
    fxEv(g, api, { m: 'sunOrb', x: c.x, y: WALL_Y - 40 });
    return cd(p, 'sunOrb');
  },
  focusBolt(g, api, o, p, K) {
    const t = strongest(g);
    if (!t) return null;
    K.cast(g, api, o, 'lightningStrike', t.x, t.y, K.isSupport(g, t));
    const dmg = K.pd(g, o) * p.mul * 1.0;
    for (let k = 0; k < p.n; k++) spawn(g, { k: 'bolt', m: 'focusBolt', t: -k * 0.07, e: t, dmg, o, i: k });
    return cd(p, 'focusBolt');
  },
  thunderCloud(g, api, o, p, K) {
    const t = K.densest(g, api);
    if (!t) return null;
    K.cast(g, api, o, 'lightningStrike', t.x, t.y);
    spawn(g, { k: 'cloud', m: 'thunderCloud', t: 0, life: 4, x: t.x, y: t.y, tx: t.x, ty: t.y, r: 135, zap: 0, re: 0, dmg: K.pd(g, o) * p.mul * 0.6, o });
    fxEv(g, api, { m: 'thunderCloud', x: t.x, y: t.y });
    return cd(p, 'thunderCloud');
  },
  iceFan(g, api, o, p, K) {
    const tgt = api.aimTarget(g);
    if (!tgt) return null;
    const c = mageAt(g, o), a0 = Math.atan2(tgt.y - c.y, tgt.x - c.x), dmg = K.pd(g, o) * p.mul * 0.6;
    K.cast(g, api, o, 'iceLance', tgt.x, tgt.y, K.isSupport(g, tgt));
    for (let k = -2; k <= 2; k++) {
      const a = a0 + k * 0.16;
      g.spellFx.lances.push({ x: c.x, y: c.y, vx: Math.cos(a) * 980, vy: Math.sin(a) * 980, dmg, hit: [], life: 0, o, pierce: 3, mut: 'iceFan' });
    }
    api.emit(g, { type: 'spell', key: 'iceLance', o, x: c.x, y: c.y, mut: 'iceFan' });
    return cd(p, 'iceFan');
  },
  glacierSpear(g, api, o, p, K) {
    const tgt = api.aimTarget(g);
    if (!tgt) return null;
    const c = mageAt(g, o), a = Math.atan2(tgt.y - c.y, tgt.x - c.x);
    K.cast(g, api, o, 'iceLance', tgt.x, tgt.y, K.isSupport(g, tgt));
    spawn(g, { k: 'glacier', m: 'glacierSpear', t: 0, x: c.x, y: c.y - 20, vx: Math.cos(a) * 470, vy: Math.sin(a) * 470, hit: [], dmg: K.pd(g, o) * p.mul * 1.7, o });
    fxEv(g, api, { m: 'glacierSpear', x: c.x, y: c.y - 20 });
    return cd(p, 'glacierSpear');
  },
  vortex(g, api, o, p, K) {
    const t = K.densest(g, api, 130);
    if (!t) return null;
    K.cast(g, api, o, 'tornado', t.x, t.y);
    const pd = K.pd(g, o);
    spawn(g, { k: 'vortex', m: 'vortex', t: 0, life: 2.4, x: t.x, y: t.y, r: p.r * 1.45, tk: 0, dps: pd * p.mul * 0.4, burst: pd * p.mul * 0.9, o });
    fxEv(g, api, { m: 'vortex', x: t.x, y: t.y, r: p.r * 1.45 });
    return cd(p, 'vortex');
  },
  crossWind(g, api, o, p, K) {
    const t = K.densest(g, api);
    if (!t) return null;
    K.cast(g, api, o, 'tornado', WORLD_W / 2, t.y);
    for (const s of [-1, 1]) {
      g.spellFx.tornadoes.push({ x: s < 0 ? -30 : WORLD_W + 30, y: t.y, r: p.r * 0.85, t: 0, mul: p.mul * 0.85 * g._emp, spd: 0, vx: -s * 290, o, life: 2.7, fire: false, mut: 'crossWind' });
    }
    fxEv(g, api, { m: 'crossWind', x: WORLD_W / 2, y: t.y });
    return cd(p, 'crossWind');
  },
  crossJudgment(g, api, o, p, K) {
    const tgt = api.aimTarget(g);
    const base = K.base.judgment(g, api, o, p);
    if (base == null || !tgt) return base;
    const dmg = K.pd(g, o) * p.mul * 0.55, h = p.w * 0.4, x = tgt.x, y = tgt.y;
    for (const e of g.enemies) if (!e.dead && Math.abs(e.y - y) <= h + e.r && Math.abs(e.x - x) > p.w / 2 + e.r) K.sHit(g, api, e, dmg, o, 'holy');
    fxEv(g, api, { m: 'crossJudgment', x, y, w: p.w });
    return cd(p, 'crossJudgment');
  },
  sweepRay(g, api, o, p, K) {
    const tgt = api.aimTarget(g);
    if (!tgt) return null;
    let l = 0, r = 0;
    for (const e of g.enemies) if (inReach(e) && Math.abs(e.y - tgt.y) < 220) { if (e.x < tgt.x) l++; else if (e.x > tgt.x) r++; }
    const dir = r >= l ? 1 : -1;
    K.cast(g, api, o, 'judgment', tgt.x, tgt.y, K.isSupport(g, tgt));
    spawn(g, { k: 'ray', m: 'sweepRay', t: 0, life: 1.4, x: tgt.x - dir * 120, vx: dir * 180, w: p.w * 0.85, tk: 0, dps: K.pd(g, o) * p.mul * 2, o });
    fxEv(g, api, { m: 'sweepRay', x: tgt.x - dir * 120, w: p.w * 0.85 });
    return cd(p, 'sweepRay');
  },
  // ── 융합 ──
  firewalker(g, api, o, p, K) {
    const t = K.densest(g, api);
    if (!t) return null;
    K.cast(g, api, 0, 'blazeTornado', t.x, t.y);
    g.spellFx.tornadoes.push({ x: t.x, y: t.y, r: p.r * 0.72, t: 0, mul: p.mul * g._emp, spd: 0, o: 0, life: 5, fire: true, mut: 'firewalker' });
    api.emit(g, { type: 'spell', key: 'blazeTornado', shape: 'firestorm', o: 0, x: t.x, y: t.y, r: p.r * 0.72, mut: 'firewalker' });
    return cd(p, 'firewalker');
  },
  infernoRing(g, api, o, p, K) {
    const t = K.densest(g, api, 140);
    if (!t) return null;
    K.cast(g, api, 0, 'blazeTornado', t.x, t.y);
    for (let k = 0; k < 4; k++) {
      g.spellFx.tornadoes.push({ x: t.x, y: t.y, r: p.r * 0.42, t: 0, mul: p.mul * 0.56 * g._emp, spd: 0, o: 0, life: 3.2, fire: true, mut: 'infernoRing', cx: t.x, cy: t.y, a: k * TAU / 4 });
    }
    fxEv(g, api, { m: 'infernoRing', x: t.x, y: t.y, life: 3.2 });
    return cd(p, 'infernoRing');
  },
  chainCircuit(g, api, o, p, K) {
    let cur = api.frontMost(g);
    if (!cur) return null;
    K.cast(g, api, 0, 'superconduct', cur.x, cur.y);
    const dmg = K.pd(g, 0) * p.mul * 0.75, used = [cur], pts = [];
    for (let k = 0; k < p.n && cur; k++) {
      pts.push([cur.x, cur.y]);
      K.sHit(g, api, cur, dmg * (K.chilled(g, cur) ? FUSION_FX.superconduct : 1), 0, 'lightning');
      if (!cur.dead) { cur.slowT = Math.max(cur.slowT, 2); stun(cur, 0.45); }
      let nx = null, bd = 240 * 240;
      for (const e of g.enemies) {
        if (!inReach(e) || used.includes(e)) continue;
        const d = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
        if (d < bd) { bd = d; nx = e; }
      }
      if (nx) used.push(nx);
      cur = nx;
    }
    fxEv(g, api, { m: 'chainCircuit', pts });
    return cd(p, 'chainCircuit');
  },
  icePrison(g, api, o, p, K) {
    const front = g.enemies.filter(inReach).sort((a, b) => b.y - a.y).slice(0, Math.ceil(p.n / 2));
    if (!front.length) return null;
    K.cast(g, api, 0, 'superconduct', front[0].x, front[0].y);
    const pd = K.pd(g, 0);
    for (const e of front) {
      K.sHit(g, api, e, pd * p.mul * 0.8, 0, 'frost');
      if (e.dead) continue;
      stun(e, 2);
      if (count(g, 'prison') < 12) spawn(g, { k: 'prison', m: 'icePrison', t: 0, life: 2, e, x: e.x, y: e.y, dmg: pd * p.mul * 0.45 });
    }
    fxEv(g, api, { m: 'icePrison', pts: front.map(e => [e.x, e.y]) });
    return cd(p, 'icePrison');
  },
  geysers(g, api, o, p, K) {
    const t = K.densest(g, api);
    if (!t) return null;
    K.cast(g, api, 0, 'steamBurst', t.x, t.y);
    const a0 = g.rng() * TAU, dmg = K.pd(g, 0) * p.mul * 0.2;
    for (let k = 0; k < 3; k++) {
      const a = a0 + k * TAU / 3;
      spawn(g, { k: 'geyser', m: 'geysers', t: 0, life: 3, tk: -0.12 * k, x: t.x + Math.cos(a) * 105, y: Math.max(FRONT_Y + 20, t.y + Math.sin(a) * 70), r: 78, dmg });
    }
    fxEv(g, api, { m: 'geysers', x: t.x, y: t.y });
    return cd(p, 'geysers');
  },
  pressure(g, api, o, p, K) {
    const t = K.densest(g, api, 150);
    if (!t) return null;
    K.cast(g, api, 0, 'steamBurst', t.x, t.y);
    spawn(g, { k: 'press', m: 'pressure', t: 0, life: 1.2, x: t.x, y: t.y, r: p.r * 1.5, br: p.r * 1.05, dmg: K.pd(g, 0) * p.mul * 1.55 });
    fxEv(g, api, { m: 'pressure', x: t.x, y: t.y, r: p.r * 1.5 });
    return cd(p, 'pressure');
  },
  wanderStorm(g, api, o, p, K) {
    const t = K.densest(g, api, 150);
    if (!t) return null;
    const dir = t.x < WORLD_W / 2 ? 1 : -1, x = Math.max(70, Math.min(WORLD_W - 70, t.x - dir * 160));
    K.cast(g, api, 0, 'stormEye', x, t.y);
    g.spellFx.storms.push({ x, y: t.y, r: p.r * 0.85, t: 0, life: 5, zapT: 0, dmg: K.pd(g, 0) * p.mul, vx: dir * 115, mut: 'wanderStorm' });
    api.emit(g, { type: 'spell', key: 'stormEye', shape: 'stormEye', o: 0, x, y: t.y, r: p.r * 0.85, mut: 'wanderStorm' });
    return cd(p, 'wanderStorm');
  },
  twinEyes(g, api, o, p, K) {
    const a = K.densest(g, api, 150);
    if (!a) return null;
    let b = null, bn = 0;
    for (const e of g.enemies) {
      if (!inReach(e) || (e.x - a.x) ** 2 + (e.y - a.y) ** 2 < 230 * 230) continue;
      let n = 0;
      for (const q of g.enemies) if (!q.dead && (q.x - e.x) ** 2 + (q.y - e.y) ** 2 < 150 * 150) n++;
      if (n > bn) { bn = n; b = e; }
    }
    const bx = b ? b.x : Math.max(90, Math.min(WORLD_W - 90, WORLD_W - a.x)), by = b ? b.y : a.y;
    K.cast(g, api, 0, 'stormEye', a.x, a.y);
    const pd = K.pd(g, 0), sa = { x: a.x, y: a.y, r: p.r * 0.62, t: 0, life: 4, zapT: 0, dmg: pd * p.mul * 0.7, mut: 'twinEyes' };
    const sb = { ...sa, x: bx, y: by, zapT: FUSION_FX.stormZap / 2 };
    g.spellFx.storms.push(sa, sb);
    spawn(g, { k: 'link', m: 'twinEyes', t: 0, life: 4, a: sa, b: sb, tk: 0, dmg: pd * p.mul * 0.35 });
    for (const s of [sa, sb]) api.emit(g, { type: 'spell', key: 'stormEye', shape: 'stormEye', o: 0, x: s.x, y: s.y, r: s.r, mut: 'twinEyes' });
    return cd(p, 'twinEyes');
  },
  eclipseOrb(g, api, o, p, K) {
    const t = K.densest(g, api, 160);
    if (!t) return null;
    K.cast(g, api, 0, 'twilight', t.x, t.y);
    spawn(g, { k: 'eclipse', m: 'eclipseOrb', t: 0, life: 3, x: t.x, y: Math.max(FRONT_Y + 10, t.y - 150), tk: 0, dmg: K.pd(g, 0) * p.mul * 0.36 });
    fxEv(g, api, { m: 'eclipseOrb', x: t.x, y: Math.max(FRONT_Y + 10, t.y - 150) });
    return cd(p, 'eclipseOrb');
  },
  duskWave(g, api, o, p, K) {
    if (!g.enemies.some(inReach)) return null;
    K.cast(g, api, 0, 'twilight', WORLD_W / 2, WALL_Y - 60);
    spawn(g, { k: 'dusk', m: 'duskWave', t: 0, y: WALL_Y - 10, vy: -560, hit: [], dmg: K.pd(g, 0) * p.mul * 0.85 });
    fxEv(g, api, { m: 'duskWave', y: WALL_Y - 10 });
    return cd(p, 'duskWave');
  },
  plasmaRail(g, api, o, p, K) {
    const t = api.aimTarget(g);
    if (!t) return null;
    const c = mageAt(g, 0), dx = t.x - c.x, dy = Math.min(-1, t.y - c.y), k = (FRONT_Y - 40 - c.y) / dy;
    const x1 = c.x + dx * k, y1 = FRONT_Y - 40, dmg = K.pd(g, 0) * p.mul * 1.1;
    K.cast(g, api, 0, 'plasma', t.x, t.y, K.isSupport(g, t));
    let far = null;
    for (const e of g.enemies) {
      if (e.dead || segD2(e.x, e.y, c.x, c.y, x1, y1) > (30 + e.r) ** 2) continue;
      K.sHit(g, api, e, dmg, 0, 'lightning');
      if (!far || e.y < far.y) far = e;
    }
    if (far) api.chainArc(g, far, dmg * 0.5, 0, p.n);
    fxEv(g, api, { m: 'plasmaRail', x0: c.x, y0: c.y - 20, x1, y1 });
    return cd(p, 'plasmaRail');
  },
  plasmaMine(g, api, o, p, K) {
    const front = g.enemies.filter(inReach).sort((a, b) => b.y - a.y).slice(0, 8);
    if (!front.length) return null;
    K.cast(g, api, 0, 'plasma', front[0].x, front[0].y);
    const dmg = K.pd(g, 0) * p.mul * 0.55, pts = [];
    for (let k = 0; k < 3; k++) {
      const e = front[Math.floor(g.rng() * front.length)], x = Math.max(40, Math.min(WORLD_W - 40, e.x + (g.rng() - 0.5) * 60)), y = Math.min(WALL_Y - 70, e.y + 60 + g.rng() * 40);
      if (count(g, 'mine') < 9) spawn(g, { k: 'mine', m: 'plasmaMine', t: 0, life: 6, x, y, r: p.r * 0.75, dmg, n: Math.ceil(p.n / 2) });
      pts.push([x, y]);
    }
    fxEv(g, api, { m: 'plasmaMine', pts });
    return cd(p, 'plasmaMine');
  },
  wraithKnights(g, api, o, p, K) {
    if (!g.enemies.some(inReach)) return null;
    K.cast(g, api, 0, 'ghostLegion', WORLD_W / 2, WALL_Y - 60);
    for (let k = 0; k < 2; k++) {
      if (count(g, 'knight') >= 4) break;
      spawn(g, { k: 'knight', m: 'wraithKnights', t: 0, life: 6, x: 290 + k * 140, y: WALL_Y - 50, atk: 0.2 * k, face: k ? 1 : -1, tgt: null, dmg: K.pd(g, 0) * p.mul * 0.55 });
    }
    fxEv(g, api, { m: 'wraithKnights', x: WORLD_W / 2, y: WALL_Y - 50 });
    return cd(p, 'wraithKnights');
  },
  spectralCharge(g, api, o, p, K) {
    if (!g.enemies.some(inReach)) return null;
    K.cast(g, api, 0, 'ghostLegion', WORLD_W / 2, WALL_Y - 60);
    const n = p.n, xs = Array.from({ length: n }, (_, k) => 50 + (WORLD_W - 100) * (k + 0.5) / n);
    spawn(g, { k: 'charge', m: 'spectralCharge', t: 0, y: WALL_Y - 40, vy: -640, xs, hit: [], dmg: K.pd(g, 0) * p.mul * 0.85 });
    fxEv(g, api, { m: 'spectralCharge', y: WALL_Y - 40, xs });
    return cd(p, 'spectralCharge');
  },
  dragonAegis(g, api, o, p, K) {
    if (!g.enemies.some(inReach)) return null;
    K.cast(g, api, 0, 'guardianDragon', WORLD_W / 2, WALL_Y - 140);
    spawn(g, { k: 'aegis', m: 'dragonAegis', t: 0, life: 3, tk: 0, x: WORLD_W / 2, dps: K.pd(g, 0) * p.mul * 1.4, heal: p.heal });
    fxEv(g, api, { m: 'dragonAegis', x: WORLD_W / 2, y: WALL_Y - 160 });
    return cd(p, 'dragonAegis');
  },
  starfall(g, api, o, p, K) {
    const t = strongest(g);
    if (!t) return null;
    K.cast(g, api, 0, 'guardianDragon', t.x, t.y, K.isSupport(g, t));
    spawn(g, { k: 'star', m: 'starfall', t: -0.45, e: t, x: t.x, y: t.y, dmg: K.pd(g, 0) * p.mul * 2.3, heal: p.heal });
    fxEv(g, api, { m: 'starfall', x: t.x, y: t.y });
    return cd(p, 'starfall');
  },
};
// 이 스킬의 시전을 대신하는 변이 시전(없으면 undefined → 기본 시전)
export const mutCast = (g, key) => MUT_CAST[mutOf(g, key)];

// ── 명중·처치 훅 (spells.js onSpellHit · onKill, 내 주문서만) ──
export function mutOnHit(g, e, raw, api, K) {
  const m = g.mutations;
  if (!m) return;
  const T = timers(g);
  if (m.flameBullet === 'scorch' && !(T.scorch > 0) && count(g, 'patch') < 8) { // 불바다: 0.35초에 한 장
    T.scorch = 0.35;
    const p = K.lv(g, 'flameBullet');
    spawn(g, { k: 'patch', m: 'scorch', t: 0, life: 2.5, tk: 0, x: e.x, y: e.y + e.r * 0.4, r: 62, dps: K.pd(g, 0) * p.burn * 1.1 });
    fxEv(g, api, { m: 'scorch', x: e.x, y: e.y + e.r * 0.4 });
  }
  const cl = m.chainLightning;
  if (cl) {
    const p = K.lv(g, 'chainLightning');
    if (cl === 'ballLightning' && g.rng() < p.chance * 0.8 && count(g, 'ball') < 5) {
      spawn(g, { k: 'ball', m: 'ballLightning', t: 0, life: 3, x: e.x, y: e.y, zap: 0.15, dmg: raw * 0.45 });
      fxEv(g, api, { m: 'ballLightning', x: e.x, y: e.y });
    } else if (cl === 'arcTether' && g.rng() < p.chance && count(g, 'tether') < 6 && !e.dead) {
      const q = nearest(g, e.x, e.y, 240, e);
      if (q) { spawn(g, { k: 'tether', m: 'arcTether', t: 0, life: 2, a: e, b: q, tk: 0, dmg: raw * p.mul * 0.5 }); fxEv(g, api, { m: 'arcTether', x: e.x, y: e.y, x1: q.x, y1: q.y }); }
    }
  }
}
export function mutOnKill(g, e, api, K) {
  const m = g.mutations;
  if (!m) return;
  if (m.flameBullet === 'wildfire' && e.burnT > 0) { // 들불: 화상이 옮겨붙는다(연쇄)
    const p = K.lv(g, 'flameBullet'), amt = K.pd(g, 0) * p.burn * 2.2 + e.burn * 0.6, pts = [];
    const near = g.enemies.filter(q => q !== e && inReach(q) && (q.x - e.x) ** 2 + (q.y - e.y) ** 2 < 160 * 160)
      .sort((a, b) => (a.x - e.x) ** 2 + (a.y - e.y) ** 2 - ((b.x - e.x) ** 2 + (b.y - e.y) ** 2)).slice(0, 3);
    for (const q of near) { K.burnOn(q, amt, p.dur, 0); pts.push([q.x, q.y]); }
    if (pts.length) fxEv(g, api, { m: 'wildfire', x: e.x, y: e.y, pts });
  }
  const T = timers(g);
  if (m.soulHarvest === 'soulVolley') T.souls = Math.min(24, (T.souls || 0) + 1);
  else if (m.soulHarvest === 'reaper') T.reap = Math.min(20, (T.reap || 0) + 1);
}

// 영구 동토: 얼어붙은 땅 위 이동속도 배율(spells.js frostSlowMul이 곱한다)
export function mutSlow(g, e) {
  const a = g.spellFx && g.spellFx.mut;
  if (!a || !a.length) return 1;
  for (const q of a) if (q.k === 'frost' && (e.x - q.x) ** 2 + ((e.y - q.y) * 1.35) ** 2 <= (q.r + e.r) ** 2) return 0.3;
  return 1;
}
// 저주 장막: 저주 낙인 피해 증가 배율(spells.js curseMul이 곱한다) — 장막 안 ×1.7, 밖 ×0.45
export function mutCurse(g, e) {
  if (!e || !g.mutations || g.mutations.curseMark !== 'hexZone') return 1;
  const y = g.spellFx && g.spellFx.mt && g.spellFx.mt.hexY;
  return y != null && Math.abs(e.y - y) <= HEX_H + e.r ? 1.7 : 0.45;
}
export const HEX_H = 115; // 저주 장막 반높이(렌더러도 쓴다)
export const SPIRITS = { n: 3, cx: WORLD_W / 2, cy: WALL_Y - 175, rx: 300, ry: 78 }; // 바람 정령 궤도(렌더러도 쓴다)
export const spiritAt = (a, k) => { const t = a + k * TAU / SPIRITS.n; return [SPIRITS.cx + Math.cos(t) * SPIRITS.rx, SPIRITS.cy + Math.sin(t) * SPIRITS.ry]; };
export const MIRRORS = [150, 360, 570]; // 얼음 거울 x(렌더러도 쓴다)

// ── 매 프레임(spells.js updateSpells 끝) ──
export function mutTick(g, dt, api, K) {
  const m = g.mutations || {}, T = timers(g), fx = g.spellFx;
  if (T.scorch > 0) T.scorch -= dt;
  const pd = () => K.pd(g, 0);
  // 던전 원소 배율(sim.spellHit): 피해를 내는 동안 g._src = 그 변이의 스킬
  // 지속형·소환형 변이
  g._src = 'frostWard';
  if (m.frostWard === 'permafrost' && g.book.frostWard && (T.pf = (T.pf || 0) - dt) <= 0) {
    T.pf = 1.6;
    const t = K.densest(g, api);
    if (t && !ents(g).some(q => q.k === 'frost' && (q.x - t.x) ** 2 + (q.y - t.y) ** 2 < 80 * 80)) {
      const a = ents(g), old = a.filter(q => q.k === 'frost');
      if (old.length >= 4) a.splice(a.indexOf(old[0]), 1);
      spawn(g, { k: 'frost', m: 'permafrost', t: 0, life: 6, tk: 0, x: t.x, y: t.y, r: 105, dps: pd() * 0.6 });
      fxEv(g, api, { m: 'permafrost', x: t.x, y: t.y });
    }
  }
  if (m.frostWard === 'iceMirror' && g.book.frostWard) mirrorTick(g, dt, api, K, T);
  g._src = 'gale';
  if (m.gale === 'windBlades' && g.book.gale && (T.blade = (T.blade || 0) - dt) <= 0) {
    const t = api.frontMost(g);
    if (!t) T.blade = 0.3;
    else {
      T.blade = 1.05 / K.rate(g);
      const c = mageAt(g, 0), a0 = Math.atan2(t.y - c.y, t.x - c.x);
      for (let k = -1; k <= 1; k++) {
        const a = a0 + k * 0.24;
        spawn(g, { k: 'blade', m: 'windBlades', t: 0, x: c.x, y: c.y - 30, vx: Math.cos(a) * 760, vy: Math.sin(a) * 760, hit: [], dmg: pd() * 0.7 });
      }
      fxEv(g, api, { m: 'windBlades', x: c.x, y: c.y - 30 });
    }
  }
  if (m.gale === 'windSpirits' && g.book.gale) {
    T.wsA = ((T.wsA || 0) + dt * 1.5) % TAU;
    const dmg = pd() * 0.8;
    for (let k = 0; k < SPIRITS.n; k++) {
      const [x, y] = spiritAt(T.wsA, k);
      each(g, x, y, 34, e => {
        if (e._ws > g.phaseT) return;
        e._ws = g.phaseT + 0.45;
        K.sHit(g, api, e, dmg, 0, 'wind');
        knock(g, e, 34);
        fxEv(g, api, { m: 'spiritHit', x: e.x, y: e.y });
      });
    }
  }
  g._src = 'holyLight';
  if (m.holyLight === 'holyPulse' && g.book.holyLight && (T.pulse = (T.pulse || 1) - dt) <= 0) {
    T.pulse = 3;
    spawn(g, { k: 'pulse', m: 'holyPulse', t: 0, life: 1, r: 0, hit: [], dmg: pd() * 1.8 });
    fxEv(g, api, { m: 'holyPulse', x: WORLD_W / 2, y: WALL_Y });
  }
  if (m.holyLight === 'lightWell' && g.book.holyLight) {
    const p = K.lv(g, 'holyLight'), full = g.wall.hp >= g.wall.max - 1e-6;
    T.well = (T.well || 0) + p.rate * dt * (full ? 1 : 0.35);
    if (T.well >= 0.11) {
      const front = g.enemies.filter(inReach).sort((a, b) => b.y - a.y).slice(0, 5);
      if (front.length) {
        T.well = 0;
        front.forEach((e, i) => spawn(g, { k: 'spear', m: 'lightWell', t: -0.08 * i, e, dmg: pd() * 2.6 }));
        fxEv(g, api, { m: 'lightWell', x: WORLD_W / 2, y: WALL_Y - 70 });
      } else T.well = 0.11;
    }
  }
  g._src = 'curseMark';
  if (m.curseMark === 'doomMark' && g.book.curseMark && (T.doom = (T.doom || 0) - dt) <= 0) {
    T.doom = 2.2;
    let t = null;
    for (const e of g.enemies) if (inReach(e) && !e._doom && (!t || power(e) > power(t))) t = e;
    if (t) { t._doom = true; spawn(g, { k: 'doom', m: 'doomMark', t: 0, life: 3, e: t, hp0: t.hp + t.shield }); fxEv(g, api, { m: 'doomMark', x: t.x, y: t.y }); }
  }
  if (m.curseMark === 'hexZone' && g.book.curseMark && (T.hexT = (T.hexT || 0) - dt) <= 0) {
    T.hexT = 0.5;
    const t = K.densest(g, api);
    T.hexTo = t ? t.y : T.hexTo ?? (FRONT_Y + 200);
  }
  if (m.curseMark === 'hexZone') {
    if (T.hexY == null) { T.hexY = T.hexTo ?? FRONT_Y + 200; fxEv(g, api, { m: 'hexZone', y: T.hexY }); } // 장막이 펼쳐진다(스테이지마다)
    else T.hexY += ((T.hexTo ?? T.hexY) - T.hexY) * Math.min(1, dt * 2);
  }
  g._src = 'soulHarvest';
  if (m.soulHarvest === 'soulVolley' && T.souls >= 12 && g.enemies.some(inReach)) {
    T.souls -= 12;
    const c = mageAt(g, 0);
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * 0.35;
      spawn(g, { k: 'soul', m: 'soulVolley', t: 0, x: c.x + Math.cos(a) * 40, y: c.y - 60, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, tgt: null, dmg: pd() * 2.2 });
    }
    fxEv(g, api, { m: 'soulVolley', x: c.x, y: c.y - 60 });
  }
  if (m.soulHarvest === 'reaper' && T.reap >= 10) {
    const t = K.densest(g, api);
    if (t) {
      T.reap -= 10;
      const dir = t.x < WORLD_W / 2 ? 1 : -1;
      spawn(g, { k: 'reap', m: 'reaper', t: 0, x: dir > 0 ? -80 : WORLD_W + 80, y: t.y, vx: dir * 950, hit: [], dmg: pd() * 2.6 });
      fxEv(g, api, { m: 'reaper', x: WORLD_W / 2, y: t.y, dir });
    }
  }
  g._src = 'babyDragon';
  if (m.babyDragon && g.book.babyDragon) dragonTick(g, dt, api, K, T, m.babyDragon);
  else if (T.d2) T.d2 = null;
  g._src = 'stoneGolem';
  if (m.stoneGolem && g.book.stoneGolem && fx.golem) golemTick(g, dt, api, K, T, m.stoneGolem);
  // 회오리·폭풍의 눈 변이의 움직임(기본 moveTornadoes · updateStorms가 피해·밀치기를 처리)
  for (const tn of fx.tornadoes) {
    if (tn.mut === 'firewalker') {
      const e = nearest(g, tn.x, tn.y);
      if (e) { const dx = e.x - tn.x, dy = e.y - tn.y, d = Math.hypot(dx, dy) || 1, s = Math.min(d, 125 * dt); tn.x += dx / d * s; tn.y = Math.max(FRONT_Y + 10, tn.y + dy / d * s); }
    } else if (tn.mut === 'infernoRing') {
      tn.a += dt * 2.3;
      tn.x = tn.cx + Math.cos(tn.a) * 125; tn.y = Math.max(FRONT_Y + 10, tn.cy + Math.sin(tn.a) * 72);
    }
  }
  for (const s of fx.storms) if (s.vx) { s.x += s.vx * dt; if (s.x < 40 || s.x > WORLD_W - 40) s.vx = -s.vx; }
  // 전장 물체
  const a = ents(g);
  for (let i = a.length - 1; i >= 0; i--) {
    const q = a[i];
    q.t += dt;
    g._src = MUT_BY_KEY[q.m].skill;
    if (ENT[q.k](g, q, dt, api, K) === false) a.splice(i, 1);
  }
  g._src = null;
}

// 얼음 거울: 결계 안으로 들어온 적 투사체를 되쏜다 + 성벽을 치는 적에게 냉기 반격
function mirrorTick(g, dt, api, K, T) {
  const p = K.lv(g, 'frostWard'), top = WALL_Y - p.r * 0.55, s = g.eshots, pd = K.pd(g, 0);
  for (let k = s.length - 1; k >= 0; k--) {
    const q = s[k];
    if (q.y < top) continue;
    s[k] = s[s.length - 1]; s.pop();
    spawn(g, { k: 'shard', m: 'iceMirror', t: 0, x: q.x, y: q.y, vx: -q.vx * 1.3, vy: -Math.abs(q.vy) * 1.7 - 200, dmg: pd * 2.2 });
    fxEv(g, api, { m: 'mirrorFlash', x: q.x, y: q.y });
  }
  if ((T.thorn = (T.thorn || 0) - dt) > 0) return;
  T.thorn = 0.8;
  for (const e of g.enemies) {
    if (e.dead || e.state !== 'attack') continue;
    K.sHit(g, api, e, pd * 1.2, 0, 'frost');
    stun(e, 0.4);
    fxEv(g, api, { m: 'mirrorThorn', x: e.x, y: e.y });
  }
}

// 새끼 드래곤 변이: 쌍둥이(용 둘이 번갈아 브레스) · 급강하(브레스 대신 무리로 내리꽂힘). fx.dragon = 첫 용(units.drawDragon), T.d2 = 둘째 용(mutfx)
function dragonTick(g, dt, api, K, T, mk) {
  const fx = g.spellFx, p = K.lv(g, 'babyDragon'), rate = K.rate(g);
  let d = fx.dragon;
  if (!d) d = fx.dragon = { x: WORLD_W / 2, y: 140, vx: 120, angle: 0, breathT: 0 };
  if (mk === 'twinDragons') {
    let d2 = T.d2;
    if (!d2) d2 = T.d2 = { x: WORLD_W / 2 - 160, y: 250, vx: -140, angle: Math.PI, breathT: 0, cdT: p.cd / 2 };
    for (const q of [d, d2]) {
      q.x += q.vx * dt;
      if (q.x < 90) { q.x = 90; q.vx = Math.abs(q.vx); } else if (q.x > WORLD_W - 90) { q.x = WORLD_W - 90; q.vx = -Math.abs(q.vx); }
      q.angle = q.vx > 0 ? 0 : Math.PI;
      if (q.breathT > 0) {
        q.breathT -= dt;
        const dmg = K.pd(g, 0) * p.mul * 0.62 * dt;
        for (const e of g.enemies) if (inReach(e) && Math.abs(e.x - q.x) <= 70 && e.y >= q.y) K.sHit(g, api, e, dmg, 0, 'fire', true);
        continue;
      }
      if ((q.cdT = (q.cdT ?? 0) - dt) <= 0) {
        q.cdT = p.cd / rate;
        q.breathT = p.breathT;
        api.emit(g, { type: 'spell', key: 'babyDragon', o: 0, x: q.x, y: q.y, lv: SPELL_MAX_LV, mut: 'twinDragons' });
      }
    }
    return;
  }
  // 급강하: 순찰 → 가장 밀집한 무리로 0.45초 급강하 → 폭발 → 0.6초 상승
  T.d2 = null;
  d.breathT = 0;
  if (!d.st) { d.st = 'fly'; d.cdT = 1; }
  if (d.st === 'fly') {
    d.x += d.vx * dt;
    if (d.x < 90) { d.x = 90; d.vx = 120; } else if (d.x > WORLD_W - 90) { d.x = WORLD_W - 90; d.vx = -120; }
    d.y += (140 - d.y) * Math.min(1, dt * 3);
    d.angle = d.vx > 0 ? 0 : Math.PI;
    if ((d.cdT -= dt) <= 0) {
      const t = K.densest(g, api);
      if (!t) { d.cdT = 0.3; return; }
      d.st = 'dive'; d.u = 0; d.x0 = d.x; d.y0 = d.y; d.tx = t.x; d.ty = t.y;
      d.angle = t.x >= d.x ? 0 : Math.PI;
      fxEv(g, api, { m: 'diveStart', x: d.x, y: d.y, x1: t.x, y1: t.y });
    }
  } else if (d.st === 'dive') {
    d.u = Math.min(1, d.u + dt / 0.45);
    const e2 = d.u * d.u;
    d.x = d.x0 + (d.tx - d.x0) * e2; d.y = d.y0 + (d.ty - d.y0) * e2;
    if (d.u >= 1) {
      const dmg = K.pd(g, 0) * p.mul * 1.5;
      each(g, d.x, d.y, 120, e => { K.sHit(g, api, e, dmg, 0, 'fire'); if (!e.dead) K.burnOn(e, dmg * 0.3, 2, 0); });
      fxEv(g, api, { m: 'diveBoom', x: d.x, y: d.y, r: 120 });
      d.st = 'up'; d.u = 0; d.x0 = d.x; d.y0 = d.y;
    }
  } else {
    d.u = Math.min(1, d.u + dt / 0.6);
    d.y = d.y0 + (140 - d.y0) * (1 - (1 - d.u) ** 2);
    d.x += d.vx * dt * 0.5;
    if (d.u >= 1) { d.st = 'fly'; d.cdT = p.cd * 2.3 / rate; }
  }
}

// 돌 골렘 변이: 대지 강타(무리 앞으로 걸어가 내려찍기) · 파편 재조립(부서지면 폭발 → 5초 뒤 재조립 + 가시 반격)
function golemTick(g, dt, api, K, T, mk) {
  const gl = g.spellFx.golem, pd = K.pd(g, 0);
  if (mk === 'golemSmash') {
    if (gl.hp <= 0) return;
    const t = K.densest(g, api), hx = WORLD_W / 2, hy = WALL_Y - 70;
    const tx = t ? t.x : hx, ty = t ? Math.max(560, Math.min(hy, t.y + 70)) : hy;
    const dx = tx - gl.x, dy = ty - gl.y, d = Math.hypot(dx, dy);
    if (d > 6) { const s = Math.min(d, 75 * dt); gl.x += dx / d * s; gl.y += dy / d * s; }
    if ((T.smash = (T.smash ?? 1.2) - dt) > 0) return;
    if (!g.enemies.some(e => inReach(e) && (e.x - gl.x) ** 2 + (e.y - gl.y) ** 2 < 170 * 170)) { T.smash = 0.25; return; }
    T.smash = 2.3 / K.rate(g);
    each(g, gl.x, gl.y + 30, 140, e => { K.sHit(g, api, e, pd * 2.4, 0, 'summon'); stun(e, 0.5); });
    fxEv(g, api, { m: 'golemSmash', x: gl.x, y: gl.y + 34, r: 140 });
    return;
  }
  if (gl.hp <= 0) {
    if (!(T.reT > 0)) {
      T.reT = 5;
      each(g, gl.x, gl.y, 170, e => { K.sHit(g, api, e, pd * 6, 0, 'summon'); stun(e, 0.8); });
      fxEv(g, api, { m: 'golemBoom', x: gl.x, y: gl.y + 20, r: 170 });
    } else if ((T.reT -= dt) <= 0) {
      T.reT = 0;
      gl.hp = gl.maxHp * 0.7;
      fxEv(g, api, { m: 'golemReform', x: gl.x, y: gl.y + 30 });
    }
    return;
  }
  if ((T.spike = (T.spike || 0) - dt) > 0) return;
  T.spike = 0.9;
  for (const e of g.enemies) {
    if (e.dead || e.state !== 'attack') continue;
    K.sHit(g, api, e, pd * 0.9, 0, 'summon');
    fxEv(g, api, { m: 'golemSpike', x: gl.x, y: gl.y - 40, x1: e.x, y1: e.y });
  }
}

// ── 전장 물체 갱신: false를 돌려주면 사라진다 ──
const tick = (q, dt, iv) => { if ((q.tk -= dt) > 0) return false; q.tk += iv; return true; };
const ENT = {
  blast(g, q, dt, api, K) { // 분열 화염구: 착탄 뒤 연쇄 폭발
    if (q.t < 0) return true;
    each(g, q.x, q.y, q.r, e => K.sHit(g, api, e, q.dmg, q.o, 'fire', true));
    fxEv(g, api, { m: 'splitChain', x: q.x, y: q.y, r: q.r });
    return false;
  },
  sun(g, q, dt, api, K) { // 태양 구체: 떠오르며 관통해 태운다
    q.x += (q.tx - q.x) * Math.min(1, dt * 1.6);
    q.y -= 130 * dt;
    const dmg = q.dps * dt;
    each(g, q.x, q.y, q.r, e => { K.sHit(g, api, e, dmg, q.o, 'fire', true); K.burnOn(e, dmg * 0.25, 1.5, q.o); });
    return q.y > FRONT_Y - 40 && q.t < 7;
  },
  patch(g, q, dt, api, K) { // 불바다
    if (tick(q, dt, 0.25)) each(g, q.x, q.y, q.r, e => { K.sHit(g, api, e, q.dps * 0.25, 0, 'fire', true); K.burnOn(e, q.dps * 0.1, 1, 0); });
    return q.t < q.life;
  },
  bolt(g, q, dt, api, K) { // 천벌: 같은 적에게 연달아
    if (q.t < 0) return true;
    let e = q.e;
    if (!e || e.dead) e = strongest(g);
    if (!e) return false;
    K.sHit(g, api, e, q.dmg, q.o, 'lightning');
    stun(e, 0.12);
    if (q.i === 0) api.emit(g, { type: 'spell', key: 'lightningStrike', o: q.o, x: e.x, y: e.y, lv: SPELL_MAX_LV, mut: 'focusBolt' });
    fxEv(g, api, { m: 'focusBolt', x: e.x, y: e.y, i: q.i });
    return false;
  },
  cloud(g, q, dt, api, K) { // 뇌운: 무리를 따라다니며 벼락
    if ((q.re -= dt) <= 0) {
      q.re = 0.5;
      let best = null, bn = 0;
      for (const e of g.enemies) {
        if (!inReach(e) || (e.x - q.x) ** 2 + (e.y - q.y) ** 2 > 260 * 260) continue;
        let n = 0;
        for (const o of g.enemies) if (!o.dead && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 110 * 110) n++;
        if (n > bn) { bn = n; best = e; }
      }
      if (best) { q.tx = best.x; q.ty = best.y; }
    }
    const k = Math.min(1, dt * 1.2);
    q.x += (q.tx - q.x) * k; q.y += (q.ty - q.y) * k;
    if ((q.zap -= dt) <= 0) {
      q.zap = 0.13;
      let pick = null, n = 0;
      for (const e of g.enemies) if (inReach(e) && (e.x - q.x) ** 2 + (e.y - q.y) ** 2 <= (q.r + e.r) ** 2 && g.rng() < 1 / ++n) pick = e;
      if (pick) { K.sHit(g, api, pick, q.dmg, q.o, 'lightning', true); fxEv(g, api, { m: 'cloudZap', x: pick.x, y: pick.y, cx: q.x, cy: q.y }); }
    }
    return q.t < q.life;
  },
  ball(g, q, dt, api, K) { // 구전: 다가가며 주변을 지진다
    const e = nearest(g, q.x, q.y, 400);
    if (e) { const dx = e.x - q.x, dy = e.y - q.y, d = Math.hypot(dx, dy) || 1; if (d > 20) { q.x += dx / d * 95 * dt; q.y += dy / d * 95 * dt; } }
    if ((q.zap -= dt) <= 0) {
      q.zap = 0.3;
      const pts = [];
      each(g, q.x, q.y, 75, o => { K.sHit(g, api, o, q.dmg, 0, 'lightning', true); if (pts.length < 4) pts.push([o.x, o.y]); });
      if (pts.length) fxEv(g, api, { m: 'ballZap', x: q.x, y: q.y, pts });
    }
    return q.t < q.life;
  },
  tether(g, q, dt, api, K) { // 전류 사슬: 두 적을 잇는 전류
    if (q.a.dead || q.b.dead) {
      const live = q.a.dead ? q.b : q.a, dead = q.a.dead ? q.a : q.b;
      if (live.dead) return false;
      const n = nearest(g, dead.x, dead.y, 240, live);
      if (!n) return false;
      if (q.a === dead) q.a = n; else q.b = n;
    }
    if (tick(q, dt, 0.25)) {
      const { a, b } = q;
      for (const e of g.enemies) if (!e.dead && (e === a || e === b || segD2(e.x, e.y, a.x, a.y, b.x, b.y) <= (18 + e.r) ** 2)) K.sHit(g, api, e, q.dmg, 0, 'lightning', true);
    }
    return q.t < q.life;
  },
  glacier(g, q, dt, api, K) { // 빙하 창: 얼리며 관통 → 끝에서 파편
    q.x += q.vx * dt; q.y += q.vy * dt;
    for (const e of g.enemies) {
      if (e.dead || q.hit.includes(e.id) || (e.x - q.x) ** 2 + (e.y - q.y) ** 2 > (e.r + 26) ** 2) continue;
      q.hit.push(e.id);
      K.sHit(g, api, e, q.dmg, q.o, 'frost');
      if (!e.dead) { stun(e, 1); e.slowT = Math.max(e.slowT, 2.5); }
    }
    if (q.t < 1.8 && q.y > FRONT_Y - 30 && q.x > -20 && q.x < WORLD_W + 20) return true;
    for (let k = 0; k < 6; k++) {
      const a = k * TAU / 6 + 0.3;
      g.spellFx.lances.push({ x: q.x, y: q.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, dmg: q.dmg * 0.3, hit: [], life: 0.9, o: q.o, pierce: 2, mut: 'glacierShard' });
    }
    fxEv(g, api, { m: 'glacierShatter', x: q.x, y: q.y });
    return false;
  },
  frost(g, q, dt, api, K) { // 영구 동토
    if (tick(q, dt, 0.3)) for (const e of g.enemies) if (!e.dead && (e.x - q.x) ** 2 + ((e.y - q.y) * 1.35) ** 2 <= (q.r + e.r) ** 2) K.sHit(g, api, e, q.dps * 0.3, 0, 'frost', true);
    return q.t < q.life;
  },
  shard(g, q, dt, api, K) { // 얼음 거울이 되쏜 투사체
    q.x += q.vx * dt; q.y += q.vy * dt;
    for (const e of g.enemies) {
      if (e.dead || (e.x - q.x) ** 2 + (e.y - q.y) ** 2 > (e.r + 10) ** 2) continue;
      K.sHit(g, api, e, q.dmg, 0, 'frost');
      stun(e, 0.5);
      fxEv(g, api, { m: 'shardHit', x: e.x, y: e.y });
      return false;
    }
    return q.t < 1.6 && q.y > FRONT_Y - 60;
  },
  vortex(g, q, dt, api, K) { // 진공 소용돌이: 빨아들이고 → 폭발
    pull(g, q.x, q.y, q.r, 115, dt);
    if (tick(q, dt, 0.2)) each(g, q.x, q.y, q.r * 0.7, e => K.sHit(g, api, e, q.dps * 0.2, q.o, 'wind', true));
    if (q.t < q.life) return true;
    each(g, q.x, q.y, q.r * 0.8, e => { K.sHit(g, api, e, q.burst, q.o, 'wind'); knock(g, e, 80); });
    fxEv(g, api, { m: 'vortexBurst', x: q.x, y: q.y, r: q.r * 0.8 });
    return false;
  },
  blade(g, q, dt, api, K) { // 바람 칼날: 관통 + 살짝 밀침
    q.x += q.vx * dt; q.y += q.vy * dt;
    for (const e of g.enemies) {
      if (e.dead || q.hit.includes(e.id) || (e.x - q.x) ** 2 + (e.y - q.y) ** 2 > (e.r + 16) ** 2) continue;
      q.hit.push(e.id);
      K.sHit(g, api, e, q.dmg, 0, 'wind');
      knock(g, e, 18);
    }
    return q.t < 1.3 && q.y > FRONT_Y - 60 && q.x > -40 && q.x < WORLD_W + 40;
  },
  pulse(g, q, dt, api, K) { // 성역 파동: 성벽 가운데에서 퍼지는 고리
    const u = q.t / q.life;
    q.r = 640 * (1 - (1 - Math.min(1, u)) ** 2);
    const cx = WORLD_W / 2, cy = WALL_Y;
    for (const e of g.enemies) {
      if (e.dead || q.hit.includes(e.id)) continue;
      const d = Math.hypot(e.x - cx, (e.y - cy) * 1.6);
      if (d > q.r + e.r) continue;
      q.hit.push(e.id);
      K.sHit(g, api, e, q.dmg, 0, 'holy');
      knock(g, e, 45);
    }
    return u < 1;
  },
  spear(g, q, dt, api, K) { // 빛의 샘 창
    if (q.t < 0) return true;
    const e = q.e && !q.e.dead ? q.e : api.frontMost(g);
    if (!e) return false;
    K.sHit(g, api, e, q.dmg, 0, 'holy');
    fxEv(g, api, { m: 'wellSpear', x0: WORLD_W / 2, y0: WALL_Y - 70, x: e.x, y: e.y });
    return false;
  },
  ray(g, q, dt, api, K) { // 쓸어내는 광선
    q.x += q.vx * dt;
    if (tick(q, dt, 0.12)) for (const e of g.enemies) if (!e.dead && e.y >= FRONT_Y - 20 && Math.abs(e.x - q.x) <= q.w / 2 + e.r) K.sHit(g, api, e, q.dps * 0.12, q.o, 'holy', true);
    return q.t < q.life && q.x > -60 && q.x < WORLD_W + 60;
  },
  doom(g, q, dt, api, K) { // 파멸 낙인: 3초 뒤(또는 쓰러지면) 받은 피해의 일부가 폭발
    const e = q.e;
    if (!e.dead && q.t < q.life) { q.x = e.x; q.y = e.y; return true; }
    e._doom = false;
    const taken = Math.max(0, q.hp0 - Math.max(0, e.hp) - Math.max(0, e.shield)), dmg = taken * 0.45 + K.pd(g, 0) * 1.2;
    each(g, e.x, e.y, 125, o => { if (o !== e) K.sHit(g, api, o, dmg, 0, 'dark'); });
    fxEv(g, api, { m: 'doomBoom', x: e.x, y: e.y, r: 125 });
    return false;
  },
  soul(g, q, dt, api, K) { // 영혼 일제 사격: 추적
    let t = q.tgt;
    if (!t || t.dead) t = q.tgt = nearest(g, q.x, q.y);
    if (t) {
      const dx = t.x - q.x, dy = t.y - q.y, d = Math.hypot(dx, dy) || 1, sp = 540, turn = Math.min(1, dt * (q.t < 0.25 ? 2 : 9));
      q.vx += (dx / d * sp - q.vx) * turn; q.vy += (dy / d * sp - q.vy) * turn;
      if (d < t.r + 12) { K.sHit(g, api, t, q.dmg, 0, 'dark'); fxEv(g, api, { m: 'soulHit', x: t.x, y: t.y }); return false; }
    }
    q.x += q.vx * dt; q.y += q.vy * dt;
    return q.t < 3;
  },
  reap(g, q, dt, api, K) { // 사신의 낫: 한 줄 처형
    q.x += q.vx * dt;
    for (const e of g.enemies) {
      if (e.dead || q.hit.includes(e.id) || Math.abs(e.y - q.y) > 75 + e.r || Math.abs(e.x - q.x) > 50 + e.r) continue;
      q.hit.push(e.id);
      if (!e.isBoss && e.hp <= e.maxHp * 0.2) {
        const pv = g._skill; g._skill = true;
        api.damage(g, e, 1e15, 0);
        g._skill = pv;
        g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * 0.005);
        fxEv(g, api, { m: 'reapKill', x: e.x, y: e.y });
      } else K.sHit(g, api, e, q.dmg, 0, 'dark');
    }
    return q.x > -120 && q.x < WORLD_W + 120;
  },
  prison(g, q, dt, api, K) { // 얼음 감옥: 깨지면 파편
    const e = q.e;
    if (!e.dead && q.t < q.life) { q.x = e.x; q.y = e.y; return true; }
    each(g, q.x, q.y, 90, o => { if (o !== e) K.sHit(g, api, o, q.dmg, 0, 'frost'); });
    if (!e.dead) K.sHit(g, api, e, q.dmg, 0, 'frost');
    fxEv(g, api, { m: 'prisonBreak', x: q.x, y: q.y });
    return false;
  },
  geyser(g, q, dt, api, K) { // 간헐천: 0.5초마다 분출
    if (tick(q, dt, 0.5)) {
      each(g, q.x, q.y, q.r, e => { K.sHit(g, api, e, q.dmg, 0, 'fire'); if (!e.dead) { K.burnOn(e, q.dmg * 0.3, 2, 0); e.slowT = Math.max(e.slowT, 1.2); } });
      fxEv(g, api, { m: 'geyserErupt', x: q.x, y: q.y, r: q.r });
    }
    return q.t < q.life;
  },
  press(g, q, dt, api, K) { // 압력 폭발: 빨아들이고 → 폭발
    pull(g, q.x, q.y, q.r, 140, dt);
    if (q.t < q.life) return true;
    each(g, q.x, q.y, q.br, e => { K.sHit(g, api, e, q.dmg, 0, 'fire'); if (!e.dead) { K.burnOn(e, q.dmg * 0.3, 2, 0); e.slowT = Math.max(e.slowT, 1.5); } });
    api.emit(g, { type: 'spell', key: 'steamBurst', shape: 'steamNova', o: 0, x: q.x, y: q.y, r: q.br, lv: SPELL_MAX_LV, mut: 'pressure' });
    fxEv(g, api, { m: 'pressBoom', x: q.x, y: q.y, r: q.br });
    return false;
  },
  link(g, q, dt, api, K) { // 쌍둥이 눈 번개 다리
    if (tick(q, dt, 0.25)) {
      const { a, b } = q;
      for (const e of g.enemies) if (!e.dead && segD2(e.x, e.y, a.x, a.y, b.x, b.y) <= (22 + e.r) ** 2) K.sHit(g, api, e, q.dmg, 0, 'lightning', true);
    }
    return q.t < q.life;
  },
  eclipse(g, q, dt, api, K) { // 일식: 검은 해가 광선 난사
    const t = nearest(g, q.x, q.y + 150, 320);
    if (t) q.x += (t.x - q.x) * Math.min(1, dt * 0.8);
    if (tick(q, dt, 0.16)) {
      let pick = null, n = 0;
      for (const e of g.enemies) if (inReach(e) && (e.x - q.x) ** 2 + (e.y - q.y - 120) ** 2 < 260 * 260 && g.rng() < 1 / ++n) pick = e;
      if (pick) {
        K.sHit(g, api, pick, q.dmg, 0, 'dark');
        if (!pick.dead) pick.cursed = true;
        fxEv(g, api, { m: 'eclipseRay', x0: q.x, y0: q.y, x: pick.x, y: pick.y });
      }
    }
    return q.t < q.life;
  },
  dusk(g, q, dt, api, K) { // 황혼의 물결
    q.y += q.vy * dt;
    for (const e of g.enemies) {
      if (e.dead || q.hit.includes(e.id) || Math.abs(e.y - q.y) > 28 + e.r) continue;
      q.hit.push(e.id);
      K.sHit(g, api, e, q.dmg, 0, 'dark');
      if (!e.dead) { e.cursed = true; knock(g, e, 30); }
    }
    return q.y > FRONT_Y - 30;
  },
  mine(g, q, dt, api, K) { // 플라즈마 지뢰
    let boom = q.t >= q.life;
    if (!boom && q.t > 0.35) for (const e of g.enemies) if (!e.dead && (e.x - q.x) ** 2 + (e.y - q.y) ** 2 < (44 + e.r) ** 2) { boom = true; break; }
    if (!boom) return true;
    let first = null;
    each(g, q.x, q.y, q.r, e => { K.sHit(g, api, e, q.dmg, 0, 'lightning'); if (!first && !e.dead) first = e; });
    if (first) api.chainArc(g, first, q.dmg * 0.5, 0, q.n);
    fxEv(g, api, { m: 'mineBoom', x: q.x, y: q.y, r: q.r });
    return false;
  },
  knight(g, q, dt, api, K) { // 망령 기사: 적 사이를 누비며 벤다
    let t = q.tgt;
    if (!t || t.dead || !inReach(t)) t = q.tgt = nearest(g, q.x, q.y);
    if (t) {
      const dx = t.x - q.x, dy = t.y + t.r * 0.3 - q.y, d = Math.hypot(dx, dy) || 1;
      q.face = dx >= 0 ? 1 : -1;
      if (d > 36) { const s = Math.min(d - 30, 175 * dt); q.x += dx / d * s; q.y += dy / d * s; }
    }
    if ((q.atk -= dt) <= 0 && t && (t.x - q.x) ** 2 + (t.y - q.y) ** 2 < 70 * 70) {
      q.atk = 0.45;
      each(g, q.x + q.face * 20, q.y, 60, e => K.sHit(g, api, e, q.dmg, 0, 'dark'));
      fxEv(g, api, { m: 'knightSlash', x: q.x + q.face * 20, y: q.y, face: q.face });
    }
    return q.t < q.life;
  },
  charge(g, q, dt, api, K) { // 유령 돌격: 세로로 일제 관통
    q.y += q.vy * dt;
    for (const e of g.enemies) {
      if (e.dead || q.hit.includes(e.id) || Math.abs(e.y - q.y) > 26 + e.r) continue;
      if (!q.xs.some(x => Math.abs(e.x - x) <= 26 + e.r)) continue;
      q.hit.push(e.id);
      K.sHit(g, api, e, q.dmg, 0, 'dark');
    }
    return q.y > FRONT_Y - 40;
  },
  aegis(g, q, dt, api, K) { // 용의 비호: 성벽 앞 화염 장막 + 투사체 차단 + 치유
    q.x = WORLD_W / 2 + Math.sin(q.t * 2.1) * 250;
    const w = g.wall;
    w.hp = Math.min(w.max, w.hp + w.max * q.heal / q.life * dt);
    const gl = g.spellFx.golem;
    if (gl && gl.hp > 0) gl.hp = Math.min(gl.maxHp, gl.hp + gl.maxHp * q.heal / q.life * dt);
    if (tick(q, dt, 0.2)) for (const e of g.enemies) if (!e.dead && e.y >= WALL_Y - 200) K.sHit(g, api, e, q.dps * 0.2, 0, 'fire', true);
    const s = g.eshots;
    for (let k = s.length - 1; k >= 0; k--) if (s[k].y > WALL_Y - 220) { fxEv(g, api, { m: 'aegisBlock', x: s[k].x, y: s[k].y }); s[k] = s[s.length - 1]; s.pop(); }
    return q.t < q.life;
  },
  star(g, q, dt, api, K) { // 성룡 낙하
    if (q.e && !q.e.dead) { q.x = q.e.x; q.y = q.e.y; }
    if (q.t < 0) return true;
    const e = q.e && !q.e.dead ? q.e : null;
    if (e) K.sHit(g, api, e, q.dmg, 0, 'holy');
    each(g, q.x, q.y, 180, o => { if (o !== e) { K.sHit(g, api, o, q.dmg * 0.4, 0, 'holy'); knock(g, o, 40); } });
    g.wall.hp = Math.min(g.wall.max, g.wall.hp + g.wall.max * q.heal);
    fxEv(g, api, { m: 'starfallBoom', x: q.x, y: q.y, r: 180 });
    return false;
  },
};

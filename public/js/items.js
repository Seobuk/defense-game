// 장비 v0.1.7 — 굴림(품질 q · 아이템 레벨) · 부옵션 풀 · 고유 옵션(전설·영웅) · 세트 · 효과 합산 · 저장 이전. DOM 없음.
// 계약: docs/DESIGN.md 'v0.1.7 장비 계약'. hero.js를 import하지 않는다(hero.js가 SLOTS·RARITIES·rollItem·itemPower를 재수출 — 순환 없음).
// 강화는 없다(사용자 규칙). 기쁨 = 굴림 · 등급 · 고유 옵션 · 세트.
import { clamp } from './util.js';
import { skillElements } from './dungeons.js';

export const ITEM_VER = 2;
export const ITEM_TEST = { off: false, noUniq: false, noAffix: false }; // 밸런스 A/B 전용(PATH_TEST와 같은 방식): off = v0.1.6 장비(부옵션 6종 · 고유·세트·효과 없음) · noUniq = 고유 효과만 끔 · noAffix = 새 부옵션 효과만 끔
export const TOP_Q = 0.9;          // 굴림 품질이 이 이상이면 '최고 굴림'(UI 금색)
export const MAX_ILVL = 100;
export const SET_MIN_ILVL = 8, SET_CHANCE = 0.22; // 세트 조각: 희귀·영웅, 8층부터
export const epicUniqChance = ilvl => 0.25 + 0.25 * clamp(ilvl, 1, MAX_ILVL) / MAX_ILVL; // 영웅 등급의 약한 고유 옵션 확률
export const ilvlScale = ilvl => 1 + (clamp(ilvl, 1, MAX_ILVL) - 1) * 0.008; // ponytail: 완만하게 — 아이템 운이 밸런스를 크게 흔들지 않게

// ── 부위 · 등급 ──
export const SLOTS = ['weapon', 'helm', 'armor', 'trinket', 'cape'];
export const SLOT_NAMES = { weapon: '무기', helm: '머리', armor: '갑옷', trinket: '장신구', cape: '망토' };
export const SLOT_MAIN_KEY = { weapon: 'atkPct', helm: 'heroHpPct', armor: 'dmgReducePct', trinket: 'critDmgPct', cape: 'atkSpeedPct' };
export const MAIN_NAMES = { atkPct: '영웅 공격력', heroHpPct: '영웅 체력', dmgReducePct: '피해 감소', critDmgPct: '치명타 피해', atkSpeedPct: '영웅 공격 속도' };
const WEAPON = { knight: '검', ranger: '활', sorcerer: '지팡이', cleric: '철퇴', assassin: '단검' }; // hero.js HERO_CLASSES.weapon과 같게
const NOUN = { helm: '투구', armor: '갑옷', trinket: '부적', cape: '망토' };
export const ITEM_NOUN = (slot, cls) => (slot === 'weapon' ? WEAPON[cls] || WEAPON.knight : NOUN[slot]);

export const RARITIES = [
  { key: 'common', name: '일반', color: '#b7bdc6', mainMul: 1, subMul: 1, subN: [0, 1] },
  { key: 'uncommon', name: '고급', color: '#4ade80', mainMul: 1.15, subMul: 1.2, subN: [0, 2] },
  { key: 'rare', name: '희귀', color: '#60a5fa', mainMul: 1.35, subMul: 1.5, subN: [1, 2] },
  { key: 'epic', name: '영웅', color: '#c084fc', mainMul: 1.6, subMul: 2, subN: [2, 3] },
  { key: 'legend', name: '전설', color: '#fbbf24', mainMul: 1.9, subMul: 2.8, subN: [3, 3] },
];
export const RARITY_KEYS = RARITIES.map(r => r.key);
const RARITY_BY_KEY = Object.fromEntries(RARITIES.map(r => [r.key, r]));

// 등급별 드롭 가중치. boss = 확정 희귀 이상
// v0.1.7: 전설은 고유 옵션을 품어 더 귀하게(v0.1.6 대비 전설 가중치 약 0.55배 — 캠페인 A/B로 맞춤, docs 'v0.1.7 장비 계약' 밸런스)
const DROP_WEIGHTS = {
  normal: [70, 22, 6, 1.8, 0.1],
  elite: [28, 30, 26, 13, 1.6],
  boss: [0, 0, 45, 40, 8],
  chest: [15, 26, 32, 20, 4],
};
// 드롭(문자열 source)의 전설은 낮은 층에서 드물게: 4층 이하 10% → 20층부터 그대로. 전설 고유가 첫 도전 초반을 한 번에 뒤집지 않게(상자 가중치 배열은 그대로)
export const legendGate = ilvl => clamp((ilvl - 4) / 16, 0.1, 1);
function pickRarity(source, rng, ilvl = MAX_ILVL) {
  let w = Array.isArray(source) ? source : DROP_WEIGHTS[source] || DROP_WEIGHTS.normal; // 배열 = 직접 가중치(shop.js 장비 상자)
  if (!Array.isArray(source) && !ITEM_TEST.off) { w = w.slice(); w[4] *= legendGate(ilvl); }
  let sum = 0;
  for (const x of w) sum += x;
  let x = rng() * sum;
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x < 0) return RARITY_KEYS[i]; }
  return RARITY_KEYS[RARITY_KEYS.length - 1];
}

// ── 주옵션 · 부옵션 풀 ──
const MAIN_RANGE = { atkPct: [8, 16], heroHpPct: [10, 18], dmgReducePct: [4, 9], critDmgPct: [12, 22], atkSpeedPct: [6, 13] };
const MAIN_POWER_W = { atkPct: 3.5, heroHpPct: 2.5, dmgReducePct: 5, critDmgPct: 3, atkSpeedPct: 3.5 };
// base = 기본 범위(%, × 등급 subMul × ilvlScale) · pw = 전투력 가중치 · scope = hero.js SUBSTATS 호환
// 효과 통로: el(원소 스킬 피해 — sim spellHit) · sk(그 스킬 쿨타임 — spells.js tick) · tb(영웅 특성 효과 키 — hero.js heroTb). 없으면 hero.js gearBonuses가 쓴다(기존 6종)
// gold/mana/spell/원소는 전역 경제·화력에 복리로 붙으므로 낮게
export const AFFIXES = [
  { key: 'gold', name: '처치 골드', base: [1, 2.5], pw: 2, scope: 'global' },
  { key: 'boss', name: '보스 피해', base: [5, 10], pw: 2, scope: 'hero' },
  { key: 'mana', name: '마나 충전', base: [1, 2.5], pw: 2, scope: 'global' },
  { key: 'spell', name: '스킬 피해', base: [1, 2.5], pw: 2, scope: 'global' },
  { key: 'crit', name: '치명타 확률', base: [2, 5], pw: 2, scope: 'hero' },
  { key: 'heroHp', name: '체력', base: [5, 10], pw: 2, scope: 'hero' },
  { key: 'fire', name: '화염 스킬 피해', base: [1, 3], pw: 4, scope: 'global', el: 'fire' },
  { key: 'lightning', name: '번개 스킬 피해', base: [1, 3], pw: 4, scope: 'global', el: 'lightning' },
  { key: 'frost', name: '서리 스킬 피해', base: [1, 3], pw: 4, scope: 'global', el: 'frost' },
  { key: 'wind', name: '바람 스킬 피해', base: [1, 3], pw: 4, scope: 'global', el: 'wind' },
  { key: 'holy', name: '신성 스킬 피해', base: [1, 3], pw: 4, scope: 'global', el: 'holy' },
  { key: 'dark', name: '암흑 스킬 피해', base: [1, 3], pw: 4, scope: 'global', el: 'dark' },
  { key: 'cdFireball', name: '파이어볼 쿨타임', base: [1, 2.5], pw: 4, scope: 'global', sk: 'fireball', neg: true },
  { key: 'cdLightning', name: '낙뢰 쿨타임', base: [1, 2.5], pw: 4, scope: 'global', sk: 'lightningStrike', neg: true },
  { key: 'cdIce', name: '얼음 창 쿨타임', base: [1, 2.5], pw: 4, scope: 'global', sk: 'iceLance', neg: true },
  { key: 'cdTornado', name: '회오리 쿨타임', base: [1, 2.5], pw: 4, scope: 'global', sk: 'tornado', neg: true },
  { key: 'cdJudgment', name: '심판 광선 쿨타임', base: [1, 2.5], pw: 4, scope: 'global', sk: 'judgment', neg: true },
  { key: 'collab', name: '협공 효과', base: [1, 2.5], pw: 4, scope: 'hero', tb: 'collab' },
  { key: 'ultCd', name: '궁극기 쿨타임', base: [2, 4], pw: 2.5, scope: 'hero', tb: 'ultCd', neg: true },
  { key: 'ultPow', name: '궁극기 효과', base: [4, 8], pw: 1.3, scope: 'hero', tb: 'ultPow' },
  { key: 'heroAtk', name: '영웅 피해', base: [0.6, 1.5], pw: 7, scope: 'hero', tb: 'atk' },
  { key: 'xp', name: '영웅 경험치', base: [2, 5], pw: 2, scope: 'hero', tb: 'xp' },
];
export const AFFIX_BY_KEY = Object.fromEntries(AFFIXES.map(a => [a.key, a]));

// ── 고유 옵션 — fx 통로: tb(특성 효과 키 · 값) · cap(궁극 특성 — 다른 클래스 것도) · el · tauntEl · cd · ultBoost{el,t,rate} · ghost · relic · ultZap ──
// 수치는 talents.js 노드 1~3랭크 수준(한 개로 빌드가 바뀌되 영웅 기여도 25~40%를 넘지 않게 — npm test)
const U = (key, rarity, cls, title, name, desc, fx) => ({ key, rarity, cls, title, name, desc, fx });
export const UNIQUES = [
  // 전설 · 공용 11
  U('meteorCore', 'legend', null, '낙성', '떨어지는 별', '영웅의 기본 공격이 작은 운석이 된다(반경 100 폭발 · 화상)', { cap: 'meteor' }),
  U('wolfHorn', 'legend', null, '늑대왕', '늑대왕의 부름', '늑대 2마리가 함께 싸운다 · 늑대 피해 +25%', { tb: { wolf: 2, wolfPow: 0.25 } }),
  U('twinMask', 'legend', null, '쌍그림자', '그림자 쌍둥이', '그림자 분신 2체가 함께 싸운다(각각 영웅 화력의 30%)', { cap: 'shadowTwins' }),
  U('arcaneMirror', 'legend', null, '거울 마도사', '비전 분신', '영웅의 공격을 따라 하는 비전 분신이 곁에 뜬다(공격력 60%)', { cap: 'arcaneClone' }),
  U('warHorn', 'legend', null, '전쟁 군주', '축복의 함성', '영웅 궁극기를 쓰면 5초간 마법사와 영웅의 피해 +20%', { tb: { ultBless: 0.2 } }),
  U('thunderCrown', 'legend', null, '뇌신', '뇌신의 가호', '영웅 궁극기 뒤 5초간 번개 스킬 쿨타임이 1.6배 빨리 돈다', { ultBoost: { el: 'lightning', t: 5, rate: 1.6 } }),
  U('soulLantern', 'legend', null, '망령 인도자', '망령 인도', '적이 쓰러지면 6% 확률로 망령이 나와 가까운 적을 덮친다(마력 50% 암흑)', { ghost: 0.06 }),
  U('seekerCompass', 'legend', null, '탐구자', '길잡이 나침반', '보스 유물 보상 후보가 1장 더 뜬다', { relic: 1 }),
  U('soulChalice', 'legend', null, '영혼 수확자', '영혼 공급', '영웅이 적을 처치할 때마다 마법사 쿨타임 스킬 대기 −0.2초', { tb: { soulFeed: 0.2 } }),
  U('arcaneBattery', 'legend', null, '마나 순환자', '비전 충전', '비전 충전 +10% — 층마다 쌓여 100%가 되면 그 층에 스킬 카드 1장 추가', { tb: { mana: 0.1 } }),
  U('thunderHammer', 'legend', null, '천둥 심판자', '심판의 번개', '3타마다 표적에 심판의 번개(반경 90, 공격력 200%)', { cap: 'judgeBolt' }),
  // 전설 · 기사
  U('emberBastion', 'legend', 'knight', '잿불 수호자', '잿불 도발', '기사가 도발한 적이 받는 화염 스킬 피해 +40%', { tauntEl: { fire: 0.4 } }),
  U('frostGate', 'legend', 'knight', '서리 수문장', '얼어붙은 방벽', '기사가 도발한 적이 받는 서리 스킬 피해 +40% · 맞은 적 20% 확률 둔화', { tauntEl: { frost: 0.4 }, tb: { slow: 0.2 } }),
  U('chainLord', 'legend', 'knight', '사슬 군주', '끌어모으는 사슬', '6초마다 표적 주변 적을 끌어모은다 — 마법사 광역에 한데 몰아 준다', { tb: { pull: 0.45 } }),
  U('ironReprisal', 'legend', 'knight', '반격 기사', '반격의 방패', '맞을 때 25% 확률로 주변 적에게 방패 강타(공격력 150% · 기절) · 피해 반사 40%', { tb: { bash: 1.5, thorns: 0.4 } }),
  // 전설 · 궁수
  U('stormQuiver', 'legend', 'ranger', '폭풍 사수', '화살 폭풍', '모든 공격이 3연사(한 발당 45%)', { cap: 'arrowStorm' }),
  U('ricochetString', 'legend', 'ranger', '도탄 명사수', '튕기는 화살', '화살이 근처 적에게 1번 더 튀고(30%) 맞은 적 15% 확률 둔화', { tb: { bounce: 1, slow: 0.15 } }), // 2번 → 1번: 궁수 영웅 기여도가 클래스 상한(45%) 가까이라
  U('hawkEye', 'legend', 'ranger', '매 사냥꾼', '급소 조준', '새 표적의 첫 발은 늘 치명타 · 사거리 +20%', { tb: { firstCrit: 1, range: 0.2 } }),
  U('hunterBrand', 'legend', 'ranger', '낙인 사냥꾼', '협공 표식', '화살에 맞은 적은 3초간 마법사 주문 피해 +25%', { tb: { mark: 0.25 } }),
  // 전설 · 마법사
  U('winterHeart', 'legend', 'sorcerer', '영원한 겨울', '절대영도', '궁극기가 절대영도로 — 반경 280 모든 적 3초 빙결 + 공격력 500%', { cap: 'absZero' }),
  U('splitFlame', 'legend', 'sorcerer', '갈라진 불꽃', '분열 화염', '공격이 근처 적 2마리에게 갈라진다(30%, 광역 포함)', { tb: { split: 2 } }),
  U('frostCrown', 'legend', 'sorcerer', '서리 군주', '냉기 오라', '주변(반경 120) 적을 계속 둔화 · 둔화·빙결된 적에게 영웅 피해 +25%', { tb: { chillAura: 120, shatter: 0.25 } }),
  U('stormScepter', 'legend', 'sorcerer', '폭풍 소환사', '폭풍의 전조', '영웅 궁극기 뒤 5초간 모든 쿨타임 스킬이 1.3배 빨리 돈다', { ultBoost: { el: null, t: 5, rate: 1.3 } }),
  // 전설 · 성직자
  U('pillarRelic', 'legend', 'cleric', '천벌', '천벌 기둥', '5초마다 가장 밀집한 무리에 빛의 기둥(반경 110, 공격력 400%)', { cap: 'pillar' }),
  U('lightRipple', 'legend', 'cleric', '광휘', '신성 파동', '4타마다 표적 주변(반경 100)에 신성 폭발(공격력 120%)', { tb: { holyNova: 1.2 } }),
  U('graceBell', 'legend', 'cleric', '은총', '은총의 종소리', '궁극기를 쓰면 성벽 8% 회복 · 1.5초 무적 · 5초간 마법사·영웅 피해 +15%', { tb: { grace: 0.08, ultBless: 0.15 } }),
  U('blessedGrail', 'legend', 'cleric', '축복', '신성 파쇄', '공격할 때마다 주변(반경 70)에 공격력 40% 신성 폭발 · 신성 피해 +20%', { tb: { smite: 0.4, holy: 0.2 } }),
  // 전설 · 암살자
  U('plagueFang', 'legend', 'assassin', '역병 군주', '역병', '공격이 독을 남기고(피해 25%) 중독된 적이 죽으면 반경 150에 역병이 번진다', { cap: 'plague', tb: { poison: 0.25 } }),
  U('reaperScythe', 'legend', 'assassin', '사신', '처형자의 낫', '5타마다 낫을 휘둘러 반경 130 적에게 공격력 250% + 체력 10% 이하 처형', { cap: 'scythe' }),
  U('shadowStep', 'legend', 'assassin', '밤그림자', '그림자 습격', '처치하면 60% 확률로 곧장 다음 적에게 순간이동 · 도착 지점(반경 90) 공격력 100%', { tb: { killBlink: 0.6, shadowStrike: 1 } }),
  U('executionSeal', 'legend', 'assassin', '처형인', '처형인의 인장', '체력 10% 이하 일반 적을 즉시 처형', { tb: { execute: 0.1 } }),
  // 영웅(약한 고유) · 공용 12
  U('emberCharm', 'epic', null, '불씨', '불씨', '영웅 공격 피해의 12%를 화상으로', { tb: { burn: 0.12 } }),
  U('frostCharm', 'epic', null, '서리', '한기', '영웅에게 맞은 적 15% 확률 둔화', { tb: { slow: 0.15 } }),
  U('bloodFang', 'epic', null, '흡혈', '생명 흡수', '영웅이 공격할 때마다 최대 체력 0.5% 회복', { tb: { lifesteal: 0.005 } }),
  U('thornMail', 'epic', null, '가시', '가시', '영웅을 때린 적에게 공격력 30% 반사', { tb: { thorns: 0.3 } }),
  U('luckyCoin', 'epic', null, '행운', '행운의 동전', '처치 골드 +5%', { tb: { gold: 0.05 } }),
  U('sageMark', 'epic', null, '현자', '현자의 책갈피', '영웅 경험치 +12%', { tb: { xp: 0.12 } }),
  U('bondKnot', 'epic', null, '맹약', '맹약의 매듭', '협공 효과 +12%', { tb: { collab: 0.12 } }),
  U('twinShot', 'epic', null, '쌍격', '연속 공격', '12% 확률로 다른 적에게 한 번 더 공격', { tb: { multi: 0.12 } }),
  U('bounceRing', 'epic', null, '도탄', '도탄', '영웅의 공격이 근처 적에게 1번 튄다(30%)', { tb: { bounce: 1 } }),
  U('victoryBand', 'epic', null, '승전', '승리의 환희', '영웅이 처치하면 체력 2% 회복', { tb: { killHeal: 0.02 } }),
  U('tacticsBook', 'epic', null, '전술', '전술 지휘', '성벽 마법사 시전 속도 +4%', { tb: { aura: 0.04 } }),
  U('hourglass', 'epic', null, '모래시계', '시간 압축', '영웅 궁극기 쿨타임 −10%', { tb: { ultCd: 0.1 } }),
];
export const UNIQUE_BY_KEY = Object.fromEntries(UNIQUES.map(u => [u.key, u]));
const LEGACY_POOL = UNIQUES.filter(u => u.rarity === 'legend' && !u.cls).map(u => u.key); // 옛 전설 = 공용 고유(id로 고정)

// ── 세트 6종 — 5부위 어디든 같은 세트 N개. 2세트 = 숫자, 4세트 = 싸우는 방식 ──
const S = (key, title, name, el, color, b2, b4) => ({ key, title, name, el, color, b2, b4 });
export const SETS = [
  S('storm', '뇌명 술사', '뇌명 술사의 예복', 'lightning', '#7dd3fc',
    { desc: '번개 스킬 피해 +15%', fx: { el: { lightning: 0.15 } } },
    { desc: '번개 스킬이 맞힐 때 10% 확률로 영웅 궁극기 쿨타임 −0.5초 · 궁극기 뒤 4초간 번개 스킬 쿨타임 1.5배 빨리', fx: { ultZap: 0.1, ultBoost: { el: 'lightning', t: 4, rate: 1.5 } } }),
  S('ember', '잿불 군주', '잿불 군주의 갑주', 'fire', '#fb923c',
    { desc: '화염 스킬 피해 +15%', fx: { el: { fire: 0.15 } } },
    { desc: '영웅 공격이 적을 불태우고(피해 20% 화상) 불타는 적에게 영웅 피해 +30%', fx: { tb: { burn: 0.2, overheat: 0.3 } } }),
  S('frost', '서리 여왕', '서리 여왕의 장신', 'frost', '#93c5fd',
    { desc: '서리 스킬 피해 +15%', fx: { el: { frost: 0.15 } } },
    { desc: '영웅 주변(반경 140) 적이 계속 느려지고 둔화·빙결된 적에게 영웅 피해 +30%', fx: { tb: { chillAura: 140, shatter: 0.3 } } }),
  S('grave', '망령 군주', '망자의 서약', 'dark', '#a78bfa',
    { desc: '암흑 스킬 피해 +15%', fx: { el: { dark: 0.15 } } },
    { desc: '적이 쓰러지면 12% 확률로 망령 소환 · 영웅이 처치한 적은 폭발(반경 80, 공격력 50%)', fx: { ghost: 0.12, tb: { corpse: 0.5 } } }),
  S('oath', '맹약 기사단', '협공의 맹세', null, '#fbbf24',
    { desc: '협공 효과 +20%', fx: { tb: { collab: 0.2 } } },
    { desc: '영웅 궁극기 쿨타임 −15% · 궁극기 뒤 6초간 모든 쿨타임 스킬 1.6배 빨리', fx: { tb: { ultCd: 0.15 }, ultBoost: { el: null, t: 6, rate: 1.6 } } }),
  S('sanctum', '성역 수호자', '성역 수호자의 법의', 'holy', '#fde68a',
    { desc: '신성 스킬 피해 +15%', fx: { el: { holy: 0.15 } } },
    { desc: '궁극기를 쓰면 성벽 10% 회복 · 1.5초 무적 · 5초간 마법사·영웅 피해 +25%', fx: { tb: { grace: 0.1, ultBless: 0.25 } } }),
];
export const SET_BY_KEY = Object.fromEntries(SETS.map(s => [s.key, s]));

// ── 굴림 ──
const round1 = v => Math.round(v * 10) / 10;
const round2 = v => Math.round(v * 100) / 100;
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length) % arr.length];
const rollStat = (key, [lo, hi], mul, rng) => { const q = rng(); return { key, value: round1((lo + q * (hi - lo)) * mul), q: round2(q) }; };
const ELEMENT_PREFIX = ['용암', '서리', '천둥', '심연', '황금', '유령', '태양', '월광', '폭풍', '철혈'];
const CLASS_FLAVOR = {
  knight: ['수호자', '성기사', '철벽', '기사단장'],
  ranger: ['사냥꾼', '저격수', '추적자', '궁성'],
  sorcerer: ['현자', '비전학자', '원소술사', '마도사'],
  cleric: ['성자', '사제', '치유사', '대주교'],
  assassin: ['그림자', '밤의 칼날', '살수', '암살자'],
};
function itemName(cls, slot, unique, set, rng) {
  const noun = ITEM_NOUN(slot, cls);
  if (unique && UNIQUE_BY_KEY[unique].rarity === 'legend') return `${UNIQUE_BY_KEY[unique].title}의 ${noun}`;
  if (set) return `${SET_BY_KEY[set].title}의 ${noun}`; // 세트 조각은 이름으로 한눈에(영웅 고유보다 먼저)
  if (unique) return `${UNIQUE_BY_KEY[unique].title}의 ${noun}`;
  return `${pick(ELEMENT_PREFIX, rng)} ${pick(CLASS_FLAVOR[cls] || CLASS_FLAVOR.knight, rng)}의 ${noun}`;
}
// 고유 옵션 풀: 그 등급의 공용 + 이 클래스 전용(클래스 전용은 1.5배 자주 — '내 클래스 전설'이 반갑게)
function pickUnique(rarity, cls, rng) {
  const pool = UNIQUES.filter(u => u.rarity === rarity && (!u.cls || u.cls === cls));
  let sum = 0;
  for (const u of pool) sum += u.cls ? 1.5 : 1;
  let x = rng() * sum;
  for (const u of pool) if ((x -= u.cls ? 1.5 : 1) < 0) return u.key;
  return pool[pool.length - 1].key;
}

// stage(= ilvl), source: 'normal'|'elite'|'boss'|'chest' | 등급 가중치 배열(장비 상자) — 드롭 · 상자 · 디버그 전부 여기
export function rollItem(stage, source, rng, cls) {
  const ilvl = clamp(Math.floor(stage) || 1, 1, MAX_ILVL);
  const rarity = pickRarity(source, rng, ilvl), R = RARITY_BY_KEY[rarity];
  const slot = SLOTS[Math.floor(rng() * SLOTS.length)];
  const scale = ilvlScale(ilvl), mainKey = SLOT_MAIN_KEY[slot];
  const main = rollStat(mainKey, MAIN_RANGE[mainKey], R.mainMul * scale, rng);
  const n = R.subN[0] + Math.floor(rng() * (R.subN[1] - R.subN[0] + 1));
  const keys = (ITEM_TEST.off ? AFFIXES.slice(0, 6) : AFFIXES).map(a => a.key);
  const subs = [];
  for (let i = 0; i < n; i++) { // 서로 다른 부옵션 n개
    const k = keys.splice(Math.floor(rng() * keys.length), 1)[0];
    subs.push(rollStat(k, AFFIX_BY_KEY[k].base, R.subMul * scale, rng));
  }
  const c = WEAPON[cls] ? cls : null;
  let unique = null, set = null;
  if (ITEM_TEST.off) { /* v0.1.6 비교 */ } else if (rarity === 'legend') unique = pickUnique('legend', c, rng);
  else if (rarity === 'epic' && rng() < epicUniqChance(ilvl)) unique = pickUnique('epic', c, rng);
  if (!ITEM_TEST.off && (rarity === 'rare' || rarity === 'epic') && ilvl >= SET_MIN_ILVL && rng() < SET_CHANCE) set = pick(SETS, rng).key;
  const id = rng().toString(36).slice(2, 10) + rng().toString(36).slice(2, 6);
  return { id, v: ITEM_VER, slot, rarity, ilvl, name: itemName(c || 'knight', slot, unique, set, rng), main, subs, unique, set, cls: c };
}

// ── 읽기 ──
export const uniqueOn = (item, cls) => { const u = item && UNIQUE_BY_KEY[item.unique]; return !!u && (!u.cls || cls === undefined || u.cls === cls); };
export const isTop = stat => !!stat && stat.q >= TOP_Q;
export const statName = key => MAIN_NAMES[key] || AFFIX_BY_KEY[key]?.name || key;
export const statText = stat => `${AFFIX_BY_KEY[stat.key]?.neg ? '−' : '+'}${(+stat.value || 0).toFixed(1)}%`;
const UNIQUE_POWER = { legend: 40, epic: 15 }, SET_POWER = 12;

// 전투력(비교·자동 장착·판매가). cls를 주면 다른 클래스 전용 고유 옵션은 0
export function itemPower(item, cls) {
  if (!item) return 0;
  let p = item.main.value * (MAIN_POWER_W[item.main.key] || 3);
  for (const s of item.subs) p += s.value * (AFFIX_BY_KEY[s.key]?.pw ?? 2);
  if (item.unique && uniqueOn(item, cls)) p += UNIQUE_POWER[UNIQUE_BY_KEY[item.unique].rarity] || 0;
  if (item.set) p += SET_POWER;
  return Math.round(p * (1 + item.ilvl * 0.01));
}

// UI 줄: 주옵션 · 부옵션(top = 금색) · 고유(off = 이 클래스에선 꺼짐) · 세트
export function itemLines(item, cls) {
  if (!item) return [];
  const st = (kind, s) => ({ kind, key: s.key, name: statName(s.key), text: statText(s), value: s.value, top: isTop(s), off: false });
  const out = [st('main', item.main), ...item.subs.map(s => st('sub', s))];
  const u = UNIQUE_BY_KEY[item.unique];
  if (u) out.push({ kind: 'uniq', key: u.key, name: u.name, text: u.fx.cap ? `${u.desc} (특성으로 이미 가졌다면 영웅 피해 +12%)` : u.desc, cls: u.cls, top: u.rarity === 'legend', off: !uniqueOn(item, cls) });
  const set = SET_BY_KEY[item.set];
  if (set) out.push({ kind: 'set', key: set.key, name: set.name, text: `2세트: ${set.b2.desc} · 4세트: ${set.b4.desc}`, color: set.color, top: false, off: false });
  return out;
}

// 새 것(a) vs 장착 중(b, 없으면 null) — 옵션별 차이. diff > 0 = 좋아짐(쿨타임도 값이 클수록 좋다)
export function compareItems(a, b) {
  const val = (it, k) => { if (!it) return 0; if (it.main.key === k) return it.main.value; const s = it.subs.find(x => x.key === k); return s ? s.value : 0; };
  const keys = [];
  for (const it of [a, b]) if (it) for (const s of [it.main, ...it.subs]) if (!keys.includes(s.key)) keys.push(s.key);
  return keys.map(k => ({ key: k, name: statName(k), a: val(a, k), b: val(b, k), diff: round1(val(a, k) - val(b, k)), neg: !!AFFIX_BY_KEY[k]?.neg }));
}

export function setCounts(hero) {
  const n = {};
  if (hero) for (const s of SLOTS) { const it = hero.equip[s]; if (it && SET_BY_KEY[it.set]) n[it.set] = (n[it.set] || 0) + 1; }
  return n;
}
// 가방·영웅 화면 세트 진행도(장착 중 세트만)
export function setProgress(hero) {
  return Object.entries(setCounts(hero)).map(([k, n]) => {
    const s = SET_BY_KEY[k];
    return { key: k, name: s.name, color: s.color, n, b2: { desc: s.b2.desc, on: n >= 2 }, b4: { desc: s.b4.desc, on: n >= 4 } };
  });
}

// ── 효과 합산(장착이 바뀔 때만 다시 — 명중·틱마다 불린다) ──
const EMPTY = Object.freeze({ tb: {}, cap: {}, el: {}, tauntEl: {}, cd: {}, ultBoost: [], ghost: 0, relic: 0, ultZap: 0, uniques: new Set(), any: false });
const FX_CACHE = new WeakMap();
export const TB_MAX = { chillAura: 1 }; // 반경(px) 효과 키 — 고유·세트·특성끼리 합하지 않고 가장 큰 것(hero.js heroTb도)
function addFx(f, fx) {
  const add = (dst, src) => { for (const k in src) dst[k] = (dst[k] || 0) + src[k]; };
  if (fx.tb) for (const k in fx.tb) f.tb[k] = TB_MAX[k] ? Math.max(f.tb[k] || 0, fx.tb[k]) : (f.tb[k] || 0) + fx.tb[k];
  if (fx.cap) f.cap[fx.cap] = true;
  if (fx.el) add(f.el, fx.el);
  if (fx.tauntEl) add(f.tauntEl, fx.tauntEl);
  if (fx.ultBoost) f.ultBoost.push(fx.ultBoost);
  f.ghost += fx.ghost || 0; f.relic += fx.relic || 0; f.ultZap += fx.ultZap || 0;
}
export function gearFx(hero, cls = hero?.cls) {
  if (!hero || !hero.equip || ITEM_TEST.off) return EMPTY;
  const e = hero.equip, c = FX_CACHE.get(hero);
  if (c && c.cls === cls && e.weapon === c.sig[0] && e.helm === c.sig[1] && e.armor === c.sig[2] && e.trinket === c.sig[3] && e.cape === c.sig[4]) return c.f; // 명중·틱마다 — 배열을 만들지 않고 비교
  const sig = SLOTS.map(s => e[s]);
  const f = { tb: {}, cap: {}, el: {}, tauntEl: {}, cd: {}, ultBoost: [], ghost: 0, relic: 0, ultZap: 0, uniques: new Set(), any: false };
  for (const it of sig) {
    if (!it) continue;
    for (const s of it.subs) {
      const a = AFFIX_BY_KEY[s.key], v = s.value / 100;
      if (!a || ITEM_TEST.noAffix) continue;
      if (a.el) f.el[a.el] = (f.el[a.el] || 0) + v;
      else if (a.sk) f.cd[a.sk] = (f.cd[a.sk] || 0) + v;
      else if (a.tb) f.tb[a.tb] = (f.tb[a.tb] || 0) + v;
    }
    if (it.unique && !ITEM_TEST.noUniq && uniqueOn(it, cls) && !f.uniques.has(it.unique)) { f.uniques.add(it.unique); addFx(f, UNIQUE_BY_KEY[it.unique].fx); } // 같은 고유 두 개는 한 번만
  }
  for (const [k, n] of Object.entries(setCounts(hero))) {
    if (n >= 2) addFx(f, SET_BY_KEY[k].b2.fx);
    if (n >= 4) addFx(f, SET_BY_KEY[k].b4.fx);
  }
  f.any = f.uniques.size > 0 || Object.keys(f.el).length + Object.keys(f.cd).length + Object.keys(f.tb).length > 0 || f.ultBoost.length > 0;
  FX_CACHE.set(hero, { cls, sig, f });
  return f;
}
const fxOf = g => (g.hero && g.hero.cls ? gearFx(g.hero, g.hero.cls) : EMPTY);
const emit = (g, ev) => { if (g.events.length < 4000) g.events.push(ev); };
const elsOf = (g, kind) => (g._src ? skillElements(g._src) : [kind]);

// ── 전투 훅(sim.js · spells.js · hero.js · relics.js가 한 줄씩 부른다) ──
// sim spellHit(카드·융합 피해): 원소 스킬 피해% · 기사가 도발 중인 적(engaged)의 원소 피해% · 번개 궁극 충전(세트)
export function gearSpellMul(g, e, kind, engaged) {
  const f = fxOf(g);
  if (!f.any) return 1;
  const els = elsOf(g, kind);
  let m = 1;
  for (const el of els) m += ((f.el[el] || 0) + (engaged ? f.tauntEl[el] || 0 : 0)) / els.length;
  const h = g.heroUnit;
  if (f.ultZap && h && h.ultCd > 0 && els.includes('lightning') && !(h.zapAt > g.phaseT) && g.heroRng() < f.ultZap) {
    h.zapAt = g.phaseT + 0.5; // ponytail: 0.5초에 최대 한 번(연쇄 번개가 한 틱에 수십 번 맞아도 궁극기가 매번 차지 않게)
    h.ultCd = Math.max(0, h.ultCd - 0.5);
    emit(g, { type: 'gearProc', key: 'ultZap', x: h.x, y: h.y });
  }
  return m;
}
// spells.js tick: 그 스킬의 쿨타임이 도는 속도(1 = 그대로). 부옵션 '○○ 쿨타임 −x%' + 궁극기 뒤 창(ultBoost)
export function gearCdRate(g, key) {
  const f = fxOf(g);
  if (!f.any) return 1;
  let r = 1 / (1 - Math.min(0.5, f.cd[key] || 0));
  const h = g.heroUnit;
  if (h && h.gearUltAt != null && f.ultBoost.length) {
    let best = 1;
    for (const b of f.ultBoost) if (g.phaseT - h.gearUltAt < b.t && b.rate > best && (!b.el || skillElements(key).includes(b.el))) best = b.rate;
    r *= best;
  }
  return r;
}
// hero.js castHeroUlt 끝: 궁극기 뒤 창 열기
export function gearOnUlt(g) {
  const f = fxOf(g), h = g.heroUnit;
  if (!h || !f.ultBoost.length) return;
  h.gearUltAt = g.phaseT;
  emit(g, { type: 'gearProc', key: 'ultBoost', x: h.x, y: h.y, t: Math.max(...f.ultBoost.map(b => b.t)) });
}
// hero.js heroOnKill: 망령 소환(spells.js 망령 군단과 같은 g.spellFx.ghosts — 렌더러·피해 그대로)
export const GHOST_MUL = 0.5, GHOST_CAP = 40;
export function gearOnKill(g, e) {
  const f = fxOf(g);
  if (!f.ghost || !g.spellFx || g.spellFx.ghosts.length >= GHOST_CAP || !(g.heroRng() < f.ghost)) return;
  g.spellFx.ghosts.push({ x: e.x, y: e.y, dmg: g.players[0].stats.dmg * GHOST_MUL, tgt: null, life: 0 });
  emit(g, { type: 'gearProc', key: 'ghost', x: e.x, y: e.y });
}
// relics.js offerRelics: 보스 유물 후보 +n장
export const gearRelicPlus = g => fxOf(g).relic | 0;

// ── 저장 이전(save.js normalize) — 멱등, throw 없음 ──
const num = v => { v = Number(v); return Number.isFinite(v) && v > 0 ? v : 0; };
const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const qOf = (value, [lo, hi], mul) => round2(clamp((value / (mul || 1) - lo) / (hi - lo), 0, 1)); // 옛 아이템: 값에서 품질 역산
const hashId = id => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h; };
export function migrateItem(raw) {
  const it = obj(raw), main = obj(it.main);
  if (typeof it.id !== 'string' || !it.id || !SLOTS.includes(it.slot) || !RARITY_KEYS.includes(it.rarity) || !MAIN_RANGE[main.key]) return null;
  const R = RARITY_BY_KEY[it.rarity], ilvl = clamp(Math.floor(Number(it.ilvl)) || 1, 1, MAX_ILVL), scale = ilvlScale(ilvl);
  const q = (s, range, mul) => { const v = Number(s.q); return Number.isFinite(v) ? round2(clamp(v, 0, 1)) : qOf(num(s.value), range, mul); };
  const id = it.id.slice(0, 32);
  const seen = new Set();
  const subs = (Array.isArray(it.subs) ? it.subs : []).map(obj)
    .filter(s => AFFIX_BY_KEY[s.key] && !seen.has(s.key) && seen.add(s.key)).slice(0, 4)
    .map(s => ({ key: s.key, value: num(s.value), q: q(s, AFFIX_BY_KEY[s.key].base, R.subMul * scale) }));
  const u = UNIQUE_BY_KEY[it.unique];
  // 옛 전설(고유 옵션 없던 시절) = id로 정해지는 공용 고유 1개 — 기존 전설도 새 체계에서 반갑게. 등급이 안 맞는 고유는 버린다
  const unique = u && u.rarity === it.rarity ? u.key : it.rarity === 'legend' ? LEGACY_POOL[hashId(id) % LEGACY_POOL.length] : null;
  return {
    id, v: ITEM_VER, slot: it.slot, rarity: it.rarity, ilvl,
    name: typeof it.name === 'string' ? it.name.slice(0, 40) : '장비',
    main: { key: main.key, value: num(main.value), q: q(main, MAIN_RANGE[main.key], R.mainMul * scale) },
    subs, unique,
    set: SET_BY_KEY[it.set] && (it.rarity === 'rare' || it.rarity === 'epic') ? it.set : null,
    cls: WEAPON[it.cls] ? it.cls : null,
    ...(it.lock ? { lock: 1 } : {}), ...(it.n ? { n: 1 } : {}), // 잠금 · NEW(loot.js 소유 — 참일 때만)
  };
}

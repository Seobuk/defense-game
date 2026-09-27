// 영웅 특성 트리 — 클래스마다 3갈래 × 6노드. 순수 테이블·함수(DOM 없음). 전투 효과는 hero.js / sim.js가 talentBonus()로 읽는다.
// 배분은 영구 영웅 객체 hero.talents = { [cls]: { [nodeKey]: rank } } (클래스별 따로, 레벨·포인트는 공유)

// 노드: { key, name, desc(랭크당 효과), max(1~3), fx:{효과키: 랭크당 수치}, cap?: 궁극 특성 키 }
// 갈래 안에서 앞 노드를 최대 랭크까지 찍어야 다음 노드가 열린다. 6번째 노드 = 궁극 특성(전투 방식이 바뀐다)
const N = (key, name, desc, max, fx, cap) => ({ key, name, desc, max, fx: fx || {}, cap: cap || null });

export const TALENTS = {
  knight: [
    { key: 'guard', name: '수호', desc: '도발 범위와 피해 감소 — 적을 붙잡는 방패', nodes: [
      N('guard1', '강철 피부', '최대 체력 +10%', 3, { hp: 0.1 }),
      N('guard2', '도발의 함성', '도발 범위 +15', 3, { taunt: 15 }),
      N('guard3', '방패 막기', '받는 피해 -6%, 협공 효과 +15%', 2, { dr: 0.06, collab: 0.15 }),
      N('guard4', '가시 갑옷', '맞을 때마다 공격력의 30%를 되돌려 준다', 3, { thorns: 0.3 }),
      N('guard5', '불굴의 의지', '처치 시 체력 3% 회복', 2, { killHeal: 0.03 }),
      N('guard6', '튕기는 방패', '궁극 특성: 4초마다 방패를 던져 적 5마리를 튕기며 공격력 150% + 0.6초 기절', 1, {}, 'shieldToss'),
    ] },
    { key: 'crusade', name: '성전사', desc: '신성 피해와 처치 시 성벽 회복', nodes: [
      N('crusade1', '신성한 검', '공격력 +8%', 3, { atk: 0.08 }),
      N('crusade2', '빛의 가호', '신성 피해 +8% (언데드에게는 2배)', 3, { holy: 0.08 }),
      N('crusade3', '정화의 일격', '처치 시 성벽 최대 내구력의 0.3% 회복', 2, { wallKill: 0.003 }),
      N('crusade4', '열정', '공격 속도 +8%', 3, { aspd: 0.08 }),
      N('crusade5', '심판자', '치명타 확률 +5%', 2, { crit: 0.05 }),
      N('crusade6', '심판의 번개', '궁극 특성: 3타마다 표적에 심판의 번개(반경 90, 공격력 200%)', 1, {}, 'judgeBolt'),
    ] },
    { key: 'command', name: '지휘관', desc: '성벽 마법사를 지휘하는 오라', nodes: [
      N('command1', '전술 교범', '성벽 마법사 시전 속도 +4%', 3, { aura: 0.04 }),
      N('command2', '행군', '이동 속도 +10%', 3, { move: 0.1 }),
      N('command3', '결의', '궁극기 쿨타임 -10%', 2, { ultCd: 0.1 }),
      N('command4', '합동 작전', '공격력 +8%, 기사가 도발한 적이 받는 성벽 마법사 주문 피해 +8%', 3, { atk: 0.08, tauntAmp: 0.08 }),
      N('command5', '전우애', '궁극기 효과 +25%', 2, { ultPow: 0.25 }),
      N('command6', '전군 강화 함성', '궁극 특성: 궁극기를 쓰면 8초간 두 마법사와 영웅의 피해 +40%', 1, {}, 'warcry'),
    ] },
  ],
  ranger: [
    { key: 'sniper', name: '저격', desc: '보스 피해와 치명타', nodes: [
      N('sniper1', '매의 눈', '사거리 +8%', 3, { range: 0.08 }),
      N('sniper2', '급소 사격', '치명타 확률 +4%', 3, { crit: 0.04 }),
      N('sniper3', '거인 사냥', '보스 피해 +15%', 2, { boss: 0.15 }),
      N('sniper4', '정밀 조준', '치명타 피해 +20%', 3, { critDmg: 0.2 }),
      N('sniper5', '관통 화살', '화살 관통 +1', 2, { pierce: 1 }),
      N('sniper6', '관통 저격', '궁극 특성: 4발마다 화면 끝까지 꿰뚫는 저격(공격력 300%)', 1, {}, 'snipe'),
    ] },
    { key: 'rapid', name: '속사', desc: '공격 속도와 다중 화살', nodes: [
      N('rapid1', '빠른 손', '공격 속도 +8%', 3, { aspd: 0.08 }),
      N('rapid2', '다중 화살', '공격마다 20% 확률로 다른 적에게 화살 1발 더', 3, { multi: 0.2 }),
      N('rapid3', '바람걸음', '이동 속도 +10%', 2, { move: 0.1 }),
      N('rapid4', '마법 화살촉', '공격력 +8%, 협공 효과 +15%', 3, { atk: 0.08, collab: 0.15 }),
      N('rapid5', '속사 본능', '공격 속도 +8%', 2, { aspd: 0.08 }),
      N('rapid6', '화살 폭풍', '궁극 특성: 모든 공격이 3연사(한 발당 70%)', 1, {}, 'arrowStorm'),
    ] },
    { key: 'beast', name: '야수', desc: '늑대 동료와 함께 싸운다', nodes: [
      N('beast1', '야생의 부름', '늑대 1마리가 함께 싸운다', 1, { wolf: 1 }),
      N('beast2', '무리의 이빨', '늑대 피해 +25%', 3, { wolfPow: 0.25 }),
      N('beast3', '질긴 가죽', '최대 체력 +12%', 3, { hp: 0.12 }),
      N('beast4', '우두머리', '공격력 +8%', 3, { atk: 0.08 }),
      N('beast5', '짝늑대', '늑대 +1마리', 1, { wolf: 1 }),
      N('beast6', '늑대 무리', '궁극 특성: 늑대 +2마리, 모든 늑대 피해 +50%', 1, {}, 'wolfPack'),
    ] },
  ],
  sorcerer: [
    { key: 'fire', name: '화염', desc: '화상과 폭발 반경', nodes: [
      N('fire1', '불씨', '공격력 +8%', 3, { atk: 0.08 }),
      N('fire2', '점화', '공격 피해의 10%를 2초 동안 화상으로', 3, { burn: 0.1 }),
      N('fire3', '폭발 반경', '광역 반경 +20%', 2, { splash: 0.2 }),
      N('fire4', '화염 숙련', '치명타 확률 +4%', 3, { crit: 0.04 }),
      N('fire5', '열기', '치명타 피해 +25%', 2, { critDmg: 0.25 }),
      N('fire6', '작은 운석', '궁극 특성: 기본 공격이 작은 운석으로(반경 100 폭발, 공격력 140%, 화상)', 1, {}, 'meteor'),
    ] },
    { key: 'frost', name: '냉기', desc: '둔화와 빙결', nodes: [
      N('frost1', '냉기 손길', '맞은 적을 25% 확률로 1.5초 둔화', 3, { slow: 0.25 }),
      N('frost2', '서리 보호막', '최대 체력 +12%', 3, { hp: 0.12 }),
      N('frost3', '빙결', '맞은 적을 5% 확률로 0.8초 빙결', 2, { freeze: 0.05 }),
      N('frost4', '한기', '공격 속도 +8%', 3, { aspd: 0.08 }),
      N('frost5', '얼음 파편', '사거리 +10%', 2, { range: 0.1 }),
      N('frost6', '절대영도', '궁극 특성: 궁극기가 절대영도로 — 반경 280 모든 적 3초 빙결 + 공격력 500%', 1, {}, 'absZero'),
    ] },
    { key: 'arcane', name: '비전', desc: '마나 충전 가속 — 스킬 카드를 더 자주', nodes: [
      N('arcane1', '마나 순환', '비전 충전 +5%: 층마다 쌓여 100%가 되면 그 층에 스킬 카드 1장 추가', 3, { mana: 0.05 }),
      N('arcane2', '비전 공명', '공격력 +8%, 협공 효과 +15%', 3, { atk: 0.08, collab: 0.15 }),
      N('arcane3', '집중', '궁극기 쿨타임 -12%', 2, { ultCd: 0.12 }),
      N('arcane4', '마력 과부하', '공격 속도 +8%', 3, { aspd: 0.08 }),
      N('arcane5', '마나 폭주', '비전 충전 +5%', 2, { mana: 0.05 }),
      N('arcane6', '비전 분신', '궁극 특성: 영웅의 공격을 따라 하는 비전 분신 소환(공격력 60%)', 1, {}, 'arcaneClone'),
    ] },
  ],
  cleric: [
    { key: 'heal', name: '치유', desc: '성벽·영웅 회복 강화', nodes: [
      N('heal1', '치유의 손', '공격 시 회복량 +25%', 3, { heal: 0.25 }),
      N('heal2', '축복받은 몸', '최대 체력 +12%', 3, { hp: 0.12 }),
      N('heal3', '재생', '영웅이 매초 체력 1% 회복', 2, { regen: 0.01 }),
      N('heal4', '성벽 축복', '성벽이 매초 최대 내구력의 0.1% 회복', 3, { wallRegen: 0.001 }),
      N('heal5', '보호의 기도', '받는 피해 -6%', 2, { dr: 0.06 }),
      N('heal6', '부활 결계 강화', '궁극 특성: 도전마다 1회, 성벽이 무너지면 성직자가 40%로 되살린다(부활 결계와 별개)', 1, {}, 'reviveWard'),
    ] },
    { key: 'punish', name: '징벌', desc: '신성 광역과 언데드 특효', nodes: [
      N('punish1', '철퇴 숙련', '공격력 +8%', 3, { atk: 0.08 }),
      N('punish2', '신성 폭발', '공격 시 주변(반경 70) 적에게 공격력 20% 신성 피해', 3, { smite: 0.2 }),
      N('punish3', '언데드 퇴치', '언데드 피해 +25%', 2, { undead: 0.25 }),
      N('punish4', '열성', '공격 속도 +8%', 3, { aspd: 0.08 }),
      N('punish5', '심판', '치명타 확률 +5%', 2, { crit: 0.05 }),
      N('punish6', '천벌 기둥', '궁극 특성: 5초마다 가장 밀집한 적 무리에 빛의 기둥(반경 110, 공격력 400%)', 1, {}, 'pillar'),
    ] },
    { key: 'bless', name: '축복', desc: '골드·경험치 증가', nodes: [
      N('bless1', '풍요', '처치 골드 +3%', 3, { gold: 0.03 }),
      N('bless2', '지혜', '영웅 경험치 +8%', 3, { xp: 0.08 }),
      N('bless3', '행운', '치명타 확률 +4%', 2, { crit: 0.04 }),
      N('bless4', '은총의 연대', '공격력 +8%, 협공 효과 +15%', 3, { atk: 0.08, collab: 0.15 }),
      N('bless5', '신의 선물', '궁극기 쿨타임 -10%', 2, { ultCd: 0.1 }),
      N('bless6', '카드 축복', '궁극 특성: 스킬 카드를 고르면 30% 확률로 레벨 +1 추가', 1, {}, 'cardBless'),
    ] },
  ],
  assassin: [
    { key: 'shadow', name: '그림자', desc: '순간이동과 분신', nodes: [
      N('shadow1', '그림자 걸음', '순간이동 쿨타임 -12%', 3, { blink: 0.12 }),
      N('shadow2', '암영', '이동 속도 +8%', 3, { move: 0.08 }),
      N('shadow3', '기습', '순간이동 직후 첫 공격 피해 +40%', 2, { ambush: 0.4 }),
      N('shadow4', '민첩', '공격 속도 +8%', 3, { aspd: 0.08 }),
      N('shadow5', '회피', '받는 피해 -6%', 2, { dr: 0.06 }),
      N('shadow6', '그림자 분신', '궁극 특성: 그림자 분신 2체가 함께 싸운다(각각 영웅 화력의 30%)', 1, {}, 'shadowTwins'),
    ] },
    { key: 'poison', name: '독', desc: '중독 누적과 확산', nodes: [
      N('poison1', '독 바르기', '공격 피해의 15%를 4초 동안 독으로(중첩)', 3, { poison: 0.15 }),
      N('poison2', '그림자 공조', '공격력 +8%, 협공 효과 +15%', 3, { atk: 0.08, collab: 0.15 }),
      N('poison3', '독 확산', '중독된 적이 죽으면 반경 90 적에게 남은 독의 50% 전이', 2, { spread: 0.5 }),
      N('poison4', '연속 베기', '공격 속도 +8%', 3, { aspd: 0.08 }),
      N('poison5', '부식', '중독된 적이 받는 영웅 피해 +10%', 2, { poisonAmp: 0.1 }),
      N('poison6', '역병', '궁극 특성: 독이 2배로 쌓이고, 중독된 적이 죽으면 반경 150 모든 적에게 역병이 퍼진다', 1, {}, 'plague'),
    ] },
    { key: 'execute', name: '처형', desc: '약해진 적 즉사, 보스 처형', nodes: [
      N('execute1', '급소 찌르기', '치명타 확률 +4%', 3, { crit: 0.04 }),
      N('execute2', '보스 사냥꾼', '보스 피해 +12%', 3, { boss: 0.12 }),
      N('execute3', '처형', '체력 3% 이하 일반 적 즉사', 2, { execute: 0.03 }),
      N('execute4', '치명적 일격', '치명타 피해 +20%', 3, { critDmg: 0.2 }),
      N('execute5', '마무리', '체력 30% 이하 보스에게 피해 +25%', 2, { bossExec: 0.25 }),
      N('execute6', '처형자의 낫', '궁극 특성: 5타마다 낫을 휘둘러 반경 130 적에게 공격력 250% + 체력 10% 이하 일반 적 처형', 1, {}, 'scythe'),
    ] },
  ],
};

// 효과 키(모두 0으로 시작 — 훅은 `|| 0` 없이 그대로 쓴다)
export const TALENT_FX_KEYS = ['atk', 'aspd', 'hp', 'crit', 'move', 'range', 'dr', 'critDmg', 'boss',
  'taunt', 'thorns', 'killHeal', 'wallKill', 'holy', 'undead', 'aura', 'ultCd', 'ultPow',
  'pierce', 'multi', 'wolf', 'wolfPow', 'burn', 'splash', 'slow', 'freeze', 'mana',
  'heal', 'regen', 'wallRegen', 'smite', 'gold', 'xp', 'blink', 'ambush', 'poison', 'spread', 'poisonAmp', 'execute', 'bossExec',
  'tauntAmp', 'collab']; // tauntAmp = 도발한 적이 받는 마법사 주문 피해, collab = 협공 효과 배율(config.js collabPow)
export const CAPSTONES = Object.values(TALENTS).flatMap(bs => bs.map(b => b.nodes[5].cap));

// 노드 찾기: { branch, index, node } | null
const NODE_INDEX = {};
for (const [cls, branches] of Object.entries(TALENTS)) {
  NODE_INDEX[cls] = {};
  for (const b of branches) b.nodes.forEach((node, index) => { NODE_INDEX[cls][node.key] = { branch: b, index, node }; });
}
export const talentNode = (cls, key) => (Object.hasOwn(NODE_INDEX, cls) && Object.hasOwn(NODE_INDEX[cls], key) ? NODE_INDEX[cls][key] : null);
export const talentMaxRanks = cls => (TALENTS[cls] || []).reduce((s, b) => s + b.nodes.reduce((t, n) => t + n.max, 0), 0);

// 특성 포인트 = 영웅 레벨 + 10레벨마다 1점. 클래스마다 따로 배분
export const talentPoints = hero => (hero ? hero.level + Math.floor(hero.level / 10) : 0);
const allocOf = (hero, cls) => (hero && hero.talents && hero.talents[cls]) || {};
export const talentRank = (hero, cls, key) => allocOf(hero, cls)[key] | 0;
export function talentSpent(hero, cls) {
  let s = 0;
  for (const v of Object.values(allocOf(hero, cls))) s += v | 0;
  return s;
}
export const talentLeft = (hero, cls) => Math.max(0, talentPoints(hero) - talentSpent(hero, cls));
// 한 갈래에 찍은 랭크 합(협공 갈래 조건)
export function branchSpent(hero, cls, branchKey) {
  const b = (TALENTS[cls] || []).find(x => x.key === branchKey), a = allocOf(hero, cls);
  return b ? b.nodes.reduce((s, n) => s + (a[n.key] | 0), 0) : 0;
}

// 찍을 수 있나: 노드가 있고, 최대 랭크 전이고, 남은 포인트가 있고, 갈래의 앞 노드가 최대 랭크
export function canAllocate(hero, cls, key) {
  const f = talentNode(cls, key);
  if (!f || !hero) return false;
  if (talentRank(hero, cls, key) >= f.node.max) return false;
  if (talentLeft(hero, cls) <= 0) return false;
  const prev = f.index > 0 ? f.branch.nodes[f.index - 1] : null;
  return !prev || talentRank(hero, cls, prev.key) >= prev.max;
}

// 1랭크 올리기(제자리 변경). 성공하면 true
export function allocateTalent(hero, cls, key) {
  if (!canAllocate(hero, cls, key)) return false;
  hero.talents ||= {};
  hero.talents[cls] ||= {};
  hero.talents[cls][key] = talentRank(hero, cls, key) + 1;
  return true;
}

// 무료 초기화(정비 화면). 초기화할 것이 있었으면 true
export function resetTalents(hero, cls) {
  if (!hero || !talentSpent(hero, cls)) return false;
  hero.talents[cls] = {};
  return true;
}

// 배분 합산 → { atk, aspd, …(TALENT_FX_KEYS), cap: { [궁극 특성 키]: true } }
export function talentBonus(hero, cls) {
  const b = { cap: {} };
  for (const k of TALENT_FX_KEYS) b[k] = 0;
  const alloc = allocOf(hero, cls);
  for (const [key, r] of Object.entries(alloc)) {
    const f = talentNode(cls, key);
    if (!f || !(r > 0)) continue;
    for (const [k, v] of Object.entries(f.node.fx)) b[k] += v * r;
    if (f.node.cap) b.cap[f.node.cap] = true;
  }
  return b;
}

// 신뢰할 수 없는 저장값 → 유효한 배분. 순서·포인트 규칙을 어긴 클래스는 비운다(초기화는 무료라 손해 없음)
export function normalizeTalents(raw, level) {
  const out = {};
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const probe = { level, talents: out };
  for (const cls of Object.keys(TALENTS)) {
    const a = src[cls] && typeof src[cls] === 'object' && !Array.isArray(src[cls]) ? src[cls] : {};
    out[cls] = {};
    // 갈래 순서대로 다시 찍어 보며 검증
    let ok = true;
    for (const b of TALENTS[cls]) {
      for (const n of b.nodes) {
        const want = Math.floor(Number(a[n.key]));
        if (!(want > 0)) continue;
        for (let r = 0; r < Math.min(want, n.max); r++) if (!allocateTalent(probe, cls, n.key)) ok = false;
        if (want > n.max) ok = false;
      }
    }
    if (!ok || !Object.keys(out[cls]).length) delete out[cls];
  }
  return out;
}

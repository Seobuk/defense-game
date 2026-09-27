// 영웅 특성 트리 — 클래스마다 3갈래 × 6단(tier) + 갈래 사이 혼합 노드. 순수 테이블·함수(DOM 없음).
// 전투 효과는 hero.js / sim.js가 talentBonus()로 읽는다. 배분 = 영구 영웅 객체 hero.talents = { [cls]: { [nodeKey]: rank } }
// 규칙: 단은 '그 갈래에 쓴 포인트'로 열린다(TIER_REQ) · 같은 or 묶음은 하나만 · 궁극 특성(cap)은 클래스당 하나만 ·
// 혼합 노드는 두 갈래에 각각 HYBRID_REQ점 이상 · 포인트 예산은 Lv99에서 '한 갈래 전부 + 나머지 두 갈래 절반'(talentPoints)

export const TIER_REQ = [0, 3, 6, 10, 14, 18]; // 1~6단을 여는 데 필요한 갈래 포인트
export const HYBRID_REQ = 8;                    // 혼합 노드: 두 갈래 각각 이만큼
export const TALENT_VER = 2;                    // 특성 구조 버전(save.js: 옛 배분은 전부 환불)

// 노드: { key, tier(0~5), name, desc(랭크당 효과, 숫자), max, fx:{효과키: 랭크당 수치}, or?(택1 묶음), ks?(핵심 노드), cap?(궁극 특성 키) }
const N = (tier, name, desc, max, fx, o = {}) => ({ tier, name, desc, max, fx, or: o.or || null, ks: !!o.ks, cap: o.cap || null });
const KS = (tier, name, desc, fx) => N(tier, name, desc, 1, fx, { ks: true });
const CAP = (name, desc, cap) => N(5, name, desc, 1, {}, { cap });
const B = (key, name, desc, nodes) => ({ key, name, desc, nodes: nodes.map((n, i) => ({ key: key + (i + 1), ...n, or: n.or && key + '.' + n.or })) });

export const TALENTS = {
  knight: [
    B('guard', '수호', '도발·피해 감소·반격 — 적을 붙잡는 방패', [
      N(0, '강철 피부', '최대 체력 +10%', 3, { hp: 0.1 }),
      N(0, '도발의 함성', '도발 범위 +15', 3, { taunt: 15 }),
      N(1, '방패 막기', '받는 피해 -5%, 협공 효과 +10%', 3, { dr: 0.05, collab: 0.1 }),
      N(1, '가시 갑옷', '맞을 때마다 공격력의 40%를 되돌려 준다', 2, { thorns: 0.4 }, { or: 'a' }),
      N(1, '불굴', '적을 처치하면 체력 3% 회복', 2, { killHeal: 0.03 }, { or: 'a' }),
      KS(2, '반격의 방패', '맞을 때 25% 확률로 방패 강타: 반경 110 적에게 공격력 120% + 0.5초 기절', { bash: 1.2 }),
      N(2, '수호자의 긍지', '영웅이 매초 체력 0.6% 회복', 3, { regen: 0.006 }),
      N(3, '철갑', '공격력 +6%, 최대 체력 +6%', 3, { atk: 0.06, hp: 0.06 }),
      N(3, '철벽', '받는 피해 -6%', 2, { dr: 0.06 }, { or: 'b' }),
      N(3, '도발 장악', '도발한 적이 받는 성벽 마법사 주문 피해 +8%', 2, { tauntAmp: 0.08 }, { or: 'b' }),
      N(4, '방패 숙련', '공격 속도 +6%', 2, { aspd: 0.06 }),
      N(4, '수호 서약', '협공 효과 +12%', 2, { collab: 0.12 }),
      CAP('튕기는 방패', '4초마다 방패를 던져 적 5마리를 튕기며 공격력 150% + 0.6초 기절', 'shieldToss'),
      N(5, '불멸의 방패', '공격력 +8%', 2, { atk: 0.08 }),
    ]),
    B('crusade', '성전사', '신성 피해와 치명타, 처치 시 성벽 회복', [
      N(0, '신성한 검', '공격력 +8%', 3, { atk: 0.08 }),
      N(0, '빛의 가호', '신성 피해 +8% (언데드에게는 2배)', 3, { holy: 0.08 }),
      N(1, '열정', '공격 속도 +7%', 3, { aspd: 0.07 }),
      N(1, '정화의 일격', '적을 처치하면 성벽 최대 내구력의 0.3% 회복', 2, { wallKill: 0.003 }, { or: 'a' }),
      N(1, '언데드 퇴치', '언데드 피해 +20%', 2, { undead: 0.2 }, { or: 'a' }),
      KS(2, '신성 연격', '치명타가 터지면 표적 주변 반경 80에 공격력 60% 신성 폭발', { critBurst: 0.6 }),
      N(2, '심판자', '치명타 확률 +4%', 3, { crit: 0.04 }),
      N(3, '성검', '공격력 +7%', 3, { atk: 0.07 }),
      N(3, '천상의 일격', '치명타 피해 +25%', 2, { critDmg: 0.25 }, { or: 'b' }),
      N(3, '신속한 심판', '공격 속도 +8%', 2, { aspd: 0.08 }, { or: 'b' }),
      N(4, '거인 처단', '보스 피해 +12%', 2, { boss: 0.12 }),
      N(4, '성전의 불꽃', '신성 피해 +10%', 2, { holy: 0.1 }),
      CAP('심판의 번개', '3타마다 표적에 심판의 번개(반경 90, 공격력 200%)', 'judgeBolt'),
      N(5, '성전사의 긍지', '치명타 확률 +4%', 2, { crit: 0.04 }),
    ]),
    B('command', '지휘관', '성벽 마법사를 돕는 오라와 궁극기', [
      N(0, '전술 교범', '성벽 마법사 시전 속도 +4%', 3, { aura: 0.04 }),
      N(0, '행군', '이동 속도 +10%', 3, { move: 0.1 }),
      N(1, '합동 작전', '공격력 +6%, 도발한 적이 받는 성벽 마법사 주문 피해 +8%', 3, { atk: 0.06, tauntAmp: 0.08 }),
      N(1, '결의', '궁극기 쿨타임 -10%', 2, { ultCd: 0.1 }, { or: 'a' }),
      N(1, '전우애', '궁극기 효과 +25%', 2, { ultPow: 0.25 }, { or: 'a' }),
      KS(2, '작전 지휘', '궁극기를 쓰면 성벽 마법사의 쿨타임 스킬 대기 시간 -3초', { ultRefresh: 3 }),
      N(2, '연대', '협공 효과 +12%', 3, { collab: 0.12 }),
      N(3, '사기 진작', '성벽 마법사 시전 속도 +4%', 3, { aura: 0.04 }),
      N(3, '선봉', '공격력 +10%', 2, { atk: 0.1 }, { or: 'b' }),
      N(3, '방진', '받는 피해 -6%, 최대 체력 +8%', 2, { dr: 0.06, hp: 0.08 }, { or: 'b' }),
      N(4, '전장 장악', '궁극기 쿨타임 -8%', 2, { ultCd: 0.08 }),
      N(4, '명장의 기백', '공격 속도 +6%', 2, { aspd: 0.06 }),
      CAP('전군 강화 함성', '궁극기를 쓰면 8초간 마법사와 영웅의 피해 +40%', 'warcry'),
      N(5, '승전보', '처치 골드 +4%', 2, { gold: 0.04 }),
    ]),
  ],
  ranger: [
    B('sniper', '저격', '사거리·치명타·보스 저격', [
      N(0, '매의 눈', '사거리 +8%', 3, { range: 0.08 }),
      N(0, '급소 사격', '치명타 확률 +4%', 3, { crit: 0.04 }),
      N(1, '정밀 조준', '치명타 피해 +15%', 3, { critDmg: 0.15 }),
      N(1, '거인 사냥', '보스 피해 +15%', 2, { boss: 0.15 }, { or: 'a' }),
      N(1, '관통 화살', '화살 관통 +1', 2, { pierce: 1 }, { or: 'a' }),
      KS(2, '조준 사격', '새 표적을 향한 첫 화살은 치명타 확률 100%', { firstCrit: 1 }),
      N(2, '저격수의 호흡', '공격력 +7%', 3, { atk: 0.07 }),
      N(3, '약점 간파', '치명타 확률 +3%', 3, { crit: 0.03 }),
      N(3, '필살 조준', '치명타 피해 +25%', 2, { critDmg: 0.25 }, { or: 'b' }),
      N(3, '마무리 사격', '체력 30% 이하 보스에게 피해 +25%', 2, { bossExec: 0.25 }, { or: 'b' }),
      N(4, '명사수', '공격력 +8%', 2, { atk: 0.08 }),
      N(4, '협공 조준', '협공 효과 +15%', 2, { collab: 0.15 }),
      CAP('관통 저격', '4발마다 화면 끝까지 꿰뚫는 저격(공격력 300%)', 'snipe'),
      N(5, '백발백중', '치명타 피해 +20%', 2, { critDmg: 0.2 }),
    ]),
    B('rapid', '속사', '공격 속도와 다중 화살', [
      N(0, '빠른 손', '공격 속도 +7%', 3, { aspd: 0.07 }),
      N(0, '날렵한 발', '이동 속도 +8%', 3, { move: 0.08 }),
      N(1, '다중 화살', '공격마다 15% 확률로 다른 적에게 화살 1발 더', 3, { multi: 0.15 }),
      N(1, '마법 화살촉', '공격력 +6%, 협공 효과 +15%', 2, { atk: 0.06, collab: 0.15 }, { or: 'a' }),
      N(1, '바람의 화살', '공격 속도 +8%', 2, { aspd: 0.08 }, { or: 'a' }),
      KS(2, '연사 가속', '쏠 때마다 공격 속도 +4%씩 쌓인다(최대 10중첩, 2초 쉬면 사라짐)', { frenzy: 0.04 }),
      N(2, '속사 본능', '공격력 +7%', 3, { atk: 0.07 }),
      N(3, '연속 사격', '공격 속도 +6%', 3, { aspd: 0.06 }),
      N(3, '산탄', '다중 화살 확률 +20%', 2, { multi: 0.2 }, { or: 'b' }),
      N(3, '관통 사격', '화살 관통 +1', 2, { pierce: 1 }, { or: 'b' }),
      N(4, '명궁', '치명타 확률 +4%', 2, { crit: 0.04 }),
      N(4, '화살비 숙련', '궁극기 쿨타임 -10%', 2, { ultCd: 0.1 }),
      CAP('화살 폭풍', '모든 공격이 3연사(한 발당 45%)', 'arrowStorm'),
      N(5, '폭풍의 눈', '공격력 +8%', 2, { atk: 0.08 }),
    ]),
    B('beast', '야수', '늑대 동료와 함께 싸운다', [
      N(0, '야생의 부름', '늑대 1마리가 함께 싸운다', 1, { wolf: 1 }),
      N(0, '질긴 가죽', '최대 체력 +10%', 3, { hp: 0.1 }),
      N(1, '무리의 이빨', '늑대 피해 +25%', 3, { wolfPow: 0.25 }),
      N(1, '사냥꾼의 유대', '공격력 +8%', 2, { atk: 0.08 }, { or: 'a' }),
      N(1, '야생의 질주', '이동 속도 +10%, 공격 속도 +5%', 2, { move: 0.1, aspd: 0.05 }, { or: 'a' }),
      KS(2, '무리 사냥', '늑대에게 물린 적은 3초간 영웅과 늑대에게 받는 피해 +20%', { packHunt: 0.2 }),
      N(2, '우두머리', '공격력 +7%', 3, { atk: 0.07 }),
      N(3, '짝늑대', '늑대 +1마리', 1, { wolf: 1 }),
      N(3, '야수의 분노', '늑대 피해 +30%', 2, { wolfPow: 0.3 }, { or: 'b' }),
      N(3, '야생 협공', '협공 효과 +15%, 공격력 +4%', 2, { collab: 0.15, atk: 0.04 }, { or: 'b' }),
      N(4, '강인한 무리', '늑대 피해 +20%', 3, { wolfPow: 0.2 }),
      N(4, '사냥 본능', '공격 속도 +6%', 2, { aspd: 0.06 }),
      CAP('늑대 무리', '늑대 +2마리, 모든 늑대 피해 +50%', 'wolfPack'),
      N(5, '야생의 왕', '공격력 +8%', 2, { atk: 0.08 }),
    ]),
  ],
  sorcerer: [
    B('fire', '화염', '화상과 폭발 반경', [
      N(0, '불씨', '공격력 +7%', 3, { atk: 0.07 }),
      N(0, '점화', '공격 피해의 10%를 2초 동안 화상으로', 3, { burn: 0.1 }),
      N(1, '폭발 반경', '광역 반경 +15%', 3, { splash: 0.15 }),
      N(1, '화염 숙련', '치명타 확률 +5%', 2, { crit: 0.05 }, { or: 'a' }),
      N(1, '잔불', '화상 +12%', 2, { burn: 0.12 }, { or: 'a' }),
      KS(2, '과열', '불타는 적에게 주는 영웅 피해 +40%', { overheat: 0.4 }),
      N(2, '열기', '치명타 피해 +15%', 3, { critDmg: 0.15 }),
      N(3, '불꽃 손길', '공격력 +7%', 3, { atk: 0.07 }),
      N(3, '화염 폭풍', '광역 반경 +20%', 2, { splash: 0.2 }, { or: 'b' }),
      N(3, '연소 가속', '공격 속도 +8%', 2, { aspd: 0.08 }, { or: 'b' }),
      N(4, '화염 공명', '협공 효과 +15%', 2, { collab: 0.15 }),
      N(4, '업화', '화상 +10%', 2, { burn: 0.1 }),
      CAP('작은 운석', '기본 공격이 작은 운석으로(반경 100 폭발, 공격력 140%, 화상)', 'meteor'),
      N(5, '불의 군주', '공격력 +8%', 2, { atk: 0.08 }),
    ]),
    B('frost', '냉기', '둔화와 빙결', [
      N(0, '냉기 손길', '맞은 적을 20% 확률로 1.5초 둔화', 3, { slow: 0.2 }),
      N(0, '서리 보호막', '최대 체력 +10%', 3, { hp: 0.1 }),
      N(1, '한기', '공격 속도 +6%', 3, { aspd: 0.06 }),
      N(1, '빙결', '맞은 적을 5% 확률로 0.8초 빙결', 2, { freeze: 0.05 }, { or: 'a' }),
      N(1, '얼음 파편', '사거리 +10%', 2, { range: 0.1 }, { or: 'a' }),
      KS(2, '산산조각', '둔화·빙결된 적에게 주는 영웅 피해 +40%', { shatter: 0.4 }),
      N(2, '냉기 집중', '공격력 +7%', 3, { atk: 0.07 }),
      N(3, '혹한', '치명타 확률 +4%', 3, { crit: 0.04 }),
      N(3, '눈보라 강화', '궁극기 효과 +25%', 2, { ultPow: 0.25 }, { or: 'b' }),
      N(3, '빙하의 심장', '받는 피해 -6%', 2, { dr: 0.06 }, { or: 'b' }),
      N(4, '서리 공명', '협공 효과 +15%', 2, { collab: 0.15 }),
      N(4, '동결', '궁극기 쿨타임 -10%', 2, { ultCd: 0.1 }),
      CAP('절대영도', '궁극기가 절대영도로 — 반경 280 모든 적 3초 빙결 + 공격력 500%', 'absZero'),
      N(5, '영원한 겨울', '공격력 +8%', 2, { atk: 0.08 }),
    ]),
    B('arcane', '비전', '마나 충전 가속 — 스킬 카드를 더 자주', [
      N(0, '마나 순환', '비전 충전 +5%: 층마다 쌓여 100%가 되면 그 층에 스킬 카드 1장 추가', 3, { mana: 0.05 }),
      N(0, '비전 공명', '공격력 +6%, 협공 효과 +10%', 3, { atk: 0.06, collab: 0.1 }),
      N(1, '마력 과부하', '공격 속도 +7%', 3, { aspd: 0.07 }),
      N(1, '집중', '궁극기 쿨타임 -12%', 2, { ultCd: 0.12 }, { or: 'a' }),
      N(1, '마나 폭주', '비전 충전 +6%', 2, { mana: 0.06 }, { or: 'a' }),
      KS(2, '비전 쇄도', '궁극기를 쓰면 6초간 공격 속도 +40%', { surge: 0.4 }),
      N(2, '비전 지식', '공격력 +7%', 3, { atk: 0.07 }),
      N(3, '마력 통찰', '치명타 확률 +4%', 3, { crit: 0.04 }),
      N(3, '시간 왜곡', '성벽 마법사 시전 속도 +6%', 2, { aura: 0.06 }, { or: 'b' }),
      N(3, '비전 파동', '광역 반경 +20%', 2, { splash: 0.2 }, { or: 'b' }),
      N(4, '마력 증폭', '치명타 피해 +20%', 2, { critDmg: 0.2 }),
      N(4, '비전 친화', '협공 효과 +12%', 2, { collab: 0.12 }),
      CAP('비전 분신', '영웅의 공격을 따라 하는 비전 분신 소환(공격력 60%)', 'arcaneClone'),
      N(5, '대마법', '공격력 +8%', 2, { atk: 0.08 }),
    ]),
  ],
  cleric: [
    B('heal', '치유', '성벽·영웅 회복 강화', [
      N(0, '치유의 손', '공격 시 회복량 +20%', 3, { heal: 0.2 }),
      N(0, '축복받은 몸', '최대 체력 +10%', 3, { hp: 0.1 }),
      N(1, '성벽 축복', '성벽이 매초 최대 내구력의 0.08% 회복', 3, { wallRegen: 0.0008 }),
      N(1, '재생', '영웅이 매초 체력 1% 회복', 2, { regen: 0.01 }, { or: 'a' }),
      N(1, '보호의 기도', '받는 피해 -6%', 2, { dr: 0.06 }, { or: 'a' }),
      KS(2, '긴급 치유', '성벽이 50% 아래면 공격 시 회복량 2배', { emergency: 1 }),
      N(2, '신앙', '공격력 +7%', 3, { atk: 0.07 }),
      N(3, '은혜', '공격 속도 +6%', 3, { aspd: 0.06 }),
      N(3, '성역', '성벽이 매초 최대 내구력의 0.1% 회복', 2, { wallRegen: 0.001 }, { or: 'b' }),
      N(3, '치유 협공', '협공 효과 +15%', 2, { collab: 0.15 }, { or: 'b' }),
      N(4, '기도의 힘', '궁극기 효과 +25%', 2, { ultPow: 0.25 }),
      N(4, '헌신', '궁극기 쿨타임 -10%', 2, { ultCd: 0.1 }),
      CAP('부활 결계 강화', '도전마다 1회, 성벽이 무너지면 성직자가 40%로 되살린다(부활 결계와 별개)', 'reviveWard'),
      N(5, '성인의 손길', '공격력 +8%', 2, { atk: 0.08 }),
    ]),
    B('punish', '징벌', '신성 광역과 언데드 특효', [
      N(0, '철퇴 숙련', '공격력 +7%', 3, { atk: 0.07 }),
      N(0, '신성 폭발', '공격 시 주변(반경 70) 적에게 공격력 15% 신성 피해', 3, { smite: 0.15 }),
      N(1, '열성', '공격 속도 +7%', 3, { aspd: 0.07 }),
      N(1, '언데드 퇴치', '언데드 피해 +25%', 2, { undead: 0.25 }, { or: 'a' }),
      N(1, '심판', '치명타 확률 +5%', 2, { crit: 0.05 }, { or: 'a' }),
      KS(2, '천벌 연타', '4타마다 표적 주변 반경 100 신성 폭발(공격력 120%)', { holyNova: 1.2 }),
      N(2, '신의 분노', '공격력 +7%', 3, { atk: 0.07 }),
      N(3, '빛의 망치', '신성 폭발 피해 +10%p', 3, { smite: 0.1 }),
      N(3, '응징', '치명타 피해 +25%', 2, { critDmg: 0.25 }, { or: 'b' }),
      N(3, '성스러운 불꽃', '신성 피해 +10% (언데드에게는 2배)', 2, { holy: 0.1 }, { or: 'b' }),
      N(4, '징벌 협공', '협공 효과 +15%', 2, { collab: 0.15 }),
      N(4, '광신', '공격 속도 +6%', 2, { aspd: 0.06 }),
      CAP('천벌 기둥', '5초마다 가장 밀집한 적 무리에 빛의 기둥(반경 110, 공격력 400%)', 'pillar'),
      N(5, '신성한 격노', '공격력 +8%', 2, { atk: 0.08 }),
    ]),
    B('bless', '축복', '골드·경험치·궁극기', [
      N(0, '풍요', '처치 골드 +3%', 3, { gold: 0.03 }),
      N(0, '지혜', '영웅 경험치 +8%', 3, { xp: 0.08 }),
      N(1, '은총의 연대', '공격력 +6%, 협공 효과 +15%', 3, { atk: 0.06, collab: 0.15 }),
      N(1, '행운', '치명타 확률 +5%', 2, { crit: 0.05 }, { or: 'a' }),
      N(1, '신의 선물', '궁극기 쿨타임 -10%', 2, { ultCd: 0.1 }, { or: 'a' }),
      KS(2, '은총', '궁극기를 쓰면 성벽 최대 내구력의 10% 회복 + 영웅 1.5초 무적', { grace: 0.1 }),
      N(2, '축복의 손', '공격력 +7%', 3, { atk: 0.07 }),
      N(3, '가호', '성벽 마법사 시전 속도 +4%', 3, { aura: 0.04 }),
      N(3, '황금 기도', '처치 골드 +6%', 2, { gold: 0.06 }, { or: 'b' }),
      N(3, '축복 협공', '협공 효과 +15%', 2, { collab: 0.15 }, { or: 'b' }),
      N(4, '기적', '궁극기 효과 +25%', 2, { ultPow: 0.25 }),
      N(4, '신앙심', '공격 속도 +6%', 2, { aspd: 0.06 }),
      CAP('카드 축복', '스킬 카드를 고르면 30% 확률로 레벨 +1 추가', 'cardBless'),
      N(5, '성스러운 축복', '공격력 +8%', 2, { atk: 0.08 }),
    ]),
  ],
  assassin: [
    B('shadow', '그림자', '순간이동과 분신', [
      N(0, '그림자 걸음', '순간이동 쿨타임 -10%', 3, { blink: 0.1 }),
      N(0, '암영', '이동 속도 +8%', 3, { move: 0.08 }),
      N(1, '기습', '순간이동 직후 첫 공격 피해 +30%', 3, { ambush: 0.3 }),
      N(1, '민첩', '공격 속도 +8%', 2, { aspd: 0.08 }, { or: 'a' }),
      N(1, '회피', '받는 피해 -6%', 2, { dr: 0.06 }, { or: 'a' }),
      KS(2, '그림자 습격', '순간이동하면 도착 지점 반경 90 적에게 공격력 100% 피해', { shadowStrike: 1 }),
      N(2, '어둠의 칼날', '공격력 +7%', 3, { atk: 0.07 }),
      N(3, '그림자 춤', '공격 속도 +6%', 3, { aspd: 0.06 }),
      N(3, '암습', '기습 피해 +40%', 2, { ambush: 0.4 }, { or: 'b' }),
      N(3, '그림자 협공', '협공 효과 +15%', 2, { collab: 0.15 }, { or: 'b' }),
      N(4, '치명적 그림자', '치명타 피해 +20%', 2, { critDmg: 0.2 }),
      N(4, '잔상', '순간이동 쿨타임 -10%', 2, { blink: 0.1 }),
      CAP('그림자 분신', '그림자 분신 2체가 함께 싸운다(각각 영웅 화력의 30%)', 'shadowTwins'),
      N(5, '그림자 군주', '공격력 +8%', 2, { atk: 0.08 }),
    ]),
    B('poison', '독', '중독 누적과 확산', [
      N(0, '독 바르기', '공격 피해의 12%를 4초 동안 독으로(중첩)', 3, { poison: 0.12 }),
      N(0, '그림자 공조', '공격력 +6%, 협공 효과 +15%', 3, { atk: 0.06, collab: 0.15 }),
      N(1, '연속 베기', '공격 속도 +7%', 3, { aspd: 0.07 }),
      N(1, '독 확산', '중독된 적이 죽으면 반경 90 적들이 남은 독의 50%를 나눠 받는다', 2, { spread: 0.5 }, { or: 'a' }),
      N(1, '부식', '중독된 적이 받는 영웅 피해 +10%', 2, { poisonAmp: 0.1 }, { or: 'a' }),
      KS(2, '신경독', '중독된 적은 1.5초 둔화되고 받는 영웅 피해 +15%', { neuro: 1, poisonAmp: 0.15 }),
      N(2, '독의 대가', '공격력 +7%', 3, { atk: 0.07 }),
      N(3, '맹독', '독 +8%', 3, { poison: 0.08 }),
      N(3, '치명 독', '치명타 확률 +5%', 2, { crit: 0.05 }, { or: 'b' }),
      N(3, '독안개', '궁극기 효과 +25%', 2, { ultPow: 0.25 }, { or: 'b' }),
      N(4, '부패', '중독된 적이 받는 영웅 피해 +8%', 2, { poisonAmp: 0.08 }),
      N(4, '독 숙련', '공격 속도 +6%', 2, { aspd: 0.06 }),
      CAP('역병', '독이 2배로 쌓이고, 중독된 적이 죽으면 반경 150 모든 적에게 역병이 퍼진다', 'plague'),
      N(5, '독의 군주', '공격력 +8%', 2, { atk: 0.08 }),
    ]),
    B('execute', '처형', '약해진 적 즉사, 보스 처형', [
      N(0, '급소 찌르기', '치명타 확률 +4%', 3, { crit: 0.04 }),
      N(0, '보스 사냥꾼', '보스 피해 +10%', 3, { boss: 0.1 }),
      N(1, '치명적 일격', '치명타 피해 +15%', 3, { critDmg: 0.15 }),
      N(1, '처형', '체력 3% 이하 일반 적 즉사', 2, { execute: 0.03 }, { or: 'a' }),
      N(1, '마무리', '체력 30% 이하 보스에게 피해 +25%', 2, { bossExec: 0.25 }, { or: 'a' }),
      KS(2, '연쇄 처형', '적을 처치하면 다음 공격 피해 +60%', { momentum: 0.6 }),
      N(2, '날카로운 칼날', '공격력 +7%', 3, { atk: 0.07 }),
      N(3, '약점 공략', '치명타 확률 +3%', 3, { crit: 0.03 }),
      N(3, '학살자', '공격 속도 +8%', 2, { aspd: 0.08 }, { or: 'b' }),
      N(3, '처형자의 눈', '치명타 피해 +25%', 2, { critDmg: 0.25 }, { or: 'b' }),
      N(4, '거물 사냥', '보스 피해 +12%', 2, { boss: 0.12 }),
      N(4, '처형 협공', '협공 효과 +15%', 2, { collab: 0.15 }),
      CAP('처형자의 낫', '5타마다 낫을 휘둘러 반경 130 적에게 공격력 250% + 체력 10% 이하 일반 적 처형', 'scythe'),
      N(5, '죽음의 손길', '공격력 +8%', 2, { atk: 0.08 }),
    ]),
  ],
};

// 혼합 노드: 두 갈래(req)에 각각 HYBRID_REQ점 이상 쓰면 열린다. 하이브리드 빌드의 보상
const H = (key, req, name, desc, max, fx) => ({ key, req, name, desc, max, fx, tier: null, or: null, ks: false, cap: null, hybrid: true });
export const TALENT_HYBRIDS = {
  knight: [
    H('oath', ['guard', 'crusade'], '성기사의 맹세', '적을 처치하면 체력 2% + 성벽 최대 내구력의 0.2% 회복', 2, { killHeal: 0.02, wallKill: 0.002 }),
    H('field', ['guard', 'command'], '전장의 지휘', '도발한 적이 받는 성벽 마법사 주문 피해 +10%, 협공 효과 +10%', 2, { tauntAmp: 0.1, collab: 0.1 }),
  ],
  ranger: [
    H('hunter', ['sniper', 'beast'], '사냥꾼의 눈', '늑대 피해 +20%, 보스 피해 +8%', 2, { wolfPow: 0.2, boss: 0.08 }),
    H('windShot', ['rapid', 'sniper'], '바람 사수', '공격력 +5%, 치명타 확률 +3%', 2, { atk: 0.05, crit: 0.03 }),
  ],
  sorcerer: [
    H('frostfire', ['fire', 'frost'], '서리불꽃', '화상 +8%, 둔화 확률 +10%', 2, { burn: 0.08, slow: 0.1 }),
    H('elemental', ['fire', 'arcane'], '원소 공명', '공격력 +5%, 협공 효과 +15%', 2, { atk: 0.05, collab: 0.15 }),
  ],
  cleric: [
    H('crusader', ['heal', 'punish'], '성전', '신성 폭발 피해 +8%p, 공격 시 회복량 +15%', 2, { smite: 0.08, heal: 0.15 }),
    H('consecrate', ['punish', 'bless'], '축성', '공격력 +5%, 처치 골드 +3%', 2, { atk: 0.05, gold: 0.03 }),
  ],
  assassin: [
    H('shadowVenom', ['shadow', 'poison'], '암영독', '기습 피해 +25%, 독 +6%', 2, { ambush: 0.25, poison: 0.06 }),
    H('reaper', ['poison', 'execute'], '사신의 계약', '처형 기준 +2%p, 중독된 적이 받는 영웅 피해 +8%', 2, { execute: 0.02, poisonAmp: 0.08 }),
  ],
};

// 추천 빌드(자동 배분 · UI 추천 표시): order = [주력 갈래(마스터), 나머지 두 갈래(번갈아 절반씩)], picks = 택1에서 고를 노드 + 혼합 노드
export const TALENT_RECOMMEND = {
  knight: { order: ['crusade', 'guard', 'command'], picks: ['crusade4', 'crusade9', 'guard4', 'guard9', 'command5', 'command9', 'oath', 'field'] },
  ranger: { order: ['rapid', 'sniper', 'beast'], picks: ['rapid4', 'rapid9', 'sniper4', 'sniper9', 'beast4', 'beast9', 'windShot', 'hunter'] },
  sorcerer: { order: ['fire', 'arcane', 'frost'], picks: ['fire4', 'fire9', 'arcane4', 'arcane10', 'frost4', 'frost9', 'elemental', 'frostfire'] },
  cleric: { order: ['punish', 'heal', 'bless'], picks: ['punish5', 'punish9', 'heal4', 'heal9', 'bless4', 'bless10', 'crusader', 'consecrate'] },
  assassin: { order: ['execute', 'poison', 'shadow'], picks: ['execute4', 'execute10', 'poison5', 'poison9', 'shadow4', 'shadow9', 'reaper', 'shadowVenom'] },
};
// 추천 빌드가 다음에 찍을 노드(없으면 null): 주력 갈래(열린 궁극·핵심 노드 먼저, 그다음 낮은 단부터) → 열린 추천 혼합 노드 → 나머지 두 갈래 중 덜 찍은 쪽 낮은 단부터 → 그래도 없으면 아무거나
export function recommendNext(hero, cls) {
  const R = TALENT_RECOMMEND[cls];
  if (!R) return null;
  const ok = n => canAllocate(hero, cls, n.key), want = n => !n.or || R.picks.includes(n.key);
  const low = b => b.nodes.filter(n => ok(n) && want(n)).sort((x, y) => !!(y.cap || y.ks) - !!(x.cap || x.ks) || x.tier - y.tier)[0]; // 열린 궁극·핵심 먼저
  const br = k => TALENTS[cls].find(b => b.key === k);
  const main = low(br(R.order[0]));
  if (main) return main;
  const hyb = TALENT_HYBRIDS[cls].find(n => ok(n) && R.picks.includes(n.key));
  if (hyb) return hyb;
  const rest = R.order.slice(1).sort((a, b) => branchSpent(hero, cls, a) - branchSpent(hero, cls, b));
  for (const k of rest) { const n = low(br(k)); if (n) return n; }
  return classNodes(cls).find(ok) || null;
}

// 효과 키(모두 0으로 시작 — 훅은 `|| 0` 없이 그대로 쓴다). 새 키는 hero.js가 읽는다(주석의 훅 위치)
export const TALENT_FX_KEYS = ['atk', 'aspd', 'hp', 'crit', 'move', 'range', 'dr', 'critDmg', 'boss',
  'taunt', 'thorns', 'killHeal', 'wallKill', 'holy', 'undead', 'aura', 'ultCd', 'ultPow',
  'pierce', 'multi', 'wolf', 'wolfPow', 'burn', 'splash', 'slow', 'freeze', 'mana',
  'heal', 'regen', 'wallRegen', 'smite', 'gold', 'xp', 'blink', 'ambush', 'poison', 'spread', 'poisonAmp', 'execute', 'bossExec',
  'tauntAmp', 'collab', // tauntAmp = 도발한 적이 받는 마법사 주문 피해(sim.js spellHit), collab = 협공 효과 배율(config.js collabPow)
  // 핵심 노드(hero.js): bash(heroTakeDamage) · critBurst/firstCrit/holyNova/momentum/emergency/neuro(performAttack) · frenzy/surge(공격 간격)
  // · packHunt/overheat/shatter(heroHit) · ultRefresh/grace/surge(castHeroUlt) · shadowStrike(blink)
  'bash', 'critBurst', 'ultRefresh', 'firstCrit', 'frenzy', 'packHunt', 'overheat', 'shatter', 'surge', 'emergency', 'holyNova',
  'grace', 'shadowStrike', 'neuro', 'momentum'];
export const CAPSTONES = Object.values(TALENTS).flatMap(bs => bs.map(b => b.nodes.find(n => n.cap).cap));

// 노드 찾기: { branch(혼합이면 null), index, node } | null
const NODE_INDEX = {};
for (const [cls, branches] of Object.entries(TALENTS)) {
  NODE_INDEX[cls] = {};
  for (const b of branches) b.nodes.forEach((node, index) => { NODE_INDEX[cls][node.key] = { branch: b, index, node }; });
  TALENT_HYBRIDS[cls].forEach((node, index) => { NODE_INDEX[cls][node.key] = { branch: null, index, node }; });
}
export const talentNode = (cls, key) => (Object.hasOwn(NODE_INDEX, cls) && Object.hasOwn(NODE_INDEX[cls], key) ? NODE_INDEX[cls][key] : null);
const classNodes = cls => [...(TALENTS[cls] || []).flatMap(b => b.nodes), ...(TALENT_HYBRIDS[cls] || [])];
// 한 갈래에서 합법적으로 찍을 수 있는 최대(택1은 큰 쪽 하나, 궁극 특성 포함)
export function branchMax(cls, branchKey) {
  const b = (TALENTS[cls] || []).find(x => x.key === branchKey);
  if (!b) return 0;
  const orMax = {};
  let s = 0;
  for (const n of b.nodes) if (n.or) orMax[n.or] = Math.max(orMax[n.or] || 0, n.max); else s += n.max;
  return s + Object.values(orMax).reduce((a, v) => a + v, 0);
}
// 클래스에서 합법적으로 찍을 수 있는 최대(궁극 특성은 하나만) — 예산(talentPoints(Lv99))보다 크다
export const talentMaxRanks = cls => (TALENTS[cls] || []).reduce((s, b) => s + branchMax(cls, b.key) - 1, 1)
  + (TALENT_HYBRIDS[cls] || []).reduce((s, n) => s + n.max, 0);

// 특성 포인트: Lv20까지 레벨당 1점, 그 뒤로 레벨당 0.44점(Lv99 = 54 = 한 갈래 전부 27 + 나머지 두 갈래 절반씩)
export const talentPoints = hero => (!hero ? 0 : hero.level <= 20 ? hero.level : 20 + Math.floor((hero.level - 20) * 0.44));
const allocOf = (hero, cls) => (hero && hero.talents && hero.talents[cls]) || {};
export const talentRank = (hero, cls, key) => allocOf(hero, cls)[key] | 0;
export function talentSpent(hero, cls) {
  let s = 0;
  for (const v of Object.values(allocOf(hero, cls))) s += v | 0;
  return s;
}
export const talentLeft = (hero, cls) => Math.max(0, talentPoints(hero) - talentSpent(hero, cls));
// 한 갈래에 쓴 포인트(단 해금 · 혼합 노드 · 협공 갈래 조건)
export function branchSpent(hero, cls, branchKey) {
  const b = (TALENTS[cls] || []).find(x => x.key === branchKey), a = allocOf(hero, cls);
  return b ? b.nodes.reduce((s, n) => s + (a[n.key] | 0), 0) : 0;
}
// 다음 단까지 남은 갈래 포인트(모든 단이 열렸으면 0)
export function nextTierNeed(hero, cls, branchKey) {
  const s = branchSpent(hero, cls, branchKey), req = TIER_REQ.find(r => r > s);
  return req == null ? 0 : req - s;
}
// 찍은 궁극 특성 키(없으면 null)
export function talentCap(hero, cls) {
  const a = allocOf(hero, cls);
  for (const b of TALENTS[cls] || []) for (const n of b.nodes) if (n.cap && a[n.key] > 0) return n.cap;
  return null;
}

// 왜 못 찍나: null(찍을 수 있음) | { code, msg(한국어) }. code: max · points · tier · or · cap · hybrid · none
export function talentBlock(hero, cls, key) {
  const f = talentNode(cls, key);
  if (!f || !hero) return { code: 'none', msg: '없는 특성이에요' };
  const n = f.node, r = talentRank(hero, cls, key);
  if (r >= n.max) return { code: 'max', msg: '최대 랭크예요' };
  if (n.hybrid) {
    const lack = n.req.map(bk => [bk, HYBRID_REQ - branchSpent(hero, cls, bk)]).filter(([, d]) => d > 0);
    if (lack.length) return { code: 'hybrid', msg: lack.map(([bk, d]) => `${TALENTS[cls].find(b => b.key === bk).name} ${d}점 더`).join(' · ') + ' 찍으면 열려요' };
  } else {
    if (n.cap && r === 0 && talentCap(hero, cls)) return { code: 'cap', msg: '궁극 특성은 하나만 — 초기화하면 다시 고를 수 있어요' }; // 단 조건보다 먼저: 점수를 더 찍어도 안 열린다
    const need = TIER_REQ[n.tier] - branchSpent(hero, cls, f.branch.key);
    if (need > 0) return { code: 'tier', msg: `${f.branch.name} 갈래에 ${need}점 더 찍으면 ${n.tier + 1}단이 열려요` };
    if (n.or && r === 0) {
      const other = f.branch.nodes.find(x => x.or === n.or && x !== n && talentRank(hero, cls, x.key) > 0);
      if (other) return { code: 'or', msg: `〈${other.name}〉와 둘 중 하나만 고를 수 있어요` };
    }
  }
  if (talentLeft(hero, cls) <= 0) return { code: 'points', msg: '남은 포인트가 없어요 — 레벨이 오르면 생겨요' };
  return null;
}
export const canAllocate = (hero, cls, key) => !talentBlock(hero, cls, key);

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

// 신뢰할 수 없는 저장값 → 유효한 배분. 규칙을 어긴 클래스는 비운다(초기화는 무료라 손해 없음)
// 단 오름차순 → 혼합 노드 순으로 다시 찍어 본다(단은 앞 단 포인트로만 열리므로 이 순서면 합법 배분은 전부 재현된다)
export function normalizeTalents(raw, level) {
  const out = {};
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const probe = { level, talents: out };
  for (const cls of Object.keys(TALENTS)) {
    const a = src[cls] && typeof src[cls] === 'object' && !Array.isArray(src[cls]) ? src[cls] : {};
    out[cls] = {};
    let ok = Object.keys(a).every(k => talentNode(cls, k));
    const order = [...TALENTS[cls].flatMap(b => b.nodes)].sort((x, y) => x.tier - y.tier).concat(TALENT_HYBRIDS[cls]);
    for (const n of order) {
      const want = Math.floor(Number(a[n.key]));
      if (!(want > 0)) continue;
      for (let r = 0; r < Math.min(want, n.max); r++) if (!allocateTalent(probe, cls, n.key)) ok = false;
      if (want > n.max) ok = false;
    }
    if (!ok || !Object.keys(out[cls]).length) delete out[cls];
  }
  return out;
}

// 저장 이전(save.js): 특성 구조 버전이 다르면 모든 클래스 배분을 비워 포인트를 돌려준다(포인트는 레벨로 계산 — 손실 없음).
// → { talents, notice } notice = 실제로 돌려받은 포인트가 있었나(정비 화면 1회 안내)
export function migrateTalents(raw, ver, level) {
  if (ver === TALENT_VER) return { talents: normalizeTalents(raw, level), notice: false };
  const had = raw && typeof raw === 'object' && Object.values(raw).some(a => a && typeof a === 'object' && Object.values(a).some(v => Number(v) > 0));
  return { talents: {}, notice: !!had };
}
export { classNodes };

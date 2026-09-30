// 갈림길(층 사이 선택) — 표 · 흐름 · sim 훅 · 봇 정책. DOM 없음 (docs/DESIGN.md 'v0.1.6 갈림길 계약')
// 끝자리 3·7층을 깨면 세 갈래 중 하나를 고르고, 효과는 다음 층에. 후일 세계 지도의 노드 종류로 그대로 쓴다(키 목록만 넘기면 된다).
import { MAX_STAGE } from './config.js';
import { serializeRun, triggerPick } from './sim.js';
import { toInt } from './util.js';

export const FORK_AT = [3, 7];   // 이 끝자리 층을 깨면 갈림길(→ 4·8·14·18…층에 효과). 보스(0)·지역 첫 층(1)과 안 겹침
export const FORK_N = 3;         // 한 번에 보여 주는 갈래 수
export const PATH_AUTO_T = 0.45; // 카드 '자동 선택' ON이면 추천 갈래를 잠깐 보여 주고 이 초 뒤 고름
export const MERCHANT_CUT = 0.3; // 상인: 이번 도전 골드의 이만큼
export const CURSE_FLOORS = 3, CURSE_HP = 1.3, ELITE_HP = 1.5;
export const PATH_TEST = { off: false }; // 테스트·A/B 러너 전용 스위치(갈림길 끄기)
export const FARM_FRAC = 0.6; // 정복한 층(도전 시작 최고 기록의 60% 이하 — sim FAST_FRAC과 같은 값)으로 가는 길엔 갈림길 없음: 다시 오르는 층은 빠르게

export const PATHS = [
  { key: 'merchant', name: '떠돌이 상인', icon: 'coin', tone: '#ffcf4a', cards: 1, up: '스킬 카드 1장', down: '이번 도전 골드 30%', avail: g => g.players[0].gold >= 1 },
  { key: 'altar', name: '저주 제단', icon: 'el-dark', tone: '#b35cff', cards: 2, up: '스킬 카드 2장', down: `다음 ${CURSE_FLOORS}층 적 체력 +30%` },
  { key: 'elite', name: '정예 층', icon: 'crit', tone: '#ff5a5a', cards: 2, up: '깨면 스킬 카드 2장', down: '다음 층 적 체력 +50%' },
  { key: 'spring', name: '지혜의 샘', icon: 'el-holy', tone: '#4fd8ff', up: '새로고침 +2 · 망각 +1', down: '대가 없음', avail: g => !g.rfx?.noReroll }, // 모래시계 봉인(새로고침 없음)이면 안 나온다
];
export const PATH_KEYS = PATHS.map(p => p.key);
export const PATH_BY_KEY = Object.fromEntries(PATHS.map(p => [p.key, p]));

const emit = (g, ev) => { if (g.events.length < 4000) g.events.push(ev); };
const picker = g => !!(g.players[0].autoPick || g.players[0].kind === 'bot');
export const merchantCost = g => Math.max(1, Math.ceil(g.players[0].gold * MERCHANT_CUT));
export const forkAt = stage => stage < MAX_STAGE && FORK_AT.includes(stage % 10);
// 정복한 층을 다시 오르는 중이면 첫 갈림길이 뜨는 층(HUD 안내 '갈림길 N층~'), 아니면 0. onPathClear 문턱과 같은 식
// ponytail: 농사 층에도 첫 갈림길을 주면 캠페인 궤적이 바뀌어 협공 동등성 목표를 벗어났다(+32%) — 문턱은 두고 안내만
export function nextForkAt(g) {
  const gate = Math.floor((g.run?.startBest || 0) * FARM_FRAC);
  if (g.stage + 1 > gate) return 0;
  for (let s = g.stage; s < MAX_STAGE; s++) if (forkAt(s) && s + 1 > gate) return s;
  return 0;
}

// 갈래 후보: keys(없으면 조건이 맞는 전부) 중 무작위 FORK_N개, 표 순서로
export function offerFork(g, keys = PATH_KEYS) {
  let pool = keys.filter(k => PATH_BY_KEY[k] && (!PATH_BY_KEY[k].avail || PATH_BY_KEY[k].avail(g)));
  while (pool.length > FORK_N) pool.splice(Math.floor((g.pathRng || g.rng)() * pool.length), 1);
  if (!pool.length) return false;
  g.path.fork = { opts: pool, autoLeft: picker(g) ? PATH_AUTO_T : null };
  emit(g, { type: 'pathOffer', opts: pool });
  return true;
}

// sim 클리어(체크포인트 전): 정예 보상 · 저주 층 수 · 갈림길 후보
export function onPathClear(g) {
  const p = g.path;
  if (p.elite) { p.elite = false; p.cards += PATH_BY_KEY.elite.cards; emit(g, { type: 'pathProc', key: 'elite' }); }
  if (p.curse > 0) p.curse--;
  if (forkAt(g.stage) && !g.run.over && !PATH_TEST.off && g.stage + 1 > Math.floor(g.run.startBest * FARM_FRAC)) offerFork(g);
}
// sim startStage 끝(체크포인트 뒤): 대기 카드 — 층 도중에 꺼도 이어하기가 체크포인트의 대기 카드로 다시 준다
export function pathStageStart(g) {
  for (; g.path.cards > 0; g.path.cards--) triggerPick(g);
}
// 적 체력 배율(sim spawnEnemy): 저주 × 정예
export const pathHpMul = (g, boss) => boss ? 1 : (g.path.curse > 0 ? CURSE_HP : 1) * (g.path.elite ? ELITE_HP : 1); // 보스는 제외(끝자리 7의 저주가 10층 보스에 닿지 않게)

// 고르기 act(g, 0, {type:'path', index}). 체크포인트: 클리어 중이면 다음 층, 층 시작(이어하기)이면 이 층 — 그 뒤 대기 카드
export function choosePath(g, index) {
  const f = g.path.fork;
  if (!f || !Number.isInteger(index) || index < 0 || index >= f.opts.length) return false;
  const key = f.opts[index], p = g.path;
  if (key === 'merchant') {
    const c = merchantCost(g);
    if (g.players[0].gold < c) return false;
    g.players[0].gold -= c;
    p.cards += PATH_BY_KEY.merchant.cards;
  } else if (key === 'altar') { p.cards += PATH_BY_KEY.altar.cards; p.curse = CURSE_FLOORS; }
  else if (key === 'elite') p.elite = true;
  else if (key === 'spring') { g.rerollLeft += 2; g.forgetLeft += 1; }
  p.fork = null;
  p.taken.push(key);
  emit(g, { type: 'pathPick', key });
  const clear = g.phase === 'clear';
  g.run.checkpoint = clear ? { ...serializeRun(g), stage: g.stage + 1 } : serializeRun(g);
  if (!clear) pathStageStart(g);
  return true;
}

// 갈림길 화면이 보이는 동안 실시간 델타(main.js). 자동 선택 ON·봇이면 PATH_AUTO_T초 뒤 추천
export function tickPath(g, dtReal) {
  const f = g.path?.fork;
  if (!f || !(dtReal > 0)) return;
  if (!picker(g)) { f.autoLeft = null; return; }
  if (f.autoLeft == null) f.autoLeft = PATH_AUTO_T;
  if ((f.autoLeft -= dtReal) <= 0) choosePath(g, pickPath(g));
}

// 추천(봇 · 자동 선택): 최고 기록보다 한참 아래 = 위험을 사서 카드, 최전선 = 안전하게
// ponytail: 층 위치만 보는 휴리스틱. 성벽 여유·빌드 강도까지 볼 일이 생기면 여기서
export function pickPath(g, opts = g.path?.fork?.opts || []) {
  const easy = g.stage + 1 <= g.run.startBest * 0.75;
  const S = easy ? { elite: 8, altar: 7, merchant: 5, spring: 3 } : { merchant: 6, spring: 5, altar: 3, elite: 2 };
  let best = 0;
  opts.forEach((k, i) => { if ((S[k] || 0) > (S[opts[best]] || 0)) best = i; });
  return best;
}

// ── 저장 ──
export const pathSave = g => ({ fork: g.path.fork ? [...g.path.fork.opts] : null, cards: g.path.cards, curse: g.path.curse, elite: g.path.elite, taken: [...g.path.taken] });
// 신뢰할 수 없는 저장값 → 모양 검증(throw 없음, 옛 저장 = 빈 값). pathSave와 같은 모양(멱등)
export function normPath(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const fork = Array.isArray(r.fork) ? [...new Set(r.fork)].filter(k => PATH_KEYS.includes(k)).slice(0, FORK_N) : [];
  return {
    fork: fork.length ? fork : null,
    cards: toInt(r.cards, 0, 9), curse: toInt(r.curse, 0, CURSE_FLOORS), elite: !!r.elite,
    taken: (Array.isArray(r.taken) ? r.taken : []).filter(k => PATH_KEYS.includes(k)).slice(-50),
  };
}
// createGame: 정규화된 런 저장 → g.path(떠 있던 갈림길은 이어하기에서 층 시작 전에 다시 — 자동 선택 여부는 tickPath가 정한다)
export const initPath = p => ({ ...p, fork: p.fork ? { opts: [...p.fork], autoLeft: null } : null, taken: [...p.taken] });

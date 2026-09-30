// 영웅 특성 트리 UI (DOM) — 정비 화면 '특성' 탭과 영웅 화면 '특성' 탭(도전 중 빠른 배분)이 같이 쓴다.
// 한눈에 보는 밀도형: 3갈래를 늘 나란히(열) × 6단(행), 왼쪽 축이 단 번호·해금 포인트. 노드는 작은 칩(그림 · 랭크 눈금 · 잠김/택1/핵심/궁극/혼합 모양),
// 이름·설명은 누르면 뜨는 상세 시트(찍기/빼기, 택1은 다른 쪽 비교 카드). 갈래 머리 = 쓴 포인트 · 다음 단까지 남은 점수(아래 테 진행선).
// 궁극 특성은 클래스당 하나 · 혼합 노드는 두 갈래 사이 아래 띠(괄호선) · 추천 다음 노드 · 무료 초기화(정비 화면만)
// 폰 360도 3열이 들어가게 칩 크기는 컨테이너 폭으로(넓으면 이름까지). 재질 kit.css(.k-*), 배치 hero.css(.tt-*)
import {
  TALENTS, TALENT_HYBRIDS, TALENT_RECOMMEND, TIER_REQ, HYBRID_REQ, talentPoints, talentSpent, talentLeft, talentRank, talentNode,
  talentBlock, refundBlock, branchSpent, branchMax, nextTierNeed, talentCap, recommendNext,
} from './talents.js';
import { HERO_CLASSES } from './hero.js';
import { icon } from './icons.js';
import { emblemImg } from './art/emblems.js';

// 노드 그림: 효과 키 → SVG 아이콘(icon) 또는 그린 엠블럼('em:' 접두사)
const FX_ICON = {
  atk: 'atk', aspd: 'rate', move: 'speed', hp: 'hero', crit: 'crit', critDmg: 'crit', range: 'multi',
  multi: 'multi', boss: 'em:giant', dr: 'wall', taunt: 'wall', thorns: 'em:thorns', killHeal: 'el-holy', wallKill: 'wall',
  holy: 'el-holy', aura: 'em:twin', ultCd: 'reroll', ultPow: 'meteor', wolf: 'el-summon', wolfPow: 'el-summon',
  burn: 'el-fire', splash: 'em:fireball', slow: 'el-frost', freeze: 'freeze', mana: 'em:chain', heal: 'el-holy', regen: 'em:holyLight',
  wallRegen: 'wall', smite: 'em:judgment', gold: 'coin', xp: 'hero', blink: 'el-wind', ambush: 'crit', poison: 'el-dark',
  spread: 'em:curseMark', poisonAmp: 'el-dark', execute: 'em:soulHarvest', tauntAmp: 'em:twin', collab: 'partner',
  bash: 'em:thorns', critBurst: 'em:critBoom', ultRefresh: 'em:chain', firstCrit: 'em:pierce', frenzy: 'em:frenzy', packHunt: 'el-summon',
  overheat: 'em:flame', shatter: 'em:glacier', surge: 'em:twin', emergency: 'em:holyLight', holyNova: 'em:judgment', grace: 'em:flawless',
  shadowStrike: 'em:double', neuro: 'em:curseMark', momentum: 'em:chainboom',
  // 택1(4차) — 한 묶음의 두 쪽은 서로 다른 그림
  hunt: 'em:giant', guardWall: 'em:stoneGolem', cull: 'em:soulHarvest', focus: 'em:pierce', hold: 'wall', charge: 'em:gale',
  pointBlank: 'multi', chillAura: 'em:glacier', killBlink: 'em:double', longshot: 'em:homing', heavy: 'em:wallBroken', cleave: 'em:flame',
  bounce: 'em:chainLightning', split: 'em:flameBullet', corpse: 'em:chainboom', evade: 'el-wind', wolfStun: 'el-summon',
  ultCharge: 'em:lightningStrike', soulFeed: 'rate', lifesteal: 'em:holyLight', berserk: 'em:frenzy', wolfUlt: 'em:babyDragon',
  mark: 'em:curseMark', pull: 'em:tornado', ultBless: 'em:golden', wolfGuard: 'em:frostWard', wolfFocus: 'em:homing',
};
const CAP_ICON = {
  shieldToss: 'thorns', judgeBolt: 'judgment', warcry: 'frenzy', snipe: 'pierce', arrowStorm: 'double', wolfPack: 'babyDragon',
  meteor: 'fireball', absZero: 'glacier', arcaneClone: 'twin', reviveWard: 'holyLight', pillar: 'giant', cardBless: 'legend',
  shadowTwins: 'double', plague: 'curseMark', scythe: 'soulHarvest',
};
const art = key => (key.startsWith('em:') ? emblemImg(key.slice(3), 'em') : icon(key));
export const nodeArt = node => (node.cap ? emblemImg(CAP_ICON[node.cap] || 'legend', 'em') : art(FX_ICON[Object.keys(node.fx)[0]] || 'atk'));
export const BRANCH_COL = ['#ff8a3a', '#4fb8ff', '#c07aff']; // 갈래 색(주황 · 하늘 · 보라)

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const TIERS = TIER_REQ.length;

// host: 트리를 넣을 요소 · sheetHost: 상세 시트·확인 창이 뜰 전체 화면 요소(position 기준)
// H: onAllocate(key) → bool · onReset() → bool(정비 화면만, 없으면 초기화 버튼 숨김) · onRefund(key) → bool(정비 화면만 — 1랭크 빼기, 없으면 빼기 버튼 숨김)
//    · onAutoToggle(on) · toast(msg, icon)
export function createTalentTree(host, sheetHost, H = {}) {
  const el = document.createElement('div');
  el.className = 'tt';
  el.innerHTML = `
    <div class="tt-top">
      <div class="tt-pts"><span class="tt-pts-l">포인트</span><b class="k-num gold tt-left">0</b><span class="tt-of">/ 0</span></div>
      <label class="tt-auto"><button class="k-toggle tt-autobtn" aria-pressed="false" aria-label="자동 배분"></button><span>자동 배분</span></label>
      <button class="k-btn s gray tt-reset">${icon('reroll')}초기화</button>
    </div>
    <p class="tt-hint"></p>
    <div class="tt-tree"></div>`;
  host.append(el);

  const sheet = document.createElement('div');
  sheet.className = 'tt-ov';
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="k-modal dark narrow tt-sheet" role="dialog" aria-modal="true">
      <div class="k-ribbon tt-sh-rb"><h2 class="tt-sh-name"></h2></div>
      <button class="k-close tt-sh-close" aria-label="닫기">${icon('close')}</button>
      <div class="k-sheet">
        <div class="tt-sh-art"><i class="tt-sh-rays" aria-hidden="true"></i><span class="tt-sh-ico"></span></div>
        <div class="tt-sh-meta"></div>
        <div class="tt-sh-ranks"></div>
        <div class="tt-sh-desc"><b class="tt-sh-lbl"></b><p class="tt-sh-txt"></p></div>
        <div class="tt-sh-alt" hidden></div>
        <p class="tt-sh-why"></p>
        <div class="tt-sh-acts"><button class="k-btn neutral l tt-sh-rf" aria-label="1랭크 빼기 — 포인트 1점 돌려받기">빼기 <span class="tt-sh-cost">+1</span></button><button class="k-btn success l wide tt-sh-go"></button></div>
        <p class="tt-sh-rfwhy" hidden></p>
      </div>
    </div>
    <div class="k-modal narrow tt-confirm" role="alertdialog" aria-modal="true" hidden>
      <div class="k-ribbon red"><h2>특성 초기화</h2></div>
      <div class="k-sheet center">
        <p class="tt-cf-txt"></p>
        <div class="tt-cf-btns"><button class="k-btn gray tt-cf-no">취소</button><button class="k-btn danger tt-cf-yes">초기화</button></div>
      </div>
    </div>`;
  sheetHost.append(sheet);

  const $ = s => el.querySelector(s), $s = s => sheet.querySelector(s);
  const leftEl = $('.tt-left'), ofEl = $('.tt-of'), hintEl = $('.tt-hint'), treeEl = $('.tt-tree');
  const autoBtn = $('.tt-autobtn'), resetBtn = $('.tt-reset');
  const shBox = $s('.tt-sheet'), cfBox = $s('.tt-confirm'), goBtn = $s('.tt-sh-go'), rfBtn = $s('.tt-sh-rf'), rfWhy = $s('.tt-sh-rfwhy');
  let hero = null, cls = null, sig = '', openKey = null, built = null;

  // 노드 칩: 그림 원판 + 랭크 눈금(아래) · 이름은 넓고 키 큰 화면에서만(아니면 시트에서 · 택1 분류 알약도 시트)
  const nodeBtn = (n, bi, extra = '') => `
    <button class="tt-node${n.cap ? ' cap' : ''}${n.ks ? ' ks' : ''}${n.hybrid ? ' hyb' : ''}" data-key="${n.key}" style="--i:${bi}">
      <span class="tt-disc"><span class="tt-ico">${nodeArt(n)}</span><span class="tt-lock">${icon('lock')}</span><span class="tt-plus" aria-hidden="true"></span></span>
      <span class="tt-pips" aria-hidden="true">${'<i></i>'.repeat(n.max)}</span><em class="tt-rec" aria-hidden="true">추천</em>
      <span class="tt-name">${esc(n.name)}</span>${extra}
    </button>`;

  // 트리 뼈대는 클래스가 바뀔 때만 다시 만든다(노드 상태만 갱신). 격자 = [단 축] [갈래 ×3] · 아래 혼합 띠(축 + 반칸 6개 → 갈래 가운데끼리 잇는다)
  function build() {
    built = cls;
    const branches = TALENTS[cls] || [];
    const axis = `<div class="tt-axis" aria-hidden="true"><span class="tt-axh">단</span>${TIER_REQ.map((r, t) => `<span class="tt-ax"><b>${t + 1}</b><small>${r || '—'}</small></span>`).join('')}</div>`;
    const branchHtml = (b, bi) => {
      let rows = '';
      for (let t = 0; t < TIERS; t++) { // 빈 단도 줄은 남긴다(세 갈래 행 맞춤)
        let cells = '', seen = new Set();
        const ns = b.nodes.filter(n => n.tier === t);
        for (const n of ns) {
          if (!n.or) { cells += nodeBtn(n, bi * 14 + t); continue; }
          if (seen.has(n.or)) continue;
          seen.add(n.or);
          const pair = ns.filter(x => x.or === n.or);
          cells += `<div class="tt-or" data-or="${n.or}">${nodeBtn(pair[0], bi * 14 + t)}<span class="tt-orw" aria-hidden="true">또는</span>${nodeBtn(pair[1], bi * 14 + t)}</div>`;
        }
        rows += `<div class="tt-tier" data-t="${t}">${cells}</div>`;
      }
      return `<section class="tt-br" style="--b:${BRANCH_COL[bi]}" data-b="${bi}" data-key="${b.key}" aria-label="${esc(b.name)} 갈래">
        <header class="tt-bh" title="${esc(b.desc)}"><div class="tt-bh-top"><i class="tt-bdot"></i><b>${esc(b.name)}</b><span class="tt-bpts k-num">0</span></div>
          <p>${esc(b.desc)}</p><span class="tt-ntxt"></span><i class="tt-nbar"><i></i></i></header>
        <div class="tt-rows">${rows}</div>
      </section>`;
    };
    const hyb = TALENT_HYBRIDS[cls] || [];
    // 두 혼합의 갈래 구간이 겹치면(0-1 · 0-2) 괄호선 격자는 두 줄이 된다 → .tt-hy2: 키 작은 폰에선 한 줄 칩으로(hero.css)
    const span = n => n.req.map(k => branches.findIndex(x => x.key === k)).sort();
    const stack = hyb.some((x, i) => hyb.some((y, j) => i < j && span(x)[0] < span(y)[1] && span(y)[0] < span(x)[1]));
    const hybHtml = hyb.map(n => {
      const [a, b] = n.req.map(k => branches.findIndex(x => x.key === k));
      const lo = Math.min(a, b), hi = Math.max(a, b);
      const req = `<span class="tt-hyreq"><i style="--b:${BRANCH_COL[a]}"></i>${HYBRID_REQ}<i style="--b:${BRANCH_COL[b]}"></i>${HYBRID_REQ}</span>`;
      return `<div class="tt-hy" style="--ba:${BRANCH_COL[lo]};--bb:${BRANCH_COL[hi]};--c0:${lo * 2 + 3};--c1:${hi * 2 + 3}" data-req="${a},${b}">${nodeBtn(n, 40, req)}</div>`;
    }).join('');
    treeEl.innerHTML = axis + branches.map(branchHtml).join('')
      + (hyb.length ? `<div class="tt-hyband${stack ? ' tt-hy2' : ''}" title="혼합 특성 — 두 갈래에 각각 ${HYBRID_REQ}점 이상 찍으면 열려요"><span class="tt-hyh" aria-hidden="true">혼합</span>${hybHtml}</div>` : '');
    for (const b of treeEl.querySelectorAll('.tt-node')) b.addEventListener('click', () => openSheet(b.dataset.key));
  }

  // 노드 상태: max · ranked · avail(찍을 수 있음) · open(열렸지만 포인트 없음) · locked(단/혼합 조건) · alt(택1 다른 쪽) · capLock(궁극은 하나만)
  function nodeState(n) {
    const r = talentRank(hero, cls, n.key);
    if (r >= n.max) return 'max';
    if (r > 0) return 'ranked';
    if (n.cap && talentCap(hero, cls)) return 'capLock'; // 다른 갈래 궁극을 이미 찍음(단 잠김보다 먼저 보여 준다)
    const bl = talentBlock(hero, cls, n.key);
    return !bl ? 'avail' : bl.code === 'or' ? 'alt' : bl.code === 'cap' ? 'capLock' : bl.code === 'points' ? 'open' : 'locked';
  }
  function paintNode(btn, n) {
    const st = nodeState(n), r = talentRank(hero, cls, n.key);
    if (btn.dataset.st !== st) {
      if (btn.dataset.st && (st === 'max' || st === 'ranked')) btn.animate([{ scale: 1 }, { scale: 1.22, offset: 0.35 }, { scale: 1 }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      btn.dataset.st = st;
    }
    btn.classList.toggle('can', st === 'avail');
    btn.querySelectorAll('.tt-pips i').forEach((p, i) => p.classList.toggle('on', i < r));
    const lbl = { locked: ', 잠김', alt: ', 다른 쪽을 골랐어요', capLock: ', 궁극 특성은 하나만' }[st] || '';
    btn.setAttribute('aria-label', `${n.name} ${r}/${n.max}${lbl}`);
    return st;
  }

  function render(h, c, force = false) {
    hero = h; cls = c && TALENTS[c] ? c : h?.cls;
    if (!hero || !TALENTS[cls]) { el.hidden = true; return; }
    el.hidden = false;
    const s = cls + '|' + hero.level + '|' + JSON.stringify(hero.talents?.[cls] || {}) + '|' + !!hero.autoTalent;
    if (!force && s === sig) return;
    sig = s;
    if (built !== cls) build();
    const left = talentLeft(hero, cls), total = talentPoints(hero), capKey = talentCap(hero, cls);
    leftEl.textContent = String(left);
    ofEl.textContent = `/ ${total}`;
    el.classList.toggle('has-pts', left > 0);
    autoBtn.setAttribute('aria-pressed', String(!!hero.autoTalent));
    resetBtn.hidden = !H.onReset;
    resetBtn.disabled = !talentSpent(hero, cls);
    const rec = left > 0 ? recommendNext(hero, cls) : null;
    const main = TALENTS[cls].find(b => b.key === TALENT_RECOMMEND[cls]?.order[0]);
    hintEl.innerHTML = left > 0 // 한두 줄로: 무엇을 누르나 · 단 규칙 · 추천 갈래
      ? `빛나는 칩을 눌러 찍어요 · 단은 <b>그 갈래에 쓴 포인트</b>로 열려요${H.onRefund && talentSpent(hero, cls) ? ' · 찍은 칩은 눌러서 빼기' : ''}${main ? ` · 추천 <b style="color:${BRANCH_COL[TALENTS[cls].indexOf(main)]}">${esc(main.name)}</b> 마스터` : ''}`
      : H.onReset ? `레벨이 오르면 포인트가 생겨요${H.onRefund ? ' · 찍은 칩을 눌러 <b>하나씩 빼기</b>' : ''} · 초기화 무료` : '레벨이 오르면 포인트가 생겨요 · 칩을 누르면 자세히';
    const secs = treeEl.querySelectorAll('.tt-br');
    TALENTS[cls].forEach((b, bi) => {
      const sec = secs[bi], spent = branchSpent(hero, cls, b.key), max = branchMax(cls, b.key), need = nextTierNeed(hero, cls, b.key);
      for (const n of b.nodes) {
        const btn = sec.querySelector(`[data-key="${n.key}"]`);
        paintNode(btn, n);
        btn.classList.toggle('rec', !!rec && rec.key === n.key);
      }
      // 택1: 한쪽을 고르면 묶음이 '결정됨'
      for (const o of sec.querySelectorAll('.tt-or')) o.classList.toggle('picked', [...o.querySelectorAll('.tt-node')].some(x => talentRank(hero, cls, x.dataset.key) > 0));
      for (const row of sec.querySelectorAll('.tt-tier')) row.classList.toggle('open', spent >= TIER_REQ[+row.dataset.t]); // 안 열린 단은 흐리게
      sec.querySelector('.tt-bpts').textContent = `${spent}/${max}`;
      const nt = sec.querySelector('.tt-ntxt'), cur = TIER_REQ.filter(r => r <= spent).length;
      nt.innerHTML = need ? `다음 단 <b class="k-num">+${need}</b>` : spent >= max ? '마스터!' : '모든 단 열림';
      nt.title = need ? `다음 단 해금까지 ${need}점` : '';
      sec.querySelector('.tt-nbar').style.setProperty('--p', need ? ((spent - TIER_REQ[cur - 1]) / (TIER_REQ[cur] - TIER_REQ[cur - 1])).toFixed(3) : '1');
      sec.classList.toggle('done', spent >= max);
      sec.classList.toggle('capped', !!capKey && !b.nodes.some(n => n.cap === capKey));
    });
    for (const n of TALENT_HYBRIDS[cls] || []) {
      const btn = treeEl.querySelector(`.tt-hy [data-key="${n.key}"]`);
      const st = paintNode(btn, n);
      btn.classList.toggle('rec', !!rec && rec.key === n.key);
      btn.closest('.tt-hy').classList.toggle('open', st !== 'locked');
    }
    if (openKey) fillSheet();
  }

  // ── 상세 시트 ──
  function openSheet(key) {
    openKey = key;
    cfBox.hidden = true;
    shBox.hidden = false;
    fillSheet();
    sheet.hidden = false;
    goBtn.focus({ preventScroll: true });
  }
  function fillSheet() {
    const f = talentNode(cls, openKey);
    if (!f) { closeSheet(); return; }
    const { node: n, branch: b } = f, bi = b ? TALENTS[cls].indexOf(b) : -1;
    const r = talentRank(hero, cls, n.key);
    shBox.style.setProperty('--b', bi >= 0 ? BRANCH_COL[bi] : '#ffd23a');
    shBox.classList.toggle('cap', !!n.cap);
    shBox.classList.toggle('ks', !!n.ks);
    $s('.tt-sh-rb').classList.toggle('gold', !!n.cap);
    $s('.tt-sh-name').textContent = n.name;
    $s('.tt-sh-ico').innerHTML = nodeArt(n);
    const where = b ? `${esc(b.name)} ${n.tier + 1}단` : `혼합 · ${n.req.map(k => esc(TALENTS[cls].find(x => x.key === k).name)).join(' + ')}`;
    $s('.tt-sh-meta').innerHTML = `<span class="tt-sh-branch">${esc(HERO_CLASSES[cls].name)} · ${where}</span>`
      + (n.cap ? '<span class="tt-sh-tag cap">궁극 특성</span>' : n.ks ? '<span class="tt-sh-tag ks">핵심</span>' : '')
      + (n.or ? '<span class="tt-sh-tag or">택1</span>' : '') + (n.tag ? `<span class="tt-sh-tag st" data-tag="${esc(n.tag)}">${esc(n.tag)}</span>` : '') + (n.hybrid ? '<span class="tt-sh-tag hy">혼합</span>' : '');
    $s('.tt-sh-ranks').innerHTML = Array.from({ length: n.max }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('') + `<b class="k-num">${r} / ${n.max}</b>`;
    $s('.tt-sh-lbl').textContent = n.cap ? '전투 방식이 바뀌어요 · 클래스당 하나' : n.ks ? '핵심 — 싸우는 방식이 바뀌어요' : n.max > 1 ? '랭크마다' : '효과';
    $s('.tt-sh-txt').textContent = n.desc;
    const alt = n.or ? b.nodes.find(x => x.or === n.or && x !== n) : null, altEl = $s('.tt-sh-alt');
    altEl.hidden = !alt;
    if (alt) { // 택1: 다른 쪽을 나란히 — 누르면 그쪽 시트로
      const took = talentRank(hero, cls, alt.key) > 0; // 이미 다른 쪽을 골랐으면 아래 사유 줄이 같은 말을 한다
      altEl.innerHTML = `<span class="tt-vs">또는</span>
        <button class="tt-alt-card${took ? ' on' : ''}" data-alt="${alt.key}"><span class="tt-alt-ico">${nodeArt(alt)}</span>
          <span class="tt-alt-txt"><b>${esc(alt.name)}</b><em data-tag="${esc(alt.tag)}">${esc(alt.tag)}</em><span>${esc(alt.desc)}</span></span></button>
        ${took ? '' : `<small>둘 중 하나만 — ${H.onRefund ? '찍은 쪽을 모두 빼면 다시 고를 수 있어요' : '바꾸려면 정비 화면에서 빼거나 초기화'}</small>`}`;
    }
    const bl = talentBlock(hero, cls, n.key), can = !bl;
    const whyEl = $s('.tt-sh-why');
    whyEl.textContent = can ? `남은 포인트 ${talentLeft(hero, cls)}점` : H.onRefund ? bl.msg.replace('정비 화면에서 ', '') : bl.msg; // 이미 정비 화면
    whyEl.classList.toggle('bad', !can && r < n.max);
    goBtn.disabled = !can;
    goBtn.innerHTML = r >= n.max ? `${icon('check')}최대 랭크` : can ? `찍기 <span class="tt-sh-cost">-1</span>` : icon('lock') + '잠김';
    // 1랭크 빼기(정비 화면): 다른 배분을 깨면 잠그고 이유를 보여 준다
    const rbl = H.onRefund && r > 0 ? refundBlock(hero, cls, n.key) : null;
    rfBtn.hidden = !(H.onRefund && r > 0);
    rfBtn.disabled = !!rbl;
    rfWhy.hidden = !rbl;
    rfWhy.textContent = rbl ? rbl.msg : '';
  }
  function closeSheet() { sheet.hidden = true; openKey = null; }
  goBtn.addEventListener('click', () => {
    if (!openKey || goBtn.disabled) return;
    const key = openKey;
    if (H.onAllocate?.(key) === false) { goBtn.classList.add('shake'); setTimeout(() => goBtn.classList.remove('shake'), 260); return; }
    render(hero, cls, true);
    const b = treeEl.querySelector(`[data-key="${key}"]`);
    if (b) { b.classList.remove('burst'); void b.offsetWidth; b.classList.add('burst'); }
    shBox.querySelector('.tt-sh-art').animate([{ scale: 1 }, { scale: 1.15, offset: 0.3 }, { scale: 1 }], { duration: 300, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  });
  rfBtn.addEventListener('click', () => {
    if (!openKey || rfBtn.disabled) return;
    const key = openKey, wasAuto = !!hero.autoTalent;
    if (H.onRefund?.(key) === false) { rfBtn.classList.add('shake'); setTimeout(() => rfBtn.classList.remove('shake'), 260); return; }
    render(hero, cls, true);
    if (rfBtn.hidden) goBtn.focus(); // 0랭크가 되어 버튼이 숨으면 포커스를 잃지 않게
    if (wasAuto && !hero.autoTalent) H.toast?.('자동 배분을 껐어요 · 직접 찍어 주세요', 'hero');
    shBox.querySelector('.tt-sh-art').animate([{ scale: 1 }, { scale: 0.86, offset: 0.3 }, { scale: 1 }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
  });
  $s('.tt-sh-close').addEventListener('click', closeSheet);
  $s('.tt-sh-alt').addEventListener('click', e => { const k = e.target.closest('[data-alt]')?.dataset.alt; if (k) openSheet(k); });
  sheet.addEventListener('click', e => { if (e.target === sheet) { closeSheet(); cfBox.hidden = true; } });

  // ── 초기화(무료, 확인) · 자동 배분 ──
  resetBtn.addEventListener('click', () => {
    if (resetBtn.disabled) return;
    $s('.tt-cf-txt').innerHTML = `${esc(HERO_CLASSES[cls].name)}의 특성을 모두 되돌릴까요?<br>찍은 포인트 <b>${talentSpent(hero, cls)}점</b>이 돌아와요. <b>무료</b>예요.<br>궁극 특성도 다시 고를 수 있어요.`;
    shBox.hidden = true; cfBox.hidden = false; sheet.hidden = false;
    $s('.tt-cf-no').focus({ preventScroll: true });
  });
  $s('.tt-cf-no').addEventListener('click', () => { sheet.hidden = true; });
  $s('.tt-cf-yes').addEventListener('click', () => { sheet.hidden = true; if (H.onReset?.()) render(hero, cls, true); });
  autoBtn.addEventListener('click', () => { H.onAutoToggle?.(!hero?.autoTalent); render(hero, cls, true); });

  // 뒤로가기: 열린 시트를 닫으면 true
  function handleBack() {
    if (sheet.hidden) return false;
    closeSheet();
    return true;
  }
  return { el, render, handleBack, close: closeSheet };
}

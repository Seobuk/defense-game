// 영웅 특성 트리 UI (DOM) — 정비 화면 '특성' 탭과 영웅 화면 '특성' 탭(도전 중 빠른 배분)이 같이 쓴다.
// 갈래마다 6단(행) × 노드 격자, 왼쪽 레일이 단 해금(그 갈래 포인트)을 보여 준다. 택1 노드는 '또는'으로 묶고 한쪽을 고르면 다른 쪽이 흐려진다.
// 궁극 특성은 클래스당 하나(다른 갈래 궁극은 자물쇠) · 핵심 노드 · 혼합 노드(두 갈래 사이) · 추천 다음 노드 · 상세 시트 · 무료 초기화(정비 화면만)
// 좁은 화면(폰)은 갈래 탭으로 하나씩, 넓은 화면(폴드·태블릿, 컨테이너 600px↑)은 3갈래를 나란히. 재질 kit.css(.k-*), 배치 hero.css(.tt-*)
import {
  TALENTS, TALENT_HYBRIDS, TALENT_RECOMMEND, TIER_REQ, HYBRID_REQ, talentPoints, talentSpent, talentLeft, talentRank, talentNode,
  talentBlock, branchSpent, branchMax, nextTierNeed, talentCap, recommendNext,
} from './talents.js';
import { HERO_CLASSES } from './hero.js';
import { icon } from './icons.js';
import { emblemImg } from './art/emblems.js';

// 노드 그림: 효과 키 → SVG 아이콘(icon) 또는 그린 엠블럼('em:' 접두사)
const FX_ICON = {
  atk: 'atk', aspd: 'rate', move: 'speed', hp: 'hero', crit: 'crit', critDmg: 'crit', range: 'multi', pierce: 'em:pierce',
  multi: 'multi', boss: 'em:giant', dr: 'wall', taunt: 'wall', thorns: 'em:thorns', killHeal: 'el-holy', wallKill: 'wall',
  holy: 'el-holy', undead: 'el-holy', aura: 'em:twin', ultCd: 'reroll', ultPow: 'meteor', wolf: 'el-summon', wolfPow: 'el-summon',
  burn: 'el-fire', splash: 'em:fireball', slow: 'el-frost', freeze: 'freeze', mana: 'em:chain', heal: 'el-holy', regen: 'em:holyLight',
  wallRegen: 'wall', smite: 'em:judgment', gold: 'coin', xp: 'hero', blink: 'el-wind', ambush: 'crit', poison: 'el-dark',
  spread: 'em:curseMark', poisonAmp: 'el-dark', execute: 'em:soulHarvest', bossExec: 'em:giant', tauntAmp: 'em:twin', collab: 'partner',
  bash: 'em:thorns', critBurst: 'em:critBoom', ultRefresh: 'em:chain', firstCrit: 'em:pierce', frenzy: 'em:frenzy', packHunt: 'el-summon',
  overheat: 'em:flame', shatter: 'em:glacier', surge: 'em:twin', emergency: 'em:holyLight', holyNova: 'em:judgment', grace: 'em:flawless',
  shadowStrike: 'em:double', neuro: 'em:curseMark', momentum: 'em:chainboom',
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
// H: onAllocate(key) → bool · onReset() → bool(정비 화면만, 없으면 초기화 버튼 숨김) · onAutoToggle(on)
export function createTalentTree(host, sheetHost, H = {}) {
  const el = document.createElement('div');
  el.className = 'tt';
  el.innerHTML = `
    <div class="tt-top">
      <div class="tt-pts"><span class="tt-pts-l">특성 포인트</span><b class="k-num gold tt-left">0</b><span class="tt-of">/ 0</span></div>
      <label class="tt-auto"><button class="k-toggle tt-autobtn" aria-pressed="false" aria-label="자동 배분"></button><span>자동 배분</span></label>
      <button class="k-btn s gray tt-reset">${icon('reroll')}초기화</button>
    </div>
    <p class="tt-hint"></p>
    <div class="tt-tabs" role="tablist"></div>
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
        <p class="tt-sh-alt" hidden></p>
        <p class="tt-sh-why"></p>
        <button class="k-btn success l wide tt-sh-go"></button>
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
  const leftEl = $('.tt-left'), ofEl = $('.tt-of'), hintEl = $('.tt-hint'), treeEl = $('.tt-tree'), tabsEl = $('.tt-tabs');
  const autoBtn = $('.tt-autobtn'), resetBtn = $('.tt-reset');
  const shBox = $s('.tt-sheet'), cfBox = $s('.tt-confirm'), goBtn = $s('.tt-sh-go');
  let hero = null, cls = null, sig = '', openKey = null, built = null;
  const tabOf = {}; // 클래스별 폰 화면 갈래 탭(기억)

  const nodeBtn = (n, bi, cap) => `
    <button class="tt-node${n.cap ? ' cap' : ''}${n.ks ? ' ks' : ''}${n.hybrid ? ' hyb' : ''}" data-key="${n.key}" style="--i:${bi}">
      <span class="tt-disc"><span class="tt-ico">${nodeArt(n)}</span><span class="tt-lock">${icon('lock')}</span><span class="tt-plus" aria-hidden="true"></span>${n.ks ? '<em class="tt-kst">핵심</em>' : ''}<em class="tt-rec">추천</em></span>
      <span class="tt-rank k-num"></span><span class="tt-name">${esc(n.name)}</span>${cap ? '<span class="tt-capnote">궁극은 하나만</span>' : ''}
    </button>`;

  // 트리 뼈대는 클래스가 바뀔 때만 다시 만든다(노드 상태만 갱신)
  function build() {
    built = cls;
    const branches = TALENTS[cls] || [];
    tabsEl.innerHTML = branches.map((b, bi) => `<button class="tt-tab" role="tab" data-b="${bi}" style="--b:${BRANCH_COL[bi]}"><i></i><b>${esc(b.name)}</b><span class="k-num"></span></button>`).join('');
    const branchHtml = (b, bi) => {
      let rows = '';
      for (let t = 0; t < TIERS; t++) {
        const ns = b.nodes.filter(n => n.tier === t);
        if (!ns.length) continue;
        let cells = '', seen = new Set();
        for (const n of ns) {
          if (!n.or) { cells += nodeBtn(n, bi * 14 + t, !!n.cap); continue; }
          if (seen.has(n.or)) continue;
          seen.add(n.or);
          const pair = ns.filter(x => x.or === n.or);
          cells += `<div class="tt-or" data-or="${n.or}">${nodeBtn(pair[0], bi * 14 + t)}<span class="tt-orw" aria-hidden="true">또는</span>${nodeBtn(pair[1], bi * 14 + t)}</div>`;
        }
        rows += `<div class="tt-tier" data-t="${t}"><div class="tt-rail"><span class="tt-knob k-num">${t + 1}</span><i class="tt-seg"><i></i></i><span class="tt-req">${TIER_REQ[t]}점</span></div><div class="tt-cells">${cells}</div></div>`;
      }
      return `<section class="tt-br" style="--b:${BRANCH_COL[bi]}" data-b="${bi}" data-key="${b.key}">
        <header class="tt-bh"><div class="tt-bh-top"><b>${esc(b.name)}</b><span class="tt-bpts k-num">0</span></div><p>${esc(b.desc)}</p>
          <div class="tt-next"><i class="tt-nbar"><i></i></i><span class="tt-ntxt"></span></div></header>
        <div class="tt-rows">${rows}</div>
      </section>`;
    };
    const hyb = TALENT_HYBRIDS[cls] || [];
    const hybHtml = hyb.map(n => {
      const [a, b] = n.req.map(k => branches.findIndex(x => x.key === k));
      const lo = Math.min(a, b), hi = Math.max(a, b);
      return `<div class="tt-hy" style="--ba:${BRANCH_COL[a]};--bb:${BRANCH_COL[b]};--c0:${lo * 2 + 2};--c1:${hi * 2 + 2}" data-req="${a},${b}">
        ${nodeBtn(n, 40)}<span class="tt-hyreq"><i style="--b:${BRANCH_COL[a]}"></i>${esc(branches[a].name)} ${HYBRID_REQ} + <i style="--b:${BRANCH_COL[b]}"></i>${esc(branches[b].name)} ${HYBRID_REQ}</span></div>`;
    }).join('');
    treeEl.innerHTML = branches.map(branchHtml).join('') + (hyb.length ? `<div class="tt-hyband"><div class="tt-hyh"><b>혼합 특성</b><span>두 갈래에 각각 ${HYBRID_REQ}점 이상 찍으면 열려요</span></div>${hybHtml}</div>` : '');
    for (const b of treeEl.querySelectorAll('.tt-node')) b.addEventListener('click', () => openSheet(b.dataset.key));
    for (const t of tabsEl.children) t.addEventListener('click', () => { tabOf[cls] = +t.dataset.b; showTab(); });
    if (tabOf[cls] == null) { // 처음엔 가장 많이 찍은 갈래, 없으면 추천 주력 갈래
      const sp = branches.map(b => branchSpent(hero, cls, b.key)), mx = Math.max(...sp);
      tabOf[cls] = mx > 0 ? sp.indexOf(mx) : Math.max(0, branches.findIndex(b => b.key === TALENT_RECOMMEND[cls]?.order[0]));
    }
    showTab();
  }
  function showTab() {
    const cur = tabOf[cls] | 0;
    treeEl.dataset.tab = String(cur);
    for (const t of tabsEl.children) t.setAttribute('aria-selected', String(+t.dataset.b === cur));
    for (const s of treeEl.querySelectorAll('.tt-br')) s.classList.toggle('on', +s.dataset.b === cur);
    for (const h of treeEl.querySelectorAll('.tt-hy')) h.classList.toggle('on', h.dataset.req.split(',').includes(String(cur)));
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
    btn.querySelector('.tt-rank').textContent = `${r}/${n.max}`;
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
    hintEl.innerHTML = left > 0
      ? `빛나는 특성을 눌러 찍으세요. 단은 <b>그 갈래에 쓴 포인트</b>로 열려요.${main ? ` 추천: <b style="color:${BRANCH_COL[TALENTS[cls].indexOf(main)]}">${esc(main.name)}</b> 마스터` : ''}`
      : H.onReset ? '레벨이 오르면 포인트가 생겨요. 궁극 특성은 하나만 — 초기화는 무료예요.' : '레벨이 오르면 포인트가 생겨요.';
    TALENTS[cls].forEach((b, bi) => {
      const sec = treeEl.children[bi], spent = branchSpent(hero, cls, b.key), max = branchMax(cls, b.key), need = nextTierNeed(hero, cls, b.key);
      for (const n of b.nodes) {
        const btn = sec.querySelector(`[data-key="${n.key}"]`);
        paintNode(btn, n);
        btn.classList.toggle('rec', !!rec && rec.key === n.key);
      }
      // 택1: 한쪽을 고르면 묶음이 '결정됨'
      for (const o of sec.querySelectorAll('.tt-or')) o.classList.toggle('picked', [...o.querySelectorAll('.tt-node')].some(x => talentRank(hero, cls, x.dataset.key) > 0));
      // 단 레일: 열린 단은 불이 들어오고, 다음 단까지의 진행을 채운다
      for (const row of sec.querySelectorAll('.tt-tier')) {
        const t = +row.dataset.t, open = spent >= TIER_REQ[t], nextReq = TIER_REQ[t + 1];
        row.classList.toggle('open', open);
        row.querySelector('.tt-seg').style.setProperty('--p', nextReq == null ? (open ? 1 : 0) : Math.max(0, Math.min(1, (spent - TIER_REQ[t]) / (nextReq - TIER_REQ[t]))).toFixed(3));
      }
      sec.querySelector('.tt-bpts').textContent = `${spent}/${max}`;
      const nt = sec.querySelector('.tt-ntxt'), cur = TIER_REQ.filter(r => r <= spent).length;
      nt.innerHTML = need ? `다음 단 해금까지 <b class="k-num">${need}</b>점` : spent >= max ? '갈래 마스터!' : '모든 단 해금';
      sec.querySelector('.tt-nbar').style.setProperty('--p', need ? ((spent - TIER_REQ[cur - 1]) / (TIER_REQ[cur] - TIER_REQ[cur - 1])).toFixed(3) : '1');
      sec.classList.toggle('done', spent >= max);
      sec.classList.toggle('capped', !!capKey && !b.nodes.some(n => n.cap === capKey));
      const tab = tabsEl.children[bi];
      tab.querySelector('span').textContent = String(spent);
      tab.classList.toggle('done', spent >= max);
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
      + (n.or ? '<span class="tt-sh-tag or">택1</span>' : '') + (n.hybrid ? '<span class="tt-sh-tag hy">혼합</span>' : '');
    $s('.tt-sh-ranks').innerHTML = Array.from({ length: n.max }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('') + `<b class="k-num">${r} / ${n.max}</b>`;
    $s('.tt-sh-lbl').textContent = n.cap ? '전투 방식이 바뀌어요 · 클래스당 하나' : n.ks ? '핵심 — 싸우는 방식이 바뀌어요' : n.max > 1 ? '랭크마다' : '효과';
    $s('.tt-sh-txt').textContent = n.desc;
    const alt = n.or ? b.nodes.find(x => x.or === n.or && x !== n) : null, altEl = $s('.tt-sh-alt');
    altEl.hidden = !alt;
    if (alt) altEl.innerHTML = `또는 〈<b>${esc(alt.name)}</b>〉 ${esc(alt.desc)}`;
    const bl = talentBlock(hero, cls, n.key), can = !bl;
    const whyEl = $s('.tt-sh-why');
    whyEl.textContent = can ? `남은 포인트 ${talentLeft(hero, cls)}점` : bl.msg;
    whyEl.classList.toggle('bad', !can && r < n.max);
    goBtn.disabled = !can;
    goBtn.innerHTML = r >= n.max ? `${icon('check')}최대 랭크` : can ? `찍기 <span class="tt-sh-cost">-1</span>` : icon('lock') + '잠김';
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
  $s('.tt-sh-close').addEventListener('click', closeSheet);
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

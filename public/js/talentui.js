// 영웅 특성 트리 UI (DOM) — 정비 화면 '특성' 탭과 영웅 화면 '특성' 탭(도전 중 빠른 배분)이 같이 쓴다.
// 3갈래 × 6노드 그래프(연결선) · 노드 상태(잠김/찍을 수 있음/일부/최대) · 궁극 특성 강조 · 포인트 · 상세 시트 · 무료 초기화(정비 화면만)
// 재질 kit.css(.k-*), 배치 hero.css(.tt-*). docs/DESIGN.md '영웅 특성 트리 & 자율 전투 구현 계약'
import { TALENTS, talentPoints, talentSpent, talentLeft, talentRank, canAllocate, talentNode } from './talents.js';
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
  spread: 'em:curseMark', poisonAmp: 'el-dark', execute: 'em:soulHarvest', bossExec: 'em:giant',
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
        <div class="tt-sh-meta"><span class="tt-sh-branch"></span><span class="tt-sh-cap" hidden>궁극 특성</span></div>
        <div class="tt-sh-ranks"></div>
        <div class="tt-sh-desc"><b class="tt-sh-lbl"></b><p class="tt-sh-txt"></p></div>
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
  const leftEl = $('.tt-left'), ofEl = $('.tt-of'), hintEl = $('.tt-hint'), treeEl = $('.tt-tree');
  const autoBtn = $('.tt-autobtn'), resetBtn = $('.tt-reset');
  const shBox = $s('.tt-sheet'), cfBox = $s('.tt-confirm'), goBtn = $s('.tt-sh-go');
  let hero = null, cls = null, sig = '', openKey = null, built = null;

  // 트리 뼈대는 클래스가 바뀔 때만 다시 만든다(노드 상태만 갱신)
  function build() {
    built = cls;
    const branches = TALENTS[cls] || [];
    treeEl.innerHTML = branches.map((b, bi) => `
      <section class="tt-br" style="--b:${BRANCH_COL[bi]}" data-b="${bi}">
        <header class="tt-bh"><b>${esc(b.name)}</b><span class="tt-bpts k-num">0</span><p>${esc(b.desc)}</p></header>
        ${b.nodes.map((n, i) => `${i ? '<i class="tt-link" aria-hidden="true"><i></i></i>' : ''}
          <button class="tt-node${n.cap ? ' cap' : ''}" data-key="${n.key}" style="--i:${bi * 6 + i}">
            <span class="tt-disc"><span class="tt-ico">${nodeArt(n)}</span><span class="tt-lock">${icon('lock')}</span><span class="tt-plus" aria-hidden="true"></span></span>
            <span class="tt-rank k-num"></span><span class="tt-name">${esc(n.name)}</span>
          </button>`).join('')}
      </section>`).join('');
    for (const b of treeEl.querySelectorAll('.tt-node')) b.addEventListener('click', () => openSheet(b.dataset.key));
  }

  function render(h, c, force = false) {
    hero = h; cls = c && TALENTS[c] ? c : h?.cls;
    if (!hero || !TALENTS[cls]) { el.hidden = true; return; }
    el.hidden = false;
    const s = cls + '|' + hero.level + '|' + JSON.stringify(hero.talents?.[cls] || {}) + '|' + !!hero.autoTalent;
    if (!force && s === sig) return;
    sig = s;
    if (built !== cls) build();
    const left = talentLeft(hero, cls), total = talentPoints(hero);
    leftEl.textContent = String(left);
    ofEl.textContent = `/ ${total}`;
    el.classList.toggle('has-pts', left > 0);
    autoBtn.setAttribute('aria-pressed', String(!!hero.autoTalent));
    resetBtn.hidden = !H.onReset;
    resetBtn.disabled = !talentSpent(hero, cls);
    hintEl.textContent = left > 0
      ? '빛나는 특성을 눌러 포인트를 쓰세요. 갈래의 앞 특성을 최대로 찍으면 다음 특성이 열려요.'
      : H.onReset ? '레벨이 오르면 포인트가 생겨요(10레벨마다 1점 더). 초기화는 무료예요.' : '레벨이 오르면 포인트가 생겨요.';
    TALENTS[cls].forEach((b, bi) => {
      const sec = treeEl.children[bi];
      let spent = 0, max = 0;
      b.nodes.forEach((n, i) => {
        const r = talentRank(hero, cls, n.key);
        spent += r; max += n.max;
        const btn = sec.querySelector(`[data-key="${n.key}"]`);
        const prev = i ? b.nodes[i - 1] : null;
        const open = !prev || talentRank(hero, cls, prev.key) >= prev.max;
        const st = r >= n.max ? 'max' : r > 0 ? 'ranked' : !open ? 'locked' : canAllocate(hero, cls, n.key) ? 'avail' : 'open';
        if (btn.dataset.st !== st) {
          if (btn.dataset.st && (st === 'max' || st === 'ranked')) btn.animate([{ scale: 1 }, { scale: 1.22, offset: 0.35 }, { scale: 1 }], { duration: 320, easing: 'cubic-bezier(.34,1.56,.64,1)' });
          btn.dataset.st = st;
        }
        btn.classList.toggle('can', canAllocate(hero, cls, n.key));
        btn.querySelector('.tt-rank').textContent = `${r}/${n.max}`;
        btn.setAttribute('aria-label', `${n.name} ${r}/${n.max}${st === 'locked' ? ', 잠김' : ''}`);
        if (i) btn.previousElementSibling.classList.toggle('lit', open);
      });
      sec.querySelector('.tt-bpts').textContent = `${spent}/${max}`;
      sec.classList.toggle('done', spent >= max);
    });
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
    const { node: n, branch: b, index } = f, bi = TALENTS[cls].indexOf(b);
    const r = talentRank(hero, cls, n.key);
    shBox.style.setProperty('--b', BRANCH_COL[bi]);
    shBox.classList.toggle('cap', !!n.cap);
    $s('.tt-sh-rb').classList.toggle('gold', !!n.cap);
    $s('.tt-sh-name').textContent = n.name;
    $s('.tt-sh-ico').innerHTML = nodeArt(n);
    $s('.tt-sh-branch').textContent = `${HERO_CLASSES[cls].name} · ${b.name} ${index + 1}단계`;
    $s('.tt-sh-cap').hidden = !n.cap;
    $s('.tt-sh-ranks').innerHTML = Array.from({ length: n.max }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('') + `<b class="k-num">${r} / ${n.max}</b>`;
    $s('.tt-sh-lbl').textContent = n.cap ? '전투 방식이 바뀌어요' : n.max > 1 ? '랭크마다' : '효과';
    $s('.tt-sh-txt').textContent = n.cap ? n.desc.replace(/^궁극 특성:\s*/, '') : n.desc;
    const prev = index ? b.nodes[index - 1] : null;
    const can = canAllocate(hero, cls, n.key);
    const why = r >= n.max ? '최대 랭크예요' : prev && talentRank(hero, cls, prev.key) < prev.max ? `앞 특성 〈${prev.name}〉부터 최대(${prev.max})로 찍어야 열려요`
      : talentLeft(hero, cls) <= 0 ? '남은 포인트가 없어요 — 레벨이 오르면 생겨요' : `남은 포인트 ${talentLeft(hero, cls)}점`;
    const whyEl = $s('.tt-sh-why');
    whyEl.textContent = why;
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
    $s('.tt-cf-txt').innerHTML = `${esc(HERO_CLASSES[cls].name)}의 특성을 모두 되돌릴까요?<br>찍은 포인트 <b>${talentSpent(hero, cls)}점</b>이 돌아와요. <b>무료</b>예요.`;
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

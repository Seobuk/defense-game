// 갈림길 화면(DOM) — 층 사이 세 갈래 한 화면 · HUD 저주/정예 칩. main.js가 createPathUI()로 만들고 매 프레임 update(g)를 부른다.
// 상태 변경은 onChoose(index)로만(main.js → act 'path'). 스타일은 css/paths.css (docs/DESIGN.md 'v0.1.6 갈림길 계약')
import { PATH_BY_KEY, pickPath, merchantCost, MERCHANT_CUT, nextForkAt } from './paths.js';
import { icon } from './icons.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const SHOW_AFTER = 450; // 클리어 도장을 먼저 잠깐(ms). 이어하기(층 시작)면 바로
const CLOSE_MS = 340;   // 고른 칸이 빛나고 나머지가 흐려지는 시간
// 갈래 뒤 밤길: 아래 가운데에서 세 갈래로 퍼지는 길(장식)
const ROAD = '<svg class="pa-road" viewBox="0 0 300 200" preserveAspectRatio="none" aria-hidden="true">'
  + '<path d="M150 200 C150 150 60 120 50 0" /><path d="M150 200 C150 140 150 80 150 0" /><path d="M150 200 C150 150 240 120 250 0" /></svg>';

export function createPathUI({ onChoose } = {}) {
  const stage = document.getElementById('stage');
  const ov = document.createElement('div');
  ov.className = 'ov path-ov';
  ov.id = 'path'; ov.hidden = true;
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'path-h');
  ov.innerHTML = ROAD + '<div class="pa-head"><span class="pa-ribbon">갈림길</span><h2 id="path-h">어느 길로 갈까요?</h2><p class="pa-sub"></p></div><div class="pa-cards"></div>';
  stage.append(ov);
  const subEl = ov.querySelector('.pa-sub'), cardsEl = ov.querySelector('.pa-cards');
  // HUD 칩: 저주 남은 층 · 정예 층(#hud-left 끝)
  const chip = document.createElement('span');
  chip.className = 'st-chip pa-chip'; chip.hidden = true; chip.setAttribute('role', 'status');
  document.getElementById('hud-left')?.append(chip);

  let shownRef = null, seenRef = null, seenAt = 0, closing = 0, chipKey = '';
  const btns = [];

  function build(g, f) {
    const to = g.phase === 'clear' ? g.stage + 1 : g.stage;
    subEl.textContent = `${to}층으로 가는 길 — 하나를 고르세요`;
    const rec = g.players[0].autoPick ? pickPath(g, f.opts) : -1;
    cardsEl.innerHTML = '';
    cardsEl.style.setProperty('--n', f.opts.length);
    btns.length = 0;
    f.opts.forEach((k, i) => {
      const p = PATH_BY_KEY[k];
      const down = k === 'merchant' ? `골드 −${merchantCost(g).toLocaleString('ko-KR')} (${Math.round(MERCHANT_CUT * 100)}%)` : p.down;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pa-card' + (i === rec ? ' rec' : '') + (k === 'spring' ? ' safe' : '');
      b.style.cssText = `--pc:${p.tone};--i:${i}`;
      b.dataset.k = k;
      b.setAttribute('aria-label', `${p.name}: ${p.up}. 대가: ${down}`);
      b.innerHTML = `<span class="pa-medal">${icon(p.icon)}</span><b class="pa-name">${esc(p.name)}</b>`
        + `<span class="pa-line up"><i aria-hidden="true">▲</i>${esc(p.up)}</span>`
        + `<span class="pa-line down"><i aria-hidden="true">▼</i>${esc(down)}</span>`
        + (i === rec ? '<em class="pa-rec">추천</em>' : '');
      b.addEventListener('click', () => { if (!closing && shownRef === f) onChoose?.(i); });
      cardsEl.append(b);
      btns.push(b);
    });
  }

  function update(g, now = performance.now()) {
    // 칩(전투 중에만)
    const p = g?.path, nf = g && p && g.phase === 'play' && !p.elite && !(p.curse > 0) ? nextForkAt(g) : 0; // 정복한 층: '갈림길 N층~' 안내
    const key = !g || g.phase !== 'play' || !p ? '' : p.elite ? 'elite' : p.curse > 0 ? 'curse' + p.curse : nf ? 'next' + nf : '';
    if (key !== chipKey) {
      chipKey = key;
      chip.hidden = !key;
      chip.dataset.k = key.replace(/\d/g, '');
      chip.innerHTML = !key ? '' : p.elite ? `${icon('crit')}<span>정예 층</span>` : nf ? `${icon('el-holy')}<span>갈림길 <b class="num">${nf}</b>층~</span>`
        : `${icon('el-dark')}<span>저주 <b class="num">${p.curse}</b>층</span>`;
      chip.title = !key ? '' : p.elite ? '갈림길 정예 층: 적 체력 +50% — 깨면 스킬 카드 2장' : nf ? `다시 오르는 층은 빠르게 — ${nf}층을 깨면 갈림길이 나와요`
        : `갈림길 저주: 적 체력 +30% (남은 ${p.curse}층)`;
    }
    // 갈림길 화면
    const f = g?.path?.fork || null;
    if (closing) { // 고른 뒤 빛나는 칸 → 닫기
      if (now >= closing) { closing = 0; ov.hidden = true; shownRef = null; }
      return;
    }
    if (shownRef && f !== shownRef) { // 골랐다(탭 · 자동 선택): 고른 칸만 빛나고 나머지 흐려짐
      const k = p?.taken.at(-1);
      for (const b of btns) b.classList.add(b.dataset.k === k ? 'chosen' : 'faded');
      closing = now + CLOSE_MS;
      return;
    }
    const want = !!f && !g.pick && !g.relicPick;
    if (!want) { if (!ov.hidden) { ov.hidden = true; shownRef = null; } return; }
    if (f !== seenRef) { seenRef = f; seenAt = now; }
    if (shownRef !== f && (g.phase !== 'clear' || now - seenAt >= SHOW_AFTER)) {
      shownRef = f;
      build(g, f);
      ov.hidden = false;
      ov.classList.remove('in'); void ov.offsetWidth; ov.classList.add('in');
    }
  }

  return {
    update,
    isShown: () => !ov.hidden && !closing,
    isOpen: () => !ov.hidden, // 닫히는 연출 중 포함
  };
}

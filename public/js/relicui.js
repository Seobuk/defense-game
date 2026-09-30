// 유물·망각 화면(DOM) — 보스 보상 유물 3택 화면 · 전투 HUD 유물 줄 · 카드 화면 '비우기'(망각) · 결과 화면 유물 · 봉인된 비상 스킬 · 왕관이 잠근 칸.
// ui.js가 createRelicUI(root, deps)로 만들고 update/onEvents/renderResult를 부른다. 상태 변경은 deps(onRelic·onForget)로만. 스타일은 css/relics.css
import { SKILL_BY_KEY, FUSION_BY_KEY, SPELL_MAX_LV } from './config.js';
import { RELIC_BY_KEY, RELIC_AUTO_T, slotCap, pickRelic, resonant, weakestSkill, cardStep, canForget, forgetHint, forgetRefund } from './relics.js';
import { regionView, ELEM_NAME } from './dungeons.js'; // 20·40·60·80층 유물 화면: 다음 지역 미리 보기
import { CATCHUP_FROM } from './sim.js';
import { relicImg, relicColor } from './art/relicart.js';
import { emblemImg } from './art/emblems.js';
import { momentLeft } from './art/hud.js';
import { icon } from './icons.js';
import { mutName } from './mutui.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const RING_C = 2 * Math.PI * 17;
// 받침 있는 말 뒤엔 '을', 없으면 '를'(숫자는 읽는 소리로: 0 영 · 1 일 · 3 삼 · 6 육 · 7 칠 · 8 팔 = 받침)
const eul = w => { const c = String(w).trim().slice(-1), n = c.charCodeAt(0) - 0xac00; return w + (n >= 0 && n < 11172 ? (n % 28 ? '을' : '를') : /[013678]/.test(c) ? '을' : '를'); };
const SHOW_AFTER_CLEAR = 900; // 보스 층 클리어 연출(격파 → 승리 도장)을 먼저 보여 주고 유물 화면(v0.1.6 템포: 1.5 → 0.9초 — ui.js 보스 도장이 0.6초에 뜬다)
const tone = k => { const f = FUSION_BY_KEY[k]; return f ? { cls: 'fusion', style: `--fa:var(--elc-${f.elements[0]});--fb:var(--elc-${f.elements[1]})` } : { cls: 'el-' + (SKILL_BY_KEY[k]?.element || 'holy'), style: '' }; };
const lines = r => `<span class="rc-line up"><i aria-hidden="true">▲</i>${esc(r.up)}</span><span class="rc-line down"><i aria-hidden="true">▼</i>${esc(r.down)}</span>`;
const ERASE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5 13.5 7l5 5L11 19.5H6.5z" fill="currentColor"/><path d="M13.5 7 16 4.5l5 5-2.5 2.5" fill="currentColor" opacity=".55"/><path d="M11 19.5h9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';

// 유물 카드의 '지금 내 빌드' 한 줄(규칙을 바꾸는 유물만): 왕관 = 잃는 스킬 · 공명 = 켜지는 원소 · 지팡이 = 융합 수
function ctxLine(v, k) {
  const sp = v.spells || {}, n = Object.keys(sp).length;
  if (k === 'crown') {
    if (n < slotCap(v)) return { html: `지금 ${n}/${slotCap(v)}칸 — 잃는 스킬 없음` };
    const w = weakestSkill(v);
    return w && { html: `잃는 스킬: <b>${esc(SKILL_BY_KEY[w]?.name || w)} ${FUSION_BY_KEY[w] ? '융합 ' : ''}Lv${sp[w]}</b>`, bad: true };
  }
  if (k === 'resonance') {
    const on = resonant(v);
    return on.length ? { html: `지금 빌드: <b>${on.map(e => ELEM_NAME[e]).join('·')}</b> 공명` } : { html: '지금은 같은 원소 2칸이 없어요', bad: true };
  }
  if (k === 'archStaff') return { html: `지금 융합 스킬 <b>${(v.fusions || []).length}</b>개`, bad: !(v.fusions || []).length };
  return null;
}

export function createRelicUI(root, D) {
  const stage = root.querySelector('#stage');
  const pickOv = root.querySelector('#pick');

  // ── 유물 3택 화면 ──
  const ov = el('div', 'ov relic-ov');
  ov.id = 'relic'; ov.hidden = true;
  ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'relic-h');
  ov.innerHTML = '<div class="relic-rays" aria-hidden="true"></div>'
    + '<div class="relic-head"><span class="relic-ribbon">네임드 보스 격파!</span><h2 id="relic-h">유물을 고르세요</h2>'
    + '<p class="relic-sub">규칙을 바꾸는 힘 — 대신 <b>대가</b>가 따라요</p></div>'
    + '<div class="relic-next" hidden></div><div class="relic-cards"></div>'
    + '<div class="relic-foot"><span class="relic-auto" hidden><svg viewBox="0 0 40 40"><circle class="pr-bg" cx="20" cy="20" r="17"/><circle class="pr-fg" cx="20" cy="20" r="17"/></svg><b></b><em>추천 유물 자동 선택</em></span>'
    + '<button type="button" class="relic-skip">유물 없이 계속</button></div>';
  stage.append(ov);
  const nextEl = ov.querySelector('.relic-next'), cardsEl = ov.querySelector('.relic-cards'), autoEl = ov.querySelector('.relic-auto'), ringFg = autoEl.querySelector('.pr-fg'), ringN = autoEl.querySelector('b');
  let open = false, closing = false, shownRef = null, seenRef = null, seenAt = 0, recIdx = -1, closeTimer = 0;
  const cardBtns = [];
  ov.querySelector('.relic-skip').addEventListener('click', () => { if (open && !closing) D.onRelic?.(-1); });
  function openRelic(v) {
    const rp = v.relicPick;
    clearTimeout(closeTimer);
    open = true; closing = false; shownRef = rp;
    cardsEl.replaceChildren();
    cardBtns.length = 0;
    recIdx = pickRelic(v, rp.cards);
    // 지역 경계(20·40·60·80층): 다음 지역 약점·내성·규칙을 유물 고르기 전에
    // (보스 층 클리어 화면 = 20층 · 이어하기로 층 시작에 뜬 유물 = 21층)
    const edge = v.phase === 'clear' ? v.stage % 20 === 0 && v.stage < 100 : v.stage % 20 === 1 && v.stage > 1;
    const nx = edge && !v.traits ? regionView(v.phase === 'clear' ? v.theme + 1 : v.theme) : null;
    nextEl.hidden = !nx;
    if (nx) nextEl.innerHTML = `<span class="rn-k">다음 지역</span><b>${esc(nx.name)}</b>`
      + `<span class="rn-w">${nx.weak.map(x => esc(x.name)).join('·')} 약점</span><span class="rn-r">${nx.resist.map(x => esc(x.name)).join('·')} 내성</span><span class="rn-rule">${esc(nx.rule.name)}</span>`;
    rp.cards.forEach((k, i) => {
      const r = RELIC_BY_KEY[k], cx = ctxLine(v, k);
      const b = el('button', 'relic-card', `<span class="rc-medal">${relicImg(k)}</span><span class="rc-body"><b class="rc-name">${esc(r.name)}</b>${lines(r)}${cx ? `<span class="rc-ctx${cx.bad ? ' bad' : ''}">${cx.html}</span>` : ''}</span>`);
      b.type = 'button';
      b.style.setProperty('--rc', relicColor(k));
      b.style.setProperty('--i', i);
      b.dataset.key = k;
      b.setAttribute('aria-label', `${r.name}. 장점: ${r.up}. 대가: ${r.down}${cx ? '. ' + cx.html.replace(/<[^>]+>/g, '') : ''}`);
      b.addEventListener('click', () => { if (open && !closing) D.onRelic?.(i); });
      cardsEl.append(b);
      cardBtns.push(b);
    });
    cardBtns.forEach((b, i) => b.classList.toggle('rec', i === recIdx && rp.autoLeft != null));
    ov.hidden = false;
    void ov.offsetWidth;
    ov.classList.add('in');
    syncAuto(rp);
    D.sync?.();
    cardBtns[0]?.focus({ preventScroll: true });
  }
  function syncAuto(rp) {
    const has = rp.autoLeft != null;
    if (autoEl.hidden === has) autoEl.hidden = !has;
    cardBtns.forEach((b, i) => b.classList.toggle('rec', has && i === recIdx));
    if (!has) return;
    const f = 1 - Math.max(0, Math.min(1, rp.autoLeft / RELIC_AUTO_T));
    ringFg.style.strokeDashoffset = String(RING_C * f);
    ringN.textContent = String(Math.max(1, Math.ceil(rp.autoLeft)));
  }
  function closeRelic(key) {
    if (!open || closing) return;
    closing = true;
    for (const b of cardBtns) b.classList.add(b.dataset.key === key ? 'chosen' : 'faded');
    closeTimer = setTimeout(hideRelic, key ? (autoEl.hidden ? 450 : 250) : 200); // 자동 선택이면 금빛 톡도 짧게 // v0.1.6 템포: 고른 유물 금빛 톡 → 바로 다음 층
  }
  function hideRelic() {
    clearTimeout(closeTimer);
    ov.hidden = true; ov.classList.remove('in');
    open = false; closing = false; shownRef = null;
    D.sync?.();
  }

  // ── 전투 HUD: 왼쪽 열 맨 위 유물 줄(탭 = 설명) ──
  const box = el('div', 'relic-box', '<div class="side-h relic-h"><span>유물</span></div><div class="relic-row"></div>');
  box.hidden = true;
  root.querySelector('#side-l').append(box);
  const row = box.querySelector('.relic-row');
  let rowKey = '';
  row.addEventListener('click', e => {
    const b = e.target.closest('.rl-chip');
    const r = b && RELIC_BY_KEY[b.dataset.key];
    if (r) D.showTip?.(b, 'relic-tip', `<b>${esc(r.name)}</b><br>${lines(r)}`, 3600);
  });
  function paintRow(keys) {
    const k = keys.join(',');
    if (k === rowKey) return;
    const fresh = keys.length > rowKey.split(',').filter(Boolean).length && rowKey !== '';
    rowKey = k;
    box.hidden = !keys.length;
    row.innerHTML = keys.map(key => `<button type="button" class="rl-chip" data-key="${key}" aria-label="${esc(RELIC_BY_KEY[key].name)}">${relicImg(key)}</button>`).join('');
    if (fresh) row.lastElementChild?.classList.add('pop');
  }
  const pulse = key => row.querySelector(`[data-key="${key}"]`)?.animate([{ transform: 'scale(1.5)', filter: 'brightness(1.8)' }, { transform: 'scale(1)', filter: 'none' }], { duration: 520, easing: 'cubic-bezier(.34,1.56,.64,1)' });

  // ── 봉인된 비상 스킬(운석·빙결) — 누르면 이유 ──
  const skBtn = { meteor: root.querySelector('#sk-meteor'), freeze: root.querySelector('#sk-freeze') };
  let seals = [];
  for (const [k, b] of Object.entries(skBtn)) {
    if (!b) continue;
    b.addEventListener('click', e => {
      if (!seals.includes(k)) return;
      e.stopImmediatePropagation();
      const by = Object.values(RELIC_BY_KEY).find(r => cur?.relics?.includes(r.key) && (r.fx.seal || []).includes(k));
      D.toast?.(`${by ? by.name + '에 ' : ''}봉인된 마법이에요`, 'lock');
    }, true);
  }

  // ── 망각(비우기): 카드 화면 아래 줄 버튼 · 전투 중 스킬 칸 말풍선 '비우기' → 고르기 시트 + 확인(보상: 다음 스킬 카드 +레벨) ──
  const fBtn = el('button', 'k-btn neutral forget-btn', `${ERASE}비우기 <b class="num">2</b>`);
  fBtn.type = 'button'; fBtn.hidden = true;
  pickOv.querySelector('.pick-foot').prepend(fBtn);
  const fNum = fBtn.querySelector('b');
  const sheet = el('div', 'forget-sheet');
  sheet.hidden = true;
  sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-labelledby', 'forget-h');
  sheet.innerHTML = '<div class="fs-card"><div class="fs-list"><h3 id="forget-h">어떤 스킬을 비울까요?</h3><p class="fs-sub"></p><div class="fs-grid"></div>'
    + '<button type="button" class="k-btn secondary fs-cancel">취소</button></div>'
    + '<div class="fs-confirm" hidden><div class="fs-big"></div><h3 class="fs-q"></h3><ul class="fs-notes"></ul>'
    + '<div class="fs-btns"><button type="button" class="k-btn secondary fs-no">취소</button><button type="button" class="k-btn danger fs-yes">비우기</button></div></div></div>';
  pickOv.append(sheet);
  const fsList = sheet.querySelector('.fs-list'), fsGrid = sheet.querySelector('.fs-grid'), fsSub = sheet.querySelector('.fs-sub');
  const fsConfirm = sheet.querySelector('.fs-confirm'), fsBig = sheet.querySelector('.fs-big'), fsQ = sheet.querySelector('.fs-q'), fsNotes = sheet.querySelector('.fs-notes');
  let target = null, cur = null;
  const skillChip = (k, lv) => {
    const d = SKILL_BY_KEY[k], t = tone(k);
    return `<span class="fs-orb ${t.cls}" style="${t.style}">${emblemImg(k) || icon('el-' + (d?.element || 'holy'))}</span>`
      + `<b class="fs-name">${esc(d?.name || k)}</b><span class="fs-lv">${FUSION_BY_KEY[k] ? '융합 ' : ''}Lv${lv >= SPELL_MAX_LV ? ' MAX' : lv}</span>`;
  };
  function openSheet(k) { // k = 스킬 칸에서 고른 스킬(바로 확인 단계)
    const v = cur;
    if (!v || !canForget(v)) return;
    const sp = v.spells || {}, rec = forgetHint(v);
    (v.pick ? pickOv : stage).append(sheet); // 전투 중(카드 없음)엔 전장 위에 — ui.isBusy가 전투를 멈춘다
    fsSub.innerHTML = `남은 망각 <b>${v.forgetLeft}</b>회 · 비우면 다음 카드 <b>+레벨</b>`;
    fsGrid.innerHTML = Object.keys(sp).map(k => `<button type="button" class="fs-skill${k === rec ? ' rec' : ''}" data-key="${k}">${skillChip(k, sp[k])}<i class="fs-rf">카드 +${forgetRefund(k, sp[k])}</i></button>`).join(''); // 비우면 받는 +레벨을 칸마다
    fsList.hidden = false; fsConfirm.hidden = true; target = null;
    sheet.hidden = false;
    if (k && sp[k]) { ask(k); D.sync?.(); return; }
    D.sync?.();
    fsGrid.firstElementChild?.focus({ preventScroll: true });
  }
  function closeSheet() { if (sheet.hidden) return; sheet.hidden = true; target = null; D.sync?.(); }
  function ask(k) {
    const v = cur, lv = v?.spells?.[k];
    if (!lv) return;
    target = k;
    const d = SKILL_BY_KEY[k], fu = FUSION_BY_KEY[k], parts = v.fusionParts?.[k] || [];
    fsBig.innerHTML = skillChip(k, lv);
    fsQ.textContent = `${eul(`${d.name}${fu ? '' : ` Lv${lv}`}`)} 비울까요?`;
    const mut = v.mutations?.[k] && mutName(v.mutations[k]);
    const pair = (v.fusionProgress || []).filter(p => p.parts.includes(k)); // 발견한 융합의 짝 진행도(스택 금빛 고리)
    const back = Math.min(SPELL_MAX_LV, cardStep(v) + (v.stage > CATCHUP_FROM ? 1 : 0)); // 다시 배우면(쌍둥이 달·따라잡기)
    const rf = forgetRefund(k, lv);
    fsNotes.innerHTML = [
      `<b class="fs-gain">보상: 다음 스킬 카드 +${rf}레벨</b>${v.forgetBonus ? ` (모아 둔 +${v.forgetBonus}에 더해요)` : ''}`,
      v.pick ? '스킬 칸이 하나 비고, 카드가 지금 빌드로 새로 나와요' : '스킬 칸이 하나 비어요 — 다음 카드에서 새 스킬을 배울 수 있어요',
      fu ? `융합이 풀려요 — 품고 있던 ${parts.map(p => esc(SKILL_BY_KEY[p]?.name || p)).join(' · ')}도 함께 사라져요` : '',
      mut ? `<b class="fs-warn">변이(${esc(mut)})도 사라져요</b>` : '',
      ...pair.map(p => `<b class="fs-warn">${esc(SKILL_BY_KEY[p.key]?.name || p.key)} 재료예요</b> (${p.parts.map((q, i) => `${esc(SKILL_BY_KEY[q]?.name || q)} ${p.lv[i]}/${p.max}`).join(' · ')})`),
      fu ? '융합은 두 재료를 다시 Lv6까지 올려야 다시 생겨요' : `나중에 카드로 다시 배우면 <b>Lv${back}</b>부터 시작해요`,
      `남은 망각 ${v.forgetLeft}회 → <b>${v.forgetLeft - 1}</b>회`,
    ].filter(Boolean).map(s => `<li>${s}</li>`).join('');
    fsList.hidden = true; fsConfirm.hidden = false;
    sheet.querySelector('.fs-no').focus({ preventScroll: true });
  }
  fBtn.addEventListener('click', () => openSheet());
  // 스킬 칸 말풍선(ui.js showTip)의 '비우기' 버튼 — tipHTML이 만든다
  stage.addEventListener('click', e => {
    const b = e.target.closest('#spell-tip .tip-forget');
    if (!b) return;
    b.closest('#spell-tip').hidden = true;
    openSheet(b.dataset.key);
  });
  fsGrid.addEventListener('click', e => { const b = e.target.closest('.fs-skill'); if (b) ask(b.dataset.key); });
  sheet.querySelector('.fs-cancel').addEventListener('click', closeSheet);
  sheet.querySelector('.fs-no').addEventListener('click', () => { if (!cur?.pick) { closeSheet(); return; } fsList.hidden = false; fsConfirm.hidden = true; target = null; }); // 칸에서 바로 왔으면 닫기
  sheet.querySelector('.fs-yes').addEventListener('click', () => { const k = target; closeSheet(); if (k) D.onForget?.(k); });
  sheet.addEventListener('click', e => { if (e.target === sheet) closeSheet(); });

  // ── 매 프레임 ──
  let lockKey = '';
  function update(v) {
    cur = v;
    if (!v) return;
    // 유물 3택: 보스 층 클리어 연출 뒤에(이어하기로 층 시작에 복원된 것은 바로)
    const rp = v.relicPick;
    if (rp) {
      if (shownRef !== rp) {
        const now = performance.now();
        if (seenRef !== rp) { seenRef = rp; seenAt = now; }
        const wait = v.phase === 'clear' ? (rp.autoLeft != null ? 600 : SHOW_AFTER_CLEAR) : 300; // 자동 선택 ON이면 더 짧게(보스 층 박자 ≤ 2초)
        if ((now - seenAt >= wait && momentLeft() <= 0.15) || now - seenAt > 5000) openRelic(v);
      } else syncAuto(rp);
    } else if (open && !closing) hideRelic();
    paintRow(v.relics || []);
    // 봉인 · 왕관이 잠근 칸
    const s = v.rfx?.seal || [];
    if (s.join() !== seals.join()) {
      seals = [...s];
      for (const [k, b] of Object.entries(skBtn)) b?.classList.toggle('sealed', seals.includes(k));
    }
    const cap = slotCap(v), used = Object.keys(v.spells || {}).length, lk = cap + '|' + used;
    if (lk !== lockKey) {
      lockKey = lk;
      root.querySelectorAll('#stack .ss').forEach((b, i) => b.classList.toggle('relic-lock', i >= cap && i >= used));
    }
    // 망각 버튼: 카드가 떠 있고 남은 횟수가 있을 때
    const showF = !!v.pick && !pickOv.hidden && v.forgetLeft > 0 && (used >= 3 || used >= cap); // 스킬 1~2개(첫 층)엔 숨김 — 새 플레이어 잡음
    if (fBtn.hidden === showF) fBtn.hidden = !showF;
    if (showF && fNum.textContent !== String(v.forgetLeft)) fNum.textContent = String(v.forgetLeft);
    const hint = showF && !v.pick.starter && !!forgetHint(v) && !v.pick.cards.some(c => c.fusionHint); // 칸이 꽉 찼고 짝 없는 낮은 스킬 → '추천' 반짝
    if (fBtn.classList.contains('hint') !== hint) fBtn.classList.toggle('hint', hint);
    if (!sheet.hidden && !canForget(v)) closeSheet();
  }

  function onEvents(events, v) {
    for (const ev of events) {
      switch (ev.type) {
        case 'relicPick':
          if (ev.key) { D.toast?.(`유물 획득 · ${RELIC_BY_KEY[ev.key]?.name || ''}`, 'trophy'); setTimeout(() => pulse(ev.key), 700); }
          closeRelic(ev.key);
          break;
        case 'relicProc': {
          pulse(ev.key);
          if (ev.lost) D.toast?.(`${RELIC_BY_KEY[ev.key]?.name || ''} · ${eul(SKILL_BY_KEY[ev.spell]?.name || '스킬')} 잃었어요`, 'lock');
          else if (ev.key === 'chaos') D.toast?.(`혼돈의 구슬 · ${SKILL_BY_KEY[ev.spell]?.name || ''} Lv${ev.level}!`, 'new');
          else if (ev.key === 'phoenix') D.toast?.('불사조 깃털! 성벽 50% 회복', 'wall');
          break;
        }
        case 'forget':
          D.toast?.(`${eul(SKILL_BY_KEY[ev.spell]?.name || '스킬')} 비웠어요 · 다음 카드 +${ev.refund | 0}레벨 · 남은 ${v?.forgetLeft ?? 0}회`, 'reroll');
          break;
      }
    }
  }

  // ── 결과 화면: 이번 도전의 유물 ──
  let resCard = null;
  function renderResult(sum) {
    const spells = root.querySelector('#res-spells-card');
    if (!resCard && spells) { resCard = el('div', 'res-card res-relics'); spells.before(resCard); }
    if (!resCard) return;
    const ks = (sum?.relics || []).filter(k => RELIC_BY_KEY[k]);
    const f = sum?.forgets | 0;
    resCard.hidden = !ks.length && !f;
    resCard.innerHTML = '<h3>이번 도전의 유물</h3>'
      + (ks.length ? `<div class="res-relic-row">${ks.map((k, i) => `<span class="res-relic" style="--i:${i}">${relicImg(k)}<b>${esc(RELIC_BY_KEY[k].name)}</b></span>`).join('')}</div>` : '<p class="res-relic-none">고른 유물이 없어요</p>')
      + (f ? `<p class="res-forget">${ERASE}망각 ${f}회 사용</p>` : '');
  }

  return {
    update, onEvents, renderResult,
    isOpen: () => open,                 // 유물 화면(전투 정지 · 뒤로가기 삼킴)
    forgetOpen: () => !sheet.hidden,    // 비우기 시트(카드 자동 선택 카운트다운 · 전투 멈춤)
    // 스킬 칸 말풍선에 붙는 '비우기' 버튼(ui.js 스택 탭). 전투 중 · 남은 망각 · 스킬 3개 이상이거나 칸이 찼을 때
    tipHTML(k) {
      const v = cur, n = Object.keys(v?.spells || {}).length;
      if (!v || v.pick || v.phase !== 'play' || !canForget(v) || !(v.spells?.[k] > 0) || (n < 3 && n < slotCap(v))) return '';
      const rec = forgetHint(v) === k;
      return `<span class="tip-fg-rec">${rec ? '<b>비우기 추천</b> — 칸이 꽉 찼고 짝이 없어요 · ' : ''}남은 망각 ${v.forgetLeft}회</span>`
        + `<button type="button" class="k-btn danger tip-forget" data-key="${k}">${ERASE}비우기 · 다음 카드 +${forgetRefund(k, v.spells[k])}레벨</button>`;
    },
    handleBack() {
      if (!sheet.hidden) { if (!fsConfirm.hidden) { fsList.hidden = false; fsConfirm.hidden = true; } else closeSheet(); return true; }
      return open;
    },
    hide() { hideRelic(); closeSheet(); },
  };
}

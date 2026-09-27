// 4차 던전(지역) 특성 화면: 지역 시작 배너 · HUD 지역 칩(탭 = 자세히) · 카드/스택 칸의 '약점!'·'내성' 배지.
// ui.js 가 createDungeonUI 를 만들고 훅 네 줄(update · card · slots · tip)만 부른다. 스타일은 public/css/dungeon.css
import { skillAffinity, regionView, traitsOf } from './dungeons.js';
import { icon } from './icons.js';

const SHOW_AT = 1.5, SHOW_MS = 4200; // 층 시작 뒤 캔버스 '새 층' 도장이 지나간 다음에 · 떠 있는 시간
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const elIco = el => icon('el-' + el);
const chips = (list, cls) => list.map(x => `<span class="dg-el ${cls}">${elIco(x.el)}<b>${esc(x.name)}</b></span>`).join('');
// 카드·칸 배지 문구
const BADGE = { weak: '약점!', resist: '내성' };

export function createDungeonUI({ stage, hudLeft, showTip }) {
  // HUD 칩: 약점 원소(밝게) · 내성 원소(흐리게) · 규칙 한 단어
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = 'st-chip dg-chip';
  chip.hidden = true;
  hudLeft.prepend(chip);
  chip.addEventListener('click', () => { if (cur) showTip(chip, 'dg-tip', tipHtml(cur), 5200); });

  // 지역 시작 배너(탭하면 닫힘)
  const ban = document.createElement('div');
  ban.className = 'dg-banner';
  ban.hidden = true;
  ban.setAttribute('role', 'status');
  stage.append(ban);
  let banT = 0;
  const hideBanner = () => {
    if (ban.hidden || ban.classList.contains('out')) return; // 이미 닫히는 중이면 타이머를 건드리지 않는다(매 프레임 불림)
    clearTimeout(banT);
    ban.classList.add('out');
    banT = setTimeout(() => { ban.hidden = true; ban.classList.remove('out'); }, 260);
  };
  ban.addEventListener('pointerdown', hideBanner);

  let game = null, cur = null, shown = '', due = false;
  function tipHtml(r) {
    return `<b>${esc(r.name)}</b> <span class="tip-dim">${r.floors[0]}~${r.floors[1]}층</span>`
      + `<span class="dg-tip-row"><span class="dg-lab weak">약점 +${r.weakPct}%</span>${chips(r.weak, 'weak')}</span>`
      + `<span class="dg-tip-row"><span class="dg-lab res">내성 −${r.resistPct}%</span>${chips(r.resist, 'res')}</span>`
      + `<span class="dg-tip-rule"><b>${esc(r.rule.name)}</b> ${esc(r.rule.desc)}</span><small>${esc(r.lore)}</small>`;
  }
  function paintChip(r) {
    chip.dataset.r = r.key;
    chip.innerHTML = r.weak.map(x => `<span class="dg-ic weak">${elIco(x.el)}</span>`).join('')
      + r.resist.map(x => `<span class="dg-ic res">${elIco(x.el)}</span>`).join('') + `<span class="dg-rn">${esc(r.rule.short)}</span>`;
    chip.setAttribute('aria-label', `지역 특성: ${r.name}. 약점 ${r.weak.map(x => x.name).join('·')}, 내성 ${r.resist.map(x => x.name).join('·')}, ${r.rule.name}`);
  }
  function showBanner(r) {
    clearTimeout(banT);
    ban.dataset.r = r.key;
    ban.innerHTML = `<span class="dg-kick">지역 특성</span><b class="dg-name">${esc(r.name)}</b>`
      + `<span class="dg-row"><span class="dg-lab weak">약점 +${r.weakPct}%</span>${chips(r.weak, 'weak')}`
      + `<span class="dg-lab res">내성 −${r.resistPct}%</span>${chips(r.resist, 'res')}</span>`
      + `<span class="dg-rule"><b>${esc(r.rule.name)}</b><span>${esc(r.rule.desc)}</span></span>`;
    ban.classList.remove('out');
    ban.hidden = false;
    ban.animate([{ transform: 'translateY(-24px) scale(.92)', opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: 380, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    banT = setTimeout(hideBanner, SHOW_MS);
  }

  return {
    // 매 프레임(ui.update). busy = 카드·유물 선택처럼 화면을 덮는 것이 떠 있음
    update(v, busy) {
      if (v !== game) { game = v; shown = ''; } // 새 도전·이어하기 = 지금 지역을 다시 알려 준다
      const t = traitsOf(v);
      const key = t ? t.key : '';
      if (!t) { cur = null; if (!chip.hidden) chip.hidden = true; hideBanner(); return; }
      if (!cur || cur.key !== key) { cur = regionView(v.theme); paintChip(cur); due = key !== shown; }
      if (chip.hidden) chip.hidden = false;
      if (due && v.phase === 'play' && !busy && v.phaseT >= SHOW_AT) { due = false; shown = key; showBanner(cur); chip.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' }); }
      if (busy || v.phase !== 'play') hideBanner();
    },
    // 카드 배지(openPick 에서 카드마다). key = 스킬 키(각성 카드 등은 null)
    card(btn, key, v) {
      // 지역 끝 5층: 다음 지역에서 약점(또는 열기 해소)이면 작은 두 번째 배지 — 봇 pickBias와 같은 창
      let n = btn.querySelector(':scope > .pc-dg2');
      const th = v ? v.theme | 0 : 0, soon = key && v && !v.traits && th + 1 < 5 && 20 - ((v.stage - 1) % 20) <= 5;
      const a2 = soon ? skillAffinity(v, key, th + 1) : null, t2 = a2 && (a2.tag === 'weak' ? '다음 지역 약점' : a2.cure ? '다음 지역 열기 해소' : '');
      if (t2) { if (!n) { n = document.createElement('span'); n.className = 'pc-dg2'; btn.append(n); } n.textContent = t2; n.hidden = false; } else if (n) n.hidden = true;
      let b = btn.querySelector(':scope > .pc-dg');
      const a = key && v ? skillAffinity(v, key) : null;
      const txt = a ? (a.cure ? '열기 해소' : BADGE[a.tag]) : '';
      if (!txt) { if (b) b.hidden = true; return; }
      if (!b) { b = document.createElement('span'); btn.append(b); }
      b.className = `pc-dg ${a.cure ? 'cure' : a.tag}`;
      b.textContent = txt;
      b.hidden = false;
    },
    // 스택 칸 표시(updateStack 끝). 스킬·지역이 바뀔 때만 다시
    slots(v, slots) {
      let sig = cur ? cur.key : '';
      for (const s of slots) sig += ',' + (s.key || ''); // 매 프레임 — 배열 없이
      if (sig === this._sig) return;
      this._sig = sig;
      for (const s of slots) {
        let m = s.b.querySelector(':scope > .dg-sb');
        const a = s.key ? skillAffinity(v, s.key) : null, tag = a && a.tag;
        if (!tag) { if (m) m.hidden = true; continue; }
        if (!m) { m = document.createElement('i'); m.setAttribute('aria-hidden', 'true'); s.b.append(m); }
        m.className = 'dg-sb ' + tag;
        m.textContent = tag === 'weak' ? '▲' : '▼';
        m.hidden = false;
      }
    },
    // 스킬 칸 툴팁 한 줄
    tip(v, key) {
      const a = key && v ? skillAffinity(v, key) : null;
      if (!a || !cur || (!a.tag && !a.cure)) return '';
      const pct = Math.round((a.mul - 1) * 100);
      return `<span class="dg-tip-line ${a.tag || 'cure'}">${esc(cur.name)}: ${a.tag === 'weak' ? `약점 — 피해 +${pct}%` : a.tag === 'resist' ? `내성 — 피해 ${pct}%` : ''}${a.cure ? `${a.tag ? ' · ' : ''}${esc(cur.rule.name)} 해소` : ''}</span>`;
    },
  };
}

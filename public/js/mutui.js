// 변이(4차) 화면 조각 — 카드 A/B 갈래 · 스택 칸 배지 · 툴팁 줄 + 강화 카드의 '전 → 후' 수치 줄(ui.js가 부른다). 문자열만 만든다
// (예외: createMutSheet — 좁은 화면에서 변이 카드를 누르면 뜨는 A/B 시트)
import { SPELL_BY_KEY, FUSION_BY_KEY, SKILL_BY_KEY, SPELL_MAX_LV } from './config.js';
import { MUT_BY_KEY, MUTATIONS } from './mutations.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const AB = ['A', 'B'];

// 변이 카드 본문: A/B 두 갈래(이름 + 무엇이 바뀌나). rec = 추천 갈래(자동 선택이 고를 쪽)
export function mutOptionsHTML(card, rec = -1) {
  return (card.muts || []).map((k, i) => {
    const m = MUT_BY_KEY[k];
    if (!m) return '';
    return `${i ? '<i class="pm-or">또는</i>' : ''}<span class="pm-opt${i === rec ? ' rec' : ''}" data-c="${i}" data-m="${k}" style="--mc:${m.col}">`
      + `<b class="pm-ab">${AB[i]}</b><b class="pm-name">${esc(m.name)}</b><span class="pm-short">${esc(m.short)}</span></span>`;
  }).join('');
}
export const mutCardLabel = card => `${SKILL_BY_KEY[card.spell]?.name || ''} Lv6 변이 — 둘 중 하나: ${(card.muts || []).map((k, i) => `${AB[i]} ${MUT_BY_KEY[k]?.name}: ${MUT_BY_KEY[k]?.short}`).join(' / ')}`;

// 스택 칸 배지(고른 변이): 갈래 글자 + 변이 색 보석
const abOf = k => (MUTATIONS[MUT_BY_KEY[k]?.skill] || []).findIndex(m => m.key === k);
export const mutBadgeHTML = k => (MUT_BY_KEY[k] ? `<span class="ssm-gem" style="--mc:${MUT_BY_KEY[k].col}"><b>${AB[abOf(k)] || ''}</b></span>` : '');
export const mutName = k => MUT_BY_KEY[k]?.name || '';
// 스택 칸 툴팁 줄: 변이했으면 이름·설명, Lv6인데 아직이면 대기 안내
export function mutTipHTML(key, lv, mk) {
  const m = MUT_BY_KEY[mk];
  if (m) return `<span class="tip-mut" style="--mc:${m.col}"><b>변이 · ${esc(m.name)}</b> ${esc(m.desc)}</span>`;
  if (lv >= SPELL_MAX_LV && SKILL_BY_KEY[key]) return '<span class="tip-mut wait"><b>변이 대기</b> 다음 카드에서 두 갈래 중 하나를 고를 수 있어요</span>';
  return '';
}

// ── 강화 카드: 수치 '전 → 후' 줄(짧게) ──
const PCT = v => `${Math.round(v * 100)}%`, PCT1 = v => `${Math.round(v * 1000) / 10}%`, SEC = v => `${+v.toFixed(2)}초`, N = v => `${v}`;
// 필드 → [이름, 형식]. 스킬마다 뜻이 다른 필드(mul·n)는 SKILL_LABEL이 덮는다
const LABEL = { mul: ['마력', PCT], r: ['반경', N], w: ['폭', N], cd: ['쿨타임', SEC], n: ['개수', N], chance: ['확률', PCT], burn: ['화상', PCT], dur: ['지속', SEC],
  slow: ['둔화', PCT], rate: ['재생/초', PCT1], goldMul: ['골드', v => `+${PCT(v)}`], heal: ['회복', PCT1], hpMul: ['체력', PCT], breathT: ['브레스', SEC] };
const SKILL_LABEL = {
  tornado: { mul: ['초당 마력', PCT] }, babyDragon: { mul: ['초당 마력', PCT] }, blazeTornado: { mul: ['초당 마력', PCT] },
  stormEye: { mul: ['벼락 마력', PCT] }, ghostLegion: { mul: ['유령 마력', PCT], n: ['유령', v => `${v}마리`] },
  chainLightning: { mul: ['전이 피해', PCT], n: ['전이', v => `${v}마리`] }, gale: { mul: ['시전 속도', v => `+${PCT(v)}`] },
  curseMark: { mul: ['받는 피해', v => `+${PCT(v)}`] }, lightningStrike: { n: ['줄기', N] }, superconduct: { n: ['줄기', N] }, plasma: { n: ['번개', v => `${v}갈래`] },
};
// → ['마력 240% → <em>310%</em>', …] (바뀐 수치만, 최대 3줄). from = 지금 레벨(카드 card.from — 쌍둥이 달·따라잡기는 2레벨씩), 0 = 새 스킬
export function upgradeLines(key, level, from = level - 1) {
  const lv = FUSION_BY_KEY[key]?.lv || SPELL_BY_KEY[key]?.lv;
  if (!lv || from < 1 || level <= from || !lv[level - 1]) return [];
  const a = lv[from - 1], b = lv[level - 1], out = [];
  for (const f of Object.keys(b)) {
    const L = SKILL_LABEL[key]?.[f] || LABEL[f];
    if (!L || a[f] === b[f]) continue;
    out.push(`${L[0]} ${esc(L[1](a[f]))} → <em>${esc(L[1](b[f]))}</em>`);
  }
  return out.slice(0, 3);
}
// 강화 카드 설명 HTML(수치 줄 + 만렙이면 '완전체 연출 · 변이 해금')
export function upgradeHTML(key, level, from = level - 1, max = 3) { // max = 줄 수(좁은 화면 카드 4~5장이면 2)
  const lines = upgradeLines(key, level, from).slice(0, level >= SPELL_MAX_LV ? max - 1 : max); // 만렙 카드는 완전체 줄 자리를 남긴다
  if (!lines.length) return '';
  return lines.map(l => `<span class="pu-l">${l}</span>`).join('')
    + (level >= SPELL_MAX_LV ? `<span class="pu-max">${max < 3 ? 'Lv6 완전체 · 변이' : 'Lv6 완전체 연출 · 변이 해금'}</span>` : '');
}

// ── 좁은 화면(카드 4~5장 · 폰) A/B 시트: 카드 속 갈래 글이 잘려 읽을 수 없으니, 변이 카드를 누르면 두 갈래를 크게 보여 주고 거기서 고른다.
// 모양은 비우기 시트(relics.css .forget-sheet · .fs-card)를 그대로 쓴다. onChoose(cardIndex, choice)
export function createMutSheet(host, onChoose, art) {
  const sh = document.createElement('div');
  sh.className = 'forget-sheet mut-sheet';
  sh.hidden = true;
  sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true'); sh.setAttribute('aria-labelledby', 'mut-sheet-h');
  sh.innerHTML = '<div class="fs-card"><div class="ms-head"><span class="ms-art"></span><div><span class="ms-kick">Lv6 변이 · 하나만</span><h3 id="mut-sheet-h"></h3></div></div>'
    + '<div class="ms-opts"></div><button type="button" class="k-btn secondary fs-cancel">다른 카드 보기</button></div>';
  host.append(sh);
  let idx = -1;
  const close = () => { if (!sh.hidden) { sh.hidden = true; idx = -1; } };
  sh.querySelector('.fs-cancel').addEventListener('click', close);
  sh.addEventListener('click', e => {
    if (e.target === sh) return close();
    const o = e.target.closest('.ms-opt');
    if (o && idx >= 0) { const i = idx; close(); onChoose(i, +o.dataset.c); }
  });
  return {
    open(card, i, rec = -1) {
      idx = i;
      sh.querySelector('.ms-art').innerHTML = art ? art(card.spell) : '';
      sh.querySelector('h3').textContent = `${SKILL_BY_KEY[card.spell]?.name || ''} — 어떻게 바뀔까요?`;
      sh.querySelector('.ms-opts').innerHTML = (card.muts || []).map((k, c) => {
        const m = MUT_BY_KEY[k];
        return m ? `<button type="button" class="ms-opt${c === rec ? ' rec' : ''}" data-c="${c}" style="--mc:${m.col}"><b class="pm-ab">${AB[c]}</b>`
          + `<b class="ms-name">${esc(m.name)}</b><span class="ms-short">${esc(m.short)}</span><span class="ms-desc">${esc(m.desc)}</span></button>` : '';
      }).join('');
      sh.hidden = false;
      sh.querySelector('.ms-opt')?.focus({ preventScroll: true });
    },
    close, isOpen: () => !sh.hidden,
  };
}

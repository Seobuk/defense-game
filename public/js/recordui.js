// v0.1.1 기록 화면(#m-records) + 도전 상세(#m-record) — 정비 화면 '기록' 탭. 저장 객체의 lifetime · history(records.js)를 읽기만 한다.
// 기록은 백업 코드에서 올 수 있는 값이라 키는 표(SKILL_BY_KEY · RELIC_BY_KEY …)로만 이름을 찾아 그리고, 모르는 키는 건너뛴다. 재질 kit.css, 배치 css/records.css
import { HERO_CLASSES, heroTier } from './hero.js';
import { SKILL_BY_KEY, FUSION_BY_KEY, THEMES, SPELL_MAX_LV } from './config.js';
import { RELIC_BY_KEY } from './relics.js';
import { REGION_KEYS } from './dungeons.js';
import { TALENTS } from './talents.js';
import { CLS_INFO } from './heroui.js';
import { mutName } from './mutui.js';
import { heroPortraitURL } from './art/units.js';
import { emblemImg } from './art/emblems.js';
import { relicImg } from './art/relicart.js';
import { icon } from './icons.js';
import { fmt } from './util.js';
import { favClass, BUCKETS, HISTORY_MAX } from './records.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const RES = { fall: ['붕괴', 'red'], abandon: ['포기', 'gray'], clear100: ['100층 돌파', 'gold'] };
const RES_H = { fall: '성벽 붕괴', abandon: '도전 포기', clear100: '100층 돌파!' };
const two = n => String(n).padStart(2, '0');
// 플레이 시간: 짧으면 분·초, 길면 시간·분
export function durText(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
  return h ? `${h}시간 ${m}분` : m ? `${m}분${s && m < 10 ? ` ${s}초` : ''}` : `${s}초`;
}
// 날짜: 오늘/어제는 시각, 올해는 월·일, 그 전은 연도까지
export function dateText(t, now = new Date()) {
  if (!t) return '날짜 모름';
  const d = new Date(t), day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 864e5), hm = `${two(d.getHours())}:${two(d.getMinutes())}`;
  return diff === 0 ? `오늘 ${hm}` : diff === 1 ? `어제 ${hm}` : d.getFullYear() === now.getFullYear() ? `${d.getMonth() + 1}월 ${d.getDate()}일 ${hm}` : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}
const por = (cls, lv, px) => (HERO_CLASSES[cls] ? `<img src="${heroPortraitURL(cls, heroTier(lv), null, px)}" alt="" draggable="false">` : icon('hero'));
const tone = k => { const f = FUSION_BY_KEY[k]; return f ? ['fusion', `--fa:var(--elc-${f.elements[0]});--fb:var(--elc-${f.elements[1]})`] : ['el-' + (SKILL_BY_KEY[k]?.element || 'holy'), '']; };
const skillArt = k => emblemImg(k) || icon('el-' + (SKILL_BY_KEY[k]?.element || 'holy'));
// 주요 스킬: 아는 스킬만, 융합 먼저 · 레벨 높은 순
const mainSkills = r => r.sk.filter(s => SKILL_BY_KEY[s.k]).sort((a, b) => (FUSION_BY_KEY[b.k] ? 10 : 0) + b.lv - (FUSION_BY_KEY[a.k] ? 10 : 0) - a.lv);

export function createRecordUI(root, { openModal, closeModal }) {
  const layer = root.querySelector('#layer');
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div class="modal rec-modal" id="m-records" hidden role="dialog" aria-modal="true" aria-labelledby="rec-h">
      <div class="k-modal dark rec">
        <div class="k-ribbon gold"><h2 id="rec-h">도전 기록</h2></div>
        <button class="k-close" data-close aria-label="닫기">${icon('close')}</button>
        <div class="k-sheet rec-sheet">
          <section class="rec-top"></section>
          <div class="rec-stats"></div>
          <section class="rec-card rec-dist" hidden><h3>도전이 끝난 층</h3><div class="rec-bars"></div></section>
          <h3 class="rec-h3">최근 도전<em class="rec-n"></em></h3>
          <ol class="rec-list"></ol>
          <button class="k-btn neutral s wide rec-more" hidden></button>
          <div class="rec-empty" hidden>${icon('trophy')}<b>아직 기록이 없어요</b><span>도전을 마치면 층·스킬·유물이 여기에 남아요</span></div>
          <p class="rec-foot">기록은 이 기기에만 저장돼요 · 최근 ${HISTORY_MAX}건 · 백업 코드엔 최근 20건</p>
        </div>
      </div>
    </div>
    <div class="modal rec-modal" id="m-record" hidden role="dialog" aria-modal="true" aria-labelledby="rd-h">
      <div class="k-modal dark rec rd">
        <div class="k-ribbon"><h2 id="rd-h">도전 상세</h2></div>
        <button class="k-close" data-close aria-label="닫기">${icon('close')}</button>
        <div class="k-sheet rec-sheet rd-sheet"></div>
      </div>
    </div>`;
  const [mList, mDetail] = [...wrap.children];
  layer.append(mList, mDetail);
  for (const m of [mList, mDetail]) {
    m.querySelector('.k-modal').setAttribute('tabindex', '-1');
    m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
    m.querySelector('[data-close]').addEventListener('click', () => closeModal(m.id));
  }
  const $ = s => mList.querySelector(s);
  let hist = [], shown = 0, now = new Date();
  // 줄마다 스킬 문장 그림(data URL)이 커서 300건을 한 번에 그리면 수십 MB — PAGE건씩 이어 붙인다
  const PAGE = 30;
  const row = (r, i) => {
    const [rl, rc] = RES[r.res] || RES.fall, c = HERO_CLASSES[r.cls];
    const sk = mainSkills(r).slice(0, 4).map(s => { const [tc, st] = tone(s.k); return `<span class="rec-sk ${tc}" style="${st}">${skillArt(s.k)}</span>`; }).join('');
    return `<li><button class="rec-row" data-i="${i}" data-res="${rc}" style="--cc:${CLS_INFO[r.cls]?.col || '#7b6cff'}" aria-label="${esc(dateText(r.t1, now))} ${r.fl}층 ${rl}${c ? ' ' + esc(c.name) : ''}">
      <span class="rec-por">${por(r.cls, r.hl, 96)}</span>
      <span class="rec-main"><span class="rec-l1"><b class="k-num rec-fl">${r.fl}<small>층</small></b><i class="rec-res">${rl}</i></span>
        <span class="rec-date">${esc(dateText(r.t1, now))}${r.ps ? ` · ${esc(durText(r.ps))}` : ''}</span></span>
      <span class="rec-sks">${sk}</span></button></li>`;
  };
  function more() {
    const end = Math.min(hist.length, shown + PAGE);
    $('.rec-list').insertAdjacentHTML('beforeend', hist.slice(shown, end).map((r, j) => row(r, shown + j)).join(''));
    shown = end;
    const left = hist.length - shown;
    $('.rec-more').hidden = left <= 0;
    $('.rec-more').textContent = `더 보기 · 남은 ${left}건`;
  }
  $('.rec-more').addEventListener('click', more);
  $('.rec-list').addEventListener('click', e => { const b = e.target.closest('.rec-row'); if (b) openDetail(hist[+b.dataset.i]); });

  function open(save) {
    const L = save?.lifetime || {}, best = save?.best | 0, fav = favClass(L);
    hist = Array.isArray(save?.history) ? save.history.slice().reverse() : []; // 최근 먼저
    const cc = fav ? CLS_INFO[fav.cls]?.col : '#7b6cff';
    $('.rec-top').style.setProperty('--cc', cc);
    $('.rec-top').innerHTML = `
      <span class="rec-top-por">${fav ? por(fav.cls, save.hero?.level, 200) : icon('trophy')}</span>
      <div class="rec-top-txt">
        <span class="rec-k">최고 기록</span>
        <b class="k-num gold rec-best">${best}<small>층</small></b>
        <span class="rec-fav">${fav ? `주력 영웅 <b>${esc(HERO_CLASSES[fav.cls].name)}</b> · ${fmt(fav.runs)}회 · 최고 ${fav.best}층` : '주력 영웅은 도전을 마치면 나타나요'}</span>
      </div>`;
    const stat = (ic, k, v, cls = '') => `<div>${icon(ic)}<span>${k}</span><b class="k-num ${cls}">${v}</b></div>`;
    $('.rec-stats').innerHTML = stat('speed', '총 플레이', esc(durText(L.playSec))) + stat('wall', '도전', `${fmt(L.runs | 0)}회`)
      + stat('atk', '총 처치', fmt(L.kills || 0)) + stat('crit', '보스 처치', fmt(L.bossKills || 0), 'gold');
    const ends = Array.isArray(L.ends) ? L.ends : [], top = Math.max(0, ...ends);
    $('.rec-dist').hidden = !(top > 0);
    if (top > 0) $('.rec-bars').innerHTML = Array.from({ length: BUCKETS }, (_, i) => {
      const n = ends[i] | 0;
      return `<div class="rec-bar${n === top ? ' top' : ''}" title="${i * 10 + 1}~${i * 10 + 10}층 ${n}회"><em class="k-num">${n || ''}</em><i style="--h:${(n / top).toFixed(3)}"></i><span>${i * 10 + 1}</span></div>`;
    }).join('');
    $('.rec-n').textContent = hist.length ? `${hist.length}건` : '';
    $('.rec-empty').hidden = hist.length > 0;
    now = new Date();
    $('.rec-list').textContent = '';
    shown = 0;
    more();
    mList.querySelector('.rec-sheet').scrollTop = 0;
    openModal('m-records');
  }

  function openDetail(r) {
    if (!r) return;
    const [rl, rc] = RES[r.res] || RES.fall, c = HERO_CLASSES[r.cls], branches = TALENTS[r.cls] || [];
    const rb = mDetail.querySelector('.k-ribbon');
    rb.className = `k-ribbon ${rc}`;
    rb.firstElementChild.textContent = RES_H[r.res] || rl;
    const ri = REGION_KEYS.indexOf(r.rg), region = THEMES[ri]?.name || '';
    const tal = [...r.tm.map(k => branches.find(b => b.key === k)?.name).filter(Boolean).map(n => `${n} 마스터`),
      ...(r.tc ? [branches.flatMap(b => b.nodes).find(n => n.cap === r.tc)?.name].filter(Boolean).map(n => `궁극 ${n}`) : [])];
    const cell = (ic, k, v, cls = '') => `<div>${icon(ic)}<span>${k}</span><b class="k-num ${cls}">${v}</b></div>`;
    const sk = mainSkills(r).map(s => {
      const d = SKILL_BY_KEY[s.k], [tc, st] = tone(s.k), f = FUSION_BY_KEY[s.k];
      const parts = f && s.p ? s.p.map(p => SKILL_BY_KEY[p]?.name).filter(Boolean) : [];
      return `<div class="rd-sk ${tc}" style="${st}"><span class="rd-sk-art">${skillArt(s.k)}</span><span class="rd-sk-txt"><b>${esc(d.name)}</b>
        <span class="rd-sk-lv">Lv${Math.min(s.lv, SPELL_MAX_LV)}${s.m && mutName(s.m) ? ` · 변이 ${esc(mutName(s.m))}` : ''}</span>${parts.length ? `<span class="rd-sk-parts">${esc(parts.join(' + '))}</span>` : ''}</span></div>`;
    }).join('');
    const rel = r.rl.filter(k => RELIC_BY_KEY[k]).map(k => `<span class="rd-relic">${relicImg(k, 'rd-relic-em')}<b>${esc(RELIC_BY_KEY[k].name)}</b></span>`).join('');
    const notes = [r.fg ? `망각 ${r.fg}회` : '', r.sp > 1 ? `최대 ${r.sp}배속` : '', r.ap ? '카드 자동 선택 사용' : '', r.app ? `버전 ${esc(r.app)}` : ''].filter(Boolean);
    mDetail.querySelector('.rd-sheet').innerHTML = `
      <section class="rd-head" style="--cc:${CLS_INFO[r.cls]?.col || '#7b6cff'}" data-res="${rc}">
        <span class="rd-por">${por(r.cls, r.hl, 200)}</span>
        <div><b class="k-num ${rc === 'gold' ? 'gold' : ''} rd-fl">${r.fl}<small>층 도달</small></b>
          <span class="rd-sub">${c ? `${esc(c.name)} Lv.${r.hl}` : `영웅 Lv.${r.hl}`} · ${r.cl}층 돌파</span>
          <span class="rd-date">${esc(dateText(r.t1))}${region ? ` · ${esc(region)}` : ''}</span></div>
      </section>
      <div class="rec-stats rd-stats">
        ${cell('speed', '플레이 시간', esc(durText(r.ps)))}${cell('atk', '처치', fmt(r.k))}${cell('crit', '보스 처치', fmt(r.bk), 'gold')}
        ${cell('multi', '최고 콤보', fmt(r.cb))}${cell('coin', '골드', '+' + fmt(r.go), 'gold')}${cell('gem', '보석', '+' + fmt(r.ge), 'gem-n')}
      </div>
      ${sk ? `<section class="rec-card"><h3>스킬</h3><div class="rd-sks">${sk}</div></section>` : ''}
      ${rel ? `<section class="rec-card"><h3>유물</h3><div class="rd-relics">${rel}</div></section>` : ''}
      ${tal.length ? `<section class="rec-card"><h3>특성</h3><p class="rd-tal">${esc(tal.join(' · '))}</p></section>` : ''}
      ${notes.length ? `<p class="rec-foot">${notes.join(' · ')}</p>` : ''}
      <button class="k-btn wide rd-ok" data-autofocus>확인</button>`;
    mDetail.querySelector('.rd-ok').addEventListener('click', () => closeModal('m-record'));
    mDetail.querySelector('.rd-sheet').scrollTop = 0;
    openModal('m-record');
  }
  return { open };
}

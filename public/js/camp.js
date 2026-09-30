// 정비 화면(도전 사이) — 영웅 클래스 · 장비 · 특성 트리 · 시작 스킬 · 마법사 수련(골드) · 보석 강화 · 도감 · 기록 · 도전 시작.
// 자기 DOM을 스스로 만들어 root(#app)에 붙인다. 메타 객체(save.js normalize 결과)는 읽기만 하고, 바꾸는 건 전부 handlers 로.
// 재질 kit.css, 배치 hero.css(.cp-*). docs/DESIGN.md '로그라이트 구현 계약' UI 통합 흐름
import { HERO_CLASSES, HERO_CLASS_KEYS, heroTier, heroTitle, heroPower, HERO_TIERS, SLOTS, SLOT_NAMES } from './hero.js';
import { META_UPGRADES, metaCost, metaMax, metaDisplay, SPELLS, SPELL_BY_KEY, CODEX_SYN, codexFound, MAGE_TRAINING, TRAIN_KEYS, trainCost, trainMax, trainDisplay } from './config.js';
import { startSlots, startSpellChoices } from './run.js';
import { TALENTS, talentLeft, talentPoints, branchSpent, branchMax } from './talents.js';
import { createTalentTree, BRANCH_COL } from './talentui.js';
import { runeRingURL, CLS_INFO, UNLOCK_TEXT, slotSil } from './heroui.js';
import { heroPortraitURL, itemIconURL, magePortraitURL } from './art/units.js';
import { emblemImg } from './art/emblems.js';
import { icon } from './icons.js';
import { fmt } from './util.js';
import { createShopUI } from './shopui.js'; // 4차 경제: 상점 탭(상자·유물) · 출정 준비 카드
import { trainBreakCost, trainBreakText, gemBreakOpen, gemBreakCost, gemBreakText, GEM_BREAK } from './shop.js';
import { openGemStore, gemStoreBannerArt } from './gemstoreui.js'; // v0.1.2 보석 충전(결제 미연결)
import { openAltar, openWardrobe, maybeGift, summonDot, altarTabIcon, wardrobeIcon } from './summonui.js'; // v0.1.2 외형 소환: '소환' 탭 · 옷장 버튼 · 환영 선물

const META_ICON = {
  greed: 'coin', wisdom: 'hero', choice: 'new', reroll: 'reroll', startSlot: 'codex', revive: 'em:flawless', critBoom: 'em:critBoom', awaken: 'crit', pickaxe: 'em:pickaxe', forget: 'reroll',
};
// 상점 타일 색(분류): 전투 · 경제 · 카드 · 특수
const META_TONE = { critBoom: 'r', awaken: 'r', greed: 'y', pickaxe: 'y', wisdom: 'b', choice: 'p', reroll: 'p', startSlot: 'p', revive: 'g', forget: 'p' };
// 마법사 수련 타일 색 = 옛 인게임 강화 버튼 색(마력 보라 · 시전 속도 금 · 치명타 빨강 · 다중 시전 파랑 · 성벽 결계 초록)
const TRAIN_TONE = { atk: 'p', rate: 'y', crit: 'r', multi: 'b', wall: 'g' };
const TRAIN_TOTAL = MAGE_TRAINING.reduce((a, t) => a + t.max, 0);
const art = (k, cls = 'em') => (k.startsWith('em:') ? emblemImg(k.slice(3), cls) : icon(k));
const TIER_R = ['common', 'uncommon', 'rare', 'epic', 'legend'];
const gold = m => Math.floor(Number(m.gold) || 0);
const trainLv = (m, k) => (m.training && m.training[k]) | 0;

export function createCamp(root, H = {}) {
  const el = document.createElement('section');
  el.className = 'camp';
  el.hidden = true;
  el.setAttribute('aria-label', '정비 화면');
  el.innerHTML = `
    <div class="cp-bg" aria-hidden="true"><i class="cp-glow"></i><i class="cp-stars"></i></div>
    <header class="cp-top">
      <div class="cp-rec">${icon('trophy')}<div><span class="cp-nick"></span><b class="k-num gold cp-best">0층</b></div><em class="cp-runs"></em></div>
      <div class="cp-gold" aria-label="골드">${icon('coin')}<b class="k-num gold cp-goldn">0</b></div>
      <div class="cp-gems" aria-label="보석">${icon('gem')}<b class="k-num gem-n cp-gemn">0</b><button class="cp-gem-plus" aria-label="보석 충전"><i></i><i></i></button></div>
      <button class="k-btn round s neutral cp-set" aria-label="설정">${icon('settings')}</button>
    </header>
    <main class="cp-body">
      <section class="cp-pane" data-pane="sortie">
        <div class="cp-hero hu-stage">
          <div class="hu-rays" aria-hidden="true"></div>
          <div class="hu-pedestal" aria-hidden="true"><i style="--rune:url(${runeRingURL()})"></i></div>
          <img class="hu-hero cp-hero-img" alt="" draggable="false">
          <div class="hu-cp-lock cp-lock" hidden>${icon('lock')}<span></span></div>
          <button class="hu-nav prev" aria-label="이전 영웅">‹</button><button class="hu-nav next" aria-label="다음 영웅">›</button>
          <button class="cp-tpts" hidden></button>
          <span class="cp-cur" hidden>${icon('check')}출전</span>
          <button class="cp-wardrobe" aria-label="옷장 — 외형 바꾸기">${wardrobeIcon()}<span>옷장</span></button>
        </div>
        <div class="cp-id">
          <div class="cp-namerow"><h2 class="cp-name"></h2><span class="hu-role cp-role"></span></div>
          <div class="cp-subrow"><span class="hu-tier cp-tier"></span><b class="cp-lv k-num"></b><span class="cp-pow">전투력 <b class="k-num gold"></b></span></div>
        </div>
        <div class="hu-thumbs cp-thumbs" role="tablist" aria-label="영웅 클래스"></div>
        <div class="cp-gear">
          <div class="cp-gear-slots"></div>
          <button class="k-btn s secondary cp-gear-btn">${icon('bag')}장비 · 가방</button>
        </div>
        <section class="cp-card cp-ss">
          <h3 class="cp-h">${icon('codex')}시작 스킬<em class="cp-h-sub"></em></h3>
          <div class="cp-ss-slots"></div>
          <p class="cp-note cp-ss-note"></p>
        </section>
        <section class="cp-card sh-prep" aria-label="출정 준비"></section>
        <section class="cp-card cp-goal"></section>
      </section>
      <section class="cp-pane" data-pane="train" hidden>
        <div class="cp-tr-top">
          <div class="cp-tr-mages" aria-hidden="true"><i class="cp-tr-glow"></i><img class="cp-tr-m solo" alt="" draggable="false"></div>
          <div class="cp-tr-info">
            <h3>마법사 수련</h3>
            <div class="cp-tr-gold">${icon('coin')}<b class="k-num gold cp-tr-goldn">0</b></div>
          </div>
        </div>
        <p class="cp-note cp-tr-note">도전 중 처치로 모은 <b>골드</b>로 성벽 위 대마법사의 기본기를 영구히 다져요. 마법사의 진짜 힘은 도전 중 고르는 <b>스킬</b>이에요.</p>
        <div class="cp-tr-rank"><span>수련 단계</span><div class="k-bar gold cp-tr-bar"><i></i></div><b class="k-num cp-tr-sum"></b></div>
        <div class="cp-shop-list cp-train-list"></div>
      </section>
      <section class="cp-pane" data-pane="talent" hidden>
        <div class="cp-tcls"></div>
        <div class="cp-thost"></div>
      </section>
      <section class="cp-pane" data-pane="shop" hidden>
        <div class="sh-sec" data-sec="meta">
          <div class="cp-shop-top">
            <span class="cp-shop-art" aria-hidden="true">${emblemImg('gems')}</span>
            <div><b class="k-num gem-n cp-shop-gems">0</b><p>보석 강화는 카드 선택지·새로고침·시작 스킬·부활처럼 도전을 편하게 만들어요. 골드 획득·황금 곡괭이는 만렙 뒤 <i class="sh-hl">보석 돌파</i>로 끝없이 올라요.</p></div>
          </div>
          <div class="cp-shop-list cp-meta-list"></div>
        </div>
      </section>
    </main>
    <footer class="cp-dock">
      <div class="cp-lo" aria-label="출정 조합">
        <span class="cp-lo-por"><img alt="" draggable="false"></span>
        <div class="cp-lo-txt"><b></b><span></span></div>
        <div class="cp-lo-tal" aria-label="특성 배분"></div>
        <div class="cp-lo-sp"></div>
      </div>
      <div class="cp-go">
        <button class="k-btn secondary cp-same"><span>같은 조합</span><span class="k-sub cp-same-sub"></span></button>
        <button class="k-btn l cp-start is-ready"><span>도전 시작</span><span class="k-sub">1층부터</span></button>
      </div>
    </footer>
    <nav class="cp-nav" role="tablist" aria-label="정비 메뉴">
      <button class="cp-tab" data-go="sortie" role="tab" aria-selected="true">${icon('wall')}<span>출정</span></button>
      <button class="cp-tab" data-go="train" role="tab" aria-selected="false">${icon('atk')}<span>수련</span><i class="cp-dot" hidden></i></button>
      <button class="cp-tab" data-go="talent" role="tab" aria-selected="false">${icon('crit')}<span>특성</span><i class="cp-dot" hidden></i></button>
      <button class="cp-tab" data-go="shop" role="tab" aria-selected="false">${icon('shop')}<span>상점</span><i class="cp-dot" hidden></i></button>
      <button class="cp-tab" data-go="summon">${altarTabIcon()}<span>소환</span><i class="cp-dot" hidden></i></button>
      <button class="cp-tab" data-go="codex">${icon('codex')}<span>도감</span><i class="cp-dot" hidden></i></button>
      <button class="cp-tab" data-go="records">${icon('trophy')}<span>기록</span></button>
    </nav>
    <div class="cp-ov" hidden>
      <div class="k-modal dark cp-pick" role="dialog" aria-modal="true" aria-labelledby="cp-pick-h">
        <div class="k-ribbon"><h2 id="cp-pick-h">시작 스킬 선택</h2></div>
        <button class="k-close cp-pick-x" aria-label="닫기">${icon('close')}</button>
        <div class="k-sheet">
          <p class="cp-note">도전 중 카드로 <b>한 번이라도 뽑아 본 스킬</b>만 Lv1로 들고 시작할 수 있어요.</p>
          <div class="cp-pick-grid"></div>
          <button class="k-btn gray wide cp-pick-clear">이 칸 비우기</button>
        </div>
      </div>
    </div>
    <div class="cp-ov cp-notice" hidden>
      <div class="k-modal dark narrow" role="dialog" aria-modal="true" aria-labelledby="cp-notice-h">
        <div class="k-ribbon gold"><h2 id="cp-notice-h">특성 개편!</h2></div>
        <div class="k-sheet center">
          <div class="cp-nt-art" aria-hidden="true"><i></i>${icon('crit')}</div>
          <p class="cp-nt-lead">특성이 개편되어 포인트를 돌려받았어요</p>
          <ul class="cp-nt-list">
            <li>갈래에 쓴 포인트만큼 <b>다음 단</b>이 열려요</li>
            <li><b>궁극 특성은 하나만</b> — 어느 갈래를 마스터할지 골라요</li>
            <li>두 갈래를 섞으면 <b>혼합 특성</b>이 열려요</li>
          </ul>
          <button class="k-btn l wide cp-nt-go">${icon('crit')}특성 찍으러 가기</button>
          <button class="k-btn gray wide cp-nt-ok">나중에</button>
        </div>
      </div>
    </div>`;
  root.append(el);

  const $ = s => el.querySelector(s), $$ = s => [...el.querySelectorAll(s)];
  const on = (e, ev, fn) => e.addEventListener(ev, fn);
  const txt = (e, s) => { if (e.textContent !== s) e.textContent = s; };
  let meta = null, pane = 'sortie', preview = 'knight', startSpells = [], sig = '', pickSlot = -1, tCls = null, lastCls = null;

  const shop = createShopUI(el, $('.cp-pane[data-pane="shop"]'), $('.sh-prep'), H);
  // v0.1.2 보석 충전(gemstoreui.js — 결제 미연결): 상단 보석 (+) · 상점 탭 맨 위 배너
  $('.cp-pane[data-pane="shop"]').insertAdjacentHTML('afterbegin', `<button class="gs-bn">${gemStoreBannerArt()}<span class="gs-bn-t"><b>보석 충전</b><span>첫 구매 보석 2배 · 초보자 패키지</span></span><span class="gs-bn-go" aria-hidden="true">›</span></button>`);
  for (const b of [$('.cp-gem-plus'), $('.gs-bn')]) b.addEventListener('click', () => openGemStore(meta?.gems));
  const tree = createTalentTree($('.cp-thost'), el, {
    onAllocate: key => !!H.onCampAct?.({ type: 'talent', cls: tCls, key }),
    onReset: () => !!H.onCampAct?.({ type: 'talentReset', cls: tCls }),
    onRefund: key => !!H.onCampAct?.({ type: 'talentRefund', cls: tCls, key }),
    toast: (m, i) => H.toast?.(m, i),
    onAutoToggle: on2 => H.onCampAct?.({ type: 'autoTalent', on: on2, cls: tCls }),
  });

  const unlocked = cls => HERO_CLASSES[cls].unlock(meta.best);
  const cur = () => meta.hero.cls && unlocked(meta.hero.cls) ? meta.hero.cls : HERO_CLASS_KEYS.find(unlocked);
  const portrait = (cls, px, lockedLook) => heroPortraitURL(cls, lockedLook ? 0 : heroTier(meta.hero.level), lockedLook ? null : meta.hero.equip, px);

  // ── 탭 ──
  for (const b of $$('.cp-tab')) on(b, 'click', () => (b.dataset.go === 'codex' ? H.onOpenCodex?.() : b.dataset.go === 'summon' ? openAltar() : b.dataset.go === 'records' ? H.onOpenRecords?.(meta) : setPane(b.dataset.go)));
  function setPane(p) {
    pane = p;
    for (const b of $$('.cp-tab[role="tab"]')) b.setAttribute('aria-selected', String(b.dataset.go === p));
    for (const s of $$('.cp-pane')) s.hidden = s.dataset.pane !== p;
    $('.cp-body').scrollTop = 0;
    if (p === 'talent') tCls = cur();
    render(true);
  }
  on($('.cp-set'), 'click', () => H.onOpenSettings?.());

  // ── 영웅 선택(무대 + 썸네일): 해금된 클래스는 누르는 즉시 출전 영웅이 된다 ──
  function choose(cls) {
    preview = cls;
    if (unlocked(cls) && meta.hero.cls !== cls) H.onCampAct?.({ type: 'heroClass', cls });
    render(true);
    const img = $('.cp-hero-img');
    img.classList.remove('in'); void img.offsetWidth; img.classList.add('in');
  }
  const step = d => choose(HERO_CLASS_KEYS[(HERO_CLASS_KEYS.indexOf(preview) + d + HERO_CLASS_KEYS.length) % HERO_CLASS_KEYS.length]);
  on($('.cp-hero .prev'), 'click', () => step(-1));
  on($('.cp-hero .next'), 'click', () => step(1));
  { let sx = null; const st = $('.cp-hero');
    on(st, 'pointerdown', e => { sx = e.clientX; });
    on(st, 'pointerup', e => { if (sx != null && Math.abs(e.clientX - sx) > 40) step(e.clientX < sx ? 1 : -1); sx = null; }); }
  on($('.cp-tpts'), 'click', () => setPane('talent'));
  on($('.cp-gear-btn'), 'click', () => H.onOpenHero?.({ tab: 'char' }));
  on($('.cp-wardrobe'), 'click', () => openWardrobe({ cls: preview }));

  // ── 시작 스킬 ──
  function validStart() {
    const n = startSlots(meta), ok = startSpellChoices(meta);
    startSpells = [...new Set(startSpells)].filter(k => ok.includes(k)).slice(0, n);
  }
  function openPick(slot) {
    pickSlot = slot;
    const ok = startSpellChoices(meta);
    $('.cp-pick-grid').innerHTML = SPELLS.map(s => {
      const seen = ok.includes(s.key), used = startSpells.includes(s.key) && startSpells[slot] !== s.key, sel = startSpells[slot] === s.key;
      return `<button class="cp-sp el-${s.element}${seen ? '' : ' locked'}${used ? ' used' : ''}${sel ? ' sel' : ''}" data-k="${s.key}" ${seen && !used ? '' : 'disabled'}>
        <span class="cp-sp-art">${emblemImg(s.key)}</span><span class="cp-sp-name">${seen ? s.name : '???'}</span>${used ? '<em>다른 칸</em>' : ''}</button>`;
    }).join('');
    for (const b of $$('.cp-pick-grid .cp-sp:not([disabled])')) on(b, 'click', () => { startSpells[pickSlot] = b.dataset.k; startSpells = startSpells.filter(Boolean); closePick(); render(true); });
    $('.cp-pick-clear').hidden = !startSpells[slot];
    $('.cp-ov').hidden = false;
  }
  function closePick() { $('.cp-ov').hidden = true; pickSlot = -1; }
  on($('.cp-pick-x'), 'click', closePick);
  on($('.cp-pick-clear'), 'click', () => { startSpells.splice(pickSlot, 1); closePick(); render(true); });
  on($('.cp-ov'), 'click', e => { if (e.target === e.currentTarget) closePick(); });

  // ── 특성 개편 환불 안내(한 번): hero.talentNotice → 닫으면 campAct {type:'talentNoticeSeen'} ──
  const notice = $('.cp-notice');
  function closeNotice(go) {
    if (notice.hidden) return;
    notice.hidden = true;
    H.onCampAct?.({ type: 'talentNoticeSeen' });
    if (go) setPane('talent');
    else setTimeout(maybeGift, 300); // v0.1.2 환영 선물은 특성 안내 뒤에
  }
  on($('.cp-nt-go'), 'click', () => closeNotice(true));
  on($('.cp-nt-ok'), 'click', () => closeNotice(false));
  on(notice, 'click', e => { if (e.target === notice) closeNotice(false); });

  // ── 영구 강화 상점 ──
  $('.cp-meta-list').innerHTML = META_UPGRADES.map(m => `
    <div class="cp-mu" data-k="${m.key}" data-tone="${META_TONE[m.key] || 'b'}">
      <span class="cp-mu-ico">${art(META_ICON[m.key] || 'gem')}</span>
      <div class="cp-mu-body">
        <div class="cp-mu-name"><b>${m.name}</b><span class="cp-mu-lv k-num"></span></div>
        <div class="k-bar gold cp-mu-bar"><i></i></div>
        <p>${m.desc}</p>
        <div class="cp-mu-fx"></div>
      </div>
      <button class="k-btn s secondary cp-mu-buy">${icon('gem')}<b class="k-cost k-num"></b></button>
    </div>`).join('');
  for (const row of $$('.cp-meta-list .cp-mu')) {
    const b = row.querySelector('.cp-mu-buy');
    on(b, 'click', () => {
      const k = row.dataset.k;
      if (b.classList.contains('is-poor')) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); H.toast?.('보석이 부족해요', 'gem'); return; }
      if (!(row.classList.contains('brk') ? H.onCampAct?.({ type: 'gemBreak', key: k }) : H.onBuyMeta?.(k))) return; // 만렙 뒤 = 보석 돌파(shop.js)
      row.animate([{ scale: 1 }, { scale: 1.03, offset: 0.35 }, { scale: 1 }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      const sp = document.createElement('i'); sp.className = 'cp-mu-spark'; row.append(sp); setTimeout(() => sp.remove(), 600);
      render(true);
    });
  }

  // ── 마법사 수련 (골드, 영구) ──
  $('.cp-train-list').innerHTML = MAGE_TRAINING.map(t => `
    <div class="cp-mu cp-tr" data-k="${t.key}" data-tone="${TRAIN_TONE[t.key] || 'b'}">
      <span class="cp-mu-ico">${icon(t.key)}</span>
      <div class="cp-mu-body">
        <div class="cp-mu-name"><b>${t.name}</b><span class="cp-mu-lv k-num"></span></div>
        <div class="k-bar gold cp-mu-bar"><i></i></div>
        <p>${t.desc}</p>
        <div class="cp-mu-fx"></div>
      </div>
      <button class="k-btn s cp-mu-buy">${icon('coin')}<b class="k-cost k-num"></b></button>
    </div>`).join('');
  for (const row of $$('.cp-tr')) {
    const b = row.querySelector('.cp-mu-buy');
    on(b, 'click', () => {
      if (b.classList.contains('is-poor')) { b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake'); H.toast?.('골드가 부족해요 — 도전에서 모아 와요', 'coin'); return; }
      if (!H.onCampAct?.({ type: row.classList.contains('brk') ? 'trainBreak' : 'train', stat: row.dataset.k })) return; // 만렙 뒤 = 수련 돌파(shop.js)
      row.animate([{ scale: 1 }, { scale: 1.03, offset: 0.35 }, { scale: 1 }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      const sp = document.createElement('i'); sp.className = 'cp-mu-spark'; row.append(sp); setTimeout(() => sp.remove(), 600);
      for (const m of $$('.cp-tr-m')) m.animate([{ translate: '0 0' }, { translate: '0 -10px', offset: 0.4 }, { translate: '0 0' }], { duration: 360, easing: 'cubic-bezier(.34,1.56,.64,1)' });
      render(true);
    });
  }

  // ── 출정 ──
  function loadout() { validStart(); return { cls: cur(), startSpells: [...startSpells] }; }
  on($('.cp-start'), 'click', () => H.onStartRun?.(loadout()));
  on($('.cp-same'), 'click', () => H.onStartRun?.({ cls: meta.lastLoadout.cls, startSpells: [...meta.lastLoadout.startSpells] }));

  const signature = () => {
    const h = meta.hero;
    return [meta.gems, gold(meta), TRAIN_KEYS.map(k => trainLv(meta, k)).join(), JSON.stringify([meta.trainBreak, meta.gemBreak, meta.prep, meta.relicUnlocked, h.bag.length]), meta.best, meta.runs, h.cls, h.level, Math.floor(h.xp), SLOTS.map(s => h.equip[s]?.id).join(), JSON.stringify(h.talents), h.autoTalent,
      Object.values(meta.metaLv).join(), meta.seenSpells.join(), JSON.stringify(meta.lastLoadout), (meta.discovered || []).length, meta.profile?.name, meta.summon?.tickets, JSON.stringify(meta.summon?.equip)].join('|');
  };

  function render(force = false) {
    if (!meta || el.hidden) return;
    const s = signature();
    if (!force && s === sig) return;
    sig = s;
    validStart();
    const hero = meta.hero, cls = cur();
    if (!HERO_CLASSES[preview] || cls !== lastCls) preview = cls; // 영웅 화면('영웅 선택')에서 바꾼 클래스도 무대에 바로
    lastCls = cls;
    txt($('.cp-nick'), meta.profile?.name || '대마법사'); // 4차 닉네임(textContent만)
    txt($('.cp-best'), `최고 ${meta.best}층`);
    txt($('.cp-runs'), meta.runs ? `도전 ${meta.runs}회` : '첫 도전');
    txt($('.cp-gemn'), fmt(meta.gems));
    txt($('.cp-goldn'), fmt(gold(meta)));
    $('.cp-tab[data-go="train"] .cp-dot').hidden = !MAGE_TRAINING.some(t => gold(meta) >= (trainLv(meta, t.key) < trainMax(t.key) ? trainCost(t.key, trainLv(meta, t.key)) : trainBreakCost(t.key, meta.trainBreak?.[t.key])));
    // 탭 알림: 남은 특성 포인트 · 살 수 있는 강화
    const tLeft = talentLeft(hero, cls);
    $('.cp-tab[data-go="talent"] .cp-dot').hidden = !(tLeft > 0);
    $('.cp-tab[data-go="shop"] .cp-dot').hidden = !shop.dots(meta).any; // 보석 강화·보석 돌파·유물 해금(상자는 반복 소비라 점 없음)
    $('.cp-tab[data-go="codex"] .cp-dot').hidden = !H.codexNew?.();
    $('.cp-tab[data-go="summon"] .cp-dot').hidden = !summonDot(meta); // 소환권이 있으면
    el.style.setProperty('--cc', CLS_INFO[pane === 'sortie' ? preview : cls].col);
    if (pane === 'sortie') renderSortie(hero, cls, tLeft);
    if (pane === 'train') renderTrain();
    if (pane === 'talent') renderTalent();
    if (pane === 'shop') renderShop();
    shop.render(force); // 출정 준비 카드 · 상점 탭 상자/유물
    renderDock(hero, cls);
  }

  function renderSortie(hero, cls, tLeft) {
    const c = HERO_CLASSES[preview], info = CLS_INFO[preview], ok = unlocked(preview);
    const img = $('.cp-hero-img'), src = portrait(preview, 480, !ok);
    if (img.getAttribute('src') !== src) img.src = src;
    $('.cp-hero').classList.toggle('locked', !ok);
    $('.cp-lock').hidden = ok;
    if (!ok) txt($('.cp-lock span'), UNLOCK_TEXT[preview] || '잠김');
    $('.cp-cur').hidden = preview !== cls;
    const tp = $('.cp-tpts');
    tp.hidden = !(ok && preview === cls && tLeft > 0);
    tp.innerHTML = `${icon('crit')}특성 <b class="k-num">+${tLeft}</b>`;
    txt($('.cp-name'), c.name);
    txt($('.cp-role'), info.role);
    const tier = heroTier(hero.level), tierEl = $('.cp-tier');
    tierEl.dataset.r = TIER_R[tier];
    txt(tierEl, HERO_TIERS[tier].name);
    txt($('.cp-lv'), `Lv.${hero.level}`);
    txt($('.cp-pow b'), fmt(heroPower(hero)));
    $('.cp-subrow').title = heroTitle(preview, hero.level);
    // 썸네일(잠김 = 실루엣 + 조건)
    $('.cp-thumbs').innerHTML = HERO_CLASS_KEYS.map(k => {
      const u = unlocked(k);
      return `<button class="hu-thumb${u ? '' : ' locked'}${k === preview ? ' sel' : ''}${k === cls ? ' cur' : ''}" role="tab" aria-selected="${k === preview}" data-cls="${k}" style="--cc:${CLS_INFO[k].col}" aria-label="${HERO_CLASSES[k].name}${u ? '' : ' (잠김)'}">
        <img src="${portrait(k, 160, !u)}" alt="" draggable="false">${u ? '' : `<span class="hu-thumb-lock">${icon('lock')}</span>`}
        <span class="hu-thumb-name">${HERO_CLASSES[k].name}</span>${u ? '' : `<span class="hu-thumb-req">${({ cleric: 20, assassin: 40 })[k]}층</span>`}</button>`;
    }).join('');
    for (const b of $$('.cp-thumbs .hu-thumb')) on(b, 'click', () => choose(b.dataset.cls));
    // 장비 5칸(누르면 영웅 화면)
    $('.cp-gear-slots').innerHTML = SLOTS.map(sl => {
      const it = hero.equip[sl];
      return it ? `<button class="k-slot cp-gs" data-r="${it.rarity}" aria-label="${SLOT_NAMES[sl]} ${it.name}"><img src="${itemIconURL(sl, it.rarity, cls, 80)}" alt="" draggable="false"></button>`
        : `<button class="k-slot empty cp-gs" aria-label="${SLOT_NAMES[sl]} 비어 있음">${slotSil(sl)}<span>${SLOT_NAMES[sl]}</span></button>`; // 빈 칸 = 부위 실루엣(영웅 화면과 같은 그림)
    }).join('');
    for (const b of $$('.cp-gs')) on(b, 'click', () => H.onOpenHero?.({ tab: 'char' }));
    // 시작 스킬 칸
    const n = startSlots(meta), choices = startSpellChoices(meta);
    txt($('.cp-h-sub'), n ? `${startSpells.length}/${n}칸` : '잠김');
    $('.cp-ss-slots').innerHTML = [0, 1].map(i => {
      if (i >= n) return `<button class="cp-ss-slot locked" data-i="${i}" aria-label="시작 스킬 칸 잠김 — 보석 강화로 열기">${icon('lock')}<span>${i === n ? `${icon('gem')}${fmt(metaCost('startSlot', n))}<br>보석 강화에서 열기` : '보석 강화로<br>해금'}</span></button>`; // 다음 칸은 값까지(누르면 보석 탭)
      const k = startSpells[i], s = k && SPELL_BY_KEY[k];
      return s ? `<button class="cp-ss-slot full el-${s.element}" data-i="${i}"><span class="cp-ss-art">${emblemImg(k)}</span><span class="cp-ss-name">${s.name}<em>Lv1</em></span></button>`
        : `<button class="cp-ss-slot empty" data-i="${i}"><span class="cp-ss-plus"></span><span>스킬 고르기</span></button>`;
    }).join('');
    for (const b of $$('.cp-ss-slot')) on(b, 'click', () => (b.classList.contains('locked') ? setPane('shop') : openPick(+b.dataset.i)));
    txt($('.cp-ss-note'), !n ? "보석 강화 '시작 스킬 슬롯'을 사면 뽑아 본 스킬을 들고 1층부터 시작할 수 있어요."
      : !choices.length ? '아직 뽑아 본 스킬이 없어요. 도전 중 카드를 고르면 여기에 나타나요.' : `뽑아 본 스킬 ${choices.length}종 중에서 고를 수 있어요.`);
    // 다음 목표: 클래스 해금 → 없으면 100층
    const nextCls = HERO_CLASS_KEYS.find(k => !unlocked(k));
    const goal = nextCls ? { at: nextCls === 'cleric' ? 20 : 40, label: `${HERO_CLASSES[nextCls].name} 해금`, cls: nextCls } : { at: 100, label: '100층 돌파' };
    const disc = codexFound(meta.discovered);
    $('.cp-goal').innerHTML = `
      <div class="cp-goal-l">${goal.cls ? `<img class="cp-goal-por" src="${portrait(goal.cls, 120, true)}" alt="">` : icon('trophy')}</div>
      <div class="cp-goal-r"><span class="cp-goal-k">다음 목표</span><b>${goal.at}층 클리어 · ${goal.label}</b>
        <div class="k-bar xp cp-goal-bar" style="--p:${Math.min(1, meta.best / goal.at).toFixed(3)}"><i></i><span class="k-num">${meta.best}/${goal.at}</span></div></div>
      <div class="cp-goal-codex">${icon('codex')}<b class="k-num">${disc}/${CODEX_SYN.length}</b><span>도감</span></div>`;
  }

  function renderTalent() {
    tCls = cur();
    $('.cp-tcls').innerHTML = `<img src="${portrait(tCls, 120)}" alt=""><div><b>${HERO_CLASSES[tCls].name}의 특성</b><span>레벨은 모든 영웅이 함께 쓰고, 배분은 영웅마다 따로예요</span></div>`;
    tree.render(meta.hero, tCls, true);
  }

  function renderShop() {
    txt($('.cp-shop-gems'), fmt(meta.gems));
    let best = null, bestCost = Infinity;
    for (const m of META_UPGRADES) {
      const lv = meta.metaLv[m.key] | 0, c = metaCost(m.key, lv);
      if (lv < metaMax(m.key) && c <= meta.gems && c < bestCost) { bestCost = c; best = m.key; }
    }
    for (const row of $$('.cp-meta-list .cp-mu')) {
      const k = row.dataset.k, lv = meta.metaLv[k] | 0, max = metaMax(k), isMax = lv >= max;
      const brk = isMax && GEM_BREAK.some(x => x.key === k) && gemBreakOpen(meta, k), n = brk ? meta.gemBreak[k] | 0 : 0; // 보석 돌파(shop.js)
      const cost = brk ? gemBreakCost(k, n) : isMax ? 0 : metaCost(k, lv);
      txt(row.querySelector('.cp-mu-lv'), brk ? `MAX · 돌파 ${n}단` : `Lv.${lv}/${max}`);
      row.querySelector('.cp-mu-bar').style.setProperty('--p', (lv / max).toFixed(3));
      row.querySelector('.cp-mu-fx').innerHTML = brk
        ? `<span class="fx-chip brk">돌파 ${n ? gemBreakText(k, n) : '없음'}</span><i class="fx-arrow" aria-hidden="true"></i><span class="fx-chip next">${gemBreakText(k, n + 1)}</span>`
        : isMax ? `<span class="fx-chip max">${metaDisplay(k, lv)}</span><span class="k-badge max">MAX</span>`
          : `<span class="fx-chip now">${metaDisplay(k, lv)}</span><i class="fx-arrow" aria-hidden="true"></i><span class="fx-chip next">${metaDisplay(k, lv + 1)}</span>`;
      const b = row.querySelector('.cp-mu-buy');
      b.disabled = isMax && !brk;
      b.classList.toggle('is-poor', !b.disabled && meta.gems < cost);
      txt(b.querySelector('b'), b.disabled ? 'MAX' : fmt(cost));
      const nm = row.querySelector('.cp-mu-name b').textContent;
      b.setAttribute('aria-label', b.disabled ? `${nm} 최대 레벨` : brk ? `${nm} 보석 돌파 ${n + 1}단, 보석 ${fmt(cost)}개` : `${nm} 강화, 보석 ${cost}개`);
      row.classList.toggle('best', k === best);
      row.classList.toggle('maxed', isMax);
      row.classList.toggle('brk', brk);
    }
  }

  function renderTrain() {
    const g = gold(meta);
    txt($('.cp-tr-goldn'), fmt(g));
    let sum = 0, best = null, bestCost = Infinity;
    for (const t of MAGE_TRAINING) {
      const lv = trainLv(meta, t.key), c = trainCost(t.key, lv);
      sum += lv;
      if (lv < t.max && c <= g && c < bestCost) { bestCost = c; best = t.key; }
    }
    // 수련이 깊을수록 대마법사 외형이 화려해진다(티어 0~4)
    const tier = Math.min(4, Math.floor(sum * 5 / (TRAIN_TOTAL + 1)));
    const ml = $('.cp-tr-m'), sl = magePortraitURL(0, tier, 300);
    if (ml.getAttribute('src') !== sl) ml.src = sl;
    $('.cp-tr-bar').style.setProperty('--p', (sum / TRAIN_TOTAL).toFixed(3));
    txt($('.cp-tr-sum'), `${sum}/${TRAIN_TOTAL}`);
    for (const row of $$('.cp-tr')) {
      const k = row.dataset.k, lv = trainLv(meta, k), max = trainMax(k), isMax = lv >= max, n = meta.trainBreak?.[k] | 0; // 만렙 뒤 = 수련 돌파(shop.js, 끝없음)
      const cost = isMax ? trainBreakCost(k, n) : trainCost(k, lv);
      txt(row.querySelector('.cp-mu-lv'), isMax ? `MAX · 돌파 ${n}단` : `Lv.${lv}/${max}`);
      row.querySelector('.cp-mu-bar').style.setProperty('--p', (lv / max).toFixed(3));
      row.querySelector('.cp-mu-fx').innerHTML = isMax
        ? `<span class="fx-chip brk">돌파 ${n ? trainBreakText(k, n) : '없음'}</span><i class="fx-arrow" aria-hidden="true"></i><span class="fx-chip next">${trainBreakText(k, n + 1)}</span>`
        : `<span class="fx-chip now">${lv ? trainDisplay(k, lv) : '기본'}</span><i class="fx-arrow" aria-hidden="true"></i><span class="fx-chip next">${trainDisplay(k, lv + 1)}</span>`;
      const b = row.querySelector('.cp-mu-buy');
      b.classList.toggle('is-poor', g < cost);
      txt(b.querySelector('b'), fmt(cost));
      const nm = row.querySelector('.cp-mu-name b').textContent;
      b.setAttribute('aria-label', isMax ? `${nm} 돌파 ${n + 1}단, 골드 ${fmt(cost)}` : `${nm} 수련, 골드 ${fmt(cost)}`);
      row.classList.toggle('best', k === best);
      row.classList.toggle('maxed', isMax);
      row.classList.toggle('brk', isMax);
    }
  }

  function renderDock(hero, cls) {
    const img = $('.cp-lo-por img'), src = portrait(cls, 160);
    if (img.getAttribute('src') !== src) img.src = src;
    $('.cp-lo').style.setProperty('--cc', CLS_INFO[cls].col);
    txt($('.cp-lo-txt b'), HERO_CLASSES[cls].name);
    txt($('.cp-lo-txt span'), `Lv.${hero.level} · 특성 ${talentPoints(hero) - talentLeft(hero, cls)}/${talentPoints(hero)}`);
    $('.cp-lo-tal').innerHTML = (TALENTS[cls] || []).map((b, i) => {
      const sp = branchSpent(hero, cls, b.key), mx = Math.max(1, branchMax(cls, b.key));
      return `<i style="--b:${BRANCH_COL[i]};--p:${(sp / mx).toFixed(3)}" title="${b.name} ${sp}/${mx}"><i></i></i>`;
    }).join('');
    const n = startSlots(meta);
    $('.cp-lo-sp').innerHTML = n ? Array.from({ length: n }, (_, i) => startSpells[i] ? `<span class="cp-lo-s">${emblemImg(startSpells[i])}</span>` : '<span class="cp-lo-s empty"></span>').join('') : '';
    const lo = meta.lastLoadout, same = !!(lo && lo.cls && unlocked(lo.cls));
    $('.cp-same').hidden = !same;
    if (same) $('.cp-same-sub').innerHTML = `${HERO_CLASSES[lo.cls].name}${lo.startSpells.length ? ' + ' + lo.startSpells.map(k => SPELL_BY_KEY[k]?.name).join(', ') : ''}`;
  }

  function show(m) {
    meta = m;
    shop.setMeta(m);
    preview = cur();
    startSpells = [...(meta.lastLoadout?.startSpells || [])];
    el.hidden = false;
    sig = '';
    setPane('sortie');
    el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    notice.hidden = !meta.hero?.talentNotice;
    if (notice.hidden) setTimeout(() => { if (!el.hidden && notice.hidden) maybeGift(); }, 450); // v0.1.2 환영 선물 안내(한 번)
    if (!notice.hidden) {
      // 진행 중이던 도전 때문에 추천 빌드로 이미 다시 찍었으면(save.js) '돌려받았어요' 대신 그 사실 + 무료 초기화 안내
      const auto = talentPoints(meta.hero) > 0 && talentLeft(meta.hero, meta.hero.cls) === 0;
      txt($('.cp-nt-lead'), auto ? '특성이 개편되어 추천 빌드로 다시 찍어 두었어요' : '특성이 개편되어 포인트를 돌려받았어요');
      $('.cp-nt-go').lastChild.textContent = auto ? '특성 보기 · 무료 초기화' : '특성 찍으러 가기';
      setTimeout(() => $('.cp-nt-go').focus({ preventScroll: true }), 50);
    }
  }
  function hide() { el.hidden = true; notice.hidden = true; closePick(); tree.close(); shop.hide(); }
  function handleBack() {
    if (el.hidden) return false;
    if (!notice.hidden) { closeNotice(false); return true; }
    if (!$('.cp-ov').hidden) { closePick(); return true; }
    if (shop.handleBack()) return true;
    if (tree.handleBack()) return true;
    if (pane !== 'sortie') { setPane('sortie'); return true; }
    return false;
  }
  return { show, hide, isOpen: () => !el.hidden, refresh: m => { if (m) { meta = m; shop.setMeta(m); } render(); }, handleBack, el };
}

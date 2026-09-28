// 랜딩: 최신 릴리스 정보 · 기기별 설치 탭 · 복사 버튼 · 앱 안 브라우저 탈출 · 하단 고정 버튼 · 갤러리
// 실패해도 조용히(콘솔 출력 없음) 기본 문구를 둔다 — 페이지는 JS 없이도 전부 읽힌다.
(() => {
  const html = document.documentElement;
  const os = html.dataset.os || 'desktop';
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // ── 최신 릴리스: GitHub API(버전·날짜·용량) → 실패하면 같은 사이트의 play/version.json(버전만) ──
  const API = 'https://api.github.com/repos/Seobuk/defense-game/releases/latest';
  const CACHE = 'dg.release.v1', TTL = 30 * 60 * 1000; // 방문자 IP당 시간 60회 제한 → 30분 캐시
  const fmtDate = iso => { const d = new Date(iso); return isNaN(d) ? '' : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
  const fmtSize = b => (b > 0 ? `${(b / 1048576).toFixed(1)}MB` : '');
  const store = {
    get() { try { const v = JSON.parse(sessionStorage.getItem(CACHE)); return v && Date.now() - v.at < TTL ? v : null; } catch { return null; } },
    set(v) { try { sessionStorage.setItem(CACHE, JSON.stringify({ ...v, at: Date.now() })); } catch { /* 사생활 보호 모드 */ } },
  };
  function showRelease({ version, date, size }) {
    const set = (k, v) => { const el = document.querySelector(`[data-rel="${k}"]`); if (el && v) el.textContent = v; };
    set('version', version ? `최신 ${version}` : '');
    set('date', date);
    set('size', size ? `APK ${size}` : '');
    const line = document.querySelector('[data-rel-line]');
    if (line && version) line.textContent = [version, size, 'Android 7.0+'].filter(Boolean).join(' · ');
  }
  async function loadRelease() {
    const cached = store.get();
    if (cached) return showRelease(cached);
    try {
      const r = await fetch(API, { headers: { Accept: 'application/vnd.github+json' } });
      if (r.ok) {
        const d = await r.json();
        const apk = (d.assets || []).find(a => a.name === 'defense-game.apk') || (d.assets || []).find(a => /\.apk$/i.test(a.name));
        const v = { version: d.tag_name || d.name || '', date: fmtDate(d.published_at), size: fmtSize(apk && apk.size) };
        if (v.version) { store.set(v); return showRelease(v); }
      }
    } catch { /* 오프라인·차단 → 아래로 */ }
    try {
      const r = await fetch('./play/version.json', { cache: 'no-cache' });
      if (r.ok) { const d = await r.json(); if (d.version) showRelease({ version: `v${String(d.version).replace(/^v/, '')}` }); }
    } catch { /* 기본 문구 유지 */ }
  }
  loadRelease();

  // ── 기기별 설치 탭 (WAI-ARIA tabs) ──
  const tabs = $$('[role="tab"]');
  function selectTab(key, focus) {
    for (const t of tabs) {
      const on = t.dataset.tab === key;
      t.setAttribute('aria-selected', on);
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    }
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t.dataset.tab));
    t.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); selectTab(tabs[e.key === 'Home' ? 0 : tabs.length - 1].dataset.tab, true); }
      else if (d) { e.preventDefault(); selectTab(tabs[(i + d + tabs.length) % tabs.length].dataset.tab, true); }
    });
  });
  selectTab(os);
  $$('[data-go-tab]').forEach(a => a.addEventListener('click', () => selectTab(a.dataset.goTab)));
  const detected = document.querySelector('[data-detected]');
  if (detected) detected.textContent = { ios: '지금 iPhone·iPad로 보고 계시네요. 아래 3단계면 끝나요.', android: '지금 Android 기기로 보고 계시네요. APK 설치를 추천해요.', desktop: 'PC로 보고 계시네요. 휴대폰으로 QR 코드를 찍어 보세요.' }[os];

  // ── 복사 버튼 ──
  const pageUrl = 'https://seobuk.github.io/defense-game/';
  async function copy(text, btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    const label = btn.textContent;
    btn.textContent = ok ? '복사했어요!' : '길게 눌러 복사해 주세요';
    btn.classList.toggle('done', ok);
    setTimeout(() => { btn.textContent = label; btn.classList.remove('done'); }, 1800);
  }
  $$('[data-copy]').forEach(b => b.addEventListener('click', () => copy(document.querySelector(b.dataset.copy).textContent.trim(), b)));
  $$('[data-copy-link]').forEach(b => b.addEventListener('click', () => copy(pageUrl, b)));

  // ── 앱 안 브라우저(카카오톡·인스타그램 등) ──
  const inapp = html.dataset.inapp;
  if (inapp) {
    const warn = document.querySelector('[data-inapp-warn]');
    if (warn) warn.hidden = false;
    const open = document.querySelector('[data-open-external]');
    const here = location.href.split('#')[0];
    let ext = '';
    if (inapp === 'kakao') ext = `kakaotalk://web/openExternal?url=${encodeURIComponent(here)}`; // 카카오톡 공식 스킴: 기본 브라우저로 열기
    else if (os === 'android') ext = `intent://${here.replace(/^https?:\/\//, '')}#Intent;scheme=https;package=com.android.chrome;end`;
    if (open && ext) { open.href = ext; open.hidden = false; }
  }

  // ── 모바일 하단 고정 버튼: 히어로 버튼이 화면에서 사라지면 ──
  const sticky = document.querySelector('[data-sticky]');
  const anchor = document.querySelector('.cta-group');
  if (sticky && anchor && 'IntersectionObserver' in window) {
    const footer = document.querySelector('footer');
    let pastHero = false, atFooter = false;
    const sync = () => {
      const on = pastHero && !atFooter;
      sticky.classList.toggle('on', on);
      sticky.setAttribute('aria-hidden', String(!on));
      for (const a of sticky.querySelectorAll('a')) a.tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; sync(); }).observe(anchor);
    if (footer) new IntersectionObserver(([e]) => { atFooter = e.isIntersecting; sync(); }).observe(footer);
  }

  // ── 갤러리 이전/다음 (마우스 환경) ──
  const gallery = document.querySelector('.gallery');
  if (gallery) {
    const step = () => (gallery.querySelector('li')?.getBoundingClientRect().width || 240) + 18;
    const navs = $$('.g-nav');
    const syncNav = () => {
      const max = gallery.scrollWidth - gallery.clientWidth - 2;
      navs.forEach(b => { b.disabled = b.dataset.g < 0 ? gallery.scrollLeft <= 2 : gallery.scrollLeft >= max; });
    };
    navs.forEach(b => b.addEventListener('click', () => gallery.scrollBy({ left: step() * b.dataset.g * 2, behavior: 'smooth' })));
    gallery.addEventListener('scroll', syncNav, { passive: true });
    syncNav();
  }

  // ── 움직임 줄이기: 영상 자동 재생 멈춤(포스터만) ──
  const video = document.querySelector('.hero-phone video');
  if (video && matchMedia('(prefers-reduced-motion: reduce)').matches) { video.removeAttribute('autoplay'); video.pause(); video.controls = true; }
})();

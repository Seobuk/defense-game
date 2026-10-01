// 캔버스 렌더러 — 오케스트레이션만: 크기·좌표 변환, 이벤트 분배, 갱신 순서, 그리기 층 순서.
// 그림·연출은 art/ 모듈에 있다 (docs/ART.md §14 모듈 계약):
//   art/core.js  공용 굽기 캐시·팔레트·프레임 상태·카메라   art/units.js  적·보스·영웅·마법사·소환수
//   art/world.js 배경·성벽·동전·장비 빛기둥                art/fx.js     파티클·마법 이펙트·투사체·데미지 숫자·화면 틴트
//   art/hud.js   보스바·콤보·도장·배너·컷인·LEVEL UP (캔버스 HUD)
// 시뮬 상태(view)와 이벤트만 읽는다.
import { WORLD_W, WORLD_H } from './config.js';
import { clamp } from './util.js';
import * as C from './art/core.js';
import * as units from './art/units.js';
import * as world from './art/world.js';
import * as fx from './art/fx.js';
import * as hud from './art/hud.js';
import * as mutfx from './art/mutfx.js'; // 4차 변이 연출(44 변이)
import * as dungeon from './art/dungeonfx.js'; // 4차 던전(지역) 특성 연출
import * as cosmetics from './art/cosmetics.js'; // v0.1.2 외형 스킨 입자(내 스킬·탄)

// UI 정렬용 월드 좌표 (ui.js 가 DOM 위치를 맞춘다): 장비 드롭이 날아가 꽂히는 가방 버튼 / 마나 게이지 반짝임 위치
export const BAG_POS = C.BAG_POS;
export const MANA_POS = C.MANA_POS;
export const fontsReady = C.waitFonts; // main.js 부팅에서 첫 렌더 전에 기다린다

// ── 가산 빛 예산 (DESIGN E 백색 과부하) ──
// 모든 모듈이 'lighter'로 그리는 빛(drawImage·fillRect)의 화면 덮는 양(면적 × 알파)을 한 프레임 동안 센다.
// 수요가 예산을 넘으면 다음 프레임의 가산 그리기 전체(선·채움 포함)를 C.lightK 배로 눌러 전장이 하얗게 날아가지 않게 한다.
// 수요는 누르기 전 값으로 세므로 되먹임 진동이 없다. 변환 배율은 setTransform/scale/transform/save/restore 를 따라가며 추적.
// ponytail: 빛 텍스처 평균 밝기를 한 상수(LIGHT_FILL)로 본다 — 모양별로 다르게 셀 필요가 생기면 텍스처에 c.fill 을 달 것
const LIGHT_BUDGET = 0.16, LIGHT_FILL = 0.3, LIGHT_MIN = 0.35; // 예산: 스킬 하나 ≈ 0.1, 조용한 전장 ≈ 0.07 → 여러 스킬이 겹칠 때만 누른다
const EXEMPT_BUDGET = 0.05; // 망령 계열 발광(C.LIGHT_EXEMPT)은 따로 센다: 번개가 많아도 안 눌리지만, 자기들끼리 이 몫을 넘으면 저희만 눌린다
function lightMeter(ctx) {
  let det = 1, demand = 0, area = 1, k = 1, peak = 0, add = false;
  const st = [];
  const P = Object.getPrototypeOf(ctx);
  const own = (name, fn) => { ctx[name] = fn; };
  const setT = P.setTransform, scl = P.scale, trf = P.transform, sav = P.save, rst = P.restore, rT = P.resetTransform;
  // 감싼 함수는 arguments 를 넘기지 않고 인자를 그대로 넘긴다(프레임당 수백 번 — arguments 객체 할당 = GC, 발열 2차)
  own('setTransform', function (a, b, c, d, e, f) { if (typeof a === 'number') { det = Math.abs(a * d - b * c); return setT.call(this, a, b, c, d, e, f); } det = 1; return setT.apply(this, arguments); });
  own('resetTransform', function () { det = 1; return rT.call(this); });
  own('scale', function (x, y) { det *= Math.abs(x * y); return scl.call(this, x, y); });
  own('transform', function (a, b, c, d, e, f) { det *= Math.abs(a * d - b * c); return trf.call(this, a, b, c, d, e, f); });
  Object.defineProperty(ctx, 'det', { get: () => det }); // core.txt: 지금 변환 배율(getTransform 의 DOMMatrix 할당 없이)
  own('save', function () { st.push(det, add); return sav.call(this); });
  own('restore', function () { if (st.length) { add = st.pop(); det = st.pop(); } return rst.call(this); });
  // 합성 모드는 JS 쪽에 들고 있는다(네이티브 getter 를 그리기마다 읽지 않게)
  const gco = Object.getOwnPropertyDescriptor(P, 'globalCompositeOperation');
  Object.defineProperty(ctx, 'globalCompositeOperation', { get() { return gco.get.call(this); }, set(v) { add = v === 'lighter'; gco.set.call(this, v); } });
  let pk = 1, ek = 1, exDemand = 0, exPeak = 0; // 우선 빛 배율(C.lightPrio): √k · C.LIGHT_EXEMPT(망령 계열 발광)는 자기 예산의 ek
  const kk = () => (C.lightPrio === C.LIGHT_EXEMPT ? ek : C.lightPrio ? pk : k);
  const lit = (x, w, h) => {
    if (!add) return false;
    const a = x.globalAlpha, q = Math.abs(w * h) * det * a;
    if (C.lightPrio === C.LIGHT_EXEMPT) exDemand += q; else demand += q;
    x.globalAlpha = a * kk();
    return a;
  };
  const dI = P.drawImage, fR = P.fillRect, fl = P.fill, sk = P.stroke;
  const dIn = (x, n, img, a1, a2, a3, a4, a5, a6, a7, a8) => (n === 5 ? dI.call(x, img, a1, a2, a3, a4) : n === 9 ? dI.call(x, img, a1, a2, a3, a4, a5, a6, a7, a8) : dI.call(x, img, a1, a2));
  own('drawImage', function (img, a1, a2, a3, a4, a5, a6, a7, a8) {
    const n = arguments.length;
    if (!add) return dIn(this, n, img, a1, a2, a3, a4, a5, a6, a7, a8); // 일반 합성은 곧장(대부분의 그리기)
    const a = n === 9 ? lit(this, a7, a8) : n === 5 ? lit(this, a3, a4) : lit(this, img.width || 0, img.height || 0);
    dIn(this, n, img, a1, a2, a3, a4, a5, a6, a7, a8);
    if (a !== false) this.globalAlpha = a;
  });
  own('fillRect', function (x, y, w, h) { const a = lit(this, w, h); fR.call(this, x, y, w, h); if (a !== false) this.globalAlpha = a; });
  const dimOnly = f => function (p, r) { // 선·경로 채움: 면적은 안 세고 배율만(번개·고리 선은 가늘다). 인자 = (Path2D?, fillRule?)
    const n = arguments.length;
    let a = -1;
    if (add && kk() < 1) { a = this.globalAlpha; this.globalAlpha = a * kk(); }
    if (n === 0) f.call(this); else if (n === 1) f.call(this, p); else f.call(this, p, r);
    if (a >= 0) this.globalAlpha = a;
  };
  own('fill', dimOnly(fl));
  own('stroke', dimOnly(sk));
  return {
    next(screenArea) { // 프레임 시작: 지난 프레임 수요로 이번 배율(빨리 누르고 천천히 푼다)
      const d = demand * LIGHT_FILL / Math.max(1, area), want = d > LIGHT_BUDGET ? Math.max(LIGHT_MIN, LIGHT_BUDGET / d) : 1;
      k = want < k ? want : k + (want - k) * 0.08;
      pk = Math.sqrt(k);
      const de = exDemand * LIGHT_FILL / Math.max(1, area), we = de > EXEMPT_BUDGET ? Math.max(0.5, EXEMPT_BUDGET / de) : 1; // 망령 계열은 약하게만(≥ 0.5)
      ek = we < ek ? we : ek + (we - ek) * 0.08;
      peak = d; exPeak = de; demand = exDemand = 0; area = screenArea;
      C.setLightK(k);
    },
    add(q) { demand += q; }, // 구워 둔 가산 빛(배경 빛 웅덩이)도 예산에 센다 — 굽기 전과 같은 눌림
    get k() { return k; }, get demand() { return peak; }, get ek() { return ek; }, get exDemand() { return exPeak; },
  };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false }); // 매 프레임 불투명 바탕을 칠한다 — 페이지와 섞는 합성 비용 없음
  C.setCanvas(ctx);
  const meter = lightMeter(ctx);
  let W = 1, H = 1, scale = 1, ox = 0, oy = 0, lastCW = -1, lastCH = -1, lastDpr = 0;
  let dprCap = 2, sized = false, sizeAt = 0; // 해상도 상한(설정 '그래픽' — gfx.js) · 크기 바뀜 표시(ResizeObserver)
  let T = 0, RT = 0, frameNo = 0;

  // ── 크기 ──
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    W = w; H = h;
    scale = Math.min(W / WORLD_W, H / WORLD_H);
    ox = (W - WORLD_W * scale) / 2;
    oy = H - WORLD_H * scale; // 월드는 아래(성벽·하단 패널 쪽)에 붙인다. 위 여분 = topExtra (배경이 채움)
    // 넓은 화면(폴더블 안쪽 화면·데스크톱): 월드 720 폭은 그대로, 양옆 여분(sideX)은 world.js가 테마 배경·성벽을 이어 그린다
    lastCW = canvas.clientWidth; lastCH = canvas.clientHeight; lastDpr = dpr;
    C.setView(W, H, scale, ox, oy, oy / scale, ox / scale);
    C.setScale(scale);
    fx.resetGlows();
  }
  // 크기 읽기(레이아웃 강제)는 바뀐 때만: 관찰자가 표시 → 다음 프레임에 resize. 관찰자를 놓친 변경(가려진 웹뷰)은 1초마다 한 번 확인
  if (typeof ResizeObserver === 'function') new ResizeObserver(() => { sized = true; }).observe(canvas);
  function checkSize() {
    const dpr = Math.min(dprCap, window.devicePixelRatio || 1), now = performance.now();
    if (sized || dpr !== lastDpr || now > sizeAt) {
      sized = false; sizeAt = now + 1000;
      if (canvas.clientWidth !== lastCW || canvas.clientHeight !== lastCH || dpr !== lastDpr) resize();
    }
  }
  // 그래픽 단계(gfx.js): 해상도 상한은 다음 프레임 checkSize 가 dpr 차이를 보고 다시 잡는다 · 연출 예산은 art 모듈이 C.fxQ 로 읽는다
  function setQuality(q) { dprCap = q.dpr > 0 ? q.dpr : 2; C.setFxQ(q.fx); }

  // ── 한 프레임: 이벤트 → 갱신 → 그리기 ──
  function frame(view, events, dtReal, opts = {}) {
    if (!view) return { coins: 0 };
    checkSize();
    const dt = Math.min(0.1, Math.max(0, +dtReal || 0));
    const da = opts.hitstop ? 0 : dt * hud.slowmoScale(); // 합동 필살 슬로 모션: 연출 시계도 같이 느려진다
    T += da;
    RT += dt;
    C.setClock(T, RT, dt, ++frameNo);
    meter.next(W * H);
    const evs = Array.isArray(events) ? events : [];
    hud.setComboAnchor(opts.comboAt); // 4차: 콤보 단계 팝이 빨려 드는 상단 콤보 알약 자리(HUD 좌표)
    // 이벤트: 각 모듈이 자기 몫을 처리 (fx 가 먼저 — 피해 숫자 예산·운석/파이어볼 사전 처리)
    fx.events(view, evs, opts);
    mutfx.events(view, evs); // 변이: mutFx · spell{mut} · 변이 선택
    units.events(view, evs, opts);
    world.events(view, evs, opts);
    hud.events(view, evs, opts);
    dungeon.events(view, evs, opts); // 던전: 부활·들불·'약점!'
    cosmetics.events(view, evs); // v0.1.2 외형 스킨: 꽃잎·별·결정 입자
    // 갱신
    fx.update(view, da, dt);
    mutfx.update(view, da);
    units.update(view, da, dt);
    world.update(view, da, dt);
    hud.update(view, da, dt);
    C.decayCamera(dt);
    fx.dmgScan(view, fx.dmgMode());

    // 변환: 흔들림 + 히트스톱 줌
    let sx = 0, sy = 0;
    if (opts.shake !== false && C.trauma > 0) {
      const a = C.trauma * C.trauma * 20;
      sx = a * (Math.sin(RT * 57.3) * 0.6 + Math.sin(RT * 91.7 + 1.3) * 0.4);
      sy = a * (Math.sin(RT * 63.1 + 2.1) * 0.6 + Math.sin(RT * 83.9) * 0.4);
    }
    const z = 1 + C.zoom * 0.03;
    const K = scale * z;
    C.setWorldTransform(K, ox + scale * sx + (scale - K) * WORLD_W / 2, oy + scale * sy + (scale - K) * WORLD_H / 2);

    // 바탕 칠 없음: 맨 아래 구운 배경(world.drawBackground)이 흔들림·줌까지 화면 전체를 덮는다(불투명 캔버스 — alpha:false)
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.textBaseline = 'middle';

    // 그리기 층 (아래 → 위). ART.md §9.1
    const theme = clamp(view.theme | 0, 0, 4);
    C.wt();
    meter.add(world.drawBackground(theme) * C.K * C.K);
    fx.drawDecals();
    fx.drawFrostWard(view);
    mutfx.drawGround(view); // 변이 장판(불바다·영구 동토·소용돌이·지뢰·저주 장막…)
    world.drawAmbient(theme, da);
    units.drawWarn(view);
    units.drawGroundFx(view);
    fx.drawUltGround();
    units.drawGolem(view);
    units.drawEnemies(view);
    fx.drawEshots(view);
    dungeon.draw(view); // 던전: 동굴 어둠(적 위 · 마법 아래 — 마법이 어둠을 밝힌다)
    fx.drawTornadoes(view);
    units.drawGhosts(view);
    fx.drawLances(view);
    fx.drawBullets(view);
    fx.drawBeams();
    fx.drawTelegraph(view);
    world.drawWall(view);
    fx.drawLBeams();
    units.drawAfter();
    units.drawSummons(view);
    units.drawHero(view);
    units.drawMages(view, opts);
    units.drawDragon(view);
    mutfx.draw(view); // 변이 물체(태양 구체·뇌운·빙하 창·낫·기사·일식…)
    fx.drawParticles();
    cosmetics.draw(); // v0.1.2 외형 스킨 입자·전설 문장
    fx.drawSprs();
    fx.drawBolts();
    fx.drawMeteors();
    fx.drawFireballs();
    fx.drawHeroShots();
    fx.drawSouls();
    units.drawEnemyReveal(); // 빛이 넘치는 프레임엔 적 실루엣도 이펙트 위로(E 백색 과부하)
    units.drawHeroReveal(view); // 이펙트 위로 영웅 윤곽을 한 번 더(마법이 터져도 영웅이 묻히지 않게)
    fx.drawCollab(view);
    world.drawLoots();
    world.drawCoins();
    fx.drawNums();
    hud.drawLevelUps();
    fx.drawOverlays(view);
    hud.drawHud(view);
    fx.drawFlash();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return { coins: world.takeCoinsArrived(), live: hud.live() };
  }

  // 화면(clientX/Y) → 월드 좌표 (탭 이동용). 흔들림·줌은 무시(수 px 차이)
  function toWorld(cx, cy) {
    const r = canvas.getBoundingClientRect(), k = r.width > 0 ? W / r.width : 1;
    return { x: ((cx - r.left) * k - ox) / scale, y: ((cy - r.top) * k - oy) / scale };
  }
  // 월드 좌표 → 화면(clientX/Y). UI가 영웅 머리 위·스킬 착탄 지점에 DOM을 맞출 때
  function toScreen(x, y) {
    const r = canvas.getBoundingClientRect(), k = W > 0 ? r.width / W : 1;
    return { x: r.left + (ox + x * scale) * k, y: r.top + (oy + y * scale) * k };
  }
  // 캔버스 안 배치(CSS px, 캔버스 왼쪽 위 기준): 월드 720 폭 열의 위치와 양옆·위 여분.
  // UI 규칙: sideCss(한쪽 여백)가 충분히 넓으면(예: ≥ 96px) 스킬 스택·영웅 상태를 여백으로, 아니면 전장 위에 겹쳐 둔다.
  function layout() {
    checkSize();
    const r = canvas.getBoundingClientRect(), k = W > 0 ? r.width / W : 1, u = scale * k;
    return {
      unit: u,                                   // 월드 1 = CSS px
      worldLeft: ox * k, worldRight: (ox + WORLD_W * scale) * k, worldTop: oy * k, worldBottom: (oy + WORLD_H * scale) * k,
      sideCss: ox * k, topCss: oy * k,           // 한쪽 옆 여백 · 위 여백 (CSS px)
      sideX: C.sideX, topExtra: C.topExtra,      // 같은 여백(월드 단위)
      width: r.width, height: r.height,
    };
  }

  resize();
  window.__wdLight = meter; // 디버그: 가산 빛 수요·배율 확인
  // topExtra: 월드 y=0 위로 보이는 여분(월드 단위). DOM HUD는 화면 맨 위라 HUD 띠 = 월드 y < 90 - topExtra
  // sideX: 넓은 화면에서 월드 x=0 왼쪽/x=720 오른쪽으로 보이는 여분(월드 단위)
  return { resize, frame, setQuality, toWorld, toScreen, layout, get topExtra() { return C.topExtra; }, get sideX() { return C.sideX; } };
}

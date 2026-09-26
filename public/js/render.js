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

// UI 정렬용 월드 좌표 (ui.js 가 DOM 위치를 맞춘다): 장비 드롭이 날아가 꽂히는 가방 버튼 / 마나 게이지 반짝임 위치
export const BAG_POS = C.BAG_POS;
export const MANA_POS = C.MANA_POS;
export const fontsReady = C.waitFonts; // main.js 부팅에서 첫 렌더 전에 기다린다

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  C.setCanvas(ctx);
  let W = 1, H = 1, scale = 1, ox = 0, oy = 0, lastCW = -1, lastCH = -1, lastDpr = 0;
  let T = 0, RT = 0, frameNo = 0;

  // ── 크기 ──
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    W = w; H = h;
    scale = Math.min(W / WORLD_W, H / WORLD_H);
    ox = (W - WORLD_W * scale) / 2;
    oy = H - WORLD_H * scale; // 월드는 아래(성벽·하단 패널 쪽)에 붙인다. 위 여분 = topExtra (배경이 채움)
    lastCW = canvas.clientWidth; lastCH = canvas.clientHeight; lastDpr = dpr;
    C.setView(W, H, scale, ox, oy, oy / scale);
    C.setScale(scale);
    fx.resetGlows();
  }
  function checkSize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.clientWidth !== lastCW || canvas.clientHeight !== lastCH || dpr !== lastDpr) resize();
  }

  // ── 한 프레임: 이벤트 → 갱신 → 그리기 ──
  function frame(view, events, dtReal, opts = {}) {
    if (!view) return { coins: 0 };
    checkSize();
    const dt = Math.min(0.1, Math.max(0, +dtReal || 0));
    const da = opts.hitstop ? 0 : dt;
    T += da;
    RT += dt;
    C.setClock(T, RT, dt, ++frameNo);
    const evs = Array.isArray(events) ? events : [];
    // 이벤트: 각 모듈이 자기 몫을 처리 (fx 가 먼저 — 피해 숫자 예산·운석/파이어볼 사전 처리)
    fx.events(view, evs, opts);
    units.events(view, evs, opts);
    world.events(view, evs, opts);
    hud.events(view, evs, opts);
    // 갱신
    fx.update(view, da, dt);
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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#07040c';
    ctx.fillRect(0, 0, W, H);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.textBaseline = 'middle';

    // 그리기 층 (아래 → 위). ART.md §9.1
    const theme = clamp(view.theme | 0, 0, 4);
    C.wt();
    world.drawBackground(theme);
    fx.drawDecals();
    fx.drawFrostWard(view);
    world.drawAmbient(theme, da);
    units.drawWarn(view);
    units.drawGroundFx(view);
    fx.drawUltGround();
    units.drawGolem(view);
    units.drawEnemies(view);
    fx.drawEshots(view);
    fx.drawTornadoes(view);
    units.drawGhosts(view);
    fx.drawLances(view);
    fx.drawBullets(view);
    fx.drawBeams();
    fx.drawTelegraph(view);
    world.drawWall(view);
    fx.drawLBeams();
    units.drawAfter();
    units.drawHero(view);
    units.drawMages(view, opts);
    units.drawDragon(view);
    fx.drawParticles();
    fx.drawSprs();
    fx.drawBolts();
    fx.drawMeteors();
    fx.drawFireballs();
    fx.drawHeroShots();
    fx.drawSouls();
    world.drawLoots();
    world.drawCoins();
    fx.drawNums();
    hud.drawLevelUps();
    fx.drawOverlays(view);
    hud.drawHud(view);
    fx.drawFlash();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    return { coins: world.takeCoinsArrived() };
  }

  // 화면(clientX/Y) → 월드 좌표 (탭 이동용). 흔들림·줌은 무시(수 px 차이)
  function toWorld(cx, cy) {
    const r = canvas.getBoundingClientRect(), k = r.width > 0 ? W / r.width : 1;
    return { x: ((cx - r.left) * k - ox) / scale, y: ((cy - r.top) * k - oy) / scale };
  }

  resize();
  // topExtra: 월드 y=0 위로 보이는 여분(월드 단위). DOM HUD는 화면 맨 위라 HUD 띠 = 월드 y < 90 - topExtra
  return { resize, frame, toWorld, get topExtra() { return C.topExtra; } };
}

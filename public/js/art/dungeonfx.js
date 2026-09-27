// 4차 던전(지역) 특성 캔버스 연출: 동굴 어둠 띠 · 묘지 망자 부활 · 초원 들불 번짐 · 약점/내성 피해 숫자 색 · '약점!' 꼬리표.
// render.js 가 events()·draw()를 부르고, fx.js 'hit' 숫자가 numStyle()로 색을 바꾼다. 가산 빛은 작게(ART §9.2 광량 예산)
import { WORLD_W, FRONT_Y, REACH } from '../config.js';
import { ctx, RT, topExtra, sideX } from './core.js';
import { burst, ring, part, num, K_GLOW, K_SPARK, K_SMOKE, K_STAR } from './fx.js';

// 피해 숫자 [채움, 테두리, 윗단] — 약점 = 라임(카드·칸 ▲ 배지와 같은 색) · 내성 = 흐린 회색. 보통이면 null(원소색 그대로)
const WEAK = ['#b8ff3a', '#123d0a', '#f4ffd0'], RESIST = ['#a4aabd', '#2a2e3c', '#d9dde8'];
export const numStyle = em => (em > 1.001 ? WEAK : em > 0 && em < 0.999 ? RESIST : null);

let tagRT = -9, riseRT = -9;
export function events(view, evs, opts = {}) {
  let rises = 0, fires = 0;
  const tags = (opts.dmgNumbers || 'full') === 'full'; // 숫자 끔·간단이면 꼬리표도 없음
  for (const ev of evs) {
    switch (ev.type) {
      case 'hit': // 약점 명중: 0.6초에 한 번 '약점!' 꼬리표(숫자 소음 §6 — 매번 띄우지 않는다)
        if (tags && ev.o === 3 && ev.em > 1.001 && RT - tagRT > 0.6) { tagRT = RT; num(ev.x, ev.y - 46, '약점!', WEAK[0], WEAK[1], 0.8, false, 0.55); }
        break;
      case 'rise': { // 망자 부활: 무덤 흙먼지 + 청록 영혼 불꽃이 솟고 고리
        if (rises++ >= 4) break;
        const r = ev.r || 16;
        burst(K_SMOKE, ev.x, ev.y + r * 0.6, 4, 20, 70, 0.6, 24, 'rgba(120,140,120,0.5)', -20, 2);
        burst(K_SPARK, ev.x, ev.y, 6, 60, 180, 0.5, 4, ['#9ff0d8', '#e8fff8'], -260, 3);
        part(K_GLOW, ev.x, ev.y, 0, -40, 0.35, r * 3.2, '#5fe0b8');
        ring(ev.x, ev.y, r * 0.6, r * 2.6, 0.35, '#7ff0c8', 4);
        if (tags && RT - riseRT > 0.5) { riseRT = RT; num(ev.x, ev.y - 40, '부활!', '#9ff0d8', '#0b3a30', 0.75, false, 0.55); }
        break;
      }
      case 'wildfire': // 들불: 쓰러진 자리에서 불씨가 이웃에게 튄다
        if (fires++ >= 4) break;
        part(K_GLOW, ev.x, ev.y, 0, 0, 0.25, 70, '#ff8a2a');
        for (const [x, y] of ev.pts || []) {
          const dx = x - ev.x, dy = y - ev.y;
          for (let k = 0; k < 3; k++) part(K_SPARK, ev.x, ev.y, dx * (2.2 + k * 0.5), dy * (2.2 + k * 0.5), 0.3, 4, k ? '#ffd23a' : '#ff6a1f', 0, 2);
          burst(K_STAR, x, y, 2, 30, 90, 0.35, 8, ['#ffd23a', '#ff6a1f'], -80, 2);
        }
        break;
    }
  }
}

// 동굴 '칠흑의 어둠': 사거리 윗선(REACH.y)까지 위쪽을 어둡게 + 경계에 희미한 횃불 띠. 마법 이펙트는 이 위에 그려져 어둠을 밝힌다
// ponytail: 그라디언트는 (ctx · 윗선) 이 바뀔 때만 새로 — 동굴 층 매 프레임 할당 없음
let cG = null, cE = null, cCtx = null, cY0 = NaN, cY1 = NaN;
export function draw(view) {
  const y1 = REACH.y;
  if (!(y1 > FRONT_Y + 1) || !view) return;
  const x0 = -sideX, w = WORLD_W + sideX * 2, y0 = -topExtra;
  ctx.globalCompositeOperation = 'source-over';
  if (cCtx !== ctx || cY0 !== y0 || cY1 !== y1) {
    cCtx = ctx; cY0 = y0; cY1 = y1;
    cG = ctx.createLinearGradient(0, y0, 0, y1 + 24);
    cG.addColorStop(0, 'rgba(6,4,18,0.62)');
    cG.addColorStop(Math.max(0, (FRONT_Y - y0) / (y1 + 24 - y0)), 'rgba(6,4,18,0.52)');
    cG.addColorStop(Math.max(0, (y1 - 18 - y0) / (y1 + 24 - y0)), 'rgba(6,4,18,0.4)');
    cG.addColorStop(1, 'rgba(6,4,18,0)');
    cE = ctx.createLinearGradient(0, y1 - 10, 0, y1 + 10);
    cE.addColorStop(0, 'rgba(255,170,80,0)');
    cE.addColorStop(0.5, 'rgba(255,170,80,1)');
    cE.addColorStop(1, 'rgba(255,170,80,0)');
  }
  ctx.fillStyle = cG;
  ctx.fillRect(x0, y0, w, y1 + 24 - y0);
  // 경계선: 흔들리는 횃불 빛(얇게) — 흔들림은 globalAlpha로
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * (0.22 + 0.06 * Math.sin(RT * 5.3) + 0.04 * Math.sin(RT * 11.7));
  ctx.fillStyle = cE;
  ctx.fillRect(x0, y1 - 10, w, 20);
  ctx.globalAlpha = ga;
}

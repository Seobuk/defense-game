// 밸런스 러너 병렬 실행(node:worker_threads — 의존성 없음). sim.test.js가 캠페인 시드·클래스마다 하나씩 띄운다
import { parentPort, workerData as w } from 'node:worker_threads';
import { campaign, playRun } from './harness.js';
import { botLoadout } from '../public/js/bot.js';

if (w.job === 'campaign') {
  // 새 저장 → 100층까지. snaps[b] = 최고 기록이 처음 b 이상이 된 메타(동등성 측정용)
  const snaps = {}, t0 = Date.now();
  const { rows } = campaign({
    seed: w.seed, maxRuns: 60, shop: w.shop !== false, // 4차: 상점(출정 준비·돌파·유물 해금·상자)까지 쓰는 캠페인이 기준
    onRun: (r, m) => { for (const b of w.parityAt) if (m.best >= b && !snaps[b]) snaps[b] = JSON.stringify(m); },
  });
  parentPort.postMessage({ rows, snaps, ms: Date.now() - t0 });
} else {
  // 같은 메타에서 한 클래스로 n번 도전(collab = 같은 시드를 협공 효과 없이도)
  const r = [], sh = [], ro = [];
  for (let s = 0; s < w.n; s++) {
    const m = JSON.parse(w.snap);
    if (w.maxLv) m.hero.level = Math.min(m.hero.level, w.maxLv);
    const o = playRun(m, botLoadout(m, w.cls), 5000 + s, w.mode);
    r.push(o.summary.floorsCleared);
    if (o.full) sh.push(o.share);
    if (w.collab) {
      const m2 = JSON.parse(w.snap);
      ro.push(playRun(m2, botLoadout(m2, w.cls), 5000 + s, w.mode, { collabOff: true }).summary.floorsCleared);
    }
  }
  parentPort.postMessage({ r, sh, ro });
}

// WebAudio 합성 효과음 (에셋 없음). AudioContext 가 없으면 조용한 no-op
const MASTER = 0.3;
// 같은 소리 최소 간격(ms): 연사 중 귀가 아프지 않게
const THROTTLE = {
  shoot: 70, hit: 40, crit: 60, big: 90, coin: 55, kill: 30, upgrade: 35, combo: 120,
  frenzy: 500, synergy: 400, boss: 800, clear: 1000, defeat: 1000, meteor: 300, freeze: 300,
  // 판타지 스킬 카드 · 원소 융합
  pickShow: 250, cardFlip: 55, pickConfirm: 350, fusion: 600, spell: 180,
};
const rnd = (a, b) => a + Math.random() * (b - a);

export function createAudio() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  let ctx = null, master = null, warm = null, echo = null, noiseBuf = null;
  let enabled = true, upStep = 0, upT = 0;
  const lastT = {};

  // 첫 사용자 제스처에서 호출 (자동재생 정책)
  function unlock() {
    if (!AC) return;
    try {
      if (!ctx) {
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 6;
        comp.attack.value = 0.003; comp.release.value = 0.15;
        master = ctx.createGain();
        master.gain.value = enabled ? MASTER : 0;
        master.connect(comp).connect(ctx.destination);
        // 톱니파를 부드럽게 깎는 저역 통과
        warm = ctx.createBiquadFilter();
        warm.type = 'lowpass';
        warm.frequency.value = 1600;
        warm.connect(master);
        // 발견 징글용 메아리
        echo = ctx.createGain();
        const dl = ctx.createDelay(1), fb = ctx.createGain();
        dl.delayTime.value = 0.17;
        fb.gain.value = 0.32;
        echo.connect(master);
        echo.connect(dl).connect(fb).connect(dl);
        dl.connect(master);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        document.addEventListener('visibilitychange', () => {
          (document.hidden ? ctx.suspend() : ctx.resume()).catch(() => {});
        });
      }
      if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
    } catch {
      ctx = null;
    }
  }

  // 음 하나: f → f2 로 미끄러짐, d초, 파형, 음량 v, at초 뒤 시작, a = 어택
  function tone(f, d, { type = 'sine', v = 0.2, at = 0, f2 = 0, a = 0.005, dest = master } = {}) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + d + 0.02);
  }

  // 필터 거친 잡음
  function noise(d, { v = 0.2, at = 0, type = 'bandpass', f = 1000, f2 = 0, q = 1, a = 0.004 } = {}) {
    const t = ctx.currentTime + at;
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
    fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fl).connect(g).connect(master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + d + 0.02);
  }

  const SFX = {
    shoot() {
      noise(0.04, { v: 0.04, type: 'highpass', f: 2500 });
      tone(240, 0.05, { type: 'square', v: 0.018, f2: 110, dest: warm });
    },
    hit() {
      noise(0.05, { v: 0.1, f: rnd(1500, 2200), q: 1.5 });
      tone(330 * rnd(0.9, 1.1), 0.06, { type: 'triangle', v: 0.07, f2: 160 });
    },
    crit() {
      tone(1200, 0.09, { type: 'square', v: 0.07, f2: 380, dest: warm });
      noise(0.08, { v: 0.2, type: 'highpass', f: 3000 });
      tone(160, 0.14, { v: 0.32, f2: 55 });
    },
    big() {
      tone(130, 0.34, { v: 0.55, f2: 36 });
      noise(0.26, { v: 0.35, type: 'lowpass', f: 900, f2: 110 });
    },
    coin() {
      const p = rnd(0.94, 1.08);
      tone(988 * p, 0.07, { type: 'square', v: 0.028, dest: warm });
      tone(1319 * p, 0.18, { type: 'square', v: 0.028, at: 0.06, dest: warm });
      tone(2638 * p, 0.14, { v: 0.03, at: 0.06 });
    },
    kill() {
      tone(520 * rnd(0.9, 1.15), 0.08, { v: 0.15, f2: 1250 });
      noise(0.04, { v: 0.06, f: 3500 });
    },
    // tier 1~4: 단계가 오를수록 높게, 길게
    combo(tier = 1) {
      tier = Math.max(1, Math.min(4, tier | 0));
      const base = 523.25 * 2 ** ((tier - 1) * 3 / 12);
      const steps = [0, 4, 7, 12, 16].slice(0, 3 + Math.min(2, tier - 1));
      steps.forEach((s, i) => tone(base * 2 ** (s / 12), 0.15, { type: 'triangle', v: 0.14, at: i * 0.055 }));
      tone(base * 4, 0.35, { v: 0.05, at: steps.length * 0.055 });
    },
    frenzy() {
      noise(0.7, { v: 0.28, f: 300, f2: 4000, q: 2, a: 0.25 });
      tone(220, 0.6, { type: 'sawtooth', v: 0.08, f2: 440, at: 0.1, a: 0.1, dest: warm });
      for (let i = 0; i < 4; i++) {
        tone(150, 0.16, { v: 0.5, f2: 45, at: 0.12 + i * 0.12 });
        noise(0.05, { v: 0.14, type: 'highpass', f: 5000, at: 0.18 + i * 0.12 });
      }
    },
    // 히든 조합 발견: 올라가는 반짝 아르페지오 → 종소리 화음 + 메아리 + 별가루
    synergy() {
      [1175, 1568, 1976, 2349].forEach((f, i) => tone(f, 0.22, { type: 'triangle', v: 0.13, at: i * 0.07, dest: echo }));
      for (const f of [784, 988, 1175]) tone(f, 1.1, { type: 'triangle', v: 0.08, at: 0.28, a: 0.02, dest: echo });
      tone(3136, 0.9, { v: 0.06, at: 0.28, dest: echo });
      tone(98, 0.5, { v: 0.35, f2: 60, at: 0.28 });
      for (let i = 0; i < 7; i++) tone(rnd(2600, 5200), 0.12, { v: 0.035, at: 0.36 + i * 0.07, dest: echo });
    },
    boss() {
      for (let i = 0; i < 2; i++) {
        tone(110, 0.48, { type: 'sawtooth', v: 0.2, at: i * 0.58, f2: 98, a: 0.06, dest: warm });
        tone(165, 0.48, { type: 'sawtooth', v: 0.12, at: i * 0.58, f2: 147, a: 0.06, dest: warm });
      }
      tone(55, 1.1, { v: 0.3, a: 0.1 });
    },
    clear() {
      const n = [523.25, 659.25, 783.99];
      n.forEach((f, i) => tone(f, 0.12, { type: 'square', v: 0.1, at: i * 0.11, dest: warm }));
      for (const f of [1046.5, 659.25, 783.99]) tone(f, 0.6, { type: 'square', v: 0.08, at: 0.36, a: 0.01, dest: warm });
      tone(2093, 0.5, { type: 'triangle', v: 0.05, at: 0.36 });
      tone(130.8, 0.5, { type: 'triangle', v: 0.25, at: 0.36 });
    },
    defeat() {
      [392, 330, 262, 196].forEach((f, i) => tone(f, i === 3 ? 0.9 : 0.34, { type: 'triangle', v: 0.16, at: i * 0.28 }));
      tone(98, 1.2, { type: 'sawtooth', v: 0.1, at: 0.84, f2: 70, dest: warm });
      noise(0.5, { v: 0.2, type: 'lowpass', f: 600, f2: 100 });
    },
    meteor() {
      noise(0.9, { v: 0.32, type: 'lowpass', f: 180, f2: 1400, a: 0.6 });
      tone(90, 0.8, { v: 0.2, f2: 45, a: 0.5 });
      tone(70, 0.65, { v: 0.75, f2: 26, at: 0.72 });
      noise(0.8, { v: 0.5, type: 'lowpass', f: 2600, f2: 140, at: 0.72 });
    },
    freeze() {
      for (let i = 0; i < 9; i++) tone(rnd(1800, 4200), 0.35, { v: 0.04, at: i * 0.045 });
      tone(1568, 0.8, { type: 'triangle', v: 0.05, f2: 2093, a: 0.05 });
      noise(0.7, { v: 0.09, type: 'highpass', f: 6000, a: 0.2 });
    },
    // ── 판타지 스킬 카드 ──
    pickShow() { // 마나 폭주: 카드 3장 등장 휘시
      noise(0.32, { v: 0.13, type: 'highpass', f: 700, f2: 2400, a: 0.06 });
      tone(280, 0.32, { type: 'triangle', v: 0.07, f2: 640, dest: warm });
    },
    cardFlip() { // 카드 뒤집기 틱(스태거로 여러 번)
      noise(0.03, { v: 0.05, type: 'highpass', f: 3200 });
      tone(920, 0.04, { type: 'square', v: 0.03 });
    },
    // 카드 선택 확정: 희귀도에 따라 커짐, 전설은 팡파레
    pickConfirm(rarity = 'common') {
      if (rarity === 'legend') {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.3, { type: 'triangle', v: 0.15, at: i * 0.08, dest: echo }));
        tone(2093, 0.6, { v: 0.08, at: 0.32, dest: echo });
        for (let i = 0; i < 8; i++) tone(rnd(2600, 5200), 0.14, { v: 0.03, at: 0.3 + i * 0.05, dest: echo });
      } else if (rarity === 'rare') {
        [659.25, 880, 1108.7].forEach((f, i) => tone(f, 0.16, { type: 'triangle', v: 0.11, at: i * 0.06 }));
      } else {
        tone(560, 0.1, { type: 'triangle', v: 0.09 });
        tone(760, 0.12, { type: 'triangle', v: 0.07, at: 0.05 });
      }
    },
    // 원소 융합 발견: 히든 조합 징글(synergy)을 재사용해 한층 더 웅장하게
    fusion() {
      SFX.synergy();
      tone(65, 0.9, { v: 0.4, f2: 40, at: 0.05 });
      [1568, 1975.5, 2349.3, 3136] .forEach((f, i) => tone(f, 0.3, { type: 'triangle', v: 0.1, at: 0.5 + i * 0.09, dest: echo }));
    },
    // 스킬별 시전 효과음(spell{key} 이벤트에서 key를 그대로 넘겨 호출)
    spell(key) {
      switch (key) {
        case 'fireball': // 파이어볼 폭발
          noise(0.3, { v: 0.3, type: 'lowpass', f: 1200, f2: 160, a: 0.01 });
          tone(120, 0.28, { v: 0.3, f2: 45 });
          break;
        case 'lightningStrike': // 낙뢰 크랙
          tone(1400, 0.07, { type: 'square', v: 0.09, f2: 300, dest: warm });
          noise(0.12, { v: 0.22, type: 'highpass', f: 3500 });
          break;
        case 'iceLance': // 얼음 창 산산조각
          for (let i = 0; i < 5; i++) tone(rnd(2000, 3600), 0.12, { v: 0.05, at: i * 0.02 });
          tone(1200, 0.18, { type: 'triangle', v: 0.06, f2: 2000 });
          break;
        case 'tornado': // 회오리 휘시(등장 시 1회, 쿨타임마다 재생돼 루프처럼 들림)
          noise(0.6, { v: 0.1, type: 'bandpass', f: 500, f2: 900, q: 1.4, a: 0.15 });
          break;
        case 'judgment': // 심판 광선 험
          tone(220, 0.5, { type: 'sawtooth', v: 0.1, f2: 880, a: 0.08, dest: warm });
          tone(1760, 0.4, { v: 0.05, at: 0.05 });
          break;
        case 'babyDragon': // 새끼 드래곤 브레스 직전 포효
          tone(180, 0.3, { type: 'sawtooth', v: 0.14, f2: 90, dest: warm });
          noise(0.25, { v: 0.1, type: 'highpass', f: 1800, at: 0.05 });
          break;
        case 'holyLight': // 수호의 빛 차임
          [784, 988, 1174.7].forEach((f, i) => tone(f, 0.3, { type: 'triangle', v: 0.06, at: i * 0.05 }));
          break;
        case 'stoneGolem': // 돌 골렘이 대신 맞는 둔탁한 소리
          tone(80, 0.22, { v: 0.3, f2: 40 });
          noise(0.15, { v: 0.15, type: 'lowpass', f: 400 });
          break;
        default:
          tone(440, 0.08, { v: 0.05 });
      }
    },
    // 빠르게 연달아 사면 음이 한 계단씩 올라감
    upgrade() {
      const now = performance.now();
      upStep = now - upT < 400 ? Math.min(upStep + 1, 14) : 0;
      upT = now;
      const f = 660 * 2 ** (upStep / 12);
      tone(f, 0.07, { type: 'square', v: 0.045, dest: warm });
      tone(f * 1.5, 0.1, { v: 0.06, at: 0.03 });
    },
  };

  function play(name, arg) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    const fn = SFX[name];
    if (!fn) return;
    const now = performance.now();
    if (now - (lastT[name] ?? -1e9) < (THROTTLE[name] ?? 0)) return;
    lastT[name] = now;
    try { fn(arg); } catch { /* 소리 오류는 게임에 영향 없음 */ }
  }

  function setEnabled(on) {
    enabled = !!on;
    if (master) master.gain.setTargetAtTime(enabled ? MASTER : 0, ctx.currentTime, 0.02);
  }

  return { play, setEnabled, unlock };
}

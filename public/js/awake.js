// 설정 '화면 꺼짐 방지'(settings.screenOn): 'battle'(기본 — 도전 중에만) · 'always'(앱이 보이는 동안) · 'off'(시스템 기본)
// APK: 네이티브 FLAG_KEEP_SCREEN_ON(AppUpdaterPlugin.keepAwake) · 웹: Screen Wake Lock API(없으면 조용히 아무것도 안 함)
export const SCREEN_ON_KEYS = ['battle', 'always', 'off'];

// 지금 화면을 켜 둘까? (순수 함수 — test/awake.test.js)
export const wantAwake = (mode, { run, visible }) => visible && (mode === 'always' || (mode === 'battle' && run));

// nativePlugin: Capacitor AppUpdater 플러그인(APK) 또는 null(웹)
export function createAwake(nativePlugin) {
  const wl = typeof navigator !== 'undefined' ? navigator.wakeLock : undefined;
  let want = null, lock = null, pending = false; // null: 첫 sync 는 늘 네이티브까지 보낸다(웹뷰만 다시 읽혀 창 플래그가 켜진 채 남은 경우)
  function sync(on) {
    if (on === want) return;
    want = on;
    if (nativePlugin) { nativePlugin.keepAwake({ on }).catch(() => { want = null; }); return; } // 실패하면 다음 sync 에서 다시
    if (!wl) return;
    if (!on) { lock?.release().catch(() => {}); lock = null; return; }
    if (lock || pending) return;
    pending = true;
    // ponytail: 거절되면(권한·저전력 모드) 다음 켜짐 전환(숨김 → 다시 보임 등)까지 다시 묻지 않는다
    wl.request('screen').then(l => {
      if (!want) { l.release().catch(() => {}); return; }
      lock = l;
      l.addEventListener('release', () => { if (lock === l) { lock = null; want = false; } }); // 시스템이 풀면(숨김 등) 다음 sync 에서 다시 잡는다
    }, () => {}).finally(() => { pending = false; });
  }
  return { supported: !!nativePlugin || !!wl, sync };
}

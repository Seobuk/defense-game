// iPhone/웹 PWA: 서비스 워커 등록 + version.json 폴링으로 새 배포 감지 + 안전한 순간에 새로고침.
// Capacitor 네이티브 앱에서는 전부 조용히 비활성(업데이트는 updater.js가 GitHub Releases로 처리).
// main.js 배선 예시:
//   import * as pwa from './pwa.js';
//   pwa.onUpdateReady(() => { if (안전한 화면) pwa.applyUpdate(); else 나중에 안전한 화면에서 pwa.isUpdateReady() 확인 후 applyUpdate(); });
//   if (pwa.justUpdated()) toast('업데이트 완료');

const ROOT = new URL('../', import.meta.url); // pwa.js는 public/js/ 안에 있고, sw.js·version.json은 public/ 바로 아래
const VERSION_URL = new URL('version.json', ROOT);
const SW_URL = new URL('sw.js', ROOT);
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5분(웹 배포는 APK 릴리스보다 잦고 가벼움)
const JUST_UPDATED_KEY = 'wd:pwaJustUpdated';

let knownBuild = null; // 이 세션이 시작할 때의 build(기준선)
let ready = false;
let justUpdatedFlag = false;
const readyCbs = new Set();

const isCapacitorNative = () =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

export function isUpdateReady() {
  return ready;
}

export function onUpdateReady(cb) {
  readyCbs.add(cb);
  if (ready) cb();
}

// 새로고침해서 새 배포를 적용한다. 전투 중이 아닌 안전한 순간(main.js가 판단)에 호출할 것.
export function applyUpdate() {
  try {
    sessionStorage.setItem(JUST_UPDATED_KEY, '1');
  } catch {
    /* 세션 스토리지 막힘 — 토스트만 못 뜨고 새로고침은 계속 진행 */
  }
  location.reload();
}

// 방금 applyUpdate()로 새로고침된 직후인지(1회성). "업데이트 완료" 토스트용.
export function justUpdated() {
  const v = justUpdatedFlag;
  justUpdatedFlag = false;
  return v;
}

async function checkVersion() {
  let data;
  try {
    const res = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!res.ok) return;
    data = await res.json();
  } catch {
    return; // 오프라인 — 다음 기회에
  }
  const build = String(data?.build ?? data?.version ?? '');
  if (!build) return;
  if (knownBuild === null) {
    knownBuild = build; // 이 세션의 기준선(조용히 저장, ready 표시 안 함)
    return;
  }
  if (build !== knownBuild && !ready) {
    ready = true;
    readyCbs.forEach((cb) => cb());
  }
}

function init() {
  try {
    if (sessionStorage.getItem(JUST_UPDATED_KEY) === '1') {
      justUpdatedFlag = true;
      sessionStorage.removeItem(JUST_UPDATED_KEY);
    }
  } catch {
    /* 세션 스토리지 막힘 — 무시 */
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(SW_URL, { scope: ROOT }).catch(() => {});
    // 첫 방문에 이미 받은 파일은 서비스 워커를 거치지 않았다 → 직접 캐시에 넣어 첫 실행 직후에도 오프라인 재실행이 되게(sw.js CACHE와 같은 이름)
    navigator.serviceWorker.ready.then(() => caches.open('wd-v1')).then(c => {
      const urls = [location.href.split('#')[0], new URL('index.html', ROOT).href,
        ...performance.getEntriesByType('resource').map(e => e.name).filter(u => u.startsWith(ROOT.origin))];
      return Promise.all([...new Set(urls)].map(u => c.match(u).then(hit => hit || c.add(u)).catch(() => {})));
    }).catch(() => {});
  }

  checkVersion();
  setInterval(checkVersion, CHECK_INTERVAL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkVersion();
  });
  window.addEventListener('online', checkVersion);
}

if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !isCapacitorNative()) {
  init();
}

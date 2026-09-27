// PWA 서비스 워커: 네트워크 우선 + 캐시 폴백(오프라인 플레이). GitHub Pages(/play/)·로컬 서버 어디서든 동작.
// Capacitor APK에서는 애초에 등록되지 않는다(js/pwa.js가 window.Capacitor?.isNativePlatform?.()일 때 register()를 건너뜀).
// 버전 갱신은 이 캐시가 아니라 version.json 폴링(js/pwa.js)이 안전한 순간에 새로고침으로 처리한다 — 그래서 캐시 이름을 버전마다 바꿀 필요가 없다.
const CACHE = 'wd-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // cache:'no-cache' = HTTP 캐시를 거치되 항상 재검증(ETag 304). GitHub Pages는 max-age=600이라 그냥 fetch하면
  // 업데이트 새로고침 뒤에도 10분 동안 옛 JS 모듈이 HTTP 캐시에서 나온다(새 index.html + 옛 ui.js 섞임)
  e.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => (await caches.match(req, { ignoreSearch: req.mode === 'navigate' })) ?? (await caches.match('./index.html')))
  );
});

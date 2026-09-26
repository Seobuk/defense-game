// APK 자동 업데이트 (GitHub Releases). Capacitor 네이티브 앱에서만 동작하고,
// 일반 브라우저에서는 조용히 아무것도 하지 않는다 ({available:false}).
// 네이티브 쪽: android/.../AppUpdaterPlugin.java

const DEFAULT_RELEASES_URL = 'https://api.github.com/repos/Seobuk/defense-game/releases/latest';
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const NONE = Object.freeze({ available: false });

let releasesUrl = DEFAULT_RELEASES_URL;
let lastCheckAt = 0;
let latest = NONE;        // 마지막 확인 결과
let checking = null;      // 진행 중인 check 프라미스
let downloading = null;   // 진행 중인 download 프라미스
let downloaded = null;    // { version, path }
let current = null;       // { versionName, versionCode }
const progressCbs = new Set();
let started = false;
let readyVersion = null;

const cap = () => (typeof window !== 'undefined' ? window.Capacitor : undefined);

export function isNative() {
  return !!cap()?.isNativePlatform?.();
}

let pluginRef = null;
function plugin() {
  if (!isNative()) return null;
  return (pluginRef ??= cap().Plugins?.AppUpdater ?? cap().registerPlugin('AppUpdater'));
}

// 테스트용: 릴리스 API 주소 교체 (로컬 목, data: URL 등)
export function configure({ releasesUrl: url } = {}) {
  if (typeof url === 'string' && url) {
    releasesUrl = url;
    lastCheckAt = 0;
    latest = NONE;
  }
}

function parseVer(s) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(s ?? '').trim());
  return m ? [+m[1], +m[2], +m[3]] : null;
}

function newer(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

// 설치된 앱 버전 { versionName, versionCode } (브라우저: null)
export async function getCurrentVersion() {
  const p = plugin();
  if (!p) return null;
  if (!current) {
    const info = await p.getInfo();
    current = { versionName: info.versionName, versionCode: info.versionCode };
    // 앱 재시작 전에 받아 둔 APK가 있으면 재사용
    if (info.downloaded?.path && !downloaded) {
      downloaded = { version: info.downloaded.versionName, path: info.downloaded.path };
    }
  }
  return current;
}

// 새 버전 확인 → { available, version, notes, url, size } / { available:false, error? }
// 30분 안에 성공한 확인이 있으면 캐시를 돌려줌 (force로 무시)
export function check({ force = false } = {}) {
  if (!isNative()) return Promise.resolve(NONE);
  if (!force && lastCheckAt && Date.now() - lastCheckAt < CHECK_INTERVAL_MS) return Promise.resolve(latest);
  return (checking ??= doCheck().finally(() => { checking = null; }));
}

async function doCheck() {
  let res;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    res = await fetch(releasesUrl, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
      signal: ctl.signal,
    });
  } catch {
    return { available: false, error: 'offline' };
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 404) return remember(NONE); // 아직 릴리스 없음
  if (res.status === 403 || res.status === 429) return { available: false, error: 'rate_limit' };
  if (!res.ok) return { available: false, error: 'http' };

  let rel;
  try {
    rel = await res.json();
  } catch {
    return { available: false, error: 'http' };
  }
  const cur = parseVer((await getCurrentVersion())?.versionName);
  const ver = parseVer(rel?.tag_name);
  const asset = Array.isArray(rel?.assets)
    ? rel.assets.find((a) => /\.apk$/i.test(a?.name ?? '') && /^https?:\/\//.test(a?.browser_download_url ?? ''))
    : null;
  if (!cur || !ver || rel.draft || rel.prerelease || !asset || !newer(ver, cur)) return remember(NONE);
  return remember({
    available: true,
    version: ver.join('.'),
    notes: typeof rel.body === 'string' ? rel.body : '',
    url: asset.browser_download_url,
    size: Number(asset.size) || 0,
  });
}

function remember(r) {
  latest = r;
  lastCheckAt = Date.now();
  return r;
}

// 마지막 check()에서 찾은 APK를 받는다 → 파일 경로 (없으면 null)
// onProgress(pct): 0~100, 크기를 모르면 -1. 동시 호출은 하나로 합쳐짐.
export async function download(onProgress) {
  const p = plugin();
  if (!p || !latest.available) return null;
  if (downloaded?.version === latest.version) return downloaded.path;
  if (onProgress) progressCbs.add(onProgress);
  return (downloading ??= doDownload(p, latest).finally(() => {
    downloading = null;
    progressCbs.clear();
  }));
}

async function doDownload(p, info) {
  const sub = await p.addListener('progress', (e) => progressCbs.forEach((cb) => cb(e.pct)));
  try {
    const r = await p.download({ url: info.url });
    // 태그와 APK 안의 버전이 다르면 설치해도 계속 업데이트 알림이 뜨므로 거부
    if (r.versionName !== info.version) {
      throw Object.assign(new Error('릴리스 버전과 설치 파일 버전이 달라요'), { code: 'VERSION_MISMATCH' });
    }
    downloaded = { version: info.version, path: r.path };
    return r.path;
  } finally {
    sub.remove();
  }
}

// 받아 둔 업데이트 정보 (없으면 null) — 모달 표시용
export function ready() {
  return downloaded && latest.available && downloaded.version === latest.version ? latest : null;
}

export async function canInstall() {
  const p = plugin();
  return p ? (await p.canInstall()).allowed : false;
}

// '출처를 알 수 없는 앱' 허용 화면을 열고, 앱으로 돌아오면 { allowed } 로 끝난다
export async function openInstallSettings() {
  const p = plugin();
  if (!p) return { allowed: false };
  const App = cap().Plugins?.App;
  let sub = null;
  const back = new Promise((res) => {
    sub = App?.addListener('appStateChange', (s) => s.isActive && res());
  });
  try {
    await p.openInstallSettings();
    if (App) await back;
  } finally {
    (await sub)?.remove();
  }
  return { allowed: await canInstall() };
}

// 시스템 설치 화면 열기 → { ok:true } | { needsPermission:true } | { ok:false, error }
export async function install() {
  const p = plugin();
  if (!p) return { ok: false, error: 'NOT_NATIVE' };
  if (!downloaded) return { ok: false, error: 'NO_DOWNLOAD' };
  if (!(await canInstall())) return { needsPermission: true };
  try {
    await p.install({ path: downloaded.path });
    return { ok: true };
  } catch (e) {
    if (e?.code === 'FILE_MISSING') downloaded = null;
    return { ok: false, error: e?.code || 'INSTALL_FAILED', message: e?.message };
  }
}

// 자동 모드: 실행 시·30분마다·앱 복귀 시 확인 → 백그라운드 다운로드 → 준비되면 onReady(info) 1회
export function start(onReady) {
  if (!isNative() || started) return;
  started = true;
  const run = async () => {
    try {
      const info = await check();
      if (!info.available) return;
      await download();
      if (ready() && readyVersion !== info.version) {
        readyVersion = info.version;
        onReady?.(info);
      }
    } catch (e) {
      console.warn('[updater]', e?.code || '', e?.message || e);
    }
  };
  run();
  setInterval(run, CHECK_INTERVAL_MS);
  cap().Plugins?.App?.addListener('appStateChange', (s) => s.isActive && run());
}

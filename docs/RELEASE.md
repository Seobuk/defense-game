# 릴리스 & APK 자가 업데이트

Android 앱 = Capacitor 6(`android/`)이 `public/`을 감싼 것. 릴리스는 **이 PC에서만** 빌드·서명·배포한다 (CI 없음, 키스토어는 PC 밖으로 안 나감).

## 준비물 (한 번만)
- JDK 17 (`JAVA_HOME`), Android SDK (`%LOCALAPPDATA%\Android\Sdk`, platform 34, build-tools 34/35+)
- `npm install`
- `gh auth login` (GitHub CLI, Seobuk/defense-game 쓰기 권한)
- 서명 키: `%USERPROFILE%\.defense-game\release.jks` + `keystore.properties`
  (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`; storeFile은 절대 경로)
  - **반드시 백업** (비밀번호 관리자 + 오프라인). 잃어버리면 이미 설치된 앱은 더 이상 업데이트할 수 없다(삭제 후 재설치 → 저장 데이터 손실).
  - 다른 위치: env `DEFENSE_KEYSTORE_PROPERTIES=경로` 또는 `gradlew -PkeystoreProperties=경로`
  - 파일 없이: env `DEFENSE_STORE_FILE`, `DEFENSE_STORE_PASSWORD`, `DEFENSE_KEY_ALIAS`, `DEFENSE_KEY_PASSWORD`
  - `*.jks`, `*.keystore`, `keystore.properties`는 `.gitignore` 됨. 절대 커밋 금지.

## 버전
단일 출처 = `package.json`의 `"version"` (X.Y.Z, Y·Z는 0~99).
Gradle이 직접 읽음 → `versionName = X.Y.Z`, `versionCode = X*10000 + Y*100 + Z`.
앱은 태그 `vX.Y.Z`와 설치된 versionName을 비교하므로 **태그 = package.json 버전**이어야 한다 (release 스크립트가 보장).

## 릴리스 순서
1. `package.json` 버전 올리기 (예: 0.1.0 → 0.2.0)
2. (선택) `RELEASE_NOTES.md`에 섹션 추가 — 앱 업데이트 모달에 그대로 보임
   ```md
   ## v0.2.0
   - 보스 타격감 강화
   - 히든 조합 2개 추가
   ```
   섹션이 없으면 GitHub 자동 생성 노트(`--generate-notes`).
3. 커밋 → `git push` (main)
4. `npm run release -- --dry-run` 으로 빌드·서명 확인 (태그/업로드 없음)
5. `npm run release`

`scripts/release.mjs`가 하는 일:
- main 브랜치 + 깨끗한 작업 트리 + origin/main과 동기 + `gh` 로그인 확인
- 태그 `vX.Y.Z`가 로컬/origin에 이미 있으면 거부
- `npx cap sync android` → `gradlew assembleRelease` (로컬 키스토어로 서명)
- `dist/defense-game.apk`로 복사 (이름 고정) → `apksigner verify --print-certs`
- 주석 태그 생성 → 태그 푸시 → `gh release create vX.Y.Z dist/defense-game.apk --title vX.Y.Z`

dry-run에서는 git 전제 조건 위반을 경고로만 표시하고 빌드·서명 검증까지만 한다.
gh 업로드만 실패하면(태그는 이미 푸시됨) 안내된 `gh release create ...` 명령으로 다시 시도.

고정 다운로드 링크(랜딩 페이지용): https://github.com/Seobuk/defense-game/releases/latest/download/defense-game.apk

## 개발 빌드
```sh
npx cap sync android                 # public/ → android 에셋 복사 (public/index.html 필요)
cd android && gradlew.bat assembleDebug     # app/build/outputs/apk/debug/app-debug.apk
cd android && gradlew.bat assembleRelease   # app/build/outputs/apk/release/app-release.apk (서명됨)
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```
디버그 APK는 디버그 키로 서명되므로 릴리스 APK 위에 덮어 설치할 수 없다(먼저 삭제).
디버그 빌드는 `chrome://inspect`로 WebView 디버깅 가능.

아이콘 다시 만들기: `py -3.12 scripts/gen_icons.py` (Pillow 필요) → `android/app/src/main/res/mipmap-*`.

## 앱 쪽 동작
- 네이티브: `android/app/src/main/java/io/github/seobuk/defensegame/AppUpdaterPlugin.java` (MainActivity에서 등록)
- 웹: `public/js/updater.js` — 브라우저에서는 전부 조용한 no-op.
- 확인 소스: `https://api.github.com/repos/Seobuk/defense-game/releases/latest` (public, 토큰 없음, IP당 시간당 60회 제한 → 30분 스로틀)
- APK는 앱 전용 폴더 `files/updates/update.apk`에 저장, 설치 후 다음 실행 때 자동 삭제.
- 최초 1회 "출처를 알 수 없는 앱 설치" 허용이 필요 (OS 정책), 설치 확인 탭 1번도 OS 필수.

### main.js 연동
```js
import * as updater from './updater.js';

// 부팅 시 1회. 실행 시·30분마다·앱 복귀 시 확인 → 백그라운드 다운로드 → 준비되면 콜백 1회(버전당)
updater.start((info) => { pendingUpdate = info; });   // info = { version, notes, size, url }

// 안전한 타이밍(스테이지 전환·패배 모달·메뉴)에서:
if (pendingUpdate) showUpdateModal(pendingUpdate);   // "새 버전 v{version} 준비 완료" + notes

// [지금 업데이트]
async function onUpdateNow() {
  let r = await updater.install();
  if (r.needsPermission) {
    // "업데이트하려면 '이 출처 허용'을 켜 주세요" 안내 후 [설정 열기]
    const { allowed } = await updater.openInstallSettings(); // 앱으로 돌아오면 끝남
    if (allowed) r = await updater.install();
  }
  if (r.ok === false) toast(r.message || '업데이트를 시작하지 못했어요');
}

// 설정 화면: 현재 버전 + [업데이트 확인]
const v = await updater.getCurrentVersion();          // null이면 웹 버전
const info = await updater.check({ force: true });    // { available:false, error?:'offline'|'rate_limit'|'http' }
if (info.available) await updater.download((pct) => setBar(pct));   // pct: 0..100, 모르면 -1
if (updater.ready()) showUpdateModal(updater.ready());

// 하드웨어 뒤로가기 (리스너가 있으면 앱이 종료되지 않고 JS로 옴)
window.Capacitor?.Plugins?.App?.addListener('backButton', () => { /* 모달 닫기 / 일시정지 메뉴 */ });
```

## 로컬 목으로 업데이트 테스트 (디버그 빌드 전용)
- 플러그인은 https만 받지만 **디버그 빌드**는 `http://10.0.2.2:*`(에뮬레이터 → PC)도 허용
  (`src/debug/AndroidManifest.xml`이 디버그에서만 cleartext 허용). 릴리스 빌드에는 없음.
- 절차: 디버그 APK(현재 버전) 설치 → package.json 버전을 잠시 올려 두 번째 디버그 APK 빌드 → 버전 원복 →
  PC에서 두 번째 APK를 서빙 → WebView 콘솔(chrome://inspect)에서:
  ```js
  const u = await import('/js/updater.js');
  u.configure({ releasesUrl: 'data:application/json,' + encodeURIComponent(JSON.stringify({
    tag_name: 'v0.1.1', draft: false, prerelease: false, body: '테스트',
    assets: [{ name: 'defense-game.apk', size: 0, browser_download_url: 'http://10.0.2.2:8765/defense-game.apk' }] })) });
  await u.check({ force: true }); await u.download(console.log); await u.install();
  ```

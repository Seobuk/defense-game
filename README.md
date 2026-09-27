# 벽 지키기: 100층 돌파

마법 판타지 성벽 디펜스 **로그라이트**. 성벽 위 마법사 2명(왼쪽 나, 오른쪽 AI 동료)이 주문을 쏟아붓고, 내가 고른 클래스의 영웅이 전장을 누비며 싸웁니다.
성벽이 무너지면 도전 끝 → 결과 → 정비(영웅·특성·장비·시작 스킬·보석 영구 강화) → 다시 1층부터. 매 도전마다 어떤 영웅과 어떤 스킬을 조합할지가 핵심입니다.

- **Android**: APK 설치(앱이 스스로 업데이트) — https://github.com/Seobuk/defense-game/releases/latest/download/defense-game.apk
- **iPhone**: Safari로 https://seobuk.github.io/defense-game/play/ 접속 → 공유 → **홈 화면에 추가** (웹앱, 오프라인·자동 업데이트)

## 게임 흐름
1. **타이틀** — 진행 중인 도전이 있으면 **이어하기**(그 층 시작부터) 또는 **포기하고 정산하기**.
2. **정비 화면** — 출정(영웅 클래스 선택 · 장비 · 시작 스킬) · 특성(클래스별 3갈래 × 6노드, 무료 초기화, 자동 배분) · 강화(보석 영구 강화 12종) · 도감.
   **도전 시작**(1층부터) 또는 **같은 조합**(지난 도전의 영웅·시작 스킬).
3. **도전** — 층마다 처치 60%에서 스킬 카드, 네임드 보스 등장 시 1장 더(보스 등장 배너가 끝난 뒤 뜸). 슬롯 6칸 · Lv5, 다 차면 각성 카드. 도전 중 레벨업으로 생긴 특성 포인트는 영웅 버튼(특성 +N)에서 바로 찍기.
4. **성벽 붕괴(또는 100층 돌파)** — 즉시 정산·저장 → **결과 화면**(도달 층, 신기록, 보스, 피해 비중 = 나/AI 동료/영웅 기여도, 보석 내역, 새 영웅 해금) → 정비 화면.

## 특징
- **성벽 마법사 = 주문 시전** — 나는 화염구(폭발), AI 동료는 서리 화살(관통·둔화). 강화: 마력 · 시전 속도 · 치명타 · 다중 시전 · 성벽 결계. AI 동료는 네임드 보스를 잡을 때마다 새 주문을 익힙니다.
- **판타지 스킬 카드 14종 · 원소 융합 8종(히든)** — 빌드는 도전 전체에 누적. 융합 조건은 비밀, 발견하면 컷인과 함께 도감 등록(도감 22칸).
- **영웅 5클래스** — 기사·궁수·마법사, 성직자(20층)·암살자(40층) 해금. 전장을 스스로 누비며 가장 위험한 적을 공격(근접 돌격 · 원거리 카이팅 · 체력 30% 후퇴 → 재진격), 탭하면 그 자리로 이동, 궁극기 버튼. 특성 트리 궁극 특성 15종(늑대 무리·그림자 분신·절대영도·천벌 기둥 등).
- **영구 성장** — 영웅 레벨·장비(5부위 × 5등급)·특성, 보석 영구 강화(기본 마력·시전 속도·성벽 결계·골드·시작 골드·영웅 경험치·카드 선택지·새로고침·시작 스킬 슬롯·부활 결계·치명타 폭발·황금 곡괭이).
- **학살 가속 · 광폭화** — 압도적인 층은 15~25초, 80초를 넘기면 적이 광폭화(교착 없음).
- **손맛** — 히트스톱, 콤보·광란, 동전 분수, 데미지 숫자(전체/간소/끄기), 1·2·3배속(3배속은 20층 클리어 후).
- **방치 보상** — 앱을 떠나 있던 시간(최대 8시간)만큼 보석 + 영웅 경험치.
- **저장 백업 코드** — 설정 → 저장 백업(코드 복사) / 저장 복원(붙여 넣기). 안드로이드 ↔ 아이폰 기기 이동 가능. 손상·다른 코드는 친절한 문구로 거절, 옛 버전 코드는 자동 마이그레이션.

## iPhone (PWA)
- 같은 게임 코드(`public/`)를 GitHub Pages `/play/`에 배포합니다. 랜딩 페이지는 루트(`/defense-game/`).
- 설치: iPhone **Safari** → 주소 열기 → 공유 버튼 → **홈 화면에 추가** → 홈 화면 아이콘으로 실행(전체 화면·세로).
- 오프라인: 서비스 워커(`public/sw.js`, 네트워크 우선 + 캐시 폴백). 첫 실행 직후부터 비행기 모드에서도 실행됩니다.
- 자동 업데이트: `version.json`의 build가 바뀌면(배포 때 커밋 SHA가 찍힘) 전투 중이 아닌 **타이틀·정비 화면**에서 새로고침하고 "업데이트 완료" 토스트를 띄웁니다.
- 배포: `.github/workflows/pages.yml`(landing/ → 루트, public/ → /play/). 저장소 Settings → Pages → Source: **GitHub Actions**를 한 번 켜야 동작합니다.
- 네이티브 iOS 앱(App Store)은 만들지 않습니다(사용자 결정: PWA로 제공).

## Android (APK)
준비물: JDK 17, Android SDK(platform 34). 자세한 내용과 서명 키 관리는 [docs/RELEASE.md](docs/RELEASE.md).
```sh
npx cap sync android                                  # public/ → android 에셋 복사
cd android && gradlew.bat assembleDebug               # app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
npm run release -- --dry-run                          # 서명된 릴리스 빌드만 확인
npm run release                                       # 태그 + GitHub Release에 dist/defense-game.apk 업로드
```
앱은 GitHub Releases에서 새 버전을 확인·다운로드하고, 전투가 끝난 안전한 순간(정비 화면·층 사이·일시정지)에 설치를 제안합니다. 처음 설치할 때 '출처를 알 수 없는 앱 설치'를 허용해야 합니다.
안드로이드 뒤로가기: 시트·창 닫기 → 도전 중이면 일시정지 메뉴 → 정비·타이틀에서는 두 번 눌러 종료.

## 브라우저에서 실행 (개발)
```sh
npm install
npm start          # http://localhost:8080  (PORT 환경 변수로 변경)
```
디버그 파라미터(브라우저 전용, 저장에 반영됨): `?spells=fireball:3,tornado`(도전·층 시작마다 스킬 지급, Lv1~5), `?herolv=N`(영웅 레벨), `?gems=N`(보석), `?best=N`(최고 기록 — 클래스·3배속 해금), `?loot=legend`(해당 등급 장비 드롭, `all` = 등급별 1개).
콘솔: `__wd.game`, `__wd.data`, `__wd.mode`('title'|'camp'|'run'|'result'), `__wd.frame(ms)`(창이 가려져도 프레임 진행), `__wd.loot('epic')`.

## 구조
```
server.js              개발용 정적 서버 (node 내장 모듈만)
public/index.html      화면 뼈대 + PWA 메타(manifest.webmanifest · sw.js · version.json)
public/js/main.js      부팅, 화면 흐름(타이틀 → 이어하기/정비 → 도전 → 결과), 게임 루프(고정 1/60 스텝 × 배속, 히트스톱), 저장·업데이트 배선
public/js/run.js       메타(영구) ↔ 도전(런): 새 도전·이어하기·정산·영구 강화·정비 화면 조작
public/js/sim.js       순수 시뮬레이션 (DOM 없음, node에서 실행 가능) · spells.js 스킬/융합 · hero.js 영웅·장비·필드 AI · talents.js 특성 트리
public/js/config.js    수치·공식 · stages.js 스테이지/적/보스 · bot.js 자동 강화/AI 동료/봇 정책
public/js/render.js    캔버스 렌더러 → js/art/ core · units · world · fx · hud · emblems
public/js/ui.js        DOM HUD·패널·모달·카드·결과·이어하기·백업 · camp.js 정비 화면 · heroui.js/talentui.js 영웅·특성 화면
public/js/save.js      저장(v2)·마이그레이션·백업 코드·방치 보상 · audio.js 효과음
public/js/updater.js   APK 자동 업데이트(네이티브 전용) · pwa.js 웹/PWA 업데이트·서비스 워커(웹 전용)
android/               Capacitor Android 프로젝트 + 업데이트 네이티브 플러그인
landing/               랜딩 페이지(GitHub Pages 루트)
docs/                  DESIGN.md 기획·설계 · ART.md 아트 디렉션·모듈 계약 · RELEASE.md 릴리스 절차
test/                  sim.test.js(스모크 + 로그라이트 캠페인 밸런스) · save.test.js(저장 v2·마이그레이션·백업 코드)
```

## 테스트
```sh
npm test                       # 단위 + 캠페인 1회 + 클래스 동등성 (약 2~3분)
node test/sim.test.js --full   # 캠페인 3시드 + 동등성 2구간
```

## 로드맵
- 협동 모드 (방 코드로 친구가 AI 동료 자리에 입장) — 예정
- 장비 강화 — 추후 검토

---

## English

**Wall Defense: Break 100 Floors** — a magic-fantasy wall-defense roguelite. Two spell-casting mages on the wall (you and an AI partner) and a class-based field hero (knight/ranger/sorcerer/cleric/assassin) that roams, kites, retreats and ults on its own. Each run starts at floor 1 and ends when the wall falls; between runs you spend gems on permanent upgrades, allocate hero talents (3 branches × 6 nodes per class), pick starting spells and gear, then try again. Mid-run skill cards (14 spells, 8 hidden fusions), a 22-entry codex, offline rewards, and save backup codes to move between devices.

- Android: self-updating APK (GitHub Releases). iPhone: installable PWA at `https://seobuk.github.io/defense-game/play/` (Safari → Share → Add to Home Screen), works offline and auto-updates on safe screens.
- Run in a browser: `npm install && npm start` → http://localhost:8080 · Tests: `npm test`
- Plain ES modules + Canvas 2D, no frameworks, no bundler.

## License

MIT

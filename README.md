# 벽 지키기: 100층 돌파

몰려오는 몬스터를 마법으로 쓸어 담고, 골드로 강화해서 100층까지 밀어붙이는 마법 판타지 성벽 디펜스 + 방치형 게임입니다.
성벽 위 마법사 2명 — 왼쪽이 나(대마법사), 오른쪽이 AI 동료 마법사. 시전·조준은 전부 자동이고, 플레이어는 강화 버튼·스킬 카드·비상 마법만 누르면 됩니다. 전장에는 내가 고른 클래스의 영웅이 직접 들어가 싸웁니다.

## 특징
- **로그라이트 도전** — 1층부터 성벽이 무너질 때까지 올라간다. 무너지면 도전 끝 → 결과 → 정비(영웅 클래스·장비, 시작 스킬, 보석 영구 강화) → 다시 1층부터. 매 도전마다 어떤 영웅과 어떤 스킬을 조합할지 고르는 재미. 도전 중 앱을 꺼도 그 층 시작부터 이어하기.
- **마법 성벽 디펜스** — 두 마법사가 빛나는 마력 구체(매직 미사일)를 쏟아붓는다. 강화: 마력 · 시전 속도 · 치명타 · 다중 시전 · 성벽 결계.
- **판타지 스킬 카드** — 층마다 마나가 차면(처치 60%, 네임드 보스 등장 시 +1) 전투가 멈추고 카드 3장 중 1장 선택. 7원소 14종, 슬롯 6칸 · Lv5까지, 일반/희귀/전설. 빌드는 도전 전체에 누적되고, 다 차면 각성 카드. 자동 강화 중엔 3초 뒤 자동 선택.
- **원소 융합 (히든)** — 특정 두 원소를 함께 가지면 불꽃 회오리·초전도·증기 폭발 등 8종 융합으로 진화. 조건은 비밀, 발견하면 컷인과 함께 도감 등록.
- **도감 22칸** — 히든 조합 14종 + 원소 융합 8종.
- **영웅 성장 · 장비** — 기사·궁수·마법사·성직자(20층)·암살자(40층) 중 클래스를 골라 전장에 투입. 자동 전투, 전장을 탭하면 그 자리로 이동, 궁극기 버튼. 레벨·티어(견습→전설)는 영구, 레벨 마일스톤으로 카드 새로고침(Lv5)·카드 4장(Lv15)·시작 카드(Lv30)·전설 확률(Lv50). 장비 5부위 × 5등급 드롭(빛기둥), 가방 30칸, 비교·장착·판매·자동 장착·등급별 일괄 판매, 전투력 표시.
- **100층 · 5개 테마** — 슬라임 초원 → 고블린 동굴 → 언데드 묘지 → 화산 용암지대 → 심연의 마왕성. 10층마다 네임드 보스(킹 슬라임, 고블린 전차, 리치 로드, 마그마 골렘, 심연의 마왕, 종말의 드래곤).
- **자동 강화** — 토글 하나로 골드를 가장 효율 좋은 업그레이드에 알아서 투자. 버튼을 누르고 있으면 연타 구매.
- **학살 가속 · 광폭화** — 필드가 비면 다음 무리를 바로 당겨 압도적인 층은 15~25초에 지나가고, 80초를 넘기면 적이 광폭화해 버티기 교착은 없다.
- **콤보 · 광란** — 연속 처치 콤보(10/30/50/100 단계마다 골드 배율 상승), 2초 안 20킬이면 5초간 시전 속도 2배.
- **히든 조합** — 조건은 비밀. 업그레이드 레벨·스킬 타이밍·이벤트가 맞아떨어지면 컷인과 함께 발견되고 도감에 기록됩니다.
- **피격 손맛** — 히트스톱, 흰 번쩍임, 찌그러짐, 화면 흔들림, 동전 분수, 형형색색 데미지 숫자(전체/간소/끄기).
- **영구 강화** — 도전이 끝나면 도달 층·보스·첫 돌파·신기록에 비례한 보석. 기본 마력·시전 속도·성벽 결계·골드·시작 골드·영웅 경험치·카드 선택지·새로고침·시작 스킬 슬롯·부활 결계·치명타 폭발·황금 곡괭이(방치 보석·경험치, 최대 8시간).
- **비상 스킬** — 운석 낙하, 빙결. 1·2·3배속(3배속은 20층 클리어 후).
- **APK 자동 업데이트** — 앱이 GitHub Releases에서 새 버전을 확인·다운로드하고, 전투가 끝난 안전한 순간에 설치를 제안합니다.

## 브라우저에서 실행 (개발)
```sh
npm install
npm start          # http://localhost:8080  (PORT 환경 변수로 변경)
```
디버그 파라미터(브라우저 전용, 저장에 반영됨): `?stage=N` 시작 층, `?gold=N` 골드, `?lv=N`(모든 강화 레벨) 또는 `?lv=atk:25,multi:0`(지정 레벨),
`?spells=fireball:3,tornado`(스테이지 시작마다 스킬 지급, 레벨 생략 = 1), `?herolv=N`(영웅 레벨), `?loot=legend`(해당 등급 장비 드롭, `all` = 등급별 1개).
콘솔에서는 `__wd.game`, `__wd.data`, `__wd.frame(ms)`, `__wd.loot('epic')`으로 상태를 보거나 조작할 수 있습니다.
캠페인 밸런스 러너(새 저장 → 도전 반복 → 100층): `npm test`는 시드 1, `node test/sim.test.js --full`은 3시드 + 클래스 동등성 2구간.

## APK 빌드 · 설치 · 릴리스
준비물: JDK 17, Android SDK(platform 34). 자세한 내용과 서명 키 관리는 [docs/RELEASE.md](docs/RELEASE.md).
```sh
npx cap sync android                                  # public/ → android 에셋 복사
cd android && gradlew.bat assembleDebug               # app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
npm run release -- --dry-run                          # 서명된 릴리스 빌드만 확인
npm run release                                       # 태그 + GitHub Release에 dist/defense-game.apk 업로드
```
최신 APK: https://github.com/Seobuk/defense-game/releases/latest/download/defense-game.apk
(처음 설치할 때 '출처를 알 수 없는 앱 설치'를 허용해야 합니다.)

## 구조
```
server.js              개발용 정적 서버 (node 내장 모듈만)
public/index.html      화면 뼈대 · style.css
public/js/main.js      부팅, 게임 루프(고정 1/60 스텝 × 배속, 히트스톱), 저장·업데이트 배선
public/js/sim.js       순수 시뮬레이션 (DOM 없음, node에서 실행 가능) · run.js 메타(영구) ↔ 도전(런) 연결: 새 도전·이어하기·정산·영구 강화
public/js/config.js    수치·공식 · stages.js 스테이지/적/보스 · bot.js 자동 강화/AI 동료
public/js/render.js    캔버스 렌더러(층 순서·이벤트 분배) → js/art/ core · units(적·보스·영웅·마법사) · world(배경·성벽·드롭) · fx(이펙트·마법탄·데미지 숫자) · hud(보스바·콤보·컷인·조합 줄) · emblems(스킬·조합·퍼크 그린 엠블럼)
public/css/           fonts.css(번들 글꼴) · kit.css(UI 키트)  ·  public/assets/ fonts · icons(SVG, js/icons.js)
public/js/spells.js    판타지 스킬 14종 · 원소 융합 8종 효과 · hero.js 영웅 클래스/성장/장비(순수 함수)
public/js/ui.js        DOM HUD·패널·모달·카드 선택 · heroui.js 영웅/장비 화면(hero.css) · save.js 저장/방치 보상 · audio.js WebAudio 효과음
public/js/updater.js   APK 자동 업데이트 (네이티브에서만 동작)
android/               Capacitor Android 프로젝트 + 업데이트 네이티브 플러그인
docs/DESIGN.md         기획·기술 설계 · docs/ART.md 아트 디렉션·모듈 계약 · docs/RELEASE.md 릴리스 절차
test/                  sim.test.js(스모크 + 로그라이트 캠페인 밸런스, harness.js 봇 러너), save.test.js(저장 v2·마이그레이션)
```

## 테스트
```sh
npm test
```

## 로드맵
- 협동 모드 (방 코드로 친구가 AI 동료 자리에 입장) — 예정
- 장비 강화 — 추후 검토
- 랜딩 페이지 (GitHub Pages)

---

## English

**Wall Defense: Break 100 Floors** — a casual magic-fantasy wall defense / idle game. Two auto-casting mages on a wall (you on the left, an AI partner on the right) blast monster waves with glowing magic missiles; spend gold on upgrades (or toggle auto-upgrade) and push through 100 stages across 5 themes with named bosses every 10 floors. Mid-stage fantasy skill cards (14 spells in 7 elements, stage-scoped builds), 8 hidden elemental fusions, a 22-entry codex, a class-based field hero (knight/ranger/sorcerer/cleric/assassin) with permanent levels and 5-slot gear drops, combos and frenzy, punchy hit effects, gem perks, offline rewards, and a self-updating Android APK (GitHub Releases).

- Run in a browser: `npm install && npm start` → http://localhost:8080
- Tests: `npm test`
- Android build/release: see [docs/RELEASE.md](docs/RELEASE.md) (`npx cap sync android`, `gradlew assembleDebug`, `npm run release`)
- Plain ES modules + Canvas 2D, no frameworks, no bundler. Online co-op is planned.

## License

MIT

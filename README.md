# 대마법사의 용사 키우기

마법 판타지 성벽 디펜스 **로그라이트**. 성벽 위 대마법사(나)가 **고른 스킬**을 쏟아붓고, 내가 고른 클래스의 영웅이 전장 한가운데서 싸웁니다.
성벽이 무너지면 도전 끝 → 결과 → 정비(마법사 수련·영웅·특성·장비·시작 스킬·보석 강화) → 다시 1층부터. 매 도전마다 어떤 영웅과 어떤 스킬을 엮어 **협공**을 만들지가 핵심입니다.

- **Android**: APK 설치(앱이 스스로 업데이트) — https://github.com/Seobuk/defense-game/releases/latest/download/defense-game.apk
- **iPhone**: Safari로 https://seobuk.github.io/defense-game/play/ 접속 → 공유 → **홈 화면에 추가** (웹앱, 오프라인·자동 업데이트)

## 게임 흐름
1. **타이틀** — 진행 중인 도전이 있으면 **이어하기**(그 층 시작부터) 또는 **포기하고 정산하기**.
2. **정비 화면** — 출정(영웅 클래스 · 장비 · 시작 스킬) · **수련**(골드로 마법사 기본기 5종: 마력·시전 속도·치명타·다중 시전·성벽 결계) · 특성(클래스별 3갈래 × 6단 트리 — 단은 그 갈래에 쓴 포인트로 열리고, 택1·핵심·혼합 노드, 궁극 특성은 클래스당 하나만. 최대 레벨에서 한 갈래 마스터 + 나머지 절반씩, 무료 초기화, 추천 자동 배분) · **상점**(장비 상자 · 보석 강화 · 유물 해금) · 도감(히든 조합 · 원소 융합 · 협공). 출정 탭의 **출정 준비**(이번 도전 한 번 쓰는 소모품), 수련·보석 강화는 만렙 뒤 끝없는 **돌파**. 정비 화면에서 판 장비 골드는 바로 보유 골드로.
   **도전 시작**(1층부터) 또는 **같은 조합**(지난 도전의 영웅·시작 스킬).
3. **도전** — 시작하자마자 무료 카드 1장, 1~5층은 층마다 2장, 이후 층마다 1장 + 네임드 보스 1장. 고른 스킬은 **전투 화면 오른쪽에 세로로 쌓입니다**(6칸 · Lv 점 6개 · 쿨타임 고리, 만렙 Lv6 = 금테 MAX). 6칸이 차면 강화만, 더 강화할 것도 합칠 것도 없으면 각성 카드. 융합 재료 두 스킬을 **둘 다 Lv6까지 찍으면 융합 스킬 Lv1로 합체**해 칸이 열립니다('슬롯 해제!' — 예: 파이어볼 6 + 회오리 6 → 불꽃 회오리 1). 도감에 오른 융합은 재료 두 칸이 금빛 선으로 이어지고, 칸을 누르면 진행도(파이어볼 6/6 · 회오리 3/6)가 보입니다. 카드에 ✦ '이걸 찍으면 융합!'이 뜨면 그 카드로 합체가 완성됩니다. 도전 중엔 골드로 강화하지 않습니다 — 번 골드는 영구 재화로 정비에서 씁니다. 하단 패널: 비상 스킬(운석·빙결) · 영웅 궁극기 · 배속 · **자동 진행**.
   **카드는 늘 직접 고릅니다** — 카드가 뜨면 전투가 멈추고 내가 고를 때까지 기다립니다(카운트다운 없음, 이어하기로 돌아와도 같음). 하단의 **자동 진행**(새 저장 기본 ON)은 층을 깨면 다음 층 자동 시작 + 영웅 궁극기·비상 스킬(운석·빙결) 자동 사용을 맡습니다(끄면 '다음 층' 버튼 · 궁극기·운석·빙결 버튼). 귀찮으면 카드 화면 아래의 **자동 선택** 토글(기본 OFF, 설정 화면에도 '카드 자동 선택')을 켜세요 — 추천 카드 테두리가 2초 동안 금빛으로 차오른 뒤 자동으로 골라지고, 그 사이 탭하면 직접 고른 카드가 우선입니다. 두 토글은 서로 별개이고 카드 선택 중에도 바로 반영됩니다.
   **후반 전략**: Lv6이 된 스킬·융합 스킬은 다음 카드에서 **변이** 두 갈래 중 하나(작동 방식이 바뀜 — 예: 파이어볼 → 분열 화염구 / 태양 구체)를 고르고, 10층마다 네임드 보스를 잡으면 **유물 3개 중 1개**(규칙을 바꾸는 장점 ▲ + 대가 ▼), 카드 화면의 **비우기**(도전당 2회)로 스킬을 버리고 칸을 엽니다. 지역마다 적의 **원소 약점·내성**과 규칙이 하나씩 있어(초원 들불 · 동굴 어둠 · 묘지 망자 · 화산 열기 · 심연 광기) 카드에 '약점!' 배지가 붙습니다. 각성 카드는 강화·변이·빈 칸이 다 끝났을 때만.
4. **성벽 붕괴(또는 100층 돌파)** — 즉시 정산·저장 → **결과 화면**(도달 층, 신기록, 보스, 획득 골드·보유 골드, 이번 도전의 조합, 피해 비중, 보석 내역, 새 영웅 해금) → 정비 화면.

## 특징
- **마법사 = 스킬을 고르는 존재** — 기본 주문(화염구)은 약한 견제, 화력의 대부분은 고른 스킬. 기본기는 정비의 마법사 수련(골드)으로 조금씩.
- **판타지 스킬 카드 14종 · 원소 융합 8종(히든)** — 6칸 빌드는 도전 전체에 누적(Lv1~6), 융합은 재료 두 스킬을 모두 만렙까지 키우면 합체해 모양이 다른 전용 시전으로(Lv1부터 다시 Lv6까지 — 재료 둘은 만렙 그대로 계속 발동). 한 도전에 보통 2~4번 합체. 발견하면 컷인과 함께 도감 등록.
- **이펙트가 레벨과 함께 자란다** — Lv1은 작고 소박하게, 레벨마다 크기·입자·색 레이어가 늘고, Lv6은 스킬마다 고유한 완전체 연출(하늘까지 닿는 화염 기둥, 망령의 문과 유령 행렬 등) + MAX! 각성. 화면 전체 광량 예산으로 빛이 겹쳐도 적·영웅·숫자가 하얗게 묻히지 않습니다.
- **성벽 위 대마법사는 나 한 명** — 성벽 중앙에서 시전, 영웅 성문은 그 옆. (2인 협동 모드는 나중에 — 코드 자리는 남겨 둠)
- **영웅 × 마법사 협공 15종(히든)** — 영웅 클래스(·특성 갈래) × 보유 스킬로 켜지는 연계(모루와 망치·뇌전 화살·쌍화염 등). 켜지면 영웅 초상 ↔ 스킬 아이콘 빛줄기, 도감 '협공' 탭. 영웅 궁극기 3초 안의 첫 스킬은 **합동 필살**(위력 ×2 + 슬로 모션), 단일 대상 스킬은 영웅이 싸우는 적을 **지원 사격**.
- **영웅 5클래스** — 기사·궁수·마법사, 성직자(20층)·암살자(40층) 해금. 전장을 스스로 누비며 가장 위험한 적을 공격(근접 돌격 · 원거리 카이팅 · 체력 30% 후퇴 → 재진격), 탭하면 그 자리로 이동, 궁극기 버튼. 특성 트리 궁극 특성 15종(늑대 무리·그림자 분신·절대영도·천벌 기둥 등) · 전투 방식을 바꾸는 핵심 노드 15종(반격의 방패·비전 쇄도·천벌 연타 등).
- **영구 성장** — 영웅 레벨·장비(5부위 × 5등급)·특성, 골드 마법사 수련 5종, 보석 강화 9종(골드 획득·영웅 경험치·카드 선택지·새로고침·시작 스킬 슬롯·부활 결계·치명타 폭발·각성 숙련·황금 곡괭이).
- **전선** — 적은 전장 가운데(y 380~700)까지 몰려와 영웅 주변에서 마법에 녹습니다. 학살 가속(압도적인 층 20~30초) · 광폭화(80초 초과, 교착 없음).
- **폴더블·넓은 화면** — 갤럭시 Z 폴드 안쪽(거의 정사각형)·바깥(21:9 이상) 화면 모두 잘림·검은 띠 없이 꽉 차게. 넓으면 배경·성벽이 양옆으로 이어지고 스킬 스택·영웅 카드가 옆 여백으로 빠집니다. 접기·펼치기·회전에도 재시작 없이 바로 재배치(Android `resizeableActivity` · `configChanges`, 폰은 세로 고정 · 600dp 이상은 자유 회전).
- **변이 44종 · 유물 20종 · 망각 · 지역 특성 5곳** — 스킬을 다 찍은 뒤에도 카드마다 빌드가 굴러가는 방식이 바뀝니다. 유물은 상점에서 보석으로 도감에 더 풀 수 있습니다(시작 8종).
- **재화가 쌓이지 않게** — 수련·보석 강화 만렙 뒤 끝없는 돌파, 장비 상자(골드·보석), 도전마다 사는 출정 준비(시작 카드 +1 · 첫 층 희귀 카드 · 보스 결계석 · 망각의 물약), 유물 해금.
- **손맛** — 히트스톱, 콤보·광란(진행 바 아래 작은 상태 알약 — 단계가 오를 때만 0.8초 크게), 동전 분수, 데미지 숫자(전체/간소/끄기), 배속은 처음엔 1배 → 최고 10층 돌파 2배 → 30층 돌파 3배 해금.
- **방치 보상** — 앱을 떠나 있던 시간(최대 8시간)만큼 보석 + 골드 + 영웅 경험치.
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
디버그 파라미터(브라우저 전용, 저장에 반영됨): `?spells=fireball:3,tornado`(도전·층 시작마다 스킬 지급, Lv1~6), `?herolv=N`(영웅 레벨), `?gems=N`(보석), `?best=N`(최고 기록 — 클래스·배속 해금), `?loot=legend`(해당 등급 장비 드롭, `all` = 등급별 1개).
콘솔: `__wd.game`, `__wd.data`, `__wd.mode`('title'|'camp'|'run'|'result'), `__wd.frame(ms)`(창이 가려져도 프레임 진행), `__wd.loot('epic')`.

## 구조
```
server.js              개발용 정적 서버 (node 내장 모듈만)
public/index.html      화면 뼈대 + PWA 메타(manifest.webmanifest · sw.js · version.json)
public/js/main.js      부팅, 화면 흐름(타이틀 → 이어하기/정비 → 도전 → 결과), 게임 루프(고정 1/60 스텝 × 배속, 히트스톱), 저장·업데이트 배선
public/js/run.js       메타(영구) ↔ 도전(런): 새 도전·이어하기·정산·마법사 수련·보석 강화·정비 화면 조작
public/js/sim.js       순수 시뮬레이션 (DOM 없음, node에서 실행 가능) · spells.js 스킬/융합 · hero.js 영웅·장비·필드 AI · talents.js 특성 트리
public/js/config.js    수치·공식(스킬·융합·협공·수련) · stages.js 스테이지/적/보스 · bot.js 자동 진행/봇 정책
public/js/render.js    캔버스 렌더러 → js/art/ core · units · world · fx · hud · emblems
public/js/ui.js        DOM HUD(스킬 스택·영웅 카드·협공 빛줄기)·패널·모달·카드·결과·이어하기·백업 · camp.js 정비 화면 · heroui.js/talentui.js 영웅·특성 화면
public/js/save.js      저장(v3)·마이그레이션(v1·v2 → v3, 손해 없이)·백업 코드·방치 보상 · audio.js 효과음
public/js/shop.js      재화 사용처(수련·보석 돌파 · 장비 상자 · 출정 준비 · 방치 골드) · shopui.js 정비 화면 상점 탭·출정 준비 카드·상자 개봉
public/js/mutations.js 변이 44종(규칙·시전) · mutui.js 카드·칸 · art/mutfx.js 연출
public/js/relics.js    유물 20종 · 망각 · relicui.js 유물 3택·유물 줄·비우기 시트 · art/relicart.js 메달
public/js/dungeons.js  지역 특성(DUNGEON_TRAITS — 약점·내성·규칙) · dungeonui.js 배너·칩·배지 · art/dungeonfx.js
public/js/updater.js   APK 자동 업데이트(네이티브 전용) · pwa.js 웹/PWA 업데이트·서비스 워커(웹 전용)
android/               Capacitor Android 프로젝트 + 업데이트 네이티브 플러그인
landing/               랜딩 페이지(GitHub Pages 루트)
docs/                  DESIGN.md 기획·설계 · ART.md 아트 디렉션·모듈 계약 · RELEASE.md 릴리스 절차
test/                  sim.test.js(스모크 + 초반 템포 + 캠페인 밸런스(상점까지 쓰는 봇) + 협공 강도·클래스 동등성) · save.test.js(저장 v3·마이그레이션·백업 코드·배속 해금) · talents · dungeons · relics · shop · mutations 테스트 · economy.js(재화 지표)
```

## 테스트
```sh
npm test                       # 단위 + 초반 템포 + 캠페인 3시드 + 협공·클래스 동등성 (약 2~3분)
node test/sim.test.js --full   # 캠페인 6시드 + 동등성 2구간 + 무작위 특성
```

## 로드맵
- 협동 모드 (방 코드로 친구가 두 번째 마법사로 입장) — 예정
- 장비 강화 — 추후 검토

---

## English

**The Archmage's Hero** — a magic-fantasy wall-defense roguelite. You, the archmage on the wall, cast the skills you pick, while a class-based field hero (knight/ranger/sorcerer/cleric/assassin) fights mid-field on its own. Each run starts at floor 1 and ends when the wall falls. Picked skills stack on the right edge (6 slots, Lv1-6); maxing both ingredients of a fusion (Lv6 + Lv6) merges them into a Lv1 fusion skill (one of 8) and frees a slot. Card picks always pause the fight until you choose (an opt-in "auto pick" toggle on the pick screen picks the suggested card after 2 s); the separate "Auto" toggle starts the next floor and auto-casts the hero ult and the meteor/freeze emergency skills. Late-game strategy: Lv6 skills mutate into one of two behaviours (44 mutations), named bosses every 10 floors offer 1 of 3 rule-bending relics (20), a per-run "forget" frees a slot, and each region has elemental weaknesses/resistances plus one rule. Gold and gems always have a sink (endless training breaks, gear boxes, per-run prep consumables, relic unlocks). Game speed unlocks at best floor 10 (2x) and 30 (3x). Hidden hero × mage collabs (15), a linked finisher after the hero's ult, and support fire. Between runs: gold-based mage training, gem utility upgrades, hero talents, starting spells and gear. Foldable/wide screens fill edge to edge and relayout live on fold/unfold.

- Android: self-updating APK (GitHub Releases). iPhone: installable PWA at `https://seobuk.github.io/defense-game/play/` (Safari → Share → Add to Home Screen), works offline and auto-updates on safe screens.
- Run in a browser: `npm install && npm start` → http://localhost:8080 · Tests: `npm test`
- Plain ES modules + Canvas 2D, no frameworks, no bundler.

## License

MIT

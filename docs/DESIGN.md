# 《벽 지키기: 100층 돌파》 설계 문서

캐주얼 웨이브 디펜스 + 방치형 성장. 웹 기술(바닐라 JS)로 만들고 **Android APK**로 배포, 앱이 스스로 업데이트.

> ## ⚠️ 최신 사용자 결정 — 이 문서·프롬프트의 모든 '대포/기사' 표현보다 우선
> 사용자: "실망이야, 너무 단순해. 발사체가 마법이어야지." → 게임 전체를 **마법 판타지**로 재구성한다.
> - **대포 없음.** 성벽 위에는 **마법사 2명**이 서서 마법을 쏜다: P1 = 영웅 대마법사(나, 왼쪽, 금빛·화염 계열 비전 마법), P2 = AI 동료 마법사(오른쪽, 청록·냉기 계열). 코드의 `players[i]` / `CANNONS` 좌표는 그대로 '시전 위치'로 쓴다(시뮬·밸런스 변경 불필요).
> - **기본 공격 = 마법 탄(매직 미사일)**: 빛나는 마력 구체 + 가산 합성 글로우 + 파티클 꼬리 + 반짝이, 시전 시 마법진(룬 서클)과 지팡이 섬광. 명중 시 마력 폭발(룬 플래시, 파편 스파크). 다중 발사 = 마법 미사일 부채꼴 다중 시전. 치명타 = 별빛 폭발. 핀·막대·총알처럼 보이면 실패.
> - **업그레이드 이름(UI)**: 공격력 → **마력**, 공격속도 → **시전 속도**, 치명타 확률 → **치명타**, 다중 발사 → **다중 시전**, 성벽 내구도 → **성벽 결계**(성벽에 룬 방어막). 키(`atk/rate/crit/multi/wall`)는 그대로.
> - **성벽 위 마법사 2명** = P1(나의 성벽 마법사, 업그레이드 대상) + P2(AI 동료 마법사). 성벽 마법사 외형은 업그레이드 레벨(특히 다중 시전·마력)에 따라 화려해진다.
> - **영웅 = 클래스 선택형 필드 유닛 (최신 사용자 요청: "영웅은 클래스 골라서 맵에 들어가서 싸우게")**. 영웅은 성벽 위가 아니라 **전장(맵)에 직접 들어가 몬스터와 싸운다**(킹덤 러시식 영웅).
>   - **클래스 5종**: 기사(근접 탱커, 도발로 적을 붙잡음 / 궁극기: 성스러운 방패 — 무적 + 주변 기절), 궁수(원거리 속사, 관통 화살 / 궁극기: 화살비), 마법사(원거리 광역 / 궁극기: 블리자드), 성직자(근접·신성 광역, 성벽·영웅 회복 / 궁극기: 천상의 치유), 암살자(순간이동 연속 베기, 치명타·보스 특화 / 궁극기: 그림자 난무). 처음엔 기사·궁수·마법사, **성직자는 20층·암살자는 40층 클리어 시 해금**.
>   - 처음 시작 시 멋진 **클래스 선택 화면**. 클래스 변경은 스테이지 사이에 자유(레벨·장비는 공유).
>   - **조작**: 기본은 자동(가장 위험한 곳으로 이동해 싸움). 전장을 **탭하면 그 위치로 이동**(이동 마커 표시), 몇 초 뒤 자동 복귀. 하단에 **영웅 궁극기 버튼**(쿨타임), 자동 강화 ON이면 궁극기 자동 사용.
>   - 영웅 HP가 0이 되면 쓰러지고 일정 시간 뒤 성문에서 부활(게임오버 아님). 스테이지 시작 시 성문에서 걸어 나감.
>   - **성장**: 영웅 레벨·경험치는 영구(티어: 견습 → 숙련 → 정예 → 영웅 → 전설, 클래스별 칭호), 레벨 마일스톤은 카드 시스템과 연계(기존 설계 유지) + 클래스 스킬 강화. 장비 5부위 키 `weapon/helm/armor/trinket/cape`(무기/머리/갑옷/장신구/망토) — **아이템 이름·아이콘·외형은 클래스에 맞게**(기사=검, 궁수=활, 마법사=지팡이, 성직자=철퇴, 암살자=단검). 장비가 영웅 외형에 보임.
>   - 영웅 기여도는 전체 화력의 약 20~35% + 적을 붙잡는 가치. 밸런스 목표 유지.
> - 비상 버튼(운석 낙하·빙결)과 판타지 스킬 카드는 원래 마법이므로 그대로, 더 화려하게.
> - 전체 톤: "너무 단순해"가 핵심 불만. 모든 화면에 마법 판타지다운 풍부한 디테일(룬, 마력 입자, 빛, 마법진)을 넣는다.

> **범위 결정 (사용자)**: 1차 출시는 **싱글 플레이만**. 협동(온라인 2인)은 추후 지원. 대포 2문 구조와 AI 동료는 유지해서 나중에 AI 자리를 친구로 바꾸기만 하면 되게 둔다. 아래 '협동 네트워크' 절은 추후 참고용.

## 1. 게임 기획 (원안 정리)

- **장르**: 캐주얼 원터치 웨이브 디펜스 + 방치형 성장, **2인 협동**(성벽 위 대포 2문)
- **한 줄 요약**: 몰려오는 몬스터를 자동 공격으로 쓸어 담고, 골드로 수치를 올려 100스테이지까지 밀어붙인다.
- **조작 피로도 제로**: 공격·타겟팅 100% 자동. 플레이어는 레벨업 버튼 연타(또는 자동 강화)와 위기 시 비상 버튼만 누른다.
- **대포 2문**: 성벽 위 P1(왼쪽, 나)과 P2(오른쪽, AI 동료). *(추후 협동: 방 코드로 친구가 들어오면 AI 자리를 대체)*

### 핵심 루프 (3초 룰)
- 스테이지당 **1~2분**, 적 **30~50마리** 러시 (원안의 "12분", "3050마리"는 물결표 누락으로 보고 1~2분, 30~50마리로 해석).
- 적이 터질 때마다 동전이 쏟아져 골드 카운터로 날아감. 처치 골드는 **두 플레이어 모두** 전액 획득(공유 수입, 지갑은 개별).
- 전투 중 하단 UI로 실시간 레벨업. 버튼을 누르고 있으면 연타(가속 반복).
- 매 스테이지 마지막에 보스(엘리트) 등장, 10의 배수 스테이지는 구간 네임드 보스. 모든 적 처치 → 별 1~3개 연출 → 자동 진입 켜져 있으면 다음 스테이지 즉시 시작.

### 인게임 업그레이드 (골드, 스테이지 간 유지)
| 키 | 이름 | 효과 |
|---|---|---|
| `atk` | 공격력 | 탄환 데미지 상승 |
| `rate` | 공격속도 | 발사 간격 단축, 최대 초당 15발 (도달 시 MAX) |
| `crit` | 치명타 확률 | 5% + 레벨당 상승, 최대 80%. 치명타 배율 2.5배 고정 |
| `multi` | 다중 발사 | 레벨 0~5: 1 → 3 → 5 → 7 → 9 → 12발(전방 부채꼴 약 170°) |
| `wall` | 성벽 내구도 | 공유 성벽 최대 체력 증가 (두 플레이어의 wall 레벨 합으로 계산) |

- **자동 강화**(사용자 요청 추가): 토글을 켜면 내 골드로 가장 효율 좋은 업그레이드를 자동 구매. AI 동료와 같은 로직 사용.
- 골드와 업그레이드 레벨은 스테이지 간 유지(방치형). 패배해도 번 골드는 유지 → 재도전 시 더 강해짐.

### 영구 성장 (보석, 스테이지 클리어 보상)
| 키 | 이름 | 효과 |
|---|---|---|
| `pickaxe` | 황금 곡괭이 | 오프라인(방치) 골드 보상 증가. 최대 8시간 누적 |
| `critBoom` | 치명타 폭발 | 치명타 시 주변 적에게 스플래시 데미지 |
| `startGold` | 시작 골드 | 새 스테이지 시작 시 골드 지급 |

### 100스테이지 구성 (20스테이지 × 5테마, 10층마다 네임드 보스)
| 구간 | 테마 | 잡몹 특징 | 네임드 보스 |
|---|---|---|---|
| 1~20 | 슬라임 초원 | 느리고 약한 잡몹 대량 (학살 쾌감) | 10·20: 자이언트 킹 슬라임 (죽으면 분열) |
| 21~40 | 고블린 동굴 | 빠른 돌진형 | 30·40: 돌격 고블린 전차 (돌진 후 후퇴 반복, 밀어붙이기) |
| 41~60 | 언데드 묘지 | 원거리 투척병 + 단단한 해골 방패병 | 50·60: 리치 로드 (아군 보호막 + 소환) |
| 61~80 | 화산 용암지대 | 죽을 때 폭발하는 자폭병 | 70·80: 마그마 골렘 (범위 충격파) |
| 81~100 | 심연의 마왕성 | 모든 기믹 종합 + 초고밀도 | 90: 심연의 마왕(기믹 종합), 100: 종말의 드래곤 |

- 10스테이지 단위 첫 클리어 시 큰 보석 보상.
- 100층 클리어 시 엔딩 연출. 이후 100층 반복 플레이(파밍) 가능.

### 편의 & 연출
- 배속: 1배/2배 기본, 20스테이지 클리어 시 3배 해금. 협동 중에는 호스트만 변경.
- 자동 진행: 켜두면 패배 전까지 멈춤 없이 다음 스테이지. 패배 시 자동 진행 정지 + 모달(재도전 / 이전 스테이지로).
- 비주얼: 팝콘처럼 터지는 타격 효과, 형형색색 데미지 숫자(설정: 전체/간소/끄기), 동전 분출, 보스 체력바, 화면 흔들림, 별 3개 연출.
- 비상 버튼(플레이어별 쿨타임): **운석 낙하**(일반 적 전멸, 보스는 최대 체력 일부 피해), **빙결**(5초간 적 전체 정지). 협동 시 둘의 쿨타임이 따로라 연계 가능.
- 효과음: WebAudio 합성(에셋 없음), 음소거 설정.
- 별: 클리어 시 성벽 체력 비율 ≥70% → 3개, ≥35% → 2개, 그 외 1개.

### 중독성 레이어 (피격 손맛 · 콤보 · 히든 조합)
사용자 추가 요청: "피격 이펙트가 진짜 중요, 중독성, 히든 조합 찾는 재미". 원안의 "복잡한 조합법 배제" 원칙은 지킨다. 조합은 **공부할 필요 없이 플레이하다 보면 저절로 터지는** 발견형이다.

- **피격 손맛**: 치명타·보스 타격 시 히트스톱(짧은 정지), 적 넉백+찌그러짐, 흰색 번쩍임, 큰 타격의 순간 색수차/플래시, 강한 화면 흔들림 계층화, 팝콘 파티클, 동전 분수.
- **연속 처치 콤보**: 1.5초 안에 이어지는 처치 수를 `COMBO x57` 식으로 크게 표시. 단계(10/30/50/100)마다 문구·색·효과음 상승, 골드 보너스 배율. 2초 안에 20킬 → **광란** 5초(발사속도 2배, 붉은 틴트).
- **히든 조합(시너지)**: 조건은 게임 안에서 알려주지 않는다. 충족하는 순간 히트스톱 + 컷인 배너 "히든 조합 발견! 〈이름〉" + 전용 사운드, 이후 해당 효과가 탄환 외형·동작으로 드러난다. **도감**에는 발견한 조합만 조건과 함께 공개되고, 나머지는 `???` + 모호한 힌트 한 줄.
  - 대포 단독 조합(업그레이드 레벨 조건) 예: 불꽃 산탄(다중+치명 → 화상), 관통탄(다중발사를 올리지 않고 공격력만 → 관통), 체인 라이트닝(치명+공속 → 치명타가 번개로 전이), 유도 미사일(다중 MAX), 요새화(성벽 특화 → 가시 반사).
  - **협동 조합**(두 대포 사이) 예: 빙하 운석(한쪽 빙결 직후 다른 쪽 운석 → 얼어붙은 적 산산조각, 보스 추가 피해), 쌍둥이 포화(두 대포 다중발사 레벨 동일 ≥3 → 교차 사격 강화), 황금비(두 공격력 레벨 정확히 일치 → 골드 보너스).
  - 이벤트 조합 예: 연쇄 폭발(자폭병 연쇄로 5킬 이상 → 골드 비), 무결점(성벽 100%로 클리어 → 보석 보너스).
  - 솔로에선 AI 동료가 협동 조합의 파트너 역할을 해서 혼자서도 발견 가능.
  - 발견 목록은 저장에 기록.

### 판타지 스킬 선택 (3장 중 1장) — 사용자 추가 요청
"잡다 보면 중간에 판타지 스킬 요소를 선택하게". 조작 피로도는 낮게: 카드 한 번 탭.
- **마나 게이지**: 처치로 차오르고, 스테이지 진행(처치 수 기준) 약 25%·55%·85% 지점에서 가득 참 → 전투 일시정지 + 판타지 카드 3장 등장 → 1장 선택. 네임드 보스 등장 시 추가 1장. 스테이지당 3~4장.
- **스테이지 한정 빌드**: 고른 스킬은 그 스테이지 동안만 유지, 다음 스테이지는 새로 시작 → 매 스테이지 다른 조합 실험(발견 재미). 같은 스킬을 또 고르면 Lv2 → Lv3(최대).
- **희귀도**: 일반/희귀/전설 (카드 테두리·빛·효과음 차등). 전설은 드물게.
- **스킬 풀 (7원소)**: 🔥화염(파이어볼 — 밀집 지점 주기 폭발, 불꽃 탄환 — 탄환 화상) · ⚡번개(낙뢰 — 무작위 적 주기 번개, 연쇄 번개 — 명중 시 확률 체인) · ❄️냉기(얼음 창 — 관통 창 주기 발사, 서리 결계 — 성벽 근처 적 둔화) · 🌪️바람(회오리 — 적을 밀어내는 토네이도, 질풍 — 공격속도 증가) · ✨신성(수호의 빛 — 성벽 재생, 심판 광선 — 주기적 세로 빔) · 🌑암흑(저주 낙인 — 받는 피해 증가, 영혼 수확 — 처치 시 골드·성벽 회복) · 🐉소환 전설(새끼 드래곤 — 따라다니며 브레스, 돌 골렘 — 성벽 앞 탱커).
- **원소 융합 = 히든 조합**: 특정 두 원소(또는 두 스킬)를 함께 가지면 융합 스킬로 진화하며 "히든 조합 발견!" 컷인 + 도감 등록. 예: 화염+바람 → 불꽃 회오리, 냉기+번개 → 초전도, 화염+냉기 → 증기 폭발, 번개+바람 → 폭풍의 눈, 신성+암흑 → 황혼, 화염+번개 → 플라즈마, 암흑+소환 → 망령 군단, 신성+소환 → 수호룡. 조건은 비공개, 도감엔 ??? + 힌트. 카드 중 미발견 융합을 완성시킬 카드엔 조건은 숨긴 채 은은한 ✦ 반짝임만(발견 유도).
- **자동**: 자동 강화가 켜져 있으면 카드가 뜬 뒤 3초 카운트다운 후 자동 선택(융합 완성 우선 휴리스틱). 꺼져 있으면 고를 때까지 정지.
- AI 동료는 카드를 고르지 않음(플레이어 전용). 기존 히든 조합 14종 + 융합 8종 = 도감 22칸.
- 밸런스: 카드 효과 포함 상태에서 기존 밸런스 목표 유지(헤드리스 봇도 카드 선택).

### 캐릭터 성장 & 장비 — 사용자 추가 요청
"게임을 할수록 캐릭터 성장 + 캐릭터 아이템". **아이템 강화는 일단 제외**(사용자 결정, 추후 검토).
- **영웅**: P1 대포 옆에 서서 대포를 지휘하는 영웅 캐릭터(화면에 보임). 레벨·경험치는 영구 유지(게임을 할수록 성장).
  - 경험치: 처치·스테이지 클리어(첫 클리어 더 많이). 레벨업 시 "LEVEL UP!" 대형 연출.
  - 레벨당 능력치 상승(대포 공격력%·성벽 체력%) + 마일스톤 해금(판타지 카드와 연계): 예) Lv5 카드 새로고침 1회/스테이지, Lv15 카드 4장 중 선택, Lv30 스테이지 시작 시 카드 1장 추가, Lv50 전설 카드 확률 증가.
  - 외형이 레벨 구간마다 진화(견습 기사 → 기사 → 성기사 → 영웅 → 전설), 장착 장비 희귀도에 따라 색·빛이 바뀜.
- **장비 5부위**: 무기(공격력%), 투구(성벽 체력%), 갑옷(성벽 피해 감소%), 장신구(치명타 피해%), 망토(공격속도%). 희귀도 일반/고급/희귀/영웅/전설(색 구분), 아이템 레벨 = 드롭 스테이지, 부옵션 0~3개(골드 획득%, 보스 피해%, 마나 충전%, 스킬 피해%, 치명타 확률%).
- **전투력**: 영웅 레벨 + 장비를 한 숫자로 요약해 크게 표시(비교가 한눈에). 장비 비교는 ▲▼ 전투력 차이로.
- **드롭**: 네임드 보스 확정(희귀 이상), 엘리트 확률, 일반 몹 낮은 확률, 스테이지 클리어 보물상자. 희귀도 색 **빛기둥**과 함께 떨어져 자동 획득(도파민), "NEW" 배지.
- **가방**: 30칸. 자동 장착 토글(전투력이 오르면 자동 교체), 희귀도별 일괄 판매(골드). 가득 차면 가장 낮은 등급 자동 판매.
- AI 동료는 영웅/장비 없음(대포만).
- 밸런스: 영웅 레벨·장비 포함 상태에서 기존 밸런스 목표 유지(헤드리스 봇도 자동 장착).

### 앱 자동 업데이트 (APK)
사용자 요청: "어플 스스로 업데이트", 배포 형태는 **APK**(스토어 밖 설치).
- Capacitor로 `public/`을 감싼 Android 앱. 패키지 `io.github.seobuk.defensegame`, 세로 고정, 전체화면.
- **업데이트 소스 = GitHub Releases** (`Seobuk/defense-game`, public → 토큰 불필요). 태그 `vX.Y.Z` + 첨부 `*.apk`.
- 앱은 실행 시, 30분마다, 앱 복귀 시 `releases/latest` 확인 → 설치된 버전보다 높으면 **백그라운드로 APK 다운로드** → 전투 중이 아닌 안전한 타이밍(스테이지 전환·패배 모달·메뉴)에 "새 버전 vX 준비 완료" 모달 + 변경 내역 → [지금 업데이트] 누르면 Android 설치 화면으로 넘어감(스토어 밖 앱은 설치 확인 탭 1번이 OS 필수). 최초 1회 "출처를 알 수 없는 앱 설치" 허용 안내.
- 저장(localStorage)은 같은 패키지·같은 서명이라 업데이트 후에도 유지. 모든 릴리스는 **같은 키스토어로 서명**해야 함(키스토어는 레포에 절대 커밋 금지).
- 설정 화면: 현재 버전 표시 + "업데이트 확인" 버튼.
- 릴리스: `npm run release` — 로컬에서 서명된 APK 빌드 → 태그 → GitHub Release에 `defense-game.apk`(이름 고정) 첨부. 키스토어는 이 PC 밖으로 나가지 않음(CI·secrets 없음).
- 고정 다운로드 링크: `https://github.com/Seobuk/defense-game/releases/latest/download/defense-game.apk`

### 랜딩 페이지
- `landing/` 정적 페이지를 GitHub Pages로 배포 (`https://seobuk.github.io/defense-game/`).
- 실제 게임 스크린샷, 핵심 재미(학살 쾌감·콤보·히든 조합·100층·보스), APK 다운로드 버튼(고정 링크) + 최신 버전 표시(Releases API), 설치 방법(출처를 알 수 없는 앱 허용), 모바일 우선.
- 브라우저(개발용)에서는 업데이트 기능이 조용히 비활성.
- 1차에서 만든 게임 내 **자동 강화** 토글은 그대로 유지.

## 2. 기술 구조

- **클라이언트**: 바닐라 JS ES 모듈 + Canvas 2D + DOM HUD. 번들러·빌드 없음.
- **개발 서버**: `server.js` (Node 내장 모듈만) — `public/` 정적 서빙. `npm start` → http://localhost:8080
- **앱**: Capacitor Android 프로젝트(`android/`), `webDir: public`. 게임 코드는 서버 없이 로컬 에셋만으로 동작해야 함.
- 코드 주석은 한국어, UI 텍스트 전부 한국어.

```
package.json          type: module, scripts: start, test
server.js             개발용 정적 서버 (node 내장 모듈만)
public/index.html
public/style.css
public/js/main.js     부팅, 게임 루프, 모드(solo/host/guest) 배선
public/js/util.js     fmt(큰 수 표기), rng, clamp 등
public/js/config.js   상수, 업그레이드/퍼크 정의, 비용·효과·보상 공식
public/js/stages.js   스테이지 → 테마, 스폰 스케줄, 적 타입/보스 정의, 스케일링
public/js/sim.js      순수 시뮬레이션 (DOM 없음, node에서 실행 가능)
public/js/bot.js      자동 강화/AI 동료 로직
public/js/render.js   캔버스 렌더러: 크기·층 순서·이벤트 분배 (그림은 js/art/*, 계약은 docs/ART.md §14)
public/js/art/        core(굽기 캐시·프레임 상태) · units · world · fx · hud  — 절차적 스프라이트(오프스크린 캔버스 캐시)
public/css/fonts.css · kit.css   번들 글꼴 · UI 키트,  public/assets/fonts · icons
public/js/ui.js       DOM HUD, 메뉴, 모달
public/js/save.js     localStorage 저장/불러오기, 오프라인 보상
public/js/audio.js    WebAudio 효과음
public/js/updater.js  APK 자동 업데이트 (Capacitor 네이티브에서만 동작)
android/              Capacitor Android 프로젝트 + 업데이트용 네이티브 플러그인
test/sim.test.js      헤드리스 스모크 + 밸런스 러너
```

### 좌표계
- 논리 월드 `WORLD_W=720`, `WORLD_H=1100` (세로형). 적은 위(y<0)에서 스폰, 아래로 이동.
- 성벽 윗면 `WALL_Y=960`, 성벽 두께 60 (960~1020). 대포 P1 `(240, 985)`, P2 `(480, 985)`.
- 상단 약 90px는 DOM HUD가 캔버스 위에 겹침(골드 표시는 좌상단 ≈ 월드 (70, 40) — 동전이 날아갈 목표).
- 하단 업그레이드 패널은 캔버스 **아래** DOM (겹치지 않음). 캔버스는 남는 높이를 **전부** 채운다: 월드(720:1100)는 아래에 붙고, 세로로 긴 화면의 위 여분(`topExtra`, 월드 y<0)은 배경이 채우며 DOM HUD는 화면 맨 위에 붙는다(HUD 기준 캔버스 좌표 = y − topExtra, `art/core.js hudY`). 데스크톱에선 가운데 정렬 컬럼.

### 시뮬레이션 계약 (sim.js)
고정 스텝 `dt = 1/60`초. 배속은 프레임당 스텝 수로 처리. 시뮬 시간 기준(쿨타임 포함).

```js
createGame({ stage, players: [PlayerInit, PlayerInit] }) → game
  PlayerInit = { name, kind: 'human'|'bot'|'remote', gold, lv:{atk,rate,crit,multi,wall}, perks:{pickaxe,critBoom,startGold}, auto:boolean }
startStage(game, stage)        // 성벽 풀회복, 스폰 스케줄 생성, 시작 골드 지급
step(game, dt)                 // 진행. players[i].auto 이면 bot 로직으로 자동 구매, kind==='bot' 이면 스킬도 자동 사용
act(game, i, action) → bool    // {type:'upgrade', stat} | {type:'skill', skill:'meteor'|'freeze'} | {type:'auto', on}
drainEvents(game) → events[]   // game.events 반환 후 비움
setPlayer(game, i, PlayerInit) // 협동 입장/퇴장 시 슬롯 교체
```

**ViewState** — 렌더러와 UI는 이 필드만 읽는다. sim의 game 객체가 이를 만족하고, 게스트는 스냅샷으로 같은 모양을 재구성한다.
```
{
  stage, theme: 0..4, phase: 'play'|'clear'|'defeat', phaseT, speed: 1|2|3,
  wall: { hp, max },
  progress: { total, killed },
  boss: null | { name, hp, maxHp, shield },          // 상단 보스 체력바용
  freezeT,                                            // 전체 빙결 남은 시간(틴트)
  enemies: [{ id, type, x, y, r, hp, maxHp, shield, frozen, isBoss, hitT, state }],
  bullets: [{ x, y, vx, vy, owner }],
  eshots:  [{ x, y, vx, vy, kind }],                 // 적 투사체(성벽으로 날아감)
  players: [{ name, kind, gold, auto, lv:{...}, cd:{meteor, freeze}, angle, stats:{ dmg, rate, crit, shots } }],
  result: null | { stars, gems:[g0, g1], firstClear }
}
```

**이벤트** (렌더 이펙트·효과음·UI 연출 트리거):
`shoot{o,x,y,angles}` 발사 1회(볼리) 단위 · `hit{x,y,dmg,crit,o}` · `kill{x,y,type,gold,isBoss,o}` · `boom{x,y,r,kind:'crit'|'bomber'|'meteor'|'shock'|'breath'}` · `wall{dmg}` · `skill{o,skill}` · `bossSpawn{name}` · `shield{x,y}` · `upgrade{o,stat,lv}` · `clear{stage,stars,gems}` · `defeat{stage}`

### 중독성 레이어 구현 계약
sim.js가 채우고 렌더러·UI·저장이 읽는다. 모든 이벤트는 `type` 필드가 이름이다. 수치·문구는 config.js(`COMBO_TIERS`, `FRENZY`, `LEGEND_T`, `SYN_FX`, `SYNERGIES`)에 있다.

**createGame 옵션 추가**: `discovered: string[]` — 저장된 발견 목록. `SYN_KEYS`에 없는 키는 버린다.

**game 필드 추가**
```
combo: { count, timer, tier: 0..4, best }  // timer 1.5초. 성벽에서 750px 안쪽(y+r > 210)에 적이 있을 때만 줄어든다.
                                            // 클리어 뒤 다음 스테이지로 넘어가면 이어진다(패배/메뉴에서 시작하면 0). best = 세션 최고
frenzyT        // 광란 남은 초(>0이면 두 대포 발사 속도 ×2, 최대 30발/초). 붉은 틴트용
legendT        // 전설의 학살 남은 초(>0이면 처치 골드 ×2)
duo: string[]  // 지금 켜진 레벨형 협동 조합: 'twin' | 'golden'
discovered: Set<string>  // 발견한 조합 키. sim이 추가한다. 저장할 땐 [...game.discovered]
players[i].syn: string[] // 그 대포의 활성 조합: 'flame'|'pierce'|'chain'|'homing'|'thorns'|'giant' (레벨이 바뀔 때 다시 계산)
enemies[].burnT          // >0이면 불타는 중(불꽃 산탄). burn = 남은 화상 피해
enemies[].state 'fuse'   // 자폭 용암괴가 성벽에 붙어 1초 뒤 자폭 대기(깜빡임 연출). 그 전에 쏘면 무리 속에서 터진다
bullets[]: { x, y, vx, vy, owner, kind: 'normal'|'flame'|'pierce'|'homing' }  // 우선순위 pierce > flame > homing. 유도탄은 궤적이 휜다
result.flawless: boolean  // 무결점 클리어(보석 이미 +50% 반영)
```
콤보 단계: 1 = 10킬 '좋아!' ×1.1, 2 = 30킬 '대단해!' ×1.25, 3 = 50킬 '광란!' ×1.5, 4 = 100킬 '전설!' ×2.0 (처치 골드 배율, 콤보가 이어지는 동안).
처치 골드 = `ceil(적 골드 × 콤보 배율 × 황금비 1.5 × 전설 2)`. `kill.gold`는 이 최종값이다.

**이벤트 추가·변경**
```
hit{x,y,dmg,crit,o,kind,big}        // kind = 탄환 kind, big = 피해 ≥ 대상 최대체력 5% 또는 보스 치명타
combo{count,tier,label}             // 단계 오를 때마다
comboEnd{count}                     // 10 이상 콤보가 끊길 때(시간 초과·패배)
frenzy{}                            // 2초 안 20킬 → 5초 광란
synergy{key,o,first,x,y}            // 조합이 "켜지는 순간" 1회. o = 대포 번호, 협동·이벤트형은 -1(연쇄 폭발은 터뜨린 대포)
                                    // first = 처음 발견(→ 컷인 배너 "히든 조합 발견! 〈이름〉" + 도감 공개). false면 작은 토스트 정도
                                    // 게임 생성·setPlayer 시 이미 조건을 만족하는 조합도 한 번씩 나온다
chain{o,pts:[[x,y],...]}            // 체인 라이트닝 번개 경로(첫 점 = 치명타 맞은 적)
thorns{x,y}                         // 요새화 가시 반사(성벽 접촉 지점)
shatter{x,y}                        // 빙하 운석으로 얼어붙은 적이 산산조각
goldRain{x,y,amount}                // 연쇄 폭발 골드 비(두 플레이어 모두 amount 획득)
hitstop{ms}                         // 호출 측이 ms 동안 sim 스텝을 멈춘다. 350 첫 발견 · 500 네임드 처치 · 200 운석 · 120 엘리트 처치 · 60 보스 치명타(0.3초에 1번)
boom{..., kind:'meteor'}            // 이중 필살 운석은 두 번 나온다
```
넉백: 잡몹은 맞을 때 `min(4, 20 × 피해/최대체력)` px 위로 밀린다(엘리트·보스 면역). 크게 보이게 하는 건 렌더러의 찌그러짐·흰 번쩍임(`hitT`, `big`) 몫.

**조합 14종** (도감 순서 = `SYNERGIES` 배열 순서, 조건 문구는 `desc`, 잠김 힌트는 `hint`)
| 키 | 종류 | 조건 | 효과 |
|---|---|---|---|
| flame 불꽃 산탄 | cannon | 다중 ≥2 · 치명 ≥10 | 맞은 적이 2초간 피해의 30% 추가(갱신·누적) |
| pierce 관통탄 | cannon | 다중 0 · 공격력 ≥25 | 탄이 최대 3마리 관통 |
| chain 체인 라이트닝 | cannon | 치명 ≥12 · 공속 ≥12 | 치명타가 180px 안 최대 3마리에 50%로 번짐 |
| homing 유도 미사일 | cannon | 다중 MAX(5) | 진행 방향 ±0.7rad 안 적을 추적 |
| thorns 요새화 | cannon | 성벽 ≥25 · 성벽 > 공격력 | 성벽을 때린 적에게 내 탄 피해 ×20 반사 |
| giant 거인 사냥꾼 | cannon | 공격력 ≥60 · 치명 MAX(15) | 엘리트·보스 피해 ×2 |
| glacier 빙하 운석 | duo | 한쪽 빙결 → 3초 안 다른 쪽 운석 | 보스·엘리트 운석 피해 ×3, 전원 shatter |
| twin 쌍둥이 포화 | duo | 두 대포 다중 레벨 같고 ≥3 | 두 대포 피해 +25% |
| golden 황금비 | duo | 두 공격력 레벨 정확히 같고 ≥10 | 처치 골드 +50% |
| double 이중 필살 | duo | 두 대포가 1.5초 안 같은 스킬 | 운석 2회 / 빙결 10초 |
| chainboom 연쇄 폭발 | event | 자폭병 연쇄 1회로 5킬 이상(시작 자폭병 포함) | 그 처치 골드 ×5 골드 비 |
| flawless 무결점 | event | 성벽 100%로 클리어 | 보석 +50% |
| frenzy 광란 | event | 2초 안 20킬 | 5초 발사 속도 ×2 |
| legend 전설의 학살 | event | 콤보 100 | 10초 처치 골드 ×2 |

원안의 치명 ≥20·공속 ≥20(체인), 치명 ≥40(거인)은 두 업그레이드 최대 레벨이 15라 불가능해서 12/12, 15(MAX)로 낮췄다.
자폭병: 폭발에 휘말린 일반 자폭병은 1.8배 반경 안이면 무조건 유폭한다. 성벽에 닿으면 1초 도화선(`fuse`) 뒤 자폭(성벽 피해만, 골드 없음).
AI 동료(슬롯 1)의 자동 강화는 연사·치명·성벽 쪽 취향이 있어 두 대포 빌드가 자연히 갈라진다(황금비·쌍둥이는 가끔 우연히, 또는 플레이어가 맞춰야 켜짐).

### 판타지 스킬 구현 계약
sim.js(+ public/js/spells.js) 가 채우고 렌더러·UI·저장이 읽는다. 빌드는 **스테이지 한정**(매 `startStage`에 리셋) — 영구 저장에는 반영하지 않는다.
카드는 **플레이어(슬롯 0) 전용**이며, AI 동료(슬롯 1)는 카드를 고르지 않는다. 수치는 config.js(`SPELLS`, `FUSIONS`, `FUSION_FX`, `RARITY_WEIGHT`, `MANA_MAX`, `MANA_FRACS`, `PICK_AUTO_T`)에 있다.

**createGame / startStage 로 채워지는 game 필드**
```
mana: { cur, max }        // MANA_MAX(100) 기준. 처치 진행률 25%·55%·85%(MANA_FRACS) 지점에서 가득 찬다
spells: { [key]: 1|2|3 }  // 스테이지 한정 빌드. startStage마다 {}로 리셋
fusions: string[]         // 지금 켜진 원소 융합 키(FUSIONS 중). game.spells가 바뀔 때마다 재계산
pick: null | { cards: [{ spell, level, rarity, fusionHint }×3], autoLeft: number|null }
                          // null이 아니면 전투 정지: step()이 아무것도 하지 않는다(phaseT 포함 시간도 멈춤)
                          // cards[i].level = 고르면 될 레벨(최대 3). fusionHint = 아직 못 찾은 융합을 완성시키는 카드(조건은 숨김, UI는 ✦만 표시)
                          // autoLeft = 자동 강화(players[0].auto) on일 때 PICK_AUTO_T(3)초부터 실시간으로 줄어드는 카운트다운. off면 null(선택할 때까지 무기한 정지)
```
`game.discovered`(기존 히든 조합 발견 Set)를 그대로 재사용한다 — 원소 융합 8종은 `SYNERGIES`에 `kind:'fusion'`으로 추가되어(14 → 22칸) 별도 발견 시스템이 없다.

**함수**
```
tickPick(game, dtReal) → void   // game.pick이 있고 autoLeft가 숫자일 때만 동작. 호출측(main.js)이 매 프레임 실시간 델타(초)를 넘긴다
                                 // autoLeft가 0 이하가 되면 bot.js의 pickCard(game) 휴리스틱으로 자동 선택한다
act(game, 0, { type: 'pick', index: 0|1|2 }) → bool
                                 // game.pick.cards[index]를 적용: game.spells[card.spell] = card.level, game.pick = null
                                 // {type:'spellPick', spell, level, rarity} 이벤트 + 융합 재계산(첫 발견이면 synergy+hitstop, 기존과 동일 규칙)
                                 // game.pick이 있는 동안은 pick 이외의 모든 act(...)가 실패(false)한다(전투 정지 중 다른 조작 불가)
```
카드가 없는 동안(`game.pick === null`)의 act·step 동작은 기존과 완전히 같다.

**이벤트 추가**
```
pickOffer{}                                  // 카드 3장이 새로 등장(마나 가득 또는 네임드 보스 등장 시 +1장)
spellPick{spell, level, rarity}              // 카드 선택 적용
spell{key, x, y, ...}                        // 일회성 시전(파이어볼 폭발, 낙뢰, 광선, 회오리 등장, 드래곤 브레스 등). key = SPELLS 키
```
융합 활성/첫 발견은 기존 `synergy{key,o,first,x,y}`(+첫 발견 시 `hitstop{ms:350}`)를 그대로 쓴다. `o`는 항상 -1(협동형과 동일).

**렌더 데이터** `game.spellFx` — 렌더러가 그리기용으로만 읽는다(sim이 매 프레임 갱신):
```
{
  tornadoes: [{ x, y, r, t, mul }],      // 회오리(위로 이동). t = 경과 시간
  lances: [{ x, y, vx, vy, hit:[] }],    // 얼음 창(관통 투사체)
  beams: [{ x, w, t }],                  // 심판 광선 잔상(t = 남은 표시 시간)
  ghosts: [{ x, y, tgt }],               // 망령 군단(융합) 유령
  dragon: null | { x, y, angle, breathT }, // 새끼 드래곤(breathT > 0 이면 브레스 중)
  golem: null | { x, y, hp, maxHp },       // 돌 골렘(성벽 앞 탱커)
  frostWard: null | { r },                 // 서리 결계 반경(성벽 중심)
}
```

**스킬 14종·융합 8종 수치·설명**: `SPELLS`/`FUSIONS`(config.js)의 `lv`(레벨별 수치)·`desc`(레벨별 한국어 설명)·`hint`(융합 잠김 힌트)를 그대로 UI에 노출하면 된다. 피해 계수(`mul`)는 전부 `game.players[0].stats.dmg`(그 순간의 공격력) 배율이라 대포가 강해지면 스킬도 같이 강해진다.
돌 골렘은 성벽에 닿는 피해를 성벽보다 먼저 흡수한다(`damageWall`에서 가로챔) — 골렘이 죽으면(hp 0) 이후 피해는 성벽으로 그대로 간다.
서리 결계·저주 낙인·질풍은 지속형(패시브) 버프/디버프라 전용 이벤트가 없다 — 상태는 `game.spellFx.frostWard`(서리 결계 반경 표시)와 실제 이동속도/피해량/공격속도 변화로만 드러난다.

### 영웅(클래스·필드 유닛) & 장비 구현 계약
`public/js/hero.js`(신규, DOM 없음)가 테이블·순수 함수를 갖고, sim.js가 배선한다. 영웅은 스테이지 한정이 아니라 **영구**(레벨·경험치·장비·가방은 `game.hero`에 저장되고 세이브에 그대로 들어간다). AI 동료는 영웅이 없다.

**클래스 5종** (`HERO_CLASSES`, key: 한국어 이름/역할/무기 명사/기본 스탯/패시브/궁극기/해금 조건):
`knight` 기사(근접 탱커, 반경 150 도발) · `ranger` 궁수(원거리, 관통 2) · `sorcerer` 마법사(원거리 광역, 스플래시) · `cleric` 성직자(근접 신성, 공격마다 성벽·자신 회복 + 언데드 추가피해, best≥20 해금) · `assassin` 암살자(치명타·보스 특화, best≥40 해금). 기사·궁수·마법사는 시작부터 해금.

**game 필드 추가** (opts.hero 없으면 전부 비활성 — 기존 동작과 100% 동일)
```
hero: 영구 저장 객체(호출측 소유) | null   // { cls, level, xp, autoEquip, equip:{weapon,helm,armor,trinket,cape}, bag:[] }
heroUnit: null | { cls, x, y, hp, maxHp, state:'walk'|'attack'|'idle'|'down', facing, atkT,
                   ultCd, ultT, invulnT, moveTo:{x,y,holdT}|null, respawnT, level, tier }
```
`heroUnit`은 매 `startStage`마다 성문(`HERO_GATE`, 두 대포 사이)에서 새로 생성된다(전투 상태는 스테이지 한정, 레벨·장비는 `game.hero`에 영구 보존). `hero.cls === null`이면 `heroUnit`도 `null`(필드에 아무도 없음).

**성장**: `xpToNext(level)`, `MAX_HERO_LV=99`, `heroTier(level)`(견습/숙련/정예/영웅/전설), `heroTitle(cls,level)`(클래스별 칭호). `MILESTONES`: Lv5 리롤 1회(`reroll`, 배선됨) · Lv15 카드 4장(`choose4`, 배선됨) · Lv30 시작 시 카드 추가(`extraCard`, 배선됨) · Lv50 전설 확률 상승(`legendBoost`, 배선됨) · Lv8/20/35 클래스 스킬 강화(스탯에 소폭 반영). 처치·클리어마다 `heroGainXp`가 호출되고(첫 클리어 보너스 큼), 레벨업 시 `heroLevelUp{level,tier,milestone}`.

**장비**: `SLOTS`=무기/머리/갑옷/장신구/망토, 각 슬롯의 주스탯 = atk%(무기)·체력%(머리, 영웅 전용)·피해감소%(갑옷)·치명피해%(장신구)·공속%(망토). `SUBSTATS` 6종(gold/boss/mana/spell/crit/heroHp) 중 0~3개가 등급별로 붙는다. `RARITIES` 5단계(일반→전설). `rollItem(stage, source, rng, cls)`(source: normal/elite/boss/chest, boss는 희귀 이상 확정), `itemPower`, `heroPower`, `sellValue`, `BAG_SIZE=30`(초과 시 최하위 등급 자동 판매), `equipItem/sellItem/sellItemsByRarity/autoEquipAll/addToBag`, `newHero()`.
`gearBonuses`/`heroBonuses`: gold%·마나 충전%·스킬 피해%는 대포·경제에 적용되는 전역 배율(`heroBonuses(hero)`), boss%·crit%·heroHp%는 영웅 자신의 전투 스탯에만 반영.

**전투 스탯**: `heroCombatStats(g, hero)`의 `dmg`는 **대포 공격력(`players[0].stats.dmg`) 비례**, `maxHp`는 **성벽 최대체력 비례** — 판타지 스킬과 같은 방식으로 스테이지 1~100 내내 유효 비중(약 20~35%)을 유지한다(레벨·장비가 계수를 올린다).

**필드 AI**: 사거리 안 가장 가까운 적 우선, 없으면 성문에서 `HERO_LEASH`(520px) 안의 최전방 적만 쫓아간다(먼 스폰까지 몰려가 고립되지 않도록 — 밸런스 러너로 확인한 제약). 도발: `heroEngageRadius(hero)`(기사 150, 그 외 근접 접촉 60) 안의 적은 `sim.js`의 `walk()`에서 성벽 대신 영웅을 공격(요새화 반사 등과 같은 자리에서 처리). 영웅이 흡수한 피해는 `wallLost`에도 더해져 자동 강화의 위험도 판단이 흔들리지 않는다.

**액션** (`act(game, 0, action)` — 카드 선택 중엔 다른 액션과 동일하게 모두 실패):
`{type:'heroClass', cls}`(처음 선택은 언제든, 이미 고른 클래스를 바꾸는 건 전투 중이 아닐 때만, 해금 필요) · `{type:'heroMove', x, y}`(그 자리로 이동, 6초 홀드 후 자동 복귀) · `{type:'heroUlt'}`(쿨타임 없을 때) · `{type:'equip', itemId}` / `{type:'sell', itemId}` / `{type:'sellRarity', rarity}` / `{type:'autoEquip', on}`.

**이벤트**: `heroAttack{x,y,tx,ty,cls,crit}` · `heroHit{x,y,dmg}`(영웅이 맞음) · `heroUlt{cls,x,y,r}` · `heroDown{x,y}` · `heroRespawn{x,y}` · `heroLevelUp{level,tier,milestone}` · `loot{item,x,y}`. 영웅이 입힌 `hit`/`kill`은 소유자 `o:2`(대포는 0/1)로 구분 — 렌더러는 `o===2`일 때 데미지 숫자 색을 다르게 쓸 수 있다.

**main.js 배선 (구현됨)**: `createGame({... hero: data.hero})` — 저장 객체를 그대로 넘기고 sim이 제자리에서 바꾼다(`save.js normalize`가 이전 저장을 `newHero()`로 마이그레이션, 장비는 필드 검증). 첫 시작(`hero.cls === null`)이면 영웅 화면의 필수 클래스 선택 뒤 1층. HUD 우상단 영웅 버튼(초상화·Lv·전투력, 중심 = `render.js BAG_POS`)으로 영웅 화면을 열고, 열려 있는 동안 전투·자동 진행 정지. 전장 탭 → `renderer.toWorld()` → `heroMove`(월드 y<90 HUD 띠·성벽 아래 무시). 카드가 떠 있으면 `tickPick(game, 실시간 dt)`(자동 강화 on일 때만), 하단 패널 잠금, 업데이트 모달 보류.
**추가 구현**: Lv5 `reroll1` 배선 — `game.rerollLeft`(스테이지 시작마다 0/1) + `act(game,0,{type:'reroll'})`(카드 선택 중에만, 새 카드 + `pickOffer{reroll:true}`, 자동 선택 카운트다운 재시작). 기사 궁극기 `stunT`는 `updateEnemies`에서 카운트다운하며 이동·공격 정지. 암살자 `blink`(1.6초): 120px 넘게 떨어진 표적 옆으로 순간이동 + `heroBlink{x0,y0,x,y}`. 증기 폭발은 `boom{kind:'steam'}`. 영웅 체력 = 성벽 최대체력 × (0.05 + 0.003×레벨) × 클래스 기본 체력/200 × 장비. 클리어·패배 순간 떠 있던 카드는 버린다(`pick = null`).

**궁극기**: 전부 즉발형(연출은 렌더러가 `heroUlt` 이벤트로 표현) — 기사만 `invulnT` 동안 무적 상태가 지속된다. 서리 결계식 지속 상태이상(블리자드 둔화 등)은 이번 구현 범위에서는 생략했다(즉발 피해로 대체) — 필요해지면 `spellFx`처럼 `heroUnit`에 지속 필드를 추가해 확장.

**RNG 분리**: `game.heroRng`(대포·스폰용 `game.rng`와 별개의 mulberry32 스트림)로 영웅의 치명타·드롭을 굴린다 — 영웅 관련 확률이 기존에 정밀 튜닝된 밸런스 타이밍(콤보·스폰 등)에 영향을 주지 않게 하기 위함.

### 적/보스 동작 요약
- walk: 아래로 이동(빙결 중 정지). 성벽 도달(y+r ≥ WALL_Y) 시 attack: 주기적으로 성벽 피해.
- 투척병: y 520~680에서 멈추고 주기적으로 성벽을 향해 투사체(eshot) 발사.
- 돌진형: 주기적으로 짧게 3배속 대시.
- 방패병: 받는 피해 60% 감소.
- 자폭병: 죽을 때 반경 폭발 — 주변 적에게 피해(연쇄 쾌감), 성벽이 반경 안이면 성벽 피해. 성벽 도달 시 1초 도화선 뒤 자폭(성벽만 피해, 골드 없음).
- 매 스테이지 끝 엘리트(테마 몹 대형판). 네임드 보스 기믹은 위 표 참고. 드래곤: 상단 좌우 비행, 경고 표시 후 브레스, 소환, 50% 이하 격노.
- 운석: 일반/엘리트 적 즉사(골드 지급), 네임드 보스는 최대 체력의 일정 % 피해. 빙결: 5초간 모든 적 정지.

### 저장 (localStorage `wallDefense.save.v1`)
```
{ v:1, name, stage, best, gems, gold, lv, perks, auto, partner:{gold, lv}, settings:{dmgNumbers:'full'|'simple'|'off', sound, speed, autoNext}, lastSeen }
```
- `stage` = 다음에 플레이할 스테이지, `best` = 최고 클리어. 3배속 해금 = best ≥ 20.
- 불러올 때 경과 시간(최대 8h, 1분 미만 무시)으로 오프라인 골드 지급 팝업.

### 협동 네트워크 (호스트 권한형) — 추후 지원, 1차 범위 아님
- 서버는 방 릴레이만: `create` → `created{code}`, `join{code}` → `joined` / 호스트에 `peer_joined`, `relay{data}` → 상대에게 전달, 연결 끊김 → `peer_left`. 방 코드 4자(혼동 문자 제외), 방당 2명, 메시지 크기 제한, 하트비트.
- 호스트가 시뮬을 돌리고 20Hz 스냅샷 + 누적 이벤트 전송. 게스트는 100ms 지연 보간으로 렌더. 탄환은 스냅샷 대신 `shoot` 이벤트로 게스트가 장식용으로 재현(대역폭 절약).
- 게스트 → 호스트: `hello{player}`(자기 저장 데이터로 슬롯 1 구성), `act{action}`(업그레이드/스킬/자동 강화).
- 게스트는 자기 슬롯의 골드·레벨·획득 보석을 스냅샷에서 받아 자기 저장에 반영. 배속·자동 진행·퍼크 상점은 호스트 전용.
- 호스트는 방을 만들면 즉시 AI 동료와 시작, 게스트 입장 시 슬롯 1 교체, 퇴장 시 AI(저장된 partner 데이터) 복귀.

### 디버그
URL 파라미터 `?stage=N` (해당 스테이지로 시작), `?gold=N` (골드 지급), `?lv=…`, `?spells=key:lv,…`(스테이지 시작마다 스킬 지급), `?herolv=N`, `?loot=rarity|all`(장비 드롭 연출). 브라우저 전용, 리뷰/테스트용.

### 밸런스 목표 (test/sim.test.js로 검증)
두 대포 모두 자동 강화 봇, 새 저장에서 시작, 클리어마다 보석으로 퍼크 구매, 패배 시 재도전(필요하면 이전 스테이지 파밍):
- 첫 성공 시도 기준 스테이지 소요 60~120초(시뮬 시간).
- 1~9스테이지 패배 0회. 첫 벽은 대략 10층 보스 전후.
- 1~100 전체 시도 횟수 ≤ 약 140, 어떤 스테이지도 재도전 8회 이하.
- 100층 클리어 가능. 100층 무렵 데미지 숫자는 수백만~수십억대(숫자 커지는 쾌감).

### 로그라이트 도전 구조 — 최신 사용자 요청 (기존 '패배 시 재도전/이전 스테이지'·'스테이지 한정 빌드'를 대체)
사용자: "한 번 하다 죽으면 스테이지 1부터 다시 시작, 정비하고 강화시켜서 다시 스테이지 도전하는 형식. 매번 도전할 때마다 어떤 영웅과 어떤 스킬을 조합할까."
위 문서의 '패배 시 재도전 / 이전 스테이지로', '스테이지 한정 빌드(Lv3, 스테이지당 3장)', '퍼크 3종', '오프라인 골드', '골드·업그레이드 스테이지 간 유지', 옛 밸런스 목표는 아래로 대체된다.

- **도전(런)**: 1층부터 성벽이 무너질 때까지. 성벽 붕괴 = 도전 종료(재도전·이전 층 없음) → 결과 화면 → 정비 화면. 100층 돌파도 도전 종료(승리).
- **런마다 초기화**: 골드, 성벽 마법사 업그레이드(두 마법사), 스킬 빌드, AI 동료, 콤보. **영구(메타)**: 영웅 레벨·경험치·장비·가방, 보석·영구 강화, 도감, 뽑아 본 스킬, 최고 기록, 클래스 해금, 설정.
- **스킬 빌드 = 런 전체 누적**: 층마다 처치 60%에서 카드 1장 + 네임드 보스 등장 시 1장 + 영웅 Lv30이면 도전 시작 시 1장. 슬롯 6칸 · Lv1~5. 슬롯이 차면 보유 스킬 강화만, 강화할 게 모자라면 각성 카드(소폭 스탯, 런 누적)로 채운다. 융합 8종은 런 안에서 두 원소를 모으면 발동.
- **학살 가속**: 필드가 비면 다음 스폰 묶음을 1.2초 뒤로 당기고 그 묶음을 2배 빠르게 → 압도적인 층은 15~25초. **광폭화**: 층이 80초를 넘기면 적 피해가 10초마다 2배, 이동은 감속·밀쳐내기를 무시(서리 결계+회오리 같은 교착 방지).
- **난이도**: 적 체력 = 기존 곡선 × 1.07^(층-1) × 구간 보정(`stages.js RUN_HP`). 런 안의 성장보다 적이 층당 약 5% 빨리 강해져 도전은 결국 끝나고, 영구 강화(복리)가 그 벽을 밀어 올린다. 기사 도발 반경 150 → 120(클래스 동등성).

### 로그라이트 구현 계약
sim.js(런 상태) + run.js(메타 ↔ 런, 신규) + save.js(v2) + config.js(수치). 모두 DOM 없음. UI 통합 패스는 아래 API만 부르면 된다.

**메타 객체** = `save.js normalize()` 결과(저장 데이터 그 자체, run.js 함수가 제자리에서 바꾼다):
```
{ v:2, name, best, gems,
  metaLv: { power, haste, ward, greed, startGold, wisdom, choice, reroll, startSlot, revive, critBoom, pickaxe },
  auto, settings:{ dmgNumbers, sound, shake, speed, autoNext },
  hero,                       // 기존 영웅 객체(영구)
  discovered: string[],       // 도감
  seenSpells: string[],       // 한 번이라도 뽑아 본 스킬 = 시작 스킬 후보
  runs,                       // 끝낸 도전 수
  lastLoadout: { cls, startSpells[] },   // '같은 조합으로 도전'
  run: null | RunSave,        // 이어하기(스테이지 시작 시점). 도전 중이 아니면 null
  lastSeen }
```
저장 키는 그대로 `wallDefense.save.v1`(안의 `v:2`). **v1 → v2 마이그레이션**: 영웅·보석·최고 기록·도감·설정·이름·auto 유지, 퍼크 `pickaxe/critBoom/startGold` → 같은 키의 `metaLv`, 골드·강화 레벨·동료·층은 버리고 대신 **최고 기록 × 3 보석**(`MIGRATE_GEMS_PER_BEST`), `run = null`, `seenSpells = []`. 어떤 입력에도 throw 없음.

**run.js**
```
buyMeta(meta, key) → bool                 // 보석 차감 + metaLv[key]++ (최대·보석 부족이면 false)
startSlots(meta) → 0..2                    // 시작 스킬 슬롯 수(영구 강화 startSlot)
startSpellChoices(meta) → key[]            // seenSpells(SPELLS 순서)
validLoadout(meta, {cls, startSpells}) → {cls, startSpells}   // 미해금 클래스·안 뽑아 본 스킬·슬롯 초과·중복 제거
newRun(meta, loadout, seed?) → game        // 1층부터. meta.hero.cls = cls, meta.lastLoadout, meta.run = 첫 체크포인트
restoreRun(meta, saved = meta.run, seed?) → game | null      // 이어하기: 저장된 스테이지 '시작'부터
endRun(game, meta) → Summary | null        // 도전 종료 정산(성벽 붕괴·100층·포기 모두). 두 번째 호출은 null
applyOffline(meta, computeOffline(meta)) → levelUps[]         // 보석 + 영웅 경험치
campAct(meta, {type:'heroClass', cls} | {type:'equip', itemId} | {type:'autoEquip', on}) → bool
                                           // 정비 화면 영웅 조작(게임 없이). 판매는 도전 중에만(act 'sell' → 런 골드)
serializeRun(game) / normalizeRun(raw)     // (sim.js 재수출) 체크포인트 JSON ↔ 검증
Summary = { stageReached, floorsCleared, victory, prevBest, best, newBest, bossesKilled, time,
            rewards: { floor, first, boss, flawless, best, gems },   // gems = 합계(이미 meta.gems에 더함)
            spells, loadout, newClasses: string[] }                   // newClasses = 이번에 해금된 클래스(성직자 20층·암살자 40층)
```
`endRun`은 meta에 보석·`best = max(best, floorsCleared)`·도감·뽑아 본 스킬을 합치고 `runs++`, `run = null`. 신기록 판정은 도전 시작 때의 최고 기록(`game.run.startBest`) 기준이라, main.js가 클리어마다 `data.best`를 올려도(3배속 해금용) 이중 계산이 없다.

**game 필드(추가·변경)**
```
run: { awaken:{power,haste,ward,fortune}, gems:{floor,first,boss,flawless}, reviveUsed, floors, bosses,
       firstClears, flawless, time, startBest, loadout:{cls,startSpells}, over, victory, ended,
       checkpoint }          // checkpoint = startStage마다 자동 갱신되는 serializeRun() → 저장은 data.run = game.run.checkpoint
spells: { [key]: 1..5 }      // 런 전체 누적(최대 6개). startStage에 리셋되지 않는다
fusions: string[]            // 런 동안 유지
rerollLeft                   // 런 전체 남은 새로고침(영웅 Lv5 1회 + 영구 강화 reroll, 도전 도중 Lv5 달성 시 +1)
seenSpells: Set<string>      // 뽑아 본 스킬(저장 시 [...game.seenSpells], endRun도 합침)
metaLv, fx                   // fx = 영구 강화 × 각성 배율 { atkMul, rateMul, wallMul, goldMul, xpMul, startGold, choices, rerolls, startSlots, revive, critBoom }
berserk                      // 1 = 평소, >1 = 광폭화 배율(적 피해 ×, 붉은 연출용)
result.gems = [g, g]         // 이번 층에서 '적립'된 런 보석(층 + 무결점 + 첫 돌파). 지급은 endRun
pick.cards[i] = { spell, level, rarity, fusionHint } | { spell:null, awaken:'power'|'haste'|'ward'|'fortune', level, rarity:'common', fusionHint:false }
```
`players[i].perks`는 없어졌다(영구 강화는 `game.metaLv`/`game.fx`, 두 마법사 공통). `cannonStats(lv, fx)`의 두 번째 인자가 perks → fx.
카드 선택지 수 = `cardCount(game)` = 3 + 영웅 Lv15(+1) + `metaLv.choice`(+1). 각성 카드 이름·설명은 `AWAKEN_BY_KEY[card.awaken]`(config.js `AWAKENINGS`). 스킬 설명은 `SPELLS[].desc[level-1]`(Lv1~5).

**이벤트(추가)**
```
runOver{stage, victory, floors}   // 도전 종료 순간(성벽 붕괴 = defeat 직후, 100층 = clear 직후) → 결과 화면 → endRun
revive{x, y, hp}                  // 부활 결계 발동(성벽 50%, 1.5초 빙결) + hitstop{400}. 도전마다 1회
berserk{}                         // 층 80초 경과 → 광폭화 시작(한 번)
spellPick{spell:null, awaken, level, rarity}   // 각성 카드 선택
```
`defeat{stage}`는 그대로 나오고 바로 뒤에 `runOver`가 붙는다. 패배 모달의 '재도전/이전 층' 버튼은 없앤다.

**config.js**: `META_UPGRADES`(key·name·desc·max·c0·grow·per), `META_KEYS`, `META_BY_KEY`, `metaCost(key, lv)`, `metaMax(key)`, `metaMul`, `metaFx(metaLv)`, `metaDisplay(key, lv)`(상점 표시 문구: 배율형은 누적 '+N%'), `startGoldAmount(lv)`, `RUN_GEMS`, `SPELL_SLOTS=6`, `SPELL_MAX_LV=5`, `MANA_FRAC=0.6`, `AWAKENINGS`/`AWAKEN_KEYS`/`AWAKEN_BY_KEY`, `OFFLINE_CAP_HOURS`, `offlineGemsPerHour`, `offlineXpPerMin`. 삭제: `PERKS/PERK_KEYS/perkCost/perkMax/perkDisplay/gemReward/offlineGoldPerMin/MANA_FRACS`.

| 영구 강화 | 효과(레벨당) | 최대 |
|---|---|---|
| power 기본 마력 | 모든 피해 ×1.10(복리 — 마법사·스킬·영웅 모두 공격력 기반) | 30 |
| haste 기본 시전 속도 | 시전 속도 ×1.03(15회/초 상한 뒤에 곱함) | 20 |
| ward 성벽 결계 | 성벽 최대 내구력 ×1.08 | 20 |
| greed 골드 획득 | 처치 골드 ×1.06 | 25 |
| startGold 시작 골드 | 도전 시작 골드(두 마법사 각각) 150 × 1.5^(lv-1) | 15 |
| wisdom 영웅 경험치 | ×1.10 | 10 |
| choice 카드 선택지 | +1장 | 1 |
| reroll 카드 새로고침 | 도전마다 +1회 | 3 |
| startSlot 시작 스킬 슬롯 | +1칸(뽑아 본 스킬 중 Lv1로 시작) | 2 |
| revive 부활 결계 | 도전마다 1회 성벽 50% 회복 | 1 |
| critBoom 치명타 폭발 | 기존 퍼크 | 10 |
| pickaxe 황금 곡괭이 | 방치 보상 +15%/lv | 20 |

**보석**: 층 클리어 `1 + ⌊층/15⌋`(무결점 +50%), 첫 돌파 `3 + ⌊층/8⌋`, 네임드 보스 `4 + ⌊층/8⌋`, 신기록 보너스 `8 + 3 × (새 최고 − 이전 최고)`. 결과 화면은 `Summary.rewards`로 항목별 표시, `newBest`면 크게 연출.
**오프라인**: `computeOffline(meta, now) → { gems, xp, minutes }`(골드 없음, 최대 8시간). 지급은 `applyOffline`.

**UI 통합 흐름 (main.js · ui.js · heroui.js — 이 브랜치에선 손대지 않음)**
- 부팅: `data = store.load()`. `data.run`이 있으면 타이틀에 **이어하기**(`game = restoreRun(data)`), 없으면 정비 화면.
- **정비 화면**: 영웅 화면 재사용(클래스 = `campAct(data, {type:'heroClass'})`, 장착 = `campAct(data, {type:'equip'|'autoEquip'})`), **시작 스킬 선택**(`startSlots(data)`칸, 후보 `startSpellChoices(data)`), **영구 강화 상점**(`META_UPGRADES` + `metaCost/metaMax/metaDisplay`, 구매 `buyMeta`), 도감, 최고 기록, **도전 시작**(`newRun(data, {cls, startSpells})`), **같은 조합으로 도전**(`newRun(data, data.lastLoadout)`).
- 도전 중: 클리어 → (자동 진행이면) `startStage(game, game.stage + 1)`; 저장은 `data.run = game.run.checkpoint`, `data.discovered = [...game.discovered]`, `data.seenSpells = [...game.seenSpells]`, 영웅은 같은 객체. 클래스는 도전 동안 고정(`act heroClass`는 1층 시작 전만).
- `runOver` 이벤트 → 자동 진행 멈춤 → **결과 화면**(`endRun(game, data)`의 Summary: 도달 층, 보스 처치, 보석 내역, 신기록, 새 클래스) → 정비 화면. 자동 재도전 없음.
  `endRun`은 `runOver`를 받은 **즉시** 부르고 바로 `store.flush()` — 결과 화면을 보는 동안 앱을 끄면 `data.run`이 남아 죽은 층을 이어하기로 다시 하는 구멍이 생긴다. 끝난 도전(`game.run.over`)에서 `startStage`는 아무것도 안 한다(옛 재도전·이전 층·100층 뒤 자동 진행은 no-op).
- 저장된 도전을 이어하지 않고 포기: `endRun(restoreRun(data), data)`(체크포인트까지 적립한 보석·기록 정산).
- 오프라인: `const r = computeOffline(data)` → 팝업(보석·경험치) → `applyOffline(data, r)`.
- 3배속 해금 `best ≥ 20` 유지. `?spells=` 디버그는 Lv1~5.

### 로그라이트 밸런스 목표 (test/sim.test.js 캠페인 러너로 검증)
새 저장 → 봇이 도전 → `endRun` → `botSpendGems`(가치/비용 탐욕) → `botLoadout`(클래스 순환, 선호 시작 스킬) → 다시 도전, 100층 돌파까지.
- 첫 도전 8~15층 · 도전당 평균 +3~6층 · 20~35회 · 총 15~25시간(시뮬 1배속) · 최고 기록 절반 이하 층 평균 ≤30초 · 새 층 평균 60~120초.
- 클래스 5종 동등성: 같은 메타 상태(최고 40층 시점, `--full`은 80층도)에서 클래스별 평균 도달 층이 전체 평균 ±15% 안.
- `npm test` = 단위 테스트 + 캠페인 1회(시드 1) + 동등성(40층) ≈ 2분. `node test/sim.test.js --full` = 캠페인 3시드 + 동등성 40·80층.

### 성벽 마법사 주문 시전 구현 계약
> 최신 사용자 요청: "영웅 말고 마법사는 기본 공격 없애고 마법만 쏘는 걸로." — 이 절이 맨 위 결정 블록의 '기본 공격 = 마법 탄(매직 미사일)'을 대체한다. 영웅(필드 유닛)은 무관.

성벽 위 마법사 2명에게 **기본 공격이 없다**. 각자 **고유 기본 주문**을 시전 속도대로 쏘고(스킬이 없을 때의 주력), 카드·학습으로 얻은 주문은 그 마법사의 **주문서**에서 각자 쿨타임대로 자동 시전된다. 시뮬 좌표·타이밍(`CANNONS` = 시전 위치, `players[i]`, `p.angle`, `p.fireT`)은 그대로.

**기본 주문** (`config.js BASIC_SPELLS[i]`, i = 마법사 번호. name·desc는 UI 문구 그대로)
| | 키(`kind`) | 이름 | 효과 |
|---|---|---|---|
| P1(나) | `fireball` | 화염구 | 마력 × `dmg`(0.75), 명중 지점 반경 `splashR`(44) 안 다른 적에게 `splashPct`(35%) 폭발 피해 |
| P2(AI 동료) | `frostbolt` | 서리 화살 | 마력 × `dmg`(0.65), 적 `pierce`(2)마리 관통, 맞은 적 `slowT`(1.2)초 동안 이동속도 `slow`(25%) 감소 |
카드 스킬 `fireball`(파이어볼, 쿨타임 주문)과 기본 주문 `fireball`(화염구)은 키가 같지만 다른 것 — `cast.basic`/`hit.o`로 구분한다.

**업그레이드 의미** (키 `atk/rate/crit/multi/wall` 그대로, 문구는 `UPGRADES[].desc`)
- 마력 `atk`: 모든 주문 피해(기본 주문·카드 스킬·동료 주문 모두 시전자 `stats.dmg` 배율).
- 시전 속도 `rate`: 기본 주문 시전 간격(`stats.rate`, 최대 초당 15회, 질풍은 P1 기본 주문에만) + 쿨타임 주문 쿨타임 ÷ `stats.cdMul` (= `min(cdCap, (1 + cdPer × 레벨) × 영구 강화·각성 시전 속도)`, `SPELL_CAST.cdPer 0.03`, 상한 `cdCap = 1/0.6` = 쿨타임 -40%). 새끼 드래곤 브레스 주기도 같은 배율.
- 치명타 `crit`: **모든 주문 치명타**(기본 주문·카드 스킬·동료 주문, 2.5배). 지속 피해(회오리·드래곤 브레스)는 굴리지 않고 기댓값(`1 + 확률 × 1.5`)만 곱한다.
- 다중 시전 `multi`: 기본 주문 발사체 수 `stats.shots` 1 → 3 → 5 → 7 → 9 → 12(부채꼴). 쿨타임 주문은 `stats.echo = echoPer(0.08) × 레벨` 확률로 `echoDelay`(0.3)초 뒤 **연속 시전** 1회(연속 시전이 다시 이어지지는 않음).
- 성벽 결계 `wall`: 성벽 최대 내구력(변경 없음).

**주문서 · AI 동료 학습**
- P1 주문서 = `game.spells`(카드 빌드, 기존 그대로). 쿨타임 주문 = 파이어볼·낙뢰·얼음 창·회오리·심판 광선. 오라·소환·지속형(질풍·서리 결계·수호의 빛·저주 낙인·영혼 수확·새끼 드래곤·돌 골렘·불꽃 마탄·연쇄 번개)은 지속 효과. 불꽃 마탄·연쇄 번개는 **기본 주문 명중 시** 발동.
- P2 주문서 = `game.allySpells: { [key]: 1..5 }` — **네임드 보스를 처치할 때마다** `ALLY_SPELLS = ['iceLance', 'lightningStrike', 'chainLightning']` 순서로 하나씩, 레벨 `allySpellLv(층) = min(5, ceil(층/20))`, 런당 최대 3. 카드처럼 고르지 않는다. 피해는 P2의 `stats`(마력·치명타·시전 속도·다중 시전) 기준. 원소 융합(`game.fusions`)은 P1 빌드에만 적용.
- 런 저장: `serializeRun/normalizeRun`에 `allySpells` 추가(없는 옛 저장은 `{}`, `ALLY_SPELLS` 밖 키는 버림, 레벨 1~5로 자름). 도전이 끝나면 사라진다(런 한정).

**히든 조합 재해석** (조건은 그대로, 효과는 주문 기반 — 문구는 `SYNERGIES[].desc`)
- 불꽃 산탄 `flame`: 기본 주문에 맞은(화염구 폭발 포함) 적 화상(피해 30%/2초) + 화염구가 반경 `shardR`(140) 안 가까운 적 `shardN`(4)마리에게 파편(`shardPct` 30%) — `shards` 이벤트.
- 관통탄 `pierce`: 기본 주문 관통 +2마리(`FX.pierce`) — 화염구는 3마리, 서리 화살은 4마리, 맞을 때마다 폭발·둔화.
- 유도 미사일 `homing`: 기본 주문이 휘어 쫓아간다(기존과 동일).
- 체인 라이트닝 `chain`: **주문 치명타**(기본·카드 모두, 지속 피해 제외)가 주변 3마리에게 50%로 번진다.
- 거인 사냥꾼 `giant`: 엘리트·보스에게 **주문 치명타**가 터지면 피해 ×2.
- 쌍둥이 포화 `twin`: 두 마법사의 모든 주문 피해 +25%. 요새화 `thorns`: 반사 = 내 마력 × 20(그대로). 치명타 폭발(영구 강화 `critBoom`): 기본 주문 치명타에만.

**렌더러용 데이터**
```
bullets[] = { x, y, vx, vy, owner, caster, kind:'fireball'|'frostbolt', syn:'pierce'|'flame'|'homing'|null,
              hit:[id...], pierce, tgt, life }       // caster = owner = 시전 마법사(0/1). syn = 켜진 히든 조합(렌더 표시용, 우선순위 pierce > flame > homing)
enemies[].slowT                                       // >0 이면 서리 화살 둔화 중(푸른 서리 틴트)
allySpells                                            // AI 동료가 익힌 주문(P2 패널 아이콘)
spellT / allySpellT                                   // P1 / P2 쿨타임 주문 남은 시간(키 = SPELLS 키, spellT.judgment는 기존 예고 연출)
```
**이벤트**
```
cast{o, spell, basic, x, y, tx, ty, n?}   // 시전 1회 = 마법진 + 지팡이 섬광 + 주문별 시전 동작 트리거. o = 마법사(0/1), (x,y) = 시전 위치(CANNONS[o]), (tx,ty) = 조준점
                                          //   basic:true → spell = 'fireball'|'frostbolt'(기본 주문, n = 발사체 수), basic:false → spell = SPELLS 키(쿨타임 주문)
shoot{o, x, y, angles}                    // 호환용(기본 주문 발사 부채꼴 각도). 새 연출은 cast를 쓴다
hit{x, y, dmg, crit, o, caster, kind, big}   // 기본 주문: o = 마법사(0/1), kind = 'fireball'|'frostbolt'. 카드·동료 주문: o = 3, caster = 시전 마법사, kind = 원소('fire'|'lightning'|'frost'|'wind'|'holy'|'dark')
boom{x, y, r, kind:'fireball', o}         // 화염구 폭발(명중마다)
shards{o, x, y, pts:[[x,y]...]}           // 불꽃 산탄: 화염구 파편이 흩어진 적 위치
allySpell{spell, level, x, y}             // AI 동료가 네임드 보스 처치로 새 주문을 익힘(토스트/연출)
spell{key, o, x, y, ...}                  // 기존 스킬 발동 이벤트에 시전자 o 추가
```

**밸런스 조정** (주문 치명타·쿨타임 단축·연속 시전·광역 기본 주문이 더해진 만큼): 카드 피해 스킬 6종(파이어볼·낙뢰·얼음 창·회오리·심판 광선·새끼 드래곤)의 `mul`을 ×0.6(설명의 % 도 같이), 기본 주문 피해 계수 0.75/0.65, 둔화 25%. 로그라이트 목표(첫 도전 8~15층, 도전당 +3~6층, 20~35회, 15~25시간, 클래스 격차 ±15%)는 그대로이며 시드 1~20 캠페인 전부 통과(도전 21~26회, 15.7~20.7시간, 첫 도전 8~14층), 시드 1~10 동등성(40층대 메타) 최대 격차 -11%(암살자, 시드 3), `--full` 84층 메타 +8%/-5%.

### 영웅 특성 트리 & 자율 전투 구현 계약
> 최신 사용자 요청: "영웅들도 다양한 스킬 트리를 찍어서 그에 따라서 영웅들이 특성을 가지게 해줘. 그리고 영웅이 지금 가만히 서 있는데 맵에 나가서 자동으로 움직이면서 싸웠으면 좋겠어."
> 이 절이 위 '영웅(클래스·필드 유닛) & 장비 구현 계약'의 **필드 AI**(성문 520px 목줄 `HERO_LEASH`, 영웅이 막은 피해를 `wallLost`에 더하기)와 **전투 스탯의 피해 공식**, '로그라이트 밸런스 목표'의 **동등성 시점(40층 → 50층)**을 대체한다. 나머지(클래스·장비·성장·궁극기·기존 이벤트)는 그대로.

sim/메타 쪽만 바꿨다(DOM 없음). 새 파일 `public/js/talents.js`(테이블 + 순수 함수), 전투 효과 `hero.js`, 배선 `sim.js`, 정비 화면 조작 `run.js campAct`, 봇 정책 `bot.js`, 난이도 보정 `stages.js HERO_HP`. UI(정비 화면 특성 탭·HUD·렌더러)는 이후 통합 패스가 아래 API만 부르면 된다.

**특성 트리** (`TALENTS[cls] = [{ key, name, desc, nodes:[6] }] × 3갈래`, 노드 `{ key, name, desc, max(1~3), fx:{효과키: 랭크당 수치}, cap }`)
- 클래스마다 3갈래 × 6노드. 갈래 안에서 **앞 노드를 최대 랭크까지 찍어야** 다음 노드가 열린다(일직선 — 순환 없음). 6번째 노드 = **궁극 특성**(1랭크, 전투 방식이 바뀐다). 클래스 총 랭크 39~42.
- **특성 포인트** `talentPoints(hero) = level + ⌊level/10⌋`(Lv1 = 1, Lv10 = 11, Lv99 = 108). 레벨은 공유, **배분은 클래스마다 따로**(`hero.talents[cls]`). 한 클래스를 다 찍는 시점은 약 Lv36~39.
- 노드 `desc`는 **랭크당 효과**(UI는 `현재 랭크/max`와 함께 표시). 이름·설명 전부 한국어. 노드 키 = 갈래 키 + 번호(`crusade1`~`crusade6`).

| 클래스 | 갈래(→ 궁극 특성) |
|---|---|
| 기사 | 수호 `guard`: 체력·도발 범위·피해 감소·가시 갑옷·처치 회복 → **튕기는 방패**(4초마다 5마리를 튕기며 150% + 0.6초 기절) · 성전사 `crusade`: 공격력·신성 피해(언데드 2배)·처치 시 성벽 회복·공속·치명 → **심판의 번개**(3타마다 반경 90, 200%) · 지휘관 `command`: 성벽 마법사 시전 속도 오라·이동·궁극기 쿨·공격력·궁극기 효과 → **전군 강화 함성**(궁극기 시 8초간 두 마법사 + 영웅 피해 +40%) |
| 궁수 | 저격 `sniper`: 사거리·치명·보스·치명 피해·관통 → **관통 저격**(4발마다 화면 끝까지 직선 300%) · 속사 `rapid`: 공속·다중 화살·이동·공격력 → **화살 폭풍**(모든 공격이 3연사, 발당 45%) · 야수 `beast`: 늑대 1마리·늑대 피해·체력·공격력·늑대 +1 → **늑대 무리**(늑대 +2, 늑대 피해 +50%) |
| 마법사 | 화염 `fire`: 공격력·점화(화상)·광역 반경·치명·치명 피해 → **작은 운석**(기본 공격이 반경 100 운석 140% + 화상) · 냉기 `frost`: 둔화·체력·빙결 확률·공속·사거리 → **절대영도**(궁극기가 반경 280 3초 빙결 + 500%) · 비전 `arcane`: 비전 충전·공격력·궁극기 쿨·공속 → **비전 분신**(영웅 공격을 60%로 따라 하는 분신) |
| 성직자 | 치유 `heal`: 공격 회복량·체력·재생·성벽 재생·피해 감소 → **부활 결계 강화**(도전마다 1회, 성벽 붕괴 시 40%로 회복 — 영구 강화 부활 결계와 별개, 먼저 발동) · 징벌 `punish`: 공격력·신성 폭발(주변 광역)·언데드 특효·공속·치명 → **천벌 기둥**(5초마다 가장 밀집한 무리에 반경 110, 400%) · 축복 `bless`: 골드·경험치·치명·공격력·궁극기 쿨 → **카드 축복**(스킬 카드 선택 시 30% 확률로 레벨 +1) |
| 암살자 | 그림자 `shadow`: 순간이동 쿨·이동·기습(순간이동 직후 첫 타)·공속·피해 감소 → **그림자 분신 2체**(각 영웅 기본 DPS의 30%) · 독 `poison`: 독(중첩 DoT)·공격력·독 확산·공속·부식(중독된 적 추가 피해) → **역병**(독 2배, 중독된 적이 죽으면 반경 150 전체로 번짐) · 처형 `execute`: 치명·보스·즉사(랭크당 체력 3% 이하 일반 적)·치명 피해·보스 마무리 → **처형자의 낫**(5타마다 반경 130, 250% + 체력 10% 이하 일반 적 처형) |

**비전 충전**(마법사 비전 갈래 `mana`): 층마다 첫 카드가 뜰 때 `mana`만큼 `game.run.arcane`에 쌓여 1 이상이면 **그 층 처치 85% 지점에 카드 1장 추가**(한 층 최대 2장, 런 저장에 포함).

**순수 함수** (`talents.js`)
```
talentPoints(hero) · talentSpent(hero, cls) · talentLeft(hero, cls) · talentRank(hero, cls, key) · talentMaxRanks(cls)
canAllocate(hero, cls, key) → bool      // 노드 존재 · 최대 랭크 전 · 남은 포인트 · 앞 노드 최대 랭크
allocateTalent(hero, cls, key) → bool   // 1랭크(제자리 변경)
resetTalents(hero, cls) → bool          // 무료 초기화(비어 있으면 false)
talentBonus(hero, cls) → { atk, aspd, hp, crit, move, range, dr, critDmg, boss, taunt, thorns, killHeal, wallKill, holy, undead,
                           aura, ultCd, ultPow, pierce, multi, wolf, wolfPow, burn, splash, slow, freeze, mana, heal, regen,
                           wallRegen, smite, gold, xp, blink, ambush, poison, spread, poisonAmp, execute, bossExec,
                           cap: { [궁극 특성 키]: true } }
normalizeTalents(raw, level)            // 저장 검증: 순서·최대 랭크·포인트를 어긴 클래스는 비운다(초기화가 무료라 손해 없음)
talentNode(cls, key) → { branch, index, node } · TALENT_FX_KEYS · CAPSTONES(15)
```
**어디서 찍나**
- 정비 화면(게임 없이, `run.js`): `campAct(meta, {type:'talent', cls, key})`(해금된 클래스만) · `{type:'talentReset', cls}`(**무료 초기화 — 정비 화면 전용**) · `{type:'autoTalent', on}`.
- 도전 중(`sim.js`): `act(game, 0, {type:'talent', key})` — 현재 클래스에만, 레벨업으로 생긴 포인트를 바로 쓰는 용도(다음 프레임 반영, `talent{cls,key}` 이벤트). 도전 중 초기화는 없다.
- 자동: `hero.autoTalent`가 켜져 있고 자동 강화가 on이면 `autoHero`가 남는 포인트를 추천 빌드로 배분.

**저장**: `hero.talents = { [cls]: { [nodeKey]: rank } }`(빈 클래스는 키 없음), `hero.autoTalent: bool`. 특성 필드가 없던 저장 → `{}`(포인트는 레벨로 계산하므로 손실 없음). `save.js normalize → normalizeTalents`. 런 저장(`serializeRun/normalizeRun`)에 `heroRevive`(부활 결계 강화 사용 여부), `arcane`(비전 충전 0~2) 추가.

**전투 스탯** (`heroCombatStats(g, hero, tb)`): 영웅 DPS = **P1 마법사 기본 주문 DPS 기준값** `mageRef(g)`(마력 × 시전 속도 × 다중 시전 × 치명타 기대값) × `HERO_K`(0.2) × 클래스 배율 `HERO_CLASSES[cls].dps`(기사 1.0 · 궁수 1.0 · 마법사 1.0 · 성직자 1.3 · 암살자 0.65) × 레벨 배율(0.7 + 0.008×Lv + 스킬 강화 마일스톤) × (1 + 장비 공격력/250 + 특성 atk) × 전군 강화 함성. 1타 피해 `dmg` = DPS ÷ 클래스 기본 공속, 실제 공속 = 기본 × (1 + 장비 + 특성 aspd). 마법사가 강해지는 만큼 같이 강해져 1~100층 내내 비중이 유지된다(옛 공식은 마력만 따라가 후반 비중이 1~7%). 사거리·이동·치명·보스·피해 감소·도발 반경(`engageR`: 기사 120 + 도발의 함성 랭크당 15, 다른 근접 50, 원거리 44)도 특성이 더한다. 특성 합산은 0.5초, 전투 스탯은 0.2초마다 다시 계산한다(`heroUnit.tb`, `heroUnit.st`).

**성벽 손실 버그 수정**: 영웅이 대신 맞은 피해는 더 이상 `game.wallLost`에 더하지 않는다(자동 강화가 성벽 결계를 과하게 사던 문제).

**필드 자율 전투 AI** (`updateHeroUnit`, 성문 목줄 없음)
- 활동 범위 = 전장 전체(스폰 직후 구역 `y < ROAM_TOP(140)`의 적만 쫓지 않는다). 0.25초마다 **가장 위험한 적**을 고른다: 성벽에 가까울수록(3 × y/960) + 주변 100px 밀집도(최대 8마리 × 0.3) + 보스(+1.2) − 영웅과의 거리/350 (+현재 표적 0.5, 흔들림 방지).
- **근접**(기사·성직자·암살자, `mode:'engage'`): 표적으로 달려가(이동 속도 100%) 붙어서 벤다. 암살자는 120px 넘게 떨어지면 그림자 순간이동(`heroBlink`).
- **원거리**(궁수·마법사, `mode:'kite'`): 사거리 90%까지 다가가고, 사거리 50% 안이면 천천히 물러나며, 적이 `max(90, 사거리 × 30%)` 안으로 붙으면 **반대쪽(성벽 쪽으로 기울여)으로 물러나며 계속 쏜다**(이동 사격 — 공격 준비는 이동과 무관하게 진행, 바라보는 쪽은 표적).
- **집결**(`mode:'rally'`): 적이 없으면 전장 중앙 `HERO_RALLY (360, 520)`로 걸어가(멀면 이동 속도 75%, 가까우면 45%) 주변을 배회하며 1.1~1.9초마다 좌우를 **두리번**(`facing` 반전). 성문에 서 있지 않는다.
- **후퇴**(`mode:'retreat'`): 체력 30% 미만 → 성벽 쪽 `(x, 920)`으로 달려가 회복(후퇴 중 초당 4%, 성벽 곁 14%, 평소 비전투 3%) → 80% 회복하면 재진격. 후퇴 중엔 도발하지 않고(`engageR = 0`) 원거리는 물러나며 쏜다. 이벤트 `heroRetreat{x,y}` / `heroAdvance{x,y}`.
- **탭 이동**(`mode:'move'`): `act heroMove` 그대로 — 6초 동안 그 자리로 가서 머물며 사거리 안의 적만 치고, 끝나면 자율 전투로 복귀.
- 적은 `heroUnit.engageR` 안의 영웅을 성벽 대신 공격한다(도발). 가시 갑옷이면 때린 적에게 반사(`thorns{x,y,o:2}`).
- 봇 궁극기: `ultWorth(g, h)` — 주변 180px에 적이 있거나(성직자는 성벽 70% 미만) 쓸 때만.

**렌더러용 상태** (`game.heroUnit`, 기존 필드 유지)
```
state: 'walk'|'attack'|'idle'|'down'        // 기존 호환
mode: 'engage'|'kite'|'rally'|'retreat'|'move'
gait: 'idle'|'walk'|'run'                     // 실제 속도 기준(이동 속도 70% 초과 = 달리기)
speed, dir(이동 방향 rad), vx, vy, facing(±1, 공격 중엔 표적 쪽 — 뒷걸음 카이팅)
windup: 0..1                                 // 공격 준비 진행도(1이 되는 순간 타격) — 휘두르기·시위 당기기
atkN                                          // 누적 공격 수(N타 궁극 특성 타이밍 표시용)
tgt                                           // 현재 표적 적 id | null
tb, st                                        // 특성 합산 · 전투 스탯(HUD 표시용)
```
**소환물** `game.summons[] = { id, kind:'wolf'|'shadow'|'arcane', x, y, facing, dir, speed, vx, vy, gait, state:'idle'|'walk'|'attack', windup, atkT, slot }` — 무적. 늑대·그림자 분신은 영웅 주변 260px 안의 적을 쫓아 물고(없으면 영웅 곁을 따라다님), 비전 분신은 영웅 곁에 떠서 영웅이 칠 때마다 같이 친다. 영웅이 쓰러지면 사라지고 부활하면 다시 나온다. 층이 바뀌면 영웅과 함께 다시 나온다. 피해는 영웅 몫(`hit.o = 2`, `hit.kind = 'wolf'|'shadow'|'arcane'`).

**이벤트(추가)**
```
heroProc{kind, x, y, r?, pts?, tx?, ty?, t?, spell?, level?}
   kind: 'shieldToss'(pts = 튕긴 경로) | 'judgeBolt'(r) | 'warcry'(t) | 'snipe'(x,y → tx,ty 직선) | 'arrowStorm'(tx,ty) | 'meteor'(r)
       | 'pillar'(r) | 'scythe'(r) | 'plague'(r, pts) | 'execute' | 'reviveWard' | 'cardBless'(spell, level)
heroUlt{..., variant:'absZero'|null}         // 절대영도면 variant
summonSpawn{id, kind, x, y} · summonAttack{id, kind, x, y, tx, ty} · summonDespawn{id, kind, x, y}
heroRetreat{x, y} · heroAdvance{x, y} · talent{cls, key}
revive{x, y, hp, hero:true}                  // 부활 결계 강화(성직자)
hit{..., o:2, kind}                           // 영웅 피해 kind: 'hero'|'holy'|'frost'|'snipe'|'shield'|'thorns'|'arcane'|'dark'|'wolf'|'shadow'
```
**기여도**: `game.dmgDone = [P1, P2, 영웅(소환물 포함)]` — 이번 도전 동안 실제로 깎은 체력(초과 피해 제외). 결과 화면 '영웅 기여도'에 그대로 쓸 수 있다.

**봇** (`bot.js`): `TALENT_BUILDS`(추천 갈래 순서 — 기사 성전사→수호→지휘관, 궁수 속사→저격→야수, 마법사 화염→비전→냉기, 성직자 징벌→치유→축복, 암살자 처형→독→그림자), `botTalents(hero, cls, 'build'|'random', rng)`, `randomTalents(hero, cls, rng)`(초기화 후 무작위). 테스트 러너 `playRun(meta, loadout, seed, 'build'|'random'|'none')`.

**난이도 보정**: 영웅이 화력의 25~40%를 맡게 된 만큼 `stages.js HERO_HP`(층별 적 체력 배율: 1층 0.92 → 20층 1.35 → 30층 1.8 → 50층 2.35 → 70층 2.75 → 85층 2.9 → 100층 2.8)를 곱했다. 1~10층은 조금 쉬워졌다(첫 도전의 영웅은 특성 1~3점이라 약하다).

**밸런스 결과** (`npm test` ≈ 2.5~3분 = 단위 + 캠페인 1회 + 동등성(최고 50층 메타, 3회씩). `node test/sim.test.js --full` = 캠페인 3시드 + 동등성 50·80층(4회씩) + 무작위 특성 동등성(영웅 Lv24 = 26점, 빌드가 갈리는 구간))
- 캠페인(로그라이트 목표 전부 유지): 시드 1 — 첫 도전 14층 · 도전당 +4.30층 · 21회 · 17.4시간 · 절반 이하 층 평균 26s · 새 층 평균 90s · 영웅 Lv76. 시드 1~11: 도전 21~28회, 15.9~24.0시간, 첫 도전 8~14층.
- 특성을 다 찍은 도전의 영웅 기여도(실제 피해 비중) 평균 28~34%(시드 1~11). 도전 하나하나는 빌드(카드 스킬 비중)에 따라 20~55%로 흔들린다 — 테스트는 클래스 평균 20~45%, 전체 평균 25~40%를 본다.
- 클래스 동등성(추천 특성): 최고 59층 메타(영웅 Lv40, 4회씩) 기사 +1% · 궁수 -2% · 마법사 +2% · 성직자 0% · 암살자 0%(영웅 기여도 34~42%), 최고 89층 메타(Lv65) 기사 +11% · 궁수 -7% · 마법사 -4% · 성직자 -1% · 암살자 +2%(23~41%). 무작위 특성(Lv24) 기사 +2% · 궁수 +2% · 마법사 -2% · 성직자 +2% · 암살자 -4%.
- 특성의 효과(같은 최고 54층 메타, 클래스 5종 × 2회): 특성 없음 → 추천 특성이면 영웅 기여도 11% → 38%, 도달 층 45.6 → 51.9, 31~45층 클리어 86s → 73s.
- 테스트: 특성 테이블(3갈래×6노드, 궁극 특성 15종, 모든 노드 도달, 한국어), 배분·초기화 규칙(정비 화면·도전 중·봇 추천/무작위), 궁극 특성 15종 각각 동작 변화(켜면 전용 이벤트/소환물/상태, 끄면 없음, 피해량 차이 — 부활 결계 강화·카드 축복·비전 충전은 따로), 소환물 생성·소멸·부활·층 전환, 자율 전투(적이 옛 목줄 밖에 나타나도 3초 안에 성문을 떠나 달려감, 궁수 이동 사격 카이팅, 30% 후퇴 → 회복 → 재진격, 집결 지점 두리번, 탭 이동 유지), 성벽 손실 버그, 저장 마이그레이션(`save.test.js`).

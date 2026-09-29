# 《대마법사의 용사 키우기》 설계 문서

> 게임 이름 변경(사용자 결정, 2026-09-27): 《벽 지키기: 100층 돌파》 → **《대마법사의 용사 키우기》**. 앱 패키지 ID `io.github.seobuk.defensegame`, 저장 키, 레포 이름은 호환을 위해 그대로 둔다. 홈 화면 짧은 이름은 "용사 키우기".

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

> ## ⚠️ 최신 사용자 결정(스킬 중심 개편 + 영웅×마법사 협공) — 아래 모든 절보다 우선
> 도전 중 골드 강화(하단 강화 버튼 5개·자동 강화)는 없어지고 정비 화면 **마법사 수련**(영구, 골드)으로 옮겨 약해졌다. 마법사는 **스킬을 고르는 존재**(슬롯 6칸 · Lv5 · 융합 = 두 스킬 합체로 슬롯 해제), 영웅과 마법사 스킬의 **협공**이 새 히든 조합이다. 폴더블(갤럭시 Z 폴드8) 대응도 이 요청에 포함. 가장 최근 피드백(**초반 난이도와 연출**: 적이 전장 가운데까지 밀려와 마법이 터지는 와중에 영웅이 가운데서 싸운다)이 그중 최우선. → 문서 끝 **"스킬 중심 개편 + 영웅×마법사 협공"**과 **"스킬 중심 개편 & 협공 구현 계약"** 절.

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
                                          // autoEquip 기본 켬(v0.1.0~). 옛 저장에서 아무것도 안 낀 영웅은 불러올 때 켠다(토글을 몰라 알몸으로 싸우던 영웅)
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
- `stage` = 다음에 플레이할 스테이지, `best` = 최고 클리어. 배속 해금 = best ≥ 10(2배) · ≥ 30(3배) — 4차 통합 절.
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
                             // 층 클리어 즉시 '다음 층 시작' 체크포인트로 바뀐다(클리어 화면에서 앱이 꺼져도 첫 돌파 보석·영웅 경험치를 잃지 않게).
                             // 도전 중 판매 골드(act sell/sellRarity · 가방 넘침 자동 판매)는 체크포인트 골드에도 더한다(아이템은 영웅에서 바로 빠지므로)
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
- (4차에 바뀜: 배속 해금 best ≥ 10 → 2배 · ≥ 30 → 3배.) `?spells=` 디버그는 Lv1~6.

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

### 스킬 중심 개편 + 영웅×마법사 협공 — 최신 사용자 요청 (이전 설계보다 우선)
사용자:
- "한 번 출정했을 때 오른쪽에 내가 선택한 스킬이 쌓이게. 한 번 출정에서 선택할 수 있는 스킬은 6개, 6개가 다 차면 더 선택할 수 없고 그 스킬을 max 찍게. 융합되면 스킬이 합쳐져서 슬롯이 열리는 식으로."
- "지금도 뒤에 마법사가 마법을 쓰는 게 아니라 그냥 단발 미사일이 주도적인 것 같아. 이 요소(하단의 마력·시전 속도·치명타·다중 시전·성벽 결계 강화 버튼)는 게임 밖 정비 코너로 약화시켜 빼자. 마법사는 말 그대로 스킬을 고르는 것에 의미를 두자."
- "영웅과 마법사의 콜라보 조합이 재미있는 게임이 되게 하려고 해."
- "폴드8에서도 옆에 안 잘리고 자연스럽게 게임되게"
- (가장 최근, 최우선) "너무 초반 난이도가 낮아서 마법이 거의 안 보여. 마법이 터지는 와중 영웅이 가운데서 싸워야 하는데."

1. **도전 중 골드 강화 폐지 → 정비의 '마법사 수련'**: 전투 화면 하단 강화 버튼 5개(`atk/rate/crit/multi/wall`)와 자동 강화 토글을 없앤다. 도전 중 성장은 스킬 카드(마법사)와 영웅(레벨·특성·장비)만. 정비 화면 **마법사 수련** 코너 = 같은 5종의 영구 강화(레벨당 작게, 상한 낮게 — 기본기 보정). 도전 중 모은 **골드는 영구 재화**(정비에서 수련에 씀). 보석은 편의·구조 메타 강화에만. 겹치던 보석 강화(마력%·시전 속도%·성벽%)는 수련으로 통합, 시작 골드처럼 의미가 없어진 항목은 정리. 세이브 이전은 손해 없이. AI 동료 마법사도 같은 수련 효과.
2. **마법사 = 스킬을 고르는 존재**: 기본 주문(화염구·서리 화살)은 약한 견제. 10층 이후 마법사 화력의 60~75% 이상이 고른 스킬. 도전 시작 무료 카드 1장, 1~5층은 층당 2장. 쿨타임 스킬은 시전이 잘 보이게(쿨타임 짧게·연출 크게).
3. **6슬롯 · 만렙 · 융합 합체**: 슬롯 6칸, 가득 차면 보유 스킬 강화(최대 Lv5)만, 전부 최대면 각성 카드. **융합 = 합체**: 조건이 되는 두 스킬이 하나의 융합 스킬(레벨 = 두 레벨 평균 내림, 카드로 Lv5까지)로 합쳐지고 슬롯 1칸이 열린다. 융합 스킬은 두 원 스킬보다 확실히 강하고 모양이 다르다. 첫 발견 컷인·도감 유지 + "슬롯 해제!". 카드의 ✦ 힌트 유지.
4. **영웅 × 마법사 협공(히든 조합 '협공')**: 영웅 클래스(와 특성 갈래) × 마법사 보유 스킬 조합으로 발동, 조건 비공개, 첫 발견 컷인 + 도감 '협공' 탭. 클래스당 3개 안팎, 총 12~15개. **연계기**(영웅 궁극기 3초 안의 마법사 쿨타임 스킬 = '합동 필살', 강화 발동 + 짧은 슬로 모션), **지원 사격**(마법사의 단일 대상 스킬은 영웅이 싸우는 대상을 우선), 협공을 키우는 특성 노드.
5. **화면**(UI 패스): 전투 화면 오른쪽 가장자리에 고른 스킬이 세로로 쌓인다(아이콘, Lv 점, 쿨타임 링, 빈 칸 6칸). 융합 시 두 아이콘이 날아와 합쳐지고 빈 칸이 반짝인다. 협공이 켜지면 영웅 초상 ↔ 스킬 아이콘 빛줄기. 하단 패널엔 비상 스킬(운석·빙결)·영웅 궁극기·배속·자동 진행만.
6. **폴더블**(UI 패스): 펼친 화면(0.85~1.1 비율)·접은 화면(21:9 이상) 모두 잘림·레터박스 없이. 월드 좌표(720 폭)·스폰·판정 영역은 그대로, 넓은 화면은 배경·성벽·지형을 양옆으로 연장하고 옆 여백에 스킬 스택·영웅 상태를 둔다. 접기·펼치기에도 재시작 없이 즉시 재배치. Android `resizeableActivity`, 레터박스 방지, `configChanges`.
7. **초반 난이도와 연출(최우선)**: "어렵게"가 아니라 적이 충분히 많고 오래 버텨서 마법과 영웅 전투가 화면 가운데에서 계속 보이게. 1~9층 패배는 거의 없어야 한다. 초반에도 적이 전장 중앙까지 밀려오고(적 평균 생존 1.5~3초, 처치 대부분이 중앙 띠 y 380~700), 영웅은 중앙을 기본 전선으로 삼아 교전 시간의 60% 이상을 중앙 띠에서, 1층부터 스킬이 3~5초마다(또는 더 자주) 시전된다. 이미 지나간 층의 학살 가속은 적을 한꺼번에 많이 쏟아내 화려함 유지.
- **밸런스**: 로그라이트 목표(첫 도전 8~15층, 도전당 +3~6층, 20~35회로 100층, 15~25시간, 클래스 격차 ±15%) 유지 + 스킬 비중 ≥ 60~75%(10층 이후) + 협공 빌드 도달 층 +10~20%.

### 스킬 중심 개편 & 협공 구현 계약
sim/메타 쪽만 바꿨다(DOM 없음): `config.js · sim.js · spells.js · run.js · hero.js · talents.js · bot.js · save.js · stages.js · test/*`. UI(main.js · ui.js · heroui.js · render.js · art/*)는 이후 UI 패스가 아래 API만 부르면 된다. 이 절이 위 '로그라이트 구현 계약'·'성벽 마법사 주문 시전 구현 계약'·'영웅 특성 트리 & 자율 전투 구현 계약'과 겹치면 이 절이 우선이다.

**1) 마법사 수련 (정비, 골드) — 도전 중 골드 강화 폐지**
- `act(g, i, {type:'upgrade'})`는 없다(항상 false). 자동 강화(`players[i].auto`의 골드 소비)·AI 동료의 강화 구매도 없다. `act {type:'auto', on}`은 남아 있지만 자동 진행 봇(카드 자동 선택 3초 · 영웅 자동 궁극기·특성) 전용이다 — 전투 화면에 강화 토글을 두지 않는다.
- `config.js MAGE_TRAINING = [{ key, name, desc, max, c0, per }]` (키 `atk/rate/crit/multi/wall` 그대로), `TRAIN_KEYS`, `TRAIN_BY_KEY`, `trainMax(key)`, `trainCost(key, lv)` = ⌈2.2 × c0 × (lv+1)^2.6⌉ 골드, `trainDisplay(key, lv)`(누적 효과 문구).

| 수련 | 레벨당 | 최대 |
|---|---|---|
| atk 마력 | 두 마법사의 모든 주문 피해 +4% | 25 |
| rate 시전 속도 | 기본 주문 시전 +3% · 쿨타임 -2%(상한 -40%) | 15 |
| crit 치명타 | +1.5%p (기본 5%, 2.5배) | 20 |
| multi 다중 시전 | 기본 주문 1 → 3(2레벨) → 5(5레벨)발 · 쿨타임 스킬 연속 시전 +4% | 5 |
| wall 성벽 결계 | 성벽 최대 내구력 +5% | 20 |

- 도전 중 성벽 마법사의 마력은 **층 공명** `floorPower(stage)`(적 체력 기본 곡선과 같은 모양)로 자연히 오른다 → 층별 난이도는 `stages.js DIFF` 한 표. 수련은 여기에 곱한다. 마법사 조합(불꽃 산탄·관통탄·체인·유도·요새화·거인 사냥꾼·쌍둥이·황금비)의 조건은 이제 **수련 레벨**(두 마법사 공통이라 쌍둥이·황금비는 multi ≥ 3 · atk ≥ 10이면 켜짐).
- 정비 화면: `campAct(meta, {type:'train', stat})` = `buyTraining(meta, key)`(골드 차감, 최대·골드 부족이면 false). 보석 강화는 `campAct(meta, {type:'meta', key})` = `buyMeta`. 정비 화면 판매 `campAct {type:'sell'|'sellRarity'}`는 골드를 바로 `meta.gold`에.
- **골드는 영구**: 도전 중 `players[0].gold` = 이번 도전에서 번 골드(처치·영혼 수확·골드 비·도전 중 판매 — HUD '이번 도전 골드'). `endRun`이 `Summary.rewards.gold = ⌊players[0].gold⌋`를 `meta.gold`에 더한다. **main.js는 더 이상 `data.gold = me.gold`로 덮어쓰면 안 된다**(정산은 endRun만). 처치 골드 `goldPerKill(stage) = 1 + 0.03 × 층`(× 적 종류 · 콤보 · 영웅 장비/특성 · 보석 강화 greed · 각성 fortune).
- 보석 강화 `META_UPGRADES`(편의·구조만): `greed` 골드 획득 ×1.05^lv(최대 20) · `wisdom` 영웅 경험치 ×1.1^lv(10) · `choice` 카드 선택지 +1(1) · `reroll` 도전마다 새로고침 +1(3) · `startSlot` 시작 스킬 슬롯(2) · `revive` 부활 결계(1) · `critBoom` 치명타 폭발(10) · `awaken` 각성 숙련(각성 카드 효과 +15%/lv, 10) · `pickaxe` 방치 보상(20). 옛 `power/haste/ward/startGold`는 없다. `metaFx(metaLv) → { atkMul, rateMul, wallMul (각성이 곱함), goldMul, xpMul, choices, rerolls, startSlots, revive, critBoom, awakenMul }`.
- **세이브 v3** (`wallDefense.save.v1` 안의 `v:3`): 메타에 `gold`(영구 골드), `training:{atk,rate,crit,multi,wall}` 추가. **v2 → v3**(`save.js MIGRATE_TRAIN`, `migrateTraining`): 보석 강화 `power`(옛 최대 30) → 수련 `atk`, `haste`(20) → `rate`, `ward`(20) → `wall`, 레벨 = ⌈옛 레벨 × 수련 최대 / 옛 최대⌉(같은 비율 위치, 올림 — 손해 없음). `startGold`에 쓴 보석은 전액 환불(Σ⌈12 × 1.25^i⌉). 나머지 보석 강화 레벨 그대로. 진행 중 도전의 옛 골드(층마다 ×1.18로 불던 런 재화)는 같은 **처치 수**만큼의 새 골드로 바꿔 두고(도전이 끝나면 meta.gold로), 옛 인게임 강화 레벨은 버린다. `meta.gold`는 0에서 시작. **v1 → v3**: 기존 v1 → v2 규칙 + startGold 퍼크 환불. 어떤 입력에도 throw 없음.

**2) 마법사 = 스킬을 고르는 존재**
- 기본 주문(약한 견제): `BASIC_SPELLS[0]` 화염구(마력 40%, 반경 40 폭발 30%) · `[1]` 서리 화살(마력 35%, 2관통, 1.2초 25% 둔화), 시전 `BASIC_RATE` 1.2회/초(× 수련 시전 속도). 11층부터 두 마법사 피해 중 고른 스킬 비중은 캠페인 평균 97%(도전별 최저 85~94%) — `game.dmgSkill[i]`(스킬 피해) / `game.dmgDone[i]`(전체).
- 카드: 도전 시작 무료 카드 `START_CARDS`(1장, 쿨타임 공격 스킬 5종 중에서 — `pick.starter:true`), 1~`EARLY_FLOORS`(5)층은 처치 `EARLY_MARKS`(30%·70%)에서 2장, 이후 층마다 `MANA_FRAC`(60%) 1장 + 네임드 보스 등장 1장 + 영웅 Lv30이면 시작 1장 + 비전 충전 85% 1장. 이어하기로 1층 시작 체크포인트를 되살리면 무료 카드도 다시.
- 쿨타임 스킬(카드 5종 + 융합 8종)은 시전마다 `cast{o, spell, basic:false, x, y, tx, ty, support, linked}` — 1~10층 P1 스킬 시전은 분당 약 160회(1층만 봐도 분당 30~60회).

**3) 6슬롯 · Lv5 · 융합 합체**
- `game.spells = { [key]: 1..5 }` = 내 슬롯(기본 스킬 14 + 융합 스킬 8, `SKILL_BY_KEY[key]`로 이름·아이콘·희귀도·Lv별 설명 `desc[lv-1]`). **슬롯 순서 = `Object.keys(game.spells)` 삽입 순서**(합체하면 재료 둘이 빠지고 융합 스킬이 맨 뒤). `slotsUsed(g)`, 빈 칸 = `SPELL_SLOTS(6) - slotsUsed(g)`, 최대 레벨 `SPELL_MAX_LV(5)`.
- 슬롯이 차면 카드는 보유 스킬(융합 스킬 포함) 강화만, 강화할 게 모자라면 각성 카드. 융합 스킬은 새 카드로 나오지 않고(합체로만 생김) 가진 뒤 강화 카드로 나온다. **보유 융합이 품은 재료 두 스킬(`game.fusionParts`)도 새 카드로 다시 나오지 않는다**(효과는 이미 융합 레벨로 발동 — 다시 고르면 슬롯만 낭비). 이 규칙으로 빌드가 강해진 만큼 `DIFF` 11층 이후를 ×1.8로 맞췄다. `pick.cards[i] = { spell, level, rarity, fusionHint, fusion }` (`fusion:true` = 융합 스킬 강화 카드, `fusionHint:true` = 고르면 합체 — UI는 조건 없이 ✦만).
- **합체**(`sim.js refreshFusion`, 카드 선택·도전 시작·이어하기 때): `FUSIONS[i].groups`의 두 칸에서 하나씩 가지면(칸마다 레벨이 가장 높은 것) 두 스킬이 빠지고 융합 스킬이 레벨 ⌊(a+b)/2⌋(최소 1)로 들어간다 → 이벤트 `fusionMerge{ fusion, from:[a, b], level, slotFreed:true, full }`(`full` = 꽉 찬 6칸에서 합체했나 — UI는 이때만 '슬롯 해제!') + `synergy{ key: fusion, o:-1, first }`(첫 발견이면 `hitstop{350}` — 컷인 + "슬롯 해제!"). 연쇄 합체도 처리. `game.fusionParts[fusion] = [a, b]`(런 저장에 포함).
- 융합 스킬 = 재료 두 스킬의 효과를 **융합 레벨로** 그대로 품고(`game.book` = 실제 발동 레벨: 기본 스킬 + 융합이 품은 재료) + **전용 쿨타임 시전**(모양이 다름): `spell{ key: 융합 키, shape }` — `firestorm`(불꽃 회오리: 밀집 지점에 3초 머무는 불꽃 소용돌이) · `thunderFrost`(초전도: 얼음 번개 n줄기 + 0.5초 빙결) · `steamNova`(증기 폭발) · `stormEye`(폭풍의 눈: 4초 머물며 끌어당기고 벼락) · `eclipse`(황혼의 광선 + 저주) · `plasmaOrb`(플라즈마 폭발 + 번개 n갈래) · `ghostWave`(유령 n마리) · `dragonDive`(수호룡 가로 강하 + 성벽 치유). 재료 합 대비 피해 ×1.5~4.7(test 출력).
- 쿨타임 링: `spells.js spellCooldown(g, key) → { left, total } | null`(지속형·없는 스킬 null). 합쳐진 재료의 타이머(`g.spellT[재료]`)도 계속 돈다(재료 효과가 융합 레벨로 발동) — 슬롯에는 융합 스킬 하나만 그린다.

**4) 영웅 × 마법사 협공**
- `config.js COLLABS`(14 + `unison`) — `{ key, name, cls, spells:[...], branch?, hint, desc }`, `COLLAB_KEYS`, `COLLAB_BY_KEY`, `COLLAB_FX`(수치), `collabOn(g, key)`, `collabPow(g)`(= 1 + 특성 collab). 도감: `SYNERGIES`에 `kind:'collab'` 항목(`cls`, `spells`, `branch`) — '협공' 탭은 이 kind로 거른다. 조건: 영웅 클래스 = cls, (branch면 그 갈래 `COLLAB_BRANCH_RANKS`(3) 랭크 이상), `game.book`에 spells 중 하나(재료가 융합에 들어가 있어도 인정).

| 클래스 | 협공 |
|---|---|
| 기사 | `anvil` 모루와 망치(파이어볼/회오리: 도발한 적이 받는 주문 피해 +35%, 파이어볼이 기사 주변 무리를 노림) · `ironLine` 철벽 전선(돌 골렘: 골렘 체력 +60%, 기사 피해 -40%) · `frostBastion` 서리 방벽(수호 갈래 + 서리 결계/얼음 창: 도발한 적 둔화, 차가운 적 얼음 창 +100%) |
| 궁수 | `thunderArrow` 뇌전 화살(연쇄 번개/낙뢰: 화살 명중마다 번개가 2마리로 50% — 마법사 스킬 피해로 집계) · `frostShot` 빙결 사격(얼음 창/서리 결계: 화살 둔화, 차가운 적에게 항상 치명타) · `galeArrow` 질풍 화살(질풍/회오리: 공속 +25%, 관통 +1) |
| 마법사 | `twinFlame` 쌍화염(화염 스킬: 영웅 공격마다 착탄 지점에 P1 파이어볼 폭발 250%) · `stormCall` 폭풍 소환(비전 갈래 + 낙뢰/회오리: 궁극기 범위 전체에 낙뢰) · `frostEcho` 서리 메아리(얼음 창/서리 결계: 영웅 공격 둔화, 차가운 적 얼음 창 +180%) |
| 성직자 | `holyAssault` 성광 협공(수호의 빛/심판 광선: 광선이 영웅 치유 10% + 피해 +120%, 수호의 빛이 영웅도 치유) · `sanctuary` 수호 성벽(돌 골렘: 골렘 체력 +60%, 성직자 회복이 골렘도) · `purgeFlame` 정화의 불꽃(화염 스킬: 공격이 화상 70%, 불타는 적 영웅 피해 +70%) |
| 암살자 | `shadowExec` 그림자 처형(저주 낙인: 일반 적 처형 기준 +25%p, 체력 30% 이하 보스에 영웅 피해 +120%) · `soulHunt` 영혼 사냥(영혼 수확: 영웅 처치마다 P1 쿨타임 스킬 대기 -1.6초) |

- 상태·이벤트: `game.collabs`(켜진 키), `collabSlots(g, key)`(엮인 내 슬롯 스킬 키 — 영웅 초상 ↔ 스킬 아이콘 빛줄기), 켜지는 순간 `synergy{ key, o:2, first, x, y }` + `collab{ key, cls, spells }`, 효과가 실제로 터질 때 `collabProc{ key, x, y }`(같은 협공 0.35초에 1번 — 연출 트리거). 스킬·클래스·특성이 바뀔 때마다 재계산(도전 중 특성으로 갈래 조건이 차면 그때 켜짐). `game.collabOff = true`면 효과만 끔(밸런스 비교용).
- **합동 필살**(`unison`): `act heroUlt` 성공 → `game.linkT = COLLAB_FX.linkT`(3초, HUD 표시용 남은 창). 창 안의 첫 P1 쿨타임 스킬(융합 포함)은 위력 ×2(파이어볼 반경 ×1.3) → `cast{…, linked:true}` + `linkFinish{ spell, x, y }` + `slowmo{ ms:700, scale:0.3 }` + `synergy{ key:'unison', o:2, first }`.
- **지원 사격**: `heroUnit.fightE` = 영웅이 지금 치는 적. 단일 대상 스킬(얼음 창·낙뢰 첫 줄기·심판 광선·황혼·플라즈마, 모루와 망치면 파이어볼)과 AI 동료의 같은 스킬은 이 적을 먼저 노린다 → `cast{…, support:true}`(없으면 화면의 보스·엘리트 → 가장 앞선 적).
- 특성(협공 강화): 기사 수호 `guard3` 협공 효과 +15%/랭크 · 지휘관 `command4` '합동 작전'(도발한 적이 받는 성벽 마법사 주문 피해 +8%/랭크, `tauntAmp`) · 궁수 `rapid4` · 마법사 `arcane2` · 성직자 `bless4` · 암살자 `poison2` 협공 효과 +15%/랭크(`collab`). `talents.js branchSpent(hero, cls, branch)`. (4차: 택1에서 협공 노드는 빠졌다 — 협공 효과는 각 갈래의 일반 노드·혼합 노드가 맡는다. 아래 "특성 택1 = 전략" 절)

**5) 초반 템포 — 전선 (가장 우선)**
- **전선** `config.js FRONT_Y = 380`: 이 선 위(y < 380)는 **접근로**. 성벽 마법사(기본 주문·모든 스킬·드래곤 브레스·유령·얼음 창·회오리)는 `inReach(e)`(= 살아 있고 `y ≥ FRONT_Y`, 네임드 보스는 어디서든)인 적만 노리고 맞힌다. 적은 접근로를 `ENTRY_RUSH`(2.5)배로 몰려 내려오고(네임드 제외), 넉백·회오리 밀쳐내기·궁수 화살은 적을 선 위로 되돌리지 않는다. 영웅은 선 위 적을 쫓지 않는다(`hero.js ROAM_TOP = FRONT_Y`, 집결 `HERO_RALLY (360, 520)`). → 적이 스폰 직후 녹지 않고 중앙 띠까지 밀려와 영웅 주변에서 마법이 터진다. 접근로의 적은 '몰려오는 중'(아직 맞지 않음)으로 보이면 된다.
- **밀도** `stages.js DENSITY = 1.5`: 층마다 잡몹 × 1.5(44~72마리 + 엘리트·보스), 몰려오기 묶음 5~9마리(심연 9~15) 0.25초 간격. 잡몹 한 마리의 체력·공격력·골드·경험치는 ÷1.5(`enemy.share`) — 층 전체 난이도·보상은 그대로. 층 길이 `PACE` 1.05.
- **학살 가속**: 전선 안에 적이 없고 접근로 윗부분(y < FRONT_Y/3)도 비면 다음 묶음을 당겨 3배 빠르게 쏟아낸다(묶음이 접근로에 줄지어 내려옴). 압도적인 층 20~30초(접근로 시간만큼 옛 15~25초보다 조금 김), 정복한 층(최고 기록 60% 이하)은 스폰 일정 3배 — 최고 기록 절반 이하 층 평균 약 27초.
- **초반 난이도**: `DIFF` 1~15층 매듭 `[1,0.8],[3,1.5],[5,2.4],[7,3.7],[8,4.5],[9,6.2],[11,45.5],[13,99.4],[15,196.6]` — 1~9층은 적이 교전 2~3초 버티되 지지 않게, 11~19층은 층당 약 30%씩 가팔라 첫 도전이 10~15층에서 끝난다(운 좋은 빌드가 20층 넘게 폭주하던 꼬리 제거).
- 지표: `kill` 이벤트에 `age`(등장부터 처치까지 초) · `fought`(첫 피해부터 처치까지 초) 추가. `test/harness.js earlyPacing({ seed, cls, floors })` → `{ reached, fought(중앙값), age, midKill, heroMid, castsPerMin, kills, playT }`. 새 저장 첫 도전 1~10층(기사·궁수·마법사 × 시드 2): 적 교전 생존(중앙값) 약 2.0초 · 중앙 띠(y 380~700) 처치 약 92% · 영웅이 싸우는 시간 중 중앙 띠 약 92% · P1 스킬 시전 분당 약 150회 · 1~9층 패배 없음(첫 도전 전체로는 기사가 16회 중 1회 9층에서 끝남). 전선 도입 전(같은 코드, 전선 없음)은 중앙 띠 처치 1~11% · 적이 스폰 직후 녹았다. `npm test`가 확인한다(목표 1.5~3초 · ≥70% · ≥60% · 5초에 1번 이상).

**6) 밸런스 조정 요약**: 영웅 전투 스탯 `HERO_K` 0.17, 기준 `mageRef` = 마력 × 치명 기대값 × (3 + 0.6 × 스킬 레벨 합). 클래스 배율 `dps` 기사 1.45 · 궁수 0.95(+ 화살 밀어내기 `push` 20px, 전선 위로는 안 밀림 — 궁수 패시브 문구 갱신) · 마법사 1.0 · 성직자 0.9 · 암살자 0.95(재료 재등장 차단 뒤 클래스 동등성으로 다시 맞춤). 독 확산·역병은 남은 독을 주변 적이 **나눠 갖는다**(총량 보존 — 밀집한 무리에서 독이 기하급수로 불던 문제). 자폭병 연쇄 폭발 피해는 누구의 기여도(`dmgDone`)에도 넣지 않는다(폭발을 터뜨린 영웅의 기여도가 55%로 부풀던 문제). 협공 수치 `COLLAB_FX`를 올려 협공 빌드 도달 층 약 +20%. 네임드 보스 50·60층 체력 배율 0.45·0.5(보스 층이 도전을 49·59층에서 뭉치게 하던 벽 완화). 정복한 층 스폰 일정 3.5배(`FAST_SPAWN`). `DIFF` = `[[1,0.8],[3,1.5],[5,2.4],[7,3.7],[8,4.5],[9,6.2],[11,45.5],[13,99.4],[15,196.6],[19,324.5],[29,1504],[39,3166],[40,3343],[41,2831],[49,4228],[59,4968],[60,6003],[61,3805],[69,13662],[79,23724],[80,23724],[81,37170],[89,31050],[99,53820],[100,56916]]`(19층 이후는 캠페인 러너로 맞춤 · 11층부터 옛 표 ×1.8 = 융합 재료 재등장 차단 보정).

**밸런스 결과**(`npm test` ≈ 2분 = 단위 + 초반 템포 + 캠페인 시드 1~3(worker_threads 병렬, **시드 평균**을 목표와 비교) + 협공 강도·클래스 동등성(시드 1~3의 최고 50층 시점 메타 3개 × 클래스마다 8회 = 24회). `node test/sim.test.js --full` ≈ 3.5분 = 캠페인 시드 1~6 + 동등성 50·80층 + 무작위 특성 동등성)
- 융합 재료 재등장 차단 + `DIFF` ×1.8(11층~) + 클래스 배율·암살자 협공 재조정 뒤 `npm test`(시드 1~3 평균): 첫 도전 10.3층 · 도전당 +3.49층 · 26.7회 · 21.6시간 · 절반 이하 층 27.0초 · 새 층 93.6초 · 특성 완성 영웅 기여도 28% · 스킬 비중 98%(도전별 최저 93~94%). 협공 강도 +24%(기사 +14 · 궁수 +26 · 마법사 +23 · 성직자 +29 · 암살자 +32%). 클래스 동등성(최고 55~76층 메타): 기사 +10% · 궁수 -7% · 마법사 +4% · 성직자 0% · 암살자 -7%(영웅 기여도 26~44%). 차단만 하고 다시 맞추지 않으면 도전당 +8.7층 · 11회로 목표를 크게 벗어났다.
- (차단 전 기록) 캠페인(시드 1~6 평균): 첫 도전 9.7층 · 도전당 +3.55층 · 26.7회 · 18.9시간 · 절반 이하 층 26.6초 · 새 층 90초 · 특성 완성 영웅 기여도 32% · 11층부터 마법사 스킬 비중 97%(도전별 최저 86~95%).
- **시드 하나하나는 크게 흔들린다**: 시드 1~16 — 도전 16~35회(평균 25), 9.9~27.2시간. 같은 메타·같은 클래스로도 도전 한 번의 도달 층이 25~70층까지 갈린다(카드 운 · 융합 조합). 그래서 테스트는 시드 평균을 본다(시드 하나씩이면 16개 중 약 11개가 모든 목표 안).
- 첫 도전(새 저장, 16시드 × 기사·궁수·마법사): 기사 8~12층(평균 10.1) · 궁수 10~15층(12.2) · 마법사 10~17층(13.5, 16개 중 1개 27층).
- 협공 강도(같은 시드를 협공 효과 끔/켬): +22%(기사 +22 · 궁수 +18 · 마법사 +22 · 성직자 +21 · 암살자 +27%). 거의 모든 도전에서 클래스 협공 2~3개가 다 켜진다(봇이 협공 스킬을 우선 고름).
- 클래스 동등성(최고 50~68층 메타 3개, 24회씩): 기사 +11% · 궁수 -10% · 마법사 +5% · 성직자 +1% · 암살자 -8%(영웅 기여도 29~41%). 최고 81~93층 메타: +4 · -10 · +3 · +5 · -1%(영웅 25~37%). 무작위 특성: +6 · -8 · +13 · -1 · -10%.

**UI 패스가 할 일(요약)**: 하단 강화 버튼·자동 강화 토글 제거(비상 스킬·궁극기·배속·자동 진행만) · 오른쪽 스킬 스택(`game.spells` 순서, `SKILL_BY_KEY`, Lv 점, `spellCooldown`, 빈 칸) · `fusionMerge` 연출(두 아이콘 → 하나, 빈 칸 반짝) · 협공 빛줄기(`game.collabs` + `collabSlots`) · `collabProc`/`linkFinish`/`slowmo` 연출 · 정비 화면 '마법사 수련'(`MAGE_TRAINING`, `trainCost`, `trainDisplay`, `campAct {type:'train'}`, 보유 `meta.gold`) + 보석 강화(`META_UPGRADES`) · 결과 화면 `rewards.gold` · 도감 '협공' 탭(`SYNERGIES` kind `collab`). **없어진 export**(UI가 아직 참조하면 지울 것): config `UPGRADES/UPGRADE_KEYS/upgradeCost/upgradeMax/statDisplay/atkDmg/fireRate/critChance/startGoldAmount`, spells `onBasicHit`(→ `onSpellHit`), bot `autoUpgrade`(→ 테스트용 `botSpendGold`). main.js는 base 브랜치에서 이미 로그라이트 이전 API(`PERK_KEYS` 등)를 쓰고 있어 UI 패스가 통째로 새 API로 옮겨야 한다.

### 3차 변경 구현 계약
> 사용자: "자동 진행 끄면 내가 스킬 선택하게" · "AI 마법사 빼자(나중 협업 모드 때 추가)" · "파이어볼 6 회오리 6 찍으면 화염회오리 1로" · 스킬 이펙트가 레벨과 함께 자란다.
> 네 트랙(sim/메타 · 특성 · 그림 · 화면)이 나눠 만들고 최종 통합·밸런스 패스가 맞췄다. 이 절이 위 절들과 겹치면 이 절이 우선이다(특히 '영웅 특성 트리' 절의 트리 모양·포인트 공식은 아래 D로 대체).

**A. 카드는 늘 직접 고른다 · '자동 진행' 하나 · 카드 화면의 '자동 선택'(별개)**
> 사용자가 빌드 도중 바꿈: "켜도 카드 선택은 직접 하게" → 이어서 "카드 선택 화면에서 자동 선택 켜게 해 줘. 귀찮은 이들을 위해서".
- **카드는 자동 진행과 상관없이 플레이어가 고른다.** 카드가 뜨면 전투가 멈추고(`step`이 `g.pick` 동안 멈춤) 고를 때까지 기다린다 — 카운트다운 없음. 새 도전 무료 카드·이어하기로 복원된 선택·미뤄 둔 카드(`reofferPick`)·새로고침(`reroll`) 모두 같다.
- **저장값 두 개**(`meta.settings`): `autoNext`(자동 진행 — 새 저장 **ON**, 기존 저장은 저장된 값, 최상위 `meta.auto`·옛 '자동 전투'는 버림) · `autoPick`(카드 자동 선택 — 새 저장 **OFF**). `newRun`/`restoreRun`이 `players[0].auto`/`players[0].autoPick`을 만든다.
- **자동 진행**(`act {type:'auto', on}` = `players[0].auto`, 선택 중에도 받음): ON = 층을 깨면 다음 층 자동(main.js, 클리어 화면에서 켜면 1.2초 뒤) + 영웅 궁극기 자동(`bot.autoHero`). OFF = '다음 층 ▶' 버튼 · 궁극기 버튼. 카드에는 아무 영향이 없다. 영웅 자동 장착·자동 특성은 늘 돈다.
- **자동 선택**(`act {type:'autoPick', on}` = `players[0].autoPick`, 자동 진행과 완전히 별개): 카드 화면 아래 토글 `#pick-auto`(설정 화면 '카드 자동 선택' `data-set="autoPick"`도 같은 값). ON이면 `pick.autoLeft = PICK_AUTO_T`(**2초**) — `tickPick`이 실시간으로 세다가 0이면 추천 카드(`bot.pickCard`, UI가 테두리를 금빛으로 채우는 그 카드)를 고른다. 그 사이 탭하면 직접 고른 카드가 우선. 선택 중에 켜면 바로 카운트다운, 끄면 `autoLeft = null`로 바로 사라지고 기다린다. main.js는 카드가 실제로 보일 때(`ui.isPickShown()`, 영웅 화면이 닫혀 있을 때)만 `tickPick`을 부른다.
- **봇 전용 경로**: `players[0].kind === 'bot'`(헤드리스 러너 `harness.botPlayer`)이면 `autoPick`과 상관없이 카드 자동 선택 + 운석·빙결 자동(`bot.autoSkill`). 게임의 플레이어는 늘 `'human'`이고 UI에는 kind를 바꾸는 길이 없다.
- 이벤트·필드: `g.pick = { cards, autoLeft: number | null, starter }`. UI API: `H.onToggleAutoNext(on)`(하단 토글) · `H.onToggleAutoPick(on)`(카드 화면 토글) · `H.onSettings({autoPick})`(설정 화면 — main.js가 도전 중이면 `act autoPick`도).

**B. 솔로 마법사 — AI 동료 제거(협동 모드 자리는 잠든 채 유지)**
- 성벽 위 마법사는 나 한 명, **성벽 중앙 `config.js SOLO_MAGE = {x:360, y:985}`**. 기본 주문·스킬 시전 이벤트의 `cast.x/y`, 얼음 창 출발점, 조합 발견 위치가 모두 여기. `mageAt(g, o)` = 솔로면 `SOLO_MAGE`, 협동이면 `CANNONS[o]`.
- `players[]`는 2칸 모양 그대로(`players[1]` = 잠든 협동 자리, run.js는 `{name:'동료', kind:'human', auto:false}`). **`createGame({coop:true})`일 때만** 동료가 깨어난다(기본 주문 서리 화살·비상 스킬·마법사 조합·협동 조합·성벽 결계 수련). 솔로에선 `players[1]`이 시전·`act`(항상 false)·조합·성벽 최대치에 아무 영향이 없다. `g.coop`, sim `mages(g)`에 `ponytail:` 주석.
- 없어진 것: `g.allySpells`, `g.allySpellT`, `allySpell` 이벤트, config `ALLY_SPELLS/allySpellLv`. 협동 조합(쌍둥이 포화·황금비·빙하 운석·이중 필살)은 협동 모드에서만 켜진다 — 도감 UI는 솔로에서 `kind:'duo'`를 숨기거나 '협동 모드' 표시. `dmgDone[1]`·`dmgSkill[1]`은 솔로에서 0.
- 저장: `serializeRun`에 `allySpells`·`auto`가 없고, `normalizeRun`은 옛 값을 조용히 버린다(throw 없음).

**B(추가). 영웅 성문** — `hero.js HERO_GATE = { x: SOLO_MAGE.x + 130, y: WALL_Y - 30 }`(490, 930): 층 시작·부활 때 영웅이 성벽 중앙 마법사를 가리지 않게 마법사 단 오른쪽 옆(`art/world.js`의 성문 단도 같은 값). ponytail: 협동 모드가 돌아오면 두 마법사 사이로.

**D. 영웅 특성 개편(`talents.js` — 위 '영웅 특성 트리' 절의 선형 6노드·포인트 공식을 대체)**
- 트리: 클래스 5 × 갈래 3 × **6단**(`tier` 0~5), 단마다 2~3노드 — 랭크형(2~3)과 1랭크 혼합, 갈래마다 **택1** 묶음 2개(`or`, 2단·4단), **핵심 노드** 1개(`ks`, 3단 — 전투 방식이 바뀌는 작은 궁극: bash·critBurst·ultRefresh·firstCrit·frenzy·packHunt·overheat·shatter·surge·emergency·holyNova·grace·shadowStrike·neuro·momentum, 모두 hero.js 훅), **궁극 특성**(`cap`, 6단, 기존 15종).
- 단 해금 = **그 갈래에 쓴 포인트** `TIER_REQ = [0, 3, 6, 10, 14, 18]`(앞 노드 만렙 조건 없음). **궁극 특성은 클래스당 하나** — 하나를 찍으면 다른 갈래 궁극은 잠김('궁극은 하나만', 무료 초기화로 다시). **혼합 노드** `TALENT_HYBRIDS[cls]`(클래스당 2) = 두 갈래에 각각 `HYBRID_REQ`(8)점.
- 예산 `talentPoints(hero)` = Lv20까지 레벨당 1, 이후 0.44(Lv20 20 · Lv40 28 · Lv76 44 · **Lv99 54**). 갈래 하나를 다 찍는 데 24~27점 → Lv99 = 한 갈래 마스터 + 나머지 둘 절반씩.
- 협공 갈래 조건(서리 방벽·폭풍 소환)은 `branchSpent(hero, cls, branch) ≥ COLLAB_BRANCH_RANKS`(3). 협공 효과 노드(`collab`)는 모든 클래스에.
- 추천·자동: `TALENT_RECOMMEND[cls] = { order:[주력, …], picks }`, `recommendNext(hero, cls)`(주력 갈래의 열린 궁극·핵심 먼저 → 낮은 단 → 추천 혼합 → 나머지 두 갈래 번갈아). `bot.botTalents`·`hero.autoTalent`가 이것을 쓴다.
- 규칙 API: `talentBlock(hero, cls, key) → null | { code: max|points|tier|or|cap|hybrid|none, msg }` · `canAllocate` · `allocateTalent` · `resetTalents` · `talentBonus` · `branchSpent/branchMax/nextTierNeed/talentCap`.
- 저장: 영웅에 `talentVer`(`TALENT_VER` 2) · `talentNotice`. `talentVer`가 없는 저장(v0.0.7까지 · WD2/WD3 백업 코드 포함)은 **모든 클래스 특성을 무료 환불**(`migrateTalents`), 포인트를 쓴 적이 있으면 정비 화면에 한 번 '특성 개편!' 안내 → `campAct {type:'talentNoticeSeen'}`. `SAVE_VERSION`은 그대로(3).
- 화면(`talentui.js`): 단 = 행, 왼쪽 레일이 다음 단까지 차오름, '다음 단 해금까지 N점', 택1은 '또는' 캡슐(한쪽을 찍으면 다른 쪽 흐림), 핵심 태그, 잠긴 궁극, 추천 배지. 폰은 갈래 탭 + 아래 혼합 띠, 트리 폭 600px 이상(폴드·넓은 화면)은 3갈래 나란히 + 두 갈래 사이 혼합 노드.

**E(그림). 이펙트가 레벨과 함께 자란다 — `art/fx.js`**
- 레벨 = 이벤트 `lv` → `view.spells[key]` → `view.book[key]`(`skillLv(view, key, ev)`), 단계 `tier(lv)`: Lv1 작고 단색·입자 적음·흔들림 없음 → Lv2~3 크기·입자·두 번째 색 · 흔들림 시작 → Lv4~5 보조 레이어(잔상·룬·2차 폭발·옆 광선) → **Lv6 완전체 마무리**(스킬마다 고유, 스킬별 1.8~3.2초에 한 번 · 동시에 3개까지) + 마법사 머리 위 짧은 시전 컷.
- 융합 Lv6: 불꽃 회오리 = 하늘까지 닿는 화염 기둥 · 초전도 = 하늘의 얼음 왕관 번개 · 증기 폭발 = 버섯 머리 증기 기둥 · 폭풍의 눈 = 황금 눈의 폭풍 고리 · 황혼 = 일식 + 금·보라 쌍광선 · 플라즈마 = 조여드는 전기 고리 + 8갈래 번개 · 망령 군단 = 거대한 망령의 문 + 해골 기사 4 + 유령 행렬 12 · 수호룡 = 금빛 드래곤 횡단.
- MAX!: `spellPick{level ≥ SPELL_MAX_LV}` → 마법사 뒤 금빛 기둥·룬 + 스킬 문장 'MAX!'(스택 칸의 MAX 도장은 ui.js).
- **백색 과부하 금지**: `render.js` 광량 예산(프레임마다 가산 빛 면적을 재서 넘치면 다음 프레임 가산 그리기 전체를 `lightK` 배, 최저 0.35 — 스킬 하나는 안 눌림, 디버그 `window.__wdLight`) · `flash()` ≤120ms, 겹치면 절반 · 큰 글로우는 흰 중심 없는 `hu(col)` · 흰 광선 중심 ≤20px · 형태(외곽선 불꽃·문·기사·결정·드래곤)는 가산이 아닌 보통 그리기 · 빛이 많은 프레임엔 적 실루엣(`units.drawEnemyReveal`)·영웅을 효과 위에 다시 그린다.
- 솔로 그림: 마법사 하나(`units.SOLO_X` 360, `mageOn(view, i)` — 두 번째 마법사는 `view.coop`일 때만), AI 동료 주문서·'AI' 표시·마법사 사이 구슬 호는 없다.

**UI(ui.js · main.js · camp.js)**: 하단 = 운석 · 빙결 · 영웅 궁극기 | 배속 · 자동 진행(카드 선택 중에도 이 토글만 살아 있음). 카드 화면 = 머리글 + '전투 정지 — 천천히 고르세요'(자동 선택 ON이면 카운트다운 링 + '추천 카드 자동 선택 · 탭하면 직접') + 카드 + [새로고침] [자동 선택]. 스택 = Lv 점 6개, Lv6 금테 MAX(+ 도장), 발견한 융합의 짝 두 칸 금빛 연결선(`#flinks`), 칸 툴팁 진행도. 카드 ✦ 띠 '이걸 찍으면 융합!' + (발견했으면) '→ 이름', 미발견은 '→ ???'. 정비 화면 '특성 개편!' 안내(`.cp-notice`). AI 동료 카드·주문 목록·토스트는 없다.

**C0. 스킬 만렙 6** — `SPELL_MAX_LV = 6`. 기본 14종 `SPELLS[].lv/desc`, 융합 8종 `FUSIONS[].lv/lvDesc`(= `SKILL_BY_KEY[k].desc`) 모두 6단계. 옛 Lv5 저장은 그대로(만렙이 아닐 뿐).

**C. 융합 = 두 재료 만렙 → 융합 Lv1**
- `FUSIONS[i].test(spells)` = 두 재료 칸을 다 가졌나(짝이 모였다), **`.ready(spells)` = 두 칸 모두 만렙 스킬이 있나(합체 조건)**. `refreshFusion`(카드 선택·도전 시작·이어하기 때)이 ready인 융합을 합친다: 재료 둘이 빠지고 **융합 스킬 Lv1**(슬롯 맨 뒤) → `fusionMerge{ fusion, from:[a,b], level:1, slotFreed:true, full }` + `synergy{ key, o:-1, first }`(첫 발견이면 `hitstop{350}`). 연쇄 합체 처리. 시작 스킬(Lv1)끼리는 합체하지 않는다.
- 재료 효과는 **만렙 그대로** 계속 발동(`g.book[재료] = 6`) + 융합 전용 시전(융합 레벨). 그래서 Lv1도 재료 둘보다 조금 세고 Lv6은 확실히 세다 — `npm test` 출력 '융합 강도'(재료 둘 만렙 대비, 20층 30초): Lv1 ×1.10~1.37 · Lv6 ×1.94~3.8(불꽃 회오리 3.8 · 황혼 3.6 · 증기 3.1 · 플라즈마 3.0 · 초전도 2.9 · 망령 2.7 · 수호룡 2.7 · 폭풍의 눈 1.9). 폭풍의 눈 낙뢰 가속 `FUSION_FX.stormEyeMul` 3 → 1.5.
- 보유 융합의 재료(`g.fusionParts`)는 새 카드로 다시 나오지 않는다. **각성 카드는 강화할 것도 새로 넣을 것도 없을 때만**(한 장이라도 있으면 그 카드들만 — 1~2장일 수 있다).
- 카드 `fusionHint:true` = **이 카드가 합체를 완성할 때만**(짝이 이미 만렙이고 이 카드가 이 스킬을 만렙으로 만든다). 미발견이면 UI는 ✦ "이걸 찍으면 융합!"만(짝 비공개).
- **진행도(UI)**: `g.fusionProgress`(refreshFusion이 갱신) = config `fusionProgress(spells, discovered)` → `[{ key, parts:[a,b], lv:[la,lb], max:6 }]` — 도감에 오른(발견한) 융합 중 아직 없고 짝이 모인 것만. 스택 금빛 연결선 = `parts` 두 칸, 툴팁 "불꽃 회오리까지: 화염구 6/6 · 회오리 3/6". 정비 화면 등 게임 밖에선 `fusionProgress(spells, meta.discovered)`.

**E(sim). 스킬 레벨이 이벤트에** — 쿨타임 스킬·융합 스킬의 `cast{…}`와 `spell{…}`에 `lv`(그 스킬 레벨 1~6: 기본 스킬은 `g.book` 레벨 = 합쳐진 재료는 6, 융합 시전은 융합 레벨). 폭풍의 눈 벼락(`spell{key:'lightningStrike', storm:true, lv}`) · 드래곤 브레스(`spell{key:'babyDragon', lv}`)도. 기본 주문 `cast{basic:true}`엔 없다. Lv6 도달·MAX 연출은 `spellPick{spell, level:6}` / `fusionMerge`로.

**봇 · 하네스**
- `bot.pickCard`(헤드리스 봇 · 카드 화면 '자동 선택'의 추천 카드 공용): 합체 완성 ✦ > 협공이 켜지는 스킬 > **가진 융합 스킬 강화**(카드 한 장당 가장 큰 화력 — 융합 Lv1 ×1.1~1.4 → Lv6 ×1.9~3.8) > **목표 짝**(짝이 모인 융합 중 레벨 합 최고) 강화 > 다른 짝 강화 > 보유 강화 > 가진 스킬과 짝이 되는 새 스킬 > 새 스킬 > 각성. (최종 밸런스 패스에서 융합 스킬 강화를 목표 짝 위로 — 새 짝만 쫓아 후반 빌드가 융합 4.3개로 넘치던 것을 3.9개로.)
- `harness.botPlayer(g)` = 자동 진행 ON + `kind:'bot'`(봇 전용 경로: 카드 자동 선택 · 운석·빙결). `playRun` → `fusions`(도전의 합체 수) · `firstFuse`(첫 합체 층). 캠페인 출력에 '융합(첫 층)' 열과 시드 평균 '3번째 도전부터 도전당 합체 · 후반(마지막 1/3) 빌드 융합 수 · 첫 합체 층', 목표 확인(도전당 ≥1, **후반 2~4**).
- 단위 테스트: 솔로(시전 위치 360·동료 없음·옛 allySpells 버림) + 협동 모드 자리 · **카드 흐름**(자동 진행 ON이어도 카운트다운 없이 무한 대기 · 새 도전·이어하기 복원도 대기 · 자동 선택 ON = 2초 뒤 추천 카드 · 선택 중 토글 즉시 반영 · 새 저장 autoNext ON/autoPick OFF) · 궁극기 자동은 자동 진행 ON일 때만 · 융합 8종(만렙 조건·✦ 조건·진행도·Lv1 합체·재료 만렙 유지·lv 이벤트·강도).

**밸런스(최종 — `npm test`, 결정적: 같은 코드면 같은 결과)**
- 1차(sim 트랙): 동료 화력이 빠지고 융합이 늦게(두 재료 만렙) 오면서 → `stages.js DIFF` 1~9층 ÷1.5, 11층부터 ÷3.6~5.6(중반이 가장 크게, 100층 ÷1.7) · 협공 `COLLAB_FX` 약 −30%(문구 숫자도).
- 최종 패스: 영웅 클래스 배율 `dps` 기사 1.45 → **1.38**(동등성 메타에서 영웅 기여도 46% → 33% — 클래스 상한 45%) · 마법사 1.0 → **0.88**(동등성 +18% → +10%) · 협공 쌍화염 `twinFlame` 1.5 → **1.25**(문구 125%) · 봇 카드 우선순위(위) · 영웅 성문 위치(B). 궁수 0.95 · 성직자 0.9 · 암살자 0.95 · `HERO_K` 0.17 · 특성 수치는 그대로.
- 결과(시드 1~3): 첫 도전 **10 · 11 · 11층** · 도전당 **+3.33 · +3.42 · +3.30층** · **28 · 27 · 28회** · **18.5 · 15.9 · 19.3시간** · 절반 이하 층 26.8초 · 새 층 90.6초 · 특성 완성 영웅 기여도 **30 · 33 · 30%** · 11층부터 마법사 스킬 비중 98.5%(도전별 최저 86~93%).
- 융합: 첫 합체 평균 9.6층 · 3번째 도전부터 도전당 **2.69회**(초반 짧은 도전 2~6회차는 0~1회 — 첫 합체가 10~15층이라 11~17층에서 끝나는 도전은 한 번 합체하거나 못 함, 20층을 넘기는 6회차 무렵부터 도전마다 1회 이상) · 후반(마지막 1/3) 빌드 **3.86개**(시드별 3.90 · 3.89 · 3.80).
- 협공 강도 **+20%**(기사 +9 · 궁수 +30 · 마법사 +36 · 성직자 +15 · 암살자 +13%, 최고 54~56층 메타 · 클래스별 24회). 클래스 동등성(같은 메타): 기사 **+2%** · 궁수 **−3%** · 마법사 **+10%** · 성직자 **−7%** · 암살자 **−2%**(영웅 기여도 21~33%).
- 초반 템포(1~10층): 적 교전 생존 2.0초 · 중앙 띠 처치 95% · 영웅 중앙 띠 94% · 스킬 시전 116/분 · 1~9층 패배 없음. 융합 강도(재료 둘 만렙 대비): Lv1 ×1.10~1.37 · Lv6 ×1.94~3.78.
- **주의 — 캠페인은 혼돈적이다**: 영웅 배율 하나를 0.05만 바꿔도 캠페인 궤적이 바뀌어 동등성 측정 메타(최고 50층에 처음 닿은 시점의 영웅 Lv 37~59)가 달라지고, 클래스별 결과가 ±10%p 흔들린다. 수치를 바꾸면 `npm test` 전체를 다시 돌려 확인할 것(시드 평균 목표가 기준, 시드 하나하나는 흔들린다).

**다음 웨이브(4차)를 막지 않게**: 변이는 Lv6 스킬·융합 스킬의 카드 한 종류로 `genCards`에 더하면 된다(합체 조건은 `FUSIONS[].ready`라 변이한 재료도 레벨 6이면 그대로 합체). 망각은 `g.spells`에서 키를 빼고 `refreshFusion`을 부르면 book·진행도·협공이 다시 계산된다. 던전(지역) 특성은 `stages.js`의 테마(`themeOf`)에 붙일 자리 — 적 원소 약점은 `spellHit`의 `kind`(원소)로 판정할 수 있다.

### 4차 변경 구현 계약
> 사용자: "스킬 다 찍고 계속 효과 강화만 하니까 전략적 변화가 없는 것 같아서 심심해" · "골드와 다이아가 일정량 들어가면 더 이상 쓸 곳이 없는 듯". 트랙마다 아래에 자기 절을 둔다.

#### 유물 · 망각 (RELICS 트랙 — `public/js/relics.js` · `relicui.js` · `art/relicart.js` · `css/relics.css` · `test/relics.test.js`)
**유물 = 네임드 보스 보상.** 10·20·…·90층(네임드 보스 층)을 **깨면** 클리어 순간 `g.relicPick = { cards:[키 ×≤3], autoLeft }` + 이벤트 `relicOffer{cards}`. 유물이 떠 있는 동안 `step`은 멈추고(카드 선택과 같은 방식) 다른 `act`는 거부, `startStage`는 유물을 지우지 않는다 — 다음 층 체크포인트(런 저장 `relicPick`)에 들어가 **앱을 꺼도 이어하기에서 층 시작 전에 다시 뜬다**. main.js는 유물이 떠 있으면 다음 층으로 넘어가지 않는다(`nextStage`·자동 진행 가드). 100층(도전 완료)은 유물 없음. ponytail: 층 중간에 끄면 카드처럼 층 시작부터(보스를 다시 잡으면 후보도 다시).
- 고르기 `act(g, 0, {type:'relic', index})`(−1 = '유물 없이 계속') → `relicPick{key|null}` · `g.relics`(고른 순서, 런 저장 `relics`) · 효과 합산 `g.rfx = relicFx(g.relics)`(늘 있음 — 유물 없으면 중립값). 카드 '자동 선택' ON(`players[0].autoPick`)·봇이면 `RELIC_AUTO_T`(4초) 뒤 추천 유물(`pickRelic`) — `tickRelic(g, dtReal)`(main.js가 유물 화면이 보일 때만, `ui.isRelicShown()`).
- 후보 = **유물 풀**(`relicPool(meta)` = 시작 풀 `START_RELICS` 8종 + `meta.relicUnlocked`) 중 아직 없고 겹침 금지(`excl`)가 아닌 것에서 무작위 3개(`g.rng`). 모자라면 2~1장, 0장이면 건너뜀. `createGame({ relicPool })`(run.js `common`이 넘김, 없으면 시작 풀). 나중의 던전 지도: 던전마다 다른 풀을 넘기면 된다(풀은 키 목록일 뿐).
- **해금 API(ECONOMY 트랙 상점이 씀 — shop.js가 그대로 재수출)**: `meta.relicUnlocked: string[]`(save.js normalize가 해금 가능한 키만 남김) · `lockedRelics(meta)` · `relicUnlockCost(key)`(표 `cost`, 60~150 보석) · `unlockRelic(meta, key)` → bool(보석 차감 + 추가) · run.js `campAct {type:'relic', key}`.
- 표 `RELICS[]` = `{ key, name, up, down, fx, start?, cost?, excl? }` — `up`/`down`이 카드 문구 그대로(장점 초록 ▲ / 대가 빨강 ▼). 그림 `art/relicart.js relicImg(key)`(DOM) · `relicEmblem(key, res)`(캔버스) · `relicColor(key)`.

| 유물 | 장점 ▲ | 대가 ▼ |
|---|---|---|
| 광기의 왕관 `crown`* | 모든 스킬 피해 +40% | 스킬 칸 −1(꽉 찼으면 가장 약한 스킬 — 낮은 레벨 기본 스킬부터 — 을 잃는다, `relicProc{lost}`) |
| 탐욕의 성배 `grail`* | 카드 선택지 +1 | 성벽 최대 −15% |
| 유리 대포 `glass`* | 모든 피해 +30% | 성벽 최대 −35% |
| 시간 도둑 `thief`* | 스킬 쿨타임 −20% | 기본 주문 봉인 · 성벽 최대 −15% |
| 쌍둥이 달 `twinMoon`* | 고른 스킬이 2레벨씩(✦ 합체 판정도) | 마나 카드가 두 번에 한 번(`relicManaCard`, 저장 `relicCards`) |
| 사냥꾼의 표식 `hunter`* | 엘리트·보스에게 스킬 피해 +70% | 일반 적에게 −15% |
| 수전노의 금고 `miser`* | 골드 ×2.5 | 모든 피해 −10% |
| 불사조 깃털 `phoenix`* | 성벽이 무너지면 한 번 더 50%(다른 부활이 없을 때, `revive{relic}`) | 운석 봉인 |
| 원소 공명 `resonance` | 같은 원소 2칸 이상(융합은 두 원소)이면 그 원소 스킬 피해 +40% | 다른 원소 −20% |
| 영웅의 깃발 `banner` | 영웅 궁극기 때 쿨타임 스킬 전부 즉시(합동 필살 창과 겹침) | 궁극기 쿨타임 +50% |
| 도박사의 주사위 `gambler` | 전설 카드 ×3 · 희귀 ×1.5 | 선택지 −1(최소 2) |
| 망각의 모래시계 `hourglass` | 망각 +2회 | 새로고침 0 |
| 별똥별 인장 `meteorSeal` | 운석 쿨타임 −60% | 빙결 봉인 |
| 빙하의 심장 `glacier` | 빙결 쿨타임 −50% · 지속 +50% | 운석 봉인 |
| 영웅의 서약 `oath` | 영웅 피해 +60% | 마법사 스킬 피해 −20% |
| 메아리 반지 `echo` | 스킬 연속 시전 +30%p | 스킬 피해 −15% |
| 흡혈 수정 `vampire` | 처치마다 성벽 0.6%(잡몹은 밀도 몫) | 성벽 최대 −20% |
| 대마법사의 지팡이 `archStaff` | 융합 전용 시전 피해 +80% | 그 밖의 스킬 −20% |
| 현자의 외알 안경 `sage` | 기본 주문 ×10 · 관통 +2 | 스킬 쿨타임 +25% |
| 혼돈의 구슬 `chaos` | 층을 깰 때마다 무작위 스킬 2개(서로 다르게) Lv+1(만렙이면 합체) | 마나 카드 없음(보스 카드만) |
\* = 시작 풀. 겹침 금지: 시간 도둑↔외알 안경 · 불사조↔별똥별 · 별똥별↔빙하 · 쌍둥이 달↔혼돈.

- 효과 훅(각 파일에 한 줄, 전부 `g.rfx`를 읽음): sim `computeFx`(`applyRelicFx` — atkMul·wallMul·goldMul·choices·cdMul·echo) · config `cannonStats`(`fx.cdMul` 쿨타임 상한 밖 · `fx.echo`) · spells `pd`(skillMul) · `tick`(`g._rmul` = 융합 전용 시전 배율) · sim `spellHit`(`relicHitMul` — 카드 스킬 명중만) · `damage`(o=2 영웅 heroMul) · `basicHit`/`fire`/`updateCannons`(기본 주문 배율·관통·봉인) · `genCards`(`slotCap`·`cardStep`·`noNew`) · `wouldFuse` · `rarityWeight` · `cardCount`(최소 2) · `gainMana`(`relicManaCard`) · `act skill`(`relicSealed`·쿨타임·빙결 지속) · `act heroUlt`(`onRelicUlt`) · `damageWall`(`relicRevive`) · `killEnemy`(`onRelicKill`) · 클리어(`onRelicClear` — 혼돈의 구슬 · 유물 후보) · bot `autoSkill`(봉인된 비상 스킬 건너뜀).
- 화면(`relicui.js`, ui.js가 만들어 `update/onEvents/renderResult`를 부름): 유물 3택 = 금빛 광선 위 한 줄 한 장 카드(메달 · 이름 · ▲ 장점 · ▼ 대가), '유물 없이 계속', 자동 선택 ON이면 링 + 추천 카드 금테. 보스 층은 격파·승리 연출 1.5초 뒤, 이어하기는 바로. 고르면 금빛 폭발 → 왼쪽 열 맨 위 **유물 줄**(탭 = 장점·대가 말풍선, 발동 때 톡). 봉인된 운석·빙결 버튼은 자물쇠(누르면 어느 유물이 봉인했는지), 왕관이 잠근 칸은 자물쇠, 스택 머리 `n/5`. 결과 화면 '이번 도전의 유물' 카드 + '망각 N회 사용'. 이벤트 알림: `relicPick` · `relicProc{chaos|phoenix|crown lost}` · `forget`.

**망각(비우기)** — 카드 선택 화면 아래 줄 '비우기 N'(남은 횟수가 있고 보유 스킬이 있을 때). 누르면 보유 스킬 시트 → 고른 스킬의 확인 단계('칸이 하나 비고 카드가 새로 나와요' · 융합이면 '품던 두 재료도 함께' · '다시 배우면 Lv1부터' · '남은 망각 N → N−1') → `act(g, 0, {type:'forget', spell})`: 카드가 떠 있을 때만 · `g.forgetLeft > 0` · 보유 스킬이면 슬롯에서 빼고(`refreshFusion` → book·진행도·협공 재계산, `g.mutations[spell]` 삭제 — MUTATIONS의 `pruneMutations`도 정리) 떠 있는 카드를 지금 빌드로 다시 뽑는다(`reofferPick`). 시트가 열린 동안 카드 자동 선택 카운트다운은 멈춘다(`isPickShown`). 이벤트 `forget{spell, level, fusion}`.
- 횟수 `g.forgetLeft` = `FORGET_PER_RUN`(2) + `g.fx.forgets`(보석 강화 `metaLv.forget` — ECONOMY) + `createGame({ bonusForgets })`(출정 준비 '망각의 물약' — ECONOMY `newRun`) + 망각의 모래시계 +2. 런 저장 `forgetLeft` · `forgets`(쓴 횟수, 이어하기는 층 시작 값).
- 결과(`endRun` Summary): `relics: string[]` · `forgets: number`.

**봇 · 하네스 · 지표**: `pickRelic(g, cards)`(유물별 가치 + 문맥: 공명이 켜질 빌드 +6 · 지팡이는 융합 수 × 3 · 꽉 찬 칸의 왕관 −2) · `forgetChoice(g)`(8층부터 · 칸이 다 찼고 이번 카드로 합체가 안 되면 짝·협공에 안 드는 Lv≤3 기본 스킬을 비움). harness `playStage`가 유물을 고르고 `resolvePick`이 망각을 먼저 본다. `playRun`·`campaign` 행에 `relics`(고른 유물) · `forgets`.
- 측정(2026-09-28, 다른 트랙 작업 중 코드 기준 — 최종 밸런스 패스가 다시 잰다): 같은 메타(최고 27층)에서 유물 하나만 풀에 두고 10회씩 — 조정 전 쌍둥이 달(카드마다 2레벨, 선택지 −1) **+191%** · 혼돈의 구슬(층마다 +1, 새 스킬 금지) **+127%** · 시간 도둑 +61% → 위 표로 조정 뒤 모두 −15~+33%(표본이 작아 ±10%p 흔들림). 캠페인 시드 1~3: 유물 없음 37·35·37회(+2.6·+2.6·+2.5층/회) → 유물 있음 35·40·22회(+2.8·+2.2·+4.2층/회) — 평균 도전 수 −12%. 유물 분포(봇): 쌍둥이 달·불사조·사냥꾼 > 성배·도둑·왕관 > 유리 대포 > 금고. 망각 도전당 1.1회(유물과 무관), 도전당 합체 2.9회(망각 전과 같음).
- 단위 테스트 `test/relics.test.js`(npm test에 포함): 표 · 해금 API · 보스 보상 흐름(정지·체크포인트·고르기·건너뛰기·자동 선택·겹침 금지·풀 소진) · 이어하기로 떠 있던 유물 복원 · 유물 20종 효과(죽지 않는 허수아비로 피해 배율 실측) · 망각 한도·저장·융합 비우기·Lv1 재등장 · 봇 정책.

#### 경제 싱크 (ECONOMY 트랙 — `public/js/shop.js` · `shopui.js` · `public/shop.css` · `test/shop.test.js` · `test/economy.js`)
> 사용자: "골드와 다이아가 일정량 들어가면 더 이상 쓸 곳이 없는 듯" — 100층 뒤에도 늘 살 것이 있게. 스킬 선택이 주력이라 돌파는 체감(점근)한다.

**가격 기준** `priceScale(best) = 6 × max(10, best)²` ≈ 그 최고 층에서 도전 한 번에 버는 골드(캠페인 실측 15층 1.8K · 59층 20K · 100층 90K).

| 소비처 | 재화 | 값 | 효과 |
|---|---|---|---|
| 수련 돌파 `trainBreak[k]` | 골드 | 마지막 수련 비용 × 1.3^(n+1) | 수련 5종 만렙 뒤 끝없이. n단 누적 = per × 5 × (1 − 0.9ⁿ) — 1단 = 원래 1레벨의 절반, 상한 = 원래 5레벨어치(마력 +20%·시전 +15%·치명타 +7.5%p·연속 시전 +20%p·성벽 +25%) |
| 출정 준비 `prep` | 골드 | `k × priceScale`: 두루마리 0.08 · 부적 0.04 · 결계석 0.07 · 물약 0.06 | 이번 도전 한 번: 시작 카드 +1 · 1층 희귀·전설 ×3 · 네임드 보스 층 부활 1회(50%) · 망각 +1 |
| 장비 상자 | 골드 | 0.1 × priceScale | 드롭과 같은 `rollItem(ilvl = 최고 층)`, 등급 가중치 0층 [55,30,12,2.6,0.4] → 100층 [5,20,40,27,8] 선형. 강화 없음 |
| 고급 · 전설 상자 | 보석 | 60 · 300 | 희귀 이상 [62,30,8] · 전설 확정 |
| 유물 해금 | 보석 | 60~150(relics.js 표) | 보스 보상 풀에 추가 — 해금 API는 RELICS 절 |
| 보석 돌파 `gemBreak[k]` | 보석 | 마지막 강화 비용 × 1.25^(n+1) | 골드 획득(`greed`) 만렙 뒤 '황금 손길' 처치 골드 × (1 + 0.05×5×(1−0.9ⁿ)) · 황금 곡괭이(`pickaxe`) 만렙 뒤 '심층 채굴' 방치 보상(보석·골드·경험치) × (1 + 0.15×5×(1−0.9ⁿ)) |
| 망각 숙련(보석 강화 `forget`) | 보석 | 180 | 도전마다 망각 +1(`metaFx().forgets` → relics.js) |

**방치 골드**(새로): `offlineGoldPerHour(best) = ⌊12 × (1+best)^1.35⌋`(한 시간 플레이의 약 5%, 최대 8시간). `computeOffline → { gems, gold, xp, minutes }`, `applyOffline`이 골드도 준다. 오프라인 창에 골드 줄(`#off-gold`).
**판매가**: `sellValue × (1 + ilvl/25)`(층 비례) — 장비 상자 기대 판매가는 값의 5~12%(되팔아 이득 없음, 테스트가 25% 미만 확인).

**API (`shop.js`, DOM 없음)**
```
priceScale(best) · breakBonus(per, n)
trainBreakOpen(meta, k) · trainBreakCost(k, n) · trainBreakText(k, n) · buyTrainBreak(meta, k) → bool
GEM_BREAK[{key,name,desc,per}] · gemBreakOpen(meta, k) · gemBreakCost(k, n) · gemBreakText(k, n) · buyGemBreak(meta, k) → bool
runBonus(meta) → { atkMul, rateMul, wallMul, goldMul, critAdd, echoAdd }     // run.js common()이 createGame({ bonus })로
applyShopBonus(fx, bonus)                                                  // sim computeFx 끝(유물 다음) — fx.echo·fx.critAdd는 config cannonStats가 더함
PREP[{key,short,name,desc,k,tone}] · PREP_KEYS · prepCost(k, best) · togglePrep(meta, k) → bool(산 것을 다시 누르면 전액 환불)
normPrep(v) · normRunPrep(v)(+wardUsed) · takePrep(meta)(newRun: meta.prep → run.prep, meta.prep 비움) · prepWardReady(g, bossFloor) · PREP_RARE_MUL(3)
BOXES[{key,name,cur,desc}] · boxOdds(k, best) · boxCost(k, best) · boxIlvl(meta) · openBox(meta, k, rng?) → { item, sold, soldItem, equipped } | false
unlockRelic(meta, key)(relics.js 재수출) · offlineGoldPerHour(best) · offlineMul(meta) · normShop(saveObj) → { trainBreak, gemBreak, prep }
shopOffers(meta) → [{ id:'train:k'|'trainBreak:k'|'prep:k'|'box:k'|'meta:k'|'gemBreak:k'|'relic:k', cur, cost }] · affordable(meta, offers)
botShop(meta, rng, spent?, phase 'pre'|'post'|'all')                       // 테스트 러너 소비 정책
```
- **campAct**(run.js): `{type:'trainBreak', stat}` · `{type:'gemBreak', key}` · `{type:'prep', key}` · `{type:'box', key}`(결과 객체 — main.js·ui.js가 `!!` 없이 그대로 돌려준다) · `{type:'relic', key}`.
- **런**: `run.prep = { card, rare, ward, forget, wardUsed }`(`serializeRun`/`normalizeRun`, 이어하기에 남음). `newRun`이 시작 카드 `START_CARDS + card` · `createGame({ bonusForgets: forget })`, 1층 체크포인트 이어하기도 카드 +1. sim 훅 3줄: `rarityWeight`(1층 희귀·전설 ×3) · `damageWall`(보스 층 `stage % 10 === 0`에서 결계석이 부활 결계보다 먼저, 이벤트 `revive{…, prep:true}`) · `computeFx`(`applyShopBonus`).
- **저장**(v3 그대로, 필드 추가): `trainBreak{atk,rate,crit,multi,wall}` · `gemBreak{greed,pickaxe}`(0~999 정수) · `prep{card,rare,ward,forget}`(bool). 옛 저장은 0/false. `hero.js pickRarity`는 등급 가중치 배열도 받는다(`rollItem(stage, [5 가중치], rng, cls)`).
- **화면**: 정비 탭 '보석' → **'상점'**(`[상자 | 보석 강화 | 유물]` 세그먼트, 탭 점 = 보석 강화·보석 돌파·유물 해금 중 살 수 있는 것 — 상자는 반복 소비라 점 없음). 출정 탭에 **'출정 준비'** 카드(2×2, 누르면 사고 다시 누르면 환불, 합계 문구). 수련·보석 강화 행은 만렙이면 'MAX · 돌파 N단' + 보라·금 칩 '돌파 +x% ▶ +y%'. 상자 개봉 = 상자 흔들림 0.56초 → 방사광 + 등급 카드(리본·아이콘·주/부옵션·자동 장착 전투력 ▲·자동 판매 골드), 전설은 섬광, [확인] [한 번 더 (값)]. 탭하면 연출 건너뜀.

**지표(`node test/economy.js [시드…] [--off]`)** — 캠페인(`harness.campaign({ shop: true })`: 정산 직후 출정 준비 → 보석·수련(bot.js) → 돌파·유물·상자 1개) + 100층 뒤 100번 정비(마지막 세 도전 평균 수입). 3번째 열 '살 것'은 통화별로 살 수 있는(효과 있는) 것이 있나.
- 현재 작업 트리(다른 4차 트랙이 밸런스 조정 중 — 캠페인이 7~13회로 짧음) 시드 1~3: 살 게 없는 방문 **골드 0% · 보석 0%**(상자를 빼도 0%, 100층 뒤 100회도 0%). 방문 때 잔고는 도전 한 번 수입 안팎(골드 301 → 149K, 보석 40 → 850)이고 소비 뒤엔 거의 다 쓴다(골드 수백~3K · 보석 0~50).
- 소비 분포 — 캠페인 골드: 수련 82~86% · **출정 준비 12~16%** · 상자 2~3%, 보석: 강화 100% + 유물 12종 해금(상점 쓰는 봇). 100층 뒤 골드: 수련 26~31% · **수련 돌파 47~54%** · 출정 준비 15~16% · 상자 6%(돌파 2~6단), 보석: 강화 8~9% · **보석 돌파 48~58%** · 보석 상자 32~41% · 유물 1~2%(보석 돌파 12~14단). 100회 뒤 잔고 골드 52~65K(도전 한 번 수입 이하) · 보석 43~2.9K — 쌓이지 않는다.
- (통합 패스에서 바뀜) `npm test` 캠페인은 이제 **`shop:true`**가 기준이다(test/worker.js — 아래 '통합 · 밸런스' 절). `harness.campaign({ shop:false })`로 옛 방식 비교 가능.

#### 던전(지역) 특성 (DUNGEON 트랙 — `public/js/dungeons.js` · `dungeonui.js` · `art/dungeonfx.js` · `css/dungeon.css` · `test/dungeons.test.js`)
**데이터 = `DUNGEON_TRAITS[지역 키]`**(순수 데이터, 후일 세계 지도의 던전마다 그대로 붙인다) — `{ weak:[원소], resist:[원소], lore, rule:{ key, short, name, desc, …수치 } }`. 지역 키 = `THEMES[].key`(5테마, `stages.themeOf`). 판이 쓰는 특성 = `traitsOf(g)` = `g.traits`(후일 던전별로 넣을 자리) `||` 지금 테마. 배율 `ELEM_MUL = { weak: 1.3, resist: 0.75 }`.

| 지역 | 약점 | 내성 | 규칙 (`rule.key`) |
|---|---|---|---|
| 슬라임 초원 1~20 | 화염 | 암흑 | 번지는 들불 `wildfire` — 불타는 적이 쓰러지면 (남은 화상 + 최대 체력 12%) × 60%가 가까운 3마리(반경 110)에 화상 |
| 고블린 동굴 21~40 | 번개 | 바람 | 칠흑의 어둠 `darkness` — 사거리 윗선 `REACH.y` = 380 → 496(사거리 −20%). 영웅은 어둠 속에서도 싸운다 |
| 언데드 묘지 41~60 | 신성 | 냉기 | 되살아나는 망자 `undying` — 잡몹 25%가 체력 40%로 한 번 일어남. 신성 스킬 명중으로 쓰러지거나 불타는 적은 제외 |
| 화산 용암지대 61~80 | 냉기 | 화염 | 들끓는 열기 `heat` — 주문 시전 속도 ×0.85, 냉기 스킬(`g.book`, 융합이 품은 재료 포함)이 하나라도 있으면 없음 |
| 심연의 마왕성 81~100 | 암흑·바람 | 신성·번개 | 광기의 행진 `frenzy` — 적 이동 ×1.1(옛 심연 속도 보정을 규칙으로 옮김 — 값 같음, `stages.enemySpeedMul`이 `regionSpeed`) |

원소 6종이 각각 약점 1곳·내성 1곳(단위 테스트). 소환 원소는 늘 보통. 초원 내성을 암흑(피해 없는 저주·영혼 수확은 배율이 없다)으로 둔 것은 첫 도전들(1~20층)의 주력인 냉기·번개를 건드리지 않기 위해서다.

**원소 배율** `elemMul(g, key, kind)` — 스킬 키의 원소(융합 = **두 원소 배율의 평균**: 약점+보통 ×1.15 · 약점+내성 ×1.025), 키가 없으면 피해 원소 `kind`(fire·lightning·frost·wind·holy·dark), 피해 없는 스킬(서리 결계·질풍·수호의 빛·저주 낙인·영혼 수확·돌 골렘)은 1. 훅:
- `sim.spellHit`: 카드·융합 피해(`card`)에만 `raw *= em`(기본 주문·영웅·운석은 보통). `hit` 이벤트에 `em`. `onSpellHit`에는 원소 배율 **전** raw를 넘기고, 불꽃 마탄 화상·연쇄 번개 전이는 제 원소(`elemMul(g,'flameBullet'|'chainLightning')`)로 다시 곱한다. `g._hitSrc` = 지금 명중한 스킬 키/원소(망자 부활 판정).
- 시전 스킬 = `g._src`(spells.js): `tick`이 시전 동안 그 스킬 키(융합 = 융합 키), 머무는 효과는 `updateSpells`가 폭풍 `stormEye` · 드래곤 브레스 `babyDragon` · 유령 `ghostLegion`, 회오리는 불붙었으면 `blazeTornado`. 그 밖(얼음 창 투사체 등)은 `kind`로. 변이·새 투사체가 `g._src` 없이 `sHit`해도 `kind`로 맞게 떨어진다.
- 규칙 훅: `sim.step` 맨 앞 `applyReach(g)`(config `REACH.y` — `inReach`가 읽는다. 전역이지만 매 스텝 지금 판 기준) · `spells.spellRateMul × castRateMul(g)` · `sim.damage`의 처치 직전 `undying(g, e, emit)`(true면 처치 아님, 이벤트 `rise{x,y,r}`) · `sim.killEnemy`의 `regionKill(g, e, emit)`(이벤트 `wildfire{x,y,pts}`).
- 끄기: `DG_TEST.off = true`(테스트·A/B 워커 전용 프로세스 스위치 — 광기의 행진 속도는 옛 값이라 끄지 않는다).

**봇** `pickBias(g, key)` → `bot.pickCard` 점수에 더함: 지금 지역 약점 +4 · 내성 −3 · 규칙 해소(화산의 냉기) +6, 지역 끝 5층 안이면 다음 지역 것 ×0.75도. 합체 ✦(100)·협공(40)·융합 강화(35)가 여전히 앞선다 — '조금' 맞춘다. 카드 '자동 선택'의 추천 카드도 같은 점수.

**화면**
- `dungeonui.js createDungeonUI({ stage, hudLeft, showTip })` → `update(v, busy)` · `card(btn, key, v)` · `slots(v, slots)` · `tip(v, key)`. ui.js 훅 4줄(`// 던전`). `skillAffinity(g, key[, theme])` → `{ mul, tag:'weak'|'resist'|null, cure }`, `regionView(theme)` = 배너·칩·툴팁용 요약.
- **지역 시작 배너**: 새 도전·이어하기·지역이 바뀐 층에서, 캔버스 '새 층' 도장 뒤(`phaseT ≥ 1.5`) + 카드·유물·모달이 없을 때 HUD 아래에 톡 — '지역 특성' 리본 · 지역 이름 · 약점 +30%(금빛 원소 알약) · 내성 −25%(회색) · 규칙 이름/설명. 4.2초 뒤 또는 탭하면 닫힘. 좁은 화면은 오른쪽 스킬 스택을 비켜 왼쪽 정렬, 넓은 화면은 전장 가운데.
- **HUD 칩**(`#hud-left` 맨 앞, `.st-chip.dg-chip[data-r]` 지역색): 약점 원소 아이콘(▲) · 내성(흐린 ▼) · 규칙 한 단어(`rule.short`). 탭 = 자세한 툴팁(층 범위·배율·규칙·지역 설명).
- **카드 배지** `.pc-dg`: '약점!'(초록 젤리, 숨쉬기) · '내성'(회색) · '열기 해소'(화산에서 냉기 스킬이 아직 없을 때, 하늘색). **스택 칸** `.dg-sb` ▲/▼, 칸 툴팁에 '고블린 동굴: 약점 — 피해 +30%' 한 줄.
- **캔버스**(`art/dungeonfx.js`, render.js 훅 2줄 · fx.js 숫자 훅 1줄): 약점 명중 숫자 = 라임(`#b8ff3a`, 배지와 같은 색) · 내성 = 흐린 회색 · '약점!' 꼬리표 0.6초에 한 번(숫자 설정 '전체'일 때만) · 망자 부활 = 흙먼지 + 청록 영혼 불꽃 + 고리 + '부활!' · 들불 = 불씨가 이웃으로 튄다 · 동굴 어둠 = 사거리 윗선 위를 어둡게(적 위 · 마법 아래 — 마법이 어둠을 밝힌다) + 경계의 흔들리는 횃불 띠.

**밸런스(A/B — 깨끗한 v0.0.8 트리 + 던전 트랙만, 시드 1~3, `npm test` 캠페인 러너와 같은 봇)**
- 켬/끔: 도전 **25.0 / 27.3회** · 도전당 **+3.73 / +3.41층** · **19.5 / 17.6h** · 첫 도전 10.7 / 10.3층 · 3번째 도전부터 합체 **3.14 / 2.74회**(약점 원소로 모이는 빌드가 짝을 더 빨리 만렙으로) · 후반 빌드 융합 3.92개. `node test/sim.test.js` 캠페인·동등성 전부 통과(협공 +14% · 클래스 기사 +3 · 궁수 −8 · 마법사 +11 · 성직자 −4 · 암살자 −2%).
- 지역별 새 층 클리어(초, 켬/끔): 초원 68.1/70.9 · 동굴 78.3/84.3 · 묘지 88.8/94.8 · 화산 **91.5/87.2**(열기) · 심연 105.7/116.5. 도전이 끝난 지역(켬/끔, 75/79회): 초원 14/24 · 동굴 8/18 · 묘지 29/26 · 화산 8/3 · 심연 13/8 — 묘지(망자)·화산(열기)이 벽이 되고 초원·동굴은 약점 빌드로 빨리 지나간다.
- 원소 생존성(최고 20층+ 도전의 주력 원소별 '도달 ÷ 최고'): 켬 화염 1.02 · 번개 1.05 · 냉기 1.01 · 바람 1.02 · 암흑 1.02 · 신성 0.91 · 소환 0.90 (끔 0.71~1.27 — 표본이 작아 흔들림). 죽은 원소 없음.
- 측정 스크립트(스크래치, 저장소 밖): 지역별 처치 속도는 `harness.playRun`의 `floors[{s,t}]`를 20층 단위로 묶으면 된다. 전체 캠페인이 약간 쉬워졌으므로(도전당 +0.3층) 최종 밸런스 패스가 `DIFF`를 소폭 올려도 된다.

#### 변이 (MUTATIONS 트랙 — `public/js/mutations.js` · `mutui.js` · `art/mutfx.js` · `css/mutation.css` · `test/mutations.test.js`)
**규칙.** Lv6(만렙)이 된 기본 스킬 14종·융합 스킬 8종은 **두 갈래 변이 중 하나**를 고른다(스킬당 1회, 22 × 2 = 44). 변이는 수치가 아니라 **작동 방식**(표적·모양·개수·지속·궤적·끌어당김·분열·공전·연쇄·장판·소환)을 바꾼다.
- 카드: `genCards`가 변이 대기(`pendingMutations(g)` = Lv6 · 변이 없음, 슬롯 순서) 중 하나를 **늘 한 장** 넣고, 나머지 대기는 강화·새 스킬 카드로 자리를 채우고도 남을 때만 더 넣는다. 카드 = `{ spell, mutate:true, muts:[A, B], level:6, rarity:'legend', fusion, fusionHint:false }`. 도전 시작 무료 카드(starter)엔 없다.
- 고르기 `act(g, 0, {type:'pick', index, choice: 0|1})`(choice가 없거나 틀리면 추천 갈래 `mutChoice` — 자동 선택·봇·`tickPick`) → `g.mutations[스킬] = 변이 키` + `spellPick{ spell, mutate: 변이 키, rarity:'legend' }`(level 없음 → MAX 연출 없음). UI `H.onPick(index, choice)`.
- **각성은 최후의 선택**: 강화할 것 · 변이 · 빈 칸(새 스킬)이 하나라도 있으면 각성 카드는 없다(유물 트랙의 '비우기' 버튼은 카드 화면에 그대로 — 각성 카드만 뜬 화면에서도 비우면 새 스킬 카드가 다시 뽑힌다).
- **합체하면 변이 소멸**: 변이한 재료도 레벨 6이라 `FUSIONS[].ready`로 그대로 합체 → `refreshFusion`의 `pruneMutations(g)`가 빠진 스킬·만렙 아닌 스킬의 변이를 지운다(융합 Lv1, 망각도 같은 경로). 카드 ✦ 띠에 '→ 이름 · 변이 소멸' 경고.
- 저장: `serializeRun.mutations`, `normalizeRun` → `normalizeMutations(raw, spells)`(지금 가진 Lv6 스킬의 제 변이만, 옛 저장 = `{}`, throw 없음).
- API(`mutations.js`): `MUTATIONS[스킬] = [{ key, name, short(카드 한 줄), desc(툴팁), col, cd(시전형 쿨타임 배율), bot }, …]` · `MUT_BY_KEY` · `MUT_KEYS` · `mutOf` · `pendingMutations` · `mutationCard` · `mutChoice` · `applyMutation` · `pruneMutations` · `normalizeMutations` · `mutCdMul`(스택 쿨타임 링).
- 시뮬 훅(`spells.js`, `// 변이` 표시): 시전형은 `tick`이 `mutCast(g, key) || CAST/FCAST`를 부르고 `KIT`(pd · sHit · cast · densest · burnOn · chilled · isSupport · base(CAST) · lv · rate)을 넘긴다. 지속·소환형은 `mutTick`(updateSpells 끝) · `mutOnHit`(onSpellHit — 변이한 연쇄 번개는 기본 전이 대신) · `mutOnKill`(onKill) · `mutSlow`(frostSlowMul) · `mutCurse`(`curseMul(g, e)` — sim `damage`가 e를 넘긴다) · `mutOwns`(새끼 드래곤 변이는 자체 비행). 기본 배열 확장 두 줄: 얼음 창 `l.pierce`, 회오리 `tn.vx`. 전장 물체 `g.spellFx.mut[{k, m, t, …}]`(스테이지마다 새로, 최대 64) · 타이머 `g.spellFx.mt`(soul·reap·well·wsA·d2·hexY…). 던전 원소 배율용 `g._src`는 물체마다 그 변이의 스킬.
- 이벤트: `mutFx{ m, x, y, … }`(연출 전용 — sim·UI는 무시) · 기본 `spell{…, mut}`(기본 연출 위에 덧그림).
- 화면: 카드 = 'Lv6 변이' 띠 + 무지개 테 + **A/B 두 갈래(이름 + 무엇이 바뀌나)** — 갈래를 눌러 고른다(키보드 Enter = 추천 갈래), 자동 선택 ON이면 추천 갈래에 '추천'. 스택 칸 = 무지개 고리 + 갈래 보석(A/B · 변이 색), 넓은 화면 이름 줄 '변이 · 이름', 툴팁에 변이 설명 · Lv6 미변이면 '변이 대기'. **강화 카드 설명 = 수치 '전 → 후' 줄**(`upgradeHTML` — '마력 400% → 500%', 최대 3줄) + Lv6 카드엔 'Lv6 완전체 연출 · 변이 해금'.
- 그림(`art/mutfx.js`, render.js: events → update → `drawGround`(서리 결계 위) → `draw`(새끼 드래곤 뒤)): 변이마다 고유 모양. 흰 코어 없는 `hu()`·원소 색, 형태(창·낫·기사·거울·얼음 감옥·지뢰·검은 해)는 보통 합성, 흐르는 입자는 20Hz — 광량 예산 안.

| 스킬 | A | B |
|---|---|---|
| 파이어볼 | 분열 화염구 — 3갈래 서로 다른 무리 + 착탄마다 연쇄 폭발 3 | 태양 구체 — 느린 거대 구체가 성벽→전선 떠오르며 관통해 태움 |
| 불꽃 마탄 | 들불 — 불탄 적이 쓰러지면 가까운 3마리에 화상 전염(연쇄) | 불바다 — 맞힌 자리에 2.5초 타는 장판 |
| 낙뢰 | 천벌 — 모든 줄기가 가장 강한 적(보스 먼저) 하나에 연달아 + 기절 | 뇌운 — 무리를 따라다니며 4초간 벼락 치는 먹구름 |
| 연쇄 번개 | 구전 — 전이 대신 떠돌며 주변을 지지는 번개 구체 | 전류 사슬 — 두 적을 2초 전류로 묶어 둘·그 사이를 지짐 |
| 얼음 창 | 빙창 부채 — 5자루 부채꼴(3관통) | 빙하 창 — 느린 거대 창이 닿는 적을 얼리고 끝에서 파편 6 |
| 서리 결계 | 영구 동토 — 적 무리 밑에 6초 얼어붙은 땅(강한 둔화 + 피해) | 얼음 거울 — 적 투사체를 되쏘고 성벽을 치는 적에 냉기 반격 |
| 회오리 | 진공 소용돌이 — 제자리에서 빨아들인 뒤 폭발 | 횡단 돌풍 — 좌우에서 두 회오리가 가로질러 휩쓸기 |
| 질풍 | 바람 칼날 — 관통하는 칼날 3줄기 주기 발사(시전 속도 유지) | 바람 정령 — 성벽 앞을 도는 정령 3(베고 밀침) |
| 수호의 빛 | 성역 파동 — 3초마다 성벽에서 퍼지는 빛 고리(태우고 밀침) | 빛의 샘 — 넘친 치유가 모여 앞선 적 5에게 빛의 창 |
| 심판 광선 | 십자 심판 — 세로 + 가로 십자 광선 | 쓸어내는 광선 — 1.4초 동안 옆으로 쓸기 |
| 저주 낙인 | 파멸 낙인 — 강한 적에 3초 낙인, 받은 피해 일부가 폭발 | 저주 장막 — 무리를 따라다니는 띠 안 ×1.7 · 밖 ×0.45 |
| 영혼 수확 | 영혼 일제 사격 — 영혼 12개 → 추적 영혼 6발 | 사신의 낫 — 10처치마다 한 줄 휩쓸어 체력 20% 이하 처형 |
| 새끼 드래곤 | 쌍둥이 용 — 두 높이에서 번갈아 브레스 | 급강하 — 브레스 대신 밀집 무리로 내리꽂혀 화염 폭발 |
| 돌 골렘 | 대지 강타 — 무리 앞으로 걸어가 내려찍기(기절) | 파편 재조립 — 부서지면 폭발 → 5초 뒤 재조립 + 가시 반격 |
| 불꽃 회오리 | 방랑 화염 — 가장 가까운 적을 쫓아 5초 떠돎 | 화염 고리 — 작은 회오리 넷이 원을 그리며 공전 |
| 초전도 | 결빙 회로 — 한 줄기가 적에서 적으로 이어지며 모두 얼림 | 얼음 감옥 — 앞선 적을 2초 가둔 뒤 파편 |
| 증기 폭발 | 간헐천 — 간헐천 3개가 3초 동안 분출 | 압력 폭발 — 1.2초 빨아들인 뒤 대폭발 |
| 폭풍의 눈 | 떠도는 폭풍 — 전장을 가로지르며 끌고 벼락 | 쌍둥이 눈 — 두 무리에 작은 눈 + 둘 사이 번개 다리 |
| 황혼 | 일식 — 검은 해가 3초간 광선 난사(저주) | 황혼의 물결 — 가로 물결이 전장 전체를 훑음(저주 + 밀침) |
| 플라즈마 | 플라즈마 레일 — 성벽→전선 일직선 관통 + 번개 갈래 | 플라즈마 지뢰 — 길목에 지뢰 3, 밟으면 폭발 + 번개 |
| 망령 군단 | 망령 기사 — 6초간 누비며 베는 기사 2 | 유령 돌격 — 세로 기둥으로 일제히 관통 |
| 수호룡 | 용의 비호 — 3초 성벽 위 화염 장막 + 투사체 차단 + 치유 | 성룡 낙하 — 가장 강한 적에 수직 낙하 + 충격파 |

**강도**(`node test/mutations.test.js` 표 — 14층·같은 시드·20초, 보조 스킬 Lv3와 함께, Lv6 기본 대비 내 전체 피해): 시전형은 대부분 ×0.85~1.3(천벌 0.88·빙하 창 0.98·쓸어내는 광선 1.10 — 단일·보스 쪽, 진공 소용돌이 1.52는 끌어모아 다른 스킬을 돕는 값). 피해가 없던 지속형(질풍·수호의 빛·서리 결계·돌 골렘)은 변이로 피해가 생겨 ×2 안팎 — 6칸 빌드 전체에선 한 칸 몫이다. 용의 비호 0.62는 치유·투사체 차단 대가. 캠페인 영향은 밸런스 패스가 `npm test`로 본다(봇은 변이 카드 38점 — 곧 합체할 짝의 재료면 16점).

#### 특성 택1 = 전략 (TALENTS 트랙 — `public/js/talents.js` · `talentui.js` · `public/hero.css` · hero.js 특성 훅 · `test/talents.test.js`)
플레이테스트: v0.0.8 트리의 택1 다수가 '+수치 A vs +수치 B'였다. **택1 30쌍(15갈래 × 2)을 전부 '싸우는 방식'을 바꾸는 두 갈래로** 바꿨다. 규칙(6단 · 궁극 하나 · Lv99 예산 = 한 갈래 + 나머지 절반 · 혼합 노드)과 노드 키(X4·X5 = 2단 묶음 a, X9·X10 = 4단 묶음 b)는 그대로다.
- 노드 필드 추가: `tag`(분류 `TALENT_TAGS` = 표적 · 위치 · 발동 · 자원 · 협동) · `brief`(트리에 보이는 한 줄 요약, 10자 이하). 택1은 모두 2랭크, 효과 키 하나, 문구에 숫자.
- 새 효과 키 27개(`TALENT_FX_KEYS` — 전부 hero.js/sim.js 훅, 숫자는 클래스마다 표 데이터):
  - 표적(`pickTarget` 점수 + 피해 `mul`): `hunt`(정예·보스 +3점, 피해 +) · `guardWall`(성벽 가까울수록, 성벽 200 안 피해 +) · `cull`(체력 비율 낮을수록, 50% 이하 피해 +) · `focus`(현재 표적 +2점, 같은 표적 타마다 +, 5중첩).
  - 위치: `hold`(성벽 앞 `HOLD_Y` = WALL_Y−240 선 위로 안 나감 · 선 밖 적 무시 · 피해 감소 + 도발 반경 ×200) · `charge`(5초마다 150↑ 먼 적에 4배속 돌진 → 반경 80 피해 + 0.6초 기절) · `pointBlank`(원거리가 물러나지 않고 190까지 붙음, 200 안 피해 +) · `chillAura`(값 = 반경, 주변 적 계속 둔화 + 값+30까지 다가감) · `killBlink`(처치 시 확률로 순간이동 대기 0 + `hop` = 거리 무관 도약) · `longshot`(혼합: 사거리 +값/2, 거리 비례 피해 +).
  - 발동: `heavy`(3타마다 피해 + · 0.5초 기절) · `cleave`(주 표적 주변 60 aoe) · `bounce`(값 = 튕김 수, 30%) · `split`(값 = 갈래 수, `SPLIT_K` 0.3 + 광역) · `corpse`(영웅 처치 → 반경 80 폭발, 폭발로 죽은 적도 터짐) · `evade`(맞을 때 확률로 무효 + 반격 100%) · `wolfStun`.
  - 자원: `ultCharge`(공격마다 궁극기 대기 −값초 — 클래스 공속에 맞춰 기사 0.12 · 궁수 0.07 · 마법사 0.14 · 성직자 0.12 · 암살자 0.08) · `soulFeed`(영웅 처치 → `g.spellT` −값초, 영혼 사냥과 같은 방식) · `lifesteal`(공격마다 체력 %) · `berserk`(50% 아래 피해 +) — 둘 다 후퇴 기준 30% → 15% · `wolfUlt`(궁극기 뒤 8초 `h.packT` 동안 늑대 +값).
  - 협동: `mark`(영웅의 **주 표적**·늑대가 문 적 `e.markAt = phaseT + 3` → sim.js `spellHit`가 마법사 주문 ×(1+값)) · `pull`(6초마다 영웅 표적 주변 200 안 비보스 적을 표적 쪽으로 값만큼) · `ultBless`(궁극기 → `g.heroBuff` 5초, 전군 강화 함성과 같은 통로).
  - 늑대 표적(`updateSummons`): `wolfGuard`(성벽에 가장 가까운 적, 영웅 곁 목줄 없음) · `wolfFocus`(영웅 표적만) — 둘 다 늑대 피해 +.
- 지운 키(쓰는 노드 없음): `pierce` · `undead` · `bossExec`. 혼합 노드 중 수치 섞기 4개를 동작으로: 궁수 `hunter` 사냥 표식(mark + 늑대 피해) · `windShot` 바람 사수(longshot) · 마법사 `elemental` 원소 과부하(heavy 0.4) · 성직자 `consecrate` 축성의 사슬(pull + 골드). 핵심 노드 15종은 이미 동작형이라 그대로.
- 이벤트(연출 art/fx.js): `heroProc{kind:'nova', sub, col, r, pts?}` sub = charge · heavy · chill · corpse · evade · pull(고리가 조여 들고 `pts`에서 빛 알갱이) · ultBless, `heroProc{kind:'bolt', cls, x, y, tx, ty}`(도탄·비전 연쇄·분열 화염 작은 탄).
- 저장: `TALENT_VER` 3. `migrateTalents(raw, 2, level)` = X4·X5·X9·X10 또는 바뀐 혼합 4개에 포인트가 있는 **클래스만 환불** + `talentNotice`(기존 안내 흐름), 나머지 클래스는 유지. 버전 없음 = 전부 환불(그대로).
- 추천(봇·자동 배분 `TALENT_RECOMMEND.picks`): 기사 돌격·휩쓸기 / 가시·도발 장악 / 전과 보고·표적 지정 · 궁수 근접 속사·폭발 화살 / 거인 사냥·도탄 / 사냥 늑대·늑대 소집 · 마법사 분열 화염·성벽 화염 / 마나 폭주·비전 표식 / 빙결·서리 사슬 · 성직자 이단 심판·철퇴 휩쓸기 / 생명 흡수·정화 / 축복 전달·자비의 일격 · 암살자 먹잇감·강타 / 독 확산·독 폭발 / 그림자 도약·회전 베기.
- UI(`talentui.js`): 택1 두 쪽 아래 분류 알약(색: 표적 붉은 · 위치 하늘 · 발동 금 · 자원 초록 · 협동 보라) + 한 줄 요약 — 폰 360에서 두 쪽 차이가 트리에서 바로 보인다. 상세 시트는 분류 태그 + '또는' 다음 쪽 비교 카드(누르면 그쪽 시트).
- 밸런스(HEAD v0.0.8 대비, 같은 메타 고정 비교 — 캠페인 시드 1~4의 최고 50·75층 메타 8개 × 클래스마다 10~14회, 특성은 빈 상태에서 추천대로): 평균 도달 층 HEAD 60.8 → 62.7(+3%), 클래스 편차는 HEAD와 같은 모양(기사 −0 · 궁수 −4 · 마법사 +13 · 성직자 −12 · 암살자 +3% ← HEAD +5 · −4 · +12 · −9 · −3%). 낮은 영웅 레벨 메타(Lv34~43 포함): HEAD 56.1 → 57.1, 클래스 편차 ±10% 안. `npm test` 캠페인(이 트랙만 얹은 HEAD): 도전당 +3.6~3.7층 · 25~26회 · 영웅 기여도 31%(HEAD +3.41 · 27회 · 30%). 택1 두 쪽 봇 비교 예: 궁수 근접 속사 60.9 vs 화살비 장전 54~55층, 마법사 분열 화염 70 vs 불씨 폭발 69, 성직자 이단 심판 56 vs 천벌 54 — 표적·보스 우선은 층수에, 폭발·오라는 성벽 방어·연출에 강하다(봇 추천은 층수 기준).

#### 통합 · 밸런스 (INTEGRATE 패스 — 배속 해금 · 전투 상태 줄 · 방치 비상 스킬 · 캠페인 기준)
**배속 해금**(spec 8 — 사용자: "속도는 처음에는 1배. 좀 깨야지 2배, 이후 고수되면 3배")
- `config.js SPEED_UNLOCK = { 2: 10, 3: 30 }` · `speedCap(best)` → 1|2|3(영구 최고 기록 `meta.best`) · `nextSpeed(cur, best)`(열린 단계만 순환, 끝이면 1). 옛 `SPEED3_UNLOCK`(20)은 없다.
- save.js `normalize`: 저장 배속이 해금 범위를 넘으면 `min(speed, speedCap(best))` — 기존 저장도 기록대로 바로 적용. main.js `allowedSpeed`·`onSpeed`가 같은 함수, 매 프레임 `meta.speedCap`을 ui에 넘긴다.
- ui.js: 배속 버튼 아래 작은 자물쇠 줄 = **다음 잠긴 단계**('2x 🔒', 다 열리면 숨김). 열린 끝에서 누르면 토스트 '2배속: 10층 돌파 시 해금'(자물쇠 아이콘). 해금 순간(`clear`로 `speedCap`이 오르면 1.6초 뒤) `ui.speedUnlocked(n)` = 토스트 'n배속 해금! 배속 버튼을 눌러 보세요' + 버튼 금빛 고리 톡(`.spd.unlock`).
- 테스트: `test/save.test.js` 끝(해금 표 · 순환 · 저장 클램프).

**전투 상태 한 줄**(spec 9 — 사용자: "콤보 표시가 화면을 많이 가려서")
- DOM `#st-row`(index.html `#hud-center` 안, 진행 바 바로 아래 가운데): `#combo`(콤보 알약 '콤보 294 전설' — 단계 색 `data-t` 0~4) · `#st-frenzy`('광란 x2') · `#st-legend`('골드 x2') · `#berserk`('광폭화 x4' / '광폭화 10초'). 남은 시간 = 알약 아래 2px 게이지(`.st-g > i` scaleX). 너비 `min(260px, 100vw − 196px)` — 왼쪽 지역 칩·오른쪽 영웅 버튼을 비켜 넘치면 두 줄. 보스전엔 보스바 아래(`#stage.boss-on .st-row`). 갱신 = ui.js `updateCombo(v)`(키가 바뀔 때만 글자, 게이지는 값이 바뀔 때만).
- 캔버스(`art/hud.js`)는 **단계 상승 순간만**: 이벤트 `combo{tier}` → 상태 줄 바로 아래 가운데에 0.8초(슬램 0.14초 → 머묾 → 0.52초부터 알약으로 날아가며 0.22배·흐려짐), x50/x100은 회전 광선. 알약 위치 = main.js가 0.5초마다 `#combo`(숨었으면 `#st-row`) 가운데를 재서 `renderer.frame(opts.comboAt)` → `hud.setComboAnchor`. 알약은 0.76초 뒤 받아서 톡(밝게 1.4배 → 1). 옛 오른쪽 중단 큰 카운터 · 캔버스 광란/전설 알약 · `setStackLeft`는 지웠다. 360×640 · 390×844 · 1000×880에서 지역 칩·영웅 버튼·스킬 스택과 겹치지 않음 확인.

**방치 플레이 비상 스킬**(3차 남은 일): 자동 진행 ON(`players[i].auto`)이면 사람 플레이어도 `bot.autoSkill`(운석·빙결, 유물 봉인은 건너뜀)이 돈다 — 옛 AI 동료가 대신 누르던 몫. sim.js `step` 한 줄. 토스트·aria 문구 '다음 층·궁극기·운석·빙결 자동'. `harness.humanPlayer`(자동 진행 + 카드 자동 선택)도 이제 비상 스킬을 쓴다 — '사람 첫 도전' 10.7 → 11.4층(목표 8~15).

**정리**: `art/units.js`의 옛 'upgrade' 이벤트(도전 중 골드 강화)·`upGlow` 삭제. ART.md §9.1·§10.2·§12(광량 예산)·§14(파일 소유: 던전·상점 행, units/hud/fx 계약 — `drawEnemyReveal`·레벨 연출 계약·`setComboAnchor`) 갱신.

**크로스 트랙 확인**(스크래치 러너, 12시드 × 최고 60층 메타 · 유물 20종 해금 · 1~60층): 카드 선택과 유물 선택이 동시에 떠 있는 순간 0 · 스킬 레벨 1~6 밖 0 · 변이가 Lv6 보유 스킬이 아닌 곳에 남은 경우 0(합체·망각·왕관 칸 잃기 뒤에도) · `slotsUsed ≤ slotCap`(왕관) · 층 체크포인트 `serializeRun → normalizeRun` 멱등. 브라우저(390×844, 3배속): 새 도전 → 10층 네임드 보스 → 유물 3택(사냥꾼) → 14층까지, 변이 카드(A/B) · 비우기 시트(카운트다운 멈춤 → 확인 → 카드 다시 뽑힘) · 카드 자동 선택 · 이어하기 — 게임 코드 콘솔 에러 0(브라우저 창이 서비스 워커 등록만 거부: `sw.js`는 200으로 서빙, `pwa.js`가 catch).

**캠페인 기준 = 상점까지 쓰는 봇**(`test/worker.js campaign({ shop: true })` — 정산 직후 출정 준비 → 보석 강화·수련 → 돌파·유물 해금·상자 1개). 행에 `muts`(변이 키) · `relics` · `forgets` · `idle{gold,gems}`(정산 직후·소비 전 통화별로 살 수 있는 것이 없나). `campaignReport`가 '전략' 줄(20층+ 도전의 변이·유물·망각 수, 셋 다 없는 도전 수, 도전이 끝난 지역, 살 게 없는 방문)과 유물 분포를 찍고 `campaignCheck`가 **셋 다 없는 20층+ 도전 0 · 살 게 없는 방문 0**을 확인한다.

**밸런스 결과**(`npm test`, 결정적 — 수치 조정 없이 목표 안: 4차 트랙들의 쉬워지는 쪽(유물·출정 준비·지역 약점 빌드)과 어려워지는 쪽(변이 카드가 강화 카드 자리를 나눔·묘지 망자·화산 열기·유물의 대가)이 상쇄됐다. 상점 없는 캠페인은 36회 · +2.6층/회 · 28.6h로 목표 밖 — 출정 준비가 들어간 지금 기준이 맞다)
- 시드 1~3: 첫 도전 **4 · 14 · 11층**(평균 9.7) · 도전당 **+3.56 · +3.44 · +2.41층**(+3.13) · **28 · 26 · 38회**(30.7) · **18.5 · 19.5 · 29.4h**(22.5) · 절반 이하 층 26.1초 · 새 층 78.5초 · 특성 완성 영웅 기여도 30.7% · 11층부터 스킬 비중 98.7%(도전별 최저 87~93%).
- 융합: 3번째 도전부터 도전당 **3.06회**(2~6회차도 대부분 1회 — 3차의 0~1회보다 나아짐) · 후반 빌드 3.96개 · 첫 합체 8.7층.
- 전략(20층+ 도전 73회): 변이 3.1~3.9 · 유물 5.2~6.2 · 망각 1.3~2.0 /도전 — **셋 다 없는 도전 0**. 도전이 끝난 지역(초원/동굴/묘지/화산/심연) 19/9/28/18/15 — 묘지(망자)·화산(열기)이 벽, 초원·동굴은 약점 빌드로 빨리 지남. 원소 생존성은 던전 절 측정(0.90~1.05 — 죽은 원소 없음).
- 유물 분포(봇): 불사조·쌍둥이 달·성배·사냥꾼 > 도둑·왕관 > 유리 대포 > 해금 유물(공명·깃발·메아리·흡혈 …). 시작 풀 8종이 대부분인 건 해금이 보석 강화 뒤라서.
- 경제(`node test/economy.js 1 2 3`): 살 게 없는 방문 골드 0% · 보석 0%(상자 빼도 0%, 100층 뒤 100회도 0%). 캠페인 골드 수련 78~83% · 출정 준비 13~17% · 상자 3~5%, 보석 강화 63~97% · 보석 돌파 0~28% · 유물 3~9%(12종 해금). 100층 뒤 100회 잔고 166K~496K 골드(도전 1~3회 수입) · 1.7~2.2K 보석.
- 협공 **+15%**(기사 +7 · 궁수 +19 · 마법사 +8 · 성직자 +13 · 암살자 +30%). 클래스 동등성(최고 51~65층 메타, 24회씩): 기사 **+11%** · 궁수 **−11%** · 마법사 +3% · 성직자 −7% · 암살자 +4%(영웅 기여도 25~38%).
- 초반 템포(1~10층): 교전 생존 1.81초 · 중앙 띠 처치 93% · 영웅 중앙 띠 93% · 스킬 시전 112/분 · 1~9층 패배 없음. 사람 첫 도전(자동 진행) 11.4층.
- **주의**: 시드 1의 첫 도전(기사, 시드 1000)은 봇이 1~4층에 새 지속형 스킬(골렘·서리 결계·저주)로 칸을 채우고 5층에서 진다 — 봇 카드 점수(새 스킬 8+가치+짝 6 > 강화 12)의 운 나쁜 경우이고 같은 조건의 다른 시드(1001~5000)는 11~15층. 사람 기준 첫 도전(`humanFirstRun` 12판)은 10~13층.


#### 리뷰 · 플레이테스트 수정 (FIX 패스)
회귀 테스트 `test/fix4.test.js`(npm test에 포함).
- **따라잡기 카드**(플레이테스트: "24~40층 내내 남은 Lv1 스킬 +1만 뜬다"): `sim.CATCHUP_FROM`(30)층 **뒤** Lv3 미만 기본 스킬 카드(새 스킬 포함)는 한 장에 +1레벨 더(`catchUp(g, key)` · 카드 `catchUp:true`, 카드 희귀도 줄 '따라잡기 +1'). 융합 스킬은 제외. 20층부터로 재면 궁수 동등성 −17%·후반 융합 4.00(목표 끝)이라 30층으로 뒀다.
- **카드 `from`**: `genCards` 카드마다 `from`(지금 레벨, 0 = 새 스킬). UI 태그·레벨 칸·aria·수치 줄이 `from → level`(쌍둥이 달·따라잡기 2레벨). `mutui.upgradeLines(key, level, from)` · `upgradeHTML(key, level, from, maxLines)`. 새 스킬이 Lv2로 들어오면 'NEW Lv2'.
- **좁은 카드**: 강화 수치 줄은 폰에서 카드 4~5장이면 2줄, 그래도 넘치면 `fitPickDescs`가 마지막 수치 줄부터 뺀다(반쪽 줄 없음). 변이 카드는 갈래 설명이 잘리면 `.narrow`(갈래 이름 + '눌러서 자세히') → 누르면 **A/B 시트**(`mutui.createMutSheet` — 두 갈래 이름·한 줄·설명 전문, 거기서 고른다. 시트가 열린 동안 자동 선택 카운트다운 멈춤, 뒤로가기 = 닫기).
- **유물 화면 문맥 줄**(`relicui ctxLine`): 광기의 왕관 = '잃는 스킬: 서리 결계 Lv1'(`relics.weakestSkill(g)` — `dropOverCap`과 같은 규칙) · 원소 공명 = 지금 공명하는 원소(`relics.resonant(g)`, `g._res` 캐시 — `refreshFusion`이 비움) · 지팡이 = 융합 수. 20·40·60·80층(이어하기면 21·41…층) 유물 화면 위에 **다음 지역 띠**(약점·내성·규칙). 짧은 화면(≤760px)은 카드를 줄인다. ponytail: 왕관이 잃을 스킬을 고르게 하진 않았다(미리 보여 주기만).
- **다음 지역 배지**: 지역 끝 5층 카드에 '다음 지역 약점'/'다음 지역 열기 해소' 작은 꼬리표(`.pc-dg2`, 봇 `pickBias`와 같은 창). 변이 카드도 지역 배지를 다시 칠한다(옛 카드 배지가 남던 버그).
- **망각**: 확인 단계에 '변이(이름)도 사라져요' · '(융합) 재료예요(재료 n/6)' · 다시 배우면 Lv(쌍둥이 달·따라잡기 반영). 비우기 버튼은 스킬 3개 이상이거나 칸이 찼을 때만. 비운 뒤 새 카드는 자동 선택 카운트다운도 처음부터(`forgetSkill`).
- **HUD**: 지역 배너가 닫히는 중 매 프레임 `hideBanner`가 타이머를 지워 투명한 배너가 탭을 막던 버그(`.dg-banner.out`은 `pointer-events:none`). 스택 칸 ▲/▼는 구슬 왼쪽 아래(왼쪽 위 = 변이 갈래 보석). 보스전엔 `#hud-left`(지역·부활 칩)도 보스 바 아래. 광폭화 알약은 전투 중에만, x1.1 전엔 '광폭화!'. 카드 머리 '스킬 칸 n/cap'(왕관).
- **배속 해금 연출**: 10·30층(유물 층)에선 유물을 고른 뒤 0.9초에(`main.js speedUnlockDue`). 옛 저장 배속이 내려갔으면 첫 도전 시작에 '3배속은 이제 최고 30층 돌파 때 열려요' 한 번.
- **결과 · 이어하기**: 결과 `Summary.mutations` → 스킬 줄에 갈래 보석 + 변이 이름. 이어하기 창 스킬 칩에 갈래 보석, 유물이 떠 있으면 '유물 선택 대기 중'. 특성 개편 안내는 포인트가 이미 추천 빌드로 찍혀 있으면 그 문구 + '특성 보기 · 무료 초기화'.
- **장비**: 상자(`openBox`)와 전투 드롭(`lootDrop`) 모두 **장착 먼저 → 가방 정리**(`hero.trimBag`) — 가방이 가득 차도 더 좋은 새 장비가 팔려 나가지 않는다. 상자 결과가 바로 팔렸으면 '가방이 가득 차 바로 팔았어요 +N'. 유물 도감 줄 순서는 탭을 열 때 한 번만 정한다(사자마자 줄이 움직여 두 번 탭이 다음 유물을 사던 버그).
- **sim**: `startStage`가 `applyReach`(카드·유물로 step이 멈춘 층 시작에 지난 판 동굴 어둠이 남던 것) · `refreshFusion`이 `run.legacy`에서 없는 융합을 뺀다(망각·왕관 뒤 다시 만든 융합은 새 규칙).
- **핫패스**: `dungeons.skillElements`·`elemMul`은 미리 만든 상수 배열(명중마다 할당 없음) · 공명 캐시 · 동굴 어둠/저주 장막/황혼 물결 그라디언트 캐시 · `dungeonui.slots` 서명. ponytail: `fx.js` 번개 `zig()` 점 배열은 그대로(프레임당 몇 개).
- **밸런스**(`npm test`, 결정적): 시드 1~3 첫 도전 4·14·11층 · 도전당 **+3.20·+3.44·+3.07층**(+3.24) · **31·26·30회**(29.0) · 21.0h · 3번째 도전부터 합체 2.95회 · 후반 빌드 융합 3.65개 · 협공 +14% · 클래스 동등성 기사 +9 · 궁수 −13 · 마법사 +2 · 성직자 +4 · 암살자 −2% · 사람 첫 도전 11.4층. (따라잡기를 뺀 같은 트리 +3.23층 · 29.7회 · 궁수 −12% — 따라잡기는 후반 속도만 조금 올린다. 궁수는 원래 동등성 하한 근처.)

### 4차 닉네임(프로필) 계약 — 나중에 서버 계정과 잇는 자리(지금은 서버·로그인 없음)
- 저장 `profile: { id, name, createdAt }`(`SAVE_VERSION` 그대로 3). `id` = **프로필 id** — 기기에서 처음 한 번 만드는 UUID(`save.js newId` — `crypto.randomUUID`, 없으면 v4 대체 구현)이고 백업 코드를 복원하면 코드의 id로 따라간다(같은 코드를 두 기기에 복원하면 두 기기가 같은 id — 서버 연결 때 처리할 몫. 기기 구분이 필요해지면 그때 `deviceId`를 따로 둔다). `createdAt` = ms(미래 값은 지금으로). 서버가 생기면 이 `id`로 계정에 연결한다. 옛 최상위 `name`('나')은 버린다.
- 이름 규칙 `checkName`: NFC로 합치고 앞뒤 공백 자르고 2~10자, `[가-힣A-Za-z0-9]`만. 낱자(ㅎ·ㅋㅋ)는 '완성된 글자로 적어 주세요'. 깨진 이름은 `''`로 → `needsName(data)`. 🎲 추천 `randomName()`(판타지풍 ≤ 7자, 규칙 통과 보장).
- 흐름(main.js `named`): 이름이 없으면 타이틀 '시작'·'이어하기'·'포기' 뒤에 **필수 입력 창**(`nameui.js`, `#m-name` — 닫기·뒤로 가기·Esc·배경 탭 불가). 설정 '닉네임 변경'은 같은 창(닫기 가능). 창은 화면 위쪽에 붙이고 높이 700px 이하에선 초상을 접어 키보드 크기를 몰라도(APK 전체 화면 WebView) 입력 칸·버튼이 키보드 위에 온다. `visualViewport`가 줄면 그만큼 더 올린다. 이름 창이 떠 있는 동안 앱 복귀 때 이어하기 창을 다시 띄우지 않는다(`checkOffline`의 `!ui.isBusy()`).
- 백업 코드에 profile 포함(왕복 동일). 프로필 없는·id가 깨진 코드 → 복원은 되고 이 기기의 `id·createdAt·이름`을 이어 쓴다(코드에 올바른 이름이 있으면 그 이름, 둘 다 없으면 다시 묻는다 — `importSave(code, current)`). 저장 초기화도 `id`는 유지하고 이름만 비운 뒤 바로 저장한다.
- 표시(모두 textContent / 캔버스 fillText): 정비 화면 상단(`.cp-nick`, 말줄임) · 결과 화면 '〈닉네임〉의 N번째 도전'(`endRun` 요약 `name`, `runNo`) · 성벽 위 마법사 이름표(`players[0].name`, 솔로에도 표시) · 설정 줄.
- 테스트: `test/save.test.js` 끝(검증 규칙 · 추천 이름 · UUID 대체 구현 · 옛 저장 이전 · 저장/백업 왕복 · 프로필 없는 옛 코드).

### v0.1.1 도전 기록·저장 보호 계약 — 서버(추후, Supabase류) 대비 기기 안에 쌓아 두기만. **네트워크 전송 없음**(서버·로그인·업로드 코드 없음)
- 파일: `public/js/records.js`(DOM 없음 — 정규화·추가·평생 통계·백업 축약) · `recordui.js`(기록 화면) · `css/records.css` · `test/records.test.js`. 저장 키·`SAVE_VERSION`(3)·백업 코드 접두 `WD3`는 그대로(새 필드는 normalize가 채운다 → v0.1.0 앱도 새 코드를 읽는다, 기록만 버림).
- **도전 중 누적값** `run.log`(sim.js — 체크포인트·이어하기와 함께 저장): `{ id, t0, ps, k, cb, sp, ap }` = 도전 UUID · 시작 ms(모르면 0) · 실제 플레이 초 · 처치 · 최고 콤보 · 최대 배속 · 카드 자동 선택을 켰었나. `id`는 `newRun`(없으면 normalizeRun)이 한 번 만들고 이어하기로 따라간다. 단 백업 코드 복원(`importSave`)은 진행 중인 판에 **새 id**를 준다(갈래 — 같은 코드를 두 기기에 풀거나 끝난 판을 다시 풀어도 기록 id가 겹치지 않게). `k`는 체크포인트 기준(다시 하는 층을 두 번 세지 않음), `ps`·`sp`·`ap`는 main.js가 매 프레임 올리고 `syncData`가 체크포인트에 덮어쓴다. `ps` = 도전 화면에서 흐른 실제 초(배속 곱하기 전) — 메뉴·영웅 화면·모달·백그라운드(rAF 멈춤)는 빼고 카드 고르는 시간은 넣는다.
- **기록 한 건** `history[]`(오래된 → 최근, **최대 300건**, 넘치면 오래된 것부터) — `endRun(game, meta, { app })`이 run = null과 **같은 setItem 한 번**에 남긴다(같은 id는 한 번만). 축약 키(스키마 `v: 1`):

  | 키 | 뜻 | 키 | 뜻 |
  |---|---|---|---|
  | `v` | 기록 스키마 버전(1) | `id` | 도전 UUID — **서버 멱등 키** |
  | `pid` | 프로필 id(profile.id) | `app` | 앱 버전-플랫폼 `'0.1.1-web'`·`'0.1.1-apk'`(모르면 `'web'`) |
  | `t0`·`t1` | 시작·끝 ms(모르면 0) | `ps` | 실제 플레이 초 |
  | `fl`·`cl` | 도달 층·돌파 층 | `res` | `'fall'` 성벽 붕괴 · `'abandon'` 포기 · `'clear100'` 100층 돌파 |
  | `cls`·`hl` | 클래스·영웅 레벨(끝날 때) | `tm`·`tc` | 마스터한 특성 갈래 키[] · 궁극 특성(capstone) 키 |
  | `sk` | 최종 스킬 `[{k, lv, m?(변이), p?[재료 둘](융합)}]` | `rl`·`fg` | 유물 키[](고른 순서) · 망각 사용 수 |
  | `rg` | 도달 지역 키(dungeons REGION_KEYS) | `go`·`ge` | 이번 도전 골드·보석 |
  | `k`·`bk`·`cb` | 처치 · 보스(네임드) 처치 · 최고 콤보 | `sp`·`ap` | 최대 배속 · 자동 선택 사용 |

  키 값(스킬·유물·특성)은 모양(`/^[A-Za-z][A-Za-z0-9_]{0,31}$/`, `Object.prototype` 멤버 이름 제외)만 검사해 새 버전 키도 보존하고, 화면은 표에 있는 것만 그린다. 한 건 ≈ 400~550B → 300건 ≈ 150KB.
- **평생 통계** `lifetime`(`v: 1`): `{ playSec, runs, kills, bossKills, byCls: { [cls]: { runs, best(돌파 층) } }, ends[10](도달 층 10층 구간별 종료 횟수 1~10…91~100), firstAt, lastAt }`. 기록이 잘려도 계속 누적. **이전**: 없던 저장은 `runs = 저장의 runs`, 도전이 있으면 `firstAt = profile.createdAt`, `lastAt = lastSeen`, 나머지 0(처치·클래스별은 알 수 없음).
- **용량**: `save.js flush`가 `QuotaExceededError`면 `history`만 오래된 절반씩 버리고 다시 쓴다(끝까지 안 되면 false — `setItem` 실패는 이전 저장을 건드리지 않고, 메모리의 `history`도 원래대로 되돌린다). 저장소 막힘(SecurityError 등)은 기록을 버리지 않는다.
- **백업 코드**: 평생 통계 + **최근 20건**만, 기록은 자리 배열(`records.js REC_FIELDS` 순서 — 바꾸지 말고 뒤에만 추가, `pid`가 코드 프로필과 같으면 `''`, `sk = [[k, lv, m|0, p?]]`, `ap = 0|1`)로 줄인다. 복원은 배열·객체 모두 받고 빈 `pid`는 코드의 프로필 id로 채운다. 옛 코드(기록 없음)도 복원(빈 목록 + 시드). 길이: 테스트(얇은 기록) 새 저장 1,435자 → 20건 7,652자(자리 배열 없이 12,799자). 실제 오래 한 저장(가방 30칸, 기록마다 스킬 6·변이·융합·유물 6·특성) 11,363자 → 22,437자(한 건 ≈ 554자) — `CODE_MAX`(40만)보다 훨씬 짧지만 메신저로는 약 2배. 복원은 기기의 기록을 코드 것으로 **바꾼다**(합치지 않음 — 평생 통계와 어긋나지 않게).
- **기록 화면**: 정비 화면 하단 탭 **'기록'**(도감 옆) → `#m-records`(최고 기록 + 주력 영웅 · 총 플레이/도전/처치/보스 처치 · 종료 층 분포 · 최근 도전 목록: 날짜·층·클래스 초상·주요 스킬 3~4·결과) (목록은 30건씩 — '더 보기'로 이어 붙임, 줄마다 스킬 그림 data URL이 커서) → 줄을 누르면 `#m-record` 상세(층·시간·처치·콤보·골드·보석·스킬(변이·융합 재료)·유물·특성·망각·배속·버전). 기록 값은 백업 코드에서 올 수 있으니 이름은 표로만 찾고 숫자는 정규화된 정수만, 닉네임은 기록에 없다.
- **저장 보호(웹 PWA만)**: main.js `protectStorage` — `settings.storage`가 비어 있으면(첫 실행) `navigator.storage.persist()`를 요청, 그 뒤엔 `persisted()`로 상태만 다시 읽는다. 단 아직 못 받았고 홈 화면 앱(`display-mode: standalone`·iOS `navigator.standalone`)으로 켰으면 매번 다시 요청(크롬은 설치 후에야 허락, 크로미움·웹킷은 권한 창 없음). `settings.storage`는 이 기기 값 — 백업 복원(main.js `onRestoreSave`)은 코드 값 대신 지금 기기 값을 유지. 결과 `'on' | 'off' | 'na'`(미지원·오류)를 설정에 조용히 저장, 팝업 없음. Capacitor APK는 부르지 않는다. 설정 줄 '기록 보호: 켜짐 / 브라우저 기본 / 앱 저장소(APK)', 웹에서 `off`·`na`면 백업 안내 문구를 붉은 상자로 강조.
- **서버 매핑 메모(추후)**: `profiles(id = profile.id, name, created_at, …)` · `saves(profile_id, data jsonb(저장 객체 — history 제외), lifetime jsonb, updated_at)` · `runs(id uuid primary key = 기록 id, profile_id = pid, app, started_at = t0, ended_at = t1, play_sec = ps, floor = fl, cleared = cl, result = res, cls, hero_lv = hl, skills jsonb = sk, relics = rl, talents = {tm, tc}, region = rg, gold = go, gems = ge, kills = k, boss_kills = bk, best_combo = cb, speed_max = sp, auto_pick = ap, v)`. 올릴 때 `insert … on conflict (id) do nothing` → 같은 기록을 여러 번 올려도(두 기기에 같은 백업 복원 포함) 한 번만. 평생 통계는 서버에서 runs로 다시 계산할 수 있지만 300건 밖의 옛 도전은 `lifetime`에만 남으니 함께 올린다 — **저장(save)마다 스냅숏(마지막 것이 이김)으로 두고 기기끼리 더하지 않는다**(백업 코드가 평생 통계를 통째로 옮기므로 더하면 두 번 센다).
- **개인정보 메모**: 지금은 기기 밖으로 나가는 데이터가 없다(백업 코드는 사용자가 직접 옮김). 서버를 붙일 때는 개인정보 처리방침 · 수집 항목(프로필 id·닉네임·플레이 기록) 동의 화면 · 탈퇴/삭제 경로가 필요하다.
- 테스트 `test/records.test.js`: 추가·잘라내기(300) · 평생 통계 누적 · 붕괴/포기/100층 · 융합 재료·변이·유물 · 이어하기(id·처치·시간) · 이전 저장·옛 체크포인트·옛 코드 · 백업 왕복(20건 + 평생 통계, 길이 출력) · 용량 초과에서 게임 저장 보존 · 저장소 막힘.

### v0.1.2 외형 소환 계약

#### 코어 · 저장 (SUMMON CORE 트랙 — `public/js/summon.js` · `test/summon.test.js` · `test/summon-economy.js` · save.js/run.js 작은 훅)
> DOM 없음 · 네트워크 없음 · 결제 코드 없음. 전투(sim) RNG와 따로 도는 소환 전용 시드(`meta.summon.rng`, mulberry32 상태를 저장에 둔다 — 새로고침으로 결과를 다시 굴릴 수 없다). 외형은 전투력 0(sim·run 전투 입력에 안 들어감).
- **카탈로그** `COSMETICS[{ key, slot:'costume'|'robe'|'skin', cls?(costume만: knight·ranger·sorcerer·cleric·assassin), rarity:'common'|'rare'|'epic'|'legend', name, desc }]`(36종 = 코스튬 20 + 로브 8 + 스킨 8, 등급마다 9) · `COS_BY_KEY` · `COS_KEYS` · `SLOT_NAME{costume:'영웅 코스튬', robe:'대마법사 로브', skin:'마법 이펙트'}` · `COS_RARITY[{ key, name('일반'·'희귀'·'영웅'·'전설'), color, rate }]`(색은 hero.js 장비 등급 색 그대로). 키는 위 COSMETIC ART의 그림 id.
- **확률(기본)**: 일반 55% · 희귀 33% · 영웅 10% · 전설 2%, 같은 등급 안에서는 균등. **천장 `PITY` = 80**: 배너별 카운터가 79(전설 없이 79회)이면 80번째는 전설 확정, 전설이 나오면 0. **10연차**: 앞 9장이 모두 일반이면 10번째는 희귀 이상(희귀·영웅·전설 비율 그대로 다시 나눔). 천장 포함 실제 전설 확률 `effLegendRate()` ≈ 2.50%(평균 40회).
- **배너** `banners(now = Date.now())` → `[{ key:'standard', name:'별의 제단' }, { key:'pickup', name, legend, epics:[e1,e2], start, end('YYYY-MM-DD', end 날 0시에 바뀜), daysLeft }]`. 픽업은 **기기 날짜(현지) 기준 7일마다**(월요일 0시) 전설 9종을 돌아가며 1종 + 영웅 2종. 픽업 배너 확률: 픽업 전설 = 전설 확률의 50%(1%), 나머지 전설 8종이 1%를 나눔 · 픽업 영웅 2종이 영웅 확률의 50%(각 2.5%). **확정 규칙**: 픽업 배너에서 나온 전설이 픽업이 아니면 `summon.guar = true` → 다음 전설은 픽업 확정(천장 카운터·확정은 픽업이 바뀌어도 이어진다). 상시·픽업 천장 카운터는 따로.
- **확률표(공개용)** `oddsTable(bannerKey, now?)` → `{ banner, rarities:[{ key, name, rate }], items:[{ key, name, rarity, rate, pickup }](등급·확률 높은 순), pity: 80, effLegend, rules:[한국어 문장] }` — rate는 0~1 소수(표시는 UI가 %로, 소수 셋째 자리).
- **가격** `PULL_GEMS = { 1: 100, 10: 900 }`(10연 10% 할인 — 아래 '가격 실측') · `pullPrice(meta, n, pay?)` → `{ cur:'tickets'|'gems', cost, ok }` — `pay` 없으면 소환권이 n장 이상이면 소환권, 아니면 보석(섞어 내지 않음). `pay:'gems'`로 소환권을 아끼고 보석으로 강제 가능.
- **소환** `pull(meta, bannerKey, n(1|10), { pay?, now? })` → `{ ok:true, banner, cur, cost, results:[{ key, rarity, isNew, shards, pickup, pity, guar }], shards(이번 합계), top(최고 등급 키) }` | `{ ok:false, error:'보석이 부족해요' 등 }`. `pity:true` = 천장으로 확정된 전설, `guar:true` = 확정 규칙으로 나온 픽업. 결과 순서 = 뽑은 순서(UI가 공개 순서를 바꿔도 됨). 저장 필드를 제자리에서 바꾼다(호출자는 `persist()`만).
- **중복 → 별조각** `SHARD_DUP = { common:5, rare:15, epic:50, legend:200 }` · **교환소** `SHARD_PRICE = { common:40, rare:120, epic:400, legend:1500 }` · `exchange(meta, key)` → bool(미보유만, 별조각 차감 + 보유, 내역엔 안 남음).
- **보유·장착** `owns(meta, key)` · `equipCos(meta, key)` → bool(보유한 것만, 자기 칸·클래스에) · `unequipCos(meta, slot, cls?)` → bool(기본 외형으로) · `loadoutOf(meta)` → `{ costume:{ knight?, ranger?, … }, robe?, skin? }`(COSMETIC ART `setLoadout(eq)`에 그대로) · `collection(meta)` → `{ n, total, rarity:{ common:[n, total], … }, slot:{ costume:[n, total], … } }`(도감 '외형' 수집률) · `sourceText(key)` → '소환의 제단 · 별조각 1,500개로 교환' · `summonDot(meta)` → 소환권 ≥ 1.
- **소환권(`meta.summon.tickets`)** — `grantRunTickets(meta, { cleared, now })`(`cleared` = 이번 도전 돌파 층, `now` = endRun `ctx.now` 또는 지금) → `[{ src:'boss'|'floor'|'daily'|'codex', n, label }]`를 **run.js `endRun`이 정산 끝에서 부른다**(결과 요약 `sum.tickets`, 없으면 `[]`). 모두 멱등(같은 상태로 두 번 불러도 두 번 안 준다):
  - 네임드 보스 첫 처치: 10·20·…·100층 보스를 처음 잡은(=그 층을 처음 돌파한) 층마다 1장 — `summon.mBoss`(받은 가장 높은 보스 층).
  - 최고 층 10층 구간: 최고 기록이 10·20·…층을 처음 넘을 때 1장(50·100층은 3장) — `summon.mFloor`.
  - 매일 첫 도전 완료: 1층 이상 돌파하고 끝난 그날 첫 도전에 1장(기기 현지 날짜 `YYYY-MM-DD`, `summon.daily`) — 즉시 포기로는 안 준다.
  - 도감 누적(`codexFound`): 5·10·15·20·25·30·전부(33) 종 발견마다 1·1·2·2·2·3·5장 — `summon.mCodex`(받은 단계 수).
  - **환영 선물 10장**(새 저장·기존 저장 모두 딱 한 번): `normSummon`이 `gift`가 없던 저장에 넣는다. UI는 `giftPending(meta)`이면 안내 창을 한 번 띄우고 `markGiftSeen(meta)`.
  - 기존 저장 이전: `summon`이 없던 저장은 지금 최고 층·도감까지의 보스·구간·도감 단계를 **이미 받은 것으로** 두고(소급 지급 없음 — 대신 환영 선물) 소환권 10장.
- **내역** `summon.hist` 최근 100회(오래된 → 최근) `{ t(ms), b:'standard'|'pickup', k, d?(1 = 중복·별조각) }` · `history(meta)` → 최근 → 오래된 순 `[{ t, banner, key, rarity, dup }]`.
- **저장** `meta.summon = { owned:[키], equip:{ costume:{cls:키}, robe, skin }, shards, tickets, pity:{ standard, pickup }, guar, pulls(평생 소환 수), hist, gift, giftSeen, daily, mBoss, mFloor, mCodex, rng }` — save.js `normalize`가 `normSummon(d.summon, out)`로(모르는 키·미보유 장착은 버림, 숫자는 범위 정수). `SAVE_VERSION`·코드 접두 `WD3` 그대로(옛 앱은 필드를 버림).
- **백업 코드**: `summon`에서 `hist`만 빼고 담는다(보유·장착·별조각·소환권·천장·확정·선물·받은 보상 단계·시드). 복원하면 내역은 빈 목록. 옛 코드(summon 없음)는 위 '기존 저장 이전'과 같다.
- **가격 실측** `node test/summon-economy.js [시드…]`(캠페인 봇, 상점 씀 — 봇은 소환하지 않으니 수입만 잰다). 시드 1~3: 도전당 보석 **평균 305~333**(1~10회 69~135 · 11~20회 314~360 · 21회~ 533~565, 100층 뒤 ≈ 650) · 8시간 방치 보석 17~124 · 도전당 소환권(보스·구간·도감) 1.1~1.3장 + 하루 첫 도전 1장. → 보석을 모두 소환에 쓰면 10연차 1회 = 도전 **약 2.8회**(초반 7~13회 · 중반 2.5~2.9회 · 후반 1.6회), 소환권까지 더하면 2.1회, 보석 절반을 강화에 쓰는 무과금이면 약 3~4회. 캠페인(26~31회, 18~23시간) 합계 보석 7.9K~10.3K(10연 9~11번치) + 소환권 33~36장 + 환영 10장. 한 도전 ≈ 40분이라 10연 1회 ≈ 플레이 1.5~2.5시간.
- **campAct**(run.js): `{type:'summon', banner, n, pay?}` → pull 결과 객체(실패면 false) · `{type:'cosExchange', key}` · `{type:'cosEquip', key}` · `{type:'cosUnequip', slot, cls?}` · `{type:'giftSeen'}`.

#### 소환의 제단 · 옷장 UI (SUMMON UI 트랙 — `public/js/summonui.js` · `wardrobeui.js` · `css/summon.css`)
> 재화·확률·천장·저장은 SUMMON CORE(순수 함수), 그림은 COSMETIC ART(미니 렌더). 이 트랙은 화면만 — 메타는 읽기만 하고 바꾸는 건 전부 코어 `campAct` + 저장.
- **부팅(main.js)**: `initSummonUI(root, { getMeta: () => data, act: a => (campAct 결과 + persistOk), play: k => audio.play(k), onClose: () => ui.refreshCamp() })` — 부팅 때 `syncLoadout()`(= `setLoadout(loadoutOf(data))`)를 한 번 부른다. 백업 복원·저장 초기화로 `data`가 바뀌면 `syncLoadout()`을 다시 부르면 된다. 안드로이드 뒤로 가기 맨 앞 `if (summonHandleBack()) return;`, Esc는 summonui가 문서 캡처 단계에서 먼저 받는다.
- **쓰는 코어 함수**: 읽기 `banners · oddsTable · pullPrice · history · collection · sourceText · summonDot · giftPending · owns · loadoutOf · PITY · SHARD_PRICE`, 쓰기 `campAct {type:'summon'|'cosExchange'|'cosEquip'|'cosUnequip'|'giftSeen'}`. 그림 `cosmeticURL · playPreview(→ stop, 화면을 닫을 때 멈춤) · setLoadout · artOf`.
- **여는 곳**: 정비 하단 탭 **'소환'**(7번째 — 360폭 탭 46px, `openAltar()`, 탭 점 = `summonDot`) · 출정 탭 영웅 무대 왼쪽 아래 **옷장** 버튼 · 영웅 화면 '영웅' 탭 **옷장 · 외형 바꾸기**(heroui `H.onOpenWardrobe(cls)` → `openWardrobe({ cls })`) · 도감 **'외형' 탭**(ui.js가 탭을 JS로 붙이고 `renderCosmeticCodex(host)`) · 결과 화면 **'획득 소환권'** 카드(ui.js `resultTickets(보석 카드, sum.tickets)`) · 환영 선물 창(정비 화면을 열 때 `maybeGift()`, 특성 개편 안내가 있으면 그 뒤).
- **화면 층**: `#app` 안 `.sm-root`(display: contents) — 제단·옷장 `.sm-scr`(z 260, 영웅 화면 250 위) · 시트 `.sm-ov`(270: 확률 정보·내역·교환소·외형 상세·선물) · 소환 연출 `.sm-fx`(280) · 토스트(300). 영웅 화면이 형제 요소를 inert로 잠그므로 층을 열 때 `.sm-root.inert = false`. 자체 뒤로 가기 스택(연출 중이면 건너뛰기 → 결과면 닫기 → 맨 위 시트 → 옷장/제단).
- **제단**: 배너 캐러셀(scroll-snap, 픽업 먼저 · 점 · 픽업 남은 시간 1초마다 · 배너 그림 = 픽업 전설/상시 첫 전설 `playPreview`) · 천장 바(배너별 `PITY - pity[b]`, 픽업은 확정 규칙 줄 — `guar`면 '다음 전설은 픽업 확정!') · 1회/10회 버튼(`pullPrice` — 소환권이 있으면 소환권, '희귀 이상 확정' · 보석이면 '10% 할인' 깃발, 부족하면 `.is-poor` + 흔들림) · 확률 정보(배너 탭 · 코어 `rules` · 등급별 % 막대 · 외형별 %, 소수 셋째 자리, 픽업 강조) · 소환 내역(최근 100, `recordui.dateText`) · 별조각 교환소(미보유 먼저, 전설 먼저 → 상세 → 교환) · 옷장.
- **연출**: 마법진 충전 0.9초(등급 색을 미리 흘리지 않음) → 빛 기둥 0.95초(최고 등급 색 · 영웅/전설은 흰 섬광) → 전설마다 컷인 1.5초(금 띠 + 살아 있는 `playPreview` + 이름 슬램 · 천장/픽업 확정 표기) → 카드 5×2(1회 = 큰 카드 1장) 50ms 스태거로 깔고 90ms 간격 뒤집기, 영웅·전설은 뒤집기 전 등급 빛 예고 + 톡 · NEW / 별조각 +N → 합계(새 외형 · 별조각 · 천장까지) + [확인] [한 번 더(값)]. 화면 탭 = 다음 단계, '건너뛰기 ▶' = 바로 결과. DOM transform/opacity만. 소리: pickShow → big/synergy/fusion → cardFlip → pickConfirm/fusion → coin.
- **옷장**: [영웅 | 대마법사 | 마법 이펙트] · 영웅은 클래스 5 초상(장착한 클래스에 금 점) · 무대 = 살아 있는 미리보기(`playPreview`, 미보유 = `silhouette`, 캔버스 백킹 = CSS 크기 × dpr≤2, ResizeObserver) · 이름/등급/종류 · [장착] [장착 중 · 기본으로] / 미보유 = 자물쇠 + 획득처(`sourceText`) + 별조각 값(→ 상세·교환) · 격자 = 기본 외형 + 보유 먼저 · 등급 높은 순, 미보유 = 실루엣 + '???'. **기본 외형**(`kn_base`·`rg_base`·`so_base`·`cl_base`·`as_base`·`rb_base`·`sk_base`)도 그림 모듈의 미리보기로 그린다(아래 '미리보기 전용 기본 id' — 전장 초상은 장착한 외형을 굽기 때문에 쓰지 않는다). 장착 뒤 `syncLoadout()`.
- **도감 '외형' 탭**: 수집 n/36 · % 막대 · 등급별 n/9 알약 · 종류별 격자(누르면 상세, 보유면 '옷장에서 보기') · [옷장 열기].
- 확인: 390×844 · 360×640(제단 한 화면에 스크롤 없음, 10연 카드 5×2) · 1000×880. 60fps: 캔버스는 배너 2장 + 옷장 1장 + 컷인 1장만 rAF(닫으면 stop).

#### 외형 그림 (COSMETIC ART 트랙 — `public/js/art/cosmetics.js` + units.js·fx.js·render.js 작은 훅)
> 전투력 0: 그림만 바꾼다(sim·밸런스 무관). 모든 외형은 **구운 캐시**(코스튬 몸·로브·지팡이·탄 머리·오라·입자 스프라이트) → 프레임 비용은 drawImage 몇 장.
- **그림 id (카탈로그 키 — SUMMON CORE가 이 id로 이름·등급·확률을 붙인다)** 등급 c 일반 · r 희귀 · e 영웅 · l 전설
  - 영웅 코스튬(클래스별 4): 기사 `kn_crimson`c 진홍 기사 · `kn_jade`r 비취 수호자 · `kn_obsidian`e 흑요 기사 · `kn_solar`l 태양왕 / 궁수 `rg_autumn`c 단풍 사냥꾼 · `rg_snow`r 설원 추적자 · `rg_raven`e 밤까마귀 · `rg_sylvan`l 세계수의 사수 / 마법사 `so_azure`c 청옥 견습생 · `so_pumpkin`r 호박 마녀 · `so_nebula`e 성운 점성술사 · `so_phoenix`l 불사조 현자 / 성직자 `cl_rose`c 장미 수녀 · `cl_tide`r 파도 사제 · `cl_eclipse`e 월식 사제 · `cl_seraph`l 세라핌 / 암살자 `as_teal`c 청록 그림자 · `as_fox`r 여우 가면 · `as_oni`e 오니 · `as_moon`l 월영
  - 대마법사 로브·지팡이(성벽 위 내 마법사): `rb_forest`c 숲의 현자 · `rb_ash`c 잿빛 현자 · `rb_royal`r 왕실 궁정 마법사 · `rb_sakura`r 벚꽃 마도사 · `rb_frost`e 서리 여왕 · `rb_void`e 심연의 군주 · `rb_celestial`l 천구의 대마법사 · `rb_dragon`l 용혈 대마법사
  - 마법 이펙트 스킨(내 마법탄·스킬 입자): `sk_jade`c 비취 · `sk_sunset`c 노을 · `sk_gold`r 황금 · `sk_sakura`r 벚꽃 · `sk_crystal`e 얼음 결정 · `sk_neon`e 네온 · `sk_abyss`l 심연 · `sk_star`l 별빛
  - 모르는 id(새 카탈로그 항목)는 종류 접두(`kn_ rg_ so_ cl_ as_ rb_ sk_`)로 기본 그림에 안전하게 떨어진다(그리기 오류 없음).
  - **미리보기 전용 기본 id**(통합 패스): `renderPreview`/`playPreview`/`cosmeticURL`은 `kn_base · rg_base · so_base · cl_base · as_base`(클래스 기본 몸) · `rb_base`(기본 빨간 로브) · `sk_base`(기본 화염구 탄)도 그린다. `artOf`·`ART_IDS`·`setLoadout`엔 없다(장착·전장·카탈로그와 무관). `cosmeticURL`의 스킨 정지 컷은 t = 0.32초(탄 비행 + 스킬 폭발이 번지는 순간), 코스튬·로브는 0.9초.
- **장착 알림**: `setLoadout(eq)` — `eq = { costume: { knight?: id, ranger?: id, sorcerer?: id, cleric?: id, assassin?: id }, robe?: id, skin?: id }`(없거나 null = 기본). 부팅·백업 복원·옷장 장착 때 한 번 부른다(프레임마다 X). 바뀐 것만 캐시를 새로 굽는다.
- **미리보기(옷장·제단·도감)**: `renderPreview(canvas, id, t, o?)` 한 프레임(t 초, 캔버스 백킹 크기에 맞춰 그림, `o.silhouette` = 미보유 실루엣) · `playPreview(canvas, id, o?) → stop()`(rAF 루프 — 캔버스가 문서에서 빠지면 스스로 멈춤) · `cosmeticURL(id, px = 256, o?) → dataURL`(정지 초상, 카드·목록 썸네일, 캐시). 코스튬 = 영웅 대기 동작 + 오라·전설 동작, 로브 = 마법사 + 지팡이 + 오브 빛, 스킨 = 오브에서 적 과녁으로 탄 3발 + 명중 입자 + 스킬 폭발 1회 시연.
- **전투 반영**: 영웅 = `units.heroBody`가 장착 코스튬으로 굽는다(장비 희귀도 색 대신 코스튬 색 — 무기·망토 장비 그림은 유지), 전설은 등 뒤 오라 + 대기 동작. 성벽 위 내 마법사(0번) = 로브 팔레트·장식·오브 색. 스킨 = 내 마법탄(머리·꼬리·빛·꼬리 입자) + 스킬 이벤트의 입자·고리 색을 스킨 색으로 + 스킨 고유 입자(꽃잎·별·결정…) 소량. **약점/내성 숫자 색·적·보스는 건드리지 않고**, 광량 예산(render.js lightMeter)을 그대로 받는다.
- **훅(작게, 주석 'v0.1.2')**: units.js — `heroBody(cls, tier, armorR, helmR, res, cos?)`·`mageBody/mageCape/mageStaff(o, tier, res, rb?)`(cos/rb 없으면 장착한 것, 키에 id 포함) · 다리 색 `cosLegs` · `drawHero`에서 `heroAura(0|1, …)`(몸 뒤·앞) · `drawMages`에서 `mageAura(0|1, …)`·오브 색 `robeOrb()` · 기본 주문 시전 색 `skinCol()` · 초상 캐시 키에 코스튬·로브 id. fx.js — `drawBullets`가 `skinFx()`(내 탄 머리·꼬리·빛) · `events`가 이벤트마다 `skinMap(ev)`를 켜서 `part/ring` 색을 스킨 램프로(내 스킬 이벤트 동안만, 끝나면 끔). render.js — `cosmetics.events(view, evs)` · `cosmetics.draw()`(파티클 층 바로 위).
- **비용(데스크톱 실측)**: 전설 오라 영웅 ≈ 19µs · 로브 ≈ 18µs · 스킨 입자 풀(96) 비었을 때 15µs, 스킬 2번 직후 ≈ 0.14ms. 전체 프레임(전설 3종 장착 vs 기본) +0.1~0.3ms. 코스튬·로브·탄 머리·입자는 처음 한 번만 굽는다.

#### 통합 (INTEGRATE 패스 — 세 트랙 배선 확인 · 가격 확정)
- **키**: 카탈로그 `COSMETICS` 36키 = `ART_IDS`(코스튬 20 · 로브 8 · 스킨 8) 그대로(별칭 없음, summon.test가 접두·수를 검사). UI는 카탈로그 키 + 위 미리보기 전용 기본 id만 그림 모듈에 넘긴다.
- **장착 → 그림**: `campAct {cosEquip|cosUnequip}` → 저장 → `syncLoadout()`(= `setLoadout(loadoutOf(meta))`) — 부팅(`initSummonUI`) · 저장 초기화/백업 복원(main.js `resetState`) · 옷장 장착 뒤. 전장(영웅 몸·다리·오라, 내 마법사 로브·지팡이·오브, 내 탄·스킬 입자), 초상 캐시(`heroPortraitURL`·`magePortraitURL` 키에 코스튬·로브 id) → 정비 무대 · 영웅 화면 · 결과 · 이어하기 · 타이틀 키아트까지 같은 외형.
- **다시 그리기 신호**: 정비 화면 `signature()`에 `summon.tickets` + `summon.equip`(옷장을 닫으면 무대 초상이 바로 바뀜) · 영웅 화면 `heroSig`에 `ctx.cos`(main.js `campCtx().cos` = 장착 코스튬 JSON) — 영웅 화면 위에서 옷장을 열고 바꿔도 닫으면 초상이 바뀐다.
- **외형 상세 창**(교환소 · 옷장 '교환' · 도감 외형 칸): 미보유도 제 모습으로 움직이는 미리보기(무엇을 별조각으로 사는지 보여 줌 — 교환소 격자·이름도 공개). 실루엣 + '???'는 옷장·도감 격자와 옷장 무대만.
- **지급은 한 번만**: 소환권은 `endRun` 한 곳에서만 `grantRunTickets`(받은 단계·날짜를 저장 — 두 번 불러도 0), 환영 선물은 `normSummon`이 `gift` 없던 저장에만(새 저장·기존 저장·옛 백업 코드 모두 딱 한 번, 안내 창은 `giftSeen`), 백업 코드는 받은 단계·선물·소환 시드까지 담아 복원으로 다시 받거나 다시 굴릴 수 없다.
- **전투력 0 확인**: 외형 필드는 sim·run 전투 입력에 없다 — `npm test` 전 스위트 통과, 캠페인 밸런스 숫자 그대로(sim.test 시드 1~3 기준값 변화 없음).
- **가격 확정** `PULL_GEMS = { 1: 100, 10: 900 }` — `node test/summon-economy.js` 재측정(시드 1~3): 도전당 보석 305~333(초반 69~135 · 중반 314~360 · 후반 533~565), 도전당 소환권 1.1~1.3장 + 하루 첫 도전 1장 → 10연 1회 = 보석만 2.7~3.0회 · 소환권 포함 2.1회(초반 2.9~6.0회 · 중반 1.7~2.3회 · 후반 1.4~1.5회). 보석은 수련 돌파·보석 강화·상자와 나눠 쓰므로 실제 무과금은 도전 3~4회(≈ 1.5~2.5시간)에 10연 1회 — 목표('도전 몇 번에 10연 1회')와 맞아 그대로 둔다. 캠페인 한 바퀴(26~31회) 동안 보석으로 10연 9~11번 + 소환권 3.3~3.6번 + 환영 1번 ≈ 소환 135~155회(전설 약 3~4개 — 9종 중) — 수집이 한 바퀴에 끝나지 않고 별조각 교환소가 남은 칸을 메운다.
- **브라우저 끝까지 확인**(390×844 · 360×640 · 1000×880): 첫 실행 이름 → 환영 선물 창 → 제단(픽업 먼저) → 10연(마법진 → 빛 기둥 → 카드 5×2 → NEW/별조각 → 합계) → 옷장에서 코스튬·로브·스킨 장착 → 정비 무대·타이틀·전장(영웅·마법사·탄·명중 입자)에 반영 → 1층 돌파 후 포기 → 결과 '획득 소환권 · 오늘의 첫 도전 +1' → 도감 '외형' 탭 → 새로고침 뒤 보유·장착·내역 유지 → 교환소(일반 40) → 확률 정보(상시/픽업 · 등급·외형별 %) → 천장 강제(79) 전설 컷인. 360×640 제단은 스크롤 없음. 콘솔 오류는 미리보기 창의 서비스 워커 등록 실패(`sw.js` — 이 기능과 무관, 미리보기 환경 한정)뿐. 코스튬·로브·전설 스킨 장착 1층 전투 프레임 ≈ 0.7ms(데스크톱, 시뮬 포함).

#### FIX 패스 (리뷰·플레이 테스트 반영)
- **픽업 교체 경계**: `pull(meta, banner, n, { pay, now, week })` · campAct `{type:'summon', …, week}` — `week` = 화면에 보인 픽업의 `pickupBanner().week`. 픽업 배너인데 지금 week와 다르면(제단을 연 채 월요일 0시를 넘김) `{ ok:false, stale:true, error:'픽업이 바뀌었어요' }`로 아무것도 바꾸지 않는다. UI는 소환 직전·남은 시간 0이 될 때 `banners()`를 다시 보고, 바뀌었으면 제단을 새 픽업으로 다시 그리고 토스트('픽업이 바뀌었어요!'). '한 번 더'도 결과를 낸 week를 넘긴다.
- **매일 첫 도전은 날짜가 앞으로만**: `summon.daily`(YYYY-MM-DD)보다 **뒤의** 현지 날짜일 때만 지급 — 기기 시계를 되돌리거나 두 날짜를 오가도 더 안 준다. (시계를 먼 미래로 돌렸다 되돌리면 그 날짜까지 매일 보상이 멈춘다 — 받아들임.)
- **`n` 정규화**: `pull`·`pullPrice`는 `1 | '1' | 10 | '10'`만 받는다(문자열 '10'도 10연 보장). 그 밖은 실패.
- **내역 표시**: `hist[]`에 `g:1`(픽업 확정) · `p:1`(천장) — `history()` → `{ …, pity, guar }`. 소환 내역 줄 = '픽업 배너'/'상시 배너' + '확정'/'천장' 칩.
- **확률표 문구**: 천장 포함 전설 실제 확률은 '1회 소환 기준'(10연 보장이 더해지면 조금 높음). 픽업 배너 규칙에 확정 규칙 포함 픽업 전설 실제 확률(`effLegendRate() × pickupLegendShare()` = 1/(2 − 0.5) → 약 1.66%).
- **보석 소환 확인**: 보석으로 내는 소환(1회·10회·한 번 더)은 확인 창(값 · 보석 잔액 → 소환 뒤 잔액 · '다시 묻지 않기'). 소환권은 묻지 않음. '다시 묻지 않기' = 이 기기 localStorage `wd.sm.noGemAsk`(UI 설정 — 저장·백업에 안 들어감).
- **새 외형 표시(UI 전용)**: localStorage `wd.sm.seen`(본 외형 키 목록, 처음 읽을 때 지금 보유 = 본 것). 보유했지만 옷장에서 아직 안 눌러 본 외형 → 옷장 칸 NEW · 종류 탭/클래스 초상 빨간 점 · 제단 '옷장' 링크 점. 칸을 누르면(또는 상세 → '옷장에서 보기') 본 것.
- **그림**: 스킨 `skinMap(ev)` — 기본 탄(명중 o0 · 화염구 탄 폭발 · 시전)은 스킨 램프 그대로, 스킬(주문·연쇄·파편·메테오·치명 폭발)은 원소 색 65% + 스킨 35%(불은 불, 얼음은 얼음으로 읽힘). 스킨 정지 컷(`cosmeticURL`)은 큰 문장(`renderPreview(…, { emblem:true })` — 탄 머리 · 빛 · 테 · 고유 입자, 전설 문장). 코스튬 미리보기 `o.armor · o.helm`(기본 외형만 의미 — 옷장 무대는 지금 영웅 단계·장비로 기본 외형을 그림 = 정비 무대와 같은 모습).
- **UI 다듬기**: 360폭 전설 컷인은 글자를 그림 아래로 · 컷인에 NEW / '중복 · 별조각 +N' · 10연 결과(≤560폭)는 4·3·3 큰 카드(화면 높이에 맞춤), NEW 배지는 카드 아래 가운데(클래스 칩을 안 가림) · 부족한 '한 번 더'는 흐리게 + '보석 부족' + 토스트 · 장착 표시는 초록 테·초록 '장착'(전설 금 테와 구분) · 토스트는 화면 아래 · 영웅/전설 교환은 소환 연출로 공개 · 환영 선물 창 = 상자 + 떠오르는 소환권 · 타이틀 시작 버튼 'NEW 외형 소환' 리본(`giftPending` — main.js `meta.summon`) · 도감 '외형' 탭은 조합 진행 줄을 숨기고 제목 '외형 도감', 등급 알약 4칸 한 줄 · 옷장 스킨 무대는 받침대 없이 넓게.
- **받아들인 것**: v0.1.1 백업 코드(summon 없음)를 복원하면 환영 선물 10장이 다시 들어온다 — 옛 코드엔 받은 표시가 없고, 복원이 보유·별조각·천장을 그 코드 상태(빈 것)로 되돌리므로 되풀이해도 남는 이득이 없다. 보스·구간 소환권이 10층마다 둘 다 나오는 것(10층당 2장, 50·100층 4장)은 명세대로.

### v0.1.2 이펙트 존재감 균형 (FX 균형 — 사용자: "번개 이펙트만 보여. 망령은 잘 안 보이고")
> 목표: 어떤 빌드든 고른 스킬이 각자 알아보인다. 번개 계열은 **짧고 선명하게**, 망령 계열은 **밝은 청록·연보라 외곽선 + 불투명 몸**. 담당 render.js · art/(fx·units·mutfx·core).
- **번개**(fx.js `bolt(pts, life, col, halo, w, kind)` 한 곳으로): 종류(`ls` 낙뢰 · `ch` 연쇄 · `sc` 초전도 · `se` 폭풍의 눈 · `*Max` 완전체 · `hero`)마다 동시 3줄(완전체 `*Max` 5줄) · 전부 8줄(종류의 첫 줄기는 전체 상한과 무관하게 그림, 완전체는 전체 상한 밖), 넘치면 같은 종류의 최근 줄기를 굵게(여러 번개 = 한 줄기 큰 번개, 굵기는 줄지 않고 ≤ 1.8). 그리기 3겹 = 헤일로 9px α0.28 · 원소색 3.4px · 흰 심 1.1px α0.7, 알파 = (남은 수명)^1.6. 하늘 끝 기둥은 0.4초에 한 번(나머지 낙뢰는 표적 위 150~220px 짧은 줄기), 번개 화면 섬광 `boltFlash`는 0.9초에 한 번 ≤ 0.06. 낙뢰 헤일로 95→64·수명 0.26→0.16 · 스파크·별 섬광 축소 · 초전도 줄기 4개까지(나머지는 얼음 착탄) · 플라즈마 폭발 빛 r×(1.6+0.8f)→(1.2+0.5f) · 완전체: 낙뢰 가로 번개 짧게·두 갈래, 폭풍의 눈 구름 벽 1.6초/6초에 한 번·반경 ×0.68, 플라즈마 8→5갈래(화면 끝 → 400px). mutfx `boltLine` 흰 심 ≤ 1.6px · `addBolt` 상한 5 · 천벌은 첫 벼락만 하늘 끝. 궁수 뇌전 화살 섬광 축소. 지그재그 떨림은 번개마다 자기 시드(`mulberry(sd + frameNo)`).
- **망령 계열**: `units.ghostSpr` = 불투명 몸 + 청록 발광 외곽선(구운 실루엣 두 겹) + 청록 눈빛, 망령 크기 ×1.25~1.6 · 잔상 2~3(망령 12마리 넘으면 1 — LOD) · 청록/연보라 꼬리. 친 자리에서 흩어지는 망령(`wisp`, 1초) · 시전 때 문에서 솟는 망령 3~5. 망령 기사 = 불투명 연보라 갑주 + 청록 외곽선·눈 ×2.2 + 발밑 룬, 유령 돌격 ×1.6. 저주 낙인 = 몸 뒤 연보라 기운 + 발밑 도는 저주 룬 + 솟는 불씨(잡몹), 보스·개별 저주는 머리 위 문양 그대로. 영혼 수확 = 처치 자리 청록 고리 + 몸을 떠나는 망령 + 작은 유령 머리가 청록·연보라 꼬리로 골드 HUD까지(1.4~1.7초). 망령의 문(완전체)은 완전체 동시 2개 상한에 막히지 않는다.
- **광량 예산**: `setLightPrio(LIGHT_EXEMPT)`(core `LIGHT_EXEMPT = 2`) — 그 동안의 가산 그리기는 본 예산 수요로 세지 않고 본 배율로 누르지도 않는다. 대신 따로 센 망령 계열 수요가 `EXEMPT_BUDGET`(0.05)을 넘으면 그 그리기만 배율 `ek`(≥ 0.5)로 누른다(`__wdLight.ek/exDemand`). 망령·영혼·저주의 **작은** 발광에만(몸은 일반 합성이라 원래 예산 밖).
- **측정 도구**(스크래치 랩, 게임 코드 밖): 고정 시드 sim + 렌더를 390×844(dpr 1)로 돌려, 같은 전장에서 "전부" vs "그 스킬의 이벤트·전장 물체만 뺀" 렌더를 샘플 80장(3프레임 간격, 5.5초) 비교 — **점유** = |Δ휘도| > 16인 픽셀 %, **밝기** = +Δ휘도 합 %. 이벤트마다 렌더 난수를 다시 심어 뺀 스킬과 무관한 연출은 같은 난수를 쓴다. 장면 14 = 빌드(번개+망령 Lv6 · Lv1 · 융합 · 변이 둘) × 초원/동굴/묘지 + 스킨(네온·심연). '×평균' = 같은 장면 다른 스킬 점유 평균 대비.

| 스킬 | 점유 % 전 → 후 | ×평균 전 → 후 (장면 범위) | 밝기 % 전 → 후 |
|---|---|---|---|
| 낙뢰 | 3.23 → 1.51 | 1.19 (0.81~1.85) → 0.47 (0.32~0.86) | 0.72 → 0.22 |
| 연쇄 번개 | 0.41 → 0.16 | 0.12 → 0.04 | 0.08 → 0.03 |
| 폭풍의 눈 | 13.91 → 5.38 | 3.21 (1.59~**5.81**) → 1.34 (1.11~1.73) | 1.45 → 0.69 |
| 플라즈마 | 8.61 → 4.47 | 1.47 → 1.06 | 1.12 → 0.49 |
| 초전도 | 1.64 → 1.33 | 0.38 → 0.25 | 0.26 → 0.22 |
| 망령 군단 | 4.33 → 5.39 | 1.22 (0.33~2.32) → 1.76 (0.65~2.93) | 0.47 → 0.77 |
| 저주 낙인 | 0.39 → 2.44 | 0.28 (0.01~1.09) → 1.69 (0.41~5.70) | 0.08 → 0.79 |
| 영혼 수확 | 0.41 → 1.86 | 0.06 → 0.39 (0.28~0.50) | 0.06 → 0.40 |

- 판정: 번개 계열은 모든 장면에서 ×2 이내(전: 폭풍의 눈 초원 ×5.8). 망령 군단은 Lv6 장면 ×1.5~2.9, **Lv1(×0.65~0.8)·망령 기사 변이(×0.73)는 평균 아래** — Lv1은 유령 4마리가 0.4초 살다 사라지는 게 본질(평균 동시 0.45마리). 저주 낙인은 Lv1 ×4~6, Lv6 ×0.4~0.75(같은 장면에 회오리 ≈ 8%가 평균을 끌어올림 — 밝기로는 ×0.8~1.3). 영혼 수확은 처치 수에 묶여 ×0.3~0.5(전 ×0.06). 흰 화면(휘도 > 235 픽셀, 최악 프레임) 초원 융합 13.3% → 14.9%(심판 광선이 번개 수요가 줄어 덜 눌림 — 초원 하늘 바탕이 ≈ 7%), 나머지 장면은 같거나 낮음. 적·영웅·숫자는 그대로 읽힌다(비교 스크린샷).
- 비용(데스크톱, 390×844, 가장 무거운 Lv6 묘지 장면): 프레임 3.46 → 3.98ms(중앙값, 그리기 호출 354 → 410) — 망령 잔상·저주 룬 몫과, 번개 스프라이트가 줄어 LOD(`glowK`)가 다른 입자를 더 허용하는 몫(추정). 60fps 예산 안.

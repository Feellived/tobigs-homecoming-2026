# TOBIG'S Homecoming Day 2026 — 웹 초대장

정적 원페이지 초대장. 서버 없음, GitHub Pages로 배포.

- 배포 주소: https://homecoming.datamarket.ai.kr/
- 파일: `index.html` 하나 + `assets/`

## 링크 바꾸기 (10/19 RSVP 오픈 전)

`index.html` 상단의 `EDIT HERE` 블록 4줄만 수정:

```js
const RSVP_URL    = "#";   // → 참석 신청 구글폼 링크
const CONTACT_URL = "#";   // → 운영부 오픈채팅 링크
const SURVEY_URL  = "#";   // 행사 후 설문 링크 (행사 다음날부터 자동 표시)
const PHOTOS_URL  = "#";   // 행사 후 사진 폴더 링크
const SITE_URL    = "https://homecoming.datamarket.ai.kr/";
const RSVP_DEADLINE = "2026년 11월 1일(일)";
```

`#`인 동안은 신청 버튼이 "10월 오픈" 상태로 비활성 표시됩니다. 링크를 넣는 순간 자동으로 활성화됩니다.

## 과거 사진 넣기

`assets/photos/01.jpg` ~ `09.jpg` 이름으로 넣으면 "그때의 TOBIG'S" 섹션이 자동으로 나타납니다. 한 장도 없으면 섹션이 숨겨집니다.

- 가로형, 긴 변 1600px 이상, 1장당 500KB 이하 권장
- 01.jpg가 가장 크게 보입니다 (대표 단체사진)
- 서로 다른 기수를 섞어서, 개인 클로즈업 대신 단체·활동 사진

## 재배포

```bash
git add -A && git commit -m "update" && git push
```

푸시 후 1~2분이면 반영됩니다.

## 카톡 미리보기

`assets/og.png`(1200×630)가 카톡 링크 미리보기로 쓰입니다. 카톡이 예전 미리보기를 캐시하면 링크 끝에 `?v=2`처럼 쿼리를 붙여 공유하세요.


## 라이브 페이지 (`live/`)

행사 당일 실시간 질문·투표·진행 순서·내 테이블·참가자 카드·Lucky Draw 결과. Firebase Firestore(프로젝트 `tobigshoco`)를 쓰고 서버는 없음.

- 참가자: https://homecoming.datamarket.ai.kr/live/  (테이블 번호표·화면의 QR)
- 내 테이블: https://homecoming.datamarket.ai.kr/live/table/  (이름·기수로 조회, 기기에 기억. Firebase 없이 tables.json만 읽음)
- 참가자 카드: https://homecoming.datamarket.ai.kr/people/  (`people.json`, 명찰 QR은 `/people/?no=번호`. 검색 엔진 제외, 11/16 공개 → 12/21 삭제)
- 프로젝터: https://homecoming.datamarket.ai.kr/live/?screen
- 운영진: https://homecoming.datamarket.ai.kr/live/?admin  (Firebase Auth 이메일 로그인, 진행·질문·투표·체크인·추첨)

### 처음 한 번 할 것

1. Firebase 콘솔 → Firestore → 규칙 탭에 `live/firestore.rules` 내용을 붙여넣고 게시. 테스트 모드 규칙은 생성 30일 뒤 만료되므로 반드시 교체
2. Firebase 콘솔 → Authentication → 설정 → 승인된 도메인에 `homecoming.datamarket.ai.kr` 추가
3. 운영진 계정(이메일/비밀번호)은 Authentication → Users에서 관리. 규칙의 `isAdmin()` 이메일과 같아야 함

### 라이브에 필요한 데이터

| 기능 | 데이터 | 어디에 | 언제 |
| --- | --- | --- | --- |
| 진행 순서·타이머 | 순서 목록 | `live/index.html`의 `STEPS` 상수 | 완료 |
| 질문·투표 | 없음 (당일 생성) | Firestore `questions`, `polls/{id}/votes` | 운영 화면에서 당일 |
| 내 테이블 | 참가자 명단 + 1·2라운드 테이블 | `live/tables.json` | 11/16 배정 후 |
| 체크인 | 위 명단 | `tables.json` → 당일 체크 결과는 Firestore `checkins/{no}` | 당일 데스크 |
| 참가자 카드 | 공개 동의자의 이름·기수·하는 일·관심 분야·프로필 링크 | `people.json` (`tools/make_people.py`가 CSV에서 생성) | 11/16 |
| 명찰 QR | 번호별 PNG | `tools/make_qr.py` → `qr/badge/` (git 제외) | 11/16 |
| Lucky Draw | 위 명단 + 추가 응모(퀴즈 우승 테이블·스티커·사진) + 경품 13종 | 추가 응모는 운영 화면에 입력, 경품은 `AWARDS` 상수(추첨 순서대로 Big 상 6 → Bigger 상 4 → 3·2·1등) | 당일 |

### 테이블 배정 (11/16)

RSVP 시트에서 `tools/people.template.csv` 열 이름(명찰 번호, 이름, 기수, 1·2라운드, 하는 일, 관심 분야 1·2, 카드 공개 여부, 프로필 링크)으로 CSV를 만들고 `python3 tools/make_people.py 명단.csv --publish`를 돌리면 `live/tables.json`과 `people.json`이 함께 만들어진다. 이어서 `python3 tools/make_qr.py`로 명찰 QR PNG를 뽑아 명찰 디자인에 넣는다. 명찰 번호는 1부터 순서대로 매기고 명찰 인쇄에도 같은 번호를 쓴다. 이름은 명찰과 동일한 표기(띄어쓰기 무관, 기수는 "25기" 형식). `published`를 `true`로 바꾸면 `/live/table/` 조회와 체크인 명단, 추첨 풀이 살아난다.

```json
{ "published": true, "rows": [ { "no": 1, "name": "홍길동", "gen": "25기", "t1": 3, "t2": 7 } ] }
```

### 당일 흐름

운영 화면 "진행" 탭에서 순서를 시작하면 모든 화면의 Now와 남은 시간이 바뀌고, 프로젝터 화면의 내용도 순서에 맞게 바뀐다. 입장·Table Talk 1 = 1라운드 테이블 명단, 이동·Table Talk 2 = 2라운드 명단, Alumni Session = 질문·투표, Break = 큰 타이머, Lucky Draw = 당첨자 목록과 공 떨어뜨리기, 그 외(개회·퀴즈·단체사진 등 PPT를 쓰는 순서) = 슬로건만. 투표는 "열기"로 참가자 화면에 뜨고 "화면에 올리기"로 프로젝터에 결과가 뜬다. 체크인은 데스크 운영진이 휴대폰으로 체크하면 추첨 풀에 자동 반영. 추첨은 Big 상부터 13회, 응모권 수만큼 가중, 1인 1회. 경품은 `live/index.html`의 `AWARDS` 배열(추첨 순서).

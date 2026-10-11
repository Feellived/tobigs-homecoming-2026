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

행사 당일 실시간 질문·공감·투표·진행 순서·내 테이블·Lucky Draw 결과. Firebase Firestore(프로젝트 `tobigshoco`)를 쓰고 서버는 없음.

- 참가자: https://homecoming.datamarket.ai.kr/live/  (테이블 번호표·화면의 QR)
- 프로젝터: https://homecoming.datamarket.ai.kr/live/?screen
- 운영진: https://homecoming.datamarket.ai.kr/live/?admin  (Firebase Auth 이메일 로그인, 진행·질문·투표·체크인·추첨)

### 처음 한 번 할 것

1. Firebase 콘솔 → Firestore → 규칙 탭에 `live/firestore.rules` 내용을 붙여넣고 게시. 테스트 모드 규칙은 생성 30일 뒤 만료되므로 반드시 교체
2. Firebase 콘솔 → Authentication → 설정 → 승인된 도메인에 `homecoming.datamarket.ai.kr` 추가
3. 운영진 계정(이메일/비밀번호)은 Authentication → Users에서 관리. 규칙의 `isAdmin()` 이메일과 같아야 함

### 테이블 배정 (11/16)

`live/tables.json`의 `published`를 `true`로 바꾸고 `rows`에 `{ "no": 명찰번호, "name": "이름", "gen": "25기", "t1": 1라운드, "t2": 2라운드 }`를 채운다. 참가자 "내 테이블 찾기"와 운영진 체크인·추첨 풀이 이 파일을 쓴다.

### 당일 흐름

운영 화면 "진행" 탭에서 순서를 시작하면 모든 화면의 Now와 남은 시간이 바뀐다. 투표는 "열기"로 참가자 화면에 뜨고 "화면에 올리기"로 프로젝터에 결과가 뜬다. 체크인은 데스크 운영진이 휴대폰으로 체크하면 추첨 풀에 자동 반영. 추첨은 5등부터, 가중 추첨, 1인 1회. "1만 회 시뮬레이션" 버튼으로 리허설 때 확률 검증.

# TOBIG'S Homecoming Day 2026 — 웹 초대장

정적 원페이지 초대장. 서버 없음, GitHub Pages로 배포.

- 배포 주소: https://feellived.github.io/tobigs-homecoming-2026/
- 파일: `index.html` 하나 + `assets/`

## 링크 바꾸기 (10/19 RSVP 오픈 전)

`index.html` 상단의 `EDIT HERE` 블록 4줄만 수정:

```js
const RSVP_URL    = "#";   // → 참석 신청 구글폼 링크
const CONTACT_URL = "#";   // → 운영부 오픈채팅 링크
const SITE_URL    = "https://feellived.github.io/tobigs-homecoming-2026/";
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

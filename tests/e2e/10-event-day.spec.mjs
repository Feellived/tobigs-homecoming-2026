// 행사 당일 전체 시나리오: 행사 전 → 체크인 → 입장 → Alumni Session(질문·추천·투표) → Table Talk → Lucky Draw → 종료
// 등장 기기: 운영 노트북(관리), 프로젝터(?screen), 참가자 휴대폰 A·B·C(375px), C의 노트북(같은 사람·다른 기기), 명단에 없는 현장 참가자 D
// 명단: fixtures/people.csv(가상 40명)를 운영 화면 '명단' 탭으로 올림(저장소에는 명단 파일이 없음)
import { test, expect } from '@playwright/test';
import { newDevice, resetEmulators, adminLogin, adminTab, fillIdentity, uploadRoster, seed, FIXTURE, PHONE, LAPTOP, PROJECTOR, sleep } from '../lib/helpers.mjs';
import { collection, getDocs } from 'firebase/firestore';

test.describe.configure({ mode: 'serial' });

const A = { gen: '2기', name: '이지우', no: 1, t1: '1', t2: '4' };
const B = { gen: '3기', name: '박건우', no: 2 };
const C = { gen: '4기', name: '최서연', no: 3 };
const D = { gen: '10기', name: '현장참가' };
const Q1 = '투빅스 끝나고 첫 직장은 어떻게 구하셨나요? (A 질문)';
const XSS = '<img src=x onerror="window.__xss=1">질문';

let admin, proj, a, b, c, cLap, d;
const phones = () => [a, b, c, cLap, d];

test.beforeAll(async ({ browser }) => {
  await resetEmulators();
  admin = await newDevice(browser, LAPTOP);
  // 추첨 결과를 시험에서 고정하기 위한 장치: window.__rig 에 값을 넣으면 다음 rand() 한 번이 그 값이 된다
  await admin.context.addInitScript(() => {
    const orig = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = arr => { if (window.__rig && window.__rig.length && arr instanceof Uint32Array && arr.length === 1) { arr[0] = window.__rig.shift(); return arr; } return orig(arr); };
  });
  proj = await newDevice(browser, PROJECTOR);
  a = await newDevice(browser, PHONE); b = await newDevice(browser, PHONE); c = await newDevice(browser, PHONE);
  cLap = await newDevice(browser, LAPTOP); d = await newDevice(browser, PHONE);
});
test.afterAll(async () => { for (const x of [admin, proj, ...phones()]) await x?.context.close(); });

const xssFired = p => p.evaluate(() => window.__xss === 1);

test('0. 행사 전: 허브는 질문·투표만, 추첨은 잠김, 운영 화면 로그인', async () => {
  await a.page.goto('/live/');
  await expect(a.page.locator('#e-qa')).toBeVisible();
  for (const k of ['table', 'people', 'draw']) await expect(a.page.locator('#e-' + k)).toBeHidden();
  await expect(a.page.locator('#h-pre')).toBeVisible();
  await expect(a.page.locator('#h-now')).toBeHidden();
  await expect(a.page.locator('#h-tlh')).toHaveText('PROGRAM');
  await a.page.goto('/live/?draw');
  await expect(a.page.locator('#g-draw')).toContainText('추첨은 행사 당일 열립니다');

  // 명단을 올리기 전: 내 테이블 · 참가자 카드는 닫혀 있음
  await a.page.goto('/live/table/');
  await expect(a.page.locator('#box')).toContainText('배정 전');
  await a.page.goto('/people/');
  await expect(a.page.locator('#box')).toContainText('공개 전');

  await adminLogin(admin.page);
  await expect(admin.page.locator('#a-step')).toContainText('시작 전');
  await adminLogin(proj.page);                 // 프로젝터 탭은 운영 노트북 브라우저(로그인 상태)에서 연다
  await proj.page.goto('/live/?screen');
  await expect(proj.page.locator('#s-q')).toBeVisible(); // 행사 전 프로젝터 = 질문 목록
});

test('0-1. 명단 올리기: 잘못된 파일은 막고, 엑셀(EUC-KR) CSV도 읽고, 다시 올리면 통째로 바뀜', async () => {
  const p = admin.page;
  await adminTab(p, 'roster');
  await expect(p.locator('#a-rs')).toContainText('올린 명단 없음');
  // 잘못된 파일: 번호 중복·번호 없음·이름 없음 → 올리기 버튼 잠김
  await p.setInputFiles('#a-rf', FIXTURE('people-bad.csv'));
  await expect(p.locator('#a-rerr li')).toHaveCount(3);
  await expect(p.locator('#a-rerr')).toContainText('번호 1가 2행과 겹침');
  await expect(p.locator('#a-ru')).toBeDisabled();
  await expect(p.locator('#a-rp')).toContainText('쉼표, 있는 이름');      // 따옴표 안 쉼표
  await expect(p.locator('#a-rwarn')).toContainText('테이블 번호 비어 있음');
  // 엑셀 파일 그대로는 안내
  await p.setInputFiles('#a-rf', { name: '명단.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('PK') });
  await expect(p.locator('#a-rp')).toContainText('CSV 로 저장');
  await expect(p.locator('#a-ru')).toBeDisabled();
  // 엑셀 기본 CSV(EUC-KR, 기수 숫자만) 10명 → 올림
  await uploadRoster(p, FIXTURE('people-euckr.csv'), 10);
  await a.page.goto('/live/table/');
  await a.page.selectOption('#g', '2기'); await a.page.fill('#n', '이지우'); await a.page.click('#f button[type=submit]');
  await expect(a.page.locator('.nums .v').first()).toHaveText('1');           // 한글 깨짐 없이 찾음
  await a.page.click('#other');
  await a.page.selectOption('#g', '21기'); await a.page.fill('#n', '김민준'); await a.page.click('#f button[type=submit]');
  await expect(a.page.locator('#box')).toContainText('찾지 못했습니다');      // 20번(명단 밖)
  // 전체 40명으로 다시 올리기 → 20번도 찾아짐
  await uploadRoster(p, FIXTURE('people.csv'), 40);
  await a.page.selectOption('#g', '21기'); await a.page.fill('#n', '김민준'); await a.page.click('#f button[type=submit]');
  await expect(a.page.locator('.no')).toHaveText('명찰 번호 20');
  await a.page.click('#other');
  // 저장소에는 명단 파일이 없다
  for (const u of ['/live/tables.json', '/people.json']) expect((await a.page.request.get(u)).status(), u).toBe(404);
});

test('1. 체크인: 명단 40명 표시, 체크인·검색·현장 등록·사진·퀴즈 보너스', async () => {
  const p = admin.page;
  await adminTab(p, 'ci');
  await expect(p.locator('#a-cc')).toHaveText('체크인 0 / 명단 40 · 사진 6명');
  await expect(p.locator('#a-cl .ci')).toHaveCount(40);
  // 1~30번 체크인
  for (let n = 1; n <= 30; n++) {
    await p.locator(`#a-cl input[data-no="${n}"]`).check();
    await expect(p.locator('#a-cc')).toContainText(`체크인 ${n} /`);
  }
  // 체크 해제 후 다시 체크
  await p.locator('#a-cl input[data-no="30"]').uncheck();
  await expect(p.locator('#a-cc')).toContainText('체크인 29 /');
  await p.locator('#a-cl input[data-no="30"]').check();
  await expect(p.locator('#a-cc')).toContainText('체크인 30 /');
  // 검색: 이름 공백 무시, 번호 정확 일치
  await p.fill('#a-cs', '남궁민수');
  await expect(p.locator('#a-cl .ci')).toHaveCount(1);
  await p.fill('#a-cs', '7');
  await expect(p.locator('#a-cl .ci')).toHaveCount(1);
  await p.fill('#a-cs', '');
  await p.locator('#a-cu').check();
  await expect(p.locator('#a-cl .ci')).toHaveCount(10); // 미체크인만
  await p.locator('#a-cu').uncheck();
  // 현장 등록(명단에 없는 사람)
  await p.fill('#a-cno', '41'); await p.fill('#a-cn', '현장등록자'); await p.selectOption('#a-cg', '10기');
  await p.click('#a-ca button[type=submit]');
  await expect(p.locator('#a-cc')).toContainText('체크인 31 / 명단 40');
  await expect(p.locator('#a-cl .ci', { hasText: '현장등록자' })).toContainText('현장');
  // 사진 제공 토글(1번 켬) · 퀴즈 우승 3번 테이블
  await p.click('#a-cl .ph-t[data-p="1"]');
  await expect(p.locator('#a-cc')).toContainText('사진 7명');
  await p.click('#a-qt button[data-t="3"]');
  await expect(p.locator('#a-qt button[data-t="3"]')).toHaveClass(/on/);
  await expect(p.locator('#a-cl .ci', { has: p.locator('input[data-no="3"]') }).locator('.tk')).toHaveText('2장');
  await expect(p.locator('#a-cl .ci', { has: p.locator('input[data-no="1"]') }).locator('.tk')).toHaveText('2장');
  // 명단의 HTML 이름은 글자 그대로
  await expect(p.locator('#a-cl .ci', { has: p.locator('input[data-no="40"]') })).toContainText('<b>X</b>');
  expect(await xssFired(p)).toBe(false);
  // 새로고침해도 보너스 유지
  await p.reload(); await expect(p.locator('#a-tabs')).toBeVisible(); await adminTab(p, 'ci');
  await expect(p.locator('#a-cc')).toContainText('체크인 31 / 명단 40 · 사진 7명');
});

test('2. 입장(12:30): 진행 시작 → 모든 휴대폰 NOW 갱신, 내 테이블 · 참가자 카드', async () => {
  await adminTab(admin.page, 'prog');
  await admin.page.click('#a-steps button[data-i="0"]');
  await a.page.goto('/live/');
  await expect(a.page.locator('#h-now-step')).toHaveText('입장 · 체크인');
  await expect(a.page.locator('#e-table')).toBeVisible();
  await expect(a.page.locator('#h-pre')).toBeHidden();
  await expect(a.page.locator('#h-tl li.now')).toContainText('입장 · 체크인');
  // 프로젝터: 1라운드 테이블 배치
  await expect(proj.page.locator('#s-step')).toHaveText('입장 · 체크인');
  await expect(proj.page.locator('#s-t .tb')).toHaveCount(8);
  // 로그인하지 않은 브라우저의 프로젝터 화면에는 이름이 나오지 않음
  const anonProj = await newDevice(proj.context.browser(), PROJECTOR);
  await anonProj.page.goto('/live/?screen');
  await expect(anonProj.page.locator('#s-t')).toContainText('명찰에 적힌 테이블 번호로');
  await anonProj.context.close();

  // 내 테이블: 기수+이름으로 찾기 → 저장 → 다시 열면 바로 표시
  await a.page.click('#e-table');
  await a.page.selectOption('#g', A.gen); await a.page.fill('#n', ' 이 지우 ');
  await a.page.click('#f button[type=submit]');
  await expect(a.page.locator('.nums .v').nth(0)).toHaveText(A.t1);
  await expect(a.page.locator('.nums .v').nth(1)).toHaveText(A.t2);
  await a.page.reload();
  await expect(a.page.locator('.name')).toContainText(A.name);
  // 없는 사람
  await d.page.goto('/live/table/');
  await d.page.selectOption('#g', D.gen); await d.page.fill('#n', D.name); await d.page.click('#f button[type=submit]');
  await expect(d.page.locator('#box')).toContainText('찾지 못했습니다');

  // 참가자 카드: 명찰 QR(?no=1) → 내 카드 + 목록, 비공개(5의 배수)는 제외, 필터
  await a.page.goto('/people/?no=1');
  await expect(a.page.locator('.p.me .nm')).toContainText(A.name);
  await expect(a.page.locator('.cnt')).toHaveText('32명');
  await a.page.click('.chip[data-t="5"]');
  const n5 = Number((await a.page.locator('.cnt').textContent()).replace(/\D/g, ''));
  expect(n5).toBeGreaterThan(0); expect(n5).toBeLessThan(32);
  await a.page.click('.chip[data-t="5"]');
  await a.page.fill('#q', '남궁');
  await expect(a.page.locator('.grid .p')).toHaveCount(1);
  expect(await xssFired(a.page)).toBe(false); // 39번 소개란의 <img onerror>
  await expect(a.page.locator('.grid .p .in')).toContainText('<img');
});

test('3. Alumni Session: 질문 게시(신원 1회 입력·명단 미리 채움) · 추천 · 같은 사람 다른 기기 · 현장 참가자', async () => {
  await admin.page.click('#a-steps button[data-i="4"]');
  await expect(proj.page.locator('#s-q')).toBeVisible();

  // A: 질문 대상 정세영 선배님 → 처음이라 신원 시트, 내 테이블에서 찾은 값이 미리 채워짐
  await a.page.goto('/live/?qa');
  await expect(a.page.locator('#q-now-step')).toHaveText('Alumni Session');
  await expect(a.page.locator('#g-who')).toContainText('참여 정보 입력');
  await a.page.click('#g-to button[data-to="정세영"]');
  await a.page.fill('#g-text', Q1);
  await a.page.click('#g-submit');
  await expect(a.page.locator('#me-g')).toHaveValue(A.gen);
  await expect(a.page.locator('#me-n')).toHaveValue(A.name);
  await a.page.locator('#me-f button[type=submit]').click();
  const qa1 = a.page.locator('.q', { hasText: Q1 });
  await expect(qa1).toContainText('내 질문');
  await expect(qa1).toContainText('정세영 선배님께');
  await expect(qa1.locator('.m')).toContainText(A.gen);
  await expect(qa1).not.toContainText(A.name.slice(1)); // 이름은 화면에 안 보임 (기수만)
  await expect(a.page.locator('#g-who')).toContainText(`${A.gen} ${A.name}`);
  // 새로고침해도 다시 묻지 않음
  await a.page.reload();
  await expect(a.page.locator('#g-who')).toContainText(`참여 중 · ${A.gen} ${A.name}`);

  // 프로젝터 반영
  await expect(proj.page.locator('#s-q .sq', { hasText: Q1 })).toBeVisible();

  // B: 추천 → 신원 시트(미리 채움 없음) → 추천 1
  await b.page.goto('/live/?qa');
  await b.page.locator('.q', { hasText: Q1 }).locator('.vote').click();
  await expect(b.page.locator('#me-n')).toHaveValue('');
  await fillIdentity(b.page, B.gen, B.name);
  await expect(b.page.locator('.q', { hasText: Q1 }).locator('.vote')).toHaveText('추천 완료 1');
  await expect(a.page.locator('.q', { hasText: Q1 }).locator('.vote')).toHaveText('추천 1'); // 실시간
  // 두 번째 추천은 시트 없이 바로 (최초 1회만)
  await b.page.locator('.q', { hasText: Q1 }).locator('.vote').click();
  await expect(b.page.locator('#me-f')).toHaveCount(0);
  await expect(b.page.locator('.q', { hasText: Q1 }).locator('.vote')).toHaveText('추천 0');
  await b.page.locator('.q', { hasText: Q1 }).locator('.vote').click();
  await expect(b.page.locator('.q', { hasText: Q1 }).locator('.vote')).toHaveText('추천 완료 1');

  // C: 휴대폰에서 추천 → 노트북에서 같은 이름(공백 섞어서)으로 들어오면 이미 추천한 것으로 보임
  await c.page.goto('/live/?qa');
  await c.page.locator('.q', { hasText: Q1 }).locator('.vote').click();
  await fillIdentity(c.page, C.gen, C.name);
  await expect(c.page.locator('.q', { hasText: Q1 }).locator('.vote')).toHaveText('추천 완료 2');
  await cLap.page.goto('/live/?qa');
  await cLap.page.click('#g-chg');
  await fillIdentity(cLap.page, C.gen, '최 서연');
  await expect(cLap.page.locator('.q', { hasText: Q1 }).locator('.vote')).toHaveText('추천 완료 2');

  // D: 명단에 없는 사람 → 경고 후 한 번 더 누르면 참여
  await d.page.goto('/live/?qa');
  await d.page.locator('.q', { hasText: Q1 }).locator('.vote').click();
  await fillIdentity(d.page, D.gen, D.name, { confirmUnlisted: true });
  await expect(d.page.locator('.q', { hasText: Q1 }).locator('.vote')).toHaveText('추천 완료 3');

  // B: HTML이 섞인 질문(모두에게) → 모든 화면에서 글자 그대로, 스크립트 실행 안 됨
  await b.page.fill('#g-text', XSS);
  await b.page.click('#g-submit');
  await expect(b.page.locator('.q', { hasText: 'onerror' })).toBeVisible();
  await expect(proj.page.locator('#s-q .sq', { hasText: 'onerror' })).toBeVisible();
  await adminTab(admin.page, 'q');
  await expect(admin.page.locator('#a-ql .q', { hasText: 'onerror' })).toBeVisible();
  for (const x of [a, b, proj, admin]) expect(await xssFired(x.page)).toBe(false);
  await expect(b.page.locator('#g-submit')).toBeDisabled(); // 연속 게시 8초 제한

  // 정렬·필터
  await a.page.click('#g-sort button[data-s="new"]');
  await expect(a.page.locator('#g-list .q').first()).toContainText('onerror');
  await a.page.click('#g-sort button[data-s="top"]');
  await expect(a.page.locator('#g-list .q').first()).toContainText(Q1);
  await a.page.click('#g-filter button[data-f="정세영"]');
  await expect(a.page.locator('#g-list .q')).toHaveCount(1);
  await a.page.click('#g-filter button[data-f="경민수"]');
  await expect(a.page.locator('#g-list')).toContainText('아직 이 대상에게 온 질문이 없어요');
  await a.page.click('#g-filter button[data-f="*"]');

  // 연사 카드 펼침
  await a.page.click('.spk[data-i="0"]');
  await expect(a.page.locator('#spd')).toBeVisible();
  await expect(a.page.locator('#spd')).toContainText('정세영');

  // 운영: 답변 완료 → 휴대폰에 표시·추천 버튼 잠김 / 숨김 → 휴대폰·프로젝터에서 사라짐
  await admin.page.locator('#a-ql .q', { hasText: Q1 }).locator('button[data-a="ans"]').click();
  await expect(a.page.locator('.q', { hasText: Q1 })).toContainText('답변 완료');
  await expect(a.page.locator('.q', { hasText: Q1 }).locator('.vote')).toBeDisabled();
  await expect(proj.page.locator('#s-q .sq', { hasText: Q1 })).toContainText('답변 완료');
  await admin.page.locator('#a-ql .q', { hasText: 'onerror' }).locator('button[data-a="hide"]').click();
  await expect(a.page.locator('.q', { hasText: 'onerror' })).toHaveCount(0);
  await expect(proj.page.locator('#s-q .sq', { hasText: 'onerror' })).toHaveCount(0);
  await expect(admin.page.locator('#a-ql .q', { hasText: 'onerror' })).toContainText('숨김');
});

test('4. 투표: 열기 ≠ 결과 공개(회귀), 1인 1표, 결과 공개 시 전체 화면·내 선택·1위, 다른 화면에서 강제 이동', async () => {
  const P = admin.page;
  await adminTab(P, 'poll');
  await P.fill('#a-pq', '가장 기대되는 순서는?');
  await P.fill('#a-po', 'Alumni Session\nTable Talk\nLucky Draw');
  await P.click('#a-pf button[type=submit]');
  const card = P.locator('#a-pl section.card', { hasText: '가장 기대되는 순서는?' });
  await expect(card).toContainText('닫힘');
  await card.locator('button[data-a="open"]').click();
  await expect(card).toContainText('진행 중');
  await expect(card).not.toContainText('결과 공개 중');

  // 회귀: 열기만 했을 때 참가자 화면에 결과 전체 화면(#fv)이 뜨면 안 된다
  await expect(a.page.locator('#g-poll .opt')).toHaveCount(3);
  await sleep(1500);
  for (const x of [a, b, c]) await expect(x.page.locator('#fv')).toHaveCount(0);

  // 투표: A=Table Talk, B=Lucky Draw, C=Table Talk, D=Alumni
  await a.page.locator('#g-poll .opt').nth(1).click();
  await expect(a.page.locator('#g-poll')).toContainText('투표 완료 · Table Talk');
  await b.page.locator('#g-poll .opt').nth(2).click();
  await c.page.locator('#g-poll .opt').nth(1).click();
  await d.page.locator('#g-poll .opt').nth(0).click();
  await expect(d.page.locator('#g-poll')).toContainText('투표 완료');
  // C 노트북(같은 사람): 이미 투표한 것으로 보이고, 다시 투표 불가
  await cLap.page.reload();
  await expect(cLap.page.locator('#g-poll')).toContainText('투표 완료 · Table Talk');
  await expect(P.locator('#a-pl section.card', { hasText: '가장 기대되는 순서는?' })).toContainText('4명');
  await expect(proj.page.locator('#s-r')).toContainText('4명 참여');

  // 닫기 → 휴대폰 투표 카드 사라짐, 결과는 아직 안 뜸
  await card.locator('button[data-a="open"]').click();
  await expect(a.page.locator('#g-poll')).toBeHidden();
  await expect(a.page.locator('#fv')).toHaveCount(0);
  await expect(proj.page.locator('#s-r')).not.toContainText('가장 기대되는'); // 닫힘 + 비공개 → 프로젝터에서도 내려감

  // B는 내 테이블 화면, C는 참가자 카드 화면으로 가 있는 상태에서 결과 공개
  await b.page.goto('/live/table/'); await expect(b.page.locator('.nums, #f').first()).toBeVisible();
  await c.page.goto('/people/'); await expect(c.page.locator('.grid')).toBeVisible();
  await a.page.goto('/live/');
  await card.locator('button[data-a="show"]').click();
  await expect(card).toContainText('결과 공개 중');
  for (const x of [a, b, c, d]) {
    await expect(x.page.locator('#fv')).toBeVisible({ timeout: 15_000 });
    await expect(x.page.locator('#fv-t')).toHaveText('4명 참여');
  }
  expect(b.page.url()).toContain('/live/?qa');
  expect(c.page.url()).toContain('/live/?qa');
  await expect(proj.page.locator('#s-r')).toContainText('투표 · 마감');
  await expect(proj.page.locator('#s-r')).toContainText('4명 참여');
  const res = a.page.locator('#fv .res');
  await expect(res.nth(1).locator('b')).toHaveText('2');
  await expect(res.nth(1)).toHaveClass(/lead/);
  await expect(res.nth(1).locator('.rk1')).toBeVisible();
  await expect(res.nth(1).locator('.mine')).toBeVisible();   // A의 선택
  await expect(res.nth(0).locator('.mine')).toBeHidden();
  await expect(d.page.locator('#fv .res').nth(0).locator('.mine')).toBeVisible();
  // 닫기 버튼으로 내 화면에서만 닫힘
  await a.page.click('#fv-x');
  await expect(a.page.locator('#fv')).toHaveCount(0);
  await expect(d.page.locator('#fv')).toBeVisible();
  // 결과 내리기
  await card.locator('button[data-a="show"]').click();
  for (const x of [b, d]) await expect(x.page.locator('#fv')).toHaveCount(0);
});

test('4-1. 투표: 앞 투표 결과가 공개된 채로 다음 투표를 열면, 참가자 화면이 앞 결과에 가려지지 않아야 한다', async () => {
  const P = admin.page;
  const c1 = P.locator('#a-pl section.card', { hasText: '가장 기대되는 순서는?' });
  await c1.locator('button[data-a="show"]').click();           // 1번 투표 결과 다시 공개
  await expect(d.page.locator('#fv')).toBeVisible();
  await P.fill('#a-pq', '오늘 몇 시까지 계실 건가요?');
  await P.fill('#a-po', '단체사진까지\n뒤풀이까지');
  await P.click('#a-pf button[type=submit]');
  const c2 = P.locator('#a-pl section.card', { hasText: '오늘 몇 시까지' });
  await c2.locator('button[data-a="open"]').click();
  await expect(d.page.locator('#g-poll .opt')).toHaveCount(2);
  await expect(d.page.locator('#fv')).toHaveCount(0);            // 결과 전체 화면이 새 투표를 덮으면 안 됨
  await expect(c1).not.toContainText('결과 공개 중');
  // 열린 채로 결과 공개 → 그 뒤 들어온 표도 몇 초 안에 결과 화면 숫자에 반영(운영 화면이 집계를 다시 씀)
  await a.page.goto('/live/?qa');
  await a.page.locator('#g-poll .opt').nth(0).click();
  await expect(a.page.locator('#g-poll')).toContainText('투표 완료');
  await c2.locator('button[data-a="show"]').click();
  await expect(d.page.locator('#fv-t')).toHaveText('1명 참여');
  await expect(a.page.locator('#fv .res').nth(0).locator('.mine')).toBeVisible(); // 이 기기에 남긴 내 선택
  await d.page.locator('#fv-x').click();
  await d.page.reload();
  await expect(d.page.locator('#fv')).toBeVisible();
  await d.page.locator('#fv-x').click();
  await d.page.locator('#g-poll .opt').nth(1).click();
  await expect(d.page.locator('#g-poll')).toContainText('투표 완료');
  await b.page.goto('/live/?qa');
  await expect(b.page.locator('#fv-t')).toHaveText('2명 참여', { timeout: 8_000 });
  await expect(b.page.locator('#fv .res').nth(1).locator('b')).toHaveText('1');
  await c2.locator('button[data-a="show"]').click();             // 결과 내리기
  await c2.locator('button[data-a="open"]').click();             // 닫기
});

test('5. Table Talk · Break · 퀴즈: 프로젝터 화면 전환, 허브 강조 메뉴', async () => {
  await adminTab(admin.page, 'prog');
  await admin.page.click('#a-steps button[data-i="5"]');
  await expect(proj.page.locator('#s-step')).toHaveText('Table Talk 1');
  await expect(proj.page.locator('#s-t .tb')).toHaveCount(8);
  await expect(proj.page.locator('#s-t .tb').first()).toContainText('1');
  await a.page.goto('/live/');
  await expect(a.page.locator('#e-table')).toHaveClass(/primary/);
  await admin.page.click('#a-next');                              // Break 1
  await expect(proj.page.locator('#s-bt')).toHaveText(/^\d\d:\d\d$/);
  await admin.page.click('#a-next');                              // Quiz
  await expect(proj.page.locator('.idle')).toBeVisible();
  await admin.page.click('#a-next');                              // 2라운드 이동
  await expect(proj.page.locator('#s-body h3')).toHaveText('2라운드 테이블');
  await admin.page.click('#a-next');                              // Table Talk 2
  await expect(a.page.locator('#e-people')).toHaveClass(/primary/);
  await expect(a.page.locator('#h-tl li.done')).toHaveCount(9);
});

test('6. Lucky Draw: 응모권 계산 → 7개 상 추첨, 모든 휴대폰·프로젝터에 슬롯 연출, 당첨자 축하, 재추첨, 새로고침 복구, 초기화', async () => {
  test.setTimeout(240_000);
  const P = admin.page;
  await P.click('#a-steps button[data-i="10"]');
  await expect(proj.page.locator('#s-body h3')).toHaveText('Lucky Draw');
  await expect(a.page.locator('#e-draw')).toHaveClass(/primary/);
  await b.page.goto('/live/?draw'); await expect(b.page.locator('#g-draw')).toContainText('추첨 전');
  await c.page.goto('/people/');    await expect(c.page.locator('.grid')).toBeVisible();

  await adminTab(P, 'draw');
  await P.click('#a-build');
  // 체크인 31명. 기본 1장 + 퀴즈 3번 테이블(3·11·19·27번) +1 + 사진(1·6·12·18·24·30번) +1 → 31 + 4 + 6 = 41장
  await expect(P.locator('#a-pool')).toContainText('31명 · 응모권 41장');
  await P.locator('input[name=src][value=all]').check(); await P.click('#a-build');
  await expect(P.locator('#a-pool')).toContainText('40명');
  await P.locator('input[name=src][value=ci]').check(); await P.click('#a-build');

  await expect(P.locator('#a-btns button[data-r="1"]')).toHaveClass(/btn-primary/);  // 다음 순서 강조
  await expect(P.locator('#a-btns button[data-r="2"]')).not.toHaveClass(/btn-primary/);
  // 첫 추첨(Homecoming 상 1/2)은 A(1번)가 뽑히도록 고정
  await P.evaluate(() => { window.__rig = [0]; });
  await P.click('#a-btns button[data-r="1"]');
  await expect(P.locator('#a-res .big')).toHaveText(A.name);
  for (const x of [a, b, proj]) await expect(x.page.locator('.ov.rl')).toBeVisible({ timeout: 8_000 });
  expect(c.page.url()).toContain('/live/?draw');                  // 참가자 카드 화면 → 추첨 화면으로 이동
  await expect(a.page.locator('.youwin')).toBeVisible({ timeout: 20_000 });   // 당첨자 본인 축하
  await expect(b.page.locator('.ov.rl .nm').last()).toHaveText(A.name, { timeout: 20_000 });
  await expect(b.page.locator('.youwin')).toHaveCount(0);
  await expect(proj.page.locator('.ov.rl .nm').last()).toHaveText(A.name, { timeout: 20_000 });
  await expect(proj.page.locator('#s-w .win')).toHaveCount(1);
  await expect(b.page.locator('#g-draw .win')).toHaveCount(1);
  await a.page.click('#yw-x');
  await expect(P.locator('#a-btns button[data-r="2"]')).toHaveClass(/btn-primary/);

  // 나머지 6개
  for (let r = 2; r <= 7; r++) { await P.click(`#a-btns button[data-r="${r}"]`); await expect(P.locator(`#a-btns button[data-r="${r}"]`)).toBeDisabled(); await sleep(400); }
  await expect(b.page.locator('#g-draw .win')).toHaveCount(7);
  const nos = async () => (await P.locator('#a-w .win span.muted').allTextContents()).map(t => t.match(/(\d+)번/)[1]);
  expect(new Set(await nos()).size).toBe(7);                      // 중복 당첨 없음(명찰 번호 기준. 더미 명단엔 기수만 다른 동명이인이 있음)
  await expect(proj.page.locator('#s-w .win').first()).toContainText('1등');

  // 재추첨(마지막 = 1등)
  await P.click('#a-redo');
  await expect(P.locator('#a-res')).toContainText('재추첨');
  const after = await nos();
  expect(after.length).toBe(7); expect(new Set(after).size).toBe(7);

  // 운영 화면 새로고침 → 결과 복구, 이미 뽑은 상 버튼은 잠김
  await P.reload(); await expect(P.locator('#a-tabs')).toBeVisible(); await adminTab(P, 'draw');
  await expect(P.locator('#a-w .win')).toHaveCount(7);
  await expect(P.locator('#a-btns button[data-r="7"]')).toBeDisabled();

  // 초기화
  await P.click('#a-reset');
  await expect(b.page.locator('#g-draw')).toContainText('추첨 전');
  await expect(proj.page.locator('#s-w')).toContainText('Homecoming 상부터');
});

test('7. 종료 → 진행 초기화: 허브가 행사 전 모드로 돌아가고, 페이지 오류 없음', async () => {
  const P = admin.page;
  await adminTab(P, 'prog');
  await P.click('#a-steps button[data-i="12"]');
  await a.page.goto('/live/');
  await expect(a.page.locator('#h-now-step')).toContainText('행사 종료');
  await P.click('#a-progreset');
  await expect(a.page.locator('#h-pre')).toBeVisible();
  await expect(a.page.locator('#e-draw')).toBeHidden();
});

test('8. 행사 후: 명단 내리기 → 내 테이블·참가자 카드 닫힘, 전체 삭제 → Firestore에 개인 정보가 남지 않음', async () => {
  const P = admin.page;
  await adminTab(P, 'roster');
  await P.click('#a-rd');
  await expect(P.locator('#a-rs')).toContainText('올린 명단 없음');
  await a.page.goto('/live/table/'); await expect(a.page.locator('#box')).toContainText('배정 전');
  await a.page.goto('/people/');     await expect(a.page.locator('#box')).toContainText('공개 전');
  // 전체 삭제: '삭제'를 정확히 입력해야 실행
  P.__prompt = '아니오'; await P.click('#a-wipe'); await sleep(800);
  const count = async c => { let n = 0; await seed(async db => { n = (await getDocs(collection(db, c))).size; }); return n; };
  expect(await count('questions')).toBeGreaterThan(0);
  P.__prompt = '삭제'; await P.click('#a-wipe');
  await expect.poll(() => count('questions'), { timeout: 15_000 }).toBe(0);
  for (const c of ['roster', 'checkins', 'polls']) expect(await count(c), c).toBe(0);
  let left = []; await seed(async db => { left = (await getDocs(collection(db, 'state'))).docs.map(d => d.id); });
  expect(left).toEqual(['program']);                                  // 진행 상태(시작 전)만 남음
  await a.page.goto('/live/?qa');
  await expect(a.page.locator('#g-list')).toContainText('첫 질문을 올려주세요');
  await adminTab(P, 'ci'); await P.reload(); await expect(P.locator('#a-tabs')).toBeVisible(); await adminTab(P, 'ci');
  await expect(P.locator('#a-cc')).toHaveText('체크인 0 / 명단 0 · 사진 0명');
});

test('9. 모든 기기에서 페이지 JS 오류 없음', async () => {
  const errs = [admin, proj, ...phones()].flatMap(x => x.page.__errors);
  expect(errs, '페이지 JS 오류').toEqual([]);
});

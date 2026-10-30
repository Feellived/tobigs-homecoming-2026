// 곰돌이 챗봇 위젯(assets/ask.js): 어느 화면에 뜨는지, 하단 고정 바·결과 전체 화면과 겹치지 않는지, 대화·오류·링크 허용 목록·XSS
import { test, expect } from '@playwright/test';
import { newDevice, resetEmulators, seed, PHONE, sleep } from '../lib/helpers.mjs';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

const box = (p, sel) => p.locator(sel).boundingBox();
const overlap = (a, b) => a && b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.beforeAll(resetEmulators);

test('곰돌이 버튼: 참가자 화면에는 있고 운영·프로젝터·도우미 전용 화면에는 없다', async ({ browser }) => {
  const { page, context } = await newDevice(browser, PHONE);
  for (const u of ['/', '/live/', '/live/?qa', '/live/?draw', '/live/table/', '/people/']) {
    await page.goto(u); await expect(page.locator('.hk-fab'), u).toBeVisible();
    const b = await box(page, '.hk-fab'); expect(b.width, u + ' 터치 영역').toBeGreaterThanOrEqual(44);
  }
  for (const u of ['/live/?admin', '/live/?screen', '/live/?ask']) { await page.goto(u); await sleep(300); await expect(page.locator('.hk-fab'), u).toHaveCount(0); }
  await context.close();
});

test('초대장(375px): 스크롤해서 하단 고정 바가 올라와도 곰돌이 버튼과 겹치지 않는다(맨 아래 포함)', async ({ browser }) => {
  const { page, context } = await newDevice(browser, PHONE);
  await page.goto('/');
  let seen = 0;
  for (const y of [900, 2500, 99999]) {
    await page.evaluate(y => scrollTo(0, y), y); await sleep(1100); // 버튼 이동 전환 .25s + 스크롤 흐림 .7s
    const sticky = await page.locator('#sticky').count() ? await box(page, '#sticky') : null;
    const shown = await page.locator('#sticky.show').count();
    const fab = await box(page, '.hk-fab');
    if (shown) { seen++; expect(overlap(fab, sticky), `y=${y} 고정 바와 겹침`).toBeFalsy(); }
    // 버튼 가운데를 눌렀을 때 실제로 버튼이 눌리는지(다른 요소에 가려지지 않음)
    const hit = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('.hk-fab'), { x: fab.x + fab.width / 2, y: fab.y + fab.height / 2 });
    expect(hit, `y=${y} 버튼이 가려짐`).toBe(true);
  }
  expect(seen, '고정 바가 한 번도 안 올라옴').toBeGreaterThan(0);
  // 고정 바의 RSVP·목차 버튼도 곰돌이에 가려지지 않음
  await page.evaluate(() => scrollTo(0, 1500)); await sleep(1100);
  if (await page.locator('#sticky.show').count()) {
    for (const el of await page.locator('#sticky a, #sticky button').all()) {
      if (!(await el.isVisible())) continue;
      const b = await el.boundingBox();
      const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.hk-fab') ? 'fab' : 'ok', { x: b.x + b.width - 4, y: b.y + b.height / 2 });
      expect(top).toBe('ok');
    }
  }
  await context.close();
});

test('라이브 화면: 맨 아래까지 스크롤하면 마지막 버튼이 곰돌이에 가려지지 않고, 결과 전체 화면이 뜨면 곰돌이는 그 아래로', async ({ browser }) => {
  await seed(async db => {
    await setDoc(doc(db, 'state', 'program'), { step: 4, endsAt: null });
    await setDoc(doc(db, 'polls', 'p1'), { q: '결과 공개 테스트', options: ['가', '나'], open: false, show: false, createdAt: Timestamp.now() });
  });
  const { page, context } = await newDevice(browser, PHONE);
  for (const [u, last] of [['/live/', 'a.btn[href="../"]'], ['/live/?qa', '#g-list'], ['/live/?draw', '#g-draw']]) {
    await page.goto(u); await page.evaluate(() => scrollTo(0, 99999)); await sleep(900);
    const b = await box(page, last), fab = await box(page, '.hk-fab');
    expect(b.y + b.height <= fab.y || !overlap(b, fab) || b.width > 300, `${u}: 마지막 요소 ${last} 가 곰돌이에 가려짐`).toBeTruthy();
    const blocked = await page.evaluate(sel => { const r = document.querySelector(sel).getBoundingClientRect(); const e = document.elementFromPoint(r.right - 30, r.bottom - 8); return !!e?.closest('.hk-fab'); }, last);
    expect(blocked, `${u}: ${last} 오른쪽 아래 끝이 곰돌이 아래`).toBe(false);
  }
  await page.goto('/live/?qa');
  await seed(db => setDoc(doc(db, 'polls', 'p1'), { show: true }, { merge: true }));
  await expect(page.locator('#fv')).toBeVisible();
  const fab = await box(page, '.hk-fab');
  const top = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.hk-fab') ? 'fab' : 'overlay', { x: fab.x + fab.width / 2, y: fab.y + fab.height / 2 });
  expect(top).toBe('overlay');
  await seed(db => setDoc(doc(db, 'polls', 'p1'), { show: false }, { merge: true }));
  await context.close();
});

test('대화: 답변 표시, 허용 목록 밖 링크 제거, 답변 속 HTML은 글자 그대로, 오류 시 오픈채팅 안내, 화면을 옮겨도 대화 유지', async ({ browser }) => {
  let mode = 'ok';
  const { page, context } = await newDevice(browser, PHONE, { chat: async () =>
    mode === 'ok' ? { answer: '올림픽회관 B1입니다.\n<img src=x onerror="window.__xss=1">', links: ['map_kakao', 'evil', 'javascript:alert(1)'] }
    : mode === 'busy' ? { status: 429, error: 'busy' } : { status: 500 } });
  await page.goto('/live/');
  await page.click('.hk-fab', { force: true }); // 둥실 애니메이션 때문에 '안정' 대기를 건너뜀
  const dlg = page.locator('.hk-sheet[role=dialog]');
  await expect(dlg).toBeVisible();
  await expect(dlg.locator('.hk-sug button')).toHaveCount(6);
  await dlg.locator('.hk-sug button').first().click();               // 추천 질문
  await expect(dlg.locator('.bub.a').last()).toContainText('올림픽회관 B1');
  await expect(dlg.locator('.bub.a').last()).toContainText('<img');   // 글자 그대로
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  const links = dlg.locator('.bub.a').last().locator('.lk a');
  await expect(links).toHaveCount(1);
  await expect(links.first()).toHaveAttribute('href', /^https:\/\/map\.kakao\.com\//);
  await expect(links.first()).toHaveAttribute('rel', /noopener/);
  await expect(dlg.locator('.hk-sug')).toBeHidden();                 // 대화 시작 후 추천 줄 숨김
  // 요청 형식: deviceId = 기기 난수, 최근 대화만
  const sent = context.__chat.at(-1);
  expect(sent.deviceId).toMatch(/^[0-9a-f-]{36}$/);
  expect(sent.messages.at(-1)).toEqual({ role: 'user', content: '오시는 길 알려줘' });
  // Enter로 보내기 · 300자 제한
  await dlg.locator('input').fill('가'.repeat(400));
  expect((await dlg.locator('input').inputValue()).length).toBe(300);
  mode = 'busy'; await dlg.locator('input').press('Enter');
  await expect(dlg.locator('.bub.e')).toContainText('질문이 몰려');
  await expect(dlg.locator('.lk a', { hasText: '오픈채팅' })).toBeVisible();
  mode = 'down'; await dlg.locator('input').fill('주차?'); await dlg.locator('.hk-go').click();
  await expect(dlg.locator('.bub.e')).toHaveCount(1);                // 이전 오류는 지우고 새 오류 하나
  await expect(dlg.locator('.bub.e')).toContainText('답변을 가져오지 못했어요');
  // 배경 눌러 닫기 → 다른 화면에서 다시 열면 대화 유지
  await page.mouse.click(10, 10);
  await expect(dlg).toHaveCount(0);
  await page.goto('/live/table/'); await page.click('.hk-fab', { force: true }); // 둥실 애니메이션 때문에 '안정' 대기를 건너뜀
  await expect(page.locator('.hk-sheet .bub.u').first()).toHaveText('오시는 길 알려줘');
  await page.click('.hk-x'); await expect(page.locator('.hk-sheet')).toHaveCount(0);
  await page.goto('/live/?ask');
  await expect(page.locator('#k-card .bub.u').first()).toHaveText('오시는 길 알려줘');
  await context.close();
});

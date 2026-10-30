// 모바일·접근성 점검: 320/375px 가로 넘침, 터치 영역, axe(WCAG 2 A/AA: 대비·이름·라벨), 키보드 조작
// 넘침과 24px 미만 터치 영역(WCAG 2.5.8 AA)은 실패로, 나머지는 test-results/a11y.json 에 모아 감사 문서에 반영한다.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { newDevice, resetEmulators, seed, seedRoster, overflow, PHONE, sleep } from '../lib/helpers.mjs';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

const REPORT = {};
test.afterAll(() => { mkdirSync('test-results', { recursive: true }); writeFileSync('test-results/a11y.json', JSON.stringify(REPORT, null, 1)); });

const LONG = '투빅스에서 했던 프로젝트 경험이 실제 회사 면접이나 대학원 지원 과정에서 어떻게 평가받았는지, 그리고 지금 돌아보면 어떤 공부를 더 해 두었으면 좋았을지 구체적으로 듣고 싶습니다 ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghijklmnop';
const PAGES = [
  ['초대장', '/'], ['허브', '/live/'], ['질문·투표', '/live/?qa'], ['추첨', '/live/?draw'], ['도우미', '/live/?ask'],
  ['내 테이블', '/live/table/'], ['참가자 카드', '/people/?no=1'], ['운영 로그인', '/live/?admin'],
];

test.beforeAll(async ({ browser }) => {
  await resetEmulators();
  await seedRoster(browser);
  await seed(async db => {
    await setDoc(doc(db, 'state', 'program'), { step: 4, endsAt: Timestamp.fromMillis(Date.now() + 40 * 60000) });
    await setDoc(doc(db, 'questions', 'Q'.repeat(20)), { gen: '26기', text: LONG, name: '임지영', voters: Array.from({ length: 123 }, (_, i) => 'v' + i), createdAt: Timestamp.now(), hidden: false, answered: true, client: 'x' });
    await setDoc(doc(db, 'questions', 'R'.repeat(20)), { gen: '1기', text: '짧은 질문', name: '', voters: [], createdAt: Timestamp.now(), hidden: false, answered: false, client: 'x' });
    await setDoc(doc(db, 'polls', 'p1'), { q: LONG.slice(0, 60), options: ['아주 긴 선택지 ' + 'ㄱ'.repeat(40), '짧음', '세 번째'], open: true, show: false, createdAt: Timestamp.now() });
  });
});

for (const width of [320, 375]) {
  test(`${width}px: 모든 화면 가로 넘침 없음 · 터치 영역`, async ({ browser }) => {
    const { page, context } = await newDevice(browser, { ...PHONE, viewport: { width, height: 640 } });
    // 내 테이블 결과 화면도 보기 위해 저장값을 넣어 둔다
    await page.goto('/live/table/');
    await page.evaluate(() => localStorage.setItem('hc_me', JSON.stringify({ no: 39, name: '남궁 민수', gen: '14기', t1: '7', t2: '6' })));
    const res = REPORT[width] = {};
    for (const [name, url] of PAGES) {
      await page.goto(url); await sleep(700);
      const o = await overflow(page);
      const small = await page.evaluate(() => [...document.querySelectorAll('a,button,input,select,textarea,[role=button]')].filter(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width && r.height && cs.visibility !== 'hidden' && (r.width < 44 || r.height < 44); })
        .map(e => { const r = e.getBoundingClientRect(); return { el: e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '') + (e.id ? '#' + e.id : ''), text: (e.textContent || e.value || e.getAttribute('aria-label') || '').trim().slice(0, 20), w: Math.round(r.width), h: Math.round(r.height) }; }));
      res[name] = { overflow: o, under44: small.length, under24: small.filter(s => s.w < 24 || s.h < 24), sample: small.slice(0, 8) };
      expect.soft(o.els, `${width}px ${name} 가로 넘침`).toEqual([]);
      expect.soft(o.sw, `${width}px ${name} 문서 폭`).toBeLessThanOrEqual(o.W);
    }
    // 겹쳐 뜨는 화면: 신원 시트 · 투표 결과 전체 화면 · 추첨 슬롯
    await page.goto('/live/?qa'); await page.locator('#g-poll .opt').first().click();
    await expect(page.locator('#me-f')).toBeVisible(); await sleep(400);
    const sheet = await page.evaluate(() => { const f = document.querySelector('#me-f'), r = f.getBoundingClientRect(); return { right: r.right, W: innerWidth, btns: [...f.querySelectorAll('button,select,input')].map(e => { const b = e.getBoundingClientRect(); return [e.id || e.textContent.trim(), Math.round(b.width), Math.round(b.height), Math.round(b.right)]; }) }; });
    res['신원 시트'] = sheet;
    expect.soft(sheet.right).toBeLessThanOrEqual(sheet.W);
    for (const [, , , r] of sheet.btns) expect.soft(r, '신원 시트 요소 넘침').toBeLessThanOrEqual(sheet.W);
    await page.click('#me-x');
    await seed(db => setDoc(doc(db, 'polls', 'p1'), { show: true }, { merge: true }));
    await expect(page.locator('#fv')).toBeVisible();
    res['결과 전체 화면'] = await overflow(page);
    expect.soft(res['결과 전체 화면'].els).toEqual([]);
    await seed(db => setDoc(doc(db, 'polls', 'p1'), { show: false }, { merge: true }));
    await seed(db => setDoc(doc(db, 'draw', 'results'), { items: [], live: { rank: 1, label: 'Homecoming 상', prize: '편의점 10,000원', no: '39', name: '남궁 민수아주긴이름테스트', gen: '14기', seq: Date.now(), at: Date.now(), pool: [{ no: '39', name: '남궁 민수아주긴이름테스트', t: 1 }, { no: '1', name: '이지우', t: 2 }] } }));
    await expect(page.locator('.ov.rl')).toBeVisible();
    await sleep(11_500);
    res['추첨 슬롯'] = await overflow(page);
    expect.soft(res['추첨 슬롯'].els).toEqual([]);
    await context.close();
  });
}

test('axe(WCAG 2 A·AA) 위반 수집', async ({ browser }) => {
  test.setTimeout(180_000);
  const { page, context } = await newDevice(browser, PHONE);
  REPORT.axe = {};
  for (const [name, url] of PAGES) {
    await page.goto(url); await sleep(800);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    REPORT.axe[name] = r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, sample: v.nodes.slice(0, 3).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join('')) }));
  }
  await page.goto('/live/'); await page.click('.hk-fab', { force: true }); await sleep(400);
  const r = await new AxeBuilder({ page }).include('.hk-sheet').withTags(['wcag2a', 'wcag2aa']).analyze();
  REPORT.axe['챗봇 창'] = r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length }));
  await context.close();
});

test('키보드: 질문 화면 Tab 순서로 질문 게시까지, 시트·챗봇 창의 포커스와 Esc', async ({ browser }) => {
  const { page, context } = await newDevice(browser, { viewport: { width: 1280, height: 900 } });
  const kb = REPORT.keyboard = {};
  await page.goto('/live/?qa'); await sleep(500);
  // Tab으로 질문 입력칸까지 가서 입력 → 게시 버튼에서 Enter
  let reached = false;
  for (let i = 0; i < 40 && !reached; i++) { await page.keyboard.press('Tab'); reached = await page.evaluate(() => document.activeElement?.id === 'g-text'); }
  kb.tabToTextarea = reached; expect(reached).toBe(true);
  await page.keyboard.type('키보드로 쓴 질문');
  await page.keyboard.press('Tab'); kb.submitFocused = await page.evaluate(() => document.activeElement?.id === 'g-submit');
  await page.keyboard.press('Enter');
  await expect(page.locator('#me-f')).toBeVisible(); await sleep(300);
  kb.sheetAutoFocus = await page.evaluate(() => document.activeElement?.id); // 기수 select에 포커스가 가야 함
  expect(kb.sheetAutoFocus).toBe('me-g');
  await page.keyboard.press('Escape'); await sleep(200);
  kb.sheetEscCloses = await page.locator('#me-f').count() === 0;
  expect(kb.sheetEscCloses, 'Esc로 신원 시트 닫기').toBe(true);
  kb.focusBackAfterSheet = await page.evaluate(() => document.activeElement?.id);
  expect(kb.focusBackAfterSheet, '시트를 닫으면 포커스가 원래 버튼으로').toBe('g-submit');
  // 포커스 표시: 버튼에 포커스했을 때 외곽선이 보이는지
  await page.focus('#g-text');
  kb.focusRingOnTextarea = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement); return { outline: cs.outlineStyle, border: cs.borderColor }; });
  // 챗봇: 버튼 Enter로 열기 → 포커스가 창 안으로? Esc로 닫히나?
  await page.goto('/live/'); await page.focus('.hk-fab'); await page.keyboard.press('Enter'); await sleep(300);
  kb.chatOpened = await page.locator('.hk-sheet').count() === 1;
  kb.chatFocusInside = await page.evaluate(() => !!document.activeElement?.closest('.hk-sheet'));
  await page.keyboard.press('Escape'); await sleep(200);
  kb.chatEscCloses = await page.locator('.hk-sheet').count() === 0;
  expect(kb.chatFocusInside, '챗봇 창을 열면 포커스가 창 안으로').toBe(true);
  expect(kb.chatEscCloses, 'Esc로 챗봇 창 닫기').toBe(true);
  expect(await page.evaluate(() => document.activeElement?.classList.contains('hk-fab')), '닫으면 곰돌이 버튼으로 포커스 복귀').toBe(true);
  await context.close();
});

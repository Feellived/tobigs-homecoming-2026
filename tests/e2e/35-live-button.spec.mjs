// 초대장 Live 버튼: 날짜에 따라 위치·강조가 바뀐다 (index.html LIVE_MAIN_FROM = 2026-11-15)
import { test, expect } from '@playwright/test';
import { newDevice, overflow, PHONE, sleep } from '../lib/helpers.mjs';

const at = async (browser, iso, width = 375) => {
  const dev = await newDevice(browser, { ...PHONE, viewport: { width, height: 667 } });
  await dev.page.clock.setFixedTime(new Date(iso));
  await dev.page.goto('/');
  return dev;
};
const showSticky = async page => { await page.evaluate(() => scrollTo(0, 1500)); await expect(page.locator('#sticky.show')).toBeVisible(); };

test('신청 기간(11/10): 첫 화면은 참석 신청하기(강조) + Live 미리 보기(보조), 고정 바는 참석 신청하기', async ({ browser }) => {
  const { page, context } = await at(browser, '2026-11-10T10:00:00+09:00');
  const btns = page.locator('#hero-cta > a.btn');
  await expect(btns.nth(0)).toHaveText('참석 신청하기');
  await expect(btns.nth(0)).toHaveClass(/btn-gold/);
  await expect(btns.nth(1)).toHaveText('Live 미리 보기');
  await expect(btns.nth(1)).toHaveClass(/btn-ghost/);
  await expect(btns.nth(1)).toHaveAttribute('href', 'live/');
  await showSticky(page);
  await expect(page.locator('#sticky .js-rsvp')).toHaveText('참석 신청하기');
  await btns.nth(1).click();
  await expect(page).toHaveURL(/\/live\/$/);
  await context.close();
});

for (const [label, iso] of [['추가 접수 마감 다음날(11/15)', '2026-11-15T09:00:00+09:00'], ['행사 당일(11/21)', '2026-11-21T12:00:00+09:00']]) {
  test(`${label}: 첫 화면 · 고정 바의 주 버튼이 Live 입장하기`, async ({ browser }) => {
    for (const width of [320, 375]) {
      const { page, context } = await at(browser, iso, width);
      const first = page.locator('#hero-cta > a.btn').first();
      await expect(first).toHaveText('Live 입장하기');
      await expect(first).toHaveClass(/btn-gold/);
      await expect(page.locator('#hero-cta')).not.toContainText('참석 신청하기');
      await showSticky(page);
      const st = page.locator('#sticky .js-rsvp');
      await expect(st).toHaveText('Live 입장하기');
      await expect(st).toHaveAttribute('href', 'live/');
      expect(await st.getAttribute('target')).toBeNull();               // 같은 창에서 열림
      const fab = await page.locator('.hk-fab').boundingBox(), sb = await page.locator('#sticky').boundingBox();
      expect(fab.y + fab.height <= sb.y + 1, '곰돌이 버튼이 고정 바 위').toBe(true);
      expect((await overflow(page)).els, `${width}px 넘침`).toEqual([]);
      await st.click();
      await expect(page).toHaveURL(/\/live\/$/);
      await context.close();
    }
  });
}

test('행사 다음날(11/22): Live 버튼 없음(설문 · 사진 안내로 바뀜)', async ({ browser }) => {
  const { page, context } = await at(browser, '2026-11-22T10:00:00+09:00');
  await sleep(300);
  await expect(page.locator('.js-live')).toHaveCount(0);
  await context.close();
});

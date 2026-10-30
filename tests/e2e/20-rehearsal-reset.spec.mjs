// 리허설 → 초기화 → 운영 노트북 새로고침(또는 다른 노트북) → 본 추첨.
// 리허설 때부터 열어 둔 프로젝터 · 휴대폰에도 슬롯 연출이 떠야 한다.
import { test, expect } from '@playwright/test';
import { newDevice, resetEmulators, adminLogin, adminTab, uploadRoster, PHONE, LAPTOP, PROJECTOR, sleep } from '../lib/helpers.mjs';

test('리허설 추첨 후 초기화하고 운영 화면을 새로 열어도, 열려 있던 프로젝터·휴대폰에 본 추첨 연출이 뜬다', async ({ browser }) => {
  test.setTimeout(120_000);
  await resetEmulators();
  const admin = await newDevice(browser, LAPTOP), proj = await newDevice(browser, PROJECTOR), ph = await newDevice(browser, PHONE);
  await adminLogin(admin.page); await uploadRoster(admin.page);
  await adminLogin(proj.page);
  for (const n of [1, 2, 3, 4, 5]) { await adminTab(admin.page, 'ci'); await admin.page.locator(`#a-cl input[data-no="${n}"]`).check(); await expect(admin.page.locator('#a-cc')).toContainText(`체크인 ${n} /`); }
  await adminTab(admin.page, 'prog'); await admin.page.click('#a-steps button[data-i="10"]');
  await proj.page.goto('/live/?screen'); await ph.page.goto('/live/');
  await expect(proj.page.locator('#s-body h3')).toHaveText('Lucky Draw');

  // 리허설: 3번 추첨
  await adminTab(admin.page, 'draw'); await admin.page.click('#a-build');
  for (const r of [1, 2, 3]) { await admin.page.click(`#a-btns button[data-r="${r}"]`); await sleep(300); }
  await expect(proj.page.locator('#s-w .win')).toHaveCount(3);
  await expect(ph.page.locator('.ov.rl').first()).toBeVisible();
  await sleep(12_000); // 연출 끝날 때까지
  // 초기화 → 운영 화면 새로고침
  await admin.page.click('#a-reset');
  await expect(proj.page.locator('#s-w')).toContainText('Homecoming 상부터');
  await admin.page.reload(); await expect(admin.page.locator('#a-tabs')).toBeVisible();
  await adminTab(admin.page, 'draw'); await admin.page.click('#a-build');
  await expect(proj.page.locator('.ov.rl')).toHaveCount(0);
  await expect(ph.page.locator('.ov.rl')).toHaveCount(0);

  // 본 추첨 첫 번째
  await admin.page.click('#a-btns button[data-r="1"]');
  await expect(proj.page.locator('#s-w .win')).toHaveCount(1);
  await expect(proj.page.locator('.ov.rl'), '프로젝터 연출').toBeVisible({ timeout: 8_000 });
  await expect(ph.page.locator('.ov.rl'), '휴대폰 연출').toBeVisible({ timeout: 8_000 });
  for (const x of [admin, proj, ph]) await x.context.close();
});

import { test, expect } from '@playwright/test';
import { newDevice, resetEmulators, adminLogin } from '../lib/helpers.mjs';
test.beforeAll(resetEmulators);
test('스모크: 허브·관리 로그인이 에뮬레이터로 동작하고 외부(프로덕션) 요청은 0건', async ({ browser }) => {
  const a = await newDevice(browser);
  await a.page.goto('/live/');
  await expect(a.page.locator('#e-qa')).toBeVisible();
  const adm = await newDevice(browser, { viewport: { width: 1280, height: 800 } });
  await adminLogin(adm.page);
  await adm.page.click('#a-steps button[data-i="0"]');
  await expect(a.page.locator('#h-now-step')).toHaveText('입장 · 체크인');
  const ext = [...a.context.__external, ...adm.context.__external];
  expect(ext.filter(u => /googleapis\.com\/(google\.firestore|identitytoolkit|v1\/projects)|firestore\.googleapis|securetoken/.test(u))).toEqual([]);
  console.log('차단된 외부 요청:', [...new Set(ext.map(u => new URL(u).host))]);
  expect(a.page.__errors).toEqual([]);
});

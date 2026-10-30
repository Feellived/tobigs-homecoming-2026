// 실행: npm test  (firebase emulators:exec 가 Firestore·Auth 에뮬레이터를 띄운 뒤 Playwright 실행)
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: '.',
  testMatch: ['e2e/**/*.spec.mjs', 'rules/**/*.spec.mjs'],
  workers: 1,               // 에뮬레이터 DB 하나를 공유하므로 직렬
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/results.json' }]],
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node lib/serve.mjs', url: 'http://127.0.0.1:4173/live/', reuseExistingServer: true },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});

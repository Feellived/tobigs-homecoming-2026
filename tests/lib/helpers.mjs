import { expect } from '@playwright/test';
export const PROJECT = 'demo-hoco';
export const FS = 'http://127.0.0.1:8080';
export const AUTH = 'http://127.0.0.1:9099';
export const ADMIN_EMAIL = 'tobigs2026hoco@gmail.com';
export const ADMIN_PW = 'test-only-password';
export const PHONE = { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
export const LAPTOP = { viewport: { width: 1280, height: 800 } };
export const PROJECTOR = { viewport: { width: 1920, height: 1080 } };

// 에뮬레이터 초기화
export async function resetEmulators() {
  await fetch(`${FS}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`, { method: 'DELETE' });
  await fetch(`${AUTH}/emulator/v1/projects/${PROJECT}/accounts`, { method: 'DELETE' });
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PW, returnSecureToken: true }) });
  if (!r.ok) throw new Error('admin signUp failed ' + await r.text());
}

// 프로덕션 차단 + 외부 요청 처리. 로컬(127.0.0.1)만 허용, 챗봇 서버는 가짜 응답
export async function guard(context, { chat } = {}) {
  context.__external = [];
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, async route => {
    const u = route.request().url();
    if (u.startsWith('https://hoco-assistant.vercel.app/api/chat')) {
      const body = JSON.parse(route.request().postData() || '{}');
      context.__chat = (context.__chat || []).concat([body]);
      const reply = chat ? await chat(body) : { answer: '올림픽회관 B1 KSPO 연수원 대강당입니다.', links: ['map_kakao', 'nope'] };
      return route.fulfill({ status: reply.status || 200, contentType: 'application/json', body: JSON.stringify(reply) });
    }
    context.__external.push(u);
    return route.abort(); // 폰트·지도 등 외부 리소스 포함 전부 차단 (Firestore 프로덕션 접속 불가 보장)
  });
}

export async function newDevice(browser, kind = PHONE, opts = {}) {
  const context = await browser.newContext({ ...kind, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  await guard(context, opts);
  const page = await context.newPage();
  page.__errors = [];
  page.on('pageerror', e => page.__errors.push(String(e.message || e)));
  page.on('dialog', d => d.accept());
  return { context, page };
}

export async function adminLogin(page) {
  await page.goto('/live/?admin');
  await page.fill('#a-pw', ADMIN_PW);
  await page.click('#a-login button[type=submit]');
  await expect(page.locator('#a-tabs')).toBeVisible();
}
export const adminTab = (page, t) => page.click(`#a-tabs button[data-t="${t}"]`);

// 첫 참여 정보 입력 시트
export async function fillIdentity(page, gen, name, { confirmUnlisted = false } = {}) {
  const sheet = page.locator('#me-f');
  await expect(sheet).toBeVisible();
  await page.selectOption('#me-g', gen);
  await page.fill('#me-n', name);
  await sheet.locator('button[type=submit]').click();
  if (confirmUnlisted) { await expect(page.locator('#me-e')).toContainText('명단에서 찾지 못했어요'); await sheet.locator('button[type=submit]').click(); }
  await expect(sheet).toBeHidden();
}

// 가로 넘침 검사: 문서 폭 > 화면 폭 이면 넘친 요소 목록 반환
export async function overflow(page) {
  return page.evaluate(() => {
    const W = document.documentElement.clientWidth, out = [];
    if (document.documentElement.scrollWidth <= W) return { W, sw: document.documentElement.scrollWidth, els: [] };
    const clipped = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).overflowX !== 'visible') return true; return false; };
    for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width && r.right > W + 1 && getComputedStyle(el).position !== 'fixed' && !clipped(el)) out.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + [...el.classList].join('.')) + ` right=${Math.round(r.right)}`); }
    return { W, sw: document.documentElement.scrollWidth, els: out.slice(0, 10) };
  });
}
export const sleep = ms => new Promise(r => setTimeout(r, ms));

// 규칙을 우회해 에뮬레이터에 데이터 넣기(테스트 준비용)
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
let _env;
export async function seed(fn) {
  _env ||= await initializeTestEnvironment({ projectId: PROJECT, firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(new URL('../../live/firestore.rules', import.meta.url), 'utf8') } });
  await _env.withSecurityRulesDisabled(ctx => fn(ctx.firestore()));
}

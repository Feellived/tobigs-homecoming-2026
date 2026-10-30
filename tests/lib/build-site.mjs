// 테스트용 사이트 사본(tests/.site)을 만든다. 저장소 원본 파일은 건드리지 않는다.
// 1) 정적 파일 복사  2) Firebase SDK를 로컬 shim으로 교체. 명단은 테스트에서 운영 화면 '명단' 탭으로 올린다(lib/helpers.mjs uploadRoster)
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TESTS = join(HERE, '..');
const REPO = join(TESTS, '..');
export const SITE = join(TESTS, '.site');
export const PROJECT = 'demo-hoco'; // demo- 접두사: 에뮬레이터 전용, 실제 프로젝트에 절대 연결되지 않음
const CDN = 'https://www.gstatic.com/firebasejs/11.6.0/';

export function buildSite() {
  rmSync(SITE, { recursive: true, force: true });
  mkdirSync(SITE, { recursive: true });
  for (const f of ['index.html', 'CNAME']) cpSync(join(REPO, f), join(SITE, f));
  for (const d of ['assets', 'live', 'people', 'tools']) cpSync(join(REPO, d), join(SITE, d), { recursive: true });

  // HTML의 gstatic import → /__fb/ shim
  const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
  for (const p of walk(SITE).filter(p => p.endsWith('.html'))) {
    const s = readFileSync(p, 'utf8');
    if (s.includes(CDN)) writeFileSync(p, s.split(CDN).join('/__fb/'));
  }

  // 실제 SDK(node_modules/firebase의 CDN 빌드)를 /__fb/real/ 에, shim을 /__fb/ 에
  const FB = join(TESTS, 'node_modules', 'firebase');
  mkdirSync(join(SITE, '__fb', 'real'), { recursive: true });
  for (const m of ['firebase-app.js', 'firebase-firestore.js', 'firebase-auth.js']) {
    writeFileSync(join(SITE, '__fb', 'real', m), readFileSync(join(FB, m), 'utf8').split(CDN).join('/__fb/real/'));
  }
  writeFileSync(join(SITE, '__fb', 'firebase-app.js'), `export * from '/__fb/real/firebase-app.js';
import { initializeApp as init } from '/__fb/real/firebase-app.js';
export function initializeApp(cfg = {}, ...rest) {
  // 프로덕션 설정(tobigshoco)을 데모 프로젝트로 바꾼다
  return init({ ...cfg, apiKey: 'demo-key', projectId: '${PROJECT}', authDomain: '${PROJECT}.firebaseapp.com' }, ...rest);
}
`);
  writeFileSync(join(SITE, '__fb', 'firebase-firestore.js'), `export * from '/__fb/real/firebase-firestore.js';
import { getFirestore as g, connectFirestoreEmulator } from '/__fb/real/firebase-firestore.js';
const done = new WeakSet();
export function getFirestore(...a) { const db = g(...a); if (!done.has(db)) { connectFirestoreEmulator(db, '127.0.0.1', 8080); done.add(db); } return db; }
`);
  writeFileSync(join(SITE, '__fb', 'firebase-auth.js'), `export * from '/__fb/real/firebase-auth.js';
import { getAuth as g, connectAuthEmulator } from '/__fb/real/firebase-auth.js';
const done = new WeakSet();
export function getAuth(...a) { const au = g(...a); if (!done.has(au)) { connectAuthEmulator(au, 'http://127.0.0.1:9099', { disableWarnings: true }); done.add(au); } return au; }
`);
  return SITE;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) { buildSite(); console.log('built', SITE); }

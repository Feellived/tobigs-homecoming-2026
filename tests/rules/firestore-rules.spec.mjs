// Firestore 보안 규칙 테스트 (live/firestore.rules, 에뮬레이터 전용)
// test.fail(...) = 알려진 취약점. 본문은 "안전해야 할 동작"을 검사하므로 지금은 실패가 정상이고, 규칙을 고치면 통과로 바뀌어 표시가 사라져야 한다.
import { test, expect } from '@playwright/test';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, serverTimestamp, arrayUnion, arrayRemove, Timestamp } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const RULES = readFileSync(new URL('../../live/firestore.rules', import.meta.url), 'utf8');
const ADMIN = { email: 'tobigs2026hoco@gmail.com', email_verified: true };
// live/index.html pidOf()와 같은 계산: 기수+이름만 알면 누구나 만들 수 있다
const pidOf = (gen, name) => 'p' + createHash('sha256').update('tobigs-hoco-2026|' + gen + '|' + name.replace(/\s+/g, '').toLowerCase()).digest('hex').slice(0, 32);
const QID = 'AAAAAAAAAAAAAAAAAAAA', QID2 = 'BBBBBBBBBBBBBBBBBBBB';
const goodQ = (o = {}) => ({ gen: '25기', text: '질문', name: '', voters: [], createdAt: serverTimestamp(), hidden: false, answered: false, client: 'device-1', ...o });

let env;
test.beforeAll(async () => { env = await initializeTestEnvironment({ projectId: 'demo-rules', firestore: { rules: RULES, host: '127.0.0.1', port: 8080 } }); });
test.afterAll(async () => { await env?.cleanup(); });
test.beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'polls', 'open1'), { q: '열린 투표', options: ['a', 'b'], open: true, show: false, createdAt: Timestamp.now() });
    await setDoc(doc(db, 'polls', 'closed1'), { q: '닫힌 투표', options: ['a', 'b'], open: false, show: false, createdAt: Timestamp.now() });
    await setDoc(doc(db, 'questions', QID2), { ...goodQ(), createdAt: Timestamp.now(), voters: [pidOf('3기', '박건우'), pidOf('4기', '최서연')] });
    await setDoc(doc(db, 'polls', 'open1', 'votes', pidOf('2기', '이지우')), { option: 1, at: Timestamp.now() });
  });
});
const anon = () => env.unauthenticatedContext().firestore();
const admin = () => env.authenticatedContext('admin-uid', ADMIN).firestore();
const vote = (db, poll, id, option = 0) => setDoc(doc(db, 'polls', poll, 'votes', id), { option, at: serverTimestamp() });

test.describe('질문', () => {
  test('정상 질문 생성은 허용', async () => { await assertSucceeds(setDoc(doc(anon(), 'questions', QID), goodQ())); });
  test('숨김·답변 완료·추천 수를 미리 채운 질문, 200자 초과, 허용 외 필드는 거부', async () => {
    const db = anon();
    await assertFails(setDoc(doc(db, 'questions', QID), goodQ({ hidden: true })));
    await assertFails(setDoc(doc(db, 'questions', QID), goodQ({ answered: true })));
    await assertFails(setDoc(doc(db, 'questions', QID), goodQ({ voters: ['x'] })));
    await assertFails(setDoc(doc(db, 'questions', QID), goodQ({ text: 'x'.repeat(201) })));
    await assertFails(setDoc(doc(db, 'questions', QID), goodQ({ admin: true })));
    await assertFails(setDoc(doc(db, 'questions', 'short'), goodQ()));
  });
  test('참가자는 질문 내용 수정·숨김·삭제 불가', async () => {
    const db = anon();
    await assertFails(updateDoc(doc(db, 'questions', QID2), { text: '바뀜' }));
    await assertFails(updateDoc(doc(db, 'questions', QID2), { hidden: true }));
    await assertFails(updateDoc(doc(db, 'questions', QID2), { answered: true }));
    await assertFails(deleteDoc(doc(db, 'questions', QID2)));
  });
  test('본인 추천 추가·취소(한 번에 ±1)는 허용', async () => {
    const db = anon();
    await assertSucceeds(updateDoc(doc(db, 'questions', QID2), { voters: arrayUnion(pidOf('2기', '이지우')) }));
    await assertSucceeds(updateDoc(doc(db, 'questions', QID2), { voters: arrayRemove(pidOf('2기', '이지우')) }));
  });
  test('남의 추천을 지우고 그 자리에 다른 값 넣기(배열 통째 교체, 크기만 +1)는 거부', async () => {
    await assertFails(updateDoc(doc(anon(), 'questions', QID2), { voters: ['fake1', 'fake2', 'fake3'] }));
  });
  test.fail('[취약·남음] 기수+이름으로 남의 pid를 계산해 그 사람 추천을 취소', async () => {
    await assertFails(updateDoc(doc(anon(), 'questions', QID2), { voters: arrayRemove(pidOf('3기', '박건우')) }));
  });
  test('pid 형식이 아닌 값·중복 값으로 추천 수 부풀리기는 거부', async () => {
    const db = anon();
    await assertFails(updateDoc(doc(db, 'questions', QID2), { voters: arrayUnion('bot1') }));
    const cur = (await getDoc(doc(db, 'questions', QID2))).data().voters;
    await assertFails(updateDoc(doc(db, 'questions', QID2), { voters: [...cur, cur[0]] }));
  });
  test.fail('[취약·남음] pid 형식의 가짜 값(아무 16진수)으로 추천 수 부풀리기: 로그인 없이 사람을 구분할 수 없어 규칙만으론 못 막음', async () => {
    const db = anon();
    for (let i = 0; i < 5; i++) await updateDoc(doc(db, 'questions', QID2), { voters: arrayUnion(pidOf('봇', 'bot' + i)) }).catch(() => {});
    const s = await getDoc(doc(db, 'questions', QID2));
    expect(s.data().voters.length).toBe(2);
  });
});

test.describe('투표', () => {
  test('열린 투표에 1표, 같은 id로 다시 투표(수정)·삭제는 거부', async () => {
    const db = anon(), me = pidOf('3기', '박건우');
    await assertSucceeds(vote(db, 'open1', me, 0));
    await assertFails(vote(db, 'open1', me, 1));
    await assertFails(deleteDoc(doc(db, 'polls', 'open1', 'votes', me)));
  });
  test('선택지 범위 밖·추가 필드·시간 위조는 거부', async () => {
    const db = anon();
    await assertFails(vote(db, 'open1', 'p' + 'a'.repeat(32), 10));
    await assertFails(vote(db, 'open1', 'p' + 'a'.repeat(32), -1));
    await assertFails(setDoc(doc(db, 'polls', 'open1', 'votes', 'p' + 'a'.repeat(32)), { option: 0, at: Timestamp.fromMillis(0) }));
    await assertFails(setDoc(doc(db, 'polls', 'open1', 'votes', 'p' + 'a'.repeat(32)), { option: 0, at: serverTimestamp(), w: 9 }));
  });
  test('참가자는 투표 만들기·열기·결과 공개 불가', async () => {
    const db = anon();
    await assertFails(updateDoc(doc(db, 'polls', 'closed1'), { open: true }));
    await assertFails(updateDoc(doc(db, 'polls', 'open1'), { show: true }));
    await assertFails(setDoc(doc(db, 'polls', 'mine'), { q: 'x', options: ['a'], open: true, show: true }));
  });
  test.fail('[취약·남음] 한 기기에서 아무 id로 여러 표 넣기(표 몰아주기)', async () => {
    const db = anon();
    let ok = 0;
    for (let i = 0; i < 5; i++) await vote(db, 'open1', 'stuffing-' + i, 0).then(() => ok++, () => {});
    expect(ok).toBeLessThanOrEqual(1);
  });
  test.fail('[취약·남음] 명단의 기수+이름으로 남의 pid를 만들어 먼저 투표(본인은 "이미 투표하셨어요")', async () => {
    await assertFails(vote(anon(), 'open1', pidOf('4기', '최서연'), 0));
  });
  test('닫힌 투표·없는 투표·선택지 수를 넘는 번호에는 표를 넣을 수 없음', async () => {
    await assertFails(vote(anon(), 'closed1', 'p' + 'b'.repeat(32), 0));
    await assertFails(vote(anon(), 'nope', 'p' + 'b'.repeat(32), 0));
    await assertFails(vote(anon(), 'open1', 'p' + 'b'.repeat(32), 2)); // 선택지 2개(0·1)
  });
  test.fail('[취약·남음] 표 전체 목록과 각 표의 주인(pid) 읽기 → 이름으로 누가 무엇을 골랐는지 역추적', async () => {
    const s = await getDocs(collection(anon(), 'polls', 'open1', 'votes')).catch(() => null);
    expect(s?.docs.find(d => d.id === pidOf('2기', '이지우'))).toBeFalsy();
  });
});

test.describe('운영진 전용', () => {
  test('참가자는 진행·체크인·추첨·보너스 쓰기 불가', async () => {
    const db = anon();
    await assertFails(setDoc(doc(db, 'state', 'program'), { step: 10 }));
    await assertFails(setDoc(doc(db, 'state', 'bonus'), { quiz: ['1'], photo: [] }));
    await assertFails(setDoc(doc(db, 'checkins', '1'), { no: 1 }));
    await assertFails(setDoc(doc(db, 'draw', 'results'), { items: [{ rank: 7, name: '나' }] }));
  });
  test('다른 이메일로 로그인한 계정도 운영 쓰기 불가', async () => {
    const db = env.authenticatedContext('u2', { email: 'someone@gmail.com', email_verified: true }).firestore();
    await assertFails(setDoc(doc(db, 'state', 'program'), { step: 10 }));
    await assertFails(setDoc(doc(db, 'draw', 'results'), { items: [] }));
  });
  test('운영 계정은 진행·체크인·추첨·투표·질문 관리 가능', async () => {
    const db = admin();
    await assertSucceeds(setDoc(doc(db, 'state', 'program'), { step: 0, endsAt: null }));
    await assertSucceeds(setDoc(doc(db, 'checkins', '1'), { no: 1, name: 'x', gen: '1기', at: serverTimestamp() }));
    await assertSucceeds(setDoc(doc(db, 'draw', 'results'), { items: [], live: null }));
    await assertSucceeds(updateDoc(doc(db, 'polls', 'open1'), { show: true }));
    await assertSucceeds(updateDoc(doc(db, 'questions', QID2), { hidden: true }));
    await assertSucceeds(deleteDoc(doc(db, 'polls', 'open1', 'votes', pidOf('2기', '이지우'))));
  });
  test.fail('[권장] 이메일 인증이 안 된 토큰은 운영 권한이 없어야 함', async () => {
    const db = env.authenticatedContext('u3', { email: ADMIN.email, email_verified: false }).firestore();
    await assertFails(setDoc(doc(db, 'state', 'program'), { step: 10 }));
  });
  test('명단: 참가자는 자기 칸 하나만 읽기(get), 전체 목록·쓰기 불가. 체크인 기록은 운영 계정만 읽기', async () => {
    await env.withSecurityRulesDisabled(async ctx => { await setDoc(doc(ctx.firestore(), 'roster', 'rabc'), { rows: [{ no: 1, name: '이지우', gen: '2기', t1: '1', t2: '4' }] }); await setDoc(doc(ctx.firestore(), 'checkins', '1'), { no: 1, name: '이지우' }); });
    const db = anon();
    await assertSucceeds(getDoc(doc(db, 'roster', 'rabc')));
    await assertFails(getDocs(collection(db, 'roster')));
    await assertFails(setDoc(doc(db, 'roster', 'rxyz'), { rows: [] }));
    await assertFails(getDoc(doc(db, 'checkins', '1')));
    await assertFails(getDocs(collection(db, 'checkins')));
    await assertFails(setDoc(doc(db, 'state', 'people'), { rows: [] }));
    await assertSucceeds(getDoc(doc(db, 'state', 'people')));          // 카드 공개 동의자 목록은 공개
    await assertSucceeds(getDocs(collection(admin(), 'roster')));
    await assertSucceeds(getDocs(collection(admin(), 'checkins')));
  });
  test('규칙에 없는 컬렉션은 읽기·쓰기 모두 거부', async () => {
    await assertFails(setDoc(doc(anon(), 'secrets', 'x'), { a: 1 }));
    await assertFails(getDoc(doc(anon(), 'secrets', 'x')));
  });
});

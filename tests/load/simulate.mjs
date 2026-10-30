// 150명 동시 접속 부하 시뮬레이션 (에뮬레이터 전용). 휴대폰마다 라이브 질문 화면과 같은 리스너를 열고,
// 질문 · 추천 · 투표 · 결과 공개 · 추첨을 진행하면서 리스너가 받은 문서 수(= Firestore 과금 읽기 수)를 센다.
// 실행: (tests/) npm run emulators 를 켠 상태에서  node load/simulate.mjs [사람수=150]
//   MODE=current   현재 코드처럼 결과 공개 때 휴대폰이 votes 하위 컬렉션 전체를 구독
//   MODE=counts    결과 공개 때 투표 문서의 counts 필드만 읽음(운영 화면이 집계해 기록)
import { initializeApp, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, collection, onSnapshot, setDoc, updateDoc, getDoc, arrayUnion, serverTimestamp, Timestamp, terminate } from 'firebase/firestore';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const N = Number(process.argv[2] || 150), MODE = process.env.MODE || 'current';
const PROJECT = 'demo-load';
const QUESTIONS = 60, UPVOTES_PER_PERSON = 5, POLLS = 3, DRAWS = 8, STEPS = 13;
const pidOf = i => 'p' + createHash('sha256').update('load|' + i).digest('hex').slice(0, 32);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(new URL('../../live/firestore.rules', import.meta.url), 'utf8') } });
await env.clearFirestore();
const admin = fn => env.withSecurityRulesDisabled(ctx => fn(ctx.firestore()));

let reads = 0, errors = 0;
const phones = [];
for (let i = 0; i < N; i++) {
  const app = initializeApp({ projectId: PROJECT, apiKey: 'x' }, 'phone' + i);
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const ph = { i, db, app, pid: pidOf(i), unsub: [], votesUnsub: null, shown: null, counts: null };
  const docSnap = () => { reads++; };
  const colSnap = s => { reads += s.docChanges().length || (s.empty ? 1 : 0); };   // 빈 결과도 최소 1읽기
  ph.unsub.push(onSnapshot(doc(db, 'state', 'program'), docSnap));
  ph.unsub.push(onSnapshot(collection(db, 'questions'), colSnap));
  ph.unsub.push(onSnapshot(collection(db, 'draw'), colSnap));
  ph.unsub.push(onSnapshot(collection(db, 'polls'), s => {
    colSnap(s);
    const p = s.docs.map(d => ({ id: d.id, ...d.data() })).find(x => x.show);
    if ((p?.id || null) !== ph.shown) {
      ph.votesUnsub?.(); ph.votesUnsub = null; ph.shown = p?.id || null;
      if (p && MODE === 'current') ph.votesUnsub = onSnapshot(collection(db, 'polls', p.id, 'votes'), v => { colSnap(v); ph.counts = v.size; });
      if (p && MODE === 'counts') { ph.counts = p.total; getDoc(doc(db, 'polls', p.id, 'votes', ph.pid)).then(() => reads++, () => reads++); }
    } else if (p && MODE === 'counts') ph.counts = p.total;
  }));
  phones.push(ph);
}
const settle = async () => { await sleep(1500); };
await settle();
const phase = {}; let last = 0;
const mark = name => { phase[name] = reads - last; last = reads; };
mark('접속(초기 구독)');

// 진행 단계 13번
for (let s = 0; s < STEPS; s++) await admin(db => setDoc(doc(db, 'state', 'program'), { step: s, endsAt: null }));
await settle(); mark('진행 단계 13번');

// 질문 60개 (참가자 쓰기)
const t0 = Date.now();
await Promise.all(Array.from({ length: QUESTIONS }, (_, k) => {
  const ph = phones[k % N], id = ('Q' + k).padEnd(20, 'x').replace(/[^A-Za-z0-9]/g, 'x');
  return setDoc(doc(ph.db, 'questions', id), { gen: '25기', text: '질문 ' + k, name: '', voters: [], createdAt: serverTimestamp(), hidden: false, answered: false, client: 'c' + k }).catch(() => errors++);
}));
await settle(); mark(`질문 ${QUESTIONS}개`);

// 추천: 사람마다 5번, 인기 질문(0번)에 몰림 → 같은 문서 동시 쓰기
const qid = k => ('Q' + k).padEnd(20, 'x').replace(/[^A-Za-z0-9]/g, 'x');
let upOk = 0;
await Promise.all(phones.flatMap(ph => Array.from({ length: UPVOTES_PER_PERSON }, (_, j) => {
  const k = j === 0 ? 0 : 1 + ((ph.i + j * 11) % (QUESTIONS - 1)); // 0번(인기 질문) + 서로 다른 4개
  return updateDoc(doc(ph.db, 'questions', qid(k)), { voters: arrayUnion(ph.pid) }).then(() => upOk++, () => errors++);
})));
await settle(); mark(`추천 ${N * UPVOTES_PER_PERSON}번`);
const hot = (await admin(async db => (await getDoc(doc(db, 'questions', qid(0)))).data()))?.voters?.length;

// 투표 3번: 열기 → 전원 투표 → 닫기 → 결과 공개 → 내리기
for (let k = 0; k < POLLS; k++) {
  const pid = 'poll' + k;
  await admin(db => setDoc(doc(db, 'polls', pid), { q: 'Q' + k, options: ['a', 'b', 'c'], open: true, show: false, createdAt: Timestamp.now() }));
  await settle();
  await Promise.all(phones.map(ph => setDoc(doc(ph.db, 'polls', pid, 'votes', ph.pid), { option: ph.i % 3, at: serverTimestamp() }).catch(() => errors++)));
  const c = [0, 0, 0]; phones.forEach(ph => c[ph.i % 3]++);
  await admin(db => updateDoc(doc(db, 'polls', pid), { open: false, show: true, counts: c, total: N }));
  await sleep(3000);
  await admin(db => updateDoc(doc(db, 'polls', pid), { show: false }));
  await settle();
}
mark(`투표 ${POLLS}번(결과 공개 포함)`);
const sawAll = phones.filter(ph => ph.counts === N).length;

// 추첨 8번 (draw/results 문서에 응모자 목록 포함)
const pool = Array.from({ length: N }, (_, i) => ({ no: String(i + 1), name: '참가자' + i, t: 1 }));
for (let k = 0; k < DRAWS; k++) await admin(db => setDoc(doc(db, 'draw', 'results'), { items: [], live: { rank: k + 1, no: '1', name: 'x', seq: k + 1, at: Date.now(), pool } }));
await settle(); mark(`추첨 ${DRAWS}번`);

const total = reads;
console.log(JSON.stringify({ mode: MODE, people: N, phases: phase, total, errors, upvotesOk: upOk, hotQuestionVoters: hot, phonesSawAllVotes: sawAll, ms: Date.now() - t0 }, null, 1));
for (const ph of phones) { ph.unsub.forEach(u => u()); ph.votesUnsub?.(); await terminate(ph.db); await deleteApp(ph.app); }
await env.cleanup();
process.exit(0);

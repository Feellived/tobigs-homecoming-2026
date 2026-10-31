// 행사 도우미(ASK HOCO) 공용 위젯: 초대장 · 라이브 · 내 테이블 · 참가자 카드 모든 화면에 곰돌이 버튼을 띄운다.
// 질문은 중계 서버(Vercel)로만 보낸다. API 키는 서버에만 있다. 링크는 서버가 고른 이름을 아래 허용 목록 주소로만 바꾼다(모델이 주소를 만들 수 없음).
(() => {
  const ASK_URL = 'https://hoco-assistant.vercel.app/api/chat';
  const ASK_LINKS = {
    map_kakao: ['카카오맵에서 보기', 'https://map.kakao.com/?q=%EC%98%AC%EB%A6%BC%ED%94%BD%ED%9A%8C%EA%B4%80'],
    map_naver: ['네이버 지도에서 보기', 'https://map.naver.com/p/search/%EC%98%AC%EB%A6%BC%ED%94%BD%ED%9A%8C%EA%B4%80'],
    calendar: ['구글 캘린더에 추가', 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=TOBIG%27S%20Homecoming%20Day%202026&dates=20261121T033000Z/20261121T073500Z&ctz=Asia/Seoul&location=KSPO%20%EC%97%B0%EC%88%98%EC%9B%90%20%EB%8C%80%EA%B0%95%EB%8B%B9%20(%EC%84%9C%EC%9A%B8%20%EC%86%A1%ED%8C%8C%EA%B5%AC%20%EC%98%AC%EB%A6%BC%ED%94%BD%EB%A1%9C%20424%20%EC%98%AC%EB%A6%BC%ED%94%BD%ED%9A%8C%EA%B4%80%20B1)'],
    rsvp: ['참석 신청 폼', 'https://docs.google.com/forms/d/e/1FAIpQLSdzdNeDuhDAeZp2ic9w6S6oRYSQ-GDEIRNNS56Mx-okHmIuYQ/viewform'],
    openchat: ['운영부 오픈채팅', 'https://open.kakao.com/o/sW8KJKQi'],
    photos: ['회고 사진 올리기', 'https://drive.google.com/drive/folders/1Yodl9eUD0lTIndH7xzSa_Y5JlGECGXi4'],
    home: ['초대장 홈페이지', '/'], program: ['프로그램 보기', '/#program'], faq: ['자주 묻는 질문', '/#faq'],
    conference: ['컨퍼런스 갤러리', 'https://great-wholesaler-9e1.notion.site/TOBIG-s-3cb02c1ed3668286a24d015ba69029fc'],
    live_hub: ['라이브 첫 화면', '/live/'], live_qa: ['질문 · 투표', '/live/?qa'], live_table: ['내 테이블', '/live/table/'], people: ['참가자 카드', '/people/'], live_draw: ['추첨', '/live/?draw'],
  };
  const ASK_SUG = ['오시는 길 알려줘', '주차할 수 있어?', '뒤풀이는 어떻게 해?', '연사님께 질문은 어떻게 올려?', '추첨 응모권은 어떻게 받아?', '늦게 가도 돼?'];
  const BEAR = '/assets/apple-touch-icon.png';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const cid = (() => { try { let v = localStorage.getItem('hc_cid'); if(!v){ v = crypto.randomUUID(); localStorage.setItem('hc_cid', v); } return v; } catch(e){ return 'anon-' + Math.random().toString(36).slice(2); } })();

  const css = `
.hk-fab{position:fixed;right:calc(24px + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));width:64px;height:64px;padding:0;border:0;border-radius:50%;background:#fff;box-shadow:0 8px 22px rgba(3,6,20,.38),0 0 0 2px rgba(157,176,255,.45);z-index:40;cursor:pointer;animation:hk-bob 3.4s ease-in-out infinite;transition:opacity .25s;-webkit-tap-highlight-color:transparent}
.hk-fab img{display:block;width:100%;height:100%;border-radius:50%;object-fit:cover}
.hk-fab.dim{opacity:.28}
body.hk-has-fab{padding-bottom:92px}
@keyframes hk-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@media(prefers-reduced-motion:reduce){.hk-fab{animation:none}}
.hk-bg{position:fixed;inset:0;background:rgba(3,6,20,.6);z-index:1000;display:flex;align-items:flex-end;justify-content:center;animation:hk-fade .2s}
.hk-sheet{position:relative;box-sizing:border-box;width:100%;max-width:560px;max-height:88vh;overflow-y:auto;background:#141c3f;border:1px solid rgba(255,255,255,.12);border-bottom:0;border-radius:20px 20px 0 0;padding:22px 18px calc(24px + env(safe-area-inset-bottom));animation:hk-up .28s cubic-bezier(.2,.8,.2,1)}
@media(min-width:600px){.hk-bg{align-items:center}.hk-sheet{border-radius:20px;border-bottom:1px solid rgba(255,255,255,.12)}}
.hk-x{position:absolute;top:10px;right:12px;width:34px;height:34px;border:0;border-radius:50%;background:rgba(255,255,255,.08);color:#9aa3c7;font-size:20px;line-height:1;cursor:pointer}
.hk{color:#fff;font-family:'Pretendard Variable',Pretendard,-apple-system,system-ui,sans-serif;line-height:1.5;text-align:left}
.hk *{box-sizing:border-box}
.hk [hidden]{display:none!important}
.hk .hk-eb{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:11px;letter-spacing:.18em;color:#9db0ff;margin-bottom:8px}
.hk h2{font-size:18px;margin:0 0 10px;letter-spacing:-.01em;color:#fff}
.hk .hk-m{color:#9aa3c7;font-size:13px;margin:0;word-break:keep-all}
.hk .hk-sug{display:flex;gap:6px;overflow-x:auto;padding:10px 0 4px;scrollbar-width:none}.hk .hk-sug::-webkit-scrollbar{display:none}
.hk .hk-sug button{flex:0 0 auto;border:1px solid rgba(255,255,255,.12);background:transparent;color:#9aa3c7;border-radius:999px;padding:5px 12px;font-size:12px;font-family:inherit;cursor:pointer}
.hk .hk-log{display:flex;flex-direction:column;gap:8px;margin-top:12px;max-height:46vh;overflow-y:auto;padding:2px}
.hk.hk-page .hk-log{max-height:58vh}
.hk .bub{max-width:86%;padding:10px 13px;border-radius:16px;font-size:14px;line-height:1.6;white-space:pre-line;word-break:keep-all;overflow-wrap:anywhere;animation:hk-in .35s cubic-bezier(.2,.8,.2,1)}
.hk .bub.u{align-self:flex-end;background:#3d5afe;border-bottom-right-radius:5px}
.hk .bub.a{align-self:flex-start;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);border-bottom-left-radius:5px}
.hk .bub.e{align-self:center;background:transparent;color:#9aa3c7;font-size:12.5px;border:0;text-align:center}
.hk .lk{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;white-space:normal}
.hk .bub.e + .lk{justify-content:center}
.hk .lk a{font-size:12.5px;padding:6px 11px;border-radius:999px;border:1px solid #9db0ff;color:#9db0ff;text-decoration:none;font-weight:600}
.hk .dots{display:inline-flex;gap:4px;padding:2px 0}.hk .dots i{width:6px;height:6px;border-radius:50%;background:#9db0ff;opacity:.4;animation:hk-dot 1s infinite}.hk .dots i:nth-child(2){animation-delay:.15s}.hk .dots i:nth-child(3){animation-delay:.3s}
.hk form{display:flex;gap:8px;margin-top:10px}
.hk input{flex:1 1 0;min-width:0;width:auto;margin:0;padding:11px 12px;border:1px solid rgba(255,255,255,.12);border-radius:10px;background:rgba(255,255,255,.08);color:#fff;font-size:16px;font-family:inherit;outline:none}
.hk input::placeholder{color:rgba(255,255,255,.4)}.hk input:focus{border-color:#9db0ff}
.hk .hk-go{flex:0 0 auto;border:1px solid #3d5afe;background:#3d5afe;color:#fff;border-radius:10px;padding:11px 14px;font-weight:600;font-size:14px;font-family:inherit;cursor:pointer}
.hk .hk-go:disabled,.hk input:disabled{opacity:.45}
@keyframes hk-fade{from{opacity:0}to{opacity:1}}
@keyframes hk-up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@keyframes hk-in{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes hk-dot{40%{opacity:1;transform:translateY(-3px)}}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // root 안에 도우미 대화 화면을 그린다. 대화는 sessionStorage에 남아 화면 · 페이지를 옮겨도 이어진다.
  function mount(root, page){
    root.innerHTML = `<div class="hk${page ? ' hk-page' : ''}"><div class="hk-eb">ASK HOCO</div><h2>행사 도우미</h2>
      <p class="hk-m">일정 · 오시는 길 · 신청 · 라이브 페이지 사용법을 물어보세요. 답할 수 없는 내용은 운영부 오픈채팅으로 안내해 드려요.</p>
      <div class="hk-sug">${ASK_SUG.map(t => `<button type="button">${esc(t)}</button>`).join('')}</div>
      <div class="hk-log"></div>
      <form><input type="text" maxlength="300" placeholder="궁금한 것을 입력하세요" autocomplete="off" enterkeyhint="send"><button class="hk-go" type="submit">보내기</button></form></div>`;
    const q = s => root.querySelector(s), log = q('.hk-log'), inp = q('input'), go = q('.hk-go'), sug = q('.hk-sug');
    let hist = []; try { hist = JSON.parse(sessionStorage.getItem('hc_ask') || '[]'); } catch(e){}
    let busy = false;
    const save = () => { try { sessionStorage.setItem('hc_ask', JSON.stringify(hist.slice(-30))); } catch(e){} };
    const linkHtml = keys => { const l = (keys || []).filter(k => ASK_LINKS[k]); if(!l.length) return '';
      return `<div class="lk">${l.map(k => { const [label, url] = ASK_LINKS[k], ext = /^https:/.test(url); return `<a href="${esc(url)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(label)}${ext ? ' ↗' : ''}</a>`; }).join('')}</div>`; };
    const draw = typing => {
      log.innerHTML = (hist.length ? '' : '<div class="bub a">안녕하세요! 홈커밍데이 행사 도우미예요. 무엇이든 물어보세요.</div>')
        + hist.map(m => m.role === 'user' ? `<div class="bub u">${esc(m.content)}</div>` : m.role === 'err' ? `<div class="bub e">${esc(m.content)}</div>${linkHtml(m.links)}` : `<div class="bub a">${esc(m.content)}${linkHtml(m.links)}</div>`).join('')
        + (typing ? '<div class="bub a"><span class="dots"><i></i><i></i><i></i></span></div>' : '');
      log.scrollTop = log.scrollHeight; inp.disabled = go.disabled = busy; sug.hidden = hist.length > 0; };
    const send = async text => { text = String(text || '').trim().slice(0, 300); if(!text || busy) return;
      busy = true; hist = hist.filter(m => m.role !== 'err'); hist.push({ role:'user', content:text }); inp.value = ''; draw(true);
      let msgs = hist.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role:m.role, content:String(m.content).slice(0, m.role === 'user' ? 300 : 1500) }));
      while(msgs.length > 11) msgs.shift(); while(msgs.length && msgs[0].role !== 'user') msgs.shift();
      try {
        const r = await fetch(ASK_URL, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ deviceId: cid, messages: msgs }) });
        const d = await r.json().catch(() => ({}));
        if(r.ok && typeof d.answer === 'string') hist.push({ role:'assistant', content:d.answer, links:d.links || [] });
        else { hist.pop(); hist.push({ role:'err', content: d.error === 'busy' ? '지금 질문이 몰려 있어요. 잠시 후 다시 시도해 주세요.' : '답변을 가져오지 못했어요. 잠시 후 다시 시도해 주세요.', links:['openchat'] }); }
      } catch(e){ hist.pop(); hist.push({ role:'err', content:'인터넷 연결을 확인해 주세요.', links:[] }); }
      busy = false; save(); draw(false); };
    q('form').addEventListener('submit', e => { e.preventDefault(); send(inp.value); });
    sug.addEventListener('click', e => { const b = e.target.closest('button'); if(b) send(b.textContent); });
    draw(false);
  }

  function open(){
    const bg = document.createElement('div'); bg.className = 'hk-bg';
    bg.innerHTML = `<div class="hk-sheet" role="dialog" aria-modal="true" aria-label="행사 도우미"><button type="button" class="hk-x" aria-label="닫기">×</button><div></div></div>`;
    const back = document.activeElement, onKey = e => { if(e.key === 'Escape') close(); };
    document.body.appendChild(bg); const close = () => { document.removeEventListener('keydown', onKey); bg.remove(); try { back?.focus?.(); } catch(e){} };
    document.addEventListener('keydown', onKey);
    bg.addEventListener('click', e => { if(e.target === bg) close(); }); bg.querySelector('.hk-x').onclick = close;
    mount(bg.querySelector('.hk-sheet > div'));
    setTimeout(() => { const i = bg.querySelector('input'); if(i && matchMedia('(hover:hover)').matches) i.focus(); else bg.querySelector('.hk-x').focus(); }, 60); // 휴대폰에선 키보드가 바로 뜨지 않게 닫기 버튼에
  }

  function fab(){
    const b = document.createElement('button'); b.className = 'hk-fab'; b.type = 'button'; b.setAttribute('aria-label', '행사 도우미 열기');
    b.innerHTML = `<img src="${BEAR}" alt="">`; b.onclick = open;
    document.body.appendChild(b); document.body.classList.add('hk-has-fab');
    let t = 0; addEventListener('scroll', () => { b.classList.add('dim'); clearTimeout(t); t = setTimeout(() => b.classList.remove('dim'), 700); }, { passive:true });
  }

  window.HocoAsk = { mount };
  // 운영 화면 · 현황 화면 · 도우미 전용 화면에는 버튼을 띄우지 않는다
  const qp = new URLSearchParams(location.search);
  const start = () => { if(!['screen', 'admin', 'ask'].some(k => qp.has(k))) fab(); };
  if(document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();

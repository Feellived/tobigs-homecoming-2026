#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""RSVP 시트에서 뽑은 CSV 한 장으로 live/tables.json 과 people.json 을 만든다.

사용법:  python3 tools/make_people.py 명단.csv [--publish]
CSV 열(헤더 이름 기준, 순서 무관): no,name,gen,t1,t2,intro,topic1,topic2,card,linkedin,remember,instagram,other,photo
  - no      명찰 번호 (= 응모 번호)
  - gen     "25기" 형식
  - t1,t2   1·2라운드 테이블 번호
  - intro   현재 하는 일 한 줄 (RSVP 6번)
  - topic1/topic2  관심 분야 1·2순위: 번호(1~8) 또는 RSVP 선택지 문구 그대로
  - card    "표시"면 참가자 카드·명찰 QR에 공개 (RSVP 8번). 그 외는 카드에서 제외
  - linkedin/remember/instagram/other  프로필 링크. 인스타그램은 @아이디만 적어도 됨
  - photo   회고 사진 제공자면 O/1/Y (추첨 응모권 +1, 관리 화면 체크인 탭에서 미리 켜진 상태로 표시)
--publish 를 주면 published:true 로 쓴다. 빼면 파일은 갱신하되 published:false 유지.
"""
import csv, json, sys, re, datetime, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
TOPICS = ['국내 취업 · 이직 · 현업 적응','대학원 진학 · 연구 생활','해외 취업 · 유학','커리어 준비 · 진로 비교','LLM · NLP · 에이전트','데이터 분석 · 통계 · BI','비전 · 생성 모델 · 강화학습','산업 도메인 · 비즈니스']
def topic_no(v):
    v = (v or '').strip()
    if not v: return None
    if v.isdigit(): return int(v)
    key = re.sub(r'\s+', '', v)[:6]
    for i, t in enumerate(TOPICS, 1):
        if re.sub(r'\s+', '', t).startswith(key): return i
    return None
def link(kind, v):
    v = (v or '').strip()
    if not v: return ''
    if kind == 'instagram' and not v.startswith('http'):
        return 'https://www.instagram.com/' + v.lstrip('@').strip('/')
    if kind == 'linkedin' and not v.startswith('http'):
        return 'https://www.linkedin.com/in/' + v.strip('/')
    if not v.startswith('http'): v = 'https://' + v
    return v if re.match(r'^https?://[^\s"\'<>]+$', v) else ''
def main():
    if len(sys.argv) < 2: print(__doc__); sys.exit(1)
    publish = '--publish' in sys.argv
    src = [a for a in sys.argv[1:] if not a.startswith('--')][0]
    with open(src, encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    tables, people = [], []
    for r in rows:
        g = lambda k: (r.get(k) or '').strip()
        if not g('no') or not g('name'): continue
        row = {'no': int(g('no')), 'name': g('name'), 'gen': g('gen'), 't1': g('t1'), 't2': g('t2')}
        if g('photo').upper() in ('O', '1', 'Y', 'TRUE', '○'): row['photo'] = True
        tables.append(row)
        if g('card') != '표시': continue
        links = {k: link(k, g(k)) for k in ('linkedin','remember','instagram','other')}
        people.append({'no': int(g('no')), 'name': g('name'), 'gen': g('gen'), 'intro': g('intro'),
                       'topics': [t for t in (topic_no(g('topic1')), topic_no(g('topic2'))) if t],
                       'links': {k: v for k, v in links.items() if v}})
    today = datetime.date.today().isoformat()
    (ROOT/'live'/'tables.json').write_text(json.dumps({'published': publish, 'updated': today, 'rows': tables}, ensure_ascii=False, indent=1), encoding='utf-8')
    (ROOT/'people.json').write_text(json.dumps({'published': publish, 'updated': today, 'rows': people}, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'tables.json {len(tables)}명, people.json {len(people)}명 (published={publish})')
if __name__ == '__main__': main()

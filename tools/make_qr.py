#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""명찰용 개인 QR 생성. 명단 CSV(운영 화면 '명단' 탭에 올리는 것과 같은 파일)의 모든 번호에 대해 qr/badge/<no>.png 를 만든다.
QR 내용: https://homecoming.datamarket.ai.kr/people/?no=<번호>  (카드를 공개하지 않은 사람은 참가자 카드 목록으로 열림)
사용법: python3 tools/make_qr.py 명단.csv   (pip install "qrcode[pil]")
명단 CSV와 qr/ 폴더는 저장소에 커밋하지 않는다(.gitignore).
"""
import csv, sys, pathlib, qrcode
ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://homecoming.datamarket.ai.kr/people/?no='
if len(sys.argv) < 2: print(__doc__); sys.exit(1)
src = sys.argv[1]
for enc in ('utf-8-sig', 'cp949'):
    try:
        with open(src, encoding=enc, newline='') as f: rows = list(csv.DictReader(f))
        break
    except UnicodeDecodeError: continue
nos = [r['no'].strip() for r in rows if (r.get('no') or '').strip().isdigit()]
out = ROOT/'qr'/'badge'; out.mkdir(parents=True, exist_ok=True)
for no in nos:
    img = qrcode.make(BASE + no, box_size=10, border=2, error_correction=qrcode.constants.ERROR_CORRECT_M)
    img.save(out/f"{no}.png")
print(f'{len(nos)}개 생성 → {out}')

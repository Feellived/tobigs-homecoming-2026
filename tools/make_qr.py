#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""명찰용 개인 QR 생성. live/tables.json 의 모든 번호에 대해 qr/badge/<no>.png 를 만든다.
QR 내용: https://homecoming.datamarket.ai.kr/people/?no=<번호>  (카드를 공개하지 않은 사람은 참가자 카드 목록으로 열림)
사용법: python3 tools/make_qr.py   (pip install "qrcode[pil]")
"""
import json, pathlib, qrcode
ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = 'https://homecoming.datamarket.ai.kr/people/?no='
out = ROOT/'qr'/'badge'; out.mkdir(parents=True, exist_ok=True)
rows = json.loads((ROOT/'live'/'tables.json').read_text(encoding='utf-8')).get('rows', [])
for r in rows:
    img = qrcode.make(BASE + str(r['no']), box_size=10, border=2, error_correction=qrcode.constants.ERROR_CORRECT_M)
    img.save(out/f"{r['no']}.png")
print(f'{len(rows)}개 생성 → {out}')

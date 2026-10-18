# -*- coding: utf-8 -*-
"""빠진 내용 검사 — 교과서 PDF의 글이 content.js 화면에 '빠짐없이' 들어갔는지 한 줄씩 대조한다.

사용:
  python tools/ingest/coverage.py "작업물/기하/content" --pages 72-76
  (extract.py가 만든 _extract/pages.json 과 content.js 를 비교)

판정:
  ✓ 들어감        PDF 줄의 글이 화면 글에 그대로(띄어쓰기·문장부호 무시) 있다
  △ 거의 들어감   80% 이상 겹침 — 줄바꿈·하이픈·수식 표기 차이일 가능성. 눈으로 확인
  ✗ 빠짐          화면 어디에도 없다 → 반드시 넣거나, 빼도 되는 까닭을 report에 적는다
  (쪽 번호·머리말·꼬리말·재단 정보 같은 인쇄용 글은 자동으로 제외)
끝에 빠진 줄 수를 출력하고, 빠진 줄이 있으면 종료 코드 1 (훅이 막는다).
"""
import argparse, json, os, re, sys
from common import load_content, norm, all_text, pdf_fix

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

SKIP = re.compile(r'^(\d{1,3}|[ⅠⅡⅢⅣⅤⅥⅦⅧ]+\.?.{0,24}|\d{1,3}\s+[ⅠⅡⅢⅣⅤⅥⅦⅧ]+\..{0,24}|\d{2}\.\s.{1,30}\s\d{1,3}|.*\.indd.*|\d{4}-\d{2}-\d{2}.*|.*오[전후] \d{1,2}:\d{2}.*)$')


def shingles(s, k=4):
    return {s[i:i + k] for i in range(max(1, len(s) - k + 1))}


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('content'); ap.add_argument('--pages'); ap.add_argument('--show', type=int, default=60)
    ap.add_argument('--ignore', help='빼도 되는 줄 목록 파일(한 줄에 하나, 이유는 # 뒤에)')
    a = ap.parse_args()
    ex = json.load(open(os.path.join(a.content, '_extract', 'pages.json'), encoding='utf-8'))
    tb = load_content(os.path.join(a.content, 'content.js'))
    lo, hi = (map(int, a.pages.split('-'))) if a.pages else (ex['from'], ex['to'])
    hay = norm(' '.join(all_text(tb)))
    hay_sh = shingles(hay)
    ignore = set()
    if a.ignore and os.path.exists(a.ignore):
        ignore = {norm(l.split('#')[0]) for l in open(a.ignore, encoding='utf-8') if l.strip()}
    tot = ok = near = 0; missing = []
    for p in range(lo, hi + 1):
        pg = ex['pages'].get(str(p))
        if not pg:
            continue
        for ln in pg['lines']:
            text = re.sub(r'^\s*(?:[⑴-⒇]|답(?=\S)|답\s+(?=[⑴-⒇\d\-−]))\s*', '', pdf_fix(ln[4])).strip(); y = ln[1]   # 소문항 번호·'답' 머리는 화면이 붙인다
            n = norm(text)
            if len(n) < 3 or SKIP.match(text.strip()) or (y > 0.93 and len(n) < 30) or (y < 0.04 and len(n) < 30) or n in ignore:
                continue
            tot += 1
            if n in hay:
                ok += 1; continue
            sh = shingles(n); hit = len(sh & hay_sh) / max(1, len(sh))
            if hit >= 0.8:
                near += 1; ok += 1
            else:
                math_like = len(re.findall(r'[가-힣]', text)) < len(text) * 0.25
                missing.append((p, text, round(hit * 100), math_like))
    print('검사한 쪽: %d~%d · 줄 %d개 · 들어감 %d (거의 %d) · 빠짐 %d' % (lo, hi, tot, ok, near, len(missing)))
    if missing:
        print('\n✗ 빠진 줄 (쪽 · 겹침% · 내용) — 수식 줄(∑)은 표기 차이일 수 있으니 원본과 눈으로 대조')
        for p, t, h, m in missing[:a.show]:
            print('  %d쪽 · %3d%% %s %s' % (p, h, '∑' if m else ' ', t[:90]))
        if len(missing) > a.show:
            print('  … 외 %d줄' % (len(missing) - a.show))
        sys.exit(1)
    print('✓ 빠진 줄이 없어요.')


if __name__ == '__main__':
    main()

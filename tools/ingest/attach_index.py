# -*- coding: utf-8 -*-
"""원본 보기용 색인을 content.js에 붙인다 — 교과서 속 검색(lines), 핵심어 눌러 뜻 보기(terms), 쪽 정보(pages), 검사(hotspots)

사용:  python tools/ingest/attach_index.py "작업물/기하/content"
- lines: 쪽마다 글 줄 좌표 (검색 결과 형광 표시, 영어 읽어 주기)
- terms: glossary 용어가 원본 쪽에 나오는 자리. 쪽마다 같은 용어는 한 번만, 겹치면 긴 용어 우선 (밑줄이 난잡해지지 않게)
- pages: from/to/ratio/pattern/hi — extract.py 결과로 채움
- hotspots: 좌표가 0~1 안에 있는지, 그 쪽이 있는지 검사만
"""
import argparse, json, os, sys
from common import load_content, save_content, norm

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('content'); a = ap.parse_args()
    cpath = os.path.join(a.content, 'content.js')
    ex = json.load(open(os.path.join(a.content, '_extract', 'pages.json'), encoding='utf-8'))
    tb = load_content(cpath)
    pg = tb.setdefault('pages', {})
    pg.update({'pattern': 'pages/p{n}.webp', 'hi': 'pages/hi/p{n}.webp', 'pad': 3, 'from': ex['from'], 'to': ex['to'], 'ratio': ex['ratio']})
    pg.setdefault('pairing', 'even-left')
    lines = {}; terms = {}
    gl = [g['term'] for g in tb.get('glossary', []) if g.get('term')]
    for p, d in ex['pages'].items():
        L = [[l[0], l[1], l[2], l[3], l[4]] for l in d['lines'] if l[4].strip()]
        lines[p] = L
        found = []
        for t in sorted(gl, key=len, reverse=True):
            for l in L:
                i = l[4].find(t)
                if i < 0:
                    continue
                n = max(1, len(l[4]))
                box = [round(l[0] + l[2] * i / n, 4), l[1], round(l[2] * len(t) / n, 4), l[3], t]
                if any(abs(f[1] - box[1]) < 0.004 and not (box[0] + box[2] <= f[0] or f[0] + f[2] <= box[0]) for f in found):
                    continue
                found.append(box); break
        if found:
            terms[p] = found
    tb['lines'] = lines; tb['terms'] = terms
    bad = []
    for p, hs in (tb.get('hotspots') or {}).items():
        if p not in ex['pages']:
            bad.append('%s쪽 hotspot: 그 쪽이 추출되지 않음' % p)
        for h in hs:
            if not all(0 <= h.get(k, 0) <= 1 for k in ('x', 'y', 'w', 'h')):
                bad.append('%s쪽 hotspot 좌표가 0~1 밖: %s' % (p, h))
    # 용어 정의가 비었는지
    empty = [g['term'] for g in tb.get('glossary', []) if not g.get('def')]
    save_content(cpath, tb)
    print('색인을 붙였어요: 쪽 %d개 · 검색 줄 %d개 · 용어 자리 %d개' % (len(lines), sum(len(v) for v in lines.values()), sum(len(v) for v in terms.values())))
    if empty:
        print('△ 뜻이 비어 있는 용어 %d개: %s → 교과서 문장으로 채울 것' % (len(empty), ', '.join(empty[:12])))
    if bad:
        print('✗ ' + '\n✗ '.join(bad)); sys.exit(1)


if __name__ == '__main__':
    main()

# -*- coding: utf-8 -*-
"""교과서 그림의 색을 뽑아 3D 모형 theme로 — '교과서 그림과 같은 톤'
사용:  python tools/ingest/figure_palette.py "작업물/기하/content/figs/p075-1.webp"
출력:  {"plane": "#F6B98E", "plane2": "#9FD9C0", "line": "#17191B", "accent": "...", "shape": "..."}  → content의 lab 블록 theme에 넣는다
규칙: 흰 바탕·검은 선은 빼고 채도 있는 색을 면적 순으로. 선 색은 가장 어두운 색.
"""
import colorsys, json, sys
from PIL import Image


def main(path):
    im = Image.open(path).convert('RGB'); im.thumbnail((240, 240))
    q = im.quantize(colors=12, method=Image.Quantize.MEDIANCUT)
    pal = q.getpalette()[:36]; counts = sorted(q.getcolors(), reverse=True)
    cols = []
    for n, idx in counts:
        r, g, b = pal[idx * 3: idx * 3 + 3]
        h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        cols.append({'hex': '#%02X%02X%02X' % (r, g, b), 'n': n, 'l': l, 's': s})
    dark = min(cols, key=lambda c: c['l'])
    vivid = [c for c in cols if c['s'] > 0.18 and 0.18 < c['l'] < 0.92]
    vivid.sort(key=lambda c: -c['n'])
    out = {'line': dark['hex'] if dark['l'] < 0.35 else '#17191B'}
    keys = ['plane', 'plane2', 'shape', 'accent']
    for k, c in zip(keys, vivid):
        out[k] = c['hex']
    out['label'] = 'serif-italic'
    print(json.dumps(out, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(2)
    main(sys.argv[1])

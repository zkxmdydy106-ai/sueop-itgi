# -*- coding: utf-8 -*-
"""교과서 그림 오려 내기 — 그림 후보로 잡히지 않은 선 그림(벡터 도형·모눈 그림)을 원본 PDF에서 그대로 고화질로 잘라 figs/에 둔다.

사용:
  python tools/ingest/crop_fig.py "교과서_넣는곳/기하.pdf" "작업물/기하/content" figs.json
figs.json (상자는 쪽 그림 pages/hi/pNNN.webp 기준 0~1 비율 — 쪽 그림을 Read로 보고 고른다):
  [ {"page": 103, "name": "p103-sq", "box": [0.77, 0.18, 0.15, 0.1]}, … ]
결과: content/figs/<name>.webp  (400dpi — 선 그림이 칠판에서 크게 보여도 또렷하게, 그림은 가공하지 않는다 — 자르기만)
쪽 번호 보정값(offset)과 재단은 extract.py가 만든 _extract/pages.json을 그대로 따른다.
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract import fitz, trim_rect, save_webp  # noqa: E402

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


def main():
    if len(sys.argv) < 4:
        print(__doc__); sys.exit(1)
    pdf, content, spec = sys.argv[1:4]
    meta = json.load(open(os.path.join(content, '_extract', 'pages.json'), encoding='utf-8'))
    doc = fitz.open(pdf)
    items = json.load(open(spec, encoding='utf-8'))
    for it in items:
        pg = meta['pages'].get(str(it['page']))
        if not pg:
            print('✗ %s쪽은 추출되지 않았어요' % it['page']); continue
        page = doc[pg['pdf'] - 1]; clip = trim_rect(page, 'auto')
        x, y, w, h = it['box']
        r = fitz.Rect(clip.x0 + x * clip.width, clip.y0 + y * clip.height, clip.x0 + (x + w) * clip.width, clip.y0 + (y + h) * clip.height)
        pix = page.get_pixmap(dpi=it.get('dpi', 400), clip=r, alpha=False)
        out = os.path.join(content, 'figs', it['name'] + '.webp')
        n = save_webp(pix, out, max_bytes=740_000, quality=88)
        print('✓ figs/%s.webp  %dx%d  %dKB' % (it['name'], pix.width, pix.height, n // 1024))


if __name__ == '__main__':
    main()

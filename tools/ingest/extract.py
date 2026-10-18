# -*- coding: utf-8 -*-
"""교과서 PDF → 엔진 재료 뽑기 (쪽 그림 · 글 줄 좌표 · 그림 후보 · 목차 · 쪽 번호 보정)

사용 (이 저장소 폴더에서):
  python tools/ingest/extract.py "교과서_넣는곳/기하.pdf" --out "작업물/기하/content"
  python tools/ingest/extract.py 책.pdf --out ... --pages 70-90        # 인쇄 쪽 번호 범위만
  python tools/ingest/extract.py 책.pdf --out ... --offset 10          # PDF 쪽 = 인쇄 쪽 - 10 일 때 (자동 판별이 틀리면)

만드는 것 (content 폴더 안):
  pages/p072.webp        원본 보기용 쪽 그림 (재단선·여백 표시를 잘라 냄)
  pages/hi/p072.webp     확대용 고화질 (740KB 이하로 맞춤 → Firestore 문서 1MiB 안에 들어감)
  figs/p072-1.webp       그림 후보 잘라 낸 것 (교과서 그림 그대로 화면에 넣을 때)
  _extract/pages.json    쪽마다 글 줄(좌표·글자 크기·굵기), 그림 후보 좌표
  _extract/outline.json  PDF 책갈피(대·중·소단원) + 인쇄 쪽
  _extract/report.md     사람이 읽는 요약 (쪽 수, 보정값, 그림 수, 스캔본 여부)
필요: pip install pymupdf pillow
"""
import argparse, io, json, os, re, statistics, sys

try:
    try:
        import pymupdf as fitz  # PyMuPDF 1.24+
    except ImportError:
        import fitz  # 예전 PyMuPDF
except ImportError:
    print('PyMuPDF가 없어요 →  pip install pymupdf pillow'); sys.exit(2)
from PIL import Image

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


def detect_offset(doc, sample=40):
    """쪽 위·아래 여백의 숫자로 '인쇄 쪽 - PDF 쪽(1부터)' 보정값을 찾는다."""
    votes = []
    for i in range(min(len(doc), sample)):
        p = doc[i]; h = p.rect.height
        for b in p.get_text('words'):
            x0, y0, x1, y1, w = b[:5]
            if (y0 > h * 0.88 or y1 < h * 0.08) and re.fullmatch(r'\d{1,3}', w):
                votes.append(int(w) - (i + 1))
    if not votes:
        return None, 0
    off = statistics.mode(votes)
    return off, votes.count(off) / max(1, len(votes))


def trim_rect(page, mode):
    """재단선이 있는 인쇄용 PDF면 TrimBox(또는 재단선 안쪽)로 자른다."""
    # 그리기·자르기 좌표는 CropBox 기준(page.rect). TrimBox는 MediaBox 기준이라 CropBox 원점만큼 옮겨야 한다
    # (CropBox가 이미 TrimBox로 잘려 있는 PDF에서 한 번 더 자르면 쪽 왼쪽·위가 잘려 나간다).
    mb = page.rect
    try:
        tb, cb = page.trimbox, page.cropbox
        if tb:
            r = fitz.Rect(tb.x0 - cb.x0, tb.y0 - cb.y0, tb.x1 - cb.x0, tb.y1 - cb.y0) & mb
            if r.width > mb.width * 0.6 and (abs(r.width - mb.width) > 2 or abs(r.height - mb.height) > 2):
                return r
    except Exception:
        pass
    if mode == 'none':
        return mb
    if isinstance(mode, float):
        m = mode * 72 / 25.4
        return fitz.Rect(mb.x0 + m, mb.y0 + m, mb.x1 - m, mb.y1 - m)
    # auto: 가장자리 근처의 짧고 가는 선(재단선)이 4개 이상이면 그 안쪽으로
    edge = 22 * 72 / 25.4
    marks = []
    try:
        for d in page.get_drawings():
            r = d.get('rect')
            if r and (r.width < 1.5 or r.height < 1.5) and max(r.width, r.height) < 40:
                if r.x1 < mb.x0 + edge or r.x0 > mb.x1 - edge or r.y1 < mb.y0 + edge or r.y0 > mb.y1 - edge:
                    marks.append(r)
    except Exception:
        pass
    if len(marks) >= 4:
        xs = sorted([m.x0 for m in marks if m.height > m.width] + [m.x1 for m in marks if m.height > m.width])
        ys = sorted([m.y0 for m in marks if m.width > m.height] + [m.y1 for m in marks if m.width > m.height])
        if len(xs) >= 2 and len(ys) >= 2:
            left = max([x for x in xs if x < mb.width / 2] or [mb.x0]); right = min([x for x in xs if x > mb.width / 2] or [mb.x1])
            top = max([y for y in ys if y < mb.height / 2] or [mb.y0]); bottom = min([y for y in ys if y > mb.height / 2] or [mb.y1])
            r = fitz.Rect(left, top, right, bottom)
            if r.width > mb.width * 0.6 and r.height > mb.height * 0.6:
                return r
    return mb


def save_webp(pix, path, max_bytes=None, quality=82):
    im = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    q = quality
    while True:
        buf = io.BytesIO(); im.save(buf, 'WEBP', quality=q, method=5)
        if not max_bytes or buf.tell() <= max_bytes:
            break
        if q > 48:
            q -= 8
        else:   # 화질을 더 낮추는 대신 크기를 줄인다 (글자가 뭉개지지 않게)
            im = im.resize((int(im.width * 0.88), int(im.height * 0.88)), Image.LANCZOS)
    with open(path, 'wb') as f:
        f.write(buf.getvalue())
    return buf.tell()


def page_lines(page, clip):
    """글 줄: [x, y, w, h (clip 기준 0~1), 글, 글자크기, 굵게]"""
    out = []
    d = page.get_text('dict', clip=clip)
    W, H = clip.width, clip.height
    for b in d.get('blocks', []):
        if b.get('type') != 0:
            continue
        for ln in b.get('lines', []):
            spans = [s for s in ln.get('spans', []) if s.get('text', '').strip()]
            if not spans:
                continue
            text = ''.join(s['text'] for s in spans).strip()
            x0 = min(s['bbox'][0] for s in spans); y0 = min(s['bbox'][1] for s in spans)
            x1 = max(s['bbox'][2] for s in spans); y1 = max(s['bbox'][3] for s in spans)
            size = round(max(s['size'] for s in spans), 1)
            bold = any(('Bold' in s.get('font', '') or 'bold' in s.get('font', '') or s.get('flags', 0) & 16) for s in spans)
            out.append([round((x0 - clip.x0) / W, 4), round((y0 - clip.y0) / H, 4), round((x1 - x0) / W, 4), round((y1 - y0) / H, 4), text, size, bool(bold)])
    out.sort(key=lambda l: (round(l[1], 2), l[0]))
    return out


def figure_boxes(page, clip):
    """그림 후보: 들어 있는 비트맵 그림 + 모여 있는 벡터 도형 덩어리"""
    boxes = []
    for info in page.get_image_info():
        r = fitz.Rect(info['bbox']) & clip
        if r.width > clip.width * 0.08 and r.height > clip.height * 0.05:
            boxes.append(r)
    try:
        rects = [d['rect'] for d in page.get_drawings() if d.get('rect') and d['rect'].width * d['rect'].height > 30]
    except Exception:
        rects = []
    # 가까운 벡터 도형끼리 묶기
    groups = []
    for r in rects:
        r = fitz.Rect(r) & clip
        if r.is_empty:
            continue
        for g in groups:
            if (fitz.Rect(g) + (-8, -8, 8, 8)).intersects(r):
                g |= r; break
        else:
            groups.append(fitz.Rect(r))
    for g in groups:
        if g.width > clip.width * 0.15 and g.height > clip.height * 0.08 and g.width < clip.width * 0.98 and g.height < clip.height * 0.9:
            boxes.append(g)
    # 겹치는 것 합치기
    merged = []
    for b in sorted(boxes, key=lambda r: -r.width * r.height):
        if any((m & b).width * (m & b).height > 0.6 * b.width * b.height for m in merged if not (m & b).is_empty):
            continue
        merged.append(b)
    return merged


def parse_range(s):
    if not s:
        return None
    a, _, b = s.partition('-')
    return int(a), int(b or a)


def guard(doc):
    """기술적 보호조치(저작권법 제2조 28호·제104조의2)를 우회하지 않는다: 암호·복사 금지 PDF는 열지 않는다."""
    enc = (doc.metadata or {}).get('encryption')
    if doc.needs_pass:
        print('✗ 이 PDF는 암호가 걸려 있어요. 암호를 풀거나 우회하지 않습니다.')
    elif enc and not (doc.permissions & fitz.PDF_PERM_COPY):
        print('✗ 이 PDF는 "내용 복사 금지" 보호(%s)가 걸려 있어요. 보호를 우회해 글·그림을 뽑지 않습니다.' % enc)
    else:
        return False
    print('  방법: ① 출판사 교사 지원 사이트에서 보호 없는 교사용 PDF 받기  ② 출판사에 수업용 이용 허락 문의')
    print('        ③ 디지털교과서 플랫폼의 공식 기능 사용  (자세히: .claude/skills/copyright-guard/SKILL.md)')
    return True


def main():
    ap = argparse.ArgumentParser(description='교과서 PDF에서 엔진 재료 뽑기')
    ap.add_argument('pdf'); ap.add_argument('--out', required=True)
    ap.add_argument('--pages', help='인쇄 쪽 범위 예: 70-90')
    ap.add_argument('--offset', type=int, help='인쇄 쪽 - PDF 쪽(1부터). 비우면 자동')
    ap.add_argument('--dpi', type=int, default=150); ap.add_argument('--hi-dpi', type=int, default=260)
    ap.add_argument('--trim', default='auto', help='auto | none | 여백 mm 숫자')
    ap.add_argument('--no-figs', action='store_true')
    a = ap.parse_args()
    trim = a.trim if a.trim in ('auto', 'none') else float(a.trim)
    doc = fitz.open(a.pdf)
    if guard(doc):
        sys.exit(3)
    off, conf = (a.offset, 1.0) if a.offset is not None else detect_offset(doc)
    if off is None:
        off, conf = 0, 0
        print('! 쪽 번호를 찾지 못했어요. PDF 1쪽 = 교과서 1쪽으로 둡니다. 맞지 않으면 --offset 을 주세요.')
    rng = parse_range(a.pages)
    out = a.out; os.makedirs(os.path.join(out, 'pages', 'hi'), exist_ok=True); os.makedirs(os.path.join(out, 'figs'), exist_ok=True); os.makedirs(os.path.join(out, '_extract'), exist_ok=True)
    pages = {}; scanned = 0; total_figs = 0; ratio = None; nums = []
    for i in range(len(doc)):
        printed = i + 1 + off
        if rng and not (rng[0] <= printed <= rng[1]):
            continue
        page = doc[i]; clip = trim_rect(page, trim)
        ratio = ratio or round(clip.height / clip.width, 4)
        pix = page.get_pixmap(dpi=a.dpi, clip=clip, alpha=False)
        save_webp(pix, os.path.join(out, 'pages', 'p%03d.webp' % printed))
        hix = page.get_pixmap(dpi=a.hi_dpi, clip=clip, alpha=False)
        save_webp(hix, os.path.join(out, 'pages', 'hi', 'p%03d.webp' % printed), max_bytes=740_000, quality=80)
        lines = page_lines(page, clip)
        if sum(len(l[4]) for l in lines) < 20:
            scanned += 1
        figs = []
        if not a.no_figs:
            for k, r in enumerate(figure_boxes(page, clip), 1):
                chars = len(page.get_text('text', clip=r).strip())
                kind = 'box' if chars > 60 else 'figure'   # 글이 많이 든 테두리 상자는 '상자'로 표시 (그림이 아님)
                fp = page.get_pixmap(dpi=220, clip=r + (-4, -4, 4, 4), alpha=False)
                name = 'figs/p%03d-%d%s.webp' % (printed, k, '-box' if kind == 'box' else '')
                save_webp(fp, os.path.join(out, name), max_bytes=740_000, quality=86)
                figs.append({'src': name, 'kind': kind, 'chars': chars, 'box': [round((r.x0 - clip.x0) / clip.width, 4), round((r.y0 - clip.y0) / clip.height, 4), round(r.width / clip.width, 4), round(r.height / clip.height, 4)]})
            total_figs += len(figs)
        pages[str(printed)] = {'pdf': i + 1, 'lines': lines, 'figs': figs}
        nums.append(printed)
        print('  %d쪽 (PDF %d쪽) · 글 %d줄 · 그림 후보 %d' % (printed, i + 1, len(lines), len(figs)))
    outline = [{'level': l, 'title': t, 'page': p + off} for l, t, p in doc.get_toc(simple=True)]
    json.dump({'offset': off, 'ratio': ratio, 'from': min(nums) if nums else None, 'to': max(nums) if nums else None, 'pages': pages}, open(os.path.join(out, '_extract', 'pages.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump(outline, open(os.path.join(out, '_extract', 'outline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    rep = ['# 추출 보고', '', '- PDF: %s (%d쪽)' % (os.path.basename(a.pdf), len(doc)),
           '- 쪽 번호 보정: 인쇄 쪽 = PDF 쪽 + %d (확신도 %d%%)' % (off, round(conf * 100)),
           '- 뽑은 쪽: %s~%s (%d쪽), 쪽 비율(세로/가로) %s' % (min(nums) if nums else '-', max(nums) if nums else '-', len(nums), ratio),
           '- 그림 후보: %d개 (figs/) — 화면에 쓸 그림만 골라 content의 fig 블록에 넣는다' % total_figs,
           '- 책갈피: %d개' % len(outline),
           '- 글자 레이어가 거의 없는 쪽(스캔본 의심): %d쪽 → 이 쪽들은 그림으로 직접 읽고 옮겨 적어야 함' % scanned, '',
           '다음 단계: content.js 작성 → `python tools/ingest/attach_index.py` → `python tools/ingest/coverage.py`']
    open(os.path.join(out, '_extract', 'report.md'), 'w', encoding='utf-8').write('\n'.join(rep))
    print('\n'.join(rep))


if __name__ == '__main__':
    main()

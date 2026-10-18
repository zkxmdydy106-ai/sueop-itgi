# -*- coding: utf-8 -*-
"""content.js 검사 — 형식·빠진 값·깨진 수식·없는 그림·없는 모형을 브라우저 없이 빠르게 찾는다.

사용:  python tools/verify/check_content.py "작업물/기하_비상"        (또는 .../content 폴더, content.js 파일)
       --strict : △(확인할 것)도 실패로 친다
✗ = 반드시 고칠 것 (앱이 깨지거나 학생이 틀린 것을 배움)   △ = 사람이 확인할 것
수식 검사: node가 있으면 KaTeX로 모든 $…$를 실제로 그려 본다 (없으면 괄호·$ 짝만 본다).
"""
import argparse, json, os, re, shutil, subprocess, sys, tempfile

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'ingest'))
from common import load_content  # noqa: E402

BLOCKS = {'p', 'h', 'def', 'note', 'list', 'table', 'fig', 'ex', 'prob', 'act', 'read', 'lab', 'cols', 'viz', 'html', 'extra'}
KINDS = {'open', 'concept', 'problem', 'activity', 'summary'}
VIZ = {'flow', 'cycle', 'compare', 'timeline', 'venn', 'map', 'graph'}
GRADE = {'num', 'text', 'choice', 'ox'}
FIELDS = {'공학·기술', '자연과학', '의약·보건', 'IT·인공지능', '경영·경제', '인문·사회', '교육', '예술·디자인', '체육·스포츠'}


def find_paths(arg):
    arg = os.path.abspath(arg)
    if arg.endswith('.js'):
        content = os.path.dirname(arg)
    elif os.path.exists(os.path.join(arg, 'content.js')):
        content = arg
    else:
        content = os.path.join(arg, 'content')
    course = os.path.dirname(content)
    app = os.path.join(course, 'app') if os.path.isdir(os.path.join(course, 'app')) else None
    return course, content, app


def known_labs(app):
    ids = set()
    roots = [os.path.join(app, 'assets', 'js', 'labs')] if app else []
    roots.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'engine', 'app', 'assets', 'js', 'labs'))
    for r in roots:
        if os.path.isdir(r):
            for f in os.listdir(r):
                if f.endswith('.js'):
                    ids.update(re.findall(r"DT\.lab\.register\(\s*'([^']+)'", open(os.path.join(r, f), encoding='utf-8').read()))
    return ids


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('path'); ap.add_argument('--strict', action='store_true'); a = ap.parse_args()
    course, content, app = find_paths(a.path)
    cpath = os.path.join(content, 'content.js')
    F, W = [], []
    try:
        tb = load_content(cpath)
    except Exception as e:
        print('✗ content.js를 읽을 수 없어요 (JSON 형식 오류): %s' % e); sys.exit(1)
    if not tb.get('units'):
        print('아직 교과서 내용이 없어요 (units 비어 있음) — 소단원을 만든 뒤 다시 검사'); sys.exit(0)
    labs = known_labs(app)
    meta = tb.get('meta') or {}
    for k in ('title', 'subject'):
        if not meta.get(k):
            F.append('meta.%s 없음' % k)
    pg = tb.get('pages') or {}
    p_from, p_to = pg.get('from'), pg.get('to')
    if not pg.get('pattern'):
        W.append('pages 정보 없음 → 원본 보기가 안 됨 (tools/ingest/attach_index.py 실행)')
    maths = []  # (where, tex, display)
    ids = {}
    subs = []

    def in_range(p):
        return p_from is None or (isinstance(p, int) and p_from <= p <= p_to)

    def text_checks(where, s):
        if not isinstance(s, str):
            return
        t = re.sub(r'\\\$', '', s)
        if t.count('$') % 2:
            F.append('%s: $ 짝이 안 맞음 → %s' % (where, s[:60]))
        else:
            for m in re.finditer(r'\$\$([^$]+)\$\$|\$([^$]+)\$', t):
                maths.append((where, m.group(1) or m.group(2), bool(m.group(1))))
        if s.count('[[') != s.count(']]'):
            F.append('%s: [[ ]] 짝이 안 맞음' % where)
        if re.search(r'TODO|자리 표시|lorem|XXX', s, re.I):
            F.append('%s: 채우지 않은 자리 → %s' % (where, s[:60]))

    def walk_text(where, v):
        if isinstance(v, str):
            text_checks(where, v)
        elif isinstance(v, list):
            for x in v: walk_text(where, x)

    def check_block(where, b, sub):
        t = b.get('t')
        if t not in BLOCKS:
            F.append('%s: 모르는 블록 t=%r' % (where, t)); return
        for k in ('x', 'q', 'ans', 'cap', 'title', 'desc', 'label'):
            if k in b: text_checks(where + '.' + k, b[k])
        for k in ('items', 'sol', 'sub', 'head'):
            if k in b: walk_text(where + '.' + k, b[k])
        if t in ('p', 'h', 'def', 'note', 'read') and not b.get('x'):
            F.append('%s: 글(x)이 비었음' % where)
        if t == 'list' and not b.get('items'):
            F.append('%s: list에 items 없음' % where)
        if t == 'table':
            rows = b.get('rows') or []
            if not rows: F.append('%s: table에 rows 없음' % where)
            n = len(b['head']) if b.get('head') else (len(rows[0]) if rows else 0)
            for r in rows:
                walk_text(where, r)
                if len(r) != n: F.append('%s: 표의 칸 수가 줄마다 다름' % where); break
        if t == 'fig':
            if not b.get('svg') and not b.get('src'):
                F.append('%s: 그림에 svg/src 없음' % where)
            if b.get('src') and not b['src'].startswith(('http', 'data:')) and not os.path.exists(os.path.join(content, b['src'])):
                F.append('%s: 그림 파일이 없음 → %s' % (where, b['src']))
            if b.get('svg') and '<svg' not in b['svg']:
                F.append('%s: svg 문자열이 <svg로 시작하지 않음' % where)
        if t == 'ex':
            if not b.get('q'): F.append('%s: 예제 문제(q) 없음' % where)
            if not b.get('sol'): W.append('%s: 예제 풀이(sol) 없음 — 교과서 풀이를 단계로 옮길 것' % where)
        if t == 'prob':
            if not b.get('q'): F.append('%s: 문제(q) 없음' % where)
            g = b.get('grade')
            if g:
                if g.get('type') not in GRADE: F.append('%s: grade.type은 num|text|choice|ox' % where)
                if g.get('key') in (None, '', []): F.append('%s: grade.key(정답) 없음' % where)
                if g.get('type') == 'choice':
                    ch = g.get('choices') or []
                    if not ch: F.append('%s: 객관식인데 choices 없음' % where)
                    if any(re.match(r'^\s*[①②③④⑤]', str(c)) for c in ch): F.append('%s: choices 앞의 ①② 를 빼세요 (화면이 붙임)' % where)
                    for k in ([g.get('key')] if not isinstance(g.get('key'), list) else g['key']):
                        for kk in str(k).split('|'):
                            if not (kk.isdigit() and 1 <= int(kk) <= max(1, len(ch))): F.append('%s: 객관식 key는 1~%d 번호 (지금 %r)' % (where, len(ch), kk))
                if b.get('sub') and isinstance(g.get('key'), list) and len(g['key']) != len(b['sub']):
                    F.append('%s: 소문항 %d개인데 정답 %d개' % (where, len(b['sub']), len(g['key'])))
            elif not b.get('ans'):
                W.append('%s: 정답(ans)도 채점(grade)도 없음 — 서술형이면 ans에 예시 답을' % where)
        if t == 'act' and not (b.get('items') or b.get('x')):
            F.append('%s: 탐구 활동에 내용(items/x) 없음' % where)
        if t == 'lab':
            if b.get('lab') not in labs:
                F.append('%s: 모형 %r이 없음 (assets/js/labs/에 만들고 html에 script 추가)' % (where, b.get('lab')))
            if not b.get('theme'):
                W.append('%s: 모형 theme 없음 → 교과서 그림 색(figure_palette.py)을 넣을 것' % where)
        if t == 'cols':
            cols = b.get('cols') or []
            if not cols: F.append('%s: cols 비었음' % where)
            if b.get('ratio') and len(b['ratio']) != len(cols): F.append('%s: ratio 개수와 칸 수가 다름' % where)
            for ci, col in enumerate(cols):
                for bi, bb in enumerate(col):
                    check_block('%s.%d.%d' % (where, ci, bi), bb, sub)
        if t == 'viz':
            k = b.get('kind')
            if k not in VIZ: F.append('%s: viz.kind는 %s' % (where, '|'.join(sorted(VIZ))))
            need = {'flow': 'steps', 'cycle': 'steps', 'compare': 'cols', 'timeline': 'events', 'venn': 'a', 'map': 'nodes', 'graph': 'fn'}.get(k)
            if need and not b.get(need): F.append('%s: viz %s에 %s 없음' % (where, k, need))
            def deep(v):
                if isinstance(v, str): text_checks(where, v)
                elif isinstance(v, list): [deep(x) for x in v]
                elif isinstance(v, dict): [deep(x) for kk, x in v.items() if kk not in ('kind', 'fn', 'params', 'x', 'y', 'dir')]
            deep({kk: vv for kk, vv in b.items() if kk not in ('t', 'kind', 'fn', 'params', 'x', 'y', 'r', 'stepwise', 'title')})
        if 'r' in b and (not isinstance(b['r'], int) or b['r'] < 1):
            F.append('%s: r(열리는 순서)은 1 이상 정수' % where)

    def walk_units(nodes, depth):
        for n in nodes or []:
            if 'screens' in n:
                subs.append(n)
            if n.get('children'):
                walk_units(n['children'], depth + 1)

    walk_units(tb.get('units'), 0)
    if not subs:
        F.append('소단원(screens 있는 단원)이 하나도 없음')
    total_screens = 0
    for u in subs:
        uid = u.get('id', '?')
        if not u.get('title'): F.append('%s: 소단원 title 없음' % uid)
        pages = u.get('pages') or []
        if len(pages) != 2: F.append('%s: pages는 [시작쪽, 끝쪽]' % uid)
        elif not (in_range(pages[0]) and in_range(pages[1])): F.append('%s: pages %s가 원본 쪽 범위(%s~%s) 밖' % (uid, pages, p_from, p_to))
        if not u.get('standards'): W.append('%s: 성취기준(standards) 없음 → 자기평가·성취기준 기록이 비어요' % uid)
        for st in u.get('standards') or []:
            if not st.get('code') or not st.get('text'): F.append('%s: 성취기준에 code/text 없음' % uid)
        if not u.get('explore'): W.append('%s: 진로 탐구 거리(explore) 없음' % uid)
        for i, e in enumerate(u.get('explore') or []):
            bad = set(e.get('fields') or []) - FIELDS
            if bad: F.append('%s.explore[%d]: 모르는 진로 분야 %s (%s)' % (uid, i, bad, ', '.join(sorted(FIELDS))))
            if not e.get('idea') or not e.get('q'): F.append('%s.explore[%d]: idea/q 없음' % (uid, i))
        screens = u.get('screens') or []
        if not screens: F.append('%s: screens 비었음' % uid)
        total_screens += len(screens)
        kinds = set()
        for s in screens:
            sid = s.get('id', '?')
            if sid in ids: F.append('화면 id 중복: %s' % sid)
            ids[sid] = s
            if not sid.startswith(uid + '.'): W.append('%s: 화면 id는 "%s.s번호" 꼴 권장' % (sid, uid))
            if s.get('kind') not in KINDS: F.append('%s: kind는 %s' % (sid, '|'.join(sorted(KINDS))))
            kinds.add(s.get('kind'))
            for k in ('step', 'title', 'chip'):
                if not s.get(k): (F if k != 'chip' else W).append('%s: %s 없음' % (sid, k))
            text_checks(sid + '.title', s.get('title', ''))
            sp = s.get('pages') or []
            if not sp: F.append('%s: pages(교과서 쪽) 없음 → 원본 보기 버튼이 엉뚱한 쪽을 엶' % sid)
            for p in sp:
                if pages and len(pages) == 2 and not (pages[0] <= p <= pages[1]): W.append('%s: %s쪽이 소단원 쪽(%s) 밖' % (sid, p, pages))
            blocks = s.get('blocks') or []
            if not blocks: F.append('%s: blocks 비었음' % sid)
            chars = 0
            for i, b in enumerate(blocks):
                check_block('%s[%d]' % (sid, i), b, u)
                chars += len(re.sub(r'<[^>]+>', '', json.dumps({k: v for k, v in b.items() if k not in ('svg', 'theme', 'props')}, ensure_ascii=False)))
            if chars > 2600: W.append('%s: 글이 많음(%d자) → audit_app.py로 넘침 확인, 넘치면 화면 나누기' % (sid, chars))
        if 'problem' not in kinds: W.append('%s: 문제 화면(kind=problem)이 없음' % uid)
        for i, p in enumerate(u.get('practice') or []):
            if p.get('key') in (None, ''): F.append('%s.practice[%d]: key 없음' % (uid, i))
            if p.get('screen') and p['screen'] not in [x.get('id') for x in screens]: F.append('%s.practice[%d]: screen %s 없음' % (uid, i, p['screen']))
            text_checks('%s.practice[%d]' % (uid, i), p.get('q', ''))
    for i, g in enumerate(tb.get('glossary') or []):
        w = 'glossary[%d] %s' % (i, g.get('term', '?'))
        if not g.get('term'): F.append(w + ': term 없음')
        if not g.get('def'): F.append(w + ': 뜻(def) 없음 → 교과서 문장으로')
        if g.get('screen') and g['screen'] not in ids: F.append(w + ': screen %s 없음' % g['screen'])
        if g.get('page') is not None and not in_range(g['page']): F.append(w + ': page %s가 범위 밖' % g['page'])
        text_checks(w, g.get('def', ''))
    for p, hs in (tb.get('hotspots') or {}).items():
        try:
            pn = int(p)
        except ValueError:
            F.append('hotspots: 쪽 번호 %r' % p); continue
        if not in_range(pn): F.append('hotspots %s쪽: 범위 밖' % p)
        for h in hs:
            if h.get('lab') not in labs: F.append('hotspots %s쪽: 모형 %r 없음' % (p, h.get('lab')))
            if not all(isinstance(h.get(k), (int, float)) and 0 <= h[k] <= 1 for k in ('x', 'y', 'w', 'h')): F.append('hotspots %s쪽: x,y,w,h는 0~1 비율' % p)
    if p_from is not None and not tb.get('lines'):
        W.append('lines(검색 색인) 없음 → attach_index.py')
    # 수식: KaTeX로 실제 그려 보기
    node = shutil.which('node')
    kpath = None
    for base in ([app] if app else []) + [os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'engine', 'app')]:
        c = os.path.join(base, 'assets', 'vendor', 'katex', 'katex.min.js')
        if os.path.exists(c): kpath = c; break
    if node and kpath and maths:
        with tempfile.TemporaryDirectory() as td:
            jp = os.path.join(td, 'm.json'); json.dump([m[1] for m in maths], open(jp, 'w', encoding='utf-8'), ensure_ascii=False)
            js = os.path.join(td, 'k.js')
            open(js, 'w', encoding='utf-8').write(
                "const k=require(%s);const a=require(%s);const o=[];a.forEach((t,i)=>{try{k.renderToString(t,{throwOnError:true,strict:false})}catch(e){o.push([i,String(e.message).slice(0,120)])}});console.log(JSON.stringify(o));"
                % (json.dumps(kpath), json.dumps(jp)))
            r = subprocess.run([node, js], capture_output=True)
            try:
                for i, msg in json.loads(r.stdout.decode('utf-8')):
                    F.append('%s: 수식 오류 $%s$ → %s' % (maths[i][0], maths[i][1][:50], msg))
            except Exception:
                W.append('수식 검사 실행 실패: %s' % r.stderr.decode('utf-8', 'replace')[:200])
    elif maths:
        W.append('node가 없어 수식을 그려 보지 못함 ($ 짝만 확인)')
    print('검사: %s · 소단원 %d · 화면 %d · 수식 %d · 용어 %d' % (os.path.relpath(cpath), len(subs), total_screens, len(maths), len(tb.get('glossary') or [])))
    for w in W[:80]: print('△ ' + w)
    for f in F[:120]: print('✗ ' + f)
    if len(F) > 120: print('✗ … 외 %d개' % (len(F) - 120))
    if F or (a.strict and W):
        sys.exit(1)
    print('✓ 형식 이상 없음' + (' (△ %d개는 확인)' % len(W) if W else ''))


if __name__ == '__main__':
    main()

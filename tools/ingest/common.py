# -*- coding: utf-8 -*-
"""교과서 도구 공통: content.js 읽고 쓰기, 글 정리(비교용), 수식 → 글"""
import json, re, unicodedata


def load_content(path):
    s = open(path, encoding='utf-8').read()
    return json.loads(s[s.index('{'):s.rindex('}') + 1])


def save_content(path, tb, note=''):
    with open(path, 'w', encoding='utf-8') as f:
        f.write('/* %s */\n' % (note or '교과서 내용 — 수업잇기가 만든 파일. 화면 문장은 교과서 그대로 옮긴다.'))
        f.write('window.TEXTBOOK = ' + json.dumps(tb, ensure_ascii=False, indent=1) + ';\n')


def tex_plain(t):
    x = str(t); prev = None
    while x != prev:
        prev = x
        x = re.sub(r'\\(d|t)?frac\{([^{}]*)\}\{([^{}]*)\}', r'\2/\3', x)
        x = re.sub(r'\\sqrt\{([^{}]*)\}', r'√\1', x)
        x = re.sub(r'\\(overline|mathrm|text|vec|overrightarrow|operatorname|mathbf)\{([^{}]*)\}', r'\2', x)
    rep = [(r'\\iff', '⇔'), (r'\\neq', '+'), (r'\\(begin|end)\{?(aligned|cases)\}?|&|\\q?quad|\\!|\\ |\\Updownarrow', ''), (r'\\sqrt\s*(\d)', r'√\1'), (r'\^\{?\\circ\}?', '°'), (r'\\theta', 'θ'), (r'\\alpha', 'α'), (r'\\beta', 'β'), (r'\\pi', 'π'),
           (r'\\times', '×'), (r'\\cdots', '⋯'), (r'\\cdot', '·'), (r'\\perp', '⊥'), (r'\\pm', '±'), (r'\\square', '□'), (r'\\angle', '∠'), (r'\\leq?(?![a-z])', '≤'), (r'\\geq?(?![a-z])', '≥'), (r'\\(cos|sin|tan|log)', r'\1'), (r'\\left|\\right|\\,|\\;', ''),
           (r'\^2', '²'), (r'\^3', '³'), (r'[{}]', ''), (r'\\', '')]
    for a, b in rep:
        x = re.sub(a, b, x)
    return x


def plain(s):
    s = re.sub(r'\$\$?([^$]+)\$\$?', lambda m: tex_plain(m.group(1)), str(s or ''))
    return re.sub(r'\[\[|\]\]|\*\*|==|__', '', s)


def norm(s):
    """비교용: 모양이 달라도 같은 글이면 같게 (띄어쓰기·문장부호·전각·수식 기호 차이 무시)"""
    s = re.sub('[²³_⑴-⒇]', '', plain(s))   # ⑴ ⑵ 번호도 뺀다(답 줄의 번호 위치가 달라도 같게)   # 위첨자(제곱·벡터 화살표 글꼴)와 아래첨자 표시는 비교에서 뺀다 — PDF 수식 글꼴에서는 둘을 구별할 수 없다
    s = unicodedata.normalize('NFKC', s).lower()
    s = s.replace('α', 'a').replace('β', 'b').replace('√', '').replace('…', '').replace('⋯', '')   # 수식 글꼴의 α는 a로 찍힌다 · 줄임표
    s = s.replace('′', "'").replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"')
    s = re.sub(r'[\s\.,·•:;!?"\'()\[\]{}<>「」『』〈〉《》\-–—~=+×÷/\\|°]', '', s)
    return s


def all_text(tb, page_from=None, page_to=None):
    """content의 모든 글(화면·블록·용어)을 한 덩어리로. 쪽 범위를 주면 그 쪽을 가진 화면만."""
    out = []

    def walk(v):
        if isinstance(v, str):
            out.append(v)
        elif isinstance(v, list):
            for x in v: walk(x)
        elif isinstance(v, dict):
            for k, x in v.items():
                if k in ('svg', 'theme', 'props', 'src', 'id', 'lab', 'icon', 'grade'):
                    continue
                walk(x)

    def screens(nodes):
        for n in nodes or []:
            for s in n.get('screens', []) or []:
                pg = s.get('pages') or []
                if page_from is None or any(page_from <= p <= page_to for p in pg) or not pg:
                    walk(s)
            screens(n.get('children'))
    screens(tb.get('units'))
    return out


_HYEQ_DIG = dict(zip('!@#$%^&*()', '1234567890'))


def pdf_fix(t):
    """PDF 글자 레이어의 '수식 글꼴' 표기(한글 교과서에 흔한 HY 수식 글꼴)를 보통 글로 되돌린다 — 비교용.
    a² · aø → a (벡터 화살표), AB³ → AB (화살표), ABÓ → AB (선분 윗줄), xÛ` → x², ;2!; → 1/2, "Ã · ' → √, HjK → ⇔, _ → ×, Ñ → ±"""
    x = str(t)
    x = re.sub(r';(\d+)([!@#$%^&*()]+);', lambda m: ''.join(_HYEQ_DIG[c] for c in m.group(2)) + '/' + m.group(1), x)
    x = re.sub(r'(?<=[A-Za-z0-9])[²³øÓ]', '', x)
    x = x.translate(str.maketrans({'Á': '1', 'ª': '2', '£': '3', '¡': '1', '™': '2', 'Õ': ''}))   # 아래첨자 글꼴 a₁ a₂ a₃ (그림 글자는 ¡ ™)
    x = x.replace('Û', '²').replace('Ü', '³').replace('"Ã', '√').replace("'", '√')
    x = re.sub(r'Hj+K', '⇔', x)
    x = re.sub(r'[\x00-\x1f​-‏⁠-]', '', x)   # 수식 글꼴이 남기는 제어 문자·폭 없는 문자·사용자 정의 기호(∥ 등)
    x = x.replace('Ã', '').replace('¶', '').replace('É', '≤').replace('Ê', '≥')   # 근호 속 두 자리 수 표시 · 부등호
    x = x.replace('ù', '°').replace('¾', '≥').replace('Ú', 'i')   # 도(°) · 크거나 같다 · 로마 숫자 (i)
    x = re.sub(r'(^|\s)²', r'\1ii', x); x = re.sub(r'(^|\s)³', r'\1iii', x)   # 줄 앞의 (ii) (iii)
    x = re.sub(r'(?<![A-Za-z])(i{1,3})h(?=[=<>≤≥])', r'\1θ', x)   # (i)θ=0° 처럼 붙은 것
    x = re.sub(r'(?<![A-Za-z/])h(?![A-Za-z])', 'θ', x).replace('cosh', 'cosθ')   # 수식 글꼴의 θ는 h로 찍힌다
    return x.replace('`', '').replace('_', '×').replace('Ñ', '±')

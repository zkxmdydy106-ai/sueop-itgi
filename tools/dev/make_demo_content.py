# -*- coding: utf-8 -*-
"""엔진 시험용 예시 교과서(가상)를 만든다 → engine/demo-content/
실제 교과서가 아니라 이 프로젝트에서 새로 쓴 글과 그림이다. (저작권 걱정 없이 엔진을 시험하기 위한 것)
사용: python tools/dev/make_demo_content.py
"""
import json, os, sys, textwrap

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'engine', 'demo-content')

# ── 교과서 그림 톤의 SVG (주황·민트 반투명 평면, 검은 선, 기울인 세리프 표기) ──
LBL = 'font-family="Times New Roman, Georgia, serif" font-style="italic" fill="#17191B"'
def plane(pts, fill, op=0.55):
    return '<polygon points="%s" fill="%s" fill-opacity="%s" stroke="#17191B" stroke-width="2"/>' % (pts, fill, op)
ORANGE, MINT = '#F6B98E', '#9FD9C0'

FIG_SUN = ('<svg viewBox="0 0 520 380" role="img" aria-label="햇빛과 판자의 그림자">'
  '<circle cx="80" cy="60" r="30" fill="#FFD25E" stroke="#17191B" stroke-width="2"/>'
  + ''.join('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#E6A532" stroke-width="2" stroke-dasharray="6 6"/>' % (x, 40, x, 250) for x in (220, 280, 340, 400))
  + plane('40,300 470,300 510,360 80,360', MINT, 0.7)
  + '<polygon points="210,250 410,250 430,180 230,180" fill="#C98B5C" stroke="#17191B" stroke-width="2"/>'
  + '<polygon points="235,315 425,315 437,343 247,343" fill="#17191B" fill-opacity="0.35"/>'
  + '<text x="455" y="352" %s font-size="26">α</text>' % LBL
  + '<text x="330" y="215" font-family="sans-serif" font-size="18" fill="#17191B">판자</text>'
  + '<text x="300" y="336" font-family="sans-serif" font-size="18" fill="#17191B">그림자</text></svg>')

FIG_POINT = ('<svg viewBox="0 0 480 340" role="img" aria-label="점 P의 평면 위로의 정사영">'
  + plane('40,220 380,220 450,320 110,320', ORANGE)
  + '<line x1="245" y1="60" x2="245" y2="270" stroke="#17191B" stroke-width="2" stroke-dasharray="7 6"/>'
  + '<polyline points="245,252 263,252 263,270" fill="none" stroke="#17191B" stroke-width="2"/>'
  + '<circle cx="245" cy="60" r="6" fill="#17191B"/><circle cx="245" cy="270" r="6" fill="#17191B"/>'
  + '<text x="258" y="58" %s font-size="30">P</text><text x="210" y="300" %s font-size="30">P′</text>' % (LBL, LBL)
  + '<text x="410" y="308" %s font-size="30">α</text></svg>' % LBL)

FIG_SEG = ('<svg viewBox="0 0 520 340" role="img" aria-label="선분 AB와 그 정사영 A′B′">'
  + plane('30,210 400,210 490,320 120,320', MINT)
  + '<line x1="150" y1="250" x2="400" y2="250" stroke="#17191B" stroke-width="3"/>'
  + '<line x1="150" y1="120" x2="400" y2="60" stroke="#D2416B" stroke-width="4"/>'
  + '<line x1="150" y1="120" x2="150" y2="250" stroke="#17191B" stroke-width="2" stroke-dasharray="7 6"/>'
  + '<line x1="400" y1="60" x2="400" y2="250" stroke="#17191B" stroke-width="2" stroke-dasharray="7 6"/>'
  + '<line x1="150" y1="120" x2="400" y2="120" stroke="#17191B" stroke-width="1.5" stroke-dasharray="3 5"/>'
  + '<path d="M215 120 A65 65 0 0 0 212 105" fill="none" stroke="#17191B" stroke-width="2"/>'
  + '<text x="222" y="113" %s font-size="24">θ</text>' % LBL
  + '<text x="122" y="118" %s font-size="30">A</text><text x="410" y="58" %s font-size="30">B</text>' % (LBL, LBL)
  + '<text x="112" y="268" %s font-size="30">A′</text><text x="410" y="270" %s font-size="30">B′</text>' % (LBL, LBL)
  + '<text x="455" y="308" %s font-size="30">α</text></svg>' % LBL)

FIG_AREA = ('<svg viewBox="0 0 520 380" role="img" aria-label="평면 β 위의 삼각형과 평면 α 위로의 정사영">'
  + plane('60,150 360,150 440,40 140,40', ORANGE)
  + plane('40,250 380,250 470,360 130,360', MINT)
  + '<polygon points="170,135 330,120 260,62" fill="#5AA9D6" fill-opacity="0.65" stroke="#17191B" stroke-width="2"/>'
  + '<polygon points="170,325 330,315 262,280" fill="#2E6F97" fill-opacity="0.5" stroke="#17191B" stroke-width="2"/>'
  + ''.join('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="#17191B" stroke-width="1.6" stroke-dasharray="6 6"/>' % (x1, y1, x2, y2) for (x1, y1, x2, y2) in ((170, 135, 170, 325), (330, 120, 330, 315), (260, 62, 262, 280)))
  + '<text x="400" y="70" %s font-size="30">β</text><text x="430" y="350" %s font-size="30">α</text>' % (LBL, LBL)
  + '<text x="236" y="112" %s font-size="26">S</text><text x="236" y="314" %s font-size="26">S′</text></svg>' % (LBL, LBL))

def mini(kind):
    base = plane('10,110 190,110 230,160 50,160', MINT)
    if kind == 'par':
        seg = '<line x1="60" y1="60" x2="170" y2="60" stroke="#D2416B" stroke-width="4"/><line x1="60" y1="135" x2="170" y2="135" stroke="#17191B" stroke-width="3"/>'
        dash = ''.join('<line x1="%d" y1="60" x2="%d" y2="135" stroke="#17191B" stroke-width="1.5" stroke-dasharray="5 5"/>' % (x, x) for x in (60, 170))
    elif kind == 'tilt':
        seg = '<line x1="60" y1="75" x2="170" y2="25" stroke="#D2416B" stroke-width="4"/><line x1="60" y1="135" x2="170" y2="135" stroke="#17191B" stroke-width="3"/>'
        dash = '<line x1="60" y1="75" x2="60" y2="135" stroke="#17191B" stroke-width="1.5" stroke-dasharray="5 5"/><line x1="170" y1="25" x2="170" y2="135" stroke="#17191B" stroke-width="1.5" stroke-dasharray="5 5"/>'
    else:
        seg = '<line x1="115" y1="20" x2="115" y2="95" stroke="#D2416B" stroke-width="4"/><circle cx="115" cy="135" r="6" fill="#17191B"/>'
        dash = '<line x1="115" y1="95" x2="115" y2="135" stroke="#17191B" stroke-width="1.5" stroke-dasharray="5 5"/>'
    return '<svg viewBox="0 0 240 170" role="img" aria-label="선분의 정사영">' + base + dash + seg + '</svg>'

THEME = {'plane': ORANGE, 'plane2': MINT, 'line': '#17191B', 'accent': '#D2416B', 'shape': '#5AA9D6', 'label': 'serif-italic'}

screens = [
  {'id': 'u2-1-3.s1', 'kind': 'open', 'step': 'STEP 1 · 생각 열기', 'chip': '생각 열기', 'title': '그림자는 언제 가장 넓을까', 'pages': [72],
   'blocks': [{'t': 'cols', 'ratio': [5, 4], 'cols': [[
       {'t': 'p', 'x': '한낮에 햇빛이 땅에 거의 수직으로 비칠 때, 운동장에 판자를 들고 서 있다고 하자.'},
       {'t': 'act', 'label': '생각 열기', 'items': ['판자를 땅과 평행하게 들면, 그림자의 넓이는 판자의 넓이와 비교하여 어떠한가?', '판자를 조금씩 세우면 그림자는 어떻게 변하는가?', '판자가 땅과 수직이 되면 그림자는 어떤 모양이 되는가?']}],
     [{'t': 'fig', 'svg': FIG_SUN, 'cap': '수직으로 비치는 햇빛과 판자의 그림자'},
      {'t': 'lab', 'lab': 'projection', 'label': '3D로 돌려 보기', 'desc': '판자를 기울이며 그림자 넓이 보기', 'props': {'mode': 'area', 'angle': 20}, 'theme': THEME}]]}]},
  {'id': 'u2-1-3.s2', 'kind': 'concept', 'step': 'STEP 2 · 정사영의 뜻', 'chip': '정사영의 뜻', 'title': '정사영', 'pages': [72, 73],
   'blocks': [{'t': 'cols', 'ratio': [6, 4], 'cols': [[
       {'t': 'def', 'label': '정의', 'x': '점 P에서 평면 α에 내린 [[수선의 발]] P′을 점 P의 평면 α 위로의 [[정사영]]이라고 한다.'},
       {'t': 'def', 'label': '정의', 'x': '도형 F에 속하는 각 점의 평면 α 위로의 정사영 전체로 이루어진 도형 F′을 도형 F의 평면 α 위로의 정사영이라고 한다.'},
       {'t': 'note', 'label': '참고', 'x': '정사영은 빛이 평면에 [[수직]]으로 비칠 때 생기는 그림자로 생각할 수 있다.', 'r': 1}],
     [{'t': 'fig', 'svg': FIG_POINT, 'cap': '점 P의 평면 α 위로의 정사영 P′'}]]}]},
  {'id': 'u2-1-3.s3', 'kind': 'concept', 'step': 'STEP 2 · 정사영의 뜻', 'chip': '선분의 정사영', 'title': '선분의 정사영은 어떤 모양일까', 'pages': [73],
   'blocks': [{'t': 'p', 'x': '선분 AB의 평면 α 위로의 정사영은 선분 AB와 평면 α의 위치 관계에 따라 다음과 같다.'},
     {'t': 'cols', 'ratio': [1, 1, 1], 'cols': [
       [{'t': 'fig', 'svg': mini('par'), 'cap': '평면과 평행할 때 → 길이가 같은 선분'}],
       [{'t': 'fig', 'svg': mini('tilt'), 'cap': '기울어져 있을 때 → 길이가 짧아진 선분'}],
       [{'t': 'fig', 'svg': mini('perp'), 'cap': '평면과 수직일 때 → [[점]]'}]]},
     {'t': 'lab', 'lab': 'projection', 'label': '3D로 돌려 보기', 'desc': '선분을 기울이며 정사영 보기', 'props': {'mode': 'segment', 'angle': 35}, 'theme': THEME}]},
  {'id': 'u2-1-3.s4', 'kind': 'concept', 'step': 'STEP 3 · 정사영의 길이', 'chip': '정사영의 길이', 'title': '정사영의 길이', 'pages': [74],
   'blocks': [{'t': 'cols', 'ratio': [6, 5], 'cols': [[
       {'t': 'def', 'label': '성질', 'kind': 'law', 'x': '선분 AB와 평면 α가 [[이루는 각]]의 크기를 θ라고 할 때, 선분 AB의 평면 α 위로의 정사영 A′B′의 길이는\n$$\\overline{\\mathrm{A\'B\'}}=\\overline{\\mathrm{AB}}\\cos\\theta$$'},
       {'t': 'p', 'x': '$\\theta=0^\\circ$이면 정사영의 길이는 처음과 같고, $\\theta=90^\\circ$이면 정사영은 점이 된다.', 'r': 1}],
     [{'t': 'fig', 'svg': FIG_SEG, 'cap': '선분 AB와 정사영 A′B′'},
      {'t': 'lab', 'lab': 'projection', 'label': '3D로 돌려 보기', 'desc': 'θ를 바꾸며 길이 비교하기', 'props': {'mode': 'segment', 'angle': 30}, 'theme': THEME}]]}]},
  {'id': 'u2-1-3.s5', 'kind': 'problem', 'step': 'STEP 3 · 정사영의 길이', 'chip': '예제 1 · 문제 1', 'title': '정사영의 길이 구하기', 'pages': [74],
   'blocks': [{'t': 'ex', 'label': '예제 1', 'page': 74, 'q': '길이가 10인 선분 AB와 평면 α가 이루는 각의 크기가 $60^\\circ$일 때, 선분 AB의 평면 α 위로의 정사영의 길이를 구하시오.',
               'sol': ['정사영의 길이는 $\\overline{\\mathrm{AB}}\\cos\\theta$이므로', '$10\\cos 60^\\circ=10\\times\\dfrac{1}{2}=5$'], 'ans': '5'},
              {'t': 'prob', 'label': '문제 1', 'page': 74, 'q': '길이가 8인 선분과 평면이 이루는 각의 크기가 $30^\\circ$일 때, 이 선분의 평면 위로의 정사영의 길이를 구하시오.',
               'grade': {'type': 'num', 'key': '4√3|4\\sqrt3|4\\sqrt{3}'}, 'ans': '$4\\sqrt{3}$', 'sol': ['$8\\cos 30^\\circ=8\\times\\dfrac{\\sqrt3}{2}$']}]},
  {'id': 'u2-1-3.s6', 'kind': 'concept', 'step': 'STEP 3 · 정사영의 넓이', 'chip': '정사영의 넓이', 'title': '정사영의 넓이', 'pages': [75],
   'blocks': [{'t': 'cols', 'ratio': [6, 5], 'cols': [[
       {'t': 'def', 'label': '성질', 'kind': 'law', 'x': '평면 β 위의 도형의 넓이를 S, 이 도형의 평면 α 위로의 정사영의 넓이를 S′이라고 하자. 두 평면 α, β가 이루는 각의 크기가 θ일 때\n$$S\'=S\\cos\\theta$$'},
       {'t': 'note', 'label': '참고', 'x': '두 평면이 이루는 각은 [[이면각]] 중 크기가 $90^\\circ$ 이하인 것이다.', 'r': 1}],
     [{'t': 'fig', 'svg': FIG_AREA, 'cap': '평면 β 위의 삼각형과 그 정사영'},
      {'t': 'lab', 'lab': 'projection', 'label': '3D로 돌려 보기', 'desc': '평면을 기울이며 넓이 비교하기', 'props': {'mode': 'area', 'angle': 40}, 'theme': THEME}]]}]},
  {'id': 'u2-1-3.s7', 'kind': 'problem', 'step': 'STEP 3 · 정사영의 넓이', 'chip': '예제 2 · 문제 2', 'title': '정사영의 넓이 구하기', 'pages': [75],
   'blocks': [{'t': 'ex', 'label': '예제 2', 'page': 75, 'q': '넓이가 12인 삼각형 ABC를 품은 평면과 평면 α가 이루는 각의 크기가 $45^\\circ$일 때, 삼각형 ABC의 평면 α 위로의 정사영의 넓이를 구하시오.',
               'sol': ['$S\'=S\\cos\\theta=12\\cos45^\\circ$', '$=12\\times\\dfrac{\\sqrt2}{2}=6\\sqrt2$'], 'ans': '$6\\sqrt2$'},
              {'t': 'prob', 'label': '문제 2', 'page': 75, 'q': '한 변의 길이가 2인 정사각형의 평면 α 위로의 정사영의 넓이가 2일 때, 정사각형을 품은 평면과 평면 α가 이루는 각의 크기 θ를 구하시오. (단, $0^\\circ\\le\\theta\\le90^\\circ$)',
               'grade': {'type': 'text', 'key': '60°|60|60도'}, 'ans': '$60^\\circ$', 'sol': ['$4\\cos\\theta=2$이므로 $\\cos\\theta=\\dfrac12$']}]},
  {'id': 'u2-1-3.s8', 'kind': 'problem', 'step': '확인 문제', 'chip': '확인 3 · 4', 'title': '스스로 확인하기', 'pages': [76],
   'blocks': [{'t': 'prob', 'label': '문제 3', 'page': 76, 'q': '다음 문장이 옳으면 O, 옳지 않으면 X를 고르시오.\n“평면 위의 원의 정사영은 항상 원이다.”', 'grade': {'type': 'ox', 'key': 'X'}, 'ans': 'X — 두 평면이 기울어져 있으면 타원이 된다.'},
              {'t': 'prob', 'label': '문제 4', 'page': 76, 'q': '넓이가 20인 도형의 평면 α 위로의 정사영의 넓이가 10일 때, 두 평면이 이루는 각의 크기는?',
               'grade': {'type': 'choice', 'key': '2', 'choices': ['$30^\\circ$', '$45^\\circ$', '$60^\\circ$', '$90^\\circ$']}, 'ans': '$60^\\circ$'}]},
  {'id': 'u2-1-3.s9', 'kind': 'activity', 'step': '함께 탐구', 'chip': '모둠 탐구', 'title': '그림자 넓이 실험', 'pages': [76],
   'blocks': [{'t': 'act', 'label': '함께 탐구', 'group': True, 'title': '종이 그림자로 $S\\cos\\theta$ 확인하기', 'x': '모눈종이 한 장과 손전등(또는 휴대폰 불빛)을 준비한다.',
               'items': ['종이를 바닥과 평행하게 들고 위에서 수직으로 빛을 비추어 그림자의 넓이를 잰다.', '종이를 $30^\\circ$, $45^\\circ$, $60^\\circ$ 기울여 그림자의 넓이를 각각 잰다.', '잰 값과 $S\\cos\\theta$로 계산한 값을 비교하고, 차이가 생긴 까닭을 모둠에서 이야기한다.']},
              {'t': 'lab', 'lab': 'projection', 'label': '실험 전에 3D로 미리 보기', 'desc': '빛의 방향과 그림자', 'props': {'mode': 'area', 'angle': 45}, 'theme': THEME}]},
  {'id': 'u2-1-3.s10', 'kind': 'summary', 'step': 'STEP 4 · 정리', 'chip': '정리', 'title': '오늘 배운 것', 'pages': [76],
   'blocks': [{'t': 'viz', 'kind': 'flow', 'stepwise': True, 'title': '정사영의 크기를 구하는 순서', 'steps': [{'t': '무엇을 어디에 내리는지 확인', 'd': '선분인가, 도형인가? 어느 평면 위로?'}, {'t': '이루는 각 θ 찾기', 'd': '선분과 평면, 또는 두 평면이 이루는 각'}, {'t': '$\\cos\\theta$ 곱하기', 'd': '길이는 $\\overline{\\mathrm{AB}}\\cos\\theta$, 넓이는 $S\\cos\\theta$'}]},
              {'t': 'list', 'items': ['점 P에서 평면 α에 내린 수선의 발 P′이 점 P의 [[정사영]]이다.', '선분 AB의 정사영의 길이: $\\overline{\\mathrm{A\'B\'}}=\\overline{\\mathrm{AB}}\\cos\\theta$', '도형의 정사영의 넓이: $S\'=S\\cos\\theta$', 'θ가 커질수록 정사영은 작아지고, $\\theta=90^\\circ$이면 선분의 정사영은 점, 도형의 정사영은 선분이 된다.']}]}
]

subunit = {
  'id': 'u2-1-3', 'no': '03', 'title': '정사영', 'pages': [72, 76],
  'standards': [{'code': '[예시]', 'text': '정사영의 뜻을 알고, 정사영의 길이와 넓이를 구할 수 있다.', 'can': '정사영의 뜻을 설명하고 길이와 넓이를 구할 수 있어요'}],
  'keywords': ['정사영', '수선의 발', '이루는 각', '이면각'],
  'explore': [
    {'fields': ['공학·기술', '자연과학'], 'page': 76, 'from': '함께 탐구 · 그림자 넓이 실험', 'idea': '태양광 패널의 기울기에 따라 받는 햇빛의 양이 어떻게 달라지는지 $\\cos\\theta$로 설명하기', 'q': '우리 지역의 계절별 태양 고도에서 패널을 몇 도 기울여야 가장 많은 빛을 받을까?'},
    {'fields': ['의약·보건'], 'page': 72, 'from': '정사영의 뜻', 'idea': 'X선 사진은 몸속 구조를 필름 평면에 투영한 영상이다. 같은 뼈도 찍는 각도에 따라 길이가 달라 보이는 까닭 탐구', 'q': 'X선 사진에서 기울어진 뼈의 실제 길이를 어떻게 추정할 수 있을까?'},
    {'fields': ['예술·디자인', '공학·기술'], 'page': 73, 'from': '선분의 정사영', 'idea': '건축 도면(평면도·입면도)이 정사영으로 그려지는 원리 탐구', 'q': '평면도만 보고 경사 지붕의 실제 넓이를 구하려면 무엇을 더 알아야 할까?'},
    {'fields': ['IT·인공지능'], 'page': 74, 'from': '정사영의 길이', 'idea': '3D 게임 화면에서 그림자를 계산하는 방법과 정사영의 관계', 'q': '게임 속 캐릭터의 그림자는 어떤 계산으로 그려질까?'},
    {'fields': ['체육·스포츠', '교육'], 'page': 72, 'from': '생각 열기', 'idea': '해의 높이에 따라 달라지는 경기장 그림자와 선수의 시야', 'q': '오후 경기에서 그림자가 가장 길어지는 시각은 언제일까?'},
    {'fields': ['경영·경제', '인문·사회'], 'page': 75, 'from': '정사영의 넓이', 'idea': '지도 위 넓이와 경사진 땅의 실제 넓이 차이(토지 면적 계산)', 'q': '경사진 과수원의 지도 면적과 실제 면적은 얼마나 다를까?'}],
  'practice': [
    {'q': '길이가 6인 선분과 평면이 이루는 각의 크기가 $60^\\circ$일 때, 이 선분의 정사영의 길이를 구하시오.', 'key': '3', 'mode': 'num', 'page': 74, 'screen': 'u2-1-3.s4', 'sol': ['$6\\cos60^\\circ$']},
    {'q': '넓이가 $8\\sqrt3$인 도형의 정사영의 넓이가 12일 때, 두 평면이 이루는 각의 크기 θ를 구하시오.', 'key': '30°|30|30도', 'mode': 'text', 'page': 75, 'screen': 'u2-1-3.s6', 'sol': ['$8\\sqrt3\\cos\\theta=12$']}],
  'screens': screens}

TB = {
  'meta': {'title': '예시 교과서 · 기하', 'subject': '수학', 'course': '기하', 'publisher': '엔진 시험용 예시 (실제 교과서 아님)', 'curriculum': '2022 개정',
           'source': '이 예시는 수업잇기가 엔진 시험을 위해 새로 쓴 글과 그림입니다.', 'demo': True},
  'pages': {'pattern': 'pages/p{n}.webp', 'pad': 3, 'from': 70, 'to': 77, 'ratio': 1.414, 'pairing': 'even-left'},
  'units': [{'id': 'u2', 'no': 'Ⅱ', 'title': '공간도형과 공간좌표', 'children': [{'id': 'u2-1', 'no': '1', 'title': '공간도형', 'children': [subunit]}]}],
  'hotspots': {'74': [{'x': 0.06, 'y': 0.4, 'w': 0.6, 'h': 0.12, 'lab': 'projection', 'label': '3D로 보기', 'title': '정사영의 길이', 'props': {'mode': 'segment', 'angle': 30}, 'theme': THEME}],
               '75': [{'x': 0.06, 'y': 0.4, 'w': 0.6, 'h': 0.12, 'lab': 'projection', 'label': '3D로 보기', 'title': '정사영의 넓이', 'props': {'mode': 'area', 'angle': 40}, 'theme': THEME}]},
  'glossary': [{'term': '정사영', 'screen': 'u2-1-3.s2', 'page': 72, 'def': '점 P에서 평면 α에 내린 수선의 발 P′을 점 P의 평면 α 위로의 정사영이라고 한다.'},
               {'term': '수선의 발', 'screen': 'u2-1-3.s2', 'page': 72, 'def': '한 점에서 직선이나 평면에 수직으로 그은 선이 만나는 점.'},
               {'term': '이루는 각', 'screen': 'u2-1-3.s4', 'page': 74, 'def': '선분과 평면, 또는 두 평면이 만나 이루는 각 가운데 크기가 $90^\\circ$ 이하인 것.'},
               {'term': '정사영의 길이', 'screen': 'u2-1-3.s4', 'page': 74, 'def': '$\\overline{\\mathrm{A\'B\'}}=\\overline{\\mathrm{AB}}\\cos\\theta$'},
               {'term': '정사영의 넓이', 'screen': 'u2-1-3.s6', 'page': 75, 'def': "$S'=S\\cos\\theta$"},
               {'term': '이면각', 'screen': 'u2-1-3.s6', 'page': 75, 'def': '두 평면이 만나는 직선에서 두 반평면이 이루는 도형.'},
               {'term': '수직', 'screen': 'u2-1-3.s2', 'page': 72, 'def': '두 직선이나 직선과 평면이 직각으로 만나는 것.'}]
}

def write_content():
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'content.js'), 'w', encoding='utf-8') as f:
        f.write('/* 엔진 시험용 예시 교과서 — 실제 교과서가 아닙니다. tools/dev/make_demo_content.py 로 만듦 */\n')
        f.write('window.TEXTBOOK = ' + json.dumps(TB, ensure_ascii=False, indent=1) + ';\n')

def write_pages():
    """원본 쪽 이미지 흉내(가상): 각 쪽에 해당 화면 글을 교과서 판형으로 찍는다."""
    from PIL import Image, ImageDraw, ImageFont
    import re
    os.makedirs(os.path.join(OUT, 'pages'), exist_ok=True)
    W, H = 1240, 1754
    fr = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 30, index=1)
    fb = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 52, index=1)
    fs = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 24, index=1)
    clean = lambda s: re.sub(r'\$+([^$]+)\$+', lambda m: m.group(1).replace('\\overline', '').replace('\\mathrm', '').replace('\\cos', 'cos').replace('\\theta', 'θ').replace('^\\circ', '°').replace('\\dfrac', '').replace('\\times', '×').replace('\\le', '≤').replace('{', '').replace('}', '').replace('\\', ''), s).replace('[[', '').replace(']]', '')
    TB['lines'] = {}; TB['terms'] = {}
    terms = [g['term'] for g in TB['glossary']]
    for n in range(TB['pages']['from'], TB['pages']['to'] + 1):
        im = Image.new('RGB', (W, H), '#FFFDF8'); d = ImageDraw.Draw(im)
        L = TB['lines'].setdefault(str(n), [])
        def rec(x, y, text, font):
            b = d.textbbox((x, y), text, font=font)
            L.append([round(b[0] / W, 4), round(b[1] / H, 4), round((b[2] - b[0]) / W, 4), round((b[3] - b[1]) / H, 4), text])
            for t in terms:
                i = text.find(t)
                if i >= 0:
                    x0 = d.textbbox((x, y), text[:i], font=font)[2] if i else b[0]; x1 = d.textbbox((x, y), text[:i + len(t)], font=font)[2]
                    TB['terms'].setdefault(str(n), []).append([round(x0 / W, 4), round(b[1] / H, 4), round((x1 - x0) / W, 4), round((b[3] - b[1]) / H, 4), t])
        d.rectangle([0, 0, W, 90], fill='#F6B98E' if n % 2 else '#9FD9C0')
        d.text((80 if n % 2 == 0 else W - 420, 26), 'Ⅱ. 공간도형과 공간좌표', font=fs, fill='#17191B')
        y = 160
        scr = [s for s in screens if n in s['pages']]
        if not scr:
            d.text((100, y), '(예시 교과서 %d쪽 — 이 소단원 앞뒤 쪽)' % n, font=fr, fill='#868B8F')
        for s in scr:
            d.text((100, y), clean(s['title']), font=fb, fill='#17191B'); rec(100, y, clean(s['title']), fb); y += 90
            def walk(blocks):
                nonlocal y
                for b in blocks:
                    if b.get('cols'):
                        for c in b['cols']: walk(c)
                        continue
                    txt = b.get('x') or b.get('q') or ''
                    if b.get('items'): txt += '\n' + '\n'.join('· ' + i for i in b['items'])
                    if b['t'] == 'fig': txt = '[그림] ' + (b.get('cap') or '')
                    if b['t'] == 'lab': continue
                    if b.get('label'): txt = b['label'] + '  ' + txt
                    for para in clean(txt).split('\n'):
                        for line in textwrap.wrap(para, 34) or ['']:
                            if y > H - 160: return
                            d.text((100, y), line, font=fr, fill='#17191B'); rec(100, y, line, fr); y += 48
                    y += 18
            walk(s['blocks']); y += 30
        # 쪽마다 용어는 한 번만, 겹치면 긴 용어 우선 (밑줄이 난잡해지지 않게)
        tl = sorted(TB['terms'].get(str(n), []), key=lambda t: (-len(t[4])))
        keep = []
        for t in tl:
            if any(k[4] == t[4] for k in keep): continue
            if any(abs(k[1] - t[1]) < 0.005 and not (t[0] + t[2] <= k[0] or k[0] + k[2] <= t[0]) for k in keep): continue
            keep.append(t)
        if keep: TB['terms'][str(n)] = keep
        d.text((W // 2 - 20, H - 90), str(n), font=fr, fill='#17191B')
        d.text((100, H - 60), '엔진 시험용 예시 — 실제 교과서가 아닙니다', font=fs, fill='#B0B3B6')
        im.save(os.path.join(OUT, 'pages', 'p%03d.webp' % n), 'WEBP', quality=80)

if __name__ == '__main__':
    write_pages(); write_content(); print('예시 교과서를 만들었습니다 →', OUT)

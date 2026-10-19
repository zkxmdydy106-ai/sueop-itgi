# -*- coding: utf-8 -*-
"""엔진 자동 시험 — 한 번에 전부. (깃허브에 올릴 때마다 .github/workflows/check.yml 이 이것을 돌린다)

사용:  python tools/verify/selftest.py            (전부)
       python tools/verify/selftest.py --fast     (문법·단위 시험만, 브라우저 흐름 빼고)

하는 일 (실제 교과서 없이 engine/demo-content 의 가상 소단원으로):
  1. 엔진 JS 문법 (node --check)
  2. 시험용 교과서 폴더 만들기 → 작업물/_엔진시험 (저장소에 올라가지 않음)
  3. content 형식 검사 (check_content.py)  ✗ 0
  4. 단위 시험: 브라우저에서 엔진 함수(채점·서버 저장 규칙·답 칸·판서 색)를 직접 불러 기대값과 비교
  5. 버튼 흐름 (flows.py --quick): 학습지·묻기·모둠·판서·탐구 그림·학생 제출 + 인쇄물 글자 검사
하나라도 ✗ 이면 끝 코드 1.
"""
import argparse, asyncio, glob, os, shutil, subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
COURSE = os.path.join(ROOT, '작업물', '_엔진시험')
PY = sys.executable

# 단위 시험: [이름, JS 식(참이어야 함)]
UNIT = [
    ['정답 비교: 띄어쓰기·벡터 화살표 무시', "DT.norm('(1, 2)') === DT.norm('(1,2)') && DT.norm('\\\\vec{a}') === DT.norm('a')"],
    ['서버 저장 규칙: 배열 안의 배열은 막는다', "(() => { try { DT.fsCheck({ a: [[1, 2]] }); return false; } catch (e) { return true; } })()"],
    ['서버 저장 규칙: 보통 기록은 통과', "(() => { try { DT.fsCheck({ a: [1, 2], b: { c: 'x' } }); return true; } catch (e) { return false; } })()"],
    ['답 칸: 좌표 답은 (□,□) 두 칸', "DT.ansFields('(2,3)').el.querySelectorAll('input,[contenteditable]').length >= 2"],
    ['답 칸: 이름 붙은 답 m=…, n=…', "DT.ansFields('m=2, n=3').el.querySelectorAll('input,[contenteditable]').length >= 2"],
    ['판서 색: 6칸', "DT.ink.palette.paper.length === 6 && DT.ink.palette.chalk.length === 6"],
    ['판서 색: 종류별 색 묶음', "DT.ink.colorSets.length >= 4 && DT.ink.colorSets.every((s) => s[1].length >= 6)"],
    ['탐구 그림: 모형이 칠판 고리를 단다', "typeof DT.lab.onOpen === 'function'"],
    ['수식이 글자로 남지 않음', "!/\\$|\\\\frac/.test(DT.plain('$\\\\frac{1}{2}$ 와 **굵게**'))"],
]


def run(cmd, label):
    print('› ' + label)
    r = subprocess.run(cmd, cwd=ROOT)
    return r.returncode == 0


def make_course():
    if os.path.exists(os.path.join(COURSE, 'app')):
        ok = run([PY, 'tools/build/new_course.py', '_엔진시험', '--update-engine'], '시험용 교과서 엔진 갱신')
    else:
        ok = run([PY, 'tools/build/new_course.py', '_엔진시험', '--subject', '수학', '--course', '엔진시험', '--publisher', '가상'], '시험용 교과서 만들기')
    src = os.path.join(ROOT, 'engine', 'demo-content'); dst = os.path.join(COURSE, 'content')
    shutil.copytree(src, dst, dirs_exist_ok=True)
    return ok


async def unit_tests():
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from flows import serve
    from playwright.async_api import async_playwright
    base = 'http://127.0.0.1:%d/app/' % serve(COURSE)
    bad = []
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        async def h(route):
            r = await route.fetch(); t = await r.text(); await route.fulfill(response=r, body=t.replace("mode: 'firebase'", "mode: 'demo'"))
        await ctx.route('**/config.js', h); await ctx.add_init_script("try{localStorage.setItem('dt.board.coached','true')}catch(e){}")
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(base + 'board.html'); await pg.wait_for_timeout(4000)
        for name, expr in UNIT:
            try:
                ok = await pg.evaluate(expr)
            except Exception as e:
                ok = False; name += ' (' + str(e).split('\n')[0][:80] + ')'
            print(('  ✓ ' if ok else '  ✗ ') + name)
            if not ok: bad.append(name)
        bad += ['페이지 오류: ' + e for e in errs]
        await b.close()
    return bad


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--fast', action='store_true'); a = ap.parse_args()
    fails = []
    # 1. 문법
    if shutil.which('node'):
        js = sorted(glob.glob(os.path.join(ROOT, 'engine', 'app', 'assets', 'js', '**', '*.js'), recursive=True))
        bad = [f for f in js if subprocess.run(['node', '--check', f], capture_output=True).returncode != 0]
        print('› 엔진 JS 문법 %d개 — %s' % (len(js), '✓' if not bad else '✗ ' + ', '.join(os.path.basename(x) for x in bad)))
        fails += ['문법: ' + os.path.basename(x) for x in bad]
    else:
        print('› node가 없어 문법 검사는 건너뜀')
    # 2~3. 시험용 교과서 + 형식
    if not make_course(): fails.append('시험용 교과서 만들기')
    if not run([PY, 'tools/verify/check_content.py', COURSE], 'content 형식 검사'): fails.append('content 형식')
    # 4. 단위
    print('› 단위 시험')
    fails += asyncio.run(unit_tests())
    # 5. 흐름
    if not a.fast and not run([PY, 'tools/verify/flows.py', COURSE, '--quick'], '버튼 흐름 (flows.py --quick)'): fails.append('버튼 흐름')
    print('-' * 40)
    if fails:
        print('✗ %d개 실패' % len(fails)); [print('  - ' + f) for f in fails]; sys.exit(1)
    print('✓ 엔진 시험 모두 통과')


if __name__ == '__main__':
    main()

# -*- coding: utf-8 -*-
"""기능 점검 — 화면을 보는 것(audit_app)이 아니라 버튼을 실제로 눌러 본다.
체험 모드에서 돌리지만, 저장할 때마다 실제 서버(Firestore)와 같은 규칙(DT.fsCheck)으로 검사하므로
'체험에선 되는데 실제 반에선 조용히 안 되는' 오류를 미리 잡는다.

  선생님: 학습지 보내기(소단원 × 종류 모두) · 직접 만들기(내 문제 4종) · 복습 · 모든 메뉴 · 학습지 결과 탭
  칠판:   학생에게 묻기(직접 · 문제에서) · 모둠 만들기 · 수업 마치기 · 판서
  학생:   받은 학습지를 모두 열고 아무 답이나 넣어 제출 · 내 기록 · 오답 노트

사용:  python tools/verify/flows.py "작업물/기하_지학사"
결과: ✗(오류) 0 이어야 한다. 페이지 오류·콘솔 오류·빨간 알림(toast--bad)을 모두 오류로 센다.
"""
import argparse, asyncio, http.server, os, socketserver, sys, threading

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
from playwright.async_api import async_playwright

IGNORE = ('ERR_CONNECTION_REFUSED', 'favicon', 'gstatic.com', 'Failed to load resource')


def serve(root):
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k): super().__init__(*a, directory=root, **k)
        def log_message(self, *a): pass
    class S(socketserver.ThreadingTCPServer): daemon_threads = True; allow_reuse_address = True; request_queue_size = 256
    srv = S(('127.0.0.1', 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv.server_address[1]


async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('course'); ap.add_argument('--quick', action='store_true', help='소단원 2개만')
    a = ap.parse_args()
    course = os.path.abspath(a.course); base = 'http://127.0.0.1:%d/app/' % serve(course)
    errs = []; steps = []

    async def demo(ctx):
        async def h(route):
            r = await route.fetch(); t = await r.text()
            await route.fulfill(response=r, body=t.replace("mode: 'firebase'", "mode: 'demo'"))
        await ctx.route('**/config.js', h)
        await ctx.add_init_script("try{localStorage.setItem('dt.board.coached','true')}catch(e){}")

    def watch(pg, where):
        pg.on('pageerror', lambda e: errs.append('[%s] 페이지 오류: %s' % (where, e)))
        pg.on('console', lambda m: m.type == 'error' and not any(x in m.text for x in IGNORE) and errs.append('[%s] 콘솔: %s' % (where, m.text[:200])))

    async def bad_toasts(pg, where):
        try: ts = await pg.eval_on_selector_all('.toast--bad', 'els => els.map(e => e.textContent)')
        except Exception: ts = []
        for t in ts:
            if t and ('[%s] 알림: %s' % (where, t)) not in errs: errs.append('[%s] 알림: %s' % (where, t))

    async def step(name, coro, pg, where):
        try:
            await coro
            steps.append('✓ ' + name)
        except Exception as e:
            errs.append('[%s] %s 실패: %s' % (where, name, str(e).split('\n')[0][:160]))
        await bad_toasts(pg, where)

    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900}); await demo(ctx)
        # ── 선생님 화면: 학습지 보내기 (모든 소단원 × 모든 종류) ──
        t = await ctx.new_page(); watch(t, '선생님')
        await t.goto(base + 'teacher.html?v=home'); await t.wait_for_timeout(5000)
        await t.evaluate("localStorage.setItem('dt.t.class', JSON.stringify(null))")
        subs = await t.evaluate("DT.render.flatten(window.TEXTBOOK || {units:[]})._subunits ? 0 : 0")
        await t.click('text=학습지 보내기'); await t.wait_for_timeout(600)
        opts = await t.eval_on_selector_all('.modal select.select option', 'os => os.map(o => o.value)')
        kinds = await t.eval_on_selector_all('.modal .chip', 'cs => cs.map(c => c.textContent.replace(/추천/, "").trim())')
        await t.click('.modal__foot >> text=닫기')
        if a.quick: opts = opts[:2]
        for sv in opts:
            for k in kinds:
                async def send(sv=sv, k=k):
                    await t.click('text=학습지 보내기'); await t.wait_for_timeout(300)
                    await t.select_option('.modal select.select', sv); await t.wait_for_timeout(150)
                    await t.click('.modal .chip:has-text("%s")' % k); await t.wait_for_timeout(150)
                    empty = await t.evaluate("(document.querySelector('.wiz__prev')||{}).textContent||''")
                    if '없어요' in empty: await t.click('.modal__foot >> text=닫기'); return
                    await t.click('.modal__foot .btn--ink'); await t.wait_for_timeout(700)
                    if await t.is_visible('.modal'): await t.keyboard.press('Escape')
                await step('보내기 %s · %s' % (sv, k), send(), t, '선생님')
        # 직접 만들기: 내 문제 4종 + 보내기
        async def custom():
            await t.click('text=학습지 보내기'); await t.wait_for_timeout(300)
            await t.click('text=직접 만들기·고치기'); await t.wait_for_timeout(600)
            await t.click('.chip:has-text("내 문제 쓰기")')
            for typ, fill in [('short', ['6']), ('choice', ['1', '2', '3']), ('ox', []), ('open', [])]:
                await t.select_option('.wse-form select >> nth=0', typ)
                await t.click('.wse-rich'); await t.keyboard.type('시험 문제 ' + typ + ' ')
                if typ == 'short':
                    await t.click('.wse-math .chip[title="벡터"]'); await t.click('.modal__foot >> text=넣기')
                    if await t.is_visible('text=교과서에서 지문 가져오기'):
                        await t.click('text=교과서에서 지문 가져오기'); await t.wait_for_timeout(300)
                        if await t.is_visible('.wse-psg button'): await t.click('.wse-psg button >> nth=0')
                        if await t.is_visible('.modal__foot >> text=고른 문장 넣기'): await t.click('.modal__foot >> text=고른 문장 넣기')
                        await t.wait_for_timeout(300)
                for i, v in enumerate(fill): await t.fill('.wse-form input >> nth=%d' % i, v)
                await t.click('text=학습지에 넣기'); await t.wait_for_timeout(150)
            await t.click('.modal__foot .btn--ink'); await t.wait_for_timeout(800)
        await step('직접 만들기 보내기', custom(), t, '선생님')
        # 메뉴 전부 + 학습지 결과 탭
        for v in ['home', 'worksheets', 'students', 'standards', 'lessons', 'export', 'settings']:
            async def view(v=v):
                await t.goto(base + 'teacher.html?v=' + v); await t.wait_for_timeout(1800)
                if v == 'worksheets':
                    for tab in ['답 확인하기', '안 낸 학생', '전체 결과']:
                        if await t.is_visible('text=' + tab): await t.click('text=' + tab); await t.wait_for_timeout(400)
                if v == 'students' and await t.is_visible('.scard'): await t.click('.scard >> nth=0'); await t.wait_for_timeout(800)
            await step('선생님 메뉴 ' + v, view(), t, '선생님')
        async def review():
            await t.goto(base + 'teacher.html?v=worksheets'); await t.wait_for_timeout(1500)
            if await t.is_visible('text=틀린 학생에게 복습'):
                await t.click('text=틀린 학생에게 복습'); await t.wait_for_timeout(500)
                if await t.is_visible('.modal__foot .btn--ink'): await t.click('.modal__foot .btn--ink'); await t.wait_for_timeout(800)
        await step('복습 보내기', review(), t, '선생님')

        # ── 칠판 ──
        bd = await ctx.new_page(); watch(bd, '칠판')
        await bd.goto(base + 'board.html'); await bd.wait_for_timeout(5000)
        if await bd.is_visible('.classpick'): await bd.click('.classpick button >> nth=0'); await bd.wait_for_timeout(1000)
        async def tool(label, then=None):
            await bd.click('#btnTools'); await bd.wait_for_timeout(300); await bd.click('.toolmenu >> text=' + label); await bd.wait_for_timeout(800)
            if then: await then()
        async def ask_direct():
            for typ in ['O / X', '①②③④⑤ 고르기', '짧은 답']:
                await tool('학생에게 묻기'); await bd.click('.modal .chip:has-text("%s")' % typ); await bd.click('.modal__foot >> text=보내기'); await bd.wait_for_timeout(800)
                for x in ['응답 마감', '정답 공개']:
                    if await bd.is_visible('text=' + x): await bd.click('text=' + x); await bd.wait_for_timeout(300)
                await bd.keyboard.press('Escape')
        await step('학생에게 묻기 (직접)', ask_direct(), bd, '칠판')
        # 문제가 있는 화면에서 「학생에게 묻기」
        ids = await bd.evaluate("(() => { const tb = DT.render.flatten(window.TEXTBOOK || {}); return [] })()")
        async def ask_from_probs():
            n = 0
            for _ in range(60):
                btn = await bd.query_selector('.b-actions .obtn--ink, .obtn.obtn--ink:has-text("학생에게 묻기")')
                if btn and await btn.is_visible():
                    await btn.click(); await bd.wait_for_timeout(700); n += 1; await bd.keyboard.press('Escape')
                    if n >= (3 if a.quick else 8): break
                await bd.keyboard.press('ArrowRight'); await bd.wait_for_timeout(250)
        await step('학생에게 묻기 (문제에서)', ask_from_probs(), bd, '칠판')
        async def groups():
            await tool('모둠 만들기')
            for x in ['다시 섞기', '저장', '이대로', '확정', '닫기']:
                el = await bd.query_selector('.overlay button:has-text("%s")' % x)
                if el and await el.is_visible(): await el.click(); await bd.wait_for_timeout(400)
            await bd.keyboard.press('Escape')
        await step('모둠 만들기', groups(), bd, '칠판')
        async def ink():
            await bd.click('.inkbar__main'); await bd.mouse.move(600, 500); await bd.mouse.down(); await bd.mouse.move(800, 560, steps=6); await bd.mouse.up(); await bd.wait_for_timeout(300)
            await bd.click('.inkbar__mini'); await bd.click('.inkbar__main'); await bd.keyboard.press('Escape')
        await step('판서', ink(), bd, '칠판')
        async def end():
            await tool('수업 마치기'); await bd.click('.modal__foot .btn--ink'); await bd.wait_for_timeout(800)
        await step('수업 마치기', end(), bd, '칠판')

        # ── 학생 ──
        st = await ctx.new_page(); watch(st, '학생')
        await st.set_viewport_size({'width': 1180, 'height': 820})
        await st.goto(base + 'student.html'); await st.wait_for_timeout(4000)
        if await st.is_visible('.pickgrid button'): await st.click('.pickgrid button >> nth=0'); await st.wait_for_timeout(2000)
        n_as = len(await st.query_selector_all('.witem'))
        for i in range(min(n_as, 6 if a.quick else 40)):
            async def solve(i=i):
                await st.goto(base + 'student.html'); await st.wait_for_timeout(1500)
                if await st.is_visible('.pickgrid button'): await st.click('.pickgrid button >> nth=0'); await st.wait_for_timeout(1500)
                items = await st.query_selector_all('.witem')
                if i >= len(items): return
                await items[i].click(); await st.wait_for_timeout(900)
                for _ in range(25):   # 한 문항씩: 아무 답이나 넣고 다음
                    for sel in ['.ox button', '.choice', '.bank button', '.pickrow button', '.levels button']:
                        el = await st.query_selector(sel)
                        if el and await el.is_visible(): await el.click(); await st.wait_for_timeout(80)
                    for inp in await st.query_selector_all('.st-main input.input, .st-main textarea'):
                        if await inp.is_visible() and await inp.is_editable(): await inp.fill('3')
                    nxt = await st.query_selector('.st-foot button:has-text("다음")')
                    if nxt and await nxt.is_visible() and await nxt.is_enabled(): await nxt.click(); await st.wait_for_timeout(200)
                    else: break
                sub = await st.query_selector('.st-foot button:has-text("제출하기")')
                if sub and await sub.is_visible():
                    await sub.click(); await st.wait_for_timeout(600)
                    if await st.is_visible('.modal__foot .btn--ink, .modal__foot .btn--accent'): await st.click('.modal__foot .btn--ink, .modal__foot .btn--accent'); await st.wait_for_timeout(800)
            await step('학생 학습지 %d' % (i + 1), solve(), st, '학생')
        # 수식·태그가 글자로 찍히면 안 된다: 인쇄물(학생용·정답)과 편집기 화면의 글자에서 $·\명령·<u> 찾기
        raw = await t.evaluate(r"""(async () => { const tb = DT.render.flatten(await DT.data.getCourse()); const bad = [];
          const RX = /\$[^$\s]|\\(frac|vec|overrightarrow|overline|mathrm|sqrt|cdot|theta|circ|times)\b|<\/?u>|<\/?b>|\[\[|\]\]/;
          for (const u of tb._subunits) { const ids = u.screens.map((x) => x.id);
            for (const w of [DT.ws.compile(tb, ids), DT.ws.build(tb, ids, 'concept'), DT.ws.build(tb, ids, 'practice'), DT.ws.build(tb, ids, 'exit')]) {
              for (const ans of [false, true]) { const el = DT.ws.paper(w, { answers: ans, sections: true }); document.body.append(el); const m = el.innerText.match(RX); if (m) bad.push(u.title + (ans ? ' 정답' : ' 학생용') + ': ' + el.innerText.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\n/g, ' ')); el.remove(); } } }
          return bad.slice(0, 8); })()""")
        for r in raw: errs.append('[인쇄] 글자로 찍힌 수식·태그: ' + r)
        # 실제로 일이 일어났는지 (아무것도 못 눌렀는데 '오류 없음'이 되지 않게)
        stat = await t.evaluate("(async () => { const a = await DT.data.listAssignments({}); const s = await DT.data.listSubmissions({}); const l = await DT.data.listLessons({}); return { 학습지: a.length, 제출: s.filter(x => x.submittedAt).length, 일지: l.length }; })()")
        print('만든 것:', stat)
        if stat['학습지'] < 5 or stat['제출'] < 1: errs.append('점검이 거의 아무것도 하지 못했어요 (버튼을 못 찾음?) %s' % stat)
        await b.close()

    print('누른 단계 %d개' % len(steps))
    if errs:
        print('✗ 오류 %d개' % len(errs))
        for e in errs[:60]: print('  ' + e)
        sys.exit(1)
    print('✓ 오류 없음')


if __name__ == '__main__':
    asyncio.run(main())

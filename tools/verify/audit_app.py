# -*- coding: utf-8 -*-
"""교과서 앱 전체 점검 — 실제 브라우저로 모든 화면을 열어 본다 (스크롤 0 · 넘침 · 오류 · 스크린샷)

사용:  python tools/verify/audit_app.py "작업물/기하_비상" [--screens u2-1-3.s1,u2-1-3.s2] [--shots]
검사:
  1) 전자칠판(1920×1080): 화면마다 글자를 줄여도 넘쳐서 전체를 축소했는지(scale) → 0.9 미만이면 ✗ 화면을 나눌 것
  2) 콘솔 오류 0
  3) 학생 화면(아이패드 1180×820, 820×1180, 휴대폰 390×844): 가로·세로 넘침 0 (페이지 스크롤이 생기면 ✗)
  4) 선생님 화면(1366×768, 1920×1080): 넘침 0
  --shots: .review/ 에 스크린샷 저장 → 반드시 Read로 열어 눈으로 본다
필요: pip install playwright && python -m playwright install chromium
"""
import argparse, asyncio, http.server, json, os, socketserver, sys, threading

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
try:
    from playwright.async_api import async_playwright
except ImportError:
    print('playwright가 없어요 →  pip install playwright && python -m playwright install chromium'); sys.exit(2)


def serve(root):
    class H(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *a, **k): super().__init__(*a, directory=root, **k)
        def log_message(self, *a): pass
    class S(socketserver.ThreadingTCPServer):
        daemon_threads = True; request_queue_size = 128   # 윈도우: 한꺼번에 오는 스크립트 요청을 거절하지 않게
    srv = S(('127.0.0.1', 0), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv.server_address[1]


async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('course'); ap.add_argument('--screens'); ap.add_argument('--shots', action='store_true'); ap.add_argument('--min-scale', type=float, default=0.9)
    a = ap.parse_args()
    root = os.path.abspath(a.course); port = serve(root); base = 'http://127.0.0.1:%d/app/' % port
    shots = os.path.join(root, '.review'); os.makedirs(shots, exist_ok=True)
    fails = []; warns = []

    async def demo_mode(context):   # 배포된(firebase) 교과서도 점검은 이 PC의 content로 — config.js의 mode만 demo로 바꿔 읽는다
        async def handle(route):
            r = await route.fetch(); t = await r.text()
            await route.fulfill(response=r, body=t.replace("mode: 'firebase'", "mode: 'demo'"))
        await context.route('**/config.js', handle)

    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1920, 'height': 1080})
        await ctx.add_init_script("try{localStorage.setItem('dt.board.coached','true')}catch(e){}")
        await demo_mode(ctx)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
        await pg.goto(base + 'board.html?class=none'); await pg.wait_for_timeout(1500)
        ids = await pg.evaluate("() => (window.TEXTBOOK && window.TEXTBOOK._screens || []).map(s => s.id)")
        if a.screens:
            ids = [i for i in ids if i in a.screens.split(',')]
        if not ids:
            fails.append('화면이 하나도 없어요 (content.js 확인)')
        for sid in ids:
            await pg.goto(base + 'board.html?class=none&s=' + sid)
            try:
                await pg.wait_for_function("() => { const p = document.querySelector('#sheet .page'); return p && p.dataset.scale; }", timeout=8000)
            except Exception:
                pass
            try:   # 그림이 모두 뜬 뒤(엔진이 그때 다시 맞춘다)에 잰다
                await pg.wait_for_function("() => [...document.querySelectorAll('#sheet img')].every(i => i.complete && i.naturalWidth)", timeout=6000)
            except Exception:
                warns.append('%s: 그림을 6초 안에 불러오지 못함' % sid)
            await pg.wait_for_timeout(400)
            r = await pg.evaluate("() => { const p = document.querySelector('#sheet .page'); return p ? { scale: +p.dataset.scale, fs: +p.dataset.fit, blank: !p.textContent.trim() } : null }")
            if not r:
                fails.append('%s: 화면이 그려지지 않음' % sid); continue
            if r['scale'] < a.min_scale:
                fails.append('%s: 넘침 → 전체 %.0f%%로 축소됨. 화면을 둘로 나누거나 그림을 줄일 것' % (sid, r['scale'] * 100))
            elif r['fs'] < 0.8:
                warns.append('%s: 글자를 %.0f%%로 줄여서 맞춤 (5m 뒤에서 읽기 어려울 수 있음)' % (sid, r['fs'] * 100))
            if a.shots:
                await pg.screenshot(path=os.path.join(shots, 'board_%s.png' % sid.replace('.', '_')))
        for e in set(errs):
            fails.append('전자칠판 오류: ' + e[:160])
        for url, sizes in (('student.html', [(1180, 820), (820, 1180), (390, 844)]), ('teacher.html', [(1366, 768), (1920, 1080)]), ('index.html', [(390, 844), (1366, 768)])):
            for w, h in sizes:
                c2 = await b.new_context(viewport={'width': w, 'height': h}); await demo_mode(c2); p2 = await c2.new_page(); e2 = []
                p2.on('pageerror', lambda e: e2.append(str(e)))
                await p2.goto(base + url); await p2.wait_for_timeout(1200)
                ov = await p2.evaluate("() => ({ x: document.documentElement.scrollWidth - innerWidth, y: document.documentElement.scrollHeight - innerHeight })")
                if ov['x'] > 1 or ov['y'] > 1:
                    fails.append('%s %dx%d: 화면 밖으로 넘침 (가로 %dpx, 세로 %dpx)' % (url, w, h, ov['x'], ov['y']))
                for e in e2:
                    fails.append('%s %dx%d 오류: %s' % (url, w, h, e[:160]))
                if a.shots:
                    await p2.screenshot(path=os.path.join(shots, '%s_%dx%d.png' % (url.split('.')[0], w, h)))
                await c2.close()
        await b.close()
    print('화면 %d개 점검' % len(ids))
    for w in warns: print('△ ' + w)
    for f in fails: print('✗ ' + f)
    if a.shots: print('스크린샷: %s  ← Read로 열어 눈으로 확인' % shots)
    if fails: sys.exit(1)
    print('✓ 넘침·오류 없음')


if __name__ == '__main__':
    asyncio.run(main())

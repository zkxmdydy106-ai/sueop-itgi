# -*- coding: utf-8 -*-
"""웹앱 화면을 여러 폭으로 찍어 디자인 검토용 스크린샷을 만든다.  문서: ../SKILL.md

사용법:
  python shoot.py <html 파일 또는 http(s) 주소> [--out 폴더] [--widths 390,820,1366] [--board] [--print] [--dark] [--full]

  --widths : 찍을 폭 (기본 390,820,1366). 전자칠판형이면 1920 추가.
  --board  : 1920x1080 전자칠판 화면도 찍는다.
  --print  : 인쇄 미디어로 A4 폭(794px) 화면을 찍는다.
  --dark   : prefers-color-scheme: dark 로도 찍는다.
  --full   : 화면 전체 길이(full page)로 찍는다. 기본은 첫 화면(접힘 위).
  --out    : 저장 폴더. 기본은 대상 파일 옆 .review/

결과: <out>/<이름>-<폭>.png 와 shots.json(콘솔 오류·가로 넘침·글꼴 로드 결과).
playwright가 없으면 설치 방법을 알려 주고 종료 코드 3.
"""
import json, os, sys, time

try:
    sys.stdout.reconfigure(encoding="utf-8"); sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


def args(argv):
    a = {"target": None, "out": None, "widths": [390, 820, 1366], "board": False, "print": False, "dark": False, "full": False}
    it = iter(argv)
    for x in it:
        if x == "--out": a["out"] = next(it)
        elif x == "--widths": a["widths"] = [int(w) for w in next(it).split(",") if w.strip()]
        elif x == "--board": a["board"] = True
        elif x == "--print": a["print"] = True
        elif x == "--dark": a["dark"] = True
        elif x == "--full": a["full"] = True
        elif a["target"] is None: a["target"] = x
    return a


PROBE = """() => {
  const de = document.documentElement;
  const over = de.scrollWidth - de.clientWidth;
  const fonts = [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/["']/g,''));
  const used = getComputedStyle(document.body).fontFamily;
  const small = [...document.querySelectorAll('button, a, input, select, [role=button]')]
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 32 || r.width < 32); }).length;
  return { overflowPx: over, fontsLoaded: [...new Set(fonts)], bodyFont: used, smallTargets: small, title: document.title };
}"""


def main():
    a = args(sys.argv[1:])
    if not a["target"]:
        print(__doc__); sys.exit(1)
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright가 없습니다 → 한 번만 설치:\n  pip install playwright\n  python -m playwright install chromium", file=sys.stderr)
        sys.exit(3)
    t = a["target"]
    is_url = t.startswith("http://") or t.startswith("https://")
    url = t if is_url else "file:///" + os.path.abspath(t).replace("\\", "/").lstrip("/")
    base = "page" if is_url else os.path.splitext(os.path.basename(t))[0]
    out = a["out"] or (os.path.join(os.path.dirname(os.path.abspath(t)), ".review") if not is_url else ".review")
    os.makedirs(out, exist_ok=True)

    plans = [(w, 900 if w < 600 else (1180 if w == 820 else 860), "screen", "light") for w in a["widths"]]
    if a["board"]: plans.append((1920, 1080, "screen", "light"))
    if a["dark"]: plans += [(w, h, "screen", "dark") for (w, h, _, _) in list(plans)]
    if a["print"]: plans.append((794, 1123, "print", "light"))

    report = []
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        for (w, h, media, scheme) in plans:
            ctx = br.new_context(viewport={"width": w, "height": h}, device_scale_factor=2 if w <= 1366 else 1,
                                 color_scheme=scheme, has_touch=w < 1200, locale="ko-KR")
            pg = ctx.new_page()
            errs = []
            pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
            pg.on("console", lambda m, errs=errs: errs.append(m.text) if m.type == "error" else None)
            try:
                pg.goto(url, wait_until="networkidle", timeout=20000)
            except Exception as e:
                errs.append("열기 지연/실패: %s" % e)
            pg.emulate_media(media=media, color_scheme=scheme)
            try:
                pg.evaluate("document.fonts.ready")
            except Exception:
                pass
            time.sleep(0.4)
            tag = "%s-%d%s%s" % (base, w, "-print" if media == "print" else "", "-dark" if scheme == "dark" else "")
            path = os.path.join(out, tag + ".png")
            pg.screenshot(path=path, full_page=a["full"] or media == "print")
            info = pg.evaluate(PROBE)
            info.update({"shot": path, "width": w, "media": media, "scheme": scheme, "errors": errs[:10]})
            report.append(info)
            ctx.close()
        br.close()

    json.dump(report, open(os.path.join(out, "shots.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    bad = 0
    for r in report:
        flags = []
        if r["overflowPx"] > 1: flags.append("가로 넘침 %dpx" % r["overflowPx"]); bad += 1
        if r["errors"]: flags.append("오류 %d건: %s" % (len(r["errors"]), r["errors"][0][:120])); bad += 1
        if r["width"] < 1200 and r["smallTargets"]: flags.append("32px보다 작은 터치 대상 %d개" % r["smallTargets"])
        if not r["fontsLoaded"]: flags.append("웹글꼴 로드 없음(시스템 글꼴로 보임) — 의도인지 확인")
        print("%s  %s" % (r["shot"], " / ".join(flags) if flags else "이상 없음"))
    print("\n이제 Read 도구로 위 PNG를 열어 눈으로 본다 (design-review 스킬 §2 기준).")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()

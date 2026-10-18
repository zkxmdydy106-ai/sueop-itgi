# -*- coding: utf-8 -*-
"""웹앱(HTML·Apps Script) 산출물 검증기.  문서: ../SKILL.md §5

사용법:
  python verify_webapp.py <파일 또는 폴더> [...] [--render]

  - 폴더(또는 파일이 든 폴더) 단위로 .html/.htm/.gs/.js 를 모아 검사한다. 파일 사이 연결(서버 함수, 화면 파일 이름)도 본다.
  - --render : playwright(파이썬)가 설치돼 있으면 휴대폰(390px)·아이패드(1180px) 너비로 실제로 열어
               스크립트 오류와 가로 넘침을 확인한다. 없으면 건너뛰고 그 사실을 알린다.
  - 표준 라이브러리만 쓴다. node 가 있으면 인라인 스크립트 문법도 검사한다.

판정: ✗(FAIL) 하나라도 있으면 종료 코드 1.  △(WARN)은 사람이 확인할 항목이며 종료 코드에 영향 없음.
각 검사에는 코드가 붙는다(H=HTML 공통, J=스크립트, G=Apps Script, P=미리보기, R=렌더). selftest_webapp.py 가 이 코드로 검출 여부를 확인한다.
"""
import os, re, sys, json, shutil, subprocess, tempfile
from html.parser import HTMLParser

try:
    sys.stdout.reconfigure(encoding="utf-8"); sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

WEB_EXT = (".html", ".htm", ".gs", ".js")
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
OPTIONAL_CLOSE = {"p", "li", "td", "th", "tr", "thead", "tbody", "tfoot", "option", "optgroup", "dt", "dd", "colgroup", "caption", "rt", "rp"}
IMPLICIT = {"html", "head", "body"}
SVG_VOID_OK = {"path", "circle", "rect", "line", "polyline", "polygon", "ellipse", "stop", "use", "image"}


class Finding:
    __slots__ = ("level", "code", "file", "line", "msg")

    def __init__(s, level, code, file, line, msg):
        s.level, s.code, s.file, s.line, s.msg = level, code, file, line, msg

    def __str__(s):
        mark = {"FAIL": "✗", "WARN": "△", "INFO": "·"}[s.level]
        where = os.path.basename(s.file) + (":%d" % s.line if s.line else "")
        return "  %s [%s] %s — %s" % (mark, s.code, where, s.msg)


# ---------------------------------------------------------------- HTML 파싱
class Page(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True)
        s.stack, s.problems, s.ids, s.hidden_els = [], [], {}, []
        s.scripts, s.styles, s.links, s.srcs = [], [], [], []
        s.viewport = False
        s._cur_script = None
        s._cur_style = None

    def handle_starttag(s, tag, attrs):
        a = dict(attrs)
        line = s.getpos()[0]
        if "id" in a and a["id"]:
            s.ids.setdefault(a["id"], []).append(line)
        if "hidden" in a:
            s.hidden_els.append((tag, (a.get("class") or "").split(), a.get("id"), line))
        if tag == "meta" and (a.get("name") or "").lower() == "viewport":
            s.viewport = True
        if tag == "a" and a.get("href") is not None:
            s.links.append((a.get("href"), a.get("target"), line))
        if tag == "script":
            if a.get("src"):
                s.srcs.append((a["src"], line))
            else:
                s._cur_script = {"type": (a.get("type") or "").lower(), "line": line, "text": ""}
        if tag == "link" and a.get("href"):
            s.srcs.append((a["href"], line))
        if tag == "style":
            s._cur_style = ""
        if tag in VOID:
            return
        s.stack.append((tag, line))

    def handle_startendtag(s, tag, attrs):
        # <x/> : 자기 닫힘. 스택에 넣지 않는다.
        a = dict(attrs)
        if "id" in a and a["id"]:
            s.ids.setdefault(a["id"], []).append(s.getpos()[0])

    def handle_endtag(s, tag):
        line = s.getpos()[0]
        if tag == "script" and s._cur_script is not None:
            s.scripts.append(s._cur_script); s._cur_script = None
        if tag == "style" and s._cur_style is not None:
            s.styles.append(s._cur_style); s._cur_style = None
        if tag in VOID:
            return
        if not any(t == tag for t, _ in s.stack):
            if tag not in IMPLICIT and tag not in OPTIONAL_CLOSE:
                s.problems.append((line, "닫는 태그 </%s> 의 여는 태그가 없음" % tag))
            return
        while s.stack:
            t, l = s.stack.pop()
            if t == tag:
                break
            if t not in OPTIONAL_CLOSE and t not in IMPLICIT and t not in SVG_VOID_OK:
                s.problems.append((l, "<%s> 가 닫히지 않은 채 </%s> 를 만남" % (t, tag)))

    def handle_data(s, data):
        if s._cur_script is not None:
            s._cur_script["text"] += data
        if s._cur_style is not None:
            s._cur_style += data

    def close_check(s):
        for t, l in s.stack:
            if t not in OPTIONAL_CLOSE and t not in IMPLICIT and t not in SVG_VOID_OK:
                s.problems.append((l, "<%s> 가 끝까지 닫히지 않음" % t))


# ---------------------------------------------------------------- 도우미
def read(p):
    with open(p, encoding="utf-8", errors="replace") as f:
        return f.read()


def line_of(text, idx):
    return text.count("\n", 0, idx) + 1


def strip_js_comments(src):
    """문자열은 남기고 // 와 /* */ 주석만 지운다 (대략)."""
    out, i, n, q = [], 0, len(src), None
    while i < n:
        c = src[i]
        if q:
            out.append(c)
            if c == "\\" and i + 1 < n:
                out.append(src[i + 1]); i += 2; continue
            if c == q:
                q = None
            i += 1; continue
        if c in "\"'`":
            q = c; out.append(c); i += 1; continue
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            j = src.find("\n", i); i = n if j < 0 else j; continue
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            j = src.find("*/", i + 2); i = n if j < 0 else j + 2; continue
        out.append(c); i += 1
    return "".join(out)


def run_calls(js):
    """google.script.run 체인에서 호출하는 서버 함수 이름들 (with… 제외). [(이름, 위치)]"""
    res = []
    for m in re.finditer(r"google\.script\.run\b", js):
        i = m.end(); n = len(js)
        while True:
            while i < n and js[i] in " \t\r\n":
                i += 1
            if i >= n or js[i] != ".":
                break
            i += 1
            while i < n and js[i] in " \t\r\n":
                i += 1
            mm = re.match(r"[A-Za-z_$][\w$]*", js[i:])
            if not mm:
                break
            name = mm.group(0); pos = i; i += len(name)
            while i < n and js[i] in " \t\r\n":
                i += 1
            if i >= n or js[i] != "(":
                break
            depth, q = 0, None
            while i < n:
                c = js[i]
                if q:
                    if c == "\\":
                        i += 2; continue
                    if c == q:
                        q = None
                elif c in "\"'`":
                    q = c
                elif c == "(":
                    depth += 1
                elif c == ")":
                    depth -= 1
                    if depth == 0:
                        i += 1; break
                i += 1
            if not name.startswith("with"):
                res.append((name, pos))
    return res


# ---------------------------------------------------------------- 검사 본체
def check_folder(folder, files, render=False):
    F = []
    add = lambda lv, code, f, ln, msg: F.append(Finding(lv, code, f, ln, msg))
    htmls = [f for f in files if f.lower().endswith((".html", ".htm"))]
    gss = [f for f in files if f.lower().endswith(".gs")]
    all_in_folder = {os.path.basename(p).lower() for p in os.listdir(folder)} if os.path.isdir(folder) else set()

    # ---- Apps Script 서버 쪽
    server_fns, gs_text = set(), {}
    for g in gss:
        t = read(g); gs_text[g] = t
        tc = strip_js_comments(t)
        server_fns |= set(re.findall(r"^\s*function\s+([A-Za-z_$][\w$]*)\s*\(", tc, re.M))
        server_fns |= set(re.findall(r"^\s*(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*function\b", tc, re.M))
        for m in re.finditer(r"createHtmlOutputFromFile\(\s*['\"]([^'\"]+)['\"]|createTemplateFromFile\(\s*['\"]([^'\"]+)['\"]", tc):
            name = (m.group(1) or m.group(2))
            if (name + ".html").lower() not in all_in_folder and (name + ".htm").lower() not in all_in_folder:
                add("FAIL", "G3", g, line_of(tc, m.start()), "createHtmlOutputFromFile('%s') 가 여는 %s.html 이 이 폴더에 없음 (배포하면 이 화면이 열리지 않음)" % (name, name))
        if node_bin():
            ok, msg = node_check(t, ".js")
            if not ok:
                add("FAIL", "J1", g, msg[0], "서버 코드 문법 오류: " + msg[1])

    for h in htmls:
        text = read(h)
        pg = Page()
        try:
            pg.feed(text); pg.close(); pg.close_check()
        except Exception as e:
            add("FAIL", "H0", h, 0, "HTML 을 읽지 못함: %s" % e); continue
        for ln, msg in pg.problems[:8]:
            add("FAIL", "H1", h, ln, msg)
        if len(pg.problems) > 8:
            add("FAIL", "H1", h, 0, "태그 짝 문제가 %d건 더 있음" % (len(pg.problems) - 8))

        # 중복 id
        for i, lines in pg.ids.items():
            if len(lines) > 1:
                add("FAIL", "H2", h, lines[1], "id '%s' 가 %d번 쓰임 (줄 %s) — 스크립트가 엉뚱한 요소를 잡음" % (i, len(lines), ", ".join(map(str, lines[:4]))))

        js_all = "\n".join(s["text"] for s in pg.scripts)
        js = strip_js_comments(js_all)
        css = "\n".join(pg.styles)

        # 스크립트가 찾는 id 가 페이지에 있는가
        known = set(pg.ids)
        known |= set(re.findall(r"id\s*=\s*\\?[\"']([\w\-:.]+)", text))
        known |= set(re.findall(r"\.id\s*=\s*[\"']([\w\-:.]+)", text))
        refs = re.findall(r"getElementById\(\s*[\"']([\w\-:.]+)[\"']\s*\)", js)
        if re.search(r"function\s+\$\s*\(\s*(\w+)\s*\)\s*\{\s*return\s+document\.getElementById\(\s*\1\s*\)", js) or \
           re.search(r"\$\s*=\s*function\s*\(\s*(\w+)\s*\)\s*\{\s*return\s+document\.getElementById\(\s*\1\s*\)", js):
            refs += re.findall(r"(?<![\w.])\$\(\s*[\"']([\w\-:.]+)[\"']\s*\)", js)
        miss = sorted(set(r for r in refs if r not in known))
        for r in miss[:10]:
            add("FAIL", "H3", h, 0, "스크립트가 찾는 id '%s' 가 페이지 어디에도 없음 → 실행 중 오류" % r)

        # hidden 속성을 CSS display 가 덮어씀
        global_hidden = re.search(r"\[hidden\]\s*\{[^}]*display\s*:\s*none", css)
        if not global_hidden:
            for tag, classes, eid, ln in pg.hidden_els:
                sels = ["\\." + re.escape(c) for c in classes] + (["#" + re.escape(eid)] if eid else [])
                for sel in sels:
                    rule = re.search(r"(^|[}\s,])" + sel + r"\s*\{([^}]*)\}", css)
                    if rule and re.search(r"display\s*:\s*(?!none)", rule.group(2)) and not re.search(sel + r"\[hidden\]", css):
                        add("FAIL", "H4", h, ln, "hidden 으로 숨긴 <%s %s> 를 CSS '%s{display:…}' 가 다시 보이게 만듦 → '%s[hidden]{display:none}' 추가" % (tag, ("." + ".".join(classes)) if classes else "#" + str(eid), sel.replace("\\", ""), sel.replace("\\", "")))
                        break

        # 외부 자원
        for src, ln in pg.srcs:
            if src.startswith("http://"):
                add("FAIL", "H5", h, ln, "http:// 자원은 https 페이지(Apps Script·미리보기)에서 막힘: " + src)
            m = re.match(r"https://(?:cdn\.jsdelivr\.net/npm|unpkg\.com)/(@?[^/@]+(?:/[^/@]+)?)(@[^/]+)?", src)
            if m and (not m.group(2) or m.group(2) in ("@latest", "@next")):
                add("WARN", "H6", h, ln, "버전이 고정되지 않은 라이브러리: " + src)
        if not pg.viewport and "addMetaTag('viewport'" not in "".join(gs_text.values()) and 'addMetaTag("viewport"' not in "".join(gs_text.values()):
            add("WARN", "H7", h, 0, "viewport 메타가 없음 → 휴대폰에서 작게 보임")

        # 인라인 스크립트 문법
        if node_bin():
            for s in pg.scripts:
                if s["type"] and s["type"] not in ("text/javascript", "module", "application/javascript"):
                    continue
                if not s["text"].strip():
                    continue
                ok, msg = node_check(s["text"], ".mjs" if s["type"] == "module" else ".js")
                if not ok:
                    add("FAIL", "J1", h, s["line"] + msg[0] - 1, "스크립트 문법 오류: " + msg[1])

        uses_gas = "google.script" in js
        # ---- Apps Script 화면
        if uses_gas:
            if gss:
                for name, pos in run_calls(js):
                    if name not in server_fns:
                        add("FAIL", "G1", h, 0, "google.script.run.%s() 를 부르지만 이 폴더의 .gs 에 function %s 가 없음 → 버튼이 아무 일도 안 함" % (name, name))
                    elif name.endswith("_"):
                        add("FAIL", "G1", h, 0, "google.script.run.%s() — 이름이 _ 로 끝나는 함수는 화면에서 부를 수 없음" % name)
            else:
                add("INFO", "G0", h, 0, "같은 폴더에 .gs 가 없어 서버 함수 연결은 검사하지 못함")
            if re.search(r"location\.search", js) and "google.script.url" not in js:
                add("FAIL", "G2", h, 0, "Apps Script 화면은 iframe 안에서 열려 location.search 로 주소의 ?m=…&name=… 을 읽지 못함 → google.script.url.getLocation(cb) 로 읽을 것")
            if re.search(r"withSuccessHandler\(\s*function[^{]*\{[^}]{0,400}window\.open\(", js):
                add("WARN", "G4", h, 0, "서버 응답을 기다린 뒤 window.open → 아이패드 사파리가 팝업으로 막음. 링크(a href)를 미리 만들어 두는 방식 권장")
            for href, target, ln in pg.links:
                if href.startswith("?") and not target:
                    add("WARN", "G5", h, ln, "Apps Script 안의 상대 링크 '%s' 에 target 이 없음 → iframe 안에서만 바뀌거나 빈 화면. target=\"_top\" 또는 \"_blank\"" % href)

        # ---- 미리보기(claude.ai Artifact) 함정
        for m in re.finditer(r"[\"']([\w\-]+\.html?)\?[^\"']*[\"']", text):
            add("WARN", "P1", h, line_of(text, m.start()), "'%s?…' 형태의 상대 링크 — claude.ai 미리보기에서는 ? 뒤가 지워져 받는 화면이 값을 못 받음 → #해시로 넘기거나 Apps Script 전용임을 확인" % m.group(1))
        if re.search(r"qrcode\s*\(|QRCode\s*\(|qrcode-generator|qrcodejs", text):
            add("WARN", "P2", h, 0, "QR 코드를 만든다 — QR 이 열 주소가 요구사항과 같은지(누가 찍고, 무엇이 열려야 하는지) 장부와 대조할 것. 미리보기에서는 실제 배포 주소가 아님")

    # ---- 렌더 검사
    if render and htmls:
        F += render_check(htmls)
    return F


_NODE = None


def node_bin():
    global _NODE
    if _NODE is None:
        _NODE = shutil.which("node") or ""
    return _NODE


def node_check(src, ext):
    fd, p = tempfile.mkstemp(suffix=ext)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(src)
        r = subprocess.run([node_bin(), "--check", p], capture_output=True, timeout=30)
        if r.returncode == 0:
            return True, None
        out = (r.stderr or r.stdout).decode("utf-8", "replace")
        m = re.search(re.escape(os.path.basename(p)) + r":(\d+)", out)
        ln = int(m.group(1)) if m else 1
        msg = [l for l in out.splitlines() if "Error" in l]
        return False, (ln, (msg[0].strip() if msg else out.strip()[:160]))
    except Exception as e:
        return True, None
    finally:
        try:
            os.remove(p)
        except OSError:
            pass


def render_check(htmls):
    F = []
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        return [Finding("INFO", "R0", htmls[0], 0, "브라우저 렌더 검사 건너뜀 (pip install playwright && python -m playwright install chromium 하면 휴대폰·아이패드 너비로 실제로 열어 봄)")]
    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
            for h in htmls:
                for w, hgt, label in ((390, 844, "휴대폰"), (1180, 820, "아이패드")):
                    pg = b.new_page(viewport={"width": w, "height": hgt})
                    errs = []
                    pg.on("pageerror", lambda e, errs=errs: errs.append(str(e)))
                    try:
                        pg.goto("file:///" + os.path.abspath(h).replace("\\", "/"), timeout=15000)
                        pg.wait_for_timeout(1500)
                        over = pg.evaluate("() => document.documentElement.scrollWidth - window.innerWidth")
                    except Exception as e:
                        errs.append("열기 실패: %s" % e); over = 0
                    for e in errs[:3]:
                        F.append(Finding("FAIL", "R1", h, 0, "%s 너비에서 스크립트 오류: %s" % (label, e[:200])))
                    if over and over > 2:
                        F.append(Finding("FAIL", "R2", h, 0, "%s 너비(%dpx)에서 가로로 %dpx 넘침 → 옆으로 밀리는 화면" % (label, w, over)))
                    pg.close()
            b.close()
    except Exception as e:
        F.append(Finding("INFO", "R0", htmls[0], 0, "브라우저 렌더 검사 실행 실패: %s" % e))
    return F


def group(paths):
    groups = {}
    for p in paths:
        p = os.path.abspath(p)
        if os.path.isdir(p):
            fs = [os.path.join(p, f) for f in sorted(os.listdir(p)) if f.lower().endswith(WEB_EXT)]
            groups.setdefault(p, set()).update(fs)
        elif p.lower().endswith(WEB_EXT) and os.path.exists(p):
            d = os.path.dirname(p)
            # 같은 폴더의 .gs 는 연결 검사에 필요하므로 함께 본다
            groups.setdefault(d, set()).add(p)
            groups[d].update(os.path.join(d, f) for f in os.listdir(d) if f.lower().endswith(".gs"))
    return {d: sorted(fs) for d, fs in groups.items()}


def main(argv):
    render = "--render" in argv
    paths = [a for a in argv if not a.startswith("--")]
    if not paths:
        print(__doc__); return 2
    total_fail = 0
    for folder, files in group(paths).items():
        F = check_folder(folder, files, render)
        fails = [f for f in F if f.level == "FAIL"]
        warns = [f for f in F if f.level == "WARN"]
        print("검증: %s  (html %d · gs %d)" % (folder, sum(f.lower().endswith((".html", ".htm")) for f in files), sum(f.lower().endswith(".gs") for f in files)))
        for f in fails + warns + [f for f in F if f.level == "INFO"]:
            print(str(f))
        if not node_bin():
            print("  · node 가 없어 스크립트 문법 검사는 건너뜀")
        print("  %s" % ("✓ 실패 없음" if not fails else "✗ 실패 %d건" % len(fails)) + (" · 확인 필요 %d건" % len(warns) if warns else ""))
        total_fail += len(fails)
    return 1 if total_fail else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

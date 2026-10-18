# -*- coding: utf-8 -*-
"""Claude Code 훅: 수업잇기 자동 검증 (학교웹앱공방 verify_web_hook을 교과서용으로 고친 것)

post (PostToolUse, Write|Edit):
  - 작업물/<교과서>/content/content.js 를 고치면 → tools/verify/check_content.py (형식·수식·그림·모형)
  - 작업물/<교과서>/app/… 또는 engine/app/… 의 .html .js 를 고치면 → 웹앱 검증기(문법·연결)
  ✗ → 종료 코드 2 로 Claude에게 고치라고 알림.
stop (Stop): 답변 끝내기 직전, 마지막 점검 이후 바뀐 교과서·엔진을 렌더 검증(--render) + content 검사 + AI 티 검사.
  ✗가 있으면 한 번은 종료를 막는다. 화면 점검(audit_app.py --shots)과 스크린샷 보기는 별도 — 안내만 한다.
검증기가 실행되지 않는 환경이면 막지 않고 안내만 한다.
"""
import json, os, subprocess, sys, time

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
VERIFY = os.path.join(ROOT, ".claude", "skills", "school-webapp", "lib", "verify_webapp.py")
CHECK = os.path.join(ROOT, "tools", "verify", "check_content.py")
FLOWS = os.path.join(ROOT, "tools", "verify", "flows.py")   # 버튼을 실제로 눌러 보는 기능 점검 (서버 저장 규칙 포함)
LINT = os.path.join(ROOT, ".claude", "hooks", "design_lint.py")
WEB_EXT = (".html", ".htm", ".js")
SKIP_DIRS = {"node_modules", ".git", "__pycache__", ".review", "_extract", "vendor", "pages", "figs"}
WORK = os.path.join(ROOT, "작업물")
ENGINE = os.path.join(ROOT, "engine", "app")
STAMP = os.path.join(ROOT, ".claude", "verify_stamp.txt")
FIRST_LOOKBACK = 2 * 3600

try:
    sys.stderr.reconfigure(encoding="utf-8"); sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def _run(cmd, timeout):
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    try:
        r = subprocess.run(cmd, capture_output=True, timeout=timeout, env=env)
    except Exception as e:
        return None, "검증기 실행 실패: %s" % e
    return r.returncode, (r.stdout + r.stderr).decode("utf-8", "replace")


def under(p, base):
    try:
        return os.path.commonpath([os.path.abspath(p), os.path.abspath(base)]) == os.path.abspath(base)
    except ValueError:
        return False


def tail(s, n=1400):
    return s if len(s) <= n else "…" + s[-n:]


def course_of(p):
    """작업물/<교과서>/... → 작업물/<교과서>"""
    rel = os.path.relpath(os.path.abspath(p), os.path.abspath(WORK)).split(os.sep)
    return os.path.join(WORK, rel[0]) if len(rel) > 1 else None


def web(paths, render=False):
    if not os.path.exists(VERIFY):
        return "skip", "웹앱 검증기 없음"
    code, out = _run([sys.executable, VERIFY] + list(paths) + (["--render"] if render else []), 240 if render else 90)
    if code is None:
        return "skip", out
    return ("ok" if code == 0 else "fail"), out.strip()


def content_check(course):
    if not os.path.exists(CHECK) or not os.path.exists(os.path.join(course, "content", "content.js")):
        return "skip", ""
    code, out = _run([sys.executable, CHECK, course], 120)
    if code is None:
        return "skip", out
    return ("ok" if code == 0 else "fail"), out.strip()


def post(data):
    p = (data.get("tool_input") or {}).get("file_path") or ""
    if not p or not os.path.exists(p):
        sys.exit(0)
    parts = set(os.path.abspath(p).replace("\\", "/").split("/"))
    if parts & {".review", "_extract", "vendor"}:
        sys.exit(0)
    if os.path.basename(p) == "content.js" and under(p, WORK):
        st, out = content_check(course_of(p))
        if st == "fail":
            print("[교과서 검사 훅] content.js에 고칠 것이 있어요 — 고친 뒤 다시 검사하세요.\n%s" % tail(out), file=sys.stderr)
            sys.exit(2)
        sys.exit(0)
    if os.path.splitext(p)[1].lower() not in WEB_EXT or not (under(p, WORK) or under(p, ENGINE)):
        sys.exit(0)
    st, out = web([p])
    if st == "fail":
        print("[웹앱 검증 훅] %s 검증 실패 — 고친 뒤 다시 검증하세요.\n%s" % (os.path.basename(p), tail(out)), file=sys.stderr)
        sys.exit(2)
    sys.exit(0)


def changed_since(base, since):
    for d, dirs, files in os.walk(base):
        dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
        for f in files:
            if os.path.splitext(f)[1].lower() in WEB_EXT + (".css",):
                try:
                    if os.path.getmtime(os.path.join(d, f)) > since:
                        return True
                except OSError:
                    pass
    return False


def stop(data):
    try:
        since = float(open(STAMP, encoding="utf-8").read().strip())
    except Exception:
        since = time.time() - FIRST_LOOKBACK
    now = time.time()
    targets = []   # (이름, 앱 폴더, 교과서 폴더 또는 None)
    if os.path.isdir(ENGINE) and changed_since(ENGINE, since):
        targets.append(("engine", ENGINE, None))
    if os.path.isdir(WORK):
        for name in sorted(os.listdir(WORK)):
            c = os.path.join(WORK, name)
            if os.path.isdir(c) and not name.startswith(".") and changed_since(c, since):
                app = os.path.join(c, "app")
                targets.append((name, app if os.path.isdir(app) else c, c if os.path.isdir(os.path.join(c, "content")) else None))
    fails, skips, tells = [], [], 0
    for name, app, course in targets:
        st, out = web([app], render=True)
        if st == "fail":
            fails.append((name, out))
        elif st == "skip":
            skips.append(name)
        if course:
            st2, out2 = content_check(course)
            if st2 == "fail":
                fails.append((name + " content", out2))
        if os.path.exists(LINT):
            code, lo = _run([sys.executable, LINT, app], 60)
            if code == 1:
                tells += lo.count("△")
    # 엔진이 바뀌었으면 기능 점검: 화면만 보는 검증으로는 '버튼이 조용히 안 되는' 오류를 못 잡는다
    if any(n == "engine" for n, _, _ in targets) and os.path.exists(FLOWS):
        course = next((c for _, _, c in targets if c), None)
        if not course and os.path.isdir(WORK):
            course = next((os.path.join(WORK, n) for n in sorted(os.listdir(WORK)) if os.path.isdir(os.path.join(WORK, n, "content"))), None)
        if course:
            code, out = _run([sys.executable, FLOWS, course, "--quick"], 420)
            if code not in (0, None):
                fails.append(("기능 점검(flows) " + os.path.basename(course), out))
    if fails and not data.get("stop_hook_active"):
        msg = "[교과서 검증 훅] 이번 작업에서 바뀐 곳 %d개가 검증에 실패했습니다. 고치거나, 못 고치면 최종 답변에 한계를 밝히세요.\n" % len(fails)
        msg += "\n".join("· %s\n%s" % (n, tail(o, 900)) for n, o in fails)
        print(msg, file=sys.stderr)
        sys.exit(2)
    try:
        os.makedirs(os.path.dirname(STAMP), exist_ok=True)
        open(STAMP, "w", encoding="utf-8").write(str(now))
    except Exception:
        pass
    notes = []
    if fails:
        notes.append("검증 실패가 남아 있음: " + ", ".join(n for n, _ in fails))
    if skips:
        notes.append("렌더 검증 건너뜀(검증기·playwright 없음): " + ", ".join(skips))
    if targets and not fails:
        notes.append("%d곳 검증 통과" % len(targets))
    if tells:
        notes.append("AI 티 기계 검사 %d건 남음" % tells)
    if any(c for _, _, c in targets):
        notes.append("화면 넘침·스크린샷은 python tools/verify/audit_app.py 작업물/<교과서> --shots 후 Read로 확인")
    if notes:
        print(json.dumps({"systemMessage": "[교과서 검증 훅] " + " / ".join(notes)}, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    try:
        data = json.load(sys.stdin)
    except Exception:
        data = {}
    (stop if "stop" in sys.argv[1:] else post)(data)

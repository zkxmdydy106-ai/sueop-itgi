# -*- coding: utf-8 -*-
"""'AI가 만든 티' 기계 검사.  기준 문서: ../skills/school-ui-craft/references/ai-tells-ko.md (🔧 표시 항목)

사용법:
  python design_lint.py <파일 또는 폴더> [...]     # 직접 실행: 발견 목록 출력, 발견 있으면 종료 코드 1
  (훅) PostToolUse: stdin JSON의 file_path 를 검사해 발견을 Claude에게 '추가 맥락'으로 전달 (막지 않음)

허용 표시: 의도적으로 쓰는 경우 같은 줄(또는 바로 윗줄)에 `design-ok: <이유>` 주석을 달면 그 줄은 넘어간다.
"""
import json, os, re, sys

try:
    sys.stdout.reconfigure(encoding="utf-8"); sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

EXT = (".html", ".htm", ".css", ".js", ".jsx", ".tsx", ".vue", ".svelte")
SKIP_DIRS = {"node_modules", ".git", ".review", "dist", "build", "__pycache__",
             "content", "demo-content", "vendor", "_extract"}   # 교과서 글(content)은 검사하지 않는다 — 교과서 원문이라 고치면 안 됨

EMOJI = re.compile("[\U0001F300-\U0001FAFF✨✅❌⭐⚡☀-⛿]")
RULES = [
    ("C1", "보라-파랑 계열 그라데이션 (AI 기본값)",
     re.compile(r"(linear|radial)-gradient\([^)]*(#667eea|#764ba2|#6366f1|#8b5cf6|#a855f7|#7c3aed|#3b82f6|purple|violet|indigo)[^)]*\)", re.I)),
    ("C1", "보라-파랑 계열 그라데이션 (Tailwind)", re.compile(r"from-(purple|violet|indigo)-\d+[^\"']*to-(blue|pink|purple|indigo)-\d+")),
    ("C2", "backdrop-filter blur 유리 효과", re.compile(r"backdrop-filter\s*:\s*blur|backdrop-blur", re.I)),
    ("C3", "흔한 회색 그림자 rgba(0,0,0,.1) — 모든 카드에 같은 그림자인지 확인",
     re.compile(r"box-shadow\s*:\s*0\s+(4|10)px\s+(6|15|20|25)px\s+(-\d+px\s+)?rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0?\.1\s*\)", re.I)),
    ("C4", "Claude 고유 주황/크림(#D97757·#F4F1EA) — 브리프 요구가 아니면 바꿀 것", re.compile(r"#d97757|#f4f1ea", re.I)),
    ("T2", "uppercase + 넓은 자간 라벨 (한글에 의미 없음, AI 기본값)", re.compile(r"text-transform\s*:\s*uppercase|\buppercase\s+tracking-", re.I)),
    ("M1", "transition: all — 바뀌는 속성만 지정", re.compile(r"transition\s*:\s*all\b|\btransition-all\b", re.I)),
    ("A1", "outline 제거 — :focus-visible 대체 스타일이 있는지 확인", re.compile(r"outline\s*:\s*(none|0)\b", re.I)),
]
COPY = re.compile(r"(환영합니다\s*!|스마트한|손쉽게|한눈에|AI\s*기반|혁신적인|최고의 경험|Lorem ipsum|홍길동|OO고등학교|○○고)")
ARROW_BTN = re.compile(r"<(button|a)\b[^>]*>[^<]{1,40}(→|->)\s*</\1>", re.I)
FONT_DECL = re.compile(r"font-family\s*:\s*([^;}{]+)", re.I)
GENERIC_FONTS = {"inter", "roboto", "arial", "helvetica", "system-ui", "-apple-system", "sans-serif", "serif",
                 "segoe ui", "blinkmacsystemfont", "helvetica neue", "apple sd gothic neo", "malgun gothic",
                 "맑은 고딕", "monospace", "ui-sans-serif", "noto sans", "noto sans kr", "inherit", "var"}


def text_lines(path):
    try:
        return open(path, encoding="utf-8", errors="replace").read().splitlines()
    except Exception:
        return []


def lint_file(path):
    out = []
    lines = text_lines(path)
    fonts = set()
    is_markup = path.lower().endswith((".html", ".htm", ".jsx", ".tsx", ".vue", ".svelte"))
    for i, line in enumerate(lines, 1):
        prev = lines[i - 2] if i > 1 else ""
        if "design-ok" in line or "design-ok" in prev:
            continue
        for code, msg, rx in RULES:
            if rx.search(line):
                out.append((code, i, msg))
        if is_markup or path.lower().endswith(".js"):
            m = COPY.search(line)
            if m:
                out.append(("W1", i, "홍보성·가짜 문구 '%s' — 기능을 말하는 문구/실제 같은 예시로" % m.group(1)))
            if ARROW_BTN.search(line):
                out.append(("T4", i, "버튼·링크 끝 화살표(→) — 행동을 말하는 이름으로"))
            # 제목·버튼 안 이모지
            for tag in ("h1", "h2", "h3", "button", "title"):
                for mm in re.finditer(r"<%s\b[^>]*>(.*?)</%s>" % (tag, tag), line, re.I):
                    if EMOJI.search(mm.group(1)):
                        out.append(("T3", i, "<%s> 안 이모지 — 아이콘 세트(SVG) 또는 제거" % tag))
        for fm in FONT_DECL.finditer(line):
            for f in fm.group(1).split(","):
                f = f.strip().strip("'\"").lower()
                if f and not f.startswith("var("):
                    fonts.add(f)
    if fonts and fonts <= GENERIC_FONTS:
        out.append(("T1", 0, "글꼴 지정이 기본 글꼴뿐(%s) — school-ui-craft/references/fonts.md에서 앱에 맞는 한글 글꼴 선택" % ", ".join(sorted(fonts))))
    if is_markup and path.lower().endswith((".html", ".htm")):
        joined = "\n".join(lines)
        if re.search(r"<html|<body", joined, re.I) and "keep-all" not in joined:
            out.append(("T5", 0, "word-break: keep-all 없음 — 한글 단어 중간 줄바꿈"))
        if re.search(r"<html|<body", joined, re.I) and "prefers-reduced-motion" not in joined and re.search(r"animation|transition", joined):
            out.append(("M2", 0, "움직임이 있는데 prefers-reduced-motion 대응 없음"))
    return out


def collect(targets):
    files = []
    for t in targets:
        if os.path.isdir(t):
            for d, dirs, fs in os.walk(t):
                dirs[:] = [x for x in dirs if x not in SKIP_DIRS]
                files += [os.path.join(d, f) for f in fs if f.lower().endswith(EXT)]
        elif t.lower().endswith(EXT) and os.path.exists(t):
            files.append(t)
    return files


def fmt(path, items):
    return "\n".join("  △ [%s] %s%s — %s" % (c, os.path.basename(path), (":%d" % l if l else ""), m) for c, l, m in items)


def main_cli(argv):
    total = 0
    for f in collect(argv):
        items = lint_file(f)
        if items:
            total += len(items)
            print(f); print(fmt(f, items))
    print("\nAI 티 검사: %s" % ("발견 %d건 (의도라면 해당 줄에 `design-ok: 이유` 주석)" % total if total else "기계 검사 항목 이상 없음 — 나머지(👁 항목)는 스크린샷으로 확인"))
    return 1 if total else 0


def main_hook():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    p = (data.get("tool_input") or {}).get("file_path") or ""
    root = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    inside = False
    for base in (os.path.join(root, "작업물"), os.path.join(root, "engine", "app")):
        try:
            inside = inside or os.path.commonpath([os.path.abspath(p), os.path.abspath(base)]) == os.path.abspath(base)
        except ValueError:
            pass
    parts = set(os.path.abspath(p).replace("\\", "/").split("/")) if p else set()
    if not p or not inside or parts & SKIP_DIRS or not p.lower().endswith(EXT) or not os.path.exists(p):
        return 0
    items = lint_file(p)
    if not items:
        return 0
    msg = "[AI 티 검사] %s 에서 %d건 — 고치거나, 의도라면 `design-ok: 이유` 주석:\n%s" % (os.path.basename(p), len(items), fmt(p, items[:15]))
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse", "additionalContext": msg}}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    if sys.argv[1:] and sys.argv[1] != "hook":
        sys.exit(main_cli(sys.argv[1:]))
    sys.exit(main_hook())

# -*- coding: utf-8 -*-
"""SessionStart 훅: 작업 시작 때 '만들고 있는 교과서 목록·상태'와 '아직 시작 안 한 PDF'를 Claude에게 알려 준다.
새 세션에서도 BRIEF.md를 보고 이어서 하게 하고, 첫 소단원 확인(관문)을 건너뛰지 않게 한다."""
import json, os, re, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
WORK = os.path.join(ROOT, "작업물")
INBOX = os.path.join(ROOT, "교과서_넣는곳")


def brief_info(path):
    info = {"one": "", "state": "", "gate": False, "src": ""}
    try:
        txt = open(path, encoding="utf-8", errors="replace").read()
    except Exception:
        return info
    for l in txt.splitlines():
        if l.startswith("한 줄:"):
            info["one"] = l.split(":", 1)[1].strip()
        elif l.startswith("상태:"):
            info["state"] = l.split(":", 1)[1].strip()
        elif l.strip().startswith("- 원본 파일:"):
            info["src"] = l.split(":", 1)[1].strip()
    body = re.sub(r"<!--[\s\S]*?-->", "", txt)   # 서식의 예시 주석은 빼고
    info["gate"] = bool(re.search(r"^- .*첫 소단원 확인.*(이대로|업그레이드)", body, re.M))
    return info


def main():
    parts = []
    used = set()
    if os.path.isdir(WORK):
        rows = []
        for name in sorted(os.listdir(WORK)):
            d = os.path.join(WORK, name)
            if not os.path.isdir(d) or name.startswith("."):
                continue
            b = brief_info(os.path.join(d, "BRIEF.md"))
            used.add(os.path.basename(b["src"]))
            gate = "첫 소단원 확인 받음" if b["gate"] else "첫 소단원 확인 전 → 확인 받기 전에는 다음 소단원을 만들지 않는다"
            rows.append("- %s — %s · %s%s" % (name, b["state"] or "상태 미기록", gate, (" · " + b["one"]) if b["one"] else ""))
        if rows:
            parts.append("작업물/ 안의 교과서:\n" + "\n".join(rows[-20:]))
    if os.path.isdir(INBOX):
        pdfs = [f for f in sorted(os.listdir(INBOX)) if f.lower().endswith(".pdf")]
        new = [f for f in pdfs if f not in used]
        if new:
            parts.append("교과서_넣는곳/의 새 PDF(아직 작업 폴더 없음): " + ", ".join(new[:10]))
    parts.append("교과서 작업이면 textbook-webapp 스킬을 먼저 읽는다.")
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart",
                                             "additionalContext": "[수업잇기]\n" + "\n\n".join(parts)}}, ensure_ascii=False))


if __name__ == "__main__":
    main()

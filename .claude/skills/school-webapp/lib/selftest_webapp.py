# -*- coding: utf-8 -*-
"""verify_webapp.py 자가 테스트 — 검증기를 먼저 검증한다.

1) 정상 Apps Script 예제는 실패 0건이어야 한다 (오탐 0).
2) 실제로 겪은 버그를 하나씩 넣었을 때 해당 코드로 잡아야 한다 (미탐 0).
사용법: python selftest_webapp.py
"""
import os, sys, tempfile, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import verify_webapp as V

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass

GS = """function doGet(e) {
  var c = (e && e.parameter && e.parameter.c) || '';
  if (c === 'page') return HtmlService.createHtmlOutputFromFile('page');
  return HtmlService.createHtmlOutputFromFile('index');
}
function getData(code) { return { ok: true, code: code }; }
function helper_() { return 1; }
"""

PAGE = """<!DOCTYPE html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>[hidden]{display:none!important} .big{display:flex}</style></head>
<body>
<div id="who"><input id="name"></div>
<div class="big" id="pop" hidden>창</div>
<a href="next.html#land">다음</a>
<script>
function $(id){return document.getElementById(id);}
var Q={};
google.script.url.getLocation(function(loc){ Q=loc.parameter||{}; });
$("name").value="";
google.script.run.withSuccessHandler(function(r){ $("who").textContent=r.code; }).withFailureHandler(function(){}).getData("A");
</script>
</body></html>
"""

INDEX = PAGE.replace("getData(\"A\")", "getData(\"B\")")

BUGS = [
    ("G1", "없는 서버 함수 호출", lambda p, g: (p.replace('.getData("A")', '.getDta("A")'), g)),
    ("G1", "_로 끝나는 함수 호출", lambda p, g: (p.replace('.getData("A")', '.helper_()'), g)),
    ("G2", "Apps Script 화면에서 location.search 로 주소값 읽기", lambda p, g: (p.replace('google.script.url.getLocation(function(loc){ Q=loc.parameter||{}; });', 'location.search.replace(/x/,"");'), g)),
    ("G3", "createHtmlOutputFromFile 대상 파일 없음", lambda p, g: (p, g.replace("createHtmlOutputFromFile('page')", "createHtmlOutputFromFile('drone')"))),
    ("H3", "스크립트가 찾는 id 가 없음", lambda p, g: (p.replace('$("name").value="";', '$("nmae").value="";'), g)),
    ("H2", "id 중복", lambda p, g: (p.replace('<input id="name">', '<input id="name"><input id="name">'), g)),
    ("H4", "hidden 을 CSS display 가 덮어씀", lambda p, g: (p.replace("[hidden]{display:none!important} ", ""), g)),
    ("H1", "닫히지 않은 div", lambda p, g: (p.replace('<div id="who"><input id="name"></div>', '<div id="who"><input id="name">'), g)),
    ("H5", "http:// 외부 자원", lambda p, g: (p.replace("</head>", '<script src="http://example.com/a.js"></script></head>'), g)),
    ("P1", "미리보기에서 지워지는 ?쿼리 링크", lambda p, g: (p.replace('next.html#land', 'next.html?m=land'), g)),
    ("P2", "QR 대상 확인 알림", lambda p, g: (p.replace("var Q={};", "var Q={}; var q=qrcode(0,'M');"), g)),
]
if V.node_bin():
    BUGS.append(("J1", "스크립트 문법 오류", lambda p, g: (p.replace('$("name").value="";', '$("name").value=";'), g)))


def run(page, gs):
    d = tempfile.mkdtemp(prefix="webapp_st_")
    try:
        open(os.path.join(d, "page.html"), "w", encoding="utf-8").write(page)
        open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(INDEX)
        open(os.path.join(d, "Code.gs"), "w", encoding="utf-8").write(gs)
        files = sorted(os.path.join(d, f) for f in os.listdir(d))
        return V.check_folder(d, files)
    finally:
        shutil.rmtree(d, ignore_errors=True)


def main():
    bad = 0
    clean = [f for f in run(PAGE, GS) if f.level == "FAIL"]
    if clean:
        print("✗ 정상 예제에서 오탐 %d건" % len(clean)); [print(str(f)) for f in clean]; bad += 1
    else:
        print("✓ 정상 예제 통과 (오탐 0)")
    for code, desc, mk in BUGS:
        p, g = mk(PAGE, GS)
        got = [f for f in run(p, g) if f.code == code]
        if got:
            print("✓ 잡음 [%s] %s" % (code, desc))
        else:
            print("✗ 못 잡음 [%s] %s" % (code, desc)); bad += 1
    if not V.node_bin():
        print("· 건너뜀 [J1] 스크립트 문법 오류 (node 없음)")
    print("결과: %s" % ("통과" if not bad else "실패 %d건" % bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())

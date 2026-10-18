# -*- coding: utf-8 -*-
"""GitHub(공개 저장소)에 올리기 전 검사 — 교과서 내용·PDF·계정·서버 열쇠가 섞이지 않았는지.
git 이 올리려는 파일 목록(git ls-files + 추가될 파일)을 본다. 하나라도 걸리면 ✗ 와 함께 멈춘다.

  python tools/share/check_public.py
"""
import os, re, subprocess, sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BAD_PATH = [r'^작업물/(?!여기에_)', r'^교과서_넣는곳/(?!여기에_)', r'\.pdf$', r'firebaseConfig\.txt$', r'deploy\.json$', r'\.sharekey$', r'\.firebaserc$', r'링크\.txt$', r'\.clasprc\.json$', r'\.env$']
BAD_TEXT = [(r'AIza[0-9A-Za-z_\-]{30,}', 'Firebase/Google API 키'), (r'gh[opsu]_[0-9A-Za-z]{30,}', 'GitHub 토큰'), (r'-----BEGIN [A-Z ]*PRIVATE KEY', '비밀 키'),
            (r'refresh_token', '로그인 토큰'), (r'[A-Za-z0-9._%+-]+@(?!example\.|demo\.school|학교\.kr|school\.kr|noreply)[A-Za-z0-9.-]+\.(kr|com|net|org)', '실제 이메일 주소로 보이는 글')]
ALLOW_TEXT_IN = ('engine/app/assets/vendor/', 'tools/deploy/upload_course.py', 'tools/deploy/new_server.py', 'tools/deploy/firebase_api.py', 'tools/share/check_public.py', '.claude/skills/')


def main():
    files = subprocess.run(['git', '-c', 'core.quotepath=false', 'ls-files', '--cached', '--others', '--exclude-standard'], cwd=ROOT, capture_output=True, text=True, encoding='utf-8').stdout.split('\n')
    files = [f for f in files if f]
    bad = []
    for f in files:
        for pat in BAD_PATH:
            if re.search(pat, f): bad.append((f, '올리면 안 되는 파일')); break
        if f.startswith(ALLOW_TEXT_IN) or not f.endswith(('.md', '.js', '.py', '.json', '.html', '.css', '.txt', '.rules')): continue
        try:
            t = open(os.path.join(ROOT, f), encoding='utf-8', errors='ignore').read()
        except Exception:
            continue
        for pat, why in BAD_TEXT:
            m = re.search(pat, t)
            if m: bad.append((f, '%s: %s' % (why, m.group(0)[:40])))
    print('검사한 파일 %d개' % len(files))
    if bad:
        for f, why in bad: print('✗', f, '—', why)
        sys.exit(1)
    print('✓ 교과서 내용·계정·열쇠가 없어요. 올려도 됩니다.')


if __name__ == '__main__':
    main()

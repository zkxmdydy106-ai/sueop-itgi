# -*- coding: utf-8 -*-
"""Firebase 배포 준비 — config.js를 firebase 모드로 바꾸고, 보안 규칙에 선생님 계정을 넣는다.

사용:
  python tools/deploy/prepare_firebase.py "작업물/기하_비상" --config firebaseConfig.json --teacher kim@school.kr [--teacher 두번째@...]
  (firebaseConfig.json = Firebase 콘솔 › 프로젝트 설정 › 내 앱 › SDK 설정의 { apiKey, authDomain, projectId, ... } 를 그대로 저장한 파일)
그다음 (작업물/<교과서> 폴더에서):
  npx firebase-tools login                 ← 선생님이 브라우저에서 한 번 로그인
  npx firebase-tools use --add <projectId>
  npx firebase-tools deploy --only hosting,firestore
배포 뒤: 선생님 화면 › 설정 › '교과서 올리기'로 content 폴더를 올리고, 명렬표를 붙여 넣는다.
"""
import argparse, json, os, re, sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('course'); ap.add_argument('--config', required=True); ap.add_argument('--teacher', action='append', required=True)
    a = ap.parse_args()
    raw = open(a.config, encoding='utf-8').read()
    m = re.search(r'\{[\s\S]*\}', raw); txt = m.group(0)
    txt = re.sub(r'^\s*//[^\n]*', '', txt, flags=re.M)                   # 주석 줄 빼기
    txt = re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r'\1"\2":', txt)        # apiKey: → "apiKey":
    txt = re.sub(r"'([^']*)'", r'"\1"', txt)                               # '값' → "값"
    txt = re.sub(r',\s*}', '}', txt)                                       # 끝 쉼표
    conf = json.loads(txt)
    need = ['apiKey', 'authDomain', 'projectId', 'appId']
    miss = [k for k in need if k not in conf]
    if miss:
        print('firebaseConfig에 빠진 값:', miss); sys.exit(1)
    emails = [e.strip().lower() for e in a.teacher if '@' in e]
    cpath = os.path.join(a.course, 'app', 'config.js'); c = open(cpath, encoding='utf-8').read()
    c = re.sub(r"^(\s*)mode:\s*'[^']*'", r"\1mode: 'firebase'", c, flags=re.M)
    c = re.sub(r'teacherEmails:\s*\[[^\]]*\]', 'teacherEmails: ' + json.dumps(emails, ensure_ascii=False), c)
    c = re.sub(r'firebase:\s*(null|\{[\s\S]*?\})\s*\n', 'firebase: ' + json.dumps(conf, ensure_ascii=False) + '\n', c)
    open(cpath, 'w', encoding='utf-8').write(c)
    rpath = os.path.join(a.course, 'firestore.rules'); r = open(rpath, encoding='utf-8').read()
    r = re.sub(r'email\(\) in \[[^\]]*\]', 'email() in ' + json.dumps(emails), r)
    open(rpath, 'w', encoding='utf-8').write(r)
    rc = {'projects': {'default': conf['projectId']}}
    json.dump(rc, open(os.path.join(a.course, '.firebaserc'), 'w', encoding='utf-8'), indent=2)
    print('준비 완료 — 선생님 계정:', ', '.join(emails))
    print('다음 (작업물 폴더에서):  npx firebase-tools login  →  npx firebase-tools deploy --only hosting,firestore')
    print('주의: content 폴더는 공개 호스팅에 올라가지 않아요. 배포 뒤 선생님 화면 › 설정 › 교과서 올리기로 Firestore에 올립니다.')


if __name__ == '__main__':
    main()

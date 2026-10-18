# -*- coding: utf-8 -*-
"""한 번에 배포 — 엔진 반영 → 보안 규칙 → 호스팅·규칙 배포 → 교과서 올리기(반 명단용 + 칠판 링크용) → 링크 출력.
교과서를 고치거나 쪽을 더 만든 뒤에도 이것 하나만 다시 돌리면 된다. 바뀐 것만 올라가고, 링크·학생 기록은 그대로다.

처음:  python tools/deploy/deploy.py "작업물/기하_지학사" --teacher 선생님@학교.kr
다음:  python tools/deploy/deploy.py "작업물/기하_지학사"
필요: 작업물/<이름>/firebaseConfig.txt (Firebase 웹 앱 설정), `npx firebase-tools login` 이 되어 있을 것.
설정은 작업물/<이름>/deploy.json 에 남는다(선생님 계정). 링크는 작업물/<이름>/링크.txt 에도 적는다.
"""
import argparse, json, os, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


def run(cmd, cwd=None):
    print('›', ' '.join(cmd) if isinstance(cmd, list) else cmd, flush=True)
    r = subprocess.run(cmd, cwd=cwd or ROOT, shell=isinstance(cmd, str))
    if r.returncode != 0:
        sys.exit('멈춤: 위 단계에서 오류가 났어요.')


def ensure_short(course, conf, project, key):
    """짧은 주소(<shortSite>.web.app) + 6자리 칠판 코드 → 칠판 링크로 바로 이동.
    코드는 작업물/<이름>/.boardcode (올라가지 않음). 코드를 바꾸려면 그 파일을 지우고 다시 배포."""
    site = conf.get('shortSite')
    if not site or not key: return None
    import random
    cp = os.path.join(course, '.boardcode')
    if not os.path.exists(cp): open(cp, 'w').write('%06d' % random.SystemRandom().randrange(0, 1000000))
    code = open(cp).read().strip()
    sd = os.path.join(course, 'short'); os.makedirs(sd, exist_ok=True)
    page = open(os.path.join(ROOT, 'engine', 'short', 'index.html'), encoding='utf-8').read()
    for f in ('index.html', '404.html'): open(os.path.join(sd, f), 'w', encoding='utf-8').write(page)
    fj = os.path.join(course, 'firebase.json'); d = json.load(open(fj, encoding='utf-8'))
    h = d['hosting']; main_h = h if isinstance(h, dict) else [x for x in h if x.get('site') != site][0]
    main_h['site'] = project
    board = 'https://%s.web.app/board.html?k=%s' % (project, key)
    d['hosting'] = [main_h, {'site': site, 'public': 'short', 'cleanUrls': True,
                             'redirects': [{'source': '/' + code, 'destination': board, 'type': 302}],
                             'headers': [{'source': '**', 'headers': [{'key': 'X-Robots-Tag', 'value': 'noindex'}, {'key': 'Cache-Control', 'value': 'no-cache'}, {'key': 'Referrer-Policy', 'value': 'no-referrer'}]}]}]
    json.dump(d, open(fj, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    return code


def ensure_join(course, project, key):
    """학생 링크 코드(student.html?j=코드). 이 코드로 들어온 학생은 로그인하면 명단에 저절로 들어간다.
    코드는 작업물/<이름>/.joincode 에 둔다(올라가지 않음). 선생님이 「닫기」 한 것은 다시 열지 않는다."""
    import secrets, time, urllib.error, urllib.request
    sys.path.insert(0, os.path.join(ROOT, 'tools', 'deploy'))
    from upload_course import token, put
    jp = os.path.join(course, '.joincode')
    if not os.path.exists(jp): open(jp, 'w').write(secrets.token_urlsafe(9))
    code = open(jp).read().strip(); tok = token()
    url = 'https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/join/%s' % (project, code)
    try: urllib.request.urlopen(urllib.request.Request(url, headers={'Authorization': 'Bearer ' + tok}), timeout=30).read()
    except urllib.error.HTTPError as e:
        if e.code != 404: raise
        put(tok, project, 'join/' + code, {'open': True, 'at': int(time.time() * 1000)})
    put(tok, project, 'config/join', {'code': code})                       # 선생님 화면·QR 로그인한 칠판이 읽음
    if key: put(tok, project, 'shared/%s/meta/join' % key, {'code': code})  # 로그인 없는 칠판의 「학생 접속 QR」이 읽음
    return code


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('course'); ap.add_argument('--teacher', action='append'); ap.add_argument('--skip-upload', action='store_true')
    a = ap.parse_args()
    course = os.path.abspath(a.course); name = os.path.basename(course)
    dj = os.path.join(course, 'deploy.json')
    conf = json.load(open(dj, encoding='utf-8')) if os.path.exists(dj) else {}
    if a.teacher: conf['teachers'] = [t.strip().lower() for t in a.teacher]
    if not conf.get('teachers'): sys.exit('선생님 계정이 필요해요:  --teacher 선생님@학교.kr')
    json.dump(conf, open(dj, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    cfg = os.path.join(course, 'firebaseConfig.txt')
    if not os.path.exists(cfg): sys.exit('firebaseConfig.txt 가 없어요 (Firebase 웹 앱 설정). 먼저 서버를 만들어 주세요:  python tools/deploy/new_server.py "<작업물/이름>" --teacher 선생님@학교.kr')

    py = sys.executable
    run([py, 'tools/build/new_course.py', name, '--update-engine'])
    shutil.copy(os.path.join(ROOT, 'engine', 'firebase', 'firestore.rules'), os.path.join(course, 'firestore.rules'))
    ex = os.path.join(course, 'extras')   # 연결된 수업 활동 파일(예: 드론 미션) — 교과서 내용이 아닌 선생님 작품만 둔다
    if os.path.isdir(ex): shutil.copytree(ex, os.path.join(course, 'app', 'extras'), dirs_exist_ok=True)
    run([py, 'tools/deploy/prepare_firebase.py', course, '--config', cfg] + sum([['--teacher', t] for t in conf['teachers']], []))
    project0 = json.load(open(os.path.join(course, '.firebaserc'), encoding='utf-8'))['projects']['default']
    key0 = open(os.path.join(course, '.sharekey')).read().strip() if os.path.exists(os.path.join(course, '.sharekey')) else ''
    bcode = ensure_short(course, conf, project0, key0)
    run('npx -y firebase-tools deploy --only hosting,firestore --non-interactive', cwd=course)
    if not a.skip_upload:
        run([py, 'tools/deploy/upload_course.py', course])
        run([py, 'tools/deploy/upload_course.py', course, '--shared'])
    project = json.load(open(os.path.join(course, '.firebaserc'), encoding='utf-8'))['projects']['default']
    key = open(os.path.join(course, '.sharekey')).read().strip() if os.path.exists(os.path.join(course, '.sharekey')) else ''
    base = 'https://%s.web.app' % project
    code = ensure_join(course, project, key)
    if bcode:
        from upload_course import token, put
        put(token(), project, 'config/board', {'short': conf['shortSite'] + '.web.app', 'code': bcode})   # 선생님 화면 설정에 보여 줌
    links = (['전자칠판에서 쉽게: %s.web.app 에 들어가 칠판 코드 %s (또는 %s.web.app/%s)' % (conf['shortSite'], bcode, conf['shortSite'], bcode)] if bcode else []) + ['칠판 (로그인 없이): %s/board.html?k=%s' % (base, key) if key else '칠판: %s/board.html' % base,
             '학생 (아이패드·클래스룸 — 로그인하면 명단에 저절로): %s/student.html?j=%s' % (base, code),
             '선생님 기록: %s/teacher.html' % base]
    open(os.path.join(course, '링크.txt'), 'w', encoding='utf-8').write('\n'.join(links) + '\n\n칠판 링크는 반 밖으로 공유하지 마세요 (교과서 저작권).\n')
    print('\n배포 완료\n' + '\n'.join(links))


if __name__ == '__main__':
    main()

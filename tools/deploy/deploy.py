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
    run('npx -y firebase-tools deploy --only hosting,firestore --non-interactive', cwd=course)
    if not a.skip_upload:
        run([py, 'tools/deploy/upload_course.py', course])
        run([py, 'tools/deploy/upload_course.py', course, '--shared'])
    project = json.load(open(os.path.join(course, '.firebaserc'), encoding='utf-8'))['projects']['default']
    key = open(os.path.join(course, '.sharekey')).read().strip() if os.path.exists(os.path.join(course, '.sharekey')) else ''
    base = 'https://%s.web.app' % project
    links = ['칠판 (로그인 없이): %s/board.html?k=%s' % (base, key) if key else '칠판: %s/board.html' % base,
             '학생 (아이패드·클래스룸): %s/student.html' % base,
             '선생님 기록: %s/teacher.html' % base]
    open(os.path.join(course, '링크.txt'), 'w', encoding='utf-8').write('\n'.join(links) + '\n\n칠판 링크는 반 밖으로 공유하지 마세요 (교과서 저작권).\n')
    print('\n배포 완료\n' + '\n'.join(links))


if __name__ == '__main__':
    main()

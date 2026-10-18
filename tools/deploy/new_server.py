# -*- coding: utf-8 -*-
"""선생님 대신 Firebase 서버를 새로 만든다 — 프로젝트 · Firestore(서울) · 익명 로그인 · 웹 앱 설정까지.
선생님이 할 일은 `npx firebase-tools login`(구글 계정 허용) 한 번뿐. 구글 로그인 켜기는 API로 안 되는 경우가 있어
그때는 Code가 브라우저에서 콘솔 화면을 눌러 켠다(아래 안내가 출력됨).

  python tools/deploy/new_server.py "작업물/기하_지학사" --teacher 선생님@학교.kr            새 프로젝트 만들기
  python tools/deploy/new_server.py "작업물/기하_지학사" --teacher … --project 이미있는id   있는 프로젝트에 붙이기
끝나면 이어서:  python tools/deploy/deploy.py "작업물/기하_지학사"
"""
import argparse, json, os, random, string, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from upload_course import token  # noqa: E402
from firebase_api import call  # noqa: E402

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


def logged_in():
    cfg = os.path.join(os.path.expanduser('~'), '.config', 'configstore', 'firebase-tools.json')
    try:
        return bool(json.load(open(cfg, encoding='utf-8')).get('tokens', {}).get('refresh_token'))
    except Exception:
        return False


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('course'); ap.add_argument('--teacher', action='append', required=True); ap.add_argument('--project')
    a = ap.parse_args()
    course = os.path.abspath(a.course)
    if not logged_in():
        sys.exit('먼저 로그인: 터미널에서  npx -y firebase-tools login --reauth  → 열리는 구글 화면에서 선생님 계정으로 「허용」')
    pid = a.project
    if not pid:
        pid = 'dt-' + time.strftime('%y%m%d') + '-' + ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(5))
        print('새 프로젝트 만드는 중:', pid, flush=True)
        r = subprocess.run('npx -y firebase-tools projects:create %s --display-name "수업잇기" --non-interactive' % pid, shell=True, cwd=ROOT)
        if r.returncode != 0:
            sys.exit('프로젝트를 만들지 못했어요. 학교 계정에서 프로젝트 만들기가 막혀 있거나, 무료 프로젝트 수 한도일 수 있어요. '
                     '개인 구글 계정으로 다시 로그인하거나 --project 로 이미 있는 프로젝트를 쓰세요.')
    tok = token()
    # Firestore (서울)
    db_url = 'https://firestore.googleapis.com/v1/projects/%s/databases/(default)' % pid
    if '_error' in call('GET', db_url, tok=tok):
        call('POST', 'https://serviceusage.googleapis.com/v1/projects/%s/services/firestore.googleapis.com:enable' % pid, {}, tok)
        time.sleep(15)
        r = call('POST', 'https://firestore.googleapis.com/v1/projects/%s/databases?databaseId=(default)' % pid, {'locationId': 'asia-northeast3', 'type': 'FIRESTORE_NATIVE'}, tok)
        if '_error' in r: print('Firestore 만들기 응답:', r.get('_msg', '')[:300])
        for _ in range(40):
            time.sleep(5)
            if '_error' not in call('GET', db_url, tok=tok): break
    print('Firestore:', call('GET', db_url, tok=tok).get('locationId', '아직 없음'))
    # 로그인 방법: 익명(칠판 QR 로그인) — API로 켬
    idt = 'https://identitytoolkit.googleapis.com/admin/v2/projects/%s' % pid
    call('POST', 'https://serviceusage.googleapis.com/v1/projects/%s/services/identitytoolkit.googleapis.com:enable' % pid, {}, tok)
    time.sleep(5)
    r = call('PATCH', idt + '/config?updateMask=signIn.anonymous.enabled', {'signIn': {'anonymous': {'enabled': True}}}, tok)
    print('익명 로그인:', '켬' if '_error' not in r else '실패 — 브라우저에서 켜야 함')
    # 웹 앱 설정
    subprocess.run([sys.executable, os.path.join(HERE, 'firebase_api.py'), pid, 'webconfig', os.path.join(course, 'firebaseConfig.txt')])
    # 선생님 계정 기억
    dj = os.path.join(course, 'deploy.json'); conf = json.load(open(dj, encoding='utf-8')) if os.path.exists(dj) else {}
    conf['teachers'] = [t.strip().lower() for t in a.teacher]; conf['project'] = pid
    json.dump(conf, open(dj, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    # 구글 로그인 확인
    g = call('GET', idt + '/defaultSupportedIdpConfigs/google.com', tok=tok)
    if g.get('enabled'):
        print('구글 로그인: 켜져 있음')
    else:
        print('\n[브라우저 단계] 구글 로그인 켜기 — Code가 직접 누른다:')
        print('  https://console.firebase.google.com/project/%s/authentication/providers' % pid)
        print('  「시작하기」 → Google → 사용 설정 → 공개 이름 「수업잇기」, 지원 이메일 = 선생님 계정 → 저장')
    print('\n다음:  python tools/deploy/deploy.py "%s"' % a.course)


if __name__ == '__main__':
    main()

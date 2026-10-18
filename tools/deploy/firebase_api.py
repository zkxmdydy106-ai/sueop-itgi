# -*- coding: utf-8 -*-
"""Firebase 설정을 API로 바꾸는 작은 도구 — 선생님이 콘솔에서 누를 일을 줄인다.
`npx firebase-tools login` 으로 로그인해 둔 계정의 권한을 쓴다(토큰은 화면에 찍지 않음).

  python tools/deploy/firebase_api.py <projectId> status        로그인 방법·Firestore 상태 보기
  python tools/deploy/firebase_api.py <projectId> anonymous     익명 로그인 켜기 (칠판 QR 로그인에 필요)
  python tools/deploy/firebase_api.py <projectId> firestore     Firestore(서울) 만들기 — 이미 있으면 그대로
  python tools/deploy/firebase_api.py <projectId> webconfig <저장경로>   웹 앱 설정을 firebaseConfig.txt 로 저장 (없으면 웹 앱을 만든다)
"""
import json, os, sys, time, urllib.request, urllib.error

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from upload_course import token  # noqa: E402

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


def call(method, url, body=None, tok=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json'})
    try:
        return json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as e:
        msg = e.read().decode('utf-8', 'replace')
        return {'_error': e.code, '_msg': msg[:600]}


def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(1)
    project, cmd = sys.argv[1], sys.argv[2]
    tok = token()
    idt = 'https://identitytoolkit.googleapis.com/admin/v2/projects/%s' % project
    if cmd == 'status':
        cfg = call('GET', idt + '/config', tok=tok)
        print('익명 로그인:', bool(((cfg.get('signIn') or {}).get('anonymous') or {}).get('enabled')))
        g = call('GET', idt + '/defaultSupportedIdpConfigs/google.com', tok=tok)
        print('구글 로그인:', bool(g.get('enabled')) if '_error' not in g else '꺼짐')
        db = call('GET', 'https://firestore.googleapis.com/v1/projects/%s/databases/(default)' % project, tok=tok)
        print('Firestore:', db.get('locationId') if '_error' not in db else '없음')
    elif cmd == 'anonymous':
        r = call('PATCH', idt + '/config?updateMask=signIn.anonymous.enabled', {'signIn': {'anonymous': {'enabled': True}}}, tok)
        print('익명 로그인 켬' if '_error' not in r else '실패: %s' % r)
    elif cmd == 'firestore':
        db = call('GET', 'https://firestore.googleapis.com/v1/projects/%s/databases/(default)' % project, tok=tok)
        if '_error' not in db:
            print('Firestore 이미 있음:', db.get('locationId')); return
        call('POST', 'https://serviceusage.googleapis.com/v1/projects/%s/services/firestore.googleapis.com:enable' % project, {}, tok)
        r = call('POST', 'https://firestore.googleapis.com/v1/projects/%s/databases?databaseId=(default)' % project, {'locationId': 'asia-northeast3', 'type': 'FIRESTORE_NATIVE'}, tok)
        print('Firestore 만드는 중(서울)' if '_error' not in r else '실패: %s' % r)
    elif cmd == 'webconfig':
        out = sys.argv[3]
        apps = call('GET', 'https://firebase.googleapis.com/v1beta1/projects/%s/webApps' % project, tok=tok).get('apps') or []
        if not apps:
            call('POST', 'https://firebase.googleapis.com/v1beta1/projects/%s/webApps' % project, {'displayName': 'sueop-itgi'}, tok)
            for _ in range(20):
                time.sleep(3)
                apps = call('GET', 'https://firebase.googleapis.com/v1beta1/projects/%s/webApps' % project, tok=tok).get('apps') or []
                if apps: break
        app = apps[0]['appId']
        c = call('GET', 'https://firebase.googleapis.com/v1beta1/projects/%s/webApps/%s/config' % (project, app), tok=tok)
        keys = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId']
        txt = 'const firebaseConfig = {\n' + ''.join('  %s: "%s",\n' % (k, c[k]) for k in keys if k in c) + '};\n'
        open(out, 'w', encoding='utf-8').write(txt)
        print('웹 앱 설정 저장:', out)
    else:
        print(__doc__)


if __name__ == '__main__':
    main()

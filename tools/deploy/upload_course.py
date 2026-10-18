# -*- coding: utf-8 -*-
"""교과서(content 폴더)를 Firestore에 올린다 — 선생님 화면 › 설정 › 교과서 올리기와 같은 일을 PC에서 한 번에.
선생님이 `npx firebase-tools login`으로 로그인해 둔 계정의 권한을 쓴다(토큰은 화면에 찍지 않는다).
교과서는 공개 호스팅이 아니라 Firestore(보안 규칙: 명단의 학생·선생님만 읽기)에 들어간다.

사용:  python tools/deploy/upload_course.py "작업물/기하_지학사"            (반 명단 학생·선생님용)
      python tools/deploy/upload_course.py "작업물/기하_지학사" --shared   (로그인 없는 칠판 링크용 사본: shared/<열쇠>)
열쇠는 작업물/<이름>/.sharekey 에 둔다(공개 호스팅에 올라가지 않음). 링크: https://<프로젝트>.web.app/board.html?k=<열쇠>
"""
import argparse, base64, json, os, re, sys, time, urllib.request, urllib.parse

CFG = os.path.join(os.path.expanduser('~'), '.config', 'configstore', 'firebase-tools.json')
CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com'   # firebase-tools 공개 클라이언트
CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi'
MAX = 760000   # 앱과 같은 한도 (Firestore 문서 1MiB)


def token():
    d = json.load(open(CFG, encoding='utf-8'))
    rt = d.get('tokens', {}).get('refresh_token')
    if not rt:
        sys.exit('먼저 로그인해 주세요:  npx firebase-tools login')
    body = urllib.parse.urlencode({'client_id': CLIENT_ID, 'client_secret': CLIENT_SECRET, 'refresh_token': rt, 'grant_type': 'refresh_token'}).encode()
    r = json.load(urllib.request.urlopen('https://oauth2.googleapis.com/token', body))
    return r['access_token']


def fsval(v):
    if isinstance(v, bool): return {'booleanValue': v}
    if isinstance(v, int): return {'integerValue': str(v)}
    return {'stringValue': str(v)}


def put(tok, project, path, fields):
    url = 'https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/%s' % (project, urllib.parse.quote(path))
    data = json.dumps({'fields': {k: fsval(v) for k, v in fields.items()}}).encode()
    req = urllib.request.Request(url, data=data, method='PATCH', headers={'Authorization': 'Bearer ' + tok, 'Content-Type': 'application/json'})
    for i in range(4):
        try:
            urllib.request.urlopen(req, timeout=60).read(); return
        except Exception as e:
            if i == 3: raise
            time.sleep(2 * (i + 1))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('course'); ap.add_argument('--shared', action='store_true'); a = ap.parse_args()
    cfg = open(os.path.join(a.course, 'app', 'config.js'), encoding='utf-8').read()
    course_id = re.search(r"courseId:\s*['\"]([^'\"]+)", cfg).group(1)
    project = re.search(r'"projectId":\s*"([^"]+)"', cfg).group(1)
    cdir = os.path.join(a.course, 'content')
    txt = open(os.path.join(cdir, 'content.js'), encoding='utf-8').read()
    tb = json.loads(txt[txt.index('{'):txt.rindex('}') + 1])
    js = json.dumps(tb, ensure_ascii=False, separators=(',', ':'))
    tok = token()
    CH = 900000; n = (len(js) + CH - 1) // CH
    if a.shared:
        kp = os.path.join(a.course, '.sharekey')
        if not os.path.exists(kp):
            import secrets; open(kp, 'w').write(secrets.token_urlsafe(24))
        key = open(kp).read().strip(); base = 'shared/%s' % key
    else:
        base = 'courses/%s' % course_id
    # 바뀐 것만 올린다 (.upload_state.json 에 파일마다 지문을 적어 둔다). 하나라도 바뀌면 교과서 판(at)을 새로 → 기기 저장소가 새 판을 받는다
    import hashlib
    sp = os.path.join(a.course, '.upload_state.json')
    state = json.load(open(sp, encoding='utf-8')) if os.path.exists(sp) else {}
    old = state.get(base, {}); new = {}
    files = []
    for root, _, fs in os.walk(cdir):
        for f in fs:
            rel = os.path.relpath(os.path.join(root, f), cdir).replace('\\', '/')
            m = re.match(r'^pages/(hi/)?p0*(\d+)\.(webp|jpg|png)$', rel)
            if m or rel.startswith('figs/'): files.append((rel, m))
    new['content.js'] = hashlib.sha1(js.encode('utf-8')).hexdigest()
    for rel, _ in files: new[rel] = hashlib.sha1(open(os.path.join(cdir, rel), 'rb').read()).hexdigest()
    todo = [(rel, m) for rel, m in sorted(files) if old.get(rel) != new[rel]]
    json_changed = old.get('content.js') != new['content.js']
    if not todo and not json_changed:
        print('바뀐 것이 없어요 — 올리지 않음 (%s)' % ('칠판 링크용' if a.shared else '반 명단용'))
    else:
        big = 0; done = 0
        for rel, m in todo:
            p = os.path.join(cdir, rel)
            if os.path.getsize(p) > MAX: big += 1; continue
            ext = rel.rsplit('.', 1)[1]; mime = {'webp': 'image/webp', 'jpg': 'image/jpeg', 'png': 'image/png', 'svg': 'image/svg+xml'}.get(ext, 'application/octet-stream')
            data = 'data:%s;base64,%s' % (mime, base64.b64encode(open(p, 'rb').read()).decode())
            if m: put(tok, project, '%s/pages/%s%s' % (base, m.group(2), '_hi' if m.group(1) else ''), {'data': data})
            else: put(tok, project, '%s/assets/%s' % (base, re.sub(r'[/.]', '_', rel)), {'data': data})
            done += 1
            if done % 25 == 0: print('  그림 %d / %d' % (done, len(todo)))
            if done % 200 == 0: tok = token()
        for i in range(n):
            put(tok, project, '%s/parts/%d' % (base, i), {'i': i, 'json': js[i * CH:(i + 1) * CH]})
        # 머리 문서는 맨 마지막에 (판 번호가 바뀌는 순간 모든 조각이 이미 올라가 있도록)
        put(tok, project, base, {'title': tb['meta']['title'], 'subject': tb['meta'].get('subject', ''), 'at': int(time.time() * 1000), 'parts': n})
        state[base] = new; json.dump(state, open(sp, 'w', encoding='utf-8'), ensure_ascii=False)
        print('완료 (%s): 교과서 글 %d조각, 그림 %d개 올림%s' % ('칠판 링크용' if a.shared else '반 명단용', n, done, (', 너무 큰 그림 %d개는 뺌' % big) if big else ''))
    if a.shared: print('칠판 링크: https://%s.web.app/board.html?k=%s' % (project, key))


if __name__ == '__main__':
    main()

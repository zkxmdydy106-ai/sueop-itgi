# -*- coding: utf-8 -*-
"""새 교과서 작업 폴더 만들기 — engine/app 을 복사하고 content 뼈대와 BRIEF를 만든다.

사용:  python tools/build/new_course.py "기하_비상" --subject 수학 --course 기하 --publisher 비상교육
결과:  작업물/기하_비상/
         app/          ← 배포되는 앱 (엔진 복사본 + config.js)
         content/      ← 교과서 내용(content.js)·쪽 그림·그림 — 공개 호스팅에 올리지 않는다 (Firestore로만)
         firebase.json, firestore.rules, firestore.indexes.json
         BRIEF.md      ← 요구사항 장부·결정·남은 일
엔진을 고친 뒤 기존 교과서에 반영:  python tools/build/new_course.py "기하_비상" --update-engine
"""
import argparse, json, os, re, shutil, sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SUBJECTS = ['수학', '과학', '국어', '사회', '영어', '정보', '기타']



def _force(fn, path, exc):
    import stat
    os.chmod(path, stat.S_IWRITE)
    fn(path)

def slug(s):
    s = re.sub(r'[^0-9A-Za-z가-힣]+', '-', s).strip('-').lower()
    return s or 'course'


def inject_lab(app, fname):
    """모형 파일을 칠판·학생·모형 모음 화면에 연결 (이미 있으면 그대로)"""
    tag = '<script src="assets/js/labs/%s"></script>' % fname
    for h in ('board.html', 'student.html', 'labs.html'):
        p = os.path.join(app, h); s = open(p, encoding='utf-8').read()
        if tag in s:
            continue
        last = [m.end() for m in re.finditer(r'<script src="assets/js/labs/[^"]+"></script>', s)]
        if not last:
            raise SystemExit('%s에 labs 스크립트 자리가 없어요' % h)
        s = s[:last[-1]] + '\n' + tag + s[last[-1]:]
        open(p, 'w', encoding='utf-8').write(s)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('name'); ap.add_argument('--subject', default='수학'); ap.add_argument('--course', default='')
    ap.add_argument('--publisher', default=''); ap.add_argument('--update-engine', action='store_true')
    a = ap.parse_args()
    if a.subject not in SUBJECTS:
        print('과목 색 이름은 %s 중 하나 (예: 지리→사회, 보건·체육·예술→기타 또는 가까운 것)' % ', '.join(SUBJECTS))
    dst = os.path.join(ROOT, '작업물', a.name)
    app_src = os.path.join(ROOT, 'engine', 'app')
    if a.update_engine:
        if not os.path.isdir(dst):
            print('그런 작업 폴더가 없어요:', dst); sys.exit(1)
        app = os.path.join(dst, 'app')
        cfg = open(os.path.join(app, 'config.js'), encoding='utf-8').read()
        # 이 교과서 전용 모형(labs)·모형 자료(lab-assets)는 남긴다
        keep = {}
        for sub in (('assets', 'js', 'labs'), ('assets', 'lab-assets')):
            old_dir, new_dir = os.path.join(app, *sub), os.path.join(app_src, *sub)
            if os.path.isdir(old_dir):
                for f in os.listdir(old_dir):
                    if not os.path.exists(os.path.join(new_dir, f)):
                        keep[os.path.join(*sub, f)] = open(os.path.join(old_dir, f), 'rb').read()
        shutil.rmtree(app, onerror=_force)   # 읽기 전용 폴더도 지운다 (윈도우)
        shutil.copytree(app_src, app)
        open(os.path.join(app, 'config.js'), 'w', encoding='utf-8').write(cfg)
        for rel, data in keep.items():
            os.makedirs(os.path.dirname(os.path.join(app, rel)), exist_ok=True)
            open(os.path.join(app, rel), 'wb').write(data)
        for rel in keep:
            if rel.startswith(os.path.join('assets', 'js', 'labs')) and rel.endswith('.js'):
                inject_lab(app, os.path.basename(rel))
        print('엔진을 새로 덮었어요 (config.js·전용 모형 %d개는 그대로): %s' % (len([k for k in keep if k.endswith('.js')]), dst)); return
    if os.path.exists(dst):
        print('이미 있어요:', dst); sys.exit(1)
    shutil.copytree(app_src, os.path.join(dst, 'app'))
    for f in ('firebase.json', 'firestore.rules', 'firestore.indexes.json'):
        shutil.copy(os.path.join(ROOT, 'engine', 'firebase', f), os.path.join(dst, f))
    os.makedirs(os.path.join(dst, 'content', 'pages', 'hi'), exist_ok=True); os.makedirs(os.path.join(dst, 'content', 'figs'), exist_ok=True)
    cid = slug(a.name)
    cfg = """/* 이 교과서 앱의 설정 — 수업잇기가 채운다.
   · 모드 — demo: 이 브라우저 안에서만 / firebase: 구글 로그인 + 반 기록
   · Firebase 값 — Firebase 콘솔 › 프로젝트 설정 › 웹 앱의 firebaseConfig (공개돼도 되는 값. 보호는 firestore.rules)
   · 선생님 계정 — firestore.rules에도 같은 값 → python tools/deploy/prepare_firebase.py 가 채운다 */
window.DT_CONFIG = {
  mode: 'demo',
  courseId: '%s',
  contentPath: '../content/',
  school: '',
  teacherEmails: [],
  firebase: null
};
""" % cid
    open(os.path.join(dst, 'app', 'config.js'), 'w', encoding='utf-8').write(cfg)
    tb = {'meta': {'title': a.name, 'subject': a.subject, 'course': a.course or a.name, 'publisher': a.publisher, 'curriculum': '2022 개정', 'source': ''},
          'pages': {}, 'units': [], 'glossary': [], 'hotspots': {}}
    with open(os.path.join(dst, 'content', 'content.js'), 'w', encoding='utf-8') as f:
        f.write('/* 교과서 내용 — 화면 문장은 교과서 그대로 옮긴다. 형식: .claude/skills/textbook-content/SKILL.md */\n')
        f.write('window.TEXTBOOK = ' + json.dumps(tb, ensure_ascii=False, indent=1) + ';\n')
    brief = open(os.path.join(ROOT, 'templates', 'BRIEF-교과서.md'), encoding='utf-8').read().replace('{{이름}}', a.name).replace('{{과목}}', a.subject).replace('{{courseId}}', cid)
    open(os.path.join(dst, 'BRIEF.md'), 'w', encoding='utf-8').write(brief)
    print('만들었어요:', dst)
    print('다음: python tools/ingest/extract.py "교과서_넣는곳/<파일>.pdf" --out "작업물/%s/content"' % a.name)


if __name__ == '__main__':
    main()

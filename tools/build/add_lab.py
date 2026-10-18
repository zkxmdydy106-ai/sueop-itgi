# -*- coding: utf-8 -*-
"""새 3D 모형 뼈대 만들기 — 고품질 기본값(물리 기반 재질·환경광·부드러운 그림자·교과서 톤)이 들어간 파일을 만들고 화면에 연결한다.

사용:  python tools/build/add_lab.py "작업물/기하_비상" cone-section --title "원뿔의 단면" --sub "수학 · 기하" --desc "자르는 평면을 기울이며 단면 모양 보기"
       python tools/build/add_lab.py engine cone-section ...      ← 모든 교과서가 쓸 모형이면 엔진에 (그다음 --update-engine)
결과:  <app>/assets/js/labs/cone-section.js  +  board.html·student.html·labs.html에 script 연결
확인:  <app>/labs.html?open=cone-section  을 열어 스크린샷 (audit 서버: python -m http.server 로 작업물 폴더에서)
"""
import argparse, os, re, sys

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from new_course import inject_lab, ROOT  # noqa: E402

TEMPLATE = r"""/* 모형: __TITLE__ — __DESC__
   props: { … }   ← content의 lab 블록·hotspot에서 넘기는 값 (예: angle)
   theme: { plane, plane2, line, accent, shape, paper, label } — 교과서 그림 색 (figure_palette.py)
   품질 기준: .claude/skills/lab-3d/SKILL.md §품질 */
(function () {
  'use strict';
  const DT = window.DT;
  DT.lab.register('__ID__', {
    title: '__TITLE__',
    sub: '__SUB__',
    desc: '__DESC__',
    hint: '끌어서 돌려 보세요 · 오른쪽 막대로 바꿔요',
    build(ctx) {
      const th = ctx.theme;
      const g = ctx.three({ camera: [9, 7, 12], target: [0, 1, 0], fov: 34, maxPolar: Math.PI * 0.49, minDistance: 5, maxDistance: 40 });
      const T = g.T, scene = g.scene;

      /* 빛: 해(그림자) + 하늘·바닥 반사광. 환경광(RoomEnvironment)은 ctx.three가 이미 넣었다 */
      const sun = new T.DirectionalLight(0xffffff, 2.0); sun.position.set(-7, 13, -3); sun.castShadow = true;   // 뒤쪽 위에서 → 그림자가 앞으로 떨어져 보인다
      sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
      sun.shadow.bias = -0.0004; sun.shadow.radius = 3;
      scene.add(sun, new T.HemisphereLight(0xffffff, 0xe9e2d2, 0.5));
      /* 책상에 떨어지는 부드러운 그림자 — 물체가 '떠 있지' 않게 */
      const floor = new T.Mesh(new T.PlaneGeometry(80, 80), new T.ShadowMaterial({ opacity: 0.13 }));
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

      /* ── 여기에 모형을 만든다 ──
         g.mat(색, {roughness, metalness, clearcoat…})  물리 기반 재질 (교과서 색 th.*)
         g.acrylic(색, 투명도)                        반투명 판(평면·단면)
         g.tube(a, b, 반지름, 색) / g.setTube(m, a, b)  굵은 선(모서리·벡터) — 1px 선보다 진짜 같다
         g.line(점들, 색, {dashed:true})              보조선·점선
         g.ball(반지름, 색)                            점
         g.label('$\\theta$')                          글자표(교과서와 같은 기울임 글꼴)
         new T.RoundedBoxGeometry(w, h, d, 4, 0.06)    모서리가 살짝 둥근 상자(진짜 물건 느낌) */
      const body = new T.Mesh(new T.RoundedBoxGeometry(3, 2, 3, 4, 0.08), g.mat(th.shape, { roughness: 0.38 }));
      body.position.y = 1; body.castShadow = true; body.receiveShadow = true; scene.add(body);
      const lab = g.label('A'); lab.position.set(1.7, 2.2, 1.7); scene.add(lab);

      /* 조절 막대와 읽는 값 — 선생님이 칠판에서 바로 쓰는 것만 (3개 이하) */
      let angle = ctx.props.angle != null ? ctx.props.angle : 30;
      const grp = ctx.group('바꿔 보기');
      ctx.slider({ label: '각 θ', min: 0, max: 90, step: 1, value: angle, unit: '°', into: grp, onInput: (v) => { angle = v; update(); } });
      function update() {
        body.rotation.y = angle * Math.PI / 180;
        /* 각에 따라 바뀌는 값(길이·넓이·cos 등)이 있으면 ctx.readout({label, big:true}).set(값) 으로 크게 보여 준다 */
      }
      ctx._reset = () => { angle = ctx.props.angle != null ? ctx.props.angle : 30; update(); };
      /* 보는 방향 버튼 (교과서 그림과 같은 방향을 첫 번째로) */
      const views = ctx.group('보는 방향');
      ctx.segmented({ into: views, label: '보는 방향', value: 'book', options: [['book', '교과서처럼'], ['top', '위에서'], ['side', '옆에서']],
        onChange: (v) => (v === 'book' ? g.home() : v === 'top' ? g.flyTo([0, 18, 0.01], [0, 0, 0]) : g.flyTo([16, 2, 0], [0, 1, 0])) });
      update();
    }
  });
})();
"""


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('where', help='작업물/<교과서> 또는 engine'); ap.add_argument('id')
    ap.add_argument('--title', required=True); ap.add_argument('--sub', default=''); ap.add_argument('--desc', default='')
    a = ap.parse_args()
    if not re.fullmatch(r'[a-z][a-z0-9-]*', a.id):
        print('모형 이름은 영어 소문자·숫자·- 만 (예: cone-section)'); sys.exit(1)
    app = os.path.join(ROOT, 'engine', 'app') if a.where == 'engine' else os.path.join(os.path.abspath(a.where), 'app')
    p = os.path.join(app, 'assets', 'js', 'labs', a.id + '.js')
    if os.path.exists(p):
        print('이미 있어요:', p); sys.exit(1)
    js = TEMPLATE.replace('__ID__', a.id).replace('__TITLE__', a.title).replace('__SUB__', a.sub).replace('__DESC__', a.desc or a.title)
    open(p, 'w', encoding='utf-8').write(js)
    inject_lab(app, a.id + '.js')
    print('만들었어요:', p)
    print('확인: %s/labs.html?open=%s' % (app, a.id))


if __name__ == '__main__':
    main()

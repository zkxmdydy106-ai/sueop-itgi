/* 모형: 직육면체 속 공간벡터 (기하) — 직육면체 ABCD-EFGH에서 a=AB, b=AD, c=AE를 이어 붙여 공간벡터를 나타낸다.
   교과서 그림처럼: 윗면 ABCD(A 앞 왼쪽, B 앞 오른쪽, C 뒤 오른쪽, D 뒤 왼쪽), 아랫면 EFGH, 반투명 상자 + 점선 숨은 모서리.
   props: { size: [가로 AB, 깊이 AD, 높이 AE], ka, kb, kc (-1/0/1), from: 'A'(시점 꼭짓점), presets: [[이름, ka, kb, kc, from], …] }
   theme: { shape(상자 색), accent(a·b·c 화살표 색), line, second(결과 벡터 색) } */
(function () {
  'use strict';
  const DT = window.DT;
  DT.lab.register('vector-box', {
    title: '직육면체 속 공간벡터',
    sub: '수학 · 기하',
    desc: 'a, b, c를 이어 붙여 공간벡터 나타내기',
    hint: '한 손가락: 돌리기 · 두 손가락: 옮기기·확대',
    build(ctx) {
      const th = ctx.theme, P = ctx.props;
      const [SX, SZ, SY] = (P.size || [4.2, 2.6, 2.4]);
      /* 처음 모습: 교과서 그림처럼 거의 정면(앞면 ABFE가 반듯하고 깊이가 오른쪽 위로 들어감) */
      const g = ctx.three({ camera: [3.6, SY / 2 + 4.6, 15.5], target: [0, SY / 2, 0], fov: 22, maxPolar: Math.PI * 0.49, minDistance: 6, maxDistance: 40 });
      const T = g.T, scene = g.scene;
      const sun = new T.DirectionalLight(0xffffff, 1.9); sun.position.set(-5, 12, -4); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 }); sun.shadow.bias = -0.0004; sun.shadow.radius = 3;
      scene.add(sun, new T.HemisphereLight(0xffffff, 0xe9e2d2, 0.55));
      const floor = new T.Mesh(new T.PlaneGeometry(80, 80), new T.ShadowMaterial({ opacity: 0.07 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.02; floor.receiveShadow = true; scene.add(floor);

      /* 꼭짓점 (x 오른쪽, y 위, z 앞) — A 윗면 앞 왼쪽 */
      const x0 = -SX / 2, x1 = SX / 2, z0 = SZ / 2, z1 = -SZ / 2, yT = SY, yB = 0;
      const V = { A: [x0, yT, z0], B: [x1, yT, z0], C: [x1, yT, z1], D: [x0, yT, z1], E: [x0, yB, z0], F: [x1, yB, z0], G: [x1, yB, z1], H: [x0, yB, z1] };
      const box = new T.Mesh(new T.BoxGeometry(SX, SY, SZ), g.acrylic(th.shape || '#BFE6D6', 0.3)); box.position.set(0, SY / 2, 0); box.castShadow = true; box.renderOrder = 1; scene.add(box);
      const shadowBox = new T.Mesh(new T.BoxGeometry(SX, SY, SZ), new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false })); shadowBox.position.copy(box.position); shadowBox.castShadow = true; scene.add(shadowBox);
      const edges = [['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'], ['E', 'F'], ['F', 'G'], ['G', 'H'], ['H', 'E'], ['A', 'E'], ['B', 'F'], ['C', 'G'], ['D', 'H']];
      const hidden = new Set(['G-H', 'H-E', 'D-H']);
      edges.forEach(([p, q]) => { const k = p + '-' + q; scene.add(hidden.has(k) ? g.line([V[p], V[q]], th.line, { dashed: true, dash: 0.12, gap: 0.09, opacity: 0.8 }) : g.tube(V[p], V[q], 0.022, th.line)); });
      const ctr = new T.Vector3(0, SY / 2, 0);
      const away = (p, d) => { const v = new T.Vector3(...p); return v.clone().add(v.clone().sub(ctr).normalize().multiplyScalar(d)); };   /* 상자 중심에서 바깥쪽으로 조금 */
      Object.keys(V).forEach((n) => { const l = g.label(n, 'is-pt'); l.position.copy(away(V[n], 0.3)); scene.add(l); });

      /* 벡터 화살표 (굵은 막대 + 원뿔 머리) */
      function arrow(color, r, top) {
        const grp = new T.Group(); const m = g.mat(color, { roughness: 0.6, clearcoat: 0 });   /* 무광 — 교과서의 선 화살표에 가깝게 */
        /* 결과 벡터도 앞뒤(깊이)는 지킨다 — 맨 앞에 그리면 뒤쪽 HC가 앞쪽 AB 위로 올라와 보인다. 반투명 상자보다 먼저 그려 흐려지지 않게만 한다 */
        const shaft = new T.Mesh(new T.CylinderGeometry(r, r, 1, 20), m); const head = new T.Mesh(new T.ConeGeometry(r * 2.2, r * 7, 24), m);
        if (top) shaft.renderOrder = head.renderOrder = -1;
        shaft.castShadow = head.castShadow = true; grp.add(shaft, head); grp.userData = { shaft, head, r }; scene.add(grp); return grp;
      }
      function setArrow(a, p, q) {
        const A = new T.Vector3(...p), B = new T.Vector3(...q); const d = B.clone().sub(A); const L = d.length();
        a.visible = L > 1e-3; if (!a.visible) return;
        const hl = Math.min(a.userData.r * 7, L * 0.5);
        a.position.copy(A); a.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize());
        a.userData.shaft.scale.set(1, L - hl, 1); a.userData.shaft.position.set(0, (L - hl) / 2, 0); a.userData.head.scale.set(1, hl / (a.userData.r * 7), 1); a.userData.head.position.set(0, L - hl / 2, 0);
      }
      const col = th.accent || '#D8316A', colR = th.second || '#1B6A87';
      const basis = { a: arrow(col, 0.045), b: arrow(col, 0.045), c: arrow(col, 0.045) };
      setArrow(basis.a, V.A, V.B); setArrow(basis.b, V.A, V.D); setArrow(basis.c, V.A, V.E);
      const lav = g.label('$\\vec a$'), lbv = g.label('$\\vec b$'), lcv = g.label('$\\vec c$');
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2];
      lav.position.copy(away(mid(V.A, V.B), 0.32)); lbv.position.copy(away(mid(V.A, V.D), 0.32)); lcv.position.copy(away(mid(V.A, V.E), 0.32)); scene.add(lav, lbv, lcv);
      /* 이어 붙이는 길 (a 다음 b 다음 c) = 잉크색. 기준 벡터는 교과서 그림 색(theme.accent) */
      const PATH = th.line || '#17191B';
      const steps = [arrow(PATH, 0.05), arrow(PATH, 0.05), arrow(PATH, 0.05)];
      const result = arrow(colR, 0.08, true);   /* 결과 벡터는 상자에 가리지 않게 맨 앞에 */
      const dim = (o) => [basis.a, basis.b, basis.c].forEach((x) => x.children.forEach((mm) => { mm.material.transparent = true; mm.material.opacity = o; }));
      const dirs = { a: [SX, 0, 0], b: [0, 0, -SZ], c: [0, -SY, 0] };
      const names = Object.fromEntries(Object.entries(V).map(([n, p]) => [p.map((v) => v.toFixed(3)).join(','), n]));
      let k = { a: P.ka != null ? P.ka : 1, b: P.kb != null ? P.kb : 1, c: P.kc != null ? P.kc : -1 }, from = P.from || 'A', anim = 1, raf = 0;
      const add = (p, q, s) => [p[0] + q[0] * s, p[1] + q[1] * s, p[2] + q[2] * s];
      const term = (n, v, first) => (v === 0 ? '' : (v < 0 ? '-' : first ? '' : '+') + '\\vec ' + n);
      function update() {
        let p = V[from]; const pts = [p];
        ['a', 'b', 'c'].forEach((n, i) => { const q = add(p, dirs[n], k[n]); steps[i].visible = k[n] !== 0; if (k[n]) setArrow(steps[i], p, add(p, dirs[n], k[n] * Math.min(1, Math.max(0, anim * 3 - i)))); p = q; pts.push(q); });
        const endName = names[p.map((v) => v.toFixed(3)).join(',')];
        setArrow(result, V[from], anim >= 1 ? p : V[from]); result.visible = anim >= 1 && (k.a || k.b || k.c) !== 0;
        dim(result.visible ? 0.35 : 1);
        let tex = ''; ['a', 'b', 'c'].forEach((n) => { tex += term(n, k[n], tex === ''); });
        const vecName = endName && endName !== from ? '\\overrightarrow{\\mathrm{' + from + endName + '}}' : '';
        rv.set(tex ? '$' + (vecName ? vecName + '=' : '') + tex + '$' : '$\\vec 0$');
        rLen.set(Math.hypot(k.a * SX, k.b * SZ, k.c * SY) ? '도착: 꼭짓점 ' + (endName || '상자 밖') : '제자리');
      }
      function go() { cancelAnimationFrame(raf); const t0 = performance.now(); const run = (t) => { anim = Math.min(1, (t - t0) / 1500); update(); if (anim < 1) raf = requestAnimationFrame(run); }; raf = requestAnimationFrame(run); }
      ctx.onDispose(() => cancelAnimationFrame(raf));

      /* 조절: 시작 꼭짓점 + a, b, c를 몇 번(−1, 0, 1) */
      const g1 = ctx.group('시작 꼭짓점');
      const fromSeg = DT.el('div', { class: 'vbox__from' }); g1.append(fromSeg);
      Object.keys(V).forEach((n) => { const b = DT.el('button', { type: 'button', 'aria-pressed': n === from ? 'true' : 'false' }, n); b.onclick = () => { from = n; DT.$$('button', fromSeg).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); go(); }; fromSeg.append(b); });
      const g2 = ctx.group('더할 벡터');
      const rows = {};
      ['a', 'b', 'c'].forEach((n) => {
        const row = DT.el('div', { class: 'vbox__row' }, DT.el('span', { class: 'vbox__n', html: DT.md('$\\vec ' + n + '$') }));
        const seg = DT.el('div', { class: 'lab__seg' }); [[-1, '−' + n], [0, '없음'], [1, '+' + n]].forEach(([v, t]) => { const b = DT.el('button', { class: v ? 'vbox__k' : '', type: 'button', 'aria-pressed': v === k[n] ? 'true' : 'false', 'aria-label': n + ' ' + v }, t); b.onclick = () => { k[n] = v; DT.$$('button', seg).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); go(); }; seg.append(b); });
        row.append(seg); g2.append(row); rows[n] = seg;
      });
      const g3 = ctx.group('결과');
      const rv = ctx.readout({ into: g3, label: '', big: true }); rv.el.classList.add('vbox__res');
      const rLen = ctx.readout({ into: g3, label: '' });
      ctx.note('검은 화살표를 차례로 따라가면 도착 꼭짓점에 닿아요. 파란 화살표가 결과 벡터예요.', g3);
      if (P.presets && P.presets.length) {   /* 교과서 문제가 있으면 그것을 먼저, a·b·c 고르기는 접어 둔다 (조절 3개 이하) */
        const g4 = ctx.group('교과서 문제'); const r = DT.el('div', { class: 'lab__row' }); g4.append(r);
        P.presets.forEach(([lbl, a, b, c, f]) => ctx.button({ into: r, label: lbl, onClick: () => setAll(a, b, c, f) }));
        ctx.panel.insertBefore(g4, g1);
        g2.hidden = true; ctx.button({ into: g4, label: '직접 골라 보기', onClick: () => { g2.hidden = !g2.hidden; } });
      }
      function setAll(a, b, c, f) { k = { a, b, c }; from = f || 'A'; ['a', 'b', 'c'].forEach((n) => DT.$$('button', rows[n]).forEach((x, i) => x.setAttribute('aria-pressed', [-1, 0, 1][i] === k[n] ? 'true' : 'false'))); DT.$$('button', fromSeg).forEach((x) => x.setAttribute('aria-pressed', x.textContent === from ? 'true' : 'false')); go(); }
      ctx._reset = () => setAll(P.ka != null ? P.ka : 1, P.kb != null ? P.kb : 1, P.kc != null ? P.kc : -1, P.from || 'A');
      go();
    }
  });
  const st = document.createElement('style');
  st.textContent = '.vbox__from{display:grid;grid-template-columns:repeat(4,1fr);gap:.3em}.vbox__from button{min-height:2.3em;border-radius:.7em;background:var(--paper-2);font-family:"Times New Roman",Georgia,serif;font-size:1.15em;font-weight:700}.vbox__from button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}.vbox__row{display:grid;grid-template-columns:2em 1fr;align-items:center;gap:.5em}.vbox__n{font-size:1.3em}.vbox__res .lab__rval{font-size:1.45em!important}.vbox__k{font-family:"Times New Roman",Georgia,serif;font-style:italic;font-size:1.1em!important}';
  document.head.append(st);
})();

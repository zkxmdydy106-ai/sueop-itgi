/* 모형: 좌표공간의 벡터 (기하) — 점 A(a1, a2, a3)의 위치벡터 a를 성분으로 쪼개 보고, 크기 |a| = √(a1²+a2²+a3²)를 본다.
   교과서 127·128쪽 그림처럼: x축은 앞(왼쪽 아래), y축은 오른쪽, z축은 위. 주황 상자, 분홍 위치벡터.
   props: { a: [a1, a2, a3], mode: 'comp' | 'unit' | 'ab', b: [b1, b2, b3] }
   theme: { accent(위치벡터), shape(상자 색), line } */
(function () {
  'use strict';
  const DT = window.DT;
  DT.lab.register('vector-coord', {
    title: '좌표공간의 벡터',
    sub: '수학 · 기하',
    desc: '성분을 바꾸며 위치벡터와 크기 보기',
    hint: '한 손가락: 돌리기 · 두 손가락: 옮기기·확대',
    build(ctx) {
      const th = ctx.theme, P = ctx.props;
      /* 수학 좌표 (x, y, z) → 화면 (y, z, x): x는 앞쪽, y는 오른쪽, z는 위 */
      const W = (p) => [p[1], p[2], p[0]];
      const WIDE = P.mode === 'line' || P.mode === 'plane' || P.mode === 'sphere';
      const g = ctx.three(WIDE ? { camera: [10, 9, 20], target: [1.5, 2.2, 1], fov: 30, minDistance: 6, maxDistance: 60 } : { camera: [5.5, 5.2, 12.5], target: [1.2, 1.2, 0.8], fov: 30, minDistance: 6, maxDistance: 40 });
      const T = g.T, scene = g.scene;
      const sun = new T.DirectionalLight(0xffffff, 1.8); sun.position.set(-4, 12, 6); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
      scene.add(sun, new T.HemisphereLight(0xffffff, 0xe9e2d2, 0.6));
      const col = th.accent || '#E0336A', ink = th.line || '#17191B', box = th.shape || '#F6C08F', comp = '#13A07D';
      const MAX = WIDE ? 6.6 : 4.6;
      /* 좌표축 */
      [[[-1.2, 0, 0], [MAX + 0.6, 0, 0], 'x'], [[0, -1.2, 0], [MAX + 0.6, 0, 0].map((v, i) => [0, MAX + 0.6, 0][i]), 'y'], [[0, 0, -1.2], [0, 0, MAX + 0.6], 'z']].forEach(([a, b, n]) => {
        scene.add(g.tube(W(a), W(b), 0.018, ink));
        const head = new T.Mesh(new T.ConeGeometry(0.07, 0.24, 20), g.mat(ink)); const d = new T.Vector3(...W(b)).sub(new T.Vector3(...W(a))).normalize();
        head.position.set(...W(b)); head.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d); scene.add(head);
        const l = g.label(n); l.position.set(...W(b.map((v) => v + (v ? 0.35 * Math.sign(v) : 0)))); scene.add(l);
      });
      const lo = g.label('O', 'is-pt'); lo.position.set(...W([0.25, -0.25, -0.25])); scene.add(lo);
      /* 눈금 */
      for (let i = 1; i <= (WIDE ? 6 : 4); i++) ['x', 'y', 'z'].forEach((ax, k) => { const p = [0, 0, 0]; p[k] = i; const t = g.label(String(i), 'is-sub'); t.position.set(...W(p.map((v, j) => (j === k ? v : -0.22)))); scene.add(t); });
      /* 화살표 */
      function arrow(color, r) {
        const grp = new T.Group(); const m = g.mat(color, { roughness: 0.55, clearcoat: 0 });
        const shaft = new T.Mesh(new T.CylinderGeometry(r, r, 1, 18), m), head = new T.Mesh(new T.ConeGeometry(r * 2.4, r * 7, 22), m);
        shaft.castShadow = head.castShadow = true; grp.add(shaft, head); grp.userData = { shaft, head, r }; scene.add(grp); return grp;
      }
      function setArrow(a, p, q) {
        const A = new T.Vector3(...W(p)), B = new T.Vector3(...W(q)); const d = B.clone().sub(A); const L = d.length(); a.visible = L > 1e-3; if (!a.visible) return;
        const hl = Math.min(a.userData.r * 7, L * 0.5); a.position.copy(A); a.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
        a.userData.shaft.scale.set(1, L - hl, 1); a.userData.shaft.position.set(0, (L - hl) / 2, 0); a.userData.head.scale.set(1, hl / (a.userData.r * 7), 1); a.userData.head.position.set(0, L - hl / 2, 0);
      }
      const va = arrow(col, 0.05), cx = arrow(comp, 0.04), cy = arrow(comp, 0.04), cz = arrow(comp, 0.04);
      const e = [arrow(col, 0.045), arrow(col, 0.045), arrow(col, 0.045)]; setArrow(e[0], [0, 0, 0], [1, 0, 0]); setArrow(e[1], [0, 0, 0], [0, 1, 0]); setArrow(e[2], [0, 0, 0], [0, 0, 1]);
      const eL = ['e_1', 'e_2', 'e_3'].map((n, k) => { const l = g.label('$\\vec{e}_' + n.slice(2) + '$'); const p = [0, 0, 0]; p[k] = 0.55; p[(k + 1) % 3] = -0.3; l.position.set(...W(p)); scene.add(l); return l; });
      /* 성분 상자 (반투명) + 점선 모서리 */
      const boxMesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), g.acrylic(box, 0.35)); scene.add(boxMesh);
      const boxEdges = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1)), new T.LineDashedMaterial({ color: ink, dashSize: 0.12, gapSize: 0.09, transparent: true, opacity: 0.75 })); scene.add(boxEdges);
      const pA = g.ball(0.07, ink); scene.add(pA); const lA = g.label('A', 'is-pt'); scene.add(lA);
      const la = g.label('$\\vec a$'); scene.add(la);
      /* 두 점 A, B (AB 성분) */
      const vb = arrow(ink, 0.04), vab = arrow(col, 0.05), pB = g.ball(0.07, ink), lB = g.label('B', 'is-pt'), lab = g.label('$\\overrightarrow{\\mathrm{AB}}$'); scene.add(pB, lB, lab);
      let a = (P.a || [2, 3, 2]).slice(), b = (P.b || [1, 1, 3]).slice(), mode = P.mode || 'comp', t = P.t != null ? P.t : 1;
      /* 평면 모드 (교과서 156쪽): 점 A를 지나고 법선벡터 n=b에 수직인 평면 위의 점 P = A + s e₁' + t e₂' */
      const planeM = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshStandardMaterial({ color: new T.Color('#E8A0B8'), transparent: true, opacity: 0.38, roughness: 0.6, side: T.DoubleSide, depthWrite: false })); scene.add(planeM);
      const planeE = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(1, 1)), new T.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.8 })); scene.add(planeE);
      const vn = arrow('#1E9BD7', 0.05), vap = arrow(comp, 0.045), ln_ = g.label('$\\vec n$'), lal = g.label('α'); scene.add(ln_, lal);
      /* 구 모드 (교과서 164쪽): 중심 C=a, 반지름 r, 구 위의 점 P */
      const sph = new T.Mesh(new T.SphereGeometry(1, 64, 40), new T.MeshStandardMaterial({ color: new T.Color('#F6C9A8'), transparent: true, opacity: 0.45, roughness: 0.35, depthWrite: false })); scene.add(sph);
      const vcp = arrow(col, 0.045), lcp = g.label('$\\vec p-\\vec c$');  scene.add(lcp);
      let s2 = P.s != null ? P.s : 1, rr = P.r || 2, lon = P.lon != null ? P.lon : 0, lat = P.lat != null ? P.lat : 30;
      const lC = g.label('C', 'is-pt'), lc = g.label('$\\vec c$'); scene.add(lC, lc);
      /* 직선 모드 (교과서 147·149쪽): 점 A를 지나고 방향벡터 u=b에 평행한 직선 m 위의 점 P = A + t u */
      const lineM = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 1, 12), g.mat('#1E9BD7')); scene.add(lineM);
      const vu = arrow('#F08A24', 0.05), vp = arrow(ink, 0.04), vtu = arrow(comp, 0.045), pP = g.ball(0.09, ink), lP = g.label('P', 'is-pt'), lu = g.label('$\\vec u$'), lm = g.label(P.lineName || 'l'); scene.add(pP, lP, lu, lm);
      const sq = (v) => v.reduce((s, x) => s + x * x, 0);
      const len = (v) => { const q = sq(v); const r = Math.round(Math.sqrt(q)); return r * r === q ? String(r) : '√' + q; };
      function update() {
        const A = a;
        setArrow(va, [0, 0, 0], A); setArrow(cx, [0, 0, 0], [A[0], 0, 0]); setArrow(cy, [0, 0, 0], [0, A[1], 0]); setArrow(cz, [0, 0, 0], [0, 0, A[2]]);
        const w = W(A); const sx = Math.abs(w[0]) || 0.001, sy = Math.abs(w[1]) || 0.001, sz = Math.abs(w[2]) || 0.001;
        [boxMesh, boxEdges].forEach((m) => { m.scale.set(sx, sy, sz); m.position.set(w[0] / 2, w[1] / 2, w[2] / 2); });
        boxEdges.computeLineDistances && boxEdges.computeLineDistances();
        pA.position.set(...w); lA.position.set(w[0] + 0.3, w[1] + 0.3, w[2]);
        la.position.set(w[0] / 2 - 0.25, w[1] / 2 + 0.35, w[2] / 2);
        const ab = mode === 'ab';
        [vb, vab, pB, lB, lab].forEach((o) => (o.visible = ab)); [cx, cy, cz, boxMesh, boxEdges].forEach((o) => (o.visible = !ab && mode === 'comp'));
        e.forEach((x) => (x.visible = mode === 'unit')); eL.forEach((x) => (x.visible = mode === 'unit'));
        if (ab) { setArrow(vb, [0, 0, 0], b); setArrow(vab, A, b); const wb = W(b); pB.position.set(...wb); lB.position.set(wb[0] + 0.3, wb[1] + 0.3, wb[2]); lab.position.set((w[0] + wb[0]) / 2, (w[1] + wb[1]) / 2 + 0.4, (w[2] + wb[2]) / 2); }
        const d = [b[0] - A[0], b[1] - A[1], b[2] - A[2]];
        const ln = mode === 'line', pl = mode === 'plane', sp = mode === 'sphere';
        [planeM, planeE, vn, vap, ln_, lal].forEach((o) => (o.visible = pl)); [sph, vcp, lcp, lC, lc].forEach((o) => (o.visible = sp)); if (sp) { lA.visible = la.visible = false; }
        if (pl || sp) { [cx, cy, cz, boxMesh, boxEdges, lineM, vu, vtu, lu, lm].forEach((o) => (o.visible = false)); [vp, pP, lP].forEach((o) => (o.visible = true)); (pl ? planeLayout : sphereLayout)(); return; }
        [lineM, vu, vp, vtu, pP, lP, lu, lm].forEach((o) => (o.visible = ln)); if (ln) { [cx, cy, cz, boxMesh, boxEdges].forEach((o) => (o.visible = false)); lineLayout(); return; }
        r1.set(ab ? '$\\overrightarrow{\\mathrm{AB}}=(' + d.join(',\\ ') + ')$' : '$\\vec a=(' + A.join(',\\ ') + ')$');
        r2.set(ab ? '$|\\overrightarrow{\\mathrm{AB}}|=' + len(d).replace('√', '\\sqrt{') + (len(d).includes('√') ? '}' : '') + '$' : '$|\\vec a|=' + len(A).replace('√', '\\sqrt{') + (len(A).includes('√') ? '}' : '') + '$');
      }
      function lineLayout() {
        const A = a, u = b, Pp = [0, 1, 2].map((k) => A[k] + t * u[k]);
        const wa = new T.Vector3(...W(A)), wu = new T.Vector3(...W(u)); const L = wu.length() || 1; const dir = wu.clone().normalize();
        lineM.position.copy(wa); lineM.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir); lineM.scale.set(1, 18, 1);
        setArrow(vu, [0, 0, 0], u); setArrow(vp, [0, 0, 0], Pp); setArrow(vtu, A, Pp);
        const wp = W(Pp); pP.position.set(...wp); lP.position.set(wp[0] + 0.3, wp[1] + 0.35, wp[2]);
        const wuh = W(u.map((x) => x / 2)); lu.position.set(wuh[0] + 0.3, wuh[1] + 0.3, wuh[2]);
        const wm = W(A.map((x, k) => x + 2.6 * u[k] / L)); lm.position.set(wm[0] + 0.45, wm[1] - 0.2, wm[2] + 0.45);
        const xm = (n, c) => (c === 0 ? n : n + (c > 0 ? '-' + c : '+' + (-c))), fr = (num, den) => (den === 1 ? num : '\\dfrac{' + num + '}{' + den + '}');
        const parts = ['x', 'y', 'z'].map((n, k) => (u[k] ? fr(xm(n, A[k]), u[k]) : null));
        const zeros = ['x', 'y', 'z'].map((n, k) => (u[k] ? null : n + '=' + A[k])).filter(Boolean);
        const eq = parts.filter(Boolean).join('=') + (zeros.length ? (parts.some(Boolean) ? ',\\ ' : '') + zeros.join(',\\ ') : '');
        r1.set('$' + eq + '$'); r2.set('$\\mathrm{P}(' + Pp.map((x) => Math.round(x * 100) / 100).join(',\\ ') + ')$');
      }
      const fmt2 = (x) => String(Math.round(x * 100) / 100);
      const term = (k, n, first) => (k === 0 ? '' : (k < 0 ? '-' : first ? '' : '+') + (Math.abs(k) === 1 ? '' : Math.abs(k)) + n);
      function planeLayout() {
        const A = a, n = b, nl = Math.hypot(...n) || 1, nu = n.map((x) => x / nl);
        const h = Math.abs(nu[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
        const cr = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        let e1 = cr(nu, h); const l1 = Math.hypot(...e1); e1 = e1.map((x) => x / l1); const e2 = cr(nu, e1);
        const Pp = [0, 1, 2].map((k) => A[k] + s2 * e1[k] + t * e2[k]);
        const wn = new T.Vector3(...W(nu));
        [planeM, planeE].forEach((m) => { m.position.set(...W(A)); m.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), wn); m.scale.set(6.5, 6.5, 1); });
        setArrow(vn, A, A.map((x, k) => x + 1.8 * nu[k])); setArrow(vap, A, Pp); setArrow(vp, [0, 0, 0], Pp);
        const wnl = W(A.map((x, k) => x + 1.9 * nu[k])); ln_.position.set(wnl[0] + 0.3, wnl[1] + 0.2, wnl[2]);
        const wal = W(A.map((x, k) => x + 3.4 * e1[k] + 3.4 * e2[k])); lal.position.set(...wal);
        const wp = W(Pp); pP.position.set(...wp); lP.position.set(wp[0] + 0.3, wp[1] + 0.35, wp[2]);
        const d = -(n[0] * A[0] + n[1] * A[1] + n[2] * A[2]);
        const lhs = term(n[0], 'x', true) + term(n[1], 'y', !n[0]) + term(n[2], 'z', !n[0] && !n[1]) + (d === 0 ? '' : (d > 0 ? '+' : '-') + Math.abs(d));
        const dot = [0, 1, 2].reduce((acc, k) => acc + (Pp[k] - A[k]) * n[k], 0);
        r1.set('$' + lhs + '=0$'); r2.set('$\\overrightarrow{\\mathrm{AP}}\\cdot\\vec n=' + fmt2(Math.abs(dot) < 1e-9 ? 0 : dot) + '$');
      }
      function sphereLayout() {
        const C = a, th = lon * Math.PI / 180, ph = lat * Math.PI / 180;
        const Pp = [C[0] + rr * Math.cos(ph) * Math.cos(th), C[1] + rr * Math.cos(ph) * Math.sin(th), C[2] + rr * Math.sin(ph)];
        sph.position.set(...W(C)); sph.scale.set(rr, rr, rr);
        const wc = W(C); lC.position.set(wc[0] + 0.3, wc[1] - 0.35, wc[2]); lc.position.set(wc[0] / 2 + 0.35, wc[1] / 2 + 0.2, wc[2] / 2);
        setArrow(vcp, C, Pp); setArrow(vp, [0, 0, 0], Pp);
        const wp = W(Pp); pP.position.set(...wp); lP.position.set(wp[0] + 0.3, wp[1] + 0.35, wp[2]);
        const wm = W(C.map((x, k) => (x + Pp[k]) / 2)); const w4 = W(C.map((x, k) => x + 0.3 * (Pp[k] - x))); lcp.position.set(w4[0] + 0.25, w4[1] + 0.6, w4[2]);
        const sq = (n, c) => (c === 0 ? n + '^2' : '(' + n + (c > 0 ? '-' + c : '+' + (-c)) + ')^2');
        r1.set('$\\begin{aligned}&' + sq('x', C[0]) + '+' + sq('y', C[1]) + '\\\\&+' + sq('z', C[2]) + '=' + fmt2(rr * rr) + '\\end{aligned}$');
        r2.set('$|\\vec p-\\vec c|=' + fmt2(Math.hypot(Pp[0] - C[0], Pp[1] - C[1], Pp[2] - C[2])) + '$');
      }
      /* 조절: 보기 + 성분 세 개 */
      const g0 = ctx.group('무엇을 볼까요');
      ctx.segmented({ into: g0, label: '보기', value: mode, options: [['unit', 'e₁ e₂ e₃'], ['comp', '성분'], ['ab', '두 점 A, B']], onChange: (v) => { mode = v; update(); } });
      const g1 = ctx.group('점 A의 좌표');
      const sl = ['a₁ (x)', 'a₂ (y)', 'a₃ (z)'].map((t, k) => ctx.slider({ into: g1, label: t, min: -3, max: 5, step: 1, value: a[k], format: (v) => String(v), onInput: (v) => { a[k] = v; update(); } }));
      const gu = ctx.group('방향벡터 u');
      const su = ['u₁', 'u₂', 'u₃'].map((tt, k) => ctx.slider({ into: gu, label: tt, min: -5, max: 5, step: 1, value: b[k], format: (v) => String(v), onInput: (v) => { b[k] = v; if (!b.some(Boolean)) b[k] = 1; update(); } }));
      const st_ = ctx.slider({ into: gu, label: '실수 t', min: -3, max: 3, step: 0.25, value: t, format: (v) => String(v), onInput: (v) => { t = v; update(); } });
      if (mode !== 'line') gu.hidden = true; else g0.hidden = true;
      if (mode === 'plane') { gu.hidden = false; g0.hidden = true; gu.querySelector('.lab__gtitle').textContent = '법선벡터 n'; su.forEach((x, k) => (x.el.querySelector('.lab__slabel').firstChild.textContent = ['n₁', 'n₂', 'n₃'][k])); st_.el.querySelector('.lab__slabel').firstChild.textContent = '평면 위 이동 t'; }
      const gs = ctx.group(mode === 'sphere' ? '반지름과 점 P' : '');
      const ss = ctx.slider({ into: mode === 'plane' ? gu : gs, label: mode === 'plane' ? '평면 위 이동 s' : '반지름 r', min: mode === 'plane' ? -3 : 1, max: 3, step: mode === 'plane' ? 0.25 : 0.5, value: mode === 'plane' ? s2 : rr, format: (v) => String(v), onInput: (v) => { if (mode === 'plane') s2 = v; else rr = v; update(); } });
      const sl1 = ctx.slider({ into: gs, label: '점 P 돌리기 (옆)', min: 0, max: 360, step: 15, value: lon, unit: '°', onInput: (v) => { lon = v; update(); } });
      const sl2 = ctx.slider({ into: gs, label: '점 P 돌리기 (위아래)', min: -90, max: 90, step: 15, value: lat, unit: '°', onInput: (v) => { lat = v; update(); } });
      if (mode === 'plane') g1.hidden = true;
      if (mode !== 'sphere') gs.hidden = true; else { g0.hidden = true; g1.querySelector('.lab__gtitle').textContent = '중심 C의 좌표'; sl.forEach((x, k) => (x.el.querySelector('.lab__slabel').firstChild.textContent = ['x₁', 'y₁', 'z₁'][k])); }
      const g2 = ctx.group('결과');
      const r1 = ctx.readout({ into: g2, label: '', big: true }), r2 = ctx.readout({ into: g2, label: '' });
      [r1, r2].forEach((r) => r.el.classList.add('vc-eq'));
      const fitEq = () => [r1, r2].forEach((r) => { const v = r.el.querySelector('.lab__rval'); if (!v) return; v.style.fontSize = ''; const w = (r.el.clientWidth - 4) || 1, vw = v.getBoundingClientRect().width; if (vw > w) v.style.fontSize = (parseFloat(getComputedStyle(v).fontSize) * w / vw) + 'px'; });
      const _set1 = r1.set, _set2 = r2.set; r1.set = (x) => { _set1(x); requestAnimationFrame(fitEq); }; r2.set = (x) => { _set2(x); requestAnimationFrame(fitEq); };
      const nt = ctx.note('초록 화살표가 $x$, $y$, $z$ 방향의 성분이에요. 상자의 대각선이 $\\vec a$예요.', g2);
      ctx._reset = () => { a = (P.a || [2, 3, 2]).slice(); b = (P.b || [1, 1, 3]).slice(); t = P.t != null ? P.t : 1; sl.forEach((x, k) => x.set(a[k])); su.forEach((x, k) => x.set(b[k])); st_.set(t); update(); };
      if (mode === 'line') nt.innerHTML = DT.md('점 A와 방향벡터 $\\vec u$를 바꾸고 $t$를 움직여 보세요. 초록 화살표가 $t\\vec u$예요.');
      if (mode === 'plane') nt.innerHTML = DT.md('$\\vec n$의 성분과 $s$, $t$를 바꿔 보세요. 평면 위의 점 P에 대하여 $\\overrightarrow{\\mathrm{AP}}\\cdot\\vec n=0$이에요.');
      if (mode === 'sphere') nt.hidden = true; if (false) nt.innerHTML = DT.md('반지름과 점 P를 움직여 보세요. 구 위의 점 P는 언제나 $|\\vec p-\\vec c|=r$이에요.');
      update();
    }
  });
  if (!document.getElementById('vc-eq-style')) { const st = document.createElement('style'); st.id = 'vc-eq-style'; st.textContent = '.lab__read.vc-eq{flex-direction:column;align-items:flex-start;gap:.15em}.lab__read.vc-eq .lab__rval{white-space:nowrap}.lab__read--big.vc-eq .lab__rval{font-size:1.45em}'; document.head.append(st); }
})();

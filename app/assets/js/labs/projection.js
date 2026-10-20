/* 모형: 정사영 (기하) — 두 평면을 경첩처럼 벌리며 선분·도형의 정사영과 cosθ 관계를 본다.
   props: { mode: 'segment' | 'area', angle: 0~90 }
   theme: { plane(β), plane2(α), line, accent, shape } — 교과서 그림 색을 그대로 쓴다. */
(function () {
  'use strict';
  const DT = window.DT;
  DT.lab.register('projection', {
    title: '정사영 3D 실험실',
    hint: '끌어서 돌려 보세요 · 막대로 두 평면의 각 θ를 바꿔요',
    build(ctx) {
      const th = ctx.theme;
      const g = ctx.three({ camera: [10.5, 8.8, 15.5], target: [0, 1.3, -0.9], fov: 34, maxPolar: Math.PI * 0.49, minDistance: 6, maxDistance: 40 });
      const T = g.T, scene = g.scene;
      let mode = ctx.props.mode === 'segment' ? 'segment' : 'area';
      let theta = ctx.props.angle != null ? ctx.props.angle : 35;
      const Z0 = 2.4, DEPTH = 5.6, HALF = 4.6;

      /* 빛: 위에서 수직으로 비추는 해 + 부드러운 채움빛 */
      const sun = new T.DirectionalLight(0xffffff, 2.2); sun.position.set(0, 18, 0); sun.target.position.set(0, 0, 0);
      sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 }); sun.shadow.bias = -0.0004; sun.shadow.radius = 3;
      scene.add(sun, sun.target, new T.HemisphereLight(0xffffff, 0xe9e2d2, 0.55));
      /* 바닥(책상)에 생기는 부드러운 그림자 */
      const floor = new T.Mesh(new T.PlaneGeometry(60, 60), new T.ShadowMaterial({ opacity: 0.12 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -0.7; floor.receiveShadow = true; scene.add(floor);

      /* 평면 α (바닥 평면) */
      const alphaGeo = new T.BoxGeometry(HALF * 2 + 0.8, 0.08, 8.4);
      const alpha = new T.Mesh(alphaGeo, g.acrylic(th.plane2, 0.78)); alpha.position.set(0, -0.04, -0.6); alpha.receiveShadow = true; scene.add(alpha);
      alpha.add(new T.LineSegments(new T.EdgesGeometry(alphaGeo), new T.LineBasicMaterial({ color: th.line, transparent: true, opacity: 0.75 })));
      const la = g.label('α'); la.position.set(HALF + 0.05, 0.05, 3.2); scene.add(la);

      /* 평면 β (경첩: 직선 l 을 축으로 θ만큼 들림) */
      const hinge = new T.Group(); hinge.position.set(0, 0, Z0); scene.add(hinge);
      const betaGeo = new T.BoxGeometry(HALF * 2, 0.06, DEPTH); betaGeo.translate(0, 0.03, -DEPTH / 2);
      const beta = new T.Mesh(betaGeo, g.acrylic(th.plane, 0.7)); beta.castShadow = false; hinge.add(beta);
      beta.add(new T.LineSegments(new T.EdgesGeometry(betaGeo), new T.LineBasicMaterial({ color: th.line, transparent: true, opacity: 0.75 })));
      const lb = g.label('β'); lb.position.set(HALF - 0.4, 0.25, -DEPTH + 0.35); hinge.add(lb);
      const hingeLine = g.tube([-HALF - 0.6, 0.01, Z0], [HALF + 0.6, 0.01, Z0], 0.035, th.line); scene.add(hingeLine);
      const ll = g.label('l'); ll.position.set(-HALF - 0.9, 0.05, Z0); scene.add(ll);

      /* β 위의 점 (x, d) → 세계 좌표 */
      const onBeta = (x, d, lift) => { const t = theta * Math.PI / 180, h = lift == null ? 0.11 : lift; return [x, d * Math.sin(t) + h * Math.cos(t), Z0 - d * Math.cos(t) + h * Math.sin(t)]; };
      const proj = (p) => [p[0], 0.012, p[2]];

      /* 선분 AB */
      const segA = [1.2, 0.7], segB = [1.2, 4.7]; const AB = 4;
      const seg = g.tube([0, 0, 0], [0, 1, 0], 0.07, th.accent); seg.castShadow = false; scene.add(seg);
      const segP = g.tube([0, 0, 0], [0, 1, 0], 0.055, th.line); scene.add(segP);
      const ballA = g.ball(0.13, th.accent), ballB = g.ball(0.13, th.accent), ballA2 = g.ball(0.11, th.line), ballB2 = g.ball(0.11, th.line);
      scene.add(ballA, ballB, ballA2, ballB2);
      const lA = g.label('A'), lB = g.label('B'), lA2 = g.label('A′'), lB2 = g.label('B′'); scene.add(lA, lB, lA2, lB2);

      /* 삼각형 (넓이 S = 10) */
      const tri = [[-2.5, 0.9], [2.5, 0.9], [0, 4.9]]; const S = 10;
      const triGeo = new T.BufferGeometry(); triGeo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(9), 3)); triGeo.setIndex([0, 1, 2]);
      const triMesh = new T.Mesh(triGeo, new T.MeshPhysicalMaterial({ color: th.shape, roughness: 0.35, clearcoat: 0.6, transparent: true, opacity: 0.88, side: T.DoubleSide })); triMesh.castShadow = false; scene.add(triMesh);
      const triOut = new T.LineLoop(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: th.line })); scene.add(triOut);
      const pGeo = new T.BufferGeometry(); pGeo.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(9), 3)); pGeo.setIndex([0, 1, 2]);
      const pMesh = new T.Mesh(pGeo, new T.MeshBasicMaterial({ color: new T.Color(th.shape).multiplyScalar(0.55), transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false })); scene.add(pMesh);
      const pOut = new T.LineLoop(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: th.line })); scene.add(pOut);
      const lS = g.label('S'), lS2 = g.label('S′'); scene.add(lS, lS2);

      /* 수선(점선) 3개 */
      const drops = [0, 1, 2].map(() => { const l = g.line([[0, 0, 0], [0, 1, 0]], th.line, { dashed: true, dash: 0.16, gap: 0.12, opacity: 0.9 }); scene.add(l); return l; });
      /* 빛줄기 (켜면 보임) */
      const beams = new T.Group(); scene.add(beams);
      for (let i = -3; i <= 3; i += 1.5) for (let j = -3.5; j <= 1.5; j += 1.6) beams.add(g.line([[i, 9, j], [i, 0.05, j]], '#E6A532', { dashed: true, dash: 0.3, gap: 0.25, opacity: 0.55 }));
      beams.visible = false;
      /* 각 θ 표시 (경첩 끝에서 α와 β 사이 호) */
      const arc = new T.Mesh(new T.BufferGeometry(), g.mat(th.accent, { roughness: 0.4 })); scene.add(arc);
      const lT = g.label('θ'); scene.add(lT);

      function setPos(o, p) { o.position.set(p[0], p[1], p[2]); }
      function setLine(l, a, b) { l.geometry.setFromPoints([new T.Vector3(...a), new T.Vector3(...b)]); l.computeLineDistances(); }
      function update() {
        hinge.rotation.x = theta * Math.PI / 180;
        const c = Math.cos(theta * Math.PI / 180);
        const segOn = mode === 'segment';
        [seg, segP, ballA, ballB, ballA2, ballB2, lA, lB, lA2, lB2].forEach((o) => (o.visible = segOn));
        [triMesh, triOut, pMesh, pOut, lS, lS2].forEach((o) => (o.visible = !segOn));
        if (segOn) {
          const A = onBeta(...segA), B = onBeta(...segB), A2 = proj(A), B2 = proj(B);
          g.setTube(seg, A, B); g.setTube(segP, A2, B2);
          setPos(ballA, A); setPos(ballB, B); setPos(ballA2, A2); setPos(ballB2, B2);
          setPos(lA, [A[0] + 0.35, A[1] + 0.3, A[2]]); setPos(lB, [B[0] + 0.35, B[1] + 0.35, B[2]]); setPos(lA2, [A2[0] + 0.45, 0.25, A2[2] - 0.2]); setPos(lB2, [B2[0] + 0.45, 0.25, B2[2] + 0.2]);
          setLine(drops[0], A, A2); setLine(drops[1], B, B2); drops[2].visible = false; drops[0].visible = drops[1].visible = true;
        } else {
          const P = tri.map((t) => onBeta(...t)); const Q = P.map(proj);
          triGeo.attributes.position.array.set(P.flat()); triGeo.attributes.position.needsUpdate = true; triGeo.computeVertexNormals(); triGeo.computeBoundingSphere();
          pGeo.attributes.position.array.set(Q.map((q) => [q[0], 0.02, q[2]]).flat()); pGeo.attributes.position.needsUpdate = true; pGeo.computeBoundingSphere();
          triOut.geometry.setFromPoints(P.map((p) => new T.Vector3(p[0], p[1] + 0.005, p[2])));
          pOut.geometry.setFromPoints(Q.map((q) => new T.Vector3(q[0], 0.025, q[2])));
          const cP = P.reduce((a, p) => [a[0] + p[0] / 3, a[1] + p[1] / 3, a[2] + p[2] / 3], [0, 0, 0]); const cQ = proj(cP);
          setPos(lS, [cP[0], cP[1] + 0.25, cP[2]]); setPos(lS2, [cQ[0], 0.2, cQ[2]]);
          P.forEach((p, i) => { drops[i].visible = true; setLine(drops[i], p, Q[i]); });
        }
        const pts = []; const r = 1.5; const x = -HALF + 0.2;
        for (let i = 0; i <= 32; i++) { const a = theta * Math.PI / 180 * i / 32; pts.push(new T.Vector3(x, r * Math.sin(a) + 0.02, Z0 - r * Math.cos(a))); }
        arc.geometry.dispose(); arc.geometry = pts.length > 1 && theta > 0.5 ? new T.TubeGeometry(new T.CatmullRomCurve3(pts), 40, 0.035, 8, false) : new T.BufferGeometry();
        const am = theta * Math.PI / 360; setPos(lT, [x - 0.1, (r + 0.5) * Math.sin(am), Z0 - (r + 0.5) * Math.cos(am)]);
        lT.visible = theta > 3;
        rCos.set(c.toFixed(3));
        if (segOn) { rA.set('4'); rB.set((AB * c).toFixed(2)); }
        else { rA.set(String(S)); rB.set((S * c).toFixed(2)); }
        bars.style.setProperty('--k', c);
        chart.draw([{ pts: Array.from({ length: 46 }, (_, i) => [i * 2, (segOn ? AB : S) * Math.cos(i * 2 * Math.PI / 180)]), color: '#2A78D6' }], { x0: 0, x1: 90, y0: 0, y1: (segOn ? AB : S) * 1.05, marks: [[theta, (segOn ? AB : S) * c, th.accent]] });
      }

      /* 조절 막대 */
      const g1 = ctx.group();
      ctx.segmented({ into: g1, label: '보기', value: mode, options: [['area', '도형의 넓이'], ['segment', '선분의 길이']], onChange: (v) => { mode = v; relabel(); update(); } });
      const sl = ctx.slider({ into: g1, label: '두 평면이 이루는 각 θ', min: 0, max: 90, value: theta, unit: '°', onInput: (v) => { theta = v; update(); } });
      const g2 = ctx.group('계산');
      const rCos = ctx.readout({ into: g2, label: 'cos θ' });
      const rA = ctx.readout({ into: g2, label: 'S' }); const rB = ctx.readout({ into: g2, label: "S′ = S cos θ", big: true });
      const bars = DT.el('div', { class: 'projbars', 'aria-hidden': 'true' }, DT.el('i', { class: 'projbars__a' }), DT.el('i', { class: 'projbars__b' }));
      g2.append(bars);
      const chart = DT.lab.miniChart({ w: 320, h: 120, label: 'θ에 따른 정사영의 크기', xlabel: 'θ(°)', ylabel: '정사영' }); g2.append(chart.el);
      function relabel() { const seg = mode === 'segment'; rA.el.querySelector('.lab__rlabel').innerHTML = seg ? 'AB' : 'S'; rB.el.querySelector('.lab__rlabel').innerHTML = seg ? "A′B′ = AB cos θ" : "S′ = S cos θ"; }
      const g3 = ctx.group('보기 바꾸기');
      ctx.toggle({ into: g3, label: '위에서 빛 비추기 (그림자)', value: false, onChange: (v) => { beams.visible = v; triMesh.castShadow = v; beta.castShadow = false; seg.castShadow = v; pMesh.visible = mode === 'area' && !v ? true : mode === 'area'; pMesh.material.opacity = v ? 0.25 : 0.55; } });
      const row = DT.el('div', { class: 'lab__row' }); g3.append(row);
      ctx.button({ into: row, label: '옆에서', onClick: () => g.flyTo([-16, 2.6, Z0 - 1.6], [0, 1.4, Z0 - 1.8]) });
      ctx.button({ into: row, label: '위에서', onClick: () => g.flyTo([0, 18, -0.58], [0, 0, -0.6]) });
      ctx.button({ into: row, label: '비스듬히', onClick: () => g.home() });
      let playing = null;
      ctx.button({ into: g3, label: '0°에서 90°까지 움직이기', icon: 'play', onClick: () => {
        if (playing) { cancelAnimationFrame(playing); playing = null; return; }
        const t0 = performance.now(); const from = 0;
        const run = (t) => { const k = Math.min(1, (t - t0) / 6000); theta = Math.round(from + 90 * (0.5 - 0.5 * Math.cos(Math.PI * k))); sl.set(theta); update(); if (k < 1) playing = requestAnimationFrame(run); else playing = null; };
        playing = requestAnimationFrame(run);
      } });
      ctx.onDispose(() => playing && cancelAnimationFrame(playing));
      ctx._reset = () => { theta = ctx.props.angle != null ? ctx.props.angle : 35; sl.set(theta); update(); };
      relabel(); update();
    }
  });
  /* 넓이 비교 막대 (S와 S′) */
  const st = document.createElement('style');
  st.textContent = '.projbars{display:grid;gap:.35em}.projbars i{display:block;height:.7em;border-radius:.4em;background:var(--paper-3)}.projbars__a{background:#5AA9D6!important}.projbars__b{width:calc(var(--k)*100%);background:#2E6F97!important;transition:width .2s}';
  document.head.append(st);
})();

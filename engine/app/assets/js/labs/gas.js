/* 모형: 기체 분자 운동과 압력 (과학) — 유리 실린더 속 분자를 직접 보며 온도·부피를 바꿔 압력 변화를 본다.
   보일 법칙(온도 일정: PV 일정)과 샤를 법칙(압력 일정: V ∝ T)을 실험처럼. props: { n: 140, T: 300, V: 2.0 } */
(function () {
  'use strict';
  const DT = window.DT;
  DT.lab.register('gas', {
    title: '기체 분자 운동과 압력',
    hint: '끌어서 돌려 보세요 · 온도와 피스톤을 바꾸면 분자가 벽에 부딪히는 정도가 달라져요',
    theme: { look: 'real' },
    build(ctx) {
      const pr = ctx.props; const RAD = 2.0; let Tk = pr.T || 300, vol = pr.V || 2.0, N = pr.n || 140;
      const hOf = (v) => v * 1.5;   /* 부피(L) → 피스톤 높이 (부피 ∝ 높이) */
      const g = ctx.three({ camera: [10, 8, 14.5], target: [0, 3, 0], fov: 38, minDistance: 5, maxDistance: 30, background: '#EEF1F3' });
      const T = g.T, scene = g.scene;
      const key = new T.DirectionalLight(0xffffff, 2.0); key.position.set(6, 12, 8); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -6, right: 6, top: 8, bottom: -4 });
      scene.add(key, new T.HemisphereLight(0xffffff, 0xb8b2a6, 0.6));
      /* 실험대 */
      const bench = new T.Mesh(new T.CylinderGeometry(3.3, 3.4, 0.35, 64), new T.MeshPhysicalMaterial({ color: '#2B2F33', roughness: 0.55, clearcoat: 0.5 })); bench.position.y = -0.18; bench.receiveShadow = true; scene.add(bench);
      /* 유리 실린더 */
      const glass = new T.Mesh(new T.CylinderGeometry(RAD + 0.08, RAD + 0.08, 6.6, 72, 1, true), new T.MeshPhysicalMaterial({ color: '#E8F3F7', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.16, side: T.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.02, depthWrite: false }));
      glass.position.y = 3.3; scene.add(glass);
      const ringM = new T.MeshPhysicalMaterial({ color: '#9AA3AB', metalness: 0.9, roughness: 0.25 });
      const baseRing = new T.Mesh(new T.TorusGeometry(RAD + 0.1, 0.07, 16, 96), ringM); baseRing.rotation.x = Math.PI / 2; baseRing.position.y = 0.05; scene.add(baseRing);
      const floorDisk = new T.Mesh(new T.CircleGeometry(RAD + 0.05, 64), new T.MeshPhysicalMaterial({ color: '#C9CED3', roughness: 0.4 })); floorDisk.rotation.x = -Math.PI / 2; floorDisk.position.y = 0.01; floorDisk.receiveShadow = true; scene.add(floorDisk);
      /* 피스톤 */
      const piston = new T.Group(); scene.add(piston);
      const pdisk = new T.Mesh(new T.CylinderGeometry(RAD, RAD, 0.28, 72), new T.MeshPhysicalMaterial({ color: '#B7BEC5', metalness: 0.85, roughness: 0.22 })); pdisk.castShadow = true; piston.add(pdisk);
      const rod = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 4, 24), ringM); rod.position.y = 2.1; piston.add(rod);
      const knob = new T.Mesh(new T.SphereGeometry(0.34, 32, 16), new T.MeshPhysicalMaterial({ color: '#E0336A', roughness: 0.35, clearcoat: 0.8 })); knob.position.y = 4.2; piston.add(knob);
      /* 눈금 */
      for (let i = 1; i <= 4; i++) { const y = i * 1.5; scene.add(g.line([[RAD + 0.1, y, 0], [RAD + 0.45, y, 0]], '#4F5458')); const l = g.label(i + 'L', 'is-sub'); l.position.set(RAD + 0.85, y, 0); scene.add(l); }
      /* 분자 */
      const MAXN = 300;
      const im = new T.InstancedMesh(new T.SphereGeometry(0.12, 20, 12), new T.MeshStandardMaterial({ roughness: 0.38, metalness: 0, envMapIntensity: 0.45 }), MAXN); im.castShadow = true; scene.add(im);
      const P = [], V = []; const m4 = new T.Matrix4(); const col = new T.Color();
      const spawn = (i, h) => { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (RAD - 0.15); P[i] = [r * Math.cos(a), 0.15 + Math.random() * (h - 0.3), r * Math.sin(a)]; const d = [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]; const l = Math.hypot(...d); V[i] = d.map((x) => x / l); };
      let h = hOf(vol); for (let i = 0; i < MAXN; i++) spawn(i, h);
      let impulse = 0, tAcc = 0, Pmeas = 0;
      const speed = () => 1.15 * Math.sqrt(Tk / 300);
      const Pth = () => N * Tk / vol / (140 * 300 / 2.0) * 101.3; /* 처음 조건에서 1기압(101.3kPa)이 되게 맞춤 */
      g.onTick((dt) => {
        h += (hOf(vol) - h) * Math.min(1, dt * 6); piston.position.y = h + 0.14;
        const sp = speed(); let hits = 0;
        for (let i = 0; i < N; i++) {
          const p = P[i], v = V[i]; const k = sp * (0.7 + (i % 7) * 0.09);
          p[0] += v[0] * k * dt * 2.2; p[1] += v[1] * k * dt * 2.2; p[2] += v[2] * k * dt * 2.2;
          const r = Math.hypot(p[0], p[2]);
          if (r > RAD - 0.12) { const nx = p[0] / r, nz = p[2] / r; const dot = v[0] * nx + v[2] * nz; if (dot > 0) { v[0] -= 2 * dot * nx; v[2] -= 2 * dot * nz; hits += k * dot; } p[0] = nx * (RAD - 0.12); p[2] = nz * (RAD - 0.12); }
          if (p[1] < 0.13) { p[1] = 0.13; if (v[1] < 0) { hits += k * -v[1]; v[1] = -v[1]; } }
          if (p[1] > h - 0.13) { p[1] = h - 0.13; if (v[1] > 0) { hits += k * v[1]; v[1] = -v[1]; } }
          m4.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, m4);
          const heat = DT.clamp((k - 0.5) / 1.9, 0, 1); col.setRGB(0.12 + 0.82 * heat, 0.38 - 0.1 * heat, 0.92 - 0.7 * heat); im.setColorAt(i, col);
        }
        for (let i = N; i < MAXN; i++) { m4.makeScale(0, 0, 0); im.setMatrixAt(i, m4); }
        im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
        impulse += hits; tAcc += dt;
        if (tAcc > 0.5) { Pmeas = Pmeas * 0.5 + 0.5 * Pth() * (0.92 + Math.random() * 0.16); impulse = 0; tAcc = 0; paint(); }
      });
      /* 압력계 (SVG 바늘) */
      const gauge = DT.el('div', { class: 'gasgauge', html: '<svg viewBox="0 0 200 120" role="img" aria-label="압력계"><path d="M20 110 A80 80 0 0 1 180 110" fill="none" stroke="#E3DCCB" stroke-width="14" stroke-linecap="round"/><path id="gArc" d="M20 110 A80 80 0 0 1 180 110" fill="none" stroke="#E0336A" stroke-width="14" stroke-linecap="round" stroke-dasharray="0 999"/><line id="gNeedle" x1="100" y1="110" x2="100" y2="40" stroke="#17191B" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="110" r="9" fill="#17191B"/></svg>' });
      const g1 = ctx.group('조건 바꾸기');
      ctx.slider({ into: g1, label: '온도', min: 150, max: 600, step: 10, value: Tk, format: (x) => x + ' K (' + Math.round(x - 273) + '°C)', onInput: (v) => { Tk = v; paint(); } });
      const volS = ctx.slider({ into: g1, label: '부피 (피스톤)', min: 0.8, max: 4.0, step: 0.1, value: vol, format: (x) => x.toFixed(1) + ' L', onInput: (v) => { vol = v; paint(); } });
      ctx.slider({ into: g1, label: '분자 수', min: 40, max: 280, step: 10, value: N, format: (x) => x + '개', onInput: (v) => { const old = N; N = v; for (let i = old; i < N; i++) spawn(i, h); paint(); } });
      const g2 = ctx.group('측정');
      g2.append(gauge);
      const rP = ctx.readout({ into: g2, label: '압력', big: true }); const rPV = ctx.readout({ into: g2, label: '압력 × 부피' });
      const chart = DT.lab.miniChart({ w: 320, h: 120, label: '압력-부피 그래프', xlabel: '부피(L)', ylabel: '압력(kPa)' }); g2.append(chart.el);
      const rec = []; ctx.button({ into: g2, label: '지금 값 기록하기', icon: 'plus', onClick: () => { rec.push([vol, Pth()]); paint(); } });
      ctx.note('온도를 그대로 두고 부피만 바꾸며 3번 이상 기록해 보세요. 점들이 어떤 모양을 이루나요?', g2);
      function paint() {
        const p = Pth(); rP.set(p.toFixed(1) + ' kPa'); rPV.set((p * vol).toFixed(0));
        const k = DT.clamp(p / 400, 0, 1); const ang = -Math.PI / 2 + k * Math.PI;
        const nd = gauge.querySelector('#gNeedle'); nd.setAttribute('x2', (100 + 70 * Math.sin(ang)).toFixed(1)); nd.setAttribute('y2', (110 - 70 * Math.cos(ang)).toFixed(1));
        gauge.querySelector('#gArc').setAttribute('stroke-dasharray', (251 * k).toFixed(1) + ' 999');
        const curve = []; for (let v = 0.8; v <= 4.01; v += 0.1) curve.push([v, N * Tk / v / (140 * 300 / 2.0) * 101.3]);
        const ymax = Math.max(250, ...curve.map((c) => c[1]).slice(0, 1), ...rec.map((r) => r[1])) * 1.05; chart.draw([{ pts: curve, color: '#2A78D6', dash: true, width: 1.6 }].concat(rec.length ? [{ pts: rec, color: '#E0336A', dots: true }] : []), { x0: 0.8, x1: 4, y0: 0, y1: ymax, marks: [[vol, p, '#17191B']] });
      }
      ctx._reset = () => { vol = pr.V || 2.0; volS.set(vol); paint(); };
      paint();
      const st = document.createElement('style'); st.textContent = '.gasgauge svg{width:100%;max-width:220px;display:block;margin:0 auto}'; document.head.append(st); ctx.onDispose(() => st.remove());
    }
  });
})();

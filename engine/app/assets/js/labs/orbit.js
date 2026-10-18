/* 모형: 지구의 공전과 계절 (지구과학) — 우주 공간에서 지구를 날짜별로 움직이며 남중 고도·낮의 길이 변화를 본다.
   props: { day: 172(6월 21일), tilt: 23.5, lat: 37.5(서울) }
   지구 지도: NASA 3D Resources (저작권 없음) — assets/lab-assets/CREDITS.md */
(function () {
  'use strict';
  const DT = window.DT;
  const MD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const dayToDate = (d) => { let m = 0; while (d > MD[m]) { d -= MD[m]; m = (m + 1) % 12; } return [m + 1, d]; };
  const special = { 80: '춘분', 172: '하지', 266: '추분', 356: '동지' };
  DT.lab.register('orbit', {
    title: '지구의 공전과 계절',
    hint: '끌어서 우주를 돌려 보세요 · 날짜 막대로 지구를 움직여요',
    theme: { look: 'real' },
    build(ctx) {
      ctx.root.classList.add('is-dark');
      const pr = ctx.props; const R = 11; let day = pr.day || 172, tilt = pr.tilt != null ? pr.tilt : 23.5; const lat = pr.lat || 37.5;
      const g = ctx.three({ camera: [0, 9.5, 24], target: [0, 0, 0], fov: 40, background: '#04060A', env: false, bloom: { strength: 0.85, radius: 0.55, threshold: 0.9 }, minDistance: 3, maxDistance: 70, exposure: 1.1 });
      const T = g.T, scene = g.scene;
      /* 별 */
      const sv = new Float32Array(4500 * 3), sc = new Float32Array(4500 * 3);
      for (let i = 0; i < 4500; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 60; sv.set([r * Math.sqrt(1 - u * u) * Math.cos(a), r * u, r * Math.sqrt(1 - u * u) * Math.sin(a)], i * 3); const b = 0.25 + Math.pow(Math.random(), 3) * 0.75; const warm = Math.random(); sc.set([b, b * (0.92 + 0.08 * warm), b * (0.85 + 0.15 * (1 - warm))], i * 3); }
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sv, 3)); sg.setAttribute('color', new T.BufferAttribute(sc, 3));
      const dot = document.createElement('canvas'); dot.width = dot.height = 64; const dc = dot.getContext('2d'); const rg = dc.createRadialGradient(32, 32, 0, 32, 32, 32); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.25, 'rgba(255,255,255,.75)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); dc.fillStyle = rg; dc.fillRect(0, 0, 64, 64);
      scene.add(new T.Points(sg, new T.PointsMaterial({ size: 0.7, map: new T.CanvasTexture(dot), vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false })));
      /* 태양 */
      const sun = new T.Mesh(new T.SphereGeometry(1.7, 64, 32), new T.MeshBasicMaterial({ color: new T.Color(3.2, 2.1, 0.95) }));
      scene.add(sun);
      const glow = new T.Mesh(new T.SphereGeometry(2.3, 48, 24), new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.BackSide,
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
        fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(1.0, 0.62, 0.22, f * 0.9); }' }));
      scene.add(glow);
      const sunL = new T.PointLight(0xfff1dc, 3.2, 0, 0); scene.add(sunL); scene.add(new T.AmbientLight(0x334466, 0.12));
      const ls = g.label('태양', 'is-tag'); ls.position.set(0, 2.7, 0); scene.add(ls);
      /* 공전 궤도 */
      const op = []; for (let i = 0; i <= 256; i++) { const a = i / 256 * Math.PI * 2; op.push([R * Math.cos(a), 0, -R * Math.sin(a)]); }
      scene.add(g.line(op, '#7F8BA0', { opacity: 0.55 }));
      const posOf = (d) => { const a = Math.PI + (d - 172) / 365.25 * Math.PI * 2; return [R * Math.cos(a), 0, -R * Math.sin(a)]; };
      Object.entries(special).forEach(([d, name]) => { const p = posOf(+d); const [m, dd] = dayToDate(+d); const l = g.label(name + ' (' + m + '월 ' + dd + '일)', 'is-sub'); l.position.set(p[0] * 1.13, 0.2, p[2] * 1.13); scene.add(l); const mk = g.ball(0.09, '#C7D0DD'); mk.position.set(...p); scene.add(mk); });
      /* 지구 */
      const earthG = new T.Group(); scene.add(earthG);
      const tiltG = new T.Group(); earthG.add(tiltG);
      const tex = new T.TextureLoader().load((DT.config.assetBase || 'assets/') + 'lab-assets/earth-relief.webp'); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
      const earth = new T.Mesh(new T.SphereGeometry(0.95, 96, 48), new T.MeshStandardMaterial({ map: tex, roughness: 0.85, metalness: 0 }));
      tiltG.add(earth);
      const atm = new T.Mesh(new T.SphereGeometry(1.04, 64, 32), new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.BackSide,
        uniforms: { uSun: { value: new T.Vector3() } },
        vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
        fragmentShader: 'uniform vec3 uSun; varying vec3 vN; varying vec3 vW; void main(){ vec3 v = normalize(cameraPosition - vW); float rim = pow(1.0 - abs(dot(vN, v)), 3.0); float lit = clamp(dot(vN, normalize(uSun - vW)) * 0.8 + 0.35, 0.0, 1.0); gl_FragColor = vec4(0.35, 0.62, 1.0, rim * lit * 1.4); }' }));
      tiltG.add(atm);
      const axis = g.tube([0, -1.55, 0], [0, 1.55, 0], 0.025, '#E8ECF2'); tiltG.add(axis);
      const ln = g.label('N', 'is-sub'); ln.position.set(0, 1.8, 0); tiltG.add(ln);
      /* 서울 표시 */
      const toXYZ = (la, lo, r) => { const ph = (lo + 180) / 360 * Math.PI * 2, th = (90 - la) * Math.PI / 180; return [-r * Math.cos(ph) * Math.sin(th), r * Math.cos(th), r * Math.sin(ph) * Math.sin(th)]; };
      const seoul = g.ball(0.045, '#FF3B5C'); seoul.position.set(...toXYZ(lat, 127, 0.96)); earth.add(seoul);
      const lse = g.label('서울', 'is-sub'); lse.position.set(...toXYZ(lat + 6, 127, 1.12)); earth.add(lse);
      /* 태양빛 방향 표시 */
      const ray = g.line([[0, 0, 0], [1, 0, 0]], '#FFC46B', { dashed: true, dash: 0.3, gap: 0.2, opacity: 0.7 }); scene.add(ray);

      let spin = 0, playing = false, follow = false;
      function decl(d) { return tilt * Math.sin(2 * Math.PI * (284 + d) / 365); }
      function update() {
        const p = posOf(day); earthG.position.set(...p);
        tiltG.rotation.z = -tilt * Math.PI / 180;
        atm.material.uniforms.uSun.value.set(0, 0, 0);
        ray.geometry.setFromPoints([new T.Vector3(p[0] * 0.18, 0, p[2] * 0.18), new T.Vector3(p[0] * 0.9, 0, p[2] * 0.9)]); ray.computeLineDistances();
        const [m, dd] = dayToDate(day); const dl = decl(day);
        const alt = 90 - lat + dl; const H = Math.acos(DT.clamp(-Math.tan(lat * Math.PI / 180) * Math.tan(dl * Math.PI / 180), -1, 1)) * 180 / Math.PI; const hrs = 2 * H / 15;
        rAlt.set(alt.toFixed(1) + '°'); rLen.set(Math.floor(hrs) + '시간 ' + Math.round((hrs % 1) * 60) + '분');
        rSeason.set(dl > 8 ? '여름' : dl < -8 ? '겨울' : (m >= 2 && m <= 5 ? '봄' : '가을'));
        const pts = []; for (let k = 1; k <= 365; k += 4) pts.push([k, 90 - lat + decl(k)]);
        chart.draw([{ pts, color: '#2A78D6' }], { x0: 1, x1: 365, y0: 0, y1: 90, marks: [[day, alt, '#E0336A']] });
        dateS.el.querySelector('output').textContent = m + '월 ' + dd + '일' + (special[day] ? ' · ' + special[day] : '');
      }
      g.onTick((dt) => {
        spin += dt * (playing ? 6 : 0.35); earth.rotation.y = spin;
        if (playing) { day = (day + dt * 22) % 365; if (day < 1) day = 1; dateS.set(Math.round(day)); update(); }
        if (follow) { const p = earthG.position; g.controls.target.lerp(p, 0.15); }
      });
      const g1 = ctx.group();
      const dateS = ctx.slider({ into: g1, label: '날짜', min: 1, max: 365, value: day, format: () => '', onInput: (v) => { day = v; update(); } });
      const row0 = DT.el('div', { class: 'lab__row' }); g1.append(row0);
      [[80, '춘분'], [172, '하지'], [266, '추분'], [356, '동지']].forEach(([d, t]) => ctx.button({ into: row0, label: t, onClick: () => { day = d; dateS.set(d); update(); } }));
      const playB = ctx.button({ into: g1, label: '1년 동안 돌려 보기', icon: 'play', onClick: () => { playing = !playing; playB.innerHTML = DT.icon(playing ? 'pause' : 'play') + (playing ? '멈추기' : '1년 동안 돌려 보기'); } });
      ctx.segmented({ into: g1, label: '자전축 기울기', value: 'real', options: [['real', '기울기 23.5°'], ['zero', '기울기 0°라면?']], onChange: (v) => { tilt = v === 'real' ? 23.5 : 0; update(); } });
      const g2 = ctx.group('서울(북위 ' + lat + '°)에서');
      const rSeason = ctx.readout({ into: g2, label: '계절' }); const rAlt = ctx.readout({ into: g2, label: '태양의 남중 고도', big: true }); const rLen = ctx.readout({ into: g2, label: '낮의 길이' });
      const chart = DT.lab.miniChart({ w: 320, h: 120, label: '1년 동안의 남중 고도', xlabel: '1월 → 12월', ylabel: '남중 고도(°)' }); g2.append(chart.el);
      const g3 = ctx.group('보는 곳');
      const row = DT.el('div', { class: 'lab__row' }); g3.append(row);
      ctx.button({ into: row, label: '우주에서', onClick: () => { follow = false; g.flyTo([0, 9.5, 24], [0, 0, 0]); } });
      ctx.button({ into: row, label: '위에서', onClick: () => { follow = false; g.flyTo([0, 32, 0.01], [0, 0, 0]); } });
      ctx.button({ into: row, label: '지구 곁에서', onClick: () => { const p = earthG.position; follow = true; g.flyTo([p.x * 1.32 + 1.2, 1.4, p.z * 1.32 + 1.6], [p.x, 0, p.z]); } });
      ctx.note('자료: 지구 지도 NASA 3D Resources', g3);
      ctx._reset = () => { follow = false; playing = false; day = pr.day || 172; dateS.set(day); update(); };
      update();
    }
  });
})();

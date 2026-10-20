/* 모형: 지형과 등고선 (지리·지구과학) — 실제 같은 산지 지형을 세워 보고, 등고선·단면·해수면을 바꿔 본다.
   props: { interval: 100, sea: 0, seed: 7 }  · 교과서 지형도가 있으면 theme/heightmap으로 바꿔 끼울 수 있다. */
(function () {
  'use strict';
  const DT = window.DT;
  function noise2(seed) {
    const p = new Uint8Array(512); let s = seed * 9301 + 49297;
    const perm = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) { s = (s * 9301 + 49297) % 233280; const j = Math.floor(s / 233280 * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
    for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
    const grad = (h, x, y) => { const u = (h & 1) ? x : -x, v = (h & 2) ? y : -y; return (h & 4) ? u + v * 0.5 : u * 0.5 + v; };
    const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
    return (x, y) => {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255; x -= Math.floor(x); y -= Math.floor(y);
      const u = fade(x), v = fade(y); const a = p[X] + Y, b = p[X + 1] + Y;
      const l1 = grad(p[a], x, y) + u * (grad(p[b], x - 1, y) - grad(p[a], x, y));
      const l2 = grad(p[a + 1], x, y - 1) + u * (grad(p[b + 1], x - 1, y - 1) - grad(p[a + 1], x, y - 1));
      return l1 + v * (l2 - l1);
    };
  }
  DT.lab.register('terrain', {
    title: '지형과 등고선 3D',
    hint: '끌어서 돌려 보세요 · 등고선을 켜고 위에서 내려다보면 지형도가 돼요',
    theme: { look: 'real' },
    build(ctx) {
      const pr = ctx.props; const SIZE = 20, N = 220, HMAX = 4.2, M_PER_UNIT = 1200 / HMAX;
      const g = ctx.three({ camera: [21, 16, 24], target: [0, 1.2, 0], fov: 38, maxPolar: Math.PI * 0.495, minDistance: 8, maxDistance: 60, background: '#DCE7EE' });
      const T = g.T, scene = g.scene;
      scene.fog = new T.Fog('#DCE7EE', 38, 90);
      const sun = new T.DirectionalLight(0xfff4e0, 2.6); sun.position.set(-14, 18, 9); sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 60 }); sun.shadow.bias = -0.0006;
      scene.add(sun, new T.HemisphereLight(0xcfe3ff, 0x6b5a3a, 0.75));

      const n1 = noise2(pr.seed || 7), n2 = noise2((pr.seed || 7) + 11);
      const H = (x, z) => {
        let h = 0, a = 1, f = 0.09;
        for (let o = 0; o < 6; o++) { h += a * n1(x * f, z * f); a *= 0.5; f *= 2.05; }
        const ridge = 1 - Math.abs(n2(x * 0.06 + 3, z * 0.06 - 2)); h = h * 0.9 + ridge * ridge * 1.15;
        const peak = Math.exp(-((x + 3.2) ** 2 + (z + 2.6) ** 2) / 22) * 2.6;
        const river = Math.exp(-((z - 2.4 - 1.6 * Math.sin(x * 0.35)) ** 2) / 1.1) * 1.25;
        const edge = Math.min(1, (SIZE / 2 - Math.max(Math.abs(x), Math.abs(z))) / 1.2);
        return Math.max(-0.6, (h * 1.15 + peak - river + 0.2) * Math.max(0, edge));
      };
      const geo = new T.PlaneGeometry(SIZE, SIZE, N, N); geo.rotateX(-Math.PI / 2);
      const pos = geo.attributes.position; const col = new Float32Array(pos.count * 3);
      let hmax = -1e9, peakAt = [0, 0, 0];
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); const y = H(x, z); pos.setY(i, y); if (y > hmax) { hmax = y; peakAt = [x, y, z]; } }
      const scale = HMAX / hmax; for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) * scale); peakAt[1] = HMAX;
      geo.computeVertexNormals();
      const nrm = geo.attributes.normal; const c = new T.Color();
      const ramp = [[-0.2, '#C9B98F'], [0.15, '#7F9A4E'], [0.9, '#4E6E32'], [1.9, '#3D5A2A'], [2.6, '#7A6A55'], [3.3, '#8F8A84'], [3.9, '#F2F2EE']];
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i), slope = 1 - nrm.getY(i);
        let k = 0; while (k < ramp.length - 2 && y > ramp[k + 1][0]) k++;
        const t = DT.clamp((y - ramp[k][0]) / (ramp[k + 1][0] - ramp[k][0]), 0, 1);
        c.set(ramp[k][1]).lerp(new T.Color(ramp[k + 1][1]), t);
        if (slope > 0.32) c.lerp(new T.Color('#6F6255'), Math.min(1, (slope - 0.32) * 2.2));
        const v = 0.94 + Math.random() * 0.08; col[i * 3] = c.r * v; col[i * 3 + 1] = c.g * v; col[i * 3 + 2] = c.b * v;
      }
      geo.setAttribute('color', new T.BufferAttribute(col, 3));
      const uni = { uInt: { value: (pr.interval || 100) / M_PER_UNIT }, uOn: { value: 1 }, uCut: { value: 0 }, uCutOn: { value: 0 } };
      const mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.93, metalness: 0 });
      mat.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, uni);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed,1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vW; uniform float uInt; uniform float uOn; uniform float uCut; uniform float uCutOn;')
          .replace('#include <dithering_fragment>', `#include <dithering_fragment>
            float hh = vW.y / uInt; float w = fwidth(hh);
            float ln = 1.0 - smoothstep(0.0, w * 1.3, abs(fract(hh + 0.5) - 0.5));
            float major = 1.0 - step(0.5, mod(floor(hh + 0.5), 5.0));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.32, 0.16, 0.05), ln * uOn * (0.55 + 0.4 * major) * step(-0.05, vW.y));
            float cw = fwidth(vW.x) * 1.6; float cut = 1.0 - smoothstep(0.0, cw, abs(vW.x - uCut));
            gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.86, 0.12, 0.25), cut * uCutOn);`);
      };
      const land = new T.Mesh(geo, mat); land.castShadow = true; land.receiveShadow = true; scene.add(land);
      /* 받침 (지층 단면 느낌) */
      const skirtM = new T.MeshStandardMaterial({ color: '#8A7458', roughness: 1 });
      const base = new T.Mesh(new T.BoxGeometry(SIZE, 1.2, SIZE), skirtM); base.position.y = -1.2; base.receiveShadow = true; scene.add(base);
      /* 물 */
      const water = new T.Mesh(new T.PlaneGeometry(SIZE, SIZE), new T.MeshPhysicalMaterial({ color: '#2F6E8F', roughness: 0.12, metalness: 0.0, transparent: true, opacity: 0.82, clearcoat: 1, clearcoatRoughness: 0.05 }));
      water.rotation.x = -Math.PI / 2; water.position.y = (pr.sea || 0) / M_PER_UNIT; water.receiveShadow = true; scene.add(water);
      /* 이름표 */
      const lp = g.label('△ ' + Math.round(HMAX * M_PER_UNIT).toLocaleString() + 'm', 'is-tag'); lp.position.set(peakAt[0], peakAt[1] + 0.6, peakAt[2]); scene.add(lp);
      const lr = g.label('강', 'is-tag'); lr.position.set(5.5, 0.6, 2.4 + 1.6 * Math.sin(5.5 * 0.35)); scene.add(lr);
      /* 단면 */
      const cutPlane = new T.Mesh(new T.PlaneGeometry(SIZE, 7), new T.MeshBasicMaterial({ color: '#D9264A', transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false }));
      cutPlane.rotation.y = Math.PI / 2; cutPlane.position.y = 2; cutPlane.visible = false; scene.add(cutPlane);
      const sample = (x, z) => { const i = Math.round((x + SIZE / 2) / SIZE * N), j = Math.round((z + SIZE / 2) / SIZE * N); return pos.getY(DT.clamp(j, 0, N) * (N + 1) + DT.clamp(i, 0, N)); };

      const g1 = ctx.group('등고선');
      ctx.toggle({ into: g1, label: '등고선 보기', value: true, onChange: (v) => (uni.uOn.value = v ? 1 : 0) });
      ctx.slider({ into: g1, label: '등고선 간격', min: 20, max: 200, step: 20, value: pr.interval || 100, unit: 'm', onInput: (v) => (uni.uInt.value = v / M_PER_UNIT) });
      ctx.note('간격이 촘촘한 곳일수록 경사가 급해요. 굵은 선은 다섯 번째마다 그린 계곡선이에요.', g1);
      const g2 = ctx.group('단면 잘라 보기');
      const chart = DT.lab.miniChart({ w: 320, h: 130, label: '단면도', xlabel: '남 → 북', ylabel: '높이(m)' });
      let cutOn = false, cutX = 0;
      const drawCut = () => { const pts = []; for (let z = -SIZE / 2; z <= SIZE / 2; z += 0.25) pts.push([z, Math.max(0, sample(cutX, z)) * M_PER_UNIT]); chart.draw([{ pts, color: '#8A5A2B', width: 3 }], { y0: 0, y1: 1300 }); };
      ctx.toggle({ into: g2, label: '단면 보기', value: false, onChange: (v) => { cutOn = v; uni.uCutOn.value = v ? 1 : 0; cutPlane.visible = v; chart.el.hidden = !v; if (v) drawCut(); } });
      ctx.slider({ into: g2, label: '자를 위치', min: -9, max: 9, step: 0.25, value: 0, format: (x) => (x >= 0 ? '동 ' : '서 ') + Math.abs(x * 1).toFixed(1) + 'km', onInput: (v) => { cutX = v; uni.uCut.value = v; cutPlane.position.x = v; if (cutOn) drawCut(); } });
      g2.append(chart.el); chart.el.hidden = true;
      const g3 = ctx.group('물과 보기');
      ctx.slider({ into: g3, label: '물의 높이', min: -100, max: 600, step: 20, value: pr.sea || 0, unit: 'm', onInput: (v) => (water.position.y = v / M_PER_UNIT) });
      const row = DT.el('div', { class: 'lab__row' }); g3.append(row);
      ctx.button({ into: row, label: '위에서 (지형도)', onClick: () => g.flyTo([0.01, 30, 0.02], [0, 0, 0]) });
      ctx.button({ into: row, label: '비스듬히', onClick: () => g.home() });
      ctx.button({ into: row, label: '골짜기에서', onClick: () => g.flyTo([9, 1.6, 4.5], [-3, 1.5, -1]) });
      ctx._reset = () => {};
    }
  });
})();

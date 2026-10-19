/* 수업잇기 엔진 · lab.js — 3D·실험실
   교과서의 그림·실험·개념을 손으로 돌리고 바꿔 보는 모형을 전체 화면으로 연다.
   모형 하나 = DT.lab.register('이름', { title, build(ctx) }).  build 안에서 ctx로 3D 장면과 조절 막대를 만든다.
   - 교과서 그림과 같은 톤: content의 theme(평면 색·선 색·글자 모양)을 ctx.theme으로 받는다.
   - 교과서 그림 비교: opt.fig(svg 문자열 또는 그림 경로)가 있으면 구석에 작게 띄운다.
   - 판서: 모형 위에 그대로 쓸 수 있다.
   - 학교 아이패드·전자칠판 성능에 맞춰 화질을 저절로 낮춘다. */
(function () {
  'use strict';
  const DT = window.DT;
  const L = (DT.lab = { reg: {} });
  L.register = (id, def) => { L.reg[id] = def; };

  L.defaultTheme = () => {
    const cs = getComputedStyle(document.documentElement);
    const v = (n, d) => (cs.getPropertyValue(n).trim() || d);
    return { plane: '#F6B98E', plane2: '#9FD9C0', line: '#17191B', accent: v('--accent', '#E0336A'), shape: '#5AA9D6', paper: v('--paper', '#FFFCF6'), second: v('--second', '#1B6A87'), label: 'serif-italic', look: 'textbook' };
  };

  L.open = async function (id, props, opt) {
    opt = opt || {};
    if (!window.THREE || !window.THREE.OrbitControls) {
      const slowT = setTimeout(() => DT.toast('모형을 불러오는 중이에요…'), 450); try { await DT.loadScript((DT.config.assetBase || 'assets/') + 'vendor/three/three-kit.min.js'); clearTimeout(slowT); }
      catch (e) { clearTimeout(slowT); DT.toast('3D 모형 도구를 불러오지 못했어요. 앱 폴더의 assets/vendor/three 를 확인해 주세요.', 'bad'); return; }
    }
    const def = L.reg[id];
    if (!def) { DT.toast('이 모형(' + id + ')이 아직 없어요. Code에서 만들어 달라고 해 주세요.', 'bad'); return; }
    const theme = Object.assign(L.defaultTheme(), def.theme || {}, opt.theme || {});
    const root = DT.el('div', { class: 'lab', role: 'dialog', 'aria-modal': 'true', 'aria-label': opt.title || def.title });
    const view = DT.el('div', { class: 'lab__view' });
    const bar = DT.el('div', { class: 'lab__bar' });
    const ttl = DT.el('h2', { class: 'lab__title' }, opt.title && opt.title !== '3D로 돌려 보기' ? opt.title : def.title);
    const figBtn = opt.fig ? DT.el('button', { class: 'lab__btn', type: 'button', 'aria-pressed': 'true', html: DT.icon('book') + '<span>교과서 그림</span>' }) : null;
    const resetBtn = DT.el('button', { class: 'lab__btn', type: 'button', html: DT.icon('reset') + '<span>처음 모습</span>' });
    const closeBtn = DT.el('button', { class: 'lab__close', type: 'button', html: DT.icon('x') + '<span>닫기</span>' });
    bar.append(...[ttl, figBtn, resetBtn, closeBtn].filter(Boolean));
    const panel = DT.el('div', { class: 'lab__panel' });
    const hint = DT.el('div', { class: 'lab__hint' }, def.hint || '한 손가락: 돌리기 · 두 손가락: 옮기기·확대');
    const inkDock = DT.el('div', { class: 'lab__ink' });
    const inkHost = DT.el('div', { class: 'lab__inkhost' });
    root.append(view, inkHost, bar, panel, hint, inkDock);
    let figBox = null;
    if (opt.fig) {
      figBox = DT.el('figure', { class: 'lab__fig' });
      if (/^\s*</.test(opt.fig)) figBox.innerHTML = opt.fig; else DT.data.asset(opt.fig).then((u) => figBox.append(DT.el('img', { src: u, alt: '교과서 그림' })));
      figBox.append(DT.el('figcaption', null, '교과서 그림'));
      root.append(figBox);
      figBtn.onclick = () => { const on = figBtn.getAttribute('aria-pressed') !== 'true'; figBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); figBox.hidden = !on; };
    }
    document.body.append(root);
    setTimeout(() => hint.classList.add('is-out'), 4200);

    const disposers = []; let raf = 0; let alive = true;
    /* 조절 막대 목록 — 학생과 같이 탐구할 때 값을 모으고, 칠판에서 학생 값으로 바꿔 넣는다 */
    const sliders = []; const changeFns = [];
    const changed = DT.debounce(() => changeFns.forEach((f) => f(sliders.map((s) => s.get()))), 350);
    const ctx = {
      root, view, panel, theme, props: props || {},
      onDispose: (fn) => disposers.push(fn),
      /* 조절 막대 */
      group(title) { const g = DT.el('div', { class: 'lab__group' }); if (title) g.append(DT.el('div', { class: 'lab__gtitle' }, title)); panel.append(g); return g; },
      slider(o) {
        const id = DT.uid('s');
        const val = DT.el('output', { class: 'lab__val num', for: id });
        const inp = DT.el('input', { id, type: 'range', min: o.min, max: o.max, step: o.step || 1, value: o.value, 'aria-label': o.label });
        const fmt = o.format || ((x) => x + (o.unit || ''));
        const paint = () => { val.textContent = fmt(+inp.value); inp.style.setProperty('--p', ((inp.value - o.min) / (o.max - o.min) * 100) + '%'); };
        inp.addEventListener('input', () => { paint(); o.onInput && o.onInput(+inp.value); changed(); });
        const w = DT.el('label', { class: 'lab__slider' }, DT.el('span', { class: 'lab__slabel' }, o.label, val), inp);
        (o.into || panel).append(w); paint();
        const api = { el: w, set(v) { inp.value = v; paint(); }, get: () => +inp.value };
        sliders.push({ el: w, label: o.label, min: +o.min, max: +o.max, step: +(o.step || 1), fmt, get: api.get,
          put(v) { inp.value = v; paint(); o.onInput && o.onInput(+inp.value); w.classList.remove('is-flash'); void w.offsetWidth; w.classList.add('is-flash'); } });
        return api;
      },
      toggle(o) {
        const b = DT.el('button', { class: 'lab__toggle', type: 'button', 'aria-pressed': o.value ? 'true' : 'false' }, DT.el('span', { class: 'lab__tdot' }), o.label);
        b.onclick = () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', v ? 'true' : 'false'); o.onChange && o.onChange(v); };
        (o.into || panel).append(b); return { el: b, set(v) { b.setAttribute('aria-pressed', v ? 'true' : 'false'); } };
      },
      segmented(o) {
        const w = DT.el('div', { class: 'lab__seg', role: 'group', 'aria-label': o.label || '' });
        o.options.forEach(([v, t]) => { const b = DT.el('button', { type: 'button', 'aria-pressed': v === o.value ? 'true' : 'false' }, t); b.onclick = () => { DT.$$('button', w).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); o.onChange && o.onChange(v); }; w.append(b); });
        (o.into || panel).append(w); return w;
      },
      button(o) { const b = DT.el('button', { class: 'lab__action', type: 'button', html: (o.icon ? DT.icon(o.icon) : '') + DT.esc(o.label) }); b.onclick = o.onClick; (o.into || panel).append(b); return b; },
      readout(o) {
        const w = DT.el('div', { class: 'lab__read' + (o.big ? ' lab__read--big' : '') }, DT.el('span', { class: 'lab__rlabel', html: DT.md(o.label) }), DT.el('b', { class: 'lab__rval num' }));
        (o.into || panel).append(w);
        return { el: w, set(v) { w.querySelector('b').innerHTML = typeof v === 'string' && v.includes('$') ? DT.md(v) : DT.esc(v); } };
      },
      note(html, into) { const n = DT.el('p', { class: 'lab__note', html: DT.md(html) }); (into || panel).append(n); return n; },
      /* 3D 장면 — 사실적인 빛(물리 기반 재질 + 실내 환경광 + 부드러운 그림자) */
      three(o) {
        o = o || {};
        const T = window.THREE;
        const renderer = new T.WebGLRenderer({ antialias: true, alpha: !!o.transparent, powerPreference: 'high-performance', preserveDrawingBuffer: false });
        let pr = Math.min(window.devicePixelRatio || 1, o.maxPixelRatio || 2);
        renderer.setPixelRatio(pr);
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = o.exposure || 1.0;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
        view.append(renderer.domElement);
        const scene = new T.Scene();
        if (o.background !== false) scene.background = new T.Color(o.background || theme.paper);
        const pm = new T.PMREMGenerator(renderer);
        if (o.env !== false) scene.environment = pm.fromScene(new T.RoomEnvironment(renderer), 0.04).texture;
        const camera = new T.PerspectiveCamera(o.fov || 38, 1, o.near || 0.1, o.far || 500);
        camera.position.set(...(o.camera || [8, 6, 10]));
        const controls = new T.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.08; controls.target.set(...(o.target || [0, 0, 0]));
        controls.minDistance = o.minDistance || 2; controls.maxDistance = o.maxDistance || 80;
        if (o.maxPolar != null) controls.maxPolarAngle = o.maxPolar;
        /* 한 손가락: 가운데를 중심으로 돌리기 · 두 손가락: 도형(보는 자리) 옮기기와 확대 · 마우스 오른쪽 끌기: 옮기기 */
        controls.enablePan = true; controls.screenSpacePanning = true; controls.panSpeed = 1.1; controls.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN };
        const labels = new T.CSS2DRenderer(); labels.domElement.className = 'lab__labels'; view.append(labels.domElement);
        let composer = null;
        if (o.bloom) {
          composer = new T.EffectComposer(renderer); composer.addPass(new T.RenderPass(scene, camera));
          const bp = new T.UnrealBloomPass(new T.Vector2(256, 256), o.bloom.strength || 0.9, o.bloom.radius || 0.5, o.bloom.threshold || 0.85); composer.addPass(bp); composer.addPass(new T.OutputPass());
        }
        const home = { pos: camera.position.clone(), target: controls.target.clone() };
        function size() { const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h, false); renderer.domElement.style.width = w + 'px'; renderer.domElement.style.height = h + 'px'; labels.setSize(w, h); camera.aspect = w / h; const wide = w > 900; const off = wide && panel.offsetWidth ? Math.round((panel.offsetWidth + 24) / 2) : 0; if (off) camera.setViewOffset(w, h, off, 0, w, h); else camera.clearViewOffset(); camera.updateProjectionMatrix(); if (composer) composer.setSize(w, h); }
        const ro = new ResizeObserver(size); ro.observe(view); size();
        let tick = null; let last = performance.now(); let slow = 0; let frames = 0;
        let fly = null;
        function loop(t) {
          if (!alive) return; raf = requestAnimationFrame(loop);
          const dt = Math.min(0.05, (t - last) / 1000); last = t;
          if (fly) { fly.k = Math.min(1, fly.k + dt / fly.dur); const e = 1 - Math.pow(1 - fly.k, 3); camera.position.lerpVectors(fly.p0, fly.p1, e); controls.target.lerpVectors(fly.t0, fly.t1, e); if (fly.k >= 1) fly = null; }
          controls.update();
          if (tick) tick(dt, t / 1000);
          composer ? composer.render() : renderer.render(scene, camera);
          labels.render(scene, camera);
          frames++; if (dt > 1 / 28) slow++;
          if (frames === 90) { if (slow > 45 && pr > 1) { pr = Math.max(1, pr - 0.5); renderer.setPixelRatio(pr); size(); } frames = 0; slow = 0; }
        }
        raf = requestAnimationFrame(loop);
        ctx.onDispose(() => { ro.disconnect(); renderer.dispose(); pm.dispose(); scene.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) [].concat(m.material).forEach((x) => { Object.values(x).forEach((v) => v && v.isTexture && v.dispose()); x.dispose(); }); }); });
        const api = {
          T, renderer, scene, camera, controls,
          onTick(fn) { tick = fn; },
          home() { api.flyTo(home.pos.toArray(), home.target.toArray()); },
          flyTo(pos, target, dur) { fly = { p0: camera.position.clone(), p1: new T.Vector3(...pos), t0: controls.target.clone(), t1: new T.Vector3(...(target || controls.target.toArray())), k: 0, dur: dur || 0.9 }; },
          label(text, cls) {
            const d = DT.el('div', { class: 'lab__label ' + (theme.label === 'serif-italic' ? 'is-serif ' : '') + (cls || '') });
            d.innerHTML = String(text).includes('$') ? DT.md(text) : DT.esc(text);
            const o2 = new T.CSS2DObject(d); return o2;
          },
          mat(color, o2) { return new T.MeshPhysicalMaterial(Object.assign({ color: new T.Color(color), roughness: 0.45, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.4 }, o2 || {})); },
          acrylic(color, opacity) { return new T.MeshPhysicalMaterial({ color: new T.Color(color), roughness: 0.18, metalness: 0, transmission: 0.0, transparent: true, opacity: opacity == null ? 0.62 : opacity, clearcoat: 1, clearcoatRoughness: 0.12, side: T.DoubleSide, depthWrite: false }); },
          line(points, color, o2) { o2 = o2 || {}; const g = new T.BufferGeometry().setFromPoints(points.map((p) => new T.Vector3(...p))); const m = o2.dashed ? new T.LineDashedMaterial({ color: new T.Color(color), dashSize: o2.dash || 0.18, gapSize: o2.gap || 0.12, transparent: true, opacity: o2.opacity || 1 }) : new T.LineBasicMaterial({ color: new T.Color(color), transparent: true, opacity: o2.opacity || 1 }); const l = new T.Line(g, m); if (o2.dashed) l.computeLineDistances(); return l; },
          tube(a, b, r, color) { const A = new T.Vector3(...a), B = new T.Vector3(...b); const len = A.distanceTo(B); const g = new T.CylinderGeometry(r, r, len, 20, 1); const m = new T.Mesh(g, api.mat(color, { roughness: 0.35 })); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize()); m.castShadow = true; return m; },
          setTube(m, a, b) { const A = new T.Vector3(...a), B = new T.Vector3(...b); const len = Math.max(1e-4, A.distanceTo(B)); m.scale.set(1, len / m.geometry.parameters.height, 1); m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize()); },
          ball(r, color) { const m = new T.Mesh(new T.SphereGeometry(r, 32, 16), api.mat(color, { roughness: 0.3 })); m.castShadow = true; return m; }
        };
        resetBtn.onclick = () => { api.home(); if (ctx._reset) ctx._reset(); };
        return api;
      }
    };
    try { def.build(ctx); } catch (e) { console.error(e); DT.toast('모형을 여는 중 문제가 생겼어요: ' + e.message, 'bad'); }
    if (!resetBtn.onclick) resetBtn.onclick = () => ctx._reset && ctx._reset();

    /* 판서 (모형 위) */
    let surf = null;
    const tbar = DT.ink.toolbar(inkDock, {});
    const sizeInk = () => { if (surf) surf.destroy(); surf = new DT.ink.Surface(inkHost, Math.round(inkHost.clientWidth), Math.round(inkHost.clientHeight), { key: 'lab:' + id, passTo: () => view.querySelector('canvas') || view });   /* 판서 중 두 손가락 → 모형을 옮기고 확대 */ };
    const ro2 = new ResizeObserver(sizeInk); ro2.observe(inkHost);
    function close() {
      alive = false; cancelAnimationFrame(raf); ro2.disconnect(); disposers.forEach((f) => { try { f(); } catch (e) {} });
      if (surf) surf.destroy(); DT.ink.set({ tool: 'hand' }); root.remove(); document.removeEventListener('keydown', onKey, true);
    }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); if (DT.ink.state.tool !== 'hand') DT.ink.set({ tool: 'hand' }); else close(); } else if (DT.ink.keys(e)) e.stopPropagation(); }
    document.addEventListener('keydown', onKey, true);
    closeBtn.onclick = close;
    const handle = { id, props: props || {}, opt, root, bar, panel, close, ctx, sliders,
      values: () => sliders.map((s) => s.get()),
      onChange: (fn) => changeFns.push(fn),
      onClose: (fn) => disposers.push(fn) };
    if (L.onOpen) { try { L.onOpen(handle); } catch (e) { console.error(e); } }
    return handle;
  };

  /* 그래프 그리기 도우미(2D, SVG) — 모형 안의 작은 그래프에 쓴다 */
  L.miniChart = function (o) {
    const W = o.w || 360, H = o.h || 200, P = 34;
    const svg = DT.el('div', { class: 'lab__chart' });
    function draw(series, opt2) {
      opt2 = opt2 || {};
      const xs = series.flatMap((s) => s.pts.map((p) => p[0])), ys = series.flatMap((s) => s.pts.map((p) => p[1]));
      const x0 = opt2.x0 != null ? opt2.x0 : Math.min(...xs), x1 = opt2.x1 != null ? opt2.x1 : Math.max(...xs);
      const y0 = opt2.y0 != null ? opt2.y0 : Math.min(0, ...ys), y1 = opt2.y1 != null ? opt2.y1 : Math.max(...ys) * 1.1 || 1;
      const X = (x) => P + (x - x0) / (x1 - x0 || 1) * (W - P - 10), Y = (y) => H - 24 - (y - y0) / (y1 - y0 || 1) * (H - 34);
      let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + DT.esc(o.label || '그래프') + '">';
      s += '<line x1="' + P + '" y1="' + (H - 24) + '" x2="' + (W - 6) + '" y2="' + (H - 24) + '" stroke="#CFC6B2"/><line x1="' + P + '" y1="8" x2="' + P + '" y2="' + (H - 24) + '" stroke="#CFC6B2"/>';
      if (o.xlabel) s += '<text x="' + (W - 8) + '" y="' + (H - 6) + '" text-anchor="end" font-size="13" fill="#4F5458">' + DT.esc(o.xlabel) + '</text>';
      if (o.ylabel) s += '<text x="' + (P + 4) + '" y="18" font-size="13" fill="#4F5458">' + DT.esc(o.ylabel) + '</text>';
      series.forEach((sr) => {
        if (sr.dots) sr.pts.forEach((p) => (s += '<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="5" fill="' + sr.color + '" stroke="#fff" stroke-width="2"/>'));
        else s += '<polyline fill="none" stroke="' + sr.color + '" stroke-width="' + (sr.width || 2.5) + '" stroke-linejoin="round" ' + (sr.dash ? 'stroke-dasharray="6 5"' : '') + ' points="' + sr.pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ') + '"/>';
      });
      (opt2.marks || []).forEach((m) => (s += '<circle cx="' + X(m[0]).toFixed(1) + '" cy="' + Y(m[1]).toFixed(1) + '" r="7" fill="' + (m[2] || '#17191B') + '" stroke="#fff" stroke-width="2.5"/>'));
      s += '</svg>';
      svg.innerHTML = s;
    }
    return { el: svg, draw };
  };
})();

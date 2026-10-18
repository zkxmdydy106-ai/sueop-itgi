/* 디지털교과서 엔진 · viz.js — 글로만 된 개념도 눈으로 보이게
   content 블록 { t:'viz', kind:'flow'|'cycle'|'compare'|'timeline'|'venn'|'map'|'graph', ..., stepwise:true }
   stepwise면 칠판에서 '다음'을 누를 때마다 한 칸씩 열린다(단계 열기와 같은 방식). */
(function () {
  'use strict';
  const DT = window.DT;
  const V = (DT.viz = {});
  const md = (s) => DT.md(s);
  const rv = (n, b, i) => { if (b.stepwise) { n.dataset.reveal = (b.r || 1) + i; n.classList.add('is-hidden'); } return n; };

  V.render = function (b) {
    const k = b.kind;
    const box = DT.el('div', { class: 'viz viz--' + k, role: 'figure', 'aria-label': b.title || '개념 그림' });
    if (b.title) box.append(DT.el('div', { class: 'viz__title', html: md(b.title) }));
    if (k === 'flow' || k === 'cycle') {
      const wrap = DT.el('div', { class: 'viz__flow' + (k === 'cycle' ? ' is-cycle' : '') + (b.dir === 'col' ? ' is-col' : '') });
      const n = b.steps.length;
      b.steps.forEach((s, i) => {
        const node = DT.el('div', { class: 'viz__node' }, DT.el('span', { class: 'viz__no num' }, String(i + 1)), DT.el('b', { html: md(s.t) }), s.d ? DT.el('span', { class: 'viz__d', html: md(s.d) }) : null);
        if (k === 'cycle') { const a = -Math.PI / 2 + i / n * Math.PI * 2; node.style.left = (50 + 38 * Math.cos(a)) + '%'; node.style.top = (50 + 36 * Math.sin(a)) + '%'; }
        wrap.append(rv(node, b, i));
        if (k === 'flow' && i < n - 1) wrap.append(rv(DT.el('span', { class: 'viz__arrow', 'aria-hidden': 'true' }), b, i + 1));
      });
      if (k === 'cycle') wrap.prepend(DT.el('div', { class: 'viz__ring', 'aria-hidden': 'true' }));
      box.append(wrap);
    } else if (k === 'compare') {
      const wrap = DT.el('div', { class: 'viz__compare' }); wrap.style.gridTemplateColumns = (b.rows ? 'auto ' : '') + b.cols.map(() => '1fr').join(' ');
      if (b.rows) {
        wrap.append(DT.el('span'));
        b.cols.forEach((c) => wrap.append(DT.el('div', { class: 'viz__chead', html: md(c.title) })));
        b.rows.forEach((r, ri) => { wrap.append(rv(DT.el('div', { class: 'viz__rhead', html: md(r) }), b, ri)); b.cols.forEach((c) => wrap.append(rv(DT.el('div', { class: 'viz__cell', html: md((c.items || [])[ri] || '') }), b, ri))); });
      } else b.cols.forEach((c, ci) => wrap.append(rv(DT.el('div', { class: 'viz__col' }, DT.el('div', { class: 'viz__chead', html: md(c.title) }), DT.el('ul', null, (c.items || []).map((x) => DT.el('li', { html: md(x) })))), b, ci)));
      box.append(wrap);
    } else if (k === 'timeline') {
      const wrap = DT.el('ol', { class: 'viz__time' });
      b.events.forEach((e, i) => wrap.append(rv(DT.el('li', null, DT.el('span', { class: 'viz__when num', html: md(e.when) }), DT.el('b', { html: md(e.t) }), e.d ? DT.el('span', { class: 'viz__d', html: md(e.d) }) : null), b, i)));
      box.append(wrap);
    } else if (k === 'venn') {
      const wrap = DT.el('div', { class: 'viz__venn' });
      wrap.append(DT.el('div', { class: 'viz__set viz__set--a' }, DT.el('b', { html: md(b.a.t) }), DT.el('ul', null, (b.a.items || []).map((x) => DT.el('li', { html: md(x) })))));
      wrap.append(DT.el('div', { class: 'viz__set viz__set--b' }, DT.el('b', { html: md(b.b.t) }), DT.el('ul', null, (b.b.items || []).map((x) => DT.el('li', { html: md(x) })))));
      wrap.append(rv(DT.el('div', { class: 'viz__both' }, DT.el('b', null, b.bothTitle || '공통'), DT.el('ul', null, (b.both || []).map((x) => DT.el('li', { html: md(x) })))), b, 0));
      box.append(wrap);
    } else if (k === 'map') {
      const wrap = DT.el('div', { class: 'viz__map' });
      const n = b.nodes.length; let lines = '';
      b.nodes.forEach((nd, i) => {
        const a = -Math.PI / 2 + i / n * Math.PI * 2; const x = 50 + 37 * Math.cos(a), y = 50 + 34 * Math.sin(a);
        lines += '<line x1="50" y1="50" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '"/>';
        if (nd.link) lines += '<text x="' + ((50 + x) / 2).toFixed(1) + '" y="' + ((50 + y) / 2 - 1).toFixed(1) + '">' + DT.esc(nd.link) + '</text>';
        const el = DT.el('div', { class: 'viz__mnode', html: '<b>' + md(nd.t) + '</b>' + (nd.d ? '<span class="viz__d">' + md(nd.d) + '</span>' : '') }); el.style.left = x + '%'; el.style.top = y + '%';
        wrap.append(rv(el, b, i));
      });
      wrap.prepend(DT.el('div', { class: 'viz__lines', html: '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' + lines + '</svg>' }));
      wrap.append(DT.el('div', { class: 'viz__center', html: md(b.center) }));
      box.append(wrap);
    } else if (k === 'graph') {
      box.append(V.graph(b));
    }
    return box;
  };

  /* 조절 막대로 바뀌는 그래프: fn은 x와 매개변수를 쓰는 식 (예: 'a*Math.sin(b*x)+c') */
  V.graph = function (b) {
    const wrap = DT.el('div', { class: 'viz__graph' });
    const params = Object.assign({}, ...Object.entries(b.params || {}).map(([k, v]) => ({ [k]: v[2] != null ? v[2] : v[0] })));
    let f; try { f = new Function('x', ...Object.keys(params), '"use strict";return (' + b.fn + ');'); } catch (e) { f = () => 0; }
    const [x0, x1] = b.x || [-5, 5], [y0, y1] = b.y || [-5, 5];
    const svg = DT.el('div', { class: 'viz__plot' }); const ctl = DT.el('div', { class: 'viz__ctl' });
    const W = 600, H = 360;
    const X = (x) => (x - x0) / (x1 - x0) * W, Y = (y) => H - (y - y0) / (y1 - y0) * H;
    function draw() {
      let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="그래프">';
      for (let gx = Math.ceil(x0); gx <= x1; gx++) s += '<line class="g" x1="' + X(gx) + '" y1="0" x2="' + X(gx) + '" y2="' + H + '"/>';
      for (let gy = Math.ceil(y0); gy <= y1; gy++) s += '<line class="g" x1="0" y1="' + Y(gy) + '" x2="' + W + '" y2="' + Y(gy) + '"/>';
      s += '<line class="ax" x1="0" y1="' + Y(0) + '" x2="' + W + '" y2="' + Y(0) + '"/><line class="ax" x1="' + X(0) + '" y1="0" x2="' + X(0) + '" y2="' + H + '"/>';
      let d = ''; let pen = false;
      for (let i = 0; i <= 400; i++) { const x = x0 + (x1 - x0) * i / 400; const y = f(x, ...Object.values(params)); if (!isFinite(y) || y < y0 - 50 || y > y1 + 50) { pen = false; continue; } d += (pen ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(y).toFixed(1); pen = true; }
      s += '<path class="fn" d="' + d + '"/></svg>';
      svg.innerHTML = s;
    }
    Object.entries(b.params || {}).forEach(([k, v]) => {
      const out = DT.el('output', { class: 'num' }, params[k]);
      const inp = DT.el('input', { type: 'range', min: v[0], max: v[1], step: v[3] || 0.1, value: params[k], 'aria-label': k });
      inp.addEventListener('input', () => { params[k] = +inp.value; out.textContent = params[k]; draw(); });
      inp.addEventListener('pointerdown', (e) => e.stopPropagation());
      ctl.append(DT.el('label', { class: 'viz__param' }, DT.el('span', { html: md('$' + k + '$') }), inp, out));
    });
    if (b.label) ctl.append(DT.el('div', { class: 'viz__flabel', html: md(b.label) }));
    wrap.append(svg, ctl); draw();
    return wrap;
  };

  /* render.js의 블록 목록에 'viz'를 꽂는다 */
  const orig = DT.render && DT.render.block;
  if (orig) DT.render.block = function (b, ctx) { if (b.t === 'viz') { const n = V.render(b); n.dataset.block = b.id || ''; if (b.r && !b.stepwise) { n.dataset.reveal = b.r; if (!(ctx && ctx.revealAll)) n.classList.add('is-hidden'); } return n; } return orig(b, ctx); };
})();

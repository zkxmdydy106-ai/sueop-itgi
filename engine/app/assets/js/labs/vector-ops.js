/* 모형: 벡터 연산 실험실 (기하) — 모눈종이 위에서 벡터의 끝점을 끌어 옮기며 합(삼각형·평행사변형), 차, 실수배를 본다.
   교과서 그림처럼: 회색 모눈, 검은 화살표(주어진 벡터), 분홍(합·차 결과), 파랑(평행사변형 대각선).
   props: { mode: 'add' | 'para' | 'sub' | 'scalar' | 'river', a: [x, y], b: [x, y], k: 2, modes: ['add','para'] }
   theme: { line, accent, second, plane2(모눈 바탕) }
   2D 모형이라 three를 쓰지 않고 SVG로 그린다(교과서 모눈 그림과 같은 선 굵기·색). */
(function () {
  'use strict';
  const DT = window.DT;
  const NAMES = { add: '합 (삼각형)', para: '합 (평행사변형)', sub: '차', scalar: '실수배', river: '강을 건너는 배', comp: '평면벡터의 성분', divide: '선분의 내분점', dot: '벡터의 내적', line: '방향벡터와 직선', normal: '법선벡터와 직선' };

  DT.lab.register('vector-ops', {
    title: '벡터 연산 실험실',
    sub: '수학 · 기하',
    desc: '벡터를 끌어 옮기며 합·차·실수배 보기',
    hint: '화살표 끝의 동그라미를 끌어 벡터를 바꿔 보세요',
    build(ctx) {
      const th = ctx.theme;
      const C = { ink: th.line || '#17191B', res: th.accent || '#D8316A', blue: '#1E9BD7', green: '#13A07D', grid: '#B8B4AC', paper: '#FFFFFF', ghost: '#8A8F94' };
      const P = ctx.props;
      const start = () => ({ a: (P.a || [3, 4]).slice(), b: (P.b || [4, 1]).slice(), k: P.k != null ? P.k : 2, v: P.river != null ? P.river : 10, m: P.m || 2, n: P.n || 1, t: P.t != null ? P.t : 1 });
      let st = start();
      let mode = NAMES[P.mode] ? P.mode : 'add';
      let showSwap = false;
      /* 모드 버튼은 늘 같은 순서. 강을 건너는 배는 따로 하나의 모형처럼(모드 줄 없음) */
      const allowed = mode === 'river' || mode === 'comp' || mode === 'divide' || mode === 'dot' || mode === 'line' || mode === 'normal' ? [mode] : ['add', 'para', 'sub', 'scalar'];   /* 성분·내분점도 따로 하나의 모형처럼 */

      /* 무대 */
      const stage = DT.el('div', { class: 'vops' });
      const svgHost = DT.el('div', { class: 'vops__svg' });
      const tags = DT.el('div', { class: 'vops__tags' });
      stage.append(svgHost, tags); ctx.view.append(stage);
      const COLS = 16, ROWS = 11;
      let s = 40, ox = 0, oy = 0, W = 800, H = 600;
      function layout() {
        const vw = ctx.view.clientWidth, vh = ctx.view.clientHeight;
        const panelW = vw > 900 ? (ctx.panel.offsetWidth || 0) + 40 : 0;
        const fig = ctx.root.querySelector('.lab__fig');   /* 왼쪽 위 교과서 그림이 모눈을 가리지 않게 */
        const figW = fig && !fig.hidden ? fig.offsetWidth + 36 : 0;
        const availW = vw - panelW - figW - 60, availH = vh - 170;
        s = Math.max(18, Math.floor(Math.min(availW / COLS, availH / ROWS)));
        W = s * COLS; H = s * ROWS;
        stage.style.cssText = 'left:' + Math.round(figW + (vw - panelW - figW - W) / 2) + 'px;top:' + Math.round(84 + (vh - 84 - 70 - H) / 2) + 'px;width:' + W + 'px;height:' + H + 'px';
        render();
      }
      /* 모눈 좌표(오른쪽 x, 위쪽 y) → 화면 픽셀 */
      const O = () => (mode === 'river' ? [7, 1] : mode === 'scalar' ? [3, 2] : mode === 'comp' ? [6, 4] : mode === 'divide' ? [2, 1] : mode === 'dot' ? [7, 3] : mode === 'line' || mode === 'normal' ? [6, 4] : [3, 3]);
      const X = (x) => x * s, Y = (y) => H - y * s;
      const add = (p, q) => [p[0] + q[0], p[1] + q[1]], sub = (p, q) => [p[0] - q[0], p[1] - q[1]], mul = (k, p) => [k * p[0], k * p[1]];
      const len = (p) => Math.hypot(p[0], p[1]);

      function arrow(p, q, color, o) {
        o = o || {};
        const x1 = X(p[0]), y1 = Y(p[1]), x2 = X(q[0]), y2 = Y(q[1]);
        const L = Math.hypot(x2 - x1, y2 - y1); if (L < 2) return '';
        const w = o.w || Math.max(2.4, s * 0.075), hl = Math.min(L * 0.45, Math.max(12, s * 0.42)), hw = hl * 0.42;
        const ux = (x2 - x1) / L, uy = (y2 - y1) / L;
        const bx = x2 - ux * hl, by = y2 - uy * hl;
        const dash = o.dash ? ' stroke-dasharray="' + (s * 0.18) + ' ' + (s * 0.14) + '"' : '';
        let out = '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + (x2 - ux * hl * 0.6) + '" y2="' + (y2 - uy * hl * 0.6) + '" stroke="' + color + '" stroke-width="' + w + '" stroke-linecap="round"' + dash + (o.op ? ' opacity="' + o.op + '"' : '') + '/>';
        out += '<path d="M' + x2 + ' ' + y2 + 'L' + (bx - uy * hw) + ' ' + (by + ux * hw) + 'L' + (bx + ux * hl * 0.18) + ' ' + (by + uy * hl * 0.18) + 'L' + (bx + uy * hw) + ' ' + (by - ux * hw) + 'Z" fill="' + color + '"' + (o.op ? ' opacity="' + o.op + '"' : '') + '/>';
        return out;
      }
      const dashed = (p, q, color) => '<line x1="' + X(p[0]) + '" y1="' + Y(p[1]) + '" x2="' + X(q[0]) + '" y2="' + Y(q[1]) + '" stroke="' + (color || C.ink) + '" stroke-width="' + Math.max(1.4, s * 0.035) + '" stroke-dasharray="' + (s * 0.12) + ' ' + (s * 0.1) + '"/>';
      const dot = (p, color) => '<circle cx="' + X(p[0]) + '" cy="' + Y(p[1]) + '" r="' + Math.max(4, s * 0.11) + '" fill="' + (color || C.ink) + '"/>';
      /* 글자표: 벡터 가운데에서 왼쪽(법선 방향)으로 살짝 띄운다 */
      const labels = [];
      function tag(p, q, tex, color, side) {
        const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]; const d = sub(q, p); const L = len(d) || 1;
        const n = [-d[1] / L, d[0] / L]; const k = (side || 1) * 0.8;
        labels.push({ at: [m[0] + n[0] * k, m[1] + n[1] * k], tex, color });
      }
      function ptag(p, tex, dx, dy) { labels.push({ at: [p[0] + (dx || 0), p[1] + (dy || 0)], tex, color: C.ink, plain: true }); }

      function render() {
        labels.length = 0;
        const o = O(); const a = st.a, b = st.b;
        let g = '<rect width="' + W + '" height="' + H + '" fill="' + C.paper + '"/>';
        if (mode !== 'river') {
        for (let i = 0; i <= COLS; i++) g += '<line x1="' + i * s + '" y1="0" x2="' + i * s + '" y2="' + H + '" stroke="' + C.grid + '" stroke-width="1.25"/>';
        for (let j = 0; j <= ROWS; j++) g += '<line x1="0" y1="' + j * s + '" x2="' + W + '" y2="' + j * s + '" stroke="' + C.grid + '" stroke-width="1.25"/>';
        g += '<rect width="' + W + '" height="' + H + '" fill="none" stroke="#B9B5AC" stroke-width="1.5"/>';
        }
        let handles = [];
        if (mode === 'add') {
          const A = o, B = add(o, a), Cc = add(B, b);
          if (showSwap) { const D = add(o, b); g += arrow(A, D, C.green, { dash: true, op: 0.9 }) + arrow(D, Cc, C.green, { dash: true, op: 0.9 }); tag(A, D, '$\\vec b$', C.green, 1); }
          g += arrow(A, Cc, C.res) + arrow(A, B, C.ink) + arrow(B, Cc, C.ink);
          tag(A, B, '$\\vec a$', C.ink, 1); tag(B, Cc, '$\\vec b$', C.ink, 1); tag(A, Cc, '$\\vec a+\\vec b$', C.res, -1);
          ptag(A, 'A', -0.45, -0.35); ptag(B, 'B', 0.4, -0.3); ptag(Cc, 'C', 0.35, 0.3);
          handles = [['a', B], ['b', Cc]];
          readA.set(fmtLen(a)); readB.set(fmtLen(b)); readR.set(fmtLen(add(a, b)));
        } else if (mode === 'para') {
          const A = o, B = add(o, a), D = add(o, b), Cc = add(B, b);
          g += dashed(B, Cc) + dashed(D, Cc);
          g += arrow(A, Cc, C.res) + arrow(A, B, C.ink) + arrow(A, D, C.ink);
          tag(A, B, '$\\vec a$', C.ink, -1); tag(A, D, '$\\vec b$', C.ink, 1); tag(A, Cc, '$\\vec a+\\vec b$', C.res, 1);
          ptag(A, 'A', -0.45, -0.35); ptag(B, 'B', 0.4, -0.3); ptag(D, 'D', -0.4, 0.3); ptag(Cc, 'C', 0.35, 0.3);
          handles = [['a', B], ['b', D]];
          readA.set(fmtLen(a)); readB.set(fmtLen(b)); readR.set(fmtLen(add(a, b)));
        } else if (mode === 'sub') {
          const A = o, B = add(o, a), Cc = add(o, b);
          if (showSwap) { const nb = add(o, mul(-1, b)); g += arrow(A, nb, C.ghost, { dash: true }) + dashed(nb, add(B, mul(-1, b)), C.ghost) + arrow(A, add(a, nb), C.res, { dash: true, op: 0.55 }); tag(A, nb, '$-\\vec b$', C.ghost, 1); }
          g += arrow(Cc, B, C.res) + arrow(A, B, C.ink) + arrow(A, Cc, C.ink);
          tag(A, B, '$\\vec a$', C.ink, -1); tag(A, Cc, '$\\vec b$', C.ink, 1); tag(Cc, B, '$\\vec a-\\vec b$', C.res, 1);
          ptag(A, 'A', -0.45, -0.35); ptag(B, 'B', 0.4, -0.3); ptag(Cc, 'C', -0.3, 0.35);
          handles = [['a', B], ['b', Cc]];
          readA.set(fmtLen(a)); readB.set(fmtLen(b)); readR.set(fmtLen(sub(a, b)));
        } else if (mode === 'scalar') {
          const A = o, ka = mul(st.k, a);
          const lane = (() => { const L = len(a) || 1; return [-a[1] / L * 0.9, a[0] / L * 0.9]; })();
          const A2 = add(A, lane);
          g += arrow(A, add(A, a), C.ink);
          if (Math.abs(st.k) > 1e-6) g += arrow(A2, add(A2, ka), st.k > 0 ? C.green : C.res, {});
          else g += dot(A2, C.res);
          tag(A, add(A, a), '$\\vec a$', C.ink, -1);
          tag(A2, add(A2, ka), (Math.abs(st.k) < 1e-6 ? '$\\vec 0$' : '$' + kTex(st.k) + '\\vec a$'), st.k >= 0 ? C.green : C.res, 1);
          handles = [['a', add(A, a)]];
          readA.set(fmtLen(a)); readB.set(kTex(st.k, true)); readR.set(fmtLen(ka));
        } else if (mode === 'comp') {
          /* 좌표축 + e1, e2 + 성분으로 쪼개기 (교과서 122·124쪽) */
          const ax = Math.max(2, s * 0.05);
          g += '<line x1="0" y1="' + Y(o[1]) + '" x2="' + W + '" y2="' + Y(o[1]) + '" stroke="' + C.ink + '" stroke-width="' + ax + '"/><line x1="' + X(o[0]) + '" y1="' + H + '" x2="' + X(o[0]) + '" y2="0" stroke="' + C.ink + '" stroke-width="' + ax + '"/>';
          for (let i = -o[0]; i <= COLS - o[0]; i++) if (i && i % 2 === 0) labels.push({ at: [o[0] + i, o[1] - 0.45], tex: String(i), color: '#6B6F73', plain: true });
          for (let j = -o[1]; j <= ROWS - o[1]; j++) if (j && j % 2 === 0) labels.push({ at: [o[0] - 0.45, o[1] + j], tex: String(j), color: '#6B6F73', plain: true });
          ptag([COLS - 0.4, o[1]], 'x', 0, 0.45); ptag([o[0], ROWS - 0.4], 'y', 0.45, 0); ptag(o, 'O', -0.4, -0.45);
          const A = add(o, a);
          g += dashed([A[0], o[1]], A) + dashed([o[0], A[1]], A);
          g += arrow(o, [A[0], o[1]], C.green, { op: 0.9 }) + arrow(o, [o[0], A[1]], C.green, { op: 0.9 });
          if (a[0]) tag(o, [A[0], o[1]], '$' + (a[0] === 1 ? '' : a[0] === -1 ? '-' : a[0]) + '\\vec{e}_1$', C.green, a[0] > 0 ? -1 : 1);
          if (a[1]) tag(o, [o[0], A[1]], '$' + (a[1] === 1 ? '' : a[1] === -1 ? '-' : a[1]) + '\\vec{e}_2$', C.green, a[1] > 0 ? 1 : -1);
          if (showSwap) { const B = add(o, b), S2 = add(A, b); g += dashed(A, S2) + dashed(B, S2) + arrow(o, S2, C.res) + arrow(o, B, C.ink); tag(o, B, '$\\vec b$', C.ink, 1); tag(o, S2, '$\\vec a+\\vec b$', C.res, -1); handles = [['a', A], ['b', B]]; }
          else handles = [['a', A]];
          g += arrow(o, add(o, [1, 0]), C.res, { w: Math.max(3, s * 0.09) }) + arrow(o, add(o, [0, 1]), C.res, { w: Math.max(3, s * 0.09) });
          g += arrow(o, A, showSwap ? C.ink : C.res);
          tag(o, A, '$\\vec a$', showSwap ? C.ink : C.res, 1); ptag(A, 'A', 0.35, 0.35);
          labels.push({ at: [o[0] + 0.55, o[1] - 0.5], tex: '$\\vec{e}_1$', color: C.res }); labels.push({ at: [o[0] - 0.55, o[1] + 0.55], tex: '$\\vec{e}_2$', color: C.res });
          readA.set('$\\vec a=(' + a[0] + ',\\ ' + a[1] + ')$'); readB.set(fmtLen(a));
          readR.set(showSwap ? '$(' + (a[0] + b[0]) + ',\\ ' + (a[1] + b[1]) + ')$' : '$' + compTex(a[0], 'e_1', true) + compTex(a[1], 'e_2', false) + '$');
        } else if (mode === 'divide') {
          /* 선분 AB를 m:n으로 내분하는 점 P (교과서 120쪽) */
          const A = add(o, a), B = add(o, b), m = st.m, n = st.n;
          const Pp = add(o, mul(1 / (m + n), add(mul(m, b), mul(n, a))));
          if (showSwap) g += '<line x1="' + X(A[0]) + '" y1="' + Y(A[1]) + '" x2="' + X(B[0]) + '" y2="' + Y(B[1]) + '" stroke="' + C.res + '" stroke-opacity=".22" stroke-width="' + s * 0.42 + '" stroke-linecap="round"/>';
          g += '<line x1="' + X(A[0]) + '" y1="' + Y(A[1]) + '" x2="' + X(B[0]) + '" y2="' + Y(B[1]) + '" stroke="' + C.ink + '" stroke-width="' + Math.max(1.6, s * 0.04) + '"/>';
          g += arrow(o, A, C.ink) + arrow(o, B, C.ink) + arrow(o, Pp, C.res) + dot(Pp, C.res);
          tag(o, A, '$\\vec a$', C.ink, 1); tag(o, B, '$\\vec b$', C.ink, -1); tag(o, Pp, '$\\vec p$', C.res, 1);
          tag(A, Pp, '$m$', '#C2410C', 1); tag(Pp, B, '$n$', '#C2410C', 1);
          ptag(o, 'O', -0.4, -0.45); ptag(A, 'A', -0.1, 0.5); ptag(B, 'B', 0.45, -0.3); ptag(Pp, 'P', 0.45, 0.4);
          handles = [['a', A], ['b', B]];
          readA.set(m + ' : ' + n); const cf = (k) => (k === 1 ? '' : k); readB.set('$\\dfrac{' + cf(m) + '\\vec b+' + cf(n) + '\\vec a}{' + (m + n) + '}$');
          readR.set('AP : PB = ' + m + ' : ' + n);
        } else if (mode === 'dot') {
          /* 두 벡터가 이루는 각과 내적 (교과서 134·137쪽): 점 B에서 직선 OA에 내린 수선의 발 H */
          const A = add(o, a), B = add(o, b);
          const la = len(a), lb = len(b), dp = a[0] * b[0] + a[1] * b[1];
          const t = dp / (la * la), Hh = add(o, mul(t, a)), u = mul(1 / la, a);
          const th = Math.acos(Math.max(-1, Math.min(1, dp / (la * lb)))) * 180 / Math.PI;
          g += '<line x1="' + X(o[0] - u[0] * 30) + '" y1="' + Y(o[1] - u[1] * 30) + '" x2="' + X(o[0] + u[0] * 30) + '" y2="' + Y(o[1] + u[1] * 30) + '" stroke="' + C.ghost + '" stroke-width="' + Math.max(1.2, s * 0.03) + '" opacity=".7"/>';
          const pc = C.ghost;
          if (Math.abs(t) * la > 0.05) g += '<line x1="' + X(o[0]) + '" y1="' + Y(o[1]) + '" x2="' + X(Hh[0]) + '" y2="' + Y(Hh[1]) + '" stroke="' + pc + '" stroke-opacity=".38" stroke-width="' + s * 0.36 + '" stroke-linecap="butt"/>';
          if (len(sub(B, Hh)) > 0.05) {
            g += dashed(B, Hh);
            const q = s * 0.32, w1 = mul(-Math.sign(t || 1), u), n1 = mul(1 / len(sub(B, Hh)), sub(B, Hh));
            const c1 = add(Hh, mul(q / s, w1)), c2 = add(c1, mul(q / s, n1)), c3 = add(Hh, mul(q / s, n1));
            g += '<path d="M' + X(c1[0]) + ' ' + Y(c1[1]) + 'L' + X(c2[0]) + ' ' + Y(c2[1]) + 'L' + X(c3[0]) + ' ' + Y(c3[1]) + '" fill="none" stroke="' + C.ink + '" stroke-width="' + Math.max(1.2, s * 0.03) + '"/>';
          }
          /* 각 θ 호 */
          const r = 1.1, p1 = add(o, mul(r / la, a)), p2 = add(o, mul(r / lb, b)), cr = a[0] * b[1] - a[1] * b[0];
          g += '<path d="M' + X(o[0]) + ' ' + Y(o[1]) + 'L' + X(p1[0]) + ' ' + Y(p1[1]) + 'A' + r * s + ' ' + r * s + ' 0 0 ' + (cr > 0 ? 0 : 1) + ' ' + X(p2[0]) + ' ' + Y(p2[1]) + 'Z" fill="' + C.res + '" fill-opacity=".28" stroke="' + C.res + '" stroke-width="1.5"/>';
          const bis = add(mul(1 / la, a), mul(1 / lb, b)), bl = len(bis) || 1;
          const tp = bl < 0.05 ? add(o, [-a[1] / la * 1.7, a[0] / la * 1.7]) : add(o, mul(1.75 / bl, bis));
          labels.push({ at: tp, tex: '$\\theta$', color: C.res });
          g += arrow(o, A, C.ink) + arrow(o, B, C.blue) + dot(Hh, C.ink);
          tag(o, A, '$\\vec a$', C.ink, cr > 0 ? -1 : 1); tag(o, B, '$\\vec b$', C.blue, (cr > 0 ? 1 : -1) * (dp < 0 ? -1 : 1));
          ptag(o, 'O', -0.45, -0.45); ptag(A, 'A', u[0] * 0.55, u[1] * 0.55 + 0.1); ptag(B, 'B', b[0] / lb * 0.55, b[1] / lb * 0.55); { const bh = sub(B, Hh), lh = len(bh) || 1, off = lh > 0.05 ? mul(-0.6 / lh, bh) : [0, -0.6]; ptag(Hh, 'H', off[0], off[1]); }
          handles = [['a', A], ['b', B]];
          const deg = Math.round(th * 10) / 10, f = (v) => String(Math.round(v * 100) / 100);
          const neg = (v) => (v < 0 ? '(' + v + ')' : String(v));
          readA.set(f(deg) + '°');
          readB.set('$' + neg(a[0]) + '\\times' + neg(b[0]) + '+' + neg(a[1]) + '\\times' + neg(b[1]) + '=' + dp + '$');
          readR.set(f(th <= 90 ? la * lb * Math.cos(th * Math.PI / 180) : -la * lb * Math.cos((180 - th) * Math.PI / 180)));
          readR.el.querySelector('.lab__rlabel').innerHTML = DT.md(th <= 90 + 1e-9 ? '$|\\vec a||\\vec b|\\cos\\theta$' : '$-|\\vec a||\\vec b|\\cos(180^\\circ-\\theta)$');
        } else if (mode === 'line' || mode === 'normal') {
          /* 직선의 방정식 (교과서 146·151쪽): 점 A를 지나고 방향벡터 u에 평행한(또는 법선벡터 n에 수직인) 직선 위의 점 P */
          const ax = Math.max(2, s * 0.05);
          g += '<line x1="0" y1="' + Y(o[1]) + '" x2="' + W + '" y2="' + Y(o[1]) + '" stroke="' + C.ink + '" stroke-width="' + ax + '"/><line x1="' + X(o[0]) + '" y1="' + H + '" x2="' + X(o[0]) + '" y2="0" stroke="' + C.ink + '" stroke-width="' + ax + '"/>';
          ptag([COLS - 0.4, o[1]], 'x', 0, 0.45); ptag([o[0], ROWS - 0.4], 'y', 0.45, 0); ptag(o, 'O', -0.4, -0.45);
          const A = add(o, a), v = b, nrm = mode === 'normal';
          const d = nrm ? [-v[1], v[0]] : v, ld = len(d) || 1, du = mul(1 / ld, d);
          g += '<line x1="' + X(A[0] - du[0] * 40) + '" y1="' + Y(A[1] - du[1] * 40) + '" x2="' + X(A[0] + du[0] * 40) + '" y2="' + Y(A[1] + du[1] * 40) + '" stroke="' + C.res + '" stroke-width="' + Math.max(2.4, s * 0.07) + '"/>';
          const Pp = add(A, mul(st.t, d));
          if (len(sub(Pp, A)) > 0.05) g += arrow(A, Pp, C.green, { op: 0.95 });
          g += arrow(o, A, C.ink) + arrow(o, Pp, C.ink) + arrow(o, add(o, v), C.blue, { w: Math.max(3, s * 0.09) });
          if (nrm && len(sub(Pp, A)) > 0.3) {   /* AP와 n이 수직: 직각 표시 */
            const q = 0.32, nu = mul(1 / (len(v) || 1), v), sg = st.t >= 0 ? 1 : -1, c1 = add(A, mul(q * sg, du)), c2 = add(c1, mul(q, nu)), c3 = add(A, mul(q, nu));
            g += dashed(A, add(A, mul(1.6, nu)), C.blue) + '<path d="M' + X(c1[0]) + ' ' + Y(c1[1]) + 'L' + X(c2[0]) + ' ' + Y(c2[1]) + 'L' + X(c3[0]) + ' ' + Y(c3[1]) + '" fill="none" stroke="' + C.ink + '" stroke-width="1.6"/>';
          }
          g += dot(A) + dot(Pp, C.ink);
          tag(o, A, '$\\vec a$', C.ink, 1); { const q = mul(0.62, sub(Pp, o)), lq = len(q) || 1; labels.push({ at: add(o, add(q, [-q[1] / lq * 0.55, q[0] / lq * 0.55])), tex: '$\\vec p$', color: C.ink }); } tag(o, add(o, v), nrm ? '$\\vec n$' : '$\\vec u$', C.blue, -1);
          if (len(sub(Pp, A)) > 0.6) tag(A, Pp, nrm ? '$\\overrightarrow{\\mathrm{AP}}$' : '$t\\vec u$', C.green, 1);
          { const nv = nrm ? add(mul(0.55, du), mul(0.6 / (len(v) || 1), v)) : [-0.35, 0.45]; ptag(A, 'A', nv[0], nv[1]); } ptag(Pp, 'P', 0.4, 0.4);
          handles = [['a', A], ['b', add(o, v)]];
          const x1 = a[0], y1 = a[1], pP = sub(Pp, o), fmt = (x) => String(Math.round(x * 100) / 100);
          const xm = (n, c) => (c === 0 ? n : n + (c > 0 ? '-' + c : '+' + (-c)));   /* x-x₁ */
          const fr = (num, den) => (den === 1 ? num : den === -1 ? '-(' + num + ')' : '\\dfrac{' + num + '}{' + den + '}');
          let eq;
          if (nrm) {
            const c = -(v[0] * x1 + v[1] * y1), term = (k, n, first) => (k === 0 ? '' : (k < 0 ? '-' : first ? '' : '+') + (Math.abs(k) === 1 ? '' : Math.abs(k)) + n);
            const lhs = term(v[0], 'x', true) + term(v[1], 'y', !v[0]) + (c === 0 ? '' : (c > 0 ? '+' : '-') + Math.abs(c));
            eq = '$' + lhs + '=0$';
            readB.set('$' + fmt(pP[0] - x1) + '\\times' + (v[0] < 0 ? '(' + v[0] + ')' : v[0]) + '+' + (pP[1] - y1 < 0 ? '(' + fmt(pP[1] - y1) + ')' : fmt(pP[1] - y1)) + '\\times' + (v[1] < 0 ? '(' + v[1] + ')' : v[1]) + '=0$');
          } else {
            eq = v[0] === 0 ? '$x=' + x1 + '$' : v[1] === 0 ? '$y=' + y1 + '$' : '$' + fr(xm('x', x1), v[0]) + '=' + fr(xm('y', y1), v[1]) + '$';
            readB.set('$(' + fmt(pP[0]) + ',\\ ' + fmt(pP[1]) + ')$');
          }
          readA.set(nrm ? '$\\vec n=(' + v[0] + ',\\ ' + v[1] + ')$' : '$\\vec u=(' + v[0] + ',\\ ' + v[1] + ')$');
          readR.set(eq);
        } else if (mode === 'river') {
          /* 축척을 하나로: 강 너비 20 km. 배는 북쪽 20 km/h → 꼭 1시간에 건넌다.
             그래서 '1시간 동안 간 거리' 화살표 = 속도 벡터. 북쪽 화살표(20 km/h)는 건너편 강둑에 닿고,
             동쪽 화살표(강물 v km/h)는 강둑을 따라 v km, 합 벡터 끝이 실제 도착 지점 Q. */
          const WIDTH = 20, BOAT = 20, y0 = 1.7, y1 = 9.5, KM = (y1 - y0) / WIDTH, px = 2.6;
          const hours = WIDTH / BOAT, drift = st.v * hours;
          const P0 = [px, y0], N = [px, y1], Q = [px + drift * KM, y1];
          const sx = (x) => X(x).toFixed(1), sy = (y) => Y(y).toFixed(1);
          let d = '<defs>'
            + '<linearGradient id="rvW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4FC0E0"/><stop offset=".5" stop-color="#5CC8E6"/><stop offset="1" stop-color="#3FB2D6"/></linearGradient>'
            + '<filter id="rvGrain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .22"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in"/></filter>'
            + '<filter id="rvWater" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".012 .09" numOctaves="3" seed="9"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .55 -.18"/><feComposite in2="SourceGraphic" operator="in"/></filter>'
            + '<linearGradient id="rvHull" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#A8321F"/><stop offset=".5" stop-color="#D2492F"/><stop offset="1" stop-color="#9B2C1B"/></linearGradient>'
            + '<linearGradient id="rvDeck" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#B9773F"/><stop offset=".5" stop-color="#D99A5B"/><stop offset="1" stop-color="#B26F38"/></linearGradient>'
            + '<filter id="rvShadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="' + (s * 0.08).toFixed(1) + '"/></filter>'
            + '</defs>';
          g += d;
          /* 강물 + 물결 */
          g += '<rect x="0" y="' + sy(y1) + '" width="' + W + '" height="' + (Y(y0) - Y(y1)).toFixed(1) + '" fill="url(#rvW)"/>';
          g += '<rect x="0" y="' + sy(y1) + '" width="' + W + '" height="' + (Y(y0) - Y(y1)).toFixed(1) + '" fill="#fff" filter="url(#rvWater)" opacity=".9"/>';
          const shift = ((riverT * st.v * 0.09) % 1) * 1.6;
          for (let k = 0; k < 46; k++) {
            const wx = ((k * 3.71) % (COLS + 2)) - 1 + shift, wy = y0 + 0.35 + ((k * 2.39) % (y1 - y0 - 0.7)), wl = 0.6 + (k % 4) * 0.22;
            const light = k % 3 !== 0;
            g += '<path d="M' + sx(wx) + ' ' + sy(wy) + ' q' + (wl * s / 2).toFixed(1) + ' ' + (-s * 0.09).toFixed(1) + ' ' + (wl * s).toFixed(1) + ' 0" fill="none" stroke="' + (light ? '#FFFFFF' : '#1D88B3') + '" stroke-opacity="' + (light ? '.75' : '.35') + '" stroke-width="' + Math.max(1.6, s * (light ? 0.06 : 0.05)).toFixed(1) + '" stroke-linecap="round"/>';
          }
          /* 강둑: 콘크리트 + 물가 그늘 */
          const bank = (yA, yB) => '<rect x="0" y="' + sy(yB) + '" width="' + W + '" height="' + (Y(yA) - Y(yB)).toFixed(1) + '" fill="#B7B8BA"/><rect x="0" y="' + sy(yB) + '" width="' + W + '" height="' + (Y(yA) - Y(yB)).toFixed(1) + '" fill="#000" filter="url(#rvGrain)"/>';
          g += bank(0, y0) + bank(y1, ROWS);
          g += '<rect x="0" y="' + sy(y0 + 0.02) + '" width="' + W + '" height="' + (s * 0.14).toFixed(1) + '" fill="#5E6266" opacity=".75"/><rect x="0" y="' + (Y(y1) - s * 0.14).toFixed(1) + '" width="' + W + '" height="' + (s * 0.14).toFixed(1) + '" fill="#5E6266" opacity=".75"/>';
          /* 강 너비 치수선 (왼쪽) */
          const dx = 0.42;
          g += '<line x1="' + sx(dx) + '" y1="' + sy(y0 + 0.08) + '" x2="' + sx(dx) + '" y2="' + sy(y1 - 0.08) + '" stroke="' + C.ink + '" stroke-width="2"/>'
            + '<path d="M' + sx(dx) + ' ' + sy(y1 - 0.08) + 'l-6 11h12z M' + sx(dx) + ' ' + sy(y0 + 0.08) + 'l-6 -11h12z" fill="' + C.ink + '"/>';
          labels.push({ at: [dx + 0.05, (y0 + y1) / 2], tex: '강 너비 20 km', color: C.ink, plain: true, cls: 'is-dim' });
          /* 거리 눈금 (북쪽 강둑, P의 바로 맞은편에서 동쪽으로) */
          for (let km = 0; px + km * KM <= COLS - 0.2; km += 5) {
            const tx = px + km * KM;
            g += '<line x1="' + sx(tx) + '" y1="' + sy(y1 + 0.08) + '" x2="' + sx(tx) + '" y2="' + sy(y1 + (km % 10 ? 0.28 : 0.42)) + '" stroke="' + C.ink + '" stroke-width="2"/>';
            labels.push({ at: [tx, y1 + 0.78], tex: km + (km ? ' km' : ''), color: C.ink, plain: true, cls: 'is-km' });
          }
          g += '<line x1="' + sx(px) + '" y1="' + sy(y1 + 0.08) + '" x2="' + sx(Math.min(COLS - 0.2, px + 30 * KM)) + '" y2="' + sy(y1 + 0.08) + '" stroke="' + C.ink + '" stroke-width="2"/>';
          /* 1시간 동안의 벡터 삼각형 */
          g += arrow(P0, N, C.ink) + (st.v > 0 ? arrow(N, Q, C.ink) : '') + arrow(P0, Q, C.res, { w: Math.max(3.4, s * 0.1) });
          tag(P0, N, '20 km/h', C.ink, -1);
          if (st.v > 0) labels.push({ at: [(N[0] + Q[0]) / 2, y1 - 0.55], tex: st.v + ' km/h', color: C.ink });
          /* 도착 지점 Q */
          g += '<circle cx="' + sx(Q[0]) + '" cy="' + sy(Q[1]) + '" r="' + Math.max(6, s * 0.16).toFixed(1) + '" fill="#fff" stroke="' + C.res + '" stroke-width="3"/>';
          ptag(Q, 'Q', 0.62, -0.5);
          /* 배: 위에서 본 모습. 뱃머리는 늘 북쪽, 실제로는 합 벡터 방향으로 미끄러진다 */
          const t = Math.min(1, riverT);
          const cur = [P0[0] + (Q[0] - P0[0]) * t, P0[1] + (Q[1] - P0[1]) * t];
          const L = s * 1.2, Bw = s * 0.45;
          const ang = Math.atan2(-(Q[1] - P0[1]), Q[0] - P0[0]) * 180 / Math.PI;   /* 화면 좌표 진행 방향 */
          let wake = '';
          if (t > 0.02 && t < 0.995) {   /* 물보라: 실제 진행 방향의 뒤쪽으로 V자 */
            const back = ang + 180, sp = 16;
            [-sp, sp].forEach((o2) => { const r = (back + o2) * Math.PI / 180; wake += '<path d="M0 ' + (L * 0.55).toFixed(1) + ' l' + (Math.cos(r) * L * 1.5).toFixed(1) + ' ' + (Math.sin(r) * L * 1.5).toFixed(1) + '" stroke="#fff" stroke-opacity=".8" stroke-width="' + (s * 0.07).toFixed(1) + '" stroke-linecap="round" fill="none"/>'; });
          }
          const hull = 'M0 ' + (-L) + ' C' + (Bw * 0.9) + ' ' + (-L * 0.55) + ' ' + Bw + ' ' + (-L * 0.05) + ' ' + Bw * 0.92 + ' ' + (L * 0.62) + ' Q' + Bw * 0.8 + ' ' + L * 0.98 + ' 0 ' + L * 0.98 + ' Q' + (-Bw * 0.8) + ' ' + L * 0.98 + ' ' + (-Bw * 0.92) + ' ' + (L * 0.62) + ' C' + (-Bw) + ' ' + (-L * 0.05) + ' ' + (-Bw * 0.9) + ' ' + (-L * 0.55) + ' 0 ' + (-L) + 'Z';
          let planks = ''; for (let k = -2; k <= 2; k++) planks += '<line x1="' + (k * Bw * 0.26).toFixed(1) + '" y1="' + (-L * 0.62).toFixed(1) + '" x2="' + (k * Bw * 0.26).toFixed(1) + '" y2="' + (L * 0.8).toFixed(1) + '" stroke="#8E5626" stroke-opacity=".45" stroke-width="1"/>';
          const bx0 = X(P0[0]), by0 = Y(P0[1]) - L * 1.02, bx1 = X(Q[0]), by1 = Y(Q[1]) + L * 1.06;
          g += '<g transform="translate(' + (bx0 + (bx1 - bx0) * t).toFixed(1) + ' ' + (by0 + (by1 - by0) * t).toFixed(1) + ')">' + wake
            + '<path d="' + hull + '" transform="translate(' + (s * 0.08).toFixed(1) + ' ' + (s * 0.1).toFixed(1) + ')" fill="#0A3D52" opacity=".35" filter="url(#rvShadow)"/>'
            + '<path d="' + hull + '" fill="url(#rvHull)" stroke="#5B1A10" stroke-width="1.6"/>'
            + '<path d="' + hull + '" transform="scale(.78 .84)" fill="url(#rvDeck)"/>' + '<g transform="scale(.78 .84)">' + planks + '</g>'
            + '<rect x="' + (-Bw * 0.5).toFixed(1) + '" y="' + (-L * 0.08).toFixed(1) + '" width="' + Bw.toFixed(1) + '" height="' + (L * 0.62).toFixed(1) + '" rx="' + (Bw * 0.18).toFixed(1) + '" fill="#F5F2EA" stroke="#6B6F73" stroke-width="1.3"/>'
            + '<rect x="' + (-Bw * 0.32).toFixed(1) + '" y="' + (L * 0.02).toFixed(1) + '" width="' + (Bw * 0.64).toFixed(1) + '" height="' + (L * 0.12).toFixed(1) + '" rx="2" fill="#3C6E8C"/>'
            + '<line x1="0" y1="' + (-L * 0.42).toFixed(1) + '" x2="0" y2="' + (-L * 0.12).toFixed(1) + '" stroke="#5B3A1E" stroke-width="2.4"/>'
            + '<path d="M0 ' + (-L * 0.42).toFixed(1) + ' L' + (-Bw * 1.25).toFixed(1) + ' ' + (-L * 0.02).toFixed(1) + ' L0 ' + (-L * 0.12).toFixed(1) + 'Z" fill="#F2C230" stroke="#B88A12" stroke-width="1.2"/>'
            + '<path d="M0 ' + (-L * 0.42).toFixed(1) + ' L' + (-Bw * 1.25).toFixed(1) + ' ' + (-L * 0.02).toFixed(1) + '" stroke="#FFF3B8" stroke-width="1.4" fill="none" opacity=".8"/>'
            + '</g>';
          ptag(P0, 'P', 0, -0.62);
          readA.set('20 km/h'); readB.set(st.v + ' km/h'); readR.set(len([20, st.v]).toFixed(1).replace(/\.0$/, '') + ' km/h');
          note.innerHTML = DT.md('강 너비는 **20 km**, 배는 북쪽으로 20 km/h라서 **1시간** 뒤 건너편에 닿아요.\n그동안 강물에 밀려 Q는 P의 맞은편에서 동쪽으로 **' + drift + ' km**.');
        }
        g += handles.map(([id, p]) => '<circle class="vops__h" data-h="' + id + '" cx="' + X(p[0]) + '" cy="' + Y(p[1]) + '" r="' + Math.max(18, s * 0.5) + '" fill="' + C.res + '" fill-opacity="0.08" stroke="' + C.res + '" stroke-opacity="0.55" stroke-width="2" stroke-dasharray="5 4"/>').join('');
        svgHost.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="' + DT.esc(NAMES[mode]) + '">' + g + '</svg>';
        tags.innerHTML = '';
        labels.forEach((l) => {
          if (l.at[0] < -0.2 || l.at[0] > COLS + 0.2 || l.at[1] < -0.2 || l.at[1] > ROWS + 0.2) return;
          const d = DT.el('div', { class: 'vops__tag' + (l.cls ? ' ' + l.cls : '') + (l.plain ? ' is-pt' : '') + (!l.plain && !l.tex.includes('$') ? ' is-txt' : ''), html: l.plain || !l.tex.includes('$') ? DT.esc(l.tex) : DT.md(l.tex) });
          d.style.left = X(l.at[0]) + 'px'; d.style.top = Y(l.at[1]) + 'px'; d.style.color = l.color; tags.append(d);
        });
        const exp = { add: '$\\overrightarrow{\\mathrm{AB}}+\\overrightarrow{\\mathrm{BC}}=\\overrightarrow{\\mathrm{AC}}$', para: '$\\overrightarrow{\\mathrm{AB}}+\\overrightarrow{\\mathrm{AD}}=\\overrightarrow{\\mathrm{AC}}$', sub: '$\\overrightarrow{\\mathrm{AB}}-\\overrightarrow{\\mathrm{AC}}=\\overrightarrow{\\mathrm{CB}}$', scalar: '$|k\\vec a|=|k||\\vec a|$', river: '실제로 움직이는 속도 = 배의 속도 + 강물의 속도', comp: '$\\vec a=a_1\\vec{e}_1+a_2\\vec{e}_2=(a_1,\\ a_2)$', divide: '$\\vec p=\\dfrac{m\\vec b+n\\vec a}{m+n}$', dot: '두 방법으로 구한 내적은 언제나 같아요.', line: '$\\vec p=\\vec a+t\\vec u$', normal: '$(\\vec p-\\vec a)\\cdot\\vec n=0$' }[mode];
        rule.innerHTML = DT.md(exp);
      }
      const compTex = (v, e, first) => (v === 0 ? (first ? '' : '') : (v < 0 ? '-' : first ? '' : '+') + (Math.abs(v) === 1 ? '' : Math.abs(v)) + '\\vec{e}_' + e.slice(2));   /* 교과서처럼 화살표는 e 위에만 */
      const kTex = (k, plain) => { const r = Math.round(k * 2) / 2; if (plain) return 'k = ' + r; if (r === 1) return ''; if (r === -1) return '-'; return Number.isInteger(r) ? String(r) : (r < 0 ? '-' : '') + '\\tfrac{' + Math.abs(r * 2) + '}{2}'; };
      const fmtLen = (p) => { const q = p[0] * p[0] + p[1] * p[1]; const r = Math.round(Math.sqrt(q)); return r * r === q ? String(r) : '√' + q + ' ≈ ' + Math.sqrt(q).toFixed(2); };

      /* 끌기 (모눈 칸에 맞춰 붙는다) */
      let drag = null;
      svgHost.addEventListener('pointerdown', (e) => {
        const h = e.target.closest && e.target.closest('.vops__h'); if (!h) return;
        drag = h.dataset.h; svgHost.setPointerCapture(e.pointerId); e.preventDefault();
      });
      svgHost.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const r = svgHost.getBoundingClientRect(); const gx = Math.round((e.clientX - r.left) / s), gy = Math.round((r.bottom - e.clientY) / s);
        const p = [Math.max(0, Math.min(COLS, gx)), Math.max(0, Math.min(ROWS, gy))]; const o = O();
        if (drag === 'a') { st.a = sub(p, o); }
        else if (drag === 'b') { st.b = mode === 'add' ? sub(p, add(o, st.a)) : sub(p, o); }
        if (mode === 'divide' && len(sub(st.a, st.b)) < 0.5) st.b = add(st.a, [1, 0]);
        if (len(st.a) < 0.5) st.a = [1, 0]; if (len(st.b) < 0.5) st.b = [0, 1];
        render();
      });
      const end = () => { drag = null; };
      svgHost.addEventListener('pointerup', end); svgHost.addEventListener('pointercancel', end);

      /* 조절 */
      const g1 = ctx.group('무엇을 볼까요'); if (allowed.length < 2) g1.hidden = true;
      const seg = DT.el('div', { class: 'vops__modes' }); g1.append(seg);
      allowed.forEach((m) => { const b = DT.el('button', { type: 'button', 'aria-pressed': m === mode ? 'true' : 'false' }, NAMES[m]); b.onclick = () => { mode = m; DT.$$('button', seg).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); sync(); }; seg.append(b); });
      const g2 = ctx.group();
      const kSl = ctx.slider({ into: g2, label: '실수 k', min: -3, max: 3, step: 0.5, value: st.k, format: (v) => String(v), onInput: (v) => { st.k = v; render(); } });
      const vSl = ctx.slider({ into: g2, label: '강물의 속력', min: 0, max: 20, step: 5, value: st.v, unit: ' km/h', onInput: (v) => { st.v = v; riverT = 1; render(); } });
      const mSl = ctx.slider({ into: g2, label: 'm', min: 1, max: 6, step: 1, value: st.m, format: (v) => String(v), onInput: (v) => { st.m = v; render(); } });
      const nSl = ctx.slider({ into: g2, label: 'n', min: 1, max: 6, step: 1, value: st.n, format: (v) => String(v), onInput: (v) => { st.n = v; render(); } });
      const tSl = ctx.slider({ into: g2, label: '실수 t', min: -3, max: 3, step: 0.25, value: st.t, format: (v) => String(v), onInput: (v) => { st.t = v; render(); } });
      const swap = ctx.toggle({ into: g2, label: '', value: false, onChange: (v) => { showSwap = v; sync(); } });
      const swapLbl = DT.el('span'); swap.el.append(swapLbl);
      const g3 = ctx.group(mode === 'dot' ? '내적 두 가지로 구하기' : mode === 'line' || mode === 'normal' ? '지금 값' : '크기');
      const readA = ctx.readout({ into: g3, label: '$|\\vec a|$' });
      const readB = ctx.readout({ into: g3, label: '$|\\vec b|$' });
      const readR = ctx.readout({ into: g3, label: '결과', big: true });
      const rule = DT.el('p', { class: 'vops__rule' }); g3.append(rule);
      const note = ctx.note('', g3);
      let riverT = 1, play = 0;
      const playBtn = ctx.button({ into: g2, label: '배 띄우기', icon: 'play', onClick: () => {
        cancelAnimationFrame(play); const t0 = performance.now();
        const run = (t) => { riverT = Math.min(1, (t - t0) / 3200); render(); if (riverT < 1) play = requestAnimationFrame(run); };
        play = requestAnimationFrame(run);
      } });
      ctx.onDispose(() => cancelAnimationFrame(play));
      function sync() {
        kSl.el.hidden = mode !== 'scalar'; vSl.el.hidden = mode !== 'river'; playBtn.hidden = mode !== 'river'; mSl.el.hidden = nSl.el.hidden = mode !== 'divide'; tSl.el.hidden = !(mode === 'line' || mode === 'normal'); [readB, readR].forEach((r) => r.el.classList.toggle('vops-eq', mode === 'line' || mode === 'normal'));
        swap.el.hidden = !(mode === 'add' || mode === 'sub' || mode === 'comp' || mode === 'divide');
        swapLbl.innerHTML = DT.md({ add: '순서 바꿔 더하기 $\\vec b+\\vec a$', sub: '$\\vec a+(-\\vec b)$로 보기', comp: '$\\vec b$도 더해 보기 (성분끼리)', divide: 'P가 움직일 수 있는 자리 (선분 AB)' }[mode] || '');
        g2.hidden = mode === 'para' || mode === 'dot';
        swap.el.hidden = swap.el.hidden || mode === 'line' || mode === 'normal';
        readA.el.querySelector('.lab__rlabel').innerHTML = DT.md(mode === 'river' ? '배의 속력' : mode === 'comp' ? '성분' : mode === 'divide' ? '$m:n$' : mode === 'dot' ? '$\\theta$' : mode === 'line' ? '방향벡터' : mode === 'normal' ? '법선벡터' : '$|\\vec a|$');
        readB.el.querySelector('.lab__rlabel').innerHTML = DT.md(mode === 'river' ? '강물의 속력' : mode === 'scalar' ? '실수' : mode === 'comp' ? '$|\\vec a|$' : mode === 'divide' ? '$\\vec p$' : mode === 'dot' ? '$\\vec a\\cdot\\vec b$' : mode === 'line' ? '점 P' : mode === 'normal' ? '$\\overrightarrow{\\mathrm{AP}}\\cdot\\vec n$' : '$|\\vec b|$');
        readR.el.querySelector('.lab__rlabel').innerHTML = DT.md({ add: '$|\\vec a+\\vec b|$', para: '$|\\vec a+\\vec b|$', sub: '$|\\vec a-\\vec b|$', scalar: '$|k\\vec a|$', river: '실제 속력', comp: showSwap ? '$\\vec a+\\vec b$' : '$\\vec a$', divide: '점 P', dot: '$|\\vec a||\\vec b|\\cos\\theta$', line: '직선의 방정식', normal: '직선의 방정식' }[mode]);
        note.innerHTML = DT.md({ add: '$\\vec a$의 종점과 $\\vec b$의 시점을 일치시켜요.', para: '$\\vec a$의 시점과 $\\vec b$의 시점을 일치시켜요.', sub: '$\\vec a-\\vec b$는 $\\vec b$의 종점에서 $\\vec a$의 종점으로 가요.', scalar: '$k>0$이면 같은 방향, $k<0$이면 반대 방향이에요.', river: '배는 북쪽으로 가려 해도 강물 때문에 비스듬히 건너요.', comp: '화살표 끝을 끌어 보세요. 초록 화살표가 $x$성분, $y$성분이에요.', divide: 'A, B를 끌고 m, n을 바꿔 보세요.', dot: '두 화살표 끝을 끌어 보세요. 점 B에서 직선 OA에 내린 수선의 발이 H예요. $\\theta$가 $90^\\circ$보다 크면 H가 반대쪽으로 가고 내적이 음수가 돼요.', line: 'A와 $\\vec u$의 끝을 끌고, $t$를 바꿔 보세요. 점 P는 언제나 직선 위에 있어요.', normal: 'A와 $\\vec n$의 끝을 끌고, $t$를 바꿔 보세요. $\\overrightarrow{\\mathrm{AP}}$는 언제나 $\\vec n$과 수직이에요.' }[mode]);
        render();
      }
      ctx._reset = () => { st = start(); mode = NAMES[P.mode] ? P.mode : 'add'; showSwap = false; swap.set(false); kSl.set(st.k); vSl.set(st.v); mSl.set(st.m); nSl.set(st.n); tSl.set(st.t); DT.$$('button', seg).forEach((x, i) => x.setAttribute('aria-pressed', allowed[i] === mode ? 'true' : 'false')); riverT = 1; sync(); };
      const ro = new ResizeObserver(layout); ro.observe(ctx.view); ctx.onDispose(() => ro.disconnect());
      const figEl = ctx.root.querySelector('.lab__fig'); if (figEl) { const mo = new MutationObserver(layout); mo.observe(figEl, { attributes: true }); ctx.onDispose(() => mo.disconnect()); }   /* 교과서 그림을 켜고 끄면 모눈 자리 다시 */
      sync(); layout();
      if (mode === 'river') playBtn.click();
    }
  });
  const st = document.createElement('style');
  st.textContent = [
    '.vops{position:absolute;border-radius:6px;box-shadow:0 10px 30px rgba(40,30,10,.12),0 2px 6px rgba(40,30,10,.08)}',
    '.vops__svg,.vops__svg svg{display:block;touch-action:none}',
    '.vops__h{cursor:grab}.vops__h:active{cursor:grabbing}',
    '.vops__tags{position:absolute;inset:0;pointer-events:none;overflow:hidden}',
    '.vops__tag{position:absolute;transform:translate(-50%,-50%);font-family:"Times New Roman",Georgia,serif;font-style:italic;font-size:clamp(20px,1.7vw,34px);font-weight:500;white-space:nowrap;text-shadow:0 0 4px #fff,0 0 2px #fff,0 0 8px #fff;line-height:1.1}',
    '.vops__tag.is-pt{font-style:normal;color:#17191B;background:none}',
    '.vops__tag.is-km{font-family:var(--f-text);font-style:normal;font-weight:700;font-size:clamp(13px,.95vw,19px);color:#2B2F33}',
    '.vops__tag.is-dim{font-family:var(--f-text);font-style:normal;font-weight:800;font-size:clamp(14px,1.05vw,21px);transform:translate(-50%,-50%) rotate(-90deg);background:rgba(255,255,255,.85);padding:.1em .5em;border-radius:99px}',
    '.vops__tag.is-txt{font-family:var(--f-text);font-style:normal;font-weight:800;font-size:clamp(16px,1.25vw,26px)}',
    '.vops__modes{display:grid;grid-template-columns:1fr 1fr;gap:.3em}',
    '.vops__modes button{min-height:2.5em;border-radius:.8em;background:var(--paper-2);font-weight:750;color:var(--ink-2);padding:0 .4em}',
    '.vops__modes button[aria-pressed="true"]{background:var(--ink);color:var(--paper)}',
    '.lab__read.vops-eq{flex-direction:column;align-items:flex-start;gap:.15em}.lab__read.vops-eq .lab__rval{font-size:1.3em}',
    '.vops__rule{margin:0;font-size:1.05em;text-align:center;padding:.4em 0;border-top:1px solid var(--line)}'
  ].join('');
  document.head.append(st);
})();

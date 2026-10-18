/* 디지털교과서 엔진 · charts.js — 선생님 화면용 작은 그래프(SVG)
   원칙: 한 축, 얇은 선, 값은 글자색, 색만으로 뜻을 전하지 않음(기호·이름 함께), 마우스를 올리면 값. */
(function () {
  'use strict';
  const DT = window.DT;
  const K = (DT.chart = {});
  K.color = { main: '#2A78D6', avg: '#8C8A84', ok: '#138A3E', bad: '#C9372C', warn: '#E5A100', grid: '#ECE6D8', axis: '#CFC6B2', text: '#4F5458' };
  let tipEl = null;
  function tip(e, html) {
    if (!tipEl) { tipEl = DT.el('div', { class: 'ctip', role: 'tooltip' }); document.body.append(tipEl); }
    if (!html) { tipEl.hidden = true; return; }
    tipEl.hidden = false; tipEl.innerHTML = html;
    const x = Math.min(innerWidth - tipEl.offsetWidth - 8, e.clientX + 14), y = Math.max(8, e.clientY - tipEl.offsetHeight - 10);
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
  }
  K.bindTips = (root) => {
    root.addEventListener('pointermove', (e) => { const t = e.target.closest('[data-tip]'); tip(e, t ? t.dataset.tip : null); });
    root.addEventListener('pointerleave', (e) => tip(e, null));
  };

  /* 가로 막대: rows=[{label, value(0~1), sub, flag}] */
  K.hbars = function (rows, o) {
    o = o || {};
    const w = DT.el('div', { class: 'hbars' });
    rows.forEach((r) => {
      const v = r.value == null ? null : DT.clamp(r.value, 0, 1);
      const low = v != null && v < (o.warnBelow || 0.5);
      w.append(DT.el('div', { class: 'hbar' + (low ? ' is-low' : '') + (r.onClick ? ' is-click' : ''), 'data-tip': DT.esc(r.tip || (r.label + ' · ' + (v == null ? '응답 없음' : Math.round(v * 100) + '%'))), onclick: r.onClick || null },
        DT.el('span', { class: 'hbar__label', title: DT.plain(r.label) }, DT.plain(r.label)),
        DT.el('span', { class: 'hbar__track' }, DT.el('i', { style: { width: (v == null ? 0 : v * 100) + '%' } })),
        DT.el('span', { class: 'hbar__val num' }, v == null ? '–' : Math.round(v * 100) + '%', low ? DT.el('b', { class: 'hbar__flag' }, '낮음') : null)));
    });
    K.bindTips(w);
    return w;
  };

  /* 선 그래프: series=[{name, pts:[[x,y]], color, dash}] x는 라벨 배열 기준 index */
  K.line = function (series, o) {
    o = o || {}; const W = o.w || 560, H = o.h || 220, L = 40, R = 14, T = 14, B = 30;
    const n = Math.max(2, o.labels ? o.labels.length : Math.max(...series.map((s) => s.pts.length)));
    const X = (i) => L + i / (n - 1) * (W - L - R), Y = (v) => T + (1 - v) * (H - T - B);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="lchart" role="img" aria-label="' + DT.esc(o.label || '그래프') + '">';
    [0, 0.5, 1].forEach((g) => (s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(g) + '" y2="' + Y(g) + '" stroke="' + K.color.grid + '"/><text x="' + (L - 8) + '" y="' + (Y(g) + 4) + '" text-anchor="end" font-size="11" fill="' + K.color.text + '">' + Math.round(g * 100) + '%</text>'));
    (o.labels || []).forEach((lb, i) => { if (n <= 8 || i % Math.ceil(n / 8) === 0) s += '<text x="' + X(i) + '" y="' + (H - 8) + '" text-anchor="middle" font-size="11" fill="' + K.color.text + '">' + DT.esc(lb) + '</text>'; });
    series.forEach((sr) => {
      const pts = sr.pts.filter((p) => p[1] != null);
      if (pts.length > 1) s += '<polyline fill="none" stroke="' + sr.color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" ' + (sr.dash ? 'stroke-dasharray="5 5"' : '') + ' points="' + pts.map((p) => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ') + '"/>';
      if (!sr.dash) pts.forEach((p) => (s += '<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="5" fill="' + sr.color + '" stroke="#fff" stroke-width="2" data-tip="' + DT.esc((o.labels ? o.labels[p[0]] + ' · ' : '') + sr.name + ' ' + Math.round(p[1] * 100) + '%') + '"/><circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="14" fill="transparent" data-tip="' + DT.esc((o.labels ? o.labels[p[0]] + ' · ' : '') + sr.name + ' ' + Math.round(p[1] * 100) + '%') + '"/>'));
    });
    s += '</svg>';
    const box = DT.el('div', { class: 'lchart-box', html: s });
    if (series.length > 1) box.append(DT.el('div', { class: 'legend' }, series.map((sr) => DT.el('span', null, DT.el('i', { style: { background: sr.color, opacity: sr.dash ? 0.6 : 1 } }), sr.name))));
    K.bindTips(box);
    return box;
  };

  /* 학생 × 문항 격자: rows=[{name, cells:[true|false|null|'note'], onClick(i)}] */
  K.grid = function (cols, rows) {
    const t = DT.el('div', { class: 'qgrid', style: { '--n': cols.length } });
    t.append(DT.el('span', { class: 'qgrid__corner' }), ...cols.map((c, i) => DT.el('span', { class: 'qgrid__col num', title: c }, String(i + 1))));
    rows.forEach((r) => {
      t.append(DT.el('span', { class: 'qgrid__name' }, r.name));
      r.cells.forEach((c, i) => {
        const cls = c === true ? 'ok' : c === false ? 'bad' : c === 'note' ? 'note' : 'none';
        const sym = c === true ? '○' : c === false ? '✕' : c === 'note' ? '✎' : '';
        t.append(DT.el('button', { class: 'qgrid__cell is-' + cls, type: 'button', 'data-tip': DT.esc(r.name + ' · ' + (i + 1) + '번 ' + cols[i] + ' · ' + ({ ok: '맞음', bad: '틀림', note: '서술형', none: '안 함' })[cls]), onclick: () => r.onClick && r.onClick(i) }, sym));
      });
    });
    K.bindTips(t);
    return t;
  };

  /* 세 칸 비율 막대 (예: 상·중·하, 알겠어요·헷갈려요·모르겠어요) */
  K.stack = function (parts) {
    const tot = parts.reduce((a, p) => a + p.n, 0) || 1;
    const w = DT.el('div', { class: 'stackbar' });
    parts.forEach((p) => { if (!p.n) return; w.append(DT.el('i', { style: { width: (p.n / tot * 100) + '%', background: p.color }, 'data-tip': DT.esc(p.label + ' ' + p.n + '명') }, p.n / tot > 0.12 ? p.label + ' ' + p.n : '')); });
    K.bindTips(w);
    return w;
  };

  /* QR (학생 링크) */
  K.qr = function (text, size) {
    if (!window.qrcode) return DT.el('div', null, text);
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    const w = DT.el('div', { class: 'qr', style: { width: (size || 180) + 'px', height: (size || 180) + 'px', background: '#fff', padding: '6px', borderRadius: '10px' }, html: q.createSvgTag({ cellSize: Math.max(2, Math.floor((size || 180) / q.getModuleCount())), margin: 2, scalable: true }) });
    const svg = w.querySelector('svg'); if (svg) { svg.style.width = '100%'; svg.style.height = '100%'; svg.style.display = 'block'; }   /* 칠판·학생 화면에는 teacher.css가 없으므로 크기를 직접 */
    return w;
  };
})();

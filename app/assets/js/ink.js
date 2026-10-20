/* 수업잇기 엔진 · ink.js — 판서
   어떤 화면 위에든 판서 면(surface)을 붙인다. 좌표는 면의 '원래 크기' 기준이라
   전자칠판·노트북·확대한 교과서 어디서 그려도 같은 자리에 남는다.
   도구: 손(끄기) · 펜 · 형광펜 · 지우개(획 단위) · 레이저(남지 않음). 되돌리기/다시하기. */
(function () {
  'use strict';
  const DT = window.DT;
  const Ink = (DT.ink = {});

  Ink.state = { tool: 'hand', color: '#17191B', size: 4, penSeen: false };
  /* 판서 색: 도구 줄에는 6칸. 「색 바꾸기」로 칸마다 다른 색을 고르면 이 기기에 기억한다 */
  Ink.defaults = {
    paper: ['#17191B', '#D32F45', '#1F5FBF', '#1C8A4A', '#E8730C', '#7B3FB5'],
    chalk: ['#F7F5EE', '#FFD84A', '#FF8E8E', '#8FD3FF', '#A8E06A', '#FFB067']
  };
  /* 고를 수 있는 색 — 종류별 */
  Ink.colorSets = [
    ['기본', ['#17191B', '#5F6368', '#D32F45', '#1F5FBF', '#1C8A4A', '#E8730C', '#7B3FB5', '#8B5A2B']],
    ['진한 색', ['#000000', '#8E1B2C', '#0D2F6B', '#0F5130', '#A04A00', '#4A1F75', '#5C3317', '#1F3A3D']],
    ['밝은 색', ['#FF5C7A', '#3D8BFF', '#2EB872', '#FF9F1C', '#A66BFF', '#00A8B5', '#E84FB0', '#C9A227']],
    ['파스텔', ['#F7F5EE', '#FFD84A', '#FF8E8E', '#8FD3FF', '#A8E06A', '#FFB067', '#D7B4FF', '#FFC4DD']],
    ['형광', ['#FFF200', '#39FF14', '#FF3EA5', '#00E5FF', '#FF9100', '#B2FF59', '#FF5252', '#E040FB']]
  ];
  Ink.palette = {
    paper: (DT.store.get('ink.slots.paper') || Ink.defaults.paper).slice(0, 6),
    chalk: (DT.store.get('ink.slots.chalk') || Ink.defaults.chalk).slice(0, 6)
  };
  ['paper', 'chalk'].forEach((k) => { while (Ink.palette[k].length < 6) Ink.palette[k].push(Ink.defaults[k][Ink.palette[k].length]); });
  /* 칸 색 바꾸기 창 — 위: 지금 6칸(바꿀 칸 고르기) / 아래: 종류별 색 */
  Ink.editColors = function (which, onDone) {
    const pal = Ink.palette[which];
    let pick = Math.max(0, pal.indexOf(Ink.state.color));
    const body = DT.el('div', { class: 'inkcol' });
    const slots = DT.el('div', { class: 'inkcol__slots' });
    const paint = () => {
      slots.innerHTML = '';
      pal.forEach((c, i) => {
        const b = DT.el('button', { class: 'inkcol__slot' + (i === pick ? ' is-on' : ''), type: 'button', 'aria-label': (i + 1) + '번 칸', style: { '--c': c } });
        b.addEventListener('click', () => { pick = i; paint(); });
        slots.append(b);
      });
    };
    body.append(DT.el('p', { class: 'inkcol__hint' }, '① 바꿀 칸을 누르고 ② 아래에서 새 색을 누르세요.'), slots);
    Ink.colorSets.forEach(([name, list]) => {
      const row = DT.el('div', { class: 'inkcol__row' });
      list.forEach((c) => {
        const b = DT.el('button', { class: 'inkcol__c', type: 'button', 'aria-label': name + ' ' + c, style: { '--c': c } });
        b.addEventListener('click', () => {
          const was = pal[pick]; pal[pick] = c; DT.store.set('ink.slots.' + which, pal.slice());
          if (Ink.state.color === was) Ink.set({ color: c }); else Ink.set({});
          paint();
        });
        row.append(b);
      });
      body.append(DT.el('div', { class: 'inkcol__set' }, DT.el('b', null, name), row));
    });
    paint();
    DT.modal({ title: which === 'chalk' ? '판서 색 바꾸기 (초록 칠판)' : '판서 색 바꾸기', body, cls: 'inkcol-modal', onClose: onDone,
      actions: [{ label: '처음 색으로', onClick: () => { Ink.defaults[which].forEach((c, i) => { pal[i] = c; }); DT.store.del('ink.slots.' + which); Ink.set({}); paint(); } }, { label: '다 했어요', kind: 'ink' }] });
  };
  Ink.sizes = [3, 5, 9];
  Ink.active = null;
  const listeners = [];
  Ink.onState = (fn) => listeners.push(fn);
  Ink.set = function (patch) {
    Object.assign(Ink.state, patch);
    DT.$$('.ink-layer').forEach((c) => c.classList.toggle('is-live', Ink.state.tool !== 'hand'));
    listeners.forEach((fn) => fn(Ink.state));
  };

  /* host: 면을 붙일 요소(position:relative), w/h: 논리 크기
     opt: { key, load:()=>strokes, save:(strokes)=>{}, readOnly } */
  Ink.Surface = function (host, w, h, opt) {
    opt = opt || {};
    const self = this;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cv = DT.el('canvas', { class: 'ink-layer' + (Ink.state.tool !== 'hand' && !opt.readOnly ? ' is-live' : ''), 'aria-hidden': 'true' });
    const lz = DT.el('canvas', { class: 'ink-laser', 'aria-hidden': 'true' });
    [cv, lz].forEach((c) => { c.width = w * dpr; c.height = h * dpr; c.style.width = '100%'; c.style.height = '100%'; });
    host.append(cv, lz);
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const lg = lz.getContext('2d'); lg.scale(dpr, dpr);
    let strokes = (opt.load && opt.load()) || [];
    let undo = [], redo = [];
    let cur = null, pid = null;
    const laser = [];

    function toLocal(e) {
      const r = cv.getBoundingClientRect();
      return [Math.round((e.clientX - r.left) * w / r.width), Math.round((e.clientY - r.top) * h / r.height)];
    }
    function drawStroke(ctx, s) {
      const p = s.p; if (!p || p.length < 2) return;
      if (s.r && s.t !== 'hl' && p.length > 4) { /* 애플펜슬 필압: 마디마다 굵기 */
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = s.c;
        for (let i = 2; i < p.length; i += 2) { const k = (s.r[i / 2 - 1] + s.r[i / 2]) / 2; ctx.lineWidth = s.s * (0.35 + k / 9 * 1.25); ctx.beginPath(); ctx.moveTo(p[i - 2], p[i - 1]); ctx.lineTo(p[i], p[i + 1]); ctx.stroke(); }
        ctx.restore(); return;
      }
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (s.t === 'hl') { ctx.globalAlpha = 0.32; ctx.globalCompositeOperation = 'multiply'; ctx.lineWidth = s.s * 4.2; ctx.lineCap = 'butt'; }
      else ctx.lineWidth = s.s;
      ctx.strokeStyle = s.c;
      ctx.beginPath(); ctx.moveTo(p[0], p[1]);
      if (p.length === 2) ctx.lineTo(p[0] + 0.1, p[1]);
      for (let i = 2; i < p.length - 2; i += 2) { const mx = (p[i] + p[i + 2]) / 2, my = (p[i + 1] + p[i + 3]) / 2; ctx.quadraticCurveTo(p[i], p[i + 1], mx, my); }
      if (p.length > 2) ctx.lineTo(p[p.length - 2], p[p.length - 1]);
      ctx.stroke(); ctx.restore();
    }
    /* 다 그린 획은 따로 한 장에 모아 두고, 지금 긋는 획만 매번 새로 그린다 (아이패드에서도 가볍게) */
    const cache = document.createElement('canvas'); cache.width = w * dpr; cache.height = h * dpr; const cg = cache.getContext('2d'); cg.scale(dpr, dpr);
    function redraw() { cg.clearRect(0, 0, w, h); strokes.forEach((s) => drawStroke(cg, s)); live(); }
    function live() { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); if (cache.width && cache.height) g.drawImage(cache, 0, 0); g.restore(); if (cur) drawStroke(g, cur); }
    function commit() { if (opt.save) opt.save(strokes); DT.emit('ink:change', { key: opt.key, n: strokes.length }); }
    function hit(s, x, y, r) {
      const p = s.p; const rr = r + (s.t === 'hl' ? s.s * 2.1 : s.s / 2);
      for (let i = 0; i < p.length; i += 2) { const dx = p[i] - x, dy = p[i + 1] - y; if (dx * dx + dy * dy < rr * rr) return true; }
      return false;
    }
    function eraseAt(x, y) {
      const before = strokes.length; const removed = strokes.filter((s) => hit(s, x, y, 14));
      if (!removed.length) return;
      strokes = strokes.filter((s) => !removed.includes(s));
      undo.push({ op: 'del', items: removed }); redo = [];
      if (strokes.length !== before) redraw();
    }
    function laserLoop() {
      lg.clearRect(0, 0, w, h);
      const now = performance.now();
      while (laser.length && now - laser[0].t > 650) laser.shift();
      if (laser.length > 1) {
        lg.lineCap = 'round'; lg.lineJoin = 'round';
        for (let i = 1; i < laser.length; i++) {
          const a = laser[i - 1], b = laser[i]; const k = 1 - (now - b.t) / 650;
          lg.strokeStyle = 'rgba(232,40,72,' + (0.85 * k) + ')'; lg.lineWidth = 10 * k + 2;
          lg.beginPath(); lg.moveTo(a.x, a.y); lg.lineTo(b.x, b.y); lg.stroke();
        }
        const l = laser[laser.length - 1];
        lg.fillStyle = 'rgba(232,40,72,.95)'; lg.beginPath(); lg.arc(l.x, l.y, 9, 0, 7); lg.fill();
      }
      if (laser.length) requestAnimationFrame(laserLoop);
    }

    /* 두 손가락: 판서하지 않고 화면을 움직인다 — 쓰던 획은 지우고, 두 손가락을 opt.passTo(원본 보기·3D 화면)에 넘긴다 */
    const touches = new Map();
    const forget = (e) => touches.delete(e.pointerId);
    cv.addEventListener('pointerup', forget); cv.addEventListener('pointercancel', forget);
    cv.addEventListener('pointerdown', (e) => {
      if (opt.readOnly || Ink.state.tool === 'hand') return;
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, e);
        if (touches.size >= 2) {
          e.preventDefault();
          if (pid != null) { try { cv.releasePointerCapture(pid); } catch (er) {} pid = null; cur = null; live(); }
          const tgt = typeof opt.passTo === 'function' ? opt.passTo() : opt.passTo;
          if (tgt) touches.forEach((ev) => {
            tgt.dispatchEvent(new PointerEvent('pointerdown', { pointerId: ev.pointerId, pointerType: 'touch', isPrimary: ev.isPrimary, clientX: ev.clientX, clientY: ev.clientY, button: 0, buttons: 1, bubbles: true, cancelable: true }));
            try { tgt.setPointerCapture(ev.pointerId); } catch (er) {}
          });
          touches.clear();   /* 넘긴 손가락의 나머지 움직임은 받은 쪽으로 간다 */
          return;
        }
      }
      if (e.pointerType === 'pen') Ink.state.penSeen = true;
      if (Ink.state.penSeen && e.pointerType === 'touch') return; /* 펜을 쓰는 중이면 손바닥 무시 */
      if (pid != null) return;
      e.preventDefault(); pid = e.pointerId; cv.setPointerCapture(pid);
      Ink.active = self;
      const [x, y] = toLocal(e);
      const t = Ink.state.tool;
      if (t === 'eraser') { eraseAt(x, y); return; }
      if (t === 'laser') { laser.push({ x, y, t: performance.now() }); if (laser.length === 1) requestAnimationFrame(laserLoop); return; }
      cur = { t: t === 'marker' ? 'hl' : 'pen', c: Ink.state.color, s: Ink.state.size, p: [x, y] };
      if (e.pointerType === 'pen' && e.pressure > 0 && t === 'pen') cur.r = [Math.round(e.pressure * 9)];
      live();
    });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerId !== pid) return;
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      const t = Ink.state.tool;
      for (const ev of evs) {
        const [x, y] = toLocal(ev);
        if (t === 'eraser') eraseAt(x, y);
        else if (t === 'laser') laser.push({ x, y, t: performance.now() });
        else if (cur) { const p = cur.p; const dx = x - p[p.length - 2], dy = y - p[p.length - 1]; if (dx * dx + dy * dy >= 4) { p.push(x, y); if (cur.r) cur.r.push(Math.round((ev.pressure || 0.5) * 9)); } }
      }
      if (cur) live();
    });
    const end = (e) => {
      if (e.pointerId !== pid) return;
      pid = null;
      if (cur) { strokes.push(cur); undo.push({ op: 'add', items: [cur] }); redo = []; cur = null; redraw(); commit(); }
      else if (Ink.state.tool === 'eraser') commit();
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);

    this.key = opt.key;
    this.canvas = cv;
    this.undo = () => { const o = undo.pop(); if (!o) return; if (o.op === 'add') strokes = strokes.filter((s) => !o.items.includes(s)); else strokes = strokes.concat(o.items); redo.push(o); redraw(); commit(); };
    this.redo = () => { const o = redo.pop(); if (!o) return; if (o.op === 'add') strokes = strokes.concat(o.items); else strokes = strokes.filter((s) => !o.items.includes(s)); undo.push(o); redraw(); commit(); };
    this.clear = () => { if (!strokes.length) return; undo.push({ op: 'del', items: strokes }); strokes = []; redo = []; redraw(); commit(); };
    this.count = () => strokes.length;
    this.set = (s) => { strokes = s || []; undo = []; redo = []; redraw(); };
    this.get = () => strokes;
    this.destroy = () => { cv.remove(); lz.remove(); if (Ink.active === self) Ink.active = null; };
    this.focus = () => { Ink.active = self; };
    redraw();
    Ink.active = self;
  };

  /* 판서 면 저장 키 */
  Ink.storeKey = (course, cls, surface) => 'ink.' + course + '.' + (cls || 'none') + '.' + surface;

  /* ── 판서 도구 막대 ─────────────────────────────────
     Ink.toolbar(host, { onBlank(), chalk: ()=>bool }) → 접힌 '판서' 단추 하나. 펼치면 세로 막대. */
  Ink.toolbar = function (host, opt) {
    opt = opt || {};
    const wrap = DT.el('div', { class: 'inkbar', 'data-open': 'false' });
    const main = DT.el('button', { class: 'inkbar__main', type: 'button', 'aria-expanded': 'false', title: '판서 (P)', html: DT.icon('pen') + '<span>판서</span>' });
    const panel = DT.el('div', { class: 'inkbar__panel', role: 'toolbar', 'aria-label': '판서 도구' });
    const tools = [
      ['hand', 'hand', '손 · 판서 끄기 (Esc)'], ['pen', 'pen', '펜 (P)'], ['marker', 'marker', '형광펜 (H)'], ['eraser', 'eraser', '지우개 (E)'], ['laser', 'laser', '레이저 (L)']
    ];
    /* 도구 줄 접기: 펜은 그대로 쓰면서 왼쪽 도구 줄만 숨겨 교과서 글을 가리지 않게 */
    const mini = DT.el('button', { class: 'inkbar__mini', type: 'button', title: '도구 줄 접기 (펜은 그대로)', 'aria-label': '도구 줄 접기', html: DT.icon('shrink') + '<span>접기</span>' });
    mini.addEventListener('click', () => { wrap.dataset.mini = 'true'; });
    panel.append(mini);
    const tbtn = {};
    tools.forEach(([id, ic, label]) => {
      const b = DT.el('button', { class: 'inkbar__tool', type: 'button', title: label, 'aria-label': label, html: DT.icon(ic) });
      b.addEventListener('click', () => Ink.set({ tool: id }));
      tbtn[id] = b; panel.append(b);
    });
    panel.append(DT.el('span', { class: 'inkbar__sep' }));
    const sw = DT.el('div', { class: 'inkbar__swatches' });
    const paintSwatches = () => {
      sw.innerHTML = '';
      const pal = opt.chalk && opt.chalk() ? Ink.palette.chalk : Ink.palette.paper;
      pal.forEach((c) => {
        const b = DT.el('button', { class: 'inkbar__sw', type: 'button', 'aria-label': '색 ' + c, style: { '--c': c } });
        if (c === Ink.state.color) b.classList.add('is-on');
        b.addEventListener('click', () => Ink.set({ color: c, tool: Ink.state.tool === 'hand' || Ink.state.tool === 'eraser' || Ink.state.tool === 'laser' ? 'pen' : Ink.state.tool }));
        sw.append(b);
      });
    };
    panel.append(sw);
    const more = DT.el('button', { class: 'inkbar__more', type: 'button', title: '판서 색 바꾸기', html: DT.icon('palette') + '<span>색 바꾸기</span>' });
    more.addEventListener('click', () => Ink.editColors(opt.chalk && opt.chalk() ? 'chalk' : 'paper'));
    panel.append(more);
    const sizes = DT.el('div', { class: 'inkbar__sizes' });
    Ink.sizes.forEach((s, i) => {
      const b = DT.el('button', { class: 'inkbar__size', type: 'button', 'aria-label': ['가늘게', '보통', '굵게'][i], style: { '--d': (6 + i * 5) + 'px' } });
      b.addEventListener('click', () => Ink.set({ size: s }));
      sizes.append(b);
    });
    panel.append(sizes, DT.el('span', { class: 'inkbar__sep' }));
    const act = (ic, label, fn) => { const b = DT.el('button', { class: 'inkbar__tool', type: 'button', title: label, 'aria-label': label, html: DT.icon(ic) }); b.addEventListener('click', fn); panel.append(b); return b; };
    act('undo', '되돌리기 (Ctrl+Z)', () => Ink.active && Ink.active.undo());
    act('redo', '다시 하기', () => Ink.active && Ink.active.redo());
    const clr = act('trash', '이 화면 판서 모두 지우기', () => Ink.active && Ink.active.clear());
    clr.classList.add('inkbar__clear'); clr.append(DT.el('span', null, '모두 지우기'));   /* 아이콘만으로는 찾기 어렵다 — 글을 붙인다 */
    if (opt.onBlank) act('board', '빈 칠판 열기', opt.onBlank);
    wrap.append(main, panel);
    host.append(wrap);

    function setOpen(v) { wrap.dataset.open = v ? 'true' : 'false'; main.setAttribute('aria-expanded', v ? 'true' : 'false'); if (!v) Ink.set({ tool: 'hand' }); else if (Ink.state.tool === 'hand') Ink.set({ tool: 'pen' }); }
    main.addEventListener('click', () => { if (wrap.dataset.mini === 'true') { wrap.dataset.mini = 'false'; return; } setOpen(wrap.dataset.open !== 'true'); });
    function sync() {
      Object.entries(tbtn).forEach(([id, b]) => b.setAttribute('aria-pressed', Ink.state.tool === id ? 'true' : 'false'));
      DT.$$('.inkbar__size', sizes).forEach((b, i) => b.classList.toggle('is-on', Ink.sizes[i] === Ink.state.size));
      paintSwatches();
      main.classList.toggle('is-drawing', Ink.state.tool !== 'hand');
      if (Ink.state.tool !== 'hand' && wrap.dataset.open !== 'true') { wrap.dataset.open = 'true'; main.setAttribute('aria-expanded', 'true'); }
    }
    Ink.onState(sync); sync();
    return { open: setOpen, el: wrap, refresh: sync };
  };

  /* 공통 단축키 */
  Ink.keys = function (e) {
    if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return false;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); Ink.active && (e.shiftKey ? Ink.active.redo() : Ink.active.undo()); return true; }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (k === 'p') { Ink.set({ tool: 'pen' }); return true; }
    if (k === 'h') { Ink.set({ tool: 'marker' }); return true; }
    if (k === 'e') { Ink.set({ tool: 'eraser' }); return true; }
    if (k === 'l') { Ink.set({ tool: 'laser' }); return true; }
    return false;
  };
})();

/* 수업잇기 엔진 · core.js
   공통 도구: DOM, 저장소, 글 표기(수식·핵심어), 아이콘, 알림·모달, 날짜.
   모든 화면(board/student/teacher)이 가장 먼저 불러온다. */
(function () {
  'use strict';
  const DT = (window.DT = window.DT || {});
  DT.config = Object.assign({ mode: 'demo', courseId: 'demo', contentPath: '../content/', firebase: null, school: '', teacherEmails: [] }, window.DT_CONFIG || {});

  /* ── DOM ─────────────────────────────────────────── */
  DT.$ = (s, r) => (r || document).querySelector(s);
  DT.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  DT.el = function (tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') { for (const sk in v) { if (sk.startsWith('--')) n.style.setProperty(sk, v[sk]); else n.style[sk] = v[sk]; } }
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) n.append(c.nodeType ? c : document.createTextNode(String(c)));
    return n;
  };
  DT.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  DT.uid = (p) => (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  DT.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  DT.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  DT.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  DT.shuffle = (arr, seed) => {
    const a = arr.slice(); let s = seed || Math.floor(Math.random() * 1e9);
    const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  DT.loadScript = (src) => new Promise((ok, no) => {
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('불러오지 못함: ' + src)); document.head.append(s);
  });
  /* 학생 링크: student.html?j=코드 — 이 코드로 들어온 학생은 로그인하면 명단에 저절로 들어간다 */
  DT.studentLink = (code) => { const u = new URL('student.html', location.href); u.search = code ? '?j=' + encodeURIComponent(code) : ''; u.hash = ''; return u.href; };
  /* ── 답 입력 자판: 숫자 + 그 단원에 필요한 기호 + 지우기 ──
     기호는 content.js 의 단원(units[].keys) → 교과서 전체(meta.keys) → 과목 기본 순서로 찾는다 */
  DT.keyDefaults = { '수학': ['√', 'π', '/', '−', '(', ')', ',', '²', '°', '×'], '과학': ['×', '/', '−', '²', '³', '°', '(', ')', '.', 'μ'] };
  DT.keysFor = function (tb, screenId) {
    const scr = tb && screenId && tb._byId ? tb._byId[screenId] : null;
    const unit = tb && (tb.units || []).find((u) => scr ? (u.children || []).some((c) => (c.screens || []).some((x) => x.id === screenId)) : false);
    return (unit && unit.keys) || (tb && tb.meta && tb.meta.keys) || DT.keyDefaults[tb && tb.meta && tb.meta.subject] || DT.keyDefaults['수학'];
  };
  DT.keypad = function (inp0, keys, onInput) {
    const I = () => (typeof inp0 === 'function' ? inp0() : inp0);   /* 칸이 여러 개면 지금 누른 칸 */
    const ins = (k) => { const inp = I(); const p = inp.selectionStart == null ? inp.value.length : inp.selectionStart, q = inp.selectionEnd == null ? p : inp.selectionEnd; inp.value = inp.value.slice(0, p) + k + inp.value.slice(q); inp.setSelectionRange(p + k.length, p + k.length); onInput && onInput(inp.value); };
    const del = () => { const inp = I(); const p = inp.selectionStart == null ? inp.value.length : inp.selectionStart; if (p === 0) return; inp.value = inp.value.slice(0, p - 1) + inp.value.slice(p); inp.setSelectionRange(p - 1, p - 1); onInput && onInput(inp.value); };
    const pad = DT.el('div', { class: 'keypad', 'aria-label': '답 입력 자판' });
    const key = (t, fn, cls) => { const b = DT.el('button', { type: 'button', class: cls || '' }, t); b.addEventListener('pointerdown', (e) => e.preventDefault()); b.onclick = fn; return b; };
    const nums = DT.el('div', { class: 'keypad__nums' }, ['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', '−'].map((k) => key(k, () => ins(k === '−' ? '-' : k))));
    const syms = DT.el('div', { class: 'keypad__syms' }, keys.map((k) => key(k, () => ins(k === '−' ? '-' : k), 'is-sym')));
    const abc = key('글자 키보드', () => { const inp = I(); inp.setAttribute('inputmode', 'text'); inp.blur(); setTimeout(() => inp.focus(), 50); }, 'is-wide');
    const back = key('⌫ 지우기', del, 'is-wide is-del');
    pad.append(nums, syms, DT.el('div', { class: 'keypad__row' }, abc, back));
    return pad;
  };
  /* 여러 문항(⑴⑵…) 즉석 답: 한 칸에 이어 붙여 보낸다 */
  DT.PSEP = ' ;; ';
  /* 문제에 맞는 답 칸: 정답 모양을 보고 칸을 나눈다
     (5, 2) → ( □ , □ )  ·  m=1, n=2 → m = □  n = □  ·  그 밖 → 한 칸.  값은 정답과 같은 모양으로 이어 붙여 채점된다 */
  DT.ansFields = function (key, onInput) {
    const k0 = String(key || '').split('|')[0].replace(/\s/g, '');
    const box = DT.el('div', { class: 'ansf' }); const ins = [];
    const mk = (ph) => { const i = DT.el('input', { class: 'ans-input ansf__in', placeholder: ph, inputmode: 'none', autocomplete: 'off', 'aria-label': ph || '답' }); i.addEventListener('input', () => onInput && onInput()); ins.push(i); return i; };
    const tup = k0.match(/^([A-Za-z]?)\(([^()]*,[^()]*)\)$/);
    const named = !tup && /^[a-zA-Z]\w*=[^,=]+(,[a-zA-Z]\w*=[^,=]+)+$/.test(k0) ? k0.split(',').map((x) => x.split('=')[0]) : null;
    let value, set;
    if (tup) {
      const n = tup[2].split(',').length; box.classList.add('ansf--tuple');
      box.append(DT.el('span', { class: 'ansf__p' }, '('));
      for (let i = 0; i < n; i++) { if (i) box.append(DT.el('span', { class: 'ansf__p' }, ',')); box.append(mk(['x 성분', 'y 성분', 'z 성분'][i] || '')); }
      box.append(DT.el('span', { class: 'ansf__p' }, ')'));
      value = () => (ins.every((i) => !i.value.trim()) ? '' : '(' + ins.map((i) => i.value.trim()).join(',') + ')');
      set = (v) => { const m = String(v || '').match(/\(([^()]*)\)/); if (m) m[1].split(',').forEach((x, i) => { if (ins[i]) ins[i].value = x.trim(); }); };
    } else if (named) {
      box.classList.add('ansf--named');
      named.forEach((nm) => box.append(DT.el('label', { class: 'ansf__lab' }, DT.el('b', null, nm + ' ='), mk(''))));
      value = () => (ins.every((i) => !i.value.trim()) ? '' : named.map((nm, i) => nm + '=' + ins[i].value.trim()).join(','));
      set = (v) => String(v || '').split(',').forEach((p) => { const [a, b] = p.split('='); const i = named.indexOf((a || '').trim()); if (i >= 0 && ins[i]) ins[i].value = (b || '').trim(); });
    } else {
      box.append(mk(/,/.test(k0) ? '답이 여러 개면 쉼표(,)로 나눠요' : '답을 적어요'));
      value = () => ins[0].value.trim(); set = (v) => { ins[0].value = v || ''; };
    }
    let cur = ins[0]; box.addEventListener('focusin', (e) => { if (ins.includes(e.target)) cur = e.target; });
    return { el: box, inputs: ins, value, set, current: () => cur };
  };
  /* 자판 기호: 단원 기호 + 정답에 글자·식이 들어가면 x y z a b e + = 도 */
  DT.keysPlus = (base, key) => {
    const k = String(key || ''); const out = base.slice();
    if (/[a-zA-Z=+]/.test(k)) ['x', 'y', 'z', 'a', 'b', 'e', '+', '='].forEach((c) => { if (!out.includes(c)) out.push(c); });
    if (/[₁₂₃]/.test(k)) ['₁', '₂', '₃'].forEach((c) => { if (!out.includes(c)) out.push(c); });
    return out;
  };
  /* 그리기 판 (그림·서술 문제): 손가락·애플펜슬로 그리고, 값은 선 데이터(JSON) */
  DT.drawPad = function (opt) {
    opt = opt || {}; const W = opt.w || 900, H = opt.h || 520;
    let strokes = opt.value ? (() => { try { return JSON.parse(opt.value); } catch (e) { return []; } })() : [];
    const host = DT.el('div', { class: 'drawpad', style: { aspectRatio: W + ' / ' + H } });
    DT.ink.set({ tool: 'pen' });   /* 펜을 먼저 켜야 판이 손가락·펜을 받는다 */
    const surf = new DT.ink.Surface(host, W, H, { load: () => strokes, save: (st) => { strokes = st; opt.onInput && opt.onInput(); } });
    surf.focus && surf.focus();
    const tb = DT.el('div', { class: 'drawpad__bar' },
      DT.el('span', { class: 'muted' }, '손가락이나 애플펜슬로 풀이를 그려요'),
      DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('pen') + '펜', onclick: () => DT.ink.set({ tool: 'pen' }) }),
      DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('eraser') + '지우개', onclick: () => DT.ink.set({ tool: 'eraser' }) }),
      DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('undo') + '되돌리기', onclick: () => surf.undo() }),
      DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button', html: DT.icon('trash') + '모두 지우기', onclick: () => surf.clear() }));
    return { el: DT.el('div', { class: 'drawpad-wrap' }, tb, host), value: () => (strokes.length ? JSON.stringify(strokes) : ''), destroy: () => surf.destroy() };
  };
  /* 선 데이터 → 작은 그림 (칠판 응답판·선생님 확인용) */
  DT.drawThumb = function (json, w, h) {
    const cv = DT.el('canvas', { class: 'drawthumb' }); cv.width = w; cv.height = h; const g = cv.getContext('2d');
    let st = []; try { st = JSON.parse(json || '[]'); } catch (e) {}
    let mx = 1, my = 1; st.forEach((s) => { for (let i = 0; i < (s.p || []).length; i += 2) { mx = Math.max(mx, s.p[i]); my = Math.max(my, s.p[i + 1]); } });
    const k = Math.min(w / Math.max(mx + 10, 300), h / Math.max(my + 10, 180));
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.lineCap = 'round'; g.lineJoin = 'round';
    st.forEach((s) => { const p = s.p || []; if (p.length < 2) return; g.strokeStyle = s.c || '#17191B'; g.globalAlpha = s.t === 'hl' ? 0.3 : 1; g.lineWidth = Math.max(1, (s.s || 3) * k * (s.t === 'hl' ? 4 : 1)); g.beginPath(); g.moveTo(p[0] * k, p[1] * k); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] * k, p[i + 1] * k); g.stroke(); });
    return cv;
  };
  DT.isDrawing = (v) => typeof v === 'string' && v.startsWith('[{') && v.includes('"p"');
  DT.qs = () => {
    const out = {};
    const add = (str) => str.replace(/^[?#]/, '').split('&').forEach((kv) => { if (!kv) return; const [k, v = ''] = kv.split('='); out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); });
    add(location.search); add(location.hash);
    return out;
  };

  /* ── 저장소 (없어도 동작) ───────────────────────────── */
  const mem = {};
  /* 서버 저장 모아 보내기 — 손을 멈추고 몇 초 뒤 한 번, 화면을 떠나거나 앱을 내릴 때는 바로.
     (무료 한도: 하루 쓰기 2만 번. 이 기기에는 그때그때 저장되므로 잃는 것은 없다) */
  DT.later = (() => {
    const q = {};
    const run = (k) => { const t = q[k]; if (!t) return; delete q[k]; clearTimeout(t.id); try { t.fn(); } catch (e) {} };
    const flush = () => Object.keys(q).forEach(run);
    addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
    addEventListener('pagehide', flush);
    const later = (k, fn, ms) => { if (q[k]) clearTimeout(q[k].id); q[k] = { fn, id: setTimeout(() => run(k), ms || 6000) }; };
    later.flush = flush;
    return later;
  })();

  DT.store = {
    get(k, d) { try { const v = localStorage.getItem('dt.' + k); return v == null ? (k in mem ? mem[k] : d) : JSON.parse(v); } catch (e) { return k in mem ? mem[k] : d; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem('dt.' + k, JSON.stringify(v)); } catch (e) { /* 저장 공간 없음: 메모리에만 */ } },
    del(k) { delete mem[k]; try { localStorage.removeItem('dt.' + k); } catch (e) {} },
    keys(prefix) { try { return Object.keys(localStorage).filter((k) => k.startsWith('dt.' + prefix)).map((k) => k.slice(3)); } catch (e) { return Object.keys(mem).filter((k) => k.startsWith(prefix)); } }
  };

  /* ── 사건 버스 ───────────────────────────────────── */
  const handlers = {};
  DT.on = (ev, fn) => { (handlers[ev] = handlers[ev] || []).push(fn); return () => { handlers[ev] = handlers[ev].filter((f) => f !== fn); }; };
  DT.emit = (ev, data) => (handlers[ev] || []).slice().forEach((fn) => fn(data));

  /* ── 글 표기 → HTML ───────────────────────────────────
     $..$ 수식, $$..$$ 가운데 수식, [[용어]] 핵심어(빈칸 후보), **굵게**, ==형광==, __밑줄__, 줄바꿈 */
  DT.tex = function (src, display) {
    if (window.katex) {
      try { return window.katex.renderToString(src, { displayMode: !!display, throwOnError: false, strict: 'ignore', output: 'html' }); } catch (e) {}
    }
    return '<span class="math-fallback">' + DT.esc(src) + '</span>';
  };
  DT.md = function (s, opt) {
    if (s == null) return '';
    opt = opt || {};
    const keep = [];
    let t = String(s);
    t = t.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => { keep.push('<div class="mathd">' + DT.tex(m, true) + '</div>'); return '\u0000' + (keep.length - 1) + '\u0000'; });
    t = t.replace(/\$([^$\n]+?)\$/g, (_, m) => { keep.push(DT.tex(m, false)); return '\u0000' + (keep.length - 1) + '\u0000'; });
    t = DT.esc(t);
    t = t.replace(/\[\[([^\]]+?)\]\]/g, (_, m) => {
      if (opt.blank) return '<span class="blank" data-answer="' + m + '"></span>';
      return '<b class="term">' + m + '</b>';
    });
    t = t.replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>').replace(/==([^=]+?)==/g, '<mark>$1</mark>').replace(/__([^_]+?)__/g, '<u>$1</u>');
    t = t.replace(/\n/g, '<br>');
    t = t.replace(/\u0000(\d+)\u0000/g, (_, i) => keep[+i]);
    return t;
  };
  /* 수식을 사람이 읽는 글로: S\cos\theta → S cos θ (생기부·CSV·목록용) */
  DT.texPlain = (t) => {
    let x = String(t), prev;
    do { prev = x; x = x.replace(/\\(d|t)?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$2/$3').replace(/\\sqrt\{([^{}]*)\}/g, '√$1').replace(/\\(overline|mathrm|text|vec|overrightarrow|operatorname|mathbf)\{([^{}]*)\}/g, '$2'); } while (x !== prev);
    return x.replace(/\\sqrt\s*(\d)/g, '√$1').replace(/\^\{?\\circ\}?/g, '°')
      .replace(/\\theta/g, 'θ').replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\pi/g, 'π').replace(/\\times/g, '×').replace(/\\cdot/g, '·')
      .replace(/\\le(q)?/g, '≤').replace(/\\ge(q)?/g, '≥').replace(/\\(cos|sin|tan|log)/g, ' $1 ').replace(/\\left|\\right|\\,|\;/g, '')
      .replace(/\^2/g, '²').replace(/\^3/g, '³').replace(/[{}]/g, '').replace(/\\/g, '').replace(/\s+/g, ' ').replace(/ ([,.)])/g, '$1').trim();
  };
  /* 출처 표시 + 이용 범위 (저작권법 제25조·제37조) — 교과서 내용이 보이는 곳마다 */
  DT.credit = (tb) => {
    const m = (tb && tb.meta) || {};
    const src = m.source || [m.publisher, m.title ? '『' + DT.plain(m.title) + '』' : ''].filter(Boolean).join(' ');
    return (src ? '출처: ' + src + ' · ' : '') + '수업 목적으로만 이용 — 다른 곳에 올리거나 나누지 마세요';
  };
  DT.plain = (s) => String(s || '').replace(/\$\$?([^$]+)\$\$?/g, (_, m) => DT.texPlain(m)).replace(/\[\[|\]\]|\*\*|==|__/g, '');
  DT.terms = (s) => { const out = []; String(s || '').replace(/\[\[([^\]]+?)\]\]/g, (_, m) => out.push(m)); return out; };

  /* ── 답 비교용 정리 ─────────────────────────────────── */
  DT.norm = function (s) {
    return String(s == null ? '' : s).normalize('NFKC').toLowerCase()
      .replace(/[−–—]/g, '-').replace(/[×✕]/g, '*').replace(/÷/g, '/').replace(/[，]/g, ',')
      .replace(/\\(left|right)/g, '').replace(/\\(overrightarrow|vec|overline|mathrm)/g, '').replace(/[→⃗]/g, '').replace(/[\s{}]/g, '').replace(/^\((.*)\)$/, '$1')
      .replace(/(입니다|이다|다|요|임)\.?$/, '').replace(/\.$/, '');
  };
  DT.numVal = function (s) {
    let t = DT.norm(s).replace(/√(\d+(\.\d+)?)/g, 'Math.sqrt($1)').replace(/π/g, 'Math.PI').replace(/\^/g, '**').replace(/²/g, '**2').replace(/³/g, '**3');
    if (!/^[-+*/().\d\sMathsqrtPI*]+$/.test(t)) return NaN;
    t = t.replace(/(\d)(Math)/g, '$1*$2');
    try { const v = Function('"use strict";return (' + t + ')')(); return typeof v === 'number' && isFinite(v) ? v : NaN; } catch (e) { return NaN; }
  };

  /* ── 날짜 ───────────────────────────────────────── */
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  DT.date = (t) => { const d = new Date(t); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일 (' + WD[d.getDay()] + ')'; };
  DT.time = (t) => { const d = new Date(t); const h = d.getHours(); return (h < 12 ? '오전 ' : '오후 ') + ((h % 12) || 12) + ':' + String(d.getMinutes()).padStart(2, '0'); };
  DT.ago = (t) => { const s = (Date.now() - t) / 1000; if (s < 60) return '방금'; if (s < 3600) return Math.floor(s / 60) + '분 전'; if (s < 86400) return Math.floor(s / 3600) + '시간 전'; return Math.floor(s / 86400) + '일 전'; };
  DT.pct = (x) => (x == null || isNaN(x) ? '–' : Math.round(x * 100) + '%');
  DT.ymd = (t) => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  /* ── 아이콘 (선 2px, 24 격자, 한 세트) ──────────────────── */
  const P = {
    menu: 'M4 6h16M4 12h16M4 18h10',
    toc: 'M4 5h4v4H4zM4 15h4v4H4zM11 7h9M11 17h9M11 12h6',
    pen: 'M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3',
    marker: 'M9 15l-5 5h5l2-2M9 15l7-7 3 3-7 7-3-3zM16 8l2-2 3 3-2 2',
    eraser: 'M8 20h12M5 16l9-9 5 5-6 6H9l-4-2zM10 11l5 5',
    laser: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1',
    hand: 'M8 13V6a1.5 1.5 0 0 1 3 0v6M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7s-5-2-6.5-4.5L3 12.5a1.5 1.5 0 0 1 2.5-1.6L8 14',
    undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    book: 'M3 5.5C5 4.5 8 4.5 12 6c4-1.5 7-1.5 9-.5V19c-2-1-5-1-9 .5C8 18 5 18 3 19V5.5zM12 6v13.5',
    tools: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M16 4v4M8 10v4M18 16v4',
    expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
    shrink: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5',
    x: 'M6 6l12 12M18 6L6 18',
    left: 'M15 5l-7 7 7 7',
    right: 'M9 5l7 7-7 7',
    up: 'M5 15l7-7 7 7',
    down: 'M5 9l7 7 7-7',
    check: 'M5 12.5l4.5 4.5L19 7',
    send: 'M4 12l16-8-6 16-3-7-7-1zM11 13l9-9',
    users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.6-3.5 3.3-5.5 6.5-5.5s5.9 2 6.5 5.5M16 4.3a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.7.8 2.8 2.6 3 5.2',
    user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21c.8-4 3.8-6.5 7.5-6.5s6.7 2.5 7.5 6.5',
    timer: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2.5 2.5M9 2h6M19 6l1.5-1.5',
    dice: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM8.5 8.5h0M15.5 8.5h0M12 12h0M8.5 15.5h0M15.5 15.5h0',
    signal: 'M6 18V14M12 18V9M18 18V5',
    ask: 'M12 21a9 9 0 1 0-8-4.9L3 21l4.9-1A9 9 0 0 0 12 21zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5v.7M12 17h0',
    grid: 'M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16',
    board: 'M3 4h18v12H3zM8 20l4-4 4 4M7 9h6M7 12h9',
    plus: 'M12 5v14M5 12h14',
    minus: 'M5 12h14',
    fit: 'M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3M8 12h8',
    download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
    upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
    print: 'M7 9V3h10v6M7 17H4v-7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v7h-3M7 14h10v7H7z',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
    home: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z',
    list: 'M9 6h11M9 12h11M9 18h11M4.5 6h0M4.5 12h0M4.5 18h0',
    chart: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
    note: 'M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h6',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    play: 'M7 4l13 8-13 8z',
    pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
    reset: 'M4 12a8 8 0 1 0 2.3-5.6L4 8.7M4 4v4.7h4.7',
    cube: 'M12 2l9 5v10l-9 5-9-5V7l9-5zM12 12l9-5M12 12v10M12 12L3 7',
    flask: 'M9 3h6M10 3v6L4.5 18.5A1.6 1.6 0 0 0 6 21h12a1.6 1.6 0 0 0 1.5-2.5L14 9V3M7 15h10',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
    star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
    compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
    refresh: 'M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4',
    pencil: 'M15 4l5 5L9 20H4v-5z',
    calendar: 'M4 6h16v14H4zM4 10h16M9 3v5M15 3v5',
    target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h0',
    lock: 'M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3',
    logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
    camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z',
    sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4',
    question: 'M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.5V14M12 18h0M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z',
    qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2M14 18h2v2M18 18h2v2h-2zM6.5 6.5h1M16.5 6.5h1M6.5 16.5h1',
    palette: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1-.1-2.2 1.2-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10zM7.5 12h0M9.5 7.5h0M14.5 7.5h0M17 11h0',
    more: 'M5 12h0M12 12h0M19 12h0'
  };
  DT.icon = function (name, cls) {
    const d = P[name] || P.more;
    const dots = /h0/.test(d);
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" aria-hidden="true"' + (dots ? ' style="stroke-linecap:round"' : '') + '><path d="' + d + '"/></svg>';
  };
  DT.iconEl = (name, cls) => { const t = document.createElement('template'); t.innerHTML = DT.icon(name, cls); return t.content.firstChild; };

  /* ── 서버(Firestore) 저장 규칙 검사 ─────────────────
     체험 모드도 실제 서버와 같은 규칙으로 막아서, 점검(audit·flows)에서 미리 잡는다.
     Firestore가 거부하는 것: 배열 안의 배열, 함수·특수 객체, 1MiB 넘는 문서 (undefined 는 ignoreUndefinedProperties 로 무시) */
  DT.fsCheck = function (data, where) {
    const bad = [];
    const walk = (v, path, inArr) => {
      if (v === null || v === undefined || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return;
      if (typeof v === 'function') return bad.push(path + ': 함수');
      if (Array.isArray(v)) { if (inArr) bad.push(path + ': 배열 안의 배열'); v.forEach((x, i) => walk(x, path + '[' + i + ']', true)); return; }
      if (typeof v === 'object') {
        const pr = Object.getPrototypeOf(v);
        if (pr !== Object.prototype && pr !== null && !(v instanceof Date) && !(v && v.toMillis)) return bad.push(path + ': 특수 객체');
        Object.keys(v).forEach((k) => walk(v[k], path + '.' + k, false));
      }
    };
    walk(data, where || 'doc', false);
    try { if (JSON.stringify(data).length > 1000000) bad.push((where || 'doc') + ': 문서가 1MB를 넘음'); } catch (e) { bad.push((where || 'doc') + ': 저장할 수 없는 값'); }
    if (bad.length) { const e = new Error('서버에 저장할 수 없는 모양이에요 — ' + bad.slice(0, 3).join(', ')); e.code = 'fs-shape'; throw e; }
    return data;
  };

  /* 조용히 실패하지 않게: 처리 안 된 오류는 화면 아래에 알린다 (같은 말은 10초에 한 번) */
  const errSeen = {};
  const showErr = (msg) => { msg = String(msg || '').slice(0, 160); if (!msg || /ResizeObserver|Script error|AbortError|NotAllowedError|fullscreen/i.test(msg)) return; const t = Date.now(); if (errSeen[msg] && t - errSeen[msg] < 10000) return; errSeen[msg] = t; console.error('[수업잇기]', msg); if (DT.toast && document.body) DT.toast('문제가 생겼어요: ' + msg, 'bad'); };
  window.addEventListener('unhandledrejection', (e) => showErr(e.reason && (e.reason.message || e.reason.code || e.reason)));
  window.addEventListener('error', (e) => { if (e.filename && !/\/assets\/js\//.test(e.filename)) return; showErr(e.message); });

  /* ── 알림 ───────────────────────────────────────── */
  DT.toast = function (msg, kind) {
    let w = DT.$('.toast-wrap');
    if (!w) { w = DT.el('div', { class: 'toast-wrap', role: 'status', 'aria-live': 'polite' }); document.body.append(w); }
    const t = DT.el('div', { class: 'toast' + (kind === 'bad' ? ' toast--bad' : '') }, msg);
    w.append(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 300); }, kind === 'bad' ? 4200 : 2600);
  };

  /* ── 모달 ─────────────────────────────────────────
     DT.modal({ title, body: Node|string, actions: [{label, kind:'ink'|'accent'|'', onClick(close) }], wide, onClose }) */
  DT.modal = function (o) {
    const prevFocus = document.activeElement;
    const scrim = DT.el('div', { class: 'scrim', role: 'presentation' });
    const box = DT.el('div', { class: 'modal' + (o.wide ? ' modal--wide' : '') + (o.cls ? ' ' + o.cls : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title || '' });
    const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey, true); if (o.onClose) o.onClose(); if (prevFocus && prevFocus.focus) prevFocus.focus(); };
    const head = DT.el('div', { class: 'modal__head' }, DT.el('h2', { class: 'modal__title' }, o.title || ''), DT.el('button', { class: 'icon-btn', 'aria-label': '닫기', html: DT.icon('x'), onclick: close }));
    const body = DT.el('div', { class: 'modal__body' });
    if (typeof o.body === 'string') body.innerHTML = o.body; else if (o.body) body.append(o.body);
    box.append(head, body);
    if (o.actions && o.actions.length) {
      const foot = DT.el('div', { class: 'modal__foot' });
      o.actions.forEach((a) => foot.append(DT.el('button', { class: 'btn' + (a.kind ? ' btn--' + a.kind : ''), html: (a.icon ? DT.icon(a.icon) : '') + DT.esc(a.label), onclick: () => (a.onClick ? a.onClick(close) : close()) })));
      box.append(foot);
    }
    scrim.append(box);
    scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim && !o.sticky) close(); });
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    document.body.append(scrim);
    setTimeout(() => { const f = body.querySelector('input,textarea,select') || body.querySelector('button') || box.querySelector('.modal__foot .btn--ink, .modal__foot .btn--accent') || box.querySelector('button'); if (f) f.focus({ preventScroll: true }); }, 30);
    return { close, box, body };
  };

  /* 확인 창 (window.confirm 대신, GAS·미리보기에서도 동작) */
  DT.confirm = (title, msg, okLabel) => new Promise((res) => {
    let done = false;
    const m = DT.modal({ title, body: '<p style="margin:0;font-size:17px;line-height:1.7">' + DT.esc(msg) + '</p>', onClose: () => { if (!done) res(false); },
      actions: [{ label: '취소', onClick: (c) => { done = true; res(false); c(); } }, { label: okLabel || '확인', kind: 'ink', onClick: (c) => { done = true; res(true); c(); } }] });
    return m;
  });

  /* 내려받기 */
  DT.download = function (name, text, type) {
    const blob = new Blob([type && type.includes('csv') ? '﻿' + text : text], { type: type || 'text/plain;charset=utf-8' });
    const a = DT.el('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  DT.csv = (rows) => rows.map((r) => r.map((c) => { const s = String(c == null ? '' : c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');

  /* 전체 화면 */
  DT.fullscreen = function () {
    const d = document;
    if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    else { const e = d.documentElement; (e.requestFullscreen || e.webkitRequestFullscreen || function () {}).call(e); }
  };

  /* ── 연결된 수업 활동 (config.extras) ─────────────────
     { id, title, desc, student: 우리 반 학생용 주소(기록·실시간), visitor: 누구나 체험 주소, live: [{label, url}], missions: [[m, 이름]] }
     주소 끝에 &m=미션 · &num=학번 · &name=이름 을 붙인다. visitor 가 상대 주소면 이 앱 기준. */
  DT.extras = {
    list() { return (DT.config && DT.config.extras) || []; },
    get(id) { return DT.extras.list().find((x) => x.id === id) || null; },
    url(base, q) {
      if (!base) return '';
      const u = new URL(base, location.href);
      Object.keys(q || {}).forEach((k) => { if (q[k] != null && q[k] !== '') u.searchParams.set(k, q[k]); });
      return u.href;
    }
  };

  /* ── 화면 테마 (밝은 계열 6가지) ─────────────────────────
     이 기기에서 고른 것이 먼저, 없으면 config.theme, 없으면 '종이'. 칠판·학생·선생님 화면이 같은 저장값을 쓴다. */
  DT.theme = {
    list: [
      ['paper', '종이', '#FFFCF6', '#E0336A', '#1B6A87'], ['sky', '하늘', '#F7FBFF', '#1F6FD1', '#C2410C'], ['mint', '민트', '#F6FCF8', '#12855A', '#6347B5'],
      ['lemon', '레몬', '#FFFDF3', '#C2410C', '#1D5F8A'], ['lavender', '라벤더', '#FBFAFF', '#6D4AD6', '#0F7B6C'], ['peach', '복숭아', '#FFFAF7', '#D9480F', '#2B6CB0'],
      ['white', '또렷한 흰색', '#FFFFFF', '#D11F5A', '#155E8C']
    ],
    get() { return DT.store.get('theme', (DT.config && DT.config.theme) || 'paper'); },
    apply(t) { const v = t || DT.theme.get(); if (v && v !== 'paper') document.documentElement.dataset.theme = v; else delete document.documentElement.dataset.theme; DT.emit('theme', v); },
    set(t) { DT.store.set('theme', t); DT.theme.apply(t); },
    picker() {
      const w = DT.el('div', { class: 'themes', role: 'group', 'aria-label': '화면 테마' });
      const paint = () => DT.$$('.theme-sw', w).forEach((b) => b.setAttribute('aria-pressed', b.dataset.t === DT.theme.get() ? 'true' : 'false'));
      DT.theme.list.forEach(([id, name, bg, a1, a2]) => {
        const chip = DT.el('span', { class: 'theme-sw__chip', style: { background: bg } }, DT.el('i', { style: { background: a1 } }), DT.el('i', { style: { background: a2 } }));
        const b = DT.el('button', { class: 'theme-sw', type: 'button', 'data-t': id }, chip, DT.el('span', null, name));
        b.onclick = () => { DT.theme.set(id); paint(); }; w.append(b);
      });
      paint(); return w;
    },
    open() { DT.modal({ title: '화면 테마', wide: true, body: DT.el('div', { style: { display: 'grid', gap: '10px' } }, DT.el('p', { class: 'muted', style: { margin: 0 } }, '누르면 바로 바뀌어요. 이 기기에만 저장돼요.'), DT.theme.picker()), actions: [{ label: '닫기', kind: 'ink' }] }); }
  };
  DT.theme.apply();

  /* 과목 색 적용 */
  DT.applySubject = (subject) => { document.documentElement.dataset.subject = subject || '수학'; };
})();

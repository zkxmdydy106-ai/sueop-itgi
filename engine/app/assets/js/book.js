/* 디지털교과서 엔진 · book.js — 교과서 원본 보기
   PDF 쪽을 그대로 찍은 그림을 책처럼 두 쪽 펼침으로(세로 화면은 한 쪽) 보여 준다. 스크롤 없음.
   - 넘기기(단추·화살표 키·밀기, 종이 넘김), 확대·축소(휠·두 손가락·두 번 누르기), 끌어서 이동, 확대 시 고화질 교체
   - 원본 위 판서 · 그림 자리의 「3D로 보기」(textbook.hotspots) · 핵심어 눌러 뜻 보기(textbook.terms + glossary)
   - 다른 쪽에 다녀온 뒤 「← n쪽으로 돌아가기」 · 교과서 속 검색(textbook.lines) · 선생님 메모 스티커(opt.notes)
   - 영어 교과서일 때만 읽어 주기
   textbook.terms[쪽] / lines[쪽] = [[x, y, w, h, '글자'], ...]  (0~1 비율 좌표, tools/ingest가 만든다) */
(function () {
  'use strict';
  const DT = window.DT;
  const B = (DT.book = {});
  const PW = 1000; /* 한 쪽의 논리 너비 */
  const NOTE_COLORS = ['#FFE58A', '#FFC9D6', '#C8EBD9', '#CFE2FF'];

  B.open = async function (opt) {
    opt = opt || {};
    const tb = window.TEXTBOOK; const pg = tb.pages || {};
    const first = pg.from, last = pg.to;
    if (first == null) { DT.toast('이 교과서에는 원본 쪽 이미지가 아직 없어요.', 'bad'); return; }
    const ratio = pg.ratio || 1.414;
    const PH = Math.round(PW * ratio);
    const evenLeft = pg.pairing !== 'odd-left';
    const inkGet = opt.inkGet || (() => null), inkSave = opt.inkSave || (() => {});
    const inkSync = opt.inkSync || null;   /* 다른 기기에서 쓴 필기 불러오기 (학생 개인 필기) */
    const notes = opt.notes || null;            /* 선생님만: { get(n) → [], save(n, list) } */
    const english = (tb.meta && tb.meta.subject) === '영어';

    const root = DT.el('div', { class: 'book', role: 'dialog', 'aria-modal': 'true', 'aria-label': '교과서 원본' });
    const bar = DT.el('div', { class: 'book__bar' });
    const title = DT.el('div', { class: 'book__title' }, DT.el('b', null, '교과서 원본'), DT.el('span', { class: 'book__pno num' }));
    const backBtn = DT.el('button', { class: 'book__back', type: 'button', hidden: true });
    const search = DT.el('form', { class: 'book__search', role: 'search' }, DT.el('span', { html: DT.icon('search') }), DT.el('input', { type: 'search', placeholder: '교과서에서 찾기', 'aria-label': '교과서에서 찾기' }));
    const results = DT.el('div', { class: 'book__results', hidden: true, role: 'listbox' });
    const zoomOut = DT.el('button', { class: 'book__btn', type: 'button', 'aria-label': '축소', html: DT.icon('minus') });
    const zoomTxt = DT.el('button', { class: 'book__zoom num', type: 'button', title: '화면에 맞추기 (0)' }, '100%');
    const zoomIn = DT.el('button', { class: 'book__btn', type: 'button', 'aria-label': '확대', html: DT.icon('plus') });
    const noteBtn = notes ? DT.el('button', { class: 'book__tool', type: 'button', 'aria-pressed': 'false', title: '메모 붙이기 — 누른 뒤 쪽의 원하는 곳을 누르세요', html: DT.icon('note') + '<span>메모</span>' }) : null;
    const readBtn = english ? DT.el('button', { class: 'book__tool', type: 'button', 'aria-pressed': 'false', title: '이 쪽 읽어 주기', html: DT.icon('play') + '<span>읽어 주기</span>' }) : null;
    const jump = DT.el('form', { class: 'book__jump' }, DT.el('input', { class: 'num', type: 'number', inputmode: 'numeric', min: first, max: last, 'aria-label': '쪽 번호로 가기', placeholder: '쪽' }), DT.el('button', { class: 'book__btn', type: 'submit', 'aria-label': '이동', html: DT.icon('right') }));
    const close = DT.el('button', { class: 'book__close', type: 'button', html: DT.icon('x') + '<span>닫기</span>' });
    bar.append(...[title, backBtn, search, noteBtn, readBtn, DT.el('div', { class: 'book__zoomset' }, zoomOut, zoomTxt, zoomIn), jump, close].filter(Boolean));
    const view = DT.el('div', { class: 'book__view' });
    const spread = DT.el('div', { class: 'book__spread' });
    const left = DT.el('div', { class: 'book__page book__page--l' }), right = DT.el('div', { class: 'book__page book__page--r' });
    const inkHost = DT.el('div', { class: 'book__ink' });
    spread.append(left, right, inkHost);
    view.append(spread);
    const prev = DT.el('button', { class: 'book__turn book__turn--prev', type: 'button', 'aria-label': '앞 쪽', html: DT.icon('left') });
    const next = DT.el('button', { class: 'book__turn book__turn--next', type: 'button', 'aria-label': '다음 쪽', html: DT.icon('right') });
    const inkDock = DT.el('div', { class: 'book__inkdock' });
    /* 복제 방지(저작권법 제25조 ⑫): 쪽 그림 길게 눌러 저장·오른쪽 클릭 저장·끌어 놓기 막기 */
    view.addEventListener('contextmenu', (e) => e.preventDefault());
    root.append(bar, results, view, prev, next, inkDock, DT.el('div', { class: 'book__credit' }, DT.credit(tb)));
    document.body.append(root);
    DT.ink.toolbar(inkDock, {});

    let single = false, startN = null, zoom = 1, tx = 0, ty = 0, base = 1, surface = null, busy = false;
    let noteMode = false, hlQuery = '', reading = null;
    const backStack = [];
    const pairStart = (n) => single ? n : (evenLeft ? (n % 2 === 0 ? n : n - 1) : (n % 2 === 1 ? n : n - 1));
    const pct = (v) => (v * 100) + '%';
    const boxStyle = (b) => ({ left: pct(b[0]), top: pct(b[1]), width: pct(b[2]), height: pct(b[3]) });

    async function fillPage(el, n, plain) {
      el.innerHTML = '';
      el.dataset.n = n;
      if (n < first || n > last) { el.classList.add('is-blank'); return; }
      el.classList.remove('is-blank');
      const img = DT.el('img', { alt: '교과서 ' + n + '쪽', draggable: 'false', 'data-n': n });
      const src = await DT.data.pageSrc(n);
      if (src) img.src = src; else el.classList.add('is-blank');
      if (needHi()) upgrade(img);
      el.append(img, DT.el('span', { class: 'book__num num' }, n + '쪽'));
      if (plain) return;
      /* 검색 형광 */
      if (hlQuery) ((tb.lines || {})[n] || []).forEach((ln) => { if (DT.norm(ln[4]).includes(hlQuery)) el.append(DT.el('i', { class: 'book__hl', style: boxStyle(ln) })); });
      /* 핵심어 자리 (누르면 뜻) */
      ((tb.terms || {})[n] || []).forEach((t) => {
        const b = DT.el('button', { class: 'book__term', type: 'button', title: t[4] + ' 뜻 보기', 'aria-label': t[4] + ' 뜻 보기', style: boxStyle(t) });
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => { e.stopPropagation(); DT.gloss.pop(b, t[4], { here: n, onPage: (p) => goTo(p, true), onScreen: opt.onScreen ? (id) => { done(); opt.onScreen(id); } : null }); });
        el.append(b);
      });
      /* 3D로 보기 */
      ((tb.hotspots || {})[n] || []).forEach((h) => {
        const b = DT.el('button', { class: 'book__hot', type: 'button', title: h.label || '3D로 보기', style: { left: pct(h.x), top: pct(h.y), width: pct(h.w || 0), height: pct(h.h || 0) } },
          DT.el('span', { class: 'book__hotbtn', html: DT.icon(h.icon || 'cube') + '<b>' + DT.esc(h.label || '3D로 보기') + '</b>' }));
        b.addEventListener('pointerdown', (e) => e.stopPropagation());
        b.addEventListener('click', (e) => { e.stopPropagation(); if (h.lab && DT.lab) DT.lab.open(h.lab, h.props || {}, { title: h.title, fig: h.fig, theme: h.theme }); else if (h.screen && opt.onScreen) { done(); opt.onScreen(h.screen); } });
        el.append(b);
      });
      /* 선생님 메모 */
      if (notes) { (notes.get(n) || []).forEach((nt) => el.append(noteEl(n, nt))); if (notes.refresh) notes.refresh(n).then((ch) => { if (ch && +el.dataset.n === n) { DT.$$('.book__note', el).forEach((x) => x.remove()); (notes.get(n) || []).forEach((nt) => el.append(noteEl(n, nt))); } }); }
    }

    /* ── 메모 스티커 ── */
    function noteEl(n, nt) {
      const d = DT.el('div', { class: 'book__note', style: { left: pct(nt.x), top: pct(nt.y), background: nt.color || NOTE_COLORS[0] } });
      const head = DT.el('div', { class: 'book__notehead' });
      const colors = DT.el('span', { class: 'book__notecolors' });
      NOTE_COLORS.forEach((c) => colors.append(DT.el('button', { type: 'button', 'aria-label': '메모 색', style: { background: c }, onclick: () => { nt.color = c; d.style.background = c; persist(n); } })));
      const del = DT.el('button', { type: 'button', 'aria-label': '메모 지우기', html: DT.icon('x'), onclick: () => { const list = notes.get(n).filter((x) => x.id !== nt.id); notes.save(n, list); d.remove(); } });
      head.append(colors, del);
      const ta = DT.el('textarea', { 'aria-label': '메모', placeholder: '수업 메모' }); ta.value = nt.text || '';
      ta.addEventListener('input', DT.debounce(() => { nt.text = ta.value; persist(n); }, 300));
      ['pointerdown', 'wheel'].forEach((ev) => d.addEventListener(ev, (e) => e.stopPropagation()));
      head.addEventListener('pointerdown', (e) => {
        if (e.target.closest('button')) return;
        const pageEl = d.parentElement; const r = pageEl.getBoundingClientRect(); const sx = e.clientX, sy = e.clientY, x0 = nt.x, y0 = nt.y;
        head.setPointerCapture(e.pointerId);
        const mv = (ev) => { nt.x = DT.clamp(x0 + (ev.clientX - sx) / r.width, 0, 0.85); nt.y = DT.clamp(y0 + (ev.clientY - sy) / r.height, 0, 0.92); d.style.left = pct(nt.x); d.style.top = pct(nt.y); };
        const upf = () => { head.removeEventListener('pointermove', mv); head.removeEventListener('pointerup', upf); persist(n); };
        head.addEventListener('pointermove', mv); head.addEventListener('pointerup', upf);
      });
      d.append(head, ta);
      d._nt = nt;
      return d;
    }
    function persist(n) { const pageEl = [left, right].find((p) => +p.dataset.n === n); if (!pageEl) return; notes.save(n, DT.$$('.book__note', pageEl).map((x) => x._nt)); }
    function addNoteAt(e) {
      const pageEl = e.target.closest('.book__page'); if (!pageEl || pageEl.classList.contains('is-blank')) return false;
      const n = +pageEl.dataset.n; const r = pageEl.getBoundingClientRect();
      const nt = { id: DT.uid('n'), x: DT.clamp((e.clientX - r.left) / r.width, 0, 0.85), y: DT.clamp((e.clientY - r.top) / r.height, 0, 0.92), text: '', color: NOTE_COLORS[0] };
      const list = (notes.get(n) || []).concat([nt]); notes.save(n, list);
      const el = noteEl(n, nt); pageEl.append(el); setTimeout(() => el.querySelector('textarea').focus(), 30);
      setNoteMode(false);
      return true;
    }
    function setNoteMode(v) { noteMode = v; if (noteBtn) noteBtn.setAttribute('aria-pressed', v ? 'true' : 'false'); root.classList.toggle('is-noting', v); if (v) DT.ink.set({ tool: 'hand' }); }
    if (noteBtn) noteBtn.onclick = () => setNoteMode(!noteMode);

    /* ── 화면 맞추기·확대 ── */
    function layout() {
      single = view.clientWidth / view.clientHeight < 1.15;
      root.classList.toggle('is-single', single);
      const lw = single ? PW : PW * 2;
      spread.style.width = lw + 'px'; spread.style.height = PH + 'px';
      base = Math.min((view.clientWidth - 48) / lw, (view.clientHeight - 32) / PH);
      apply();
    }
    function clampPan() {
      const lw = (single ? PW : PW * 2) * base * zoom, lh = PH * base * zoom;
      const mx = Math.max(0, (lw - view.clientWidth) / 2 + 24), my = Math.max(0, (lh - view.clientHeight) / 2 + 24);
      tx = DT.clamp(tx, -mx, mx); ty = DT.clamp(ty, -my, my);
    }
    function apply() {
      clampPan();
      spread.style.transform = 'translate(-50%,-50%) translate(' + tx + 'px,' + ty + 'px) scale(' + (base * zoom) + ')';
      zoomTxt.textContent = Math.round(zoom * 100) + '%';
      root.classList.toggle('is-zoomed', zoom > 1.01);
    }
    /* 고화질로 바꿀 때: 화면에 보이는 실제 픽셀이 보통 쪽 그림(가로 약 1700px)보다 크면 — 4K 전자칠판·아이패드는 처음부터 */
    const needHi = () => (window.devicePixelRatio || 1) * base * zoom * PW > 1500;
    async function upgrade(img) {
      if (img.dataset.hi) return; img.dataset.hi = '1';
      const hi = await DT.data.pageSrc(+img.dataset.n, 'hi');
      if (hi) { const pre = new Image(); pre.onload = () => { img.src = hi; }; pre.src = hi; }
    }
    function setZoom(z, cx, cy) {
      const old = zoom; zoom = DT.clamp(z, 1, 5);
      if (cx != null) { const r = view.getBoundingClientRect(); const ox = cx - r.left - r.width / 2 - tx, oy = cy - r.top - r.height / 2 - ty; tx -= ox * (zoom / old - 1); ty -= oy * (zoom / old - 1); }
      if (zoom === 1) { tx = 0; ty = 0; }
      apply();
      if (needHi()) DT.$$('img[data-n]', spread).forEach(upgrade);
    }

    /* ── 쪽 보여 주기 ── */
    async function show(n, dir) {
      const s = pairStart(n);
      if (s === startN) return;
      stopReading();
      const prevStart = startN; startN = s;
      const keyNow = 'book:' + s;
      if (surface) { surface.destroy(); surface = null; }
      const lN = s, rN = s + 1;
      DT.$('.book__pno', root).textContent = single ? lN + '쪽' : lN + '–' + rN + '쪽';
      DT.$('input', jump).value = '';
      prev.disabled = s - 1 < first;
      next.disabled = s + (single ? 1 : 2) > last;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prevStart != null && dir && !single && !reduce) {
        busy = true;
        const leaf = DT.el('div', { class: 'book__leaf book__leaf--' + (dir > 0 ? 'next' : 'prev') });
        const front = DT.el('div', { class: 'book__face' }), back = DT.el('div', { class: 'book__face book__face--back' });
        if (dir > 0) { await fillPage(front, prevStart + 1, true); await fillPage(back, lN, true); await fillPage(right, rN); }
        else { await fillPage(front, prevStart, true); await fillPage(back, rN, true); await fillPage(left, lN); }
        leaf.append(front, back); spread.append(leaf);
        requestAnimationFrame(() => requestAnimationFrame(() => leaf.classList.add('is-turning')));
        await DT.sleep(560);
        if (dir > 0) await fillPage(left, lN); else await fillPage(right, rN);
        leaf.remove(); busy = false;
      } else {
        await fillPage(left, lN); if (!single) await fillPage(right, rN);
        if (prevStart != null) { spread.classList.remove('is-fade'); void spread.offsetWidth; spread.classList.add('is-fade'); }
      }
      right.hidden = single;
      surface = new DT.ink.Surface(inkHost, single ? PW : PW * 2, PH, { passTo: view, key: keyNow, load: () => inkGet(keyNow), save: (st) => inkSave(keyNow, st) });
      if (inkSync) { const sNow = surface, kNow = keyNow; inkSync(kNow).then((r) => { if (r && surface === sNow) sNow.set(r); }).catch(() => {}); }
    }
    async function repaint() { const k = startN; startN = null; await show(k); }
    const turn = (d) => { if (busy) return; const step = single ? 1 : 2; if (d < 0 ? startN - 1 < first : startN + step > last) return; setZoom(1); show(startN + d * step, d); };
    /* 다른 쪽에 다녀오기 → 돌아가기 단추 */
    function goTo(n, remember) {
      if (remember && startN != null) { backStack.push(startN); paintBack(); }
      setZoom(1); show(n, n > startN ? 1 : -1);
    }
    function paintBack() {
      const b = backStack[backStack.length - 1];
      backBtn.hidden = b == null;
      if (b != null) backBtn.innerHTML = DT.icon('left') + '<span>' + b + '쪽으로 돌아가기</span>';
    }
    backBtn.onclick = () => { const b = backStack.pop(); paintBack(); if (b != null) { setZoom(1); show(b, b > startN ? 1 : -1); } };

    /* ── 교과서 속 검색 ── */
    const sInput = DT.$('input', search);
    function runSearch() {
      const q = DT.norm(sInput.value); results.innerHTML = '';
      if (!q) { results.hidden = true; if (hlQuery) { hlQuery = ''; repaint(); } return; }
      const hits = [];
      Object.entries(tb.lines || {}).forEach(([p, lines]) => { const ln = lines.find((l) => DT.norm(l[4]).includes(q)); if (ln) hits.push([+p, ln[4], lines.filter((l) => DT.norm(l[4]).includes(q)).length]); });
      hits.sort((a, b) => a[0] - b[0]);
      results.hidden = false;
      if (!(tb.lines && Object.keys(tb.lines).length)) { results.append(DT.el('p', { class: 'book__rempty' }, '이 교과서는 아직 검색용 글자가 준비되지 않았어요. (Code: tools/ingest 실행)')); return; }
      if (!hits.length) { results.append(DT.el('p', { class: 'book__rempty' }, '"' + sInput.value + '"이(가) 나오는 쪽이 없어요.')); return; }
      results.append(DT.el('p', { class: 'book__rhead' }, hits.length + '쪽에서 찾았어요'));
      hits.slice(0, 8).forEach(([p, text, k]) => {
        const i = DT.norm(text).indexOf(q);
        const b = DT.el('button', { class: 'book__ritem', type: 'button', role: 'option' }, DT.el('b', { class: 'num' }, p + '쪽'), DT.el('span', null, text.slice(0, 60)), k > 1 ? DT.el('small', null, k + '곳') : null);
        b.onclick = () => { hlQuery = q; results.hidden = true; if (pairStart(p) === startN) repaint(); else goTo(p, true); };
        results.append(b); void i;
      });
    }
    search.onsubmit = (e) => { e.preventDefault(); runSearch(); };
    sInput.addEventListener('input', DT.debounce(runSearch, 250));

    /* ── 읽어 주기 (영어 교과서만) ── */
    function stopReading() { if (reading) { speechSynthesis.cancel(); reading = null; DT.$$('.book__readline', spread).forEach((x) => x.remove()); if (readBtn) { readBtn.setAttribute('aria-pressed', 'false'); readBtn.innerHTML = DT.icon('play') + '<span>읽어 주기</span>'; } } }
    if (readBtn) readBtn.onclick = () => {
      if (reading) return stopReading();
      if (!('speechSynthesis' in window)) return DT.toast('이 기기에서는 읽어 주기를 쓸 수 없어요.', 'bad');
      const pages = single ? [startN] : [startN, startN + 1];
      const queue = []; pages.forEach((p) => ((tb.lines || {})[p] || []).forEach((l) => { if (/[A-Za-z]{2,}/.test(l[4])) queue.push([p, l]); }));
      if (!queue.length) return DT.toast('이 쪽에는 읽을 영어 문장이 없어요.');
      reading = { i: 0 }; readBtn.setAttribute('aria-pressed', 'true'); readBtn.innerHTML = DT.icon('pause') + '<span>멈추기</span>';
      const voice = speechSynthesis.getVoices().find((v) => /en[-_](US|GB)/i.test(v.lang));
      const rate = DT.store.get('book.rate', 0.9);
      const speakNext = () => {
        if (!reading || reading.i >= queue.length) return stopReading();
        const [p, l] = queue[reading.i++];
        DT.$$('.book__readline', spread).forEach((x) => x.remove());
        const pageEl = [left, right].find((x) => +x.dataset.n === p); if (pageEl) pageEl.append(DT.el('i', { class: 'book__readline', style: boxStyle(l) }));
        const u = new SpeechSynthesisUtterance(l[4]); u.lang = 'en-US'; if (voice) u.voice = voice; u.rate = rate; u.onend = speakNext; u.onerror = speakNext;
        speechSynthesis.speak(u);
      };
      speakNext();
    };

    /* ── 입력: 휠·두 손가락·끌기·밀기·두 번 누르기 ── */
    const pts = new Map(); let pinch0 = null, drag0 = null, swipe0 = null, lastTap = 0;
    view.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), e.clientX, e.clientY); }, { passive: false });
    view.addEventListener('pointerdown', (e) => {
      if (DT.ink.state.tool !== 'hand' && e.target.classList.contains('ink-layer')) return;
      if (noteMode && addNoteAt(e)) return;
      results.hidden = true;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); view.setPointerCapture(e.pointerId);
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), z: zoom, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 }; drag0 = null; swipe0 = null; }
      else { drag0 = { x: e.clientX, y: e.clientY, tx, ty }; swipe0 = { x: e.clientX, t: Date.now() };
        if (Date.now() - lastTap < 300) { setZoom(zoom > 1.01 ? 1 : 2.2, e.clientX, e.clientY); lastTap = 0; } else lastTap = Date.now(); }
    });
    view.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch0 && pts.size === 2) {   /* 두 손가락: 벌리면 확대, 같이 움직이면 쪽을 옮긴다 */
        const [a, b] = [...pts.values()]; const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        setZoom(pinch0.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch0.d, pinch0.cx, pinch0.cy);
        if (pinch0.lx == null) { pinch0.lx = mx; pinch0.ly = my; }
        if (zoom > 1.01) { tx += mx - pinch0.lx; ty += my - pinch0.ly; apply(); }
        pinch0.lx = mx; pinch0.ly = my;
      }
      else if (drag0 && zoom > 1.01) { tx = drag0.tx + e.clientX - drag0.x; ty = drag0.ty + e.clientY - drag0.y; apply(); }
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
      if (swipe0 && zoom <= 1.01 && pts.size === 0) { const dx = e.clientX - swipe0.x; if (Math.abs(dx) > 70 && Date.now() - swipe0.t < 600) turn(dx < 0 ? 1 : -1); }
      if (pts.size < 2) pinch0 = null; if (!pts.size) { drag0 = null; swipe0 = null; }
    };
    view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
    zoomIn.onclick = () => setZoom(zoom * 1.3); zoomOut.onclick = () => setZoom(zoom / 1.3); zoomTxt.onclick = () => setZoom(1);
    prev.onclick = () => turn(-1); next.onclick = () => turn(1);
    jump.onsubmit = (e) => { e.preventDefault(); const v = +DT.$('input', jump).value; if (v >= first && v <= last) goTo(v, true); else DT.toast(first + '쪽부터 ' + last + '쪽 사이로 적어 주세요.'); };
    function onKey(e) {
      if (e.target.closest('input,textarea')) { if (e.key === 'Escape') { e.target.blur(); results.hidden = true; } e.stopPropagation(); return; }
      if (DT.ink.keys(e)) { e.stopPropagation(); return; }
      if (e.key === 'Escape') { if (document.querySelector('.gpop')) DT.gloss.close(); else if (noteMode) setNoteMode(false); else if (DT.ink.state.tool !== 'hand') DT.ink.set({ tool: 'hand' }); else done(); }
      else if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); turn(1); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1); }
      else if (e.key === 'Backspace' && backStack.length) { e.preventDefault(); backBtn.click(); }
      else if (e.key === '+' || e.key === '=') setZoom(zoom * 1.3);
      else if (e.key === '-') setZoom(zoom / 1.3);
      else if (e.key === '0') setZoom(1);
      e.stopPropagation();
    }
    document.addEventListener('keydown', onKey, true);
    const ro = new ResizeObserver(() => { const keep = startN; layout(); if (keep != null) repaint(); });
    ro.observe(view);
    function done() { stopReading(); DT.gloss && DT.gloss.close(); ro.disconnect(); document.removeEventListener('keydown', onKey, true); if (surface) surface.destroy(); DT.ink.set({ tool: 'hand' }); root.remove(); if (opt.onClose) opt.onClose(); }
    close.onclick = done;
    layout();
    await show(DT.clamp(opt.start || first, first, last));
    close.focus();
    return { close: done, goTo };
  };
})();

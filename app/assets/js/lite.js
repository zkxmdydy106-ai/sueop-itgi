/* 수업잇기 엔진 · lite.js — 서버 없는 '수업 화면 한 장' (Chat에서 만든 HTML용)
   HTML 안의 window.LESSON = { title, unit, source, screens:[{ id, step, title, kind, blocks:[…] }] } 하나를 칠판 화면으로 연다.
   칠판과 같은 화면·판서·단계 열기·3D 모형·전체 화면·인쇄. 학생 로그인·학습지 제출·기록은 없다(전체 기능은 Claude Code).
   판서는 이 컴퓨터 브라우저에만 남는다. */
(function () {
  'use strict';
  const DT = window.DT;
  const $ = (s, r) => (r || document).querySelector(s);
  const me = document.currentScript && document.currentScript.src;
  if (!DT.config.assetBase && me) DT.config.assetBase = me.replace(/js\/lite\.js(\?.*)?$/, '');
  /* 서버 없음: 그림은 주소 그대로, 저장은 이 브라우저에만 */
  DT.data = DT.data || { mode: 'lite', asset: async (src) => src };
  if (!DT.data.asset) DT.data.asset = async (src) => src;

  const L = window.LESSON || { title: '수업', screens: [] };
  (L.screens || []).forEach((s, i) => { s.id = s.id || 's' + (i + 1); s.kind = s.kind || 'concept'; });
  const sub = { title: L.unit || L.title || '수업', screens: L.screens || [] };
  const tb = DT.render.flatten({ units: [sub] });
  const screens = tb._screens;
  const slug = String(L.title || 'lesson').replace(/\s+/g, '-').slice(0, 40);
  let idx = 0; let surf = null;

  function build() {
    document.body.classList.add('board-body', 'lite-body');
    document.title = (L.title || '수업') + ' · 수업잇기';
    const app = DT.el('div', { class: 'desk', id: 'desk' });
    app.innerHTML = '<div class="stage" id="stage">'
      + '<header class="topbar"><button class="topbar__toc" id="btnToc" type="button" title="목차 (T)"></button><div class="topbar__crumb" id="crumb"></div>'
      + '<div class="topbar__right"><button class="topbar__class" id="btnPrint" type="button" title="모든 화면 인쇄 (A4 가로)"></button><button class="topbar__icon" id="btnFull" type="button" title="전체 화면 (F)" aria-label="전체 화면"></button></div></header>'
      + '<main class="sheet" id="sheet" aria-live="polite"></main>'
      + '<footer class="rail"><div class="rail__ink" id="inkDock"></div><nav class="rail__chips" id="chips" aria-label="화면"></nav>'
      + '<div class="rail__nav"><span class="rail__count num" id="count"></span><button class="navbtn" id="btnPrev" type="button" aria-label="이전 (←)"></button><button class="navbtn navbtn--next" id="btnNext" type="button" aria-label="다음 (→)"></button></div></footer>'
      + '<div class="layer" id="layer"></div></div>';
    document.body.append(app, DT.el('div', { class: 'lite-print', id: 'litePrint', 'aria-hidden': 'true' }));
    $('#btnToc').innerHTML = DT.icon('toc') + '<span>목차</span>';
    $('#btnPrint').innerHTML = DT.icon('print') + '<span>인쇄</span>';
    $('#btnFull').innerHTML = DT.icon('expand');
    $('#btnPrev').innerHTML = DT.icon('left'); $('#btnNext').innerHTML = DT.icon('right');
    $('#btnPrev').onclick = () => step(-1); $('#btnNext').onclick = () => step(1);
    $('#btnToc').onclick = openToc; $('#btnFull').onclick = DT.fullscreen; $('#btnPrint').onclick = printAll;
    document.addEventListener('fullscreenchange', () => { $('#btnFull').innerHTML = DT.icon(document.fullscreenElement ? 'shrink' : 'expand'); });
    DT.ink.toolbar($('#inkDock'), {});
    fit(); addEventListener('resize', fit);
    document.addEventListener('keydown', onKey);
  }
  function fit() { const st = $('#stage'); const k = Math.min(innerWidth / 1920, innerHeight / 1080); st.style.transform = 'translate(-50%,-50%) scale(' + k + ')'; st.style.transformOrigin = 'center'; st.style.left = '50%'; st.style.top = '50%'; }

  function go(i, dir) {
    const s = screens[i]; if (!s) return;
    idx = i;
    if (surf) { surf.destroy(); surf = null; }
    const sheet = $('#sheet'); sheet.innerHTML = '';
    const page = DT.render.screen(s, { interactive: true, onQuestion: openFocus });
    page.style.setProperty('--base', '34px');
    if (dir) page.classList.add(dir > 0 ? 'is-enter' : 'is-enter-back');
    sheet.append(page); DT.render.fit(page);
    const key = 'lite.ink.' + slug + '.' + s.id;
    surf = new DT.ink.Surface(page, 1920 - 112 - 168, 1080 - 84 - 112 - 64, { key, load: () => DT.store.get(key, []), save: (st) => DT.store.set(key, st) });
    chrome(s);
    history.replaceState(null, '', '#s=' + encodeURIComponent(s.id));
  }
  function chrome(s) {
    $('#crumb').innerHTML = (L.unit ? DT.esc(DT.plain(L.unit)) + '<span class="sep">›</span>' : '') + '<b>' + DT.esc(DT.plain(L.title || '')) + '</b>';
    $('#count').textContent = (idx + 1) + ' / ' + screens.length;
    $('#btnPrev').disabled = idx === 0;
    $('#btnNext').disabled = idx === screens.length - 1 && !document.querySelector('#sheet [data-reveal].is-hidden, #sheet .b-q__step[hidden], #sheet .b-q__ans[hidden]');
    const chips = $('#chips');
    for (let MAX = screens.length; MAX >= 3; MAX--) {
      chips.innerHTML = '';
      let from = 0, to = screens.length;
      if (screens.length > MAX) { from = DT.clamp(idx - Math.floor(MAX / 2), 0, screens.length - MAX); to = from + MAX; }
      if (from > 0) chips.append(DT.el('span', { class: 'chipnav is-gap' }, '…'));
      screens.slice(from, to).forEach((x, k) => {
        const j = from + k; const isQ = x.kind === 'problem' || x.kind === 'activity';
        const b = DT.el('button', { class: 'chipnav' + (isQ ? ' is-q' : '') + (j < idx ? ' is-done' : '') + (j === idx ? ' is-now' : ''), type: 'button', title: DT.plain(x.title), 'aria-current': j === idx ? 'step' : null }, DT.plain(x.chip || x.title));
        b.onclick = () => go(j, j > idx ? 1 : -1);
        chips.append(b);
      });
      if (to < screens.length) chips.append(DT.el('span', { class: 'chipnav is-gap' }, '…'));
      if (chips.scrollWidth <= chips.clientWidth + 1) break;
    }
  }
  function step(d) {
    const page = $('#sheet .page');
    if (page) {
      if (d > 0 && (DT.render.revealNext(page) || DT.render.solNext(page))) { chrome(screens[idx]); return; }
      if (d < 0 && DT.render.revealPrev(page)) return;
    }
    const n = idx + d;
    if (n < 0 || n >= screens.length) { DT.toast(d > 0 ? '마지막 화면이에요.' : '첫 화면이에요.'); return; }
    go(n, d);
  }
  /* 문제 크게 풀기: 문제만 크게 + 판서 (닫으면 지워짐 — 화면 판서와 따로) */
  function openFocus(b) {
    if ($('.lite-focus')) return;
    const ov = DT.el('div', { class: 'lite-focus', role: 'dialog', 'aria-label': '크게 풀기' });
    const area = DT.el('div', { class: 'lite-focus__area' });
    const blk = DT.render.block(Object.assign({}, b, { r: null }), { interactive: false });
    area.append(blk);
    const close = DT.el('button', { class: 'lab__close', type: 'button', html: DT.icon('x') + '<span>닫기</span>' });
    const dock = DT.el('div', { class: 'lite-focus__ink' });
    ov.append(area, close, dock); $('#layer').append(ov);
    const fs = new DT.ink.Surface(area, 1920 - 160, 1080 - 200, { key: 'lite.focus' });
    const tb = DT.ink.toolbar(dock, {}); tb.open(true);
    const done = () => { fs.destroy(); tb.el.remove(); ov.remove(); DT.ink.set({ tool: 'hand' }); document.removeEventListener('keydown', esc, true); };
    const esc = (e) => { if (e.key === 'Escape' && DT.ink.state.tool === 'hand') { e.stopPropagation(); done(); } };
    close.onclick = done; document.addEventListener('keydown', esc, true);
  }
  function openToc() {
    const list = DT.el('div', { class: 'lite-toc' });
    screens.forEach((s, i) => list.append(DT.el('button', { class: 'lite-toc__i' + (i === idx ? ' is-now' : ''), type: 'button', onclick: () => { m.close(); go(i, i > idx ? 1 : -1); } },
      DT.el('span', { class: 'num' }, String(i + 1)), DT.el('b', { html: DT.md(s.title || '') }), s.step ? DT.el('small', null, DT.plain(s.step)) : '')));
    const m = DT.modal({ title: '목차', body: list });
  }
  function onKey(e) {
    if (document.querySelector('.scrim, .lab, .lite-focus')) return;
    if (DT.ink.keys(e)) return;
    if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
    const k = e.key;
    if (k === 'ArrowRight' || k === 'PageDown' || k === ' ') { e.preventDefault(); step(1); }
    else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); step(-1); }
    else if (k === 'Escape') DT.ink.set({ tool: 'hand' });
    else if (k.toLowerCase() === 'f') DT.fullscreen();
    else if (k.toLowerCase() === 't') openToc();
  }
  /* 인쇄: 화면마다 A4 가로 한 장 (단계·풀이 모두 펼침) */
  function printAll() {
    const box = $('#litePrint'); box.innerHTML = ''; box.classList.add('is-on');
    screens.forEach((s) => {
      const pp = DT.el('section', { class: 'lite-pp' }); const sh = DT.el('div', { class: 'sheet' });
      const page = DT.render.screen(s, { interactive: false, revealAll: true, solAll: true }); page.style.setProperty('--base', '34px');
      sh.append(page); pp.append(sh); box.append(pp); DT.render.fit(page);
    });
    if (L.source) box.append(DT.el('p', { class: 'lite-src' }, '출처: ' + L.source));
    setTimeout(() => { window.print(); box.classList.remove('is-on'); }, 300);
  }

  function start() {
    build();
    if (!screens.length) { $('#sheet').innerHTML = '<div class="empty"><b>화면이 없어요</b><p>HTML 안의 LESSON.screens에 화면을 넣어 주세요.</p></div>'; return; }
    const want = decodeURIComponent((location.hash.match(/s=([^&]+)/) || [])[1] || '');
    const i = Math.max(0, screens.findIndex((s) => s.id === want));
    go(i < 0 ? 0 : i);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

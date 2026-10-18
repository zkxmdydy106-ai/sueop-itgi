/* 수업잇기 엔진 · render.js
   교과서 내용(content.js의 screens/blocks)을 화면으로 그린다. 전자칠판·학생 다시 보기·인쇄가 함께 쓴다.
   스크롤 없음: 한 화면(screen)은 정해진 상자 안에 반드시 들어가야 하며, 넘치면 글자 크기를 줄이고(fit),
   그래도 넘치면 전체를 축소한 뒤 audit에 기록한다 → Code가 화면을 둘로 나눈다. */
(function () {
  'use strict';
  const DT = window.DT;
  const R = (DT.render = {});

  /* 교과서 구조 펼치기: units > children(중단원) > children(소단원) > screens */
  R.flatten = function (tb) {
    const subunits = []; const screens = [];
    (function walk(nodes, path) {
      (nodes || []).forEach((n) => {
        const p = path.concat([n]);
        if (n.screens) {
          n._path = p; subunits.push(n);
          n.screens.forEach((s, i) => { s._sub = n; s._idx = screens.length; s._local = i; screens.push(s); });
        }
        if (n.children) walk(n.children, p);
      });
    })(tb.units, []);
    tb._subunits = subunits; tb._screens = screens;
    tb._byId = {}; screens.forEach((s) => (tb._byId[s.id] = s));
    tb._blocks = {}; screens.forEach((s) => (s.blocks || []).forEach((b, i) => { b._screen = s; b.id = b.id || s.id + '.' + i; tb._blocks[b.id] = b; if (b.cols) b.cols.forEach((col, ci) => col.forEach((bb, bi) => { bb._screen = s; bb.id = bb.id || b.id + '.' + ci + '.' + bi; tb._blocks[bb.id] = bb; })); }));
    /* 문제 옆 단의 교과서 그림 → 그 문제의 그림(_figs). "오른쪽 그림" 문제가 여럿이면 '그림'이 나오는 문제에만 */
    screens.forEach((s) => (s.blocks || []).forEach((b) => {
      if (!b.cols) return;
      b.cols.forEach((col, ci) => {
        const qs = col.filter((x) => x.t === 'prob' || x.t === 'ex'); if (!qs.length) return;
        const figs = b.cols.filter((c, cj) => cj !== ci).flat().filter((x) => x.t === 'fig' && (x.src || x.svg));
        if (!figs.length) return;
        const want = qs.filter((x) => /그림/.test(x.q || '')); (want.length ? want : qs.length === 1 ? qs : []).forEach((x) => { x._figs = figs; });
      });
    }));
    return tb;
  };
  R.pagesLabel = (pages) => { if (!pages || !pages.length) return ''; const a = pages[0], b = pages[pages.length - 1]; return '교과서 ' + (a === b ? a : a + '~' + b) + '쪽'; };

  const md = (s) => DT.md(s);
  const blockLabel = (b, fallback) => b.label || fallback;

  /* ── 블록 하나 ─────────────────────────────────── */
  R.block = function (b, ctx) {
    ctx = ctx || {};
    let n;
    switch (b.t) {
      case 'p': n = DT.el('p', { class: 'b-p', html: md(b.x) }); break;
      case 'h': n = DT.el('h3', { class: 'b-h', html: md(b.x) }); break;
      case 'def':
        n = DT.el('div', { class: 'b-def' + (b.kind ? ' b-def--' + b.kind : '') },
          b.label === '' ? null : DT.el('span', { class: 'b-def__label', html: md(blockLabel(b, '정의')) }),   /* 이름표 없는 상자는 label: '' · 이름표에 수식 가능 */
          DT.el('div', { class: 'b-def__body', html: md(b.x) }));
        break;
      case 'note': n = DT.el('aside', { class: 'b-note' }, b.label ? DT.el('span', { class: 'b-note__label' }, b.label) : null, DT.el('div', { html: md(b.x) })); break;
      case 'list': {
        n = DT.el(b.ordered ? 'ol' : 'ul', { class: 'b-list' });
        (b.items || []).forEach((it) => n.append(DT.el('li', { html: md(it) })));
        break;
      }
      case 'table': {
        n = DT.el('table', { class: 'b-table' });
        if (b.head) n.append(DT.el('thead', null, DT.el('tr', null, b.head.map((h) => DT.el('th', { html: md(h) })))));
        n.append(DT.el('tbody', null, (b.rows || []).map((r) => DT.el('tr', null, r.map((c) => DT.el('td', { html: md(c) }))))));
        break;
      }
      case 'fig': {
        n = DT.el('figure', { class: 'b-fig' + (b.align ? ' b-fig--' + b.align : '') });
        if (b.w) n.style.setProperty('--w', b.w);
        if (b.svg) n.append(DT.el('div', { class: 'b-fig__svg', html: b.svg }));
        else if (b.src) {
          const img = DT.el('img', { alt: b.alt || b.cap || '교과서 그림', draggable: 'false' });
          DT.data.asset(b.src).then((u) => { img.src = u; });
          n.append(img);
        }
        if (b.cap) n.append(DT.el('figcaption', { html: md(b.cap) }));
        break;
      }
      case 'ex':
      case 'prob': {
        const isEx = b.t === 'ex';
        n = DT.el('article', { class: 'b-q ' + (isEx ? 'b-q--ex' : 'b-q--prob'), tabindex: ctx.interactive ? '0' : null, role: ctx.interactive ? 'button' : null, 'aria-label': (b.label || '') + ' 크게 열어 판서하기' });
        const head = DT.el('div', { class: 'b-q__head' }, DT.el('span', { class: 'b-q__label' }, blockLabel(b, isEx ? '예제' : '문제')));
        if (b.page) head.append(DT.el('span', { class: 'b-q__page' }, b.page + '쪽'));
        if (ctx.interactive) head.append(DT.el('span', { class: 'b-q__open', html: DT.icon('pen') + '<span>크게 풀기</span>' }));
        n.append(head, DT.el('div', { class: 'b-q__body', html: md(b.q) }));
        if (b.sub && b.sub.length) n.append(DT.el('ol', { class: 'b-q__sub' }, b.sub.map((s) => DT.el('li', { html: md(s) }))));
        if (isEx && b.sol && ctx.showSolution !== false) {
          const sol = DT.el('div', { class: 'b-q__sol', 'data-sol': '' });
          b.sol.forEach((st, i) => sol.append(DT.el('div', { class: 'b-q__step', 'data-step': i, hidden: ctx.solAll ? null : true, html: md(st) })));
          if (b.ans) sol.append(DT.el('div', { class: 'b-q__ans', hidden: ctx.solAll ? null : true, html: '<b>답</b> ' + md(b.ans) }));
          n.append(sol);
        }
        if (ctx.interactive && ctx.onQuestion) {
          n.addEventListener('click', (e) => { if (e.target.closest('a,button')) return; ctx.onQuestion(b); });
          n.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.onQuestion(b); } });
        }
        break;
      }
      case 'act':
      case 'read': {
        n = DT.el('section', { class: 'b-act' + (b.group ? ' b-act--group' : '') + (b.t === 'read' ? ' b-act--read' : '') });
        const head = DT.el('div', { class: 'b-act__head' }, DT.el('span', { class: 'b-act__label' }, blockLabel(b, b.t === 'read' ? '읽기 자료' : '탐구')));
        if (b.title) head.append(DT.el('span', { class: 'b-act__title', html: md(b.title) }));
        if (b.group) head.append(DT.el('span', { class: 'b-act__tag', html: DT.icon('users') + '모둠' }));
        n.append(head);
        if (b.x) n.append(DT.el('div', { class: 'b-act__body', html: md(b.x) }));
        if (b.items) n.append(DT.el('ol', { class: 'b-act__items' }, b.items.map((s) => DT.el('li', { html: md(s) }))));
        break;
      }
      case 'lab': {
        n = DT.el('button', { class: 'b-lab', type: 'button', 'data-lab': b.lab },
          DT.el('span', { class: 'b-lab__icon', html: DT.icon(b.icon || 'cube') }),
          DT.el('span', { class: 'b-lab__text' }, DT.el('b', null, b.label || '3D로 돌려 보기'), b.desc ? DT.el('span', { html: md(b.desc) }) : null));
        n.addEventListener('click', () => { if (DT.lab) DT.lab.open(b.lab, b.props || {}, { title: b.title || b.label, fig: b.fig, theme: b.theme }); });
        break;
      }
      case 'extra': {   /* 연결된 수업 활동(예: 드론 미션) — config.extras 의 id, m = 미션 */
        /* 그 화면에 맞는 미션 QR을 바로 보여 준다 (학생·참관 선생님 같은 QR — 참관은 활동 안에서 「선생님 참관용」 체크) */
        const ex = DT.extras.get(b.id);
        if (!ex) { n = DT.el('div'); break; }
        const url = DT.extras.url(ex.student || ex.visitor, { m: b.m || null });
        n = DT.el('div', { class: 'b-extra' });
        if (DT.chart && DT.chart.qr) n.append(DT.el('div', { class: 'b-extra__qr' }, DT.chart.qr(url, 210)));
        const btn = (icon, label, fn, ink) => DT.el('button', { class: 'obtn' + (ink ? ' obtn--ink' : ''), type: 'button', html: DT.icon(icon) + DT.esc(label), onclick: fn });
        n.append(DT.el('div', { class: 'b-extra__text' },
          DT.el('b', null, (ex.title || '활동') + ' — 카메라로 찍기'),
          DT.el('span', null, '학생은 학번·이름, 참관 선생님은 「선생님 참관용」에 체크하고 시작해요.'),
          DT.el('div', { class: 'b-extra__btns' },
            btn('play', '칠판에서 해 보기', () => DT.emit('extra-play', { url, title: ex.title }), true),
            ...(DT.chart ? ex.live || [] : []).filter((l) => !/모음/.test(l.label)).map((l) => btn('signal', l.label, () => window.open(l.url, '_blank'))))));
        break;
      }
      case 'cols': {
        n = DT.el('div', { class: 'b-cols' });
        const ratio = b.ratio || b.cols.map(() => 1);
        n.style.gridTemplateColumns = ratio.map((r) => r + 'fr').join(' ');
        b.cols.forEach((col) => { const c = DT.el('div', { class: 'b-col' }); col.forEach((bb) => c.append(R.block(bb, ctx))); n.append(c); });
        break;
      }
      case 'html': n = DT.el('div', { class: 'b-html', html: b.html }); break;
      default: n = DT.el('div', { class: 'b-p', html: md(b.x || '') });
    }
    n.dataset.block = b.id || '';
    if (b.r) { n.dataset.reveal = b.r; if (!ctx.revealAll) n.classList.add('is-hidden'); }
    return n;
  };

  /* ── 화면 하나 ───────────────────────────────────
     ctx: { interactive, onQuestion(b), revealAll } */
  R.screen = function (s, ctx) {
    ctx = ctx || {};
    const page = DT.el('div', { class: 'page page--' + (s.kind || 'concept'), 'data-screen': s.id });
    const head = DT.el('header', { class: 'page__head' });
    const meta = DT.el('div', { class: 'page__meta' });
    if (s.step) meta.append(DT.el('span', { class: 'pill' }, s.step));
    if (s.pages && s.pages.length) meta.append(DT.el('span', { class: 'page__pages' }, R.pagesLabel(s.pages)));
    head.append(meta, DT.el('h2', { class: 'page__title', html: md(s.title || '') }));
    if (s.lead) head.append(DT.el('p', { class: 'page__lead', html: md(s.lead) }));
    const body = DT.el('div', { class: 'page__body' });
    const fit = DT.el('div', { class: 'page__fit' });
    (s.blocks || []).forEach((b) => fit.append(R.block(b, ctx)));
    body.append(fit);
    page.append(head, body);
    return page;
  };

  /* ── 넘치지 않게 맞추기 ──────────────────────────────
     반환: { scale, fs } scale<1 이면 글자를 최소로 줄이고도 넘쳐 전체를 축소한 것 */
  R.fit = function (page, opt) {
    opt = opt || {};
    const body = page.querySelector('.page__body'); const fit = page.querySelector('.page__fit');
    if (!body || !fit) return { scale: 1 };
    const max = opt.max || 1, min = opt.min || 0.74;
    let f = max;
    fit.style.transform = ''; fit.style.width = '';
    page.style.setProperty('--fs', f);
    const over = () => fit.scrollHeight > body.clientHeight + 1 || fit.scrollWidth > body.clientWidth + 2;
    let guard = 0;
    while (over() && f > min && guard++ < 40) { f = Math.round((f - 0.02) * 100) / 100; page.style.setProperty('--fs', f); }
    let scale = 1;
    if (over()) {
      scale = Math.min(body.clientHeight / fit.scrollHeight, body.clientWidth / fit.scrollWidth);
      fit.style.transformOrigin = 'top left';
      fit.style.width = (100 / scale) + '%';
      fit.style.transform = 'scale(' + scale + ')';
    }
    page.dataset.fit = f; page.dataset.scale = scale.toFixed(3);
    /* 그림은 나중에 불러와진다(asset 약속) — 다 뜨면 다시 맞춘다. 안 그러면 그림 높이를 모른 채 맞춰 아래가 잘린다 */
    DT.$$('img', page).forEach((img) => {
      if (img.complete && img.naturalWidth) return;
      img.addEventListener('load', () => { clearTimeout(page._refit); page._refit = setTimeout(() => { if (page.isConnected) R.fit(page, opt); }, 30); }, { once: true });
    });
    return { scale, fs: f };
  };

  /* 단계 열기: 숨은 블록이 있으면 하나 연다 → true, 없으면 false */
  R.revealNext = function (page) {
    const hidden = DT.$$('[data-reveal].is-hidden', page).sort((a, b) => a.dataset.reveal - b.dataset.reveal);
    if (!hidden.length) return false;
    const r = hidden[0].dataset.reveal;
    hidden.filter((h) => h.dataset.reveal === r).forEach((h) => h.classList.remove('is-hidden'));
    return true;
  };
  R.revealPrev = function (page) {
    const shown = DT.$$('[data-reveal]:not(.is-hidden)', page).sort((a, b) => b.dataset.reveal - a.dataset.reveal);
    if (!shown.length) return false;
    const r = shown[0].dataset.reveal;
    shown.filter((h) => h.dataset.reveal === r).forEach((h) => h.classList.add('is-hidden'));
    return true;
  };
  /* 예제 풀이 한 단계씩 */
  R.solNext = function (root) {
    const step = DT.$$('.b-q__step[hidden], .b-q__ans[hidden]', root)[0];
    if (!step) return false; step.hidden = false; return true;
  };
})();

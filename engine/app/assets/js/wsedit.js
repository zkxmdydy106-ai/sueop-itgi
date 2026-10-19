/* 수업잇기 엔진 · wsedit.js — 선생님이 학습지를 직접 만들기·고치기 + 종이 학습지 인쇄
   - 교과서 범위에서 빈칸·문제를 골라 넣기(끌어다 놓기 또는 「넣기」), 순서는 손잡이를 끌어서
   - 개념 빈칸: 문장의 단어를 누르면 빈칸 ↔ 글자 (조사는 빈칸 밖에 남긴다)
   - 내 문제 쓰기: 단답·객관식·O/X·서술형
   - 인쇄: 학생용(빈칸·답 칸) / 선생님용(정답 포함) — 학생 화면이 아니라 선생님 화면에서만 */
(function () {
  'use strict';
  const DT = window.DT; const W = DT.ws;
  const JOSA = /(으로|에서|에게|라고|이라고|이다|이며|이고|와|과|은|는|이|가|을|를|의|에|로|도|만|란|이란)$/;
  const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* 고른 범위에서 넣을 수 있는 모든 거리 */
  W.pool = function (tb, scope) {
    const out = [];
    const add = (it) => { if (!out.find((x) => x.id === it.id)) out.push(it); };
    ['concept', 'practice', 'group', 'self', 'career'].forEach((k) => W.build(tb, scope, k).items.forEach(add));
    W.variants(tb, scope).forEach(add);          /* 변형 문제 전부 (개념별) */
    W.sentences(tb, scope).forEach(add);         /* 문장 — 원하는 곳에 빈칸 */
    W._terms = W.allTerms(tb);
    return out;
  };
  /* 보내기·인쇄 전에: 빈칸을 하나도 안 고른 문장이 있으면 알려 준다 */
  W.check = (w) => { const b = w.items.filter((it) => it.type === 'blank' && !(it.answers || []).length); return b.length ? '빈칸을 고르지 않은 문장이 ' + b.length + '개 있어요. 「빈칸 고르기」로 단어를 눌러 주세요.' : ''; };

  /* 빈칸 문항: x 안의 [[ ]] 가 빈칸. 답·보기 단어를 다시 맞춘다 */
  function reblank(it) {
    const ans = DT.terms(it.x);
    let extra = (it.bank || []).filter((w) => !(it.answers || []).includes(w) && !ans.includes(w)).slice(0, 3);
    if (extra.length < 3 && W._terms) extra = extra.concat(DT.shuffle(W._terms.filter((w) => !ans.includes(w) && !extra.includes(w)), ans.length * 7 + 3).slice(0, 3 - extra.length));   /* 헷갈리는 보기 단어 */
    it.answers = ans; it.bank = DT.shuffle(ans.concat(extra), (it.id || '').length * 13 + ans.length);
    return it;
  }
  W.reblank = reblank;

  /* 문장 → 조각(빈칸·수식·단어) */
  function tokens(x) {
    const out = []; const re = /(\[\[[^\]]+?\]\]|\$[^$]+\$|\s+)/g; let last = 0, m;
    while ((m = re.exec(x))) { if (m.index > last) out.push({ t: 'w', s: x.slice(last, m.index) }); const s = m[0]; out.push(s.startsWith('[[') ? { t: 'b', s: s.slice(2, -2) } : s.startsWith('$') ? { t: 'm', s } : { t: 's', s }); last = re.lastIndex; }
    if (last < x.length) out.push({ t: 'w', s: x.slice(last) });
    return out;
  }
  const join = (tk) => tk.map((k) => (k.t === 'b' ? '[[' + k.s + ']]' : k.s)).join('');

  /* 빈칸 고르기 (문장의 단어를 누름) */
  function blankPicker(it, onChange) {
    const box = DT.el('div', { class: 'wse-blank' });
    function paint() {
      box.innerHTML = '';
      const tk = tokens(it.x || '');
      tk.forEach((k, i) => {
        if (k.t === 's') return box.append(document.createTextNode(' '));
        if (k.t === 'm') { const sp = DT.el('span', { class: 'wse-math', html: DT.md(k.s) }); return box.append(sp); }
        const b = DT.el('button', { type: 'button', class: 'wse-word' + (k.t === 'b' ? ' is-blank' : ''), title: k.t === 'b' ? '누르면 글자로' : '누르면 빈칸으로' }, k.s.replace(/\*\*/g, ''));
        b.onclick = () => {
          if (k.t === 'b') { k.t = 'w'; }
          else {
            const word = k.s.replace(/[.,!?·)(“”"']+$/g, ''); const tail = k.s.slice(word.length);
            const jm = word.length > 2 ? word.match(JOSA) : null; const stem = jm ? word.slice(0, -jm[0].length) : word;
            tk.splice(i, 1, { t: 'b', s: stem.replace(/\*\*/g, '') }, { t: 'w', s: (jm ? jm[0] : '') + tail });
          }
          it.x = join(tk).replace(/\]\]\s*$/, ']]'); reblank(it); paint(); onChange && onChange();
        };
        box.append(b);
      });
      box.append(DT.el('div', { class: 'wse-blank__n' }, '빈칸 ' + DT.terms(it.x).length + '개 · 단어를 누르면 빈칸 ↔ 글자'));
    }
    paint();
    return box;
  }

  /* 내 문제 쓰기 */
  function customForm(onAdd, pool) {
    const type = DT.el('select', { class: 'select', 'aria-label': '문제 종류' }, [['short', '단답형 (자동 채점)'], ['choice', '객관식 (자동 채점)'], ['ox', 'O / X (자동 채점)'], ['open', '서술형 (선생님 확인)']].map(([v, t]) => DT.el('option', { value: v }, t)));
    const q = richBox('문제를 적어 주세요. 수식은 아래 「수식 넣기」 버튼으로 넣어요.');
    const extra = DT.el('div', { style: { display: 'grid', gap: '8px' } });
    let get = () => null;
    function paint() {
      extra.innerHTML = '';
      if (type.value === 'short') { const k = DT.el('input', { class: 'input', placeholder: '정답 (여러 개면 | 로 나눠요. 예: 5|다섯)' }); extra.append(k); get = () => { const key = k.value.trim(); if (!key) return '정답을 적어 주세요.'; return { type: 'short', mode: /^[-\d./√\s]+$/.test(key.split('|')[0]) ? 'num' : 'text', key: [key] }; }; }
      else if (type.value === 'choice') {
        const ch = [1, 2, 3, 4, 5].map((n) => DT.el('input', { class: 'input', placeholder: '①②③④⑤'[n - 1] + ' 보기' + (n === 5 ? ' (없으면 비워 둬요)' : '') }));
        const k = DT.el('select', { class: 'select', 'aria-label': '정답 번호' }, [1, 2, 3, 4, 5].map((n) => DT.el('option', { value: String(n) }, '정답 ' + '①②③④⑤'[n - 1])));
        extra.append(...ch, k);
        get = () => { const choices = ch.map((c) => c.value.trim()).filter(Boolean); if (choices.length < 2) return '보기를 두 개 이상 적어 주세요.'; if (+k.value > choices.length) return '정답 번호가 보기보다 커요.'; return { type: 'choice', choices, key: [k.value] }; };
      } else if (type.value === 'ox') { const k = DT.el('select', { class: 'select', 'aria-label': '정답' }, ['O', 'X'].map((v) => DT.el('option', { value: v }, '정답 ' + v))); extra.append(k); get = () => ({ type: 'ox', key: [k.value] }); }
      else { const a = DT.el('textarea', { class: 'textarea', rows: 2, placeholder: '모범 답안 (선택 · 학생에게는 안 보여요)' }); extra.append(a); get = () => ({ type: 'open', draw: true, ans: a.value.trim() }); }
    }
    type.onchange = paint; paint();
    const add = DT.el('button', { class: 'btn btn--ink', type: 'button', html: DT.icon('plus') + '학습지에 넣기' });
    add.onclick = () => { const qv = q.get(); if (!qv.trim()) return DT.toast('문제를 적어 주세요.', 'bad'); const r = get(); if (typeof r === 'string') return DT.toast(r, 'bad'); onAdd(Object.assign({ id: uid(), label: '선생님 문제', q: qv.trim(), mine: true }, r)); q.set(''); paint(); };
    /* 수식 넣기: 버튼 → 바꿀 글자만 적는 작은 창 → 칸에는 학생 화면과 같은 모양으로 들어간다 ($ 기호를 몰라도 됨) */
    const pal = DT.el('div', { class: 'wse-math' }, DT.el('span', { class: 'muted' }, '수식 넣기'), TPL.map((t, ti) => {
      const b = DT.el('button', { class: 'chip', type: 'button', title: t.lab, html: DT.tex(t.tex(t.f.map((x) => x[1])), false) + (/[가-힣]/.test(t.lab) ? ' <small>' + t.lab + '</small>' : '') });
      b.addEventListener('pointerdown', (e) => e.preventDefault());
      b.onclick = () => q.insert(ti);
      return b; }));
    const form = DT.el('div', { class: 'wse-form' });
    /* 탐구·국어처럼 지문이 필요할 때: 고른 범위의 교과서 글을 골라 문제 칸에 그대로 넣는다 (넣은 뒤 고쳐도 됨) */
    const psg = (pool || []).filter((x) => x.sentence && x.x);
    const take = psg.length ? DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('book') + '교과서에서 지문 가져오기', onclick: () => {
      const list = DT.el('div', { class: 'wse-psg' }); const qs = DT.el('input', { class: 'input', placeholder: '찾을 낱말 (예: 내적)', 'aria-label': '찾기' });
      const m = DT.modal({ title: '교과서에서 지문 가져오기', wide: true, cls: 'modal--tall', body: DT.el('div', { style: { display: 'grid', gap: '8px' } }, qs, list), actions: [{ label: '닫기' }] });
      /* 문장 단위로 골라 넣기: 지문을 문장으로 나눠 보여 주고, 누른 문장만 모아 넣는다 (수식은 깨지지 않음) */
      const picked = [];
      const go = DT.el('button', { class: 'btn btn--ink', type: 'button', html: DT.icon('plus') + '고른 문장 넣기 (0)', disabled: true });
      go.onclick = () => { if (!picked.length) return; q.add(picked.map((x) => x.t).join(' ')); m.close(); DT.toast('지문을 넣었어요. 이어서 문제를 적어요.'); };
      const sents = (x) => String(x).replace(/\[\[([^\]]+?)\]\]/g, '$1').replace(/\*\*|==|__/g, '').split(/(?<=[.?!다요])\s+(?=[^$]*(?:\$[^$]*\$[^$]*)*$)/).map((t) => t.trim()).filter(Boolean);
      const paintL = () => { list.innerHTML = ''; const k = qs.value.trim(); let lastT = '';
        psg.filter((x) => !k || DT.plain(x.x).includes(k)).slice(0, 80).forEach((x) => {
          const t = (x.src && x.src.title || '') + (x.src && x.src.page ? ' · 교과서 ' + x.src.page + '쪽' : '');
          if (t !== lastT) { list.append(DT.el('h4', null, t)); lastT = t; }
          const blk = DT.el('div', { class: 'wse-psg__blk' });
          sents(x.x).forEach((st, si) => {
            const key = x.id + ':' + si; const on = picked.some((y) => y.k === key);
            const b = DT.el('button', { type: 'button', class: 'wse-psg__s' + (on ? ' is-on' : ''), html: DT.md(st) });
            b.onclick = () => { const at = picked.findIndex((y) => y.k === key); if (at >= 0) picked.splice(at, 1); else picked.push({ k: key, t: st }); b.classList.toggle('is-on', at < 0); go.disabled = !picked.length; go.innerHTML = DT.icon('plus') + '고른 문장 넣기 (' + picked.length + ')'; };
            blk.append(b);
          });
          const all = DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button' }, '이 글 통째로 넣기'); all.onclick = () => { q.add(sents(x.x).join(' ')); m.close(); DT.toast('지문을 넣었어요. 이어서 문제를 적어요.'); };
          list.append(blk, all); }); };
      list.before(DT.el('p', { class: 'muted', style: { margin: 0 } }, '넣을 문장을 눌러 고르세요 (여러 개 가능). 다 고르면 아래 「고른 문장 넣기」.'));
      m.box.querySelector('.modal__foot').prepend(go);
      qs.oninput = paintL; paintL(); } }) : null;
    form.append(type, ...(take ? [take] : []), q.el, pal, DT.el('p', { class: 'muted', style: { margin: 0, fontSize: '13px' } }, '칸에 보이는 모양 그대로 학생에게 보여요. 수식을 누르면 글자를 바꿀 수 있어요.'), extra, add);
    return form;
  }

  /* 수식 틀: 바꿀 칸(이름·기본값)과 만들어지는 수식 */
  const TPL = [
    { lab: '벡터', f: [['벡터 이름', 'AB']], tex: (v) => '\\overrightarrow{' + v[0] + '}' },
    { lab: '벡터 a', f: [['글자', 'a']], tex: (v) => '\\vec{' + v[0] + '}' },
    { lab: '크기', f: [['글자', 'a']], tex: (v) => '|\\vec{' + v[0] + '}|' },
    { lab: '분수', f: [['분자(위)', '1'], ['분모(아래)', '2']], tex: (v) => '\\frac{' + v[0] + '}{' + v[1] + '}' },
    { lab: '루트', f: [['루트 안', '2']], tex: (v) => '\\sqrt{' + v[0] + '}' },
    { lab: '거듭제곱', f: [['밑', 'x'], ['지수', '2']], tex: (v) => v[0] + '^{' + v[1] + '}' },
    { lab: '아래첨자', f: [['글자', 'x'], ['첨자', '1']], tex: (v) => v[0] + '_{' + v[1] + '}' },
    { lab: '내적', f: [['앞 벡터', 'a'], ['뒤 벡터', 'b']], tex: (v) => '\\vec{' + v[0] + '}\\cdot\\vec{' + v[1] + '}' },
    { lab: '선분', f: [['선분 이름', 'AB']], tex: (v) => '\\overline{' + v[0] + '}' },
    { lab: '좌표·성분', f: [['값 (쉼표로)', '1, 2']], tex: (v) => '(' + v[0] + ')' },
    { lab: 'θ', f: [], tex: () => '\\theta' }, { lab: 'π', f: [], tex: () => '\\pi' }, { lab: '°', f: [], tex: () => '^{\\circ}' },
    { lab: '≤', f: [], tex: () => '\\le' }, { lab: '≥', f: [], tex: () => '\\ge' }, { lab: '×', f: [], tex: () => '\\times' }, { lab: '÷', f: [], tex: () => '\\div' }];

  /* 보이는 그대로 쓰는 칸: 글자는 그냥 치고, 수식은 완성된 모양의 덩어리로 들어간다. 값은 저장할 때만 $수식$ 글로 바꾼다 */
  function richBox(ph) {
    const el = DT.el('div', { class: 'wse-rich', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'data-ph': ph });
    let range = null;
    const keep = () => { const sel = getSelection(); if (sel.rangeCount && el.contains(sel.anchorNode)) range = sel.getRangeAt(0).cloneRange(); };
    ['keyup', 'mouseup', 'input', 'touchend'].forEach((ev) => el.addEventListener(ev, keep));
    const chip = (ti, vals) => {
      const t = TPL[ti]; const tex = t.tex(vals);
      const c = DT.el('span', { class: 'wse-mchip', contenteditable: 'false', 'data-tex': tex, 'data-ti': String(ti), 'data-v': JSON.stringify(vals), html: DT.tex(tex, false), title: '눌러서 고치기' });
      c.addEventListener('click', () => ask(ti, vals, (nv) => c.replaceWith(chip(ti, nv))));
      return c;
    };
    function ask(ti, vals, done) {
      const t = TPL[ti]; if (!t.f.length) return done([]);
      const ins = t.f.map((f, k) => DT.el('input', { class: 'input', value: vals[k] != null ? vals[k] : f[1], 'aria-label': f[0] }));
      const pv = DT.el('div', { class: 'wse-prev' }); const show = () => { pv.innerHTML = DT.tex(t.tex(ins.map((x) => x.value || ' ')), false); };
      ins.forEach((x) => (x.oninput = show)); show();
      DT.modal({ title: t.lab + ' 넣기', body: DT.el('div', { style: { display: 'grid', gap: '8px' } }, ...t.f.map((f, k) => DT.el('label', { class: 'field' }, DT.el('span', null, f[0]), ins[k])), DT.el('span', { class: 'muted' }, '이렇게 보여요'), pv),
        actions: [{ label: '취소' }, { label: '넣기', kind: 'ink', onClick: (c) => { c(); done(ins.map((x) => x.value.trim() || ' ')); } }] });
      setTimeout(() => { ins[0].focus(); ins[0].select(); }, 50);
    }
    function insert(ti) {
      ask(ti, [], (vals) => {
        const c = chip(ti, vals); const sp = document.createTextNode('\u00a0');
        if (range && el.contains(range.startContainer)) { range.deleteContents(); range.insertNode(sp); range.insertNode(c); }
        else el.append(c, sp);
        el.focus(); const r = document.createRange(); r.setStartAfter(sp); r.collapse(true); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); range = r.cloneRange();
      });
    }
    function get() {
      const out = [];
      const walk = (n) => n.childNodes.forEach((x) => {
        if (x.nodeType === 3) out.push(x.nodeValue.replace(/\u00a0/g, ' '));
        else if (x.classList && x.classList.contains('wse-mchip')) out.push('$' + x.dataset.tex + '$');
        else if (x.nodeName === 'BR') out.push('\n');
        else { if (/^(DIV|P)$/.test(x.nodeName) && out.length) out.push('\n'); walk(x); }
      });
      walk(el); return out.join('').replace(/\u200b/g, '').replace(/[ \t]+\n/g, '\n').trim();
    }
    function set(v) { el.innerHTML = ''; String(v || '').split(/(\$[^$]+\$)/).forEach((part) => { if (/^\$[^$]+\$$/.test(part)) el.append(DT.el('span', { class: 'wse-mchip', contenteditable: 'false', 'data-tex': part.slice(1, -1), html: DT.tex(part.slice(1, -1), false) })); else if (part) el.append(document.createTextNode(part)); }); }
    /* 글(수식 포함)을 칸 끝에 덧붙이기 — 지문 가져오기 */
    function add(v) { const cur = get(); set((cur ? cur + '\n' : '') + v); el.append(document.createElement('br')); const tail = document.createTextNode('\u200b'); el.append(tail); el.focus(); const r = document.createRange(); r.setStart(tail, 1); r.collapse(true); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); range = r.cloneRange(); }
    return { el, get, set, insert, add };
  }

  const summary = (it) => DT.plain(it.type === 'blank' ? String(it.x || '').replace(/\[\[([^\]]+)\]\]/g, '( )') : it.q || (it.prompts || []).join(' / ') || (it.criteria || []).map((c) => c.text).join(', ') || '').slice(0, 70);
  const typeName = { blank: '빈칸', short: '단답', choice: '객관식', ox: 'O/X', open: '서술형', group: '모둠', roles: '역할', peer: '동료평가', self: '자기평가', reflect: '한 줄 정리', career: '진로' };

  /* 편집기: w = { title, items } 를 직접 고친다. 반환: 요소 */
  W.editor = function (w, pool) {
    const root = DT.el('div', { class: 'wse' });
    const title = DT.el('input', { class: 'input wse-title', value: w.title || '', 'aria-label': '학습지 제목', placeholder: '학습지 제목' });
    title.oninput = () => { w.title = title.value; };
    const list = DT.el('ol', { class: 'wse-list' });
    const side = DT.el('div', { class: 'wse-side' });
    const count = DT.el('span', { class: 'muted' });
    let open = null;   /* 빈칸을 고치는 중인 문항 */

    function paintList() {
      list.innerHTML = ''; count.textContent = w.items.length + '문항';
      if (!w.items.length) list.append(DT.el('li', { class: 'wse-empty' }, '오른쪽에서 문항을 끌어다 놓거나 「넣기」를 눌러요.'));
      w.items.forEach((it, i) => {
        const li = DT.el('li', { class: 'wse-item' + (open === it.id ? ' is-open' : ''), 'data-id': it.id });
        const handle = DT.el('button', { type: 'button', class: 'wse-handle', 'aria-label': '끌어서 순서 바꾸기', title: '끌어서 순서 바꾸기', html: '⠿' });
        handle.addEventListener('pointerdown', (e) => startDrag(e, li, it));
        const head = DT.el('div', { class: 'wse-item__head' }, handle, DT.el('b', { class: 'num' }, (i + 1) + '.'), DT.el('span', { class: 'pill' }, typeName[it.type] || '문항'), DT.el('span', { class: 'wse-item__lab', html: DT.md(it.label || '') }),
          it.type === 'blank' ? DT.el('button', { type: 'button', class: 'btn btn--sm' + (open === it.id ? ' btn--ink' : ''), onclick: () => { open = open === it.id ? null : it.id; paintList(); } }, open === it.id ? '빈칸 다 골랐어요' : '빈칸 고르기 (' + (it.answers || []).length + ')') : null,
          DT.el('button', { type: 'button', class: 'icon-btn', 'aria-label': '위로', html: DT.icon('up'), disabled: i === 0, onclick: () => { w.items.splice(i - 1, 0, w.items.splice(i, 1)[0]); paintList(); } }),
          DT.el('button', { type: 'button', class: 'icon-btn', 'aria-label': '빼기', html: DT.icon('x'), onclick: () => { w.items.splice(i, 1); paintList(); paintSide(); } }));
        li.append(head);
        if (open === it.id) li.append(blankPicker(it, () => { const b = li.querySelector('.wse-item__head .btn'); if (b) b.textContent = '빈칸 다 골랐어요'; }));
        else li.append(DT.el('div', { class: 'wse-item__sum', html: DT.md(summary(it)) }));
        list.append(li);
      });
    }

    /* 순서 바꾸기: 손잡이를 끌기 (마우스·손가락·펜 모두) */
    function startDrag(e, li, it) {
      e.preventDefault(); const from = w.items.indexOf(it); li.classList.add('is-drag'); li.setPointerCapture && li.setPointerCapture(e.pointerId);
      let to = from;
      const move = (ev) => {
        const rows = DT.$$('.wse-item', list); to = rows.length - 1;
        for (let k = 0; k < rows.length; k++) { const r = rows[k].getBoundingClientRect(); if (ev.clientY < r.top + r.height / 2) { to = k; break; } }
        rows.forEach((r, k) => r.classList.toggle('is-over', k === to && k !== from));
      };
      const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); li.classList.remove('is-drag'); if (to !== from) { const [x] = w.items.splice(from, 1); w.items.splice(to > from ? to : to, 0, x); } paintList(); };
      addEventListener('pointermove', move); addEventListener('pointerup', up);
    }

    /* 교과서에서 끌어다 놓기 (컴퓨터) */
    list.addEventListener('dragover', (e) => { e.preventDefault(); });
    list.addEventListener('drop', (e) => {
      e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); const it = pool.find((x) => x.id === id); if (!it || w.items.find((x) => x.id === id)) return;
      const rows = DT.$$('.wse-item', list); let at = rows.length;
      for (let k = 0; k < rows.length; k++) { const r = rows[k].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { at = k; break; } }
      w.items.splice(at, 0, JSON.parse(JSON.stringify(it))); if (it.sentence) open = it.id; paintList(); paintSide();
    });

    let tab = 'book', filt = 'all', concept = '';
    function paintSide() {
      side.innerHTML = '';
      const tabs = DT.el('div', { class: 'chips' }, [['book', '교과서에서 넣기'], ['mine', '내 문제 쓰기']].map(([id, t]) => DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': tab === id ? 'true' : 'false', onclick: () => { tab = id; paintSide(); } }, t)));
      side.append(tabs);
      if (tab === 'mine') { side.append(customForm((it) => { w.items.push(it); paintList(); DT.toast('넣었어요. 왼쪽 맨 아래에 있어요.'); }, pool)); return; }
      /* 고르기 쉽게: 종류 → (변형 문제면) 개념 */
      const groupOf = (p) => (p.variant ? 'var' : p.sentence ? 'sent' : p.type === 'blank' ? 'blank' : ['short', 'choice', 'ox', 'open'].includes(p.type) ? 'book' : 'act');
      const fchips = DT.el('div', { class: 'chips wse-filter' }, [['all', '전체'], ['var', '변형 문제'], ['book', '교과서 문제'], ['blank', '개념 빈칸'], ['sent', '문장에 빈칸 직접'], ['act', '활동·평가']]
        .filter(([id]) => id === 'all' || pool.some((p) => groupOf(p) === id))
        .map(([id, t]) => DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': filt === id ? 'true' : 'false', onclick: () => { filt = id; concept = ''; paintSide(); } }, t)));
      side.append(fchips);
      if (filt === 'var') {
        const cs = [...new Set(pool.filter((p) => p.variant).map((p) => p.concept))];
        const sel = DT.el('select', { class: 'select', 'aria-label': '개념' }, DT.el('option', { value: '' }, '모든 개념 (' + cs.length + '개)'), cs.map((c) => DT.el('option', { value: c, selected: c === concept ? true : null }, c)));
        sel.onchange = () => { concept = sel.value; paintSide(); };
        side.append(sel);
      }
      const rest = pool.filter((p) => !w.items.find((x) => x.id === p.id) && (filt === 'all' || groupOf(p) === filt) && (!concept || p.concept === concept));
      if (!rest.length) { side.append(DT.el('p', { class: 'muted' }, '여기 있는 문항은 모두 넣었어요.')); return; }
      if (filt === 'var' && concept) side.append(DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('plus') + '이 개념 ' + rest.length + '문제 모두 넣기', onclick: () => { rest.forEach((x) => w.items.push(JSON.parse(JSON.stringify(x)))); paintList(); paintSide(); } }));
      side.append(DT.el('p', { class: 'muted', style: { margin: 0 } }, filt === 'sent' ? '문장을 넣은 뒤 단어를 눌러 원하는 곳에 빈칸을 만들어요.' : '끌어서 왼쪽에 놓거나 「넣기」를 눌러요.'));
      const box = DT.el('div', { class: 'wse-pool' });
      rest.forEach((it) => {
        const row = DT.el('div', { class: 'wse-pitem', draggable: 'true' }, DT.el('span', { class: 'pill' }, it.variant ? '변형' : it.sentence ? '문장' : typeName[it.type] || '문항'), DT.el('div', { class: 'wse-pitem__t' }, DT.el('b', { html: DT.md(it.label || '') }), DT.el('small', { html: DT.md(summary(it)) })),
          DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('plus') + '넣기', onclick: () => { w.items.push(JSON.parse(JSON.stringify(it))); if (it.sentence) open = it.id; paintList(); paintSide(); } }));
        row.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', it.id); e.dataTransfer.effectAllowed = 'copy'; });
        box.append(row);
      });
      side.append(box);
    }

    root.append(DT.el('div', { class: 'wse-top' }, title, count),
      DT.el('div', { class: 'wse-cols' }, DT.el('div', { class: 'wse-main' }, list), side));
    paintList(); paintSide();
    return root;
  };

  /* 종이 학습지 (인쇄용). opt.answers: 정답을 빨갛게 같이 */
  W.paper = function (w, opt) {
    opt = opt || {}; const C = DT.config;
    /* 반마다 자기 학습지 양식: config.printCss 가 있으면 「큰 제목 + <학습지> + 단원명 칸 + 쪽마다 테두리」 틀에 담고,
       모양(글꼴·테두리·색·풀이 칸)은 그 CSS(작업물/<교과서>/print/)가 정한다. 없으면 기본 양식. */
    const custom = !!C.printCss;
    const tb = W._tb; const subs = tb && w.subunitIds ? w.subunitIds.map((id) => (tb._subunits || []).find((u) => u.id === id)).filter(Boolean) : [];
    const unitTitle = tb && tb.units && tb.units[0] ? DT.plain(tb.units[0].title || '') : '';
    const pg = DT.el('article', { class: 'wsp' + (custom ? ' wsp--custom' : '') });
    let body = pg;
    if (custom) {
      body = DT.el('td', { class: 'wspc-body' });
      pg.append(DT.el('div', { class: 'wspc-frame' }), DT.el('table', { class: 'wspc' },
        DT.el('thead', null, DT.el('tr', null, DT.el('td', null,
          DT.el('div', { class: 'wspc-top' }, DT.el('span', { class: 'wspc-course' }, unitTitle.replace(/^[ⅠⅡⅢⅣⅤⅥ\d.\s]+/, '') || w.title), DT.el('span', { class: 'wspc-kind' }, '<학습지>' + (opt.answers ? ' 정답' : '')), DT.el('span', { class: 'wspc-who' }, '학번 ________ 이름 __________')),
          DT.el('div', { class: 'wspc-unit' }, DT.el('b', null, '단원명'), DT.el('span', null, subs.length ? subs.map((u) => DT.plain(u.title)).join(', ') : w.title))))),
        DT.el('tbody', null, DT.el('tr', null, body))));
    } else {
      pg.append(DT.el('header', { class: 'wsp__head' }, DT.el('div', null, DT.el('small', null, [C.school, opt.cls].filter(Boolean).join(' · ')), DT.el('h1', null, w.title + (opt.answers ? ' (정답)' : ''))),
        DT.el('div', { class: 'wsp__who' }, '학번 ________　이름 ____________')));
    }
    let ol = DT.el('ol', { class: 'wsp__list' }); body.append(ol);
    const key = (t) => (opt.answers ? DT.el('div', { class: 'wsp__key', html: (custom ? '답: ' : '정답: ') + t }) : null);
    /* 묶음 제목: 개념(변형) → 종류 → 교과서 화면 제목. 수식은 글자로 남기지 않고 바꿔서 보인다 */
    const KIND = { blank: '개념 빈칸', self: '자기평가', reflect: '한 줄 정리', group: '모둠 활동', roles: '모둠 활동', peer: '모둠 활동', career: '진로 탐구' };
    const secOf = (it) => it.concept || KIND[it.type] || (it.mine ? '선생님 문제' : (it.src && it.src.title) || '문제');
    let sec = null, no = 0, sn = 0;
    w.items.forEach((it) => {
      no++;
      if ((opt.sections || custom) && secOf(it) !== sec) {   /* 개념(또는 종류)마다 제목 — 양식에서는 「1. 제목」 */
        sec = secOf(it); if (ol.children.length) { ol = DT.el('ol', { class: 'wsp__list', start: String(no) }); }
        body.append(DT.el('h2', { class: 'wsp__sec', html: DT.md(custom ? (++sn) + '. ' + sec.replace(/^교과서 문제 · /, '') : sec) }), ol);
      }
      const li = DT.el('li', { class: 'wsp__item' });
      let lab = opt.sections && it.variant ? '변형' : it.label || '';
      if (custom) { const m = String(lab).match(/^(문제|예제|보기|확인)\s*\d+/); lab = it.variant ? '변형' : m ? m[0] : lab; }
      li.append(DT.el('div', { class: 'wsp__lab', html: DT.md(lab) + (it.src && it.src.page ? ' <small>(교과서 ' + it.src.page + '쪽)</small>' : '') }));
      if (it.type === 'blank') {
        let n = 0; const ans = it.answers || [];
        li.append(DT.el('div', { class: 'wsp__q', html: DT.md(String(it.x || '').replace(/\[\[([^\]]+?)\]\]/g, () => { const k = n++; return opt.answers ? '__' + (ans[k] || '') + '__' : '(' + '①②③④⑤⑥⑦⑧⑨⑩'[k] + '　　　　　)'; })) }));
        if (!opt.answers && it.bank && it.bank.length) li.append(DT.el('div', { class: 'wsp__bank' }, '보기: ' + it.bank.join('　')));
      } else if (it.type === 'self') li.append(DT.el('table', { class: 'wsp__self' }, DT.el('tr', null, DT.el('th', null, '할 수 있나요?'), ...W.levels.map((l) => DT.el('th', null, l))), ...(it.criteria || []).map((c) => DT.el('tr', null, DT.el('td', { html: DT.md(c.text) }), ...W.levels.map(() => DT.el('td', null, '□'))))));
      else if (it.type === 'reflect') li.append(DT.el('div', { class: 'wsp__q' }, it.q), DT.el('div', { class: 'wsp__lines' }), DT.el('div', { class: 'wsp__q' }, it.q2), DT.el('div', { class: 'wsp__lines' }));
      else if (it.type === 'group') { if (it.intro) li.append(DT.el('div', { class: 'wsp__q', html: DT.md(it.intro) })); li.append(DT.el('ol', { class: 'wsp__sub' }, (it.prompts || []).map((p) => DT.el('li', { html: DT.md(p) }))), DT.el('div', { class: 'wsp__box' })); }
      else if (it.type === 'roles') li.append(DT.el('div', { class: 'wsp__q' }, (it.roles || []).map((r) => r.name + ': ________').join('　')));
      else if (it.type === 'peer') li.append(DT.el('div', { class: 'wsp__q' }, '친구 이름 ________ — ' + (it.criteria || []).map((c) => c.text + ' (상·중·하)').join(' / ')));
      else if (it.type === 'career') li.append(DT.el('div', { class: 'wsp__q' }, '관심 계열 ________　탐구하고 싶은 것:'), DT.el('div', { class: 'wsp__box' }));
      else {
        if (it.q) li.append(DT.el('div', { class: 'wsp__q', html: DT.md(it.q) }));
        if (it.sub && it.sub.length) li.append(DT.el('ol', { class: 'wsp__sub' }, it.sub.map((s) => DT.el('li', { html: DT.md(s) }))));
        if (it.choices) li.append(DT.el('div', { class: 'wsp__choices' }, it.choices.map((c, k) => DT.el('span', { html: '①②③④⑤'[k] + ' ' + DT.md(c) }))));
        if (it.type === 'ox') li.append(DT.el('div', { class: 'wsp__q' }, '( O ,  X )'));
        if (it.type === 'short' && !(custom && opt.answers)) li.append(DT.el('div', { class: 'wsp__q' }, '답: ______________'));
        if (it.type === 'open' && !(custom && opt.answers)) li.append(DT.el('div', { class: 'wsp__box' }));
        const k = it.key && it.key.length ? it.key.map((x) => DT.esc(String(x).split('|')[0])).join(', ') : it.ans ? DT.md(it.ans) : '';
        if (k) { const kk = key(it.type === 'choice' ? '①②③④⑤'[+it.key[0] - 1] : k); if (kk) li.append(kk); }
      }
      if (it.figs && it.figs.length) { const f = DT.el('div', { class: 'wsp__figs' }); it.figs.forEach((src) => { const im = DT.el('img', { alt: '' }); DT.data.asset(src).then((u) => { im.src = u; }); f.append(im); }); li.append(f); }
      ol.append(li);
    });
    body.append(DT.el('footer', { class: 'wsp__foot' }, '출처: 교과서 — 수업 목적으로만 사용' + (w.items.some((it) => it.variant) ? ' · 「변형」은 교과서 문제의 숫자·조건을 바꾼 문제' : '')));
    return pg;
  };

  /* 인쇄: 학생용 / 정답 포함 고르기 → 인쇄 창 (PDF 저장도 여기서). 칠판·선생님 화면 어디서나 */
  W.print = function (w, clsName, popt) {
    popt = popt || {};
    const go = (answers) => {
      let pa = document.getElementById('printArea');
      if (!pa) { pa = DT.el('div', { class: 'print-area', id: 'printArea' }); document.body.append(pa); }
      pa.innerHTML = ''; document.body.classList.add('is-printing');
      addEventListener('afterprint', () => document.body.classList.remove('is-printing'), { once: true });
      pa.append(W.paper(w, { answers, cls: clsName, sections: popt.sections }));
      /* 반 양식 CSS를 처음 한 번 불러온다 */
      const C = DT.config; let cssReady = Promise.resolve();
      if (C.printCss && !document.getElementById('printCss')) { const l = DT.el('link', { rel: 'stylesheet', id: 'printCss', href: C.printCss + (C.printCss.includes('?') ? '&' : '?') + 'v=' + Date.now() }); cssReady = new Promise((ok) => { l.onload = l.onerror = ok; setTimeout(ok, 2000); }); document.head.append(l); }
      const imgs = DT.$$('img', pa); let left = imgs.length;
      const fire = () => cssReady.then(() => setTimeout(() => window.print(), 150));
      if (!left) return fire();
      const t = setTimeout(fire, 2500); imgs.forEach((im) => { im.onload = im.onerror = () => { if (--left === 0) { clearTimeout(t); fire(); } }; });
    };
    DT.modal({ title: popt.sections ? '문제 모음 인쇄 · PDF' : '학습지 인쇄', body: '<p>' + (popt.sections ? '이 범위의 교과서 문제와 변형 문제 ' + w.items.length + '개를 개념별로 모았어요. ' : '종이로 나눠 줄 학습지예요. ') + '인쇄 창에서 「PDF로 저장」을 고르면 PDF 파일이 돼요.</p>', actions: [{ label: '닫기' }, { label: '정답 포함 (선생님용)', icon: 'print', onClick: (c) => { c(); go(true); } }, { label: '학생용 인쇄', kind: 'ink', icon: 'print', onClick: (c) => { c(); go(false); } }] });
  };
})();

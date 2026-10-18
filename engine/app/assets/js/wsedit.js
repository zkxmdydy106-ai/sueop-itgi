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
    ['concept', 'practice', 'group', 'self', 'career'].forEach((k) => W.build(tb, scope, k).items.forEach((it) => { if (!out.find((x) => x.id === it.id)) out.push(it); }));
    return out;
  };

  /* 빈칸 문항: x 안의 [[ ]] 가 빈칸. 답·보기 단어를 다시 맞춘다 */
  function reblank(it) {
    const ans = DT.terms(it.x);
    const extra = (it.bank || []).filter((w) => !(it.answers || []).includes(w) && !ans.includes(w)).slice(0, 3);
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
  function customForm(onAdd) {
    const type = DT.el('select', { class: 'select', 'aria-label': '문제 종류' }, [['short', '단답형 (자동 채점)'], ['choice', '객관식 (자동 채점)'], ['ox', 'O / X (자동 채점)'], ['open', '서술형 (선생님 확인)']].map(([v, t]) => DT.el('option', { value: v }, t)));
    const q = DT.el('textarea', { class: 'textarea', rows: 3, placeholder: '문제를 적어 주세요. 수식은 $\\vec{a}+\\vec{b}$ 처럼 $ 사이에' });
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
    add.onclick = () => { if (!q.value.trim()) return DT.toast('문제를 적어 주세요.', 'bad'); const r = get(); if (typeof r === 'string') return DT.toast(r, 'bad'); onAdd(Object.assign({ id: uid(), label: '선생님 문제', q: q.value.trim(), mine: true }, r)); q.value = ''; paint(); };
    return DT.el('div', { class: 'wse-form' }, type, q, extra, add);
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
      w.items.splice(at, 0, JSON.parse(JSON.stringify(it))); paintList(); paintSide();
    });

    let tab = 'book';
    function paintSide() {
      side.innerHTML = '';
      const tabs = DT.el('div', { class: 'chips' }, [['book', '교과서에서 넣기'], ['mine', '내 문제 쓰기']].map(([id, t]) => DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': tab === id ? 'true' : 'false', onclick: () => { tab = id; paintSide(); } }, t)));
      side.append(tabs);
      if (tab === 'mine') { side.append(customForm((it) => { w.items.push(it); paintList(); DT.toast('넣었어요. 왼쪽 맨 아래에 있어요.'); })); return; }
      const rest = pool.filter((p) => !w.items.find((x) => x.id === p.id));
      if (!rest.length) { side.append(DT.el('p', { class: 'muted' }, '이 범위의 문항은 모두 넣었어요.')); return; }
      side.append(DT.el('p', { class: 'muted', style: { margin: 0 } }, '끌어서 왼쪽에 놓거나 「넣기」를 눌러요.'));
      const box = DT.el('div', { class: 'wse-pool' });
      rest.forEach((it) => {
        const row = DT.el('div', { class: 'wse-pitem', draggable: 'true' }, DT.el('span', { class: 'pill' }, typeName[it.type] || '문항'), DT.el('div', { class: 'wse-pitem__t' }, DT.el('b', { html: DT.md(it.label || '') }), DT.el('small', { html: DT.md(summary(it)) })),
          DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('plus') + '넣기', onclick: () => { w.items.push(JSON.parse(JSON.stringify(it))); paintList(); paintSide(); } }));
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
    const pg = DT.el('article', { class: 'wsp' });
    pg.append(DT.el('header', { class: 'wsp__head' }, DT.el('div', null, DT.el('small', null, [C.school, opt.cls].filter(Boolean).join(' · ')), DT.el('h1', null, w.title + (opt.answers ? ' (정답)' : ''))),
      DT.el('div', { class: 'wsp__who' }, '학번 ________　이름 ____________')));
    const ol = DT.el('ol', { class: 'wsp__list' });
    const key = (t) => (opt.answers ? DT.el('div', { class: 'wsp__key', html: '정답: ' + t }) : null);
    w.items.forEach((it) => {
      const li = DT.el('li', { class: 'wsp__item' });
      li.append(DT.el('div', { class: 'wsp__lab', html: DT.md(it.label || '') + (it.src && it.src.page ? ' <small>(교과서 ' + it.src.page + '쪽)</small>' : '') }));
      if (it.type === 'blank') {
        let n = 0; const ans = it.answers || [];
        li.append(DT.el('div', { class: 'wsp__q', html: DT.md(String(it.x || '').replace(/\[\[([^\]]+?)\]\]/g, () => { const k = n++; return opt.answers ? '<u>' + DT.esc(ans[k] || '') + '</u>' : '(' + '①②③④⑤⑥⑦⑧⑨⑩'[k] + '　　　　　)'; })) }));
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
        if (it.type === 'short') li.append(DT.el('div', { class: 'wsp__q' }, '답: ______________'));
        if (it.type === 'open') li.append(DT.el('div', { class: 'wsp__box' }));
        const k = it.key && it.key.length ? it.key.map((x) => DT.esc(String(x).split('|')[0])).join(', ') : it.ans ? DT.md(it.ans) : '';
        if (k) { const kk = key(it.type === 'choice' ? '①②③④⑤'[+it.key[0] - 1] : k); if (kk) li.append(kk); }
      }
      if (it.figs && it.figs.length) { const f = DT.el('div', { class: 'wsp__figs' }); it.figs.forEach((src) => { const im = DT.el('img', { alt: '' }); DT.data.asset(src).then((u) => { im.src = u; }); f.append(im); }); li.append(f); }
      ol.append(li);
    });
    pg.append(ol, DT.el('footer', { class: 'wsp__foot' }, '출처: 교과서 — 수업 목적으로만 사용'));
    return pg;
  };

  /* 인쇄: 학생용 / 정답 포함 고르기 → 인쇄 창 (PDF 저장도 여기서) */
  W.print = function (w, clsName) {
    const go = (answers) => {
      const pa = document.getElementById('printArea'); pa.innerHTML = '';
      pa.append(W.paper(w, { answers, cls: clsName }));
      const imgs = DT.$$('img', pa); let left = imgs.length;
      const fire = () => setTimeout(() => window.print(), 150);
      if (!left) return fire();
      const t = setTimeout(fire, 2500); imgs.forEach((im) => { im.onload = im.onerror = () => { if (--left === 0) { clearTimeout(t); fire(); } }; });
    };
    DT.modal({ title: '학습지 인쇄', body: '<p>종이로 나눠 줄 학습지예요. 인쇄 창에서 「PDF로 저장」을 고르면 파일로도 저장돼요.</p>', actions: [{ label: '닫기' }, { label: '정답 포함 (선생님용)', icon: 'print', onClick: (c) => { c(); go(true); } }, { label: '학생용 인쇄', kind: 'ink', icon: 'print', onClick: (c) => { c(); go(false); } }] });
  };
})();

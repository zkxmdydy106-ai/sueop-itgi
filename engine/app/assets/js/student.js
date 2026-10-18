/* 디지털교과서 엔진 · student.js — 학생 화면 (아이패드)
   한 번에 한 가지: 로그인 → 홈(해야 할 학습지) → 한 문항씩 풀기 → 결과.  수업 중에는 아래에 이해도 신호. */
(function () {
  'use strict';
  const DT = window.DT; const $ = DT.$; const C = DT.config;
  const S = { me: null, tb: null, view: 'home', page: 0, assignments: [], subs: [], live: null, unsub: [] };
  const app = () => $('#app');
  const ICON_G = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>';

  function shell(title, opts) {
    opts = opts || {};
    const head = DT.el('header', { class: 'st-head' });
    if (opts.back) head.append(DT.el('button', { class: 'icon-btn', type: 'button', 'aria-label': opts.backLabel || '뒤로', html: DT.icon('left'), onclick: opts.back }));
    head.append(DT.el('h1', { class: 'st-head__title' }, title));
    if (opts.right) head.append(opts.right);
    const main = DT.el('main', { class: 'st-main' });
    const foot = DT.el('footer', { class: 'st-foot', hidden: true });
    app().innerHTML = ''; app().append(head, main, foot);
    paintLiveBar();
    return main;
  }

  /* ── 시작 ── */
  async function start() {
    try { await DT.data.init(); } catch (e) { return err('연결하지 못했어요. 와이파이를 확인하고 새로 고침해 주세요.'); }
    S.me = DT.data.user();
    if (!S.me || S.me.role !== 'student') return login();
    await syncFixed().catch(() => {});
    await enter();
  }
  function err(msg) { const m = shell('디지털교과서'); m.append(DT.el('div', { class: 'empty' }, DT.el('b', null, '열 수 없어요'), DT.el('span', null, msg))); }

  async function login() {
    const m = shell('디지털교과서');
    const brand = DT.el('div', { class: 'login__brand' }, DT.el('span', { class: 'pill' }, '학생용'), DT.el('h1', null, '오늘 배울 내용과', DT.el('br'), '학습지가 여기 있어요'), DT.el('p', null, '선생님이 보낸 학습지를 풀고, 수업 중에는 이해했는지 신호를 보낼 수 있어요.'));
    const card = DT.el('div', { class: 'login__card' });
    if (DT.data.mode === 'firebase') {
      card.append(DT.el('h2', null, '학교 구글 계정으로 시작'),
        DT.el('button', { class: 'gbtn', type: 'button', html: ICON_G + '구글 계정으로 로그인', onclick: async () => { try { const u = await DT.data.signIn(); if (u && u.role === 'student') { S.me = u; enter(); } else if (u) { DT.toast(u.email + ' 계정은 이 반 명단에 없어요. 선생님께 알려 주세요.', 'bad'); } } catch (e) { DT.toast('로그인하지 못했어요: ' + (e.message || e), 'bad'); } } }),
        DT.el('p', { class: 'login__note' }, '한 번 로그인하면 이 아이패드에서는 다음부터 바로 열려요. 이름과 답은 우리 반 선생님만 볼 수 있어요.'));
      if (S.me && S.me.role === 'guest') card.append(DT.el('div', { class: 'fb fb--bad' }, S.me.email + ' 계정은 이 반 명단에 없어요. 다른 계정으로 로그인하거나 선생님께 알려 주세요.'));
    } else {
      const roster = await DT.data.listStudentsForPicker();
      const classes = await DT.data.listClasses();
      let cls = classes[0] ? classes[0].id : null, page = 0;
      const grid = DT.el('div', { class: 'pickgrid' }); const pager = DT.el('div', { class: 'chips' });
      const tabs = DT.el('div', { class: 'chips' });
      classes.forEach((c) => { const b = DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': c.id === cls ? 'true' : 'false' }, c.name); b.onclick = () => { cls = c.id; page = 0; DT.$$('.chip', tabs).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); paint(); }; tabs.append(b); });
      function paint() {
        const list = roster.filter((r) => r.classId === cls); const per = 12; const pages = Math.ceil(list.length / per);
        grid.innerHTML = ''; list.slice(page * per, page * per + per).forEach((r) => grid.append(DT.el('button', { type: 'button', onclick: async () => { await DT.data.signIn({ role: 'student', key: r.key, name: r.name, no: r.no, classId: r.classId }); S.me = DT.data.user(); enter(); } }, r.name, DT.el('span', { class: 'num' }, r.no))));
        pager.innerHTML = ''; if (pages > 1) for (let i = 0; i < pages; i++) { const b = DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': i === page ? 'true' : 'false' }, (i + 1) + '쪽'); b.onclick = () => { page = i; paint(); }; pager.append(b); }
      }
      card.append(DT.el('h2', null, '체험하기: 학생 고르기'), DT.el('p', { class: 'login__note' }, '지금은 체험 모드예요. 실제로 쓸 때는 이 자리에 「구글 계정으로 로그인」 단추가 나와요. 가상 학생을 골라 보세요.'), tabs, grid, pager);
      paint();
    }
    m.append(DT.el('div', { class: 'login' }, brand, card));
  }

  async function enter() {
    try { S.tb = DT.render.flatten(await DT.data.getCourse()); } catch (e) { return err(e.message); }
    DT.applySubject(S.tb.meta.subject);
    S.unsub.forEach((f) => f()); S.unsub = [];
    S.unsub.push(DT.data.onAssignments(S.me.classId, (rows) => { S.assignments = rows.filter((a) => a.status !== 'hidden'); if (S.view === 'home') home(); }));
    S.unsub.push(DT.data.onLive(S.me.classId, (l) => { S.live = l; onLive(); }));
    S.subs = await DT.data.listSubmissions({ key: S.me.key });
    home();
  }
  const mySub = (aid) => S.subs.find((s) => s.aid === aid);
  const itemsFor = (a) => (a.perStudent ? (a.perStudent[S.me.key] || []) : a.items || []);
  function stateOf(a) {
    const s = mySub(a.id);
    if (s && s.submittedAt) return ['done', s.score && s.score.total ? '제출 · ' + s.score.correct + '/' + s.score.total : '제출함'];
    if (a.due && Date.now() > a.due) return ['late', '기한 지남'];
    if (s) return ['doing', '하는 중'];
    return ['new', '새 학습지'];
  }

  /* ── 홈 ── */
  function home() {
    S.view = 'home';
    const right = DT.el('div', { class: 'st-head__who' }, DT.iconEl('user'), DT.el('span', null, S.me.name + ' · ' + S.me.no), DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button', title: '화면 테마', 'aria-label': '화면 테마', html: DT.icon('palette'), onclick: () => DT.theme.open() }), DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: async () => { if (await DT.confirm('로그아웃', '이 아이패드에서 로그아웃할까요?', '로그아웃')) { await DT.data.signOut(); location.reload(); } } }, '로그아웃'));
    const m = shell(DT.plain(S.tb.meta.title), { right });
    const list = S.assignments.filter((a) => itemsFor(a).length);
    const per = innerHeight < 700 ? 3 : 5; const pages = Math.max(1, Math.ceil(list.length / per)); S.page = Math.min(S.page, pages - 1);
    const todo = list.filter((a) => stateOf(a)[0] === 'new' || stateOf(a)[0] === 'doing').length;
    const left = DT.el('section', { class: 'panel' });
    const pager = DT.el('span', { class: 'pager' });
    if (pages > 1) pager.append(DT.el('button', { class: 'icon-btn', type: 'button', 'aria-label': '앞 목록', disabled: S.page === 0, html: DT.icon('left'), onclick: () => { S.page--; home(); } }), DT.el('span', { class: 'num' }, (S.page + 1) + ' / ' + pages), DT.el('button', { class: 'icon-btn', type: 'button', 'aria-label': '다음 목록', disabled: S.page >= pages - 1, html: DT.icon('right'), onclick: () => { S.page++; home(); } }));
    left.append(DT.el('div', { class: 'panel__h' }, DT.el('h2', null, todo ? '해야 할 학습지 ' + todo + '개' : '학습지'), pager));
    const wl = DT.el('div', { class: 'wlist' });
    if (!list.length) wl.append(DT.el('div', { class: 'empty' }, DT.el('b', null, '아직 받은 학습지가 없어요'), DT.el('span', null, '선생님이 보내면 여기에 바로 나타나요.')));
    list.slice(S.page * per, S.page * per + per).forEach((a) => {
      const [st, label] = stateOf(a);
      const b = DT.el('button', { class: 'witem', type: 'button' }, DT.el('b', null, a.title), DT.el('span', { class: 'state state--' + st }, label), DT.el('small', null, DT.ws.kindName(a.kind) + ' · ' + itemsFor(a).length + '문항' + (a.due ? ' · ' + DT.date(a.due) + '까지' : '')));
      b.onclick = () => (st === 'done' ? result(a) : run(a));
      wl.append(b);
    });
    left.append(wl);
    const wrongN = wrongItems().length;
    const extraTiles = DT.extras.list().filter((ex) => ex.student || ex.visitor).map((ex) => tile(ex.icon || 'play', ex.title, '바로 시작 · 결과는 선생님 화면에', '', () => window.open(DT.extras.url(ex.student || ex.visitor, { num: S.me.no, name: S.me.name }), '_blank')));
    const side = DT.el('aside', { class: 'side' },
      tile('note', '오답 노트', '틀린 문제 다시 풀기', wrongN || '', reviewWrong),
      tile('board', '지난 수업 다시 보기', '선생님 판서와 함께', '', lessons),
      tile('chart', '내 기록', '참여 · 정답률 · 받은 피드백', '', mine), ...extraTiles);
    m.append(DT.el('div', { class: 'home' }, left, side));
  }
  function tile(ic, t, d, n, fn) { return DT.el('button', { class: 'tile', type: 'button', onclick: fn, html: DT.icon(ic) + '<span class="tile__t"><b>' + t + '</b><span>' + d + '</span></span>' + (n !== '' ? '<i class="num">' + n + '</i>' : '') }); }

  /* ── 학습지 풀기 ── */
  async function run(a, startAt, opts) {
    S.view = 'run'; opts = opts || {};
    const items = itemsFor(a);
    let mode = startAt != null ? 'one' : 'sheet';   /* sheet: 한 장으로 보기 · one: 한 문항 크게 */
    const prev = mySub(a.id) || (await DT.data.getSubmission(a.id, S.me.key)) || {};
    const ans = Object.assign({}, prev.answers || {});
    let i = startAt || 0;
    const save = DT.debounce(() => DT.data.saveSubmission({ aid: a.id, key: S.me.key, no: S.me.no, name: S.me.name, classId: S.me.classId, answers: ans, startedAt: prev.startedAt || Date.now() }).then((s) => { const k = S.subs.findIndex((x) => x.aid === a.id); if (k >= 0) S.subs[k] = s; else S.subs.push(s); }), 700);
    function paint() {
      if (mode === 'sheet') return paintSheet();
      const m = shell(a.title, { back: home, backLabel: '목록으로 (저장돼요)' });
      const run = DT.el('div', { class: 'runner' });
      const prog = DT.el('div', { class: 'prog', 'aria-label': (i + 1) + '번째 / ' + items.length + '문항' });
      items.forEach((it, k) => prog.append(DT.el('i', { class: k < i ? 'is-done' : k === i ? 'is-now' : '' })));
      const it = items[i]; const box = DT.el('div', { class: 'item' });
      const lab = DT.el('div', { class: 'item__label' }, DT.el('span', { class: 'pill', html: DT.md(it.label || '문항') }), DT.el('span', { class: 'item__src num' }, (i + 1) + ' / ' + items.length + (it.src && it.src.page ? ' · 교과서 ' + it.src.page + '쪽' : '') + (it.from ? ' · ' + it.from : '')));
      box.append(lab);
      renderItem(box, it, ans, () => save(), a);
      run.append(prog, box);
      m.append(run);
      const foot = $('.st-foot'); foot.hidden = false; foot.innerHTML = '';
      foot.append(DT.el('button', { class: 'btn', type: 'button', html: DT.icon('list') + '한 장으로 보기', onclick: () => { mode = 'sheet'; paint(); } }), DT.el('button', { class: 'btn', type: 'button', disabled: i === 0, html: DT.icon('left') + '이전', onclick: () => { i--; paint(); } }), DT.el('span', { style: { flex: '1' } }));
      if (i < items.length - 1) foot.append(DT.el('button', { class: 'btn btn--ink', type: 'button', html: '다음' + DT.icon('right'), onclick: () => { i++; paint(); } }));
      else foot.append(DT.el('button', { class: 'btn btn--accent', type: 'button', html: DT.icon('send') + '제출하기', onclick: submit }));
      paintLiveBar(true);
    }
    /* 한 장으로 보기 — 실제 종이 학습지처럼 모든 문항과 내 답을 한 화면에. 문항을 누르면 크게 풀기. 인쇄·PDF 저장 */
    function paintSheet() {
      const done = !!(prev.submittedAt || (mySub(a.id) || {}).submittedAt); const sub = mySub(a.id) || prev;
      const m = shell(a.title, { back: home, backLabel: '목록으로 (저장돼요)' });
      const paper = DT.el('article', { class: 'wsheet' });
      paper.append(DT.el('header', { class: 'wsheet__head' }, DT.el('h2', null, a.title), DT.el('div', { class: 'wsheet__who' }, DT.el('span', null, '학번 ' + (S.me.no || '')), DT.el('span', null, '이름 ' + (S.me.name || '')), DT.el('span', null, DT.date(Date.now())))));
      if (!opts.readOnly) paper.append(DT.el('p', { class: 'wsheet__tip no-print' }, '문항이나 빈칸을 누르면 크게 열려서 풀 수 있어요.'));
      const list = DT.el('ol', { class: 'wsheet__list' });
      items.forEach((it, k) => {
        const v = ans[it.id]; const r = (sub.results || {})[it.id];
        const li = DT.el('li', { class: 'wsheet__item' + (r ? (r.correct ? ' is-ok' : ' is-bad') : '') + (isEmpty(v) ? ' is-empty' : '') });
        li.append(DT.el('div', { class: 'wsheet__lab' }, DT.el('b', { class: 'num' }, (k + 1) + '.'), DT.el('span', { html: DT.md(it.label || '') }), it.src && it.src.page ? DT.el('small', null, '교과서 ' + it.src.page + '쪽') : null, r ? DT.el('i', { class: 'wsheet__mark' }, r.correct ? '○' : '✕') : null));
        li.append(sheetBody(it, v));
        if (!opts.readOnly) { li.tabIndex = 0; li.setAttribute('role', 'button'); li.onclick = () => { i = k; mode = 'one'; paint(); }; li.onkeydown = (e) => { if (e.key === 'Enter') li.click(); }; }
        list.append(li);
      });
      paper.append(list);
      m.append(paper);
      const foot = $('.st-foot'); foot.hidden = false; foot.innerHTML = '';
      const left = items.filter((it) => it.type !== 'reflect' && it.type !== 'peer' && isEmpty(ans[it.id])).length;
      foot.append(DT.el('button', { class: 'btn', type: 'button', html: DT.icon('download') + '인쇄 · PDF로 저장', title: '인쇄 창에서 「PDF로 저장」을 고르면 파일로 저장돼요. 저장한 PDF는 구글 드라이브에 올릴 수 있어요.', onclick: () => window.print() }),
        DT.el('span', { class: 'wsheet__left' }, done ? '제출했어요' : left ? '아직 ' + left + '문항 남았어요' : '모두 답했어요'), DT.el('span', { style: { flex: '1' } }));
      if (!done && !opts.readOnly) foot.append(DT.el('button', { class: 'btn btn--accent', type: 'button', html: DT.icon('send') + '제출하기', onclick: submit }));
      else foot.append(DT.el('button', { class: 'btn btn--ink', type: 'button', html: '결과 보기', onclick: () => result(a) }));
      paintLiveBar(true);
    }
    function sheetBody(it, v) {
      const w = DT.el('div', { class: 'wsheet__body' });
      const md = (x) => DT.el('div', { class: 'wsheet__q', html: DT.md(x || '') });
      const line = (t) => DT.el('div', { class: 'wsheet__ans' + (t ? '' : ' is-blank') }, t || ' ');
      const figs = () => { if (!(it.figs || []).length) return null; const f = DT.el('div', { class: 'wsheet__figs' }); it.figs.forEach((src) => { const im = DT.el('img', { alt: '교과서 그림' }); DT.data.asset(src).then((u) => { im.src = u; }); f.append(im); }); return f; };
      if (it.type === 'blank') {   /* 빈칸 자리를 표시해 두었다가 수식 변환 뒤에 칸으로 바꾼다 (md가 HTML을 지우지 않게) */
        let n = -1; const val = v || [];
        const html = DT.md(String(it.x || '').replace(/\[\[([^\]]+)\]\]/g, () => 'ZZSLOT' + (++n) + 'ZZ')).replace(/ZZSLOT(\d+)ZZ/g, (m, k) => '<u class="wsheet__slot">' + DT.esc(val[+k] || '( ' + (+k + 1) + ' )') + '</u>');
        w.append(DT.el('div', { class: 'wsheet__q', html }));
      }
      else if (it.type === 'short') { w.append(md(it.q)); const f = figs(); if (f) w.append(f); w.append(line(v ? '답: ' + v : '')); }
      else if (it.type === 'choice') { w.append(md(it.q)); const f = figs(); if (f) w.append(f); w.append(DT.el('div', { class: 'wsheet__choices' }, (it.choices || []).map((c, k) => DT.el('span', { class: String(v) === String(k + 1) ? 'is-on' : '', html: '①②③④⑤'[k] + ' ' + DT.md(c) })))); }
      else if (it.type === 'ox') { w.append(md(it.q)); w.append(line(v ? '답: ' + v : '')); }
      else if (it.type === 'open') { w.append(md(it.q)); const f = figs(); if (f) w.append(f); if (it.sub) w.append(DT.el('div', { class: 'wsheet__q', html: it.sub.map((x, k) => '(' + (k + 1) + ') ' + DT.md(x)).join('　') })); const o = v || {}; w.append(line((o.text || '') + (o.ink && o.ink.length ? (o.text ? ' · ' : '') + '손글씨 풀이 있음' : ''))); }
      else if (it.type === 'group') { (it.prompts || []).forEach((p, k) => { w.append(md((k + 1) + '. ' + p)); w.append(line(((v || {}).text || [])[k] || '')); }); }
      else if (it.type === 'self') { const o = v || {}; w.append(DT.el('ul', { class: 'wsheet__crit' }, it.criteria.slice(0, 4).map((c) => DT.el('li', { html: DT.md(c.text) + ' — <b>' + (o[c.id] != null ? it.levels[o[c.id]] : '　') + '</b>' })))); }
      else if (it.type === 'reflect') { const o = v || {}; w.append(md(it.q), line(o.a || ''), md(it.q2), line(o.b || '')); }
      else if (it.type === 'career') { const o = v || {}; w.append(line([o.field, o.question].filter(Boolean).join(' · '))); }
      else if (it.type === 'roles') { const r = (it.roles || []).find((x) => x.id === v); w.append(line(r ? r.name : '')); }
      else if (it.type === 'peer') { w.append(line(v && Object.keys(v).length ? '친구 평가를 했어요' : '')); }
      return w;
    }
    async function submit() {
      const empty = items.filter((it) => it.type !== 'reflect' && it.type !== 'peer' && isEmpty(ans[it.id])).length;
      if (empty && !(await DT.confirm('제출할까요?', '아직 답하지 않은 문항이 ' + empty + '개 있어요. 그대로 제출할까요?', '그대로 제출'))) return;
      const g = DT.ws.gradeAll(a, ans, items);
      const sub = await DT.data.saveSubmission({ aid: a.id, key: S.me.key, no: S.me.no, name: S.me.name, classId: S.me.classId, answers: ans, results: g.results, score: g.score, startedAt: prev.startedAt || Date.now(), submittedAt: Date.now(), checked: false });
      const k = S.subs.findIndex((x) => x.aid === a.id); if (k >= 0) S.subs[k] = sub; else S.subs.push(sub);
      result(a);
    }
    paint();
  }
  const isEmpty = (v) => v == null || v === '' || (Array.isArray(v) && v.every((x) => !x)) || (typeof v === 'object' && !Array.isArray(v) && !Object.values(v).some((x) => x && (typeof x !== 'object' || Object.keys(x).length)));

  function renderItem(box, it, ans, save, a) {
    const q = (html) => DT.el('div', { class: 'item__q', html: DT.md(html) });
    const figsOf = (it) => { const w = DT.el('div', { class: 'item__figs' }); (it.figs || []).forEach((src) => { const im = DT.el('img', { alt: '교과서 그림', draggable: 'false' }); DT.data.asset(src).then((u) => { im.src = u; }); w.append(im); }); return w; };   /* 문제의 교과서 그림 */
    if (it.type === 'blank') {
      const val = ans[it.id] = ans[it.id] || it.answers.map(() => '');
      const text = DT.el('div', { class: 'blanktext', html: DT.md(it.x, { blank: true }) });
      const slots = DT.$$('.blank', text); let sel = val.findIndex((v) => !v); if (sel < 0) sel = 0;
      const bank = DT.el('div', { class: 'bank', role: 'group', 'aria-label': '낱말 고르기' });
      function paintSlots() {
        slots.forEach((sp, k) => { sp.className = 'slot' + (val[k] ? ' is-filled' : '') + (k === sel ? ' is-sel' : ''); sp.textContent = val[k] || '( ' + (k + 1) + ' )'; sp.setAttribute('role', 'button'); sp.tabIndex = 0; sp.onclick = () => { if (val[k]) { val[k] = ''; save(); } sel = k; paintSlots(); paintBank(); }; });
      }
      function paintBank() { bank.innerHTML = ''; it.bank.forEach((w) => { const used = val.includes(w); const b = DT.el('button', { type: 'button', class: used ? 'is-used' : '' }, w); b.onclick = () => { if (used) return; val[sel] = w; save(); const nx = val.findIndex((v) => !v); sel = nx < 0 ? sel : nx; paintSlots(); paintBank(); }; bank.append(b); }); }
      paintSlots(); paintBank();
      box.append(DT.el('div', { class: 'item__src' }, '빈칸을 누르고 아래 낱말을 고르세요. 다시 누르면 지워져요.'), text, bank);
    } else if (it.type === 'short') {
      box.append(q(it.q), figsOf(it));
      const inp = DT.el('input', { class: 'ans-input', type: 'text', inputmode: it.mode === 'num' ? 'decimal' : 'text', autocomplete: 'off', placeholder: '답을 적어요', value: ans[it.id] || '', 'aria-label': '답' });
      inp.addEventListener('input', () => { ans[it.id] = inp.value; save(); });
      const keys = DT.el('div', { class: 'mathkeys', 'aria-label': '수식 자판' });
      ['√', 'π', '²', '°', '−', '/', '(', ')', '×'].forEach((k) => keys.append(DT.el('button', { type: 'button', onclick: () => { const p = inp.selectionStart || inp.value.length; inp.value = inp.value.slice(0, p) + k + inp.value.slice(p); inp.focus(); inp.setSelectionRange(p + k.length, p + k.length); ans[it.id] = inp.value; save(); } }, k)));
      box.append(DT.el('div', { class: 'ans-row' }, inp), keys);
    } else if (it.type === 'choice') {
      box.append(q(it.q), figsOf(it)); const cs = DT.el('div', { class: 'choices' });
      (it.choices || []).forEach((c, k) => { const b = DT.el('button', { class: 'choice', type: 'button', 'aria-pressed': String(ans[it.id]) === String(k + 1) ? 'true' : 'false', html: '<b>' + '①②③④⑤'[k] + '</b><span>' + DT.md(c) + '</span>' }); b.onclick = () => { ans[it.id] = String(k + 1); save(); DT.$$('.choice', cs).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); }; cs.append(b); });
      box.append(cs);
    } else if (it.type === 'ox') {
      box.append(q(it.q), figsOf(it)); const w = DT.el('div', { class: 'ox' });
      ['O', 'X'].forEach((v) => { const b = DT.el('button', { type: 'button', 'aria-pressed': ans[it.id] === v ? 'true' : 'false', 'aria-label': v }, v); b.onclick = () => { ans[it.id] = v; save(); DT.$$('button', w).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); }; w.append(b); });
      box.append(w);
    } else if (it.type === 'open' || it.type === 'group') {
      const v = ans[it.id] = ans[it.id] || {};
      if (it.type === 'group') {
        const g = (a.groups || []).find((x) => x.includes(S.me.key));
        if (it.intro) box.append(q(it.intro));
        if (g) DT.data.getGroupNames(S.me.classId).then((nm) => box.insertBefore(DT.el('div', { class: 'members' }, DT.el('b', null, '우리 모둠'), g.map((k) => DT.el('span', null, nm[k] || (k === S.me.key ? S.me.name : '친구')))), box.children[1] || null));
        v.text = v.text || it.prompts.map(() => '');
        it.prompts.forEach((p, k) => { const t = DT.el('textarea', { class: 'textarea opentxt', placeholder: '모둠에서 이야기한 내용을 적어요', 'aria-label': DT.plain(p) }); t.value = v.text[k] || ''; t.oninput = () => { v.text[k] = t.value; save(); }; box.append(DT.el('label', { class: 'field' }, DT.el('span', { html: (k + 1) + '. ' + DT.md(p) }), t)); });
      } else {
        box.append(q(it.q), figsOf(it)); if (it.sub) box.append(DT.el('div', { html: it.sub.map(DT.md).join('&nbsp;&nbsp;&nbsp;') }));
        const t = DT.el('textarea', { class: 'textarea opentxt', placeholder: '풀이나 생각을 적어요 (아래 칸에 손으로 써도 돼요)', 'aria-label': '풀이' }); t.value = v.text || ''; t.oninput = () => { v.text = t.value; save(); };
        box.append(t);
      }
      if (it.draw) {
        const pad = DT.el('div', { class: 'pad' }); box.append(pad);
        setTimeout(() => {
          const w = Math.round(pad.clientWidth), h = Math.round(pad.clientHeight);
          const surf = new DT.ink.Surface(pad, w, h, { key: 'ans:' + it.id, load: () => v.ink || [], save: (st) => { v.ink = st; v.w = w; v.h = h; save(); } });
          const tools = DT.el('div', { class: 'pad__tools' });
          [['pen', 'pen', '펜'], ['eraser', 'eraser', '지우개'], ['hand', 'hand', '그리기 끄기']].forEach(([t, ic, l]) => { const b = DT.el('button', { type: 'button', 'aria-label': l, html: DT.icon(ic) }); b.onclick = () => DT.ink.set({ tool: t }); tools.append(b); });
          tools.append(DT.el('button', { type: 'button', 'aria-label': '되돌리기', html: DT.icon('undo'), onclick: () => surf.undo() }));
          pad.append(tools);
          const sync = () => DT.$$('button', tools).forEach((b, k) => k < 3 && b.setAttribute('aria-pressed', DT.ink.state.tool === ['pen', 'eraser', 'hand'][k] ? 'true' : 'false'));
          DT.ink.onState(sync); DT.ink.set({ tool: 'pen', color: '#17191B', size: 4 }); sync();
        }, 30);
      }
    } else if (it.type === 'roles') {
      box.append(q('모둠에서 내가 맡을 역할을 골라요.')); const w = DT.el('div', { class: 'roles' });
      it.roles.forEach((r) => { const b = DT.el('button', { class: 'role', type: 'button', 'aria-pressed': ans[it.id] === r.id ? 'true' : 'false' }, DT.el('b', null, r.name), DT.el('span', null, r.desc)); b.onclick = () => { ans[it.id] = r.id; save(); DT.$$('.role', w).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); }; w.append(b); });
      box.append(w);
    } else if (it.type === 'self') {
      const v = ans[it.id] = ans[it.id] || {};
      box.append(q('오늘 배운 내용을 스스로 점검해요. 솔직하게 고를수록 선생님이 더 잘 도와줄 수 있어요.'));
      const w = DT.el('div', { class: 'crit' });
      it.criteria.slice(0, 4).forEach((c) => { const seg = DT.el('div', { class: 'seg3' }); it.levels.forEach((l, k) => { const b = DT.el('button', { type: 'button', 'aria-pressed': v[c.id] === k ? 'true' : 'false' }, l); b.onclick = () => { v[c.id] = k; save(); DT.$$('button', seg).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); }; seg.append(b); }); w.append(DT.el('div', { class: 'crit__row' }, DT.el('span', { html: DT.md(c.text) }), seg)); });
      box.append(w);
    } else if (it.type === 'reflect') {
      const v = ans[it.id] = ans[it.id] || {};
      const t1 = DT.el('textarea', { class: 'textarea opentxt', placeholder: '예: 오늘 배운 성질을 내 말로 한 줄 정리' }); t1.value = v.a || ''; t1.oninput = () => { v.a = t1.value; save(); };
      const t2 = DT.el('textarea', { class: 'textarea opentxt', placeholder: '없으면 비워 두세요' }); t2.value = v.b || ''; t2.oninput = () => { v.b = t2.value; save(); };
      box.append(DT.el('label', { class: 'field' }, DT.el('span', null, it.q), t1), DT.el('label', { class: 'field' }, DT.el('span', null, it.q2), t2));
    } else if (it.type === 'peer') {
      const v = ans[it.id] = ans[it.id] || {};
      const g = (a.groups || []).find((x) => x.includes(S.me.key)) || [];
      const mates = g.filter((k) => k !== S.me.key);
      if (!mates.length) { box.append(DT.el('div', { class: 'empty' }, DT.el('b', null, '모둠이 아직 정해지지 않았어요'), DT.el('span', null, '선생님이 모둠을 정하면 여기에서 친구를 평가해요. 이 문항은 건너뛰어도 돼요.'))); return; }
      let mi = 0; const holder = DT.el('div', { class: 'crit' }); box.append(q('함께 활동한 친구를 평가해요. 친구 이름은 선생님만 봐요.'), holder);
      DT.data.getGroupNames(S.me.classId).then((nm) => {   /* 반 명단 대신 모둠원 이름만 받는다 */
        const ro = Object.keys(nm).map((k) => ({ key: k, name: nm[k] }));
        function pm() {
          holder.innerHTML = ''; const k = mates[mi]; const r = ro.find((x) => x.key === k) || { name: k }; const o = v[k] = v[k] || { scores: {}, comment: '' };
          holder.append(DT.el('div', { class: 'chips' }, mates.map((kk, j) => DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': j === mi ? 'true' : 'false', onclick: () => { mi = j; pm(); } }, (ro.find((x) => x.key === kk) || { name: kk }).name))));
          it.criteria.forEach((c) => { const seg = DT.el('div', { class: 'seg5' }); [1, 2, 3, 4, 5].forEach((n) => { const b = DT.el('button', { type: 'button', 'aria-pressed': o.scores[c.id] === n ? 'true' : 'false', 'aria-label': n + '점' }, String(n)); b.onclick = () => { o.scores[c.id] = n; save(); DT.$$('button', seg).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); }; seg.append(b); }); holder.append(DT.el('div', { class: 'crit__row' }, DT.el('span', null, r.name + ' — ' + c.text), seg)); });
          const t = DT.el('input', { class: 'input', placeholder: r.name + '에게 고마웠던 점 한 줄 (선택)', value: o.comment || '' }); t.oninput = () => { o.comment = t.value; save(); }; holder.append(t);
        }
        pm();
      });
    } else if (it.type === 'career') {
      const v = ans[it.id] = ans[it.id] || {};
      let stepN = v.field ? (v.rec != null ? 2 : 1) : 0;
      const holder = DT.el('div', { class: 'plan' }); box.append(holder);
      function pc() {
        holder.innerHTML = '';
        if (stepN === 0) {
          holder.append(q('관심 있는 진로 분야를 골라요. 오늘 배운 교과서 내용 중에서 그 분야와 이어지는 탐구 거리를 추천해 줄게요.'));
          const cs = DT.el('div', { class: 'chips' }); it.fields.forEach((f) => cs.append(DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': v.field === f ? 'true' : 'false', onclick: () => { v.field = f; save(); stepN = 1; pc(); } }, f))); holder.append(cs);
        } else if (stepN === 1) {
          const recs = DT.ws.recommend(it.recs, v.field).slice(0, 4);
          holder.append(DT.el('div', { class: 'item__label' }, DT.el('span', null, '추천 탐구 거리 · ' + v.field), DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => { stepN = 0; pc(); } }, '분야 바꾸기')));
          const w = DT.el('div', { class: 'recs' });
          recs.forEach((r) => w.append(DT.el('button', { class: 'rec', type: 'button', 'aria-pressed': v.rec === r.id ? 'true' : 'false', onclick: () => { v.rec = r.id; v.question = DT.plain(r.q || ''); v.link = DT.plain(r.from || '') + (r.page ? ' (교과서 ' + r.page + '쪽)' : ''); save(); stepN = 2; pc(); } }, DT.el('small', null, '교과서 ' + (r.page || '') + '쪽 · ' + DT.plain(r.from || '')), DT.el('b', { html: DT.md(r.idea) }), r.q ? DT.el('span', { html: '질문: ' + DT.md(r.q) }) : null)));
          w.append(DT.el('button', { class: 'rec', type: 'button', onclick: () => { v.rec = ''; v.question = ''; v.link = ''; save(); stepN = 2; pc(); } }, DT.el('small', null, '직접 생각하기'), DT.el('b', null, '내가 궁금한 것으로 탐구할래요'), DT.el('span', null, '오늘 배운 개념과 내 관심 분야를 이어 스스로 질문을 만들어요.')));
          holder.append(w);
        } else {
          holder.append(DT.el('div', { class: 'item__label' }, DT.el('span', null, '내 탐구 계획 · ' + v.field), DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => { stepN = 1; pc(); } }, '추천 다시 보기')));
          const f = (k, label, ph) => { const t = DT.el('textarea', { class: 'textarea', placeholder: ph, rows: 2 }); t.value = v[k] || ''; t.oninput = () => { v[k] = t.value; save(); }; return DT.el('label', { class: 'field' }, DT.el('span', null, label), t); };
          holder.append(f('question', '탐구 질문', '무엇이 궁금한가요?'), f('method', '어떻게 알아볼까', '자료 찾기, 실험, 계산, 인터뷰…'), f('link', '교과서와 이어지는 개념', '예: 오늘 배운 개념 이름 (교과서 쪽수)'));
        }
      }
      pc();
    }
  }

  /* ── 결과 ── */
  function result(a) {
    S.view = 'result';
    const s = mySub(a.id) || {}; const items = itemsFor(a);
    const m = shell(a.title, { back: home, backLabel: '목록으로' });
    const sc = s.score || { correct: 0, total: 0 };
    const leftC = DT.el('div', null);
    if (sc.total) leftC.append(DT.el('p', { class: 'result__big' }, DT.el('span', { class: 'num' }, sc.correct + '문항'), ' 맞았어요'), DT.el('p', null, '자동 채점한 ' + sc.total + '문항 중 ' + sc.correct + '문항을 맞혔어요.' + (sc.total - sc.correct ? ' 틀린 문항은 오답 노트에 담겼어요.' : '')));
    else leftC.append(DT.el('p', { class: 'result__big' }, '제출했어요'), DT.el('p', null, '선생님이 확인하고 피드백을 남기면 여기서 볼 수 있어요.'));
    if (s.overall) leftC.append(DT.el('div', { class: 'fb fb--note', style: { marginTop: '16px' } }, DT.el('b', null, '선생님: '), s.overall));
    const chips = DT.el('div', { class: 'rchips' }); const detail = DT.el('div', { style: { marginTop: '14px' } });
    items.forEach((it, k) => {
      const r = (s.results || {})[it.id]; const fbT = s.feedback && s.feedback[it.id];
      const mark = r ? (r.correct ? ['ok', '✓'] : ['bad', '✗']) : ['note', '✎'];
      const b = DT.el('button', { class: 'rchip', type: 'button', html: '<i class="' + mark[0] + '">' + mark[1] + '</i>' + DT.md(it.label || (k + 1) + '번') });
      b.onclick = () => { detail.innerHTML = ''; if (r && r.feedback) detail.append(DT.el('div', { class: 'fb ' + (r.correct ? 'fb--ok' : 'fb--bad'), html: DT.md(r.feedback) })); if (fbT) detail.append(DT.el('div', { class: 'fb fb--note', style: { marginTop: '8px' } }, '선생님: ' + (fbT.text || fbT))); if (!r && !fbT) detail.append(DT.el('div', { class: 'fb fb--note' }, '선생님이 확인 중이에요.')); };
      chips.append(b);
    });
    m.append(DT.el('div', { class: 'result' }, leftC, DT.el('div', null, chips, detail)));
    const foot = $('.st-foot'); foot.hidden = false; foot.innerHTML = '';
    foot.append(DT.el('button', { class: 'btn', type: 'button', html: DT.icon('list') + '내 학습지 한 장으로 보기 · 인쇄', onclick: () => run(a, null, { readOnly: true }) }), DT.el('span', { style: { flex: '1' } }), DT.el('button', { class: 'btn btn--ink', type: 'button', html: DT.icon('home') + '처음으로', onclick: home }));
  }

  /* ── 오답 노트 ── */
  function wrongItems() {
    const out = []; const fixed = DT.store.get('st.fixed.' + S.me.key, {});
    S.subs.filter((s) => s.submittedAt).forEach((s) => { const a = S.assignments.find((x) => x.id === s.aid); if (!a) return; itemsFor(a).forEach((it) => { const r = (s.results || {})[it.id]; if (r && r.correct === false && !fixed[it.id] && !out.find((o) => o.it.id === it.id)) out.push({ it, a, ans: (s.answers || {})[it.id] }); }); });
    return out;
  }
  function reviewWrong() {
    S.view = 'wrong'; const list = wrongItems(); let i = 0;
    function paint() {
      const m = shell('오답 노트', { back: home });
      if (!list.length) { m.append(DT.el('div', { class: 'empty' }, DT.el('b', null, '다시 풀 문제가 없어요'), DT.el('span', null, '틀린 문제가 생기면 여기에 모여요.'))); return; }
      const { it, a } = list[i]; const ans = {}; const box = DT.el('div', { class: 'item' });
      box.append(DT.el('div', { class: 'item__label' }, DT.el('span', { class: 'pill', html: DT.md(it.label || '문항') }), DT.el('span', { class: 'item__src num' }, (i + 1) + ' / ' + list.length + ' · ' + a.title + (it.src && it.src.page ? ' · 교과서 ' + it.src.page + '쪽' : ''))));
      renderItem(box, it, ans, () => {}, a);
      const fb = DT.el('div'); box.append(fb);
      m.append(DT.el('div', { class: 'runner' }, box));
      const foot = $('.st-foot'); foot.hidden = false; foot.innerHTML = '';
      foot.append(DT.el('button', { class: 'btn', type: 'button', disabled: i === 0, html: DT.icon('left') + '이전', onclick: () => { i--; paint(); } }), DT.el('span', { style: { flex: '1' } }),
        DT.el('button', { class: 'btn btn--ink', type: 'button', html: DT.icon('check') + '확인하기', onclick: () => { const r = DT.ws.grade(it, ans[it.id]); fb.innerHTML = ''; fb.append(DT.el('div', { class: 'fb ' + (r.correct ? 'fb--ok' : 'fb--bad'), html: r.correct ? '맞았어요. 오답 노트에서 빠져요.' : DT.md(r.feedback) })); if (r.correct) { const fx = DT.store.get('st.fixed.' + S.me.key, {}); fx[it.id] = Date.now(); DT.store.set('st.fixed.' + S.me.key, fx); if (DT.data.mode === 'firebase') DT.data.saveInk('stu_' + S.me.key, 'meta-fixed', fx).catch(() => {}); } } }),
        DT.el('button', { class: 'btn', type: 'button', disabled: i >= list.length - 1, html: '다음' + DT.icon('right'), onclick: () => { i++; paint(); } }));
    }
    paint();
  }

  /* ── 내 필기 (애플펜슬): 이 기기 + 내 계정에 저장 → 다른 아이패드에서도 그대로 ── */
  const myT = {};
  function myInk(key) {
    const lk = 'my.' + C.courseId + '.' + S.me.key + '.' + key; const sc = 'stu_' + S.me.key;
    return {
      load: () => DT.store.get(lk, []),
      save: (st) => { DT.store.set(lk, st); DT.store.set(lk + '.t', Date.now()); clearTimeout(myT[key]); myT[key] = setTimeout(() => DT.data.saveInk(sc, key, st).catch(() => {}), 1200); },
      /* 다른 기기에서 쓴 필기가 더 최근이면 그것으로 (계정에 저장된 시각 vs 이 기기에 저장한 시각) */
      async sync(surf) {
        if (DT.data.mode !== 'firebase' || !DT.data.getInkAt) return null;
        const r = await DT.data.getInkAt(sc, key).catch(() => null); if (!r) return null;
        if ((r.at || 0) > DT.store.get(lk + '.t', 0)) { DT.store.set(lk, r.st); DT.store.set(lk + '.t', r.at); if (surf) surf.set(r.st); return r.st; }
        return null;
      }
    };
  }
  const openBookMine = (n) => DT.book.open({ start: n, inkGet: (k) => myInk(k).load(), inkSave: (k, st) => myInk(k).save(st), inkSync: (k) => myInk(k).sync(null) });
  /* 오답 노트 '해결' 표시도 계정에 — 다른 아이패드에서 들어와도 같은 목록 */
  async function syncFixed() {
    if (DT.data.mode !== 'firebase') return;
    const k = 'st.fixed.' + S.me.key, sc = 'stu_' + S.me.key;
    const r = await DT.data.getInk(sc, 'meta-fixed').catch(() => null);
    const local = DT.store.get(k, {}); const merged = Object.assign({}, r && !Array.isArray(r) ? r : {}, local);
    DT.store.set(k, merged);
    if (Object.keys(merged).length > Object.keys(r && !Array.isArray(r) ? r : {}).length) DT.data.saveInk(sc, 'meta-fixed', merged).catch(() => {});
  }

  /* ── 지난 수업 다시 보기 ── */
  async function lessons() {
    S.view = 'lessons';
    const ls = (await DT.data.listLessons({ classId: S.me.classId })).filter((l) => l.screens && l.screens.length);
    const m = shell('지난 수업 다시 보기', { back: home });
    if (!ls.length) { m.append(DT.el('div', { class: 'empty' }, DT.el('b', null, '아직 저장된 수업이 없어요'), DT.el('span', null, '선생님이 수업을 마치면 그날 화면과 판서를 여기서 다시 볼 수 있어요.'))); return; }
    const w = DT.el('div', { class: 'wlist' });
    ls.slice(0, 6).forEach((l) => w.append(DT.el('button', { class: 'witem', type: 'button', onclick: () => replay(l) }, DT.el('b', null, DT.date(l.startedAt) + ' 수업'), DT.el('span', { class: 'state state--done' }, l.screens.length + '개 화면'), DT.el('small', null, l.screens.map((x) => x.title).slice(0, 3).join(', ') + (l.screens.length > 3 ? ' …' : '')))));
    m.append(DT.el('section', { class: 'panel', style: { flex: '1' } }, DT.el('div', { class: 'panel__h' }, DT.el('h2', null, '최근 수업')), w));
  }
  function replay(l) {
    const ids = l.screens.map((x) => x.id).filter((id) => S.tb._byId[id]); let i = 0;
    const m = shell(DT.date(l.startedAt) + ' 수업', { back: lessons });
    const stage = DT.el('div', { class: 'replay__stage' }); const inner = DT.el('div', { class: 'replay__inner' }); stage.append(inner);
    const nav = DT.el('div', { class: 'replay__nav' }); m.append(DT.el('div', { class: 'replay' }, stage, nav));
    let surf = null, mineS = null;
    const dock = DT.el('div', { class: 'replay__ink' }); stage.append(dock, DT.el('div', { class: 'replay__credit' }, DT.credit(S.tb))); DT.ink.toolbar(dock, {});
    function fit() { const k = Math.min(stage.clientWidth / 1640, stage.clientHeight / 860); inner.style.transform = 'translate(-50%,-50%) scale(' + k + ')'; }
    async function paint() {
      const s = S.tb._byId[ids[i]]; inner.innerHTML = '';
      const page = DT.render.screen(s, { interactive: false, revealAll: true, solAll: true }); page.style.setProperty('--base', '34px'); inner.append(page); DT.render.fit(page);
      const strokes = await DT.data.getInk(S.me.classId, 'screen:' + s.id).catch(() => null);
      if (surf) surf.destroy(); if (mineS) mineS.destroy();
      surf = new DT.ink.Surface(page, 1640 - 112, 860 - 80, { readOnly: true, load: () => strokes || [] });
      const io = myInk('replay:' + s.id); mineS = new DT.ink.Surface(page, 1640 - 112, 860 - 80, { key: 'replay:' + s.id, load: io.load, save: io.save }); io.sync(mineS);
      nav.innerHTML = '';
      nav.append(DT.el('button', { class: 'btn', type: 'button', disabled: i === 0, html: DT.icon('left'), 'aria-label': '이전', onclick: () => { i--; paint(); } }), DT.el('span', { class: 'grow num' }, (i + 1) + ' / ' + ids.length + ' · ' + DT.plain(s.title)));
      if (s.pages && s.pages.length) nav.append(DT.el('button', { class: 'btn', type: 'button', html: DT.icon('book') + '교과서 ' + s.pages[0] + '쪽', onclick: () => openBookMine(s.pages[0]) }));
      nav.append(DT.el('button', { class: 'btn btn--ink', type: 'button', disabled: i >= ids.length - 1, html: DT.icon('right'), 'aria-label': '다음', onclick: () => { i++; paint(); } }));
    }
    new ResizeObserver(fit).observe(stage); fit(); paint();
  }

  /* ── 내 기록 ── */
  function mine() {
    S.view = 'mine';
    const m = shell('내 기록', { back: home });
    const done = S.subs.filter((s) => s.submittedAt).sort((a, b) => a.submittedAt - b.submittedAt);
    const rates = done.filter((s) => s.score && s.score.total).map((s) => [s.submittedAt, s.score.correct / s.score.total]);
    const avg = rates.length ? rates.reduce((x, r) => x + r[1], 0) / rates.length : null;
    const total = S.assignments.filter((a) => itemsFor(a).length).length;
    const stat = DT.el('div', { class: 'stat' }, DT.el('div', null, DT.el('b', { class: 'num' }, done.length + '/' + total), DT.el('span', null, '제출한 학습지')), DT.el('div', null, DT.el('b', { class: 'num' }, DT.pct(avg)), DT.el('span', null, '평균 정답률')), DT.el('div', null, DT.el('b', { class: 'num' }, String(wrongItems().length)), DT.el('span', null, '오답 노트에 남은 문제')));
    const chart = DT.el('section', { class: 'panel' }, DT.el('div', { class: 'panel__h' }, DT.el('h2', null, '정답률 흐름')));
    const cb = DT.el('div', { class: 'chartbox' }); chart.append(cb);
    if (rates.length > 1) { const mc = DT.lab ? DT.lab.miniChart({ w: 520, h: 220, label: '정답률', xlabel: '제출 순서', ylabel: '정답률(%)' }) : null; if (mc) { mc.draw([{ pts: rates.map((r, k) => [k + 1, r[1] * 100]), color: '#2A78D6', width: 3 }, { pts: rates.map((r, k) => [k + 1, r[1] * 100]), color: '#2A78D6', dots: true }], { x0: 1, x1: Math.max(2, rates.length), y0: 0, y1: 100 }); cb.append(mc.el); } }
    else cb.append(DT.el('div', { class: 'empty' }, DT.el('span', null, '학습지를 두 번 이상 내면 흐름이 그려져요.')));
    const fbs = DT.el('section', { class: 'panel' }, DT.el('div', { class: 'panel__h' }, DT.el('h2', null, '받은 피드백')));
    const fl = DT.el('div', { class: 'fblist' }); fbs.append(fl);
    const all = []; done.forEach((s) => { const a = S.assignments.find((x) => x.id === s.aid); if (s.overall) all.push([s.checkedAt || s.submittedAt, s.overall, a ? a.title : '']); Object.entries(s.feedback || {}).forEach(([k, f]) => { if (k !== '_overall' && f && f.text) all.push([f.at || s.submittedAt, f.text, a ? a.title : '']); }); });
    if (!all.length) fl.append(DT.el('div', null, '아직 받은 피드백이 없어요.'));
    all.sort((x, y) => y[0] - x[0]).slice(0, 5).forEach((f) => fl.append(DT.el('div', null, DT.el('small', null, DT.date(f[0]) + ' · ' + f[2]), f[1])));
    m.append(DT.el('div', { class: 'mine' }, stat, chart, fbs));
  }

  /* ── 수업 중 (실시간) ── */
  function liveActive() { return S.live && S.live.active && Date.now() - (S.live.at || 0) < 3 * 3600 * 1000; }
  function paintLiveBar(keepFoot) {
    const foot = $('.st-foot'); if (!foot || !S.me || S.view === 'run' || S.view === 'wrong' || S.view === 'result') return;
    if (!liveActive()) { if (!keepFoot) foot.hidden = true; return; }
    foot.hidden = false; foot.innerHTML = '';
    const mine = DT.store.get('st.sig.' + S.live.screenId, null);
    const bar = DT.el('div', { class: 'livebar' }, DT.el('span', { class: 'livebar__now' }, '수업 중 · ', DT.el('b', null, S.live.title || '')));
    [['g', '알겠어요', 'var(--ok)'], ['y', '헷갈려요', '#E5A100'], ['r', '모르겠어요', 'var(--bad)']].forEach(([k, t, c]) => bar.append(DT.el('button', { class: 'sigbtn', type: 'button', 'aria-pressed': mine === k ? 'true' : 'false', html: '<i style="background:' + c + '"></i>' + t, onclick: async () => { DT.store.set('st.sig.' + S.live.screenId, k); await DT.data.sendSignal(S.me.classId, S.me.key, S.live.screenId, k); paintLiveBar(); DT.toast('선생님께 보냈어요.'); } })));
    bar.append(DT.el('button', { class: 'sigbtn', type: 'button', html: DT.icon('ask') + '질문하기', onclick: askQuestion }));
    foot.append(bar);
  }
  function askQuestion() {
    const t = DT.el('textarea', { class: 'textarea', placeholder: '이름 없이 선생님께 보내져요', 'aria-label': '질문' });
    DT.modal({ title: '선생님께 질문하기', body: t, actions: [{ label: '닫기' }, { label: '보내기', kind: 'ink', icon: 'send', onClick: async (c) => { if (!t.value.trim()) return; await DT.data.sendQuestion(S.me.classId, t.value.trim(), S.live && S.live.screenId); c(); DT.toast('질문을 보냈어요. 이름은 보이지 않아요.'); } }] });
  }
  let sheet = null, sheetQ = null;
  function onLive() {
    paintLiveBar();
    const q = S.live && S.live.question;
    if (!q || (!q.open && !q.reveal)) { if (sheet) { sheet.remove(); sheet = null; sheetQ = null; } return; }
    const answered = DT.store.get('st.lq.' + q.qid, null);
    if (sheet && sheetQ === q.qid + ':' + (q.reveal ? 1 : 0) + ':' + (q.open ? 1 : 0)) return;
    if (sheet) sheet.remove();
    sheetQ = q.qid + ':' + (q.reveal ? 1 : 0) + ':' + (q.open ? 1 : 0);
    sheet = DT.el('div', { class: 'livesheet', role: 'dialog', 'aria-label': '선생님 질문' });
    sheet.append(DT.el('h3', null, '선생님 질문' + (q.label ? ' · ' + q.label : '')), DT.el('div', { class: 'livesheet__q', html: DT.md(q.text) }));
    const send = async (v) => { DT.store.set('st.lq.' + q.qid, v); await DT.data.sendLiveAnswer(S.me.classId, q.qid, S.me.key, v); sheetQ = null; onLive(); };
    if (q.reveal) {
      const keys = (q.key || []).flatMap((k) => String(k).split('|')).map(DT.norm);
      const ok = answered != null && keys.includes(DT.norm(answered));
      sheet.append(DT.el('div', { class: 'fb ' + (answered == null ? 'fb--note' : ok ? 'fb--ok' : 'fb--bad') }, answered == null ? '정답이 공개됐어요.' : ok ? '맞았어요!' : '다시 생각해 봐요. 선생님 설명을 들어 보세요.'), DT.el('button', { class: 'btn', type: 'button', onclick: () => { sheet.remove(); sheet = null; } }, '닫기'));
    } else if (answered != null) {
      sheet.append(DT.el('div', { class: 'fb fb--note' }, '보냈어요. 다른 친구들이 답하는 동안 기다려요.'), DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => { DT.store.del('st.lq.' + q.qid); sheetQ = null; onLive(); } }, '답 고치기'));
    } else if (q.type === 'ox') {
      const w = DT.el('div', { class: 'ox' }); ['O', 'X'].forEach((v) => w.append(DT.el('button', { type: 'button', onclick: () => send(v) }, v))); sheet.append(w);
    } else if (q.type === 'choice') {
      const numOnly = (q.choices || []).every((c) => !String(c || '').trim()); const cs = DT.el('div', { class: 'choices' + (numOnly ? ' choices--num' : '') }); (q.choices || []).forEach((c, k) => cs.append(DT.el('button', { class: 'choice', type: 'button', html: '<b>' + '①②③④⑤'[k] + '</b><span>' + DT.md(c) + '</span>', onclick: () => send(String(k + 1)) }))); sheet.append(cs);
    } else {
      const inp = DT.el('input', { class: 'ans-input', placeholder: '답을 적어요', 'aria-label': '답' });
      sheet.append(DT.el('div', { class: 'ans-row' }, inp, DT.el('button', { class: 'btn btn--ink', type: 'button', html: DT.icon('send') + '보내기', onclick: () => inp.value.trim() && send(inp.value.trim()) })));
    }
    document.body.append(sheet);
  }

  addEventListener('resize', DT.debounce(() => { if (S.view === 'home') home(); }, 200));
  document.addEventListener('DOMContentLoaded', start);
})();

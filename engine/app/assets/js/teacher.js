/* 수업잇기 엔진 · teacher.js — 선생님 화면
   첫 화면은 '지금 확인할 것'. 메뉴: 홈 · 학습지 · 학생 · 성취기준 · 수업 일지 · 기록 내보내기 · 설정
   계산은 records.js, 그래프는 charts.js. 스크롤 없이: 길면 쪽으로 나눈다. */
(function () {
  'use strict';
  const DT = window.DT; const $ = DT.$; const C = DT.config;
  const T = { me: null, tb: null, classes: [], classId: null, roster: [], assignments: [], subs: [], obs: [], signals: [], lessons: [], view: 'home', aid: null, tab: 'result', page: {}, key: null };
  const ctx = () => ({ tb: T.tb, assignments: T.assignments, subs: T.subs, roster: T.roster, obs: T.obs, signals: T.signals });
  const cls = () => T.classes.find((c) => c.id === T.classId) || { name: '반 없음' };
  const nameOf = (key) => (T.roster.find((r) => r.key === key) || { name: key }).name;
  const view = () => $('#view');
  const NAV = [['home', 'home', '홈'], ['worksheets', 'list', '학습지'], ['students', 'users', '학생'], ['standards', 'target', '성취기준'], ['lessons', 'calendar', '수업 일지'], ['export', 'download', '기록 내보내기'], ['settings', 'gear', '설정']];
  const TAGS = ['질문', '발표', '도움', '끝까지', '자료', '3D 탐구', '집중 필요'];
  const FB = ['풀이 과정이 깔끔해요.', '핵심을 잘 짚었어요.', '교과서 예제를 다시 보고 고쳐 보세요.', '각을 어디서 재는지 다시 확인해요.', '한 단계만 더 설명을 써 보세요.', '모둠 친구들과 잘 협력했어요.'];

  /* ── 시작 ── */
  async function start() {
    try { await DT.data.init(); } catch (e) { return fatal('기록 저장소에 연결하지 못했어요. (' + e.message + ')'); }
    T.me = DT.data.user();
    if (DT.data.mode === 'firebase' && (!T.me || T.me.role !== 'teacher')) return login();
    if (T.me && T.me.viaBoard) return fatal('칠판 QR로 연 화면에서는 학생 기록을 볼 수 없어요. 기록은 선생님 휴대폰이나 PC에서 학교 계정으로 열어 주세요.');
    if (DT.qs().pair && DT.data.grantBoard) return pairBoard(DT.qs().pair);
    if (DT.data.mode === 'demo' && (!T.me || T.me.role !== 'teacher')) { T.me = { role: 'teacher', key: 'teacher', name: '선생님' }; await DT.data.signIn(T.me); }
    try { T.tb = DT.render.flatten(await DT.data.getCourse()); } catch (e) { T.tb = null; }
    if (T.tb) DT.applySubject(T.tb.meta.subject);
    T.classes = await DT.data.listClasses();
    [T.pending, T.join, T.joinOpen] = await Promise.all([DT.data.listPending().catch(() => []), DT.data.joinCode().catch(() => ''), DT.data.joinOpen().catch(() => null)]);
    T.classId = DT.store.get('t.class', null); if (!T.classes.find((c) => c.id === T.classId)) T.classId = T.classes[0] ? T.classes[0].id : null;
    const q = DT.qs(); if (q.v) T.view = q.v;
    await loadAll();
    route(T.tb ? T.view : 'settings');
  }
  /* 휴대폰으로 칠판 QR을 찍었을 때: 「이 칠판 열기」 한 번 */
  function pairBoard(uid) {
    $('#nav').innerHTML = ''; top('칠판 열기');
    const v = view(); v.innerHTML = '';
    const done = DT.el('div', { class: 'empty-c' }, DT.el('b', null, '칠판이 열렸어요'), DT.el('span', null, '이제 휴대폰은 닫아도 돼요. 칠판에서 반을 고르고 수업을 시작하세요.'));
    const btn = DT.el('button', { class: 'btn btn--ink', type: 'button', style: { justifySelf: 'center', minHeight: '56px', fontSize: '18px', padding: '0 28px' }, html: DT.icon('check') + '이 칠판 열기' });
    btn.onclick = async () => { btn.disabled = true; try { await DT.data.grantBoard(uid, 120); v.innerHTML = ''; v.append(done); } catch (e) { btn.disabled = false; DT.toast('열지 못했어요. 다시 눌러 주세요. (' + (e.code || e.message) + ')', 'bad'); } };
    v.append(DT.el('div', { class: 'empty-c' }, DT.el('b', null, T.me.email + ' 계정으로 칠판을 열까요?'), DT.el('span', null, '교실 칠판 화면에 띄운 QR을 찍은 경우에만 눌러 주세요. 한 번 열면 그 칠판은 한 학기 동안 바로 열려요.'), btn));
  }
  function fatal(msg) { view().innerHTML = ''; view().append(DT.el('div', { class: 'empty-c' }, DT.el('b', null, '열 수 없어요'), DT.el('span', null, msg))); }
  function login() {
    $('#nav').innerHTML = ''; top('선생님 로그인');
    const me = T.me;
    view().append(DT.el('div', { class: 'empty-c' }, DT.el('b', null, me ? me.email + ' 계정은 선생님 명단에 없어요' : '선생님 계정으로 로그인해 주세요'), DT.el('span', null, '설정한 선생님 구글 계정으로 들어오면 반 기록을 볼 수 있어요.'), DT.el('button', { class: 'btn btn--ink', type: 'button', style: { justifySelf: 'center', marginTop: '10px' }, html: DT.icon('user') + '구글 계정으로 로그인', onclick: async () => { await DT.data.signIn(); location.reload(); } })));
  }
  async function loadAll() {
    if (!T.classId) { T.roster = []; T.assignments = []; T.subs = []; T.obs = []; T.signals = []; T.lessons = []; return; }
    [T.roster, T.assignments, T.subs, T.obs, T.signals, T.lessons] = await Promise.all([
      DT.data.getRoster(T.classId), DT.data.listAssignments({ classId: T.classId }), DT.data.listSubmissions({ classId: T.classId }),
      DT.data.listObservations({ classId: T.classId }), DT.data.listSignals({ classId: T.classId }), DT.data.listLessons({ classId: T.classId })]);
  }
  function pendingChecks(aid) {
    return T.subs.filter((s) => s.submittedAt && !s.checked && (!aid || s.aid === aid)).filter((s) => { const a = T.assignments.find((x) => x.id === s.aid); return a && DT.rec.itemsFor(a, s.key).some((it) => DT.ws.needsTeacher(it)); });
  }

  /* ── 틀 ── */
  function navPaint() {
    const nav = $('#nav'); nav.innerHTML = '';
    nav.append(DT.el('div', { class: 'tc-brand' }, DT.el('b', null, T.tb ? DT.plain(T.tb.meta.course || T.tb.meta.title) : '수업잇기'), DT.el('span', null, '선생님 화면')));
    const n = pendingChecks().length;
    NAV.forEach(([id, ic, label]) => {
      const b = DT.el('button', { class: 'tc-nav__btn', type: 'button', title: label, 'aria-current': T.view === id || (id === 'students' && T.view === 'profile') ? 'page' : null, html: DT.icon(ic) + '<span>' + label + '</span>' + (id === 'worksheets' && n ? '<i class="badge num">' + n + '</i>' : '') + (id === 'settings' && T.pending && T.pending.length ? '<i class="badge num">' + T.pending.length + '</i>' : '') });
      b.onclick = () => route(id); nav.append(b);
    });
    nav.append(DT.el('div', { class: 'tc-nav__foot' },
      DT.el('a', { class: 'btn btn--sm', href: 'board.html' + (T.classId ? '#class=' + encodeURIComponent(T.classId) : ''), target: '_blank', rel: 'noopener', html: DT.icon('board') + '<span>전자칠판 열기</span>' }),
      DT.el('a', { class: 'btn btn--sm btn--ghost', href: 'labs.html', target: '_blank', rel: 'noopener', html: DT.icon('cube') + '<span>모형 모음</span>' })));
  }
  function top(title, extra) {
    const t = $('#top'); t.innerHTML = '';
    t.append(DT.el('h1', null, title));
    if (T.classes.length > 1) { const ch = DT.el('div', { class: 'chips' }); T.classes.forEach((c) => ch.append(DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': c.id === T.classId ? 'true' : 'false', onclick: async () => { T.classId = c.id; DT.store.set('t.class', c.id); T.aid = null; T.key = null; await loadAll(); route(T.view === 'profile' ? 'students' : T.view); } }, c.name))); t.append(ch); }
    if (extra) t.append(extra);
    if (T.tb && T.classId) t.append(DT.el('button', { class: 'btn btn--ink', type: 'button', html: DT.icon('send') + '학습지 보내기', onclick: () => sendWizard() }));
    view().innerHTML = '';
  }
  function route(v) {
    T.view = v; navPaint();
    history.replaceState(null, '', '#v=' + v);
    if (!T.classId && v !== 'settings') { top('시작하기'); view().append(DT.el('div', { class: 'empty-c' }, DT.el('b', null, '학생에게 QR을 보여 주세요'), DT.el('span', null, '설정 › 학생에게 링크 주기의 QR(또는 클래스룸 링크)로 학생이 로그인하면 반과 명단이 저절로 만들어져요.'), DT.el('button', { class: 'btn btn--ink', type: 'button', style: { justifySelf: 'center' }, onclick: () => route('settings') }, '설정으로 가기'))); return; }
    ({ home, worksheets, students, profile, standards, lessons, export: exportView, settings })[v]();
  }
  const pager = (key, total, per, rerender) => {
    const pages = Math.max(1, Math.ceil(total / per)); const p = T.page[key] = DT.clamp(T.page[key] || 0, 0, pages - 1);
    if (pages < 2) return DT.el('span');
    return DT.el('span', { class: 'pager' }, DT.el('button', { class: 'icon-btn', type: 'button', 'aria-label': '앞쪽', disabled: p === 0, html: DT.icon('left'), onclick: () => { T.page[key]--; rerender(); } }), DT.el('span', { class: 'num' }, (p + 1) + ' / ' + pages), DT.el('button', { class: 'icon-btn', type: 'button', 'aria-label': '다음 쪽', disabled: p >= pages - 1, html: DT.icon('right'), onclick: () => { T.page[key]++; rerender(); } }));
  };
  const card = (title, sub, ...kids) => DT.el('section', { class: 'card' }, DT.el('div', { class: 'card__h' }, DT.el('h2', null, title), sub || null), ...kids);
  const rateOf = (aid) => { const r = T.subs.filter((s) => s.aid === aid && s.submittedAt && s.score && s.score.total).map((s) => s.score.correct / s.score.total); return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null; };
  const subN = (aid) => T.subs.filter((s) => s.aid === aid && s.submittedAt).length;
  const targetN = (a) => (a.perStudent ? Object.values(a.perStudent).filter((x) => x.length).length : T.roster.length);

  /* ── 홈: 지금 확인할 것 ── */
  function home() {
    top(cls().name + ' · 지금 확인할 것');
    const g = DT.el('div', { class: 'home-grid' });
    const pend = pendingChecks();
    const c1 = DT.el('section', { class: 'card card--focus' });
    c1.append(DT.el('div', { class: 'todo' }, DT.el('div', { class: 'big num' }, String(pend.length), DT.el('small', null, '명')),
      DT.el('p', null, pend.length ? DT.el('b', null, '서술형·모둠·진로 답이 선생님 확인을 기다려요. ') : DT.el('b', null, '확인할 답이 없어요. '), '빈칸·문제처럼 자동 채점되는 문항은 이미 학생에게 피드백이 갔어요.'),
      pend.length ? DT.el('button', { class: 'btn btn--ink', type: 'button', html: '확인하러 가기' + DT.icon('right'), onclick: () => { T.aid = pend[0].aid; T.tab = 'check'; route('worksheets'); } }) : DT.el('span')));
    const weak = DT.rec.weakSpots(ctx(), T.classId).slice(0, 3);
    const c2 = card('다음 수업에 반영할 곳', DT.el('span', { class: 'sub' }, '정답률 + 이해도 신호'));
    const wl = DT.el('div', { class: 'weak' });
    if (!weak.length) wl.append(DT.el('div', { class: 'empty-c' }, DT.el('span', null, '학습지 결과가 쌓이면 어려워한 개념이 여기 나와요.')));
    weak.forEach((w) => wl.append(DT.el('div', { class: 'weak__row' }, DT.el('b', null, DT.plain(w.s.title)), DT.el('span', null, (w.acc != null ? '정답률 ' + Math.round(w.acc * 100) + '%' : '학습지 문항 없음') + (w.conf != null ? ' · 헷갈림·모름 ' + Math.round(w.conf * 100) + '%' : '') + ' · 교과서 ' + ((w.s.pages || [])[0] || '') + '쪽'),
      DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('send') + '복습 보내기', onclick: () => sendReview([w.s.id]) }))));
    c2.append(wl);
    const recent = T.assignments.slice(0, 5);
    const c3 = card('최근 학습지', DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: () => route('worksheets') }, '모두 보기'));
    const al = DT.el('div', { class: 'alist' });
    if (!recent.length) al.append(DT.el('div', { class: 'empty-c' }, DT.el('b', null, '아직 보낸 학습지가 없어요'), DT.el('span', null, '위의 「학습지 보내기」나 전자칠판의 수업 도구에서 보낼 수 있어요.')));
    recent.forEach((a) => { const r = rateOf(a.id); al.append(DT.el('button', { class: 'arow', type: 'button', onclick: () => { T.aid = a.id; T.tab = 'result'; route('worksheets'); } }, DT.el('span', null, DT.el('b', null, a.title), DT.el('small', null, DT.date(a.createdAt) + ' · 제출 ' + subN(a.id) + '/' + targetN(a))), DT.el('span', { class: 'mini', 'aria-hidden': 'true' }, DT.el('i', { style: { width: (r == null ? 0 : r * 100) + '%' } })), DT.el('span', { class: 'pct num' }, DT.pct(r)))); });
    c3.append(al);
    const c4 = card('살펴볼 학생', DT.el('span', { class: 'sub' }, '누르면 누적 기록'));
    const ppl = DT.el('div', { class: 'people' }); const flagged = studentFlags();
    if (!flagged.length) ppl.append(DT.el('div', { class: 'empty-c' }, DT.el('span', null, '눈에 띄는 변화가 있는 학생이 없어요.')));
    flagged.slice(0, 6).forEach((f) => ppl.append(DT.el('button', { class: 'person', type: 'button', onclick: () => { T.key = f.r.key; route('profile'); } }, DT.el('b', null, f.r.name), DT.el('span', null, f.why))));
    c4.append(ppl);
    c1.style.gridArea = 'a'; c2.style.gridArea = 'b'; c3.style.gridArea = 'c'; c4.style.gridArea = 'd';
    g.append(c1, c2, c3, c4);
    view().append(g);
  }
  function studentFlags() {
    const recent = T.assignments.filter((a) => !a.perStudent).slice(0, 2);
    const out = [];
    T.roster.forEach((r) => {
      const p = DT.rec.profile(r.key, ctx());
      const miss = recent.filter((a) => !T.subs.find((s) => s.aid === a.id && s.key === r.key && s.submittedAt)).length;
      if (recent.length >= 2 && miss === 2) out.push({ r, why: '최근 학습지 2개를 내지 않았어요', w: 3 });
      else if (p.last != null && p.avg != null && p.last - p.avg < -0.25) out.push({ r, why: '최근 정답률이 평소보다 크게 낮아요 (' + DT.pct(p.last) + ')', w: 2 });
      else if (p.last != null && p.first != null && p.last - p.first > 0.3) out.push({ r, why: '정답률이 많이 올랐어요 ' + DT.pct(p.first) + ' → ' + DT.pct(p.last), w: 1 });
      if (p.signals.r >= 3) out.push({ r, why: '수업 중 「모르겠어요」 신호 ' + p.signals.r + '번', w: 1.5 });
    });
    const merged = {}; out.forEach((o) => { const m = merged[o.r.key]; if (!m) merged[o.r.key] = Object.assign({}, o); else { m.why += ' · ' + o.why; m.w += o.w * 0.5; } });
    return Object.values(merged).sort((a, b) => b.w - a.w);
  }

  /* ── 학습지 ── */
  function worksheets() {
    top('학습지');
    if (!T.assignments.length) { view().append(DT.el('div', { class: 'empty-c' }, DT.el('b', null, '아직 보낸 학습지가 없어요'), DT.el('span', null, '오른쪽 위 「학습지 보내기」를 눌러 범위와 종류만 고르면 교과서 내용으로 바로 만들어져요.'))); return; }
    if (!T.aid || !T.assignments.find((a) => a.id === T.aid)) T.aid = T.assignments[0].id;
    const wrap = DT.el('div', { class: 'as-wrap' });
    const list = DT.el('div', { class: 'as-list' });
    const per = Math.max(4, Math.floor((innerHeight - 200) / 70));
    const pg = pager('as', T.assignments.length, per, worksheets);
    T.assignments.slice((T.page.as || 0) * per, (T.page.as || 0) * per + per).forEach((a) => {
      const pn = pendingChecks(a.id).length;
      list.append(DT.el('button', { class: 'as-item', type: 'button', 'aria-current': a.id === T.aid ? 'true' : 'false', onclick: () => { T.aid = a.id; T.tab = 'result'; worksheets(); } }, DT.el('b', null, a.title), DT.el('small', null, DT.date(a.createdAt) + ' · ' + DT.ws.kindName(a.kind) + ' · 제출 ' + subN(a.id) + '/' + targetN(a) + (pn ? ' · 확인 ' + pn : ''))));
    });
    list.append(pg);
    wrap.append(list, detail(T.assignments.find((a) => a.id === T.aid)));
    view().append(wrap);
  }
  function detail(a) {
    const d = DT.el('div', { class: 'as-detail' });
    const subs = T.subs.filter((s) => s.aid === a.id);
    const targets = a.perStudent ? T.roster.filter((r) => (a.perStudent[r.key] || []).length) : T.roster;
    const sum = DT.calc.summarize(a, subs, targets);
    const pend = pendingChecks(a.id);
    d.append(DT.el('div', { class: 'kpis' },
      DT.el('div', { class: 'kpi' }, DT.el('b', { class: 'num' }, sum.submitted + '/' + sum.total), DT.el('span', null, '제출')),
      DT.el('div', { class: 'kpi' }, DT.el('b', { class: 'num' }, DT.pct(sum.avg)), DT.el('span', null, '평균 정답률 (자동 채점)')),
      DT.el('div', { class: 'kpi' }, DT.el('b', { class: 'num' }, String(pend.length)), DT.el('span', null, '선생님 확인 기다림')),
      DT.el('div', { class: 'kpi' }, DT.el('b', { class: 'num', style: { fontSize: '22px', paddingTop: '6px' } }, a.due ? DT.date(a.due) : '–'), DT.el('span', null, a.status === 'closed' ? '마감함' : '마감일'))));
    const tabs = DT.el('div', { class: 'tabs', role: 'tablist' });
    [['result', '전체 결과'], ['check', '답 확인하기', pend.length], ['missing', '안 낸 학생', sum.missing.length]].forEach(([id, t, n]) => tabs.append(DT.el('button', { type: 'button', role: 'tab', 'aria-selected': T.tab === id ? 'true' : 'false', html: t + (n ? '<i class="badge num">' + n + '</i>' : ''), onclick: () => { T.tab = id; worksheets(); } })));
    const acts = DT.el('div', { class: 'row' }, tabs, DT.el('span', { class: 'grow' }),
      DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('refresh') + '틀린 학생에게 복습', onclick: () => sendReview(a.scope) }),
      DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('download') + '엑셀(CSV)', onclick: () => csvOf(a, subs) }),
      a.items && a.items.length ? DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('print') + '인쇄', onclick: () => DT.ws.print(a, cls().name) }) : null,
      DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: async () => { await DT.data.updateAssignment(a.id, { status: a.status === 'closed' ? 'open' : 'closed' }); a.status = a.status === 'closed' ? 'open' : 'closed'; worksheets(); } }, a.status === 'closed' ? '다시 열기' : '마감하기'));
    d.append(acts);
    if (T.tab === 'check') d.append(checkPanel(a, pend));
    else if (T.tab === 'missing') d.append(missingPanel(sum.missing));
    else d.append(resultPanel(a, subs, sum, targets));
    return d;
  }
  function resultPanel(a, subs, sum, targets) {
    const p = DT.el('div', { class: 'tabpanel res-grid' });
    const auto = sum.perItem.filter((x) => DT.ws.autoGraded(x.item));
    const left = card('문항별 정답률', DT.el('span', { class: 'sub' }, '누르면 많이 나온 오답'));
    const wrongBox = DT.el('div', { class: 'wrongs' });
    const carIt = (a.items || []).find((it) => it.type === 'career');
    if (!auto.length && carIt) {
      left.querySelector('h2').textContent = '고른 진로 분야'; left.querySelector('.sub').textContent = '학생 수';
      const cnt = {}; subs.filter((x) => x.submittedAt).forEach((x) => { const v = (x.answers || {})[carIt.id]; if (v && v.field) cnt[v.field] = (cnt[v.field] || 0) + 1; });
      const tot = Object.values(cnt).reduce((x, y) => x + y, 0) || 1;
      left.append(DT.chart.hbars(Object.entries(cnt).sort((x, y) => y[1] - x[1]).map(([f, n]) => ({ label: f, value: n / tot, tip: f + ' ' + n + '명' })), { warnBelow: -1 }));
    } else if (!auto.length) left.append(DT.el('div', { class: 'empty-c' }, DT.el('span', null, '자동 채점 문항이 없는 학습지예요. 「답 확인하기」에서 한 명씩 봐 주세요.')));
    else left.append(DT.chart.hbars(auto.map((x, i) => ({ label: (i + 1) + '. ' + (x.item.label || ''), value: x.rate, tip: (x.item.label || '') + ' · ' + x.ok + '/' + x.n + '명 정답', onClick: () => { wrongBox.innerHTML = ''; wrongBox.append(DT.el('div', null, DT.el('span', null, (x.item.label || '') + ' 많이 나온 오답:'))); if (!x.wrong.length) wrongBox.append(DT.el('div', null, '틀린 학생이 없어요.')); x.wrong.slice(0, 4).forEach(([ans, n]) => wrongBox.append(DT.el('div', null, DT.el('b', { class: 'num' }, n + '명'), DT.el('span', null, ans)))); } }))), wrongBox);
    const right = card('학생 × 문항', DT.el('span', { class: 'sub' }, '○ 맞음 · ✕ 틀림 · ✎ 서술형'));
    const items = a.perStudent ? [] : a.items;
    if (a.perStudent) right.append(DT.el('div', { class: 'empty-c' }, DT.el('span', null, '복습 학습지는 학생마다 문항이 달라요. 「답 확인하기」에서 한 명씩 볼 수 있어요.')));
    else {
      const per = Math.max(8, Math.floor((innerHeight - 330) / 25));
      const rows = targets.slice((T.page.grid || 0) * per, (T.page.grid || 0) * per + per).map((r) => { const s = subs.find((x) => x.key === r.key && x.submittedAt); return { name: r.name, cells: items.map((it) => (!s ? null : DT.ws.autoGraded(it) ? ((s.results || {})[it.id] || {}).correct : 'note')), onClick: () => s && openAnswer(a, s) }; });
      right.querySelector('.card__h').append(pager('grid', targets.length, per, worksheets));
      right.append(DT.chart.grid(items.map((it) => it.label || ''), rows));
    }
    p.append(left, right);
    return p;
  }
  function missingPanel(missing) {
    const c = card('아직 안 낸 학생 ' + missing.length + '명', DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('copy') + '이름 복사', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(missing.map((r) => r.no + ' ' + r.name).join('\n')); DT.toast('이름을 복사했어요. 메신저에 붙여 넣으세요.'); } }));
    c.append(missing.length ? DT.el('div', { class: 'chips' }, missing.map((r) => DT.el('button', { class: 'chip', type: 'button', onclick: () => { T.key = r.key; route('profile'); } }, r.no + ' ' + r.name))) : DT.el('div', { class: 'empty-c' }, DT.el('b', null, '모두 냈어요')));
    return DT.el('div', { class: 'tabpanel' }, c);
  }
  /* 한 명씩 답 확인 */
  function checkPanel(a, pend) {
    const wrap = DT.el('div', { class: 'check' });
    if (!pend.length) { wrap.append(DT.el('div', { class: 'empty-c', style: { gridColumn: '1 / -1' } }, DT.el('b', null, '이 학습지는 모두 확인했어요'), DT.el('span', null, '학생 이름을 눌러 다시 볼 수도 있어요 (전체 결과 › 칸 누르기).'))); return wrap; }
    let i = DT.clamp(T.page.chk || 0, 0, pend.length - 1); const s = pend[i];
    const left = DT.el('div', { class: 'check__ans' });
    left.append(DT.el('div', { class: 'row' }, DT.el('b', { style: { fontSize: '19px' } }, s.name + ' · ' + s.no), DT.el('span', { class: 'muted num' }, (i + 1) + ' / ' + pend.length + '명'), DT.el('span', { class: 'grow' }), DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button', disabled: i === 0, html: DT.icon('left') + '이전 학생', onclick: () => { T.page.chk = i - 1; worksheets(); } })));
    DT.rec.itemsFor(a, s.key).forEach((it) => { if (DT.ws.needsTeacher(it) || it.type === 'self') left.append(answerBox(it, (s.answers || {})[it.id], s)); });
    const sc = s.score || {}; if (sc.total) left.append(DT.el('div', { class: 'muted' }, '자동 채점 ' + sc.correct + '/' + sc.total + ' — 피드백이 이미 학생에게 갔어요.'));
    const right = card('피드백', null);
    const ta = DT.el('textarea', { class: 'textarea', placeholder: '학생에게 보일 한마디 (비워도 돼요)' }); ta.value = s.overall || '';
    right.append(DT.el('div', { class: 'fbchips' }, FB.map((f) => DT.el('button', { type: 'button', onclick: () => { ta.value = (ta.value ? ta.value + ' ' : '') + f; } }, f))), ta);
    right.append(DT.el('div', { class: 'field' }, DT.el('span', null, '관찰 기록 남기기 (생기부·담임 공유에 쓰여요)'), DT.el('div', { class: 'obs-add' }, TAGS.map((t) => DT.el('button', { type: 'button', onclick: async (e) => { await DT.data.addObservation({ key: s.key, classId: T.classId, tag: t, note: a.title + '에서 ' + t, by: 'check' }); T.obs = await DT.data.listObservations({ classId: T.classId }); e.target.style.borderStyle = 'solid'; e.target.style.color = 'var(--ink)'; DT.toast(s.name + ' · ' + t + ' 기록'); } }, '+ ' + t)))));
    const done = DT.el('button', { class: 'btn btn--ink', type: 'button', html: DT.icon('check') + '확인 완료 · 다음 학생' });
    done.onclick = async () => { await DT.data.saveFeedback(a.id, s.key, { overall: ta.value.trim(), checked: true }); s.checked = true; s.overall = ta.value.trim(); T.page.chk = i; worksheets(); DT.toast(s.name + ' 확인 완료'); };
    right.append(DT.el('span', { class: 'grow' }), done);
    wrap.append(left, right);
    return wrap;
  }
  function answerBox(it, v, s) {
    const b = DT.el('div', { class: 'ansbox' }, DT.el('h4', { html: DT.md(it.label || '문항') }));
    if (!v) { b.append(DT.el('p', { class: 'muted' }, '답하지 않음')); return b; }
    if (it.type === 'open') { if (v.text) b.append(DT.el('p', null, v.text)); if (v.ink && v.ink.length) b.append(inkPreview(v)); if (!v.text && !(v.ink || []).length) b.append(DT.el('p', { class: 'muted' }, '빈칸')); }
    else if (it.type === 'group') { (it.prompts || []).forEach((pp, k) => b.append(DT.el('p', null, DT.el('b', null, (k + 1) + '. '), (v.text || [])[k] || '–'))); if (v.ink && v.ink.length) b.append(inkPreview(v)); }
    else if (it.type === 'reflect') { b.append(DT.el('p', null, v.a || '–')); if (v.b) b.append(DT.el('p', { class: 'muted' }, '궁금한 것: ' + v.b)); }
    else if (it.type === 'career') b.append(DT.el('p', null, DT.el('b', null, v.field || ''), ' — ' + (v.question || '')), DT.el('p', { class: 'muted' }, (v.method || '') + (v.link ? ' · ' + v.link : '')));
    else if (it.type === 'self') it.criteria.forEach((c) => b.append(DT.el('p', null, DT.plain(c.text) + ' — ', DT.el('b', null, v[c.id] != null ? DT.ws.levels[v[c.id]] : '–'))));
    return b;
  }
  function inkPreview(v) {
    const cv = DT.el('canvas'); const w = v.w || 600, h = v.h || 300; cv.width = w; cv.height = h; const g = cv.getContext('2d');
    (v.ink || []).forEach((s) => { const p = s.p; g.strokeStyle = s.c; g.lineWidth = s.s; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); });
    return cv;
  }
  function openAnswer(a, s) {
    const box = DT.el('div', { style: { display: 'grid', gap: '10px' } });
    DT.rec.itemsFor(a, s.key).forEach((it) => {
      const v = (s.answers || {})[it.id]; const r = (s.results || {})[it.id];
      if (DT.ws.autoGraded(it)) box.append(DT.el('div', { class: 'ansbox' }, DT.el('h4', { html: DT.md(it.label || '') + (r ? (r.correct ? ' · 맞음' : ' · 틀림') : '') }), DT.el('p', null, Array.isArray(v) ? v.join(', ') : it.type === 'choice' && v != null ? '①②③④⑤'[+v - 1] || v : String(v == null ? '–' : v))));
      else box.append(answerBox(it, v, s));
    });
    DT.modal({ title: s.name + ' · ' + a.title, body: box, wide: true, actions: [{ label: '닫기' }, { label: '누적 기록 보기', kind: 'ink', onClick: (c) => { c(); T.key = s.key; route('profile'); } }] });
  }
  function csvOf(a, subs) {
    const items = a.items || [];
    const rows = [['학번', '이름', '제출 시각', '정답', '채점 문항'].concat(items.map((it, i) => (i + 1) + '. ' + (it.label || '')))];
    T.roster.forEach((r) => { const s = subs.find((x) => x.key === r.key); const sc = (s && s.score) || {}; rows.push([r.no, r.name, s && s.submittedAt ? DT.date(s.submittedAt) + ' ' + DT.time(s.submittedAt) : '안 냄', sc.correct == null ? '' : sc.correct, sc.total || ''].concat(items.map((it) => { if (!s) return ''; const v = (s.answers || {})[it.id]; const res = (s.results || {})[it.id]; return res ? (res.correct ? 'O' : 'X') : v == null ? '' : typeof v === 'object' ? DT.plain(JSON.stringify(v)).slice(0, 120) : v; }))); });
    DT.download(a.title.replace(/[\\/:*?"<>|]/g, '_') + '.csv', DT.csv(rows), 'text/csv;charset=utf-8');
  }

  /* ── 학습지 보내기 (교과서 범위 → 종류 → 반·기한) ── */
  function sendWizard(preset) {
    preset = preset || {};
    const subs = T.tb._subunits; let sub = subs.find((u) => preset.scope && u.screens.some((s) => preset.scope.includes(s.id))) || subs[0];
    let picked = new Set(preset.scope || sub.screens.map((s) => s.id)); let kind = preset.kind || 'exit'; let due = 'tomorrow';
    const box = DT.el('div', { class: 'wiz' });
    const subSel = DT.el('select', { class: 'select', 'aria-label': '소단원' });
    subs.forEach((u) => subSel.append(DT.el('option', { value: u.id, selected: u === sub ? true : null }, (u.no ? u.no + ' ' : '') + DT.plain(u.title))));
    const scope = DT.el('div', { class: 'wiz__scope' }); const kinds = DT.el('div', { class: 'chips' }); const dues = DT.el('div', { class: 'chips' }); const prev = DT.el('div', { class: 'wiz__prev' });
    function paintScope() { scope.innerHTML = ''; sub.screens.forEach((s) => scope.append(DT.el('button', { class: 'wiz__sc', type: 'button', 'aria-pressed': picked.has(s.id) ? 'true' : 'false', onclick: (e) => { picked.has(s.id) ? picked.delete(s.id) : picked.add(s.id); e.currentTarget.setAttribute('aria-pressed', picked.has(s.id) ? 'true' : 'false'); paintPrev(); } }, DT.plain(s.chip || s.title), DT.el('small', null, DT.render.pagesLabel(s.pages))))); }
    subSel.onchange = () => { sub = subs.find((u) => u.id === subSel.value); picked = new Set(sub.screens.map((s) => s.id)); paintScope(); paintPrev(); };
    DT.ws.kinds.forEach((k) => kinds.append(DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': k.id === kind ? 'true' : 'false', title: k.desc, html: DT.icon(k.icon) + k.name + (k.rec ? ' <small style="opacity:.7">추천</small>' : ''), onclick: (e) => { kind = k.id; DT.$$('.chip', kinds).forEach((x) => x.setAttribute('aria-pressed', x === e.currentTarget ? 'true' : 'false')); paintPrev(); } })));
    [['today', '오늘까지'], ['tomorrow', '내일까지'], ['week', '일주일 뒤까지']].forEach(([v, t]) => dues.append(DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': v === due ? 'true' : 'false', onclick: (e) => { due = v; DT.$$('.chip', dues).forEach((x) => x.setAttribute('aria-pressed', x === e.currentTarget ? 'true' : 'false')); } }, t)));
    function paintPrev() { const w = DT.ws.build(T.tb, [...picked], kind); prev.innerHTML = w.items.length ? '<b style="color:var(--ink)">' + w.items.length + '문항</b>이 교과서 내용으로 만들어져요 — ' + DT.esc(w.items.slice(0, 5).map((i) => DT.plain(i.label)).join(', ')) + (w.items.length > 5 ? ' …' : '') : '고른 범위에는 이 종류로 만들 내용이 없어요. 범위를 넓히거나 다른 종류를 골라 주세요.'; }
    const f = (t, n) => DT.el('div', { class: 'field' }, DT.el('span', null, t), n);
    box.append(f('1. 교과서 범위', DT.el('div', { style: { display: 'grid', gap: '8px' } }, subSel, scope)), f('2. 무엇을', kinds), f('3. ' + cls().name + ' · 언제까지', dues), prev);
    paintScope(); paintPrev();
    const dueTime = () => { const d = new Date(); if (due === 'tomorrow') d.setDate(d.getDate() + 1); if (due === 'week') d.setDate(d.getDate() + 7); d.setHours(23, 59, 0, 0); return d.getTime(); };
    async function sendW(w, close) {
      if (!w.items.length) return DT.toast('문항이 없어요.', 'bad');
      if (w.items.some((it) => it.type === 'group') && !w.groups) w.groups = await DT.data.getGroups(T.classId);
      await DT.data.createAssignment(Object.assign(w, { classId: T.classId, courseId: C.courseId, due: dueTime() }));
      close(); await loadAll(); T.aid = T.assignments[0] && T.assignments[0].id; T.tab = 'result'; route('worksheets'); DT.toast(cls().name + '에 보냈어요. 학생 화면에 바로 나타나요.');
    }
    /* 직접 만들기·고치기: 자동으로 만든 것에서 시작해 빈칸·순서·문제를 바꾼다 */
    function editW(close0) {
      const w = DT.ws.build(T.tb, [...picked], kind); w.kind = 'custom';
      const pool = DT.ws.pool(T.tb, [...picked]);
      close0();
      DT.modal({ title: '학습지 직접 만들기', body: DT.ws.editor(w, pool), wide: true, cls: 'modal--tall modal--xl', sticky: true, actions: [{ label: '닫기' },
        { label: '미리 보기', icon: 'eye', onClick: () => (w.items.length ? DT.ws.openPreview(w) : DT.toast('문항이 없어요.', 'bad')) },
        { label: '인쇄', icon: 'print', onClick: () => (w.items.length ? DT.ws.print(w, cls().name) : DT.toast('문항이 없어요.', 'bad')) },
        { label: cls().name + '에 보내기', kind: 'ink', icon: 'send', onClick: (close) => sendW(w, close) }] });
    }
    DT.modal({ title: '학습지 보내기', body: box, wide: true, actions: [{ label: '닫기' }, { label: '미리 보기', icon: 'eye', onClick: () => { const w = DT.ws.build(T.tb, [...picked], kind); if (!w.items.length) return DT.toast('만들 문항이 없어요.', 'bad'); DT.ws.openPreview(w); } },
      { label: '인쇄', icon: 'print', onClick: () => { const w = DT.ws.build(T.tb, [...picked], kind); if (!w.items.length) return DT.toast('만들 문항이 없어요.', 'bad'); DT.ws.print(w, cls().name); } },
      { label: '직접 만들기·고치기', icon: 'pencil', onClick: (close) => editW(close) },
      { label: cls().name + '에 보내기', kind: 'ink', icon: 'send', onClick: async (close) => {
      const w = DT.ws.build(T.tb, [...picked], kind); if (!w.items.length) return DT.toast('만들 문항이 없어요.', 'bad');
      const d = new Date(); if (due === 'tomorrow') d.setDate(d.getDate() + 1); if (due === 'week') d.setDate(d.getDate() + 7); d.setHours(23, 59, 0, 0);
      if (kind === 'group') w.groups = await DT.data.getGroups(T.classId);
      await DT.data.createAssignment(Object.assign(w, { classId: T.classId, courseId: C.courseId, due: d.getTime() }));
      close(); await loadAll(); T.aid = T.assignments[0] && T.assignments[0].id; T.tab = 'result'; route('worksheets'); DT.toast(cls().name + '에 보냈어요. 학생 화면에 바로 나타나요.');
    } }] });
  }
  /* 학생별 복습: 틀린 문제를 학생마다 3개씩 */
  async function sendReview(scope) {
    const scopeSet = new Set(scope || []);
    const per = DT.ws.buildReview(T.assignments.filter((a) => !a.perStudent), T.subs, T.roster, 3);
    if (scopeSet.size) Object.keys(per).forEach((k) => (per[k] = per[k].filter((it) => !it.src || scopeSet.has(it.src.screen)).slice(0, 3)));
    const n = Object.values(per).filter((x) => x.length).length;
    if (!n) return DT.toast('이 범위에서 틀린 문제가 있는 학생이 없어요.');
    if (!(await DT.confirm('복습 보내기', '틀린 문제가 있는 ' + n + '명에게 각자 틀린 문제를 최대 3개씩 다시 보내요. 보낼까요?', '보내기'))) return;
    const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(23, 59, 0, 0);
    await DT.data.createAssignment({ title: '복습 · 지난번에 틀린 문제', kind: 'review', classId: T.classId, courseId: C.courseId, perStudent: per, items: [], scope: [...scopeSet], due: d.getTime() });
    await loadAll(); route(T.view); DT.toast(n + '명에게 복습 학습지를 보냈어요.');
  }

  /* ── 학생 ── */
  function students() {
    top(cls().name + ' 학생 ' + T.roster.length + '명');
    if (!T.roster.length) { view().append(DT.el('div', { class: 'empty-c' }, DT.el('b', null, '명단이 비어 있어요'), DT.el('span', null, '학생이 학생 링크로 로그인하면 저절로 채워져요. (설정 › 학생에게 링크 주기)'))); return; }
    const cols = innerWidth < 1180 ? 4 : 6; const rowsN = Math.max(3, Math.floor((innerHeight - 170) / 104)); const per = cols * rowsN;
    const g = DT.el('div', { class: 'st-grid', style: { gridTemplateRows: 'repeat(' + rowsN + ', minmax(0, 1fr))' } });
    const flags = new Set(studentFlags().filter((f) => f.w >= 2).map((f) => f.r.key));
    T.roster.slice((T.page.st || 0) * per, (T.page.st || 0) * per + per).forEach((r) => {
      const p = DT.rec.profile(r.key, ctx()); const lastObs = p.obs[0];
      g.append(DT.el('button', { class: 'scard' + (flags.has(r.key) ? ' is-alert' : ''), type: 'button', onclick: () => { T.key = r.key; route('profile'); } },
        DT.el('b', null, r.name), DT.el('small', { class: 'num' }, r.no + ' · 제출 ' + p.submitted + '/' + p.total + ' · ' + DT.pct(p.avg)),
        DT.el('span', { style: { display: 'grid', gap: '4px', alignSelf: 'end' } }, lastObs ? DT.el('span', { class: 'tag' }, lastObs.tag) : DT.el('span'), DT.el('span', { class: 'mini' }, DT.el('i', { style: { width: (p.avg == null ? 0 : p.avg * 100) + '%' } })))));
    });
    $('#top').insertBefore(pager('st', T.roster.length, per, students), $('#top').children[1] || null);
    view().append(g);
  }
  function profile() {
    const r = T.roster.find((x) => x.key === T.key); if (!r) return students();
    const p = DT.rec.profile(r.key, ctx());
    top(r.name + ' · ' + r.no, DT.el('div', { class: 'row' }, DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button', html: DT.icon('left') + '학생 목록', onclick: () => route('students') }), DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('print') + '개인 리포트 인쇄', onclick: () => printReport([r]) })));
    const g = DT.el('div', { class: 'prof' });
    const peerAvg = Object.values(p.peer.avg); const pa = peerAvg.length ? peerAvg.reduce((a, b) => a + b, 0) / peerAvg.length : null;
    const stats = DT.el('div', { class: 'prof__stats' },
      DT.el('div', { class: 'kpi' }, DT.el('b', { class: 'num' }, p.submitted + '/' + p.total), DT.el('span', null, '학습지 제출')),
      DT.el('div', { class: 'kpi' }, DT.el('b', { class: 'num' }, DT.pct(p.avg)), DT.el('span', null, '평균 정답률')),
      DT.el('div', { class: 'kpi' }, DT.el('b', { class: 'num' }, p.first != null ? DT.pct(p.first) + ' → ' + DT.pct(p.last) : '–'), DT.el('span', null, '처음 → 최근')),
      DT.el('div', { class: 'kpi' }, DT.el('b', { class: 'num' }, pa == null ? '–' : pa.toFixed(1) + '/5'), DT.el('span', null, '동료평가 받은 점수')),
      DT.el('div', { class: 'kpi' }, DT.chart.stack([{ n: p.signals.g, color: 'var(--ok)', label: '알겠어요' }, { n: p.signals.y, color: '#C98500', label: '헷갈려요' }, { n: p.signals.r, color: 'var(--bad)', label: '모르겠어요' }]), DT.el('span', null, '수업 중 이해도 신호')));
    const c1 = card('정답률 흐름', DT.el('span', { class: 'sub' }, '파란 선이 이 학생, 회색 점선이 반 평균'));
    c1.append(DT.chart.line([{ name: r.name, color: DT.chart.color.main, pts: p.series.map((x) => [x.i, x.me]) }, { name: '반 평균', color: DT.chart.color.avg, dash: true, pts: p.series.map((x) => [x.i, x.cls]) }], { labels: p.series.map((x) => DT.date(x.a.createdAt).replace(/ \(.\)/, '')), label: '정답률 흐름', h: 200 }));
    const c2 = card('개념별 정답률', null); c2.append(p.concept.length ? DT.chart.hbars(p.concept.slice(0, 7)) : DT.el('div', { class: 'empty-c' }, DT.el('span', null, '자동 채점 문항 기록이 아직 없어요.')));
    const c3 = card('자기평가 · 진로 탐구', null);
    const lastSelf = p.self.slice(-3); lastSelf.forEach((sv) => c3.append(DT.el('div', { class: 'muted' }, DT.plain(sv.text).slice(0, 34) + ' — ', DT.el('b', { style: { color: 'var(--ink)' } }, DT.ws.levels[sv.level]))));
    const car = p.career[p.career.length - 1];
    c3.append(car ? DT.el('div', { class: 'ansbox' }, DT.el('h4', null, '진로 탐구 · ' + car.field), DT.el('p', null, car.question || '–'), DT.el('p', { class: 'muted' }, (car.method || '') + (car.link ? ' · ' + car.link : ''))) : DT.el('div', { class: 'muted' }, '진로 탐구 학습지를 아직 내지 않았어요.'));
    const c4 = card('관찰 기록', DT.el('span', { class: 'sub' }, '생기부·담임 공유에 쓰여요'));
    c4.append(DT.el('div', { class: 'obs-add' }, TAGS.map((t) => DT.el('button', { type: 'button', onclick: () => addObs(r, t) }, '+ ' + t)), DT.el('button', { type: 'button', onclick: () => addObs(r, null) }, '+ 직접 쓰기')));
    const tl = DT.el('div', { class: 'tl' }); p.obs.slice(0, 5).forEach((o) => tl.append(DT.el('div', null, DT.el('small', { class: 'num' }, DT.date(o.at).replace(/ \(.\)/, '')), DT.el('span', null, DT.el('b', { class: 'tagc' }, o.tag + ' '), o.note || ''), DT.el('button', { class: 'icon-btn', type: 'button', 'aria-label': '지우기', style: { width: '30px', height: '30px' }, html: DT.icon('x'), onclick: async () => { await DT.data.removeObservation(o.id); T.obs = await DT.data.listObservations({ classId: T.classId }); profile(); } }))));
    if (!p.obs.length) c4.append(DT.el('p', { class: 'muted', style: { margin: 0 } }, '아직 기록이 없어요. 위 단추로 바로 남길 수 있어요.'));
    c4.append(tl);
    const c5 = card('받은 피드백 · 동료의 한마디', null);
    const fl = DT.el('div', { class: 'tl' });
    p.feedback.slice(0, 3).forEach((f) => fl.append(DT.el('div', null, DT.el('small', { class: 'num' }, DT.date(f.at).replace(/ \(.\)/, '')), DT.el('span', null, f.text), DT.el('span'))));
    p.peer.comments.slice(0, 3).forEach((cmt) => fl.append(DT.el('div', null, DT.el('small', null, '동료'), DT.el('span', null, '"' + cmt + '"'), DT.el('span'))));
    c5.append(fl);
    if (!p.feedback.length && !p.peer.comments.length) c5.append(DT.el('p', { class: 'muted', style: { margin: 0 } }, '아직 없어요.'));
    const c6 = card('학생이 쓴 한 줄 · 궁금한 것', DT.el('span', { class: 'sub' }, '생기부 「질문·사고」 근거'));
    const rl = DT.el('div', { class: 'tl' });
    p.reflects.slice(-4).reverse().forEach((x) => rl.append(DT.el('div', null, DT.el('small', { class: 'num' }, DT.date(x.at).replace(/ \(.\)/, '')), DT.el('span', null, x.a || '', x.b ? DT.el('span', { class: 'muted' }, ' · 궁금: ' + x.b) : null), DT.el('span'))));
    c6.append(rl); if (!p.reflects.length) c6.append(DT.el('p', { class: 'muted', style: { margin: 0 } }, '「오늘 배운 것 확인」 학습지의 한 줄 정리가 여기에 모여요.'));
    g.append(stats, c1, c2, c3, c4, c5, c6);
    view().append(g);
  }
  function addObs(r, tag) {
    const t = DT.el('input', { class: 'input', placeholder: '예: 문제를 두 가지 방법으로 풀어 친구에게 설명함' });
    DT.modal({ title: r.name + ' · ' + (tag || '관찰 기록'), body: DT.el('div', { class: 'field' }, DT.el('span', null, '무엇을 보았나요? (선택)'), t), actions: [{ label: '취소' }, { label: '기록하기', kind: 'ink', onClick: async (c) => { await DT.data.addObservation({ key: r.key, classId: T.classId, tag: tag || '관찰', note: t.value.trim(), by: 'teacher' }); T.obs = await DT.data.listObservations({ classId: T.classId }); c(); profile(); } }] });
  }

  /* ── 성취기준 ── */
  async function standards() {
    top('성취기준별 성취');
    const st = DT.rec.standards(ctx());
    const g = DT.el('div', { class: 'set-grid' });
    const left = card('성취기준', DT.el('span', { class: 'sub' }, '상 80% 이상 · 중 50% 이상 · 하'));
    if (!st.length) left.append(DT.el('div', { class: 'empty-c' }, DT.el('span', null, '교과서 내용에 성취기준이 아직 연결되지 않았어요. (Code: content의 standards)')));
    let selI = T.page.std || 0;
    const right = card('학생별 수준', null);
    function paintRight() {
      right.querySelectorAll(':scope > :not(.card__h)').forEach((x) => x.remove());
      const s = st[selI]; if (!s) return;
      right.querySelector('h2').textContent = s.code + ' 학생별 수준';
      const cols = DT.el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', alignContent: 'start' } });
      [['상', 0], ['중', 1], ['하', 2], ['기록 없음', null]].forEach(([t, l]) => cols.append(DT.el('div', { style: { display: 'grid', gap: '4px', alignContent: 'start' } }, DT.el('b', null, t + ' ' + s.per.filter((p) => p.level === l).length + '명'), ...s.per.filter((p) => p.level === l).slice(0, 14).map((p) => DT.el('button', { class: 'person', type: 'button', style: { padding: '4px 6px' }, onclick: () => { T.key = p.r.key; route('profile'); } }, p.r.name + (p.value != null ? ' ' + DT.pct(p.value) : ''))))));
      right.append(cols);
    }
    st.forEach((s, i) => left.append(DT.el('button', { class: 'weak__row', type: 'button', style: { textAlign: 'left', outline: i === selI ? '2px solid var(--ink)' : 'none' }, onclick: () => { T.page.std = i; standards(); } }, DT.el('b', null, s.code + ' ' + DT.plain(s.text)), DT.el('span', null, '반 평균 ' + DT.pct(s.avg) + ' · ' + DT.plain(s.sub.title)), DT.el('span', { style: { gridColumn: '1 / -1' } }, DT.chart.stack([{ n: s.dist[0], color: '#1C5CAB', label: '상' }, { n: s.dist[1], color: '#5598E7', label: '중' }, { n: s.dist[2], color: '#C9372C', label: '하' }, { n: s.none, color: '#CFC6B2', label: '기록 없음' }])))));
    const plan = await DT.data.getEvalPlan();
    const pc = DT.el('div', { style: { display: 'grid', gap: '6px', marginTop: '8px' } }, DT.el('b', null, '평가 계획'));
    (plan.items || []).forEach((it) => pc.append(DT.el('div', { class: 'muted' }, it.name + ' · 반영 ' + it.weight + '% · ' + (it.standards || []).join(', '))));
    pc.append(DT.el('button', { class: 'btn btn--sm', type: 'button', style: { justifySelf: 'start' }, html: DT.icon('plus') + '평가 요소 추가', onclick: () => addPlan(plan) }));
    left.append(pc);
    paintRight();
    g.append(left, right); view().append(g);
  }
  function addPlan(plan) {
    const name = DT.el('input', { class: 'input', placeholder: '예: 수행평가 · 탐구 보고서' }); const w = DT.el('input', { class: 'input num', type: 'number', placeholder: '반영 %' });
    const codes = Array.from(new Set(T.tb._subunits.flatMap((u) => (u.standards || []).map((s) => s.code))));
    const sel = DT.el('select', { class: 'select' }, codes.map((c) => DT.el('option', { value: c }, c)));
    const rub = [0, 1, 2].map((i) => DT.el('input', { class: 'input', placeholder: ['상 수준의 모습', '중 수준의 모습', '하 수준의 모습'][i] }));
    DT.modal({ title: '평가 요소 추가', body: DT.el('div', { style: { display: 'grid', gap: '10px' } }, name, DT.el('div', { class: 'row' }, w, sel), ...rub), actions: [{ label: '취소' }, { label: '저장', kind: 'ink', onClick: async (c) => { if (!name.value.trim()) return; plan.items = (plan.items || []).concat([{ id: DT.uid('e'), name: name.value.trim(), weight: +w.value || 0, standards: [sel.value], rubric: rub.map((x) => x.value) }]); await DT.data.saveEvalPlan(plan); c(); standards(); } }] });
  }

  /* ── 수업 일지 ── */
  function lessons() {
    top(cls().name + ' 수업 일지', DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('print') + '인쇄', onclick: printLessons }));
    if (!T.lessons.length) { view().append(DT.el('div', { class: 'empty-c' }, DT.el('b', null, '아직 저장된 수업이 없어요'), DT.el('span', null, '전자칠판에서 수업 도구 › 「수업 마치기」를 누르면 그날 진도와 반응이 여기에 쌓여요.'))); return; }
    const per = Math.max(4, Math.floor((innerHeight - 220) / 64));
    const tbl = DT.el('table', { class: 'tbl' }, DT.el('thead', null, DT.el('tr', null, ['날짜', '진도', '시간', '어려워한 곳', '즉석 질문', '메모'].map((h) => DT.el('th', null, h)))));
    const tbody = DT.el('tbody'); tbl.append(tbody);
    T.lessons.slice((T.page.ls || 0) * per, (T.page.ls || 0) * per + per).forEach((l) => {
      const mins = Math.round(((l.endedAt || l.startedAt) - l.startedAt) / 60000);
      tbody.append(DT.el('tr', { class: 'is-click', onclick: () => lessonDetail(l) }, DT.el('td', { class: 'num' }, DT.date(l.startedAt)), DT.el('td', null, DT.el('span', { class: 'clip' }, (l.screens || []).map((s) => s.title).join(' → '))), DT.el('td', { class: 'num' }, mins + '분'), DT.el('td', null, (l.hard || []).map((id) => T.tb._byId[id] ? DT.plain(T.tb._byId[id].title) : '').filter(Boolean).join(', ') || '–'), DT.el('td', { class: 'num' }, (l.live || []).map((x) => (x.label || '질문') + ' ' + (x.ok != null ? x.ok + '/' + x.n : x.n + '명')).join(', ') || '–'), DT.el('td', null, DT.el('span', { class: 'clip' }, l.memo || ''))));
    });
    view().append(DT.el('section', { class: 'card', style: { flex: '1' } }, DT.el('div', { class: 'card__h' }, DT.el('h2', null, T.lessons.length + '번의 수업'), pager('ls', T.lessons.length, per, lessons)), tbl));
  }
  function lessonDetail(l) {
    const b = DT.el('div', { style: { display: 'grid', gap: '10px' } });
    b.append(DT.chart.hbars((l.screens || []).map((s) => { const c = s.sig || { g: 0, y: 0, r: 0 }; const t = c.g + c.y + c.r; return { label: s.title, value: t ? c.g / t : null, tip: s.title + ' · 알겠어요 ' + c.g + ' · 헷갈려요 ' + c.y + ' · 모르겠어요 ' + c.r + ' · ' + Math.round((s.ms || 0) / 60000) + '분' }; }), { warnBelow: 0.6 }));
    b.append(DT.el('p', { class: 'muted', style: { margin: 0 } }, '막대 = 그 화면에서 「알겠어요」를 보낸 학생 비율'));
    if ((l.questions || []).length) b.append(DT.el('div', { class: 'ansbox' }, DT.el('h4', null, '익명 질문'), ...l.questions.map((q) => DT.el('p', null, q))));
    const memo = DT.el('textarea', { class: 'textarea' }); memo.value = l.memo || ''; b.append(DT.el('div', { class: 'field' }, DT.el('span', null, '메모'), memo));
    DT.modal({ title: DT.date(l.startedAt) + ' 수업', body: b, wide: true, actions: [{ label: '닫기' }, { label: '메모 저장', kind: 'ink', onClick: async (c) => { l.memo = memo.value; await DT.data.saveLesson(l); c(); lessons(); } }] });
  }

  /* ── 기록 내보내기 ── */
  function exportView() {
    top('기록 내보내기');
    const g = DT.el('div', { class: 'set-grid' });
    const c1 = card('생기부 근거', DT.el('span', { class: 'sub' }, '생기부생성기 「일괄입력」 형식'));
    c1.append(DT.el('p', { class: 'muted', style: { margin: 0 } }, '학생이 실제로 한 활동·산출물·질문·관찰만 모아요. 문장은 생기부생성기가 기재요령에 맞춰 써요. 성적 추이는 참고용 칸에만 들어가요.'));
    const sel = DT.el('select', { class: 'select' }, T.roster.map((r) => DT.el('option', { value: r.key }, r.no + ' ' + r.name)));
    const prev = DT.el('div', { style: { display: 'grid', gap: '4px', fontSize: '13.5px', overflow: 'hidden' } });
    const paint = () => { prev.innerHTML = ''; const row = DT.rec.saenggibuRow(T.roster.find((r) => r.key === sel.value), ctx()); DT.rec.HEAD.forEach((h, i) => { if (i > 1 && i < 11) prev.append(DT.el('div', null, DT.el('b', null, h + ' '), DT.el('span', { class: 'muted' }, row[i] || '–'))); }); };
    sel.onchange = paint; if (T.roster.length) paint();
    c1.append(sel, prev, DT.el('div', { class: 'row' }, DT.el('button', { class: 'btn btn--ink', type: 'button', html: DT.icon('download') + cls().name + ' 전체 내려받기', onclick: () => DT.download('생기부근거_' + cls().name + '_' + DT.ymd(Date.now()) + '.csv', DT.csv([DT.rec.HEAD].concat(T.roster.map((r) => DT.rec.saenggibuRow(r, ctx())))), 'text/csv;charset=utf-8') })));
    const c2 = card('담임 선생님께 공유', DT.el('span', { class: 'sub' }, '수업 태도 · 진로 관심 · 관찰'));
    const homes = Array.from(new Set(T.roster.map((r) => DT.rec.homeroomOf(r.no)))).filter(Boolean);
    const hs = DT.el('select', { class: 'select' }, homes.map((h) => DT.el('option', { value: h }, h)));
    const tbl = DT.el('div', { style: { overflow: 'hidden', flex: '1' } });
    const paint2 = () => { tbl.innerHTML = ''; const rows = T.roster.filter((r) => DT.rec.homeroomOf(r.no) === hs.value).map((r) => DT.rec.homeroomRow(r, ctx())); const t = DT.el('table', { class: 'tbl' }, DT.el('thead', null, DT.el('tr', null, ['번호', '이름', '참여', '수업 태도', '진로 관심'].map((h) => DT.el('th', null, h))))); const tb = DT.el('tbody'); rows.slice(0, 8).forEach((x) => tb.append(DT.el('tr', null, DT.el('td', { class: 'num' }, x.no.slice(-2)), DT.el('td', null, x.name), DT.el('td', { class: 'num' }, x.part), DT.el('td', null, DT.el('span', { class: 'clip' }, x.attitude)), DT.el('td', null, DT.el('span', { class: 'clip' }, x.career))))); t.append(tb); tbl.append(t); if (rows.length > 8) tbl.append(DT.el('p', { class: 'muted' }, '외 ' + (rows.length - 8) + '명 — 인쇄·내려받기에 모두 들어가요.')); };
    hs.onchange = paint2; if (homes.length) paint2();
    c2.append(DT.el('p', { class: 'muted', style: { margin: 0 } }, '학번으로 담임 반을 찾아요. 점수는 넣지 않고 수업 중 모습과 진로 관심만 전해요.'), hs, tbl, DT.el('div', { class: 'row' },
      DT.el('button', { class: 'btn btn--ink', type: 'button', html: DT.icon('print') + '인쇄', onclick: () => printHomeroom(hs.value) }),
      DT.el('button', { class: 'btn', type: 'button', html: DT.icon('download') + '엑셀(CSV)', onclick: () => { const rows = T.roster.filter((r) => DT.rec.homeroomOf(r.no) === hs.value).map((r) => DT.rec.homeroomRow(r, ctx())); DT.download('담임공유_' + hs.value + '_' + DT.tb_course() + '.csv', DT.csv([['학번', '이름', '참여(제출)', '수업 태도', '도움이 필요한 모습', '진로 관심', '수업 중 신호', '메모']].concat(rows.map((x) => [x.no, x.name, x.part, x.attitude, x.need, x.career, x.voice, x.memo]))), 'text/csv;charset=utf-8'); } }),
      DT.el('button', { class: 'btn btn--ghost', type: 'button', html: DT.icon('download') + '전체 백업', onclick: async () => DT.download('수업잇기_백업_' + DT.ymd(Date.now()) + '.json', JSON.stringify(await DT.data.exportAll()), 'application/json') })));
    g.append(c1, c2); view().append(g);
  }
  DT.tb_course = () => (T.tb ? DT.plain(T.tb.meta.course || T.tb.meta.title) : '교과');

  /* ── 인쇄 ── */
  function printReport(list) {
    const pa = $('#printArea'); pa.innerHTML = '';
    list.forEach((r) => {
      const p = DT.rec.profile(r.key, ctx()); const pg = DT.el('section', { class: 'pg' });
      pg.append(DT.el('h1', null, r.name + ' 학생 학습 리포트'), DT.el('p', null, cls().name + ' · ' + DT.tb_course() + ' · ' + DT.date(Date.now()) + ' 기준'));
      pg.append(DT.el('h2', null, '참여와 정답률'), DT.el('p', null, '학습지 ' + p.submitted + '/' + p.total + '회 제출 · 평균 정답률 ' + DT.pct(p.avg) + (p.first != null ? ' · 처음 ' + DT.pct(p.first) + ' → 최근 ' + DT.pct(p.last) : '')));
      pg.append(DT.chart.line([{ name: r.name, color: '#2A78D6', pts: p.series.map((x) => [x.i, x.me]) }, { name: '반 평균', color: '#8C8A84', dash: true, pts: p.series.map((x) => [x.i, x.cls]) }], { labels: p.series.map((x) => DT.date(x.a.createdAt).replace(/ \(.\)/, '')), h: 180 }));
      if (p.concept.length) { pg.append(DT.el('h2', null, '개념별 정답률')); pg.append(DT.el('table', null, DT.el('tbody', null, p.concept.map((c) => DT.el('tr', null, DT.el('td', null, c.label), DT.el('td', null, DT.pct(c.value) + ' (' + c.n + '문항)')))))); }
      if (p.career.length) { const c = p.career[p.career.length - 1]; pg.append(DT.el('h2', null, '진로 탐구 계획'), DT.el('p', null, c.field + ' — ' + (c.question || '')), DT.el('p', null, (c.method || '') + (c.link ? ' · 교과서 연결: ' + c.link : ''))); }
      pg.append(DT.el('h2', null, '선생님 한마디'), DT.el('p', null, (p.feedback[0] && p.feedback[0].text) || ' '), DT.el('p', null, ' '));
      pa.append(pg);
    });
    setTimeout(() => window.print(), 100);
  }
  function printHomeroom(h) {
    const pa = $('#printArea'); pa.innerHTML = '';
    const rows = T.roster.filter((r) => DT.rec.homeroomOf(r.no) === h).map((r) => DT.rec.homeroomRow(r, ctx()));
    pa.append(DT.el('h1', null, h + ' 담임 선생님께 — ' + DT.tb_course() + ' 수업에서 본 모습'), DT.el('p', null, '보낸 사람: ' + (T.me.name || '교과 선생님') + ' · ' + DT.date(Date.now()) + ' · 점수 없이 수업 태도와 진로 관심만 담았습니다.'),
      DT.el('table', null, DT.el('thead', null, DT.el('tr', null, ['번호', '이름', '참여', '수업 태도', '도움이 필요한 모습', '진로 관심', '메모'].map((x) => DT.el('th', null, x)))), DT.el('tbody', null, rows.map((x) => DT.el('tr', null, [x.no.slice(-2), x.name, x.part, x.attitude, x.need, x.career, x.memo].map((v) => DT.el('td', null, v || '')))))));
    setTimeout(() => window.print(), 100);
  }
  function printLessons() {
    const pa = $('#printArea'); pa.innerHTML = '';
    pa.append(DT.el('h1', null, cls().name + ' ' + DT.tb_course() + ' 수업 일지'), DT.el('table', null, DT.el('thead', null, DT.el('tr', null, ['날짜', '진도', '어려워한 곳', '즉석 질문', '메모'].map((x) => DT.el('th', null, x)))), DT.el('tbody', null, T.lessons.map((l) => DT.el('tr', null, DT.el('td', null, DT.date(l.startedAt)), DT.el('td', null, (l.screens || []).map((s) => s.title).join(' → ')), DT.el('td', null, (l.hard || []).map((id) => T.tb._byId[id] ? DT.plain(T.tb._byId[id].title) : '').join(', ')), DT.el('td', null, (l.live || []).map((x) => (x.label || '') + ' ' + (x.ok != null ? x.ok + '/' + x.n : '')).join(', ')), DT.el('td', null, l.memo || ''))))));
    setTimeout(() => window.print(), 100);
  }

  /* ── 설정 ── */
  function settings() {
    top('설정');
    const g = DT.el('div', { class: 'set-grid' });
    const c1 = card('반과 명단', DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('plus') + '새 반', onclick: newClass }));
    c1.append(T.classes.length ? DT.el('div', { class: 'chips' }, T.classes.map((c) => DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': c.id === T.classId ? 'true' : 'false', onclick: async () => { T.classId = c.id; DT.store.set('t.class', c.id); await loadAll(); settings(); } }, c.name))) : DT.el('p', { class: 'muted' }, '아직 반이 없어요. 학생이 오른쪽 QR로 들어오면 반이 저절로 생겨요.'));
    if (T.pending.length) c1.append(pendingBox());
    if (T.classId) c1.append(DT.el('p', { class: 'muted', style: { margin: 0 } }, cls().name + ' 명단 ' + T.roster.length + '명' + (T.roster[0] ? ' · ' + T.roster.slice(0, 4).map((r) => r.name).join(', ') + (T.roster.length > 4 ? ' …' : '') : ' · 학생이 학생 링크로 로그인하면 저절로 채워져요')),
      DT.el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        T.roster.length ? DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('user') + '명단 보기·빼기', onclick: rosterModal }) : null,
        DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button', html: DT.icon('upload') + '명렬표로 한꺼번에 넣기', onclick: pasteRoster })));
    const studentUrl = DT.studentLink(T.join);
    const c2 = card('학생에게 링크 주기', null);
    c2.append(DT.el('div', { class: 'row', style: { alignItems: 'flex-start', gap: '16px' } }, DT.chart.qr(studentUrl, 160), DT.el('div', { style: { display: 'grid', gap: '8px', flex: '1', minWidth: '0' } }, DT.el('p', { class: 'muted', style: { margin: 0 } }, '전자칠판에 이 QR을 띄우거나 클래스룸에 주소를 붙여 주세요. 학생은 학교 구글 계정으로 로그인하고 학년·반·번호만 적으면 명단에 저절로 들어와요.'), joinToggle(), DT.el('div', { class: 'linkbox' }, DT.el('code', null, studentUrl), DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('copy') + '복사', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(studentUrl); DT.toast('주소를 복사했어요.'); } })))));
    const c3 = card('교과서', null);
    if (DT.data.mode === 'firebase') {
      c3.append(DT.el('p', { class: 'muted', style: { margin: 0 } }, T.tb ? '올라가 있는 교과서: ' + DT.plain(T.tb.meta.title) : '아직 교과서가 올라가지 않았어요.'), DT.el('p', { class: 'muted', style: { margin: 0 } }, '교과서는 Code가 배포할 때 저절로 올라가요. 쪽을 더 만들어도 같은 링크에 이어서 붙고, 학생 기록은 그대로예요. (아래 버튼은 직접 올려야 할 때만)'));
      const inp = DT.el('input', { type: 'file', webkitdirectory: true, multiple: true, hidden: true });
      inp.onchange = () => uploadCourse(inp.files);
      c3.append(inp, DT.el('button', { class: 'btn btn--ink', type: 'button', style: { alignSelf: 'flex-start' }, html: DT.icon('upload') + 'content 폴더 고르기', onclick: () => inp.click() }));
    } else {
      c3.append(DT.el('p', { class: 'muted', style: { margin: 0 } }, '지금은 체험 모드예요. 기록이 이 브라우저 안에만 저장돼요. 실제 반에서 쓰려면 Code에게 「배포해줘」라고 하면 Firebase 연결을 도와줘요.'),
        DT.el('button', { class: 'btn', type: 'button', style: { alignSelf: 'flex-start' }, html: DT.icon('reset') + '체험 데이터 처음으로', onclick: async () => { if (await DT.confirm('체험 데이터 지우기', '가상 학생들의 기록과 판서를 처음 상태로 되돌려요.', '되돌리기')) { await DT.data.resetDemo(); location.reload(); } } }));
    }
    const c4 = card('처음 쓰는 선생님께', null);
    c4.append(DT.el('ol', { style: { margin: 0, paddingLeft: '1.2em', display: 'grid', gap: '8px', fontSize: '15px', lineHeight: '1.6' } },
      DT.el('li', null, DT.el('b', null, '수업: '), '「전자칠판 열기」 → 반 고르기 → 화살표로 넘기며 수업. 왼쪽 아래 「판서」, 오른쪽 탭 「교과서」.'),
      DT.el('li', null, DT.el('b', null, '학습지: '), '오른쪽 위 「학습지 보내기」 → 범위·종류·기한만 고르면 끝. 「직접 만들기·고치기」로 빈칸·순서·내 문제를 바꾸고, 「인쇄」로 종이 학습지도 뽑아요. 결과는 「학습지」 메뉴에 저절로 모여요.'),
      DT.el('li', null, DT.el('b', null, '기록: '), '「학생」에서 한 명을 누르면 학기 전체 기록. 「기록 내보내기」에서 생기부 근거와 담임 공유 자료를 받아요.')));
    const cx = DT.extras.list().map((ex) => {
      const c = card(ex.title || '연결된 활동', DT.el('span', { class: 'sub' }, '참관·다른 선생님 체험 QR'));
      const vis = DT.extras.url(ex.visitor || ex.student, { teacher: '1' });
      c.append(DT.el('div', { class: 'row', style: { alignItems: 'flex-start', gap: '16px' } }, DT.chart.qr(vis, 150),
        DT.el('div', { style: { display: 'grid', gap: '8px', flex: '1', minWidth: '0' } },
          DT.el('p', { class: 'muted', style: { margin: 0 } }, '이 QR은 로그인 없이 누구나 체험해요(기록 안 남음). 우리 반 학생은 학생 앱의 「' + (ex.title || '활동') + '」 버튼으로 들어가면 결과가 실시간 화면에 모여요.'),
          DT.el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, (ex.live || []).map((l) => DT.el('button', { class: 'btn btn--sm', type: 'button', html: DT.icon('signal') + DT.esc(l.label), onclick: () => window.open(l.url, '_blank') }))))));
      return c;
    });
    const c5 = card('화면 테마', DT.el('span', { class: 'sub' }, '이 기기 · 칠판·학생 화면과 같은 색'));
    c5.append(DT.theme.picker());
    g.append(c1, c2, ...cx, c5, c3, c4); view().append(g);
  }
  /* 학교 계정이 아닌 학생: 선생님이 받기·빼기 */
  async function refreshPeople() {
    [T.pending, T.classes] = await Promise.all([DT.data.listPending().catch(() => []), DT.data.listClasses()]);
    if (!T.classes.find((c) => c.id === T.classId)) T.classId = T.classes[0] ? T.classes[0].id : null;
    await loadAll(); navPaint(); settings();
  }
  function pendingBox() {
    const box = DT.el('div', { class: 'pend' }, DT.el('b', null, '들어오려는 학생 ' + T.pending.length + '명 · 학교 계정이 아니에요'));
    T.pending.slice(0, 8).forEach((r) => box.append(DT.el('div', { class: 'pend__row' },
      DT.el('span', null, String(r.classId || '').replace('-', ' ') + ' ' + (+String(r.no).slice(-2)) + '번 ' + r.name), DT.el('small', { class: 'muted' }, r.email),
      DT.el('button', { class: 'btn btn--sm btn--ink', type: 'button', onclick: async () => { await DT.data.approveMember(r.key); await refreshPeople(); DT.toast(r.name + ' 학생을 받았어요.'); } }, '받기'),
      DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button', onclick: async () => { await DT.data.removeMember(r.key); await refreshPeople(); } }, '빼기'))));
    if (T.pending.length > 1) box.append(DT.el('button', { class: 'btn btn--sm', type: 'button', style: { justifySelf: 'start' }, onclick: async () => { for (const r of T.pending) await DT.data.approveMember(r.key); await refreshPeople(); DT.toast('모두 받았어요.'); } }, '모두 받기'));
    return box;
  }
  /* 명단 보기: 잘못 들어온 학생 빼기 (두 번 눌러야 빠짐 · 기록은 남음) */
  function rosterModal() {
    const list = DT.el('div', { class: 'pend', style: { maxHeight: '60vh', overflow: 'auto' } });
    const paint = () => { list.innerHTML = ''; T.roster.forEach((r) => { const b = DT.el('button', { class: 'btn btn--sm btn--ghost', type: 'button' }, '빼기');
      b.onclick = async () => { if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = '한 번 더 누르면 빠져요'; return; } await DT.data.removeMember(r.key); await loadAll(); paint(); };
      list.append(DT.el('div', { class: 'pend__row' }, DT.el('span', { class: 'num' }, r.no + ' ' + r.name), DT.el('small', { class: 'muted' }, r.email), b)); }); };
    paint();
    DT.modal({ title: cls().name + ' 명단', body: list, wide: true, actions: [{ label: '닫기', kind: 'ink', onClick: (c) => { c(); settings(); } }] });
  }
  /* 새 학생 받기 열기·닫기 (반 학생이 다 들어오면 닫아 두면 링크가 새도 아무도 못 들어옴) */
  function joinToggle() {
    if (T.joinOpen === null || T.joinOpen === undefined) return null;
    return DT.el('div', { class: 'row', style: { gap: '8px', alignItems: 'center' } },
      DT.el('span', { class: 'muted' }, '새 학생 받기: ', DT.el('b', null, T.joinOpen ? '열림' : '닫힘')),
      DT.el('button', { class: 'btn btn--sm', type: 'button', onclick: async () => { await DT.data.setJoinOpen(!T.joinOpen); T.joinOpen = !T.joinOpen; settings(); DT.toast(T.joinOpen ? '새 학생이 들어올 수 있어요.' : '이제 새 학생은 들어올 수 없어요. 이미 들어온 학생은 그대로예요.'); } }, T.joinOpen ? '닫기' : '다시 열기'));
  }
  function newClass() {
    const n = DT.el('input', { class: 'input', placeholder: '예: 2학년 3반' });
    DT.modal({ title: '새 반 만들기', body: n, actions: [{ label: '취소' }, { label: '만들기', kind: 'ink', onClick: async (c) => { const name = n.value.trim(); if (!name) return; const id = name.replace(/[^0-9가-힣a-zA-Z]+/g, '-'); await DT.data.saveClass({ id, name }); T.classes = await DT.data.listClasses(); T.classId = id; DT.store.set('t.class', id); await loadAll(); c(); settings(); } }] });
  }
  function pasteRoster() {
    const ta = DT.el('textarea', { class: 'textarea', rows: 10, placeholder: '2301\t김하늘\ts2301@학교도메인\n2302\t이서준\ts2302@학교도메인\n…  (엑셀에서 학번·이름·구글 계정 세 칸을 복사해 붙여 넣으세요)' });
    const prev = DT.el('p', { class: 'muted' });
    const parse = () => ta.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\t|,|\s{2,}|\s/).filter(Boolean)).filter((c) => /^\d{4,6}$/.test(c[0])).map((c) => ({ no: c[0], name: c[1] || '', email: (c.find((x) => x.includes('@')) || '').toLowerCase() }));
    ta.oninput = () => { const rows = parse(); const noMail = rows.filter((r) => !r.email).length; prev.textContent = rows.length + '명 읽음' + (noMail ? ' · 구글 계정이 없는 학생 ' + noMail + '명 (체험 모드에서는 괜찮아요)' : ''); };
    DT.modal({ title: cls().name + ' 명렬표', body: DT.el('div', { style: { display: 'grid', gap: '8px' } }, ta, prev), wide: true, actions: [{ label: '취소' }, { label: '저장', kind: 'ink', onClick: async (c) => { const rows = parse(); if (!rows.length) return DT.toast('학번으로 시작하는 줄을 찾지 못했어요.', 'bad'); if (DT.data.mode === 'firebase' && rows.some((r) => !r.email)) return DT.toast('실제 모드에서는 모든 학생의 구글 계정이 필요해요.', 'bad'); await DT.data.saveRoster(T.classId, rows.map((r) => Object.assign({ key: r.email || 's' + r.no }, r))); await loadAll(); c(); settings(); DT.toast(rows.length + '명을 저장했어요.'); } }] });
  }
  async function uploadCourse(files) {
    const list = Array.from(files); const cjs = list.find((f) => /(^|\/)content\.js$/.test(f.webkitRelativePath || f.name));
    if (!cjs) return DT.toast('content.js가 있는 content 폴더를 골라 주세요.', 'bad');
    const txt = await cjs.text(); const json = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
    const toData = (f) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(f); });
    /* Firestore 문서 한 개는 1MiB까지 — 그림을 글자(base64)로 바꾸면 4/3배가 되므로 파일은 760KB까지 */
    const MAX = 760000; const up = []; const big = [];
    for (const f of list) {
      const rel = (f.webkitRelativePath || f.name).split('/').slice(1).join('/');
      const m = rel.match(/^pages\/(hi\/)?p0*(\d+)\.(webp|jpg|png)$/);
      const isFig = /^figs\//.test(rel);
      if (!m && !isFig) continue;
      if (f.size > MAX) { big.push(rel); continue; }
      if (m) up.push({ kind: 'page', n: +m[2], hi: !!m[1], data: await toData(f) });
      else up.push({ kind: 'asset', path: rel, data: await toData(f) });
    }
    if (big.length) DT.toast('너무 큰 그림 ' + big.length + '개는 빼고 올려요 (' + big.slice(0, 3).join(', ') + (big.length > 3 ? ' …' : '') + '). 확대용 쪽은 보통 쪽으로 대신 보여요.', 'bad');
    const m = DT.modal({ title: '교과서 올리는 중', body: '<p class="muted">0 / ' + up.length + '</p>', sticky: true });
    await DT.data.uploadCourse(json, up, (d, n) => { m.body.innerHTML = '<p class="muted">' + d + ' / ' + n + '</p>'; });
    m.close(); DT.toast('교과서를 올렸어요.'); location.reload();
  }

  addEventListener('resize', DT.debounce(() => route(T.view), 250));
  document.addEventListener('DOMContentLoaded', start);
})();

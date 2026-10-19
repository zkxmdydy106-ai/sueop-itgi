/* 수업잇기 엔진 · worksheet.js — 학습지 자동 만들기와 채점
   교과서 내용(블록)에서 바로 만든다:
   - [[핵심어]] → 빈칸 채우기      - 문제(grade 있음) → 연습 문제(자동 채점)
   - 모둠 탐구(group) → 모둠 활동지 + 동료평가      - 성취기준 → 자기평가
   - explore(교과서 속 탐구 거리) → 진로 탐구      - 틀린 문항 → 학생별 복습 */
(function () {
  'use strict';
  const DT = window.DT;
  const W = (DT.ws = {});

  W.kinds = [
    { id: 'exit', name: '오늘 배운 것 확인', desc: '빈칸 3 · 문제 3 · 자기평가 — 수업 끝 5분용', icon: 'check', rec: true },
    { id: 'concept', name: '개념 빈칸 채우기', desc: '교과서 핵심어를 빈칸으로', icon: 'note' },
    { id: 'practice', name: '연습 문제', desc: '교과서 문제 · 바로 채점', icon: 'pencil' },
    { id: 'variant', name: '변형 문제', desc: '숫자를 바꾼 새 문제 · 개념마다 2개 · 바로 채점', icon: 'refresh' },
    { id: 'group', name: '모둠 활동지', desc: '역할 나누기 · 함께 답하기 · 동료평가', icon: 'users' },
    { id: 'self', name: '자기평가', desc: '성취기준별로 스스로 점검', icon: 'target' },
    { id: 'career', name: '진로 탐구', desc: '교과서 속 탐구 거리 추천 + 내 탐구 계획', icon: 'compass' }
  ];
  W.kindName = (k) => (W.kinds.find((x) => x.id === k) || { name: k === 'review' ? '복습' : k === 'custom' ? '직접 만든 학습지' : '학습지' }).name;
  W.levels = ['잘할 수 있어요', '조금 도움이 필요해요', '아직 어려워요'];
  W.roles = [
    { id: 'lead', name: '진행', desc: '순서를 지키며 모두가 말하게 해요' },
    { id: 'record', name: '기록', desc: '모둠 답을 정리해 적어요' },
    { id: 'check', name: '확인', desc: '교과서와 맞는지 확인해요' },
    { id: 'speak', name: '발표', desc: '모둠 생각을 반에 알려요' }
  ];
  W.peerCriteria = [
    { id: 'part', text: '자기 생각을 말하고 함께 참여했어요' },
    { id: 'help', text: '다른 친구의 생각을 듣고 도왔어요' },
    { id: 'role', text: '맡은 역할을 끝까지 했어요' }
  ];
  W.fields = ['공학·기술', '자연과학', '의약·보건', 'IT·인공지능', '경영·경제', '인문·사회', '교육', '예술·디자인', '체육·스포츠'];

  const screensIn = (tb, ids) => ids.map((id) => tb._byId[id]).filter(Boolean);
  const blocksIn = (s) => { const out = []; (s.blocks || []).forEach((b) => { out.push(b); if (b.cols) b.cols.forEach((c) => c.forEach((bb) => out.push(bb))); }); return out; };
  const subsOf = (tb, ids) => Array.from(new Set(screensIn(tb, ids).map((s) => s._sub)));
  const allTerms = (tb) => { const set = new Set(); tb._screens.forEach((s) => blocksIn(s).forEach((b) => DT.terms(b.x).forEach((t) => set.add(t)))); return [...set]; };

  /* 블록 → 문항들 */
  function blankItems(tb, screens) {
    const out = []; const pool = allTerms(tb);
    screens.forEach((s) => blocksIn(s).forEach((b) => {
      const terms = DT.terms(b.x);
      if (!terms.length || !/^(def|p|note|list)$/.test(b.t)) return;
      const ans = terms.slice(0, 5);
      const distract = DT.shuffle(pool.filter((t) => !ans.includes(t)), ans.length * 7).slice(0, Math.min(3, Math.max(1, 5 - ans.length)));
      out.push({ id: 'k' + b.id, type: 'blank', x: b.x, label: '개념 빈칸 · ' + DT.plain(s.chip || s.title), answers: ans, bank: DT.shuffle(ans.concat(distract), b.id.length * 13), src: { screen: s.id, page: (s.pages || [])[0], title: DT.plain(s.title) } });
    }));
    return out;
  }
  function probItems(tb, screens, subs) {
    const out = [];
    screens.forEach((s) => blocksIn(s).forEach((b) => {
      if (b.t !== 'prob' && b.t !== 'ex') return;
      const g = b.grade; const src = { screen: s.id, page: b.page || (s.pages || [])[0], title: DT.plain(s.title), label: b.label };
      if (!g) { if (b.t === 'prob') out.push({ id: 'p' + b.id, type: 'open', q: b.q, sub: b.sub, label: b.label || '문제', draw: true, sol: b.sol, ans: b.ans, src, figs: (b._figs || []).map((f) => f.src).filter(Boolean) }); return; }
      if (b.sub && Array.isArray(g.key)) {
        b.sub.forEach((sq, i) => out.push({ id: 'p' + b.id + '.' + i, type: g.type === 'choice' ? 'choice' : g.type === 'ox' ? 'ox' : 'short', mode: g.type === 'num' ? 'num' : 'text', q: b.q + '\n' + sq, label: (b.label || '문제') + ' ' + sq.replace(/^\s*(\(\d+\)).*/, '$1'), key: [].concat(g.key[i]), choices: g.choices, sol: b.sol, src, figs: (b._figs || []).map((f) => f.src).filter(Boolean) }));
      } else out.push({ id: 'p' + b.id, type: g.type === 'choice' ? 'choice' : g.type === 'ox' ? 'ox' : 'short', mode: g.type === 'num' ? 'num' : 'text', q: b.q, label: b.label || '문제', key: [].concat(g.key), choices: g.choices, sol: b.sol, src, figs: (b._figs || []).map((f) => f.src).filter(Boolean) });
    }));
    subs.forEach((u) => (u.practice || []).forEach((p, i) => out.push({ id: 'x' + u.id + '.' + i, type: p.type || 'short', mode: p.mode || 'num', q: p.q, label: p.label || '더 풀어 보기', key: [].concat(p.key), choices: p.choices, sol: p.sol, src: { screen: p.screen, page: p.page, title: DT.plain(u.title) } })));
    return out;
  }
  /* 변형 문제: 교과서 개념별로 숫자·조건을 바꾼 새 문제 (교과서 글 아님 — 「변형」 표시) */
  function variantItems(subs, per) {
    const out = [];
    subs.forEach((u) => {
      const seen = {};
      (u.variants || []).forEach((p, i) => {
        seen[p.concept] = (seen[p.concept] || 0) + 1; if (per && seen[p.concept] > per) return;
        out.push({ id: 'v' + u.id + '.' + i, type: p.type || 'short', mode: p.mode || 'num', q: p.q, label: '변형 · ' + p.concept, concept: p.concept, variant: true, key: [].concat(p.key), choices: p.choices, sol: p.sol, src: { title: DT.plain(u.title) } });
      });
    });
    return out;
  }
  W.variants = (tb, scope, per) => variantItems(subsOf(tb, scope), per);
  /* 문제 모음: 범위 안의 교과서 문제 + 변형 문제 전부, 개념별로 (인쇄·PDF용) */
  W.compile = (tb, scope) => {
    const subs = subsOf(tb, scope);
    const book = probItems(tb, screensIn(tb, scope), subs).map((it) => Object.assign({}, it, { concept: '교과서 문제 · ' + (it.src && it.src.title || '') }));
    return { title: subs.map((u) => DT.plain(u.title)).join(', ') + ' · 문제 모음', kind: 'custom', items: book.concat(variantItems(subs)), scope, subunitIds: subs.map((u) => u.id) };
  };
  /* 문장 그대로(빈칸 없음) — 선생님이 원하는 곳을 눌러 빈칸을 만든다 */
  W.sentences = (tb, scope) => {
    const out = [];
    screensIn(tb, scope).forEach((s) => blocksIn(s).forEach((b) => {
      if (!/^(def|p|note|list|thm)$/.test(b.t) || !b.x || typeof b.x !== 'string' || b.x.length < 8) return;
      out.push({ id: 'q' + b.id, type: 'blank', x: b.x.replace(/\[\[([^\]]+?)\]\]/g, '$1'), answers: [], bank: [], label: '문장 · ' + DT.plain(s.chip || s.title), sentence: true, src: { screen: s.id, page: (s.pages || [])[0], title: DT.plain(s.title) } });
    }));
    return out;
  };
  W.allTerms = (tb) => allTerms(tb);
  function selfItems(tb, subs) {
    const crit = [];
    subs.forEach((u) => (u.standards || []).forEach((st, i) => crit.push({ id: u.id + '.s' + i, text: st.can || st.text, code: st.code })));
    if (!crit.length) subs.forEach((u) => crit.push({ id: u.id + '.s', text: DT.plain(u.title) + '의 내용을 설명할 수 있어요' }));
    return [
      { id: 'self', type: 'self', label: '자기평가', criteria: crit, levels: W.levels },
      { id: 'reflect', type: 'reflect', label: '한 줄 정리', q: '오늘 배운 것을 내 말로 한 줄로 적어 보세요.', q2: '아직 궁금하거나 헷갈리는 것이 있다면 적어 주세요. (선택)' }
    ];
  }
  function groupItems(tb, screens) {
    const acts = []; screens.forEach((s) => blocksIn(s).forEach((b) => { if ((b.t === 'act') && b.group) acts.push({ b, s }); }));
    if (!acts.length) screens.forEach((s) => blocksIn(s).forEach((b) => { if (b.t === 'act') acts.push({ b, s }); }));
    const out = [{ id: 'roles', type: 'roles', label: '역할 나누기', roles: W.roles }];
    acts.forEach(({ b, s }) => {
      const prompts = (b.items && b.items.length) ? b.items : [b.x || ''];
      out.push({ id: 'g' + b.id, type: 'group', label: (b.label || '탐구') + (b.title ? ' · ' + DT.plain(b.title) : ''), intro: b.x && b.items ? b.x : '', prompts, draw: true, src: { screen: s.id, page: (s.pages || [])[0], title: DT.plain(s.title) } });
    });
    out.push({ id: 'peer', type: 'peer', label: '동료평가', criteria: W.peerCriteria });
    return out;
  }
  function careerItems(tb, subs) {
    const recs = []; subs.forEach((u) => (u.explore || []).forEach((e, i) => recs.push(Object.assign({ id: u.id + '.e' + i, sub: DT.plain(u.title) }, e))));
    return [{ id: 'career', type: 'career', label: '진로 탐구', recs, fields: W.fields }];
  }

  /* 학습지 미리 보기 (선생님용) — 보내기 전에 학생이 받을 문항·그림을 정답과 함께 본다 */
  W.preview = function (w) {
    const box = DT.el('div', { class: 'wsprev' });
    const keyTxt = (k) => String(k).split('|')[0];
    const ans = (t) => DT.el('div', { class: 'wsprev__ans', html: '<b>정답</b> ' + t });
    box.append(DT.el('p', { class: 'wsprev__lead' }, w.items.length + '문항 · 학생 화면에서는 한 문항씩 나와요. 분홍 칸이 정답이에요 (학생에게는 보이지 않아요).'));
    w.items.forEach((it, i) => {
      const card = DT.el('section', { class: 'wsprev__item' });
      card.append(DT.el('div', { class: 'wsprev__head' }, DT.el('span', { class: 'wsprev__no num' }, String(i + 1)), DT.el('span', { class: 'pill', html: DT.md(it.label || '문항') }), it.src && it.src.page ? DT.el('span', { class: 'wsprev__pg' }, '교과서 ' + it.src.page + '쪽') : null));
      if (it.type === 'blank') {
        let n = 0; card.append(DT.el('div', { class: 'wsprev__q', html: DT.md(String(it.x || '').replace(/\[\[([^\]]+)\]\]/g, () => '**( ' + (++n) + ' )**')) }));
        card.append(ans(it.answers.map((a, k) => '(' + (k + 1) + ') ' + DT.esc(a)).join('　')));
      } else if (it.type === 'self') {
        card.append(DT.el('ul', { class: 'wsprev__list' }, it.criteria.map((c) => DT.el('li', { html: DT.md(c.text) }))));
      } else if (it.type === 'reflect') {
        card.append(DT.el('div', { class: 'wsprev__q' }, it.q), DT.el('div', { class: 'wsprev__q' }, it.q2));
      } else if (it.type === 'career') {
        card.append(DT.el('ul', { class: 'wsprev__list' }, (it.recs || []).map((r) => DT.el('li', { html: DT.md((r.fields || []).join('·') + ' — ' + (r.q || r.idea || '')) }))));
      } else if (it.type === 'group') {
        if (it.intro) card.append(DT.el('div', { class: 'wsprev__q', html: DT.md(it.intro) }));
        card.append(DT.el('ol', { class: 'wsprev__list' }, (it.prompts || []).map((p) => DT.el('li', { html: DT.md(p) }))));
      } else if (it.type === 'roles' || it.type === 'peer') {
        card.append(DT.el('div', { class: 'wsprev__q' }, it.type === 'roles' ? '모둠 안에서 맡을 역할을 고릅니다.' : '모둠 친구를 서로 평가합니다.'));
      } else {
        if (it.q) card.append(DT.el('div', { class: 'wsprev__q', html: DT.md(it.q) }));
        if (it.sub && it.sub.length) card.append(DT.el('ol', { class: 'wsprev__list' }, it.sub.map((s) => DT.el('li', { html: DT.md(s) }))));
        if (it.choices) card.append(DT.el('ol', { class: 'wsprev__list' }, it.choices.map((c) => DT.el('li', { html: DT.md(c) }))));
        if (it.key && it.key.length) card.append(ans(it.key.map((k) => DT.esc(keyTxt(k))).join(', ')));
        else if (it.ans) card.append(ans(DT.md(it.ans) + ' <small>(학생은 사진·필기로 제출)</small>'));
      }
      if (it.figs && it.figs.length) { const f = DT.el('div', { class: 'wsprev__figs' }); it.figs.forEach((src) => { const im = DT.el('img', { alt: '교과서 그림' }); DT.data.asset(src).then((u) => { im.src = u; }); f.append(im); }); card.append(f); }
      box.append(card);
    });
    return box;
  };
  W.openPreview = (w) => DT.modal({ title: '학습지 미리 보기 · ' + (w.title || ''), body: W.preview(w), wide: true, cls: 'modal--tall', actions: [{ label: '돌아가기' }] });

  /* 학습지 만들기 → { title, kind, items, scope, subunitIds } */
  W.build = function (tb, scope, kind, opt) {
    opt = opt || {};
    const screens = screensIn(tb, scope); const subs = subsOf(tb, scope);
    let items = [];
    if (kind === 'concept') items = blankItems(tb, screens);
    else if (kind === 'practice') items = probItems(tb, screens, subs);
    else if (kind === 'variant') items = variantItems(subs, 2);
    else if (kind === 'group') items = groupItems(tb, screens);
    else if (kind === 'self') items = selfItems(tb, subs);
    else if (kind === 'career') items = careerItems(tb, subs);
    else {
      const bl = blankItems(tb, screens); const pr = probItems(tb, screens, subs).filter((i) => i.type !== 'open');
      items = DT.shuffle(bl, 7).slice(0, 3).concat(pr.slice(0, 3), selfItems(tb, subs));
      kind = 'exit';
    }
    if (opt.max) items = items.slice(0, opt.max);
    const title = opt.title || (subs.map((u) => DT.plain(u.title)).join(', ') + ' · ' + W.kindName(kind));
    return { title, kind, items, scope, subunitIds: subs.map((u) => u.id) };
  };

  /* 학생별 복습: 그동안 틀린 문항 중 최근 것부터 3개 */
  W.buildReview = function (assignments, subs, roster, n) {
    n = n || 3; const per = {};
    roster.forEach((r) => {
      const wrong = [];
      subs.filter((s) => s.key === r.key && s.submittedAt).sort((a, b) => b.submittedAt - a.submittedAt).forEach((s) => {
        const a = assignments.find((x) => x.id === s.aid); if (!a) return;
        (a.items || []).forEach((it) => { const res = (s.results || {})[it.id]; if (res && res.correct === false && W.autoGraded(it) && !wrong.find((w) => w.id === it.id)) wrong.push(Object.assign({}, it, { from: a.title })); });
      });
      per[r.key] = wrong.slice(0, n);
    });
    return per;
  };

  W.autoGraded = (it) => ['blank', 'short', 'choice', 'ox'].includes(it.type);
  W.needsTeacher = (it) => ['open', 'group', 'career', 'reflect'].includes(it.type);

  /* 채점 → { correct: true|false|null, parts?:[bool], feedback } */
  W.grade = function (it, ans) {
    const hint = it.src && it.src.page ? '교과서 ' + it.src.page + '쪽 「' + (it.src.title || '') + '」을 다시 보세요.' : '';
    const step = it.sol && it.sol[0] ? ' 실마리: ' + DT.plain(it.sol[0]) : '';
    if (it.type === 'blank') {
      const a = Array.isArray(ans) ? ans : [];
      const parts = it.answers.map((k, i) => DT.norm(a[i]) === DT.norm(k));
      const ok = parts.every(Boolean);
      return { correct: ok, parts, feedback: ok ? '모두 맞았어요.' : parts.filter((x) => !x).length + '칸을 다시 보세요. ' + hint };
    }
    if (it.type === 'short') {
      if (ans == null || String(ans).trim() === '') return { correct: false, feedback: '답을 적지 않았어요. ' + hint };
      const keys = (it.key || []).flatMap((k) => String(k).split('|'));
      let ok = keys.some((k) => DT.norm(k) === DT.norm(ans));
      if (!ok && it.mode === 'num') { const v = DT.numVal(ans); ok = !isNaN(v) && keys.some((k) => { const kv = DT.numVal(k); return !isNaN(kv) && Math.abs(kv - v) < 1e-6 * Math.max(1, Math.abs(kv)); }); }
      return { correct: ok, feedback: ok ? '맞았어요.' : '다시 풀어 보세요.' + step + ' ' + hint };
    }
    if (it.type === 'choice' || it.type === 'ox') {
      const ok = String(ans) === String((it.key || [])[0]);
      return { correct: ok, feedback: ok ? '맞았어요.' : hint };
    }
    return { correct: null, feedback: '' };
  };

  /* 제출 채점 */
  W.gradeAll = function (assignment, answers, items) {
    items = items || assignment.items || [];
    const results = {}; let c = 0, t = 0;
    items.forEach((it) => { if (!W.autoGraded(it)) return; const r = W.grade(it, answers[it.id]); results[it.id] = r; t++; if (r.correct) c++; });
    return { results, score: { correct: c, total: t } };
  };

  /* 진로 탐구 추천: 고른 계열에 맞는 교과서 속 탐구 거리 */
  W.recommend = function (recs, field) {
    const hit = recs.filter((r) => (r.fields || []).includes(field));
    return hit.length ? hit : recs.slice(0, 3);
  };
})();

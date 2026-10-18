/* 디지털교과서 엔진 · records.js — 누적 기록 계산 (학생 한 명의 학기 전체, 성취기준, 생기부 근거, 담임 공유)
   여기서는 계산만 한다. 화면은 teacher.js가 그린다.
   원칙: 학생이 실제로 한 것(제출·관찰·신호)만 쓴다. 없는 것을 지어내지 않는다. */
(function () {
  'use strict';
  const DT = window.DT;
  const R = (DT.rec = {});
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const itemsFor = (a, key) => (a.perStudent ? (a.perStudent[key] || []) : a.items || []);
  R.itemsFor = itemsFor;

  /* ctx = { tb, assignments, subs, roster, obs, signals } */
  R.profile = function (key, ctx) {
    const as = ctx.assignments.filter((a) => itemsFor(a, key).length).sort((a, b) => a.createdAt - b.createdAt);
    const mine = ctx.subs.filter((s) => s.key === key);
    const done = mine.filter((s) => s.submittedAt);
    const series = as.map((a, i) => {
      const s = done.find((x) => x.aid === a.id);
      const cls = ctx.subs.filter((x) => x.aid === a.id && x.submittedAt && x.score && x.score.total).map((x) => x.score.correct / x.score.total);
      return { a, i, me: s && s.score && s.score.total ? s.score.correct / s.score.total : null, cls: avg(cls), submitted: !!s };
    });
    const concept = {};
    done.forEach((s) => { const a = as.find((x) => x.id === s.aid); if (!a) return; itemsFor(a, key).forEach((it) => { const r = (s.results || {})[it.id]; if (!r || r.correct == null) return; const k = (it.src && it.src.title) || '기타'; (concept[k] = concept[k] || []).push(r.correct ? 1 : 0); }); });
    const self = []; done.forEach((s) => { const a = as.find((x) => x.id === s.aid); if (!a) return; itemsFor(a, key).forEach((it) => { if (it.type === 'self' && s.answers && s.answers[it.id]) it.criteria.forEach((c) => { const lv = s.answers[it.id][c.id]; if (lv != null) self.push({ at: s.submittedAt, text: c.text, level: lv }); }); }); });
    const peer = { scores: {}, comments: [] };
    ctx.subs.forEach((s) => { Object.values(s.answers || {}).forEach((v) => { if (v && typeof v === 'object' && v[key] && v[key].scores) { Object.entries(v[key].scores).forEach(([c, n]) => (peer.scores[c] = (peer.scores[c] || []).concat(n))); if (v[key].comment) peer.comments.push(v[key].comment); } }); });
    const career = []; const reflects = []; const groupWork = []; const roles = [];
    done.forEach((s) => { const a = as.find((x) => x.id === s.aid); if (!a) return; itemsFor(a, key).forEach((it) => { const v = (s.answers || {})[it.id]; if (!v) return;
      if (it.type === 'career' && v.field) career.push(Object.assign({ at: s.submittedAt, title: a.title }, v));
      if (it.type === 'reflect' && (v.a || v.b)) reflects.push({ at: s.submittedAt, a: v.a, b: v.b, title: a.title });
      if (it.type === 'group' && v.text && v.text.some(Boolean)) groupWork.push({ at: s.submittedAt, title: it.label, text: v.text.filter(Boolean) });
      if (it.type === 'roles') { const r = DT.ws.roles.find((x) => x.id === v); if (r) roles.push(r.name); } }); });
    const fb = []; done.forEach((s) => { const a = as.find((x) => x.id === s.aid); if (s.overall) fb.push({ at: s.checkedAt || s.submittedAt, text: s.overall, title: a ? a.title : '' }); Object.entries(s.feedback || {}).forEach(([k, f]) => { if (k !== '_overall' && f && f.text) fb.push({ at: f.at || s.submittedAt, text: f.text, title: a ? a.title : '' }); }); });
    const sig = { g: 0, y: 0, r: 0 }; (ctx.signals || []).filter((x) => x.key === key).forEach((x) => (sig[x.level] = (sig[x.level] || 0) + 1));
    const obs = (ctx.obs || []).filter((o) => o.key === key).sort((a, b) => b.at - a.at);
    const tags = {}; obs.forEach((o) => (tags[o.tag] = (tags[o.tag] || 0) + 1));
    const rates = series.filter((x) => x.me != null).map((x) => x.me);
    return {
      key, assignments: as, series, submitted: done.length, total: as.length, avg: avg(rates),
      first: rates[0], last: rates[rates.length - 1],
      concept: Object.entries(concept).map(([k, v]) => ({ label: k, value: avg(v), n: v.length })),
      self, peer: { avg: Object.fromEntries(Object.entries(peer.scores).map(([c, v]) => [c, avg(v)])), comments: peer.comments },
      career, reflects, groupWork, roles, feedback: fb.sort((a, b) => b.at - a.at), signals: sig, obs, tags
    };
  };

  /* 성취기준별 수준 */
  R.standards = function (ctx) {
    const out = [];
    ctx.tb._subunits.forEach((u) => (u.standards || []).forEach((st) => {
      const screens = new Set(u.screens.map((s) => s.id));
      const per = ctx.roster.map((r) => {
        const v = [];
        ctx.subs.filter((s) => s.key === r.key && s.submittedAt).forEach((s) => { const a = ctx.assignments.find((x) => x.id === s.aid); if (!a) return; itemsFor(a, r.key).forEach((it) => { const rr = (s.results || {})[it.id]; if (rr && rr.correct != null && it.src && screens.has(it.src.screen)) v.push(rr.correct ? 1 : 0); }); });
        const a = avg(v); return { r, value: a, n: v.length, level: a == null ? null : a >= 0.8 ? 0 : a >= 0.5 ? 1 : 2 };
      });
      const vals = per.filter((p) => p.value != null).map((p) => p.value);
      out.push({ code: st.code, text: st.text, sub: u, per, avg: avg(vals), dist: [0, 1, 2].map((l) => per.filter((p) => p.level === l).length), none: per.filter((p) => p.level == null).length });
    }));
    return out;
  };

  /* 생기부생성기 '일괄입력' 형식 한 줄 (근거 모음 — 문장은 생기부생성기가 규칙대로 씀) */
  R.HEAD = ['학번', '이름', '영역', '과목_활동명', '활동내용', '질문_사고', '결과_산출물', '태도', '진로연계', '교사관찰', '성적추이(참고용·본문미기재)', '이전학기생기부'];
  R.saenggibuRow = function (r, ctx) {
    const p = R.profile(r.key, ctx); const course = DT.plain(ctx.tb.meta.course || ctx.tb.meta.title);
    const did = p.series.filter((x) => x.submitted).map((x) => "'" + DT.plain(x.a.title) + "' " + DT.ws.kindName(x.a.kind));
    const acts = did.slice(0, 6).join(', ') + (p.groupWork.length ? ' / 모둠 탐구 ' + p.groupWork.map((g) => "'" + DT.plain(g.title) + "'").join(', ') + (p.roles.length ? '(' + Array.from(new Set(p.roles)).join('·') + ' 역할)' : '') : '');
    const q = p.reflects.map((x) => x.b).filter(Boolean).slice(0, 3).join(' / ');
    const out = [].concat(p.groupWork.map((g) => DT.plain(g.title) + ': ' + g.text.join(' · ')).slice(0, 2), p.career.map((c) => '탐구 계획 "' + (c.question || '') + '"' + (c.method ? ' — ' + c.method : ''))).join(' / ');
    const tagTxt = Object.entries(p.tags).filter(([t]) => t !== '집중 필요').map(([t, n]) => t + ' ' + n + '회').join(', ');
    const attitude = [p.total ? '학습지 ' + p.submitted + '/' + p.total + '회 제출' : '', tagTxt].filter(Boolean).join(', ');
    const car = p.career.length ? p.career[p.career.length - 1] : null;
    const career = car ? car.field + ' 관심 · ' + (car.link ? '교과서 연결: ' + car.link + ' · ' : '') + (car.question || '') : '';
    const obsTxt = p.obs.filter((o) => o.tag !== '집중 필요').slice(0, 5).map((o) => DT.date(o.at) + ' ' + (o.note || o.tag)).join(' / ');
    const trend = p.first != null ? '처음 ' + Math.round(p.first * 100) + '% → 최근 ' + Math.round(p.last * 100) + '% (평균 ' + Math.round(p.avg * 100) + '%)' : '';
    return [r.no, r.name, '교과세특', course, acts, q, out, attitude, career, obsTxt, trend, ''];
  };

  /* 담임 공유 — 학번으로 담임 반 찾기 (2315 → 2학년 3반, 20315 → 2학년 3반) */
  R.homeroomOf = (no) => { const s = String(no).replace(/\D/g, ''); return s.length === 4 ? s[0] + '학년 ' + (+s[1]) + '반' : s.length >= 5 ? s[0] + '학년 ' + (+s.slice(1, 3)) + '반' : ''; };
  R.homeroomRow = function (r, ctx) {
    const p = R.profile(r.key, ctx);
    const good = Object.entries(p.tags).filter(([t]) => t !== '집중 필요').sort((a, b) => b[1] - a[1]).map(([t, n]) => t + ' ' + n + '회').join(', ');
    const need = p.tags['집중 필요'] ? '집중이 흐트러지는 모습 ' + p.tags['집중 필요'] + '회' : '';
    const car = p.career.length ? p.career[p.career.length - 1] : null;
    const sigTot = p.signals.g + p.signals.y + p.signals.r;
    return {
      no: r.no, name: r.name,
      part: p.total ? p.submitted + '/' + p.total : '–',
      attitude: good || '기록 없음', need,
      career: car ? car.field + (car.question ? ' — "' + car.question + '"' : '') : '아직 없음',
      voice: sigTot ? '수업 중 이해도 신호 ' + sigTot + '회 (모르겠어요 ' + p.signals.r + '회)' : '',
      memo: p.obs.filter((o) => o.tag !== '집중 필요').slice(0, 2).map((o) => o.note || o.tag).join(' / ')
    };
  };

  /* 다음 수업 추천: 정답률 낮은 화면(개념) + 이해도 신호 */
  R.weakSpots = function (ctx, classId) {
    const m = {};
    ctx.subs.filter((s) => s.classId === classId && s.submittedAt).forEach((s) => { const a = ctx.assignments.find((x) => x.id === s.aid); if (!a) return; itemsFor(a, s.key).forEach((it) => { const r = (s.results || {})[it.id]; if (!r || r.correct == null || !it.src) return; const k = it.src.screen; m[k] = m[k] || { ok: 0, n: 0, r: 0, y: 0, g: 0 }; m[k].n++; if (r.correct) m[k].ok++; }); });
    (ctx.signals || []).filter((x) => x.classId === classId).forEach((x) => { const k = x.screenId; m[k] = m[k] || { ok: 0, n: 0, r: 0, y: 0, g: 0 }; m[k][x.level]++; });
    return Object.entries(m).filter(([id]) => ctx.tb._byId[id]).map(([id, v]) => {
      const acc = v.n ? v.ok / v.n : null; const st = v.g + v.y + v.r; const conf = st ? (v.r + v.y * 0.5) / st : null;
      const score = (acc == null ? 0.3 : 1 - acc) * 0.65 + (conf == null ? 0.2 : conf) * 0.35;
      return { id, s: ctx.tb._byId[id], acc, conf, n: v.n, score };
    }).sort((a, b) => b.score - a.score);
  };
})();

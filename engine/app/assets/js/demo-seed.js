/* 체험(demo) 모드용 가상 학급 데이터.
   실제 학생이 아니며, 처음 열었을 때 대시보드·누적 기록이 어떻게 보이는지 체험하기 위한 것이다.
   firebase 모드에서는 쓰이지 않는다. 선생님 화면 › 설정 › '체험 데이터 지우기'로 초기화. */
(function () {
  'use strict';
  const NAMES_A = ['강다윤', '김도현', '김서연', '김하준', '노은채', '문지호', '박서준', '박하린', '배유진', '서민재', '송예린', '신우진', '오채원', '유시우', '윤지안', '이건우', '이수아', '임태윤', '장하은', '전민서', '정우현', '조아린', '최서진', '한지율'];
  const NAMES_B = ['고은우', '권나연', '김민준', '김예서', '나현우', '류지원', '박지후', '백소율', '서윤호', '안다은', '양준서', '엄채아', '오세현', '이다인', '이준혁', '정서아', '조현서', '차민규', '최윤서', '하도윤', '허지민', '황보라'];
  /* 어느 교과서에나 맞는 말로 (교과서별 내용은 content에서 가져온다) */
  const REFLECT = ['오늘 배운 개념을 그림으로 설명할 수 있게 되었다.', '예제 풀이를 한 줄씩 따라가니 이해가 됐다.', '공식은 알겠는데 언제 써야 하는지 아직 헷갈린다.', '모형으로 직접 움직여 보니 더 잘 보였다.', '비슷한 문제를 더 풀어 보고 싶다.', '용어의 뜻을 정확히 기억해야겠다.', '친구 설명을 듣고 내가 틀린 이유를 알았다.'];
  const ASK = ['이 성질은 언제 써야 하나요?', '예제 풀이의 둘째 줄이 왜 그렇게 되나요?', '비슷한 문제를 더 풀어 볼 수 있나요?', ''];
  const TAGS = [['질문', '수업 중 핵심을 짚는 질문을 함'], ['발표', '모둠 생각을 정리해 발표함'], ['도움', '모둠 친구에게 풀이를 설명해 줌'], ['끝까지', '어려운 문제를 포기하지 않고 끝까지 해결함'], ['자료', '탐구 결과를 표로 깔끔하게 정리함'], ['집중 필요', '활동 중 집중이 흐트러짐'], ['3D 탐구', '모형을 직접 움직여 보며 개념을 스스로 확인함']];

  function rng(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); }

  window.DT_SEED = function (db, tbRaw) {
    const DT = window.DT; const r = rng(20261016);
    const tb = DT.render.flatten(tbRaw);
    const day = 86400000; const now = Date.now();
    db.classes = [{ id: '2-3', name: '2학년 3반', subject: '기하' }, { id: '2-5', name: '2학년 5반', subject: '기하' }];
    /* 학번: 학년·반·번호 두 자리 (2학년 3반 1번 = 2301) */
    db.roster = NAMES_A.map((n, i) => ({ key: 's23' + String(i + 1).padStart(2, '0'), no: '23' + String(i + 1).padStart(2, '0'), name: n, classId: '2-3', email: 's23' + String(i + 1).padStart(2, '0') + '@demo.school' }))
      .concat(NAMES_B.map((n, i) => ({ key: 's25' + String(i + 1).padStart(2, '0'), no: '25' + String(i + 1).padStart(2, '0'), name: n, classId: '2-5', email: 's25' + String(i + 1).padStart(2, '0') + '@demo.school' })));
    const ability = {}; const part = {}; const field = {};
    db.roster.forEach((s) => { ability[s.key] = 0.32 + r() * 0.62; part[s.key] = 0.7 + r() * 0.3; field[s.key] = DT.ws.fields[Math.floor(r() * DT.ws.fields.length)]; });
    ['s2307', 's2319'].forEach((k) => { ability[k] = 0.93; part[k] = 1; });
    ['s2312'].forEach((k) => { ability[k] = 0.3; part[k] = 0.6; });
    const sub = tb._subunits[0]; const ids = sub.screens.map((s) => s.id);
    /* 지난 학습지 제목은 이 교과서 화면 이름에서 만든다 */
    const T = (id) => DT.plain((tb._byId[id] || {}).title || sub.title); const ST = DT.plain(sub.title);
    const act = (sub.screens.find((x) => x.kind === 'activity') || sub.screens[Math.min(8, ids.length - 1)]).id;
    const prob = sub.screens.filter((x) => x.kind === 'problem').map((x) => x.id);
    const plan = [
      { kind: 'concept', scope: ids.slice(0, 3), ago: 19, title: T(ids[1] || ids[0]) + ' · 개념 빈칸 채우기' },
      { kind: 'practice', scope: prob.slice(0, 2).length ? prob.slice(0, 2) : ids.slice(3, 5), ago: 15, title: T(prob[0] || ids[3]) + ' · 연습 문제' },
      { kind: 'exit', scope: ids.slice(0, 7), ago: 12, title: ST + ' · 오늘 배운 것 확인' },
      { kind: 'group', scope: [act], ago: 8, title: T(act) + ' · 모둠 활동지' },
      { kind: 'practice', scope: prob.slice(2, 4).length ? prob.slice(2, 4) : ids.slice(5, 8), ago: 5, title: T(prob[2] || ids[5]) + ' · 연습 문제' },
      { kind: 'career', scope: ids, ago: 2, title: ST + ' · 진로 탐구' }
    ];
    const codes = (sub.standards || []).map((x) => x.code); if (!codes.length) codes.push('[예시]');
    db.assignments = []; db.submissions = []; db.observations = []; db.lessons = []; db.signals = []; db.questions = []; db.groups = []; db.live = []; db.liveAnswers = [];
    db.evalPlan = [{ id: 'plan', items: [
      { id: 'e1', name: '지필 1회고사', standards: codes, weight: 30, rubric: ['개념을 정확히 이해하고 문제를 해결함', '기본 문제는 해결하나 응용에 도움이 필요함', '개념의 뜻을 설명하기 어려워함'] },
      { id: 'e2', name: '수행평가 · 탐구 보고서', standards: codes, weight: 20, rubric: ['탐구 과정과 결과를 수학적으로 설명함', '탐구를 수행하고 결과를 정리함', '탐구 과정을 일부만 수행함'] }] }];
    ['2-3', '2-5'].forEach((cid) => {
      const roster = db.roster.filter((s) => s.classId === cid);
      const groups = []; const order = roster.slice().sort((a, b) => ability[b.key] - ability[a.key]); const n = Math.round(roster.length / 4);
      order.forEach((s, i) => { const row = Math.floor(i / n); const col = row % 2 === 0 ? i % n : n - 1 - (i % n); (groups[col] = groups[col] || []).push(s.key); });
      db.groups.push({ id: cid, classId: cid, groups, at: now - 9 * day });
      plan.forEach((p, pi) => {
        const w = DT.ws.build(tb, p.scope, p.kind, { title: p.title });
        const created = now - p.ago * day - 3 * 3600000;
        const a = Object.assign(w, { id: 'demo-' + cid + '-' + pi, classId: cid, courseId: 'demo', createdAt: created, due: p.ago <= 2 ? now + 3 * day : created + day, status: p.ago > 3 ? 'closed' : 'open' });
        if (p.kind === 'group') a.groups = groups;
        db.assignments.push(a);
        roster.forEach((s) => {
          if (r() > part[s.key] && p.ago > 2) return;
          if (p.ago <= 2 && r() < 0.35) return;
          const ab = ability[s.key] + (5 - pi) * -0.01 + pi * 0.02;
          const answers = {}; const results = {}; let c = 0, t = 0; const feedback = {};
          a.items.forEach((it) => {
            const ok = r() < ab;
            if (it.type === 'blank') { answers[it.id] = it.answers.map((k) => (ok || r() < 0.5 ? k : it.bank[Math.floor(r() * it.bank.length)])); }
            else if (it.type === 'short') { const k = String(it.key[0]).split('|')[0]; answers[it.id] = ok ? k : ['4', '8', '2√3', '30°', '6'][Math.floor(r() * 5)]; }
            else if (it.type === 'choice') answers[it.id] = ok ? String(it.key[0]) : String(1 + Math.floor(r() * 4));
            else if (it.type === 'ox') answers[it.id] = ok ? it.key[0] : (it.key[0] === 'O' ? 'X' : 'O');
            else if (it.type === 'self') { const lv = ab > 0.75 ? 0 : ab > 0.5 ? (r() < 0.6 ? 0 : 1) : (r() < 0.6 ? 1 : 2); const o = {}; it.criteria.forEach((cr) => (o[cr.id] = lv)); answers[it.id] = o; }
            else if (it.type === 'reflect') answers[it.id] = { a: REFLECT[Math.floor(r() * REFLECT.length)], b: ASK[Math.floor(r() * ASK.length)] };
            else if (it.type === 'roles') answers[it.id] = DT.ws.roles[Math.floor(r() * 4)].id;
            else if (it.type === 'group') answers[it.id] = { text: it.prompts.map((pp, i) => ['각자 푼 방법을 모아 비교함', '서로 다른 풀이를 표로 정리함', '모둠 생각을 한 문장으로 정리함'][i] || '함께 정리함') };
            else if (it.type === 'peer') { const mine = groups.find((g) => g.includes(s.key)) || []; const o = {}; mine.filter((k) => k !== s.key).forEach((k) => { o[k] = { scores: { part: 3 + Math.round(r() * 2), help: 3 + Math.round(r() * 2), role: 3 + Math.round(r() * 2) }, comment: ['설명을 잘해 줬다', '기록을 꼼꼼히 했다', '끝까지 같이 해 줬다', ''][Math.floor(r() * 4)] }; }); answers[it.id] = o; }
            else if (it.type === 'career') { const recs = DT.ws.recommend(it.recs, field[s.key]); const rc = recs[Math.floor(r() * recs.length)]; answers[it.id] = { field: field[s.key], rec: rc ? rc.id : '', question: rc ? DT.plain(rc.q) : '', method: '관련 자료를 찾아 계산해 보고 그래프로 정리하기', link: rc ? DT.plain(rc.from) : '' }; }
            else if (it.type === 'open') answers[it.id] = { text: '풀이를 적음' };
            if (DT.ws.autoGraded(it)) { const g = DT.ws.grade(it, answers[it.id]); results[it.id] = g; t++; if (g.correct) c++; }
          });
          const submittedAt = created + (1 + r() * 20) * 3600000 * (p.ago > 2 ? 1 : 0.2);
          const checked = p.ago > 6 ? true : r() < 0.3;
          if (checked && ab > 0.8) feedback['_overall'] = { text: '풀이 과정이 깔끔해요.', at: submittedAt + day };
          db.submissions.push({ id: a.id + '__' + s.key, aid: a.id, key: s.key, no: s.no, name: s.name, classId: cid, answers, results, score: { correct: c, total: t }, startedAt: submittedAt - 600000, submittedAt, checked, feedback, overall: feedback._overall ? feedback._overall.text : '' });
        });
      });
      roster.forEach((s) => {
        const k = Math.floor(r() * 3) + (ability[s.key] > 0.8 ? 2 : 0);
        for (let i = 0; i < k; i++) { const tg = ability[s.key] < 0.4 && r() < 0.5 ? TAGS[5] : TAGS[Math.floor(r() * 5) + (r() < 0.2 ? 1 : 0)] || TAGS[0]; db.observations.push({ id: 'o' + cid + s.key + i, key: s.key, classId: cid, tag: tg[0], note: tg[1], at: now - Math.floor(r() * 20) * day, by: 'teacher' }); }
      });
      [16, 9, 3].forEach((ago, li) => {
        const scr = ids.slice(li * 3, li * 3 + 4);
        const sig = {}; scr.forEach((id, j) => { sig[id] = { g: 10 + Math.floor(r() * 8), y: Math.floor(r() * 6) + (j === 2 ? 3 : 0), r: Math.floor(r() * 3) + (j === 2 ? 2 : 0) }; });
        db.lessons.push({ id: 'l' + cid + li, classId: cid, courseId: 'demo', startedAt: now - ago * day, endedAt: now - ago * day + 48 * 60000, screens: scr.map((id) => ({ id, title: DT.plain(tb._byId[id].title), ms: (6 + Math.floor(r() * 10)) * 60000, sig: sig[id] })), live: [{ qid: 'lq' + li, label: '문제 ' + (li + 1), text: '즉석 질문', n: roster.length - 2, ok: Math.floor(roster.length * (0.5 + r() * 0.35)) }], questions: [ASK[li]].filter(Boolean), assignments: [], hard: [scr[2]], memo: li === 1 ? '예제 풀이에서 많이 막힘. 다음 시간 모형으로 다시 보여 주기.' : '' });
        roster.forEach((s) => scr.forEach((id) => { const x = r() * (1.2 - ability[s.key]); db.signals.push({ id: cid + '__' + id + '__' + s.key, classId: cid, key: s.key, screenId: id, level: x < 0.35 ? 'g' : x < 0.6 ? 'y' : 'r', at: now - ago * day }); }));
      });
    });
  };
})();

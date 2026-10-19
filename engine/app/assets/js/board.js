/* 수업잇기 엔진 · board.js — 전자칠판 수업 화면
   평소: 교과서 내용 + 넘기기 + 판서 + 교과서 원본 탭.  나머지는 '수업 도구' 하나 안에. */
(function () {
  'use strict';
  const DT = window.DT; const $ = DT.$;
  const C = DT.config;
  const S = { tb: null, idx: 0, classId: null, className: '', cls: [], roster: [], surface: null, live: null, signals: [], questions: [], lesson: null, dwell: 0, seen: {}, timer: null };

  /* ── 화면 크기 맞추기 (1920×1080 통째로) ── */
  function fitStage() {
    const st = $('#stage'); const k = Math.min(innerWidth / 1920, innerHeight / 1080);
    st.style.transform = 'translate(-50%,-50%) scale(' + k + ')';
    st.style.transformOrigin = 'center'; st.style.left = '50%'; st.style.top = '50%';
  }

  /* 칠판 QR 로그인: 칠판에 QR → 선생님 휴대폰으로 찍고 「허락」 → 칠판이 선생님 계정으로 열림 (비밀번호 입력 없음) */
  async function qrLogin() {
    const fb = DT.dataLogin || DT.data;
    if (!fb.pairStart) return DT.toast('지금은 체험 모드라 로그인이 필요 없어요.');
    const box = DT.el('div', { style: { display: 'grid', justifyItems: 'center', gap: '14px', textAlign: 'center' } }, DT.el('p', { class: 'muted' }, 'QR을 준비하고 있어요…'));
    const m = DT.modal({ title: '휴대폰으로 칠판 열기', body: box, actions: [{ label: '닫기' }, { label: '이 컴퓨터에서 구글 로그인', onClick: async () => { await fb.signIn(); location.reload(); } }] });
    try {
      const uid = await fb.pairStart();
      const url = new URL('teacher.html?pair=' + encodeURIComponent(uid), location.href).href;
      box.innerHTML = '';
      box.append(DT.chart.qr(url, 300), DT.el('b', { style: { fontSize: '22px' } }, '선생님 휴대폰 카메라로 찍어 주세요'), DT.el('p', { class: 'muted', style: { margin: 0 } }, '휴대폰에서 학교 계정으로 로그인 → 「이 칠판 열기」를 누르면 끝이에요. 한 번 열면 이 칠판은 한 학기 동안 바로 열려요.'));
      const off = fb.onGrant(uid, () => { off && off(); box.innerHTML = '<b style="font-size:24px">열렸어요! 잠시만요…</b>'; setTimeout(() => location.reload(), 700); });
    } catch (e) { box.innerHTML = ''; box.append(DT.el('p', null, 'QR 로그인을 준비하지 못했어요. 「이 컴퓨터에서 구글 로그인」을 눌러 주세요. (' + (e.code || e.message) + ')')); }
    return m;
  }
  /* 활동을 칠판 위에 크게 띄워 직접 해 보기 (닫기 한 번) */
  function playExtra(url, title, full) {
    const root = DT.el('div', { class: 'overlay', role: 'dialog', 'aria-label': title || '활동', style: { position: 'fixed', inset: '0', zIndex: '60', background: 'var(--desk)', display: 'grid', gridTemplateRows: 'auto 1fr' } });
    const close = DT.el('button', { class: 'obtn obtn--ink', type: 'button', html: DT.icon('x') + '닫기', onclick: () => { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); root.remove(); } });
    const other = DT.el('button', { class: 'obtn', type: 'button', html: DT.icon('expand') + '안 보이면 새 창으로', onclick: () => window.open(url, '_blank') });
    root.append(DT.el('div', { class: 'overlay__bar', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--paper)' } }, DT.el('h2', { class: 'overlay__title', style: { margin: 0 } }, title || '활동'), DT.el('div', { style: { display: 'flex', gap: '8px' } }, other, close)),
      DT.el('iframe', { src: url, title: title || '활동', allow: 'fullscreen; accelerometer; gyroscope', style: { width: '100%', height: '100%', border: '0', background: '#fff' } }));
    document.body.append(root);
    if (full && root.requestFullscreen) root.requestFullscreen().catch(() => {});   /* 실시간 화면은 전체 화면으로 */
  }
  DT.on('extra-play', (o) => playExtra(o.url, o.title, o.full));

  /* 학생 접속 QR (로그인 없이도 띄울 수 있음) */
  async function studentQR() {
    const code = DT.data.joinCode ? await DT.data.joinCode().catch(() => '') : '';
    const url = DT.studentLink(code);
    const share = 'https://classroom.google.com/share?url=' + encodeURIComponent(url);
    DT.modal({ title: '학생 접속', wide: true, body: DT.el('div', { style: { display: 'grid', justifyItems: 'center', gap: '12px', textAlign: 'center' } },
      DT.chart.qr(url, 380), DT.el('b', { style: { fontSize: '26px' } }, '아이패드 카메라로 찍으세요'), DT.el('code', { style: { fontSize: '18px' } }, url)),
      actions: [{ label: '닫기' }, { label: '클래스룸에 올리기', icon: 'send', onClick: () => window.open(share, '_blank') }, { label: '주소 복사', kind: 'ink', icon: 'copy', onClick: (c) => { navigator.clipboard && navigator.clipboard.writeText(url); DT.toast('주소를 복사했어요.'); c(); } }] });
  }

  /* 칠판 링크 모드에서 「반 선택」: 학생 아이패드와 이으려면 로그인 */
  function linkInfo() {
    DT.modal({ title: '반 고르기', body: '<p>반을 고르려면 <b>휴대폰으로 QR을 한 번</b> 찍어 선생님 계정으로 열어 주세요. 그러면 반 목록이 나오고, 즉석 질문·학습지 보내기·학생 신호도 쓸 수 있어요.</p><p class="muted">지금은 로그인 없이 칠판만 쓰는 중이라 판서는 이 컴퓨터에만 남아요.</p>',
      actions: [{ label: '닫기' }, { label: '휴대폰 QR로 열기', kind: 'ink', icon: 'camera', onClick: (c) => { c(); qrLogin(); } }] });
  }

  /* 원본 보기가 바로 열리도록, 지금 화면 앞뒤의 쪽 그림을 뒤에서 미리 받아 둔다(기기에 저장됨) */
  async function prefetchPages() {
    const list = screens(); const seen = new Set();
    for (let i = Math.max(0, S.idx - 5); i < Math.min(list.length, S.idx + 25); i++) (list[i].pages || []).forEach((n) => seen.add(n));
    for (const n of seen) { try { await DT.data.pageSrc(n); } catch (e) { return; } }
  }

  /* ── 시작 ── */
  async function start() {
    fitStage(); addEventListener('resize', fitStage);
    paintStatic();
    try { await DT.data.init(); } catch (e) { return fatal('기록 저장소에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 열어 주세요. (' + e.message + ')'); }
    let me = DT.data.user();
    const linkKey = DT.qs().k;
    if (DT.data.mode === 'firebase' && (!me || me.role !== 'teacher') && linkKey) {   /* 칠판 링크: 로그인 없이 수업 */
      DT.dataLogin = DT.data; DT.data = DT.localBoard(linkKey); await DT.data.init(); me = null;
      setTimeout(() => DT.toast('지금 판서는 이 컴퓨터에만 저장돼요. 오른쪽 위 「휴대폰으로 열기」로 한 번 열면 어느 칠판에서든 자동으로 이어져요.'), 2500);
    }
    if (DT.data.mode === 'firebase' && (!me || me.role !== 'teacher')) return askLogin(me);
    if ((DT.data.mode === 'demo' || DT.data.mode === 'local') && !me) { me = { role: 'teacher', key: 'teacher', name: '선생님' }; await DT.data.signIn(me); }
    try { S.tb = DT.render.flatten(await DT.data.getCourse()); } catch (e) { return fatal(e.message); }
    DT.applySubject(S.tb.meta.subject);
    if (S.tb.meta.subject === '영어') { const rb = DT.el('button', { class: 'topbar__class', id: 'btnRead', type: 'button', title: '이 화면 읽어 주기' }); rb.onclick = readAloud; $('#btnClass').before(rb); paintRead(); }
    document.title = '수업 · ' + DT.plain(S.tb.meta.title);
    S.cls = await DT.data.listClasses();
    const q = DT.qs();
    S.classId = q.class || DT.store.get('board.class.' + C.courseId, null);
    if (S.classId && !S.cls.find((c) => c.id === S.classId)) S.classId = null;
    const startId = q.s || DT.store.get('board.pos.' + C.courseId + '.' + (S.classId || ''), null);
    S.idx = startId && S.tb._byId[startId] ? S.tb._byId[startId]._idx : 0;
    DT.ink.toolbar($('#inkDock'), { onBlank: openBlank, chalk: () => false });
    bindKeys();
    go(S.idx, 0);
    setTimeout(prefetchPages, 3000);
    if (q.class === 'none' || C.noStudents) await useClass(null); else if (!S.classId && S.cls.length) await pickClass(true); else await useClass(S.classId);
    if (!DT.store.get('board.coached', false)) setTimeout(coach, 500);
  }
  function fatal(msg) { $('#sheet').innerHTML = '<div class="page"><div class="page__head"><h2 class="page__title">열 수 없어요</h2></div><p style="font-size:30px;color:var(--ink-2)">' + DT.esc(msg) + '</p></div>'; }
  function askLogin(me) {
    $('#sheet').innerHTML = '';
    const p = DT.el('div', { class: 'page' }, DT.el('div', { class: 'page__head' }, DT.el('h2', { class: 'page__title' }, '선생님 계정으로 로그인해 주세요')),
      DT.el('p', { style: { fontSize: '30px', color: 'var(--ink-2)' } }, me && me.email ? (me.email + ' 계정은 선생님 명단에 없어요. 설정에서 선생님 계정을 등록했는지 확인해 주세요.') : '휴대폰 카메라로 QR을 찍으면 비밀번호 없이 열려요.'),
      DT.el('div', { style: { display: 'flex', gap: '14px', marginTop: '24px', flexWrap: 'wrap' } },
        DT.el('button', { class: 'obtn obtn--ink', html: DT.icon('qr') + '휴대폰 QR로 열기', onclick: qrLogin }),
        DT.el('button', { class: 'obtn', html: DT.icon('user') + '이 컴퓨터에서 구글 로그인', onclick: async () => { await DT.data.signIn(); location.reload(); } })));
    $('#sheet').append(p);
  }

  function paintStatic() {
    $('#btnToc').innerHTML = DT.icon('toc') + '<span>목차</span>';
    $('#btnTools').innerHTML = DT.icon('tools') + '<span>수업 도구</span>';
    $('#btnFull').innerHTML = DT.icon('expand');
    $('#btnPrev').innerHTML = DT.icon('left'); $('#btnNext').innerHTML = DT.icon('right');
    $('#btnPrev').onclick = () => step(-1); $('#btnNext').onclick = () => step(1);
    $('#btnToc').onclick = openToc; $('#btnTools').onclick = toggleTools; $('#btnFull').onclick = DT.fullscreen;
    $('#btnClass').onclick = () => (DT.data.mode === 'local' ? linkInfo() : pickClass(false));
    if (C.noStudents) $('#btnClass').hidden = true;   /* 수업 자료만: 반 없음 */
    $('#bookTab').onclick = () => openBook();
    document.addEventListener('fullscreenchange', () => { $('#btnFull').innerHTML = DT.icon(document.fullscreenElement ? 'shrink' : 'expand'); });
  }

  /* ── 반 ── */
  async function pickClass(first) {
    if (!first) S.cls = await DT.data.listClasses().catch(() => S.cls);   /* 학생이 방금 들어와 생긴 반도 보이게 */
    if (!S.cls.length) {
      await useClass(null);
      if (!first) DT.modal({ title: '아직 반이 없어요', body: '<p>학생이 <b>학생 접속 QR</b>로 들어와 학년·반·번호를 적으면 반이 저절로 생겨요.</p><p class="muted">그 뒤에 다시 「반 선택」을 누르면 반이 보여요.</p>',
        actions: [{ label: '닫기' }, { label: '학생 접속 QR 띄우기', kind: 'ink', icon: 'qr', onClick: (c) => { c(); studentQR(); } }] });
      return;
    }
    return new Promise((res) => {
      const box = DT.el('div', { class: 'classpick' });
      let m;
      S.cls.forEach((c) => box.append(DT.el('button', { type: 'button', onclick: async () => { m.close(); await useClass(c.id); res(); } }, c.name)));
      box.append(DT.el('button', { type: 'button', style: { fontFamily: 'var(--f-text)', fontSize: '20px', color: 'var(--ink-2)' }, onclick: async () => { m.close(); await useClass(null); res(); } }, '반 없이 보기'));
      m = DT.modal({ title: first ? '어느 반 수업인가요?' : '반 바꾸기', body: box, onClose: () => res() });
    });
  }
  let unsub = [];
  async function useClass(id) {
    unsub.forEach((f) => f()); unsub = [];
    S.classId = id; const c = S.cls.find((x) => x.id === id);
    S.className = c ? c.name : '';
    DT.store.set('board.class.' + C.courseId, id);
    $('#btnClass').innerHTML = DT.icon('users') + '<span>' + DT.esc(S.className || '반 선택') + '</span>';   /* 링크로 연 칠판도 같은 자리 · 누르면 휴대폰 QR 안내 */
    S.roster = id ? await DT.data.getRoster(id) : [];
    if (id) {
      unsub.push(DT.data.onSignals(id, (rows) => { S.signals = rows; paintLive(); }));
      const seenQ = new Set(); let qReady = false;   /* 새 익명 질문은 칠판 위에 바로 띄운다 (처음 불러온 지난 질문은 띄우지 않음) */
      unsub.push(DT.data.onQuestions(id, (rows) => { S.questions = rows; if (qReady) rows.filter((q) => !q.done && !seenQ.has(q.id)).forEach(popQuestion); rows.forEach((q) => seenQ.add(q.id)); qReady = true; paintLive(); }));
      startLesson();
    }
    if (S.tb) go(S.idx, 0);
  }

  /* ── 수업 기록(일지) ── */
  function startLesson() {
    const key = 'board.lesson.' + C.courseId + '.' + S.classId;
    const cur = DT.store.get(key, null);
    S.lesson = (cur && DT.ymd(cur.startedAt) === DT.ymd(Date.now())) ? cur : { id: DT.uid('l'), classId: S.classId, courseId: C.courseId, startedAt: Date.now(), screens: {}, live: [], assignments: [] };
    DT.store.set(key, S.lesson);
  }
  function tickLesson(screenId) {
    if (!S.lesson) return;
    const now = Date.now();
    if (S.lessonScreen) { const s = S.lesson.screens[S.lessonScreen] = S.lesson.screens[S.lessonScreen] || { ms: 0, first: now }; s.ms += Math.min(now - S.lessonAt, 20 * 60 * 1000); }
    S.lessonScreen = screenId; S.lessonAt = now;
    S.lesson.screens[screenId] = S.lesson.screens[screenId] || { ms: 0, first: now };
    DT.store.set('board.lesson.' + C.courseId + '.' + S.classId, S.lesson);
  }

  /* ── 화면 넘기기 ── */
  const screens = () => S.tb._screens;
  function step(d) {
    const page = $('#sheet .page');
    if (page) {
      if (d > 0 && (DT.render.revealNext(page) || DT.render.solNext(page))) { paintChrome(screens()[S.idx]); return; }
      if (d < 0 && DT.render.revealPrev(page)) return;
    }
    const n = S.idx + d;
    if (n < 0 || n >= screens().length) { DT.toast(d > 0 ? '마지막 화면이에요.' : '첫 화면이에요.'); return; }
    go(n, d);
  }
  function saveRevealState() {}
  function go(i, dir) {
    const s = screens()[i]; if (!s) return;
    S.idx = i;
    if (S.surface) { S.surface.destroy(); S.surface = null; }
    if (speaking) { speechSynthesis.cancel(); speaking = false; paintRead(); }
    if (DT.gloss) DT.gloss.close();
    const sheet = $('#sheet'); sheet.innerHTML = '';
    const page = DT.render.screen(s, { interactive: true, onQuestion: openFocus });
    page.style.setProperty('--base', '34px');
    if (dir) page.classList.add(dir > 0 ? 'is-enter' : 'is-enter-back');
    sheet.append(page);
    DT.render.fit(page);
    const surfKey = 'screen:' + s.id;
    const io = inkIO(surfKey);
    S.surface = new DT.ink.Surface(page, 1920 - 112 - 168, 1080 - 84 - 112 - 64, { key: surfKey, load: io.load, save: io.save });
    io.sync(S.surface);
    bindTerms(page);
    paintChrome(s);
    DT.store.set('board.pos.' + C.courseId + '.' + (S.classId || ''), s.id);
    history.replaceState(null, '', '#s=' + encodeURIComponent(s.id) + (S.classId ? '&class=' + encodeURIComponent(S.classId) : ''));
    if (S.classId) { tickLesson(s.id); DT.data.setLive(S.classId, { active: true, screenId: s.id, title: DT.plain(s.title), subunit: DT.plain(s._sub.title), courseId: C.courseId }).catch(() => {}); }
    paintLive();
  }
  /* 판서 저장: 이 기기 + 계정(Firestore). 반 없이 연 화면은 '준비' 판서 → 반으로 열면 그 위에서 시작 */
  const scope = () => S.classId || 'prep';
  function inkIO(key) {
    const lk = (sc) => DT.ink.storeKey(C.courseId, sc, key);
    return {
      load() { const mine = DT.store.get(lk(scope()), null); if (mine) return mine; return scope() !== 'prep' ? DT.store.get(lk('prep'), []) : []; },
      save(st) { const sc = scope(); DT.store.set(lk(sc), st); DT.store.set(lk(sc) + '.t', Date.now()); DT.later('ink:' + sc + ':' + key, () => DT.data.saveInk(sc, key, st).catch(() => {})); },
      /* 계정에 저장된 판서가 이 기기 것보다 최근이면(다른 칠판·PC에서 썼으면) 그것으로 바꾼다 */
      async sync(surf) {
        if (DT.data.mode !== 'firebase') return null;
        const sc = scope(); const local = DT.store.get(lk(sc), null); const lt = DT.store.get(lk(sc) + '.t', 0);
        let r = DT.data.getInkAt ? await DT.data.getInkAt(sc, key).catch(() => null) : null;
        if (!r && !local && sc !== 'prep') { const p = await DT.data.getInk('prep', key).catch(() => null); if (p) r = { st: p, at: 1 }; }
        if (r && (r.at || 0) > lt && JSON.stringify(r.st) !== JSON.stringify(local || [])) { DT.store.set(lk(sc), r.st); DT.store.set(lk(sc) + '.t', r.at || Date.now()); if (surf && surf.set) surf.set(r.st); return r.st; }
        /* 이 기기 것이 더 최근인데 서버에 못 올라갔으면(창을 바로 닫음·인터넷 끊김) 지금 올린다 */
        if (local && lt > ((r && r.at) || 0)) DT.data.saveInk(sc, key, local).catch(() => {});
        return null;
      }
    };
  }
  const saveInkRemote = () => {};

  /* 핵심어 눌러 뜻 보기 → 개념 화면·처음 나온 쪽에 다녀오면 「돌아가기」 */
  const back = [];
  function bindTerms(page) {
    DT.$$('.term', page).forEach((el) => {
      if (!DT.gloss.find(el.textContent)) return;
      el.dataset.gloss = '1'; el.setAttribute('role', 'button'); el.tabIndex = 0;
      const open = (e) => { e.stopPropagation(); const cur = screens()[S.idx];
        DT.gloss.pop(el, el.textContent, { onScreen: (id) => { if (id === cur.id) return; back.push(cur.id); const x = S.tb._byId[id]; go(x._idx, x._idx > S.idx ? 1 : -1); },
          onPage: (n) => openBook(n) }); };
      el.addEventListener('click', open); el.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e); });
    });
    DT.$$('.backchip').forEach((x) => x.remove());
    if (back.length) {
      const id = back[back.length - 1]; const x = S.tb._byId[id];
      const chip = DT.el('button', { class: 'backchip', type: 'button', html: DT.icon('left') + '「' + DT.esc(DT.plain(x.title)) + '」로 돌아가기' });
      chip.onclick = () => { back.pop(); go(x._idx, -1); };
      $('#layer').append(chip);
    }
  }

  /* 영어 교과서: 화면 읽어 주기 */
  let speaking = false;
  function readAloud() {
    if (speaking) { speechSynthesis.cancel(); speaking = false; paintRead(); return; }
    const page = $('#sheet .page'); if (!page || !('speechSynthesis' in window)) return;
    const parts = DT.$$('.page__title, .b-p, .b-def__body, .b-act__body, .b-act__items li, .b-list li, .b-q__body', page).filter((n) => /[A-Za-z]{2,}/.test(n.textContent));
    if (!parts.length) return DT.toast('이 화면에는 읽을 영어 문장이 없어요.');
    speaking = true; paintRead(); let i = 0;
    const voice = speechSynthesis.getVoices().find((v) => /en[-_](US|GB)/i.test(v.lang));
    const nextPart = () => { DT.$$('.is-reading').forEach((x) => x.classList.remove('is-reading')); if (!speaking || i >= parts.length) { speaking = false; paintRead(); return; } const n = parts[i++]; n.classList.add('is-reading'); const u = new SpeechSynthesisUtterance(n.textContent); u.lang = 'en-US'; if (voice) u.voice = voice; u.rate = DT.store.get('book.rate', 0.9); u.onend = nextPart; u.onerror = nextPart; speechSynthesis.speak(u); };
    nextPart();
  }
  function paintRead() { const b = $('#btnRead'); if (b) b.innerHTML = DT.icon(speaking ? 'pause' : 'play') + '<span>' + (speaking ? '멈추기' : '읽어 주기') + '</span>'; }

  function paintChrome(s) {
    const sub = s._sub; const path = sub._path || [];
    $('#crumb').innerHTML = path.map((n, i) => (i === path.length - 1 ? '<b>' : '') + DT.esc((n.no ? n.no + ' ' : '') + DT.plain(n.title)) + (i === path.length - 1 ? '</b>' : '')).join('<span class="sep">›</span>');
    const local = sub.screens; const li = s._local;
    $('#count').textContent = (li + 1) + ' / ' + local.length;
    $('#btnPrev').disabled = S.idx === 0;
    $('#btnNext').disabled = S.idx === screens().length - 1 && !document.querySelector('#sheet [data-reveal].is-hidden, #sheet .b-q__step[hidden], #sheet .b-q__ans[hidden]');
    const chips = $('#chips'); chips.innerHTML = '';
    for (let MAX = local.length; MAX >= 3; MAX--) {
      chips.innerHTML = '';
      let from = 0, to = local.length;
      if (local.length > MAX) { from = DT.clamp(li - Math.floor(MAX / 2), 0, local.length - MAX); to = from + MAX; }
      if (from > 0) chips.append(DT.el('span', { class: 'chipnav is-gap' }, '…'));
      local.slice(from, to).forEach((x, k) => {
        const j = from + k; const isQ = x.kind === 'problem' || x.kind === 'activity';
        const b = DT.el('button', { class: 'chipnav' + (isQ ? ' is-q' : '') + (j < li ? ' is-done' : '') + (j === li ? ' is-now' : ''), type: 'button', title: DT.plain(x.title), 'aria-current': j === li ? 'step' : null }, DT.plain(x.chip || x.title));
        b.onclick = () => go(x._idx, j > li ? 1 : -1);
        chips.append(b);
      });
      if (to < local.length) chips.append(DT.el('span', { class: 'chipnav is-gap' }, '…'));
      if (chips.scrollWidth <= chips.clientWidth + 1) break;
    }
    const tab = $('#bookTab');
    if (s.pages && s.pages.length && S.tb.pages && S.tb.pages.from != null) {
      tab.hidden = false;
      const a = s.pages[0], b2 = s.pages[s.pages.length - 1];
      tab.innerHTML = DT.icon('book') + '<span class="booktab__text">교과서</span><span class="booktab__pno num">' + (a === b2 ? '<b>' + a + '</b>' : '<b>' + a + '</b><i>–' + b2 + '</i>') + '<i>쪽</i></span>';
      tab.setAttribute('aria-label', '교과서 원본 ' + a + '쪽 펼치기');
    } else tab.hidden = true;
  }

  /* ── 교과서 원본 ── */
  function openBook(startAt) {
    const s = screens()[S.idx];
    const notes = {
      get: (n) => inkIO('notes:' + n).load(),
      save: (n, list) => inkIO('notes:' + n).save(list),
      async refresh(n) { if (DT.data.mode !== 'firebase') return false; const before = JSON.stringify(notes.get(n)); await inkIO('notes:' + n).sync(null); return JSON.stringify(notes.get(n)) !== before; }
    };
    DT.book.open({ start: typeof startAt === 'number' ? startAt : (s.pages || [])[0], inkGet: (key) => inkIO(key).load(), inkSave: (key, st) => inkIO(key).save(st), inkSync: (key) => inkIO(key).sync(null), notes,
      onScreen: (id) => { const x = S.tb._byId[id]; if (x) go(x._idx, x._idx > S.idx ? 1 : -1); },
      onClose: () => S.surface && S.surface.focus() });
  }

  /* ── 문제 크게 보기 + 판서 ── */
  function openFocus(b) {
    const s = b._screen;
    const ov = DT.el('div', { class: 'overlay' });
    const bar = DT.el('div', { class: 'overlay__bar' }, DT.el('h2', { class: 'overlay__title' }, (b.label || '문제') + (b.page ? ' · 교과서 ' + b.page + '쪽' : '')));
    const bg = DT.el('div', { class: 'bgpick', role: 'group', 'aria-label': '판서 바탕' });
    const board = DT.el('div', { class: 'focus__board', 'data-bg': DT.store.get('board.focusbg', 'grid') });
    [['grid', '모눈'], ['lines', '줄'], ['plain', '흰 바탕']].forEach(([v, t]) => { const x = DT.el('button', { type: 'button', 'aria-pressed': board.dataset.bg === v ? 'true' : 'false' }, t); x.onclick = () => { board.dataset.bg = v; DT.store.set('board.focusbg', v); DT.$$('button', bg).forEach((y) => y.setAttribute('aria-pressed', y === x ? 'true' : 'false')); }; bg.append(x); });
    const closeB = DT.el('button', { class: 'oclose', type: 'button', 'aria-label': '닫기 (Esc)', html: DT.icon('x') });
    bar.append(bg, closeB);
    const qside = DT.el('div', { class: 'focus__q' });
    const card = DT.el('div', { class: 'focus__card' });
    const one = Object.assign({}, b, { r: 0 });
    const fake = { id: s.id + ':focus', title: '', blocks: [one].concat((b._figs || []).map((f) => Object.assign({}, f, { r: 0, w: '80%' }))) };   /* 교과서 그림도 문제 아래에 함께 */
    const page = DT.render.screen(fake, { interactive: false });
    page.querySelector('.page__head').remove();
    card.append(page);
    const actions = DT.el('div', { class: 'focus__actions' });
    const ansBox = DT.el('div');
    if (b.sol && b.sol.length) {
      const sb = DT.el('button', { class: 'obtn', type: 'button', html: DT.icon('list') + (b.solLabel || '풀이') + ' 한 단계씩' });   /* 교과서가 '증명'이라 부르면 solLabel: '증명' */
      sb.onclick = () => { if (!DT.render.solNext(card)) { sb.disabled = true; } DT.render.fit(page, { max: 1.1 }); };
      actions.append(sb);
    }
    if (b.ans) {
      const ab = DT.el('button', { class: 'obtn', type: 'button', html: DT.icon('eye') + '정답 보기' });
      ab.onclick = () => { ansBox.innerHTML = ''; ansBox.append(DT.el('div', { class: 'focus__ans', html: '<b>정답</b>' + DT.md(b.ans) })); ab.disabled = true; };
      actions.append(ab);
    }
    if (S.classId && (b.grade || b.t === 'prob')) actions.append(DT.el('button', { class: 'obtn obtn--ink', type: 'button', html: DT.icon('send') + '학생에게 묻기', onclick: () => askFromBlock(b) }));
    qside.append(card, actions, ansBox);
    const main = DT.el('div', { class: 'focus' }, qside, board);
    ov.append(bar, main);
    $('#layer').append(ov);
    DT.render.fit(page, { max: 1.1 });
    const key = 'prob:' + b.id;
    const fio = inkIO(key); const surf = new DT.ink.Surface(board, 1220, 984, { key, load: fio.load, save: fio.save }); fio.sync(surf);
    const bar2 = DT.ink.toolbar(board, {});
    bar2.open(true);
    /* 그림 가져오기: 왼쪽 문제의 그림을 오른쪽 칠판에 크게 놓고 그 위에 바로 판서 (이 문제에서 다시 열면 그대로) */
    const figs = (b._figs || []).filter((f) => f.src);
    const figKey = 'focusfig.' + C.courseId + '.' + key;
    const figCtl = DT.el('div', { class: 'focus__figctl' });
    function placeFig(st) {
      DT.$$('.focus__figbg', board).forEach((x) => x.remove()); figCtl.innerHTML = ''; figCtl.remove();
      if (!st) { DT.store.del(figKey); return; }
      DT.store.set(figKey, st);
      const im = DT.el('img', { alt: '가져온 그림' }); DT.data.asset(figs[st.i].src).then((u) => { im.src = u; });
      board.prepend(DT.el('div', { class: 'focus__figbg', style: { width: Math.round(st.w * 100) + '%' } }, im));
      const sbtn = (t, label, fn) => DT.el('button', { class: 'obtn', type: 'button', 'aria-label': label, title: label, html: t, onclick: fn });
      figCtl.append(sbtn('－', '그림 작게', () => placeFig(Object.assign({}, st, { w: Math.max(0.3, st.w - 0.1) }))), sbtn('＋', '그림 크게', () => placeFig(Object.assign({}, st, { w: Math.min(1, st.w + 0.1) }))), sbtn(DT.icon('x') + '그림 빼기', '그림 빼기', () => placeFig(null)));
      board.append(figCtl);
    }
    if (figs.length) {
      figs.forEach((f, i) => actions.append(DT.el('button', { class: 'obtn', type: 'button', html: DT.icon('expand') + (figs.length > 1 ? '그림 ' + (i + 1) + ' ' : '그림 ') + '칠판으로', onclick: () => placeFig({ i, w: 0.7 }) })));
      const saved = DT.store.get(figKey, null); if (saved && figs[saved.i]) placeFig(saved);
    }
    const close = () => { surf.destroy(); bar2.el.remove(); DT.ink.set({ tool: 'hand' }); ov.remove(); S.surface && S.surface.focus(); popEsc(); };
    closeB.onclick = close; pushEsc(close);
  }

  /* ── 빈 칠판 ── */
  function openBlank() {
    const ov = DT.el('div', { class: 'overlay' });
    let n = 1; const bgNow = DT.store.get('board.blankbg', 'plain');
    const area = DT.el('div', { class: 'blank', 'data-bg': bgNow });
    const title = DT.el('h2', { class: 'overlay__title' }, '빈 칠판 1');
    const bg = DT.el('div', { class: 'bgpick' });
    [['plain', '흰 바탕'], ['grid', '모눈'], ['chalk', '초록 칠판']].forEach(([v, t]) => { const x = DT.el('button', { type: 'button', 'aria-pressed': bgNow === v ? 'true' : 'false' }, t); x.onclick = () => { area.dataset.bg = v; DT.store.set('board.blankbg', v); DT.$$('button', bg).forEach((y) => y.setAttribute('aria-pressed', y === x ? 'true' : 'false')); DT.ink.set({ color: v === 'chalk' ? DT.ink.palette.chalk[0] : DT.ink.palette.paper[0] }); tb.refresh(); }; bg.append(x); });
    const prevB = DT.el('button', { class: 'obtn', type: 'button', html: DT.icon('left') + '앞 장' });
    const nextB = DT.el('button', { class: 'obtn', type: 'button', html: '새 장' + DT.icon('plus') });
    const closeB = DT.el('button', { class: 'oclose', type: 'button', 'aria-label': '닫기', html: DT.icon('x') });
    ov.append(DT.el('div', { class: 'overlay__bar' }, title, bg, prevB, nextB, closeB), area);
    $('#layer').append(ov);
    let surf = null;
    const tb = DT.ink.toolbar(area, { chalk: () => area.dataset.bg === 'chalk' });
    const load = () => { if (surf) surf.destroy(); const key = 'blank:' + n; const bio = inkIO(key); surf = new DT.ink.Surface(area, 1920, 984, { key, load: bio.load, save: bio.save }); bio.sync(surf); title.textContent = '빈 칠판 ' + n; prevB.disabled = n === 1; };
    prevB.onclick = () => { n--; load(); }; nextB.onclick = () => { n++; load(); };
    load(); tb.open(true);
    if (area.dataset.bg === 'chalk') DT.ink.set({ color: DT.ink.palette.chalk[0] });
    const close = () => { surf.destroy(); tb.el.remove(); DT.ink.set({ tool: 'hand', color: DT.ink.palette.paper[0] }); ov.remove(); S.surface && S.surface.focus(); popEsc(); };
    closeB.onclick = close; pushEsc(close);
  }

  /* ── 목차 · 개념 찾기 ── */
  function openToc() {
    const tb = S.tb; const cur = screens()[S.idx];
    const units = tb.units || [];
    const root = DT.el('div', { class: 'toc', role: 'dialog', 'aria-label': '목차' });
    const search = DT.el('input', { type: 'search', placeholder: '개념이나 용어로 찾기', 'aria-label': '개념 찾기' });
    const unitBar = DT.el('div', { class: 'toc__units' });
    const closeB = DT.el('button', { class: 'oclose', type: 'button', 'aria-label': '닫기', html: DT.icon('x') });
    root.append(DT.el('div', { class: 'toc__bar' }, DT.el('h2', { class: 'toc__title' }, '목차'), DT.el('label', { class: 'toc__search', html: DT.icon('search') }, search), unitBar, closeB));
    const tree = DT.el('div', { class: 'toc__tree' }); const grid = DT.el('div', { class: 'toc__grid' });
    root.append(DT.el('div', { class: 'toc__main' }, tree, grid), DT.el('div', { class: 'toc__credit' }, DT.credit(tb)));
    let unitSel = units.find((u) => (cur._sub._path || [])[0] === u) || units[0]; let subSel = cur._sub;
    function paintUnits() {
      unitBar.innerHTML = '';
      if (units.length < 2) return;
      units.forEach((u) => { const b = DT.el('button', { class: 'toc__unit', type: 'button', title: DT.plain(u.title), 'aria-pressed': u === unitSel ? 'true' : 'false' }, u.no || DT.plain(u.title).slice(0, 4)); b.onclick = () => { unitSel = u; subSel = tb._subunits.find((x) => x._path[0] === u) || subSel; paint(); }; unitBar.append(b); });
    }
    function paintTree() {
      tree.innerHTML = '';
      tree.append(DT.el('div', { class: 'toc__mid', style: { fontSize: '22px', color: 'var(--ink)' } }, (unitSel.no ? unitSel.no + '. ' : '') + DT.plain(unitSel.title)));
      tb._subunits.filter((u) => u._path[0] === unitSel).forEach((u) => {
        const mid = u._path[u._path.length - 2];
        if (mid && mid !== unitSel && !tree.querySelector('[data-mid="' + mid.id + '"]')) tree.append(DT.el('div', { class: 'toc__mid', 'data-mid': mid.id }, (mid.no ? mid.no + '. ' : '') + DT.plain(mid.title)));
        const b = DT.el('button', { class: 'toc__sub', type: 'button', 'aria-current': u === subSel ? 'true' : 'false' }, DT.el('span', { class: 'no' }, u.no || ''), DT.el('span', null, DT.plain(u.title)), DT.el('span', { class: 'pg' }, u.pages ? u.pages[0] + '쪽' : ''));
        b.onclick = () => { subSel = u; paint(); }; tree.append(b);
      });
    }
    function tile(x, extra) {
      const b = DT.el('button', { class: 'toc__tile' + (x.kind === 'problem' || x.kind === 'activity' ? ' is-q' : '') + (extra || ''), type: 'button', 'aria-current': x === cur ? 'true' : 'false' },
        DT.el('span', { class: 'st' }, x.step || ''), DT.el('span', { class: 'tt', html: DT.md(x.title) }), DT.el('span', { class: 'pg' }, DT.render.pagesLabel(x.pages)));
      b.onclick = () => { close(); go(x._idx, x._idx > S.idx ? 1 : -1); };
      return b;
    }
    function paintGrid() { grid.innerHTML = ''; subSel.screens.forEach((x) => grid.append(tile(x))); }
    function paintSearch(qs) {
      grid.innerHTML = ''; const q = DT.norm(qs); if (!q) return paintGrid();
      const hits = [];
      (tb.glossary || []).forEach((g) => { if (DT.norm(g.term).includes(q) && tb._byId[g.screen]) hits.push({ s: tb._byId[g.screen], why: g.term }); });
      const texts = (bl) => (bl || []).map((x) => [x.x, x.q, x.label, x.title, x.cap].concat(x.items || [], x.sub || [], x.sol || []).filter(Boolean).join(' ') + ' ' + (x.cols ? x.cols.map(texts).join(' ') : '')).join(' ');
      tb._screens.forEach((s) => { const txt = DT.norm(DT.plain(s.title + ' ' + (s.chip || '') + ' ' + texts(s.blocks))); if (txt.includes(q) && !hits.find((h) => h.s === s)) hits.push({ s, why: '' }); });
      if (!hits.length) { grid.append(DT.el('p', { class: 'toc__empty' }, '"' + qs + '"이(가) 나오는 화면이 없어요. 다른 낱말로 찾아보세요.')); return; }
      hits.slice(0, 24).forEach((h) => grid.append(tile(h.s, ' toc__hit')));
    }
    function paint() { paintUnits(); paintTree(); search.value ? paintSearch(search.value) : paintGrid(); }
    search.addEventListener('input', () => paintSearch(search.value));
    $('#layer').append(root); paint();
    const close = () => { root.remove(); popEsc(); };
    closeB.onclick = close; pushEsc(close);
    setTimeout(() => search.focus(), 50);
  }

  /* ── 수업 도구 ── */
  function toggleTools() {
    const open = $('.toolmenu');
    if (open) { open.remove(); $('#btnTools').setAttribute('aria-expanded', 'false'); popEsc(); return; }
    const m = DT.el('div', { class: 'toolmenu', role: 'menu' });
    const nq = S.questions.filter((q) => !q.done).length;
    const item = (ic, t, d, fn, wide) => { const b = DT.el('button', { class: 'toolmenu__item' + (wide ? ' toolmenu__item--wide' : ''), type: 'button', role: 'menuitem', html: DT.icon(ic) + '<b>' + t + '</b><span>' + d + '</span>' }); b.onclick = () => { close(); fn(); }; m.append(b); };
    /* 반이 없으면 조용히 끝내지 않고 반 고르기 창을 띄운다 (링크로 연 칠판은 휴대폰 QR 안내) */
    const needClass = (fn) => () => (S.classId ? fn() : DT.data.mode === 'local' ? linkInfo() : pickClass(false));
    const NS = !!C.noStudents;   /* 수업 자료만 (태블릿 수업 안 함): 반·학생 기능 없이 칠판·판서·학습지 인쇄 */
    if (NS) item('send', '학습지 만들기 · 인쇄', '이 소단원 학습지를 골라 만들고 종이로 인쇄', openSend, true);
    else item('send', '학습지 보내기', '이 소단원 학습지를 학생 아이패드로', needClass(openSend), true);
    if (!NS) {
      item('ask', '학생에게 묻기', 'O/X · 고르기 · 짧은 답을 바로', needClass(() => openAsk(null)));
      item('signal', '이해도 · 질문함' + (nq ? '<i class="toolmenu__badge num">' + nq + '</i>' : ''), '학생들의 신호와 익명 질문', needClass(openSignals));
      item('users', '모둠 만들기', '정답률을 고려해 고르게 섞기', needClass(openGroups));
      item('dice', '발표자 뽑기', '무작위로 한 명', needClass(openPicker));
    }
    item('timer', '타이머', '1·3·5분, 화면 위에 작게', openTimer);
    item('board', '빈 칠판', '흰 바탕 · 모눈 · 초록 칠판', openBlank);
    if (!NS) { item('note', '수업 마치기', '오늘 진도와 반응을 일지로 저장', needClass(endLesson)); item('qr', '학생 접속 QR', '아이패드로 찍기 · 클래스룸에 올리기', studentQR); }
    item('palette', '화면 테마', '밝은 색 7가지 중 고르기', () => DT.theme.open());
    item('question', '사용 안내', '처음 안내와 단축키 다시 보기', coach);
    const close = () => { m.remove(); $('#btnTools').setAttribute('aria-expanded', 'false'); popEsc(); };
    $('#layer').append(m); $('#btnTools').setAttribute('aria-expanded', 'true'); pushEsc(close);
    setTimeout(() => document.addEventListener('pointerdown', function off(e) { if (!m.contains(e.target) && e.target !== $('#btnTools') && !$('#btnTools').contains(e.target)) { if (m.isConnected) close(); } document.removeEventListener('pointerdown', off, true); }, true), 0);
  }

  /* ── 학습지 보내기 ── */
  function openSend() {
    const s = screens()[S.idx]; const sub = s._sub;
    let kind = 'exit'; let scope = 'sub'; let due = 'today';
    const wrap = DT.el('div', { style: { display: 'grid', gap: '20px' } });
    const kinds = DT.el('div', { class: 'chips' });
    DT.ws.kinds.forEach((k) => { const b = DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': k.id === kind ? 'true' : 'false', title: k.desc, html: DT.icon(k.icon) + k.name }); b.onclick = () => { kind = k.id; DT.$$('.chip', kinds).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); paint(); }; kinds.append(b); });
    const scopes = DT.el('div', { class: 'chips' });
    [['sub', '이 소단원 전체 (' + DT.plain(sub.title) + ')'], ['upto', '처음부터 지금 화면까지'], ['now', '지금 화면만']].forEach(([v, t]) => { const b = DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': v === scope ? 'true' : 'false' }, t); b.onclick = () => { scope = v; DT.$$('.chip', scopes).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); paint(); }; scopes.append(b); });
    const dues = DT.el('div', { class: 'chips' });
    [['today', '오늘 수업 끝까지'], ['tomorrow', '내일까지'], ['week', '일주일 뒤까지']].forEach(([v, t]) => { const b = DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': v === due ? 'true' : 'false' }, t); b.onclick = () => { due = v; DT.$$('.chip', dues).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); }; dues.append(b); });
    const prev = DT.el('div', { style: { fontSize: '16px', color: 'var(--ink-2)', padding: '12px 16px', borderRadius: '12px', background: 'var(--paper-2)' } });
    const lab = (t, n) => DT.el('div', { class: 'field' }, DT.el('span', null, t), n);
    wrap.append(lab('무엇을', kinds), lab('어디까지', scopes), prev);   /* 기한 없음 (선생님 결정 2026-10-19) */
    function ids() { if (scope === 'now') return [s.id]; if (scope === 'upto') return sub.screens.slice(0, s._local + 1).map((x) => x.id); return sub.screens.map((x) => x.id); }
    function paint() { const w = DT.ws.build(S.tb, ids(), kind); const n = w.items.length; prev.innerHTML = n ? '<b style="color:var(--ink)">' + n + '문항</b>이 만들어져요 — ' + DT.esc(w.items.slice(0, 4).map((i) => DT.plain(i.label)).join(', ')) + (n > 4 ? ' …' : '') : '이 범위에는 이 종류로 만들 내용이 없어요. 범위를 넓히거나 다른 종류를 골라 주세요.'; }
    paint();
    async function sendW(w, close) {
      if (!w.items.length) return DT.toast('만들 문항이 없어요.', 'bad');
      const bad = DT.ws.check ? DT.ws.check(w) : ''; if (bad) return DT.toast(bad, 'bad');
      const d = new Date(); if (due === 'today') d.setHours(23, 59, 0, 0); else if (due === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(23, 59, 0, 0); } else { d.setDate(d.getDate() + 7); d.setHours(23, 59, 0, 0); }
      if (w.items.some((it) => it.type === 'group') && !w.groups) w.groups = await DT.data.getGroups(S.classId);
      const a = await DT.data.createAssignment(Object.assign(w, { classId: S.classId, courseId: C.courseId, due: null }));
      if (S.lesson) { S.lesson.assignments.push(a.id); DT.store.set('board.lesson.' + C.courseId + '.' + S.classId, S.lesson); }
      close(); DT.toast(S.className + '에 보냈어요. 학생 화면에 바로 나타나요.');
    }
    /* 직접 고르기: 원하는 문제만 넣고 빼고, 빈칸 고르기, 내 문제 쓰기 */
    function editW(close0) {
      const w = DT.ws.build(S.tb, ids(), kind); w.kind = 'custom'; const pool = DT.ws.pool(S.tb, ids()); close0();
      DT.modal({ title: '학습지 직접 고르기', body: DT.ws.editor(w, pool), wide: true, cls: 'modal--tall modal--xl', sticky: true, actions: [{ label: '닫기' },
        { label: '미리 보기', icon: 'eye', onClick: () => (w.items.length ? DT.ws.openPreview(w) : DT.toast('문항이 없어요.', 'bad')) },
        { label: '인쇄', icon: 'print', onClick: () => (!w.items.length ? DT.toast('문항이 없어요.', 'bad') : DT.ws.check(w) ? DT.toast(DT.ws.check(w), 'bad') : DT.ws.print(w, S.className)) },
        { label: S.className + '에 보내기', kind: 'ink', icon: 'send', onClick: (close) => sendW(w, close) }] });
    }
    if (C.noStudents) {   /* 수업 자료만: 만들고 인쇄 */
      return DT.modal({ title: '학습지 만들기 · 인쇄', body: wrap, wide: true, actions: [{ label: '닫기' },
        { label: '미리 보기', icon: 'eye', onClick: () => { const w = DT.ws.build(S.tb, ids(), kind); if (!w.items.length) return DT.toast('만들 문항이 없어요.', 'bad'); DT.ws.openPreview(w); } },
        { label: '문제 모음 PDF·인쇄', icon: 'download', onClick: () => { const w = DT.ws.compile(S.tb, ids()); if (!w.items.length) return DT.toast('이 범위에는 문제가 없어요.', 'bad'); DT.ws.print(w, '', { sections: true }); } },
        { label: '직접 고르기', icon: 'pencil', onClick: (c0) => { const w = DT.ws.build(S.tb, ids(), kind); w.kind = 'custom'; const pool = DT.ws.pool(S.tb, ids()); c0();
          DT.modal({ title: '학습지 직접 고르기', body: DT.ws.editor(w, pool), wide: true, cls: 'modal--tall modal--xl', sticky: true, actions: [{ label: '닫기' }, { label: '미리 보기', icon: 'eye', onClick: () => (w.items.length ? DT.ws.openPreview(w) : DT.toast('문항이 없어요.', 'bad')) },
            { label: '인쇄', kind: 'ink', icon: 'print', onClick: () => (!w.items.length ? DT.toast('문항이 없어요.', 'bad') : DT.ws.check(w) ? DT.toast(DT.ws.check(w), 'bad') : DT.ws.print(w, '')) }] }); } },
        { label: '인쇄', kind: 'ink', icon: 'print', onClick: () => { const w = DT.ws.build(S.tb, ids(), kind); if (!w.items.length) return DT.toast('만들 문항이 없어요.', 'bad'); DT.ws.print(w, ''); } }] });
    }
    DT.modal({ title: S.className + '에 학습지 보내기', body: wrap, wide: true, actions: [{ label: '닫기' }, { label: '미리 보기', icon: 'eye', onClick: () => { const w = DT.ws.build(S.tb, ids(), kind); if (!w.items.length) return DT.toast('만들 문항이 없어요.', 'bad'); DT.ws.openPreview(w); } }, { label: '인쇄', icon: 'print', onClick: () => { const w = DT.ws.build(S.tb, ids(), kind); if (!w.items.length) return DT.toast('만들 문항이 없어요.', 'bad'); DT.ws.print(w, S.className); } }, { label: '직접 고르기', icon: 'pencil', onClick: (close) => editW(close) }, { label: '문제 모음 PDF·인쇄', icon: 'download', onClick: () => { const w = DT.ws.compile(S.tb, ids()); if (!w.items.length) return DT.toast('이 범위에는 문제가 없어요.', 'bad'); DT.ws.print(w, S.className, { sections: true }); } }, { label: '보내기', kind: 'ink', icon: 'send', onClick: async (close) => {
      const w = DT.ws.build(S.tb, ids(), kind); await sendW(w, close);
    } }] });
  }

  /* ── 학생에게 묻기 ── */
  function askFromBlock(b) {
    const g = b.grade || {};
    const type = g.type === 'choice' ? 'choice' : g.type === 'ox' ? 'ox' : 'short';
    if (!b.grade && b.t === 'prob') return sendAsk({ text: b.q + (b.sub && b.sub.length ? '\n' + b.sub.map((x, i) => '(' + (i + 1) + ') ' + x).join('   ') : ''), type: 'draw', key: [], label: b.label });   /* 그림·서술 문제: 그리기 판으로 */
    if (b.sub && b.sub.length > 1 && type === 'short') {   /* ⑴⑵… 여러 문항: 문항마다 칸을 나눠 묻는다 */
      const ks = Array.isArray(g.key) && g.key.length === b.sub.length ? g.key.map(String) : b.sub.map(() => '');
      return sendAsk({ text: b.q, type: 'short', parts: b.sub, pkeys: ks, key: [], label: b.label, mode: g.type });
    }
    sendAsk({ text: b.q, type, choices: g.choices, key: g.key != null ? [].concat(g.key) : (b.ans ? [DT.plain(b.ans)] : []), label: b.label, mode: g.type });
  }
  function openAsk() {
    const s = screens()[S.idx];
    const probs = []; (s.blocks || []).forEach((b) => { if (b.t === 'prob' || b.t === 'ex') probs.push(b); if (b.cols) b.cols.forEach((c) => c.forEach((bb) => { if (bb.t === 'prob' || bb.t === 'ex') probs.push(bb); })); });
    const wrap = DT.el('div', { style: { display: 'grid', gap: '16px' } });
    if (probs.length) {
      const list = DT.el('div', { class: 'chips' });
      probs.forEach((b) => list.append(DT.el('button', { class: 'chip', type: 'button', onclick: () => { m.close(); askFromBlock(b); } }, (b.label || '문제') + ' 묻기')));
      wrap.append(DT.el('div', { class: 'field' }, DT.el('span', null, '이 화면의 문제'), list));
    }
    const text = DT.el('textarea', { class: 'textarea', placeholder: '질문을 적거나 비워 두세요. 비워 두면 "지금 화면에 대한 답"으로 물어요.', rows: 2 });
    const types = DT.el('div', { class: 'chips' }); let type = 'ox';
    [['ox', 'O / X'], ['choice', '①②③④⑤ 고르기'], ['short', '짧은 답']].forEach(([v, t]) => { const b = DT.el('button', { class: 'chip', type: 'button', 'aria-pressed': v === type ? 'true' : 'false' }, t); b.onclick = () => { type = v; DT.$$('.chip', types).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); }; types.append(b); });
    wrap.append(DT.el('div', { class: 'field' }, DT.el('span', null, '직접 묻기'), text), DT.el('div', { class: 'field' }, DT.el('span', null, '답하는 방식'), types));
    const m = DT.modal({ title: '학생에게 묻기', body: wrap, wide: true, actions: [{ label: '닫기' }, { label: '보내기', kind: 'ink', icon: 'send', onClick: (c) => { c(); sendAsk({ text: text.value.trim() || DT.plain(s.title) + ' — 지금 화면에 대한 답', type, choices: type === 'choice' ? ['', '', '', '', ''] : null, key: [] }); } }] });
  }
  async function sendAsk(q) {
    q.qid = DT.uid('lq'); q.open = true; q.reveal = false; q.at = Date.now(); q.screenId = screens()[S.idx].id;
    try { await DT.data.setLive(S.classId, { question: JSON.parse(JSON.stringify(q)) }); }
    catch (e) { return DT.toast('학생에게 보내지 못했어요. 칠판을 휴대폰 QR로 다시 열어 주세요. (' + (e.code || e.message || e) + ')', 'bad'); }
    showAskPanel(q);
  }
  function showAskPanel(q) {
    $$remove('.askpanel');
    const p = DT.el('div', { class: 'askpanel', role: 'region', 'aria-label': '학생 응답' });
    const closeB = DT.el('button', { class: 'oclose', type: 'button', 'aria-label': '닫기', html: DT.icon('x') });
    const count = DT.el('div', { class: 'askpanel__count num' });
    const bars = DT.el('div', { class: 'askbars' });
    const reveal = DT.el('button', { class: 'obtn', type: 'button', html: DT.icon('eye') + '정답 공개' });
    const stop = DT.el('button', { class: 'obtn obtn--ink', type: 'button', html: DT.icon('check') + '응답 마감' });
    const foot = DT.el('div', { class: 'askpanel__foot' }, reveal, stop);
    if (DT.data.mode === 'demo') foot.append(DT.el('button', { class: 'obtn', type: 'button', html: DT.icon('users') + '예시 응답 넣기', title: '체험용: 가상 학생들의 응답을 넣어 봐요', onclick: () => demoAnswers(q) }));
    p.append(DT.el('div', { class: 'askpanel__head' }, DT.el('h3', { class: 'askpanel__title' }, q.label ? q.label + ' · 학생 응답' : '학생 응답'), closeB), DT.el('div', { class: 'askpanel__q', html: DT.md(q.text) }), count, bars, foot);
    $('#layer').append(p);
    let rows = [];
    const total = S.roster.length || 0;
    function paint() {
      count.innerHTML = rows.length + '명 응답 <span>/ ' + total + '명</span>';
      bars.innerHTML = '';
      const keys = (q.key || []).flatMap((k) => String(k).split('|')).map(DT.norm);
      let groups;
      if (q.type === 'ox') groups = ['O', 'X'].map((v) => [v, rows.filter((r) => r.value === v).length]);
      else if (q.type === 'choice') groups = (q.choices || []).map((c, i) => [String(i + 1), rows.filter((r) => String(r.value) === String(i + 1)).length, c]);   // 번호는 1부터 (교과서 ①=1)
      else if (q.parts) { paintParts(); return; }
      else if (q.type === 'draw') { paintDraw(); return; }
      else { const m = {}; rows.forEach((r) => { const k = DT.norm(r.value) || '(빈칸)'; m[k] = m[k] || [r.value, 0]; m[k][1]++; }); groups = Object.values(m).sort((a, b) => b[1] - a[1]).slice(0, 7); }
      const max = Math.max(1, ...groups.map((g) => g[1]));
      groups.forEach((g) => {
        const isKey = q.reveal && (q.type === 'choice' ? keys.includes(DT.norm(g[0])) : keys.includes(DT.norm(g[0])));
        const label = q.type === 'choice' ? (['①', '②', '③', '④', '⑤'][+g[0] - 1] || '') + ' ' + DT.plain(g[2] || '') : g[0];
        bars.append(DT.el('div', { class: 'askbar' + (isKey ? ' is-key' : '') }, DT.el('span', { class: 'askbar__label', title: label }, label), DT.el('div', { class: 'askbar__track' }, DT.el('div', { class: 'askbar__fill', style: { width: (g[1] / max * 100) + '%' } })), DT.el('span', { class: 'askbar__n' }, g[1] + '명')));
      });
    }
    /* 그림 답: 학생 그림을 작게 모아 보기 · 누르면 크게 */
    function paintDraw() {
      const grid = DT.el('div', { class: 'askdraws' });
      rows.forEach((r) => {
        const who = (S.roster.find((x) => x.key === r.key) || {}); const nm = who.name || '';
        const cell = DT.el('button', { class: 'askdraw', type: 'button', title: nm }, DT.drawThumb(r.value, 300, 180), DT.el('span', null, nm));
        cell.onclick = () => DT.modal({ title: nm + ' 학생 풀이', wide: true, body: DT.el('div', null, DT.drawThumb(r.value, 900, 520)) });
        grid.append(cell);
      });
      if (!rows.length) grid.append(DT.el('p', { class: 'muted' }, '학생들이 그려서 보내면 여기에 모여요.'));
      bars.append(grid);
    }
    /* 여러 문항: 문항마다 맞은 학생 수(정답 공개 뒤)와 많이 나온 답 */
    function paintParts() {
      q.parts.forEach((pt, i) => {
        const ks = String((q.pkeys || [])[i] || '').split('|').map(DT.norm).filter(Boolean);
        const pv = (r) => String(r.value || '').split(DT.PSEP)[i] || '';
        const m = {}; rows.forEach((r) => { const v = pv(r); const k = DT.norm(v) || '(빈칸)'; m[k] = m[k] || [v || '(빈칸)', 0]; m[k][1]++; });
        const groups = Object.values(m).sort((a, b) => b[1] - a[1]).slice(0, 3); const max = Math.max(1, rows.length);
        const right = rows.filter((r) => ks.includes(DT.norm(pv(r)))).length;
        bars.append(DT.el('div', { class: 'askpart', html: '<b>(' + (i + 1) + ')</b> ' + DT.md(pt) + (q.reveal && ks.length ? ' <span class="askpart__ok">맞음 ' + right + '명</span>' : '') }));
        groups.forEach((g) => { const isKey = q.reveal && ks.includes(DT.norm(g[0])); bars.append(DT.el('div', { class: 'askbar' + (isKey ? ' is-key' : '') }, DT.el('span', { class: 'askbar__label', title: g[0] }, g[0]), DT.el('div', { class: 'askbar__track' }, DT.el('div', { class: 'askbar__fill', style: { width: (g[1] / max * 100) + '%' } })), DT.el('span', { class: 'askbar__n num' }, g[1] + '명'))); });
      });
    }
    const off = DT.data.onLiveAnswers(S.classId, q.qid, (r) => { rows = r; paint(); });
    reveal.onclick = async () => { q.reveal = true; await DT.data.setLive(S.classId, { question: q }); paint(); reveal.disabled = true; };
    stop.onclick = async () => { q.open = false; await DT.data.setLive(S.classId, { question: q }); stop.disabled = true; record(); };
    function record() {
      if (!S.lesson) return;
      const keys = (q.key || []).flatMap((k) => String(k).split('|')).map(DT.norm);
      const ok = keys.length ? rows.filter((r) => keys.includes(DT.norm(r.value))).length : null;
      S.lesson.live = S.lesson.live.filter((x) => x.qid !== q.qid).concat([{ qid: q.qid, text: DT.plain(q.text).slice(0, 80), label: q.label, screenId: q.screenId, n: rows.length, ok }]);
      DT.store.set('board.lesson.' + C.courseId + '.' + S.classId, S.lesson);
    }
    closeB.onclick = async () => { off(); record(); if (q.open) { q.open = false; await DT.data.setLive(S.classId, { question: q }); } p.remove(); };
    paint();
  }
  async function demoAnswers(q) {
    const keys = (q.key || []).flatMap((k) => String(k).split('|'));
    for (const r of DT.shuffle(S.roster, 3).slice(0, Math.max(3, S.roster.length - 3))) {
      let v; const right = Math.random() < 0.68;
      if (q.type === 'ox') v = right && keys[0] ? keys[0] : (Math.random() < 0.5 ? 'O' : 'X');
      else if (q.type === 'choice') v = right && keys[0] != null ? String(keys[0]) : String(1 + Math.floor(Math.random() * (q.choices || [1, 2, 3, 4]).length));
      else v = right && keys[0] ? keys[0] : ['4', '8', '2√3', '모르겠어요'][Math.floor(Math.random() * 4)];
      await DT.data.sendLiveAnswer(S.classId, q.qid, r.key, v); await DT.sleep(60 + Math.random() * 120);
    }
  }
  function $$remove(sel) { DT.$$(sel).forEach((x) => x.remove()); }

  /* ── 이해도 신호 · 질문함 ── */
  function screenSignals(id) { const c = { g: 0, y: 0, r: 0 }; S.signals.filter((x) => x.screenId === id && Date.now() - x.at < 3 * 3600 * 1000).forEach((x) => (c[x.level] = (c[x.level] || 0) + 1)); return c; }
  function popQuestion(q) {
    const host = $('#qpops') || document.body.appendChild(DT.el('div', { id: 'qpops', class: 'qpops', 'aria-live': 'polite' }));
    const el = DT.el('button', { class: 'qpop', type: 'button', title: '눌러서 질문함 열기' }, DT.el('b', { html: DT.icon('ask') + '익명 질문' }), DT.el('span', null, q.text));
    el.onclick = () => { el.remove(); openSignals(); };
    host.append(el); while (host.children.length > 3) host.firstChild.remove();
    setTimeout(() => el.classList.add('is-out'), 9000); setTimeout(() => el.remove(), 9600);
  }
  function paintLive() {
    const box = $('#liveMini'); if (!S.classId || !S.tb) { box.hidden = true; return; }
    const s = screens()[S.idx]; const c = screenSignals(s.id); const nq = S.questions.filter((q) => !q.done).length;
    if (!c.g && !c.y && !c.r && !nq) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<span class="sig" title="알겠어요"><i class="dot dot--g"></i>' + c.g + '</span><span class="sig" title="조금 헷갈려요"><i class="dot dot--y"></i>' + c.y + '</span><span class="sig" title="모르겠어요"><i class="dot dot--r"></i>' + c.r + '</span>' + (nq ? '<span class="q">' + DT.icon('ask') + nq + '</span>' : '');
    box.onclick = openSignals;
  }
  function openSignals() {
    const s = screens()[S.idx];
    const wrap = DT.el('div', { style: { display: 'grid', gap: '18px' } });
    const c = screenSignals(s.id); const tot = c.g + c.y + c.r;
    const bar = DT.el('div', { style: { display: 'grid', gap: '10px' } });
    [['g', '알겠어요', 'var(--ok)'], ['y', '조금 헷갈려요', '#E5A100'], ['r', '모르겠어요', 'var(--bad)']].forEach(([k, t, col]) => bar.append(DT.el('div', { style: { display: 'grid', gridTemplateColumns: '150px 1fr 60px', gap: '12px', alignItems: 'center', fontSize: '17px', fontWeight: '700' } }, DT.el('span', null, t), DT.el('div', { style: { height: '26px', borderRadius: '6px', background: 'var(--paper-2)', overflow: 'hidden' } }, DT.el('div', { style: { height: '100%', width: (tot ? c[k] / tot * 100 : 0) + '%', background: col } })), DT.el('span', { class: 'num', style: { textAlign: 'right' } }, c[k] + '명'))));
    wrap.append(DT.el('div', { class: 'field' }, DT.el('span', null, '지금 화면 「' + DT.plain(s.title) + '」 이해도'), tot ? bar : DT.el('p', { style: { margin: 0, color: 'var(--ink-2)' } }, '아직 신호를 보낸 학생이 없어요. 학생 아이패드 아래쪽의 세 단추로 보내요.')));
    const qs = S.questions.filter((q) => !q.done).slice(-6);
    const ql = DT.el('div', { style: { display: 'grid', gap: '8px' } });
    if (!qs.length) ql.append(DT.el('p', { style: { margin: 0, color: 'var(--ink-2)' } }, '들어온 질문이 없어요. 학생은 이름 없이 질문을 보낼 수 있어요.'));
    qs.forEach((q) => ql.append(DT.el('div', { style: { display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 14px', borderRadius: '12px', background: 'var(--paper-2)', fontSize: '18px' } }, DT.el('span', { style: { flex: '1' } }, q.text), DT.el('button', { class: 'btn btn--sm', type: 'button', onclick: async (e) => { await DT.data.updateQuestion(q.id, { done: true }); e.target.closest('div').remove(); if (S.lesson) { S.lesson.questions = (S.lesson.questions || []).concat([q.text]); DT.store.set('board.lesson.' + C.courseId + '.' + S.classId, S.lesson); } } }, '답했어요'))));
    wrap.append(DT.el('div', { class: 'field' }, DT.el('span', null, '익명 질문함'), ql));
    const acts = [{ label: '닫기' }];
    if (DT.data.mode === 'demo') acts.unshift({ label: '예시 신호 넣기', onClick: async (cl) => { cl(); for (const r of S.roster.slice(0, 18)) { const x = Math.random(); await DT.data.sendSignal(S.classId, r.key, s.id, x < 0.6 ? 'g' : x < 0.85 ? 'y' : 'r'); } await DT.data.sendQuestion(S.classId, '이 성질은 언제 써야 하나요?', s.id); openSignals(); } });
    DT.modal({ title: '이해도 · 질문함', body: wrap, wide: true, actions: acts });
  }

  /* ── 모둠 ── */
  async function openGroups() {
    const subs = await DT.data.listSubmissions({ classId: S.classId });
    const rate = {}; S.roster.forEach((r) => { const mine = subs.filter((x) => x.key === r.key && x.score && x.score.total); rate[r.key] = mine.length ? mine.reduce((a, x) => a + x.score.correct / x.score.total, 0) / mine.length : 0.5; });
    let size = 4, method = 'mix', groups = await DT.data.getGroups(S.classId);
    const make = () => {
      const n = Math.max(1, Math.round(S.roster.length / size));
      const order = method === 'mix' ? S.roster.slice().sort((a, b) => rate[b.key] - rate[a.key]) : DT.shuffle(S.roster);
      const g = Array.from({ length: n }, () => []);
      order.forEach((r, i) => { const row = Math.floor(i / n); const col = row % 2 === 0 ? i % n : n - 1 - (i % n); g[col].push(r.key); });
      return method === 'mix' ? g.map((x) => DT.shuffle(x)) : g;
    };
    if (!groups) groups = make();
    const ov = DT.el('div', { class: 'overlay' });
    const sizes = DT.el('div', { class: 'bgpick' });
    [3, 4, 5].forEach((v) => { const b = DT.el('button', { type: 'button', 'aria-pressed': v === size ? 'true' : 'false' }, v + '명씩'); b.onclick = () => { size = v; DT.$$('button', sizes).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); groups = make(); paint(); }; sizes.append(b); });
    const methods = DT.el('div', { class: 'bgpick' });
    [['mix', '고르게 섞기'], ['random', '무작위']].forEach(([v, t]) => { const b = DT.el('button', { type: 'button', 'aria-pressed': v === method ? 'true' : 'false', title: v === 'mix' ? '정답률이 높은 학생과 낮은 학생이 한 모둠에 고르게 들어가요' : '' }, t); b.onclick = () => { method = v; DT.$$('button', methods).forEach((x) => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); groups = make(); paint(); }; methods.append(b); });
    const again = DT.el('button', { class: 'obtn', type: 'button', html: DT.icon('refresh') + '다시 섞기', onclick: () => { groups = make(); paint(); } });
    const save = DT.el('button', { class: 'obtn obtn--ink', type: 'button', html: DT.icon('check') + '이 모둠으로 정하기', onclick: async () => { await DT.data.saveGroups(S.classId, groups); DT.toast('모둠을 저장했어요. 모둠 활동지와 동료평가에 이 모둠이 쓰여요.'); } });
    const closeB = DT.el('button', { class: 'oclose', type: 'button', 'aria-label': '닫기', html: DT.icon('x') });
    const grid = DT.el('div', { class: 'groups' });
    ov.append(DT.el('div', { class: 'overlay__bar' }, DT.el('h2', { class: 'overlay__title' }, S.className + ' 모둠'), sizes, methods, again, save, closeB), grid);
    function paint() {
      grid.innerHTML = ''; grid.style.setProperty('--cols', groups.length > 8 ? 5 : 4);
      groups.forEach((g, i) => grid.append(DT.el('div', { class: 'group' }, DT.el('h4', null, (i + 1) + '모둠'), DT.el('ol', null, g.map((k) => { const r = S.roster.find((x) => x.key === k) || { no: '', name: k }; return DT.el('li', null, DT.el('span', { class: 'num' }, String(r.no).slice(-2) + '번'), r.name); })))));
    }
    paint(); $('#layer').append(ov);
    const close = () => { ov.remove(); popEsc(); }; closeB.onclick = close; pushEsc(close);
  }

  /* ── 발표자 뽑기 ── */
  function openPicker() {
    const picked = DT.store.get('board.picked.' + S.classId + '.' + DT.ymd(Date.now()), []);
    const ov = DT.el('div', { class: 'overlay' });
    const name = DT.el('div', { class: 'picker__name' }, '?'); const no = DT.el('div', { class: 'picker__no' }, '오늘 아직 안 뽑힌 학생 중에서 골라요');
    const pick = DT.el('button', { class: 'obtn obtn--ink', type: 'button', html: DT.icon('dice') + '뽑기' });
    const rec = DT.el('button', { class: 'obtn', type: 'button', disabled: true, html: DT.icon('check') + '발표함으로 기록' });
    const closeB = DT.el('button', { class: 'oclose', type: 'button', 'aria-label': '닫기', html: DT.icon('x') });
    ov.append(DT.el('div', { class: 'overlay__bar' }, DT.el('h2', { class: 'overlay__title' }, '발표자 뽑기'), closeB), DT.el('div', { class: 'picker' }, name, no, DT.el('div', { class: 'picker__actions' }, pick, rec)));
    $('#layer').append(ov);
    let cur = null;
    pick.onclick = async () => {
      let pool = S.roster.filter((r) => !picked.includes(r.key)); if (!pool.length) { picked.length = 0; pool = S.roster.slice(); }
      if (!pool.length) return DT.toast('명단이 비어 있어요. 선생님 화면 › 설정에서 명단을 넣어 주세요.');
      pick.disabled = true; rec.disabled = true;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      for (let i = 0; i < (reduce ? 1 : 16); i++) { const r = pool[Math.floor(Math.random() * pool.length)]; name.textContent = r.name; await DT.sleep(40 + i * 9); }
      cur = pool[Math.floor(Math.random() * pool.length)]; name.textContent = cur.name; no.textContent = cur.no + '번';
      picked.push(cur.key); DT.store.set('board.picked.' + S.classId + '.' + DT.ymd(Date.now()), picked);
      pick.disabled = false; rec.disabled = false; pick.innerHTML = DT.icon('dice') + '한 명 더';
    };
    rec.onclick = async () => { if (!cur) return; await DT.data.addObservation({ key: cur.key, classId: S.classId, tag: '발표', note: DT.plain(screens()[S.idx].title) + ' 화면에서 발표', screenId: screens()[S.idx].id, by: 'board' }); rec.disabled = true; DT.toast(cur.name + ' 학생의 발표를 기록했어요.'); };
    const close = () => { ov.remove(); popEsc(); }; closeB.onclick = close; pushEsc(close);
  }

  /* ── 타이머 ── */
  function openTimer() {
    const box = DT.el('div', { class: 'chips' });
    [1, 3, 5, 10].forEach((m) => box.append(DT.el('button', { class: 'chip', type: 'button', style: { minHeight: '64px', fontSize: '22px', padding: '0 28px' }, onclick: () => { md.close(); runTimer(m * 60); } }, m + '분')));
    const custom = DT.el('input', { class: 'input num', type: 'number', min: 1, max: 90, placeholder: '분', style: { width: '120px' } });
    box.append(custom, DT.el('button', { class: 'btn btn--ink', type: 'button', onclick: () => { const v = +custom.value; if (v > 0) { md.close(); runTimer(v * 60); } } }, '시작'));
    const md = DT.modal({ title: '타이머', body: box });
  }
  function runTimer(sec) {
    if (S.timer) { clearInterval(S.timer.iv); S.timer.el.remove(); }
    const el = DT.el('div', { class: 'timer-chip', role: 'timer' });
    const t = DT.el('span', { class: 'timer-chip__t num' });
    const pause = DT.el('button', { type: 'button', 'aria-label': '멈춤', html: DT.icon('pause') });
    const x = DT.el('button', { type: 'button', 'aria-label': '타이머 닫기', html: DT.icon('x') });
    el.append(t, pause, x); $('#layer').append(el);
    let left = sec, run = true;
    const paint = () => { t.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0'); };
    const iv = setInterval(() => { if (!run) return; left--; paint(); if (left <= 0) { clearInterval(iv); el.classList.add('is-done'); t.textContent = '끝!'; } }, 1000);
    pause.onclick = () => { run = !run; pause.innerHTML = DT.icon(run ? 'pause' : 'play'); };
    x.onclick = () => { clearInterval(iv); el.remove(); S.timer = null; };
    S.timer = { iv, el }; paint();
  }

  /* ── 수업 마치기 → 수업 일지 ── */
  async function endLesson() {
    tickLesson(screens()[S.idx].id);
    const L = S.lesson; const shown = Object.keys(L.screens).filter((id) => S.tb._byId[id]).sort((a, b) => S.tb._byId[a]._idx - S.tb._byId[b]._idx);
    const sig = {}; shown.forEach((id) => (sig[id] = screenSignals(id)));
    const hard = shown.map((id) => ({ id, c: sig[id], r: (sig[id].y * 0.5 + sig[id].r) / Math.max(1, sig[id].g + sig[id].y + sig[id].r) })).filter((x) => x.c.y + x.c.r > 0).sort((a, b) => b.r - a.r).slice(0, 3);
    const mins = Math.round((Date.now() - L.startedAt) / 60000);
    const memo = DT.el('textarea', { class: 'textarea', placeholder: '다음 시간에 이어 할 것, 반 분위기 등 (선택)' });
    const row = (t, v) => DT.el('div', { style: { display: 'grid', gridTemplateColumns: '130px 1fr', gap: '12px', fontSize: '16px', padding: '8px 0', borderBottom: '1px solid var(--line)' } }, DT.el('b', null, t), DT.el('div', { html: v }));
    const body = DT.el('div', null,
      row('반 · 날짜', DT.esc(S.className) + ' · ' + DT.date(L.startedAt)),
      row('진도', shown.length ? DT.esc(DT.plain(S.tb._byId[shown[0]].title)) + ' → ' + DT.esc(DT.plain(S.tb._byId[shown[shown.length - 1]].title)) + ' <span style="color:var(--ink-2)">(' + shown.length + '개 화면, 약 ' + mins + '분)</span>' : '–'),
      row('어려워한 곳', hard.length ? hard.map((h) => DT.esc(DT.plain(S.tb._byId[h.id].title)) + ' <span style="color:var(--ink-2)">헷갈림 ' + h.c.y + '·모름 ' + h.c.r + '</span>').join('<br>') : '<span style="color:var(--ink-2)">신호 없음</span>'),
      row('즉석 질문', L.live.length ? L.live.map((x) => DT.esc(x.label || x.text) + ' — ' + x.n + '명 응답' + (x.ok != null ? ', 정답 ' + x.ok + '명' : '')).join('<br>') : '<span style="color:var(--ink-2)">없음</span>'),
      row('보낸 학습지', L.assignments.length ? L.assignments.length + '개' : '없음'),
      DT.el('div', { class: 'field', style: { marginTop: '14px' } }, DT.el('span', null, '메모'), memo));
    DT.modal({ title: '수업 마치기', body, wide: true, actions: [{ label: '계속 수업하기' }, { label: '일지 저장하고 마치기', kind: 'ink', icon: 'check', onClick: async (close) => {
      const doc = { id: L.id, classId: S.classId, courseId: C.courseId, startedAt: L.startedAt, endedAt: Date.now(), screens: shown.map((id) => ({ id, title: DT.plain(S.tb._byId[id].title), ms: L.screens[id].ms, sig: sig[id] })), live: L.live, questions: L.questions || [], assignments: L.assignments, hard: hard.map((h) => h.id), memo: memo.value.trim() };
      await DT.data.saveLesson(doc); await DT.data.setLive(S.classId, { active: false, question: null });
      DT.store.del('board.lesson.' + C.courseId + '.' + S.classId); startLesson();
      close(); DT.toast('수업 일지를 저장했어요. 선생님 화면 › 수업 일지에서 볼 수 있어요.');
    } }] });
  }

  /* ── 처음 안내 (3단계) ── */
  function coach() {
    const steps = [
      { sel: '.rail__nav', t: '넘기기', d: '오른쪽 아래 화살표로 다음 화면. 키보드 → ← 나 무선 리모컨도 돼요. 숨은 내용이 있으면 한 번 누를 때마다 하나씩 열려요.' },
      { sel: '.rail__ink', t: '판서', d: '왼쪽 아래 「판서」를 누르면 바로 쓸 수 있어요. 문제를 누르면 넓은 판서 공간이 따로 열려요. 쓴 내용은 화면마다 저장돼요.' },
      { sel: '#bookTab', t: '교과서 원본', d: '오른쪽 탭을 누르면 지금 배우는 교과서 쪽이 책처럼 펼쳐져요. 넘기고, 확대하고, 그 위에 판서도 돼요.' },
      { sel: '#btnTools', t: '수업 도구', d: '학습지 보내기, 학생에게 묻기, 모둠, 발표자 뽑기, 타이머는 모두 이 단추 안에 있어요.' }
    ];
    let i = 0;
    const root = DT.el('div', { class: 'coach' }); const hole = DT.el('div', { class: 'coach__hole' }); const card = DT.el('div', { class: 'coach__card', role: 'dialog' });
    root.append(hole, card); $('#layer').append(root);
    const stageK = () => $('#stage').getBoundingClientRect().width / 1920;
    function paint() {
      const s = steps[i]; const el = $(s.sel); const st = $('#stage').getBoundingClientRect(); const k = stageK();
      const r = el && !el.hidden ? el.getBoundingClientRect() : { left: st.left + 800 * k, top: st.top + 400 * k, width: 300 * k, height: 200 * k };
      const x = (r.left - st.left) / k - 12, y = (r.top - st.top) / k - 12, w = r.width / k + 24, h = r.height / k + 24;
      Object.assign(hole.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
      const cx = DT.clamp(x + w / 2 - 280, 24, 1920 - 584); const cy = y > 540 ? y - 300 : y + h + 20;
      Object.assign(card.style, { left: cx + 'px', top: DT.clamp(cy, 24, 1080 - 320) + 'px' });
      card.innerHTML = '';
      const next = DT.el('button', { class: 'obtn obtn--ink', type: 'button' }, i === steps.length - 1 ? '시작하기' : '다음');
      next.onclick = () => { if (++i >= steps.length) done(); else paint(); };
      card.append(DT.el('div', { class: 'coach__step num' }, (i + 1) + ' / ' + steps.length), DT.el('h3', null, s.t), DT.el('p', null, s.d), DT.el('div', { class: 'coach__foot' }, DT.el('button', { class: 'btn btn--ghost', type: 'button', onclick: done }, '안내 건너뛰기'), next));
      next.focus();
    }
    function done() { root.remove(); DT.store.set('board.coached', true); popEsc(); }
    paint(); pushEsc(done);
  }

  /* ── Esc 쌓기 · 단축키 ── */
  const escStack = [];
  function pushEsc(fn) { escStack.push(fn); }
  function popEsc() { escStack.pop(); }
  function bindKeys() {
    document.addEventListener('keydown', (e) => {
      if (document.querySelector('.scrim') || document.querySelector('.book')) return;
      if (e.target.closest('input,textarea,select')) { if (e.key === 'Escape') { if (e.target.value) e.target.value = ''; else if (escStack.length) escStack[escStack.length - 1](); else e.target.blur(); e.target.dispatchEvent(new Event('input')); } return; }
      if (DT.ink.keys(e)) return;
      const k = e.key;
      if (k === 'Escape') { if (DT.ink.state.tool !== 'hand') DT.ink.set({ tool: 'hand' }); else if (escStack.length) escStack[escStack.length - 1](); return; }
      if (escStack.length) return;
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Enter') { e.preventDefault(); step(1); }
      else if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Backspace') { e.preventDefault(); step(-1); }
      else if (k === 't' || k === 'T') openToc();
      else if (k === 'b' || k === 'B') { if (!$('#bookTab').hidden) openBook(); }
      else if (k === 'f' || k === 'F') DT.fullscreen();
    });
  }

  document.addEventListener('DOMContentLoaded', start);
})();

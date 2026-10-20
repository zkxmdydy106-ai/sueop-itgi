/* 수업잇기 엔진 · data.js
   기록 저장 계층. 화면 코드는 DT.data의 함수만 쓴다.
   - demo 모드: 이 브라우저 안에만 저장(체험·미리보기). 탭끼리 실시간으로 이어진다.
   - firebase 모드: 구글 로그인 + Firestore. 우리 반 명단에 있는 계정만 교과서와 기록을 볼 수 있다(보안 규칙).
   모든 함수는 Promise를 돌려준다. 실시간 함수(on…)는 구독 해제 함수를 돌려준다. */
(function () {
  'use strict';
  const DT = window.DT;
  const C = DT.config;

  /* ─────────────────────────── 공통 계산 ─────────────────────────── */
  const skey = (key) => String(key).replace(/[^a-zA-Z0-9가-힣._-]/g, '_');   /* 보안 규칙 myKey() 와 같은 규칙 */
  const subId = (aid, key) => aid + '__' + skey(key);
  const byTime = (k) => (a, b) => (a[k] || 0) - (b[k] || 0);

  /* ─────────────── 기기 안 저장소: 교과서·쪽 그림을 한 번 받으면 다음부터 바로 연다 ───────────────
     열쇠에 교과서 판(올린 시각)을 넣어, 선생님이 교과서를 다시 올리면 새 판만 받는다. 저장이 안 되는 브라우저면 그냥 건너뛴다. */
  const IDB = (function () {
    let dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise((ok) => { try { const r = indexedDB.open('dt-cache', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => ok(null); } catch (e) { ok(null); } });
      return dbp;
    }
    return {
      async get(k) { const db = await open(); if (!db) return undefined; return new Promise((ok) => { try { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ok(undefined); } catch (e) { ok(undefined); } }); },
      async set(k, v) { const db = await open(); if (!db) return; try { db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) { /* 저장 공간이 꽉 차면 그냥 넘어간다 */ } },
      async clearOld(prefix, keep) { const db = await open(); if (!db) return; try { const st = db.transaction('kv', 'readwrite').objectStore('kv'); const q = st.openCursor(); q.onsuccess = () => { const c = q.result; if (!c) return; const k = String(c.key); if (k.startsWith(prefix) && !k.startsWith(keep)) c.delete(); c.continue(); }; } catch (e) { /* 무시 */ } }
    };
  })();
  DT.idb = IDB;

  /* ─────────────────────────── DEMO ─────────────────────────── */
  function DemoBackend(opt) {
    opt = opt || {};
    const KEY = (opt.prefix || 'demo') + '.db.' + C.courseId;
    let db = DT.store.get(KEY, null);
    const chan = ('BroadcastChannel' in window) ? new BroadcastChannel('dt-demo-' + C.courseId) : null;
    const subs = [];
    const save = DT.debounce(() => DT.store.set(KEY, db), 150);
    function changed(col) {
      save();
      subs.forEach((s) => { if (s.col === col) s.fire(); });
      if (chan) chan.postMessage({ col, db: col === 'live' || col === 'liveAnswers' || col === 'signals' || col === 'questions' ? db[col] : null });
    }
    if (chan) chan.onmessage = (e) => {
      const m = e.data || {};
      if (m.db) db[m.col] = m.db; else { const fresh = DT.store.get(KEY, null); if (fresh) db = fresh; }
      subs.forEach((s) => { if (s.col === m.col) s.fire(); });
    };
    function col(name) { db[name] = db[name] || []; return db[name]; }
    function upsert(name, doc) { DT.fsCheck(doc, name); const a = col(name); const i = a.findIndex((d) => d.id === doc.id); if (i >= 0) a[i] = Object.assign({}, a[i], doc); else a.push(doc); changed(name); return doc; }
    function listen(name, filter, cb) {
      const s = { col: name, fire: () => cb(col(name).filter(filter)) };
      subs.push(s); setTimeout(s.fire, 0);
      return () => { const i = subs.indexOf(s); if (i >= 0) subs.splice(i, 1); };
    }
    const TABUSER = /[?&]tab=1\b/.test(location.search);
    const TABKEY = 'dt.demo.user.' + location.pathname.split('/').pop();   /* 같은 탭 안의 틀끼리도 칠판·학생·선생님 화면이 따로 */
    const api = {
      mode: 'demo',
      async init() {
        if (!db || db.version !== 4) {   /* 체험 데이터 모양이 바뀌면 숫자를 올린다 → 새로 만든다 (4: 학번 2301 형식) */
          db = { version: 4 };
          if (window.DT_SEED && !opt.noSeed) window.DT_SEED(db, await api.getCourse());
          DT.store.set(KEY, db);
        }
      },
      async resetDemo() { DT.store.del(KEY); DT.store.keys('ink.').forEach((k) => DT.store.del(k)); db = null; await api.init(); changed('all'); },
      /* 로그인 */
      /* ?tab=1 이면 이 창(탭·틀)만의 로그인 — 안내 페이지에서 칠판·학생 화면을 나란히 띄울 때 */
      user() { if (TABUSER) { try { const v = sessionStorage.getItem(TABKEY); return v ? JSON.parse(v) : null; } catch (e) { return null; } } return DT.store.get('demo.user', null); },
      async signIn(as) { if (TABUSER) { try { sessionStorage.setItem(TABKEY, JSON.stringify(as)); } catch (e) {} return as; } DT.store.set('demo.user', as); return as; },
      async signOut() { if (TABUSER) { try { sessionStorage.removeItem(TABKEY); } catch (e) {} return; } DT.store.del('demo.user'); },
      async listStudentsForPicker() { return col('roster').slice().sort((a, b) => a.no.localeCompare(b.no)); },
      /* 교과서 */
      async getCourse() {
        if (window.TEXTBOOK) return window.TEXTBOOK;
        await DT.loadScript(C.contentPath + 'content.js');
        return window.TEXTBOOK;
      },
      async asset(path) { return C.contentPath + path; },
      async pageSrc(n, variant) {
        const tb = window.TEXTBOOK; const p = tb && tb.pages; if (!p) return null;
        const pat = variant === 'hi' ? p.hi : (p.pattern || 'pages/p{n}.webp');
        if (!pat) return null;
        return C.contentPath + pat.replace('{n}', String(n).padStart(p.pad || 3, '0'));
      },
      /* 반·명단 */
      async listClasses() { return col('classes').slice(); },
      async saveClass(c) { return upsert('classes', c); },
      async getRoster(classId) { return col('roster').filter((r) => !classId || r.classId === classId).sort((a, b) => a.no.localeCompare(b.no)); },
      async saveRoster(classId, rows) { db.roster = col('roster').filter((r) => r.classId !== classId).concat(rows.map((r) => Object.assign({ key: 's' + r.no, classId }, r))); changed('roster'); },
      async listPending() { return []; },
      async approveMember() {},
      async removeMember(key) { db.roster = col('roster').filter((r) => r.key !== key); changed('roster'); },
      async joinCode() { return ''; },
      async joinInfo() { return null; },
      async setJoinClasses() {},
      async boardCode() { return null; },
      async joinOpen() { return null; },
      async setJoinOpen() {},
      /* 학습지 */
      async createAssignment(a) { a.id = a.id || DT.uid('a'); a.createdAt = a.createdAt || Date.now(); a.status = a.status || 'open'; upsert('assignments', packA(a)); return a; },
      async updateAssignment(id, patch) { return upsert('assignments', Object.assign({ id }, patch)); },
      async listAssignments(f) { f = f || {}; return col('assignments').filter((a) => (!f.classId || a.classId === f.classId)).map(unpackA).sort(byTime('createdAt')).reverse(); },
      async getAssignment(id) { return unpackA(col('assignments').find((a) => a.id === id) || null); },
      onAssignments(classId, cb) { return listen('assignments', (a) => a.classId === classId, (rows) => cb(rows.map(unpackA).sort(byTime('createdAt')).reverse())); },
      /* 제출 */
      async saveSubmission(s) { s.id = subId(s.aid, s.key); s.updatedAt = Date.now(); return upsert('submissions', s); },
      async getSubmission(aid, key) { return col('submissions').find((s) => s.id === subId(aid, key)) || null; },
      async listSubmissions(f) { f = f || {}; return col('submissions').filter((s) => (!f.aid || s.aid === f.aid) && (!f.key || s.key === f.key) && (!f.classId || s.classId === f.classId)); },
      onSubmissions(aid, cb) { return listen('submissions', (s) => s.aid === aid, cb); },
      async saveFeedback(aid, key, patch) { const s = await api.getSubmission(aid, key); if (!s) return null; const f = Object.assign({}, s.feedback || {}, patch.items || {}); return upsert('submissions', Object.assign({}, s, { feedback: f, overall: patch.overall != null ? patch.overall : s.overall, checked: patch.checked != null ? patch.checked : s.checked, checkedAt: Date.now() })); },
      /* 수업 실시간 */
      async setLive(classId, patch) { const cur = col('live').find((l) => l.id === classId) || { id: classId, classId }; return upsert('live', Object.assign({}, cur, patch, { at: Date.now() })); },
      onLive(classId, cb) { return listen('live', (l) => l.id === classId, (rows) => cb(rows[0] || null)); },
      async getEdits(courseId) { const m = {}; col('edits').filter((e) => e.courseId === courseId).forEach((e) => (m[e.screenId] = e)); return m; },
      async saveEdit(courseId, screenId, e) { return upsert('edits', Object.assign({ order: [], hide: [], scale: {}, hl: {}, text: {}, notes: [] }, e, { id: courseId + '__' + screenId, courseId, screenId, at: Date.now() })); },
      async sendLiveAnswer(classId, qid, key, value) { return upsert('liveAnswers', { id: classId + '__' + qid + '__' + key, classId, qid, key, value, at: Date.now() }); },
      onLiveAnswers(classId, qid, cb) { return listen('liveAnswers', (a) => a.classId === classId && a.qid === qid, cb); },
      async listLiveAnswers(classId) { return col('liveAnswers').filter((a) => a.classId === classId); },
      async sendSignal(classId, key, screenId, level) { return upsert('signals', { id: classId + '__' + screenId + '__' + key, classId, key, screenId, level, at: Date.now() }); },
      onSignals(classId, cb) { return listen('signals', (s) => s.classId === classId, cb); },
      async listSignals(f) { return col('signals').filter((s) => (!f.classId || s.classId === f.classId) && (!f.key || s.key === f.key)); },
      async sendQuestion(classId, text, screenId) { return upsert('questions', { id: DT.uid('q'), classId, text, screenId, at: Date.now(), done: false }); },
      async updateQuestion(id, patch) { return upsert('questions', Object.assign({ id }, patch)); },
      onQuestions(classId, cb) { return listen('questions', (q) => q.classId === classId, (rows) => cb(rows.sort(byTime('at')))); },
      /* 관찰 */
      async addObservation(o) { o.id = o.id || DT.uid('o'); o.at = o.at || Date.now(); return upsert('observations', o); },
      async removeObservation(id) { db.observations = col('observations').filter((o) => o.id !== id); changed('observations'); },
      async listObservations(f) { f = f || {}; return col('observations').filter((o) => (!f.key || o.key === f.key) && (!f.classId || o.classId === f.classId)).sort(byTime('at')); },
      /* 수업 일지 */
      async saveLesson(l) { l.id = l.id || DT.uid('l'); return upsert('lessons', l); },
      async listLessons(f) { f = f || {}; return col('lessons').filter((l) => !f.classId || l.classId === f.classId).sort(byTime('startedAt')).reverse(); },
      /* 판서 (결석생 다시 보기) */
      async saveInk(classId, surface, strokes) { DT.store.set('ink.' + C.courseId + '.' + classId + '.' + surface, strokes); },
      async getInk(classId, surface) { return DT.store.get('ink.' + C.courseId + '.' + classId + '.' + surface, null); },
      /* 모둠 */
      async saveGroups(classId, groups) { return upsert('groups', { id: classId, classId, groupsJson: JSON.stringify(groups), at: Date.now() }); },
      async getGroups(classId) { const g = col('groups').find((x) => x.id === classId); return g ? (g.groupsJson ? JSON.parse(g.groupsJson) : g.groups) : null; },
      async getGroupNames(classId) { const n = {}; (await api.getRoster(classId)).forEach((r) => (n[r.key] = r.name)); return n; },
      /* 평가 계획 */
      async getEvalPlan() { return (col('evalPlan')[0] || { id: 'plan', items: [] }); },
      async saveEvalPlan(p) { p.id = 'plan'; return upsert('evalPlan', p); },
      /* 백업 */
      async exportAll() { return JSON.parse(JSON.stringify(db)); },
      async importAll(data) { db = data; DT.store.set(KEY, db); changed('all'); }
    };
    return api;
  }

  /* ─────────────────────────── FIREBASE ───────────────────────────
     Firestore 구조 (보안 규칙: engine/firebase/firestore.rules)
       config/teachers {emails:[...]}         선생님 계정
       members/{email} {no,name,classId}       우리 반 명단 = 열람 허락
       classes/{id}  courses/{cid}/parts|pages|assets
       assignments  submissions  live  liveAnswers  signals  questions
       observations  lessons  inks  groups  evalPlan                         */
  /* 모둠(배열 안의 배열)은 서버가 못 받는다 → 글자로 바꿔 저장하고 읽을 때 되돌린다 */
  const packA = (a) => { if (!a || !Array.isArray(a.groups)) return a; const o = Object.assign({}, a, { groupsJson: JSON.stringify(a.groups) }); delete o.groups; return o; };
  const unpackA = (a) => { if (a && a.groupsJson && !a.groups) { try { a.groups = JSON.parse(a.groupsJson); } catch (e) {} } return a; };

  function FirebaseBackend() {
    const SDK = 'https://www.gstatic.com/firebasejs/10.12.5/';
    let fs, auth, me = null, course = null;
    const cache = {};
    const ts = () => Date.now();
    let verKey = '';   /* 기기 저장소 열쇠 앞부분 (교과서 판) */
    const docs = (snap) => snap.docs.map((d) => Object.assign({ id: d.id }, d.data()));
    const emailKey = (e) => String(e || '').toLowerCase();
    /* 복습 학습지의 학생별 문항: 선생님은 모두, 학생은 자기 것만 붙인다 */
    async function withPer(list) {
      list.forEach(unpackA);
      await Promise.all(list.filter((a) => a.hasPer).map(async (a) => {
        const col = fs.collection('assignments').doc(a.id).collection('per'); a.perStudent = {};
        if (me && me.role === 'teacher') docs(await col.get()).forEach((d) => (a.perStudent[d.id] = d.items || []));
        else if (me) { const d = await col.doc(me.key).get().catch(() => null); a.perStudent[me.key] = d && d.exists ? d.data().items || [] : []; }
      }));
      return list;
    }
    async function resolveUser(u) {
      if (!u) { me = null; return null; }
      if (u.isAnonymous) {   /* 칠판 QR 로그인: 선생님 휴대폰이 허락한 칠판이면 선생님으로 */
        const g = await fs.collection('boardGrants').doc(u.uid).get().catch(() => null);
        if (g && g.exists && (g.data().exp || 0) > Date.now()) { const em = emailKey(g.data().email); me = { role: 'teacher', key: em, email: em, name: '선생님', viaBoard: true }; return me; }
        me = { role: 'board', key: u.uid }; return me;
      }
      const email = emailKey(u.email);
      const tdoc = await fs.collection('config').doc('teachers').get().catch(() => null);
      const teachers = ((tdoc && tdoc.exists && tdoc.data().emails) || []).map(emailKey).concat((C.teacherEmails || []).map(emailKey));
      if (teachers.includes(email)) { me = { role: 'teacher', key: email, email, name: u.displayName || '선생님' }; return me; }
      const m = await fs.collection('members').doc(email).get().catch(() => null);
      if (m && m.exists) { const d = m.data(); me = { role: d.ok === false ? 'pending' : 'student', key: email, email, name: d.name, no: d.no, classId: d.classId }; return me; }
      me = { role: 'guest', key: email, email, name: u.displayName || email };
      return me;
    }
    const api = {
      mode: 'firebase',
      async init() {
        await DT.loadScript(SDK + 'firebase-app-compat.js');
        await DT.loadScript(SDK + 'firebase-auth-compat.js');
        await DT.loadScript(SDK + 'firebase-firestore-compat.js');
        /* 아이폰 사파리는 다른 주소(firebaseapp.com)로 로그인하면 'missing initial state'로 깨진다 → 이 사이트 주소로 로그인
           (구글 클라우드 OAuth 클라이언트에 https://<이 주소>/__/auth/handler 가 등록돼 있어야 해서 config의 authHere 로 켠다) */
        const fcfg = Object.assign({}, C.firebase);
        if (C.authHere && /\.(web\.app|firebaseapp\.com)$/.test(location.hostname)) fcfg.authDomain = location.host;
        if (!firebase.apps.length) firebase.initializeApp(fcfg);
        fs = firebase.firestore(); try { fs.settings({ ignoreUndefinedProperties: true, merge: true }); } catch (e) {}   /* 빈 칸(undefined)이 섞여도 저장이 막히지 않게 */
        auth = firebase.auth();
        /* 모든 저장 앞에서 서버 규칙을 먼저 검사 → 무엇이 잘못됐는지 분명히 알린다 */
        if (!DT._fsPatched) { DT._fsPatched = true; const F = firebase.firestore;
          const wrap = (proto, name, argi) => { const o = proto[name]; proto[name] = function () { DT.fsCheck(arguments[argi], (this.path || (arguments[0] && arguments[0].path) || 'doc')); return o.apply(this, arguments); }; };
          wrap(F.DocumentReference.prototype, 'set', 0); wrap(F.DocumentReference.prototype, 'update', 0); wrap(F.CollectionReference.prototype, 'add', 0);
          wrap(F.WriteBatch.prototype, 'set', 1); wrap(F.WriteBatch.prototype, 'update', 1); }
        await new Promise((ok) => { const off = auth.onAuthStateChanged(async (u) => { off(); await resolveUser(u); ok(); }); });
      },
      user() { return me; },
      async signIn() {
        const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
        try { const r = await auth.signInWithPopup(p); return resolveUser(r.user); }
        catch (e) {
          /* 다른 페이지로 넘어갔다 오는 방식(redirect)은 아이폰 사파리에서 'missing initial state'로 깨진다 → 쓰지 않는다 */
          if (/popup-closed-by-user|cancelled-popup-request/.test(e.code || '')) return null;   /* 학생이 창을 닫음: 조용히 */
          if (/popup-blocked/.test(e.code || '')) throw new Error('로그인 창이 막혔어요. 버튼을 한 번 더 눌러 주세요. (계속 안 되면 브라우저 설정에서 팝업 차단을 꺼 주세요)');
          throw e;
        }
      },
      async signOut() { await auth.signOut(); me = null; },
      /* 로그인 창(새 탭)에서 로그인이 끝나면 원래 탭도 알아채게: 아이폰에서 창이 닫힌 뒤 멈춰 있지 않도록 */
      onSignedIn(cb) { let first = true; return auth.onAuthStateChanged((u) => { if (first) { first = false; if (u) return; } if (u) cb(u); }); },
      /* 칠판 QR 로그인 — 칠판: pairStart → QR(teacher.html?pair=…) → onGrant 기다림. 휴대폰: grantBoard */
      async pairStart() { if (!auth.currentUser || !auth.currentUser.isAnonymous) await auth.signInAnonymously(); return auth.currentUser.uid; },
      onGrant(uid, cb) { return fs.collection('boardGrants').doc(uid).onSnapshot((d) => { if (d.exists && (d.data().exp || 0) > Date.now()) cb(d.data()); }, () => {}); },
      async grantBoard(uid, days) { await fs.collection('boardGrants').doc(uid).set({ email: me.email, at: ts(), exp: ts() + (days || 120) * 86400000 }); },
      async getCourse() {
        if (course) return course;
        const head = await fs.collection('courses').doc(C.courseId).get();
        if (!head.exists) throw new Error('교과서가 아직 올라가지 않았어요. 선생님 화면 › 설정 › 교과서 올리기를 먼저 해 주세요.');
        verKey = 'c:' + C.courseId + ':' + JSON.stringify(head.data().at || 0) + ':';
        const saved = await IDB.get(verKey + 'json');
        if (saved) course = JSON.parse(saved);
        else {
          const parts = docs(await fs.collection('courses').doc(C.courseId).collection('parts').get()).sort((a, b) => a.i - b.i);
          const txt = parts.map((p) => p.json).join(''); course = JSON.parse(txt);
          IDB.set(verKey + 'json', txt); IDB.clearOld('c:' + C.courseId + ':', verKey);
        }
        window.TEXTBOOK = course;
        return course;
      },
      async asset(path) {
        if (cache[path]) return cache[path];
        const id = path.replace(/[\/.]/g, '_');
        const hit = verKey && await IDB.get(verKey + 'a:' + id); if (hit) return (cache[path] = hit);
        const d = await fs.collection('courses').doc(C.courseId).collection('assets').doc(id).get();
        const v = d.exists ? d.data().data : ''; if (v && verKey) IDB.set(verKey + 'a:' + id, v);
        return (cache[path] = v);
      },
      async pageSrc(n, variant) {
        const id = String(n) + (variant === 'hi' ? '_hi' : ''); const k = 'page' + id; if (cache[k] !== undefined) return cache[k];
        const hit = verKey && await IDB.get(verKey + 'p:' + id); if (hit) return (cache[k] = hit);
        const d = await fs.collection('courses').doc(C.courseId).collection('pages').doc(id).get().catch(() => null);
        const v = d && d.exists ? d.data().data : null; if (v && verKey) IDB.set(verKey + 'p:' + id, v);
        return (cache[k] = v);
      },
      async uploadCourse(textbook, files, progress) {
        const json = JSON.stringify(textbook); const CH = 900000; const ref = fs.collection('courses').doc(C.courseId);
        await ref.set({ title: textbook.meta.title, subject: textbook.meta.subject, at: ts() });
        const n = Math.ceil(json.length / CH);
        for (let i = 0; i < n; i++) await ref.collection('parts').doc(String(i)).set({ i, json: json.slice(i * CH, (i + 1) * CH) });
        let done = 0;
        for (const f of files) {
          if (f.kind === 'page') await ref.collection('pages').doc(String(f.n) + (f.hi ? '_hi' : '')).set({ data: f.data });
          else await ref.collection('assets').doc(f.path.replace(/[\/.]/g, '_')).set({ data: f.data });
          progress && progress(++done, files.length);
        }
      },
      async listClasses() {
        const list = docs(await fs.collection('classes').get());
        if (me && me.role === 'teacher') {   /* 학생이 학생 링크로 들어오며 고른 반이 아직 없으면 만든다 */
          const self = docs(await fs.collection('members').where('self', '==', true).get().catch(() => ({ docs: [] })));
          const miss = [...new Set(self.map((x) => x.classId))].filter((id) => id && !list.find((c) => c.id === id));
          for (const id of miss) { const c = { id, name: id.replace('-', ' ') }; await fs.collection('classes').doc(id).set(c).catch(() => {}); list.push(c); }
        }
        return list.sort((a, b) => String(a.id).localeCompare(String(b.id), 'ko', { numeric: true }));
      },
      async saveClass(c) { await fs.collection('classes').doc(c.id).set(c, { merge: true }); return c; },
      async getRoster(classId) {
        let q = fs.collection('members'); if (classId) q = q.where('classId', '==', classId);
        return docs(await q.get()).filter((d) => d.ok !== false).map((d) => Object.assign({ key: d.id, email: d.id }, d)).sort((a, b) => String(a.no).localeCompare(String(b.no)));
      },
      async saveRoster(classId, rows) {
        const old = await api.getRoster(classId); const batch = fs.batch();
        old.forEach((r) => { if (!rows.find((x) => emailKey(x.email) === r.key)) batch.delete(fs.collection('members').doc(r.key)); });
        rows.forEach((r) => batch.set(fs.collection('members').doc(emailKey(r.email)), { no: String(r.no), name: r.name, classId }));
        await batch.commit();
      },
      /* 학생 스스로 명단에 들어오기 (학생 링크 ?j=코드). 학교 계정이면 바로, 아니면 선생님이 받아 줄 때까지 기다림 */
      async joinClass(j) {
        const u = auth.currentUser; const ref = fs.collection('members').doc(emailKey(u.email));
        const d = { no: j.no, name: j.name, classId: j.classId, code: j.code, at: ts(), self: true };
        try { await ref.set(Object.assign({ ok: true }, d)); } catch (e) { await ref.set(Object.assign({ ok: false }, d)); }
        return resolveUser(u);
      },
      onMe(cb) { return fs.collection('members').doc(me.key).onSnapshot((d) => cb(d.exists ? d.data() : null), () => {}); },
      async listPending() { return docs(await fs.collection('members').where('ok', '==', false).get()).map((d) => Object.assign({ key: d.id, email: d.id }, d)); },
      async approveMember(key) { await fs.collection('members').doc(key).set({ ok: true }, { merge: true }); },
      async removeMember(key) { await fs.collection('members').doc(key).delete(); },
      async boardCode() { const d = await fs.collection('config').doc('board').get().catch(() => null); return d && d.exists ? d.data() : null; },
      async joinCode() { const d = await fs.collection('config').doc('join').get().catch(() => null); return d && d.exists ? d.data().code || '' : ''; },
      /* 선생님이 정한 반 이름(선택과목 등): join/{코드}.classIds·classNames — 학생은 학년·반 대신 이 중에서 고른다 */
      async joinInfo(code) { const d = await fs.collection('join').doc(code).get().catch(() => null); return d && d.exists ? d.data() : null; },
      async setJoinClasses(names) { const c = await api.joinCode(); if (!c) return; const ids = names.map((n) => n.replace(/[^0-9가-힣a-zA-Z]+/g, '-')); await fs.collection('join').doc(c).set({ classIds: ids, classNames: names }, { merge: true }); for (let i = 0; i < ids.length; i++) await fs.collection('classes').doc(ids[i]).set({ id: ids[i], name: names[i] }, { merge: true }); },
      async joinOpen() { const c = await api.joinCode(); if (!c) return null; const d = await fs.collection('join').doc(c).get().catch(() => null); return d && d.exists ? d.data().open !== false : null; },
      async setJoinOpen(open) { const c = await api.joinCode(); if (c) await fs.collection('join').doc(c).set({ open: !!open }, { merge: true }); },
      async createAssignment(a) {
        a.id = a.id || DT.uid('a'); a.createdAt = a.createdAt || ts(); a.status = a.status || 'open';
        const per = a.perStudent; const head = packA(Object.assign({}, a)); delete head.perStudent; if (per) head.hasPer = true;
        await fs.collection('assignments').doc(a.id).set(head);
        if (per) { const b = fs.batch(); Object.keys(per).forEach((k) => b.set(fs.collection('assignments').doc(a.id).collection('per').doc(emailKey(k)), { items: per[k] })); await b.commit(); }   /* 학생별 틀린 문제는 본인만 읽는다 */
        return a;
      },
      async updateAssignment(id, patch) { await fs.collection('assignments').doc(id).set(patch, { merge: true }); },
      async listAssignments(f) { f = f || {}; let q = fs.collection('assignments'); if (f.classId) q = q.where('classId', '==', f.classId); return withPer(docs(await q.get()).sort(byTime('createdAt')).reverse()); },
      async getAssignment(id) { const d = await fs.collection('assignments').doc(id).get(); return d.exists ? (await withPer([Object.assign({ id: d.id }, d.data())]))[0] : null; },
      onAssignments(classId, cb) { return fs.collection('assignments').where('classId', '==', classId).onSnapshot((s) => withPer(docs(s).sort(byTime('createdAt')).reverse()).then(cb), () => cb([])); },
      async saveSubmission(s) { s.id = subId(s.aid, s.key); s.updatedAt = ts(); await fs.collection('submissions').doc(s.id).set(s, { merge: true }); return s; },
      async getSubmission(aid, key) { const d = await fs.collection('submissions').doc(subId(aid, key)).get(); return d.exists ? d.data() : null; },
      async listSubmissions(f) {
        f = f || {}; let q = fs.collection('submissions');
        if (f.aid) q = q.where('aid', '==', f.aid); if (f.key) q = q.where('key', '==', f.key); if (f.classId) q = q.where('classId', '==', f.classId);
        return docs(await q.get());
      },
      onSubmissions(aid, cb) { return fs.collection('submissions').where('aid', '==', aid).onSnapshot((s) => cb(docs(s))); },
      async saveFeedback(aid, key, patch) {
        const up = { checkedAt: ts() };
        if (patch.items) Object.keys(patch.items).forEach((k) => (up['feedback.' + k] = patch.items[k]));
        if (patch.overall != null) up.overall = patch.overall; if (patch.checked != null) up.checked = patch.checked;
        await fs.collection('submissions').doc(subId(aid, key)).update(up);
      },
      async setLive(classId, patch) { await fs.collection('live').doc(classId).set(Object.assign({ classId }, patch, { at: ts() }), { merge: true }); },
      onLive(classId, cb) { return fs.collection('live').doc(classId).onSnapshot((d) => cb(d.exists ? d.data() : null), () => cb(null)); },
      async getEdits(courseId) { const m = {}; try { docs(await fs.collection('edits').where('courseId', '==', courseId).get()).forEach((e) => (m[e.screenId] = e)); } catch (err) { /* 규칙 없는 옛 서버: 고친 것 없이 */ } return m; },
      async saveEdit(courseId, screenId, e) { await fs.collection('edits').doc(courseId + '__' + screenId).set(Object.assign({ order: [], hide: [], scale: {}, hl: {}, text: {}, notes: [] }, e, { courseId, screenId, at: ts() })); },
      async sendLiveAnswer(classId, qid, key, value) { await fs.collection('liveAnswers').doc(classId + '__' + qid + '__' + skey(key)).set({ classId, qid, key, value, at: ts() }); },
      onLiveAnswers(classId, qid, cb) { return fs.collection('liveAnswers').where('classId', '==', classId).where('qid', '==', qid).onSnapshot((s) => cb(docs(s))); },
      async listLiveAnswers(classId) { return docs(await fs.collection('liveAnswers').where('classId', '==', classId).get()); },
      async sendSignal(classId, key, screenId, level) { await fs.collection('signals').doc(classId + '__' + screenId + '__' + skey(key)).set({ classId, key, screenId, level, at: ts() }); },
      onSignals(classId, cb) { return fs.collection('signals').where('classId', '==', classId).onSnapshot((s) => cb(docs(s))); },
      async listSignals(f) { let q = fs.collection('signals'); if (f.classId) q = q.where('classId', '==', f.classId); if (f.key) q = q.where('key', '==', f.key); return docs(await q.get()); },
      async sendQuestion(classId, text, screenId) { await fs.collection('questions').add({ classId, text, screenId, at: ts(), done: false }); },
      async updateQuestion(id, patch) { await fs.collection('questions').doc(id).set(patch, { merge: true }); },
      onQuestions(classId, cb) { return fs.collection('questions').where('classId', '==', classId).onSnapshot((s) => cb(docs(s).sort(byTime('at')))); },
      async addObservation(o) { o.id = o.id || DT.uid('o'); o.at = o.at || ts(); await fs.collection('observations').doc(o.id).set(o); return o; },
      async removeObservation(id) { await fs.collection('observations').doc(id).delete(); },
      async listObservations(f) { f = f || {}; let q = fs.collection('observations'); if (f.key) q = q.where('key', '==', f.key); if (f.classId) q = q.where('classId', '==', f.classId); return docs(await q.get()).sort(byTime('at')); },
      async saveLesson(l) {
        l.id = l.id || DT.uid('l'); const body = Object.assign({}, l); const memo = body.memo; delete body.memo;
        await fs.collection('lessons').doc(l.id).set(body, { merge: true });
        if (memo != null) await fs.collection('lessonNotes').doc(l.id).set({ classId: l.classId || null, memo: String(memo) });   /* 메모는 선생님만 본다 */
        return l;
      },
      async listLessons(f) {
        f = f || {}; let q = fs.collection('lessons'); if (f.classId) q = q.where('classId', '==', f.classId);
        const rows = docs(await q.get()).sort(byTime('startedAt')).reverse();
        if (me && me.role === 'teacher') { const notes = docs(await fs.collection('lessonNotes').get()); rows.forEach((l) => { const n = notes.find((x) => x.id === l.id); if (n) l.memo = n.memo; }); }
        return rows;
      },
      async saveInk(classId, surface, strokes) { const s = JSON.stringify(strokes || []); if (s.length > 900000) return; await fs.collection('inks').doc(classId.replace(/[\/.@]/g, '_') + '__' + surface.replace(/[\/.]/g, '_')).set({ classId, surface, strokes: s, at: ts(), owner: me ? me.email : null }); },
      async getInk(classId, surface) { const d = await fs.collection('inks').doc(classId.replace(/[\/.@]/g, '_') + '__' + surface.replace(/[\/.]/g, '_')).get(); return d.exists ? JSON.parse(d.data().strokes || '[]') : null; },
      async getInkAt(classId, surface) { const d = await fs.collection('inks').doc(classId.replace(/[\/.@]/g, '_') + '__' + surface.replace(/[\/.]/g, '_')).get(); return d.exists ? { st: JSON.parse(d.data().strokes || '[]'), at: d.data().at || 0 } : null; },
      async saveGroups(classId, groups) {
        const ro = await api.getRoster(classId); const names = {}; [].concat(...(groups || [])).forEach((k) => { const r = ro.find((x) => x.key === k); if (r) names[k] = r.name; });
        await fs.collection('groups').doc(classId).set({ classId, groups: JSON.stringify(groups), names, at: ts() });
      },
      async getGroupNames(classId) { const d = await fs.collection('groups').doc(classId).get(); return d.exists ? (d.data().names || {}) : {}; },
      async getGroups(classId) { const d = await fs.collection('groups').doc(classId).get(); return d.exists ? JSON.parse(d.data().groups) : null; },
      async getEvalPlan() { const d = await fs.collection('evalPlan').doc('plan').get(); return d.exists ? d.data() : { id: 'plan', items: [] }; },
      async saveEvalPlan(p) { await fs.collection('evalPlan').doc('plan').set(p); },
      async exportAll() {
        const out = { version: 3, exportedAt: ts() };
        for (const c of ['classes', 'members', 'assignments', 'submissions', 'observations', 'lessons', 'lessonNotes', 'signals', 'liveAnswers', 'questions', 'groups', 'evalPlan']) out[c] = docs(await fs.collection(c).get());
        out.assignments = await withPer(out.assignments);
        return out;
      }
    };
    return api;
  }

  DT.data = (C.mode === 'firebase' && C.firebase) ? FirebaseBackend() : DemoBackend();

  /* ─────────────────── 칠판 링크 모드 (로그인 없이) ───────────────────
     board.html?k=열쇠 — 교과서는 Firestore의 shared/{열쇠}에서 읽는다(열쇠를 아는 사람만, 목록 보기 불가).
     기록(판서·즉석 질문 등)은 이 칠판 PC 안에만 남는다. 학생 아이패드와 이으려면 선생님 로그인. */
  DT.localBoard = function (key) {
    const api = DemoBackend({ prefix: 'local', noSeed: true });
    const base = 'https://firestore.googleapis.com/v1/projects/' + C.firebase.projectId + '/databases/(default)/documents/shared/' + encodeURIComponent(key);
    const cache = {};
    let ver = '';
    async function field(path, name) {
      const ck = ver && ver + path + '|' + name; if (ck) { const hit = await IDB.get(ck); if (hit != null) return hit; }
      const r = await fetch(base + path); if (!r.ok) return null;
      const j = await r.json(); const f = (j.fields || {})[name]; const v = f ? (f.stringValue != null ? f.stringValue : f.integerValue != null ? +f.integerValue : null) : null;
      if (ck && v != null) IDB.set(ck, v);
      return v;
    }
    api.mode = 'local';
    api.joinCode = async function () { return (await field('/meta/join', 'code')) || ''; };
    api.getCourse = async function () {
      if (window.TEXTBOOK) return window.TEXTBOOK;
      const n = await field('', 'parts'); if (!n) throw new Error('수업 링크가 맞지 않아요. 선생님께 받은 칠판 링크를 그대로 열어 주세요.');
      ver = 'l:' + key.slice(0, 8) + ':' + (await field('', 'at')) + ':'; IDB.clearOld('l:' + key.slice(0, 8) + ':', ver);
      const parts = await Promise.all(Array.from({ length: n }, (_, i) => field('/parts/' + i, 'json')));
      window.TEXTBOOK = JSON.parse(parts.join('')); return window.TEXTBOOK;
    };
    api.asset = async function (path) { if (cache[path]) return cache[path]; return (cache[path] = (await field('/assets/' + path.replace(/[\/.]/g, '_'), 'data')) || ''); };
    api.pageSrc = async function (n, variant) { const id = String(n) + (variant === 'hi' ? '_hi' : ''); if (cache['p' + id] !== undefined) return cache['p' + id]; return (cache['p' + id] = await field('/pages/' + id, 'data')); };
    return api;
  };

  /* ─────────────────────────── 계산 도우미 (두 모드 공통) ─────────────────────────── */
  DT.calc = {
    /* 한 제출의 정답률 */
    rate(sub) { if (!sub || !sub.score || !sub.score.total) return null; return sub.score.correct / sub.score.total; },
    /* 학습지별 요약 */
    summarize(assignment, subs, roster) {
      const items = assignment.items || [];
      const done = subs.filter((s) => s.submittedAt);
      const perItem = items.map((it) => {
        const rs = done.map((s) => (s.results || {})[it.id]).filter((r) => r && r.correct != null);
        const ok = rs.filter((r) => r.correct).length;
        const wrongAnswers = {};
        done.forEach((s) => { const r = (s.results || {})[it.id]; if (r && r.correct === false) { const a = DT.plain(String((s.answers || {})[it.id] || '(빈칸)')); wrongAnswers[a] = (wrongAnswers[a] || 0) + 1; } });
        return { item: it, n: rs.length, ok, rate: rs.length ? ok / rs.length : null, wrong: Object.entries(wrongAnswers).sort((a, b) => b[1] - a[1]) };
      });
      const rates = done.map(DT.calc.rate).filter((x) => x != null);
      return {
        total: roster.length, submitted: done.length,
        missing: roster.filter((r) => !done.find((s) => s.key === r.key)),
        avg: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
        perItem,
        toCheck: done.filter((s) => !s.checked && items.some((it) => DT.ws && DT.ws.needsTeacher(it))).length
      };
    }
  };
})();

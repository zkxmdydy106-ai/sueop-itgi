/* 이 교과서 앱의 설정 — 수업잇기가 채운다.
   · 모드 — demo: 이 브라우저 안에서만 / firebase: 구글 로그인 + 반 기록
   · Firebase 값 — Firebase 콘솔 › 프로젝트 설정 › 웹 앱의 firebaseConfig (공개돼도 되는 값. 보호는 firestore.rules)
   · 선생님 계정 — firestore.rules에도 같은 값 → python tools/deploy/prepare_firebase.py 가 채운다 */
window.DT_CONFIG = {
  mode: 'demo',
  courseId: '엔진시험',
  contentPath: '../content/',
  teacherEmails: [],
  firebase: null,
  school: '○○고등학교 (예시)',
  printCss: 'print/worksheet.css'
};

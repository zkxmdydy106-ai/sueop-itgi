/* 이 앱의 설정 — Code가 교과서마다 채운다.
   mode: 'demo'(이 브라우저 안에서만 체험) | 'firebase'(구글 로그인 + 반 전체 기록)
   theme: 화면 테마 기본값 (기기마다 바꿀 수 있음) — paper sky mint lemon lavender peach white
   extras: 연결된 수업 활동 — 예: { id:'drone', title:'벡터 드론 미션', student:'…?page=drone', visitor:'extras/drone.html', live:[{label:'실시간 화면', url:'…'}], missions:[['land','착륙']] }
   firebase: Firebase 콘솔 › 프로젝트 설정 › 웹 앱의 firebaseConfig (공개되어도 되는 값. 보호는 보안 규칙이 한다)
   teacherEmails: 선생님 계정(전자칠판·대시보드를 열 수 있는 사람)
   (firebase 줄은 맨 끝에 둔다 — prepare_firebase.py 가 그 줄을 바꾼다) */
window.DT_CONFIG = {
  mode: 'demo',
  courseId: 'demo',
  contentPath: '../demo-content/',
  school: '',
  theme: 'paper',
  extras: [],
  teacherEmails: [],
  firebase: null
};

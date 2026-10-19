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
  printCss: null,   // 반마다 자기 학습지 인쇄 양식: 'print/worksheet.css' (작업물/<교과서>/print/ 에 두면 배포 때 함께 올라감)
  authHere: false,  // true: 로그인을 이 사이트 주소로(아이폰 사파리 필수). 구글 클라우드 OAuth 클라이언트에 https://<프로젝트>.web.app/__/auth/handler 등록 뒤 켠다
  firebase: null
};

# 엔진 구조 (엔진을 고칠 때 읽는다)

빌드 없는 정적 웹앱. `file://`(체험)과 Firebase Hosting 둘 다에서 돈다. 외부 CDN 없음(글꼴·KaTeX·three·QR 모두 `assets/vendor/`).

## 화면
| 파일 | 화면 | 주 스크립트 |
|---|---|---|
| `index.html` | 시작 (수업하기 / 결과와 기록 / 학생 화면 / 모형 모음) | — |
| `board.html` | 전자칠판 — 1920×1080 무대를 화면에 맞춰 확대 | `board.js` |
| `student.html` | 학생 아이패드 | `student.js` |
| `teacher.html` | 선생님 결과·기록·설정 | `teacher.js` |
| `labs.html` | 모형 모음 (`?open=<id>`) | `lab.js` |

## 모듈 (`assets/js/`)
| 파일 | 하는 일 |
|---|---|
| `core.js` | `DT` 이름공간: el/$/esc/md(표기법)/tex/plain/credit(출처)/norm·numVal(채점 비교)/store(localStorage 안전)/modal/toast/icon/date/csv/applySubject |
| `data.js` | 저장소 하나의 API — `DemoBackend`(localStorage + BroadcastChannel로 탭끼리 실시간) / `FirebaseBackend`(구글 로그인, Firestore). 화면 코드는 `DT.data.*`만 부른다 |
| `demo-seed.js` | 체험용 가상 반·학생·제출(교과서 내용에 맞춰 생성) |
| `render.js` | content의 화면·블록 → DOM, `fit`(넘치면 글자 줄이기 → 그래도 넘치면 축소·기록), 단계 열기 |
| `viz.js` | `viz` 블록(flow·cycle·compare·timeline·venn·map·graph) |
| `glossary.js` | 용어 뜻 말풍선 + "n쪽으로 / 개념 화면으로" |
| `ink.js` | 판서 면(Surface): 펜·형광·지우개·레이저·되돌리기, 필압, 손바닥 무시, 저장 콜백 / 판서 도구막대 |
| `book.js` | 교과서 원본: 펼침·넘김·확대(고화질 교체)·검색 형광·용어·메모 스티커·3D 버튼·영어 읽어 주기·복제 방지 |
| `worksheet.js` | 학습지 만들기(오늘 확인·빈칸·연습·모둠·자기평가·진로·복습)와 채점 |
| `records.js` | 학생 누적 기록, 성취기준 도달, 생기부 근거 행, 담임 공유, 약한 개념 |
| `charts.js` | 막대·선·격자 그래프, QR |
| `lab.js` + `labs/*.js` | 3D 모형 틀(`DT.lab.register/open`, `ctx.three`)과 모형들 |

## 판서 저장 열쇠
`scope__surface` — scope: 반 id / `prep`(반 없이 준비) / `stu_<이메일>`(학생 개인). surface: `screen:<화면id>`, `prob:<블록id>`(문제 크게), `book:<쪽>`, `notes:<쪽>`(메모), 빈 칠판 등.

## 고친 뒤
1. `engine/demo-content`로 확인: `python -m http.server`(engine 폴더) → `/app/board.html` 등. 또는 `python tools/verify/audit_app.py`에 엔진 사본 교과서를 넣어 실행.
2. 학교웹앱공방 검증기: `python .claude/skills/school-webapp/lib/verify_webapp.py engine/app --render`
3. 화면을 바꿨으면 `design-critic` + `first-time-teacher`.
4. 각 교과서에 반영: `python tools/build/new_course.py "<이름>" --update-engine` (config.js·전용 모형은 보존)

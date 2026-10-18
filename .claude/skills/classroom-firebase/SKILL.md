---
name: classroom-firebase
description: 수업잇기를 실제 반에서 쓰도록 Firebase(구글 로그인·Firestore·호스팅)에 올리는 순서 — 선생님이 콘솔에서 누를 것, prepare_firebase.py·배포 명령, 교과서 올리기·명렬표, 무료 한도, 기록 보관·학년말 정리. "배포해줘", "학생들이 쓰게", "로그인", "기록이 남게" 같은 말에 읽는다.
---

# Firebase로 반에서 쓰기

체험(demo) 모드는 그 브라우저 안에서만 기록된다. 반 학생이 각자 아이패드로 로그인하고 기록이 선생님 화면에 모이려면 Firebase가 필요하다.
무료 요금제(Spark)로 충분하다. Storage는 쓰지 않는다(쪽 그림도 Firestore에 저장) — 결제 카드 등록이 필요 없다.

## 자동 흐름 (기본) — 선생님은 구글 로그인·「허용」만

```
npx -y firebase-tools login --reauth          # 터미널 탭(run_in_terminal). 나온 주소를 브라우저에서 열고 선생님 계정 선택 → 「허용」
python tools/deploy/new_server.py "작업물/<이름>" --teacher 선생님@학교.kr      # 프로젝트·Firestore 서울·익명 로그인·웹 앱 설정 → firebaseConfig.txt, deploy.json
python tools/deploy/deploy.py "작업물/<이름>"                                    # 엔진·규칙·호스팅·교과서(반 명단용 + 칠판 링크용) → 링크.txt
```
- `new_server.py`가 **[브라우저 단계]**를 출력하면 Code가 콘솔(Authentication › 로그인 방법)에서 Google을 켠다. 공개 이름 「수업잇기」, 지원 이메일 = 선생님.
- 학교 계정이 프로젝트 만들기를 막으면 → 선생님 개인 구글 계정으로 로그인해 만들고, `--teacher`에는 학교 계정을 넣는다(로그인은 학교 계정, 서버 주인은 개인 계정).
- 익명 로그인은 **칠판 QR 로그인**에 쓴다: 칠판에 QR → 선생님 휴대폰으로 찍고 「이 칠판 열기」 → 그 칠판은 120일 동안 선생님 권한(`boardGrants`). 칠판 세션은 teacher.html(학생 기록)을 열 수 없다.
- 교과서를 고치거나 쪽을 더 만들면 `deploy.py`만 다시. 바뀐 것만 올라가고 링크·기록은 그대로.
- 따로 쓰는 도구: `tools/deploy/firebase_api.py <projectId> status|anonymous|firestore|webconfig <경로>`, `tools/deploy/upload_course.py "작업물/<이름>" [--shared]`.

아래 0~2는 자동 흐름이 안 될 때 손으로 하는 방법이다.

## 0. 먼저 확인
- 학생이 **구글 계정**(학교 구글 워크스페이스 계정 권장)으로 로그인할 수 있는가. 없으면 체험 모드로만 쓰거나, 학교 정보부와 계정 발급을 상의하도록 안내.
- 학교 와이파이가 `*.googleapis.com`, `accounts.google.com`, `*.firebaseapp.com`, `*.web.app`, `www.gstatic.com`을 막지 않는가(사용자 점검 목록에 넣는다).
- 선생님 PC에 node가 있는가(`node --version`). 없으면 https://nodejs.org LTS 설치 안내.

## 1. 선생님이 콘솔에서 할 일 (한 단계씩, 화면 이름 그대로 안내)

https://console.firebase.google.com (선생님 구글 계정으로)
1. **프로젝트 추가** → 이름(예: `dt-기하-2학년`) → Google 애널리틱스 **사용 안 함** → 프로젝트 만들기
2. 왼쪽 **빌드 › Authentication** → 시작하기 → 로그인 방법 → **Google** → 사용 설정 → 프로젝트 지원 이메일 고르기 → 저장
3. **빌드 › Firestore Database** → 데이터베이스 만들기 → 위치 **asia-northeast3 (서울)** → **프로덕션 모드** → 만들기
4. 프로젝트 개요 옆 톱니 › **프로젝트 설정** → 아래 '내 앱'에서 **웹(</>)** → 앱 닉네임 → 앱 등록 (Hosting 체크는 안 해도 됨)
5. 나온 `const firebaseConfig = { … }` 부분을 복사 → `작업물/<이름>/firebaseConfig.txt`로 저장해 달라고 하거나 대화에 붙여 달라고 한다(공개돼도 되는 값이다. 보호는 보안 규칙이 한다).

한 번에 다 말하지 말고 1~3을 먼저, 끝났다고 하면 4~5. 각 단계에서 무엇이 보이면 맞는지 한 줄씩 덧붙인다.

## 2. Code가 할 일

```
python tools/deploy/prepare_firebase.py "작업물/<이름>" --config "작업물/<이름>/firebaseConfig.txt" --teacher 선생님@학교.kr
cd "작업물/<이름>"
npx firebase-tools login          ← 선생님이 브라우저에서 한 번 허락 (Code는 기다린다)
npx firebase-tools deploy --only hosting,firestore
```
- `prepare_firebase.py`: config.js를 firebase 모드로, `firestore.rules`의 `__TEACHERS__`에 선생님 계정, `__DOMAINS__`에 학교 계정 주소(선생님 계정의 @ 뒤, gmail 등 공용 주소 제외), `.firebaserc` 작성.
- `deploy.py`는 학생 링크 코드(`작업물/<이름>/.joincode`, `join/{코드}`)도 만든다 → 학생 링크 `student.html?j=코드`. 선생님이 「닫기」 한 것은 다시 열지 않는다.
- 배포가 보안 규칙을 컴파일한다 — 규칙 오류가 나면 배포가 멈추니 메시지를 읽고 고친다.
- 끝나면 주소: `https://<projectId>.web.app` — 칠판 `/board.html`, 학생 `/student.html`, 선생님 `/teacher.html`.
- 선생님을 더 넣을 때: `--teacher`를 모두 다시 주고 prepare → deploy.

## 3. 배포 뒤 선생님이 할 일 (선생님 화면 › 설정)
1. 교과서 올리기는 **하지 않아도 된다** — `deploy.py`가 자동으로 올린다(버튼은 직접 올려야 할 때만).
2. **명단은 넣지 않는다.** 학생이 학생 링크(`?j=코드`)로 들어와 구글 로그인 → 학년·반·번호·이름 → 명단(`members`, `self: true`)과 반(`classes`)이 저절로 생긴다.
   학교 계정 주소면 바로, 아니면 `ok: false`(기다림) → 선생님 화면 › 설정 「받기」. 다 들어오면 「새 학생 받기 › 닫기」(링크가 새도 못 들어옴).
   명렬표 붙여 넣기는 선택(한꺼번에 넣고 싶을 때만).
3. **학생에게 링크 주기** → 칠판 「수업 도구 › 학생 접속 QR」(로그인 없이도 됨, 코드가 들어 있음) 또는 「클래스룸에 올리기」.
4. 처음 수업 전에: 시크릿 창으로 학생 주소를 열어 **로그인 없이 교과서가 안 보이는지** 확인.

## 4. 무료 한도 (Spark — 바뀔 수 있으니 콘솔 › 사용량에서 확인)
- Firestore: 하루 읽기 5만·쓰기 2만 회, 저장 1GiB. 한 반 30명 수업 1시간 ≈ 읽기 수천 회 수준이라 보통 넉넉하다. 실시간 화면(즉석 질문·신호등)이 읽기를 가장 많이 쓴다.
- Hosting: 하루 전송량 한도가 작다(약 360MB/일). 엔진 파일은 브라우저 캐시(30일)로 첫날 이후에는 거의 안 쓴다. 넘치면 그날은 페이지가 안 열린다 → 여러 반이 쓰기 시작하면 사용량 탭을 한 번 확인하도록 안내.
- 쪽 그림은 한 장 760KB 이하만 올라간다(Firestore 문서 1MiB 한도). `extract.py`가 확대용을 740KB 이하로 맞춘다. 책 한 권(200쪽) ≈ 100MB 안팎.

## 5. 기록이 남는 곳과 보관
| 무엇 | 컬렉션 |
|---|---|
| 반·명단 | `classes`, `members`(이메일 → 반·학번·이름) |
| 학습지·제출·피드백 | `assignments`, `submissions` |
| 수업 중 실시간 (즉석 질문·응답·신호등·익명 질문) | `live`, `liveAnswers`, `signals`, `questions` |
| 판서 (선생님 반별·준비용 prep·학생 개인 stu_) | `inks` |
| 수업 일지·관찰 기록·모둠·평가 계획 | `lessons`, `observations`, `groups`, `evalPlan` |
| 교과서 내용·쪽 그림 | `courses/{courseId}/parts·pages·assets` |
- **백업**: 선생님 화면 › 기록 내보내기 › 전체 백업(JSON). 학기마다 한 번 받아 학교 PC에 보관하도록 안내.
- **학년말**: 생기부 입력이 끝나면 백업 → Firebase 콘솔 › 프로젝트 설정 › 프로젝트 삭제(학생 개인정보를 남기지 않는다). 다음 학년은 새 프로젝트.
- 수집하는 개인정보: 이름, 학번, 구글 계정 이메일, 학습 기록(답·판서·자기평가·관찰). 학교의 개인정보 처리 방침에 맞는지 학교 담당자와 확인하고, 학생에게 무엇이 기록되는지 첫 시간에 알리도록 안내한다. 배포 전 `privacy-guard`.

## 6. 문제가 생기면
| 증상 | 원인·해결 |
|---|---|
| 로그인 창이 바로 닫힘 | 아이패드 Safari 팝업 차단 → 엔진이 자동으로 전체 화면 로그인(redirect)으로 바꾼다. 그래도 안 되면 설정 › Safari › 팝업 차단 끄기 |
| "선생님 명단에 없어요" | prepare_firebase의 `--teacher` 계정과 로그인한 계정이 다름(대소문자 무관) → 다시 prepare + deploy |
| 학생이 "명단에 없어요" | 코드 없는 주소(`student.html`만)로 들어옴 → 칠판 학생 QR이나 링크.txt의 학생 주소로 / 「새 학생 받기」가 닫힘 |
| 학생이 "선생님이 받아 주면 열려요" | 학교 계정이 아닌 계정 → 선생님 화면 › 설정 「받기」, 또는 학교 계정으로 다시 로그인 |
| 교과서가 안 보임 | 교과서 올리기를 안 했거나 courseId가 다름(config.js) |
| `auth/unauthorized-domain` | 다른 주소로 열었음 → Authentication › 설정 › 승인된 도메인에 그 주소 추가 |
| 쓰기 거부(permission-denied) | 보안 규칙 — 콘솔 › Firestore › 규칙에 배포된 내용이 최신인지 |

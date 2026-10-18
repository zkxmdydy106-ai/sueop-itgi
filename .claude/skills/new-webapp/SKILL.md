---
name: new-webapp
description: 학교 웹앱을 처음부터 만드는 전체 작업 순서(브리프 → 디자인 방향 → 구현 → 검증 → 스크린샷 비평 → 문구·개인정보 검토 → 전달). "웹앱 만들어 줘", "~하는 사이트/도구/학습지/게임 만들어 줘", /new-webapp 으로 시작할 때 사용.
argument-hint: <만들 웹앱 한 줄 설명>
---

# new-webapp — 새 웹앱 만들기 순서

각 단계 끝에 산출물이 있어야 다음 단계로 간다. 서브에이전트는 `.claude/agents/`에 있다.

## 0. 폴더
`작업물/<영문-소문자-앱이름>/` 를 만들고 `templates/BRIEF.md`를 복사해 `BRIEF.md`로 둔다.
GAS 앱이면 `Code.gs` + `index.html`(+ 화면별 html), 정적 앱이면 `index.html` 하나(필요하면 `assets/`).

## 1. 브리프 (메인)
BRIEF.md의 위쪽 절반을 채운다: 누가·어디서·왜 쓰는지, 화면의 직업(school-ui-craft §1), 실행 플랫폼, 요구사항 장부, 데이터·개인정보.
- 사용자가 준 정보로 채울 수 없는 것 중 **결과를 크게 바꾸는 것만** 질문한다(최대 3개, AskUserQuestion). 나머지는 합리적으로 정하고 BRIEF에 "가정:"으로 적는다.
- 실제 같은 예시 데이터(가상 학생 명단, 실제 시간표 시각 등)를 BRIEF에 마련한다.

## 2. 디자인 방향 → `design-director` 에이전트
넘길 것: BRIEF.md 경로. 받을 것: BRIEF.md 아래쪽 "디자인 계획"(팔레트 4~6색, 글꼴, ASCII 와이어프레임, 시그니처 하나, 피할 것, 참고 레퍼런스).
- 에이전트는 `design/journal.md`를 읽고 직전 앱들과 겹치지 않게 정한다.
- 홈페이지형(학교·행사 소개)이면 design-taste-frontend의 방향 뽑기(`draw.mjs`)를 쓰게 한다.
- 사용자가 참고 이미지/캡처를 줬으면 image-to-code 스킬 방식(이미지를 먼저 분석 → 구조·수치 추출)으로 계획을 세운다.

## 3. 구현 (메인)
스킬: frontend-design + school-ui-craft + school-webapp (+ 홈페이지형이면 design-taste-frontend).
- 토큰(`:root`)부터 쓰고 → 레이아웃 → 컴포넌트 → 상태(빈·로딩·오류) → 인쇄 → 반응형.
- 파일을 쓸 때마다 훅이 검증기와 AI 티 검사를 돌린다. ✗는 즉시 고친다.
- 기능 코드는 끝까지 완성한다. "TODO", "여기에 구현" 같은 자리 표시 금지.

## 4. 1차 검증 (메인)
```bash
python .claude/skills/school-webapp/lib/verify_webapp.py 작업물/<앱> --render
python .claude/skills/design-review/lib/shoot.py 작업물/<앱>/index.html [--board] [--print]
```
스크린샷을 직접 보고(design-review §2) 높음 항목을 고친다.

## 5. 독립 검토 — 병렬로 띄운다 (한 메시지에 여러 Agent 호출)
- `design-critic`: 스크린샷 + BRIEF → AI 티·위계·마감 판정
- `ux-writer`: 화면 문구 → 바꿀 문구 표
- `qa-tester`: 요구사항 장부 대조, 상호작용·키보드·폭·인쇄 시험
- `privacy-guard`: 학생 정보가 다뤄질 때만

받은 지적 중 높음·중간을 반영하고 4단계를 한 번 더. (최소 2회전)

## 6. 마무리
- `design/journal.md`에 한 줄 기록.
- 배포가 필요하면 `deploy-webapp` 스킬.
- 사용자에게: 무엇을 만들었는지 한두 문장, 여는 방법, 수업 전 점검 3~5개, 직접 못 해 본 것. 과정 요약은 하지 않는다.

# 수업잇기 — Codex 등 다른 코딩 에이전트용 안내

이 저장소의 규칙과 작업 순서는 모두 **`CLAUDE.md`** 와 **`.claude/skills/`** 에 있다. Codex(또는 다른 에이전트)로 작업할 때도 그대로 따른다.

1. 먼저 `CLAUDE.md`를 처음부터 끝까지 읽는다 (절대 규칙: 교과서 글 그대로, 스크롤 없음, 화면 id 고정, 저작권·개인정보, 검증 ✗0).
2. 교과서 작업이면 `.claude/skills/textbook-webapp/SKILL.md`를 읽고, 그 안의 **'공유 체크리스트'** 를 처음 질문 → 만들기 → 배포 → 전달까지 하나씩 지킨다. 다른 스킬(`textbook-ingest`, `textbook-content`, `subject-pedagogy`, `lab-3d`, `classroom-firebase`, `copyright-guard` …)도 그 단계에서 해당 파일을 읽는다.
3. **사용량 아껴 쓰기**: 선생님이 정한 쪽 범위만 만들고 멈춘다(처음엔 소단원 하나). 다음 범위는 새 대화에서 `작업물/<교과서>/BRIEF.md`를 읽고 이어 간다.
4. 엔진을 고쳤으면 `python tools/verify/selftest.py`, 교과서별로 `python tools/verify/flows.py 작업물/<교과서>`가 ✗0이어야 한다.
5. 저장소에 올리기 전 `python tools/share/check_public.py` — 교과서 내용·학생 정보·계정·열쇠·선생님 양식 파일은 올리지 않는다.

권장 모델: Claude Code는 **Opus 5.5**, Codex는 그와 비슷한 급의 **최상위 모델**(모델 목록에서 가장 높은 것).
선생님과는 한국어로, 결과를 먼저, 짧게 말한다. 사용자는 컴퓨터에 익숙하지 않은 선생님일 수 있다.

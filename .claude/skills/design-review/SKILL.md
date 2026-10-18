---
name: design-review
description: 만든 웹앱을 실제로 열어 여러 폭(휴대폰·아이패드·PC·전자칠판·인쇄)으로 스크린샷을 찍고, 눈으로 보며 'AI 티'와 마감 부족을 찾아 고치는 반복 루프. 화면을 만들거나 고친 뒤 전달 전에, 또는 "디자인 점검", "더 고급스럽게", "AI 느낌 빼줘"라고 할 때 사용.
---

# design-review — 보고, 고치고, 다시 보기

코드를 읽는 것은 디자인 검토가 아니다. **반드시 화면을 찍어서 본다.**

## 1. 찍기

```bash
python .claude/skills/design-review/lib/shoot.py 작업물/<앱>/index.html            # 390·820·1366
python .claude/skills/design-review/lib/shoot.py 작업물/<앱>/index.html --board     # 전자칠판형
python .claude/skills/design-review/lib/shoot.py 작업물/<앱>/index.html --print     # 인쇄 대상
python .claude/skills/design-review/lib/shoot.py 작업물/<앱>/index.html --full      # 긴 페이지
```

- 결과는 `작업물/<앱>/.review/*.png` + `shots.json`(가로 넘침, 콘솔 오류, 작은 터치 대상, 실제 로드된 글꼴).
- 상호작용 뒤 화면(대화상자 열림, 오류 상태, 데이터 300행)도 봐야 하면 `agent-browser` 스킬(설치돼 있을 때)이나 playwright 짧은 스크립트로 해당 상태를 만든 뒤 찍는다.
- playwright가 없으면: `pip install playwright` → `python -m playwright install chromium` (한 번만).

## 2. 보기 — Read 도구로 PNG를 열어 아래 순서로 판단

1. **3초 인상**: 이 화면이 무엇을 하는 곳인지, 어디부터 누르는지 3초 안에 보이는가? 시선이 처음 가는 곳이 BRIEF의 '주인공'과 같은가?
2. **AI 티**: `school-ui-craft/references/ai-tells-ko.md` 목록 대조. 해당 항목 번호를 적는다.
3. **글자**: 위계가 3단계 안에서 분명한가, 한글 줄바꿈이 단어 단위인가, 숫자 열이 맞는가, 실제로 고른 웹글꼴이 로드됐는가(`shots.json`의 fontsLoaded).
4. **간격·정렬**: 같은 관계의 요소가 같은 간격인가. 왼쪽 정렬선이 몇 개인가(적을수록 좋다).
5. **색**: 강조색이 한 곳에만 쓰였나. 대비가 충분한가(옅은 회색 글자 주의).
6. **폭별**: 390에서 무너지는 곳, 1366에서 텅 비는 곳, 전자칠판에서 작은 글자.
7. **인쇄**: 버튼·배경이 사라지고 A4에 맞게 떨어지는가.
8. **상태**: 빈 상태·오류·긴 이름·많은 데이터.

## 3. 판정과 수정

- 발견마다 `[심각도 높음/중간/낮음] 화면·폭 — 무엇이 문제 — 어떻게 고칠지(구체 값)` 한 줄.
- 높음이 하나라도 있으면 고치고 1단계부터 다시. **최소 2회전**(만들고 → 보고 고치고 → 다시 보고).
- 고칠 때는 토큰(색·간격·글자 단계)을 먼저 바꾸고, 개별 요소 덧칠은 마지막에.
- Chanel 규칙: 마지막 회전에서 장식 하나를 뺀다.
- 독립된 눈이 필요하면 `design-critic` 에이전트에게 스크린샷 경로와 BRIEF.md 경로를 넘긴다 (만든 쪽이 스스로 채점하지 않게).

## 4. 기록

검토가 끝나면 `design/journal.md`에 앱 한 줄 기록: 날짜 · 앱 · 글꼴 · 핵심 색 2개 · 시그니처 요소 · 참고 레퍼런스 · 다음엔 피할 것.

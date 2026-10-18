---
name: polish-webapp
description: 이미 만든 웹앱(이 프로젝트 작업물 또는 다른 폴더·다른 사람이 만든 앱)을 기능은 그대로 두고 디자인·문구·마감만 전문가 수준으로 끌어올린다. "디자인 다듬어 줘", "AI 느낌 빼줘", "고급스럽게", /polish-webapp 일 때 사용.
argument-hint: <앱 폴더 또는 html 경로>
---

# polish-webapp — 기존 앱 다듬기

1. **복사본에서 작업**: 다른 폴더의 앱이면 `작업물/<앱>-polish/`로 복사해서 고친다. 원본은 건드리지 않는다.
2. **현재 상태 찍기**: `shoot.py`로 before 스크린샷(`.review/before-*`로 이름 변경해 보관).
3. **진단**: redesign-existing-projects 스킬의 Design Audit + `school-ui-craft/references/ai-tells-ko.md` 대조 + web-design-guidelines(접근성·UX 규칙) 검토. 결과를 BRIEF.md "다듬기 진단"에 적는다.
4. **기능 목록 잠그기**: 버튼·입력·서버 호출(`google.script.run`)·id 목록을 BRIEF에 적는다. 다듬은 뒤 이 목록이 모두 살아 있어야 한다(verify_webapp G1·H3이 일부 확인).
5. **방향**: 기존 브랜드(학교 색, 이전 앱과의 통일)가 있으면 상속. 없으면 `design-director`에게 계획 요청.
6. **고치는 순서**: 토큰 → 글꼴 → 간격 리듬 → 위계(주 버튼 하나) → 상태 → 반응형 → 인쇄 → 문구(`ux-writer`).
7. **after 찍고 비교**: before/after를 `design-critic`에게 함께 넘긴다.
8. 검증기 실패 0, 기능 목록 전부 동작 확인 후 전달. 바꾼 점은 3~5줄로만.

# 마감 기준 — 컴포넌트별

## 토큰 뼈대 (앱마다 값은 새로 정한다)

```css
:root{
  /* 색: 역할 이름으로만. 값은 앱 주제에서 정한다 */
  --ink:#…; --ink-soft:#…; --ink-faint:#…;
  --surface:#…; --surface-raised:#…; --line:#…;
  --accent:#…; --accent-ink:#…;      /* 강조는 한 곳에 */
  --ok:#…; --warn:#…; --danger:#…;
  /* 글자 */
  --font-body:"…", -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  --font-display:"…", var(--font-body);
  --step--1:.8125rem; --step-0:1rem; --step-1:1.25rem; --step-2:1.563rem; --step-3:1.953rem; --step-4:2.441rem; /* 비율은 앱마다 1.2~1.333 중 선택 */
  /* 간격: 4px 리듬 */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px; --s7:48px; --s8:64px;
  /* 모서리: 계층별로 다르게 */
  --r-sm:4px; --r-md:8px; --r-lg:14px;
}
html{ -webkit-text-size-adjust:100%; }
body{ font-family:var(--font-body); color:var(--ink); background:var(--surface);
      line-height:1.65; word-break:keep-all; overflow-wrap:anywhere; }
[hidden]{ display:none !important; }
:focus-visible{ outline:2px solid var(--accent); outline-offset:2px; }
@media (prefers-reduced-motion:reduce){ *{ animation:none!important; transition:none!important; } }
```

## 버튼
- 위계 3단계까지: 주 버튼(화면에 1개) / 보조 / 텍스트 버튼. 주 버튼이 여러 개면 위계 실패.
- 높이 40px(PC) / 48px(터치). 글자 600 굵기. 아이콘은 글자 앞, 16~20px.
- 눌림(`:active`)·비활성(`:disabled` + 이유 안내)·처리 중(글자 유지 + 작은 진행 표시, 폭 변하지 않게) 상태.
- `transition`은 바뀌는 속성만(`background-color, box-shadow`) 120~160ms.

## 입력
- 라벨은 항상 위에 보이게(placeholder를 라벨 대신 쓰지 않는다). 예시는 placeholder나 도움말로.
- 오류는 칸 바로 아래, 빨강 + 아이콘 + 해결 방법. 제출 시 첫 오류 칸으로 포커스.
- 학번·전화번호는 `inputmode="numeric"`, 이름 칸 `autocomplete="off"`(공용 기기).
- 엑셀에서 여러 줄 붙여넣기 받는 칸이면 탭/줄바꿈 파싱 + 미리보기 표.

## 표 (교사 도구의 핵심)
- 머리행 고정(`position:sticky`), 숫자 열 오른쪽 정렬 + tabular-nums, 글자 열 왼쪽.
- 줄무늬보다 가는 구분선 + hover 행 강조. 300행에서도 빠르게(필요하면 가상 스크롤).
- 정렬·검색·필터 상태가 화면에 보인다. 빈 결과면 "조건에 맞는 학생이 없어요 · 필터 지우기".
- 휴대폰에서는 표를 카드 목록으로 바꾸거나 가로 스크롤 영역을 표에만 한정.

## 빈 상태 · 로딩 · 오류
- 빈 상태: 무엇이 여기 올지 + 첫 행동 버튼. 그림은 선택, 장식 일러스트 금지.
- 로딩: 300ms 이하는 표시하지 않는다. 길면 뼈대(skeleton)를 실제 레이아웃 모양으로.
- 오류: 무슨 일이 / 왜 / 어떻게. 재시도 버튼. 기술 메시지는 접어서.

## 알림 · 확인
- `alert`/`confirm` 대신 페이지 안 대화상자(`<dialog>`) 또는 되돌리기 토스트("삭제했어요 · 되돌리기").
- 되돌릴 수 없는 일(전체 삭제, 제출)만 확인 대화상자. 확인 버튼 이름은 행동 그대로("명단 삭제").

## 아이콘
- 한 세트만: Lucide 또는 Phosphor(선 굵기 통일). 인라인 SVG 권장(외부 요청 줄이기).
  - Lucide: `https://unpkg.com/lucide-static@0.469.0/icons/<이름>.svg` 를 받아 인라인으로 붙인다.
- 이모지를 아이콘 대신 쓰지 않는다(학생 게임의 의도된 연출은 예외, BRIEF에 기록).

## 움직임
- 사용자 행동에 대한 응답만(열림, 펼침, 저장됨). 페이지 진입 연출은 앱 전체에 한 번까지.
- 지속 160~240ms, `cubic-bezier(.2,.7,.2,1)` 류. 위치 이동보다 투명도·크기 작은 변화.

## 인쇄
```css
@page{ size:A4; margin:15mm; }
@media print{
  nav, .no-print, button{ display:none !important; }
  body{ background:#fff; color:#000; font-size:10.5pt; }
  table{ border-collapse:collapse; } thead{ display:table-header-group; }
  tr, .card{ break-inside:avoid; }
  a[href]::after{ content:""; }
}
```

## 데이터와 개인정보
- 학생 이름·학번·성적은 기본적으로 **브라우저 안에서만** 처리(파일 읽기 → 화면 → 다운로드). 서버 저장이 필요하면 BRIEF에 이유와 보관 위치 기록, `privacy-guard` 검토.
- 예시 데이터는 실제 같되 가상: `20315 김하늘`. 실존 학생 이름 금지.

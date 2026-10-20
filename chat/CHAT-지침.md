# 수업잇기 · Chat용 가벼운 길 — AI에게 주는 지침

> **AI에게**: 선생님이 이 저장소 주소(https://github.com/zkxmdydy106-ai/sueop-itgi)와 수업 자료(교과서 몇 쪽·PPT·학습지·글)를 주며
> "Chat용으로 수업 화면 만들어 줘"라고 하면, 이 문서를 처음부터 끝까지 읽고 그대로 따른다.
> 결과물은 **HTML 파일 하나**다. 서버·설치가 필요 없고, 선생님은 받은 파일을 더블클릭해 크롬·엣지에서 연다(인터넷 연결 필요).

## 0. 이 길로 되는 것 / 안 되는 것 (선생님께 처음에 한 줄로 알린다)

| 된다 | 안 된다 (→ Claude Code로 「수업잇기 만들어 줘」) |
|---|---|
| 전자칠판 수업 화면(1920×1080, 스크롤 없음), 목차, 단계별로 열기, 예제 풀이 한 줄씩 | 교과서 PDF 한 권 전체를 쪽 그림까지 옮기기 |
| 판서(펜·형광펜·지우개·레이저, 색 6칸 + 색 바꾸기), 문제 「크게 풀기」 | 학생 로그인·학습지 보내기·제출·채점·기록·생기부 |
| 3D·움직이는 모형(아래 목록), 그림으로 정리(흐름·비교·연표 등) | 학생 아이패드와 실시간(「학생과 같이」 값 모으기) |
| 화면 전체 인쇄(A4 가로, 풀이 펼침) | 선생님 학습지 양식 그대로 인쇄 |

## 1. 먼저 묻기 (짧게, 한 번에)

1. 과목·학년, 이번 차시 주제
2. 자료 범위 (교과서라면 몇 쪽 — 사진이나 글로 주세요)
3. 수업 흐름에서 꼭 넣을 것 (생각 열기 질문, 예제, 탐구, 정리 …)
4. 넣고 싶은 모형·그림이 있는지 (없으면 AI가 맞는 것을 고른다)

답을 받으면 **화면 설계표**(화면 번호 · 단계 · 제목 · 넣을 블록)를 먼저 보여 주고 확인받은 뒤 HTML을 만든다.

## 2. 만드는 법 — 틀을 복사하고 `LESSON`만 바꾼다

- 틀: https://github.com/zkxmdydy106-ai/sueop-itgi/blob/main/chat/수업화면-틀.html
  (원본 글: https://raw.githubusercontent.com/zkxmdydy106-ai/sueop-itgi/main/chat/수업화면-틀.html)
- 틀에서 **`window.LESSON = { … };` 부분만** 바꾼다. `<link>`·`<script src>` 주소(`…sueop-itgi@lite-1/…`)는 **한 글자도 바꾸지 않는다**.
- 결과는 **완성된 HTML 파일 하나**로 준다(채팅 미리보기 창이 아니라 내려받을 파일). 파일 이름 예: `벡터의실수배_수업화면.html`.
- 틀을 열 수 없으면 아래 §7의 머리·꼬리를 그대로 쓰고 가운데에 `LESSON`을 넣는다.

```js
window.LESSON = {
  "title": "차시 제목",            // 위 머리 줄에 굵게
  "unit": "단원 이름",             // 위 머리 줄 앞쪽
  "source": "출처 (교과서 출판사·쪽 등)",   // 인쇄 마지막에 찍힘
  "screens": [
    { "id": "s1", "kind": "open", "step": "생각 열기", "chip": "생각 열기", "title": "화면 제목", "blocks": [ … ] }
  ]
};
```

### 화면(screen) 칸
| 칸 | 뜻 |
|---|---|
| id | `s1`, `s2` … (판서가 이 이름에 붙어 저장된다. 한 번 정하면 바꾸지 않는다) |
| kind | `open`(생각 열기) `concept`(개념) `problem`(예제·문제) `activity`(탐구) `summary`(정리) |
| step | 화면 위 작은 이름표 (교과서 단계 이름 그대로) |
| chip | 아래 진행 막대의 짧은 이름 (8자 안팎) |
| title | 화면 큰 제목 |

### 화면 나누기 (스크롤 없음 — 가장 중요)
- 칠판 화면은 1920×1080, 글자 34px대. 5m 뒤에서 읽혀야 한다.
- 한 화면 = 선생님이 한 번에 설명하는 분량: **정의 1개 + 그림 1개**, 또는 **예제 1개 + 문제 1개**, 또는 탐구 하나.
- 넘칠 것 같으면 **화면을 나눈다.** 글을 줄이거나 요약하지 않는다.
- 글 | 그림(또는 모형) 2단은 `cols` (ratio `[5,4]`).

## 3. 블록 (blocks)

| t | 칸 | 쓰는 곳 |
|---|---|---|
| `p` | x | 본문 문단 |
| `h` | x | 화면 안 소제목 |
| `def` | x, label('정의'·'성질'·'개념 노트') | 정의·성질·공식 상자 |
| `note` | x, label('참고'·'보기'·'주의'·'생각해 보기') | 참고·발문·도움말 |
| `list` | items[], ordered(true/false) | 목록 |
| `table` | head[], rows[[…]] | 표 (칸 수 같게) |
| `fig` | svg 또는 src(이미지 주소), cap, alt, w('70%') | 그림. 직접 그린 그림은 svg 문자열 |
| `ex` | label('예제 1'), q, sol[](풀이 단계), ans | 예제 — 칠판에서 「다음」을 누를 때마다 풀이가 한 줄씩 열린다 |
| `prob` | label('문제 1'), q, sub[](소문항), ans, sol[] | 문제 — 「크게 풀기」로 크게 열어 판서 |
| `act` | label('탐구'), title, x, items[] | 탐구·활동 순서 |
| `read` | label('읽기 자료'), title, x | 읽기 자료 |
| `lab` | lab, label, desc, props{} | 3D·움직이는 모형 버튼 (§4) |
| `viz` | kind + 종류별 칸 | 글로 된 개념을 그림으로 (§5) |
| `cols` | ratio[], cols[[블록…],[블록…]] | 2~3단 배치 |

- **단계 열기** `"r": 1, 2, 3 …` — 「다음」을 누를 때 차례로 보일 블록에만 붙인다(발문 → 답). 모든 블록에 붙이지 않는다.

### 글 표기법 (모든 글 칸)
- 수식: `$…$` (KaTeX). 가운데 큰 수식은 `$$…$$`. 예: `$\\vec a$`, `$\\dfrac{1}{2}$`, `$\\overrightarrow{AB}$`
- **JSON 안에서는 역슬래시를 두 번** 쓴다: `"x": "$\\vec a$"` (한 번만 쓰면 수식이 깨진다)
- 굵게 `**…**`, 형광 `==…==`, 밑줄 `__…__`, 핵심어 `[[…]]`, 줄바꿈 `\n`
- `$`, `\frac` 같은 기호가 **화면에 글자로 보이면 안 된다.** 만든 뒤 스스로 한 번 훑어본다.

## 4. 모형 (`lab`) — 고를 수 있는 것

| lab | 무엇 | props |
|---|---|---|
| `vector-ops` | 평면벡터 (모눈 위 화살표 끌기) | `mode`: `add`(합·삼각형) `para`(합·평행사변형) `sub`(차) `scalar`(실수배, `k`) `comp`(성분) `divide`(내분점, `m`,`n`) `dot`(내적) `line`(직선, `t`) `normal`(법선벡터) `river`(강을 건너는 배, `river`: 강물 속력) · `a`:[x,y] `b`:[x,y] |
| `vector-coord` | 좌표공간 3D | `mode`: `comp` `unit` `ab` `line` `plane` `sphere` · `a`:[x,y,z] `b`:[x,y,z] `t` `s` `r` |
| `vector-box` | 직육면체 속 공간벡터 3D | `size`:[가로,깊이,높이] `ka` `kb` `kc`(-1/0/1) `from`:'A' |
| `projection` | 정사영 3D (두 평면 경첩) | `mode`: `segment`/`area`, `angle`: 0~90 |
| `gas` | 기체 분자 운동·압력 (보일·샤를) | `n`, `T`, `V` |
| `orbit` | 지구의 공전과 계절 3D | `day`(1~365), `tilt`, `lat` |
| `terrain` | 지형과 등고선·단면 3D | `interval`, `sea`, `seed` |

- 입체·공간·회전이면 3D 모형, 평면 그래프·벡터면 2D 모형.
- `desc`에 "무엇을 바꾸며 무엇을 보는지" 한 줄. 예: `"desc": "k를 바꾸며 ka 보기"`
- 목록에 맞는 모형이 없으면 억지로 넣지 않는다(§5의 viz나 svg 그림으로).

## 5. 그림으로 정리 (`viz`)

```json
{ "t": "viz", "kind": "flow", "title": "순서", "stepwise": true, "steps": [ { "t": "첫째", "d": "설명" }, { "t": "둘째" } ] }
{ "t": "viz", "kind": "cycle", "steps": [ … ] }
{ "t": "viz", "kind": "compare", "title": "비교", "cols": [ { "title": "가", "items": ["…"] }, { "title": "나", "items": ["…"] } ] }
{ "t": "viz", "kind": "timeline", "events": [ { "when": "1392", "t": "조선 건국", "d": "…" } ] }
{ "t": "viz", "kind": "venn", "a": { "t": "…", "items": [] }, "b": { "t": "…", "items": [] }, "both": [], "bothTitle": "공통" }
{ "t": "viz", "kind": "map", "center": "광합성", "nodes": [ { "t": "빛", "d": "…", "link": "필요" } ] }
{ "t": "viz", "kind": "graph", "fn": "a*Math.sin(b*x)", "params": { "a": [0.5, 3, 1, 0.1] }, "x": [-6.3, 6.3], "y": [-3, 3], "label": "$y=a\\sin x$" }
```
`graph`의 params: 이름 → [최소, 최대, 처음 값, 간격]. 칠판에서 막대로 바꿔 본다.

## 6. 꼭 지킬 것

- **교과서 글은 그대로.** 요약·바꿔 쓰기·생략 금지. 문장·수식·문제 번호까지 같게. 덧붙이는 말(발문·설명)은 `note`로 구분한다.
- 교과서 쪽 사진을 그대로 붙이지 않는다(그림이 필요하면 svg로 다시 그리거나 선생님 사진 주소를 `fig.src`로).
- **저작권**: 교과서 내용이 든 HTML은 수업용으로만. 인터넷 공개 게시(블로그·공개 사이트·공개 드라이브 링크)를 하지 말라고 선생님께 알린다.
- 학생 이름·성적 같은 개인정보를 넣지 않는다.
- 다 만든 뒤 스스로 점검: JSON이 깨지지 않았는지(쉼표·따옴표·역슬래시 두 번), 화면마다 넘칠 만큼 길지 않은지, 수식 기호가 글자로 남지 않는지.

## 7. 틀을 못 열 때 — 머리와 꼬리 (그대로 복사)

머리 (`<head>` 안):
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/vendor/fonts/fonts.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/vendor/katex/katex.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/css/tokens.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/css/content.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/css/ink.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/css/board.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/css/lab.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/css/lite.css">
```
`<body>` 맨 앞: `<script> window.LESSON = { … }; window.DT_CONFIG = { mode: 'demo', assetBase: 'https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/' }; </script>`

꼬리 (`</body>` 바로 앞, 이 순서 그대로):
```html
<script src="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/vendor/katex/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/js/core.js"></script>
<script src="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/js/render.js"></script>
<script src="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/js/viz.js"></script>
<script src="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/js/ink.js"></script>
<script src="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/js/lab.js"></script>
<script src="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/js/labs/vector-ops.js"></script>
<script src="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/js/labs/vector-coord.js"></script>
<script src="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/js/labs/vector-box.js"></script>
<script src="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/js/labs/projection.js"></script>
<script src="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/js/labs/gas.js"></script>
<script src="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/js/labs/orbit.js"></script>
<script src="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/js/labs/terrain.js"></script>
<script src="https://cdn.jsdelivr.net/gh/zkxmdydy106-ai/sueop-itgi@lite-1/engine/app/assets/js/lite.js"></script>
```

## 8. 선생님께 전달할 때 (이 순서로 짧게)

1. 파일 이름과 "더블클릭 → 크롬·엣지에서 열려요(인터넷 필요)"
2. 쓰는 법: → ← (또는 화면 아래 동그라미) 넘기기 · 「판서」 펜 · F 전체 화면 · T 목차 · 「인쇄」 A4 가로
3. 판서는 그 컴퓨터 브라우저에만 남는다는 것
4. 학생 기록·학습지까지 원하면: Claude Code에서 `이 저장소로 수업잇기 만들어 줘: https://github.com/zkxmdydy106-ai/sueop-itgi`

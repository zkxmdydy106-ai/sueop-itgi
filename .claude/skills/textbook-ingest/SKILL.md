---
name: textbook-ingest
description: 교과서 PDF에서 쪽 그림·글 줄·그림·목차를 뽑고, 쪽 번호를 맞추고, 교과서 글이 빠짐없이 옮겨졌는지 검사하는 방법. extract.py·attach_index.py·coverage.py·figure_palette.py를 쓸 때, 스캔본·재단선·쪽 번호 문제가 있을 때 읽는다.
---

# 교과서 PDF 다루기

도구는 모두 `tools/ingest/`. 필요: `pip install pymupdf pillow`.

## 1. 추출

```
python tools/ingest/extract.py "교과서_넣는곳/<파일>.pdf" --out "작업물/<이름>/content" [--pages 70-120] [--offset 10] [--trim auto|none|3]
```
- `--pages`는 **인쇄된 쪽 번호** 범위. 큰 교과서는 이번에 만들 단원만 뽑는다(쪽 그림이 Firestore 용량을 쓴다).
- 만드는 것: `pages/p072.webp`(원본 보기), `pages/hi/p072.webp`(확대용, ≤740KB), `figs/`(그림 후보), `_extract/pages.json`(글 줄 좌표·글자 크기·굵기), `outline.json`(책갈피), `report.md`.
- **암호·복사 금지 PDF**: 도구가 ✗로 멈춘다. 다른 라이브러리·온라인 변환·화면 캡처 반복으로 우회하지 않는다. `copyright-guard`의 안내를 선생님께 전한다.

## 2. 반드시 눈으로 확인

`report.md`를 읽은 뒤:
1. **쪽 번호 보정** — 확신도가 낮거나(70% 미만) 책갈피가 없으면, 쪽 그림 2~3장을 Read로 열어 아래 여백의 인쇄 쪽 번호와 파일 이름(p072)이 같은지 본다. 다르면 `--offset`을 주고 다시 뽑는다.
2. **재단** — 쪽 그림 가장자리에 재단선(십자 표시)·색 띠·파일 이름이 남았으면 `--trim 3`(mm)처럼 다시. 내용이 잘렸으면 `--trim none`.
3. **스캔본** — '글자 레이어가 거의 없는 쪽'이 있으면 그 쪽은 글 줄 자료가 없다. 쪽 그림(`pages/hi/`)을 Read로 읽어 직접 옮겨 적고, coverage 검사 대신 `content-auditor`의 원본 대조를 더 꼼꼼히 받는다. BRIEF에 "스캔 쪽: …" 기록.
4. **양면 배치** — 교과서는 보통 짝수 쪽이 왼쪽(`pairing: even-left`). 원본 보기에서 펼침이 어긋나면 `content.js`의 `pages.pairing`을 `odd-left`로.

## 3. 글 옮기기 원칙 (content 작성 때)

- 글 줄은 `pages.json`에서 복사해 쓰되, **줄바꿈 하이픈·단 나눔·머리말**을 정리한다. 문장은 그대로.
- 수식은 PDF 글자로는 깨진다(특수 글꼴). **쪽 그림을 보고** LaTeX로 다시 쓴다: `$\overline{\mathrm{AB}}\cos\theta$`. 변수는 기울임(기본), 단위·글자는 `\mathrm{}`, 각도 `^\circ`, 분수는 화면에서 `\dfrac`.
- 표는 칸 그대로 `table`. 그림 속 글자(라벨)는 그림과 함께 둔다(fig 이미지 또는 직접 그린 svg).
- 교과서 그림을 그대로 쓸 때: `figs/`에서 고른 파일을 `fig.src`로. `-box`가 붙은 것은 글 상자(그림 아님) → 글로 옮긴다.
- 빼도 되는 것: 쪽 번호, 머리말·꼬리말(단원 이름 반복), 재단 정보, QR 안내 문구, 출판사 광고. 그 밖은 전부 넣는다.

## 4. 색인 붙이기

```
python tools/ingest/attach_index.py "작업물/<이름>/content"
```
- `pages`(쪽 범위·비율·파일 꼴), `lines`(원본 속 검색·영어 읽어 주기), `terms`(원본 위 용어 밑줄 자리)를 채운다.
- 용어 자리는 glossary의 용어가 그 쪽 글 줄에 나오는 첫 자리 하나(쪽마다 용어당 한 번, 겹치면 긴 용어 우선) — 밑줄이 난잡해지지 않게.
- "뜻이 비어 있는 용어"가 나오면 교과서 문장으로 채운다(교과서에 정의가 없으면 교과서 설명 문장을 그대로).
- glossary를 고칠 때마다 다시 실행한다.

## 5. 빠짐 검사

```
python tools/ingest/coverage.py "작업물/<이름>/content" --pages 72-76 [--ignore 작업물/<이름>/content/_extract/ignore.txt]
```
- PDF 글 줄이 화면 글(블록·용어·문제)에 들어갔는지 한 줄씩 비교. 띄어쓰기·문장부호·수식 표기 차이는 무시.
- ✗ 빠짐이 0이 될 때까지 넣는다. 정말 빼야 하는 줄(인쇄용 안내 등)만 `ignore.txt`에 `줄 글  # 이유`로.
- △ 거의 들어감은 수식·줄바꿈 차이일 때가 많다 — 쪽 그림과 대조해 확인.
- 수식만 있는 줄은 PDF 글자가 깨져 비교가 안 될 수 있다 → `content-auditor`가 그림으로 대조.

## 6. 그림 색 → 3D 모형 톤

```
python tools/ingest/figure_palette.py "작업물/<이름>/content/figs/p075-1.webp"
```
→ `{"plane": "#F6B98E", "plane2": "#9FD9C0", "line": "#17191B", ...}` 을 lab 블록과 hotspot의 `theme`에 넣는다.
뽑힌 색이 이상하면(사진·그라데이션) 그림을 Read로 보고 직접 고른다. 기준: 교과서 그림 옆에 모형 스크린샷을 놓았을 때 같은 책처럼 보일 것.

## 7. 원본 위 3D 버튼(hotspots) 자리

`pages.json`의 그림 후보 `box`([x, y, w, h], 쪽 기준 0~1)를 그대로 쓰면 된다:
```json
"hotspots": { "75": [ { "x": 0.08, "y": 0.42, "w": 0.5, "h": 0.2, "lab": "projection", "label": "3D로 보기", "title": "정사영의 넓이", "props": {"mode": "area"}, "theme": {…} } ] }
```
버튼은 그 상자의 오른쪽 아래 모서리에 뜨고, 상자 전체를 눌러도 열린다. 원본 보기 스크린샷으로 글자를 가리지 않는지 확인한다.

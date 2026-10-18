# 한글 웹 글꼴 목록 (모두 무료·상업 사용 가능, 2026-10 주소 확인)

규칙
- 한 앱에 1~2종. 2종이면 성격이 분명히 달라야 한다(예: 명조 제목 + 고딕 본문).
- **직전에 만든 앱과 같은 조합을 쓰지 않는다** → `design/journal.md` 확인.
- Pretendard는 좋은 글꼴이지만 이제 'AI 기본값'이기도 하다. 고를 이유가 있을 때만 쓴다.
- 항상 대체 스택을 붙인다: `, -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif` (명조면 `"AppleMyungjo", "Batang", serif`).
- 학교망에서 CDN이 막히면 대체 스택으로 보인다 → 대체 스택으로도 무너지지 않게 크기·행간을 잡는다.
- 오프라인·폐쇄망 배포가 필요하면 woff2를 앱 폴더 `fonts/`에 넣고 `@font-face`로 직접 연결한다(OFL 라이선스 파일 동봉).

## 본문·UI 고딕

| 글꼴 | 성격 | 불러오기 | font-family |
|---|---|---|---|
| Pretendard | 중립, 정밀, 숫자 좋음 | `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css">` | `"Pretendard Variable"` |
| SUIT | 조금 더 기하학적·단단함, 업무 도구에 좋음 | `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@sun-typeface/suit@2.0.5/fonts/variable/woff2/SUIT-Variable.css">` | `"SUIT Variable"` |
| Wanted Sans | 넓고 현대적, 제목 굵기가 멋짐 | `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/wanted-sans@1.0.3/fonts/webfonts/variable/split/WantedSansVariable.css">` | `"Wanted Sans Variable"` |
| IBM Plex Sans KR | 기술적·문서적, 차분 | Google Fonts `IBM+Plex+Sans+KR:wght@400;500;700` | `"IBM Plex Sans KR"` |
| Gothic A1 | 고전적 고딕, 굵기 9단계 | Google Fonts `Gothic+A1:wght@400;600;800` | `"Gothic A1"` |
| Gowun Dodum | 부드럽고 손글씨 기운, 초등·학생용 | Google Fonts `Gowun+Dodum` | `"Gowun Dodum"` |
| Orbit | 둥근 기하, 과학·SF 느낌 | Google Fonts `Orbit` | `"Orbit"` |

## 명조 (제목·안내문·가정통신에 품위)

| 글꼴 | 성격 | 불러오기 | font-family |
|---|---|---|---|
| Noto Serif KR | 표준 명조, 굵기 다양 | Google Fonts `Noto+Serif+KR:wght@400;600;900` | `"Noto Serif KR"` |
| Gowun Batang | 따뜻한 바탕체, 공문·편지 | Google Fonts `Gowun+Batang:wght@400;700` | `"Gowun Batang"` |
| Hahmlet | 현대 명조, 굵기 가변, 강한 제목 | Google Fonts `Hahmlet:wght@300..900` | `"Hahmlet"` |
| Nanum Myeongjo | 익숙한 명조 | Google Fonts `Nanum+Myeongjo:wght@400;700;800` | `"Nanum Myeongjo"` |
| Song Myung | 붓맛 명조, 국어·한문·역사 제목 | Google Fonts `Song+Myung` | `"Song Myung"` |
| Diphylleia | 섬세한 장식 명조, 표지·제목 한 줄 | Google Fonts `Diphylleia` | `"Diphylleia"` |

## 제목 전용 (한 화면에 한 번)

| 글꼴 | 성격 | Google Fonts 이름 |
|---|---|---|
| Black Han Sans | 묵직한 포스터, 체육대회·게임 | `Black+Han+Sans` |
| Do Hyeon | 각진 고딕, 전자칠판 숫자 | `Do+Hyeon` |
| Jua | 둥글고 귀여움, 학생 게임 | `Jua` |
| Gasoek One | 아주 굵은 장식, 행사 | `Gasoek+One` |
| Bagel Fat One | 통통한 장식 | `Bagel+Fat+One` |
| Dongle | 가늘고 둥근 장식 (크게 써야 함) | `Dongle:wght@400;700` |

## 손글씨 (메모·피드백 느낌, 본문 금지)

`Nanum+Pen+Script`, `Gaegu:wght@400;700`

## Google Fonts 불러오기 형식

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hahmlet:wght@500;800&family=IBM+Plex+Sans+KR:wght@400;600&display=swap" rel="stylesheet">
```

## 검증된 조합 예 (출발점일 뿐, 그대로 반복하지 말 것)

- 업무 도구, 단단함: SUIT 단독 (400/600/800), 숫자 tabular
- 가정통신·안내: Gowun Batang 제목 + Pretendard 본문
- 과학 탐구: Orbit 제목 + IBM Plex Sans KR 본문
- 국어·역사 학습지: Song Myung 제목 + Noto Serif KR 본문 (명조 본문은 행간 1.8)
- 전자칠판 타이머: Do Hyeon 숫자 + Wanted Sans UI
- 학생 게임: Jua 제목 + Gowun Dodum 본문

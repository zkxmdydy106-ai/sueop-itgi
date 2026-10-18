---
name: awesome-design
description: 실제 서비스 83곳(Linear, Stripe, Notion, Apple, Wise, Vercel 등)의 디자인 시스템을 분석한 DESIGN.md 레퍼런스 라이브러리(VoltAgent/awesome-design-md). 새 웹앱의 디자인 방향을 정할 때, "~처럼 만들어 줘", "더 세련되게", "레퍼런스 찾아줘"라고 할 때, 색·글꼴·간격·컴포넌트 수치를 실제 제품 수준으로 맞추고 싶을 때 사용.
---

# awesome-design — 실제 제품 디자인 시스템 레퍼런스

출처: https://github.com/VoltAgent/awesome-design-md (MIT, `LICENSE`). `library/<서비스>/DESIGN.md` 83종.
각 파일에는 그 서비스의 색 토큰, 글꼴·크기 체계, 간격, 모서리, 그림자, 컴포넌트 규칙, 금지 사항이 수치로 정리돼 있다.

## 언제 쓰나

- `design-director` 에이전트가 디자인 방향을 세울 때 **참고 1~2개**를 고른다.
- 사용자가 특정 서비스 느낌을 원할 때("노션처럼 깔끔하게", "리니어 같은 느낌").
- 결과물이 '그럴듯하지만 밋밋할 때' — 실제 제품의 수치(행간, 자간, 그림자 단계)를 빌려 정밀도를 올린다.

## 쓰는 법

1. `INDEX.md` 표만 보고 앱의 성격에 맞는 후보 2~3개를 고른다. **83개 파일을 다 열지 않는다.**
   - 업무 도구·관리 화면 → `linear.app` `notion` `airtable` `cal` `superhuman` `raycast` `sentry` `posthog`
   - 정돈된 정보·문서 → `stripe` `mintlify` `vercel` `resend` `sanity`
   - 따뜻하고 친근한 학생용 → `airbnb` `nintendo-2001` `spotify` `starbucks` `oura`
   - 숫자·현황판 → `wise` `revolut` `mercury` `kraken` `clickhouse`
   - 신문·게시판형 → `theverge` `wired` `aljazeera`
2. 고른 파일의 **원리**(색 역할 배분, 타입 스케일 비율, 간격 리듬, 강조를 쓰는 곳 한 군데)를 뽑아 앱의 `BRIEF.md` 디자인 계획에 옮긴다.
3. 그대로 베끼지 않는다:
   - 그 회사의 **로고, 서비스명, 마스코트, 고유 일러스트, 전용 글꼴 파일**은 쓰지 않는다. 글꼴은 `school-ui-craft/references/fonts.md`의 무료 한글 글꼴로 대체한다.
   - 브랜드 대표색(예: Stripe 보라, Airbnb 분홍)을 그대로 가져오지 않는다. 그 색이 맡은 **역할**만 가져오고 색은 학교·과목·앱 주제에서 새로 정한다.
   - 영문 기준 수치(자간·행간)는 한글에 맞게 조정한다 (한글 본문 행간 1.6~1.75, 큰 제목 자간 -0.01~-0.03em).
4. 디자인 노트(`design/journal.md`)에 "참고: linear.app — 정보 밀도·회색 단계만 차용"처럼 무엇을 빌렸는지 한 줄 남긴다. 다음 앱에서 같은 레퍼런스를 연달아 쓰지 않는다.

## 주의

- 이 라이브러리는 대부분 **마케팅 홈페이지** 분석이다. 교사용 도구 화면에는 홈페이지의 히어로·대형 일러스트 문법을 가져오지 말고, 제품 화면(앱 내부) 규칙을 다룬 부분 위주로 읽는다.
- 원본이 갱신될 수 있다: 최신본이 필요하면 `https://getdesign.md/<서비스>/design-md`.

---
name: deploy-webapp
description: 만든 학교 웹앱을 실제로 쓸 수 있게 배포하는 방법 안내와 준비 — Google Apps Script 웹앱(학교 구글 계정), Netlify 드래그 배포, GitHub Pages, 단일 HTML 파일 공유. 배포·공유·QR·주소 만들기를 물을 때 사용.
---

# deploy-webapp — 배포

## 고르기

| 상황 | 추천 |
|---|---|
| 학생 제출을 구글 시트에 모아야 함, 학교 구글 계정만 접근 | **Apps Script 웹앱** |
| 저장 없이 브라우저 안에서만 도는 도구(변환기, 타이머, 계산기) | **Netlify 드래그 배포** 또는 GitHub Pages |
| 동료 선생님께 파일로 전달 | **단일 HTML 파일** (CSS·JS 인라인) |

## Apps Script
1. script.google.com → 새 프로젝트 → `Code.gs`, HTML 파일들을 같은 이름으로 만든다 (파일 이름 = `createHtmlOutputFromFile` 인자).
2. `doGet(e)`에서 `HtmlService.createTemplateFromFile('index').evaluate().setTitle('…').addMetaTag('viewport','width=device-width, initial-scale=1')`.
3. 배포 → 새 배포 → 유형 '웹 앱' → 실행: 나 / 액세스: **(학교) 도메인 내 모든 사용자** 또는 필요한 범위.
4. **고친 뒤에는 배포 관리 → 편집 → 새 버전** (안 하면 옛 버전이 계속 보임).
5. 사용자가 clasp를 쓰면: `clasp push` 후 `clasp deploy -i <배포ID>` 로 같은 주소 유지.

## Netlify
1. app.netlify.com/drop 에 앱 폴더를 끌어다 놓기 → 주소 생성. 같은 사이트에 다시 끌어 놓으면 갱신.
2. 사이트 이름을 바꿔 주소를 읽기 쉽게(`xxx-school-timer.netlify.app`).
3. 명단·성적 파일을 폴더에 넣지 않았는지 확인 (`privacy-guard`).

## GitHub Pages
저장소 → Settings → Pages → 브랜치 `main` / 폴더 `/` 또는 `/docs`. 공개 저장소면 누구나 코드가 보인다는 점 안내.

## 단일 HTML
- 외부 CSS/JS를 인라인으로 합치고, 글꼴은 CDN 링크(학교망에서 막히면 대체 글꼴로 보임)를 안내.
- 파일 이름은 한글 가능하지만 메신저 전송 시 깨질 수 있으니 영문 권장.

## QR
배포 주소가 나온 뒤에만 만든다. 화면 안 QR은 `qrcode-generator` 라이브러리를 버전 고정으로(`https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js`, 전역 `qrcode(0,"M")`) 쓰거나, 배포 주소를 실행 시 받아 생성.

## 전달 문구에 넣을 것
주소, 접근 범위(누가 열 수 있는지), 고친 뒤 갱신 방법, 수업 전 점검 3개.

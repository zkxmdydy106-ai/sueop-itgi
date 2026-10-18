---
name: lab-3d
description: 교과서 개념을 3D 모형·시각화로 만드는 법 — 무엇을 3D로 하고 무엇을 viz/그림으로 할지, '진짜 같은' 품질 기준, 교과서 그림과 같은 톤 맞추기, DT.lab API, 원본 위 3D 버튼, 자료 저작권. 모형을 새로 만들거나 고칠 때, viz 블록을 쓸 때 읽는다.
---

# 3D 모형과 시각화

선생님 요구: **"진짜 같이, 고퀄리티로. 단 교과서에 그림이 있으면 그 그림과 똑같은 톤으로. 그림이 없는 개념도 보여 줄 수 있으면."**
즉 두 가지를 동시에: ① 빛·재질·그림자가 사실적일 것 ② 색·기호·보는 방향은 교과서 그림 그대로일 것.

## 1. 고르기

| 개념의 모양 | 만들 것 | 예 |
|---|---|---|
| 입체·공간·각도, 돌려 봐야 이해됨 | **3D 모형** (`lab`) | 정사영, 공간좌표, 회전체, 분자 구조, 지형, 천체 |
| 움직임·변화·실험 (값을 바꾸면 결과가 변함) | **3D 모형 + 그래프** | 기체 법칙, 진자, 공전과 계절, 표본 추출 |
| 함수·식의 매개변수 | `viz graph` (조절 막대) | $y=a\sin bx$ |
| 순서·과정·절차 | `viz flow` | 실험 과정, 응급 처치, 알고리즘 |
| 순환 | `viz cycle` | 물의 순환, 세포 주기 |
| 비교·대조 | `viz compare` / `venn` | 두 제도, 두 시대, 식물·동물 세포 |
| 시간 흐름 | `viz timeline` | 역사, 과학사 |
| 중심 개념과 연결 | `viz map` | 인물 관계, 개념 지도 |
| 교과서 그림 그 자체가 충분히 명확 | `fig` (그림 그대로) | 사진, 지도, 작품 |

한 화면에 시각화는 하나. 개념 화면 옆(cols)에 버튼(lab) 또는 그림(viz)으로 둔다. 원본 쪽에도 같은 모형을 `hotspots`로 연결한다.

## 2. 품질 기준 ("진짜 같이")

엔진 `ctx.three()`가 이미 해 주는 것: 물리 기반 렌더링, ACES 톤 매핑, 실내 환경광(반사), 부드러운 그림자 맵, 기기 성능에 따라 해상도 자동 조절.
모형마다 지킬 것:
- **빛**: 해 1개(그림자) + 반구광. 그림자가 물체 아래·옆으로 보이게 해 방향을 잡는다(앞쪽 바닥에 떨어지게). 바닥은 `ShadowMaterial`(종이 위에 놓인 느낌).
- **재질**: `g.mat()`(살짝 광택), 평면·막은 `g.acrylic()`(반투명 아크릴), 금속·유리는 metalness/transmission. 아무 재질 없는 단색(MeshBasic) 금지.
- **선**: 모서리·벡터·축은 `g.tube()`(굵기 있는 원기둥) — 1px 선은 칠판에서 안 보이고 가짜 같다. 보조선만 `g.line(…, {dashed:true})`.
- **형태**: 상자는 `RoundedBoxGeometry`(살짝 둥근 모서리), 곡면은 세그먼트 넉넉히(구 48×32 이상).
- **질감**: 실제 사물(지구, 암석, 나무, 금속)은 실제 텍스처(§5의 자유 이용 자료). 수학 도형은 텍스처 없이 깨끗하게.
- **움직임**: 열릴 때 핵심 변화를 1~2초 보여 준다(각이 0→값으로). 계속 도는 장식 애니메이션은 넣지 않는다.
- **글자**: `g.label()` — 수학 기호는 교과서처럼 기울임 세리프(theme.label 'serif-italic'), 한글 이름표는 짧게.
- 하지 않는 것: 네온·발광 남발, 과한 블룸(천체 외), 무지개 그라데이션, 게임 같은 HUD, 회전하는 배경.

## 3. 교과서 톤 맞추기

1. 교과서 그림을 Read로 본다(`content/figs/` 또는 쪽 그림).
2. `python tools/ingest/figure_palette.py <그림>` → `theme` 값. 이상하면 그림을 보고 직접 고른다.
3. 맞출 것: 면 색(plane, plane2, shape), 선 색(line), 강조색(accent), 점·각 기호 이름(교과서의 A, B, α, θ 그대로), **처음 보는 방향**(카메라를 교과서 그림의 시점과 같게 → '교과서처럼' 버튼 = home).
4. lab 블록에 `fig`(그 그림 경로)를 넣으면 모형 구석에 교과서 그림이 함께 떠 비교할 수 있다.
5. 확인: 모형 스크린샷과 교과서 그림을 나란히 Read → "같은 책의 그림처럼 보이는가?"

## 4. 만들기

```
python tools/build/add_lab.py 작업물/<이름> <모형id> --title "원뿔의 단면" --sub "수학 · 기하" --desc "…"
```
→ 고품질 기본값이 들어간 `app/assets/js/labs/<id>.js`가 생기고 칠판·학생·모형 모음 화면에 연결된다.
여러 교과서에 쓸 모형이면 `engine`에 만들고 `--update-engine`. 기존 엔진 모형: `projection`(정사영), `terrain`(지형·등고선·단면), `orbit`(공전·계절), `gas`(기체 분자·압력) — 비슷한 것이 있으면 props로 재사용.

### API
```js
DT.lab.register('id', { title, sub, desc, hint, build(ctx) { … } });
// ctx: theme(교과서 색) · props(content에서 온 값) · root/view/panel
ctx.group('제목') → 패널 묶음
ctx.slider({ label, min, max, step, value, unit, format(v), into, onInput(v) }) → { set, get }
ctx.toggle({ label, value, into, onChange(v) })
ctx.segmented({ label, options: [[값, '글']], value, into, onChange(v) })
ctx.button({ label, icon, into, onClick })
ctx.readout({ label: '넓이 $S\'$', big, into }) → { set('12.5') }     // 바뀌는 값을 크게
ctx.note('설명 한 줄', into)
ctx._reset = () => { … }                                                // '처음 모습' 버튼
DT.lab.miniChart(…)                                                     // 패널 속 작은 그래프 (gas·projection 참고)
const g = ctx.three({ camera:[x,y,z], target:[x,y,z], fov, background, env, bloom:{strength,radius,threshold}, exposure, maxPolar, minDistance, maxDistance });
g.T(THREE) g.scene g.camera g.controls g.renderer
g.onTick((dt, t) => …)   g.home()   g.flyTo(pos, target, 초)
g.mat(색, opts)  g.acrylic(색, 투명도)  g.tube(a, b, r, 색)  g.setTube(m, a, b)  g.line(점들, 색, {dashed})  g.ball(r, 색)  g.label(글)
// THREE에 들어 있는 부품: OrbitControls, RoomEnvironment, GLTFLoader, RGBELoader, CSS2D, EffectComposer/Bloom, RoundedBoxGeometry, mergeVertices
```
패널 원칙: 조절은 **3개 이하**, 결과 값은 `readout big`, 보는 방향은 `segmented`(교과서처럼 / 위 / 옆), 설명은 note 한 줄. 선생님이 칠판 앞에서 손가락으로 쓰기 좋게.

### 성능 (학교 아이패드·전자칠판)
삼각형 30만 개 이하, 텍스처 2048px 이하(webp), 같은 물체가 많으면 `InstancedMesh`(gas 참고), 그림자 맵 2048 하나, 매 프레임 new 금지(미리 만들고 위치만 바꾸기). 닫을 때 정리는 엔진이 한다(`ctx.onDispose`로 추가 정리).

## 5. 자료 저작권 (3D·텍스처·사진)

- 쓸 수 있는 것: 직접 만든 것(코드로 생성), **CC0**(Poly Haven 텍스처·HDRI·모델, ambientCG, Kenney), **퍼블릭 도메인**(NASA 이미지 — 로고·보증 표현 금지, Smithsonian Open Access CC0), 공공누리 1유형(출처 표시).
- 쓰지 않는 것: 출처 모르는 이미지, 상업 모델 사이트 무료 다운로드(라이선스 제각각), 교과서 그림을 텍스처로 쓰기(교과서 그림은 content의 fig로만 — 공개 호스팅에 올라가지 않게).
- 받은 파일은 `app/assets/lab-assets/`에, `CREDITS.md`에 파일·출처·이용 조건 한 줄. 받을 수 없는 환경이면 코드로 만든 절차적 질감(노이즈)으로 대신하고 그 사실을 알린다.

## 6. 글로만 된 개념: viz 블록

```json
{ "t": "viz", "kind": "flow", "title": "정사영의 크기를 구하는 순서", "stepwise": true,
  "steps": [ { "t": "무엇을 어디에 내리는지 확인", "d": "선분인가, 도형인가?" }, { "t": "이루는 각 θ 찾기" }, { "t": "$\\cos\\theta$ 곱하기" } ] }
{ "t": "viz", "kind": "cycle", "steps": [ … ] }                         // 둥글게 순환
{ "t": "viz", "kind": "compare", "cols": [ { "title": "식물 세포", "items": ["세포벽", "엽록체"] }, { "title": "동물 세포", "items": ["…"] } ], "rows": ["(선택) 비교 기준"] }
{ "t": "viz", "kind": "timeline", "events": [ { "when": "1392", "t": "조선 건국", "d": "…" } ] }
{ "t": "viz", "kind": "venn", "a": { "t": "…", "items": [] }, "b": { "t": "…", "items": [] }, "both": [], "bothTitle": "공통" }
{ "t": "viz", "kind": "map", "center": "광합성", "nodes": [ { "t": "빛", "d": "…", "link": "필요" } ] }
{ "t": "viz", "kind": "graph", "fn": "a*Math.sin(b*x)", "params": { "a": [0.5, 3, 1, 0.1], "b": [0.5, 4, 1, 0.1] }, "x": [-6.3, 6.3], "y": [-3, 3], "label": "$y=a\\sin bx$" }
```
- `stepwise: true` → 칠판에서 '다음'을 누를 때마다 한 칸씩 열린다(설명 순서대로).
- viz의 글도 교과서에 있는 말로. 교과서에 없는 연결을 지어내지 않는다.
- graph의 `params`: 이름 → [최소, 최대, 처음 값, 간격].

## 7. 원본 위 3D 버튼
`hotspots`(쪽 → 상자 목록)에 같은 `lab`·`props`·`theme`. 상자 자리는 `_extract/pages.json`의 그림 후보 box. 형식은 `textbook-content`.

## 8. 확인
1. `작업물/<이름>/app/labs.html?open=<id>`를 1920×1080, 1180×820에서 스크린샷(`audit_app.py`가 띄우는 것처럼 로컬 서버로) → Read.
2. 교과서 그림과 나란히 비교 (톤·기호·시점).
3. 슬라이더 끝값(0, 최대)에서 깨지지 않는지, '처음 모습'이 되돌리는지.
4. `check_content.py` — 없는 모형 이름·theme 누락을 잡는다.

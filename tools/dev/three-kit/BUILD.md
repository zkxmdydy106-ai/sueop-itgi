# three-kit 다시 묶기 (3D 엔진 + 부품)

`engine/app/assets/vendor/three/three-kit.min.js` = three.js r160 + 아래 부품을 한 파일로 묶은 것 (window.THREE).
들어 있는 부품: OrbitControls, RoomEnvironment, GLTFLoader, RGBELoader, CSS2DRenderer/CSS2DObject,
EffectComposer, RenderPass, UnrealBloomPass, OutputPass, mergeVertices, RoundedBoxGeometry

부품이 더 필요할 때만 (예: TransformControls, DRACOLoader) entry.js에 한 줄 더하고:

```
cd tools/dev/three-kit
npm init -y && npm i three@0.160.0 esbuild@0.20.2
npx esbuild entry.js --bundle --minify --format=iife --outfile=../../../engine/app/assets/vendor/three/three-kit.min.js
```
그다음 `python tools/build/new_course.py "<교과서>" --update-engine` 으로 각 교과서에 반영.
버전은 고정(three 0.160.0). 올리면 모든 모형을 다시 확인해야 한다.

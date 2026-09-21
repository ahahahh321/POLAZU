# Editor V3 실제 렌더 검증

## 무엇을 렌더링했는가

다음 실제 프로젝트 컴포넌트를 TypeScript로 컴파일했다.

- `DesignerToolbar.tsx`
- `DesignerSidebar.tsx`
- `DesignerInspector.tsx`
- `DesignerIcon.tsx`
- 관련 타입과 디자인 토큰 코드

컴파일된 React 트리를 `react-dom/server`로 실제 DOM 마크업으로 만들고, 프로젝트의 `app/editor/page.css` 전체를 적용한 뒤 **Chromium 144.0.7559.96**에서 렌더링하고 캡처했다. 결과 이미지는 생성형 이미지나 손으로 그린 목업이 아니다.

## 렌더 절차

```text
실제 TypeScript/React 컴포넌트
→ TypeScript 컴파일
→ ReactDOMServer 정적 마크업
→ 실제 page.css 적용
→ headless Chromium 렌더
→ 브라우저 viewport screenshot
→ DOM 크기·overflow 측정
```

브라우저 보안 정책상 `file://` 직접 탐색이 차단되어 HTML과 CSS를 `page.setContent()`로 주입했지만, 레이아웃·폰트 크기·grid·flex·overflow·실제 DOM 요소 렌더는 Chromium 엔진이 계산했다.

## 캔버스 콘텐츠의 범위

에디터 chrome과 패널은 실제 V3 React 컴포넌트다. 중앙 artboard 안의 샘플 페이지는 렌더 결과를 일정하게 비교하기 위한 **결정론적 로컬 mock 프로젝트**다.

이 환경에서는 최신 ZIP에 포함된 Windows용 SWC 의존성만 존재했고, Linux용 Next.js SWC 패키지를 내려받을 네트워크 접근이 차단되어 전체 Next dev server를 실행하지 못했다. 따라서 아래 항목은 구분한다.

- 검증됨: 실제 에디터 shell, 상단 바, 앱 레일, 왼쪽 패널, 캔버스 도구, 오른쪽 inspector, 상태 바, CSS 레이아웃
- 정적 contract 검증됨: source patcher, primitive 삽입, 위치 기반 insert command, 반응형 CSS 생성
- 미검증: 실제 로그인 세션 + 백엔드 + WebContainer/Next 미리보기까지 포함한 end-to-end 실행

## 실제 캡처

- `screenshots/editor-before-actual.png` — 변경 전 실제 컴포넌트 렌더
- `screenshots/editor-v3-actual.png` — V3 Layers 화면, 1600×1000
- `screenshots/editor-v3-insert-actual.png` — V3 Insert 화면, 1600×1000
- `screenshots/editor-v3-1366-actual.png` — V3, 1366×768
- `screenshots/editor-v3-before-after-actual.png` — 실제 렌더 전후 비교

## DOM 실측 결과

| 캡처 | viewport | 좌측 패널 | 중앙 캔버스 | 우측 패널 | 문서 overflow |
|---|---:|---:|---:|---:|---|
| Layers | 1600×1000 | 316×942 | 914×942 | 360×942 | 없음 |
| Insert | 1600×1000 | 316×942 | 914×942 | 360×942 | 없음 |
| Compact | 1366×768 | 316×710 | 680×710 | 360×710 | 없음 |

1366px 화면에서는 1100px artboard가 중앙 캔버스 내부에서 스크롤되지만, 브라우저 문서 자체는 가로·세로로 넘치지 않는다. 이는 의도한 편집기 동작이다.

## 재현 명령

렌더 하네스는 전달 ZIP에는 포함하지 않으며 작업 기록에서만 사용했다. 검증에 사용한 핵심 명령은 다음과 같다.

```bash
node node_modules/typescript/bin/tsc -p .render/v3/tsconfig.json
RENDER_TAB=layers node .render/v3/dist/.render/v3/EditorV3Render.js
RENDER_TAB=insert node .render/v3/dist/.render/v3/EditorV3Render.js
/opt/pyvenv/bin/python .render/v3/capture.py
```

`node_modules`, `.render`, 브라우저 캐시와 임시 빌드 산출물은 최종 ZIP에서 제외한다.

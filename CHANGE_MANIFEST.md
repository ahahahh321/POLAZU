# POLAZU Designer Workspace v2 변경 명세

작성일: 2026-09-21
기준 ZIP: `POLAZU-complete-workspace.zip`
기준 ZIP SHA-256: `ec3919691be6988ee5833914197e6aad3a4350e6b491e7a36ec5a85b36bb9419`

이 문서는 직전 전달본을 기준으로 이번 디자이너 에디터 확장에서 추가·수정한 파일만 기록합니다. 백엔드 Java, Flyway SQL, 인증, 프로젝트·Git API는 변경하지 않았습니다.

## 추가 파일

- `app/editor/_components/designer/DesignerDialogs.tsx`: 명령 검색과 단축키 도움말
- `app/editor/_components/designer/DesignerIcon.tsx`: 에디터 전용 SVG 아이콘
- `app/editor/_components/designer/DesignerInspector.tsx`: 레이아웃·스타일·콘텐츠·접근성 속성 패널
- `app/editor/_components/designer/DesignerSidebar.tsx`: Layers·Insert·Tokens·Pages·Files 패널
- `app/editor/_components/designer/DesignerToolbar.tsx`: 상단 도구막대·캔버스 도구·선택 작업막대
- `app/editor/_lib/design-tokens.ts`: CSS custom property 검색·분류·안전한 단일 선언 수정
- `app/editor/_lib/source-patcher.ts`: JSX/TSX/HTML/CSS 최소 변경과 반응형 규칙 생성
- `docs/DESIGNER_EDITOR.md`: 사용법, 저장 방식, 지원 범위, 제한
- `docs/test-logs/designer-editor.log`: 이번 변경의 정적 검사 원본 로그
- `docs/test-logs/designer-targeted-typecheck.log`: 대상 dependency chain stub typecheck 로그
- `scripts/designer-editor.test.cjs`: source patcher·토큰·primitive·bridge·CSS 회귀 검사
- `MANIFEST.sha256`: 최종 패키지 내부 파일 무결성 목록. 자기 자신은 목록에서 제외

## 수정 파일

- `app/editor/_components/BrowserProjectRuntime.tsx`
  - 실제 designer workspace state와 서버 저장 연결
  - 미확정 inspector 편집 보존, undo/redo, 복구 캐시
  - viewport·zoom·compare·ruler·guide·grid·snap·panel resize
  - Layers/Insert/Tokens/Code/Mock/Audit 연결
  - source-linked save와 read-only 처리
- `public/editor-bridge.js`
  - DOM layer·selection·breadcrumb 보고
  - 단일/다중 선택, 선택 요소 동시 이동, 8방향 resize, nudge
  - 정렬·균등 분배, source-safe copy/paste, duplicate/delete
  - primitive 삽입, visibility/lock/alias, inline text editing
  - preview attr 원본 복구, API mock, 접근성·레이아웃 audit
- `app/editor/_lib/next-ui.ts`
  - Next UI compatibility에서 intrinsic JSX에 source line/column instrumentation
  - 생성 Vite/Babel plugin과 제한 안내
- `app/editor/_lib/types.ts`
  - designer tool, layer, selection, edit, structure operation, audit type 확장
- `app/editor/page.css`
  - 전문 캔버스·툴바·패널·inspector·dialog·compare·audit UI 스타일
- `README.md`
  - designer 기능, 테스트 명령, 문서 링크 갱신
- `docs/FEATURE_SPEC.md`
  - EDT-03~08 기능·권한·저장·실패·제한 명세
- `docs/IMPLEMENTATION_STATUS.md`
  - 완료·부분·미구현·미검증 상태 갱신
- `docs/TEST_REPORT.md`
  - 실행 명령, 89개 정적 assertion 범위, 미검증 환경 기록
- `HANDOFF.md`
  - 재개 지점, 우선 검증, 알려진 제한 갱신
- `package.json`, `package-lock.json`
  - 패키지명/버전과 `test:designer` 스크립트
- `scripts/bridge-probe.cjs`
  - 현재 bridge message와 selection/insert/audit probe 갱신
- `scripts/editor-e2e.cjs`
  - 인증된 프로젝트 editor E2E 입력 환경과 기본 시나리오 갱신
- `scripts/editor-probe.cjs`
  - project ID/storage state 기반 editor probe 갱신
- `CHANGE_MANIFEST.md`
  - 이번 확장본 기준 변경 명세로 교체

## 실제 소스에 저장되는 범위

- 정적 JSX/TSX intrinsic 요소: leaf text, 안전한 attribute/ARIA, inline style, insert, duplicate, delete
- 새 primitive: 첫 저장 전 root text/style/attribute와 breakpoint style을 삽입 snippet에 병합
- HTML: route HTML에서 selector를 다시 찾아 text/attribute/style/insert/duplicate/delete
- 반응형: source-linked 요소에 안정적인 class를 추가하고 전역 CSS 관리 block에 media rule 생성
- CSS token: 선택한 `--custom-property` 선언 occurrence 한 곳만 수정

## 미리보기 또는 session 보조 범위

- 형제 reorder는 preview에서만 수행하며 저장 시 경고
- layer alias와 lock은 현재 편집 session metadata
- ruler guide는 현재 browser session 상태
- component primitive는 정적 구조이며 앱 상태·API·인증 로직을 자동 생성하지 않음

## 삭제 파일

없음.

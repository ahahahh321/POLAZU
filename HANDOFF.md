# POLAZU 작업 인수인계

작성일: 2026-09-21
체크포인트: Workspace 0.2.0 · Designer Workspace v2

## 현재 완료된 수직 경로

1. 세션 인증과 로그인 게이트
2. 프로젝트 생성/목록/GitHub·ZIP import
3. MySQL 서버 workspace와 OWNER/EDITOR/VIEWER
4. revision/idempotency/충돌
5. SSE presence/revision/권한 회수
6. 내부 버전/댓글/멤버/ZIP export
7. GitHub remote check/apply/new branch commit·push/draft PR 코드 경로
8. WebContainer preview와 서버 workspace 저장
9. 소스 연결 designer canvas, toolbar, layers, inspector, responsive, tokens, primitive insert, audit
10. 문서, 정적 테스트, API smoke script

## 디자이너 에디터의 현재 구조

- `BrowserProjectRuntime.tsx`: 전체 workspace state, history, save, viewport, panel 연결
- `designer/DesignerToolbar.tsx`: mode, viewport, canvas controls, selection actions
- `designer/DesignerSidebar.tsx`: layers, insert, tokens, pages, files
- `designer/DesignerInspector.tsx`: layout/style/content/accessibility inspector
- `designer/DesignerDialogs.tsx`: command palette와 shortcut help
- `public/editor-bridge.js`: preview DOM 선택·직접 조작·audit·mock
- `next-ui.ts`: Next UI compatibility와 JSX source instrumentation
- `source-patcher.ts`: JSX/TSX/HTML/CSS 최소 변경
- `design-tokens.ts`: CSS variable scan/update
- `docs/DESIGNER_EDITOR.md`: 사용법과 제한

## 재개 시 먼저 실행

```bash
cp .env.example .env
docker compose up -d mysql

# 프론트
npm ci
npm run check:syntax
npm run typecheck
npm run test:adapters
npm run test:designer
npm run build
npm run dev

# 백엔드
cd backend
./gradlew test
./gradlew bootRun
```

테스트 DB와 API가 실행 중일 때만:

```bash
npm run smoke:api
```

## 이번 체크포인트에서 실제 통과한 검사

```text
PASS: parsed 38 TypeScript/TSX files with no syntax errors
PASS: 14 framework/route/path/bridge checks
PASS: Next UI generation and generated JSX syntax
PASS: 89 designer source patching/generated-element/responsive/tokens/primitives/source mapping/bridge/CSS checks
PASS: public/editor-bridge.js syntax
PASS: app/editor/page.css PostCSS parse
PASS: designer dependency chain targeted strict stub typecheck
```

공식 `npm run typecheck`, `npm run build`, browser E2E, Gradle/MySQL, GitHub 쓰기는 미검증입니다.

## P0 확인 항목

- Next 16.3.5/React 19.3 공식 타입 compile
- actual browser에서 pointer drag/resize와 iframe scale 좌표
- WebContainer UI compatibility의 Babel source location 정확도
- source patch 후 full build와 이벤트/ref/key/form 의미 보존
- CSS module/Tailwind 중심 프로젝트에서 inline style 허용 정책
- HTML DOM serialization diff 범위
- dynamic className fallback selector의 route 안정성
- CSS token 중복 scope 수정 UX
- OWNER/EDITOR/VIEWER server save
- 두 브라우저 SSE/revision conflict
- GitHub 승인 test repository E2E

## P1

- Monaco/CodeMirror + syntax highlight/LSP
- source diff, visual before/after, multi-file change selection
- safe AST transform 확대와 dynamic expression conflict UI
- component 원본/instance/variant/slot/props
- Tailwind token/class editor
- binary asset upload/crop/library
- source-safe reorder와 group/ungroup
- page flow와 same-URL state capture
- Redis 기반 distributed presence

## P2

- prototype interaction editor
- motion timeline과 reduced-motion
- GitHub App/OAuth 및 PR review gate
- audit 자동화 확대와 screen reader testing

## 알려진 제한

- project-wide revision이므로 다른 파일을 동시에 저장해도 늦은 요청은 충돌합니다.
- SSE/presence는 인메모리 단일 백엔드 노드입니다.
- 내부 버전은 전체 snapshot이므로 DB quota/retention이 필요합니다.
- source-linked 정적 intrinsic JSX 범위만 시각 편집을 안전하게 저장합니다. 새 primitive의 첫 저장 전 root style/text/attribute와 responsive class는 삽입 snippet에 합칩니다.
- copy/paste는 소스 안전성을 위해 원본과 같은 레벨에 duplicate로 저장합니다. sibling reorder는 preview-only이며 save warning을 냅니다.
- component primitive는 정적 구조이고 앱 로직을 자동 생성하지 않습니다.
- responsive는 CSS style만 저장하며 text/attribute는 Base 전용입니다.
- layer alias/lock은 session metadata입니다.
- token editor는 CSS custom property 선언을 수정하며 semantic design-system graph는 아닙니다.
- Audit는 근사 보조 검사이고 WCAG 준수를 보증하지 않습니다.
- WebContainer preview 성공은 SSR/API Route/Server Actions 성공을 의미하지 않습니다.

## 데이터 손상 방지

- 원본 폴더에 바로 덮어쓰지 말고 새 폴더 또는 별도 Git branch에서 적용
- 운영 DB migration 전 clone/test DB 검증
- Git 게시 test는 승인된 test repository만 사용
- `.env`, token, credential을 source ZIP에 넣지 않기
- remote apply 전 내부 version 보존
- dynamic source 경고가 나온 변경은 Review JSON과 Git diff로 확인

# POLAZU Editor V3 테스트 보고서

검증 일자: 2026-09-21

## 1. TypeScript 전체 타입 검사

```bash
npm run typecheck
```

결과:

```text
> polazu-workspace@0.2.0 typecheck
> tsc --noEmit

exit code 0
```

## 2. TypeScript/TSX 구문 검사

```bash
npm run check:syntax
```

결과:

```text
PASS: parsed 38 TypeScript/TSX files with no syntax errors
```

## 3. 프레임워크·라우트·소스 보존 검사

```bash
npm run test:adapters
```

결과:

```text
PASS: 14 framework, route, path containment and bridge syntax checks
PASS: Next UI generation, layouts, routes, source preservation and generated JSX syntax
```

## 4. 디자이너 source patcher 검사

```bash
npm run test:designer
```

결과:

```text
PASS: 100 designer source patching, generated-element, responsive, tokens,
component primitives, source mapping, bridge and CSS checks
```

100은 사용자 기능 수가 아니라 정적 assertion 수다.

추가 확인 범위:

- Link primitive
- 24개 primitive 정의
- `insert-at-point` bridge command
- V3 필수 CSS selector
- source mapping
- generated element patch
- responsive class and rules
- token patch
- bridge JavaScript 문법
- 서버 presence가 상단 바까지 전달되는 contract
- 자동 저장 debounce와 drag payload contract
- PostCSS를 통한 editor CSS 파싱

## 5. 실제 Chromium 렌더

브라우저:

```text
Chromium 144.0.7559.96, Debian 13
```

캡처 viewport:

- 1600×1000 — Layers
- 1600×1000 — Insert
- 1366×768 — Compact

결과:

```text
1600×1000 document: 1600×1000, overflowX=false, overflowY=false
1600×1000 Insert:   1600×1000, overflowX=false, overflowY=false
1366×768 document:  1366×768,  overflowX=false, overflowY=false
```

원본 측정 로그: `docs/test-logs/editor-v3-render-metrics.log`

## 6. 자동 저장 및 삽입 코드 검토

자동 저장 contract:

- 마지막 편집 후 1,400ms debounce
- read-only, 저장 함수 없음, preview 준비 전에는 저장 안 함
- 동일 편집 payload 실패 후 무한 자동 재시도 방지
- 저장 진행 중 새 변경이 발생하면 완료 후 새 key로 다시 예약 가능

위치 기반 삽입 contract:

- Insert card의 drag payload 사용
- drop 좌표를 iframe local 좌표로 변환
- `document.elementFromPoint()`로 대상 확인
- 허용 컨테이너까지 부모 탐색
- page 영역 밖 drop은 명시적인 경고

이 두 흐름은 타입·정적 source contract로 확인했다. 완전한 pointer E2E는 아래 이유로 미검증이다.

## 7. 실행 환경 때문에 미검증으로 남긴 항목

### Next.js 정식 dev/build

최신 ZIP에 Windows용 Next SWC 의존성만 있었고 Linux용 native SWC가 없었다. 외부 패키지 다운로드는 DNS/네트워크 정책으로 차단됐다. 따라서 다음을 성공했다고 표시하지 않는다.

```bash
npm run dev
npm run build
```

### 실제 애플리케이션 E2E

- 로그인 → 프로젝트 열기 → 실제 WebContainer iframe 편집
- Insert card를 실제 iframe에 드래그하여 소스 저장까지 연결
- 두 계정의 공동 작업과 역할 회수
- 실제 GitHub commit/push/draft PR
- Firefox/Safari 실브라우저

### 백엔드 회귀

이번 반복은 에디터 프론트엔드에 집중했으며 Java/Flyway 코드는 수정하지 않았다. 기존 백엔드 전체 Gradle 회귀는 이번 결과의 성공 항목으로 표시하지 않는다.

## 로그 파일

- `docs/test-logs/editor-v3-typecheck.log`
- `docs/test-logs/editor-v3-syntax.log`
- `docs/test-logs/editor-v3-adapters.log`
- `docs/test-logs/editor-v3-designer.log`
- `docs/test-logs/editor-v3-render-metrics.log`
- `docs/test-logs/editor-v3-next-build.log` — Linux SWC 다운로드 차단 실패 기록

# 테스트 보고서

작성일: 2026-09-21
대상: POLAZU Workspace 0.2.0 디자이너 에디터 확장본

검사 숫자는 테스트 assertion/정적 check 개수이며 사용자 기능 개수를 의미하지 않습니다. Mock·parser·stub 검사는 실제 브라우저·공식 dependency·DB E2E와 구분합니다.

## 1. 이번 디자이너 에디터 변경에 대해 실제 실행한 검사

### 1.1 TypeScript/TSX parser

```bash
npm run check:syntax
```

결과:

```text
PASS: parsed 38 TypeScript/TSX files with no syntax errors
```

전역 TypeScript compiler API로 `app`, `components`, `lib`의 TS/TSX를 parser 수준에서 검사했습니다.

### 1.2 기존 framework adapter 회귀

```bash
npm run test:adapters
```

결과:

```text
PASS: 14 framework, route, path containment and bridge syntax checks
PASS: Next UI generation, layouts, routes, source preservation and generated JSX syntax
```

검사 범위:

- framework와 route 감지
- 경로 containment
- editor bridge JavaScript syntax
- Next.js UI compatibility 프로젝트 생성
- layout/page 변환과 원본 보존
- 생성 JSX syntax

### 1.3 디자이너 전용 source patching·UI 구조 검사

```bash
npm run test:designer
```

결과:

```text
PASS: 89 designer source patching, generated-element, responsive, tokens, component primitives, source mapping, bridge and CSS checks
```

주요 검사:

- `/path/file.tsx:line:column` source reference parsing
- JSX static text·style·attribute 최소 patch
- insert·duplicate·delete
- 삽입 직후 style·attribute·text를 HTML/JSX snippet에 병합
- 삽입 직후 duplicate·delete 및 삽입 취소 정리
- Base와 responsive edit 분리
- 정적 className에 responsive class 병합
- className이 없는 요소에 새 class 삽입
- 동적 className의 selector fallback warning
- global CSS의 media block 생성
- CSS design token 검색·분류·동일 이름 occurrence 수정
- 위험한 token 값 거부
- Babel source mapping instrumentation 포함 여부
- 생성 Vite config를 `node --check`로 검사
- 24개 UI primitive의 JSX parser 검사
- bridge의 drag/resize/다중 선택 동시 이동/align/distribute/insert/lock/visibility/audit 기능 존재와 JavaScript syntax
- src·href·alt·ARIA preview 변경의 원본 속성 복구 경로
- source-safe copy/paste가 구조 변경 action을 생성하는 경로
- PostCSS parser로 전체 editor CSS 검사
- toolbar/layer/inspector/command/compare/token selector 존재

이 테스트에서 **className이 없는 JSX 요소에 responsive class를 넣는 정규식 결함**을 발견했고 수정한 뒤 회귀 케이스를 추가했습니다. 추가 검토에서 속성 Undo 복구, 다중 선택 동시 이동, 삽입 직후 추가 스타일 저장, copy/paste 영속화 경로도 보강했습니다.

### 1.4 Bridge와 CSS 개별 syntax

```bash
node -c public/editor-bridge.js
node -e "const fs=require('fs');require('postcss').parse(fs.readFileSync('app/editor/page.css','utf8'))"
```

결과:

```text
PASS: bridge syntax
PASS: PostCSS parsed app/editor/page.css
```

### 1.5 대상 파일 strict stub typecheck

현재 환경에는 project dependency가 설치되어 있지 않아 임시 React/Next/WebContainer declaration을 사용해 디자이너 변경의 dependency chain을 별도로 검사했습니다.

```bash
tsc -p /tmp/polazu-designer-typecheck/tsconfig.json --pretty false
```

결과:

```text
PASS: targeted strict typecheck with temporary dependency stubs
```

이 검사는 실제 `npm run typecheck`의 대체 결과가 아닙니다. 공식 React/Next/WebContainer type과 Next plugin을 사용한 검사는 미검증으로 남깁니다.

실행 원본 로그:

- `docs/test-logs/designer-editor.log`
- `docs/test-logs/designer-targeted-typecheck.log`

## 2. 기존 백엔드·보안 검사 상태

이번 작업은 프론트엔드 designer runtime, bridge, source patcher, docs만 변경했고 백엔드 Java·SQL은 변경하지 않았습니다. 기준 ZIP에 포함된 이전 검사 결과는 다음과 같습니다.

- Java 21 main source의 임시 Spring/Jakarta/Jackson stub compile
- PBKDF2 password hash/verify
- GitHub URL SSRF guard
- workspace path traversal 및 dependency path 차단
- ZIP text/asset 분리, `.env`/`node_modules` 제외, traversal 방어

이 결과는 `docs/test-logs/java-core-smoke.log`와 기존 테스트 소스에 남아 있습니다. 실제 Spring dependency와 MySQL을 사용한 전체 회귀는 아래 미검증 항목에 포함합니다.

## 3. 실행하지 못한 검사와 관찰된 환경 제한

### 3.1 공식 npm dependency 기반 검사

시도된 기준 환경에는 `node_modules`가 없고 외부 registry가 차단되어 있습니다. 기준 ZIP의 기존 기록:

```text
npm ci --offline --ignore-scripts
ENOTCACHED ... 필요한 tarball의 cached response가 없음
```

따라서 다음은 미검증입니다.

- `npm ci`
- 공식 package type을 사용한 `npm run typecheck`
- `npm run build`
- Next.js dev server에서 실제 designer 화면 렌더링
- WebContainer에서 실제 React/Next project 실행

### 3.2 Gradle/Spring/MySQL

기준 ZIP의 기존 기록:

```text
./gradlew test --no-daemon
java.net.UnknownHostException: services.gradle.org
```

따라서 다음은 미검증입니다.

- 실제 Spring Boot dependency 기반 `./gradlew test`
- MySQL 8.4 Flyway migration
- 서버 workspace 저장, 권한, SSE의 이번 패키지 전체 회귀

백엔드 소스·SQL은 이번 designer 변경에서 수정하지 않았습니다.

### 3.3 실제 브라우저 E2E

Playwright package/browser가 이 환경에 없어 다음을 실행하지 못했습니다.

- Chrome/Edge/Firefox/Safari
- drag/resize와 pointer 좌표
- 다중 선택과 align/distribute
- IME 한글 inline text editing
- three-viewport compare
- source patch → server save → runtime restart
- viewer read-only
- 두 계정의 SSE/revision conflict

### 3.4 실제 GitHub

승인된 테스트 저장소와 토큰이 없어 다음은 실행하지 않았습니다.

- private repository import
- branch commit/push
- draft PR
- PR 부분 성공과 idempotency
- remote apply와 web unpublished change 보호

## 4. 사용자가 실행할 우선 시나리오

### P0: 공식 build

```bash
npm ci
npm run check:syntax
npm run typecheck
npm run test:adapters
npm run test:designer
npm run build
```

### P0: backend/test DB

```bash
docker compose up -d mysql
cd backend
./gradlew test
./gradlew bootRun
```

다른 터미널에서 테스트 DB에만:

```bash
npm run smoke:api
```

### P0: designer browser E2E

1. 소스가 연결된 Next.js 프로젝트를 연다.
2. 텍스트·색상·padding을 변경하고 다른 요소를 즉시 선택한다.
3. 변경이 사라지지 않고 history에 기록되는지 확인한다.
4. drag 이동, corner resize, Shift 다중 선택, 다중 선택 동시 이동, align/distribute를 수행한다.
5. Base와 Mobile 스타일을 각각 기록한다.
6. JSX와 global CSS diff가 예상 범위인지 확인한다.
7. CSS token 값을 변경해 한 선언만 바뀌는지 확인한다.
8. Image의 src/alt/fit/focus를 수정한다.
9. 24개 primitive를 source-linked container에 삽입하고, 저장 전에 색상·문구·모바일 스타일을 수정한 뒤 build한다.
10. copy/paste와 삽입 직후 duplicate/delete가 source diff에 남는지 확인한다.
11. src·href·alt·ARIA를 바꾼 뒤 Undo했을 때 preview 원본 속성이 복원되는지 확인한다.
12. 동적 `className`, 복합 children, reorder에서 경고가 표시되고 코드가 손상되지 않는지 확인한다.
13. Audit를 실행하고 alt/name/label/id/overflow/contrast/broken asset 결과를 확인한다.
14. OWNER/EDITOR 저장과 VIEWER 차단을 확인한다.

## 5. 완료 판단

정적 source patcher, responsive 규칙, token editor, primitive JSX, bridge syntax, CSS parser, 대상 strict stub typecheck는 통과했습니다. 실제 dependency build, WebContainer/browser pointer E2E, 서버 DB, 외부 Git 쓰기는 실행 환경 때문에 미검증입니다. 이 항목을 완료로 표시하지 않습니다.

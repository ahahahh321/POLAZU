# POLAZU collaborative web workspace

이 소스는 기존 POLAZU 브라우저 편집기에 다음 수직 흐름을 연결한 개발용 구현입니다.

`로그인 → 프로젝트 생성/가져오기 → 서버 작업 공간 → 파일 단위 공동 편집 → 내부 버전/검토 → 새 Git 브랜치 commit·push → 선택적 draft PR`

웹 내부 공동 작업의 기준은 MySQL에 저장되는 서버 작업 공간이며, 외부 IDE와는 Git 브랜치·커밋·PR로 교환합니다. 개발자 PC 폴더를 자동 감시하거나 로컬 파일에 웹 변경을 직접 쓰지 않습니다.

## 구현된 핵심

- 이메일/비밀번호 회원가입, 로그인, HttpOnly 세션 쿠키
- 프로젝트 목록·검색·이름 변경·보관·삭제·복구
- GitHub 공개/비공개 저장소 및 ZIP 가져오기, 빈 HTML 프로젝트 생성
- OWNER / EDITOR / VIEWER 역할을 API와 SSE 구독에서 검사
- 서버 작업 공간 파일 저장, `baseRevision` 충돌 검사, `clientMutationId` 중복 방지
- revision 이력, 수동 내부 버전, 새 revision으로 복원, ZIP 내보내기
- SSE 기반 접속자·작업 위치·revision 이벤트와 역할 변경/접근 회수 이벤트
- 댓글, 해결/다시 열기, 팀원 추가·역할 변경·제거
- GitHub 원격 최신 커밋 확인, 원격 작업본 적용, 새 브랜치 commit·push, draft PR
- 소스 연결된 HTML·React·Next 요소의 시각 편집: 다중 선택·동시 이동, resize, 정렬·분배, source-safe copy/paste, 레이어, Flex/Grid, 반응형, CSS 디자인 토큰, UI primitive 삽입
- 정적 JSX/TSX/HTML의 text·style·attribute·insert·duplicate·delete 최소 소스 반영, 삽입 직후 root 편집 병합, React/Next 파일 직접 코드 편집
- 명령 검색, 단축키, 눈금자·가이드·격자·스냅, 3개 viewport 비교, API mock, 접근성·overflow·대비 보조 audit
- 브라우저 오프라인/실패 변경 복구 큐. 자동 병합은 하지 않고 revision 불일치를 표시
- ZIP 경로 이탈, 해제 크기, 파일 크기/개수, 심볼릭 링크, 암호화 항목, 대소문자 충돌, 비밀 파일 방어

상용 디자인 도구 전체 수준, 문자 단위 CRDT, React/Next 임의 DOM→AST 자동 변환, 다중 서버용 실시간 브로커, 격리된 실제 SSR 실행은 구현 완료로 표시하지 않습니다. 자세한 상태는 [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md)를 확인하세요.

## 빠른 실행

### 1. 요구 환경

- Node.js 22 권장
- Java 21
- Docker Desktop 또는 MySQL 8.4
- GitHub 쓰기 기능 검증 시, 테스트 저장소에 필요한 최소 권한을 가진 토큰

### 2. 환경 변수

프로젝트 루트에서 다음을 실행합니다.

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

`.env`의 DB 비밀번호를 변경합니다. 운영에서는 반드시 HTTPS를 사용하고 `POLAZU_SECURE_COOKIE=true`로 설정하세요. GitHub 토큰은 `.env`나 DB에 저장하지 않고 UI의 해당 요청에만 입력합니다.

### 3. MySQL

```bash
docker compose up -d mysql
docker compose ps
```

Flyway가 백엔드 시작 시 `V1`, `V2`를 순서대로 적용합니다. 기존 DB에는 먼저 백업 후 테스트 DB에서 마이그레이션을 검증하세요.

### 4. 백엔드

```bash
cd backend
./gradlew bootRun
```

Windows:

```powershell
cd backend
.\gradlew.bat bootRun
```

기본 주소: `http://127.0.0.1:8080`

### 5. 프론트엔드

다른 터미널에서:

```bash
npm ci
npm run typecheck
npm run test:adapters
npm run test:designer
npm run build
npm run dev
```

기본 주소: `http://127.0.0.1:3000`

루트 `/`는 세션을 확인해 미로그인 사용자는 `/login`, 로그인 사용자는 `/projects`로 이동합니다.

## 권장 검증 순서

```bash
# 프론트 정적 검사
npm run check:syntax
npm run typecheck
npm run test:adapters
npm run test:designer
npm run build

# 백엔드 단위/통합 검사
cd backend
./gradlew test

# 실제 API 서버가 실행 중인 테스트 DB에서만
cd ..
npm run smoke:api
```

`smoke:api`는 임시 계정과 프로젝트를 생성하고 프로젝트는 마지막에 soft delete합니다. 운영 DB에서는 실행하지 마세요.

## Git 게시 사용법

1. 프로젝트의 **공동 작업 · Git** 패널을 엽니다.
2. ZIP 프로젝트라면 기존 GitHub 저장소 URL, 기준 브랜치, 가능하면 기준 commit SHA를 연결합니다.
3. GitHub 토큰을 입력하고 **원격 최신 커밋 확인**을 실행합니다.
4. 원격이 선행하면 웹 미게시 변경을 내부 버전으로 보존한 뒤 선택한 원격 버전을 새 revision으로 적용합니다.
5. 게시할 server revision을 검토하고 새 원격 브랜치 이름과 커밋 메시지를 입력합니다.
6. commit·push 후 선택적으로 draft PR을 생성합니다.

`main`, `master`, 기준 브랜치 직접 게시, 강제 push, 자동 merge는 기본 경로에서 금지됩니다. 토큰은 요청 처리 중 메모리에서만 사용하며 DB·프로젝트 ZIP·로그에 저장하지 않습니다.

## 디렉터리

- `app/`, `components/`, `lib/`: Next.js 프론트엔드
- `app/editor`: 프로젝트 실행/시각·코드 편집 UI
- `backend/src/main/java/.../auth`: 세션 인증
- `backend/src/main/java/.../project`: 프로젝트, 작업 공간, 공동 작업, 버전
- `backend/src/main/java/.../git`: GitHub 게시/가져오기 흐름
- `backend/src/main/resources/db/migration`: Flyway SQL
- `docs`: 기능 명세, API, 보안/제한, 테스트 및 인수인계
- `scripts`: 프론트 어댑터 검사, 소스 문법 검사, 실제 API smoke

## 문서

- [디자이너 에디터 가이드](docs/DESIGNER_EDITOR.md)
- [기능 명세](docs/FEATURE_SPEC.md)
- [구현 상태](docs/IMPLEMENTATION_STATUS.md)
- [API](docs/API.md)
- [Git 흐름](docs/GIT_WORKFLOW.md)
- [보안·용량·호환성](docs/SECURITY_AND_LIMITS.md)
- [DB 마이그레이션](docs/MIGRATION.md)
- [실행·운영·복구](docs/OPERATIONS.md)
- [테스트 보고서](docs/TEST_REPORT.md)
- [작업 인수인계](HANDOFF.md)
- [변경 파일 목록](CHANGE_MANIFEST.md)

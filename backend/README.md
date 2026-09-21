# POLAZU backend

Spring Boot 기반의 POLAZU 인증·프로젝트·공동 작업·버전·GitHub 연동 API입니다. MySQL과 Flyway를 사용하며, 사용자 프로젝트 코드는 백엔드 프로세스에서 직접 실행하지 않습니다.

## 실행

프로젝트 루트에서 `.env.example`을 `.env`로 복사하고 비밀번호를 변경한 뒤 MySQL을 시작합니다.

```bash
docker compose up -d mysql
cd backend
./gradlew bootRun
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
docker compose up -d mysql
cd backend
.\gradlew.bat bootRun
```

기본 API 주소는 `http://127.0.0.1:8080`입니다. Flyway가 `V1__initialize_schema.sql`, `V2__polazu_workspace.sql`을 순서대로 적용합니다.

## 검사

```bash
./gradlew test
```

통합 테스트는 H2의 MySQL 호환 모드를 사용합니다. 실제 적용 전에는 별도 MySQL 테스트 DB에서도 Flyway 마이그레이션과 API smoke를 실행하세요.

## 주요 경계

- 세션 원문과 GitHub 토큰은 DB에 저장하지 않습니다.
- GitHub 토큰은 가져오기·확인·게시 요청 동안만 사용합니다.
- ZIP과 작업 공간 경로에서 비밀 파일, 경로 이탈, 심볼릭 링크, 과도한 크기를 차단합니다.
- SSE 허브는 단일 서버 인메모리 구현입니다. 다중 인스턴스 배포에는 외부 브로커가 필요합니다.
- Git 게시 기본 흐름은 새 브랜치 생성이며 `main`/`master`/기준 브랜치 직접 게시와 강제 push를 제공하지 않습니다.

전체 API와 운영 제한은 루트의 `docs/API.md`, `docs/SECURITY_AND_LIMITS.md`, `docs/OPERATIONS.md`를 확인하세요.

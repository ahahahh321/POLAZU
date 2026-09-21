# 실행·운영·복구

## 로컬 구성

- Frontend: Next.js `127.0.0.1:3000`
- Backend: Spring `127.0.0.1:8080`
- Database: Docker MySQL host port `3307`
- CORS: 두 localhost origin만 기본 허용

`localhost`와 `127.0.0.1`을 섞으면 쿠키 host가 달라질 수 있으므로 프론트/API URL 조합을 통일하는 것이 안전합니다.

## 운영 환경 변수

| 변수 | 설명 |
|---|---|
| `MYSQL_*` | DB 연결/compose 초기화 |
| `SERVER_ADDRESS`, `SERVER_PORT` | Spring bind |
| `POLAZU_SECURE_COOKIE` | HTTPS 운영은 `true` |
| `POLAZU_ALLOWED_ORIGINS` | 쉼표 구분 정확한 frontend origin |
| `NEXT_PUBLIC_API_BASE_URL` | 브라우저가 호출할 API URL |

`.env`는 Git/ZIP에 포함하지 않습니다. 운영 비밀값은 secret manager를 사용하세요.

## 백업

최소 백업 대상:

1. MySQL 전체 schema와 `flyway_schema_history`
2. 배포된 frontend/backend source commit
3. reverse proxy/환경 변수 설정의 비밀 제외 사본

workspace 파일과 revision/버전은 DB에 있으므로 DB 백업이 핵심입니다. 사용자가 내보낸 ZIP은 특정 시점 현재 작업본이며 revision history 백업을 대체하지 않습니다.

## 장애와 복구

### 프론트 저장 실패

- 사용자 브라우저에 `polazu-pending:<projectId>` 큐가 최대 50건 저장됩니다.
- 재접속 후 각 entry의 base revision과 서버 revision이 같을 때만 순차 전송합니다.
- 다르면 자동 merge하지 않고 최신 workspace를 열어 수동 재적용합니다.

### SSE 끊김

- 편집 저장 API는 SSE와 독립적입니다.
- UI connection 표시가 끊겨도 HTTP 저장 결과가 기준입니다.
- 새로고침 후 snapshot과 revision 이력을 다시 조회합니다.

### Git 부분 성공

- `COMMIT_PUSHED_PR_FAILED`: GitHub branch와 commit은 생성됐고 PR만 실패했습니다.
- operation 화면의 commit/branch를 확인한 뒤 GitHub에서 수동 PR을 생성합니다.
- 같은 idempotency key를 재전송하면 새 commit을 만들지 않고 기존 operation을 반환합니다.

### 원격 선행

- 게시를 중단합니다.
- remote check → 웹 미게시 변경 내부 버전 보존 → exact commit apply → 다시 변경 검토 순서를 사용합니다.

### DB 마이그레이션 실패

- `flyway_schema_history`와 backend log를 보존합니다.
- 실패 원인이 권한, MySQL 버전, 부분 DDL인지 구분합니다.
- 운영 DB에서 같은 migration을 무한 재시도하지 말고 복제 DB에서 수정 검증합니다.

## 로그와 비밀

- request body 전체와 Authorization/GitHub token을 access/application log에 출력하지 마세요.
- 현재 코드는 token 값을 DB에 쓰지 않지만 reverse proxy body logging도 별도 확인해야 합니다.
- 오류 코드와 operation ID를 중심으로 관찰성을 구성하세요.

## 확장 전 필수 작업

- SSE/presence를 Redis Streams, Pub/Sub 등으로 외부화
- session cleanup과 history retention batch
- project별 storage/history quota
- audit log와 보안 이벤트 알림
- GitHub App/OAuth 설치 및 토큰 암호화 저장 또는 단기 token 교환
- 사용자 project preview의 별도 origin/격리 정책

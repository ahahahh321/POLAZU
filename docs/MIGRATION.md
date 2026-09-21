# DB 마이그레이션

## 파일

- `V1__initialize_schema.sql`: 기존 schema marker
- `V2__polazu_workspace.sql`: 사용자, 세션, 프로젝트, 멤버, workspace, revision, 버전, 댓글, Git 작업

Flyway는 백엔드 시작 시 자동 실행됩니다. 애플리케이션 계정에는 해당 schema의 DDL/DML 권한이 필요합니다.

## V2 주요 테이블

| 테이블 | 목적 |
|---|---|
| `app_user` | 계정/프로필 |
| `auth_session` | 해시된 세션 토큰과 만료 |
| `project` | 저장소 기준, workspace branch, revision, 상태 |
| `project_member` | POLAZU 역할 |
| `workspace_file` | 현재 서버 작업 공간 |
| `workspace_revision` | revision 메타데이터와 idempotency |
| `workspace_revision_change` | 파일 전후 내용 |
| `internal_version*` | 명시적으로 저장한 전체 체크포인트 |
| `project_comment` | 검토 댓글 |
| `git_operation` | 게시 시도·부분 성공·실패 상태 |

## 안전 적용

1. 현재 DB 전체 logical backup을 만듭니다.
2. 운영 DB 복제 또는 별도 테스트 DB에서 같은 MySQL 8.4 이미지를 실행합니다.
3. 기존 Flyway history와 V1 checksum을 확인합니다.
4. 수정본 backend를 테스트 DB에 연결해 `./gradlew bootRun` 또는 `flywayMigrate`를 실행합니다.
5. `flyway_schema_history`에 V2 success가 기록됐는지 확인합니다.
6. 회원가입→프로젝트 생성→파일 저장→복원 API smoke를 실행합니다.
7. 운영 배포 시 앱 쓰기를 잠시 중단하고 DB 백업 시점과 코드 배포 시점을 맞춥니다.

## 롤백

V2는 기존 V1 테이블을 수정하지 않고 새 테이블을 추가합니다. 그러나 Flyway는 자동 down migration을 제공하지 않습니다. 롤백은 다음 중 하나로 수행하세요.

- 권장: 배포 전 DB snapshot 복원
- 테스트 환경: V2가 만든 테이블을 foreign-key 역순으로 제거하고 `flyway_schema_history` V2 행을 정리

운영에서 수동 DROP을 실행하기 전에 `workspace_file`, revision, internal version을 반드시 백업하세요.

## MySQL/H2 차이

테스트 설정은 H2 MySQL mode를 사용하지만 운영 기준은 MySQL 8.4입니다. `MEDIUMTEXT`, `LONGBLOB`, `CURRENT_TIMESTAMP(6)`, FK cascade 및 `SELECT ... FOR UPDATE` 동작은 실제 MySQL에서 최종 검증해야 합니다.

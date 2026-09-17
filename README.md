# tmp (interface-lab)

Next.js 프론트엔드와 Spring Boot REST API 서버를 한 저장소에서 관리하는 프로젝트입니다.
현재 백엔드는 기반 구조만 있으며 실제 서비스 API는 아직 구현하지 않았습니다.

## 기술 구성

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS
- Backend: Java 21, Spring Boot 4, Gradle, Spring Data JPA
- Database: MySQL 8.4 (Docker), Flyway
- 기본 포트: Frontend `3000`, Backend `8080`, MySQL `3307`

## 처음 적용하는 순서

필수 프로그램은 Git, Node.js 20 이상, Java 21, Docker Desktop입니다.

```powershell
git clone <저장소 주소>
cd interface-lab
Copy-Item .env.example .env
```

`.env`의 비밀번호는 각자 로컬 개발용 값으로 변경합니다. `MYSQL_PORT`가 이미 사용
중이면 3308처럼 다른 포트로 바꿔도 됩니다.

```powershell
# 1. MySQL 실행
docker compose up -d mysql

# 2. 프론트엔드 패키지 설치
npm ci

# 3. 백엔드 의존성 및 테스트 확인
cd backend
.\gradlew.bat test
cd ..
```

개발할 때는 터미널을 두 개 열어 각각 실행합니다.

```powershell
# 터미널 1: 프론트엔드
npm run dev

# 터미널 2: 백엔드
.\start-backend.cmd
```

- Frontend: http://127.0.0.1:3000
- Backend: http://localhost:8080
- DB 상태 확인: `docker compose ps`
- DB 중지: `docker compose down`

## 프로젝트 구조

```text
app/                         Next.js 페이지와 페이지 전용 코드
  (home)/
    page.tsx                 홈 화면의 배치와 컴포넌트 조합
    data.ts                  홈 전용 임시 데이터와 타입
    _components/             홈에서만 사용하는 UI
    _hooks/                  홈에서만 사용하는 상태와 로직
components/                  여러 페이지에서 재사용하는 공통 UI
public/                      이미지와 폰트
backend/
  src/main/java/com/interfacelab/backend/
    controller/              REST 요청과 응답
    service/                 업무 로직
    repository/              DB 접근
    domain/                  JPA Entity
    dto/                     API 요청·응답 객체
  src/main/resources/
    application.yml          서버와 DB 연결 설정
    db/migration/            Flyway DB 변경 이력
compose.yaml                 로컬 MySQL 실행 설정
.env.example                 팀 공유용 환경변수 예시
AI_DEVELOPMENT_PROMPT.md      AI와 개발할 때 사용할 공통 프롬프트
```

## 개발 방향

- 페이지 전용 UI·훅·데이터는 해당 `app/페이지` 폴더에 함께 둡니다.
- 여러 페이지가 실제로 공유할 때만 루트 `components/`, `features/`, `modules/`로 이동합니다.
- `page.tsx`는 화면 배치와 조합을 담당하고 복잡한 상태·업무 로직은 분리합니다.
- 새 API는 `Controller → Service → Repository` 흐름으로 작성합니다.
- Entity를 API에 직접 반환하지 않고 Request/Response DTO를 사용합니다.
- DB 테이블은 직접 수동 변경하지 않고 새 Flyway SQL 파일로 변경합니다.
- 비밀번호가 들어간 `.env`는 Git에 올리지 않고 `.env.example`만 공유합니다.
- 기능을 완료하면 프론트 타입 검사·빌드와 백엔드 테스트를 모두 실행합니다.

```powershell
npm run typecheck
npm run build
cd backend
.\gradlew.bat test
```

## 기능별 협업: API 계약과 공통 파일

기능 담당자는 화면·API·DB를 함께 맡되 기존 폴더 구조를 유지합니다. 기능별 브랜치
(`feat/auth`, `feat/comments`)에서 작업하고 작은 PR로 합칩니다. 작업 시작 전과
PR 제출 전에 최신 main을 반영합니다. 공통 변경은 영향받는 담당자와 먼저 합의합니다.

### API 계약 작성 양식

새 API나 계약 변경은 구현 전에 아래 내용을 PR/이슈에 작성하고 호출부 담당자와
합의합니다. 이 양식은 개발 규칙이며 현재 구현된 API 명세가 아닙니다.

```text
기능 / 담당자 / 검토자 / 상태(초안·합의 완료):
HTTP 메서드 / URL:
인증 방식 / 필요한 역할 / 객체 소유권·팀 접근 조건:
경로·쿼리·요청 JSON: 필드명, 타입, 필수 여부, null 허용, 길이·범위 제한
성공 상태 코드 / 응답 JSON 예시 / 반환 가능한 필드:
실패 상태 코드 / 공통 오류 코드·메시지·필드 오류 예시:
목록: 페이지 크기 상한 / 정렬 허용 필드 / 필터 규칙
보안: 호출량·요청 크기 제한 / 민감정보 / CSRF 적용 여부와 근거
변경 API: 중복 요청·동시 수정 처리 / 업무 상태 전이 조건
연결 화면 / 다른 기능 영향 / 보안 테스트 시나리오:
```

- 날짜·ID 타입·공통 오류 형식은 최초 API 작업에서 팀이 확정하며 AI가 임의 확정하지 않습니다.
- 프론트 호출부·임시 응답·백엔드 DTO는 합의한 계약을 따릅니다.
- 계약 변경은 영향을 받는 담당자와 합의한 뒤 호출부·DTO·문서·테스트를 함께 갱신합니다.

### API 보안 필수 기준

문서만으로 완벽한 보안을 보장할 수 없습니다. 아래는 구현·리뷰·검증의 필수 기준이며,
현재 서버에 적용되었다는 뜻이 아닙니다. 해당하지 않는 항목도 이유를 PR에 남깁니다.

- 서버에서 기본 거부를 적용하고 공개 API만 명시적으로 허용합니다. 모든 요청에서
  역할·기능 권한뿐 아니라 대상 데이터의 소유권·팀 권한과 허용 필드를 검사합니다.
  클라이언트가 보낸 userId, ownerId, role을 인증 근거로 신뢰하지 않습니다.
- 인증 방식은 팀 공통으로 확정합니다. 쿠키 인증은 Secure(운영)·HttpOnly·적절한
  SameSite와 CSRF 방어를 적용합니다. JWT 사용 시 서명·허용 알고리즘·발급자·대상·만료를
  검증하고 갱신·폐기 정책을 정합니다. 편의를 위한 인증/CSRF 전역 해제는 금지합니다.
- 운영 API는 HTTPS를 사용합니다. CORS는 필요한 origin·메서드·헤더만 허용하며
  CORS를 인증으로 취급하지 않습니다. 인증정보 포함 요청에 origin 와일드카드를 쓰지 않습니다.
- 요청 DTO의 허용 필드, 타입, 길이, 범위와 Content-Type을 서버에서 검증합니다.
  Entity에 요청을 직접 바인딩하지 않고 role·ownerId 등의 임의 변경을 차단합니다.
  쿼리는 파라미터 바인딩을 사용하며 정렬 필드도 허용 목록으로 제한합니다.
- 비밀번호는 검증된 적응형 해시로 저장합니다. 비밀번호·토큰·API 키·쿠키는 URL,
  응답·로그·Git에 남기지 않습니다. 응답 DTO는 필요한 필드만 반환하고 민감 응답은
  캐시 정책을 명시합니다. 운영 오류에는 SQL·스택·내부 경로를 노출하지 않습니다.
- 로그인·검색·업로드 등에 요청 빈도·본문 크기·페이지 크기·타임아웃 상한을 정합니다.
  로그인 오류는 계정 존재 여부를 불필요하게 드러내지 않습니다.
- 데이터 변경은 트랜잭션과 제약조건을 검토하고 중복 요청·동시 수정·업무 순서 우회를
  방어합니다. 상태를 변경하는 작업을 GET으로 제공하지 않습니다.
- 파일·외부 URL·커뮤니티 코드 처리 기능은 별도 검토합니다. 파일 크기·형식·경로를
  검증하고 외부 URL은 내부망·메타데이터 접근과 리다이렉트/DNS 우회를 막습니다.
  사용자 코드는 서비스 서버 권한으로 실행하지 않고 비밀정보 없는 격리 환경을 사용합니다.
- 최소 보안 테스트: 비로그인, 만료/변조 인증, 다른 사용자의 ID, 다른 팀 데이터,
  일반 사용자의 관리자 요청, 소유자/역할 필드 변조, 잘못된 입력·과대 요청을 확인합니다.
  쿠키 인증은 CSRF 차단도 검증합니다. 정상 동작 테스트만으로 완료 처리하지 않습니다.

기준: [OWASP REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html),
[OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0x00-header/).

### 공통 파일 수정 규칙

| 공통 영역 | 예시 |
| --- | --- |
| 화면·스타일 | app/layout.tsx, app/globals.css, 루트 components의 공통 UI |
| 기능·연동 | 공유 훅, API 클라이언트, 인증 상태, 공통 타입 |
| 프론트 설정 | package.json, package-lock.json, next.config.ts, tsconfig.json, PostCSS 설정 |
| 서버 공통 | 인증·인가, CORS, 전역 예외 처리, 공통 응답 DTO |
| 환경·빌드 | Gradle 설정, application.yml, compose.yaml, .env.example, 실행 스크립트 |
| DB | 다른 기능이 사용하는 테이블·컬럼, Flyway 버전 번호 |

- 공통 영역 담당자를 정하고 변경 전에 파일·이유·영향 범위·호환성·검증 계획을
  PR/이슈에 남겨 담당자와 합의합니다. 승인 범위를 넘는 변경은 다시 협의합니다.
- 기능 전용 변경은 해당 기능 파일에서 처리합니다. 다른 담당자의 수정은 보존합니다.
- 공통 UI/타입 변경 시 모든 사용처를 확인하고, 의존성 변경 시 잠금 파일도 갱신합니다.
- 인증·권한·공유 DB 변경은 다른 팀원 최소 1명의 리뷰 후 병합합니다.
- Flyway 버전은 팀에서 중복 없이 배정하고 병합 전에 재확인합니다. 적용된 SQL은
  수정하지 않습니다. 운영 DB 적용은 별도 배포 절차로 처리합니다.
- PR에 API 계약 링크, 공통 변경 합의, DB 변경, 실행한 검사와 미검증 항목을 기록합니다.
  프론트 타입 검사·빌드와 백엔드 테스트 및 관련 보안 검증을 통과한 뒤 병합합니다.
  문서 변경만인 경우 코드 검사는 생략하고 문서 링크·규칙 일치 여부를 확인합니다.

## DB 변경 파일 이름

Flyway 파일은 기존 파일을 수정하지 않고 번호를 증가시켜 추가합니다.

```text
V1__initialize_schema.sql
V2__create_component_table.sql
V3__add_component_category.sql
```

## 배포 참고

현재 프론트엔드는 AWS Amplify 서울 리전에 배포되어 있습니다. 로컬 변경사항은 별도로
빌드하고 배포해야 반영됩니다.

- Site: https://production.d23sony9tqfjsh.amplifyapp.com/
- Region: `ap-northeast-2`

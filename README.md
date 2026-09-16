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

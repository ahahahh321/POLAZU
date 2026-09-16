# Backend

Spring Boot REST API 기반 프로젝트입니다. 실제 기능 API는 아직 없습니다.

루트 폴더의 `.env`와 Docker MySQL을 사용합니다.

```powershell
cd ..
docker compose up -d mysql
.\start-backend.cmd
```

DB 구조 변경은 `src/main/resources/db/migration`에 새 Flyway SQL 파일로 추가합니다.

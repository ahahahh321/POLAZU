# POLAZU Editor V3 전달 메모

## 권장 확인 순서

1. 새 폴더에 전체 ZIP을 푼다.
2. `.env.example`을 기준으로 로컬 환경 변수를 준비한다.
3. 의존성을 현재 OS에서 새로 설치한다.
4. 타입·정적 테스트를 먼저 실행한다.
5. 백엔드와 테스트 DB를 실행한다.
6. 실제 프로젝트에서 drag insert와 autosave를 수동 검증한다.

```bash
npm ci
npm run typecheck
npm run check:syntax
npm run test:adapters
npm run test:designer
npm run dev
```

백엔드:

```bash
cd backend
./gradlew test
./gradlew bootRun
```

## 이번 변경이 영향을 주는 영역

- `/editor?projectId=...`의 로그인된 실제 프로젝트 편집 화면
- 디자이너 toolbar, sidebar, inspector, canvas shell
- workspace Review/Team/Git drawer 진입
- designer source bridge의 UI primitive 삽입
- editor CSS

백엔드 Java, Flyway migration, 프로젝트 import API, 인증 API는 수정하지 않았다.

## 적용 시 주의

- 기존 작업 폴더에 무조건 덮어쓰지 않는다.
- 별도 Git branch에서 전체 ZIP을 비교하거나 safe patch를 `git apply --check`로 먼저 검증한다.
- 로컬에서 같은 파일을 수정했다면 자동 patch보다 수동 merge를 우선한다.
- 실제 Git push/PR은 승인된 테스트 저장소에서 검증한다.
- drag insert가 source patch로 저장되는지 확인하기 전 운영 프로젝트에서 대량 변경하지 않는다.

## 롤백

전체 ZIP을 새 폴더에서 사용했다면 기존 폴더로 돌아가면 된다.

패치를 적용했다면:

```bash
git restore --source=<적용 전 커밋> -- .
```

또는 작업 branch를 삭제하고 원래 branch로 돌아간다. DB migration은 이번 변경에 없으므로 DB 롤백은 필요하지 않다.

# 안전한 로컬 이식·실행·검증 가이드

## 0. 먼저 확인

이 전달본을 현재 서비스에 통째로 덮어쓰지 마세요. 원본 업로드 이후 PC에서 바꾼 파일은 자동 패치가 충돌로 중단하도록 만들었습니다. 충돌은 고장이라기보다 기존 작업을 보호하는 결과입니다. `--force` 옵션은 없습니다.

통합 ZIP 구성은 `source/`(전체 소스, 제외 항목 있음), `docs/`, `verification/`, `changes.json`입니다. 별도 안전 패치 ZIP은 `manifest.json`, `files/`, `apply-editor-patch.mjs`로 구성됩니다. 둘 중 한 경로로 적용하면 됩니다.

### 필요한 환경

- Node.js **22 이상**. 테스트는 22.16.0/Linux에서 실행했습니다.
- Java **21**, 기존 Gradle wrapper. Spring 테스트·부팅에 Maven Central/Gradle 다운로드가 필요합니다.
- 기존 MySQL 또는 개발용 Docker MySQL. 원본 `compose.yaml`은 MySQL 8.4, 호스트 127.0.0.1:3307 구조입니다.
- npm 설치 네트워크. 의존성 버전은 원본 lockfile을 유지하고 JSZip을 추가했습니다. 다른 OS의 node_modules를 복사하지 않습니다.
- 브라우저 UI 기능은 modern desktop 브라우저를 대상으로 합니다. Node 실행은 추가 브라우저 기능/보안 헤더가 필요합니다. `SUPPORT_MATRIX.md`를 읽으세요.

## 1. 코드와 DB를 먼저 백업

현재 작업을 커밋하거나 프로젝트 폴더를 별도 복사합니다. 비밀값이 있는 `.env`를 Git에 추가하지 마세요.

```bash
git status
git switch -c review/polazu-editor-rebuild
```

미커밋 파일이 있다면 기존 작업을 먼저 검토·백업합니다. 패치 비교 기준은 **이번에 업로드한 원본 ZIP**입니다. 이전의 존재하지 않았던 배포 파일을 기준으로 하지 않습니다.

DB는 사용 중인 관리 도구에서 **구조+데이터+flyway_schema_history**를 테스트용 사본으로 백업/복원합니다. CLI 사용자는 실제 계정·DB명에 맞춰 예를 들어 아래처럼 수행합니다. 비밀번호를 명령 인수로 직접 적지 않습니다.

```bash
mysqldump --host=127.0.0.1 --port=3307 --user=YOUR_DB_USER --password --single-transaction --routines --triggers --result-file=before-editor.sql YOUR_DB_NAME
```

운영 DB에 이 절차를 바로 적용하지 마세요. Docker 볼륨 이름을 임의로 바꾸거나 `docker compose down -v`를 실행하지 않습니다. `.env`의 DB 이름/비밀번호도 기존 값을 유지합니다.

## 2-A. 권장: 안전 패치

패치 ZIP을 프로젝트 **바깥 폴더**에 풉니다. 터미널에서 해당 패치 폴더로 이동합니다.

```bash
# 읽기 검사만 수행합니다. 파일 변경 없음.
node apply-editor-patch.mjs --target "C:/work/interface-lab"

# 검토한 후에만 적용합니다.
node apply-editor-patch.mjs --target "C:/work/interface-lab" --apply
```

macOS/Linux 예:

```bash
node apply-editor-patch.mjs --target "$HOME/work/interface-lab"
node apply-editor-patch.mjs --target "$HOME/work/interface-lab" --apply
```

검사는 payload SHA-256와 원본 파일 SHA-256, 경로·심볼릭 링크·중복을 확인합니다. 하나라도 원본과 다르면 쓰기 전에 중단합니다. 이미 동일하게 적용된 파일은 건너뜁니다. 적용 시 `.polazu-backups/patch-...`에 이전 파일과 manifest를 보관합니다.

**도구가 하지 않는 것:** npm 설치, Java 실행, SQL 실행, Git commit/push, 운영 배포, 데이터 삭제. 여러 파일을 OS 수준의 하나의 원자적 트랜잭션으로 쓰는 것은 아닙니다. 실패/외부 변경 시 보고된 백업으로 수동 복구가 필요할 수 있습니다.

## 2-B. 별도 테스트 폴더에서 전체 소스 실행

통합 ZIP의 `source/`를 새 폴더에 복사합니다. **기존 .env는 필요한 값만 로컬에서 안전하게 복사**합니다. `.git` 및 실제 비밀값은 통합 ZIP에 없습니다. 폰트 바이너리도 포함하지 않았습니다. 기존 `public/fonts`는 원래 로컬 프로젝트에서 유지하거나 시스템 폰트 fallback을 사용합니다.

이 방법은 기존 Git 이력과 미커밋 변경을 자동 병합하지 않습니다. 실제 프로젝트로 가져갈 때 `changes.json`을 기준으로 새 브랜치에 수동 적용합니다.

기존 `/editor/ui` 경로는 보존했지만 새 `/editor/`의 IndexedDB 형식으로 과거 저장 데이터를 자동 이관하지는 않습니다. 기존 작업을 원래 화면에서 먼저 백업·내보낸 뒤 새 편집기로 가져와 확인하세요.

## 3. 의존성 설치와 정적 검사

프로젝트 루트에서:

```bash
node --version
npm ci
npm run editor:vendor
npm run typecheck
npm run test:editor
npm run build
```

`npm run build` 앞의 `prebuild`도 preview vendor를 생성합니다. 별도 명령은 로컬 개발/검증용입니다. 결과물에는 React 관련 라이선스를 같이 넣었습니다.

**이번 환경의 제한:** 전체 TS 검사는 통과했지만 `next build`는 Linux SWC 다운로드 DNS 오류로 중단되었습니다. 이 때문에 사용자 PC에서 `npm ci` 후 정식 빌드 통과를 반드시 확인해야 합니다. 실패하면 메시지를 무시하고 배포하지 않습니다. 네이티브 의존성 오류는 해당 OS에서 npm 재설치로 원인을 먼저 확인하세요.

## 4. 환경 변수

프론트엔드용 `.env.local`은 로컬에서 직접 만들 수 있습니다. 업로드 프로젝트의 환경변수 파일과 구분하세요.

```dotenv
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080
# 상용 WebContainer 계약에서 제공된 browser API key가 있을 때만 설정
# NEXT_PUBLIC_WEBCONTAINER_API_KEY=...
```

`NEXT_PUBLIC_` 변수는 브라우저에서 읽힙니다. DB 비밀번호, GitHub private token, 결제 비밀키를 넣지 않습니다. 로그인 쿠키 혼선을 피하려면 프론트와 API 모두 `127.0.0.1`을 쓰세요. 한쪽은 `localhost`, 다른 쪽은 `127.0.0.1`로 섞지 않습니다.

백엔드는 기존 루트 `.env`를 읽습니다. 개발 CORS 기본 허용은 `http://127.0.0.1:3000,http://localhost:3000`입니다. 포트를 바꾸면 `POLAZU_ALLOWED_ORIGINS`도 정확하게 맞춥니다. 와일드카드 `*`와 credential 조합을 사용하지 않습니다.

## 5. DB/Flyway

추가 파일은 `backend/src/main/resources/db/migration/V4__editor_workspace_versions.sql`입니다. 추가 테이블:

- `editor_workspaces`: 프로젝트별 현재 revision/document/수정자/수정 시각
- `editor_workspace_revisions`: 최근 revision, command ID, SHA-256, 문서, 수정자

기존 `members`, `projects`, `project_members`, 초대 테이블은 삭제하지 않습니다. 서버가 테스트 DB에 부팅될 때 Flyway가 V4를 한 번 적용하도록 합니다. **SQL을 수동 실행하고 Flyway로 또 실행하지 마세요.** 이미 로컬에서 다른 V4를 사용했다면 버전 번호/이력을 충돌 없이 재설계해야 합니다. 적용된 migration 내용을 수정하거나 `flyway repair`로 덮지 않습니다.

테스트 DB에서 먼저:

```bash
cd backend
# Windows PowerShell/cmd
.\gradlew.bat test
.\gradlew.bat bootRun
# macOS/Linux에서는
# sh ./gradlew test
# sh ./gradlew bootRun
```

이번 환경에서는 Gradle 배포본 다운로드가 막혀 **Spring 테스트, H2 통합 테스트, 실제 MySQL migration/transaction 실행을 완료하지 못했습니다.** 추가 통합 테스트 소스는 포함했지만 통과 기록으로 표시하지 않습니다.

## 6. 프론트 실행과 최초 확인

다른 터미널에서 프로젝트 루트:

```bash
npm run dev
```

`http://127.0.0.1:3000/editor/`를 엽니다. 처음에는 ‘에디터 체험’ HTML 샘플로 문구·색상·탭·흐름·내보내기를 확인합니다. React/Next 템플릿도 별도로 테스트하세요. **Node 모드 설치/서버 실행에 원본 프로젝트의 설정 코드가 실행되므로 신뢰하는 코드만 사용합니다.**

## 7. IDE 연결

POLAZU 서비스 소스의 agent 프로그램을 이용하되, `--root`는 **서비스에서 편집하려는 실제 프론트 프로젝트**입니다.

```bash
node tools/editor-agent/agent.mjs --root "C:/work/customer-frontend" --origin "http://127.0.0.1:3000"
```

서비스에서 해당 프로젝트를 ZIP/폴더/GitHub로 가져온 뒤 ‘동기화’에서 loopback 주소와 터미널의 연결 토큰을 입력합니다. 토큰은 공개 링크/스크린샷/채팅에 공유하지 않습니다.

처음에는 **로컬 쓰기 OFF**로 연결해 IDE에서 파일을 저장하고 UI가 갱신되는지 확인합니다. 그다음 Git 커밋/폴더 백업을 만든 후 ‘디자인 변경을 로컬 파일에 쓰기 허용’을 켭니다. 실제 파일 쓰기 전 `.polazu-backups`에 백업합니다. 파일 snapshot은 약 1.2초 간격으로 브라우저에서 확인하며 네트워크/렌더링 시간은 추가됩니다.

로컬 네트워크 접근 권한/CORS/보안 정책 때문에 브라우저가 차단할 수 있습니다. 보안 기능을 전역 해제하지 말고 지원 브라우저와 origin/포트, 허용 안내를 확인하세요. HTTPS 서비스에서 로컬 HTTP 연결은 브라우저/기업 정책별 실기기 검증이 필요합니다. 원격 실행/임의 명령 endpoint나 localhost 터널 서비스는 제공하지 않습니다.

## 8. ZIP/GitHub 프로젝트를 팀과 공유

1. 원래 로그인 화면에서 로그인합니다. Spring/DB가 필요합니다.
2. 에디터에서 ‘팀 공유’ → 현재 프로젝트를 새 팀 프로젝트로 공유합니다. 허용된 소스와 자산이 서버에 저장되는 데 동의한 경우만 진행합니다.
3. 가입된 팀원 이메일로 EDITOR/VIEWER 초대 토큰을 생성합니다. **자동 이메일 발송이 아닙니다.** 대상 팀원에게만 전달합니다.
4. 팀원은 로그인 후 초대를 수락하고 팀 프로젝트 ID를 엽니다.
5. 동일 파일을 양쪽에서 수정하여 충돌이 중단되는지, 서로 다른 파일은 병합되는지 확인합니다.
6. 로컬 IDE에서 나온 변경을 다른 팀원에게 중계하려면 IDE 에이전트+POLAZU 브라우저+팀 연결이 모두 켜져 있어야 합니다.

기존 프로젝트의 API/인증 파일 보호 규칙은 OWNER가 관리합니다. EDITOR는 보호 파일을 공유 서버에 올릴 수 없습니다. 엔지니어가 API 소스를 변경해야 한다면 적절한 프로젝트 소유 권한 또는 기존 Git/IDE 작업 흐름에서 검토 후 반영합니다. VIEWER를 수정 권한으로 둔갑시키거나 보호 규칙을 우회하지 않습니다.

## 9. GitHub 반영

가져오기에는 저장소 읽기 권한, PR 생성에는 해당 저장소 contents/PR 쓰기 권한이 필요합니다. 토큰은 브라우저 메모리에서만 사용하며 workspace/IndexedDB/export에는 저장하지 않습니다.

최신 기준 브랜치의 커밋을 다시 확인하고 `polazu/...` 새 브랜치와 **초안 PR만** 생성합니다. 직접 main을 업데이트하거나 강제 push/자동 병합하지 않습니다. `polazu.workspace.json`에 화면 상태/흐름 문서도 포함합니다. PR 생성이 실패하고 브랜치만 생성된 경우 화면 안내를 따라 해당 브랜치로 수동 PR을 만듭니다.

이 전달 작업에서는 실제 사용자 GitHub에 접근·쓰기하지 않았습니다. 먼저 비운영 테스트 저장소에서 공개/비공개, 토큰 만료, 기준 커밋 변경, 기존 브랜치 충돌을 확인하세요.

## 10. 브라우저 테스트 재현

```bash
# 프로젝트 루트. Python + Playwright + Chromium 설치가 별도로 필요합니다.
node scripts/build-editor-test.cjs
python scripts/test-editor-browser.py
```

이 명령은 EditorApp 컴포넌트용 로컬 테스트 호스트를 사용합니다. Next production/Spring 통합 E2E는 아닙니다. 사내 포트 3099가 사용 중이면 테스트 서버 설정을 조정합니다.

Windows에서는 symlink 권한/POSIX 파일 mode가 필요한 일부 파일시스템 검사가 명시적으로 SKIP됩니다. 이 표시는 통과가 아니며 Windows Developer Mode/권한이 있는 테스트 환경에서 별도 검증해야 합니다.

현재 전달 환경에서 사용한 오프라인 DOM 테스트는 아래와 같습니다. 저장/출처/자산 통신은 명시적 mock이며 실제 IndexedDB/CORS/Local Network Access를 검증하지 않습니다.

```bash
# Linux/macOS
EDITOR_TEST_OFFLINE=1 node scripts/build-editor-test.cjs
python scripts/test-editor-browser.py --offline
# PowerShell: $env:EDITOR_TEST_OFFLINE="1"; node scripts/build-editor-test.cjs
```

## 11. 운영 반영 전 수동 합격 기준

- 정식 `npm run build`, `gradlew test`, 실제 테스트 DB migration 통과.
- 기존 로그인·홈·저장목록 경로가 기존처럼 동작.
- 두 계정(편집자/뷰어), 두 브라우저에서 저장·초대·권한 거부·동기화 확인.
- IDE→렌더링, UI→실제 파일, 양쪽 동시 변경 409/충돌, 연결 해제·토큰 만료 테스트.
- URL 안의 탭/중첩 화면 기록·복원·UI 편집 후 소스 export→재가져오기 검증.
- React/Tailwind/Next의 실제 사용하는 버전과 패키지로 Node 실행·HMR·빌드.
- Chrome/Edge/Firefox/Safari 및 Windows/macOS/Linux 중 실제 지원을 광고할 조합별 테스트.
- 실제 GitHub 초안 PR, diff 검토, 테스트, 사람이 병합한 뒤 다시 가져오기.
- 데이터 보존·용량·백업·복구·서버 비용 점검. 폴링/전체 JSON은 대규모 팀 용량 보증이 아닙니다.

## 12. 롤백

서비스 프로세스와 IDE 연결을 먼저 중지합니다. 별도 브랜치의 소스 변경을 되돌리거나 `.polazu-backups/patch-.../files`의 이전 파일을 비교 후 복원합니다. 패치 후 다른 작업을 했다면 최신 작업을 덮지 않도록 먼저 보관합니다.

V4로 만들어진 DB 데이터는 소스 롤백과 별개입니다. 추가 테이블을 바로 drop하지 말고 팀 작업 데이터를 먼저 export/백업합니다. 기존 서비스가 V4 테이블을 쓰지 않는 상태로 전환하거나, 테스트 사본에서 백업 복원을 검증한 뒤 운영 복구 절차를 정합니다. Flyway 이력만 삭제해서 실행 상태를 속이지 않습니다.

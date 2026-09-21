# 보안·용량·호환성

## 적용 제한

| 항목 | 값 | 적용 위치 |
|---|---:|---|
| ZIP 업로드 | 64 MiB | Spring multipart, `ProjectService`, `RepositoryArchiveReader` |
| ZIP 해제 합계 | 128 MiB | `RepositoryArchiveReader` |
| ZIP 항목 수 | 10,000 | `RepositoryArchiveReader` |
| 저장 파일 수 | 2,500 | import 및 workspace save |
| 파일당 크기 | 4 MiB | import 및 workspace save |
| 공유 소스·자산 합계 | 32 MiB | import 및 workspace save |
| 한 일반 저장 요청 | 100 file changes | `WorkspaceService` |
| restore/remote apply | 최대 2,500 changes | `WorkspaceService` |
| Git 게시 파일 | 최대 2,500 | `GitHubPublishService` |
| GitHub JSON 응답 | 2 MiB | `GitHubPublishService` |

단위는 binary MiB(1 MiB = 1,048,576 bytes)입니다. 값은 `RepositoryArchiveReader`, `application.yml`, `/api/projects/limits`에 맞춰 두었습니다. 변경 시 세 위치를 함께 수정하세요.

## ZIP 방어

- 절대경로, Windows drive, 역슬래시, `.`/`..`, NUL 차단
- 암호화 ZIP 항목 및 Unix symlink 차단
- 대소문자만 다른 경로와 file/folder 충돌 차단
- `.git`, `node_modules`, build/dist/out/cache/IDE 폴더 제외
- `.env`, npm/yarn 인증 설정, pem/key/keystore, credential 이름, `.ssh`, secrets 폴더 제외
- 지원 text/asset 확장자만 저장
- 압축된 크기뿐 아니라 각 entry를 읽는 동안 해제 크기 검사

## 인증과 권한

- 비밀번호: PBKDF2-HMAC-SHA256, random 16-byte salt, 210,000 iterations
- 세션: 32-byte random token; DB에는 SHA-256 hash만 저장
- 쿠키: HttpOnly, SameSite=Lax, 운영 시 Secure
- 프로젝트 접근은 존재 여부를 숨기기 위해 비멤버에게 404
- UI에서 버튼을 숨기는 것과 별개로 모든 저장/관리 API에서 역할 검사
- 멤버 제거 시 해당 단일 인스턴스의 SSE 연결 종료

운영 배포에서는 HTTPS, 신뢰할 수 있는 reverse proxy, 좁은 CORS allow-list, rate limit/WAF, 세션 정리 job을 추가하세요. 현재 CSRF 방어는 SameSite 쿠키와 JSON/CORS 경계를 활용한 개발 기준이며, 여러 서브도메인을 같은 site로 운영한다면 별도 CSRF token 또는 엄격한 Origin 검사 추가가 필요합니다.

## Git 자격증명

- 토큰은 GitHub import/check/apply/publish 요청 body에만 포함
- DB, 프로젝트 파일, ZIP, Git operation log에 토큰을 기록하지 않음
- 오류 메시지에 request body를 기록하지 않음
- 운영에서는 fine-grained token 또는 GitHub App의 최소 저장소 권한 권장
- 실제 외부 변경은 사용자가 게시 버튼을 누른 요청에서만 수행

## 사용자 코드 실행

- Spring 백엔드는 가져온 프로젝트 코드를 실행하지 않음
- preview는 사용자 브라우저의 WebContainer 안에서 실행
- 설치는 `npm install --ignore-scripts`를 사용하지만 개발 서버 코드는 브라우저 컨텍스트에서 실행됨
- POLAZU 세션/Git 토큰을 preview 파일 시스템에 주입하지 않음
- iframe sandbox를 사용하지만 `allow-scripts`와 `allow-same-origin`이 필요하므로 신뢰하지 않는 프로젝트는 별도 브라우저 프로필에서 검증 권장

## 데이터·이력 비용

현재 revision change는 바뀐 파일의 before/after를 보관하고, 수동 내부 버전은 전체 파일 스냅샷입니다. 매 키 입력마다 전체 프로젝트 JSON을 저장하지는 않지만 장기 운영 시 이력 DB가 원본 32 MiB 제한보다 커질 수 있습니다. 운영 전 다음을 정해야 합니다.

- 프로젝트별 history quota
- 내부 버전 보존 개수/기간
- revision 압축 또는 object storage 분리
- soft-deleted 프로젝트 제거 기간
- 감사/백업 요구와 물리 삭제 정책

## 호환성

설계 대상은 Windows/macOS/Linux와 최신 Chrome/Edge/Firefox/Safari입니다. WebContainer preview는 cross-origin isolation 및 브라우저 기능 지원 여부에 영향을 받습니다. 핵심 Git 교환은 File System Access API나 localhost agent를 요구하지 않습니다.

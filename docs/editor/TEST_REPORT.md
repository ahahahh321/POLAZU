# POLAZU Editor — 실제 검증 결과

검증 기록 시각: 2026-09-20T02:55:03.780659+00:00. 이 보고서는 실제 실행 로그에 근거합니다.

## 먼저 읽기

**이 전달본은 프로젝트·UI 에디터 개발 소스이며, 모든 요청과 기술 조합을 완성·검증한 운영 배포본이 아닙니다.** 97개 명세 항목은 구현 범위 설명이며 97개 기능 각각이 운영환경 통합 검증을 통과했다는 숫자가 아닙니다.

원본 업로드 이후 PC에서 바꾼 내용을 알 수 없으므로 기존 폴더를 강제로 덮어쓰지 않습니다. `LOCAL_MIGRATION.md`의 별도 브랜치·DB 백업·dry-run 순서를 따르세요.

## 1. 최종 실행 결과

| 구분 | 실행 결과 | 검증한 범위 | 검증하지 않은 범위 |
|---|---|---|---|
| 전체 TypeScript | PASS, exit 0 | `tsc --noEmit --incremental false`, 기존 및 새 TS/TSX 전체 | Next/SWC 번들링, SSR, 실제 네트워크 |
| Node tests | **46/46 PASS, skip 0** | AST/HTML 소스 패치, ZIP/폴더, GitHub mock REST, 실제 agent HTTP/파일, safe patch | 사용자 계정 GitHub, Windows/macOS 실제 파일 시스템 |
| EditorApp DOM | **14/14 PASS** | 실제 UI 선택·코드 반영·탭 복원·flow·반응형·ZIP 바이트·React/Next 동기 UI | IndexedDB·인증·CORS·브라우저 다운로드 정책·Next SSR |
| 동기화 React hook | **6/6 PASS** | IDE 수신/송신, 동일 파일 충돌, 팀 disjoint merge, document ID, VIEWER, 늦은 응답 차단 | 실제 팀 서버/DB/여러 사용자 네트워크 |
| Java 규칙 검사 | **18/18 PASS** | `javac`/`java` 독립 실행, JSON map/경로/권한 규칙 | Spring/JPA/Flyway/H2/MySQL 엔진 |
| Preview vendor 생성 | PASS, exit 0 | 기존 의존성에서 React/DOM runtime 생성, 라이선스 포함 | npm 신규 설치/모든 React 버전 |
| 전체 `next build` | **BLOCKED / 실패 exit 1** | 실제 실행 시도·로그 보존 | Linux SWC 다운로드 DNS 실패로 프로덕션 빌드 미완료 |
| `gradlew test` | **BLOCKED / 실패 exit 1** | 실제 실행 시도·로그 보존 | Gradle 배포본 다운로드 DNS 실패, Spring 통합 미실행 |
| 패치/ZIP | 별도 최종 검증 JSON | 원본 사본 적용, 재적용, 해시·압축 해제 | DB 자동 migration/운영 배포는 수행하지 않음 |

전체 84개 검사 결과를 하나의 '84개 실제 서비스 E2E'로 해석하면 안 됩니다. Node의 일부는 mock REST, Java는 프레임워크 없는 규칙, DOM/hook에는 명시적 adapter가 있습니다.

## 2. 테스트 환경과 제약

- OS: `Linux-6.18.44-x86_64-with-glibc2.41`
- Node `v22.16.0`, npm `10.9.2`, TypeScript `Version 5.9.3`
- Java: `openjdk version "21.0.11" 2026-04-21`
- Browser: `Chromium 144.0.7559.96 built on Debian GNU/Linux 13 (trixie)`

원본 ZIP에는 Windows용 의존성이 포함되어 있었습니다. 여기서는 읽어 사용할 수 있는 JS 의존성으로 검사를 수행했으며, 다른 OS의 node_modules를 전달하지 않습니다. 실제 대상 PC에서 `npm ci`를 실행하세요.

`next build`는 `registry.npmjs.org`의 `EAI_AGAIN`, Gradle은 `services.gradle.org`의 `UnknownHostException`으로 중단됐습니다. 출력이 없는 검사를 임의로 PASS 처리하지 않았습니다.

Chromium 관리 정책의 URL 차단 때문에 localhost/file URL로 테스트 페이지를 여는 것도 차단되었습니다. 정책은 우회하지 않았습니다. `about:blank` 테스트 host에서 실제 EditorApp과 iframe UI를 실행하되 **저장소는 메모리, 출처/bridge·vendor 전송은 테스트 전용 adapter**를 사용했습니다. CSS·React 이벤트·소스 변경·iframe DOM·ZIP 바이트는 실제 실행 결과입니다. 네이티브 IDB와 HTTP 접근 정책을 검증한 것은 아닙니다.

최종 브라우저 `page_errors`는 0건입니다. 실제 URL 네트워크 E2E 완료 표시는 `false`입니다. Windows의 symlink/POSIX mode 테스트는 권한/OS 의미 때문에 명시적 SKIP하도록 되어 있으며, 이 환경의 실행에서는 Linux이므로 skip 0입니다.

## 3. Node 46개 상세

| 번호 | 검사 | 결과 |
|---:|---|---|
| 1 | agent snapshot excludes secrets, dependencies and symbolic links | PASS |
| 2 | agent save detects external IDE edits and produces no echo loop | PASS |
| 3 | agent transactional preflight, update, delete, binary and backup | PASS |
| 4 | agent rejects whole patch before writing if any operation is unsafe | PASS |
| 5 | agent refuses symlink paths and a symlink backup location | PASS |
| 6 | agent refuses malformed base64, encoding mismatch, duplicate and case collision | PASS |
| 7 | agent HTTP authentication, CORS and host boundary | PASS |
| 8 | agent HTTP concurrently applying same revision only permits one write | PASS |
| 9 | agent HTTP JSON-only and no arbitrary command execution endpoints | PASS |
| 10 | safe cross-platform paths reject traversal, devices, case collisions, secrets | PASS |
| 11 | stack scope React Next HTML only | PASS |
| 12 | route discovery supports Next groups, src layouts and HTML pages | PASS |
| 13 | JSX text patch preserves handlers, types, comments and quotes | PASS |
| 14 | dynamic text and children cannot be silently overwritten | PASS |
| 15 | style patch merges existing object, spreads, comments and events | PASS |
| 16 | stale source hash, invalid CSS and unsafe attributes refused | PASS |
| 17 | HTML scanner and text/style patch preserve scripts and attributes | PASS |
| 18 | runtime-only instrumentation does not enter exported sources | PASS |
| 19 | scoped CSS adds stable identity and merges same breakpoint without duplicates | PASS |
| 20 | safe static insertion, duplication and deletion leave dynamic nodes intact | PASS |
| 21 | page generation refuses traversal and duplicate paths | PASS |
| 22 | file merge preserves disjoint edits and stops same-file collisions | PASS |
| 23 | file merge handles delete-vs-edit and identical changes | PASS |
| 24 | browser preview builds React graph and explicitly rejects native/server imports | PASS |
| 25 | browser preview HTML has inlined CSS/JS and no external source scripts | PASS |
| 26 | binary module import resolves without being mistaken for JavaScript | PASS |
| 27 | Team merge propagates GitHub provenance and baseline; conflicting origin is explicit | PASS |
| 28 | ZIP export/import round-trip preserves source, binary, screens and click sequences | PASS |
| 29 | ZIP filters credentials and dependencies, strips wrapper and refuses unsafe names | PASS |
| 30 | ZIP rejects symlinks, malformed metadata and invalid UTF-8 | PASS |
| 31 | Folder import retains UTF-8 and excludes .env | PASS |
| 32 | Workspace metadata rejects duplicate screens, foreign URL, excessive actions and token injection | PASS |
| 33 | GitHub URLs are strict and local connector refuses non-loopback | PASS |
| 34 | GitHub import uses commit tree, keeps token out of workspace, and filters secrets (mock REST) | PASS |
| 35 | GitHub truncated tree fails instead of silently importing partial project (mock REST) | PASS |
| 36 | GitHub PR creates a NEW ref and draft PR, never updates main (mock REST) | PASS |
| 37 | GitHub stale base aborts before writing; existing branch failure is never forced (mock REST) | PASS |
| 38 | Agent writer sends only deltas and keeps deletion explicit (mock HTTP transport) | PASS |
| 39 | Patch dry-run verifies payloads and leaves target unchanged | PASS |
| 40 | Patch applies with preimage backup and second application is a no-op | PASS |
| 41 | Patch refuses drift before touching any files | PASS |
| 42 | Patch refuses corrupted payload | PASS |
| 43 | Patch refuses traversal and font/secret redistribution paths | PASS |
| 44 | Patch refuses symlink targets and symlink backup directories | PASS |
| 45 | Patch preserves original file mode | PASS |
| 46 | Patch refuses a symlink payload root | PASS |

## 4. 실제 화면 14개 + 동기화 hook 6개

| 번호 | 검사 | 결과 |
|---:|---|---|
| 1 | HTML project import/start renders actual source | PASS |
| 2 | Visual text edit changes original HTML and rendered heading | PASS |
| 3 | Visual style edit commits real style with source hash validation | PASS |
| 4 | Undo/redo replays source changes rather than only DOM changes | PASS |
| 5 | Same-URL tab recorded and reopened independently | PASS |
| 6 | Editing a tab content preserves and replays the active state | PASS |
| 7 | Nested same-URL click sequence survives recreation | PASS |
| 8 | Main login button links to destination page with arrow geometry | PASS |
| 9 | Code edit updates rendered UI without a manual project reimport | PASS |
| 10 | Responsive editor writes scoped CSS and changes actual viewport rendering | PASS |
| 11 | Named snapshot creation and review history UI | PASS |
| 12 | Export ZIP contains real changed source and saved flow/tab metadata | PASS |
| 13 | React component executes useState/events in isolated preview | PASS |
| 14 | Next.js synchronous UI fallback and page routing; not SSR | PASS |
| 15 | IDE saved file updates workspace on polling | PASS |
| 16 | Designer source update reaches agent with CAS and no echo loop | PASS |
| 17 | Same-file concurrent edits pause and require explicit resolution | PASS |
| 18 | Team sync accepts disjoint changes and preserves server document identity | PASS |
| 19 | Viewer role cannot send source writes | PASS |
| 20 | Disconnect drops stale in-flight team response | PASS |

## 5. Java 독립 검증 18개

| 번호 | 검사 | 결과 |
|---:|---|---|
| 1 | valid workspace | PASS |
| 2 | traversal / reserved device / secrets | PASS |
| 3 | supported React and CSS paths | PASS |
| 4 | schema exact number | PASS |
| 5 | path collision | PASS |
| 6 | asset base64 strict | PASS |
| 7 | large valid base64 does not overflow regex stack | PASS |
| 8 | file size limit | PASS |
| 9 | duplicate screen identifiers | PASS |
| 10 | external URL cannot be saved as screen path | PASS |
| 11 | invalid metadata types | PASS |
| 12 | unsafe CSS token | PASS |
| 13 | editor may modify UI | PASS |
| 14 | editor cannot initialize | PASS |
| 15 | editor cannot change protected API | PASS |
| 16 | editor cannot delete protected API | PASS |
| 17 | editor cannot weaken protection rules | PASS |
| 18 | editor cannot switch root | PASS |

`EditorWorkspaceIntegrationTests.java`는 별도로 Spring MockMVC/H2/Flyway 통합 실행을 위한 테스트를 포함합니다. **이 파일은 작성했지만 여기서 실행하지 못했습니다.** 독립 검사 PASS를 이 클래스의 통과로 대체하지 않습니다.

## 6. 개발 도중 발견하고 수정한 사항

- 동일 URL의 탭 화면을 다시 열 때 iframe srcdoc 문자열이 같아 재로딩되지 않던 문제: preview revision key로 분리하고 재현 테스트 통과.
- TypeScript 위치/오프셋 기반 소스 변경 후 오래된 DOM 선택이 다른 노드를 가리킬 위험: 외부 변경 시 선택과 undo를 비우고 hash 불일치는 차단.
- 탭/중첩 클릭 재생 시 다른 의미의 버튼을 누를 위험: 저장한 role·label까지 확인하고 복구 불가 시 재기록 안내.
- 팀 문서의 ID와 로컬 작업 ID 혼동: 서버 document ID를 보존한 쓰기와 테스트 추가.
- 연결 해제 후 진행 중 요청의 늦은 응답 반영: 연결 세대와 프로젝트 ID 검사로 차단.
- 실제 파일 쓰기 중 외부 IDE가 수정한 파일을 롤백으로 덮을 위험: 최신 hash가 예상과 다르면 덮지 않고 수동 복구 안내.
- ZIP metadata/GitHub origin의 분기 정보가 소스와 어긋날 위험: metadata 검증·반출 및 origin 3-way 비교.
- 안전 패치의 payload root가 심볼릭 링크인 경우: 거절과 단위 테스트 추가.
- 화면 테스트의 Next 시작 버튼 선택자가 실제 UI와 달랐던 오류: 가져오기 대화상자의 NEXT 시작 동작으로 바로잡고 재실행.

`verification/`에는 최종 결과를 넣고 최초 실패 기록 일부는 `prior/`에 별도 구분했습니다. 과거 실패 로그를 현재 결과로 섞지 않습니다.

## 7. 재현 명령

```bash
npm ci
npm run editor:vendor
npm run typecheck
npm run test:editor
npm run build
# Spring 통합 테스트는 Java21 + 의존성 네트워크 필요
cd backend
# Windows: .\gradlew.bat test
sh ./gradlew test
```

독립 Java 검사:

```bash
# 프로젝트 루트, Linux/macOS 예
mkdir -p verification/java
javac -d verification/java backend/src/main/java/com/interfacelab/backend/editorworkspace/WorkspaceValidation.java backend/src/test/java/com/interfacelab/backend/editorworkspace/WorkspaceValidationChecks.java
java -cp verification/java com.interfacelab.backend.editorworkspace.WorkspaceValidationChecks
```

오프라인 DOM 검사는 `LOCAL_MIGRATION.md` 10절을 참조하세요. 일반 HTTP component harness도 실제 운영 Next/Spring E2E를 대신하지 않습니다.

## 8. 운영 승인 전 필수 잔여 검증

1. 대상 OS에서 새 의존성 설치와 정식 Next build.
2. 테스트 DB 사본의 V4 migration, Spring 인증/권한/revision transaction, 초대 및 읽기 전용.
3. 실제 IndexedDB 저장/재접속/용량 초과/다른 탭 접근.
4. 실제 GitHub 공개·비공개 repository 가져오기, 토큰 만료, 새 branch/draft PR.
5. 실제 localhost 브라우저→agent와 팀 서버를 함께 연결한 양방향/두 사용자 충돌.
6. 실제 프로젝트의 Node/WebContainer/Tailwind/Next SSR·API route 의존성 실행.
7. 광고할 Windows/macOS/Linux 및 Chrome/Edge/Safari/Firefox 조합별 검증.
8. Figma/이미지 변환, 임의 컴포넌트 교체, 문자 단위 공동 편집 등 **미구현** 항목은 테스트만 남은 기능으로 표시하지 않기. 상세는 `SUPPORT_MATRIX.md`.

## 9. 전달물 검증 근거

`verification/package-verification.json`에 원본 사본에서 패치 검사/적용/재적용과 소스 비교 결과를 기록합니다. ZIP을 생성한 뒤 다시 열어 CRC를 검사하고 새 폴더에 압축 해제하여 파일 해시를 비교합니다. 최종 ZIP SHA-256와 파일 크기는 별도 `POLAZU_Editor_Download_Checksums.json`에 기록하며, 자체 파일을 포함한 자기참조 해시는 만들지 않습니다.

**본 보고서·스크린샷은 성공을 가정해 만든 예시가 아니라 이번 실제 실행 결과입니다. 단, 명시된 테스트 adapter와 환경 범위를 넘는 성공을 의미하지 않습니다.**

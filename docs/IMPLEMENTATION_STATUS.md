# 구현 상태

## 완료된 수직 기능

| 기능군 | 상태 | 실제 연결 |
|---|---|---|
| 로그인/회원가입/세션 | 완료 | Next UI → Spring API → MySQL 세션 |
| 프로젝트 목록/생성/보관/삭제/복구 | 완료 | `/projects` → 프로젝트 API/DB |
| GitHub 공개/비공개 가져오기 | 완료 코드 | GitHub REST archive/metadata → 안전한 서버 workspace |
| ZIP 가져오기 | 완료 | multipart → 보안 검사 → workspace |
| 역할 | 완료 | OWNER/EDITOR/VIEWER API·SSE 검사 |
| 파일 저장 | 완료 | optimistic revision + idempotency + DB transaction |
| revision 이력 | 완료 | 변경 파일 전후 내용 및 메타데이터 |
| 내부 버전/복원 | 완료 | 전체 스냅샷, 복원은 새 revision |
| presence/SSE | 완료(단일 노드) | 프로젝트·브랜치 격리 |
| 댓글/팀원 | 완료 | DB + SSE 알림 |
| ZIP 내보내기 | 완료 | 서버 현재 작업본 |
| Git 원격 확인/적용 | 완료 코드 | GitHub head 재확인, 웹 변경 보존 |
| Git commit/push/draft PR | 완료 코드 | Git Data API, 고정 revision, 부분 성공 기록 |
| HTML 시각 편집→소스 | 완료(지원 범위) | DOM selector 기반 text/style/attribute/insert/duplicate/delete |
| React/Next 시각 편집→소스 | 완료(정적 intrinsic 범위) | Babel source mapping → JSX/TSX 최소 patch |
| 디자이너 캔버스 | 완료(지원 범위) | 다중 선택·동시 이동, resize, 정렬/분배, source-safe copy/paste, ruler/guide/grid/snap, zoom/pan |
| 속성·반응형 | 완료(지원 범위) | Flex/Grid/spacing/type/effect/image/accessibility, 3 breakpoint CSS |
| Insert·토큰 | 완료(정적 범위) | 24 UI primitive, 첫 저장 전 삽입 root 추가 편집 병합, CSS custom property 검색/수정 |
| 품질 Audit | 완료(보조 검사) | alt/name/label/id/overflow/target/contrast/broken asset |
| 코드 편집→서버 초안 | 완료(텍스트 파일) | 파일 단위 save API |
| 브라우저 복구 큐 | 완료 | localStorage 캐시, 자동 병합 금지 |

## 부분 구현

| 기능 | 현재 범위 | 남은 핵심 |
|---|---|---|
| 실시간 공동 편집 | 저장 후 SSE 알림, 파일 단위 충돌 | 문자 단위 CRDT/OT, 동일 파일 병합 UI |
| 편집기 | 전문 캔버스·툴바·레이어·속성·viewport/mock/audit | LSP, syntax highlight, multi-file diff, component instance/variant |
| React/Next 시각 수정 | intrinsic JSX source mapping과 정적 text/style/attribute/structure patch | 동적 expression, render loop instance, 완전한 AST transform |
| Next 실행 | WebContainer UI 호환/실험 서버 | SSR/Server Actions/API Route 보장 및 격리 E2E |
| 검토 | 댓글/해결 | 멘션, 승인 정책, 변경 요청 워크플로 |
| Git | GitHub REST 기반 | GitLab/Bitbucket, OAuth 앱, 조직 정책, 실제 E2E |
| 확장성 | 단일 Spring 인스턴스 | 분산 SSE/presence 브로커, shared lock/idempotency cache |
| 이력 | DB revision/버전 | 보존 기간, 압축, quota, 정리/감사 export |

## 미구현

- 페이지 카드와 요소 위치를 연결하는 흐름도 및 수동 연결선 저장
- 같은 URL의 탭·중첩 탭·모달·펼침 상태의 일반화된 캡처/복원
- Figma import 또는 이미지에서 원본 코드 복원
- variant/slot/원본-인스턴스 영향 분석과 semantic token binding
- component 원본/instance/variant/slot/prop 영향 분석과 팀 component library
- binary asset 업로드·crop·초점 bitmap 생성·팀 asset library
- 모션 타임라인과 reduced-motion 대안 생성
- 완전한 접근성 E2E와 스크린리더/키보드 자동 검증
- 문자 단위 공동 편집과 사용자의 undo를 협업 의미론으로 변환
- PR 승인/merge, 기존 브랜치 자동 merge, 강제 push
- 서버에서 사용자 프로젝트를 컨테이너로 실행하는 기능
- 자동 DB 백업, 재해 복구 오케스트레이션

## 미검증

현재 작업 환경은 외부 DNS/패키지 다운로드가 차단되어 다음을 실행하지 못했습니다.

- `npm ci`, 실제 `npm run typecheck`, `npm run build`
- Gradle 배포본 및 Maven dependency를 받은 실제 `./gradlew test`
- MySQL 8.4에 Flyway V2 실제 적용
- Chrome/Edge/Firefox/Safari 브라우저 E2E
- GitHub 비공개 저장소 및 쓰기 토큰으로 commit/push/PR
- 다중 사용자 두 브라우저 동시 편집

이 항목은 실패로 숨기지 않고 테스트 보고서의 실행 명령과 환경 오류로 남겼습니다.

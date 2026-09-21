# 기능 명세

상태 표기: **완료**는 소스 경로가 연결된 기능, **부분**은 제한된 범위만 동작, **미구현**은 UI 또는 백엔드가 연결되지 않은 기능, **미검증**은 코드는 있으나 실제 환경 검증이 끝나지 않은 기능입니다.

## AUTH-01 세션 인증

- 사용자: 모든 사용자
- 화면: `/signup`, `/login`, 루트 세션 게이트
- 절차: 회원가입/로그인 → HttpOnly 세션 쿠키 발급 → `/api/auth/me` 확인 → `/projects`
- 데이터: `app_user`, `auth_session`; DB에는 원문 토큰이 아닌 SHA-256 토큰 해시 저장
- 보안: PBKDF2-HMAC-SHA256 210,000회, SameSite=Lax, 운영 Secure 쿠키 옵션
- 실패: 중복 계정 409, 잘못된 자격증명 401, 만료 세션 401
- 파일: `AuthService`, `AuthInterceptor`, `AuthController`, `AuthProvider`
- 상태: **완료**, 운영 HTTPS/프록시 환경은 **미검증**

## PRJ-01 프로젝트 생성·목록·상태

- 권한: 목록은 멤버, 이름/상태 변경은 OWNER
- 화면: `/projects`
- 입력: 빈 HTML 프로젝트, GitHub 공개/비공개 저장소, ZIP
- 기능: 검색, ACTIVE/ARCHIVED/DELETED, 이름 변경, 보관, soft delete, 복구, 열기
- 데이터: `project`, `project_member`, `workspace_file`
- 실패: 비지원 프레임워크, 잘못된 저장소 주소, 용량 초과, 악성 ZIP
- 파일/API: `ProjectService`, `ProjectController`, `/api/projects/**`
- 상태: **완료**, 실제 비공개 GitHub 토큰 검증은 **미검증**

## PRJ-02 공유 프로젝트 작업 공간

- 권한: OWNER/EDITOR 쓰기, VIEWER 읽기
- 흐름: 프로젝트를 한 번 가져오면 팀원은 동일한 project ID를 열며 ZIP 재업로드 불필요
- 데이터: 서버 MySQL 작업 공간이 기준. 브라우저 localStorage는 실패/오프라인 복구 큐뿐
- 파일/API: `WorkspaceService`, `/workspace`, `/workspace/changes`
- 상태: **완료**

## COL-01 파일 단위 공동 편집

- 통신: HTTP 저장 + SSE 알림
- 충돌: 모든 변경은 `baseRevision`과 현재 project revision을 비교. 다르면 409 `REVISION_CONFLICT`
- 중복: `clientMutationId` 고유키로 동일 요청 재전송 시 기존 결과 반환
- 순서: 프로젝트 row `FOR UPDATE`로 revision 증가 직렬화
- 범위: 문자 단위 CRDT/OT가 아니라 파일 변경 단위 optimistic concurrency
- 오프라인: 브라우저 큐에 최대 50건 보관; 기준 revision이 다르면 자동 적용하지 않음
- 파일: `WorkspaceService`, `ProjectEventHub`, `EditorPage`
- 상태: **완료(파일 단위)**, 문자 단위 공동 편집은 **미구현**

## COL-02 접속자·작업 위치

- 기능: 프로젝트/브랜치별 SSE 구독, 75초 presence TTL, 작업 위치 heartbeat
- 역할 변경: 대상 세션에 `role-changed`; 멤버 제거 시 `access-revoked` 후 emitter 종료
- 한계: 인메모리 허브라 단일 백엔드 인스턴스에만 일관됨
- 상태: **완료(단일 노드)**, Redis/Kafka 등 다중 노드 브로커는 **미구현**

## ACL-01 역할 권한

- OWNER: 프로젝트 설정, 멤버, 저장소 연결, 코드/UI 수정
- EDITOR: 코드/UI 수정, 버전/댓글, Git 게시 시도. 실제 GitHub 권한은 별도 토큰으로 다시 확인
- VIEWER: 작업 공간, preview, revision, 댓글 열람/작성; 소스 저장 불가
- 서버: API마다 read/write/manage 검사. SSE 구독도 read 검사
- 상태: **완료**, 세밀한 파일별 정책과 보호 브랜치 정책 관리 화면은 **미구현**

## VER-01 revision·내부 버전

- revision: 작성자, 시각, 종류, 요약, 변경 경로, 전후 파일 내용을 기록
- 내부 버전: 현재 전체 파일 스냅샷을 이름/요약과 저장
- 복원: 기존 이력을 수정하지 않고 새 `RESTORE` revision 생성
- 상태: **완료**
- 한계: 이력 보존 기간/압축/정리 배치 미구현; 운영 전 정책 필요

## REV-01 댓글·검토

- 기능: 프로젝트 또는 파일/selector 위치에 댓글, OPEN/RESOLVED, 다시 열기
- 권한: 멤버 작성; 작성자 또는 편집 권한이 상태 변경
- 상태: **완료**
- 멘션 알림, 승인 게이트, 이메일 알림: **미구현**

## GIT-01 원격 확인·가져오기

- 기능: 선택한 기준 브랜치 head 확인, 저장된 `baseCommit`과 비교
- 원격 적용: 확인 commit을 다시 검증한 뒤 현재 작업 공간과 diff; 미게시 웹 변경은 내부 버전 보존 옵션 필수
- 적용 결과: 새 `REMOTE_APPLY` revision, `base_commit/default_branch/published_revision` 갱신
- 상태: **완료 코드**, 실제 GitHub 네트워크 검증은 **미검증**

## GIT-02 웹 revision 게시

- 입력: GitHub 토큰, 고정 source revision, 기준 브랜치, 새 원격 브랜치, 커밋 메시지, PR 여부
- 검증: 현재 revision과 게시 revision 일치, 원격 기준 브랜치 선행 여부, 브랜치 중복 여부
- 실행: blob → tree → commit → refs/heads 새 브랜치 → 선택적 draft PR
- 부분 성공: commit/push 후 PR 실패 시 `COMMIT_PUSHED_PR_FAILED`; 게시 revision은 반영
- 중복 방지: `git_operation(project_id, idempotency_key)`
- 금지: main/master/기준 브랜치 직접 게시, 강제 push, 자동 merge
- 상태: **완료 코드**, 실제 쓰기 작업은 **미검증**

## EDT-01 브라우저 프로젝트 preview

- 기술 감지: React, Next.js, Vite, 정적 HTML/JS/TS/Tailwind
- 실행: WebContainer를 브라우저에서 부팅; 패키지 설치는 `--ignore-scripts`
- Next: 클라이언트 UI 호환 모드와 원본 Next 서버 실험 모드 구분
- 서버 백엔드는 사용자 프로젝트 코드를 실행하지 않음
- 상태: **부분**. 브라우저 호환/패키지 네트워크에 따라 실패 가능

## EDT-02 코드 편집

- 파일 트리/검색, 텍스트 편집, 실제 서버 초안 저장, 파일 크기 표시
- 다른 revision이 먼저 저장되면 충돌 배너 후 최신 작업 공간 재로드
- 구문 강조, LSP 진단, 다중 파일 diff UI: **미구현**
- 상태: **부분**

## EDT-03 소스 연결 시각 편집

- 화면: `/editor`의 Design mode
- 권한: OWNER/EDITOR 변경, VIEWER 선택·검토·audit만 가능
- React/Next UI compatibility: Babel이 intrinsic JSX에 `data-polazu-source=/path:line:column`을 삽입
- HTML: 현재 route HTML을 selector로 다시 찾아 DOM 기반 최소 변경
- 지원 변경: leaf text, 안전한 attribute/ARIA, inline style, insert, duplicate, delete
- 새 primitive: 첫 저장 전 root text/style/attribute와 breakpoint style을 삽입 snippet에 병합하고, 직후 duplicate/delete를 구조 action으로 정리
- 저장: 변경 action을 `source-patcher`가 실제 JSX/TSX/HTML/CSS 파일 변경으로 변환한 뒤 서버 workspace revision 저장
- 실패: source 위치 불일치, 복합 children, 동적 attribute/className은 무리하게 덮어쓰지 않고 경고
- 상태: **완료(정적 요소의 안전한 범위)**. 임의 React DOM→원본 AST 완전 복원은 **미구현**

## EDT-04 캔버스·툴바·레이어

- 도구: 선택, 손, frame, text, rectangle, image, comment target
- 직접 조작: drag 이동, 다중 선택 동시 이동, 8방향 resize, grid snap, 방향키 1/10px 이동
- 선택: 단일/다중, breadcrumb, 겹친 구조는 Layers에서 선택
- 작업: source-safe 복사/같은 레벨 붙여넣기, 복제, 삭제, 정렬, 균등 분배, 앞/뒤 순서 preview
- 캔버스: zoom 20~200%, 100%, fit, pan, ruler, guide, grid, snap
- 패널: 크기 조절·접기, command palette, shortcut dialog
- 이력: inspector 미확정 값도 selection/breakpoint/route 전환 전에 action으로 기록. replay 시 style·text·허용 attribute 원본 복구
- 상태: **완료(파일 단위 작업 이력)**
- 제한: source reorder와 group/ungroup는 **미구현**, 레이어 별칭/잠금은 session metadata

## EDT-05 속성·레이아웃·반응형

- Position/size/min/max/z-index/overflow
- Flex direction/wrap/justify/align, Grid columns/rows
- gap, padding/margin 4방향과 shorthand
- typography, text wrapping/ellipsis, fill/color/gradient/opacity/blend
- border/radius/shadow/filter
- image src/alt/object-fit/object-position/aspect-ratio
- link/target/rel/title/placeholder/ARIA label
- Base/Desktop/Tablet/Mobile 재정의와 세 화면 나란히 비교
- responsive source: 정적 className에 `polazu-r-*`를 추가하고 관리 media block 생성
- 상태: **완료(지원 CSS property 범위)**
- 제한: breakpoint별 text/attribute는 허용하지 않으며 CSS style만 저장. 동적 className은 selector fallback 경고

## EDT-06 Insert·디자인 토큰

- Insert: Frame, Card, Navigation, Heading, Text, Image, Avatar, Badge, Rectangle, Button, Input, Textarea, Select, Checkbox, Switch, List, Table, Tabs, Accordion, Modal, Toast, Skeleton, Divider
- 출력: semantic HTML과 정적 JSX snippet을 선택 container에 삽입
- 토큰: CSS `--custom-property` 검색·분류·실제 선언 값 수정
- 토큰 범주: color, spacing/size, typography, radius, effect, other
- 상태: **완료(정적 primitive와 CSS 변수)**
- 제한: primitive의 상태 로직/API 연결은 자동 생성하지 않음. component instance/variant/slot/prop editor와 asset library는 **미구현**

## EDT-07 코드·Mock·품질 검사

- Code: 파일 검색/선택, 선택 요소 원본 파일 이동, 직접 편집, 서버 workspace 저장
- Mock: preview fetch/XHR의 client API mock
- Audit: alt, broken image, accessible name, form label, duplicate id, overflow, focus 확인, target size, 텍스트 대비 근사
- 상태: **부분**
- 제한: syntax highlight/LSP/다중 파일 diff 없음. Audit는 자동 보조 검사이며 WCAG 적합성 보증 아님

## EDT-08 고급 디자인 시스템·흐름·모션

다음은 **미구현 또는 제한적**입니다.

- 재사용 component 원본/instance/variant/slot/prop 영향 분석
- Tailwind class 의미 단위 재구성 및 token binding
- binary image upload/crop/focal bitmap 생성/팀 asset library
- 페이지 카드와 실제 요소 anchor를 연결하는 flow diagram
- 같은 URL tab/nested tab/modal state capture와 replay
- prototype trigger/action과 motion timeline
- reduced-motion 대안 자동 생성
- 협업 의미론을 가진 문자 단위 undo/redo

## EXP-01 내보내기·복구

- ZIP: 현재 서버 작업 공간 파일을 내보냄
- 브라우저 복구: 네트워크 실패 변경을 localStorage에 보관
- 내부 버전: 원격 적용 전 보존 및 수동 체크포인트
- DB/파일 백업: 운영자가 MySQL 백업 수행
- 상태: **완료(기능 경로)**, 자동 백업 스케줄은 **미구현**

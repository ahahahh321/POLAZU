# 구조·데이터·동기화 설계

## 1. 실제 코드 경로

`app/editor/page.tsx` → `_components/EditorApp.tsx`가 새 편집기 진입점입니다. 기존 계정·로그인·팀 프로젝트·홈 기능은 보존했습니다. 구형 `_components/BrowserProjectRuntime.tsx`, `SavedUiEditor.tsx`, `/editor/ui/`는 호환을 위해 남아 있으며 새 에디터의 검증 결과를 이들 구형 화면에 적용하면 안 됩니다.

| 경로 | 역할 |
|---|---|
| `_core/model.ts` | schema 3 작업본, 소스, 화면 상태, 연결, 변경·충돌 타입 |
| `_core/paths.ts`, `validation.ts` | 파일 경로/크기/기술 스택 및 메타데이터 검사 |
| `_core/source.ts` | TS/JSX AST와 HTML 위치 기반 최소 소스 패치, 런타임 전용 요소 계측 |
| `_core/archive.ts` | ZIP·폴더 가져오기, 소스·상태 메타데이터 내보내기 |
| `_core/browser-preview.ts` | 격리된 HTML/기본 React UI 실행, 제한된 Next UI 어댑터 |
| `_core/node-preview.ts` | WebContainer 실행/소스 갱신/프로세스 정리 |
| `public/editor-bridge-v3.js` | 요소 선택, 위치/탭 수집, 상태 클릭 재생, 경로 이벤트, Mock |
| `_core/workspace.ts` | 소스 diff, 파일 단위 3-way merge |
| `_core/storage.ts` | IndexedDB 작업본·최대 20개 사용자 버전 |
| `_core/github.ts` | GitHub 직접 REST 가져오기/새 브랜치/초안 PR |
| `_core/sync.ts`, `_hooks/useWorkspaceSync.ts` | 팀/로컬 연결, revision, 충돌, 동기화 생명주기 |
| `_components/Inspector.tsx` | 속성/타이포/배치/반응형·상태 편집 |
| `_components/FlowCanvas.tsx` | 페이지/상태 카드, 실제 버튼 위치에서 시작하는 SVG 화살표 |
| `tools/editor-agent/` | 실제 폴더 읽기·CAS 쓰기·백업·loopback HTTP 연결 |
| `backend/.../editorworkspace/` | 세션 ACL·공유 문서·revision·idempotency·보호 경로 |
| `backend/.../db/migration/V4__editor_workspace_versions.sql` | 공유 작업본/최근 revision용 추가 테이블 |

실제 SQL 파일명은 전달 폴더의 `V4*` 파일을 확인합니다. 버전 번호를 이미 다른 목적으로 사용했다면 이 파일을 그대로 적용하지 않습니다.

## 2. 원본과 실행 복사본

작업본 `files`/`binaryFiles`가 편집의 원본입니다. `baseline`은 최초 가져오기/최근 GitHub 비교 기준이고, GitHub 토큰과 로컬 연결 토큰은 여기에 저장하지 않습니다. `meta`에는 화면 목록, 클릭 순서, 연결, 테스트 응답, 검토 메모, 토큰·보호 경로가 들어갑니다.

계측용 `data-pz-source`/`data-pz-hash`는 렌더링용 복사본에 추가합니다. ZIP/PR로 반영되는 소스에는 이 런타임 계측값을 넣지 않습니다. 반응형/상태 CSS를 적용하기 위한 `data-polazu-key`는 **실제 코드에서 필요한 안정 선택자**이므로 남습니다.

정적 문구/속성/스타일은 최소 구간 패치로 수정합니다. 이벤트 핸들러의 의미를 분석해 임의로 재작성하지 않습니다. 동적 JSX 문구, 중첩 문구, 위험한 구조 변경은 거부하거나 코드 편집으로 넘깁니다. 반복 컴포넌트의 같은 소스 노드를 수정하면 여러 인스턴스에 적용될 수 있습니다. 외부 코드 변경·구조 변경 후 선택을 해제하고 다시 선택하게 하여 오래된 AST 순번을 재사용하지 않습니다.

## 3. 화면 상태와 흐름

`Screen(kind='page')`는 URL, `Screen(kind='state')`는 URL+클릭 순서입니다. `role=tab`, `aria-controls`, `summary`를 탐지하며 기타 버튼/모달은 사용자가 ‘중첩 화면 클릭 기록’을 켜서 기록합니다. 텍스트/비밀번호/폼 값은 화면 상태로 저장하지 않습니다. 재생 대상이 사라지거나 의미가 바뀌면 경고합니다. 구조가 크게 바뀐 프로젝트는 상태를 다시 기록하세요.

화살표는 DOM에서 수집한 요소의 위치를 시작점으로 삼습니다. 카드 내부는 실제 화면의 **위치 기반 축약 미니맵**이며 픽셀 동일 스크린샷이 아닙니다. 각 페이지를 열어야 해당 페이지의 위치가 수집됩니다. 수동 연결은 설명용 메타데이터입니다. 실제 이동은 `href`/기존 라우터 코드를 수정해야 합니다. 관찰 가능한 링크/페이지 이동을 기록하지만 모든 조건 분기·인증·비동기 이동을 정적으로 완전 발견하지는 않습니다.

## 4. IDE → 서비스 → 팀

```
사용자의 IDE 저장
  → loopback Node 에이전트의 파일 snapshot
  → 열린 POLAZU 브라우저가 약 1.2초 간격으로 확인
  → base / local / remote 3-way merge
  → 작업본 변경 → 렌더링 재생성 또는 Node HMR
  → 팀 공유 연결이 있으면 Spring 공유 revision으로 저장
  → 다른 팀원의 열린 POLAZU가 revision 확인 후 렌더링
```

역방향은 디자이너의 소스 패치 → 명시적으로 쓰기 허용한 에이전트의 CAS 검증 → 원본 백업 → 파일 갱신입니다. IDE의 **저장하지 않은 버퍼**는 읽을 수 없습니다. ZIP과 GitHub import 모두 동일 workspace로 변환되므로 동일 연결 구조를 쓰지만, 파일 가져오기 자체가 PC 연결 권한이나 영구 백그라운드 중계를 의미하지 않습니다.

에이전트가 연결된 브라우저를 닫으면 팀 중계도 중지됩니다. WebSocket 문자 공동 편집/CRDT가 아니라 파일 단위 협업이며, 같은 파일의 서로 다른 줄을 수정해도 충돌로 표시할 수 있습니다. 충돌 시 사용자 결정 전 쓰기를 멈춥니다. 최초 연결은 공통 파일 경로가 충분한지 검사하지만 완전한 프로젝트 신원 인증은 아니므로 반드시 맞는 폴더를 선택합니다.

## 5. 서버 저장

기존 `projects`/`project_members` ACL을 재사용합니다. OWNER/EDITOR는 작업본 쓰기, VIEWER는 읽기입니다. 공유 작업본을 처음 만드는 작업 및 보호 경로/앱 루트 변경은 OWNER입니다. EDITOR의 보호 파일 변경은 서버에서도 거부합니다. 보호는 **파일 경로 단위**이지 모든 JavaScript의 업무 의미를 자동 검증하는 보안 샌드박스가 아닙니다.

기존 프로젝트 행을 pessimistic lock으로 잠근 뒤 `baseRevision`을 비교하여 head/history를 같은 트랜잭션으로 기록합니다. 동일 commandId+동일 문서 요청은 보존된 history 범위에서 재사용하고, 다른 내용이면 409입니다. 최근 20개 revision만 보존합니다. 장기 감사·무제한 복구나 대규모 동시 편집 저장소가 아닙니다.

- `GET /api/projects/{id}/workspace?since=N`
- `PUT /api/projects/{id}/workspace` `{baseRevision,commandId,document}`
- `GET /api/projects/{id}/workspace/history`
- `GET /api/projects/{id}/workspace/history/{revision}`

동일 revision이면 내용 없이 응답하며 DB 조회도 revision/시각 projection을 사용합니다. 변경 시에는 전체 JSON을 저장·전달합니다. 큰 작업본/다수 팀의 비용·처리량은 추가 부하 시험 후 운영해야 합니다. 현재 IDB 버전 UI와 서버 history REST는 구분되며, 서버 history 전용 시각적 복구 화면은 미구현입니다.

## 6. 보안 경계

브라우저 UI fallback은 `sandbox=allow-scripts` 및 opaque origin, 제한 CSP를 사용합니다. 부모는 발신 iframe/window와 연결 nonce를 검사합니다. Node 모드는 신뢰하는 프로젝트에 대해 사용자가 실행을 허용해야 합니다. `npm --ignore-scripts`는 설치 hook을 막지만 앱/빌드 설정 코드까지 무해하게 만드는 것은 아닙니다.

Node preview의 비밀키는 실제 서버의 비밀 보관소가 아닙니다. 계정·결제·운영 DB 키를 넣지 않습니다. Mock은 브라우저 fetch/XHR의 보조 장치이며 Next 서버 내부·WebSocket·모든 네트워크 활동을 차단하는 완전한 방화벽이 아닙니다.

로컬 연결은 loopback bind, 무작위 토큰, Host/Origin 검사, 상대 경로·심볼릭 링크 검사, 파일 크기 제한, 선행 hash 비교, 백업, 원자적 파일 교체를 사용합니다. 일반 명령 실행 endpoint는 없습니다. 여러 파일 쓰기가 운영체제 전체 트랜잭션이 되는 것은 아니며, 아주 짧은 외부 편집 경쟁이나 프로세스 강제 종료는 백업/수동 복구가 필요할 수 있습니다. 롤백 중 새로운 외부 변경이 발견되면 그 파일을 덮어쓰지 않습니다.

## 로컬 동기화 메타데이터 경계

IDE 에이전트는 실제 소스/허용 자산을 동기화합니다. 화면 이름·클릭 경로·flow 문서는 브라우저/팀 workspace에 보관하고 ZIP 또는 PR의 `polazu.workspace.json`으로 내보냅니다. IDE 폴더에 해당 메타데이터 파일을 매번 자동 저장하는 기능은 아닙니다. 같은 파일의 동시 변경은 문자 단위 병합하지 않습니다.

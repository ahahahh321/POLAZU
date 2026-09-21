# POLAZU 프로젝트·UI 에디터 기능 명세

**실제 구현 범위 97개 항목.** 외부 환경 의존 기능은 코드 포함과 실제 실행 검증을 구분했다.
기준: 이번에 실제 생성한 전달 소스. 요청의 모든 의미/기술 조합을 완성했다는 표가 아니라 **구현된 범위와 검증 경계**를 기록한 명세다. 전체 실행 환경/미구현 목록은 `SUPPORT_MATRIX.md`, 적용은 `LOCAL_MIGRATION.md` 참조.

검증 표기: **Node**=단위/파일/실제 loopback HTTP 또는 명시된 mocked REST. **DOM**=Linux Chromium의 실제 EditorApp 컴포넌트, 저장·출처·자산 통신은 test adapter. **Hook**=React hook과 mock 서버/agent. **Java**=Spring 없는 독립 검증. **Typecheck**=소스 타입 검사. 어느 것도 그 자체로 운영환경 전체 통합 테스트가 아니다.

## 프로젝트·가져오기

주요 구현: `app/editor/_components/EditorApp.tsx; app/editor/_core/archive.ts; app/editor/_core/paths.ts`

### PZ-ED-001 · HTML/React/Next 샘플 시작
- **동작·완료 범위:** 로그인·외부 저장소 없이 지원 템플릿을 실행하고 편집한다. 샘플의 로그인 폼은 실제 인증 미연결이다.
- **검증:** DOM: HTML/React, Next UI 별도 기록

### PZ-ED-002 · ZIP 가져오기
- **동작·완료 범위:** ZIP 64MB/해제 128MB/허용 소스+자산 32MB/파일 4MB/2,500개 제한으로 검사한다. 원본처럼 node_modules가 포함된 대형 ZIP은 사용자 편집기에서 거부한다.
- **검증:** Node: ZIP round-trip/필터/악성 경로

### PZ-ED-003 · 로컬 폴더 가져오기
- **동작·완료 범위:** directory input의 File 목록을 읽고 공통 루트를 제거한다. 브라우저/OS가 폴더 입력을 지원하지 않으면 ZIP을 사용한다.
- **검증:** Node: folder UTF-8/secret filter; native picker 미검증

### PZ-ED-004 · GitHub 공개·비공개 가져오기
- **동작·완료 범위:** 저장소 루트 URL·브랜치를 지정하고 commit tree/blobs로 읽는다. 개인 토큰은 메모리에만 둔다.
- **검증:** Node: mocked REST; 실제 OAuth/계정 미검증

### PZ-ED-005 · 절단된 저장소 트리 차단
- **동작·완료 범위:** GitHub tree가 truncated면 부분 프로젝트로 조용히 진행하지 않고 ZIP/폴더를 안내한다.
- **검증:** Node: truncated tree

### PZ-ED-006 · 비밀·생성물 제외
- **동작·완료 범위:** 환경 비밀 파일, .git, node_modules, 빌드·캐시·백업, 대표 자격증명 파일을 제외한다. 코드 안의 모든 비밀 탐지 보증은 아니다.
- **검증:** Node/agent path tests

### PZ-ED-007 · 경로 안전성·인코딩
- **동작·완료 범위:** 상위 경로/장치명/대소문자 충돌/불가 문자/심볼릭 링크를 검사하고 UTF-8 오류를 알린다.
- **검증:** Node/agent/Java validation

### PZ-ED-008 · 소스·이미지 분리
- **동작·완료 범위:** 텍스트 파일과 binary asset base64를 따로 보관하고 ZIP에서 실제 바이트로 복원한다.
- **검증:** Node: binary/ZIP

### PZ-ED-009 · 스택 진단·모노레포 앱 선택
- **동작·완료 범위:** package.json/index.html 루트와 React/Next/HTML을 판정하고 다른 스택을 거부한다. 모든 monorepo 의존성 설치 지원은 아니다.
- **검증:** Node: stack/routes; UI manual

### PZ-ED-010 · 브라우저 저장 작업 목록
- **동작·완료 범위:** 최근 작업을 브라우저 저장소에서 열거나 삭제한다. 프로젝트 삭제 시 snapshot도 함께 정리한다.
- **검증:** Storage code; 실제 IDB 미검증

### PZ-ED-011 · 프로젝트 이름·닫기
- **동작·완료 범위:** 이름을 변경하고 저장 후 작업을 닫는다. 저장 실패 시 내보내기 안내를 제공한다.
- **검증:** UI code/typecheck

### PZ-ED-012 · 메타데이터 재가져오기
- **동작·완료 범위:** polazu.workspace.json의 schema/화면/흐름/상태를 검증해 ZIP/GitHub에서 복원한다. 가져온 실제 source 종류는 유지한다.
- **검증:** Node: ZIP metadata; Github path unit

## 에디터 작업 공간

주요 구현: `app/editor/_components/EditorApp.tsx; app/editor/workspace.css; app/editor/_core/storage.ts`

### PZ-ED-013 · 디자인·흐름·코드·검토 모드
- **동작·완료 범위:** 같은 작업본을 네 가지 보기로 연다. 코드가 별도 복사본으로 이탈하지 않게 한다.
- **검증:** DOM: mode transitions

### PZ-ED-014 · 실행 모드 전환
- **동작·완료 범위:** 기본 브라우저 UI와 WebContainer Node 실행을 선택하고 런타임 한계를 화면에 표시한다.
- **검증:** DOM fallback; Node runtime 미검증

### PZ-ED-015 · 요소 선택·레이어 연결
- **동작·완료 범위:** iframe 내 요소를 클릭하면 원본 위치·스타일·문구를 표시하고 레이어와 연결한다.
- **검증:** DOM: source selection

### PZ-ED-016 · 레이어 탐색·검색·접기
- **동작·완료 범위:** DOM 기반 레이어를 찾고 접고 부모/자식 관계를 확인한다. 원본 React 컴포넌트 트리 전체와 동일하지 않다.
- **검증:** UI code/typecheck

### PZ-ED-017 · 레이어 다중 선택
- **동작·완료 범위:** Shift+레이어 선택으로 여러 소스 요소를 선택하고 지원 스타일을 적용한다. 같은 원본 노드는 중복 패치를 하지 않는다.
- **검증:** Source unit; UI multi manual

### PZ-ED-018 · 배율·화면 맞춤·이동
- **동작·완료 범위:** 20~150% 배율, 실제 viewport와 별도 배율, 화면 맞춤·캔버스 손 이동·그리드를 제공한다.
- **검증:** DOM rendering/viewport

### PZ-ED-019 · 반응형 viewport
- **동작·완료 범위:** 375/768/1280/1440 preset과 수동 폭·높이, 실제 iframe 크기 변경을 제공한다. 기기 에뮬레이터 인증이 아니다.
- **검증:** DOM: responsive viewport

### PZ-ED-020 · 디자인 선택/실제 동작 모드
- **동작·완료 범위:** 편집 모드에서는 선택, 동작 모드에서는 원래 클릭을 수행한다. 폼 제출은 미리보기에서 차단한다.
- **검증:** DOM: tabs/links/React events

### PZ-ED-021 · 자동 저장 상태
- **동작·완료 범위:** 변경 후 약 450ms 지연 저장과 저장 중/성공/실패를 표시한다. quota 실패 시 사용자 작업을 숨기지 않는다.
- **검증:** DOM uses mock storage; native IDB 미검증

### PZ-ED-022 · 실행 취소·다시 실행
- **동작·완료 범위:** 최근 최대 50개 작업본 상태를 되돌린다. 외부 동기화 도착 시 오래된 로컬 undo 이력을 비워 원격 변경을 되감지 않게 한다.
- **검증:** DOM: source undo/redo

### PZ-ED-023 · 키보드 단축키
- **동작·완료 범위:** Ctrl/Command S/Z/Shift Z, Escape, 도움말을 제공하고 입력창의 기본 편집을 우선한다.
- **검증:** UI/bridge code; 주요 undo DOM

### PZ-ED-024 · 런타임 로그·오류 상태
- **동작·완료 범위:** 설치/실행/미리보기 오류와 경고를 표시하고 다시 실행 또는 fallback 전환을 제공한다.
- **검증:** DOM runtime; install failure branch code

## UI 속성·실제 패치

주요 구현: `app/editor/_components/Inspector.tsx; app/editor/_core/source.ts; public/editor-bridge-v3.js`

### PZ-ED-025 · 정적 문구 편집
- **동작·완료 범위:** HTML leaf/정적 JSX 문구를 소스에 반영하고 다시 실행한다. 자식 컴포넌트·API 값·동적 표현식은 무단 평탄화하지 않는다.
- **검증:** Node + DOM: real text patch

### PZ-ED-026 · 타이포그래피
- **동작·완료 범위:** fontFamily/fontSize/fontWeight/lineHeight/letterSpacing/textAlign 등 지원 CSS 속성을 편집한다. 사용자 OS 폰트 존재는 별도이다.
- **검증:** DOM: font-size; whitelist unit

### PZ-ED-027 · 색상·배경·투명도
- **동작·완료 범위:** 문자/배경색·opacity를 편집한다. 광범위한 이미지·벡터 효과 도구는 아니다.
- **검증:** Style unit/inspector code

### PZ-ED-028 · 크기·최대/최소 크기
- **동작·완료 범위:** width/height/min/max 및 aspectRatio를 소스 스타일로 수정한다.
- **검증:** Style unit/inspector code

### PZ-ED-029 · 간격·배치
- **동작·완료 범위:** padding/margin/gap/display/position/inset 등을 수정한다. 지원하지 않는 동적 스타일을 완전 해석하지는 않는다.
- **검증:** Style unit/inspector code

### PZ-ED-030 · Flex·Grid
- **동작·완료 범위:** 방향·정렬·줄바꿈·grow/shrink/basis·gridTemplateColumns/Rows 등 지원 속성을 설정한다. 드래그 레이아웃 생성기 전체가 아니다.
- **검증:** Style whitelist/unit; UI manual

### PZ-ED-031 · 테두리·반경·그림자
- **동작·완료 범위:** borderWidth/Style/Color/Radius/boxShadow를 수정한다.
- **검증:** Style unit

### PZ-ED-032 · 반응형 CSS 생성
- **동작·완료 범위:** 전체 또는 max-width 768/1024/기타 지원 scope 규칙을 관리 stylesheet에 만들고 안정 선택자를 연결한다.
- **검증:** DOM: media CSS + viewport

### PZ-ED-033 · hover/focus/active/disabled 등 CSS 상태
- **동작·완료 범위:** 지원 pseudo-selector 스타일을 작성한다. 브라우저 강제 pseudo emulation/모든 복합 조건은 아니다.
- **검증:** Source unit; UI manual

### PZ-ED-034 · 기존 스타일 병합
- **동작·완료 범위:** JSX style 객체/스프레드/동적 style 표현식을 보존하며 필요한 override만 추가한다.
- **검증:** Node: style merge and event preservation

### PZ-ED-035 · 허용 속성 편집
- **동작·완료 범위:** alt/title/placeholder/aria-label/href/src/className 등 허용 속성을 수정한다. 위험 URL과 동적 JSX attribute를 제한한다.
- **검증:** Node: attribute restrictions

### PZ-ED-036 · Tailwind className 직접 편집
- **동작·완료 범위:** utility 클래스 문자열을 원본에 저장한다. Tailwind 자동 추천/충돌 해소/소스 클래스 재설계는 미구현이다.
- **검증:** Attribute unit; actual Tailwind build 미검증

### PZ-ED-037 · 소스 freshness 검사
- **동작·완료 범위:** 렌더링 당시 source hash와 현재 파일을 비교한다. IDE 수정 후 오래된 선택에는 다시 선택을 요구한다.
- **검증:** Node + DOM source patch

### PZ-ED-038 · 기본 요소 삽입
- **동작·완료 범위:** 지원 컨테이너에 텍스트/버튼/이미지/section primitive를 실제 코드로 추가한다.
- **검증:** Node: primitive insert

### PZ-ED-039 · 안전한 정적 노드 복제·삭제
- **동작·완료 범위:** 정적 노드만 허용하고 이벤트/동적 상태/식별자 등의 위험이 있으면 거부한다. 임의 컴포넌트 refactoring이 아니다.
- **검증:** Node: static transform guards

### PZ-ED-040 · 버튼 디자인 프리셋
- **동작·완료 범위:** 동일 버튼의 Primary/Outline/Pill 등 스타일을 바꾸고 기존 이벤트 함수를 그대로 둔다. npm 버튼 교체·완전 동작 보존 엔진은 아니다.
- **검증:** Source event preservation; preset UI manual

### PZ-ED-041 · 이미지 자산 추가
- **동작·완료 범위:** PNG/JPEG/WebP/SVG/GIF/AVIF/ICO 등을 허용 크기 안에서 추가하고 src로 연결한다.
- **검증:** Binary/source unit; picker manual

### PZ-ED-042 · CSS 디자인 토큰
- **동작·완료 범위:** 이름 있는 CSS 변수 생성/갱신, 값 검사, 관리 stylesheet 연결을 제공한다. 전체 디자인 시스템/테마 관리가 아니다.
- **검증:** Source/validation unit

## 페이지·탭·흐름도

주요 구현: `app/editor/_components/EditorApp.tsx; app/editor/_components/FlowCanvas.tsx; public/editor-bridge-v3.js`

### PZ-ED-043 · 페이지 자동 목록
- **동작·완료 범위:** Next app/pages 경로 및 HTML 경로를 찾아 페이지 목록을 구성한다. 임의 React Router route 선언 전체를 파싱하지 않는다.
- **검증:** Node: route discovery

### PZ-ED-044 · 새 페이지 생성
- **동작·완료 범위:** 지원 스택에서 새 빈 페이지/섹션 소스를 만든다. 추가 라우터/인증 설정이 필요한 React 앱은 수동 연결해야 한다.
- **검증:** Node: page creation

### PZ-ED-045 · 동적 URL 등록
- **동작·완료 범위:** 구체적인 path/query/hash를 화면으로 등록한다. parameterized SSR 실행은 Node/실제 앱에 의존한다.
- **검증:** Validation unit; UI manual

### PZ-ED-046 · 탭·클릭 영역 감지
- **동작·완료 범위:** role=tab, aria-controls, details summary를 탐지해 현재 페이지의 상태 진입 목록을 표시한다.
- **검증:** DOM: settings/activity tabs

### PZ-ED-047 · 같은 URL 상태 저장
- **동작·완료 범위:** URL이 같아도 클릭 순서가 다른 별도 Screen 상태로 저장한다. 입력값·비밀번호는 기록하지 않는다.
- **검증:** DOM: same-URL state

### PZ-ED-048 · 중첩 탭·details 상태 복원
- **동작·완료 범위:** 최대 24개 승인된 클릭 순서를 순서대로 재생하고 없는 대상은 중단/경고한다.
- **검증:** DOM: nested state

### PZ-ED-049 · 모달/사용자 정의 버튼 기록
- **동작·완료 범위:** 명시적으로 클릭 기록 모드를 켜서 동작을 기록한다. 모든 React 내부 state를 저장하는 것은 아니다.
- **검증:** Bridge implementation; arbitrary modal manual

### PZ-ED-050 · 상태 내 UI 소스 편집
- **동작·완료 범위:** 활성 탭의 정적 요소를 편집한 뒤 iframe 재생성 시 저장한 클릭 순서를 복원한다.
- **검증:** DOM: state content patch

### PZ-ED-051 · 같은 URL 재실행 보정
- **동작·완료 범위:** 원문 srcdoc가 같아도 화면 변경/재열기 시 새 문서를 만들고 재생 완료를 기다린다.
- **검증:** DOM regression: loading stall fixed

### PZ-ED-052 · 링크·관찰된 이동 수집
- **동작·완료 범위:** 링크/관찰 가능한 라우터 이동과 클릭 요소를 연결한다. 모든 비동기·인증 분기의 목적지를 자동 증명하지 않는다.
- **검증:** DOM: main/login flow

### PZ-ED-053 · 버튼 시작점 화살표
- **동작·완료 범위:** 실제 선택/수집한 요소 rect를 미니맵에 투영하고 목적지 페이지 카드에 화살표를 연결한다.
- **검증:** DOM + screenshot: SVG geometry

### PZ-ED-054 · 흐름 문서 편집·SVG 저장
- **동작·완료 범위:** 수동 연결, 연결 삭제, 카드 이동, 확대/축소, SVG 내보내기를 제공한다. 수동 화살표가 href/onClick 코드를 자동 생성하지 않는다.
- **검증:** DOM graph; drag/export manual

## 코드·실행·검토

주요 구현: `app/editor/_core/browser-preview.ts; app/editor/_core/node-preview.ts; app/editor/_core/audit.ts`

### PZ-ED-055 · 코드 위치 열기
- **동작·완료 범위:** 선택 요소의 소스 파일을 코드 보기에서 연다.
- **검증:** DOM: source location

### PZ-ED-056 · 파일 검색·코드 수정·추가
- **동작·완료 범위:** 소스 파일 목록/검색/텍스트 편집/빈 파일 추가를 제공한다. 자동 rename/import refactoring은 미구현이다.
- **검증:** DOM: code edit; add manual

### PZ-ED-057 · 코드 저장 경쟁 검사
- **동작·완료 범위:** 코드 편집을 시작한 이후 원본이 바뀌면 저장을 거부하고 최신 파일 재확인을 요구한다.
- **검증:** Code/3-way unit

### PZ-ED-058 · 문법 검사
- **동작·완료 범위:** JS/TS/JSX/TSX 문법 문제를 수집하고 부적절한 코드를 적용하기 전 표시한다. 전체 프로젝트 타입 검사는 별도이다.
- **검증:** Node: syntax

### PZ-ED-059 · HTML 격리 런타임
- **동작·완료 범위:** 로컬 CSS/JS/이미지의 실행 복사본을 opaque iframe에 렌더링한다. 외부 script 및 실제 API 호출은 제한한다.
- **검증:** DOM + Node modulegraph

### PZ-ED-060 · 기본 React 격리 런타임
- **동작·완료 범위:** 내장 React/DOM과 로컬 모듈 graph를 실행해 useState/이벤트 UI를 렌더링한다. 모든 npm/React 버전을 재현하지 않는다.
- **검증:** DOM: React events

### PZ-ED-061 · Next UI 대체 런타임
- **동작·완료 범위:** 동기 UI와 제한된 navigation/link/image를 표시하며 서버 기능 미실행 경고를 노출한다.
- **검증:** DOM Next UI 결과 참조; SSR 아님

### PZ-ED-062 · WebContainer Node 경로
- **동작·완료 범위:** 실제 Vite/CRA/Next 개발 서버 설치·실행, source mount/update, process 정리 코드를 제공한다.
- **검증:** Typecheck only; actual boot/package/HMR 미검증

### PZ-ED-063 · 설치·재시작 제어
- **동작·완료 범위:** 신뢰 확인, ignore-scripts 설치, 제한시간·중지·다시 실행을 제공한다. 패키지/설정 변경 시 명시적 재시작을 요구한다.
- **검증:** Implementation; environment 미검증

### PZ-ED-064 · 브라우저 fetch/XHR Mock
- **동작·완료 범위:** method/path/status/body/delay에 따른 모의 응답과 요청 목록을 제공한다. Next 서버 내부 요청이나 모든 네트워크를 대체하지 않는다.
- **검증:** Bridge code; API integration manual

### PZ-ED-065 · 소스 diff·되돌리기
- **동작·완료 범위:** 기준 파일과 작업 파일의 전체 텍스트 차이/변경 목록, 파일별 되돌리기를 제공한다.
- **검증:** Node: changes; DOM review

### PZ-ED-066 · 검토 메모·상태
- **동작·완료 범위:** 화면별 메모 추가/해결을 meta에 저장한다. 실시간 커서/정교한 위치 댓글 도구가 아니다.
- **검증:** Meta validation/UI code

### PZ-ED-067 · 기초 사전 검사
- **동작·완료 범위:** 지원 스택/경로/문법/대표 비밀문자열/이미지 alt/라벨/작은 조작영역/누락 흐름 등을 표시한다. WCAG·보안·빌드 인증이 아니다.
- **검증:** Unit/typecheck; manual audit

## IDE·팀 동기화

주요 구현: `app/editor/_hooks/useWorkspaceSync.ts; app/editor/_core/sync.ts; tools/editor-agent/`

### PZ-ED-068 · IDE 저장 감지
- **동작·완료 범위:** 사용자가 선택한 root의 저장된 허용 파일 snapshot을 약 1.2초 간격으로 확인한다. IDE 미저장 버퍼는 대상이 아니다.
- **검증:** Agent real FS + hook mock

### PZ-ED-069 · IDE→작업본→렌더링
- **동작·완료 범위:** 새 source를 3-way 비교 후 작업본에 반영한다. 기본 런타임은 문서 재생성, Node 경로는 source write/HMR이다.
- **검증:** Hook + code→DOM separately; complete network E2E 미검증

### PZ-ED-070 · 디자인→실제 로컬 파일
- **동작·완료 범위:** 명시적 쓰기 허용 시 변경 파일만 CAS 기준으로 적용하고 이전 파일을 백업한다.
- **검증:** Real agent HTTP/FS tests

### PZ-ED-071 · echo loop 억제
- **동작·완료 범위:** 마지막 source snapshot/revision과 동일한 내용은 다시 쓰지 않는다.
- **검증:** Hook: no echo; agent CAS tests

### PZ-ED-072 · 동시 수정 충돌
- **동작·완료 범위:** 같은 파일이 양쪽에서 달라지면 자동 덮어쓰지 않고 충돌 선택을 기다린다. 다른 파일은 병합한다.
- **검증:** Core merge + hook conflict

### PZ-ED-073 · 원본 Git 정보·baseline 병합
- **동작·완료 범위:** 팀이 갱신한 Git provenance/baseline을 원본 묶음으로 비교한다. 동시 변경이면 @origin 충돌로 처리한다.
- **검증:** Merge unit + typecheck

### PZ-ED-074 · 프로젝트 연결 안전성
- **동작·완료 범위:** 최초 local root의 공통 경로를 확인하고 다른 팀 프로젝트를 열 때 이전 agent 연결을 중단한다. 완전 신원 인증은 아니다.
- **검증:** Hook lifecycle/guard

### PZ-ED-075 · 연결 해제·지연 응답 차단
- **동작·완료 범위:** generation 기준으로 disconnect 후 도착한 오래된 응답을 반영하지 않는다. 이미 서버가 받은 요청 취소를 보장하지는 않는다.
- **검증:** Hook: delayed response

### PZ-ED-076 · 권한 변경·토큰 오류
- **동작·완료 범위:** VIEWER는 쓰기하지 않고 401/403에서 자동 연결을 중단하며 로컬 작업을 보관한다.
- **검증:** Hook viewer; real agent token tests

### PZ-ED-077 · GitHub와 ZIP 공통 작업본
- **동작·완료 범위:** 입력 방식과 관계없이 같은 source/state/sync 구조를 사용한다. GitHub는 커밋, ZIP은 시점 복사본이며 별도 agent 없이 실시간 PC 감시하지 않는다.
- **검증:** Import unit + shared hook; live external env 미검증

### PZ-ED-078 · 브라우저 열린 동안 팀 중계
- **동작·완료 범위:** agent 연결 브라우저가 team head에 전달하고 다른 브라우저가 수신한다. 닫힌 브라우저/서버 독립 중계는 미구현이다.
- **검증:** Hook mock transport

## 공유 서버·DB·권한

주요 구현: `backend/src/main/java/com/interfacelab/backend/editorworkspace/; backend/src/main/resources/db/migration/`

### PZ-ED-079 · 기존 로그인·팀 재사용
- **동작·완료 범위:** 원래 세션과 프로젝트 멤버십을 재사용한다. 새로운 계정 시스템을 따로 만들지 않는다.
- **검증:** Existing code + integration test source; 실행 미검증

### PZ-ED-080 · 팀 프로젝트 게시·열기
- **동작·완료 범위:** 소스 업로드 동의 후 공유 workspace 생성/읽기를 연결한다.
- **검증:** Frontend hook mock; Spring 미검증

### PZ-ED-081 · EDITOR/VIEWER 초대 UI
- **동작·완료 범위:** 기존 초대 API로 대상 이메일·역할 토큰을 만들고 수락한다. 자동 메일 발송은 아니다.
- **검증:** UI/API code; live invitation 미검증

### PZ-ED-082 · schema/파일/meta 서버 검사
- **동작·완료 범위:** 허용 경로/개수/크기/base64/metadata 구조를 확인한다. 악성 JavaScript의 의미를 분석하는 기능이 아니다.
- **검증:** 18 Java standalone checks

### PZ-ED-083 · 보호 파일 서버 검사
- **동작·완료 범위:** EDITOR의 API·middleware·사용자 지정 보호 파일 변경과 보호 규칙 약화를 거부한다. OWNER의 명시적 작업은 별도이다.
- **검증:** Java authorization checks; DB path 미검증

### PZ-ED-084 · revision CAS·프로젝트 잠금
- **동작·완료 범위:** project row lock 아래 baseRevision 확인 후 head/history를 같은 transaction으로 갱신한다.
- **검증:** Service implementation; database concurrency 미검증

### PZ-ED-085 · command ID 중복 처리
- **동작·완료 범위:** 최근 20개 보존 history 범위에서 같은 요청 재시도는 재사용하고 다른 내용은 거부한다. 영구 dedup ledger가 아니다.
- **검증:** Service implementation; integration test 미실행

### PZ-ED-086 · head 조회 최적화
- **동작·완료 범위:** since가 일치하면 revision/시각만 조회하고 전체 JSON을 재전송하지 않는다.
- **검증:** Repository projection code; performance 미검증

### PZ-ED-087 · history REST·20개 보존
- **동작·완료 범위:** 서버 history 조회 endpoint 및 보존 제한을 제공한다. 서버 history 전용 복원 UI는 미구현이다.
- **검증:** Implementation; DB 미검증

### PZ-ED-088 · V4 추가 migration
- **동작·완료 범위:** workspace head/revisions만 추가하고 기존 테이블을 삭제하지 않는다. SQL은 자동 패치 도구에서 실행하지 않는다.
- **검증:** SQL source review; MySQL 실행 미검증

### PZ-ED-089 · Origin/custom-header 보호
- **동작·완료 범위:** workspace 변경 요청에 허용 origin 및 editor-v3 header를 검사한다. 기존 서비스 전체 보안 감사를 대신하지 않는다.
- **검증:** Filter code; Spring integration test 미실행

## GitHub·저장·복구·전달

주요 구현: `app/editor/_core/github.ts; app/editor/_core/storage.ts; scripts/apply-editor-patch.mjs`

### PZ-ED-090 · 이름 있는 로컬 버전
- **동작·완료 범위:** 현재 작업본/화면 상태를 이름 있는 snapshot으로 저장·열고 최대 20개를 보관한다.
- **검증:** DOM mock storage; native IDB 미검증

### PZ-ED-091 · GitHub 최신 변경 비교
- **동작·완료 범위:** 기준 커밋과 local/latest 파일을 3-way 비교하고 충돌은 사용자 선택으로 처리한다.
- **검증:** Core unit + REST mock

### PZ-ED-092 · 새 브랜치·초안 PR
- **동작·완료 범위:** polazu/ 새 브랜치에 source/자산/화면 메타데이터를 반영한다. main 직접 write/force/자동 merge 없음.
- **검증:** Node: mock REST; 실제 GitHub 미검증

### PZ-ED-093 · 실제 source ZIP
- **동작·완료 범위:** 원본 소스·실제 바이너리·최신 state/flow metadata를 내보내며 runtime 계측 속성은 제외한다.
- **검증:** DOM Blob/ZIP bytes + Node round-trip

### PZ-ED-094 · 변경 JSON 패치
- **동작·완료 범위:** before/after와 source provenance를 갖는 검토용 patch JSON을 제공한다. 자동 Git apply 파일과는 다르다.
- **검증:** Core/UI code

### PZ-ED-095 · 안전한 로컬 소스 이식
- **동작·완료 범위:** 실제 원본 SHA-256과 수정 payload를 검증한 뒤 기본 dry-run으로 실행한다. drift/손상/경로 오류에 중단한다.
- **검증:** 7 patch FS tests + final delivery reconstruction

### PZ-ED-096 · 백업·재적용
- **동작·완료 범위:** 적용 전 preimage/mode를 백업하고 이미 적용된 파일은 건너뛴다. npm·SQL·배포를 자동 실행하지 않는다.
- **검증:** Patch FS mode/no-op tests

### PZ-ED-097 · 검증 기록·미완료 명시
- **동작·완료 범위:** 실행 명령/로그/스크린샷/manifest와 blocked/미검증 조건을 파일로 전달한다.
- **검증:** See TEST_REPORT.md and verification/

## 주요 요청에 대한 판정

| 요청 | 판정 |
|---|---|
| 기존 화면 디자인 수정 → 실제 소스 | 구현·부분 검증. 정적/지원 속성 중심, 동적 표현식·반복 인스턴스에는 제한 |
| IDE 코드 저장 → 렌더링 | 실제 agent 파일/HTTP + sync hook + 코드→DOM 경로 각각 검증. 브라우저 보안 정책을 포함한 하나의 실환경 end-to-end는 미검증 |
| GitHub·ZIP 모두 팀 공유 | 동일 모델/공유 코드 구현. 실제 GitHub 인증·Spring/MySQL·다중기기 통합 미검증 |
| main 로그인 버튼 → login 화살표 | 구현, 실제 DOM 위치 미니맵/링크/화살표 확인. 스크린샷 카드나 모든 조건 분기 자동 발견은 아님 |
| 같은 URL의 탭·중첩 화면 각각 편집 | 클릭 상태 저장/복원/탭 내 문구 수정 검증. 모든 앱의 임의 내부 상태 복원은 아님 |
| React·Next·JS·TS·CSS·Tailwind·HTML만 | 스택 제한 구현. fallback과 Node 지원 차이 및 Next/Tailwind 실제 도구체인 미검증 구분 |
| 프론트·백엔드·SQL 및 안전 이식 | 실제 코드/추가 V4/안전 패치/설명 포함. 정식 build·Gradle/DB는 아래 보고서의 blocked 조건 해소 필요 |
| 앞선 모든 editor 후보 기능 완성 | **아님.** Figma/이미지→코드·전체 드로잉·임의 컴포넌트 동작 보존 교체·CRDT·완전 접근성/브라우저 인증 등 미구현 목록을 지원 매트릭스에 명시 |

위 표는 현재 전달본의 사실 상태다. 미검증을 구현 완료/통합 테스트 완료로 바꾸어 출시 문구에 사용하지 않는다.
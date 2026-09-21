# 지원 범위 — 구현 목표와 실제 검증은 다릅니다

## 기술 스택

| 유형 | 브라우저 UI 모드 | Node/WebContainer 모드 | 이번 검증 |
|---|---|---|---|
| HTML + CSS + 기본 JS | 로컬 자산·스크립트 인라인, 격리 실행, 실제 HTML 패치 | 단순 static server 어댑터 | HTML 샘플 DOM/소스/탭/흐름 테스트 통과 |
| React JS/TS + JSX/TSX | 내장 React/DOM, 상대경로·기본 alias, 이벤트/useState | Vite/react-scripts 프로젝트 실행 경로 | 기본 React DOM 테스트 통과. 모든 React 버전 검증 아님 |
| Next App Router / Pages Router | 정적/동기 UI와 제한된 link/image/navigation 대체. 서버 의미 재현 아님 | 실제 next dev 어댑터, Next 16+는 webpack 실행 | Next 템플릿 동기 UI/페이지 이동 DOM 검사 통과. 실제 설치·SSR·서버 액션 실행은 미검증 |
| 일반 CSS | 원본 CSS 및 인라인·관리 stylesheet 편집 | 실제 도구체인 | 반응형 CSS 적용/렌더 확인 |
| CSS Modules | 클래스 이름 그대로 대체하는 근사 미리보기. 실제 격리 아님 | 실제 프로젝트 빌드 | 경고·분기 코드 검사, 임의 모듈 조합 미검증 |
| Tailwind CSS | 기존에 빌드된 CSS가 있을 때 사용. utility compiler 아님 | 프로젝트의 Tailwind 빌드 사용 | className 소스 편집 가능; 실제 Tailwind 버전/빌드 통합 미검증 |
| 외부 React 라이브러리 | React/Next 제한 목록 외에는 Node 모드 안내 | 패키지/네이티브 의존성에 따라 조건부 | 임의 npm 패키지 지원 보증 없음 |
| Vue/Svelte/Nuxt/Angular/Astro 등 | 지원 대상에서 제외 | 지원 대상에서 제외 | 스택 거부 규칙 테스트 |
| Java/Spring/Python/Docker/DB 서버 | 사용자 프로젝트 실행 대상으로 지원하지 않음 | WebContainer 내부에서 실행하지 않음 | POLAZU의 자체 Spring 서버와는 별개 |

React·Next 버전은 프로젝트 의존성에 종속됩니다. 기본 브라우저 fallback은 전달된 단일 React runtime을 사용하므로 다른 React 버전의 모든 차이를 그대로 재현하지 못합니다. Node 모드의 실제 프로젝트 의존성으로 확인하세요. pnpm/yarn lock을 가져올 수는 있으나 Node 실행 설치기는 npm 기반이며 workspace protocol·사설 registry·설치 스크립트 의존 패키지는 별도 검토가 필요합니다.

TypeScript transpile은 타입 검사 통과를 의미하지 않습니다. 편집기 검사 UI는 문법·일부 기본 규칙이고, 실제 고객 프로젝트의 빌드/테스트/접근성 검토를 대체하지 않습니다.

## 브라우저/운영체제

| 기능 | 요구/설계 | 검증 상태 |
|---|---|---|
| 에디터 기본 UI·opaque iframe | 최신 desktop 브라우저, JS·iframe 허용 | Linux Chromium 144의 오프라인 컴포넌트 테스트 |
| 실제 IndexedDB 저장 | 브라우저 저장 허용/용량 | 코드 포함, 현재 테스트는 메모리 어댑터이므로 네이티브 IDB 동작 미검증 |
| ZIP 가져오기·내보내기 | File/Blob/Web APIs | ZIP 바이트 round-trip 검증, browser download policy 미검증 |
| 폴더 선택 | directory input 지원 필요 | 미지원 브라우저는 ZIP 대안; OS별 폴더 UI 미검증 |
| WebContainer | COOP/COEP, crossOriginIsolated, SharedArrayBuffer, 서비스워커/네트워크 | 기능 검사/오류 안내 코드. 실제 브라우저별 실행 미검증 |
| IDE 에이전트 | Node 22+, loopback HTTP, 정확한 Origin/토큰 | Linux 실제 파일/HTTP 테스트. Windows/macOS 네이티브 실기기 미검증 |
| 브라우저→IDE 연결 | 로컬 네트워크 정책·허용·혼합 콘텐츠 조건 | 프로토콜 테스트, 실제 보안 정책 연결 미검증 |
| 팀 공유 | Spring/MySQL/세션 쿠키/CORS | 공유 hook mock 테스트 및 Java 규칙 테스트, 실제 서버/DB 미검증 |
| 모바일 편집 | 작은 화면에서는 패널 공간 제한 | desktop 중심. 모바일 반응형 **결과물 미리보기**와 모바일에서 **에디터 사용**은 구분 |

운영체제/브라우저를 UA 문자열만으로 ‘지원’ 판정하지 않습니다. 기능 검사를 통과한 실행 경로만 사용하고 실패 원인을 사용자에게 보여주는 방식입니다. Chrome/Edge/Safari/Firefox/Windows/macOS/Linux 전체 인증을 받았다고 표시하지 않습니다.

## 주요 한계/미구현

1. Figma API 원본 가져오기, 스크린샷→프로덕션 코드 AI 변환, 자유 벡터 드로잉/전체 Figma급 도구: 미구현. 빈 페이지·기본 요소 생성 및 기존 코드의 시각 편집만 포함합니다.
2. 임의 React 컴포넌트를 다른 npm 컴포넌트로 교체하면서 모든 props/ref/상태/폼 동작을 자동 보존: 미구현. 현재는 기존 요소의 디자인·허용 속성·스타일 프리셋 변경이며 이벤트 소스를 건드리지 않습니다.
3. 모든 조건부 화면/탭 자동 발견, 임의 Redux/Zustand/라우터 내부 상태 저장: 미구현. DOM 탭 탐지 및 명시적인 클릭 순서 저장/재생 방식입니다.
4. DOM 구조 변경·동적 문구 변경 후 저장한 클릭 순서의 자동 복구 보증: 없음. 대상이 사라지거나 의미가 달라지면 상태를 다시 기록합니다.
5. 스크린샷과 동일한 화면 전체가 들어간 플로우 카드: 미구현. 실제 요소의 위치 기반 미니맵과 화살표를 제공합니다.
6. 파일 내 문자 단위 CRDT/OT, 실시간 커서·선택 공유·소스 자동 의미 병합: 미구현. 파일 단위 3-way merge와 명시적 충돌 결정입니다.
7. 브라우저를 닫아도 지속되는 IDE→팀 백그라운드 중계, GitHub 미커밋 자동 감지: 미구현. 원격 repo는 커밋 가져오기, 미커밋 저장은 별도 agent입니다.
8. 사용자 OS의 모든 파일을 브라우저만으로 자동 감시: 불가한 것으로 설계. 명시적으로 선택한 에이전트 root만 허용합니다.
9. 자동 배포/운영 DB/인증/결제 완성, 백엔드 업무 규칙 편집: 범위 제외. GitHub 초안 PR과 코드 내보내기까지입니다.
10. 전체 WCAG 검사, E2E 녹화 생성·성능 인증, 모든 API 부작용 차단: 미구현/미보증. 제한된 사전 검사/Mock을 제공합니다.
11. 서버 revision 시각적 복구 UI, 조직별 대용량 quota/결제/장기 감사 보존: 미구현. 로컬 snapshot UI 및 서버 history REST/20개 보존 코드까지입니다.
12. 코드 파일 rename 자동 import 수정·파일 이동 refactoring UI: 미구현. 파일 추가/코드 수정과 제한된 노드 추가/복제/삭제, 실제 IDE 수정 후 동기화 경로를 사용합니다.
13. GitHub 팀원의 OAuth 위임·토큰 서버 vault, 자동 초대 메일: 미구현. 개인 메모리 토큰/기존 로그인과 초대 토큰을 사용합니다.
14. 기존 `/editor/ui` 저장 UI 화면은 보존했으나 새 에디터 저장소로 자동 변환하는 migration은 없습니다. 기존 작업은 먼저 원래 경로에서 내보내고 새 에디터에 가져와 검토합니다.
15. 0원 운영 보증: 없음. 공유 DB·트래픽·WebContainer 상용 라이선스 등 실제 운영 조건을 검토해야 합니다.

## 자료

공식 설계 참고 문서이며, 문서가 제공된다고 이 전달본을 해당 환경에서 실제 검증했다는 뜻은 아닙니다.
- WebContainer API: https://webcontainers.io/api
- 실행 환경/브라우저 안내: https://webcontainers.io/guides/browser-support
- WebContainer 상용 조건: https://webcontainers.io/enterprise
- React 상태 유지: https://react.dev/learn/preserving-and-resetting-state
- Node 파일 시스템: https://nodejs.org/api/fs.html
- GitHub Git tree API: https://docs.github.com/en/rest/git/trees
- Chrome 로컬 네트워크 접근: https://developer.chrome.com/blog/local-network-access

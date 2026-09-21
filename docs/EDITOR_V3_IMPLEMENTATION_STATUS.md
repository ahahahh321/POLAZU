# Editor V3 구현 상태

## 완료

| 기능 | 상태 | 구현 위치 | 설명 |
|---|---|---|---|
| 전체 화면 에디터 shell | 완료 | `page.tsx`, `page.css` | 일반 서비스 Header를 제거하고 편집기에 화면 전체 할당 |
| 프로젝트·브랜치 상단 바 | 완료 | `DesignerToolbar.tsx` | 프로젝트 이동, branch, Design/Preview, route 표시 |
| 자동 저장 상태 | 완료 | `BrowserProjectRuntime.tsx` | 1.4초 debounce, 즉시 동기화 버튼, Saved/Autosaving/View only 구분 |
| Publish 분리 | 완료 | `DesignerToolbar.tsx`, `WorkspaceDock.tsx` | 저장과 분리된 Git drawer 진입 |
| 협업·리뷰 drawer | 완료 | `WorkspaceDock.tsx` | Team/Review/Git을 상단에서 필요할 때 열기 |
| 실제 접속자 presence | 완료 | `page.tsx`, `DesignerToolbar.tsx` | 서버 snapshot의 접속자 이름으로 avatar와 인원 표시 |
| 수직 캔버스 도구막대 | 완료 | `DesignerToolbar.tsx` | Select, Hand, Frame, Text, Rectangle, Image, Comment |
| 선택 컨텍스트 바 | 완료 | `DesignerToolbar.tsx` | 정렬, 분배, 순서, 복제, 삭제 |
| 캔버스 보기 독 | 완료 | `DesignerToolbar.tsx` | viewport, compare, ruler, grid, snap, zoom, fit selection/canvas |
| 좌측 앱 레일 | 완료 | `DesignerSidebar.tsx` | Layers, Insert, Tokens, Pages, Files |
| 탭별 컨텍스트 헤더 | 완료 | `DesignerSidebar.tsx` | objects/primitives/variables/routes/files 수량 표시 |
| UI primitive 24개 | 완료 | `DesignerSidebar.tsx`, `editor-bridge.js` | Link를 포함한 24개 기본 요소 |
| 클릭 삽입 | 완료 | 기존 command 경로 | 선택 컨테이너에 삽입 |
| 위치 기반 드래그 삽입 | 완료(코드) | Sidebar, Runtime, Bridge | drop 지점의 가장 가까운 안전 컨테이너에 삽입 |
| Fit selection | 완료 | `BrowserProjectRuntime.tsx` | 단축키 2와 command palette |
| inspector 저장 오해 제거 | 완료 | `DesignerInspector.tsx` | Live preview 표시, 저장 CTA 제거 |
| 실제 Chromium 화면 캡처 | 완료 | `docs/screenshots/` | 1600×1000, Insert, 1366×768, 전후 비교 |
| 1366px 문서 overflow 방지 | 완료 | `page.css` | DOM 실측 기준 문서 overflow 없음 |

## 부분 완료

| 기능 | 상태 | 제한 |
|---|---|---|
| React/Next 시각 편집 | 부분 | 정적 source mapping과 안전한 patch 범위만 자동 반영 |
| drag insert | 부분 검증 | source/bridge contract는 통과했으나 전체 Next/WebContainer pointer E2E는 미검증 |
| 자동 저장 | 부분 검증 | 코드·타입 contract 통과, 실제 다중 계정 서버 저장 E2E는 미검증 |
| 레이어 순서 변경 | 부분 | UI command는 있으나 모든 JSX 구조를 안전하게 재작성하지 않음 |
| 복합 primitive | 부분 | Modal/Tabs 등은 구조를 생성하지만 앱 상태·비즈니스 로직을 자동 설계하지 않음 |
| 접근성 audit | 부분 | 정적 근사 검사이며 스크린리더·키보드 전체 흐름을 보증하지 않음 |

## 미구현

- 프로젝트 고유 React 컴포넌트 자동 발견 및 Insert 라이브러리화
- component props, slot, variant, instance override 편집
- Tailwind utility 의미 단위의 시각 편집과 충돌 해결
- 이미지 파일 업로드, crop, focal point, 팀 자산 라이브러리
- 그룹/해제와 안전한 코드 컨테이너 변환
- 문자 단위 CRDT/OT
- 모션 타임라인과 상태 머신
- 페이지 흐름도에서 실제 버튼 위치 기반 연결선 편집
- Monaco/CodeMirror LSP와 다중 파일 visual diff

## 미검증

- Linux 환경의 정식 Next.js dev/build
- 실제 로그인·백엔드·DB·WebContainer 통합 E2E
- 두 계정 공동 편집과 역할 회수
- 실제 GitHub push/PR
- Firefox/Safari 및 모바일 터치 환경

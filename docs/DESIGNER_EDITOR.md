# 디자이너 에디터 가이드

작성일: 2026-09-21
구현 버전: POLAZU Workspace 0.2.0

## 1. 설계 목표

이 에디터는 별도의 그림 파일을 만드는 도구가 아니라 **실제 HTML·JSX·TSX·CSS 소스와 연결된 시각 편집 작업 공간**입니다. 캔버스, 레이어, 속성, 코드 패널을 분리하고 DOM 요소를 원본 위치에 연결하는 방식은 Onlook의 공개 문서와 Apache-2.0 오픈소스 구조를 개념적으로 참고했지만, POLAZU의 서버 workspace·revision·권한·Git 게시 흐름에 맞게 새로 구현했습니다. Onlook 소스 파일을 복사하지 않았습니다.

핵심 원칙:

1. Preview에서만 보이는 가짜 변경을 서버 저장 성공으로 표시하지 않습니다.
2. 소스 위치가 연결된 정적 JSX/TSX/HTML만 안전한 범위에서 최소 수정합니다.
3. 동적 `className`, 복합 React children, 형제 재배치처럼 안전성을 보장하기 어려운 변경은 경고하고 소스를 무리하게 재작성하지 않습니다.
4. 브라우저 localStorage는 복구 캐시이고, 공유 작업의 기준은 서버 workspace입니다.
5. 디자인 저장과 Git commit/push/PR은 서로 다른 단계입니다.

## 2. 화면 구성

### 상단 바

- Design / Preview 모드 전환
- Undo / Redo
- 내부 페이지 경로 이동
- Wide / Desktop / Tablet / Mobile viewport
- 세 화면 나란히 비교
- 눈금자, 가이드, 격자, 스냅
- 20~200% 확대·축소, 100%, 캔버스 맞춤
- 명령 검색 `Ctrl/Cmd + K`
- 단축키 도움말 `?`
- 서버 공동 작업 초안 저장 `Ctrl/Cmd + S`

### 캔버스 도구

| 도구 | 키 | 동작 |
|---|---:|---|
| 선택 | V | 단일·Shift/Ctrl/Cmd 다중 선택 |
| 손 | H | 캔버스 이동 |
| 프레임 | F | 선택 컨테이너에 Flex frame 삽입 |
| 텍스트 | T | 텍스트 삽입 |
| 사각형 | R | 기본 shape 삽입 |
| 이미지 | I | 교체 가능한 이미지 placeholder 삽입 |
| 댓글 위치 | C | 선택한 요소 위치를 검토 컨텍스트로 전달 |

선택 요소에는 8방향 resize handle과 이동 label이 표시됩니다. 여러 요소를 선택한 상태에서 주 선택 요소의 label을 드래그하면 선택 요소들이 함께 이동합니다. 방향키는 1px, Shift+방향키는 10px 이동합니다. Resize와 이동은 격자 스냅을 적용할 수 있습니다.

### 왼쪽 패널

#### Layers

- DOM 기반 레이어 트리
- 검색
- 소스 연결 여부 표시
- 단일·다중 선택
- 가시성 전환
- 편집 잠금
- 더블 클릭 별칭 변경
- 부모 깊이 표시

가시성은 CSS 변경으로 저장할 수 있습니다. 잠금과 별칭은 현재 편집 세션의 조작 보조 메타데이터이며 원본 코드 속성으로 저장하지 않습니다.

#### Insert

실제 HTML/JSX snippet으로 삽입할 수 있는 항목:

- Layout: Frame, Card, Navigation, Divider
- Content: Heading, Text, Image, Avatar, Badge, Rectangle
- Forms: Button, Input, Textarea, Select, Checkbox, Switch
- Data/Feedback: List, Table, Tabs, Accordion, Modal, Toast, Skeleton

Tabs, Modal, Switch 같은 항목은 접근 가능한 **정적 구조와 기본 상태**를 생성합니다. 삽입 직후 root 요소의 문구·스타일·속성·반응형 값을 바꾸면 첫 저장 시 삽입 HTML/JSX snippet에 합쳐집니다. 삽입 직후 복제·삭제도 같은 저장 action에 정리됩니다. 완성된 앱 상태 로직이나 이벤트 핸들러를 자동 생성했다고 간주하지 않습니다.

#### Tokens

프로젝트 CSS 파일에서 `--custom-property` 선언을 검색해 다음 범주로 표시합니다.

- Colors
- Spacing & size
- Typography
- Radius
- Effects
- Other

값을 수정하면 해당 CSS 선언 한 곳만 서버 workspace에 저장합니다. 위험한 CSS 값과 300자를 넘는 값은 거부합니다. 동일 이름 토큰이 여러 selector에 있을 경우 occurrence별로 구분합니다.

#### Pages / Files

- 감지한 route 이동
- 프로젝트 파일 검색
- 선택 파일을 코드 패널에서 열기
- Next.js UI compatibility / original server beta 전환

저장되지 않은 디자인 변경이 있으면 프로젝트 root 변경을 막아 복구 캐시로만 남는 실수를 방지합니다.

### 오른쪽 패널

#### Design inspector

- Base / Desktop / Tablet / Mobile 재정의
- Position, z-index, width/height, min/max
- Display, overflow
- Flex direction/wrap/justify/align
- Grid columns/rows
- gap, row gap, column gap
- padding/margin 4방향 및 shorthand
- Text, font, weight, size, line-height, tracking, alignment, wrapping
- Text/background color picker와 CSS 값
- gradient/background image, opacity, blend mode
- border, radius, shadow, filter
- 이미지 src, alt, object-fit, object-position, aspect-ratio
- 링크, target, rel
- title, placeholder, ARIA label

Desktop/Tablet/Mobile에서는 CSS 스타일만 재정의합니다. 문구, 링크, `src`, alt, ARIA 속성은 Base에서만 편집할 수 있도록 UI와 저장 로직을 함께 제한했습니다.

#### Code

- 선택 요소의 원본 파일로 이동
- 파일 선택
- 줄 번호
- 코드 직접 수정
- 4MiB 파일 제한
- 서버 workspace 저장

현재 코드 입력기는 syntax highlight/LSP가 없는 textarea입니다.

#### Mock

브라우저 preview의 `fetch`/XHR에만 적용되는 클라이언트 mock입니다. 실제 서버 API를 실행하거나 변경하지 않습니다.

#### Audit

현재 페이지에서 자동 점검하는 항목:

- 이미지 alt 누락
- 깨진 이미지 자산
- 버튼·링크 accessible name
- 폼 label
- 중복 id
- 부모 너비 overflow
- 포커스 스타일 수동 확인 안내
- 24×24px 미만 상호작용 영역
- 텍스트 대비 근사치

대비는 computed color와 가장 가까운 불투명 배경을 이용한 근사 검사입니다. 배경 이미지, 복합 투명도, 실제 스크린리더·키보드 경험은 수동 확인이 필요합니다.

## 3. 소스 반영 방식

### React / Next.js UI compatibility

Vite/Babel 변환 단계에서 lowercase intrinsic JSX 요소에 다음 형식의 정보를 삽입합니다.

```text
data-polazu-source="/app/page.tsx:12:6"
```

저장 시 이 위치를 기준으로 원본 요소를 다시 찾고 다음 변경을 최소 범위로 적용합니다.

- 정적 leaf text
- 안전한 HTML/ARIA 속성
- inline React style 병합
- 정적 `className`에 반응형 식별 class 추가
- 요소 삽입
- 요소 복제
- 요소 삭제

동적 React expression을 임의로 문자열로 바꾸지 않습니다. 소스가 저장 과정에서 달라져 위치를 다시 찾지 못하면 해당 편집을 건너뛰고 경고합니다.

### HTML

route에 대응하는 HTML을 DOMParser로 읽고 selector를 다시 찾아 text, attribute, inline style, insert, duplicate, delete를 적용합니다. serialization 과정에서 HTML formatting이 바뀔 수 있으므로 저장 전 Review JSON과 Git diff를 확인하는 것을 권장합니다.

### 반응형

- Desktop: `min-width: 1024px`
- Tablet: `640px ~ 1023px`
- Mobile: `max-width: 639px`

소스 연결된 요소에는 안정적인 `polazu-r-*` class를 추가하고 전역 CSS 파일의 다음 관리 영역에 규칙을 생성합니다.

```css
/* POLAZU_RESPONSIVE_START */
/* generated media rules */
/* POLAZU_RESPONSIVE_END */
```

동적 `className`은 자동 결합하지 않고 DOM selector fallback과 경고를 사용합니다.

## 4. 직접 조작과 이력

- 이동·resize·정렬·균등 분배 결과는 edit action으로 기록합니다.
- Inspector의 아직 기록하지 않은 값을 가진 상태에서 다른 요소, breakpoint, route, Preview 모드로 이동하면 먼저 현재 편집을 이력에 기록합니다.
- Undo는 현재 사용자의 browser edit history만 되돌립니다. style뿐 아니라 preview에서 바꾼 `src`, `href`, alt, ARIA 등 허용 속성도 replay 전에 원래 값으로 복구합니다.
- 서버 저장 후 history는 초기화되고 새로운 project revision을 기준으로 다시 실행합니다.
- 브라우저가 닫히거나 저장에 실패하면 edit action을 localStorage 복구 캐시에 보관합니다.
- 다른 사용자의 최신 server revision을 강제로 되돌리는 협업 undo는 구현하지 않았습니다.

## 5. 단축키

| 단축키 | 동작 |
|---|---|
| Ctrl/Cmd+S | 디자인 저장 |
| Ctrl/Cmd+K | 명령 검색 |
| Ctrl/Cmd+Z | Undo |
| Shift+Ctrl/Cmd+Z | Redo |
| Ctrl/Cmd+D | 복제 |
| Ctrl/Cmd+C / V | 소스 안전 복사 / 같은 레벨에 붙여넣기(duplicate) |
| Delete / Backspace | 삭제 |
| 방향키 | 1px 이동 |
| Shift+방향키 | 10px 이동 |
| V, H, F, T, R, I, C | 도구 전환 |
| G | 격자 |
| Shift+R | 눈금자 |
| 0 | 캔버스 맞춤 |
| 1 | 100% |
| + / - | 확대·축소 |
| Esc | 선택 해제 / dialog 닫기 |
| ? | 도움말 |

## 6. 현재 제한

- 문자 단위 CRDT/OT가 아닌 project revision 기반 공동 작업입니다.
- 형제 순서 변경은 preview에서 확인되지만 안전한 source reorder는 아직 저장하지 않습니다. copy/paste는 임의 컨테이너로 옮기지 않고 원본과 같은 레벨에 duplicate합니다.
- 그룹/해제, component instance/variant/slot, prop editor는 미구현입니다.
- Tailwind class를 의미 단위로 재구성하지 않고 inline style 또는 생성 CSS를 사용합니다.
- 동적 `className`, 복합 children, render loop 안 개별 인스턴스 수정은 제한적입니다.
- image src/alt/fit/focus는 지원하지만 binary 업로드, crop bitmap 생성, asset library는 미구현입니다.
- component primitive는 정적 구조입니다. 상태 로직·API 연결·인증을 자동 구현하지 않습니다.
- 레이어 잠금과 별칭은 session metadata이며 팀 공유 metadata가 아닙니다.
- 코드 syntax highlight, LSP, 다중 파일 diff, visual merge UI는 미구현입니다.
- 페이지 흐름도, 같은 URL의 tab/modal state capture, 모션 timeline은 미구현입니다.
- Audit는 보조 검사이며 WCAG 적합성을 보증하지 않습니다.

## 7. 관련 파일

- `app/editor/_components/BrowserProjectRuntime.tsx`
- `app/editor/_components/designer/DesignerToolbar.tsx`
- `app/editor/_components/designer/DesignerSidebar.tsx`
- `app/editor/_components/designer/DesignerInspector.tsx`
- `app/editor/_components/designer/DesignerDialogs.tsx`
- `app/editor/_lib/source-patcher.ts`
- `app/editor/_lib/design-tokens.ts`
- `app/editor/_lib/next-ui.ts`
- `public/editor-bridge.js`
- `app/editor/page.css`
- `scripts/designer-editor.test.cjs`

# Editor V3 HANDOFF

## 현재 체크포인트

기준 소스: `POLAZU-designer-workspace-2026-09-21.zip`

이번 체크포인트는 에디터 shell과 핵심 디자인 흐름을 V3로 교체했다. 백엔드 Java와 Flyway migration은 변경하지 않았다.

## 가장 중요한 변경

1. editor page를 집중형 전체 화면으로 변경
2. 상단 바를 프로젝트·모드·협업·Publish 중심으로 재설계
3. 저장 CTA를 autosave 상태로 변경
4. 캔버스 도구, 선택 도구, 보기 설정을 세 계층으로 분리
5. Insert primitive를 24개로 정리하고 drag-to-canvas 지원
6. Review/Team/Git을 요청형 workspace drawer로 연결
7. 선택 요소 맞춤과 compact viewport 레이아웃 추가

## 실제 검증 명령

```bash
npm run typecheck
npm run check:syntax
npm run test:adapters
npm run test:designer
```

모두 통과했다. 자세한 내용은 `EDITOR_V3_TEST_REPORT.md`를 확인한다.

## 재개 우선순위

### P0 — 실제 브라우저 통합 검증

Linux SWC가 있는 환경에서 다음을 실행한다.

```bash
npm ci
npm run dev
```

그 뒤 실제 프로젝트로 다음 시나리오를 확인한다.

1. Insert → Button을 hero section에 드래그
2. 캔버스에 즉시 표시되는지 확인
3. source patch가 생성되는지 확인
4. 1.4초 후 서버 revision이 증가하는지 확인
5. 다른 브라우저에서 변경이 도착하는지 확인
6. Undo가 자신의 변경만 되돌리는지 확인

### P1 — Project Components

가져온 프로젝트의 export와 props를 분석하여 `Project Components` 섹션을 추가한다. 기본 24개 primitive보다 이 기능이 제품 가치에 더 중요하다.

필수 범위:

- 안전하게 식별 가능한 React component export
- import 경로와 실제 사용처
- primitive/string/boolean/enum props
- variant/size/state 선택
- project component 인스턴스 삽입
- 원본 컴포넌트 수정과 인스턴스 override 구분

### P2 — Tailwind와 구조 안전성

- 정적 Tailwind class parse
- class 충돌 감지
- breakpoint override 시 기존 convention 사용
- 형제 reorder의 AST patch
- dynamic className에서는 명시적으로 code mode 안내

## 알려진 제한

- 렌더 스크린샷의 중앙 페이지는 결정론적 mock 프로젝트다.
- 실제 editor shell은 실제 React 컴포넌트와 CSS를 Chromium으로 렌더했다.
- 전체 Next runtime과 backend session을 사용한 화면 캡처는 아니다.
- drag insert contract는 구현·정적 검증됐지만 전체 pointer E2E는 남아 있다.

## 패키징 시 제외

- `.git`
- `.render`
- `node_modules`
- `.next`
- `tsconfig.tsbuildinfo`
- 실제 `.env`
- 브라우저 cache

# Editor V3 안전 패치 적용

패치는 기준 파일 `POLAZU-designer-workspace-2026-09-21.zip`과 동일한 소스에 적용하는 것을 전제로 한다.

## 1. 상태 확인

```bash
git status
git switch -c feat/polazu-editor-v3
```

로컬 변경이 있다면 먼저 commit 또는 stash한다.

## 2. 적용 가능 여부만 검사

```bash
git apply --check POLAZU-editor-v3-safe.patch
```

실패하면 강제로 적용하지 않는다. 충돌 파일을 별도 branch에서 수동 병합한다.

## 3. 적용

```bash
git apply POLAZU-editor-v3-safe.patch
```

## 4. 검증

```bash
npm ci
npm run typecheck
npm run check:syntax
npm run test:adapters
npm run test:designer
npm run build
```

정식 build는 현재 OS용 Next.js SWC 패키지가 설치되어 있어야 한다.

## 5. 되돌리기

아직 commit 전이라면:

```bash
git restore .
git clean -fd
```

작업 branch를 commit했다면 적용 전 commit으로 revert 또는 reset한다. 다른 로컬 변경과 섞여 있다면 `git clean -fd`를 사용하지 않는다.

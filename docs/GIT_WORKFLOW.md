# Git 버전 교환

## 원칙

POLAZU 내부 실시간 편집과 개발자 IDE 사이를 자동 폴더 동기화하지 않습니다. 서버 작업 공간은 공동 초안이고, 외부 IDE와의 교환 단위는 원격 Git 브랜치·커밋·PR입니다.

## GitHub 프로젝트 가져오기

1. URL은 정확한 `https://github.com/owner/repository`만 허용합니다.
2. 비공개 저장소 토큰은 import 요청에만 사용합니다.
3. metadata에서 default branch와 head commit을 확인합니다.
4. archive를 내려받아 ZIP 보안 검사 후 서버 workspace에 저장합니다.
5. `repository_owner/name/url`, `default_branch`, `base_commit`을 기록합니다.
6. 가져온 원본은 revision 0이며 Git 기준과 일치하므로 `published_revision=0`입니다.

## ZIP 프로젝트

- revision 0 작업 공간은 사용할 수 있지만 Git 게시 상태는 `published_revision=-1`입니다.
- 저장소 연결 전에는 내부 버전, revision 비교, ZIP export만 제공합니다.
- 기존 GitHub 저장소 연결은 OWNER가 명시적으로 URL/기준 branch/선택적 commit SHA를 저장합니다.
- 새 GitHub 저장소를 자동 생성하지 않습니다.

## 웹 → Git 게시

1. UI가 현재 server revision을 source revision으로 보냅니다.
2. DB transaction에서 프로젝트 row를 잠그고 현재 revision이 바뀌지 않았는지 확인합니다.
3. 마지막 published revision 이후 path 목록을 고정하고 `git_operation=STARTED`를 기록합니다.
4. GitHub 기준 branch head가 `base_commit`과 같은지 확인합니다. 다르면 `REMOTE_ADVANCED`로 중단합니다.
5. 새 remote branch가 존재하지 않는지 확인합니다.
6. 변경 파일 blob, base tree 기반 tree, commit을 만듭니다.
7. 새 `refs/heads/<branch>`를 생성합니다.
8. 선택한 경우 draft PR을 생성합니다.
9. 성공한 고정 revision만 `published_revision`으로 기록합니다. 게시 중 추가된 후속 revision은 미게시로 남습니다.

부분 성공:

- commit과 branch push 후 PR 실패: `COMMIT_PUSHED_PR_FAILED`
- commit SHA와 오류를 남기고 같은 변경을 미게시라고 표시하지 않음
- 사용자는 생성된 branch를 GitHub에서 확인하고 PR을 수동 생성할 수 있음

## Git → 웹

1. 원격 check로 선택 branch head를 읽습니다.
2. UI는 check와 apply를 별도 버튼으로 제공합니다.
3. apply 요청에 확인했던 exact commit SHA를 전달합니다.
4. 서버가 archive를 다시 가져온 뒤 SHA가 여전히 같은지 검증합니다.
5. 웹 미게시 변경이 있으면 내부 버전 보존을 명시해야 합니다.
6. 원격 snapshot diff를 새 `REMOTE_APPLY` revision으로 저장합니다.
7. base commit, branch, published revision을 갱신합니다.

## 충돌 정책

- 기준 branch 선행: 자동 merge하지 않고 원격 적용 요구
- 웹 revision 변경: 게시 대상 다시 검토
- 원격이 check 후 다시 변경: apply 중단
- 동일 branch 존재: 새 이름 요구
- main/master/base 직접 게시: 거부
- retry: idempotency key가 같은 publish는 기존 operation 반환

## GitHub API 범위

사용 API는 repository metadata/archive와 Git Data API(blob/tree/commit/ref), Pull Request API입니다. 실제 OAuth/GitHub App 연결 UI는 아직 없으므로 토큰을 매 요청에 입력합니다.

# API 요약

기본 URL: `http://127.0.0.1:8080`. 모든 project API는 `POLAZU_SESSION` 쿠키가 필요합니다. 오류 형식은 `{ code, message, details?, timestamp }`입니다.

## 인증

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/auth/signup` | 계정 생성 및 세션 발급 |
| POST | `/api/auth/login` | 로그인 및 세션 발급 |
| POST | `/api/auth/logout` | 현재 세션 삭제 |
| GET | `/api/auth/me` | 현재 사용자 |

## 프로젝트

| Method | Path | 권한/설명 |
|---|---|---|
| GET | `/api/projects/limits` | 공개 제한값 |
| GET | `/api/projects?status=&query=` | 멤버 프로젝트 목록 |
| POST | `/api/projects` | 빈 HTML 프로젝트 |
| POST | `/api/projects/import/github` | 공개/비공개 GitHub 저장소 영구 가져오기 |
| POST | `/api/projects/import/zip` | ZIP 영구 가져오기 |
| GET | `/api/projects/{id}` | 상세 |
| PATCH | `/api/projects/{id}` | OWNER 이름 변경 |
| POST | `/api/projects/{id}/status` | OWNER ACTIVE/ARCHIVED/DELETED |
| DELETE | `/api/projects/{id}` | OWNER soft delete |
| POST | `/api/projects/{id}/repository` | OWNER 기존 GitHub 저장소 연결 |

호환용 `/api/editor/import/github`는 공개 저장소를 preview 응답으로만 반환하며 프로젝트에 영구 저장하지 않습니다.

## 작업 공간

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/projects/{id}/workspace` | 파일, binary base64, revision, presence |
| POST | `/api/projects/{id}/workspace/changes?kind=CODE` | OWNER/EDITOR 파일 변경 저장 |
| GET | `/api/projects/{id}/workspace/revisions` | revision 요약 |
| GET | `/api/projects/{id}/workspace/events` | SSE |
| POST | `/api/projects/{id}/workspace/presence` | 현재 작업 위치 heartbeat |
| GET | `/api/projects/{id}/export.zip` | 현재 작업 공간 ZIP |

변경 요청 예:

```json
{
  "baseRevision": 12,
  "clientMutationId": "99ebf5df-...",
  "summary": "로그인 버튼 간격 변경",
  "changes": [
    { "path": "/app/login/page.tsx", "content": "...", "binaryBase64": null, "delete": false }
  ]
}
```

동일 `clientMutationId` 재전송은 기존 revision 결과를 반환합니다. 다른 사용자가 먼저 저장했다면 409 `REVISION_CONFLICT`와 현재 revision을 반환합니다.

## 내부 버전

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/projects/{id}/versions` | 내부 버전 목록 |
| POST | `/api/projects/{id}/versions` | 현재 revision 전체 스냅샷 |
| POST | `/api/projects/{id}/versions/{versionId}/restore` | 새 revision으로 복원 |

## 팀·댓글

| Method | Path | 설명 |
|---|---|---|
| GET/POST | `/api/projects/{id}/members` | 목록/OWNER 추가 |
| PATCH/DELETE | `/api/projects/{id}/members/{userId}` | OWNER 역할 변경/제거 |
| GET/POST | `/api/projects/{id}/comments` | 댓글 목록/추가 |
| PATCH | `/api/projects/{id}/comments/{commentId}` | OPEN/RESOLVED |

## Git

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/projects/{id}/git/remote/check` | branch head 확인 |
| POST | `/api/projects/{id}/git/remote/apply` | 확인 SHA snapshot을 새 revision으로 적용 |
| POST | `/api/projects/{id}/git/publish` | 고정 revision을 새 branch로 commit/push/선택적 PR |
| GET | `/api/projects/{id}/git/operations` | 최근 50개 작업 상태 |

토큰 필드는 요청에만 사용되고 응답/DB에 저장하지 않습니다.

package com.interfacelab.backend.git;

import com.interfacelab.backend.common.PolazuException;
import com.interfacelab.backend.project.ProjectAccessService;
import com.interfacelab.backend.project.ProjectDtos;
import com.interfacelab.backend.project.WorkspaceService;
import com.interfacelab.backend.auth.AuthenticatedUser;
import com.interfacelab.backend.projectimport.GitHubImportService;
import com.interfacelab.backend.projectimport.ImportedProjectResponse;
import com.interfacelab.backend.project.WorkspacePath;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * GitHub Git Data API를 사용해 서버 작업 공간의 특정 revision을 새 원격 브랜치로 게시합니다.
 * 토큰은 요청 처리 중에만 메모리에 존재하며 DB 또는 로그에 저장하지 않습니다.
 */
@Service
public class GitHubPublishService {
    private static final Pattern SAFE_BRANCH = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._/-]{0,119}");
    private static final int MAX_JSON_BYTES = 2 * 1024 * 1024;
    private static final int MAX_PUBLISH_FILES = 2_500;

    private final JdbcTemplate jdbc;
    private final ProjectAccessService accessService;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactions;
    private final GitHubImportService importService;
    private final WorkspaceService workspaceService;
    private final HttpClient httpClient;

    public GitHubPublishService(
            JdbcTemplate jdbc,
            ProjectAccessService accessService,
            ObjectMapper objectMapper,
            TransactionTemplate transactions,
            GitHubImportService importService,
            WorkspaceService workspaceService
    ) {
        this.jdbc = jdbc;
        this.accessService = accessService;
        this.objectMapper = objectMapper;
        this.transactions = transactions;
        this.importService = importService;
        this.workspaceService = workspaceService;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .followRedirects(HttpClient.Redirect.NEVER)
                .build();
    }

    public GitDtos.RemoteStatus checkRemote(String projectId, long userId, GitDtos.RemoteCheckRequest request) {
        ProjectAccessService.Access access = accessService.requireRead(projectId, userId);
        Repository repository = requireRepository(access);
        String branch = normalizeBranch(request == null ? null : request.branch(), access.defaultBranch());
        String token = requireToken(request == null ? null : request.accessToken());
        String remoteHead = readBranchHead(repository, branch, token);
        String configured = access.baseCommit();
        return new GitDtos.RemoteStatus(
                access.repositoryUrl(), branch, configured, remoteHead,
                configured != null && !configured.equalsIgnoreCase(remoteHead),
                access.currentRevision(), access.publishedRevision(),
                Math.max(0, access.currentRevision() - access.publishedRevision()),
                access.lastRemoteCommit()
        );
    }

    public GitDtos.PublishResult publish(String projectId, long userId, GitDtos.PublishRequest request) {
        validatePublishRequest(request);
        String token = requireToken(request.accessToken());
        String idempotencyKey = normalizeMutationId(request.idempotencyKey());

        GitDtos.PublishResult prior = findOperation(projectId, idempotencyKey);
        if (prior != null) return prior;

        PublishSnapshot snapshot;
        try {
            snapshot = transactions.execute(status -> freeze(projectId, userId, request, idempotencyKey));
        } catch (DuplicateKeyException duplicate) {
            GitDtos.PublishResult existing = findOperation(projectId, idempotencyKey);
            if (existing != null) return existing;
            throw duplicate;
        }
        if (snapshot == null) throw new IllegalStateException("Publish snapshot was not created");

        String commitSha = null;
        String pullRequestUrl = null;
        try {
            String remoteBaseHead = readBranchHead(snapshot.repository(), snapshot.baseBranch(), token);
            if (snapshot.configuredBaseCommit() != null
                    && !snapshot.configuredBaseCommit().equalsIgnoreCase(remoteBaseHead)) {
                throw new PolazuException(
                        "REMOTE_ADVANCED",
                        "원격 기준 브랜치가 프로젝트를 가져온 뒤 변경되었습니다. 먼저 원격 최신 버전을 확인하고 작업 공간에 적용해 주세요.",
                        HttpStatus.CONFLICT,
                        Map.of("configuredBaseCommit", snapshot.configuredBaseCommit(), "remoteHeadCommit", remoteBaseHead)
                );
            }

            ensureBranchDoesNotExist(snapshot.repository(), snapshot.remoteBranch(), token);
            String parentCommit = snapshot.lastPublishedCommit() == null ? remoteBaseHead : snapshot.lastPublishedCommit();
            String baseTree = readCommitTree(snapshot.repository(), parentCommit, token);

            List<Map<String, Object>> treeEntries = new ArrayList<>();
            for (PublishFile file : snapshot.files()) {
                if (file.deleted()) {
                    Map<String, Object> deletion = new LinkedHashMap<>();
                    deletion.put("path", stripLeadingSlash(file.path()));
                    deletion.put("mode", "100644");
                    deletion.put("type", "blob");
                    deletion.put("sha", null);
                    treeEntries.add(deletion);
                } else {
                    String blobSha = createBlob(snapshot.repository(), file, token);
                    treeEntries.add(Map.of(
                            "path", stripLeadingSlash(file.path()),
                            "mode", "100644",
                            "type", "blob",
                            "sha", blobSha
                    ));
                }
            }
            String treeSha = createTree(snapshot.repository(), baseTree, treeEntries, token);
            commitSha = createCommit(snapshot.repository(), request.commitMessage().trim(), treeSha, parentCommit, token);
            createBranch(snapshot.repository(), snapshot.remoteBranch(), commitSha, token);
            markCommitPushed(snapshot.operationId(), commitSha);

            if (request.createPullRequest()) {
                try {
                    pullRequestUrl = createDraftPullRequest(
                            snapshot.repository(), snapshot.baseBranch(), snapshot.remoteBranch(),
                            normalizeOptional(request.pullRequestTitle(), request.commitMessage().trim(), 256),
                            normalizeOptional(request.pullRequestBody(), "POLAZU 서버 작업 공간 revision " + snapshot.sourceRevision() + "에서 게시했습니다.", 20_000),
                            token
                    );
                } catch (PolazuException prFailure) {
                    markPartial(snapshot, commitSha, prFailure.code(), prFailure.getMessage());
                    return withPaths(findOperationById(snapshot.operationId()), snapshot.paths());
                }
            }

            complete(snapshot, commitSha, pullRequestUrl);
            return withPaths(findOperationById(snapshot.operationId()), snapshot.paths());
        } catch (PolazuException exception) {
            if (commitSha == null) markFailed(snapshot.operationId(), exception.code(), exception.getMessage());
            throw exception;
        } catch (RuntimeException exception) {
            if (commitSha == null) markFailed(snapshot.operationId(), "GITHUB_PUBLISH_FAILED", safeMessage(exception));
            throw new PolazuException("GITHUB_PUBLISH_FAILED", "GitHub 게시 중 예기치 않은 오류가 발생했습니다.", HttpStatus.BAD_GATEWAY);
        }
    }


    public GitDtos.RemoteApplyResult applyRemote(
            String projectId,
            AuthenticatedUser user,
            GitDtos.RemoteApplyRequest request
    ) {
        if (request == null) throw new PolazuException("INVALID_REQUEST", "원격 적용 요청이 필요합니다.", HttpStatus.BAD_REQUEST);
        ProjectAccessService.Access access = accessService.requireWrite(projectId, user.id());
        requireRepository(access);
        String token = requireToken(request.accessToken());
        String branch = normalizeBranch(request.branch(), access.defaultBranch());
        String mutationId = normalizeMutationId(request.clientMutationId());
        String expected = request.expectedCommit() == null ? "" : request.expectedCommit().trim();
        if (!expected.matches("[a-fA-F0-9]{40,64}")) {
            throw new PolazuException("EXPECTED_COMMIT_REQUIRED", "확인한 원격 commit SHA를 함께 전달해 주세요.", HttpStatus.BAD_REQUEST);
        }
        if (access.currentRevision() > access.publishedRevision() && !request.preserveUnpublishedAsVersion()) {
            throw new PolazuException(
                    "UNPUBLISHED_CHANGES_EXIST",
                    "웹 미게시 변경이 있습니다. 내부 버전으로 보존한 뒤 원격 버전을 적용하도록 선택해 주세요.",
                    HttpStatus.CONFLICT,
                    Map.of("currentRevision", access.currentRevision(), "publishedRevision", access.publishedRevision())
            );
        }

        ImportedProjectResponse imported = importService.importRepository(access.repositoryUrl(), branch, token);
        if (!expected.equalsIgnoreCase(imported.baseCommit())) {
            throw new PolazuException(
                    "REMOTE_CHANGED_DURING_APPLY",
                    "원격 확인 후 커밋이 다시 변경되었습니다. 최신 커밋을 다시 확인해 주세요.",
                    HttpStatus.CONFLICT,
                    Map.of("expectedCommit", expected, "actualCommit", imported.baseCommit())
            );
        }

        String versionId = null;
        if (access.currentRevision() > access.publishedRevision()) {
            var version = workspaceService.createVersion(
                    projectId, user,
                    "Before remote " + imported.baseCommit().substring(0, 8),
                    "원격 " + branch + " 적용 전 미게시 웹 변경 보존"
            );
            versionId = version.id();
        }
        ProjectDtos.ChangeResult result = workspaceService.applyRemoteSnapshot(
                projectId, user, access.currentRevision(), imported.files(), imported.binaryFiles(),
                imported.baseCommit(), branch, mutationId
        );
        return new GitDtos.RemoteApplyResult(result.revision(), imported.baseCommit(), branch, result.changedPaths().size(), versionId);
    }

    public List<GitDtos.GitOperationSummary> operations(String projectId, long userId) {
        accessService.requireRead(projectId, userId);
        return jdbc.query("""
                SELECT id, operation_type, status, source_revision, base_branch, remote_branch,
                       commit_sha, pull_request_url, error_code, error_message, created_at, updated_at
                FROM git_operation WHERE project_id = ? ORDER BY created_at DESC LIMIT 50
                """, GitHubPublishService::mapSummary, projectId);
    }

    private PublishSnapshot freeze(
            String projectId,
            long userId,
            GitDtos.PublishRequest request,
            String idempotencyKey
    ) {
        ProjectAccessService.Access access = accessService.requireWrite(projectId, userId);
        Repository repository = requireRepository(access);
        LockedProject locked = jdbc.query("""
                SELECT current_revision, published_revision, base_commit, last_remote_commit, default_branch
                FROM project WHERE id = ? FOR UPDATE
                """, rs -> {
            if (!rs.next()) return null;
            return new LockedProject(
                    rs.getLong("current_revision"), rs.getLong("published_revision"),
                    rs.getString("base_commit"), rs.getString("last_remote_commit"), rs.getString("default_branch")
            );
        }, projectId);
        if (locked == null) throw new PolazuException("PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.", HttpStatus.NOT_FOUND);
        if (request.sourceRevision() != locked.currentRevision()) {
            throw new PolazuException(
                    "PUBLISH_REVISION_CHANGED",
                    "게시하려던 revision과 현재 작업 공간 revision이 다릅니다. 변경 파일을 다시 검토해 주세요.",
                    HttpStatus.CONFLICT,
                    Map.of("requestedRevision", request.sourceRevision(), "currentRevision", locked.currentRevision())
            );
        }
        if (locked.currentRevision() <= locked.publishedRevision()) {
            throw new PolazuException("NO_UNPUBLISHED_CHANGES", "게시할 미게시 변경사항이 없습니다.", HttpStatus.CONFLICT);
        }

        String baseBranch = normalizeBranch(request.baseBranch(), locked.defaultBranch());
        String remoteBranch = normalizeBranch(request.remoteBranch(), null);
        if (remoteBranch.equals(baseBranch) || remoteBranch.equalsIgnoreCase("main") || remoteBranch.equalsIgnoreCase("master")) {
            throw new PolazuException("PROTECTED_BRANCH", "main, master 또는 기준 브랜치에 직접 게시할 수 없습니다. 새 작업 브랜치를 사용해 주세요.", HttpStatus.BAD_REQUEST);
        }

        Set<String> changedPaths = new LinkedHashSet<>();
        if (locked.publishedRevision() < 0) {
            jdbc.query("SELECT path FROM workspace_file WHERE project_id = ? AND branch_name = ? ORDER BY path", rs -> { changedPaths.add(rs.getString(1)); }, projectId, access.workspaceBranch());
        } else {
            jdbc.query("""
                    SELECT DISTINCT c.path
                    FROM workspace_revision_change c
                    JOIN workspace_revision r ON r.id = c.revision_id
                    WHERE r.project_id = ? AND r.branch_name = ? AND r.revision_no > ? AND r.revision_no <= ?
                    ORDER BY c.path
                    """, rs -> { changedPaths.add(rs.getString(1)); }, projectId, access.workspaceBranch(), locked.publishedRevision(), locked.currentRevision());
        }
        if (changedPaths.isEmpty()) {
            throw new PolazuException("NO_UNPUBLISHED_CHANGES", "게시할 변경 파일을 찾지 못했습니다.", HttpStatus.CONFLICT);
        }
        if (changedPaths.size() > MAX_PUBLISH_FILES) {
            throw new PolazuException("PUBLISH_FILE_LIMIT", "한 번에 게시할 수 있는 파일 수 2,500개를 초과했습니다.", HttpStatus.PAYLOAD_TOO_LARGE);
        }

        Map<String, PublishFile> current = new LinkedHashMap<>();
        jdbc.query("""
                SELECT path, text_content, binary_content, is_binary
                FROM workspace_file WHERE project_id = ? AND branch_name = ?
                """, rs -> {
            String path = rs.getString("path");
            if (changedPaths.contains(path)) {
                boolean binary = rs.getBoolean("is_binary");
                current.put(path, new PublishFile(path, false, binary,
                        binary ? rs.getBytes("binary_content") : rs.getString("text_content").getBytes(StandardCharsets.UTF_8)));
            }
        }, projectId, access.workspaceBranch());

        List<PublishFile> files = new ArrayList<>();
        for (String path : changedPaths) files.add(current.getOrDefault(path, new PublishFile(path, true, false, new byte[0])));
        String operationId = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO git_operation(
                    id, project_id, idempotency_key, operation_type, status, source_revision,
                    repository_url, base_branch, remote_branch
                ) VALUES (?, ?, ?, 'PUBLISH', 'STARTED', ?, ?, ?, ?)
                """, operationId, projectId, idempotencyKey, locked.currentRevision(), access.repositoryUrl(), baseBranch, remoteBranch);

        return new PublishSnapshot(
                operationId, projectId, locked.currentRevision(), repository, baseBranch, remoteBranch,
                locked.baseCommit(), locked.lastRemoteCommit(), List.copyOf(files), List.copyOf(changedPaths)
        );
    }

    private String createBlob(Repository repository, PublishFile file, String token) {
        Map<String, Object> body = file.binary()
                ? Map.of("content", Base64.getEncoder().encodeToString(file.bytes()), "encoding", "base64")
                : Map.of("content", new String(file.bytes(), StandardCharsets.UTF_8), "encoding", "utf-8");
        JsonNode response = requestJson("POST", api(repository, "/git/blobs"), token, body, 201);
        return requireSha(response.path("sha").asText());
    }

    private String createTree(Repository repository, String baseTree, List<Map<String, Object>> entries, String token) {
        JsonNode response = requestJson("POST", api(repository, "/git/trees"), token,
                Map.of("base_tree", baseTree, "tree", entries), 201);
        return requireSha(response.path("sha").asText());
    }

    private String createCommit(Repository repository, String message, String treeSha, String parent, String token) {
        JsonNode response = requestJson("POST", api(repository, "/git/commits"), token,
                Map.of("message", message, "tree", treeSha, "parents", List.of(parent)), 201);
        return requireSha(response.path("sha").asText());
    }

    private void createBranch(Repository repository, String branch, String commitSha, String token) {
        requestJson("POST", api(repository, "/git/refs"), token,
                Map.of("ref", "refs/heads/" + branch, "sha", commitSha), 201);
    }

    private String createDraftPullRequest(
            Repository repository,
            String base,
            String head,
            String title,
            String body,
            String token
    ) {
        JsonNode response = requestJson("POST", api(repository, "/pulls"), token,
                Map.of("title", title, "body", body, "head", head, "base", base, "draft", true), 201);
        String url = response.path("html_url").asText();
        if (url.isBlank()) throw githubError("PULL_REQUEST_RESPONSE_INVALID", "PR은 생성되었을 수 있지만 결과 URL을 확인하지 못했습니다.", 502);
        return url;
    }

    private String readBranchHead(Repository repository, String branch, String token) {
        JsonNode response = requestJson("GET", api(repository, "/git/ref/heads/" + encodePath(branch)), token, null, 200);
        return requireSha(response.path("object").path("sha").asText());
    }

    private String readCommitTree(Repository repository, String commitSha, String token) {
        JsonNode response = requestJson("GET", api(repository, "/git/commits/" + requireSha(commitSha)), token, null, 200);
        return requireSha(response.path("tree").path("sha").asText());
    }

    private void ensureBranchDoesNotExist(Repository repository, String branch, String token) {
        HttpResult result = rawRequest("GET", api(repository, "/git/ref/heads/" + encodePath(branch)), token, null);
        if (result.status() == 404) return;
        if (result.status() == 200) {
            throw new PolazuException("REMOTE_BRANCH_EXISTS", "같은 이름의 원격 브랜치가 이미 존재합니다. 새 브랜치 이름을 사용해 주세요.", HttpStatus.CONFLICT);
        }
        throw mapGitHubFailure(result.status(), result.body());
    }

    private JsonNode requestJson(String method, URI uri, String token, Object body, int expectedStatus) {
        HttpResult result = rawRequest(method, uri, token, body);
        if (result.status() != expectedStatus) throw mapGitHubFailure(result.status(), result.body());
        try {
            return objectMapper.readTree(result.body());
        } catch (JacksonException exception) {
            throw githubError("GITHUB_RESPONSE_INVALID", "GitHub 응답을 해석하지 못했습니다.", 502);
        }
    }

    private HttpResult rawRequest(String method, URI uri, String token, Object body) {
        HttpRequest.BodyPublisher publisher;
        try {
            publisher = body == null
                    ? HttpRequest.BodyPublishers.noBody()
                    : HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body), StandardCharsets.UTF_8);
        } catch (JacksonException exception) {
            throw new IllegalStateException("Git request serialization failed", exception);
        }
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(30))
                .header("Accept", "application/vnd.github+json")
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + token)
                .header("User-Agent", "polazu-workspace")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .method(method, publisher);
        try {
            HttpResponse<byte[]> response = httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
            byte[] bytes = response.body() == null ? new byte[0] : response.body();
            if (bytes.length > MAX_JSON_BYTES) throw githubError("GITHUB_RESPONSE_TOO_LARGE", "GitHub 응답이 허용 크기를 초과했습니다.", 502);
            return new HttpResult(response.statusCode(), new String(bytes, StandardCharsets.UTF_8));
        } catch (IOException exception) {
            throw githubError("GITHUB_NETWORK_ERROR", "GitHub에 연결하지 못했습니다.", 502);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw githubError("GITHUB_NETWORK_INTERRUPTED", "GitHub 요청이 중단되었습니다.", 503);
        }
    }

    private PolazuException mapGitHubFailure(int status, String body) {
        String providerMessage = "";
        try { providerMessage = objectMapper.readTree(body).path("message").asText(""); }
        catch (JacksonException ignored) {}
        String suffix = providerMessage.isBlank() ? "" : " (GitHub: " + providerMessage.substring(0, Math.min(180, providerMessage.length())) + ")";
        return switch (status) {
            case 401 -> githubError("GITHUB_TOKEN_INVALID", "GitHub 토큰이 유효하지 않습니다." + suffix, 401);
            case 403 -> githubError("GITHUB_PERMISSION_DENIED", "GitHub API 권한이 부족하거나 호출 한도를 초과했습니다." + suffix, 403);
            case 404 -> githubError("GITHUB_RESOURCE_NOT_FOUND", "저장소, 브랜치 또는 커밋을 찾지 못했습니다." + suffix, 404);
            case 409, 422 -> githubError("GITHUB_CONFLICT", "GitHub에서 브랜치 또는 커밋 충돌을 반환했습니다." + suffix, 409);
            default -> githubError("GITHUB_API_ERROR", "GitHub API 요청에 실패했습니다." + suffix, 502);
        };
    }

    private void markCommitPushed(String operationId, String commitSha) {
        jdbc.update("UPDATE git_operation SET status = 'COMMIT_PUSHED', commit_sha = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?", commitSha, operationId);
    }

    private void markPartial(PublishSnapshot snapshot, String commitSha, String code, String message) {
        jdbc.update("""
                UPDATE git_operation SET status = 'COMMIT_PUSHED_PR_FAILED', commit_sha = ?, error_code = ?, error_message = ?,
                    updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?
                """, commitSha, code, truncate(message, 1000), snapshot.operationId());
        jdbc.update("""
                UPDATE project SET published_revision = ?, last_remote_commit = ?, updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ? AND published_revision < ?
                """, snapshot.sourceRevision(), commitSha, snapshot.projectId(), snapshot.sourceRevision());
    }

    private void complete(PublishSnapshot snapshot, String commitSha, String pullRequestUrl) {
        transactions.executeWithoutResult(status -> {
            jdbc.update("""
                    UPDATE git_operation SET status = 'COMPLETED', commit_sha = ?, pull_request_url = ?,
                        error_code = NULL, error_message = NULL, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?
                    """, commitSha, pullRequestUrl, snapshot.operationId());
            jdbc.update("""
                    UPDATE project SET published_revision = ?, last_remote_commit = ?, updated_at = CURRENT_TIMESTAMP(6)
                    WHERE id = ? AND published_revision < ?
                    """, snapshot.sourceRevision(), commitSha, snapshot.projectId(), snapshot.sourceRevision());
        });
    }

    private void markFailed(String operationId, String code, String message) {
        jdbc.update("""
                UPDATE git_operation SET status = 'FAILED', error_code = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ? AND status = 'STARTED'
                """, code, truncate(message, 1000), operationId);
    }

    private GitDtos.PublishResult findOperation(String projectId, String idempotencyKey) {
        return jdbc.query("""
                SELECT id, status, source_revision, base_branch, remote_branch, commit_sha, pull_request_url,
                       error_code, error_message, created_at, updated_at
                FROM git_operation WHERE project_id = ? AND idempotency_key = ?
                """, rs -> rs.next() ? mapResult(rs, List.of()) : null, projectId, idempotencyKey);
    }

    private GitDtos.PublishResult findOperationById(String operationId) {
        return jdbc.query("""
                SELECT id, status, source_revision, base_branch, remote_branch, commit_sha, pull_request_url,
                       error_code, error_message, created_at, updated_at
                FROM git_operation WHERE id = ?
                """, rs -> {
            if (!rs.next()) throw new IllegalStateException("Git operation disappeared");
            return mapResult(rs, List.of());
        }, operationId);
    }

    private static GitDtos.PublishResult withPaths(GitDtos.PublishResult result, List<String> paths) {
        return new GitDtos.PublishResult(
                result.operationId(), result.status(), result.sourceRevision(), result.baseBranch(), result.remoteBranch(),
                result.commitSha(), result.pullRequestUrl(), result.errorCode(), result.errorMessage(),
                List.copyOf(paths), result.createdAt(), result.updatedAt()
        );
    }

    private static GitDtos.PublishResult mapResult(ResultSet rs, List<String> paths) throws SQLException {
        return new GitDtos.PublishResult(
                rs.getString("id"), rs.getString("status"), rs.getLong("source_revision"), rs.getString("base_branch"),
                rs.getString("remote_branch"), rs.getString("commit_sha"), rs.getString("pull_request_url"),
                rs.getString("error_code"), rs.getString("error_message"), paths,
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant()
        );
    }

    private static GitDtos.GitOperationSummary mapSummary(ResultSet rs, int rowNum) throws SQLException {
        return new GitDtos.GitOperationSummary(
                rs.getString("id"), rs.getString("operation_type"), rs.getString("status"), rs.getLong("source_revision"),
                rs.getString("base_branch"), rs.getString("remote_branch"), rs.getString("commit_sha"),
                rs.getString("pull_request_url"), rs.getString("error_code"), rs.getString("error_message"),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant()
        );
    }

    private static Repository requireRepository(ProjectAccessService.Access access) {
        if (access.repositoryOwner() == null || access.repositoryName() == null || access.repositoryUrl() == null) {
            throw new PolazuException("REPOSITORY_NOT_CONNECTED", "먼저 프로젝트에 GitHub 저장소를 연결해 주세요.", HttpStatus.CONFLICT);
        }
        return new Repository(access.repositoryOwner(), access.repositoryName());
    }

    private static void validatePublishRequest(GitDtos.PublishRequest request) {
        if (request == null) throw new PolazuException("INVALID_REQUEST", "게시 요청이 필요합니다.", HttpStatus.BAD_REQUEST);
        if (request.sourceRevision() < 0) throw new PolazuException("INVALID_REVISION", "게시 revision이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);
        String message = request.commitMessage() == null ? "" : request.commitMessage().trim();
        if (message.length() < 3 || message.length() > 500) {
            throw new PolazuException("INVALID_COMMIT_MESSAGE", "커밋 메시지는 3~500자로 입력해 주세요.", HttpStatus.BAD_REQUEST);
        }
    }

    private static String requireToken(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.length() < 20 || value.length() > 500 || value.chars().anyMatch(Character::isWhitespace)) {
            throw new PolazuException("GITHUB_TOKEN_REQUIRED", "이번 요청에 사용할 GitHub 토큰을 입력해 주세요. 토큰은 저장되지 않습니다.", HttpStatus.BAD_REQUEST);
        }
        return value;
    }

    private static String normalizeMutationId(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty() || value.length() > 100 || value.chars().anyMatch(Character::isISOControl)) {
            throw new PolazuException("INVALID_IDEMPOTENCY_KEY", "idempotencyKey를 1~100자로 전달해 주세요.", HttpStatus.BAD_REQUEST);
        }
        return value;
    }

    private static String normalizeBranch(String raw, String fallback) {
        String value = raw == null || raw.isBlank() ? fallback : raw.trim();
        if (value == null || !SAFE_BRANCH.matcher(value).matches() || value.contains("..") || value.contains("//")
                || value.endsWith("/") || value.endsWith(".") || value.endsWith(".lock") || value.startsWith("-")
                || value.contains("@{") || value.chars().anyMatch(Character::isWhitespace)) {
            throw new PolazuException("INVALID_BRANCH", "브랜치 이름 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);
        }
        return value;
    }

    private static String normalizeOptional(String raw, String fallback, int max) {
        String value = raw == null ? "" : raw.trim();
        if (value.isBlank()) value = fallback;
        return truncate(value, max);
    }

    private static URI api(Repository repository, String suffix) {
        return URI.create("https://api.github.com/repos/" + repository.owner() + "/" + repository.name() + suffix);
    }

    private static String encodePath(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20");
    }

    private static String requireSha(String value) {
        if (value == null || !value.matches("[a-fA-F0-9]{40,64}")) {
            throw githubError("GITHUB_RESPONSE_INVALID", "GitHub 커밋 식별자를 확인하지 못했습니다.", 502);
        }
        return value;
    }

    private static String stripLeadingSlash(String path) {
        String normalized = WorkspacePath.normalize(path);
        return normalized.startsWith("/") ? normalized.substring(1) : normalized;
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static String safeMessage(RuntimeException exception) {
        String message = exception.getMessage();
        return message == null || message.isBlank() ? exception.getClass().getSimpleName() : truncate(message, 500);
    }

    private static PolazuException githubError(String code, String message, int status) {
        return new PolazuException(code, message, HttpStatus.valueOf(status));
    }

    private record Repository(String owner, String name) {}
    private record HttpResult(int status, String body) {}
    private record LockedProject(long currentRevision, long publishedRevision, String baseCommit, String lastRemoteCommit, String defaultBranch) {}
    private record PublishFile(String path, boolean deleted, boolean binary, byte[] bytes) {}
    private record PublishSnapshot(
            String operationId,
            String projectId,
            long sourceRevision,
            Repository repository,
            String baseBranch,
            String remoteBranch,
            String configuredBaseCommit,
            String lastPublishedCommit,
            List<PublishFile> files,
            List<String> paths
    ) {}
}

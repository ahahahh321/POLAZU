package com.interfacelab.backend.project;

import com.interfacelab.backend.auth.AuthenticatedUser;
import com.interfacelab.backend.common.PolazuException;
import com.interfacelab.backend.projectimport.GitHubImportService;
import com.interfacelab.backend.projectimport.ImportedProjectResponse;
import com.interfacelab.backend.projectimport.RepositoryArchiveReader;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ProjectService {
    private final JdbcTemplate jdbc;
    private final ProjectAccessService accessService;
    private final GitHubImportService githubImportService;
    private final RepositoryArchiveReader archiveReader;

    public ProjectService(
            JdbcTemplate jdbc,
            ProjectAccessService accessService,
            GitHubImportService githubImportService,
            RepositoryArchiveReader archiveReader
    ) {
        this.jdbc = jdbc;
        this.accessService = accessService;
        this.githubImportService = githubImportService;
        this.archiveReader = archiveReader;
    }

    public List<ProjectDtos.ProjectSummary> list(long userId, String query, String requestedStatus) {
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String status = normalizeListStatus(requestedStatus);
        List<Object> args = new ArrayList<>();
        StringBuilder sql = new StringBuilder("""
                SELECT p.id, p.name, p.source_type, p.repository_url, p.workspace_branch, p.base_commit,
                       p.framework, p.status, p.current_revision, p.published_revision, p.storage_bytes,
                       p.updated_at, pm.role,
                       (SELECT COUNT(*) FROM workspace_file wf WHERE wf.project_id = p.id AND wf.branch_name = p.workspace_branch) AS file_count
                FROM project p
                JOIN project_member pm ON pm.project_id = p.id
                WHERE pm.user_id = ?
                """);
        args.add(userId);
        if (status == null) sql.append(" AND p.status <> 'DELETED'");
        else { sql.append(" AND p.status = ?"); args.add(status); }
        if (!normalizedQuery.isBlank()) {
            sql.append(" AND (LOWER(p.name) LIKE ? OR LOWER(COALESCE(p.repository_url,'')) LIKE ?)");
            String like = "%" + normalizedQuery.replace("%", "\\%").replace("_", "\\_") + "%";
            args.add(like); args.add(like);
        }
        sql.append(" ORDER BY p.updated_at DESC");
        return jdbc.query(sql.toString(), ProjectService::mapSummary, args.toArray());
    }

    public ProjectDtos.ProjectDetails details(String projectId, long userId) {
        return ProjectAccessService.toDetails(accessService.requireRead(projectId, userId));
    }

    @Transactional
    public ProjectDtos.ProjectDetails importGitHub(
            AuthenticatedUser user,
            String repositoryUrl,
            String ref,
            String accessToken,
            String requestedName
    ) {
        ImportedProjectResponse imported = githubImportService.importRepository(repositoryUrl, ref, accessToken);
        String name = normalizeName(requestedName == null || requestedName.isBlank()
                ? imported.source().repository() : requestedName);
        return createFromImport(user, imported, name, accessToken == null || accessToken.isBlank() ? "GITHUB_PUBLIC" : "GITHUB_PRIVATE");
    }

    @Transactional
    public ProjectDtos.ProjectDetails importZip(AuthenticatedUser user, MultipartFile upload, String requestedName) {
        if (upload == null || upload.isEmpty()) {
            throw new PolazuException("ZIP_REQUIRED", "가져올 ZIP 파일을 선택해 주세요.", HttpStatus.BAD_REQUEST);
        }
        if (upload.getSize() > 64L * 1024 * 1024) {
            throw new PolazuException("ZIP_UPLOAD_LIMIT_EXCEEDED", "ZIP 업로드는 64MiB를 초과할 수 없습니다.", HttpStatus.PAYLOAD_TOO_LARGE);
        }
        byte[] bytes;
        try { bytes = upload.getBytes(); }
        catch (java.io.IOException exception) {
            throw new PolazuException("ZIP_READ_FAILED", "ZIP 파일을 읽지 못했습니다.", HttpStatus.BAD_REQUEST);
        }
        RepositoryArchiveReader.ArchiveContent content = archiveReader.read(bytes);
        String original = upload.getOriginalFilename() == null ? "ZIP project" : upload.getOriginalFilename().replaceFirst("(?i)\\.zip$", "");
        String name = normalizeName(requestedName == null || requestedName.isBlank() ? original : requestedName);
        String framework = detectFramework(content.files());
        ImportedProjectResponse imported = new ImportedProjectResponse(
                new ImportedProjectResponse.RepositorySource("Local", name, "workspace", ""),
                framework,
                content.files(),
                Map.of(),
                content.skippedFileCount(),
                content.binaryFiles(),
                null
        );
        return createFromImport(user, imported, name, "ZIP");
    }

    @Transactional
    public ProjectDtos.ProjectDetails createEmpty(AuthenticatedUser user, String requestedName) {
        String name = normalizeName(requestedName);
        ImportedProjectResponse imported = new ImportedProjectResponse(
                new ImportedProjectResponse.RepositorySource("POLAZU", name, "workspace", ""),
                "HTML",
                Map.of("/index.html", """
                        <!doctype html>
                        <html lang="ko">
                        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New POLAZU project</title></head>
                        <body><main><h1>새 프로젝트</h1><p>POLAZU에서 화면과 코드를 함께 편집하세요.</p></main></body>
                        </html>
                        """),
                Map.of(), 0, Map.of(), null
        );
        return createFromImport(user, imported, name, "EMPTY");
    }

    @Transactional
    public ProjectDtos.ProjectDetails rename(String projectId, long userId, String requestedName) {
        ProjectAccessService.Access access = accessService.requireManage(projectId, userId);
        String name = normalizeName(requestedName);
        jdbc.update("UPDATE project SET name = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?", name, projectId);
        return ProjectAccessService.toDetails(new ProjectAccessService.Access(
                access.id(), access.ownerUserId(), name, access.sourceType(), access.repositoryOwner(), access.repositoryName(),
                access.repositoryUrl(), access.defaultBranch(), access.workspaceBranch(), access.baseCommit(), access.lastRemoteCommit(),
                access.framework(), access.skippedFileCount(), access.status(), access.currentRevision(), access.publishedRevision(),
                access.storageBytes(), access.role(), access.createdAt(), Instant.now()
        ));
    }

    @Transactional
    public ProjectDtos.ProjectDetails setStatus(String projectId, long userId, String requestedStatus) {
        ProjectAccessService.Access access = accessService.requireManageIncludingDeleted(projectId, userId);
        String status = requestedStatus == null ? "" : requestedStatus.trim().toUpperCase(Locale.ROOT);
        if (!List.of("ACTIVE", "ARCHIVED", "DELETED").contains(status)) {
            throw new PolazuException("INVALID_PROJECT_STATUS", "프로젝트 상태는 ACTIVE, ARCHIVED, DELETED 중 하나여야 합니다.", HttpStatus.BAD_REQUEST);
        }
        String archivedSql = "ARCHIVED".equals(status) ? "CURRENT_TIMESTAMP(6)" : "NULL";
        String deletedSql = "DELETED".equals(status) ? "CURRENT_TIMESTAMP(6)" : "NULL";
        jdbc.update("UPDATE project SET status = ?, archived_at = " + archivedSql + ", deleted_at = " + deletedSql + ", updated_at = CURRENT_TIMESTAMP(6) WHERE id = ?",
                status, projectId);
        return new ProjectDtos.ProjectDetails(
                access.id(), access.name(), access.sourceType(), access.repositoryOwner(), access.repositoryName(), access.repositoryUrl(),
                access.defaultBranch(), access.workspaceBranch(), access.baseCommit(), access.lastRemoteCommit(), access.framework(),
                access.skippedFileCount(), status, access.currentRevision(), access.publishedRevision(), access.storageBytes(), access.role(),
                access.createdAt(), Instant.now()
        );
    }

    @Transactional
    public ProjectDtos.ProjectDetails connectRepository(
            String projectId,
            long userId,
            String repositoryUrl,
            String defaultBranch,
            String baseCommit
    ) {
        ProjectAccessService.Access access = accessService.requireManage(projectId, userId);
        var address = com.interfacelab.backend.projectimport.GitHubRepositoryAddress.parse(repositoryUrl);
        String branch = GitHubImportService.validateRef(defaultBranch == null || defaultBranch.isBlank() ? "main" : defaultBranch);
        String commit = baseCommit == null || baseCommit.isBlank() ? null : baseCommit.trim();
        if (commit != null && !commit.matches("[a-fA-F0-9]{40,64}")) {
            throw new PolazuException("INVALID_COMMIT", "기준 커밋 SHA 형식이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);
        }
        jdbc.update("""
                UPDATE project SET repository_owner = ?, repository_name = ?, repository_url = ?,
                    default_branch = ?, base_commit = ?, updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """, address.owner(), address.repository(), address.webUrl(), branch, commit, projectId);
        return new ProjectDtos.ProjectDetails(
                access.id(), access.name(), access.sourceType(), address.owner(), address.repository(), address.webUrl(), branch,
                access.workspaceBranch(), commit, access.lastRemoteCommit(), access.framework(), access.skippedFileCount(),
                access.status(), access.currentRevision(), access.publishedRevision(), access.storageBytes(), access.role(),
                access.createdAt(), Instant.now()
        );
    }

    private ProjectDtos.ProjectDetails createFromImport(
            AuthenticatedUser user,
            ImportedProjectResponse imported,
            String name,
            String sourceType
    ) {
        String id = UUID.randomUUID().toString();
        String branch = imported.source().ref() == null || imported.source().ref().isBlank() ? "workspace" : imported.source().ref();
        long storageBytes = calculateStorage(imported);
        jdbc.update("""
                INSERT INTO project(
                    id, owner_user_id, name, source_type, repository_owner, repository_name, repository_url,
                    default_branch, workspace_branch, base_commit, framework, skipped_file_count, storage_bytes, published_revision
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, id, user.id(), name, sourceType,
                blankToNull(imported.source().owner()), blankToNull(imported.source().repository()), blankToNull(imported.source().url()),
                "workspace".equals(branch) ? null : branch, branch, imported.baseCommit(), imported.framework(),
                imported.skippedFileCount(), storageBytes, sourceType.startsWith("GITHUB") ? 0 : -1);
        jdbc.update("INSERT INTO project_member(project_id, user_id, role) VALUES (?, ?, 'OWNER')", id, user.id());
        for (Map.Entry<String, String> file : imported.files().entrySet()) {
            insertWorkspaceFile(id, branch, file.getKey(), file.getValue().getBytes(StandardCharsets.UTF_8), false, user.id());
        }
        for (Map.Entry<String, String> file : imported.binaryFiles().entrySet()) {
            byte[] bytes;
            try { bytes = Base64.getDecoder().decode(file.getValue()); }
            catch (IllegalArgumentException exception) {
                throw new PolazuException("INVALID_BINARY_FILE", "바이너리 파일 인코딩이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);
            }
            insertWorkspaceFile(id, branch, file.getKey(), bytes, true, user.id());
        }
        return ProjectAccessService.toDetails(accessService.requireRead(id, user.id()));
    }

    private void insertWorkspaceFile(String projectId, String branch, String rawPath, byte[] bytes, boolean binary, long userId) {
        String path = WorkspacePath.normalize(rawPath);
        if (bytes.length > RepositoryArchiveReader.MAX_FILE_BYTES) {
            throw new PolazuException("FILE_LIMIT_EXCEEDED", "파일 하나의 크기가 4MiB를 초과했습니다.", HttpStatus.PAYLOAD_TOO_LARGE);
        }
        jdbc.update("""
                INSERT INTO workspace_file(
                    project_id, branch_name, path, path_hash, text_content, binary_content, is_binary,
                    content_sha, size_bytes, updated_revision, updated_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
                """, projectId, branch, path, WorkspacePath.hash(path), binary ? null : new String(bytes, StandardCharsets.UTF_8),
                binary ? bytes : null, binary, WorkspacePath.contentSha(bytes), bytes.length, userId);
    }

    private static long calculateStorage(ImportedProjectResponse imported) {
        long total = imported.files().values().stream().mapToLong(value -> value.getBytes(StandardCharsets.UTF_8).length).sum();
        for (String base64 : imported.binaryFiles().values()) {
            try { total += Base64.getDecoder().decode(base64).length; }
            catch (IllegalArgumentException exception) {
                throw new PolazuException("INVALID_BINARY_FILE", "바이너리 파일 인코딩이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);
            }
        }
        if (total > RepositoryArchiveReader.MAX_STORED_BYTES) {
            throw new PolazuException("PROJECT_STORAGE_LIMIT", "공유 소스와 자산 합계가 32MiB를 초과했습니다.", HttpStatus.PAYLOAD_TOO_LARGE);
        }
        return total;
    }

    private static String detectFramework(Map<String, String> files) {
        String packageJson = files.entrySet().stream().filter(entry -> entry.getKey().endsWith("/package.json"))
                .map(Map.Entry::getValue).findFirst().orElse("");
        if (packageJson.matches("(?s).*(\"vue\"|\"svelte\"|\"@angular/core\"|\"astro\").*")) {
            throw new PolazuException("UNSUPPORTED_FRAMEWORK",
                    "현재는 React, Next.js, JavaScript/TypeScript, HTML/CSS, Tailwind CSS 프로젝트만 지원합니다.",
                    HttpStatus.UNPROCESSABLE_ENTITY);
        }
        if (packageJson.contains("\"next\"")) return "NEXTJS";
        if (packageJson.contains("\"react\"")) return "REACT";
        if (packageJson.contains("\"vite\"")) return "VITE";
        return "HTML";
    }

    private static String normalizeName(String raw) {
        String value = raw == null ? "" : raw.trim().replaceAll("\\s+", " ");
        if (value.length() < 1 || value.length() > 120 || value.chars().anyMatch(ch -> Character.isISOControl(ch))) {
            throw new PolazuException("INVALID_PROJECT_NAME", "프로젝트 이름은 1~120자로 입력해 주세요.", HttpStatus.BAD_REQUEST);
        }
        return value;
    }

    private static String normalizeListStatus(String raw) {
        if (raw == null || raw.isBlank() || "ALL".equalsIgnoreCase(raw)) return null;
        String status = raw.trim().toUpperCase(Locale.ROOT);
        if (!List.of("ACTIVE", "ARCHIVED", "DELETED").contains(status)) {
            throw new PolazuException("INVALID_PROJECT_STATUS", "올바른 프로젝트 상태를 선택해 주세요.", HttpStatus.BAD_REQUEST);
        }
        return status;
    }

    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value; }

    private static ProjectDtos.ProjectSummary mapSummary(ResultSet rs, int rowNum) throws SQLException {
        return new ProjectDtos.ProjectSummary(
                rs.getString("id"), rs.getString("name"), rs.getString("source_type"), rs.getString("repository_url"),
                rs.getString("workspace_branch"), rs.getString("base_commit"), rs.getString("framework"), rs.getString("status"),
                rs.getLong("current_revision"), rs.getLong("published_revision"), rs.getLong("storage_bytes"),
                rs.getInt("file_count"), ProjectRole.valueOf(rs.getString("role")), rs.getTimestamp("updated_at").toInstant()
        );
    }
}

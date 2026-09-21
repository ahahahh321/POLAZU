package com.interfacelab.backend.project;

import com.interfacelab.backend.auth.AuthenticatedUser;
import com.interfacelab.backend.common.PolazuException;
import com.interfacelab.backend.projectimport.RepositoryArchiveReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class WorkspaceService {
    private final JdbcTemplate jdbc;
    private final ProjectAccessService accessService;
    private final ProjectEventHub eventHub;

    public WorkspaceService(JdbcTemplate jdbc, ProjectAccessService accessService, ProjectEventHub eventHub) {
        this.jdbc = jdbc;
        this.accessService = accessService;
        this.eventHub = eventHub;
    }

    public ProjectDtos.WorkspaceSnapshot snapshot(String projectId, AuthenticatedUser user) {
        ProjectAccessService.Access access = accessService.requireRead(projectId, user.id());
        if ("DELETED".equals(access.status())) {
            throw new PolazuException("PROJECT_NOT_ACTIVE", "삭제된 프로젝트는 복구한 뒤 열 수 있습니다.", HttpStatus.CONFLICT);
        }
        Map<String, String> files = new LinkedHashMap<>();
        Map<String, String> binaryFiles = new LinkedHashMap<>();
        jdbc.query("""
                SELECT path, text_content, binary_content, is_binary
                FROM workspace_file
                WHERE project_id = ? AND branch_name = ?
                ORDER BY path
                """, rs -> {
            String path = rs.getString("path");
            if (rs.getBoolean("is_binary")) binaryFiles.put(path, Base64.getEncoder().encodeToString(rs.getBytes("binary_content")));
            else files.put(path, rs.getString("text_content"));
        }, projectId, access.workspaceBranch());
        return new ProjectDtos.WorkspaceSnapshot(
                ProjectAccessService.toDetails(access), access.currentRevision(), access.workspaceBranch(),
                Map.copyOf(files), Map.copyOf(binaryFiles), eventHub.current(projectId, access.workspaceBranch())
        );
    }

    @Transactional
    public ProjectDtos.ChangeResult saveChanges(
            String projectId,
            AuthenticatedUser user,
            ProjectDtos.ChangeRequest request,
            String kind
    ) {
        ProjectAccessService.Access access = accessService.requireWrite(projectId, user.id());
        return saveChangesInternal(projectId, user, access.workspaceBranch(), request, normalizeKind(kind));
    }

    private ProjectDtos.ChangeResult saveChangesInternal(
            String projectId,
            AuthenticatedUser user,
            String branch,
            ProjectDtos.ChangeRequest request,
            String kind
    ) {
        validateRequest(request, List.of("RESTORE", "REMOTE_APPLY").contains(kind) ? RepositoryArchiveReader.MAX_FILE_COUNT : 100);
        ExistingMutation duplicate = findMutation(projectId, request.clientMutationId());
        if (duplicate != null) {
            return new ProjectDtos.ChangeResult(duplicate.revision(), duplicate.paths(), duplicate.createdAt(), true);
        }

        LockedProject locked = lockProject(projectId);
        duplicate = findMutation(projectId, request.clientMutationId());
        if (duplicate != null) {
            return new ProjectDtos.ChangeResult(duplicate.revision(), duplicate.paths(), duplicate.createdAt(), true);
        }
        if (!"ACTIVE".equals(locked.status())) {
            throw new PolazuException("PROJECT_NOT_ACTIVE", "보관 또는 삭제된 프로젝트는 수정할 수 없습니다.", HttpStatus.CONFLICT);
        }
        if (locked.currentRevision() != request.baseRevision()) {
            throw revisionConflict(locked.currentRevision());
        }

        long nextRevision = locked.currentRevision() + 1;
        Set<String> requestPaths = new HashSet<>();
        List<AppliedChange> applied = new ArrayList<>();
        for (ProjectDtos.FileChange change : request.changes()) {
            String path = WorkspacePath.normalize(change.path());
            String pathKey = path.toLowerCase(Locale.ROOT);
            if (!requestPaths.add(pathKey)) {
                throw new PolazuException("DUPLICATE_FILE_CHANGE", "한 요청에서 같은 파일을 두 번 변경할 수 없습니다.", HttpStatus.BAD_REQUEST);
            }
            StoredFile before = findFile(projectId, branch, path);
            if (Boolean.TRUE.equals(change.delete())) {
                if (before == null) continue;
                jdbc.update("DELETE FROM workspace_file WHERE id = ?", before.id());
                applied.add(AppliedChange.deleted(path, before));
                continue;
            }
            NewContent content = decodeContent(change);
            if (content.bytes().length > RepositoryArchiveReader.MAX_FILE_BYTES) {
                throw new PolazuException("FILE_LIMIT_EXCEEDED", "파일 하나의 크기가 4MiB를 초과했습니다.", HttpStatus.PAYLOAD_TOO_LARGE);
            }
            String sha = WorkspacePath.contentSha(content.bytes());
            if (before != null && before.binary() == content.binary() && before.sha().equals(sha)) continue;
            if (before == null) {
                jdbc.update("""
                        INSERT INTO workspace_file(
                            project_id, branch_name, path, path_hash, text_content, binary_content, is_binary,
                            content_sha, size_bytes, updated_revision, updated_by, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6))
                        """, projectId, branch, path, WorkspacePath.hash(path), content.text(), content.binaryBytes(),
                        content.binary(), sha, content.bytes().length, nextRevision, user.id());
                applied.add(AppliedChange.created(path, content, sha));
            } else {
                jdbc.update("""
                        UPDATE workspace_file
                        SET path = ?, text_content = ?, binary_content = ?, is_binary = ?, content_sha = ?,
                            size_bytes = ?, updated_revision = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP(6)
                        WHERE id = ?
                        """, path, content.text(), content.binaryBytes(), content.binary(), sha,
                        content.bytes().length, nextRevision, user.id(), before.id());
                applied.add(AppliedChange.modified(path, before, content, sha));
            }
        }
        if (applied.isEmpty()) {
            throw new PolazuException("NO_CHANGES", "저장할 실제 변경사항이 없습니다.", HttpStatus.UNPROCESSABLE_ENTITY,
                    Map.of("currentRevision", locked.currentRevision()));
        }

        StorageUsage usage = storageUsage(projectId, branch);
        if (usage.fileCount() > RepositoryArchiveReader.MAX_FILE_COUNT) {
            throw new PolazuException("FILE_COUNT_LIMIT", "작업 공간 파일 수 2,500개를 초과했습니다.", HttpStatus.PAYLOAD_TOO_LARGE);
        }
        if (usage.bytes() > RepositoryArchiveReader.MAX_STORED_BYTES) {
            throw new PolazuException("PROJECT_STORAGE_LIMIT", "공유 소스와 자산 합계가 32MiB를 초과했습니다.", HttpStatus.PAYLOAD_TOO_LARGE);
        }

        String summary = normalizeSummary(request.summary(), applied);
        long revisionId = insertRevision(projectId, branch, nextRevision, request.baseRevision(), user.id(), kind, summary, request.clientMutationId());
        for (AppliedChange change : applied) insertRevisionChange(revisionId, change);
        jdbc.update("""
                UPDATE project SET current_revision = ?, storage_bytes = ?, updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """, nextRevision, usage.bytes(), projectId);

        List<String> paths = applied.stream().map(AppliedChange::path).toList();
        Instant savedAt = Instant.now();
        afterCommit(() -> eventHub.broadcastRevision(projectId, branch, nextRevision, user, summary, paths));
        return new ProjectDtos.ChangeResult(nextRevision, paths, savedAt, false);
    }


    @Transactional
    public ProjectDtos.ChangeResult applyRemoteSnapshot(
            String projectId,
            AuthenticatedUser user,
            long baseRevision,
            Map<String, String> textFiles,
            Map<String, String> binaryFiles,
            String remoteCommit,
            String remoteBranch,
            String clientMutationId
    ) {
        ProjectAccessService.Access access = accessService.requireWrite(projectId, user.id());
        LockedProject locked = lockProject(projectId);
        if (locked.currentRevision() != baseRevision) throw revisionConflict(locked.currentRevision());

        Map<String, StoredFile> current = loadFiles(projectId, access.workspaceBranch());
        Map<String, ProjectDtos.FileChange> desired = new LinkedHashMap<>();
        for (Map.Entry<String, String> entry : textFiles.entrySet()) {
            String path = WorkspacePath.normalize(entry.getKey());
            desired.put(path.toLowerCase(Locale.ROOT), new ProjectDtos.FileChange(path, entry.getValue(), null, false));
        }
        for (Map.Entry<String, String> entry : binaryFiles.entrySet()) {
            String path = WorkspacePath.normalize(entry.getKey());
            desired.put(path.toLowerCase(Locale.ROOT), new ProjectDtos.FileChange(path, null, entry.getValue(), false));
        }
        if (desired.size() > RepositoryArchiveReader.MAX_FILE_COUNT) {
            throw new PolazuException("FILE_COUNT_LIMIT", "원격 작업 공간 파일 수 2,500개를 초과했습니다.", HttpStatus.PAYLOAD_TOO_LARGE);
        }

        List<ProjectDtos.FileChange> changes = new ArrayList<>();
        for (StoredFile file : current.values()) {
            if (!desired.containsKey(file.path().toLowerCase(Locale.ROOT))) {
                changes.add(new ProjectDtos.FileChange(file.path(), null, null, true));
            }
        }
        for (Map.Entry<String, ProjectDtos.FileChange> entry : desired.entrySet()) {
            ProjectDtos.FileChange target = entry.getValue();
            StoredFile existing = current.get(entry.getKey());
            if (existing == null) { changes.add(target); continue; }
            NewContent content = decodeContent(target);
            String sha = WorkspacePath.contentSha(content.bytes());
            if (existing.binary() != content.binary() || !existing.sha().equals(sha)) changes.add(target);
        }

        ProjectDtos.ChangeResult result;
        if (changes.isEmpty()) {
            result = new ProjectDtos.ChangeResult(locked.currentRevision(), List.of(), Instant.now(), false);
        } else {
            result = saveChangesInternal(projectId, user, access.workspaceBranch(),
                    new ProjectDtos.ChangeRequest(baseRevision, clientMutationId,
                            "원격 " + remoteBranch + " @ " + remoteCommit.substring(0, Math.min(8, remoteCommit.length())) + " 적용", changes),
                    "REMOTE_APPLY");
        }
        jdbc.update("""
                UPDATE project SET base_commit = ?, default_branch = ?, last_remote_commit = NULL,
                    published_revision = ?, updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """, remoteCommit, remoteBranch, result.revision(), projectId);
        return result;
    }

    public List<ProjectDtos.RevisionSummary> revisions(String projectId, long userId, int requestedLimit) {
        ProjectAccessService.Access access = accessService.requireRead(projectId, userId);
        int limit = Math.max(1, Math.min(requestedLimit, 200));
        List<RevisionRow> rows = jdbc.query("""
                SELECT wr.id, wr.revision_no, wr.base_revision, wr.kind, wr.summary,
                       COALESCE(wr.author_user_id, 0) AS author_user_id,
                       COALESCE(u.display_name, 'Unknown') AS author_name, wr.created_at
                FROM workspace_revision wr
                LEFT JOIN app_user u ON u.id = wr.author_user_id
                WHERE wr.project_id = ? AND wr.branch_name = ?
                ORDER BY wr.revision_no DESC
                LIMIT ?
                """, WorkspaceService::mapRevisionRow, projectId, access.workspaceBranch(), limit);
        return rows.stream().map(row -> new ProjectDtos.RevisionSummary(
                row.revision(), row.baseRevision(), row.kind(), row.summary(), row.authorUserId(), row.authorName(),
                jdbc.query("SELECT path FROM workspace_revision_change WHERE revision_id = ? ORDER BY path",
                        (rs, index) -> rs.getString(1), row.id()),
                row.createdAt()
        )).toList();
    }

    @Transactional
    public ProjectDtos.VersionSummary createVersion(
            String projectId,
            AuthenticatedUser user,
            String rawName,
            String rawSummary
    ) {
        ProjectAccessService.Access access = accessService.requireWrite(projectId, user.id());
        LockedProject locked = lockProject(projectId);
        String name = requireText(rawName, "버전 이름", 1, 100);
        String summary = optionalText(rawSummary, 500, "수동으로 저장한 내부 버전");
        String versionId = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO internal_version(id, project_id, branch_name, source_revision, name, summary, author_user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, versionId, projectId, access.workspaceBranch(), locked.currentRevision(), name, summary, user.id());
        jdbc.update("""
                INSERT INTO internal_version_file(
                    version_id, path, path_hash, text_content, binary_content, is_binary, content_sha, size_bytes
                )
                SELECT ?, path, path_hash, text_content, binary_content, is_binary, content_sha, size_bytes
                FROM workspace_file WHERE project_id = ? AND branch_name = ?
                """, versionId, projectId, access.workspaceBranch());
        StorageUsage usage = storageUsage(projectId, access.workspaceBranch());
        return new ProjectDtos.VersionSummary(versionId, name, summary, locked.currentRevision(), user.id(), user.name(),
                usage.fileCount(), usage.bytes(), Instant.now());
    }

    public List<ProjectDtos.VersionSummary> versions(String projectId, long userId) {
        ProjectAccessService.Access access = accessService.requireRead(projectId, userId);
        return jdbc.query("""
                SELECT v.id, v.name, v.summary, v.source_revision, COALESCE(v.author_user_id, 0) AS author_user_id,
                       COALESCE(u.display_name, 'Unknown') AS author_name, v.created_at,
                       COUNT(vf.id) AS file_count, COALESCE(SUM(vf.size_bytes), 0) AS size_bytes
                FROM internal_version v
                LEFT JOIN app_user u ON u.id = v.author_user_id
                LEFT JOIN internal_version_file vf ON vf.version_id = v.id
                WHERE v.project_id = ? AND v.branch_name = ?
                GROUP BY v.id, v.name, v.summary, v.source_revision, v.author_user_id, u.display_name, v.created_at
                ORDER BY v.created_at DESC
                """, WorkspaceService::mapVersion, projectId, access.workspaceBranch());
    }

    @Transactional
    public ProjectDtos.ChangeResult restoreVersion(String projectId, String versionId, AuthenticatedUser user, long baseRevision) {
        ProjectAccessService.Access access = accessService.requireWrite(projectId, user.id());
        VersionHeader version = jdbc.query("""
                SELECT id, name FROM internal_version WHERE id = ? AND project_id = ? AND branch_name = ?
                """, rs -> rs.next() ? new VersionHeader(rs.getString("id"), rs.getString("name")) : null,
                versionId, projectId, access.workspaceBranch());
        if (version == null) throw new PolazuException("VERSION_NOT_FOUND", "복원할 내부 버전을 찾을 수 없습니다.", HttpStatus.NOT_FOUND);

        Map<String, StoredFile> current = loadFiles(projectId, access.workspaceBranch());
        Map<String, VersionFile> target = loadVersionFiles(versionId);
        List<ProjectDtos.FileChange> changes = new ArrayList<>();
        for (StoredFile file : current.values()) if (!target.containsKey(file.path().toLowerCase(Locale.ROOT))) {
            changes.add(new ProjectDtos.FileChange(file.path(), null, null, true));
        }
        for (VersionFile file : target.values()) {
            StoredFile existing = current.get(file.path().toLowerCase(Locale.ROOT));
            if (existing != null && existing.sha().equals(file.sha()) && existing.binary() == file.binary()) continue;
            changes.add(file.binary()
                    ? new ProjectDtos.FileChange(file.path(), null, Base64.getEncoder().encodeToString(file.bytes()), false)
                    : new ProjectDtos.FileChange(file.path(), new String(file.bytes(), StandardCharsets.UTF_8), null, false));
        }
        if (changes.isEmpty()) {
            throw new PolazuException("NO_CHANGES", "현재 작업 공간이 이미 선택한 버전과 같습니다.", HttpStatus.UNPROCESSABLE_ENTITY);
        }
        return saveChangesInternal(projectId, user, access.workspaceBranch(),
                new ProjectDtos.ChangeRequest(baseRevision, "restore-" + UUID.randomUUID(),
                        "내부 버전 복원: " + version.name(), changes), "RESTORE");
    }

    public byte[] exportZip(String projectId, long userId) {
        ProjectAccessService.Access access = accessService.requireRead(projectId, userId);
        try (ByteArrayOutputStream bytes = new ByteArrayOutputStream(); ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
            jdbc.query("""
                    SELECT path, text_content, binary_content, is_binary
                    FROM workspace_file WHERE project_id = ? AND branch_name = ? ORDER BY path
                    """, rs -> {
                try {
                    String path = rs.getString("path").replaceFirst("^/", "");
                    zip.putNextEntry(new ZipEntry(path));
                    byte[] content = rs.getBoolean("is_binary")
                            ? rs.getBytes("binary_content")
                            : rs.getString("text_content").getBytes(StandardCharsets.UTF_8);
                    zip.write(content);
                    zip.closeEntry();
                } catch (IOException exception) {
                    throw new java.io.UncheckedIOException(exception);
                }
            }, projectId, access.workspaceBranch());
            zip.finish();
            return bytes.toByteArray();
        } catch (IOException | java.io.UncheckedIOException exception) {
            throw new PolazuException("EXPORT_FAILED", "프로젝트 ZIP을 만들지 못했습니다.", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private LockedProject lockProject(String projectId) {
        LockedProject locked = jdbc.query("SELECT current_revision, workspace_branch, status FROM project WHERE id = ? FOR UPDATE",
                rs -> rs.next() ? new LockedProject(rs.getLong(1), rs.getString(2), rs.getString(3)) : null, projectId);
        if (locked == null) throw new PolazuException("PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없습니다.", HttpStatus.NOT_FOUND);
        return locked;
    }

    private ExistingMutation findMutation(String projectId, String clientMutationId) {
        if (clientMutationId == null || clientMutationId.isBlank()) return null;
        return jdbc.query("""
                SELECT id, revision_no, created_at FROM workspace_revision
                WHERE project_id = ? AND client_mutation_id = ?
                """, rs -> {
            if (!rs.next()) return null;
            long id = rs.getLong("id");
            List<String> paths = jdbc.query("SELECT path FROM workspace_revision_change WHERE revision_id = ? ORDER BY path",
                    (changeRs, row) -> changeRs.getString(1), id);
            return new ExistingMutation(rs.getLong("revision_no"), paths, rs.getTimestamp("created_at").toInstant());
        }, projectId, clientMutationId);
    }

    private StoredFile findFile(String projectId, String branch, String path) {
        return jdbc.query("""
                SELECT id, path, text_content, binary_content, is_binary, content_sha, size_bytes
                FROM workspace_file WHERE project_id = ? AND branch_name = ? AND path_hash = ?
                """, rs -> rs.next() ? mapStoredFile(rs) : null, projectId, branch, WorkspacePath.hash(path));
    }

    private Map<String, StoredFile> loadFiles(String projectId, String branch) {
        Map<String, StoredFile> result = new HashMap<>();
        jdbc.query("""
                SELECT id, path, text_content, binary_content, is_binary, content_sha, size_bytes
                FROM workspace_file WHERE project_id = ? AND branch_name = ?
                """, rs -> {
            StoredFile file = mapStoredFile(rs);
            result.put(file.path().toLowerCase(Locale.ROOT), file);
        }, projectId, branch);
        return result;
    }

    private Map<String, VersionFile> loadVersionFiles(String versionId) {
        Map<String, VersionFile> result = new HashMap<>();
        jdbc.query("""
                SELECT path, text_content, binary_content, is_binary, content_sha, size_bytes
                FROM internal_version_file WHERE version_id = ?
                """, rs -> {
            boolean binary = rs.getBoolean("is_binary");
            byte[] bytes = binary ? rs.getBytes("binary_content") : rs.getString("text_content").getBytes(StandardCharsets.UTF_8);
            VersionFile file = new VersionFile(rs.getString("path"), binary, rs.getString("content_sha"), bytes, rs.getLong("size_bytes"));
            result.put(file.path().toLowerCase(Locale.ROOT), file);
        }, versionId);
        return result;
    }

    private StorageUsage storageUsage(String projectId, String branch) {
        return jdbc.query("""
                SELECT COUNT(*) AS file_count, COALESCE(SUM(size_bytes), 0) AS bytes
                FROM workspace_file WHERE project_id = ? AND branch_name = ?
                """, rs -> { rs.next(); return new StorageUsage(rs.getInt("file_count"), rs.getLong("bytes")); }, projectId, branch);
    }

    private long insertRevision(
            String projectId,
            String branch,
            long revision,
            long baseRevision,
            long userId,
            String kind,
            String summary,
            String clientMutationId
    ) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbc.update(connection -> {
            PreparedStatement statement = connection.prepareStatement("""
                    INSERT INTO workspace_revision(
                        project_id, branch_name, revision_no, base_revision, author_user_id, kind, summary, client_mutation_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, new String[] { "id" });
            statement.setString(1, projectId);
            statement.setString(2, branch);
            statement.setLong(3, revision);
            statement.setLong(4, baseRevision);
            statement.setLong(5, userId);
            statement.setString(6, kind);
            statement.setString(7, summary);
            statement.setString(8, clientMutationId);
            return statement;
        }, keyHolder);
        Number key = keyHolder.getKey();
        if (key == null) throw new IllegalStateException("Revision key was not generated");
        return key.longValue();
    }

    private void insertRevisionChange(long revisionId, AppliedChange change) {
        jdbc.update("""
                INSERT INTO workspace_revision_change(
                    revision_id, path, path_hash, change_type, before_sha, after_sha,
                    before_text, after_text, before_binary, after_binary, is_binary
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, revisionId, change.path(), WorkspacePath.hash(change.path()), change.type(),
                change.beforeSha(), change.afterSha(), change.beforeText(), change.afterText(),
                change.beforeBinary(), change.afterBinary(), change.binary());
    }

    private static NewContent decodeContent(ProjectDtos.FileChange change) {
        boolean hasText = change.content() != null;
        boolean hasBinary = change.binaryBase64() != null;
        if (hasText == hasBinary) {
            throw new PolazuException("INVALID_FILE_CONTENT", "텍스트 content 또는 binaryBase64 중 하나만 제공해야 합니다.", HttpStatus.BAD_REQUEST);
        }
        if (hasText) {
            byte[] bytes = change.content().getBytes(StandardCharsets.UTF_8);
            return new NewContent(false, change.content(), null, bytes);
        }
        try {
            byte[] bytes = Base64.getDecoder().decode(change.binaryBase64());
            return new NewContent(true, null, bytes, bytes);
        } catch (IllegalArgumentException exception) {
            throw new PolazuException("INVALID_BINARY_FILE", "binaryBase64 인코딩이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);
        }
    }

    private static void validateRequest(ProjectDtos.ChangeRequest request, int maxChanges) {
        if (request == null || request.changes() == null || request.changes().isEmpty() || request.changes().size() > maxChanges) {
            throw new PolazuException("INVALID_CHANGESET", "한 번에 1~" + maxChanges + "개의 파일 변경을 저장할 수 있습니다.", HttpStatus.BAD_REQUEST);
        }
        if (request.baseRevision() < 0) {
            throw new PolazuException("INVALID_REVISION", "기준 revision이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);
        }
        String mutation = request.clientMutationId();
        if (mutation == null || mutation.isBlank() || mutation.length() > 100 || mutation.chars().anyMatch(Character::isISOControl)) {
            throw new PolazuException("INVALID_MUTATION_ID", "clientMutationId를 1~100자로 전달해 주세요.", HttpStatus.BAD_REQUEST);
        }
    }

    private static String normalizeKind(String raw) {
        String kind = raw == null ? "EDIT" : raw.trim().toUpperCase(Locale.ROOT);
        return List.of("EDIT", "CODE", "DESIGN", "RESTORE", "REMOTE_APPLY").contains(kind) ? kind : "EDIT";
    }

    private static String normalizeSummary(String raw, List<AppliedChange> applied) {
        String value = raw == null ? "" : raw.trim();
        if (value.isBlank()) value = applied.size() == 1 ? applied.getFirst().type() + " " + applied.getFirst().path() : applied.size() + "개 파일 변경";
        if (value.length() > 500) value = value.substring(0, 500);
        return value;
    }

    private static String requireText(String raw, String label, int min, int max) {
        String value = raw == null ? "" : raw.trim();
        if (value.length() < min || value.length() > max) {
            throw new PolazuException("INVALID_REQUEST", label + "은(는) " + min + "~" + max + "자로 입력해 주세요.", HttpStatus.BAD_REQUEST);
        }
        return value;
    }

    private static String optionalText(String raw, int max, String fallback) {
        String value = raw == null ? "" : raw.trim();
        if (value.length() > max) throw new PolazuException("INVALID_REQUEST", "설명이 너무 깁니다.", HttpStatus.BAD_REQUEST);
        return value.isBlank() ? fallback : value;
    }

    private static PolazuException revisionConflict(long currentRevision) {
        return new PolazuException("REVISION_CONFLICT", "다른 사용자의 변경이 먼저 저장되었습니다. 최신 작업 공간을 확인한 뒤 다시 적용해 주세요.",
                HttpStatus.CONFLICT, Map.of("currentRevision", currentRevision));
    }

    private static void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) { action.run(); return; }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { action.run(); }
        });
    }

    private static StoredFile mapStoredFile(ResultSet rs) throws SQLException {
        boolean binary = rs.getBoolean("is_binary");
        return new StoredFile(rs.getLong("id"), rs.getString("path"), binary, rs.getString("content_sha"),
                rs.getString("text_content"), rs.getBytes("binary_content"), rs.getLong("size_bytes"));
    }

    private static RevisionRow mapRevisionRow(ResultSet rs, int rowNum) throws SQLException {
        return new RevisionRow(rs.getLong("id"), rs.getLong("revision_no"), rs.getLong("base_revision"),
                rs.getString("kind"), rs.getString("summary"), rs.getLong("author_user_id"),
                rs.getString("author_name"), rs.getTimestamp("created_at").toInstant());
    }

    private static ProjectDtos.VersionSummary mapVersion(ResultSet rs, int rowNum) throws SQLException {
        return new ProjectDtos.VersionSummary(
                rs.getString("id"), rs.getString("name"), rs.getString("summary"), rs.getLong("source_revision"),
                rs.getLong("author_user_id"), rs.getString("author_name"), rs.getInt("file_count"),
                rs.getLong("size_bytes"), rs.getTimestamp("created_at").toInstant()
        );
    }

    private record LockedProject(long currentRevision, String branch, String status) {}
    private record ExistingMutation(long revision, List<String> paths, Instant createdAt) {}
    private record StorageUsage(int fileCount, long bytes) {}
    private record NewContent(boolean binary, String text, byte[] binaryBytes, byte[] bytes) {}
    private record StoredFile(long id, String path, boolean binary, String sha, String text, byte[] binaryBytes, long size) {
        byte[] bytes() { return binary ? binaryBytes : text.getBytes(StandardCharsets.UTF_8); }
    }
    private record VersionFile(String path, boolean binary, String sha, byte[] bytes, long size) {}
    private record VersionHeader(String id, String name) {}
    private record RevisionRow(long id, long revision, long baseRevision, String kind, String summary, long authorUserId, String authorName, Instant createdAt) {}

    private record AppliedChange(
            String path,
            String type,
            boolean binary,
            String beforeSha,
            String afterSha,
            String beforeText,
            String afterText,
            byte[] beforeBinary,
            byte[] afterBinary
    ) {
        static AppliedChange created(String path, NewContent after, String afterSha) {
            return new AppliedChange(path, "CREATE", after.binary(), null, afterSha, null, after.text(), null, after.binaryBytes());
        }
        static AppliedChange modified(String path, StoredFile before, NewContent after, String afterSha) {
            return new AppliedChange(path, "MODIFY", after.binary(), before.sha(), afterSha,
                    before.binary() ? null : before.text(), after.text(), before.binary() ? before.binaryBytes() : null, after.binaryBytes());
        }
        static AppliedChange deleted(String path, StoredFile before) {
            return new AppliedChange(path, "DELETE", before.binary(), before.sha(), null,
                    before.binary() ? null : before.text(), null, before.binary() ? before.binaryBytes() : null, null);
        }
    }
}

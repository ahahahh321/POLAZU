package com.interfacelab.backend.project;

import com.interfacelab.backend.common.PolazuException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class ProjectAccessService {
    private final JdbcTemplate jdbc;

    public ProjectAccessService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public Access requireRead(String projectId, long userId) {
        Access access = find(projectId, userId);
        if ("DELETED".equals(access.status())) throw notFound();
        return access;
    }

    public Access requireWrite(String projectId, long userId) {
        Access access = requireRead(projectId, userId);
        if (!access.role().canWrite()) {
            throw new PolazuException("PROJECT_WRITE_FORBIDDEN", "이 프로젝트를 수정할 권한이 없습니다.", HttpStatus.FORBIDDEN);
        }
        if (!"ACTIVE".equals(access.status())) {
            throw new PolazuException("PROJECT_NOT_ACTIVE", "보관 또는 삭제된 프로젝트는 수정할 수 없습니다.", HttpStatus.CONFLICT);
        }
        return access;
    }

    public Access requireManage(String projectId, long userId) {
        Access access = requireRead(projectId, userId);
        if (!access.role().canManage()) {
            throw new PolazuException("PROJECT_MANAGE_FORBIDDEN", "프로젝트 소유자만 이 작업을 수행할 수 있습니다.", HttpStatus.FORBIDDEN);
        }
        return access;
    }


    public Access requireManageIncludingDeleted(String projectId, long userId) {
        Access access = find(projectId, userId);
        if (!access.role().canManage()) {
            throw new PolazuException("PROJECT_MANAGE_FORBIDDEN", "프로젝트 소유자만 이 작업을 수행할 수 있습니다.", HttpStatus.FORBIDDEN);
        }
        return access;
    }

    private Access find(String projectId, long userId) {
        Access access = jdbc.query("""
                SELECT p.id, p.owner_user_id, p.name, p.source_type, p.repository_owner, p.repository_name,
                       p.repository_url, p.default_branch, p.workspace_branch, p.base_commit, p.last_remote_commit,
                       p.framework, p.skipped_file_count, p.status, p.current_revision, p.published_revision,
                       p.storage_bytes, p.created_at, p.updated_at, pm.role
                FROM project p
                JOIN project_member pm ON pm.project_id = p.id
                WHERE p.id = ? AND pm.user_id = ?
                """, rs -> rs.next() ? map(rs) : null, projectId, userId);
        if (access == null) throw notFound();
        return access;
    }

    private static Access map(ResultSet rs) throws SQLException {
        return new Access(
                rs.getString("id"), rs.getLong("owner_user_id"), rs.getString("name"), rs.getString("source_type"),
                rs.getString("repository_owner"), rs.getString("repository_name"), rs.getString("repository_url"),
                rs.getString("default_branch"), rs.getString("workspace_branch"), rs.getString("base_commit"),
                rs.getString("last_remote_commit"), rs.getString("framework"), rs.getInt("skipped_file_count"),
                rs.getString("status"), rs.getLong("current_revision"), rs.getLong("published_revision"),
                rs.getLong("storage_bytes"), ProjectRole.valueOf(rs.getString("role")),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant()
        );
    }

    public static ProjectDtos.ProjectDetails toDetails(Access access) {
        return new ProjectDtos.ProjectDetails(
                access.id(), access.name(), access.sourceType(), access.repositoryOwner(), access.repositoryName(),
                access.repositoryUrl(), access.defaultBranch(), access.workspaceBranch(), access.baseCommit(),
                access.lastRemoteCommit(), access.framework(), access.skippedFileCount(), access.status(),
                access.currentRevision(), access.publishedRevision(), access.storageBytes(), access.role(),
                access.createdAt(), access.updatedAt()
        );
    }

    private static PolazuException notFound() {
        return new PolazuException("PROJECT_NOT_FOUND", "프로젝트를 찾을 수 없거나 접근 권한이 없습니다.", HttpStatus.NOT_FOUND);
    }

    public record Access(
            String id,
            long ownerUserId,
            String name,
            String sourceType,
            String repositoryOwner,
            String repositoryName,
            String repositoryUrl,
            String defaultBranch,
            String workspaceBranch,
            String baseCommit,
            String lastRemoteCommit,
            String framework,
            int skippedFileCount,
            String status,
            long currentRevision,
            long publishedRevision,
            long storageBytes,
            ProjectRole role,
            Instant createdAt,
            Instant updatedAt
    ) {}
}

package com.interfacelab.backend.project;

import com.interfacelab.backend.auth.AuthenticatedUser;
import com.interfacelab.backend.common.PolazuException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
public class CollaborationService {
    private final JdbcTemplate jdbc;
    private final ProjectAccessService accessService;
    private final ProjectEventHub eventHub;

    public CollaborationService(JdbcTemplate jdbc, ProjectAccessService accessService, ProjectEventHub eventHub) {
        this.jdbc = jdbc;
        this.accessService = accessService;
        this.eventHub = eventHub;
    }

    public List<ProjectDtos.Member> members(String projectId, long userId) {
        accessService.requireRead(projectId, userId);
        return jdbc.query("""
                SELECT u.id, u.email, u.display_name, u.nickname, pm.role, pm.created_at
                FROM project_member pm JOIN app_user u ON u.id = pm.user_id
                WHERE pm.project_id = ?
                ORDER BY CASE pm.role WHEN 'OWNER' THEN 0 WHEN 'EDITOR' THEN 1 ELSE 2 END, u.display_name
                """, CollaborationService::mapMember, projectId);
    }

    @Transactional
    public ProjectDtos.Member addMember(String projectId, long ownerId, String rawEmail, String rawRole) {
        ProjectAccessService.Access access = accessService.requireManage(projectId, ownerId);
        String email = normalizeEmail(rawEmail);
        ProjectRole role = ProjectRole.parseMemberRole(rawRole);
        UserRow target = jdbc.query("SELECT id, email, display_name, nickname FROM app_user WHERE email = ?",
                rs -> rs.next() ? new UserRow(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4)) : null, email);
        if (target == null) {
            throw new PolazuException("MEMBER_ACCOUNT_NOT_FOUND", "가입된 계정을 찾을 수 없습니다. 현재 구현에서는 가입 후 초대할 수 있습니다.", HttpStatus.NOT_FOUND);
        }
        if (target.id() == access.ownerUserId()) {
            throw new PolazuException("OWNER_ROLE_IMMUTABLE", "프로젝트 소유자의 역할은 변경할 수 없습니다.", HttpStatus.CONFLICT);
        }
        Integer count = jdbc.queryForObject("SELECT COUNT(*) FROM project_member WHERE project_id = ? AND user_id = ?", Integer.class, projectId, target.id());
        if (count != null && count > 0) {
            jdbc.update("UPDATE project_member SET role = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE project_id = ? AND user_id = ?",
                    role.name(), projectId, target.id());
        } else {
            jdbc.update("INSERT INTO project_member(project_id, user_id, role) VALUES (?, ?, ?)", projectId, target.id(), role.name());
        }
        afterCommit(() -> {
            eventHub.notifyRoleChanged(projectId, access.workspaceBranch(), target.id(), role);
            eventHub.broadcast(projectId, access.workspaceBranch(), "members", Map.of("changed", true, "userId", target.id()));
        });
        return new ProjectDtos.Member(target.id(), target.email(), target.name(), target.nickname(), role, Instant.now());
    }

    @Transactional
    public ProjectDtos.Member updateMember(String projectId, long ownerId, long memberUserId, String rawRole) {
        ProjectAccessService.Access access = accessService.requireManage(projectId, ownerId);
        if (memberUserId == access.ownerUserId()) {
            throw new PolazuException("OWNER_ROLE_IMMUTABLE", "프로젝트 소유자의 역할은 변경할 수 없습니다.", HttpStatus.CONFLICT);
        }
        ProjectRole role = ProjectRole.parseMemberRole(rawRole);
        int updated = jdbc.update("UPDATE project_member SET role = ?, updated_at = CURRENT_TIMESTAMP(6) WHERE project_id = ? AND user_id = ?",
                role.name(), projectId, memberUserId);
        if (updated == 0) throw new PolazuException("MEMBER_NOT_FOUND", "프로젝트 멤버를 찾을 수 없습니다.", HttpStatus.NOT_FOUND);
        afterCommit(() -> eventHub.notifyRoleChanged(projectId, access.workspaceBranch(), memberUserId, role));
        return jdbc.query("""
                SELECT u.id, u.email, u.display_name, u.nickname, pm.role, pm.created_at
                FROM project_member pm JOIN app_user u ON u.id = pm.user_id
                WHERE pm.project_id = ? AND pm.user_id = ?
                """, rs -> { if (!rs.next()) throw new IllegalStateException(); return mapMember(rs, 0); }, projectId, memberUserId);
    }

    @Transactional
    public void removeMember(String projectId, long ownerId, long memberUserId) {
        ProjectAccessService.Access access = accessService.requireManage(projectId, ownerId);
        if (memberUserId == access.ownerUserId()) {
            throw new PolazuException("OWNER_ROLE_IMMUTABLE", "프로젝트 소유자는 제거할 수 없습니다.", HttpStatus.CONFLICT);
        }
        int deleted = jdbc.update("DELETE FROM project_member WHERE project_id = ? AND user_id = ?", projectId, memberUserId);
        if (deleted == 0) throw new PolazuException("MEMBER_NOT_FOUND", "프로젝트 멤버를 찾을 수 없습니다.", HttpStatus.NOT_FOUND);
        afterCommit(() -> {
            eventHub.revoke(projectId, access.workspaceBranch(), memberUserId);
            eventHub.broadcast(projectId, access.workspaceBranch(), "members", Map.of("removed", true, "userId", memberUserId));
        });
    }

    public List<ProjectDtos.Comment> comments(String projectId, long userId, String status) {
        ProjectAccessService.Access access = accessService.requireRead(projectId, userId);
        String normalized = status == null || status.isBlank() ? "ALL" : status.trim().toUpperCase(Locale.ROOT);
        if (!List.of("ALL", "OPEN", "RESOLVED").contains(normalized)) {
            throw new PolazuException("INVALID_COMMENT_STATUS", "댓글 상태는 OPEN 또는 RESOLVED여야 합니다.", HttpStatus.BAD_REQUEST);
        }
        String sql = """
                SELECT c.id, c.file_path, c.selector, c.body, c.status, c.author_user_id,
                       u.display_name AS author_name, u.nickname AS author_nickname,
                       c.created_at, c.updated_at, c.resolved_at
                FROM project_comment c JOIN app_user u ON u.id = c.author_user_id
                WHERE c.project_id = ? AND c.branch_name = ?
                """ + ("ALL".equals(normalized) ? "" : " AND c.status = ?") + " ORDER BY c.created_at DESC";
        return "ALL".equals(normalized)
                ? jdbc.query(sql, CollaborationService::mapComment, projectId, access.workspaceBranch())
                : jdbc.query(sql, CollaborationService::mapComment, projectId, access.workspaceBranch(), normalized);
    }

    @Transactional
    public ProjectDtos.Comment addComment(
            String projectId,
            AuthenticatedUser user,
            String rawBody,
            String rawFilePath,
            String rawSelector
    ) {
        ProjectAccessService.Access access = accessService.requireRead(projectId, user.id());
        String body = requireText(rawBody, "댓글", 1, 4000);
        String filePath = rawFilePath == null || rawFilePath.isBlank() ? null : WorkspacePath.normalize(rawFilePath);
        String selector = optional(rawSelector, 1200);
        String id = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO project_comment(id, project_id, branch_name, file_path, selector, body, author_user_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, id, projectId, access.workspaceBranch(), filePath, selector, body, user.id());
        ProjectDtos.Comment comment = new ProjectDtos.Comment(id, filePath, selector, body, "OPEN", user.id(), user.name(), user.nickname(),
                Instant.now(), Instant.now(), null);
        afterCommit(() -> eventHub.broadcast(projectId, access.workspaceBranch(), "comment", comment));
        return comment;
    }

    @Transactional
    public ProjectDtos.Comment setCommentStatus(
            String projectId,
            String commentId,
            AuthenticatedUser user,
            String rawStatus
    ) {
        ProjectAccessService.Access access = accessService.requireRead(projectId, user.id());
        CommentOwner owner = jdbc.query("SELECT author_user_id, status FROM project_comment WHERE id = ? AND project_id = ?",
                rs -> rs.next() ? new CommentOwner(rs.getLong(1), rs.getString(2)) : null, commentId, projectId);
        if (owner == null) throw new PolazuException("COMMENT_NOT_FOUND", "댓글을 찾을 수 없습니다.", HttpStatus.NOT_FOUND);
        if (owner.authorUserId() != user.id() && !access.role().canWrite()) {
            throw new PolazuException("COMMENT_UPDATE_FORBIDDEN", "작성자 또는 수정 권한이 있는 멤버만 댓글 상태를 변경할 수 있습니다.", HttpStatus.FORBIDDEN);
        }
        String status = rawStatus == null ? "" : rawStatus.trim().toUpperCase(Locale.ROOT);
        if (!List.of("OPEN", "RESOLVED").contains(status)) {
            throw new PolazuException("INVALID_COMMENT_STATUS", "댓글 상태는 OPEN 또는 RESOLVED여야 합니다.", HttpStatus.BAD_REQUEST);
        }
        if ("RESOLVED".equals(status)) {
            jdbc.update("""
                    UPDATE project_comment SET status = 'RESOLVED', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP(6), updated_at = CURRENT_TIMESTAMP(6)
                    WHERE id = ? AND project_id = ?
                    """, user.id(), commentId, projectId);
        } else {
            jdbc.update("""
                    UPDATE project_comment SET status = 'OPEN', resolved_by = NULL, resolved_at = NULL, updated_at = CURRENT_TIMESTAMP(6)
                    WHERE id = ? AND project_id = ?
                    """, commentId, projectId);
        }
        ProjectDtos.Comment result = jdbc.query("""
                SELECT c.id, c.file_path, c.selector, c.body, c.status, c.author_user_id,
                       u.display_name AS author_name, u.nickname AS author_nickname,
                       c.created_at, c.updated_at, c.resolved_at
                FROM project_comment c JOIN app_user u ON u.id = c.author_user_id
                WHERE c.id = ?
                """, rs -> { if (!rs.next()) throw new IllegalStateException(); return mapComment(rs, 0); }, commentId);
        afterCommit(() -> eventHub.broadcast(projectId, access.workspaceBranch(), "comment", result));
        return result;
    }

    private static String normalizeEmail(String raw) {
        String email = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (email.length() < 3 || email.length() > 254 || !email.contains("@")) {
            throw new PolazuException("INVALID_EMAIL", "올바른 이메일 주소를 입력해 주세요.", HttpStatus.BAD_REQUEST);
        }
        return email;
    }

    private static String requireText(String raw, String label, int min, int max) {
        String value = raw == null ? "" : raw.trim();
        if (value.length() < min || value.length() > max) {
            throw new PolazuException("INVALID_REQUEST", label + "은(는) " + min + "~" + max + "자로 입력해 주세요.", HttpStatus.BAD_REQUEST);
        }
        return value;
    }

    private static String optional(String raw, int max) {
        if (raw == null || raw.isBlank()) return null;
        String value = raw.trim();
        if (value.length() > max) throw new PolazuException("INVALID_REQUEST", "입력값이 너무 깁니다.", HttpStatus.BAD_REQUEST);
        return value;
    }

    private static void afterCommit(Runnable action) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) { action.run(); return; }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override public void afterCommit() { action.run(); }
        });
    }

    private static ProjectDtos.Member mapMember(ResultSet rs, int row) throws SQLException {
        return new ProjectDtos.Member(rs.getLong("id"), rs.getString("email"), rs.getString("display_name"), rs.getString("nickname"),
                ProjectRole.valueOf(rs.getString("role")), rs.getTimestamp("created_at").toInstant());
    }

    private static ProjectDtos.Comment mapComment(ResultSet rs, int row) throws SQLException {
        var resolved = rs.getTimestamp("resolved_at");
        return new ProjectDtos.Comment(
                rs.getString("id"), rs.getString("file_path"), rs.getString("selector"), rs.getString("body"),
                rs.getString("status"), rs.getLong("author_user_id"), rs.getString("author_name"), rs.getString("author_nickname"),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant(),
                resolved == null ? null : resolved.toInstant()
        );
    }

    private record UserRow(long id, String email, String name, String nickname) {}
    private record CommentOwner(long authorUserId, String status) {}
}

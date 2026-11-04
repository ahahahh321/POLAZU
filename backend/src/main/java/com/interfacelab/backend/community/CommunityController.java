package com.interfacelab.backend.community;

import com.interfacelab.backend.auth.dto.MemberResponse;
import com.interfacelab.backend.auth.exception.AuthException;
import com.interfacelab.backend.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/community")
public class CommunityController {
    private static final Set<Integer> COMPONENT_IDS = Set.of(1, 2, 3, 4, 5, 6);
    private final JdbcTemplate jdbc;
    private final AuthService auth;

    public CommunityController(JdbcTemplate jdbc, AuthService auth) {
        this.jdbc = jdbc;
        this.auth = auth;
    }

    @GetMapping("/saved")
    public List<Integer> saved(HttpServletRequest request) {
        return jdbc.queryForList(
            "SELECT component_id FROM community_saves WHERE member_id = ? ORDER BY component_id",
            Integer.class, member(request).id());
    }

    @PutMapping("/saved/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void save(@PathVariable int id, @RequestBody SaveRequest body, HttpServletRequest request) {
        requireComponent(id);
        long memberId = member(request).id();
        if (body.saved()) {
            try {
                jdbc.update("INSERT INTO community_saves (member_id, component_id) VALUES (?, ?)", memberId, id);
            } catch (DuplicateKeyException ignored) {
                // Repeated saves leave the existing bookmark intact.
            }
        } else {
            jdbc.update("DELETE FROM community_saves WHERE member_id = ? AND component_id = ?", memberId, id);
        }
    }

    @GetMapping("/components/{id}/comments")
    public List<Comment> comments(@PathVariable int id) {
        requireComponent(id);
        return jdbc.query("""
            SELECT c.id, m.nickname, c.body, c.created_at
            FROM community_comments c JOIN members m ON c.member_id = m.id
            WHERE c.component_id = ?
            ORDER BY c.id DESC LIMIT 50
            """, (row, index) -> new Comment(row.getLong("id"), row.getString("nickname"),
                row.getString("body"), row.getTimestamp("created_at").toInstant()), id);
    }

    @PostMapping("/components/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    public void comment(@PathVariable int id, @Valid @RequestBody CommentRequest body, HttpServletRequest request) {
        requireComponent(id);
        jdbc.update("INSERT INTO community_comments (member_id, component_id, body) VALUES (?, ?, ?)",
            member(request).id(), id, body.body().strip());
    }

    private MemberResponse member(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null && session.getAttribute(AuthService.SESSION_AUTH_KEY) instanceof Long id) {
            return auth.getAuthenticatedMember(id);
        }
        throw new AuthException("UNAUTHORIZED", "로그인이 필요합니다.", HttpStatus.UNAUTHORIZED);
    }

    private static void requireComponent(int id) {
        if (!COMPONENT_IDS.contains(id)) throw new AuthException("COMPONENT_NOT_FOUND", "컴포넌트를 찾을 수 없어요.", HttpStatus.NOT_FOUND);
    }

    public record SaveRequest(boolean saved) {}
    public record CommentRequest(@NotBlank @Size(max = 1000) String body) {}
    public record Comment(long id, String author, String body, Instant createdAt) {}
}

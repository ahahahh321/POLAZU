package com.interfacelab.backend.project;

import com.interfacelab.backend.auth.AuthService;
import com.interfacelab.backend.auth.AuthenticatedUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects/{projectId}")
public class CollaborationController {
    private final AuthService authService;
    private final CollaborationService service;

    public CollaborationController(AuthService authService, CollaborationService service) {
        this.authService = authService;
        this.service = service;
    }

    @GetMapping("/members")
    public List<ProjectDtos.Member> members(@PathVariable String projectId, HttpServletRequest request) {
        return service.members(projectId, user(request).id());
    }

    @PostMapping("/members")
    public ProjectDtos.Member addMember(
            @PathVariable String projectId,
            @Valid @RequestBody MemberRequest body,
            HttpServletRequest request
    ) {
        return service.addMember(projectId, user(request).id(), body.email(), body.role());
    }

    @PatchMapping("/members/{memberUserId}")
    public ProjectDtos.Member updateMember(
            @PathVariable String projectId,
            @PathVariable long memberUserId,
            @Valid @RequestBody RoleRequest body,
            HttpServletRequest request
    ) {
        return service.updateMember(projectId, user(request).id(), memberUserId, body.role());
    }

    @DeleteMapping("/members/{memberUserId}")
    public Map<String, Boolean> removeMember(
            @PathVariable String projectId,
            @PathVariable long memberUserId,
            HttpServletRequest request
    ) {
        service.removeMember(projectId, user(request).id(), memberUserId);
        return Map.of("removed", true);
    }

    @GetMapping("/comments")
    public List<ProjectDtos.Comment> comments(
            @PathVariable String projectId,
            @RequestParam(defaultValue = "ALL") String status,
            HttpServletRequest request
    ) {
        return service.comments(projectId, user(request).id(), status);
    }

    @PostMapping("/comments")
    public ProjectDtos.Comment addComment(
            @PathVariable String projectId,
            @Valid @RequestBody CommentRequest body,
            HttpServletRequest request
    ) {
        return service.addComment(projectId, user(request), body.body(), body.filePath(), body.selector());
    }

    @PatchMapping("/comments/{commentId}")
    public ProjectDtos.Comment updateComment(
            @PathVariable String projectId,
            @PathVariable String commentId,
            @Valid @RequestBody CommentStatusRequest body,
            HttpServletRequest request
    ) {
        return service.setCommentStatus(projectId, commentId, user(request), body.status());
    }

    private AuthenticatedUser user(HttpServletRequest request) { return authService.requireUser(request); }

    public record MemberRequest(@NotBlank @Email @Size(max = 254) String email, @NotBlank @Size(max = 16) String role) {}
    public record RoleRequest(@NotBlank @Size(max = 16) String role) {}
    public record CommentRequest(
            @NotBlank @Size(max = 4000) String body,
            @Size(max = 1024) String filePath,
            @Size(max = 1200) String selector
    ) {}
    public record CommentStatusRequest(@NotBlank @Size(max = 16) String status) {}
}

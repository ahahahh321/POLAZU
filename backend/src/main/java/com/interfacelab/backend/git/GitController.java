package com.interfacelab.backend.git;

import com.interfacelab.backend.auth.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects/{projectId}/git")
public class GitController {
    private final GitHubPublishService service;
    private final AuthService authService;

    public GitController(GitHubPublishService service, AuthService authService) {
        this.service = service;
        this.authService = authService;
    }

    @PostMapping("/remote/check")
    public ResponseEntity<GitDtos.RemoteStatus> check(
            @PathVariable String projectId,
            @RequestBody GitDtos.RemoteCheckRequest request,
            HttpServletRequest servletRequest
    ) {
        long userId = authService.requireUser(servletRequest).id();
        return noStore(service.checkRemote(projectId, userId, request));
    }


    @PostMapping("/remote/apply")
    public ResponseEntity<GitDtos.RemoteApplyResult> applyRemote(
            @PathVariable String projectId,
            @RequestBody GitDtos.RemoteApplyRequest request,
            HttpServletRequest servletRequest
    ) {
        return noStore(service.applyRemote(projectId, authService.requireUser(servletRequest), request));
    }

    @PostMapping("/publish")
    public ResponseEntity<GitDtos.PublishResult> publish(
            @PathVariable String projectId,
            @RequestBody GitDtos.PublishRequest request,
            HttpServletRequest servletRequest
    ) {
        long userId = authService.requireUser(servletRequest).id();
        return noStore(service.publish(projectId, userId, request));
    }

    @GetMapping("/operations")
    public ResponseEntity<List<GitDtos.GitOperationSummary>> operations(
            @PathVariable String projectId,
            HttpServletRequest servletRequest
    ) {
        long userId = authService.requireUser(servletRequest).id();
        return noStore(service.operations(projectId, userId));
    }

    private static <T> ResponseEntity<T> noStore(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}

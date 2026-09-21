package com.interfacelab.backend.projectimport;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 기존 에디터의 공개 저장소 미리보기 API를 호환용으로 유지합니다. 영구 저장은 /api/projects를 사용합니다. */
@RestController
@RequestMapping("/api/editor/import")
public class ProjectImportController {
    private final GitHubImportService importService;
    private final LocalImportRateLimiter rateLimiter;

    public ProjectImportController(GitHubImportService importService, LocalImportRateLimiter rateLimiter) {
        this.importService = importService;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/github")
    public ResponseEntity<ImportedProjectResponse> importGitHub(
            @Valid @RequestBody GitHubImportRequest request,
            HttpServletRequest servletRequest
    ) {
        rateLimiter.check(servletRequest.getRemoteAddr());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(importService.importPublicRepository(request.repositoryUrl(), request.ref()));
    }
}

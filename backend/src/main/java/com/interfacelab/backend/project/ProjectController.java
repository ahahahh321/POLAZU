package com.interfacelab.backend.project;

import com.interfacelab.backend.auth.AuthService;
import com.interfacelab.backend.auth.AuthenticatedUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
    private final AuthService authService;
    private final ProjectService projectService;

    public ProjectController(AuthService authService, ProjectService projectService) {
        this.authService = authService;
        this.projectService = projectService;
    }

    @GetMapping("/limits")
    public ProjectDtos.Limits limits() {
        return new ProjectDtos.Limits(33_554_432L, 4_194_304L, 2_500, 67_108_864L, 134_217_728L);
    }

    @GetMapping
    public List<ProjectDtos.ProjectSummary> list(
            HttpServletRequest request,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String status
    ) {
        return projectService.list(user(request).id(), query, status);
    }

    @GetMapping("/{projectId}")
    public ProjectDtos.ProjectDetails details(@PathVariable String projectId, HttpServletRequest request) {
        return projectService.details(projectId, user(request).id());
    }

    @PostMapping
    public ProjectDtos.ProjectDetails create(@Valid @RequestBody CreateProjectRequest body, HttpServletRequest request) {
        return projectService.createEmpty(user(request), body.name());
    }

    @PostMapping("/import/github")
    public ProjectDtos.ProjectDetails importGithub(
            @Valid @RequestBody GitHubProjectRequest body,
            HttpServletRequest request
    ) {
        return projectService.importGitHub(user(request), body.repositoryUrl(), body.ref(), body.accessToken(), body.name());
    }

    @PostMapping(value = "/import/zip", consumes = "multipart/form-data")
    public ProjectDtos.ProjectDetails importZip(
            @RequestPart("file") MultipartFile file,
            @RequestPart(value = "name", required = false) String name,
            HttpServletRequest request
    ) {
        return projectService.importZip(user(request), file, name);
    }

    @PatchMapping("/{projectId}")
    public ProjectDtos.ProjectDetails rename(
            @PathVariable String projectId,
            @Valid @RequestBody RenameProjectRequest body,
            HttpServletRequest request
    ) {
        return projectService.rename(projectId, user(request).id(), body.name());
    }

    @PostMapping("/{projectId}/status")
    public ProjectDtos.ProjectDetails status(
            @PathVariable String projectId,
            @Valid @RequestBody StatusRequest body,
            HttpServletRequest request
    ) {
        return projectService.setStatus(projectId, user(request).id(), body.status());
    }

    @DeleteMapping("/{projectId}")
    public ProjectDtos.ProjectDetails delete(@PathVariable String projectId, HttpServletRequest request) {
        return projectService.setStatus(projectId, user(request).id(), "DELETED");
    }

    @PostMapping("/{projectId}/repository")
    public ProjectDtos.ProjectDetails connectRepository(
            @PathVariable String projectId,
            @Valid @RequestBody ConnectRepositoryRequest body,
            HttpServletRequest request
    ) {
        return projectService.connectRepository(projectId, user(request).id(), body.repositoryUrl(), body.defaultBranch(), body.baseCommit());
    }

    private AuthenticatedUser user(HttpServletRequest request) { return authService.requireUser(request); }

    public record CreateProjectRequest(@NotBlank @Size(max = 120) String name) {}
    public record RenameProjectRequest(@NotBlank @Size(max = 120) String name) {}
    public record StatusRequest(@NotBlank @Size(max = 20) String status) {}
    public record GitHubProjectRequest(
            @NotBlank @Size(max = 300) String repositoryUrl,
            @Size(max = 120) String ref,
            @Size(max = 300) String accessToken,
            @Size(max = 120) String name
    ) {}
    public record ConnectRepositoryRequest(
            @NotBlank @Size(max = 300) String repositoryUrl,
            @Size(max = 120) String defaultBranch,
            @Size(max = 64) String baseCommit
    ) {}
}

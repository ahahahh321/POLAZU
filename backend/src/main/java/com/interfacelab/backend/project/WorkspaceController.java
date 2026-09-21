package com.interfacelab.backend.project;

import com.interfacelab.backend.auth.AuthService;
import com.interfacelab.backend.auth.AuthenticatedUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/projects/{projectId}")
public class WorkspaceController {
    private final AuthService authService;
    private final WorkspaceService workspaceService;
    private final ProjectAccessService accessService;
    private final ProjectEventHub eventHub;

    public WorkspaceController(
            AuthService authService,
            WorkspaceService workspaceService,
            ProjectAccessService accessService,
            ProjectEventHub eventHub
    ) {
        this.authService = authService;
        this.workspaceService = workspaceService;
        this.accessService = accessService;
        this.eventHub = eventHub;
    }

    @GetMapping("/workspace")
    public ResponseEntity<ProjectDtos.WorkspaceSnapshot> snapshot(@PathVariable String projectId, HttpServletRequest request) {
        ProjectDtos.WorkspaceSnapshot snapshot = workspaceService.snapshot(projectId, user(request));
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .header("X-Polazu-Revision", Long.toString(snapshot.revision())).body(snapshot);
    }

    @PostMapping("/workspace/changes")
    public ProjectDtos.ChangeResult save(
            @PathVariable String projectId,
            @RequestParam(defaultValue = "EDIT") String kind,
            @RequestBody ProjectDtos.ChangeRequest body,
            HttpServletRequest request
    ) {
        return workspaceService.saveChanges(projectId, user(request), body, kind);
    }

    @GetMapping("/workspace/revisions")
    public List<ProjectDtos.RevisionSummary> revisions(
            @PathVariable String projectId,
            @RequestParam(defaultValue = "50") int limit,
            HttpServletRequest request
    ) {
        return workspaceService.revisions(projectId, user(request).id(), limit);
    }

    @GetMapping(value = "/workspace/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter events(@PathVariable String projectId, HttpServletRequest request) {
        AuthenticatedUser user = user(request);
        ProjectAccessService.Access access = accessService.requireRead(projectId, user.id());
        return eventHub.subscribe(projectId, access.workspaceBranch(), user);
    }

    @PostMapping("/workspace/presence")
    public Map<String, Object> presence(
            @PathVariable String projectId,
            @RequestBody(required = false) PresenceRequest body,
            HttpServletRequest request
    ) {
        AuthenticatedUser user = user(request);
        ProjectAccessService.Access access = accessService.requireRead(projectId, user.id());
        eventHub.touch(projectId, access.workspaceBranch(), user, body == null ? "workspace" : body.location());
        return Map.of("presence", eventHub.current(projectId, access.workspaceBranch()));
    }

    @GetMapping("/versions")
    public List<ProjectDtos.VersionSummary> versions(@PathVariable String projectId, HttpServletRequest request) {
        return workspaceService.versions(projectId, user(request).id());
    }

    @PostMapping("/versions")
    public ProjectDtos.VersionSummary createVersion(
            @PathVariable String projectId,
            @Valid @RequestBody VersionRequest body,
            HttpServletRequest request
    ) {
        return workspaceService.createVersion(projectId, user(request), body.name(), body.summary());
    }

    @PostMapping("/versions/{versionId}/restore")
    public ProjectDtos.ChangeResult restoreVersion(
            @PathVariable String projectId,
            @PathVariable String versionId,
            @RequestBody RestoreVersionRequest body,
            HttpServletRequest request
    ) {
        return workspaceService.restoreVersion(projectId, versionId, user(request), body.baseRevision());
    }

    @GetMapping("/export.zip")
    public ResponseEntity<byte[]> export(@PathVariable String projectId, HttpServletRequest request) {
        ProjectAccessService.Access access = accessService.requireRead(projectId, user(request).id());
        byte[] bytes = workspaceService.exportZip(projectId, user(request).id());
        String filename = access.name().replaceAll("[^A-Za-z0-9가-힣._-]+", "-") + "-r" + access.currentRevision() + ".zip";
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(filename, StandardCharsets.UTF_8).build().toString())
                .body(bytes);
    }

    private AuthenticatedUser user(HttpServletRequest request) { return authService.requireUser(request); }

    public record PresenceRequest(@Size(max = 160) String location) {}
    public record VersionRequest(@NotBlank @Size(max = 100) String name, @Size(max = 500) String summary) {}
    public record RestoreVersionRequest(long baseRevision) {}
}

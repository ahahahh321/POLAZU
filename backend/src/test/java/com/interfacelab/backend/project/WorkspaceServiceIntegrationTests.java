package com.interfacelab.backend.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.interfacelab.backend.auth.AuthenticatedUser;
import com.interfacelab.backend.common.PolazuException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@Transactional
class WorkspaceServiceIntegrationTests {
    @Autowired JdbcTemplate jdbc;
    @Autowired ProjectService projectService;
    @Autowired WorkspaceService workspaceService;

    @Test
    void savesIdempotentlyRejectsStaleRevisionsAndEnforcesViewerRole() {
        AuthenticatedUser owner = createUser("owner@polazu.test", "Owner", "owner");
        AuthenticatedUser viewer = createUser("viewer@polazu.test", "Viewer", "viewer");
        ProjectDtos.ProjectDetails project = projectService.createEmpty(owner, "Workspace integration");
        jdbc.update("INSERT INTO project_member(project_id, user_id, role) VALUES (?, ?, 'VIEWER')", project.id(), viewer.id());

        ProjectDtos.ChangeRequest firstRequest = new ProjectDtos.ChangeRequest(
                0,
                "integration-save-1",
                "HTML 제목 변경",
                List.of(new ProjectDtos.FileChange(
                        "/index.html",
                        "<!doctype html><html lang=\"ko\"><body><h1>Saved</h1></body></html>",
                        null,
                        false
                ))
        );

        ProjectDtos.ChangeResult first = workspaceService.saveChanges(project.id(), owner, firstRequest, "CODE");
        assertEquals(1, first.revision());
        assertFalse(first.duplicate());

        ProjectDtos.ChangeResult duplicate = workspaceService.saveChanges(project.id(), owner, firstRequest, "CODE");
        assertEquals(1, duplicate.revision());
        assertTrue(duplicate.duplicate());

        PolazuException stale = assertThrows(PolazuException.class, () -> workspaceService.saveChanges(
                project.id(),
                owner,
                new ProjectDtos.ChangeRequest(
                        0,
                        "integration-stale-1",
                        "오래된 수정",
                        List.of(new ProjectDtos.FileChange("/index.html", "stale", null, false))
                ),
                "CODE"
        ));
        assertEquals("REVISION_CONFLICT", stale.code());

        PolazuException forbidden = assertThrows(PolazuException.class, () -> workspaceService.saveChanges(
                project.id(),
                viewer,
                new ProjectDtos.ChangeRequest(
                        1,
                        "integration-viewer-1",
                        "뷰어 수정 시도",
                        List.of(new ProjectDtos.FileChange("/readme.md", "blocked", null, false))
                ),
                "CODE"
        ));
        assertEquals("PROJECT_WRITE_FORBIDDEN", forbidden.code());

        ProjectDtos.WorkspaceSnapshot snapshot = workspaceService.snapshot(project.id(), owner);
        assertEquals(1, snapshot.revision());
        assertTrue(snapshot.files().get("/index.html").contains("Saved"));
    }

    private AuthenticatedUser createUser(String email, String name, String nickname) {
        jdbc.update("""
                INSERT INTO app_user(email, password_hash, display_name, nickname, locale)
                VALUES (?, 'test-only', ?, ?, 'ko')
                """, email, name, nickname);
        Long id = jdbc.queryForObject("SELECT id FROM app_user WHERE email = ?", Long.class, email);
        if (id == null) throw new IllegalStateException("test user id was not generated");
        return new AuthenticatedUser(id, email, name, nickname, null, "ko");
    }
}

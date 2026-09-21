package com.interfacelab.backend.project;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import com.interfacelab.backend.common.PolazuException;
import org.junit.jupiter.api.Test;

class WorkspacePathTests {
    @Test
    void normalizesProjectPathsAndRejectsTraversalOrSecrets() {
        assertEquals("/src/App.tsx", WorkspacePath.normalize("src/App.tsx"));
        assertThrows(PolazuException.class, () -> WorkspacePath.normalize("../outside.ts"));
        assertThrows(PolazuException.class, () -> WorkspacePath.normalize("/.env"));
        assertThrows(PolazuException.class, () -> WorkspacePath.normalize("/keys/private.pem"));
    }
}

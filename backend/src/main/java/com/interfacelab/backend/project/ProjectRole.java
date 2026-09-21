package com.interfacelab.backend.project;

import com.interfacelab.backend.common.PolazuException;
import org.springframework.http.HttpStatus;

public enum ProjectRole {
    OWNER,
    EDITOR,
    VIEWER;

    public boolean canWrite() { return this == OWNER || this == EDITOR; }
    public boolean canManage() { return this == OWNER; }

    public static ProjectRole parseMemberRole(String raw) {
        try {
            ProjectRole role = ProjectRole.valueOf(raw == null ? "" : raw.trim().toUpperCase());
            if (role == OWNER) throw new IllegalArgumentException();
            return role;
        } catch (IllegalArgumentException exception) {
            throw new PolazuException("INVALID_ROLE", "멤버 역할은 EDITOR 또는 VIEWER여야 합니다.", HttpStatus.BAD_REQUEST);
        }
    }
}

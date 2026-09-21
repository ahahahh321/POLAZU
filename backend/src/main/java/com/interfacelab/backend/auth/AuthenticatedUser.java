package com.interfacelab.backend.auth;

public record AuthenticatedUser(
        long id,
        String email,
        String name,
        String nickname,
        String profileImageUrl,
        String locale
) {
}

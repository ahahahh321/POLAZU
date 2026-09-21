package com.interfacelab.backend.auth;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

class PasswordHasherTests {
    private final PasswordHasher hasher = new PasswordHasher();

    @Test
    void hashesWithSaltAndVerifiesWithoutStoringPlaintext() {
        String first = hasher.hash("CorrectHorse9");
        String second = hasher.hash("CorrectHorse9");
        assertFalse(first.equals(second));
        assertTrue(hasher.matches("CorrectHorse9", first));
        assertFalse(hasher.matches("wrong", first));
        assertFalse(first.contains("CorrectHorse9"));
    }
}

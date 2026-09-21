package com.interfacelab.backend.project;

import com.interfacelab.backend.common.PolazuException;
import com.interfacelab.backend.projectimport.RepositoryArchiveReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;
import org.springframework.http.HttpStatus;

public final class WorkspacePath {
    private static final Set<String> BLOCKED_DIRECTORIES = Set.of(
            ".git", "node_modules", ".next", ".nuxt", "dist", "build", "out", "coverage", "target", ".cache"
    );

    private WorkspacePath() {}

    public static String normalize(String raw) {
        String path = raw == null ? "" : raw.trim().replace('\\', '/');
        if (!path.startsWith("/")) path = "/" + path;
        if (path.length() < 2 || path.length() > 1024 || path.indexOf('\0') >= 0 || path.matches("^/[A-Za-z]:.*")) {
            throw invalid();
        }
        StringBuilder clean = new StringBuilder();
        for (String segment : path.substring(1).split("/")) {
            if (segment.isBlank() || segment.equals(".") || segment.equals("..") || segment.contains(":")) throw invalid();
            String lower = segment.toLowerCase(Locale.ROOT);
            if (BLOCKED_DIRECTORIES.contains(lower)) {
                throw new PolazuException("BLOCKED_PATH", "빌드 결과·캐시·의존성 폴더는 작업 공간에 저장할 수 없습니다.", HttpStatus.BAD_REQUEST);
            }
            if (!clean.isEmpty()) clean.append('/');
            clean.append(segment);
        }
        String normalized = "/" + clean;
        if (RepositoryArchiveReader.isSecretPath(normalized)) {
            throw new PolazuException("SECRET_FILE_BLOCKED", "환경변수·키·자격증명 파일은 작업 공간에 저장할 수 없습니다.", HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    public static String hash(String path) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(path.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    public static String contentSha(byte[] bytes) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static PolazuException invalid() {
        return new PolazuException("INVALID_FILE_PATH", "안전한 프로젝트 내부 파일 경로를 입력해 주세요.", HttpStatus.BAD_REQUEST);
    }
}

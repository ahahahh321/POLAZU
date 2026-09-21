package com.interfacelab.backend.projectimport;

import java.net.URI;
import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;

/** github.com의 owner/repository 주소만 허용해 SSRF 입력을 차단합니다. */
public record GitHubRepositoryAddress(String owner, String repository) {
    private static final Pattern NAME = Pattern.compile("[A-Za-z0-9][A-Za-z0-9_.-]{0,99}");

    public static GitHubRepositoryAddress parse(String rawUrl) {
        try {
            URI uri = URI.create(rawUrl == null ? "" : rawUrl.trim());
            String host = uri.getHost();
            if (!"https".equalsIgnoreCase(uri.getScheme())
                    || host == null
                    || !"github.com".equals(host.toLowerCase(Locale.ROOT))
                    || uri.getUserInfo() != null
                    || uri.getPort() != -1
                    || uri.getQuery() != null
                    || uri.getFragment() != null) {
                throw invalidAddress();
            }
            String[] parts = uri.getPath().split("/");
            if (parts.length != 3 || parts[1].isBlank() || parts[2].isBlank()) throw invalidAddress();
            String owner = parts[1];
            String repository = parts[2].endsWith(".git")
                    ? parts[2].substring(0, parts[2].length() - 4)
                    : parts[2];
            if (!NAME.matcher(owner).matches() || !NAME.matcher(repository).matches()) throw invalidAddress();
            return new GitHubRepositoryAddress(owner, repository);
        } catch (IllegalArgumentException exception) {
            throw invalidAddress();
        }
    }

    public String webUrl() {
        return "https://github.com/" + owner + "/" + repository;
    }

    private static EditorImportException invalidAddress() {
        return new EditorImportException(
                "INVALID_REPOSITORY_URL",
                "https://github.com/owner/repository 형식의 GitHub 주소만 사용할 수 있습니다.",
                HttpStatus.BAD_REQUEST
        );
    }
}

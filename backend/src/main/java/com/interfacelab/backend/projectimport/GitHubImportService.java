package com.interfacelab.backend.projectimport;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
public class GitHubImportService {
    private static final int MAX_METADATA_BYTES = 512 * 1024;
    private static final int MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
    private static final int MAX_DEPENDENCIES = 300;
    private static final Pattern SAFE_REF = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._/-]{0,119}");
    private static final Pattern PACKAGE_NAME = Pattern.compile("(?:@[a-z0-9._-]+/)?[a-z0-9._-]+", Pattern.CASE_INSENSITIVE);

    private final ObjectMapper objectMapper;
    private final RepositoryArchiveReader archiveReader;
    private final HttpClient httpClient;

    public GitHubImportService(ObjectMapper objectMapper, RepositoryArchiveReader archiveReader) {
        this.objectMapper = objectMapper;
        this.archiveReader = archiveReader;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(8))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public ImportedProjectResponse importPublicRepository(String repositoryUrl, String requestedRef) {
        return importRepository(repositoryUrl, requestedRef, null);
    }

    public ImportedProjectResponse importRepository(String repositoryUrl, String requestedRef, String accessToken) {
        GitHubRepositoryAddress address = GitHubRepositoryAddress.parse(repositoryUrl);
        RepositoryMetadata metadata = fetchMetadata(address, accessToken);
        String ref = requestedRef == null || requestedRef.isBlank()
                ? validateRef(metadata.defaultBranch())
                : validateRef(requestedRef.trim());
        String baseCommit = fetchHeadCommit(address, ref, accessToken);
        byte[] archive = downloadArchive(address, ref, accessToken);
        RepositoryArchiveReader.ArchiveContent content = archiveReader.read(archive);
        ProjectManifest manifest = detectManifest(content.files());
        return new ImportedProjectResponse(
                new ImportedProjectResponse.RepositorySource(address.owner(), address.repository(), ref, address.webUrl()),
                manifest.framework(),
                content.files(),
                manifest.dependencies(),
                content.skippedFileCount(),
                content.binaryFiles(),
                baseCommit
        );
    }

    private RepositoryMetadata fetchMetadata(GitHubRepositoryAddress address, String accessToken) {
        JsonNode node = getJson(
                URI.create("https://api.github.com/repos/" + address.owner() + "/" + address.repository()),
                accessToken,
                "REPOSITORY_NOT_FOUND",
                "저장소를 찾을 수 없거나 접근 권한이 없습니다. 비공개 저장소는 읽기 권한 토큰이 필요합니다."
        );
        return new RepositoryMetadata(node.path("default_branch").asText("main"), node.path("private").asBoolean(false));
    }

    private String fetchHeadCommit(GitHubRepositoryAddress address, String ref, String accessToken) {
        JsonNode node = getJson(
                URI.create("https://api.github.com/repos/" + address.owner() + "/" + address.repository() + "/git/ref/heads/" + encodePath(ref)),
                accessToken,
                "REF_NOT_FOUND",
                "요청한 브랜치를 찾을 수 없습니다."
        );
        String sha = node.path("object").path("sha").asText();
        if (!sha.matches("[a-fA-F0-9]{40,64}")) throw githubUnavailable(502);
        return sha;
    }

    private byte[] downloadArchive(GitHubRepositoryAddress address, String ref, String accessToken) {
        URI uri = URI.create("https://api.github.com/repos/" + address.owner() + "/" + address.repository() + "/zipball/" + encodePath(ref));
        HttpResponse<InputStream> response = send(uri, "application/vnd.github+json", accessToken);
        String finalHost = response.uri().getHost();
        if (finalHost == null || !(finalHost.equals("api.github.com") || finalHost.equals("codeload.github.com") || finalHost.endsWith(".githubusercontent.com"))) {
            closeQuietly(response.body());
            throw githubUnavailable(502);
        }
        if (response.statusCode() == 404) {
            closeQuietly(response.body());
            throw new EditorImportException("REF_NOT_FOUND", "요청한 저장소 또는 브랜치를 찾을 수 없습니다.", HttpStatus.NOT_FOUND);
        }
        if (response.statusCode() != 200) {
            closeQuietly(response.body());
            throw githubUnavailable(response.statusCode());
        }
        long length = response.headers().firstValueAsLong("Content-Length").orElse(-1);
        if (length > MAX_ARCHIVE_BYTES) {
            closeQuietly(response.body());
            throw new EditorImportException("REPOSITORY_LIMIT_EXCEEDED", "GitHub ZIP이 64MiB를 초과했습니다.", HttpStatus.PAYLOAD_TOO_LARGE);
        }
        try (InputStream body = response.body()) {
            return readLimited(body, MAX_ARCHIVE_BYTES, "GitHub ZIP이 64MiB를 초과했습니다.");
        } catch (IOException exception) {
            throw githubUnavailable(502);
        }
    }

    private JsonNode getJson(URI uri, String accessToken, String notFoundCode, String notFoundMessage) {
        HttpResponse<InputStream> response = send(uri, "application/vnd.github+json", accessToken);
        if (response.statusCode() == 404) {
            closeQuietly(response.body());
            throw new EditorImportException(notFoundCode, notFoundMessage, HttpStatus.NOT_FOUND);
        }
        if (response.statusCode() != 200) {
            closeQuietly(response.body());
            throw githubUnavailable(response.statusCode());
        }
        try (InputStream body = response.body()) {
            return objectMapper.readTree(readLimited(body, MAX_METADATA_BYTES, "GitHub 응답이 너무 큽니다."));
        } catch (IOException exception) {
            throw githubUnavailable(502);
        }
    }

    private HttpResponse<InputStream> send(URI uri, String accept, String accessToken) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(30))
                .header("Accept", accept)
                .header("User-Agent", "polazu-workspace")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .GET();
        if (accessToken != null && !accessToken.isBlank()) builder.header("Authorization", "Bearer " + accessToken.trim());
        try {
            return httpClient.send(builder.build(), HttpResponse.BodyHandlers.ofInputStream());
        } catch (IOException exception) {
            throw githubUnavailable(502);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw githubUnavailable(503);
        }
    }

    private ProjectManifest detectManifest(Map<String, String> files) {
        String manifestPath = files.keySet().stream()
                .filter(path -> path.endsWith("/package.json"))
                .sorted(java.util.Comparator.comparingInt(String::length).thenComparing(String::compareTo))
                .findFirst().orElse(null);
        if (manifestPath == null) return new ProjectManifest("HTML", Map.of());
        return readManifest(files.get(manifestPath));
    }

    private ProjectManifest readManifest(String packageJson) {
        try {
            JsonNode root = objectMapper.readTree(packageJson);
            Map<String, String> dependencies = new LinkedHashMap<>();
            copyDependencies(root.path("dependencies"), dependencies);
            copyDependencies(root.path("devDependencies"), dependencies);
            if (dependencies.containsKey("vue") || dependencies.containsKey("svelte")
                    || dependencies.containsKey("@angular/core") || dependencies.containsKey("astro")) {
                throw new EditorImportException(
                        "UNSUPPORTED_FRAMEWORK",
                        "현재는 React, Next.js, JavaScript/TypeScript, HTML/CSS, Tailwind CSS 프로젝트만 지원합니다.",
                        HttpStatus.UNPROCESSABLE_ENTITY
                );
            }
            String framework = dependencies.containsKey("next") ? "NEXTJS"
                    : dependencies.containsKey("react") ? "REACT"
                    : dependencies.containsKey("vite") ? "VITE"
                    : "JAVASCRIPT";
            return new ProjectManifest(framework, Map.copyOf(dependencies));
        } catch (JacksonException exception) {
            throw new EditorImportException("INVALID_PACKAGE_JSON", "package.json의 JSON 형식이 올바르지 않습니다.", HttpStatus.UNPROCESSABLE_ENTITY);
        }
    }

    private void copyDependencies(JsonNode node, Map<String, String> target) {
        if (!node.isObject()) return;
        node.forEachEntry((name, valueNode) -> {
            if (target.size() >= MAX_DEPENDENCIES) {
                throw new EditorImportException("TOO_MANY_DEPENDENCIES", "의존성 항목이 300개를 초과했습니다.", HttpStatus.UNPROCESSABLE_ENTITY);
            }
            String version = valueNode.asText();
            if (PACKAGE_NAME.matcher(name).matches() && version.length() <= 100) target.put(name, version);
        });
    }

    public static String validateRef(String ref) {
        if (ref == null || !SAFE_REF.matcher(ref).matches() || ref.contains("..") || ref.contains("//")
                || ref.endsWith("/") || ref.endsWith(".lock")) {
            throw new EditorImportException("INVALID_REF", "브랜치 이름이 올바르지 않습니다.", HttpStatus.BAD_REQUEST);
        }
        return ref;
    }

    public static String encodePath(String value) {
        String[] segments = value.split("/");
        StringBuilder encoded = new StringBuilder();
        for (String segment : segments) {
            if (!encoded.isEmpty()) encoded.append('/');
            encoded.append(URLEncoder.encode(segment, StandardCharsets.UTF_8).replace("+", "%20"));
        }
        return encoded.toString();
    }

    private static byte[] readLimited(InputStream input, int maxBytes, String message) throws IOException {
        byte[] content = input.readNBytes(maxBytes + 1);
        if (content.length > maxBytes) throw new EditorImportException("REPOSITORY_LIMIT_EXCEEDED", message, HttpStatus.PAYLOAD_TOO_LARGE);
        return content;
    }

    private static void closeQuietly(InputStream input) {
        try { input.close(); } catch (IOException ignored) { }
    }

    private static EditorImportException githubUnavailable(int statusCode) {
        String message = statusCode == 401 || statusCode == 403
                ? "GitHub 인증 또는 저장소 권한을 확인해 주세요. 토큰은 서버에 저장되지 않습니다."
                : statusCode == 429
                ? "GitHub 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
                : "GitHub와 통신하지 못했습니다.";
        HttpStatus status = statusCode == 401 || statusCode == 403 ? HttpStatus.FORBIDDEN : HttpStatus.BAD_GATEWAY;
        return new EditorImportException("GITHUB_UNAVAILABLE", message, status);
    }

    private record ProjectManifest(String framework, Map<String, String> dependencies) {}
    private record RepositoryMetadata(String defaultBranch, boolean privateRepository) {}
}

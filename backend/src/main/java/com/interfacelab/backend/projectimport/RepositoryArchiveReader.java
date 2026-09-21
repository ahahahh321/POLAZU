package com.interfacelab.backend.projectimport;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** ZIP 경로 이탈, 해제 폭탄, 심볼릭 링크, 대소문자 충돌과 비밀 파일을 방어합니다. */
@Component
public class RepositoryArchiveReader {
    public static final int MAX_FILE_COUNT = 2_500;
    public static final int MAX_FILE_BYTES = 4 * 1024 * 1024;
    public static final int MAX_STORED_BYTES = 32 * 1024 * 1024;
    public static final int MAX_EXPANDED_BYTES = 128 * 1024 * 1024;
    public static final int MAX_ARCHIVE_ENTRIES = 10_000;

    private static final Set<String> IGNORED_DIRECTORIES = Set.of(
            ".git", "node_modules", ".next", ".nuxt", "out", "dist", "build", "coverage", "target",
            ".cache", ".turbo", ".parcel-cache", ".idea", ".vscode", ".ssh", ".secrets", "secrets"
    );
    private static final Set<String> TEXT_EXTENSIONS = Set.of(
            "js", "jsx", "ts", "tsx", "mjs", "cjs", "css", "scss", "sass", "less",
            "html", "htm", "json", "md", "mdx", "svg", "txt", "yml", "yaml", "xml",
            "graphql", "gql"
    );
    private static final Set<String> ASSET_EXTENSIONS = Set.of(
            "png", "jpg", "jpeg", "gif", "webp", "avif", "ico", "woff", "woff2", "ttf", "otf"
    );
    private static final Set<String> SECRET_EXTENSIONS = Set.of("pem", "key", "p12", "pfx", "jks", "keystore");

    public ArchiveContent read(byte[] archiveBytes) {
        if (archiveBytes == null || archiveBytes.length == 0) throw invalidArchive("ZIP 파일이 비어 있습니다.");
        if (archiveBytes.length > 64 * 1024 * 1024) throw limitExceeded("ZIP 업로드는 64MiB를 초과할 수 없습니다.");
        rejectSymlinksAndEncryptedEntries(archiveBytes);

        List<RawEntry> rawEntries = readEntries(archiveBytes);
        String commonRoot = commonRoot(rawEntries);
        Map<String, String> files = new LinkedHashMap<>();
        Map<String, String> binaryFiles = new LinkedHashMap<>();
        Set<String> caseInsensitive = new HashSet<>();
        Map<String, Boolean> pathKinds = new HashMap<>();
        int skipped = 0;
        int storedBytes = 0;

        for (RawEntry raw : rawEntries) {
            if (raw.directory()) continue;
            String normalized = normalizePath(raw.name(), commonRoot);
            if (normalized == null || shouldIgnore(normalized)) {
                skipped++;
                continue;
            }
            boolean asset = isAsset(normalized);
            if (!asset && !isAllowedTextFile(normalized)) {
                skipped++;
                continue;
            }
            String lower = normalized.toLowerCase(Locale.ROOT);
            if (!caseInsensitive.add(lower)) {
                throw invalidArchive("대소문자만 다른 중복 경로가 있습니다: " + normalized);
            }
            ensureNoFileFolderCollision(normalized, pathKinds);
            if (files.size() + binaryFiles.size() >= MAX_FILE_COUNT) {
                throw limitExceeded("저장 가능한 파일 수 2,500개를 초과했습니다.");
            }
            storedBytes += raw.content().length;
            if (storedBytes > MAX_STORED_BYTES) {
                throw limitExceeded("공유 소스와 자산 합계가 32MiB를 초과했습니다.");
            }
            String path = "/" + normalized;
            if (asset) {
                binaryFiles.put(path, Base64.getEncoder().encodeToString(raw.content()));
            } else {
                if (containsNullByte(raw.content())) {
                    skipped++;
                    continue;
                }
                files.put(path, new String(raw.content(), StandardCharsets.UTF_8).replaceFirst("^\\uFEFF", ""));
            }
        }

        boolean entryPoint = files.keySet().stream().anyMatch(path ->
                path.endsWith("/package.json") || path.endsWith("/index.html") || path.matches(".*/(?:src/)?app/page\\.[jt]sx?")
        );
        if (!entryPoint) {
            throw new EditorImportException(
                    "PROJECT_ENTRY_REQUIRED",
                    "package.json, index.html 또는 app/page.tsx가 있는 React·Next.js·HTML 프로젝트가 필요합니다.",
                    HttpStatus.UNPROCESSABLE_ENTITY
            );
        }
        return new ArchiveContent(Map.copyOf(files), Map.copyOf(binaryFiles), skipped, storedBytes);
    }

    private static List<RawEntry> readEntries(byte[] archiveBytes) {
        List<RawEntry> entries = new ArrayList<>();
        int expanded = 0;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(archiveBytes), StandardCharsets.UTF_8)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                if (entries.size() >= MAX_ARCHIVE_ENTRIES) throw limitExceeded("ZIP 항목 수 10,000개를 초과했습니다.");
                String name = entry.getName();
                validateRawPath(name);
                byte[] content = entry.isDirectory() ? new byte[0] : readEntry(zip);
                expanded += content.length;
                if (expanded > MAX_EXPANDED_BYTES) throw limitExceeded("ZIP 해제 크기가 128MiB를 초과했습니다.");
                entries.add(new RawEntry(name, entry.isDirectory(), content));
            }
        } catch (EditorImportException exception) {
            throw exception;
        } catch (IOException exception) {
            throw invalidArchive("ZIP 파일을 읽을 수 없습니다.");
        }
        return entries;
    }

    private static void validateRawPath(String path) {
        if (path == null || path.isBlank() || path.length() > 2048 || path.startsWith("/") || path.startsWith("\\")
                || path.indexOf('\0') >= 0 || path.indexOf('\\') >= 0 || path.matches("^[A-Za-z]:.*")) {
            throw invalidArchive("안전하지 않은 ZIP 경로가 포함되어 있습니다.");
        }
        for (String segment : path.split("/")) {
            if (segment.equals("..") || segment.equals(".")) throw invalidArchive("ZIP 경로 이탈 항목이 포함되어 있습니다.");
        }
    }

    private static String commonRoot(List<RawEntry> entries) {
        String root = null;
        for (RawEntry entry : entries) {
            String name = entry.name();
            int slash = name.indexOf('/');
            if (slash < 0) return "";
            String first = name.substring(0, slash + 1);
            if (root == null) root = first;
            else if (!root.equals(first)) return "";
        }
        return root == null ? "" : root;
    }

    private static String normalizePath(String raw, String root) {
        String path = !root.isEmpty() && raw.startsWith(root) ? raw.substring(root.length()) : raw;
        while (path.startsWith("/")) path = path.substring(1);
        if (path.isBlank() || path.endsWith("/")) return null;
        if (path.length() > 1024) throw invalidArchive("파일 경로가 1,024자를 초과했습니다.");
        return path;
    }

    private static boolean shouldIgnore(String path) {
        String[] parts = path.split("/");
        for (String part : parts) {
            String lower = part.toLowerCase(Locale.ROOT);
            if (part.isBlank() || part.equals(".") || part.equals("..") || part.contains(":")) return true;
            if (IGNORED_DIRECTORIES.contains(lower)) return true;
        }
        String name = parts[parts.length - 1].toLowerCase(Locale.ROOT);
        return isSecretName(name);
    }

    public static boolean isSecretPath(String path) {
        String normalized = path == null ? "" : path.replace('\\', '/').toLowerCase(Locale.ROOT);
        String name = normalized.substring(normalized.lastIndexOf('/') + 1);
        return isSecretName(name) || normalized.contains("/secrets/") || normalized.contains("/.secrets/") || normalized.contains("/.ssh/");
    }

    private static boolean isSecretName(String name) {
        if (name.equals(".env") || name.startsWith(".env.") || name.equals(".npmrc") || name.equals(".yarnrc")) return true;
        if (name.contains("id_rsa") || name.contains("credential") || name.contains("private-key")
                || name.contains("service-account") || name.contains("access_token") || name.contains("secret-key")) return true;
        int dot = name.lastIndexOf('.');
        return dot >= 0 && SECRET_EXTENSIONS.contains(name.substring(dot + 1));
    }

    private static boolean isAllowedTextFile(String path) {
        String name = path.substring(path.lastIndexOf('/') + 1).toLowerCase(Locale.ROOT);
        if (name.startsWith(".") && !name.equals(".gitignore")) return false;
        if (name.endsWith(".lock") || name.equals("npm-shrinkwrap.json") || name.startsWith("pnpm-lock.")) return false;
        int dot = name.lastIndexOf('.');
        return name.equals("package.json") || name.equals("tsconfig.json") || (dot >= 0 && TEXT_EXTENSIONS.contains(name.substring(dot + 1)));
    }

    private static boolean isAsset(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        int dot = lower.lastIndexOf('.');
        return dot >= 0 && ASSET_EXTENSIONS.contains(lower.substring(dot + 1)) && !isSecretPath(path);
    }

    private static byte[] readEntry(ZipInputStream zip) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int read;
        while ((read = zip.read(buffer)) != -1) {
            if (output.size() + read > MAX_FILE_BYTES) throw limitExceeded("파일 하나의 크기가 4MiB를 초과했습니다.");
            output.write(buffer, 0, read);
        }
        return output.toByteArray();
    }

    private static void ensureNoFileFolderCollision(String path, Map<String, Boolean> kinds) {
        String[] parts = path.split("/");
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) current.append('/');
            current.append(parts[i].toLowerCase(Locale.ROOT));
            boolean file = i == parts.length - 1;
            Boolean previous = kinds.putIfAbsent(current.toString(), file);
            if (previous != null && previous != file) throw invalidArchive("파일과 폴더 경로가 충돌합니다: " + path);
        }
    }

    private static boolean containsNullByte(byte[] content) {
        for (byte value : content) if (value == 0) return true;
        return false;
    }

    /** Central directory의 Unix mode와 general purpose flag를 확인합니다. */
    private static void rejectSymlinksAndEncryptedEntries(byte[] bytes) {
        int i = 0;
        while (i + 46 <= bytes.length) {
            int signature = littleEndianInt(bytes, i);
            if (signature == 0x02014b50) {
                int flags = littleEndianShort(bytes, i + 8);
                if ((flags & 0x0001) != 0) throw invalidArchive("암호화된 ZIP 항목은 가져올 수 없습니다.");
                long externalAttributes = Integer.toUnsignedLong(littleEndianInt(bytes, i + 38));
                int unixMode = (int) ((externalAttributes >>> 16) & 0xFFFF);
                if ((unixMode & 0xF000) == 0xA000) throw invalidArchive("심볼릭 링크가 포함된 ZIP은 가져올 수 없습니다.");
                int nameLength = littleEndianShort(bytes, i + 28);
                int extraLength = littleEndianShort(bytes, i + 30);
                int commentLength = littleEndianShort(bytes, i + 32);
                i += 46 + nameLength + extraLength + commentLength;
            } else {
                i++;
            }
        }
    }

    private static int littleEndianShort(byte[] bytes, int offset) {
        return (bytes[offset] & 0xFF) | ((bytes[offset + 1] & 0xFF) << 8);
    }

    private static int littleEndianInt(byte[] bytes, int offset) {
        return littleEndianShort(bytes, offset) | (littleEndianShort(bytes, offset + 2) << 16);
    }

    private static EditorImportException invalidArchive(String message) {
        return new EditorImportException("INVALID_ARCHIVE", message, HttpStatus.BAD_REQUEST);
    }

    private static EditorImportException limitExceeded(String message) {
        return new EditorImportException("REPOSITORY_LIMIT_EXCEEDED", message, HttpStatus.PAYLOAD_TOO_LARGE);
    }

    private record RawEntry(String name, boolean directory, byte[] content) {}

    public record ArchiveContent(
            Map<String, String> files,
            Map<String, String> binaryFiles,
            int skippedFileCount,
            long storedBytes
    ) {}
}

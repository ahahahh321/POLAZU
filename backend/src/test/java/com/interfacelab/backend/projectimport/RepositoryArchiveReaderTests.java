package com.interfacelab.backend.projectimport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;

class RepositoryArchiveReaderTests {
    private final RepositoryArchiveReader reader = new RepositoryArchiveReader();

    @Test
    void acceptsSupportedSourcesAndSeparatesAssets() throws Exception {
        var content = reader.read(zip(Map.of(
                "repo/apps/web/package.json", "{\"dependencies\":{\"react\":\"19\"}}",
                "repo/apps/web/App.tsx", "export default () => <main>Hello</main>",
                "repo/apps/web/public/logo.png", "image-data",
                "repo/.secrets/data.json", "secret"
        )));
        assertTrue(content.files().containsKey("/apps/web/App.tsx"));
        assertTrue(content.binaryFiles().containsKey("/apps/web/public/logo.png"));
        assertFalse(content.files().containsKey("/.secrets/data.json"));
    }

    @Test
    void acceptsPlainHtmlAndRejectsOversizedEntriesEvenWhenExtensionIsExcluded() throws Exception {
        assertTrue(reader.read(zip(Map.of("repo/index.html", "<h1>Hello</h1>"))).files().containsKey("/index.html"));
        assertThrows(EditorImportException.class, () -> reader.read(zip(Map.of(
                "repo/index.html", "ok", "repo/ignored.bin", "x".repeat(RepositoryArchiveReader.MAX_FILE_BYTES + 1)
        ))));
    }

    @Test
    void skipsSecretsAndBuildArtifacts() throws Exception {
        Map<String, String> entries = new LinkedHashMap<>();
        entries.put("sample-root/package.json", "{\"dependencies\":{\"react\":\"19.0.0\"}}");
        entries.put("sample-root/src/App.tsx", "export default function App() { return <h1>Hello</h1>; }");
        entries.put("sample-root/.env", "SECRET=do-not-return");
        entries.put("sample-root/.yarnrc.yml", "npmAuthToken: do-not-return");
        entries.put("sample-root/package-lock.json", "{\"lockfileVersion\":3}");
        entries.put("sample-root/node_modules/library/index.js", "ignored");

        RepositoryArchiveReader.ArchiveContent content = reader.read(zip(entries));
        assertTrue(content.files().containsKey("/package.json"));
        assertTrue(content.files().containsKey("/src/App.tsx"));
        assertFalse(content.files().containsKey("/.env"));
        assertFalse(content.files().containsKey("/.yarnrc.yml"));
        assertTrue(content.files().containsKey("/package-lock.json"));
        assertEquals(3, content.skippedFileCount());
    }

    @Test
    void rejectsTraversalAndCaseOnlyCollisions() throws Exception {
        assertThrows(EditorImportException.class, () -> reader.read(zip(Map.of(
                "repo/index.html", "ok", "repo/../outside.ts", "unsafe"
        ))));
        assertThrows(EditorImportException.class, () -> reader.read(zip(Map.of(
                "repo/index.html", "ok", "repo/src/App.tsx", "a", "repo/src/app.tsx", "b"
        ))));
    }

    private static byte[] zip(Map<String, String> entries) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
            for (Map.Entry<String, String> entry : entries.entrySet()) {
                zip.putNextEntry(new ZipEntry(entry.getKey()));
                zip.write(entry.getValue().getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return bytes.toByteArray();
    }
}

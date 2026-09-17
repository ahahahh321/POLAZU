package com.interfacelab.backend.projectimport;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.Base64;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/**
 * GitHub ZIP???붿뒪?ъ뿉 ?吏 ?딄퀬 硫붾え由ъ뿉???쎌뒿?덈떎.
 * 寃쎈줈 ?덉텧, ZIP ??깂, 鍮꾨? ?뚯씪??李⑤떒?섍퀬 ?덉슜???대?吏/?고듃留?蹂꾨룄濡??꾨떖?⑸땲??
 */
@Component
class RepositoryArchiveReader {
	static final int MAX_FILE_COUNT = 300;
	static final int MAX_FILE_BYTES = 4 * 1024 * 1024;
	static final int MAX_TOTAL_TEXT_BYTES = 20 * 1024 * 1024;

	private static final Set<String> IGNORED_DIRECTORIES = Set.of(
			".git", "node_modules", ".next", "out", "dist", "build", "coverage"
	);
	private static final Set<String> TEXT_EXTENSIONS = Set.of(
			"js", "jsx", "ts", "tsx", "mjs", "cjs", "css", "scss", "sass", "less",
			"html", "json", "md", "mdx", "svg", "txt", "yml", "yaml", "xml", "vue", "svelte", "astro"
	);
	private static final Set<String> ASSET_EXTENSIONS = Set.of("png", "jpg", "jpeg", "gif", "webp", "ico", "woff", "woff2", "ttf");
	private static final Set<String> SECRET_EXTENSIONS = Set.of(
			"pem", "key", "p12", "pfx", "jks", "keystore"
	);

	ArchiveContent read(byte[] archiveBytes) {
		Map<String, String> files = new LinkedHashMap<>();
		Map<String, String> binaryFiles = new LinkedHashMap<>();
		int skipped = 0;
		int totalBytes = 0;
		int scannedBytes = 0;
		int entries = 0;

		try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(archiveBytes))) {
			ZipEntry entry;
			while ((entry = zip.getNextEntry()) != null) {
				if (++entries > 5000) throw limitExceeded("ZIP ??ぉ ?섍? ?쒗븳??珥덇낵?덉뒿?덈떎.");
				if (entry.isDirectory()) {
					continue;
				}

				String relativePath = safeRelativePath(entry.getName());
				// ?쒖쇅 ?뚯씪???쎄린 ?곹븳???곸슜???뺤텞 ??깂???꾪꽣瑜??고쉶?섏? 紐삵븯寃??⑸땲??
				byte[] content = readEntry(zip);
				scannedBytes += content.length;
				if (scannedBytes > 32 * 1024 * 1024) throw limitExceeded("ZIP ?댁젣 ?ш린媛 ?쒗븳??珥덇낵?덉뒿?덈떎.");
				boolean asset = relativePath != null && isAsset(relativePath);
				if (relativePath == null || (!isAllowedTextFile(relativePath) && !asset)) {
					skipped++;
					continue;
				}
				if (files.size() + binaryFiles.size() >= MAX_FILE_COUNT) {
					throw limitExceeded("??μ냼???띿뒪???뚯씪???덈Т 留롮뒿?덈떎.");
				}

				totalBytes += content.length;
				if (totalBytes > MAX_TOTAL_TEXT_BYTES) {
					throw limitExceeded("誘몃━蹂닿린???꾩슂???뚯뒪 肄붾뱶 ?ш린媛 ?쒗븳??珥덇낵?덉뒿?덈떎.");
				}

				// ?섎せ??UTF-8 諛붿씠?덈━媛 ?띿뒪?몃줈 ?욎뿬 ?ㅼ뼱?ㅻ뒗 寃껋쓣 ??踰???嫄곕쫭?덈떎.
				if (asset) {
					binaryFiles.put("/" + relativePath, Base64.getEncoder().encodeToString(content));
					continue;
				}
				if (containsNullByte(content)) {
					skipped++;
					continue;
				}
				files.put("/" + relativePath, new String(content, StandardCharsets.UTF_8).replaceFirst("^\\uFEFF", ""));
			}
		} catch (IOException exception) {
			throw new EditorImportException(
					"INVALID_ARCHIVE", "GitHub ??μ냼 ?뺤텞 ?뚯씪???쎌쓣 ???놁뒿?덈떎.", HttpStatus.BAD_REQUEST
			);
		}

		if (files.keySet().stream().noneMatch(p -> p.endsWith("/package.json") || p.endsWith("/index.html"))) {
			throw new EditorImportException(
					"PACKAGE_JSON_REQUIRED",
					"package.json ?먮뒗 index.html???덈뒗 ???꾨줈?앺듃媛 ?꾩슂?⑸땲??",
					HttpStatus.UNPROCESSABLE_ENTITY
			);
		}
		return new ArchiveContent(Map.copyOf(files), Map.copyOf(binaryFiles), skipped);
	}

	private static String safeRelativePath(String archivePath) {
		if (archivePath.indexOf('\\') >= 0 || archivePath.indexOf('\0') >= 0 || archivePath.startsWith("/")) {
			return null;
		}
		int rootEnd = archivePath.indexOf('/');
		if (rootEnd < 0 || rootEnd == archivePath.length() - 1) {
			return null;
		}

		String relativePath = archivePath.substring(rootEnd + 1);
		String[] segments = relativePath.split("/");
		for (String segment : segments) {
			if (segment.isBlank() || segment.startsWith(".") || segment.contains(":")) {
				return null;
			}
			if (IGNORED_DIRECTORIES.contains(segment.toLowerCase(Locale.ROOT))) {
				return null;
			}
		}
		return relativePath;
	}

	private static boolean isAllowedTextFile(String path) {
		String lower = path.toLowerCase(Locale.ROOT);
		String name = lower.substring(lower.lastIndexOf('/') + 1);
		if (name.startsWith(".") || name.endsWith(".lock")
				|| name.equals("npm-shrinkwrap.json") || name.startsWith("pnpm-lock.")
				|| name.contains("id_rsa") || name.contains("credential") || name.contains("private-key")
				|| name.contains("service-account")) {
			return false;
		}
		int extensionIndex = name.lastIndexOf('.');
		if (name.equals("package.json")) {
			return true;
		}
		if (extensionIndex < 0) {
			return false;
		}
		String extension = name.substring(extensionIndex + 1);
		return TEXT_EXTENSIONS.contains(extension) && !SECRET_EXTENSIONS.contains(extension);
	}

	private static boolean isAsset(String path) {
		String lower = path.toLowerCase(Locale.ROOT);
		if (lower.contains("credential") || lower.contains("private-key") || lower.contains("service-account")) return false;
		int dot = lower.lastIndexOf('.');
		return dot >= 0 && ASSET_EXTENSIONS.contains(lower.substring(dot + 1));
	}

	private static byte[] readEntry(ZipInputStream zip) throws IOException {
		ByteArrayOutputStream output = new ByteArrayOutputStream();
		byte[] buffer = new byte[8192];
		int read;
		while ((read = zip.read(buffer)) != -1) {
			if (output.size() + read > MAX_FILE_BYTES) {
				throw limitExceeded("?⑥씪 ?뚯씪 ?ш린媛 4MB瑜?珥덇낵?덉뒿?덈떎.");
			}
			output.write(buffer, 0, read);
		}
		return output.toByteArray();
	}

	private static boolean containsNullByte(byte[] content) {
		for (byte value : content) {
			if (value == 0) {
				return true;
			}
		}
		return false;
	}

	private static EditorImportException limitExceeded(String message) {
		return new EditorImportException("REPOSITORY_LIMIT_EXCEEDED", message, HttpStatus.PAYLOAD_TOO_LARGE);
	}

	record ArchiveContent(Map<String, String> files, Map<String, String> binaryFiles, int skippedFileCount) {
	}
}

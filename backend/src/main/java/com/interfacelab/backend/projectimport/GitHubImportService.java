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
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** GitHub ?⑤벀而????關?쇘몴?獄쏆룇釉??됰슢??怨? 沃섎챶?곮퉪?용┛???怨쀬뵠?怨뺤쨮 癰궰??묐???덈뼄. */
@Service
public class GitHubImportService {
	private static final int MAX_METADATA_BYTES = 256 * 1024;
	private static final int MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;
	private static final int MAX_DEPENDENCIES = 150;
	private static final Pattern SAFE_REF = Pattern.compile("[A-Za-z0-9][A-Za-z0-9._/-]{0,119}");
	private static final Pattern PACKAGE_NAME = Pattern.compile("(?:@[a-z0-9._-]+/)?[a-z0-9._-]+", Pattern.CASE_INSENSITIVE);

	private final ObjectMapper objectMapper;
	private final RepositoryArchiveReader archiveReader;
	private final HttpClient httpClient;

	public GitHubImportService(ObjectMapper objectMapper, RepositoryArchiveReader archiveReader) {
		this.objectMapper = objectMapper;
		this.archiveReader = archiveReader;
		this.httpClient = HttpClient.newBuilder()
				.connectTimeout(Duration.ofSeconds(5))
				.followRedirects(HttpClient.Redirect.NORMAL)
				.build();
	}

	public ImportedProjectResponse importPublicRepository(String repositoryUrl, String requestedRef) {
		GitHubRepositoryAddress address = GitHubRepositoryAddress.parse(repositoryUrl);
		String ref = requestedRef == null || requestedRef.isBlank()
				? fetchDefaultBranch(address)
				: validateRef(requestedRef.trim());

		byte[] archive = downloadArchive(address, ref);
		RepositoryArchiveReader.ArchiveContent content = archiveReader.read(archive);
		String manifestPath = content.files().keySet().stream().filter(p -> p.endsWith("/package.json"))
				.sorted(java.util.Comparator.comparingInt(String::length).thenComparing(String::compareTo)).findFirst().orElse(null);
		ProjectManifest manifest = manifestPath == null ? new ProjectManifest("HTML", Map.of()) : readManifest(content.files().get(manifestPath));

		return new ImportedProjectResponse(
				new ImportedProjectResponse.RepositorySource(
						address.owner(), address.repository(), ref, address.webUrl()
				),
				manifest.framework(),
				content.files(),
				manifest.dependencies(),
				content.skippedFileCount(),
				content.binaryFiles()
		);
	}

	private String fetchDefaultBranch(GitHubRepositoryAddress address) {
		URI uri = URI.create("https://api.github.com/repos/" + address.owner() + "/" + address.repository());
		HttpResponse<InputStream> response = send(uri, "application/vnd.github+json");
		if (response.statusCode() == 404) {
			closeQuietly(response.body());
			throw new EditorImportException(
					"REPOSITORY_NOT_FOUND",
					"?⑤벀而????關?쇘몴?筌≪뼚??????곷뮸??덈뼄. 雅뚯눘??? ?⑤벀而???????類ㅼ뵥??雅뚯눘苑??",
					HttpStatus.NOT_FOUND
			);
		}
		if (response.statusCode() != 200) {
			closeQuietly(response.body());
			throw githubUnavailable(response.statusCode());
		}

		try (InputStream body = response.body()) {
			byte[] json = readLimited(body, MAX_METADATA_BYTES, "GitHub ?臾먮뼗????댭???덈빍??");
			JsonNode node = objectMapper.readTree(json);
			return validateRef(node.path("default_branch").asText());
		} catch (IOException | JacksonException exception) {
			throw githubUnavailable(502);
		}
	}

	private byte[] downloadArchive(GitHubRepositoryAddress address, String ref) {
		String encodedRef = encodePath(ref);
		URI uri = URI.create("https://api.github.com/repos/" + address.owner() + "/"
				+ address.repository() + "/zipball/" + encodedRef);
		HttpResponse<InputStream> response = send(uri, "application/vnd.github+json");
		String finalHost = response.uri().getHost();
		if (finalHost == null || !(finalHost.equals("api.github.com") || finalHost.equals("codeload.github.com"))) {
			closeQuietly(response.body());
			throw new EditorImportException(
					"UNSAFE_GITHUB_REDIRECT", "GitHub ??쇱뒲嚥≪뮆諭?雅뚯눘?쇘몴??類ㅼ뵥??????곷뮸??덈뼄.", HttpStatus.BAD_GATEWAY
			);
		}
		if (response.statusCode() == 404) {
			closeQuietly(response.body());
			throw new EditorImportException(
					"REF_NOT_FOUND", "?遺욧퍕???됰슢?뽫㎉??癒?뮉 ??볥젃??筌≪뼚??????곷뮸??덈뼄.", HttpStatus.NOT_FOUND
			);
		}
		if (response.statusCode() != 200) {
			closeQuietly(response.body());
			throw githubUnavailable(response.statusCode());
		}

		long contentLength = response.headers().firstValueAsLong("Content-Length").orElse(-1);
		if (contentLength > MAX_ARCHIVE_BYTES) {
			closeQuietly(response.body());
			throw new EditorImportException(
					"REPOSITORY_LIMIT_EXCEEDED", "???關???類ㅽ뀧 ???뵬??10MB???λ뜃???됰뮸??덈뼄.", HttpStatus.PAYLOAD_TOO_LARGE
			);
		}
		try (InputStream body = response.body()) {
			return readLimited(body, MAX_ARCHIVE_BYTES, "???關???類ㅽ뀧 ???뵬??10MB???λ뜃???됰뮸??덈뼄.");
		} catch (IOException exception) {
			throw githubUnavailable(502);
		}
	}

	private HttpResponse<InputStream> send(URI uri, String accept) {
		HttpRequest request = HttpRequest.newBuilder(uri)
				.timeout(Duration.ofSeconds(15))
				.header("Accept", accept)
				.header("User-Agent", "polazu-local-editor")
				.header("X-GitHub-Api-Version", "2022-11-28")
				.GET()
				.build();
		try {
			return httpClient.send(request, HttpResponse.BodyHandlers.ofInputStream());
		} catch (IOException exception) {
			throw githubUnavailable(502);
		} catch (InterruptedException exception) {
			Thread.currentThread().interrupt();
			throw githubUnavailable(503);
		}
	}

	private ProjectManifest readManifest(String packageJson) {
		try {
			JsonNode root = objectMapper.readTree(packageJson);
			Map<String, String> dependencies = new LinkedHashMap<>();
			copyDependencies(root.path("dependencies"), dependencies);
			copyDependencies(root.path("devDependencies"), dependencies);

			String framework;
			if (dependencies.containsKey("next")) {
				framework = "NEXTJS";
			} else if (dependencies.containsKey("vite")) {
				framework = "VITE";
			} else {
				framework = "NODE";
			}
			return new ProjectManifest(framework, Map.copyOf(dependencies));
		} catch (JacksonException exception) {
			throw new EditorImportException(
					"INVALID_PACKAGE_JSON", "package.json????뚯뱽 ????곷뮸??덈뼄.", HttpStatus.UNPROCESSABLE_ENTITY
			);
		}
	}

	private void copyDependencies(JsonNode node, Map<String, String> target) {
		if (!node.isObject()) {
			return;
		}
		node.forEachEntry((name, valueNode) -> {
			if (target.size() >= MAX_DEPENDENCIES) {
				throw new EditorImportException(
						"TOO_MANY_DEPENDENCIES", "??뤵?源놁뵠 ??댭?筌띾‘? ?袁⑥쨮??븍뱜???袁⑹춦 筌왖?癒곕릭筌왖 ??녿뮸??덈뼄.",
						HttpStatus.UNPROCESSABLE_ENTITY
				);
			}
			String version = valueNode.asText();
			if (PACKAGE_NAME.matcher(name).matches() && version.length() <= 100) {
				target.put(name, version);
			}
		});
	}

	private static String validateRef(String ref) {
		if (!SAFE_REF.matcher(ref).matches() || ref.contains("..") || ref.contains("//")
				|| ref.endsWith("/") || ref.endsWith(".lock")) {
			throw new EditorImportException(
					"INVALID_REF", "?됰슢?뽫㎉??癒?뮉 ??볥젃 ??已??類ㅻ뻼????而?몴?? ??녿뮸??덈뼄.", HttpStatus.BAD_REQUEST
			);
		}
		return ref;
	}

	private static String encodePath(String value) {
		String[] segments = value.split("/");
		StringBuilder encoded = new StringBuilder();
		for (String segment : segments) {
			if (!encoded.isEmpty()) {
				encoded.append('/');
			}
			encoded.append(URLEncoder.encode(segment, StandardCharsets.UTF_8).replace("+", "%20"));
		}
		return encoded.toString();
	}

	private static byte[] readLimited(InputStream input, int maxBytes, String message) throws IOException {
		byte[] content = input.readNBytes(maxBytes + 1);
		if (content.length > maxBytes) {
			throw new EditorImportException("REPOSITORY_LIMIT_EXCEEDED", message, HttpStatus.PAYLOAD_TOO_LARGE);
		}
		return content;
	}

	private static void closeQuietly(InputStream input) {
		try {
			input.close();
		} catch (IOException ignored) {
			// ??? ??쎈솭??HTTP ?臾먮뼗???類ｂ봺??롫뮉 野껋럥以??癰귢쑬猷???살첒嚥??紐꾪뀱??? ??녿뮸??덈뼄.
		}
	}

	private static EditorImportException githubUnavailable(int statusCode) {
		String message = statusCode == 403 || statusCode == 429
				? "GitHub ?遺욧퍕 ??뺣즲???袁⑤뼎??됰뮸??덈뼄. ?醫롫뻻 ????쇰뻻 ??뺣즲??雅뚯눘苑??"
				: "GitHub?癒?퐣 ???關?쇘몴?揶쎛?紐꾩궎筌왖 筌륁궢六??щ빍??";
		return new EditorImportException("GITHUB_UNAVAILABLE", message, HttpStatus.BAD_GATEWAY);
	}

	private static EditorImportException unsupportedProject() {
		return new EditorImportException(
				"UNSUPPORTED_PROJECT",
				"?袁⑹삺??package.json??React揶쎛 ??釉???袁⑥쨮??븍뱜筌?筌왖?癒곕???덈뼄.",
				HttpStatus.UNPROCESSABLE_ENTITY
		);
	}

	private record ProjectManifest(String framework, Map<String, String> dependencies) {
	}
}

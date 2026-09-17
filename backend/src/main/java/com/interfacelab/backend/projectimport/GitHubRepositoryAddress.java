package com.interfacelab.backend.projectimport;

import java.net.URI;
import java.util.Locale;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;

/**
 * ?ъ슜?먭? ?낅젰??二쇱냼?먯꽌 owner/repository留?異붿텧?⑸땲??
 * ?꾩쓽 URL???쒕쾭媛 ?붿껌?섏? 紐삵븯?꾨줉 github.com ?몄쓽 ?몄뒪?몄? 異붽? 寃쎈줈??嫄곕??⑸땲??
 */
record GitHubRepositoryAddress(String owner, String repository) {
	private static final Pattern NAME = Pattern.compile("[A-Za-z0-9][A-Za-z0-9_.-]{0,99}");

	static GitHubRepositoryAddress parse(String rawUrl) {
		try {
			URI uri = URI.create(rawUrl.trim());
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
			if (parts.length != 3 || parts[1].isBlank() || parts[2].isBlank()) {
				throw invalidAddress();
			}

			String owner = parts[1];
			String repository = parts[2].endsWith(".git")
					? parts[2].substring(0, parts[2].length() - 4)
					: parts[2];
			if (!NAME.matcher(owner).matches() || !NAME.matcher(repository).matches()) {
				throw invalidAddress();
			}
			return new GitHubRepositoryAddress(owner, repository);
		} catch (IllegalArgumentException exception) {
			throw invalidAddress();
		}
	}

	String webUrl() {
		return "https://github.com/" + owner + "/" + repository;
	}

	private static EditorImportException invalidAddress() {
		return new EditorImportException(
				"INVALID_REPOSITORY_URL",
				"https://github.com/?ъ슜????μ냼 ?뺤떇??怨듦컻 GitHub 二쇱냼留??ъ슜?????덉뒿?덈떎.",
				HttpStatus.BAD_REQUEST
		);
	}
}

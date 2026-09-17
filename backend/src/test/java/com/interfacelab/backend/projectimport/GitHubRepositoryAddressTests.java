package com.interfacelab.backend.projectimport;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class GitHubRepositoryAddressTests {
	@Test
	void acceptsOnlyExactGitHubRepositoryUrls() {
		GitHubRepositoryAddress address = GitHubRepositoryAddress.parse("https://github.com/openai/example.git");

		assertEquals("openai", address.owner());
		assertEquals("example", address.repository());
	}

	@Test
	void rejectsUrlsThatCouldBeUsedForServerSideRequestForgery() {
		assertThrows(EditorImportException.class,
				() -> GitHubRepositoryAddress.parse("http://127.0.0.1:8080/private"));
		assertThrows(EditorImportException.class,
				() -> GitHubRepositoryAddress.parse("https://github.com.evil.example/openai/example"));
		assertThrows(EditorImportException.class,
				() -> GitHubRepositoryAddress.parse("https://github.com/openai/example/issues"));
	}
}

package com.interfacelab.backend.projectimport;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 嚥≪뮇類?Editor揶쎛 ?⑤벀而?GitHub ???關?쇘몴?揶쎛?紐꾩궎??API??낅빍?? */
@RestController
@RequestMapping("/api/editor/import")
public class ProjectImportController {
	private final GitHubImportService importService;
	private final LocalImportRateLimiter rateLimiter;

	public ProjectImportController(GitHubImportService importService, LocalImportRateLimiter rateLimiter) {
		this.importService = importService;
		this.rateLimiter = rateLimiter;
	}

	@PostMapping("/github")
	public ResponseEntity<ImportedProjectResponse> importGitHub(
			@Valid @RequestBody GitHubImportRequest request,
			HttpServletRequest servletRequest
	) {
		rateLimiter.check(servletRequest.getRemoteAddr());
		ImportedProjectResponse project = importService.importPublicRepository(
				request.repositoryUrl(), request.ref()
		);
		// 揶쎛?紐꾩궔 ???뮞揶쎛 ?됰슢??怨?夷?袁⑥쨯??筌?Ŋ?????? ??낅즲嚥?筌뤿굞??怨몄몵嚥?疫뀀뜆???몃빍??
		return ResponseEntity.ok()
				.cacheControl(CacheControl.noStore())
				.body(project);
	}
}

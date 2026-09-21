package com.interfacelab.backend.auth.controller;

import com.interfacelab.backend.auth.dto.LoginRequest;
import com.interfacelab.backend.auth.dto.MemberResponse;
import com.interfacelab.backend.auth.dto.SignUpRequest;
import com.interfacelab.backend.auth.exception.AuthException;
import com.interfacelab.backend.auth.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

	private final AuthService authService;

	public AuthController(AuthService authService) {
		this.authService = authService;
	}

	@PostMapping("/signup")
	public ResponseEntity<MemberResponse> signUp(@Valid @RequestBody SignUpRequest request) {
		MemberResponse response = authService.signUp(request);
		return ResponseEntity.status(HttpStatus.CREATED).body(response);
	}

	@PostMapping("/login")
	public ResponseEntity<MemberResponse> login(
		@Valid @RequestBody LoginRequest request,
		HttpServletRequest httpRequest
	) {
		HttpSession oldSession = httpRequest.getSession(true);
		MemberResponse member = authService.login(request, oldSession);

		// 새 세션 발급 및 사용자 ID 등록
		HttpSession newSession = httpRequest.getSession(true);
		newSession.setAttribute(AuthService.SESSION_AUTH_KEY, member.id());

		return ResponseEntity.ok(member);
	}

	@PostMapping("/logout")
	public ResponseEntity<Void> logout(HttpServletRequest httpRequest) {
		HttpSession session = httpRequest.getSession(false);
		if (session != null) {
			session.invalidate();
		}
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/me")
	public ResponseEntity<MemberResponse> getMe(HttpServletRequest httpRequest) {
		HttpSession session = httpRequest.getSession(false);
		if (session == null) {
			throw new AuthException("UNAUTHORIZED", "로그인이 필요합니다.", HttpStatus.UNAUTHORIZED);
		}

		Object memberIdObj = session.getAttribute(AuthService.SESSION_AUTH_KEY);
		if (!(memberIdObj instanceof Long memberId)) {
			throw new AuthException("UNAUTHORIZED", "로그인이 필요합니다.", HttpStatus.UNAUTHORIZED);
		}

		MemberResponse member = authService.getAuthenticatedMember(memberId);
		return ResponseEntity.ok(member);
	}
}

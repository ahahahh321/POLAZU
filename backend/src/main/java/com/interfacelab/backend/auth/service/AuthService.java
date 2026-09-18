package com.interfacelab.backend.auth.service;

import java.util.Objects;
import com.interfacelab.backend.auth.domain.Member;
import com.interfacelab.backend.auth.dto.LoginRequest;
import com.interfacelab.backend.auth.dto.MemberResponse;
import com.interfacelab.backend.auth.dto.SignUpRequest;
import com.interfacelab.backend.auth.exception.AuthException;
import com.interfacelab.backend.auth.repository.MemberRepository;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

	public static final String SESSION_AUTH_KEY = "AUTH_MEMBER_ID";

	private final MemberRepository memberRepository;
	private final PasswordEncoder passwordEncoder;

	public AuthService(MemberRepository memberRepository, PasswordEncoder passwordEncoder) {
		this.memberRepository = memberRepository;
		this.passwordEncoder = passwordEncoder;
	}

	@Transactional
	public MemberResponse signUp(SignUpRequest request) {
		String normalizedEmail = request.email().trim().toLowerCase();

		if (memberRepository.existsByEmail(normalizedEmail)) {
			throw new AuthException("EMAIL_ALREADY_EXISTS", "이미 사용 중인 이메일입니다.", HttpStatus.CONFLICT);
		}

		if (memberRepository.existsByNickname(request.nickname().trim())) {
			throw new AuthException("NICKNAME_ALREADY_EXISTS", "이미 사용 중인 닉네임입니다.", HttpStatus.CONFLICT);
		}

		String encodedPassword = passwordEncoder.encode(request.password());

		Member member = new Member(
			normalizedEmail,
			encodedPassword,
			request.name().trim(),
			request.nickname().trim(),
			request.profileImageUrl() != null && !request.profileImageUrl().isBlank() ? request.profileImageUrl().trim() : null,
			"ROLE_USER",
			"LOCAL",
			null
		);

		Member saved = memberRepository.save(member);
		return MemberResponse.from(saved);
	}

	@Transactional(readOnly = true)
	public MemberResponse login(LoginRequest request, HttpSession session) {
		String normalizedEmail = request.email().trim().toLowerCase();

		// 사용자 열거 방어(User Enumeration Prevention):
		// 계정 존재 여부나 비밀번호 오류와 무관하게 동일한 인증 실패 메시지 반환
		Member member = memberRepository.findByEmail(normalizedEmail)
			.orElseThrow(() -> new AuthException("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.", HttpStatus.UNAUTHORIZED));

		if (member.getPassword() == null || !passwordEncoder.matches(request.password(), member.getPassword())) {
			throw new AuthException("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.", HttpStatus.UNAUTHORIZED);
		}

		// 세션 고정 공격 방지(Session Fixation Prevention): 기존 세션 무효화 후 새 세션 발급
		session.invalidate();
		// 새 세션 바인딩은 호출 측(또는 요청 컨텍스트)에서 자동 생성
		return MemberResponse.from(member);
	}

	@Transactional(readOnly = true)
	public MemberResponse getAuthenticatedMember(Long memberId) {
		Member member = memberRepository.findById(memberId)
			.orElseThrow(() -> new AuthException("USER_NOT_FOUND", "사용자 정보를 찾을 수 없습니다.", HttpStatus.UNAUTHORIZED));
		return MemberResponse.from(member);
	}
}

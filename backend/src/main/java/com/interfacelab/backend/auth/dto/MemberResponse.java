package com.interfacelab.backend.auth.dto;

import java.time.Instant;
import com.interfacelab.backend.auth.domain.Member;

public record MemberResponse(
	Long id,
	String email,
	String name,
	String nickname,
	String profileImageUrl,
	String role,
	Instant createdAt
) {
	public static MemberResponse from(Member member) {
		return new MemberResponse(
			member.getId(),
			member.getEmail(),
			member.getName(),
			member.getNickname(),
			member.getProfileImageUrl(),
			member.getRole(),
			member.getCreatedAt()
		);
	}
}

package com.interfacelab.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SignUpRequest(
	@NotBlank(message = "이메일은 필수 입력값입니다.")
	@Email(message = "올바른 이메일 형식이 아닙니다.")
	@Size(max = 191, message = "이메일은 191자 이하이어야 합니다.")
	String email,

	@NotBlank(message = "비밀번호는 필수 입력값입니다.")
	@Pattern(
		regexp = "^(?=.*[a-zA-Z])(?=.*[!@#$%^&*(),.?\":{}|<>])[a-zA-Z0-9!@#$%^&*(),.?\":{}|<>]{8,64}$",
		message = "비밀번호는 영문과 특수문자를 필수로 포함하여 8자 이상이어야 합니다. (숫자는 선택 가능)"
	)
	String password,

	@NotBlank(message = "이름은 필수 입력값입니다.")
	@Size(min = 2, max = 50, message = "이름은 2자 이상 50자 이하이어야 합니다.")
	String name,

	@NotBlank(message = "닉네임은 필수 입력값입니다.")
	@Size(min = 2, max = 30, message = "닉네임은 2자 이상 30자 이하이어야 합니다.")
	String nickname,

	@Size(max = 500, message = "프로필 이미지 주소는 500자 이하이어야 합니다.")
	String profileImageUrl
) {
}

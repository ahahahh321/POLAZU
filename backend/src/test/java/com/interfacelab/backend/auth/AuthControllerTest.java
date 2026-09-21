package com.interfacelab.backend.auth;

import tools.jackson.databind.ObjectMapper;
import com.interfacelab.backend.auth.dto.LoginRequest;
import com.interfacelab.backend.auth.dto.SignUpRequest;
import com.interfacelab.backend.auth.repository.MemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AuthControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private MemberRepository memberRepository;

	@BeforeEach
	void setUp() {
		memberRepository.deleteAll();
	}

	@Test
	@DisplayName("정상 회원가입 성공 시 201 상태와 함께 민감 정보를 제외한 회원 정보를 반환한다")
	void signUpSuccess() throws Exception {
		SignUpRequest request = new SignUpRequest(
			"test@example.com",
			"ValidPass123!",
			"테스터",
			"닉네임",
			null
		);

		mockMvc.perform(post("/api/auth/signup")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(request)))
			.andExpect(status().isCreated())
			.andExpect(jsonPath("$.id").exists())
			.andExpect(jsonPath("$.email").value("test@example.com"))
			.andExpect(jsonPath("$.name").value("테스터"))
			.andExpect(jsonPath("$.nickname").value("닉네임"))
			.andExpect(jsonPath("$.password").doesNotExist()); // 민감 정보 노출 방지

		assertThat(memberRepository.findByEmail("test@example.com")).isPresent();
	}

	@Test
	@DisplayName("비밀번호 규칙(영문+특수문자 필수, 8자 이상) 미충족 시 400 Bad Request를 반환한다")
	void signUpInvalidPassword() throws Exception {
		// 특수문자 없는 비밀번호
		SignUpRequest request = new SignUpRequest(
			"invalid@example.com",
			"simplepassword123",
			"테스터",
			"닉네임",
			null
		);

		mockMvc.perform(post("/api/auth/signup")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(request)))
			.andExpect(status().isBadRequest())
			.andExpect(jsonPath("$.code").value("INVALID_REQUEST"));
	}

	@Test
	@DisplayName("중복된 이메일로 가입 시 409 Conflict를 반환한다")
	void signUpDuplicateEmail() throws Exception {
		SignUpRequest request1 = new SignUpRequest("dup@example.com", "Pass123!@", "이름1", "닉네임1", null);
		SignUpRequest request2 = new SignUpRequest("dup@example.com", "Pass456!@", "이름2", "닉네임2", null);

		mockMvc.perform(post("/api/auth/signup")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(request1)))
			.andExpect(status().isCreated());

		mockMvc.perform(post("/api/auth/signup")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(request2)))
			.andExpect(status().isConflict())
			.andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));
	}

	@Test
	@DisplayName("로그인 성공 후 세션을 통해 내 정보 조회 및 로그아웃이 정상 동작한다")
	void loginAndSessionLifecycle() throws Exception {
		// 1. 회원가입
		SignUpRequest signUp = new SignUpRequest("session@example.com", "Password!23", "사용자", "유저", null);
		mockMvc.perform(post("/api/auth/signup")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(signUp)))
			.andExpect(status().isCreated());

		// 2. 로그인 성공
		LoginRequest login = new LoginRequest("session@example.com", "Password!23");
		MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(login)))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.email").value("session@example.com"))
			.andReturn();

		MockHttpSession session = (MockHttpSession) loginResult.getRequest().getSession(false);
		assertThat(session).isNotNull();

		// 3. 내 정보 조회 (/api/auth/me)
		mockMvc.perform(get("/api/auth/me").session(session))
			.andExpect(status().isOk())
			.andExpect(jsonPath("$.nickname").value("유저"));

		// 4. 로그아웃
		mockMvc.perform(post("/api/auth/logout").session(session))
			.andExpect(status().isNoContent());

		// 5. 로그아웃 후 내 정보 조회 시 401 Unauthorized
		mockMvc.perform(get("/api/auth/me").session(session))
			.andExpect(status().isUnauthorized());
	}

	@Test
	@DisplayName("비밀번호 불일치 시 사용자 열거 방어를 위해 일원화된 401 오류를 반환한다")
	void loginInvalidCredentials() throws Exception {
		// 존재하지 않는 계정
		LoginRequest notFound = new LoginRequest("nobody@example.com", "AnyPass123!");
		mockMvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(notFound)))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

		// 존재하는 계정에 틀린 비밀번호
		SignUpRequest signUp = new SignUpRequest("exist@example.com", "Correct123!", "홍길동", "길동", null);
		mockMvc.perform(post("/api/auth/signup")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(signUp)))
			.andExpect(status().isCreated());

		LoginRequest wrongPass = new LoginRequest("exist@example.com", "WrongPassword!9");
		mockMvc.perform(post("/api/auth/login")
				.contentType(MediaType.APPLICATION_JSON)
				.content(objectMapper.writeValueAsString(wrongPass)))
			.andExpect(status().isUnauthorized())
			.andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
	}
}

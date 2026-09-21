package com.interfacelab.backend.auth;

import com.interfacelab.backend.common.PolazuException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {
    public static final String REQUEST_USER_ATTRIBUTE = "polazu.authenticatedUser";
    public static final String COOKIE_NAME = "POLAZU_SESSION";
    private static final Duration SESSION_LIFETIME = Duration.ofDays(14);
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]{1,64}@[^@\\s]{1,190}$");
    private static final Pattern NICKNAME = Pattern.compile("[A-Za-z0-9._가-힣-]{2,40}");

    private final JdbcTemplate jdbc;
    private final PasswordHasher passwordHasher;
    private final SecureRandom random = new SecureRandom();
    private final boolean secureCookie;

    public AuthService(
            JdbcTemplate jdbc,
            PasswordHasher passwordHasher,
            @Value("${polazu.auth.secure-cookie:false}") boolean secureCookie
    ) {
        this.jdbc = jdbc;
        this.passwordHasher = passwordHasher;
        this.secureCookie = secureCookie;
    }

    @Transactional
    public AuthenticatedUser signup(String rawEmail, String password, String rawName, String rawNickname, HttpServletResponse response) {
        String email = normalizeEmail(rawEmail);
        String name = requireText(rawName, "이름", 2, 80);
        String nickname = rawNickname == null || rawNickname.isBlank()
                ? defaultNickname(email)
                : rawNickname.trim();
        if (!NICKNAME.matcher(nickname).matches()) {
            throw new PolazuException("INVALID_NICKNAME", "닉네임은 2~40자의 한글, 영문, 숫자, 점, 밑줄, 하이픈만 사용할 수 있습니다.", HttpStatus.BAD_REQUEST);
        }
        validatePassword(password);

        try {
            jdbc.update("""
                    INSERT INTO app_user(email, password_hash, display_name, nickname, locale)
                    VALUES (?, ?, ?, ?, 'ko')
                    """, email, passwordHasher.hash(password), name, nickname);
        } catch (DuplicateKeyException exception) {
            throw new PolazuException("ACCOUNT_ALREADY_EXISTS", "이미 사용 중인 이메일 또는 닉네임입니다.", HttpStatus.CONFLICT);
        }
        AuthenticatedUser user = jdbc.queryForObject(
                "SELECT id, email, display_name, nickname, profile_image_url, locale FROM app_user WHERE email = ?",
                AuthService::mapUser,
                email
        );
        createSession(user, response);
        return user;
    }

    @Transactional
    public AuthenticatedUser login(String rawEmail, String password, HttpServletResponse response) {
        String email = normalizeEmail(rawEmail);
        AccountRow account = jdbc.query(
                "SELECT id, email, password_hash, display_name, nickname, profile_image_url, locale FROM app_user WHERE email = ?",
                rs -> rs.next() ? new AccountRow(
                        rs.getLong("id"), rs.getString("email"), rs.getString("password_hash"),
                        rs.getString("display_name"), rs.getString("nickname"),
                        rs.getString("profile_image_url"), rs.getString("locale")
                ) : null,
                email
        );
        boolean matched;
        if (account == null) {
            passwordHasher.consumeLoginCost(password);
            matched = false;
        } else {
            matched = passwordHasher.matches(password == null ? "" : password, account.passwordHash());
        }
        if (!matched) {
            // 계정 존재 여부를 구분하지 않는 동일한 오류를 반환합니다.
            throw new PolazuException("INVALID_CREDENTIALS", "이메일 또는 비밀번호가 올바르지 않습니다.", HttpStatus.UNAUTHORIZED);
        }
        AuthenticatedUser user = account.toUser();
        createSession(user, response);
        return user;
    }

    @Transactional(readOnly = true)
    public Optional<AuthenticatedUser> authenticate(HttpServletRequest request) {
        String rawToken = findCookie(request, COOKIE_NAME);
        if (rawToken == null || rawToken.length() < 32 || rawToken.length() > 200) return Optional.empty();
        String tokenHash = sha256(rawToken);
        Instant now = Instant.now();
        return jdbc.query("""
                SELECT u.id, u.email, u.display_name, u.nickname, u.profile_image_url, u.locale
                FROM auth_session s
                JOIN app_user u ON u.id = s.user_id
                WHERE s.token_hash = ? AND s.expires_at > ?
                """, rs -> rs.next() ? Optional.of(mapUser(rs, 0)) : Optional.empty(), tokenHash, now);
    }

    @Transactional
    public void logout(HttpServletRequest request, HttpServletResponse response) {
        String rawToken = findCookie(request, COOKIE_NAME);
        if (rawToken != null) jdbc.update("DELETE FROM auth_session WHERE token_hash = ?", sha256(rawToken));
        clearCookie(response);
    }

    public AuthenticatedUser requireUser(HttpServletRequest request) {
        Object value = request.getAttribute(REQUEST_USER_ATTRIBUTE);
        if (value instanceof AuthenticatedUser user) return user;
        throw new PolazuException("AUTHENTICATION_REQUIRED", "로그인이 필요합니다.", HttpStatus.UNAUTHORIZED);
    }

    private void createSession(AuthenticatedUser user, HttpServletResponse response) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant expires = Instant.now().plus(SESSION_LIFETIME);
        jdbc.update("DELETE FROM auth_session WHERE expires_at <= ?", Instant.now());
        jdbc.update("""
                INSERT INTO auth_session(id, user_id, token_hash, expires_at)
                VALUES (?, ?, ?, ?)
                """, UUID.randomUUID().toString(), user.id(), sha256(rawToken), expires);
        response.addHeader(HttpHeaders.SET_COOKIE, cookieHeader(rawToken, SESSION_LIFETIME.toSeconds()));
    }

    private void clearCookie(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookieHeader("", 0));
    }

    private String cookieHeader(String value, long maxAge) {
        StringBuilder header = new StringBuilder()
                .append(COOKIE_NAME).append('=').append(value)
                .append("; Path=/; HttpOnly; SameSite=Lax; Max-Age=").append(maxAge);
        if (secureCookie) header.append("; Secure");
        return header.toString();
    }

    private static String findCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie cookie : cookies) if (name.equals(cookie.getName())) return cookie.getValue();
        return null;
    }

    private static String normalizeEmail(String raw) {
        String email = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 254 || !EMAIL.matcher(email).matches()) {
            throw new PolazuException("INVALID_EMAIL", "올바른 이메일 주소를 입력해 주세요.", HttpStatus.BAD_REQUEST);
        }
        return email;
    }

    private static void validatePassword(String password) {
        if (password == null || password.length() < 8 || password.length() > 128) {
            throw new PolazuException("INVALID_PASSWORD", "비밀번호는 8~128자로 입력해 주세요.", HttpStatus.BAD_REQUEST);
        }
        boolean letter = password.chars().anyMatch(Character::isLetter);
        boolean digit = password.chars().anyMatch(Character::isDigit);
        if (!letter || !digit) {
            throw new PolazuException("INVALID_PASSWORD", "비밀번호에는 문자와 숫자를 각각 하나 이상 포함해 주세요.", HttpStatus.BAD_REQUEST);
        }
    }

    private static String defaultNickname(String email) {
        String prefix = email.substring(0, email.indexOf('@')).replaceAll("[^A-Za-z0-9._가-힣-]", "");
        if (prefix.length() < 2) prefix = "user";
        return (prefix.length() > 30 ? prefix.substring(0, 30) : prefix) + "-" + UUID.randomUUID().toString().substring(0, 6);
    }

    private static String requireText(String raw, String field, int min, int max) {
        String value = raw == null ? "" : raw.trim();
        if (value.length() < min || value.length() > max) {
            throw new PolazuException("INVALID_REQUEST", field + "은(는) " + min + "~" + max + "자로 입력해 주세요.", HttpStatus.BAD_REQUEST);
        }
        return value;
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static AuthenticatedUser mapUser(ResultSet rs, int rowNum) throws SQLException {
        return new AuthenticatedUser(
                rs.getLong("id"), rs.getString("email"), rs.getString("display_name"),
                rs.getString("nickname"), rs.getString("profile_image_url"), rs.getString("locale")
        );
    }

    private record AccountRow(long id, String email, String passwordHash, String name, String nickname, String profileImageUrl, String locale) {
        AuthenticatedUser toUser() { return new AuthenticatedUser(id, email, name, nickname, profileImageUrl, locale); }
    }
}

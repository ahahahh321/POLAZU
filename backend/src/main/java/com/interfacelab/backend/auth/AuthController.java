package com.interfacelab.backend.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    public ResponseEntity<AuthenticatedUser> signup(
            @Valid @RequestBody SignupRequest request,
            HttpServletResponse response
    ) {
        return noStore(authService.signup(request.email(), request.password(), request.name(), request.nickname(), response));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthenticatedUser> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletResponse response
    ) {
        return noStore(authService.login(request.email(), request.password(), response));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Boolean>> logout(HttpServletRequest request, HttpServletResponse response) {
        authService.logout(request, response);
        return noStore(Map.of("loggedOut", true));
    }

    @GetMapping("/me")
    public ResponseEntity<AuthenticatedUser> me(HttpServletRequest request) {
        return authService.authenticate(request)
                .map(AuthController::noStore)
                .orElseGet(() -> ResponseEntity.status(401).cacheControl(CacheControl.noStore()).<AuthenticatedUser>build());
    }

    private static <T> ResponseEntity<T> noStore(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }

    public record LoginRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(max = 128) String password
    ) {}

    public record SignupRequest(
            @NotBlank @Email @Size(max = 254) String email,
            @NotBlank @Size(min = 8, max = 128) String password,
            @NotBlank @Size(min = 2, max = 80) String name,
            @Size(max = 40) String nickname
    ) {}
}

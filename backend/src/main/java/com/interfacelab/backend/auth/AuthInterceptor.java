package com.interfacelab.backend.auth;

import com.interfacelab.backend.common.ApiErrorResponse;
import jakarta.servlet.DispatcherType;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import tools.jackson.databind.ObjectMapper;

@Component
public class AuthInterceptor implements HandlerInterceptor {
    private final AuthService authService;
    private final ObjectMapper objectMapper;

    public AuthInterceptor(AuthService authService, ObjectMapper objectMapper) {
        this.authService = authService;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws IOException {
        if (request.getDispatcherType() != DispatcherType.REQUEST) return true;
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) return true;
        var user = authService.authenticate(request);
        if (user.isPresent()) {
            request.setAttribute(AuthService.REQUEST_USER_ATTRIBUTE, user.get());
            return true;
        }
        response.setStatus(401);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), ApiErrorResponse.of("AUTHENTICATION_REQUIRED", "로그인이 필요합니다."));
        return false;
    }
}

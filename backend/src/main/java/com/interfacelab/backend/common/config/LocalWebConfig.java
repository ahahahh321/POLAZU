package com.interfacelab.backend.common.config;

import com.interfacelab.backend.auth.AuthInterceptor;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** 로컬 프론트엔드와 API 사이의 CORS 및 인증 경계를 설정합니다. */
@Configuration
public class LocalWebConfig implements WebMvcConfigurer {
    private final AuthInterceptor authInterceptor;
    private final List<String> allowedOrigins;

    public LocalWebConfig(
            AuthInterceptor authInterceptor,
            @Value("${polazu.cors.allowed-origins:http://127.0.0.1:3000,http://localhost:3000}") List<String> allowedOrigins
    ) {
        this.authInterceptor = authInterceptor;
        this.allowedOrigins = allowedOrigins;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOrigins(allowedOrigins.toArray(String[]::new))
                .allowedMethods("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("Content-Type", "X-Requested-With", "Last-Event-ID")
                .exposedHeaders("Content-Disposition", "ETag", "X-Polazu-Revision")
                .allowCredentials(true)
                .maxAge(600);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/projects", "/api/projects/**")
                .excludePathPatterns("/api/projects/limits");
    }
}

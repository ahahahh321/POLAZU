package com.interfacelab.backend.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** 媛쒕컻 以묒씤 濡쒖뺄 Next.js ?붾㈃?먯꽌留?API瑜??몄텧?????덈룄濡??쒗븳?⑸땲?? */
@Configuration
public class LocalWebConfig implements WebMvcConfigurer {
	@Override
	public void addCorsMappings(CorsRegistry registry) {
		registry.addMapping("/api/auth/**")
				.allowedOrigins("http://127.0.0.1:3000", "http://localhost:3000")
				.allowedMethods("GET", "POST", "OPTIONS")
				.allowedHeaders("Content-Type")
				.allowCredentials(true)
				.maxAge(600);

		registry.addMapping("/api/editor/**")
				.allowedOrigins("http://127.0.0.1:3000", "http://localhost:3000")
				.allowedMethods("POST", "OPTIONS")
				.allowedHeaders("Content-Type")
				.allowCredentials(false)
				.maxAge(600);
	}
}

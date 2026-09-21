package com.interfacelab.backend.common;

import java.time.Instant;
import java.util.Map;

/** 내부 스택이나 SQL을 노출하지 않는 공통 오류 응답입니다. */
public record ApiErrorResponse(
        String code,
        String message,
        Instant timestamp,
        Map<String, Object> details
) {
    public static ApiErrorResponse of(String code, String message) {
        return new ApiErrorResponse(code, message, Instant.now(), Map.of());
    }

    public static ApiErrorResponse of(String code, String message, Map<String, Object> details) {
        return new ApiErrorResponse(code, message, Instant.now(), details == null ? Map.of() : details);
    }
}

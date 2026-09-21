package com.interfacelab.backend.common;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** 사용자에게 노출 가능한 코드와 상태를 가진 업무 예외입니다. */
public class PolazuException extends RuntimeException {
    private final String code;
    private final HttpStatus status;
    private final Map<String, Object> details;

    public PolazuException(String code, String message, HttpStatus status) {
        this(code, message, status, Map.of());
    }

    public PolazuException(String code, String message, HttpStatus status, Map<String, Object> details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details == null ? Map.of() : Map.copyOf(details);
    }

    public String code() { return code; }
    public HttpStatus status() { return status; }
    public Map<String, Object> details() { return details; }
}

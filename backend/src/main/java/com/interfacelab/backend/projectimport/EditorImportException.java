package com.interfacelab.backend.projectimport;

import com.interfacelab.backend.common.PolazuException;
import java.util.Map;
import org.springframework.http.HttpStatus;

public class EditorImportException extends PolazuException {
    public EditorImportException(String code, String message, HttpStatus status) {
        super(code, message, status);
    }

    public EditorImportException(String code, String message, HttpStatus status, Map<String, Object> details) {
        super(code, message, status, details);
    }
}

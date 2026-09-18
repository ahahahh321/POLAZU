package com.interfacelab.backend.common;

import java.util.stream.Collectors;

import com.interfacelab.backend.projectimport.EditorImportException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** ??됯맒 ??살첒筌???됱읈??筌롫뗄?놅쭪?嚥?癰궰??묐릭????? ??됱뇚 ?類ｋ궖???臾먮뼗????釉??? ??녿뮸??덈뼄. */
@RestControllerAdvice
public class ApiExceptionHandler {
	@ExceptionHandler(EditorImportException.class)
	public ResponseEntity<ApiErrorResponse> handleEditorImport(EditorImportException exception) {
		return ResponseEntity.status(exception.status())
				.body(ApiErrorResponse.of(exception.code(), exception.getMessage()));
	}

	@ExceptionHandler(com.interfacelab.backend.auth.exception.AuthException.class)
	public ResponseEntity<ApiErrorResponse> handleAuth(com.interfacelab.backend.auth.exception.AuthException exception) {
		return ResponseEntity.status(exception.status())
				.body(ApiErrorResponse.of(exception.code(), exception.getMessage()));
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
		String message = exception.getBindingResult().getFieldErrors().stream()
				.map(error -> error.getDefaultMessage() == null ? "??낆젾揶쏅????類ㅼ뵥??雅뚯눘苑??" : error.getDefaultMessage())
				.distinct()
				.collect(Collectors.joining(" "));
		return ResponseEntity.badRequest().body(ApiErrorResponse.of("INVALID_REQUEST", message));
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception exception) {
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
				.body(ApiErrorResponse.of("INTERNAL_ERROR", "?遺욧퍕??筌ｌ꼶???? 筌륁궢六??щ빍??"));
	}
}

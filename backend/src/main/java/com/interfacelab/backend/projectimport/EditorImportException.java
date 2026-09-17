package com.interfacelab.backend.projectimport;

import org.springframework.http.HttpStatus;

/** ?덉긽 媛?ν븳 媛?몄삤湲??ㅽ뙣瑜??덉쟾??肄붾뱶? 硫붿떆吏濡??꾨떖?⑸땲?? */
public class EditorImportException extends RuntimeException {
	private final String code;
	private final HttpStatus status;

	public EditorImportException(String code, String message, HttpStatus status) {
		super(message);
		this.code = code;
		this.status = status;
	}

	public String code() {
		return code;
	}

	public HttpStatus status() {
		return status;
	}
}

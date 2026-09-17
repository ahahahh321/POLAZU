package com.interfacelab.backend.common;

import java.time.Instant;

/** ?대씪?댁뼵?몄뿉 ?대? ?덉쇅??寃쎈줈瑜??몄텧?섏? ?딅뒗 怨듯넻 ?ㅻ쪟 ?묐떟?낅땲?? */
public record ApiErrorResponse(String code, String message, Instant timestamp) {
	public static ApiErrorResponse of(String code, String message) {
		return new ApiErrorResponse(code, message, Instant.now());
	}
}

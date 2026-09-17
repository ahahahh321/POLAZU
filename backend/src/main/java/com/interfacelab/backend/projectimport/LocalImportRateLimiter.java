package com.interfacelab.backend.projectimport;

import java.time.Clock;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** 濡쒖뺄 API???ㅼ닔쨌諛섎났 ?몄텧??以꾩씠??媛꾨떒??硫붾え由?湲곕컲 ?쒗븳?낅땲?? */
@Component
public class LocalImportRateLimiter {
	private static final int MAX_REQUESTS_PER_MINUTE = 10;
	private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
	private final Clock clock = Clock.systemUTC();

	public void check(String clientAddress) {
		Instant now = clock.instant();
		Window window = windows.compute(clientAddress, (key, current) -> {
			if (current == null || now.isAfter(current.startedAt().plusSeconds(60))) {
				return new Window(now, 1);
			}
			return new Window(current.startedAt(), current.count() + 1);
		});
		if (window.count() > MAX_REQUESTS_PER_MINUTE) {
			throw new EditorImportException(
					"RATE_LIMITED", "媛?몄삤湲??붿껌???덈Т 留롮뒿?덈떎. ?좎떆 ???ㅼ떆 ?쒕룄??二쇱꽭??",
					HttpStatus.TOO_MANY_REQUESTS
			);
		}
	}

	private record Window(Instant startedAt, int count) {
	}
}

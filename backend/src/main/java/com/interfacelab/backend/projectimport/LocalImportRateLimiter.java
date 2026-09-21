package com.interfacelab.backend.projectimport;

import java.time.Clock;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

/** 공개 GitHub 미리보기 API의 반복 호출을 줄이는 단일 서버 메모리 기반 제한기입니다. */
@Component
public class LocalImportRateLimiter {
    private static final int MAX_REQUESTS_PER_MINUTE = 10;
    private static final long CLEANUP_INTERVAL = 256;
    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();
    private final AtomicLong requests = new AtomicLong();
    private final Clock clock = Clock.systemUTC();

    public void check(String clientAddress) {
        Instant now = clock.instant();
        String key = clientAddress == null || clientAddress.isBlank() ? "unknown" : clientAddress;
        Window window = windows.compute(key, (ignored, current) -> {
            if (current == null || !now.isBefore(current.startedAt().plusSeconds(60))) {
                return new Window(now, 1);
            }
            return new Window(current.startedAt(), current.count() + 1);
        });
        if (requests.incrementAndGet() % CLEANUP_INTERVAL == 0) {
            Instant expired = now.minusSeconds(120);
            windows.entrySet().removeIf(entry -> entry.getValue().startedAt().isBefore(expired));
        }
        if (window.count() > MAX_REQUESTS_PER_MINUTE) {
            throw new EditorImportException(
                    "RATE_LIMITED",
                    "가져오기 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
                    HttpStatus.TOO_MANY_REQUESTS
            );
        }
    }

    private record Window(Instant startedAt, int count) {}
}

package com.interfacelab.backend.project;

import com.interfacelab.backend.auth.AuthenticatedUser;
import java.io.IOException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** 프로젝트·브랜치 단위로만 이벤트와 접속 위치를 전달하는 인메모리 허브입니다. */
@Component
public class ProjectEventHub {
    private static final long EMITTER_TIMEOUT = 30L * 60L * 1000L;
    private static final long PRESENCE_TTL_SECONDS = 75;

    private final ConcurrentHashMap<String, CopyOnWriteArraySet<Client>> emitters = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, ConcurrentHashMap<Long, PresenceValue>> presence = new ConcurrentHashMap<>();

    public SseEmitter subscribe(String projectId, String branch, AuthenticatedUser user) {
        String key = key(projectId, branch);
        SseEmitter emitter = new SseEmitter(EMITTER_TIMEOUT);
        Client client = new Client(user.id(), emitter);
        emitters.computeIfAbsent(key, ignored -> new CopyOnWriteArraySet<>()).add(client);
        Runnable cleanup = () -> removeClient(key, client);
        emitter.onCompletion(cleanup);
        emitter.onTimeout(cleanup);
        emitter.onError(error -> cleanup.run());
        touch(projectId, branch, user, "workspace");
        try {
            emitter.send(SseEmitter.event().name("connected").id(Long.toString(System.nanoTime()))
                    .data(Map.of("projectId", projectId, "branch", branch, "connectedAt", Instant.now().toString())));
            emitter.send(SseEmitter.event().name("presence").data(current(projectId, branch)));
        } catch (IOException exception) {
            cleanup.run();
        }
        return emitter;
    }

    public void touch(String projectId, String branch, AuthenticatedUser user, String rawLocation) {
        String location = sanitizeLocation(rawLocation);
        String key = key(projectId, branch);
        presence.computeIfAbsent(key, ignored -> new ConcurrentHashMap<>())
                .put(user.id(), new PresenceValue(user.id(), user.name(), user.nickname(), location, Instant.now()));
        broadcast(projectId, branch, "presence", current(projectId, branch));
    }

    public List<ProjectDtos.Presence> current(String projectId, String branch) {
        String key = key(projectId, branch);
        Instant cutoff = Instant.now().minus(PRESENCE_TTL_SECONDS, ChronoUnit.SECONDS);
        ConcurrentHashMap<Long, PresenceValue> values = presence.get(key);
        if (values == null) return List.of();
        values.entrySet().removeIf(entry -> entry.getValue().lastSeenAt().isBefore(cutoff));
        return values.values().stream()
                .sorted(java.util.Comparator.comparing(PresenceValue::name).thenComparingLong(PresenceValue::userId))
                .map(value -> new ProjectDtos.Presence(
                        value.userId(), value.name(), value.nickname(), value.location(), value.lastSeenAt()
                )).toList();
    }

    public void broadcastRevision(
            String projectId,
            String branch,
            long revision,
            AuthenticatedUser author,
            String summary,
            List<String> changedPaths
    ) {
        broadcast(projectId, branch, "revision", Map.of(
                "revision", revision,
                "authorUserId", author.id(),
                "authorName", author.name(),
                "summary", summary,
                "changedPaths", changedPaths,
                "createdAt", Instant.now().toString()
        ));
    }

    public void notifyRoleChanged(String projectId, String branch, long userId, ProjectRole role) {
        direct(projectId, branch, userId, "role-changed", Map.of("role", role.name(), "changedAt", Instant.now().toString()), false);
    }

    public void revoke(String projectId, String branch, long userId) {
        presence.computeIfAbsent(key(projectId, branch), ignored -> new ConcurrentHashMap<>()).remove(userId);
        direct(projectId, branch, userId, "access-revoked", Map.of("projectId", projectId, "revokedAt", Instant.now().toString()), true);
        broadcast(projectId, branch, "presence", current(projectId, branch));
    }

    public void broadcast(String projectId, String branch, String eventName, Object data) {
        String key = key(projectId, branch);
        CopyOnWriteArraySet<Client> set = emitters.get(key);
        if (set == null) return;
        List<Client> failed = new ArrayList<>();
        for (Client client : set) {
            try {
                client.emitter().send(SseEmitter.event().name(eventName).id(Long.toString(System.nanoTime())).data(data));
            } catch (IOException | IllegalStateException exception) {
                failed.add(client);
            }
        }
        failed.forEach(client -> removeClient(key, client));
    }

    private void direct(String projectId, String branch, long userId, String eventName, Object data, boolean complete) {
        String key = key(projectId, branch);
        CopyOnWriteArraySet<Client> set = emitters.get(key);
        if (set == null) return;
        for (Client client : List.copyOf(set)) {
            if (client.userId() != userId) continue;
            boolean failed = false;
            try { client.emitter().send(SseEmitter.event().name(eventName).data(data)); }
            catch (IOException | IllegalStateException ignored) { failed = true; }
            if (complete) client.emitter().complete();
            if (complete || failed) removeClient(key, client);
        }
    }

    private void removeClient(String key, Client client) {
        CopyOnWriteArraySet<Client> set = emitters.get(key);
        if (set == null) return;
        set.remove(client);
        if (set.isEmpty()) emitters.remove(key, set);
    }

    private static String sanitizeLocation(String raw) {
        String location = raw == null ? "workspace" : raw.trim();
        if (location.isEmpty()) return "workspace";
        return location.length() > 160 ? location.substring(0, 160) : location;
    }

    private static String key(String projectId, String branch) {
        return Objects.requireNonNull(projectId) + "\n" + Objects.requireNonNull(branch);
    }

    private record Client(long userId, SseEmitter emitter) {}
    private record PresenceValue(long userId, String name, String nickname, String location, Instant lastSeenAt) {}
}

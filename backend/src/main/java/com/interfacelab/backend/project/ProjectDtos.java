package com.interfacelab.backend.project;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class ProjectDtos {
    private ProjectDtos() {}

    public record ProjectSummary(
            String id,
            String name,
            String sourceType,
            String repositoryUrl,
            String workspaceBranch,
            String baseCommit,
            String framework,
            String status,
            long currentRevision,
            long publishedRevision,
            long storageBytes,
            int fileCount,
            ProjectRole role,
            Instant updatedAt
    ) {}

    public record ProjectDetails(
            String id,
            String name,
            String sourceType,
            String repositoryOwner,
            String repositoryName,
            String repositoryUrl,
            String defaultBranch,
            String workspaceBranch,
            String baseCommit,
            String lastRemoteCommit,
            String framework,
            int skippedFileCount,
            String status,
            long currentRevision,
            long publishedRevision,
            long storageBytes,
            ProjectRole role,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record WorkspaceSnapshot(
            ProjectDetails project,
            long revision,
            String branch,
            Map<String, String> files,
            Map<String, String> binaryFiles,
            List<Presence> presence
    ) {}

    public record Presence(long userId, String name, String nickname, String location, Instant lastSeenAt) {}

    public record FileChange(String path, String content, String binaryBase64, Boolean delete) {}

    public record ChangeRequest(long baseRevision, String clientMutationId, String summary, List<FileChange> changes) {}

    public record ChangeResult(long revision, List<String> changedPaths, Instant savedAt, boolean duplicate) {}

    public record RevisionSummary(
            long revision,
            long baseRevision,
            String kind,
            String summary,
            long authorUserId,
            String authorName,
            List<String> changedPaths,
            Instant createdAt
    ) {}

    public record VersionSummary(
            String id,
            String name,
            String summary,
            long sourceRevision,
            long authorUserId,
            String authorName,
            int fileCount,
            long sizeBytes,
            Instant createdAt
    ) {}

    public record Comment(
            String id,
            String filePath,
            String selector,
            String body,
            String status,
            long authorUserId,
            String authorName,
            String authorNickname,
            Instant createdAt,
            Instant updatedAt,
            Instant resolvedAt
    ) {}

    public record Member(long userId, String email, String name, String nickname, ProjectRole role, Instant joinedAt) {}

    public record Limits(long sharedSourceBytes, long fileBytes, int fileCount, long zipUploadBytes, long zipExpandedBytes) {}
}

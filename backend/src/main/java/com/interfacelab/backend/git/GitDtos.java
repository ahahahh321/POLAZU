package com.interfacelab.backend.git;

import java.time.Instant;
import java.util.List;

public final class GitDtos {
    private GitDtos() {}

    public record RemoteCheckRequest(String accessToken, String branch) {}

    public record RemoteApplyRequest(
            String accessToken,
            String branch,
            String expectedCommit,
            boolean preserveUnpublishedAsVersion,
            String clientMutationId
    ) {}

    public record RemoteApplyResult(
            long revision,
            String appliedCommit,
            String branch,
            int changedFileCount,
            String preservedVersionId
    ) {}

    public record RemoteStatus(
            String repositoryUrl,
            String branch,
            String configuredBaseCommit,
            String remoteHeadCommit,
            boolean remoteAdvanced,
            long currentRevision,
            long publishedRevision,
            long unpublishedRevisionCount,
            String lastPublishedCommit
    ) {}

    public record PublishRequest(
            String accessToken,
            String idempotencyKey,
            long sourceRevision,
            String baseBranch,
            String remoteBranch,
            String commitMessage,
            boolean createPullRequest,
            String pullRequestTitle,
            String pullRequestBody
    ) {}

    public record PublishResult(
            String operationId,
            String status,
            long sourceRevision,
            String baseBranch,
            String remoteBranch,
            String commitSha,
            String pullRequestUrl,
            String errorCode,
            String errorMessage,
            List<String> publishedPaths,
            Instant createdAt,
            Instant updatedAt
    ) {}

    public record GitOperationSummary(
            String id,
            String operationType,
            String status,
            long sourceRevision,
            String baseBranch,
            String remoteBranch,
            String commitSha,
            String pullRequestUrl,
            String errorCode,
            String errorMessage,
            Instant createdAt,
            Instant updatedAt
    ) {}
}

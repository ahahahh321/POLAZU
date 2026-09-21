package com.interfacelab.backend.projectimport;

import java.util.Map;

/** 가져온 파일은 아직 실행하지 않으며 서버 작업 공간에 저장할 수 있는 정규화된 형태입니다. */
public record ImportedProjectResponse(
        RepositorySource source,
        String framework,
        Map<String, String> files,
        Map<String, String> dependencies,
        int skippedFileCount,
        Map<String, String> binaryFiles,
        String baseCommit
) {
    public record RepositorySource(String owner, String repository, String ref, String url) {}
}

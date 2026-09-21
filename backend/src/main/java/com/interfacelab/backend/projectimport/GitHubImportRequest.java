package com.interfacelab.backend.projectimport;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GitHubImportRequest(
        @NotBlank(message = "GitHub 저장소 주소를 입력해 주세요.")
        @Size(max = 300, message = "저장소 주소가 너무 깁니다.")
        String repositoryUrl,
        @Size(max = 120, message = "브랜치 이름이 너무 깁니다.")
        String ref
) {}

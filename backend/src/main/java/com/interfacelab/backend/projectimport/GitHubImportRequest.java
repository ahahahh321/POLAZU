package com.interfacelab.backend.projectimport;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * GitHub 怨듦컻 ??μ냼瑜?Editor濡?媛?몄삱 ???ъ슜?섎뒗 ?붿껌?낅땲??
 *
 * @param repositoryUrl https://github.com/{owner}/{repository} ?뺤떇??怨듦컻 ??μ냼 二쇱냼
 * @param ref           ?좏깮??釉뚮옖移섎굹 ?쒓렇. 鍮꾩뼱 ?덉쑝硫???μ냼??湲곕낯 釉뚮옖移섎? ?ъ슜
 */
public record GitHubImportRequest(
		@NotBlank(message = "GitHub ??μ냼 二쇱냼瑜??낅젰??二쇱꽭??")
		@Size(max = 300, message = "??μ냼 二쇱냼媛 ?덈Т 源곷땲??")
		String repositoryUrl,
		@Size(max = 120, message = "釉뚮옖移??먮뒗 ?쒓렇 ?대쫫???덈Т 源곷땲??")
		String ref
) {
}

package com.interfacelab.backend.projectimport;

import java.util.Map;

/**
 * ?띿뒪???뚯뒪? ?덉슜??諛붿씠?덈━ ?먯뀑(Base64)??遺꾨━?댁꽌 諛섑솚?⑸땲??
 * ?쒕쾭?????뚯씪?ㅼ쓣 ?ㅽ뻾?섍굅???붿뒪?ъ뿉 ??ν븯吏 ?딆뒿?덈떎.
 */
public record ImportedProjectResponse(
		RepositorySource source,
		String framework,
		Map<String, String> files,
		Map<String, String> dependencies,
		int skippedFileCount,
		Map<String, String> binaryFiles
) {
	public record RepositorySource(String owner, String repository, String ref, String url) {
	}
}

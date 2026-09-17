import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 오늘은 백엔드가 없으므로, AWS에 올릴 HTML/CSS/JS 파일로 내보냅니다.
  output: "export",
  trailingSlash: true,
  agentRules: false,
  // WebContainer의 SharedArrayBuffer가 동작하도록 로컬 개발 페이지를 교차 출처 격리합니다.
  // 정적 배포에서는 호스팅 서비스의 사용자 지정 헤더 설정으로 동일하게 적용해야 합니다.
  async headers() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/editor/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // 개발 서버에서는 WebContainer에 필요한 응답 헤더를 Next가 직접 전달해야 합니다.
  // 정적 산출물은 headers()를 지원하지 않으므로 production에서만 export를 켭니다.
  ...(isDevelopment
    ? {
        async headers() {
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
      }
    : { output: "export" as const }),
  trailingSlash: true,
  agentRules: false,
};

export default nextConfig;

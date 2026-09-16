import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 오늘은 백엔드가 없으므로, AWS에 올릴 HTML/CSS/JS 파일로 내보냅니다.
  output: "export",
  trailingSlash: true,
  agentRules: false,
};

export default nextConfig;

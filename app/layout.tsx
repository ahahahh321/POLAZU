import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "POLAZU Workspace",
  description: "팀이 웹에서 디자인하고 실제 코드를 Git으로 검토·교환하는 공동 작업 공간",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body><ThemeProvider><AuthProvider>{children}</AuthProvider></ThemeProvider></body>
    </html>
  );
}

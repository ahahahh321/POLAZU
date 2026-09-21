import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "tmp — Main Page",
  description: "Explore UI components, preview designs, and discover this week’s trending interfaces.",
};

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

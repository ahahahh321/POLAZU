"use client";

import LoginForm from "@/components/auth/LoginForm";
import { useTheme } from "@/components/theme/ThemeProvider";
import "../(home)/reference-home.css";
import "./login.css";

export default function Page() {
  const { theme } = useTheme();
  return <div className="pz-home auth-page-container" data-home-theme={theme}>
    <main className="auth-main"><LoginForm /></main>
  </div>;
}

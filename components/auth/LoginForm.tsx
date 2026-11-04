"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/header/BrandLogo";
import { useAuth } from "@/components/auth/AuthProvider";
import { isRegistrationIntent, registrationPath, registrationSignupPath } from "@/components/auth/registration-route";

export default function LoginForm({ onSuccess, onSwitch }: { onSuccess?: () => void; onSwitch?: () => void }) {
  const router = useRouter();
  const { login } = useAuth();
  const [fromRegistration, setFromRegistration] = useState(false);
  useEffect(() => setFromRegistration(isRegistrationIntent(window.location.search)), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("이메일과 비밀번호를 모두 입력해주세요.");
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      await login({ email, password });
      if (onSuccess) onSuccess();
      else router.replace(isRegistrationIntent(window.location.search) ? registrationPath : "/mypage");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("로그인 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <div className="auth-header">
        <BrandLogo className="auth-brand" />
        <h1 className="auth-title" id="auth-form-title">로그인</h1>
        <p className="auth-subtitle">계정에 로그인하여 컴포넌트를 관리해보세요.</p>
      </div>

      {errorMessage && (
        <div className="auth-error-alert" role="alert">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{errorMessage}</span>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="email">이메일 주소</label>
          <div className="auth-input-wrapper">
            <input
              id="email"
              type="email"
              className="auth-input"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="password">비밀번호</label>
          <div className="auth-input-wrapper">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="auth-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="auth-toggle-pwd"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <button type="submit" className="auth-submit-btn" disabled={loading}>
          {loading ? (
            <span>로그인 중...</span>
          ) : (
            <span>로그인</span>
          )}
        </button>
      </form>

      <div className="auth-footer-text">
        <span>계정이 아직 없으신가요?</span>
        {onSwitch ? <button type="button" onClick={onSwitch}>회원가입</button> : <Link href={fromRegistration ? registrationSignupPath : "/signup"}>회원가입</Link>}
      </div>
    </div>
  );
}

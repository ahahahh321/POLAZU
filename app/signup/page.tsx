"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/header/Header";
import { useAuth } from "@/components/auth/AuthProvider";
import "./signup.css";

export default function SignUpPage() {
  const router = useRouter();
  const { signup } = useAuth();

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [profileImage, setProfileImage] = useState<string | null>(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Password validation checks
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasLetter && hasSpecial;
  const isPasswordMatched = password.length > 0 && password === passwordConfirm;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setErrorMessage("프로필 사진은 2MB 이하의 이미지만 업로드할 수 있습니다.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !name || !nickname || !password || !passwordConfirm) {
      setErrorMessage("모든 필수 항목을 입력해주세요.");
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage("비밀번호 조건을 모두 만족해야 합니다. (영문, 특수문자 필수, 8자 이상)");
      return;
    }

    if (!isPasswordMatched) {
      setErrorMessage("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    try {
      await signup({
        email,
        password,
        name,
        nickname,
        profileImageUrl: profileImage || undefined,
      });
      router.push("/mypage");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("회원가입 중 오류가 발생했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    alert("구글 계정 연동 가입 준비 중입니다. 곧 제공될 예정입니다!");
  };

  return (
    <div className="auth-page-container">
      <Header />
      <main className="auth-main">
        <div className="auth-card signup-card">
          <div className="auth-header">
            <span className="auth-badge">POLAZU</span>
            <h1 className="auth-title">회원가입</h1>
            <p className="auth-subtitle">POLAZU와 함께 인터페이스를 디자인하고 공유하세요.</p>
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
            {/* Profile Image (Optional) */}
            <div className="auth-field">
              <label className="auth-label">프로필 사진 (선택)</label>
              <div className="profile-upload-section">
                <div className="profile-upload-preview">
                  {profileImage ? (
                    <img src={profileImage} alt="프로필 미리보기" />
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="8" r="5" />
                      <path d="M20 21a8 8 0 0 0-16 0" />
                    </svg>
                  )}
                </div>
                <div className="profile-upload-controls">
                  <label className="profile-upload-btn" htmlFor="profile-img-input">
                    사진 선택
                  </label>
                  <input
                    id="profile-img-input"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: "none" }}
                  />
                  <span className="profile-upload-hint">권장 크기: 정방형 (최대 2MB)</span>
                </div>
              </div>
            </div>

            {/* Email */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="email">이메일 주소 <span style={{ color: "#ff4d0a" }}>*</span></label>
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

            {/* Name */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="name">이름 <span style={{ color: "#ff4d0a" }}>*</span></label>
              <div className="auth-input-wrapper">
                <input
                  id="name"
                  type="text"
                  className="auth-input"
                  placeholder="예: 홍길동"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            </div>

            {/* Nickname */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="nickname">닉네임 <span style={{ color: "#ff4d0a" }}>*</span></label>
              <div className="auth-input-wrapper">
                <input
                  id="nickname"
                  type="text"
                  className="auth-input"
                  placeholder="예: polazu_user"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="password">비밀번호 <span style={{ color: "#ff4d0a" }}>*</span></label>
              <div className="auth-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="auth-input"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
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

              {/* Password Rules Checklist */}
              <div className="password-rules-box">
                <div className={`password-rule-item ${hasMinLength ? "valid" : ""}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    {hasMinLength ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
                  </svg>
                  <span>8자 이상</span>
                </div>
                <div className={`password-rule-item ${hasLetter ? "valid" : ""}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    {hasLetter ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
                  </svg>
                  <span>영문 포함 (대소문자 무관)</span>
                </div>
                <div className={`password-rule-item ${hasSpecial ? "valid" : ""}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    {hasSpecial ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
                  </svg>
                  <span>특수문자 필수 (!@#$%^&* 등)</span>
                </div>
                <div className={`password-rule-item optional ${hasNumber ? "valid" : ""}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    {hasNumber ? <polyline points="20 6 9 17 4 12" /> : <circle cx="12" cy="12" r="3" />}
                  </svg>
                  <span>숫자 포함 (선택사항)</span>
                </div>
              </div>
            </div>

            {/* Password Confirm */}
            <div className="auth-field">
              <label className="auth-label" htmlFor="passwordConfirm">비밀번호 확인 <span style={{ color: "#ff4d0a" }}>*</span></label>
              <div className="auth-input-wrapper">
                <input
                  id="passwordConfirm"
                  type={showPasswordConfirm ? "text" : "password"}
                  className="auth-input"
                  placeholder="비밀번호를 다시 입력하세요"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="auth-toggle-pwd"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  aria-label={showPasswordConfirm ? "비밀번호 확인 숨기기" : "비밀번호 확인 표시"}
                >
                  {showPasswordConfirm ? (
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

              {passwordConfirm.length > 0 && (
                <div className={`password-match-status ${isPasswordMatched ? "matched" : "mismatched"}`}>
                  {isPasswordMatched ? "✓ 비밀번호가 일치합니다." : "✗ 비밀번호가 일치하지 않습니다."}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="auth-submit-btn"
              disabled={loading || !isPasswordValid || !isPasswordMatched}
            >
              {loading ? (
                <span>가입 처리 중...</span>
              ) : (
                <span>회원가입 완료</span>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>또는</span>
          </div>

          <button
            type="button"
            className="auth-oauth-btn"
            onClick={handleGoogleSignUp}
          >
            <svg viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Google 계정으로 가입하기</span>
          </button>

          <div className="auth-footer-text">
            <span>이미 계정이 있으신가요?</span>
            <Link href="/login">로그인</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

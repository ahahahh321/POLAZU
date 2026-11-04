"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/header/BrandLogo";
import { useAuth } from "@/components/auth/AuthProvider";
import { isRegistrationIntent, registrationLoginPath } from "@/components/auth/registration-route";

export default function SignupForm({ onSuccess, onSwitch }: { onSuccess?: () => void; onSwitch?: () => void }) {
  const router = useRouter();
  const { signup } = useAuth();
  const [fromRegistration, setFromRegistration] = useState(false);
  useEffect(() => setFromRegistration(isRegistrationIntent(window.location.search)), []);

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
      if (onSuccess) onSuccess();
      else router.replace(isRegistrationIntent(window.location.search) ? registrationLoginPath : "/login/");
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

  return (
    <div className="auth-card signup-card">
      <div className="auth-header">
        <BrandLogo className="auth-brand" />
        <h1 className="auth-title" id="auth-form-title">회원가입</h1>
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
        <div className="auth-field signup-wide">
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
              <span className="profile-upload-hint">프로필 사진 · 선택, 최대 2MB</span>
            </div>
          </div>
        </div>

        {/* Email */}
        <div className="auth-field signup-wide">
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

        </div>

        {/* Password Rules Checklist */}
        <div className="password-rules-box signup-wide">
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
          className="auth-submit-btn signup-wide"
          disabled={loading || !isPasswordValid || !isPasswordMatched}
        >
          {loading ? (
            <span>가입 처리 중...</span>
          ) : (
            <span>회원가입 완료</span>
          )}
        </button>
      </form>

      <div className="auth-footer-text">
        <span>이미 계정이 있으신가요?</span>
        {onSwitch ? <button type="button" onClick={onSwitch}>로그인</button> : <Link href={fromRegistration ? registrationLoginPath : "/login"}>로그인</Link>}
      </div>
    </div>
  );
}

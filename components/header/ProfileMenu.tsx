"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/AuthProvider";
import { useTheme } from "../theme/ThemeProvider";
import "./profile-menu.css";

export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleMouseEnter = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 250);
  };

  const toggleDropdown = () => {
    setIsOpen((prev) => !prev);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
    router.push("/login");
  };

  const initial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <div
      className="profile-menu-container"
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className="profile-avatar-button"
        onClick={toggleDropdown}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="프로필 메뉴 열기"
      >
        {user?.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            alt={user.name || "사용자 프로필"}
            className="profile-avatar-img"
          />
        ) : user ? (
          <div className="profile-avatar-fallback">
            {initial}
          </div>
        ) : (
          <div className="profile-avatar-guest" title="로그인 / 회원가입">
            <svg viewBox="0 0 32 32" className="profile-guest-avatar-svg" aria-hidden="true">
              <circle cx="16" cy="16" r="16" fill="#d9d9d9" />
              <circle cx="16" cy="11.5" r="4.5" fill="#757575" />
              <path d="M8 25.5c0-4.2 3.6-7 8-7s8 2.8 8 7c0 .8-.7 1.5-1.5 1.5h-13c-.8 0-1.5-.7-1.5-1.5z" fill="#757575" />
            </svg>
          </div>
        )}
      </button>

      {isOpen && (
        <div className="profile-popup" role="menu" aria-orientation="vertical">
          {user ? (
            <>
              <div className="profile-popup-header">
                <div className="profile-popup-avatar">
                  {user.profileImageUrl ? (
                    <img src={user.profileImageUrl} alt={user.name} />
                  ) : (
                    <div className="profile-avatar-fallback">{initial}</div>
                  )}
                </div>
                <div className="profile-popup-info">
                  <h4 className="profile-popup-name">{user.name}</h4>
                  <div className="profile-popup-handle">@{user.nickname}</div>
                  <div className="profile-popup-email">{user.email}</div>
                </div>
              </div>

              <div className="profile-popup-menu">
                <Link
                  href="/mypage"
                  className="profile-popup-item"
                  onClick={() => setIsOpen(false)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="5" />
                    <path d="M20 21a8 8 0 0 0-16 0" />
                  </svg>
                  <span>My Page</span>
                </Link>

                <Link
                  href="/mypage?tab=components"
                  className="profile-popup-item"
                  onClick={() => setIsOpen(false)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <span>My Components</span>
                </Link>

                <Link
                  href="/mypage?tab=downloads"
                  className="profile-popup-item"
                  onClick={() => setIsOpen(false)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Downloads</span>
                </Link>

                <Link
                  href="/mypage?tab=projects"
                  className="profile-popup-item"
                  onClick={() => setIsOpen(false)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>My Projects</span>
                </Link>

                <Link
                  href="/mypage?dialog=account"
                  className="profile-popup-item"
                  onClick={() => setIsOpen(false)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span>Settings</span>
                </Link>
              </div>

              <div className="profile-popup-footer">
                <button
                  type="button"
                  className="theme-toggle-btn"
                  onClick={toggleTheme}
                  title="다크 / 라이트 모드 전환"
                >
                  {theme === "dark" ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                      </svg>
                      <span>라이트 모드</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="currentColor" />
                      </svg>
                      <span>다크 모드</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="logout-btn"
                  onClick={handleLogout}
                  title="로그아웃"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>로그아웃</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="profile-popup-header">
                <div className="profile-popup-info">
                  <h4 className="profile-popup-name">환영합니다!</h4>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#888" }}>
                    로그인하고 맞춤형 컴포넌트를 탐색해보세요.
                  </p>
                </div>
              </div>

              <div className="profile-guest-actions">
                <Link
                  href="/login"
                  className="profile-guest-btn-primary"
                  onClick={() => setIsOpen(false)}
                >
                  로그인
                </Link>
                <Link
                  href="/signup"
                  className="profile-guest-btn-secondary"
                  onClick={() => setIsOpen(false)}
                >
                  회원가입
                </Link>
              </div>

              <div className="profile-popup-footer">
                <button
                  type="button"
                  className="theme-toggle-btn"
                  onClick={toggleTheme}
                  title="다크 / 라이트 모드 전환"
                >
                  {theme === "dark" ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                      </svg>
                      <span>라이트 모드</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" fill="currentColor" />
                      </svg>
                      <span>다크 모드</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

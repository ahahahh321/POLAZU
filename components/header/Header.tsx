"use client";

import Link from "next/link";
import ProfileMenu from "./ProfileMenu";
import { useAuth } from "../auth/AuthProvider";
import "./header.css";

// props는 페이지가 공통 헤더에 전달하는 값과 동작입니다.
type HeaderProps = {
  query?: string;
  onSearch?: (value: string) => void;
  activeNav?: "Explore" | "Convert" | "Editor" | "Upload" | "Pricing";
};

export default function Header({ query = "", onSearch, activeNav }: HeaderProps) {
  const { user, loading } = useAuth();

  return (
    <header className="common-header-bar">
      <div className="common-header">
        <Link href="/" className="common-logo" aria-label="POLAZU 홈">LOGO</Link>
        <nav className="common-navigation" aria-label="주요 메뉴">
          <Link href="/" aria-current={activeNav === "Explore" ? "page" : undefined}>Explore</Link>
          <Link href="/convert/" aria-current={activeNav === "Convert" ? "page" : undefined}>Convert</Link>
          <div className="editor-nav-menu">
            <button type="button" className={`editor-nav-trigger${activeNav === "Editor" ? " active" : ""}`} aria-haspopup="menu">Editor</button>
            <div className="editor-nav-dropdown" role="menu" aria-label="Editor 메뉴">
              <a href="/editor/ui/" role="menuitem" className="editor-nav-option">
                <strong>UI Edit</strong><small>저장한 UI 수정</small>
              </a>
              <a href="/editor/?mode=project" role="menuitem" className="editor-nav-option">
                <strong>Project Edit</strong><small>프로젝트 코드 편집</small>
              </a>
            </div>
          </div>
          <Link href="/upload/" aria-current={activeNav === "Upload" ? "page" : undefined}>Upload</Link>
          <Link href="/pricing/" aria-current={activeNav === "Pricing" ? "page" : undefined}>Pricing</Link>
        </nav>
        {onSearch ? (
          <label className="common-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="10" cy="10" r="6.5" />
              <path d="m15 15 5 5" />
            </svg>
            <span className="sr-only">컴포넌트 검색</span>
            <input
              type="search"
              placeholder="search"
              value={query}
              onChange={(event) => onSearch(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                className="common-search-clear"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSearch("");
                }}
                aria-label="검색어 지우기"
                title="검색어 지우기"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ) : null}
          </label>
        ) : <span className="common-header-spacer" aria-hidden="true" />}

        <ProfileMenu />
      </div>
    </header>
  );
}

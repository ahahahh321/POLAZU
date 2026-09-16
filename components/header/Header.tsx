"use client";

import Avatar from "../avatar/Avatar";
import "./header.css";

// props는 페이지가 공통 헤더에 전달하는 값과 동작입니다.
type HeaderProps = {
  query: string;
  onSearch: (value: string) => void;
};

export default function Header({ query, onSearch }: HeaderProps) {
  return (
    <header className="common-header">
      <a href="/" className="common-logo" aria-label="tmp 홈">LOGO</a>
      <nav className="common-navigation" aria-label="주요 메뉴">
        <a href="#browse" aria-current="page">Explore</a>
        {["Convert", "Editor", "Community", "Pricing"].map((label) => (
          <button key={label} type="button" disabled title="준비 중">{label}</button>
        ))}
      </nav>
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
      </label>
      <span className="common-profile" role="img" aria-label="프로필 자리">
        <Avatar />
      </span>
    </header>
  );
}

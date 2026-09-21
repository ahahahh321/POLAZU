"use client";

import Link from "next/link";
import ProfileMenu from "./ProfileMenu";
import "./header.css";

type HeaderProps = {
  query?: string;
  onSearch?: (value: string) => void;
  activeNav?: "Explore" | "Projects" | "Editor" | "Convert" | "Pricing" | "Upload";
};

export default function Header({ query = "", onSearch, activeNav }: HeaderProps) {
  return <header className="common-header-bar"><div className="common-header"><Link href="/projects" className="common-logo" aria-label="POLAZU 프로젝트 홈">POLAZU</Link><nav className="common-navigation" aria-label="주요 메뉴"><Link href="/projects" aria-current={activeNav==="Projects"?"page":undefined}>Projects</Link><Link href="/explore" aria-current={activeNav==="Explore"?"page":undefined}>Explore</Link><Link href="/editor" aria-current={activeNav==="Editor"?"page":undefined}>Editor</Link></nav>{onSearch?<label className="common-search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/></svg><span className="sr-only">검색</span><input type="search" placeholder="search" value={query} onChange={event=>onSearch(event.target.value)}/>{query&&<button type="button" className="common-search-clear" onClick={()=>onSearch("")} aria-label="검색어 지우기">×</button>}</label>:<span className="common-header-spacer" aria-hidden="true"/>}<ProfileMenu/></div></header>;
}

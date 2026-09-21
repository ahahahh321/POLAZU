"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../auth/AuthProvider";
import { useTheme } from "../theme/ThemeProvider";
import "./profile-menu.css";

export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const close = (event: MouseEvent) => { if (container.current && !container.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function signOut() { setOpen(false); await logout(); router.push("/login"); }
  const initial = user?.name?.slice(0,1).toUpperCase() ?? "?";

  return <div className="profile-menu-container" ref={container}><button type="button" className="profile-avatar-button" onClick={()=>setOpen(value=>!value)} aria-expanded={open} aria-haspopup="menu" aria-label="프로필 메뉴"><div className={user?"profile-avatar-fallback":"profile-avatar-guest"}>{initial}</div></button>{open&&<div className="profile-popup" role="menu">{user?<><div className="profile-popup-header"><div className="profile-popup-avatar"><div className="profile-avatar-fallback">{initial}</div></div><div className="profile-popup-info"><h4 className="profile-popup-name">{user.name}</h4><div className="profile-popup-handle">@{user.nickname}</div><div className="profile-popup-email">{user.email}</div></div></div><div className="profile-popup-menu"><Link href="/projects" className="profile-popup-item" onClick={()=>setOpen(false)}>▦ <span>My Projects</span></Link><Link href="/mypage" className="profile-popup-item" onClick={()=>setOpen(false)}>◎ <span>My Page</span></Link><Link href="/explore" className="profile-popup-item" onClick={()=>setOpen(false)}>◇ <span>Explore</span></Link></div><div className="profile-popup-footer"><button type="button" className="theme-toggle-btn" onClick={toggleTheme}>{theme==="dark"?"☀ 라이트 모드":"☾ 다크 모드"}</button><button type="button" className="theme-toggle-btn" onClick={()=>void signOut()}>↪ 로그아웃</button></div></>:<><div className="profile-guest-header"><strong>POLAZU 시작하기</strong><span>로그인 후 공유 프로젝트를 열 수 있습니다.</span></div><div className="profile-guest-actions"><Link href="/login" className="profile-guest-btn-primary">로그인</Link><Link href="/signup" className="profile-guest-btn-secondary">회원가입</Link></div><div className="profile-popup-footer"><button type="button" className="theme-toggle-btn" onClick={toggleTheme}>{theme==="dark"?"☀ 라이트 모드":"☾ 다크 모드"}</button></div></>}</div>}</div>;
}

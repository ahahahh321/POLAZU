"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/header/Header";
import { useAuth } from "@/components/auth/AuthProvider";
import "./page.css";

export default function MyPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(()=>{ if(!loading&&!user) router.replace("/login?next=/mypage"); },[loading,router,user]);
  if(loading||!user)return <main className="route-gate"><div className="route-gate-spinner"/><p>계정을 확인하는 중입니다.</p></main>;
  return <div className="mypage-view"><Header/><main className="simple-mypage"><section className="simple-profile"><div className="simple-avatar">{user.name.slice(0,1).toUpperCase()}</div><div><span>POLAZU ACCOUNT</span><h1>{user.name}</h1><p>@{user.nickname}</p></div></section><section className="simple-account-grid"><article><span>EMAIL</span><strong>{user.email}</strong><p>로그인 계정 이메일입니다.</p></article><article><span>LANGUAGE</span><strong>{user.locale.toUpperCase()}</strong><p>현재 사용자 언어 설정입니다.</p></article><article><span>SESSION</span><strong>HttpOnly cookie</strong><p>브라우저 JavaScript에서 세션 토큰을 직접 읽지 않습니다.</p></article></section><div className="simple-mypage-actions"><Link href="/projects">프로젝트 작업 공간 열기</Link><Link href="/explore">Explore 보기</Link></div><p className="simple-note">프로필 이미지 변경, 비밀번호 재설정, 계정 삭제 API는 이번 구현 범위에서 미구현 상태로 명시했습니다.</p></main></div>;
}

"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { errorMessage } from "@/lib/api";
import "../auth.css";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!loading && user) router.replace("/projects"); }, [loading, router, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await login(email, password);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/projects");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <main className="auth-shell"><section className="auth-brand"><Link href="/explore" className="auth-logo">POLAZU</Link><p>웹에서 함께 디자인하고,<br/>실제 코드는 Git으로 안전하게 전달하세요.</p><div className="auth-flow"><span>Shared workspace</span><b>→</b><span>Review</span><b>→</b><span>Branch · PR</span></div></section><section className="auth-card"><div><span className="auth-eyebrow">WELCOME BACK</span><h1>로그인</h1><p>내 프로젝트와 팀 작업 공간을 엽니다.</p></div><form onSubmit={submit}><label>이메일<input type="email" autoComplete="email" value={email} onChange={(event)=>setEmail(event.target.value)} required/></label><label>비밀번호<input type="password" autoComplete="current-password" value={password} onChange={(event)=>setPassword(event.target.value)} minLength={8} required/></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-primary" disabled={busy}>{busy ? "로그인 중…" : "로그인"}</button></form><p className="auth-switch">계정이 없나요? <Link href="/signup">회원가입</Link></p></section></main>;
}

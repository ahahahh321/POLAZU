"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { errorMessage } from "@/lib/api";
import "../auth.css";

export default function SignupPage() {
  const { user, loading, signup } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", confirm: "", name: "", nickname: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (!loading && user) router.replace("/projects"); }, [loading, router, user]);

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (form.password !== form.confirm) { setError("비밀번호 확인이 일치하지 않습니다."); return; }
    setBusy(true);
    try {
      await signup({ email: form.email, password: form.password, name: form.name, nickname: form.nickname || undefined });
      router.replace("/projects");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }
  const field = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));

  return <main className="auth-shell"><section className="auth-brand"><Link href="/explore" className="auth-logo">POLAZU</Link><p>프로젝트를 한 번 가져오면<br/>팀원은 같은 서버 작업 공간에서 이어서 작업합니다.</p><ul><li>공개·비공개 GitHub 저장소</li><li>로컬 ZIP 프로젝트</li><li>소유자·수정자·뷰어 권한</li></ul></section><section className="auth-card auth-card-wide"><div><span className="auth-eyebrow">CREATE WORKSPACE</span><h1>회원가입</h1><p>세션 쿠키는 HttpOnly로 발급되며 GitHub 토큰은 저장하지 않습니다.</p></div><form onSubmit={submit}><div className="auth-grid"><label>이름<input value={form.name} onChange={e=>field("name",e.target.value)} minLength={2} maxLength={80} required/></label><label>닉네임 <small>선택</small><input value={form.nickname} onChange={e=>field("nickname",e.target.value)} minLength={2} maxLength={40}/></label></div><label>이메일<input type="email" autoComplete="email" value={form.email} onChange={e=>field("email",e.target.value)} required/></label><div className="auth-grid"><label>비밀번호<input type="password" autoComplete="new-password" value={form.password} onChange={e=>field("password",e.target.value)} minLength={8} required/><small>문자와 숫자를 포함한 8자 이상</small></label><label>비밀번호 확인<input type="password" autoComplete="new-password" value={form.confirm} onChange={e=>field("confirm",e.target.value)} minLength={8} required/></label></div>{error && <p className="auth-error" role="alert">{error}</p>}<button className="auth-primary" disabled={busy}>{busy ? "계정 생성 중…" : "계정 만들기"}</button></form><p className="auth-switch">이미 계정이 있나요? <Link href="/login">로그인</Link></p></section></main>;
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";

export default function EntryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading) router.replace(user ? "/projects" : "/login");
  }, [loading, router, user]);
  return <main className="route-gate" aria-busy="true"><div className="route-gate-spinner"/><p>POLAZU 작업 공간을 확인하는 중입니다.</p></main>;
}

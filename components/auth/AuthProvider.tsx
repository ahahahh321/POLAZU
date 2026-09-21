"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import type { User } from "@/lib/types";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<User | null>;
  login: (email: string, password: string) => Promise<User>;
  signup: (input: { email: string; password: string; name: string; nickname?: string }) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await apiFetch<User>("/api/auth/me");
      setUser(next);
      return next;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) console.warn("Auth refresh failed", error);
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const next = await apiFetch<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setUser(next);
    return next;
  }, []);

  const signup = useCallback(async (input: { email: string; password: string; name: string; nickname?: string }) => {
    const next = await apiFetch<User>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify(input),
    });
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    try { await apiFetch<{ loggedOut: boolean }>("/api/auth/logout", { method: "POST" }); }
    finally { setUser(null); }
  }, []);

  const value = useMemo(() => ({ user, loading, refresh, login, signup, logout }), [user, loading, refresh, login, signup, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}

"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { AuthContextType, LoginInput, Member, SignUpInput } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080";

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => { throw new Error("AuthProvider not found"); },
  signup: async () => { throw new Error("AuthProvider not found"); },
  logout: async () => {},
  refresh: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (): Promise<Member | null> => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as Member;
        setUser(data);
        return data;
      } else {
        setUser(null);
        return null;
      }
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (input: LoginInput): Promise<Member> => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      let errorMsg = "로그인에 실패했습니다.";
      try {
        const errData = await res.json();
        if (errData.message) errorMsg = errData.message;
      } catch {
        // ignore parse error
      }
      throw new Error(errorMsg);
    }

    const data = (await res.json()) as Member;
    setUser(data);
    return data;
  };

  const signup = async (input: SignUpInput): Promise<Member> => {
    const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      let errorMsg = "회원가입에 실패했습니다.";
      try {
        const errData = await res.json();
        if (errData.message) errorMsg = errData.message;
      } catch {
        // ignore parse error
      }
      throw new Error(errorMsg);
    }

    const data = (await res.json()) as Member;
    setUser(data);
    return data;
  };

  const logout = async (): Promise<void> => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // ignore network errors on logout
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

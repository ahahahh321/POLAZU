"use client";

import { useMemo, useState, useEffect } from "react";
import { accountSeed, profileSeed, savedItems } from "../data";
import { useAuth } from "@/components/auth/AuthProvider";

export function useMyPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(profileSeed);
  const [account, setAccount] = useState(accountSeed);
  const [saved, setSaved] = useState(savedItems);
  const [dialog, setDialog] = useState<"edit" | "followers" | "following" | "account" | "withdraw" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setProfile((prev) => ({
        ...prev,
        name: user.name || prev.name,
        handle: user.nickname ? `@${user.nickname}` : prev.handle,
        avatarUrl: user.profileImageUrl || prev.avatarUrl,
      }));
      setAccount((prev) => ({
        ...prev,
        email: user.email || prev.email,
      }));
    }
  }, [user]);

  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const syncParams = () => {
        const params = new URLSearchParams(window.location.search);
        const tabParam = params.get("tab");
        if (tabParam === "components") setActiveTab(0);
        else if (tabParam === "downloads") setActiveTab(1);
        else if (tabParam === "projects") setActiveTab(2);

        const dialogParam = params.get("dialog");
        if (dialogParam === "account" || dialogParam === "edit") {
          setDialog(dialogParam as "account" | "edit");
        }
      };
      syncParams();
      window.addEventListener("popstate", syncParams);
      return () => window.removeEventListener("popstate", syncParams);
    }
  }, []);

  const followerLabel = useMemo(() => profile.followers.toLocaleString(), [profile.followers]);
  const followingLabel = useMemo(() => profile.following.toLocaleString(), [profile.following]);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2600);
  }

  function removeSaved(id: number) {
    setSaved((items) => items.filter((item) => item.id !== id));
    showNotice("저장 목록에서 삭제했어요.");
  }

  return {
    profile,
    setProfile,
    account,
    setAccount,
    saved,
    dialog,
    setDialog,
    notice,
    activeTab,
    setActiveTab,
    followerLabel,
    followingLabel,
    removeSaved,
    showNotice,
  };
}

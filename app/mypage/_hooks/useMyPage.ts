"use client";

import { useMemo, useState } from "react";
import { accountSeed, profileSeed, savedItems } from "../data";

export function useMyPage() {
  const [profile, setProfile] = useState(profileSeed);
  const [account, setAccount] = useState(accountSeed);
  const [saved, setSaved] = useState(savedItems);
  const [dialog, setDialog] = useState<"edit" | "followers" | "following" | "account" | "withdraw" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    followerLabel,
    followingLabel,
    removeSaved,
    showNotice,
  };
}

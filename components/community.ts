"use client";

import { useEffect, useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080";

export async function communityRequest(path: string, init?: RequestInit) {
  const response = await fetch(apiBase + "/api/community" + path, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });
  if (!response.ok) throw new Error("Community request failed");
  return response;
}

export function useSavedCommunity(memberId?: number) {
  const [list, setList] = useState<{ memberId: number; ids: number[] }>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setError("");
    if (memberId === undefined) {
      setList(undefined);
      return;
    }
    const controller = new AbortController();
    communityRequest("/saved", { signal: controller.signal })
      .then(async (response) => {
        const ids: number[] = await response.json();
        if (!controller.signal.aborted) setList({ memberId, ids });
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("저장한 UI를 불러오지 못했어요.");
      });
    return () => controller.abort();
  }, [memberId, reload]);

  const current = list?.memberId === memberId ? list : undefined;
  const ids = current?.ids ?? [];

  async function toggle(id: number) {
    if (!current || pending) return;
    setPending(true);
    setError("");
    const saved = !ids.includes(id);
    try {
      await communityRequest("/saved/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved }),
      });
      setList((latest) => latest?.memberId === current.memberId
        ? { ...latest, ids: saved ? [...new Set([...latest.ids, id])] : latest.ids.filter((entry) => entry !== id) }
        : latest);
    } catch {
      setError("저장 상태를 변경하지 못했어요.");
    } finally {
      setPending(false);
    }
  }

  return { ids, pending, error, ready: !!current, toggle, retry: () => setReload((value) => value + 1) };
}

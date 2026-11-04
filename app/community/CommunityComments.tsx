"use client";

import { useEffect, useState, type FormEvent } from "react";
import { communityRequest } from "@/components/community";

type Comment = { id: number; author: string; body: string };

export default function CommunityComments({ id, signedIn, onLogin }: {
  id: number;
  signedIn: boolean;
  onLogin: () => void;
}) {
  const [comments, setComments] = useState<Comment[]>();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [postError, setPostError] = useState(false);
  const [revision, setRevision] = useState(0);
  const path = "/components/" + id + "/comments";

  useEffect(() => {
    const controller = new AbortController();
    setLoadError(false);
    communityRequest(path, { signal: controller.signal }).then(async (response) => {
      const result: Comment[] = await response.json();
      if (!controller.signal.aborted) setComments(result);
    }).catch(() => {
      if (!controller.signal.aborted) setLoadError(true);
    });
    return () => controller.abort();
  }, [path, revision]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || pending) return;
    setPending(true);
    setPostError(false);
    try {
      await communityRequest(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      setBody("");
      setRevision((value) => value + 1);
    } catch {
      setPostError(true);
    } finally {
      setPending(false);
    }
  }

  return <div className="pz-comments">
    {loadError ? <p role="alert">의견을 불러오지 못했어요. <button className="pz-pill" type="button" onClick={() => setRevision(revision + 1)}>다시 시도</button></p>
      : !comments ? <p>의견을 불러오는 중이에요.</p>
      : comments.length === 0 ? <p>아직 남겨진 의견이 없어요.</p>
      : <ul>{comments.map((comment) => <li key={comment.id}><strong>@{comment.author}</strong><p>{comment.body}</p></li>)}</ul>}
    {signedIn ? <form onSubmit={submit}>
      <label htmlFor={`pz-comment-${id}`}>의견 남기기</label>
      <textarea id={`pz-comment-${id}`} value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={1000} required />
      <button className="pz-pill" type="submit" disabled={pending || !body.trim()}>{pending ? "등록 중…" : "의견 등록"}</button>
      {postError && <p role="alert">의견을 등록하지 못했어요. 다시 시도해 주세요.</p>}
    </form> : <button className="pz-pill" type="button" onClick={onLogin}>로그인하고 의견 남기기</button>}
  </div>;
}

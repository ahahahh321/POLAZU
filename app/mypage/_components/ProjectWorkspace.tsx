"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8080";

type ProjectMember = { id: number; email: string; nickname: string; role: "OWNER" | "EDITOR" | "VIEWER" };
type Project = {
  id: number;
  name: string;
  description: string | null;
  githubRepositoryUrl: string | null;
  ownerId: number;
  myRole: ProjectMember["role"];
  members: ProjectMember[];
  updatedAt: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-POLAZU-Request": "editor-v3", ...init?.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "요청을 처리하지 못했습니다." }));
    throw new Error(error.message ?? "요청을 처리하지 못했습니다.");
  }
  return response.json() as Promise<T>;
}

export default function ProjectWorkspace() {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [dialog, setDialog] = useState<"create" | "invite" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const data = await request<Project[]>("/api/projects");
      setProjects(data);
      if (selected) setSelected(data.find((item) => item.id === selected.id) ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "프로젝트를 불러오지 못했습니다.");
    }
  }, [user, selected]);

  useEffect(() => { void load(); }, [user]); // 선택 변경은 불필요한 재호출을 만들지 않습니다.

  useEffect(() => {
    if (!user) return;
    const token = new URLSearchParams(window.location.search).get("invite");
    if (!token) return;
    void request<Project>("/api/projects/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).then(() => {
      setMessage("프로젝트 초대를 수락했어요.");
      window.history.replaceState({}, "", "/mypage?tab=projects");
      void load();
    }).catch((error) => setMessage(error instanceof Error ? error.message : "초대를 수락하지 못했습니다."));
  }, [user]);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await request<Project>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: form.get("name"),
          description: form.get("description") || null,
          githubRepositoryUrl: form.get("githubRepositoryUrl") || null,
        }),
      });
      setDialog(null);
      setMessage("새 프로젝트를 만들었어요.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "프로젝트를 만들지 못했습니다.");
    } finally { setBusy(false); }
  }

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    try {
      const result = await request<{ token: string }>(`/api/projects/${selected.id}/invitations`, {
        method: "POST",
        body: JSON.stringify({ email: form.get("email"), role: form.get("role") }),
      });
      const url = new URL("/mypage", window.location.origin);
      url.searchParams.set("tab", "projects");
      url.searchParams.set("invite", result.token);
      setInviteLink(url.toString());
      setMessage("초대 링크를 만들었어요. 해당 사용자에게 안전하게 전달하세요.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "초대를 만들지 못했습니다.");
    } finally { setBusy(false); }
  }

  if (authLoading) return <div className="mypage-project-empty">로그인 정보를 확인하고 있어요.</div>;
  if (!user) return <div className="mypage-project-empty"><b>로그인이 필요해요.</b><a href="/login">로그인하러 가기 →</a></div>;

  return (
    <>
      <div className="mypage-project-toolbar">
        <div><p>MY WORKSPACE</p><h2>내 프로젝트 <span>{projects.length}</span></h2></div>
        <button type="button" onClick={() => { setInviteLink(""); setDialog("create"); }}>+ 새 프로젝트</button>
      </div>
      {message && <p className="mypage-project-message" role="status">{message}</p>}
      {projects.length === 0 ? (
        <div className="mypage-project-empty"><b>아직 프로젝트가 없어요.</b><span>프로젝트를 만들고 가입한 팀원을 초대해 보세요.</span></div>
      ) : (
        <div className="mypage-project-grid">
          {projects.map((project, index) => (
            <article key={project.id}>
              <div style={{ background: ["#ff4d0a", "#6d5dfc", "#202020"][index % 3] }}><span>{project.myRole}</span><b>{project.name.slice(0, 1).toUpperCase()}</b></div>
              <h3>{project.name}</h3>
              <p>{project.members.length}명 · {project.githubRepositoryUrl ? "GitHub 연결됨" : "저장소 미연결"}</p>
              <button type="button" onClick={() => { setSelected(project); setInviteLink(""); setDialog("invite"); }}>멤버 및 초대 →</button>
            </article>
          ))}
        </div>
      )}

      {dialog && (
        <div className="mypage-dialog-backdrop" role="presentation" onMouseDown={() => setDialog(null)}>
          <section className="mypage-dialog mypage-project-dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="mypage-dialog-close" onClick={() => setDialog(null)} aria-label="닫기">×</button>
            {dialog === "create" ? (
              <form onSubmit={createProject}>
                <p className="mypage-eyebrow">NEW PROJECT</p><h2>프로젝트 만들기</h2>
                <label>이름<input name="name" required maxLength={80} /></label>
                <label>설명<textarea name="description" maxLength={500} rows={3} /></label>
                <label>GitHub 저장소 주소<input name="githubRepositoryUrl" type="url" placeholder="https://github.com/owner/repository" /></label>
                <button className="mypage-primary" disabled={busy}>{busy ? "만드는 중..." : "프로젝트 만들기"}</button>
              </form>
            ) : selected && (
              <>
                <p className="mypage-eyebrow">{selected.myRole}</p><h2>{selected.name}</h2>
                <div className="mypage-project-members">
                  {selected.members.map((member) => <div key={member.id}><span>{member.nickname.slice(0, 1).toUpperCase()}</span><p><b>{member.nickname}</b><small>{member.email}</small></p><em>{member.role}</em></div>)}
                </div>
                {selected.myRole === "OWNER" && <form onSubmit={inviteMember}>
                  <label>가입한 사용자 이메일<input name="email" type="email" required maxLength={191} /></label>
                  <label>권한<select name="role" defaultValue="EDITOR"><option value="EDITOR">편집자</option><option value="VIEWER">보기 전용</option></select></label>
                  <button className="mypage-primary" disabled={busy}>{busy ? "초대 중..." : "초대 링크 만들기"}</button>
                </form>}
                {inviteLink && <div className="mypage-invite-link"><input readOnly value={inviteLink} /><button type="button" onClick={() => void navigator.clipboard.writeText(inviteLink)}>복사</button></div>}
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}

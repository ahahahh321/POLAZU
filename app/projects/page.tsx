"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/header/Header";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiFetch, errorMessage } from "@/lib/api";
import type { ProjectStatus, ProjectSummary } from "@/lib/types";
import "./projects.css";

type CreateMode = "github" | "zip" | "empty";

export default function ProjectsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ProjectStatus>("ACTIVE");
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<CreateMode>("github");
  const [github, setGithub] = useState({ repositoryUrl: "", ref: "", accessToken: "", name: "" });
  const [emptyName, setEmptyName] = useState("");
  const [zipName, setZipName] = useState("");

  const loadProjects = useCallback(async () => {
    if (!user) return;
    setLoadingProjects(true); setError("");
    try {
      const params = new URLSearchParams({ status });
      if (query.trim()) params.set("query", query.trim());
      setProjects(await apiFetch<ProjectSummary[]>(`/api/projects?${params}`));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoadingProjects(false); }
  }, [query, status, user]);

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent("/projects")}`);
  }, [loading, router, user]);
  useEffect(() => { const timer = setTimeout(() => void loadProjects(), 180); return () => clearTimeout(timer); }, [loadProjects]);

  async function createGitHub(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const project = await apiFetch<ProjectSummary>("/api/projects/import/github", {
        method: "POST",
        body: JSON.stringify({
          repositoryUrl: github.repositoryUrl,
          ref: github.ref || null,
          accessToken: github.accessToken || null,
          name: github.name || null,
        }),
      });
      setGithub({ repositoryUrl: "", ref: "", accessToken: "", name: "" });
      router.push(`/editor?projectId=${project.id}`);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function uploadZip(file: File | undefined) {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const form = new FormData(); form.append("file", file); if (zipName.trim()) form.append("name", zipName.trim());
      const project = await apiFetch<ProjectSummary>("/api/projects/import/zip", { method: "POST", body: form });
      router.push(`/editor?projectId=${project.id}`);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function createEmpty(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const project = await apiFetch<ProjectSummary>("/api/projects", { method: "POST", body: JSON.stringify({ name: emptyName }) });
      router.push(`/editor?projectId=${project.id}`);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function changeStatus(project: ProjectSummary, next: ProjectStatus) {
    const action = next === "DELETED" ? "휴지통으로 이동" : next === "ARCHIVED" ? "보관" : "복구";
    if (!window.confirm(`“${project.name}” 프로젝트를 ${action}할까요?`)) return;
    try {
      await apiFetch(`/api/projects/${project.id}/status`, { method: "POST", body: JSON.stringify({ status: next }) });
      await loadProjects();
    } catch (cause) { setError(errorMessage(cause)); }
  }

  async function rename(project: ProjectSummary) {
    const name = window.prompt("새 프로젝트 이름", project.name)?.trim();
    if (!name || name === project.name) return;
    try {
      await apiFetch(`/api/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ name }) });
      await loadProjects();
    } catch (cause) { setError(errorMessage(cause)); }
  }

  const totalBytes = useMemo(() => projects.reduce((sum, project) => sum + project.storageBytes, 0), [projects]);
  if (loading || !user) return <main className="route-gate"><div className="route-gate-spinner"/><p>프로젝트를 준비하는 중입니다.</p></main>;

  return <div className="projects-view"><Header/><main className="projects-main"><header className="projects-hero"><div><span>WORKSPACE</span><h1>내 프로젝트</h1><p>GitHub 또는 ZIP에서 가져온 프로젝트는 서버 작업 공간에 한 번 저장되며 팀원과 같은 revision을 공유합니다.</p></div><div className="projects-metrics"><div><b>{projects.length}</b><span>{status.toLowerCase()} projects</span></div><div><b>{formatBytes(totalBytes)}</b><span>listed source size</span></div></div></header>
  <section className="project-create"><div className="create-tabs" role="tablist">{(["github","zip","empty"] as CreateMode[]).map(item=><button key={item} role="tab" aria-selected={mode===item} className={mode===item?"active":""} onClick={()=>setMode(item)}>{item==="github"?"GitHub 저장소":item==="zip"?"ZIP 업로드":"빈 프로젝트"}</button>)}</div>
  {mode==="github" && <form className="create-form" onSubmit={createGitHub}><div className="create-title"><h2>GitHub 프로젝트 가져오기</h2><p>공개 저장소는 토큰 없이, 비공개 저장소는 최소 읽기 권한 토큰으로 가져옵니다. 토큰은 저장하지 않습니다.</p></div><div className="create-grid"><label className="wide">저장소 URL<input type="url" placeholder="https://github.com/owner/repository" value={github.repositoryUrl} onChange={e=>setGithub({...github,repositoryUrl:e.target.value})} required/></label><label>브랜치 <small>선택</small><input placeholder="main" value={github.ref} onChange={e=>setGithub({...github,ref:e.target.value})}/></label><label>프로젝트 이름 <small>선택</small><input placeholder="저장소 이름 사용" value={github.name} onChange={e=>setGithub({...github,name:e.target.value})}/></label><label className="wide">GitHub 토큰 <small>비공개 저장소에만 사용 · 서버에 저장 안 함</small><input type="password" autoComplete="off" placeholder="github_pat_…" value={github.accessToken} onChange={e=>setGithub({...github,accessToken:e.target.value})}/></label></div><button className="create-primary" disabled={busy}>{busy?"가져오는 중…":"가져와서 에디터 열기"}</button></form>}
  {mode==="zip" && <div className="create-form"><div className="create-title"><h2>로컬 ZIP 가져오기</h2><p>ZIP은 서버에서 경로 이탈·심볼릭 링크·해제 폭탄·비밀 파일을 검사한 뒤 공동 작업 공간에 저장합니다.</p></div><label>프로젝트 이름 <small>선택</small><input value={zipName} onChange={e=>setZipName(e.target.value)} placeholder="ZIP 파일명 사용"/></label><button className="zip-drop" disabled={busy} onClick={()=>fileInput.current?.click()}><b>{busy?"검사 및 업로드 중…":"ZIP 파일 선택"}</b><span>업로드 64MiB · 해제 128MiB · 파일당 4MiB · 최대 2,500개</span></button><input ref={fileInput} hidden type="file" accept=".zip,application/zip" onChange={e=>void uploadZip(e.target.files?.[0])}/></div>}
  {mode==="empty" && <form className="create-form" onSubmit={createEmpty}><div className="create-title"><h2>빈 HTML 프로젝트</h2><p>GitHub 연결 없이 내부 버전과 ZIP 내보내기로 시작하고, 나중에 저장소를 연결할 수 있습니다.</p></div><label>프로젝트 이름<input value={emptyName} onChange={e=>setEmptyName(e.target.value)} maxLength={120} required/></label><button className="create-primary" disabled={busy}>{busy?"생성 중…":"프로젝트 생성"}</button></form>}
  </section>
  {error && <div className="projects-error" role="alert">{error}<button onClick={()=>setError("")}>닫기</button></div>}
  <section className="project-list-section"><div className="project-list-toolbar"><div className="status-tabs">{(["ACTIVE","ARCHIVED","DELETED"] as ProjectStatus[]).map(value=><button key={value} className={status===value?"active":""} onClick={()=>setStatus(value)}>{value==="ACTIVE"?"진행 중":value==="ARCHIVED"?"보관됨":"휴지통"}</button>)}</div><label className="project-search"><span>⌕</span><input type="search" placeholder="프로젝트 검색" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>
  {loadingProjects?<div className="project-empty">프로젝트 목록을 불러오는 중입니다.</div>:projects.length===0?<div className="project-empty"><b>표시할 프로젝트가 없습니다.</b><span>위에서 GitHub 저장소나 ZIP을 가져오세요.</span></div>:<div className="project-grid">{projects.map(project=><article key={project.id} className="project-card"><div className="project-card-top"><span className={`source-badge ${project.sourceType.toLowerCase()}`}>{project.sourceType}</span><span className="role-badge">{project.role}</span></div><Link className="project-card-link" href={`/editor?projectId=${project.id}`}><h2>{project.name}</h2><p>{project.repositoryUrl??"GitHub 미연결 내부 프로젝트"}</p></Link><dl><div><dt>Framework</dt><dd>{project.framework}</dd></div><div><dt>Revision</dt><dd>{project.currentRevision} <small>/ published {project.publishedRevision}</small></dd></div><div><dt>Files</dt><dd>{project.fileCount}</dd></div><div><dt>Storage</dt><dd>{formatBytes(project.storageBytes)}</dd></div></dl><footer><span>{new Date(project.updatedAt).toLocaleString("ko-KR")}</span><div>{project.role==="OWNER"&&<button onClick={()=>void rename(project)}>이름 변경</button>}{status==="ACTIVE"&&<button onClick={()=>void changeStatus(project,"ARCHIVED")}>보관</button>}{status!=="ACTIVE"&&<button onClick={()=>void changeStatus(project,"ACTIVE")}>복구</button>}{status!=="DELETED"&&<button className="danger" onClick={()=>void changeStatus(project,"DELETED")}>삭제</button>}</div></footer></article>)}</div>}
  </section></main></div>;
}

function formatBytes(value: number): string { if(value<1024)return `${value} B`;if(value<1024*1024)return `${(value/1024).toFixed(1)} KiB`;return `${(value/1024/1024).toFixed(1)} MiB`; }

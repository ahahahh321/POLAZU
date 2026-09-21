"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { ApiError, apiFetch, apiUrl, errorMessage } from "@/lib/api";
import type { Presence, ProjectComment, ProjectMember, RevisionSummary, VersionSummary, WorkspaceSnapshot } from "@/lib/types";

type Tab = "activity"|"versions"|"review"|"team"|"git";
type GitOperation = {id:string;operationType:string;status:string;sourceRevision:number;baseBranch:string;remoteBranch:string;commitSha:string|null;pullRequestUrl:string|null;errorCode:string|null;errorMessage:string|null;createdAt:string;updatedAt:string};

type Props = {
  projectId:string;
  snapshot:WorkspaceSnapshot;
  location:string;
  onReload:()=>Promise<void>;
  onRemoteRevision:(revision:number, summary:string)=>void;
  onPresence:(presence:Presence[])=>void;
};

export default function WorkspaceDock({projectId,snapshot,location,onReload,onRemoteRevision,onPresence}:Props){
  const {user}=useAuth();const router=useRouter();
  const [open,setOpen]=useState(false);const [tab,setTab]=useState<Tab>("activity");
  const [revisions,setRevisions]=useState<RevisionSummary[]>([]);const [versions,setVersions]=useState<VersionSummary[]>([]);const [comments,setComments]=useState<ProjectComment[]>([]);const [members,setMembers]=useState<ProjectMember[]>([]);const [operations,setOperations]=useState<GitOperation[]>([]);
  const [error,setError]=useState("");const [busy,setBusy]=useState(false);const [connection,setConnection]=useState<"connecting"|"online"|"offline">("connecting");
  const [comment,setComment]=useState("");const [memberEmail,setMemberEmail]=useState("");const [memberRole,setMemberRole]=useState("EDITOR");
  const [versionName,setVersionName]=useState("");const [token,setToken]=useState("");const [remoteStatus,setRemoteStatus]=useState<{remoteHeadCommit:string;remoteAdvanced:boolean}|null>(null);
  const [repository,setRepository]=useState({repositoryUrl:snapshot.project.repositoryUrl??"",defaultBranch:snapshot.project.defaultBranch??"main",baseCommit:snapshot.project.baseCommit??""});
  const [publish,setPublish]=useState({remoteBranch:`polazu/design-${new Date().toISOString().slice(0,10).replaceAll("-","")}`,commitMessage:"Apply POLAZU workspace changes",createPullRequest:true});
  const locationRef=useRef(location);const revisionRef=useRef(snapshot.revision);
  useEffect(()=>{locationRef.current=location;},[location]);
  useEffect(()=>{revisionRef.current=snapshot.revision;},[snapshot.revision]);

  const loadTab=useCallback(async(current:Tab)=>{
    try{
      if(current==="activity")setRevisions(await apiFetch(`/api/projects/${projectId}/workspace/revisions?limit=100`));
      if(current==="versions")setVersions(await apiFetch(`/api/projects/${projectId}/versions`));
      if(current==="review")setComments(await apiFetch(`/api/projects/${projectId}/comments?status=ALL`));
      if(current==="team")setMembers(await apiFetch(`/api/projects/${projectId}/members`));
      if(current==="git")setOperations(await apiFetch(`/api/projects/${projectId}/git/operations`));
    }catch(cause){setError(errorMessage(cause));}
  },[projectId]);
  useEffect(()=>{if(open)void loadTab(tab);},[loadTab,open,tab]);
  useEffect(() => {
    const validTabs: Tab[] = ["activity", "versions", "review", "team", "git"];
    const openWorkspace = (event: Event) => {
      const requested = (event as CustomEvent<{tab?: Tab}>).detail?.tab;
      const next = requested && validTabs.includes(requested) ? requested : "activity";
      setTab(next);
      setOpen(true);
      void loadTab(next);
    };
    window.addEventListener("polazu:workspace-open", openWorkspace);
    return () => window.removeEventListener("polazu:workspace-open", openWorkspace);
  }, [loadTab]);

  useEffect(()=>{
    const source=new EventSource(apiUrl(`/api/projects/${projectId}/workspace/events`),{withCredentials:true});
    source.addEventListener("connected",()=>setConnection("online"));
    source.addEventListener("presence",event=>{try{onPresence(JSON.parse((event as MessageEvent).data));}catch{}});
    source.addEventListener("revision",event=>{try{const data=JSON.parse((event as MessageEvent).data);if(data.authorUserId!==user?.id&&data.revision>revisionRef.current)onRemoteRevision(data.revision,data.summary);}catch{}});
    source.addEventListener("role-changed",()=>void onReload());
    source.addEventListener("access-revoked",()=>router.replace("/projects"));
    source.onerror=()=>setConnection("offline");
    const heartbeat=window.setInterval(()=>{void apiFetch(`/api/projects/${projectId}/workspace/presence`,{method:"POST",body:JSON.stringify({location:locationRef.current})}).catch(()=>setConnection("offline"));},30000);
    void apiFetch(`/api/projects/${projectId}/workspace/presence`,{method:"POST",body:JSON.stringify({location:locationRef.current})}).catch(()=>{});
    return()=>{source.close();window.clearInterval(heartbeat);};
  },[onPresence,onReload,onRemoteRevision,projectId,router,user?.id]);

  async function action(work:()=>Promise<void>){setBusy(true);setError("");try{await work();}catch(cause){setError(errorMessage(cause));}finally{setBusy(false);}}
  async function createVersion(event:FormEvent){event.preventDefault();await action(async()=>{await apiFetch(`/api/projects/${projectId}/versions`,{method:"POST",body:JSON.stringify({name:versionName,summary:`revision ${snapshot.revision} 수동 체크포인트`})});setVersionName("");await loadTab("versions");});}
  async function restore(version:VersionSummary){if(!confirm(`“${version.name}” 버전을 새 revision으로 복원할까요?`))return;await action(async()=>{await apiFetch(`/api/projects/${projectId}/versions/${version.id}/restore`,{method:"POST",body:JSON.stringify({baseRevision:snapshot.revision})});await onReload();await loadTab("versions");});}
  async function addComment(event:FormEvent){event.preventDefault();const body=comment.trim();if(!body)return;await action(async()=>{await apiFetch(`/api/projects/${projectId}/comments`,{method:"POST",body:JSON.stringify({body,filePath:location.startsWith("file:")?location.slice(5):null,selector:location.startsWith("canvas:")?location.slice(7):null})});setComment("");await loadTab("review");});}
  async function toggleComment(item:ProjectComment){await action(async()=>{await apiFetch(`/api/projects/${projectId}/comments/${item.id}`,{method:"PATCH",body:JSON.stringify({status:item.status==="OPEN"?"RESOLVED":"OPEN"})});await loadTab("review");});}
  async function addMember(event:FormEvent){event.preventDefault();await action(async()=>{await apiFetch(`/api/projects/${projectId}/members`,{method:"POST",body:JSON.stringify({email:memberEmail,role:memberRole})});setMemberEmail("");await loadTab("team");});}
  async function updateMember(member:ProjectMember,role:string){await action(async()=>{await apiFetch(`/api/projects/${projectId}/members/${member.userId}`,{method:"PATCH",body:JSON.stringify({role})});await loadTab("team");});}
  async function removeMember(member:ProjectMember){if(!confirm(`${member.name} 님을 프로젝트에서 제거할까요?`))return;await action(async()=>{await apiFetch(`/api/projects/${projectId}/members/${member.userId}`,{method:"DELETE"});await loadTab("team");});}
  async function connectRepository(event:FormEvent){event.preventDefault();await action(async()=>{await apiFetch(`/api/projects/${projectId}/repository`,{method:"POST",body:JSON.stringify(repository)});await onReload();});}
  async function checkRemote(){await action(async()=>{const result=await apiFetch<{remoteHeadCommit:string;remoteAdvanced:boolean}>(`/api/projects/${projectId}/git/remote/check`,{method:"POST",body:JSON.stringify({accessToken:token,branch:snapshot.project.defaultBranch})});setRemoteStatus(result);});}
  async function applyRemote(){if(!remoteStatus)return;if(!confirm("웹 미게시 변경은 내부 버전으로 보존하고, 확인한 원격 커밋을 새 revision으로 적용할까요?"))return;await action(async()=>{await apiFetch(`/api/projects/${projectId}/git/remote/apply`,{method:"POST",body:JSON.stringify({accessToken:token,branch:snapshot.project.defaultBranch,expectedCommit:remoteStatus.remoteHeadCommit,preserveUnpublishedAsVersion:true,clientMutationId:crypto.randomUUID()})});setRemoteStatus(null);await Promise.all([onReload(),loadTab("activity"),loadTab("versions")]);});}
  async function publishGit(event:FormEvent){event.preventDefault();await action(async()=>{const result=await apiFetch<{status:string;pullRequestUrl:string|null;errorMessage:string|null}>(`/api/projects/${projectId}/git/publish`,{method:"POST",body:JSON.stringify({accessToken:token,idempotencyKey:crypto.randomUUID(),sourceRevision:snapshot.revision,baseBranch:snapshot.project.defaultBranch,remoteBranch:publish.remoteBranch,commitMessage:publish.commitMessage,createPullRequest:publish.createPullRequest,pullRequestTitle:publish.commitMessage,pullRequestBody:`POLAZU revision ${snapshot.revision}\n\n게시 대상 revision은 고정되며 이후 웹 수정은 포함되지 않습니다.`})});if(result.status==="COMMIT_PUSHED_PR_FAILED")setError(result.errorMessage??"커밋과 push는 완료했지만 PR 생성은 실패했습니다.");setPublish(value=>({...value,remoteBranch:`polazu/design-${Date.now()}`}));await Promise.all([onReload(),loadTab("git")]);});}

  const unpublished=Math.max(0,snapshot.revision-snapshot.project.publishedRevision);
  const presenceText=useMemo(()=>snapshot.presence.map(item=>item.name).join(", "),[snapshot.presence]);
  return <><div className="workspace-dock"><div className="workspace-status"><span className={`connection-dot ${connection}`}/><b>r{snapshot.revision}</b><span>{unpublished} unpublished</span><span>{snapshot.project.role}</span><span title={presenceText}>{snapshot.presence.length} online</span></div><div className="workspace-dock-actions"><a href={apiUrl(`/api/projects/${projectId}/export.zip`)}>ZIP 내보내기</a><button onClick={()=>{setOpen(value=>!value);if(!open)void loadTab(tab);}}>공동 작업 · Git {open?"닫기":"열기"}</button></div></div>{open&&<aside className="workspace-drawer" aria-label="프로젝트 공동 작업 패널"><div className="workspace-drawer-tabs">{(["activity","versions","review","team","git"] as Tab[]).map(value=><button key={value} className={tab===value?"active":""} onClick={()=>setTab(value)}>{value==="activity"?"변경 이력":value==="versions"?"내부 버전":value==="review"?"검토":value==="team"?"팀":"Git"}</button>)}</div>{error&&<div className="workspace-error">{error}<button onClick={()=>setError("")}>×</button></div>}<div className="workspace-drawer-body">
  {tab==="activity"&&<section><h3>Revision 이력</h3><p className="dock-hint">서버에 저장된 파일 단위 변경입니다. 브라우저 캐시와 Git 커밋은 별도 상태입니다.</p>{revisions.map(item=><article className="dock-row" key={item.revision}><div><b>r{item.revision} · {item.summary}</b><span>{item.authorName} · {new Date(item.createdAt).toLocaleString("ko-KR")}</span></div><small>{item.changedPaths.join(", ")}</small></article>)}</section>}
  {tab==="versions"&&<section><h3>내부 버전</h3><form className="dock-inline-form" onSubmit={createVersion}><input placeholder="버전 이름" value={versionName} onChange={e=>setVersionName(e.target.value)} required/><button disabled={busy||snapshot.project.role==="VIEWER"}>현재 revision 저장</button></form><p className="dock-hint">GitHub 미연결 프로젝트도 사용할 수 있습니다. 복원은 기존 이력을 지우지 않고 새 revision으로 기록합니다.</p>{versions.map(item=><article className="dock-row" key={item.id}><div><b>{item.name} · r{item.sourceRevision}</b><span>{item.summary} · {formatBytes(item.sizeBytes)}</span></div><button disabled={busy||snapshot.project.role==="VIEWER"} onClick={()=>void restore(item)}>복원</button></article>)}</section>}
  {tab==="review"&&<section><h3>댓글 · 수정 요청</h3><form className="dock-comment-form" onSubmit={addComment}><textarea value={comment} onChange={e=>setComment(e.target.value)} placeholder={`현재 위치: ${location}`}/><button disabled={busy}>댓글 추가</button></form>{comments.map(item=><article className={`dock-comment ${item.status.toLowerCase()}`} key={item.id}><div><b>{item.authorName}</b><span>{item.filePath||item.selector||"프로젝트 전체"}</span></div><p>{item.body}</p><button onClick={()=>void toggleComment(item)}>{item.status==="OPEN"?"해결":"다시 열기"}</button></article>)}</section>}
  {tab==="team"&&<section><h3>프로젝트 멤버</h3>{snapshot.project.role==="OWNER"&&<form className="dock-inline-form" onSubmit={addMember}><input type="email" placeholder="team@example.com" value={memberEmail} onChange={e=>setMemberEmail(e.target.value)} required/><select value={memberRole} onChange={e=>setMemberRole(e.target.value)}><option>EDITOR</option><option>VIEWER</option></select><button disabled={busy}>초대</button></form>}{members.map(member=><article className="dock-row" key={member.userId}><div><b>{member.name} · @{member.nickname}</b><span>{member.email}</span></div>{snapshot.project.role==="OWNER"&&member.role!=="OWNER"?<div className="dock-member-actions"><select value={member.role} onChange={e=>void updateMember(member,e.target.value)}><option>EDITOR</option><option>VIEWER</option></select><button className="danger" onClick={()=>void removeMember(member)}>제거</button></div>:<small>{member.role}</small>}</article>)}</section>}
  {tab==="git"&&<section><h3>Git 버전 교환</h3>{!snapshot.project.repositoryUrl?<form className="dock-stack-form" onSubmit={connectRepository}><p className="dock-hint">ZIP 프로젝트에 기존 GitHub 저장소를 연결합니다. 원격 저장소를 임의로 만들지 않습니다.</p><input type="url" value={repository.repositoryUrl} onChange={e=>setRepository({...repository,repositoryUrl:e.target.value})} placeholder="https://github.com/owner/repository" required/><input value={repository.defaultBranch} onChange={e=>setRepository({...repository,defaultBranch:e.target.value})} placeholder="main"/><input value={repository.baseCommit} onChange={e=>setRepository({...repository,baseCommit:e.target.value})} placeholder="기준 commit SHA (권장)"/><button disabled={busy||snapshot.project.role!=="OWNER"}>저장소 연결</button></form>:<><div className="dock-repository"><b>{snapshot.project.repositoryUrl}</b><span>base {snapshot.project.defaultBranch} · {shortSha(snapshot.project.baseCommit)}</span></div><label className="dock-secret">GitHub 토큰 <small>이 요청에만 사용하며 저장하지 않음</small><input type="password" autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} placeholder="github_pat_…"/></label><button className="dock-secondary" disabled={busy||!token} onClick={()=>void checkRemote()}>원격 최신 커밋 확인</button>{remoteStatus&&<div className={remoteStatus.remoteAdvanced?"remote-warning":"remote-ok"}>{remoteStatus.remoteAdvanced?<><span>원격 기준 브랜치가 선행했습니다. 미게시 웹 변경을 내부 버전으로 보존한 뒤 적용할 수 있습니다.</span><button className="dock-secondary" disabled={busy||snapshot.project.role==="VIEWER"} onClick={()=>void applyRemote()}>원격 커밋 적용</button></>:<span>기준 커밋과 일치: {shortSha(remoteStatus.remoteHeadCommit)}</span>}</div>}<form className="dock-stack-form" onSubmit={publishGit}><label>새 원격 브랜치<input value={publish.remoteBranch} onChange={e=>setPublish({...publish,remoteBranch:e.target.value})} required/></label><label>커밋 메시지<input value={publish.commitMessage} onChange={e=>setPublish({...publish,commitMessage:e.target.value})} minLength={3} required/></label><label className="dock-check"><input type="checkbox" checked={publish.createPullRequest} onChange={e=>setPublish({...publish,createPullRequest:e.target.checked})}/> draft PR 생성</label><button disabled={busy||!token||unpublished===0||snapshot.project.role==="VIEWER"}>r{snapshot.revision} 고정 후 commit · push {publish.createPullRequest?"· PR":""}</button></form></>}{operations.map(item=><article className="dock-row" key={item.id}><div><b>{item.status} · r{item.sourceRevision}</b><span>{item.remoteBranch} · {shortSha(item.commitSha)}</span>{item.errorMessage&&<small>{item.errorMessage}</small>}</div>{item.pullRequestUrl&&<a href={item.pullRequestUrl} target="_blank" rel="noreferrer">PR 열기</a>}</article>)}</section>}
  </div></aside>}</>;
}

function shortSha(value:string|null|undefined){return value?value.slice(0,8):"not set";}function formatBytes(value:number){return value<1024?`${value} B`:value<1024*1024?`${(value/1024).toFixed(1)} KiB`:`${(value/1024/1024).toFixed(1)} MiB`;}

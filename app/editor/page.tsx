"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/header/Header";
import { useAuth } from "@/components/auth/AuthProvider";
import { ApiError, apiFetch, errorMessage } from "@/lib/api";
import type { ChangeResult, WorkspaceSnapshot } from "@/lib/types";
import BrowserProjectRuntime from "./_components/BrowserProjectRuntime";
import WorkspaceDock from "./_components/WorkspaceDock";
import type { FileChange, Project } from "./_lib/types";
import "./page.css";

type PendingChange={baseRevision:number;clientMutationId:string;summary:string;kind:"CODE"|"DESIGN"|"EDIT";changes:FileChange[]};

export default function EditorPage(){
  const {user,loading}=useAuth();const router=useRouter();
  const [projectId,setProjectId]=useState("");
  const [snapshot,setSnapshot]=useState<WorkspaceSnapshot|null>(null);const snapshotRef=useRef<WorkspaceSnapshot|null>(null);
  const [busy,setBusy]=useState(true);const [error,setError]=useState("");const [location,setLocation]=useState("workspace");
  const [remoteNotice,setRemoteNotice]=useState<{revision:number;summary:string}|null>(null);const [pending,setPending]=useState<PendingChange[]>([]);
  const saveQueue=useRef<Promise<unknown>>(Promise.resolve());
  snapshotRef.current=snapshot;

  useEffect(()=>{const params=new URLSearchParams(window.location.search);setProjectId(params.get("projectId")??"");},[]);
  useEffect(()=>{if(!loading&&!user)router.replace(`/login?next=${encodeURIComponent(window.location.pathname+window.location.search)}`);},[loading,router,user]);

  const loadSnapshot=useCallback(async()=>{
    if(!projectId)return;setBusy(true);setError("");
    try{const next=await apiFetch<WorkspaceSnapshot>(`/api/projects/${projectId}/workspace`);setSnapshot(next);setRemoteNotice(null);const stored=localStorage.getItem(`polazu-pending:${projectId}`);setPending(parsePending(stored));}
    catch(cause){setError(errorMessage(cause));}
    finally{setBusy(false);}
  },[projectId]);
  useEffect(()=>{if(user&&projectId)void loadSnapshot();else if(user&&!projectId)setBusy(false);},[loadSnapshot,projectId,user]);

  const queuePending=useCallback((entry:PendingChange)=>{setPending(current=>{const next=[...current,entry].slice(-50);localStorage.setItem(`polazu-pending:${projectId}`,JSON.stringify(next));return next;});},[projectId]);

  const saveWorkspace=useCallback((changes:FileChange[],summary:string,kind:"CODE"|"DESIGN"|"EDIT")=>{
    const operation=saveQueue.current.catch(()=>undefined).then(async()=>{
      const current=snapshotRef.current;if(!current)throw new Error("작업 공간을 먼저 불러와 주세요.");
      const entry:PendingChange={baseRevision:current.revision,clientMutationId:crypto.randomUUID(),summary,kind,changes:changes.map(change=>({...change,delete:change.delete===true}))};
      if(!navigator.onLine){queuePending(entry);throw new Error("오프라인 변경을 브라우저 복구 큐에 보관했습니다. 재접속 후 충돌을 확인하고 전송하세요.");}
      try{
        const result=await apiFetch<ChangeResult>(`/api/projects/${projectId}/workspace/changes?kind=${kind}`,{method:"POST",body:JSON.stringify(entry)});
        setSnapshot(previous=>{if(!previous)return previous;const next=applyResult(previous,result,changes);snapshotRef.current=next;return next;});return result.revision;
      }catch(cause){
        if(cause instanceof ApiError&&cause.code==="REVISION_CONFLICT"){const revision=Number(cause.details?.currentRevision??-1);setRemoteNotice({revision,summary:"다른 사용자의 저장이 먼저 반영되었습니다."});throw new Error(`revision 충돌: 서버는 r${revision}입니다. 최신 작업 공간을 확인한 뒤 변경을 다시 적용하세요.`);}
        if(cause instanceof ApiError&&cause.status<500)throw cause;
        queuePending(entry);const reason=errorMessage(cause);throw new Error(`${reason} 변경은 복구 큐에 보관했습니다.`);
      }
    });saveQueue.current=operation;return operation;
  },[projectId,queuePending]);

  const handleRemoteRevision=useCallback((revision:number,summary:string)=>setRemoteNotice({revision,summary}),[]);
  const handlePresence=useCallback((presence:WorkspaceSnapshot["presence"])=>setSnapshot(current=>current?{...current,presence}:current),[]);

  async function flushPending(){
    if(!snapshot||pending.length===0)return;setError("");
    const operation=saveQueue.current.catch(()=>undefined).then(async()=>{
      let revision=snapshotRef.current?.revision??snapshot.revision;const rest=[...pending];
      try{
        const queuedBase=rest[0]?.baseRevision;
        if(queuedBase!==revision)throw new Error(`복구 큐 기준 r${queuedBase}와 서버 r${revision}이 달라 자동 적용하지 않았습니다.`);
        while(rest.length){
          const entry=rest[0];
          // Offline edits are one ordered local chain. After the first item is
          // accepted, rebase only the next queued item onto that new revision.
          // A concurrent server write still produces a normal conflict.
          const payload={...entry,baseRevision:revision};
          const result=await apiFetch<ChangeResult>(`/api/projects/${projectId}/workspace/changes?kind=${entry.kind}`,{method:"POST",body:JSON.stringify(payload)});
          revision=result.revision;rest.shift();
          setSnapshot(previous=>{if(!previous)return previous;const next=applyResult(previous,result,entry.changes);snapshotRef.current=next;return next;});
          if(rest[0])rest[0]={...rest[0],baseRevision:revision};
        }
        localStorage.removeItem(`polazu-pending:${projectId}`);setPending([]);await loadSnapshot();
      }catch(cause){setError(errorMessage(cause));setPending(rest);localStorage.setItem(`polazu-pending:${projectId}`,JSON.stringify(rest));}
    });
    saveQueue.current=operation;await operation;
  }

  if(loading||busy)return <main className="route-gate"><div className="route-gate-spinner"/><p>서버 작업 공간을 불러오는 중입니다.</p></main>;
  if(!projectId)return <div className="editor-page-view"><Header activeNav="Editor"/><main className="editor-entry-container"><header className="editor-page-header"><span className="editor-page-eyebrow">POLAZU WEB STUDIO</span><h1 className="editor-page-title">PROJECT REQUIRED</h1><p className="editor-page-subtitle">프로젝트 목록에서 서버 작업 공간을 선택해 주세요.</p></header><section className="editor-import-card"><h2>공유 프로젝트 선택</h2><p className="editor-import-card-desc">GitHub 또는 ZIP 프로젝트는 프로젝트 화면에서 한 번 가져온 뒤 팀원이 같은 프로젝트를 엽니다.</p><Link className="editor-submit-btn" href="/projects">프로젝트 목록 열기</Link></section></main></div>;
  if(error&&!snapshot)return <div className="editor-page-view"><Header activeNav="Editor"/><main className="editor-entry-container"><div className="editor-alert-error">{error}</div><button className="editor-submit-btn" onClick={()=>void loadSnapshot()}>다시 시도</button> <Link href="/projects">프로젝트 목록</Link></main></div>;
  if(!snapshot)return null;

  const project:Project={id:projectId,source:{owner:snapshot.project.repositoryOwner??"POLAZU",repository:snapshot.project.name,ref:snapshot.branch,url:snapshot.project.repositoryUrl??"",baseCommit:snapshot.project.baseCommit},framework:snapshot.project.framework,files:snapshot.files,binaryFiles:snapshot.binaryFiles,skippedFileCount:snapshot.project.skippedFileCount,revision:snapshot.revision,publishedRevision:snapshot.project.publishedRevision,role:snapshot.project.role,presence:snapshot.presence};
  return <div className="editor-page-view editor-page-focus"><WorkspaceDock projectId={projectId} snapshot={snapshot} location={location} onReload={loadSnapshot} onRemoteRevision={handleRemoteRevision} onPresence={handlePresence}/>{remoteNotice&&<div className="editor-sync-banner editor-focus-banner"><span>새 서버 revision r{remoteNotice.revision}: {remoteNotice.summary}</span><button onClick={()=>void loadSnapshot()}>최신 작업 공간 열기</button></div>}{pending.length>0&&<details className="editor-recovery-notice"><summary>보관된 변경 {pending.length}건</summary><div><p>이전에 전송하지 못한 작업이 이 브라우저에 남아 있습니다. 현재 작업과 별도로 보관 중입니다.</p><button onClick={()=>void flushPending()}>저장 상태 확인 후 복구</button><button onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(pending,null,2)],{type:"application/json"}));const link=document.createElement("a");link.href=url;link.download="polazu-recovery-backup.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>백업 다운로드</button></div></details>}{error&&<div className="editor-alert-error editor-runtime-error">{error}<button onClick={()=>setError("")}>×</button></div>}<main className="editor-runtime-container"><BrowserProjectRuntime project={project} saveWorkspace={saveWorkspace} readOnly={snapshot.project.role==="VIEWER"} onLocationChange={setLocation}/></main></div>;
}

function parsePending(raw:string|null):PendingChange[]{if(!raw)return[];try{const value=JSON.parse(raw);return Array.isArray(value)?value.slice(-50):[];}catch{return[];}}

function applyResult(snapshot:WorkspaceSnapshot,result:ChangeResult,changes:FileChange[]):WorkspaceSnapshot{const files={...snapshot.files};const binaryFiles={...snapshot.binaryFiles};for(const change of changes){if(change.delete){delete files[change.path];delete binaryFiles[change.path];}else if(typeof change.content==="string"){files[change.path]=change.content;delete binaryFiles[change.path];}else if(change.binaryBase64){binaryFiles[change.path]=change.binaryBase64;delete files[change.path];}}return{...snapshot,revision:result.revision,files,binaryFiles,project:{...snapshot.project,currentRevision:result.revision}};}

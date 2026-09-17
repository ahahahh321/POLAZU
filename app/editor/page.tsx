"use client";
import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import BrowserProjectRuntime from "./_components/BrowserProjectRuntime";
import type { Project } from "./_lib/types";
import { demo } from "./_lib/demo";
import "./page.css";

export default function EditorPage() {
  const [url,setUrl]=useState("");
  const [branch,setBranch]=useState("");
  const [project,setProject]=useState<Project|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [showImport,setShowImport]=useState(true);
  const input=useRef<HTMLInputElement>(null);
  async function load(event: FormEvent) {
    event.preventDefault();setBusy(true);setError("");
    try {
      const response=await fetch((process.env.NEXT_PUBLIC_API_BASE_URL??"http://127.0.0.1:8080")+"/api/editor/import/github",{
        method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({repositoryUrl:url,ref:branch||null}),signal:AbortSignal.timeout(45000)
      });
      const result=await response.json();
      if(!response.ok)throw new Error(result.message||"가져오기 실패");
      setProject(result);setShowImport(false);
    }catch(e){setError(e instanceof Error?e.message:"가져오기 실패");}finally{setBusy(false);}
  }
  async function local(files: FileList|null) {
    if(!files)return;setError("");setBusy(true);
    try{
      const text:Record<string,string>={},binary:Record<string,string>={};let size=0,skipped=0,count=0;
      const projectName=files[0]?.webkitRelativePath.split("/")[0]||"Local project";
      for(const file of Array.from(files)){
        const path="/"+file.webkitRelativePath.split("/").slice(1).join("/");
        const parts=path.split("/").filter(Boolean);
        if(parts.some(p=>p.startsWith(".")||["node_modules","dist","build","out","coverage","target"].includes(p)) || /(?:credential|private-key|service-account|id_rsa|\.pem$|\.key$)/i.test(path)){skipped++;continue;}
        if(!/\.(?:[cm]?[jt]sx?|json|html|css|s[ac]ss|less|vue|svelte|astro|mdx?|svg|txt|ya?ml|png|jpe?g|gif|webp|ico|woff2?|ttf)$/i.test(path)){skipped++;continue;}
        size+=file.size;if(size>20*1024*1024||file.size>4*1024*1024||++count>1000)throw new Error("폴더 제한: 총 20MB, 파일당 4MB, 1,000개입니다.");
        if(/\.(png|jpe?g|gif|webp|ico|woff2?|ttf)$/i.test(path)){
          const bytes=new Uint8Array(await file.arrayBuffer());let raw="";for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));binary[path]=btoa(raw);
        }else text[path]=(await file.text()).replace(/^\uFEFF/,"");
      }
      setProject({source:{owner:"Local",repository:projectName,ref:"local",url:""},framework:"AUTO",files:text,binaryFiles:binary,skippedFileCount:skipped});setShowImport(false);
    }catch(e){setError(e instanceof Error?e.message:"폴더 읽기 실패");}finally{setBusy(false);if(input.current)input.current.value="";}
  }
  return <main className="polazu-editor">
    <header className="editor-topbar">
      <Link href="/" className="editor-brand"><span>p.</span>POLAZU <small>studio</small></Link>
      <div className="editor-breadcrumb">Workspace <span>/</span> <strong>{project?.source.repository??"새 프로젝트"}</strong>{project&&<small>{project.source.ref}</small>}</div>
      <button onClick={()=>setShowImport(!showImport)}>＋ 프로젝트 열기</button>
    </header>
    {(showImport||!project)&&<section className="editor-import-panel">
      <div><p className="editor-kicker">YOUR CODE. YOUR CANVAS.</p><h1>코드를 가져와, 화면에서 디자인하세요.</h1><p>GitHub 또는 로컬 폴더에서 시작하세요. 실행 가능한 앱 폴더를 자동으로 찾습니다.</p></div>
      <form onSubmit={load}><label>공개 GitHub 저장소<input type="url" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://github.com/owner/repository" required/></label><label className="editor-branch">브랜치<input value={branch} onChange={e=>setBranch(e.target.value)} placeholder="기본 브랜치"/></label><button className="studio-primary" disabled={busy}>{busy?"가져오는 중…":"프로젝트 불러오기"}</button></form>
      <div className="editor-import-actions"><button disabled={busy} onClick={()=>input.current?.click()}>▱ 로컬 폴더 열기</button><button disabled={busy} onClick={()=>{setProject(demo);setShowImport(false);setError("");}}>◇ 데모로 시작하기</button><span>로컬 폴더는 브라우저에서 읽습니다. 비밀 파일은 제외됩니다.</span></div>
      <input ref={input} type="file" {...({webkitdirectory:"",directory:""} as Record<string,string>)} multiple hidden onChange={e=>void local(e.target.files)}/>
      {error&&<p role="alert" className="editor-error">{error}</p>}
    </section>}
    {project?<BrowserProjectRuntime key={JSON.stringify(project.source)+Object.keys(project.files).length} project={project}/>:<section className="editor-welcome"><div className="editor-welcome-art"><i/><i/><i/><b>↖</b></div><h2>아이디어에 형태를 더하세요.</h2><p>레이어를 선택하고, 디자인을 다듬고, Preview에서 동작을 확인하세요.</p><div><span>01 프로젝트 열기</span><span>02 디자인 편집</span><span>03 변경 내보내기</span></div></section>}
  </main>;
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { detectRoots, planProject } from "../_lib/adapters";
import { startRuntime } from "../_lib/runtime";
import type { Edit, Layer, MockRule, Project, Selection, Stage } from "../_lib/types";

const stageLabels: Record<Stage,string> = {idle:"준비",boot:"환경 준비",install:"패키지 설치",start:"서버 시작",loading:"화면 확인",ready:"편집 가능",error:"실행 확인 필요"};
export default function BrowserProjectRuntime({ project }: { project: Project }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const documentId = useRef("");
  const failed = useRef(false);
  const [nextUI,setNextUI] = useState(true);
  const roots = useMemo(()=>detectRoots(project.files),[project.files]);
  const [root,setRoot] = useState(roots[0] ?? "");
  const [attempt,setAttempt] = useState(0);
  const [stage,setStage] = useState<Stage>("idle");
  const [status,setStatus] = useState("");
  const [logs,setLogs] = useState("");
  const [baseUrl,setBaseUrl] = useState("");
  const [frameUrl,setFrameUrl] = useState("");
  const [path,setPath] = useState("/");
  const [pathInput,setPathInput] = useState("/");
  const [mode,setMode] = useState<"edit"|"preview">("edit");
  const [selected,setSelected] = useState<Selection|null>(null);
  const [layers,setLayers] = useState<Layer[]>([]);
  const [leftTab,setLeftTab] = useState("layers");
  const [rightTab,setRightTab] = useState("design");
  const [width,setWidth] = useState(1100);
  const [zoom,setZoom] = useState(75);
  const [showLogs,setShowLogs] = useState(false);
  const [history,setHistory] = useState<Edit[][]>([[]]);
  const [cursor,setCursor] = useState(0);
  const [text,setText] = useState("");
  const [draft,setDraft] = useState<Record<string,string>>({});
  const [rules,setRules] = useState<MockRule[]>([{method:"GET",url:"/api/example",status:200,body:{message:"샘플 응답"}}]);
  const [mockText,setMockText] = useState(JSON.stringify(rules,null,2));
  const [requests,setRequests] = useState<string[]>([]);
  const [notice,setNotice] = useState("");
  const token = useMemo(()=>crypto.randomUUID(),[project,root,attempt]);
  const edits = history[cursor] ?? [];
  const stateRef = useRef({mode,rules,edits});
  stateRef.current = {mode,rules,edits};
  const plan = useMemo(()=>{try{return planProject(project.files,root);}catch{return null;}},[project.files,root]);
  const isNext=plan?.name.startsWith("Next.js");
  const key = "polazu-edits:"+project.source.url+":"+project.source.ref+":"+project.source.repository+":"+root;
  const download = (name: string, data: string, type="application/json") => {
    const url=URL.createObjectURL(new Blob([data],{type}));const link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  function send(type: string, payload: Record<string,unknown>={}) {
    if(!frame.current?.contentWindow || !baseUrl || !documentId.current)return;
    frame.current.contentWindow.postMessage({source:"polazu-editor",token,type,...payload},new URL(baseUrl).origin);
  }
  function sync() { send("sync",stateRef.current); }

  useEffect(()=>{
    failed.current=false;documentId.current="";
    setHistory([[]]);
    try { const saved=localStorage.getItem(key);if(saved){const value=JSON.parse(saved);if(Array.isArray(value))setHistory([value]);} } catch{}
    setCursor(0);
  },[key]);
  useEffect(()=>{
    setBaseUrl("");setFrameUrl("");setLayers([]);setSelected(null);setLogs("");setStage("boot");setPath("/");setPathInput("/");
    return startRuntime(project,root,token,{
      stage:(s,m)=>{setStage(s);setStatus(m);if(s==="error"){failed.current=true;setShowLogs(true);}},
      log:line=>setLogs(prev=>(prev+line).slice(-60000)),
      url:url=>{setBaseUrl(url);setFrameUrl(url);}
    },!!isNext && nextUI);
  },[project,root,attempt,token,isNext,nextUI]);
  useEffect(()=>{
    if(["ready","error","idle"].includes(stage))return;
    const ms=stage==="install"?310000:stage==="boot"?50000:120000;
    const timer=setTimeout(()=>{setStage("error");setShowLogs(true);setStatus("이 단계에서 응답이 지연되고 있습니다. 실행 로그를 확인하거나 다시 실행하세요.");},ms);
    return()=>clearTimeout(timer);
  },[stage,frameUrl]);
  useEffect(()=>{
    function receive(event: MessageEvent) {
      if(!baseUrl || event.source!==frame.current?.contentWindow || event.origin!==new URL(baseUrl).origin)return;
      const data=event.data;
      if(!data || data.source!=="polazu-preview" || data.token!==token)return;
      if(data.type==="ready") {
        if(typeof data.path==="string"){setPath(data.path);setPathInput(data.path);}
        if(Array.isArray(data.layers))setLayers(data.layers.slice(0,250));
        if(data.hasContent && !failed.current){setStage("ready");setStatus("화면 연결됨");}else if(!failed.current){setStatus("서버가 빈 HTML을 반환했습니다. 실행 로그를 확인하세요.");}
        if(documentId.current!==data.documentId){documentId.current=data.documentId;sync();}
      }
      if(data.type==="selected" && data.element && typeof data.element.selector==="string" && typeof data.element.text==="string") {
        setSelected(data.element);setText(data.element.text);setDraft(data.element.styles ?? {});setRightTab("design");
      }
      if(data.type==="runtime-error"){failed.current=true;setStage("error");setStatus(String(data.message));setNotice(String(data.message));setLogs(p=>(p+"\n[브라우저] "+String(data.message)).slice(-60000));setShowLogs(true);}
      if(data.type==="notice")setNotice(String(data.message));
      if(data.type==="request")setRequests(p=>[data.method+" "+data.url+(data.matched?" · Mock":" · 응답 미설정"),...p].slice(0,25));
    }
    window.addEventListener("message",receive);return()=>window.removeEventListener("message",receive);
  // sync reads current edits through stateRef, avoiding stale navigation closures.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[baseUrl,token]);
  useEffect(()=>{sync();},[mode,rules,edits,baseUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  function navigate(value: string) {
    if(!baseUrl)return;
    if(!value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)){setNotice("프로젝트 내부 경로만 입력하세요. 예: /about");return;}
    const url=new URL(value,baseUrl);if(url.origin!==new URL(baseUrl).origin)return;
    failed.current=false;
    setStage("loading");setStatus("페이지 로딩 중");setSelected(null);setFrameUrl(url.href);setPathInput(value);
  }
  function addEdit(partial: Omit<Edit,"path"|"selector">) {
    if(!selected)return;
    const next=[...edits,{path,selector:selected.selector,...partial}];
    setHistory([...history.slice(0,cursor+1),next]);setCursor(cursor+1);
    setNotice("미리보기 변경 적용 · 원본 소스는 유지됩니다.");
  }
  function save() {
    try{localStorage.setItem(key,JSON.stringify(edits));setNotice("이 브라우저에 수정 내역을 저장했습니다.");}catch{setNotice("브라우저 저장 공간에 저장하지 못했습니다.");}
  }
  function mocks() {
    try{
      const value:unknown=JSON.parse(mockText);
      if(!Array.isArray(value) || value.length>50 || mockText.length>100000)throw Error();
      for(const r of value)if(!r || !["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"].includes(r.method) || typeof r.url!=="string" || !r.url.startsWith("/") || r.url.startsWith("//") || !Number.isInteger(r.status) || r.status<200 || r.status>599)throw Error();
      setRules(value);setNotice("Mock 적용 완료. 이미 호출된 요청은 Preview에서 다시 실행하세요.");
    }catch{setNotice("Mock은 method, /경로, status(200~599), body 배열로 작성하세요.");}
  }
  const numberField=(label:string,property:string)=><label className="studio-field" key={property}><span>{label}</span><input value={draft[property]??""} onChange={e=>setDraft({...draft,[property]:e.target.value})} placeholder="예: 16px"/></label>;
  return <div className="studio">
    <div className="studio-toolbar">
      <div className="studio-modes" role="group" aria-label="편집 모드"><button className={mode==="edit"?"active":""} onClick={()=>setMode("edit")}>↖ Design</button><button className={mode==="preview"?"active":""} onClick={()=>setMode("preview")}>▷ Preview</button></div>
      <div className="studio-history"><button title="실행 취소" aria-label="실행 취소" disabled={!cursor} onClick={()=>setCursor(cursor-1)}>↶</button><button title="다시 실행" aria-label="다시 실행" disabled={cursor===history.length-1} onClick={()=>setCursor(cursor+1)}>↷</button></div>
      <form className="studio-path" onSubmit={e=>{e.preventDefault();navigate(pathInput);}}><span>⌘</span><input aria-label="페이지 경로" value={pathInput} onChange={e=>setPathInput(e.target.value)}/><button disabled={!baseUrl}>↵</button></form>
      <select aria-label="화면 크기" value={width} onChange={e=>setWidth(Number(e.target.value))}><option value={1100}>Desktop · 1100</option><option value={768}>Tablet · 768</option><option value={390}>Mobile · 390</option></select>
      <select aria-label="확대 비율" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[40,50,60,75,90,100,125].map(n=><option key={n} value={n}>{n}%</option>)}</select>
      <button onClick={save}>저장</button><button className="studio-primary" onClick={()=>download("polazu-edits.json",JSON.stringify({version:1,source:project.source,edits,rules},null,2))}>변경 내보내기 ↗</button>
    </div>
    <div className="studio-body">
      <aside className="studio-left">
        <div className="studio-tabs">{[["layers","레이어"],["pages","페이지"],["files","파일"]].map(([id,label])=><button key={id} className={leftTab===id?"active":""} onClick={()=>setLeftTab(id)}>{label}</button>)}</div>
        <div className="studio-panel-title">PROJECT <span>{isNext&&nextUI?"Next.js · UI":plan?.name??"프로젝트"}</span></div>
        <label className="studio-root">앱 폴더<select value={root} onChange={e=>setRoot(e.target.value)}>{roots.map(r=><option key={r} value={r}>{r||"/ (루트)"}</option>)}</select></label>
        {plan?.notes.map(note=><p className="studio-hint" key={note}>{note}</p>)}
        {isNext && <label className="studio-root">Next 실행 방식<select value={nextUI?"ui":"server"} onChange={e=>{setNextUI(e.target.value==="ui");setAttempt(x=>x+1);}}><option value="ui">클라이언트 UI 호환 모드</option><option value="server">원본 Next 서버 · 실험적</option></select><p className="studio-hint">UI 모드는 SSR·서버 API·Server Actions를 실행하지 않습니다.</p></label>}
        <div className="studio-tree">
          {leftTab==="layers" && (layers.length?layers.map(l=><button key={l.selector} className={selected?.selector===l.selector?"selected":""} style={{paddingLeft:12+Math.min(l.depth,6)*10}} onClick={()=>send("select",{selector:l.selector})}><span className="studio-node-icon">{/^h\d$|p|span/.test(l.tag)?"T":"◇"}</span><span>{l.label||l.tag}</span></button>):<p className="studio-hint">화면이 로드되면 레이어가 표시됩니다.</p>)}
          {leftTab==="pages" && (plan?.routes??["/"]).map(p=><button key={p} className={p===path?"selected":""} onClick={()=>navigate(p)}>▤ {p}</button>)}
          {leftTab==="files" && Object.keys(project.files).sort().map(p=><div className="studio-file" key={p} title={p}>⌑ {p}</div>)}
        </div>
        <div className="studio-left-footer">{Object.keys(project.files).length} files · {project.skippedFileCount} excluded</div>
      </aside>
      <section className="studio-center" aria-label="디자인 캔버스">
        <div className="studio-canvas-caption"><span>{mode==="edit"?"DESIGN CANVAS":"INTERACTIVE PREVIEW"}</span><span>{width} × 760</span></div>
        <div className="studio-canvas-scroll">
          <div className="studio-artboard-wrap" style={{width:width*zoom/100,height:760*zoom/100}}>
            <div className="studio-artboard" style={{width,height:760,zoom:zoom/100}}>
              {frameUrl && <iframe ref={frame} src={frameUrl} title="프로젝트 미리보기" allow="cross-origin-isolated" sandbox="allow-scripts allow-same-origin allow-forms"/>}
            </div>
          </div>
          {stage!=="ready" && <div className="studio-loading-card" role="status">
            <span className={stage==="error"?"studio-error-icon":"studio-spinner"}>{stage==="error"?"!":""}</span>
            <h2>{stageLabels[stage]}</h2><p>{status}</p>
            <div className="studio-progress">{["boot","install","start","loading","ready"].map((s,i)=><span key={s} className={["boot","install","start","loading","ready"].indexOf(stage)>=i?"done":""}/>)}</div>
            <button onClick={()=>setShowLogs(true)}>실행 로그 보기</button>{stage==="error" && <button onClick={()=>setAttempt(x=>x+1)}>다시 실행</button>}
          </div>}
        </div>
        <div className="studio-bottom"><span className={stage==="ready"?"online":""}>● {stageLabels[stage]}</span><span>{notice|| (mode==="edit"?"요소를 클릭하여 선택하세요.":"버튼과 링크가 실제로 동작합니다.")}</span><button onClick={()=>setShowLogs(!showLogs)}>⌘ 로그 {showLogs?"닫기":"열기"}</button><button onClick={()=>setAttempt(x=>x+1)}>↻</button></div>
        {showLogs && <div className="studio-console"><div><strong>실행 로그</strong><button onClick={()=>download("polazu-runtime.log",logs,"text/plain")}>다운로드</button></div><pre>{logs||"실행 환경을 준비하고 있습니다."}</pre></div>}
      </section>
      <aside className="studio-right">
        <div className="studio-tabs">{[["design","디자인"],["mock","API Mock"]].map(([id,label])=><button key={id} className={rightTab===id?"active":""} onClick={()=>setRightTab(id)}>{label}</button>)}</div>
        {rightTab==="design" ? selected ? <>
          <section><div className="studio-panel-title">SELECTION <span>{selected.tag}</span></div><h3>{selected.label}</h3><p className="studio-hint">{selected.width} × {selected.height}</p></section>
          <section><h4>텍스트</h4>{selected.editableText?<textarea aria-label="선택한 요소 텍스트" rows={3} value={text} onChange={e=>setText(e.target.value)}/>:<p className="studio-hint">자식 요소가 있는 컨테이너입니다. 텍스트 레이어를 선택하세요.</p>}<div className="studio-field-grid">{numberField("크기","fontSize")}{numberField("굵기","fontWeight")}{numberField("행간","lineHeight")}{numberField("투명도","opacity")}</div></section>
          <section><h4>색상</h4>{[["글자","color"],["배경","backgroundColor"]].map(([label,p])=><label className="studio-color" key={p}><span style={{background:draft[p]}}/><input aria-label={label+" 색상"} value={draft[p]??""} onChange={e=>setDraft({...draft,[p]:e.target.value})}/></label>)}</section>
          <section><h4>레이아웃</h4><div className="studio-field-grid">{numberField("너비","width")}{numberField("높이","height")}{numberField("안쪽 여백","padding")}{numberField("바깥 여백","margin")}{numberField("둥글기","borderRadius")}{numberField("간격","gap")}</div></section>
          <section><button className="studio-primary studio-full" onClick={()=>addEdit({...(selected.editableText?{text}:{}),styles:Object.fromEntries(Object.entries(draft).filter(([k,v])=>v!==selected.styles[k]))})}>디자인 적용</button>{selected.tag==="button" && <div className="studio-state-buttons">{[["default","기본"],["disabled","비활성"],["loading","로딩"]].map(([s,l])=><button key={s} onClick={()=>addEdit({state:s})}>{l}</button>)}</div>}</section>
        </>:<div className="studio-inspector-empty"><div>↖</div><h3>디자인을 선택하세요</h3><p>캔버스의 요소 또는 왼쪽 레이어를 클릭하면 속성이 표시됩니다.</p><span>텍스트 · 색상 · 크기 · 여백</span></div>
        :<section><h4>클라이언트 API 응답</h4><p className="studio-hint">fetch / XHR 요청용 샘플 JSON입니다. 서버 측 API 호출은 포함하지 않습니다.</p><textarea aria-label="API Mock JSON" className="studio-json" rows={18} value={mockText} onChange={e=>setMockText(e.target.value)} spellCheck={false}/><button className="studio-primary studio-full" onClick={mocks}>Mock 적용</button><h4>요청 기록</h4>{requests.map((r,i)=><p className="studio-request" key={i}>{r}</p>)}</section>}
        <div className="studio-edit-count">{edits.length} changes · 미리보기 수정 내역</div>
      </aside>
    </div>
  </div>;
}

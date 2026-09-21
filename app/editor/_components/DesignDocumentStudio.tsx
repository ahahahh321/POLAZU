"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { apiFetch, errorMessage } from "@/lib/api";
import type { ChangeResult, WorkspaceSnapshot } from "@/lib/types";
import { addDesignNode, addDesignPreset, compileDesignDocument, createDesignDocument, removeDesignNode, updateDesignNode, type DesignDocument, type DesignLayout, type DesignNode, type DesignNodeKind, type DesignPreset } from "../_lib/design-document";

const STORAGE_KEY="polazu-design-document:v1";
const kinds:DesignNodeKind[]=["frame","stack","text","rectangle","image","button","input"];

export default function DesignDocumentStudio(){
  const [document,setDocument]=useState<DesignDocument|null>(null);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [mode,setMode]=useState<"design"|"preview">("design");
  const [zoom,setZoom]=useState(70);
  const [notice,setNotice]=useState("디자인 문서 준비 중");
  const [history,setHistory]=useState<DesignDocument[]>([]);
  const [future,setFuture]=useState<DesignDocument[]>([]);
  const [projectId,setProjectId]=useState("");
  const [framework,setFramework]=useState("");
  const revision=useRef(0);
  const drag=useRef<{id:string;startX:number;startY:number;x:number;y:number}|null>(null);

  useEffect(()=>{void (async()=>{const id=new URLSearchParams(location.search).get("projectId")??"";setProjectId(id);try{let raw=localStorage.getItem(id?`${STORAGE_KEY}:${id}`:STORAGE_KEY);if(id){const snapshot=await apiFetch<WorkspaceSnapshot>(`/api/projects/${id}/workspace`);revision.current=snapshot.revision;setFramework(snapshot.project.framework??"");raw=snapshot.files["/.polazu/design-document.json"]??raw;}const next=raw?JSON.parse(raw):createDesignDocument("POLAZU page");setDocument(next);setSelectedId(next.pages[0]?.rootIds[0]??null);setNotice(raw?"저장된 디자인 문서를 복원했습니다.":"새 디자인 문서를 만들었습니다.");}catch(error){const next=createDesignDocument("POLAZU page");setDocument(next);setSelectedId(next.pages[0].rootIds[0]);setNotice(errorMessage(error));}})();},[]);
  useEffect(()=>{if(!document)return;const timer=window.setTimeout(()=>{localStorage.setItem(projectId?`${STORAGE_KEY}:${projectId}`:STORAGE_KEY,JSON.stringify(document));setNotice("디자인 문서 자동 저장됨");},500);return()=>clearTimeout(timer);},[document,projectId]);
  const selected=document&&selectedId?document.nodes[selectedId]:null;
  const output=useMemo(()=>document?compileDesignDocument(document):{tsx:"",css:"",html:""},[document]);

  async function saveProject(){
    if(!document)return;if(!projectId){localStorage.setItem(STORAGE_KEY,JSON.stringify(document));setNotice("브라우저에 저장했습니다. 프로젝트에서 열면 실제 코드로 저장할 수 있습니다.");return;}
    setNotice("프로젝트 디자인 저장 중…");
    try{const isReact=/react|next/i.test(framework);const runtimeFiles=isReact?[{path:"/app/page.tsx",content:output.tsx,delete:false},{path:"/app/generated.css",content:output.css,delete:false}]:[{path:"/index.html",content:output.html,delete:false},{path:"/styles.css",content:output.css,delete:false}];const body={baseRevision:revision.current,clientMutationId:crypto.randomUUID(),summary:"페이지 디자인 저장",changes:[{path:"/.polazu/design-document.json",content:JSON.stringify(document,null,2),delete:false},...runtimeFiles]};const result=await apiFetch<ChangeResult>(`/api/projects/${projectId}/workspace/changes?kind=DESIGN`,{method:"POST",body:JSON.stringify(body)});revision.current=result.revision;setNotice(`프로젝트에 저장됨 · r${result.revision}`);}catch(error){setNotice(errorMessage(error));}
  }

  function mutate(next:DesignDocument){if(!document)return;setHistory(items=>[...items,document].slice(-80));setFuture([]);setDocument(next);}
  function patch(changes:Partial<DesignNode>){if(document&&selected)mutate(updateDesignNode(document,selected.id,changes));}
  function patchStyle(key:keyof DesignNode["style"],value:string|number|undefined){if(selected)patch({style:{...selected.style,[key]:value}});}
  function insert(kind:DesignNodeKind){if(!document)return;const parent=selected&&(selected.kind==="frame"||selected.kind==="stack")?selected.id:null;const next=addDesignNode(document,parent,kind,parent?0:760,parent?0:260);const created=Object.keys(next.nodes).find(id=>!document.nodes[id])??null;mutate(next);setSelectedId(created);setNotice(parent?"선택한 컨테이너에 추가했습니다.":"무한 캔버스에 추가했습니다.");}
  function insertPreset(preset:DesignPreset){if(!document)return;const root=selected&&(selected.kind==="frame"||selected.kind==="stack")?selected:document.nodes[page.rootIds[0]];if(!root)return;mutate(addDesignPreset(document,root.id,preset));setSelectedId(root.id);setNotice(`${preset} 섹션을 페이지에 추가했습니다.`);}
  function undo(){if(!history.length||!document)return;const previous=history.at(-1)!;setHistory(items=>items.slice(0,-1));setFuture(items=>[document,...items]);setDocument(previous);}
  function redo(){if(!future.length||!document)return;const next=future[0];setFuture(items=>items.slice(1));setHistory(items=>[...items,document]);setDocument(next);}
  function pointerDown(event:PointerEvent,id:string){if(mode!=="design"||!document)return;const node=document.nodes[id];setSelectedId(id);event.stopPropagation();if(node.parentId||node.locked)return;event.currentTarget.setPointerCapture(event.pointerId);drag.current={id,startX:event.clientX,startY:event.clientY,x:node.x,y:node.y};}
  function pointerMove(event:PointerEvent){const current=drag.current;if(!current||!document)return;setDocument(updateDesignNode(document,current.id,{x:Math.round(current.x+(event.clientX-current.startX)/(zoom/100)),y:Math.round(current.y+(event.clientY-current.startY)/(zoom/100))}));}
  function pointerUp(){if(drag.current&&document)setHistory(items=>[...items,document].slice(-80));drag.current=null;}
  if(!document)return <main className="design-doc-loading">디자인 스튜디오를 준비하고 있습니다.</main>;
  const page=document.pages.find(item=>item.id===document.activePageId)!;
  return <section className="design-doc-studio">
    <header className="design-doc-topbar"><strong>POLAZU DESIGN</strong><div className="design-doc-modes"><button className={mode==="design"?"active":""} onClick={()=>setMode("design")}>편집</button><button className={mode==="preview"?"active":""} onClick={()=>setMode("preview")}>미리보기</button></div><button disabled={!history.length} onClick={undo}>↶</button><button disabled={!future.length} onClick={redo}>↷</button><span className="spacer"/><span>{notice}</span><button className="primary" onClick={()=>void saveProject()}>저장</button></header>
    <div className="design-doc-layout">
      <aside className="design-doc-left"><h2>페이지 구조</h2><div className="design-doc-layer-tree">{page.rootIds.map(id=><LayerTree key={id} id={id} document={document} selectedId={selectedId} select={setSelectedId}/>)}</div><h2>빠른 섹션</h2><div className="design-doc-presets">{(["navbar","hero","features","cta","footer"] as DesignPreset[]).map(preset=><button key={preset} onClick={()=>insertPreset(preset)}><i>{presetIcon(preset)}</i><span>{presetLabel(preset)}</span></button>)}</div><h2>요소</h2><div className="design-doc-insert">{kinds.map(kind=><button key={kind} onClick={()=>insert(kind)}><i>{kindIcon(kind)}</i><span>{kindLabel(kind)}</span></button>)}</div></aside>
      <main className="design-doc-canvas" onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onPointerDown={()=>setSelectedId(null)}>
        <div className={`design-doc-plane ${mode==="preview"?"preview":""}`} style={{"--doc-zoom":zoom/100} as CSSProperties}>{page.rootIds.map(id=><CanvasNode key={id} id={id} document={document} selectedId={selectedId} mode={mode} pointerDown={pointerDown}/>)}</div>
        <div className="design-doc-zoom"><button onClick={()=>setZoom(value=>Math.max(20,value-10))}>−</button><button onClick={()=>setZoom(100)}>{zoom}%</button><button onClick={()=>setZoom(value=>Math.min(200,value+10))}>＋</button></div>
      </main>
      <aside className="design-doc-right">{selected?<NodeInspector node={selected} patch={patch} patchStyle={patchStyle} remove={()=>{mutate(removeDesignNode(document,selected.id));setSelectedId(null);}}/>:<div className="design-doc-empty"><strong>레이어를 선택하세요</strong><p>프레임과 요소를 선택하면 위치, 레이아웃, 색상과 타이포그래피를 수정할 수 있습니다.</p></div>}</aside>
    </div>
  </section>;
}

function CanvasNode({id,document,selectedId,mode,pointerDown}:{id:string;document:DesignDocument;selectedId:string|null;mode:string;pointerDown:(event:PointerEvent,id:string)=>void}){
  const node=document.nodes[id];if(!node||node.hidden)return null;const style=nodeStyle(node,node.parentId===null);const content=node.childIds.map(child=><CanvasNode key={child} id={child} document={document} selectedId={selectedId} mode={mode} pointerDown={pointerDown}/>);
  const props={className:`design-doc-node kind-${node.kind}${selectedId===id&&mode==="design"?" selected":""}`,style,onPointerDown:(event:PointerEvent)=>pointerDown(event,id),"data-name":node.name};
  if(node.kind==="text")return <p {...props}>{node.text}</p>;
  if(node.kind==="button")return <button {...props} type="button">{node.text}</button>;
  if(node.kind==="input")return <input {...props} placeholder={node.text} readOnly/>;
  if(node.kind==="image")return <div {...props}><span>Image</span></div>;
  return <div {...props}>{content}</div>;
}
function nodeStyle(node:DesignNode,root:boolean):CSSProperties{
  const s=node.style;const justify={start:"flex-start",center:"center",end:"flex-end",between:"space-between"} as const;const align={start:"flex-start",center:"center",end:"flex-end",stretch:"stretch"} as const;
  return {position:root?"absolute":"relative",left:root?node.x:undefined,top:root?node.y:undefined,width:s.width,height:s.height,minWidth:s.minWidth,minHeight:s.minHeight,padding:s.padding,gap:s.gap,borderRadius:s.radius,opacity:s.opacity,transform:s.rotation?`rotate(${s.rotation}deg)`:undefined,background:s.background,color:s.color,borderColor:s.borderColor,borderWidth:s.borderWidth,borderStyle:s.borderWidth?"solid":undefined,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,textAlign:s.textAlign,boxShadow:s.shadow,overflow:s.overflow,display:node.layout==="grid"?"grid":node.layout!=="free"?"flex":undefined,flexDirection:node.layout==="vertical"?"column":node.layout==="horizontal"?"row":undefined,gridTemplateColumns:node.layout==="grid"?`repeat(${s.columns??2},minmax(0,1fr))`:undefined,justifyContent:s.justify?justify[s.justify]:undefined,alignItems:s.align?align[s.align]:undefined};
}
function LayerTree({id,document,selectedId,select}:{id:string;document:DesignDocument;selectedId:string|null;select:(id:string)=>void}){const node=document.nodes[id];if(!node)return null;return <div><button className={selectedId===id?"active":""} onClick={()=>select(id)}><i>{kindIcon(node.kind)}</i><span>{node.name}</span></button>{node.childIds.length>0&&<div>{node.childIds.map(child=><LayerTree key={child} id={child} document={document} selectedId={selectedId} select={select}/>)}</div>}</div>;}
function NodeInspector({node,patch,patchStyle,remove}:{node:DesignNode;patch:(value:Partial<DesignNode>)=>void;patchStyle:(key:keyof DesignNode["style"],value:string|number|undefined)=>void;remove:()=>void}){
  const number=(value:string)=>value===""?undefined:Number(value);
  return <div className="design-doc-inspector"><header><small>{node.kind}</small><input value={node.name} onChange={event=>patch({name:event.target.value})}/></header>{node.parentId===null&&<div className="four"><Field label="X" value={node.x} change={value=>patch({x:Number(value)})}/><Field label="Y" value={node.y} change={value=>patch({y:Number(value)})}/><Field label="W" value={node.style.width??""} change={value=>patchStyle("width",number(value))}/><Field label="H" value={node.style.height??""} change={value=>patchStyle("height",number(value))}/></div>}<label>Layout<select value={node.layout} onChange={event=>patch({layout:event.target.value as DesignLayout})}>{["free","horizontal","vertical","grid"].map(value=><option key={value}>{value}</option>)}</select></label>{node.text!=null&&<label>Text<textarea value={node.text} onChange={event=>patch({text:event.target.value})}/></label>}<div className="two"><Field label="Padding" value={node.style.padding??""} change={value=>patchStyle("padding",number(value))}/><Field label="Gap" value={node.style.gap??""} change={value=>patchStyle("gap",number(value))}/><Field label="Radius" value={node.style.radius??""} change={value=>patchStyle("radius",number(value))}/><Field label="Rotate" value={node.style.rotation??""} change={value=>patchStyle("rotation",number(value))}/></div><label>Background<input type="color" value={color(node.style.background,"#ffffff")} onChange={event=>patchStyle("background",event.target.value)}/></label><label>Text color<input type="color" value={color(node.style.color,"#111827")} onChange={event=>patchStyle("color",event.target.value)}/></label><div className="two"><Field label="Font size" value={node.style.fontSize??""} change={value=>patchStyle("fontSize",number(value))}/><Field label="Weight" value={node.style.fontWeight??""} change={value=>patchStyle("fontWeight",number(value))}/></div><label className="check"><input type="checkbox" checked={!!node.style.overflow&&node.style.overflow==="hidden"} onChange={event=>patchStyle("overflow",event.target.checked?"hidden":"visible")}/> Clip content</label><button className="remove" onClick={remove}>레이어 삭제</button></div>;
}
function Field({label,value,change}:{label:string;value:string|number;change:(value:string)=>void}){return <label><span>{label}</span><input value={value} onChange={event=>change(event.target.value)}/></label>;}
function color(value:string|undefined,fallback:string){return /^#[0-9a-f]{6}$/i.test(value??"")?value!:fallback;}
function kindIcon(kind:DesignNodeKind){return {frame:"#",stack:"≡",text:"T",rectangle:"□",image:"▧",button:"◉",input:"⌨"}[kind];}
function kindLabel(kind:DesignNodeKind){return {frame:"프레임",stack:"레이아웃",text:"텍스트",rectangle:"도형",image:"이미지",button:"버튼",input:"입력창"}[kind];}
function presetIcon(preset:DesignPreset){return {navbar:"☰",hero:"H",features:"▦",cta:"→",footer:"═"}[preset];}
function presetLabel(preset:DesignPreset){return {navbar:"내비게이션",hero:"히어로",features:"기능 카드",cta:"행동 유도",footer:"푸터"}[preset];}

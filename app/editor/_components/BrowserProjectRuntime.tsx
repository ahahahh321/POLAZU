"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { detectRoots, planProject } from "../_lib/adapters";
import { assetUploadTarget, fileToBase64, scanProjectAssets, type ProjectAsset } from "../_lib/assets";
import { scanDesignTokens, updateDesignToken, type DesignToken } from "../_lib/design-tokens";
import { DESIGNER_METADATA_PATH, normalizeLayerMetadata, parseDesignerMetadata, type DesignerMetadata, type WorkbenchItem } from "../_lib/designer-metadata";
import { buildDesignSession } from "../_lib/design-session";
import { startRuntime } from "../_lib/runtime";
import { parseSourceRef } from "../_lib/source-patcher";
import type { AuditIssue, DesignerTool, Edit, FileChange, Layer, MockRule, Project, ResponsiveTarget, SaveWorkspace, Selection, Stage } from "../_lib/types";
import DesignerSidebar, { type DesignerLeftTab } from "./designer/DesignerSidebar";
import DesignerInspector, { type DesignerRightTab } from "./designer/DesignerInspector";
import { CommandPalette, ShortcutDialog, type CommandItem } from "./designer/DesignerDialogs";
import DesignerIcon from "./designer/DesignerIcon";
import { CanvasControlDock, CanvasToolRail, DesignerTopbar, SelectionToolbar } from "./designer/DesignerToolbar";

const stageLabels: Record<Stage,string> = {idle:"준비",boot:"환경 준비",install:"패키지 설치",start:"서버 시작",loading:"화면 확인",ready:"편집 가능",error:"실행 확인 필요"};
const ARTBOARD_HEIGHT = 760;

type Props = {
  project: Project;
  saveWorkspace?: SaveWorkspace;
  readOnly?: boolean;
  onLocationChange?: (location: string) => void;
};

type PanState = { x:number; y:number; left:number; top:number; pointerId:number } | null;
export default function BrowserProjectRuntime({ project, saveWorkspace, readOnly=false, onLocationChange }: Props) {
  const frame = useRef<HTMLIFrameElement>(null);
  const canvasScroll = useRef<HTMLDivElement>(null);
  const documentId = useRef("");
  const failed = useRef(false);
  const pan = useRef<PanState>(null);
  const bridgePan = useRef<{left:number;top:number}|null>(null);
  const shortcutHandler = useRef<(event:KeyboardEvent)=>void>(()=>{});
  const fitOnReady = useRef(false);
  const [spacePanning,setSpacePanning] = useState(false);
  const [windowWidth,setWindowWidth] = useState(1440);
  const sessionBaseline = useRef(project.files);
  const sessionPaths = useRef(new Set<string>());
  const [savedEditsSignature,setSavedEditsSignature] = useState("[]");
  const previewPatchFrame = useRef<number|null>(null);
  const previewPatchQueue = useRef<Record<string,{styles?:Record<string,string>;attributes?:Record<string,string>;text?:string}>>({});
  const editVersion = useRef(0);
  const initialMetadata=useMemo(()=>parseDesignerMetadata(project.files[DESIGNER_METADATA_PATH]),[project.id]);

  const [workingFiles,setWorkingFiles] = useState<Record<string,string>>(project.files);
  const workingFilesRef = useRef(project.files);
  const [runtimeFiles,setRuntimeFiles] = useState<Record<string,string>>(project.files);
  const [runtimeBinaryFiles,setRuntimeBinaryFiles] = useState<Record<string,string>>(project.binaryFiles??{});
  const runtimeProject = useMemo<Project>(()=>({...project,files:runtimeFiles,binaryFiles:runtimeBinaryFiles}),[
    project.id,project.source.owner,project.source.repository,project.source.ref,project.source.url,project.source.baseCommit,
    project.framework,project.skippedFileCount,project.role,runtimeFiles,runtimeBinaryFiles,
  ]);
  const roots = useMemo(()=>detectRoots(workingFiles),[workingFiles]);
  const [root,setRoot] = useState(roots[0] ?? "");
  const [nextUI,setNextUI] = useState(true);
  const [attempt,setAttempt] = useState(0);
  const [stage,setStage] = useState<Stage>("idle");
  const [status,setStatus] = useState("");
  const [logs,setLogs] = useState("");
  const [baseUrl,setBaseUrl] = useState("");
  const [frameUrl,setFrameUrl] = useState("");
  const [path,setPath] = useState("/");
  const [pathInput,setPathInput] = useState("/");

  const [mode,setMode] = useState<"edit"|"preview">("edit");
  const [tool,setTool] = useState<DesignerTool>("select");
  const [selected,setSelected] = useState<Selection|null>(null);
  const [selections,setSelections] = useState<Selection[]>([]);
  const [breadcrumbs,setBreadcrumbs] = useState<Layer[]>([]);
  const [layers,setLayers] = useState<Layer[]>([]);
  const [leftTab,setLeftTab] = useState<DesignerLeftTab>("layers");
  const [rightTab,setRightTab] = useState<DesignerRightTab>("design");

  const [width,setWidth] = useState(1100);
  const [zoom,setZoom] = useState(initialMetadata.zoom);
  const [compare,setCompare] = useState(false);
  const [wireframe,setWireframe] = useState(initialMetadata.wireframe);
  const [grid,setGrid] = useState(initialMetadata.grid);
  const [rulers,setRulers] = useState(initialMetadata.rulers);
  const [snap,setSnap] = useState(initialMetadata.snap);
  const [gridSize] = useState(8);
  const [verticalGuides,setVerticalGuides] = useState<number[]>(initialMetadata.verticalGuides);
  const [horizontalGuides,setHorizontalGuides] = useState<number[]>(initialMetadata.horizontalGuides);
  const [leftWidth,setLeftWidth] = useState(initialMetadata.leftWidth);
  const [rightWidth,setRightWidth] = useState(initialMetadata.rightWidth);
  const [leftCollapsed,setLeftCollapsed] = useState(false);
  const [rightCollapsed,setRightCollapsed] = useState(false);
  const [layerAliases,setLayerAliases] = useState<Record<string,string>>(initialMetadata.layerAliases);
  const [lockedSelectors,setLockedSelectors] = useState<string[]>(initialMetadata.lockedSelectors);

  const [history,setHistory] = useState<Edit[][]>([[]]);
  const [cursor,setCursor] = useState(0);
  const historyRef = useRef<Edit[][]>(history);
  const cursorRef = useRef(cursor);
  historyRef.current = history;
  cursorRef.current = cursor;
  const edits = history[cursor] ?? [];
  const [text,setText] = useState("");
  const [draft,setDraft] = useState<Record<string,string>>({});
  const [attributeDraft,setAttributeDraft] = useState<Record<string,string>>({});
  const [responsive,setResponsiveState] = useState<ResponsiveTarget>("base");
  const [touchedStyles,setTouchedStyles] = useState<Record<string,true>>({});
  const [touchedAttributes,setTouchedAttributes] = useState<Record<string,true>>({});
  const [textTouched,setTextTouched] = useState(false);
  const [secondaryPending,setSecondaryPending] = useState<Record<string,Edit>>({});
  const secondaryPendingRef=useRef<Record<string,Edit>>({});secondaryPendingRef.current=secondaryPending;

  const [rules,setRules] = useState<MockRule[]>([{method:"GET",url:"/api/example",status:200,body:{message:"샘플 응답"}}]);
  const [mockText,setMockText] = useState(JSON.stringify(rules,null,2));
  const [requests,setRequests] = useState<string[]>([]);
  const [auditIssues,setAuditIssues] = useState<AuditIssue[]>([]);
  const [auditChecked,setAuditChecked] = useState(0);
  const [notice,setNotice] = useState("");
  const [saving,setSaving] = useState(false);
  const savingRef = useRef(false);
  savingRef.current = saving;
  const saveDesignRef = useRef<() => Promise<boolean>>(async () => false);
  const lastAutosaveAttempt = useRef("");
  const [showLogs,setShowLogs] = useState(false);
  const [commandOpen,setCommandOpen] = useState(false);
  const [helpOpen,setHelpOpen] = useState(false);
  const [dragInsert,setDragInsert] = useState<string|null>(null);
  const workbenchKey = `polazu-workbench:${project.id}`;
  const [workbenchItems,setWorkbenchItems] = useState<WorkbenchItem[]>(initialMetadata.workbenchItems);
  const [selectedWorkbenchId,setSelectedWorkbenchId] = useState<string|null>(null);
  const selectedWorkbench = workbenchItems.find(item=>item.id===selectedWorkbenchId)??null;

  const filePaths = useMemo(()=>Object.keys(workingFiles).sort(),[workingFiles]);
  const designTokens = useMemo(()=>scanDesignTokens(workingFiles),[workingFiles]);
  const projectAssets = useMemo(()=>scanProjectAssets(workingFiles,runtimeBinaryFiles),[workingFiles,runtimeBinaryFiles]);
  const projectFonts = useMemo(()=>scanProjectFonts(workingFiles),[workingFiles]);
  const [selectedFile,setSelectedFile] = useState(filePaths[0] ?? "");
  const [codeText,setCodeText] = useState(selectedFile ? workingFiles[selectedFile] ?? "" : "");
  const [fileQuery,setFileQuery] = useState("");
  const token = useMemo(()=>crypto.randomUUID(),[project.id,root,attempt]);
  const plan = useMemo(()=>{try{return planProject(workingFiles,root);}catch{return null;}},[workingFiles,root]);
  const isNext = plan?.name.startsWith("Next.js") ?? false;
  const recoveryKey = "polazu-preview-edits:"+(project.id ?? project.source.url+project.source.repository)+":"+root;
  const pendingInspector = useMemo(()=>buildInspectorEdit(selected,path,responsive,draft,attributeDraft,text,touchedStyles,touchedAttributes,textTouched),[selected,path,responsive,draft,attributeDraft,text,touchedStyles,touchedAttributes,textTouched]);
  const pendingInspectorRef = useRef<Edit|null>(pendingInspector);
  pendingInspectorRef.current = pendingInspector;
  const previewEdits = useMemo(()=>[...edits,...(pendingInspector?[pendingInspector]:[]),...Object.values(secondaryPending)],[edits,pendingInspector,secondaryPending]);
  const designerMetadata=useMemo<DesignerMetadata>(()=>({version:1,zoom,grid,rulers,snap,wireframe,leftWidth,rightWidth,verticalGuides,horizontalGuides,workbenchItems,layerAliases,lockedSelectors}),[zoom,grid,rulers,snap,wireframe,leftWidth,rightWidth,verticalGuides,horizontalGuides,workbenchItems,layerAliases,lockedSelectors]);
  const metadataSignature=useMemo(()=>JSON.stringify(designerMetadata),[designerMetadata]);
  const metadataSignatureRef=useRef(metadataSignature);metadataSignatureRef.current=metadataSignature;
  const savedMetadataSignature=useRef(JSON.stringify(initialMetadata));
  const stateRef = useRef({mode,tool,snap,gridSize,rules,edits:previewEdits,wireframe,layerAliases,lockedSelectors});
  stateRef.current = {mode,tool,snap,gridSize,rules,edits:previewEdits,wireframe,layerAliases,lockedSelectors};
  const metadataDirty=metadataSignature!==savedMetadataSignature.current;
  const editsSignature = JSON.stringify(previewEdits);
  const designDirty = editsSignature !== savedEditsSignature;
  const dirtyCount = (designDirty?Math.max(1,previewEdits.length):0)+(metadataDirty?1:0);
  const autosaveKey = useMemo(() => dirtyCount ? JSON.stringify({edits:previewEdits,metadata:metadataDirty?metadataSignature:""}) : "", [dirtyCount, previewEdits,metadataDirty,metadataSignature]);

  useEffect(()=>{workingFilesRef.current=project.files;setWorkingFiles(project.files);},[project.files]);
  useEffect(()=>{setRuntimeFiles(project.files);},[project.id]);
  useEffect(()=>{setRuntimeBinaryFiles(project.binaryFiles??{});},[project.id]);
  useEffect(()=>{const resize=()=>setWindowWidth(window.innerWidth);resize();window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);},[]);
  useEffect(()=>{ if(!roots.includes(root) && roots.length) setRoot(roots[0]); },[root,roots]);
  useEffect(() => {
    const updateDragInsert = (event: Event) => setDragInsert((event as CustomEvent<{kind?:string|null}>).detail?.kind ?? null);
    window.addEventListener("polazu:insert-drag", updateDragInsert);
    return () => window.removeEventListener("polazu:insert-drag", updateDragInsert);
  }, []);
  useEffect(()=>{if(initialMetadata.workbenchItems.length)return;try{const saved=localStorage.getItem(workbenchKey);const parsed=saved?JSON.parse(saved):[];if(Array.isArray(parsed)&&parsed.length)setWorkbenchItems(parsed.map(item=>({...item,width:Number(item.width)||180,height:Number(item.height)||100})));}catch{}},[workbenchKey,initialMetadata.workbenchItems.length]);
  useEffect(()=>{try{localStorage.setItem(workbenchKey,JSON.stringify(workbenchItems));}catch{}},[workbenchItems,workbenchKey]);
  useEffect(()=>{
    if(!selectedFile || !(selectedFile in workingFiles)){
      const first=Object.keys(workingFiles).sort()[0]??"";setSelectedFile(first);setCodeText(first?workingFiles[first]:"");
    }
  },[selectedFile,workingFiles]);

  const download = useCallback((name: string, data: string, type="application/json") => {
    const url=URL.createObjectURL(new Blob([data],{type}));const link=document.createElement("a");link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  },[]);
  const send = useCallback((type: string, payload: Record<string,unknown>={}) => {
    if(!frame.current?.contentWindow || !baseUrl || !documentId.current)return;
    const targetOrigin = baseUrl.startsWith("blob:") ? "*" : new URL(baseUrl).origin;
    frame.current.contentWindow.postMessage({source:"polazu-editor",token,type,...payload}, targetOrigin);
  },[baseUrl,token]);
  const sync = useCallback(() => { send("sync",stateRef.current); },[send]);
  const queuePreviewPatch = useCallback((selector:string,patch:{styles?:Record<string,string>;attributes?:Record<string,string>;text?:string})=>{
    const current=previewPatchQueue.current[selector]??{};previewPatchQueue.current[selector]={styles:{...(current.styles??{}),...(patch.styles??{})},attributes:{...(current.attributes??{}),...(patch.attributes??{})},text:patch.text??current.text};
    if(previewPatchFrame.current!=null)return;
    previewPatchFrame.current=requestAnimationFrame(()=>{previewPatchFrame.current=null;const queued=previewPatchQueue.current;previewPatchQueue.current={};for(const [target,value] of Object.entries(queued))send("preview-patch",{selector:target,...value});});
  },[send]);
  useEffect(()=>()=>{if(previewPatchFrame.current!=null)cancelAnimationFrame(previewPatchFrame.current);},[]);

  const clearInspectorTouch = useCallback(()=>{setTouchedStyles({});setTouchedAttributes({});setTextTouched(false);setSecondaryPending({});secondaryPendingRef.current={};pendingInspectorRef.current=null;},[]);
  const replaceHistory = useCallback((nextHistory:Edit[][],nextCursor:number)=>{
    historyRef.current=nextHistory;cursorRef.current=nextCursor;setHistory(nextHistory);setCursor(nextCursor);
  },[]);
  const commitEdits = useCallback((incoming: Edit[]) => {
    const valid=incoming.filter(Boolean);if(!valid.length)return;
    editVersion.current+=1;
    const currentHistory=historyRef.current;const currentCursor=cursorRef.current;
    const next=[...(currentHistory[currentCursor]??[]),...valid];
    replaceHistory([...currentHistory.slice(0,currentCursor+1),next],currentCursor+1);
  },[replaceHistory]);
  const flushInspector = useCallback(() => {
    const pending=pendingInspectorRef.current;const secondary=Object.values(secondaryPendingRef.current);if(!pending&&!secondary.length)return false;
    commitEdits([...(pending?[pending]:[]),...secondary]);
    if(pending)setSelected(current=>{
      if(!current||current.selector!==pending.selector)return current;
      const next={...current,styles:{...current.styles,...(pending.styles??{})},attributes:{...(current.attributes??{}),...(pending.attributes??{})},text:pending.text??current.text};
      setSelections(items=>items.map(item=>item.selector===next.selector?next:item));return next;
    });
    clearInspectorTouch();return true;
  },[clearInspectorTouch,commitEdits]);

  useEffect(()=>{
    failed.current=false;documentId.current="";replaceHistory([[]],0);clearInspectorTouch();
    try { const saved=localStorage.getItem(recoveryKey);if(saved){const value=JSON.parse(saved);if(Array.isArray(value)&&value.length){replaceHistory([[],value],1);setNotice(`브라우저 복구 캐시에서 ${value.length}개 변경을 불러왔습니다.`);}} } catch{}
  },[clearInspectorTouch,recoveryKey,replaceHistory]);
  useEffect(()=>{
    try { if(designDirty&&previewEdits.length)localStorage.setItem(recoveryKey,JSON.stringify(previewEdits));else localStorage.removeItem(recoveryKey); } catch{}
  },[designDirty,previewEdits,recoveryKey]);

  useEffect(()=>{
    sessionBaseline.current=runtimeFiles;sessionPaths.current=new Set();setSavedEditsSignature("[]");fitOnReady.current=false;
    setBaseUrl("");setFrameUrl("");setLayers([]);setSelected(null);setSelections([]);setBreadcrumbs([]);setLogs("");setStage("boot");setPath("/");setPathInput("/");
    return startRuntime(runtimeProject,root,token,{
      stage:(next,message)=>{setStage(next);setStatus(message);if(next==="error"){failed.current=true;setShowLogs(true);}},
      log:line=>setLogs(previous=>(previous+line).slice(-60000)),
      url:url=>{setBaseUrl(url);setFrameUrl(url);}
    },isNext && nextUI);
  },[runtimeProject,root,attempt,token,isNext,nextUI]);
  useEffect(()=>{
    if(["ready","error","idle"].includes(stage))return;
    const ms=stage==="install"?310000:stage==="boot"?50000:120000;
    const timer=setTimeout(()=>{setStage("error");setShowLogs(true);setStatus("실행 응답이 지연됩니다. 로그를 확인하거나 다시 실행하세요.");},ms);
    return()=>clearTimeout(timer);
  },[stage,frameUrl]);

  useEffect(()=>{
    function receive(event: MessageEvent) {
      if(!baseUrl || event.source!==frame.current?.contentWindow)return;
      const expectedOrigin = baseUrl.startsWith("blob:") ? window.location.origin : new URL(baseUrl).origin;
      if(event.origin!==expectedOrigin && event.origin!=="null" && event.origin!==window.location.origin)return;
      const data=event.data;
      if(!data || data.source!=="polazu-preview" || data.token!==token)return;
      if(data.type==="ready") {
        if(typeof data.path==="string"){setPath(data.path);setPathInput(data.path);onLocationChange?.("preview:"+data.path);}
        if(Array.isArray(data.layers))setLayers(data.layers.slice(0,1000));
        if(data.hasContent && !failed.current){setStage("ready");setStatus("화면 연결됨");}else if(!failed.current)setStatus("서버가 빈 HTML을 반환했습니다. 실행 로그를 확인하세요.");
        if(documentId.current!==data.documentId){documentId.current=data.documentId;sync();}
      }
      if(data.type==="selected") {
        if(pendingInspectorRef.current||Object.keys(secondaryPendingRef.current).length)flushInspector();
        const elements=Array.isArray(data.elements)?data.elements.filter((item:unknown)=>isSelection(item)) as Selection[]:[];
        const primary=isSelection(data.element)?data.element:null;
        setSelections(elements);setSelected(primary);setBreadcrumbs(Array.isArray(data.breadcrumbs)?data.breadcrumbs:[]);
        if(primary){setText(primary.text);setDraft(primary.styles??{});setAttributeDraft(primary.attributes??{});setRightTab("design");onLocationChange?.("canvas:"+primary.selector);}
        else {setText("");setDraft({});setAttributeDraft({});}
        clearInspectorTouch();
      }
      if(data.type==="selection-refresh"&&!pendingInspectorRef.current&&!Object.keys(secondaryPendingRef.current).length){
        const primary=isSelection(data.element)?data.element:null;
        setSelected(primary);setSelections(Array.isArray(data.elements)?data.elements.filter(isSelection):[]);setBreadcrumbs(Array.isArray(data.breadcrumbs)?data.breadcrumbs:[]);
        setText(primary?.text??"");setDraft(primary?.styles??{});setAttributeDraft(primary?.attributes??{});
      }
      if(data.type==="manipulation" && Array.isArray(data.changes)) {
        const incoming:Edit[]=data.changes.filter((item:unknown)=>item&&typeof item==="object").map((change:{selector:string;sourceId?:string;generatedId?:string;styles?:Record<string,string>;text?:string;attributes?:Record<string,string>;element?:Selection})=>({id:crypto.randomUUID(),path,selector:change.selector,sourceId:change.sourceId,generatedId:change.generatedId??change.element?.generatedId,styles:change.styles,text:change.text,attributes:change.attributes,responsive:"base"}));
        commitEdits(incoming);
        const last=data.changes.at(-1)?.element;if(isSelection(last)){setSelected(last);setSelections(current=>current.map(item=>item.selector===last.selector?last:item));setDraft(last.styles??{});setAttributeDraft(last.attributes??{});setText(last.text??"");}
        setNotice(`${incoming.length}개 요소 변경을 작업 이력에 기록했습니다.`);
      }
      if(data.type==="structure") {
        const incoming:Edit[]=[...(Array.isArray(data.edits)?data.edits:[]),...(data.edit?[data.edit]:[])].filter((item:unknown)=>item&&typeof item==="object");
        commitEdits(incoming);setTool("select");setNotice(`${incoming.length}개 구조 변경을 작업 이력에 기록했습니다.`);
      }
      if(data.type==="layer-metadata") {
        const next=normalizeLayerMetadata(data);
        setLayerAliases(next.layerAliases);setLockedSelectors(next.lockedSelectors);
      }
      if(data.type==="audit-result") {setAuditIssues(Array.isArray(data.issues)?data.issues:[]);setAuditChecked(Number(data.checked)||0);setRightTab("audit");}
      if(data.type==="comment-target" && isSelection(data.element)){onLocationChange?.("canvas:"+data.element.selector);setNotice("댓글 위치를 선택했습니다. 상단 공동 작업 패널의 검토 탭에서 댓글을 작성하세요.");setTool("select");}
      if(data.type==="runtime-error"){failed.current=true;setStage("error");setStatus(String(data.message));setNotice(String(data.message));setLogs(previous=>(previous+"\n[브라우저] "+String(data.message)).slice(-60000));setShowLogs(true);}
      if(data.type==="notice")setNotice(String(data.message));
      if(data.type==="canvas-zoom"){
        const bounds=frame.current?.getBoundingClientRect();const scale=bounds&&frame.current?bounds.width/frame.current.clientWidth:1;
        zoomAt(Number(data.direction)>0?-10:10,bounds?bounds.left+(Number(data.x)||0)*scale:undefined,bounds?bounds.top+(Number(data.y)||0)*scale:undefined);
      }
      if(data.type==="editor-shortcut")shortcutHandler.current({key:String(data.key??""),code:String(data.code??""),ctrlKey:!!data.ctrlKey,metaKey:!!data.metaKey,shiftKey:!!data.shiftKey,altKey:!!data.altKey,preventDefault(){},target:null} as unknown as KeyboardEvent);
      if(data.type==="canvas-pan"&&canvasScroll.current){
        const surface=canvasScroll.current;
        if(data.phase==="start")bridgePan.current={left:surface.scrollLeft,top:surface.scrollTop};
        else if(data.phase==="end")bridgePan.current=null;
        else if(bridgePan.current){const scale=data.coordinateSpace==="screen"?1:(frame.current?.getBoundingClientRect().width??width)/width;surface.scrollLeft=bridgePan.current.left-Number(data.dx||0)*scale;surface.scrollTop=bridgePan.current.top-Number(data.dy||0)*scale;}
      }
      if(data.type==="request")setRequests(previous=>[data.method+" "+data.url+(data.matched?" · Mock":" · 응답 미설정"),...previous].slice(0,50));
    }
    window.addEventListener("message",receive);return()=>window.removeEventListener("message",receive);
  },[baseUrl,token,onLocationChange,sync,clearInspectorTouch,commitEdits,flushInspector,path,width]);
  useEffect(()=>{sync();},[mode,tool,snap,gridSize,rules,wireframe,cursor,baseUrl,sync]);

  const navigate = useCallback((value: string) => {
    flushInspector();
    if(!baseUrl)return;
    if(!value.startsWith("/") || value.startsWith("//") || /[\\\r\n]/.test(value)){setNotice("프로젝트 내부 경로만 입력하세요. 예: /about");return;}
    if(baseUrl.startsWith("blob:")){
      const found=findHtmlForRoute(value,workingFiles);if(found){void injectStaticPreview(found.content,value);return;}
    }
    const url=new URL(value,baseUrl);if(url.origin!==new URL(baseUrl).origin)return;
    failed.current=false;setStage("loading");setStatus("페이지 로딩 중");setSelected(null);setSelections([]);setFrameUrl(url.href);setPathInput(value);onLocationChange?.("preview:"+value);
  },[baseUrl,flushInspector,onLocationChange,token,workingFiles]);

  async function injectStaticPreview(content:string,route:string){
    const bridge=await fetch("/editor-bridge.js",{cache:"no-store"}).then(response=>response.ok?response.text():"");
    const script=`\n<script>window.__POLAZU_CONFIG__={token:${JSON.stringify(token)},origin:window.location.origin};<\/script><script>${bridge}<\/script>`;
    let injected=content;if(injected.includes("</body>"))injected=injected.replace("</body>",script+"</body>");else injected+=script;
    const nextUrl=URL.createObjectURL(new Blob([injected],{type:"text/html;charset=utf-8"}));setFrameUrl(nextUrl);setPath(route);setPathInput(route);setSelected(null);setSelections([]);
  }

  async function persist(changes:FileChange[],summary:string,kind:"CODE"|"DESIGN"|"EDIT"){
    if(readOnly){setNotice("뷰어는 공동 소스를 수정할 수 없습니다.");return false;}
    setSaving(true);
    try{
      if(saveWorkspace)await saveWorkspace(changes,summary,kind);
      const next={...workingFilesRef.current};for(const change of changes){if(change.delete)delete next[change.path];else if(typeof change.content==="string")next[change.path]=change.content;}workingFilesRef.current=next;setWorkingFiles(next);
      setNotice("서버 공동 작업 초안에 저장했습니다.");return true;
    }catch(error){setNotice(error instanceof Error?error.message:"저장하지 못했습니다.");return false;}
    finally{setSaving(false);}
  }

  async function saveDesign():Promise<boolean>{
    if(readOnly){setNotice("뷰어는 공동 소스를 수정할 수 없습니다.");return false;}
    if(savingRef.current)return false;
    flushInspector();
    const allEdits=historyRef.current[cursorRef.current]??[];
    const savingSignature=JSON.stringify(allEdits);
    if(savingSignature===savedEditsSignature&&!metadataDirty)return true;
    const savingVersion=editVersion.current;const savingMetadata=metadataSignature;const result=buildDesignSession(sessionBaseline.current,workingFiles,allEdits,sessionPaths.current,findHtmlForRoute);
    const changes=[...result.changes.filter(change=>change.path!==DESIGNER_METADATA_PATH),...(metadataDirty?[{path:DESIGNER_METADATA_PATH,content:JSON.stringify(designerMetadata,null,2)}]:[])];
    if(!changes.length){if(!result.warnings.length){setSavedEditsSignature(savingSignature);return true;}setNotice(result.warnings[0]);return false;}
    savingRef.current=true;
    const labels=[...new Set(changes.map(item=>item.path))];
    if(await persist(changes,`디자인 편집: ${labels.slice(0,3).join(", ")}${labels.length>3?` 외 ${labels.length-3}개`:""}`,"DESIGN")){
      if(result.files[selectedFile]!=null)setCodeText(result.files[selectedFile]);
      savedMetadataSignature.current=savingMetadata;
      sessionPaths.current=result.paths;setSavedEditsSignature(savingSignature);
      if(editVersion.current===savingVersion)localStorage.removeItem(recoveryKey);
      setNotice(editVersion.current!==savingVersion||metadataSignatureRef.current!==savingMetadata?"저장 중 생긴 새 변경은 유지했습니다. 이어서 자동 저장합니다.":result.warnings.length?`저장 완료 · 확인 필요 ${result.warnings.length}건: ${result.warnings.slice(0,2).join(" / ")}`:`${changes.length}개 파일을 서버 초안에 저장했습니다.`);
      savingRef.current=false;return true;
    }
    savingRef.current=false;
    return false;
  }

  saveDesignRef.current = saveDesign;
  useEffect(() => {
    if (!autosaveKey) { lastAutosaveAttempt.current = ""; return; }
    if (readOnly || !saveWorkspace || stage !== "ready" || saving || lastAutosaveAttempt.current === autosaveKey) return;
    const timer = window.setTimeout(() => {
      if (savingRef.current) return;
      lastAutosaveAttempt.current = autosaveKey;
      void saveDesignRef.current();
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [autosaveKey, readOnly, saveWorkspace, stage, saving]);

  function chooseFile(file:string){setSelectedFile(file);setCodeText(workingFiles[file]??"");if(/\.(css|scss|sass|less)$/i.test(file))setRightTab("css");else if(/\.(js|jsx|ts|tsx)$/i.test(file))setRightTab("logic");onLocationChange?.("file:"+file);}
  function switchRightTab(tab:DesignerRightTab){
    if(tab!=="design")flushInspector();
    if(tab==="css"||tab==="logic"){
      const candidates=filePaths.filter(file=>tab==="css"?/\.(css|scss|sass|less)$/i.test(file):/\.(js|jsx|ts|tsx)$/i.test(file));
      const ref=selected?.sourceId?parseSourceRef(selected.sourceId):null;
      const preferred=ref&&candidates.includes(ref.path)?ref.path:candidates.includes(selectedFile)?selectedFile:candidates[0];
      if(preferred){setSelectedFile(preferred);setCodeText(workingFiles[preferred]??"");onLocationChange?.("file:"+preferred);}
    }
    setRightTab(tab);if(tab==="audit")send("command",{command:"audit"});
  }
  function checkpointRuntime(){
    replaceHistory([[]],0);clearInspectorTouch();setSavedEditsSignature("[]");sessionPaths.current=new Set();
    sessionBaseline.current=workingFilesRef.current;setRuntimeFiles({...workingFilesRef.current});
  }
  async function restartRuntime(){if(dirtyCount&&!await saveDesign())return;checkpointRuntime();}
  async function changeRuntimeMode(value:boolean){if(dirtyCount&&!await saveDesign())return;checkpointRuntime();setNextUI(value);}
  async function saveToken(token:DesignToken,value:string){
    if(readOnly){setNotice("뷰어는 디자인 토큰을 수정할 수 없습니다.");return false;}
    if(dirtyCount&&!await saveDesign())return false;
    const result=updateDesignToken(workingFilesRef.current,token,value);
    if(!result.change){setNotice(result.error??"디자인 토큰을 수정하지 못했습니다.");return false;}
    const saved=await persist([result.change],`디자인 토큰 수정: ${token.name}`,"DESIGN");
    if(saved){checkpointRuntime();setNotice(`${token.name} 토큰을 저장했습니다.`);}
    return saved;
  }
  async function uploadAsset(file:File){
    if(readOnly){setNotice("뷰어는 프로젝트 자산을 추가할 수 없습니다.");return false;}
    if(!/^image\/(?:png|jpeg|webp|gif|svg\+xml|avif)$/i.test(file.type)&&!/[.](?:png|jpe?g|webp|gif|svg|avif)$/i.test(file.name)){setNotice("PNG, JPG, WebP, GIF, SVG 또는 AVIF 이미지만 업로드할 수 있습니다.");return false;}
    if(!file.size||file.size>4*1024*1024){setNotice("이미지 파일 하나의 업로드 한도는 4MiB입니다.");return false;}
    try{
      if(dirtyCount&&!await saveDesign())return false;
      const target=assetUploadTarget(root,file.name,typeof workingFiles[`${root}/package.json`]==="string",[...Object.keys(workingFiles),...Object.keys(runtimeBinaryFiles)]);
      const binaryBase64=await fileToBase64(file);
      if(!await persist([{path:target.path,binaryBase64}],`이미지 자산 추가: ${target.path}` ,"DESIGN"))return false;
      setRuntimeBinaryFiles(current=>({...current,[target.path]:binaryBase64}));
      checkpointRuntime();setLeftTab("assets");setNotice(`${target.url} 자산을 프로젝트에 저장했습니다.`);return true;
    }catch(cause){setNotice(cause instanceof Error?cause.message:"이미지 자산을 저장하지 못했습니다.");return false;}
  }
  function useAsset(asset:ProjectAsset){
    if(selected?.tag!=="img"){setNotice("캔버스에서 Image 레이어를 먼저 선택해 주세요.");return;}
    changeAttribute("src",asset.url);setNotice(`${asset.name}을 선택한 Image에 연결했습니다. 자동 저장됩니다.`);
  }
  async function saveCode(){
    if(!selectedFile)return;
    const bytes=new TextEncoder().encode(codeText).length;if(bytes>4*1024*1024){setNotice("파일 하나의 저장 한도는 4MiB입니다.");return;}
    if(codeText===workingFiles[selectedFile]){setNotice("저장할 코드 변경이 없습니다.");return;}
    if(dirtyCount&&!await saveDesign())return;
    if(await persist([{path:selectedFile,content:codeText}],`코드 수정: ${selectedFile}`,"CODE")){checkpointRuntime();}
  }
  async function createLogicFile(){
    const html=findHtmlForRoute(path,workingFiles);const scriptPath="/script.js";
    const starter=`// POLAZU interaction file\n// data-action 속성을 가진 요소에 간단한 동작을 연결하세요.\ndocument.addEventListener("click", (event) => {\n  const target = event.target instanceof Element ? event.target.closest("[data-action]") : null;\n  if (!target) return;\n\n  const action = target.getAttribute("data-action");\n  if (action === "toggle") {\n    const selector = target.getAttribute("data-target");\n    if (selector) document.querySelector(selector)?.classList.toggle("is-open");\n  }\n});\n`;
    const changes:FileChange[]=[{path:scriptPath,content:starter}];
    if(html&&!/src=["']\/script\.js["']/.test(html.content)){const linked=html.content.includes("</body>")?html.content.replace("</body>",`  <script src="/script.js" defer></script>\n</body>`):html.content+`\n<script src="/script.js" defer></script>\n`;changes.push({path:html.path,content:linked});}
    if(dirtyCount&&!await saveDesign())return;
    if(await persist(changes,"간단한 페이지 동작 파일 추가","CODE")){setSelectedFile(scriptPath);setCodeText(starter);setRightTab("logic");checkpointRuntime();}
  }
  function applyMocks(){try{const value:unknown=JSON.parse(mockText);if(!Array.isArray(value)||value.length>50||mockText.length>100000)throw Error();for(const rule of value as MockRule[])if(!rule||!["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"].includes(rule.method)||typeof rule.url!=="string"||!rule.url.startsWith("/")||rule.url.startsWith("//")||!Number.isInteger(rule.status)||rule.status<200||rule.status>599)throw Error();setRules(value as MockRule[]);setNotice("Mock 적용 완료. Preview에서 요청을 다시 실행하세요.");}catch{setNotice("Mock은 method, /경로, status(200~599), body 배열로 작성하세요.");}}

  function designerCommand(command:string,payload:Record<string,unknown>={}){
    if(readOnly && !["audit","deselect","copy"].includes(command)){setNotice("뷰어는 디자인 변경 명령을 실행할 수 없습니다.");return;}
    send("command",{command,payload});
  }
  function setDesignerTool(next:DesignerTool){if(readOnly&&next!=="select"&&next!=="hand"&&next!=="comment")return;setMode("edit");setCompare(false);setTool(next);}
  function setResponsive(value:ResponsiveTarget){flushInspector();setResponsiveState(value);if(value==="desktop")setWidth(1100);if(value==="tablet")setWidth(768);if(value==="mobile")setWidth(390);setCompare(false);}
  function changeRoot(value:string){if(designDirty){setNotice("현재 디자인 변경이 저장된 뒤 프로젝트 루트를 바꿀 수 있습니다.");return;}checkpointRuntime();setRoot(value);}
  function changeStyle(name:string,value:string){
    if(readOnly)return;
    editVersion.current+=1;
    const styles:Record<string,string>={[name]:value};
    if((name==="left"||name==="top")&&draft.position==="static"&&value&&value!=="auto")styles.position="relative";
    setDraft(current=>({...current,...styles}));setTouchedStyles(current=>({...current,...Object.fromEntries(Object.keys(styles).map(key=>[key,true as const]))}));
    if(selected)queuePreviewPatch(selected.selector,{styles});
    const secondary=selections.filter(item=>item.selector!==selected?.selector);
    if(secondary.length){
      for(const item of secondary)queuePreviewPatch(item.selector,{styles});
      setSecondaryPending(current=>{const next={...current};for(const item of secondary){const previous=next[item.selector];next[item.selector]={id:previous?.id??crypto.randomUUID(),path,selector:item.selector,sourceId:item.sourceId,generatedId:item.generatedId,responsive,styles:{...(previous?.styles??{}),...styles}};}secondaryPendingRef.current=next;return next;});
    }
  }
  function changeAttribute(name:string,value:string){editVersion.current+=1;setAttributeDraft(current=>({...current,[name]:value}));setTouchedAttributes(current=>({...current,[name]:true}));if(selected)queuePreviewPatch(selected.selector,{attributes:{[name]:value}});}
  function changeText(value:string){editVersion.current+=1;setText(value);setTextTouched(true);if(selected)queuePreviewPatch(selected.selector,{text:value});}
  function selectLayer(selector:string,additive=false){send("select",{selector,additive});}
  function undo(){
    if(readOnly)return;editVersion.current+=1;
    if(pendingInspectorRef.current){flushInspector();const next=Math.max(0,cursorRef.current-1);cursorRef.current=next;setCursor(next);return;}
    const next=Math.max(0,cursorRef.current-1);cursorRef.current=next;setCursor(next);
  }
  function redo(){if(readOnly)return;editVersion.current+=1;const next=Math.min(historyRef.current.length-1,cursorRef.current+1);cursorRef.current=next;setCursor(next);}
  function zoomAt(delta:number,clientX?:number,clientY?:number){
    const surface=canvasScroll.current;if(!surface)return;
    const bounds=surface.getBoundingClientRect();
    const x=clientX==null?surface.clientWidth/2:clientX-bounds.left;
    const y=clientY==null?surface.clientHeight/2:clientY-bounds.top;
    setZoom(previous=>{
      const next=Math.max(20,Math.min(200,previous+delta));
      const artboard=surface.querySelector<HTMLElement>(".designer-artboard-stage");
      const originX=artboard?.offsetLeft??0,originY=artboard?.offsetTop??0;
      const left=originX+(surface.scrollLeft+x-originX)*next/previous-x;
      const top=originY+(surface.scrollTop+y-originY)*next/previous-y;
      requestAnimationFrame(()=>surface.scrollTo({left:Math.max(0,left),top:Math.max(0,top),behavior:"instant"}));
      return next;
    });
  }
  function fitCanvas(){
    const surface=canvasScroll.current;if(!surface)return;
    const availableWidth=Math.max(120,surface.clientWidth-100),availableHeight=Math.max(120,surface.clientHeight-145);
    setZoom(Math.max(20,Math.min(100,Math.floor(Math.min(availableWidth/width,availableHeight/ARTBOARD_HEIGHT)*100))));
    requestAnimationFrame(()=>surface.scrollTo({left:0,top:0,behavior:"instant"}));
  }
  useEffect(()=>{if(stage!=="ready"||fitOnReady.current)return;fitOnReady.current=true;fitCanvas();},[stage]);
  useEffect(()=>{if(stage==="ready")fitCanvas();},[width]);
  function fitSelection(){
    if(!selected||!canvasScroll.current){setNotice("맞출 요소를 먼저 선택하세요.");return;}
    const viewport=canvasScroll.current;
    const availableWidth=Math.max(220,viewport.clientWidth-180);
    const availableHeight=Math.max(180,viewport.clientHeight-190);
    const nextZoom=Math.max(20,Math.min(180,Math.floor(Math.min(availableWidth/Math.max(1,selected.width),availableHeight/Math.max(1,selected.height))*100/5)*5));
    setZoom(nextZoom);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const scale=nextZoom/100;
      const rulerOffset=rulers?24:0;
      const x=(selected.x??0)*scale+rulerOffset;
      const y=(selected.y??0)*scale+rulerOffset;
      viewport.scrollTo({left:Math.max(0,x-(viewport.clientWidth-selected.width*scale)/2),top:Math.max(0,y-(viewport.clientHeight-selected.height*scale)/2),behavior:"smooth"});
    }));
  }
  function toggleResponsiveCompare(){flushInspector();setCompare(value=>{const next=!value;if(next){setMode("preview");setTool("select");}return next;});}

  function insertAtCanvasPoint(event:React.DragEvent<HTMLDivElement>){
    event.preventDefault();
    const kind=event.dataTransfer.getData("application/x-polazu-insert")||dragInsert;
    const workbenchId=event.dataTransfer.getData("application/x-polazu-workbench");
    const preview=frame.current;
    if(!kind||!preview||stage!=="ready"){setDragInsert(null);return;}
    const bounds=preview.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom){
      const surface=canvasScroll.current?.getBoundingClientRect();
      if(surface){const previous=workbenchItems.find(item=>item.id===workbenchId);const item={id:workbenchId||crypto.randomUUID(),kind,x:Math.max(34,event.clientX-surface.left+(canvasScroll.current?.scrollLeft??0)),y:Math.max(34,event.clientY-surface.top+(canvasScroll.current?.scrollTop??0)),width:previous?.width??180,height:previous?.height??100};setWorkbenchItems(current=>[...current.filter(value=>value.id!==item.id),item]);setSelectedWorkbenchId(item.id);setSelected(null);setNotice("작업대에 자동 저장했습니다. 페이지 안으로 옮기기 전까지 실제 코드는 변경되지 않습니다.");}
      setDragInsert(null);return;
    }
    const x=Math.round((event.clientX-bounds.left)*(preview.clientWidth/Math.max(1,bounds.width)));
    const y=Math.round((event.clientY-bounds.top)*(preview.clientHeight/Math.max(1,bounds.height)));
    send("command",{command:"insert-at-point",payload:{kind,x,y}});
    if(workbenchId)setWorkbenchItems(current=>current.filter(item=>item.id!==workbenchId));
    if(workbenchId)setSelectedWorkbenchId(null);
    setNotice("페이지 안에 배치했습니다. 실제 코드 자동 저장 대상으로 전환됩니다.");
    setDragInsert(null);
    setNotice(`${kind} 요소를 놓은 위치의 가장 가까운 컨테이너에 추가했습니다.`);
  }

  function canvasPointerDown(event:ReactPointerEvent<HTMLDivElement>){
    if(!(tool==="hand"||spacePanning||event.button===1)||!canvasScroll.current)return;
    event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);pan.current={x:event.clientX,y:event.clientY,left:canvasScroll.current.scrollLeft,top:canvasScroll.current.scrollTop,pointerId:event.pointerId};
  }
  function canvasPointerMove(event:ReactPointerEvent<HTMLDivElement>){if(!pan.current||!canvasScroll.current)return;canvasScroll.current.scrollLeft=pan.current.left-(event.clientX-pan.current.x);canvasScroll.current.scrollTop=pan.current.top-(event.clientY-pan.current.y);}
  function canvasPointerUp(event:ReactPointerEvent<HTMLDivElement>){if(pan.current?.pointerId===event.pointerId){event.currentTarget.releasePointerCapture(event.pointerId);pan.current=null;}}

  useEffect(()=>{
    const preventBrowserZoom=(event:WheelEvent)=>{if(!(event.ctrlKey||event.metaKey))return;const target=event.target as Element|null;if(!target?.closest?.(".designer-studio"))return;event.preventDefault();event.stopPropagation();zoomAt(event.deltaY>0?-10:10,event.clientX,event.clientY);};
    window.addEventListener("wheel",preventBrowserZoom,{passive:false,capture:true});
    return()=>window.removeEventListener("wheel",preventBrowserZoom,{capture:true});
  },[]);
  function startPanelResize(side:"left"|"right",event:ReactPointerEvent<HTMLDivElement>){
    event.preventDefault();const start=event.clientX;const initial=side==="left"?leftWidth:rightWidth;
    const move=(next:PointerEvent)=>{const delta=next.clientX-start;const value=Math.max(220,Math.min(520,initial+(side==="left"?delta:-delta)));if(side==="left")setLeftWidth(value);else setRightWidth(value);};
    const end=()=>{removeEventListener("pointermove",move);removeEventListener("pointerup",end);};addEventListener("pointermove",move);addEventListener("pointerup",end);
  }
  function addGuide(axis:"vertical"|"horizontal",event:ReactPointerEvent<HTMLDivElement>){
    const bounds=event.currentTarget.getBoundingClientRect();const value=Math.max(0,Math.round((axis==="vertical"?event.clientX-bounds.left:event.clientY-bounds.top)/(zoom/100)));
    if(axis==="vertical")setVerticalGuides(current=>[...current,value]);else setHorizontalGuides(current=>[...current,value]);
  }

  const commands:CommandItem[]=[
    {id:"save",label:"서버 공동 작업 초안에 저장",detail:`${dirtyCount}개 디자인 변경`,shortcut:"⌘S",icon:"save",disabled:readOnly||dirtyCount===0,action:()=>void saveDesign()},
    {id:"select",label:"선택 도구",shortcut:"V",icon:"select",action:()=>setDesignerTool("select")},
    {id:"hand",label:"손 도구",shortcut:"H",icon:"hand",action:()=>setDesignerTool("hand")},
    {id:"frame",label:"프레임 삽입 도구",shortcut:"F",icon:"frame",disabled:readOnly,action:()=>setDesignerTool("frame")},
    {id:"text",label:"텍스트 삽입 도구",shortcut:"T",icon:"text",disabled:readOnly,action:()=>setDesignerTool("text")},
    {id:"rectangle",label:"사각형 삽입 도구",shortcut:"R",icon:"rectangle",disabled:readOnly,action:()=>setDesignerTool("rectangle")},
    {id:"image",label:"이미지 자리 삽입 도구",shortcut:"I",icon:"image",disabled:readOnly,action:()=>setDesignerTool("image")},
    {id:"duplicate",label:"선택 요소 복제",shortcut:"⌘D",icon:"duplicate",disabled:readOnly||!selected,action:()=>designerCommand("duplicate")},
    {id:"delete",label:"선택 요소 삭제",shortcut:"⌫",icon:"trash",disabled:readOnly||!selected,action:()=>designerCommand("delete")},
    {id:"layers",label:"Layers 패널 열기",icon:"layers",action:()=>{setLeftCollapsed(false);setLeftTab("layers");}},
    {id:"insert",label:"Insert 패널 열기",icon:"insert",action:()=>{setLeftCollapsed(false);setLeftTab("insert");}},
    {id:"assets",label:"Assets 패널 열기",detail:`프로젝트 이미지 ${projectAssets.length}개`,icon:"image",action:()=>{setLeftCollapsed(false);setLeftTab("assets");}},
    {id:"tokens",label:"Design Tokens 패널 열기",detail:`CSS 변수 ${designTokens.length}개`,icon:"palette",action:()=>{setLeftCollapsed(false);setLeftTab("tokens");}},
    {id:"code",label:"선택 요소 관련 로직 열기",icon:"code",disabled:!filePaths.some(file=>/\.(js|jsx|ts|tsx)$/i.test(file)),action:()=>{setRightCollapsed(false);switchRightTab("logic");}},
    {id:"audit",label:"접근성·레이아웃 품질 검사",icon:"audit",action:()=>{setRightCollapsed(false);switchRightTab("audit");}},
    {id:"grid",label:grid?"격자 숨기기":"격자 표시",shortcut:"G",icon:"grid",action:()=>setGrid(value=>!value)},
    {id:"rulers",label:rulers?"눈금자 숨기기":"눈금자 표시",shortcut:"⇧R",icon:"ruler",action:()=>setRulers(value=>!value)},
    {id:"compare",label:compare?"단일 화면으로 보기":"Desktop·Tablet·Mobile 나란히 보기",icon:"desktop",action:toggleResponsiveCompare},
    {id:"wireframe",label:wireframe?"실제 디자인 보기":"와이어프레임 보기",shortcut:"⇧W",icon:"eye",action:()=>setWireframe(value=>!value)},
    {id:"fit",label:"캔버스 맞춤",shortcut:"0",icon:"fit",action:fitCanvas},
    {id:"fit-selection",label:"선택 요소 맞춤",shortcut:"2",icon:"select",disabled:!selected,action:fitSelection},
    {id:"export",label:"검토용 변경 JSON 내보내기",icon:"up",action:()=>download("polazu-designer-review.json",JSON.stringify({version:2,source:project.source,edits:pendingInspector?[...edits,pendingInspector]:edits,rules},null,2))},
  ];

  useEffect(()=>{
    function keydown(event:KeyboardEvent){
      const target=event.target as HTMLElement|null;const typing=!!target&&(target.matches("input,textarea,select")||target.isContentEditable);
      const meta=event.metaKey||event.ctrlKey;const key=event.key.toLowerCase();
      if(meta&&key==="s"){event.preventDefault();void saveDesign();return;}
      if(meta&&key==="k"){event.preventDefault();setCommandOpen(true);return;}
      if(typing)return;
      if(!meta&&target?.closest(".designer-right-panel,.designer-sidebar")&&!target.closest('[role="treeitem"]'))return;
      if(event.key==="Tab"&&target?.closest("button,a,summary"))return;
      if(commandOpen||helpOpen){if(event.key==="Escape"){setCommandOpen(false);setHelpOpen(false);}return;}
      if(event.code==="Space"&&!meta){event.preventDefault();setSpacePanning(true);return;}
      if(event.key==="Tab"&&!meta){event.preventDefault();designerCommand(event.shiftKey?"select-previous":"select-next");return;}
      if(meta&&event.code==="Backslash"){event.preventDefault();setLeftCollapsed(value=>!value);setRightCollapsed(value=>!value);return;}
      if(event.key==="Enter"&&!meta){event.preventDefault();designerCommand("select-child");return;}
      if(meta&&key==="y"){event.preventDefault();redo();return;}
      if(meta&&key==="z"){event.preventDefault();if(event.shiftKey)redo();else undo();return;}
      if(meta&&key==="d"){event.preventDefault();designerCommand("duplicate");return;}
      if(meta&&key==="c"){event.preventDefault();designerCommand("copy");return;}
      if(meta&&key==="v"){event.preventDefault();designerCommand("paste");return;}
      if(event.key==="Delete"||event.key==="Backspace"){event.preventDefault();designerCommand("delete");return;}
      if(event.key==="Escape"){event.preventDefault();designerCommand("select-parent");setTool("select");return;}
      if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key)){event.preventDefault();const amount=event.shiftKey?10:1;designerCommand("nudge",{x:event.key==="ArrowLeft"?-amount:event.key==="ArrowRight"?amount:0,y:event.key==="ArrowUp"?-amount:event.key==="ArrowDown"?amount:0});return;}
      const toolMap:Record<string,DesignerTool>={v:"select",h:"hand",f:"frame",t:"text",r:"rectangle",i:"image",c:"comment"};
      if(key==="r"&&event.shiftKey){event.preventDefault();setRulers(value=>!value);return;}
      if(event.code==="Digit1"&&event.shiftKey){event.preventDefault();fitCanvas();return;}
      if(event.code==="Digit2"&&event.shiftKey){event.preventDefault();fitSelection();return;}
      if(toolMap[key]){event.preventDefault();setDesignerTool(toolMap[key]);return;}
      if(key==="g"){setGrid(value=>!value);return;}
      if(key==="w"&&event.shiftKey){event.preventDefault();setWireframe(value=>!value);return;}
      if(key==="0"){event.preventDefault();fitCanvas();return;}if(key==="1"){event.preventDefault();setZoom(100);return;}if(key==="2"){event.preventDefault();fitSelection();return;}if(key==="+"||key==="="){event.preventDefault();zoomAt(10);return;}if(key==="-"){event.preventDefault();zoomAt(-10);return;}if(key==="?")setHelpOpen(true);
    }
    shortcutHandler.current=keydown;
    const keyup=(event:KeyboardEvent)=>{if(event.code==="Space")setSpacePanning(false);};const blur=()=>{setSpacePanning(false);bridgePan.current=null;};
    addEventListener("keydown",keydown);addEventListener("keyup",keyup);addEventListener("blur",blur);return()=>{removeEventListener("keydown",keydown);removeEventListener("keyup",keyup);removeEventListener("blur",blur);};
  });

  const gridStyle=grid?{"--designer-grid":`${gridSize*zoom/100}px`} as CSSProperties:undefined;
  const compact=windowWidth<1320;
  const studioColumns=`${leftCollapsed?0:Math.min(leftWidth,compact?232:320)}px 5px minmax(160px,1fr) 5px ${rightCollapsed?0:Math.min(rightWidth,compact?300:440)}px`;

  return <div className="designer-studio polazu-v3">
    <DesignerTopbar mode={mode} setMode={(value)=>{flushInspector();setMode(value);if(value==="preview")setTool("select");}} pathInput={pathInput} setPathInput={setPathInput} navigate={navigate} canNavigate={!!baseUrl} canUndo={cursor>0||!!pendingInspector} canRedo={cursor<history.length-1} undo={undo} redo={redo} openCommands={()=>setCommandOpen(true)} openHelp={()=>setHelpOpen(true)} save={()=>void saveDesign()} saving={saving} dirtyCount={dirtyCount} readOnly={readOnly} projectName={project.source.repository} branch={project.source.ref} revision={project.revision} publishedRevision={project.publishedRevision} role={project.role} presence={project.presence} openWorkspace={(tab)=>window.dispatchEvent(new CustomEvent("polazu:workspace-open",{detail:{tab}}))}/>
    <div className="designer-workspace" style={{gridTemplateColumns:studioColumns}}>
      {!leftCollapsed&&<DesignerSidebar tab={leftTab} setTab={setLeftTab} layers={layers} selections={selections} selectLayer={selectLayer} command={designerCommand} pages={plan?.routes??["/"]} currentPath={path} navigate={navigate} files={filePaths} selectedFile={selectedFile} chooseFile={chooseFile} fileQuery={fileQuery} setFileQuery={setFileQuery} roots={roots.length?roots:[root]} root={root} setRoot={changeRoot} planName={isNext&&nextUI?"Next.js · UI":plan?.name??"Project"} planNotes={plan?.notes??[]} isNext={isNext} nextUI={nextUI} setNextUI={(value)=>void changeRuntimeMode(value)} tokens={designTokens} updateToken={saveToken} assets={projectAssets} assetBaseUrl={baseUrl} uploadAsset={uploadAsset} useAsset={useAsset} canUseAsset={selected?.tag==="img"} tokenSaving={saving} readOnly={readOnly}/>}
      <div className={`designer-panel-resizer left${leftCollapsed?" collapsed":""}`} onPointerDown={(event)=>!leftCollapsed&&startPanelResize("left",event)}><button type="button" aria-label={leftCollapsed?"왼쪽 패널 열기":"왼쪽 패널 접기"} onPointerDown={(event)=>event.stopPropagation()} onClick={()=>setLeftCollapsed(value=>!value)}><DesignerIcon name="chevron"/></button></div>
      <main className="designer-canvas" aria-label="디자인 캔버스">
        <CanvasToolRail tool={tool} setTool={setDesignerTool} disabled={stage!=="ready"}/>
        <SelectionToolbar count={selections.length} command={designerCommand} readOnly={readOnly}/>
        <div className={`designer-canvas-scroll${tool==="hand"||spacePanning?" is-panning":""}${grid?" show-grid":""}`} ref={canvasScroll} style={gridStyle} onPointerDown={canvasPointerDown} onPointerMove={canvasPointerMove} onPointerUp={canvasPointerUp} onPointerCancel={canvasPointerUp} onDragOver={(event)=>{event.preventDefault();event.dataTransfer.dropEffect="copy";}} onDrop={insertAtCanvasPoint}>
          <div className="designer-infinite-plane" aria-hidden="true"/>
          {rulers&&<><div className="designer-ruler-corner"/><div className="designer-ruler horizontal" onPointerDown={(event)=>addGuide("vertical",event)}>{Array.from({length:Math.ceil(width/100)+1},(_,index)=><span style={{left:index*100*zoom/100}} key={index}>{index*100}</span>)}</div><div className="designer-ruler vertical" onPointerDown={(event)=>addGuide("horizontal",event)}>{Array.from({length:10},(_,index)=><span style={{top:index*100*zoom/100}} key={index}>{index*100}</span>)}</div></>}
          {!compare?<div className="designer-artboard-stage" style={{width:width*zoom/100,height:ARTBOARD_HEIGHT*zoom/100,marginTop:rulers?24:0,marginLeft:rulers?24:0}}>
            <div className="designer-artboard" style={{width,height:ARTBOARD_HEIGHT,transform:`scale(${zoom/100})`}} data-grid={grid||undefined}>
              {frameUrl&&<iframe ref={frame} src={frameUrl} title="프로젝트 미리보기" allow="cross-origin-isolated" sandbox="allow-scripts allow-same-origin allow-forms allow-modals"/>}
            </div>
            {verticalGuides.map((value,index)=><button type="button" className="designer-guide vertical" style={{left:value*zoom/100}} key={`v-${index}-${value}`} title="더블 클릭하여 가이드 삭제" onDoubleClick={()=>setVerticalGuides(current=>current.filter((_,i)=>i!==index))}/>) }
            {horizontalGuides.map((value,index)=><button type="button" className="designer-guide horizontal" style={{top:value*zoom/100}} key={`h-${index}-${value}`} title="더블 클릭하여 가이드 삭제" onDoubleClick={()=>setHorizontalGuides(current=>current.filter((_,i)=>i!==index))}/>) }
          </div>:<ResponsiveCompare frameUrl={frameUrl} token={token} previewState={stateRef.current}/>} 
          {workbenchItems.map(item=><button type="button" className={`designer-workbench-item${selectedWorkbenchId===item.id?" selected":""}`} style={{left:item.x,top:item.y,width:item.width,height:item.height}} key={item.id} draggable onClick={(event)=>{event.stopPropagation();setSelectedWorkbenchId(item.id);setSelected(null);setSelections([]);setRightTab("design");}} onDragStart={(event)=>{event.dataTransfer.effectAllowed="move";event.dataTransfer.setData("application/x-polazu-insert",item.kind);event.dataTransfer.setData("application/x-polazu-workbench",item.id);setDragInsert(item.kind);}} onDragEnd={()=>setDragInsert(null)}><DesignerIcon name="insert"/><strong>{item.kind}</strong><span>작업대 · 자동 저장 · 코드 미반영</span></button>)}
          {stage!=="ready"&&<RuntimeOverlay stage={stage} status={status} showLogs={()=>setShowLogs(true)} retry={()=>void restartRuntime()}/>}
        </div>
        <CanvasControlDock width={width} setWidth={(value)=>{flushInspector();setWidth(value);setCompare(false);}} zoom={zoom} setZoom={setZoom} fitCanvas={fitCanvas} fitSelection={fitSelection} canFitSelection={!!selected} grid={grid} rulers={rulers} snap={snap} compare={compare} wireframe={wireframe} toggleCompare={toggleResponsiveCompare} toggleWireframe={()=>setWireframe(value=>!value)} toggleGrid={()=>setGrid(value=>!value)} toggleRulers={()=>setRulers(value=>!value)} toggleSnap={()=>setSnap(value=>!value)}/>
        {dragInsert&&<div className="designer-drop-surface"><div><DesignerIcon name="insert"/><strong>Drop {dragInsert}</strong><span>페이지 안: 코드 자동 저장 · 바깥 작업대: 프로젝트에 보관</span></div></div>}
        <footer className="designer-statusbar"><div><span className={`designer-status-dot ${stage==="ready"?"online":stage==="error"?"error":""}`}/><strong>{stageLabels[stage]}</strong><span>{saving?"서버 저장 중…":notice||(mode==="edit"?"요소를 선택하거나 도구를 사용하세요.":"실제 링크와 인터랙션을 확인하는 Preview 모드입니다.")}</span></div><div><span>{width} × {ARTBOARD_HEIGHT}</span><span>{zoom}%</span><span>{selected?.sourceId?"source linked":selected?"selector only":"no selection"}</span><button type="button" onClick={()=>setShowLogs(value=>!value)}><DesignerIcon name="code"/>Logs</button><button type="button" title="런타임 다시 실행" onClick={()=>void restartRuntime()}>↻</button></div></footer>
        {showLogs&&<div className="designer-console"><header><strong>Runtime logs</strong><div><button type="button" onClick={()=>download("polazu-runtime.log",logs,"text/plain")}>Download</button><button type="button" onClick={()=>setShowLogs(false)}><DesignerIcon name="close"/></button></div></header><pre>{logs||"실행 환경을 준비하고 있습니다."}</pre></div>}
      </main>
      <div className={`designer-panel-resizer right${rightCollapsed?" collapsed":""}`} onPointerDown={(event)=>!rightCollapsed&&startPanelResize("right",event)}><button type="button" aria-label={rightCollapsed?"오른쪽 패널 열기":"오른쪽 패널 접기"} onPointerDown={(event)=>event.stopPropagation()} onClick={()=>setRightCollapsed(value=>!value)}><DesignerIcon name="chevron"/></button></div>
      {!rightCollapsed&&<aside className="designer-right-panel" aria-label="디자인 속성 패널"><nav className="designer-right-tabs">{([['design','Design','design'],['css','CSS','palette'],['logic','Logic','code'],['audit','Audit','audit']] as [DesignerRightTab,string,Parameters<typeof DesignerIcon>[0]['name']][]).map(([id,label,icon])=><button type="button" key={id} className={rightTab===id?"active":""} onClick={()=>switchRightTab(id)}><DesignerIcon name={icon}/><span>{label}</span>{id==="audit"&&auditIssues.length>0&&<i>{auditIssues.length}</i>}</button>)}</nav>
        <div className="designer-right-body">{rightTab==="audit"?<AuditPanel issues={auditIssues} checked={auditChecked} run={()=>send("command",{command:"audit"})} select={(selector)=>selectLayer(selector)}/>:rightTab==="css"?<CodePanel title="CSS 스타일" description="디자이너가 필요한 선택자, 애니메이션과 반응형 스타일을 직접 조정할 수 있습니다." empty="이 프로젝트에서 CSS 스타일 파일을 찾지 못했습니다." files={filePaths.filter(file=>/\.(css|scss|sass|less)$/i.test(file))} selectedFile={selectedFile} chooseFile={chooseFile} value={codeText} setValue={setCodeText} save={()=>void saveCode()} saving={saving} readOnly={readOnly}/>:rightTab==="logic"?<CodePanel title="간단한 동작" description="클릭, 열기/닫기, 탭 전환 같은 브라우저 동작을 JavaScript로 조정할 수 있습니다." empty="이 프로젝트에서 JavaScript 또는 TypeScript 파일을 찾지 못했습니다." createLabel="간단한 동작 파일 만들기" create={()=>void createLogicFile()} files={filePaths.filter(file=>/\.(js|jsx|ts|tsx)$/i.test(file))} selectedFile={selectedFile} chooseFile={chooseFile} value={codeText} setValue={setCodeText} save={()=>void saveCode()} saving={saving} readOnly={readOnly}/>:selectedWorkbench?<WorkbenchInspector item={selectedWorkbench} update={(changes)=>setWorkbenchItems(current=>current.map(item=>item.id===selectedWorkbench.id?{...item,...changes}:item))} remove={()=>{setWorkbenchItems(current=>current.filter(item=>item.id!==selectedWorkbench.id));setSelectedWorkbenchId(null);}}/>:<DesignerInspector selection={selected} selections={selections} breadcrumbs={breadcrumbs} draft={draft} attributes={attributeDraft} text={text} responsive={responsive} setResponsive={setResponsive} changeStyle={changeStyle} changeAttribute={changeAttribute} changeText={changeText} apply={()=>{if(!flushInspector())setNotice("기록할 새 속성 변경이 없습니다.");}} selectBreadcrumb={(selector)=>selectLayer(selector)} command={designerCommand} readOnly={readOnly} fonts={projectFonts} tokens={designTokens}/>}</div>
        <div className="designer-right-foot"><span>r{project.revision??"local"}</span><span>{dirtyCount ? `${dirtyCount} pending` : "synced"}</span><button type="button" onClick={()=>download("polazu-designer-review.json",JSON.stringify({version:2,source:project.source,edits:pendingInspector?[...edits,pendingInspector]:edits,rules},null,2))}>Review JSON ↗</button></div>
      </aside>}
    </div>
    <CommandPalette open={commandOpen} onClose={()=>setCommandOpen(false)} commands={commands}/>
    <ShortcutDialog open={helpOpen} onClose={()=>setHelpOpen(false)}/>
  </div>;
}

function RuntimeOverlay({stage,status,showLogs,retry}:{stage:Stage;status:string;showLogs:()=>void;retry:()=>void}){
  return <div className="designer-runtime-overlay" role="status"><span className={stage==="error"?"designer-runtime-error":"designer-runtime-spinner"}>{stage==="error"?"!":""}</span><h2>{stageLabels[stage]}</h2><p>{status}</p><div>{["boot","install","start","loading","ready"].map((value,index)=><i key={value} className={["boot","install","start","loading","ready"].indexOf(stage)>=index?"done":""}/>)}</div><button type="button" onClick={showLogs}>실행 로그 보기</button>{stage==="error"&&<button type="button" onClick={retry}>다시 실행</button>}</div>;
}
function ResponsiveCompare({frameUrl,token,previewState}:{frameUrl:string;token:string;previewState:Record<string,unknown>}){
  const frames=useRef<(HTMLIFrameElement|null)[]>([]);
  const state=useRef(previewState);state.current=previewState;
  useEffect(()=>{
    if(!frameUrl)return;
    const origin=frameUrl.startsWith("blob:")?"*":new URL(frameUrl).origin;
    const documents=new WeakMap<Window,string>();
    const syncFrame=(target:Window)=>target.postMessage({source:"polazu-editor",token,type:"sync",...state.current,mode:"preview",tool:"select"},origin);
    const ready=(event:MessageEvent)=>{if(event.data?.source!=="polazu-preview"||event.data.token!==token||event.data.type!=="ready"||typeof event.data.documentId!=="string")return;for(const frame of frames.current){const target=frame?.contentWindow;if(target===event.source&&target&&documents.get(target)!==event.data.documentId){documents.set(target,event.data.documentId);syncFrame(target);}}};
    window.addEventListener("message",ready);for(const frame of frames.current)if(frame?.contentWindow)syncFrame(frame.contentWindow);
    return()=>window.removeEventListener("message",ready);
  },[frameUrl,token]);
  const viewports=[{label:"Mobile",width:390},{label:"Tablet",width:768},{label:"Desktop",width:1100}];
  return <div className="designer-responsive-compare">{viewports.map((viewport,index)=><article key={viewport.width}><header><span>{viewport.label}</span><small>{viewport.width}px</small></header><div style={{width:viewport.width,height:ARTBOARD_HEIGHT,transform:`scale(${viewport.width===1100?.48:viewport.width===768?.58:.72})`}}>{frameUrl&&<iframe ref={element=>{frames.current[index]=element;}} src={frameUrl} title={`${viewport.label} 반응형 미리보기`} sandbox="allow-scripts allow-same-origin allow-forms" tabIndex={-1}/>}</div></article>)}</div>;
}
function WorkbenchInspector({item,update,remove}:{item:WorkbenchItem;update:(changes:Partial<WorkbenchItem>)=>void;remove:()=>void}){
  const number=(value:string,fallback:number)=>Number.isFinite(Number(value))?Number(value):fallback;
  return <section className="designer-workbench-inspector"><header><div><small>WORKBENCH OBJECT</small><h2>{item.kind}</h2></div><span>코드 미반영</span></header><p>무한 작업대 좌표와 크기는 프로젝트를 다시 열어도 복원됩니다. 페이지 프레임 안으로 드래그하면 실제 UI 요소로 변환됩니다.</p><div className="designer-workbench-fields"><label>X<input value={Math.round(item.x)} onChange={event=>update({x:number(event.target.value,item.x)})}/></label><label>Y<input value={Math.round(item.y)} onChange={event=>update({y:number(event.target.value,item.y)})}/></label><label>W<input value={Math.round(item.width)} onChange={event=>update({width:Math.max(24,number(event.target.value,item.width))})}/></label><label>H<input value={Math.round(item.height)} onChange={event=>update({height:Math.max(24,number(event.target.value,item.height))})}/></label></div><button type="button" className="designer-workbench-remove" onClick={remove}>작업대에서 제거</button></section>;
}
function CodePanel({title,description,empty,createLabel,create,files,selectedFile,chooseFile,value,setValue,save,saving,readOnly,sourceId}:{title:string;description:string;empty:string;createLabel?:string;create?:()=>void;files:string[];selectedFile:string;chooseFile:(path:string)=>void;value:string;setValue:(value:string)=>void;save:()=>void;saving:boolean;readOnly:boolean;sourceId?:string}){
  if(!files.length)return <section className="designer-code-panel designer-code-empty"><header><div><strong>{title}</strong><p>{description}</p></div></header><div><DesignerIcon name="info"/><strong>{empty}</strong><span>프로젝트 파일 구성을 확인하거나 아래 버튼으로 시작할 수 있습니다.</span>{create&&<button type="button" disabled={readOnly||saving} onClick={create}><DesignerIcon name="plus"/>{createLabel}</button>}</div></section>;
  const bytes=new TextEncoder().encode(value).length;const lines=value.split("\n").length;
  const activeFile=files.includes(selectedFile)?selectedFile:files[0];
  return <section className="designer-code-panel"><header><div><strong>{title}</strong><p>{description}</p></div><label><span>File</span><select value={activeFile} onChange={(event)=>chooseFile(event.target.value)}>{files.map((file)=><option value={file} key={file}>{file}</option>)}</select></label>{sourceId&&<small>{sourceId}</small>}</header><div className="designer-code-area"><div aria-hidden="true">{Array.from({length:lines},(_,index)=><span key={index}>{index+1}</span>)}</div><textarea aria-label={`${title} 편집`} value={value} onChange={(event)=>setValue(event.target.value)} readOnly={readOnly} spellCheck={false}/></div><footer><span>{lines.toLocaleString()} lines · {bytes.toLocaleString()} bytes</span><button type="button" disabled={saving||readOnly||!activeFile} onClick={save}><DesignerIcon name="save"/>{saving?"저장 중…":"저장하고 미리보기"}</button></footer><p>저장한 변경은 현재 프로젝트 revision에 기록되고 미리보기가 다시 실행됩니다.</p></section>;
}
function MockPanel({value,setValue,apply,requests}:{value:string;setValue:(value:string)=>void;apply:()=>void;requests:string[]}){
  return <section className="designer-mock-panel"><header><h2>Client API mock</h2><p>브라우저의 fetch/XHR 요청만 가로챕니다.</p></header><textarea aria-label="API Mock JSON" value={value} onChange={(event)=>setValue(event.target.value)} spellCheck={false}/><button type="button" onClick={apply}><DesignerIcon name="check"/>Apply mock rules</button><div className="designer-request-log"><h3>Requests <span>{requests.length}</span></h3>{requests.length?requests.map((request,index)=><p key={`${request}-${index}`}>{request}</p>):<span>아직 캡처된 요청이 없습니다.</span>}</div></section>;
}
function AuditPanel({issues,checked,run,select}:{issues:AuditIssue[];checked:number;run:()=>void;select:(selector:string)=>void}){
  const counts={error:issues.filter(item=>item.severity==="error").length,warning:issues.filter(item=>item.severity==="warning").length,info:issues.filter(item=>item.severity==="info").length};
  return <section className="designer-audit-panel"><header><div><h2>Quality audit</h2><p>{checked?`${checked}개 요소 검사`:"현재 페이지의 접근성·넘침·중복 ID를 검사합니다."}</p></div><button type="button" onClick={run}><DesignerIcon name="audit"/>Run</button></header><div className="designer-audit-summary"><span className="error">{counts.error}<small>Errors</small></span><span className="warning">{counts.warning}<small>Warnings</small></span><span className="info">{counts.info}<small>Info</small></span></div><div className="designer-audit-list">{issues.length?issues.map((issue)=><button type="button" key={issue.id} onClick={()=>issue.selector&&select(issue.selector)}><DesignerIcon name={issue.severity==="error"?"warning":issue.severity==="warning"?"warning":"info"}/><span><strong>{issue.message}</strong><small>{issue.rule}{issue.selector?` · ${issue.selector}`:""}</small></span></button>):<div className="designer-audit-empty"><DesignerIcon name="check"/><strong>검사를 실행하세요</strong><p>자동 검사는 보조 수단이며 키보드 이동, 문맥, 스크린리더 경험은 수동 확인이 필요합니다.</p></div>}</div></section>;
}

function buildInspectorEdit(selected:Selection|null,path:string,responsive:ResponsiveTarget,draft:Record<string,string>,attributes:Record<string,string>,text:string,touchedStyles:Record<string,true>,touchedAttributes:Record<string,true>,textTouched:boolean):Edit|null{
  if(!selected)return null;const styles=Object.fromEntries(Object.keys(touchedStyles).map(name=>[name,draft[name]??""]));
  const baseContent=responsive==="base";const attrs=baseContent?Object.fromEntries(Object.keys(touchedAttributes).map(name=>[name,attributes[name]??""])):{};
  const hasText=baseContent&&textTouched&&selected.editableText;
  if(!Object.keys(styles).length&&!Object.keys(attrs).length&&!hasText)return null;
  return{id:crypto.randomUUID(),path,selector:selected.selector,sourceId:selected.sourceId,generatedId:selected.generatedId,responsive,styles:Object.keys(styles).length?styles:undefined,attributes:Object.keys(attrs).length?attrs:undefined,text:hasText?text:undefined};
}
function isSelection(value:unknown):value is Selection{return!!value&&typeof value==="object"&&typeof (value as Selection).selector==="string"&&typeof (value as Selection).tag==="string";}
function scanProjectFonts(files:Record<string,string>){const fonts=new Set<string>();for(const [path,source] of Object.entries(files)){if(!/\.(css|scss|sass|less)$/i.test(path))continue;for(const match of source.matchAll(/font-family\s*:\s*([^;}{]+)/gi)){for(const family of match[1].split(",")){const value=family.trim().replace(/^['\"]|['\"]$/g,"");if(value&&!/^(inherit|initial|unset|serif|sans-serif|monospace|system-ui)$/i.test(value))fonts.add(value);}}}return[...fonts].sort((a,b)=>a.localeCompare(b));}
function findHtmlForRoute(route:string,files:Record<string,string>):{path:string;content:string}|null{
  const clean=route.split(/[?#]/)[0]||"/";const normalized=clean==="/"?"":clean.replace(/^\//,"").replace(/\/$/,"");
  const candidates=[normalized?`/${normalized}.html`:"/index.html",normalized?`/${normalized}/index.html`:"/public/index.html",normalized?`/${normalized}`:"/index.htm"];
  for(const candidate of candidates)if(typeof files[candidate]==="string")return{path:candidate,content:files[candidate]};
  const first=Object.keys(files).find(file=>file.toLowerCase().endsWith(".html"));return first?{path:first,content:files[first]}:null;
}

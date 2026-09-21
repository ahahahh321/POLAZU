"use client";

import { useState } from "react";
import type { DesignerTool } from "../../_lib/types";
import DesignerIcon, { type DesignerIconName } from "./DesignerIcon";

type WorkspaceTab = "activity" | "versions" | "review" | "team" | "git";

type TopbarProps = {
  mode: "edit" | "preview";
  setMode: (mode: "edit" | "preview") => void;
  pathInput: string;
  setPathInput: (value: string) => void;
  navigate: (value: string) => void;
  canNavigate: boolean;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  openCommands: () => void;
  openHelp: () => void;
  save: () => void;
  saving: boolean;
  dirtyCount: number;
  readOnly: boolean;
  projectName?: string;
  branch?: string;
  revision?: number;
  publishedRevision?: number;
  role?: string;
  presence?: { userId:number; name:string; nickname:string; location:string; lastSeenAt:string }[];
  openWorkspace?: (tab: WorkspaceTab) => void;
};

export function DesignerTopbar(props: TopbarProps) {
  const unpublished = Math.max(0, (props.revision ?? 0) - (props.publishedRevision ?? 0));
  return <header className="designer-topbar">
    <div className="designer-product-area">
      <a className="designer-product-mark" href="/projects" aria-label="프로젝트 목록">P</a>
      <button type="button" className="designer-project-switcher" onClick={() => window.location.assign("/projects")}>
        <span>{props.projectName || "Untitled project"}</span>
        <small><DesignerIcon name="branch"/>{props.branch || "main"}</small>
      </button>
    </div>

    <div className="designer-mode-switch" role="group" aria-label="에디터 모드">
      <button type="button" className={props.mode === "edit" ? "active" : ""} onClick={() => props.setMode("edit")}><DesignerIcon name="design"/><span>Design</span></button>
      <button type="button" className={props.mode === "preview" ? "active" : ""} onClick={() => props.setMode("preview")}><DesignerIcon name="play"/><span>Preview</span></button>
    </div>

    <form className="designer-path" onSubmit={(event) => { event.preventDefault(); props.navigate(props.pathInput); }}>
      <DesignerIcon name="pages"/>
      <input aria-label="페이지 경로" value={props.pathInput} onChange={(event) => props.setPathInput(event.target.value)} spellCheck={false}/>
      <button type="submit" disabled={!props.canNavigate} title="경로 열기">↵</button>
    </form>

    <div className="designer-spacer"/>
    <div className="designer-history" role="group" aria-label="변경 이력">
      <IconButton icon="undo" label="실행 취소" shortcut="Ctrl+Z" disabled={!props.canUndo} onClick={props.undo}/>
      <IconButton icon="redo" label="다시 실행" shortcut="Ctrl+Shift+Z" disabled={!props.canRedo} onClick={props.redo}/>
    </div>
    <button type="button" className="designer-command-trigger" aria-label="빠른 명령 검색" title="빠른 명령 검색 (Ctrl+K)" onClick={props.openCommands}><DesignerIcon name="command"/><span>Quick actions</span><kbd>Ctrl+K</kbd></button>
    <IconButton icon="help" label="단축키 도움말" shortcut="?" onClick={props.openHelp}/>

    <button type="button" className="designer-presence" aria-label={`공동 작업자 ${props.presence?.length ?? 0}명 열기`} title={props.presence?.length ? props.presence.map((person) => person.nickname || person.name).join(", ") : "현재 접속한 팀원 없음"} onClick={() => props.openWorkspace?.("team")}>
      {(props.presence ?? []).slice(0, 3).map((person) => <span key={person.userId} aria-hidden="true">{initials(person.nickname || person.name)}</span>)}
      {(props.presence?.length ?? 0) > 3 && <span className="more">+{(props.presence?.length ?? 0) - 3}</span>}
      {!props.presence?.length && <span className="empty"><DesignerIcon name="users"/></span>}
    </button>
    <button type="button" className="designer-review-button" aria-label="검토 및 댓글" onClick={() => props.openWorkspace?.("review")}><DesignerIcon name="comment"/><span>Review</span></button>
    <button type="button" className={`designer-sync-state${props.dirtyCount ? " is-dirty" : ""}${props.saving ? " is-saving" : ""}`} disabled={props.readOnly || props.saving || props.dirtyCount === 0} onClick={props.save} title={props.dirtyCount ? "자동 저장 전에 지금 동기화" : "서버 공동 작업 초안과 동기화됨"}>
      <span className="designer-sync-dot"/>
      <span>{props.readOnly ? "View only" : props.saving ? "Autosaving…" : props.dirtyCount ? `Autosave · ${props.dirtyCount}` : `Saved · r${props.revision ?? "local"}`}</span>
    </button>
    <button type="button" className="designer-publish-button" onClick={() => props.openWorkspace?.("git")}><DesignerIcon name="up"/><span>Publish</span>{unpublished > 0 && <i>{unpublished}</i>}</button>
  </header>;
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return Array.from(parts[0]).slice(0, 2).join("").toUpperCase();
  return `${Array.from(parts[0])[0] ?? ""}${Array.from(parts.at(-1) ?? "")[0] ?? ""}`.toUpperCase();
}

type CanvasControlDockProps = {
  width: number;
  setWidth: (value: number) => void;
  zoom: number;
  setZoom: (value: number) => void;
  fitCanvas: () => void;
  fitSelection?: () => void;
  canFitSelection?: boolean;
  grid: boolean;
  rulers: boolean;
  snap: boolean;
  compare: boolean;
  wireframe: boolean;
  toggleCompare: () => void;
  toggleWireframe: () => void;
  toggleGrid: () => void;
  toggleRulers: () => void;
  toggleSnap: () => void;
};

const VIEWPORTS = [
  { value: 1440, label: "Wide", icon:"desktop" as const },
  { value: 1100, label: "Desktop", icon:"desktop" as const },
  { value: 768, label: "Tablet", icon:"tablet" as const },
  { value: 390, label: "Mobile", icon:"mobile" as const },
];

export function CanvasControlDock(props: CanvasControlDockProps) {
  const [viewOptions,setViewOptions] = useState(false);
  const currentViewport = VIEWPORTS.find((item) => item.value === props.width) ?? VIEWPORTS[1];
  return <div className="designer-canvas-control-dock" role="toolbar" aria-label="캔버스 보기 설정">
    <div className="designer-pop-select">
      <DesignerIcon name={currentViewport.icon}/>
      <select aria-label="화면 크기" value={props.width} onChange={(event) => props.setWidth(Number(event.target.value))}>
        {VIEWPORTS.map((item) => <option value={item.value} key={item.value}>{item.label} · {item.value}</option>)}
      </select>
    </div>
    <i className="designer-control-separator"/>
    <div className="designer-view-options">
      <button type="button" aria-label="캔버스 보기 옵션" aria-expanded={viewOptions} onClick={()=>setViewOptions(value=>!value)}><DesignerIcon name="grid"/></button>
      {viewOptions&&<div className="designer-view-options-menu" role="group" aria-label="보기 옵션">
        <button type="button" aria-pressed={props.compare} onClick={props.toggleCompare}>반응형 나란히 보기 <span>{props.compare?"✓":""}</span></button>
        <button type="button" aria-pressed={props.wireframe} onClick={props.toggleWireframe}>와이어프레임 <span>{props.wireframe?"✓":""}</span></button>
        <button type="button" aria-pressed={props.rulers} onClick={props.toggleRulers}>눈금자 <span>{props.rulers?"✓":""}</span></button>
        <button type="button" aria-pressed={props.grid} onClick={props.toggleGrid}>격자 <span>{props.grid?"✓":""}</span></button>
        <button type="button" aria-pressed={props.snap} onClick={props.toggleSnap}>스냅 <span>{props.snap?"✓":""}</span></button>
      </div>}
    </div>
    <div className="designer-zoom">
      <button type="button" title="축소" onClick={() => props.setZoom(Math.max(20, props.zoom - 10))}><DesignerIcon name="minus"/></button>
      <input aria-label="캔버스 배율" title="배율 입력 후 Enter · 20–200%" key={Math.round(props.zoom)} defaultValue={`${Math.round(props.zoom)}%`} onFocus={event=>event.currentTarget.select()} onKeyDown={event=>{event.stopPropagation();if(event.key==="Enter")event.currentTarget.blur();if(event.key==="Escape"){event.currentTarget.value=`${Math.round(props.zoom)}%`;event.currentTarget.blur();}}} onBlur={event=>{const next=parseFloat(event.currentTarget.value);if(Number.isFinite(next))props.setZoom(Math.max(20,Math.min(200,next)));else event.currentTarget.value=`${Math.round(props.zoom)}%`;}}/>
      <button type="button" title="확대" onClick={() => props.setZoom(Math.min(200, props.zoom + 10))}><DesignerIcon name="plus"/></button>
      <button type="button" title="선택 요소 맞춤 (2)" disabled={!props.canFitSelection} onClick={props.fitSelection}><DesignerIcon name="select"/></button>
      <button type="button" title="캔버스 맞춤 (0)" onClick={props.fitCanvas}><DesignerIcon name="fit"/></button>
    </div>
  </div>;
}

type ToolRailProps = { tool: DesignerTool; setTool: (tool: DesignerTool) => void; disabled?: boolean };
const TOOLS: { id: DesignerTool; icon: DesignerIconName; label: string; shortcut: string }[] = [
  { id:"select", icon:"select", label:"선택", shortcut:"V" },
  { id:"hand", icon:"hand", label:"손 도구", shortcut:"H" },
  { id:"frame", icon:"frame", label:"프레임 삽입", shortcut:"F" },
  { id:"text", icon:"text", label:"텍스트 삽입", shortcut:"T" },
  { id:"rectangle", icon:"rectangle", label:"사각형 삽입", shortcut:"R" },
  { id:"image", icon:"image", label:"이미지 자리 삽입", shortcut:"I" },
  { id:"comment", icon:"comment", label:"댓글 위치 선택", shortcut:"C" },
];

export function CanvasToolRail({ tool, setTool, disabled=false }: ToolRailProps) {
  return <div className="designer-tool-rail" role="toolbar" aria-label="캔버스 도구">
    {TOOLS.map((item, index) => <span className="designer-tool-wrap" key={item.id}>
      {index === 2 && <i className="designer-tool-separator"/>}
      <button type="button" className={tool === item.id ? "active" : ""} aria-pressed={tool === item.id} title={`${item.label} (${item.shortcut})`} disabled={disabled} onClick={() => setTool(item.id)}>
        <DesignerIcon name={item.icon}/><kbd>{item.shortcut}</kbd>
      </button>
    </span>)}
  </div>;
}

type SelectionToolbarProps = {
  count: number;
  command: (name: string) => void;
  readOnly?: boolean;
};
export function SelectionToolbar({ count, command, readOnly=false }: SelectionToolbarProps) {
  if (count < 1) return null;
  const disabled = readOnly;
  const multiDisabled = readOnly || count < 2;
  return <div className="designer-selection-toolbar" role="toolbar" aria-label="선택 요소 작업">
    <span className="designer-selection-count">{count === 1 ? "Selected" : `${count} selected`}</span>
    {count>1&&<div className="designer-context-group">
      <IconButton icon="alignLeft" label="왼쪽 정렬" disabled={multiDisabled} onClick={() => command("align-left")}/>
      <IconButton icon="alignCenter" label="가로 가운데 정렬" disabled={multiDisabled} onClick={() => command("align-center")}/>
      <IconButton icon="alignRight" label="오른쪽 정렬" disabled={multiDisabled} onClick={() => command("align-right")}/>
      <IconButton icon="alignTop" label="위쪽 정렬" disabled={multiDisabled} onClick={() => command("align-top")}/>
      <IconButton icon="alignMiddle" label="세로 가운데 정렬" disabled={multiDisabled} onClick={() => command("align-middle")}/>
      <IconButton icon="alignBottom" label="아래쪽 정렬" disabled={multiDisabled} onClick={() => command("align-bottom")}/>
      <IconButton icon="distributeH" label="가로 균등 분배" disabled={readOnly || count < 3} onClick={() => command("distribute-horizontal")}/>
      <IconButton icon="distributeV" label="세로 균등 분배" disabled={readOnly || count < 3} onClick={() => command("distribute-vertical")}/>
    </div>}
    <i className="designer-control-separator"/>
    <div className="designer-context-group">
      <IconButton icon="up" label="레이어 위로 이동" disabled={disabled} onClick={() => command("reorder-up")}/>
      <IconButton icon="down" label="레이어 아래로 이동" disabled={disabled} onClick={() => command("reorder-down")}/>
      <IconButton icon="duplicate" label="복제" shortcut="Ctrl+D" disabled={disabled} onClick={() => command("duplicate")}/>
      <IconButton icon="trash" label="삭제" shortcut="⌫" danger disabled={disabled} onClick={() => command("delete")}/>
    </div>
  </div>;
}

type IconButtonProps = {
  icon: DesignerIconName;
  label: string;
  shortcut?: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
};
export function IconButton({ icon, label, shortcut, active=false, danger=false, disabled=false, onClick }: IconButtonProps) {
  return <button type="button" className={`designer-icon-button${active ? " active" : ""}${danger ? " danger" : ""}`} aria-label={label} aria-pressed={active || undefined} title={shortcut ? `${label} (${shortcut})` : label} disabled={disabled} onClick={onClick}>
    <DesignerIcon name={icon}/>
  </button>;
}

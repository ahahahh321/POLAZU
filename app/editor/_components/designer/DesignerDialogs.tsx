"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DesignerIcon, { type DesignerIconName } from "./DesignerIcon";

export type CommandItem = {
  id: string;
  label: string;
  detail?: string;
  shortcut?: string;
  icon: DesignerIconName;
  keywords?: string;
  disabled?: boolean;
  action: () => void;
};

export function CommandPalette({ open, onClose, commands }: { open:boolean; onClose:()=>void; commands:CommandItem[] }) {
  const [query, setQuery] = useState("");
  const [active,setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQuery("");setActive(0); requestAnimationFrame(() => input.current?.focus()); } }, [open]);
  const filtered = useMemo(() => {
    const value = query.trim().toLowerCase();
    return (value ? commands.filter((item) => `${item.label} ${item.detail ?? ""} ${item.keywords ?? ""}`.toLowerCase().includes(value)) : commands).filter(item=>!item.disabled);
  }, [commands, query]);
  useEffect(()=>{if(open)document.getElementById(`designer-command-${active}`)?.scrollIntoView({block:"nearest"});},[active,open]);
  if (!open) return null;
  return <div className="designer-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="designer-command-dialog" role="dialog" aria-modal="true" aria-label="명령 검색">
      <header><DesignerIcon name="search"/><input ref={input} role="combobox" aria-label="빠른 명령 검색" aria-expanded="true" aria-controls="designer-command-results" aria-activedescendant={filtered.length?`designer-command-${active}`:undefined} value={query} onChange={(event) => {setQuery(event.target.value);setActive(0);}} placeholder="명령, 도구 또는 패널 검색…" onKeyDown={(event) => {if(["ArrowDown","ArrowUp","Enter","Escape"].includes(event.key)){event.preventDefault();event.stopPropagation();}if(event.key==="ArrowDown")setActive(value=>Math.min(filtered.length-1,value+1));if(event.key==="ArrowUp")setActive(value=>Math.max(0,value-1));if (event.key === "Escape") onClose(); if (event.key === "Enter") { const item=filtered[Math.max(0,active)]; if (item) { item.action(); onClose(); } } }}/><kbd>ESC</kbd></header>
      <div className="designer-command-list" role="listbox" id="designer-command-results">{filtered.length ? filtered.map((item,index) => <button type="button" role="option" aria-selected={index===active} className={index===active?"active":""} id={`designer-command-${index}`} key={item.id} onMouseEnter={()=>setActive(index)} onClick={() => { item.action(); onClose(); }}><span className="designer-command-icon"><DesignerIcon name={item.icon}/></span><span><strong>{item.label}</strong>{item.detail && <small>{item.detail}</small>}</span>{item.shortcut && <kbd>{item.shortcut.replaceAll("⌘","Ctrl+")}</kbd>}</button>) : <div className="designer-command-empty">일치하는 명령이 없습니다.</div>}</div>
      <footer><span><kbd>↑↓</kbd> 탐색</span><span><kbd>↵</kbd> 실행</span><span><kbd>esc</kbd> 닫기</span></footer>
    </section>
  </div>;
}

export function ShortcutDialog({ open, onClose }: { open:boolean; onClose:()=>void }) {
  if (!open) return null;
  const groups = [
    { title:"Tools", items:[["V","선택"],["H","손 도구"],["F","프레임"],["T","텍스트"],["R","사각형"],["I","이미지"],["C","댓글 위치"]] },
    { title:"Edit", items:[["Ctrl Z","실행 취소"],["Ctrl Shift Z / Ctrl Y","다시 실행"],["Ctrl D","복제"],["Delete","삭제"],["Ctrl C / Ctrl V","복사 / 붙여넣기"],["↑ ↓ ← →","1px 이동"],["Shift + 방향키","10px 이동"],["Enter / Esc","안쪽 선택 / 바깥 선택"],["Tab","다음 레이어"]] },
    { title:"View", items:[["Space + 드래그","캔버스 이동"],["Ctrl + 휠","캔버스 확대 / 축소"],["Ctrl K","명령 검색"],["Ctrl S","저장"],["Shift 1 / 0","캔버스 맞춤"],["Shift 2 / 2","선택 맞춤"],["1","100%"],["Ctrl \\","패널 숨기기 / 표시"],["G","격자"],["Shift R","눈금자"]] },
  ];
  return <div className="designer-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="designer-shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="designer-shortcuts-title">
      <header><div><span><DesignerIcon name="command"/></span><div><h2 id="designer-shortcuts-title">Keyboard shortcuts</h2><p>캔버스에서 빠르게 작업하는 기본 키</p></div></div><button type="button" onClick={onClose}><DesignerIcon name="close"/></button></header>
      <div className="designer-shortcut-groups">{groups.map((group) => <section key={group.title}><h3>{group.title}</h3>{group.items.map(([keys,label]) => <div key={keys}><span>{label}</span><kbd>{keys}</kbd></div>)}</section>)}</div>
    </section>
  </div>;
}

export function ConfirmDialog({ open, title, detail, confirmLabel="확인", danger=false, onConfirm, onClose }: { open:boolean; title:string; detail:string; confirmLabel?:string; danger?:boolean; onConfirm:()=>void; onClose:()=>void }) {
  if (!open) return null;
  return <div className="designer-dialog-backdrop" role="presentation"><section className="designer-confirm-dialog" role="alertdialog" aria-modal="true"><span><DesignerIcon name={danger ? "warning" : "info"}/></span><h2>{title}</h2><p>{detail}</p><div><button type="button" onClick={onClose}>취소</button><button type="button" className={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button></div></section></div>;
}

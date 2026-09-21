"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, KeyboardEvent } from "react";
import type { ProjectAsset } from "../../_lib/assets";
import type { DesignToken, DesignTokenCategory } from "../../_lib/design-tokens";
import type { Layer, Selection } from "../../_lib/types";
import DesignerIcon, { type DesignerIconName } from "./DesignerIcon";
import styles from "./DesignerSidebar.module.css";

export type DesignerLeftTab = "layers" | "insert" | "assets" | "tokens" | "pages" | "files";

type Props = {
  tab: DesignerLeftTab;
  setTab: (tab: DesignerLeftTab) => void;
  layers: Layer[];
  selections: Selection[];
  selectLayer: (selector: string, additive?: boolean) => void;
  command: (command: string, payload?: Record<string, unknown>) => void;
  pages: string[];
  currentPath: string;
  navigate: (path: string) => void;
  files: string[];
  selectedFile: string;
  chooseFile: (path: string) => void;
  fileQuery: string;
  setFileQuery: (value: string) => void;
  roots: string[];
  root: string;
  setRoot: (value: string) => void;
  planName: string;
  planNotes: string[];
  isNext: boolean;
  nextUI: boolean;
  setNextUI: (value: boolean) => void;
  tokens: DesignToken[];
  updateToken: (token: DesignToken, value: string) => Promise<boolean>;
  assets: ProjectAsset[];
  assetBaseUrl?: string;
  uploadAsset: (file: File) => Promise<boolean>;
  useAsset: (asset: ProjectAsset) => void;
  canUseAsset?: boolean;
  tokenSaving?: boolean;
  readOnly?: boolean;
};

const tabs: { id: DesignerLeftTab; label: string; icon: DesignerIconName }[] = [
  { id: "layers", label: "Layers", icon: "layers" },
  { id: "insert", label: "Insert", icon: "insert" },
  { id: "assets", label: "Assets", icon: "image" },
  { id: "tokens", label: "Tokens", icon: "palette" },
  { id: "pages", label: "Pages", icon: "pages" },
  { id: "files", label: "Files", icon: "files" },
];

type InsertKind = "frame" | "section" | "container" | "v-stack" | "h-stack" | "text" | "heading" | "quote" | "rich-text" | "rectangle" | "image" | "video" | "button" | "link" | "input" | "textarea" | "select" | "checkbox" | "radio" | "switch" | "form" | "search" | "badge" | "avatar" | "card" | "list" | "table" | "navbar" | "tabs" | "accordion" | "dropdown" | "slider" | "modal" | "toast" | "skeleton" | "divider" | "hero" | "feature-grid" | "pricing" | "contact" | "footer";
const INSERT_GROUPS: { title: string; items: { kind: InsertKind; label: string; description: string; icon: DesignerIconName }[] }[] = [
  { title: "Wireframe sections", items: [
    { kind:"hero", label:"Hero", description:"Headline, copy and actions", icon:"frame" },
    { kind:"feature-grid", label:"Features", description:"Three feature cards", icon:"grid" },
    { kind:"pricing", label:"Pricing", description:"Three pricing plans", icon:"rectangle" },
    { kind:"contact", label:"Contact", description:"Contact copy and form", icon:"comment" },
    { kind:"footer", label:"Footer", description:"Brand and link groups", icon:"pages" },
  ]},
  { title: "Layout", items: [
    { kind:"frame", label:"Frame", description:"Flex container", icon:"frame" },
    { kind:"section", label:"Section", description:"Full-width page region", icon:"frame" },
    { kind:"container", label:"Container", description:"Centered content width", icon:"rectangle" },
    { kind:"v-stack", label:"V Stack", description:"Vertical auto layout", icon:"layers" },
    { kind:"h-stack", label:"H Stack", description:"Horizontal auto layout", icon:"layers" },
    { kind:"card", label:"Card", description:"Content surface", icon:"rectangle" },
    { kind:"navbar", label:"Navigation", description:"Header navigation", icon:"pages" },
    { kind:"divider", label:"Divider", description:"Section rule", icon:"minus" },
  ]},
  { title: "Content", items: [
    { kind:"heading", label:"Heading", description:"Section heading", icon:"text" },
    { kind:"text", label:"Text", description:"Editable paragraph", icon:"text" },
    { kind:"quote", label:"Quote", description:"Quotation and source", icon:"text" },
    { kind:"rich-text", label:"Rich Text", description:"Heading, copy and list", icon:"text" },
    { kind:"image", label:"Image", description:"Replaceable image", icon:"image" },
    { kind:"video", label:"Video", description:"Responsive video surface", icon:"play" },
    { kind:"avatar", label:"Avatar", description:"Profile image", icon:"image" },
    { kind:"badge", label:"Badge", description:"Status label", icon:"rectangle" },
    { kind:"rectangle", label:"Rectangle", description:"Shape block", icon:"rectangle" },
  ]},
  { title: "Forms", items: [
    { kind:"button", label:"Button", description:"Interactive action", icon:"play" },
    { kind:"link", label:"Link", description:"Navigation text", icon:"link" },
    { kind:"input", label:"Input", description:"Labeled text field", icon:"insert" },
    { kind:"textarea", label:"Textarea", description:"Multiline field", icon:"insert" },
    { kind:"select", label:"Select", description:"Option menu", icon:"chevron" },
    { kind:"checkbox", label:"Checkbox", description:"Boolean choice", icon:"check" },
    { kind:"radio", label:"Radio", description:"Single choice", icon:"check" },
    { kind:"switch", label:"Switch", description:"Toggle control", icon:"snap" },
    { kind:"form", label:"Form", description:"Accessible form group", icon:"insert" },
    { kind:"search", label:"Search", description:"Search field and action", icon:"search" },
  ]},
  { title: "Data & feedback", items: [
    { kind:"list", label:"List", description:"Repeated content", icon:"layers" },
    { kind:"table", label:"Table", description:"Structured data", icon:"grid" },
    { kind:"tabs", label:"Tabs", description:"Tabbed content", icon:"pages" },
    { kind:"accordion", label:"Accordion", description:"Disclosure group", icon:"chevron" },
    { kind:"dropdown", label:"Dropdown", description:"Menu disclosure", icon:"chevron" },
    { kind:"slider", label:"Slider", description:"Horizontal card track", icon:"pages" },
    { kind:"modal", label:"Modal", description:"Dialog surface", icon:"rectangle" },
    { kind:"toast", label:"Toast", description:"Feedback message", icon:"comment" },
    { kind:"skeleton", label:"Skeleton", description:"Loading placeholder", icon:"more" },
  ]},
];

const TOKEN_GROUP_LABELS: Record<DesignTokenCategory, string> = {
  color:"Colors", spacing:"Spacing & size", typography:"Typography", radius:"Radius", effect:"Effects", other:"Other",
};

const INSERT_CATEGORY_LABELS: Record<string, string> = {
  "Wireframe sections":"페이지 섹션", Layout:"레이아웃", Content:"콘텐츠", Forms:"입력 · 액션", "Data & feedback":"데이터 · 피드백",
};
const INSERT_SEARCH_WORDS: Partial<Record<InsertKind, string>> = {
  frame:"프레임 컨테이너", section:"섹션 영역", container:"컨테이너 영역", "v-stack":"세로 스택 자동 레이아웃", "h-stack":"가로 스택 자동 레이아웃",
  text:"텍스트 글자 문단", heading:"제목 헤딩", quote:"인용문", "rich-text":"리치 텍스트 본문", rectangle:"사각형 도형", image:"이미지 사진", video:"영상 비디오",
  button:"버튼 액션", link:"링크", input:"입력 필드", textarea:"여러줄 입력", select:"선택 옵션", checkbox:"체크박스", radio:"라디오", switch:"토글 스위치", form:"폼 양식", search:"검색",
  badge:"배지 상태", avatar:"아바타 프로필", card:"카드", list:"목록 리스트", table:"테이블 표", navbar:"내비게이션 메뉴 헤더", tabs:"탭", accordion:"아코디언 접기", dropdown:"드롭다운 메뉴", slider:"슬라이더 캐러셀", modal:"모달 팝업 대화상자", toast:"토스트 알림", skeleton:"스켈레톤 로딩", divider:"구분선", hero:"히어로 메인 소개", "feature-grid":"기능 특장점", pricing:"요금 가격", contact:"문의 연락처", footer:"푸터 바닥글",
};
const INSERT_CONTAINERS = new Set(["body", "main", "section", "article", "aside", "header", "footer", "nav", "div", "form", "li", "ul", "ol", "td", "th"]);
const REPARENT_CONTAINERS = new Set(["body", "main", "section", "article", "aside", "header", "footer", "nav", "div", "form", "fieldset", "ul", "ol", "li", "figure", "blockquote", "details", "dialog"]);

function layerType(layer: Layer): { label:string; icon:DesignerIconName } {
  const tag = layer.tag.toLowerCase();
  if (/^(h[1-6]|p|span|label|strong|em|small|blockquote)$/.test(tag)) return { label:"Text", icon:"text" };
  if (tag === "img" || tag === "picture" || tag === "svg") return { label:"Image", icon:"image" };
  if (tag === "table" || /^(thead|tbody|tr|td|th)$/.test(tag)) return { label:"Table", icon:"grid" };
  if (tag === "button") return { label:"Button", icon:"play" };
  if (tag === "a") return { label:"Link", icon:"link" };
  if (/^(input|textarea|select|option|form)$/.test(tag)) return { label:tag === "form" ? "Form" : "Input", icon:"insert" };
  if (/^(ul|ol|li)$/.test(tag)) return { label:"List", icon:"layers" };
  if (tag === "video") return { label:"Video", icon:"play" };
  return { label:layer.childCount ? "Frame" : "Rectangle", icon:layer.childCount ? "frame" : "rectangle" };
}

export default function DesignerSidebar(props: Props) {
  const [layerQuery, setLayerQuery] = useState("");
  const [insertQuery, setInsertQuery] = useState("");
  const [insertCategory, setInsertCategory] = useState("all");
  const [recentInserts, setRecentInserts] = useState<InsertKind[]>([]);
  const [assetQuery, setAssetQuery] = useState("");
  const [assetBusy, setAssetBusy] = useState(false);
  const [tokenQuery, setTokenQuery] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [collapsedLayers, setCollapsedLayers] = useState<Set<string>>(() => new Set());
  const [focusedLayer, setFocusedLayer] = useState<string | null>(null);
  const [draggedLayer, setDraggedLayer] = useState<string | null>(null);
  const [layerDropTarget, setLayerDropTarget] = useState<string | null>(null);
  const layerRows = useRef(new Map<string, HTMLDivElement>());
  const renamingRef = useRef<string | null>(null);
  const selectedSelectors = useMemo(() => new Set(props.selections.map((item) => item.selector)), [props.selections]);
  const selectionKey = props.selections.map((item) => item.selector).join("\n");
  const layerIndex = useMemo(() => new Map(props.layers.map((layer) => [layer.selector, layer])), [props.layers]);
  const layerChildren = useMemo(() => {
    const children = new Map<string, Layer[]>();
    for (const layer of props.layers) {
      if (!layer.parentSelector || !layerIndex.has(layer.parentSelector)) continue;
      children.set(layer.parentSelector, [...(children.get(layer.parentSelector) ?? []), layer]);
    }
    return children;
  }, [props.layers, layerIndex]);
  const filteredLayers = useMemo(() => {
    const query = layerQuery.trim().toLowerCase();
    const matches = new Set(props.layers.filter((layer) => `${layer.label} ${layer.tag} ${layerType(layer).label} ${layer.sourceId ?? ""}`.toLowerCase().includes(query)).map((layer) => layer.selector));
    if (query) {
      for (const selector of [...matches]) {
        let parent = layerIndex.get(selector)?.parentSelector;
        const visited = new Set<string>();
        while (parent && !visited.has(parent)) { visited.add(parent); matches.add(parent); parent = layerIndex.get(parent)?.parentSelector; }
      }
      return props.layers.filter((layer) => matches.has(layer.selector));
    }
    return props.layers.filter((layer) => {
      let parent = layer.parentSelector;
      const visited = new Set<string>();
      while (parent && !visited.has(parent)) {
        if (collapsedLayers.has(parent)) return false;
        visited.add(parent); parent = layerIndex.get(parent)?.parentSelector;
      }
      return true;
    });
  }, [layerQuery, props.layers, layerIndex, collapsedLayers]);
  const selectedAncestorKey = useMemo(() => {
    let parent = layerIndex.get(selectionKey.split("\n").at(-1) ?? "")?.parentSelector;
    const ancestors = new Set<string>();
    while (parent && !ancestors.has(parent)) { ancestors.add(parent); parent = layerIndex.get(parent)?.parentSelector; }
    return [...ancestors].join("\n");
  }, [selectionKey, layerIndex]);
  const hasFocusedLayer = filteredLayers.some((layer) => layer.selector === focusedLayer);
  useEffect(() => {
    if (!selectionKey) return;
    const selector = selectionKey.split("\n").at(-1)!;
    setFocusedLayer(selector);
    setCollapsedLayers((previous) => {
      const next = new Set(previous);
      for (const parent of selectedAncestorKey.split("\n")) next.delete(parent);
      return next.size === previous.size ? previous : next;
    });
    const frame = requestAnimationFrame(() => layerRows.current.get(selector)?.scrollIntoView({ block:"nearest" }));
    return () => cancelAnimationFrame(frame);
  }, [selectionKey, selectedAncestorKey, props.tab]);
  const filteredInsertGroups = INSERT_GROUPS.map((group) => ({ ...group, items:group.items.filter((item) =>
    (insertCategory === "all" || insertCategory === group.title) && `${item.label} ${item.description} ${INSERT_SEARCH_WORDS[item.kind] ?? ""}`.toLowerCase().includes(insertQuery.trim().toLowerCase())) })).filter((group) => group.items.length);
  const insertTarget = useMemo(() => {
    let layer:Layer | undefined = props.selections.at(-1);
    const visited = new Set<string>();
    while (layer && !INSERT_CONTAINERS.has(layer.tag.toLowerCase()) && !visited.has(layer.selector)) {
      visited.add(layer.selector); layer = layer.parentSelector ? layerIndex.get(layer.parentSelector) : undefined;
    }
    return layer;
  }, [props.selections, layerIndex]);
  const visibleAssets = props.assets.filter((asset) => !assetQuery.trim() || `${asset.name} ${asset.path}`.toLowerCase().includes(assetQuery.trim().toLowerCase()));
  const visibleFiles = useMemo(() => {
    const query = props.fileQuery.trim().toLowerCase();
    return query ? props.files.filter((file) => file.toLowerCase().includes(query)) : props.files;
  }, [props.fileQuery, props.files]);
  const activeTab = tabs.find((item) => item.id === props.tab) ?? tabs[0];
  const activeSummary = props.tab === "layers" ? `${props.layers.length} objects` : props.tab === "insert" ? `${INSERT_GROUPS.reduce((count,group)=>count+group.items.length,0)} blocks` : props.tab === "assets" ? `${props.assets.length} images` : props.tab === "tokens" ? `${props.tokens.length} variables` : props.tab === "pages" ? `${props.pages.length} routes` : `${props.files.length} files`;

  function finishRename(layer: Layer) {
    if (renamingRef.current !== layer.selector) return;
    renamingRef.current = null;
    if (renameValue.trim()) props.command("rename-layer", { selector:layer.selector, name:renameValue.trim() });
    setRenaming(null);
  }
  function startRename(layer: Layer) {
    if (props.readOnly) return;
    renamingRef.current = layer.selector; setRenaming(layer.selector); setRenameValue(layer.label || layer.tag);
  }
  function toggleLayer(selector:string) {
    setCollapsedLayers((previous) => { const next = new Set(previous); if (next.has(selector)) next.delete(selector); else next.add(selector); return next; });
  }
  function focusLayer(layer:Layer | undefined) {
    if (!layer) return;
    setFocusedLayer(layer.selector); props.selectLayer(layer.selector); layerRows.current.get(layer.selector)?.focus();
  }
  function layerIsInside(selector:string, ancestorSelector:string) {
    let layer = layerIndex.get(selector);
    const visited = new Set<string>();
    while (layer?.parentSelector && !visited.has(layer.parentSelector)) {
      if (layer.parentSelector === ancestorSelector) return true;
      visited.add(layer.parentSelector); layer = layerIndex.get(layer.parentSelector);
    }
    return false;
  }
  function canDropLayer(sourceSelector:string | null, target:Layer) {
    const source = sourceSelector ? layerIndex.get(sourceSelector) : undefined;
    return !!source && source.selector !== target.selector && source.parentSelector !== target.selector
      && !source.locked && !target.locked && REPARENT_CONTAINERS.has(target.tag.toLowerCase())
      && !layerIsInside(target.selector, source.selector);
  }
  function beginLayerDrag(event:DragEvent<HTMLDivElement>, layer:Layer) {
    if (props.readOnly || layer.locked || layerQuery.trim() || (event.target as HTMLElement).closest(".designer-layer-actions")) { event.preventDefault(); return; }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-polazu-layer", layer.selector);
    setDraggedLayer(layer.selector); setLayerDropTarget(null);
  }
  function dropLayer(event:DragEvent<HTMLDivElement>, target:Layer) {
    const sourceSelector = draggedLayer || event.dataTransfer.getData("application/x-polazu-layer");
    if (!canDropLayer(sourceSelector, target)) return;
    event.preventDefault(); event.stopPropagation();
    props.command("reparent-layer", { sourceSelector, targetParentSelector:target.selector });
    setCollapsedLayers((previous) => { const next = new Set(previous); next.delete(target.selector); return next; });
    setDraggedLayer(null); setLayerDropTarget(null);
  }
  function onLayerKeyDown(event:KeyboardEvent<HTMLDivElement>, layer:Layer) {
    if (event.target !== event.currentTarget || renaming) return;
    const index = filteredLayers.findIndex((item) => item.selector === layer.selector);
    if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End", "F2", "Enter", " "].includes(event.key)) { event.preventDefault(); event.stopPropagation(); }
    if (event.key === "ArrowDown") focusLayer(filteredLayers[index + 1]);
    else if (event.key === "ArrowUp") focusLayer(filteredLayers[index - 1]);
    else if (event.key === "Home") focusLayer(filteredLayers[0]);
    else if (event.key === "End") focusLayer(filteredLayers.at(-1));
    else if (event.key === "ArrowRight") { if (collapsedLayers.has(layer.selector)) toggleLayer(layer.selector); else focusLayer(layerChildren.get(layer.selector)?.[0]); }
    else if (event.key === "ArrowLeft") { if (layerChildren.has(layer.selector) && !collapsedLayers.has(layer.selector)) toggleLayer(layer.selector); else focusLayer(layer.parentSelector ? layerIndex.get(layer.parentSelector) : undefined); }
    else if (event.key === "F2") startRename(layer);
    else if (event.key === "Enter" || event.key === " ") props.selectLayer(layer.selector, event.shiftKey || event.ctrlKey || event.metaKey);
  }
  function insertItem(kind:InsertKind) {
    setRecentInserts((previous) => [kind, ...previous.filter((item) => item !== kind)].slice(0, 6));
    props.command("insert", { kind, parentSelector:insertTarget?.selector ?? "body" });
  }

  return <aside className="designer-sidebar" aria-label="프로젝트 구조 패널">
    <nav className="designer-sidebar-tabs" aria-label="왼쪽 패널">
      {tabs.map((item) => <button type="button" key={item.id} className={props.tab === item.id ? "active" : ""} aria-pressed={props.tab === item.id} onClick={() => props.setTab(item.id)} title={item.label}>
        <DesignerIcon name={item.icon}/><span>{item.label}</span>
      </button>)}
    </nav>
    <div className="designer-sidebar-head">
      <div><small>{activeTab.label}</small><strong>{activeSummary}</strong></div>
      {props.tab === "layers" && <button type="button" className="designer-sidebar-more" aria-label={collapsedLayers.size ? "모든 레이어 펼치기" : "모든 레이어 접기"} title={collapsedLayers.size ? "모두 펼치기" : "모두 접기"} onClick={() => setCollapsedLayers(collapsedLayers.size ? new Set() : new Set(layerChildren.keys()))}><DesignerIcon name={collapsedLayers.size ? "plus" : "minus"}/></button>}
    </div>
    <div className="designer-sidebar-context">
      <span title={props.planName}>{props.planName}</span>
      <select aria-label="프로젝트 루트" value={props.root} onChange={(event) => props.setRoot(event.target.value)}>
        {props.roots.map((item) => <option key={item} value={item}>{item || "/"}</option>)}
      </select>
    </div>
    {props.isNext && <div className="designer-runtime-mode">
      <span>Next preview</span>
      <select aria-label="미리보기 실행 방식" value={props.nextUI ? "ui" : "server"} onChange={(event) => props.setNextUI(event.target.value === "ui")}>
        <option value="ui">UI compatibility</option>
        <option value="server">Original server · beta</option>
      </select>
    </div>}

    {props.tab === "layers" && <div className="designer-sidebar-content designer-layer-panel">
      <Search value={layerQuery} onChange={setLayerQuery} placeholder="레이어 검색"/>
      <div className="designer-layer-list" role="tree" aria-label="레이어" aria-multiselectable="true">
        {filteredLayers.length ? filteredLayers.map((layer) => {
          const selected = selectedSelectors.has(layer.selector);
          const type = layerType(layer);
          const children = layerChildren.get(layer.selector);
          const expanded = !!layerQuery.trim() || !collapsedLayers.has(layer.selector);
          const name = (layer.label || type.label).replace(/\s+/g, " ").trim();
          return <div ref={(node) => { if (node) layerRows.current.set(layer.selector, node); else layerRows.current.delete(layer.selector); }} className={`designer-layer-row ${styles.layerRow}${selected ? " selected" : ""}${layer.locked ? " locked" : ""}${layer.hidden ? ` ${styles.hiddenLayer}` : ""}${layerDropTarget === layer.selector ? ` ${styles.layerDropTarget}` : ""}`} style={{ "--layer-depth":Math.min(layer.depth, 9) } as CSSProperties} key={layer.selector} role="treeitem" aria-label={`${name} · ${type.label}${layer.hidden ? " · 숨김" : ""}${layer.locked ? " · 잠김" : ""}`} aria-level={layer.depth + 1} aria-selected={selected} aria-expanded={children?.length ? expanded : undefined} tabIndex={focusedLayer === layer.selector || (!hasFocusedLayer && layer === filteredLayers[0]) ? 0 : -1} onFocus={() => setFocusedLayer(layer.selector)} onKeyDown={(event) => onLayerKeyDown(event, layer)} draggable={!props.readOnly && !layer.locked && !layerQuery.trim()} onDragStart={(event) => beginLayerDrag(event, layer)} onDragEnd={() => { setDraggedLayer(null); setLayerDropTarget(null); }} onDragOver={(event) => { if (!canDropLayer(draggedLayer, layer)) return; event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (layerDropTarget !== layer.selector) setLayerDropTarget(layer.selector); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setLayerDropTarget((current) => current === layer.selector ? null : current); }} onDrop={(event) => dropLayer(event, layer)}>
            {children?.length ? <button type="button" className={`${styles.disclosure} ${expanded ? styles.expanded : ""}`} tabIndex={-1} aria-label={`${name} ${expanded ? "접기" : "펼치기"}`} disabled={!!layerQuery.trim()} onClick={() => toggleLayer(layer.selector)}><DesignerIcon name="chevron"/></button> : <span className={styles.disclosurePlaceholder}/>}
            {renaming === layer.selector ? <div className={`designer-layer-main ${styles.layerMain}`}><DesignerIcon name={type.icon}/><input autoFocus aria-label="레이어 이름" maxLength={80} value={renameValue} onFocus={(event) => event.currentTarget.select()} onChange={(event) => setRenameValue(event.target.value)} onBlur={() => finishRename(layer)} onKeyDown={(event) => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); finishRename(layer); } if (event.key === "Escape") { event.preventDefault(); renamingRef.current = null; setRenaming(null); } }}/></div> : <button type="button" tabIndex={-1} className={`designer-layer-main ${styles.layerMain}`} title={`${name}\n${type.label} · <${layer.tag}>${layer.sourceId ? " · 소스 연결됨" : ""}`} onClick={(event) => { setFocusedLayer(layer.selector); props.selectLayer(layer.selector, event.shiftKey || event.metaKey || event.ctrlKey); }} onDoubleClick={() => startRename(layer)}>
              <DesignerIcon name={type.icon}/><span>{name}</span><small className={styles.layerType}>{type.label}</small>
            </button>}
            <div className="designer-layer-actions">
              <button type="button" disabled={props.readOnly} aria-label={`${name} ${layer.hidden ? "표시" : "숨기기"}`} title={layer.hidden ? "표시" : "숨김"} onClick={() => props.command("toggle-visibility", { selector:layer.selector })}><DesignerIcon name={layer.hidden ? "eyeOff" : "eye"}/></button>
              <button type="button" disabled={props.readOnly} aria-label={`${name} ${layer.locked ? "잠금 해제" : "잠금"}`} title={layer.locked ? "잠금 해제" : "잠금"} onClick={() => props.command("toggle-lock", { selector:layer.selector })}><DesignerIcon name={layer.locked ? "lock" : "unlock"}/></button>
            </div>
          </div>;
        }) : <Empty icon={layerQuery ? "search" : "layers"} title={layerQuery ? "검색 결과가 없습니다" : "레이어가 없습니다"} detail={layerQuery ? "이름 또는 Text, Image 같은 유형으로 검색해 보세요." : "미리보기가 연결되면 페이지 구조가 표시됩니다."}/>}
      </div>
      <p className="designer-panel-footnote">레이어를 컨테이너로 드래그해 이동 · Shift/Ctrl 다중 선택 · F2 이름 변경</p>
    </div>}

    {props.tab === "insert" && <div className="designer-sidebar-content designer-insert-panel">
      <Search value={insertQuery} onChange={setInsertQuery} placeholder="요소 검색"/>
      <div className={styles.insertTarget}><DesignerIcon name="frame"/><div><small>클릭하여 추가할 위치</small><strong title={insertTarget?.label || "현재 페이지"}>{insertTarget ? (insertTarget.label || layerType(insertTarget).label) : "현재 페이지"}</strong></div>{insertTarget && <button type="button" title="삽입 위치를 레이어에서 보기" aria-label="삽입 위치를 레이어에서 보기" onClick={() => { props.selectLayer(insertTarget.selector); props.setTab("layers"); }}><DesignerIcon name="layers"/></button>}</div>
      <p className={styles.insertHint}>클릭하면 위 위치에 추가됩니다. 캔버스로 드래그하면 원하는 영역에 놓을 수 있어요.</p>
      <div className={styles.categoryFilters} role="group" aria-label="요소 카테고리">
        <button type="button" aria-pressed={insertCategory === "all"} onClick={() => setInsertCategory("all")}>전체</button>
        {INSERT_GROUPS.map((group) => <button type="button" key={group.title} aria-pressed={insertCategory === group.title} onClick={() => setInsertCategory(group.title)}>{INSERT_CATEGORY_LABELS[group.title]}</button>)}
      </div>
      {!insertQuery && insertCategory === "all" && recentInserts.length > 0 && <div className={styles.recentInserts}><small>최근 사용</small><div>{recentInserts.map((kind) => { const item = INSERT_GROUPS.flatMap((group) => group.items).find((entry) => entry.kind === kind)!; return <button type="button" key={kind} disabled={props.readOnly} onClick={() => insertItem(kind)}><DesignerIcon name={item.icon}/>{item.label}</button>; })}</div></div>}
      {filteredInsertGroups.map((group) => {
        return <section className="designer-insert-group" key={group.title}><h3>{INSERT_CATEGORY_LABELS[group.title]}<span className={styles.resultCount}>{group.items.length}</span></h3><div className="designer-insert-grid">{group.items.map((item) => <button type="button" key={item.kind} disabled={props.readOnly} draggable={!props.readOnly} title={`${item.label} 추가 · ${item.description}`} onDragStart={(event) => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-polazu-insert", item.kind); window.dispatchEvent(new CustomEvent("polazu:insert-drag", { detail:{ kind:item.kind } })); }} onDragEnd={() => window.dispatchEvent(new CustomEvent("polazu:insert-drag", { detail:{ kind:null } }))} onClick={() => insertItem(item.kind)}>
          <span><DesignerIcon name={item.icon}/></span><strong>{item.label}</strong><small>{item.description}</small>
        </button>)}</div></section>;
      })}
      {!filteredInsertGroups.length && <Empty icon="search" title="검색 결과가 없습니다" detail="텍스트, 버튼, 폼처럼 한글로도 검색할 수 있어요. 다른 카테고리도 확인해 보세요."/>}
    </div>}

    {props.tab === "assets" && <div className="designer-sidebar-content designer-asset-panel">
      <Search value={assetQuery} onChange={setAssetQuery} placeholder="이미지 자산 검색"/>
      <label className={`designer-asset-upload${assetBusy ? " busy" : ""}`}>
        <DesignerIcon name="image"/><span><strong>{assetBusy ? "업로드 중…" : "이미지 업로드"}</strong><small>PNG, JPG, WebP, GIF, SVG, AVIF · 최대 4MB</small></span>
        <input type="file" aria-label="프로젝트 이미지 업로드" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/avif" disabled={props.readOnly || assetBusy} onChange={async(event)=>{const file=event.target.files?.[0];event.target.value="";if(!file)return;setAssetBusy(true);try{await props.uploadAsset(file);}finally{setAssetBusy(false);}}}/>
      </label>
      <p className="designer-panel-help">{props.canUseAsset ? "이미지를 클릭하면 현재 선택한 Image 레이어에 적용됩니다." : "캔버스에서 Image 레이어를 선택한 뒤 아래 이미지로 교체하세요."}</p>
      <div className="designer-asset-grid">
        {visibleAssets.map((asset)=><button type="button" key={asset.path} disabled={!props.canUseAsset||props.readOnly} onClick={()=>props.useAsset(asset)} title={props.canUseAsset?`${asset.path} 적용`:"캔버스에서 Image 레이어를 먼저 선택하세요"}>
          <span>{props.assetBaseUrl?<img src={assetPreviewUrl(props.assetBaseUrl,asset.url)} alt="" loading="lazy" decoding="async"/>:<DesignerIcon name="image"/>}</span>
          <strong>{asset.name}</strong><small>{asset.extension.toUpperCase()} · {asset.url}</small>
        </button>)}
      </div>
      {!props.assets.length&&<Empty icon="image" title="프로젝트 이미지가 없습니다" detail="이미지를 업로드하면 프로젝트에 저장되어 다시 열어도 사용할 수 있어요."/>}
      {!!props.assets.length && !visibleAssets.length && <Empty icon="search" title="검색 결과가 없습니다" detail="다른 이미지 이름으로 검색해 보세요."/>}
      {!!props.assets.length&&!props.canUseAsset&&<p className="designer-panel-footnote">캔버스에서 Image 레이어를 선택하면 자산을 바로 적용할 수 있습니다.</p>}
    </div>}

    {props.tab === "tokens" && <div className="designer-sidebar-content designer-token-panel">
      <Search value={tokenQuery} onChange={setTokenQuery} placeholder="CSS 변수 검색"/>
      <p className="designer-panel-help">프로젝트 CSS의 <code>--custom-property</code>를 찾아 실제 선언 값을 수정합니다.</p>
      {Object.entries(TOKEN_GROUP_LABELS).map(([category, label]) => {
        const query = tokenQuery.trim().toLowerCase();
        const items = props.tokens.filter((token) => token.category === category && (!query || `${token.name} ${token.value} ${token.path}`.toLowerCase().includes(query)));
        return items.length ? <section className="designer-token-group" key={category}><h3>{label}<span>{items.length}</span></h3>{items.map((token) => <TokenRow key={token.id} token={token} readOnly={props.readOnly} saving={props.tokenSaving} update={props.updateToken}/>)}</section> : null;
      })}
      {!props.tokens.length && <Empty icon="palette" title="디자인 토큰이 없습니다" detail="CSS 파일에 --color-primary 같은 custom property를 선언하면 이곳에서 편집할 수 있습니다."/>}
      {!!props.tokens.length && !props.tokens.some((token) => !tokenQuery.trim() || `${token.name} ${token.value} ${token.path}`.toLowerCase().includes(tokenQuery.trim().toLowerCase())) && <Empty icon="search" title="검색 결과가 없습니다" detail="다른 토큰 이름이나 값으로 검색하세요."/>}
    </div>}

    {props.tab === "pages" && <div className="designer-sidebar-content">
      <div className="designer-list-heading"><span>Routes</span><small>{props.pages.length}</small></div>
      <div className="designer-simple-list">
        {props.pages.map((page) => <button type="button" className={page === props.currentPath ? "selected" : ""} key={page} onClick={() => props.navigate(page)}><DesignerIcon name="pages"/><span>{page}</span>{page === props.currentPath && <i/>}</button>)}
      </div>
      {props.planNotes.map((note) => <p className="designer-panel-footnote" key={note}>{note}</p>)}
    </div>}

    {props.tab === "files" && <div className="designer-sidebar-content">
      <Search value={props.fileQuery} onChange={props.setFileQuery} placeholder="파일 검색"/>
      <div className="designer-simple-list designer-file-list">
        {visibleFiles.map((file) => <button type="button" className={file === props.selectedFile ? "selected" : ""} key={file} title={file} onClick={() => props.chooseFile(file)}><FileGlyph path={file}/><span>{file}</span></button>)}
      </div>
      <p className="designer-panel-footnote">{props.files.length} files · node_modules와 빌드 결과는 제외</p>
    </div>}
  </aside>;
}

function TokenRow({ token, update, readOnly=false, saving=false }: { token:DesignToken; update:(token:DesignToken,value:string)=>Promise<boolean>; readOnly?:boolean; saving?:boolean }) {
  const [value, setValue] = useState(token.value);
  const [busy, setBusy] = useState(false);
  useEffect(() => setValue(token.value), [token.id, token.value]);
  const changed = value.trim() !== token.value;
  const isColor = token.category === "color" && /^#[0-9a-f]{6}$/i.test(value.trim());
  async function save() { if (!changed || busy || saving || readOnly) return; setBusy(true); try { if (!(await update(token, value))) setValue(token.value); } finally { setBusy(false); } }
  return <div className={`designer-token-row${changed ? " changed" : ""}`} title={`${token.path}:${token.line}`}>
    {isColor ? <input className="designer-token-swatch" type="color" aria-label={`${token.name} 색상`} value={value.trim()} disabled={readOnly} onChange={(event) => setValue(event.target.value)}/> : <span className={`designer-token-glyph ${token.category}`}><DesignerIcon name={token.category === "typography" ? "text" : token.category === "radius" ? "rectangle" : token.category === "effect" ? "layers" : "ruler"}/></span>}
    <label><strong>{token.name}</strong><input value={value} disabled={readOnly} spellCheck={false} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void save(); } if (event.key === "Escape") setValue(token.value); }}/><small>{token.path}:{token.line}</small></label>
    <button type="button" disabled={!changed || busy || saving || readOnly} onClick={() => void save()} aria-label={`${token.name} 저장`}><DesignerIcon name={busy ? "more" : "check"}/></button>
  </div>;
}

function Search({ value, onChange, placeholder }: { value:string; onChange:(value:string)=>void; placeholder:string }) {
  return <div className={`designer-panel-search ${styles.search}`}><DesignerIcon name="search"/><input type="search" aria-label={placeholder} value={value} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onChange(""); } }} placeholder={placeholder}/>{value && <button type="button" aria-label={`${placeholder} 지우기`} onClick={() => onChange("")}><DesignerIcon name="close"/></button>}</div>;
}

function Empty({ icon, title, detail }: { icon:DesignerIconName; title:string; detail:string }) {
  return <div className="designer-empty"><DesignerIcon name={icon}/><strong>{title}</strong><p>{detail}</p></div>;
}

function FileGlyph({ path }: { path:string }) {
  const ext = path.split(".").pop()?.toLowerCase();
  return <span className={`designer-file-glyph ext-${ext ?? "file"}`}>{ext?.slice(0, 2).toUpperCase() || "•"}</span>;
}

function assetPreviewUrl(baseUrl:string,assetUrl:string){
  try{return new URL(assetUrl,baseUrl).toString();}catch{return assetUrl;}
}

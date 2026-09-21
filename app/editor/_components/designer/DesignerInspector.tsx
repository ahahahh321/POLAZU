"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { DesignToken } from "../../_lib/design-tokens";
import type { Layer, ResponsiveTarget, Selection } from "../../_lib/types";
import DesignerIcon from "./DesignerIcon";
import TokenBindingField from "./TokenBindingField";
import CssValueInput from "./CssValueInput";
import FontFamilyPicker from "./FontFamilyPicker";
import { cssColorToHex, normalizeFontWeight } from "../../_lib/inspector-values";
import styles from "./InspectorControls.module.css";

const ReadOnlyContext = createContext(false);

export type DesignerRightTab = "design" | "css" | "logic" | "audit";

type Props = {
  selection: Selection | null;
  selections: Selection[];
  breadcrumbs: Layer[];
  draft: Record<string, string>;
  attributes: Record<string, string>;
  text: string;
  responsive: ResponsiveTarget;
  setResponsive: (value: ResponsiveTarget) => void;
  changeStyle: (name: string, value: string) => void;
  changeAttribute: (name: string, value: string) => void;
  changeText: (value: string) => void;
  apply: () => void;
  selectBreadcrumb: (selector: string) => void;
  command: (command: string, payload?: Record<string, unknown>) => void;
  readOnly?: boolean;
  fonts?: string[];
  tokens?: DesignToken[];
};

export default function DesignerInspector(props: Props) {
  const [advanced, setAdvanced] = useState(false);
  if (!props.selection) return <div className="designer-inspector-empty">
    <span><DesignerIcon name="select"/></span>
    <h2>요소를 선택하세요</h2>
    <p>캔버스 또는 Layers 패널에서 요소를 선택하면 레이아웃, 스타일, 반응형 값을 실제 소스에 연결해 수정할 수 있습니다.</p>
    <div><kbd>V</kbd> 선택 · <kbd>⇧ click</kbd> 다중 선택</div>
  </div>;
  const selected = props.selection;
  const isText = selected.editableText && (Boolean(selected.text.trim()) || /^(h[1-6]|p|span|label|strong|em|small|button|a|li|blockquote)$/.test(selected.tag));
  const isImage = selected.tag === "img";
  const supportsHref = selected.tag === "a";
  const supportsAlt = selected.attributes?.role === "img";
  const disabled = !!props.readOnly;
  const typeLabel = selectionType(selected);
  const isFlex = props.draft.display?.includes("flex");
  const isGrid = props.draft.display?.includes("grid");
  const isLayoutChild = /flex|grid/.test(selected.parentDisplay ?? "");

  return <ReadOnlyContext.Provider value={disabled}><div className="designer-inspector">
    <header className="designer-inspector-selection">
      <div className="designer-selection-title"><span className="designer-tag-badge">{typeLabel.slice(0,1)}</span><div><strong>{typeLabel}</strong><small>{props.selections.length > 1 ? `${props.selections.length}개 선택` : `${selected.tag.toUpperCase()} · ${selected.sourceId ? "Source linked" : "Preview selector"}`}</small></div></div>
      <div className="designer-inspector-actions"><button type="button" title="복제" disabled={disabled} onClick={() => props.command("duplicate")}><DesignerIcon name="duplicate"/></button><button type="button" title="삭제" disabled={disabled} onClick={() => props.command("delete")}><DesignerIcon name="trash"/></button></div>
      <div className="designer-breadcrumbs" aria-label="요소 경로">{props.breadcrumbs.map((item, index) => <span key={item.selector}><button type="button" onClick={() => props.selectBreadcrumb(item.selector)}>{item.label || item.tag}</button>{index < props.breadcrumbs.length - 1 && <DesignerIcon name="chevron"/>}</span>)}</div>
    </header>

    <div className="designer-breakpoint-tabs" role="group" aria-label="반응형 대상">
      {(["base","desktop","tablet","mobile"] as ResponsiveTarget[]).map((value) => <button type="button" key={value} className={props.responsive === value ? "active" : ""} onClick={() => props.setResponsive(value)} title={value === "base" ? "기본값" : `${value} 전용 재정의`}>
        {value === "base" ? "Base" : <DesignerIcon name={value === "desktop" ? "desktop" : value === "tablet" ? "tablet" : "mobile"}/>}<span>{value === "base" ? "All" : value[0].toUpperCase() + value.slice(1)}</span>{props.responsive === value && <i/>}
      </button>)}
    </div>
    {props.responsive !== "base" && <div className="designer-responsive-notice"><DesignerIcon name="info"/><span>{props.responsive} 구간은 CSS 스타일만 재정의합니다. 문구·링크·ARIA 속성은 Base에서 편집하세요.</span></div>}
    <div className={styles.modeBar}><span>{disabled ? "보기 전용" : "기본 속성 · 즉시 반영"}</span><button type="button" aria-pressed={advanced} onClick={() => setAdvanced((value) => !value)}>{advanced ? "고급 속성 접기" : "고급 속성"}</button></div>

    <InspectorSection title="Position & Size" defaultOpen>
      <div className="designer-field-grid four"><ValueField label="X" value={props.draft.left} placeholder={`${selected.x ?? 0}px`} onChange={(value) => props.changeStyle("left", value)}/><ValueField label="Y" value={props.draft.top} placeholder={`${selected.y ?? 0}px`} onChange={(value) => props.changeStyle("top", value)}/><ValueField label="W" value={props.draft.width} placeholder={`${selected.width}px`} onChange={(value) => props.changeStyle("width", value)}/><ValueField label="H" value={props.draft.height} placeholder={`${selected.height}px`} onChange={(value) => props.changeStyle("height", value)}/></div>
      <SizingField label="Width" value={props.draft.width} fixed={selected.width} onChange={(value) => props.changeStyle("width", value)}/>
      <SizingField label="Height" value={props.draft.height} fixed={selected.height} onChange={(value) => props.changeStyle("height", value)}/>
      {isLayoutChild && <p className={styles.hint}>자동 레이아웃 안의 요소입니다. 드래그하면 배치 순서가 바뀝니다.</p>}
      {advanced && <><div className="designer-field-grid two"><SelectField label="Position" value={props.draft.position} options={["static","relative","absolute","fixed","sticky"]} onChange={(value) => props.changeStyle("position", value)}/><ValueField label="Z" value={props.draft.zIndex} placeholder="auto" onChange={(value) => props.changeStyle("zIndex", value)}/></div>
      <div className="designer-field-grid two"><ValueField label="Rotate" value={props.draft.rotate} placeholder="0deg" onChange={(value) => props.changeStyle("rotate", value)}/><ValueField label="Aspect" value={props.draft.aspectRatio} placeholder="16 / 9" onChange={(value) => props.changeStyle("aspectRatio", value)}/></div>
      <div className="designer-field-grid two"><ValueField label="Min W" value={props.draft.minWidth} placeholder="0px" onChange={(value) => props.changeStyle("minWidth", value)}/><ValueField label="Max W" value={props.draft.maxWidth} placeholder="none" onChange={(value) => props.changeStyle("maxWidth", value)}/><ValueField label="Min H" value={props.draft.minHeight} placeholder="0px" onChange={(value) => props.changeStyle("minHeight", value)}/><ValueField label="Max H" value={props.draft.maxHeight} placeholder="none" onChange={(value) => props.changeStyle("maxHeight", value)}/></div></>}
    </InspectorSection>

    <InspectorSection key={`layout-${isText}`} title="Auto layout & spacing" defaultOpen={!isText}>
      {(isFlex || isGrid) && <div className={styles.layoutHeader}><span>{isGrid ? "그리드 배치" : "자동 배치"}</span><button type="button" onClick={() => props.changeStyle("display", "block")}>자동 배치 해제</button></div>}
      <div className={styles.layoutModes}><button type="button" aria-pressed={!!isFlex && props.draft.flexDirection !== "column"} onClick={()=>{props.changeStyle("display","flex");props.changeStyle("flexDirection","row");}}>→ 가로</button><button type="button" aria-pressed={!!isFlex && props.draft.flexDirection === "column"} onClick={()=>{props.changeStyle("display","flex");props.changeStyle("flexDirection","column");}}>↓ 세로</button><button type="button" aria-pressed={!!isGrid} onClick={()=>props.changeStyle("display","grid")}>⊞ 그리드</button></div>
      {advanced && <div className="designer-field-grid two"><SelectField label="Display" value={props.draft.display} options={["block","inline","inline-block","flex","inline-flex","grid","inline-grid","none"]} onChange={(value) => props.changeStyle("display", value)}/><SelectField label="Overflow" value={props.draft.overflow} options={["visible","hidden","clip","auto","scroll"]} onChange={(value) => props.changeStyle("overflow", value)}/></div>}
      {isFlex && <>
        <div className="designer-field-grid two"><SegmentField label="Direction" value={props.draft.flexDirection} options={[{v:"row",l:"→"},{v:"column",l:"↓"},{v:"row-reverse",l:"←"},{v:"column-reverse",l:"↑"}]} onChange={(value) => props.changeStyle("flexDirection", value)}/><SelectField label="Wrap" value={props.draft.flexWrap} options={["nowrap","wrap","wrap-reverse"]} onChange={(value) => props.changeStyle("flexWrap", value)}/></div>
        <div className="designer-field-grid two"><SelectField label="Justify" value={props.draft.justifyContent} options={["flex-start","center","flex-end","space-between","space-around","space-evenly"]} onChange={(value) => props.changeStyle("justifyContent", value)}/><SelectField label="Align" value={props.draft.alignItems} options={["stretch","flex-start","center","flex-end","baseline"]} onChange={(value) => props.changeStyle("alignItems", value)}/></div>
      </>}
      {isGrid && <div className="designer-field-grid two"><ValueField label="Columns" value={props.draft.gridTemplateColumns} placeholder="repeat(3, 1fr)" onChange={(value) => props.changeStyle("gridTemplateColumns", value)}/><ValueField label="Rows" value={props.draft.gridTemplateRows} placeholder="auto" onChange={(value) => props.changeStyle("gridTemplateRows", value)}/></div>}
      {(isFlex || isGrid) && <div className={`designer-field-grid ${advanced ? "three" : "one"}`}><TokenBindingField label="Gap" value={props.draft.gap} placeholder="0" property="gap" tokens={props.tokens ?? []} disabled={disabled} onChange={(value) => props.changeStyle("gap", value)}/>{advanced && <><ValueField label="Row" value={props.draft.rowGap} placeholder="0" onChange={(value) => props.changeStyle("rowGap", value)}/><ValueField label="Column" value={props.draft.columnGap} placeholder="0" onChange={(value) => props.changeStyle("columnGap", value)}/></>}</div>}
      <BoxModel title="Padding" draft={props.draft} property="padding" onChange={props.changeStyle} tokens={props.tokens ?? []} disabled={disabled}/>{advanced && <BoxModel title="Margin" draft={props.draft} property="margin" onChange={props.changeStyle}/>}
    </InspectorSection>

    <InspectorSection title="Constraints">
      <div className="designer-auto-layout"><span>Horizontal constraint</span><div><button type="button" onClick={()=>{props.changeStyle("marginLeft","0");props.changeStyle("marginRight","auto");}}>Left</button><button type="button" onClick={()=>{props.changeStyle("marginLeft","auto");props.changeStyle("marginRight","auto");}}>Center</button><button type="button" onClick={()=>{props.changeStyle("marginLeft","auto");props.changeStyle("marginRight","0");}}>Right</button><button type="button" onClick={()=>props.changeStyle("width","100%")}>Stretch</button></div></div>
      {isLayoutChild && <div className="designer-field-grid two"><SelectField label="Align self" value={props.draft.alignSelf} options={["auto","stretch","flex-start","center","flex-end"]} onChange={(value)=>props.changeStyle("alignSelf",value)}/>{selected.parentDisplay?.includes("flex") && <ValueField label="Flex" value={props.draft.flex} placeholder="0 1 auto" onChange={(value)=>props.changeStyle("flex",value)}/>}</div>}
      <small className="designer-section-help">브레이크포인트별로 Fill/Hug/Fixed 값을 따로 저장할 수 있습니다.</small>
    </InspectorSection>

    {isImage && <InspectorSection title="Image" defaultOpen>
      {props.responsive === "base" && <><ValueField label="Source" value={props.attributes.src} placeholder="/images/photo.jpg" onChange={(value) => props.changeAttribute("src", value)}/><ValueField label="Alt text" value={props.attributes.alt} placeholder="이미지의 의미를 설명하세요" onChange={(value) => props.changeAttribute("alt", value)}/></>}
      <div className="designer-field-grid two"><SelectField label="Fit" value={props.draft.objectFit} options={["fill","contain","cover","none","scale-down"]} onChange={(value) => props.changeStyle("objectFit", value)}/><ValueField label="Focus" value={props.draft.objectPosition} placeholder="50% 50%" onChange={(value) => props.changeStyle("objectPosition", value)}/><ValueField label="Aspect" value={props.draft.aspectRatio} placeholder="16 / 9" onChange={(value) => props.changeStyle("aspectRatio", value)}/></div>
    </InspectorSection>}

    {isText && <InspectorSection title="Typography" defaultOpen>
      {props.responsive === "base" && <textarea className="designer-text-editor" aria-label="선택 요소 텍스트" value={props.text} onChange={(event) => props.changeText(event.target.value)} rows={3}/>}
      <FontFamilyPicker value={props.draft.fontFamily} fonts={props.fonts} disabled={disabled} onChange={(value)=>props.changeStyle("fontFamily",value)}/>
      <div className="designer-field-grid two"><SelectField label="Style" value={props.draft.fontStyle} options={["normal","italic","oblique"]} onChange={(value)=>props.changeStyle("fontStyle",value)}/><FontWeightField value={props.draft.fontWeight} onChange={(value)=>props.changeStyle("fontWeight",value)}/></div>
      <div className={styles.typographyMetrics}><TokenBindingField label="Size" value={props.draft.fontSize} placeholder="16px" property="fontSize" tokens={props.tokens ?? []} disabled={disabled} onChange={(value) => props.changeStyle("fontSize", value)}/><ValueField label="Line height" value={props.draft.lineHeight} placeholder="1.5" onChange={(value) => props.changeStyle("lineHeight", value)}/><ValueField label="Letter spacing" value={props.draft.letterSpacing} placeholder="0" onChange={(value) => props.changeStyle("letterSpacing", value)}/></div>
      <SegmentField label="Alignment" value={props.draft.textAlign} options={[{v:"left",l:"⇤"},{v:"center",l:"↔"},{v:"right",l:"⇥"},{v:"justify",l:"☰"}]} onChange={(value)=>props.changeStyle("textAlign",value)}/>
      {advanced && <div className="designer-field-grid two"><SelectField label="Wrap" value={props.draft.whiteSpace} options={["normal","nowrap","pre","pre-wrap","break-spaces"]} onChange={(value) => props.changeStyle("whiteSpace", value)}/><SelectField label="Overflow" value={props.draft.textOverflow} options={["clip","ellipsis"]} onChange={(value) => props.changeStyle("textOverflow", value)}/></div>}
    </InspectorSection>}

    <InspectorSection title="Fill & Color" defaultOpen>
      {(isText || advanced) && <TokenBindingField label="Text" value={props.draft.color} placeholder="#000000 / rgba()" property="color" tokens={props.tokens ?? []} color disabled={disabled} onChange={(value) => props.changeStyle("color", value)}/>}
      <TokenBindingField label="Background" value={props.draft.backgroundColor} placeholder="#000000 / rgba()" property="backgroundColor" tokens={props.tokens ?? []} color disabled={disabled} onChange={(value) => props.changeStyle("backgroundColor", value)}/>
      <div className="designer-field-grid two"><ValueField label="Opacity" value={props.draft.opacity} placeholder="1" onChange={(value) => props.changeStyle("opacity", value)}/><ValueField label="Radius" value={props.draft.borderRadius} placeholder="0" onChange={(value) => props.changeStyle("borderRadius", value)}/></div>
      {advanced && <><ValueField label="Gradient / image" value={props.draft.backgroundImage} placeholder="linear-gradient(…)" onChange={(value) => props.changeStyle("backgroundImage", value)}/><SelectField label="Blend" value={props.draft.mixBlendMode} options={["normal","multiply","screen","overlay","darken","lighten","difference"]} onChange={(value) => props.changeStyle("mixBlendMode", value)}/></>}
    </InspectorSection>

    <InspectorSection title="Border & Effects">
      <div className="designer-field-grid three"><ValueField label="Width" value={props.draft.borderWidth} placeholder="0" onChange={(value) => props.changeStyle("borderWidth", value)}/><SelectField label="Style" value={props.draft.borderStyle} options={["none","solid","dashed","dotted","double"]} onChange={(value) => props.changeStyle("borderStyle", value)}/><ValueField label="Radius" value={props.draft.borderRadius} placeholder="0" onChange={(value) => props.changeStyle("borderRadius", value)}/></div>
      <ColorField label="Border" value={props.draft.borderColor} onChange={(value) => props.changeStyle("borderColor", value)}/>
      <ValueField label="Shadow" value={props.draft.boxShadow} placeholder="0 8px 24px rgba(0,0,0,.12)" onChange={(value) => props.changeStyle("boxShadow", value)}/>
      <ValueField label="Filter" value={props.draft.filter} placeholder="blur(0px)" onChange={(value) => props.changeStyle("filter", value)}/>
    </InspectorSection>

    {props.responsive === "base" && (supportsHref || supportsAlt || selected.tag === "input" || selected.attributes?.title != null || selected.attributes?.role != null) && <InspectorSection title="Content & Accessibility">
      {supportsHref && <><ValueField label="Link" value={props.attributes.href} placeholder="/about" onChange={(value) => props.changeAttribute("href", value)}/><div className="designer-field-grid two"><SelectField label="Target" value={props.attributes.target} options={["","_self","_blank"]} onChange={(value) => props.changeAttribute("target", value)}/><ValueField label="Rel" value={props.attributes.rel} placeholder="noreferrer" onChange={(value) => props.changeAttribute("rel", value)}/></div></>}
      {supportsAlt && <ValueField label="Alt" value={props.attributes.alt} placeholder="이미지 설명" onChange={(value) => props.changeAttribute("alt", value)}/>}
      {selected.tag === "input" && <><ValueField label="Placeholder" value={props.attributes.placeholder} placeholder="입력 안내" onChange={(value) => props.changeAttribute("placeholder", value)}/><ValueField label="Accessible name" value={props.attributes["aria-label"]} placeholder="필드 이름" onChange={(value) => props.changeAttribute("aria-label", value)}/></>}
      <ValueField label="Title" value={props.attributes.title} placeholder="보조 설명" onChange={(value) => props.changeAttribute("title", value)}/>
      <ValueField label="ARIA label" value={props.attributes["aria-label"]} placeholder="접근 가능한 이름" onChange={(value) => props.changeAttribute("aria-label", value)}/>
    </InspectorSection>}

    {props.responsive === "base" && <InspectorSection title="Prototype interaction">
      <SelectField label="On click" value={props.attributes["data-action"]} options={["","toggle"]} onChange={(value)=>props.changeAttribute("data-action",value)}/>
      <ValueField label="Target selector" value={props.attributes["data-target"]} placeholder="#menu / .modal" onChange={(value)=>props.changeAttribute("data-target",value)}/>
      {supportsHref&&<ValueField label="Navigate to" value={props.attributes.href} placeholder="/next-page" onChange={(value)=>props.changeAttribute("href",value)}/>} 
      <p className="designer-section-help">Toggle은 대상 요소의 <code>is-open</code> 클래스를 전환합니다. Preview 모드에서 실제 동작을 확인할 수 있습니다.</p>
    </InspectorSection>}

    <footer className="designer-inspector-footer"><div className="designer-inspector-live"><span><i/>미리보기 · 자동 저장</span><button type="button" disabled={disabled} onClick={props.apply}>{props.responsive === "base" ? "변경 확정" : `${props.responsive} 변경 확정`}</button></div><small>{selected.sourceId ? selected.sourceId : "HTML selector · " + selected.selector}</small></footer>
  </div></ReadOnlyContext.Provider>;
}

function selectionType(selected:Selection){
  const tag=selected.tag.toLowerCase();
  if(["h1","h2","h3","h4","h5","h6","p","span","label","strong","em","small"].includes(tag))return "Text";
  if(tag==="table")return "Table";if(["ul","ol","li"].includes(tag))return "List";if(tag==="img"||tag==="picture")return "Image";
  if(tag==="button")return "Button";if(tag==="a")return "Link";if(["input","textarea","select"].includes(tag))return "Input";
  if(tag==="form")return "Form";if(tag==="nav")return "Navigation";if(tag==="header")return "Header";if(tag==="footer")return "Footer";
  if(["section","main","article","aside"].includes(tag))return "Section";if(tag==="svg")return "Icon";
  return selected.styles?.borderRadius==="50%"?"Ellipse":"Rectangle";
}

function InspectorSection({ title, defaultOpen=false, children }: { title:string; defaultOpen?:boolean; children:ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  const disabled = useContext(ReadOnlyContext);
  return <section className={`designer-inspector-section${open ? " open" : ""}`}><button type="button" className="designer-section-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={open}><DesignerIcon name="chevron"/><span>{title}</span></button>{open && <div className="designer-section-body"><fieldset className={styles.fields} disabled={disabled}>{children}</fieldset></div>}</section>;
}

function ValueField({ label, value, placeholder, onChange, length = false }: { label:string; value?:string; placeholder?:string; onChange:(value:string)=>void; length?:boolean }) {
  const isLength = length || ["X","Y","W","H","Min W","Max W","Min H","Max H","Width","Radius","Row","Column","Letter spacing"].includes(label);
  const numeric = isLength || ["Z","Rotate","Opacity","Line height"].includes(label);
  const unit = isLength ? "px" : label === "Rotate" ? "deg" : "";
  return <label className="designer-value-field"><span>{label}</span><CssValueInput value={value} placeholder={placeholder} onChange={onChange} numeric={numeric} defaultUnit={unit} minimum={["Opacity","W","H","Min W","Max W","Min H","Max H","Width","Radius","Row","Column"].includes(label) ? 0 : undefined} maximum={label === "Opacity" ? 1 : undefined} increment={label === "Opacity" ? .01 : label === "Line height" && !/[a-z%]/i.test(value ?? "") ? .1 : undefined}/></label>;
}
function SizingField({ label, value, fixed, onChange }: { label:string; value?:string; fixed:number; onChange:(value:string)=>void }) {
  const mode = value === "100%" ? "fill" : /^(auto|fit-content|max-content|min-content)$/.test(value ?? "") ? "hug" : "fixed";
  return <div className={styles.sizing}><span>{label === "Width" ? "너비" : "높이"}</span>{[{value:"fixed",label:"Fixed",title:"현재 크기로 고정"},{value:"hug",label:"Hug",title:"내용에 맞춤"},{value:"fill",label:"Fill",title:"부모 크기 채움"}].map((item)=><button type="button" key={item.value} title={item.title} aria-pressed={mode===item.value} onClick={()=>onChange(item.value==="fixed"?`${Math.round(fixed * 100) / 100}px`:item.value==="hug"?"fit-content":"100%")}>{item.label}</button>)}</div>;
}
function FontWeightField({value,onChange}:{value?:string;onChange:(value:string)=>void}){
  const weights=[["100","Thin"],["200","Extra Light"],["300","Light"],["400","Regular"],["500","Medium"],["600","Semi Bold"],["700","Bold"],["800","Extra Bold"],["900","Black"]];
  const normalized = normalizeFontWeight(value);
  return <label className="designer-value-field"><span>Weight</span><select value={normalized} onChange={event=>onChange(event.target.value)}><option value="">—</option>{normalized && !weights.some(([weight])=>weight===normalized) && <option value={normalized}>{normalized}</option>}{weights.map(([weight,label])=><option value={weight} key={weight}>{label} · {weight}</option>)}</select></label>;
}
function SelectField({ label, value, options, onChange }: { label:string; value?:string; options:string[]; onChange:(value:string)=>void }) {
  const normalized = value && options.includes(value) ? value : "";
  return <label className="designer-value-field"><span>{label}</span><select value={normalized} onChange={(event) => onChange(event.target.value)}><option value="">—</option>{options.map((item) => <option key={item} value={item}>{item || "none"}</option>)}</select></label>;
}
function SegmentField({ label, value, options, onChange }: { label:string; value?:string; options:{v:string;l:string}[]; onChange:(value:string)=>void }) {
  return <div className="designer-segment-field"><span>{label}</span><div role="group" aria-label={label}>{options.map((item) => <button type="button" className={value === item.v ? "active" : ""} aria-label={`${label} ${item.v}`} aria-pressed={value === item.v} key={item.v} title={item.v} onClick={() => onChange(item.v)}>{item.l}</button>)}</div></div>;
}
function ColorField({ label, value, onChange }: { label:string; value?:string; onChange:(value:string)=>void }) {
  const hex = cssColorToHex(value);
  return <label className="designer-color-field"><span>{label}</span><input type="color" aria-label={`${label} 색 선택`} value={hex} onChange={(event) => onChange(event.target.value)}/><input value={value ?? ""} placeholder="#000000 / rgba()" onChange={(event) => onChange(event.target.value)} spellCheck={false}/></label>;
}
function BoxModel({ title, draft, property, onChange, tokens=[], disabled=false }: { title:string; draft:Record<string,string>; property:"padding"|"margin"; onChange:(name:string,value:string)=>void; tokens?:DesignToken[]; disabled?:boolean }) {
  const cap = property[0].toUpperCase() + property.slice(1);
  const field = (label:string, name:string, placeholder:string) => property === "padding"
    ? <TokenBindingField key={name} label={label} value={draft[name]} placeholder={placeholder} property="padding" tokens={tokens} disabled={disabled} onChange={(value) => onChange(name, value)}/>
    : <ValueField key={name} label={label} value={draft[name]} placeholder={placeholder} length onChange={(value) => onChange(name, value)}/>;
  return <div className="designer-box-model"><span>{title}</span><div className="designer-field-grid four">{["Top","Right","Bottom","Left"].map((side) => field(side[0], property + side, "0"))}</div>{field("All", property, "0 / 8px 16px")}<small>{cap} values accept px, %, rem, auto and CSS shorthands.</small></div>;
}

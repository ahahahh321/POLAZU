"use client";

import { type MouseEvent, useEffect, useMemo, useState } from "react";
import { savedUiSeed, type EditableUi } from "../_lib/saved-ui-data";

type SavedCategory = { id: number; name: string; itemIds: number[] };
type ElementKey = "container" | "eyebrow" | "heading" | "label" | "input" | "button";

const layerLabels: Record<ElementKey, string> = {
  container: "Component container",
  eyebrow: "Eyebrow text",
  heading: "Heading",
  label: "Field label",
  input: "Input",
  button: "Button",
};

type ColorFieldProps = { label: string; value: string; onChange: (value: string) => void };

function ColorField({ label, value, onChange }: ColorFieldProps) {
  return <label>{label}<span className="saved-editor-color"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><b style={{ background: value }} aria-hidden="true" /><code>{value.toUpperCase()}</code></span></label>;
}

function makeReactCode(ui: EditableUi) {
  return `export default function ${ui.name.replace(/[^a-zA-Z0-9]/g, "") || "SavedComponent"}() {
  return (
    <section style={{
      background: "${ui.background}",
      color: "${ui.textColor}",
      padding: ${ui.padding},
      borderRadius: ${ui.radius},
      border: "${ui.borderWidth}px solid ${ui.borderColor}",
      boxShadow: "0 ${Math.round(ui.shadow / 2)}px ${ui.shadow * 2}px rgba(0, 0, 0, 0.12)",
    }}>
      <p style={{ color: "${ui.eyebrowColor}", fontSize: ${ui.eyebrowSize} }}>${ui.eyebrow}</p>
      <h2 style={{ color: "${ui.headingColor}", fontSize: ${ui.headingSize} }}>${ui.heading}</h2>
      <label style={{ color: "${ui.labelColor}", fontSize: ${ui.labelSize} }}>${ui.label}</label>
      <input
        placeholder="${ui.placeholder}"
        style={{ background: "${ui.inputBackground}", color: "${ui.inputTextColor}", borderColor: "${ui.inputBorder}", borderRadius: ${ui.inputRadius}, height: ${ui.inputHeight} }}
      />
      <button style={{
        background: "${ui.accent}",
        color: "${ui.buttonTextColor}",
        fontSize: ${ui.buttonTextSize},
        padding: "${ui.buttonPaddingY}px ${ui.buttonPaddingX}px",
        borderRadius: ${ui.buttonRadius},
      }}>
        ${ui.buttonText}
      </button>
    </section>
  );
}`;
}

export default function SavedUiEditor() {
  const [items, setItems] = useState(savedUiSeed);
  const [undoStack, setUndoStack] = useState<EditableUi[][]>([]);
  const [redoStack, setRedoStack] = useState<EditableUi[][]>([]);
  const [mode, setMode] = useState<"design" | "preview">("design");
  const [leftTab, setLeftTab] = useState<"components" | "layers">("components");
  const [rightTab, setRightTab] = useState<"design" | "code">("design");
  const [zoom, setZoom] = useState(75);
  const [selectedId, setSelectedId] = useState(1);
  const [selectedElement, setSelectedElement] = useState<ElementKey>("container");
  const [categories, setCategories] = useState<SavedCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const stored = window.localStorage.getItem("polazu-ui-editor-draft");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as EditableUi[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setItems(savedUiSeed.map((seed) => ({ ...seed, ...parsed.find((item) => item.id === seed.id) })));
        }
      } catch {
        window.localStorage.removeItem("polazu-ui-editor-draft");
      }
    }
    const storedCategories = window.localStorage.getItem("polazu-component-categories");
    if (storedCategories) {
      try {
        const parsed = JSON.parse(storedCategories) as SavedCategory[];
        if (Array.isArray(parsed)) setCategories(parsed);
      } catch {
        window.localStorage.removeItem("polazu-component-categories");
      }
    }
    const id = Number(new URLSearchParams(window.location.search).get("componentId"));
    if (savedUiSeed.some((item) => item.id === id)) setSelectedId(id);
  }, []);

  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const category = categories.find((item) => item.id === selectedCategory);
  const visibleItems = category ? items.filter((item) => category.itemIds.includes(item.id)) : items;
  const code = useMemo(() => makeReactCode(selected), [selected]);

  function selectCategory(categoryId: number | null) {
    setSelectedCategory(categoryId);
    const nextCategory = categories.find((item) => item.id === categoryId);
    const firstItem = nextCategory ? items.find((item) => nextCategory.itemIds.includes(item.id)) : items[0];
    if (firstItem) setSelectedId(firstItem.id);
    setSelectedElement("container");
  }

  function selectUi(id: number) {
    setSelectedId(id);
    setSelectedElement("container");
  }

  function update<K extends keyof EditableUi>(key: K, value: EditableUi[K]) {
    setItems((current) => {
      const next = current.map((item) => item.id === selectedId ? { ...item, [key]: value } : item);
      setUndoStack((stack) => [...stack, current].slice(-50));
      setRedoStack([]);
      return next;
    });
  }

  function undo() {
    if (!undoStack.length) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [items, ...stack].slice(0, 50));
    setItems(previous);
  }

  function redo() {
    if (!redoStack.length) return;
    const next = redoStack[0];
    setRedoStack((stack) => stack.slice(1));
    setUndoStack((stack) => [...stack, items].slice(-50));
    setItems(next);
  }

  function selectElement(key: ElementKey) {
    if (mode === "design") setSelectedElement(key);
  }

  function handleElementClick(event: MouseEvent<HTMLElement>, key: ElementKey) {
    if (mode !== "design") return;
    event.stopPropagation();
    setSelectedElement(key);
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  }

  function save() {
    window.localStorage.setItem("polazu-ui-editor-draft", JSON.stringify(items));
    flash("임시 저장했습니다. API 연결 후 마이페이지에 영구 반영됩니다.");
  }

  async function copyCode() {
    await navigator.clipboard.writeText(code);
    flash("React 코드를 복사했습니다.");
  }

  function elementClass(key: ElementKey) {
    return selectedElement === key ? "saved-editor-element is-selected" : "saved-editor-element";
  }

  return (
    <section className={mode === "preview" ? "saved-editor is-preview" : "saved-editor"}>
      <div className="studio-toolbar saved-ui-studio-toolbar">
        <div className="studio-modes" role="group" aria-label="UI 편집 모드">
          <button type="button" className={mode === "design" ? "active" : ""} onClick={() => setMode("design")}>↖ Design</button>
          <button type="button" className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}>▷ Preview</button>
        </div>
        <div className="studio-history">
          <button type="button" title="실행 취소" aria-label="실행 취소" disabled={!undoStack.length} onClick={undo}>↶</button>
          <button type="button" title="다시 실행" aria-label="다시 실행" disabled={!redoStack.length} onClick={redo}>↷</button>
        </div>
        <div className="saved-ui-path"><span>◇</span><strong>{selected.name}</strong><small>{selected.type}</small></div>
        <select aria-label="화면 배율" value={zoom} onChange={(event) => setZoom(Number(event.target.value))}>
          {[40, 50, 60, 75, 90, 100, 125].map((value) => <option key={value} value={value}>{value}%</option>)}
        </select>
        <span className="saved-ui-toolbar-spacer" />
        <button type="button" onClick={save}>저장</button>
        <button type="button" className="studio-primary" onClick={() => void copyCode()}>코드 복사</button>
      </div>

      <div className="saved-editor-workspace">
        <aside className="saved-editor-library">
          <div className="studio-tabs saved-editor-tabs">
            <button className={leftTab === "components" ? "active" : ""} onClick={() => setLeftTab("components")}>UI 목록</button>
            <button className={leftTab === "layers" ? "active" : ""} onClick={() => setLeftTab("layers")}>레이어</button>
          </div>
          {leftTab === "components" && <><div className="saved-editor-panel-title"><span>MY COMPONENTS</span><b>{visibleItems.length}</b></div><div className="saved-editor-categories">
              <button type="button" className={selectedCategory === null ? "active" : ""} onClick={() => selectCategory(null)}>ALL</button>
              {categories.map((item) => <button type="button" key={item.id} className={selectedCategory === item.id ? "active" : ""} onClick={() => selectCategory(item.id)}>{item.name}</button>)}
          </div><div className="saved-editor-list">
              {visibleItems.map((item) => <button type="button" key={item.id} className={item.id === selectedId ? "active" : ""} onClick={() => selectUi(item.id)}><i style={{ background: item.background }}><em style={{ background: item.accent }} /></i><span><b>{item.name}</b><small>{item.type}</small></span></button>)}
              {visibleItems.length === 0 && <p className="saved-editor-list-empty">이 카테고리에 포함된 UI가 없습니다.</p>}
          </div></>}
          {leftTab === "layers" && <><div className="saved-editor-panel-title"><span>LAYERS</span><b>{Object.keys(layerLabels).length}</b></div><div className="saved-editor-layers">
              {(Object.keys(layerLabels) as ElementKey[]).map((key, index) => <button type="button" key={key} className={selectedElement === key ? "active" : ""} style={{ paddingLeft: 11 + Math.min(index, 2) * 7 }} onClick={() => selectElement(key)}><span>{key === "eyebrow" || key === "heading" || key === "label" ? "T" : "◇"}</span>{layerLabels[key]}</button>)}
          </div></>}
          <div className="saved-editor-left-footer">{items.length} items · {categories.length} categories</div>
        </aside>

        <section className="saved-editor-canvas" aria-label="UI 편집 캔버스">
          <div className="saved-editor-canvas-label"><span>{mode === "design" ? "DESIGN CANVAS" : "INTERACTIVE PREVIEW"}</span><small>UI COMPONENT</small></div>
          <div className="saved-editor-canvas-scroll"><div className="saved-editor-frame" style={{ zoom: zoom / 100 }}>
              <article className={elementClass("container")} style={{ background: selected.background, color: selected.textColor, borderRadius: selected.radius, padding: selected.padding, borderColor: selected.borderColor, borderWidth: selected.borderWidth, boxShadow: `0 ${Math.round(selected.shadow / 2)}px ${selected.shadow * 2}px rgba(0,0,0,.12)` }} onClick={(event) => handleElementClick(event, "container")}>
                <p className={elementClass("eyebrow")} style={{ color: selected.eyebrowColor, fontSize: selected.eyebrowSize }} onClick={(event) => handleElementClick(event, "eyebrow")}>{selected.eyebrow}</p>
                <h2 className={elementClass("heading")} style={{ color: selected.headingColor, fontSize: selected.headingSize }} onClick={(event) => handleElementClick(event, "heading")}>{selected.heading}</h2>
                <label className={elementClass("label")} style={{ color: selected.labelColor, fontSize: selected.labelSize }} onClick={(event) => handleElementClick(event, "label")}>{selected.label}</label>
                <div>
                  <input className={elementClass("input")} style={{ background: selected.inputBackground, color: selected.inputTextColor, borderColor: selected.inputBorder, borderRadius: selected.inputRadius, height: selected.inputHeight }} readOnly={mode !== "preview"} placeholder={selected.placeholder} onClick={(event) => handleElementClick(event, "input")} />
                  <button className={elementClass("button")} type="button" style={{ background: selected.accent, color: selected.buttonTextColor, fontSize: selected.buttonTextSize, padding: `${selected.buttonPaddingY}px ${selected.buttonPaddingX}px`, borderRadius: selected.buttonRadius }} onClick={(event) => { handleElementClick(event, "button"); if (mode === "preview") flash(`${selected.buttonText} 버튼을 실행했습니다.`); }}>{selected.buttonText}</button>
                </div>
              </article>
          </div></div>
          <div className="saved-editor-bottom"><span>● 편집 가능</span><p>{notice || (mode === "design" ? "요소를 클릭하여 선택하세요." : "컴포넌트를 미리보고 있습니다.")}</p><b>{undoStack.length} changes</b></div>
        </section>

        <aside className="saved-editor-properties">
          <div className="studio-tabs saved-editor-right-tabs">
            <button className={rightTab === "design" ? "active" : ""} onClick={() => setRightTab("design")}>디자인</button>
            <button className={rightTab === "code" ? "active" : ""} onClick={() => setRightTab("code")}>코드</button>
          </div>
          {rightTab === "design" ? <>
          <div className="saved-editor-panel-title"><span>PROPERTIES</span><b>{selectedElement.toUpperCase()}</b></div>

          {selectedElement === "container" && <>
            <label>컴포넌트 이름<input value={selected.name} onChange={(event) => update("name", event.target.value)} maxLength={40} /></label>
            <ColorField label="배경 색상" value={selected.background} onChange={(value) => update("background", value)} />
            <ColorField label="기본 글자 색상" value={selected.textColor} onChange={(value) => update("textColor", value)} />
            <ColorField label="테두리 색상" value={selected.borderColor} onChange={(value) => update("borderColor", value)} />
            <label>테두리 두께 <output>{selected.borderWidth}px</output><input type="range" min="0" max="8" value={selected.borderWidth} onChange={(event) => update("borderWidth", Number(event.target.value))} /></label>
            <label>모서리 둥글기 <output>{selected.radius}px</output><input type="range" min="0" max="36" value={selected.radius} onChange={(event) => update("radius", Number(event.target.value))} /></label>
            <label>안쪽 여백 <output>{selected.padding}px</output><input type="range" min="16" max="56" value={selected.padding} onChange={(event) => update("padding", Number(event.target.value))} /></label>
            <label>그림자 <output>{selected.shadow}px</output><input type="range" min="0" max="40" value={selected.shadow} onChange={(event) => update("shadow", Number(event.target.value))} /></label>
          </>}
          {selectedElement === "eyebrow" && <>
            <label>텍스트<input value={selected.eyebrow} onChange={(event) => update("eyebrow", event.target.value)} maxLength={40} /></label>
            <ColorField label="글자 색상" value={selected.eyebrowColor} onChange={(value) => update("eyebrowColor", value)} />
            <label>글자 크기 <output>{selected.eyebrowSize}px</output><input type="range" min="8" max="24" value={selected.eyebrowSize} onChange={(event) => update("eyebrowSize", Number(event.target.value))} /></label>
          </>}
          {selectedElement === "heading" && <>
            <label>제목<textarea rows={3} value={selected.heading} onChange={(event) => update("heading", event.target.value)} maxLength={80} /></label>
            <ColorField label="글자 색상" value={selected.headingColor} onChange={(value) => update("headingColor", value)} />
            <label>글자 크기 <output>{selected.headingSize}px</output><input type="range" min="16" max="52" value={selected.headingSize} onChange={(event) => update("headingSize", Number(event.target.value))} /></label>
          </>}
          {selectedElement === "label" && <>
            <label>텍스트<input value={selected.label} onChange={(event) => update("label", event.target.value)} maxLength={40} /></label>
            <ColorField label="글자 색상" value={selected.labelColor} onChange={(value) => update("labelColor", value)} />
            <label>글자 크기 <output>{selected.labelSize}px</output><input type="range" min="10" max="24" value={selected.labelSize} onChange={(event) => update("labelSize", Number(event.target.value))} /></label>
          </>}
          {selectedElement === "input" && <>
            <label>안내 문구<input value={selected.placeholder} onChange={(event) => update("placeholder", event.target.value)} maxLength={60} /></label>
            <ColorField label="배경 색상" value={selected.inputBackground} onChange={(value) => update("inputBackground", value)} />
            <ColorField label="글자 색상" value={selected.inputTextColor} onChange={(value) => update("inputTextColor", value)} />
            <ColorField label="테두리 색상" value={selected.inputBorder} onChange={(value) => update("inputBorder", value)} />
            <label>높이 <output>{selected.inputHeight}px</output><input type="range" min="32" max="68" value={selected.inputHeight} onChange={(event) => update("inputHeight", Number(event.target.value))} /></label>
            <label>모서리 둥글기 <output>{selected.inputRadius}px</output><input type="range" min="0" max="28" value={selected.inputRadius} onChange={(event) => update("inputRadius", Number(event.target.value))} /></label>
          </>}
          {selectedElement === "button" && <>
            <label>버튼 문구<input value={selected.buttonText} onChange={(event) => update("buttonText", event.target.value)} maxLength={30} /></label>
            <ColorField label="버튼 색상" value={selected.accent} onChange={(value) => update("accent", value)} />
            <ColorField label="글자 색상" value={selected.buttonTextColor} onChange={(value) => update("buttonTextColor", value)} />
            <label>글자 크기 <output>{selected.buttonTextSize}px</output><input type="range" min="10" max="24" value={selected.buttonTextSize} onChange={(event) => update("buttonTextSize", Number(event.target.value))} /></label>
            <label>좌우 여백 <output>{selected.buttonPaddingX}px</output><input type="range" min="8" max="40" value={selected.buttonPaddingX} onChange={(event) => update("buttonPaddingX", Number(event.target.value))} /></label>
            <label>상하 여백 <output>{selected.buttonPaddingY}px</output><input type="range" min="6" max="24" value={selected.buttonPaddingY} onChange={(event) => update("buttonPaddingY", Number(event.target.value))} /></label>
            <label>모서리 둥글기 <output>{selected.buttonRadius}px</output><input type="range" min="0" max="28" value={selected.buttonRadius} onChange={(event) => update("buttonRadius", Number(event.target.value))} /></label>
          </>}
          </> : <section className="saved-editor-code saved-editor-code-panel">
            <header><div><span>REAL-TIME CODE</span><b>React · JSX</b></div><button type="button" onClick={() => void copyCode()}>복사</button></header>
            <pre><code>{code}</code></pre>
          </section>}
          <div className="saved-editor-right-footer">{undoStack.length} changes · 실시간 수정 내역</div>
        </aside>
      </div>
      {notice && <p className="saved-editor-toast" role="status">{notice}</p>}
    </section>
  );
}

(() => {
  "use strict";
  const config = window.__POLAZU_CONFIG__;
  if (!config || typeof config.token !== "string" || typeof config.origin !== "string") return;

  const STYLE_PROPS = [
    "position","inset","top","right","bottom","left","zIndex","overflow","overflowX","overflowY",
    "display","visibility","opacity","width","height","minWidth","minHeight","maxWidth","maxHeight",
    "margin","marginTop","marginRight","marginBottom","marginLeft","padding","paddingTop","paddingRight","paddingBottom","paddingLeft",
    "gap","rowGap","columnGap","flexDirection","flexWrap","flexGrow","flexShrink","flexBasis","alignItems","alignSelf","alignContent","justifyContent","justifyItems","justifySelf","order",
    "gridTemplateColumns","gridTemplateRows","gridColumn","gridRow","placeItems","placeContent",
    "color","background","backgroundColor","backgroundImage","backgroundSize","backgroundPosition","backgroundRepeat",
    "fontFamily","fontSize","fontWeight","fontStyle","lineHeight","letterSpacing","textAlign","textDecoration","textTransform","whiteSpace","wordBreak","textOverflow",
    "border","borderWidth","borderStyle","borderColor","borderRadius","outline","boxShadow","filter","backdropFilter","mixBlendMode",
    "objectFit","objectPosition","aspectRatio","transform","transformOrigin","translate","rotate","scale","cursor","pointerEvents"
  ];
  const STYLE_SET = new Set(STYLE_PROPS);
  const REPARENT_CONTAINER_TAGS = new Set(["BODY","MAIN","SECTION","ARTICLE","ASIDE","HEADER","FOOTER","NAV","DIV","FORM","FIELDSET","UL","OL","LI","FIGURE","BLOCKQUOTE","DETAILS","DIALOG"]);
  const originalFetch = window.fetch.bind(window);
  const NativeXHR = window.XMLHttpRequest;
  const originals = new Map();
  const originalOrders = new Map();
  const reparentOrigins = new WeakMap();
  const selected = [];
  const locked = new Set();
  const aliases = new Map();
  let mode = "edit";
  let tool = "select";
  let snap = true;
  let gridSize = 8;
  let rules = [];
  let edits = [];
  let wireframe = false;
  let scheduled = false;
  let overlayRoot;
  let hoverBox;
  let hoverTarget = null;
  let dragState = null;
  let dragFrame = null;
  let lastDragPoint = null;
  let internalMutation = false;
  let internalMutationTimer = 0;
  let clipboard = null;
  let spacePressed = false;
  let panState = null;
  let marqueeState = null;
  let marqueeBox = null;
  let textEdit = null;
  const documentId = crypto.randomUUID();

  const send = (type, payload = {}) => parent.postMessage({ source: "polazu-preview", token: config.token, type, ...payload }, config.origin);
  const currentPath = () => location.pathname;
  const ignored = (el) => !el || /^(SCRIPT|STYLE|LINK|META|NOSCRIPT|NEXTJS-PORTAL)$/.test(el.tagName) || !!el.closest("[data-polazu-overlay]");
  const safeCssValue = (value) => typeof value === "string" && value.length < 300 && !/expression\s*\(|javascript:|url\s*\(\s*['\"]?javascript:/i.test(value);
  const snapValue = (value) => snap ? Math.round(value / Math.max(1, gridSize)) * Math.max(1, gridSize) : Math.round(value);

  function selector(el) {
    if (el === document.body) return "body";
    if (el === document.documentElement) return "html";
    const parts = [];
    let node = el;
    while (node && node !== document.body && node.parentElement) {
      if (node.id && /^[A-Za-z][\w:-]*$/.test(node.id) && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      const tag = node.tagName.toLowerCase();
      const siblings = [...node.parentElement.children].filter((candidate) => candidate.tagName === node.tagName);
      parts.unshift(`${tag}:nth-of-type(${siblings.indexOf(node) + 1})`);
      node = node.parentElement;
    }
    return (parts[0]?.startsWith("#") ? "" : "body > ") + parts.join(" > ");
  }

  function sourceId(el) {
    return el.getAttribute("data-polazu-source") || undefined;
  }

  function elementLabel(el) {
    const alias = aliases.get(selector(el));
    if (alias) return alias;
    const text = el.childElementCount === 0 || /^(H[1-6]|P|BUTTON|A|LABEL|SUMMARY)$/.test(el.tagName) ? el.innerText : "";
    const identity = el.id ? `#${el.id}` : el.classList.length ? `.${[...el.classList].find((name)=>!name.startsWith("polazu-")) || el.tagName.toLowerCase()}` : el.tagName.toLowerCase();
    return (el.getAttribute("aria-label") || el.getAttribute("alt") || el.getAttribute("title") || text || identity).trim().replace(/\s+/g, " ").slice(0, 80);
  }

  function styleSnapshot(el) {
    const computed = getComputedStyle(el);
    return Object.fromEntries(STYLE_PROPS.map((name) => [name, computed[name] || ""]));
  }

  function describe(el) {
    const box = el.getBoundingClientRect();
    const parent = el.parentElement;
    const attrs = {};
    for (const name of ["id","class","href","src","alt","title","role","aria-label","aria-describedby","type","name","placeholder","data-action","data-target"]) {
      const value = el.getAttribute(name);
      if (value != null) attrs[name] = value;
    }
    return {
      selector: selector(el),
      sourceId: sourceId(el),
      generatedId: el.dataset.polazuGenerated || undefined,
      tag: el.tagName.toLowerCase(),
      label: elementLabel(el),
      depth: Math.min(18, selector(el).split(" > ").length - 1),
      parentSelector: parent && !ignored(parent) ? selector(parent) : undefined,
      childCount: el.children.length,
      hidden: getComputedStyle(el).visibility === "hidden" || getComputedStyle(el).display === "none",
      locked: locked.has(selector(el)),
      text: el.childElementCount === 0 ? el.textContent || "" : "",
      editableText: el.childElementCount === 0 && !["INPUT","TEXTAREA","SELECT","IMG","SVG","VIDEO","CANVAS"].includes(el.tagName),
      styles: styleSnapshot(el),
      attributes: attrs,
      width: Math.round(box.width),
      height: Math.round(box.height),
      x: Math.round(box.x),
      y: Math.round(box.y),
      parentDisplay: parent ? getComputedStyle(parent).display : "",
    };
  }

  function visibleElements() {
    return [...document.body.querySelectorAll("*")]
      .filter((el) => el instanceof HTMLElement && !ignored(el) && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0)
      .slice(0, 1000);
  }

  function layerFor(el) {
    return {
      selector: selector(el), sourceId: sourceId(el), generatedId:el.dataset.polazuGenerated || undefined, tag: el.tagName.toLowerCase(), label: elementLabel(el),
      depth: Math.min(18, selector(el).split(" > ").length - 1), parentSelector: el.parentElement && !ignored(el.parentElement) ? selector(el.parentElement) : undefined,
      childCount: el.children.length, hidden: getComputedStyle(el).visibility === "hidden" || getComputedStyle(el).display === "none", locked: locked.has(selector(el)),
    };
  }

  function saveOriginal(el) {
    if (!originals.has(el)) {
      originals.set(el, {
        style: el.getAttribute("style"), text: el.textContent, disabled: el.disabled,
        busy: el.getAttribute("aria-busy"), contentEditable: el.getAttribute("contenteditable"), attributes:new Map(),
      });
    }
  }

  function saveOriginalAttribute(el, name) {
    saveOriginal(el);
    const saved = originals.get(el);
    if (!saved.attributes.has(name)) saved.attributes.set(name, el.hasAttribute(name) ? el.getAttribute(name) : null);
  }

  function restoreOriginals() {
    for (const [el, saved] of originals) {
      if (!el.isConnected) { originals.delete(el); continue; }
      if (saved.style === null) el.removeAttribute("style"); else el.setAttribute("style", saved.style);
      if (el.childElementCount === 0 && el.textContent !== saved.text) el.textContent = saved.text;
      if (el instanceof HTMLButtonElement) el.disabled = saved.disabled;
      if (saved.busy === null) el.removeAttribute("aria-busy"); else el.setAttribute("aria-busy", saved.busy);
      if (saved.contentEditable === null) el.removeAttribute("contenteditable"); else el.setAttribute("contenteditable", saved.contentEditable);
      for (const [name, value] of saved.attributes) {
        if (value === null) el.removeAttribute(name); else el.setAttribute(name, value);
      }
      el.removeAttribute("data-polazu-deleted");
    }
    document.querySelectorAll("[data-polazu-generated]").forEach((node) => node.remove());
    for (const el of originals.keys()) if (!el.isConnected) originals.delete(el);
    for (const [parentEl, children] of originalOrders) {
      if (parentEl.isConnected) for (const child of children) if (child.isConnected) parentEl.appendChild(child);
    }
  }

  function applyStyle(el, styles) {
    saveOriginal(el);
    internalMutation = true; clearTimeout(internalMutationTimer);
    for (const [key, value] of Object.entries(styles || {})) {
      if (STYLE_SET.has(key) && safeCssValue(value)) el.style[key] = value;
    }
    internalMutationTimer = setTimeout(() => { internalMutation = false; }, 0);
  }

  function responsiveMatch(target) {
    if (!target || target === "base") return true;
    if (target === "desktop") return innerWidth >= 1024;
    if (target === "tablet") return innerWidth >= 640 && innerWidth < 1024;
    if (target === "mobile") return innerWidth < 640;
    return true;
  }

  function replay() {
    if (textEdit || dragState) return;
    const selectionReferences = selected.map((el)=>({ el, generatedId:el.dataset.polazuGenerated, sourceId:sourceId(el), selector:selector(el) }));
    beginInternalMutation();
    restoreOriginals();
    for (const edit of edits.filter((item) => item && item.path === currentPath() && responsiveMatch(item.responsive))) {
      let el;
      try { el = edit.generatedId ? document.querySelector(`[data-polazu-generated=${JSON.stringify(edit.generatedId)}]`) : edit.sourceId ? document.querySelector(`[data-polazu-source=${JSON.stringify(edit.sourceId)}]`) : document.querySelector(edit.selector); } catch { continue; }
      if (!(el instanceof HTMLElement) || ignored(el)) continue;
      if (edit.operation?.type === "reorder") { reorderOneStep(el, edit.operation.direction); continue; }
      if (edit.operation?.type === "reparent") {
        let target;
        try { target = edit.operation.targetParentSourceId ? document.querySelector(`[data-polazu-source=${JSON.stringify(edit.operation.targetParentSourceId)}]`) : document.querySelector(edit.operation.targetParentSelector); } catch { continue; }
        if (!(target instanceof HTMLElement) || !safeReparentContainer(target, el)) continue;
        rememberOriginalOrder(el.parentElement); rememberOriginalOrder(target);
        beginInternalMutation(); target.appendChild(el); continue;
      }
      if (edit.operation?.type === "delete") {
        saveOriginal(el); el.style.display = "none"; el.dataset.polazuDeleted = "true"; continue;
      }
      if (edit.operation?.type === "duplicate") {
        const id = edit.id || `${edit.selector}-duplicate`;
        if (!document.querySelector(`[data-polazu-generated=${JSON.stringify(id)}]`)) {
          const clone = el.cloneNode(true); clone.dataset.polazuGenerated = id; el.after(clone);
        }
        continue;
      }
      if (edit.operation?.type === "insert") {
        const id = edit.id || `${edit.selector}-insert`;
        if (!document.querySelector(`[data-polazu-generated=${JSON.stringify(id)}]`)) {
          const wrapper = document.createElement("div"); wrapper.innerHTML = edit.operation.html;
          const node = wrapper.firstElementChild;
          if (node) { node.dataset.polazuGenerated = id; el.appendChild(node); }
        }
        continue;
      }
      saveOriginal(el);
      for (const [name, value] of Object.entries(edit.attributes || {})) {
        if (/^(?:id|class|href|src|alt|title|role|target|rel|type|name|placeholder|aria-[a-z-]+|data-[a-z-]+)$/.test(name) && typeof value === "string" && value.length < 1000) {
          saveOriginalAttribute(el, name); el.setAttribute(name, value);
        }
      }
      if (typeof edit.text === "string" && el.childElementCount === 0 && !["INPUT","TEXTAREA","SELECT"].includes(el.tagName)) el.textContent = edit.text;
      applyStyle(el, edit.styles);
      if (edit.state && el instanceof HTMLButtonElement) {
        el.disabled = edit.state !== "default";
        el.setAttribute("aria-busy", edit.state === "loading" ? "true" : "false");
        if (edit.state === "loading" && el.childElementCount === 0) el.textContent = "Loading…";
      }
    }
    selected.splice(0, selected.length, ...selectionReferences.map((reference)=>{
      if (reference.el.isConnected) return reference.el;
      try {
        return reference.generatedId ? document.querySelector(`[data-polazu-generated=${JSON.stringify(reference.generatedId)}]`)
          : reference.sourceId ? document.querySelector(`[data-polazu-source=${JSON.stringify(reference.sourceId)}]`) : document.querySelector(reference.selector);
      } catch { return null; }
    }).filter((el)=>el instanceof HTMLElement && !ignored(el)));
    drawSelection();
    const primary = selected.at(-1);
    const elements = selected.map(describe);
    send("selection-refresh", { element:elements.at(-1) || null, elements, breadcrumbs:primary ? ancestors(primary) : [] });
    scheduleReport();
  }

  function clearOverlayChildren() {
    if (!overlayRoot) return;
    overlayRoot.querySelectorAll("[data-polazu-selection-box]").forEach((node) => node.remove());
  }

  function makeOverlayBox(el, primary, controls = true) {
    const box = el.getBoundingClientRect();
    const outline = document.createElement("div");
    outline.dataset.polazuSelectionBox = "true";
    outline.style.cssText = `position:fixed;left:${box.left}px;top:${box.top}px;width:${box.width}px;height:${box.height}px;box-sizing:border-box;border:${primary ? 2 : 1}px solid ${primary ? "#ff4d0a" : "#7c3aed"};pointer-events:none;z-index:2147483646;`;
    if (primary && controls) {
      const label = document.createElement("button");
      label.type = "button";
      label.textContent = `${el.tagName.toLowerCase()} · ${Math.round(box.width)}×${Math.round(box.height)}`;
      label.title = "드래그하여 이동";
      label.style.cssText = "position:absolute;left:-2px;top:-25px;height:22px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 7px;border:0;border-radius:4px;background:#ff4d0a;color:white;font:600 11px/22px system-ui;pointer-events:auto;cursor:move;";
      label.addEventListener("pointerdown", (event) => beginManipulation(event, el, "move"));
      outline.appendChild(label);
      for (const handle of ["nw","n","ne","e","se","s","sw","w"]) {
        const node = document.createElement("button");
        node.type = "button"; node.dataset.handle = handle; node.setAttribute("aria-label", `${handle} resize handle`);
        const positions = { nw:[-5,-5],n:["50%",-5],ne:["100%",-5],e:["100%","50%"],se:["100%","100%"],s:["50%","100%"],sw:[-5,"100%"],w:[-5,"50%"] };
        const [left, top] = positions[handle];
        node.style.cssText = `position:absolute;left:${typeof left === "number" ? left+"px" : left};top:${typeof top === "number" ? top+"px" : top};width:10px;height:10px;margin-left:${typeof left === "string" ? "-5px" : "0"};margin-top:${typeof top === "string" ? "-5px" : "0"};padding:0;border:1px solid #ff4d0a;border-radius:2px;background:white;pointer-events:auto;cursor:${handle}-resize;`;
        node.addEventListener("pointerdown", (event) => beginManipulation(event, el, handle));
        outline.appendChild(node);
      }
    }
    return outline;
  }

  function makeSelectionGroupBox(elements) {
    const rects = elements.map((el) => el.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0);
    if (rects.length < 2) return null;
    const left = Math.min(...rects.map((rect) => rect.left));
    const top = Math.min(...rects.map((rect) => rect.top));
    const right = Math.max(...rects.map((rect) => rect.right));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    const outline = document.createElement("div");
    outline.dataset.polazuSelectionBox = "true";
    outline.dataset.polazuSelectionGroup = "true";
    outline.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:${right-left}px;height:${bottom-top}px;box-sizing:border-box;border:1px dashed #ff4d0a;pointer-events:none;z-index:2147483647;`;
    const label = document.createElement("button");
    label.type = "button";
    label.textContent = `${elements.length}개 선택 · ${Math.round(right-left)}×${Math.round(bottom-top)}`;
    label.title = "선택한 요소를 함께 이동";
    label.setAttribute("aria-label", `${elements.length}개 선택, 드래그하여 함께 이동`);
    label.style.cssText = "position:absolute;left:-1px;top:-25px;height:22px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 7px;border:0;border-radius:4px;background:#ff4d0a;color:white;font:600 11px/22px system-ui;pointer-events:auto;cursor:move;";
    label.addEventListener("pointerdown", (event) => beginManipulation(event, elements.at(-1), "move"));
    outline.appendChild(label);
    return outline;
  }

  function drawSelection() {
    if (!overlayRoot) return;
    clearOverlayChildren();
    if (mode !== "edit") return;
    const connected = selected.filter((el) => el?.isConnected);
    const grouped = connected.length > 1;
    connected.forEach((el, index) => overlayRoot.appendChild(makeOverlayBox(el, grouped ? false : index === connected.length - 1, !grouped)));
    if (grouped) {
      const groupBox = makeSelectionGroupBox(connected);
      if (groupBox) overlayRoot.appendChild(groupBox);
    }
  }

  function drawHover(el) {
    hoverTarget = el;
    if (!hoverBox) return;
    if (!el || mode !== "edit" || tool !== "select" || selected.includes(el) || !el.isConnected) { hoverBox.hidden = true; return; }
    const box = el.getBoundingClientRect();
    Object.assign(hoverBox.style, { left:`${box.left}px`, top:`${box.top}px`, width:`${box.width}px`, height:`${box.height}px` });
    hoverBox.hidden = false;
  }

  function selectElement(el, additive = false) {
    if (!(el instanceof HTMLElement) || ignored(el)) return;
    if (locked.has(selector(el))) { send("notice", { message:"잠긴 레이어입니다. 레이어 패널에서 잠금을 해제하세요." }); return; }
    closeContextMenu();
    if (!additive) selected.splice(0, selected.length);
    const existing = selected.indexOf(el);
    if (additive && existing >= 0) selected.splice(existing, 1); else selected.push(el);
    drawSelection();
    const primary = selected[selected.length - 1];
    send("selected", { element: primary ? describe(primary) : null, elements: selected.map(describe), breadcrumbs: primary ? ancestors(primary) : [] });
  }

  function navigateSelection(direction) {
    const primary = selected.at(-1);
    if (!primary) return;
    const selectable = (el) => el instanceof HTMLElement && !ignored(el) && !locked.has(selector(el)) && getComputedStyle(el).display !== "none";
    let target;
    if (direction === "parent") target = primary.parentElement;
    else if (direction === "child") target = [...primary.children].find(selectable);
    else {
      const siblings = [...(primary.parentElement?.children || [])].filter(selectable);
      const index = siblings.indexOf(primary);
      target = siblings[(index + (direction === "previous" ? -1 : 1) + siblings.length) % siblings.length];
    }
    if (target === document.documentElement) { deselect(); return; }
    if (selectable(target)) selectElement(target);
  }

  function ancestors(el) {
    const result = [];
    let node = el;
    while (node && node instanceof HTMLElement && node !== document.documentElement) {
      if (!ignored(node)) result.unshift(layerFor(node));
      node = node.parentElement;
    }
    return result.slice(-8);
  }

  function deselect() {
    closeContextMenu();
    selected.splice(0, selected.length); drawSelection(); send("selected", { element:null, elements:[], breadcrumbs:[] });
  }

  function rectIntersects(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function isMarqueeSurface(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el === document.body || el === document.documentElement) return true;
    return el.parentElement === document.body && el.childElementCount > 0;
  }

  function marqueeCandidates(surface, bounds) {
    const root = surface === document.documentElement ? document.body : surface;
    if (!(root instanceof HTMLElement)) return [];
    const matches = [...root.querySelectorAll("*")].filter((el) => {
      if (!(el instanceof HTMLElement) || ignored(el) || locked.has(selector(el))) return false;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && rectIntersects(rect, bounds);
    }).slice(0, 1000);
    return matches.filter((candidate) => !matches.some((other) => other !== candidate && candidate.contains(other)));
  }

  function composeMarqueeSelection(base, hits, additive) {
    if (!additive) return [...hits];
    const hitSet = new Set(hits);
    const baseSet = new Set(base);
    return [...base.filter((el) => !hitSet.has(el)), ...hits.filter((el) => !baseSet.has(el))];
  }

  function emitSelected() {
    const primary = selected.at(-1);
    send("selected", { element:primary ? describe(primary) : null, elements:selected.map(describe), breadcrumbs:primary ? ancestors(primary) : [] });
  }

  function removeMarqueeBox() {
    marqueeBox?.remove();
    marqueeBox = null;
  }

  function updateMarquee(event) {
    if (!marqueeState) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const dx = event.clientX - marqueeState.startX;
    const dy = event.clientY - marqueeState.startY;
    if (!marqueeState.moved && Math.hypot(dx, dy) < 4) return;
    if (!marqueeState.moved) {
      marqueeState.moved = true;
      try { document.documentElement.setPointerCapture?.(marqueeState.pointerId); } catch {}
      marqueeBox = document.createElement("div");
      marqueeBox.dataset.polazuMarqueeBox = "true";
      marqueeBox.style.cssText = "position:fixed;box-sizing:border-box;border:1px solid #8b5cf6;background:rgba(139,92,246,.12);pointer-events:none;z-index:2147483647;";
      overlayRoot?.appendChild(marqueeBox);
    }
    const bounds = {
      left:Math.min(marqueeState.startX, event.clientX), top:Math.min(marqueeState.startY, event.clientY),
      right:Math.max(marqueeState.startX, event.clientX), bottom:Math.max(marqueeState.startY, event.clientY),
    };
    bounds.width = bounds.right - bounds.left; bounds.height = bounds.bottom - bounds.top;
    if (marqueeBox) Object.assign(marqueeBox.style, { left:`${bounds.left}px`, top:`${bounds.top}px`, width:`${bounds.width}px`, height:`${bounds.height}px` });
    const next = composeMarqueeSelection(marqueeState.base, marqueeCandidates(marqueeState.surface, bounds), marqueeState.additive);
    if (next.length === selected.length && next.every((el, index) => el === selected[index])) return;
    selected.splice(0, selected.length, ...next);
    drawSelection();
    emitSelected();
  }

  function finishMarquee(event) {
    removeEventListener("pointermove", updateMarquee, true);
    removeEventListener("pointerup", finishMarquee, true);
    removeEventListener("pointercancel", cancelMarquee, true);
    if (!marqueeState) return;
    event?.preventDefault?.(); event?.stopImmediatePropagation?.();
    const state = marqueeState;
    if (state.moved && event) updateMarquee(event);
    marqueeState = null;
    document.documentElement.removeAttribute("data-polazu-marquee");
    removeMarqueeBox();
    if (document.documentElement.hasPointerCapture?.(state.pointerId)) document.documentElement.releasePointerCapture(state.pointerId);
    if (!state.moved && !state.additive) deselect();
  }

  function cancelMarquee() {
    removeEventListener("pointermove", updateMarquee, true);
    removeEventListener("pointerup", finishMarquee, true);
    removeEventListener("pointercancel", cancelMarquee, true);
    if (!marqueeState) return;
    const state = marqueeState;
    marqueeState = null;
    document.documentElement.removeAttribute("data-polazu-marquee");
    selected.splice(0, selected.length, ...state.base);
    removeMarqueeBox();
    if (document.documentElement.hasPointerCapture?.(state.pointerId)) document.documentElement.releasePointerCapture(state.pointerId);
    drawSelection(); emitSelected();
  }

  function beginMarquee(event, surface) {
    if (marqueeState || dragState || panState || textEdit) return;
    event.preventDefault(); event.stopImmediatePropagation();
    closeContextMenu();
    marqueeState = { startX:event.clientX, startY:event.clientY, pointerId:event.pointerId, surface, additive:event.shiftKey, base:[...selected], moved:false };
    document.documentElement.setAttribute("data-polazu-marquee", "true");
    drawHover(null);
    addEventListener("pointermove", updateMarquee, true);
    addEventListener("pointerup", finishMarquee, { capture:true, once:true });
    addEventListener("pointercancel", cancelMarquee, { capture:true, once:true });
  }

  function layoutDragInfo(el) {
    const parent = el.parentElement;
    if (!(parent instanceof HTMLElement) || ignored(parent)) return null;
    const parentStyle = getComputedStyle(parent);
    const display = parentStyle.display;
    const kind = /^(?:inline-)?flex$/.test(display) ? "flex" : /^(?:inline-)?grid$/.test(display) ? "grid" : null;
    if (!kind) return null;
    const position = getComputedStyle(el).position;
    if (position === "absolute" || position === "fixed") return null;
    const participants = [...parent.children].filter((node) => {
      if (!(node instanceof HTMLElement) || ignored(node)) return false;
      const style = getComputedStyle(node);
      return style.display !== "none" && style.position !== "absolute" && style.position !== "fixed";
    });
    if (kind === "flex" && new Set(participants.map((node) => getComputedStyle(node).order)).size > 1) {
      return { parent, kind, blocked:"CSS order 값이 다른 flex 항목은 소스 순서로 안전하게 재배치할 수 없습니다." };
    }
    if (kind === "grid" && participants.some((node) => {
      const style = getComputedStyle(node);
      return style.gridColumnStart !== "auto" || style.gridColumnEnd !== "auto" || style.gridRowStart !== "auto" || style.gridRowEnd !== "auto";
    })) {
      return { parent, kind, blocked:"행/열이 지정된 grid 항목은 자동 배치 순서로 안전하게 재배치할 수 없습니다." };
    }
    const axis = kind === "flex" && parentStyle.flexWrap === "nowrap" && /^row/.test(parentStyle.flexDirection) ? "x"
      : kind === "flex" && parentStyle.flexWrap === "nowrap" ? "y" : "xy";
    return { parent, kind, axis };
  }

  function beginInternalMutation() {
    internalMutation = true;
    clearTimeout(internalMutationTimer);
    internalMutationTimer = setTimeout(() => { internalMutation = false; }, 0);
  }

  function rememberOriginalOrder(parent) {
    if (!(parent instanceof HTMLElement) || originalOrders.has(parent)) return;
    originalOrders.set(parent, [...parent.childNodes].filter((node)=>!(node instanceof Element && (node.hasAttribute("data-polazu-generated") || ignored(node)))));
  }

  function safeReparentContainer(container, moving) {
    return container instanceof HTMLElement && REPARENT_CONTAINER_TAGS.has(container.tagName) && !ignored(container)
      && container !== moving && container !== moving.parentElement && !moving.contains(container)
      && !locked.has(selector(container)) && !container.hasAttribute("data-polazu-deleted");
  }

  function sourceFile(value) {
    return typeof value === "string" ? value.match(/^(.*):\d+:\d+$/)?.[1] : undefined;
  }

  function reparentSourceSupport(moving, target) {
    const movingRef = sourceId(moving);
    const targetRef = sourceId(target);
    if (moving.dataset.polazuGenerated) return { supported:true };
    if (!movingRef && !targetRef) return { supported:true };
    if (movingRef && targetRef && sourceFile(movingRef) === sourceFile(targetRef)) return { supported:true };
    return { supported:false, message:movingRef && targetRef
      ? "다른 파일의 컨테이너로는 안전하게 옮길 수 없습니다. 먼저 코드를 같은 컴포넌트로 정리해 주세요."
      : "소스 위치가 연결되지 않은 컨테이너라서 이동하지 않았습니다." };
  }

  function reparentTargetAtPoint(state, clientX, clientY) {
    if (state.items.length !== 1) return { target:null };
    const moving = state.el;
    const hits = typeof document.elementsFromPoint === "function" ? document.elementsFromPoint(clientX, clientY) : [];
    for (const hit of hits) {
      if (!(hit instanceof HTMLElement) || ignored(hit) || hit === moving || moving.contains(hit)) continue;
      let node = hit;
      while (node instanceof HTMLElement && node !== document.documentElement) {
        if (node === moving.parentElement) return { target:null };
        if (safeReparentContainer(node, moving)) {
          const support = reparentSourceSupport(moving, node);
          return support.supported ? { target:node } : { target:null, blockedTarget:node, message:support.message };
        }
        node = node.parentElement;
      }
      return { target:null };
    }
    return { target:null };
  }

  function clearDropTarget() {
    overlayRoot?.querySelectorAll("[data-polazu-drop-target]").forEach((node)=>node.remove());
  }

  function drawDropTarget(target, blocked = false) {
    clearDropTarget();
    if (!(target instanceof HTMLElement) || !overlayRoot) return;
    const rect = target.getBoundingClientRect();
    const outline = document.createElement("div");
    outline.dataset.polazuDropTarget = "true";
    outline.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;box-sizing:border-box;border:2px solid ${blocked ? "#ef4444" : "#22c55e"};background:${blocked ? "rgba(239,68,68,.08)" : "rgba(34,197,94,.08)"};pointer-events:none;z-index:2147483645;`;
    const label = document.createElement("span");
    label.textContent = blocked ? "이 위치로는 이동할 수 없음" : `${elementLabel(target) || target.tagName.toLowerCase()} 안으로 이동`;
    label.style.cssText = `position:absolute;left:0;top:0;padding:3px 7px;background:${blocked ? "#ef4444" : "#16a34a"};color:white;border-radius:0 0 4px 0;font:600 11px/1.4 system-ui;`;
    outline.appendChild(label); overlayRoot.appendChild(outline);
  }

  function reparentEdit(state, target) {
    const origin = reparentOrigins.get(state.el) || { selector:state.startSelector, sourceId:state.startSourceId };
    reparentOrigins.set(state.el, origin);
    return {
      id:crypto.randomUUID(), path:currentPath(), selector:state.startSelector, sourceId:state.startSourceId,
      generatedId:state.el.dataset.polazuGenerated || undefined,
      operation:{ type:"reparent", sourceSelector:origin.selector, targetParentSelector:selector(target), targetParentSourceId:sourceId(target), placement:"append" },
    };
  }

  function reorderEdit(el, direction, targetSelector) {
    return {
      id:crypto.randomUUID(), path:currentPath(), selector:targetSelector, sourceId:sourceId(el),
      generatedId:el.dataset.polazuGenerated || undefined, operation:{ type:"reorder", direction, sourceId:sourceId(el) },
    };
  }

  function reorderOneStep(el, direction) {
    const parent = el.parentElement;
    if (!parent) return null;
    const sibling = direction === "up" ? el.previousElementSibling : el.nextElementSibling;
    if (!sibling) return null;
    rememberOriginalOrder(parent);
    const edit = reorderEdit(el, direction, selector(el));
    beginInternalMutation();
    if (direction === "up") parent.insertBefore(el, sibling); else parent.insertBefore(sibling, el);
    return edit;
  }

  function reorderTowardPointer(state, clientX, clientY) {
    const info = state.layout;
    const el = state.el;
    if (!info || info.blocked || !el.isConnected || el.parentElement !== info.parent) return;
    const participants = [...info.parent.children].filter((node) => {
      if (!(node instanceof HTMLElement) || ignored(node)) return false;
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.position !== "absolute" && style.position !== "fixed" && rect.width > 0 && rect.height > 0;
    });
    if (participants.length < 2 || !participants.includes(el)) return;
    const probeX = clientX - state.pointerOffsetX + state.rect.width / 2;
    const probeY = clientY - state.pointerOffsetY + state.rect.height / 2;
    let target = el;
    let best = Infinity;
    for (const candidate of participants) {
      const rect = candidate.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const score = info.axis === "x" ? Math.abs(probeX - centerX)
        : info.axis === "y" ? Math.abs(probeY - centerY)
        : Math.hypot(probeX - centerX, probeY - centerY);
      if (score < best) { best = score; target = candidate; }
    }
    if (target === el) return;
    const siblings = [...info.parent.children];
    let currentIndex = siblings.indexOf(el);
    const targetIndex = siblings.indexOf(target);
    if (currentIndex < 0 || targetIndex < 0) return;
    const direction = targetIndex < currentIndex ? "up" : "down";
    while (currentIndex !== targetIndex) {
      const edit = reorderOneStep(el, direction);
      if (!edit) break;
      state.reorderEdits.push(edit);
      currentIndex += direction === "up" ? -1 : 1;
    }
    state.lastReorderElement = describe(el);
  }

  function beginManipulation(event, el, handle) {
    if (mode !== "edit" || event.button !== 0 || locked.has(selector(el)) || textEdit) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const rect = el.getBoundingClientRect();
    const computed = getComputedStyle(el);
    const moveTargets = handle === "move" && selected.includes(el) && selected.length > 1 ? selected : [el];
    const items = moveTargets.filter((item) => !locked.has(selector(item)) && !moveTargets.some((other) => other !== item && other.contains(item))).map((item) => {
      const itemStyle = getComputedStyle(item);
      return { el:item, startLeft:parseFloat(itemStyle.left) || 0, startTop:parseFloat(itemStyle.top) || 0, originalPosition:itemStyle.position, originalStyle:item.getAttribute("style") };
    });
    const layoutItems = handle === "move" ? items.map((item) => layoutDragInfo(item.el)).filter(Boolean) : [];
    const layout = layoutItems.length === 1 && items.length === 1 ? layoutItems[0] : layoutItems.length ? { blocked:"자동 레이아웃에서는 한 요소씩 드래그해 순서를 바꿔주세요." } : null;
    dragState = {
      el, handle, startX:event.clientX, startY:event.clientY, rect, items,
      startSelector:selector(el), startSourceId:sourceId(el),
      startLeft:parseFloat(computed.left) || 0, startTop:parseFloat(computed.top) || 0,
      originalPosition:computed.position, ratio:rect.width / Math.max(1, rect.height), shift:event.shiftKey, layout,
      pointerOffsetX:event.clientX - rect.left, pointerOffsetY:event.clientY - rect.top, reorderEdits:[],
      originalStyle:el.getAttribute("style"), originalChildren:layout?.parent ? [...layout.parent.childNodes] : null,
      extraWidth:computed.boxSizing === "border-box" ? 0 : [computed.paddingLeft,computed.paddingRight,computed.borderLeftWidth,computed.borderRightWidth].reduce((sum,value)=>sum+(parseFloat(value)||0),0),
      extraHeight:computed.boxSizing === "border-box" ? 0 : [computed.paddingTop,computed.paddingBottom,computed.borderTopWidth,computed.borderBottomWidth].reduce((sum,value)=>sum+(parseFloat(value)||0),0),
      pointerId:event.pointerId, moved:false,
    };
    if (layout?.blocked) send("notice", { message:layout.blocked });
    addEventListener("pointermove", manipulate, true);
    addEventListener("pointerup", finishManipulation, { capture:true, once:true });
    addEventListener("pointercancel", cancelManipulation, { capture:true, once:true });
  }

  function manipulate(event) {
    if (!dragState) return;event.preventDefault();lastDragPoint={clientX:event.clientX,clientY:event.clientY,shiftKey:event.shiftKey};
    if(dragFrame!==null)return;dragFrame=requestAnimationFrame(()=>{dragFrame=null;const point=lastDragPoint;lastDragPoint=null;if(point)performManipulation(point);});
  }

  function performManipulation(event) {
    if (!dragState) return;
    const { el, handle, startX, startY, rect, ratio } = dragState;
    let dx = event.clientX - startX;
    let dy = event.clientY - startY;
    if (!dragState.moved && Math.hypot(dx, dy) < 4) return;
    if (!dragState.moved) { try { document.documentElement.setPointerCapture?.(dragState.pointerId); } catch {} }
    dragState.moved = true;
    if (handle === "move" && event.shiftKey) { if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0; }
    if (handle === "move") {
      const drop = reparentTargetAtPoint(dragState, event.clientX, event.clientY);
      dragState.reparentTarget = drop.target || null;
      dragState.blockedDrop = drop.blockedTarget || null;
      if (drop.target) {
        dragState.lastBlockedSelector = null;
        drawDropTarget(drop.target);
        return;
      }
      if (drop.blockedTarget) {
        const blockedSelector = selector(drop.blockedTarget);
        drawDropTarget(drop.blockedTarget, true);
        if (dragState.lastBlockedSelector !== blockedSelector) send("notice", { message:drop.message || "이 컨테이너로는 안전하게 이동할 수 없습니다." });
        dragState.lastBlockedSelector = blockedSelector;
        return;
      }
      dragState.lastBlockedSelector = null;
      clearDropTarget();
      if (dragState.layout) {
        reorderTowardPointer(dragState, event.clientX, event.clientY);
        drawSelection();
        return;
      }
      const changes = [];
      for (const item of dragState.items) {
        const styles = {};
        const nextLeft = dx === 0 ? item.startLeft : snapValue(item.startLeft + dx);
        const nextTop = dy === 0 ? item.startTop : snapValue(item.startTop + dy);
        if (item.originalPosition === "static") styles.position = "relative";
        styles.left = `${nextLeft}px`; styles.top = `${nextTop}px`;
        applyStyle(item.el, styles);
        changes.push({ selector:selector(item.el), sourceId:sourceId(item.el), generatedId:item.el.dataset.polazuGenerated || undefined, styles, element:describe(item.el) });
      }
      dragState.lastChanges = changes;
    } else {
      const styles = {};
      let width = rect.width, height = rect.height;
      if (handle.includes("e")) width = rect.width + dx;
      if (handle.includes("w")) width = rect.width - dx;
      if (handle.includes("s")) height = rect.height + dy;
      if (handle.includes("n")) height = rect.height - dy;
      if (event.shiftKey) {
        if (Math.abs(width - rect.width) >= Math.abs(height - rect.height)) height = width / ratio;
        else width = height * ratio;
      }
      const resizedWidth = Math.max(dragState.extraWidth + 1, snapValue(width));
      const resizedHeight = Math.max(dragState.extraHeight + 1, snapValue(height));
      if (/[ew]/.test(handle) || event.shiftKey) styles.width = `${Math.max(1, resizedWidth - dragState.extraWidth)}px`;
      if (/[ns]/.test(handle) || event.shiftKey) styles.height = `${Math.max(1, resizedHeight - dragState.extraHeight)}px`;
      if (handle.includes("w") || handle.includes("n")) {
        if (dragState.originalPosition === "static") styles.position = "relative";
        if (handle.includes("w")) styles.left = `${dragState.startLeft + rect.width - resizedWidth}px`;
        if (handle.includes("n")) styles.top = `${dragState.startTop + rect.height - resizedHeight}px`;
      }
      applyStyle(el, styles);
      dragState.lastStyles = { ...(dragState.lastStyles || {}), ...styles };
    }
    drawSelection();
  }

  function finishManipulation(event) {
    removeEventListener("pointermove", manipulate, true);
    removeEventListener("pointerup", finishManipulation, true);
    removeEventListener("pointercancel", cancelManipulation, true);
    if (!dragState) return;
    event.preventDefault();
    if(dragFrame!==null){cancelAnimationFrame(dragFrame);dragFrame=null;}if(lastDragPoint){performManipulation(lastDragPoint);lastDragPoint=null;}
    const state = dragState;
    const { el, lastStyles, lastChanges, reorderEdits, lastReorderElement, pointerId, reparentTarget, blockedDrop } = state;
    dragState = null;
    clearDropTarget();
    if (document.documentElement.hasPointerCapture?.(pointerId)) document.documentElement.releasePointerCapture(pointerId);
    if (blockedDrop) {
      restoreManipulationPreview(state);
      drawSelection();
    }
    else if (reparentTarget && safeReparentContainer(reparentTarget, el) && reparentSourceSupport(el, reparentTarget).supported) {
      for (const item of state.items) {
        if (item.originalStyle === null) item.el.removeAttribute("style"); else item.el.setAttribute("style", item.originalStyle);
      }
      rememberOriginalOrder(el.parentElement); rememberOriginalOrder(reparentTarget);
      const edit = reparentEdit(state, reparentTarget);
      beginInternalMutation(); reparentTarget.appendChild(el);
      const primary = describe(el);
      drawSelection(); send("structure", { edit }); scheduleReport();
      send("selected", { element:primary, elements:[primary], breadcrumbs:ancestors(el) });
    }
    else if (reorderEdits?.length) {
      send("structure", { edits:reorderEdits });
      scheduleReport();
      const primary = lastReorderElement || describe(el);
      send("selected", { element:primary, elements:[primary], breadcrumbs:ancestors(el) });
    }
    else if (lastChanges?.length) send("manipulation", { changes:lastChanges });
    else if (lastStyles && Object.keys(lastStyles).length) send("manipulation", { changes:[{ selector:selector(el), sourceId:sourceId(el), generatedId:el.dataset.polazuGenerated || undefined, styles:lastStyles, element:describe(el) }] });
  }

  function restoreManipulationPreview(state) {
    beginInternalMutation();
    for (const item of state.items) {
      if (item.originalStyle === null) item.el.removeAttribute("style"); else item.el.setAttribute("style", item.originalStyle);
    }
    if (state.originalChildren && state.layout?.parent) for (const child of state.originalChildren) state.layout.parent.appendChild(child);
  }

  function cancelManipulation() {
    if (!dragState) return;
    const state = dragState;
    if (dragFrame !== null) cancelAnimationFrame(dragFrame);
    dragFrame = null; lastDragPoint = null; dragState = null;
    removeEventListener("pointermove", manipulate, true);
    removeEventListener("pointerup", finishManipulation, true);
    removeEventListener("pointercancel", cancelManipulation, true);
    clearDropTarget();
    restoreManipulationPreview(state);
    if (document.documentElement.hasPointerCapture?.(state.pointerId)) document.documentElement.releasePointerCapture(state.pointerId);
    drawSelection();
  }

  function nudgeSelected(dx, dy) {
    const changes = [];
    for (const el of selected.filter((item)=>!locked.has(selector(item)) && !selected.some((other)=>other!==item && other.contains(item)))) {
      const computed = getComputedStyle(el);
      const left = (parseFloat(computed.left) || 0) + dx;
      const top = (parseFloat(computed.top) || 0) + dy;
      const styles = { ...(computed.position === "static" ? { position:"relative" } : {}), left:`${Math.round(left * 100) / 100}px`, top:`${Math.round(top * 100) / 100}px` };
      applyStyle(el, styles); changes.push({ selector:selector(el), sourceId:sourceId(el), generatedId:el.dataset.polazuGenerated || undefined, styles, element:describe(el) });
    }
    drawSelection(); if (changes.length) send("manipulation", { changes });
  }

  function alignSelection(kind) {
    if (selected.length < 2) return;
    const rects = selected.map((el) => el.getBoundingClientRect());
    const bounds = {
      left:Math.min(...rects.map((r) => r.left)), right:Math.max(...rects.map((r) => r.right)),
      top:Math.min(...rects.map((r) => r.top)), bottom:Math.max(...rects.map((r) => r.bottom)),
    };
    const changes = [];
    selected.forEach((el, index) => {
      const rect = rects[index]; let dx = 0, dy = 0;
      if (kind === "left") dx = bounds.left - rect.left;
      if (kind === "center") dx = (bounds.left + bounds.right) / 2 - (rect.left + rect.right) / 2;
      if (kind === "right") dx = bounds.right - rect.right;
      if (kind === "top") dy = bounds.top - rect.top;
      if (kind === "middle") dy = (bounds.top + bounds.bottom) / 2 - (rect.top + rect.bottom) / 2;
      if (kind === "bottom") dy = bounds.bottom - rect.bottom;
      const computed = getComputedStyle(el);
      const styles = { ...(computed.position === "static" ? { position:"relative" } : {}), left:`${snapValue((parseFloat(computed.left)||0)+dx)}px`, top:`${snapValue((parseFloat(computed.top)||0)+dy)}px` };
      applyStyle(el, styles); changes.push({ selector:selector(el), sourceId:sourceId(el), generatedId:el.dataset.polazuGenerated || undefined, styles, element:describe(el) });
    });
    drawSelection(); send("manipulation", { changes });
  }

  function distributeSelection(axis) {
    if (selected.length < 3) return;
    const items = selected.map((el) => ({ el, rect:el.getBoundingClientRect() })).sort((a,b) => axis === "horizontal" ? a.rect.left - b.rect.left : a.rect.top - b.rect.top);
    const first = items[0].rect, last = items[items.length - 1].rect;
    const totalSize = items.reduce((sum, item) => sum + (axis === "horizontal" ? item.rect.width : item.rect.height), 0);
    const span = axis === "horizontal" ? last.right - first.left : last.bottom - first.top;
    const gap = (span - totalSize) / (items.length - 1);
    let cursor = axis === "horizontal" ? first.left : first.top;
    const changes = [];
    for (const item of items) {
      const current = axis === "horizontal" ? item.rect.left : item.rect.top;
      const delta = cursor - current;
      const computed = getComputedStyle(item.el);
      const styles = { ...(computed.position === "static" ? { position:"relative" } : {}), ...(axis === "horizontal" ? { left:`${snapValue((parseFloat(computed.left)||0)+delta)}px` } : { top:`${snapValue((parseFloat(computed.top)||0)+delta)}px` }) };
      applyStyle(item.el, styles); changes.push({ selector:selector(item.el), sourceId:sourceId(item.el), generatedId:item.el.dataset.polazuGenerated || undefined, styles, element:describe(item.el) });
      cursor += (axis === "horizontal" ? item.rect.width : item.rect.height) + gap;
    }
    drawSelection(); send("manipulation", { changes });
  }

  function primitive(kind) {
    const imagePlaceholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='960' height='540' viewBox='0 0 960 540'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop stop-color='%23e4e4e7'/%3E%3Cstop offset='1' stop-color='%23fafafa'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='960' height='540' rx='32' fill='url(%23g)'/%3E%3Cpath d='M280 365l110-120 86 92 55-58 149 151H280z' fill='%23a1a1aa'/%3E%3Ccircle cx='625' cy='175' r='42' fill='%23a1a1aa'/%3E%3C/svg%3E";
    const map = {
      frame:{ html:'<div style="min-height:120px;padding:24px;border:1px dashed #a1a1aa;border-radius:12px;display:flex;gap:16px;align-items:center;justify-content:center">Frame</div>', jsx:'<div style={{ minHeight: "120px", padding: "24px", border: "1px dashed #a1a1aa", borderRadius: "12px", display: "flex", gap: "16px", alignItems: "center", justifyContent: "center" }}>Frame</div>' },
      section:{ html:'<section style="width:100%;padding:64px 24px"><div style="max-width:1120px;margin:0 auto">Section content</div></section>', jsx:'<section style={{ width: "100%", padding: "64px 24px" }}><div style={{ maxWidth: "1120px", margin: "0 auto" }}>Section content</div></section>' },
      container:{ html:'<div style="width:100%;max-width:1120px;margin:0 auto;padding:0 24px">Container</div>', jsx:'<div style={{ width: "100%", maxWidth: "1120px", margin: "0 auto", padding: "0 24px" }}>Container</div>' },
      "v-stack":{ html:'<div style="display:flex;flex-direction:column;gap:16px;align-items:stretch"><div>Item 1</div><div>Item 2</div></div>', jsx:'<div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "stretch" }}><div>Item 1</div><div>Item 2</div></div>' },
      "h-stack":{ html:'<div style="display:flex;flex-direction:row;gap:16px;align-items:center;flex-wrap:wrap"><div>Item 1</div><div>Item 2</div></div>', jsx:'<div style={{ display: "flex", flexDirection: "row", gap: "16px", alignItems: "center", flexWrap: "wrap" }}><div>Item 1</div><div>Item 2</div></div>' },
      heading:{ html:'<h2 style="margin:0;font-size:32px;line-height:1.2;letter-spacing:-.02em">새 섹션 제목</h2>', jsx:'<h2 style={{ margin: 0, fontSize: "32px", lineHeight: 1.2, letterSpacing: "-.02em" }}>새 섹션 제목</h2>' },
      text:{ html:'<p style="margin:0;font-size:16px;line-height:1.6">새 텍스트</p>', jsx:'<p style={{ margin: 0, fontSize: "16px", lineHeight: 1.6 }}>새 텍스트</p>' },
      quote:{ html:'<blockquote style="margin:0;padding:24px;border-left:4px solid #6366f1;background:#f8fafc"><p style="margin:0 0 10px;font-size:20px;line-height:1.5">명확한 인용문을 입력하세요.</p><cite style="color:#64748b;font-style:normal">출처 또는 이름</cite></blockquote>', jsx:'<blockquote style={{ margin: 0, padding: "24px", borderLeft: "4px solid #6366f1", background: "#f8fafc" }}><p style={{ margin: "0 0 10px", fontSize: "20px", lineHeight: 1.5 }}>명확한 인용문을 입력하세요.</p><cite style={{ color: "#64748b", fontStyle: "normal" }}>출처 또는 이름</cite></blockquote>' },
      "rich-text":{ html:'<article style="display:grid;gap:14px;max-width:720px"><h2 style="margin:0">콘텐츠 제목</h2><p style="margin:0;line-height:1.7">설명 문단을 입력하세요. 디자이너가 텍스트와 간격을 직접 조정할 수 있습니다.</p><ul style="margin:0;padding-left:20px"><li>첫 번째 항목</li><li>두 번째 항목</li></ul></article>', jsx:'<article style={{ display: "grid", gap: "14px", maxWidth: "720px" }}><h2 style={{ margin: 0 }}>콘텐츠 제목</h2><p style={{ margin: 0, lineHeight: 1.7 }}>설명 문단을 입력하세요. 디자이너가 텍스트와 간격을 직접 조정할 수 있습니다.</p><ul style={{ margin: 0, paddingLeft: "20px" }}><li>첫 번째 항목</li><li>두 번째 항목</li></ul></article>' },
      rectangle:{ html:'<div aria-label="Rectangle" style="width:160px;height:96px;background:#e4e4e7;border-radius:12px"></div>', jsx:'<div aria-label="Rectangle" style={{ width: "160px", height: "96px", background: "#e4e4e7", borderRadius: "12px" }} />' },
      image:{ html:`<img src="${imagePlaceholder}" alt="이미지 설명" style="width:320px;aspect-ratio:16/9;object-fit:cover;border-radius:12px" />`, jsx:`<img src="${imagePlaceholder}" alt="이미지 설명" style={{ width: "320px", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: "12px" }} />` },
      video:{ html:'<video controls aria-label="Video" style="display:block;width:100%;max-width:720px;aspect-ratio:16/9;border-radius:12px;background:#18181b"></video>', jsx:'<video controls aria-label="Video" style={{ display: "block", width: "100%", maxWidth: "720px", aspectRatio: "16 / 9", borderRadius: "12px", background: "#18181b" }} />' },
      avatar:{ html:`<img src="${imagePlaceholder}" alt="사용자 프로필" style="width:48px;height:48px;object-fit:cover;border-radius:999px" />`, jsx:`<img src="${imagePlaceholder}" alt="사용자 프로필" style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "999px" }} />` },
      badge:{ html:'<span style="display:inline-flex;align-items:center;padding:4px 9px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:12px;font-weight:700">Badge</span>', jsx:'<span style={{ display: "inline-flex", alignItems: "center", padding: "4px 9px", borderRadius: "999px", background: "#eef2ff", color: "#4338ca", fontSize: "12px", fontWeight: 700 }}>Badge</span>' },
      button:{ html:'<button type="button" style="padding:10px 16px;border:0;border-radius:8px;background:#111827;color:white;font-weight:700">Button</button>', jsx:'<button type="button" style={{ padding: "10px 16px", border: 0, borderRadius: "8px", background: "#111827", color: "white", fontWeight: 700 }}>Button</button>' },
      link:{ html:'<a href="#" style="display:inline-flex;align-items:center;gap:6px;color:#4f46e5;font-weight:650;text-decoration:none">Link text <span aria-hidden="true">→</span></a>', jsx:'<a href="#" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#4f46e5", fontWeight: 650, textDecoration: "none" }}>Link text <span aria-hidden="true">→</span></a>' },
      input:{ html:'<label style="display:grid;gap:6px;font-size:14px;font-weight:600">Label<input placeholder="입력하세요" style="padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font:inherit" /></label>', jsx:'<label style={{ display: "grid", gap: "6px", fontSize: "14px", fontWeight: 600 }}>Label<input placeholder="입력하세요" style={{ padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "8px", font: "inherit" }} /></label>' },
      textarea:{ html:'<label style="display:grid;gap:6px;font-size:14px;font-weight:600">Message<textarea rows="4" placeholder="내용을 입력하세요" style="padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;font:inherit;resize:vertical"></textarea></label>', jsx:'<label style={{ display: "grid", gap: "6px", fontSize: "14px", fontWeight: 600 }}>Message<textarea rows={4} placeholder="내용을 입력하세요" style={{ padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "8px", font: "inherit", resize: "vertical" }} /></label>' },
      select:{ html:'<label style="display:grid;gap:6px;font-size:14px;font-weight:600">Option<select style="padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px;background:white;font:inherit"><option>선택하세요</option><option>Option A</option><option>Option B</option></select></label>', jsx:'<label style={{ display: "grid", gap: "6px", fontSize: "14px", fontWeight: 600 }}>Option<select defaultValue="" style={{ padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "8px", background: "white", font: "inherit" }}><option value="" disabled>선택하세요</option><option>Option A</option><option>Option B</option></select></label>' },
      checkbox:{ html:'<label style="display:inline-flex;align-items:center;gap:8px;font-size:14px"><input type="checkbox" /> 선택 항목</label>', jsx:'<label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px" }}><input type="checkbox" /> 선택 항목</label>' },
      radio:{ html:'<label style="display:inline-flex;align-items:center;gap:8px;font-size:14px"><input type="radio" name="option" /> 선택 항목</label>', jsx:'<label style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px" }}><input type="radio" name="option" /> 선택 항목</label>' },
      switch:{ html:'<button type="button" role="switch" aria-checked="false" aria-label="설정 전환" style="width:44px;height:24px;padding:2px;border:0;border-radius:999px;background:#d4d4d8;text-align:left"><span style="display:block;width:20px;height:20px;border-radius:50%;background:white;box-shadow:0 1px 4px rgba(0,0,0,.25)"></span></button>', jsx:'<button type="button" role="switch" aria-checked="false" aria-label="설정 전환" style={{ width: "44px", height: "24px", padding: "2px", border: 0, borderRadius: "999px", background: "#d4d4d8", textAlign: "left" }}><span style={{ display: "block", width: "20px", height: "20px", borderRadius: "50%", background: "white", boxShadow: "0 1px 4px rgba(0,0,0,.25)" }} /></button>' },
      form:{ html:'<form style="display:grid;gap:14px;max-width:480px;padding:24px;border:1px solid #e4e4e7;border-radius:14px"><label style="display:grid;gap:6px">이름<input name="name" style="padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px"></label><label style="display:grid;gap:6px">이메일<input name="email" type="email" style="padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px"></label><button type="submit">보내기</button></form>', jsx:'<form style={{ display: "grid", gap: "14px", maxWidth: "480px", padding: "24px", border: "1px solid #e4e4e7", borderRadius: "14px" }}><label style={{ display: "grid", gap: "6px" }}>이름<input name="name" style={{ padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "8px" }}/></label><label style={{ display: "grid", gap: "6px" }}>이메일<input name="email" type="email" style={{ padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "8px" }}/></label><button type="submit">보내기</button></form>' },
      search:{ html:'<form role="search" style="display:flex;gap:8px;max-width:520px"><label style="position:absolute;width:1px;height:1px;overflow:hidden" for="site-search">검색</label><input id="site-search" type="search" placeholder="검색어를 입력하세요" style="min-width:0;flex:1;padding:10px 12px;border:1px solid #d4d4d8;border-radius:8px"><button type="submit">검색</button></form>', jsx:'<form role="search" style={{ display: "flex", gap: "8px", maxWidth: "520px" }}><label style={{ position: "absolute", width: "1px", height: "1px", overflow: "hidden" }} htmlFor="site-search">검색</label><input id="site-search" type="search" placeholder="검색어를 입력하세요" style={{ minWidth: 0, flex: 1, padding: "10px 12px", border: "1px solid #d4d4d8", borderRadius: "8px" }}/><button type="submit">검색</button></form>' },
      card:{ html:'<article style="padding:24px;border:1px solid #e4e4e7;border-radius:16px;background:white;box-shadow:0 8px 24px rgba(0,0,0,.08)"><h3 style="margin:0 0 8px">Card title</h3><p style="margin:0;color:#71717a">Card content</p></article>', jsx:'<article style={{ padding: "24px", border: "1px solid #e4e4e7", borderRadius: "16px", background: "white", boxShadow: "0 8px 24px rgba(0,0,0,.08)" }}><h3 style={{ margin: "0 0 8px" }}>Card title</h3><p style={{ margin: 0, color: "#71717a" }}>Card content</p></article>' },
      list:{ html:'<ul style="display:grid;gap:10px;margin:0;padding:0;list-style:none"><li style="padding:12px;border:1px solid #e4e4e7;border-radius:10px">List item 1</li><li style="padding:12px;border:1px solid #e4e4e7;border-radius:10px">List item 2</li><li style="padding:12px;border:1px solid #e4e4e7;border-radius:10px">List item 3</li></ul>', jsx:'<ul style={{ display: "grid", gap: "10px", margin: 0, padding: 0, listStyle: "none" }}><li style={{ padding: "12px", border: "1px solid #e4e4e7", borderRadius: "10px" }}>List item 1</li><li style={{ padding: "12px", border: "1px solid #e4e4e7", borderRadius: "10px" }}>List item 2</li><li style={{ padding: "12px", border: "1px solid #e4e4e7", borderRadius: "10px" }}>List item 3</li></ul>' },
      table:{ html:'<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th style="padding:10px;text-align:left;border-bottom:1px solid #d4d4d8">Name</th><th style="padding:10px;text-align:left;border-bottom:1px solid #d4d4d8">Status</th></tr></thead><tbody><tr><td style="padding:10px;border-bottom:1px solid #e4e4e7">Item</td><td style="padding:10px;border-bottom:1px solid #e4e4e7">Active</td></tr></tbody></table>', jsx:'<table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}><thead><tr><th style={{ padding: "10px", textAlign: "left", borderBottom: "1px solid #d4d4d8" }}>Name</th><th style={{ padding: "10px", textAlign: "left", borderBottom: "1px solid #d4d4d8" }}>Status</th></tr></thead><tbody><tr><td style={{ padding: "10px", borderBottom: "1px solid #e4e4e7" }}>Item</td><td style={{ padding: "10px", borderBottom: "1px solid #e4e4e7" }}>Active</td></tr></tbody></table>' },
      navbar:{ html:'<nav aria-label="Main navigation" style="display:flex;align-items:center;justify-content:space-between;gap:24px;padding:16px 24px;border:1px solid #e4e4e7;border-radius:14px;background:white"><strong>Brand</strong><div style="display:flex;gap:18px"><a href="#">Home</a><a href="#">About</a><a href="#">Contact</a></div></nav>', jsx:'<nav aria-label="Main navigation" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", padding: "16px 24px", border: "1px solid #e4e4e7", borderRadius: "14px", background: "white" }}><strong>Brand</strong><div style={{ display: "flex", gap: "18px" }}><a href="#">Home</a><a href="#">About</a><a href="#">Contact</a></div></nav>' },
      tabs:{ html:'<section><div role="tablist" aria-label="Content sections" style="display:flex;gap:4px;border-bottom:1px solid #e4e4e7"><button role="tab" aria-selected="true" style="padding:10px 14px;border:0;border-bottom:2px solid #111827;background:transparent;font-weight:700">Overview</button><button role="tab" aria-selected="false" style="padding:10px 14px;border:0;background:transparent">Details</button></div><div role="tabpanel" style="padding:20px 0">Tab content</div></section>', jsx:'<section><div role="tablist" aria-label="Content sections" style={{ display: "flex", gap: "4px", borderBottom: "1px solid #e4e4e7" }}><button role="tab" aria-selected="true" style={{ padding: "10px 14px", border: 0, borderBottom: "2px solid #111827", background: "transparent", fontWeight: 700 }}>Overview</button><button role="tab" aria-selected="false" style={{ padding: "10px 14px", border: 0, background: "transparent" }}>Details</button></div><div role="tabpanel" style={{ padding: "20px 0" }}>Tab content</div></section>' },
      accordion:{ html:'<details style="padding:14px 16px;border:1px solid #e4e4e7;border-radius:12px"><summary style="cursor:pointer;font-weight:700">Accordion title</summary><p style="margin:12px 0 0;color:#52525b">Accordion content</p></details>', jsx:'<details style={{ padding: "14px 16px", border: "1px solid #e4e4e7", borderRadius: "12px" }}><summary style={{ cursor: "pointer", fontWeight: 700 }}>Accordion title</summary><p style={{ margin: "12px 0 0", color: "#52525b" }}>Accordion content</p></details>' },
      dropdown:{ html:'<details style="position:relative;display:inline-block"><summary style="cursor:pointer;padding:10px 14px;border:1px solid #d4d4d8;border-radius:8px;background:white;font-weight:700">메뉴</summary><nav aria-label="Dropdown" style="position:absolute;top:calc(100% + 8px);left:0;min-width:180px;display:grid;gap:4px;padding:8px;border:1px solid #e4e4e7;border-radius:10px;background:white;box-shadow:0 12px 30px rgba(0,0,0,.12)"><a href="#">첫 번째 링크</a><a href="#">두 번째 링크</a></nav></details>', jsx:'<details style={{ position: "relative", display: "inline-block" }}><summary style={{ cursor: "pointer", padding: "10px 14px", border: "1px solid #d4d4d8", borderRadius: "8px", background: "white", fontWeight: 700 }}>메뉴</summary><nav aria-label="Dropdown" style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, minWidth: "180px", display: "grid", gap: "4px", padding: "8px", border: "1px solid #e4e4e7", borderRadius: "10px", background: "white", boxShadow: "0 12px 30px rgba(0,0,0,.12)" }}><a href="#">첫 번째 링크</a><a href="#">두 번째 링크</a></nav></details>' },
      slider:{ html:'<section aria-label="Content slider" style="display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding:4px"><article style="min-width:280px;padding:24px;border:1px solid #e4e4e7;border-radius:14px;scroll-snap-align:start">Slide 1</article><article style="min-width:280px;padding:24px;border:1px solid #e4e4e7;border-radius:14px;scroll-snap-align:start">Slide 2</article><article style="min-width:280px;padding:24px;border:1px solid #e4e4e7;border-radius:14px;scroll-snap-align:start">Slide 3</article></section>', jsx:'<section aria-label="Content slider" style={{ display: "flex", gap: "16px", overflowX: "auto", scrollSnapType: "x mandatory", padding: "4px" }}><article style={{ minWidth: "280px", padding: "24px", border: "1px solid #e4e4e7", borderRadius: "14px", scrollSnapAlign: "start" }}>Slide 1</article><article style={{ minWidth: "280px", padding: "24px", border: "1px solid #e4e4e7", borderRadius: "14px", scrollSnapAlign: "start" }}>Slide 2</article><article style={{ minWidth: "280px", padding: "24px", border: "1px solid #e4e4e7", borderRadius: "14px", scrollSnapAlign: "start" }}>Slide 3</article></section>' },
      modal:{ html:'<div role="dialog" aria-modal="true" aria-labelledby="dialog-title" style="max-width:420px;padding:24px;border:1px solid #e4e4e7;border-radius:16px;background:white;box-shadow:0 24px 64px rgba(0,0,0,.18)"><h2 id="dialog-title" style="margin:0 0 8px">Dialog title</h2><p style="margin:0 0 20px;color:#52525b">Dialog description</p><button type="button">Confirm</button></div>', jsx:'<div role="dialog" aria-modal="true" aria-labelledby="dialog-title" style={{ maxWidth: "420px", padding: "24px", border: "1px solid #e4e4e7", borderRadius: "16px", background: "white", boxShadow: "0 24px 64px rgba(0,0,0,.18)" }}><h2 id="dialog-title" style={{ margin: "0 0 8px" }}>Dialog title</h2><p style={{ margin: "0 0 20px", color: "#52525b" }}>Dialog description</p><button type="button">Confirm</button></div>' },
      toast:{ html:'<div role="status" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #bbf7d0;border-radius:12px;background:#f0fdf4;color:#166534">✓ Changes saved</div>', jsx:'<div role="status" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", border: "1px solid #bbf7d0", borderRadius: "12px", background: "#f0fdf4", color: "#166534" }}>✓ Changes saved</div>' },
      skeleton:{ html:'<div aria-label="Loading" role="status" style="display:grid;gap:10px;width:280px"><span style="height:18px;width:65%;border-radius:6px;background:#e4e4e7"></span><span style="height:12px;border-radius:6px;background:#f4f4f5"></span><span style="height:12px;width:85%;border-radius:6px;background:#f4f4f5"></span></div>', jsx:'<div aria-label="Loading" role="status" style={{ display: "grid", gap: "10px", width: "280px" }}><span style={{ height: "18px", width: "65%", borderRadius: "6px", background: "#e4e4e7" }} /><span style={{ height: "12px", borderRadius: "6px", background: "#f4f4f5" }} /><span style={{ height: "12px", width: "85%", borderRadius: "6px", background: "#f4f4f5" }} /></div>' },
      divider:{ html:'<hr style="width:100%;border:0;border-top:1px solid #e4e4e7" />', jsx:'<hr style={{ width: "100%", border: 0, borderTop: "1px solid #e4e4e7" }} />' },
      hero:{ html:'<section style="display:grid;gap:24px;padding:72px 48px;border:1px solid #d4d4d8;border-radius:20px;background:#fafafa"><span style="font-size:13px;font-weight:700;letter-spacing:.12em;color:#71717a">EYEBROW</span><h1 style="max-width:760px;margin:0;font-size:56px;line-height:1.08;letter-spacing:-.04em">명확한 메시지를 담은 히어로 제목</h1><p style="max-width:640px;margin:0;color:#52525b;font-size:18px;line-height:1.65">서비스의 핵심 가치를 설명하는 문장을 입력하세요.</p><div style="display:flex;gap:12px;flex-wrap:wrap"><button type="button" style="padding:12px 18px;border:0;border-radius:9px;background:#18181b;color:white;font-weight:700">Primary action</button><button type="button" style="padding:12px 18px;border:1px solid #d4d4d8;border-radius:9px;background:white;font-weight:700">Secondary</button></div></section>', jsx:'<section style={{ display: "grid", gap: "24px", padding: "72px 48px", border: "1px solid #d4d4d8", borderRadius: "20px", background: "#fafafa" }}><span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: ".12em", color: "#71717a" }}>EYEBROW</span><h1 style={{ maxWidth: "760px", margin: 0, fontSize: "56px", lineHeight: 1.08, letterSpacing: "-.04em" }}>명확한 메시지를 담은 히어로 제목</h1><p style={{ maxWidth: "640px", margin: 0, color: "#52525b", fontSize: "18px", lineHeight: 1.65 }}>서비스의 핵심 가치를 설명하는 문장을 입력하세요.</p><div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}><button type="button" style={{ padding: "12px 18px", border: 0, borderRadius: "9px", background: "#18181b", color: "white", fontWeight: 700 }}>Primary action</button><button type="button" style={{ padding: "12px 18px", border: "1px solid #d4d4d8", borderRadius: "9px", background: "white", fontWeight: 700 }}>Secondary</button></div></section>' },
      "feature-grid":{ html:'<section style="display:grid;gap:28px;padding:56px 0"><div><h2 style="margin:0 0 10px;font-size:36px">핵심 기능</h2><p style="margin:0;color:#71717a">중요한 기능과 이점을 간결하게 소개하세요.</p></div><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px"><article style="min-height:180px;padding:24px;border:1px solid #e4e4e7;border-radius:14px"><strong>Feature 01</strong><p style="color:#71717a">기능 설명을 입력하세요.</p></article><article style="min-height:180px;padding:24px;border:1px solid #e4e4e7;border-radius:14px"><strong>Feature 02</strong><p style="color:#71717a">기능 설명을 입력하세요.</p></article><article style="min-height:180px;padding:24px;border:1px solid #e4e4e7;border-radius:14px"><strong>Feature 03</strong><p style="color:#71717a">기능 설명을 입력하세요.</p></article></div></section>', jsx:'<section style={{ display: "grid", gap: "28px", padding: "56px 0" }}><div><h2 style={{ margin: "0 0 10px", fontSize: "36px" }}>핵심 기능</h2><p style={{ margin: 0, color: "#71717a" }}>중요한 기능과 이점을 간결하게 소개하세요.</p></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "16px" }}>{["01","02","03"].map((item)=><article key={item} style={{ minHeight: "180px", padding: "24px", border: "1px solid #e4e4e7", borderRadius: "14px" }}><strong>Feature {item}</strong><p style={{ color: "#71717a" }}>기능 설명을 입력하세요.</p></article>)}</div></section>' },
      pricing:{ html:'<section style="display:grid;gap:28px;padding:56px 0"><h2 style="margin:0;font-size:36px;text-align:center">요금제</h2><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px"><article style="padding:28px;border:1px solid #e4e4e7;border-radius:16px"><strong>Starter</strong><h3 style="font-size:32px">₩0</h3><button type="button">선택</button></article><article style="padding:28px;border:2px solid #18181b;border-radius:16px"><strong>Pro</strong><h3 style="font-size:32px">₩29,000</h3><button type="button">선택</button></article><article style="padding:28px;border:1px solid #e4e4e7;border-radius:16px"><strong>Team</strong><h3 style="font-size:32px">문의</h3><button type="button">선택</button></article></div></section>', jsx:'<section style={{ display: "grid", gap: "28px", padding: "56px 0" }}><h2 style={{ margin: 0, fontSize: "36px", textAlign: "center" }}>요금제</h2><div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "16px" }}>{["Starter","Pro","Team"].map((name,index)=><article key={name} style={{ padding: "28px", border: index===1 ? "2px solid #18181b" : "1px solid #e4e4e7", borderRadius: "16px" }}><strong>{name}</strong><h3 style={{ fontSize: "32px" }}>{index===0?"₩0":index===1?"₩29,000":"문의"}</h3><button type="button">선택</button></article>)}</div></section>' },
      contact:{ html:'<section style="display:grid;grid-template-columns:1fr 1fr;gap:48px;padding:56px;border:1px solid #e4e4e7;border-radius:18px"><div><h2 style="margin:0 0 12px;font-size:36px">문의하기</h2><p style="color:#71717a">프로젝트에 관해 알려 주세요. 빠르게 답변드리겠습니다.</p></div><form style="display:grid;gap:12px"><input placeholder="이름" style="padding:12px;border:1px solid #d4d4d8;border-radius:8px"><input type="email" placeholder="이메일" style="padding:12px;border:1px solid #d4d4d8;border-radius:8px"><textarea placeholder="문의 내용" rows="4" style="padding:12px;border:1px solid #d4d4d8;border-radius:8px"></textarea><button type="button">보내기</button></form></section>', jsx:'<section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "48px", padding: "56px", border: "1px solid #e4e4e7", borderRadius: "18px" }}><div><h2 style={{ margin: "0 0 12px", fontSize: "36px" }}>문의하기</h2><p style={{ color: "#71717a" }}>프로젝트에 관해 알려 주세요. 빠르게 답변드리겠습니다.</p></div><form style={{ display: "grid", gap: "12px" }}><input placeholder="이름" style={{ padding: "12px", border: "1px solid #d4d4d8", borderRadius: "8px" }}/><input type="email" placeholder="이메일" style={{ padding: "12px", border: "1px solid #d4d4d8", borderRadius: "8px" }}/><textarea placeholder="문의 내용" rows={4} style={{ padding: "12px", border: "1px solid #d4d4d8", borderRadius: "8px" }}/><button type="button">보내기</button></form></section>' },
      footer:{ html:'<footer style="display:grid;grid-template-columns:2fr repeat(3,1fr);gap:32px;padding:48px;border-top:1px solid #e4e4e7"><div><strong style="font-size:20px">Brand</strong><p style="color:#71717a">브랜드 설명을 입력하세요.</p></div><div><strong>Product</strong><p>Overview</p><p>Pricing</p></div><div><strong>Company</strong><p>About</p><p>Careers</p></div><div><strong>Legal</strong><p>Privacy</p><p>Terms</p></div></footer>', jsx:'<footer style={{ display: "grid", gridTemplateColumns: "2fr repeat(3,1fr)", gap: "32px", padding: "48px", borderTop: "1px solid #e4e4e7" }}><div><strong style={{ fontSize: "20px" }}>Brand</strong><p style={{ color: "#71717a" }}>브랜드 설명을 입력하세요.</p></div><div><strong>Product</strong><p>Overview</p><p>Pricing</p></div><div><strong>Company</strong><p>About</p><p>Careers</p></div><div><strong>Legal</strong><p>Privacy</p><p>Terms</p></div></footer>' },
    };
    return map[kind] || map.frame;
  }

  function insertPrimitive(parentEl, kind) {
    const value = primitive(kind);
    const wrapper = document.createElement("div"); wrapper.innerHTML = value.html;
    const node = wrapper.firstElementChild;
    if (!node) return;
    const id = crypto.randomUUID(); node.dataset.polazuGenerated = id; parentEl.appendChild(node);
    send("structure", { edit:{ id, path:currentPath(), selector:selector(parentEl), sourceId:sourceId(parentEl), operation:{ type:"insert", kind, parentSelector:selector(parentEl), parentSourceId:sourceId(parentEl), html:value.html, jsx:value.jsx } } });
    scheduleReport(); if (node instanceof HTMLElement) selectElement(node, false);
  }

  function duplicateSelected() {
    const el = selected[selected.length - 1]; if (!el || locked.has(selector(el))) return;
    const id = crypto.randomUUID(); const clone = el.cloneNode(true); clone.dataset.polazuGenerated = id; el.after(clone);
    send("structure", { edit:{ id, path:currentPath(), selector:selector(el), sourceId:sourceId(el), generatedId:el.dataset.polazuGenerated || undefined, operation:{ type:"duplicate", sourceId:sourceId(el) } } });
    scheduleReport(); if (clone instanceof HTMLElement) selectElement(clone, false);
  }

  function deleteSelected() {
    if (!selected.length) return;
    const editsOut = [];
    for (const el of selected.filter((item)=>!locked.has(selector(item)) && !selected.some((other)=>other!==item && other.contains(item)))) {
      saveOriginal(el); el.style.display = "none"; el.dataset.polazuDeleted = "true";
      editsOut.push({ id:crypto.randomUUID(), path:currentPath(), selector:selector(el), sourceId:sourceId(el), generatedId:el.dataset.polazuGenerated || undefined, operation:{ type:"delete", sourceId:sourceId(el) } });
    }
    deselect(); if (editsOut.length) send("structure", { edits:editsOut }); scheduleReport();
  }

  function reorderSelected(direction) {
    const el = selected[selected.length - 1]; if (!el || !el.parentElement) return;
    const edit = reorderOneStep(el, direction);
    if (!edit) return;
    send("structure", { edit });
    scheduleReport(); drawSelection();
    send("selected", { element:describe(el), elements:selected.map(describe), breadcrumbs:ancestors(el) });
  }

  function reparentLayer(sourceSelector, targetParentSelector) {
    let el, target;
    try { el = document.querySelector(sourceSelector); target = document.querySelector(targetParentSelector); } catch { return; }
    if (!(el instanceof HTMLElement) || !(target instanceof HTMLElement) || locked.has(selector(el))) return;
    if (!safeReparentContainer(target, el)) { send("notice", { message:"텍스트·이미지 같은 말단 요소나 자기 하위 요소 안으로는 이동할 수 없습니다." }); return; }
    const support = reparentSourceSupport(el, target);
    if (!support.supported) { send("notice", { message:support.message }); return; }
    const state = { el, startSelector:selector(el), startSourceId:sourceId(el) };
    rememberOriginalOrder(el.parentElement); rememberOriginalOrder(target);
    const edit = reparentEdit(state, target);
    beginInternalMutation(); target.appendChild(el);
    selected.splice(0, selected.length, el); drawSelection(); scheduleReport();
    send("structure", { edit });
    send("selected", { element:describe(el), elements:[describe(el)], breadcrumbs:ancestors(el) });
  }

  function toggleVisibility(targetSelector) {
    let el; try { el = document.querySelector(targetSelector); } catch { return; }
    if (!(el instanceof HTMLElement)) return;
    const hidden = getComputedStyle(el).visibility === "hidden";
    const styles = { visibility:hidden ? "visible" : "hidden" };
    applyStyle(el, styles); send("manipulation", { changes:[{ selector:selector(el), sourceId:sourceId(el), generatedId:el.dataset.polazuGenerated || undefined, styles, element:describe(el) }] }); scheduleReport();
  }

  function toggleLock(targetSelector) {
    if (locked.has(targetSelector)) locked.delete(targetSelector); else locked.add(targetSelector);
    if (locked.has(targetSelector) && selected.some((el)=>selector(el) === targetSelector)) deselect();
    sendLayerMetadata();
    scheduleReport(); drawSelection();
  }

  function renameLayer(targetSelector, name) {
    if (typeof name !== "string" || name.trim().length < 1 || name.length > 80) return;
    aliases.set(targetSelector, name.trim()); sendLayerMetadata(); scheduleReport();
  }

  function sendLayerMetadata() {
    send("layer-metadata", { layerAliases:Object.fromEntries(aliases), lockedSelectors:[...locked] });
  }

  function loadLayerMetadata(layerAliases, lockedSelectors) {
    aliases.clear(); locked.clear();
    if (layerAliases && typeof layerAliases === "object" && !Array.isArray(layerAliases)) {
      for (const [targetSelector, alias] of Object.entries(layerAliases).slice(0, 1000)) {
        if (typeof targetSelector === "string" && targetSelector.length <= 2000 && typeof alias === "string" && alias.trim() && alias.length <= 80) aliases.set(targetSelector, alias.trim());
      }
    }
    if (Array.isArray(lockedSelectors)) {
      for (const targetSelector of lockedSelectors.slice(0, 1000)) if (typeof targetSelector === "string" && targetSelector.length <= 2000) locked.add(targetSelector);
    }
  }

  function applyPreviewPatch(payload) {
    let el; try { el = document.querySelector(payload.selector); } catch { return; }
    if (!(el instanceof HTMLElement)) return;
    if (payload.styles) applyStyle(el, payload.styles);
    for (const [name, value] of Object.entries(payload.attributes || {})) {
      if (/^(?:id|class|href|src|alt|title|role|target|rel|type|name|placeholder|aria-[a-z-]+|data-[a-z-]+)$/.test(name) && typeof value === "string" && value.length < 1000) {
        saveOriginalAttribute(el, name); el.setAttribute(name, value);
      }
    }
    if (typeof payload.text === "string" && el.childElementCount === 0) { saveOriginal(el); el.textContent = payload.text; }
    drawSelection();
  }

  function parseRgb(value) {
    const match = String(value || "").match(/rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)/i);
    if (!match) return null;
    return { r:Number(match[1]), g:Number(match[2]), b:Number(match[3]), a:match[4] == null ? 1 : Number(match[4]) };
  }
  function relativeLuminance(color) {
    const channel = (value) => { const next=value/255; return next <= .03928 ? next/12.92 : Math.pow((next+.055)/1.055,2.4); };
    return .2126*channel(color.r)+.7152*channel(color.g)+.0722*channel(color.b);
  }
  function contrastRatio(foreground, background) {
    const front = foreground.a < 1 ? { r:foreground.r*foreground.a+background.r*(1-foreground.a), g:foreground.g*foreground.a+background.g*(1-foreground.a), b:foreground.b*foreground.a+background.b*(1-foreground.a), a:1 } : foreground;
    const a=relativeLuminance(front), b=relativeLuminance(background);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  }
  function effectiveBackground(el) {
    let node=el;
    while(node instanceof HTMLElement){const color=parseRgb(getComputedStyle(node).backgroundColor);if(color&&color.a>.05)return color;node=node.parentElement;}
    return {r:255,g:255,b:255,a:1};
  }

  function audit() {
    const issues = [];
    const add = (severity, rule, message, el) => issues.push({ id:crypto.randomUUID(), severity, rule, message, selector:el ? selector(el) : undefined, sourceId:el ? sourceId(el) : undefined });
    const all = [...document.body.querySelectorAll("*")].filter((el) => el instanceof HTMLElement && !ignored(el));
    const ids = new Map();
    const title=(document.title||"").trim(), description=document.querySelector('meta[name="description"]')?.getAttribute("content")?.trim()||"";
    if(!title)add("error","meta-title","페이지 제목(title)이 없습니다.");else if(title.length>60)add("info","meta-title-length",`페이지 제목이 ${title.length}자입니다. 검색 결과에서 잘릴 수 있습니다.`);
    if(!description)add("warning","meta-description","페이지 설명(meta description)이 없습니다.");else if(description.length>160)add("info","meta-description-length",`페이지 설명이 ${description.length}자입니다. 검색 결과에서 잘릴 수 있습니다.`);
    if(!document.documentElement.lang)add("warning","document-language","html 요소에 문서 언어(lang)가 없습니다.");
    if(!document.querySelector('meta[name="viewport"]'))add("warning","viewport","반응형 viewport 메타 태그가 없습니다.");
    const mains=document.querySelectorAll("main"), h1s=document.querySelectorAll("h1");
    if(!mains.length)add("info","main-landmark","페이지에 main 랜드마크가 없습니다.");else if(mains.length>1)add("warning","main-landmark",`main 랜드마크가 ${mains.length}개입니다.`);
    if(!h1s.length)add("warning","heading-h1","페이지에 H1 제목이 없습니다.");else if(h1s.length>1)add("warning","heading-h1",`H1 제목이 ${h1s.length}개입니다. 페이지의 주 제목을 확인하세요.`);
    if(!document.querySelector('script[type="application/ld+json"]'))add("info","schema-markup","구조화 데이터(JSON-LD)가 없습니다.");
    let previousHeading=0;
    for (const el of all) {
      if (el.id) { const count = (ids.get(el.id) || 0) + 1; ids.set(el.id, count); }
      if (el instanceof HTMLImageElement && !el.hasAttribute("alt")) add("error","image-alt","이미지에 alt 속성이 없습니다.",el);
      if (el instanceof HTMLImageElement && el.complete && el.naturalWidth === 0) add("error","broken-asset","이미지 자산을 불러오지 못했습니다.",el);
      if (el instanceof HTMLButtonElement && !(el.innerText || el.getAttribute("aria-label") || el.getAttribute("title"))) add("error","button-name","버튼의 접근 가능한 이름이 없습니다.",el);
      if (el instanceof HTMLAnchorElement && !(el.innerText || el.getAttribute("aria-label") || el.getAttribute("title"))) add("error","link-name","링크의 접근 가능한 이름이 없습니다.",el);
      if ((el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement) && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby") && !(el.id && document.querySelector(`label[for=${JSON.stringify(el.id)}]`)) && !el.closest("label")) add("warning","form-label","폼 컨트롤에 연결된 라벨이 없습니다.",el);
      if(/^H[1-6]$/.test(el.tagName)){const level=Number(el.tagName[1]);if(previousHeading&&level>previousHeading+1)add("warning","heading-order",`H${previousHeading} 다음에 H${level}가 나옵니다. 제목 단계가 건너뛰었습니다.`,el);previousHeading=level;}
      if(el instanceof HTMLAnchorElement&&(!el.getAttribute("href")||el.getAttribute("href")==="#"))add("info","link-target","링크 목적지가 비어 있거나 #으로만 설정되어 있습니다.",el);
      const box = el.getBoundingClientRect(); const parent = el.parentElement?.getBoundingClientRect();
      if (parent && box.width > parent.width + 2 && getComputedStyle(el.parentElement).overflowX === "visible") add("warning","overflow","부모 너비보다 큰 요소입니다. 좁은 화면에서 넘칠 수 있습니다.",el);
      const style = getComputedStyle(el);
      if (style.outlineStyle === "none" && ["A","BUTTON","INPUT","SELECT","TEXTAREA"].includes(el.tagName)) add("info","focus-style","포커스 스타일은 실제 키보드 이동으로 확인하세요.",el);
      if (["A","BUTTON","INPUT","SELECT","TEXTAREA"].includes(el.tagName) && (box.width < 24 || box.height < 24)) add("info","target-size","상호작용 요소의 클릭 영역이 24×24px보다 작습니다.",el);
      if (el.childElementCount === 0 && (el.textContent || "").trim() && style.visibility !== "hidden" && style.display !== "none") {
        const foreground=parseRgb(style.color), background=effectiveBackground(el);
        if (foreground) { const ratio=contrastRatio(foreground,background); const fontSize=parseFloat(style.fontSize)||16; const large=fontSize>=24 || (fontSize>=18.66 && Number(style.fontWeight)>=700); const threshold=large?3:4.5; if(ratio<threshold)add("warning","contrast",`텍스트 대비가 약 ${ratio.toFixed(2)}:1입니다. 권장 ${threshold}:1 이상을 확인하세요.`,el); }
      }
    }
    for (const [id, count] of ids) if (count > 1) add("error","duplicate-id",`중복 id “${id}”가 ${count}개 있습니다.`);
    send("audit-result", { issues:issues.slice(0, 200), checked:all.length });
  }

  let contextMenu = null;

  function closeContextMenu() {
    if (!contextMenu) return;
    contextMenu.remove();
    contextMenu = null;
  }

  function contextMenuAction(action, el) {
    closeContextMenu();
    if (action === "edit-text") beginTextEdit(el);
    else if (action === "copy") copySelected();
    else if (action === "paste") pasteClipboard();
    else if (action === "duplicate") duplicateSelected();
    else if (action === "reorder-up") reorderSelected("up");
    else if (action === "reorder-down") reorderSelected("down");
    else if (action === "select-parent") navigateSelection("parent");
    else if (action === "visibility") toggleVisibility(selector(el));
    else if (action === "lock") toggleLock(selector(el));
    else if (action === "delete") deleteSelected();
  }

  function showContextMenu(clientX, clientY, el) {
    closeContextMenu();
    const targetSelector = selector(el);
    const canEditText = el.childElementCount === 0 && !["INPUT","TEXTAREA","SELECT","IMG","SVG","VIDEO","CANVAS","HR","BR"].includes(el.tagName);
    const items = [
      { action:"edit-text", label:"텍스트 편집", shortcut:"Enter", disabled:!canEditText },
      { action:"copy", label:"복사", shortcut:"Ctrl C" },
      { action:"paste", label:"붙여넣기", shortcut:"Ctrl V", disabled:!clipboard },
      { action:"duplicate", label:"복제", shortcut:"Ctrl D" },
      { separator:true },
      { action:"reorder-up", label:"레이어 위로", shortcut:"", disabled:!el.previousElementSibling },
      { action:"reorder-down", label:"레이어 아래로", shortcut:"", disabled:!el.nextElementSibling },
      { action:"select-parent", label:"부모 선택", shortcut:"Shift Enter", disabled:!el.parentElement || el.parentElement === document.documentElement },
      { separator:true },
      { action:"visibility", label:getComputedStyle(el).visibility === "hidden" ? "레이어 표시" : "레이어 숨기기", shortcut:"" },
      { action:"lock", label:locked.has(targetSelector) ? "잠금 해제" : "레이어 잠금", shortcut:"" },
      { action:"delete", label:"삭제", shortcut:"Backspace", danger:true },
    ];
    const menu = document.createElement("div");
    menu.dataset.polazuOverlay = "true";
    menu.dataset.polazuContextMenu = "true";
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", `${elementLabel(el)} 작업`);
    menu.tabIndex = -1;
    menu.style.cssText = `position:fixed;left:${clientX}px;top:${clientY}px;min-width:214px;padding:5px;border:1px solid #3b3d48;border-radius:9px;background:#18191f;color:#f5f3ff;box-shadow:0 16px 42px rgba(0,0,0,.42);font:500 12px/1.2 system-ui,-apple-system,sans-serif;pointer-events:auto;z-index:2147483647;`;
    for (const item of items) {
      if (item.separator) {
        const separator = document.createElement("div");
        separator.setAttribute("role", "separator");
        separator.style.cssText = "height:1px;margin:5px 3px;background:#30323b;";
        menu.appendChild(separator);
        continue;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.contextAction = item.action;
      button.setAttribute("role", "menuitem");
      button.disabled = !!item.disabled;
      button.style.cssText = `width:100%;height:30px;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:0 8px;border:0;border-radius:5px;background:transparent;color:${item.danger ? "#ff8170" : "inherit"};font:inherit;text-align:left;cursor:${item.disabled ? "default" : "pointer"};opacity:${item.disabled ? ".38" : "1"};`;
      const label = document.createElement("span"); label.textContent = item.label;
      const shortcut = document.createElement("kbd"); shortcut.textContent = item.shortcut;
      shortcut.style.cssText = "color:#8f94a2;font:500 10px/1 system-ui;";
      button.append(label, shortcut);
      button.addEventListener("pointerenter", () => { if (!button.disabled) button.style.background = "#5b43c7"; });
      button.addEventListener("pointerleave", () => { button.style.background = "transparent"; });
      button.addEventListener("focus", () => { button.style.background = "#5b43c7"; });
      button.addEventListener("blur", () => { button.style.background = "transparent"; });
      button.addEventListener("click", () => contextMenuAction(item.action, el));
      menu.appendChild(button);
    }
    menu.addEventListener("keydown", (event) => {
      const choices = [...menu.querySelectorAll("button:not(:disabled)")];
      const current = choices.indexOf(document.activeElement);
      if (event.key === "Escape") { event.preventDefault(); closeContextMenu(); return; }
      if (!["ArrowDown","ArrowUp","Home","End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? choices.length - 1
        : (current + (event.key === "ArrowUp" ? -1 : 1) + choices.length) % choices.length;
      choices[next]?.focus();
    });
    overlayRoot.appendChild(menu);
    contextMenu = menu;
    requestAnimationFrame(() => {
      if (contextMenu !== menu) return;
      const box = menu.getBoundingClientRect();
      menu.style.left = `${Math.max(6, Math.min(clientX, innerWidth - box.width - 6))}px`;
      menu.style.top = `${Math.max(6, Math.min(clientY, innerHeight - box.height - 6))}px`;
      menu.querySelector("button:not(:disabled)")?.focus();
    });
  }


  function copySelected() {
    const el = selected.at(-1);
    if (!el) return;
    clipboard = { selector:selector(el), sourceId:sourceId(el), generatedId:el.dataset.polazuGenerated || undefined };
    send("notice", { message:"선택 요소를 복사했습니다. 붙여넣기는 소스 안전성을 위해 원본과 같은 레벨에 복제합니다." });
  }

  function pasteClipboard() {
    if (!clipboard) { send("notice", { message:"먼저 요소를 복사하세요." }); return; }
    let el;
    try { el = document.querySelector(clipboard.selector); } catch { return; }
    if (!(el instanceof HTMLElement)) { send("notice", { message:"복사한 원본 요소를 현재 화면에서 다시 찾지 못했습니다." }); return; }
    const id = crypto.randomUUID();
    const clone = el.cloneNode(true); clone.dataset.polazuGenerated = id; el.after(clone);
    send("structure", { edit:{ id, path:currentPath(), selector:selector(el), sourceId:sourceId(el), generatedId:el.dataset.polazuGenerated || undefined, operation:{ type:"duplicate", sourceId:sourceId(el) } } });
    scheduleReport(); if (clone instanceof HTMLElement) selectElement(clone, false);
  }

  function insertionContainer(el) {
    const containers = new Set(["BODY","MAIN","SECTION","DIV","ARTICLE","ASIDE","HEADER","FOOTER","NAV","FORM","LI","UL","OL","TD","TH"]);
    while (el instanceof HTMLElement && (!containers.has(el.tagName) || ignored(el))) el = el.parentElement;
    return el instanceof HTMLElement ? el : document.body;
  }

  function finishTextEdit(cancel = false) {
    if (!textEdit) return;
    const editing = textEdit;
    textEdit = null;
    editing.el.removeEventListener("blur", editing.onBlur);
    if (cancel) editing.el.textContent = editing.originalText;
    if (editing.contentEditable === null) editing.el.removeAttribute("contenteditable");
    else editing.el.setAttribute("contenteditable", editing.contentEditable);
    if (!cancel && editing.el.textContent !== editing.originalText) send("manipulation", { changes:[{ selector:selector(editing.el), sourceId:sourceId(editing.el), generatedId:editing.el.dataset.polazuGenerated || undefined, text:editing.el.textContent || "", element:describe(editing.el) }] });
    getSelection()?.removeAllRanges();
    editing.el.blur();
    drawSelection();
  }

  function beginTextEdit(el) {
    if (!(el instanceof HTMLElement) || ignored(el) || locked.has(selector(el)) || el.childElementCount > 0 || ["INPUT","TEXTAREA","SELECT","IMG","SVG","VIDEO","CANVAS","HR","BR"].includes(el.tagName)) return false;
    if (textEdit?.el === el) return true;
    finishTextEdit();
    saveOriginal(el);
    textEdit = { el, originalText:el.textContent, contentEditable:el.getAttribute("contenteditable"), onBlur:()=>finishTextEdit() };
    el.contentEditable = "plaintext-only";
    el.focus();
    const range = document.createRange(); range.selectNodeContents(el); const selection = getSelection(); selection?.removeAllRanges(); selection?.addRange(range);
    el.addEventListener("blur", textEdit.onBlur);
    return true;
  }

  function beginPan(event) {
    if (panState || dragState) return;
    event.preventDefault(); event.stopImmediatePropagation();
    panState = { x:event.screenX, y:event.screenY, pointerId:event.pointerId };
    document.documentElement.setPointerCapture?.(event.pointerId);
    drawHover(null);
    send("canvas-pan", { phase:"start", dx:0, dy:0, coordinateSpace:"screen" });
  }

  function finishPan() {
    if (!panState) return;
    const pointerId = panState.pointerId;
    panState = null;
    if (document.documentElement.hasPointerCapture?.(pointerId)) document.documentElement.releasePointerCapture(pointerId);
    send("canvas-pan", { phase:"end", dx:0, dy:0, coordinateSpace:"screen" });
  }

  function handleCommand(command, payload = {}) {
    if (command.startsWith("align-")) alignSelection(command.slice(6));
    else if (command === "distribute-horizontal") distributeSelection("horizontal");
    else if (command === "distribute-vertical") distributeSelection("vertical");
    else if (command === "duplicate") duplicateSelected();
    else if (command === "delete") deleteSelected();
    else if (command === "reorder-up" || command === "reorder-down") reorderSelected(command.endsWith("up") ? "up" : "down");
    else if (command === "reparent-layer") reparentLayer(payload.sourceSelector, payload.targetParentSelector);
    else if (command === "toggle-visibility") toggleVisibility(payload.selector || selected.at(-1) && selector(selected.at(-1)));
    else if (command === "toggle-lock") toggleLock(payload.selector || selected.at(-1) && selector(selected.at(-1)));
    else if (command === "rename-layer") renameLayer(payload.selector, payload.name);
    else if (command === "insert") {
      let parentEl = selected.at(-1);
      if (typeof payload.parentSelector === "string") { try { parentEl = document.querySelector(payload.parentSelector) || parentEl; } catch {} }
      insertPrimitive(insertionContainer(parentEl), payload.kind || "frame");
    }
    else if (command === "insert-at-point") {
      const parentEl = document.elementFromPoint(Number(payload.x)||0, Number(payload.y)||0);
      insertPrimitive(insertionContainer(parentEl), payload.kind || "frame");
    }
    else if (command === "copy") copySelected();
    else if (command === "paste") pasteClipboard();
    else if (command === "nudge") nudgeSelected(Number(payload.x)||0, Number(payload.y)||0);
    else if (command === "deselect") deselect();
    else if (command === "select-child") { if (!beginTextEdit(selected.at(-1))) navigateSelection("child"); }
    else if (command.startsWith("select-")) navigateSelection(command.slice(7));
    else if (command === "edit-text") beginTextEdit(selected.at(-1));
    else if (command === "audit") audit();
  }

  function report() {
    scheduled = false;
    const failure = document.querySelector("[data-polazu-runtime-error], vite-error-overlay");
    if (failure) send("runtime-error", { message:(failure.shadowRoot?.textContent || failure.textContent || "미리보기 컴파일 실패").slice(0, 2000) });
    const nodes = visibleElements();
    send("ready", {
      documentId, path:currentPath(), title:document.title, hasContent:nodes.length > 0 || !!document.body.innerText.trim(),
      layers:nodes.map(layerFor), viewport:{ width:innerWidth, height:innerHeight, scrollX, scrollY },
    });
    drawSelection(); drawHover(hoverTarget);
  }

  function scheduleReport() { if (!scheduled) { scheduled = true; setTimeout(report, 180); } }

  document.addEventListener("pointermove", (event) => {
    if (panState) { event.preventDefault(); event.stopImmediatePropagation(); send("canvas-pan", { phase:"move", dx:event.screenX-panState.x, dy:event.screenY-panState.y, coordinateSpace:"screen" }); return; }
    if (mode !== "edit" || tool !== "select" || dragState || spacePressed || textEdit) return;
    const el = event.target instanceof Element ? event.target.closest("*") : null;
    if (el instanceof HTMLElement && !ignored(el)) drawHover(el); else drawHover(null);
  }, true);

  document.addEventListener("pointerdown", (event) => {
    const contextTarget = event.target instanceof Element ? event.target.closest("[data-polazu-context-menu]") : null;
    if (contextMenu && !contextTarget) closeContextMenu();
    if (mode !== "edit") return;
    if (event.button === 1 || (event.button === 0 && (tool === "hand" || spacePressed))) { beginPan(event); return; }
    if (event.button !== 0) return;
    const el = event.target instanceof Element ? event.target.closest("*") : null;
    if (textEdit?.el.contains(el)) return;
    if (textEdit) finishTextEdit();
    if (!(el instanceof HTMLElement) || ignored(el)) return;
    if (tool === "comment") { event.preventDefault(); event.stopImmediatePropagation(); send("comment-target", { element:describe(el) }); return; }
    if (["frame","text","rectangle","image"].includes(tool)) { event.preventDefault(); event.stopImmediatePropagation(); insertPrimitive(insertionContainer(el), tool); return; }
    if (tool !== "select") return;
    if (isMarqueeSurface(el) && (el === document.body || el === document.documentElement || !selected.includes(el))) { beginMarquee(event, el); return; }
    const additive = event.shiftKey;
    if (selected.includes(el) && !additive) { beginManipulation(event, el, "move"); return; }
    event.preventDefault(); event.stopImmediatePropagation();
    selectElement(el, additive);
    if (!additive && event.button === 0) beginManipulation(event, el, "move");
  }, true);

  document.addEventListener("pointerup", finishPan, true);
  document.addEventListener("pointercancel", finishPan, true);
  document.addEventListener("dragstart", (event)=>{ if (mode === "edit" && !textEdit) event.preventDefault(); }, true);

  document.addEventListener("wheel", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    send("canvas-zoom", { direction:event.deltaY, x:event.clientX, y:event.clientY });
  }, { capture:true, passive:false });

  document.addEventListener("contextmenu", (event) => {
    if (mode !== "edit" || tool !== "select" || textEdit || dragState || marqueeState) return;
    const el = event.target instanceof Element ? event.target.closest("*") : null;
    if (!(el instanceof HTMLElement) || ignored(el) || locked.has(selector(el))) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!selected.includes(el)) selectElement(el, false);
    showContextMenu(event.clientX, event.clientY, el);
  }, true);

  document.addEventListener("dblclick", (event) => {
    if (mode !== "edit" || tool !== "select") return;
    const el = event.target instanceof Element ? event.target.closest("*") : null;
    if (beginTextEdit(el)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);

  document.addEventListener("keydown", (event)=>{
    if (mode !== "edit") return;
    if (event.target instanceof Element && event.target.closest("[data-polazu-overlay]")) return;
    if (textEdit) {
      if (event.key === "Escape" || (event.key === "Enter" && (event.ctrlKey || event.metaKey))) { event.preventDefault(); event.stopImmediatePropagation(); finishTextEdit(event.key === "Escape"); }
      return;
    }
    if (event.code === "Space" && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); event.stopImmediatePropagation(); spacePressed = true; document.documentElement.setAttribute("data-polazu-panning", "true"); return; }
    if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); if (marqueeState) cancelMarquee(); else if (dragState) cancelManipulation(); else if (panState) finishPan(); else navigateSelection("parent"); return; }
    if (event.key === "Enter") { event.preventDefault(); event.stopImmediatePropagation(); if (event.shiftKey || event.ctrlKey || event.metaKey) navigateSelection("parent"); else if (!beginTextEdit(selected.at(-1))) navigateSelection("child"); return; }
    if (event.key === "Tab") { event.preventDefault(); event.stopImmediatePropagation(); navigateSelection(event.shiftKey ? "previous" : "next"); return; }
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) || /^Digit[012]$/.test(event.code) || ["delete","backspace","arrowup","arrowdown","arrowleft","arrowright","v","h","f","r","t","i","c","g","w","?","1","2","0","+","-","="].includes(key)) {
      event.preventDefault(); event.stopImmediatePropagation();
      send("editor-shortcut", { key:event.key, code:event.code, ctrlKey:event.ctrlKey, metaKey:event.metaKey, shiftKey:event.shiftKey, altKey:event.altKey, repeat:event.repeat });
    }
  }, true);

  document.addEventListener("keyup", (event)=>{ if (event.code === "Space") { spacePressed=false; document.documentElement.removeAttribute("data-polazu-panning"); } }, true);
  addEventListener("blur", ()=>{ spacePressed=false; document.documentElement.removeAttribute("data-polazu-panning"); closeContextMenu(); cancelMarquee(); cancelManipulation(); finishPan(); });

  document.addEventListener("click",(event)=>{
    if (event.target instanceof Element && event.target.closest("[data-polazu-overlay]")) return;
    if (mode === "edit" && !textEdit) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if(mode!=="preview")return;const trigger=event.target instanceof Element?event.target.closest("[data-action]"):null;if(!(trigger instanceof HTMLElement))return;
    const action=trigger.getAttribute("data-action");const target=trigger.getAttribute("data-target");if(action==="toggle"&&target){let element;try{element=document.querySelector(target);}catch{return;}if(element){event.preventDefault();element.classList.toggle("is-open");send("notice",{message:`${target} 상태를 전환했습니다.`});}}
  },true);

  document.addEventListener("submit", (event) => { event.preventDefault(); send("notice", { message:"미리보기에서는 실제 폼 제출을 차단합니다." }); }, true);

  addEventListener("message", (event) => {
    const data = event.data;
    if (event.source !== parent || event.origin !== config.origin || !data || data.token !== config.token || data.source !== "polazu-editor") return;
    if (data.type === "sync") {
      mode = data.mode === "preview" ? "preview" : "edit";
      tool = typeof data.tool === "string" ? data.tool : "select";
      document.documentElement.toggleAttribute("data-polazu-hand", mode === "edit" && tool === "hand");
      if (mode !== "edit") { closeContextMenu(); finishTextEdit(); cancelManipulation(); finishPan(); }
      snap = data.snap !== false;
      gridSize = Number.isFinite(data.gridSize) ? Math.min(64, Math.max(1, data.gridSize)) : 8;
      rules = Array.isArray(data.rules) ? data.rules : [];
      edits = Array.isArray(data.edits) ? data.edits : [];
      loadLayerMetadata(data.layerAliases, data.lockedSelectors);
      wireframe = data.wireframe === true;
      document.documentElement.toggleAttribute("data-polazu-wireframe", wireframe);
      try { sessionStorage.setItem(`polazu-state-${config.token}`, JSON.stringify({ mode, tool, snap, gridSize, rules, edits })); } catch {}
      replay();
    }
    if (data.type === "select" && typeof data.selector === "string") {
      try { const el = document.querySelector(data.selector); if (el instanceof HTMLElement) { el.scrollIntoView({ block:"center", inline:"center" }); selectElement(el, !!data.additive); } } catch {}
    }
    if (data.type === "preview-patch") applyPreviewPatch(data);
    if (data.type === "commit-preview") { originals.clear(); originalOrders.clear(); }
    if (data.type === "command" && typeof data.command === "string") handleCommand(data.command, data.payload || {});
  });

  const matchRule = (method, url) => rules.find((rule) => rule.method === method && (rule.url === url.pathname + url.search || rule.url === url.pathname));
  window.fetch = async (input, init = {}) => {
    const url = new URL(input instanceof Request ? input.url : String(input), location.href);
    const method = (init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const rule = matchRule(method, url);
    const api = /^\/api(?:\/|$)/.test(url.pathname) || !["GET","HEAD"].includes(method);
    if (rule || api) {
      send("request", { method, url:url.pathname + url.search, matched:!!rule });
      return new Response(rule && [204,205,304].includes(rule.status) ? null : JSON.stringify(rule ? rule.body : { error:"MOCK_NOT_CONFIGURED", message:"Mock 응답을 설정하세요." }), { status:rule ? rule.status : 501, headers:{ "Content-Type":"application/json" } });
    }
    return originalFetch(input, init);
  };

  window.XMLHttpRequest = class extends NativeXHR {
    open(method, url, ...args) { this._method = String(method).toUpperCase(); this._url = new URL(String(url), location.href); return super.open(method, url, ...args); }
    send(body) {
      const rule = matchRule(this._method, this._url);
      if (!rule && !/^\/api(?:\/|$)/.test(this._url.pathname) && ["GET","HEAD"].includes(this._method)) return super.send(body);
      send("request", { method:this._method, url:this._url.pathname + this._url.search, matched:!!rule });
      const text = JSON.stringify(rule ? rule.body : { error:"MOCK_NOT_CONFIGURED" });
      queueMicrotask(() => {
        Object.defineProperties(this, { readyState:{ value:4, configurable:true }, status:{ value:rule ? rule.status : 501, configurable:true }, responseText:{ get:() => text, configurable:true }, response:{ get:() => this.responseType === "json" ? JSON.parse(text) : text, configurable:true } });
        this.dispatchEvent(new Event("readystatechange")); this.dispatchEvent(new ProgressEvent("load")); this.dispatchEvent(new ProgressEvent("loadend"));
      });
    }
    getAllResponseHeaders() { return this.readyState === 4 && (matchRule(this._method, this._url) || /^\/api(?:\/|$)/.test(this._url.pathname)) ? "content-type: application/json\r\n" : super.getAllResponseHeaders(); }
  };

  addEventListener("error", (event) => send("runtime-error", { message:event.message || "리소스 로딩 오류" }));
  addEventListener("unhandledrejection", (event) => send("runtime-error", { message:String(event.reason?.message || event.reason) }));

  function start() {
    const interactionStyle = document.createElement("style"); interactionStyle.dataset.polazuOverlay = "true"; interactionStyle.textContent = 'html[data-polazu-hand] *,html[data-polazu-panning] *{cursor:grab!important;user-select:none!important}html[data-polazu-marquee] *{cursor:crosshair!important;user-select:none!important}html[data-polazu-panning] [data-polazu-selection-box]{pointer-events:none!important}'; document.head.appendChild(interactionStyle);
    const wireframeStyle=document.createElement("style");wireframeStyle.dataset.polazuOverlay="true";wireframeStyle.textContent='html[data-polazu-wireframe] body *:not([data-polazu-overlay]):not([data-polazu-overlay] *){box-shadow:none!important;text-shadow:none!important}html[data-polazu-wireframe] img{filter:grayscale(1)!important;opacity:.55!important}html[data-polazu-wireframe] video{filter:grayscale(1)!important}';document.head.appendChild(wireframeStyle);
    overlayRoot = document.createElement("div"); overlayRoot.dataset.polazuOverlay = "true";
    overlayRoot.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483645;";
    hoverBox = document.createElement("div"); hoverBox.dataset.polazuOverlay = "true"; hoverBox.hidden = true;
    hoverBox.style.cssText = "position:fixed;pointer-events:none;border:1px solid #ff8a5b;box-sizing:border-box;z-index:2147483644;background:rgba(255,77,10,.035);";
    document.body.append(hoverBox, overlayRoot);
    new MutationObserver((records) => { if (internalMutation) return;if (records.some((record) => !(record.target instanceof Element && record.target.closest("[data-polazu-overlay]")))) scheduleReport(); }).observe(document.body, { subtree:true, childList:true, attributes:true, attributeFilter:["class","style","hidden","aria-hidden"] });
    replay(); report();
    addEventListener("scroll", () => { closeContextMenu(); drawSelection(); drawHover(hoverTarget); }, true);
    addEventListener("resize", () => { closeContextMenu(); replay(); scheduleReport(); });
    addEventListener("popstate", () => { replay(); scheduleReport(); });
    for (const method of ["pushState","replaceState"]) {
      const original = history[method].bind(history);
      history[method] = (...args) => { const result = original(...args); replay(); scheduleReport(); return result; };
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once:true }); else start();
})();

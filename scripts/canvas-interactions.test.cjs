const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const bridge = fs.readFileSync(path.join(__dirname, "../public/editor-bridge.js"), "utf8");
const parsed = ts.createSourceFile("editor-bridge.js", bridge, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const functions = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && node.name) functions.set(node.name.text, node.getText(parsed));
  ts.forEachChild(node, visit);
}
visit(parsed);
function load(names, dependencies, tail) {
  return new Function(...Object.keys(dependencies), names.map((name) => functions.get(name)).join("\n") + "\n" + tail)(...Object.values(dependencies));
}

class Element {
  constructor(tag = "div", id = tag) { this.tagName = tag.toUpperCase(); this.id = id; this.style = {}; this.children = []; this.childNodes = this.children; this.attributes = new Map(); this.isConnected = true; this.dataset = {}; this.rect = { left:0, top:0, right:100, bottom:100, width:100, height:100 }; }
  get parentElement() { return this.parentNode; }
  get previousElementSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) - 1]; }
  get nextElementSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1]; }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name); }
  contains(el) { return this === el || this.children.some((child) => child.contains(el)); }
  querySelectorAll() { return this.children.flatMap((child) => [child, ...child.querySelectorAll("*")]); }
  getBoundingClientRect() { return this.rect; }
  appendChild(el) { if (el.parentNode) el.parentNode.children.splice(el.parentNode.children.indexOf(el), 1); el.parentNode = this; this.children.push(el); return el; }
  insertBefore(el, other) { if (el.parentNode) el.parentNode.children.splice(el.parentNode.children.indexOf(el), 1); el.parentNode = this; this.children.splice(this.children.indexOf(other), 0, el); }
}

const element = new Element();
const messages = [];
const changes = [];
const common = {
  selector:(el) => el.id, sourceId:() => undefined, describe:(el) => ({ id:el.id }),
  applyStyle:(el, styles) => { Object.assign(el.style, styles); changes.push(styles); },
  drawSelection:() => {}, send:(type, data) => messages.push({ type, ...data }),
  getComputedStyle:(el) => ({ position:"static", left:"0px", top:"0px", ...el.style }),
};
const nudge = load(["nudgeSelected"], { ...common, selected:[element], locked:new Set() }, "return nudgeSelected;");
nudge(1, 0);
assert.equal(element.style.left, "1px", "a normal Arrow key must move exactly one pixel even with the 8px grid enabled");
nudge(0, 10);
assert.equal(element.style.top, "10px");

const parent = new Element("div", "parent");
parent.appendChild(element);
const ancestorNudge = load(["nudgeSelected"], { ...common, selected:[parent, element], locked:new Set() }, "return nudgeSelected;");
changes.length = 0;
ancestorNudge(1, 0);
assert.equal(changes.length, 1, "selected child must not move twice when its ancestor is also selected");

function manipulate(state, point) {
  const styles = [];
  load(["performManipulation"], {
    ...common, dragState:state, document:{ documentElement:{ setPointerCapture() {} } },
    snapValue:(value) => Math.round(value / 8) * 8,
    reorderTowardPointer:() => {},
    reparentTargetAtPoint:() => ({ target:null }), clearDropTarget:() => {},
    applyStyle:(el, value) => styles.push(value),
  }, "return performManipulation;")(point);
  return styles;
}
function state(handle) {
  return { el:element, handle, startX:0, startY:0, rect:{ width:120, height:80 }, ratio:1.5,
    startLeft:0, startTop:0, originalPosition:"static", extraWidth:20, extraHeight:16,
    items:[{ el:element, startLeft:0, startTop:0, originalPosition:"static" }], moved:false };
}
assert.equal(manipulate(state("move"), { clientX:2, clientY:2 }).length, 0, "click jitter must not become a saved drag");
const rightResize = manipulate(state("e"), { clientX:24, clientY:0 })[0];
assert.equal(rightResize.width, "124px", "content-box width must subtract padding and borders from visual width");
assert.equal(rightResize.height, undefined, "horizontal resize must preserve automatic height");
const topResize = manipulate(state("n"), { clientX:0, clientY:17 })[0];
assert.equal(topResize.height, "48px");
assert.equal(topResize.top, "16px", "snapped top resize must keep the opposite edge anchored");
const axisLockedMove = manipulate(state("move"), { clientX:24, clientY:8, shiftKey:true })[0];
assert.equal(axisLockedMove.left, "24px");
assert.equal(axisLockedMove.top, "0px", "Shift-drag must constrain movement to the dominant axis");

const ordered = new Element("main", "ordered");
const first = ordered.appendChild(new Element("p", "first"));
const second = ordered.appendChild(new Element("p", "second"));
const third = ordered.appendChild(new Element("p", "third"));
const orders = new Map();
const structure = load(["rememberOriginalOrder", "reorderOneStep", "restoreOriginals"], {
  HTMLElement:Element, Element, originalOrders:orders, originals:new Map(), document:{ querySelectorAll:() => [] },
  selector:(el) => el.id, reorderEdit:(el, direction, targetSelector) => ({ direction, selector:targetSelector }),
  ignored:() => false, beginInternalMutation:() => {},
}, "return { reorderOneStep, restoreOriginals };");
structure.reorderOneStep(first, "down");
assert.deepEqual(ordered.children.map((item) => item.id), ["second", "first", "third"]);
structure.reorderOneStep(first, "down");
assert.deepEqual(ordered.children.map((item) => item.id), ["second", "third", "first"]);
structure.restoreOriginals();
assert.deepEqual(ordered.children.map((item) => item.id), ["first", "second", "third"], "replay must return to original sibling order before replaying the history");
structure.reorderOneStep(first, "down");
assert.deepEqual(ordered.children.map((item) => item.id), ["second", "first", "third"], "replaying one prior move must undo the second move");

const sourceContainer = new Element("section", "source-container");
const targetContainer = new Element("main", "target-container");
const moving = sourceContainer.appendChild(new Element("button", "moving"));
const targetLeaf = targetContainer.appendChild(new Element("img", "target-leaf"));
moving.setAttribute("data-polazu-source", "/app/page.tsx:4:8");
targetContainer.setAttribute("data-polazu-source", "/app/page.tsx:8:6");
const reparentOrders = new Map();
const reparent = load(["sourceFile", "rememberOriginalOrder", "safeReparentContainer", "reparentSourceSupport", "reparentEdit", "restoreOriginals"], {
  HTMLElement:Element, Element, REPARENT_CONTAINER_TAGS:new Set(["BODY","MAIN","SECTION","ARTICLE","ASIDE","HEADER","FOOTER","NAV","DIV","FORM","FIELDSET","UL","OL","LI","FIGURE","BLOCKQUOTE","DETAILS","DIALOG"]),
  originalOrders:reparentOrders, originals:new Map(), ignored:() => false, locked:new Set(), selector:(el) => el.id,
  sourceId:(el) => el.getAttribute("data-polazu-source") || undefined, crypto:{ randomUUID:() => "move-id" }, currentPath:() => "/",
  reparentOrigins:new WeakMap(),
  document:{ querySelectorAll:() => [] },
}, "return { sourceFile, rememberOriginalOrder, safeReparentContainer, reparentSourceSupport, reparentEdit, restoreOriginals };");
assert.equal(reparent.safeReparentContainer(targetContainer, moving), true, "semantic containers must accept a moved element");
assert.equal(reparent.safeReparentContainer(targetLeaf, moving), false, "image/text leaves must never become drop containers");
assert.equal(reparent.safeReparentContainer(moving, sourceContainer), false, "a container cannot be moved inside its own descendant");
assert.equal(reparent.reparentSourceSupport(moving, targetContainer).supported, true);
targetContainer.setAttribute("data-polazu-source", "/app/other.tsx:8:6");
assert.equal(reparent.reparentSourceSupport(moving, targetContainer).supported, false, "cross-file JSX movement must be rejected before it mutates the preview");
targetContainer.setAttribute("data-polazu-source", "/app/page.tsx:8:6");
reparent.rememberOriginalOrder(sourceContainer); reparent.rememberOriginalOrder(targetContainer);
targetContainer.appendChild(moving);
assert.equal(moving.parentElement, targetContainer);
reparent.restoreOriginals();
assert.equal(moving.parentElement, sourceContainer, "history replay must restore a reparented node to its original container first");
const reparentOperation = reparent.reparentEdit({ el:moving, startSelector:"source-container > moving", startSourceId:"/app/page.tsx:4:8" }, targetContainer);
assert.deepEqual(reparentOperation.operation, { type:"reparent", sourceSelector:"source-container > moving", targetParentSelector:"target-container", targetParentSourceId:"/app/page.tsx:8:6", placement:"append" });
const hitTest = load(["reparentTargetAtPoint"], {
  HTMLElement:Element, document:{ documentElement:new Element("html", "html"), elementsFromPoint:() => [targetLeaf, targetContainer] },
  ignored:() => false, safeReparentContainer:(candidate) => candidate === targetContainer, reparentSourceSupport:() => ({ supported:true }),
}, "return reparentTargetAtPoint;");
assert.equal(hitTest({ el:moving, items:[{ el:moving }] }, 40, 40).target, targetContainer, "dropping over a leaf must resolve to its nearest semantic container");

const commandMessages = [];
const commandSelected = [];
const sourceForCommand = sourceContainer.appendChild(new Element("p", "command-source"));
const commandReparent = load(["reparentLayer"], {
  HTMLElement:Element, document:{ querySelector:(value) => value === "#source" ? sourceForCommand : value === "#target" ? targetContainer : null },
  locked:new Set(), selector:(el) => el.id, safeReparentContainer:() => true, reparentSourceSupport:() => ({ supported:true }),
  sourceId:() => undefined, rememberOriginalOrder:() => {}, reparentEdit:() => ({ operation:{ type:"reparent" } }),
  beginInternalMutation:() => {}, selected:commandSelected, drawSelection:() => {}, scheduleReport:() => {},
  send:(type, value) => commandMessages.push({ type, ...value }), describe:(el) => ({ id:el.id }), ancestors:() => [],
}, "return reparentLayer;");
commandReparent("#source", "#target");
assert.equal(sourceForCommand.parentElement, targetContainer, "layer-tree reparent must use the same DOM move as canvas drag");
assert.equal(commandMessages[0].type, "structure");
assert.deepEqual(commandSelected, [sourceForCommand]);

const container = load(["insertionContainer"], { HTMLElement:Element, ignored:() => false, document:{ body:ordered } }, "return insertionContainer;");
assert.equal(container(first), ordered, "Insert from a text selection must use a semantic container");
const image = second.appendChild(new Element("img", "image"));
assert.equal(container(image), ordered, "image/inline selections must not receive invalid child markup");

const selected = [first];
const selectedMessages = [];
const select = load(["selectElement"], {
  HTMLElement:Element, ignored:() => false, locked:new Set(), selected,
  selector:(el) => el.id, drawSelection:() => {}, describe:(el) => ({ id:el.id }), ancestors:() => [],
  closeContextMenu:() => {},
  send:(type, value) => selectedMessages.push(value),
}, "return selectElement;");
select(first, true);
assert.equal(selected.length, 0, "Shift-click must deselect an already selected element");
select(first); select(second, true);
assert.deepEqual(selected.map((item) => item.id), ["first", "second"]);

const marqueeRoot = new Element("main", "marquee-root");
const marqueeParent = marqueeRoot.appendChild(new Element("section", "marquee-parent"));
marqueeParent.rect = { left:10, top:10, right:180, bottom:180, width:170, height:170 };
const marqueeChild = marqueeParent.appendChild(new Element("button", "marquee-child"));
marqueeChild.rect = { left:30, top:30, right:90, bottom:70, width:60, height:40 };
const marqueeSibling = marqueeRoot.appendChild(new Element("p", "marquee-sibling"));
marqueeSibling.rect = { left:120, top:40, right:200, bottom:80, width:80, height:40 };
const marqueeOutside = marqueeRoot.appendChild(new Element("p", "marquee-outside"));
marqueeOutside.rect = { left:240, top:40, right:300, bottom:80, width:60, height:40 };
const marquee = load(["rectIntersects", "marqueeCandidates", "composeMarqueeSelection"], {
  HTMLElement:Element, document:{ documentElement:new Element("html", "html"), body:marqueeRoot },
  ignored:() => false, locked:new Set(), selector:(el) => el.id,
  getComputedStyle:(el) => ({ display:el.style.display || "block", visibility:el.style.visibility || "visible" }),
}, "return { rectIntersects, marqueeCandidates, composeMarqueeSelection };");
assert.equal(marquee.rectIntersects({ left:0, top:0, right:30, bottom:30 }, { left:30, top:0, right:60, bottom:30 }), false, "touching an edge is not a marquee intersection");
assert.deepEqual(
  marquee.marqueeCandidates(marqueeRoot, { left:20, top:20, right:150, bottom:100 }).map((item) => item.id),
  ["marquee-child", "marquee-sibling"],
  "marquee selection must include intersecting leaf layers without also selecting their ancestor"
);
assert.deepEqual(marquee.composeMarqueeSelection([marqueeChild], [marqueeChild, marqueeSibling], true), [marqueeSibling], "Shift-marquee must toggle hits relative to the starting selection");
assert.deepEqual(marquee.composeMarqueeSelection([marqueeOutside], [marqueeChild], false), [marqueeChild], "plain marquee replaces the prior selection");
for (const name of ["beginMarquee", "updateMarquee", "finishMarquee", "cancelMarquee"]) {
  assert.doesNotMatch(functions.get(name), /send\(["'](?:manipulation|structure)["']/, "marquee selection must never create an autosave edit");
}

const refreshMessages = [];
element.style.width = "57px";
const replay = load(["replay"], {
  ...common, HTMLElement:Element, textEdit:null, dragState:null, selected:[element], edits:[],
  beginInternalMutation:() => {}, restoreOriginals:() => { element.style.width = "56px"; },
  currentPath:() => "/", responsiveMatch:() => true, ignored:() => false, ancestors:() => [], scheduleReport:() => {},
  describe:(el) => ({ id:el.id, styles:{ ...el.style } }),
  send:(type, value) => refreshMessages.push({ type, ...value }),
}, "return replay;");
replay();
assert.equal(refreshMessages[0].type, "selection-refresh", "history replay must refresh inspector values without a new selection event");
assert.equal(refreshMessages[0].element.styles.width, "56px", "inspector must receive the restored width after undo");
assert.equal(refreshMessages[0].elements[0].styles.width, "56px");

function overlayNode(tag) {
  return {
    tag, dataset:{}, style:{ cssText:"" }, attributes:new Map(), children:[],
    setAttribute(name, value) { this.attributes.set(name, value); },
    addEventListener(name, listener) { this[`on${name}`] = listener; },
    appendChild(child) { this.children.push(child); return child; },
  };
}
const groupElements = [
  { getBoundingClientRect:() => ({ left:10, top:20, right:50, bottom:60, width:40, height:40 }) },
  { getBoundingClientRect:() => ({ left:70, top:5, right:120, bottom:80, width:50, height:75 }) },
];
const groupBox = load(["makeSelectionGroupBox"], {
  document:{ createElement:overlayNode }, beginManipulation:() => {},
}, "return makeSelectionGroupBox;")(groupElements);
assert.equal(groupBox.dataset.polazuSelectionGroup, "true");
assert.match(groupBox.style.cssText, /left:10px;top:5px;width:110px;height:75px/, "multi-selection box must cover every selected element");
assert.equal(groupBox.children[0].textContent, "2개 선택 · 110×75");
assert.equal(groupBox.children[0].attributes.get("aria-label"), "2개 선택, 드래그하여 함께 이동");

const contextActions = [];
const contextAction = load(["contextMenuAction"], {
  closeContextMenu:() => contextActions.push("close"), beginTextEdit:() => contextActions.push("edit"),
  copySelected:() => contextActions.push("copy"), pasteClipboard:() => contextActions.push("paste"), duplicateSelected:() => contextActions.push("duplicate"),
  reorderSelected:(value) => contextActions.push(`reorder-${value}`), navigateSelection:(value) => contextActions.push(`select-${value}`),
  toggleVisibility:() => contextActions.push("visibility"), toggleLock:() => contextActions.push("lock"), deleteSelected:() => contextActions.push("delete"), selector:() => "#target",
}, "return contextMenuAction;");
for (const action of ["edit-text","copy","paste","duplicate","reorder-up","reorder-down","select-parent","visibility","lock","delete"]) contextAction(action, element);
assert.deepEqual(contextActions.filter((item) => item !== "close"), ["edit","copy","paste","duplicate","reorder-up","reorder-down","select-parent","visibility","lock","delete"]);
assert.match(bridge, /document\.addEventListener\("contextmenu"/, "canvas needs a native right-click workflow");
assert.match(bridge, /closest\("\[data-polazu-overlay\]"\)/, "overlay controls must not be swallowed by preview click interception");

console.log("PASS: canvas reparent, marquee, group feedback, context menu, click threshold, pixel nudge, ancestor selection, axis lock, box sizing, resize anchoring, insertion container, multi-selection, reorder undo, and inspector history refresh behavior");

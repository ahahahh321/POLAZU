const strictAssert = require("node:assert/strict");
let checkCount = 0;
const assert = new Proxy(strictAssert, {
  apply(target, thisArg, args) { checkCount += 1; return Reflect.apply(target, thisArg, args); },
  get(target, property, receiver) {
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? (...args) => { checkCount += 1; return Reflect.apply(value, target, args); } : value;
  },
});
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const ts = require("typescript");
const postcss = require("postcss");

const root = path.resolve(__dirname, "..");
function loadTs(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const output = ts.transpileModule(source, { compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports:{} };
  new Function("module", "exports", "require", output)(mod, mod.exports, require);
  return mod.exports;
}
function location(source, needle) {
  const offset = source.indexOf(needle);
  assert(offset >= 0, `missing needle: ${needle}`);
  const before = source.slice(0, offset);
  return { line:before.split("\n").length, column:offset - before.lastIndexOf("\n") - 1 };
}
function ref(file, source, needle) {
  const loc = location(source, needle);
  return `${file}:${loc.line}:${loc.column}`;
}

const patcher = loadTs("app/editor/_lib/source-patcher.ts");
assert.deepEqual(patcher.parseSourceRef("/app/page.tsx:4:12"), {path:"/app/page.tsx",line:4,column:12});
assert.equal(patcher.parseSourceRef("app/page.tsx:4:12"), null);

const metadataLib = loadTs("app/editor/_lib/designer-metadata.ts");
const parsedMetadata = metadataLib.parseDesignerMetadata(JSON.stringify({
  zoom:92,
  layerAliases:{"body > main":"Page content","":"ignored",bad:""},
  lockedSelectors:["body > main","body > main",42],
}));
assert.equal(parsedMetadata.zoom,92);
assert.deepEqual(parsedMetadata.layerAliases,{"body > main":"Page content"});
assert.deepEqual(parsedMetadata.lockedSelectors,["body > main"]);

const file = "/app/page.tsx";
const original = `export default function Page() {\n  return (\n    <main className="page">\n      <button className="cta">Save</button>\n    </main>\n  );\n}\n`;
const buttonRef = ref(file, original, "<button");
const mainRef = ref(file, original, "<main");
let result = patcher.applyDesignerEdits({
  [file]:original,
  "/app/globals.css":"body { margin: 0; }\n",
}, [{
  id:"style", path:"/", selector:"body > main:nth-of-type(1) > button:nth-of-type(1)", sourceId:buttonRef,
  text:"Publish", styles:{backgroundColor:"#111827",borderRadius:"8px"}, attributes:{title:"Publish changes", "aria-label":"Publish"}, responsive:"base",
}], () => null);
assert.equal(result.changes.length, 1);
assert.match(result.files[file], /Publish<\/button>/);
assert.match(result.files[file], /backgroundColor: "#111827"/);
assert.match(result.files[file], /borderRadius: "8px"/);
assert.match(result.files[file], /title="Publish changes"/);
assert.match(result.files[file], /aria-label="Publish"/);

result = patcher.applyDesignerEdits({[file]:original,"/app/globals.css":"body{}\n"}, [{
  id:"responsive", path:"/", selector:"body > main:nth-of-type(1) > button:nth-of-type(1)", sourceId:buttonRef,
  styles:{fontSize:"14px",display:"none"}, responsive:"mobile",
}], () => null);
assert.match(result.files[file], /className="cta polazu-r-[a-z0-9]+"/);
assert.match(result.files["/app/globals.css"], /POLAZU_RESPONSIVE_START/);
assert.match(result.files["/app/globals.css"], /@media \(max-width: 639px\)/);
assert.match(result.files["/app/globals.css"], /font-size: 14px/);
assert.match(result.files["/app/globals.css"], /display: none/);

const firstResponsiveFiles = result.files;
const refreshedButtonRef = ref(file, firstResponsiveFiles[file], "<button");
result = patcher.applyDesignerEdits(firstResponsiveFiles, [{
  id:"responsive-tablet-later", path:"/", selector:"body > main:nth-of-type(1) > button:nth-of-type(1)", sourceId:refreshedButtonRef,
  styles:{fontSize:"16px"}, responsive:"tablet",
}], () => null);
assert.match(result.files["/app/globals.css"], /@media \(max-width: 639px\)[\s\S]*font-size: 14px/);
assert.match(result.files["/app/globals.css"], /@media \(min-width: 640px\) and \(max-width: 1023px\)[\s\S]*font-size: 16px/);
assert.equal((result.files[file].match(/polazu-r-[a-z0-9]+/g) || []).length, 1);

const secondResponsiveFiles = result.files;
const latestButtonRef = ref(file, secondResponsiveFiles[file], "<button");
result = patcher.applyDesignerEdits(secondResponsiveFiles, [{
  id:"responsive-mobile-update", path:"/", selector:"body > main:nth-of-type(1) > button:nth-of-type(1)", sourceId:latestButtonRef,
  styles:{fontSize:"13px",color:"#334155"}, responsive:"mobile",
}], () => null);
const mergedResponsiveCss = result.files["/app/globals.css"];
assert.match(mergedResponsiveCss, /@media \(max-width: 639px\)[\s\S]*font-size: 13px/);
assert.match(mergedResponsiveCss, /@media \(max-width: 639px\)[\s\S]*display: none/);
assert.match(mergedResponsiveCss, /@media \(max-width: 639px\)[\s\S]*color: #334155/);
assert.match(mergedResponsiveCss, /@media \(min-width: 640px\) and \(max-width: 1023px\)[\s\S]*font-size: 16px/);
assert.equal((mergedResponsiveCss.match(/font-size: 13px/g) || []).length, 1);

const noClass = `export default function Page(){return <section><span>Plain</span></section>}`;
const spanRef = ref(file, noClass, "<span");
result = patcher.applyDesignerEdits({[file]:noClass,"/app/globals.css":""}, [{
  id:"responsive-no-class",path:"/",selector:"section > span",sourceId:spanRef,styles:{fontSize:"12px"},responsive:"mobile",
}], () => null);
assert.match(result.files[file], /<span className="polazu-r-[a-z0-9]+">Plain<\/span>/);

const dynamicClass = `export default function Page({active}){return <main><button className={active ? "on" : "off"}>Toggle</button></main>}`;
const dynamicRef = ref(file, dynamicClass, "<button");
result = patcher.applyDesignerEdits({[file]:dynamicClass,"/app/globals.css":""}, [{
  id:"responsive-dynamic",path:"/",selector:"main > button",sourceId:dynamicRef,styles:{display:"none"},responsive:"mobile",
}], () => null);
assert(result.warnings.some((warning) => warning.includes("동적 className")));
assert.match(result.files["/app/globals.css"], /main > button/);

result = patcher.applyDesignerEdits({[file]:original,"/app/globals.css":""}, [{
  id:"insert", path:"/", selector:"body > main:nth-of-type(1)", sourceId:mainRef,
  operation:{type:"insert",kind:"text",parentSelector:"body > main:nth-of-type(1)",parentSourceId:mainRef,html:"<p>New</p>",jsx:"<p>New</p>"},
}], () => null);
assert.match(result.files[file], /<p>New<\/p>/);

result = patcher.applyDesignerEdits({[file]:original,"/app/globals.css":""}, [{
  id:"generated-1",path:"/",selector:"body > main:nth-of-type(1)",sourceId:mainRef,
  operation:{type:"insert",kind:"text",parentSelector:"body > main:nth-of-type(1)",parentSourceId:mainRef,html:"<p>New</p>",jsx:"<p>New</p>"},
},{
  id:"generated-style",path:"/",selector:"body > main:nth-of-type(1) > p:nth-of-type(1)",generatedId:"generated-1",
  text:"Styled",styles:{color:"#ff5500",fontSize:"18px"},attributes:{title:"Inserted text"},responsive:"base",
}], () => null);
assert.match(result.files[file], /<p[^>]+title="Inserted text"[^>]+style=\{\{[^}]*color: "#ff5500"[^}]*fontSize: "18px"[^}]*\}\}>Styled<\/p>/);
assert(!result.warnings.some((warning) => warning.includes("새로 삽입한 요소")));

result = patcher.applyDesignerEdits({[file]:original,"/app/globals.css":""}, [{
  id:"generated-r",path:"/",selector:"body > main:nth-of-type(1)",sourceId:mainRef,
  operation:{type:"insert",kind:"text",parentSelector:"body > main:nth-of-type(1)",parentSourceId:mainRef,html:"<p>Responsive</p>",jsx:"<p>Responsive</p>"},
},{
  id:"generated-mobile",path:"/",selector:"body > main:nth-of-type(1) > p:nth-of-type(1)",generatedId:"generated-r",styles:{display:"none"},responsive:"mobile",
}], () => null);
assert.match(result.files[file], /<p className="polazu-g-[a-z0-9]+">Responsive<\/p>/);
assert.match(result.files["/app/globals.css"], /\.polazu-g-[a-z0-9]+ \{[\s\S]*display: none/);

result = patcher.applyDesignerEdits({[file]:original,"/app/globals.css":""}, [{
  id:"generated-copy",path:"/",selector:"body > main:nth-of-type(1)",sourceId:mainRef,
  operation:{type:"insert",kind:"text",parentSelector:"body > main:nth-of-type(1)",parentSourceId:mainRef,html:"<p>Copy me</p>",jsx:"<p>Copy me</p>"},
},{id:"generated-copy-2",path:"/",selector:"p",generatedId:"generated-copy",operation:{type:"duplicate"}},
], () => null);
assert.equal((result.files[file].match(/<p>Copy me<\/p>/g) || []).length, 2);

result = patcher.applyDesignerEdits({[file]:original,"/app/globals.css":""}, [{
  id:"generated-cancel",path:"/",selector:"body > main:nth-of-type(1)",sourceId:mainRef,
  operation:{type:"insert",kind:"text",parentSelector:"body > main:nth-of-type(1)",parentSourceId:mainRef,html:"<p>Cancel</p>",jsx:"<p>Cancel</p>"},
},{id:"cancel-delete",path:"/",selector:"p",generatedId:"generated-cancel",operation:{type:"delete"}},
], () => null);
assert(!result.files[file].includes("Cancel"));

result = patcher.applyDesignerEdits({[file]:original,"/app/globals.css":""}, [{
  id:"insert-before-responsive",path:"/",selector:"body > main:nth-of-type(1)",sourceId:mainRef,
  operation:{type:"insert",kind:"text",parentSelector:"body > main:nth-of-type(1)",parentSourceId:mainRef,html:"<p>Before</p>",jsx:"<p>Before</p>"},
},{id:"responsive-after-insert",path:"/",selector:"button",sourceId:buttonRef,styles:{display:"none"},responsive:"mobile"},
], () => null);
assert.match(result.files[file], /<button className="cta polazu-r-[a-z0-9]+">Save<\/button>/);
assert.match(result.files[file], /<p>Before<\/p>/);

result = patcher.applyDesignerEdits({[file]:original,"/app/globals.css":""}, [{id:"duplicate",path:"/",selector:"button",sourceId:buttonRef,operation:{type:"duplicate",sourceId:buttonRef}}], () => null);
assert.equal((result.files[file].match(/<button/g)||[]).length, 2);
result = patcher.applyDesignerEdits({[file]:original,"/app/globals.css":""}, [{id:"delete",path:"/",selector:"button",sourceId:buttonRef,operation:{type:"delete",sourceId:buttonRef}}], () => null);
assert.equal((result.files[file].match(/<button/g)||[]).length, 0);

const reparentSource = `export default function Page() {\n  return (\n    <main>\n      <section className="source">\n        <button>Move me</button>\n      </section>\n      <section className="target">\n        <p>Stay here</p>\n      </section>\n    </main>\n  );\n}\n`;
const movableRef = ref(file, reparentSource, "<button");
const targetRef = ref(file, reparentSource, '<section className="target"');
result = patcher.applyDesignerEdits({[file]:reparentSource}, [{
  id:"reparent",path:"/",selector:"main > section.source > button",sourceId:movableRef,
  operation:{type:"reparent",targetParentSelector:"main > section.target",targetParentSourceId:targetRef,placement:"append"},
}], () => null);
assert.equal(result.warnings.length, 0);
assert.match(result.files[file], /<section className="source">\s*<\/section>/);
assert.match(result.files[file], /<section className="target">[\s\S]*<p>Stay here<\/p>[\s\S]*<button>Move me<\/button>[\s\S]*<\/section>/);

const conditionalMove = `export default function Page({enabled}) {\n  return <main>\n    <section>\n      {enabled && <button>Unsafe move</button>}\n    </section>\n    <div></div>\n  </main>;\n}\n`;
result = patcher.applyDesignerEdits({[file]:conditionalMove}, [{
  id:"unsafe-reparent",path:"/",selector:"button",sourceId:ref(file,conditionalMove,"<button"),
  operation:{type:"reparent",targetParentSelector:"main > div",targetParentSourceId:ref(file,conditionalMove,"<div"),placement:"append"},
}], () => null);
assert.equal(result.files[file], conditionalMove);
assert(result.warnings.some((warning) => warning.includes("조건식이나 인라인 표현식")));

const generatedMoveSource = `export default function Page() {\n  return (\n    <main>\n      <section className="target"></section>\n    </main>\n  );\n}\n`;
const generatedMainRef = ref(file, generatedMoveSource, "<main");
const generatedTargetRef = ref(file, generatedMoveSource, "<section");
result = patcher.applyDesignerEdits({[file]:generatedMoveSource}, [{
  id:"generated-move",path:"/",selector:"main",sourceId:generatedMainRef,
  operation:{type:"insert",kind:"text",parentSelector:"main",parentSourceId:generatedMainRef,html:"<p>Generated</p>",jsx:"<p>Generated</p>"},
},{
  id:"move-generated",path:"/",selector:"main > p",generatedId:"generated-move",
  operation:{type:"reparent",targetParentSelector:"main > section",targetParentSourceId:generatedTargetRef,placement:"append"},
}], () => null);
assert.equal((result.files[file].match(/<p>Generated<\/p>/g) || []).length, 1);
assert.match(result.files[file], /<section className="target">[\s\S]*<p>Generated<\/p>[\s\S]*<\/section>/);

const tokenLib = loadTs("app/editor/_lib/design-tokens.ts");
const tokenFiles = {"/app/globals.css":`:root {
  --color-primary: #ff5500;
  --space-4: 1rem;
  --radius-card: 16px;
}
.dark { --color-primary: #ff7733; }
`};
const tokens = tokenLib.scanDesignTokens(tokenFiles);
assert.equal(tokens.length, 4);
assert.equal(tokens[0].category, "color");
assert.equal(tokens[1].category, "spacing");
assert.equal(tokens[2].category, "radius");
const updatedToken = tokenLib.updateDesignToken(tokenFiles, tokens[3], "#ffaa66");
assert(updatedToken.change);
assert.match(updatedToken.change.content, /\.dark \{ --color-primary: #ffaa66; \}/);
assert.equal(tokenLib.updateDesignToken(tokenFiles, tokens[0], "url(javascript:bad)").change, undefined);

const assetLib = loadTs("app/editor/_lib/assets.ts");
const assets = assetLib.scanProjectAssets({"/public/logo.svg":"<svg/>","/src/private.svg":"<svg/>"},{"/public/photo.webp":"YWJj"});
assert.deepEqual(assets.map((asset) => asset.url), ["/logo.svg","/photo.webp"]);
const firstAsset = assetLib.assetUploadTarget("", "Hero Photo.webp", true, ["/public/polazu-assets/Hero-Photo.webp"]);
assert.equal(firstAsset.path, "/public/polazu-assets/Hero-Photo-2.webp");
assert.equal(firstAsset.url, "/polazu-assets/Hero-Photo-2.webp");
const safeAssetName = assetLib.sanitizeAssetName("../../bad photo.png");
assert(!safeAssetName.includes("/"));
assert(!safeAssetName.startsWith("."));
assert.match(assetLib.sanitizeAssetName("대표 사진.jpg"), /^asset-\d+\.jpg$/);

const next = loadTs("app/editor/_lib/next-ui.ts");
const project = {files:{"/package.json":JSON.stringify({dependencies:{next:"16",react:"19"}}),"/app/layout.tsx":"export default function L({children}){return <html><body>{children}</body></html>}","/app/page.tsx":"export default function P(){return <main><button>Hi</button></main>}"},source:{},skippedFileCount:0};
const adapted = next.prepareNextUI(project, "");
const config = adapted.files["/.polazu-ui/vite.config.mjs"];
assert.match(config, /data-polazu-source/);
assert.match(config, /polazuSourcePlugin/);
const temp = path.join(os.tmpdir(), `polazu-vite-${process.pid}.mjs`);
fs.writeFileSync(temp, config);
const checked = spawnSync(process.execPath, ["--check", temp], {encoding:"utf8"});
fs.rmSync(temp, {force:true});
assert.equal(checked.status, 0, checked.stderr);

const bridge = fs.readFileSync(path.join(root,"public/editor-bridge.js"),"utf8");
for (const feature of ["beginManipulation","lastChanges","layoutDragInfo","reorderTowardPointer","reorderEdits","reparentTargetAtPoint","reparentSourceSupport","reparentLayer","polazuDropTarget","alignSelection","distributeSelection","insertPrimitive","toggleVisibility","toggleLock","sendLayerMetadata","loadLayerMetadata","layer-metadata","copySelected","pasteClipboard","saveOriginalAttribute","audit-result","data-polazu-source","contrastRatio","broken-asset","meta-description","heading-order","schema-markup","navbar","textarea","skeleton","v-stack","rich-text","dropdown","slider","insert-at-point","link:{ html"]) assert(bridge.includes(feature), `bridge feature missing: ${feature}`);
assert.match(bridge, /if \(dragState\.layout\) \{\s*reorderTowardPointer/, "layout children must reorder instead of receiving left/top offsets");
assert.match(bridge, /const edit = reorderEdit\(el, direction, selector\(el\)\);[\s\S]*insertBefore/, "reorder edits must preserve the selector from before each DOM swap");
new Function(bridge);
const primitiveJsx = [
  ...[...bridge.matchAll(/jsx:'([^']+)'/g)].map((match) => match[1]),
  ...[...bridge.matchAll(/jsx:`([^`]+)`/g)].map((match) => match[1].replace(/\$\{imagePlaceholder\}/g, "/placeholder.svg")),
];
assert(primitiveJsx.length >= 20, `expected component primitives, got ${primitiveJsx.length}`);
for (const [index, snippet] of primitiveJsx.entries()) {
  const parsed = ts.createSourceFile(`primitive-${index}.tsx`, `const Primitive = () => (${snippet});`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(parsed.parseDiagnostics.length, 0, `invalid primitive JSX ${index}: ${parsed.parseDiagnostics.map((item) => item.messageText).join(", ")}`);
}

const toolbar = fs.readFileSync(path.join(root,"app/editor/_components/designer/DesignerToolbar.tsx"),"utf8");
const runtime = fs.readFileSync(path.join(root,"app/editor/_components/BrowserProjectRuntime.tsx"),"utf8");
const sidebar = fs.readFileSync(path.join(root,"app/editor/_components/designer/DesignerSidebar.tsx"),"utf8");
assert(toolbar.includes("props.presence"), "topbar must render server presence rather than hard-coded avatars");
assert(runtime.includes("presence={project.presence}"), "runtime must pass workspace presence to topbar");
assert(runtime.includes("}, 1400)"), "designer autosave debounce must remain explicit");
assert(sidebar.includes('draggable={!props.readOnly}'), "insert primitives must remain draggable");
assert(sidebar.includes('application/x-polazu-insert'), "insert drag payload is missing");
assert(sidebar.includes('application/x-polazu-layer'), "layer drag payload is missing");
assert(sidebar.includes('props.command("reparent-layer"'), "layer tree drops must use the safe reparent command");

const css = fs.readFileSync(path.join(root,"app/editor/page.css"),"utf8");
postcss.parse(css);
for (const selector of [".designer-topbar",".designer-tool-rail",".designer-layer-row",".designer-inspector-section",".designer-command-dialog",".designer-responsive-compare",".designer-token-row",".designer-canvas-control-dock",".designer-drop-surface",".designer-product-area"]) assert(css.includes(selector), `CSS selector missing: ${selector}`);

console.log(`PASS: ${checkCount} designer source patching, generated-element, responsive, tokens, component primitives, source mapping, bridge and CSS checks`);

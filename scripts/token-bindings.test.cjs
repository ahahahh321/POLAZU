const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");

function loadTs(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", output)(mod, mod.exports, require);
  return mod.exports;
}

function sourceRef(file, source, needle) {
  const offset = source.indexOf(needle);
  assert(offset >= 0, `missing source marker: ${needle}`);
  const before = source.slice(0, offset);
  const line = before.split("\n").length;
  const column = offset - before.lastIndexOf("\n") - 1;
  return `${file}:${line}:${column}`;
}

const bindings = loadTs("app/editor/_lib/token-bindings.ts");
const tokens = [
  { id: "a", path: "/app/globals.css", name: "--color-brand", value: "#ff5500", line: 2, occurrence: 0, category: "color" },
  { id: "b", path: "/app/globals.css", name: "--font-size-body", value: "16px", line: 3, occurrence: 0, category: "typography" },
  { id: "c", path: "/app/globals.css", name: "--space-4", value: "1rem", line: 4, occurrence: 0, category: "spacing" },
  { id: "d", path: "/theme/dark.css", name: "--color-brand", value: "#ff7733", line: 2, occurrence: 0, category: "color" },
  { id: "e", path: "/app/globals.css", name: "--radius-card", value: "12px", line: 5, occurrence: 0, category: "radius" },
];

assert.deepEqual(bindings.getBindableDesignTokens(tokens, "color").map((token) => token.name), ["--color-brand"]);
assert.deepEqual(bindings.getBindableDesignTokens(tokens, "backgroundColor").map((token) => token.name), ["--color-brand"]);
assert.deepEqual(bindings.getBindableDesignTokens(tokens, "fontSize").map((token) => token.name), ["--font-size-body"]);
assert.deepEqual(bindings.getBindableDesignTokens(tokens, "gap").map((token) => token.name), ["--space-4"]);
assert.deepEqual(bindings.getBindableDesignTokens(tokens, "padding", "1rem").map((token) => token.name), ["--space-4"]);
assert.equal(bindings.getBindableDesignTokens(tokens, "padding", "radius").length, 0);
assert.equal(bindings.createTokenReference("--space-4"), "var(--space-4)");
assert.equal(bindings.createTokenReference("space-4"), null);
assert.equal(bindings.getTokenNameFromReference(" var( --color-brand ) "), "--color-brand");
assert.equal(bindings.getTokenNameFromReference("#ff5500"), null);

// Existing style edits must preserve var() references all the way into source.
const patcher = loadTs("app/editor/_lib/source-patcher.ts");
const file = "/app/page.tsx";
const original = "export default function Page() {\n  return <main><button>Save</button></main>;\n}\n";
const result = patcher.applyDesignerEdits({ [file]: original, "/app/globals.css": "" }, [{
  id: "token-style",
  path: "/",
  selector: "main > button",
  sourceId: sourceRef(file, original, "<button"),
  styles: { color: "var(--color-brand)", fontSize: "var(--font-size-body)", gap: "var(--space-4)", padding: "var(--space-4)" },
  responsive: "base",
}], () => null);
assert.match(result.files[file], /color: "var\(--color-brand\)"/);
assert.match(result.files[file], /fontSize: "var\(--font-size-body\)"/);
assert.match(result.files[file], /gap: "var\(--space-4\)"/);
assert.match(result.files[file], /padding: "var\(--space-4\)"/);

const inspector = fs.readFileSync(path.join(root, "app/editor/_components/designer/DesignerInspector.tsx"), "utf8");
for (const property of ["color", "backgroundColor", "fontSize", "gap", "padding"]) {
  assert(inspector.includes(`property="${property}"`), `missing token binding for ${property}`);
}
const runtime = fs.readFileSync(path.join(root, "app/editor/_components/BrowserProjectRuntime.tsx"), "utf8");
assert(runtime.includes("tokens={designTokens}"), "runtime must pass scanned CSS tokens to the inspector");

console.log("token binding tests passed");

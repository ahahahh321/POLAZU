const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const loaded = new Map();
function loadTs(filename) {
  const absolute = path.resolve(root, filename);
  if (loaded.has(absolute)) return loaded.get(absolute).exports;
  const source = fs.readFileSync(absolute, "utf8");
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  loaded.set(absolute, mod);
  const localRequire = (name) => name.startsWith(".") ? loadTs(path.resolve(path.dirname(absolute), `${name}.ts`)) : require(name);
  new Function("module", "exports", "require", output)(mod, mod.exports, localRequire);
  return mod.exports;
}

function sourceRef(filename, source, needle) {
  const offset = source.indexOf(needle);
  assert(offset >= 0, `missing source marker ${needle}`);
  return `${filename}:${source.slice(0, offset).split("\n").length}:${offset - source.lastIndexOf("\n", offset - 1) - 1}`;
}

function applyChanges(files, changes) {
  const next = { ...files };
  for (const change of changes) {
    if (change.delete) delete next[change.path];
    else if (typeof change.content === "string") next[change.path] = change.content;
  }
  return next;
}

const { buildDesignSession } = loadTs("app/editor/_lib/design-session.ts");
const file = "/app/page.tsx";
const css = "/app/globals.css";
const source = "export default function Page() {\n  return <main>\n    <button>Save</button>\n  </main>;\n}\n";
const baseline = Object.freeze({ [file]: source, [css]: "body { margin: 0; }\n", "/readme.md": "Original notes" });
const buttonRef = sourceRef(file, source, "<button");
const mainRef = sourceRef(file, source, "<main");
const edit = (id, styles, extra = {}) => ({ id, path: "/", selector: "main > button", sourceId: buttonRef, responsive: "base", styles, ...extra });
const noHtml = () => null;

// The UI must undo an already auto-saved move, not only unsaved previews.
const move = edit("move", { position: "relative", left: "40px", top: "24px" });
const moved = buildDesignSession(baseline, baseline, [move], new Set(), noHtml);
assert.equal(moved.warnings.length, 0);
assert.match(moved.files[file], /left: "40px"/);
assert.deepEqual([...moved.paths], [file]);
const savedMove = applyChanges(baseline, moved.changes);
const undoMove = buildDesignSession(baseline, savedMove, [], moved.paths, noHtml);
assert.deepEqual(undoMove.changes, [{ path: file, content: source }]);
const restored = applyChanges(savedMove, undoMove.changes);
assert.equal(restored[file], source);
const redoMove = buildDesignSession(baseline, restored, [move], undoMove.paths, noHtml);
assert.deepEqual(applyChanges(restored, redoMove.changes), savedMove);

// A completed save is idempotent; a newer edit made during that save still emits a delta.
const savedAgain = buildDesignSession(baseline, savedMove, [move], moved.paths, noHtml);
assert.deepEqual(savedAgain.changes, []);
const color = edit("color", { color: "#ff5500" });
const newer = buildDesignSession(baseline, savedMove, [move, color], moved.paths, noHtml);
assert.equal(newer.changes.length, 1);
assert.match(newer.files[file], /left: "40px"/);
assert.match(newer.files[file], /color: "#ff5500"/);
const savedNewer = applyChanges(savedMove, newer.changes);
const undoLatest = buildDesignSession(baseline, savedNewer, [move], newer.paths, noHtml);
assert.equal(applyChanges(savedNewer, undoLatest.changes)[file], savedMove[file]);

// Undo must restore both JSX and responsive CSS, and redo must recreate both once.
const responsive = edit("mobile", { fontSize: "14px" }, { responsive: "mobile" });
const mobile = buildDesignSession(baseline, baseline, [responsive], new Set(), noHtml);
assert.equal(mobile.warnings.length, 0);
assert.deepEqual(new Set(mobile.changes.map((change) => change.path)), new Set([file, css]));
assert.match(mobile.files[css], /font-size: 14px/);
const savedMobile = applyChanges(baseline, mobile.changes);
const undoMobile = buildDesignSession(baseline, savedMobile, [], mobile.paths, noHtml);
assert.deepEqual(applyChanges(savedMobile, undoMobile.changes), baseline);
const redoMobile = buildDesignSession(baseline, baseline, [responsive], undoMobile.paths, noHtml);
assert.deepEqual(applyChanges(baseline, redoMobile.changes), savedMobile);

// Structural insertion is replayed from the session baseline, never appended again on save.
const insert = { id: "insert", path: "/", selector: "main", sourceId: mainRef, operation: { type: "insert", kind: "text", parentSelector: "main", parentSourceId: mainRef, html: "<p>New block</p>", jsx: "<p>New block</p>" } };
const inserted = buildDesignSession(baseline, baseline, [insert], new Set(), noHtml);
const savedInsert = applyChanges(baseline, inserted.changes);
const insertedAgain = buildDesignSession(baseline, savedInsert, [insert], inserted.paths, noHtml);
assert.deepEqual(insertedAgain.changes, []);
assert.equal((insertedAgain.files[file].match(/New block/g) || []).length, 1);
const undoInsert = buildDesignSession(baseline, savedInsert, [], inserted.paths, noHtml);
assert.equal(applyChanges(savedInsert, undoInsert.changes)[file], source);

// Moving an existing node between source-backed containers must survive save, undo and redo.
const reparentSource = "export default function Page() {\n  return (\n    <main>\n      <section>\n        <button>Move</button>\n      </section>\n      <aside>\n        <p>Target</p>\n      </aside>\n    </main>\n  );\n}\n";
const reparentBaseline = { [file]:reparentSource, [css]:baseline[css] };
const reparentEdit = {
  id:"reparent",path:"/",selector:"main > section > button",sourceId:sourceRef(file,reparentSource,"<button"),
  operation:{type:"reparent",targetParentSelector:"main > aside",targetParentSourceId:sourceRef(file,reparentSource,"<aside"),placement:"append"},
};
const reparented = buildDesignSession(reparentBaseline, reparentBaseline, [reparentEdit], new Set(), noHtml);
assert.equal(reparented.warnings.length, 0);
assert.match(reparented.files[file], /<aside>[\s\S]*<p>Target<\/p>[\s\S]*<button>Move<\/button>[\s\S]*<\/aside>/);
const savedReparent = applyChanges(reparentBaseline, reparented.changes);
const undoReparent = buildDesignSession(reparentBaseline, savedReparent, [], reparented.paths, noHtml);
assert.equal(applyChanges(savedReparent, undoReparent.changes)[file], reparentSource);
const redoReparent = buildDesignSession(reparentBaseline, reparentBaseline, [reparentEdit], undoReparent.paths, noHtml);
assert.equal(applyChanges(reparentBaseline, redoReparent.changes)[file], savedReparent[file]);

// Unrelated files changed outside this design history must never be part of its undo patch.
const withOtherWork = { ...savedMove, "/readme.md": "Updated by another editor", "/new-file.txt": "Keep me" };
const isolatedUndo = buildDesignSession(baseline, withOtherWork, [], moved.paths, noHtml);
const undoWithOtherWork = applyChanges(withOtherWork, isolatedUndo.changes);
assert.equal(undoWithOtherWork["/readme.md"], "Updated by another editor");
assert.equal(undoWithOtherWork["/new-file.txt"], "Keep me");

// A file owned by this session but absent from the baseline is removed on undo.
const temporary = "/design-generated.css";
const undoCreatedFile = buildDesignSession(baseline, { ...baseline, [temporary]: "temporary" }, [], new Set([temporary]), noHtml);
assert.deepEqual(undoCreatedFile.changes, [{ path: temporary, delete: true }]);

// Unmapped source must report an explicit warning and leave the source untouched.
const unsupported = buildDesignSession(baseline, baseline, [{ id: "missing", path: "/", selector: "#missing", styles: { color: "red" } }], new Set(), noHtml);
assert.equal(unsupported.changes.length, 0);
assert(unsupported.warnings.length > 0);
assert.equal(baseline[file], source);
console.log("PASS: design-session save, undo/redo, responsive, structure, recovery isolation and unsupported-source checks");

const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const roots = ["app", "components", "lib"];
const files = [];
for (const root of roots) walk(path.resolve(root));

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(absolute);
  }
}

let errors = 0;
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  for (const diagnostic of source.parseDiagnostics) {
    errors += 1;
    const position = diagnostic.start == null ? null : source.getLineAndCharacterOfPosition(diagnostic.start);
    const where = position ? `${position.line + 1}:${position.character + 1}` : "";
    console.error(`${path.relative(process.cwd(), file)}${where ? `:${where}` : ""} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`);
  }
}

if (errors > 0) {
  console.error(`FAIL: ${errors} TypeScript/TSX syntax error(s) in ${files.length} files`);
  process.exit(1);
}
console.log(`PASS: parsed ${files.length} TypeScript/TSX files with no syntax errors`);

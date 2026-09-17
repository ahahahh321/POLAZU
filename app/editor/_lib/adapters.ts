import type { FileSystemTree } from "@webcontainer/api";
import type { Project } from "./types";

export type Plan = { name: string; root: string; command: string; args: string[]; install: boolean; routes: string[]; notes: string[] };
type Manifest = { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; scripts?: Record<string, string>; packageManager?: string; workspaces?: unknown };

export function detectRoots(files: Record<string, string>) {
  const packages = Object.keys(files).filter(p => p.endsWith("/package.json")).map(p => p.slice(0, -13));
  const html = Object.keys(files).filter(p => p.endsWith("/index.html")).map(p => p.slice(0, -11));
  return [...new Set([...packages, ...html])].sort((a,b) => a.length-b.length);
}
export function planProject(files: Record<string, string>, root: string): Plan {
  const manifestPath = root + "/package.json";
  let pkg: Manifest = {};
  if (files[manifestPath]) {
    try { pkg = JSON.parse(files[manifestPath].replace(/^\uFEFF/, "")); } catch { throw new Error("package.json JSON 형식이 올바르지 않습니다."); }
  }
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const notes: string[] = [];
  if (pkg.packageManager && !pkg.packageManager.startsWith("npm@")) notes.push(pkg.packageManager + " 프로젝트를 npm 호환 모드로 실행합니다. 전용 플러그인/워크스페이스는 지원되지 않을 수 있습니다.");
  const base: Plan = { name: "Node", root, command: "node", args: [], install: !!files[manifestPath], routes: discoverRoutes(files, root), notes };
  const bin = (name: string, args: string[]) => ({ ...base, name, command: "./node_modules/.bin/" + name, args });
  if (deps.next) {
    const major = Number(deps.next.match(/\d+/)?.[0] || 16);
    return { ...bin("next", ["dev", ...(major >= 16 ? ["--webpack"] : []), "--hostname", "0.0.0.0", "--port", "4173"]), name: "Next.js · Webpack" };
  }
  if (deps.nuxt) return { ...bin("nuxt", ["dev", "--host", "0.0.0.0", "--port", "4173"]), name: "Nuxt" };
  if (deps["@angular/cli"]) return { ...bin("ng", ["serve", "--host", "0.0.0.0", "--port", "4173"]), name: "Angular" };
  if (deps.astro) return { ...bin("astro", ["dev", "--host", "0.0.0.0", "--port", "4173"]), name: "Astro" };
  if (deps.vite) return { ...bin("vite", ["--host", "0.0.0.0", "--port", "4173", "--strictPort"]), name: deps["@sveltejs/kit"] ? "SvelteKit" : deps.vue ? "Vue · Vite" : deps.svelte ? "Svelte · Vite" : "Vite" };
  if (deps["react-scripts"]) return { ...bin("react-scripts", ["start"]), name: "Create React App" };
  if (deps["@vue/cli-service"]) return { ...bin("vue-cli-service", ["serve", "--host", "0.0.0.0", "--port", "4173"]), name: "Vue CLI" };
  const script = pkg.scripts?.dev ? "dev" : pkg.scripts?.start ? "start" : null;
  if (script) return { ...base, command: "npm", args: ["run", script] };
  if (files[root + "/index.html"]) return { ...base, name: "HTML / CSS / JavaScript", install: false, command: "node", args: [".polazu-static.cjs"] };
  throw new Error("선택한 폴더에 실행 가능한 dev/start 스크립트 또는 index.html이 없습니다. 앱 폴더를 선택하세요. Python·Java 서버는 브라우저 Node 실행 대상이 아닙니다.");
}
export function discoverRoutes(files: Record<string, string>, root: string) {
  const routes = new Set<string>(["/"]);
  for (const path of Object.keys(files)) {
    if (!path.startsWith(root + "/")) continue;
    const local = path.slice(root.length);
    const match = local.match(/^\/(?:src\/)?(?:app\/(.*)\/page\.[jt]sx?|pages\/(.*)\.(?:vue|[jt]sx?)|src\/routes\/(.*)\/\+page\.svelte)$/);
    if (match) {
      let part = (match[1] ?? match[2] ?? match[3] ?? "").split("/").filter(p => !p.startsWith("(")).join("/").replace(/(^|\/)index$/, "");
      if (!part.includes("[") && !part.startsWith("api/") && !part.startsWith("_")) routes.add("/" + part);
    }
    if (local.endsWith(".html")) routes.add(local === "/index.html" ? "/" : local);
  }
  return [...routes].sort();
}
// 경로는 가상 작업 폴더 안에서만 허용합니다. __proto__도 일반 파일명으로 취급합니다.
export function toTree(project: Project): FileSystemTree {
  const tree: FileSystemTree = Object.create(null);
  const entries: [string, string | Uint8Array][] = Object.entries(project.files);
  for (const [p, b64] of Object.entries(project.binaryFiles ?? {})) entries.push([p, Uint8Array.from(atob(b64), c => c.charCodeAt(0))]);
  for (const [path, contents] of entries) {
    const parts = path.replace(/^\//, "").split("/");
    if (parts.some(p => !p || p === "." || p === ".." || /[\\:\0]/.test(p))) throw new Error("안전하지 않은 파일 경로: " + path);
    let node = tree;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) Object.defineProperty(node, part, { value: { file: { contents } }, enumerable: true, configurable: true, writable: true });
      else {
        if (!Object.hasOwn(node, part)) Object.defineProperty(node, part, { value: { directory: Object.create(null) }, enumerable: true });
        const child = node[part];
        if (!("directory" in child)) throw new Error("파일과 폴더 경로가 충돌합니다.");
        node = child.directory;
      }
    });
  }
  return tree;
}
export const STATIC_SERVER = `const http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const root=process.cwd(), mime={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".woff2":"font/woff2",".json":"application/json"};
http.createServer((req,res)=>{try{const p=decodeURIComponent(new URL(req.url,"http://local").pathname);let file=path.resolve(root,"."+p);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,"index.html");if(!fs.existsSync(file)){res.writeHead(404).end("Not found");return}res.setHeader("Content-Type",mime[path.extname(file)]||"application/octet-stream");fs.createReadStream(file).pipe(res)}catch{res.writeHead(400).end()}}).listen(4173,"0.0.0.0");`;

import type { Project } from "./types";

export type StaticPreviewDocument = {
  html: string;
  path: string;
  route: string;
  warnings: string[];
};

const MIME: Record<string,string> = {
  avif:"image/avif", css:"text/css", gif:"image/gif", html:"text/html", htm:"text/html",
  ico:"image/x-icon", jpeg:"image/jpeg", jpg:"image/jpeg", js:"text/javascript", json:"application/json",
  mjs:"text/javascript", mp3:"audio/mpeg", mp4:"video/mp4", ogg:"audio/ogg", otf:"font/otf",
  png:"image/png", svg:"image/svg+xml", ttf:"font/ttf", txt:"text/plain", wav:"audio/wav",
  webm:"video/webm", webp:"image/webp", woff:"font/woff", woff2:"font/woff2", xml:"application/xml",
};

const EXTERNAL_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;

export function supportsWebContainerRuntime() {
  return typeof window !== "undefined"
    && window.crossOriginIsolated
    && typeof SharedArrayBuffer === "function"
    && typeof navigator !== "undefined"
    && "serviceWorker" in navigator;
}

export function isStaticPreviewProject(files: Record<string,string>, root: string) {
  const manifest = files[joinRoot(root,"package.json")];
  if (manifest) {
    try {
      const parsed = JSON.parse(manifest.replace(/^\uFEFF/, "")) as {dependencies?:Record<string,string>;devDependencies?:Record<string,string>;scripts?:Record<string,string>};
      const dependencies={...parsed.dependencies,...parsed.devDependencies};
      if (Object.keys(dependencies).length || parsed.scripts?.dev || parsed.scripts?.start) return false;
    } catch { return false; }
  }
  return !!findStaticHtml("/",files,root);
}

export function findStaticHtml(route: string, files: Record<string,string>, root=""): {path:string;content:string}|null {
  const clean=(route.split(/[?#]/)[0]||"/").replace(/\\/g,"/");
  const normalized=clean==="/"?"":clean.replace(/^\/+|\/+$/g,"");
  const localCandidates=normalized
    ? [`${normalized}.html`,`${normalized}/index.html`,normalized]
    : ["index.html","index.htm","public/index.html"];
  const candidates=[
    ...localCandidates.map(value=>joinRoot(root,value)),
    ...localCandidates.map(value=>normalizePath("/"+value)),
  ];
  for(const candidate of [...new Set(candidates)])if(typeof files[candidate]==="string")return{path:candidate,content:files[candidate]};
  const prefix=normalizeRoot(root)+"/";
  const first=Object.keys(files).find(file=>file.startsWith(prefix)&&/\.html?$/i.test(file))
    ?? Object.keys(files).find(file=>/\.html?$/i.test(file));
  return first?{path:first,content:files[first]}:null;
}

export function buildStaticPreviewDocument(
  project: Pick<Project,"files"|"binaryFiles">,
  root: string,
  route: string,
  bridge: string,
  token: string,
  hostOrigin: string,
): StaticPreviewDocument {
  const entry=findStaticHtml(route,project.files,root);
  if(!entry)throw new Error(`정적 미리보기에서 ${route} HTML 파일을 찾지 못했습니다.`);
  const warnings:string[]=[];
  const cssStack=new Set<string>();
  const moduleStack=new Set<string>();

  const resolve=(reference:string,fromPath:string)=>resolveProjectPath(reference,fromPath,root,project.files,project.binaryFiles??{});
  const resourceData=(path:string)=>{
    const binary=project.binaryFiles?.[path];
    if(typeof binary==="string")return `data:${mime(path)};base64,${binary.replace(/\s+/g,"")}`;
    const text=project.files[path];
    return typeof text==="string"?textDataUrl(text,mime(path)):null;
  };
  const rewriteCss=(source:string,fromPath:string):string=>{
    let result=source.replace(/@import\s+(?:url\(\s*)?(["'])([^"']+)\1\s*\)?\s*([^;]*);/gi,(whole,_quote:string,reference:string,media:string)=>{
      const target=resolve(reference,fromPath);if(!target||typeof project.files[target]!=="string")return whole;
      if(cssStack.has(target)){warnings.push(`${target}: 순환 CSS @import는 원래 참조로 유지했습니다.`);return whole;}
      cssStack.add(target);const nested=rewriteCss(project.files[target],target);cssStack.delete(target);
      const condition=media.trim();return condition?`@media ${condition}{\n${nested}\n}`:`/* ${target} */\n${nested}`;
    });
    result=result.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/gi,(whole,_quote:string,reference:string)=>{
      const target=resolve(reference.trim(),fromPath);if(!target)return whole;
      const data=resourceData(target);return data?`url("${data.replace(/"/g,"%22")}")`:whole;
    });
    return result;
  };
  const rewriteModule=(source:string,fromPath:string):string=>source.replace(/\b(from\s*|import\s*\(\s*|import\s*)(["'])([^"']+)\2/g,(whole,prefix:string,quote:string,reference:string)=>{
    if(EXTERNAL_URL.test(reference))return whole;
    const target=resolve(reference,fromPath);if(!target||typeof project.files[target]!=="string")return whole;
    if(moduleStack.has(target)){warnings.push(`${target}: 순환 ES module 참조는 원래 경로로 유지했습니다.`);return whole;}
    moduleStack.add(target);const nested=rewriteModule(project.files[target],target);moduleStack.delete(target);
    return `${prefix}${quote}${textDataUrl(nested,"text/javascript")}${quote}`;
  });

  let html=entry.content
    .replace(/<meta\b[^>]*http-equiv\s*=\s*(["'])?content-security-policy\1?[^>]*>/gi,"")
    .replace(/<base\b[^>]*>/gi,"");

  html=html.replace(/<link\b([^>]*?)>/gi,(whole,attributes:string)=>{
    const href=readAttribute(attributes,"href");if(!href)return whole;
    const target=resolve(href,entry.path);if(!target)return whole;
    const rel=(readAttribute(attributes,"rel")??"").toLowerCase();
    if(/(?:^|\s)stylesheet(?:\s|$)/.test(rel)&&typeof project.files[target]==="string"){
      cssStack.add(target);const css=rewriteCss(project.files[target],target);cssStack.delete(target);
      const media=readAttribute(attributes,"media");return `<style data-polazu-static-resource="${escapeAttribute(target)}"${media?` media="${escapeAttribute(media)}"`:""}>${escapeStyle(css)}</style>`;
    }
    const data=resourceData(target);return data?replaceAttribute(whole,"href",data):whole;
  });

  html=html.replace(/<style\b([^>]*)>([\s\S]*?)<\/style\s*>/gi,(whole,attributes:string,source:string)=>`<style${attributes}>${escapeStyle(rewriteCss(source,entry.path))}</style>`);

  html=html.replace(/<script\b([^>]*?)\bsrc\s*=\s*(["'])(.*?)\2([^>]*)>\s*<\/script\s*>/gi,(whole,before:string,_quote:string,reference:string,after:string)=>{
    const target=resolve(reference,entry.path);if(!target||typeof project.files[target]!=="string")return whole;
    const module=/\btype\s*=\s*(["'])module\1/i.test(before+after)||/\.mjs$/i.test(target);
    if(module)moduleStack.add(target);
    const source=module?rewriteModule(project.files[target],target):project.files[target];
    if(module)moduleStack.delete(target);
    return `<script${before}${after} src="${escapeAttribute(textDataUrl(source,"text/javascript"))}" data-polazu-static-resource="${escapeAttribute(target)}"></script>`;
  });

  html=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi,(whole,attributes:string,source:string)=>{
    if(!/\btype\s*=\s*(["'])module\1/i.test(attributes))return whole;
    return `<script${attributes}>${escapeScript(rewriteModule(source,entry.path))}</script>`;
  });

  html=html.replace(/\s(src|poster)\s*=\s*(["'])(.*?)\2/gi,(whole,name:string,quote:string,reference:string)=>{
    const target=resolve(reference,entry.path);if(!target)return whole;
    const data=resourceData(target);return data?` ${name}=${quote}${escapeAttribute(data)}${quote}`:whole;
  });
  html=html.replace(/\ssrcset\s*=\s*(["'])(.*?)\1/gi,(whole,quote:string,value:string)=>{
    const rewritten=value.split(",").map(part=>{const match=part.trim().match(/^(\S+)([\s\S]*)$/);if(!match)return part;const target=resolve(match[1],entry.path);const data=target?resourceData(target):null;return data?data+match[2]:part;}).join(", ");
    return ` srcset=${quote}${escapeAttribute(rewritten)}${quote}`;
  });
  html=html.replace(/\sstyle\s*=\s*(["'])(.*?)\1/gi,(_whole,quote:string,value:string)=>` style=${quote}${escapeAttribute(rewriteCss(value,entry.path))}${quote}`);

  const normalizedRoute=normalizeRoute(route);
  const config=`window.__POLAZU_CONFIG__=${JSON.stringify({token,origin:hostOrigin,path:normalizedRoute,staticPreview:true})};`;
  const navigation=`(()=>{const route=${JSON.stringify(normalizedRoute)},origin=${JSON.stringify(hostOrigin)},token=${JSON.stringify(token)};document.addEventListener("click",event=>{const link=event.target instanceof Element?event.target.closest("a[href]"):null;if(!link||event.defaultPrevented)return;const raw=link.getAttribute("href")||"";if(!raw||/^(?:#|[a-z][a-z\\d+.-]*:|\\/\\/)/i.test(raw))return;const url=new URL(raw,"https://polazu.static"+route);if(url.origin!=="https://polazu.static")return;event.preventDefault();parent.postMessage({source:"polazu-preview",token,type:"static-navigate",path:url.pathname+url.search+url.hash},origin);});})();`;
  const injected=`\n<script>${escapeScript(config)}</script><script>${escapeScript(bridge)}</script><script>${escapeScript(navigation)}</script>`;
  html=/<\/body\s*>/i.test(html)?html.replace(/<\/body\s*>/i,injected+"</body>"):html+injected;
  return{html,path:entry.path,route:normalizedRoute,warnings:[...new Set(warnings)]};
}

function resolveProjectPath(reference:string,fromPath:string,root:string,files:Record<string,string>,binary:Record<string,string>){
  const raw=reference.trim();if(!raw||EXTERNAL_URL.test(raw))return null;
  const clean=raw.split(/[?#]/)[0];if(!clean)return null;
  let decoded:string;try{decoded=decodeURIComponent(clean);}catch{decoded=clean;}
  const relative=decoded.startsWith("/")?normalizePath(normalizeRoot(root)+decoded):normalizePath(dirname(fromPath)+"/"+decoded);
  const direct=normalizePath(decoded.startsWith("/")?decoded:"/"+decoded);
  const candidates=[relative,direct,joinRoot(root,"public/"+decoded.replace(/^\//,"")),normalizePath("/public/"+decoded.replace(/^\//,""))];
  for(const candidate of [...new Set(candidates)])if(Object.hasOwn(files,candidate)||Object.hasOwn(binary,candidate))return candidate;
  return null;
}
function normalizeRoot(root:string){const value=normalizePath(root||"/");return value==="/"?"":value.replace(/\/$/,"");}
function joinRoot(root:string,path:string){return normalizePath(`${normalizeRoot(root)}/${path.replace(/^\//,"")}`);}
function dirname(path:string){const normalized=normalizePath(path);return normalized.slice(0,normalized.lastIndexOf("/"))||"/";}
function normalizePath(path:string){const parts:string[]=[];for(const part of path.replace(/\\/g,"/").split("/")){if(!part||part===".")continue;if(part===".."){parts.pop();continue;}parts.push(part);}return"/"+parts.join("/");}
function normalizeRoute(route:string){const value=(route||"/").trim();if(!value.startsWith("/")||value.startsWith("//"))return"/";return value.replace(/[\r\n\\]/g,"")||"/";}
function extension(path:string){return path.split(/[?#]/)[0].match(/\.([a-z\d]+)$/i)?.[1].toLowerCase()??"";}
function mime(path:string){return MIME[extension(path)]??"application/octet-stream";}
function textDataUrl(value:string,type:string){return `data:${type};charset=utf-8,${encodeURIComponent(value)}`;}
function readAttribute(attributes:string,name:string){const match=attributes.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`,"i"));return match?.[2]??null;}
function replaceAttribute(tag:string,name:string,value:string){return tag.replace(new RegExp(`(\\b${name}\\s*=\\s*)(["'])(.*?)\\2`,"i"),(_whole,prefix:string,quote:string)=>`${prefix}${quote}${escapeAttribute(value)}${quote}`);}
function escapeAttribute(value:string){return value.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function escapeScript(value:string){return value.replace(/<\/script/gi,"<\\/script").replace(/<!--/g,"<\\!--");}
function escapeStyle(value:string){return value.replace(/<\/style/gi,"<\\/style");}

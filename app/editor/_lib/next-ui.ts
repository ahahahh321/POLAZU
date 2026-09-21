import type { Project } from "./types";

/** Next 서버 대신 클라이언트 UI만 실행하는 명시적 호환 모드입니다.
 * 원본은 변경하지 않고 가상 파일 복사본에 진입점과 Next 브라우저 어댑터를 추가합니다.
 * SSR/Server Actions/서버 전용 모듈은 구현하지 않으며 실패를 숨기지 않습니다. */
export function prepareNextUI(project: Project, root: string): Project {
  const files = { ...project.files };
  const pkg = JSON.parse(files[root+"/package.json"]);
  const deps = {...pkg.dependencies,...pkg.devDependencies};
  delete deps.next;
  deps.vite="6.1.0";
  deps["@vitejs/plugin-react"]="4.3.4";
  const pages=Object.keys(files).filter(p=>p.startsWith(root+"/") && (/\/page\.[jt]sx?$/.test(p)||/\/pages\/.*\.[jt]sx?$/.test(p)));
  const entries=pages.flatMap(p=>{
    const local=p.slice(root.length);
    const app=local.match(/^\/(?:src\/)?app\/(.*)page\.[jt]sx?$/);
    const legacy=local.match(/^\/(?:src\/)?pages\/(.*)\.[jt]sx?$/);
    if(!app && !legacy)return [];
    const parts=(app?app[1]:legacy![1]).split("/").filter(x=>x && !x.startsWith("("));
    if(parts.some(x=>x.startsWith("_")||x.startsWith("@")) || parts[0]==="api")return [];
    let route="/"+parts.join("/").replace(/(^|\/)index$/,"");
    route=route.replace(/\/$/,"")||"/";
    const layouts:string[]=[];
    if(app){
      const dirs=p.slice(0,p.lastIndexOf("/")).split("/");
      for(let i=root.split("/").length;i<=dirs.length;i++){
        const dir=dirs.slice(0,i).join("/");
        const layout=["tsx","jsx","ts","js"].map(e=>dir+"/layout."+e).find(f=>files[f]);
        if(layout)layouts.push(layout.slice(root.length));
      }
    }
    return [{route,page:local,layouts}];
  });
  if(!entries.length)throw new Error("UI 호환 모드에서 app/page 또는 pages 진입점을 찾지 못했습니다.");
  files[root+"/package.json"]=JSON.stringify({name:"polazu-ui-preview",private:true,type:"module",dependencies:deps});
  delete files[root+"/package-lock.json"];
  files[root+"/index.html"]='<!doctype html><html><head><meta charset="utf-8"></head><body><div id="polazu-root"></div><script type="module" src="/.polazu-ui/main.jsx"></script></body></html>';
  files[root+"/.polazu-ui/next.jsx"]=NEXT_SHIM;
  files[root+"/.polazu-ui/main.jsx"]=UI_ENTRY.replace("/*ROUTES*/",entries.map(e=>`{path:${JSON.stringify(e.route)},page:()=>import(${JSON.stringify(e.page)}),layouts:[${e.layouts.map(l=>`()=>import(${JSON.stringify(l)})`).join(",")}]}`).join(","));
  files[root+"/.polazu-ui/vite.config.mjs"]= `import {defineConfig} from 'vite';import react from '@vitejs/plugin-react';import nodePath from 'node:path';
const runtimeRoot=process.cwd();
const sourcePrefix=${JSON.stringify(root)};
function polazuSourcePlugin({types:t}){
 return {visitor:{
  JSXOpeningElement(p,state){
   const name=p.node.name;
   if(name.type!=='JSXIdentifier'||!/^[a-z]/.test(name.name))return;
   if(p.node.attributes.some(a=>a.type==='JSXAttribute'&&a.name?.name==='data-polazu-source'))return;
   const filename=state.file?.opts?.filename||'';
   if(!filename||filename.includes('/.polazu-ui/')||filename.includes('/node_modules/'))return;
   const loc=p.node.loc?.start;if(!loc)return;
   const relative=nodePath.relative(runtimeRoot,filename).split(nodePath.sep).join('/');
   const projectPath='/'+[sourcePrefix,relative].join('/').split('/').filter(Boolean).join('/');
   p.node.attributes.push(t.jsxAttribute(t.jsxIdentifier('data-polazu-source'),t.stringLiteral(projectPath+':'+loc.line+':'+loc.column)));
  },
  JSXIdentifier(p){if(['html','body','head'].includes(p.node.name)&&['JSXOpeningElement','JSXClosingElement'].includes(p.parent.type))p.node.name='div'}
 }};
}
export default defineConfig({root:runtimeRoot,plugins:[react({babel:{plugins:[polazuSourcePlugin]}})],resolve:{alias:[{find:/^next(?:\\/.*)?$/,replacement:nodePath.join(runtimeRoot,'.polazu-ui/next.jsx')},{find:'@',replacement:nodePath.join(runtimeRoot,${JSON.stringify(files[root+"/src/app/layout.tsx"]?"src":".")})}]},server:{host:'0.0.0.0',port:4173,strictPort:true}});`;
  return {...project,files};
}
const NEXT_SHIM=String.raw`
import React,{useSyncExternalStore} from 'react';
const subscribe=fn=>{addEventListener('popstate',fn);return()=>removeEventListener('popstate',fn)};
export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname);
export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search));
export const useParams=()=>window.__POLAZU_PARAMS__||{};
const navigate=(url,replace=false)=>{if(typeof url==='object')url=url.pathname||'/';const target=new URL(url,location.href);if(target.origin!==location.origin){location.href=target.href;return}history[replace?'replaceState':'pushState']({},'',target);dispatchEvent(new PopStateEvent('popstate'))};
export const useRouter=()=>({push:navigate,replace:url=>navigate(url,true),back:()=>history.back(),forward:()=>history.forward(),refresh:()=>location.reload(),prefetch:()=>Promise.resolve()});
export const redirect=url=>navigate(url,true);
export const notFound=()=>{throw Error('이 경로의 페이지를 찾을 수 없습니다.')};
export default function NextAdapter(props){
 if(props.href){const {href,replace,prefetch,scroll,shallow,locale,legacyBehavior,passHref,onClick,...rest}=props;const url=typeof href==='string'?href:href.pathname||'/';return <a {...rest} href={url} onClick={e=>{onClick?.(e);if(!e.defaultPrevented&&!e.metaKey&&!e.ctrlKey&&e.button===0){e.preventDefault();navigate(url,replace)}}}/>}
 if(props.src){const {src,fill,priority,quality,loader,placeholder,blurDataURL,unoptimized,...rest}=props;return <img {...rest} src={typeof src==='string'?src:src.src} style={{...(fill?{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}:{}),...rest.style}}/>}
 return props.children||null;
}
export const headers=()=>{throw Error('headers()는 서버 전용입니다. UI 호환 모드에서는 사용할 수 없습니다.')};
export const cookies=headers;
`;
const UI_ENTRY=String.raw`
import React,{useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
const routes=[/*ROUTES*/];
function Failure({message}) {
 return <pre role="alert" data-polazu-runtime-error style={{padding:32,color:'#991b1b',whiteSpace:'pre-wrap'}}>{message}\n서버 기능은 UI 호환 모드에서 지원되지 않습니다.</pre>;
}
class Boundary extends React.Component {
 state={error:null};
 static getDerivedStateFromError(error){return {error};}
 render(){return this.state.error?<Failure message={this.state.error.message}/>:this.props.children;}
}
function App(){
 const [page,setPage]=useState(null),[error,setError]=useState('');
 useEffect(()=>{
  let version=0;
  async function load(){
   const id=++version;
   try{
    let params={};
    const route=routes.find(r=>{
     const names=[];
     const pattern=r.path.split('/').map(s=>{
      if(s.startsWith('[')){names.push(s.slice(1,-1));return '([^/]+)'}
      return s.replace(/[.*+?^$()|{}\\]/g,'\\$&');
     }).join('/');
     const match=location.pathname.replace(/\/$/,'').match(new RegExp('^'+pattern.replace(/\/$/,'')+'$'));
     if(match){params=Object.fromEntries(names.map((n,i)=>[n,decodeURIComponent(match[i+1])]));return true;}
     return r.path==='/'&&location.pathname==='/';
    });
    if(!route)throw Error('이 경로에 대응하는 페이지가 없습니다: '+location.pathname);
    window.__POLAZU_PARAMS__=params;
    const modules=await Promise.all([route.page(),...route.layouts.map(fn=>fn())]);
    if(modules.some(m=>m.default?.constructor?.name==='AsyncFunction'))throw Error('async 서버 컴포넌트는 클라이언트 UI 호환 모드에서 실행할 수 없습니다.');
    let node=React.createElement(modules[0].default,{params,searchParams:Object.fromEntries(new URLSearchParams(location.search))});
    // 가장 안쪽 레이아웃부터 감싸 원래 중첩 순서를 유지합니다.
    for(const m of modules.slice(1).reverse())node=React.createElement(m.default,{params},node);
    if(id===version){setPage(node);setError('');}
   }catch(e){if(id===version)setError(e.message);}
  }
  load();addEventListener('popstate',load);
  return()=>{version++;removeEventListener('popstate',load);};
 },[]);
 return error?<Failure message={error}/>:page;
}
createRoot(document.getElementById('polazu-root')).render(<Boundary><App/></Boundary>);
`;

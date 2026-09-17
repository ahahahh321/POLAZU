import type { WebContainer, WebContainerProcess } from "@webcontainer/api";
import { planProject, STATIC_SERVER, toTree } from "./adapters";
import type { Project, Stage } from "./types";
import { prepareNextUI } from "./next-ui";

type Sink = { stage: (stage: Stage, message: string) => void; log: (line: string) => void; url: (url: string) => void };
type Shared = { boot?: Promise<WebContainer>; queue: Promise<unknown> };
const globalRuntime = globalThis as typeof globalThis & { __polazuRuntimeV2?: Shared };
// HMR/StrictMode에서도 탭의 생성 Promise와 정리 순서를 공유합니다.
const shared = globalRuntime.__polazuRuntimeV2 ??= { queue: Promise.resolve() };
async function boot() {
  if (!crossOriginIsolated) throw new Error("브라우저 격리가 적용되지 않았습니다. 에디터 주소를 새 탭에서 직접 열어 주세요.");
  shared.boot ??= import("@webcontainer/api").then(({ WebContainer }) => WebContainer.boot({ coep: "credentialless", forwardPreviewErrors: true }))
    .catch(error => { shared.boot = undefined; throw error; });
  return shared.boot;
}
function deadline<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve,reject) => {
    const timer = setTimeout(()=>reject(new Error(message)),ms);
    promise.then(x=>{clearTimeout(timer);resolve(x);},e=>{clearTimeout(timer);reject(e);});
  });
}
export function startRuntime(project: Project, root: string, token: string, sink: Sink, nextUI = false) {
  let cancelled = false, cwd = "", wc: WebContainer | undefined;
  const processes = new Set<WebContainerProcess>(), off: (()=>void)[] = [];
  const alive = () => { if (cancelled) throw new Error("CANCELLED"); };
  const attach = (p: WebContainerProcess) => {
    processes.add(p);
    void p.output.pipeTo(new WritableStream({ write: data => { if(!cancelled) sink.log(data); } })).catch(()=>{});
    return p;
  };
  const work = shared.queue.catch(()=>{}).then(async()=>{
    if (cancelled) return;
    try {
      const input = nextUI ? prepareNextUI(project, root) : project;
      const plan = nextUI ? { ...planProject(input.files,root), name:"Next.js · 클라이언트 UI", command:"./node_modules/.bin/vite", args:["--config",".polazu-ui/vite.config.mjs"] } : planProject(input.files, root);
      sink.stage("boot","브라우저 실행 환경 준비");
      wc = await deadline(boot(),45000,"브라우저 실행 환경에 연결하지 못했습니다. 네트워크/브라우저 정책을 확인하세요."); alive();
      cwd = "project-" + crypto.randomUUID();
      await wc.fs.mkdir(cwd); alive();
      await wc.mount(toTree(input),{mountPoint:cwd}); alive();
      const source = await fetch("/editor-bridge.js",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("편집 브리지 로딩 실패");return r.text();}); alive();
      await wc.setPreviewScript("window.__POLAZU_CONFIG__="+JSON.stringify({token,origin:location.origin})+";\n"+source); alive();
      const appCwd = cwd + root;
      await wc.fs.writeFile(appCwd+"/.polazu-static.cjs",STATIC_SERVER);
      const env = { HOST:"0.0.0.0", PORT:"4173", BROWSER:"none", NEXT_TELEMETRY_DISABLED:"1", NG_CLI_ANALYTICS:"false" };
      off.push(wc.on("error",e=>{if(!cancelled)sink.stage("error",e.message);}));
      off.push(wc.on("preview-message",message=>{if(!cancelled)sink.log("[브라우저] "+JSON.stringify(message).slice(0,2000));}));
      if (plan.install) {
        sink.stage("install","프로젝트 패키지 설치 중");
        sink.log("$ npm install --ignore-scripts\n");
        const install=attach(await wc.spawn("npm",["install","--ignore-scripts","--no-audit","--no-fund","--no-progress","--loglevel=error"],{cwd:appCwd,env})); alive();
        const code=await deadline(install.exit,300000,"패키지 설치가 5분을 초과했습니다. 실행 로그의 네트워크·버전 오류를 확인하세요.");alive();
        if(code!==0)throw new Error("패키지 설치 실패 (exit "+code+"). 실행 로그를 확인하세요.");
      }
      off.push(wc.on("server-ready",(port,url)=>{
        if(!cancelled && port===4173){sink.stage("loading","페이지 컴파일 및 렌더링 확인 중");sink.url(url);}
      }));
      sink.stage("start",plan.name+" 시작 중");
      sink.log("$ "+plan.command+" "+plan.args.join(" ")+"\n");
      const process=attach(await wc.spawn(plan.command,plan.args,{cwd:appCwd,env}));alive();
      void process.exit.then(code=>{if(!cancelled)sink.stage("error","개발 서버가 종료됐습니다 (exit "+code+"). 실행 로그를 확인하세요.");});
    } catch(error) {
      if(!cancelled){sink.stage("error",error instanceof Error?error.message:String(error));for(const p of processes)p.kill();}
    }
  });
  shared.queue=work;
  return () => {
    cancelled=true;for(const unsubscribe of off)unsubscribe();for(const p of processes)p.kill();
    // 소스는 실행별 독립 폴더에 둡니다. 다른 프로젝트의 파일이 섞이지 않습니다.
    shared.queue=work.catch(()=>{}).then(async()=>{
      for(const p of processes)p.kill();
      if(wc && /^project-[a-f0-9-]+$/.test(cwd)) await wc.fs.rm(cwd,{recursive:true,force:true}).catch(()=>{});
    });
  };
}

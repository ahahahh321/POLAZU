/* POLAZU 미리보기 전용 브리지. 원본 프로젝트 파일에는 쓰지 않습니다. */
(() => {
  "use strict";
  const config = window.__POLAZU_CONFIG__;
  if (!config || window.__POLAZU_BRIDGE__) return;
  window.__POLAZU_BRIDGE__ = true;
  let mode = "edit", rules = [], edits = [], selected = null, scheduled = false;
  const documentId = Math.random().toString(36);
  try {
    const saved = JSON.parse(sessionStorage.getItem("polazu-state-"+config.token) || "null");
    if(saved){mode=saved.mode;rules=saved.rules;edits=saved.edits;}
  } catch {}
  const originals = new Map();
  const props = ["color","backgroundColor","fontSize","fontWeight","lineHeight","padding","margin","borderRadius","width","height","display","gap","opacity"];
  const send = (type, payload = {}) => parent.postMessage({ source: "polazu-preview", token: config.token, type, ...payload }, config.origin);
  const path = () => location.pathname;
  function selector(el) {
    if (el === document.body) return "body";
    const parts = [];
    while (el && el !== document.body) {
      const siblings = [...el.parentElement.children].filter(e => e.tagName === el.tagName);
      parts.unshift(el.tagName.toLowerCase() + ":nth-of-type(" + (siblings.indexOf(el)+1) + ")");
      el = el.parentElement;
    }
    return "body > " + parts.join(" > ");
  }
  const ignored = el => /^(SCRIPT|STYLE|LINK|META|NOSCRIPT|NEXTJS-PORTAL)$/.test(el.tagName) || el.closest("[data-polazu-overlay]");
  function describe(el) {
    const styles = getComputedStyle(el), box = el.getBoundingClientRect();
    return { selector: selector(el), tag: el.tagName.toLowerCase(), label: (el.getAttribute("aria-label") || el.innerText || el.tagName).trim().slice(0,60),
      depth: Math.min(12, selector(el).split(" > ").length-1),
      text: el.childElementCount === 0 ? el.textContent : "", editableText: el.childElementCount === 0 && !["INPUT","TEXTAREA","SELECT","IMG","SVG"].includes(el.tagName),
      styles: Object.fromEntries(props.map(k => [k,styles[k]])), width: Math.round(box.width), height: Math.round(box.height) };
  }
  let overlay;
  function outline(el) {
    if (!overlay) return;
    if (!el || mode !== "edit" || !el.isConnected) { overlay.hidden = true; return; }
    const b = el.getBoundingClientRect();
    Object.assign(overlay.style,{left:b.left+"px",top:b.top+"px",width:b.width+"px",height:b.height+"px"});
    overlay.hidden = false;
  }
  function select(el) { selected = el; outline(el); send("selected",{element:describe(el)}); }
  function report() {
    scheduled = false;
    const failure=document.querySelector('[data-polazu-runtime-error], vite-error-overlay');
    if(failure)send('runtime-error',{message:(failure.shadowRoot?.textContent||failure.textContent||'미리보기 컴파일 실패').slice(0,2000)});
    const nodes = [...document.body.querySelectorAll("*")].filter(el => el instanceof HTMLElement && !ignored(el) && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0).slice(0,250);
    send("ready",{documentId,path:path(),title:document.title,hasContent:nodes.length>0 || !!document.body.innerText.trim(),
      layers:nodes.map(el=>({selector:selector(el),tag:el.tagName.toLowerCase(),label:(el.getAttribute("aria-label")||el.innerText||el.tagName).trim().slice(0,45),depth:Math.min(12,selector(el).split(" > ").length-1)}))});
    outline(selected);
  }
  function schedule() { if (!scheduled) { scheduled = true; setTimeout(report,250); } }
  // React의 자식 노드와 이벤트 핸들러를 보존하기 위해 leaf 텍스트만 수정합니다.
  function replay() {
    for (const [el, saved] of originals) {
      if (!el.isConnected) continue;
      if (saved.style === null) el.removeAttribute("style"); else el.setAttribute("style",saved.style);
      if (el.childElementCount === 0 && el.textContent !== saved.text) el.textContent = saved.text;
      if (el instanceof HTMLButtonElement) el.disabled = saved.disabled;
      if (saved.busy === null) el.removeAttribute("aria-busy"); else el.setAttribute("aria-busy",saved.busy);
    }
    for (const edit of edits.filter(x=>x.path===path())) {
      let el; try { el = document.querySelector(edit.selector); } catch { continue; }
      if (!(el instanceof HTMLElement) || ignored(el)) continue;
      if (!originals.has(el)) originals.set(el,{style:el.getAttribute("style"),text:el.textContent,disabled:el.disabled,busy:el.getAttribute("aria-busy")});
      if (typeof edit.text==="string" && el.childElementCount===0 && !["INPUT","TEXTAREA","SELECT"].includes(el.tagName)) el.textContent=edit.text;
      for (const [key,value] of Object.entries(edit.styles || {})) {
        if (props.includes(key) && typeof value==="string" && value.length < 100 && !/url\s*\(|expression/i.test(value)) el.style[key]=value;
      }
      if (edit.state && el instanceof HTMLButtonElement) {
        el.disabled = edit.state !== "default"; el.setAttribute("aria-busy",edit.state==="loading"?"true":"false");
        if (edit.state==="loading" && el.childElementCount===0) el.textContent="Loading…";
      }
    }
    outline(selected);
  }
  document.addEventListener("click",event=>{
    if (mode !== "edit") return;
    const el = event.target instanceof Element ? event.target.closest("*") : null;
    if (!(el instanceof HTMLElement) || ignored(el)) return;
    event.preventDefault();event.stopImmediatePropagation();select(el);
  },true);
  document.addEventListener("submit",event=>{event.preventDefault();send("notice",{message:"미리보기에서는 실제 폼 제출을 차단합니다."});},true);
  addEventListener("message",event=>{
    const d=event.data;
    if (event.source!==parent || event.origin!==config.origin || !d || d.token!==config.token || d.source!=="polazu-editor") return;
    if (d.type==="sync") {
      mode=d.mode==="preview"?"preview":"edit";rules=Array.isArray(d.rules)?d.rules:[];edits=Array.isArray(d.edits)?d.edits:[];
      try{sessionStorage.setItem("polazu-state-"+config.token,JSON.stringify({mode,rules,edits}));}catch{}
      replay();
    }
    if (d.type==="select" && typeof d.selector==="string") { try { const el=document.querySelector(d.selector); if(el instanceof HTMLElement) {el.scrollIntoView({block:"center"});select(el);} } catch {} }
  });
  // fetch와 XMLHttpRequest 모두 동일한 Mock 규칙을 사용합니다. 서버 측 fetch는 대상이 아닙니다.
  const match = (method,url) => rules.find(r=>r.method===method && (r.url===url.pathname+url.search || r.url===url.pathname));
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=new URL(input instanceof Request?input.url:String(input),location.href);
    const method=(init.method || (input instanceof Request?input.method:"GET")).toUpperCase();
    const rule=match(method,url);
    const api=/^\/api(?:\/|$)/.test(url.pathname) || !['GET','HEAD'].includes(method);
    if(rule || api) {
      send("request",{method,url:url.pathname+url.search,matched:!!rule});
      return new Response(rule && [204,205,304].includes(rule.status)?null:JSON.stringify(rule?rule.body:{error:"MOCK_NOT_CONFIGURED",message:"Mock 응답을 설정하세요."}),
        {status:rule?rule.status:501,headers:{"Content-Type":"application/json"}});
    }
    return originalFetch(input,init);
  };
  const NativeXHR=window.XMLHttpRequest;
  window.XMLHttpRequest=class extends NativeXHR {
    open(method,url,...args) { this._method=String(method).toUpperCase();this._url=new URL(String(url),location.href);return super.open(method,url,...args); }
    send(body) {
      const rule=match(this._method,this._url);
      if(!rule && !/^\/api(?:\/|$)/.test(this._url.pathname) && ['GET','HEAD'].includes(this._method))return super.send(body);
      send("request",{method:this._method,url:this._url.pathname+this._url.search,matched:!!rule});
      const text=JSON.stringify(rule?rule.body:{error:"MOCK_NOT_CONFIGURED"});
      queueMicrotask(()=>{
        Object.defineProperties(this,{readyState:{value:4,configurable:true},status:{value:rule?rule.status:501,configurable:true},responseText:{get:()=>text,configurable:true},response:{get:()=>this.responseType==="json"?JSON.parse(text):text,configurable:true}});
        this.dispatchEvent(new Event("readystatechange"));this.dispatchEvent(new ProgressEvent("load"));this.dispatchEvent(new ProgressEvent("loadend"));
      });
    }
    getAllResponseHeaders(){return this.readyState===4 && (match(this._method,this._url)||/^\/api(?:\/|$)/.test(this._url.pathname))?"content-type: application/json\r\n":super.getAllResponseHeaders();}
  };
  addEventListener("error",e=>send("runtime-error",{message:e.message || "리소스 로딩 오류"}));
  addEventListener("unhandledrejection",e=>send("runtime-error",{message:String(e.reason?.message||e.reason)}));
  function start() {
    overlay=document.createElement("div");overlay.dataset.polazuOverlay="true";overlay.hidden=true;
    overlay.style.cssText="position:fixed;pointer-events:none;border:2px solid #8b5cf6;box-sizing:border-box;z-index:2147483647;box-shadow:0 0 0 1px white";
    document.body.appendChild(overlay);
    new MutationObserver(records=>{if(records.some(r=>!(r.target instanceof Element && r.target.closest("[data-polazu-overlay]"))))schedule();}).observe(document.body,{subtree:true,childList:true});
    replay();report();
    addEventListener("scroll",()=>outline(selected),true);
    addEventListener("resize",schedule);
    addEventListener("popstate",()=>{replay();schedule();});
    for (const method of ["pushState","replaceState"]) {
      const original=history[method].bind(history);
      history[method]=(...args)=>{const result=original(...args);replay();schedule();return result;};
    }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();

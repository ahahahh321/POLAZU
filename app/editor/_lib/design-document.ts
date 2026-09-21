export type DesignNodeKind = "frame" | "text" | "rectangle" | "image" | "button" | "input" | "stack";
export type DesignLayout = "free" | "horizontal" | "vertical" | "grid";

export type DesignStyle = {
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  padding?: number;
  gap?: number;
  radius?: number;
  opacity?: number;
  rotation?: number;
  background?: string;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
  justify?: "start" | "center" | "end" | "between";
  align?: "start" | "center" | "end" | "stretch";
  columns?: number;
  shadow?: string;
  overflow?: "visible" | "hidden";
};

export type DesignNode = {
  id: string;
  kind: DesignNodeKind;
  name: string;
  parentId: string | null;
  childIds: string[];
  x: number;
  y: number;
  layout: DesignLayout;
  text?: string;
  src?: string;
  alt?: string;
  href?: string;
  style: DesignStyle;
  responsive?: Partial<Record<"tablet" | "mobile", DesignStyle>>;
  locked?: boolean;
  hidden?: boolean;
};

export type DesignPage = { id:string; name:string; route:string; rootIds:string[] };
export type DesignDocument = {
  version: 1;
  id: string;
  name: string;
  pages: DesignPage[];
  activePageId: string;
  nodes: Record<string, DesignNode>;
  updatedAt: string;
};

export function createDesignDocument(name="Untitled page"):DesignDocument {
  const pageId=crypto.randomUUID();
  const frameId=crypto.randomUUID();
  const headingId=crypto.randomUUID();
  const textId=crypto.randomUUID();
  const buttonId=crypto.randomUUID();
  return {version:1,id:crypto.randomUUID(),name,pages:[{id:pageId,name:"Home",route:"/",rootIds:[frameId]}],activePageId:pageId,updatedAt:new Date().toISOString(),nodes:{
    [frameId]:{id:frameId,kind:"frame",name:"Desktop",parentId:null,childIds:[headingId,textId,buttonId],x:560,y:240,layout:"vertical",style:{width:1200,minHeight:800,padding:80,gap:24,background:"#ffffff",color:"#111827",align:"start",overflow:"hidden"}},
    [headingId]:{id:headingId,kind:"text",name:"Heading",parentId:frameId,childIds:[],x:0,y:0,layout:"free",text:"디자인이 실제 웹페이지가 됩니다",style:{fontSize:56,fontWeight:750,lineHeight:1.08,color:"#111827"}},
    [textId]:{id:textId,kind:"text",name:"Description",parentId:frameId,childIds:[],x:0,y:0,layout:"free",text:"POLAZU 캔버스에서 구성한 프레임과 레이어를 반응형 코드로 생성하세요.",style:{fontSize:20,lineHeight:1.6,color:"#4b5563",width:680}},
    [buttonId]:{id:buttonId,kind:"button",name:"Primary button",parentId:frameId,childIds:[],x:0,y:0,layout:"free",text:"시작하기",href:"#",style:{padding:14,radius:10,background:"#5b4cf0",color:"#ffffff",fontSize:16,fontWeight:700}},
  }};
}

export function addDesignNode(document:DesignDocument,parentId:string|null,kind:DesignNodeKind,x=0,y=0):DesignDocument {
  const id=crypto.randomUUID();
  const defaults:Record<DesignNodeKind,Pick<DesignNode,"name"|"layout"|"text"|"style">>={
    frame:{name:"Frame",layout:"vertical",style:{width:720,minHeight:480,padding:40,gap:20,background:"#ffffff",overflow:"hidden"}},
    stack:{name:"Stack",layout:"vertical",style:{width:400,minHeight:120,padding:20,gap:12,background:"#ffffff"}},
    text:{name:"Text",layout:"free",text:"텍스트를 입력하세요",style:{fontSize:18,lineHeight:1.5,color:"#111827"}},
    rectangle:{name:"Rectangle",layout:"free",style:{width:200,height:120,radius:12,background:"#e5e7eb"}},
    image:{name:"Image",layout:"free",style:{width:320,height:200,radius:12,background:"#e5e7eb"}},
    button:{name:"Button",layout:"free",text:"버튼",style:{padding:12,radius:8,background:"#5b4cf0",color:"#ffffff",fontSize:15,fontWeight:700}},
    input:{name:"Input",layout:"free",text:"입력하세요",style:{width:320,height:44,padding:12,radius:8,background:"#ffffff",borderColor:"#d1d5db",borderWidth:1,fontSize:15}},
  };
  const node:DesignNode={id,kind,parentId,childIds:[],x,y,...defaults[kind]};
  const nodes={...document.nodes,[id]:node};
  const pages=document.pages.map(page=>page.id===document.activePageId&&!parentId?{...page,rootIds:[...page.rootIds,id]}:page);
  if(parentId&&nodes[parentId])nodes[parentId]={...nodes[parentId],childIds:[...nodes[parentId].childIds,id]};
  return {...document,nodes,pages,updatedAt:new Date().toISOString()};
}

export type DesignPreset = "navbar"|"hero"|"features"|"cta"|"footer";

export function addDesignPreset(document:DesignDocument,parentId:string,preset:DesignPreset):DesignDocument {
  const parent=document.nodes[parentId];if(!parent)return document;
  let next=document;
  const add=(kind:DesignNodeKind,name:string,text?:string,style?:DesignStyle,layout?:DesignLayout)=>{
    const before=new Set(Object.keys(next.nodes));next=addDesignNode(next,parentId,kind);const id=Object.keys(next.nodes).find(key=>!before.has(key))!;
    next=updateDesignNode(next,id,{name,text,layout:layout??next.nodes[id].layout,style:{...next.nodes[id].style,...style}});return id;
  };
  if(preset==="navbar"){
    const id=add("stack","Navigation",undefined,{width:1040,padding:20,gap:24,justify:"between",align:"center",background:"#ffffff"},"horizontal");
    next=moveInto(next,add("text","Brand","BRAND",{fontSize:20,fontWeight:800}),id);next=moveInto(next,add("text","Menu","Home   Work   About   Contact",{fontSize:15,color:"#4b5563"}),id);
  }
  if(preset==="hero"){
    const id=add("stack","Hero",undefined,{width:1040,minHeight:520,padding:64,gap:24,background:"#f5f3ff",radius:24,justify:"center"},"vertical");
    next=moveInto(next,add("text","Eyebrow","DESIGN YOUR WEBSITE",{fontSize:14,fontWeight:700,color:"#6558d3"}),id);next=moveInto(next,add("text","Hero heading","아이디어를 화면 위에서 바로 완성하세요",{fontSize:56,fontWeight:800,lineHeight:1.1,width:760}),id);next=moveInto(next,add("text","Hero description","섹션을 고르고, 내용을 바꾸고, 원하는 순서로 배치하세요.",{fontSize:20,lineHeight:1.6,color:"#4b5563",width:680}),id);next=moveInto(next,add("button","Hero button","시작하기",{padding:14,radius:10,background:"#6558d3",color:"#ffffff",fontWeight:700}),id);
  }
  if(preset==="features"){
    const id=add("stack","Feature section",undefined,{width:1040,padding:56,gap:24,background:"#ffffff"},"vertical");next=moveInto(next,add("text","Section title","핵심 기능",{fontSize:36,fontWeight:800}),id);
    const grid=add("stack","Feature cards",undefined,{width:928,gap:16,columns:3},"grid");next=moveInto(next,grid,id);for(const label of ["빠른 구성","유연한 레이아웃","반응형 디자인"]){const card=add("stack",`${label} card`,undefined,{minHeight:180,padding:24,gap:12,radius:16,background:"#f3f4f6"},"vertical");next=moveInto(next,card,grid);next=moveInto(next,add("text",label,label,{fontSize:20,fontWeight:750}),card);next=moveInto(next,add("text",`${label} 설명`,"내용을 자유롭게 수정해 보세요.",{fontSize:15,color:"#6b7280"}),card);}
  }
  if(preset==="cta"){
    const id=add("stack","Call to action",undefined,{width:1040,padding:56,gap:20,radius:20,background:"#111827",color:"#ffffff",align:"center"},"vertical");next=moveInto(next,add("text","CTA title","다음 페이지를 함께 만들어 볼까요?",{fontSize:36,fontWeight:800,color:"#ffffff",textAlign:"center"}),id);next=moveInto(next,add("button","CTA button","문의하기",{padding:14,radius:10,background:"#ffffff",color:"#111827",fontWeight:700}),id);
  }
  if(preset==="footer"){
    const id=add("stack","Footer",undefined,{width:1040,padding:32,gap:24,justify:"between",align:"center",background:"#111827"},"horizontal");next=moveInto(next,add("text","Footer brand","BRAND",{fontSize:18,fontWeight:800,color:"#ffffff"}),id);next=moveInto(next,add("text","Copyright","© 2026 All rights reserved.",{fontSize:13,color:"#9ca3af"}),id);
  }
  return next;
}

function moveInto(document:DesignDocument,nodeId:string,parentId:string):DesignDocument{
  const node=document.nodes[nodeId];const oldParent=node?.parentId;if(!node||!document.nodes[parentId])return document;const nodes={...document.nodes,[nodeId]:{...node,parentId}};
  if(oldParent&&nodes[oldParent])nodes[oldParent]={...nodes[oldParent],childIds:nodes[oldParent].childIds.filter(id=>id!==nodeId)};
  nodes[parentId]={...nodes[parentId],childIds:[...nodes[parentId].childIds,nodeId]};return {...document,nodes,updatedAt:new Date().toISOString()};
}

export function updateDesignNode(document:DesignDocument,id:string,changes:Partial<DesignNode>):DesignDocument {
  const current=document.nodes[id];if(!current)return document;
  return {...document,nodes:{...document.nodes,[id]:{...current,...changes,id}},updatedAt:new Date().toISOString()};
}

export function removeDesignNode(document:DesignDocument,id:string):DesignDocument {
  if(!document.nodes[id])return document;
  const remove=new Set<string>();const visit=(nodeId:string)=>{remove.add(nodeId);document.nodes[nodeId]?.childIds.forEach(visit);};visit(id);
  const nodes=Object.fromEntries(Object.entries(document.nodes).filter(([nodeId])=>!remove.has(nodeId)).map(([nodeId,node])=>[nodeId,{...node,childIds:node.childIds.filter(child=>!remove.has(child))}]));
  const pages=document.pages.map(page=>({...page,rootIds:page.rootIds.filter(root=>!remove.has(root))}));
  return {...document,nodes,pages,updatedAt:new Date().toISOString()};
}

export function compileDesignDocument(document:DesignDocument):{tsx:string;css:string;html:string} {
  const page=document.pages.find(item=>item.id===document.activePageId)??document.pages[0];
  const render=(id:string,depth:number):string=>{
    const node=document.nodes[id];if(!node||node.hidden)return "";
    const indent="  ".repeat(depth);const children=node.childIds.map(child=>render(child,depth+1)).filter(Boolean).join("\n");
    const cls=`polazu-${safeName(node.name)}-${id.slice(0,6)}`;
    if(node.kind==="text")return `${indent}<p className="${cls}">${escapeJsx(node.text??"")}</p>`;
    if(node.kind==="image")return `${indent}<img className="${cls}" src=${JSON.stringify(node.src??"/placeholder.svg")} alt=${JSON.stringify(node.alt??"")} />`;
    if(node.kind==="button")return `${indent}<a className="${cls}" href=${JSON.stringify(node.href??"#")}>${escapeJsx(node.text??"Button")}</a>`;
    if(node.kind==="input")return `${indent}<input className="${cls}" placeholder=${JSON.stringify(node.text??"")} />`;
    const tag=node.kind==="frame"?"main":"div";
    return `${indent}<${tag} className="${cls}">${children?`\n${children}\n${indent}`:""}</${tag}>`;
  };
  const roots=page.rootIds.map(id=>render(id,2)).filter(Boolean).join("\n");
  const tsx=`import "./generated.css";\n\nexport default function GeneratedPage() {\n  return (\n    <>\n${roots}\n    </>\n  );\n}\n`;
  const css=`html { background: #f3f4f6; }\nbody { min-height: 100vh; margin: 0; }\n\n${Object.values(document.nodes).map(node=>compileNodeCss(node)).join("\n\n")}${compileResponsiveCss(document)}`;
  const htmlRoots=page.rootIds.map(id=>renderHtml(document,id,2)).filter(Boolean).join("\n");
  const html=`<!doctype html>\n<html lang="ko">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <title>${escapeHtml(document.name)}</title>\n  <link rel="stylesheet" href="/styles.css" />\n</head>\n<body>\n${htmlRoots}\n</body>\n</html>\n`;
  return {tsx,css,html};
}

function renderHtml(document:DesignDocument,id:string,depth:number):string {
  const node=document.nodes[id];if(!node||node.hidden)return "";const indent="  ".repeat(depth);const cls=`polazu-${safeName(node.name)}-${id.slice(0,6)}`;const children=node.childIds.map(child=>renderHtml(document,child,depth+1)).filter(Boolean).join("\n");
  if(node.kind==="text")return `${indent}<p class="${cls}">${escapeHtml(node.text??"")}</p>`;
  if(node.kind==="image")return `${indent}<img class="${cls}" src="${escapeHtml(node.src??"/placeholder.svg")}" alt="${escapeHtml(node.alt??"")}" />`;
  if(node.kind==="button")return `${indent}<a class="${cls}" href="${escapeHtml(node.href??"#")}">${escapeHtml(node.text??"Button")}</a>`;
  if(node.kind==="input")return `${indent}<input class="${cls}" placeholder="${escapeHtml(node.text??"")}" />`;
  const tag=node.kind==="frame"?"main":"div";return `${indent}<${tag} class="${cls}">${children?`\n${children}\n${indent}`:""}</${tag}>`;
}

function compileNodeCss(node:DesignNode){
  const cls=`.polazu-${safeName(node.name)}-${node.id.slice(0,6)}`;const declarations=styleDeclarations(node.style,node);
  return `${cls} {\n${declarations.map(value=>`  ${value}`).join("\n")}\n}`;
}
function compileResponsiveCss(document:DesignDocument){
  const blocks=([['tablet',1024],['mobile',640]] as const).map(([target,max])=>{const rules=Object.values(document.nodes).filter(node=>node.responsive?.[target]).map(node=>`.polazu-${safeName(node.name)}-${node.id.slice(0,6)} {\n${styleDeclarations(node.responsive![target]!,node).map(value=>`    ${value}`).join("\n")}\n  }`).join("\n  ");return rules?`\n\n@media (max-width: ${max}px) {\n  ${rules}\n}`:"";});return blocks.join("");
}
function styleDeclarations(style:DesignStyle,node:DesignNode){
  const values:string[]=["box-sizing: border-box;"];
  // A root node's x/y belongs to the infinite design canvas, not the shipped page.
  if(node.parentId===null)values.push("position: relative;","max-width: 100%;","margin: 0 auto;");
  if(node.layout!=="free"){values.push(node.layout==="grid"?"display: grid;":"display: flex;");if(node.layout==="horizontal")values.push("flex-direction: row;");if(node.layout==="vertical")values.push("flex-direction: column;");}
  const map:Record<string,string>={width:"width",height:"height",minWidth:"min-width",minHeight:"min-height",padding:"padding",gap:"gap",radius:"border-radius",opacity:"opacity",background:"background",color:"color",borderColor:"border-color",borderWidth:"border-width",fontFamily:"font-family",fontSize:"font-size",fontWeight:"font-weight",lineHeight:"line-height",textAlign:"text-align",shadow:"box-shadow",overflow:"overflow"};
  for(const [key,css] of Object.entries(map)){const value=style[key as keyof DesignStyle];if(value==null)continue;const px=["width","height","minWidth","minHeight","padding","gap","radius","borderWidth","fontSize"].includes(key)&&typeof value==="number"?`${value}px`:value;values.push(`${css}: ${px};`);}
  if(style.rotation)values.push(`transform: rotate(${style.rotation}deg);`);if(style.columns)values.push(`grid-template-columns: repeat(${style.columns}, minmax(0, 1fr));`);
  if(style.justify)values.push(`justify-content: ${{start:"flex-start",center:"center",end:"flex-end",between:"space-between"}[style.justify]};`);
  if(style.align)values.push(`align-items: ${{start:"flex-start",center:"center",end:"flex-end",stretch:"stretch"}[style.align]};`);
  if(style.borderWidth)values.push("border-style: solid;");
  return values;
}
function safeName(value:string){return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g,"-").replace(/^-|-$/g,"")||"layer";}
function escapeJsx(value:string){return value.replace(/[{}]/g,match=>match==="{"?"&#123;":"&#125;");}
function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]!));}

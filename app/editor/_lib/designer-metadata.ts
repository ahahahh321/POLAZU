export const DESIGNER_METADATA_PATH = "/.polazu/designer.json";

export type WorkbenchItem = { id:string; kind:string; x:number; y:number; width:number; height:number };

export type DesignerMetadata = {
  version:1;
  zoom:number;
  grid:boolean;
  rulers:boolean;
  snap:boolean;
  wireframe:boolean;
  leftWidth:number;
  rightWidth:number;
  verticalGuides:number[];
  horizontalGuides:number[];
  workbenchItems:WorkbenchItem[];
  layerAliases:Record<string,string>;
  lockedSelectors:string[];
};

export type LayerMetadata = Pick<DesignerMetadata, "layerAliases" | "lockedSelectors">;

const FALLBACK: DesignerMetadata = {
  version:1,
  zoom:68,
  grid:true,
  rulers:true,
  snap:true,
  wireframe:false,
  leftWidth:316,
  rightWidth:360,
  verticalGuides:[],
  horizontalGuides:[],
  workbenchItems:[],
  layerAliases:{},
  lockedSelectors:[],
};

export function parseDesignerMetadata(raw:string|undefined):DesignerMetadata {
  if (!raw) return { ...FALLBACK };
  try {
    const value = JSON.parse(raw) as Partial<DesignerMetadata>;
    const layer = normalizeLayerMetadata(value);
    return {
      version:1,
      zoom:finite(value.zoom,68,20,200),
      grid:value.grid!==false,
      rulers:value.rulers!==false,
      snap:value.snap!==false,
      wireframe:value.wireframe===true,
      leftWidth:finite(value.leftWidth,316,210,520),
      rightWidth:finite(value.rightWidth,360,250,560),
      verticalGuides:numberList(value.verticalGuides),
      horizontalGuides:numberList(value.horizontalGuides),
      workbenchItems:Array.isArray(value.workbenchItems)
        ? value.workbenchItems.filter(item=>item&&typeof item.id==="string"&&typeof item.kind==="string").slice(0,200).map(item=>({
          ...item,
          x:finite(item.x,40,-10000,10000),
          y:finite(item.y,40,-10000,10000),
          width:finite(item.width,180,24,4000),
          height:finite(item.height,100,24,4000),
        }))
        : [],
      ...layer,
    };
  } catch {
    return { ...FALLBACK };
  }
}

export function normalizeLayerMetadata(value:unknown):LayerMetadata {
  if (!value || typeof value !== "object") return { layerAliases:{}, lockedSelectors:[] };
  const input = value as {layerAliases?:unknown;lockedSelectors?:unknown};
  const aliases:Record<string,string> = {};
  if (input.layerAliases && typeof input.layerAliases === "object" && !Array.isArray(input.layerAliases)) {
    for (const [selector, alias] of Object.entries(input.layerAliases)) {
      if (safeSelector(selector) && typeof alias === "string" && alias.trim() && alias.length <= 80) aliases[selector] = alias.trim();
      if (Object.keys(aliases).length >= 1000) break;
    }
  }
  const lockedSelectors = Array.isArray(input.lockedSelectors)
    ? [...new Set(input.lockedSelectors.filter((selector):selector is string=>safeSelector(selector)))].slice(0,1000)
    : [];
  return { layerAliases:aliases, lockedSelectors };
}

function safeSelector(value:unknown):value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 2000 && !/[\r\n\0]/.test(value);
}

function finite(value:unknown,fallback:number,min:number,max:number) {
  const number=Number(value);
  return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;
}

function numberList(value:unknown) {
  return Array.isArray(value)?value.map(Number).filter(item=>Number.isFinite(item)&&item>=0&&item<=10000).slice(0,100):[];
}

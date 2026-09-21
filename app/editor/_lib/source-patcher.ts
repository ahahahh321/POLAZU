import type { Edit, FileChange, ResponsiveTarget } from "./types";

type SourceRef = { path: string; line: number; column: number };
type Range = { start: number; openEnd: number; end: number; tag: string; selfClosing: boolean };

const SAFE_STYLE_NAME = /^[a-zA-Z][a-zA-Z0-9]*$/;
const TEXT_ESCAPES = /[<>{}]/;
const SAFE_ATTRIBUTE = /^(?:id|className|class|href|src|alt|title|role|target|rel|type|name|placeholder|aria-[a-z-]+|data-[a-z-]+)$/;
const SAFE_REPARENT_TARGETS = new Set(["body","main","section","article","aside","header","footer","nav","div","form","fieldset","ul","ol","li","figure","blockquote","details","dialog"]);

export function parseSourceRef(value: string | undefined): SourceRef | null {
  if (!value) return null;
  const match = value.match(/^(.*):(\d+):(\d+)$/);
  if (!match) return null;
  const line = Number(match[2]);
  const column = Number(match[3]);
  if (!match[1].startsWith("/") || !Number.isInteger(line) || !Number.isInteger(column) || line < 1 || column < 0) return null;
  return { path: match[1], line, column };
}

function offsetAt(source: string, line: number, column: number) {
  let offset = 0;
  for (let current = 1; current < line; current += 1) {
    const next = source.indexOf("\n", offset);
    if (next < 0) return -1;
    offset = next + 1;
  }
  return Math.min(source.length, offset + column);
}

function scanOpeningEnd(source: string, start: number) {
  let quote = "";
  let braceDepth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const previous = source[index - 1];
    if (quote) {
      if (char === quote && previous !== "\\") quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") braceDepth += 1;
    else if (char === "}") braceDepth = Math.max(0, braceDepth - 1);
    else if (char === ">" && braceDepth === 0) return index + 1;
  }
  return -1;
}

function findMappedRange(source: string, ref: SourceRef): Range | null {
  const expected = offsetAt(source, ref.line, ref.column);
  if (expected < 0) return null;
  let start = source.indexOf("<", Math.max(0, expected - 2));
  if (start < 0 || start - expected > 180) return null;
  const nameMatch = source.slice(start + 1).match(/^([a-z][\w:-]*)\b/);
  if (!nameMatch) return null;
  const tag = nameMatch[1];
  const openEnd = scanOpeningEnd(source, start);
  if (openEnd < 0) return null;
  const selfClosing = /\/\s*>$/.test(source.slice(start, openEnd));
  if (selfClosing) return { start, openEnd, end: openEnd, tag, selfClosing };

  const token = new RegExp(`<\\/?${escapeRegExp(tag)}\\b`, "g");
  token.lastIndex = openEnd;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = token.exec(source))) {
    const tokenStart = match.index;
    const tokenEnd = scanOpeningEnd(source, tokenStart);
    if (tokenEnd < 0) return null;
    const raw = source.slice(tokenStart, tokenEnd);
    if (raw.startsWith("</")) depth -= 1;
    else if (!/\/\s*>$/.test(raw)) depth += 1;
    if (depth === 0) return { start, openEnd, end: tokenEnd, tag, selfClosing: false };
    token.lastIndex = tokenEnd;
  }
  return null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findAttribute(opening: string, name: string): { start: number; end: number; valueStart: number; valueEnd: number } | null {
  const regex = new RegExp(`\\s${escapeRegExp(name)}\\s*=\\s*`, "g");
  const match = regex.exec(opening);
  if (!match) return null;
  const start = match.index;
  let cursor = regex.lastIndex;
  if (opening[cursor] === "{") {
    const valueStart = cursor;
    let depth = 0;
    let quote = "";
    for (; cursor < opening.length; cursor += 1) {
      const char = opening[cursor];
      const previous = opening[cursor - 1];
      if (quote) {
        if (char === quote && previous !== "\\") quote = "";
        continue;
      }
      if (char === '"' || char === "'" || char === "`") quote = char;
      else if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) return { start, end: cursor + 1, valueStart, valueEnd: cursor + 1 };
      }
    }
    return null;
  }
  const quote = opening[cursor];
  if (quote !== '"' && quote !== "'") return null;
  const valueStart = cursor;
  cursor += 1;
  while (cursor < opening.length) {
    if (opening[cursor] === quote && opening[cursor - 1] !== "\\") return { start, end: cursor + 1, valueStart, valueEnd: cursor + 1 };
    cursor += 1;
  }
  return null;
}

function serializeStyles(styles: Record<string, string>) {
  return Object.entries(styles)
    .filter(([name, value]) => SAFE_STYLE_NAME.test(name) && typeof value === "string" && value.length < 250 && !/expression\s*\(|javascript:/i.test(value))
    .map(([name, value]) => `${name}: ${JSON.stringify(value)}`)
    .join(", ");
}

function upsertJsStyleProperties(inner:string,styles:Record<string,string>){
  let next=inner.trim().replace(/,\s*$/,"");
  for(const [name,value] of Object.entries(styles)){
    if(!SAFE_STYLE_NAME.test(name)||typeof value!=="string"||value.length>=250||/expression\s*\(|javascript:/i.test(value))continue;
    const declaration=`${name}: ${JSON.stringify(value)}`;
    const pattern=new RegExp(`(^|,)\\s*${escapeRegExp(name)}\\s*:\\s*(?:"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*'|\\\`(?:\\\\.|[^\\\`\\\\])*\\\`|[^,}]+)`);
    if(pattern.test(next))next=next.replace(pattern,(_,prefix)=>`${prefix} ${declaration}`);
    else next+=`${next?", ":""}${declaration}`;
  }
  return next;
}

function mergeStyle(opening: string, styles: Record<string, string>) {
  const serialized = serializeStyles(styles);
  if (!serialized) return opening;
  const attribute = findAttribute(opening, "style");
  if (!attribute) {
    const insertion = opening.match(/\/?>\s*$/)?.index ?? opening.length;
    return opening.slice(0, insertion) + ` style={{ ${serialized} }}` + opening.slice(insertion);
  }
  const raw = opening.slice(attribute.valueStart, attribute.valueEnd);
  let nextValue: string;
  if (raw.startsWith("{{") && raw.endsWith("}}")) {
    const inner = raw.slice(2, -2).trim();
    nextValue = `{{ ${upsertJsStyleProperties(inner,styles)} }}`;
  } else if (raw.startsWith("{") && raw.endsWith("}")) {
    const expression = raw.slice(1, -1).trim();
    nextValue = `{{ ...(${expression} || {}), ${serialized} }}`;
  } else {
    nextValue = `{{ ${serialized} }}`;
  }
  return opening.slice(0, attribute.valueStart) + nextValue + opening.slice(attribute.valueEnd);
}

function mergeAttribute(opening: string, name: string, value: string) {
  if (!SAFE_ATTRIBUTE.test(name) || value.length > 1000 || /[<>]/.test(value)) return null;
  const existing = findAttribute(opening, name);
  const serialized = JSON.stringify(value);
  if (!existing) {
    const insertion = opening.match(/\/?>\s*$/)?.index ?? opening.length;
    return opening.slice(0, insertion) + ` ${name}=${serialized}` + opening.slice(insertion);
  }
  const raw = opening.slice(existing.valueStart, existing.valueEnd);
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")) || /^\{(["']).*\1\}$/s.test(raw)) {
    return opening.slice(0, existing.valueStart) + serialized + opening.slice(existing.valueEnd);
  }
  return null;
}

function replacePlainText(source: string, range: Range, text: string) {
  if (range.selfClosing || TEXT_ESCAPES.test(text)) return null;
  const closeStart = source.lastIndexOf(`</${range.tag}`, range.end);
  if (closeStart < range.openEnd) return null;
  const between = source.slice(range.openEnd, closeStart);
  if (/[<{]/.test(between)) return null;
  return source.slice(0, range.openEnd) + text + source.slice(closeStart);
}

function patchMappedReparent(source: string, edit: Edit, range: Range, ref: SourceRef) {
  const operation = edit.operation;
  if (operation?.type !== "reparent") return { source, applied:false };
  const targetRef = parseSourceRef(operation.targetParentSourceId);
  if (!targetRef) return { source, applied:false, warning:"옮길 컨테이너의 소스 위치 정보가 없어 원본 코드는 변경하지 않았습니다." };
  if (targetRef.path !== ref.path) return { source, applied:false, warning:"서로 다른 파일 사이의 요소 이동은 미리보기에만 반영했습니다." };
  const targetRange = findMappedRange(source, targetRef);
  if (!targetRange) return { source, applied:false, warning:"소스에서 옮길 컨테이너를 다시 찾지 못해 원본 코드는 변경하지 않았습니다." };
  if (targetRange.selfClosing || !SAFE_REPARENT_TARGETS.has(targetRange.tag.toLowerCase())) {
    return { source, applied:false, warning:"자식을 받을 수 있는 안전한 컨테이너가 아니어서 원본 코드는 변경하지 않았습니다." };
  }
  if (targetRange.start >= range.start && targetRange.end <= range.end) {
    return { source, applied:false, warning:"요소를 자기 자식 안으로 옮길 수 없어 원본 코드는 변경하지 않았습니다." };
  }
  const sourceLineStart = source.lastIndexOf("\n", range.start - 1) + 1;
  const sourceLineEndIndex = source.indexOf("\n", range.end);
  const sourceLineEnd = sourceLineEndIndex < 0 ? source.length : sourceLineEndIndex;
  if (source.slice(sourceLineStart, range.start).trim() || source.slice(range.end, sourceLineEnd).trim()) {
    return { source, applied:false, warning:"조건식이나 인라인 표현식에 포함된 요소는 안전하게 이동할 수 없어 원본 코드를 유지했습니다." };
  }
  const targetCloseStart = source.lastIndexOf(`</${targetRange.tag}`, targetRange.end);
  if (targetCloseStart < targetRange.openEnd) return { source, applied:false, warning:"옮길 컨테이너의 닫는 태그를 찾지 못했습니다." };
  const targetCloseLineStart = source.lastIndexOf("\n", targetCloseStart - 1) + 1;
  const closeOnOwnLine = !source.slice(targetCloseLineStart, targetCloseStart).trim();
  const targetInsertionStart = closeOnOwnLine ? targetCloseLineStart : targetCloseStart;

  const oldIndent = lineIndent(source, range.start);
  const targetIndent = `${lineIndent(source, targetRange.start)}  `;
  const parentIndent = lineIndent(source, targetRange.start);
  const block = source.slice(range.start, range.end);
  const movedBlock = block.split("\n").map((line, index) => {
    const content = index === 0 ? line : line.startsWith(oldIndent) ? line.slice(oldIndent.length) : line.trimStart();
    return `${targetIndent}${content}`;
  }).join("\n");
  const removalEnd = sourceLineEndIndex < 0 ? sourceLineEnd : sourceLineEndIndex + 1;
  const removedLength = removalEnd - sourceLineStart;
  const withoutSource = source.slice(0, sourceLineStart) + source.slice(removalEnd);
  const insertionAt = targetInsertionStart - (sourceLineStart < targetInsertionStart ? removedLength : 0);
  if (insertionAt < 0 || insertionAt > withoutSource.length) return { source, applied:false, warning:"요소 이동 위치를 안전하게 계산하지 못했습니다." };
  const insertion = `${closeOnOwnLine ? "" : "\n"}${movedBlock}\n${closeOnOwnLine ? "" : parentIndent}`;
  return { source:withoutSource.slice(0, insertionAt) + insertion + withoutSource.slice(insertionAt), applied:true };
}

function patchMappedSource(source: string, edit: Edit) {
  const ref = parseSourceRef(edit.sourceId);
  if (!ref) return { source, applied: false, warning: "소스 위치 정보가 없습니다." };
  const range = findMappedRange(source, ref);
  if (!range) return { source, applied: false, warning: "소스에서 선택 요소를 다시 찾지 못했습니다." };

  if (edit.operation?.type === "delete") {
    return { source: source.slice(0, range.start) + source.slice(range.end), applied: true };
  }
  if (edit.operation?.type === "duplicate") {
    const block = source.slice(range.start, range.end);
    return { source: source.slice(0, range.end) + "\n" + block + source.slice(range.end), applied: true };
  }
  if (edit.operation?.type === "insert") {
    if (range.selfClosing) return { source, applied: false, warning: "자식 요소를 넣을 수 없는 self-closing 요소입니다." };
    const closeStart = source.lastIndexOf(`</${range.tag}`, range.end);
    if (closeStart < range.openEnd) return { source, applied: false, warning: "닫는 태그를 찾지 못했습니다." };
    const indent = lineIndent(source, range.start) + "  ";
    const snippet = edit.operation.jsx.split("\n").map(line => indent + line).join("\n");
    return { source: source.slice(0, closeStart) + `\n${snippet}\n${lineIndent(source, range.start)}` + source.slice(closeStart), applied: true };
  }
  if (edit.operation?.type === "reparent") return patchMappedReparent(source, edit, range, ref);
  if (edit.operation?.type === "reorder") {
    return { source, applied: false, warning: "형제 요소 순서 변경은 미리보기에는 반영됐지만 안전한 소스 재배치는 아직 지원하지 않습니다." };
  }

  let next = source;
  let currentRange = range;
  if (edit.attributes && Object.keys(edit.attributes).length) {
    let opening = next.slice(currentRange.start, currentRange.openEnd);
    const originalOpening = opening;
    for (const [name, value] of Object.entries(edit.attributes)) {
      const patched = mergeAttribute(opening, name, value);
      if (!patched) return { source: next, applied: next !== source, warning: `${name} 속성은 동적 표현식이라 안전하게 바꾸지 않았습니다.` };
      opening = patched;
    }
    next = next.slice(0, currentRange.start) + opening + next.slice(currentRange.openEnd);
    const delta = opening.length - originalOpening.length;
    currentRange = { ...currentRange, openEnd: currentRange.openEnd + delta, end: currentRange.end + delta };
  }
  if (edit.styles && Object.keys(edit.styles).length) {
    const opening = next.slice(currentRange.start, currentRange.openEnd);
    const patchedOpening = mergeStyle(opening, edit.styles);
    next = next.slice(0, currentRange.start) + patchedOpening + next.slice(currentRange.openEnd);
    const delta = patchedOpening.length - opening.length;
    currentRange = { ...currentRange, openEnd: currentRange.openEnd + delta, end: currentRange.end + delta };
  }
  if (typeof edit.text === "string") {
    const textPatched = replacePlainText(next, currentRange, edit.text);
    if (textPatched) next = textPatched;
    else return { source: next, applied: next !== source, warning: "복합 자식이 있는 텍스트는 자동으로 바꾸지 않았습니다." };
  }
  return { source: next, applied: next !== source };
}

function lineIndent(source: string, offset: number) {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  return source.slice(lineStart, offset).match(/^\s*/)?.[0] ?? "";
}

function escapeHtmlText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value: string) {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function mergeHtmlAttribute(opening: string, rawName: string, value: string) {
  const name = rawName === "className" ? "class" : rawName;
  if (!SAFE_ATTRIBUTE.test(rawName) || value.length > 1000 || /[<>]/.test(value)) return null;
  const existing = findAttribute(opening, name);
  const serialized = `"${escapeHtmlAttribute(value)}"`;
  if (!existing) {
    const insertion = opening.match(/\/?>\s*$/)?.index ?? opening.length;
    return opening.slice(0, insertion) + ` ${name}=${serialized}` + opening.slice(insertion);
  }
  const raw = opening.slice(existing.valueStart, existing.valueEnd);
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    return opening.slice(0, existing.valueStart) + serialized + opening.slice(existing.valueEnd);
  }
  return null;
}

function mergeHtmlStyle(opening: string, styles: Record<string, string>) {
  const declarations = Object.entries(styles)
    .filter(([name, value]) => SAFE_STYLE_NAME.test(name) && typeof value === "string" && value.length < 250)
    .map(([name, value]) => `${camelToKebab(name)}: ${sanitizeCssValue(value)}`)
    .filter(Boolean)
    .join("; ");
  if (!declarations) return opening;
  const existing = findAttribute(opening, "style");
  if (!existing) {
    const insertion = opening.match(/\/?>\s*$/)?.index ?? opening.length;
    return opening.slice(0, insertion) + ` style="${escapeHtmlAttribute(declarations)}"` + opening.slice(insertion);
  }
  const raw = opening.slice(existing.valueStart, existing.valueEnd);
  if (!((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))) return opening;
  const current = raw.slice(1, -1).trim();const entries=new Map<string,string>();
  for(const part of current.split(";")){const index=part.indexOf(":");if(index>0)entries.set(part.slice(0,index).trim().toLowerCase(),part.slice(index+1).trim());}
  for(const [name,value] of Object.entries(styles)){if(SAFE_STYLE_NAME.test(name)&&typeof value==="string"&&value.length<250)entries.set(camelToKebab(name),sanitizeCssValue(value));}
  const serialized=[...entries].map(([name,value])=>`${name}: ${value}`).join("; ");
  return opening.slice(0, existing.valueStart) + `"${escapeHtmlAttribute(serialized)}"` + opening.slice(existing.valueEnd);
}

function patchInsertedHtml(html: string, edit: Edit) {
  const range = findMappedRange(html, { path:"/__polazu_insert.html", line:1, column:0 });
  if (!range) return { source:html, applied:false };
  let next = html;
  let currentRange = range;
  if (edit.attributes && Object.keys(edit.attributes).length) {
    let opening = next.slice(currentRange.start, currentRange.openEnd);
    const original = opening;
    for (const [name, value] of Object.entries(edit.attributes)) {
      const patched = mergeHtmlAttribute(opening, name, value);
      if (!patched) return { source:next, applied:next !== html };
      opening = patched;
    }
    next = next.slice(0, currentRange.start) + opening + next.slice(currentRange.openEnd);
    const delta = opening.length - original.length;
    currentRange = { ...currentRange, openEnd:currentRange.openEnd + delta, end:currentRange.end + delta };
  }
  if (edit.styles && Object.keys(edit.styles).length) {
    const opening = next.slice(currentRange.start, currentRange.openEnd);
    const patched = mergeHtmlStyle(opening, edit.styles);
    next = next.slice(0, currentRange.start) + patched + next.slice(currentRange.openEnd);
    const delta = patched.length - opening.length;
    currentRange = { ...currentRange, openEnd:currentRange.openEnd + delta, end:currentRange.end + delta };
  }
  if (typeof edit.text === "string") {
    if (currentRange.selfClosing) return { source:next, applied:next !== html };
    const closeStart = next.lastIndexOf(`</${currentRange.tag}`, currentRange.end);
    const between = next.slice(currentRange.openEnd, closeStart);
    if (closeStart < currentRange.openEnd || /</.test(between)) return { source:next, applied:next !== html };
    next = next.slice(0, currentRange.openEnd) + escapeHtmlText(edit.text) + next.slice(closeStart);
  }
  return { source:next, applied:next !== html };
}

function patchInsertedJsx(jsx: string, edit: Edit) {
  return patchMappedSource(jsx, { ...edit, sourceId:"/__polazu_insert.tsx:1:0", generatedId:undefined, operation:undefined });
}

function addClassToInsertedJsx(jsx: string, className: string) {
  const range = findMappedRange(jsx, { path:"/__polazu_insert.tsx", line:1, column:0 });
  if (!range) return null;
  const opening = jsx.slice(range.start, range.openEnd);
  const patched = addStaticClass(opening, className);
  return patched ? jsx.slice(0, range.start) + patched + jsx.slice(range.openEnd) : null;
}

function addClassToInsertedHtml(html: string, className: string) {
  const range = findMappedRange(html, { path:"/__polazu_insert.html", line:1, column:0 });
  if (!range) return null;
  const opening = html.slice(range.start, range.openEnd);
  const attribute = findAttribute(opening, "class");
  let patched: string | null;
  if (!attribute) patched = mergeHtmlAttribute(opening, "class", className);
  else {
    const raw = opening.slice(attribute.valueStart, attribute.valueEnd);
    if (!((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))) return null;
    const value = raw.slice(1, -1);
    patched = mergeHtmlAttribute(opening, "class", `${value} ${className}`.trim());
  }
  return patched ? html.slice(0, range.start) + patched + html.slice(range.openEnd) : null;
}

function consolidateEdits(edits: Edit[]) {
  const normalized = edits.map(edit => edit.operation?.type === "insert" ? { ...edit, operation:{ ...edit.operation } } : { ...edit });
  const insertById = new Map<string, Edit>();
  const cancelled = new Set(normalized.filter(edit => edit.operation?.type === "delete" && edit.generatedId).map(edit => edit.generatedId!));
  for (const edit of normalized) if (edit.operation?.type === "insert" && edit.id) insertById.set(edit.id, edit);

  const result: Edit[] = [];
  const warnings: string[] = [];
  const styleByKey = new Map<string, Edit>();
  const reparentByKey = new Map<string, Edit>();
  for (const edit of normalized) {
    if (edit.operation?.type === "insert") {
      if (!edit.id || !cancelled.has(edit.id)) result.push(edit);
      continue;
    }
    if (edit.generatedId && cancelled.has(edit.generatedId)) continue;
    const inserted = edit.generatedId ? insertById.get(edit.generatedId) : undefined;
    if (inserted?.operation?.type === "insert") {
      if (edit.operation?.type === "delete") continue;
      if (edit.operation?.type === "reparent") {
        inserted.selector = edit.operation.targetParentSelector;
        inserted.sourceId = edit.operation.targetParentSourceId;
        inserted.operation = {
          ...inserted.operation,
          parentSelector:edit.operation.targetParentSelector,
          parentSourceId:edit.operation.targetParentSourceId,
        };
        continue;
      }
      if (edit.operation?.type === "duplicate") {
        if (edit.id && !cancelled.has(edit.id)) {
          const duplicate: Edit = { ...inserted, id:edit.id, generatedId:undefined, operation:{ ...inserted.operation } };
          insertById.set(edit.id, duplicate);
          result.push(duplicate);
        }
        continue;
      }
      if (!edit.operation && edit.responsive && edit.responsive !== "base") {
        const className = `polazu-g-${stableHash(edit.generatedId!)}`;
        const jsx = addClassToInsertedJsx(inserted.operation.jsx, className);
        const html = addClassToInsertedHtml(inserted.operation.html, className);
        if (jsx && html) {
          inserted.operation = { ...inserted.operation, jsx, html };
          result.push({ ...edit, selector:`.${className}`, sourceId:undefined, generatedId:undefined });
          continue;
        }
        warnings.push("새로 삽입한 요소의 반응형 식별 class를 안전하게 생성하지 못했습니다.");
      } else if (!edit.operation) {
        const jsx = patchInsertedJsx(inserted.operation.jsx, edit);
        const html = patchInsertedHtml(inserted.operation.html, edit);
        if (jsx.applied && html.applied) {
          inserted.operation = { ...inserted.operation, jsx:jsx.source, html:html.source };
          continue;
        }
        warnings.push("새로 삽입한 요소의 추가 스타일을 snippet에 합치지 못했습니다. 먼저 삽입을 저장한 뒤 다시 편집하세요.");
      }
    }
    if (edit.operation?.type === "reparent") {
      const key = edit.sourceId ?? edit.operation.sourceSelector;
      const previous = reparentByKey.get(key);
      if (previous?.operation?.type === "reparent") {
        previous.id = edit.id;
        previous.operation = { ...edit.operation };
      } else {
        reparentByKey.set(key, edit);
        result.push(edit);
      }
      continue;
    }
    if (edit.operation?.type === "delete") {
      const key = edit.sourceId ?? edit.selector;
      const previous = reparentByKey.get(key);
      if (previous) {
        previous.id = edit.id;
        previous.operation = { ...edit.operation };
        reparentByKey.delete(key);
        continue;
      }
    }
    if (edit.operation) {
      result.push(edit);
      continue;
    }
    const key = `${edit.sourceId ?? edit.selector}|${edit.responsive ?? "base"}`;
    const previous = styleByKey.get(key);
    if (!previous) {
      const clone = { ...edit, styles: { ...(edit.styles ?? {}) }, attributes:{ ...(edit.attributes ?? {}) } };
      styleByKey.set(key, clone);
      result.push(clone);
    } else {
      previous.styles = { ...(previous.styles ?? {}), ...(edit.styles ?? {}) };
      previous.attributes = { ...(previous.attributes ?? {}), ...(edit.attributes ?? {}) };
      if (typeof edit.text === "string") previous.text = edit.text;
    }
  }
  return { edits:result, warnings };
}

function addResponsiveRules(files: Record<string, string>, edits: Edit[]) {
  const responsive = edits.filter(edit => edit.responsive && edit.responsive !== "base" && edit.styles && Object.keys(edit.styles).length);
  if (!responsive.length) return { files, warnings: [] as string[] };
  const next = { ...files };
  const cssPath = chooseGlobalCss(next);
  if (!cssPath) return { files, warnings: ["반응형 규칙을 연결할 전역 CSS 파일을 찾지 못했습니다."] };
  const markerStart = "/* POLAZU_RESPONSIVE_START */";
  const markerEnd = "/* POLAZU_RESPONSIVE_END */";
  const groups = parseResponsiveRules(next[cssPath], markerStart, markerEnd);
  const warnings: string[] = [];

  for (const edit of responsive) {
    let ruleSelector = edit.selector;
    const ref = parseSourceRef(edit.sourceId);
    if (ref && next[ref.path] != null) {
      const mapped = findMappedRange(next[ref.path], ref);
      if (mapped) {
        const opening = next[ref.path].slice(mapped.start, mapped.openEnd);
        const className = findResponsiveClass(opening) ?? `polazu-r-${stableHash(edit.sourceId ?? edit.selector)}`;
        const patched = addStaticClass(opening, className);
        if (patched) {
          next[ref.path] = next[ref.path].slice(0, mapped.start) + patched + next[ref.path].slice(mapped.openEnd);
          ruleSelector = `.${className}`;
        } else warnings.push(`${ref.path}: 동적 className을 안전하게 합칠 수 없어 현재 DOM 선택자로 반응형 규칙을 기록했습니다.`);
      } else warnings.push(`${ref.path}: 반응형 클래스 삽입 위치를 다시 찾지 못해 현재 DOM 선택자를 사용했습니다.`);
    }
    const target = edit.responsive as Exclude<ResponsiveTarget, "base">;
    const rule = groups[target].get(ruleSelector) ?? new Map<string, string>();
    for (const [name, value] of Object.entries(edit.styles ?? {})) {
      if (SAFE_STYLE_NAME.test(name) && typeof value === "string") rule.set(camelToKebab(name), sanitizeCssValue(value));
    }
    if (rule.size) groups[target].set(ruleSelector, rule);
  }
  const blocks = [
    serializeResponsiveGroup("@media (min-width: 1024px)", groups.desktop),
    serializeResponsiveGroup("@media (min-width: 640px) and (max-width: 1023px)", groups.tablet),
    serializeResponsiveGroup("@media (max-width: 639px)", groups.mobile),
  ].filter(Boolean).join("\n\n");
  const current = next[cssPath];
  const replacement = `${markerStart}\n${blocks}\n${markerEnd}`;
  const pattern = new RegExp(`${escapeRegExp(markerStart)}[\\s\\S]*?${escapeRegExp(markerEnd)}`);
  next[cssPath] = pattern.test(current) ? current.replace(pattern, replacement) : `${current.trimEnd()}\n\n${replacement}\n`;
  return { files: next, warnings };
}

type ResponsiveRuleGroup = Map<string, Map<string, string>>;
type ResponsiveRuleGroups = Record<Exclude<ResponsiveTarget, "base">, ResponsiveRuleGroup>;

function parseResponsiveRules(css: string, markerStart: string, markerEnd: string): ResponsiveRuleGroups {
  const groups: ResponsiveRuleGroups = { desktop:new Map(), tablet:new Map(), mobile:new Map() };
  const start = css.indexOf(markerStart);
  const end = start < 0 ? -1 : css.indexOf(markerEnd, start + markerStart.length);
  if (start < 0 || end < 0) return groups;
  const managed = css.slice(start + markerStart.length, end);
  const media = [
    { target:"desktop" as const, query:"@media (min-width: 1024px)" },
    { target:"tablet" as const, query:"@media (min-width: 640px) and (max-width: 1023px)" },
    { target:"mobile" as const, query:"@media (max-width: 639px)" },
  ];
  for (const item of media) {
    let cursor = 0;
    while (cursor < managed.length) {
      const queryStart = managed.indexOf(item.query, cursor);
      if (queryStart < 0) break;
      const open = managed.indexOf("{", queryStart + item.query.length);
      const close = open < 0 ? -1 : matchingBrace(managed, open);
      if (open < 0 || close < 0) break;
      parseRuleBody(managed.slice(open + 1, close), groups[item.target]);
      cursor = close + 1;
    }
  }
  return groups;
}

function parseRuleBody(body: string, group: ResponsiveRuleGroup) {
  let cursor = 0;
  while (cursor < body.length) {
    const open = body.indexOf("{", cursor);
    if (open < 0) break;
    const close = matchingBrace(body, open);
    if (close < 0) break;
    const selector = body.slice(cursor, open).trim();
    if (selector && !selector.startsWith("@")) {
      const declarations = group.get(selector) ?? new Map<string, string>();
      const raw = body.slice(open + 1, close);
      for (const match of raw.matchAll(/(^|;)\s*([a-z-]+)\s*:\s*([^;{}]*)\s*(?=;|$)/gim)) {
        declarations.set(match[2].toLowerCase(), match[3].trim());
      }
      if (declarations.size) group.set(selector, declarations);
    }
    cursor = close + 1;
  }
}

function matchingBrace(value: string, open: number) {
  let depth = 0;
  let quote = "";
  for (let index = open; index < value.length; index += 1) {
    const char = value[index];
    const previous = value[index - 1];
    if (quote) {
      if (char === quote && previous !== "\\") quote = "";
      continue;
    }
    if (char === '"' || char === "'") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return index;
  }
  return -1;
}

function serializeResponsiveGroup(query: string, group: ResponsiveRuleGroup) {
  if (!group.size) return "";
  const rules = [...group.entries()].map(([selector, declarations]) => {
    const lines = [...declarations.entries()].map(([property, value]) => `  ${property}: ${value};`).join("\n");
    return `${selector} {\n${lines}\n}`;
  }).join("\n");
  return `${query} {\n${indentBlock(rules)}\n}`;
}

function findResponsiveClass(opening: string) {
  const attribute = findAttribute(opening, "className") ?? findAttribute(opening, "class");
  if (!attribute) return null;
  const raw = opening.slice(attribute.valueStart, attribute.valueEnd);
  const value = (raw.startsWith("{") && raw.endsWith("}")) ? raw.slice(1, -1).trim() : raw;
  const literal = value.match(/^(["'])(.*?)\1$/s);
  return literal?.[2].split(/\s+/).find(name => /^polazu-r-[a-z0-9]+$/.test(name)) ?? null;
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function addStaticClass(opening: string, className: string) {
  const attribute = findAttribute(opening, "className") ?? findAttribute(opening, "class");
  if (!attribute) {
    const insertion = opening.match(/\/?>\s*$/)?.index ?? opening.length;
    return opening.slice(0, insertion) + ` className=${JSON.stringify(className)}` + opening.slice(insertion);
  }
  const raw = opening.slice(attribute.valueStart, attribute.valueEnd);
  if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
    const quote = raw[0];
    const value = raw.slice(1, -1);
    if (value.split(/\s+/).includes(className)) return opening;
    return opening.slice(0, attribute.valueStart) + `${quote}${value} ${className}${quote}` + opening.slice(attribute.valueEnd);
  }
  const literal = raw.match(/^\{(["'])(.*?)\1\}$/s);
  if (literal) {
    const quote = literal[1];
    const value = literal[2];
    if (value.split(/\s+/).includes(className)) return opening;
    return opening.slice(0, attribute.valueStart) + `{${quote}${value} ${className}${quote}}` + opening.slice(attribute.valueEnd);
  }
  return null;
}

function chooseGlobalCss(files: Record<string, string>) {
  const paths = Object.keys(files).filter(path => path.endsWith(".css"));
  const preferred = ["globals.css", "global.css", "index.css", "app.css", "styles.css"];
  return paths.sort((a, b) => {
    const ai = preferred.findIndex(name => a.endsWith("/" + name));
    const bi = preferred.findIndex(name => b.endsWith("/" + name));
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.length - b.length;
  })[0] ?? null;
}

function sanitizeCssValue(value: string) {
  if (/url\s*\(|expression\s*\(|javascript:/i.test(value)) return "initial";
  return value.replace(/[{};]/g, "").slice(0, 240);
}
function camelToKebab(value: string) { return value.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`); }
function indentBlock(value: string) { return value.split("\n").map(line => `  ${line}`).join("\n"); }

export function applyDesignerEdits(files: Record<string, string>, edits: Edit[], htmlResolver: (path: string) => { path: string; content: string } | null) {
  const next = { ...files };
  const consolidatedResult = consolidateEdits(edits);
  const warnings: string[] = [...consolidatedResult.warnings];
  const consolidated = consolidatedResult.edits;
  const responsiveResult = addResponsiveRules(next, consolidated);
  Object.assign(next, responsiveResult.files);
  warnings.push(...responsiveResult.warnings);
  const baseEdits = consolidated.filter(edit => !edit.responsive || edit.responsive === "base");
  const byFile = new Map<string, Edit[]>();
  const htmlEdits: Edit[] = [];

  for (const edit of baseEdits) {
    const ref = parseSourceRef(edit.sourceId);
    if (ref && next[ref.path] != null) {
      const list = byFile.get(ref.path) ?? [];
      list.push(edit);
      byFile.set(ref.path, list);
    } else htmlEdits.push(edit);
  }

  for (const [path, fileEdits] of byFile) {
    const ordered = [...fileEdits].sort((a, b) => {
      const ar = parseSourceRef(a.sourceId)!;
      const br = parseSourceRef(b.sourceId)!;
      return br.line - ar.line || br.column - ar.column
        || (a.operation?.type === "reparent" ? 1 : 0) - (b.operation?.type === "reparent" ? 1 : 0);
    });
    let source = next[path];
    for (const edit of ordered) {
      const result = patchMappedSource(source, edit);
      source = result.source;
      if (!result.applied && result.warning) warnings.push(`${path}: ${result.warning}`);
      else if (result.warning) warnings.push(`${path}: ${result.warning}`);
    }
    next[path] = source;
  }

  const groupedHtml = new Map<string, Edit[]>();
  for (const edit of htmlEdits) {
    const html = htmlResolver(edit.path);
    if (!html) {
      warnings.push(`${edit.selector}: 안전하게 연결할 HTML/JSX 소스가 없어 미리보기 변경만 유지했습니다.`);
      continue;
    }
    const list = groupedHtml.get(html.path) ?? [];
    list.push(edit);
    groupedHtml.set(html.path, list);
  }

  for (const [path, editsForHtml] of groupedHtml) {
    try {
      const parser = new DOMParser();
      const documentNode = parser.parseFromString(next[path], "text/html");
      for (const edit of editsForHtml) {
        let element: HTMLElement | null = null;
        try { element = documentNode.querySelector(edit.selector) as HTMLElement | null; } catch { /* ignored */ }
        if (!element) { warnings.push(`${path}: ${edit.selector} 요소를 찾지 못했습니다.`); continue; }
        if (edit.operation?.type === "delete") element.remove();
        else if (edit.operation?.type === "duplicate") element.after(element.cloneNode(true));
        else if (edit.operation?.type === "insert") element.insertAdjacentHTML("beforeend", edit.operation.html);
        else if (edit.operation?.type === "reorder") {
          const direction=edit.operation.direction;const sibling=direction==="up"?element.previousElementSibling:element.nextElementSibling;
          if(!sibling)warnings.push(`${path}: 이동할 형제 요소가 없습니다.`);
          else if(direction==="up")sibling.before(element);
          else sibling.after(element);
        }
        else if (edit.operation?.type === "reparent") {
          let target: HTMLElement | null = null;
          try { target = documentNode.querySelector(edit.operation.targetParentSelector) as HTMLElement | null; } catch { /* ignored */ }
          if (!target || !SAFE_REPARENT_TARGETS.has(target.tagName.toLowerCase()) || element.contains(target)) {
            warnings.push(`${path}: 안전한 이동 대상 컨테이너를 찾지 못해 원본 HTML을 유지했습니다.`);
          } else target.appendChild(element);
        }
        else {
          if (typeof edit.text === "string" && element.childElementCount === 0) element.textContent = edit.text;
          for (const [name, value] of Object.entries(edit.attributes ?? {})) { if (SAFE_ATTRIBUTE.test(name)) element.setAttribute(name === "className" ? "class" : name, value); }
          for (const [property, value] of Object.entries(edit.styles ?? {})) element.style.setProperty(camelToKebab(property), sanitizeCssValue(value));
        }
      }
      const hadDoctype = next[path].trimStart().toLowerCase().startsWith("<!doctype");
      next[path] = `${hadDoctype ? "<!doctype html>\n" : ""}${documentNode.documentElement.outerHTML}`;
    } catch { warnings.push(`${path}: HTML 변환에 실패했습니다.`); }
  }

  const changes: FileChange[] = Object.entries(next)
    .filter(([path, content]) => files[path] !== content)
    .map(([path, content]) => ({ path, content }));
  return { files: next, changes, warnings };
}

export function sourcePatcherTestHooks() {
  return { parseSourceRef, findMappedRange, patchMappedSource, mergeStyle };
}

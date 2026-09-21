import { applyDesignerEdits } from "./source-patcher";
import type { Edit, FileChange } from "./types";

// A save is a checkpoint, not a new undo baseline. Rebuild from the session's
// source so undo can also remove CSS and structures already saved to the server.
export function buildDesignSession(
  baseline: Record<string, string>, current: Record<string, string>, edits: Edit[],
  ownedPaths: Set<string>, resolveHtml: (route: string, files: Record<string, string>) => {path:string;content:string}|null,
) {
  const result = applyDesignerEdits(baseline, edits, route => resolveHtml(route, baseline));
  const paths = new Set([...ownedPaths, ...result.changes.map(change => change.path)]);
  const changes: FileChange[] = [];
  for (const path of paths) {
    const content = result.files[path];
    if (content === current[path]) continue;
    changes.push(content === undefined ? {path, delete:true} : {path, content});
  }
  return {...result, changes, paths};
}

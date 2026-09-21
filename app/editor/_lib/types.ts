import type { Presence, ProjectRole } from "@/lib/types";

export type Project = {
  id?: string;
  source: { owner: string; repository: string; ref: string; url: string; baseCommit?: string | null };
  framework: string;
  files: Record<string, string>;
  binaryFiles?: Record<string, string>;
  skippedFileCount: number;
  revision?: number;
  publishedRevision?: number;
  role?: ProjectRole;
  presence?: Presence[];
};

export type DesignerTool = "select" | "hand" | "frame" | "text" | "rectangle" | "image" | "comment";
export type ResponsiveTarget = "base" | "desktop" | "tablet" | "mobile";

export type Layer = {
  selector: string;
  sourceId?: string;
  generatedId?: string;
  tag: string;
  label: string;
  depth: number;
  parentSelector?: string;
  childCount?: number;
  hidden?: boolean;
  locked?: boolean;
};

export type Selection = Layer & {
  text: string;
  editableText: boolean;
  styles: Record<string, string>;
  attributes?: Record<string, string>;
  width: number;
  height: number;
  x?: number;
  y?: number;
  parentDisplay?: string;
};

export type StructureOperation =
  | { type: "insert"; kind: "frame" | "section" | "container" | "v-stack" | "h-stack" | "text" | "heading" | "quote" | "rich-text" | "rectangle" | "image" | "video" | "button" | "link" | "input" | "textarea" | "select" | "checkbox" | "radio" | "switch" | "form" | "search" | "badge" | "avatar" | "card" | "list" | "table" | "navbar" | "tabs" | "accordion" | "dropdown" | "slider" | "modal" | "toast" | "skeleton" | "divider" | "hero" | "feature-grid" | "pricing" | "contact" | "footer"; parentSelector: string; parentSourceId?: string; html: string; jsx: string }
  | { type: "duplicate"; sourceId?: string }
  | { type: "delete"; sourceId?: string }
  | { type: "reorder"; direction: "up" | "down"; sourceId?: string }
  | { type: "reparent"; sourceSelector: string; targetParentSelector: string; targetParentSourceId?: string; placement: "append" };

export type Edit = {
  id?: string;
  path: string;
  selector: string;
  sourceId?: string;
  generatedId?: string;
  text?: string;
  styles?: Record<string, string>;
  attributes?: Record<string, string>;
  responsive?: ResponsiveTarget;
  state?: string;
  operation?: StructureOperation;
};

export type AuditIssue = {
  id: string;
  severity: "error" | "warning" | "info";
  rule: string;
  message: string;
  selector?: string;
  sourceId?: string;
};

export type MockRule = { method: string; url: string; status: number; body: unknown };
export type Stage = "idle" | "boot" | "install" | "start" | "loading" | "ready" | "error";
export type FileChange = { path: string; content?: string; binaryBase64?: string; delete?: boolean };
export type SaveWorkspace = (changes: FileChange[], summary: string, kind: "CODE" | "DESIGN" | "EDIT") => Promise<number>;

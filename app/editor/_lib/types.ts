export type Project = {
  source: { owner: string; repository: string; ref: string; url: string };
  framework: string;
  files: Record<string, string>;
  binaryFiles?: Record<string, string>;
  skippedFileCount: number;
};
export type Layer = { selector: string; tag: string; label: string; depth: number };
export type Selection = Layer & {
  text: string; editableText: boolean; styles: Record<string, string>; width: number; height: number;
};
export type Edit = { path: string; selector: string; text?: string; styles?: Record<string, string>; state?: string };
export type MockRule = { method: string; url: string; status: number; body: unknown };
export type Stage = "idle" | "boot" | "install" | "start" | "loading" | "ready" | "error";

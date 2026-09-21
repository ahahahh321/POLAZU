export type User = {
  id: number;
  email: string;
  name: string;
  nickname: string;
  profileImageUrl: string | null;
  locale: string;
};

export type ProjectRole = "OWNER" | "EDITOR" | "VIEWER";
export type ProjectStatus = "ACTIVE" | "ARCHIVED" | "DELETED";

export type ProjectSummary = {
  id: string;
  name: string;
  sourceType: string;
  repositoryUrl: string | null;
  workspaceBranch: string;
  baseCommit: string | null;
  framework: string;
  status: ProjectStatus;
  currentRevision: number;
  publishedRevision: number;
  storageBytes: number;
  fileCount: number;
  role: ProjectRole;
  updatedAt: string;
};

export type ProjectDetails = Omit<ProjectSummary, "fileCount"> & {
  repositoryOwner: string | null;
  repositoryName: string | null;
  defaultBranch: string | null;
  lastRemoteCommit: string | null;
  skippedFileCount: number;
  createdAt: string;
};

export type Presence = {
  userId: number;
  name: string;
  nickname: string;
  location: string;
  lastSeenAt: string;
};

export type WorkspaceSnapshot = {
  project: ProjectDetails;
  revision: number;
  branch: string;
  files: Record<string, string>;
  binaryFiles: Record<string, string>;
  presence: Presence[];
};

export type ChangeResult = {
  revision: number;
  changedPaths: string[];
  savedAt: string;
  duplicate: boolean;
};

export type RevisionSummary = {
  revision: number;
  baseRevision: number;
  kind: string;
  summary: string;
  authorUserId: number;
  authorName: string;
  changedPaths: string[];
  createdAt: string;
};

export type VersionSummary = {
  id: string;
  name: string;
  summary: string;
  sourceRevision: number;
  authorUserId: number;
  authorName: string;
  fileCount: number;
  sizeBytes: number;
  createdAt: string;
};

export type ProjectMember = {
  userId: number;
  email: string;
  name: string;
  nickname: string;
  role: ProjectRole;
  joinedAt: string;
};

export type ProjectComment = {
  id: string;
  filePath: string | null;
  selector: string | null;
  body: string;
  status: "OPEN" | "RESOLVED";
  authorUserId: number;
  authorName: string;
  authorNickname: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

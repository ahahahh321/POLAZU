export type ProjectAsset = {
  path: string;
  url: string;
  name: string;
  extension: string;
  binary: boolean;
};

const IMAGE_EXTENSION = /\.(?:avif|gif|jpe?g|png|svg|webp)$/i;

export function scanProjectAssets(files: Record<string, string>, binaryFiles: Record<string, string> = {}): ProjectAsset[] {
  const paths = new Map<string, boolean>();
  for (const path of Object.keys(binaryFiles)) if (IMAGE_EXTENSION.test(path)) paths.set(path, true);
  for (const path of Object.keys(files)) if (IMAGE_EXTENSION.test(path)) paths.set(path, false);
  return [...paths]
    .map(([path, binary]) => ({
      path,
      url: publicAssetUrl(path),
      name: path.split("/").pop() || path,
      extension: path.split(".").pop()?.toLowerCase() || "image",
      binary,
    }))
    .filter((asset) => asset.url)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function assetUploadTarget(root: string, fileName: string, hasPackageManifest: boolean, existingPaths: Iterable<string> = []) {
  const safeName = sanitizeAssetName(fileName);
  const directory = hasPackageManifest ? `${root}/public/polazu-assets` : `${root}/polazu-assets`;
  const existing = new Set(existingPaths);
  const dot = safeName.lastIndexOf(".");
  const stem = dot > 0 ? safeName.slice(0, dot) : safeName;
  const extension = dot > 0 ? safeName.slice(dot) : "";
  let name = safeName;
  let index = 2;
  let path = `${directory}/${name}`.replace(/\/{2,}/g, "/");
  while (existing.has(path)) {
    name = `${stem}-${index}${extension}`;
    path = `${directory}/${name}`.replace(/\/{2,}/g, "/");
    index += 1;
  }
  return { path, url:`/polazu-assets/${name}` };
}

export function publicAssetUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const publicIndex = normalized.indexOf("/public/");
  if (publicIndex >= 0) return normalized.slice(publicIndex + "/public".length);
  if (/\/(?:src|app|components|node_modules)\//i.test(normalized)) return "";
  return normalized;
}

export function sanitizeAssetName(fileName: string) {
  const normalized = fileName.normalize("NFKC");
  const extensionMatch = normalized.match(/\.[A-Za-z0-9]{1,10}$/);
  const extension = extensionMatch?.[0].toLowerCase() ?? "";
  const rawStem = extension ? normalized.slice(0, -extension.length) : normalized;
  const stem = rawStem.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  const safeStem = stem || `asset-${Date.now()}`;
  const maxStem = Math.max(1, 120 - extension.length);
  return `${safeStem.slice(0, maxStem)}${extension}`;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("이미지 파일을 읽지 못했습니다."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      if (comma < 0) reject(new Error("이미지 인코딩에 실패했습니다."));
      else resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

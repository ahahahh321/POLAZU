import type { FileChange } from "./types";

export type DesignTokenCategory = "color" | "spacing" | "typography" | "radius" | "effect" | "other";

export type DesignToken = {
  id: string;
  path: string;
  name: string;
  value: string;
  line: number;
  occurrence: number;
  category: DesignTokenCategory;
};

const TOKEN_NAME = /^--[A-Za-z0-9_-]+$/;
const UNSAFE_VALUE = /[{};]|expression\s*\(|javascript:/i;

export function scanDesignTokens(files: Record<string, string>): DesignToken[] {
  const tokens: DesignToken[] = [];
  for (const path of Object.keys(files).sort()) {
    if (!path.toLowerCase().endsWith(".css")) continue;
    const source = files[path];
    const declaration = /(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+);/g;
    const occurrences = new Map<string, number>();
    let match: RegExpExecArray | null;
    while ((match = declaration.exec(source))) {
      const name = match[1];
      const value = match[2].trim();
      const occurrence = occurrences.get(name) ?? 0;
      occurrences.set(name, occurrence + 1);
      const line = source.slice(0, match.index).split("\n").length;
      tokens.push({
        id: `${path}:${name}:${occurrence}`,
        path,
        name,
        value,
        line,
        occurrence,
        category: categorizeToken(name, value),
      });
    }
  }
  return tokens;
}

export function updateDesignToken(files: Record<string, string>, token: DesignToken, rawValue: string): { change?: FileChange; error?: string } {
  const value = rawValue.trim();
  if (!TOKEN_NAME.test(token.name)) return { error: "유효하지 않은 CSS 변수 이름입니다." };
  if (!value || value.length > 300 || UNSAFE_VALUE.test(value)) return { error: "토큰 값은 1~300자의 안전한 CSS 값이어야 합니다." };
  const source = files[token.path];
  if (typeof source !== "string") return { error: "토큰이 포함된 CSS 파일을 찾지 못했습니다." };

  const declaration = new RegExp(`(${escapeRegExp(token.name)}\\s*:\\s*)([^;{}]+)(;)`, "g");
  let occurrence = 0;
  let match: RegExpExecArray | null;
  while ((match = declaration.exec(source))) {
    if (occurrence === token.occurrence) {
      const next = source.slice(0, match.index) + match[1] + value + match[3] + source.slice(match.index + match[0].length);
      return { change: { path: token.path, content: next } };
    }
    occurrence += 1;
  }
  return { error: "CSS 파일에서 선택한 토큰 선언을 다시 찾지 못했습니다." };
}

function categorizeToken(name: string, value: string): DesignTokenCategory {
  const key = name.toLowerCase();
  const normalized = value.toLowerCase();
  if (/color|background|foreground|surface|border|accent|primary|secondary|muted|danger|success|warning/.test(key) || /^(?:#|rgb|hsl|oklch|lab|lch|color\()/.test(normalized)) return "color";
  if (/font|type|text|line-height|tracking|letter/.test(key)) return "typography";
  if (/radius|rounded/.test(key)) return "radius";
  if (/shadow|blur|opacity|elevation/.test(key)) return "effect";
  if (/space|spacing|gap|padding|margin|size|width|height/.test(key) || /^-?[\d.]+(?:px|rem|em|%|vh|vw|ch)$/.test(normalized)) return "spacing";
  return "other";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

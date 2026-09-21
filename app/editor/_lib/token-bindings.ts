import type { DesignToken, DesignTokenCategory } from "./design-tokens";

export type TokenBindingTarget = "color" | "backgroundColor" | "fontSize" | "gap" | "padding";

const CUSTOM_PROPERTY_NAME = /^--[A-Za-z0-9_-]+$/;

const TARGET_CATEGORIES: Record<TokenBindingTarget, readonly DesignTokenCategory[]> = {
  color: ["color"],
  backgroundColor: ["color"],
  fontSize: ["typography"],
  gap: ["spacing"],
  padding: ["spacing"],
};

/**
 * Returns the project tokens that are meaningful for a given inspector field.
 * Duplicate declarations are collapsed because a CSS var() reference binds by
 * custom-property name; the cascade still decides which declaration wins.
 */
export function getBindableDesignTokens(
  tokens: readonly DesignToken[],
  target: TokenBindingTarget,
  query = "",
): DesignToken[] {
  const categories = TARGET_CATEGORIES[target];
  const normalizedQuery = query.trim().toLowerCase();
  const unique = new Map<string, DesignToken>();

  for (const token of tokens) {
    if (!categories.includes(token.category) || unique.has(token.name)) continue;
    if (normalizedQuery && !`${token.name} ${token.value} ${token.path}`.toLowerCase().includes(normalizedQuery)) continue;
    unique.set(token.name, token);
  }

  return [...unique.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function createTokenReference(name: string): string | null {
  return CUSTOM_PROPERTY_NAME.test(name) ? `var(${name})` : null;
}

export function getTokenNameFromReference(value?: string): string | null {
  const match = value?.trim().match(/^var\(\s*(--[A-Za-z0-9_-]+)\s*\)$/);
  return match?.[1] ?? null;
}

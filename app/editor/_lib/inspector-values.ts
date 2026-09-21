/** Normalize only scalar numbers. Expressions, variables and CSS shorthands stay intact. */
export function normalizeCssScalar(value: string, defaultUnit = "") {
  const trimmed = value.trim();
  return /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(trimmed) ? `${trimmed}${defaultUnit}` : trimmed;
}

export function stepCssScalar(value: string, direction: 1 | -1, options: { defaultUnit?: string; shift?: boolean; alt?: boolean; min?: number; max?: number; step?: number } = {}) {
  const match = value.trim().match(/^([-+]?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i);
  if (!match) return null;
  const unit = match[2] || options.defaultUnit || "";
  const baseStep = options.step ?? (unit === "rem" || unit === "em" ? 0.1 : 1);
  const step = baseStep * (options.shift ? 10 : options.alt ? 0.1 : 1);
  const next = Math.min(options.max ?? Infinity, Math.max(options.min ?? -Infinity, Number(match[1]) + direction * step));
  return `${Number(next.toFixed(4))}${unit}`;
}

export function normalizeFontWeight(value?: string) {
  return value === "normal" ? "400" : value === "bold" ? "700" : value ?? "";
}

/** Native color inputs require opaque #rrggbb; text inputs keep the original alpha. */
export function cssColorToHex(value?: string): string {
  const source = value?.trim().toLowerCase() ?? "";
  const hex = source.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/);
  if (hex) return hex[1].length <= 4 ? `#${hex[1].slice(0, 3).split("").map((c) => c + c).join("")}` : `#${hex[1].slice(0, 6)}`;
  const byte = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  const rgb = source.match(/^rgba?\(\s*([\d.]+%?)[,\s]+([\d.]+%?)[,\s]+([\d.]+%?)(?:\s*[,/].*)?\)$/);
  if (rgb) return `#${rgb.slice(1, 4).map((v) => byte(v.endsWith("%") ? parseFloat(v) * 255 / 100 : parseFloat(v))).join("")}`;
  const hsl = source.match(/^hsla?\(\s*([-\d.]+)(deg|rad|turn)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%(?:\s*[,/].*)?\)$/);
  if (hsl) {
    const hue = Number(hsl[1]) * (hsl[2] === "turn" ? 360 : hsl[2] === "rad" ? 180 / Math.PI : 1);
    const h = ((hue % 360) + 360) % 360 / 60;
    const s = Math.min(1, Number(hsl[3]) / 100), l = Math.min(1, Number(hsl[4]) / 100);
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h % 2 - 1)), m = l - c / 2;
    const parts = h < 1 ? [c,x,0] : h < 2 ? [x,c,0] : h < 3 ? [0,c,x] : h < 4 ? [0,x,c] : h < 5 ? [x,0,c] : [c,0,x];
    return `#${parts.map((v) => byte((v + m) * 255)).join("")}`;
  }
  const names: Record<string, string> = { transparent:"#000000", black:"#000000", white:"#ffffff", red:"#ff0000", blue:"#0000ff", green:"#008000", yellow:"#ffff00", gray:"#808080", grey:"#808080", orange:"#ffa500", purple:"#800080" };
  return names[source] ?? "#000000";
}

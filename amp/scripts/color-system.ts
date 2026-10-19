/**
 * Reads `src/web/ui/tokens.css` and resolves every color role in each theme,
 * including the derived `color-mix` state layers, so tests can prove contrast
 * from the single source of truth instead of a copy of it.
 */
import { readFileSync } from "node:fs";

export type Rgba = [number, number, number, number];
export type Theme = "light" | "dark";

export const tokensPath = new URL("../src/web/ui/tokens.css", import.meta.url);

function declarations(block: string) {
  const out = new Map<string, string>();
  for (const [, name, value] of block.matchAll(
    /(--[a-z0-9-]+)\s*:\s*([^;]+);/g,
  ))
    out.set(
      name,
      value
        .replace(/\s+/g, " ")
        .replace(/\( /g, "(")
        .replace(/ \)/g, ")")
        .trim(),
    );
  return out;
}

/** The body of the first rule whose selector text matches `selector`. */
function ruleBody(css: string, selector: RegExp) {
  const match = selector.exec(css);
  if (!match) throw Error(`tokens.css has no rule ${selector}`);
  let depth = 0,
    start = css.indexOf("{", match.index);
  for (let i = start; i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(start + 1, i);
  }
  throw Error(`Unclosed rule ${selector}`);
}

export function tokenBlocks(css = readFileSync(tokensPath, "utf8")) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const media = ruleBody(
    css,
    /@media screen and \(prefers-color-scheme: dark\)/,
  );
  return {
    light: declarations(ruleBody(css, /^:root\s*\{/m)),
    darkSystem: declarations(
      ruleBody(media, /:root:not\(\[data-theme="light"\]\)/),
    ),
    darkExplicit: declarations(
      ruleBody(css, /:root\[data-theme="dark"\]\s*\{/),
    ),
    // Every later plain `:root` block: derived layers, aliases and scales.
    shared: declarations(
      [...css.matchAll(/^:root\s*\{/gm)]
        .slice(1)
        .map((m) => ruleBody(css.slice(m.index), /^:root\s*\{/m))
        .join("\n"),
    ),
  };
}

function hex(value: string): Rgba {
  let h = value.slice(1);
  if (h.length <= 4) h = [...h].map((c) => c + c).join("");
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
}

export function resolveTheme(theme: Theme, css?: string) {
  const blocks = tokenBlocks(css);
  const vars = new Map([
    ...blocks.light,
    ...(theme === "dark" ? blocks.darkSystem : []),
    ...blocks.shared,
  ]);
  const cache = new Map<string, Rgba>();
  const resolveValue = (raw: string, trail: string[]): Rgba => {
    raw = raw.trim();
    const v = /^var\((--[a-z0-9-]+)\)$/.exec(raw);
    if (v) return color(v[1], trail);
    if (/^#[0-9a-f]{3,8}$/i.test(raw)) return hex(raw);
    const mix =
      /^color-mix\(in srgb, (var\(--[a-z0-9-]+\)) (var\(--[a-z0-9-]+\)|[\d.]+%), (var\(--[a-z0-9-]+\))\)$/.exec(
        raw,
      );
    if (mix) {
      const pctRaw = mix[2].startsWith("var(")
        ? vars.get(mix[2].slice(4, -1))!
        : mix[2];
      const p = parseFloat(pctRaw) / 100;
      const a = resolveValue(mix[1], trail),
        b = resolveValue(mix[3], trail);
      return [0, 1, 2, 3].map((i) => a[i] * p + b[i] * (1 - p)) as Rgba;
    }
    throw Error(`Unresolvable color value ${raw} (${trail.join(" → ")})`);
  };
  const color = (name: string, trail: string[] = []): Rgba => {
    if (cache.has(name)) return cache.get(name)!;
    if (trail.includes(name)) throw Error(`Cycle ${trail.join(" → ")}`);
    const raw = vars.get(name);
    if (raw == null) throw Error(`Undefined token ${name}`);
    const value = resolveValue(raw, [...trail, name]);
    cache.set(name, value);
    return value;
  };
  return { color, names: [...vars.keys()] };
}

const channel = (v: number) => {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
export const luminance = ([r, g, b]: Rgba) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** WCAG 2.x contrast; a translucent foreground is composited over `bg`. */
export function contrast(fg: Rgba, bg: Rgba) {
  const a = fg[3];
  const over = [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)) as Rgba;
  const x = luminance(over),
    y = luminance(bg);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

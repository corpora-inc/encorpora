/**
 * Reads `src/web/ui/tokens.css` and resolves every color role in each theme,
 * including the derived `color-mix` state layers, so tests can prove contrast
 * from the single source of truth instead of a copy of it.
 */
import { readFileSync } from "node:fs";

export type Rgba = [number, number, number, number];
export type Theme = "light" | "dark";
/** Colorful (`data-look="bold"`): one scheme, generated from one hue. */
export type Colorful = {
  /** `--look-hue`, in degrees. */
  hue: number;
  /** `--look-boost`, 0 to 1: a streak's extra color. */
  boost?: number;
  /** The problem names its figure colors (`data-figure-colors="named"`). */
  named?: boolean;
  /** As a wide-gamut screen shows it, every oklch() as it is; else as an
   * sRGB screen does, clipped. */
  wide?: boolean;
};

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
      ruleBody(
        media,
        /:root:not\(\[data-theme="light"\]\):not\(\[data-look="bold"\]\)/,
      ),
    ),
    darkExplicit: declarations(
      ruleBody(
        css,
        /:root\[data-theme="dark"\]:not\(\[data-look="bold"\]\)\s*\{/,
      ),
    ),
    // Colorful, and its problem-named figure marks.
    bold: declarations(ruleBody(css, /^:root\[data-look="bold"\]\s*\{/m)),
    boldNamed: declarations(
      ruleBody(
        css,
        /^:root\[data-look="bold"\]\[data-figure-colors="named"\]\s*\{/m,
      ),
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

/** Arithmetic in a `calc()` after its variables are numbers: + - * /,
 * parentheses, and `cos()`, `sin()` (of degrees), `max()` and `min()`,
 * which Colorful uses to hold a role's chroma inside what a screen shows
 * at the hues where sRGB is narrow. Nothing else. */
function arithmetic(text: string): number {
  const tokens =
    text.match(/cos|sin|max|min|\d*\.?\d+(?:e-?\d+)?|[-+*/(),]/g) ?? [];
  if (tokens.join("") !== text.replace(/\s+/g, ""))
    throw Error(`Not arithmetic: ${text}`);
  let at = 0;
  const call = (name: string): number => {
    at++; // (
    const args = [sum()];
    while (tokens[at] === ",") {
      at++;
      args.push(sum());
    }
    at++; // )
    if (name === "cos") return Math.cos((args[0]! * Math.PI) / 180);
    if (name === "sin") return Math.sin((args[0]! * Math.PI) / 180);
    return name === "max" ? Math.max(...args) : Math.min(...args);
  };
  const atom = (): number => {
    const token = tokens[at++]!;
    if (/^(cos|sin|max|min)$/.test(token)) return call(token);
    if (token === "(") {
      const value = sum();
      at++;
      return value;
    }
    if (token === "-") return -atom();
    return Number(token);
  };
  const product = (): number => {
    let value = atom();
    while (tokens[at] === "*" || tokens[at] === "/")
      value = tokens[at++] === "*" ? value * atom() : value / atom();
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (tokens[at] === "+" || tokens[at] === "-")
      value = tokens[at++] === "+" ? value + product() : value - product();
    return value;
  };
  return sum();
}

/** OKLCH to linear sRGB (CSS Color 4). */
export function oklchToLinear(l: number, c: number, h: number) {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ] as const;
}
/** Linear to gamma-encoded 0–255, keeping the sign of a value outside
 * sRGB (a wide-gamut color) so its luminance survives the round trip. */
const encode = (v: number): number =>
  v < 0
    ? -encode(-v)
    : 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** Top-level arguments of a function's text, split on spaces and "/". */
function argumentsOf(inner: string) {
  const out: string[] = [];
  let depth = 0,
    current = "";
  for (const ch of inner) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && (ch === " " || ch === "/")) {
      if (current) out.push(current);
      if (ch === "/") out.push("/");
      current = "";
    } else current += ch;
  }
  if (current) out.push(current);
  return out;
}

/** Every role in `theme`, or in Colorful at a hue (which has one scheme:
 * Calm's dark blocks never apply under it), then the derived layers. */
export function resolveTheme(theme: Theme, css?: string, colorful?: Colorful) {
  const blocks = tokenBlocks(css);
  const vars = new Map([
    ...blocks.light,
    ...(!colorful && theme === "dark" ? blocks.darkSystem : []),
    ...(colorful ? blocks.bold : []),
    ...(colorful?.named ? blocks.boldNamed : []),
    ...blocks.shared,
  ]);
  if (colorful) {
    vars.set("--look-hue", `${colorful.hue}deg`);
    vars.set("--look-boost", String(colorful.boost ?? 0));
  }
  /** A number from a literal or a `calc()` of the look's variables. */
  const number = (raw: string): number => {
    const text = raw
      .replace(/var\((--look-[a-z-]+)\)/g, (_, name: string) =>
        String(number(vars.get(name) ?? "0")),
      )
      .replace(/deg/g, "");
    const calc = /^calc\((.*)\)$/.exec(text);
    return calc ? arithmetic(calc[1]!) : parseFloat(text);
  };
  /** How far each role's oklch() lies outside sRGB (linear, 0: inside). */
  const outside = new Map<string, number>();
  const cache = new Map<string, Rgba>();
  const resolveValue = (raw: string, trail: string[]): Rgba => {
    raw = raw.trim();
    const v = /^var\((--[a-z0-9-]+)\)$/.exec(raw);
    if (v) return color(v[1], trail);
    if (/^#[0-9a-f]{3,8}$/i.test(raw)) return hex(raw);
    const ok = /^oklch\((.*)\)$/.exec(raw);
    if (ok) {
      const args = argumentsOf(ok[1]!);
      const [l, c, h] = args.slice(0, 3).map(number);
      const alpha = args[3] === "/" ? number(args[4]!) : 1;
      const linear = oklchToLinear(l!, c!, h!);
      const over = Math.max(0, ...linear.map((x) => Math.max(-x, x - 1)));
      if (over > 0) outside.set(trail.at(-1)!, over);
      // An sRGB screen clips what it can't show; a wide one shows it.
      const [r, g, b] = linear.map((x) =>
        encode(colorful?.wide ? x : Math.min(1, Math.max(0, x))),
      );
      return [r!, g!, b!, alpha];
    }
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
  return {
    color,
    names: [...vars.keys()],
    /** Roles resolved so far whose oklch() lies outside sRGB (clipped),
     * and by how much. */
    outside,
  };
}

const channel = (v: number): number => {
  if (v < 0) return -channel(-v);
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

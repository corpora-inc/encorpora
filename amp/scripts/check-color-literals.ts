/**
 * Color literals are banned outside `src/web/ui/tokens.css`: every color is a
 * role token (see that file). Lists each hex, rgb()/hsl() or named color in a
 * stylesheet or component. `--strict` (the npm script) fails on any, and
 * on muted or subtle text under AA (4.5:1) on any surface, in either theme.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../src/web/", import.meta.url).pathname;
const allowed = new Set(["ui/tokens.css"]);
const named =
  "white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|maroon|navy|teal|olive|lime|aqua|fuchsia|gold|brown|beige|ivory|tan|crimson|coral|salmon|khaki|indigo|violet|cyan|magenta|lightgray|lightgrey|darkgray|darkgrey|whitesmoke|ghostwhite|snow|linen";
const functional = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g;
const hex = /#[0-9a-fA-F]{3,8}\b/g;
const cssNamed = new RegExp(`(?<![-\\w])(?:${named})(?![-\\w])`, "gi");
/** Properties whose values are colors in TSX: inline styles and SVG paint. */
const tsxColorContext = new RegExp(
  `(?:fill|stroke|color|background(?:Color)?|borderColor|stopColor|floodColor)\\s*[=:]\\s*\\{?\\s*["'\`]([^"'\`]*)["'\`]`,
  "g",
);

export type Finding = { file: string; line: number; literal: string };

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return name === "__tests__" ? [] : files(path);
    return /\.(css|tsx|ts)$/.test(name) ? [path] : [];
  });
}

function lineOf(text: string, index: number) {
  return text.slice(0, index).split("\n").length;
}

/** Blank out comments so a documented color never counts, keeping offsets. */
const uncomment = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\/|(?<!:)\/\/[^\n]*/g, (m) =>
    m.replace(/[^\n]/g, " "),
  );

export function scan(): Finding[] {
  const findings: Finding[] = [];
  for (const path of files(root)) {
    const file = relative(root, path);
    if (allowed.has(file)) continue;
    const text = uncomment(readFileSync(path, "utf8"));
    const push = (index: number, literal: string) =>
      findings.push({ file, line: lineOf(text, index), literal });
    if (file.endsWith(".css")) {
      // Only declaration values: `#answer` in a selector is not a color.
      for (const m of text.matchAll(/:\s*([^;{}]+);/g)) {
        const at = m.index + m[0].indexOf(m[1]);
        for (const re of [hex, functional, cssNamed]) {
          re.lastIndex = 0;
          for (const c of m[1].matchAll(re)) push(at + c.index, c[0]);
        }
      }
    } else {
      for (const m of text.matchAll(tsxColorContext)) {
        const at = m.index + m[0].indexOf(m[1]);
        for (const re of [hex, functional, cssNamed]) {
          re.lastIndex = 0;
          for (const c of m[1].matchAll(re)) push(at + c.index, c[0]);
        }
      }
      // Hex and functional colors anywhere in a string are colors too.
      for (const m of text.matchAll(/["'`]([^"'`\n]*)["'`]/g)) {
        const at = m.index + 1;
        for (const re of [/^#[0-9a-fA-F]{3,8}$/g, functional]) {
          re.lastIndex = 0;
          for (const c of m[1].matchAll(re)) push(at + c.index, c[0]);
        }
      }
    }
  }
  const seen = new Set<string>();
  return findings.filter((f) => {
    const key = `${f.file}:${f.line}:${f.literal}`;
    return !seen.has(key) && seen.add(key);
  });
}

/** Text that must read on every surface, in both themes: WCAG AA for body
 * text, 4.5:1. */
const TEXT_TOKENS = ["--color-muted-text", "--color-subtle-text"];
const SURFACE_TOKENS = [
  "--color-surface",
  "--color-surface-raised",
  "--color-surface-sunken",
];

function luminance(color: string) {
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = parseInt(color.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
export function contrast(a: string, b: string) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

/** Each theme's text-on-surface pairs from tokens.css, with their ratios:
 * light is `:root`, dark is `:root[data-theme="dark"]` outside Colorful (the media query
 * repeats it). */
export function textContrast() {
  const tokens = readFileSync(join(root, "ui/tokens.css"), "utf8");
  const block = (selector: string) => {
    const start = tokens.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`tokens.css has no ${selector} block`);
    const body = tokens.slice(start, tokens.indexOf("\n}", start));
    return (name: string) => {
      const value = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(
        body,
      )?.[1];
      if (!value) throw new Error(`${selector} sets no hex ${name}`);
      return value;
    };
  };
  return [
    ["light", block(":root")],
    ["dark", block(':root[data-theme="dark"]:not([data-look="bold"])')],
  ].flatMap(([theme, read]) =>
    TEXT_TOKENS.flatMap((text) =>
      SURFACE_TOKENS.map((surface) => ({
        theme: theme as string,
        text,
        surface,
        ratio: contrast(
          (read as (name: string) => string)(text),
          (read as (name: string) => string)(surface),
        ),
      })),
    ),
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const weak = textContrast().filter((pair) => pair.ratio < 4.5);
  for (const pair of weak)
    console.log(
      `${pair.theme}: ${pair.text} on ${pair.surface} is ${pair.ratio.toFixed(2)}:1, under AA's 4.5:1 (ui/tokens.css)`,
    );
  if (weak.length && process.argv.includes("--strict")) process.exitCode = 1;
  const findings = scan();
  const byFile = new Map<string, number>();
  for (const f of findings) byFile.set(f.file, (byFile.get(f.file) ?? 0) + 1);
  if (process.argv.includes("--list"))
    for (const f of findings)
      console.log(`src/web/${f.file}:${f.line}  ${f.literal}`);
  for (const [file, count] of [...byFile].sort((a, b) => b[1] - a[1]))
    console.log(`${String(count).padStart(4)}  src/web/${file}`);
  console.log(
    `${findings.length} color literal(s) outside src/web/ui/tokens.css in ${byFile.size} file(s).`,
  );
  if (findings.length && process.argv.includes("--strict")) process.exit(1);
  console.log(
    "Muted and subtle text pass AA (4.5:1) on every surface, light and dark.",
  );
}

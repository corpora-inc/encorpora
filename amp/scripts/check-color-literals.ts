/**
 * Color literals are banned outside `src/web/ui/tokens.css`: every color is a
 * role token (see that file). Lists each hex, rgb()/hsl() or named color in a
 * stylesheet or component. Report-only by default; `--strict` fails on any.
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

if (import.meta.url === `file://${process.argv[1]}`) {
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
}

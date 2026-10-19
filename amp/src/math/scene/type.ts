import { fontMetrics } from "./font-metrics";

/** Figure type sizes in figure pixels. */
export const typeSizes = { sm: 15, md: 18, lg: 22 } as const;
export type TypeSize = keyof typeof typeSizes;
export type RunFont = "main" | "italic" | "sans" | "sansBold";
/** One typeset run, positioned from the label's left baseline origin. */
export type Run = {
  text: string;
  dx: number;
  dy: number;
  font: RunFont;
  size: number;
  bold?: boolean;
};
/** A typeset label: runs and fraction bars, with its em box. */
export type Typeset = {
  width: number;
  ascent: number;
  descent: number;
  runs: Run[];
  bars: { x1: number; x2: number; y: number; width: number }[];
};

const table: Record<RunFont, Record<string, number>> = {
  main: fontMetrics.main,
  italic: fontMetrics.italic,
  sans: fontMetrics.sans,
  sansBold: fontMetrics.sansBold,
};
const boldTable: Partial<Record<RunFont, Record<string, number>>> = {
  main: fontMetrics.mainBold,
  italic: fontMetrics.italicBold,
};
/** Estimated advance of `text` in pixels. KaTeX widths are exact; the sans
 * table is the widest of the fonts a device may substitute. */
export function advance(
  text: string,
  font: RunFont,
  size: number,
  bold = false,
) {
  let em = 0;
  const t = (bold && boldTable[font]) || table[font];
  for (const c of text) em += t[c] ?? 0.62;
  const math = font === "main" || font === "italic";
  return em * size * (math ? 1.02 : 1);
}

const ext = fontMetrics.extent;
/** Typeset a plain or math label. Math labels: letters italic, `-` becomes a
 * minus, `a/b` and `w a/b` stack, `x^2` and `x^{-1}` raise exponents. */
export function typeset(
  text: string,
  font: "math" | "sans",
  sizeName: TypeSize,
  bold = false,
): Typeset {
  const size = typeSizes[sizeName];
  if (font === "sans") {
    const f: RunFont = bold ? "sansBold" : "sans";
    return {
      width: advance(text, f, size),
      ascent: ext.sans.ascent * size,
      descent: ext.sans.descent * size,
      runs: [{ text, dx: 0, dy: 0, font: f, size }],
      bars: [],
    };
  }
  const fraction = /^([-−]?)(?:(\d+) )?(\d+)\/(\d+)$/.exec(text.trim());
  const out = fraction
    ? stacked(fraction, size, bold)
    : inline(text, size, bold);
  if (bold) for (const r of out.runs) r.bold = true;
  return out;
}

function inline(text: string, size: number, bold: boolean): Typeset {
  const runs: Run[] = [];
  let x = 0;
  let previous = "";
  const binary = /[+\-−×÷=<>≤≥≠≈·]/;
  const relation = /[=<>≤≥≠≈]/;
  const push = (t: string, font: RunFont, s: number, dy: number) => {
    const last = runs.at(-1);
    // Merge only contiguous runs: operator spacing breaks a run.
    if (
      last &&
      last.font === font &&
      last.size === s &&
      last.dy === dy &&
      Math.abs(last.dx + advance(last.text, font, s, bold) - x) < 0.01
    )
      last.text += t;
    else runs.push({ text: t, dx: x, dy, font, size: s });
    x += advance(t, font, s, bold);
  };
  const chars = [...text.replace(/-/g, "−")];
  let operatorGap = false;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    if (c === "^" || c === "_") {
      // A braced group or one character, raised (or lowered) and reduced.
      let group = "";
      if (chars[i + 1] === "{") {
        const close = chars.indexOf("}", i + 2);
        group = chars.slice(i + 2, close < 0 ? undefined : close).join("");
        i = close < 0 ? chars.length : close;
      } else group = chars[++i] ?? "";
      for (const g of group)
        push(
          g,
          /[a-zA-Z]/.test(g) ? "italic" : "main",
          size * 0.7,
          c === "^" ? -0.42 * size : 0.22 * size,
        );
      previous = "x";
      continue;
    }
    // Function names are upright, as TeX sets \log and \sin.
    const name = /^(log|ln|sin|cos|tan)(?![a-zA-Z])/.exec(
      chars.slice(i, i + 4).join(""),
    )?.[1];
    if (name && !/[a-zA-Z]/.test(previous)) {
      push(name, "main", size, 0);
      i += name.length - 1;
      // TeX's thin space before the argument, after any subscript.
      operatorGap = true;
      previous = "x";
      continue;
    }
    // TeX ignores spaces in math; spacing comes from the operators.
    if (c === " ") continue;
    if (operatorGap) {
      x += 0.1667 * size;
      operatorGap = false;
    }
    // Spacing as TeX sets it: thick around relations, medium around binary
    // operators that follow an operand, none for a leading sign.
    const operand = /[\w)\]π.]/.test(previous);
    if (relation.test(c) || (binary.test(c) && operand)) {
      const gap = (relation.test(c) ? 0.2778 : 0.2222) * size;
      x += gap;
      push(c, "main", size, 0);
      x += gap;
    } else push(c, /[a-zA-Z]/.test(c) ? "italic" : "main", size, 0);
    if (c === ",") x += 0.1667 * size;
    previous = c;
  }
  // A final slanted letter overhangs its advance: reserve its correction.
  const lastRun = runs.at(-1);
  if (lastRun?.font === "italic")
    x +=
      (fontMetrics.italicCorrection[lastRun.text.at(-1)! as "x"] ?? 0.1) *
      lastRun.size;
  return {
    width: x,
    ascent: ext.math.ascent * size,
    descent: ext.math.descent * size,
    runs,
    bars: [],
  };
}

function stacked(match: RegExpExecArray, size: number, bold: boolean): Typeset {
  const [, sign, whole, n, d] = match as unknown as string[];
  const runs: Run[] = [];
  let x = 0;
  if (sign) {
    runs.push({ text: "−", dx: 0, dy: 0, font: "main", size });
    x += advance("−", "main", size, bold) + 0.08 * size;
  }
  if (whole) {
    runs.push({ text: whole, dx: x, dy: 0, font: "main", size });
    x += advance(whole, "main", size, bold) + 0.12 * size;
  }
  const fs = size * 0.82;
  const wn = advance(n!, "main", fs, bold),
    wd = advance(d!, "main", fs, bold),
    w = Math.max(wn, wd) + 0.24 * size;
  // The bar sits on the math axis, a quarter em above the baseline.
  const bar = -0.25 * size,
    gap = 0.12 * size,
    numBase = bar - gap,
    denBase = bar + gap + 0.68 * fs;
  runs.push({
    text: n!,
    dx: x + (w - wn) / 2,
    dy: numBase,
    font: "main",
    size: fs,
  });
  runs.push({
    text: d!,
    dx: x + (w - wd) / 2,
    dy: denBase,
    font: "main",
    size: fs,
  });
  return {
    width: x + w,
    ascent: Math.max(-numBase + ext.math.ascent * fs, ext.math.ascent * size),
    descent: denBase + ext.math.descent * fs,
    runs,
    bars: [
      {
        x1: x + 0.06 * size,
        x2: x + w - 0.06 * size,
        y: bar,
        width: Math.max(1, size / 16),
      },
    ],
  };
}

import { expressionToTex, segmentPrintText } from "./math-typesetting";
import { segments } from "./math-segments";

export interface TrailingDisplayMath {
  lead: string;
  source: string;
  tex: string;
  punctuation: string;
  normalized: string;
  originalSource: string;
}

const command =
  /(?:^|[.!?]\s+)(?:solve(?:\s+for\s+(?:real\s+)?\$?[a-z]\$?)?|(?:expand and |rationalize the denominator and )?simplify|evaluate|factor(?:\s+completely)?|expand|calculate|compute)\s*:?[ \t]*$/i;

function completeMath(source: string): string | null {
  const parts = segmentPrintText(source);
  if (parts.length === 1 && parts[0]?.kind === "math") return parts[0].tex;
  // Bare words can be abbreviations (Dr., Mr., etc.), not implicit products.
  if (/^[A-Za-z]{2,}$/.test(source)) return null;
  return expressionToTex(source);
}

function systemMath(source: string): string | null {
  if (!source.includes(";")) return null;
  const rows = [""];
  for (const part of segmentPrintText(source)) {
    // A semicolon inside explicit TeX belongs to that formula (e.g. \\;).
    const pieces =
      part.kind === "math" ? [part.source] : part.source.split(";");
    rows[rows.length - 1] += pieces[0];
    rows.push(...pieces.slice(1));
  }
  if (rows.length < 2) return null;
  const equations = rows.map((row) => completeMath(row.trim()));
  return equations.every((equation) => equation !== null)
    ? `\\begin{gathered}${equations.join("\\\\")}\\end{gathered}`
    : null;
}

/** A complete formula after a colon or short command is a separate display.
 * Source offsets come from the lossless print tokenizer; decimals, currency,
 * units and mathematics embedded in a sentence must not be cut apart.
 * The fallback covers legacy blanks (□) that the print grammar leaves alone.
 */
export function trailingDisplayMath(
  text: string,
  standalone = false,
): TrailingDisplayMath | null {
  // Most generated hints and explanations are ordinary sentences. Avoid
  // tokenizing them on every generation and render when no display can start.
  if (
    !text.includes(":") &&
    !/\b(?:solve|simplify|evaluate|factor|expand|calculate|compute)\b/i.test(
      text,
    )
  ) {
    if (!standalone) return null;
    if (/^\s*[A-Za-z]{3,}\b/.test(text) && !/^\s*log\b/.test(text)) return null;
  }
  const parts = segmentPrintText(text);
  const starts = new Set<number>([0]);
  // An unmarked variable in "Solve for k 2k = 4" can share a tokenizer
  // run with the equation, so also recognize that command's source boundary.
  for (const match of text.matchAll(
    /(?:^|[.!?]\s+)solve(?:\s+for\s+(?:real\s+)?\$?[a-z]\$?)?\s+/gi,
  ))
    starts.add(match.index + match[0].length);
  let offset = 0;
  for (const part of parts) {
    if (part.kind === "math") starts.add(offset);
    else {
      for (const match of part.source.matchAll(
        /(?:(?<!\d):|:(?!\d))\s*|\b(?:simplify|evaluate|factor|expand|calculate|compute)\s+/gi,
      ))
        starts.add(offset + match.index + match[0].length);
    }
    offset += part.source.length;
  }
  for (const start of starts) {
    const lead = text.slice(0, start).trimEnd();
    if (!lead && !standalone) continue;
    if (lead && !lead.endsWith(":") && !command.test(lead)) continue;
    const suffix = text.slice(start).trim();
    // Remove only one sentence period after a complete formula. A run of dots
    // can be recurring-decimal notation; ! can be factorial. Neither is prose.
    let punctuation = /(?<![.\\])\.$/.test(suffix) ? "." : "";
    let source = suffix.slice(0, suffix.length - punctuation.length).trimEnd();
    // A sentence period occasionally sits just inside an explicit math span.
    // Preserve ellipses and escaped TeX spacing; only remove one final dot.
    const insidePeriod = /(?<![.\\])\.(\$|\\\))$/;
    const invisibleDelimiter =
      /\\(?:left|right|middle|[bB]igg?[lr]?)\s*\.(?:\$|\\\))$/;
    if (
      punctuation &&
      insidePeriod.test(source) &&
      !invisibleDelimiter.test(source)
    )
      continue;
    if (
      !punctuation &&
      insidePeriod.test(source) &&
      !invisibleDelimiter.test(source)
    ) {
      const candidate = source.replace(insidePeriod, "$1");
      const inner = candidate.startsWith("$")
        ? candidate.slice(1, -1)
        : candidate.slice(2, -2);
      if (expressionToTex(inner) !== null && !/^[A-Za-z]{2,}$/.test(inner)) {
        source = candidate;
        punctuation = ".";
      }
    }
    if (!source) continue;
    let tex = completeMath(source) ?? systemMath(source);
    if (tex === null && source.includes("□")) {
      const legacy = segments(source);
      if (legacy.length === 1 && legacy[0]?.math && legacy[0].plain === source)
        tex = legacy[0].text;
    }
    // A lone letter/number in a label or choice is not a display command.
    if (
      !lead &&
      !/[!=+−×÷<>≤≥≠/^_²³√]|\\(?:frac|times|div|le|ge|begin)\b/.test(tex ?? "")
    )
      continue;
    if (tex !== null)
      return {
        lead,
        source,
        tex,
        punctuation,
        normalized: text.slice(0, start) + source,
        originalSource: suffix,
      };
  }
  return null;
}

/** Presentation-only cleanup; never rewrite operands, answers or grading data. */
export function normalizeTrailingMath(text: string): string {
  const display = trailingDisplayMath(text, true);
  return display?.punctuation ? display.normalized : text;
}

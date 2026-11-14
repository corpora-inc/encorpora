import { expressionToTex, segmentPrintText } from "./math-typesetting";
import { segments } from "./math-segments";

export interface TrailingDisplayMath {
  lead: string;
  source: string;
  tex: string;
  punctuation: string;
  normalized: string;
}

const command =
  /(?:^|[.!?]\s+)(?:solve(?:\s+for\s+(?:real\s+)?\$?[a-z]\$?)?|(?:expand and |rationalize the denominator and )?simplify|evaluate|factor(?:\s+completely)?|expand|calculate|compute)\s*:?[ \t]*$/i;

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
    // In plain notation ! is factorial, not disposable sentence punctuation.
    // Only outside explicit TeX can an exclamation mark be unambiguously prose.
    let punctuation = /(?:\$|\\\))[.;!?]+$/.test(suffix)
      ? (/[.;!?]+$/.exec(suffix)?.[0] ?? "")
      : (/[.;?]+$/.exec(suffix)?.[0] ?? "");
    let source = suffix.slice(0, suffix.length - punctuation.length).trimEnd();
    // A sentence period occasionally sits just inside an explicit math span.
    // Preserve ellipses and escaped TeX spacing; only remove one final dot.
    const insidePeriod = /(?<![.\\])\.(\$|\\\))$/;
    const invisibleDelimiter =
      /\\(?:left|right|middle|[bB]igg?[lr]?)\s*\.(?:\$|\\\))$/;
    if (insidePeriod.test(source) && !invisibleDelimiter.test(source)) {
      source = source.replace(insidePeriod, "$1");
      punctuation = "." + punctuation;
    }
    if (!source) continue;
    const explicit = segmentPrintText(source);
    let tex =
      explicit.length === 1 && explicit[0]?.kind === "math"
        ? explicit[0].tex
        : expressionToTex(source);
    if (tex === null && source.includes(";")) {
      const equations = source.split(/;\s*/).map(expressionToTex);
      if (equations.every((equation) => equation !== null))
        tex = `\\begin{gathered}${equations.join("\\\\")}\\end{gathered}`;
    }
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
      };
  }
  return null;
}

/** Presentation-only cleanup; never rewrite operands, answers or grading data. */
export function normalizeTrailingMath(text: string): string {
  const display = trailingDisplayMath(text, true);
  return display?.punctuation ? display.normalized : text;
}

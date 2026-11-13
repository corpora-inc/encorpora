import katex from "katex";
import { useContext } from "react";
import { segments } from "../content/math-segments";
import { linkProse } from "../glossary/scan";
import type { TermId } from "../glossary/types";
import { GlossaryBlockContext, GlossaryContext } from "./ui/glossary-context";
import { Term } from "./ui/Term";

export { segments, toTex } from "../content/math-segments";

/** Typesets mathematics inside prose. `$…$` is TeX as written; elsewhere,
 * runs of numbers, single-letter variables and operators that contain an
 * operation (=, +, −, ×, ÷, /, ^, …) are converted to TeX. Prose is untouched,
 * and anything KaTeX cannot parse falls back to the original text. */
export function MathText({ text }: { text: string }) {
  const parts = segments(text);
  const glossary = useContext(GlossaryContext);
  const block = useContext(GlossaryBlockContext);
  // Inside a glossary block, prose links the block's first use of each term
  // to its card; formulas are never linked. Elsewhere, text is unchanged.
  const index = glossary && block ? block.texts.indexOf(text) : -1;
  const linked = new Set<TermId>();
  // `run` is the segment as the server's linker read it; the first `cut`
  // characters (punctuation set with the formula before) are not shown.
  const prose = (run: string, cut: number) => {
    if (!glossary || !block || index < 0) return run.slice(cut);
    let skip = cut;
    return linkProse(run, glossary.lexicon).map((piece, j) => {
      const shown = piece.text.slice(skip);
      skip = Math.max(0, skip - piece.text.length);
      const id = piece.id;
      if (
        !id ||
        shown !== piece.text ||
        linked.has(id) ||
        !glossary.cards.has(id) ||
        block.first.get(id) !== index
      )
        return shown;
      linked.add(id);
      return <Term key={j} id={id} text={piece.text} />;
    });
  };
  return (
    <>
      {parts.map((segment, i) => {
        if (!segment.math) {
          // Punctuation that closes a formula is set with it (below).
          const prev = parts[i - 1];
          const text =
            prev?.math && !BARE_SYMBOL.test(prev.text)
              ? segment.text.replace(CLOSING, "")
              : segment.text;
          return text ? (
            <span key={i}>
              {prose(segment.text, segment.text.length - text.length)}
            </span>
          ) : null;
        }
        const next = parts[i + 1];
        // Closing punctuation is set with its formula so a line never starts
        // with it.
        const closing =
          next && !next.math && !BARE_SYMBOL.test(segment.text)
            ? CLOSING.exec(next.text)?.[0]
            : "";
        return (
          <span
            key={i}
            className="math"
            data-plain={segment.plain}
            // Keep short formulas together when they fit. If one is wider
            // than its container, allow KaTeX's operator and relation breaks.
            style={
              (segment.plain ?? segment.text).length <= SHORT
                ? { display: "inline-block", maxWidth: "100%" }
                : undefined
            }
            dangerouslySetInnerHTML={{
              __html: render(
                segment.text + (closing ? `\\text{${closing}}` : ""),
              ),
            }}
          />
        );
      })}
    </>
  );
}
const CLOSING = /^[.,;:?!)]+/;
const SHORT = 20;
// A formula that ends in a relation or operator (a symbol named in prose,
// such as "<,") keeps its punctuation as prose: TeX would space it as an
// operand.
const BARE_SYMBOL = /(?:[<>=+\-]|\\(?:le|ge|neq|times|div|cdot))\s*$/;

function render(tex: string) {
  try {
    const pieces = breakable(tex);
    // A comma keeps TeX's thin space after it; the line may break there.
    return pieces
      .map(
        (piece, i) =>
          katex.renderToString(piece, {
            throwOnError: true,
            output: "htmlAndMathml",
          }) +
          (i === pieces.length - 1
            ? ""
            : piece.endsWith(",")
              ? "\u2009"
              : "<wbr>"),
      )
      .join("");
  } catch {
    return escape(tex);
  }
}

/** A formula that reads as a sentence ("∠AOB, ∠BOC and ∠BOC, ∠COD are
 * linear pairs") has no operator or relation for KaTeX to break at, so one
 * long statement could not wrap on a phone. Such a formula (one with
 * `\text{…}` or `\quad`) may break after a comma and before a run of
 * words, at its top level only (never inside braces, brackets or
 * parentheses). */
export function breakable(tex: string): string[] {
  if (!/\\(?:text\{|quad)/.test(tex)) return [tex];
  const pieces: string[] = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < tex.length; i++) {
    const c = tex[i]!;
    if (c === "\\") {
      const word = /^\\(?:[a-zA-Z]+|.)/.exec(tex.slice(i))![0];
      if (word === "\\{" || word === "\\left") depth++;
      else if (word === "\\}" || word === "\\right") depth--;
      else if (word === "\\text" && depth === 0 && i > start) {
        pieces.push(tex.slice(start, i));
        start = i;
      }
      i += word.length - 1;
      continue;
    }
    if (c === "{" || c === "(" || c === "[") depth++;
    else if (c === "}" || c === ")" || c === "]") depth--;
    else if (c === "," && depth === 0) {
      pieces.push(tex.slice(start, i + 1));
      start = i + 1;
    }
  }
  pieces.push(tex.slice(start));
  const kept = pieces.filter((piece) => piece.trim());
  return depth === 0 && kept.length ? kept : [tex];
}
const escape = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`,
  );

/** A whole-number answer reads with thousands separators: 6084 → 6,084. */
export const withSeparators = (answer: string) =>
  /^\d{4,}$/.test(answer)
    ? answer.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    : answer;

const SPOKEN: Record<string, string> = {
  pi: "π",
  theta: "θ",
  times: "×",
  div: "÷",
  cdot: "·",
  le: "≤",
  ge: "≥",
  neq: "≠",
  pm: "±",
  circ: "°",
  angle: "∠",
};
/** Plain reading text for an accessible name: each `$…$` span becomes its
 * source without TeX markup ("Exact coefficient $a$" → "Exact coefficient a",
 * "$\frac{3}{4}\pi$" → "3/4π"). Text without TeX is returned unchanged. */
export function spokenMath(text: string): string {
  return text.replace(/\$([^$]+)\$/g, (_, tex: string) =>
    tex
      .replace(/\\[td]?frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
      .replace(/\\sqrt\{([^{}]*)\}/g, "√$1")
      .replace(/\\(?:text|mathrm)\{([^{}]*)\}/g, "$1")
      .replace(/\\([A-Za-z]+)\s*/g, (m, name: string) => SPOKEN[name] ?? "")
      .replace(/\^\{([^{}]*)\}/g, "^$1")
      .replace(/[{}]/g, "")
      .replace(/\\[,;!: ]/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

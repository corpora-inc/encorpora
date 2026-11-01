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
  const prose = (run: string) => {
    if (!glossary || !block || index < 0) return run;
    return linkProse(run, glossary.lexicon).map((piece, j) => {
      const id = piece.id;
      if (
        !id ||
        linked.has(id) ||
        !glossary.cards.has(id) ||
        block.first.get(id) !== index
      )
        return piece.text;
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
          return text ? <span key={i}>{prose(text)}</span> : null;
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
    return katex.renderToString(tex, {
      throwOnError: true,
      output: "htmlAndMathml",
    });
  } catch {
    return escape(tex);
  }
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

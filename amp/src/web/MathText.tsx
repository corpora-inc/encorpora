import katex from "katex";
import { useContext } from "react";
import { segments } from "../content/math-segments";
import { trailingDisplayMath } from "../content/prompt-structure";
import { DisplayMath } from "../content/DisplayMath";
import { linkProse } from "../glossary/scan";
import type { TermId } from "../glossary/types";
import { GlossaryBlockContext, GlossaryContext } from "./ui/glossary-context";
import { Term } from "./ui/Term";

export { segments, toTex } from "../content/math-segments";

/** Typesets mathematics inside prose. `$…$` is TeX as written; elsewhere,
 * runs of numbers, single-letter variables and operators that contain an
 * operation (=, +, −, ×, ÷, /, ^, …) are converted to TeX. Prose is untouched,
 * and anything KaTeX cannot parse falls back to the original text. */
export function MathText({
  text,
  sourceText = text,
  displayLead = false,
}: {
  text: string;
  sourceText?: string;
  /** The text introduces a displayed formula (set by MathText itself). */
  displayLead?: boolean;
}) {
  const parts = segments(text, displayLead);
  const glossary = useContext(GlossaryContext);
  const block = useContext(GlossaryBlockContext);
  const display = trailingDisplayMath(text);
  // Inside a glossary block, prose links the block's first use of each term
  // to its card; formulas are never linked. Elsewhere, text is unchanged.
  const index = glossary && block ? block.texts.indexOf(sourceText) : -1;
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
  if (display)
    return (
      <>
        {display.lead && (
          <>
            <MathText
              text={display.lead}
              sourceText={sourceText}
              // In the whole sentence, a letter before the colon shares a
              // formula run only with plain notation, never with $…$ TeX.
              displayLead={!/^(?:\$|\\\()/.test(display.source)}
            />{" "}
          </>
        )}
        <DisplayMath tex={display.tex} source={display.source} />
      </>
    );
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

/** TeX that didn't render, logged once each: it shows as its source. */
const unrendered = new Set<string>();
function render(tex: string) {
  try {
    return katex.renderToString(tex, {
      throwOnError: true,
      output: "htmlAndMathml",
    });
  } catch (error) {
    if (!unrendered.has(tex)) {
      unrendered.add(tex);
      console.warn("AMP: TeX shown as its source", error);
    }
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
/** A fraction that is one number over another, inside TeX. */
const FRACTION = /\\[td]?frac\{([^{}]*)\}\{([^{}]*)\}/g;
/** A whole number, a decimal or a single letter, signed or not: a fraction's
 * part that needs no brackets on one line. */
const ATOM = /^[-−]?(?:\d+(?:\.\d+)?|[A-Za-z])$/;
/**
 * TeX fractions as plain text that reads only one way: a mixed number keeps
 * its space ("3 1/4", never "31/4"), and a part that is itself a fraction or
 * an expression is bracketed, innermost first ("(−5/4)/(1/6)", never
 * "−5/41/6").
 */
function plainFractions(tex: string): string {
  let text = tex.replace(
    /(\d)\s*\\[td]?frac\{(\d+)\}\{(\d+)\}/g,
    "$1\u00a0$2/$3",
  );
  const part = (value: string) => {
    const trimmed = value.trim();
    return ATOM.test(trimmed) ? trimmed : `(${trimmed})`;
  };
  // Innermost first: each pass turns the fractions with no fraction inside.
  for (let pass = 0; pass < 8 && FRACTION.test(text); pass++) {
    FRACTION.lastIndex = 0;
    text = text.replace(FRACTION, (_, top: string, bottom: string) =>
      `${part(top)}/${part(bottom)}`,
    );
  }
  return text;
}

/** Plain reading text for an accessible name: each `$…$` span becomes its
 * source without TeX markup ("Exact coefficient $a$" → "Exact coefficient a",
 * "$\frac{3}{4}\pi$" → "3/4π"). Text without TeX is returned unchanged. */
export function spokenMath(text: string): string {
  return text.replace(/\$([^$]+)\$/g, (_, tex: string) =>
    plainFractions(tex)
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

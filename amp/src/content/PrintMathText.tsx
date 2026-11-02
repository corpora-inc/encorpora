import React, { createContext, useContext } from "react";
import katex from "katex";
import { segmentPrintText } from "./math-typesetting";

// Keep KaTeX bases atomic for PDF pagination. Explicit breaks between bases
// retain operator wrapping while nowrap joins the final base to punctuation.
// WebKit needs each break inside a normal-whitespace span to wrap within nowrap.
// Neither the source text nor MathML includes these layout-only break points.
export const printMathStyles = `
.print-math{display:inline-block;break-inside:avoid}
:is(p,li)>.print-math:has(.mfrac,.sqrt),:is(p,li)>.print-math-punctuation:has(.mfrac,.sqrt){padding:.2em 0}
.print-math .katex{font-size:1.08em}
.print-math-punctuation{display:inline-block;break-inside:avoid;white-space:nowrap}
.print-math-punctuation>.print-math{display:inline;white-space:nowrap}
.print-math-break{white-space:normal}
`;

/** On (workbooks): mathematics inside running text prints its
 * fractions text-style, so they do not push lines apart. Mathematics that
 * stands alone (a choice, a card, a box) stays display-style. */
export const PrintMathProse = createContext(false);

/** Static, accessible mathematics. The original source is the only fallback. */
export function PrintMathText({ text }: { text: string }) {
  const segments = segmentPrintText(text);
  // Running text has a few words around the mathematics; a label with a
  // unit or a full stop ("3/4 cup.") is still standalone.
  const words = segments
    .filter((s) => s.kind === "text")
    .flatMap((s) => s.source.match(/[A-Za-z]{2,}/g) ?? []).length;
  const prose = useContext(PrintMathProse) && words >= 3;
  let attachedPunctuationLength = 0;
  return (
    <>
      {segments.map((segment, index) => {
        if (segment.kind === "text") {
          const source = segment.source.slice(attachedPunctuationLength);
          attachedPunctuationLength = 0;
          return <React.Fragment key={index}>{source}</React.Fragment>;
        }
        try {
          // Keep fraction numerators and denominators readable at the body
          // size; in running text (prose) slightly smaller, at an even line.
          let html = katex.renderToString(
            `${prose ? "\\textstyle" : "\\displaystyle"} ${segment.tex}`,
            {
              output: "htmlAndMathml",
              throwOnError: true,
              strict: "error",
              trust: false,
            },
          );
          const next = segments[index + 1];
          const punctuation =
            next?.kind === "text"
              ? (/^[,.;:!?]+/.exec(next.source)?.[0] ?? "")
              : "";
          if (punctuation) {
            let firstBase = true;
            html = html.replace(/<span class="base">/g, (base) => {
              if (firstBase) {
                firstBase = false;
                return base;
              }
              return `<span class="print-math-break"><wbr></span>${base}`;
            });
          }
          const math = (
            <span
              key={index}
              className={prose ? "print-math print-math--prose" : "print-math"}
              data-plain={segment.source}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
          if (!punctuation) return math;
          attachedPunctuationLength = punctuation.length;
          // Keep prose punctuation outside data-plain; only the boundary is
          // unbreakable. Mathematics retains its own internal wrap points.
          return (
            <span key={index} className="print-math-punctuation">
              {math}
              {punctuation}
            </span>
          );
        } catch {
          return <React.Fragment key={index}>{segment.source}</React.Fragment>;
        }
      })}
    </>
  );
}

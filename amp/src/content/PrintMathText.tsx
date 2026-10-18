import React from "react";
import katex from "katex";
import { segmentPrintText } from "./math-typesetting";

// Keep KaTeX bases atomic for PDF pagination. A generated nonbreaking space
// with zero advance joins the final base to punctuation without changing the
// source text or MathML; the equation may wrap at its earlier operator breaks.
export const printMathStyles = `
.print-math{display:inline-block;break-inside:avoid}
p>.print-math:has(.mfrac,.sqrt),p>.print-math-punctuation:has(.mfrac,.sqrt){padding:.2em 0}
.print-math .katex{font-size:1.08em}
.print-math-punctuation{display:inline-block;break-inside:avoid;white-space:nowrap}
.print-math-punctuation>.print-math{display:inline;white-space:normal}
.print-math-punctuation>.print-math::after{content:"\\00a0";font-size:0}
`;

/** Static, accessible mathematics. The original source is the only fallback. */
export function PrintMathText({ text }: { text: string }) {
  const segments = segmentPrintText(text);
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
          // Keep fraction numerators and denominators readable at the body size.
          const html = katex.renderToString(`\\displaystyle ${segment.tex}`, {
            output: "htmlAndMathml",
            throwOnError: true,
            strict: "error",
            trust: false,
          });
          const math = (
            <span
              key={index}
              className="print-math"
              data-plain={segment.source}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
          const next = segments[index + 1];
          const punctuation =
            next?.kind === "text"
              ? (/^[,.;:!?]+/.exec(next.source)?.[0] ?? "")
              : "";
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

import React from "react";
import katex from "katex";
import { segmentPrintText } from "./math-typesetting";

// Keep KaTeX bases atomic for PDF pagination. Explicit breaks between bases
// retain operator wrapping while nowrap joins the final base to punctuation.
// Neither the source text nor MathML includes these layout-only break points.
export const printMathStyles = `
.print-math{display:inline-block;break-inside:avoid}
p>.print-math:has(.mfrac,.sqrt),p>.print-math-punctuation:has(.mfrac,.sqrt){padding:.2em 0}
.print-math .katex{font-size:1.08em}
.print-math-punctuation{display:inline-block;break-inside:avoid;white-space:nowrap}
.print-math-punctuation>.print-math{display:inline;white-space:nowrap}
.print-math-break{white-space:normal}
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
          let html = katex.renderToString(`\\displaystyle ${segment.tex}`, {
            output: "htmlAndMathml",
            throwOnError: true,
            strict: "error",
            trust: false,
          });
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
              className="print-math"
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

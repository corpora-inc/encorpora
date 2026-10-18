import React from "react";
import katex from "katex";
import { segmentPrintText } from "./math-typesetting";

export const printMathStyles = `.print-math{display:inline-block;break-inside:avoid}p>.print-math:has(.mfrac,.sqrt){padding:.2em 0}.print-math .katex{font-size:1.08em}`;

/** Static, accessible mathematics. The original source is the only fallback. */
export function PrintMathText({ text }: { text: string }) {
  return (
    <>
      {segmentPrintText(text).map((segment, index) => {
        if (segment.kind === "text")
          return <React.Fragment key={index}>{segment.source}</React.Fragment>;
        try {
          // Keep fraction numerators and denominators readable at the body size.
          const html = katex.renderToString(`\\displaystyle ${segment.tex}`, {
            output: "htmlAndMathml",
            throwOnError: true,
            strict: "error",
            trust: false,
          });
          return (
            <span
              key={index}
              className="print-math"
              data-plain={segment.source}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <React.Fragment key={index}>{segment.source}</React.Fragment>;
        }
      })}
    </>
  );
}

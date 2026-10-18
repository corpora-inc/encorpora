import React from "react";
import katex from "katex";
import { segmentPrintText } from "./math-typesetting";

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

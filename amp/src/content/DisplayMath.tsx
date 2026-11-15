import React, { useEffect, useRef } from "react";
import katex from "katex";

export {
  displayMathFitScript,
  displayMathStyles,
  fitDisplayMath,
} from "./display-math-styles";
import { fitDisplayMath } from "./display-math-styles";

/** Shared static markup for web, lessons, review cards and printed exercises. */
export function DisplayMath({
  tex,
  source,
  originalSource,
}: {
  tex: string;
  source: string;
  /** Print auditing retains authored sentence punctuation outside the visible math. */
  originalSource?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let disposed = false;
    const fit = () => {
      if (!disposed) fitDisplayMath(element);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    void document.fonts.ready.then(fit);
    fit();
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [tex]);
  let html: string;
  try {
    html = katex.renderToString(tex, {
      displayMode: true,
      output: "htmlAndMathml",
      throwOnError: true,
      trust: false,
    });
  } catch {
    return (
      <span className="math-display" ref={ref}>
        {source}
      </span>
    );
  }
  return (
    <span
      className="math-display"
      ref={ref}
      data-plain={originalSource ?? source}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

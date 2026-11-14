import React, { useEffect, useRef } from "react";
import katex from "katex";

// KaTeX emits atomic bases separated at operators. Display mode normally
// disables those breaks; restore them while keeping fractions/roots intact.
export const displayMathStyles = `
.math-display{display:block;max-width:100%;min-width:0;margin:.65em 0;text-align:center;line-height:1.65;break-inside:avoid}
.math-display .katex-display{margin:0;text-align:center}
.math-display .katex-display>.katex{display:block;white-space:normal;text-align:center}
.math-display .katex-html{white-space:normal;text-align:center;line-height:1.65}
.math-display .katex .base{white-space:nowrap}
`;

/** Fit only an indivisible base (a fraction, radical or matrix) wider than
 * its column. Operator-separated expressions wrap at their normal font size. */
export function fitDisplayMath(element: HTMLElement) {
  element.style.removeProperty("font-size");
  const available = element.clientWidth - 4;
  if (available <= 0) return;
  const widest = Math.max(
    0,
    ...Array.from(
      element.querySelectorAll<HTMLElement>(".katex-html > .base"),
      (base) => base.getBoundingClientRect().width,
    ),
  );
  if (widest > available)
    element.style.fontSize = `${(parseFloat(getComputedStyle(element).fontSize) * available) / widest}px`;
}

// Standalone print documents do not hydrate React. Their layout code invokes
// the same fit after placing mathematics in its final column.
export const displayMathFitScript = String.raw`
function fitDisplayMath(root) {
  Array.prototype.forEach.call(root.querySelectorAll('.math-display'), function (el) {
    el.style.removeProperty('font-size');
    var available = el.clientWidth - 4;
    if (available <= 0) return;
    var widest = 0;
    Array.prototype.forEach.call(el.querySelectorAll('.katex-html > .base'), function (base) {
      widest = Math.max(widest, base.getBoundingClientRect().width);
    });
    if (widest > available) el.style.fontSize = (parseFloat(getComputedStyle(el).fontSize) * available / widest) + 'px';
  });
}
`;

/** Shared static markup for web, lessons, review cards and printed exercises. */
export function DisplayMath({ tex, source }: { tex: string; source: string }) {
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
      data-plain={source}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

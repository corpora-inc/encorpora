import { useLayoutEffect, useRef, type ReactNode } from "react";
import { typeSizes } from "../math/scene/type";
import { LEGIBLE_PX } from "./scene/SceneSvg";

/** The largest on-screen size, in CSS px, of a legacy figure's labels: the
 * scene label size one step above ticks and categories. Figure text sits
 * below the prompt (19 px at its smallest) in the type hierarchy. */
export const FIGURE_TEXT_MAX_PX = typeSizes.md;

/** The largest height, in CSS px, at which an SVG's labels stay within
 * FIGURE_TEXT_MAX_PX, or null when it has no labels.
 *
 * Legacy figures size their labels in view-box units and the page sizes the
 * box, so the labels grew with the box: a landscape tablet gives a figure up
 * to 420 px of height, and a 28-unit bar-chart label drew at 48 px beside a
 * 30 px prompt. A view box drawn at scale s has s = min(w / width, h /
 * height), so a ceiling on the box height alone bounds the scale. A figure
 * whose labels span a wide range of sizes keeps its smallest at the legible
 * floor instead. */
export function figureTextCapHeight(svg: SVGSVGElement): number | null {
  const view = svg.viewBox.baseVal;
  if (!view?.width || !view.height) return null;
  // No legacy figure scales its labels with a transform, so a label's
  // computed size is its size in view-box units.
  const sizes = Array.from(svg.querySelectorAll("text")).flatMap((t) => {
    const size = Number.parseFloat(getComputedStyle(t).fontSize);
    return size > 0 && t.textContent?.trim() ? [size] : [];
  });
  if (!sizes.length) return null;
  const scale = Math.max(
    FIGURE_TEXT_MAX_PX / Math.max(...sizes),
    LEGIBLE_PX / Math.min(...sizes),
  );
  return Math.floor(view.height * scale * 10) / 10;
}

/** Wraps a legacy figure without adding a box (`display: contents`), and
 * gives each of its SVGs `--figure-cap-height`, which every figure
 * max-height rule takes the smaller of (style.css, practice.css). The value
 * depends only on the figure, never on the viewport, so it is set once
 * before paint and nothing moves when the viewport changes. Scene figures
 * need no cap: they never draw above their own layout size. */
export function FigureTextCap({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const svgs = ref.current?.querySelectorAll<SVGSVGElement>("svg[viewBox]");
    for (const svg of svgs ? Array.from(svgs) : []) {
      if (svg.ownerSVGElement || svg.classList.contains("scene-figure"))
        continue;
      const cap = figureTextCapHeight(svg);
      if (cap === null) svg.style.removeProperty("--figure-cap-height");
      else svg.style.setProperty("--figure-cap-height", `${cap}px`);
    }
  });
  return (
    <span ref={ref} className="figure-text-cap" style={{ display: "contents" }}>
      {children}
    </span>
  );
}

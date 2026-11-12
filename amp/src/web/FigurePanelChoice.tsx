import { useLayoutEffect, useRef, useState } from "react";
import { article, type PanelChoice } from "../math/figure-panels";
import { spokenMath } from "./MathText";

type Box = { x: number; y: number; w: number; h: number };
/** The correct panel and the learner's panel, once the answer is checked. */
export type PanelReview = { correct: string; chosen: string | null };

/** Where each lettered panel is drawn, relative to the problem's content:
 * the panel's frame when the figure marks one (a shape's cell, a clock's
 * square), else the union of everything drawn in that panel. */
function measure(host: HTMLElement, letters: string[]) {
  const origin = host.getBoundingClientRect();
  const boxes: Record<string, Box> = {};
  for (const letter of letters) {
    const frame = host.querySelector(`.figure [data-panel-frame="${letter}"]`);
    const parts = frame
      ? [frame]
      : [...host.querySelectorAll(`.figure [data-panel="${letter}"]`)];
    const rects = parts
      .map((p) => p.getBoundingClientRect())
      .filter((r) => r.width > 0 || r.height > 0);
    if (!rects.length) return null;
    const x0 = Math.min(...rects.map((r) => r.left)),
      y0 = Math.min(...rects.map((r) => r.top)),
      x1 = Math.max(...rects.map((r) => r.right)),
      y1 = Math.max(...rects.map((r) => r.bottom));
    boxes[letter] = {
      x: x0 - origin.left - host.clientLeft,
      y: y0 - origin.top - host.clientTop,
      w: x1 - x0,
      h: y1 - y0,
    };
  }
  return boxes;
}
const same = (a: Record<string, Box> | null, b: Record<string, Box> | null) =>
  JSON.stringify(a) === JSON.stringify(b);

/** What a panel's reserved mark says after checking. */
function markOf(review: PanelReview | null, id: string) {
  if (!review) return null;
  const correct = review.correct === id,
    chosen = review.chosen === id;
  if (correct && chosen)
    return { tone: "correct", text: "your choice, correct" };
  if (correct) return { tone: "correct", text: "the correct answer" };
  if (chosen) return { tone: "chosen", text: "your choice" };
  return null;
}

/** A choice made by tapping the problem's own figure. Each lettered panel
 * of the figure is a radio button laid over the panel itself: the whole
 * panel is the target, the selected panel takes the accent edge and a faint
 * tint, and checking marks the correct and the chosen panel. The layer is
 * positioned over the figure and never takes space, so choosing, checking
 * and resizing move nothing. The figure keeps its own description for
 * screen readers; each radio is named for its panel ("Triangle B"). */
export function FigurePanelChoice({
  problemId,
  choice,
  value,
  onChange,
  locked,
  review,
}: {
  problemId: string;
  choice: PanelChoice;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  review: PanelReview | null;
}) {
  const root = useRef<HTMLFieldSetElement>(null);
  const [boxes, setBoxes] = useState<Record<string, Box> | null>(null);
  const letters = choice.options.map((o) => o.letter).join("");
  useLayoutEffect(() => {
    const host = root.current?.parentElement;
    if (!host) return;
    const fit = () => {
      const next = measure(host, [...letters]);
      if (!next)
        console.error(
          `AMP figure panels ${letters} are not drawn in problem ${problemId}`,
        );
      setBoxes((old) => (same(old, next) ? old : next));
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    for (const figure of host.querySelectorAll(".figure"))
      observer.observe(figure);
    return () => observer.disconnect();
  }, [problemId, letters]);
  return (
    <fieldset
      ref={root}
      className="figure-panel-targets"
      disabled={locked}
      data-reviewed={review ? "" : undefined}
    >
      <legend className="sr-only">
        Choose {article(choice.noun)} {choice.noun.toLowerCase()}
      </legend>
      {boxes &&
        choice.options.map((option) => {
          const box = boxes[option.letter]!;
          const selected = value === option.id;
          const mark = markOf(review, option.id);
          return (
            <label
              key={option.id}
              className="figure-panel"
              data-selected={selected ? "" : undefined}
              data-mark={mark?.tone}
              style={{
                left: box.x,
                top: box.y,
                width: box.w,
                height: box.h,
              }}
            >
              <input
                type="radio"
                className="figure-panel-radio"
                name={`figure-panel-${problemId}`}
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                aria-label={`${spokenMath(option.label)}${mark ? `, ${mark.text}` : ""}`}
              />
              <span className="figure-panel-mark" aria-hidden="true">
                {mark ? (mark.tone === "correct" ? "✓" : "✕") : ""}
              </span>
            </label>
          );
        })}
    </fieldset>
  );
}

import { useEffect, useId, useRef, useState } from "react";
import { scatterLayout } from "../../math/data-display-models";
import { ScatterGrid } from "../DataDisplayFigure";
import type { RowPercentAnimation, TrendFitAnimation } from "./model";

/** Eases a number to its target; under reduced motion it jumps. */
function useTween(target: number, ms = 900) {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = target;
      setValue(target);
      return;
    }
    const from = current.current,
      start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms),
        v = from + (target - from) * (1 - (1 - k) ** 3);
      current.current = v;
      setValue(v);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

/** A flat line at the typical y tilts onto the trend line; each point's
 * vertical gap to the line shrinks as it turns. */
export function TrendFitStage({
  model,
  step,
}: {
  model: TrendFitAnimation;
  step: number;
}) {
  const clip = useId();
  const f = model.figure;
  const l = scatterLayout(f, { left: 44, right: 310, top: 10, bottom: 166 });
  const t = useTween(step === 2 ? 1 : 0);
  const [[x1, y1]] = f.line;
  const at = (x: number) =>
    (1 - t) * model.level + t * (y1 + model.slope * (x - x1));
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <rect
            x={l.left}
            y={l.top}
            width={l.right - l.left}
            height={l.bottom - l.top}
          />
        </clipPath>
      </defs>
      <ScatterGrid layout={l} figure={f} compact />
      <g
        className="animation-fade"
        style={{ opacity: step ? 1 : 0 }}
        clipPath={`url(#${clip})`}
      >
        {f.points.map(([px, py], i) => (
          <line
            key={i}
            data-gap={i}
            x1={l.x(px)}
            x2={l.x(px)}
            y1={l.y(py)}
            y2={l.y(at(px))}
            stroke="var(--color-figure-gold)"
            strokeWidth={2}
          />
        ))}
        <line
          data-fit={t === 1 ? "trend" : t === 0 ? "flat" : "turning"}
          x1={l.x(f.x.start)}
          x2={l.x(f.x.end)}
          y1={l.y(at(f.x.start))}
          y2={l.y(at(f.x.end))}
          stroke="var(--color-figure-warm)"
          strokeWidth={3}
          strokeLinecap="round"
        />
      </g>
    </>
  );
}

/** Two rows as bars on one count scale, then each stretched to 100%. */
export function RowPercentStage({
  model,
  step,
}: {
  model: RowPercentAnimation;
  step: number;
}) {
  const f = model.figure,
    totals = model.counts.map(([a, b]) => a + b);
  const left = 16,
    full = 288,
    max = Math.max(...totals);
  const t = useTween(step === 2 ? 1 : 0);
  const pct = (k: number, total: number) => Math.round((100 * k) / total);
  return (
    <>
      <text x={left} y={16} style={{ fontSize: 13 }}>
        {f.columnTitle}:
      </text>
      <rect
        x={left + 200}
        y={6}
        width={12}
        height={12}
        rx={2}
        fill="var(--color-figure-accent-fill-strong)"
        stroke="var(--color-figure-accent)"
      />
      <text x={left + 216} y={16} style={{ fontSize: 13 }}>
        Yes
      </text>
      <rect
        x={left + 246}
        y={6}
        width={12}
        height={12}
        rx={2}
        fill="var(--color-figure-empty)"
        stroke="var(--color-figure-axis)"
      />
      <text x={left + 262} y={16} style={{ fontSize: 13 }}>
        No
      </text>
      {model.counts.map(([yes], i) => {
        const total = totals[i]!,
          width = (1 - t) * ((full * total) / max) + t * full,
          yesWidth = (width * yes) / total,
          top = 46 + i * 78;
        return (
          <g key={i} data-row={f.rows[i]} data-width={width.toFixed(1)}>
            <text x={left} y={top - 8} style={{ fontSize: 14 }}>
              {`${f.rows[i]}: ${step === 2 ? `${pct(yes, total)}% yes` : step === 1 ? `${yes} of ${total} yes` : `${total} in all`}`}
            </text>
            <rect
              x={left}
              y={top}
              width={yesWidth}
              height={36}
              fill="var(--color-figure-accent-fill-strong)"
              stroke="var(--color-figure-accent)"
              strokeWidth={step >= 1 ? 2.5 : 1.5}
            />
            <rect
              x={left + yesWidth}
              y={top}
              width={width - yesWidth}
              height={36}
              fill="var(--color-figure-empty)"
              stroke="var(--color-figure-axis)"
              strokeWidth={1.5}
            />
          </g>
        );
      })}
    </>
  );
}

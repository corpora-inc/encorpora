import { doubleDotLayout } from "../../math/data-display-models";
import { Mark, ScaleAxis } from "../DataDisplayFigure";
import type { MadGapAnimation } from "./model";

/** Two dot plots on one scale; their means appear, then MAD-long bricks
 * fill the gap between the means, so the gap reads as a count of MADs. */
export function MadGapStage({
  model,
  step,
}: {
  model: MadGapAnimation;
  step: number;
}) {
  const l = doubleDotLayout(model.figure, {
    width: 320,
    axes: [80, 166],
    gap: 11,
  });
  const [m1, m2] = model.means;
  const lo = Math.min(m1, m2),
    k = Math.abs(m1 - m2) / model.mad;
  const unit = l.x(1) - l.x(0);
  const bricks = Array.from({ length: Math.ceil(k) }, (_, i) => ({
    x: l.x(lo + i * model.mad),
    width: Math.min(1, k - i) * model.mad * unit,
  }));
  return (
    <>
      {l.panels.map((p, i) => (
        <g key={p.label} data-group={p.label}>
          <ScaleAxis
            left={l.left}
            right={l.right}
            axisY={p.axisY}
            ticks={l.ticks}
            labels={i === 1}
            labelDy={22}
          />
          {p.marks.map((m, j) => (
            <Mark key={j} kind="dot" cx={m.cx} cy={m.cy} />
          ))}
        </g>
      ))}
      <g className="animation-fade" style={{ opacity: step ? 1 : 0 }}>
        {model.means.map((m, i) => (
          <line
            key={i}
            data-mean={m}
            x1={l.x(m)}
            x2={l.x(m)}
            y1={i ? 92 : 14}
            y2={i ? 166 : 100}
            stroke="var(--color-figure-warm)"
            strokeWidth={2.5}
            strokeDasharray="5 4"
          />
        ))}
      </g>
      {bricks.map((b, i) => (
        <rect
          key={i}
          data-brick={i}
          x={b.x}
          y={91}
          width={b.width}
          height={10}
          rx={2}
          className="animation-move"
          fill={
            i % 2
              ? "var(--color-figure-gold-fill-strong)"
              : "var(--color-figure-accent-fill-strong)"
          }
          stroke="var(--color-figure-ink)"
          strokeWidth={1.2}
          style={{
            transform: `scaleX(${step === 2 ? 1 : 0})`,
            transformBox: "fill-box",
            transformOrigin: "left center",
            transitionDelay: step === 2 ? `${i * 160}ms` : "0ms",
          }}
        />
      ))}
    </>
  );
}

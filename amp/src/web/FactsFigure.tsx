import { count } from "../math/agreement";
import type { SemanticFigure } from "../math/contracts.js";

export type FactsFigureData = Extract<
  SemanticFigure,
  { kind: "ten-frame-pair" }
>;
const ink = "var(--color-figure-ink)";

/** Two separate ten-frames, one addend in each: nothing is pre-moved, so making
 * ten stays the learner's step. */
export function FactsFigure({ figure }: { figure: FactsFigureData }) {
  return (
    <svg
      className="figure elementary-figure"
      data-kind="ten-frame-pair"
      viewBox="0 0 300 220"
      role="img"
      aria-label={`Two ten-frames, each with ten places. The first holds ${count(figure.first, "round counter")}; the second holds ${count(figure.second, "square counter")}. Other places are empty.`}
    >
      {[0, 1].map((frame) =>
        Array.from({ length: 10 }, (_, index) => {
          const x = 25 + (index % 5) * 50,
            y = 10 + frame * 104 + Math.floor(index / 5) * 46;
          const filled = index < (frame ? figure.second : figure.first);
          return (
            <g key={`${frame}-${index}`}>
              <rect
                x={x}
                y={y}
                width="50"
                height="46"
                fill="var(--color-figure-paper)"
                stroke={ink}
                strokeWidth="1.5"
              />
              {filled &&
                (frame === 0 ? (
                  <circle
                    data-counter="first"
                    cx={x + 25}
                    cy={y + 23}
                    r="14"
                    fill="var(--color-figure-accent)"
                  />
                ) : (
                  <rect
                    data-counter="second"
                    x={x + 12}
                    y={y + 10}
                    width="26"
                    height="26"
                    rx="2"
                    fill="var(--color-figure-warm)"
                  />
                ))}
            </g>
          );
        }),
      )}
    </svg>
  );
}

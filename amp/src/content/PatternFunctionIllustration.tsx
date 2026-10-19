import React from "react";
import type { FunctionDisplayFigure } from "../math/contracts";
import { FunctionDisplay } from "../web/FunctionDisplay";

export type PatternFunctionIllustrationKind =
  | "pattern-rule-steps"
  | "related-patterns-graph"
  | "dependent-variable-graph"
  | "compare-functions-graph"
  | "linear-nonlinear-graph";

const figureStyle = { margin: "24px 0", breakInside: "avoid" as const };
const captionStyle = { marginTop: 12, lineHeight: 1.6 };

/** Fixed teaching models with the exact data the lessons cite. */
export const illustrationData: Record<
  Exclude<PatternFunctionIllustrationKind, "pattern-rule-steps">,
  { figure: FunctionDisplayFigure; caption: string }
> = {
  "related-patterns-graph": {
    figure: {
      kind: "function-display",
      table: {
        columns: ["Pattern A", "Pattern B"],
        rows: [0, 1, 2, 3, 4].map((i) => ({ x: 2 * i, y: 6 * i })),
      },
      graph: {
        xLabel: "A",
        yLabel: "B",
        xMax: 10,
        yMax: 30,
        xStep: 2,
        yStep: 5,
        series: [
          { points: [0, 1, 2, 3, 4].map((i) => ({ x: 2 * i, y: 6 * i })) },
        ],
      },
    },
    caption:
      "Pattern A adds 2 and pattern B adds 6, both from 0. Each pair (A, B) is a point; every B-term is 3 times its A-term, so the points lie on a straight line through (0, 0).",
  },
  "dependent-variable-graph": {
    figure: {
      kind: "function-display",
      table: {
        columns: ["t (hours)", "d (miles)"],
        rows: [1, 2, 3, 4].map((t) => ({ x: t, y: 65 * t })),
      },
      graph: {
        xLabel: "t (hours)",
        yLabel: "d (miles)",
        xMax: 5,
        yMax: 300,
        xStep: 1,
        yStep: 50,
        series: [
          {
            points: [1, 2, 3, 4].map((t) => ({ x: t, y: 65 * t })),
            line: { rise: 65, run: 1, b: 0 },
          },
        ],
      },
    },
    caption:
      "Time t is the independent variable, across; distance d is the dependent variable, up. In every column d ÷ t = 65, so d = 65t, a line through (0, 0) that rises 65 miles for each hour.",
  },
  "compare-functions-graph": {
    figure: {
      kind: "function-display",
      table: {
        title: "Function A",
        columns: ["x", "y"],
        rows: [0, 3, 6, 9].map((x) => ({ x, y: 2 * x + 1 })),
      },
      graph: {
        xLabel: "x",
        yLabel: "y",
        xMax: 10,
        yMax: 20,
        xStep: 1,
        yStep: 2,
        series: [
          {
            label: "A",
            points: [0, 3, 6, 9].map((x) => ({ x, y: 2 * x + 1 })),
            line: { rise: 2, run: 1, b: 1 },
          },
          {
            label: "B",
            points: [
              { x: 0, y: 6 },
              { x: 4, y: 8 },
            ],
            line: { rise: 1, run: 2, b: 6 },
          },
        ],
      },
    },
    caption:
      "Function A (solid line, round points) has rate of change 2 and initial value 1. Function B (dashed line, square points) has rate of change 1/2 and initial value 6. A is steeper; B starts higher.",
  },
  "linear-nonlinear-graph": {
    figure: {
      kind: "function-display",
      graph: {
        xLabel: "x",
        yLabel: "y",
        xMax: 4,
        yMax: 10,
        xStep: 1,
        yStep: 1,
        series: [
          {
            points: [0, 1, 2, 3].map((x) => ({ x, y: 2 * x + 1 })),
            line: { rise: 2, run: 1, b: 1 },
          },
          {
            points: [0, 1, 2, 3].map((x) => ({ x, y: x * x })),
          },
        ],
      },
    },
    caption:
      "Round points: y = 2x + 1 rises 2 at every step and lies on a straight line. Square points: y = x² rises 1, then 3, then 5, so its points bend upward and are not on any one line.",
  },
};

export function PatternFunctionIllustration({
  kind,
}: {
  kind: PatternFunctionIllustrationKind;
}) {
  if (kind === "pattern-rule-steps") return <RuleSteps />;
  const { figure, caption } = illustrationData[kind];
  return (
    <figure
      className="lesson-illustration"
      style={figureStyle}
      data-lesson-illustration={kind}
    >
      <FunctionDisplay figure={figure} />
      <figcaption style={captionStyle}>{caption}</figcaption>
    </figure>
  );
}

const ruleTerms = [3, 7, 11, 15, 19, 23];
function RuleSteps() {
  const x = (i: number) => 40 + i * 72;
  return (
    <figure className="lesson-illustration" style={figureStyle}>
      <svg
        data-lesson-illustration="pattern-rule-steps"
        data-start="3"
        data-step="4"
        viewBox="0 0 440 170"
        role="img"
        aria-label="The pattern 3, 7, 11, 15, 19, 23. An arrow labeled plus 4 joins each term to the next: five arrows for six terms. Every term is odd."
        style={{
          width: "100%",
          maxWidth: 460,
          display: "block",
          margin: "0 auto",
        }}
      >
        <title>Five applications of “add 4” reach the 6th term</title>
        {ruleTerms.slice(1).map((_, i) => (
          <g key={i} data-arrow={i + 1}>
            <path
              d={`M${x(i) + 10} 66 Q${(x(i) + x(i + 1)) / 2} 26 ${x(i + 1) - 10} 66`}
              fill="none"
              stroke="var(--color-figure-accent, #20776d)"
              strokeWidth="2.5"
            />
            <path
              d={`M${x(i + 1) - 18} 58 L${x(i + 1) - 10} 66 L${x(i + 1) - 20} 68`}
              fill="none"
              stroke="var(--color-figure-accent, #20776d)"
              strokeWidth="2.5"
            />
            <text
              x={(x(i) + x(i + 1)) / 2}
              y="30"
              textAnchor="middle"
              style={{ fontSize: 17, fill: "currentColor" }}
            >
              +4
            </text>
          </g>
        ))}
        {ruleTerms.map((term, i) => (
          <g key={term}>
            <circle
              cx={x(i)}
              cy="92"
              r="24"
              fill="var(--color-figure-accent-fill, #d4e9e1)"
              stroke="var(--color-figure-ink, #174a43)"
              strokeWidth="1.5"
            />
            <text
              x={x(i)}
              y="99"
              textAnchor="middle"
              data-term={term}
              style={{ fontSize: 20, fontWeight: 700, fill: "currentColor" }}
            >
              {term}
            </text>
            <text
              x={x(i)}
              y="140"
              textAnchor="middle"
              style={{ fontSize: 15, fill: "currentColor" }}
            >
              {["1st", "2nd", "3rd", "4th", "5th", "6th"][i]}
            </text>
            <text
              x={x(i)}
              y="162"
              textAnchor="middle"
              style={{ fontSize: 14, fill: "currentColor" }}
            >
              odd
            </text>
          </g>
        ))}
      </svg>
      <figcaption style={captionStyle}>
        Six terms need five steps: the 6th term is 3 + 5 × 4 = 23. The start is
        odd and each step adds an even number, so every term is odd.
      </figcaption>
    </figure>
  );
}

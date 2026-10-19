import { PatternFunctionIllustration } from "./PatternFunctionIllustration";
import { EquationIllustration } from "./EquationIllustration";
import { VolumeCoordinateIllustration } from "./VolumeCoordinateIllustration";
import { ShapeIllustration, isShapeIllustration } from "./ShapeIllustration";
import { PartWholeIllustration } from "./PartWholeIllustration";
import { DecimalIllustration } from "./DecimalIllustration";
import { TimeMoneyIllustration } from "./TimeMoneyIllustration";
import { CombinatoricsIllustration } from "./CombinatoricsIllustration";
import { RadicalIllustration } from "./RadicalIllustration";
import { ComparisonIllustration } from "./ComparisonIllustration";
import { MultiplyDivideIllustration } from "./MultiplyDivideIllustration";
import { AddSubtractIllustration } from "./AddSubtractIllustration";
import { FactsIllustration } from "./FactsIllustration";
import { FactArrayIllustration } from "./FactArrayIllustration";
import { RationalIllustration } from "./RationalIllustration";
import { CircleMeasurementIllustration } from "./CircleMeasurementIllustration";
import { IntegerExponentIllustration } from "./IntegerExponentIllustration";
import { DescriptiveStatisticsIllustration } from "./DescriptiveStatisticsIllustration";
import { PercentChangeIllustration } from "./PercentChangeIllustration";
import { InequalityHalfLines } from "./InequalityHalfLines";
import { LinearSystemIllustration } from "./LinearSystemIllustration";
import {
  RightTriangleOrientation,
  PythagoreanRearrangement,
} from "./RightTriangleIllustration";
import type { Lesson } from "./lessons";
import {
  dataIllustrations,
  isDataIllustration,
} from "./data-display-illustrations";
import { DataDisplayFigure } from "../web/DataDisplayFigure";
import React from "react";

/** Fixed instructional model: the same whole, subdivided without changing its length. */
export function LessonIllustration({
  kind,
}: {
  kind: NonNullable<Lesson["sections"][number]["illustration"]>;
}) {
  if (isShapeIllustration(kind)) return <ShapeIllustration kind={kind} />;
  if (isDataIllustration(kind))
    return <DataDisplayFigure figure={dataIllustrations[kind]} />;
  if (
    kind === "pattern-rule-steps" ||
    kind === "related-patterns-graph" ||
    kind === "dependent-variable-graph" ||
    kind === "compare-functions-graph" ||
    kind === "linear-nonlinear-graph"
  )
    return <PatternFunctionIllustration kind={kind} />;
  if (
    kind === "balance-remove" ||
    kind === "balance-split" ||
    kind === "balance-bags" ||
    kind === "undo-chain" ||
    kind === "equation-tape" ||
    kind === "two-step-tape" ||
    kind === "inequality-many-solutions"
  )
    return <EquationIllustration kind={kind} />;
  if (
    kind === "counting-tree" ||
    kind === "permutation-slots" ||
    kind === "combination-orders" ||
    kind === "independent-grid" ||
    kind === "expected-spinner"
  )
    return <CombinatoricsIllustration kind={kind} />;
  if (
    kind === "multiply-tens-groups" ||
    kind === "area-model-product" ||
    kind === "standard-algorithm-product" ||
    kind === "partial-quotients" ||
    kind === "partial-quotients-two-digit"
  )
    return <MultiplyDivideIllustration kind={kind} />;
  if (
    kind === "column-addition" ||
    kind === "base-ten-trade" ||
    kind === "column-subtraction-zero" ||
    kind === "column-multidigit"
  )
    return <AddSubtractIllustration kind={kind} />;
  if (
    kind === "five-frame-facts" ||
    kind === "count-on-hops" ||
    kind === "make-ten-frames" ||
    kind === "ten-hundred-digits"
  )
    return <FactsIllustration kind={kind} />;
  if (
    kind === "array-rows-columns" ||
    kind === "array-turn" ||
    kind === "split-array" ||
    kind === "fact-family-array" ||
    kind === "share-measure" ||
    kind === "missing-factor-skip" ||
    kind === "table-patterns"
  )
    return <FactArrayIllustration kind={kind} />;
  if (
    kind === "comparison-pairing" ||
    kind === "comparison-number-path" ||
    kind === "comparison-place-chart" ||
    kind === "large-place-value-chart"
  )
    return <ComparisonIllustration kind={kind} />;
  if (
    kind === "clock-hour-half" ||
    kind === "clock-five-minutes" ||
    kind === "coin-values" ||
    kind === "coin-count-on"
  )
    return <TimeMoneyIllustration kind={kind} />;
  if (
    kind === "decimal-tenths-hundredths" ||
    kind === "decimal-compare-chart" ||
    kind === "decimal-rounding-line" ||
    kind === "decimal-aligned-sum"
  )
    return <DecimalIllustration kind={kind} />;
  if (
    kind === "volume-layers" ||
    kind === "prism-composite" ||
    kind === "ordered-pair-path"
  )
    return <VolumeCoordinateIllustration kind={kind} />;
  if (
    kind === "equal-shares" ||
    kind === "same-share-shapes" ||
    kind === "equal-area-regions" ||
    kind === "compare-same-whole"
  )
    return <PartWholeIllustration kind={kind} />;
  if (
    kind === "radical-square-grid" ||
    kind === "radical-like-lengths" ||
    kind === "radical-product-grid" ||
    kind === "radical-rationalize"
  )
    return <RadicalIllustration kind={kind} />;
  if (
    kind === "signed-fraction-number-line" ||
    kind === "complex-fraction-scaling" ||
    kind === "rational-power-ladder"
  )
    return <RationalIllustration kind={kind} />;
  if (
    kind === "circle-circumference" ||
    kind === "circle-area" ||
    kind === "circle-arc" ||
    kind === "circle-sector"
  )
    return <CircleMeasurementIllustration kind={kind} />;
  if (kind === "integer-exponent-ladder")
    return <IntegerExponentIllustration />;
  if (kind === "descriptive-median")
    return <DescriptiveStatisticsIllustration kind="median" />;
  if (kind === "descriptive-range")
    return <DescriptiveStatisticsIllustration kind="range" />;
  if (kind === "descriptive-iqr")
    return <DescriptiveStatisticsIllustration kind="iqr" />;
  if (kind === "percent-change-bars" || kind === "percent-change-reverse")
    return (
      <PercentChangeIllustration reverse={kind === "percent-change-reverse"} />
    );
  if (kind === "right-triangle-orientation")
    return <RightTriangleOrientation />;
  if (kind === "pythagorean-rearrangement") return <PythagoreanRearrangement />;
  if (kind === "inequality-half-lines") return <InequalityHalfLines />;
  if (kind === "linear-system-intersection")
    return <LinearSystemIllustration kind="intersection" />;
  if (kind === "linear-system-count")
    return <LinearSystemIllustration kind="count" />;
  const rows = [
    { label: "One third", parts: 3, selected: 1, group: 1, y: 36 },
    {
      label: "1 third = 4 twelfths",
      parts: 12,
      selected: 4,
      group: 4,
      y: 106,
    },
    { label: "One fourth", parts: 4, selected: 1, group: 1, y: 186 },
    {
      label: "1 fourth = 3 twelfths",
      parts: 12,
      selected: 3,
      group: 3,
      y: 256,
    },
    {
      label: "4 + 3 = 7 twelfths",
      parts: 12,
      selected: 7,
      group: 1,
      y: 346,
    },
  ];
  return (
    <figure
      className="lesson-illustration"
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      <svg
        data-lesson-illustration={kind}
        viewBox="0 0 400 435"
        role="img"
        aria-label="Five equal-length bars represent the same-sized whole. One third is divided into four twelfths. One fourth is divided into three twelfths. Combining these amounts gives seven twelfths."
        style={{
          display: "block",
          width: "100%",
          maxWidth: "420px",
          margin: "0 auto",
        }}
      >
        <title>Thirds and fourths expressed as twelfths</title>
        {rows.map((row, index) => (
          <g key={row.label} data-model-row={index}>
            <text
              x="10"
              y={row.y - 10}
              style={{ font: "24px Arial, sans-serif", fill: "#18332f" }}
            >
              {row.label}
            </text>
            {Array.from({ length: row.parts }, (_, part) => (
              <rect
                key={part}
                data-part={part}
                data-selected={part < row.selected}
                x={10 + (380 * part) / row.parts}
                y={row.y}
                width={380 / row.parts}
                height="28"
                fill={
                  part >= row.selected
                    ? "#fff"
                    : index < 2 || (index === 4 && part < 4)
                      ? "#6aa69b"
                      : "#e5b15c"
                }
              />
            ))}
            {Array.from({ length: row.parts - 1 }, (_, part) => {
              const division = part + 1;
              const original = division % row.group === 0;
              return (
                <line
                  key={division}
                  x1={10 + (380 * division) / row.parts}
                  x2={10 + (380 * division) / row.parts}
                  y1={row.y}
                  y2={row.y + 28}
                  stroke="#18332f"
                  strokeWidth={original ? 1.5 : 1}
                  strokeDasharray={original ? undefined : "3 3"}
                />
              );
            })}
            <rect
              x="10"
              y={row.y}
              width="380"
              height="28"
              fill="none"
              stroke="#18332f"
              strokeWidth="1.5"
            />
          </g>
        ))}
        {[
          { start: 0, count: 4 },
          { start: 4, count: 3 },
        ].map(({ start, count }) => {
          const left = 10 + (380 * start) / 12;
          const right = 10 + (380 * (start + count)) / 12;
          return (
            <g key={start} data-sum-group={count}>
              <path
                d={`M ${left} 380 v 6 H ${right} v -6`}
                fill="none"
                stroke="#18332f"
                strokeWidth="1.5"
              />
              <text
                x={(left + right) / 2}
                y="414"
                textAnchor="middle"
                style={{ font: "24px Arial, sans-serif", fill: "#18332f" }}
              >
                {count}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption
        style={{ marginTop: "10px", fontSize: "0.95em", lineHeight: 1.6 }}
      >
        Every full bar represents one whole of the same size. Dashed lines show
        the new divisions within the original thirds and fourths; the shaded
        amount stays the same. In the last bar, every line marks a twelfth. The
        brackets group the four twelfths and the three twelfths placed end to
        end.
      </figcaption>
    </figure>
  );
}

import React from "react";

/** Fixed data and exact affine coordinates; each dot is one observation. */
export function DescriptiveStatisticsIllustration({
  kind,
}: {
  kind: "median" | "range" | "iqr";
}) {
  const values =
    kind === "iqr" ? [-4, -2, -2, 0, 1, 3, 4, 6, 8] : [-2, -1, 1, 3, 3, 8];
  const min = kind === "iqr" ? -4 : -2,
    max = 8,
    origin = 40,
    scale = kind === "iqr" ? 26 : 31.2;
  const x = (value: number) => origin + (value - min) * scale;
  const labelStyle = { font: "26px Arial, sans-serif", fill: "#18332f" };
  const stacks = new Map<number, number>();
  const points = values.map((value) => {
    const level = stacks.get(value) ?? 0;
    stacks.set(value, level + 1);
    return { value, level };
  });
  const left = kind === "median" ? 1 : kind === "range" ? -2 : -2,
    right = kind === "median" ? 3 : kind === "range" ? 8 : 5;
  const ticks = Array.from(
    { length: (max - min) / 2 + 1 },
    (_, i) => min + 2 * i,
  );
  return (
    <figure
      className="lesson-illustration"
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      <svg
        data-lesson-illustration={`descriptive-${kind}`}
        data-values={values.join(",")}
        data-min={min}
        data-max={max}
        data-origin={origin}
        data-unit-scale={scale}
        viewBox="0 0 400 310"
        role="img"
        aria-label={
          kind === "median"
            ? "Six observations: negative two, negative one, one, three, three, eight. The middle values one and three have midpoint two; no observation equals two."
            : kind === "range"
              ? "Six observations run from negative two to eight. A bracket measures the ten-unit distance between these endpoints."
              : "Nine observations: negative four, negative two, negative two, zero, one, three, four, six, eight. Excluding the middle observation one gives lower quartile negative two and upper quartile five, seven units apart."
        }
        style={{
          width: "100%",
          maxWidth: 440,
          display: "block",
          margin: "0 auto",
        }}
      >
        <title>
          {kind === "median"
            ? "Middle positions and their midpoint"
            : kind === "range"
              ? "The full span of the data"
              : "The span between quartiles"}
        </title>
        <text x="20" y="30" style={{ ...labelStyle, fontWeight: 700 }}>
          {kind === "median"
            ? "Six observations"
            : kind === "range"
              ? "Minimum to maximum"
              : "Nine observations"}
        </text>
        <line
          x1="28"
          x2="372"
          y1="145"
          y2="145"
          stroke="#18332f"
          strokeWidth="2"
        />
        {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(
          (value) => (
            <line
              key={value}
              data-tick={value}
              x1={x(value)}
              x2={x(value)}
              y1="140"
              y2="151"
              stroke="#18332f"
            />
          ),
        )}
        {ticks.map((value) => (
          <text
            key={value}
            data-tick-label={value}
            x={x(value)}
            y="180"
            textAnchor="middle"
            style={labelStyle}
          >
            {String(value).replace("-", "−")}
          </text>
        ))}
        {points.map(({ value, level }, i) => (
          <circle
            key={i}
            data-observation={i}
            data-value={value}
            data-stack={level}
            cx={x(value)}
            cy={123 - 26 * level}
            r="8"
            fill="#18332f"
          />
        ))}
        <path
          data-span={`${left},${right}`}
          d={`M${x(left)} 208 V220 H${x(right)} V208`}
          stroke="#18332f"
          fill="none"
          strokeWidth="2"
        />
        {kind === "median" ? (
          <>
            <path
              data-summary="median"
              data-value="2"
              d={`M${x(2) - 7} 198 L${x(2) + 7} 198 L${x(2)} 188 Z`}
              fill="#fff"
              stroke="#18332f"
              strokeWidth="2"
            />
            <text x="200" y="267" textAnchor="middle" style={labelStyle}>
              Median: 2
            </text>
          </>
        ) : kind === "range" ? (
          <text x="200" y="267" textAnchor="middle" style={labelStyle}>
            Range: 10 units
          </text>
        ) : (
          <>
            <line
              data-summary="Q1"
              data-value="-2"
              x1={x(-2)}
              x2={x(-2)}
              y1="188"
              y2="208"
              stroke="#18332f"
              strokeDasharray="5 4"
            />
            <line
              data-summary="Q3"
              data-value="5"
              x1={x(5)}
              x2={x(5)}
              y1="188"
              y2="208"
              stroke="#18332f"
              strokeDasharray="5 4"
            />
            <text x="20" y="253" style={labelStyle}>
              Q1 = −2
            </text>
            <text x="240" y="253" style={labelStyle}>
              Q3 = 5
            </text>
            <text x="200" y="286" textAnchor="middle" style={labelStyle}>
              IQR: 7 units
            </text>
          </>
        )}
      </svg>
      <figcaption style={{ marginTop: 12, lineHeight: 1.6 }}>
        {kind === "median"
          ? "Each dot is one observation. The two dots at 3 are separate observations. The bracket joins the two middle values, 1 and 3; the hollow marker identifies their midpoint, 2."
          : kind === "range"
            ? "Each dot is one observation. Equal horizontal intervals represent one unit. The bracket spans from −2 to 8, a distance of 10 units."
            : "Each dot is one observation. Exclude the overall middle position, whose value is 1. The dashed marks identify Q1 = −2 and Q3 = 5; the bracket spans their seven-unit difference."}
      </figcaption>
    </figure>
  );
}

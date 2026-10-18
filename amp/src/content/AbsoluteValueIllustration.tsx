import React from "react";
const ink = "#173d39",
  accent = "#146b60";
const textStyle = { font: "24px system-ui, sans-serif", fill: ink };
/** Exact equal-unit number lines; only filled circles identify solutions. */
export function AbsoluteValueIllustration({
  shifted = false,
}: {
  shifted?: boolean;
}) {
  const center = shifted ? 2 : 0;
  const x = (value: number) => 200 + 48 * (value - center);
  const label = (value: number) => String(value).replace("-", "−");
  return (
    <figure
      data-lesson-illustration="absolute-value"
      data-absolute-value-model={shifted ? "shifted" : "distance"}
      style={{ margin: "1.2rem 0", breakInside: "avoid" }}
    >
      <svg
        viewBox={`0 0 400 ${shifted ? 190 : 325}`}
        role="img"
        aria-label={
          shifted
            ? "The solutions of absolute value of x minus two equals three are negative one and five, each three units from two."
            : "The solutions of absolute value of x equals three are negative three and three. For absolute value of x equals zero, the only solution is zero."
        }
        style={{
          display: "block",
          width: "100%",
          maxWidth: 520,
          margin: "0 auto",
          height: "auto",
          overflow: "visible",
        }}
      >
        <title>
          {shifted ? "Equal distances from 2" : "Positive and zero distances"}
        </title>
        <text x="200" y="28" textAnchor="middle" style={textStyle}>
          {shifted ? "|x − 2| = 3" : "|x| = 3"}
        </text>
        <path
          d="M 56 85 V 62 H 200 V 85 M 200 85 V 62 H 344 V 85"
          fill="none"
          stroke={accent}
          strokeWidth="2"
        />
        <text x="128" y="53" textAnchor="middle" style={textStyle}>
          3 units
        </text>
        <text x="272" y="53" textAnchor="middle" style={textStyle}>
          3 units
        </text>
        <path
          d="M 22 110 H 378 M 22 110 L 31 105 M 22 110 L 31 115 M 378 110 L 369 105 M 378 110 L 369 115"
          fill="none"
          stroke={ink}
          strokeWidth="2"
        />
        {Array.from({ length: 7 }, (_, i) => center + i - 3).map((value) => (
          <g key={value}>
            <path d={`M ${x(value)} 104 V 116`} stroke={ink} strokeWidth="2" />
            <text x={x(value)} y="148" textAnchor="middle" style={textStyle}>
              {label(value)}
            </text>
          </g>
        ))}
        {[center - 3, center + 3].map((value) => (
          <circle
            key={value}
            data-solution={value}
            cx={x(value)}
            cy="110"
            r="7"
            fill={accent}
          />
        ))}
        {shifted ? (
          <text x="200" y="181" textAnchor="middle" style={textStyle}>
            2 is the center, not a solution.
          </text>
        ) : (
          <>
            <text x="200" y="211" textAnchor="middle" style={textStyle}>
              |x| = 0
            </text>
            <path
              d="M 22 254 H 378 M 22 254 L 31 249 M 22 254 L 31 259 M 378 254 L 369 249 M 378 254 L 369 259"
              fill="none"
              stroke={ink}
              strokeWidth="2"
            />
            {[-3, -2, -1, 0, 1, 2, 3].map((value) => (
              <g key={value}>
                <path
                  d={`M ${x(value)} 248 V 260`}
                  stroke={ink}
                  strokeWidth="2"
                />
                <text
                  x={x(value)}
                  y="292"
                  textAnchor="middle"
                  style={textStyle}
                >
                  {label(value)}
                </text>
              </g>
            ))}
            <circle
              data-zero-solution="0"
              cx="200"
              cy="254"
              r="7"
              fill={accent}
            />
          </>
        )}
      </svg>
      <figcaption style={{ marginTop: ".65rem", lineHeight: 1.55 }}>
        {shifted
          ? "The filled points −1 and 5 are each 3 units from 2. Equal tick spacing represents one unit; the unfilled tick at 2 identifies the center."
          : "A positive distance of 3 units gives two solution points. Distance zero gives only one. Each tick interval is one unit; the connecting line is a scale, not a marked interval of solutions."}
      </figcaption>
    </figure>
  );
}

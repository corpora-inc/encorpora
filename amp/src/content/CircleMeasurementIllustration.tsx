import React from "react";

export type CircleIllustrationKind =
  "circle-circumference" | "circle-area" | "circle-arc" | "circle-sector";
/** The SVG coordinates preserve each displayed radius and central angle. */
export function CircleMeasurementIllustration({
  kind,
}: {
  kind: CircleIllustrationKind;
}) {
  const radius =
    kind === "circle-circumference"
      ? 5
      : kind === "circle-area"
        ? 3
        : kind === "circle-arc"
          ? 6
          : 4;
  const angle =
    kind === "circle-arc" ? 150 : kind === "circle-sector" ? 270 : null;
  const cx = 180,
    cy = 155,
    pixels = 110,
    scale = pixels / radius;
  const point = (degrees: number, distance = pixels) => [
    cx + distance * Math.cos((degrees * Math.PI) / 180),
    cy - distance * Math.sin((degrees * Math.PI) / 180),
  ];
  const endpoint = point(angle ?? 0),
    marker = point(angle ?? 0, 32),
    label = point((angle ?? 0) / 2, 63);
  const arc =
    angle === null
      ? ""
      : `M ${cx + pixels} ${cy} A ${pixels} ${pixels} 0 ${angle > 180 ? 1 : 0} 0 ${endpoint[0]} ${endpoint[1]}`;
  const textStyle = { fontSize: 26, fill: "currentColor" };
  const caption =
    kind === "circle-circumference"
      ? "The diameter is two radii. Circumference measures the curved boundary, not the diameter across it."
      : kind === "circle-area"
        ? "Area measures the region inside the circle. The small square shows one square centimeter at the same scale."
        : kind === "circle-arc"
          ? "The thick arc follows a 150-degree turn: five twelfths of the boundary. The two straight segments are radii."
          : "The shaded sector follows a 270-degree turn: three quarters of the circle's area. The unshaded quarter is excluded.";
  return (
    <figure
      className="lesson-illustration"
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      <svg
        viewBox="0 0 360 350"
        role="img"
        aria-label={`${kind === "circle-arc" ? "Arc" : kind === "circle-sector" ? "Sector" : "Circle"} with radius ${radius} centimeters${angle === null ? ` and diameter ${2 * radius} centimeters` : ` and central angle ${angle} degrees`}. ${caption}`}
        data-lesson-illustration={kind}
        data-radius={radius}
        data-angle={angle ?? "full"}
        data-center-x={cx}
        data-center-y={cy}
        data-pixels-per-unit={scale}
        style={{
          width: "100%",
          maxWidth: 400,
          display: "block",
          margin: "0 auto",
          color: "inherit",
        }}
      >
        <defs>
          <pattern
            id={`${kind}-hatch`}
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M -2 2 L 2 -2 M 0 10 L 10 0 M 8 12 L 12 8"
              stroke="currentColor"
              strokeWidth="1"
              opacity=".15"
            />
          </pattern>
        </defs>
        <circle
          data-circle="boundary"
          cx={cx}
          cy={cy}
          r={pixels}
          fill={kind === "circle-area" ? `url(#${kind}-hatch)` : "none"}
          stroke="currentColor"
          strokeWidth={angle === null ? 3 : 1.5}
          opacity={angle === null ? 1 : 0.45}
        />
        {angle === null ? (
          <>
            <line
              data-segment="diameter"
              x1={cx - pixels}
              y1={cy}
              x2={cx + pixels}
              y2={cy}
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="7 5"
            />
            <line
              data-segment="radius"
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy - pixels}
              stroke="currentColor"
              strokeWidth="3"
            />
            <text x={cx + 13} y={cy - 45} style={textStyle}>
              r = {radius} cm
            </text>
            <text x={cx} y={cy + 39} textAnchor="middle" style={textStyle}>
              d = {radius * 2} cm
            </text>
          </>
        ) : (
          <>
            {kind === "circle-sector" && (
              <path
                data-region="sector"
                d={`M ${cx} ${cy} L ${cx + pixels} ${cy} A ${pixels} ${pixels} 0 1 0 ${endpoint[0]} ${endpoint[1]} Z`}
                fill={`url(#${kind}-hatch)`}
                stroke="none"
              />
            )}
            <path
              data-arc="selected"
              d={arc}
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
            />
            <line
              data-segment="radius-start"
              x1={cx}
              y1={cy}
              x2={cx + pixels}
              y2={cy}
              stroke="currentColor"
              strokeWidth="2"
            />
            <line
              data-segment="radius-end"
              x1={cx}
              y1={cy}
              x2={endpoint[0]}
              y2={endpoint[1]}
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              data-arc="angle-marker"
              d={`M ${cx + 32} ${cy} A 32 32 0 ${angle > 180 ? 1 : 0} 0 ${marker[0]} ${marker[1]}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <text
              x={label[0]}
              y={label[1]}
              textAnchor="middle"
              style={textStyle}
            >
              {angle}°
            </text>
            <text x={cx + 56} y={cy + 33} textAnchor="middle" style={textStyle}>
              r = {radius} cm
            </text>
          </>
        )}
        <circle cx={cx} cy={cy} r="3" fill="currentColor" />
        <text
          x={cx - (angle === null ? 20 : kind === "circle-sector" ? 25 : 17)}
          y={cy + (angle === null ? -12 : kind === "circle-sector" ? 70 : 23)}
          textAnchor="middle"
          style={{ ...textStyle, fontSize: 23 }}
        >
          O
        </text>
        {kind === "circle-area" && (
          <>
            <rect
              data-unit-square="1"
              x="12"
              y="295"
              width={scale}
              height={scale}
              fill={`url(#${kind}-hatch)`}
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <text x="62" y="321" style={{ ...textStyle, fontSize: 24 }}>
              1 square cm
            </text>
          </>
        )}
      </svg>
      <figcaption style={{ marginTop: 12, lineHeight: 1.6 }}>
        {caption}
      </figcaption>
    </figure>
  );
}

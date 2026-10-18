import React from "react";
/** Equal lengths retain the same original unit in every panel. */
export function PercentChangeIllustration({
  reverse = false,
}: {
  reverse?: boolean;
}) {
  const panels = reverse
    ? [{ id: "recover", title: "Recover the original", final: 60, change: -20 }]
    : [
        { id: "increase", title: "Increase by 25%", final: 100, change: 20 },
        { id: "decrease", title: "Decrease by 25%", final: 60, change: -20 },
      ];
  return (
    <figure
      className="lesson-illustration"
      style={{ margin: "24px 0", breakInside: "avoid" }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))",
          gap: "20px",
        }}
      >
        {panels.map((panel) => (
          <svg
            key={panel.id}
            viewBox="0 0 420 260"
            role="img"
            aria-label={
              reverse
                ? "Three equal segments contain 60 units and represent 75% of the original. Each segment contains 20 units; four segments contain the original 80 units."
                : `The original 80 units occupy four equal segments of 20. ${panel.change > 0 ? "One additional segment makes 100 units, 125% of the original." : "Removing one segment leaves 60 units, 75% of the original."}`
            }
            data-lesson-illustration="percent-change-bars"
            data-panel={panel.id}
            data-original="80"
            data-final={panel.final}
            data-origin="25"
            data-unit-scale="3.6"
            style={{
              width: "100%",
              maxWidth: 420,
              display: "block",
              margin: "0 auto",
              font: "22px Arial,sans-serif",
              color: "#18332f",
            }}
          >
            <title>{panel.title}</title>
            <defs>
              <pattern
                id={`percent-hatch-${panel.id}`}
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
              >
                <path d="M0 8L8 0" stroke="#6a7e7a" strokeWidth="1" />
              </pattern>
            </defs>
            <text
              style={{ fontSize: 25, fontFamily: "Arial, sans-serif" }}
              x="25"
              y="25"
              fill="currentColor"
              fontWeight="700"
            >
              {panel.title}
            </text>
            <text
              style={{ fontSize: 25, fontFamily: "Arial, sans-serif" }}
              x="25"
              y="58"
              fill="currentColor"
            >
              {reverse
                ? "Original: 4 equal parts"
                : "Original: 80 units = 100%"}
            </text>
            {[0, 1, 2, 3].map((i) => (
              <g key={`original-${i}`}>
                <rect
                  data-bar="original"
                  data-interval={`${20 * i},${20 * (i + 1)}`}
                  x={25 + 72 * i}
                  y="72"
                  width="72"
                  height="40"
                  fill="#edf3f0"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <text
                  style={{ fontSize: 25, fontFamily: "Arial, sans-serif" }}
                  x={61 + 72 * i}
                  y="99"
                  textAnchor="middle"
                  fill="currentColor"
                >
                  20
                </text>
              </g>
            ))}
            <text
              style={{ fontSize: 25, fontFamily: "Arial, sans-serif" }}
              x="25"
              y="149"
              fill="currentColor"
            >
              {reverse
                ? "Known: 60 units = 75%"
                : `Final: ${panel.final} units = ${(panel.final / 80) * 100}%`}
            </text>
            {Array.from({ length: panel.final / 20 }, (_, i) => (
              <g key={`final-${i}`}>
                <rect
                  data-bar="final"
                  data-interval={`${20 * i},${20 * (i + 1)}`}
                  x={25 + 72 * i}
                  y="163"
                  width="72"
                  height="40"
                  fill={i === 4 ? `url(#percent-hatch-${panel.id})` : "#edf3f0"}
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <text
                  style={{ fontSize: 25, fontFamily: "Arial, sans-serif" }}
                  x={61 + 72 * i}
                  y="190"
                  textAnchor="middle"
                  fill="currentColor"
                >
                  20
                </text>
              </g>
            ))}
            {panel.change < 0 && (
              <rect
                data-removed="60,80"
                x="241"
                y="163"
                width="72"
                height="40"
                fill={`url(#percent-hatch-${panel.id})`}
                stroke="currentColor"
                strokeDasharray="5 4"
              />
            )}
            <text
              style={{ fontSize: 25, fontFamily: "Arial, sans-serif" }}
              x="25"
              y="237"
              fill="currentColor"
            >
              {reverse
                ? "60 ÷ 3 = 20; 4 × 20 = 80"
                : panel.change > 0
                  ? "Added: 20 units = 25%"
                  : "Removed: 20 units = 25%"}
            </text>
          </svg>
        ))}
      </div>
      <figcaption style={{ marginTop: 12, lineHeight: 1.6 }}>
        Each equal segment represents 20 units, one quarter of the original
        quantity. The original 80 units define 100% throughout.
      </figcaption>
    </figure>
  );
}

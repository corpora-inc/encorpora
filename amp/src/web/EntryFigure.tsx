import {
  entryFigureDescription,
  type EntryFigure as Model,
} from "../math/entry-models.js";
export function EntryFigure({ figure }: { figure: Model }) {
  const teal = "#20776d",
    coral = "#b3533b";
  return (
    <svg
      className="figure entry-figure"
      data-kind={figure.kind}
      viewBox="0 0 320 180"
      role="img"
      aria-label={entryFigureDescription(figure)}
    >
      {figure.kind === "aligned-strips" ? (
        <>
          <line
            x1={58}
            x2={58}
            y1={22}
            y2={156}
            stroke="#174a43"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
          {figure.lengths.map((length, i) => (
            <g key={i}>
              <text
                x={29}
                y={i === 0 ? 66 : 131}
                textAnchor="middle"
                style={{
                  fontFamily: "Arial, sans-serif",
                  fontSize: 24,
                  fontWeight: 700,
                  fill: "#174a43",
                }}
              >
                {i === 0 ? "A" : "B"}
              </text>
              <rect
                x={58}
                y={i === 0 ? 42 : 107}
                width={length}
                height={34}
                rx={2}
                fill={
                  (i === 0) === (figure.tone === "teal-first")
                    ? "#d9ebe5"
                    : "#f8dec4"
                }
                stroke={
                  (i === 0) === (figure.tone === "teal-first") ? teal : coral
                }
                strokeWidth={2}
              />
            </g>
          ))}
        </>
      ) : (
        <g
          fill={figure.tone === "teal" ? "#d9ebe5" : "#f8dec4"}
          stroke={figure.tone === "teal" ? teal : coral}
          strokeWidth={3}
          strokeLinejoin="round"
        >
          {figure.outline.form === "round" ? (
            <circle cx={160} cy={90} r={figure.outline.radius} />
          ) : (
            <polygon
              points={figure.outline.vertices.map((p) => p.join(",")).join(" ")}
            />
          )}
        </g>
      )}
    </svg>
  );
}

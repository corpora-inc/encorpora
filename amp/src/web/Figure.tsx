import { GraphicalFigure } from "./GraphicalFigure";
import type { SemanticFigure } from "../math/contracts";
export function Figure({ figure }: { figure: SemanticFigure }) {
  switch (figure.kind) {
    case "coordinate-plane":
    case "bar-chart":
    case "clock":
    case "number-line":
      return <GraphicalFigure figure={figure} />;
    case "collection":
      return (
        <svg
          className="figure"
          viewBox="0 0 360 180"
          role="group"
          aria-label="A collection of individually labeled objects to count"
        >
          {Array.from({ length: figure.count }, (_, i) => (
            <circle
              role="img"
              aria-label={`Object ${i + 1}`}
              key={i}
              cx={40 + (i % 5) * 68}
              cy={50 + Math.floor(i / 5) * 75}
              r={22}
              fill={i % 2 ? "#e7a146" : "#20776d"}
            />
          ))}
        </svg>
      );
    case "fraction":
      return (
        <svg
          className="figure"
          viewBox="0 0 400 130"
          role="img"
          aria-label={`${figure.parts} equal parts, ${figure.selected} shaded`}
        >
          {Array.from({ length: figure.parts }, (_, i) => (
            <rect
              key={i}
              x={12 + (i * 376) / figure.parts}
              y="30"
              width={376 / figure.parts}
              height="65"
              fill={i < figure.selected ? "#20776d" : "#f6f2e8"}
              stroke="#123b38"
              strokeWidth="2"
            />
          ))}
        </svg>
      );
    case "rectangle": {
      const scale = 210 / Math.max(figure.width, figure.height);
      const w = figure.width * scale,
        h = figure.height * scale;
      return (
        <svg
          className="figure"
          viewBox="0 0 320 280"
          role="img"
          aria-label={`Rectangle with side lengths ${figure.width} and ${figure.height} centimeters`}
        >
          <rect
            x="60"
            y="25"
            width={w}
            height={h}
            fill="#d4e9e1"
            stroke="#20776d"
            strokeWidth="3"
          />
          <text x={60 + w / 2} y={h + 55} textAnchor="middle">
            {figure.width} cm
          </text>
          <text x="48" y={25 + h / 2} textAnchor="end">
            {figure.height}
          </text>
        </svg>
      );
    }
    case "right-triangle": {
      const scale = 200 / Math.max(figure.a, figure.b),
        w = figure.a * scale,
        h = figure.b * scale;
      return (
        <svg
          className="figure"
          viewBox="0 0 320 270"
          role="img"
          aria-label={`Right triangle with perpendicular sides ${figure.a} and ${figure.b} centimeters`}
        >
          <path
            d={`M60 25 L60 ${25 + h} L${60 + w} ${25 + h} Z`}
            fill="#d4e9e1"
            stroke="#20776d"
            strokeWidth="3"
          />
          <path d={`M60 ${13 + h} h12 v12`} fill="none" stroke="#20776d" />
          <text x={60 + w / 2} y={55 + h} textAnchor="middle">
            {figure.a} cm
          </text>
          <text x="48" y={25 + h / 2} textAnchor="end">
            {figure.b}
          </text>
          <text x={80 + w / 2} y={10 + h / 2}>
            ?
          </text>
        </svg>
      );
    }
    case "dataset":
      return (
        <div className="dataset" aria-label="Data values">
          {figure.values.map((value, i) => (
            <span key={i}>{value}</span>
          ))}
        </div>
      );
  }
}

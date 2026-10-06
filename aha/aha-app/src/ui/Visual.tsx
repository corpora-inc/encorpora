import React from "react";
import { useState } from "react";
import type { StudioVisual } from "./types";

const finite = (n: number) => Number.isFinite(n);
export function isSafeVisual(v: StudioVisual): boolean {
  switch (v.type) {
    case "fraction":
      return (
        Number.isInteger(v.numerator) &&
        Number.isInteger(v.denominator) &&
        v.denominator >= 1 &&
        v.denominator <= 24 &&
        v.numerator >= 0 &&
        v.numerator <= v.denominator
      );
    case "array":
      return [v.rows, v.columns].every(
        (n) => Number.isInteger(n) && n >= 1 && n <= 12,
      );
    case "number-line":
      return (
        finite(v.min) &&
        finite(v.max) &&
        v.max > v.min &&
        Math.abs(v.min) <= 1000000 &&
        Math.abs(v.max) <= 1000000 &&
        (v.step === undefined ||
          (finite(v.step) && v.step > 0 && finite((v.max - v.min) / v.step))) &&
        (v.marks ?? []).length <= 24 &&
        (v.marks ?? []).every((n) => finite(n) && n >= v.min && n <= v.max)
      );
    case "place-value":
      return Number.isInteger(v.value) && v.value >= 0 && v.value <= 999999;
    case "coordinates":
      return (
        v.points.length <= 20 &&
        (v.extent === undefined ||
          (finite(v.extent) && v.extent >= 1 && v.extent <= 20)) &&
        v.points.every(
          (p) =>
            finite(p.x) &&
            finite(p.y) &&
            Math.abs(p.x) <= (v.extent ?? 20) &&
            Math.abs(p.y) <= (v.extent ?? 20),
        )
      );
    case "rectangle":
      return [v.width, v.height].every(
        (n) => finite(n) && n > 0 && n <= 1000000,
      );
    case "cuboid":
      return [v.width, v.height, v.depth].every(
        (n) => finite(n) && n > 0 && n <= 1000000,
      );
    default:
      return false;
  }
}
export function Visual({ spec }: { spec: StudioVisual }) {
  const [turned, setTurned] = useState(false);
  if (!isSafeVisual(spec))
    return (
      <p className="visual-unavailable">This diagram could not be displayed.</p>
    );
  let content;
  let description = "";
  if (spec.type === "fraction") {
    description = `${spec.numerator} of ${spec.denominator} equal parts shaded`;
    content = (
      <div className="fraction-picture">
        <div
          className="fraction-bar"
          style={{ gridTemplateColumns: `repeat(${spec.denominator}, 1fr)` }}
        >
          {Array.from({ length: spec.denominator }, (_, i) => (
            <span className={i < spec.numerator ? "filled" : ""} key={i} />
          ))}
        </div>
        <div className="fraction-bracket">one whole</div>
      </div>
    );
  } else if (spec.type === "array") {
    description = `${spec.rows} rows of ${spec.columns} dots`;
    content = (
      <div
        className="dot-array"
        style={{
          gridTemplateColumns: `repeat(${spec.columns}, minmax(8px, 25px))`,
        }}
      >
        {Array.from({ length: spec.rows * spec.columns }, (_, i) => (
          <span
            key={i}
            className={Math.floor(i / spec.columns) % 2 ? "teal" : ""}
          />
        ))}
      </div>
    );
  } else if (spec.type === "place-value") {
    description = `${spec.value} represented in place values`;
    const digits = String(spec.value).padStart(3, "0");
    const places = [
      "hundred-thousands",
      "ten-thousands",
      "thousands",
      "hundreds",
      "tens",
      "ones",
    ].slice(-digits.length);
    content = (
      <div
        className="place-values"
        style={{
          gridTemplateColumns: `repeat(${digits.length}, minmax(0, 1fr))`,
        }}
      >
        {digits.split("").map((digit, i) => (
          <div key={i}>
            <strong>{digit}</strong>
            <span>{places[i]}</span>
          </div>
        ))}
      </div>
    );
  } else if (spec.type === "number-line") {
    description = `Number line from ${spec.min} to ${spec.max}. Marked: ${(spec.marks ?? []).join(", ") || "none"}`;
    const requestedStep = spec.step ?? (spec.max - spec.min) / 8;
    const intervalCount = (spec.max - spec.min) / requestedStep;
    const step = requestedStep * Math.max(1, Math.ceil(intervalCount / 12));
    const ticks = Array.from(
      { length: Math.min(25, Math.floor((spec.max - spec.min) / step) + 1) },
      (_, i) => spec.min + i * step,
    );
    const x = (n: number) =>
      35 + ((n - spec.min) / (spec.max - spec.min)) * 450;
    content = (
      <svg viewBox="0 45 520 65" aria-hidden="true">
        <path
          d="M25 65 H495 M485 59 L495 65 L485 71"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        {ticks.map((n, i) => (
          <g key={i}>
            <path d={`M${x(n)} 57 V73`} stroke="currentColor" />
            <text x={x(n)} y="98" textAnchor="middle">
              {String(Number(n.toFixed(3))).replace("-", "\u2212")}
            </text>
          </g>
        ))}
        {(spec.marks ?? []).map((n, i) => (
          <circle key={i} cx={x(n)} cy="65" r="8" fill="var(--coral)" />
        ))}
      </svg>
    );
  } else if (spec.type === "coordinates") {
    const extent = Math.ceil(
      spec.extent ??
        Math.max(
          6,
          ...spec.points.flatMap((p) => [Math.abs(p.x), Math.abs(p.y)]),
        ),
    );
    const scale = 105 / extent;
    description = `Coordinate plane. Points: ${spec.points.map((p) => `${p.label ?? ""} (${p.x}, ${p.y})`).join("; ")}`;
    content = (
      <svg viewBox="0 0 320 270" aria-hidden="true">
        {Array.from({ length: extent * 2 + 1 }, (_, i) => (
          <g key={i} className="grid-line">
            <path d={`M${160 + (i - extent) * scale} 30 V240`} />
            <path d={`M55 ${135 + (i - extent) * scale} H265`} />
          </g>
        ))}
        <path
          d="M45 135 H278 M160 20 V248"
          stroke="currentColor"
          strokeWidth="2"
        />
        <text x="285" y="139" className="axis-name">
          x
        </text>
        <text x="168" y="24" className="axis-name">
          y
        </text>
        <text x="144" y="151">
          0
        </text>
        {spec.points.map((p, i) => (
          <g key={i}>
            <circle
              cx={160 + p.x * scale}
              cy={135 - p.y * scale}
              r="6"
              fill="var(--coral)"
            />
            <text
              x={169 + p.x * scale}
              y={128 - p.y * scale}
              className="dim-label"
            >
              {(p.label ?? "").slice(0, 20)}
            </text>
          </g>
        ))}
      </svg>
    );
  } else if (spec.type === "rectangle") {
    description = `Rectangle: width ${spec.width}, height ${spec.height}. Diagram not to scale.`;
    content = (
      <svg viewBox="0 0 400 230" aria-hidden="true">
        <rect
          x="70"
          y="35"
          width="250"
          height="145"
          rx="4"
          fill="var(--teal-light)"
          stroke="var(--teal)"
          strokeWidth="2"
        />
        <path
          d="M80 195 H310 M80 190 V200 M310 190 V200 M335 45 V170 M330 45 H340 M330 170 H340"
          stroke="currentColor"
          fill="none"
        />
        <text x="195" y="221" textAnchor="middle" className="dim-label">
          {spec.width}
        </text>
        <text x="347" y="113" className="dim-label">
          {spec.height}
        </text>
      </svg>
    );
  } else {
    description = `Cuboid: width ${spec.width}, height ${spec.height}, depth ${spec.depth}. Diagram not to scale.`;
    content = (
      <>
        <svg
          viewBox="0 0 400 250"
          aria-hidden="true"
          className={turned ? "cuboid turned" : "cuboid"}
        >
          <path
            d="M100 85 L235 85 L235 205 L100 205Z"
            fill="var(--coral-light)"
            stroke="var(--coral)"
            strokeWidth="2"
          />
          <path
            d="M100 85 L155 40 L290 40 L235 85Z"
            fill="var(--gold-light)"
            stroke="var(--coral)"
            strokeWidth="2"
          />
          <path
            d="M235 85 L290 40 L290 160 L235 205Z"
            fill="var(--fig-cuboid-side)"
            stroke="var(--coral)"
            strokeWidth="2"
          />
        </svg>
        <div className="cuboid-dimensions">
          {spec.width} × {spec.height} × {spec.depth}
        </div>
        <button
          className="text-button"
          type="button"
          onClick={() => setTurned(!turned)}
        >
          Turn the shape ↻
        </button>
      </>
    );
  }
  return (
    <figure
      className={`math-visual visual-${spec.type}`}
      aria-label={description}
    >
      <div>{content}</div>
      {spec.label && <figcaption>{spec.label.slice(0, 200)}</figcaption>}
      {(spec.type === "rectangle" || spec.type === "cuboid") && (
        <small>Diagram not to scale</small>
      )}
    </figure>
  );
}

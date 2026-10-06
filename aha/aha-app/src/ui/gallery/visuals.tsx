/** DEV/TEST-ONLY: every local task visual type (src/ui/Visual.tsx) from TEST FIXTURE props, in the
 * studio's own theme (light/dark follow prefers-color-scheme). Used by scripts/figure-contrast.mjs. */
import React from "react";
import ReactDOM from "react-dom/client";
import { Visual } from "../Visual";
import type { StudioVisual } from "../types";
import "../studio.css";

export const visuals: StudioVisual[] = [
  { type: "fraction", numerator: 3, denominator: 8 },
  { type: "array", rows: 3, columns: 6 },
  { type: "number-line", min: 0, max: 10, marks: [3, 7], label: "Jumps of 4" },
  { type: "number-line", min: -6, max: 6, step: 1, marks: [-4] },
  { type: "place-value", value: 4072 },
  { type: "coordinates", points: [{ x: 3, y: 2, label: "A" }, { x: -2, y: 4, label: "B" }, { x: -4, y: -3, label: "C" }] },
  { type: "rectangle", width: 6, height: 8 },
  { type: "rectangle", width: 12, height: 7, label: "A garden bed" },
  { type: "cuboid", width: 4, height: 3, depth: 2 },
];

ReactDOM.createRoot(document.getElementById("root")!).render(
  <main style={{ padding: "24px 16px 48px", display: "grid", gap: 24, maxWidth: 520, margin: "0 auto" }}>
    {visuals.map((v, i) => <section key={i} data-visual={`${v.type}-${i}`}><Visual spec={v} /></section>)}
  </main>,
);

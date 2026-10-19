import React from "react";
import type { Drawn, Layout } from "../../math/scene/layout";
import type { FillRole, InkRole } from "../../math/scene/spec";
import type { RunFont } from "../../math/scene/type";

/** Every paint is a theme role; print pages carry the light roles. */
const ink: Record<InkRole, string> = {
  ink: "var(--color-figure-ink)",
  axis: "var(--color-figure-axis)",
  grid: "var(--color-figure-grid)",
  accent: "var(--color-figure-accent)",
  warm: "var(--color-figure-warm)",
  gold: "var(--color-figure-gold)",
  muted: "var(--color-muted-text)",
  paper: "var(--color-figure-paper)",
};
const fill: Record<FillRole, string> = {
  none: "none",
  paper: "var(--color-figure-paper)",
  empty: "var(--color-figure-empty)",
  ink: "var(--color-figure-ink)",
  accent: "var(--color-figure-accent)",
  warm: "var(--color-figure-warm)",
  gold: "var(--color-figure-gold)",
  "accent-fill": "var(--color-figure-accent-fill)",
  "warm-fill": "var(--color-figure-warm-fill)",
  "gold-fill": "var(--color-figure-gold-fill)",
  "accent-strong": "var(--color-figure-accent-fill-strong)",
  "gold-strong": "var(--color-figure-gold-fill-strong)",
};
export const paint = { ink, fill };

export type Medium = "screen" | "print";
/** Print pages set --scene-sans to their body face (Arial); the metrics
 * cover both it and the UI faces. */
const sans =
  'var(--scene-sans, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif)';
const families = (medium: Medium): Record<RunFont, string> => ({
  main: 'KaTeX_Main, "Times New Roman", serif',
  italic: 'KaTeX_Math, "Times New Roman", serif',
  sans: medium === "print" ? "Arial, Helvetica, sans-serif" : sans,
  sansBold: medium === "print" ? "Arial, Helvetica, sans-serif" : sans,
});
const dashes = { dash: "7 5", dot: "1.5 4.5" } as const;
const dataAttrs = (d: Drawn) =>
  Object.fromEntries(
    Object.entries(d.data ?? {}).map(([k, v]) => [`data-${k}`, v]),
  );

/** Per-element animation state, applied by the timeline player. */
export type ItemState = {
  opacity?: number;
  /** Pixel translation. */
  dx?: number;
  dy?: number;
  /** Fraction of a stroke drawn, for trace. */
  drawn?: number;
  /** Text shown in place of the label (count up). */
  text?: string;
  fill?: FillRole;
  stroke?: InkRole;
  highlight?: boolean;
};

function Item({
  d,
  medium,
  state,
}: {
  d: Drawn;
  medium: Medium;
  state?: ItemState;
}) {
  const common = { "data-id": d.id, ...dataAttrs(d) };
  const strokeOf = (r?: InkRole) =>
    state?.stroke ? ink[state.stroke] : r ? ink[r] : undefined;
  const fillOf = (r: FillRole) => fill[state?.fill ?? r];
  const trace =
    state?.drawn !== undefined
      ? {
          pathLength: 1,
          strokeDasharray: "1 1",
          strokeDashoffset: 1 - state.drawn,
        }
      : {};
  switch (d.k) {
    case "line":
      return (
        <line
          {...common}
          x1={d.x1}
          y1={d.y1}
          x2={d.x2}
          y2={d.y2}
          stroke={strokeOf(d.stroke)}
          strokeWidth={state?.highlight ? d.w + 2 : d.w}
          strokeDasharray={d.dash ? dashes[d.dash] : undefined}
          strokeLinecap={d.cap ?? "butt"}
          {...trace}
        />
      );
    case "path":
      return (
        <path
          {...common}
          d={d.d}
          stroke={strokeOf(d.stroke) ?? "none"}
          strokeWidth={d.w ? (state?.highlight ? d.w + 2 : d.w) : undefined}
          fill={fillOf(d.fill)}
          fillOpacity={d.opacity}
          strokeDasharray={d.dash ? dashes[d.dash] : undefined}
          strokeLinejoin="round"
          strokeLinecap="round"
          {...trace}
        />
      );
    case "circle":
      return (
        <circle
          {...common}
          cx={d.cx}
          cy={d.cy}
          r={state?.highlight ? d.r * 1.25 : d.r}
          stroke={strokeOf(d.stroke) ?? "none"}
          strokeWidth={d.w}
          fill={fillOf(d.fill)}
          fillOpacity={d.opacity}
          strokeDasharray={d.dash ? dashes[d.dash] : undefined}
          {...trace}
        />
      );
    case "rect":
      return (
        <rect
          {...common}
          x={d.x}
          y={d.y}
          width={d.w}
          height={d.h}
          rx={d.rx}
          stroke={strokeOf(d.stroke) ?? (state?.highlight ? ink.warm : "none")}
          strokeWidth={state?.highlight ? (d.sw ?? 0) + 2.5 : d.sw}
          fill={fillOf(d.fill)}
          fillOpacity={d.opacity}
          strokeDasharray={d.dash ? dashes[d.dash] : undefined}
        />
      );
    case "text":
      return <Label d={d} medium={medium} state={state} common={common} />;
  }
}

function Label({
  d,
  medium,
  state,
  common,
}: {
  d: Extract<Drawn, { k: "text" }>;
  medium: Medium;
  state?: ItemState;
  common: Record<string, unknown>;
}) {
  const fam = families(medium);
  const color = strokeOrInk(state?.stroke ?? d.color);
  const halo = d.halo
    ? {
        paintOrder: "stroke" as const,
        stroke: ink.paper,
        strokeWidth: 4,
        strokeLinejoin: "round" as const,
      }
    : {};
  const style = (font: RunFont, size: number): React.CSSProperties => ({
    fontFamily: fam[font],
    fontSize: size,
    fontStyle: font === "italic" ? "italic" : "normal",
    fontWeight: font === "sansBold" || d.bold ? 700 : 400,
    fill: color,
    ...halo,
  });
  const runs = d.t.runs;
  const plain = state?.text ?? null;
  const single = runs.length === 1 || plain !== null;
  return (
    <g {...common} data-label={d.plain}>
      {single ? (
        <text
          x={d.x + d.t.width / 2}
          y={d.y + (plain === null ? runs[0]!.dy : 0)}
          textAnchor="middle"
          style={style(runs[0]!.font, runs[0]!.size)}
        >
          {plain ?? runs[0]!.text}
        </text>
      ) : (
        <text style={style(runs[0]!.font, runs[0]!.size)}>
          {runs.map((r, i) => (
            <tspan
              key={i}
              x={d.x + r.dx}
              y={d.y + r.dy}
              style={style(r.font, r.size)}
            >
              {r.text}
            </tspan>
          ))}
        </text>
      )}
      {plain === null &&
        d.t.bars.map((b, i) => (
          <line
            key={i}
            x1={d.x + b.x1}
            x2={d.x + b.x2}
            y1={d.y + b.y}
            y2={d.y + b.y}
            stroke={color}
            strokeWidth={b.width}
          />
        ))}
    </g>
  );
}
const strokeOrInk = (r: InkRole) => ink[r];

/** Draw a laid-out scene. The box is fixed by the layout: no layout shift. */
export function SceneSvg({
  layout,
  label,
  kind = "scene",
  medium = "screen",
  states,
  className,
}: {
  layout: Layout;
  label: string;
  kind?: string;
  medium?: Medium;
  states?: Record<string, ItemState>;
  className?: string;
}) {
  // Shapes first, labels on top, each in display-list order.
  const shapes = layout.items.filter((d) => d.k !== "text"),
    labels = layout.items.filter((d) => d.k === "text");
  const render = (d: Drawn, i: number) => {
    const st = states?.[d.id];
    const moved = st && (st.dx || st.dy);
    const node = <Item key={i} d={d} medium={medium} state={st} />;
    if (st?.opacity === undefined && !moved) return node;
    return (
      <g
        key={i}
        opacity={st?.opacity}
        transform={
          moved ? `translate(${st!.dx ?? 0} ${st!.dy ?? 0})` : undefined
        }
      >
        {node}
      </g>
    );
  };
  return (
    <svg
      className={`figure scene-figure${className ? ` ${className}` : ""}`}
      data-kind={kind}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width="100%"
      role="img"
      aria-label={label}
      style={{
        maxWidth: layout.width,
        maxHeight: "none",
        height: "auto",
        aspectRatio: `${layout.width} / ${layout.height}`,
      }}
    >
      {shapes.map(render)}
      {labels.map(render)}
    </svg>
  );
}

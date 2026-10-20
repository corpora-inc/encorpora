import { z } from "zod";
import { fillRoles, inkRoles, type FillRole, type InkRole } from "./roles";
import type { Layout } from "./layout";

/**
 * Timeline: steps over a scene's named elements. State is a pure function of
 * (layout, steps, step, progress), so every frame is testable and the final
 * frame is the static figure.
 *
 * A target names an element or part (`nl.hop.0`) and matches it and every
 * part below it (`nl.hop.0.head`, `nl.hop.0.label`).
 */
const target = z
  .string()
  .regex(/^[a-zA-Z][\w-]*(\.[\w-]+)*$/, "A target is a dotted element name");
const fraction = z.number().min(0).max(1);
export const actionSchema = z.discriminatedUnion("do", [
  /** Fade in; hidden before its step. `stagger` reveals parts in order. */
  z
    .object({
      do: z.literal("appear"),
      target,
      stagger: z.boolean().optional(),
    })
    .strict(),
  z.object({ do: z.literal("disappear"), target }).strict(),
  /** Draw a stroke from its start (a hop, a curve, a segment). Hidden before. */
  z.object({ do: z.literal("trace"), target }).strict(),
  /** Emphasize during this step only. */
  z.object({ do: z.literal("highlight"), target }).strict(),
  /** Change a shape's fill (or a line's ink) from this step on. */
  z
    .object({
      do: z.literal("fill"),
      target,
      fill: z.enum(fillRoles).optional(),
      ink: z.enum(inkRoles).optional(),
    })
    .strict(),
  /** Translate by math units, keeping the move after the step. */
  z
    .object({
      do: z.literal("move"),
      target,
      by: z.tuple([
        z.number().finite().min(-1e4).max(1e4),
        z.number().finite().min(-1e4).max(1e4),
      ]),
    })
    .strict(),
  /** Reshape a polygon into another polygon with as many corners, each
   * corner traveling to its nearest match; the shape stays reshaped. */
  z.object({ do: z.literal("morph"), target, into: target }).strict(),
  /** Count a label up from `from` to its value. */
  z
    .object({
      do: z.literal("count"),
      target,
      from: z.number().finite().optional(),
    })
    .strict(),
]);
export type Action = z.infer<typeof actionSchema>;
export const stepSchema = z
  .object({
    /** MathText. `{id}` inserts the label of element `id` ("?" when masked). */
    caption: z.string().min(1).max(300),
    actions: z.array(actionSchema).max(12),
    /** Lesson-only steps reveal the result; hints stop before them. */
    audience: z.enum(["all", "lesson"]).optional(),
    /** Fraction of the step's duration to hold afterwards before autoplay continues. */
    hold: fraction.optional(),
  })
  .strict();
export type Step = z.infer<typeof stepSchema>;
export const stepsSchema = z.array(stepSchema).min(1).max(12);

export type ItemState = {
  opacity?: number;
  dx?: number;
  dy?: number;
  drawn?: number;
  text?: string;
  fill?: FillRole;
  stroke?: InkRole;
  highlight?: boolean;
  /** A reshaped polygon's path, in figure pixels. */
  d?: string;
};

export const matches = (id: string, t: string) =>
  id === t || id.startsWith(`${t}.`);

/** Targets that name nothing in the laid-out scene: a cue must not miss. */
export function missingTargets(layout: Layout, steps: Step[]) {
  const ids = layout.items.map((d) => d.id);
  return [
    ...new Set(
      steps.flatMap((s) =>
        s.actions
          .flatMap((a) => (a.do === "morph" ? [a.target, a.into] : [a.target]))
          .filter((t) => !ids.some((id) => matches(id, t))),
      ),
    ),
  ];
}

/** The steps a viewer sees: a hint stops before lesson-only steps. */
export function visibleSteps(steps: Step[], mode: "hint" | "lesson") {
  return mode === "lesson"
    ? steps
    : steps.filter((s) => s.audience !== "lesson");
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** A counting label shows whole steps, with as many decimals as its value. */
const formatCount = (v: number, final: string) => {
  const decimals = (final.split(".")[1] ?? "").length;
  return v.toFixed(decimals).replace("-", "−");
};

/**
 * Element states at `step` (0-based) with that step `progress` complete.
 * `step` = -1 is the start frame; (steps.length − 1, 1) is the final frame.
 * `progress` is already eased.
 */
export function frameAt(
  layout: Layout,
  steps: Step[],
  step: number,
  progress: number,
  /** Steps whose entrances hide elements at the start: by default `steps`.
   * Pass every step of the scene so an element a lesson-only step brings in
   * stays hidden in a hint, which stops earlier. */
  entrances: Step[] = steps,
): Record<string, ItemState> {
  const states: Record<string, ItemState> = {};
  const get = (id: string) => (states[id] ??= {});
  const items = layout.items;
  const s = layout.scale;
  // Before its entrance an element is hidden: appear and trace both enter.
  for (const st of entrances)
    for (const a of st.actions)
      if (a.do === "appear" || a.do === "trace")
        for (const d of items)
          if (matches(d.id, a.target) && states[d.id]?.opacity === undefined)
            get(d.id).opacity = 0;
  for (let k = 0; k <= Math.min(step, steps.length - 1); k++) {
    const p = k < step ? 1 : clamp(progress);
    const current = k === step;
    for (const a of steps[k]!.actions) {
      const hit = items.filter((d) => matches(d.id, a.target));
      hit.forEach((d, i) => {
        const st = get(d.id);
        let q = p;
        if (a.do === "appear" && a.stagger && hit.length > 1) {
          const span = 0.4,
            start = (i / (hit.length - 1)) * (1 - span);
          q = clamp((p - start) / span);
        }
        switch (a.do) {
          case "appear":
            st.opacity = q;
            break;
          case "disappear":
            st.opacity = 1 - q;
            break;
          case "trace":
            if (d.k === "line" || (d.k === "path" && d.fill === "none")) {
              st.opacity = q > 0 ? 1 : 0;
              st.drawn = q;
            } else if (d.id.endsWith(".head"))
              st.opacity = clamp((q - 0.85) / 0.15);
            else st.opacity = clamp((q - 0.6) / 0.4);
            break;
          case "highlight":
            if (current && p > 0) st.highlight = true;
            break;
          case "fill":
            if (p > 0) {
              if (a.fill) st.fill = a.fill;
              if (a.ink) st.stroke = a.ink;
            }
            break;
          case "move":
            st.dx = (st.dx ?? 0) + a.by[0] * s * q;
            st.dy = (st.dy ?? 0) - a.by[1] * s * q;
            break;
          case "morph": {
            const into = items.find((e) => e.id === a.into);
            if (d.k !== "path" || !into || into.k !== "path") break;
            const from = corners(st.d ?? d.d),
              to = corners(into.d);
            if (!from || !to || from.length !== to.length) break;
            const goal = aligned(from, to);
            st.d = polygonPath(
              from.map(([x, y], j) => [
                x + (goal[j]![0] - x) * q,
                y + (goal[j]![1] - y) * q,
              ]),
            );
            break;
          }
          case "count":
            if (d.k === "text" && !d.masked && q < 1) {
              const to = Number(d.plain.replace("−", "-"));
              const from = a.from ?? 0;
              if (Number.isFinite(to))
                st.text = formatCount(from + (to - from) * q, d.plain);
            }
            break;
        }
      });
    }
  }
  // Drop no-op states so the renderer adds no wrappers.
  for (const [id, st] of Object.entries(states))
    if (st.opacity === 1 && Object.keys(st).length === 1) delete states[id];
  return states;
}

/** The corners of a closed straight path ("M…L…Z"), or null. */
function corners(d: string): [number, number][] | null {
  if (!/^M[^MZ]*Z$/.test(d.trim())) return null;
  const out = [...d.matchAll(/[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g)].map(
    (m) => [Number(m[1]), Number(m[2])] as [number, number],
  );
  return out.length >= 3 ? out : null;
}
/** Rotate the target's corner order so each corner travels least. */
function aligned(from: [number, number][], to: [number, number][]) {
  let best = to,
    cost = Infinity;
  for (let k = 0; k < to.length; k++) {
    const turned = to.map((_, i) => to[(i + k) % to.length]!);
    const c = turned.reduce(
      (sum, p, i) => sum + Math.hypot(p[0] - from[i]![0], p[1] - from[i]![1]),
      0,
    );
    if (c < cost) {
      cost = c;
      best = turned;
    }
  }
  return best;
}
const polygonPath = (pts: [number, number][]) =>
  pts
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join("") + "Z";

/** Fill `{id}` placeholders with element labels, "?" where masked. */
export function captionText(layout: Layout, caption: string) {
  return caption.replace(/\{([a-zA-Z][\w.-]*)\}/g, (whole, id: string) => {
    const t = layout.items.find((d) => d.id === id);
    return t && t.k === "text" ? t.plain : whole;
  });
}

/** CSS `cubic-bezier(a, b, c, d)` evaluated at x. */
export function cubicBezier(css: string): (x: number) => number {
  const m = /cubic-bezier\(([^)]+)\)/.exec(css);
  const [x1, y1, x2, y2] = m
    ? m[1]!.split(",").map(Number)
    : [0.25, 0.1, 0.25, 1];
  const bez = (t: number, a: number, b: number) =>
    3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (bez(mid, x1!, x2!) < x) lo = mid;
      else hi = mid;
    }
    return bez((lo + hi) / 2, y1!, y2!);
  };
}

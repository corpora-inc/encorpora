import { z } from "zod";
import { base, coord, color, label, num as zNum } from "../base";
import { registerComponent, type Prim } from "../layout";
import { typeset } from "../type";
import { clean, num, signed, spoken } from "./format";

/** A number line with ticks, marks, intervals and hops. */
export const numberLineSchema = z
  .object({
    ...base,
    type: z.literal("numberLine"),
    min: coord,
    max: coord,
    /** Tick spacing. A denominator ticks every 1/d and labels fractions. */
    step: zNum.positive().optional(),
    denominator: z.number().int().min(2).max(16).optional(),
    labels: z
      .union([z.enum(["auto", "ends", "none"]), z.array(coord).max(40)])
      .optional(),
    marks: z
      .array(
        z
          .object({
            at: coord,
            label: z.union([z.boolean(), label]).optional(),
            open: z.boolean().optional(),
            color,
            derived: z.boolean().optional(),
          })
          .strict(),
      )
      .max(12)
      .optional(),
    hops: z
      .array(
        z
          .object({
            from: coord,
            by: coord.refine((n) => n !== 0, "A hop moves"),
            /** Text above the hop; defaults to the signed change. */
            label: z.union([label, z.literal(false)]).optional(),
            /** The landing value: shown, masked as the unknown, or omitted. */
            landing: z.enum(["shown", "derived", "none"]).optional(),
            color,
          })
          .strict(),
      )
      .max(12)
      .optional(),
    intervals: z
      .array(
        z
          .object({
            from: coord.nullable(),
            to: coord.nullable(),
            open: z.tuple([z.boolean(), z.boolean()]).optional(),
            color,
          })
          .strict(),
      )
      .max(4)
      .optional(),
  })
  .strict()
  .refine((f) => f.max > f.min, "max exceeds min")
  .refine(
    (f) =>
      (f.max - f.min) / (f.denominator ? 1 / f.denominator : (f.step ?? 1)) <=
      200,
    "At most 200 ticks",
  );
export type NumberLine = z.infer<typeof numberLineSchema>;

const fraction = (v: number, d: number) =>
  Number.isInteger(v) ? num(v) : `${clean(v * d)}/${d}`;

/** Exact tick values from min to max at `step`, without float drift. */
export function ticks(min: number, max: number, step: number) {
  const first = Math.ceil(min / step - 1e-9),
    last = Math.floor(max / step + 1e-9);
  return Array.from({ length: last - first + 1 }, (_, i) =>
    clean((first + i) * step),
  );
}

registerComponent("numberLine", {
  maxScale: (c) => 120 / (c.denominator ? 1 / c.denominator : (c.step ?? 1)),
  compile(c, { s }) {
    const step = c.denominator ? 1 / c.denominator : (c.step ?? 1);
    const values = ticks(c.min, c.max, step);
    const text = (v: number) =>
      c.denominator ? fraction(v, c.denominator) : num(v);
    // Label spacing: the smallest stride whose labels fit with a gap.
    const widest = Math.max(
      ...values.map((v) => typeset(text(v), "math", "md").width),
    );
    const strides = c.denominator
      ? [1, 2, c.denominator, 2 * c.denominator, 5 * c.denominator]
      : [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
    const stride =
      strides.find((k) => k * step * s >= widest + 10) ?? strides.at(-1)!;
    const index = (v: number) => Math.round(v / step);
    const fixed = new Set<number>();
    const labeled = new Set<number>();
    if (Array.isArray(c.labels)) c.labels.forEach((v) => fixed.add(v));
    else if (c.labels === "ends") {
      fixed.add(values[0]!);
      fixed.add(values.at(-1)!);
    } else if (c.labels !== "none") {
      for (const v of values) if (index(v) % stride === 0) labeled.add(v);
      // An end off the stride is labeled only when it stands clear of its
      // neighbor: −5 beside −4 reads as clutter, 0 beside 5 does not.
      for (const end of [values[0]!, values.at(-1)!]) {
        const gap = Math.min(
          ...[...labeled].map((v) => Math.abs(index(v) - index(end))),
        );
        if (labeled.has(end) || gap >= Math.ceil(stride * 0.6) || !labeled.size)
          fixed.add(end);
      }
    }
    const ext = 20 / s;
    const prims: Prim[] = [
      {
        type: "segment",
        id: "axis",
        from: [c.min - ext, 0],
        to: [c.max + ext, 0],
        arrow: "both",
        stroke: "ink",
        width: 2,
        obstacle: true,
      },
    ];
    for (const v of values) {
      const major = fixed.has(v) || labeled.has(v);
      prims.push({
        type: "tick",
        id: `tick.${v}`,
        at: [v, 0],
        dir: [0, 1],
        length: major ? 14 : 8,
        stroke: "ink",
        data: { tick: v },
      });
      if (major)
        prims.push({
          type: "text",
          id: `label.${v}`,
          at: [v, 0],
          text: text(v),
          offset: [0, 10],
          align: [0, -1],
          optional: !fixed.has(v),
          data: { "tick-label": v },
        });
    }
    for (const [i, iv] of (c.intervals ?? []).entries()) {
      const from = iv.from ?? c.min - ext,
        to = iv.to ?? c.max + ext;
      prims.push({
        type: "segment",
        id: `interval.${i}`,
        from: [from, 0],
        to: [to, 0],
        stroke: iv.color ?? "accent",
        width: 5,
        arrow:
          iv.from === null && iv.to === null
            ? "both"
            : iv.from === null
              ? "start"
              : iv.to === null
                ? "end"
                : undefined,
      });
      for (const [j, end] of [iv.from, iv.to].entries())
        if (end !== null)
          prims.push({
            type: "point",
            id: `interval.${i}.end.${j}`,
            at: [end, 0],
            r: 6,
            color: iv.color ?? "accent",
            shape: iv.open?.[j] ? "open" : "dot",
          });
    }
    for (const [i, hop] of (c.hops ?? []).entries()) {
      const to = clean(hop.from + hop.by);
      const h = Math.min(64, Math.max(16, Math.abs(hop.by) * s * 0.3));
      const color = hop.color ?? "accent";
      prims.push({
        type: "arrow",
        id: `hop.${i}`,
        from: [hop.from, 0],
        to: [to, 0],
        bend: hop.by > 0 ? h : -h,
        stroke: color,
        width: 2.5,
        data: { hop: `${hop.from}:${hop.by}` },
      });
      if (hop.label !== false)
        prims.push({
          type: "text",
          id: `hop.${i}.label`,
          at: [hop.from + hop.by / 2, 0],
          text: hop.label ?? signed(hop.by),
          offset: [0, -h - 4],
          align: [0, 1],
          color,
          size: "sm",
        });
      if ((hop.landing ?? "derived") !== "none")
        prims.push({
          type: "text",
          id: `hop.${i}.landing`,
          at: [to, 0],
          text: num(to),
          derived: hop.landing !== "shown",
          bold: true,
          color,
          align: [0, 1],
          place: [
            [hop.by > 0 ? 6 : -6, -10, hop.by > 0 ? -1 : 1, 1],
            [hop.by > 0 ? -6 : 6, -10, hop.by > 0 ? 1 : -1, 1],
            [0, -h - 24, 0, 1],
          ],
        });
    }
    for (const [i, m] of (c.marks ?? []).entries()) {
      prims.push({
        type: "point",
        id: `mark.${i}`,
        at: [m.at, 0],
        r: 6,
        shape: m.open ? "open" : "dot",
        color: m.color ?? "warm",
        data: { mark: m.at },
      });
      if (m.label !== undefined && m.label !== false)
        prims.push({
          type: "text",
          id: `mark.${i}.label`,
          at: [m.at, 0],
          text: m.label === true ? text(m.at) : m.label,
          derived: m.derived,
          bold: true,
          color: m.color ?? "warm",
          align: [0, 1],
          place: [
            [0, -12, 0, 1],
            [-7, -9, 1, 1],
            [7, -9, -1, 1],
            [0, -34, 0, 1],
          ],
        });
    }
    return prims;
  },
  describe(c, reveal, hidden) {
    const step = c.denominator ? 1 / c.denominator : (c.step ?? 1);
    const out = [
      `Number line from ${spoken(c.min)} to ${spoken(c.max)}, with a tick every ${c.denominator ? `1/${c.denominator}` : spoken(step)}.`,
    ];
    const marks = (c.marks ?? []).filter((_, i) => !hidden(`mark.${i}`));
    const named = marks.filter((m) => typeof m.label === "string");
    if (named.length) {
      // A lettered point is described by its letter, so a learner who reads
      // the description can answer a question about point P. On a line that
      // labels only some ticks, the learner counts ticks from a labeled
      // number, as a sighted learner does; the value is said only on reveal.
      const labeled = Array.isArray(c.labels) ? c.labels : null;
      const place = (at: number) => {
        if (reveal || !labeled || labeled.includes(at))
          return `is at ${spoken(at)}`;
        const near = labeled.reduce((a, b) =>
          Math.abs(b - at) < Math.abs(a - at) ? b : a,
        );
        const n = Math.round(Math.abs(at - near) / step);
        return `is ${n} ${n === 1 ? "tick mark" : "tick marks"} to the ${at > near ? "right" : "left"} of ${spoken(near)}`;
      };
      out.push(
        named
          .map(
            (m) =>
              `Point ${m.label} ${m.derived && !reveal ? "marks an unknown number" : place(m.at)}.`,
          )
          .join(" "),
      );
    }
    const plain = marks.filter((m) => typeof m.label !== "string");
    if (plain.length)
      out.push(
        `${plain.length === 1 ? "A point marks" : "Points mark"} ${plain
          .map((m) =>
            m.derived && !reveal ? "an unknown number" : spoken(m.at),
          )
          .join(", ")}.`,
      );
    for (const [i, hop] of (c.hops ?? []).entries())
      if (!hidden(`hop.${i}`))
        out.push(
          `A jump of ${spoken(Math.abs(hop.by))} to the ${hop.by > 0 ? "right" : "left"} from ${spoken(hop.from)} lands on ${
            (hop.landing ?? "derived") === "derived" && !reveal
              ? "the number to find"
              : spoken(clean(hop.from + hop.by))
          }.`,
        );
    for (const iv of c.intervals ?? [])
      out.push(
        iv.from === null && iv.to === null
          ? "The whole line is shaded."
          : iv.from === null
            ? `Shaded to the left of ${spoken(iv.to!)}, ${iv.open?.[1] ? "not including" : "including"} it.`
            : iv.to === null
              ? `Shaded to the right of ${spoken(iv.from)}, ${iv.open?.[0] ? "not including" : "including"} it.`
              : `Shaded from ${spoken(iv.from)} to ${spoken(iv.to)}.`,
      );
    return out.join(" ");
  },
});

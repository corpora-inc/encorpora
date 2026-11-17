import { z } from "zod";
import { base, coord, color, label, num as zNum } from "../base";
import { registerComponent, type Prim } from "../layout";
import { typeset } from "../type";
import { clean, num, signed, spoken } from "./format";

/** Pixels between the arcs of overlapping hops: room for a label and a gap. */
const HOP_LANE = 30;
/** Narrower than this, a hop cannot hold its own label. */
const HOP_NARROW = 44;
/** Distance of a label beside a hop's foot. */
const HOP_BESIDE = 22;
/** A hop landing closer than this to a labeled point crowds its label. */
const HOP_CROWDED = 46;

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
    /** A vertical line (a thermometer scale, an elevation) runs up the
     * figure: numbers on the left, hops bowing to the right. */
    orientation: z.enum(["horizontal", "vertical"]).optional(),
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

type Place = [number, number, 0 | 1 | -1, 0 | 1 | -1];

/**
 * Candidate places for a point's label. Where hops start or land on the point,
 * the label goes on the side no hop leaves toward, so no arc runs through it.
 */
function markPlacements(
  hops: NonNullable<NumberLine["hops"]>,
  at: number,
): Place[] {
  const sides = new Set<number>();
  for (const hop of hops) {
    if (hop.from === at) sides.add(Math.sign(hop.by));
    if (clean(hop.from + hop.by) === at) sides.add(-Math.sign(hop.by));
  }
  const left: Place = [-7, -9, 1, 1];
  const right: Place = [7, -9, -1, 1];
  const above: Place = [0, -12, 0, 1];
  const below: Place = [0, 12, 0, -1];
  const high: Place = [0, -34, 0, 1];
  // Past the head of a hop that lands just beside the point.
  const farLeft: Place = [-20, -6, 1, 1];
  const farRight: Place = [20, -6, -1, 1];
  if (sides.size === 1)
    return [
      sides.has(1) ? left : right,
      above,
      high,
      sides.has(1) ? farLeft : farRight,
    ];
  // Hops on both sides: below the axis, between the tick labels, if it fits.
  if (sides.size === 2) return [below, above, left, right, high];
  return [above, left, right, high, farLeft, farRight];
}

/** Gap, in pixels, between a tick's end and its number. */
const LABEL_GAP = 5;
/** Air between neighboring tick numbers: across a horizontal row, and
 * between stacked rows on a vertical line. */
const ROW_AIR = 10,
  COLUMN_AIR = 4;
const MAJOR = 14,
  MINOR = 8;

/**
 * Which ticks carry a number. Every n-th tick, n the smallest of 1, 2, 5,
 * 10, … whose numbers fit the space between them at this scale (their width
 * across a horizontal line, their height up a vertical one), so labels never
 * collide. On-stride values include 0. A vertical line also names the values
 * the figure refers to (a marked point, a hop's start and landing) in its
 * number column; numbers on the stride beside them give way.
 */
export function tickLabels(c: NumberLine, s: number) {
  const vertical = c.orientation === "vertical";
  const step = c.denominator ? 1 / c.denominator : (c.step ?? 1);
  const values = ticks(c.min, c.max, step);
  const text = (v: number) =>
    c.denominator ? fraction(v, c.denominator) : num(v);
  const sets = values.map((v) => typeset(text(v), "math", "md"));
  const need = vertical
    ? Math.max(...sets.map((t) => t.ascent + t.descent)) + COLUMN_AIR
    : Math.max(...sets.map((t) => t.width)) + ROW_AIR;
  const strides = c.denominator
    ? [1, 2, c.denominator, 2 * c.denominator, 5 * c.denominator]
    : [1, 2, 5, 10, 20, 25, 50, 100, 200, 500, 1000];
  const stride =
    strides.find((k) => k * step * s >= need) ??
    Math.ceil(need / (step * s) / strides.at(-1)!) * strides.at(-1)!;
  const index = (v: number) => Math.round(v / step);
  const fixed = new Set<number>();
  const labeled = new Set<number>();
  const ends = new Set<number>();
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
        (vertical ? ends : fixed).add(end);
    }
  }
  return { step, values, text, stride, fixed, labeled, ends };
}

registerComponent("numberLine", {
  maxScale: (c) => 120 / (c.denominator ? 1 / c.denominator : (c.step ?? 1)),
  compile(c, { s }) {
    const vertical = c.orientation === "vertical";
    // Math position of a value on the line, and a pixel offset across it
    // (above a horizontal line, to the right of a vertical one).
    const at = (v: number): [number, number] => (vertical ? [0, v] : [v, 0]);
    const across = (along: number, out: number): [number, number] =>
      vertical ? [out, -along] : [along, -out];
    const { values, text, fixed, labeled, ends } = tickLabels(c, s);
    // The values a vertical line names in its number column, in the color
    // of the mark or hop that refers to them; an unknown landing reads "?".
    const named = new Map<
      number,
      {
        color?: NonNullable<NumberLine["marks"]>[number]["color"];
        derived?: boolean;
      }
    >();
    if (vertical) {
      for (const hop of c.hops ?? []) {
        if (!named.has(hop.from)) named.set(hop.from, {});
        if ((hop.landing ?? "derived") !== "none")
          named.set(clean(hop.from + hop.by), {
            color: hop.color ?? "accent",
            derived: hop.landing !== "shown",
          });
      }
      for (const m of c.marks ?? [])
        if (m.label === true)
          named.set(m.at, { color: m.color ?? "warm", derived: m.derived });
    }
    const ext = 20 / s;
    const prims: Prim[] = [
      {
        type: "segment",
        id: "axis",
        from: at(c.min - ext),
        to: at(c.max + ext),
        arrow: "both",
        stroke: "ink",
        width: 2,
        obstacle: true,
      },
    ];
    const labels: Prim[] = [];
    const label = (v: number, optional: boolean) => {
      const n = named.get(v);
      const known = named.has(v) || fixed.has(v);
      return {
        type: "text" as const,
        id: `label.${v}`,
        at: at(v),
        text: text(v),
        offset: vertical
          ? ([-(MAJOR / 2 + LABEL_GAP), 0] as [number, number])
          : ([0, 10] as [number, number]),
        align: vertical ? ([1, 0] as [1, 0]) : ([0, -1] as [0, -1]),
        optional: optional && !known,
        ...(n?.color && { bold: true, color: n.color }),
        ...(n?.derived && { derived: true }),
        data: { "tick-label": v },
      };
    };
    for (const v of values) {
      const major =
        fixed.has(v) || labeled.has(v) || ends.has(v) || named.has(v);
      prims.push({
        type: "tick",
        id: `tick.${v}`,
        at: at(v),
        dir: vertical ? [1, 0] : [0, 1],
        length: major ? MAJOR : MINOR,
        stroke: "ink",
        data: { tick: v },
      });
    }
    // Numbers that must show come first; optional ones give way to them in
    // this order: the ends of the line, 0, then the rest of the stride.
    const order = [
      ...values.filter((v) => fixed.has(v) || named.has(v)),
      ...values.filter((v) => ends.has(v)),
      ...values.filter((v) => v === 0 && labeled.has(v)),
      ...values.filter((v) => labeled.has(v) && v !== 0),
    ];
    for (const v of new Set(order))
      labels.push(label(v, !(fixed.has(v) || named.has(v))));
    prims.push(...labels);
    for (const [i, iv] of (c.intervals ?? []).entries()) {
      const from = iv.from ?? c.min - ext,
        to = iv.to ?? c.max + ext;
      prims.push({
        type: "segment",
        id: `interval.${i}`,
        from: at(from),
        to: at(to),
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
            at: at(end),
            r: 6,
            color: iv.color ?? "accent",
            shape: iv.open?.[j] ? "open" : "dot",
          });
    }
    // Hops whose spans overlap would draw over one another, arcs and labels
    // alike. A longer hop rises over the shorter hops it overlaps, one lane
    // higher. A shorter hop under it carries its label on its own arc, on a
    // paper backing; a hop too narrow for its label puts it beside the foot
    // it shares with the longer hop, in the open. Hops bow away from the
    // numbers: above a horizontal line, to the right of a vertical one.
    const hops = c.hops ?? [];
    const lo = hops.map((hop) => Math.min(hop.from, hop.from + hop.by));
    const hi = hops.map((hop) => Math.max(hop.from, hop.from + hop.by));
    const heights = hops.map((hop) =>
      Math.min(64, Math.max(16, Math.abs(hop.by) * s * 0.3)),
    );
    const under: boolean[] = hops.map(() => false);
    const beside: (number | undefined)[] = hops.map(() => undefined);
    const shortestFirst = hops
      .map((_, i) => i)
      .sort((x, y) => hi[x]! - lo[x]! - (hi[y]! - lo[y]!) || x - y);
    for (const [n, i] of shortestFirst.entries())
      for (const j of shortestFirst.slice(0, n)) {
        if (!(lo[j]! < hi[i]! && lo[i]! < hi[j]!)) continue;
        under[j] = true;
        heights[i] = Math.max(heights[i]!, heights[j]! + HOP_LANE);
        if ((hi[j]! - lo[j]!) * s < HOP_NARROW)
          beside[j] =
            lo[j] === lo[i] ? lo[j] : hi[j] === hi[i] ? hi[j] : undefined;
      }
    for (const [i, hop] of (c.hops ?? []).entries()) {
      const to = clean(hop.from + hop.by);
      const h = heights[i]!;
      const color = hop.color ?? "accent";
      // An arrow bows to the left of its travel: up for a rightward hop,
      // and, for a vertical line, right for a downward one.
      const bend = vertical ? (hop.by > 0 ? -h : h) : hop.by > 0 ? h : -h;
      prims.push({
        type: "arrow",
        id: `hop.${i}`,
        from: at(hop.from),
        to: at(to),
        bend,
        stroke: color,
        width: 2.5,
        data: { hop: `${hop.from}:${hop.by}` },
      });
      if (hop.label !== false)
        prims.push({
          type: "text",
          id: `hop.${i}.label`,
          at: at(beside[i] ?? hop.from + hop.by / 2),
          text: hop.label ?? signed(hop.by),
          offset:
            beside[i] === undefined
              ? across(0, under[i] ? h : h + 4)
              : across(beside[i] === lo[i] ? -HOP_BESIDE : HOP_BESIDE, 14),
          align: vertical
            ? under[i] && beside[i] === undefined
              ? [0, 0]
              : [-1, 0]
            : under[i] && beside[i] === undefined
              ? [0, 0]
              : [0, 1],
          halo: (under[i] && beside[i] === undefined) || undefined,
          color,
          size: "sm",
        });
      // A vertical line names the landing in its number column.
      if (!vertical && (hop.landing ?? "derived") !== "none")
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
        at: at(m.at),
        r: 6,
        shape: m.open ? "open" : "dot",
        color: m.color ?? "warm",
        data: { mark: m.at },
      });
      if (m.label === undefined || m.label === false) continue;
      if (vertical) {
        // A value is named in the number column; a letter sits beside its
        // dot, on the side of the hops, clear of them.
        if (m.label !== true)
          prims.push({
            type: "text",
            id: `mark.${i}.label`,
            at: [0, m.at],
            text: m.label,
            derived: m.derived,
            bold: true,
            color: m.color ?? "warm",
            align: [-1, 0],
            place: [
              [12, 0, -1, 0],
              [12, -16, -1, 0],
              [12, 16, -1, 0],
              [30, 0, -1, 0],
            ],
          });
        continue;
      }
      // Another hop landing just beside the point leaves no room above the
      // axis between the arcs and that hop's head. The value then reads in
      // the number row, under its dot, in place of the tick numbers it
      // covers (they are optional and give way).
      const crowded = (c.hops ?? []).some((hop) => {
        const to = clean(hop.from + hop.by);
        return (
          hop.from !== m.at &&
          to !== m.at &&
          Math.abs(to - m.at) * s < HOP_CROWDED
        );
      });
      prims.push({
        type: "text",
        id: `mark.${i}.label`,
        at: [m.at, 0],
        text: m.label === true ? text(m.at) : m.label,
        derived: m.derived,
        bold: true,
        color: m.color ?? "warm",
        ...(crowded && m.label === true
          ? { offset: [0, 10] as [number, number], align: [0, -1] as [0, -1] }
          : {
              align: [0, 1] as [0, 1],
              place: markPlacements(c.hops ?? [], m.at),
            }),
      });
    }
    return prims;
  },
  describe(c, reveal, hidden) {
    const step = c.denominator ? 1 / c.denominator : (c.step ?? 1);
    const out = [
      `${c.orientation === "vertical" ? "Vertical number line" : "Number line"} from ${spoken(c.min)} to ${spoken(c.max)}, with a tick every ${c.denominator ? `1/${c.denominator}` : spoken(step)}.`,
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
        const side =
          c.orientation === "vertical"
            ? at > near
              ? "above"
              : "below"
            : `to the ${at > near ? "right" : "left"} of`;
        return `is ${n} ${n === 1 ? "tick mark" : "tick marks"} ${side} ${spoken(near)}`;
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
          `A jump of ${spoken(Math.abs(hop.by))} ${c.orientation === "vertical" ? (hop.by > 0 ? "up" : "down") : `to the ${hop.by > 0 ? "right" : "left"}`} from ${spoken(hop.from)} lands on ${
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

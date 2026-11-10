/**
 * A lesson film is a screenplay: shots, each a figure and a list of beats.
 * A beat is one spoken phrase and what happens on screen as it starts.
 * Authors never give pixels, sizes or times. See film/AUTHORING.md.
 */
import { z } from "zod";
import { PLACES } from "./blocks";

const num = z.number().finite();
const point = z.tuple([num, num]);
const name = z.string().regex(/^[A-Za-z][\w']*$/);
/** A part, or something inside one: `b.n.tenths` is a pile of blocks, `b.n.ones.1.s3` a strip of a flat. */
const dotted = z.string().regex(/^[A-Za-z][\w'.-]*$/);
export const fills = [
  "none",
  "paper",
  "accent-fill",
  "warm-fill",
  "gold-fill",
  "blue-fill",
  "violet-fill",
  "wood",
  "walnut",
] as const;
export const inks = ["ink", "muted", "accent", "warm", "gold", "blue", "violet", "paper", "wood"] as const;
const fill = z.enum(fills);
const ink = z.enum(inks);
const dir = z.enum(["n", "s", "e", "w", "ne", "nw", "se", "sw", "c"]);

const common = {
  id: name,
  /** Move or fade several parts together by naming their group. */
  group: name.optional(),
  /** Visible from the start of the shot. Everything else waits for show or draw. */
  start: z.boolean().optional(),
};
const poly = z.object({
  ...common,
  poly: z.array(name).min(3),
  fill: fill.optional(),
  /** Fill shown when a flip turns the piece over. */
  back: fill.optional(),
  ink: ink.optional(),
  w: num.optional(),
  /** Draw it as a physical tile: thickness and a shadow that grows when it lifts. */
  solid: z.boolean().optional(),
});
const seg = z.object({
  ...common,
  seg: z.tuple([name, name]),
  ink: ink.optional(),
  w: num.optional(),
  dash: z.boolean().optional(),
  /** Extend past each end, in the figure's units: a line, not a segment. */
  extend: z.tuple([num, num]).optional(),
  /** Parallel marks, count at the middle. */
  arrows: z.number().int().min(1).max(3).optional(),
  /** Equal-length marks, count at the middle. */
  ticks: z.number().int().min(1).max(3).optional(),
  /** Marks at these fractions along it instead of the middle. */
  tickAt: z.array(num).optional(),
});
const dot = z.object({ ...common, dot: name, ink: ink.optional(), r: num.optional() });
const vector = z.object({
  ...common,
  /** Directed segment [tail, tip]. Its endpoint arrowhead follows draw, move, slide and turn. */
  vector: z.tuple([name, name]),
  ink: ink.optional(),
  w: num.positive().optional(),
  dash: z.boolean().optional(),
});
const angle = z.object({
  ...common,
  /** Corner in the middle: ["C", "D", "A"] is the angle at D. */
  angle: z.tuple([name, name, name]),
  fill: fill.optional(),
  ink: ink.optional(),
  r: num.optional(),
  /** A square corner mark. */
  right: z.boolean().optional(),
});
const label = z.object({
  ...common,
  /** TeX. Use \text{...} for words. */
  label: z.string().min(1),
  /** A point name, or a segment's id for its middle. */
  at: name,
  dir: dir.optional(),
  /** How far from the anchor, as a multiple of the normal gap. */
  far: num.optional(),
  ink: ink.optional(),
  /** s, m, l; xl for a count beside a picture. */
  size: z.enum(["s", "m", "l", "xl"]).optional(),
  /** Keep it readable on top of a filled shape. */
  halo: z.boolean().optional(),
  /** Stay put on the card when the view zooms (a readout, the function's name); other labels follow the figure. */
  pin: z.boolean().optional(),
  /**
   * A live readout. @x and @y become this point's coordinates as it moves (defaults to `at`).
   * @n becomes how many counters sit in this grid's cells, counting as they land.
   */
  of: name.optional(),
});
const dim = z.object({
  ...common,
  /** A measuring bracket beside a length, with its label. */
  dim: z.tuple([name, name]),
  side: dir,
  tex: z.string().min(1),
  ink: ink.optional(),
  far: num.optional(),
});
const curve = z.object({
  ...common,
  /** A smooth line through named points. */
  curve: z.array(name).min(3),
  ink: ink.optional(),
  w: num.optional(),
  fill: fill.optional(),
});
const axes = z.object({
  ...common,
  /** x and y axes across the view, with ticks every `step` and numbers every `every` units. */
  axes: z.literal(true),
  step: num.positive().optional(),
  every: num.positive().optional(),
  /** The y axis's own ticks and numbers, for a stretched graph whose y range is much larger than its x range. */
  ystep: num.positive().optional(),
  yevery: num.positive().optional(),
  /** false: only the x axis, a number line. */
  y: z.boolean().optional(),
  /** The x axis, its ticks and numbers run only over this stretch: a graph that starts at 0 beside a circle. */
  xrange: z.tuple([num, num]).optional(),
  /** The y axis, its ticks and numbers run only over this stretch: room below a graph for brackets, with no axis running through it. */
  yrange: z.tuple([num, num]).optional(),
  ink: ink.optional(),
});
const circle = z.object({
  ...common,
  /** A circle around a point: a clock face, a wheel, a pie. */
  circle: name,
  /** Radius in the figure's units. */
  r: num.positive(),
  fill: fill.optional(),
  ink: ink.optional(),
  w: num.optional(),
});
const plot = z.object({
  ...common,
  /** The graph of y = this expression in x, e.g. "1/(x-2)", "x^2-3x", "sqrt(x)". Breaks at asymptotes by itself. */
  plot: z.string().min(1),
  from: num.optional(),
  to: num.optional(),
  /** Drawn only as far as this point's x: a wave traced as the point on it glides. */
  upto: name.optional(),
  ink: ink.optional(),
  w: num.optional(),
});
const sweep = z.object({
  ...common,
  /**
   * The angle a point on a circle has turned through, filled from "three
   * o'clock" to the point: a sector that grows as the point glides, a full
   * disc after one turn. Names a point placed `{ on: circle, deg }`.
   */
  sweep: name,
  /** The sector's radius in pixels (the circle's own radius is in units). */
  r: num.positive().optional(),
  fill: fill.optional(),
  ink: ink.optional(),
  /** A reading that rides the sector's bisector, like a protractor's. */
  tex: z.string().min(1).optional(),
  size: z.enum(["s", "m", "l", "xl"]).optional(),
});
const grid = z.object({
  ...common,
  /** A grid of cells, [columns, rows]: a ten-frame is [5, 2], a hundred chart [10, 10], a strip [n, 1]. */
  grid: z.tuple([z.number().int().min(1).max(20), z.number().int().min(1).max(20)]),
  /** Its top-left corner. */
  at: name,
  /** One cell's width, or [width, height], in the figure's units. Default 1. */
  size: z.union([num.positive(), z.tuple([num.positive(), num.positive()])]).optional(),
  fill: fill.optional(),
  ink: ink.optional(),
  w: num.optional(),
});
const counters = z.object({
  ...common,
  /**
   * Counters sitting in a grid's cells, filled row by row from the top-left.
   * Each one is its own point and part, named id1, id2, ...: move it to another
   * cell, or highlight it alone. Showing the id shows them all.
   */
  counters: name,
  n: z.number().int().min(1).max(100),
  /** The first cell to fill; cells count from 1, row by row. */
  from: z.number().int().min(1).optional(),
  /** round (the default) or square: the app shows the second addend as squares. */
  shape: z.enum(["round", "square"]).optional(),
  ink: ink.optional(),
});
const place = z.enum(PLACES);
const blocks = z.object({
  ...common,
  /**
   * A place-value chart of base-ten blocks, to scale: the places, left to
   * right. A flat is the whole and a square a hundredth when the chart has
   * decimal places; otherwise a square is one. Place names appear under the
   * columns; `point` draws the point between the ones and the tenths.
   */
  blocks: z.array(place).min(1).max(4),
  /** The number, as pieces per place (14 rods is allowed). `ink` colors its pieces; `inks` colors one place's pieces differently. */
  rows: z
    .array(
      z.object({
        id: name,
        pieces: z.partialRecord(place, z.number().int().min(0).max(99)),
        ink: ink.optional(),
        inks: z.partialRecord(place, ink).optional(),
        /** Piles visible from the start of the shot; the others wait for `show b.<row>.<place>`. The part's own `start` shows them all. */
        shown: z.array(place).optional(),
      }).strict(),
    )
    .length(1),
  point: z.boolean().optional(),
  /** The numeral under the chart, a digit under each pile. Placeholder zeros wait for `show b.digit.<place>`. */
  digits: z.boolean().optional(),
  /** A live count above each pile, ticking as pieces are traded. */
  counts: z.boolean().optional(),
  /** Which unit lines the blocks show at the start: `none` for a plain whole that the lesson cuts live. Default `all`. */
  lines: z.enum(["none", "tenths", "all"]).optional(),
  /** Squares in stacks of ten (decimals: ten hundredths look like a tenth) or rows of five (the early grades). */
  squares: z.enum(["rows", "stacks"]).optional(),
  /** Start pushed in on one piece (`n.ones.1`); `zoom` to the chart's id pulls back. */
  focus: z.string().optional(),
  /** Labels tied to a piece, a strip or cell of it, or a pile, hidden until shown. */
  labels: z
    .array(z.object({ id: name, on: dotted, tex: z.string().min(1), dir: dir.optional(), far: num.optional(), ink: ink.optional(), size: z.enum(["s", "m", "l", "xl"]).optional(), start: z.boolean().optional() }).strict())
    .optional(),
});
const bar = z.object({
  ...common,
  /** Top-left corner of a to-scale whole. Cuts and shading never change its length. */
  bar: name,
  w: num.positive(),
  h: num.positive(),
  /** Omit when the whole is unknown; its amount scale reads ?. */
  whole: num.positive().optional(),
  /** TeX above the bracket, e.g. \\text{All 50 books}. */
  title: z.string().optional(),
  /** The upper scale: {max:100,suffix:"\\%",label:"Percent"} for percent. */
  scale: z.object({ max: num.positive(), suffix: z.string().optional(), label: z.string().optional() }).strict().optional(),
  /** Name of the lower scale, e.g. Books or Dollars. */
  unit: z.string().optional(),
  divisions: z.number().int().min(1).max(100).optional(),
  ink: ink.optional(),
  /** Interior positions, as fractions of the whole. Show b.mark.id, or .top / .amount separately. */
  marks: z.array(z.object({ id: name, value: num.gt(0).lt(1), top: z.string().optional(), bottom: z.string().optional() }).strict()).optional(),
});
const table = z.object({
  ...common,
  /**
   * A two-way (or any) table: a header row, a label column and the body. Cells
   * are prose with $math$ ("Not $A$", "12"). Names: `t.row.1` (a body row with
   * its label; `t.row.0` is the header row), `t.col.2` (a column with its
   * header; `t.col.0` the labels), `t.cell.1.2`. Show them to build the table
   * live, highlight them, or restrict to one with `given`.
   */
  table: z.literal(true),
  /** Top-left corner. */
  at: name,
  /** The header over each body column. */
  head: z.array(z.string().min(1)).min(1),
  rows: z.array(z.object({ label: z.string().min(1), cells: z.array(z.string().min(1)).min(1) }).strict()).min(1),
  /** One body cell, width and height, in the figure's units. */
  cell: z.tuple([num.positive(), num.positive()]),
  /** The label column's width; the cell width when omitted. */
  labelW: num.positive().optional(),
  /** The corner cell's text, over the labels. */
  corner: z.string().optional(),
  /** The last row and the last column are totals: a heavier rule before them, muted type. */
  totals: z.boolean().optional(),
  size: z.enum(["s", "m", "l"]).optional(),
});
const mosaic = z.object({
  ...common,
  /**
   * The table as area: a rectangle for everyone, sliced into slabs in
   * proportion to the groups, each slab colored along the other axis by that
   * group's share of an event. Independent groups make one straight colored
   * edge. Names: `m.slab.1` (a slab and its name), `m.part.1` (its colored
   * part), `m.parts` (every colored part), `m.guide` (the dashed line at
   * everyone's share), `m.name.1`.
   */
  mosaic: name,
  w: num.positive(),
  h: num.positive(),
  /** `rows`: horizontal slabs from the top, colored from the left. `cols`: vertical slabs from the left, colored from the top. */
  slice: z.enum(["rows", "cols"]),
  /** Each group's size and how many of them are in the event. */
  groups: z.array(z.object({ n: num.min(0), k: num.min(0) }).strict()).min(1),
  /** A name beside each slab (TeX), outside the rectangle: left of a row, above a column. */
  names: z.array(z.string().min(1)).optional(),
  /** Write k in the colored part and n − k in the rest. */
  counts: z.boolean().optional(),
  /** The colored part's fill and the rest's. */
  fill: fill.optional(),
  rest: fill.optional(),
  ink: ink.optional(),
  /** Draw the dashed guide at everyone's share (hidden until shown, unless the part starts shown). */
  guide: z.boolean().optional(),
});
export const partSchema = z.union([
  bar.strict(),
  blocks.strict(),
  table.strict(),
  mosaic.strict(),
  poly.strict(),
  seg.strict(),
  vector.strict(),
  dot.strict(),
  angle.strict(),
  label.strict(),
  dim.strict(),
  curve.strict(),
  axes.strict(),
  plot.strict(),
  grid.strict(),
  counters.strict(),
  circle.strict(),
  sweep.strict(),
]);
export type Part = z.infer<typeof partSchema>;

export const geoSchema = z
  .object({
    /** The window onto the figure: [left, bottom, right, top]. Fits all points when omitted. */
    view: z.tuple([num, num, num, num]).optional(),
    /**
     * A graph only: x and y get their own scales so the view fills the card
     * (a steep parabola is a bowl, not a spike). Never for geometry, where
     * shapes must stay true.
     */
    stretch: z.boolean().optional(),
    points: z.record(
      name,
      z.union([
        point,
        z.object({ mid: z.tuple([name, name]) }).strict(),
        z.object({ along: z.tuple([name, name]), t: num }).strict(),
        /** A point on a plot at this x; glide moves it along the graph. */
        z.object({ on: name, x: num }).strict(),
        /** A point on a circle, this many degrees counterclockwise from "three o'clock"; glide turns it. */
        z.object({ on: name, deg: num }).strict(),
        /** The point straight below or above another on the x axis: its height stands on it. */
        z.object({ foot: name }).strict(),
        /** The middle of a grid's cell n (from 1, row by row). */
        z.object({ cell: z.tuple([name, z.number().int().min(1)]) }).strict(),
        /** A named point of a table ("cell:1,2", "right:1", "bottom:2") or a mosaic ("slab:1", "edge:1", "guide:end"). */
        z.object({ anchor: z.tuple([name, z.string().min(1)]) }).strict(),
      ]),
    ),
    parts: z.array(partSchema).min(1),
  })
  .strict();
export type Geo = z.infer<typeof geoSchema>;

const timing = {
  /** A word of this beat's `say`; the action starts as it is spoken. */
  at: z.string().optional(),
  /** Which occurrence of that word, from 1. */
  nth: z.number().int().min(1).optional(),
  /** Seconds. Leave it out; the defaults are tuned. */
  dur: num.positive().optional(),
};
const targets = z.union([dotted, z.array(dotted).min(1)]);
/** A name for a line on the board, so a recap step can point back at it. */
const lineId = { id: name.optional() };
export const actionSchema = z.discriminatedUnion("do", [
  // ---- the figure
  z.object({ do: z.literal("show"), target: targets, ...timing }).strict(),
  z.object({ do: z.literal("hide"), target: targets, ...timing }).strict(),
  /** Draw strokes from their start; fills fade in. */
  z.object({ do: z.literal("draw"), target: targets, ...timing }).strict(),
  /** Emphasize until the end of this beat. */
  z.object({ do: z.literal("highlight"), target: targets, ...timing }).strict(),
  /**
   * Move named points: shapes and labels built on them follow. Each goes to
   * [x, y], to where another point is (its name), or into a grid cell ({cell: [grid, n]}).
   */
  z.object({ do: z.literal("move"), points: z.record(name, z.union([point, name, z.object({ cell: z.tuple([name, z.number().int().min(1)]) }).strict()])), ...timing }).strict(),
  /** A half turn is deg 180. Turns about a point, physically lifting. */
  z.object({ do: z.literal("turn"), target: targets, about: name, deg: num, ...timing }).strict(),
  /** Turn it over across a line through two points. */
  z.object({ do: z.literal("flip"), target: targets, over: z.tuple([name, name]), ...timing }).strict(),
  z.object({ do: z.literal("slide"), target: targets, by: point, ...timing }).strict(),
  /** Slide a point that sits on a plot along the graph to a new x, or turn a point on a circle to a new angle (`deg`, counting on past 360 for another turn). */
  z.object({ do: z.literal("glide"), point: name, x: num.optional(), deg: num.optional(), ...timing }).strict(),
  /** Change the window onto the figure: a deliberate push in or pull back. */
  z.object({ do: z.literal("view"), to: z.tuple([num, num, num, num]), ...timing }).strict(),
  // ---- base-ten blocks
  /** Draw the unit lines of every block in the chart as a cut into the named place: the flat's vertical lines for the rod's place, the horizontal lines for the square's. */
  z.object({ do: z.literal("cut"), target: dotted, into: place, ...timing }).strict(),
  /** Trade down: the rightmost piece of a pile (`b.n.tenths`) becomes ten pieces of the next place, which slide into that pile. `n` pieces, one after another. The amount never changes. */
  z.object({ do: z.literal("split"), target: dotted, n: z.number().int().min(1).max(10).optional(), ...timing }).strict(),
  /** Push the camera in on one piece of a chart (`b.n.ones.1`), or pull back to the whole chart (`b`). */
  z.object({ do: z.literal("zoom"), target: dotted, ...timing }).strict(),
  /** "Given": restrict a table to one row or column (`t.row.1`, `t.col.2`) or a mosaic to one slab (`m.slab.1`); the rest dims. The part's own id (`t`) releases it. */
  z.object({ do: z.literal("given"), target: dotted, ...timing }).strict(),
  /** Split a bar into equal parts (or refine an existing partition). */
  z.object({ do: z.literal("partition"), target: name, into: z.number().int().min(1).max(100), ...timing }).strict(),
  /** Shade an interval as fractions of the whole; default from is zero. */
  z.object({ do: z.literal("shade"), target: name, from: num.min(0).max(1).optional(), to: num.min(0).max(1), ...timing }).strict(),
  /** The lesson's real figure (figure: {example: true}): scene actions on its part names. */
  z.object({ do: z.literal("scene"), actions: z.array(z.record(z.string(), z.unknown())).min(1), ...timing }).strict(),
  // ---- the work column
  /** The problem as the learner sees it, with its answer choices if it has them. */
  z.object({ do: z.literal("problem"), text: z.string().min(1), choices: z.array(z.string().min(1)).optional(), ...lineId, ...timing }).strict(),
  /** A line of working in TeX. Parts shared with the line above travel down to their new place. */
  z.object({ do: z.literal("write"), tex: z.string().min(1), note: z.string().optional(), /** A new statement, not derived from the line above: nothing travels. */ fresh: z.boolean().optional(), ...lineId, ...timing }).strict(),
  /** A line of words; math in $...$. */
  z.object({ do: z.literal("text"), text: z.string().min(1), tone: z.enum(["ink", "muted"]).optional(), ...lineId, ...timing }).strict(),
  /** A new word and what it means. */
  z.object({ do: z.literal("term"), word: z.string().min(1), meaning: z.string().min(1), ...lineId, ...timing }).strict(),
  /** The most common mistake, said as what to do instead. */
  z.object({ do: z.literal("watch"), text: z.string().min(1), ...lineId, ...timing }).strict(),
  /** Column arithmetic: the numbers stacked on their place values (decimal points lined up), the answer row empty. Needs an id. Work it with one "column" beat per column, right to left. The kit computes every digit, carry and borrow. */
  z.object({
    do: z.literal("stack"), rows: z.array(z.string().min(1)).min(2).max(4), op: z.enum(["+", "-"]),
    /** Each column's place named above it (tens, ones, tenths, hundredths) and the point line drawn through every row: the stack reads as the place-value chart. */
    headers: z.boolean().optional(),
    ...lineId, ...timing,
  }).strict(),
  /** The next column of a stack, right to left: its answer digit, with the carry or borrow it needs. */
  z.object({
    do: z.literal("column"), of: name,
    /** A later word of this beat: the borrow (digits struck and rewritten) is written as it is spoken. Default: as the column starts. */
    trade: z.string().optional(),
    /** A later word of this beat: the answer digit (and any carry) is written as it is spoken. Default: just after the column starts. */
    write: z.string().optional(),
    ...timing,
  }).strict(),
  /** A stack's placeholder zeros ("0.8" written as "0.80"). Without this action they show with the stack. */
  z.object({ do: z.literal("zeros"), of: name, ...timing }).strict(),
  /** A stack's place names (a stack with "headers") come in with the first "places"; without one, with the stack. A named place ("tenths", or ["ones", "tenths"]) also lights its column, from this word to the next "places" or the end of the beat. */
  z.object({ do: z.literal("places"), of: name, place: z.union([z.string(), z.array(z.string()).min(1)]).optional(), ...timing }).strict(),
  /** The final answer, boxed. */
  z.object({ do: z.literal("answer"), tex: z.string().min(1), ...lineId, ...timing }).strict(),
  /** Start a new column on the whiteboard, to the right. The old column stays on the board for the overview. */
  z.object({ do: z.literal("clear"), ...timing }).strict(),
  /** Pull back to show the whole whiteboard: every example from problem to answer. */
  z.object({
    do: z.literal("overview"),
    /** "all" shows every column; the default is the column being written. */
    columns: z.enum(["current", "all"]).optional(),
    /** A board line's id: show the column that holds it, e.g. the first full example. */
    of: name.optional(),
    ...timing,
  }).strict(),
  /** One numbered step in the recap card beside the overview. */
  z.object({ do: z.literal("recap"), text: z.string().min(1), /** Board lines (by id) this step is about: they stay bright, the rest dims. */ marks: z.array(name).optional(), ...timing }).strict(),
]);
export type Action = z.infer<typeof actionSchema>;

export const beatSchema = z
  .object({
    /** Exactly what the voice says. Spell out math: "x plus six", "A B". */
    say: z.string().min(1),
    /** Extra silence after this beat, in seconds. */
    pause: num.min(0).max(3).optional(),
    /** Who says it: a role of the lesson's `cast`. Default: the first role. */
    speaker: z.enum(["teacher", "learner", "narrator"]).optional(),
    do: z.array(actionSchema).optional(),
  })
  .strict();
export type Beat = z.infer<typeof beatSchema>;

/** Screenplays declare roles; voice selection belongs to the production binding. */
export const roleSchema = z.object({}).strict();
export const speakerRoles = ["teacher", "learner", "narrator"] as const;
export type SpeakerRole = (typeof speakerRoles)[number];

export const shotSchema = z
  .object({
    /** A built figure, the lesson's real figure, or none (the work fills the frame). */
    figure: z.union([geoSchema, z.object({ example: z.literal(true) }).strict()]).optional(),
    beats: z.array(beatSchema).min(1),
  })
  .strict();
export type Shot = z.infer<typeof shotSchema>;

export const scriptSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    /** Seed of the worked example shown by figure {example: true}. */
    seed: z.string().optional(),
    /**
     * The cast, in order: role → {}. The first role speaks every beat with
     * no `speaker`. A lesson without a cast is read by the narrator. Roles
     * choose who speaks; their names are not drawn on the picture.
     */
    cast: z.partialRecord(z.enum(speakerRoles), roleSchema).optional(),
    shots: z.array(shotSchema).min(1),
  })
  .strict();
export type Script = z.infer<typeof scriptSchema>;

export type WordTime = { text: string; start: number; end: number };
export type BeatTime = { start: number; end: number; words: WordTime[] };
/** Exact voice IDs used for this production; absent on legacy solo films. */
export type Timing = { duration: number; shots: BeatTime[][]; voices?: Record<string, string> };

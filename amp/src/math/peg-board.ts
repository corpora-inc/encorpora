import { withArticle } from "./agreement";
import { z } from "zod";

export type Peg = [number, number];
export type Stick = [number, number];
const pegId = z.number().int().min(0).max(24);
const stickSchema = z.tuple([pegId, pegId]);
export const pegBoardResponseSchema = z
  .object({
    kind: z.literal("peg-board"),
    label: z.string().min(1).max(100),
    grid: z.object({ cols: z.literal(5), rows: z.literal(5) }).strict(),
    skin: z.enum(["build", "draw"]),
    maxSticks: z.literal(8),
    given: z.array(stickSchema).max(1),
    check: z
      .object({
        sides: z.number().int().min(3).max(6),
        name: z.enum(["triangle", "square", "rectangle", "hexagon"]).optional(),
        rightCorners: z.boolean().optional(),
        equalSides: z.boolean().optional(),
      })
      .strict(),
    copy: z
      .object({
        pegs: z.array(pegId).min(3).max(6),
        allowRotation: z.boolean(),
      })
      .strict()
      .optional(),
    guessChance: z.number().positive().max(1),
  })
  .strict()
  .refine(
    (r) =>
      r.given.every(([a, b]) => a !== b) &&
      (!r.copy ||
        (new Set(r.copy.pegs).size === r.copy.pegs.length &&
          r.copy.pegs.length === r.check.sides)),
  );
export type PegBoardResponse = z.infer<typeof pegBoardResponseSchema>;
export type PegBoardAnswer = { sticks: Stick[] };
const answerSchema = z.object({ sticks: z.array(stickSchema).max(8) }).strict();
export const pegPoint = (id: number): Peg => [id % 5, Math.floor(id / 5)];
export const stickKey = ([a, b]: Stick) =>
  `${Math.min(a, b)}:${Math.max(a, b)}`;
export const loopSticks = (ids: number[]): Stick[] =>
  ids.map((id, i) => [id, ids[(i + 1) % ids.length]!]);

/** Only transport validity belongs here. Open, crossed and wrong builds are
 * mathematical attempts, never HTTP errors. Edge direction/order is immaterial. */
export function parsePegBoard(
  r: PegBoardResponse,
  raw: string,
): PegBoardAnswer | null {
  if (typeof raw !== "string" || raw.length > 200) return null;
  try {
    const parsed = answerSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const sticks = parsed.data.sticks;
    if (
      sticks.some(([a, b]) => a === b) ||
      new Set(sticks.map(stickKey)).size !== sticks.length
    )
      return null;
    if (
      r.given.some(
        (edge) => !sticks.some((s) => stickKey(s) === stickKey(edge)),
      )
    )
      return null;
    return { sticks };
  } catch {
    return null;
  }
}
export function normalizePegBoard(
  r: PegBoardResponse,
  raw: string,
): string | null {
  const a = parsePegBoard(r, raw);
  return a
    ? JSON.stringify({
        sticks: a.sticks
          .map(([x, y]): Stick => (x < y ? [x, y] : [y, x]))
          .sort((a, b) => a[0] - b[0] || a[1] - b[1]),
      })
    : null;
}
const vector = (a: Peg, b: Peg): Peg => [b[0] - a[0], b[1] - a[1]];
const dot = (a: Peg, b: Peg) => a[0] * b[0] + a[1] * b[1];
const cross = (a: Peg, b: Peg) => a[0] * b[1] - a[1] * b[0];
const turn = (a: Peg, b: Peg, c: Peg) => cross(vector(a, b), vector(b, c));
function touches(a: Peg, b: Peg, p: Peg) {
  return (
    turn(a, b, p) === 0 &&
    p[0] >= Math.min(a[0], b[0]) &&
    p[0] <= Math.max(a[0], b[0]) &&
    p[1] >= Math.min(a[1], b[1]) &&
    p[1] <= Math.max(a[1], b[1])
  );
}
function intersects(a: Peg, b: Peg, c: Peg, d: Peg) {
  return (
    (turn(a, b, c) * turn(a, b, d) < 0 && turn(c, d, a) * turn(c, d, b) < 0) ||
    touches(a, b, c) ||
    touches(a, b, d) ||
    touches(c, d, a) ||
    touches(c, d, b)
  );
}
export function pegTopology(sticks: Stick[]) {
  const neighbors = new Map<number, number[]>();
  for (const [a, b] of sticks) {
    neighbors.set(a, [...(neighbors.get(a) ?? []), b]);
    neighbors.set(b, [...(neighbors.get(b) ?? []), a]);
  }
  const corners = [...neighbors].filter(
    ([id, near]) =>
      near.length === 2 &&
      turn(pegPoint(near[0]!), pegPoint(id), pegPoint(near[1]!)) !== 0,
  ).length;
  const cycle: number[] = [];
  if (
    neighbors.size >= 3 &&
    [...neighbors.values()].every((a) => a.length === 2)
  ) {
    let current = neighbors.keys().next().value!,
      previous = -1;
    while (!cycle.includes(current)) {
      cycle.push(current);
      const next = neighbors.get(current)!.find((id) => id !== previous)!;
      previous = current;
      current = next;
    }
    if (current !== cycle[0] || cycle.length !== neighbors.size)
      cycle.length = 0;
  }
  return { cycle, corners };
}
/** Rigid congruence by integer dot/cross products. Rotation preserves handedness;
 * reversing the traversal does not grant permission to reflect a copied shape. */
export function matchesPegCopy(
  actual: number[],
  target: number[],
  rotate: boolean,
): boolean {
  if (actual.length !== target.length) return false;
  const t = target.map(pegPoint),
    u = vector(t[0]!, t[1]!);
  for (const order of [actual, [...actual].reverse()])
    for (let start = 0; start < order.length; start++) {
      const a = order.map((_, i) =>
        pegPoint(order[(i + start) % order.length]!),
      );
      const v = vector(a[0]!, a[1]!);
      if (dot(u, u) !== dot(v, v)) continue;
      if (
        t.every((p, i) => {
          const w = vector(t[0]!, p),
            z = vector(a[0]!, a[i]!);
          return rotate
            ? dot(u, w) === dot(v, z) && cross(u, w) === cross(v, z)
            : w[0] === z[0] && w[1] === z[1];
        })
      )
        return true;
    }
  return false;
}
export function pegBoardFeedback(
  r: PegBoardResponse,
  raw: string,
): string | null {
  const a = parsePegBoard(r, raw);
  if (!a) return "Use the pegs to join the sticks.";
  const { cycle } = pegTopology(a.sticks);
  if (!cycle.length) {
    const degrees = new Map<number, number>();
    for (const id of a.sticks.flat())
      degrees.set(id, (degrees.get(id) ?? 0) + 1);
    if (degrees.size && [...degrees.values()].every((n) => n === 2))
      return "Join the sticks into one shape.";
    if ([...degrees.values()].some((n) => n > 2))
      return "Each corner needs just two sticks.";
    return "The shape is not closed yet.";
  }
  const p = cycle.map(pegPoint),
    n = p.length;
  if (p.some((b, i) => turn(p[(i + n - 1) % n]!, b, p[(i + 1) % n]!) === 0))
    return "A corner needs a turn, not two sticks in a straight line.";
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (intersects(p[i]!, p[(i + 1) % n]!, p[j]!, p[(j + 1) % n]!))
        return "The sticks cross. Make a shape without crossings.";
    }
  if (n !== r.check.sides)
    return r.check.name
      ? `This shape has ${n} sides; ${withArticle(r.check.name)} has ${r.check.sides}.`
      : `This shape has ${n} corners; it needs ${r.check.sides}.`;
  const edges = p.map((at, i) => vector(at, p[(i + 1) % n]!));
  if (
    r.check.rightCorners &&
    edges.some((e, i) => dot(e, edges[(i + 1) % n]!) !== 0)
  )
    return "Each corner must be a square corner.";
  if (
    r.check.equalSides &&
    edges.some((e) => dot(e, e) !== dot(edges[0]!, edges[0]!))
  )
    return "A square needs all its sides the same length.";
  if (r.copy && !matchesPegCopy(cycle, r.copy.pegs, r.copy.allowRotation))
    return r.copy.allowRotation
      ? "Match the shown shape's sides and corners. You may turn it."
      : "Match the shown shape's sides and corners without turning it.";
  return null;
}
export const gradePegBoard = (r: PegBoardResponse, raw: string) =>
  pegBoardFeedback(r, raw) === null;
export function pegBoardAnswerText(r: PegBoardResponse, raw: string): string {
  const a = parsePegBoard(r, raw);
  if (!a) return "No sticks placed";
  const { cycle, corners } = pegTopology(a.sticks);
  return `${a.sticks.length} sticks, ${corners} corners. ${cycle.length ? "One closed loop." : "Not one closed loop."}`;
}

import { z } from "zod";

const cornerSchema = z.enum(["NE", "NW", "SE", "SW"]);
const fillSchema = z.enum([
  "full",
  "h:NE",
  "h:NW",
  "h:SE",
  "h:SW",
  "q:NE",
  "q:NW",
  "q:SE",
  "q:SW",
]);
export type ShapeFill = z.infer<typeof fillSchema>;
export type Corner = z.infer<typeof cornerSchema>;
const cellSchema = z
  .object({
    x: z.number().int().min(0).max(4),
    y: z.number().int().min(0).max(4),
    fill: fillSchema,
  })
  .strict();
export type ShapeCell = z.infer<typeof cellSchema>;
const id = z.string().regex(/^[a-zA-Z][a-zA-Z0-9-]{0,31}$/);
const pieceSchema = z
  .object({
    id,
    name: z.string().min(1).max(32),
    kind: z.enum([
      "square",
      "rectangle",
      "triangle",
      "trapezoid",
      "quarter-circle",
      "half-circle",
      "composite",
    ]),
    cells: z.array(cellSchema).min(1).max(16),
    canRotate: z.boolean(),
    canFlip: z.boolean(),
    copies: z.number().int().min(1).max(6),
  })
  .strict();
export type ShapePiece = z.infer<typeof pieceSchema>;
const stageSchema = z
  .object({
    prompt: z.string().min(1).max(160),
    target: z.array(cellSchema).min(1).max(24),
    tray: z.array(pieceSchema).min(1).max(6),
    required: z
      .array(
        z
          .object({ pieceId: id, count: z.number().int().min(1).max(6) })
          .strict(),
      )
      .max(6)
      .optional(),
  })
  .strict();
export type ShapeStage = z.infer<typeof stageSchema>;
export const shapeComposerResponseSchema = z
  .object({
    kind: z.literal("shape-composer"),
    label: z.string().min(1).max(100),
    lattice: z.object({ w: z.literal(5), h: z.literal(4) }).strict(),
    stages: z.array(stageSchema).min(1).max(2),
    /** Uniform, independent unused/position/turn/flip choices for each copy. */
    guessChance: z.number().positive().max(1),
  })
  .strict()
  .refine(
    (r) =>
      r.stages.every(
        (s) =>
          s.tray.reduce((n, p) => n + p.copies, 0) <= 6 &&
          new Set(s.tray.map((p) => p.id)).size === s.tray.length &&
          s.target.every((c) => c.x < r.lattice.w && c.y < r.lattice.h) &&
          !hasOverlap(s.target) &&
          s.tray.every(
            (p) =>
              !hasOverlap(p.cells) &&
              Math.min(...p.cells.map((c) => c.x)) === 0 &&
              Math.min(...p.cells.map((c) => c.y)) === 0,
          ) &&
          new Set(s.required?.map((p) => p.pieceId)).size ===
            (s.required?.length ?? 0) &&
          (s.required ?? []).every((q) =>
            s.tray.some((p) => p.id === q.pieceId && p.copies >= q.count),
          ),
      ),
    "Shapes must be disjoint lattice fills with bounded, unique tray copies",
  );
export type ShapeComposerResponse = z.infer<typeof shapeComposerResponseSchema>;
const placementSchema = z
  .object({
    pieceId: id,
    copy: z.number().int().min(0).max(5),
    x: z.number().int().min(0).max(4),
    y: z.number().int().min(0).max(3),
    rot: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
    flip: z.boolean(),
  })
  .strict();
export type ShapePlacement = z.infer<typeof placementSchema>;
export type ShapeAnswer = ShapePlacement[][];
const answerSchema = z.array(z.array(placementSchema).max(6)).min(1).max(2);

const corners: Corner[] = ["NW", "NE", "SE", "SW"];
/** Clockwise in screen coordinates. Normalize each pose's bounding box so
 * (x,y) always names its top-left grid cell, also after a turn or flip. */
export function poseCells(
  cells: ShapeCell[],
  rot = 0,
  flip = false,
): ShapeCell[] {
  const moved = cells.map((c) => {
    let { x, y, fill } = c;
    let corner = fill.slice(2) as Corner;
    if (flip) {
      x = -x - 1;
      corner = corner?.replace(/[EW]/, (s) =>
        s === "E" ? "W" : "E",
      ) as Corner;
    }
    for (let i = 0; i < rot / 90; i++) {
      [x, y] = [-y - 1, x];
      corner = corners[(corners.indexOf(corner) + 1) % 4]!;
    }
    return {
      x,
      y,
      fill: (fill === "full"
        ? fill
        : `${fill.slice(0, 2)}${corner}`) as ShapeFill,
    };
  });
  const x0 = Math.min(...moved.map((c) => c.x)),
    y0 = Math.min(...moved.map((c) => c.y));
  return moved.map((c) => ({ ...c, x: c.x - x0, y: c.y - y0 }));
}
export const translated = (
  cells: ShapeCell[],
  x: number,
  y: number,
): ShapeCell[] => cells.map((c) => ({ ...c, x: c.x + x, y: c.y + y }));
export const placedCells = (piece: ShapePiece, p: ShapePlacement) =>
  translated(poseCells(piece.cells, p.rot, p.flip), p.x, p.y);
const halves: Record<Corner, string[]> = {
  NW: ["N", "W"],
  NE: ["N", "E"],
  SE: ["S", "E"],
  SW: ["S", "W"],
};
/** Straight cells split along BOTH diagonals. Complementary halves may share
 * a cell. A quarter disk has positive intersection with every such triangle
 * and every other quarter disk in its cell. No floating-point grading. */
export function shapeAtoms(cells: ShapeCell[]): string[] {
  return cells.flatMap((c) =>
    (c.fill === "full"
      ? ["N", "E", "S", "W"]
      : c.fill.startsWith("h:")
        ? halves[c.fill.slice(2) as Corner]
        : [c.fill]
    ).map((p) => `${c.x},${c.y},${p}`),
  );
}
export function hasOverlap(cells: ShapeCell[]): boolean {
  const atoms = shapeAtoms(cells),
    seen = new Set(atoms);
  if (seen.size !== atoms.length) return true;
  const bins = new Map<string, string[]>();
  for (const a of atoms) {
    const [x, y, part] = a.split(",");
    const key = `${x},${y}`;
    bins.set(key, [...(bins.get(key) ?? []), part!]);
  }
  return [...bins.values()].some(
    (ps) => ps.length > 1 && ps.some((p) => p.startsWith("q:")),
  );
}
export function parseShapeAnswer(
  r: ShapeComposerResponse,
  raw: string,
): ShapeAnswer | null {
  if (typeof raw !== "string" || raw.length > 4000) return null;
  try {
    const result = answerSchema.safeParse(JSON.parse(raw));
    if (!result.success || result.data.length !== r.stages.length) return null;
    if (
      !result.data.every(
        (stage, i) =>
          new Set(stage.map((p) => `${p.pieceId}:${p.copy}`)).size ===
            stage.length &&
          stage.every((p) => {
            const piece = r.stages[i]!.tray.find((t) => t.id === p.pieceId);
            return (
              piece &&
              p.copy < piece.copies &&
              p.x < r.lattice.w &&
              p.y < r.lattice.h &&
              (piece.canRotate || p.rot === 0) &&
              (piece.canFlip || !p.flip)
            );
          }),
      )
    )
      return null;
    return result.data;
  } catch {
    return null;
  }
}
export function normalizeShapeAnswer(
  r: ShapeComposerResponse,
  raw: string,
): string | null {
  const answer = parseShapeAnswer(r, raw);
  return answer
    ? JSON.stringify(
        answer.map((s) =>
          s.sort(
            (a, b) => a.pieceId.localeCompare(b.pieceId) || a.copy - b.copy,
          ),
        ),
      )
    : null;
}
export function inspectShapeStage(
  stage: ShapeStage,
  placements: ShapePlacement[],
) {
  const cells = placements.flatMap((p) => {
    const piece = stage.tray.find((t) => t.id === p.pieceId);
    return piece ? placedCells(piece, p) : [];
  });
  const target = new Set(shapeAtoms(stage.target)),
    actual = new Set(shapeAtoms(cells));
  // Containment differs from equality: a quarter disk inside a full square
  // leaves a gap but does not stick out. Each disk completely covers the two
  // diagonal atoms at its corner. Opposite disks together cover a full cell.
  const containsAtom = (cover: Set<string>, atom: string): boolean => {
    if (cover.has(atom)) return true;
    const [x, y, part] = atom.split(","),
      prefix = `${x},${y},`;
    const straight = new Set(
      ["N", "E", "S", "W"].filter((p) => cover.has(prefix + p)),
    );
    for (const corner of corners)
      if (cover.has(prefix + "q:" + corner))
        for (const p of halves[corner]) straight.add(p);
    return part!.startsWith("q:") ? straight.size === 4 : straight.has(part!);
  };
  const overlap = hasOverlap(cells),
    outside = [...actual].some((a) => !containsAtom(target, a)),
    gap = [...target].some((a) => !containsAtom(actual, a));
  const required = (stage.required ?? []).every(
    (q) => placements.filter((p) => p.pieceId === q.pieceId).length === q.count,
  );
  return {
    ok: !overlap && !outside && !gap && required,
    overlap,
    outside,
    gap,
    required,
  };
}
export function gradeShapeComposer(
  r: ShapeComposerResponse,
  raw: string,
): boolean {
  const answer = parseShapeAnswer(r, raw);
  return (
    !!answer && answer.every((s, i) => inspectShapeStage(r.stages[i]!, s).ok)
  );
}
export function shapeAnswerText(r: ShapeComposerResponse, raw: string): string {
  const a = parseShapeAnswer(r, raw);
  if (!a) return "No pieces placed";
  return a
    .map(
      (s, i) =>
        `${r.stages.length > 1 ? `Shape ${i + 1}: ` : ""}${s.length} pieces placed`,
    )
    .join("; ");
}
/** Describe the submitted board without exposing a reference arrangement. */
export function shapeFeedbackSummary(
  r: ShapeComposerResponse,
  raw: string,
): string {
  const answer = parseShapeAnswer(r, raw);
  if (!answer) return "Part of the outline is still empty.";
  const checks = answer.map((pieces, i) =>
    inspectShapeStage(r.stages[i]!, pieces),
  );
  const overlap = checks.some((c) => c.overlap),
    outside = checks.some((c) => c.outside),
    gap = checks.some((c) => c.gap);
  const parts = [
    ...(overlap ? ["pieces overlap"] : []),
    ...(outside ? ["a piece sticks out of the outline"] : []),
    ...(gap ? ["part of the outline is still empty"] : []),
  ];
  if (!parts.length)
    return checks.every((c) => c.required)
      ? "The outline is filled."
      : "Use the pieces named in the question.";
  const sentence =
    parts.length === 1
      ? parts[0]!
      : `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
  return sentence[0]!.toUpperCase() + sentence.slice(1) + ".";
}
export function shapeFeedback(r: ShapeComposerResponse, raw: string): string[] {
  const a = parseShapeAnswer(r, raw);
  if (!a) return [];
  return a.flatMap((s, i) => {
    const check = inspectShapeStage(r.stages[i]!, s),
      prefix = r.stages.length > 1 ? `Shape ${i + 1}: ` : "";
    return check.ok
      ? []
      : [
          prefix +
            (check.overlap
              ? "Some pieces cover each other. Put their sides together."
              : check.outside
                ? "Some pieces stick past the outline. Move or turn them."
                : !check.required
                  ? "Use the pieces named in the question."
                  : "An empty part is left. Try turning a piece to fill it."),
        ];
  });
}

/** Count every accepted labelled placement, including symmetric turns.
 * Unused is one choice; each copy also has w*h*turns*flips choices. Overhangs
 * and overlaps are legal submissions, so they stay in the denominator. */
export function shapeGuessChance(
  r: Omit<ShapeComposerResponse, "guessChance">,
): number {
  return r.stages.reduce((probability, s) => {
    const atoms = [...new Set(shapeAtoms(s.target))];
    const bit = new Map(atoms.map((a, i) => [a, 1n << BigInt(i)]));
    const all = (1n << BigInt(atoms.length)) - 1n;
    let denominator = 1;
    const copies = s.tray.flatMap((piece) =>
      Array.from({ length: piece.copies }, (_, copy) => ({ piece, copy })),
    );
    const candidates = copies.map(({ piece }) => {
      const out: bigint[] = [];
      const turns = piece.canRotate ? [0, 90, 180, 270] : [0],
        flips = piece.canFlip ? [false, true] : [false];
      denominator *=
        1 + r.lattice.w * r.lattice.h * turns.length * flips.length;
      for (const rot of turns)
        for (const flip of flips)
          for (let x = 0; x < r.lattice.w; x++)
            for (let y = 0; y < r.lattice.h; y++) {
              const a = shapeAtoms(
                translated(poseCells(piece.cells, rot, flip), x, y),
              );
              if (a.every((k) => bit.has(k)))
                out.push(a.reduce((mask, k) => mask | bit.get(k)!, 0n));
            }
      return out;
    });
    const memo = new Map<string, number>();
    function count(
      i: number,
      covered: bigint,
      used: Record<string, number>,
    ): number {
      if (i === copies.length)
        return covered === all &&
          (s.required ?? []).every((q) => used[q.pieceId] === q.count)
          ? 1
          : 0;
      const key = `${i}:${covered}:${(s.required ?? []).map((q) => used[q.pieceId] ?? 0).join()}`;
      const saved = memo.get(key);
      if (saved !== undefined) return saved;
      let total = count(i + 1, covered, used);
      const id = copies[i]!.piece.id,
        next = { ...used, [id]: (used[id] ?? 0) + 1 };
      for (const mask of candidates[i]!)
        if (!(mask & covered)) total += count(i + 1, covered | mask, next);
      memo.set(key, total);
      return total;
    }
    return (probability * count(0, 0n, {})) / denominator;
  }, 1);
}

type Point = [number, number];
/** True circular arcs; cancel shared straight edges to draw only the outline. */
export function shapePath(cells: ShapeCell[]): string {
  const edges = new Map<string, { a: Point; b: Point; command: string }>();
  const add = (a: Point, b: Point, command = `L${b.join(" ")}`) => {
    const reverse = `${b}:${a}`;
    if (edges.has(reverse) && command.startsWith("L")) edges.delete(reverse);
    else edges.set(`${a}:${b}`, { a, b, command });
  };
  for (const c of cells) {
    const { x, y } = c,
      nw: Point = [x, y],
      ne: Point = [x + 1, y],
      se: Point = [x + 1, y + 1],
      sw: Point = [x, y + 1];
    const pts: Record<Corner, Point[]> = {
      NW: [nw, ne, sw],
      NE: [ne, se, nw],
      SE: [se, sw, ne],
      SW: [sw, nw, se],
    };
    if (c.fill === "full") {
      const p = [nw, ne, se, sw];
      p.forEach((a, i) => add(a, p[(i + 1) % 4]!));
    } else {
      const [center, a, b] = pts[c.fill.slice(2) as Corner]!;
      add(center!, a!);
      add(
        a!,
        b!,
        c.fill.startsWith("q:") ? `A1 1 0 0 1 ${b!.join(" ")}` : undefined,
      );
      add(b!, center!);
    }
  }
  let path = "";
  while (edges.size) {
    let [key, e] = edges.entries().next().value!;
    const start = e.a.toString();
    path += `M${e.a.join(" ")}`;
    for (;;) {
      path += e.command;
      edges.delete(key);
      if (e.b.toString() === start) {
        path += "Z";
        break;
      }
      const next = [...edges].find(
        ([, n]) => n.a.toString() === e.b.toString(),
      );
      if (!next) break;
      [key, e] = next;
    }
  }
  return path;
}

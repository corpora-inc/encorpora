import type {
  Diagram,
  FractionBook,
  Rational,
} from "../../books/fraction-field-guide/schema.js";
export function rational(value: Rational): number {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every(Number.isSafeInteger) ||
    value[1] <= 0
  )
    throw new Error("Invalid exact rational");
  return value[0] / value[1];
}
export function exactGroupCount(total: Rational, size: Rational): number {
  rational(total);
  rational(size);
  if (total[0] <= 0 || size[0] <= 0)
    throw new Error("Group quantities must be positive");
  const numerator = BigInt(total[0]) * BigInt(size[1]),
    denominator = BigInt(total[1]) * BigInt(size[0]);
  return Number((numerator + denominator - 1n) / denominator);
}
export function completeGroup(
  total: Rational,
  size: Rational,
  index: number,
): boolean {
  return (
    BigInt(index + 1) * BigInt(size[0]) * BigInt(total[1]) <=
    BigInt(total[0]) * BigInt(size[1])
  );
}
function integer(value: number, min: number, max: number) {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new Error(`Diagram quantity out of range: ${value}`);
}
export function validateDiagram(d: Diagram): void {
  if (!d.id || !d.alt?.trim() || !d.caption?.trim())
    throw new Error("Diagram requires id, alternative text and caption");
  switch (d.kind) {
    case "strips":
      integer(d.rows.length, 1, 8);
      for (const row of d.rows) {
        integer(row.parts, 1, 24);
        integer(row.wholes ?? 1, 1, 5);
        integer(row.shaded, 0, row.parts * (row.wholes ?? 1));
      }
      break;
    case "number-line": {
      const min = rational(d.min),
        max = rational(d.max);
      if (min >= max || max - min > 12)
        throw new Error("Invalid number-line extent");
      integer(d.divisionsPerUnit, 1, 24);
      integer(d.jumps?.length ?? 0, 0, 4);
      for (const endpoint of [d.min, d.max])
        if (
          (BigInt(endpoint[0]) * BigInt(d.divisionsPerUnit)) %
            BigInt(endpoint[1]) !==
          0n
        )
          throw new Error(
            "Number-line endpoints must align with unit divisions",
          );
      if ((max - min) * d.divisionsPerUnit > 120)
        throw new Error("Too many number-line ticks");
      for (const mark of d.marks)
        if (rational(mark.at) < min || rational(mark.at) > max)
          throw new Error("Number-line mark out of range");
      for (const jump of d.jumps ?? [])
        for (const value of [jump.from, jump.to])
          if (rational(value) < min || rational(value) > max)
            throw new Error("Number-line jump out of range");
      break;
    }
    case "area":
      integer(d.columns, 1, 12);
      integer(d.rows, 1, 12);
      integer(d.shadedColumns, 0, d.columns);
      integer(d.shadedRows, 0, d.rows);
      break;
    case "groups": {
      const total = rational(d.total),
        size = rational(d.groupSize);
      integer(d.unitDivisions, 1, 24);
      for (const quantity of [d.total, d.groupSize])
        if (
          (BigInt(quantity[0]) * BigInt(d.unitDivisions)) %
            BigInt(quantity[1]) !==
          0n
        )
          throw new Error("Group units must align with exact subdivisions");
      if (
        total <= 0 ||
        total > 12 ||
        size <= 0 ||
        size > total ||
        exactGroupCount(d.total, d.groupSize) > 24
      )
        throw new Error("Invalid grouping diagram");
      break;
    }
    case "double-line": {
      integer(d.pairs.length, 2, 12);
      const top = d.pairs.map((p) => rational(p.top)),
        bottom = d.pairs.map((p) => rational(p.bottom));
      for (let i = 1; i < top.length; i++)
        if (top[i]! <= top[i - 1]! || bottom[i]! <= bottom[i - 1]!)
          throw new Error("Double-line quantities must increase");
      const first = d.pairs[0]!,
        last = d.pairs.at(-1)!;
      if (first.top[0] !== 0 || first.bottom[0] !== 0)
        throw new Error("Ratio double lines must begin at a shared zero");
      // BigInt cross products preserve exact proportionality, including rational units.
      const difference = (a: Rational, b: Rational) =>
        [
          BigInt(a[0]) * BigInt(b[1]) - BigInt(b[0]) * BigInt(a[1]),
          BigInt(a[1]) * BigInt(b[1]),
        ] as const;
      const [tx, td] = difference(last.top, first.top),
        [by, bd] = difference(last.bottom, first.bottom);
      for (const p of d.pairs) {
        const [x, xd] = difference(p.top, first.top),
          [y, yd] = difference(p.bottom, first.bottom);
        if (x * by * yd * td !== y * tx * xd * bd)
          throw new Error("Double-line scales disagree");
      }
      break;
    }
    default:
      throw new Error(`Unknown diagram kind: ${(d as { kind: string }).kind}`);
  }
}
export function validateBook(book: FractionBook): void {
  if (!book.id || !book.title || !book.version || !book.pages.length)
    throw new Error("Book metadata and pages required");
  const ids = new Set<string>(),
    tasks = new Set<string>(),
    solutions = new Set<string>();
  function unique(id: string) {
    if (
      !id ||
      /^(heading|solution)-/.test(id) ||
      !/^[a-z0-9][a-z0-9-]*$/.test(id) ||
      ids.has(id)
    )
      throw new Error(`Invalid or duplicate book id: ${id}`);
    ids.add(id);
  }
  for (const page of book.pages) {
    unique(page.id);
    if (
      !page.title ||
      ![
        "opening",
        "lesson",
        "workshop",
        "reflection",
        "solutions",
        "guide",
      ].includes(page.kind)
    )
      throw new Error("Invalid page");
    for (const block of page.blocks) {
      switch (block.kind) {
        case "diagram":
          unique(block.diagram.id);
          validateDiagram(block.diagram);
          break;
        case "task":
          unique(block.id);
          tasks.add(block.id);
          if (
            !["lines", "grid", "blank"].includes(block.response.kind) ||
            !["short", "medium", "large"].includes(block.response.size)
          )
            throw new Error("Invalid response workspace");
          break;
        case "solution":
          if (solutions.has(block.taskId))
            throw new Error(`Duplicate solution: ${block.taskId}`);
          solutions.add(block.taskId);
          break;
        case "text":
        case "callout":
        case "worked":
          break;
        default:
          throw new Error(
            `Unknown book block: ${(block as { kind: string }).kind}`,
          );
      }
    }
  }
  for (const id of tasks)
    if (!solutions.has(id)) throw new Error(`Missing solution: ${id}`);
  for (const id of solutions)
    if (!tasks.has(id)) throw new Error(`Orphan solution: ${id}`);
}

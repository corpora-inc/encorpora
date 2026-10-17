export interface GridPoint {
  column: number;
  row: number;
}
export interface GridSegment {
  from: GridPoint;
  to: GridPoint;
}
export interface UnitRegionModel {
  kind: "unit-region";
  unit: "cm" | "m" | "unit";
  cells: GridPoint[];
  showGrid: boolean;
  /** Shared viewport extent for comparison diagrams; preserves a common unit scale. */
  scaleFrame?: { columns: number; rows: number };
  partitions?: GridSegment[];
  edgeLabels?: (GridSegment & { side: "above" | "below" | "left" | "right" })[];
}
/** Equal-axis drawing coordinates and conservative bounds for 20px numeric labels. */
export function unitRegionLayout(d: UnitRegionModel) {
  const columns = Math.max(...d.cells.map((p) => p.column)) + 1;
  const rows = Math.max(...d.cells.map((p) => p.row)) + 1;
  const frameColumns = d.scaleFrame?.columns ?? columns,
    frameRows = d.scaleFrame?.rows ?? rows;
  const cell = Math.min(48, 240 / frameColumns, 160 / frameRows),
    left = (320 - columns * cell) / 2,
    top = 34;
  const labels = (d.edgeLabels ?? []).map((e) => {
    const length =
      Math.abs(e.to.column - e.from.column) + Math.abs(e.to.row - e.from.row);
    const mx = left + ((e.from.column + e.to.column) * cell) / 2,
      my = top + ((e.from.row + e.to.row) * cell) / 2;
    const x = mx + (e.side === "left" ? -6 : e.side === "right" ? 6 : 0);
    const y = my + (e.side === "above" ? -10 : e.side === "below" ? 22 : 6);
    const anchor =
      e.side === "left"
        ? ("end" as const)
        : e.side === "right"
          ? ("start" as const)
          : ("middle" as const);
    const width = String(length).length * 12;
    return {
      length,
      x,
      y,
      anchor,
      box: {
        x: x - (anchor === "end" ? width : anchor === "middle" ? width / 2 : 0),
        y: y - 20,
        width,
        height: 24,
      },
    };
  });
  return {
    columns,
    rows,
    cell,
    left,
    top,
    height: frameRows * cell + 68,
    labels,
  };
}
const key = (p: GridPoint) => `${p.column},${p.row}`;
const edgeKey = (e: GridSegment) => [key(e.from), key(e.to)].sort().join("|");
const at = (column: number, row: number): GridPoint => ({ column, row });
const fail = (message: string): never => {
  throw new Error(`Unit region: ${message}`);
};
function point(p: GridPoint, vertex = false) {
  if (
    !p ||
    !Number.isSafeInteger(p.column) ||
    !Number.isSafeInteger(p.row) ||
    p.column < 0 ||
    p.row < 0 ||
    p.column > (vertex ? 12 : 11) ||
    p.row > (vertex ? 8 : 7)
  )
    fail("grid point outside integer bounds");
}
/** Each exposed unit edge occurs once; an edge shared by two cells cancels. */
export function regionBoundaryEdges(
  cells: readonly GridPoint[],
): GridSegment[] {
  const edges = new Map<string, GridSegment>();
  for (const { column: x, row: y } of cells) {
    for (const e of [
      { from: at(x, y), to: at(x + 1, y) },
      { from: at(x, y + 1), to: at(x + 1, y + 1) },
      { from: at(x, y), to: at(x, y + 1) },
      { from: at(x + 1, y), to: at(x + 1, y + 1) },
    ]) {
      const k = edgeKey(e);
      if (edges.has(k)) edges.delete(k);
      else edges.set(k, e);
    }
  }
  return [...edges.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, e]) => e);
}
function unitEdges(s: GridSegment): GridSegment[] {
  point(s?.from, true);
  point(s?.to, true);
  const a = s.from,
    b = s.to;
  if (a.column === b.column && a.row !== b.row)
    return Array.from({ length: Math.abs(a.row - b.row) }, (_, i) => ({
      from: at(a.column, Math.min(a.row, b.row) + i),
      to: at(a.column, Math.min(a.row, b.row) + i + 1),
    }));
  if (a.row === b.row && a.column !== b.column)
    return Array.from({ length: Math.abs(a.column - b.column) }, (_, i) => ({
      from: at(Math.min(a.column, b.column) + i, a.row),
      to: at(Math.min(a.column, b.column) + i + 1, a.row),
    }));
  return fail("segments need distinct axis-aligned integer endpoints");
}
export function validateUnitRegionModel(d: UnitRegionModel): void {
  if (
    !d ||
    d.kind !== "unit-region" ||
    !["cm", "m", "unit"].includes(d.unit) ||
    typeof d.showGrid !== "boolean"
  )
    fail("invalid model or unit");
  if (!Array.isArray(d.cells) || d.cells.length < 1 || d.cells.length > 96)
    fail("requires 1–96 cells");
  d.cells.forEach((p) => point(p));
  if (d.scaleFrame !== undefined) {
    const frame = d.scaleFrame;
    if (
      !frame ||
      !Number.isSafeInteger(frame.columns) ||
      !Number.isSafeInteger(frame.rows) ||
      frame.columns < 1 ||
      frame.columns > 12 ||
      frame.rows < 1 ||
      frame.rows > 8 ||
      d.cells.some((p) => p.column >= frame.columns || p.row >= frame.rows)
    )
      fail(
        "scale frame must be an integer bounded viewport containing every cell",
      );
  }
  const occupied = new Set(d.cells.map(key));
  if (occupied.size !== d.cells.length) fail("duplicate cells");
  if (
    Math.min(...d.cells.map((p) => p.column)) !== 0 ||
    Math.min(...d.cells.map((p) => p.row)) !== 0
  )
    fail("normalize the region to row and column zero");
  const neighbors = (p: GridPoint) => [
    at(p.column - 1, p.row),
    at(p.column + 1, p.row),
    at(p.column, p.row - 1),
    at(p.column, p.row + 1),
  ];
  const seen = new Set<string>(),
    pending = [d.cells[0]!];
  while (pending.length) {
    const p = pending.pop()!,
      k = key(p);
    if (seen.has(k)) continue;
    seen.add(k);
    pending.push(
      ...neighbors(p).filter((n) => occupied.has(key(n)) && !seen.has(key(n))),
    );
  }
  if (seen.size !== occupied.size) fail("cells must be edge-connected");
  const maxX = Math.max(...d.cells.map((p) => p.column)),
    maxY = Math.max(...d.cells.map((p) => p.row));
  const exterior = new Set<string>(),
    empty = [at(-1, -1)];
  while (empty.length) {
    const p = empty.pop()!,
      k = key(p);
    if (exterior.has(k)) continue;
    exterior.add(k);
    empty.push(
      ...neighbors(p).filter(
        (n) =>
          n.column >= -1 &&
          n.column <= maxX + 1 &&
          n.row >= -1 &&
          n.row <= maxY + 1 &&
          !occupied.has(key(n)) &&
          !exterior.has(key(n)),
      ),
    );
  }
  for (let x = 0; x <= maxX; x++)
    for (let y = 0; y <= maxY; y++)
      if (!occupied.has(key(at(x, y))) && !exterior.has(key(at(x, y))))
        fail("holes are not supported");
  if (
    d.partitions !== undefined &&
    (!Array.isArray(d.partitions) || d.partitions.length > 4)
  )
    fail("at most four partitions");
  if (
    d.edgeLabels !== undefined &&
    (!Array.isArray(d.edgeLabels) || d.edgeLabels.length > 8)
  )
    fail("at most eight edge labels");
  const partitionEdges = new Set<string>();
  for (const segment of d.partitions ?? [])
    for (const e of unitEdges(segment)) {
      const horizontal = e.from.row === e.to.row,
        x = e.from.column,
        y = e.from.row;
      const adjacent = horizontal
        ? [at(x, y - 1), at(x, y)]
        : [at(x - 1, y), at(x, y)];
      if (!adjacent.every((p) => occupied.has(key(p))))
        fail("every partition edge must separate two occupied cells");
      if (partitionEdges.has(edgeKey(e))) fail("overlapping partitions");
      partitionEdges.add(edgeKey(e));
    }
  const boundary = new Set(regionBoundaryEdges(d.cells).map(edgeKey)),
    labeled = new Set<string>();
  for (const label of d.edgeLabels ?? [])
    for (const e of unitEdges(label)) {
      if (!boundary.has(edgeKey(e)))
        fail("every labeled edge must lie on the boundary");
      if (labeled.has(edgeKey(e))) fail("overlapping boundary labels");
      labeled.add(edgeKey(e));
      const horizontal = e.from.row === e.to.row,
        x = e.from.column,
        y = e.from.row;
      if (
        horizontal
          ? !["above", "below"].includes(label.side)
          : !["left", "right"].includes(label.side)
      )
        fail("label side must match edge orientation");
      const outside =
        label.side === "above"
          ? at(x, y - 1)
          : label.side === "below"
            ? at(x, y)
            : label.side === "left"
              ? at(x - 1, y)
              : at(x, y);
      if (!exterior.has(key(outside))) fail("labels must face the exterior");
    }
  const layout = unitRegionLayout(d);
  const overlaps = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) =>
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
  for (const [index, label] of layout.labels.entries()) {
    const b = label.box;
    if (
      b.x < 0 ||
      b.x + b.width > 320 ||
      b.y < 0 ||
      b.y + b.height > layout.height
    )
      fail("numeric label would leave the drawing");
    if (
      d.cells.some((p) =>
        overlaps(b, {
          x: layout.left + p.column * layout.cell,
          y: layout.top + p.row * layout.cell,
          width: layout.cell,
          height: layout.cell,
        }),
      )
    )
      fail(
        "numeric label would overlap the region; omit this label or use a wider model",
      );
    if (layout.labels.slice(0, index).some((p) => overlaps(b, p.box)))
      fail("numeric labels would overlap");
  }
}

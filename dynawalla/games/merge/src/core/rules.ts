/**
 * FUSE — the rule engine.
 *
 * ONE RULE: touching tiles whose values add up to the KEY fuse into the KEY.
 * A fusing group is 2 or 3 orthogonally-connected tiles.
 *
 * Everything here is integer-exact and deterministic. The engine *solves* a
 * drop completely and returns a plan of discrete steps; the renderer plays that
 * plan back with timing. That split is why the rules are testable at all.
 */

export const COLS = 6;
export const ROWS = 11;

/** A tile as the rules see it. Render state lives elsewhere. */
export type CoreTile = {
  id: number;
  /** exact integer */
  value: number;
};

/** row-major, index = r * COLS + c, r = 0 is the top. */
export type Board = (CoreTile | null)[];

export function emptyBoard(): Board {
  return new Array<CoreTile | null>(COLS * ROWS).fill(null);
}

export function idx(r: number, c: number): number {
  return r * COLS + c;
}

export function at(b: Board, r: number, c: number): CoreTile | null {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return null;
  return b[idx(r, c)] ?? null;
}

export function cloneBoard(b: Board): Board {
  return b.slice();
}

/** Lowest empty row in a column, or -1 if the column is full. */
export function dropRow(b: Board, c: number): number {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (b[idx(r, c)] == null) return r;
  }
  return -1;
}

export type Cell = { r: number; c: number };
export type Group = { cells: Cell[]; ids: number[]; sum: number };

/**
 * Every connected 2- or 3-tile group whose values add to `key`.
 *
 * Connected triples in a 4-neighbour grid are always "a centre plus two of its
 * neighbours", so enumerating (centre, neighbour-pair) covers all of them
 * exactly once per centre. Duplicates are removed by canonical id ordering.
 */
export function findGroups(b: Board, key: number): Group[] {
  const out: Group[] = [];
  const seen = new Set<string>();

  const push = (cells: Cell[]) => {
    const ids = cells.map((p) => (b[idx(p.r, p.c)] as CoreTile).id).sort((x, y) => x - y);
    const sig = ids.join(",");
    if (seen.has(sig)) return;
    seen.add(sig);
    const sum = cells.reduce((acc, p) => acc + (b[idx(p.r, p.c)] as CoreTile).value, 0);
    out.push({ cells, ids, sum });
  };

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = b[idx(r, c)];
      if (t == null) continue;

      // pairs: only right and down, so each pair is visited once
      const right = at(b, r, c + 1);
      if (right && t.value + right.value === key) {
        push([
          { r, c },
          { r, c: c + 1 },
        ]);
      }
      const down = at(b, r + 1, c);
      if (down && t.value + down.value === key) {
        push([
          { r, c },
          { r: r + 1, c },
        ]);
      }

      // triples: this cell as the centre
      const nbrs: Cell[] = [];
      if (at(b, r - 1, c)) nbrs.push({ r: r - 1, c });
      if (at(b, r + 1, c)) nbrs.push({ r: r + 1, c });
      if (at(b, r, c - 1)) nbrs.push({ r, c: c - 1 });
      if (at(b, r, c + 1)) nbrs.push({ r, c: c + 1 });
      for (let i = 0; i < nbrs.length; i++) {
        for (let j = i + 1; j < nbrs.length; j++) {
          const a = nbrs[i] as Cell;
          const d = nbrs[j] as Cell;
          const va = (b[idx(a.r, a.c)] as CoreTile).value;
          const vd = (b[idx(d.r, d.c)] as CoreTile).value;
          if (t.value + va + vd === key) push([a, { r, c }, d]);
        }
      }
    }
  }
  return out;
}

/**
 * Pick a non-overlapping set of groups to fuse this step.
 *
 * Deterministic: larger groups first (they clear more and look better), then
 * lowest cell index, then id order. Greedy over that order.
 */
export function selectGroups(groups: Group[]): Group[] {
  const keyOf = (g: Group) => Math.min(...g.cells.map((p) => idx(p.r, p.c)));
  const sorted = groups.slice().sort((a, z) => {
    if (a.cells.length !== z.cells.length) return z.cells.length - a.cells.length;
    const ka = keyOf(a);
    const kz = keyOf(z);
    if (ka !== kz) return ka - kz;
    return (a.ids[0] as number) - (z.ids[0] as number);
  });
  const used = new Set<number>();
  const chosen: Group[] = [];
  for (const g of sorted) {
    if (g.ids.some((id) => used.has(id))) continue;
    for (const id of g.ids) used.add(id);
    chosen.push(g);
  }
  return chosen;
}

export type Move = { id: number; from: Cell; to: Cell };

/** Collapse every column downward. Returns the moves that happened. */
export function applyGravity(b: Board): Move[] {
  const moves: Move[] = [];
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const t = b[idx(r, c)];
      if (t == null) continue;
      if (r !== write) {
        b[idx(write, c)] = t;
        b[idx(r, c)] = null;
        moves.push({ id: t.id, from: { r, c }, to: { r: write, c } });
      }
      write--;
    }
  }
  return moves;
}

/** One beat of the cascade: what fused, what fell, what was scored. */
export type Step = {
  /** 1-based cascade depth; 1 is the drop's own fuse. */
  chain: number;
  fused: Group[];
  /** the KEY tile born at the centre of each fused group */
  born: { id: number; value: number; cell: Cell }[];
  falls: Move[];
  score: number;
};

export type DropPlan = {
  /** where the dropped tile lands; null means the column was full. */
  landing: Cell | null;
  steps: Step[];
  /** board after everything settles */
  final: Board;
  /** true when a tile occupies the top row after settling */
  breach: boolean;
  totalScore: number;
  maxChain: number;
};

export type PlanOptions = {
  key: number;
  /**
   * Value of the tile left behind by a fuse.
   *
   * 0 by default: the sum leaves the well entirely as a CORE that flies to the
   * reactor gauge. A KEY-valued tile left on the board would be permanently
   * dead weight (nothing adds to KEY with KEY), which clogs the well and makes
   * every good chain punish you. The seam stays for target-variants where the
   * born tile is a live value.
   */
  bornValue?: number;
  /** id allocator for born tiles */
  nextId: () => number;
};

/** score for one group at one chain depth */
export function groupScore(key: number, size: number, chain: number): number {
  return key * size * chain;
}

/**
 * Run the cascade to completion on `b`, which IS mutated.
 *
 * Shared by the drop solver and by the rising well, so both use exactly the
 * same rules and the same deterministic group ordering.
 */
export function cascade(b: Board, opts: PlanOptions): {
  steps: Step[];
  totalScore: number;
  maxChain: number;
} {
  const steps: Step[] = [];
  let chain = 0;
  let totalScore = 0;
  for (;;) {
    const groups = selectGroups(findGroups(b, opts.key));
    if (groups.length === 0) break;
    chain++;

    let score = 0;
    const born: { id: number; value: number; cell: Cell }[] = [];
    for (const g of groups) {
      score += groupScore(opts.key, g.cells.length, chain);
      for (const p of g.cells) b[idx(p.r, p.c)] = null;
      const bv = opts.bornValue ?? 0;
      if (bv > 0) {
        // The KEY tile is born in the group's lowest cell — it looks like the
        // pieces collapsing into one another rather than floating up.
        let best = g.cells[0] as Cell;
        for (const p of g.cells) if (p.r > best.r || (p.r === best.r && p.c < best.c)) best = p;
        const t: CoreTile = { id: opts.nextId(), value: bv };
        b[idx(best.r, best.c)] = t;
        born.push({ id: t.id, value: bv, cell: best });
      }
    }
    totalScore += score;
    const falls = applyGravity(b);
    steps.push({ chain, fused: groups, born, falls, score });
  }
  return { steps, totalScore, maxChain: chain };
}

/**
 * Solve a drop end to end.
 *
 * `board` is not mutated. The dropped tile must not already be on the board.
 */
export function planDrop(board: Board, col: number, tile: CoreTile, opts: PlanOptions): DropPlan {
  const b = cloneBoard(board);
  const r = dropRow(b, col);
  if (r < 0) {
    return { landing: null, steps: [], final: b, breach: true, totalScore: 0, maxChain: 0 };
  }
  b[idx(r, col)] = tile;
  const out = cascade(b, opts);
  let breach = false;
  for (let c = 0; c < COLS; c++) if (b[idx(0, c)] != null) breach = true;
  return {
    landing: { r, c: col },
    steps: out.steps,
    final: b,
    breach,
    totalScore: out.totalScore,
    maxChain: out.maxChain,
  };
}

/**
 * The well rises: every chip moves up one row and a fresh row is pushed in
 * underneath.
 *
 * This is the pressure that stops a good player clearing forever. Refuses (and
 * reports a breach) when anything is already in the top row, so a rise can
 * never silently delete a chip.
 */
export function riseBoard(
  b: Board,
  values: readonly number[],
  nextId: () => number,
): { moves: Move[]; born: CoreTile[]; breach: boolean } {
  for (let c = 0; c < COLS; c++) {
    if (b[idx(0, c)] != null) return { moves: [], born: [], breach: true };
  }
  const moves: Move[] = [];
  for (let r = 0; r < ROWS - 1; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = b[idx(r + 1, c)] ?? null;
      b[idx(r, c)] = t;
      if (t) moves.push({ id: t.id, from: { r: r + 1, c }, to: { r, c } });
    }
  }
  const born: CoreTile[] = [];
  for (let c = 0; c < COLS; c++) {
    const t: CoreTile = { id: nextId(), value: values[c] ?? 1 };
    b[idx(ROWS - 1, c)] = t;
    born.push(t);
  }
  return { moves, born, breach: false };
}

/**
 * Cells that WOULD fuse if `value` were dropped into `col` right now.
 *
 * Used for the aim preview: the whole rule is taught by watching two tiles
 * light up, with no words at all.
 */
export function previewFuse(
  board: Board,
  col: number,
  value: number,
  key: number,
): { landing: Cell | null; cells: Cell[] } {
  const r = dropRow(board, col);
  if (r < 0) return { landing: null, cells: [] };
  const b = cloneBoard(board);
  const ghost: CoreTile = { id: -1, value };
  b[idx(r, col)] = ghost;
  const groups = selectGroups(findGroups(b, key));
  const hit = groups.filter((g) => g.ids.includes(-1));
  const cells: Cell[] = [];
  for (const g of hit) for (const p of g.cells) cells.push(p);
  return { landing: { r, c: col }, cells };
}

/** How high the stack is, 0..1, for the danger meter. */
export function fillRatio(b: Board): number {
  let top = ROWS;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (b[idx(r, c)] != null) {
        top = r;
        r = ROWS;
        break;
      }
    }
  }
  return (ROWS - top) / ROWS;
}

/**
 * Tiles that can never fuse under `key` with anything the spawner can produce.
 * These are burned off when the KEY changes, so a level-up is relief, not a
 * dead board.
 */
export function strandedTiles(b: Board, key: number, spawnable: readonly number[]): CoreTile[] {
  const pool = new Set(spawnable);
  const out: CoreTile[] = [];
  for (const t of b) {
    if (t == null) continue;
    if (t.value >= key) {
      out.push(t);
      continue;
    }
    // survives if some spawnable value completes it as a pair, or if two do as
    // a triple
    const need = key - t.value;
    if (pool.has(need)) continue;
    let ok = false;
    for (const a of pool) {
      if (pool.has(need - a)) {
        ok = true;
        break;
      }
    }
    if (!ok) out.push(t);
  }
  return out;
}

export function removeIds(b: Board, ids: readonly number[]): void {
  const kill = new Set(ids);
  for (let i = 0; i < b.length; i++) {
    const t = b[i];
    if (t && kill.has(t.id)) b[i] = null;
  }
}

/** Every distinct tile value currently on the board, ascending. */
export function boardValues(b: Board): number[] {
  const s = new Set<number>();
  for (const t of b) if (t) s.add(t.value);
  return [...s].sort((a, z) => a - z);
}

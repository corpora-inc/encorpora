/**
 * The escalation curve.
 *
 * The KEY climbs, the well drains faster, and more tile faces stop being
 * numerals and start being expressions you have to evaluate. Same game, harder
 * arithmetic, all the way up. Nothing here is random.
 */

export type Level = {
  n: number;
  /** the sum a fusing group must make */
  key: number;
  /** ms the held tile waits before it drops itself */
  fuseTime: number;
  /** expression-face probability, in 1/100 */
  exprPct: number;
  /** fuses needed to advance */
  quota: number;
  /** chance a dealt item is a triple instead of a pair, in 1/100 */
  triplePct: number;
  /** show which tiles would fuse while aiming: full | faint | none */
  preview: "full" | "faint" | "none";
  /** drops between one rise of the well and the next */
  riseEvery: number;
  /** rows pushed in per rise */
  riseRows: number;
};

const KEYS = [10, 10, 12, 15, 20, 20, 24, 25, 30, 40, 50, 60, 75, 100];

export function levelAt(n: number): Level {
  const i = Math.min(n - 1, KEYS.length - 1);
  const key = KEYS[Math.max(0, i)] as number;
  const fuseTime = Math.max(2400, 7600 - (n - 1) * 460);
  const exprPct = n <= 2 ? 0 : Math.min(70, 12 + (n - 3) * 8);
  const triplePct = n <= 1 ? 8 : Math.min(28, 8 + (n - 1) * 3);
  const preview = n <= 3 ? "full" : n <= 6 ? "faint" : "none";
  return {
    n,
    key,
    fuseTime,
    exprPct,
    quota: 8 + n * 2,
    triplePct,
    preview,
    riseEvery: Math.max(3, 7 - Math.floor((n - 1) / 2)),
    riseRows: n >= 9 ? 2 : 1,
  };
}

/** Every value the spawner may emit at this KEY. */
export function spawnPool(key: number): number[] {
  const out: number[] = [];
  for (let v = 1; v < key; v++) out.push(v);
  return out;
}

/**
 * Tile tiers drive colour and glow. A tier is "how big is this number,
 * relative to the KEY" — so a 7 at KEY 10 and a 70 at KEY 100 read the same,
 * and the palette never runs out.
 */
export function tierOf(value: number, key: number): number {
  if (key <= 0) return 0;
  const q = Math.floor((value * 6) / key);
  return Math.max(0, Math.min(5, q));
}

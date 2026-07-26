/**
 * Wave generation. Seeded and deterministic: the same seed plays the same siege
 * every time, which is what makes a run comparable and a bug reproducible.
 *
 * The curve is deliberately superlinear. Wave 1 is eight shards. Wave 20 is a
 * flood you can hear coming.
 */
import { ENEMIES, type EnemyKind } from "./constants.ts";
import { makeRng } from "../core/rng.ts";

export type SpawnOrder = { kind: EnemyKind; hp: number; at: number };

export type WaveSpec = {
  n: number;
  orders: SpawnOrder[];
  /** integer — shown in the banner so the player can do the throughput sum */
  totalHp: number;
  count: number;
  duration: number;
  hasBoss: boolean;
};

/**
 * Superlinear health growth — integers only, so damage maths stays exact.
 * Wave 1 is eight shards you could sneeze at. Wave 20 shards have 430 health
 * each and there are forty-five of them.
 */
export function hpScale(n: number): number {
  const k = n - 1;
  return 1 + 0.55 * k + 0.115 * k * k;
}

export function scaledHp(kind: EnemyKind, n: number): number {
  return Math.max(1, Math.round((ENEMIES[kind]?.hp ?? 10) * hpScale(n)));
}

function unlocked(n: number): EnemyKind[] {
  const ks: EnemyKind[] = ["shard"];
  if (n >= 3) ks.push("runner");
  if (n >= 5) ks.push("brute");
  if (n >= 8) ks.push("splitter");
  if (n >= 11) ks.push("warden");
  return ks;
}

/** weight shifts toward the heavy stuff as the siege wears on */
function weight(kind: EnemyKind, n: number): number {
  switch (kind) {
    case "shard":
      return Math.max(1, 10 - n * 0.4);
    case "runner":
      return Math.min(6, 1 + (n - 3) * 0.5);
    case "brute":
      return Math.min(6, 1 + (n - 5) * 0.5);
    case "splitter":
      return Math.min(5, 1 + (n - 8) * 0.45);
    case "warden":
      return Math.min(5, 1 + (n - 11) * 0.45);
    default:
      return 0;
  }
}

export function buildWave(n: number, seed: number): WaveSpec {
  const rng = makeRng(seed ^ (n * 0x9e3779b1));
  const kinds = unlocked(n);
  const count = Math.min(90, 7 + Math.floor(n * 1.9));
  const gap = Math.max(0.13, 0.7 - 0.021 * n);
  const hasBoss = n % 5 === 0;

  // allocate the roster by weight, then group into packs so waves have texture
  const totals = new Map<EnemyKind, number>();
  const weights = kinds.map((k) => weight(k, n));
  const sum = weights.reduce((a, b) => a + b, 0);
  let assigned = 0;
  kinds.forEach((k, i) => {
    const share = i === kinds.length - 1 ? count - assigned : Math.round((count * (weights[i] as number)) / sum);
    const c = Math.max(0, share);
    assigned += c;
    if (c > 0) totals.set(k, c);
  });

  const packs: { kind: EnemyKind; count: number }[] = [];
  for (const [kind, c] of totals) {
    let left = c;
    while (left > 0) {
      const take = Math.min(left, rng.i(3, 8));
      packs.push({ kind, count: take });
      left -= take;
    }
  }
  rng.shuffle(packs);

  const orders: SpawnOrder[] = [];
  let t = 0;
  for (const pack of packs) {
    const packGap = gap * (pack.kind === "runner" ? 0.6 : 1);
    for (let i = 0; i < pack.count; i++) {
      orders.push({ kind: pack.kind, hp: scaledHp(pack.kind, n), at: t });
      t += packGap * rng.r(0.86, 1.14);
    }
    t += gap * rng.r(0.9, 2.1); // breath between packs
  }

  if (hasBoss) {
    const bossHp = Math.max(1, Math.round(ENEMIES.boss.hp * hpScale(n) * 0.62));
    orders.push({ kind: "boss", hp: bossHp, at: t * 0.55 });
  }

  orders.sort((a, b) => a.at - b.at);
  const totalHp = orders.reduce((acc, o) => acc + o.hp, 0);
  return {
    n,
    orders,
    totalHp,
    count: orders.length,
    duration: orders.length > 0 ? (orders[orders.length - 1] as SpawnOrder).at : 0,
    hasBoss,
  };
}

/** the maths floor the wave number justifies — never lowers where the child already is */
export function mathFloor(n: number): number {
  return Math.min(0.72, 0.035 * (n - 1));
}

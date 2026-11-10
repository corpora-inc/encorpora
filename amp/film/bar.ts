/**
 * A length stands for one whole. Cuts change its partition, never its size;
 * shading takes a fraction of that same length. A pair of scales names each
 * position as a share and as an amount. All geometry is in figure units, y up.
 */
export type BarPoint = [number, number];
export type BarBox = { x: number; y: number; w: number; h: number };
export type BarSpec = { at: BarPoint; w: number; h: number; whole?: number; divisions?: number };
export type BarCut = { t0: number; dur: number; into: number };
export type BarShade = { t0: number; dur: number; from: number; to: number };
const clamp = (u: number) => Math.max(0, Math.min(1, u));
const smooth = (u: number) => { u = clamp(u); return u * u * u * (u * (u * 6 - 15) + 10); };

export function checkPartition(n: number) {
  if (!Number.isInteger(n) || n < 1 || n > 100) throw new Error("bar: a partition has 1 to 100 equal parts.");
}
export function checkShare(f: number) {
  if (!Number.isFinite(f) || f < 0 || f > 1) throw new Error("bar: a share must be between 0 and 1.");
}
export function checkBar(s: BarSpec) {
  if (![...s.at, s.w, s.h].every(Number.isFinite) || s.w <= 0 || s.h <= 0)
    throw new Error("bar: finite coordinates and positive dimensions are required.");
  if (s.whole !== undefined && (!Number.isFinite(s.whole) || s.whole <= 0))
    throw new Error("bar: the whole must be positive, or omitted when unknown.");
  checkPartition(s.divisions ?? 1);
}
export function barBox(s: BarSpec): BarBox {
  return { x: s.at[0], y: s.at[1] - s.h, w: s.w, h: s.h };
}
export function shareBox(s: BarSpec, from: number, to: number): BarBox {
  checkShare(from); checkShare(to);
  if (to < from) throw new Error("bar: the end of a shaded interval precedes its start.");
  return { ...barBox(s), x: s.at[0] + from * s.w, w: (to - from) * s.w };
}
export function amountAt(s: BarSpec, share: number): number | undefined {
  checkShare(share);
  return s.whole === undefined ? undefined : s.whole * share;
}
/** Equal cells retain both their geometry and their share of the whole. */
export function barCells(s: BarSpec, divisions: number) {
  checkBar(s); checkPartition(divisions);
  return Array.from({ length: divisions }, (_, i) => ({
    box: shareBox(s, i / divisions, (i + 1) / divisions),
    center: [s.at[0] + (i + 0.5) * s.w / divisions, s.at[1] - s.h / 2] as BarPoint,
    amount: s.whole === undefined ? undefined : s.whole / divisions,
  }));
}
/** An interrupted shade continues from the visible interval, without jumping. */
export function shadedAt(events: BarShade[], t: number): [number, number] {
  let current: [number, number] = [0, 0];
  const ordered = [...events].sort((a, b) => a.t0 - b.t0);
  for (const [i, e] of ordered.entries()) {
    if (t < e.t0) break;
    const until = Math.min(t, ordered[i + 1]?.t0 ?? Infinity);
    const u = smooth((until - e.t0) / e.dur);
    current = [current[0] + (e.from - current[0]) * u, current[1] + (e.to - current[1]) * u];
  }
  return current;
}
/** Refinement keeps every old cut. Repartitioning fades old cuts as new ones grow. */
export function cutsAt(initial: number, events: BarCut[], t: number) {
  checkPartition(initial);
  const levels = new Map<number, number>();
  const key = (f: number) => Math.round(f * 1e9) / 1e9;
  for (let i = 1; i < initial; i++) levels.set(key(i / initial), 1);
  let divisions = initial;
  const ordered = [...events].sort((a, b) => a.t0 - b.t0);
  for (const [i, e] of ordered.entries()) {
    if (t < e.t0) break;
    checkPartition(e.into);
    const u = smooth((Math.min(t, ordered[i + 1]?.t0 ?? Infinity) - e.t0) / e.dur);
    const target = new Set(Array.from({ length: e.into - 1 }, (_, k) => key((k + 1) / e.into)));
    for (const f of target) if (!levels.has(f)) levels.set(f, 0);
    for (const [f, v] of levels) levels.set(f, v + ((target.has(f) ? 1 : 0) - v) * u);
    divisions = e.into;
  }
  return { divisions, cuts: [...levels].filter(([, progress]) => progress > 0).sort(([a], [b]) => a - b).map(([share, progress]) => ({ share, progress })) };
}
export function planBar(s: BarSpec, cuts: BarCut[], shades: BarShade[], t: number) {
  checkBar(s);
  const partition = cutsAt(s.divisions ?? 1, cuts, t);
  const interval = shadedAt(shades, t);
  return { whole: barBox(s), part: shareBox(s, ...interval), interval, ...partition };
}
/** Anchors share the same scale as cuts and labels. Nothing has a separate guessed x. */
export function barAnchor(s: BarSpec, name: string, interval: [number, number] = [0, 0]): BarPoint {
  const b = barBox(s);
  if (name === "left") return [b.x, b.y + b.h / 2];
  if (name === "right") return [b.x + b.w, b.y + b.h / 2];
  if (name === "part") return [b.x + (interval[0] + interval[1]) * b.w / 2, b.y + b.h / 2];
  if (name === "edge") return [b.x + interval[1] * b.w, b.y + b.h / 2];
  const m = name.match(/^(top|bottom|share|amount):([\d.]+)$/);
  if (m) {
    const f = Number(m[2]); checkShare(f);
    const y = m[1] === "top" ? s.at[1] : m[1] === "bottom" ? b.y : m[1] === "share" ? b.y - 1.5 : b.y - 3.3;
    return [b.x + b.w * f, y];
  }
  throw new Error(`bar: no anchor "${name}" (left, right, part, edge, top:f, bottom:f, share:f, amount:f).`);
}

/**
 * Keep nearby numeric labels apart without moving their ticks. A displaced
 * label gets a leader in the renderer. Input and output order are preserved.
 * Return null if the row cannot fit, so authoring reports it rather than
 * silently overlapping or dropping a number.
 */
export function spreadBarLabels(labels: { x: number; w: number }[], left: number, right: number, gap = 16): number[] | null {
  const ordered = labels.map((l, i) => ({ ...l, i })).sort((a, b) => a.x - b.x);
  if (ordered.reduce((n, l) => n + l.w, 0) + Math.max(0, labels.length - 1) * gap > right - left) return null;
  const xs: number[] = [];
  ordered.forEach((l, i) => xs.push(Math.max(l.x, i ? xs[i - 1]! + ordered[i - 1]!.w / 2 + gap + l.w / 2 : left + l.w / 2)));
  for (let i = xs.length - 1; i >= 0; i--)
    xs[i] = Math.min(xs[i]!, i === xs.length - 1 ? right - ordered[i]!.w / 2 : xs[i + 1]! - ordered[i + 1]!.w / 2 - gap - ordered[i]!.w / 2);
  const out: number[] = [];
  ordered.forEach((l, i) => { out[l.i] = xs[i]!; });
  return out;
}

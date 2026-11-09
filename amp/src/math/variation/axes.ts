import { createHash } from "node:crypto";
import type { FigureCapability } from "../contracts";

/**
 * Variation axes: surface dimensions of ONE mathematical model.
 *
 * A family computes its model (givens, relation, answer, misconception
 * transforms) from the content stream, exactly as before. Each axis picks one
 * surface for that model — equation orientation, which quantity is unknown,
 * answer format, number domain, representation — from its OWN hash stream.
 * Consequences:
 *
 * - Choosing the legacy value of every axis reproduces the family's
 *   pre-axis output byte for byte, because the content stream is untouched.
 * - Adding an axis never changes the values other axes draw for a seed.
 * - Axes never add templates, so selection budgets (objective → skill →
 *   family) are unchanged: an axis varies the instance, not the exposure.
 *
 * The chosen values are recorded on the private `variant` of the generated
 * problem and copied to its attempt evidence, so calibration and review can
 * reason per axis value.
 */
export type Random = (lo: number, hi: number) => number;

export interface Axis<V extends string = string> {
  readonly id: string;
  readonly values: readonly V[];
  /** Positive integer draw weights aligned with `values`; equal by default. */
  readonly weights?: readonly number[];
  /** The surface the family showed before this axis existed. */
  readonly legacy: V;
  /** Values whose figure needs a newer figure capability than the template
   * declares (a drawn circle graph where the legacy surface shows a table).
   * For a client without it, the axis shows its legacy value instead. */
  readonly needs?: Readonly<Partial<Record<V, FigureCapability>>>;
  /** A draw of `legacy` is left out of the saved variant id and axes record,
   * so a problem stored before this axis existed keeps that variant id.
   * A newer value is recorded. */
  readonly silentLegacy?: boolean;
  /** Template version that introduced this axis. Below it, generation forces
   * `legacy` (including a silent legacy). Unset axes draw as they do today. */
  readonly since?: number;
  /** Template version from which the legacy value is no longer drawn: its
   * weight counts as 0 at that version and later (including the current one).
   * Older versions still draw it as they did, and `since` gating still forces
   * it below `since`. For a stored surface that is out of scope today. */
  readonly legacyRetiredSince?: number;
}
export type AxisSet = Readonly<Record<string, Axis>>;
export type AxisValues<A extends AxisSet> = {
  readonly [K in keyof A]: A[K]["values"][number];
};

export const axisIdPattern = /^[a-z][a-z0-9-]{0,31}$/;
export const axisValuePattern = /^[a-z0-9][a-z0-9-]{0,31}$/;
/** At most this many axes on one family: evidence stays small and readable. */
export const MAX_AXES = 6;

export function defineAxis<const V extends string>(
  id: string,
  values: readonly V[],
  options: {
    legacy?: NoInfer<V>;
    weights?: readonly number[];
    needs?: Partial<Record<NoInfer<V>, FigureCapability>>;
    silentLegacy?: boolean;
    since?: number;
    legacyRetiredSince?: number;
  } = {},
): Axis<V> {
  if (!axisIdPattern.test(id)) throw new Error(`Bad axis id ${id}`);
  if (!values.length || new Set(values).size !== values.length)
    throw new Error(`Axis ${id} needs distinct values`);
  for (const value of values)
    if (!axisValuePattern.test(value))
      throw new Error(`Bad value ${value} on axis ${id}`);
  const legacy = options.legacy ?? values[0]!;
  if (!values.includes(legacy))
    throw new Error(`Axis ${id} legacy value is not one of its values`);
  const weights = options.weights;
  if (
    weights &&
    (weights.length !== values.length ||
      !weights.every((w) => Number.isInteger(w) && w > 0))
  )
    throw new Error(`Axis ${id} weights must be positive integers per value`);
  const needs = options.needs;
  if (needs && Object.hasOwn(needs, legacy))
    throw new Error(`Axis ${id}: the legacy value must draw for every client`);
  if (
    options.since != null &&
    (!Number.isInteger(options.since) || options.since < 1)
  )
    throw new Error(`Axis ${id} since must be a positive integer`);
  const retired = options.legacyRetiredSince;
  if (
    retired != null &&
    (!Number.isInteger(retired) ||
      retired < 2 ||
      values.length < 2 ||
      (options.since != null && retired <= options.since))
  )
    throw new Error(
      `Axis ${id} legacyRetiredSince must be an integer above since, with another value to draw`,
    );
  return {
    id,
    values,
    legacy,
    ...(weights ? { weights } : {}),
    ...(needs ? { needs } : {}),
    ...(options.silentLegacy ? { silentLegacy: true } : {}),
    ...(options.since != null ? { since: options.since } : {}),
    ...(retired != null ? { legacyRetiredSince: retired } : {}),
  };
}

/** Restrict an axis to some of its values (a family that supports fewer). */
export function restrictAxis<V extends string, W extends V>(
  axis: Axis<V>,
  values: readonly W[],
  legacy?: W,
): Axis<W> {
  for (const value of values)
    if (!axis.values.includes(value))
      throw new Error(`Axis ${axis.id} has no value ${value}`);
  const needs = Object.fromEntries(
    Object.entries(axis.needs ?? {}).filter(([v]) => values.includes(v as W)),
  ) as Partial<Record<W, FigureCapability>>;
  return defineAxis(axis.id, values, {
    legacy:
      legacy ??
      (values.includes(axis.legacy as W) ? (axis.legacy as W) : values[0]!),
    ...(Object.keys(needs).length ? { needs } : {}),
    ...(axis.since != null ? { since: axis.since } : {}),
  });
}

let clientFigures: readonly string[] | null = null;
/** Version passed to `generateProblem`, while a problem is being built. */
let templateVersion: number | null = null;
/** The template version `generateProblem` is building, or null when a
 * generator is called outside `withTemplateVersion`. Null means the current
 * version: new clause families may appear. A stored workbook reprint passes
 * the version it was saved with, and a family added at a later version must
 * stay off that path so the older bytes still reprint. */
export function generatingVersion(): number | null {
  return templateVersion;
}
/** Axes forced to legacy because the generation version is below `since`. */
let versionGated: { id: string; value: string }[] | null = null;
/**
 * Generate at one template version. `chooseAxes` forces an axis with `since`
 * above this version to its legacy value. Synchronous only, re-entrant, and
 * restored on the way out. Outside it, axes draw exactly as they do today.
 */
export function withTemplateVersion<T>(version: number, fn: () => T): T {
  const previousVersion = templateVersion;
  const previousGated = versionGated;
  templateVersion = version;
  versionGated = [];
  try {
    return fn();
  } finally {
    templateVersion = previousVersion;
    versionGated = previousGated;
  }
}
/** Axes this generation forced to legacy because of `since`. Empty outside
 * `withTemplateVersion`. */
export function versionGatedAxes(): readonly { id: string; value: string }[] {
  return versionGated ?? [];
}
/**
 * Generate for one client: inside `build`, an axis value whose figure needs
 * a capability outside `figureCapabilities` is replaced by the axis's legacy
 * value. The server wraps every problem it sends in this; outside it (tests,
 * scripts, the review export) every value is drawable. Synchronous only.
 */
export function withClientFigures<T>(
  figureCapabilities: readonly string[],
  build: () => T,
): T {
  const previous = clientFigures;
  clientFigures = figureCapabilities;
  try {
    return build();
  } finally {
    clientFigures = previous;
  }
}
/** Can the client being generated for draw a value of this axis? */
export const clientDrawsValue = (axis: Axis, value: string): boolean => {
  const needs = axis.needs?.[value];
  return !needs || !clientFigures || clientFigures.includes(needs);
};

/** SHA-256 counter stream, unbiased bounded draws, keyed apart from the
 * content stream `[templateId, 1, seed, counter]` used by generators. */
function stream(key: readonly unknown[]): Random {
  let counter = 0;
  return (lo, hi) => {
    const span = hi - lo + 1;
    if (!Number.isInteger(span) || span < 1) throw new Error("Bad draw range");
    const limit = Math.floor(0x100000000 / span) * span;
    let n: number;
    do
      n = createHash("sha256")
        .update(JSON.stringify([...key, counter++]))
        .digest()
        .readUInt32BE(0);
    while (n >= limit);
    return lo + (n % span);
  };
}

/** Per-item surface draws (e.g. which statements of a mixed set are written
 * result-first). Separate from the content stream and from axis choices. */
export const surfaceStream = (templateId: string, seed: string): Random =>
  stream([templateId, 1, seed, "surface"]);

function draw<V extends string>(r: Random, axis: Axis<V>): V {
  const base = axis.weights ?? axis.values.map(() => 1);
  const retired =
    axis.legacyRetiredSince != null &&
    (templateVersion == null || templateVersion >= axis.legacyRetiredSince);
  const weights = retired
    ? base.map((w, i) => (axis.values[i] === axis.legacy ? 0 : w))
    : base;
  let n = r(0, weights.reduce((a, b) => a + b, 0) - 1);
  for (const [i, w] of weights.entries()) {
    if (n < w) return axis.values[i]!;
    n -= w;
  }
  throw new Error("unreachable");
}

export function validateAxes(axes: AxisSet): void {
  const entries = Object.entries(axes);
  if (entries.length > MAX_AXES) throw new Error("Too many axes");
  for (const [key, axis] of entries)
    if (key !== axis.id) throw new Error(`Axis key ${key} ≠ id ${axis.id}`);
}

/** Deterministic axis values for an instance. Each axis has its own stream. */
export function chooseAxes<A extends AxisSet>(
  templateId: string,
  seed: string,
  axes: A,
): AxisValues<A> {
  validateAxes(axes);
  return Object.fromEntries(
    Object.entries(axes).map(([key, axis]) => {
      // The draw happens even when it is replaced, so a client's capabilities
      // or a version gate never shift another axis's stream.
      const value = draw(stream([templateId, 1, seed, "axis", axis.id]), axis);
      if (
        axis.since != null &&
        templateVersion != null &&
        templateVersion < axis.since
      ) {
        versionGated?.push({ id: axis.id, value: axis.legacy });
        return [key, axis.legacy];
      }
      return [key, clientDrawsValue(axis, value) ? value : axis.legacy];
    }),
  ) as AxisValues<A>;
}

export const legacyAxes = <A extends AxisSet>(axes: A): AxisValues<A> =>
  Object.fromEntries(
    Object.entries(axes).map(([key, axis]) => [key, axis.legacy]),
  ) as AxisValues<A>;

export const isLegacy = <A extends AxisSet>(
  axes: A,
  values: AxisValues<A>,
): boolean =>
  Object.entries(axes).every(
    ([key, axis]) => values[key as keyof A] === axis.legacy,
  );

/** Every combination of axis values (for tests and coverage reports). */
export function enumerateAxes<A extends AxisSet>(axes: A): AxisValues<A>[] {
  let combos: Record<string, string>[] = [{}];
  for (const [key, axis] of Object.entries(axes))
    combos = combos.flatMap((c) =>
      axis.values.map((v) => ({ ...c, [key]: v })),
    );
  return combos as AxisValues<A>[];
}

/** The evidence form of axis values: keys sorted, plain strings. */
export const axisRecord = (values: Readonly<Record<string, string>>) =>
  Object.fromEntries(
    Object.entries(values).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );

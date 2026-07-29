/**
 * Exact signed-integer arithmetic. Every number here is an integer; no float
 * ever reaches an answer or a comparison. This is the actual subject matter of
 * the game — the ship's core is a running signed sum and the polarity is a sign
 * — so it lives in one small, fully tested module.
 */

/** U+2212 MINUS SIGN. Reads as arithmetic; a hyphen reads as a dash. */
export const MINUS = "−";

export type Polarity = 1 | -1;

/** Canonical display for a signed integer: "+7", "0", "−5". */
export function fmtSigned(n: number): string {
  if (!Number.isInteger(n)) throw new Error(`fmtSigned: not an integer: ${n}`);
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `${MINUS}${-n}`;
}

/** Bare magnitude-with-sign, no leading plus: "7", "0", "−5". */
export function fmtInt(n: number): string {
  if (!Number.isInteger(n)) throw new Error(`fmtInt: not an integer: ${n}`);
  return n < 0 ? `${MINUS}${-n}` : `${n}`;
}

/** Parse either display form back to an integer. Throws on anything else. */
export function parseInt_(s: string): number {
  const t = s.trim().replace(/−/g, "-").replace(/^\+/, "");
  if (!/^-?\d+$/.test(t)) throw new Error(`parseInt_: not an integer: ${JSON.stringify(s)}`);
  return Number(t);
}

/**
 * `parseInt_` without the throw, for the one caller that is inside the frame
 * loop. A host is free to hand a pack a value this game has no orb for; that is
 * a thing to decline out loud, not a thing to crash a child's run over.
 */
export function tryParseInt(s: string): number | null {
  const t = s.trim().replace(/−/g, "-").replace(/^\+/, "");
  if (!/^-?\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * The polarity a value belongs to. Zero is the origin: it is absorbable in
 * EITHER polarity, which is both a nice mechanic and arithmetically honest.
 */
export function polarityOf(v: number): Polarity | 0 {
  return v === 0 ? 0 : v > 0 ? 1 : -1;
}

/** Can a ship in polarity `p` absorb a value `v`? Zero always yes. */
export function absorbable(v: number, p: Polarity): boolean {
  return v === 0 || (v > 0 ? p === 1 : p === -1);
}

/** The core after absorbing `v`. Plain integer addition — that is the point. */
export function coreAfter(core: number, v: number): number {
  return core + v;
}

/** Has the core left the band [-cap, +cap]? */
export function overloaded(core: number, cap: number): boolean {
  return core > cap || core < -cap;
}

/** 0..1 — how close to the edge of the band, either side. */
export function bandLoad(core: number, cap: number): number {
  return cap <= 0 ? 1 : Math.min(1, Math.abs(core) / cap);
}

/**
 * Release payout. Integer in, integer out — the released charge is worth the
 * accumulated total, scaled by the chain multiplier, with a bonus for venting
 * within `edge` of the cap (riding the band edge is the skill ceiling).
 */
export function releaseYield(
  core: number,
  cap: number,
  mult: number,
  edge = 2,
): { darts: number; score: number; perfect: boolean } {
  const mag = Math.abs(core);
  if (mag < 3) return { darts: 0, score: 0, perfect: false };
  const perfect = mag >= cap - edge && mag <= cap;
  const darts = Math.min(36, mag + (perfect ? 8 : 0));
  const score = mag * 25 * mult * (perfect ? 3 : 1);
  return { darts, score, perfect };
}

/** Chain multiplier: 1× at 0, +1 every 6 absorbs, hard-capped at 9×. */
export function chainMult(chain: number): number {
  return Math.min(9, 1 + Math.floor(chain / 6));
}

/**
 * Lock tolerance for a Warden seal: the boss demands an exact core value.
 * Exact is a full break; near misses do graduated damage so a younger player
 * still makes progress, but exactness is worth three times as much.
 */
export function lockResult(core: number, want: number): "exact" | "near" | "miss" {
  const d = Math.abs(core - want);
  if (d === 0) return "exact";
  if (d <= 2) return "near";
  return "miss";
}

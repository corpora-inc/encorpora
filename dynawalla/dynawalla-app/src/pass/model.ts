// The day pass, as arithmetic on a clock and a list. No store, no React, no
// DOM — every rule below is decided in a Node test.
//
// The model, in one paragraph. **Every game is free to play.** Nothing is
// locked, nothing is badged, and no game is ever refused at the door on a
// first visit. When a game reaches a *natural stopping point* it says so
// (`session.transition`), and the first time that happens for a given game on
// a given day, that game rests until tomorrow. One gate per game per day, so a
// child who runs out of FUSE can go and find SIEGE — which is the entire point
// of the shape: unlimited discovery, bounded repetition, and the boundary is a
// place in the game rather than a number of minutes.
//
// **There is no timer in this file and there is none anywhere else.** A
// countdown is the mechanism this model exists to replace: it interrupts, it is
// visible, it makes a child watch a clock instead of a game, and it turns the
// stopping point into something imposed rather than something reached.
//
// ── The one asymmetry that matters ───────────────────────────────────────────
// A wrongly-open pass costs a dollar. A wrongly-closed pass tells a family that
// already paid that they did not. Everything below resolves ties towards open:
// a month pass survives its recorded expiry by a grace window because a renewal
// is a fact only the store knows and the store is not always reachable, and a
// lifetime pass is never re-examined at all. Corpán learned this the expensive
// way and the policy is copied verbatim from
// `corpan/corpan-app/src/store/entitlements.ts`.
//
// The same asymmetry decides what happens when there is no store at all, and it
// decides it the same way: **a game is never refused for want of a purchase
// that cannot be made.** Both decisions below take `billingWired` and both open
// on `false`. See `billing.ts` for what that flag is and why it is not "did the
// last `buy` fail".

/** What a family can buy. Three, and never more: a price list is not a menu. */
export type PassKind = "day" | "month" | "lifetime"

export const PASS_KINDS: readonly PassKind[] = ["day", "month", "lifetime"]

export function isPassKind(value: unknown): value is PassKind {
  return value === "day" || value === "month" || value === "lifetime"
}

/**
 * A pass this device holds.
 *
 * `expiresAt` is what the *store* said, not what this app computed, for
 * everything except the fallback below: an app that decides its own expiry is
 * an app whose clock is the thing a family has to be right about.
 */
export type Pass = {
  readonly kind: PassKind
  /** Epoch ms. `null` means it does not expire — a lifetime pass. */
  readonly expiresAt: number | null
  /** Epoch ms of the last time a store confirmed this. A hint, never a gate. */
  readonly confirmedAt: number
}

/**
 * How long past its recorded expiry a **month** pass keeps working.
 *
 * A monthly renewal happens at the store, and this app finds out about it by
 * asking — on a tablet in a car, in a house with the router off, on a plane.
 * Forty-eight hours of slack is the difference between "we could not check" and
 * "you did not pay", and only one of those is a thing to tell a child.
 *
 * A **day** pass gets none of this. Its expiry needs no round trip — it was
 * bought once, for one day, and extending it would make it a three-day pass.
 */
export const RENEWAL_GRACE_MS = 48 * 60 * 60 * 1000

/** Milliseconds a day pass runs for, when the seam has to compute one itself. */
export const DAY_PASS_MS = 24 * 60 * 60 * 1000
/** Milliseconds a month pass runs for, likewise. */
export const MONTH_PASS_MS = 30 * DAY_PASS_MS

/**
 * Whether a pass is open right now.
 *
 * Total and pure. The only place in the app that answers this question, so
 * "did they pay" has one implementation rather than one per surface.
 */
export function passIsOpen(pass: Pass | null | undefined, now: number): boolean {
  if (!pass) return false
  // Bought once. Never re-examined, never expired, never quietly withdrawn by
  // a clock. Only a definitive, online "you do not own this" clears it, and
  // that decision lives in the billing seam rather than here.
  if (pass.kind === "lifetime") return true
  if (pass.expiresAt === null) return true
  const grace = pass.kind === "month" ? RENEWAL_GRACE_MS : 0
  return now < pass.expiresAt + grace
}

// ── The day, and what rested in it ───────────────────────────────────────────

/**
 * The calendar day, in the device's own timezone, as `YYYY-MM-DD`.
 *
 * Local rather than UTC on purpose: "tomorrow" means the next time this child
 * wakes up, and a UTC boundary puts that at 4pm for a family in California and
 * at 8am for one in Delhi. A device whose clock is wrong gets the day its owner
 * believes it is, which is the answer that will not confuse anybody.
 */
export function dayKey(now: number): string {
  const date = new Date(now)
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * Which games have already had their stopping point today.
 *
 * One day at a time: the record is thrown away and rebuilt at the boundary
 * rather than accumulating, so nothing here grows without bound and there is
 * no history of a child's play to leak. Yesterday is not interesting and is
 * not kept.
 */
export type RestLedger = {
  readonly day: string
  /** Pack ids that reached a stopping point on `day`. Sorted, unique. */
  readonly resting: readonly string[]
}

export const EMPTY_LEDGER: RestLedger = { day: "", resting: [] }

/** The ledger as of `day`, cleared if the day turned over. Midnight, exactly. */
export function ledgerOn(ledger: RestLedger, day: string): RestLedger {
  return ledger.day === day ? ledger : { day, resting: [] }
}

export function isResting(ledger: RestLedger, packId: string, day: string): boolean {
  return ledger.day === day && ledger.resting.includes(packId)
}

export function markResting(ledger: RestLedger, packId: string, day: string): RestLedger {
  const today = ledgerOn(ledger, day)
  if (today.resting.includes(packId)) return today
  return { day, resting: [...today.resting, packId].sort() }
}

// ── The decision ─────────────────────────────────────────────────────────────

/**
 * What the host does when a pack says it reached a natural stopping point.
 *
 * `play-on` is the overwhelmingly common answer and it is the one that costs
 * nothing: a family with a pass, and a child who already stopped somewhere in
 * this game today, both keep playing with nothing on the screen.
 */
export type TransitionVerdict =
  /** Nothing happens. The game keeps running and the child sees no interruption. */
  | "play-on"
  /** First stopping point today for this game: it rests, and the sheet opens. */
  | "rest"

export type TransitionInput = {
  readonly packId: string
  readonly pass: Pass | null
  readonly ledger: RestLedger
  readonly now: number
  /**
   * Whether the installed billing can actually take money — `billing().wired`,
   * threaded in rather than read here.
   *
   * This module reaches for no globals on purpose: every rule in it is decided
   * from its arguments, which is why a whole simulated day fits in a Node test
   * with no store, no DOM and no module state to reset between cases. Importing
   * the billing singleton to answer one boolean would trade all of that for a
   * saved parameter.
   */
  readonly billingWired: boolean
}

export function verdictFor(input: TransitionInput): TransitionVerdict {
  // Nothing to sell, so nothing to gate. A stopping point earns its name from
  // the pass on the other side of it; without one it is a locked door with no
  // key cut for it, and the family's only remaining move is to delete the app.
  if (!input.billingWired) return "play-on"
  if (passIsOpen(input.pass, input.now)) return "play-on"
  const day = dayKey(input.now)
  // Already stopped here today. A second sheet in one game in one day is a
  // pack asking twice, and the answer to being asked twice is silence.
  if (isResting(input.ledger, input.packId, day)) return "play-on"
  return "rest"
}

/**
 * Whether this game may be started at all right now.
 *
 * Distinct from the verdict above, and the difference is the whole feel of the
 * thing: a game is *never* refused because it has not been paid for, only
 * because this device already reached its ending today. On a fresh day, with no
 * pass and nothing bought, every installed game answers `true`.
 *
 * And with no store wired it answers `true` always, ledger or no ledger. The
 * ledger outlives a build — a device that ran a gating version still carries
 * its entries in durable storage — so this is checked rather than assumed from
 * "`verdictFor` would never have written one".
 */
export function canOpen(input: {
  readonly packId: string
  readonly pass: Pass | null
  readonly ledger: RestLedger
  readonly now: number
  readonly billingWired: boolean
}): boolean {
  if (!input.billingWired) return true
  if (passIsOpen(input.pass, input.now)) return true
  return !isResting(input.ledger, input.packId, dayKey(input.now))
}

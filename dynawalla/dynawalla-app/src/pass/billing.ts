// The seam StoreKit and Play Billing will land behind. **No billing is
// implemented here and none is faked.**
//
// Everything above this file — the sheet, the parental gate, the ledger, the
// entitlement — is finished and testable without a store account, a signing
// identity or a network. Everything below it is one implementation of one
// interface with three methods. That is the whole point of the split: the
// product decision (a day pass, not a subscription) is settled and shipped,
// and the platform work is a swap of `setBilling`.
//
// **The default implementation charges nobody and grants nothing.** It reports
// `unavailable`, which the sheet renders as "not on this device yet". A stub
// that pretended to succeed would put a fake receipt into durable storage on a
// child's tablet, and the first real store query would then have to argue with
// it.
//
// Prices are here as a **fallback catalogue only**. A shipping build reads the
// localised price string from the store, because $7.99 is not what a family in
// Delhi is charged and is not what their store shows them. The strings below
// are what the sheet draws when there is no store to ask — a US default, and
// visibly the founder's list rather than a computation.

import type { Pass, PassKind } from "./model.ts"
import { DAY_PASS_MS, MONTH_PASS_MS } from "./model.ts"

/**
 * One thing a family can buy.
 *
 * `productId` is the store SKU and it is **immutable once submitted** — a
 * renamed product id is a new product with no history and no restores, in both
 * stores. Written here once so nothing derives one from a display string.
 */
export type PassProduct = {
  readonly kind: PassKind
  readonly productId: string
  /** Localised, from the store. The fallback below is a US default. */
  readonly price: string
}

/** The founder's list. Three prices, no tiers, no trial, no introductory rate. */
export const FALLBACK_PRODUCTS: readonly PassProduct[] = [
  { kind: "day", productId: "inc.corpora.dynawalla.pass.day", price: "$0.99" },
  { kind: "month", productId: "inc.corpora.dynawalla.pass.month", price: "$7.99" },
  { kind: "lifetime", productId: "inc.corpora.dynawalla.pass.lifetime", price: "$79.99" },
]

export function productFor(kind: PassKind): PassProduct {
  const found = FALLBACK_PRODUCTS.find((product) => product.kind === kind)
  if (!found) throw new RangeError(`no product for pass kind ${kind}`)
  return found
}

export type PurchaseOutcome =
  /** The store confirmed it. `pass` is what goes into durable storage. */
  | { readonly status: "granted"; readonly pass: Pass }
  /** The parent closed the store sheet. Not an error, and never reported as one. */
  | { readonly status: "cancelled" }
  /**
   * The store said, online and unambiguously, that this device owns nothing.
   * **The only thing that may ever take a pass away.** Anything inconclusive —
   * a timeout, an offline device, a rejected bridge — is `unavailable`.
   */
  | { readonly status: "not_owned" }
  /** Could not ask. Keeps whatever is already held; never downgrades. */
  | { readonly status: "unavailable"; readonly detail: string }

/**
 * The three calls a platform has to answer, and the one fact about itself it
 * has to admit. Anything a store does that is not one of these is not something
 * this product needs.
 */
export interface PassBilling {
  /**
   * Whether this implementation can actually take money.
   *
   * **The model reads this before it ever rests a game.** A stopping point is
   * only a stopping point because there is a pass on the other side of it; with
   * no store wired, the same code turns a game into a dead end that no parent
   * can reopen at any price. That is not a paywall, it is a broken app, and it
   * is exactly what a TestFlight build of this app was: two installed games,
   * one transition each, about five minutes, and then nothing.
   *
   * A flag rather than "did `buy` return `unavailable`" because the difference
   * has to be known *before* the child reaches the transition, and because the
   * two are not the same thing — a wired store that is offline is unavailable
   * this minute and sellable the next, and a family who paid must not lose the
   * day to a dropped connection.
   */
  readonly wired: boolean
  /** The catalogue, with localised prices. */
  products(): Promise<readonly PassProduct[]>
  /** Buy one. Resolves; never throws for a cancellation. */
  buy(productId: string): Promise<PurchaseOutcome>
  /**
   * Restore. Required by both stores for a non-consumable, and the thing a
   * parent reaches for on a second tablet.
   */
  restore(): Promise<PurchaseOutcome>
}

/**
 * The expiry a pass of this kind would have, bought now.
 *
 * Used **only** by a billing implementation that has no store expiry to quote —
 * the developer grant below, and nothing else. A real receipt carries its own
 * date and that date wins.
 */
export function expiryFor(kind: PassKind, now: number): number | null {
  switch (kind) {
    case "lifetime":
      return null
    case "day":
      return now + DAY_PASS_MS
    case "month":
      return now + MONTH_PASS_MS
  }
}

/**
 * What ships until a platform lands. Honest about doing nothing.
 *
 * `wired: false` is the load-bearing field. It is what keeps the day pass from
 * gating anything at all in a build with no store: every game stays open, all
 * day, for as long as this is the installed implementation.
 */
export const unwiredBilling: PassBilling = {
  wired: false,
  products: () => Promise.resolve(FALLBACK_PRODUCTS),
  buy: () =>
    Promise.resolve({
      status: "unavailable",
      detail: "no store is wired into this build",
    } as const),
  restore: () =>
    Promise.resolve({
      status: "unavailable",
      detail: "no store is wired into this build",
    } as const),
}

let current: PassBilling = unwiredBilling

/** Install a platform. Called once, at launch, by whoever owns the native side. */
export function setBilling(billing: PassBilling): void {
  current = billing
}

export function billing(): PassBilling {
  return current
}

/**
 * A billing that grants without charging, for developer mode and for tests.
 *
 * Exported rather than hidden: verifying "a purchase unlocks everything, and
 * midnight does not take it away" needs a way to hold a pass, and a developer
 * with no way to do that will find a worse one. It is reachable only from the
 * developer rows in the parent area, which are off by default and off on every
 * child's tablet.
 *
 * `wired: true`, because the point of it is to exercise the real gating path.
 * A developer grant that reported itself unwired would switch the day pass off
 * and prove nothing.
 */
export function grantingBilling(clock: () => number = Date.now): PassBilling {
  const grant = (productId: string): PurchaseOutcome => {
    const product = FALLBACK_PRODUCTS.find((entry) => entry.productId === productId)
    if (!product) return { status: "unavailable", detail: `no such product ${productId}` }
    const now = clock()
    return {
      status: "granted",
      pass: { kind: product.kind, expiresAt: expiryFor(product.kind, now), confirmedAt: now },
    }
  }
  return {
    wired: true,
    products: () => Promise.resolve(FALLBACK_PRODUCTS),
    buy: (productId) => Promise.resolve(grant(productId)),
    restore: () => Promise.resolve(grant(FALLBACK_PRODUCTS[2]?.productId ?? "")),
  }
}

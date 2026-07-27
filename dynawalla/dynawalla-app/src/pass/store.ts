// The durable side of the day pass: what was bought, and what rested today.
//
// Device-scoped, not per learner, and both halves for a reason:
//
//   * A **pass is a purchase**, and a purchase belongs to the family that made
//     it. A second child on the same tablet does not buy it again.
//   * The **rest ledger** is device-scoped too, and that is the deliberate
//     one — per-learner would make "add a profile" into an extra play, which
//     turns the profile switcher into a hole in the model and teaches a child
//     to game it.
//
// The pass survives everything: it is written on a confirmed purchase and read
// on every launch, before anything asks a store whether it is still true. There
// is no launch during which a paying family is treated as not paying, which is
// the failure Corpán's `entitlements.ts` was rebuilt to eliminate.

import { create } from "zustand"
import { persist } from "zustand/middleware"

import { durable } from "../app/persist.ts"
import { deviceKey } from "../app/profile.ts"
import { billing, type PurchaseOutcome } from "./billing.ts"
import {
  dayKey,
  EMPTY_LEDGER,
  isPassKind,
  markResting,
  passIsOpen,
  verdictFor,
  type Pass,
  type RestLedger,
  type TransitionVerdict,
} from "./model.ts"

export interface PassState {
  /** What this device holds. `null` means nothing has ever been bought. */
  readonly pass: Pass | null
  readonly ledger: RestLedger

  /** A store confirmed a purchase. The one way a pass is ever written. */
  grant: (pass: Pass) => void
  /**
   * A store said, online and definitively, that this device owns nothing.
   *
   * **The only path that removes a pass.** Not called on a timeout, not on an
   * offline device, not on a rejected bridge — see `reconcile`.
   */
  forget: () => void
  /** Record that `packId` reached its stopping point today, and say what to do. */
  reachTransition: (packId: string, now?: number) => TransitionVerdict
  /** Whether this game may be started right now. */
  mayOpen: (packId: string, now?: number) => boolean
}

const initial = { pass: null as Pass | null, ledger: EMPTY_LEDGER }

export const usePass = create<PassState>()(
  persist(
    (set, get) => ({
      ...initial,

      grant: (pass) => set({ pass }),
      forget: () => set({ pass: null }),

      reachTransition: (packId, now = Date.now()) => {
        const { pass, ledger } = get()
        const verdict = verdictFor({ packId, pass, ledger, now })
        if (verdict === "rest") {
          set({ ledger: markResting(ledger, packId, dayKey(now)) })
        }
        return verdict
      },

      mayOpen: (packId, now = Date.now()) => {
        const { pass, ledger } = get()
        if (passIsOpen(pass, now)) return true
        const day = dayKey(now)
        return !(ledger.day === day && ledger.resting.includes(packId))
      },
    }),
    {
      name: deviceKey("pass"),
      version: 1,
      storage: durable,
      partialize: ({ pass, ledger }) => ({ pass, ledger }),
      // Rehydration is where a wrongly-shaped record from a future build could
      // silently become "no pass". It is read defensively field by field, and
      // **anything unreadable in the pass is kept as no pass but anything
      // unreadable in the ledger is kept as an empty ledger** — the two
      // failures are not symmetric, and the second one hands a free day back
      // rather than taking one away.
      merge: (persisted, current) => {
        const stored = persisted as { pass?: unknown; ledger?: unknown } | undefined
        return { ...current, pass: readPass(stored?.pass), ledger: readLedger(stored?.ledger) }
      },
    },
  ),
)

function readPass(value: unknown): Pass | null {
  if (typeof value !== "object" || value === null) return null
  const record = value as Record<string, unknown>
  if (!isPassKind(record["kind"])) return null
  const expiresAt = record["expiresAt"]
  const confirmedAt = record["confirmedAt"]
  return {
    kind: record["kind"],
    expiresAt: typeof expiresAt === "number" && Number.isFinite(expiresAt) ? expiresAt : null,
    confirmedAt: typeof confirmedAt === "number" && Number.isFinite(confirmedAt) ? confirmedAt : 0,
  }
}

function readLedger(value: unknown): RestLedger {
  if (typeof value !== "object" || value === null) return EMPTY_LEDGER
  const record = value as Record<string, unknown>
  const day = record["day"]
  const resting = record["resting"]
  if (typeof day !== "string" || !Array.isArray(resting)) return EMPTY_LEDGER
  return { day, resting: resting.filter((id): id is string => typeof id === "string") }
}

/** Whether the family is currently entitled. The one read every surface uses. */
export function isPassOpen(now: number = Date.now()): boolean {
  return passIsOpen(usePass.getState().pass, now)
}

/**
 * Buy one, and fold the outcome into durable state.
 *
 * The asymmetry is the whole function: `granted` writes, `not_owned` clears,
 * and **everything else leaves what is held exactly as it was**. A parent on a
 * plane who taps a pass they already own is not downgraded by the failure to
 * reach a store.
 */
export async function buyPass(productId: string): Promise<PurchaseOutcome> {
  const outcome = await billing().buy(productId)
  applyOutcome(outcome)
  return outcome
}

export async function restorePasses(): Promise<PurchaseOutcome> {
  const outcome = await billing().restore()
  applyOutcome(outcome)
  return outcome
}

function applyOutcome(outcome: PurchaseOutcome): void {
  if (outcome.status === "granted") {
    usePass.getState().grant(outcome.pass)
    return
  }
  if (outcome.status === "not_owned") {
    // Definitive, online, unambiguous. Everything else is silence.
    console.warn("[pass] the store reports this device owns nothing; clearing the pass")
    usePass.getState().forget()
    return
  }
  if (outcome.status === "unavailable") {
    // Loud, because a silent failure here is a family who tapped Buy and saw
    // nothing at all happen.
    console.error(`[pass] the store could not be reached: ${outcome.detail}`)
  }
}

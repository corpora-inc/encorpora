// The capability boundary: everything a pack is handed, and everything it can
// do to the host.
//
// Packs are the product (ADR-0022). The host's whole job on this seam is to be
// small, total and boring: it hands a mounted pack the few facts it cannot work
// out for itself, it takes back one message, and it exposes no other surface.
// This module is the entire contract, in one file, so that reviewing what a
// pack can reach is reading forty lines rather than auditing an app.
//
// **What a pack is given.** Which learner it is for, and the device settings it
// must honour — sound, haptics, reduced motion, text size, and the quality tier
// a renderer should target on this hardware. It is given no name, no birthday,
// and nothing that identifies a child, because nothing here ever leaves the
// device and a pack has no business holding it either.
//
// **What a pack may do.** Report an answer. That is the only write. It cannot
// navigate the host, read another pack's storage, reach the network through the
// host, or move a total downwards — `answer()` only ever raises, and only the
// pack's own outcomes reach it.
//
// **What is not here yet.** Mounting: the `dynawalla-pack://` scheme handler
// and the installer are native, and they are the next milestone (ADR-0020).
// The contract lands first, and deliberately: it is the thing both sides have
// to agree on, and it is the thing that is expensive to change once a pack
// built against it is installed on a child's tablet.

import { recordFor, worldFor } from "../app/stores.ts"
import { useProfiles } from "../profiles/store.ts"
import { useSettings, type Quality, type TextSize } from "../settings/store.ts"

/** What a pack reports when a child answers. The host's only inbound message. */
export interface PackOutcome {
  /** The reporting pack, as installed. Recorded, never trusted for access. */
  readonly packId: string
  readonly correct: boolean
}

/** The device settings a pack must honour. A snapshot, never the live store. */
export interface PackSettings {
  readonly sound: boolean
  readonly haptics: boolean
  readonly reduceMotion: boolean
  readonly textSize: TextSize
  readonly quality: Quality
}

export interface PackHost {
  readonly profileId: string
  readonly settings: PackSettings
  report: (outcome: PackOutcome) => void
}

/**
 * Record one answer against the current learner.
 *
 * A correct answer cuts one aperture. That is the *only* thing that cuts one,
 * and it is synchronous with the report: the construction is what the child has
 * done, so it moves when they do it and never on a timer, a login or a purchase.
 */
export function report(outcome: PackOutcome): void {
  const { currentId } = useProfiles.getState()
  recordFor(currentId).getState().answer(outcome.correct)
  if (outcome.correct) worldFor(currentId).getState().placeOne()
}

/** The object handed to a pack at mount. Built fresh; it holds no store. */
export function packHost(): PackHost {
  const { sound, haptics, reduceMotion, textSize, quality } = useSettings.getState()
  return {
    profileId: useProfiles.getState().currentId,
    settings: { sound, haptics, reduceMotion, textSize, quality },
    report,
  }
}

// src/components/capability/popinBus.ts — module-level seam between the
// long-press hook and the host-owned sheet (capability-modules.md §5). The
// surface mounts <CapabilityPopIn/> once and provides the CapabilityHostApi;
// usePhrasePopIn only pushes requests here.
//
// (Spec home. Built under src/journey/popin/ for W4 path exclusivity;
// re-homed 1:1 by W10 — no logic change.)

import type { CapabilityHostApi } from "@shared/capabilities/core"
import type { ItemRef } from "../../contentPacks/activityContract.ts"

export interface PhrasePopInRequest {
  text: string
  lang: string
  romanization?: string
  nativeText?: string
  itemRef?: ItemRef
  /** Pause the underlying card while the sheet is open (feed-ux binding). */
  onOpen?: () => void
  onClose?: () => void
}

type Listener = (req: PhrasePopInRequest) => void

let listener: Listener | null = null
let host: CapabilityHostApi | null = null

export function setPopInCapabilityHost(h: CapabilityHostApi | null): void {
  host = h
}

export function popInCapabilityHost(): CapabilityHostApi | null {
  return host
}

export function setPopInListener(l: Listener | null): void {
  listener = l
}

/** Returns false when no sheet is mounted (affordance should no-op). */
export function requestPhrasePopIn(req: PhrasePopInRequest): boolean {
  if (!listener || !host) return false
  listener(req)
  return true
}

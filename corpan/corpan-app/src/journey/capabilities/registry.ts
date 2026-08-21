// src/journey/capabilities/registry.ts — the ONE capability registry
// (capability-modules.md §6.1). Capabilities are code, always bundled —
// lazy dynamic import() keeps each in its own chunk. What can be missing is
// their runtime needs (models/content/host seams), probed via
// checkAvailability.

import type {
  ActivitySpec,
  CapabilityAvailability,
  CapabilityHostApi,
  CapabilityModule,
} from "@shared/capabilities/core"

export type CapabilityId = "cap-pronounce" | "cap-squeeze" | "cap-segment-player"

const LOADERS: Record<CapabilityId, () => Promise<CapabilityModule>> = {
  "cap-pronounce": () => import("@shared/capabilities/pronounce").then((m) => m.capability),
  "cap-squeeze": () => import("@shared/capabilities/squeeze").then((m) => m.capability),
  "cap-segment-player": () =>
    import("@shared/capabilities/segment-player").then((m) => m.capability),
}

export function isCapabilityId(t: string): t is CapabilityId {
  return t === "cap-pronounce" || t === "cap-squeeze" || t === "cap-segment-player"
}

const cache = new Map<CapabilityId, Promise<CapabilityModule>>()

export async function loadCapability(id: CapabilityId): Promise<CapabilityModule> {
  let p = cache.get(id)
  if (!p) {
    p = LOADERS[id]()
    cache.set(id, p)
  }
  return p
}

export async function capabilityAvailability(
  id: CapabilityId,
  hostApi: CapabilityHostApi,
  spec?: ActivitySpec,
): Promise<CapabilityAvailability> {
  try {
    const mod = await loadCapability(id)
    return await mod.checkAvailability(hostApi, spec)
  } catch (err) {
    return { state: "unavailable", reason: String(err) }
  }
}

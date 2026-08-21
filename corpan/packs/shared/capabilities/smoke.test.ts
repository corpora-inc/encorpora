// Scripted smoke (exit gate): mount each capability module in the bare
// harness path (mock host, no native deps) and settle a REAL result —
// cap-pronounce via a hold-to-speak attempt against the mock whisper,
// cap-squeeze by tapping the sentence together, cap-segment-player by
// letting the fixture mini-book range play through.
import { describe, it, expect } from "vitest"
import {
  pronounceDriver,
  squeezeDriver,
  segmentPlayerDriver,
} from "./test/drivers"

const drivers = [pronounceDriver, squeezeDriver, segmentPlayerDriver]

describe("smoke: bare-harness mount → natural completion → settled result", () => {
  for (const driver of drivers) {
    it(`${driver.name} settles a measured result`, async () => {
      const cap = await driver.loadCapability()
      const host = driver.makeHost()
      const spec = driver.makeSpec()

      // The scheduler gate would consult this first (§6.2).
      const availability = await cap.checkAvailability(host, spec)
      expect(availability.state).toBe("ready")

      const container = document.createElement("div")
      document.body.appendChild(container)
      const handle = cap.mount(container, host, spec)
      await driver.complete(container, host, handle)
      const result = await Promise.race([
        handle.result,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("no settle")), 5000),
        ),
      ])

      expect(result.specId).toBe(spec.specId)
      expect(result.abandoned ?? false).toBe(false)
      expect(result.score).toBeGreaterThan(0)
      expect(result.perItem.length).toBeGreaterThan(0)
      expect(result.durationMs).toBeGreaterThanOrEqual(0)
      expect(() => structuredClone(result)).not.toThrow()

      handle.dispose()
      container.remove()
    })
  }
})

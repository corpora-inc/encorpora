// Generic capability contract suite (capability-modules.md §7.3) — executed
// by each capability's contract.test.ts. TEST-ONLY module (imports vitest);
// not exported from the core index.
import { describe, it, expect } from "vitest"
import type { ActivityResult, ActivitySpec } from "./src/activity"
import { itemRefKey } from "./src/activity"
import type { CapabilityHandle, CapabilityModule } from "./src/capability"
import type {
  createMockCapabilityHost,
  MockCapabilityHostOptions,
} from "./mock"

type MockHost = ReturnType<typeof createMockCapabilityHost>

export interface ContractSuiteDriver {
  name: string
  loadCapability(): Promise<CapabilityModule>
  makeSpec(partial?: Partial<ActivitySpec>): ActivitySpec
  makeHost(opts?: MockCapabilityHostOptions): MockHost
  /** Drive the mounted UI to a natural completion. */
  complete(
    container: HTMLElement,
    host: MockHost,
    handle: CapabilityHandle,
  ): Promise<void>
  /** True when the module opens STT sessions during a run. */
  usesStt?: boolean
  /** Run test 8 (mount with stt:false host must not throw). */
  degradesWithoutStt?: boolean
}

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()))
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const raceSettle = async (
  result: Promise<ActivityResult>,
  ms = 5000,
): Promise<ActivityResult> => {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("result did not settle")), ms)
  })
  try {
    return await Promise.race([result, timeout])
  } finally {
    clearTimeout(timer!)
  }
}

export function runContractSuite(driver: ContractSuiteDriver): void {
  describe(`${driver.name} — capability contract (§7.3)`, () => {
    const mountFresh = async (
      hostOpts?: MockCapabilityHostOptions,
      specPartial?: Partial<ActivitySpec>,
    ) => {
      const cap = await driver.loadCapability()
      const host = driver.makeHost(hostOpts)
      const spec = driver.makeSpec(specPartial)
      const container = document.createElement("div")
      document.body.appendChild(container)
      const handle = cap.mount(container, host, spec)
      return { cap, host, spec, container, handle }
    }

    it("1. mount returns synchronously; container non-empty within one frame", async () => {
      const { handle, container } = await mountFresh()
      expect(typeof handle.pause).toBe("function")
      expect(typeof handle.resume).toBe("function")
      expect(typeof handle.dispose).toBe("function")
      await frame()
      expect(container.childNodes.length).toBeGreaterThan(0)
      handle.dispose()
      container.remove()
    })

    it("2. result settles exactly once (natural completion; later events ignored)", async () => {
      const { handle, container, host, spec } = await mountFresh()
      await driver.complete(container, host, handle)
      const first = await raceSettle(handle.result)
      expect(first.specId).toBe(spec.specId)
      // Attempt to complete again — the promise identity/result must hold.
      try {
        await driver.complete(container, host, handle)
      } catch {
        /* post-settle UI may be frozen — that's fine */
      }
      const second = await handle.result
      expect(second).toBe(first)
      handle.dispose()
      container.remove()
    })

    it("3. dispose before settle → abandoned:true; container emptied; sessions cancelled", async () => {
      const { handle, container, host } = await mountFresh()
      await frame()
      handle.dispose()
      const result = await raceSettle(handle.result)
      expect(result.abandoned).toBe(true)
      expect(container.childNodes.length).toBe(0)
      if (driver.usesStt) {
        // cancelSession/releaseAudio called iff a session was opened.
        expect(host._stt.cancelled.length).toBe(host._stt.sessions.length > 0 ? host._stt.sessions.length : 0)
      }
      container.remove()
    })

    it("4. dispose after settle → no throw, no second settle", async () => {
      const { handle, container, host } = await mountFresh()
      await driver.complete(container, host, handle)
      const first = await raceSettle(handle.result)
      expect(() => handle.dispose()).not.toThrow()
      expect(() => handle.dispose()).not.toThrow()
      const second = await handle.result
      expect(second).toBe(first)
      container.remove()
    })

    it("5. pause/resume idempotent; durationMs excludes a scripted pause", async () => {
      const { handle, container, host } = await mountFresh()
      await frame()
      const before = performance.now()
      handle.pause()
      handle.pause() // idempotent
      await wait(200)
      handle.resume()
      handle.resume() // idempotent
      await driver.complete(container, host, handle)
      const result = await raceSettle(handle.result)
      const elapsed = performance.now() - before
      // The 200ms scripted pause must be excluded from active time.
      expect(result.durationMs).toBeLessThan(elapsed - 100)
      handle.dispose()
      container.remove()
    })

    it("6. startPaused mounts frozen: no speak / no startSession until resume", async () => {
      const cap = await driver.loadCapability()
      const host = driver.makeHost()
      const spec = driver.makeSpec()
      spec.params = { ...(spec.params ?? {}), startPaused: true, autoSpeakFirst: true, autoPlay: true }
      const container = document.createElement("div")
      document.body.appendChild(container)
      const handle = cap.mount(container, host, spec)
      await wait(60)
      expect(host._spoken.length).toBe(0)
      expect(host._stt.sessions.length).toBe(0)
      handle.resume()
      handle.dispose()
      container.remove()
    })

    it("7. result validates: score 0..1, perItem refs ⊆ spec refs, detail clones", async () => {
      const { handle, container, host, spec } = await mountFresh()
      await driver.complete(container, host, handle)
      const result = await raceSettle(handle.result)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(1)
      const specKeys = new Set(spec.itemRefs.map(itemRefKey))
      for (const item of result.perItem) {
        expect(specKeys.has(itemRefKey(item.itemRef))).toBe(true)
      }
      // Evidence must survive structuredClone (host boundary rule).
      expect(() => structuredClone(result)).not.toThrow()
      handle.dispose()
      container.remove()
    })

    if (driver.degradesWithoutStt) {
      it("8. missing-optional-host degradation: stt:false host never throws", async () => {
        const cap = await driver.loadCapability()
        const host = driver.makeHost({ stt: false })
        const spec = driver.makeSpec()
        const container = document.createElement("div")
        document.body.appendChild(container)
        let handle: CapabilityHandle | null = null
        expect(() => {
          handle = cap.mount(container, host, spec)
        }).not.toThrow()
        const result = await raceSettle(handle!.result)
        expect(result.abandoned).toBe(true)
        expect(result.detail?.flags?.sttUnavailable).toBe(true)
        handle!.dispose()
        container.remove()
      })
    }
  })
}

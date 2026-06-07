// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from "vitest"
import { resolveServerUrl } from "./initMultiplayer"

/**
 * resolveServerUrl — the single source of truth for "is multiplayer on, and
 * where". Proves the documented precedence so a deployed server can be wired
 * either at runtime (host/QA) OR baked at build time, while staying strictly
 * opt-in (undefined → single-player) when nothing is set.
 *
 *   1. globalThis.__WP_SERVER_URL   (runtime injection — wins)
 *   2. ?wpServer= / ?server=        (standalone + QA)
 *   3. import.meta.env.VITE_WP_SERVER_URL (build-time bake — the App Runner URL)
 */
describe("resolveServerUrl", () => {
  const g = globalThis as { __WP_SERVER_URL?: string }

  afterEach(() => {
    delete g.__WP_SERVER_URL
    // Reset the query string so cases don't bleed into each other.
    window.history.replaceState({}, "", "/")
    vi.unstubAllEnvs()
  })

  it("returns undefined when nothing is configured (single-player default)", () => {
    expect(resolveServerUrl()).toBeUndefined()
  })

  it("prefers the runtime __WP_SERVER_URL injection above all else", () => {
    g.__WP_SERVER_URL = "wss://runtime.example/plaza"
    window.history.replaceState({}, "", "/?wpServer=wss://query.example")
    vi.stubEnv("VITE_WP_SERVER_URL", "wss://baked.example")
    expect(resolveServerUrl()).toBe("wss://runtime.example/plaza")
  })

  it("reads ?wpServer= / ?server= query params", () => {
    window.history.replaceState({}, "", "/?wpServer=wss://q1.example")
    expect(resolveServerUrl()).toBe("wss://q1.example")
    window.history.replaceState({}, "", "/?server=wss://q2.example")
    expect(resolveServerUrl()).toBe("wss://q2.example")
  })

  it("query param wins over the build-time bake", () => {
    window.history.replaceState({}, "", "/?wpServer=wss://q.example")
    vi.stubEnv("VITE_WP_SERVER_URL", "wss://baked.example")
    expect(resolveServerUrl()).toBe("wss://q.example")
  })

  it("falls back to the build-time VITE_WP_SERVER_URL bake when nothing else is set", () => {
    vi.stubEnv("VITE_WP_SERVER_URL", "wss://plaza.awsapprunner.com")
    expect(resolveServerUrl()).toBe("wss://plaza.awsapprunner.com")
  })
})

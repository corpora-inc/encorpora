/**
 * beatlounge — deferUnmount: the unmount returned by modules + the pack root
 * must be (a) once-only and (b) DEFERRED past the current render. Calling
 * root.unmount() synchronously inside a React render/commit is what black-screens
 * the pack on reload, so this guards the fix.
 */

import { describe, it, expect, vi } from "vitest"
import type { Root } from "react-dom/client"
import { makeDeferredUnmount } from "./deferUnmount"

const fakeRoot = (): Root => {
  // Only `unmount` matters here; `render` is unused.
  return { unmount: vi.fn(), render: vi.fn() } as unknown as Root
}

describe("makeDeferredUnmount", () => {
  it("does NOT call root.unmount synchronously (defers past the current render)", () => {
    const root = fakeRoot()
    const unmount = makeDeferredUnmount(root)
    unmount()
    // The whole point: synchronous calls must not interrupt a React render.
    expect(root.unmount).not.toHaveBeenCalled()
  })

  it("calls root.unmount once on a later microtask", async () => {
    const root = fakeRoot()
    makeDeferredUnmount(root)()
    await Promise.resolve()
    expect(root.unmount).toHaveBeenCalledTimes(1)
  })

  it("is idempotent: calling unmount twice still unmounts only once", async () => {
    const root = fakeRoot()
    const unmount = makeDeferredUnmount(root)
    unmount()
    unmount()
    unmount()
    await Promise.resolve()
    await Promise.resolve()
    expect(root.unmount).toHaveBeenCalledTimes(1)
  })

  it("runs the `before` cleanup synchronously and only once", () => {
    const root = fakeRoot()
    const before = vi.fn()
    const unmount = makeDeferredUnmount(root, before)
    unmount()
    unmount()
    expect(before).toHaveBeenCalledTimes(1)
  })

  it("still defers the unmount even if the `before` cleanup throws", async () => {
    const root = fakeRoot()
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const unmount = makeDeferredUnmount(root, () => {
      throw new Error("dispose blew up")
    })
    expect(() => unmount()).not.toThrow() // a throwing dispose must not bubble
    await Promise.resolve()
    expect(root.unmount).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it("swallows a throw from root.unmount (detached container)", async () => {
    const root = fakeRoot()
    ;(root.unmount as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error("already detached")
    })
    const unmount = makeDeferredUnmount(root)
    unmount()
    // The deferred unmount runs on a microtask; its throw must be contained.
    await expect(Promise.resolve().then(() => {})).resolves.toBeUndefined()
    expect(root.unmount).toHaveBeenCalledTimes(1)
  })
})

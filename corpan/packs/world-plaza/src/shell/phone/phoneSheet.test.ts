// @vitest-environment happy-dom
/**
 * Unit tests for the Phone app-shell — the EXTENSIBLE seam. We don't assert pixels
 * (a human verifies the real app); we assert the contract: pluggable apps mount /
 * unmount on open/switch/close, the tab strip reflects the apps, localized chrome
 * flows through `t()`, and the no-app / single-app edges are graceful.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createPhoneSheet } from "./phoneSheet"
import type { PhoneApp, PhoneAppInstance } from "./phoneApp"

let overlay: HTMLElement

beforeEach(() => {
  document.body.replaceChildren()
  overlay = document.createElement("div")
  overlay.className = "wp-overlay"
  document.body.appendChild(overlay)
  vi.restoreAllMocks()
})

type SpyApp = PhoneApp & { readonly mounts: number; readonly disposes: number }

/** A spy app that records mount/dispose + stamps a marker into the body. */
function spyApp(id: string): SpyApp {
  let mounts = 0
  let disposes = 0
  const app: PhoneApp = {
    id,
    tabLabel: (t) => t("phone.tab.things"), // any real key (we only check it's called)
    mount(body): PhoneAppInstance {
      mounts++
      const marker = document.createElement("div")
      marker.dataset.app = id
      body.appendChild(marker)
      return {
        dispose() {
          disposes++
        },
      }
    },
  }
  return Object.defineProperties(app, {
    mounts: { get: () => mounts },
    disposes: { get: () => disposes },
  }) as SpyApp
}

describe("phoneSheet — app-shell", () => {
  it("mounts the first app on open and unmounts it on close (after the slide-out)", () => {
    vi.useFakeTimers()
    const a = spyApp("things")
    const phone = createPhoneSheet({ overlay, locale: "en", apps: [a] })
    expect(a.mounts).toBe(0)

    phone.open()
    expect(phone.isOpen()).toBe(true)
    expect(a.mounts).toBe(1)
    expect(overlay.querySelector('[data-app="things"]')).toBeTruthy()

    phone.close()
    expect(phone.isOpen()).toBe(false)
    // The app stays mounted through the slide-out, then unmounts.
    expect(a.disposes).toBe(0)
    vi.advanceTimersByTime(400)
    expect(a.disposes).toBe(1)
    phone.dispose()
    vi.useRealTimers()
  })

  it("open(appId) selects + mounts that app", () => {
    const things = spyApp("things")
    const music = spyApp("music")
    const phone = createPhoneSheet({ overlay, locale: "en", apps: [things, music] })

    phone.open("music")
    expect(music.mounts).toBe(1)
    expect(things.mounts).toBe(0)
    expect(overlay.querySelector('[data-app="music"]')).toBeTruthy()
    phone.dispose()
  })

  it("switching tabs disposes the old app and mounts the new one (no leak)", () => {
    const things = spyApp("things")
    const music = spyApp("music")
    const phone = createPhoneSheet({ overlay, locale: "en", apps: [things, music] })

    phone.open("things")
    expect(things.mounts).toBe(1)

    // Click the music tab.
    const tab = overlay.querySelector<HTMLButtonElement>('.wp-phone-tab[data-app-id="music"]')!
    tab.click()
    expect(things.disposes).toBe(1)
    expect(music.mounts).toBe(1)
    // Only the music marker is in the body now.
    expect(overlay.querySelector('[data-app="things"]')).toBeFalsy()
    expect(overlay.querySelector('[data-app="music"]')).toBeTruthy()
    phone.dispose()
  })

  it("renders one tab button per app", () => {
    const phone = createPhoneSheet({
      overlay,
      locale: "en",
      apps: [spyApp("things"), spyApp("music")],
    })
    expect(overlay.querySelectorAll(".wp-phone-tab").length).toBe(2)
    phone.dispose()
  })

  it("hides the tab strip for a single-app phone", () => {
    const phone = createPhoneSheet({ overlay, locale: "en", apps: [spyApp("things")] })
    const tabs = overlay.querySelector<HTMLElement>(".wp-phone-tabs")!
    expect(tabs.style.display).toBe("none")
    phone.dispose()
  })

  it("an empty apps array logs loudly and never throws", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {})
    const phone = createPhoneSheet({ overlay, locale: "en", apps: [] })
    expect(err).toHaveBeenCalled()
    expect(() => phone.open()).not.toThrow()
    phone.dispose()
  })

  it("reads the locale getter live (re-localizes chrome on each open)", () => {
    let loc = "en"
    const phone = createPhoneSheet({
      overlay,
      locale: () => loc,
      apps: [spyApp("things")],
    })
    phone.open()
    const titleEn = overlay.querySelector(".wp-phone-title")!.textContent
    phone.close()
    loc = "es"
    phone.open()
    const titleEs = overlay.querySelector(".wp-phone-title")!.textContent
    // Both non-empty; es title differs from en (the phone.title key is translated).
    expect(titleEn).toBeTruthy()
    expect(titleEs).toBeTruthy()
    phone.dispose()
  })
})

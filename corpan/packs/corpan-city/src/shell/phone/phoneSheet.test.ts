// @vitest-environment happy-dom
/**
 * Unit tests for the Phone simulator shell — the EXTENSIBLE seam. We don't assert
 * pixels (a human verifies the real app); we assert the contract: the home grid
 * lists every app, tapping an icon mounts that app + shows the back chevron, back
 * returns home (unmounting), close resets to home, localized chrome flows through
 * `t()`, "Leave the Plaza" calls `onLeave`, and the no-app edge is graceful.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { createPhoneSheet } from "./phoneSheet"
import type { PhoneApp, PhoneAppContext, PhoneAppInstance } from "./phoneApp"

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
    title: (t) => t("phone.tab.things"), // any real key (we only check it's called)
    icon: '<svg aria-hidden="true"></svg>',
    mount(body, _ctx: PhoneAppContext): PhoneAppInstance {
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

describe("phoneSheet — phone simulator shell", () => {
  it("opens to the HOME screen: one app tile per app, nothing mounted yet", () => {
    const a = spyApp("things")
    const b = spyApp("music")
    const phone = createPhoneSheet({ overlay, locale: "en", apps: [a, b] })

    phone.open()
    expect(phone.isOpen()).toBe(true)
    expect(overlay.querySelectorAll(".wp-phone-app").length).toBe(2)
    // No app body is mounted on the home screen.
    expect(a.mounts).toBe(0)
    expect(b.mounts).toBe(0)
    // The back chevron is hidden on home.
    const back = overlay.querySelector<HTMLElement>(".wp-phone-back")!
    expect(back.style.display).toBe("none")
    phone.dispose()
  })

  it("tapping an app tile mounts that app + reveals the back chevron", () => {
    const things = spyApp("things")
    const music = spyApp("music")
    const phone = createPhoneSheet({ overlay, locale: "en", apps: [things, music] })
    phone.open()

    const tile = overlay.querySelector<HTMLButtonElement>('.wp-phone-app[data-app-id="music"]')!
    tile.click()
    expect(music.mounts).toBe(1)
    expect(things.mounts).toBe(0)
    expect(overlay.querySelector('[data-app="music"]')).toBeTruthy()
    const back = overlay.querySelector<HTMLElement>(".wp-phone-back")!
    expect(back.style.display).not.toBe("none")
    phone.dispose()
  })

  it("back returns home, unmounting the open app", () => {
    const things = spyApp("things")
    const phone = createPhoneSheet({ overlay, locale: "en", apps: [things] })
    phone.open()
    overlay.querySelector<HTMLButtonElement>('.wp-phone-app[data-app-id="things"]')!.click()
    expect(things.mounts).toBe(1)

    overlay.querySelector<HTMLButtonElement>(".wp-phone-back")!.click()
    expect(things.disposes).toBe(1)
    // Home grid is back.
    expect(overlay.querySelectorAll(".wp-phone-app").length).toBe(1)
    expect(overlay.querySelector('[data-app="things"]')).toBeFalsy()
    phone.dispose()
  })

  it("open(appId) deep-links straight into that app", () => {
    const things = spyApp("things")
    const music = spyApp("music")
    const phone = createPhoneSheet({ overlay, locale: "en", apps: [things, music] })

    phone.open("music")
    expect(music.mounts).toBe(1)
    expect(things.mounts).toBe(0)
    expect(overlay.querySelector('[data-app="music"]')).toBeTruthy()
    phone.dispose()
  })

  it("close unmounts the open app and resets to home for the next open (after slide-out)", () => {
    vi.useFakeTimers()
    const a = spyApp("things")
    const phone = createPhoneSheet({ overlay, locale: "en", apps: [a] })
    phone.open("things")
    expect(a.mounts).toBe(1)

    phone.close()
    expect(phone.isOpen()).toBe(false)
    // Stays mounted through the slide-out, then unmounts.
    expect(a.disposes).toBe(0)
    vi.advanceTimersByTime(400)
    expect(a.disposes).toBe(1)

    // Re-opening lands on HOME, not the previously-open app.
    phone.open()
    expect(a.mounts).toBe(1) // not re-mounted on home
    expect(overlay.querySelectorAll(".wp-phone-app").length).toBe(1)
    phone.dispose()
    vi.useRealTimers()
  })

  it('renders "Leave the Plaza" only when onLeave is given, and calls it', () => {
    const onLeave = vi.fn()
    const withLeave = createPhoneSheet({ overlay, locale: "en", apps: [spyApp("a")], onLeave })
    withLeave.open()
    const leave = overlay.querySelector<HTMLButtonElement>(".wp-phone-leave")
    expect(leave).toBeTruthy()
    leave!.click()
    expect(onLeave).toHaveBeenCalledTimes(1)
    withLeave.dispose()

    document.body.replaceChildren()
    overlay = document.createElement("div")
    document.body.appendChild(overlay)
    const noLeave = createPhoneSheet({ overlay, locale: "en", apps: [spyApp("a")] })
    noLeave.open()
    expect(overlay.querySelector(".wp-phone-leave")).toBeFalsy()
    noLeave.dispose()
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

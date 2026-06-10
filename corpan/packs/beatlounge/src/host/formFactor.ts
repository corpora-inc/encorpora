/**
 * beatlounge — form-factor detection. Phone < 600px, desktop ≥ 1024px, tablet
 * between. matchMedia-driven so it tracks rotation / window resize. Used by the
 * host's `form()` and by the shell to switch Rail orientation.
 */

import type { FormFactor } from "../contracts/module"

export const PHONE_MAX = 600
export const DESKTOP_MIN = 1024

export const formForWidth = (w: number): FormFactor => {
  if (w < PHONE_MAX) return "phone"
  if (w >= DESKTOP_MIN) return "desktop"
  return "tablet"
}

/**
 * Observe the viewport and call `onChange` whenever the form factor crosses a
 * breakpoint. Returns a `{ get, dispose }` pair. SSR/test-safe (returns the
 * current value once and a no-op disposer when matchMedia is unavailable).
 */
export const createFormObserver = (
  onChange?: (form: FormFactor) => void
): { get(): FormFactor; dispose(): void } => {
  const read = (): FormFactor =>
    typeof window === "undefined" ? "desktop" : formForWidth(window.innerWidth)

  let current = read()

  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return { get: () => current, dispose: () => {} }
  }

  const phone = window.matchMedia(`(max-width: ${PHONE_MAX - 1}px)`)
  const desktop = window.matchMedia(`(min-width: ${DESKTOP_MIN}px)`)

  const handle = () => {
    const next = read()
    if (next !== current) {
      current = next
      onChange?.(next)
    }
  }

  phone.addEventListener("change", handle)
  desktop.addEventListener("change", handle)

  return {
    get: () => current,
    dispose: () => {
      phone.removeEventListener("change", handle)
      desktop.removeEventListener("change", handle)
    },
  }
}

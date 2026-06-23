/**
 * beatlounge — a mutable chrome bridge so the host can be built BEFORE the
 * shell's live chrome callbacks exist. App creates one bridge, hands its
 * `chrome` to createHost, and lets the shell publish the real callbacks via
 * `set()` once it mounts. Until then the bridge no-ops (with a warning, since
 * a module calling enterImmersive pre-mount is a real bug — noisy-not-silent).
 */

import type { ShellChrome } from "./createHost"
import type { FormFactor, ModuleId } from "../contracts/module"

export interface ChromeBridge {
  /** The stable ShellChrome to pass to createHost. */
  readonly chrome: ShellChrome
  /** The shell publishes its live callbacks here on mount. */
  set(impl: Partial<ShellChrome>): void
}

export const createChromeBridge = (initialForm: () => FormFactor): ChromeBridge => {
  let enterImmersive: (id: ModuleId) => () => void = () => {
    console.warn("[beatlounge] enterImmersive called before shell mounted")
    return () => {}
  }
  let toast: ShellChrome["toast"] = (msg) => {
    console.warn("[beatlounge] toast before shell mounted:", msg)
  }
  let form: ShellChrome["form"] = initialForm

  return {
    chrome: {
      enterImmersive: (id) => enterImmersive(id),
      toast: (msg, opts) => toast(msg, opts),
      form: () => form(),
    },
    set(impl) {
      if (impl.enterImmersive) enterImmersive = impl.enterImmersive
      if (impl.toast) toast = impl.toast
      if (impl.form) form = impl.form
    },
  }
}

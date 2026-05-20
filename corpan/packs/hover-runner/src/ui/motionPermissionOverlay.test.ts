import { describe, expect, it, afterEach } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import { setLanguage, t } from "../i18n"
import { createMotionPermissionOverlay } from "./motionPermissionOverlay"

const TEST_KEYS = [
  "motion.overlay.title",
  "motion.overlay.body",
  "motion.overlay.allow",
  "motion.overlay.dismiss",
  "motion.overlay.requesting",
  "motion.overlay.denied_title",
  "motion.overlay.denied_body",
  "motion.overlay.error_title",
  "motion.overlay.error_body",
  "motion.overlay.retry",
  "settings.gameplay.motion_controls.status.denied",
] as const

afterEach(() => {
  document.body.innerHTML = ""
  setLanguage("en")
})

describe("motion permission overlay", () => {
  it("renders labels for both actions", () => {
    setLanguage("en")
    const parent = document.createElement("div")
    document.body.appendChild(parent)

    const overlay = createMotionPermissionOverlay({
      parent,
      onAllow: () => {},
      onDismiss: () => {},
    })

    const buttons = Array.from(
      parent.querySelectorAll<HTMLButtonElement>("button"),
    )
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.textContent).toBe(t("motion.overlay.allow"))
    expect(buttons[1]?.textContent).toBe(t("motion.overlay.dismiss"))

    overlay.dispose()
  })

  it("all locale files include the motion overlay keys used by the UI", () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const localesDir = join(here, "..", "locales")
    const localeFiles = readdirSync(localesDir).filter((file) => file.endsWith(".json"))

    for (const file of localeFiles) {
      const strings = JSON.parse(
        readFileSync(join(localesDir, file), "utf8"),
      ) as Record<string, string>

      for (const key of TEST_KEYS) {
        expect(strings, `${file} is missing ${key}`).toHaveProperty(key)
      }
    }
  })
})

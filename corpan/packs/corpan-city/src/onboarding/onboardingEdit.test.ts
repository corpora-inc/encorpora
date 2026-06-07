// @vitest-environment happy-dom
/**
 * #110 — RE-ONBOARD / edit identity. A returning player re-runs ONLY the name +
 * look steps (seeded from their CURRENT identity) to change them. These tests pin
 * the contract: edit mode skips welcome + music, opens on the seeded name, and
 * "Save" resolves with a VALID (possibly edited) identity that the caller persists
 * + applies in place.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { runOnboarding, defaultIdentity } from "./onboarding"
import { GeneratedIdentity, AvatarSpec } from "@corpan-city/contracts"

let root: HTMLElement

beforeEach(() => {
  localStorage.clear()
  document.body.replaceChildren()
  root = document.createElement("div")
  document.body.appendChild(root)
})

const seed = () => defaultIdentity("player-local")

function click(re: RegExp): void {
  const btns = Array.from(document.querySelectorAll<HTMLButtonElement>(".wp-onb-btn"))
  const btn = btns.find((b) => re.test(b.textContent ?? ""))
  if (!btn) throw new Error(`no onboarding button matching ${re} (saw: ${btns.map((b) => b.textContent).join(" | ")})`)
  btn.click()
}

describe("onboarding — edit identity (#110)", () => {
  it("EDIT mode opens on the NAME step seeded with the current name (not a random roll, no welcome)", () => {
    const id = seed()
    void runOnboarding(root, { editOnly: true, seedName: id.name, seedAvatar: id.avatar, native: "en" })
    // No welcome hero (that's first-run only) — we're already on the name step.
    expect(document.querySelector(".wp-onb-hero")).toBeNull()
    // The name label shows the SEEDED display name, not a fresh random roll.
    expect(document.querySelector(".wp-onb-name")?.textContent).toBe(id.name.displayName)
    // Two step dots (name · dress), not four.
    expect(document.querySelectorAll(".wp-onb-dot").length).toBe(2)
  })

  it("Save (name → dress, unchanged) resolves with the SEEDED identity", async () => {
    const id = seed()
    const done = runOnboarding(root, { editOnly: true, seedName: id.name, seedAvatar: id.avatar, native: "en" })
    click(/use this name/i) // step 1 primary → advance to dress
    // On the dress step the primary button SAVES (edit mode) → resolves.
    click(/save/i)
    const res = await done
    // A valid identity (the game can trust it) — and the name is unchanged.
    GeneratedIdentity.parse(res.name)
    AvatarSpec.parse(res.avatar)
    expect(res.name.displayName).toBe(id.name.displayName)
  })

  it("EDIT mode never shows the music step (no radio re-consent on a profile edit)", async () => {
    const id = seed()
    const done = runOnboarding(root, { editOnly: true, seedName: id.name, seedAvatar: id.avatar, native: "en" })
    click(/use this name/i) // name → dress
    // The music step's hallmark copy must NOT appear anywhere in the edit flow.
    expect(document.querySelector(".wp-onb-music-hero")).toBeNull()
    click(/save/i)
    await done
  })

  it("Skip during edit resolves with the seeded identity (a no-op cancel)", async () => {
    const id = seed()
    const done = runOnboarding(root, { editOnly: true, seedName: id.name, seedAvatar: id.avatar, native: "en" })
    document.querySelector<HTMLButtonElement>(".wp-onb-skip")!.click()
    const res = await done
    expect(res.name.displayName).toBe(id.name.displayName)
  })

  it("first-run (no editOnly) still shows the welcome hero + four dots", () => {
    void runOnboarding(root, { native: "en" })
    expect(document.querySelector(".wp-onb-hero")).not.toBeNull()
    expect(document.querySelectorAll(".wp-onb-dot").length).toBe(4)
  })
})

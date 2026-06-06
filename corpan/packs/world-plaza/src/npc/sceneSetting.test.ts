/**
 * #109 — Scene SETTING is modern "Corpan City", not colonial "Antigua-1770".
 *
 * Text/identity ONLY: `setting.{place,era,mood}` + `narrativeBlurb` are modernised
 * so the persona seed reads "...in Corpan City" instead of "...in Antigua" (the
 * last colonial thread). HARD CONSTRAINT: palette/visual/world-gen values are
 * UNCHANGED — these tests assert the palette keys are still present + untouched and
 * the scene id/themeId (loader keys) are preserved.
 *
 * Also locks the `fallbackLangOf` fix: the world still teaches Spanish (es voice
 * hints), so the es scripted fallback must STILL fire even though the era string is
 * no longer "1770" — while the dev Tokyo scene stays neutral.
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import { Scene } from "@world-plaza/contracts"
import { generatePersona, type PersonaContext } from "./personaGen"
import { personaSeed } from "./promptProgram"
import type { CharacterSpec, Demeanor } from "../character/characterSpec"

const here = dirname(fileURLToPath(import.meta.url))
const raw = (rel: string) => readFileSync(resolve(here, "../../content", rel), "utf8")
const json = (rel: string) => JSON.parse(raw(rel))

const SCENE_FILES = ["scenes/antigua-grand.json", "scenes/antigua-1770.json"]

const specWith = (demeanor: Demeanor): CharacterSpec =>
  ({ demeanor }) as unknown as CharacterSpec

describe("#109 modern Corpan City scene setting (text only)", () => {
  for (const file of SCENE_FILES) {
    describe(file, () => {
      const obj = json(file)
      const scene = Scene.parse(obj)

      it("setting is modern Corpan City — no colonial Antigua/1770 identity text", () => {
        expect(scene.setting.place).toBe("Corpan City")
        expect(scene.setting.era).not.toMatch(/177|colonial/i)
        expect(scene.setting.mood).not.toMatch(/colonial/i)
        // no stray colonial cue anywhere in the player-facing identity text
        const identity = `${scene.setting.place} ${scene.setting.era} ${scene.setting.mood} ${scene.narrativeBlurb}`
        expect(identity).not.toMatch(/antigua|colonial|1770|cobblestone/i)
      })

      it("the persona seed reads '…in Corpan City', never '…in Antigua'", () => {
        const p = generatePersona("seed:1", {
          scene,
          spec: specWith("friendly"),
        } satisfies PersonaContext)
        const seed = personaSeed(p, scene, "es")
        expect(seed).toContain("Corpan City")
        expect(seed).not.toMatch(/Antigua/i)
      })

      it("still teaches Spanish — the es scripted fallback fires (fallbackLangOf fix)", () => {
        // baker has a bespoke ES fallback pack; if fallbackLangOf regressed to
        // neutral, this would be the English NEUTRAL_FALLBACK instead.
        const p = generatePersona("seed:baker", {
          scene,
          spec: specWith("cheery"),
          anchorId: "plaza", // venue → barista, but fallback lang is scene-level
        } satisfies PersonaContext)
        const text = p.scriptedFallback.map((l) => l.text).join(" ")
        // a Spanish marker that the neutral English pack never contains
        expect(text).toMatch(/[¡¿]|café|hola|buenos|gracias|vuelve|por favor/i)
      })

      it("PALETTE + visual/world-gen values are UNCHANGED (hard constraint)", () => {
        // palette must still be present with its tuned warm paper-craft hexes.
        expect(obj.palette).toBeTruthy()
        expect(obj.palette.ground).toBe("#d9c7a3")
        expect(obj.palette.sky).toBe("#bfe0e8")
        expect(obj.palette.accent).toBe("#c46b4a")
        // loader keys preserved (renaming these would ripple into imports/economy).
        expect(obj.themeId).toBe("paper")
        expect(typeof obj.id).toBe("string")
        expect(obj.id).toMatch(/antigua/) // id intentionally kept to minimise blast radius
      })
    })
  }

  it("the dev Tokyo scene stays NEUTRAL (no false Spanish fallback from the rename)", () => {
    const tokyo = Scene.parse(json("scenes/tokyo-2050.json"))
    const p = generatePersona("seed:tk", {
      scene: tokyo,
      spec: specWith("friendly"),
    } satisfies PersonaContext)
    const text = p.scriptedFallback.map((l) => l.text).join(" ")
    // the neutral English pack — NOT Spanish
    expect(text).toMatch(/welcome|hello|traveler/i)
    expect(text).not.toMatch(/[¡¿]|buenos días/i)
  })
})

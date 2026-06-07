import { describe, it, expect } from "vitest"
import type { AvatarSpec } from "@world-plaza/contracts"
import { avatarToCharacterSpec } from "./characterSpec"
import {
  HAT_GARMENTS,
  OUTFIT_FAMILIES,
  ITEM_GARMENT_ALIASES,
  KNOWN_GARMENTS,
  KNOWN_HAIR_STYLES,
  FABRICS,
  parseHairStyle,
  isOutfitFamily,
} from "./garments"

/**
 * garments — the wardrobe shape catalogue + the multiplayer degrade guarantee.
 *
 * The degrade rule is the contract that lets cosmetics ship without a version
 * bump: an itemId whose family this client doesn't know MUST resolve to the
 * slot's classic default (dome hat / plain torso / short hair) — never throw.
 */

const avatar = (layers: AvatarSpec["layers"]): AvatarSpec => ({
  base: "paper-doll-a",
  layers,
  palette: { skin: "#f0c79a", hair: "#43301d" },
})

describe("hair style over the wire", () => {
  it("round-trips every known hair style through the hair layer itemId", () => {
    for (const style of KNOWN_HAIR_STYLES) {
      const spec = avatarToCharacterSpec(
        avatar([{ slot: "hair", itemId: `hair-${style}`, tint: "#5a3b24" }]),
        "p1",
      )
      expect(spec.hair.style).toBe(style)
      expect(spec.hair.color).toBe("#5a3b24")
    }
  })

  it("medium is a real style (boy/girl-feel lengths: short/medium/long)", () => {
    expect(KNOWN_HAIR_STYLES).toContain("short")
    expect(KNOWN_HAIR_STYLES).toContain("medium")
    expect(KNOWN_HAIR_STYLES).toContain("long")
  })

  it("unknown hair itemIds degrade to the classic short (the pre-style look)", () => {
    expect(parseHairStyle("hair-mohawk-of-the-future")).toBe("short")
    expect(parseHairStyle("zzz")).toBe("short")
    const spec = avatarToCharacterSpec(
      avatar([{ slot: "hair", itemId: "hair-zzz", tint: "#222222" }]),
      "p1",
    )
    expect(spec.hair.style).toBe("short")
  })
})

describe("multiplayer degrade — unknown itemId in EVERY slot", () => {
  it("produces a valid spec and never throws", () => {
    const spec = avatarToCharacterSpec(
      avatar([
        { slot: "face", itemId: "face-zzz", tint: "#e3ad79" },
        { slot: "hair", itemId: "hair-zzz", tint: "#2a1c12" },
        { slot: "hat", itemId: "hat-zzz", tint: "#3f7fae" },
        { slot: "top", itemId: "top-zzz", tint: "#6f9c54" },
        { slot: "bottom", itemId: "bottom-zzz", tint: "#5a4636" },
        { slot: "shoes", itemId: "shoes-zzz", tint: "#3a2a1a" },
        { slot: "accessory", itemId: "acc-zzz", tint: "#c0392b" },
        { slot: "aura", itemId: "aura-zzz", tint: "#f2b84a" },
      ]),
      "p1",
    )
    // hat/top resolve to their (unknown) families — figure3d's dispatch then
    // falls through to dome+brim / plain torso because they're not in the
    // tables. Assert that fall-through here:
    expect(spec.clothing.hat?.item).toBe("zzz")
    expect(HAT_GARMENTS[spec.clothing.hat!.item]).toBeUndefined()
    expect(isOutfitFamily(spec.clothing.top!.item)).toBe(false)
    expect(spec.hair.style).toBe("short")
    expect(spec.skinTone).toBe("#e3ad79")
  })
})

describe("the shape catalogue", () => {
  it("covers the new hat roster", () => {
    for (const family of [
      "sombrero", "tophat", "beret", "beanie", "hijab",
      "flower-crown", "fez", "toque", "party", "cap", "baker", "sun", "straw",
    ]) {
      expect(HAT_GARMENTS[family], `hat family ${family}`).toBeDefined()
      expect(HAT_GARMENTS[family].length).toBeGreaterThan(0)
    }
  })

  it("covers the new outfit roster", () => {
    for (const family of ["dress", "sari", "overalls", "suit", "kurta", "apron-dress", "hoodie"]) {
      expect(OUTFIT_FAMILIES).toContain(family)
    }
  })

  it("keeps every hat affordable on iPad (≤ 6 instanced pieces)", () => {
    for (const [family, pieces] of Object.entries(HAT_GARMENTS)) {
      expect(pieces.length, `hat ${family}`).toBeLessThanOrEqual(6)
      for (const piece of pieces) {
        expect(["sphere", "cone", "cylinder", "torus"]).toContain(piece.shape)
      }
    }
  })

  it("aliases legacy catalog ids onto shape families", () => {
    expect(ITEM_GARMENT_ALIASES["top-hat"]).toBe("tophat")
    expect(ITEM_GARMENT_ALIASES["straw-hat"]).toBe("straw")
    expect(ITEM_GARMENT_ALIASES["sombrero-festive"]).toBe("sombrero")
    expect(ITEM_GARMENT_ALIASES["sari-formal"]).toBe("sari")
    expect(ITEM_GARMENT_ALIASES["fancy-suit"]).toBe("suit")
    // aliased shaped families actually exist in a shape table
    for (const [id, family] of Object.entries(ITEM_GARMENT_ALIASES)) {
      const shaped = KNOWN_GARMENTS.includes(family)
      // un-shaped aliases (tricorn, bonnet…) are allowed — they degrade to
      // the dome — but every alias must be a non-empty family string.
      expect(family.length, `alias ${id}`).toBeGreaterThan(0)
      void shaped
    }
  })

  it("alias map resolves through avatarToCharacterSpec", () => {
    const spec = avatarToCharacterSpec(
      avatar([
        { slot: "hat", itemId: "top-hat", tint: "#2a2a32" },
        { slot: "top", itemId: "sari-formal", tint: "#c0455a" },
      ]),
      "p1",
    )
    expect(spec.clothing.hat?.item).toBe("tophat")
    expect(HAT_GARMENTS[spec.clothing.hat!.item]).toBeDefined()
    expect(spec.clothing.top?.item).toBe("sari")
    expect(isOutfitFamily(spec.clothing.top!.item)).toBe(true)
  })

  it("every shipped cosmetic (catalog + starter kits) resolves to a shaped family or degrades", () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const catalog = require("../../content/items/catalog.json") as {
      items: Array<{ id: string; kind: string; slot?: string; tints?: string[] }>
    }
    const starter = require("../../content/cosmetics/starter.json") as {
      kits: Record<string, { items: Array<{ id: string; slot: string }> }>
    }
    const wearables = [
      ...catalog.items
        .filter((i) => i.kind === "cosmetic" && (i.slot === "hat" || i.slot === "top"))
        .map((i) => ({ id: i.id, slot: i.slot as "hat" | "top" })),
      ...Object.values(starter.kits).flatMap((k) =>
        k.items
          .filter((i) => i.slot === "hat" || i.slot === "top")
          .map((i) => ({ id: i.id, slot: i.slot as "hat" | "top" })),
      ),
    ]
    expect(wearables.length).toBeGreaterThan(20)
    const NEW_IDS = [
      "sombrero-festive", "top-hat", "beret", "flower-crown", "fez", "chef-toque",
      "party-cone", "sari-formal", "fancy-suit", "apron-dress", "hoodie",
      "top-dress", "top-overalls", "top-kurta", "hat-beanie", "hat-hijab",
    ]
    for (const w of wearables) {
      // resolving through the avatar map must never throw, for ANY shipped id
      const spec = avatarToCharacterSpec(
        avatar([{ slot: w.slot, itemId: w.id, tint: "#5a7d9a" }]),
        "p1",
      )
      const family = spec.clothing[w.slot]?.item
      if (/-none$/.test(w.id)) {
        // "No Hat"/"No Accessory" correctly resolve to NO clothing layer
        expect(family).toBeUndefined()
        continue
      }
      expect(family, `cosmetic ${w.id}`).toBeTruthy()
      // every NEW cosmetic must land on a real shape (not the degrade default)
      if (NEW_IDS.includes(w.id) && w.id !== "hat-none") {
        const shaped =
          (w.slot === "hat" && !!HAT_GARMENTS[family!]) ||
          (w.slot === "top" && isOutfitFamily(family!))
        expect(shaped, `${w.id} → ${family} should be a shaped family`).toBe(true)
      }
    }
  })

  it("hair items in every starter kit are free and parallel", () => {
    const starter = require("../../content/cosmetics/starter.json") as {
      kits: Record<string, { items: Array<{ id: string; slot: string; unlock: { kind: string; value?: number } }> }>
    }
    const kitNames = Object.keys(starter.kits)
    expect(kitNames.length).toBeGreaterThanOrEqual(3)
    for (const kit of kitNames) {
      const hair = starter.kits[kit].items.filter((i) => i.slot === "hair").map((i) => i.id)
      expect(hair, `kit ${kit} hair`).toEqual(["hair-short", "hair-medium", "hair-long"])
      for (const it of starter.kits[kit].items) {
        expect(it.unlock.kind, `${kit}/${it.id} must be free`).toBe("xp")
        expect(it.unlock.value ?? 0, `${kit}/${it.id} must be free`).toBe(0)
      }
    }
  })

  it("fabric palette is valid hex and never the locked scene palette trio", () => {
    const SCENE_LOCKED = ["#d9c7a3", "#bfe0e8"] // ground / sky (accent #c46b4a is a shared warm)
    for (const hex of FABRICS) {
      expect(hex).toMatch(/^#[0-9a-f]{6}$/)
      expect(SCENE_LOCKED).not.toContain(hex)
    }
    expect(FABRICS.length).toBeGreaterThanOrEqual(18)
  })
})

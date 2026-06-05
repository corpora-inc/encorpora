import type { Scene } from "@babylonjs/core/scene"
import { createGroundedCutout, type GroundedCutout } from "../render/cutout"
import { create3DFigure } from "./figure3d"
import type { CharacterSpec } from "./characterSpec"
import { CHAR_TEX } from "./characterArt"

/**
 * figure.ts — the CHARACTER LOOK SEAM.
 *
 * One factory the player controller, the crowd, and remote avatars call to get a
 * grounded, animatable character. It chooses the LOOK behind the GroundedCutout
 * interface so callers never change:
 *
 *   • "bubble3d" (DEFAULT) → `create3DFigure` — a real 3D rounded "bubble person"
 *     (head sphere + body capsule + arms/legs) lit by the scene, with a
 *     billboarded face card painted by the same animator. Genuine volume from
 *     every camera angle.
 *   • "cutout" (FALLBACK)  → the legacy flat paper-billboard `createGroundedCutout`.
 *
 * The look is selectable for QA / rollback via `window.__wpCharacterLook` (set
 * before the first character is built) or the `?look=cutout` URL flag; otherwise
 * 3D is the shipping default.
 */

export type CharacterLook = "bubble3d" | "cutout"

export interface CharacterFigureOptions {
  shadowRadius?: number
  shadowAlpha?: number
  pickTag?: string
  /** keep the (face) texture mutable for animator redraws. default true. */
  animatable?: boolean
}

/** Resolve the active look once, cheaply. 3D is the default. */
function activeLook(): CharacterLook {
  if (typeof window !== "undefined") {
    const forced = (window as unknown as { __wpCharacterLook?: CharacterLook }).__wpCharacterLook
    if (forced === "cutout" || forced === "bubble3d") return forced
    try {
      const q = new URLSearchParams(window.location.search).get("look")
      if (q === "cutout") return "cutout"
      if (q === "3d" || q === "bubble3d") return "bubble3d"
    } catch {
      /* no location (SSR/test) — fall through to default */
    }
  }
  return "bubble3d"
}

/**
 * Build a character figure (player or NPC) for `spec`. The returned handle is the
 * exact GroundedCutout contract the animator + controller + crowd already use.
 */
export function createCharacterFigure(
  scene: Scene,
  spec: CharacterSpec,
  opts: CharacterFigureOptions = {},
): GroundedCutout {
  if (activeLook() === "cutout") {
    return createGroundedCutout(scene, {
      w: CHAR_TEX.w,
      h: CHAR_TEX.h,
      draw: () => {}, // the animator paints the body texture
      shadowRadius: opts.shadowRadius,
      shadowAlpha: opts.shadowAlpha,
      pickTag: opts.pickTag,
      animatable: opts.animatable,
    })
  }
  return create3DFigure(scene, spec, {
    shadowRadius: opts.shadowRadius,
    shadowAlpha: opts.shadowAlpha,
    pickTag: opts.pickTag,
    animatable: opts.animatable,
  })
}

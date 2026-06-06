/**
 * appIcons — the BEAUTIFUL home-screen app icons (PHONE_DESIGN.md §5.2). Each is a
 * filled, two-tone SQUIRCLE tile with its OWN gradient wash, a soft top specular,
 * a 1px inner hairline, and a crisp white-knockout glyph — the visual language of a
 * real iOS home screen, NOT a thin line glyph on near-white paper (the old look).
 *
 * Each icon is one self-contained inline `<svg>` string (crisps at any DPR, RTL-safe,
 * theme-free). The shell paints it into the `.wp-phone-app-icon` tile; because the
 * SVG carries its own rounded background, the tile itself goes transparent (the CSS
 * drops its paper fill when it contains one of these). Per-app palettes are warm +
 * cohesive with the paper world — jewel tones, not candy (§5.2 table).
 *
 * The Music tile is special: it carries the CORPÁN BRAND MARK on a terracotta wash
 * (the signature app), built by `corpanMarkTile()` so it stays the one place the
 * real logo appears in the grid.
 */

import { CORPAN_MARK_DATA_URI } from "../../assets/corpanMark"

/** A per-app gradient stop pair (top → bottom of the squircle). */
interface TilePalette {
  from: string
  to: string
}

export const APP_TILE_PALETTES = {
  map: { from: "#7fae8c", to: "#4f8f86" }, // sage → teal
  things: { from: "#caa15a", to: "#a9762e" }, // tan → ochre
  quest: { from: "#d98a63", to: "#bf5a36" }, // terracotta → rust (the accent family)
  badges: { from: "#d8b24a", to: "#9c7a2a" }, // gold → bronze
  music: { from: "#d98a63", to: "#c46b4a" }, // brand terracotta (carries the mark)
} as const satisfies Record<string, TilePalette>

/** A unique gradient id per build call so multiple tiles don't collide in the DOM. */
let gradSeq = 0

/**
 * Build a filled squircle icon SVG: a rounded-square gradient background + a crisp
 * white glyph centered on top. `glyphPath` is drawn at white with round joins; the
 * squircle uses a generous corner radius (the iOS "continuous" feel, approximated).
 */
function squircleIcon(pal: TilePalette, glyphInner: string): string {
  const id = `wpAppGrad${gradSeq++}`
  return (
    `<svg viewBox="0 0 56 56" class="wp-phone-app-svg" aria-hidden="true">` +
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${pal.from}"/>` +
    `<stop offset="1" stop-color="${pal.to}"/></linearGradient></defs>` +
    // squircle background (rounded rect; r≈22 of 56 reads as a continuous-corner tile)
    `<rect x="0" y="0" width="56" height="56" rx="16" fill="url(#${id})"/>` +
    // top specular: a soft white sheen on the upper third
    `<rect x="0" y="0" width="56" height="56" rx="16" fill="url(#${id})"/>` +
    `<path d="M0 16C0 7 7 0 16 0h24c9 0 16 7 16 16v6C44 16 12 16 0 22z" fill="#fff" opacity="0.14"/>` +
    // inner hairline for depth
    `<rect x="0.6" y="0.6" width="54.8" height="54.8" rx="15.4" fill="none" ` +
    `stroke="#000" stroke-opacity="0.06"/>` +
    // the white-knockout glyph (each app supplies its own paths, centered ~28,28)
    `<g fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" ` +
    `stroke-linejoin="round">${glyphInner}</g></svg>`
  )
}

/* Per-app white glyphs (drawn in a 56×56 box, ~22px tall, centered). */
const GLYPH = {
  // folded map
  map:
    '<path d="M21 16 13 19v21l8-3 14 3 8-3V16l-8 3-14-3z"/>' +
    '<path d="M21 16v21"/><path d="M35 19v21"/>',
  // traveler's satchel
  things:
    '<path d="M21 19v-2a7 7 0 0 1 14 0v2"/>' +
    '<rect x="13" y="19" width="30" height="22" rx="5"/>' +
    '<path d="M13 28h30"/>',
  // waypoint pin
  quest: '<path d="M28 43s11-8.5 11-17a11 11 0 0 0-22 0c0 8.5 11 17 11 17z"/><circle cx="28" cy="26" r="4.4"/>',
  // rosette / badge
  badges:
    '<circle cx="28" cy="23" r="9"/>' +
    '<path d="M22 31 19 44l9-4.5L37 44l-3-13"/>',
} as const

/** The four section apps as filled squircle SVGs (Music handled separately). */
export const APP_ICON_SVGS = {
  map: squircleIcon(APP_TILE_PALETTES.map, GLYPH.map),
  things: squircleIcon(APP_TILE_PALETTES.things, GLYPH.things),
  quest: squircleIcon(APP_TILE_PALETTES.quest, GLYPH.quest),
  badges: squircleIcon(APP_TILE_PALETTES.badges, GLYPH.badges),
} as const

/**
 * The Music tile — the brand mark on a terracotta squircle. The mark sits on the
 * gradient with the same specular/hairline treatment so it reads as one of the
 * jewel tiles, not a pasted logo.
 */
export function corpanMarkTile(): string {
  const pal = APP_TILE_PALETTES.music
  const id = `wpAppGrad${gradSeq++}`
  return (
    `<svg viewBox="0 0 56 56" class="wp-phone-app-svg" aria-hidden="true">` +
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${pal.from}"/>` +
    `<stop offset="1" stop-color="${pal.to}"/></linearGradient>` +
    `<clipPath id="${id}clip"><rect x="0" y="0" width="56" height="56" rx="16"/></clipPath></defs>` +
    `<rect x="0" y="0" width="56" height="56" rx="16" fill="url(#${id})"/>` +
    `<path d="M0 16C0 7 7 0 16 0h24c9 0 16 7 16 16v6C44 16 12 16 0 22z" fill="#fff" opacity="0.14"/>` +
    `<image href="${CORPAN_MARK_DATA_URI}" x="13" y="13" width="30" height="30" ` +
    `clip-path="url(#${id}clip)" preserveAspectRatio="xMidYMid meet"/>` +
    `<rect x="0.6" y="0.6" width="54.8" height="54.8" rx="15.4" fill="none" ` +
    `stroke="#000" stroke-opacity="0.06"/></svg>`
  )
}

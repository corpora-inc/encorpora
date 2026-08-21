// Visual tokens. Kept in TypeScript because the canvas views need the raw color
// values (CSS variables are awkward to read from a 2D context). The chrome
// mirrors these as CSS custom properties in styles.css, per skin.
//
// The skins reuse palettes already committed elsewhere in the monorepo so
// Kronopán sits inside the same visual family as the other packs:
//   Astral   -> stargate-reader (near-black, cyan)
//   Tropical -> juice-squeeze (light, juice red, fruit colors)
//   Earthy   -> earthgate-reader (cream, brown, orange)
//
// Skinning is purely cosmetic. Layout, timing, and readability are unchanged:
// the three group colors stay clearly distinct, text stays high-contrast (the
// isLight flag keeps bar digits dark on the light skins), and the sparkle
// starfield sits behind the pattern, never over it.

export type Theme = {
  ground: string
  panel: string
  panelEdge: string
  text: string
  textDim: string
  accent: string
  // Group fills by length: twos, threes, and four-or-more, always distinct.
  two: string
  three: string
  many: string
  hairline: string
  playhead: string
  sparkle: boolean
  isLight: boolean
}

export type SkinId = "astral" | "tropical" | "earthy"

export const SKINS: { id: SkinId; name: string; theme: Theme }[] = [
  {
    // stargate-reader dark/cyan.
    id: "astral",
    name: "Astral",
    theme: {
      ground: "#020409",
      panel: "#0f192d",
      panelEdge: "rgba(127, 214, 255, 0.16)",
      text: "#c0d0e8",
      textDim: "#6080a0",
      accent: "#7fd6ff",
      two: "#7fd6ff",
      three: "#ff6060",
      many: "#4cff9f",
      hairline: "rgba(127, 214, 255, 0.16)",
      playhead: "#7fd6ff",
      sparkle: true,
      isLight: false,
    },
  },
  {
    // juice-squeeze light, juice red, fruit category colors.
    id: "tropical",
    name: "Tropical",
    theme: {
      ground: "#f6f7fb",
      panel: "#ffffff",
      panelEdge: "rgba(58, 36, 16, 0.16)",
      text: "#3a2410",
      textDim: "#6b4423",
      accent: "#c0392b",
      two: "#8bc34a",
      three: "#ff9800",
      many: "#8e24aa",
      hairline: "rgba(58, 36, 16, 0.16)",
      playhead: "#c0392b",
      sparkle: false,
      isLight: true,
    },
  },
  {
    // earthgate-reader cream, brown, orange.
    id: "earthy",
    name: "Earthy",
    theme: {
      ground: "#f5f0e8",
      panel: "#ebe1d2",
      panelEdge: "rgba(107, 76, 42, 0.2)",
      text: "#3d2b1f",
      textDim: "#8b7355",
      accent: "#8b6914",
      two: "#4a8c3f",
      three: "#8b4513",
      many: "#6b4c2a",
      hairline: "rgba(61, 43, 31, 0.18)",
      playhead: "#8b6914",
      sparkle: false,
      isLight: true,
    },
  },
]

export const DEFAULT_SKIN: SkinId = "astral"

// The live theme the canvas reads. setSkin swaps its fields in place so the
// views, which read THEME every frame, pick up a skin change immediately without
// being re-created.
const initialTheme = SKINS.find((s) => s.id === DEFAULT_SKIN) ?? SKINS[0]
export const THEME: Theme = { ...initialTheme.theme }

export const setSkin = (id: SkinId): void => {
  const skin = SKINS.find((s) => s.id === id) ?? SKINS[0]
  Object.assign(THEME, skin.theme)
}

export type ColorRole = "two" | "three" | "many"

export const roleColor = (role: ColorRole): string =>
  role === "two" ? THEME.two : role === "three" ? THEME.three : THEME.many

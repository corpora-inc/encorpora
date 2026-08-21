// Visual tokens. Kept in TypeScript because the canvas views need the raw color
// values (CSS variables are awkward to read from a 2D context). The chrome
// mirrors these as CSS custom properties in styles.css, per skin.
//
// Skins keep the same structure so nothing about layout, playability, or
// readability changes: the three group colors stay clearly distinct and text
// stays high-contrast. The two colorful skins add a faint starfield behind the
// pattern (sparkle), never over it.

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
}

export type SkinId = "neon" | "aurora" | "cosmic"

export const SKINS: { id: SkinId; name: string; theme: Theme }[] = [
  {
    id: "neon",
    name: "Neon",
    theme: {
      ground: "#0b0b0d",
      panel: "#16161a",
      panelEdge: "#26262c",
      text: "#f3ead6",
      textDim: "#a49c88",
      accent: "#ff7a1a",
      two: "#efe4c8",
      three: "#ff7a1a",
      many: "#6fb3ff",
      hairline: "rgba(243, 234, 214, 0.16)",
      playhead: "#ff7a1a",
      sparkle: false,
    },
  },
  {
    id: "aurora",
    name: "Aurora",
    theme: {
      ground: "#0a0b1e",
      panel: "#191b3d",
      panelEdge: "#2e3168",
      text: "#eae6ff",
      textDim: "#9d9ad0",
      accent: "#ff5db1",
      two: "#7ee8fa",
      three: "#ff5db1",
      many: "#7cf7c4",
      hairline: "rgba(234, 230, 255, 0.14)",
      playhead: "#ff5db1",
      sparkle: true,
    },
  },
  {
    id: "cosmic",
    name: "Cosmic",
    theme: {
      ground: "#060714",
      panel: "#10142e",
      panelEdge: "#232a55",
      text: "#edf6ff",
      textDim: "#93a0c8",
      accent: "#3ab4ff",
      two: "#ffd166",
      three: "#ef476f",
      many: "#06d6a0",
      hairline: "rgba(237, 246, 255, 0.14)",
      playhead: "#3ab4ff",
      sparkle: true,
    },
  },
]

// The live theme the canvas reads. setSkin swaps its fields in place so the
// views, which read THEME every frame, pick up a skin change immediately without
// being re-created.
export const THEME: Theme = { ...SKINS[0].theme }

export const setSkin = (id: SkinId): void => {
  const skin = SKINS.find((s) => s.id === id) ?? SKINS[0]
  Object.assign(THEME, skin.theme)
}

export type ColorRole = "two" | "three" | "many"

export const roleColor = (role: ColorRole): string =>
  role === "two" ? THEME.two : role === "three" ? THEME.three : THEME.many

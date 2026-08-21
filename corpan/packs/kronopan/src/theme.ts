// Visual tokens. Kept in TypeScript because the canvas view needs the raw color
// values (CSS variables are awkward to read from a 2D context). The same values
// are mirrored as CSS custom properties in styles.css for the DOM chrome.
//
// House palette: near-black ground, orange accent, cream text. Assume a viewer
// five metres away, so contrast is high and nothing relies on hairline greys.

export const THEME = {
  ground: "#0b0b0d",
  panel: "#16161a",
  panelEdge: "#26262c",
  text: "#f3ead6", // cream
  textDim: "#a49c88",
  accent: "#ff7a1a", // orange

  // Group fills, colored by group length. Twos are cream, threes are orange, and
  // any group of four or more takes a third, cooler hue so it reads as "other".
  two: "#efe4c8",
  three: "#ff7a1a",
  many: "#6fb3ff",

  hairline: "rgba(243, 234, 214, 0.16)",
  playhead: "#ff7a1a",
} as const

export type ColorRole = "two" | "three" | "many"

export const roleColor = (role: ColorRole): string =>
  role === "two" ? THEME.two : role === "three" ? THEME.three : THEME.many

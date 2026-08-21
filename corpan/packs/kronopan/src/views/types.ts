// Shared view-layer types and small helpers.

// How a group is labeled: its length as a number, or the short-long letter (a 2
// is short, a 3 is long). Dot-based drawings are numberless and ignore this.
export type LabelMode = "number" | "shortlong"

// Which notation a view draws with. Both read the same geometry.
export type NotationMode = "bars" | "dots"

// Which view is on screen. Linear is the default; ring and spiral are the cyclic
// views.
export type ViewMode = "linear" | "ring" | "spiral"

export const barLabel = (length: number, mode: LabelMode): string => {
  if (mode === "number") return String(length)
  if (length === 2) return "S"
  if (length === 3) return "L"
  return String(length)
}

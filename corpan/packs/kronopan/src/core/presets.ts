// Starter cycles.
//
// These are a small, deliberately conservative seed set so the core layer has
// something concrete to render and test against. Where a group shape has a
// widely used name we keep it; otherwise the name is just the additive figure
// (for example "3+2+2"), so nothing here asserts a tradition it should not.
// This list is meant to be curated and expanded by the pack author in the
// preset-library phase, not treated as an authoritative catalogue.

import type { Cycle } from "./cycle"

export const PRESETS: Cycle[] = [
  { id: "three-two-two", name: "3+2+2", groups: [3, 2, 2], unit: 8 },
  { id: "two-two-three", name: "2+2+3", groups: [2, 2, 3], unit: 8 },
  { id: "two-three", name: "2+3", groups: [2, 3], unit: 8 },
  { id: "three-three-two", name: "3+3+2", groups: [3, 3, 2], unit: 8 },
  { id: "kopanitsa", name: "Kopanitsa", groups: [2, 2, 3, 2, 2], unit: 16 },
]

export const presetById = (id: string): Cycle | undefined =>
  PRESETS.find((c) => c.id === id)

/**
 * Fruit definitions + level mapping for Juice Squeeze (Fire rebuild).
 *
 * Ported VERBATIM from the shipped pack's store/gameState.ts. Pure data + pure
 * helpers — no rendering, no Babylon. Used by the store for bottle color
 * cycling and by the UI for visuals.
 */

// Fruit definition type
export type FruitDef = {
  fruit: string
  name: string
  primary: string
  gradient: [string, string, string]
  level: "A0" | "A1" | "A2" | "B1" | "B2" | "C1"
}

// Tropical fruit palette - 16 unique fruits (A0-B1 levels)
// Each fruit has a unique emoji to avoid confusion
export const TROPICAL_FRUITS: Record<string, FruitDef> = {
  // A0 - Common citrus/orchard (beginner, familiar fruits)
  orange: { fruit: "🍊", name: "Orange", primary: "#FF9800", gradient: ["#FFB84D", "#FF9800", "#E65100"], level: "A0" },
  lemon: { fruit: "🍋", name: "Lemon", primary: "#FFF176", gradient: ["#FFFF8D", "#FFF176", "#F9A825"], level: "A0" },
  apple: { fruit: "🍎", name: "Apple", primary: "#E53935", gradient: ["#EF5350", "#E53935", "#C62828"], level: "A0" },
  greenApple: { fruit: "🍏", name: "Green Apple", primary: "#8BC34A", gradient: ["#AED581", "#8BC34A", "#689F38"], level: "A0" },

  // A1 - Tropical basics (slightly more exotic but well-known)
  mango: { fruit: "🥭", name: "Mango", primary: "#FFCC02", gradient: ["#FFE066", "#FFCC02", "#E6B800"], level: "A1" },
  peach: { fruit: "🍑", name: "Peach", primary: "#FFAB91", gradient: ["#FFCCBC", "#FFAB91", "#FF8A65"], level: "A1" },
  pear: { fruit: "🍐", name: "Pear", primary: "#C5E1A5", gradient: ["#DCEDC8", "#C5E1A5", "#9CCC65"], level: "A1" },
  melon: { fruit: "🍈", name: "Melon", primary: "#A5D6A7", gradient: ["#C8E6C9", "#A5D6A7", "#81C784"], level: "A1" },

  // A2 - Tropical fruits (more vibrant, tropical)
  pineapple: { fruit: "🍍", name: "Pineapple", primary: "#FFD700", gradient: ["#FFEB3B", "#FFD700", "#FFC107"], level: "A2" },
  kiwi: { fruit: "🥝", name: "Kiwi", primary: "#7CB342", gradient: ["#9CCC65", "#7CB342", "#558B2F"], level: "A2" },
  grape: { fruit: "🍇", name: "Grape", primary: "#8E24AA", gradient: ["#BA68C8", "#8E24AA", "#6A1B9A"], level: "A2" },
  blueberry: { fruit: "🫐", name: "Blueberry", primary: "#5C6BC0", gradient: ["#7986CB", "#5C6BC0", "#3949AB"], level: "A2" },

  // B1 - Sweet berries & tropical (bold colors)
  strawberry: { fruit: "🍓", name: "Strawberry", primary: "#E91E63", gradient: ["#F06292", "#E91E63", "#C2185B"], level: "B1" },
  cherry: { fruit: "🍒", name: "Cherry", primary: "#D32F2F", gradient: ["#EF5350", "#D32F2F", "#B71C1C"], level: "B1" },
  watermelon: { fruit: "🍉", name: "Watermelon", primary: "#FF6B6B", gradient: ["#FF8A8A", "#FF6B6B", "#E53935"], level: "B1" },
  coconut: { fruit: "🥥", name: "Coconut", primary: "#BCAAA4", gradient: ["#D7CCC8", "#BCAAA4", "#8D6E63"], level: "B1" },

} as const

// Get fruits by level
export const getFruitsByLevel = (level: "A0" | "A1" | "A2" | "B1" | "B2" | "C1"): FruitDef[] => {
  return Object.values(TROPICAL_FRUITS).filter(f => f.level === level)
}

// Get all fruits (for "all levels" mode)
export const getAllFruits = (): FruitDef[] => {
  return Object.values(TROPICAL_FRUITS)
}

// Get fruit by cycling through available fruits based on index
export const getFruitByIndex = (level: "A0" | "A1" | "A2" | "B1" | "B2" | "C1" | "all", index: number): FruitDef => {
  const fruits = level === "all" ? getAllFruits() : getFruitsByLevel(level)
  return fruits[index % fruits.length]
}

// Level-based fruit colors - uses first fruit of each level for backward compatibility
// Note: B2/C1 reuse fruits from lower levels since we removed duplicate emojis
export const LEVEL_FRUIT_COLORS = {
  A0: TROPICAL_FRUITS.orange,
  A1: TROPICAL_FRUITS.mango,
  A2: TROPICAL_FRUITS.pineapple,
  B1: TROPICAL_FRUITS.strawberry,
  B2: TROPICAL_FRUITS.kiwi,        // Green (distinct color)
  C1: TROPICAL_FRUITS.grape,       // Purple (distinct color)
} as const

// Bottles required per level (based on difficulty progression)
export const BOTTLES_PER_LEVEL = {
  A0: 3,
  A1: 5,
  A2: 7,
  B1: 10,
  B2: 12,
  C1: 15,
} as const

export type CEFRLevel = keyof typeof LEVEL_FRUIT_COLORS

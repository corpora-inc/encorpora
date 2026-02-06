/**
 * Fruit color definitions for Juice Squeeze 2
 * Migrated from v1's store/gameState.ts
 */

export type FruitDef = {
  fruit: string
  name: string
  primary: string
  gradient: [string, string, string]
  level: "A0" | "A1" | "A2" | "B1" | "B2" | "C1"
}

export const TROPICAL_FRUITS: Record<string, FruitDef> = {
  // A0 - Common citrus/orchard
  orange: { fruit: "🍊", name: "Orange", primary: "#FF9800", gradient: ["#FFB84D", "#FF9800", "#E65100"], level: "A0" },
  lemon: { fruit: "🍋", name: "Lemon", primary: "#FFF176", gradient: ["#FFFF8D", "#FFF176", "#F9A825"], level: "A0" },
  apple: { fruit: "🍎", name: "Apple", primary: "#E53935", gradient: ["#EF5350", "#E53935", "#C62828"], level: "A0" },
  greenApple: { fruit: "🍏", name: "Green Apple", primary: "#8BC34A", gradient: ["#AED581", "#8BC34A", "#689F38"], level: "A0" },

  // A1 - Tropical basics
  mango: { fruit: "🥭", name: "Mango", primary: "#FFCC02", gradient: ["#FFE066", "#FFCC02", "#E6B800"], level: "A1" },
  peach: { fruit: "🍑", name: "Peach", primary: "#FFAB91", gradient: ["#FFCCBC", "#FFAB91", "#FF8A65"], level: "A1" },
  pear: { fruit: "🍐", name: "Pear", primary: "#C5E1A5", gradient: ["#DCEDC8", "#C5E1A5", "#9CCC65"], level: "A1" },
  melon: { fruit: "🍈", name: "Melon", primary: "#A5D6A7", gradient: ["#C8E6C9", "#A5D6A7", "#81C784"], level: "A1" },

  // A2 - Tropical fruits
  pineapple: { fruit: "🍍", name: "Pineapple", primary: "#FFD700", gradient: ["#FFEB3B", "#FFD700", "#FFC107"], level: "A2" },
  kiwi: { fruit: "🥝", name: "Kiwi", primary: "#7CB342", gradient: ["#9CCC65", "#7CB342", "#558B2F"], level: "A2" },
  grape: { fruit: "🍇", name: "Grape", primary: "#8E24AA", gradient: ["#BA68C8", "#8E24AA", "#6A1B9A"], level: "A2" },
  blueberry: { fruit: "🫐", name: "Blueberry", primary: "#5C6BC0", gradient: ["#7986CB", "#5C6BC0", "#3949AB"], level: "A2" },

  // B1 - Sweet berries & tropical
  strawberry: { fruit: "🍓", name: "Strawberry", primary: "#E91E63", gradient: ["#F06292", "#E91E63", "#C2185B"], level: "B1" },
  cherry: { fruit: "🍒", name: "Cherry", primary: "#D32F2F", gradient: ["#EF5350", "#D32F2F", "#B71C1C"], level: "B1" },
  watermelon: { fruit: "🍉", name: "Watermelon", primary: "#FF6B6B", gradient: ["#FF8A8A", "#FF6B6B", "#E53935"], level: "B1" },
  coconut: { fruit: "🥥", name: "Coconut", primary: "#BCAAA4", gradient: ["#D7CCC8", "#BCAAA4", "#8D6E63"], level: "B1" },
} as const

export const LEVEL_FRUIT_COLORS = {
  A0: TROPICAL_FRUITS.orange,
  A1: TROPICAL_FRUITS.mango,
  A2: TROPICAL_FRUITS.pineapple,
  B1: TROPICAL_FRUITS.strawberry,
  B2: TROPICAL_FRUITS.kiwi,
  C1: TROPICAL_FRUITS.grape,
} as const

export type CEFRLevel = keyof typeof LEVEL_FRUIT_COLORS

export const BOTTLES_PER_LEVEL = {
  A0: 3,
  A1: 5,
  A2: 7,
  B1: 10,
  B2: 12,
  C1: 15,
} as const

export const getFruitsByLevel = (level: CEFRLevel): FruitDef[] => {
  return Object.values(TROPICAL_FRUITS).filter(f => f.level === level)
}

export const getAllFruits = (): FruitDef[] => {
  return Object.values(TROPICAL_FRUITS)
}

export const getFruitByIndex = (level: CEFRLevel | "all", index: number): FruitDef => {
  const fruits = level === "all" ? getAllFruits() : getFruitsByLevel(level)
  return fruits[index % fruits.length]
}

/**
 * Convert hex color to rgb object
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (result) {
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    }
  }
  return { r: 255, g: 152, b: 0 } // Default orange
}

/**
 * Darken/lighten hex colors
 */
export const shadeColor = (color: string, percent: number): string => {
  const num = parseInt(color.replace("#", ""), 16)
  const amt = Math.round(2.55 * percent)
  const R = (num >> 16) + amt
  const G = (num >> 8 & 0x00FF) + amt
  const B = (num & 0x0000FF) + amt
  return "#" + (
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  ).toString(16).slice(1)
}

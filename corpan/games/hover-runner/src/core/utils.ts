import { Color3, PBRMaterial, Scene } from "@babylonjs/core"
import { tuningStore } from "../tuningStore"
import { ROAD, TIMING, SPEED, TEXT } from "./constants"

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

export const lerp = (start: number, end: number, t: number) =>
  start + (end - start) * t

export const colorToCss = (color: Color3, alpha = 1) =>
  `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`

export const scaleColor = (color: Color3, factor: number) =>
  new Color3(
    clamp(color.r * factor, 0, 1),
    clamp(color.g * factor, 0, 1),
    clamp(color.b * factor, 0, 1)
  )

/**
 * Calculate score points based on phrase length
 * CJK languages (Chinese, Japanese, Korean): character count
 * Other languages: word count
 */
export const getPhraseScore = (text: string, lang: string): number => {
  const isCJK = /^(zh|ja|ko)/i.test(lang)

  if (isCJK) {
    return text.replace(/[\s\p{P}]/gu, "").length
  } else {
    const words = text.trim().split(/\s+/)
    return words.filter((w) => w.length > 0).length
  }
}

/**
 * Calculate dynamic duration based on phrase length
 * Returns milliseconds = baseMs + (units * msPerUnit)
 * For CJK: units = characters, msPerUnit = 300ms (more time for comprehension)
 * For other languages: units = words, msPerUnit = 200ms
 */
export const getPhraseDuration = (text: string, lang: string, baseMs = 800): number => {
  const isCJK = /^(zh|ja|ko)/i.test(lang)
  const units = getPhraseScore(text, lang)

  if (isCJK) {
    return baseMs + units * 300
  } else {
    return baseMs + units * 200
  }
}

export const createEmissivePbr = (
  name: string,
  scene: Scene,
  albedo: Color3,
  emissive: Color3,
  metallic = 0.2,
  roughness = 0.6
) => {
  const material = new PBRMaterial(name, scene)
  material.albedoColor = albedo
  material.emissiveColor = emissive
  material.metallic = metallic
  material.roughness = roughness
  return material
}

export const tuneLogoMaterial = (material: PBRMaterial, sheenBoost = 1.15) => {
  material.clearCoat.isEnabled = true
  material.clearCoat.intensity = 0.9
  material.clearCoat.roughness = 0.08
  material.clearCoat.indexOfRefraction = 1.52
  material.sheen.isEnabled = true
  material.sheen.intensity = 0.35
  material.sheen.color = scaleColor(material.albedoColor, sheenBoost)
  material.emissiveColor = scaleColor(material.emissiveColor, 1.15)
}

// iOS detection helper
const isIOS = (): boolean => {
  if (typeof navigator === "undefined") return false
  return /iPhone|iPad|iPod|iOS/i.test(navigator.userAgent)
}

export const getSettings = () => {
  const settings = tuningStore.getState().settings
  // Merge user settings with constants for easy access
  return {
    ...settings,
    // Timing constants
    respawnDelay: TIMING.respawnDelay,
    promptLeadMs: TIMING.promptLeadMs,
    introHoldMs: TIMING.introHoldMs,
    introRepeatMs: TIMING.introRepeatMs,
    celebrationMs: TIMING.celebrationMs,
    postCelebrateMs: TIMING.postCelebrateMs,
    speakRepeatMs: isIOS() ? TIMING.speakRepeatMsIOS : TIMING.speakRepeatMs,
    // Text constants
    textOverflowFactor: TEXT.overflowFactor,
  }
}

export const getPhraseSpeed = () => {
  const { basePhraseSpeed } = tuningStore.getState().settings
  const { speedDelta } = tuningStore.getState().runtime
  return clamp(basePhraseSpeed + speedDelta, SPEED.min, SPEED.max)
}

export const pickRandom = <T,>(items: T[]) => {
  if (!items.length) {
    return null
  }
  const idx = Math.floor(Math.random() * items.length)
  return items[idx] ?? null
}

// Estimate speech duration based on text length
// Average speaking rate: ~150 words per minute = 2.5 words per second
// Average word length: ~5 characters, so ~12.5 chars per second = 80ms per char
export const estimateSpeechDuration = (text: string): number => {
  const chars = text.length
  const baseMs = 500 // Minimum time for very short phrases
  const msPerChar = 80 // Milliseconds per character
  return Math.max(baseMs, chars * msPerChar)
}

export const computeCurve = (curveTime: number, z: number) => {
  const blend = Math.pow(z / ROAD.length, 1.35)
  return Math.sin(curveTime + z * 0.08) * ROAD.curveAmount * blend
}

export const rowToY = (row: number, GRID: { topY: number; midY: number; bottomY: number }) => {
  if (row <= 0) {
    return GRID.topY
  }
  if (row === 1) {
    return GRID.midY
  }
  return GRID.bottomY
}

export const normalizeLang = (lang: string) => lang.trim().toLowerCase()

export const isNoSpaceLanguage = (lang: string) => {
  const base = normalizeLang(lang).split("-")[0]
  return ["zh", "ja", "ko", "th", "lo", "km", "my"].includes(base)
}

export const pickByLang = (map: Record<string, string>, lang: string) => {
  const desired = normalizeLang(lang)
  if (map[desired]) {
    return map[desired]
  }
  const base = desired.split("-")[0]
  if (map[base]) {
    return map[base]
  }
  const fallback = Object.entries(map).find(
    ([code]) => code.startsWith(base) || base.startsWith(code)
  )
  return fallback?.[1]
}

export const shuffle = <T,>(items: T[]) => {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = items[i]
    items[i] = items[j]
    items[j] = temp
  }
  return items
}

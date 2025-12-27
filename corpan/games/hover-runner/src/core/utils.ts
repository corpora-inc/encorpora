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
  const dynamicParams = getDynamicGameParams()

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
    // Dynamic gameplay parameters (calculated from difficulty)
    dynamicSpeed: dynamicParams.speed,
    dynamicCorrectProb: dynamicParams.correctProbability,
    dynamicDistractors: dynamicParams.distractorCount,
    dynamicMaxPhrases: dynamicParams.maxPhrases,
    dynamicMaxMisses: dynamicParams.maxMisses,
  }
}

export const getPhraseSpeed = () => {
  const { autoAdjustDifficulty } = tuningStore.getState().settings

  if (autoAdjustDifficulty) {
    // Use dynamic speed based on difficulty curve
    const dynamicParams = getDynamicGameParams()
    return dynamicParams.speed
  } else {
    // Use baseline speed (no auto-adjustment)
    return tuningStore.getState().settings.baselineSpeed
  }
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

/**
 * Seeded random number generator for reproducible randomness
 */
const seededRandom = (seed: number) => {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

/**
 * Visual progression parameters based on player level (1-20)
 */
export type ProgressionParams = {
  // Electric field
  mainArcCount: number // Number of main lightning arcs
  branchArcCount: number // Number of branch arcs
  electricIntensity: number // Base intensity multiplier (0-1)
  particleMultiplier: number // Particle count multiplier (0-1)

  // Avatar rings and sacred geometries
  ringHeightOffset: number // Vertical offset for rings (0-1)
  ringAlpha: number // Ring opacity (0-1)
  ringCount: number // How many rings to show (0-3)
  ringScale: number // Scale multiplier for rings

  // Sacred geometries (simplified for pooling system)
  sacredGeometries: {
    scale: number
    orbitRadius: number
    orbitSpeed: number
    rotationSpeed: number
    emissiveIntensity: number
  }[]

  // Lighting
  lightIntensity: number // Point light intensity multiplier (0-1)
  lightCount: number // Number of dynamic lights (1-5)
}

export const getProgressionParams = (level: number, netCorrect: number, seed: number): ProgressionParams => {
  // JUICY PROGRESSION - primarily based on immediate performance (netCorrect)
  // Every 2-3 correct answers should show visible change!

  // Use netCorrect as primary driver (0-50 range for rapid early progression)
  const progress = clamp(netCorrect / 50, 0, 3)

  // Seeded random for reproducible progression
  const rng = seededRandom(seed)

  // Sacred geometries progression - add more frequently!
  const geometries: ProgressionParams['sacredGeometries'] = []

  // Ring configuration
  let ringCount = 0
  let ringScale = 0.8

  // START WITH GEOMETRIES IMMEDIATELY - NO WAITING!
  // HIDE RINGS TO SEE GEOMETRIES
  // 0-1 correct: Start with 1 geometry visible - SUPER TIGHT near pyramid top
  if (progress < 0.04) {
    ringCount = 0  // NO RINGS
    ringScale = 0.8
    geometries.push({
      scale: 0.3,
      orbitRadius: 0.25,
      orbitSpeed: (rng() - 0.5) * 1.2, // Random direction
      rotationSpeed: 0.8,
      emissiveIntensity: 1.2
    })
  }
  // 2-4 correct: 2 geometries
  else if (progress < 0.1) {
    ringCount = 0  // NO RINGS
    ringScale = 0.9

    for (let i = 0; i < 2; i++) {
      geometries.push({
        scale: 0.28,
        orbitRadius: 0.25 + rng() * 0.1,
        orbitSpeed: (rng() - 0.5) * 1.4,
        rotationSpeed: 0.6 + rng() * 0.7,
        emissiveIntensity: 1.2
      })
    }
  }
  // 5-7 correct: 3 geometries
  else if (progress < 0.16) {
    ringCount = 0  // NO RINGS
    ringScale = 1.0

    for (let i = 0; i < 3; i++) {
      geometries.push({
        scale: 0.27,
        orbitRadius: 0.25 + rng() * 0.12,
        orbitSpeed: (rng() - 0.5) * 1.6,
        rotationSpeed: 0.6 + rng() * 0.8,
        emissiveIntensity: 1.2
      })
    }
  }
  // 8-12 correct: 4 geometries
  else if (progress < 0.26) {
    ringCount = 0  // NO RINGS
    ringScale = 1.05

    for (let i = 0; i < 4; i++) {
      geometries.push({
        scale: 0.26,
        orbitRadius: 0.25 + rng() * 0.15,
        orbitSpeed: (rng() - 0.5) * 1.8,
        rotationSpeed: 0.5 + rng() * 1.0,
        emissiveIntensity: 1.2 + rng() * 0.4
      })
    }
  }
  // 13-20 correct: 5 geometries
  else if (progress < 0.42) {
    ringCount = 0  // NO RINGS
    ringScale = 1.1

    for (let i = 0; i < 5; i++) {
      geometries.push({
        scale: 0.25,
        orbitRadius: 0.3 + rng() * 0.15,
        orbitSpeed: (rng() - 0.5) * 2.0,
        rotationSpeed: 0.4 + rng() * 1.2,
        emissiveIntensity: 1.3 + rng() * 0.5
      })
    }
  }
  // 21+ correct: MAX 6 geometries with WILD speeds and directions
  else {
    ringCount = 0  // NO RINGS
    ringScale = 1.1

    for (let i = 0; i < 6; i++) {
      geometries.push({
        scale: 0.24 + rng() * 0.1,
        orbitRadius: 0.3 + rng() * 0.2,
        orbitSpeed: (rng() - 0.5) * 2.5,
        rotationSpeed: 0.3 + rng() * 2.0,
        emissiveIntensity: 1.4 + rng() * 0.8
      })
    }
  }

  return {
    // Electric arcs: Grow rapidly with progress
    mainArcCount: Math.max(1, Math.floor(lerp(2, 12, clamp(progress, 0, 1.5)))),
    branchArcCount: Math.max(0, Math.floor(lerp(0, 8, clamp(progress, 0, 1.5)))),

    // Intensity: Start moderate, grow to insane
    electricIntensity: lerp(0.5, 2.0, clamp(progress, 0, 2)),

    // Particles: Grow dramatically
    particleMultiplier: lerp(0.4, 2.5, clamp(progress, 0, 2)),

    // Rings: Move up and scale dramatically
    ringHeightOffset: lerp(0, 1.5, clamp(progress, 0, 2)),
    ringAlpha: lerp(0.4, 1.0, clamp(progress, 0, 1.5)),
    ringCount,
    ringScale,

    // Sacred geometries
    sacredGeometries: geometries,

    // Lighting: Grow to multiple intense lights
    lightIntensity: lerp(0.6, 2.5, clamp(progress, 0, 2)),
    lightCount: Math.min(5, 1 + Math.floor(progress * 3)),
  }
}

/**
 * Calculate difficulty from net correct answers (0-1 scale)
 * Uses a smooth exponential curve:
 * - netCorrect = 0 → difficulty = 0 (easiest)
 * - netCorrect = 150 → difficulty ≈ 0.63 (approaching harder)
 * - Formula: 1 - exp(-netCorrect / 150)
 * This gives a VERY gradual ramp to maintain fun gameplay
 */
export const getDifficulty = (netCorrect: number): number => {
  // Allow negative netCorrect (if player does worse than 50/50)
  // Clamp to reasonable range
  const clamped = clamp(netCorrect, -50, 300)

  // Exponential curve: 1 - e^(-x/150)
  // This reaches ~49% of max at netCorrect=100
  // and ~63% at netCorrect=150
  // Very gradual progression to keep correct answer probability reasonable
  const raw = 1 - Math.exp(-clamped / 150)

  // Clamp to 0-1 and ensure it's never negative
  return clamp(raw, 0, 1)
}

/**
 * Dynamic gameplay parameters based on difficulty curve
 */
export type DynamicGameParams = {
  speed: number // Actual speed to use
  correctProbability: number // Probability of spawning correct answer
  distractorCount: number // Number of incorrect choices
  maxPhrases: number // Max simultaneous phrases
  maxMisses: number // Tolerance for incorrect answers before game over
}

export const getDynamicGameParams = (): DynamicGameParams => {
  const state = tuningStore.getState()
  const settings = state.settings
  const difficulty = getDifficulty(state.stats.netCorrect)

  // If auto-adjust is off, use baseline values
  if (!settings.autoAdjustDifficulty) {
    return {
      speed: settings.baselineSpeed,
      correctProbability: settings.baselineCorrectProb,
      distractorCount: settings.baselineDistractors,
      maxPhrases: settings.baselineMaxPhrases,
      maxMisses: settings.baselineMaxMisses,
    }
  }

  // Interpolate all parameters based on difficulty
  return {
    // Speed: Start at baseline, ramp to max
    speed: lerp(settings.baselineSpeed, settings.maxSpeed, difficulty),

    // Correct probability: Start at baseline (e.g., 0.5), decrease to min (e.g., 0.1)
    // This makes it harder to find the right answer
    correctProbability: lerp(
      settings.baselineCorrectProb,
      settings.minCorrectProb,
      difficulty
    ),

    // Distractors: Start at baseline, increase to max
    distractorCount: Math.floor(
      lerp(settings.baselineDistractors, settings.maxDistractors, difficulty)
    ),

    // Max phrases: Start at baseline (usually 1), increase to max
    maxPhrases: Math.floor(
      lerp(settings.baselineMaxPhrases, settings.maxSimultaneousPhrases, difficulty)
    ),

    // Max misses: Start low (strict), increase as player gets better (more forgiving)
    // This is INVERSE - easier when you're better
    maxMisses: Math.floor(
      lerp(settings.baselineMaxMisses, settings.maxMaxMisses, difficulty)
    ),
  }
}

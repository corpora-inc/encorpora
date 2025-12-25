import { Color3, Color4, Mesh, TransformNode } from "@babylonjs/core"
import type { StackConfig } from "../sdk/types"

export type RoadPalette = {
  road: Color3
  emissive: Color3
  center: Color3
  edge: Color3
}

export type RoadState = {
  mesh: Mesh
  update: (dt: number) => void
  getFarCenterX: () => number
  getTravel: () => number
  getCurveAt: (z: number) => number
  setPalette: (palette: RoadPalette) => void
}

export type HoverVariant = {
  id: string
  name: string
  pivot: TransformNode
  board: Mesh
}

export type PhraseSpec = {
  id: string
  text: string
  romanization?: string
  lang: string
  isCorrect: boolean
}

export type PhraseInstance = {
  spec: PhraseSpec
  mesh: Mesh
  lane: number
  baseWidth: number
  baseHeight: number
  surfaceEffects?: {
    update: (dt: number, intensity: number) => void
    dispose: () => void
  }
}

export type RoundState = {
  id: string
  promptLang: string
  answerLang: string
  prompt: string
  promptRomanization?: string
  answer: string
  answerRomanization?: string
  choices: PhraseSpec[]
}

export type EntryLookup = {
  textByCode: Record<string, string>
  romByCode: Record<string, string>
}

export type GameState = {
  stackConfig: StackConfig | null
  round: RoundState | null
  roundLoading: boolean
  roundSolved: boolean
  roundGeneration: number
  activePhrases: PhraseInstance[]
  lastLane: number
  lastPhraseId: string | null
  spawnCooldown: number
  incorrectStreak: number
  phase: "intro" | "celebrate" | "play"
}

export type GameStore<T> = {
  getState: () => T
  update: (updater: (draft: T) => void) => void
  subscribe: (listener: (state: T) => void) => () => void
}

export type ElectricField = {
  root: TransformNode
  update: (dt: number, target: Mesh | null, intensity: number) => void
  setColor: (color: Color3) => void
}

export type SceneProp = {
  mesh: Mesh
  baseZ: number
  offsetX: number
  baseY: number
  side: -1 | 1
}

export type Skin = {
  id: string
  name: string
  variantId: string
  palette: RoadPalette
  sky: Color4
  hemi: {
    intensity: number
    diffuse: Color3
    ground: Color3
  }
  accent: {
    intensity: number
    color: Color3
  }
  envRoot: TransformNode
  props: SceneProp[]
}

export type InputState = {
  row: number
  col: number
  tiltEnabled: boolean
  tiltActive: boolean
  tiltX: number
  tiltY: number
}

export type InitialState = {
  stackConfig?: StackConfig
}

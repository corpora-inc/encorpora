export type PredicateOp = "eq" | "neq" | "gte" | "lte" | "has_set" | "not_has_set"

export type EffectOp = "set" | "inc" | "add_set" | "remove_set"

export type VarType = "int" | "bool" | "set_string"

export type SceneType = "scene" | "hub" | "diamond_entry" | "diamond_merge" | "action"

export interface Predicate {
  op: PredicateOp
  var: string
  value: any
}

export interface Effect {
  op: EffectOp
  var: string
  value: any
}

export interface Choice {
  id: string
  label: string
  to: string | null
  effects?: Effect[]
  requires?: Predicate[]
  requires_any?: Predicate[][]
}

export interface ActionConfig {
  scene_key: string
  location: string
  npcs?: Array<{ id: string; x: number }>
}

export interface Scene {
  id: string
  type: SceneType
  title: string
  text: string[]
  on_enter?: Effect[]
  choices: Choice[]
  action_config?: ActionConfig
}

export interface VarSchema {
  type: VarType
  min?: number
  max?: number
  default: number | boolean | string[]
}

export interface StateSchema {
  type: "object"
  vars: Record<string, VarSchema>
}

export interface Globals {
  max_replays_per_scene?: number
  default_language?: string
}

export interface QuestJSON {
  spec_version: string
  quest_id: string
  title: string
  description: string
  start_scene_id: string
  globals?: Globals
  state_schema: StateSchema
  scenes: Scene[]
}

export type QuestState = Record<string, number | boolean | Set<string>>


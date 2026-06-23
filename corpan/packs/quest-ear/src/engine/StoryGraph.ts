import type {
  QuestJSON,
  QuestState,
  Scene,
  Choice,
  Predicate,
  Effect,
  VarSchema,
} from "./types"

export class StoryGraph {
  private scenes: Map<string, Scene> = new Map()
  private state: Map<string, number | boolean | Set<string>> = new Map()
  private currentSceneId: string | null = null
  private stateSchema: Record<string, VarSchema> = {}

  constructor() {
    // Empty state initialized
  }

  initQuest(json: QuestJSON): { state: QuestState; currentScene: Scene } {
    // Load scenes into Map
    this.scenes.clear()
    for (const scene of json.scenes) {
      this.scenes.set(scene.id, scene)
    }

    // Store state schema
    this.stateSchema = json.state_schema.vars

    // Initialize state from schema defaults
    this.state.clear()
    for (const [varName, schema] of Object.entries(this.stateSchema)) {
      switch (schema.type) {
        case "int":
          this.state.set(varName, schema.default as number)
          break
        case "bool":
          this.state.set(varName, schema.default as boolean)
          break
        case "set_string":
          this.state.set(varName, new Set(schema.default as string[]))
          break
      }
    }

    // Set current scene to start scene
    this.currentSceneId = json.start_scene_id

    // Enter the start scene (applies on_enter effects)
    const startScene = this.scenes.get(json.start_scene_id)
    if (!startScene) {
      throw new Error(`Start scene ${json.start_scene_id} not found`)
    }

    // Apply on_enter effects for start scene
    if (startScene.on_enter) {
      for (const effect of startScene.on_enter) {
        this.applyEffect(effect)
      }
    }

    return {
      state: this.getState(),
      currentScene: startScene,
    }
  }

  enterScene(sceneId: string): { scene: Scene; availableChoices: Choice[] } {
    const scene = this.scenes.get(sceneId)
    if (!scene) {
      throw new Error(`Scene ${sceneId} not found`)
    }

    this.currentSceneId = sceneId

    // Apply on_enter effects
    if (scene.on_enter) {
      for (const effect of scene.on_enter) {
        this.applyEffect(effect)
      }
    }

    // Filter choices based on requirements
    const availableChoices = this.filterChoices(scene.choices)

    return {
      scene,
      availableChoices,
    }
  }

  choose(choiceId: string): {
    nextScene: Scene | null
    effects: Effect[]
  } {
    if (!this.currentSceneId) {
      throw new Error("No current scene. Call initQuest or enterScene first.")
    }

    const currentScene = this.scenes.get(this.currentSceneId)
    if (!currentScene) {
      throw new Error(`Current scene ${this.currentSceneId} not found`)
    }

    // Find the choice
    const choice = currentScene.choices.find((c) => c.id === choiceId)
    if (!choice) {
      throw new Error(`Choice ${choiceId} not found in scene ${this.currentSceneId}`)
    }

    // Apply choice effects
    const effects: Effect[] = choice.effects || []
    for (const effect of effects) {
      this.applyEffect(effect)
    }

    // Navigate to next scene (or null for end)
    let nextScene: Scene | null = null
    if (choice.to !== null && choice.to !== undefined) {
      const scene = this.scenes.get(choice.to)
      if (scene) {
        nextScene = scene
        // Apply on_enter effects for next scene (if we're transitioning)
        if (scene.on_enter) {
          for (const effect of scene.on_enter) {
            this.applyEffect(effect)
          }
        }
        this.currentSceneId = choice.to
      }
    } else {
      // End of quest
      this.currentSceneId = null
    }

    return {
      nextScene,
      effects,
    }
  }

  getState(): QuestState {
    const state: QuestState = {}
    for (const [key, value] of this.state.entries()) {
      state[key] = value
    }
    return state
  }

  private evaluatePredicate(pred: Predicate): boolean {
    const varValue = this.state.get(pred.var)
    if (varValue === undefined) {
      return false
    }

    switch (pred.op) {
      case "eq":
        return varValue === pred.value

      case "neq":
        return varValue !== pred.value

      case "gte":
        if (typeof varValue === "number" && typeof pred.value === "number") {
          return varValue >= pred.value
        }
        return false

      case "lte":
        if (typeof varValue === "number" && typeof pred.value === "number") {
          return varValue <= pred.value
        }
        return false

      case "has_set":
        if (varValue instanceof Set) {
          return varValue.has(pred.value)
        }
        return false

      case "not_has_set":
        if (varValue instanceof Set) {
          return !varValue.has(pred.value)
        }
        return false

      default:
        return false
    }
  }

  private filterChoices(choices: Choice[]): Choice[] {
    return choices.filter((choice) => {
      // Check 'requires' (all must pass - AND logic)
      if (choice.requires && choice.requires.length > 0) {
        const allRequiredPass = choice.requires.every((pred) => this.evaluatePredicate(pred))
        if (!allRequiredPass) {
          return false
        }
      }

      // Check 'requires_any' (at least one group must pass - OR of groups, where each group is AND)
      if (choice.requires_any && choice.requires_any.length > 0) {
        const anyGroupPasses = choice.requires_any.some((group) => {
          if (group.length === 0) {
            return true // Empty group means pass
          }
          return group.every((pred) => this.evaluatePredicate(pred))
        })
        if (!anyGroupPasses) {
          return false
        }
      }

      return true
    })
  }

  private applyEffect(effect: Effect): void {
    const currentValue = this.state.get(effect.var)
    const schema = this.stateSchema[effect.var]

    if (!schema) {
      console.warn(`Unknown variable in effect: ${effect.var}`)
      return
    }

    switch (effect.op) {
      case "set":
        switch (schema.type) {
          case "int":
            this.state.set(effect.var, effect.value as number)
            break
          case "bool":
            this.state.set(effect.var, effect.value as boolean)
            break
          case "set_string":
            this.state.set(effect.var, new Set(effect.value as string[]))
            break
        }
        break

      case "inc":
        if (schema.type === "int" && typeof currentValue === "number") {
          const newValue = currentValue + (effect.value as number)
          // Apply min/max constraints if they exist
          if (schema.min !== undefined && newValue < schema.min) {
            this.state.set(effect.var, schema.min)
          } else if (schema.max !== undefined && newValue > schema.max) {
            this.state.set(effect.var, schema.max)
          } else {
            this.state.set(effect.var, newValue)
          }
        }
        break

      case "add_set":
        if (schema.type === "set_string" && currentValue instanceof Set) {
          const set = currentValue
          set.add(effect.value as string)
          this.state.set(effect.var, set)
        }
        break

      case "remove_set":
        if (schema.type === "set_string" && currentValue instanceof Set) {
          const set = currentValue
          set.delete(effect.value as string)
          this.state.set(effect.var, set)
        }
        break
    }
  }

  getCurrentSceneId(): string | null {
    return this.currentSceneId
  }

  getCurrentScene(): Scene | null {
    if (!this.currentSceneId) {
      return null
    }
    return this.scenes.get(this.currentSceneId) || null
  }

  getAvailableChoicesForCurrentScene(): Choice[] {
    const scene = this.getCurrentScene()
    if (!scene) {
      return []
    }
    return this.filterChoices(scene.choices)
  }
}


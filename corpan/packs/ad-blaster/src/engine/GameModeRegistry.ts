import type { GameMode } from "./types"

export class GameModeRegistry {
  private modes = new Map<string, GameMode>()

  register(mode: GameMode) {
    this.modes.set(mode.id, mode)
  }

  get(id: string): GameMode | undefined {
    return this.modes.get(id)
  }

  getAll(): GameMode[] {
    return Array.from(this.modes.values())
  }

  has(id: string): boolean {
    return this.modes.has(id)
  }
}

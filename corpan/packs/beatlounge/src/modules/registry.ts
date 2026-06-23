/**
 * beatlounge — the in-memory ModuleRegistry. The shell reads `all()` to lay out
 * tiles; the (future) LLM command bus reads `allActions()` to build its one
 * tool surface across every module. Registration is idempotent by id.
 */

import type {
  BeatloungeModule,
  ModuleAction,
  ModuleId,
  ModuleRegistry,
} from "../contracts/module"

export const createModuleRegistry = (): ModuleRegistry => {
  const modules = new Map<ModuleId, BeatloungeModule>()
  return {
    register(module) {
      modules.set(module.id, module)
    },
    get: (id) => modules.get(id),
    all: () => [...modules.values()],
    allActions(): { moduleId: ModuleId; action: ModuleAction }[] {
      const out: { moduleId: ModuleId; action: ModuleAction }[] = []
      for (const m of modules.values()) {
        for (const action of m.actions) out.push({ moduleId: m.id, action })
      }
      return out
    },
  }
}

import type { QuestJSON, Scene, Choice } from "./types"

export function validateQuest(json: unknown): string[] {
  const errors: string[] = []

  if (typeof json !== "object" || json === null) {
    return ["Quest JSON must be an object"]
  }

  const quest = json as Partial<QuestJSON>

  // Check required fields
  if (!quest.spec_version) {
    errors.push("Missing required field: spec_version")
  }
  if (!quest.quest_id) {
    errors.push("Missing required field: quest_id")
  }
  if (!quest.start_scene_id) {
    errors.push("Missing required field: start_scene_id")
  }
  if (!Array.isArray(quest.scenes)) {
    errors.push("Missing or invalid required field: scenes (must be an array)")
    return errors
  }

  const scenes = quest.scenes as Scene[]
  const sceneIds = new Set<string>()

  // Check for unique scene IDs
  for (const scene of scenes) {
    if (!scene.id) {
      errors.push("Scene missing required field: id")
      continue
    }
    if (sceneIds.has(scene.id)) {
      errors.push(`Duplicate scene ID: ${scene.id}`)
    }
    sceneIds.add(scene.id)
  }

  // Verify start_scene_id references an existing scene
  if (quest.start_scene_id && !sceneIds.has(quest.start_scene_id)) {
    errors.push(`start_scene_id "${quest.start_scene_id}" does not reference any scene`)
  }

  // Verify all choice 'to' fields reference existing scenes or are null
  for (const scene of scenes) {
    if (!Array.isArray(scene.choices)) {
      continue
    }
    for (const choice of scene.choices as Choice[]) {
      if (choice.to !== null && choice.to !== undefined) {
        if (typeof choice.to !== "string") {
          errors.push(`Choice ${choice.id} in scene ${scene.id} has invalid 'to' field (must be string or null)`)
        } else if (!sceneIds.has(choice.to)) {
          errors.push(`Choice ${choice.id} in scene ${scene.id} references non-existent scene: ${choice.to}`)
        }
      }
    }
  }

  return errors
}


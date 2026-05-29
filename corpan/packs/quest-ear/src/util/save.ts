/**
 * Tiny localStorage save for quest-ear. Independent of the StoryGraph (which
 * lives in MainScene and isn't reachable from ActionScene). Holds the bits that
 * must survive replays + app restarts — currently the Level-1 Ear fragment and
 * the clue it reveals toward the next level.
 *
 * All access is wrapped: private-mode / disabled storage / corrupt JSON all
 * fall back to defaults and never throw into the render loop.
 */

export interface QuestSave {
  level1FragmentCollected: boolean
  level1Clue: string
}

const KEY = "quest_ear.save"

const DEFAULT: QuestSave = {
  level1FragmentCollected: false,
  level1Clue: "",
}

export function loadSave(): QuestSave {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT }
    const parsed = JSON.parse(raw) as Partial<QuestSave>
    return {
      level1FragmentCollected: Boolean(parsed.level1FragmentCollected),
      level1Clue: typeof parsed.level1Clue === "string" ? parsed.level1Clue : "",
    }
  } catch {
    return { ...DEFAULT }
  }
}

export function saveQuest(next: Partial<QuestSave>): void {
  try {
    const merged = { ...loadSave(), ...next }
    localStorage.setItem(KEY, JSON.stringify(merged))
  } catch {
    /* storage disabled / quota exceeded — ignore, game stays playable */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

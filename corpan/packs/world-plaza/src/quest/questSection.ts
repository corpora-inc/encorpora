/**
 * questSection — the REAL "Quest" menu section (TOP_HUD consolidation §3.1): the
 * full quest detail surface the Status Capsule deep-links into. It replaces the
 * menu's "coming soon" placeholder with the player's active quest, told plainly:
 *
 *   - the quest TITLE + its one-line narrative,
 *   - the live OBJECTIVE ("what to do right now"),
 *   - the "WHAT NEXT" hint (find {item} / bring {item} to {who}),
 *   - a PROGRESS bar (step N of M) + the full STEP LIST (done / active / upcoming),
 *
 * It mirrors the capsule's content where sensible (it reuses the same
 * `QuestEngine` + `inventory` + `requiredForStep` resolution the capsule reads),
 * but unfurled into the roomy menu — the capsule is the glance, this is the
 * ledger. The capsule shows one objective row; here every step is laid out.
 *
 * It is a `MenuSectionView`: a factory that renders into the menu's
 * `.wp-menu-body` (a child of `.wp-overlay`, never `document.body`) and returns a
 * cleanup. Live: it subscribes to BOTH the quest engine and the inventory, so the
 * objective/hint/progress refresh while the menu is open. Styles live in
 * `src/styles.css` (`.wp-quest*`). Localized via the injected strings.
 */

import type { QuestEngine, StepState } from "./questState"
import type { InventoryStore } from "../economy/inventory"
import { requiredForStep } from "../economy/questItems"
import { getItemDef } from "../economy/inventory"

const LOG = "[wp/questSection]"

/** A MenuSectionView: render into `body`, return optional cleanup. */
export type MenuSectionView = (body: HTMLElement) => void | (() => void)

export interface QuestSectionStrings {
  /** Heading over the objective. */
  objectiveHeading: string
  /** Heading over the step list. */
  stepsHeading: string
  /** Builds "find {item}". */
  findItem: (item: string) => string
  /** Builds "bring {item} to {who}". */
  deliverItem: (item: string, who: string) => string
  /** Builds "talk to {who}". */
  talkTo: (who: string) => string
  /** Builds "step {done} of {total}". */
  progress: (done: number, total: number) => string
  /** Shown when the quest is complete. */
  complete: string
}

const DEFAULT_STRINGS: QuestSectionStrings = {
  objectiveHeading: "Your objective",
  stepsHeading: "The road ahead",
  findItem: (item) => `Find ${item}`,
  deliverItem: (item, who) => `Bring ${item} to ${who}`,
  talkTo: (who) => `Talk to ${who}`,
  progress: (done, total) => `Step ${done} of ${total}`,
  complete: "Quest complete — onward!",
}

export interface QuestSectionOptions {
  engine: QuestEngine
  inventory: InventoryStore
  /** Resolve a special-NPC/anchor id to a friendly name ("the boatman"). */
  anchorName?: (anchorId: string) => string
  /** Accent color (scene palette) for the progress bar + active step. */
  accent?: string
  /** Localized copy. */
  strings?: Partial<QuestSectionStrings>
}

/**
 * Build the Quest section factory. Returns a `MenuSectionView` the orchestrator
 * hands to `createShell({ sections: { quest } })`.
 */
export function createQuestSection(opts: QuestSectionOptions): MenuSectionView {
  return (body) => mountQuestSection(body, opts)
}

function mountQuestSection(body: HTMLElement, opts: QuestSectionOptions): () => void {
  const strings: QuestSectionStrings = { ...DEFAULT_STRINGS, ...(opts.strings ?? {}) }
  const anchorName = opts.anchorName ?? ((a: string) => prettyAnchor(a))

  const root = document.createElement("div")
  root.className = "wp-quest"
  if (opts.accent) root.style.setProperty("--wp-quest-accent", opts.accent)
  body.appendChild(root)

  function itemLabel(id: string): string {
    return getItemDef(id)?.name ?? id
  }

  function render(): void {
    try {
      root.replaceChildren()
      const quest = opts.engine.quest()
      const steps = quest.steps
      const state = opts.engine.state()
      const doneCount = steps.filter((s) => state.stepDone[s.id]).length

      // Title + narrative.
      const title = document.createElement("div")
      title.className = "wp-quest-title"
      title.textContent = quest.title
      root.appendChild(title)
      const narrative = (quest as { narrative?: string }).narrative
      if (narrative) {
        const n = document.createElement("div")
        n.className = "wp-quest-narrative"
        n.textContent = narrative
        root.appendChild(n)
      }

      // Objective + "what next".
      const objBlock = document.createElement("section")
      objBlock.className = "wp-quest-block"
      const objHead = document.createElement("div")
      objHead.className = "wp-quest-heading"
      objHead.textContent = strings.objectiveHeading
      objBlock.appendChild(objHead)

      if (state.complete) {
        const done = document.createElement("div")
        done.className = "wp-quest-objective wp-quest-objective--complete"
        done.textContent = strings.complete
        objBlock.appendChild(done)
      } else {
        const step = opts.engine.currentStep()
        const objective = document.createElement("div")
        objective.className = "wp-quest-objective"
        objective.textContent = step ? step.label || step.id : ""
        objBlock.appendChild(objective)

        if (step) {
          const st: StepState = opts.engine.stepState(step.id)
          const who = step.anchorId ? anchorName(step.anchorId) : null
          const requiredIds = requiredForStep(quest.id, step.id)
          const needed = requiredIds.find((id) => !opts.inventory.has(id))
          const held = requiredIds.find((id) => opts.inventory.has(id))
          let hint = ""
          if (st === "needs-item" && needed) hint = strings.findItem(itemLabel(needed))
          else if (st === "ready-to-deliver" && held && who)
            hint = strings.deliverItem(itemLabel(held), who)
          else if (who) hint = strings.talkTo(who)
          if (hint) {
            const h = document.createElement("div")
            h.className = "wp-quest-hint"
            h.textContent = hint
            objBlock.appendChild(h)
          }
        }
      }
      root.appendChild(objBlock)

      // Progress + step list.
      const stepsBlock = document.createElement("section")
      stepsBlock.className = "wp-quest-block"
      const stepsHead = document.createElement("div")
      stepsHead.className = "wp-quest-heading"
      stepsHead.textContent = strings.stepsHeading
      stepsBlock.appendChild(stepsHead)

      const progressRow = document.createElement("div")
      progressRow.className = "wp-quest-progress"
      progressRow.textContent = strings.progress(doneCount, steps.length)
      stepsBlock.appendChild(progressRow)

      const bar = document.createElement("div")
      bar.className = "wp-quest-bar"
      const fill = document.createElement("div")
      fill.className = "wp-quest-bar-fill"
      fill.style.width = `${steps.length ? Math.round((doneCount / steps.length) * 100) : 0}%`
      bar.appendChild(fill)
      stepsBlock.appendChild(bar)

      const activeStep = opts.engine.currentStep()
      const list = document.createElement("ol")
      list.className = "wp-quest-steps"
      for (const s of steps) {
        const li = document.createElement("li")
        const isDone = Boolean(state.stepDone[s.id])
        const isActive = !isDone && activeStep?.id === s.id
        li.className =
          "wp-quest-step" +
          (isDone ? " wp-quest-step--done" : isActive ? " wp-quest-step--active" : "")
        li.textContent = s.label || s.id
        list.appendChild(li)
      }
      stepsBlock.appendChild(list)
      root.appendChild(stepsBlock)
    } catch (err) {
      console.error(`${LOG} render failed:`, err)
    }
  }

  render()
  let unsubEngine: () => void = () => {}
  let unsubInv: () => void = () => {}
  try {
    unsubEngine = opts.engine.subscribe(() => render())
    unsubInv = opts.inventory.subscribe(() => render())
  } catch (err) {
    console.error(`${LOG} subscribe failed:`, err)
  }

  return () => {
    try {
      unsubEngine()
      unsubInv()
      root.remove()
    } catch (err) {
      console.error(`${LOG} cleanup failed:`, err)
    }
  }
}

/** "city_gate" → "City Gate" — a readable fallback when no name resolver given. */
function prettyAnchor(id: string): string {
  return id
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

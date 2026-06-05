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
  /**
   * Switch-quest picker copy (#41). OPTIONAL so existing `makeSectionStrings`
   * callers compile while i18n catalogs catch up — `DEFAULT_STRINGS` supplies a
   * shipped English fallback for each, and the section spreads provided strings
   * over the defaults.
   */
  /** Heading over the "switch quest" picker (the escape hatch). */
  switchHeading?: string
  /** A calm, dignified hint under the switch heading (never a dark pattern). */
  switchHint?: string
  /** Badge on the currently-active quest card. */
  currentBadge?: string
  /** Builds "Go to {where}" sub-line on a quest card. */
  goTo?: (where: string) => string
}

const DEFAULT_STRINGS: QuestSectionStrings = {
  objectiveHeading: "Your objective",
  stepsHeading: "The road ahead",
  findItem: (item) => `Find ${item}`,
  deliverItem: (item, who) => `Bring ${item} to ${who}`,
  talkTo: (who) => `Talk to ${who}`,
  progress: (done, total) => `Step ${done} of ${total}`,
  complete: "Quest complete — onward!",
  switchHeading: "Try a different journey",
  switchHint: "Every quest is yours to pick — switch any time, no pressure.",
  currentBadge: "Current",
  goTo: (where) => `Go to ${where}`,
}

export interface QuestSectionOptions {
  engine: QuestEngine
  inventory: InventoryStore
  /** Resolve a special-NPC/anchor id to a friendly name ("the boatman"). */
  anchorName?: (anchorId: string) => string
  /** Accent color (scene palette) for the progress bar + active step. */
  accent?: string
  /**
   * Localized copy — either a static object or a GETTER evaluated each time the
   * section mounts (`MenuSectionView` runs on every menu open). The getter form
   * lets the orchestrator re-localize in place after an immersion flip: re-opening
   * the section reads the new UI locale with no world rebuild.
   */
  strings?: Partial<QuestSectionStrings> | (() => Partial<QuestSectionStrings>)
  /**
   * Optional controls rendered at the TOP of the section, above the quest title
   * (e.g. the immersion toggle). The orchestrator owns the control; the section
   * just gives it a slot. Rendered once on mount (the section re-renders its quest
   * body on engine changes, but the controls host persists).
   */
  controls?: (host: HTMLElement) => void
  /**
   * The "switch quest" escape hatch (#41): a calm safety valve so a player is
   * NEVER trapped on a quest they can't or don't want to finish. Returns the
   * pickable quests (active first/marked); `onSwitchQuest(id)` re-points the world
   * to that quest. Both optional — omit to hide the picker (e.g. tutorial). NOT a
   * dark pattern: switching is dignified, never punished.
   */
  questChoices?: () => QuestChoice[]
  onSwitchQuest?: (questId: string) => void
}

/** One pickable quest in the switch-quest list. */
export interface QuestChoice {
  id: string
  title: string
  /** Where the first step sends you ("the harbor") — a friendly anchor name. */
  whereToGo?: string
  /** This is the quest currently active. */
  isActive: boolean
  /** This quest has already been completed (still replayable). */
  isComplete: boolean
}

/**
 * Build the Quest section factory. Returns a `MenuSectionView` the orchestrator
 * hands to `createShell({ sections: { quest } })`.
 */
export function createQuestSection(opts: QuestSectionOptions): MenuSectionView {
  return (body) => mountQuestSection(body, opts)
}

function mountQuestSection(body: HTMLElement, opts: QuestSectionOptions): () => void {
  const resolvedStrings = typeof opts.strings === "function" ? opts.strings() : opts.strings
  const strings: QuestSectionStrings = { ...DEFAULT_STRINGS, ...(resolvedStrings ?? {}) }
  const anchorName = opts.anchorName ?? ((a: string) => prettyAnchor(a))

  // Controls slot (e.g. the immersion toggle) — a SIBLING above the quest body so
  // the body's `replaceChildren()` re-render on engine changes never wipes it.
  if (opts.controls) {
    const controlsHost = document.createElement("div")
    controlsHost.className = "wp-quest-controls"
    body.appendChild(controlsHost)
    try {
      opts.controls(controlsHost)
    } catch (err) {
      console.error("[wp/questSection] controls render threw:", err)
    }
  }

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

      // ── Switch-quest escape hatch (#41) ──────────────────────────────────
      // A calm safety valve so the player is never trapped. Lists the available
      // quests; tapping one re-points the world. Dignified, no pressure.
      const choices = opts.questChoices?.() ?? []
      if (opts.onSwitchQuest && choices.length > 1) {
        // Coalesce the optional switch-strings to their shipped English defaults
        // (i18n catalogs may not carry them yet).
        const sw = {
          heading: strings.switchHeading ?? DEFAULT_STRINGS.switchHeading!,
          hint: strings.switchHint ?? DEFAULT_STRINGS.switchHint!,
          current: strings.currentBadge ?? DEFAULT_STRINGS.currentBadge!,
          goTo: strings.goTo ?? DEFAULT_STRINGS.goTo!,
        }
        const switchBlock = document.createElement("section")
        switchBlock.className = "wp-quest-block wp-quest-switch"
        const sHead = document.createElement("div")
        sHead.className = "wp-quest-heading"
        sHead.textContent = sw.heading
        switchBlock.appendChild(sHead)
        const sHint = document.createElement("div")
        sHint.className = "wp-quest-switch-hint"
        sHint.textContent = sw.hint
        switchBlock.appendChild(sHint)

        const cards = document.createElement("div")
        cards.className = "wp-quest-switch-cards"
        for (const c of choices) {
          const card = document.createElement(c.isActive ? "div" : "button")
          card.className =
            "wp-quest-switch-card" +
            (c.isActive ? " wp-quest-switch-card--active" : "") +
            (c.isComplete ? " wp-quest-switch-card--done" : "")
          const t = document.createElement("div")
          t.className = "wp-quest-switch-card-title"
          t.textContent = c.title
          card.appendChild(t)
          if (c.whereToGo) {
            const w = document.createElement("div")
            w.className = "wp-quest-switch-card-where"
            w.textContent = sw.goTo(c.whereToGo)
            card.appendChild(w)
          }
          if (c.isActive) {
            const badge = document.createElement("span")
            badge.className = "wp-quest-switch-badge"
            badge.textContent = sw.current
            card.appendChild(badge)
          } else {
            ;(card as HTMLButtonElement).type = "button"
            card.addEventListener("click", () => {
              try {
                opts.onSwitchQuest?.(c.id)
              } catch (err) {
                console.error(`${LOG} switch quest threw:`, err)
              }
            })
          }
          cards.appendChild(card)
        }
        switchBlock.appendChild(cards)
        root.appendChild(switchBlock)
      }
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

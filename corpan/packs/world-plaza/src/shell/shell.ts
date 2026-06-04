/**
 * shell — World Plaza's game lifecycle frame (PREMIUM_FOUNDATIONS §4, COHESION §2).
 *
 * `createShell(opts)` returns the object the orchestrator (game.ts) wires into
 * its input loop. The orchestrator owns the world; the shell owns the *frame*:
 * ESC routing, the unified menu, exit-to-host, and the save seam. The shell never
 * touches the scene directly — it only calls the hooks the orchestrator provides
 * (`onPause`/`onResume` to halt the sim + free the LLM; `isDialogueOpen` to know
 * whether ESC should close the chat instead; `closeDialogue` to do so).
 *
 * M0 STRUCTURAL FIX — everything the shell mounts lives INSIDE the game's
 * `.wp-overlay` (passed as `opts.overlay`), NOT on `document.body`. The retired
 * `pause.ts` mounted a body-fixed modal at z≈2.1 billion; under embedding the
 * Corpán host's `ContentPackHost` container forms a stacking context and clips
 * with overflow/transform/contain, so the body modal painted INSIDE the host's
 * clip → invisible (the exit was unreachable). The menu panel, the on-screen
 * menu button, and the exit confirm now ALL mount in `.wp-overlay` — the host's
 * accepted render surface — so they can never be clipped away.
 *
 * ESC semantics (single source of truth — closes the TOPMOST layer, in order):
 *   1. menu open            → close the menu
 *   2. exit confirm open    → the confirm owns its own (capture-phase) ESC;
 *                             the shell stays out of its way
 *   3. a blocking pack      → defer: the challenge / shop own their own ESC, so
 *      overlay is open         the shell does NOT raise the menu OVER them
 *   4. an NPC dialogue open → close the dialogue
 *   5. otherwise            → open the menu
 * So a couple of ESC presses ALWAYS lands you on the menu, where "Leave the
 * Plaza" → a dignified confirm → host exit. No dead-ends, no traps.
 *
 * Touch/tablet/desktop are all first-class: the shell also mounts an always-
 * visible menu button (top-left, in `.wp-overlay`) that opens the very same
 * menu, so a phone or tablet with no ESC key can still open the menu + exit.
 */

import { createMenuPanel, type MenuPanelHandle, type MenuStrings, type MenuSectionId, type MenuSectionView } from "./menuPanel"
import { confirmAndExit, type ExitStrings } from "./exit"
import { createMenuButton, type MenuButtonHandle } from "./menuButton"
import type { SaveSnapshotProvider } from "./save"
import { writeSave } from "./save"

/**
 * Selectors for the OTHER blocking pack overlays the shell must yield ESC to.
 * These overlays (challenge encounter, merchant shop) own their own ESC/close,
 * so when one is visible the shell defers rather than stacking the menu over it.
 * Detected structurally (by their open-state class) so the shell needs no extra
 * wiring from game.ts and stays robust as those overlays evolve.
 */
const BLOCKING_OVERLAY_SELECTORS = [
  ".wp-ch-scrim.wp-ch-scrim--in", // challenge encounter (open)
  ".wp-shop.wp-shop--in", // merchant shop (open)
] as const

function aBlockingOverlayIsOpen(): boolean {
  for (const sel of BLOCKING_OVERLAY_SELECTORS) {
    if (document.querySelector(sel)) return true
  }
  return false
}

export type ShellStrings = {
  menu?: Partial<MenuStrings>
  exit?: Partial<ExitStrings>
}

export type ShellOptions = {
  /**
   * The game's `.wp-overlay` element — the host's accepted render surface. ALL
   * shell chrome (menu panel, menu button, exit confirm) mounts INSIDE this, not
   * on `document.body`. This is the M0 fix; without it the menu/exit are clipped
   * invisible when embedded in the Corpán host.
   */
  overlay: HTMLElement
  /** Accent color (Scene.palette.accent) so overlays match the world. */
  accent?: string
  strings?: ShellStrings
  /** True while an NPC dialogue is open — ESC then closes it, not the menu. */
  isDialogueOpen: () => boolean
  /** Close the open dialogue (the orchestrator's `openDialogue?.close()`). */
  closeDialogue: () => void
  /** Halt the sim feel + free the LLM (orchestrator: stop frame loop, broker.onBackground()). */
  onPause: () => void
  /** Restore the sim (orchestrator: restart frame loop / re-enable input). */
  onResume: () => void
  /**
   * Snapshot getter for the save seam. Optional today (identity is saved by
   * game.ts); when provided, the shell writes a full save on pause + exit.
   */
  snapshot?: SaveSnapshotProvider
  /**
   * Local teardown for standalone dev (no host to unmount us) — typically
   * `game.dispose()`. Ignored when embedded in the Corpán host.
   */
  onStandaloneExit?: () => void
  /**
   * Mount the always-visible on-screen menu button (top-left). Defaults to TRUE
   * so touch + tablet users always have a way to open the menu and exit. Set
   * false only if the host already provides an equivalent affordance.
   */
  showMenuButton?: boolean
  /** Accessible label for the on-screen menu button (defaults to "Menu"). */
  menuButtonLabel?: string
  /**
   * Section view factories for the menu's Map · Inventory · Quest tabs. M0 omits
   * these → each tab shows a graceful "coming soon" placeholder; later
   * milestones pass real factories (inventory panel, full map, quest detail).
   */
  sections?: Partial<Record<MenuSectionId, MenuSectionView>>
}

export interface Shell {
  /** Wire this to the keydown handler in game.ts. Returns true if it handled ESC. */
  handleKey(e: KeyboardEvent): boolean
  /** Imperative: open the menu (e.g. an on-screen menu button). */
  pause(): void
  /** Imperative: close the menu (resume). */
  resume(): void
  /** Imperative: open the menu on a specific section. */
  openSection(section: MenuSectionId): void
  /** Imperative: run the "Leave the Plaza?" exit flow. */
  requestExit(): Promise<void>
  isPaused(): boolean
  /** Persist now (pause/exit/visibility). No-op if no snapshot provider. */
  save(): void
  dispose(): void
}

export function createShell(opts: ShellOptions): Shell {
  const persist = () => {
    if (opts.snapshot) writeSave(opts.snapshot)
  }

  // True while the "Leave the Plaza?" confirm is showing — so ESC doesn't also
  // try to toggle the menu underneath it (the confirm owns its own ESC).
  let confirmOpen = false

  const runExit = async (): Promise<void> => {
    if (confirmOpen) return
    persist()
    confirmOpen = true
    try {
      await confirmAndExit({
        strings: opts.strings?.exit,
        onStandaloneExit: opts.onStandaloneExit,
        // Mount the confirm INSIDE `.wp-overlay` too (same host-clip fix).
        mountParent: opts.overlay,
      })
    } finally {
      confirmOpen = false
    }
    // If the user chose "Stay", we land back on the menu (still open).
  }

  const menu: MenuPanelHandle = createMenuPanel({
    parent: opts.overlay,
    accent: opts.accent,
    strings: opts.strings?.menu,
    sections: opts.sections,
    onOpen: () => {
      persist()
      menuButton?.hide()
      opts.onPause()
    },
    onClose: () => {
      menuButton?.show()
      opts.onResume()
    },
    onLeave: () => void runExit(),
  })

  // Always-visible on-screen menu button (top-left, IN the overlay) — opens the
  // SAME menu. First-class for touch/tablet (no ESC key) and a discoverable hint
  // on desktop. Auto-hides while the menu is open.
  const menuButton: MenuButtonHandle | null =
    opts.showMenuButton === false
      ? null
      : createMenuButton({
          parent: opts.overlay,
          accent: opts.accent,
          label: opts.menuButtonLabel,
          onOpen: () => menu.open(),
        })

  const handle: Shell = {
    handleKey(e: KeyboardEvent): boolean {
      if (e.key !== "Escape") return false
      // 1) Menu open → close it. Highest priority so ESC always dismisses the
      //    menu, never traps the player inside it.
      if (menu.isOpen()) {
        menu.close()
        return true
      }
      // 2) Exit confirm open → it owns its own (capture-phase) ESC. Swallow so
      //    no world hotkey fires, but don't touch the menu.
      if (confirmOpen) return true
      // 3) A blocking pack overlay (challenge / shop) is open → defer to its own
      //    ESC/close; do NOT raise the menu over it.
      if (aBlockingOverlayIsOpen()) return false
      // 4) NPC dialogue open → close it.
      if (opts.isDialogueOpen()) {
        opts.closeDialogue()
        return true
      }
      // 5) Otherwise → open the menu.
      menu.open()
      return true
    },
    pause: () => menu.open(),
    resume: () => menu.close(),
    openSection: (section: MenuSectionId) => menu.open(section),
    requestExit: runExit,
    isPaused: () => menu.isOpen(),
    save: persist,
    dispose: () => {
      menuButton?.dispose()
      menu.dispose()
    },
  }
  return handle
}

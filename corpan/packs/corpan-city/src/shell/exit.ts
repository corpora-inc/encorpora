/**
 * exit — return to the Corpán host.
 *
 * THE HANDSHAKE (verified against the host, not invented):
 *   - The pack requests exit by dispatching a `window` CustomEvent
 *     `corpan:exit`. Corpán's `App.tsx` listens for it and calls
 *     `setActiveGame(null)`, which unmounts `ContentPackHost`. That host's
 *     cleanup calls the pack's `unmount()` (→ `game.dispose()` via main.ts) and
 *     fires `corpan:host-dispose` ({ detail: { id } }) as it tears down.
 *   - So: dispatch `corpan:exit`, and the host drives our clean teardown for us.
 *     No orchestrator one-liner is required for exit — `requestHostExit()` IS the
 *     mechanism. (In standalone dev there is no host listener; we fall back to a
 *     `onStandaloneExit` callback the shell provides so dev still tears down.)
 *
 * `confirmAndExit()` gates the exit behind the in-pack `wpConfirm` ("Leave the
 * Plaza?") — never `window.confirm`. The confirm modal is itself out-of-flow +
 * compositor-only, so even the exit prompt cannot jerk the scene.
 */

import { wpConfirm } from "./confirm"

export type ExitStrings = {
  /** Confirm prompt body. */
  leaveMessage: string
  /** Confirm prompt title (optional). */
  leaveTitle?: string
  /** Action label ("Leave"). */
  leaveConfirm: string
  /** Cancel label ("Stay"). */
  leaveCancel: string
}

export const DEFAULT_EXIT_STRINGS: ExitStrings = {
  leaveTitle: "Leave the Plaza?",
  leaveMessage: "Your progress is saved — the plaza will be here when you return.",
  leaveConfirm: "Leave",
  leaveCancel: "Stay",
}

/**
 * Tell the host to unmount this pack. Returns true if a real host listener is
 * present (we're running as a Corpán pack); false in standalone dev, where the
 * caller's `onStandaloneExit` should do local teardown instead.
 *
 * We can't directly observe whether App.tsx is listening, so we detect "are we
 * embedded in the host" structurally: the host mounts us inside a
 * `[data-corp-game]` script + a React container, and exposes `__corpanHostActive`
 * on globalThis while a pack is live (set in ContentPackHost.load()).
 */
export function isEmbeddedInHost(): boolean {
  return Boolean((globalThis as { __corpanHostActive?: boolean }).__corpanHostActive)
}

export function requestHostExit(): boolean {
  try {
    window.dispatchEvent(new CustomEvent("corpan:exit"))
    return true
  } catch (err) {
    console.error("[wp/shell/exit] failed to dispatch corpan:exit:", err)
    return false
  }
}

export type ConfirmAndExitOpts = {
  strings?: Partial<ExitStrings>
  /**
   * Called instead of (or in addition to) the host exit when running
   * standalone — e.g. `game.dispose()`. Always invoked when no host is present;
   * invoked alongside `corpan:exit` is left to the caller's preference (we only
   * call it on the standalone path so we never double-dispose under the host).
   */
  onStandaloneExit?: () => void
  /**
   * Where to mount the "Leave the Plaza?" confirm. Pass the game's `.wp-overlay`
   * (the host's accepted render surface) so the confirm is never clipped by the
   * host container — same fix as the menu. Defaults to `document.body`.
   */
  mountParent?: HTMLElement
}

/**
 * Prompt "Leave the Plaza?" and, on yes, signal the host to unmount us (or run
 * the standalone teardown). Resolves true if the user chose to leave.
 */
export async function confirmAndExit(opts: ConfirmAndExitOpts = {}): Promise<boolean> {
  const s: ExitStrings = { ...DEFAULT_EXIT_STRINGS, ...(opts.strings ?? {}) }
  const leave = await wpConfirm({
    title: s.leaveTitle,
    message: s.leaveMessage,
    confirmLabel: s.leaveConfirm,
    cancelLabel: s.leaveCancel,
    destructive: true,
    mountParent: opts.mountParent,
  })
  if (!leave) return false

  if (isEmbeddedInHost()) {
    requestHostExit()
  } else {
    // Standalone dev: no host to tear us down — do it locally.
    try {
      opts.onStandaloneExit?.()
    } catch (err) {
      console.error("[wp/shell/exit] standalone exit handler threw:", err)
    }
  }
  return true
}

/**
 * journey/mount.ts — the journey-launch mount path (activity-contract §6.1).
 *
 * Journey mode is detected once at mount (initialState.activity as the belt,
 * hostApi.journey?.isActive() as the suspenders — see main.ts). This module:
 *
 *   1. bails (abandon "unsupported" + corpan:exit) on a spec whose activityType
 *      this provider does not implement (contract §4.2),
 *   2. opens a WordfallSession for the spec (owns per-item buffer + terminal
 *      result),
 *   3. resolves spec.itemRefs → pinned EntryOut[] via hostApi.getEntryById
 *      (source-aware — entry ids are only unique per source),
 *   4. boots the Game in interlude mode AFTER the pins resolve; the Game runs
 *      exactly `session.rounds` rounds, streams reportItem per catch, and calls
 *      session.finish() (→ reportResult) + corpan:exit at the natural end,
 *   5. tears everything down on unmount. A run abandoned before its terminal
 *      result is the HOST's synthesis job (contract §8) from the buffered
 *      reportItem verdicts — the pack never fakes a terminal result on abandon.
 */

import { Game } from "../Game"
import { WordfallSession, JOURNEY_ACTIVITY_TYPE } from "./session"
import type { ActivitySpec } from "../sdk/activityContract"
import type { EntryOut, HostApi } from "../sdk/types"

/** Resolve the spec's phrase/word refs to host entries, in spec order. */
async function resolvePinnedEntries(
  hostApi: HostApi,
  spec: ActivitySpec
): Promise<EntryOut[]> {
  const out: EntryOut[] = []
  if (!hostApi.getEntryById) return out
  for (const ref of spec.itemRefs) {
    // Only corpus/phrase refs with numeric ids resolve to entries here. Word
    // refs (source = lang code) aren't corpus rows; they're skipped (a future
    // wordpan resolver could handle them).
    if (ref.kind !== "phrase") continue
    const id = Number(ref.id)
    if (!Number.isFinite(id)) continue
    try {
      const entry = await hostApi.getEntryById(id, ref.source)
      if (entry && entry.translations.length) out.push(entry)
    } catch (err) {
      console.warn(
        `[wordfall journey] could not resolve entry ${ref.source}:${ref.id}:`,
        err
      )
    }
  }
  return out
}

export function mountJourney(
  container: HTMLElement,
  hostApi: HostApi,
  spec: ActivitySpec,
  onGame: (game: Game | null) => void
): { unmount: () => void } {
  if (spec.activityType !== JOURNEY_ACTIVITY_TYPE) {
    try {
      hostApi.journey?.abandon("unsupported")
    } catch (err) {
      console.warn("[wordfall journey] abandon failed:", err)
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("corpan:exit"))
    }
    return { unmount: () => {} }
  }

  const session = new WordfallSession(spec, hostApi)
  let disposed = false
  let game: Game | null = null

  void (async () => {
    const pinned = await resolvePinnedEntries(hostApi, spec)
    if (disposed) return
    game = new Game(container, hostApi, {
      session,
      spec,
      pinnedEntries: pinned,
    })
    onGame(game)
  })()

  return {
    unmount: () => {
      disposed = true
      try {
        game?.dispose()
      } catch (err) {
        console.error("[wordfall journey] dispose threw:", err)
      }
      game = null
      onGame(null)
      // NB: on unmount we do NOT call session.finish(). A swipe-away before the
      // natural end is an ABANDON — the host synthesizes {abandoned:true} from
      // the buffered reportItem verdicts (contract §8). The pack never fakes a
      // terminal result on teardown.
    },
  }
}

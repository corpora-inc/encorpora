/**
 * journey/mount.ts — the journey-launch mount path (activity-contract §6.1).
 *
 * Journey mode is detected once at mount (initialState.activity as the belt,
 * hostApi.journey?.isActive() as the suspenders — see main.ts) and threaded
 * explicitly through the JourneyRun; no gameplay globals. This module:
 *
 *   1. resolves spec.itemRefs → pinned EntryOut[] via hostApi.getEntryById
 *      (source-aware — entry ids are only unique per source),
 *   2. registers the journey WordSelector + pinned pool on ContentManager's
 *      module-level registries (Game.ts's own `new ContentManager(hostApi)`
 *      resolves them transparently),
 *   3. boots the Game AFTER the pins resolve and auto-starts it in the spec's
 *      mode (a journey feed card never shows the pack menu),
 *   4. tears everything down on unmount so standalone launches never see a
 *      stale pin/selector. A run abandoned before its terminal result is the
 *      HOST's synthesis job (contract §8) — the pack never fakes one.
 */

import { Game } from "../Game";
import { GameMode } from "../types";
import {
  setDefaultWordSelector,
  setDefaultPinnedEntries,
} from "../ContentManager";
import {
  beginJourneyRun,
  endJourneyRun,
  JOURNEY_ACTIVITY_TYPE,
} from "./state";
import type { ActivitySpec } from "../sdk/activityContract";
import type { EntryOut, HostApi, StackConfig } from "../sdk/types";

/** Resolve the spec's phrase refs to host entries, in spec order. */
async function resolvePinnedEntries(
  hostApi: HostApi,
  spec: ActivitySpec
): Promise<EntryOut[]> {
  const out: EntryOut[] = [];
  if (!hostApi.getEntryById) return out;
  for (const ref of spec.itemRefs) {
    if (ref.kind !== "phrase") continue;
    const id = Number(ref.id);
    if (!Number.isFinite(id)) continue;
    try {
      const entry = await hostApi.getEntryById(id, ref.source);
      if (entry) out.push(entry);
    } catch (err) {
      console.warn(
        `[lingo-hero journey] could not resolve entry ${ref.source}:${ref.id}:`,
        err
      );
    }
  }
  return out;
}

/**
 * Mount Lingo Hero as a Journey activity provider. Returns the pack-module
 * mount handle. `onGame` lets main.ts keep the `window.__lingoHero` debug
 * surface in lock-step with the live instance (null on teardown).
 */
export function mountJourney(
  container: HTMLElement,
  hostApi: HostApi,
  spec: ActivitySpec,
  initialState: { stackConfig?: StackConfig } | undefined,
  onGame: (game: Game | null) => void
): { unmount: () => void } {
  if (spec.activityType !== JOURNEY_ACTIVITY_TYPE) {
    // A spec this provider does not implement — bail per contract §4.2.
    try {
      hostApi.journey?.abandon("unsupported");
    } catch (err) {
      console.warn("[lingo-hero journey] abandon failed:", err);
    }
    window.dispatchEvent(new CustomEvent("corpan:exit"));
    return { unmount: () => {} };
  }

  const run = beginJourneyRun(spec, hostApi, container);
  // Pin the selector BEFORE Game constructs its ContentManager; the pinned
  // pool follows once the refs resolve (first round waits on it below).
  setDefaultWordSelector(run.selector);

  let disposed = false;
  let game: Game | null = null;

  void (async () => {
    const pinned = await resolvePinnedEntries(hostApi, spec);
    if (disposed) return;
    run.setPinned(pinned);
    setDefaultPinnedEntries(pinned);
    game = new Game(container, hostApi, initialState);
    onGame(game);
    // Journey cards skip the menu: start straight into the spec's mode. The
    // audio stream's unlock-on-gesture wiring still applies to game SFX.
    (game as unknown as { startGame: (mode: GameMode) => void }).startGame(
      run.mode === "blitz" ? GameMode.BLITZ : GameMode.PRACTICE
    );
  })();

  return {
    unmount: () => {
      disposed = true;
      try {
        game?.dispose();
      } catch (err) {
        console.error("[lingo-hero journey] dispose threw:", err);
      }
      game = null;
      onGame(null);
      setDefaultWordSelector(null);
      setDefaultPinnedEntries(null);
      endJourneyRun();
    },
  };
}

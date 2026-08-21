/**
 * journey/reporter.ts — the wave-resolved → ActivityResult wiring
 * (activity-contract §6.1 choke point 2).
 *
 * One extra bus subscriber; Game.ts stays the sole emitter. Called from
 * learning/index.ts's initLearning when a journey run is active (the same
 * no-Game.ts-edit hook the Leitner layer uses); in that mode the Leitner
 * store is retired (D11) and this reporter is the only wave-resolved consumer
 * with side effects beyond the HUD.
 */

import type { GameEventBus } from "../events";
import type { JourneyRun } from "./state";

/**
 * Subscribe the journey run to the bus. Returns a teardown that detaches all
 * subscriptions (LearningApi.dispose shape).
 */
export function initJourneyReporting(
  bus: GameEventBus,
  run: JourneyRun
): () => void {
  const offFns: Array<() => void> = [];

  offFns.push(
    bus.on("wave-resolved", (e) => {
      run.noteWaveResolved(e);
    })
  );
  offFns.push(
    bus.on("scoreChange", (e) => {
      run.noteScore(e.value);
    })
  );
  offFns.push(
    bus.on("comboChange", (e) => {
      run.noteCombo(e.value);
    })
  );
  offFns.push(
    bus.on("decoy-dodged", () => {
      run.noteDecoyDodged();
    })
  );

  return () => {
    for (const off of offFns) off();
    offFns.length = 0;
  };
}

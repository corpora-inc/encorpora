import type { GameEventBus } from "../events";
import type { HostApi } from "../sdk/types";

/**
 * Progression layer — XP, levels, combo multipliers, streaks, high scores.
 *
 * STREAM: progression. NO-OP stub landed by Foundation. Fill in without
 * touching Game.ts — subscribe to the bus and (optionally) persist via hostApi.
 *
 * Contract:
 *  - Subscribe to "noteHit"/"noteMiss"/"comboChange"/"scoreChange"/"gameOver".
 *  - Maintain derived state: current XP, level, combo multiplier, best streak,
 *    session high score, lifetime high score. The HUD POLLS this via the
 *    returned read API (see ProgressionApi) every frame/update — keep getters
 *    cheap and synchronous.
 *  - Persistence is OPTIONAL and host-mediated. There is no storage method on
 *    HostApi today; if/when one lands, read/write it here. For now keep state
 *    in-memory (and/or localStorage guarded by try/catch). `hostApi` is passed
 *    so progression can read getStackConfig() (e.g. per-language high scores)
 *    without Game.ts plumbing.
 *
 * @returns a ProgressionApi the Hud can poll. The stub returns inert getters so
 *          the HUD compiles and shows zeros until the progression stream lands.
 */
export interface ProgressionSnapshot {
  xp: number;
  level: number;
  /** Score multiplier derived from current combo (>= 1). */
  comboMultiplier: number;
  /** Longest combo streak this session. */
  bestStreak: number;
  /** High score (lifetime/persisted if available, else session). */
  highScore: number;
}

export interface ProgressionApi {
  /** Cheap synchronous snapshot for the HUD to poll. */
  getSnapshot: () => ProgressionSnapshot;
  /** Tear down listeners. */
  dispose: () => void;
}

const INERT_SNAPSHOT: ProgressionSnapshot = {
  xp: 0,
  level: 1,
  comboMultiplier: 1,
  bestStreak: 0,
  highScore: 0,
};

export function initProgression(
  bus: GameEventBus,
  hostApi: HostApi
): ProgressionApi {
  // NO-OP foundation stub.
  void bus;
  void hostApi;

  return {
    getSnapshot: () => INERT_SNAPSHOT,
    dispose: () => {
      /* progression stream: detach listeners here */
    },
  };
}

import type { GameEventBus } from "../events";
import type { LaneSystem } from "../LaneSystem";

/**
 * VFX layer — particles, screen shake, hit bursts, combo flares, transitions.
 *
 * STREAM: effects. This is a NO-OP stub the Foundation lands so the game runs;
 * the effects stream fills in the body without ever touching Game.ts.
 *
 * Contract:
 *  - `ctx` is the SAME 2D context Renderer draws into (already DPR-scaled).
 *    The effects stream draws on top of the game each frame. To get a
 *    per-frame draw call, expose a `render(now)` method on the returned handle
 *    and have the integrator call it from the loop, OR (preferred) spin an
 *    independent rAF inside initEffects keyed off bus events — your choice,
 *    just don't edit Game.ts.
 *  - `bus` delivers gameplay events. Spawn bursts on "noteHit" (use
 *    payload.x/y/lane), shake on "noteMiss", combo flares on "comboChange",
 *    celebration on milestone crossings, transitions on "gameStart"/"gameOver".
 *  - `laneSystem` provides geometry: getLaneX(lane), getStrumLineY(),
 *    getNoteRadius(), getLaneBounds(lane). Use it to place effects precisely.
 *
 * @returns an EffectsHandle. `dispose()` is called by Game on unmount; tear
 *          down any rAF/listeners there. `render(now)` is OPTIONAL — if the
 *          effects stream wants Game to drive painting it can populate this and
 *          coordinate with the integrator; the stub leaves it undefined.
 */
export interface EffectsHandle {
  /** Optional per-frame hook if the effects stream opts into loop-driven paint. */
  render?: (now: number) => void;
  /** Tear down rAF loops, listeners, buffers. */
  dispose: () => void;
}

export function initEffects(
  ctx: CanvasRenderingContext2D,
  bus: GameEventBus,
  laneSystem: LaneSystem
): EffectsHandle {
  // NO-OP foundation stub. Reference args so noUnusedParameters stays happy and
  // the wiring is documented for the effects stream.
  void ctx;
  void bus;
  void laneSystem;

  return {
    dispose: () => {
      /* effects stream: tear down here */
    },
  };
}

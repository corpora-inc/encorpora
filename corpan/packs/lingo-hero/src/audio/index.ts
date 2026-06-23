import type { GameEventBus } from "../events";

/**
 * SFX + haptics layer — UI clicks, hit chimes, miss thuds, combo risers,
 * game-over sting, and navigator.vibrate haptic taps.
 *
 * STREAM: audio. NO-OP stub landed by Foundation. Fill in without touching
 * Game.ts — wire everything off the bus inside initAudioHaptics.
 *
 * Contract:
 *  - Build the WebAudio graph lazily on the FIRST user gesture. The bus emits
 *    "gameStart" from a click/touch handler, so resume()/unlock the
 *    AudioContext there (mobile autoplay policy).
 *  - "noteHit": play a chime; pitch can rise with payload.combo. Haptic: short
 *    vibrate. "noteMiss": thud + (optional) error buzz. "comboChange":
 *    milestone riser. "gameOver": sting. "menuShown": ambient/none.
 *  - Respect prefers-reduced-motion / silent contexts gracefully; never throw.
 *
 * @returns an AudioHandle; Game calls dispose() on unmount (close the
 *          AudioContext, remove any listeners you added beyond the bus).
 */
export interface AudioHandle {
  /** Close the AudioContext and detach listeners. */
  dispose: () => void;
}

export function initAudioHaptics(bus: GameEventBus): AudioHandle {
  // NO-OP foundation stub.
  void bus;

  return {
    dispose: () => {
      /* audio stream: close AudioContext here */
    },
  };
}

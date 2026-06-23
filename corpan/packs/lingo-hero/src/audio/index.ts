import type { GameEventBus } from "../events";
import { LaneIndex } from "../types";
import { SynthEngine } from "./SynthEngine";
import { Haptics } from "./haptics";
import {
  playHit,
  playMiss,
  playPassed,
  playMilestone,
  playComboBreak,
  playMenu,
  playStart,
  playGameOver,
} from "./sounds";

/**
 * SFX + haptics layer — UI clicks, hit chimes, miss thuds, combo risers,
 * game-over sting, and navigator.vibrate haptic taps.
 *
 * STREAM: audio. Everything is wired off the bus; Game.ts is untouched. All
 * sound is synthesized at runtime (no bundled audio assets) so the pack stays
 * fully offline with zero binary weight. The AudioContext is unlocked on the
 * first `gameStart` (which originates from a click/touch handler) to satisfy
 * mobile autoplay policy. Nothing here ever throws into the game loop.
 *
 * @returns an AudioHandle; Game calls dispose() on unmount.
 */
export interface AudioHandle {
  /** Close the AudioContext and detach listeners. */
  dispose: () => void;
}

/** Combo milestone every N hits triggers the celebratory riser. */
const MILESTONE_INTERVAL = 5;

/** Map a lane to a gentle stereo pan so hits feel spatial. */
function lanePan(lane: LaneIndex | null): number {
  switch (lane) {
    case LaneIndex.Left:
      return -1;
    case LaneIndex.Right:
      return 1;
    default:
      return 0;
  }
}

/** How many milestone thresholds were crossed going prev -> value. */
function milestoneCrossed(prev: number, value: number): number {
  if (value <= prev) return 0;
  const prevTier = Math.floor(prev / MILESTONE_INTERVAL);
  const newTier = Math.floor(value / MILESTONE_INTERVAL);
  return newTier > prevTier ? newTier : 0;
}

export function initAudioHaptics(bus: GameEventBus): AudioHandle {
  const synth = new SynthEngine();
  const haptics = new Haptics();
  const unsubs: Array<() => void> = [];

  // --- gameStart: unlock audio (first gesture) + energetic swell ---------
  unsubs.push(
    bus.on("gameStart", () => {
      // Critical: this fires from the menu click/touch handler, so it is a
      // valid user-gesture context to create/resume the AudioContext.
      synth.unlock();
      playStart(synth);
    })
  );

  // --- menuShown: gentle ambient chime -----------------------------------
  unsubs.push(
    bus.on("menuShown", () => {
      // The very first menu may show before any gesture; unlock() is a no-op
      // until then, so this simply stays silent until audio is permitted.
      if (synth.ready) playMenu(synth);
    })
  );

  // --- noteHit: rising chime + haptic tick -------------------------------
  unsubs.push(
    bus.on("noteHit", (e) => {
      playHit(synth, e.combo, lanePan(e.lane));
      haptics.hit(e.combo);
    })
  );

  // --- noteMiss: thud / passed cue + buzz --------------------------------
  unsubs.push(
    bus.on("noteMiss", (e) => {
      if (e.reason === "passed") {
        playPassed(synth);
        haptics.passed();
      } else {
        playMiss(synth, lanePan(e.lane));
        haptics.miss();
      }
    })
  );

  // --- comboChange: milestone riser OR streak-break deflate --------------
  unsubs.push(
    bus.on("comboChange", (e) => {
      const tier = milestoneCrossed(e.previous, e.value);
      if (tier > 0) {
        playMilestone(synth, tier);
        haptics.milestone();
      } else if (e.value === 0 && e.previous >= MILESTONE_INTERVAL) {
        // Lost a meaningful streak — a small audible "aww".
        playComboBreak(synth);
      }
    })
  );

  // --- gameOver: dramatic sting + rumble ---------------------------------
  unsubs.push(
    bus.on("gameOver", () => {
      playGameOver(synth);
      haptics.gameOver();
    })
  );

  return {
    dispose: () => {
      for (const off of unsubs) {
        try {
          off();
        } catch {
          /* ignore */
        }
      }
      unsubs.length = 0;
      haptics.cancel();
      synth.dispose();
    },
  };
}

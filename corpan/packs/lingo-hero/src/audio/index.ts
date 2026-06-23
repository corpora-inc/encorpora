import type { GameEventBus } from "../events";
import { LaneIndex } from "../types";
import { SynthEngine } from "./SynthEngine";
import { MusicBed } from "./MusicBed";
import { MuteToggle } from "./MuteToggle";
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
  playWaveVerdict,
} from "./sounds";

/**
 * Audio + haptics layer — a fully-offline synthwave palette:
 *   - combo-pitched hit chimes, milestone risers, a soft non-punitive miss,
 *   - a per-wave verdict accent that reinforces the learning moment,
 *   - a menu stinger + an energetic start swell + a dramatic game-over sting,
 *   - an EVOLVING ambient/music BED that intensifies with the combo, and
 *   - navigator.vibrate haptic taps.
 *
 * Plus a self-contained, neon-styled MUTE TOGGLE (persisted to localStorage)
 * and full prefers-reduced-motion respect.
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

/** Read prefers-reduced-motion once; vibration + heavy motion-y layers respect it. */
function prefersReducedMotion(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  } catch {
    return false;
  }
}

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
  const reduced = prefersReducedMotion();
  const synth = new SynthEngine();
  const music = new MusicBed(synth, reduced);
  const haptics = new Haptics();
  const unsubs: Array<() => void> = [];

  // Self-contained neon mute control. Created up front; attached to the HUD
  // overlay once it exists (first menu/start). Toggling mutes the whole bus
  // (SFX + music) and the bed pauses/resumes its scheduler accordingly.
  const mute = new MuteToggle((muted) => {
    synth.setMuted(muted);
    if (muted) {
      // Stop scheduling so a muted run isn't quietly burning the clock.
      music.stop(0.1);
    } else if (synth.ready) {
      music.start();
    }
  });

  /** Sync engine + bed to the persisted mute preference once audio is live. */
  const applyMute = () => {
    synth.setMuted(mute.isMuted);
  };

  // --- gameStart: unlock audio (first gesture) + swell + start the bed -----
  unsubs.push(
    bus.on("gameStart", () => {
      // Critical: this fires from the menu click/touch handler, so it is a
      // valid user-gesture context to create/resume the AudioContext.
      synth.unlock();
      applyMute();
      mute.attach();
      playStart(synth);
      if (!mute.isMuted) {
        music.setCombo(0);
        music.start();
      }
    })
  );

  // --- menuShown: gentle stinger + cool the bed back to menu ambience ------
  unsubs.push(
    bus.on("menuShown", () => {
      // The very first menu may show before any gesture; unlock() is a no-op
      // until then, so this simply stays silent until audio is permitted.
      mute.attach();
      if (synth.ready) {
        applyMute();
        playMenu(synth);
        // Keep a soft menu bed running if not muted, otherwise hush it.
        if (!mute.isMuted) {
          music.cool();
          music.start();
        } else {
          music.stop(0.3);
        }
      }
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

  // --- wave-resolved: a subtle verdict accent for the learning moment ----
  // Fires exactly once per wave with the FINAL verdict (correct/wrong/passed),
  // layered quietly under the per-tap SFX to reinforce the meaning-reveal.
  unsubs.push(
    bus.on("wave-resolved", (e) => {
      playWaveVerdict(synth, e.outcome);
    })
  );

  // --- comboChange: milestone riser / break deflate + drive the music bed -
  unsubs.push(
    bus.on("comboChange", (e) => {
      // The bed intensifies (or cools) with every combo change.
      if (e.value === 0) {
        music.cool();
      } else {
        music.setCombo(e.value);
      }

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

  // --- gameOver: dramatic sting + rumble + cool the bed out --------------
  unsubs.push(
    bus.on("gameOver", () => {
      playGameOver(synth);
      haptics.gameOver();
      music.cool();
      music.stop(1.2);
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
      mute.dispose();
      music.dispose();
      synth.dispose();
    },
  };
}

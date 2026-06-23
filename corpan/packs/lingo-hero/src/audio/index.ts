import type { GameEventBus } from "../events";
import { LaneIndex } from "../types";
import { SynthEngine } from "./SynthEngine";
import { MusicBed } from "./MusicBed";
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
  playDecoyDodged,
} from "./sounds";

/**
 * Audio + haptics layer — a fully-offline synthwave palette:
 *   - combo-pitched hit chimes, milestone risers, a soft non-punitive miss,
 *   - a per-wave verdict accent that reinforces the learning moment,
 *   - a menu stinger + an energetic start swell + a dramatic game-over sting,
 *   - an EVOLVING ambient/music BED (a LIBRARY of procedural tunes that rotate
 *     on round/level transitions and pick up pace with progress), and
 *   - navigator.vibrate haptic taps.
 *
 * It also PAUSES (suspends the AudioContext) on `gamePaused` and RESUMES +
 * resyncs the music scheduler on `gameResumed`, so audio never keeps running
 * while the game loop is frozen in the background. Full prefers-reduced-motion
 * respect throughout.
 *
 * The in-game mute BUTTON was removed (it overlapped the playfield and stole
 * top space); a stored mute preference is still honored here so a future pause
 * menu can flip it. STREAM: audio. Everything is wired off the bus; Game.ts is untouched. All
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
  /**
   * Introspection for the e2e harness (iOS unlock-wiring proof). Reports the
   * live AudioContext.state ("suspended" | "running" | "closed") or null if no
   * context exists yet. NOT used by gameplay — purely a test/diagnostic hook.
   */
  contextState: () => AudioContextState | null;
  /** True once a real user gesture has unlocked (created/resumed) the context. */
  isUnlocked: () => boolean;
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

/** Read the persisted mute preference (set by a future pause menu). */
const MUTE_STORAGE_KEY = "lingoHero.audio.muted";
function readStoredMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function initAudioHaptics(bus: GameEventBus): AudioHandle {
  const reduced = prefersReducedMotion();
  const synth = new SynthEngine();
  const music = new MusicBed(synth, reduced);
  const haptics = new Haptics();
  const unsubs: Array<() => void> = [];

  // Honor a stored mute preference. The in-game MUTE control (one, in the HUD)
  // flips this live via the `muteChange` event below; the preference also
  // persists so it carries across runs. Default = unmuted.
  let muted = readStoredMuted();
  const applyMute = () => synth.setMuted(muted);

  // --- muteChange: the single in-game mute toggle, applied LIVE -------------
  unsubs.push(
    bus.on("muteChange", (e) => {
      muted = e.muted;
      applyMute();
      // Stop or (re)start the bed to match, so muting actually silences the
      // running music bed and unmuting brings it back during play.
      if (muted) {
        music.stop(0.2);
      } else if (synth.ready) {
        music.resync();
        music.start();
      }
    })
  );

  // --- iOS FIRST-GESTURE UNLOCK (issue #428) -------------------------------
  // On iOS/iPadOS Safari the AudioContext is born `suspended` and Safari will
  // ONLY transition it to `running` if resume()/the first sound is initiated
  // from INSIDE a real user-gesture handler (pointerdown/touchend/click). The
  // menu Practice button already drives `gameStart` -> synth.unlock(), but a
  // player's FIRST tap may land elsewhere (a canvas lane tap, a tap-to-begin),
  // and on iOS that first tap is the one gesture we must spend on the unlock.
  // So we also unlock from the very first window-level gesture, then detach.
  // unlock() creates-then-resumes; resuming an already-running context is a
  // harmless no-op, so this never regresses Android/desktop (where the context
  // is already permitted) and never double-creates (unlock() is idempotent).
  let gestureUnlockDetach: (() => void) | null = null;
  if (typeof window !== "undefined") {
    const onFirstGesture = () => {
      synth.unlock();
      gestureUnlockDetach?.();
    };
    // touchend + click cover iOS Safari's accepted gesture set; pointerdown
    // covers the canvas InputManager taps and mouse/desktop. `once` lets the
    // browser auto-remove, and we also detach explicitly after the first fire.
    const opts = { capture: true, passive: true } as AddEventListenerOptions;
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "touchend",
      "click",
    ];
    for (const ev of events) window.addEventListener(ev, onFirstGesture, opts);
    gestureUnlockDetach = () => {
      for (const ev of events)
        window.removeEventListener(ev, onFirstGesture, opts);
      gestureUnlockDetach = null;
    };
    unsubs.push(() => gestureUnlockDetach?.());
  }

  // --- iOS RESUME-FROM-BACKGROUND (issue #428) -----------------------------
  // iOS suspends the AudioContext whenever the app/tab is backgrounded — even
  // when the game itself was not paused (e.g. sitting on the menu). The Game's
  // own pause/resume gate (`gameResumed`) only fires if the LOOP was paused, so
  // a menu-time background->foreground would leave audio stuck `suspended` and
  // silent. Resume on every visibilitychange->visible directly, independent of
  // the loop pause gate. Resuming a running context is a no-op (no regression).
  if (typeof document !== "undefined") {
    const onVisible = () => {
      if (!document.hidden) synth.resume();
    };
    document.addEventListener("visibilitychange", onVisible);
    unsubs.push(() =>
      document.removeEventListener("visibilitychange", onVisible)
    );
  }

  // --- gameStart: unlock audio (first gesture) + swell + start the bed -----
  unsubs.push(
    bus.on("gameStart", () => {
      // Critical: this fires from the menu click/touch handler, so it is a
      // valid user-gesture context to create/resume the AudioContext.
      synth.unlock();
      muted = readStoredMuted();
      applyMute();
      playStart(synth);
      // Fresh tune rotation per run; gentle opener leads (good for beginners).
      music.chooseRotation();
      if (!muted) {
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
      if (synth.ready) {
        muted = readStoredMuted();
        applyMute();
        playMenu(synth);
        // Keep a soft menu bed running if not muted, otherwise hush it.
        if (!muted) {
          music.cool();
          music.start();
        } else {
          music.stop(0.3);
        }
      }
    })
  );

  // --- gamePaused / gameResumed: PAUSE + RESUME audio with the loop --------
  // Suspending the AudioContext freezes its clock so the bed's scheduler can't
  // run ahead of the frozen game loop (the background-brick desync). On resume
  // we resync the bed's beat baseline to the live clock.
  unsubs.push(
    bus.on("gamePaused", () => {
      music.stop(0.15);
      synth.suspend();
    })
  );
  unsubs.push(
    bus.on("gameResumed", () => {
      synth.resume();
      if (synth.ready && !muted) {
        music.resync();
        music.start();
      }
    })
  );

  // --- roundAdvance: rotate to a fresh tune + pick up pace with level ------
  unsubs.push(
    bus.on("roundAdvance", (e) => {
      music.setLevel(e.level);
      if (synth.ready && !muted) music.nextTune();
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

  // --- decoy-dodged: bright "phew + sparkle" reward + a light haptic tick ---
  // The player correctly dodged a distractor (issue #429). A positive, airy cue
  // that celebrates the avoidance without competing with the catch bell.
  unsubs.push(
    bus.on("decoy-dodged", (e) => {
      playDecoyDodged(synth, lanePan(e.lane));
      haptics.hit(Math.max(1, e.combo));
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
    contextState: () => synth.state,
    isUnlocked: () => synth.isUnlocked,
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
      music.dispose();
      synth.dispose();
    },
  };
}

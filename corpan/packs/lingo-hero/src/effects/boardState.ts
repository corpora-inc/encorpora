import { LaneIndex } from "../types";

/**
 * Process-local "board signal" — the thin seam that lets the Renderer (which is
 * constructed as `new Renderer(canvas, laneSystem)` and therefore never receives
 * the event bus) react to gameplay WITHOUT editing Game.ts.
 *
 * The effects layer (`effects/index.ts`) is already a bus subscriber. It pushes
 * combo / hit / miss signals into this singleton each time the bus fires; the
 * Renderer reads them every frame to escalate lane intensity, fire lane-flash
 * columns on a hit, and flush the playfield with red on a miss. Both modules
 * live under `effects/*` + `Renderer.ts` (this stream's owned files), so the
 * coupling stays inside the BOARD stream and never crosses into Game.ts.
 *
 * It is intentionally a module-level singleton: there is exactly one live Game /
 * canvas at a time in the host, and `reset()` is called on gameStart/menuShown
 * so a remount starts clean.
 */

export interface LaneFlash {
  /** performance.now() timestamp the flash was triggered. */
  at: number;
  /** 0..1 intensity (scales with combo at trigger time). */
  power: number;
}

interface BoardState {
  /** Current combo (0 when broken). Drives escalation of grid + lane glow. */
  combo: number;
  /** Smoothed 0..1 "energy" the Renderer eases toward combo for buttery ramps. */
  energy: number;
  /** Per-lane hit flash (column slam + ring). Indexed by LaneIndex. */
  laneFlash: [LaneFlash, LaneFlash, LaneFlash];
  /** performance.now() of the last miss (drives a brief red wash on the floor). */
  lastMissAt: number;
  /** 0..1 power of the last miss (passed target > wrong tap). */
  lastMissPower: number;
  /** Global "heat" 0..1 used for bloom budget; eases with energy + recent hits. */
  heat: number;
}

const NEVER = -1e9;

const state: BoardState = {
  combo: 0,
  energy: 0,
  laneFlash: [
    { at: NEVER, power: 0 },
    { at: NEVER, power: 0 },
    { at: NEVER, power: 0 },
  ],
  lastMissAt: NEVER,
  lastMissPower: 0,
  heat: 0,
};

export function getBoardState(): Readonly<BoardState> {
  return state;
}

/** Effects layer calls this on `noteHit`. */
export function signalHit(lane: LaneIndex, combo: number, now: number): void {
  state.combo = combo;
  const f = state.laneFlash[lane] ?? state.laneFlash[1];
  f.at = now;
  f.power = 1;
}

/** Effects layer calls this on `noteMiss`. */
export function signalMiss(power: number, now: number): void {
  state.combo = 0;
  state.lastMissAt = now;
  state.lastMissPower = power < 0 ? 0 : power > 1 ? 1 : power;
}

/** Effects layer calls this on `comboChange` (covers non-hit decrements too). */
export function signalCombo(value: number): void {
  state.combo = value < 0 ? 0 : value;
}

/** Effects layer calls this on gameStart / menuShown / gameOver. */
export function resetBoardState(): void {
  state.combo = 0;
  state.energy = 0;
  state.heat = 0;
  state.lastMissAt = NEVER;
  state.lastMissPower = 0;
  for (const f of state.laneFlash) {
    f.at = NEVER;
    f.power = 0;
  }
}

/**
 * Per-frame easing toward the current combo, called once from the Renderer.
 * Keeps the smoothing single-sourced so escalation visuals stay in lockstep.
 * `dt` is seconds; safe to call with the Renderer's own clamped delta.
 */
export function tickBoardState(dt: number): void {
  const d = dt > 0.1 ? 0.1 : dt > 0 ? dt : 1 / 60;
  // Map combo onto a 0..1 energy curve that saturates around a 24-combo run.
  const target = state.combo <= 0 ? 0 : Math.min(1, state.combo / 24);
  state.energy += (target - state.energy) * Math.min(1, d * 3.4);
  // Heat tracks energy but spikes on a fresh hit and bleeds off slowly.
  const heatTarget = Math.max(state.energy, target);
  state.heat += (heatTarget - state.heat) * Math.min(1, d * 2.2);
}

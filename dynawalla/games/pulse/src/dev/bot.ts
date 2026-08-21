/**
 * QA harness — NOT part of the game.
 *
 * Loaded only by the standalone dev entry behind `?bot=`, never by `mount()`. It
 * plays through the real input path (`run.input(lane, performance.now())`), so it
 * exercises exactly the code a thumb does, including the clock conversion and the
 * judgment windows. Nothing here bypasses a gate, forces a grade, or reaches into
 * game state to award a point.
 *
 * `skill` in [0,1] shapes how hard it plays: timing jitter, how often it lets a note
 * go, and how often it takes the wrong fraction. Turning it down is how you look at
 * the failure states without having to fail on purpose.
 */

import type { Run } from "../game/run.ts";

export type BotOptions = {
  /** 0 = sloppy beginner, 1 = machine. */
  skill?: number;
  /** Extra constant offset in ms, to test the auto-calibrator. */
  biasMs?: number;
};

export type Bot = {
  stop(): void;
  /** One decision pass. Public so a busy-loop burst can drive it without rAF. */
  tick(): void;
  readonly stats: { pressed: number; skipped: number; wrong: number };
};

export function attachBot(run: Run, opts: BotOptions = {}): Bot {
  const skill = Math.max(0, Math.min(1, opts.skill ?? 0.9));
  const bias = opts.biasMs ?? 0;
  const jitterMs = 12 + (1 - skill) * 90;
  const skipRate = (1 - skill) * 0.3;
  const wrongGateRate = (1 - skill) * 0.55;
  const stats = { pressed: 0, skipped: 0, wrong: 0 };
  const decided = new Map<number, { at: number; lane: number } | null>();
  let alive = true;

  const tick = (): void => {
    if (!run.running) return;
    const heard = run.heard();

    for (const n of run.notes.all()) {
      if (n.judged !== null) continue;
      if (n.time - heard > 0.35) continue;
      let plan = decided.get(n.id);
      if (plan === undefined) {
        if (n.gate) {
          // Only ever decide once per gate, and only among live candidates.
          const wrong = Math.random() < wrongGateRate;
          const want = wrong ? !n.gate.correct : n.gate.correct;
          plan = want
            ? { at: n.time + ((Math.random() * 2 - 1) * jitterMs + bias) / 1000, lane: n.lane }
            : null;
          if (want && wrong) stats.wrong++;
        } else if (Math.random() < skipRate) {
          plan = null;
        } else {
          plan = { at: n.time + ((Math.random() * 2 - 1) * jitterMs + bias) / 1000, lane: n.lane };
        }
        decided.set(n.id, plan);
        if (decided.size > 400) decided.clear();
      }
      if (plan === null) {
        stats.skipped++;
        continue;
      }
      if (heard >= plan.at) {
        // Convert the intended audio moment back into the input clock the game reads.
        run.input(plan.lane, performance.now());
        stats.pressed++;
        decided.set(n.id, null);
      }
    }
  };
  const loop = (): void => {
    if (!alive) return;
    requestAnimationFrame(loop);
    tick();
  };
  requestAnimationFrame(loop);

  return {
    stop() {
      alive = false;
    },
    tick,
    stats,
  };
}

type Driver = { drive(on: boolean): void; step(ms: number): void };

/**
 * Run the real loop at a real frame rate for `ms`, without `requestAnimationFrame`.
 *
 * A throttled background tab hands out one rAF every couple of seconds, which is
 * useless for both playing and measuring. A synchronous busy loop calling the game's
 * own `step()` runs the identical code path against the identical (real) audio clock,
 * so what you screenshot afterwards is a genuine frame of a genuine run.
 *
 * `syncEveryFrame` reads one pixel back after each frame, which forces the canvas to
 * actually rasterise; without it the timing measures only the JS that records the
 * draw calls, and reports a number two or three times better than the truth.
 */
export function burst(
  driver: Driver,
  bot: Bot | null,
  ms: number,
  opts: { targetHz?: number; syncEveryFrame?: boolean; canvas?: HTMLCanvasElement } = {},
): { frames: number; meanMs: number; p95Ms: number; maxMs: number; wallMs: number } {
  const hz = opts.targetHz ?? 60;
  const budget = 1000 / hz;
  const sctx = opts.syncEveryFrame && opts.canvas ? opts.canvas.getContext("2d") : null;
  const samples: number[] = [];
  driver.drive(true);
  const t0 = performance.now();
  let last = t0;
  let frames = 0;
  while (performance.now() - t0 < ms) {
    const now = performance.now();
    const dt = now - last;
    if (dt < budget) continue; // busy-wait: setTimeout is clamped in a hidden tab
    last = now;
    const a = performance.now();
    driver.step(dt);
    bot?.tick();
    if (sctx) sctx.getImageData(0, 0, 1, 1);
    samples.push(performance.now() - a);
    frames++;
  }
  const wallMs = performance.now() - t0;
  samples.sort((x, y) => x - y);
  return {
    frames,
    meanMs: samples.reduce((x, y) => x + y, 0) / Math.max(1, samples.length),
    p95Ms: samples[Math.floor(samples.length * 0.95)] ?? 0,
    maxMs: samples[samples.length - 1] ?? 0,
    wallMs,
  };
}

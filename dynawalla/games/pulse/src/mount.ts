/**
 * `mount(el, host)` — the whole game, in one DOM element.
 *
 * Owns the frame loop, the title/pause states, the two corner buttons and the wiring
 * from `Run`'s events to the juice layer. Everything above this file is pure game or
 * pure drawing; everything below is the browser.
 */

import {
  createInstructions,
  onInsetsChange,
} from "../../../packs/shared/game-chrome/index.ts";
import type { Host, Mounted } from "./contract.ts";
import { Run, type Fx } from "./game/run.ts";
import { bindInput } from "./input.ts";
import { createSurfaces } from "./render/canvas.ts";
import { drawButtons, drawPause, drawPerf, drawTitle, hitButton } from "./render/chrome.ts";
import { gateFitFor } from "./render/layout.ts";
import { Scene } from "./render/scene.ts";
import { loadSettings, prefersReducedMotion, saveSettings } from "./settings.ts";

const CSS = `
.pulse-root{position:relative;width:100%;height:100%;min-height:320px;background:#04050a;
overflow:hidden;touch-action:none;user-select:none;-webkit-user-select:none;
-webkit-tap-highlight-color:transparent;color-scheme:dark;contain:layout paint size;}
.pulse-canvas{position:absolute;inset:0;display:block;width:100%;height:100%;}
`;

function injectCss(): void {
  if (document.getElementById("pulse-style")) return;
  const s = document.createElement("style");
  s.id = "pulse-style";
  s.textContent = CSS;
  document.head.appendChild(s);
}

type Phase = "title" | "playing" | "paused";

export type MountOptions = {
  /**
   * Automation only. A headless harness runs in a tab Chrome reports as hidden even
   * while it renders at 60 Hz, and the auto-pause would stop the run under it.
   */
  ignoreVisibility?: boolean;
  /** Start partway up the escalation instead of at quarter notes. */
  startStage?: number;
};

export function mount(el: HTMLElement, host: Host, options: MountOptions = {}): Mounted {
  injectCss();
  el.classList.add("pulse-root");

  const settings = loadSettings();
  const surfaces = createSurfaces(el);
  const lowPower =
    Math.min(window.innerWidth, window.innerHeight) < 520 ||
    (navigator.hardwareConcurrency ?? 8) <= 4;

  const scene = new Scene(surfaces, {
    reducedMotion: () => host.prefersReducedMotion() || prefersReducedMotion(),
    lowPower,
  });

  /**
   * How to play. A timing game has to say what its window is: a child who taps
   * a beat early, sees nothing happen and is told nothing decides the game is
   * broken rather than that they were early. The manual stays reachable during
   * play, because the moment a child needs the rules is never the title screen.
   */
  const guide = createInstructions(el, {
    title: "PULSE",
    summary: [
      "Notes slide toward the bright line. Tap the lane when a note touches the line.",
      "Tap on the beat — not early, not late.",
    ],
    sections: [
      {
        heading: "Tapping",
        lines: [
          "Tap anywhere inside a note's lane. You do not have to hit the note itself.",
          "Tap when the note is sitting on the bright line.",
          "A little early or a little late still counts. Right on the line gives you PERFECT.",
          "If nothing happens when you tap, the note was still too far from the line. Wait for it.",
          "On a keyboard: F, G and H, or J, K and L, or the arrow keys.",
        ],
      },
      {
        heading: "The bar",
        lines: [
          "The space between the line and the far edge is one whole bar of music.",
          "So a note halfway across is at one half, and it reaches the line halfway through the bar.",
          "Where a note sits and what it is worth are the same thing.",
        ],
      },
      {
        heading: "Questions",
        lines: [
          "Sometimes a sum appears at the top, like 1/2 + 1/4.",
          "Several answers ride toward the line together. Each one sits at the place that matches its own value.",
          "Tap the lane when the right answer reaches the line. Your timing is your answer.",
        ],
      },
      {
        heading: "Keeping going",
        lines: [
          "The little bar under your score is your health. Missed notes and wrong answers make it shrink.",
          "Hits in a row build a combo, and a big combo makes every note worth more.",
          "The music keeps splitting into smaller pieces as you go: quarters, then eighths, then triplets.",
        ],
      },
    ],
    reducedMotion: host.prefersReducedMotion() || prefersReducedMotion(),
  });

  const fx: Fx = {
    hit(note, judgment, delta, combo) {
      scene.hitBurst(note, judgment, combo, run.stage.lanes, run.nowBeat());
      host.haptic(judgment === "perfect" ? "medium" : "light");
      void delta;
    },
    miss(note) {
      scene.missPulse(note, run.stage.lanes, run.nowBeat());
    },
    stray(lane) {
      scene.strayPulse(lane);
    },
    gateOpen(g) {
      scene.gateOpen(g);
    },
    gateResolved(outcome, note, g) {
      scene.gateResolved(outcome, note, g, run.stage.lanes, run.nowBeat());
    },
    bar(bar) {
      scene.onBar(bar);
    },
    stageChanged(stage, index) {
      scene.stageCardShow(stage, index);
      // The lane count changes with the stage, which changes the field, which
      // changes what a bar is worth in pixels. Re-fit rather than resize.
      relayout();
    },
    drop() {
      scene.dropFlash();
      host.haptic("heavy");
    },
    stumble() {
      scene.stumbleShow();
    },
    overdrive(on) {
      scene.overdriveSet(on);
    },
    layerEarned(layer) {
      scene.layerBanner(layer);
    },
  };

  const run = new Run({
    host,
    fx,
    startStage: options.startStage,
    calibrationMs: settings.calibrationMs,
    onCalibrationChange(ms) {
      settings.calibrationMs = ms;
      saveSettings(settings);
    },
  });
  run.engine.setMuted(settings.muted);

  let phase: Phase = "title";
  let titleT = 0;
  let pauseK = 0;
  let showPerf = new URLSearchParams(location.search).has("perf");
  let raf = 0;
  let last = performance.now();
  const frameTimes: number[] = [];
  let fps = 60;
  let fpsAccum = 0;
  let fpsFrames = 0;

  const startPlaying = (): void => {
    if (phase !== "title") return;
    phase = "playing";
    run.start();
  };

  const setPaused = (p: boolean): void => {
    if (phase === "title") return;
    if (p && phase === "playing") {
      phase = "paused";
      void run.engine.ctx.suspend();
    } else if (!p && phase === "paused") {
      phase = "playing";
      void run.engine.ctx.resume();
    }
  };

  const input = bindInput(
    surfaces.main,
    () => scene.layout,
    () => run.stage.lanes,
    {
      hit(lane, perfMs) {
        // The rules panel is modal: keys typed while it is open belong to it.
        if (guide.isOpen) return;
        if (phase === "title") {
          startPlaying();
          return;
        }
        if (phase === "paused") {
          setPaused(false);
          return;
        }
        run.input(lane, perfMs);
      },
      tap(x, y) {
        const b = hitButton(x, y, scene.layout.area, scene.layout.compact, surfaces.h);
        if (!b) return false;
        if (b === "mute") {
          settings.muted = !settings.muted;
          run.engine.setMuted(settings.muted);
          saveSettings(settings);
        } else {
          if (phase === "title") startPlaying();
          else setPaused(phase === "playing");
        }
        return true;
      },
      pause() {
        if (guide.isOpen) return;
        if (phase === "title") startPlaying();
        else setPaused(phase === "playing");
      },
      togglePerf() {
        showPerf = !showPerf;
      },
    },
  );

  const onVisibility = (): void => {
    if (document.hidden && !options.ignoreVisibility) setPaused(true);
  };
  document.addEventListener("visibilitychange", onVisibility);

  /**
   * Re-lay the field AND tell the run what the new frame can hold.
   *
   * These two must not come apart. `gateFitFor` is the only thing that knows
   * both how wide a bar is in pixels and how wide a candidate is, and a gate is
   * built from whatever the run last heard — so a rotation that relaid the
   * playfield without re-fitting the gate would go on spacing candidates for
   * the old screen. Every path that resizes goes through here.
   */
  const relayout = (): void => {
    scene.resize(run.stage.lanes);
    run.setGateFit(gateFitFor(scene.layout));
  };

  const ro = new ResizeObserver(() => {
    if (surfaces.resize()) relayout();
  });
  ro.observe(el);

  /**
   * The insets change more often than "never": a rotation swaps the notch for
   * the home indicator, and iPadOS changes them when the pack is resized in
   * Split View. The canvas size may not change at all across some of those, so
   * `ResizeObserver` alone would leave the field laid out against stale numbers.
   */
  const stopInsets = onInsetsChange(relayout);
  window.addEventListener("resize", onWindowResize);
  function onWindowResize(): void {
    if (surfaces.resize()) relayout();
  }

  relayout();

  /**
   * When a harness drives the loop itself, `requestAnimationFrame` stops touching the
   * game. A browser that throttles rAF (a background tab) would otherwise interleave
   * one enormous frame into the middle of a measured burst.
   */
  let externalDriver = false;

  /**
   * The `requestAnimationFrame` timestamp of the frame being drawn, or null
   * when a harness is driving the loop by hand — in which case nothing is being
   * presented and there is no display latency to compensate.
   */
  let vsyncMs: number | null = null;

  const step = (raw: number): void => {
    const dt = Math.min(0.05, Math.max(0, raw / 1000));

    frameTimes.push(raw);
    if (frameTimes.length > 180) frameTimes.shift();
    fpsAccum += raw;
    fpsFrames++;
    if (fpsAccum >= 500) {
      fps = (fpsFrames * 1000) / fpsAccum;
      fpsAccum = 0;
      fpsFrames = 0;
    }

    // `visibilitychange` only fires on a *change*; a tab that was already in the
    // background when the game mounted never gets one, and then plays on unwatched.
    if (document.hidden && phase === "playing" && !options.ignoreVisibility) setPaused(true);

    // Reading the rules must not cost health. The panel is modal, so treat it
    // exactly like a tab switch.
    if (guide.isOpen && phase === "playing") setPaused(true);

    if (surfaces.resize()) relayout();
    if (scene.layout.laneCount !== run.stage.lanes) relayout();

    /**
     * Point the picture at the moment it will actually be SEEN.
     *
     * `vsyncMs` is the timestamp `requestAnimationFrame` handed us: the start of
     * the frame being composed. What we paint from here lands on the glass at
     * the next one, so the music the playfield should be showing is the music of
     * `vsync + one frame`, not the music of the instant we happen to read the
     * audio clock — which is later still, since this callback has been running
     * for a while by now.
     *
     * Compensating audio latency and not this is what made the game agree with
     * itself on a fast machine and not on a slow one: on a 60 Hz display it is
     * ~16 ms of lag and on a Chromebook dropping to 30 fps it is ~33 ms, and
     * neither of them was anywhere in the model. The frame period is measured
     * rather than assumed, so a 120 Hz iPad gets its own answer, and it is
     * clamped so one stalled frame cannot fling the field forward.
     */
    const periodMs = Math.min(34, Math.max(6, raw || 16.7));
    const leadMs = vsyncMs === null ? 0 : vsyncMs + periodMs - performance.now();
    run.visualLeadSec = Math.max(0, Math.min(0.05, leadMs / 1000));

    run.engine.sample();
    const { ctx, w, h } = surfaces;

    if (phase === "title") {
      titleT += dt;
      ctx.setTransform(surfaces.dpr, 0, 0, surfaces.dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#04050a";
      ctx.fillRect(0, 0, w, h);
      drawTitle(
        ctx,
        w,
        h,
        scene.layout.area,
        titleT,
        Math.max(settings.best, run.score),
        scene.layout.compact,
      );
    } else {
      if (phase === "playing") run.update();
      const drawMs = scene.draw(run, phase === "paused" ? 0 : dt);
      pauseK = phase === "paused" ? Math.min(1, pauseK + dt * 5) : Math.max(0, pauseK - dt * 6);
      if (pauseK > 0.002) drawPause(ctx, w, h, scene.layout.area, pauseK);
      if (run.score > settings.best) {
        settings.best = run.score;
        settings.bestCombo = Math.max(settings.bestCombo, run.bestCombo);
        if (run.bar % 4 === 0) saveSettings(settings);
      }
      if (showPerf) {
        const sorted = [...frameTimes].sort((a, b) => a - b);
        drawPerf(ctx, scene.layout.area, {
          fps,
          frameMs: frameTimes.reduce((a, b) => a + b, 0) / Math.max(1, frameTimes.length),
          p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
          drawMs,
          particles: scene.particles.count,
          notes: run.notes.all().length,
          latencyMs: run.engine.latency(),
          calibrationMs: run.calibrationMs,
          visualLeadMs: run.visualLeadSec * 1000,
          clockErrorMs: run.engine.clockError() * 1000,
        });
      }
    }

    ctx.globalCompositeOperation = "lighter";
    drawButtons(
      ctx,
      scene.layout.area,
      scene.layout.compact,
      surfaces.h,
      settings.muted,
      phase === "paused",
    );
  };

  const frame = (t: number): void => {
    raf = requestAnimationFrame(frame);
    const raw = t - last;
    last = t;
    if (externalDriver) return;
    vsyncMs = t;
    step(raw);
    vsyncMs = null;
  };
  raf = requestAnimationFrame(frame);

  // Debug seam for automated verification and for the perf overlay's numbers.
  (window as unknown as Record<string, unknown>).__PULSE__ = {
    run,
    scene,
    stats: () => ({ fps, particles: scene.particles.count, notes: run.notes.all().length }),
    start: startPlaying,
    press: (lane: number) => run.input(lane, performance.now()),
    /** Hand the loop to a harness. `step(ms)` then advances exactly one frame. */
    drive(on: boolean) {
      externalDriver = on;
      last = performance.now();
    },
    step,
  };

  return {
    unmount() {
      cancelAnimationFrame(raf);
      guide.destroy();
      stopInsets();
      input.dispose();
      ro.disconnect();
      window.removeEventListener("resize", onWindowResize);
      document.removeEventListener("visibilitychange", onVisibility);
      saveSettings(settings);
      run.dispose();
      surfaces.dispose();
      el.classList.remove("pulse-root");
      delete (window as unknown as Record<string, unknown>).__PULSE__;
    },
  };
}

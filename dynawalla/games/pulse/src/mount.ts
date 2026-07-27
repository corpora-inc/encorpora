/**
 * `mount(el, host)` — the whole game, in one DOM element.
 *
 * Owns the frame loop, the title/pause states, the two corner buttons and the wiring
 * from `Run`'s events to the juice layer. Everything above this file is pure game or
 * pure drawing; everything below is the browser.
 */

import type { Host, Mounted } from "./contract.ts";
import { Run, type Fx } from "./game/run.ts";
import { bindInput } from "./input.ts";
import { createSurfaces } from "./render/canvas.ts";
import { drawButtons, drawPause, drawPerf, drawTitle, hitButton } from "./render/chrome.ts";
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
      scene.resize(stage.lanes);
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
    el,
    () => scene.layout,
    () => run.stage.lanes,
    {
      hit(lane, perfMs) {
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
        const b = hitButton(x, y, surfaces.w, surfaces.h, scene.layout.compact);
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

  const ro = new ResizeObserver(() => {
    if (surfaces.resize()) scene.resize(run.stage.lanes);
  });
  ro.observe(el);
  window.addEventListener("resize", onWindowResize);
  function onWindowResize(): void {
    if (surfaces.resize()) scene.resize(run.stage.lanes);
  }

  scene.resize(run.stage.lanes);

  /**
   * When a harness drives the loop itself, `requestAnimationFrame` stops touching the
   * game. A browser that throttles rAF (a background tab) would otherwise interleave
   * one enormous frame into the middle of a measured burst.
   */
  let externalDriver = false;

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

    if (surfaces.resize()) scene.resize(run.stage.lanes);
    if (scene.layout.laneCount !== run.stage.lanes) scene.resize(run.stage.lanes);

    run.engine.sample();
    const { ctx, w, h } = surfaces;

    if (phase === "title") {
      titleT += dt;
      ctx.setTransform(surfaces.dpr, 0, 0, surfaces.dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#04050a";
      ctx.fillRect(0, 0, w, h);
      drawTitle(ctx, w, h, titleT, Math.max(settings.best, run.score), scene.layout.compact);
    } else {
      if (phase === "playing") run.update();
      const drawMs = scene.draw(run, phase === "paused" ? 0 : dt);
      pauseK = phase === "paused" ? Math.min(1, pauseK + dt * 5) : Math.max(0, pauseK - dt * 6);
      if (pauseK > 0.002) drawPause(ctx, w, h, pauseK);
      if (run.score > settings.best) {
        settings.best = run.score;
        settings.bestCombo = Math.max(settings.bestCombo, run.bestCombo);
        if (run.bar % 4 === 0) saveSettings(settings);
      }
      if (showPerf) {
        const sorted = [...frameTimes].sort((a, b) => a - b);
        drawPerf(ctx, w, {
          fps,
          frameMs: frameTimes.reduce((a, b) => a + b, 0) / Math.max(1, frameTimes.length),
          p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
          drawMs,
          particles: scene.particles.count,
          notes: run.notes.all().length,
          latencyMs: run.engine.latency(),
          calibrationMs: run.calibrationMs,
        });
      }
    }

    ctx.globalCompositeOperation = "lighter";
    drawButtons(ctx, w, h, scene.layout.compact, settings.muted, phase === "paused");
  };

  const frame = (t: number): void => {
    raf = requestAnimationFrame(frame);
    const raw = t - last;
    last = t;
    if (externalDriver) return;
    step(raw);
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

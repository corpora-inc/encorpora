/**
 * Wiring: canvas, loop, lifecycle.
 *
 * The simulation runs on a fixed 1/120s step with an accumulator so that
 * collision and turn rate are frame-rate independent; presentation runs on the
 * real clock so shake, bloom and slow-motion keep moving during hitstop — which
 * is the entire point of hitstop.
 */

import {
  createInstructions,
  onInsetsChange,
  safeInsets,
} from "../../../../packs/shared/game-chrome/index.ts";
import type { Host, Mounted } from "../contract.ts";
import { createAudio } from "./audio.ts";
import { createInput } from "./input.ts";
import { simDelta, updateCamera } from "./fx/camera.ts";
import { createRenderer, type View } from "./render/scene.ts";
import { hudLayout, soundTarget } from "./render/chrome.ts";
import { drawHud } from "./render/hud.ts";
import { confirmPressed, createWorld, setArenaAspect, setPaused, stepWorld, type World } from "./world.ts";
import { clamp } from "./num.ts";

const FIXED = 1 / 120;
const MAX_STEPS = 6;

export type SerpentHandle = Mounted & {
  /** Test and tooling seam. Not used by the game itself. */
  world: World;
  view: View;
  canvas: HTMLCanvasElement;
  fps(): number;
};

export function mountSerpent(el: HTMLElement, host: Host): SerpentHandle {
  const canvas = document.createElement("canvas");
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.touchAction = "none";
  canvas.style.background = "#01060c";
  el.appendChild(canvas);

  const reduced = host.prefersReducedMotion();
  const audio = createAudio();
  const renderer = createRenderer(canvas);
  const world = createWorld(host, audio, reduced);

  let lastTapX = 0;
  let lastTapY = 0;
  const onTap = (e: PointerEvent): void => {
    const rect = canvas.getBoundingClientRect();
    lastTapX = e.clientX - rect.left;
    lastTapY = e.clientY - rect.top;
  };
  canvas.addEventListener("pointerdown", onTap);

  const input = createInput(canvas, {
    toWorld: (x, y) => renderer.toWorld(x, y, canvas.getBoundingClientRect()),
    headAt: () => ({ x: world.serpent.x, y: world.serpent.y }),
  });

  function layout(): void {
    const rect = el.getBoundingClientRect();
    const w = Math.max(200, Math.round(rect.width || window.innerWidth));
    const h = Math.max(200, Math.round(rect.height || window.innerHeight));
    // Measured every layout, never cached from mount: a rotation trades one top
    // inset for two side ones, and iPadOS changes them when the pack is resized
    // in Split View. Read once and you are correct until the first rotation.
    renderer.resize(w, h, Math.min(window.devicePixelRatio || 1, 2.5), safeInsets());
    // The board IS the screen: the vent is the ellipse inscribed in that same
    // safe box. The renderer measures the box, the simulation takes the shape
    // from it, and neither owns a second copy of the arithmetic.
    setArenaAspect(world, renderer.view.safe.w, renderer.view.safe.h);
  }
  layout();
  // A rotation does not always change the element's box — a square-ish split
  // view can rotate and keep its size — but it always changes the insets.
  const stopInsets = onInsetsChange(() => layout());

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(el);
  window.addEventListener("resize", layout);
  window.addEventListener("orientationchange", layout);

  const onVisibility = (): void => {
    if (document.hidden) {
      if (world.phase === "play") setPaused(world, true);
      audio.ambient(false);
      audio.setBoost(false);
    } else {
      audio.ambient(world.phase !== "attract");
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  // --- frame timing
  let raf = 0;
  let last = 0;
  let acc = 0;
  const times: number[] = [];
  let fps = 60;
  let frameMs = 0;
  let worstMs = 0;
  let showDebug = false;
  let disposed = false;

  /**
   * Does this tap land on the sound switch?
   *
   * The switch's position comes from the same `hudLayout` the renderer draws it
   * with. This used to carry its own copy of the four expressions, which is one
   * copy too many — the drawn control and its target would have parted company
   * the moment either moved, and honouring the home indicator moves it.
   */
  function soundHit(x: number, y: number): boolean {
    const v = renderer.view;
    const t = soundTarget(hudLayout(v.w, v.h, v.insets));
    return x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h;
  }

  function frame(t: number): void {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const start = performance.now();
    if (last === 0) last = t;
    const rawDt = clamp((t - last) / 1000, 0, 0.05);
    last = t;

    if (input.takeMute()) audio.setEnabled(!audio.enabled);
    if (input.takeDebug()) showDebug = !showDebug;
    if (input.takePause() && world.phase === "play") setPaused(world, !world.paused);
    if (input.takeConfirm()) {
      if (soundHit(lastTapX, lastTapY)) {
        audio.setEnabled(!audio.enabled);
        if (audio.enabled) audio.ambient(world.phase !== "attract");
      } else if (world.paused) {
        setPaused(world, false);
      } else {
        audio.resume();
        confirmPressed(world);
      }
    }

    updateCamera(world.cam, rawDt);
    const sd = world.paused ? 0 : simDelta(world.cam, rawDt);
    acc += sd;
    let steps = 0;
    while (acc >= FIXED && steps < MAX_STEPS) {
      stepWorld(world, FIXED, { heading: input.heading, boost: input.boost });
      acc -= FIXED;
      steps++;
    }
    if (steps === MAX_STEPS) acc = 0;

    renderer.draw(world, 0);
    drawHud(canvas.getContext("2d") as CanvasRenderingContext2D, renderer.view, world, {
      pointer: input.pointer,
      usingTouch: input.usingTouch,
      soundOn: audio.enabled,
      showDebug,
      fps,
      frameMs,
      worstMs,
    });

    const cost = performance.now() - start;
    frameMs = frameMs * 0.9 + cost * 0.1;
    times.push(rawDt);
    if (times.length > 90) times.shift();
    if (times.length > 10) {
      const sum = times.reduce((a, b) => a + b, 0);
      fps = times.length / sum;
    }
    if (world.phase === "play" && world.runTime > 1.5) worstMs = Math.max(worstMs, cost);
  }
  raf = requestAnimationFrame(frame);

  /* ------------------------------ how to play ---------------------------- */

  // SERPENT taught nothing. A child was shown a snake, a field of numbers and
  // the words "TAP TO DIVE", and the one rule that IS the game — that the thing
  // written across the arena floor decides which numbers you may eat, and that
  // it changes — was never said anywhere. Watching a tail get shorter is not an
  // explanation. The manual stays reachable during a dive, because the moment a
  // child needs the rules is never the title screen.
  //
  // The water stops while it is up. It is the same pause the P key and the
  // host's sheet take, and it lifts only what it put on — a child who paused
  // the dive themselves, then opened the manual, must not find the snake
  // swimming again because they closed it.
  let heldForManual = false;
  const guide = createInstructions(el, {
    title: "SERPENT",
    summary: [
      "You are a sea snake. Numbers float in the water.",
      "A rule is written big across the middle. Eat only the numbers that follow it.",
    ],
    sections: [
      {
        heading: "Swimming",
        lines: [
          "Hold your finger on the screen and drag. The snake swims that way.",
          "Drag further from where you started and the snake goes faster.",
          "On a keyboard, use the arrow keys. Hold shift to go faster.",
        ],
      },
      {
        heading: "The rule in the middle",
        lines: [
          "It says which numbers you are allowed to eat.",
          "\u201C= 12\u201D means eat numbers that equal 12.",
          "\u201C> 5\u201D means eat numbers bigger than 5.",
          "\u201C< 5\u201D means eat numbers smaller than 5.",
          "\u201C6 \u00d7 ?\u201D means eat numbers you get by counting up in sixes: 6, 12, 18, 24.",
        ],
      },
      {
        heading: "The rule changes",
        lines: [
          "After a while the rule in the middle swaps to a new one.",
          "When it swaps, the numbers you were chasing may now be the wrong ones.",
          "Read it again every time it changes. That is the whole game.",
        ],
      },
      {
        heading: "Eating",
        lines: [
          "Eat a right number and your tail grows longer.",
          "Eat a wrong number and you cough up part of your tail.",
          "Eat several right ones in a row and the ring in the corner fills up. A full ring gives you a shield, and a shield saves you the next time you would die.",
        ],
      },
      {
        heading: "Staying alive",
        lines: [
          "Do not swim into your own tail.",
          "Do not push into the glowing edge of the water for long.",
          "The number in the top corner is your depth. It is how far down you have got, and it goes up one for every nine right numbers you eat.",
          "Deeper down, the water gets smaller and some numbers start chasing you.",
        ],
      },
    ],
    reducedMotion: reduced,
    onOpen: () => {
      if (world.paused) return;
      heldForManual = true;
      setPaused(world, true);
    },
    onClose: () => {
      if (!heldForManual) return;
      heldForManual = false;
      setPaused(world, false);
    },
  });

  return {
    world,
    view: renderer.view,
    canvas,
    fps: () => fps,
    unmount(): void {
      disposed = true;
      cancelAnimationFrame(raf);
      guide.destroy();
      stopInsets();
      ro?.disconnect();
      window.removeEventListener("resize", layout);
      window.removeEventListener("orientationchange", layout);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointerdown", onTap);
      input.dispose();
      audio.dispose();
      canvas.remove();
    },
  };
}

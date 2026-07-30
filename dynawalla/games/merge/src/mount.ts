import { createInstructions, safeRect } from "../../../packs/shared/game-chrome/index.ts";
import type { Host, FocusableHost } from "./contract.ts";
import { Game } from "./game.ts";
import { Renderer } from "./render.ts";
import { bindInput } from "./input.ts";
import { computeLayout, makeStage, type Layout } from "./layout.ts";

export type MountOptions = {
  seed?: string;
  debug?: boolean;
  /**
   * Playtest hook. Hands back the live game plus a manual stepper so a harness
   * can drive exact moments — a nine-chain, a breach, a resonance — instead of
   * hoping to stumble into them. Never used by the real host.
   */
  onReady?(probe: { game: Game; step(dtMs: number, frames?: number): void }): void;
};

/**
 * Mount FUSE into an element.
 *
 * One canvas, one RAF loop, no DOM churn per frame. The frame budget is
 * measured continuously and the particle budget follows it, so a slower tablet
 * loses sparks rather than frames.
 */
export function mount(el: HTMLElement, host: Host, opts: MountOptions = {}): { unmount(): void } {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none";
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "FUSE. Drop numbered chips into the well. Touching chips that add up to the key number fuse.",
  );
  // The computed position, not the inline one — see `makeStage`. This is the only
  // place the game asks the browser where the host has put it, and reading it off
  // `el.style` instead is what made a sibling game a black screen on two app
  // stores.
  makeStage(el, getComputedStyle(el).position);
  el.appendChild(canvas);

  // How to play, on the shared surface every Dynawalla game uses. Nobody can
  // play a game they have not been taught, and a child who is stuck will not go
  // looking for the rules — so the button stays there during the run, not only
  // before it.
  const guide = createInstructions(el, {
    title: "FUSE",
    summary: [
      "Drop number chips into the well. Chips that touch and add up to the KEY disappear.",
      "The KEY is the big number in the circle. It starts at 10.",
    ],
    sections: [
      {
        heading: "Dropping a chip",
        lines: [
          "Your next chip waits above the well.",
          "Put your finger anywhere on the screen and slide it left or right. The chip follows your finger.",
          "A faint chip shows you where it will land. Lift your finger and it drops.",
          "On a computer, move the mouse and click. Or use the left and right arrow keys, then the space bar.",
          "If you wait too long, the chip drops by itself.",
        ],
      },
      {
        heading: "Making chips fuse",
        lines: [
          "Say the KEY is 10. Land a 4 next to a 6. 4 + 6 = 10, so both chips disappear and you score.",
          "The chips have to be touching — side by side, or one straight above the other.",
          "Three chips work too. 2 + 3 + 5 = 10.",
          "When chips disappear, the chips above them fall down. If they land next to a new partner they fuse again. Lots of fuses in a row is a chain, and a chain is worth more.",
          "The KEY gets bigger as you go: 10, 12, 15, 20, 24, 25, 30, 40, 50, 60, 75, 100.",
        ],
      },
      {
        heading: "Chips that show a sum",
        lines: [
          "After a while a chip shows something like 15 − 8 instead of 7.",
          "Work it out. 15 − 8 = 7, so that chip is a 7, and a 7 still fuses with a 3.",
        ],
      },
      {
        heading: "The well keeps rising",
        lines: [
          "Every few drops, a new row is pushed in at the bottom and everything moves up.",
          "If chips reach the top row, the run is over.",
          "So fuse chips quickly. Every fuse takes chips out of the well.",
        ],
      },
      {
        heading: "The big question",
        lines: [
          "Every fuse charges the circle. After eight fuses it turns green and pulses.",
          "Tap the circle. Time slows right down and one question appears.",
          "Now every chip on the board is an answer button. Tap a chip with the right answer on it.",
          "Right answer: every chip with that number blows up, and so do the chips next to them.",
          "Wrong answer, or too slow, and nothing blows up. You have to fuse eight more times to charge the circle again.",
          "If you never tap it, the circle asks you the question by itself.",
        ],
      },
      {
        heading: "One rescue",
        lines: [
          "When the well fills right up, you get one question to save the run. Only one, and only once.",
          "Get it right and a big piece of the board is cleared away.",
          "Get it wrong and the run is over.",
        ],
      },
      {
        heading: "Sound",
        lines: ["Tap the speaker button to turn the sound off and on."],
      },
    ],
    reducedMotion: host.prefersReducedMotion(),
  });

  const g = canvas.getContext("2d", { alpha: false }) as CanvasRenderingContext2D;
  const game = new Game(host as FocusableHost, opts.seed);
  const renderer = new Renderer();
  renderer.debug = !!opts.debug;

  let layout: Layout | null = null;
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  const frameTimes: number[] = [];

  /** Said once. A collapsed stage would otherwise say it on every resize. */
  let saidCollapsed = false;
  const resize = () => {
    // `el.clientHeight || window.innerHeight` was here, and the `||` is one of the
    // two accidents that kept this game alive while `makeStage`'s predecessor was
    // collapsing its stage to 820x0: a stage with no box quietly rendered at
    // window size, so an honest measurement was never available to anybody. Now
    // the measurement is honest and a missing stage is said out loud instead.
    if (!saidCollapsed && (el.clientWidth < 2 || el.clientHeight < 2)) {
      saidCollapsed = true;
      console.error(
        `[fuse] the stage measures ${String(el.clientWidth)}x${String(el.clientHeight)}. ` +
          `The canvas is position:absolute inside it, so nothing this game draws has a size. ` +
          `The host's element needs a box of its own — see makeStage in layout.ts.`,
      );
    }
    const w = Math.max(1, el.clientWidth);
    const h = Math.max(1, el.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    layout = computeLayout(w, h, dpr, safeRect(w, h));
    game.layout = layout;
    renderer.resize(layout);
  };
  resize();

  const ro = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
  ro?.observe(el);
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);

  const onVis = () => {
    game.paused = document.hidden;
    if (!document.hidden) last = performance.now();
  };
  document.addEventListener("visibilitychange", onVis);

  const motionQuery =
    typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  const onMotion = () => {
    game.cam.reduced = host.prefersReducedMotion();
  };
  motionQuery?.addEventListener?.("change", onMotion);

  const input = bindInput(canvas, game, () => layout, () => guide.isOpen);

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1; // a backgrounded tab must not teleport the well

    // Reading the rules is not playing. A child who opens the manual is a child
    // who is stuck, and FUSE has three ways to punish them for looking: the
    // held chip drops itself after `fuseTime`, the well rises under it, and a
    // charged reactor asks a question by itself and reports a miss to the host
    // when nobody answers — a wrong answer in the learner model for a question
    // that was never on screen. So the simulation stops and only the picture
    // keeps being drawn.
    if (guide.isOpen) {
      if (layout) renderer.draw(g, game, layout, now / 1000);
      return;
    }

    frameTimes.push(dt);
    if (frameTimes.length > 45) frameTimes.shift();
    acc += dt;
    if (acc > 0.35 && frameTimes.length > 10) {
      acc = 0;
      const mean = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      game.fps = 1 / Math.max(0.0005, mean);
      // Spend the budget on sparks only while there is budget to spend.
      game.parts.budget = game.fps < 42 ? 0.35 : game.fps < 52 ? 0.65 : 1;
      if (game.cam.reduced) game.parts.budget = Math.min(game.parts.budget, 0.25);
    }

    game.update(dt, now);
    if (layout) renderer.draw(g, game, layout, now / 1000);
  };
  raf = requestAnimationFrame(loop);

  opts.onReady?.({
    game,
    step(dtMs: number, frames = 1) {
      const wasPaused = game.paused;
      game.paused = false;
      for (let i = 0; i < frames; i++) {
        const t = performance.now();
        game.update(dtMs / 1000, t);
        if (layout) renderer.draw(g, game, layout, t / 1000);
      }
      game.paused = wasPaused;
    },
  });

  return {
    unmount() {
      guide.destroy();
      cancelAnimationFrame(raf);
      input.dispose();
      ro?.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      document.removeEventListener("visibilitychange", onVis);
      motionQuery?.removeEventListener?.("change", onMotion);
      canvas.remove();
    },
  };
}

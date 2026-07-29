/**
 * The glue: loop, input, and the translation of simulation events into juice.
 *
 * The whole feel of the game is the table in `applyEvent`. Numbers there are in
 * seconds and unitless trauma, and they were tuned by playing, not by theory:
 *
 *   break        28 ms hitstop, trauma 0.12 (+combo), zoom punch, 10-15 shards
 *   star         70 ms hitstop, trauma 0.30, a 260-unit ring
 *   wave clear  220 ms hitstop, 0.28× time for 1.4 s, the window detonates
 *   ball lost   150 ms hitstop, 0.35× time for 0.45 s, a soft falling tone
 *
 * Hitstop survives reduced motion (it is information: something was hit).
 * Shake, punch and roll do not. Flashes are budgeted by `Camera`.
 */
import {
  createInstructions,
  onInsetsChange,
  safeRect,
} from "../../../packs/shared/game-chrome/index.ts";
import type { GameHandle, Host } from "./contract.ts";
import { Audio } from "./audio/audio.ts";
import { Camera, clamp01, lerp } from "./fx/camera.ts";
import { Particles } from "./fx/particles.ts";
import { Renderer } from "./fx/render.ts";
import { JEWELS, DANGER, CHARGE_HOT, BALL_GLOW, POWER_LOOK } from "./fx/palette.ts";
import { chooseShard, forgeShardAt, openForge, stepForge } from "./game/forge.ts";
import {
  createSim,
  fireLaser,
  launch,
  resize as resizeSim,
  restart,
  step as simStep,
  tileX,
  tileY,
} from "./game/sim.ts";
import type { SimEvent } from "./game/state.ts";
import { VW } from "./game/state.ts";
import type { Tile } from "./game/wall.ts";

const FIXED = 1 / 120;
const MAX_STEPS = 5;

type Crumble = { tile: Tile; delay: number };

export function mount(el: HTMLElement, host: Host): GameHandle {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;outline:none";
  canvas.tabIndex = 0;
  el.appendChild(canvas);

  const renderer = new Renderer(canvas);
  const cam = new Camera();
  const particles = new Particles(VW);
  const audio = new Audio();
  const reduced = host.prefersReducedMotion();
  cam.reduced = reduced;
  particles.density = reduced ? 0.34 : 1;

  const seed = (Date.now() ^ 0x5eed1e) >>> 0;
  const w0 = el.clientWidth || 360;
  const h0 = el.clientHeight || 640;
  let vh = renderer.resize(w0, h0, safeRect(w0, h0));
  const sim = createSim(seed, vh);

  // How to play. MOSAIC's whole instruction set used to be the two or three
  // characters on the plate at the top: nothing told a child that stone tiles
  // are meant to bounce, that a chain sets the ball alight, or that the glowing
  // paddle is a question waiting to be asked. The manual stays reachable during
  // play, because the moment a child needs the rules is never the title screen.
  const guide = createInstructions(el, {
    title: "MOSAIC",
    summary: [
      "Slide your finger to move the paddle. Bounce the ball up into the glass.",
      "The sign at the top says which tiles to break.",
    ],
    sections: [
      {
        heading: "Moving",
        lines: [
          "Slide your finger anywhere on the lower part of the screen. The paddle follows it.",
          "The ball waits on the paddle. Tap once to send it up.",
          "On a keyboard: left and right arrow keys move, space sends the ball.",
        ],
      },
      {
        heading: "The sign at the top",
        lines: [
          "× 6 means break every tile that is a multiple of 6, like 6, 12, 18 and 24.",
          "24 ÷ ▪ means break every tile that goes into 24 with nothing left over, like 3, 4 and 8.",
          "= 12 means break every tile worth 12. It can also say = 1/2 or = 50%. Those two are the same amount.",
          "> 40 means break every tile bigger than 40. < 40 means smaller than 40.",
          "Tiles that do not match the rule are stone. The ball bounces off them and nothing bad happens.",
        ],
      },
      {
        heading: "Chains",
        lines: [
          "Break one tile after another without missing and your chain grows.",
          "A long chain makes the ball hot. A hot ball burns straight through tiles instead of bouncing off them.",
        ],
      },
      {
        heading: "The forge",
        lines: [
          "Every 8 tiles you break, the paddle starts to glow.",
          "Tap once while it glows. Time slows down and four glass shapes float up with a question above them.",
          "Each shape holds an answer and a prize. Tap the one with the right answer to win its prize: a wider paddle, a laser, extra balls, or a slower ball.",
          "A wrong answer only costs the glow. You do not lose a ball.",
        ],
      },
      {
        heading: "Staying in",
        lines: [
          "The dots at the bottom are the balls you have left. You lose one when the ball goes past the paddle.",
          "The wall slides down while you play, so keep breaking.",
        ],
      },
    ],
    reducedMotion: reduced,
  });

  const hud = { chargePulse: 0, dangerPulse: 0, clearFlash: 0, waveIntro: 0 };
  const events: SimEvent[] = [];
  const crumbles: Crumble[] = [];
  let crumbleT = 0;
  let waveT = 0;
  let lastHaptic = 0;
  let lastDanger = 0;
  let slowUntil = 0;
  let running = true;
  let paused = false;
  let raf = 0;
  let last = performance.now();
  let acc = 0;
  let forgeRngSeed = seed;

  // Keyboard paddle velocity, so arrow keys feel like a physical control.
  let keyLeft = false;
  let keyRight = false;
  let keyVel = 0;
  let pointerTargetX: number | null = null;

  const fpsWindow: number[] = [];
  const debug = { fps: 0, particles: 0, frameMs: 0 };
  // Dev-only inspection surface. Nothing in the game reads it; the standalone
  // harness (`dev.ts`) uses it to drive a bot, jump waves and benchmark.
  (globalThis as unknown as { __mosaic?: unknown }).__mosaic = {
    sim,
    debug,
    cam,
    renderer,
    particles,
    hud,
    audio,
    /** Run exactly one frame. Only the standalone harness calls this. */
    tick: (dt: number) => tick(dt),
  };

  // -- sizing ---------------------------------------------------------------

  const doResize = () => {
    const w = el.clientWidth || canvas.clientWidth || 360;
    const h = el.clientHeight || canvas.clientHeight || 640;
    vh = renderer.resize(w, h, safeRect(w, h));
    resizeSim(sim, vh);
  };
  const ro = new ResizeObserver(doResize);
  ro.observe(el);
  // The insets are not a constant: rotation swaps top and bottom for left and
  // right, and iPadOS changes them when the pack is resized in Split View. A
  // ResizeObserver alone misses the case where only the insets moved.
  const stopInsets = onInsetsChange(doResize);
  doResize();

  // -- input ----------------------------------------------------------------

  const virt = (e: PointerEvent | MouseEvent) => renderer.toVirtual(e.clientX, e.clientY, canvas.getBoundingClientRect());

  /** One tap, one meaning: use the best thing available right now. */
  const act = (vx: number, vy: number) => {
    audio.start();
    if (sim.phase === "gameover") {
      restart(sim, (sim.seed * 1103515245 + 12345) >>> 0);
      particles.clearAll();
      crumbles.length = 0;
      waveT = 0;
      cam.timeScaleTarget = 1;
      return;
    }
    if (sim.forge) {
      const i = forgeShardAt(sim.forge, vx, vy);
      if (i >= 0) resolveForge(i);
      return;
    }
    if (sim.phase === "serve") {
      launch(sim);
      audio.paddle(0);
      particles.cone(sim.paddleX, sim.paddleY - 24, 14, BALL_GLOW, 0, -1, 1.1);
      cam.addTrauma(0.08);
      host.haptic("light");
      return;
    }
    if (sim.charge >= sim.chargeMax) {
      forgeRngSeed = (forgeRngSeed * 1664525 + 1013904223) >>> 0;
      openForge(sim, host, forgeRngSeed);
      if (sim.forge) {
        cam.timeScaleTarget = 0.12;
        audio.setSlowed(true);
        audio.forgeOpen();
        cam.requestFlash(0.1, [200, 200, 255]);
        host.haptic("medium");
      }
      return;
    }
    if (sim.powers.laserShots > 0) fireLaser(sim, events);
  };

  const resolveForge = (i: number) => {
    const r = chooseShard(sim, host, i, events);
    if (r === "right") {
      cam.stop(0.14);
      cam.addTrauma(0.4);
      cam.punch(3);
      cam.requestFlash(0.22);
      audio.forgeRight();
      host.haptic("success");
      const s = sim.forge?.shards[i];
      if (s) {
        particles.burst(s.x, s.y, 46, POWER_LOOK[s.power]!.glow, 620, 0.75, 16);
        particles.ring(s.x, s.y, 24, 300, "#fff6e4", 0.6, 6);
      }
    } else if (r === "wrong") {
      cam.stop(0.07);
      cam.addTrauma(0.22);
      audio.forgeWrong();
      host.haptic("failure");
      const s = sim.forge?.shards[i];
      if (s) particles.burst(s.x, s.y, 22, "#6a6a86", 300, 0.6, 10);
    }
  };

  const onPointerDown = (e: PointerEvent) => {
    canvas.setPointerCapture?.(e.pointerId);
    const v = virt(e);
    downX = e.clientX;
    downY = e.clientY;
    downT = performance.now();
    moved = false;
    if (v.y > vh * 0.18) pointerTargetX = v.x;
    if (sim.forge) {
      const i = forgeShardAt(sim.forge, v.x, v.y);
      if (i >= 0) {
        act(v.x, v.y);
        moved = true; // consumed
      }
    }
    canvas.focus?.();
  };
  let downX = 0;
  let downY = 0;
  let downT = 0;
  let moved = false;

  const onPointerMove = (e: PointerEvent) => {
    const v = virt(e);
    if (e.pressure > 0 || e.buttons > 0 || e.pointerType === "mouse") {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 12) moved = true;
      if (e.pointerType === "mouse" && e.buttons === 0) {
        // Hover control on desktop: 1:1, no smoothing, no lag.
        pointerTargetX = v.x;
        sim.paddleX = v.x;
      } else if (v.y > vh * 0.18) {
        pointerTargetX = v.x;
      }
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    const v = virt(e);
    const quick = performance.now() - downT < 400;
    if (!moved && quick) act(v.x, v.y);
    pointerTargetX = null;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keyLeft = true;
    else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keyRight = true;
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      act(sim.paddleX, sim.vh * 0.5);
    } else if (e.key === "f" || e.key === "F") {
      audio.start();
      if (sim.powers.laserShots > 0) fireLaser(sim, events);
    } else if (e.key === "m" || e.key === "M") {
      audio.setMuted(audio.enabled);
    } else if (e.key >= "1" && e.key <= "4") {
      if (sim.forge) resolveForge(Number(e.key) - 1);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keyLeft = false;
    else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keyRight = false;
  };

  const onVisibility = () => {
    if ((globalThis as unknown as { __mosaicNoPause?: boolean }).__mosaicNoPause) return;
    paused = document.hidden;
    if (paused) audio.suspend();
    else {
      audio.resume();
      last = performance.now();
    }
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  globalThis.addEventListener("keydown", onKeyDown);
  globalThis.addEventListener("keyup", onKeyUp);
  document.addEventListener("visibilitychange", onVisibility);

  // -- juice ----------------------------------------------------------------

  const buzz = (kind: "light" | "medium" | "heavy" | "success" | "failure") => {
    const now = performance.now();
    if (kind === "light" && now - lastHaptic < 70) return;
    if (now - lastHaptic < 26) return;
    lastHaptic = now;
    host.haptic(kind);
  };

  function applyEvent(e: SimEvent): void {
    switch (e.t) {
      case "paddle": {
        audio.paddle(e.offset);
        particles.cone(e.x, e.y, 9, BALL_GLOW, e.offset, -1, 1.0);
        cam.addTrauma(0.055);
        cam.stop(0.012);
        buzz("light");
        break;
      }
      case "wallbounce": {
        audio.wall();
        particles.cone(e.x, e.y, 5, "#b9c6ff", e.nx, e.ny, 1.4);
        cam.addTrauma(0.03);
        break;
      }
      case "masonry": {
        audio.clunk();
        cam.addTrauma(0.085);
        cam.stop(0.022);
        particles.cone(e.x, e.y, 7, "#8b86b8", -0.0, -0.4, 2.4);
        buzz("light");
        break;
      }
      case "erode": {
        audio.crumble();
        cam.addTrauma(0.13);
        cam.stop(0.03);
        // Grey, not jewelled: the stone gives nothing back.
        particles.shatter(e.x, e.y, sim.cellW, sim.cellH, e.tile.colour, 0, -0.3, 0.55);
        particles.burst(e.x, e.y, 10, "#9a94c4", 260, 0.5, 9);
        buzz("light");
        break;
      }
      case "crack": {
        audio.crack();
        cam.addTrauma(0.14);
        cam.stop(0.04);
        particles.burst(e.x, e.y, 12, JEWELS[e.tile.colour]!.glow, 340, 0.4, 10);
        buzz("medium");
        break;
      }
      case "break": {
        const j = JEWELS[e.tile.colour]!;
        const combo = e.combo;
        // Piercing gets a *shorter* freeze: the ball is supposed to be tearing
        // through, and a full stop per tile would kill the sense of speed.
        cam.stop(e.pierce ? 0.014 : 0.028 + Math.min(0.05, combo * 0.004) + e.chain * 0.008);
        cam.addTrauma(Math.min(0.42, 0.12 + combo * 0.014));
        cam.punch(0.85 + Math.min(1.8, combo * 0.09));
        particles.shatter(e.x, e.y, sim.cellW, sim.cellH, e.tile.colour, 0, -0.4, 1 + Math.min(0.6, combo * 0.05));
        particles.burst(e.x, e.y, e.pierce ? 26 : 14, e.pierce ? "#ffffff" : j.glow, e.pierce ? 620 : 400, 0.42, 12);
        particles.ring(e.x, e.y, 8, 92 + combo * 6, e.pierce ? "#fff6e4" : j.glow, 0.38, 3);
        particles.floater(e.x, e.y - 12, String(e.value), j.glow, 26 + Math.min(18, combo * 1.6));
        audio.glass(Math.min(10, combo - 1 + e.chain), 0.85 + Math.min(0.5, combo * 0.04));
        if (combo >= 6) cam.requestFlash(0.05 + Math.min(0.1, combo * 0.006));
        buzz(combo >= 5 ? "heavy" : "medium");
        break;
      }
      case "molten": {
        audio.molten();
        cam.stop(0.1);
        cam.addTrauma(0.36);
        cam.punch(2.6);
        cam.requestFlash(0.2, [220, 244, 255]);
        particles.ring(e.x, e.y, 10, 420, "#dff4ff", 0.75, 9);
        particles.ring(e.x, e.y, 10, 260, "#ffffff", 0.5, 5);
        particles.burst(e.x, e.y, 44, "#dff4ff", 700, 0.8, 18);
        buzz("heavy");
        break;
      }
      case "star": {
        audio.star();
        cam.stop(0.07);
        cam.addTrauma(0.32);
        cam.punch(2.4);
        cam.requestFlash(0.16);
        particles.ring(e.x, e.y, 20, 280, "#fff2d0", 0.6, 7);
        particles.burst(e.x, e.y, 42, "#ffe9b8", 620, 0.7, 16);
        buzz("heavy");
        break;
      }
      case "laser": {
        audio.laser();
        particles.cone(e.x, e.y, 10, "#ff9db0", 0, -1, 0.7);
        cam.addTrauma(0.06);
        break;
      }
      case "chargefull": {
        audio.chargeFull();
        hud.chargePulse = 1;
        cam.requestFlash(0.09, [255, 226, 160]);
        particles.ring(sim.paddleX, sim.paddleY, 20, 240, CHARGE_HOT, 0.7, 5);
        buzz("success");
        break;
      }
      case "power": {
        audio.power();
        cam.addTrauma(0.24);
        cam.punch(1.7);
        particles.ring(sim.paddleX, sim.paddleY, 16, 320, POWER_LOOK[e.kind]!.glow, 0.65, 6);
        particles.burst(sim.paddleX, sim.paddleY, 30, POWER_LOOK[e.kind]!.glow, 520, 0.7, 14);
        buzz("heavy");
        break;
      }
      case "lost": {
        audio.lost();
        cam.stop(0.15);
        cam.addTrauma(0.34);
        cam.requestFlash(0.1, [255, 120, 140]);
        particles.burst(e.x, vh - 6, 26, DANGER, 420, 0.8, 14);
        cam.timeScaleTarget = 0.35;
        slowUntil = performance.now() + 450;
        buzz("failure");
        break;
      }
      case "clear": {
        audio.clear();
        cam.stop(0.22);
        cam.addTrauma(0.62);
        cam.punch(4.2);
        cam.requestFlash(0.26, [255, 244, 222]);
        cam.timeScaleTarget = 0.28;
        slowUntil = performance.now() + 1400;
        hud.clearFlash = 1;
        buzz("heavy");
        // Everything still standing comes down, row by row.
        crumbles.length = 0;
        crumbleT = 0;
        for (const t of sim.wave.tiles) {
          if (!t.alive) continue;
          crumbles.push({ tile: t, delay: (sim.wave.rows - t.row) * 0.055 + Math.random() * 0.06 });
        }
        break;
      }
      case "gameover": {
        audio.lost();
        cam.addTrauma(0.5);
        cam.timeScaleTarget = 0.3;
        slowUntil = performance.now() + 900;
        buzz("failure");
        break;
      }
      case "danger": {
        hud.dangerPulse = 1;
        const now = performance.now();
        if (now - lastDanger > 900) {
          lastDanger = now;
          audio.danger();
          buzz("light");
        }
        break;
      }
    }
  }

  // -- loop -----------------------------------------------------------------

  /** One whole frame: control, camera, fixed-step sim, particles, draw. */
  const tick = (dtRealIn: number) => {
    const frameStart = performance.now();
    let dtReal = dtRealIn;
    if (dtReal > 0.25) dtReal = 0.25;

    // Paddle control. Keyboard accelerates; pointer is direct with a touch of
    // smoothing so a shaky finger does not make the paddle chatter.
    const prevX = sim.paddleX;
    const dir = (keyRight ? 1 : 0) - (keyLeft ? 1 : 0);
    if (dir !== 0) {
      keyVel = lerp(keyVel, dir * 1450, Math.min(1, dtReal * 14));
      sim.paddleX += keyVel * dtReal;
      pointerTargetX = null;
    } else {
      keyVel *= 1 - Math.min(1, dtReal * 18);
      if (pointerTargetX !== null) {
        sim.paddleX = lerp(sim.paddleX, pointerTargetX, Math.min(1, dtReal * 34));
      }
    }
    const half = (sim.paddleW * (sim.powers.wide > 0 ? 1.72 : 1)) / 2;
    sim.paddleX = Math.max(half, Math.min(VW - half, sim.paddleX));
    sim.paddleVX = dtReal > 0 ? (sim.paddleX - prevX) / dtReal : 0;

    if (slowUntil && performance.now() > slowUntil && !sim.forge) {
      cam.timeScaleTarget = 1;
      slowUntil = 0;
      audio.setSlowed(false);
    }

    cam.update(dtReal);

    if (sim.forge) {
      const done = stepForge(sim, dtReal);
      if (done) {
        cam.timeScaleTarget = 1;
        audio.setSlowed(false);
      }
    }

    // Fixed-step simulation. Hitstop returns dt 0, so the world freezes while
    // the camera keeps moving — the impact reads instead of vanishing.
    const simDt = cam.simDt(dtReal);
    acc += simDt;
    let steps = 0;
    while (acc >= FIXED && steps < MAX_STEPS) {
      events.length = 0;
      simStep(sim, FIXED, events);
      for (const e of events) applyEvent(e);
      acc -= FIXED;
      steps++;
    }
    if (acc > FIXED * MAX_STEPS) acc = 0;
    // Events raised outside the fixed step (a laser fired between frames).
    if (events.length && steps === 0) {
      for (const e of events) applyEvent(e);
      events.length = 0;
    }

    particles.update(dtReal * (cam.hitstop > 0 ? 0.06 : 1), vh);

    // Crumble the leftover masonry through the fever.
    if (crumbles.length) {
      crumbleT += dtReal;
      for (let i = crumbles.length - 1; i >= 0; i--) {
        const c = crumbles[i]!;
        if (crumbleT < c.delay) continue;
        c.tile.alive = false;
        particles.shatter(
          tileX(sim, c.tile.col) + sim.cellW / 2,
          tileY(sim, c.tile.row) + sim.cellH / 2,
          sim.cellW,
          sim.cellH,
          c.tile.colour,
          0,
          0.2,
          0.85,
        );
        crumbles.splice(i, 1);
      }
    }

    hud.chargePulse =
      sim.charge >= sim.chargeMax
        ? 0.55 + Math.sin(frameStart / 150) * 0.45
        : Math.max(0, hud.chargePulse - dtReal * 2.4);
    hud.dangerPulse = Math.max(0, hud.dangerPulse - dtReal * 1.6);
    hud.clearFlash = Math.max(0, hud.clearFlash - dtReal * 0.9);
    waveT = sim.phase === "fever" ? 0 : waveT + dtReal;
    hud.waveIntro = clamp01(1 - waveT / 1.1);

    audio.setBrightness(clamp01(sim.broken / Math.max(1, sim.wave.guiltyTotal)));

    renderer.draw(sim, cam, particles, hud, dtReal);

    const ms = performance.now() - frameStart;
    fpsWindow.push(dtReal);
    if (fpsWindow.length > 90) fpsWindow.shift();
    const avg = fpsWindow.reduce((a, b) => a + b, 0) / fpsWindow.length;
    debug.fps = Math.round(1 / Math.max(0.0001, avg));
    debug.frameMs = Math.round(ms * 100) / 100;
    debug.particles = particles.liveCount;
  };

  const frame = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dtReal = (now - last) / 1000;
    last = now;
    if (paused) return;
    tick(dtReal);
  };

  raf = requestAnimationFrame(frame);

  return {
    unmount() {
      running = false;
      guide.destroy();
      cancelAnimationFrame(raf);
      ro.disconnect();
      stopInsets();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      globalThis.removeEventListener("keydown", onKeyDown);
      globalThis.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibility);
      audio.suspend();
      canvas.remove();
      delete (globalThis as unknown as { __mosaic?: unknown }).__mosaic;
    },
  };
}

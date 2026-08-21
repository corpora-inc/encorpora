/**
 * Standalone entry. `npm run dev` and this file is the whole harness: a stub
 * host, a div, and the game. The pack runtime will call `mount` the same way.
 *
 * Query flags, all development-only and none of them reachable from the game:
 *   ?seed=123   fix the run seed
 *   ?wave=7     start at a later wave, to look at late-game walls
 *   ?bot=1      an aiming autoplayer, for watching the thing run
 *   ?perf=1     fps / frame-time / particle-count overlay
 */
import { mount } from "./mount.ts";
import { createStubHost } from "./stubHost.ts";
import type { Sim } from "./game/state.ts";
import { VW } from "./game/state.ts";
import { buildWave } from "./game/wall.ts";
import { chooseShard, dismissForge } from "./game/forge.ts";
import { createRemix } from "./game/remix.ts";
import { launch, paddleHalf, wallLeft } from "./game/sim.ts";
import type { Host } from "./contract.ts";

const el = document.getElementById("stage");
if (!el) throw new Error("mosaic: #stage missing");

const q = new URLSearchParams(location.search);

// Keep running while the tab is in the background, so a headless screenshot or
// a benchmark sees the real loop. Never set outside this harness.
if (q.get("nopause")) (globalThis as unknown as { __mosaicNoPause?: boolean }).__mosaicNoPause = true;

const host = createStubHost({
  seed: Number(q.get("seed") ?? 0) || 0x51ee7,
  difficulty: () => {
    const g = globalThis as unknown as { __mosaic?: { sim?: Sim } };
    return Math.min(1, (g.__mosaic?.sim?.wave?.index ?? 0) / 14);
  },
});

mount(el, host);

const dev = (globalThis as unknown as { __mosaic?: { sim: Sim; debug: Record<string, number> } }).__mosaic;

if (dev && q.get("wave")) {
  const index = Math.max(0, Number(q.get("wave")) - 1);
  const wave = buildWave({ seed: dev.sim.seed, index });
  dev.sim.wave = wave;
  dev.sim.rule = wave.rule;
  // The remix is per-wave state. Jumping the wall without rebuilding it left
  // wave 21 running wave 1's ceiling, which is below its own pane count, so
  // re-glazing bailed on its first line every time and the wave you jumped to
  // was the one wave in the game that never remixed.
  dev.sim.remix = createRemix(dev.sim.seed, wave);
  dev.sim.sway = 0;
  dev.sim.broken = 0;
  const grid = new Int32Array(wave.cols * wave.rows).fill(-1);
  dev.sim.cellW = (VW - 100) / wave.cols;
  dev.sim.cellH = Math.min(dev.sim.cellW / 1.62, 62);
  for (let i = 0; i < wave.tiles.length; i++) {
    grid[wave.tiles[i]!.row * wave.cols + wave.tiles[i]!.col] = i;
  }
  dev.sim.grid = grid;
}

if (dev && q.get("bot")) {
  const MAX_DEFLECT = (62 * Math.PI) / 180;
  setInterval(() => {
    const sim = dev.sim;
    if (sim.phase === "serve") {
      launch(sim);
      return;
    }
    if (sim.forge) {
      // A miss holds its reveal for ever. The bot reads it for a second and
      // taps, the way a child does; without this it sits on the first wrong
      // answer of the run and the watch loop is dead.
      if (sim.forge.held) {
        if (sim.forge.age > 1.2) dismissForge(sim);
        return;
      }
      // Answer correctly nine times in ten, so both outcomes get exercised.
      if (sim.forge.age > 1.2 && sim.forge.resolving <= 0) {
        const i = Math.random() < 0.9 ? sim.forge.shards.findIndex((s) => s.correct) : 0;
        chooseShard(sim, host as Host, i, []);
      }
      return;
    }
    let ball: { x: number; y: number; vx: number; vy: number } | null = null;
    for (const b of sim.balls) if (b.alive && (!ball || b.y > ball.y)) ball = b;
    if (!ball) return;
    const half = paddleHalf(sim);
    let landing = ball.x;
    if (ball.vy > 0) {
      const t = (sim.paddleY - ball.y) / ball.vy;
      const span = VW * 2;
      let x = ball.x + ball.vx * t;
      x = ((x % span) + span) % span;
      landing = x > VW ? span - x : x;
    }
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const t of sim.wave.tiles) {
      // `drop > 0` is a pane still in the air: not solid yet, so not aimable.
      if (!t.alive || !t.guilty || t.drop > 0) continue;
      const tx = wallLeft(sim) + (t.col + 0.5) * sim.cellW;
      const ty = sim.wallY + sim.descent + (t.row + 0.5) * sim.cellH;
      const d = Math.hypot(tx - landing, ty - sim.paddleY);
      if (d < bestD) {
        bestD = d;
        best = { x: tx, y: ty };
      }
    }
    let offset = Math.random() * 0.6 - 0.3;
    if (best) {
      const rel = Math.atan2(best.y - sim.paddleY, best.x - landing) + Math.PI / 2;
      offset = Math.max(-0.94, Math.min(0.94, rel / MAX_DEFLECT));
    }
    sim.paddleX = Math.max(half, Math.min(VW - half, landing - offset * half));
  }, 8);
  addEventListener("pointerdown", () => void 0, { once: true });
}

if (q.get("bench")) {
  // Render cost under a deliberately unreasonable load: three balls, the
  // particle pools stuffed, and 240 back-to-back draws with no rAF in between.
  const g = globalThis as unknown as {
    __mosaic: {
      sim: Sim;
      renderer: { draw: (...a: unknown[]) => void };
      particles: {
        shatter: (...a: number[]) => void;
        burst: (x: number, y: number, n: number, c: string, s: number, l: number, len: number) => void;
        update: (dt: number, vh: number) => void;
        liveCount: number;
      };
      cam: unknown;
      hud: unknown;
    };
  };
  setTimeout(() => {
    const { sim, renderer, particles, cam, hud } = g.__mosaic;
    for (let i = 0; i < 40; i++) {
      particles.shatter(100 + i * 20, 300 + (i % 7) * 40, 90, 55, i % 6, 0, -0.4, 1.4);
      particles.burst(120 + i * 19, 320 + (i % 5) * 50, 18, "#ffd98a", 500, 0.9, 14);
    }
    particles.update(0.016, sim.vh);
    const N = 240;
    const t0 = performance.now();
    for (let i = 0; i < N; i++) renderer.draw(sim, cam, particles, hud, 1 / 60);
    const t1 = performance.now();
    const ms = (t1 - t0) / N;
    console.log(
      `[mosaic bench] draw ${ms.toFixed(2)} ms/frame at ${particles.liveCount} particles, ` +
        `${sim.wave.tiles.filter((t) => t.alive).length} tiles, dpr ${(renderer as unknown as { dpr: number }).dpr}`,
    );
  }, 1200);
}

if (dev && q.get("perf")) {
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;left:8px;top:8px;z-index:9;font:12px/1.5 ui-monospace,monospace;color:#9df;background:rgba(0,0,0,.55);padding:6px 9px;border-radius:6px;pointer-events:none;white-space:pre";
  document.body.appendChild(box);
  setInterval(() => {
    box.textContent = `fps ${dev.debug.fps}\nframe ${dev.debug.frameMs}ms\nparts ${dev.debug.particles}\nwave ${
      dev.sim.wave.index + 1
    }  ${dev.sim.broken}/${dev.sim.wave.guiltyTotal}\ncombo ${dev.sim.combo}`;
  }, 250);
}

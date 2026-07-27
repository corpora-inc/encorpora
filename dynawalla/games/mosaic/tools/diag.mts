import { Rng } from "../src/rng.ts";
import { createSim, launch, paddleHalf, step } from "../src/game/sim.ts";
import type { Sim, SimEvent } from "../src/game/state.ts";
import { VW } from "../src/game/state.ts";

const DT = 1 / 120;
function autoPaddle(sim: Sim, rng: Rng) {
  let lowest: null | { x: number; y: number } = null;
  for (const b of sim.balls) { if (!b.alive) continue; if (!lowest || b.y > lowest.y) lowest = { x: b.x, y: b.y }; }
  if (!lowest) return;
  const half = paddleHalf(sim);
  sim.paddleX = Math.max(half, Math.min(VW - half, lowest.x - (rng.f() * 1.5 - 0.75) * half));
}
for (const seed of [1,2,3]) {
  const sim = createSim(seed, 1560);
  launch(sim);
  const rng = new Rng(seed*31);
  const out: SimEvent[] = [];
  let t = 0;
  for (let i = 0; i < Math.round(400/DT); i++) {
    autoPaddle(sim, rng); out.length = 0; step(sim, DT, out); t += DT;
    if (sim.phase === "serve") launch(sim);
    if (sim.phase === "fever" || sim.phase === "gameover") break;
  }
  const remain = sim.wave.tiles.filter(x=>x.alive&&x.guilty);
  console.log(seed, sim.phase, "t=", t.toFixed(1), "broken", sim.broken, "/", sim.wave.guiltyTotal, "remain", remain.map(r=>`${r.col},${r.row}`).join(" "), "descent", sim.descent.toFixed(1), "rows", sim.wave.rows, "cols", sim.wave.cols);
}

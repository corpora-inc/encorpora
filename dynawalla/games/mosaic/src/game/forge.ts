/**
 * THE FORGE — the one moment the game stops being about physics.
 *
 * Eight shattered tiles charge the paddle. Press it and the world drops to a
 * twelfth of speed: the ball hangs mid-arc, the glass dims, and four runes rise
 * out of the paddle carrying the answers to one problem — **and one power-up
 * each**. Multiball is sitting on 56. Laser is on 63. The prompt says 7 × 8.
 *
 * So arithmetic is *foresight* here: if you know the table you know, before you
 * commit, exactly which power you are about to receive. If you don't, you find
 * out. That is the whole design — the reward for being right is not points, it
 * is that you saw it coming.
 *
 * Being wrong costs the charge and the power. Nothing is marked in red, nothing
 * is explained; the correct rune simply lights up as everything else goes dark,
 * which is the same information without the scolding.
 */
import { REVEAL_SETTLE_MS } from "../../../../packs/shared/game-pacing/index.ts";
import type { Host } from "../contract.ts";
import { Rng } from "../rng.ts";
import type { Forge, ForgeShard, PowerKind, Sim, SimEvent } from "./state.ts";
import { VW } from "./state.ts";
import { grantPower } from "./sim.ts";

const POWERS: PowerKind[] = ["multi", "laser", "wide", "slow"];

/** Real seconds before the beat closes itself. Hesitating is never punished. */
export const FORGE_TIMEOUT = 7;

export function openForge(sim: Sim, host: Host, rngSeed: number): void {
  if (sim.forge || sim.charge < sim.chargeMax || sim.phase !== "play") return;
  const q = host.next();
  const rng = new Rng(rngSeed);

  const answers = [q.answer, ...q.distractors.slice(0, 3)];
  while (answers.length < 4) answers.push(String(Number(q.answer) + answers.length));
  const powers = rng.shuffle([...POWERS]);

  // A tidy arc, barely drifting. Four runes that wander are four runes a child
  // has to chase with a thumb.
  const order = rng.shuffle([0, 1, 2, 3]);
  const shards: ForgeShard[] = order.map((srcIndex, slot) => {
    const t = slot - 1.5; // -1.5 .. 1.5
    return {
      text: answers[srcIndex]!,
      correct: srcIndex === 0,
      power: powers[slot]!,
      x: VW * 0.5 + t * VW * 0.235,
      y: sim.vh * 0.645 + Math.abs(t) * sim.vh * 0.022,
      vx: t * 1.2,
      vy: -1.5,
      state: 0,
      pop: 0,
    };
  });

  const forge: Forge = {
    open: true,
    age: 0,
    questionId: q.id,
    prompt: q.prompt,
    shards,
    resolving: 0,
    held: false,
    settleAt: 0,
    outcome: "none",
  };
  sim.forge = forge;
}

/** Hit-test in virtual units. Generous: 96×72 half-extents, thumbs are wide. */
export function forgeShardAt(forge: Forge, x: number, y: number): number {
  for (let i = 0; i < forge.shards.length; i++) {
    const s = forge.shards[i]!;
    if (Math.abs(x - s.x) <= 98 && Math.abs(y - s.y) <= 76) return i;
  }
  return -1;
}

export function chooseShard(
  sim: Sim,
  host: Host,
  index: number,
  out: SimEvent[],
): "right" | "wrong" | null {
  const forge = sim.forge;
  if (!forge || !forge.open || forge.resolving > 0) return null;
  const shard = forge.shards[index];
  if (!shard) return null;

  const ms = Math.round(forge.age * 1000);
  host.report({
    questionId: forge.questionId,
    correct: shard.correct,
    ms,
    answered: shard.text,
  });

  // A win has nothing to marinate on, so it plays its flourish and goes. A MISS
  // holds — `revealPlan`'s `holdMs: Infinity`, which is the fleet-wide answer to
  // "the answers flashed for a second and then go on". The correct rune lights
  // up under the prompt that asked for it, in the warm accent and never in red,
  // and it stays there until a hand takes it down. `settleAt` is the only
  // deadline anywhere near it and it runs the other way: it is a lockout, so the
  // second tap of an impatient double-tap cannot dismiss the lesson it just
  // raised.
  forge.resolving = shard.correct ? 0.85 : Number.POSITIVE_INFINITY;
  forge.held = !shard.correct;
  forge.settleAt = forge.age + REVEAL_SETTLE_MS / 1000;
  forge.outcome = shard.correct ? "right" : "wrong";
  sim.charge = 0;

  for (const s of forge.shards) {
    if (s === shard) s.state = shard.correct ? 1 : -1;
    else s.state = s.correct && !shard.correct ? 1 : 2;
    s.pop = 1;
  }

  if (shard.correct) {
    grantPower(sim, shard.power, out);
    return "right";
  }
  return "wrong";
}

/**
 * Take a held reveal down, if the child's own input is allowed to yet.
 *
 * Returns true when the beat actually closed, so the caller knows whether the
 * tap was spent here or is still free to mean something else.
 */
export function dismissForge(sim: Sim): boolean {
  const forge = sim.forge;
  if (!forge || !forge.held) return false;
  if (forge.age < forge.settleAt) return false;
  sim.forge = null;
  return true;
}

/** Advance the beat in REAL time — the forge is not slowed by its own slow-mo. */
export function stepForge(sim: Sim, dtReal: number): boolean {
  const forge = sim.forge;
  if (!forge) return false;
  forge.age += dtReal;

  // A held reveal never expires, and NOTHING in it moves. `age` keeps running
  // because the settle floor is measured in it, but the runes are frozen where
  // they were chosen: they are on a rising arc with gravity under them, and
  // under an unbounded hold that arc carried the lit correct answer off the
  // bottom of the screen in about twenty seconds. A reveal advertised as
  // unlimited that empties itself while you read it is worse than the timer it
  // replaced.
  if (forge.held) return false;

  for (const s of forge.shards) {
    s.x += s.vx * dtReal;
    s.y += s.vy * dtReal;
    s.vy += 2.2 * dtReal;
    if (s.pop > 0) s.pop = Math.max(0, s.pop - dtReal * 1.6);
  }

  if (forge.resolving > 0) {
    forge.resolving -= dtReal;
    if (forge.resolving <= 0) {
      sim.forge = null;
      return true;
    }
    return false;
  }

  if (forge.age > FORGE_TIMEOUT) {
    // Timed out without a choice: keep most of the charge, take no power.
    sim.charge = Math.floor(sim.chargeMax * 0.6);
    sim.forge = null;
    return true;
  }
  return false;
}

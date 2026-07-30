import type { Question } from "../contract.ts";
import type { SolidField, GlowField } from "./fields.ts";
import type { DigitField } from "./digits.ts";
import type { Rng } from "./rng.ts";
import type { Projector } from "./project.ts";
import { LANE_W, DECK_HALF } from "./world.ts";
import {
  readBand, payoffHeight, keepInside, payoffEdge, popupEdge,
  type Frame, type GateGeom,
} from "./readband.ts";
import { laneOptions } from "./options.ts";
import { clamp01, easeOutBack, easeOutCubic, easeOutQuint } from "./juice.ts";

/**
 * Gates, hazards, sparks and score popups.
 *
 * The design rule that everything else follows from: **the lane you are in when
 * you cross the gate plane is the answer you gave.** There is no button, no
 * menu, no pause. Answering is steering, and steering is the game.
 *
 * The second rule: a wrong answer must cost something a child can feel. It is
 * a solid barrier — you slam it, you lose a third of your voltage, your surge
 * multiplier collapses to one and you lose about a second of control. Three
 * lanes means a guess pays off a third of the time, so the price of a guess has
 * to be steep enough that reading is plainly the cheaper strategy.
 *
 * Everything here is a fixed-size pool addressed by index. Nothing is allocated
 * during a run.
 */

export const GATE_PLANE = 0;

export type GateState = "incoming" | "passed" | "hit";

export type Gate = {
  active: boolean;
  z: number;
  q: Question | null;
  /** Text drawn in lane 0, 1, 2. */
  values: [string, string, string];
  correctLane: number;
  chosenLane: number;
  state: GateState;
  /** performance.now() when the gate first became visible; latency baseline. */
  shownAt: number;
  /** 0 -> 1 arrival animation. */
  intro: number;
  /** Post-resolution animation clock. */
  burst: number;
  /** Reading window this gate was granted, in seconds. Reported for tuning. */
  window: number;
  /** Where the three numerals last drew, in NDC, so the payoff can start there. */
  ndcX: [number, number, number];
  ndcY: number;
  ndcH: number;
};

export type HazardKind = "pylon" | "lowbar" | "pit" | "sweeper";

export type Hazard = {
  active: boolean;
  kind: HazardKind;
  z: number;
  lane: number;
  /** Sweeper phase. */
  phase: number;
  span: number;
  hit: boolean;
  grazed: boolean;
};

export type Spark = {
  active: boolean;
  x: number;
  y: number;
  z: number;
  taken: boolean;
  bob: number;
};

export type Popup = {
  active: boolean;
  text: string;
  x: number;
  y: number;
  z: number;
  t: number;
  life: number;
  size: number;
  r: number;
  g: number;
  b: number;
};

export const laneX = (lane: number): number => (lane - 1) * LANE_W;

/** Scratch for the per-frame numeral measurement. Never allocate in a frame. */
const TMP_UNITS: [number, number, number] = [1, 1, 1];

export class Entities {
  gates: Gate[] = [];
  hazards: Hazard[] = [];
  sparks: Spark[] = [];
  popups: Popup[] = [];

  constructor(gateCap = 3, hazardCap = 40, sparkCap = 120, popupCap = 28) {
    for (let i = 0; i < gateCap; i++)
      this.gates.push({
        active: false, z: 0, q: null, values: ["", "", ""], correctLane: 1,
        chosenLane: -1, state: "incoming", shownAt: 0, intro: 0, burst: 0, window: 0,
        ndcX: [-0.58, 0, 0.58], ndcY: 0.3, ndcH: 0.2,
      });
    for (let i = 0; i < hazardCap; i++)
      this.hazards.push({ active: false, kind: "pylon", z: 0, lane: 1, phase: 0, span: 1, hit: false, grazed: false });
    for (let i = 0; i < sparkCap; i++)
      this.sparks.push({ active: false, x: 0, y: 0, z: 0, taken: false, bob: 0 });
    for (let i = 0; i < popupCap; i++)
      this.popups.push({ active: false, text: "", x: 0, y: 0, z: 0, t: 0, life: 1, size: 1, r: 1, g: 1, b: 1 });
  }

  reset(): void {
    for (const g of this.gates) g.active = false;
    for (const h of this.hazards) h.active = false;
    for (const s of this.sparks) s.active = false;
    for (const p of this.popups) p.active = false;
  }

  /* -------------------------------- spawning ------------------------------ */

  spawnGate(q: Question, distance: number, window: number, rng: Rng): Gate | null {
    const g = this.gates.find((x) => !x.active);
    if (!g) return null;
    const { values, correct } = laneOptions(q.answer, q.distractors, rng);
    g.active = true;
    g.z = -distance;
    g.q = q;
    g.correctLane = correct;
    g.chosenLane = -1;
    g.state = "incoming";
    g.shownAt = performance.now();
    g.intro = 0;
    g.burst = 0;
    g.window = window;
    for (let i = 0; i < 3; i++) g.values[i] = values[i];
    return g;
  }

  spawnHazard(kind: HazardKind, lane: number, distance: number, span = 1): Hazard | null {
    const h = this.hazards.find((x) => !x.active);
    if (!h) return null;
    h.active = true;
    h.kind = kind;
    h.z = -distance;
    h.lane = lane;
    h.span = span;
    h.phase = Math.random() * Math.PI * 2;
    h.hit = false;
    h.grazed = false;
    return h;
  }

  spawnSpark(x: number, y: number, distance: number): void {
    const s = this.sparks.find((v) => !v.active);
    if (!s) return;
    s.active = true;
    s.x = x;
    s.y = y;
    s.z = -distance;
    s.taken = false;
    s.bob = Math.random() * Math.PI * 2;
  }

  popup(text: string, x: number, y: number, z: number, size: number, r: number, g: number, b: number, life = 1.05): void {
    let p = this.popups.find((v) => !v.active);
    if (!p) {
      // Steal the oldest rather than drop the feedback.
      p = this.popups.reduce((a, b) => (a.t > b.t ? a : b));
    }
    p.active = true;
    p.text = text;
    p.x = x;
    p.y = y;
    p.z = z;
    p.t = 0;
    p.life = life;
    p.size = size;
    p.r = r;
    p.g = g;
    p.b = b;
  }

  /* --------------------------------- update ------------------------------- */

  update(dt: number, scroll: number): void {
    for (const g of this.gates) {
      if (!g.active) continue;
      g.z += scroll;
      g.intro = Math.min(1, g.intro + dt * 2.4);
      if (g.state !== "incoming") {
        g.burst += dt;
        if (g.burst > 0.85) g.active = false;
      } else if (g.z > 24) {
        g.active = false;
      }
    }
    for (const h of this.hazards) {
      if (!h.active) continue;
      h.z += scroll;
      if (h.kind === "sweeper") h.phase += dt * 1.55;
      if (h.z > 26) h.active = false;
    }
    for (const s of this.sparks) {
      if (!s.active) continue;
      s.z += scroll;
      s.bob += dt * 4;
      if (s.z > 24) s.active = false;
    }
    for (const p of this.popups) {
      if (!p.active) continue;
      p.t += dt;
      p.z += scroll * 0.55; // popups lag the world slightly so they stay readable
      p.y += dt * 3.2;
      if (p.t >= p.life) p.active = false;
    }
  }

  /** Current lane centre of a hazard, accounting for sweeper motion. */
  hazardX(h: Hazard): number {
    if (h.kind !== "sweeper") return laneX(h.lane);
    return Math.sin(h.phase) * LANE_W;
  }

  /* ---------------------------------- draw -------------------------------- */

  drawGates(
    box: SolidField, glow: GlowField, digits: DigitField, proj: Projector,
    ac: readonly [number, number, number],
    hot: readonly [number, number, number],
    bad: readonly [number, number, number],
    good: readonly [number, number, number],
    ink: readonly [number, number, number],
    time: number,
    revealed: boolean,
    frame: Frame,
  ): void {
    for (const g of this.gates) {
      if (!g.active) continue;
      const intro = easeOutBack(g.intro);
      const H = 4.9 * intro;
      const resolving = g.state !== "incoming";
      const bt = resolving ? clamp01(g.burst / 0.85) : 0;

      for (let i = 0; i < 3; i++) {
        const cx = laneX(i);
        const isCorrect = i === g.correctLane;
        // Before resolution every gate looks identical — the numeral is the
        // only information. Colour never leaks the answer.
        let cr = ac[0], cg = ac[1], cb = ac[2], glowAmt = 0.45;
        if (resolving || revealed) {
          const c = isCorrect ? good : bad;
          cr = c[0]; cg = c[1]; cb = c[2];
          glowAmt = isCorrect ? 3.4 : 1.2;
        }
        const chosen = resolving && i === g.chosenLane;
        const shatter = resolving && isCorrect ? bt : 0;
        const fall = resolving && !isCorrect && chosen ? bt : 0;

        const openY = fall * 1.2;
        const post = 0.24 + (chosen ? 0.12 : 0);
        const alpha = resolving && isCorrect ? 1 - bt : 1;
        if (alpha > 0.02) {
          const spread = shatter * 2.6;
          box.add(cx - LANE_W * 0.5 + 0.24 - spread, H * 0.5 - openY, g.z, post, H, 0.42, 0, cr, cg, cb, glowAmt, alpha);
          box.add(cx + LANE_W * 0.5 - 0.24 + spread, H * 0.5 - openY, g.z, post, H, 0.42, 0, cr, cg, cb, glowAmt, alpha);
          box.add(cx, H - openY, g.z, LANE_W - 0.42 + spread * 2, 0.3, 0.46, 0, cr, cg, cb, glowAmt * 1.3, alpha);
        }

        // The membrane you break. Pulses so the gate reads as "enterable".
        const pulse = 0.5 + 0.5 * Math.sin(time * 3.4 + i * 1.1);
        const memA = resolving ? (isCorrect ? (1 - bt) * 0.5 : 0.1) : (0.10 + pulse * 0.07) * intro;
        if (memA > 0.01) {
          glow.add(cx, H * 0.5, g.z, LANE_W - 0.5, memA, H / Math.max(0.001, LANE_W - 0.5), 3, cr, cg, cb);
        }

        if (resolving && isCorrect && bt < 1) {
          glow.add(cx, H * 0.5, g.z, 2 + bt * 22, (1 - bt) * 0.9, 1, 1, hot[0], hot[1], hot[2]);
        }
      }

      // The numerals. See `readband.ts` — they are laid out in screen units and
      // converted back to world space, because perspective is the wrong tool for
      // typesetting three values a child has half a second to compare.
      if (resolving) this.drawPayoff(g, digits, glow, proj, good, bad, hot, bt, frame);
      else this.drawCandidates(g, digits, glow, proj, ink, ac, H, frame);

      // The overhead beam that says "this is the answer line".
      const beamA = resolving ? Math.max(0, 1 - bt * 2) : intro * 0.85;
      if (beamA > 0.02) {
        glow.add(0, 5.9 * intro, g.z, DECK_HALF * 2.1, beamA * 0.5, 0.05, 3, ac[0], ac[1], ac[2]);
      }
    }
  }

  /**
   * The three candidates, while the gate is still incoming.
   *
   * Laid out in NDC by `readBand` and converted straight back to world space, so
   * they fog, bend and belong to the causeway while being typeset like a poster.
   * Two passes: the first linearises the projection around the arch to find out
   * where the row wants to sit, the second re-linearises around the row's own
   * height. The camera is pitched about three degrees, and one refinement takes
   * the residual well under a pixel.
   *
   * Every input to the layout is measured off this gate: where its middle lane
   * projects to, how far apart its lanes are on screen, how tall its arches are.
   * The row therefore travels with the gate, grows with it and settles into the
   * windows — before, all three numbers were screen constants and the row was a
   * HUD element that happened to be drawn in the world.
   */
  private drawCandidates(
    g: Gate, digits: DigitField, glow: GlowField, proj: Projector,
    ink: readonly [number, number, number],
    ac: readonly [number, number, number],
    H: number,
    frame: Frame,
  ): void {
    const u = TMP_UNITS;
    proj.at(g.z, H);
    const geom: GateGeom = {
      centre: proj.x0,
      lanePitch: Math.abs(proj.kx) * LANE_W,
      archTop: proj.ndcY(H),
      archH: Math.abs(proj.ky) * H,
      deck: proj.ndcY(0),
    };
    for (let i = 0; i < 3; i++) u[i] = Math.max(1e-4, digits.measure(g.values[i], 1));

    let band = readBand(u, proj.kx, proj.ky, geom, frame);
    // Re-linearise around the row's own height. `centre`, `lanePitch`, `archTop`,
    // `archH` and `deck` are re-measured with it: they are all functions of the
    // reference height, and holding the first pass's values here is what would
    // put the row half a lane off its arch on a pitched camera.
    proj.at(g.z, proj.worldY(band.y));
    geom.centre = proj.x0;
    geom.lanePitch = Math.abs(proj.kx) * LANE_W;
    geom.archTop = proj.ndcY(H);
    geom.archH = Math.abs(proj.ky) * H;
    geom.deck = proj.ndcY(0);
    band = readBand(u, proj.kx, proj.ky, geom, frame);

    // The row is dealt outward from the gate's centre as it resolves out of the
    // fog. Overshoot is deliberate — `readBand` keeps a 30% gutter, so a 13%
    // back-ease can never close it.
    const deal = clamp01(g.intro * 1.35);
    const spread = easeOutBack(deal);
    const scale = easeOutBack(clamp01(g.intro * 1.6));
    const alpha = clamp01(g.intro * 2.4);
    const hW = proj.worldFromNdcY(band.hNdc) * scale;
    const yW = proj.worldY(band.y);

    g.ndcY = band.y;
    g.ndcH = band.hNdc * scale;

    for (let i = 0; i < 3; i++) {
      const nx = band.x[1] + (band.x[i] - band.x[1]) * spread;
      g.ndcX[i] = nx;
      const xW = proj.worldX(nx);

      // A leader from the numeral down to the top of its own arch, for as long as
      // there is a gap to lead across. It fades out as the numeral settles into
      // the window: a line of dots from a numeral to the arch it is already
      // standing in is a line of dots to nowhere.
      const ax = laneX(i);
      const ay = H + 0.5;
      const lead = alpha * (1 - band.onGate);
      if (lead > 0.02) {
        for (let k = 1; k <= 5; k++) {
          const t = k / 6;
          const lt = t * t; // bunch the dots toward the arch, where the answer is
          glow.add(
            xW + (ax - xW) * lt, yW - hW * 0.62 + (ay - (yW - hW * 0.62)) * lt, g.z + 0.02,
            hW * (0.16 + t * 0.1), lead * (0.1 + t * 0.42), 1, 0,
            ac[0], ac[1], ac[2],
          );
        }
      }
      // ...and a hard cap sitting on the arch, so the endpoint is unmissable.
      glow.add(ax, ay, g.z + 0.02, LANE_W * 0.5, alpha * 0.5, 0.12, 3, ac[0], ac[1], ac[2]);

      if (alpha > 0.02) {
        digits.addNumber(g.values[i], xW, yW, g.z + 0.05, hW, ink[0], ink[1], ink[2], alpha, 0.05);
      }
    }
  }

  /**
   * What happens the instant you cross.
   *
   * On a win the value you earned leaves the row, rushes the camera and fills
   * the screen — the biggest single moment in the game, and it is allowed to
   * blaze because nobody has to read it any more.
   *
   * On a miss it does *not*. A screen-filling green numeral after a wrong answer
   * reads as praise. Instead the lane you actually took goes red and drops, and
   * the value you should have taken is popped over its own lane by the caller,
   * where the lane — not the number — is the lesson.
   */
  private drawPayoff(
    g: Gate, digits: DigitField, glow: GlowField, proj: Projector,
    good: readonly [number, number, number],
    bad: readonly [number, number, number],
    hot: readonly [number, number, number],
    bt: number,
    frame: Frame,
  ): void {
    const CZ = -14;
    proj.at(CZ, 3);
    const right = g.correctLane;
    const won = g.state === "passed";

    for (let i = 0; i < 3; i++) {
      const isRight = i === right;
      if (isRight && won) continue;
      const chosen = i === g.chosenLane;
      // The one you took hangs around long enough to be seen going red.
      const a = chosen ? Math.max(0, 1 - bt * 1.7) : Math.max(0, 1 - bt * 3.2);
      if (a <= 0.02) continue;
      const drop = chosen ? bt * bt * 0.45 : bt * 0.2;
      const shake = chosen ? Math.sin(bt * 46) * 0.05 * (1 - bt) : 0;
      const c = chosen ? bad : isRight ? good : bad;
      digits.addNumber(
        g.values[i], proj.worldX(g.ndcX[i] + shake), proj.worldY(g.ndcY - drop), CZ + 0.05,
        proj.worldFromNdcY(g.ndcH * (1 - bt * 0.35)),
        c[0], c[1], c[2], a * (chosen ? 1 : 0.5), chosen ? 0.6 : 0.05,
      );
    }

    if (!won) return;

    const rush = easeOutQuint(bt);
    const swell = easeOutCubic(Math.min(1, bt * 1.25));
    const a = bt < 0.55 ? 1 : Math.max(0, 1 - (bt - 0.55) / 0.45);
    if (a > 0.02) {
      // How big the winning numeral is allowed to get. See `payoffHeight` —
      // like the candidate row, it is decided in screen units and converted back.
      const wPerH = digits.measure(g.values[right], 1) * (Math.abs(proj.kx) / Math.abs(proj.ky));
      const hn = payoffHeight(wPerH, g.ndcH, swell, payoffEdge(frame.edge));
      const x = proj.worldX(g.ndcX[right] * (1 - rush));
      const y = proj.worldY(g.ndcY + (0.02 - g.ndcY) * rush);
      digits.addNumber(
        g.values[right], x, y, CZ + 0.05, proj.worldFromNdcY(hn),
        good[0], good[1], good[2], a, 2.4 + bt * 2.6,
      );
      // The ring the numeral punches through. Sized off the numeral rather than
      // off a constant, so a phone gets the same composition as a laptop instead
      // of a ring three screens wide around a numeral that had to stay small.
      const rw = proj.worldFromNdcY(0.2 + swell * hn * 1.55);
      glow.add(x, y, CZ + 0.1, rw, (1 - bt) * 0.85, 1, 1, hot[0], hot[1], hot[2]);
      glow.add(x, y, CZ + 0.12, rw * 0.55, (1 - bt) * 0.5, 1, 0, good[0], good[1], good[2]);
    }
  }

  drawHazards(
    box: SolidField, glow: GlowField,
    warn: readonly [number, number, number],
    ac: readonly [number, number, number],
    time: number,
  ): void {
    for (const h of this.hazards) {
      if (!h.active || h.kind === "pit") continue;
      const x = this.hazardX(h);
      const pulse = 0.55 + 0.45 * Math.sin(time * 6 + h.phase);
      if (h.kind === "pylon" || h.kind === "sweeper") {
        const H = 2.75;
        box.add(x, H * 0.5, h.z, LANE_W * 0.62, H, 0.85, 0, warn[0], warn[1], warn[2], 1.3 + pulse * 0.6, 1);
        box.add(x, H + 0.22, h.z, LANE_W * 0.72, 0.24, 1.0, 0, warn[0], warn[1], warn[2], 2.4, 1);
        glow.add(x, H * 0.5, h.z, LANE_W * 1.15, 0.30 * pulse, 1.6, 0, warn[0], warn[1], warn[2]);
        if (h.kind === "sweeper") {
          glow.add(x, 0.08, h.z, 4.2, 0.34, 0.3, 1, warn[0], warn[1], warn[2]);
        }
      } else {
        // Low bar: you go under it. The gap below is lit so the affordance is
        // shape, not memory.
        const w = LANE_W * h.span;
        box.add(x, 3.15, h.z, w, 1.5, 0.9, 0, warn[0], warn[1], warn[2], 1.5, 1);
        box.add(x, 2.35, h.z, w, 0.16, 1.1, 0, warn[0], warn[1], warn[2], 2.6, 1);
        glow.add(x, 1.15, h.z, w * 0.95, 0.16 * pulse, 0.55, 3, ac[0], ac[1], ac[2]);
      }
    }
  }

  drawPits(glow: GlowField, warn: readonly [number, number, number]): void {
    for (const h of this.hazards) {
      if (!h.active || h.kind !== "pit") continue;
      const w = DECK_HALF * 2;
      glow.add(0, 0.05, h.z - 3.2, w, 0.6, 0.06, 3, warn[0], warn[1], warn[2]);
      glow.add(0, 0.05, h.z + 3.2, w, 0.6, 0.06, 3, warn[0], warn[1], warn[2]);
    }
  }

  drawSparks(glow: GlowField, c: readonly [number, number, number], t: number): void {
    for (const s of this.sparks) {
      if (!s.active || s.taken) continue;
      const y = s.y + Math.sin(s.bob) * 0.18;
      glow.add(s.x, y, s.z, 0.95 + Math.sin(t * 6 + s.bob) * 0.12, 0.95, 1, 2, c[0], c[1], c[2]);
      glow.add(s.x, y, s.z, 2.1, 0.16, 1, 0, c[0], c[1], c[2]);
    }
  }

  /**
   * The "+400" / surge numbers that fountain off a resolved gate.
   *
   * They are placed at the lane they belong to, which on a wide screen is well
   * inside the frame and on a 390px phone is not: a "+100" over the outer lane
   * used to hang half off the edge as a meaningless "00". So the text is nudged
   * back inside the frame in screen units — it keeps its lane as long as the
   * lane fits, and gives that up rather than be unreadable.
   */
  drawPopups(digits: DigitField, proj: Projector, frame: Frame): void {
    for (const p of this.popups) {
      if (!p.active) continue;
      const t = p.t / p.life;
      const rise = easeOutCubic(Math.min(1, t * 2.1));
      const a = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
      const pop = t < 0.16 ? easeOutBack(t / 0.16) : 1;
      const size = p.size * pop;
      const y = p.y + rise * 2.2;

      proj.at(p.z, y);
      const halfW = (digits.measure(p.text, size) * Math.abs(proj.kx)) / 2;
      const nx = proj.x0 + proj.kx * p.x;
      const inside = keepInside(nx, halfW, popupEdge(frame.edge));
      const x = inside === nx ? p.x : proj.worldX(inside);

      digits.addNumber(p.text, x, y, p.z, size, p.r, p.g, p.b, a, 1.6);
    }
  }

  /* -------------------------------- helpers ------------------------------- */

  /** Is any pit currently spanning the player plane? */
  pitAt(z: number): Hazard | null {
    for (const h of this.hazards) {
      if (h.active && h.kind === "pit" && Math.abs(h.z - z) < 3.6) return h;
    }
    return null;
  }
}

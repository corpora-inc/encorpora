// Counterpoise.
//
// One verb: put brass on the thing. Everything the ladder adds — a sealed crate,
// three identical crates, a numbered arm, a balloon that pulls up, a weight cut
// into quarters — is a new *object*, never a new control. A child who can do the
// first board can physically do the last one; only the thinking changes.
//
// Wrongness is never announced. The beam simply tells the truth: it swings the
// way you made it swing, hits its stop, and hands the weight back.

import type { Host, Mounted } from "./contract.ts";
import type { Frac } from "./frac.ts";
import { ZERO, toNumber, toKey, add, isZero } from "./frac.ts";
import type { PlacedItem, PuzzleSpec, Side } from "./puzzle.ts";
import {
  PAN_PEG,
  netTorque,
  isBalanced,
  isPinned,
  minWeightsFor,
  rackCanMake,
  remainingFor,
} from "./puzzle.ts";
import {
  createInstructions,
  type Instructions,
} from "../../../packs/shared/game-chrome/index.ts";
import { specFromQuestion } from "./adapter.ts";
import { layoutForViewport, armDistance, beamPoint, rackSlot } from "./layout.ts";
import type { Layout } from "./layout.ts";
import {
  makeBeam,
  makeBody,
  stepBeam,
  stepBody,
  seatTarget,
  seatTargetPeg,
  dishCentre,
  launch,
  toss,
} from "./sim.ts";
import type { Beam, Body } from "./sim.ts";
import { Camera, Particles } from "./juice.ts";
import { Audio } from "./audio.ts";
import { Renderer } from "./draw.ts";
import type { ViewState } from "./draw.ts";
import { clamp01, easeOutElastic } from "./ease.ts";

type Phase = "intro" | "play" | "judging" | "wrong" | "solved";

const ROMAN = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
];

export class Game {
  private el: HTMLElement;
  private host: Host;
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private audio = new Audio();
  private cam = new Camera();
  private particles = new Particles();
  private beam: Beam = makeBeam();

  private L: Layout;
  private spec!: PuzzleSpec;
  private bodies: Body[] = [];
  private declared: Frac | null = null;
  private startNetSign = 0;
  private questionIndex = 0;
  private questionStart = 0;
  private errors = 0;
  private reported = false;

  private phase: Phase = "intro";
  private phaseT = 0;
  private solveT = 0;
  private lockFrom = 0;
  private lockT = 0;
  private wrongT = 0;
  private introT = 0;
  private idle = 0;
  private time = 0;

  solvedTotal = 0;
  gems = 0;

  private drag: Body | null = null;
  private dragFromRack = -1;
  private pointerId: number | null = null;
  private downAt = 0;
  private downX = 0;
  private downY = 0;
  private moved = 0;
  private hover: string | null = null;
  private kbFocus = -1;
  private kbVisible = false;

  private motes = new Float32Array(44 * 4);
  private moteVel = new Float32Array(44 * 2);
  private rackHop = new Float32Array(24);
  private banner: { text: string; sub: string; t: number } | null = null;

  private raf = 0;
  private lastT = 0;
  private running = true;
  private ro: ResizeObserver | null = null;
  private guide: Instructions;

  // measured, exposed for the playtest harness
  readonly stats = {
    frames: 0,
    fpsAvg: 0,
    worstMs: 0,
    lastAnswerLatencyMs: 0,
    frameMs: [] as number[],
  };

  constructor(el: HTMLElement, host: Host) {
    this.el = el;
    this.host = host;
    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.canvas.style.width = "100%";
    this.canvas.style.height = "100%";
    this.canvas.style.touchAction = "none";
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute("role", "application");
    this.canvas.setAttribute(
      "aria-label",
      "A balance scale. Place weights until both sides are level.",
    );
    el.appendChild(this.canvas);
    this.renderer = new Renderer(this.canvas);
    this.cam.reduced = host.prefersReducedMotion();

    // How to play. COUNTERPOISE shipped with nothing telling a child what the
    // brass is for: they were shown a tipped arm, a row of weights and a line
    // of engraved arithmetic, and left to guess that dragging is the verb. The
    // manual stays reachable during play, because the moment a child needs the
    // rules is never the title screen.
    this.guide = createInstructions(el, {
      title: "COUNTERPOISE",
      summary: [
        "A big brass scale hangs in front of you. One side is heavier, so the arm tips.",
        "Drag weights out of the row at the bottom until the arm sits flat.",
      ],
      sections: [
        {
          heading: "Playing",
          lines: [
            "The weights wait in a row along the bottom of the screen.",
            "Drag one to the empty dish and let go. It drops in.",
            "Each board has one place a weight can go. Aim for that place.",
            "Drag a weight back out of the dish to take it off again.",
            "On a keyboard: arrow keys pick a weight, Enter drops it, Backspace takes it back.",
          ],
        },
        {
          heading: "Flat means equal",
          lines: [
            "When the two sides weigh the same, the arm stops tipping and sits flat.",
            "That flat arm is the equals sign. Both sides really do weigh the same.",
            "The words cut into the stone say the same thing with numbers.",
          ],
        },
        {
          heading: "Sealed boxes",
          lines: [
            "Some boxes are shut and you cannot see inside.",
            "Work out how heavy the box must be to make the arm flat.",
            "Then drag that number onto the box to say it out loud.",
          ],
        },
        {
          heading: "The long arm",
          lines: [
            "Some arms have numbers marked along them.",
            "A weight far out from the middle pushes down harder than the same weight near the middle.",
            "A balloon does the opposite. It pulls up instead of down.",
          ],
        },
        {
          heading: "If it tips",
          lines: [
            "Nothing buzzes at you when you are wrong. The arm just swings the way you made it swing.",
            "Take the weight off and try a different one. You can try as many times as you want.",
          ],
        },
      ],
      reducedMotion: host.prefersReducedMotion(),
    });

    this.L = layoutForViewport(1, 1, 9);
    for (let i = 0; i < 44; i++) {
      this.motes[i * 4] = Math.random();
      this.motes[i * 4 + 1] = Math.random();
      this.motes[i * 4 + 2] = 0.6 + Math.random() * 1.9;
      this.motes[i * 4 + 3] = 0.15 + Math.random() * 0.6;
      this.moteVel[i * 2] = (Math.random() - 0.5) * 0.006;
      this.moteVel[i * 2 + 1] = -0.004 - Math.random() * 0.008;
    }

    this.loadNext(true);
    this.resize();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    window.addEventListener("resize", this.onWinResize);

    this.canvas.addEventListener("pointerdown", this.onDown);
    this.canvas.addEventListener("pointermove", this.onMove);
    this.canvas.addEventListener("pointerup", this.onUp);
    this.canvas.addEventListener("pointercancel", this.onUp);
    this.canvas.addEventListener("contextmenu", this.onContextMenu);
    window.addEventListener("keydown", this.onKey);

    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------------ setup

  private onWinResize = (): void => this.resize();
  private onContextMenu = (e: Event): void => e.preventDefault();

  private resize(): void {
    const r = this.el.getBoundingClientRect();
    const w = Math.max(240, Math.round(r.width || window.innerWidth));
    const h = Math.max(240, Math.round(r.height || window.innerHeight));
    // DPR capped at 2: a 3x phone would triple the fill cost for no visible gain.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.L = layoutForViewport(w, h, this.spec ? this.spec.rack.length : 9);
    this.renderer.resize(w, h, dpr);
    this.seatAll(true);
  }

  private loadNext(first = false): void {
    const q = this.host.next();
    this.spec = specFromQuestion(q, this.questionIndex);
    this.questionIndex++;
    this.declared = null;
    this.errors = 0;
    this.reported = false;
    this.bodies = [];
    this.beam.locked = false;
    this.beam.pinned = isPinned(this.spec, null);
    if (first) this.beam.pinOut = this.beam.pinned ? 0 : 1;

    const slotCount: Record<number, number> = { [-1]: 0, [1]: 0 };
    for (const f of this.spec.fixed) {
      const slot = slotCount[f.side]++;
      const b = makeBody({
        value: f.kind === "crate" ? ZERO : f.value,
        crate: f.kind === "crate",
        fixed: true,
        side: f.side,
        peg: f.peg,
        slot,
      });
      this.bodies.push(b);
    }
    this.L = layoutForViewport(this.L.w, this.L.h, this.spec.rack.length);
    this.seatAll(true);

    // Assemble: everything drops in from above with a stagger.
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      const tx = b.x;
      const ty = b.y;
      b.x = tx + (Math.random() - 0.5) * 40;
      b.y = -this.L.weightR * 3 - i * 30;
      launch(b, tx, ty, 0.34 + i * 0.07, this.L.weightR * 0.8);
    }

    const net = netTorque(this.spec, [], null);
    this.startNetSign = Math.sign(toNumber(net));
    this.questionStart = performance.now();
    this.phase = first ? "intro" : "play";
    this.phaseT = 0;
    this.solveT = 0;
    this.idle = 0;
  }

  // ------------------------------------------------------------ derivations

  private placed(): PlacedItem[] {
    const out: PlacedItem[] = [];
    for (const b of this.bodies) {
      if (b.fixed || b.crate) continue;
      if (b.state === "seated") {
        out.push({ id: b.id, side: b.side, peg: b.peg, value: b.value });
      }
    }
    return out;
  }

  private net(): Frac {
    return netTorque(this.spec, this.placed(), this.declared);
  }

  private netForBeam(): number {
    const scale = this.spec.mode === "pans" ? 1 / PAN_PEG : 1 / 2.4;
    return toNumber(this.net()) * scale;
  }

  private countOnSide(side: Side): number {
    let n = 0;
    for (const b of this.bodies) if (b.side === side && isOnBoard(b)) n++;
    return n;
  }

  /** Recompute every seat target. `snap` teleports (resize, load) instead of springing. */
  private seatAll(snap = false): void {
    const perSide: Record<number, number> = { [-1]: 0, [1]: 0 };
    for (const b of this.bodies) {
      if (!isOnBoard(b)) continue;
      b.slot = perSide[b.side]++;
    }
    for (const b of this.bodies) {
      if (!isOnBoard(b)) continue;
      const t =
        this.spec.mode === "beam"
          ? seatTargetPeg(this.L, this.beam, b.side, b.peg, b.slot)
          : seatTarget(this.L, this.beam, "pans", b.side, b.slot, this.countOnSide(b.side));
      b.tx = t.x;
      // a balloon does not sit in the dish, it strains upward off it
      b.ty = t.y - (b.balloon ? this.L.weightR * 2.05 : 0);
      b.trot = t.rot;
      if (snap && b.state === "seated") {
        b.x = t.x;
        b.y = t.y;
        b.rot = t.rot;
      }
    }
  }

  // ------------------------------------------------------------------- loop

  private frame = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const t0 = now;
    let dtReal = (now - this.lastT) / 1000;
    this.lastT = now;
    if (!(dtReal > 0)) dtReal = 1 / 60;
    dtReal = Math.min(dtReal, 1 / 20); // never let a stall teleport the physics

    this.time += dtReal;
    const dt = this.cam.step(dtReal);
    this.update(dt, dtReal);
    this.renderer.draw(this.view());

    const cost = performance.now() - t0;
    const s = this.stats;
    s.frames++;
    s.frameMs.push(cost);
    if (s.frameMs.length > 240) s.frameMs.shift();
    if (cost > s.worstMs) s.worstMs = cost;
    s.fpsAvg = s.fpsAvg * 0.94 + (1 / Math.max(0.001, dtReal)) * 0.06;
  };

  private update(dt: number, dtReal: number): void {
    // ambient dust
    for (let i = 0; i < 44; i++) {
      this.motes[i * 4] += this.moteVel[i * 2] * dtReal;
      this.motes[i * 4 + 1] += this.moteVel[i * 2 + 1] * dtReal;
      if (this.motes[i * 4 + 1] < -0.05) {
        this.motes[i * 4 + 1] = 1.05;
        this.motes[i * 4] = Math.random();
      }
      if (this.motes[i * 4] < -0.05) this.motes[i * 4] = 1.05;
      if (this.motes[i * 4] > 1.05) this.motes[i * 4] = -0.05;
    }

    if (this.phase === "intro") {
      this.introT += dtReal / 0.85;
      if (this.introT >= 1) {
        this.introT = 1;
        this.phase = "play";
      }
    } else if (this.introT < 1) this.introT = 1;

    this.phaseT += dt;
    this.idle += dtReal;

    for (let i = 0; i < this.rackHop.length; i++) {
      this.rackHop[i] = Math.max(0, this.rackHop[i] - dtReal * 2.6);
    }
    // idle wave: shows where to act without hinting which answer is right
    if (this.phase === "play" && this.idle > 8) {
      const k = Math.floor(((this.idle - 8) * 3) % (this.spec.rack.length + 4));
      if (k < this.spec.rack.length && this.rackHop[k] < 0.05) this.rackHop[k] = 0.7;
      // and remind them that what they placed can come back out
      for (const b of this.bodies) {
        if (!b.fixed && !b.crate && b.state === "seated" && b.glow < 0.05) b.glow = 0.55;
      }
    }

    stepBeam(this.beam, this.netForBeam(), dt, {
      onStop: (force) => this.onBeamStop(force),
    });
    if (this.phase === "solved") {
      // The arm seats level on REAL time, not slow-motion time: the whole
      // conceit is that the beam becomes the top bar of an equals sign, and a
      // tilted bar next to a level one does not read as one.
      this.lockT += dtReal;
      const prev = this.beam.theta;
      const k = clamp01(this.lockT / 0.5);
      this.beam.theta = this.lockFrom * (1 - easeOutElastic(k, 0.44));
      this.beam.omega = dtReal > 0 ? (this.beam.theta - prev) / dtReal : 0;
    }
    this.seatAll(false);
    for (const b of this.bodies) {
      stepBody(b, dt, {
        onLand: (bb) => this.onLand(bb),
        onArriveRack: () => undefined,
      });
    }
    this.bodies = this.bodies.filter((b) => b.state !== "gone");
    if (this.drag) stepBody(this.drag, dt);
    this.particles.step(dt);
    this.audio.setSwing(Math.min(1, Math.abs(this.beam.omega) * 0.9));

    if (this.wrongT > 0) this.wrongT = Math.max(0, this.wrongT - dtReal * 1.6);

    if (this.phase === "judging" && this.phaseT > 0.42) {
      this.judgeDeclare();
    }

    if (this.phase === "wrong" && this.phaseT > 0.85) {
      this.phase = "play";
      this.phaseT = 0;
      if (this.spec.kind === "declare") {
        this.declared = null;
        this.beam.pinned = true;
      }
    }

    if (this.phase === "solved") {
      const rate = this.cam.reduced ? 1 / 0.9 : 1 / 1.65;
      this.solveT += dtReal * rate;
      if (this.solveT > 0.5 && !this.dissolved) this.dissolve();
      if (this.solveT >= 1) this.advance();
    }

    if (this.banner) {
      this.banner.t += dtReal / 2.1;
      if (this.banner.t >= 1) this.banner = null;
    }
  }

  private dissolved = false;

  // ---------------------------------------------------------------- verdict

  private onBeamStop(force: number): void {
    this.audio.clank(force);
    this.cam.addTrauma(0.12 + force * 0.2);
    this.host.haptic(force > 0.6 ? "medium" : "light");
    const side: Side = this.beam.theta > 0 ? 1 : -1;
    const d =
      this.spec.mode === "pans"
        ? dishCentre(this.L, this.beam, side)
        : beamPoint(this.L, this.beam.theta, side, this.L.arm);
    for (let i = 0; i < 8; i++) {
      this.particles.spawn(
        0,
        d.x + (Math.random() - 0.5) * this.L.dishW,
        d.y,
        (Math.random() - 0.5) * 90,
        -20 - Math.random() * 60,
        0.5 + Math.random() * 0.4,
        2 + Math.random() * 3,
        40,
        140,
        1.9,
      );
    }
  }

  private onLand(b: Body): void {
    this.audio.clink(toNumber(b.value));
    this.cam.addTrauma(this.cam.reduced ? 0 : 0.07 + Math.min(0.14, Math.abs(toNumber(b.value)) * 0.012));
    this.cam.freeze(0.035);
    this.beam.omega += b.side * Math.abs(toNumber(b.value)) * 0.012;
    this.host.haptic("light");
    const n = this.cam.reduced ? 3 : 9;
    for (let i = 0; i < n; i++) {
      this.particles.spawn(
        0,
        b.x + (Math.random() - 0.5) * this.L.weightR * 1.6,
        b.y + this.L.weightR * 0.5,
        (Math.random() - 0.5) * 150,
        -40 - Math.random() * 90,
        0.35 + Math.random() * 0.35,
        1.6 + Math.random() * 2.6,
        42,
        260,
        2.4,
      );
    }
    if (!this.cam.reduced) {
      for (let i = 0; i < 4; i++) {
        this.particles.spawn(
          1,
          b.x,
          b.y,
          (Math.random() - 0.5) * 320,
          -120 - Math.random() * 180,
          0.22 + Math.random() * 0.2,
          3 + Math.random() * 2,
          44,
          900,
          1.2,
        );
      }
    }
    if (b.fixed) return;
    this.checkAfterPlacement(b);
  }

  private checkAfterPlacement(b: Body): void {
    if (this.phase === "solved") return;
    const placed = this.placed();
    if (isBalanced(this.spec, placed, this.declared)) {
      this.solve();
      return;
    }
    const netNow = Math.sign(toNumber(this.net()));
    const crossed = this.startNetSign !== 0 && netNow !== 0 && netNow !== this.startNetSign;
    if (this.spec.kind === "hang" || crossed) {
      // Too far. The beam has already swung past level and hit its stop; the
      // dish tips and hands the weight back.
      this.wrong(b);
      return;
    }
    // Dead end: what is left cannot be made from the rack (1/3 placed when 1/2
    // was wanted, and there is no 1/6). The child is not wrong, they are stuck,
    // and being stuck with no way out is how a puzzle game loses a ten-year-old.
    // The dish simply tips and gives everything back.
    const left = remainingFor(this.spec, placed);
    if (left && !rackCanMake(this.spec.rack, left)) this.spill();
  }

  /** Tip the dish: every weight the player put in comes back to the rack. */
  private spill(): void {
    let any = false;
    for (const b of this.bodies) {
      if (b.fixed || b.crate || b.state !== "seated") continue;
      const i = this.spec.rack.findIndex((r) => r.n === b.value.n && r.d === b.value.d);
      const target = rackSlot(this.L, Math.max(0, i), this.spec.rack.length);
      toss(b, target.x, target.y, 0.55);
      b.vy -= 200;
      any = true;
    }
    if (!any) return;
    this.audio.chain(5);
    this.cam.addTrauma(0.14);
    this.host.haptic("medium");
    this.beam.omega += (this.spec.fillSide ?? 1) * -0.5;
  }

  private wrong(b: Body | null): void {
    this.errors++;
    this.phase = "wrong";
    this.phaseT = 0;
    this.wrongT = 1;
    this.audio.reject();
    this.host.haptic("failure");
    this.cam.addTrauma(0.16);
    this.cam.freeze(0.05);
    this.report(false);
    if (b) {
      const slotIndex = this.spec.rack.findIndex(
        (r) => r.n === b.value.n && r.d === b.value.d,
      );
      const target = rackSlot(this.L, Math.max(0, slotIndex), this.spec.rack.length);
      b.fixed = false;
      toss(b, target.x, target.y, 0.62);
      b.state = "eject";
      b.vy -= 260;
    }
  }

  private judgeDeclare(): void {
    this.phase = "play";
    this.phaseT = 0;
    if (isBalanced(this.spec, this.placed(), this.declared)) {
      this.solve();
    } else {
      const crateBody = this.bodies.find((x) => x.crate);
      this.errors++;
      this.phase = "wrong";
      this.phaseT = 0;
      this.wrongT = 1;
      this.audio.reject();
      this.host.haptic("failure");
      this.cam.addTrauma(0.18);
      this.report(false);
      if (crateBody) {
        for (let i = 0; i < (this.cam.reduced ? 3 : 12); i++) {
          this.particles.spawn(
            3,
            crateBody.x,
            crateBody.y,
            (Math.random() - 0.5) * 260,
            -60 - Math.random() * 200,
            0.4 + Math.random() * 0.3,
            4 + Math.random() * 3,
            160,
            900,
            1.6,
          );
        }
        crateBody.sq = 0.28;
      }
    }
  }

  private solve(): void {
    if (this.phase === "solved") return;
    this.phase = "solved";
    this.phaseT = 0;
    this.solveT = 0;
    this.dissolved = false;
    this.beam.locked = true;
    this.lockFrom = this.beam.theta;
    this.lockT = 0;
    this.report(true);

    this.cam.freeze(0.1);
    this.cam.slowmo(0.2, 0.45);
    this.cam.addTrauma(0.46);
    this.cam.addPunch(0.05);
    this.cam.flash(0.2);
    this.audio.solve(this.solvedTotal);
    this.host.haptic("success");

    const burst = this.cam.reduced ? 10 : 64;
    for (const side of [-1, 1] as Side[]) {
      const d =
        this.spec.mode === "pans"
          ? dishCentre(this.L, this.beam, side)
          : beamPoint(this.L, this.beam.theta, side, this.L.arm * 0.6);
      for (let i = 0; i < burst / 2; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 420;
        this.particles.spawn(
          2,
          d.x,
          d.y,
          Math.cos(a) * sp,
          Math.sin(a) * sp - 180,
          0.75 + Math.random() * 0.9,
          2 + Math.random() * 3.4,
          38 + Math.random() * 18,
          -110,
          1.05,
        );
      }
    }
    if (!this.cam.reduced) {
      for (let i = 0; i < 22; i++) {
        const a = Math.random() * Math.PI * 2;
        this.particles.spawn(
          1,
          this.L.pivot.x,
          this.L.pivot.y,
          Math.cos(a) * (200 + Math.random() * 520),
          Math.sin(a) * (200 + Math.random() * 520),
          0.3 + Math.random() * 0.3,
          3 + Math.random() * 3,
          46,
          260,
          1.5,
        );
      }
    }
  }

  /** Halfway through the celebration the brass turns to light and flies to the orrery. */
  private dissolve(): void {
    this.dissolved = true;
    this.audio.tick(this.solvedTotal);
    const cx = this.L.pivot.x;
    const cy = this.L.pivot.y + this.L.arm * 0.16;
    for (const b of this.bodies) {
      const n = this.cam.reduced ? 2 : 7;
      for (let i = 0; i < n; i++) {
        const dx = cx - b.x;
        const dy = cy - b.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        this.particles.spawn(
          2,
          b.x + (Math.random() - 0.5) * this.L.weightR,
          b.y + (Math.random() - 0.5) * this.L.weightR,
          (dx / len) * (240 + Math.random() * 240),
          (dy / len) * (240 + Math.random() * 240) - 60,
          0.55 + Math.random() * 0.4,
          2 + Math.random() * 2.4,
          40 + Math.random() * 14,
          -40,
          1.2,
        );
      }
    }
  }

  private advance(): void {
    this.solvedTotal++;
    if (this.errors === 0) this.gems++;
    const prevMovement = this.spec.movement;
    this.loadNext();
    if (this.spec.movement !== prevMovement || this.solvedTotal === 1) {
      this.banner = {
        text: this.spec.movementName,
        sub: `MOVEMENT ${ROMAN[Math.min(this.spec.movement, ROMAN.length - 1)]}`,
        t: 0,
      };
      if (this.solvedTotal > 0) this.audio.fanfare();
      this.cam.addPunch(0.02);
    }
  }

  private report(correct: boolean): void {
    if (correct && this.reported) return;
    const ms = performance.now() - this.questionStart;
    this.stats.lastAnswerLatencyMs = ms;
    let answered = "";
    if (this.spec.kind === "declare") answered = this.declared ? toKey(this.declared) : "";
    else if (this.spec.kind === "hang") {
      const p = this.placed();
      answered = p.length ? toKey(p[p.length - 1].value) : "";
    } else {
      let sum: Frac = ZERO;
      for (const p of this.placed()) sum = add(sum, p.value);
      answered = toKey(sum);
    }
    this.host.report({ questionId: this.spec.id, correct, ms, answered });
    if (correct) this.reported = true;
  }

  // ------------------------------------------------------------------ input

  private localPoint(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.canvas.focus();
    this.audio.unlock();
    this.idle = 0;
    const p = this.localPoint(e);

    // sound toggle. Its box comes from the layout, which puts it clear of the
    // host's top-right control — the old `y < pad + 34` test was underneath it,
    // so the child's tap opened how-to-play and the speaker never toggled.
    const s = this.L.sound;
    if (Math.abs(p.x - s.x) < s.half && Math.abs(p.y - s.y) < s.half) {
      this.audio.setEnabled(!this.audio.isEnabled);
      this.audio.lift();
      return;
    }
    if (this.phase === "solved" || this.phase === "judging") return;
    if (this.pointerId !== null) return;

    this.pointerId = e.pointerId;
    this.downAt = performance.now();
    this.downX = p.x;
    this.downY = p.y;
    this.moved = 0;
    this.kbVisible = false;

    const rackHit = this.hitRack(p.x, p.y);
    if (rackHit >= 0) {
      this.startDrag(this.spec.rack[rackHit], p.x, p.y, rackHit);
      this.capture(e.pointerId);
      return;
    }
    // pick a placed weight back up
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i];
      if (b.fixed || b.crate || b.state !== "seated") continue;
      if (Math.hypot(b.x - p.x, b.y - p.y) < this.L.weightR * 1.35) {
        this.bodies.splice(i, 1);
        this.drag = b;
        b.state = "drag";
        b.x = p.x;
        b.y = p.y - this.L.weightR * 1.1;
        b.sq = 0.16;
        this.dragFromRack = -1;
        this.audio.lift();
        this.host.haptic("light");
        this.capture(e.pointerId);
        return;
      }
    }
  };

  private capture(id: number): void {
    // A synthetic pointer (playtest harness) has no active capture target.
    try {
      this.canvas.setPointerCapture(id);
    } catch {
      /* not capturable; dragging still works via the canvas listeners */
    }
  }

  private startDrag(value: Frac, x: number, y: number, rackIndex: number): void {
    const b = makeBody({ value, state: "drag" });
    b.x = x;
    b.y = y - this.L.weightR * 1.1;
    b.sq = 0.2;
    b.glow = 1;
    this.drag = b;
    this.dragFromRack = rackIndex;
    this.rackHop[rackIndex] = 1;
    this.audio.lift();
    this.host.haptic("light");
  }

  private onMove = (e: PointerEvent): void => {
    if (this.pointerId !== e.pointerId) return;
    const p = this.localPoint(e);
    this.moved = Math.max(this.moved, Math.hypot(p.x - this.downX, p.y - this.downY));
    this.idle = 0;
    if (!this.drag) return;
    // A little lag makes the object feel like it has mass in the hand.
    const b = this.drag;
    const tx = p.x;
    const ty = p.y - this.L.weightR * 1.35;
    b.rotVel += (tx - b.x) * 0.0016;
    b.rotVel *= 0.9;
    b.rot = Math.max(-0.45, Math.min(0.45, b.rot + b.rotVel));
    b.x += (tx - b.x) * 0.55;
    b.y += (ty - b.y) * 0.55;
    this.hover = this.zoneAt(p.x, p.y);
  };

  private onUp = (e: PointerEvent): void => {
    if (this.pointerId !== e.pointerId) return;
    this.pointerId = null;
    const p = this.localPoint(e);
    const quick = performance.now() - this.downAt < 260 && this.moved < 12;
    if (!this.drag) return;
    const b = this.drag;
    this.drag = null;
    this.hover = null;

    if (quick && this.dragFromRack < 0) {
      // a tap on something already in the dish means "take it back"
      this.returnToRack(b);
      this.dragFromRack = -1;
      return;
    }
    // There is exactly one place a weight can go, so a near miss is intent, not
    // error. Only a drop back onto the rack rail means "put it back".
    const overRack = p.y > this.L.rack.y - this.L.rack.slotH * 0.35;
    const zone = overRack ? null : (this.zoneAt(p.x, p.y) ?? this.defaultZone());
    if (zone) this.commit(b, zone);
    else this.returnToRack(b);
    this.dragFromRack = -1;
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === "m" || e.key === "M") {
      this.audio.unlock();
      this.audio.setEnabled(!this.audio.isEnabled);
      return;
    }
    if (this.phase === "solved" || this.phase === "judging") return;
    const n = this.spec.rack.length;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      this.kbVisible = true;
      this.kbFocus = (this.kbFocus + 1 + n) % n;
      this.idle = 0;
      this.audio.unlock();
      this.rackHop[this.kbFocus] = 0.5;
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      this.kbVisible = true;
      this.kbFocus = (this.kbFocus - 1 + n) % n;
      this.idle = 0;
      this.audio.unlock();
      this.rackHop[this.kbFocus] = 0.5;
      e.preventDefault();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      this.audio.unlock();
      if (this.kbFocus < 0) this.kbFocus = 0;
      this.kbVisible = true;
      this.placeFromRack(this.kbFocus);
      e.preventDefault();
      return;
    }
    if (e.key === "Backspace") {
      this.audio.unlock();
      this.undoLast();
      e.preventDefault();
      return;
    }
    if (/^[1-9]$/.test(e.key)) {
      this.audio.unlock();
      const i = Number(e.key) - 1;
      if (i < n) {
        this.kbVisible = true;
        this.kbFocus = i;
        this.placeFromRack(i);
      }
      e.preventDefault();
    }
  };

  private placeFromRack(i: number): void {
    if (i < 0 || i >= this.spec.rack.length) return;
    const p = rackSlot(this.L, i, this.spec.rack.length);
    const b = makeBody({ value: this.spec.rack[i], state: "drag" });
    b.x = p.x;
    b.y = p.y;
    b.glow = 1;
    this.rackHop[i] = 1;
    this.idle = 0;
    this.audio.lift();
    const zone = this.defaultZone();
    if (zone) this.commit(b, zone);
  }

  private undoLast(): void {
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i];
      if (b.fixed || b.crate || b.state !== "seated") continue;
      this.bodies.splice(i, 1);
      const slotIndex = this.spec.rack.findIndex(
        (r) => r.n === b.value.n && r.d === b.value.d,
      );
      const target = rackSlot(this.L, Math.max(0, slotIndex), this.spec.rack.length);
      toss(b, target.x, target.y, 0.5);
      this.bodies.push(b);
      this.audio.lift();
      this.idle = 0;
      return;
    }
    if (this.spec.kind === "declare" && this.declared) {
      this.declared = null;
      this.beam.pinned = true;
      this.audio.pin();
    }
  }

  /** The one place a tap or a keypress can go, given the board. */
  private defaultZone(): string | null {
    if (this.spec.kind === "fill") return "dish";
    if (this.spec.kind === "declare") return "crate";
    if (this.spec.kind === "hang") return "peg";
    return null;
  }

  private zoneAt(x: number, y: number): string | null {
    if (this.spec.kind === "fill" && this.spec.fillSide !== null) {
      const d = dishCentre(this.L, this.beam, this.spec.fillSide);
      if (
        Math.abs(x - d.x) < this.L.dishW * 1.05 &&
        Math.abs(y - d.y) < this.L.dishW * 0.85
      )
        return "dish";
      return null;
    }
    if (this.spec.kind === "declare") {
      for (const b of this.bodies) {
        if (!b.crate) continue;
        if (Math.hypot(x - b.x, y - b.y) < this.L.crateR * 2) return "crate";
      }
      return null;
    }
    if (this.spec.kind === "hang" && this.spec.hangSlot) {
      const p = beamPoint(
        this.L,
        this.beam.theta,
        this.spec.hangSlot.side,
        armDistance(this.L, "beam", this.spec.hangSlot.peg),
      );
      if (Math.hypot(x - p.x, y - (p.y + this.L.weightR * 1.5)) < this.L.weightR * 2.4)
        return "peg";
      return null;
    }
    return null;
  }

  /** Where the single valid drop target currently is, in CSS pixels. */
  private zonePoint(): { x: number; y: number } {
    if (this.spec.kind === "declare") {
      const c = this.bodies.find((b) => b.crate);
      if (c) return { x: Math.round(c.x), y: Math.round(c.y) };
    }
    if (this.spec.kind === "hang" && this.spec.hangSlot) {
      const p = beamPoint(
        this.L,
        this.beam.theta,
        this.spec.hangSlot.side,
        armDistance(this.L, "beam", this.spec.hangSlot.peg),
      );
      return { x: Math.round(p.x), y: Math.round(p.y + this.L.weightR * 1.5) };
    }
    const d = dishCentre(this.L, this.beam, this.spec.fillSide ?? 1);
    return { x: Math.round(d.x), y: Math.round(d.y) };
  }

  private commit(b: Body, zone: string): void {
    this.idle = 0;
    if (zone === "crate" && this.spec.kind === "declare") {
      this.declared = b.value;
      this.beam.pinned = false;
      this.phase = "judging";
      this.phaseT = 0;
      this.audio.pin();
      this.host.haptic("medium");
      this.cam.addTrauma(0.06);
      const crateBody = this.bodies.find((x) => x.crate);
      if (crateBody) {
        crateBody.sq = 0.22;
        crateBody.glow = 1;
        for (let i = 0; i < (this.cam.reduced ? 3 : 14); i++) {
          this.particles.spawn(
            2,
            crateBody.x,
            crateBody.y,
            (Math.random() - 0.5) * 220,
            -80 - Math.random() * 160,
            0.4 + Math.random() * 0.4,
            2 + Math.random() * 2,
            44,
            300,
            1.4,
          );
        }
      }
      // the declared numeral itself is consumed by the crate
      b.state = "gone";
      return;
    }
    if (zone === "dish" && this.spec.kind === "fill" && this.spec.fillSide !== null) {
      b.side = this.spec.fillSide;
      b.peg = PAN_PEG;
      b.state = "seated";
      this.bodies.push(b);
      this.seatAll(false);
      const t = seatTarget(
        this.L,
        this.beam,
        "pans",
        b.side,
        b.slot,
        this.countOnSide(b.side),
      );
      launch(b, t.x, t.y, 0.22, this.L.weightR * 0.9);
      return;
    }
    if (zone === "peg" && this.spec.kind === "hang" && this.spec.hangSlot) {
      // one hook, one weight: an earlier attempt is quietly returned
      for (let i = this.bodies.length - 1; i >= 0; i--) {
        const o = this.bodies[i];
        if (!o.fixed && !o.crate) {
          const slotIndex = this.spec.rack.findIndex(
            (r) => r.n === o.value.n && r.d === o.value.d,
          );
          const target = rackSlot(this.L, Math.max(0, slotIndex), this.spec.rack.length);
          toss(o, target.x, target.y, 0.5);
        }
      }
      b.side = this.spec.hangSlot.side;
      b.peg = this.spec.hangSlot.peg;
      b.state = "seated";
      this.bodies.push(b);
      this.seatAll(false);
      const t = seatTargetPeg(this.L, this.beam, b.side, b.peg, 0);
      launch(b, t.x, t.y, 0.24, this.L.weightR * 0.9);
      return;
    }
    this.returnToRack(b);
  }

  private returnToRack(b: Body): void {
    const i =
      this.dragFromRack >= 0
        ? this.dragFromRack
        : Math.max(
            0,
            this.spec.rack.findIndex((r) => r.n === b.value.n && r.d === b.value.d),
          );
    const target = rackSlot(this.L, i, this.spec.rack.length);
    toss(b, target.x, target.y, 0.42);
    this.bodies.push(b);
    this.audio.lift();
  }

  private hitRack(x: number, y: number): number {
    const n = this.spec.rack.length;
    for (let i = 0; i < n; i++) {
      const p = rackSlot(this.L, i, n);
      // generous: a fingertip is 9 mm and the visual is smaller than that
      if (
        Math.abs(x - p.x) < this.L.rack.slotW * 0.5 &&
        Math.abs(y - p.y) < this.L.rack.slotH * 0.5
      )
        return i;
    }
    return -1;
  }

  // ------------------------------------------------------------------- view

  private view(): ViewState {
    return {
      L: this.L,
      beam: this.beam,
      spec: this.spec,
      bodies: this.bodies,
      drag: this.drag,
      dragX: 0,
      dragY: 0,
      hover: this.hover,
      cam: this.cam,
      particles: this.particles,
      motes: this.motes,
      time: this.time,
      solvedTotal: this.solvedTotal,
      gems: this.gems,
      solveT: this.phase === "solved" ? clamp01(this.solveT) : 0,
      wrong: this.wrongT,
      declared: this.declared,
      idle: this.idle > 8 ? this.idle - 8 : 0,
      reduced: this.cam.reduced,
      audioOn: this.audio.isEnabled,
      intro: this.introT,
      banner: this.banner,
      rackHop: this.rackHop,
      kbFocus: this.kbVisible ? this.kbFocus : -1,
      bodyFade:
        this.phase === "solved" && this.solveT > 0.55
          ? clamp01(1 - (this.solveT - 0.55) / 0.4)
          : 1,
      netFloat: this.netForBeam(),
    };
  }

  // ------------------------------------------------------------------ debug

  /** Used by the playtest harness. Not part of the host contract. */
  readonly debug = {
    solveCurrent: (): void => {
      const spec = this.spec;
      if (spec.kind === "declare") {
        const b = makeBody({ value: spec.answer, state: "drag" });
        this.commit(b, "crate");
        return;
      }
      if (spec.kind === "hang") {
        const b = makeBody({ value: spec.answer, state: "drag" });
        this.commit(b, "peg");
        return;
      }
      const idx = spec.rack.findIndex(
        (r) => r.n === spec.answer.n && r.d === spec.answer.d,
      );
      if (idx >= 0) {
        const b = makeBody({ value: spec.answer, state: "drag" });
        this.commit(b, "dish");
      } else {
        // build it from pieces, greedily, largest first
        let remaining = spec.answer;
        const sorted = spec.rack
          .slice()
          .sort((a, c) => Math.abs(toNumber(c)) - Math.abs(toNumber(a)));
        let guard = 0;
        while (!isZero(remaining) && guard++ < 12) {
          const pick = sorted.find(
            (r) => Math.abs(toNumber(r)) <= Math.abs(toNumber(remaining)) + 1e-9,
          );
          if (!pick) break;
          const b = makeBody({ value: pick, state: "drag" });
          this.commit(b, "dish");
          remaining = add(remaining, { n: -pick.n, d: pick.d });
        }
      }
    },
    placeWrong: (): void => {
      const spec = this.spec;
      const wrongValue = spec.rack.find(
        (r) => !(r.n === spec.answer.n && r.d === spec.answer.d),
      );
      if (!wrongValue) return;
      const b = makeBody({ value: wrongValue, state: "drag" });
      this.commit(b, this.defaultZone() ?? "dish");
    },
    /**
     * Fixed-step advance. requestAnimationFrame is throttled to zero in a
     * background tab, so a playtest that only waits is testing nothing; this
     * drives the identical update path at a fixed dt and repaints once.
     */
    advance: (seconds: number, dtMs = 1000 / 60): void => {
      const dt = dtMs / 1000;
      const steps = Math.max(1, Math.round(seconds / dt));
      for (let i = 0; i < steps; i++) {
        this.time += dt;
        this.update(this.cam.step(dt), dt);
      }
      this.renderer.draw(this.view());
      this.lastT = performance.now();
    },
    /**
     * Frame-cost bench: runs the exact per-frame body (update + draw) and
     * reports the distribution in milliseconds. This is the number that matters
     * for the 16.7 ms budget, independent of display refresh or tab throttling.
     */
    bench: (frames = 240): Record<string, number> => {
      const dt = 1 / 60;
      const costs: number[] = [];
      for (let i = 0; i < frames; i++) {
        const t0 = performance.now();
        this.time += dt;
        this.update(this.cam.step(dt), dt);
        this.renderer.draw(this.view());
        costs.push(performance.now() - t0);
      }
      costs.sort((x, y) => x - y);
      const at = (q: number): number =>
        Math.round(costs[Math.min(costs.length - 1, Math.floor(costs.length * q))] * 100) / 100;
      this.lastT = performance.now();
      return {
        frames,
        p50: at(0.5),
        p90: at(0.9),
        p99: at(0.99),
        max: Math.round(costs[costs.length - 1] * 100) / 100,
        headroomAt60: Math.round((16.67 / Math.max(0.01, at(0.99))) * 100) / 100,
      };
    },
    stats: this.stats,
    state: (): Record<string, unknown> => ({
      phase: this.phase,
      prompt: this.spec.prompt,
      kind: this.spec.kind,
      movement: this.spec.movementName,
      answer: toKey(this.spec.answer),
      solved: this.solvedTotal,
      gems: this.gems,
      minWeights: minWeightsFor(this.spec.rack, this.spec.answer),
      fps: Math.round(this.stats.fpsAvg),
      kbVisible: this.kbVisible,
      theta: Number(this.beam.theta.toFixed(4)),
      pinned: this.beam.pinned,
      declared: this.declared ? toKey(this.declared) : null,
      placed: this.placed().map((p) => toKey(p.value)),
      particles: this.particles.live,
      rackY: Math.round(rackSlot(this.L, 0, this.spec.rack.length).y),
      rack: this.spec.rack.map((r) => toKey(r)),
      rackXs: this.spec.rack.map((_, i) =>
        Math.round(rackSlot(this.L, i, this.spec.rack.length).x),
      ),
      zone: this.zonePoint(),
      remaining: (() => {
        const r = remainingFor(this.spec, this.placed());
        return r ? toKey(r) : toKey(this.spec.answer);
      })(),
    }),
  };

  unmount(): void {
    this.running = false;
    this.guide.destroy();
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener("resize", this.onWinResize);
    window.removeEventListener("keydown", this.onKey);
    this.canvas.removeEventListener("pointerdown", this.onDown);
    this.canvas.removeEventListener("pointermove", this.onMove);
    this.canvas.removeEventListener("pointerup", this.onUp);
    this.canvas.removeEventListener("pointercancel", this.onUp);
    this.canvas.removeEventListener("contextmenu", this.onContextMenu);
    this.audio.dispose();
    this.canvas.remove();
  }
}

export function mount(el: HTMLElement, host: Host): Mounted & { debug: Game["debug"] } {
  const g = new Game(el, host);
  return { unmount: () => g.unmount(), debug: g.debug };
}

function isOnBoard(b: Body): boolean {
  return b.state === "seated" || b.state === "fly";
}

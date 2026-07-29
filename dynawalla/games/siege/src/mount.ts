/**
 * The controller. Owns the loop, the input, and the translation from simulation
 * events into noise, light and shaking.
 *
 * Every juice number in here is named in JUICE (constants.ts) so the feel can be
 * tuned without reading the code.
 */
import {
  createInstructions,
  onInsetsChange,
  safeInsets,
  type Instructions,
} from "../../../packs/shared/game-chrome/index.ts";
import type { Host, Question } from "./contract.ts";
import { Clock, FIXED_DT } from "./core/time.ts";
import { Camera } from "./core/camera.ts";
import { makeRng, hashSeed, type Rng } from "./core/rng.ts";
import { clamp01 } from "./core/easing.ts";
import { Audio } from "./audio/audio.ts";
import { Particles, burstSparks, burstShatter, ring, emberMote } from "./render/particles.ts";
import { bakeBoard } from "./render/bake.ts";
import { Renderer, computeView, screenToBoard, boardToScreen, type View } from "./render/draw.ts";
import { boardSafe } from "./ui/chrome.ts";
import { Hud } from "./ui/hud.ts";
import {
  CORE_MAX_HP,
  JUICE,
  OVERCHARGE_MAX,
  OVERCHARGE_PER_ANSWER,
  OVERCHARGE_WINDOW,
  QUENCH_SECONDS,
  TOWERS,
  EARLY_CALL_BONUS,
  type TowerKind,
} from "./game/constants.ts";
import {
  createState,
  step,
  tryBuild,
  applyUpgrade,
  grantEmbers,
  callWaveEarly,
  detonateOvercharge,
  emberReward,
  totalDps,
  towerAt,
  towerDps,
  upgradeCost,
  type Effects,
  type Enemy,
  type State,
  type Tower,
} from "./game/state.ts";
import { buildWave, mathFloor, type WaveSpec } from "./game/waves.ts";

/** level-1 throughput for each tower, computed once from the same maths the sim uses */
const BASE_DPS: Record<TowerKind, number> = {
  bolt: towerDps({ kind: "bolt", level: 0 } as Tower),
  mortar: towerDps({ kind: "mortar", level: 0 } as Tower),
  chain: towerDps({ kind: "chain", level: 0 } as Tower),
};

type FocusMode =
  | null
  | { kind: "overcharge"; q: Question; order: number[]; left: number }
  | { kind: "upgrade"; q: Question; order: number[]; tower: Tower };

export class Siege {
  private host: Host;
  private hud: Hud;
  private ctx: CanvasRenderingContext2D;
  private clock = new Clock();
  private cam = new Camera();
  private parts = new Particles();
  private renderer = new Renderer();
  private audio = new Audio();
  private rng: Rng;
  private state: State;
  private view: View;
  private ro: ResizeObserver | null = null;
  private guide: Instructions | null = null;
  private stopInsets: (() => void) | null = null;
  private raf = 0;
  private lastT = 0;
  private destroyed = false;

  private q: Question | null = null;
  private order: number[] = [0, 1, 2, 3];
  private askedAt = 0;
  private coldUntil = 0;
  private focus: FocusMode = null;
  private answering = false;

  private hoverPlot = -1;
  private selectedPlot = -1;
  private buildPreview: TowerKind | null = null;
  private armed: TowerKind | null = null;
  private hint = 1;
  private prevEmbers = 0;
  private prevCoreHp = CORE_MAX_HP;
  private soundOn = true;
  private seed: number;

  // instrumentation the playtest reads
  private frames = 0;
  private frameAcc = 0;
  fps = 0;
  worstFrame = 0;

  private fx: Effects;

  constructor(host: HTMLElement, gameHost: Host) {
    this.host = gameHost;
    this.seed = hashSeed(`siege-${Math.floor(Date.now() / 86400000)}`);
    this.rng = makeRng(this.seed);
    this.state = createState(this.seed);

    this.hud = new Hud(host, {
      onAnswer: (i) => this.answer(i),
      onFocusAnswer: (i) => this.focusAnswer(i),
      onFocusCancel: () => this.cancelFocus(),
      onOvercharge: () => this.openOvercharge(),
      onSpeed: () => this.toggleSpeed(),
      onSound: () => this.toggleSound(),
      onRestart: () => this.restart(),
      onBuy: (k) => this.build(k),
      onArm: (k) => this.arm(k),
      onUpgrade: () => this.openUpgrade(),
      onCallWave: () => this.callWave(),
    });

    const c = this.hud.canvas.getContext("2d", { alpha: false });
    if (!c) throw new Error("SIEGE needs a 2d canvas context");
    this.ctx = c;

    this.cam.reducedMotion = this.host.prefersReducedMotion();
    this.hud.setReducedMotion(this.cam.reducedMotion);

    this.renderer.setBaked(bakeBoard(this.state.plots, this.state.path));
    this.view = computeView(1, 1, 1, { x: 0, y: 0, w: 1, h: 1 });
    this.resize();

    this.fx = this.makeEffects();

    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(this.hud.board);
    }
    window.addEventListener("resize", this.onResize);
    this.stopInsets = onInsetsChange(this.onResize);
    this.hud.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.hud.canvas.addEventListener("pointermove", this.onPointerMove);
    this.hud.canvas.addEventListener("pointerleave", this.onPointerLeave);
    window.addEventListener("keydown", this.onKey);
    this.hud.root.addEventListener("pointerdown", this.firstGesture, { once: true });

    // How to play. SIEGE opens on a board of empty sockets, a river of lava and
    // the words "HOLD THE FORGE", and nothing anywhere says that the sums at the
    // bottom are how you pay for the guns. A child who does not work that out in
    // the first thirty seconds watches the wave walk into the core and decides
    // the game is broken. The manual stays reachable mid-wave, because the
    // moment a child needs the rules is never the title.
    this.guide = createInstructions(host, {
      title: "SIEGE",
      summary: [
        "Things are walking up the lava river to your forge. Stop them.",
        "You buy guns with embers, and you get embers by answering the sums at the bottom.",
      ],
      sections: [
        {
          heading: "Getting embers",
          lines: [
            "A sum is always waiting at the bottom of the screen.",
            "Four answers sit under it. Tap the right one and embers fly up to the counter.",
            "Tap a wrong one and the anvil goes cold for about a second. You lose no life. You just cannot earn while it is cold.",
          ],
        },
        {
          heading: "Building a gun",
          lines: [
            "Tap an empty socket beside the river. A little menu opens.",
            "BOLT is cheap and fast. MORTAR hits a group. CHAIN jumps between enemies.",
            "The cost is on the button. If you do not have enough embers yet, answer more sums.",
          ],
        },
        {
          heading: "Making a gun stronger",
          lines: [
            "Tap a gun you already built.",
            "Everything slows down and one harder sum fills the screen.",
            "Get it right and that gun goes up a level. You can do this five times per gun.",
          ],
        },
        {
          heading: "The overcharge",
          lines: [
            "Every right answer fills the OVERCHARGE bar a little.",
            "When it is full the bar goes bright. Tap it.",
            "Time almost stops and you get one big sum. Get it right and a blast pushes the whole wave back down the river.",
          ],
        },
        {
          heading: "Staying alive",
          lines: [
            "The row of small orange bars at the top is your forge. Every enemy that reaches it takes one away.",
            "When they are all gone the run is over, and you can start again.",
            "Waves get harder. Build early, and keep answering sums while you fight.",
          ],
        },
      ],
      reducedMotion: this.cam.reducedMotion,
    });

    this.nextQuestion();
    this.hud.showBanner("SIEGE", "HOLD THE FORGE");
    this.syncHud(true);

    (globalThis as unknown as { __siege?: unknown }).__siege = this;

    this.lastT = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // -- lifecycle -----------------------------------------------------------

  private firstGesture = (): void => {
    void this.audio.start();
  };

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("keydown", this.onKey);
    this.stopInsets?.();
    this.stopInsets = null;
    this.guide?.destroy();
    this.guide = null;
    this.hud.destroy();
    if ((globalThis as unknown as { __siege?: unknown }).__siege === this) {
      delete (globalThis as unknown as { __siege?: unknown }).__siege;
    }
  }

  private onResize = (): void => this.resize();

  private resize(): void {
    const b = this.hud.board;
    const w = Math.max(1, b.clientWidth);
    const h = Math.max(1, b.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.hud.canvas.width = Math.round(w * dpr);
    this.hud.canvas.height = Math.round(h * dpr);
    // Measured every resize, never cached from construction: a rotation trades
    // one top inset for two side ones, and iPadOS changes them when the pack is
    // resized in Split View. Read once and you are correct until the first
    // rotation and wrong after it.
    this.view = computeView(w, h, dpr, boardSafe(w, h, safeInsets()));
  }

  restart(): void {
    this.state = createState(this.seed + 1);
    this.seed += 1;
    this.renderer.setBaked(bakeBoard(this.state.plots, this.state.path));
    this.parts.clear();
    this.clock.reset();
    this.cam.reset();
    this.hint = 1;
    this.selectedPlot = -1;
    this.hoverPlot = -1;
    this.focus = null;
    this.coldUntil = 0;
    this.prevCoreHp = CORE_MAX_HP;
    this.hud.hideEnd();
    this.hud.hideFocus();
    this.hud.hidePop();
    this.hud.setCold(false);
    this.hud.setSpeed(1);
    this.nextQuestion();
    this.hud.showBanner("RELIT", "HOLD THE FORGE");
    this.syncHud(true);
  }

  // -- effects sink --------------------------------------------------------

  private makeEffects(): Effects {
    const rand = () => this.rng.f();
    return {
      fire: (t, angle) => {
        const bx = t.x + Math.cos(angle) * 26;
        const by = t.y + Math.sin(angle) * 26;
        if (t.kind === "bolt") {
          this.audio.bolt();
          burstSparks(this.parts, bx, by, 3, 120, rand);
        } else if (t.kind === "mortar") {
          this.audio.mortar();
          burstSparks(this.parts, bx, by, 9, 220, rand);
          ring(this.parts, bx, by, 46, 0.24, 0.4);
          this.cam.addTrauma(0.045);
        } else {
          this.audio.arc();
          burstSparks(this.parts, bx, by, 5, 160, rand);
        }
      },
      impact: (x, y, kind, _dmg, splash) => {
        if (kind === "mortar") {
          this.clock.hitstop(JUICE.hitstopMortar);
          this.cam.addTrauma(JUICE.traumaMortar);
          burstSparks(this.parts, x, y, 26, 400, rand);
          ring(this.parts, x, y, Math.max(70, splash), 0.4, 0.8);
          ring(this.parts, x, y, Math.max(70, splash) * 0.6, 0.28, 0.2);
        } else {
          burstSparks(this.parts, x, y, 5, 180, rand);
        }
      },
      hurt: (e, _dmg, x, y) => {
        burstSparks(this.parts, x, y, 2, 130, rand);
        void e;
      },
      kill: (e) => {
        const big = e.kind === "boss";
        const heavy = big || e.kind === "brute" || e.radius > 20;
        burstShatter(this.parts, e.x, e.y, big ? 34 : heavy ? 16 : 9, big ? 460 : 280, e.radius, rand);
        burstSparks(this.parts, e.x, e.y, big ? 40 : heavy ? 14 : 7, big ? 520 : 260, rand);
        ring(this.parts, e.x, e.y, big ? 260 : e.radius * 4, big ? 0.75 : 0.34, 0.6);
        if (big) {
          this.audio.bossDown();
          this.clock.hitstop(JUICE.hitstopBoss);
          this.cam.addTrauma(JUICE.traumaBoss);
          this.cam.addPunch(JUICE.punchBoss, 0.42);
          this.cam.flash(0.2, this.clock.wall);
          this.host.haptic("heavy");
        } else {
          this.audio.shatter(heavy ? 1.5 : 1);
          this.cam.addTrauma(heavy ? JUICE.traumaBigKill : JUICE.traumaKill);
          if (heavy) {
            this.clock.hitstop(JUICE.hitstopBigKill);
            this.cam.addPunch(JUICE.punchKill, 0.24);
          }
        }
      },
      leak: (e) => {
        this.audio.breach();
        this.clock.hitstop(JUICE.hitstopBreach);
        this.cam.addTrauma(JUICE.traumaBreach);
        burstSparks(this.parts, e.x, e.y, 22, 340, rand);
        ring(this.parts, e.x, e.y, 150, 0.5, 0);
        this.host.haptic("failure");
      },
      build: (t) => {
        this.audio.build();
        ring(this.parts, t.x, t.y, 110, 0.42, 0.7);
        burstSparks(this.parts, t.x, t.y, 20, 260, rand);
        this.cam.addTrauma(0.07);
        this.host.haptic("medium");
      },
      upgrade: (t) => {
        this.audio.upgrade();
        ring(this.parts, t.x, t.y, 170, 0.6, 1);
        ring(this.parts, t.x, t.y, 110, 0.42, 0.4);
        burstSparks(this.parts, t.x, t.y, 40, 380, rand);
        for (let i = 0; i < 10; i++) emberMote(this.parts, t.x, t.y, rand);
        this.cam.addTrauma(0.14);
        this.cam.addPunch(0.03, 0.3);
        this.host.haptic("success");
      },
      earn: () => {},
      waveStart: (spec: WaveSpec) => {
        const raise = (this.host as { raiseFloor?: (v: number) => void }).raiseFloor;
        if (typeof raise === "function") raise.call(this.host, mathFloor(spec.n));
        this.audio.waveHorn(spec.hasBoss ? 0.6 : 1);
        this.audio.setIntensity(Math.min(1, spec.n / 16));
        this.hud.showBanner(
          spec.hasBoss ? `WAVE ${spec.n}` : `WAVE ${spec.n}`,
          spec.hasBoss
            ? `${spec.totalHp} HP · A BOSS COMES`
            : `${spec.totalHp} HP INCOMING · YOUR DPS ${totalDps(this.state)}`,
        );
        this.cam.addTrauma(spec.hasBoss ? 0.3 : 0.12);
      },
      waveClear: (n) => {
        this.audio.forgeStrike(0.8);
        this.hud.showBanner(`WAVE ${n} HELD`, "THE CHANNEL COOLS");
        for (let i = 0; i < 30; i++) {
          emberMote(this.parts, this.state.path.core.x + this.rng.r(-70, 70), this.state.path.core.y, rand);
        }
        this.host.haptic("success");
        // Boss waves only — every fifth. A single wave is thirty seconds and
        // is not an ending; a boss held is several minutes of work and it is
        // the moment the child is already celebrating. That is where a
        // stopping point belongs, and it is the only place SIEGE has one.
        //
        // Never on `defeat`. A run that ended badly is a failure, and nothing
        // may be shown next to one.
        if (n % 5 === 0) {
          try {
            this.host.transition?.("boss", `wave ${n}`);
          } catch {
            /* a host that throws on a stopping point must not kill the run */
          }
        }
      },
      overchargeBlast: (x, y, _dmg) => {
        this.audio.overcharge();
        this.clock.hitstop(JUICE.hitstopOvercharge);
        this.cam.addTrauma(JUICE.traumaOvercharge);
        this.cam.addPunch(JUICE.punchOvercharge, 0.55);
        this.cam.flash(0.28, this.clock.wall);
        for (let i = 0; i < 5; i++) ring(this.parts, x, y, 320 + i * 220, 0.7 + i * 0.14, 0.9);
        burstSparks(this.parts, x, y, 120, 900, rand);
        this.host.haptic("heavy");
      },
      defeat: (wave) => {
        this.audio.defeat();
        this.cam.addTrauma(0.8);
        this.hud.showEnd(wave, [
          `${this.state.stats.kills} SLAIN`,
          `${this.state.stats.correct} STRUCK`,
          `${this.state.stats.earned} EMBERS`,
        ]);
      },
    };
  }

  // -- the loop ------------------------------------------------------------

  private frame = (now: number): void => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const raw = (now - this.lastT) / 1000;
    this.lastT = now;

    this.frames++;
    this.frameAcc += raw;
    if (raw > this.worstFrame && this.frames > 30) this.worstFrame = raw;
    if (this.frameAcc >= 0.5) {
      this.fps = this.frames / this.frameAcc;
      this.frames = 0;
      this.frameAcc = 0;
    }

    const steps = this.clock.advance(raw);
    for (let i = 0; i < steps; i++) step(this.state, FIXED_DT, this.fx);
    if (steps > 0) this.parts.update(steps * FIXED_DT);
    this.cam.update(Math.min(0.05, raw));

    const wantHint =
      this.state.phase !== "defeat" && (this.state.towers.length === 0 || this.armed !== null);
    this.hint = wantHint
      ? Math.min(1, this.hint + raw / 0.35)
      : Math.max(0, this.hint - raw / 0.5);

    if (this.focus?.kind === "overcharge") {
      this.focus.left -= raw;
      this.hud.setFocusTimer(this.focus.left / OVERCHARGE_WINDOW);
      if (this.focus.left <= 0) this.failFocus();
    }

    if (this.coldUntil > 0 && this.clock.wall >= this.coldUntil) {
      this.coldUntil = 0;
      this.hud.setCold(false);
      this.nextQuestion();
    }

    this.syncHud(false);
    this.render();
  };

  private render(): void {
    this.renderer.draw(this.ctx, this.view, this.state, this.parts, {
      hoverPlot: this.hoverPlot,
      selectedPlot: this.selectedPlot,
      buildPreview: this.buildPreview,
      reducedMotion: this.cam.reducedMotion,
      wallT: this.clock.wall,
      hint: this.hint,
      shakeX: this.cam.shakeX,
      shakeY: this.cam.shakeY,
      shakeRot: this.cam.shakeRot,
      zoom: this.cam.zoom,
      flash: this.cam.flashAlpha,
      frozen: this.clock.frozen,
    });
  }

  private syncHud(force: boolean): void {
    const s = this.state;
    if (force || s.embers !== this.prevEmbers) {
      this.hud.setEmbers(s.embers, false);
      this.prevEmbers = s.embers;
    }
    this.hud.setDps(totalDps(s));
    this.hud.setWave(s.wave);
    this.hud.setThreat(s.hpRemaining);
    const hurt = s.coreHp < this.prevCoreHp;
    if (force || hurt || s.coreHp !== this.prevCoreHp) {
      this.hud.setCore(s.coreHp, CORE_MAX_HP, hurt);
      this.prevCoreHp = s.coreHp;
    }
    this.hud.setOvercharge(s.overcharge, s.overcharge >= OVERCHARGE_MAX && !this.focus);
    this.hud.setPalette(s.embers, this.armed, BASE_DPS);
    if (s.phase === "intermission" && s.wave > 0) {
      this.hud.setCall(`${Math.max(0, Math.ceil(s.intermissionT))}s ▶`, true);
    } else {
      this.hud.setCall("", false);
    }
  }

  // -- questions -----------------------------------------------------------

  private nextQuestion(): void {
    this.q = this.host.next();
    // deterministic shuffle of the four slots
    this.order = this.rng.shuffle([0, 1, 2, 3]);
    this.askedAt = performance.now();
    this.answering = false;
    this.hud.setQuestion(this.q, this.order, emberReward(this.q.difficulty));
  }

  private optionAt(q: Question, slot: number): string {
    const options = [q.answer, ...q.distractors];
    return options[this.order[slot] ?? slot] ?? "";
  }

  private correctSlot(): number {
    return this.order.indexOf(0);
  }

  private answer(slot: number): void {
    if (!this.q || this.answering || this.coldUntil > 0 || this.focus) return;
    if (this.state.phase === "defeat") return;
    this.answering = true;
    const chosen = this.optionAt(this.q, slot);
    const correct = chosen === this.q.answer;
    const ms = Math.round(performance.now() - this.askedAt);
    const difficulty = this.q.difficulty;
    this.host.report({ questionId: this.q.id, correct, ms, answered: chosen });
    this.hud.markAnswer(slot, correct, this.correctSlot());

    if (correct) {
      this.state.stats.correct++;
      const reward = emberReward(difficulty);
      const from = this.hud.slugCenter(slot);
      this.audio.forgeStrike(difficulty);
      this.host.haptic("success");
      this.state.overcharge = Math.min(OVERCHARGE_MAX, this.state.overcharge + OVERCHARGE_PER_ANSWER);
      // sparks off the anvil, in board space beneath the core
      this.strikeSparks();
      this.hud.flyEmbers(reward, from.x, from.y, (i) => {
        this.audio.tick(i);
        this.hud.setEmbers(this.state.embers, true);
      });
      grantEmbers(this.state, reward, this.state.path.core.x, this.state.path.core.y, this.fx);
      this.cam.addTrauma(0.03);
      setTimeout(() => {
        if (!this.destroyed && this.coldUntil === 0 && !this.focus) this.nextQuestion();
      }, 190);
    } else {
      this.state.stats.wrong++;
      this.audio.quench();
      this.host.haptic("failure");
      this.coldUntil = this.clock.wall + QUENCH_SECONDS;
      this.hud.setCold(true);
      this.cam.addTrauma(0.05);
    }
  }

  private strikeSparks(): void {
    const rand = () => this.rng.f();
    const c = this.state.path.core;
    for (let i = 0; i < 14; i++) emberMote(this.parts, c.x + this.rng.r(-40, 40), c.y - 10, rand);
  }

  // -- focus overlay -------------------------------------------------------

  private openOvercharge(): void {
    if (this.state.overcharge < OVERCHARGE_MAX || this.focus) return;
    const q = this.host.next();
    const order = this.rng.shuffle([0, 1, 2, 3]);
    this.focus = { kind: "overcharge", q, order, left: OVERCHARGE_WINDOW };
    this.order = order;
    this.q = q;
    this.askedAt = performance.now();
    this.clock.slowTarget = JUICE.slowmoOvercharge;
    this.audio.slowIn();
    this.hud.hidePop();
    this.hud.showFocus("OVERCHARGE", q, order, true);
    this.hud.setFocusTimer(1);
    this.host.haptic("medium");
  }

  private openUpgrade(): void {
    const tower = towerAt(this.state, this.selectedPlot);
    if (!tower || this.focus) return;
    const cost = upgradeCost(tower);
    if (cost === null || this.state.embers < cost) return;
    const q = this.host.next();
    const order = this.rng.shuffle([0, 1, 2, 3]);
    this.focus = { kind: "upgrade", q, order, tower };
    this.order = order;
    this.q = q;
    this.askedAt = performance.now();
    this.clock.slowTarget = 0.42;
    this.audio.slowIn();
    this.hud.hidePop();
    this.hud.showFocus(`UPGRADE · ${cost} EMBERS`, q, order, false);
  }

  private focusAnswer(slot: number): void {
    const f = this.focus;
    if (!f || !this.q) return;
    const chosen = this.optionAt(this.q, slot);
    const correct = chosen === this.q.answer;
    const ms = Math.round(performance.now() - this.askedAt);
    this.host.report({ questionId: this.q.id, correct, ms, answered: chosen });
    this.hud.markFocus(slot, correct, this.correctSlot());

    if (correct) {
      this.state.stats.correct++;
      if (f.kind === "overcharge") {
        this.state.overcharge = 0;
        detonateOvercharge(this.state, this.fx);
      } else {
        applyUpgrade(this.state, f.tower, this.fx);
      }
      setTimeout(() => this.closeFocus(), 260);
    } else {
      this.state.stats.wrong++;
      this.state.stats.wrong += 0;
      this.audio.quench();
      this.host.haptic("failure");
      if (f.kind === "overcharge") this.state.overcharge = 40;
      this.coldUntil = this.clock.wall + QUENCH_SECONDS;
      this.hud.setCold(true);
      setTimeout(() => this.closeFocus(), 520);
    }
  }

  private failFocus(): void {
    if (!this.focus) return;
    if (this.focus.kind === "overcharge") this.state.overcharge = 40;
    this.audio.quench();
    this.closeFocus();
  }

  private cancelFocus(): void {
    if (this.focus?.kind !== "upgrade") return;
    this.closeFocus();
  }

  private closeFocus(): void {
    this.focus = null;
    this.clock.slowTarget = 1;
    this.hud.hideFocus();
    if (this.coldUntil === 0) this.nextQuestion();
  }

  // -- input ---------------------------------------------------------------

  private plotUnder(sx: number, sy: number): number {
    const b = screenToBoard(this.view, sx, sy);
    let best = -1;
    let bestD = Infinity;
    for (const p of this.state.plots) {
      const dx = Math.abs(b.x - p.x);
      const dy = Math.abs(b.y - p.y);
      const h = p.size / 2 + 8;
      if (dx > h || dy > h) continue;
      const d = dx + dy;
      if (d < bestD) {
        bestD = d;
        best = p.id;
      }
    }
    return best;
  }

  private onPointerDown = (ev: PointerEvent): void => {
    if (this.state.phase === "defeat" || this.focus) return;
    this.audio.resume();
    const rect = this.hud.canvas.getBoundingClientRect();
    const sx = ev.clientX - rect.left;
    const sy = ev.clientY - rect.top;
    const id = this.plotUnder(sx, sy);
    if (id < 0) {
      this.selectedPlot = -1;
      this.buildPreview = null;
      this.hud.hidePop();
      return;
    }
    this.select(id);
  };

  private arm(kind: TowerKind): void {
    this.armed = this.armed === kind ? null : kind;
    this.buildPreview = this.armed;
    this.hud.hidePop();
    this.host.haptic("light");
  }

  private select(id: number): void {
    this.selectedPlot = id;
    const plot = this.state.plots[id];
    if (!plot) return;
    const scr = boardToScreen(this.view, plot.x, plot.y);
    const tower = towerAt(this.state, id);
    this.host.haptic("light");
    if (!tower && this.armed) {
      // armed palette: pads become one-tap placement, the way a TD veteran plays
      const kind = this.armed;
      if (this.state.embers >= TOWERS[kind].cost) {
        this.build(kind);
        this.selectedPlot = -1;
        if (this.state.embers < TOWERS[kind].cost) this.armed = null;
        this.buildPreview = this.armed;
        return;
      }
    }
    if (tower) {
      this.buildPreview = null;
      const cost = upgradeCost(tower);
      this.hud.showTower(
        scr.x,
        scr.y - plot.size * this.view.scale * 0.5,
        {
          name: TOWERS[tower.kind].name,
          level: tower.level,
          dps: towerDps(tower),
          cost,
          affordable: cost !== null && this.state.embers >= cost,
        },
        () => this.openUpgrade(),
      );
    } else {
      this.hud.showBuild(scr.x, scr.y - plot.size * this.view.scale * 0.5, this.state.embers, (k) =>
        this.build(k),
      );
      this.buildPreview = "bolt";
    }
  }

  private build(kind: TowerKind): void {
    if (this.selectedPlot < 0) return;
    if (tryBuild(this.state, this.selectedPlot, kind, this.fx)) {
      this.hud.hidePop();
      this.buildPreview = null;
      this.selectedPlot = -1;
      this.hud.setEmbers(this.state.embers, true);
    }
  }

  private onPointerMove = (ev: PointerEvent): void => {
    if (ev.pointerType === "touch") return;
    const rect = this.hud.canvas.getBoundingClientRect();
    this.hoverPlot = this.plotUnder(ev.clientX - rect.left, ev.clientY - rect.top);
  };

  private onPointerLeave = (): void => {
    this.hoverPlot = -1;
  };

  private onKey = (ev: KeyboardEvent): void => {
    const k = ev.key;
    if (k >= "1" && k <= "4") {
      const i = Number(k) - 1;
      if (this.focus) this.focusAnswer(i);
      else this.answer(i);
      ev.preventDefault();
      return;
    }
    if (k === "Escape") {
      this.hud.hidePop();
      this.selectedPlot = -1;
      this.cancelFocus();
      return;
    }
    if (!this.focus) {
      const armKey: Record<string, TowerKind> = { q: "bolt", w: "mortar", e: "chain" };
      const kind = armKey[k.toLowerCase()];
      if (kind) {
        if (this.selectedPlot >= 0 && !towerAt(this.state, this.selectedPlot)) this.build(kind);
        else this.arm(kind);
      }
      if ((k === "u" || k === "U") && this.selectedPlot >= 0) this.openUpgrade();
    }
    if (k === " ") {
      ev.preventDefault();
      if (this.state.overcharge >= OVERCHARGE_MAX && !this.focus) this.openOvercharge();
      else this.callWave();
    }
    if (k === "f" || k === "F") this.toggleSpeed();
  };

  private toggleSpeed(): void {
    this.clock.speed = this.clock.speed === 1 ? 2 : 1;
    this.hud.setSpeed(this.clock.speed);
  }

  private toggleSound(): void {
    this.soundOn = !this.soundOn;
    this.audio.setEnabled(this.soundOn);
    this.hud.setSound(this.soundOn);
  }

  private callWave(): void {
    const bonus = callWaveEarly(this.state);
    if (bonus <= 0) return;
    const embers = bonus * EARLY_CALL_BONUS;
    grantEmbers(this.state, embers, this.state.path.core.x, this.state.path.core.y, this.fx);
    this.hud.setEmbers(this.state.embers, true);
    this.audio.forgeStrike(0.5);
    this.host.haptic("medium");
  }

  // -- exposed for the playtest harness -------------------------------------

  debug(): {
    fps: number;
    worstFrameMs: number;
    particles: number;
    enemies: number;
    towers: number;
    wave: number;
    embers: number;
    coreHp: number;
    phase: string;
  } {
    let live = 0;
    for (const e of this.state.enemies) if (e.alive) live++;
    return {
      fps: Math.round(this.fps),
      worstFrameMs: Math.round(this.worstFrame * 1000),
      particles: this.parts.count,
      enemies: live,
      towers: this.state.towers.length,
      wave: this.state.wave,
      embers: this.state.embers,
      coreHp: this.state.coreHp,
      phase: this.state.phase,
    };
  }

  /** harness: strike the anvil once, correctly unless we asked for a slip */
  autoAnswer(mistakeRate = 0): boolean {
    if (this.state.phase === "defeat") return false;
    const slip = this.rng.f() < mistakeRate;
    const slot = slip ? (this.correctSlot() + 1) % 4 : this.correctSlot();
    if (this.focus) {
      this.focusAnswer(slot);
      return true;
    }
    if (this.coldUntil > 0 || this.answering) return false;
    this.answer(slot);
    return true;
  }

  /** harness: spend like a competent player — fill the best pads, then upgrade */
  autoSpend(): void {
    const s = this.state;
    if (s.phase === "defeat" || this.focus) return;
    if (s.overcharge >= OVERCHARGE_MAX && s.coreHp < CORE_MAX_HP) {
      this.openOvercharge();
      return;
    }
    const empty = s.plots.filter((p) => p.towerId < 0).sort((a, b) => b.value - a.value);
    const wantMortar = s.wave >= 5 && s.towers.filter((t) => t.kind === "mortar").length < 5;
    const wantChain = s.wave >= 9 && s.towers.filter((t) => t.kind === "chain").length < 4;
    const pick: TowerKind =
      s.towers.length < 4 ? "bolt" : wantChain && this.rng.chance(0.4) ? "chain" : wantMortar ? "mortar" : "bolt";
    const first = empty[0];
    if (first && s.embers >= TOWERS[pick].cost) {
      this.selectedPlot = first.id;
      this.build(pick);
      return;
    }
    // pads full: pour everything into levels
    const target = s.towers
      .filter((t) => {
        const c = upgradeCost(t);
        return c !== null && s.embers >= c;
      })
      .sort((a, b) => a.level - b.level)[0];
    if (target) {
      this.selectedPlot = target.plotId;
      this.openUpgrade();
    }
  }

  autoTick(mistakeRate = 0): void {
    this.autoAnswer(mistakeRate);
    this.autoSpend();
  }

  setSpeedForTest(mult: 1 | 2): void {
    this.clock.speed = mult;
    this.hud.setSpeed(mult);
  }

  /** harness: jump straight to a fully-built board at a late wave, for perf work */
  seedHeavy(wave: number, level: number): void {
    const kinds: TowerKind[] = ["bolt", "mortar", "chain"];
    this.state.embers = 9_999_999;
    this.state.plots.forEach((p, i) => {
      if (p.towerId < 0) tryBuild(this.state, p.id, kinds[i % 3] as TowerKind, this.fx);
    });
    for (const t of this.state.towers) {
      while (t.level < level && applyUpgrade(this.state, t, this.fx)) {
        /* climb */
      }
    }
    this.state.wave = wave;
    this.state.spec = buildWave(wave, this.state.seed);
    this.state.phase = "intermission";
    this.state.intermissionT = 0.2;
    this.state.embers = 600;
  }

  get live(): State {
    return this.state;
  }
}

export type { Enemy, Tower };
export { clamp01 };

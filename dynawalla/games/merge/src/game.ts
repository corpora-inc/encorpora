import type { FocusableHost, Question } from "./contract.ts";
import { Rng, hashSeed } from "./core/rng.ts";
import { Deck } from "./core/deck.ts";
import { levelAt, spawnPool, tierOf, type Level } from "./core/levels.ts";
import {
  COLS,
  ROWS,
  applyGravity,
  boardValues,
  dropRow,
  emptyBoard,
  fillRatio,
  idx,
  cascade,
  cloneBoard,
  planDrop,
  previewFuse,
  removeIds,
  riseBoard,
  strandedTiles,
  type Board,
  type Cell,
  type CoreTile,
  type Step,
} from "./core/rules.ts";
import { questionFor } from "./host/questions.ts";
import { AudioKit } from "./audio/audio.ts";
import { Camera, clamp01, ease } from "./fx/camera.ts";
import { Particles, Pops, Rings } from "./fx/particles.ts";
import { CHARGE, DANGER, HOT, KEYC, tierColor, type Rgb } from "./fx/palette.ts";
import { cellCenter, type Layout } from "./layout.ts";

export type Face =
  | { kind: "num" }
  | { kind: "expr"; text: string; qid: string; fromHost: boolean };

export type TileView = {
  id: number;
  value: number;
  face: Face;
  r: number;
  c: number;
  /** render position in grid units (col, row), floats */
  px: number;
  py: number;
  vy: number;
  /** squash amount: +stretch horizontally, -vertically */
  q: number;
  qv: number;
  hot: number;
  spawnAt: number;
  landedAt: number;
};

export type Dying = {
  r: number;
  c: number;
  value: number;
  tier: number;
  t: number;
  dur: number;
  kind: "fuse" | "purge";
};

export type FlyCore = {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  t: number;
  dur: number;
  value: number;
  color: Rgb;
  alive: boolean;
};

export type Phase = "boot" | "aim" | "drop" | "fuse" | "fall" | "levelup" | "resonance" | "breach";

export type Resonance = {
  active: boolean;
  rescue: boolean;
  target: number;
  question: Question | null;
  fromHost: boolean;
  t: number;
  limit: number;
  askedAt: number;
  result: "none" | "hit" | "miss";
  resultT: number;
  pickedCell: Cell | null;
};

const CHARGE_MAX = 8;
const FUSE_BEAT = 0.2;
const FALL_MAX = 0.62;
const BOOT_TIME = 1.3;
const LEVELUP_TIME = 1.45;
const BREACH_TIME = 1.5;
const RES_LIMIT = 9;
const DROP_V0 = 22;
const DROP_G = 150;
const FALL_G = 118;
const BEST_KEY = "dynawalla.fuse.best";

export class Game {
  host: FocusableHost;
  audio = new AudioKit();
  cam = new Camera();
  parts = new Particles();
  rings = new Rings();
  pops = new Pops();

  rng: Rng;
  /** cosmetic-only stream, so particle jitter can never shift the run */
  fxRng: Rng;
  seedText: string;
  deck: Deck;
  level: Level = levelAt(1);
  levelN = 1;

  board: Board = emptyBoard();
  tiles = new Map<number, TileView>();
  dying: Dying[] = [];
  cores: FlyCore[] = [];

  held: TileView | null = null;
  heldCol = 2;
  aimT = 0;
  previewCells: Cell[] = [];
  previewLanding: Cell | null = null;

  phase: Phase = "boot";
  pt = 0;
  plan: { steps: Step[] } | null = null;
  stepI = 0;
  fallT = 0;
  dropsSinceRise = 0;
  riseFlash = 0;
  private levelSeeded = false;

  score = 0;
  shownScore = 0;
  best = 0;
  newBest = false;
  fusesThisLevel = 0;
  totalFuses = 0;
  chainShown = 0;
  chainShownT = 0;
  charge = 0;
  chargeReadyPulse = 0;
  rescueUsed = false;
  keyMorph = 0;
  prevKey = 10;

  res: Resonance = {
    active: false,
    rescue: false,
    target: 0,
    question: null,
    fromHost: false,
    t: 0,
    limit: RES_LIMIT,
    askedAt: 0,
    result: "none",
    resultT: 0,
    pickedCell: null,
  };

  layout: Layout | null = null;
  paused = false;
  soundOn = true;
  danger = 0;
  fps = 60;

  private nextTileId = 1;
  private qPool: Question[] = [];
  private qSeq = 0;
  private upcoming: number[] = [];
  private now = 0;

  constructor(host: FocusableHost, seedText = `fuse-${Date.now() & 0xffff}`) {
    this.host = host;
    this.seedText = seedText;
    this.rng = new Rng(hashSeed(seedText));
    this.fxRng = new Rng(hashSeed(seedText) ^ 0x5bf03635);
    this.deck = new Deck(this.rng, this.level.key, this.level.triplePct);
    this.cam.reduced = host.prefersReducedMotion();
    this.best = readBest();
    this.fillUpcoming();
    this.seedWell(3);
  }

  /* ------------------------------------------------------------------ */

  reset(seedText?: string): void {
    const s = seedText ?? `${this.seedText}+`;
    this.seedText = s;
    this.rng = new Rng(hashSeed(s));
    this.fxRng = new Rng(hashSeed(s) ^ 0x5bf03635);
    this.levelN = 1;
    this.level = levelAt(1);
    this.deck = new Deck(this.rng, this.level.key, this.level.triplePct);
    this.board = emptyBoard();
    this.tiles.clear();
    this.dying = [];
    this.cores = [];
    this.held = null;
    this.heldCol = 2;
    this.aimT = 0;
    this.plan = null;
    this.stepI = 0;
    this.dropsSinceRise = 0;
    this.score = 0;
    this.shownScore = 0;
    this.newBest = false;
    this.fusesThisLevel = 0;
    this.totalFuses = 0;
    this.charge = 0;
    this.rescueUsed = false;
    this.res.active = false;
    this.res.result = "none";
    this.previewCells = [];
    this.qPool = [];
    this.upcoming = [];
    this.prevKey = this.level.key;
    this.keyMorph = 0;
    this.parts.clear();
    this.rings.clear();
    this.pops.clear();
    this.cam.reset();
    this.fillUpcoming();
    this.seedWell(3);
    this.phase = "boot";
    this.pt = 0;
  }

  private fillUpcoming(): void {
    while (this.upcoming.length < 6) this.upcoming.push(this.deck.deal());
  }

  /* ---------------- question plumbing ---------------- */

  private difficulty(): number {
    return Math.max(0.1, Math.min(0.95, (this.level.key - 6) / 100 + 0.15 + this.levelN * 0.012));
  }

  private pumpQuestions(n: number, wanted: number[]): void {
    // A focusable host is told exactly which chip values are coming, so the
    // expression on a chip face is guaranteed to equal that chip. A host that
    // cannot focus still works — the pool just matches less often and fewer
    // chips wear an expression.
    this.host.focus?.({ key: this.level.key, wanted });
    for (let i = 0; i < n && this.qPool.length < 26; i++) {
      try {
        this.qPool.push(this.host.next());
      } catch {
        break;
      }
    }
  }

  private takeQuestionFor(value: number): Question | null {
    const want = String(value);
    let i = this.qPool.findIndex((q) => q.answer === want);
    if (i < 0) {
      this.pumpQuestions(6, [value, value, ...this.upcoming]);
      i = this.qPool.findIndex((q) => q.answer === want);
    }
    if (i < 0) return null;
    const q = this.qPool[i] as Question;
    this.qPool.splice(i, 1);
    return q;
  }

  private faceFor(value: number): Face {
    if (this.level.exprPct <= 0) return { kind: "num" };
    if (!this.rng.chance(this.level.exprPct, 100)) return { kind: "num" };
    const q = this.takeQuestionFor(value);
    if (!q) return { kind: "num" };
    return { kind: "expr", text: q.prompt, qid: q.id, fromHost: true };
  }

  private report(face: Face, correct: boolean, ms: number, answered: string): void {
    if (face.kind !== "expr" || !face.fromHost) return;
    try {
      this.host.report({ questionId: face.qid, correct, ms: Math.round(ms), answered });
    } catch {
      /* a host that throws on report must not kill the run */
    }
  }

  /* ---------------- spawning ---------------- */

  private spawnHeld(): void {
    this.fillUpcoming();
    const value = this.upcoming.shift() as number;
    this.fillUpcoming();
    const t: TileView = {
      id: this.nextTileId++,
      value,
      face: this.faceFor(value),
      r: -1,
      c: this.heldCol,
      px: this.heldCol,
      py: -1.35,
      vy: 0,
      q: 0.34,
      qv: 0,
      hot: 0,
      spawnAt: this.now,
      landedAt: 0,
    };
    this.held = t;
    this.aimT = 0;
    this.updatePreview();
    this.audio.hold();
  }

  updatePreview(): void {
    if (!this.held) {
      this.previewCells = [];
      this.previewLanding = null;
      return;
    }
    const p = previewFuse(this.board, this.heldCol, this.held.value, this.level.key);
    this.previewLanding = p.landing;
    this.previewCells = this.level.preview === "none" ? [] : p.cells;
  }

  /* ---------------- input intents ---------------- */

  moveTo(col: number): void {
    const c = Math.max(0, Math.min(COLS - 1, col));
    if (this.phase !== "aim" || !this.held || c === this.heldCol) return;
    this.heldCol = c;
    this.held.c = c;
    this.updatePreview();
    this.audio.move();
  }

  nudge(d: number): void {
    this.moveTo(this.heldCol + d);
  }

  drop(): void {
    if (this.phase !== "aim" || !this.held) return;
    const tile = this.held;
    const r = dropRow(this.board, this.heldCol);
    if (r < 0) {
      // The chosen column is full. Refuse, do not punish: a wasted tap is not a
      // game-ending mistake in any good puzzle game.
      this.cam.shake(0.12);
      this.audio.resonanceMiss();
      return;
    }
    const core: CoreTile = { id: tile.id, value: tile.value };
    this.plan = {
      steps: planDrop(this.board, this.heldCol, core, {
        key: this.level.key,
        nextId: () => this.nextTileId++,
      }).steps,
    };
    this.dropsSinceRise++;
    tile.r = r;
    tile.c = this.heldCol;
    tile.px = this.heldCol;
    tile.vy = DROP_V0;
    this.phase = "drop";
    this.pt = 0;
    this.audio.resume();
  }

  toggleSound(): void {
    this.soundOn = !this.soundOn;
    this.audio.setEnabled(this.soundOn);
    if (this.soundOn) this.audio.ui(true);
  }

  /** the KEY orb was tapped */
  pokeReactor(): void {
    if (this.phase === "aim" && this.charge >= CHARGE_MAX) this.enterResonance(false);
  }

  /* ---------------- resonance ---------------- */

  private enterResonance(rescue: boolean): void {
    const vals = boardValues(this.board);
    if (vals.length === 0) {
      if (rescue) this.enterBreach();
      return;
    }
    const counts = new Map<number, number>();
    for (const t of this.board) if (t) counts.set(t.value, (counts.get(t.value) ?? 0) + 1);
    const plural = vals.filter((v) => (counts.get(v) ?? 0) >= 2);
    const target = this.rng.pick(plural.length > 0 ? plural : vals);

    let q = this.takeQuestionFor(target);
    let fromHost = true;
    if (!q) {
      this.pumpQuestions(10, [target, target, target]);
      q = this.takeQuestionFor(target);
    }
    if (!q) {
      q = questionFor(target, this.difficulty(), this.rng, ++this.qSeq);
      fromHost = false;
    }

    this.res = {
      active: true,
      rescue,
      target,
      question: q,
      fromHost,
      t: 0,
      limit: RES_LIMIT,
      askedAt: this.now,
      result: "none",
      resultT: 0,
      pickedCell: null,
    };
    if (!rescue) this.charge = 0;
    this.phase = "resonance";
    this.pt = 0;
    this.audio.resonanceEnter();
    this.host.haptic("medium");
    this.cam.shake(0.24);
    this.cam.punch(1.6);
  }

  /** a board cell was tapped during resonance */
  pickCell(r: number, c: number): void {
    if (this.phase !== "resonance" || this.res.result !== "none") return;
    const t = this.board[idx(r, c)];
    if (!t) return;
    this.res.pickedCell = { r, c };
    const ms = this.now - this.res.askedAt;
    const correct = t.value === this.res.target;
    if (this.res.fromHost && this.res.question) {
      try {
        this.host.report({
          questionId: this.res.question.id,
          correct,
          ms: Math.round(ms),
          answered: String(t.value),
        });
      } catch {
        /* ignore */
      }
    }
    if (correct) this.resonanceHit();
    else this.resonanceMiss();
  }

  private resonanceHit(): void {
    this.res.result = "hit";
    this.res.resultT = 0;
    const radius = this.res.rescue ? 2 : 1;
    const doomed = new Set<number>();
    const seeds: Cell[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = this.board[idx(r, c)];
        if (t && t.value === this.res.target) seeds.push({ r, c });
      }
    }
    // orthogonal flood to `radius`
    let frontier = seeds;
    const mark = (p: Cell) => {
      const t = this.board[idx(p.r, p.c)];
      if (t) doomed.add(t.id);
    };
    for (const p of frontier) mark(p);
    for (let step = 0; step < radius; step++) {
      const next: Cell[] = [];
      for (const p of frontier) {
        for (const d of [
          { r: p.r - 1, c: p.c },
          { r: p.r + 1, c: p.c },
          { r: p.r, c: p.c - 1 },
          { r: p.r, c: p.c + 1 },
        ]) {
          if (d.r < 0 || d.r >= ROWS || d.c < 0 || d.c >= COLS) continue;
          const t = this.board[idx(d.r, d.c)];
          if (t && !doomed.has(t.id)) {
            doomed.add(t.id);
            next.push(d);
          }
        }
      }
      frontier = next;
    }

    const l = this.layout;
    let n = 0;
    let sx = 0;
    let sy = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = this.board[idx(r, c)];
        if (!t || !doomed.has(t.id)) continue;
        const tier = tierOf(t.value, this.level.key);
        this.dying.push({ r, c, value: t.value, tier, t: -0.012 * n, dur: 0.44, kind: "purge" });
        const v = this.tiles.get(t.id);
        if (v) this.report(v.face, true, this.now - v.spawnAt, String(v.value));
        this.tiles.delete(t.id);
        if (l) {
          const p = cellCenter(l, r, c);
          sx += p.x;
          sy += p.y;
          this.parts.burst(p.x, p.y, tierColor(tier), 420, 16);
          this.parts.shards(p.x, p.y, tierColor(tier), l.cell, 5);
          // one ring per few chips: a dozen concentric circles is geometry,
          // not a blast
          if (n % 3 === 0) this.rings.add(p.x, p.y, l.cell * 0.2, l.cell * 2.1, 0.5, 3, tierColor(tier));
        }
        n++;
      }
    }
    if (l && n > 0) {
      this.rings.add(sx / n, sy / n, l.cell * 0.4, l.cell * (3 + n * 0.35), 0.75, 6, HOT);
    }
    removeIds(this.board, [...doomed]);
    const moves = applyGravity(this.board);
    for (const m of moves) {
      const v = this.tiles.get(m.id);
      if (v) {
        v.r = m.to.r;
        v.c = m.to.c;
      }
    }
    const gain = this.level.key * 10 * Math.max(1, n);
    this.addScore(gain);
    if (l) {
      this.pops.add(
        l.boardX + l.boardW / 2,
        l.boardY + l.boardH * 0.66,
        `+${gain}`,
        HOT,
        Math.max(26, l.cell * 0.7),
        1.3,
      );
    }
    this.audio.resonanceHit();
    this.host.haptic("success");
    this.cam.shake(0.85);
    this.cam.punch(3.4);
    this.cam.slowmo(0.32, 420);
    this.cam.flash(HOT, 0.26);
  }

  private resonanceMiss(): void {
    this.res.result = "miss";
    this.res.resultT = 0;
    this.audio.resonanceMiss();
    this.host.haptic("failure");
    this.cam.shake(0.34);
    this.cam.punch(-1.1);
  }

  /* ---------------- scoring / progression ---------------- */

  private addScore(n: number): void {
    this.score += n;
    if (this.score > this.best) {
      if (!this.newBest && this.best > 0) {
        this.newBest = true;
        this.cam.flash(KEYC, 0.16);
      }
      this.best = this.score;
      writeBest(this.best);
    }
  }

  private enterBreach(): void {
    this.phase = "breach";
    this.pt = 0;
    this.held = null;
    for (const [, v] of this.tiles) this.report(v.face, false, this.now - v.spawnAt, "");
    this.audio.breach();
    this.host.haptic("failure");
    this.cam.shake(1);
    this.cam.punch(-2.6);
    this.cam.slowmo(0.25, 700);
  }

  private enterLevelUp(): void {
    // The quota is met and the KEY is about to change: the child finished a
    // level. FUSE's natural stopping point, and the one the day pass reads.
    // Reported on every level-up rather than only the first — the host acts on
    // the first one it hears in a day and ignores the rest, so this does not
    // have to know which of them is special.
    try {
      this.host.transition?.("level", `level ${this.levelN}`);
    } catch {
      /* a host that throws on a stopping point must not kill the run */
    }
    this.phase = "levelup";
    this.pt = 0;
    this.levelSeeded = false;
    this.prevKey = this.level.key;
    this.levelN++;
    this.level = levelAt(this.levelN);
    this.fusesThisLevel = 0;
    this.dropsSinceRise = 0;
    this.keyMorph = this.prevKey === this.level.key ? 0 : 1;
    this.deck.retune(this.level.key, this.level.triplePct);
    this.upcoming = [];
    this.fillUpcoming();
    this.qPool = [];

    // burn off everything the new KEY can never use, so a level-up is relief
    const stranded = strandedTiles(this.board, this.level.key, spawnPool(this.level.key));
    const l = this.layout;
    for (const t of stranded) {
      const v = this.tiles.get(t.id);
      if (!v) continue;
      this.dying.push({
        r: v.r,
        c: v.c,
        value: v.value,
        tier: tierOf(v.value, this.prevKey),
        t: -0.02 * v.c,
        dur: 0.5,
        kind: "purge",
      });
      this.report(v.face, false, this.now - v.spawnAt, "");
      this.tiles.delete(t.id);
      if (l) {
        const p = cellCenter(l, v.r, v.c);
        this.parts.burst(p.x, p.y, KEYC, 300, 12);
      }
    }
    if (stranded.length > 0) {
      removeIds(
        this.board,
        stranded.map((t) => t.id),
      );
      const moves = applyGravity(this.board);
      for (const m of moves) {
        const v = this.tiles.get(m.id);
        if (v) {
          v.r = m.to.r;
          v.c = m.to.c;
        }
      }
    }

    this.audio.levelUp();
    this.host.haptic("success");
    this.cam.shake(0.6);
    this.cam.punch(2.6);
    this.cam.slowmo(0.45, 460);
    this.cam.flash(KEYC, 0.2);
    if (l) {
      this.rings.add(l.keyX, l.keyY, l.keyR * 0.6, Math.max(l.w, l.h) * 0.7, 0.9, 5, KEYC);
      this.pops.add(l.boardX + l.boardW / 2, l.boardY + l.boardH * 0.4, `${this.level.key}`, KEYC, l.cell * 1.3, 1.3);
    }
  }

  /* ---------------- the cascade ---------------- */

  private beginFuseStep(): void {
    const plan = this.plan;
    if (!plan || this.stepI >= plan.steps.length) {
      this.finishResolution();
      return;
    }
    const step = plan.steps[this.stepI] as Step;
    const l = this.layout;
    const chain = step.chain;

    for (const g of step.fused) {
      let sx = 0;
      let sy = 0;
      for (const p of g.cells) {
        const t = this.board[idx(p.r, p.c)];
        const value = t ? t.value : 0;
        const tier = tierOf(value, this.level.key);
        this.dying.push({ r: p.r, c: p.c, value, tier, t: 0, dur: FUSE_BEAT + 0.14, kind: "fuse" });
        if (t) {
          const v = this.tiles.get(t.id);
          if (v) this.report(v.face, true, this.now - v.spawnAt, String(v.value));
          this.tiles.delete(t.id);
        }
        if (l) {
          const q = cellCenter(l, p.r, p.c);
          sx += q.x;
          sy += q.y;
          const col = tierColor(tier);
          this.parts.burst(q.x, q.y, col, 300 + chain * 90, 14 + chain * 3);
          this.parts.shards(q.x, q.y, col, l.cell, 4);
        }
      }
      if (l) {
        sx /= g.cells.length;
        sy /= g.cells.length;
        const col = chain >= 3 ? HOT : KEYC;
        this.rings.add(sx, sy, l.cell * 0.25, l.cell * (1.9 + chain * 0.5), 0.5, 3 + chain, col);
        this.cores.push({
          x0: sx,
          y0: sy,
          cx: (sx + l.keyX) / 2 + (this.fxRng.int(160) - 80),
          cy: Math.min(sy, l.keyY) - l.cell * 1.6,
          t: 0,
          dur: 0.44 + this.fxRng.int(16) / 100,
          value: g.sum,
          color: col,
          alive: true,
        });
        this.pops.add(sx, sy - l.cell * 0.3, `+${step.score}`, col, Math.max(15, l.cell * 0.42), 0.85);
      }
      removeIds(
        this.board,
        g.ids.filter((id) => id >= 0),
      );
    }

    this.addScore(step.score);
    this.fusesThisLevel += step.fused.length;
    this.totalFuses += step.fused.length;
    this.chainShown = chain;
    this.chainShownT = 0;

    const size = Math.max(...step.fused.map((g) => g.cells.length));
    this.audio.fuse(chain, size);
    this.cam.stop(34 + chain * 16);
    this.cam.shake(0.16 + chain * 0.09);
    this.cam.punch(1.2 + chain * 0.55);
    this.host.haptic(chain >= 3 ? "heavy" : "medium");
    if (chain >= 3) {
      this.cam.slowmo(0.42, 200 + chain * 30);
      this.cam.flash(HOT, 0.1 + chain * 0.02);
      this.audio.chainPeak(chain);
    }

    this.phase = "fuse";
    this.pt = 0;
  }

  private endFuseStep(): void {
    const moves = applyGravity(this.board);
    for (const m of moves) {
      const v = this.tiles.get(m.id);
      if (v) {
        v.r = m.to.r;
        v.c = m.to.c;
      }
    }
    this.phase = "fall";
    this.pt = 0;
    this.fallT = 0;
  }

  private finishResolution(): void {
    this.plan = null;
    this.stepI = 0;
    let breach = false;
    for (let c = 0; c < COLS; c++) if (this.board[idx(0, c)] != null) breach = true;
    let allFull = true;
    for (let c = 0; c < COLS; c++) if (dropRow(this.board, c) >= 0) allFull = false;

    if (breach || allFull) {
      if (!this.rescueUsed) {
        this.rescueUsed = true;
        this.enterResonance(true);
      } else {
        this.enterBreach();
      }
      return;
    }
    if (this.fusesThisLevel >= this.level.quota) {
      this.enterLevelUp();
      return;
    }
    if (this.dropsSinceRise >= this.level.riseEvery) {
      this.dropsSinceRise = 0;
      this.rise();
      return;
    }
    if (!this.held) this.spawnHeld();
    else this.updatePreview();
    this.phase = "aim";
    this.pt = 0;
  }

  /**
   * The well rises. This is the pressure: a good player who clears every pair
   * still watches the floor climb, so the run always ends and the next one is
   * always worth starting.
   */
  private pushRow(silent = false): boolean {
    const probe = cloneBoard(this.board);
    // Straight from the deck, not from `upcoming` — the incoming strip is a
    // promise to the player and a rise must not quietly rewrite it.
    const values: number[] = [];
    for (let c = 0; c < COLS; c++) values.push(this.deck.deal());
    const out = riseBoard(probe, values, () => this.nextTileId++);
    if (out.breach) return false;
    this.board = probe;
    for (const m of out.moves) {
      const v = this.tiles.get(m.id);
      if (v) {
        v.r = m.to.r;
        v.c = m.to.c;
        v.py = silent ? m.to.r : m.from.r;
        v.q = silent ? 0 : 0.18;
      }
    }
    for (let c = 0; c < COLS; c++) {
      const t = out.born[c] as CoreTile;
      this.tiles.set(t.id, {
        id: t.id,
        value: t.value,
        face: this.faceFor(t.value),
        r: ROWS - 1,
        c,
        px: c,
        py: silent ? ROWS - 1 : ROWS - 0.45,
        vy: 0,
        q: silent ? 0 : 0.4,
        qv: 0,
        hot: 0,
        spawnAt: this.now,
        landedAt: this.now,
      });
    }
    return true;
  }

  /** Clear any group the board is currently holding, unscored and unanimated. */
  private resolveSilently(): void {
    const b = cloneBoard(this.board);
    const res = cascade(b, { key: this.level.key, nextId: () => this.nextTileId++ });
    if (res.steps.length === 0) return;
    for (const st of res.steps) for (const gp of st.fused) for (const id of gp.ids) this.tiles.delete(id);
    this.board = b;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = this.board[idx(r, c)];
        if (!t) continue;
        const v = this.tiles.get(t.id);
        if (!v) continue;
        v.r = r;
        v.c = c;
        v.px = c;
        v.py = r;
      }
    }
  }

  /**
   * Fill the well before the first chip falls.
   *
   * An empty well means the opening drop does nothing, which is the worst
   * possible first three seconds. Rows are pushed until the board is genuinely
   * full enough to fuse into, topping up whatever the seed's own cascade ate.
   */
  private seedWell(rows: number): void {
    const target = rows * COLS - 4;
    for (let i = 0; i < rows; i++) {
      this.pushRow(true);
      this.resolveSilently();
    }
    let guard = 0;
    while (this.tiles.size < target && guard++ < 12) {
      this.pushRow(true);
      this.resolveSilently();
    }
  }

  private rise(rows = this.level.riseRows): void {
    for (let i = 0; i < rows; i++) {
      if (!this.pushRow()) {
        if (!this.rescueUsed) {
          this.rescueUsed = true;
          this.enterResonance(true);
        } else {
          this.enterBreach();
        }
        return;
      }
    }

    const l = this.layout;
    this.audio.resonanceEnter();
    this.host.haptic("medium");
    this.cam.shake(0.4);
    this.cam.punch(1.4);
    this.riseFlash = 1;
    if (l) {
      for (let c = 0; c < COLS; c++) {
        const p = cellCenter(l, ROWS - 1, c);
        this.parts.spray(p.x, p.y + l.cell * 0.4, DANGER, -Math.PI / 2, 1.1, 6, 300);
      }
      this.rings.add(
        l.boardX + l.boardW / 2,
        l.boardY + l.boardH,
        l.cell * 0.5,
        l.boardW * 0.9,
        0.55,
        4,
        DANGER,
      );
    }

    const after = cloneBoard(this.board);
    const res = cascade(after, { key: this.level.key, nextId: () => this.nextTileId++ });
    this.plan = { steps: res.steps };
    this.stepI = 0;
    if (res.steps.length > 0) this.beginFuseStep();
    else {
      this.phase = "fall";
      this.pt = 0;
      this.fallT = 0;
    }
  }

  /* ---------------- the loop ---------------- */

  update(dtReal: number, nowMs: number): void {
    this.now = nowMs;
    if (this.paused) return;
    const dt = this.cam.update(dtReal);

    this.parts.update(dt);
    this.rings.update(dt);
    this.pops.update(dt);
    this.updateCores(dt);
    this.updateDying(dt);
    this.updateTilePhysics(dt);

    this.shownScore += (this.score - this.shownScore) * Math.min(1, dtReal * 9);
    if (Math.abs(this.score - this.shownScore) < 0.7) this.shownScore = this.score;
    this.chainShownT += dtReal;
    if (this.riseFlash > 0) this.riseFlash = Math.max(0, this.riseFlash - dtReal * 1.6);
    this.danger += (fillRatio(this.board) - this.danger) * Math.min(1, dtReal * 5);
    if (this.charge >= CHARGE_MAX) this.chargeReadyPulse += dtReal;
    else this.chargeReadyPulse = 0;
    if (this.keyMorph > 0) this.keyMorph = Math.max(0, this.keyMorph - dtReal * 1.6);

    this.pt += dt;

    switch (this.phase) {
      case "boot": {
        if (this.pt >= BOOT_TIME) {
          if (!this.held) this.spawnHeld();
          this.phase = "aim";
          this.pt = 0;
        }
        break;
      }
      case "aim": {
        this.aimT += dt;
        const limit = this.level.fuseTime / 1000;
        if (this.held) {
          this.held.px += (this.heldCol - this.held.px) * Math.min(1, dt * 26);
          if (this.aimT >= limit) this.drop();
        }
        // A charged reactor left alone goes critical by itself, so the big
        // question always happens even for a player who never found the tap.
        if (this.charge >= CHARGE_MAX && this.chargeReadyPulse > 7) this.enterResonance(false);
        break;
      }
      case "drop": {
        const t = this.held;
        if (!t) {
          this.phase = "aim";
          break;
        }
        t.vy += DROP_G * dt;
        t.py += t.vy * dt;
        t.px += (this.heldCol - t.px) * Math.min(1, dt * 30);
        if (t.py >= t.r) {
          const hardness = clamp01((t.py - -1.35) / ROWS);
          t.py = t.r;
          t.px = t.c;
          t.vy = 0;
          t.q = 0.34 + hardness * 0.16;
          t.qv = 0;
          t.landedAt = this.now;
          this.board[idx(t.r, t.c)] = { id: t.id, value: t.value };
          this.tiles.set(t.id, t);
          this.held = null;
          this.impact(t, hardness);
          this.stepI = 0;
          if (this.plan && this.plan.steps.length > 0) this.beginFuseStep();
          else this.finishResolution();
        }
        break;
      }
      case "fuse": {
        if (this.pt >= FUSE_BEAT) this.endFuseStep();
        break;
      }
      case "fall": {
        this.fallT += dt;
        let settled = true;
        for (const [, v] of this.tiles) if (v.py < v.r - 0.001) settled = false;
        if (settled || this.fallT > FALL_MAX) {
          for (const [, v] of this.tiles) {
            if (v.py < v.r) {
              v.py = v.r;
              v.vy = 0;
            }
          }
          this.stepI++;
          if (this.plan && this.stepI < this.plan.steps.length) this.beginFuseStep();
          else this.finishResolution();
        }
        break;
      }
      case "levelup": {
        if (!this.levelSeeded && this.pt >= LEVELUP_TIME * 0.55) {
          this.levelSeeded = true;
          for (let i = 0; i < 2; i++) this.pushRow();
          this.cam.shake(0.3);
          this.audio.land(0.8);
        }
        if (this.pt >= LEVELUP_TIME) {
          if (!this.held) this.spawnHeld();
          else this.updatePreview();
          this.phase = "aim";
          this.pt = 0;
        }
        break;
      }
      case "resonance": {
        if (this.res.result === "none") {
          this.res.t += dtReal;
          if (this.res.t >= this.res.limit) {
            if (this.res.fromHost && this.res.question) {
              try {
                this.host.report({
                  questionId: this.res.question.id,
                  correct: false,
                  ms: Math.round(this.now - this.res.askedAt),
                  answered: "",
                });
              } catch {
                /* ignore */
              }
            }
            this.resonanceMiss();
          }
        } else {
          this.res.resultT += dtReal;
          if (this.res.resultT >= (this.res.result === "hit" ? 0.85 : 0.7)) {
            this.res.active = false;
            if (this.res.result === "miss" && this.res.rescue) {
              this.enterBreach();
            } else {
              this.phase = "fall";
              this.pt = 0;
              this.fallT = 0;
              if (!this.held) {
                this.plan = null;
                this.stepI = 0;
              }
            }
          }
        }
        break;
      }
      case "breach": {
        if (this.pt < BREACH_TIME) {
          // stagger the whole well going up, bottom rows last
          const wave = this.pt / (BREACH_TIME * 0.55);
          for (const [id, v] of [...this.tiles]) {
            const k = 1 - v.r / ROWS;
            if (k <= wave) {
              this.tiles.delete(id);
              this.board[idx(v.r, v.c)] = null;
              this.dying.push({
                r: v.r,
                c: v.c,
                value: v.value,
                tier: tierOf(v.value, this.level.key),
                t: 0,
                dur: 0.5,
                kind: "purge",
              });
              const l = this.layout;
              if (l) {
                const p = cellCenter(l, v.r, v.c);
                this.parts.burst(p.x, p.y, DANGER, 380, 12);
                this.parts.shards(p.x, p.y, tierColor(tierOf(v.value, this.level.key)), l.cell, 4);
              }
              this.cam.shake(0.1);
            }
          }
        }
        break;
      }
    }

    if (this.layout && this.fxRng.chance(1, 5) && this.parts.count < 320) {
      const l = this.layout;
      this.parts.ember(
        l.boardX + this.fxRng.int(Math.max(1, l.boardW)),
        l.boardY + l.boardH,
        [40, 90, 180],
        1,
      );
    }
  }

  private impact(t: TileView, hardness: number): void {
    const l = this.layout;
    this.audio.land(hardness);
    this.host.haptic("light");
    this.cam.stop(28 + hardness * 22);
    this.cam.shake(0.09 + hardness * 0.13);
    this.cam.punch(0.7 + hardness * 0.5);
    if (l) {
      const p = cellCenter(l, t.r, t.c);
      const col = tierColor(tierOf(t.value, this.level.key));
      this.parts.spray(p.x - l.cell * 0.4, p.y + l.cell * 0.34, col, Math.PI, 0.9, 5, 240);
      this.parts.spray(p.x + l.cell * 0.4, p.y + l.cell * 0.34, col, 0, 0.9, 5, 240);
      this.rings.add(p.x, p.y + l.cell * 0.3, l.cell * 0.15, l.cell * 1.25, 0.34, 2.5, col);
    }
    // the stack below feels it
    for (let rr = t.r + 1; rr < ROWS; rr++) {
      const below = this.board[idx(rr, t.c)];
      if (!below) break;
      const v = this.tiles.get(below.id);
      if (v) v.q = Math.max(v.q, 0.2 / (rr - t.r));
    }
  }

  private updateTilePhysics(dt: number): void {
    const springK = 380;
    const springC = 23;
    for (const [, v] of this.tiles) {
      if (v.py < v.r) {
        v.vy += FALL_G * dt;
        v.py += v.vy * dt;
        if (v.py >= v.r) {
          v.py = v.r;
          v.vy = 0;
          v.q = Math.max(v.q, 0.22);
          this.audio.land(0.25);
        }
      } else if (v.py > v.r) {
        // pushed up by a rise: a fast lurch, not a fall
        v.py += (v.r - v.py) * Math.min(1, dt * 17);
        if (v.py - v.r < 0.02) v.py = v.r;
      }
      v.px += (v.c - v.px) * Math.min(1, dt * 24);
      v.qv += (-springK * v.q - springC * v.qv) * dt;
      v.q += v.qv * dt;
      // Hard clamp: impulses arrive from several places at once (a slam, the
      // stack ripple, a rise) and a chip drawn at 1.9x wide by 0.1x tall is a
      // sliver, not a chip. The spring may ring, it may not invert geometry.
      if (v.q > 0.55) v.q = 0.55;
      else if (v.q < -0.45) v.q = -0.45;
      if (Math.abs(v.q) < 0.002 && Math.abs(v.qv) < 0.02) {
        v.q = 0;
        v.qv = 0;
      }
      const wanted = this.previewCells.some((p) => p.r === v.r && p.c === v.c) ? 1 : 0;
      v.hot += (wanted - v.hot) * Math.min(1, dt * 14);
    }
    const h = this.held;
    if (h) {
      h.qv += (-springK * h.q - springC * h.qv) * dt;
      h.q += h.qv * dt;
      if (h.q > 0.55) h.q = 0.55;
      else if (h.q < -0.45) h.q = -0.45;
    }
  }

  private updateDying(dt: number): void {
    for (const d of this.dying) d.t += dt;
    this.dying = this.dying.filter((d) => d.t < d.dur);
  }

  private updateCores(dt: number): void {
    const l = this.layout;
    for (const c of this.cores) {
      if (!c.alive) continue;
      c.t += dt;
      if (c.t >= c.dur) {
        c.alive = false;
        this.charge = Math.min(CHARGE_MAX, this.charge + 1);
        this.audio.core(Math.min(8, this.chainShown));
        if (l) {
          this.rings.add(l.keyX, l.keyY, l.keyR * 0.5, l.keyR * 2.1, 0.34, 2.5, c.color);
          this.parts.burst(l.keyX, l.keyY, c.color, 200, 7);
        }
        this.cam.punch(0.35);
        if (this.charge === CHARGE_MAX) {
          this.audio.chargeReady();
          this.cam.punch(1.1);
          if (l) this.rings.add(l.keyX, l.keyY, l.keyR * 0.6, l.keyR * 4, 0.7, 3, CHARGE);
        }
      }
    }
    this.cores = this.cores.filter((c) => c.alive);
  }

  /** quadratic bezier position of a flying core */
  corePos(c: FlyCore): { x: number; y: number; s: number } {
    const l = this.layout;
    const x1 = l ? l.keyX : c.x0;
    const y1 = l ? l.keyY : c.y0;
    const t = ease.inOutCubic(clamp01(c.t / c.dur));
    const u = 1 - t;
    return {
      x: u * u * c.x0 + 2 * u * t * c.cx + t * t * x1,
      y: u * u * c.y0 + 2 * u * t * c.cy + t * t * y1,
      s: 1 - t * 0.45,
    };
  }

  chargeRatio(): number {
    return this.charge / CHARGE_MAX;
  }

  levelProgress(): number {
    return clamp01(this.fusesThisLevel / this.level.quota);
  }

  aimRatio(): number {
    return clamp01(this.aimT / (this.level.fuseTime / 1000));
  }

  peekUpcoming(n: number): number[] {
    return this.upcoming.slice(0, n);
  }
}

function readBest(): number {
  try {
    const v = Number(localStorage.getItem(BEST_KEY) ?? "0");
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

function writeBest(v: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(Math.floor(v)));
  } catch {
    /* private mode is not an error */
  }
}

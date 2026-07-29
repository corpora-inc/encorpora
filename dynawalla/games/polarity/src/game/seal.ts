import { isPrintable } from "../core/labels.ts";
import { TAU, approach, clamp } from "../core/util.ts";
import { tryParseInt } from "../math/signed.ts";
import type { Question } from "../contract.ts";
import {
  BK,
  BULLET,
  COL,
  CORE,
  EK,
  ENEMY,
  HALF_W,
  ORB_SPREAD,
  PACE,
  SCORE,
  polColor,
  polHot,
} from "./constants.ts";
import { fireChaff, fireCharge, spawnEnemy } from "./enemies.ts";
import type { Bullet, Enemy } from "./types.ts";
import {
  addBullet,
  burst,
  cue,
  flash,
  hitstop,
  punch,
  ring,
  shake,
  shockwave,
  slowmo,
  type World,
} from "./world.ts";

/**
 * The question layer, and the only place `host.next()` / `host.report()` are
 * called.
 *
 * The whole integration is motion, not UI. A Seal Bearer holds the prompt on
 * its hull and drops four ORBS carrying the answer and three mal-rule
 * distractors. (The Warden does not: its lock is the ship's own running sum, a
 * number this game invented, and it asks the child nothing — see `stepWarden`.)
 * An orb's SIGN is its polarity, so:
 *
 *   - you can fly straight through any orb whose sign is not yours — wrong
 *     answers of the opposite sign are ghosts;
 *   - an orb of your own sign is solid, and touching it commits you.
 *
 * So answering is: read the prompt, pick a polarity, thread the mines. There is
 * no button, no red X and no lecture — a wrong answer detonates in your face
 * and costs a shield, which is a real price, and the correct orb is still
 * sitting there waiting.
 */

const ORB_SPEED_IN = 26;
const ORB_HOLD_BASE = 7.5;
const ORB_HOLD_MIN = 4.6;

export function bearerDue(w: World): boolean {
  return !w.bossActive && w.t >= w.nextBearer;
}

export function scheduleNextBearer(w: World): void {
  const gap = Math.max(PACE.bearerEveryMin, PACE.bearerEvery - w.bearerCount * 1.1);
  w.nextBearer = w.t + gap;
}

export function launchBoss(w: World): void {
  w.bearerCount++;
  const warden = w.bearerCount % PACE.wardenEvery === 0;
  const e = spawnEnemy(w, warden ? EK.Warden : EK.Bearer);
  if (!e) return;
  const spec = ENEMY[warden ? EK.Warden : EK.Bearer];
  if (spec) {
    // bosses toughen with depth so they stay a real fight at minute 20
    const scale = 1 + Math.min(2.4, w.stratum * 0.16);
    e.hp = Math.round(spec.hp * scale);
    e.maxHp = e.hp;
  }
  w.bossActive = true;
  w.hush = 1;
  w.events.push(warden ? "warden" : "bearer");
  shockwave(w, 0, w.halfH * 0.5, 1, 0, 0.9);
}

// ---------------------------------------------------------------------------
// asking
// ---------------------------------------------------------------------------

/**
 * How many items to refuse before giving up on this Bearer.
 *
 * Refusing is meant to be a rarity — the atlas prints any integer up to
 * `LABEL_MAX_CHARS`, so the only things left to refuse are an answer that is not
 * an integer and an answer wider than the lane. A bound exists so a host serving
 * a whole rung this game cannot draw costs a bearer, not a hang — and, since
 * `capBelow`, costs it exactly once.
 */
const MAX_ASK_TRIES = 6;

/**
 * A 0..1 ladder position, spelled so the host cannot read it as the other scale.
 *
 * `packs/shared/game-host` reads a value below 1 as a fraction and 1..10 as a
 * ladder index, and resolves the one value both scales claim — `1` — as the
 * BOTTOM, because six other games send exactly that on their opening question
 * and meant the easiest content in the product.
 *
 * POLARITY sent a fraction, and its fraction is `clamp(0.14 + stratum * 0.06, 0,
 * 1)`, which reaches exactly 1 at stratum 15 — about seven and a half minutes of
 * good play — and meant the HARDEST content. So the one number this game was
 * guaranteed to send eventually was the one number that meant the opposite of
 * what it wanted: a child who had climbed fifteen strata was dropped to the
 * bottom of the ladder and held there for the rest of the run. `game-host` names
 * this game in the comment on that rule. It speaks the unambiguous scale now.
 */
export function ladderScale(unit: number): number {
  return 1 + clamp(unit, 0, 1) * 9;
}

/**
 * How far below a rung the ceiling is set when that rung turns out undrawable.
 *
 * The host floors `maxDifficulty * span` to a rung index, so an ordinate of
 * `used / span` minus anything strictly between 0 and one rung excludes exactly
 * that rung and keeps every rung below it. A thousandth is below one rung for
 * any ladder shorter than a thousand rungs; the shipping one has sixty.
 */
const CEILING_STEP = 1e-3;

/**
 * The values an item would put on the field: the answer first, then its wrongs.
 *
 * Null means "this game cannot ask this item" — the seal declines it and the
 * host serves another. Two reasons, both loud where they happen:
 *
 *   * a value that will not print, and
 *   * fewer than two values, which is not a question. One orb on the field is
 *     the right answer by elimination; a child touching it is not retrieval, and
 *     reporting it as a correct answer inflates a record that only ever rises.
 *
 * `maxChars` exists for the same reason it exists on `isPrintable`: the refusal
 * guards against a curriculum wider than the one that ships, and a test that
 * cannot narrow the budget cannot reach it. Nothing in the game passes it.
 */
export function orbValues(q: Question, orbCount: number, maxChars?: number): number[] | null {
  const answer = tryParseInt(q.answer);
  // A value the game cannot print must never be offered. There is no third
  // option where it is offered and comes out blank.
  if (answer === null || !isPrintable(answer, maxChars)) return null;
  const out = [answer];
  for (const d of q.distractors) {
    if (out.length >= orbCount) break;
    const v = tryParseInt(d);
    // A wrong answer that will not print is dropped, not drawn: three orbs a
    // child can read beat four where one is a blank disc.
    if (v === null || !isPrintable(v, maxChars) || out.includes(v)) continue;
    out.push(v);
  }
  return out.length >= Math.min(2, orbCount) ? out : null;
}

/** What this run asks the host for, difficulty and ceiling both. */
export function askShape(w: World): { difficulty: number; maxDifficulty?: number } {
  const want = clamp(0.14 + w.stratum * 0.06, 0, 1);
  const ask: { difficulty: number; maxDifficulty?: number } = {
    difficulty: ladderScale(want),
  };
  if (w.drawCeiling !== null) ask.maxDifficulty = ladderScale(w.drawCeiling);
  return ask;
}

/**
 * Ban the rung an unprintable item came from, and everything above it.
 *
 * **This is the durable half of the numeral fix.** Widening the numeral moves
 * the ceiling; this is what makes a ceiling safe. A pack that cannot draw a rung
 * has to tell the host, because declining is per-item and the host serves by
 * RUNG: ask again at the same difficulty and the same rung answers. Six refusals
 * later the Bearer cracks open having asked nothing, the next one does the same,
 * and the child at the top of the ladder is served silence — which is not a
 * degradation, it is a soft-lock, and it is what `NUMERAL_WIDTH_BLOCKED_LEVELS`
 * was recording.
 *
 * Monotone downwards and never raised again. A rung that could not be drawn once
 * cannot be drawn later — the budget is a constant — and a ceiling that drifted
 * back up would re-enter the same starve every time the child climbed.
 */
function capBelow(w: World, q: Question): void {
  // A difficulty that is not a number caps nothing. `clamp` is NaN-transparent,
  // so without this the ceiling becomes NaN — which `readScale` then discards as
  // "not a difficulty", leaving the ceiling inert AND `drawCeiling <= capped`
  // permanently false, so every later refusal re-logs and re-flushes forever.
  if (!Number.isFinite(q.difficulty)) return;
  const at = clamp(q.difficulty, 0, 1);
  const capped = Math.max(0, at - CEILING_STEP);
  if (w.drawCeiling !== null && w.drawCeiling <= capped) return;
  w.drawCeiling = capped;
  // The pool is still stocked from the rung just ruled out, but the flush waits
  // until `askShape` has carried the new ceiling into `next()`. See
  // `World.pendingFlush`.
  w.pendingFlush = true;
  console.error(
    `[polarity] a rung POLARITY cannot draw was served at difficulty ${at.toFixed(3)}; ` +
      `capping the stream at ${capped.toFixed(3)} for the rest of this run`,
  );
}

/**
 * Is this refusal a fact about the RUNG, or only about this item?
 *
 * `orbValues` says no for two reasons and only one of them is the rung's. An
 * unprintable ANSWER is a property of the rung: the budget is a constant, so
 * every item from that rung is equally undrawable. Too few distractors is a
 * property of the ITEM, and capping on it was a session-ending bug — the host's
 * dry-pool sentinel is `{ id: "", answer: "0", distractors: [] }`, which parses
 * and prints perfectly and yields exactly one value. One transient empty pool
 * therefore read as "difficulty 0 is undrawable", pinned the ceiling at 0 where
 * the monotone guard made it unraisable, and `startRun` deliberately does not
 * reset it — so every question for the rest of the mount was the easiest rung in
 * the product. An id of `""` is the host's own marker for "this is not a served
 * item"; nothing about it describes a rung.
 *
 * The `id === ""` line is belt-and-braces and is NOT load-bearing today: the
 * sentinel's `answer: "0"` prints, so the printability check below already
 * refuses to cap on it, and deleting the id line breaks no test. It stays
 * because a sentinel is the host's to change and the next one may not print —
 * at which point capping on it would silently pin the run again.
 */
function rungCannotDraw(q: Question): boolean {
  if (q.id === "") return false;
  const answer = tryParseInt(q.answer);
  return answer === null || !isPrintable(answer);
}

/** Draw an item this game can actually put on the field, or nothing. */
function drawAskable(w: World, orbCount: number): { q: Question; values: number[] } | null {
  for (let i = 0; i < MAX_ASK_TRIES; i++) {
    const q = w.host.next(askShape(w));
    // `askShape` has just put the new ceiling on the wire, so the pool can now
    // be ranked against it. Flushing inside `capBelow` ranked it against the old
    // one and kept the banned rung.
    if (w.pendingFlush) {
      w.pendingFlush = false;
      w.host.flush?.();
    }
    const values = orbValues(q, orbCount);
    if (values) return { q, values };
    if (rungCannotDraw(q)) capBelow(w, q);
    console.error(
      `[polarity] declined an item POLARITY cannot print: ${q.prompt} = ${JSON.stringify(q.answer)}`,
    );
  }
  console.error("[polarity] no printable item after " + String(MAX_ASK_TRIES) + " tries");
  return null;
}

function askQuestion(w: World, e: Enemy, orbCount: number): boolean {
  const drawn = drawAskable(w, orbCount);
  if (!drawn) return false;
  const { q, values } = drawn;
  w.sealSerial++;
  w.seal.serial = w.sealSerial;
  w.seal.state = "asking";
  w.seal.q = q;
  w.seal.askedAt = w.t;
  w.seal.answered = "";
  e.seal = w.sealSerial;
  w.prompt = q.prompt;
  w.promptV++;
  w.stats.asked++;

  const order = w.rng.shuffle(values.map((v, i) => ({ v, correct: i === 0 })));
  const n = Math.min(orbCount, order.length);

  for (let i = 0; i < n; i++) {
    const o = order[i];
    if (!o) continue;
    const b = addBullet(w);
    if (!b) continue;
    const tx = -ORB_SPREAD / 2 + (ORB_SPREAD * (i + 0.5)) / n;
    b.x = e.x;
    b.y = e.y - e.r * 0.4;
    b.vx = (tx - e.x) * 0.55;
    b.vy = -ORB_SPEED_IN;
    b.v = o.v;
    b.r = BULLET.orbR;
    b.kind = BK.Orb;
    b.owner = 0;
    b.life = 40;
    b.labelled = 1;
    b.seal = w.sealSerial;
    b.correct = o.correct ? 1 : 0;
    b.wob = w.rng.f() * TAU;
    b.grow = 1;
    b.dmg = 1;
  }
  ring(w, e.x, e.y, e.r * 1.6, COL.gold, 0.55, 2.2);
  burst(w, e.x, e.y, 26, 42, COL.gold, { life: 0.6, size: 1.8 });
  punch(w, 0.35);
  cue(w, "seal");
  return true;
}

/** Orb flight: glide to the presentation band, hover and weave, then leave. */
export function stepOrb(w: World, b: Bullet, dt: number, hurry: number): void {
  const band = -w.halfH * 0.06;
  b.wob += dt * 1.15;
  if (b.y > band) {
    b.y += b.vy * dt * hurry;
    b.vx = approach(b.vx, 0, 0.4, dt);
    b.x += b.vx * dt;
  } else {
    b.y = approach(b.y, band + Math.sin(b.wob * 1.3) * 5.5, 0.5, dt);
    b.x += Math.cos(b.wob * 0.9 + b.v) * 11 * dt * hurry;
    b.x = clamp(b.x, -HALF_W + b.r, HALF_W - b.r);
  }
  b.rot += (b.v > 0 ? 0.9 : -0.7) * dt;
  if (b.grow > 0) b.grow = Math.max(0, b.grow - dt * 3.4);
}

// ---------------------------------------------------------------------------
// resolution
// ---------------------------------------------------------------------------

function killSealOrbs(w: World, serial: number, correctToo: boolean): void {
  // Serial 0 is "belongs to no seal", which every chaff round on the field also
  // carries. A boss whose ask was declined still runs its timeout, and without
  // this it would sweep the whole playfield clean.
  if (serial <= 0) return;
  for (let i = 0; i < w.bulletN; i++) {
    const b = w.bullets[i] as Bullet;
    if (b.seal !== serial) continue;
    if (!correctToo && b.correct) continue;
    burst(w, b.x, b.y, 12, 40, polColor(b.v), { life: 0.45, size: 1.6, kind: 1 });
    b.live = false;
  }
}

export function onOrbTouched(w: World, b: Bullet): void {
  // An orb from a seal that is already over is scenery, not an answer.
  //
  // They exist: a wrong answer deliberately leaves the correct orb hanging
  // there ("the correct orb is still sitting there waiting"), it carries
  // `life = 40`, and the next Bearer arrives 26 seconds later. Without this
  // check, flying into that leftover reports its value — and its `correct`
  // flag — against whichever question is CURRENT, crediting a child with an
  // answer to a question nobody asked them. It reads as generosity and it is a
  // false record.
  if (b.seal !== w.seal.serial) {
    burst(w, b.x, b.y, 10, 34, polColor(b.v), { life: 0.4, size: 1.4, kind: 1 });
    b.live = false;
    return;
  }

  const q = w.seal.q;
  const first = w.seal.state === "asking";
  const correct = b.correct === 1;

  if (first && q) {
    w.seal.answered = String(b.v);
    w.seal.state = correct ? "won" : "lost";
    w.host.report({
      questionId: q.id,
      correct,
      ms: Math.max(1, Math.round((w.t - w.seal.askedAt) * 1000)),
      answered: w.seal.answered,
    });
    if (correct) w.stats.right++;
  }

  if (correct) sealBroken(w, b);
  else sealWrong(w, b);
}

function sealBroken(w: World, b: Bullet): void {
  const serial = b.seal;
  const col = polColor(b.v);

  // the answer is worth real charge — and it can never overload you
  const before = w.core;
  w.core = clamp(w.core + b.v, -w.cap, w.cap);
  const spilled = Math.abs(before + b.v) - Math.abs(w.core);
  w.chain += 6;
  w.stats.absorbs++;
  const mult = Math.min(9, 1 + Math.floor(w.chain / 6));
  w.stats.score += SCORE.sealCorrect * mult + Math.max(0, spilled) * 60;

  b.live = false;
  killSealOrbs(w, serial, true);

  hitstop(w, 0.1);
  slowmo(w, 0.42, 0.72);
  punch(w, 1);
  shake(w, 0.5);
  flash(w, 0.3, COL.gold);
  shockwave(w, b.x, b.y, 1.4, b.v > 0 ? 1 : -1, 0.85);
  ring(w, b.x, b.y, 4, COL.gold, 0.7, 3.4);
  ring(w, b.x, b.y, 9, polHot(b.v), 0.55, 2.2);
  burst(w, b.x, b.y, 70, 110, COL.gold, { life: 1, size: 2.6, kind: 1 });
  burst(w, b.x, b.y, 34, 60, col, { life: 0.7, size: 2 });
  w.host.haptic("success");
  w.events.push("seal-won");

  // crack the bearer open
  for (let i = 0; i < w.enemyN; i++) {
    const e = w.enemies[i] as Enemy;
    if (e.seal !== serial) continue;
    e.lockState = 2; // vulnerable
    e.hitFlash = 1;
    e.fireT = 1.6;
    if (e.kind === EK.Bearer) e.hp = Math.min(e.hp, Math.ceil(e.maxHp * 0.34));
    else e.hp = Math.min(e.hp, Math.ceil(e.maxHp * 0.62));
  }
}

function sealWrong(w: World, b: Bullet): void {
  const serial = b.seal;
  b.live = false;
  burst(w, b.x, b.y, 44, 96, COL.bad, { life: 0.75, size: 2.3, kind: 1 });
  ring(w, b.x, b.y, 5, COL.bad, 0.5, 3);
  shockwave(w, b.x, b.y, 1.1, 0, 0.6);
  w.events.push("seal-wrong");
  // the remaining orbs get harder to reach, and the bearer answers back
  for (let i = 0; i < w.bulletN; i++) {
    const o = w.bullets[i] as Bullet;
    if (o.seal === serial) o.wob += 1.4;
  }
  for (let i = 0; i < w.enemyN; i++) {
    const e = w.enemies[i] as Enemy;
    if (e.seal !== serial) continue;
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      fireChaff(w, e.x, e.y, a, 34, k % 2 ? 1 : -1);
    }
  }
}

export function sealTimedOut(w: World): void {
  const q = w.seal.q;
  if (w.seal.state !== "asking" || !q) return;
  w.seal.state = "lost";
  w.host.report({
    questionId: q.id,
    correct: false,
    ms: Math.max(1, Math.round((w.t - w.seal.askedAt) * 1000)),
    answered: "",
  });
}

// ---------------------------------------------------------------------------
// bearer + warden choreography
// ---------------------------------------------------------------------------

export function stepBoss(w: World, e: Enemy, dt: number, spd: number): void {
  e.age += dt;
  if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 4);
  e.fireT -= dt;
  e.rot += dt * (e.kind === EK.Warden ? 0.5 : 0.32);

  e.y = approach(e.y, e.ay, 0.85, dt);
  e.x = approach(e.x, e.ax + Math.sin(e.age * 0.6 + e.seed) * 13, 0.9, dt);

  if (e.kind === EK.Bearer) stepBearer(w, e, dt, spd);
  else stepWarden(w, e, dt, spd);
}

function stepBearer(w: World, e: Enemy, _dt: number, spd: number): void {
  if (e.phase === 0 && e.age > 1.15) {
    // A Bearer with nothing printable to carry is just a boss. It cracks open
    // rather than hovering over a seal that was never set.
    e.phase = askQuestion(w, e, 4) ? 1 : 2;
    e.lockState = e.phase === 1 ? 0 : 2;
    e.fireT = 1.2;
  }
  if (e.phase === 1) {
    const hold = Math.max(ORB_HOLD_MIN, ORB_HOLD_BASE - w.bearerCount * 0.35);
    if (w.t - w.seal.askedAt > hold + 3 && w.seal.state === "asking") {
      sealTimedOut(w);
      killSealOrbs(w, e.seal, true);
      e.phase = 2;
      e.lockState = 2;
    } else if (w.seal.state !== "asking") {
      e.phase = 2;
    }
    // light suppressing fire so the puzzle is not a rest stop
    if (e.fireT <= 0) {
      e.fireT = 1.5 / spd;
      const a = Math.atan2(w.py - e.y, w.px - e.x);
      fireChaff(w, e.x - e.r * 0.7, e.y, a, 30 * spd, 1);
      fireChaff(w, e.x + e.r * 0.7, e.y, a, 30 * spd, -1);
    }
  }
  if (e.phase === 2 && e.fireT <= 0) {
    e.fireT = 0.85 / spd;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.3 + Math.sin(e.age) * 0.3;
      fireChaff(w, e.x, e.y - e.r * 0.5, a, 42 * spd, i % 2 ? 1 : -1);
    }
  }
}

/** How long a lock stays open, and how long the enrage after it lasts. */
const LOCK_OPEN_FOR = 15;
const LOCK_ENRAGE_FOR = 7;

/**
 * The core value a lock demands.
 *
 * The game's OWN number, drawn from inside the band the core can actually reach,
 * and reported to nobody.
 *
 * It used to be a curriculum answer squeezed through `clamp(answer, -cap, cap)`.
 * With a cap that starts at 20 and an answer stream in the hundreds and
 * thousands, that clamp fired on essentially every Warden: the boss demanded a
 * total that had nothing to do with the question printed on its hull, and then
 * reported that total as the child's answer. A child who played it perfectly was
 * recorded as answering `20` to `4003 − 87`, and an adaptive controller reading
 * that record would push them DOWN the ladder for playing well.
 *
 * A clamp that changes the question is not a clamp, it is a corruption. The band
 * now constrains what is ASKED — the lock asks for a number the core can hold —
 * and it asks it on the game's own behalf, so there is nothing to corrupt.
 */
function drawLockTarget(w: World): number {
  const reach = Math.max(4, Math.min(w.cap, 18));
  return w.rng.sign() * w.rng.i(3, reach);
}

/**
 * The Warden is the deep end: it locks itself to an exact core total, and only a
 * RELEASE at that exact total breaks the lock. Getting within two still does
 * real damage, so a younger player still makes progress; exactness is worth
 * three times as much.
 *
 * **It asks the child nothing, and it reports nothing.** The lock is the ship's
 * own running sum — the arithmetic a child performs by flying — and `pack.ts`
 * has always said that is "not a question anybody asked, so nothing about it is
 * reported". The curriculum's questions belong to the Bearer, which can put four
 * readable values on the field and be answered by touching one.
 *
 * Giving the Warden orbs as well was tried and reverted in the same change: the
 * lock and a live seal share one boss and fight each other — answering cracks
 * the hull open, which closes the lock, so a right answer would delete the
 * mechanic and a wrong one would not. Two things at once in a bullet phase is a
 * design decision that wants a tablet and a child, not a patch.
 *
 * Its timing runs off `e.age` rather than `w.seal.askedAt`, because it no longer
 * owns a seal and a stale `askedAt` would open and close the lock in one frame.
 */
function stepWarden(w: World, e: Enemy, _dt: number, spd: number): void {
  const hpf = e.hp / e.maxHp;

  if (e.phase === 0 && e.age > 1.1) {
    e.phase = 1;
    e.fireT = 0.4;
  }

  // phase 1 — alternating polarity walls you fly INTO
  if (e.phase === 1) {
    if (e.fireT <= 0) {
      e.fireT = 0.62 / spd;
      e.lockState = 0;
      const pol = ((e.age * 1.6) | 0) % 2 ? 1 : -1;
      const gap = Math.sin(e.age * 0.9) * (HALF_W * 0.45);
      for (let i = -8; i <= 8; i++) {
        const x = (i / 8) * (HALF_W - 4);
        if (Math.abs(x - gap) < 9) continue;
        fireChaff(w, x, e.y - e.r * 0.7, -Math.PI / 2, 40 * spd, pol);
      }
    }
    if (e.age > 6.5) {
      e.phase = 2;
      e.age = 0;
      e.lockWant = drawLockTarget(w);
      e.lockState = 1;
      e.fireT = 0.6;
      cue(w, "lock");
      ring(w, e.x, e.y, e.r * 1.8, COL.gold, 0.7, 3);
      w.events.push("lock-open");
    }
  }

  // phase 2 — the lock: it feeds you charge, you steer the total, you vent
  if (e.phase === 2) {
    if (e.fireT <= 0) {
      e.fireT = 1.25 / spd;
      for (let i = 0; i < 3; i++) {
        const sign = i === 1 ? Math.sign(e.lockWant - w.core) || 1 : w.rng.sign();
        const mag = w.rng.i(2, 8);
        const a = -Math.PI / 2 + (i - 1) * 0.5;
        fireCharge(w, e.x, e.y - e.r * 0.5, a, 24 * spd, sign * mag);
      }
      for (let i = 0; i < 4; i++) {
        fireChaff(w, e.x, e.y, -Math.PI / 2 + (i - 1.5) * 0.7, 32 * spd, w.rng.sign());
      }
    }
    if (e.age > LOCK_OPEN_FOR) {
      e.phase = 3;
      e.age = 0;
      e.lockState = 0;
      e.fireT = 0.2;
    }
  }

  // phase 3 — enrage, then loop back
  if (e.phase === 3) {
    if (e.fireT <= 0) {
      e.fireT = 0.1 / spd;
      const a = e.rot * 3.4;
      for (let arm = 0; arm < 3; arm++) {
        const t = a + (arm / 3) * TAU;
        fireChaff(w, e.x, e.y, t, 38 * spd, arm % 2 ? 1 : -1, hpf < 0.4 ? 2 : 1);
      }
    }
    if (e.age > LOCK_ENRAGE_FOR) {
      e.phase = 1;
      e.age = 0;
      e.fireT = 0.5;
    }
  }
}

/** Called from the sim when the player releases while a lock is open. */
export function tryLock(w: World, e: Enemy): "exact" | "near" | "miss" {
  const d = Math.abs(w.core - e.lockWant);
  const res = d === 0 ? "exact" : d <= 2 ? "near" : "miss";
  if (res === "miss") {
    ring(w, e.x, e.y, e.r * 1.4, COL.bad, 0.45, 2.4);
    burst(w, e.x, e.y, 20, 50, COL.bad, { life: 0.5, size: 1.8 });
    shake(w, 0.22);
    return res;
  }
  const exact = res === "exact";
  e.hp -= exact ? Math.ceil(e.maxHp * 0.42) : Math.ceil(e.maxHp * 0.14);
  e.hitFlash = 1;
  e.phase = 3;
  e.age = 0;
  e.lockState = 0;
  w.stats.score += exact ? SCORE.wardenLockExact : SCORE.wardenLockNear;
  // Nothing is reported here, deliberately. The lock is the ship's own running
  // sum — a number this game invented, inside a band this game chose — and the
  // curriculum never asked it. The Warden's actual question is committed by
  // touching an orb, same as every other question, and that is what is reported.
  hitstop(w, exact ? 0.13 : 0.06);
  slowmo(w, exact ? 0.5 : 0.2, 0.7);
  punch(w, exact ? 1 : 0.5);
  shake(w, exact ? 0.65 : 0.3);
  flash(w, exact ? 0.34 : 0.16, COL.gold);
  shockwave(w, e.x, e.y, exact ? 1.8 : 1, 0, 1);
  burst(w, e.x, e.y, exact ? 90 : 40, exact ? 130 : 70, COL.gold, {
    life: 1,
    size: 2.8,
    kind: 1,
  });
  w.host.haptic(exact ? "success" : "medium");
  w.events.push(exact ? "lock-exact" : "lock-near");
  return res;
}

export function bossDefeated(w: World, e: Enemy): void {
  if (w.seal.state === "asking" && e.seal === w.seal.serial) {
    sealTimedOut(w);
  }
  // Unconditionally, not only when the seal was still open. A seal LOST to a
  // wrong answer deliberately leaves its correct orb hovering, and that orb
  // outlives the boss by half a minute — long enough to be flown into while the
  // next Bearer's question is on screen.
  killSealOrbs(w, e.seal, true);
  w.bossActive = false;
  w.hush = 0;
  w.stats.score += e.kind === EK.Warden ? SCORE.wardenLockExact : SCORE.bearerKill;
  scheduleNextBearer(w);
  // grow the band every boss — the arithmetic gets more room to breathe
  w.cap = Math.min(CORE.capMax, w.cap + CORE.capStep);
  w.events.push("boss-down");
}

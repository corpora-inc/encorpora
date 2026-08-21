/**
 * Creating a learner, and writing one down.
 *
 * ## Cold start
 *
 * **No placement test.** A six-year-old's first minute with an app is not the
 * moment to administer twenty diagnostic items, and a placement test is also the
 * least reliable data the model will ever get. One grade answer seeds every skill
 * — `b̄ − 0.4` at or below the band, `b̄ − 2.0` one band above — and the first
 * twenty cards do the rest, inside the fiction, never labelled a test.
 *
 * The seeding is deliberately *pessimistic* at the band and *very* pessimistic
 * above it. A child seeded too low gets easy cards and climbs out in a dozen
 * items; a child seeded too high gets a first session they cannot do. Those two
 * errors are not symmetric and the constants are not symmetric either.
 *
 * ## Persistence
 *
 * Gate EG-3 caps a learner at **100 KB after 500 simulated sessions**, and the
 * only way to be sure of that is for the state to be bounded *by construction*:
 * every component below is a fixed-size record in a capped collection, so the
 * 500-session measurement reads the same number as the 5-session one.
 *
 * The codec is a packed binary form plus a shared id dictionary, base64'd for a
 * `localStorage` string. The dictionary matters and ADAPTIVE_LEARNING.md's
 * itemisation does not mention it: `dw.add.regroup.subtract-across-zero` is 34
 * bytes and a fact key is longer, so storing an id per record would cost more
 * than the records. Every id is written once and referenced by index.
 *
 * A 32-bit hash of the id would be four bytes and no dictionary — and two ids
 * that collided would silently merge two of a child's skills. Skill ids are
 * mastery keys; that trade is not worth 15 KB.
 */

import {
  COLD_START_MIN_P,
  MAX_EVENTS,
  MAX_ROLLUPS,
  MAX_TRACKED_BUGS,
  P_TARGET_DEFAULT,
  SEED_ABOVE_BAND,
  SEED_AT_BAND,
} from "./constants.ts";
import type { Catalog } from "./catalog.ts";
import { frustrationFloor } from "./controller.ts";
import { NEW_LATENCY_STATS } from "./facts.ts";
import { logit } from "./math/elementary.ts";
import { add } from "./math/fixed.ts";
import type { Fix } from "./math/fixed.ts";
import { seedSkill } from "./skill.ts";
import type { Day, LearnerState, SkillId, SkillState } from "./types.ts";

export function emptyLearner(today: Day = 0): LearnerState {
  return {
    pTarget: P_TARGET_DEFAULT,
    skills: {},
    bugs: {},
    facts: {},
    latency: NEW_LATENCY_STATS,
    today,
    answered: 0,
    recent: [],
    rollups: [],
    events: [],
  };
}

/**
 * Seed a learner from one grade answer.
 *
 * Skills more than one band above the stated grade are left unseeded — they are
 * unreachable anyway until their prerequisites are Practiced, and seeding them
 * would put a number in the state file for every skill in the curriculum on day
 * one, which is the state budget spent on nothing.
 */
export function coldStart(catalog: Catalog, grade: number, today: Day = 0): LearnerState {
  // The floor that actually binds. ADAPTIVE_LEARNING.md states two rules about a
  // child's first cards and they are **not consistent as written**: `θ_s^0 = b̄_s
  // − 0.4` and "no card in the first 20 may have `P̂ < 0.55`". With the easiest
  // level of a skill at or above the node's own `b̄` — which is the case for
  // every node in the real curriculum, where `subtract-multidigit` has `b̄ =
  // −0.50` and its level 0 sits at `+0.05` — the seed alone caps the first card
  // at `σ(−0.4) = 0.40`, and no amount of selection can raise it because there is
  // nothing easier to serve.
  //
  // The seed is a prior; the floor is a promise about what the child sees. So the
  // seed yields: it is `b̄ − 0.4` **or** whatever makes the skill's easiest level
  // clear the floor, whichever is higher. The floor used is the stricter of the
  // two the documents state — 0.55 from the cold-start rule and `pTarget − 0.20`
  // from the anti-frustration rule, which is 0.60 at the default target. Seeding
  // to the weaker of them would leave the first card tripping the other one, and
  // re-planning the batch on every single card, which is what it did.
  const floor = frustrationFloor(P_TARGET_DEFAULT);
  const minimum = floor > COLD_START_MIN_P ? floor : COLD_START_MIN_P;
  const headroom = logit(minimum);

  const skills: Record<SkillId, SkillState> = {};
  for (const skill of catalog.skills) {
    const distance = skill.gradeNominal - grade;
    if (distance > 1) continue;
    const offset = distance <= 0 ? SEED_AT_BAND : SEED_ABOVE_BAND;
    const prior = add(skill.b, offset);
    const easiest = skill.levels[0]?.b ?? skill.b;
    const playable = add(easiest, headroom);
    skills[skill.id] = seedSkill(distance <= 0 && prior < playable ? playable : prior, today);
  }
  return { ...emptyLearner(today), skills };
}

// ------------------------------------------------------------- state size ----

/**
 * The budget, as the document states it, in code so the arithmetic is checkable.
 *
 * An earlier draft of ADAPTIVE_LEARNING.md budgeted a 2,000-event ring and 730
 * daily rollups, which totals ~116 KiB — it busted its own acceptance bound. The
 * table below is the corrected one and `learner.test.ts` asserts that it sums to
 * `BUDGET_TOTAL_BYTES` and that `BUDGET_TOTAL_BYTES` is under the gate.
 */
export const BUDGET: readonly { readonly what: string; readonly bytes: number; readonly count: number }[] = [
  { what: "SkillState", bytes: 24, count: 160 },
  { what: "FactCard", bytes: 20, count: 180 },
  { what: "BugState", bytes: 12, count: MAX_TRACKED_BUGS },
  { what: "LearnerState", bytes: 1024, count: 1 },
  { what: "SessionRollup", bytes: 64, count: MAX_ROLLUPS },
  { what: "Event ring", bytes: 32, count: MAX_EVENTS },
];

export const BUDGET_TOTAL_BYTES = BUDGET.reduce((total, row) => total + row.bytes * row.count, 0);

/** Gate EG-3 / acceptance `A-15`. */
export const STATE_LIMIT_BYTES = 100_000;

// ------------------------------------------------------------------ codec ----

const MAGIC = "dw1";
/**
 * The one character an id can never contain, written as an escape so it is
 * visible in source. A space or a comma would work until the day an id contains
 * one, and the failure would be a state file that decodes into somebody else's
 * skill rather than an error.
 */
const SEPARATOR = "\u0000";

/**
 * Encode to a string.
 *
 * Fields are written as base-36 integers separated by a single character. That is
 * not the densest possible encoding — a packed byte buffer would be about 40%
 * smaller — and it is chosen anyway, because the alternative is a base64 layer on
 * top of a hand-rolled binary writer, which is two places for an endianness bug
 * to hide in a format that has to survive a schema change on a child's device.
 *
 * The measured size is what the gate reads, and it is well under the bound with
 * this encoding, so the density is not worth the risk. `learner.test.ts` prints
 * the real number rather than trusting this paragraph.
 */
export function encodeLearner(state: LearnerState): string {
  const ids: string[] = [];
  const index = new Map<string, number>();
  const idOf = (value: string): number => {
    const existing = index.get(value);
    if (existing !== undefined) return existing;
    // The separator is the one character an id may not contain. Curriculum ids
    // are dotted lower-case and fact keys are built from them, so this cannot
    // fire today — and if a future id ever does contain a space, a thrown error
    // is a failing test rather than a state file that decodes into somebody
    // else's skill.
    if (value.includes(SEPARATOR)) throw new RangeError(`encodeLearner: id contains a separator: ${value}`);
    const next = ids.length;
    ids.push(value);
    index.set(value, next);
    return next;
  };

  const out: string[] = [MAGIC, n(state.pTarget), n(state.today), n(state.answered)];

  const skills = Object.entries(state.skills);
  out.push(n(skills.length));
  for (const [id, skill] of skills) {
    out.push(
      n(idOf(id)),
      n(skill.theta),
      n(skill.phi),
      n(skill.attempts),
      n(skill.correct),
      n(skill.consecutiveFailures),
      LEVEL_CODE[skill.level],
      skill.freeEntryEvidence ? "1" : "0",
      n(skill.lastSeenDay),
      n(skill.lastFailureDay),
      n(skill.masteredSinceDay),
    );
  }

  const bugs = Object.entries(state.bugs);
  out.push(n(bugs.length));
  for (const [key, bug] of bugs) out.push(n(idOf(key)), n(bug.beta), n(bug.firings));

  const facts = Object.entries(state.facts);
  out.push(n(facts.length));
  for (const [key, card] of facts) {
    out.push(n(idOf(key)), n(card.stability), n(card.difficulty), n(card.dueDay), n(card.reps), n(card.lapses));
  }

  out.push(n(state.latency.meanS), n(state.latency.varianceS2), n(state.latency.count));

  out.push(n(state.recent.length));
  for (const id of state.recent) out.push(n(idOf(id)));

  out.push(n(state.rollups.length));
  for (const day of state.rollups) {
    out.push(n(day.day), n(day.served), n(day.correct), n(day.minutes), n(day.seconds), n(day.fatiguedCards));
  }

  out.push(n(state.events.length));
  for (const event of state.events) {
    out.push(
      n(event.day),
      n(idOf(event.skillId)),
      n(event.level),
      n(idOf(event.pool)),
      n(event.pHat),
      event.correct ? "1" : "0",
      n(event.latencyMs),
    );
  }

  return [ids.length.toString(36), ...ids, ...out].join(SEPARATOR);
}

const LEVEL_CODE: Record<SkillState["level"], string> = {
  new: "n",
  practiced: "p",
  mastered: "m",
  retired: "r",
};
const CODE_LEVEL: Record<string, SkillState["level"]> = { n: "new", p: "practiced", m: "mastered", r: "retired" };

function n(value: number): string {
  return value < 0 ? `-${(-value).toString(36)}` : value.toString(36);
}

/**
 * Decode. Returns `null` on anything it does not recognise rather than throwing:
 * a corrupt or older state file is a child who loses their progress, and the
 * correct response is a fresh cold start, not a crash on launch.
 */
export function decodeLearner(text: string): LearnerState | null {
  const parts = text.split(SEPARATOR);
  let cursor = 0;
  const next = (): string => parts[cursor++] ?? "";
  const num = (): number => {
    const raw = next();
    const negative = raw.startsWith("-");
    const value = Number.parseInt(negative ? raw.slice(1) : raw, 36);
    if (!Number.isFinite(value)) throw new RangeError("decodeLearner: not a number");
    return negative ? -value : value;
  };

  try {
    const idCount = Number.parseInt(next(), 36);
    if (!Number.isSafeInteger(idCount) || idCount < 0) return null;
    const ids: string[] = [];
    for (let i = 0; i < idCount; i++) ids.push(next());
    const idAt = (i: number): string => {
      const value = ids[i];
      if (value === undefined) throw new RangeError("decodeLearner: id out of range");
      return value;
    };
    if (next() !== MAGIC) return null;

    const pTarget = num() as Fix;
    const today = num();
    const answered = num();

    const skills: Record<SkillId, SkillState> = {};
    const skillCount = num();
    for (let i = 0; i < skillCount; i++) {
      // Read in the order `encodeLearner` writes. An object literal evaluates its
      // properties in source order, but the level code sits in the middle of the
      // record and is not a number, so it is pulled out explicitly rather than
      // relying on where it happens to appear in a literal.
      const id = idAt(num());
      const theta = num() as Fix;
      const phi = num() as Fix;
      const attempts = num();
      const correct = num();
      const consecutiveFailures = num();
      const level = CODE_LEVEL[next()];
      if (level === undefined) return null;
      const freeEntryEvidence = next() === "1";
      skills[id] = {
        theta,
        phi,
        attempts,
        correct,
        consecutiveFailures,
        level,
        freeEntryEvidence,
        lastSeenDay: num(),
        lastFailureDay: num(),
        masteredSinceDay: num(),
      };
    }

    const bugs: Record<string, { beta: Fix; firings: number }> = {};
    const bugCount = num();
    for (let i = 0; i < bugCount; i++) {
      const key = idAt(num());
      bugs[key] = { beta: num() as Fix, firings: num() };
    }

    const facts: LearnerState["facts"] = {};
    const factCount = num();
    const factRecords = facts as Record<string, LearnerState["facts"][string]>;
    for (let i = 0; i < factCount; i++) {
      const key = idAt(num());
      factRecords[key] = {
        stability: num() as Fix,
        difficulty: num() as Fix,
        dueDay: num(),
        reps: num(),
        lapses: num(),
      };
    }

    const latency = { meanS: num() as Fix, varianceS2: num() as Fix, count: num() };

    const recent: SkillId[] = [];
    const recentCount = num();
    for (let i = 0; i < recentCount; i++) recent.push(idAt(num()));

    const rollups: LearnerState["rollups"] = [];
    const rollupCount = num();
    const rollupList = rollups as { day: number; served: number; correct: number; minutes: number; seconds: number; fatiguedCards: number }[];
    for (let i = 0; i < rollupCount; i++) {
      rollupList.push({
        day: num(),
        served: num(),
        correct: num(),
        minutes: num(),
        seconds: num(),
        fatiguedCards: num(),
      });
    }

    const events: LearnerState["events"] = [];
    const eventList = events as { day: number; skillId: string; level: number; pool: string; pHat: Fix; correct: boolean; latencyMs: number }[];
    const eventCount = num();
    for (let i = 0; i < eventCount; i++) {
      const day = num();
      const skillId = idAt(num());
      const level = num();
      const pool = idAt(num());
      const pHat = num() as Fix;
      const correct = next() === "1";
      eventList.push({ day, skillId, level, pool, pHat, correct, latencyMs: num() });
    }

    return { pTarget, skills, bugs, facts, latency, today, answered, recent, rollups, events };
  } catch {
    return null;
  }
}

/**
 * The size a learner actually occupies, in bytes of UTF-8.
 *
 * Measured on the encoded form, because that is what is written to the device.
 * An estimate from the type's field widths is what the budget table is; this is
 * the number the gate reads.
 */
export function stateSizeBytes(state: LearnerState): number {
  const text = encodeLearner(state);
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.codePointAt(i) ?? 0;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    if (code >= 0x10000) i++;
  }
  return bytes;
}

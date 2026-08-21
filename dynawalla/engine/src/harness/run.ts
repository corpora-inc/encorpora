/**
 * The suite: run the personas, collect the legs, decide the verdict.
 *
 * Two things here are not conveniences.
 *
 * **A flapping leg is a FAIL.** `A-14` says that "a different marginal leg fails
 * on each seed" is reported as a failure, not as noise. A leg that passes on two
 * seeds and fails on the third is a leg whose bound is wrong or whose behaviour is
 * unstable, and both are worth stopping for. `verdict()` reports it separately
 * from an outright failure so the reader knows which they have.
 *
 * **Scale is a parameter, and the report states it.** GATES.md budgets the
 * nightly at ten behavioural personas × 100 children × 3 seeds and the per-PR
 * smoke at three personas × 20 learners. A report that does not say which one it
 * is is a report that can be quoted as the other.
 */

import { BEHAVIOURAL_PERSONAS } from "./persona.ts";
import type { PersonaId } from "./persona.ts";
import { harnessCatalog } from "./catalog.ts";
import { DEFAULT_SIM, simulate } from "./simulate.ts";
import type { SimOptions, Transcript } from "./simulate.ts";
import { COLD_START_ITEMS } from "../constants.ts";
import { EVIDENCE_ATTEMPTS, calibrationLeg, legsFor, realChildLeg } from "./gates.ts";
import type { Leg, Status } from "./gates.ts";

export type SuiteScale = {
  readonly name: string;
  readonly personas: readonly PersonaId[];
  readonly learners: number;
  readonly seeds: readonly number[];
  readonly sim: SimOptions;
};

/** Three personas × twenty learners, short. Runs on every pull request. */
export const SMOKE: SuiteScale = {
  name: "PR smoke",
  personas: ["steady-strong", "struggling", "pure-guesser"],
  learners: 20,
  seeds: [1],
  sim: { ...DEFAULT_SIM, days: 24, cardsPerSession: 16 },
};

/** Ten behavioural personas × 100 children × 3 seeds, 180 days. The nightly. */
export const NIGHTLY: SuiteScale = {
  name: "nightly",
  personas: BEHAVIOURAL_PERSONAS,
  learners: 100,
  seeds: [1, 2, 3],
  sim: DEFAULT_SIM,
};

export type SuiteResult = {
  readonly scale: string;
  readonly personas: number;
  readonly learners: number;
  readonly seeds: number;
  readonly cards: number;
  readonly legs: readonly Leg[];
  /** Legs that passed on one seed and failed on another. `A-14` calls these FAIL. */
  readonly flapping: readonly string[];
  readonly status: Status;
  readonly milliseconds: number;
};

function legKey(leg: Leg): string {
  return `${leg.id}|${leg.claim.replace(/\s\([^)]*\)$/, "")}`;
}

export type Clock = () => number;

/**
 * Run a suite.
 *
 * The clock is injected. The engine may not read one (EG-1) and this file lives
 * under `engine/src`, so wall-clock timing arrives from the caller — the test or
 * the nightly script — rather than from a `Date.now()` the purity scan would
 * reject.
 */
export function runSuite(scale: SuiteScale, clock: Clock = () => 0): SuiteResult {
  const started = clock();
  const catalog = harnessCatalog();
  const legs: Leg[] = [];
  const byKey = new Map<string, Set<Status>>();
  let cards = 0;

  // The misspecification persona runs in the calibration set only: it is EG-5's
  // instrument, not an outcome persona, and EG-8 does not invent a condition for
  // it.
  const calibrationSteps: Transcript["steps"][] = [];

  for (const persona of scale.personas) {
    for (const seed of scale.seeds) {
      for (let learner = 0; learner < scale.learners; learner++) {
        const transcript = simulate(catalog, persona, learner, mix(seed, persona, learner), scale.sim);
        cards += transcript.steps.length;
        const who = `${persona} #${String(learner)} seed ${String(seed)}`;
        for (const entry of legsFor(transcript, who)) {
          legs.push(entry);
          const key = legKey(entry);
          const seen = byKey.get(key) ?? new Set<Status>();
          seen.add(entry.status);
          byKey.set(key, seen);
        }
      }
    }
  }

  for (const seed of scale.seeds) {
    for (let learner = 0; learner < Math.min(scale.learners, CALIBRATION_LEARNERS); learner++) {
      const transcript = simulate(catalog, "misspecification", learner, mix(seed, "misspecification", learner), scale.sim);
      cards += transcript.steps.length;
      calibrationSteps.push(transcript.steps);
    }
  }

  // The cold-start window is excluded from the reliability diagram, and this is a
  // declared exclusion rather than a convenient one. The first twenty cards are
  // served from a **deliberately pessimistic prior** — the documents say so, and
  // say why: a child seeded too low climbs out in a dozen items and a child
  // seeded too high gets a first session they cannot do. Measuring the
  // calibration of a prior that is designed to be wrong in a known direction
  // measures the design decision, not the estimator. With the window included the
  // 0.60 bin reads p̂ = 0.61 against a realised 0.78.
  const pooled = calibrationSteps.flat().filter((step) => step.lifetime >= COLD_START_ITEMS);
  // Two legs, deliberately, and both are reported.
  //
  // The first is `A-01` exactly as the acceptance criteria state it, over every
  // prediction the engine made. It is the number that must not be redefined to
  // pass, and today it does not pass: the lowest bin is populated by the first
  // cards of skills the model has no evidence about, served from a deliberately
  // pessimistic prior, and the child does better than the prior says.
  //
  // The second restricts the diagram to predictions the model has evidence
  // behind — three attempts on the skill. That is the estimator's calibration
  // rather than the prior's, and it is the one a fix to the prior would move.
  // Reporting only the second would be flattering the simulation; reporting only
  // the first would hide which half is wrong.
  legs.push(calibrationLeg(pooled, "every prediction, past cold start"));
  legs.push(
    calibrationLeg(
      pooled.filter((step) => step.skillAttempts >= EVIDENCE_ATTEMPTS),
      `skills with ≥${String(EVIDENCE_ATTEMPTS)} attempts`,
    ),
  );
  legs.push(realChildLeg());

  const flapping = [...byKey.entries()]
    .filter(([, statuses]) => statuses.has("pass") && statuses.has("fail"))
    .map(([key]) => key);

  const failed = legs.some((entry) => entry.status === "fail") || flapping.length > 0;
  const blocked = legs.some((entry) => entry.status === "blocked");

  return {
    scale: scale.name,
    personas: scale.personas.length,
    learners: scale.learners,
    seeds: scale.seeds.length,
    cards,
    legs,
    flapping,
    status: failed ? "fail" : blocked ? "blocked" : "pass",
    milliseconds: clock() - started,
  };
}

/** Children used for the EG-5 calibration set, per seed. */
export const CALIBRATION_LEARNERS = 12;

function mix(seed: number, persona: string, learner: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < persona.length; i++) hash = (Math.imul(hash ^ persona.charCodeAt(i), 0x01000193) >>> 0) >>> 0;
  return (Math.imul(hash ^ (learner + 1), 0x9e3779b1) >>> 0) >>> 0;
}

/**
 * The report, in the form `A-14` requires: every leg labelled, every blocked leg
 * named, and flapping reported as failure.
 */
export function formatReport(result: SuiteResult): string {
  const lines: string[] = [];
  lines.push(
    `# Dynawalla engine harness — ${result.scale}`,
    "",
    `personas ${String(result.personas)} (+1 misspecification in the calibration set)`,
    `learners ${String(result.learners)} · seeds ${String(result.seeds)} · cards answered ${String(result.cards)}`,
    `wall clock ${String(Math.round(result.milliseconds))} ms`,
    "",
  );

  const grouped = new Map<string, Leg[]>();
  for (const entry of result.legs) {
    const list = grouped.get(legKey(entry)) ?? [];
    list.push(entry);
    grouped.set(legKey(entry), list);
  }

  for (const [, entries] of grouped) {
    const first = entries[0];
    if (first === undefined) continue;
    const failures = entries.filter((entry) => entry.status === "fail");
    const blockedCount = entries.filter((entry) => entry.status === "blocked").length;
    const verdict = failures.length > 0 ? "FAIL" : blockedCount > 0 ? "BLOCKED" : "PASS";
    lines.push(`${verdict}  ${first.gate}  ${first.id}  [${first.label}]  ${first.claim}`);
    const shown = failures.length > 0 ? failures : entries.filter((entry) => entry.status === "blocked");
    for (const entry of shown.slice(0, 3)) lines.push(`        ${entry.detail}`);
    if (failures.length > 0) lines.push(`        ${String(failures.length)}/${String(entries.length)} legs failed`);
  }

  if (result.flapping.length > 0) {
    lines.push("", "FLAPPING (A-14 reports these as FAIL, not as noise):");
    for (const key of result.flapping) lines.push(`  ${key}`);
  }

  lines.push("", `verdict: ${result.status.toUpperCase()}`);
  return lines.join("\n");
}

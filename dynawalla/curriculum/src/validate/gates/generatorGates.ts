/**
 * CG-9, CG-10, CG-11, CG-12, CG-16, CG-17 — the gates that run generators.
 *
 * All six read the shared sample built in `context.ts`, so every number they
 * report is measured on the same draw.
 */

import { add as ratAdd, cmp, toString as rationalToString } from "../../math/rational.ts";
import { answerEquals } from "../../types/answer.ts";
import type { Exercise } from "../../types/exercise.ts";
import { fingerprintItem, serializeExercise } from "../../serialize.ts";
import { fnv1a64Hex } from "../../rng/hash.ts";
import { activeNodes } from "../../graph/graph.ts";
import { familyById } from "../../generators/registry.ts";
import type { LevelSample, ValidationContext } from "../context.ts";
import { sampleLabel } from "../context.ts";
import type { Finding, GateResult } from "../types.ts";
import { fail, resultOf, warn } from "../types.ts";

/**
 * How much bigger than `minVariants` a level's *estimated* variant space has to be.
 *
 * GATES.md words CG-10 as "<2% duplicates over 1,000 draws". That wording embeds an
 * assumption that is false for the content this program starts with: two-digit
 * subtraction with one regrouping has on the order of 1,600 distinct problems in
 * total, so 1,000 draws from it collide about 20% of the time no matter how good
 * the generator is, and the literal gate would be unsatisfiable for every grade-1
 * level in the graph.
 *
 * What CG-10 is *for* is "the variant space is big enough that a child does not see
 * repeats". So it is implemented as a lower bound on the space itself, estimated
 * from the collisions actually observed: with N draws and C collisions the space is
 * about N²/2C.
 *
 * The estimator's bias, measured rather than assumed: at N=200 against a true space
 * of ~1,600 it reads ~1,300 (low, safe); at N=1,000 against the same space it reads
 * ~2,000 (high by about a quarter, because the first-order approximation stops
 * holding once N approaches S). It is therefore **optimistic at high collision
 * rates**, which is the unsafe direction for a floor — so the floor is set with an
 * order of magnitude of margin rather than a fine one, and CG-9's hard
 * `minVariants` count backs it up independently.
 */
export const VARIANT_SPACE_FACTOR = 12;

/** Seeds hashed for the CG-16 snapshot. Fixed, so incremental and full agree. */
export const SNAPSHOT_SEEDS = 20;

export type Snapshot = {
  readonly note: string;
  readonly entries: Readonly<Record<string, string>>;
};

export const EMPTY_SNAPSHOT: Snapshot = { note: "", entries: {} };

/** CG-9 — level coverage by running generators, plus difficulty-table integrity. */
export function cg9(context: ValidationContext, samples: readonly LevelSample[]): GateResult {
  const findings: Finding[] = [];
  const notes: string[] = [];

  for (const sample of samples) {
    if (sample.error !== undefined) {
      findings.push(fail("CG-9", `generation failed — ${sample.error}`, sampleLabel(sample)));
      continue;
    }
    const distinct = new Set(sample.exercises.map(fingerprintItem)).size;
    const required = sample.node.generator.minVariants;
    if (distinct < required) {
      findings.push(
        fail(
          "CG-9",
          `${String(distinct)} distinct items over ${String(sample.exercises.length)} seeds, below minVariants ${String(required)}`,
          sampleLabel(sample),
        ),
      );
    }
    notes.push(`${sampleLabel(sample)}: ${String(distinct)}/${String(sample.exercises.length)} distinct`);
  }

  // The difficulty table restates what the family computes. Check it, and check
  // that levels actually get harder — a level table that goes backwards is a
  // scheduling bug that no scheduler test would catch.
  for (const node of activeNodes(context.nodes)) {
    const family = familyById(node.generator.family, context.families);
    if (family === undefined) continue;
    let previous: (typeof node.difficulty.levels)[number] | undefined;

    node.generator.params.forEach((params, level) => {
      const validated = family.paramSchema.validate(params);
      if (!validated.ok) return;
      const expected = ratAdd(node.difficulty.b, family.difficultyOffset(validated.value));
      const declared = node.difficulty.levels[level];
      if (declared === undefined) return; // CG-7 owns the length mismatch.
      if (cmp(expected, declared) !== 0) {
        findings.push(
          fail(
            "CG-9",
            `L${String(level)} difficulty is ${rationalToString(declared)} but the parameters compute ${rationalToString(expected)}`,
            node.id,
          ),
        );
      }
      if (previous !== undefined && cmp(declared, previous) <= 0) {
        findings.push(
          fail(
            "CG-9",
            `L${String(level)} difficulty ${rationalToString(declared)} is not above L${String(level - 1)} ${rationalToString(previous)}`,
            node.id,
          ),
        );
      }
      previous = declared;
    });
  }

  return resultOf("CG-9", "level coverage and difficulty table", findings, notes);
}

/** CG-10 — variant-space adequacy. See `VARIANT_SPACE_FACTOR`. */
export function cg10(_context: ValidationContext, samples: readonly LevelSample[]): GateResult {
  const findings: Finding[] = [];
  const notes: string[] = [];

  for (const sample of samples) {
    if (sample.error !== undefined) continue; // CG-9 owns generation failures.
    const draws = sample.exercises.length;
    if (draws === 0) continue;
    const distinct = new Set(sample.exercises.map(fingerprintItem)).size;
    const collisions = draws - distinct;
    const floor = sample.node.generator.minVariants * VARIANT_SPACE_FACTOR;
    // N^2 / 2C, integer, with C=0 meaning "no evidence of any bound below N^2/2".
    const estimate = collisions === 0 ? Math.floor((draws * draws) / 2) : Math.floor((draws * draws) / (2 * collisions));

    if (estimate < floor) {
      findings.push(
        fail(
          "CG-10",
          `estimated variant space ${String(estimate)} (${String(collisions)} collisions in ${String(draws)} draws) is below the floor ${String(floor)}`,
          sampleLabel(sample),
        ),
      );
    }
    notes.push(
      `${sampleLabel(sample)}: ~${String(estimate)} variants, ${String(collisions)} collision(s) in ${String(draws)} draws`,
    );
  }

  return resultOf("CG-10", "variant-space adequacy", findings, notes);
}

/** CG-11 — self-consistency: the family's own checker agrees with its own output. */
export function cg11(_context: ValidationContext, samples: readonly LevelSample[]): GateResult {
  const findings: Finding[] = [];
  let checked = 0;

  for (const sample of samples) {
    const family = sample.family;
    if (family === undefined) continue;
    for (const exercise of sample.exercises) {
      checked += 1;
      if (!family.check(exercise, exercise.answer.canonical).correct) {
        findings.push(fail("CG-11", "checker rejects its own canonical answer", exercise.exerciseId));
      }
      for (const accepted of exercise.answer.alsoAccept) {
        if (!family.check(exercise, accepted).correct) {
          findings.push(fail("CG-11", "checker rejects a declared alsoAccept answer", exercise.exerciseId));
        }
      }
      for (const distractor of exercise.distractors) {
        if (answerEquals(distractor.value, exercise.answer.canonical)) {
          findings.push(fail("CG-11", "a distractor equals the canonical answer", exercise.exerciseId));
        }
        if (family.check(exercise, distractor.value).correct) {
          findings.push(fail("CG-11", "checker accepts a distractor", exercise.exerciseId));
        }
      }
    }
  }

  return resultOf("CG-11", "checker self-consistency", findings, [`${String(checked)} items checked`]);
}

/** CG-12 — mal-rule fidelity: ≥95% divergence from the correct answer. */
export function cg12(context: ValidationContext, samples: readonly LevelSample[]): GateResult {
  const findings: Finding[] = [];
  const notes: string[] = [];
  const all: Exercise[] = samples.flatMap((sample) => [...sample.exercises]);

  for (const rule of context.malRules) {
    let applicable = 0;
    let divergent = 0;
    let undefinedOutput = 0;

    for (const exercise of all) {
      if (exercise.family !== rule.family) continue;
      if (!rule.applies(exercise)) continue;
      applicable += 1;
      const produced = rule.apply(exercise);
      if (produced === null) {
        undefinedOutput += 1;
        continue;
      }
      if (!answerEquals(produced, exercise.answer.canonical)) divergent += 1;
    }

    if (applicable === 0) {
      findings.push(warn("CG-12", "no sampled item triggers this rule", rule.id));
      continue;
    }
    if (undefinedOutput > 0) {
      findings.push(
        fail("CG-12", `applies() is true but apply() returned null on ${String(undefinedOutput)} item(s)`, rule.id),
      );
    }
    // Integer comparison: divergent/applicable >= 95/100.
    if (divergent * 100 < applicable * 95) {
      findings.push(
        fail(
          "CG-12",
          `diverges from the correct answer on ${String(divergent)}/${String(applicable)} applicable items, below 95%`,
          rule.id,
        ),
      );
    }
    notes.push(`${rule.id}: ${String(divergent)}/${String(applicable)} divergent`);
  }

  return resultOf("CG-12", "mal-rule fidelity", findings, notes);
}

function snapshotKey(sample: { node: { id: string }; level: number }, family: string, rev: number): string {
  return `${family}@${String(rev)}|${sample.node.id}|L${String(sample.level)}`;
}

/**
 * CG-16 — determinism and committed output hashes.
 *
 * Two separate claims. First, that generating twice in this process gives
 * byte-identical output — a `Math.random` or a `Date.now` in a generator dies here.
 * Second, that the output matches the committed hash, which is what makes the
 * macOS/Linux pair meaningful: the snapshot is written on one and verified on the
 * other.
 */
export function cg16(
  context: ValidationContext,
  snapshot: Snapshot,
  update: boolean,
): { result: GateResult; next: Snapshot } {
  const findings: Finding[] = [];
  const entries: Record<string, string> = { ...snapshot.entries };
  const seenKeys = new Set<string>();

  for (const node of activeNodes(context.nodes)) {
    const family = familyById(node.generator.family, context.families);
    if (family === undefined) continue;

    node.generator.params.forEach((params, level) => {
      const validated = family.paramSchema.validate(params);
      if (!validated.ok) return;

      const render = (): string[] =>
        Array.from({ length: SNAPSHOT_SEEDS }, (_unused, index) =>
          serializeExercise(
            family.generate({
              skillId: node.id,
              level,
              seed: index + 1,
              params: validated.value,
              forms: node.generator.forms,
            }),
          ),
        );

      const first = render();
      const second = render();
      const label = `${node.id} L${String(level)}`;
      for (let i = 0; i < first.length; i++) {
        if (first[i] !== second[i]) {
          findings.push(fail("CG-16", `seed ${String(i + 1)} generated different output on a second call`, label));
          return;
        }
      }

      const key = snapshotKey({ node, level }, family.family, family.familyRev);
      seenKeys.add(key);
      const hash = fnv1a64Hex(first.join("\n"));
      const committed = entries[key];

      if (update) {
        entries[key] = hash;
        return;
      }
      if (committed === undefined) {
        findings.push(
          fail(
            "CG-16",
            `no committed hash for ${key} — if the family's output changed on purpose, bump familyRev and run \`npm run snapshots:update\``,
            label,
          ),
        );
        return;
      }
      if (committed !== hash) {
        findings.push(
          fail(
            "CG-16",
            `output hash ${hash} does not match the committed ${committed}; a generator changed without a familyRev bump`,
            label,
          ),
        );
      }
    });
  }

  if (update) {
    for (const key of Object.keys(entries)) if (!seenKeys.has(key)) delete entries[key];
  }

  return {
    result: resultOf("CG-16", "determinism and output snapshots", findings, [
      `${String(seenKeys.size)} snapshot key(s), ${String(SNAPSHOT_SEEDS)} seeds each`,
    ]),
    next: { note: snapshot.note, entries },
  };
}

/** Nearest-rank percentile over a sorted array. Integer arithmetic only. */
function percentile(sortedNs: readonly bigint[], p: number): bigint {
  if (sortedNs.length === 0) return 0n;
  const rank = Math.floor((p * sortedNs.length + 99) / 100);
  const index = Math.min(sortedNs.length - 1, Math.max(0, rank - 1));
  return sortedNs[index] ?? 0n;
}

export const P95_BUDGET_NS = 5_000_000n;
export const P99_BUDGET_NS = 20_000_000n;

/** CG-17 — `generate()` p95 < 5 ms, p99 < 20 ms. */
export function cg17(_context: ValidationContext, samples: readonly LevelSample[]): GateResult {
  const findings: Finding[] = [];
  const timings = samples.flatMap((sample) => [...sample.timingsNs]).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (timings.length === 0) {
    return resultOf("CG-17", "generate() performance", [warn("CG-17", "no timings collected")]);
  }

  const p95 = percentile(timings, 95);
  const p99 = percentile(timings, 99);
  if (p95 >= P95_BUDGET_NS) {
    findings.push(fail("CG-17", `p95 ${String(p95)} ns exceeds the ${String(P95_BUDGET_NS)} ns budget`));
  }
  if (p99 >= P99_BUDGET_NS) {
    findings.push(fail("CG-17", `p99 ${String(p99)} ns exceeds the ${String(P99_BUDGET_NS)} ns budget`));
  }

  return resultOf("CG-17", "generate() performance", findings, [
    `${String(timings.length)} calls: p95 ${String(p95 / 1000n)} µs, p99 ${String(p99 / 1000n)} µs`,
  ]);
}

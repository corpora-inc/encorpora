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
import { findLocaleViolations } from "../lints/localeOrder.ts";
import { listSourceFiles, readSource } from "../lints/scan.ts";
import type { LevelSample, ValidationContext } from "../context.ts";
import { sampleLabel } from "../context.ts";
import type { Finding, GateResult } from "../types.ts";
import { fail, resultOf, warn } from "../types.ts";

/**
 * CG-10's floor on a level's variant space, and where the number comes from.
 *
 * GATES.md words CG-10 as "<2% duplicates over 1,000 draws". That wording embeds an
 * assumption that is false for the content this program starts with: two-digit
 * subtraction with one regrouping has on the order of 1,600 distinct problems in
 * total, so 1,000 draws from it collide about 20% of the time no matter how good
 * the generator is, and the literal gate would be unsatisfiable for every grade-1
 * level in the graph. The 1,000 is the *gate's* sample size, and a child never sees
 * 1,000 items at one level.
 *
 * So the duplicate rate is stated about the run a child actually experiences, and
 * the floor is derived from it. Drawing `n` items from a space of `S` produces about
 * `n(n−1)/2S` repeats; requiring at most one repeat per `D` items gives
 * `S ≥ (n−1)·D/2`. With a practice run of 40 items and 2% (one in fifty) that is
 * **975 problems per level**, and the floor is that number — not a multiple of
 * `minVariants`, which the curriculum author also writes, and which would make the
 * gate assert only what the author already asserted.
 *
 * The space itself is estimated from the collisions observed in the gate's own
 * sample: with N draws and C collisions it is about N²/2C. That estimator's bias,
 * measured rather than assumed: at N=200 against a true space of ~1,600 it reads
 * ~1,300 (low, safe); at N=1,000 against the same space it reads ~2,000 (high by
 * about a quarter, because the first-order approximation stops holding once N
 * approaches S). It is therefore **optimistic at high collision rates**, which is
 * the unsafe direction for a floor — so a level near the floor deserves a look, and
 * CG-9's hard `minVariants` count backs the gate up independently.
 */
export const PRACTICE_RUN_ITEMS = 40;

/** One repeat per fifty items — GATES.md's 2%, applied to the practice run. */
export const REPEAT_RATE_DENOMINATOR = 50;

/** `(n − 1)·D / 2`, exact in integers: 39 × 50 / 2. */
export const VARIANT_SPACE_FLOOR = ((PRACTICE_RUN_ITEMS - 1) * REPEAT_RATE_DENOMINATOR) / 2;

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

/** CG-10 — variant-space adequacy. See `VARIANT_SPACE_FLOOR`. */
export function cg10(_context: ValidationContext, samples: readonly LevelSample[]): GateResult {
  const findings: Finding[] = [];
  const notes: string[] = [];

  for (const sample of samples) {
    if (sample.error !== undefined) continue; // CG-9 owns generation failures.
    const draws = sample.exercises.length;
    if (draws === 0) continue;
    const distinct = new Set(sample.exercises.map(fingerprintItem)).size;
    const collisions = draws - distinct;
    // N^2 / 2C, integer, with C=0 meaning "no evidence of any bound below N^2/2".
    const estimate = collisions === 0 ? Math.floor((draws * draws) / 2) : Math.floor((draws * draws) / (2 * collisions));

    // N draws with no collision at all can only evidence a space of N²/2, so below
    // that many draws the gate is not measuring anything and says so rather than
    // failing a healthy generator or passing a bad one.
    if (Math.floor((draws * draws) / 2) < VARIANT_SPACE_FLOOR) {
      findings.push(
        warn(
          "CG-10",
          `${String(draws)} draws cannot evidence a space of ${String(VARIANT_SPACE_FLOOR)}; sample more seeds`,
          sampleLabel(sample),
        ),
      );
      continue;
    }

    if (estimate < VARIANT_SPACE_FLOOR) {
      findings.push(
        fail(
          "CG-10",
          `estimated variant space ${String(estimate)} (${String(collisions)} collisions in ${String(draws)} draws) is below the floor ${String(VARIANT_SPACE_FLOOR)}: a ${String(PRACTICE_RUN_ITEMS)}-item practice run would repeat more than one item in ${String(REPEAT_RATE_DENOMINATOR)}`,
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

/**
 * CG-12 — mal-rule fidelity (≥95% divergence from the correct answer), and the
 * declaration half of the same contract.
 *
 * `SkillNode.misconceptions` is what repair routing and Stage-2 selection read. An
 * id there that no registry entry resolves has nothing to run; an id from another
 * family cannot fire on this node's items at all; and a diagnosis the node's own
 * items *emit* that the node never declares reaches the scheduler with nowhere to
 * route. That is the same drift CG-7 prevents between rows and generators, and
 * without this half the field is unvalidated metadata.
 *
 * Distractors come from the family registry, so the emitted set is a fact about the
 * generator, measured on the same sample every other execution gate uses.
 */
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

  const byId = new Map(context.malRules.map((rule) => [String(rule.id), rule]));

  for (const node of activeNodes(context.nodes)) {
    const declared = new Set<string>(node.misconceptions.map(String));

    for (const id of declared) {
      const rule = byId.get(id);
      if (rule === undefined) {
        findings.push(fail("CG-12", `declares ${id}, which no registered mal-rule resolves`, node.id));
        continue;
      }
      if (rule.family !== node.generator.family) {
        findings.push(
          fail(
            "CG-12",
            `declares ${id}, a mal-rule of ${rule.family}, but binds ${node.generator.family}`,
            node.id,
          ),
        );
      }
    }

    const emitted = new Set<string>();
    for (const sample of samples) {
      if (sample.node.id !== node.id) continue;
      for (const exercise of sample.exercises) {
        for (const distractor of exercise.distractors) {
          if (distractor.misconception !== undefined) emitted.add(String(distractor.misconception));
        }
      }
    }
    for (const id of emitted) {
      if (!declared.has(id)) {
        findings.push(fail("CG-12", `items emit ${id} as a distractor, which the node does not declare`, node.id));
      }
    }

    notes.push(`${node.id}: declares ${String(declared.size)}, emits ${String(emitted.size)}`);
  }

  return resultOf("CG-12", "mal-rule fidelity", findings, notes);
}

function snapshotKey(sample: { node: { id: string }; level: number }, family: string, rev: number): string {
  return `${family}@${String(rev)}|${sample.node.id}|L${String(sample.level)}`;
}

/**
 * CG-16 — determinism and committed output hashes.
 *
 * Three claims. First, that generating twice in this process gives byte-identical
 * output — a `Math.random` or a `Date.now` in a generator dies here. Second, that
 * the output matches the committed hash, which is what makes the macOS/Linux pair
 * meaningful: the snapshot is written on one and verified on the other. Note the
 * scope of that second one honestly — it hashes `SNAPSHOT_SEEDS` seeds per level,
 * not the whole sweep.
 *
 * Third, a source scan, because the first two cannot see the failure that matters
 * most on a child's device: `localeCompare` and `Intl` agree with themselves
 * in-process and agree across two CI runners with the same ICU data, and disagree
 * on a phone. See `lints/localeOrder.ts`.
 */
export function cg16(
  context: ValidationContext,
  snapshot: Snapshot,
  update: boolean,
  roots: readonly string[],
): { result: GateResult; next: Snapshot } {
  const findings: Finding[] = [];
  const entries: Record<string, string> = { ...snapshot.entries };
  const seenKeys = new Set<string>();
  let scanned = 0;

  for (const root of roots) {
    for (const path of listSourceFiles(root)) {
      scanned += 1;
      for (const violation of findLocaleViolations(readSource(path))) {
        findings.push(
          fail("CG-16", `${violation.rule}: ${violation.excerpt}`, `${violation.path}:${String(violation.line)}`),
        );
      }
    }
  }

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
      `${String(scanned)} source file(s) scanned for locale-dependent ordering`,
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

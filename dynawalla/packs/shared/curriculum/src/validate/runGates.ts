/**
 * The gate runner.
 *
 * Every gate in GATES.md appears in the output. The seventeen that are implemented
 * report `pass`, `warn` or `fail`; the five that are not report `pending` with the
 * PR that owns them. A gate table where an unimplemented gate reads as green is
 * worse than no table — this repo has an in-repo precedent for exactly that failure
 * mode.
 */

import type { LevelSample, ValidationContext } from "./context.ts";
import { buildSamples } from "./context.ts";
import { cg1, cg2, cg3, cg4, cg5, cg6 } from "./gates/graphGates.ts";
import { cg13, cg22, cg7, cg8 } from "./gates/bindingGates.ts";
import { cg10, cg11, cg12, cg16, cg17, cg9 } from "./gates/generatorGates.ts";
import type { Snapshot } from "./gates/generatorGates.ts";
import { cg19, m05 } from "./gates/lintGates.ts";
import { cg15 } from "./gates/coverageGates.ts";
import type { GateResult, Report } from "./types.ts";
import { pending } from "./types.ts";

export type RunOptions = {
  readonly context: ValidationContext;
  /** Source roots the lints scan — normally `curriculum/src` and `engine/src`. */
  readonly roots: readonly string[];
  readonly snapshot: Snapshot;
  readonly updateSnapshots: boolean;
  readonly mode: "incremental" | "full";
};

/** Gates defined in GATES.md that no PR has implemented yet, with their owner. */
const PENDING_GATES: readonly (readonly [string, string, string])[] = [
  ["CG-14", "locale round-trip", "PR-4.7 (needs the M2 number layer)"],
  ["CG-18", "representation accessibility", "PR-4.4"],
  ["CG-20", "standards traceback (report-only)", "PR-7.19"],
  ["CG-21", "word-problem context sets", "PR-7.18"],
];

export function runGates(options: RunOptions): { report: Report; snapshot: Snapshot; samples: LevelSample[] } {
  const { context, roots, snapshot, updateSnapshots, mode } = options;
  const samples = buildSamples(context);

  const snapshotRun = cg16(context, snapshot, updateSnapshots, roots);

  const results: GateResult[] = [
    cg1(context),
    cg2(context),
    cg3(context),
    cg4(context),
    cg5(context),
    cg6(context),
    cg7(context),
    cg8(context, samples),
    cg9(context, samples),
    cg10(context, samples),
    cg11(context, samples),
    cg12(context, samples),
    cg13(context),
    cg15(context),
    snapshotRun.result,
    cg17(context, samples),
    cg19(samples, roots),
    cg22(context),
    m05(roots),
    ...PENDING_GATES.map(([id, title, owner]) => pending(id, title, owner)),
  ];

  const ordered = [...results].sort((a, b) => gateOrder(a.gate) - gateOrder(b.gate));
  const generated = samples.reduce((total, sample) => total + sample.exercises.length, 0);

  return {
    report: {
      ok: ordered.every((result) => result.status !== "fail"),
      mode,
      seedsPerLevel: context.seedsPerLevel,
      results: ordered,
      stats: {
        nodes: context.nodes.length,
        activeNodes: context.nodes.filter((node) => node.status === "active").length,
        levels: samples.length,
        generatedItems: generated,
        malRules: context.malRules.length,
        families: context.families.length,
      },
    },
    snapshot: snapshotRun.next,
    samples,
  };
}

function gateOrder(gate: string): number {
  const match = /^CG-(\d+)$/.exec(gate);
  return match?.[1] === undefined ? 1000 : Number(match[1]);
}

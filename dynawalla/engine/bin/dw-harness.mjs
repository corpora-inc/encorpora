#!/usr/bin/env node
// Drive the simulation harness and print the labelled report.
//
//   node bin/dw-harness.mjs                 # the PR smoke
//   node bin/dw-harness.mjs nightly         # ten personas × 100 children × 3 seeds
//   node bin/dw-harness.mjs pilot           # ten personas × 12 children × 3 seeds
//
// This file is outside `src/`, deliberately: gate EG-1 bans a clock and a
// filesystem anywhere the engine can reach, and a harness that reports its own
// wall-clock runtime needs one. The clock is injected into `runSuite`, so the
// timed thing stays pure and the timing lives here.
//
// Exit code 1 on FAIL, 0 on PASS and on BLOCKED — a blocked leg is a check that
// does not exist yet (the M2 real-child fixture), and failing the build for it
// would mean the engine could never be green before a playtest that is not this
// program's to schedule. It is printed at the top of the report either way.

import { NIGHTLY, SMOKE, formatReport, runSuite } from "../src/harness/run.ts";
import { BEHAVIOURAL_PERSONAS } from "../src/harness/persona.ts";
import { DEFAULT_SIM } from "../src/harness/simulate.ts";

const PILOT = {
  name: "pilot",
  personas: BEHAVIOURAL_PERSONAS,
  learners: 12,
  seeds: [1, 2, 3],
  sim: DEFAULT_SIM,
};

const scales = { smoke: SMOKE, nightly: NIGHTLY, pilot: PILOT };
const which = process.argv[2] ?? "smoke";
const scale = scales[which];
if (scale === undefined) {
  console.error(`unknown scale ${which}; expected one of ${Object.keys(scales).join(", ")}`);
  process.exit(2);
}

const result = runSuite(scale, () => performance.now());
console.log(formatReport(result));
process.exit(result.status === "fail" ? 1 : 0);

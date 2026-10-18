import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { simulateFrontier, simulationCatalog } from "./frontier/simulation";
import {
  developmentPopulations,
  evaluationPopulations,
  stressPopulations,
} from "./frontier/synthetic-learner";
import type { estimateFrontier } from "../src/learning/frontier";
import type { planMixedPractice } from "../src/server/mixed-practice";

// Compare policy versions with identical current catalog, learners, and seeds.
// A local Git checkout containing the baseline commit is required.
const baselineCommit = process.argv[2] ?? "86dfa922c";
const partition = process.argv[3] ?? "evaluation";
if (!/^[a-f0-9]{7,40}$/.test(baselineCommit))
  throw new Error("Supply a hexadecimal baseline commit");
if (!["development", "evaluation", "audit", "stress"].includes(partition))
  throw new Error("Use development, evaluation, audit, or stress");
const root = fileURLToPath(new URL("..", import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), "amp-frontier-baseline-"));
try {
  for (const path of [
    "src/server/mixed-practice.ts",
    "src/server/evidence.ts",
    "src/learning/frontier.ts",
  ]) {
    const source = execFileSync(
      "git",
      ["-C", root, "show", `${baselineCommit}:amp/${path}`],
      { encoding: "utf8", maxBuffer: 1_000_000 },
    );
    await mkdir(join(scratch, path, ".."), { recursive: true });
    await writeFile(join(scratch, path), source);
  }
  const estimator = await import(
    pathToFileURL(join(scratch, "src/learning/frontier.ts")).href
  );
  const planner = await import(
    pathToFileURL(join(scratch, "src/server/mixed-practice.ts")).href
  );
  const populations =
    partition === "development"
      ? developmentPopulations
      : partition === "stress"
        ? stressPopulations
        : evaluationPopulations;
  const seeds =
    partition === "development"
      ? [11, 29]
      : partition === "audit"
        ? [607, 991]
        : partition === "stress"
          ? [4001, 5003]
          : [101, 307];
  const baseline = populations.flatMap((p) =>
    seeds.map((s) =>
      simulateFrontier(p, s, 180, {
        estimate: estimator.estimateFrontier as typeof estimateFrontier,
        plan: planner.planMixedPractice as typeof planMixedPractice,
        calibrated: false,
      }),
    ),
  );
  const current = populations.flatMap((p) =>
    seeds.map((s) => simulateFrontier(p, s)),
  );
  console.log(
    JSON.stringify(
      {
        baselineCommit,
        catalog: simulationCatalog,
        partition,
        baseline,
        current,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(scratch, { recursive: true });
}

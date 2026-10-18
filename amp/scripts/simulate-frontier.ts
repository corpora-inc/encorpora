import { performance } from "node:perf_hooks";
import { simulateFrontier, simulationCatalog } from "./frontier/simulation";
import {
  developmentPopulations,
  evaluationPopulations,
  stressPopulations,
} from "./frontier/synthetic-learner";
const partition = process.argv[2] ?? "evaluation";
if (!["development", "evaluation", "audit", "stress"].includes(partition))
  throw new Error("Use development, evaluation, audit, or stress");
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
const started = performance.now();
const runs = populations.flatMap((population) =>
  seeds.map((seed) => simulateFrontier(population, seed)),
);
console.log(
  JSON.stringify(
    {
      model: "editorial-v1",
      catalog: simulationCatalog,
      partition,
      disclaimer:
        "Synthetic regression scenarios, not evidence of learning efficacy or real learner calibration.",
      runs,
      elapsedMs: Math.round(performance.now() - started),
    },
    null,
    2,
  ),
);

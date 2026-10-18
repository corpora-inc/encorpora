import { performance } from "node:perf_hooks";
import { simulateFrontier } from "./frontier/simulation";
import {
  developmentPopulations,
  evaluationPopulations,
} from "./frontier/synthetic-learner";
const partition = process.argv[2] ?? "evaluation";
if (!["development", "evaluation", "audit"].includes(partition))
  throw new Error("Use development, evaluation, or audit");
const populations =
  partition === "development" ? developmentPopulations : evaluationPopulations;
const seeds =
  partition === "development"
    ? [11, 29]
    : partition === "audit"
      ? [607, 991]
      : [101, 307];
const started = performance.now();
const runs = populations.flatMap((population) =>
  seeds.map((seed) => simulateFrontier(population, seed)),
);
console.log(
  JSON.stringify(
    {
      model: "editorial-v1",
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

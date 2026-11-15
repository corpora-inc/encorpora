import { estimateFrontier, strandEstimate } from "../../../amp/src/learning/frontier.js";
import { reportEstimate } from "../../../amp/src/learning/frontier-report.js";

// A reproducible synthetic example, computed by the shipped estimator at build
// time. It is explanatory model output, never a learner outcome or confidence rate.
const start = Date.parse("2026-11-15T12:00:00Z");
export const estimateExample = [0, 6, 24].map(count => {
  const observations = Array.from({length: count}, (_, i) => ({
    templateId: `illustration-${i % 3}`,
    correct: i % 4 !== 3,
    assisted: false,
    createdAt: new Date(start + i * 60000).toISOString(),
  }));
  const frontier = estimateFrontier({start: 3, observations, now: start + Math.max(0, count - 1) * 60000,
    gradeOf: () => 3, strandOf: () => "fractions", guessOf: () => 0});
  return {count, ...reportEstimate(strandEstimate(frontier, "fractions"))};
});

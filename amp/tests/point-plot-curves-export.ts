/** Exports public payloads (plus hint and answer) for scripts/point_plot_curves_review.py. */
import { generateProblem } from "../src/math/engine.js";
const ids = [
  "graph-quadratic-points",
  "graph-absolute-value-points",
  "graph-exponential-points",
  "graph-sqrt-points",
];
const n = Number(process.argv[2] ?? 300);
const out = ids.flatMap((id) =>
  Array.from({ length: n }, (_, i) => {
    const p = generateProblem(id, `curve-review-${i}`);
    return {
      id,
      seed: `curve-review-${i}`,
      public: p.public,
      hint: p.hint,
      answer: p.answer,
    };
  }),
);
process.stdout.write(JSON.stringify(out));

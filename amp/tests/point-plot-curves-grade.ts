/** Black-box server grading of candidate responses for point_plot_curves_review.py (jobs on stdin). */
import { readFileSync } from "node:fs";
import { generateProblem, gradeAnswer } from "../src/math/engine.js";
const jobs = JSON.parse(readFileSync(0, "utf8")) as {
  id: string;
  seed: string;
  response: string;
}[];
process.stdout.write(
  JSON.stringify(
    jobs.map((j) => gradeAnswer(generateProblem(j.id, j.seed), j.response)),
  ),
);

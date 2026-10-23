import {
  buildSatCoverage,
  renderSatCoverage,
} from "../src/curriculum/sat-coverage";
const format = process.argv[2] ?? "markdown";
if (process.argv.length > 3 || !["json", "markdown"].includes(format))
  throw new Error("Usage: npm run coverage:sat -- [json|markdown]");
const report = buildSatCoverage();
console.log(
  format === "json"
    ? JSON.stringify(report, null, 2)
    : renderSatCoverage(report),
);
if (!report.valid) process.exitCode = 1;

import { buildGapLedger, renderGapLedger } from "../src/curriculum/gap-ledger";
const format = process.argv[2] ?? "json";
if (process.argv.length > 3 || !["json", "markdown"].includes(format))
  throw new Error("Usage: npm run coverage:report -- [json|markdown]");
const report = buildGapLedger();
console.log(
  format === "json" ? JSON.stringify(report, null, 2) : renderGapLedger(report),
);
if (!report.valid) process.exitCode = 1;

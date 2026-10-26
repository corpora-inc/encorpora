import { buildReleasedItemLedger } from "../src/curriculum/released-items";
import { renderReleasedItemReport } from "../src/curriculum/released-items/ledger";
const format = process.argv[2] ?? "markdown";
if (process.argv.length > 3 || !["json", "markdown"].includes(format))
  throw new Error("Usage: npm run coverage:items -- [json|markdown]");
const report = buildReleasedItemLedger();
console.log(
  format === "json"
    ? JSON.stringify(report, null, 2)
    : renderReleasedItemReport(report, { items: true }),
);
if (!report.valid) process.exitCode = 1;

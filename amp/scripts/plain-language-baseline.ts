/**
 * Progress report for the plain-language rules (`src/content/AGENTS.md`).
 *
 *   npm run plain:baseline                 counts per band and the terms most
 *                                          often used before they are defined
 *   npm run plain:baseline -- --screen=id,id
 *                                          also list those screens' violations
 *                                          (lesson:<lesson id> or practice:<template id>)
 *
 * It writes artifacts/plain-language/report.json and never fails: the report
 * tracks progress. Quality comes from the standard, the judge
 * (`npm run review:plain`) and review.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  plainLanguageReport,
  plainLanguageReportTable,
} from "../src/content/plain-language-check";

const args = process.argv.slice(2);
for (const a of args)
  if (!a.startsWith("--screen=")) throw new Error(`Unknown option ${a}`);
const wanted = args
  .flatMap((a) => a.slice("--screen=".length).split(","))
  .filter(Boolean);

const report = plainLanguageReport();
const dir = new URL("../artifacts/plain-language/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(
  new URL("report.json", dir),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(plainLanguageReportTable(report));
for (const id of wanted) {
  const v = report.screens[id];
  console.log(
    v
      ? `\n${id}: undefined first uses ${v.terms.join(", ") || "none"}; long sentences ${v.long.length}`
      : `\n${id}: clear (or unknown screen)`,
  );
}
console.log("\nWrote artifacts/plain-language/report.json");

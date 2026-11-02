/**
 * Daily workbook samples for synthetic learners, as PDFs, with the layout
 * checks of `workbook-layout.ts` on every composed page.
 *
 *   npx tsx scripts/workbook-samples.ts [30|45|60|all] [--paper letter|a4|all]
 *       [--png] [--gray] [learner-id ...]
 *
 * Output: artifacts/workbooks/<learner>-<minutes>-<paper>.pdf, a summary
 * JSON, and with --png a PNG of every page (Poppler's pdftoppm; --gray adds
 * grayscale copies).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import {
  WORKBOOK_MINUTES,
  workbookMinutes,
  type WorkbookMinutes,
} from "../src/workbook/compose";
import { printWorkbookPdf } from "../src/workbook/pdf";
import type { PaperSize } from "../src/workbook/render";
import { sampleLearners } from "../src/workbook/synthetic";
import {
  checkWorkbookLayout,
  layoutFailures,
  sampleWorkbook,
} from "./workbook-layout";

const out = new URL("../artifacts/workbooks/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter(
  (a, i) => !a.startsWith("--") && args[i - 1] !== "--paper",
);
const minutesArg = positional[0] ?? "45";
const minutesList = (
  minutesArg === "all" ? [...WORKBOOK_MINUTES] : [Number(minutesArg)]
) as WorkbookMinutes[];
if (!minutesList.every((m) => WORKBOOK_MINUTES.includes(m)))
  throw new Error("Minutes: 30, 45, 60 or all");
const paperArg = value("--paper") ?? "letter";
const papers: PaperSize[] =
  paperArg === "all" ? ["letter", "a4"] : [paperArg as PaperSize];
if (!papers.every((p) => p === "letter" || p === "a4"))
  throw new Error("Paper: letter, a4 or all");
const only = new Set(positional.slice(1));

const browser = await chromium.launch({ headless: true });
const summary = [];
let failed = false;
try {
  for (const minutes of minutesList)
    for (const paper of papers)
      for (const learner of sampleLearners) {
        if (only.size && !only.has(learner.id)) continue;
        const { spec, html, level } = sampleWorkbook(learner, minutes, paper);
        const page = await browser.newPage();
        const pdf = await printWorkbookPdf(page, html);
        const found = await checkWorkbookLayout(page);
        await page.close();
        const name = `${learner.id}-${minutes}-${paper}`;
        writeFileSync(out + `${name}.pdf`, pdf);
        writeFileSync(out + `${name}.html`, html);
        if (flag("--png")) {
          mkdirSync(out + "png", { recursive: true });
          execFileSync("pdftoppm", [
            "-r",
            "70",
            "-png",
            out + `${name}.pdf`,
            out + `png/${name}`,
          ]);
          if (flag("--gray"))
            execFileSync("pdftoppm", [
              "-r",
              "70",
              "-gray",
              "-png",
              out + `${name}.pdf`,
              out + `png/${name}-gray`,
            ]);
        }
        const failures = layoutFailures(found, pdf);
        if (failures.length) failed = true;
        const challenge = spec.sections.at(-1)!.items[0]?.templateId;
        summary.push({
          learner: learner.id,
          minutes,
          paper,
          level: level.toFixed(2),
          estimate: workbookMinutes(spec),
          sections: spec.sections.map(
            (s) =>
              `${s.kind}:${s.items.length}${s.lessonId ? `(${s.lessonId})` : ""}`,
          ),
          challenge,
          pages: found.pages,
          studentPages: found.studentPages,
          lessonPages: found.lessonPages,
          failures,
          file: `${name}.pdf`,
        });
        console.log(
          `${failures.length ? "FAIL" : "ok  "} ${name}: ${found.pages} pages (${found.studentPages} student), challenge ${challenge}${failures.length ? `\n     ${failures.join("\n     ")}` : ""}`,
        );
      }
} finally {
  await browser.close();
}
writeFileSync(
  out + `summary-${minutesArg}-${paperArg}.json`,
  JSON.stringify(summary, null, 2),
);
if (failed) {
  console.error("Layout check failed: see the pages listed above.");
  process.exit(1);
}

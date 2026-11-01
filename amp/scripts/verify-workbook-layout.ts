/**
 * Daily workbook layout in a real browser, for CI: every synthetic learner at
 * 45 minutes on Letter, and the youngest, middle and oldest at 30 and 60
 * minutes on A4, printed with `printWorkbookPdf` and checked page by page
 * (`workbook-layout.ts`).
 *
 *   npx tsx scripts/verify-workbook-layout.ts
 */
import { chromium, firefox, webkit } from "playwright";
import type { WorkbookMinutes } from "../src/workbook/compose";
import { printWorkbookPdf, waitForWorkbookLayout } from "../src/workbook/pdf";
import type { PaperSize } from "../src/workbook/render";
import { sampleLearners } from "../src/workbook/synthetic";
import {
  checkWorkbookLayout,
  layoutFailures,
  sampleWorkbook,
} from "./workbook-layout";

const cases: [string, WorkbookMinutes, PaperSize][] = [
  ...sampleLearners.map(
    (l) => [l.id, 45, "letter"] as [string, WorkbookMinutes, PaperSize],
  ),
  ...["new-kindergartner", "third-grade", "algebra-two"].flatMap((id) =>
    ([30, 60] as const).map(
      (m) => [id, m, "a4"] as [string, WorkbookMinutes, PaperSize],
    ),
  ),
];
const browser = await chromium.launch({ headless: true });
let failed = 0;
try {
  for (const [id, minutes, paper] of cases) {
    const learner = sampleLearners.find((l) => l.id === id)!;
    const { html } = sampleWorkbook(learner, minutes, paper);
    const page = await browser.newPage();
    const pdf = await printWorkbookPdf(page, html);
    const failures = layoutFailures(await checkWorkbookLayout(page), pdf);
    await page.close();
    if (failures.length) failed++;
    console.log(
      `${failures.length ? "FAIL" : "ok  "} ${id} ${minutes} min ${paper}${failures.length ? `\n     ${failures.join("\n     ")}` : ""}`,
    );
  }
} finally {
  await browser.close();
}
// Parents may open the HTML and print from their own browser: the pages must
// compose the same way in Firefox and WebKit.
for (const engine of [firefox, webkit]) {
  const other = await engine.launch({ headless: true });
  try {
    for (const id of ["new-kindergartner", "third-grade", "algebra-two"]) {
      const learner = sampleLearners.find((l) => l.id === id)!;
      const { html } = sampleWorkbook(learner, 45, "letter");
      const page = await other.newPage();
      await page.emulateMedia({ media: "print" });
      await page.setContent(html, { waitUntil: "load" });
      // Firefox composes a long workbook in about ten seconds.
      await waitForWorkbookLayout(page, 90_000);
      const failures = layoutFailures(await checkWorkbookLayout(page));
      await page.close();
      if (failures.length) failed++;
      console.log(
        `${failures.length ? "FAIL" : "ok  "} ${id} 45 min letter in ${engine.name()}${failures.length ? `\n     ${failures.join("\n     ")}` : ""}`,
      );
    }
  } finally {
    await other.close();
  }
}
if (failed) {
  console.error(
    `${failed} of ${cases.length + 6} workbooks failed the layout check`,
  );
  process.exit(1);
}
console.log(`${cases.length + 6} workbooks pass the layout check`);

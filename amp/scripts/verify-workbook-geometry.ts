import { secureChromium } from "../browser-security.mjs";
/**
 * Workbook geometry in a real browser: no two blocks (problems, section
 * headings, the lesson card, key entries, the results page) intersect,
 * everything a block paints (text, figures, boxes) lies inside its own box
 * and inside the page margins, and no problem prints noticeably smaller to
 * fit a page (`checkWorkbookLayout`, `geometry` and `scaled`).
 *
 * It composes:
 * - the workbook from the QA report of 2026-11-16, where a five-step
 *   ordering problem was taller than a page and printed over the next
 *   page's problems (tests/fixtures/workbook-overlap-spec.json; the learner
 *   key in its seeds is replaced), on Letter and A4;
 * - every printable template, 40 to a workbook in the workbook's two-up
 *   rows, at its own print band (all problem types: long orderings,
 *   figures, tables, multi-part grids), on Letter;
 * - WORKBOOK_GEOMETRY_SWEEP random whole workbooks (`sweepCases`, seeded by
 *   the UTC day or WORKBOOK_SWEEP_SEED) on Letter and A4.
 *
 *   npx tsx scripts/verify-workbook-geometry.ts
 *
 * WORKBOOK_GEOMETRY_ONLY=fixture checks the fixture alone.
 */
import { readFileSync } from "node:fs";
import { chromium as rawChromium } from "playwright";
const chromium = secureChromium(rawChromium);
import { skills } from "../src/curriculum/catalog";
import { lessons } from "../src/content/lessons";
import { templates } from "../src/math/engine";
import { templateGrade } from "../src/server/mixed-practice";
import {
  printable,
  workbookCode,
  type WorkbookItem,
  type WorkbookSpec,
} from "../src/workbook/compose";
import { printWorkbookPdf } from "../src/workbook/pdf";
import {
  workbookBand,
  workbookHtml,
  type PaperSize,
} from "../src/workbook/render";
import {
  checkWorkbookLayout,
  pageCount,
  skillTitle,
  sweepCases,
} from "./workbook-layout";

const fixture = JSON.parse(
  readFileSync(
    new URL("../tests/fixtures/workbook-overlap-spec.json", import.meta.url),
    "utf8",
  ),
) as WorkbookSpec;
const cases: { label: string; spec: WorkbookSpec; paper: PaperSize }[] = [
  { label: "QA 2026-11-16 overlap, letter", spec: fixture, paper: "letter" },
  { label: "QA 2026-11-16 overlap, a4", spec: fixture, paper: "a4" },
];
if (process.env.WORKBOOK_GEOMETRY_ONLY !== "fixture") {
  // Every printable template at the middle of its print band.
  const nodes = new Map(skills.map((s) => [s.id, s]));
  const bandLevel = { early: 1, elementary: 4, middle: 7, high: 10 } as const;
  const byBand = new Map<keyof typeof bandLevel, WorkbookItem[]>();
  for (const t of templates) {
    if (!printable(t)) continue;
    const grade = templateGrade(t, nodes);
    const band = workbookBand(Math.round(grade));
    const items = byBand.get(band) ?? [];
    items.push({
      templateId: t.id,
      templateVersion: t.version,
      seed: `geometry:${t.id}`,
      skillId: t.skillId,
      strand: nodes.get(t.skillId)?.strand ?? t.skillId,
      grade,
      minutes: 2,
      space: "standard",
    });
    byBand.set(band, items);
  }
  for (const [band, items] of byBand)
    for (let start = 0; start < items.length; start += 40)
      cases.push({
        label: `${band} templates ${start + 1}–${Math.min(start + 40, items.length)}`,
        paper: "letter",
        spec: {
          version: 1,
          date: "2026-11-16",
          number: 1,
          minutes: 60,
          level: bandLevel[band],
          sections: [
            { kind: "practice", items: items.slice(start, start + 40) },
          ],
        },
      });
  const seed = /^\d+$/.test(process.env.WORKBOOK_SWEEP_SEED ?? "")
    ? Number(process.env.WORKBOOK_SWEEP_SEED)
    : Math.floor(Date.now() / 86_400_000);
  console.log(`sweep seed ${seed} (WORKBOOK_SWEEP_SEED=${seed} reproduces it)`);
  for (const c of sweepCases(
    seed,
    Number(process.env.WORKBOOK_GEOMETRY_SWEEP ?? 6),
  ))
    cases.push({ label: `sweep ${c.label}`, spec: c.spec, paper: c.paper });
}

let failed = 0;
const browser = await chromium.launch({ headless: true });
try {
  for (const c of cases) {
    const html = workbookHtml(c.spec, {
      lessons,
      skillTitle,
      paper: c.paper,
      results: {
        baseUrl: "https://amp.corpora.inc",
        learnerId: "geometry",
        workbookId: workbookCode(c.spec),
      },
    });
    const page = await browser.newPage();
    const pdf = await printWorkbookPdf(page, html);
    const found = await checkWorkbookLayout(page);
    await page.close();
    // Name each problem's template, so a failure points at its print.
    const ids = c.spec.sections.flatMap((s) =>
      s.items.map((i) => i.templateId),
    );
    const named = (line: string) =>
      line.replace(/problem (\d+)/g, (m, n) => `${m} (${ids[Number(n) - 1]})`);
    const failures = [
      ...found.geometry,
      ...found.scaled,
      ...found.overflow,
      ...(pageCount(pdf) === found.pages
        ? []
        : [`PDF has ${pageCount(pdf)} pages, layout composed ${found.pages}`]),
    ].map(named);
    if (failures.length) failed++;
    console.log(
      `${failures.length ? "FAIL" : "ok  "} ${c.label} (${found.pages} pages)${failures.length ? `\n     ${failures.slice(0, 40).join("\n     ")}` : ""}`,
    );
  }
} finally {
  await browser.close();
}
if (failed) {
  console.error(
    `${failed} of ${cases.length} workbooks fail the geometry check`,
  );
  process.exit(1);
}
console.log(`${cases.length} workbooks pass the geometry check`);

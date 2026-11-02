/**
 * Daily workbook layout in a real browser, for CI: every synthetic learner at
 * 45 minutes on Letter, and the youngest, middle and oldest at 30 and 60
 * minutes on A4, printed with `printWorkbookPdf` and checked page by page
 * (`workbook-layout.ts`). Then a randomized sweep (fixed samples once let a
 * results page overflow onto an extra sheet): the results page of
 * WORKBOOK_SWEEP_COUNT random compositions (K to precalculus, 30/45/60
 * minutes, Letter and A4, whole catalog, a few strands or one course) and of
 * the largest possible composition at every print band must fit one page,
 * and WORKBOOK_SWEEP_FULL random workbooks must pass every page check.
 * The seed is the UTC day; WORKBOOK_SWEEP_SEED reproduces a run (each run
 * prints its seed), and
 * WORKBOOK_SWEEP_ONLY=1 runs the sweep alone.
 *
 *   npx tsx scripts/verify-workbook-layout.ts
 */
import { chromium, firefox, webkit } from "playwright";
import type { WorkbookMinutes } from "../src/workbook/compose";
import { printWorkbookPdf, waitForWorkbookLayout } from "../src/workbook/pdf";
import {
  lessonCardProofHtml,
  resultsProofHtml,
  workbookBand,
  workbookHtml,
  type PaperSize,
} from "../src/workbook/render";
import { workbookCode, type WorkbookSpec } from "../src/workbook/compose";
import { sampleLearners } from "../src/workbook/synthetic";
import { lessons } from "../src/content/lessons";
import {
  checkWorkbookLayout,
  largestResultsSpec,
  layoutFailures,
  sampleWorkbook,
  skillTitle,
  sweepCases,
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
const sweepOnly = process.env.WORKBOOK_SWEEP_ONLY === "1";
let failed = 0;
if (!sweepOnly) {
  const browser = await chromium.launch({ headless: true });
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
}
// Every lesson card fits one page with its heading, at every band.
const cardProofs = [1, 4, 7, 10].flatMap((level) =>
  (["letter", "a4"] as PaperSize[]).map((paper) => [level, paper] as const),
);
if (!sweepOnly) {
  const proof = await chromium.launch({ headless: true });
  try {
    // Every print band (K–2, 3–5, 6–8, high school) on both paper sizes.
    for (const [level, paper] of cardProofs) {
      const page = await proof.newPage();
      await page.emulateMedia({ media: "print" });
      await page.setContent(lessonCardProofHtml(lessons, { level, paper }), {
        waitUntil: "load",
      });
      await waitForWorkbookLayout(page, 300_000);
      // Trimming never leaves a gap: no list item (step, paragraph, sentence,
      // word) shows after one that was left out.
      const gaps = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            ".wb-example-steps > li:not([data-steps-more]), .wb-lesson-idea > p, .wb-lesson-idea > p > span, .wb-words dl > div",
          ),
        ]
          .filter(
            (el) =>
              !el.hasAttribute("data-trimmed") &&
              !!el.previousElementSibling?.hasAttribute("data-trimmed"),
          )
          .map((el) =>
            el.closest("[data-lesson]")?.getAttribute("data-lesson"),
          ),
      );
      const over = await page.evaluate(() =>
        [...document.querySelectorAll(".wb-page")]
          .filter(
            (p) =>
              p.querySelector(".wb-page-content")!.getBoundingClientRect()
                .height >
              p.querySelector(".wb-page-body")!.getBoundingClientRect().height +
                1,
          )
          .flatMap((p) =>
            [...p.querySelectorAll("[data-lesson]")].map((el) =>
              el.getAttribute("data-lesson"),
            ),
          ),
      );
      await page.close();
      if (over.length || gaps.length) failed++;
      console.log(
        `${over.length || gaps.length ? "FAIL" : "ok  "} ${lessons.length} lesson cards at level ${level} on ${paper}${over.length ? `: taller than a page: ${over.join(", ")}` : ""}${gaps.length ? `: a gap after trimming: ${[...new Set(gaps)].join(", ")}` : ""}`,
      );
    }
  } finally {
    await proof.close();
  }
}

// Parents may open the HTML and print from their own browser: the pages must
// compose the same way in Firefox and WebKit.
for (const engine of sweepOnly ? [] : [firefox, webkit]) {
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
// Randomized sweep.
// The seed is the UTC day unless given: compositions change from day to
// day, and a rerun on the same day repeats the same ones.
const sweepSeed = /^\d+$/.test(process.env.WORKBOOK_SWEEP_SEED ?? "")
  ? Number(process.env.WORKBOOK_SWEEP_SEED)
  : Math.floor(Date.now() / 86_400_000);
const sweepCount = Number(process.env.WORKBOOK_SWEEP_COUNT ?? 240);
const sweepFull = Number(process.env.WORKBOOK_SWEEP_FULL ?? 4);
console.log(
  `sweep seed ${sweepSeed} (WORKBOOK_SWEEP_SEED=${sweepSeed} reproduces it)`,
);
const sweep = sweepCases(sweepSeed, sweepCount + sweepFull);
let sweepChecks = 0;
{
  // Results pages, grouped into one proof document per paper and print band.
  type Entry = { label: string; spec: WorkbookSpec };
  const groups = new Map<string, Entry[]>();
  const add = (paper: PaperSize, level: number, entry: Entry) => {
    const key = `${paper} ${workbookBand(level)} ${level}`;
    const group = [...groups.keys()].find((k) =>
      k.startsWith(`${paper} ${workbookBand(level)} `),
    );
    if (group) groups.get(group)!.push(entry);
    else groups.set(key, [entry]);
  };
  for (const c of sweep.slice(0, sweepCount))
    add(c.paper, c.spec.level, { label: c.label, spec: c.spec });
  for (const level of [1, 4, 7, 10])
    for (const paper of ["letter", "a4"] as const)
      add(paper, level, {
        label: `largest composition, level ${level}, ${paper}`,
        spec: largestResultsSpec(level),
      });
  const densities = new Map<string, number>();
  const browserForSweep = await chromium.launch({ headless: true });
  try {
    for (const [key, entries] of groups) {
      const [paper, , level] = key.split(" ");
      const page = await browserForSweep.newPage();
      await page.emulateMedia({ media: "print" });
      await page.setContent(
        resultsProofHtml(
          entries.map((e) => e.spec),
          {
            level: Number(level),
            paper: paper as PaperSize,
            baseUrl: "https://amp.corpora.inc",
          },
        ),
        { waitUntil: "load" },
      );
      await waitForWorkbookLayout(page, 300_000);
      await page.evaluate("window.__name = (f) => f");
      const found = await page.evaluate(() =>
        [...document.querySelectorAll(".wb-page--results")].map((p) => {
          const body = p
            .querySelector(".wb-page-body")!
            .getBoundingClientRect();
          const content = p
            .querySelector(".wb-page-content")!
            .getBoundingClientRect();
          const problems: string[] = [];
          if (content.height > body.height + 1)
            problems.push(
              `overflows by ${Math.round(content.height - body.height)}px`,
            );
          for (const el of p.querySelectorAll(".wb-page-content *")) {
            if (el.parentElement?.closest("svg")) continue;
            const box = el.getBoundingClientRect();
            const tile = el.closest(".wb-tile");
            const limit = tile
              ? tile.getBoundingClientRect().right
              : body.right;
            if (
              box.width &&
              (box.right > limit + 2 || box.right > body.right + 1)
            ) {
              problems.push(`${el.className} wider than its tile`);
              break;
            }
          }
          const total = p.querySelector(".wb-results-total");
          if (!total || total.getBoundingClientRect().bottom > body.bottom + 1)
            problems.push("the total row is off the page");
          const fit = p.querySelector("[data-results-fit]");
          const zoom = (p.querySelector(".wb-results-grid") as HTMLElement)
            ?.style.zoom;
          return {
            problems,
            tiles: p.querySelectorAll(".wb-tile").length,
            density: `${fit?.getAttribute("data-density")}${zoom ? ` at ${zoom}` : ""}`,
          };
        }),
      );
      await page.close();
      if (found.length !== entries.length) {
        failed++;
        console.log(
          `FAIL results ${key}: ${found.length} pages for ${entries.length} workbooks`,
        );
        continue;
      }
      found.forEach((f, i) => {
        sweepChecks++;
        densities.set(f.density, (densities.get(f.density) ?? 0) + 1);
        const tiles = entries[i]!.spec.sections.reduce(
          (sum, s) => sum + s.items.length,
          0,
        );
        if (f.tiles !== tiles) f.problems.push(`${f.tiles} of ${tiles} tiles`);
        if (f.problems.length) {
          failed++;
          console.log(
            `FAIL results ${entries[i]!.label}: ${f.problems.join("; ")}`,
          );
        }
      });
      console.log(
        `ok   ${entries.length} results pages, ${key.replace(/ \S+$/, "")}`,
      );
    }
    // Report only: how often each density (and any smaller print) is used.
    console.log(
      `results densities: ${[...densities]
        .sort()
        .map(([d, n]) => `${d}: ${n}`)
        .join(", ")}`,
    );
    // Whole random workbooks, printed, through every page check.
    for (const c of sweep.slice(sweepCount)) {
      const html = workbookHtml(c.spec, {
        lessons,
        skillTitle,
        paper: c.paper,
        results: {
          baseUrl: "https://amp.corpora.inc",
          learnerId: "sweep",
          workbookId: workbookCode(c.spec),
        },
      });
      const page = await browserForSweep.newPage();
      const pdf = await printWorkbookPdf(page, html);
      const found = await checkWorkbookLayout(page);
      await page.close();
      sweepChecks++;
      // Objective breakage fails (overflow, a split problem, content wider
      // than its column, mixed pages, a PDF with extra pages, broken words,
      // contrast, lost figure styles); page fill and a heading at the foot of
      // a page are quality, reported only.
      const notes = [...found.holes, ...found.orphans];
      const failures = layoutFailures(
        { ...found, holes: [], orphans: [] },
        pdf,
      );
      if (failures.length) failed++;
      console.log(
        `${failures.length ? "FAIL" : "ok  "} sweep ${c.label}${failures.length ? `\n     ${failures.join("\n     ")}` : ""}${notes.length ? `\n     note: ${notes.join("; ")}` : ""}`,
      );
    }
  } finally {
    await browserForSweep.close();
  }
}

const checks =
  (sweepOnly ? 0 : cases.length + cardProofs.length + 6) + sweepChecks;
if (failed) {
  console.error(
    `${failed} of ${checks} checks failed the layout check (sweep seed ${sweepSeed})`,
  );
  process.exit(1);
}
console.log(`${checks} checks pass the layout check`);

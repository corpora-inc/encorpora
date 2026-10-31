/**
 * Daily workbook samples for synthetic learners, as PDFs, with a layout
 * check on every page: nothing wider than the page, no problem split across
 * pages, and the answer key never on a student page.
 *
 *   npx tsx scripts/workbook-samples.ts [minutes] [learner-id ...]
 *
 * Output: artifacts/workbooks/<learner>-<minutes>.pdf and a summary JSON.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { skills } from "../src/curriculum/catalog";
import { lessons } from "../src/content/lessons";
import { templates } from "../src/math/engine";
import {
  WORKBOOK_MINUTES,
  composeWorkbook,
  workbookMinutes,
  type WorkbookMinutes,
} from "../src/workbook/compose";
import { workbookFooter, workbookHtml } from "../src/workbook/render";
import { sampleLearners, simulateLearner } from "../src/workbook/synthetic";

const out = new URL("../artifacts/workbooks/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
const args = process.argv.slice(2);
const minutes = (Number(args[0]) || 45) as WorkbookMinutes;
if (!WORKBOOK_MINUTES.includes(minutes))
  throw new Error("Minutes: 30, 45 or 60");
const only = new Set(args.slice(1));
const now = Date.parse("2026-10-31T13:00:00Z");
const skillTitle = (id: string) => skills.find((s) => s.id === id)?.title ?? id;

const browser = await chromium.launch({ headless: true });
const summary = [];
let failed = false;
try {
  for (const learner of sampleLearners) {
    if (only.size && !only.has(learner.id)) continue;
    const { frontier, evidence, attempts } = simulateLearner(learner, now);
    const spec = composeWorkbook({
      templates,
      skills,
      lessons,
      frontier,
      evidence,
      recentTemplateIds: attempts.slice(-12).map((a) => a.templateId),
      date: "2026-10-31",
      minutes,
      learnerKey: learner.id,
      now,
    });
    const html = workbookHtml(spec, { lessons, skillTitle });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.emulateMedia({ media: "print" });
    // Layout check at the printed column width (letter minus margins).
    await page.setViewportSize({ width: Math.round(7.4 * 96), height: 1000 });
    const problems = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      // An SVG clips its own children, so measure the SVG, not its shapes.
      const wide = [...document.querySelectorAll(".wb *")]
        .filter((el) => !el.parentElement?.closest("svg"))
        .filter((el) => el.getBoundingClientRect().right > width + 1)
        .map(
          (el) =>
            `${el.tagName} in ${
              el
                .closest(".wb-item, .wb-lesson")
                ?.querySelector("h2, h3")
                ?.textContent?.slice(0, 70) ?? "page"
            }`,
        );
      const tall = [...document.querySelectorAll(".wb-item")]
        .filter((el) => el.getBoundingClientRect().height > 9.6 * 96)
        .map((el) => el.querySelector("h2")?.textContent?.slice(0, 60) ?? "");
      // A shape painted the browser's default black lost its figure styles.
      const unstyled = [
        ...document.querySelectorAll(
          ".wb svg rect, .wb svg path, .wb svg circle, .wb svg polygon, .wb svg ellipse",
        ),
      ]
        .filter((el) => {
          const box = el.getBoundingClientRect();
          if (
            getComputedStyle(el).fill !== "rgb(0, 0, 0)" ||
            box.width * box.height <= 300
          )
            return false;
          // An open outline has a default fill but no area to paint.
          const shape = el as SVGGeometryElement;
          const b = shape.getBBox();
          return [0.25, 0.5, 0.75].some((fx) =>
            [0.25, 0.5, 0.75].some((fy) =>
              shape.isPointInFill(
                new DOMPoint(b.x + b.width * fx, b.y + b.height * fy),
              ),
            ),
          );
        })
        .map(
          (el) =>
            el
              .closest(".wb-item, .wb-lesson")
              ?.querySelector("h2, h3")
              ?.textContent?.slice(0, 60) ?? el.outerHTML.slice(0, 60),
        );
      return {
        wide: [...new Set(wide)].slice(0, 10),
        tall,
        unstyled: [...new Set(unstyled)],
      };
    });
    const file = `${learner.id}-${minutes}.pdf`;
    const pdf = await page.pdf({
      format: "Letter",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: workbookFooter(spec),
    });
    writeFileSync(out + file, pdf);
    await page.addStyleTag({ content: ".wb-key,.wb-results{display:none}" });
    const studentPdf = await page.pdf({
      format: "Letter",
      preferCSSPageSize: true,
    });
    writeFileSync(out + `${learner.id}-${minutes}.html`, html);
    await page.close();
    const pageCount = (bytes: Buffer) =>
      (bytes.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    const pages = pageCount(pdf);
    const studentPages = pageCount(studentPdf);
    const entry = {
      learner: learner.id,
      level: frontier.overall.level.toFixed(2),
      answered: attempts.length,
      minutes: workbookMinutes(spec),
      pages,
      studentPages,
      sections: spec.sections.map(
        (s) =>
          `${s.kind}:${s.items.length}${s.lessonId ? `(${s.lessonId})` : ""}`,
      ),
      grades: spec.sections.map((s) =>
        s.items.map((i) => i.grade.toFixed(1)).join(" "),
      ),
      ...problems,
      file,
    };
    if (
      problems.wide.length ||
      problems.tall.length ||
      problems.unstyled.length
    )
      failed = true;
    summary.push(entry);
    console.log(JSON.stringify(entry));
  }
} finally {
  await browser.close();
}
writeFileSync(
  out + `summary-${minutes}.json`,
  JSON.stringify(summary, null, 2),
);
if (failed) {
  console.error("Layout check failed: see 'wide' and 'tall' above.");
  process.exit(1);
}

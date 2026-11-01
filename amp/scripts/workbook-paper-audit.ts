/**
 * Paper audit: three problems from every template (and K–2 templates again
 * at the early print scale), printed in the daily
 * workbook's two-up layout. A template fails when its problem is wider than
 * its column, taller than a page, or draws a shape that lost its figure
 * styles (painted the browser's default black).
 *
 *   npx tsx scripts/workbook-paper-audit.ts
 *
 * Writes artifacts/workbook-paper-audit.json. Failing templates belong in
 * src/workbook/paper-exclusions.ts until their printed form is fixed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { skills } from "../src/curriculum/catalog";
import { lessons } from "../src/content/lessons";
import { templates } from "../src/math/engine";
import { templateGrade } from "../src/server/mixed-practice";
import type { WorkbookItem, WorkbookSpec } from "../src/workbook/compose";
import { paperExclusions } from "../src/workbook/paper-exclusions";
import { waitForWorkbookLayout } from "../src/workbook/pdf";
import { workbookHtml } from "../src/workbook/render";

const nodes = new Map(skills.map((s) => [s.id, s]));
const skillTitle = (id: string) => nodes.get(id)?.title ?? id;
const chunk = Number(process.env.AUDIT_CHUNK) || 40;
const only = process.env.AUDIT_ONLY?.split(",");
const failures: { templateId: string; reasons: string[] }[] = [];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewportSize({ width: Math.round(7.4 * 96), height: 1000 });
  // Every template at the middle-grades print scale, and kindergarten to
  // grade 2 templates again at the early scale (larger type and figures).
  const passes: { level: number; list: typeof templates }[] = [
    { level: 6, list: templates },
    {
      level: 1,
      list: templates.filter((t) => templateGrade(t, nodes) < 3),
    },
  ];
  for (const pass of passes)
    for (let start = 0; start < pass.list.length; start += chunk) {
      const batch = pass.list
        .slice(start, start + chunk)
        .filter((t) => !only || only.includes(t.id))
        .flatMap((t) => [0, 1, 2].map((i) => ({ ...t, auditSeed: i })));
      const items: WorkbookItem[] = batch.map((t) => ({
        templateId: t.id,
        templateVersion: t.version,
        seed: `paper-audit:${t.id}:${t.auditSeed}`,
        skillId: t.skillId,
        strand: nodes.get(t.skillId)?.strand ?? t.skillId,
        grade: templateGrade(t, nodes),
        minutes: 2,
        space: "standard",
      }));
      const spec: WorkbookSpec = {
        version: 1,
        date: "2026-10-31",
        number: 1,
        minutes: 45,
        level: pass.level,
        sections: [{ kind: "practice", items }],
      };
      await page.emulateMedia({ media: "print" });
      await page.setContent(workbookHtml(spec, { lessons, skillTitle }));
      await waitForWorkbookLayout(page, 120_000);
      // Measure each problem at its own size, without the spare page height
      // the layout shares out as workspace.
      await page.addStyleTag({ content: ".wb-row{--wb-grow:0px!important}" });
      const found = await page.evaluate(() => {
        return [...document.querySelectorAll(".wb-item")].map((item) => {
          const reasons: string[] = [];
          const column = item.getBoundingClientRect();
          const width = item
            .closest(".wb-page-body")!
            .getBoundingClientRect().right;
          const wide = [...item.querySelectorAll("*")].some(
            (el) =>
              // An SVG clips its shapes; KaTeX's MathML copy is hidden.
              !el.parentElement?.closest("svg, .katex-mathml") &&
              (el.getBoundingClientRect().right > column.right + 2 ||
                el.getBoundingClientRect().right > width + 1),
          );
          if (wide) reasons.push("wider than its column");
          const page = item.closest(".wb-page-body")!.getBoundingClientRect();
          if (column.height > page.height)
            reasons.push(
              `taller than a page (${Math.round(column.height)} > ${Math.round(page.height)}px)`,
            );
          const unstyled = [
            ...item.querySelectorAll(
              "svg rect, svg path, svg circle, svg polygon, svg ellipse",
            ),
          ].some((el) => {
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
          });
          if (unstyled) reasons.push("figure shape lost its styles");
          return reasons;
        });
      });
      found.forEach((reasons, i) => {
        if (reasons.length)
          failures.push({
            templateId: batch[i]!.id,
            reasons: [
              `level ${pass.level} seed ${batch[i]!.auditSeed}`,
              ...reasons,
            ],
          });
      });
      process.stdout.write(`${Math.min(start + chunk, pass.list.length)} `);
    }
} finally {
  await browser.close();
}
const out = new URL("../artifacts/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });
writeFileSync(
  out + "workbook-paper-audit.json",
  JSON.stringify({ templates: templates.length, failures }, null, 2),
);
console.log(
  `\n${new Set(failures.map((f) => f.templateId)).size} of ${templates.length} templates fail on paper`,
);
for (const f of failures)
  console.log(`${f.templateId}: ${f.reasons.join(", ")}`);
const unlisted = [...new Set(failures.map((f) => f.templateId))].filter(
  (id) => !paperExclusions.has(id),
);
if (unlisted.length) {
  console.error(
    `Not in paper-exclusions.ts: ${unlisted.join(", ")}. Fix their print or list them.`,
  );
  process.exit(1);
}

/**
 * Paper audit: three problems from every template, printed in the daily
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
import { workbookHtml } from "../src/workbook/render";

const nodes = new Map(skills.map((s) => [s.id, s]));
const skillTitle = (id: string) => nodes.get(id)?.title ?? id;
const chunk = 40;
const failures: { templateId: string; reasons: string[] }[] = [];
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.setViewportSize({ width: Math.round(7.4 * 96), height: 1000 });
  for (let start = 0; start < templates.length; start += chunk) {
    const batch = templates
      .slice(start, start + chunk)
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
      level: 6,
      sections: [{ kind: "practice", items }],
    };
    await page.setContent(workbookHtml(spec, { lessons, skillTitle }));
    await page.emulateMedia({ media: "print" });
    const found = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      return [...document.querySelectorAll(".wb-item")].map((item) => {
        const reasons: string[] = [];
        const column = item.getBoundingClientRect();
        const wide = [...item.querySelectorAll("*")].some(
          (el) =>
            !el.parentElement?.closest("svg") &&
            (el.getBoundingClientRect().right > column.right + 2 ||
              el.getBoundingClientRect().right > width + 1),
        );
        if (wide) reasons.push("wider than its column");
        if (column.height > 9.6 * 96) reasons.push("taller than a page");
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
          reasons: [`seed ${batch[i]!.auditSeed}`, ...reasons],
        });
    });
    process.stdout.write(`${Math.min(start + chunk, templates.length)} `);
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

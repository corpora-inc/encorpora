/**
 * Real AMP workbooks for one synthetic learner ("Maya", third-grade profile),
 * rolled several times on one date with history, so every roll differs.
 * Uses the product's own composer, renderer and PDF printer from the capture
 * worktree. Output: captures/workbooks/roll-<n>.pdf + page PNGs at 200 dpi.
 *   npx tsx capture/workbooks.ts [learnerId] [rolls]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
const SRC = "../src";
const { composeWorkbook, workbookCode, workbookMinutes } = await import(`../src/workbook/compose.ts`);
const { workbookHtml } = await import(`../src/workbook/render.tsx`);
const { printWorkbookPdf } = await import(`../src/workbook/pdf.ts`);
const { sampleLearners, simulateLearner } = await import(`../src/workbook/synthetic.ts`);
const { skills } = await import(`../src/curriculum/catalog.ts`);
const { lessons } = await import(`../src/content/lessons.ts`);
const { templates } = await import(`../src/math/engine.ts`);

const learnerId = process.argv[2] ?? "third-grade";
const rolls = Number(process.argv[3] ?? 4);
const name = process.argv[4] ?? "Maya";
const out = `/Users/skyl/corpora-media/AMP-media/2026-11-02/amp-feature-ad-contest/entrants/anthropic/captures/workbooks/${learnerId}/`;
mkdirSync(out, { recursive: true });
const now = Date.parse("2026-11-02T15:00:00Z");
const learner = sampleLearners.find((l: any) => l.id === learnerId)!;
const { frontier, evidence, attempts } = simulateLearner(learner, now);
const skillTitle = (id: string) => skills.find((s: any) => s.id === id)?.title ?? id;
const browser = await chromium.launch();
const history: any[] = [];
const summary: any[] = [];
for (let n = 1; n <= rolls; n++) {
  const spec = composeWorkbook({
    templates, skills, lessons, frontier, evidence,
    recentTemplateIds: attempts.slice(-12).map((a: any) => a.templateId),
    history: [...history].reverse(), date: "2026-11-02", number: n, minutes: 30,
    learnerKey: learner.id, now,
  });
  history.push(spec);
  const html = workbookHtml(spec, {
    lessons, skillTitle, paper: "letter", learnerName: name,
    results: { baseUrl: "https://amp.corpora.inc", learnerId: `sample-${learner.id}`, workbookId: workbookCode(spec) },
  });
  const page = await browser.newPage();
  const pdf = await printWorkbookPdf(page, html);
  await page.close();
  writeFileSync(out + `roll-${n}.pdf`, pdf);
  writeFileSync(out + `roll-${n}.html`, html);
  writeFileSync(out + `roll-${n}.spec.json`, JSON.stringify(spec, null, 2));
  execFileSync("pdftoppm", ["-r", "200", "-png", out + `roll-${n}.pdf`, out + `roll-${n}`]);
  summary.push({ n, code: workbookCode(spec), level: spec.level, minutes: workbookMinutes(spec),
    sections: spec.sections.map((s: any) => `${s.kind}:${s.items.length}${s.lessonId ? `(${s.lessonId})` : ""}`) });
  console.log(JSON.stringify(summary.at(-1)));
}
await browser.close();
writeFileSync(out + "summary.json", JSON.stringify({ learnerId, name, date: "2026-11-02", sourceCommit: "cd71711864e61fd20ffed7ba41ef6baa666ed07c", rolls: summary }, null, 2));

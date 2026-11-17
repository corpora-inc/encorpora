/** Take 5: Pathways, signed out. Usage: pathways.ts OUTDIR FORMAT [light|dark] */
import { writeFile } from "node:fs/promises";
import { Recorder, launchFor, tap, glide, watchProblems, type Format } from "../recorder.ts";
const [dir, format, scheme = "light"] = process.argv.slice(2) as [string, Format, "light" | "dark"];
const { page, close } = await launchFor(format, { colorScheme: scheme });
const problems: string[] = [];
watchProblems(page, problems);
const timings: Record<string, number> = {};
const rec = new Recorder(page, dir, format);
const phone = format === "9x16";
const visible = (l: ReturnType<typeof page.locator>) => l.filter({ visible: true }).first();
async function closeSheets() {
  for (let i = 0; i < 3; i++) {
    const c = visible(page.getByRole("dialog").getByRole("button", { name: "Close" }));
    if (!(await c.isVisible().catch(() => false))) break;
    await tap(page, c, 150);
    await rec.hold(450);
  }
}
let t = Date.now();
await page.goto("https://amp.corpora.inc/pathways", { waitUntil: "networkidle" });
timings.load = Date.now() - t;
await rec.start();
await rec.hold(1300);
// Grades view: open a grade, then a skill, then what it builds on.
await tap(page, visible(page.getByText("Grade 3", { exact: true })));
await rec.hold(800);
if (phone) await glide(page, 300, 700);
await rec.hold(400);
await tap(page, visible(page.getByRole("link", { name: "Multiplying by a multiple of 10" })));
await rec.hold(1700);
timings.urlAfterSkill = 0;
problems.push(`url after opening skill: ${page.url()}`);
await tap(page, page.getByRole("dialog").getByRole("link", { name: /One-digit multiplication facts/ }).first());
await rec.hold(1700);
await closeSheets();
// Search.
await page.evaluate("window.scrollTo({top: 0, behavior: 'smooth'})");
await rec.hold(500);
await tap(page, page.getByRole("searchbox", { name: "Search" }));
await page.keyboard.type("fractions", { delay: 75 });
await rec.hold(1300);
await tap(page, visible(page.getByRole("link", { name: /^Recognizing equivalent fractions/ })));
await rec.hold(2200);
await closeSheets();
const closeBrowser = visible(page.getByRole("button", { name: "Close browser" }));
if (await closeBrowser.isVisible().catch(() => false)) await tap(page, closeBrowser, 150);
await rec.hold(500);
// The 3D map, orbiting.
t = Date.now();
await rec.skip(async () => {
  await tap(page, page.getByRole("radio", { name: "3D" }), 100);
  await page.locator(".pathways-viewport canvas").first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(700);
});
timings.map3d = Date.now() - t;
if (phone) {
  const top = await page.evaluate("document.querySelector('.pathways-viewport').getBoundingClientRect().top");
  await glide(page, Number(top) - 8, 700);
} else {
  await tap(page, page.getByRole("button", { name: "Full screen" }));
}
await rec.hold(1200);
await tap(page, page.getByRole("button", { name: "3D orbit" }));
await rec.hold(3200);
await tap(page, page.getByRole("button", { name: "Zoom in" }));
await rec.hold(3000);
const algebra = visible(page.getByRole("button", { name: "Algebra" }));
if (phone && (await algebra.isVisible().catch(() => false))) {
  await tap(page, algebra);
  await rec.hold(3000);
} else {
  // Full screen covers the area filters; zoom back out to the whole map.
  await tap(page, page.getByRole("button", { name: "Zoom out" }));
  await rec.hold(2500);
}
await rec.stop();
await page.screenshot({ path: `${dir}/end.png` });
await writeFile(`${dir}/run.json`, JSON.stringify({ timings, problems, url: page.url() }, null, 1));
console.log(JSON.stringify({ timings, problems }));
await close();

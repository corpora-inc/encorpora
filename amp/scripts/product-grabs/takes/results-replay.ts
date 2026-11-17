/** Take 3 in another format, re-rendered from the live 9:16 session's
 * recorded API responses (replay.ts). Usage:
 *   results-replay.ts OUTDIR FORMAT LIVE_DIR FAMILY_ID CHILD_NAME */
import { writeFile } from "node:fs/promises";
import { Recorder, launchFor, tap, glide, watchProblems, type Format } from "../recorder.ts";
import { installReplay } from "../replay.ts";
const [dir, format, live, family, child = "Maya"] = process.argv.slice(2) as [string, Format, string, string, string];
const { page, close } = await launchFor(format);
const problems: string[] = [];
watchProblems(page, problems);
await installReplay(page, `${live}/api.json`, problems);
const rec = new Recorder(page, dir, format);
const phone = format === "9x16";
try {
  await page.goto(`https://amp.corpora.inc/family/${family}`);
  await page.getByRole("button", { name: `Practice with ${child}` }).waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await rec.start();
  await rec.hold(1800);
  await tap(page, page.getByRole("link", { name: child, exact: true }), 300);
  await rec.skip(() => page.getByRole("heading", { name: "Current estimates" }).waitFor({ timeout: 20000 }));
  await rec.hold(1400);
  let top = await page.getByRole("heading", { name: "Current estimates" }).evaluate((e) => e.getBoundingClientRect().top);
  await glide(page, top - 70, 1000);
  await rec.hold(2200);
  await glide(page, phone ? 600 : 400, 1400);
  await rec.hold(1300);
  top = await page.getByRole("heading", { name: "Recent work" }).evaluate((e) => e.getBoundingClientRect().top);
  await glide(page, top - 80, 1200);
  await rec.hold(1200);
  await tap(page, page.getByRole("link", { name: /Missed Evaluate/ }), 300);
  await rec.skip(() => page.getByRole("dialog").first().waitFor());
  await rec.hold(2600);
  const d = page.getByRole("dialog").first();
  await d.evaluate((el) => {
    const sc = [el, ...el.querySelectorAll("*")].find((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY));
    if (sc) sc.scrollTo({ top: 500, behavior: "smooth" });
  });
  await rec.hold(2200);
  await tap(page, d.getByRole("link", { name: "Close" }), 250);
  await rec.hold(700);
  await tap(page, page.getByRole("link", { name: "Pathways", exact: true }), 300);
  await rec.skip(() => page.getByRole("radio", { name: "3D" }).waitFor({ timeout: 20000 }));
  await rec.hold(1500);
  await tap(page, page.getByText("Grade 7", { exact: true }).filter({ visible: true }).first(), 300);
  await rec.hold(900);
  await glide(page, phone ? 420 : 300, 1100);
  await rec.hold(1800);
  await page.evaluate(`window.scrollTo({ top: 0, behavior: "smooth" })`);
  await rec.hold(600);
  await rec.skip(async () => {
    await tap(page, page.getByRole("radio", { name: "3D" }), 150);
    await page.locator(".pathways-viewport canvas").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(800);
  });
  if (phone) {
    const t = await page.evaluate(`document.querySelector(".pathways-viewport").getBoundingClientRect().top`);
    await glide(page, Number(t) - 8, 700);
  } else await tap(page, page.getByRole("button", { name: "Full screen" }), 250);
  await rec.hold(1500);
  await tap(page, page.getByRole("button", { name: "3D orbit" }), 200);
  await rec.hold(2500);
  await tap(page, page.getByRole("button", { name: "Where you are" }), 250);
  await rec.hold(3800);
} catch (e) {
  problems.push(`take failed: ${String(e).slice(0, 400)}`);
  await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
} finally {
  await rec.stop().catch(() => {});
  await writeFile(`${dir}/run.json`, JSON.stringify({ problems }, null, 1));
  console.log(JSON.stringify({ problems }));
  await close();
}

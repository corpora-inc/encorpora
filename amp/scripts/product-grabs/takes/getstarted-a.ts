/** Take 1, part A (signed out): the landing page, Try it free, the sign-up
 * screen, and the press on a provider button. The OAuth screens are cut.
 * Usage: getstarted-a.ts OUTDIR FORMAT [light|dark] [provider] */
import { writeFile } from "node:fs/promises";
import { Recorder, launchFor, tap, glide, watchProblems, type Format } from "../recorder.ts";
const [dir, format, scheme = "light", provider = "Google"] = process.argv.slice(2) as [string, Format, "light" | "dark", string];
const { page, close } = await launchFor(format, { colorScheme: scheme });
const problems: string[] = [];
watchProblems(page, problems);
const timings: Record<string, number> = {};
const rec = new Recorder(page, dir, format);
let t = Date.now();
await page.goto("https://amp.corpora.inc/", { waitUntil: "networkidle" });
timings.landing = Date.now() - t;
await rec.start();
await rec.hold(2200);
if (format !== "16x9") {
  await glide(page, format === "9x16" ? 330 : 260, 1100);
  await rec.hold(900);
}
const tryFree = page.getByRole("button", { name: "Try it free" }).filter({ visible: true }).first();
t = Date.now();
await tap(page, tryFree, 350);
await rec.skip(() => page.getByRole("button", { name: provider }).first().waitFor());
timings.toSignUp = Date.now() - t;
problems.push(`sign-up url: ${page.url()}`);
await rec.hold(1500);
const button = page.getByRole("button", { name: provider }).first();
const box = await button.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 6 });
  await rec.hold(300);
  await page.mouse.down();
  await rec.hold(450);
}
await rec.stop();
await page.screenshot({ path: `${dir}/end.png` });
await writeFile(`${dir}/run.json`, JSON.stringify({ timings, problems, url: page.url() }, null, 1));
console.log(JSON.stringify({ timings, problems }));
await close();

/** Take 4 (teacher) in another format, re-rendered from the live 16:9
 * session's recorded API responses (replay.ts). Usage:
 *   teacher-replay.ts OUTDIR FORMAT LIVE_DIR */
import { writeFile } from "node:fs/promises";
import { Recorder, launchFor, tap, glide, watchProblems, type Format } from "../recorder.ts";
import { installReplay } from "../replay.ts";
const [dir, format, live] = process.argv.slice(2) as [string, Format, string];
const { page, close } = await launchFor(format);
const problems: string[] = [];
watchProblems(page, problems);
await installReplay(page, `${live}/api.json`, problems);
const rec = new Recorder(page, dir, format);
const visible = (l: ReturnType<typeof page.locator>) => l.filter({ visible: true }).first();
try {
  await page.goto("https://amp.corpora.inc/start");
  await page.getByText("What brings you to AMP?").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  await rec.start();
  await rec.hold(1500);
  await tap(page, visible(page.getByRole("link", { name: /I’m a teacher/ })), 400);
  await rec.skip(() => page.getByText("Set up your class").first().waitFor({ timeout: 20000 }));
  await rec.hold(800);
  await tap(page, page.getByRole("textbox", { name: "School name" }), 250);
  await page.keyboard.type("Corpora Academy", { delay: 85 });
  await rec.hold(300);
  await tap(page, page.getByRole("textbox", { name: "Class name" }), 250);
  await page.keyboard.type("Grade 4 Math", { delay: 85 });
  await rec.hold(900);
  await tap(page, page.getByRole("button", { name: "Next", exact: true }), 300);
  await rec.skip(() => page.getByText("Your students").first().waitFor({ timeout: 20000 }));
  await rec.hold(800);
  await tap(page, page.getByRole("textbox", { name: /^Student names/ }), 250);
  for (const n of ["Ava", "Ben", "Leo"]) {
    await page.keyboard.type(n, { delay: 90 });
    if (n !== "Leo") await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
  }
  await rec.hold(600);
  await tap(page, page.getByRole("checkbox", { name: /My school authorizes me/ }), 300);
  await rec.hold(700);
  await tap(page, page.getByRole("button", { name: "Create class with 3 students" }), 350);
  await rec.skip(async () => {
    await page.waitForURL((u) => !u.pathname.startsWith("/school/start"), { timeout: 30000 });
    await page.waitForTimeout(2000);
  });
  await rec.hold(1500);
  await tap(page, page.getByRole("link", { name: "Start class" }).first(), 350);
  await rec.skip(() => page.waitForURL(/\/start$/, { timeout: 20000 }).then(() => page.waitForTimeout(1500)));
  await rec.hold(2500);
  for (const k of [1, 2, 3]) {
    await rec.skip(() => page.waitForFunction((k) => /\b(\d)\s*of 3 here/.exec(document.body.innerText)?.[1] === String(k), k, { timeout: 90000 }).catch(() => problems.push(`board never showed ${k}`)));
    await rec.hold(1200);
  }
  await rec.hold(1000);
  await tap(page, page.getByRole("link", { name: "Map", exact: true }), 350);
  await rec.skip(() => page.waitForURL(/\/map/, { timeout: 20000 }).then(() => page.waitForTimeout(2500)));
  await rec.hold(2500);
  await glide(page, 700, 1800);
  await rec.hold(1500);
  await glide(page, 900, 1800);
  await rec.hold(1500);
  await page.evaluate(`window.scrollTo({ top: 0, behavior: "smooth" })`);
  await rec.hold(900);
  await tap(page, page.getByRole("link", { name: "Ava", exact: true }), 300);
  await rec.skip(() => page.getByRole("dialog").first().waitFor({ timeout: 20000 }).then(() => page.waitForTimeout(1500)));
  await rec.hold(2500);
  const d = page.getByRole("dialog").first();
  await d.evaluate((el) => {
    const sc = [el, ...el.querySelectorAll("*")].find((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY));
    if (sc) sc.scrollTo({ top: 700, behavior: "smooth" });
  });
  await rec.hold(2500);
  await tap(page, d.getByRole("button", { name: "Close" }), 250);
  await rec.hold(600);
  await tap(page, visible(page.getByRole("link", { name: "Today", exact: true })), 300);
  await rec.skip(() => page.waitForURL(/\/today/).then(() => page.waitForTimeout(2500)));
  await rec.hold(2500);
} catch (e) {
  problems.push(`take failed: ${String(e).slice(0, 400)}`);
  await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
} finally {
  await rec.stop().catch(() => {});
  await writeFile(`${dir}/run.json`, JSON.stringify({ problems }, null, 1));
  console.log(JSON.stringify({ problems }));
  await close();
}

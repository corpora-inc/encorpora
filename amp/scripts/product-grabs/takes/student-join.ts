/** Take 4 (student side): a signed-out phone joins a class by code, taps
 * their name, picks 3 pictures, then answers problems. Usage:
 *   student-join.ts OUTDIR FORMAT CODE NAME PROBLEMS RECORD(0|1) [missAt=-1] */
import { writeFile } from "node:fs/promises";
import { Recorder, launchFor, tap, watchProblems, logApi, type Format } from "../recorder.ts";
import { Bot } from "../bot.ts";
const [dir, format, code, name, n = "5", record = "1", missAt = "-1"] = process.argv.slice(2) as [string, Format, string, string, string, string, string];
const { page, close } = await launchFor(format);
const problems: string[] = [];
const api: any[] = [];
watchProblems(page, problems);
logApi(page, api);
const bot = new Bot(page);
await bot.install();
// STUDENT_REPLAY=api.json re-renders a recorded join (no production calls).
if (process.env.STUDENT_REPLAY) {
  const { installReplay } = await import("../replay.ts");
  await installReplay(page, process.env.STUDENT_REPLAY, problems);
}
const rec = new Recorder(page, dir, format);
const visible = (l: ReturnType<typeof page.locator>) => l.filter({ visible: true }).first();
const timings: Record<string, number> = {};
const shot = (s: string) => page.screenshot({ path: `${dir}/s-${s}.png` }).catch(() => {});
try {
  await page.goto("https://amp.corpora.inc/join");
  await page.getByRole("textbox", { name: "Code" }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(800);
  if (record === "1") await rec.start();
  await rec.hold(1200);
  await tap(page, page.getByRole("textbox", { name: "Code" }), 250);
  await page.keyboard.type(code.replace(/-/g, ""), { delay: 180 });
  let t = Date.now();
  await rec.skip(() => page.getByText("Tap your name").first().waitFor({ timeout: 20000 }));
  timings.toNames = Date.now() - t;
  await shot("names");
  await rec.hold(1000);
  await tap(page, visible(page.getByRole("button", { name }).or(page.getByRole("link", { name }))), 350);
  await rec.skip(() => page.getByText(/Pick 3 pictures|Pick your 3 pictures/).first().waitFor({ timeout: 20000 }));
  await shot("pictures");
  await rec.hold(900);
  const tiles = page.locator("button[aria-pressed]");
  const count = await tiles.count();
  problems.push(`picture tiles: ${count}`);
  for (const i of [2, 7, 12]) {
    await tap(page, tiles.nth(i % Math.max(count, 1)), 280);
    await page.waitForTimeout(350);
  }
  await rec.hold(900);
  await shot("remember");
  problems.push(`after picks: ${(await page.locator("main").ariaSnapshot()).slice(0, 600)}`);
  // First time: "Remember these 3" then a confirming action.
  const go = visible(page.getByRole("button", { name: "These are mine" }));
  if (await go.isVisible().catch(() => false)) {
    await rec.hold(800);
    await tap(page, go, 300);
  }
  t = Date.now();
  await rec.skip(() => bot.waitForProblem(30000));
  timings.toPractice = Date.now() - t;
  await shot("practice");
  await rec.hold(700);
  for (let i = 0; i < Number(n); i++) {
    if (i > 0) {
      await bot.next(200);
      await rec.skip(() => bot.waitForProblem(30000));
      await rec.hold(250);
    }
    const r = await bot.answer(i !== Number(missAt), 1000 + Math.round(Math.random() * 500), 140);
    if (!r.ok) {
      problems.push(`answer ${i}: ${r.error}`);
      break;
    }
    await rec.skip(() => page.locator("button.next-action").filter({ visible: true }).first().waitFor({ timeout: 20000 }));
    await rec.hold(1300);
  }
} catch (e) {
  problems.push(`take failed: ${String(e).slice(0, 400)}`);
  await shot("failure");
} finally {
  if (record === "1") await rec.stop().catch(() => {});
  await writeFile(`${dir}/run.json`, JSON.stringify({ timings, problems, url: page.url(), answers: bot.log }, null, 1));
  await writeFile(`${dir}/api.json`, JSON.stringify(api));
  console.log(JSON.stringify({ timings, problems: problems.slice(0, 6), answers: bot.log.map((l) => [l.skillId, (l.result as any)?.correct]) }));
  await close();
}

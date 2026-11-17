/** Take 1, part B (signed in, family profile): "What brings you to AMP?",
 * I'm a parent, add a child, who practices first, the first problems.
 * Runs ONCE per account (it creates the family). Usage:
 *   getstarted-b.ts OUTDIR FORMAT CHILD_NAME BIRTH_YEAR [problems=3] */
import { writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { Recorder, launchFor, tap, watchProblems, logApi, type Format } from "../recorder.ts";
import { Bot } from "../bot.ts";
const [dir, format, childName = "Maya", birthYear = "2017", count = "3"] = process.argv.slice(2) as [string, Format, string, string, string];
const { page, close } = await launchFor(format, { profile: `${homedir()}/.config/corpora/amp-video/profiles/family` });
const problems: string[] = [];
const api: any[] = [];
watchProblems(page, problems);
logApi(page, api);
const bot = new Bot(page);
await bot.install();
const rec = new Recorder(page, dir, format);
const shots: string[] = [];
const shot = async (name: string) => {
  await page.screenshot({ path: `${dir}/step-${name}.png` });
  shots.push(name);
};
const timings: Record<string, number> = {};
const visible = (l: ReturnType<typeof page.locator>) => l.filter({ visible: true }).first();
try {
  let t = Date.now();
  await page.goto("https://amp.corpora.inc/start", { waitUntil: "networkidle" });
  timings.start = Date.now() - t;
  await shot("start");
  await rec.start();
  await rec.hold(1500);
  t = Date.now();
  await tap(page, visible(page.getByText("I’m a parent", { exact: true })), 400);
  await rec.skip(() => page.getByText("Add your kids").first().waitFor({ timeout: 20000 }));
  timings.toKids = Date.now() - t;
  await shot("kids");
  await rec.hold(900);
  const name = visible(page.getByRole("textbox").first());
  await tap(page, name, 250);
  await page.keyboard.type(childName, { delay: 120 });
  await rec.hold(400);
  await tap(page, visible(page.getByRole("button", { name: /^Birth year/ })), 300);
  await rec.hold(700);
  await shot("years");
  await tap(page, visible(page.getByRole("option", { name: birthYear }).or(page.getByRole("radio", { name: birthYear }))), 350);
  await rec.hold(700);
  await shot("kids-filled");
  t = Date.now();
  await tap(page, visible(page.getByRole("button", { name: "Next", exact: true })), 350);
  await rec.skip(() => page.waitForURL(/\/start\/parent\/ready|practice|today/, { timeout: 30000 }).catch(() => {}));
  await page.waitForLoadState("networkidle").catch(() => {});
  timings.toReady = Date.now() - t;
  await shot("ready");
  problems.push(`after Next: ${page.url()}`);
  await rec.hold(1300);
  // Who's practicing first? Tap the child.
  const child = visible(page.getByRole("button", { name: new RegExp(childName) }).or(page.getByRole("link", { name: new RegExp(childName) })));
  if (await child.isVisible().catch(() => false)) {
    t = Date.now();
    await tap(page, child, 400);
    await rec.skip(() => bot.waitForProblem(30000));
    timings.toFirstProblem = Date.now() - t;
  }
  await shot("first-problem");
  problems.push(`practice url: ${page.url()}`);
  await rec.hold(600);
  for (let i = 0; i < Number(count); i++) {
    const r = await bot.answer(true, 1500);
    if (!r.ok) {
      problems.push(`answer ${i}: ${r.error}`);
      break;
    }
    await rec.skip(() => page.locator("button.next-action").filter({ visible: true }).first().waitFor({ timeout: 20000 }));
    await rec.hold(1600);
    if (i === 0) await shot("first-feedback");
    if (i < Number(count) - 1) {
      await bot.next(300);
      await rec.skip(() => bot.waitForProblem(30000));
      await rec.hold(400);
    }
  }
} catch (e) {
  problems.push(`take failed: ${String(e).slice(0, 400)}`);
  await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
} finally {
  await rec.stop().catch(() => {});
  await writeFile(`${dir}/run.json`, JSON.stringify({ timings, problems, url: page.url(), answers: bot.log, notes: bot.notes, shots }, null, 1));
  await writeFile(`${dir}/api.json`, JSON.stringify(api));
  console.log(JSON.stringify({ timings, problems, answers: bot.log.length }));
  await close();
}

/** Take 1 part B in another format, re-rendered from the live 9:16 run's
 * recorded API responses (replay.ts). No profile, no production writes.
 * Usage: getstarted-b-replay.ts OUTDIR FORMAT API_JSON [child] [year] */
import { writeFile } from "node:fs/promises";
import { Recorder, launchFor, tap, watchProblems, type Format } from "../recorder.ts";
import { installReplay } from "../replay.ts";
import { Bot } from "../bot.ts";
const [dir, format, apiJson, childName = "Maya", year = "2017"] = process.argv.slice(2) as [string, Format, string, string, string];
const { page, close } = await launchFor(format);
const problems: string[] = [];
watchProblems(page, problems);
const bot = new Bot(page);
await bot.install();
await installReplay(page, apiJson, problems); // registered last: answers first
const rec = new Recorder(page, dir, format);
const visible = (l: ReturnType<typeof page.locator>) => l.filter({ visible: true }).first();
try {
  await page.goto("https://amp.corpora.inc/start");
  await page.getByText("What brings you to AMP?").first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/r-start.png` });
  await rec.start();
  await rec.hold(1600);
  await tap(page, visible(page.getByRole("link", { name: /I’m a parent/ })), 400);
  await rec.skip(() => page.getByText("Add your kids").first().waitFor({ timeout: 20000 }));
  await rec.hold(700);
  await tap(page, page.getByRole("textbox", { name: /Name, Child 1/ }), 300);
  await page.keyboard.type(childName, { delay: 130 });
  await rec.hold(500);
  await tap(page, page.getByRole("button", { name: /^Birth year/ }), 300);
  await rec.hold(900);
  await tap(page, page.getByRole("option", { name: year, exact: true }), 350);
  await rec.hold(900);
  await page.screenshot({ path: `${dir}/r-kids.png` });
  await tap(page, page.getByRole("button", { name: "Next", exact: true }), 350);
  await rec.skip(async () => {
    await page.waitForURL((u) => u.pathname.startsWith("/practice/"), { timeout: 30000 });
    await bot.waitForProblem(30000);
    await page.waitForTimeout(800);
  });
  await rec.hold(500);
  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      await bot.next(250);
      await rec.skip(() => bot.waitForProblem(30000));
      await rec.hold(300);
    }
    const r = await bot.answer(true, i === 0 ? 900 : 1300, 170);
    if (!r.ok) {
      problems.push(`answer ${i}: ${r.error}`);
      break;
    }
    await rec.skip(() => page.locator("button.next-action").filter({ visible: true }).first().waitFor({ timeout: 20000 }));
    await rec.hold(1800);
    await page.screenshot({ path: `${dir}/r-fb-${i}.png` });
  }
} catch (e) {
  problems.push(`take failed: ${String(e).slice(0, 400)}`);
  await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
} finally {
  await rec.stop().catch(() => {});
  await writeFile(`${dir}/run.json`, JSON.stringify({ problems, url: page.url(), answers: bot.log }, null, 1));
  console.log(JSON.stringify({ problems, answers: bot.log.map((l) => [l.templateId, l.correct, l.result]) }));
  await close();
}

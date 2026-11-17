/** Take 2 in another format, re-rendered from the live 9:16 speed run's
 * recorded API responses (replay.ts): the same problems, the same answers
 * (correct or the same slip), no production writes. Problems listed in
 * HIDE are answered off camera (cut), matching the 9:16 edit.
 * Usage: speedrun-replay.ts OUTDIR FORMAT LIVE_DIR PRACTICE_URL HIDE(csv) */
import { readFile, writeFile } from "node:fs/promises";
import { Recorder, launchFor, watchProblems, type Format } from "../recorder.ts";
import { installReplay } from "../replay.ts";
import { Bot } from "../bot.ts";
const [dir, format, live, url, hideCsv = ""] = process.argv.slice(2) as [string, Format, string, string, string];
const hide = new Set(hideCsv.split(",").filter(Boolean).map(Number));
const { answers } = JSON.parse(await readFile(`${live}/answers.json`, "utf8"));
const { page, close } = await launchFor(format);
const problems: string[] = [];
watchProblems(page, problems);
const bot = new Bot(page);
await bot.install();
await installReplay(page, `${live}/api.json`, problems);
const rec = new Recorder(page, dir, format);
try {
  await page.goto(url);
  await bot.waitForProblem(30000);
  await page.waitForTimeout(1200);
  await rec.start();
  await rec.hold(700);
  for (let i = 0; i < answers.length; i++) {
    const off = hide.has(i);
    if (off) rec.beginSkip();
    if (i > 0) {
      await bot.next(150);
      await rec.skip(() => bot.waitForProblem(30000));
      await rec.hold(200);
    }
    const r = await bot.answer(answers[i].intended, off ? 200 : 800 + Math.round(Math.random() * 400), off ? 30 : 110);
    if (!r.ok) {
      problems.push(`answer ${i}: ${r.error}`);
      break;
    }
    await rec.skip(() => page.locator("button.next-action").filter({ visible: true }).first().waitFor({ timeout: 20000 }));
    if (!answers[i].intended) {
      await rec.hold(2000);
      await page.evaluate(`(() => { const el = document.querySelector('.feedback-steps'); if (el && el.scrollHeight > el.clientHeight) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); })()`);
      await rec.hold(2400);
    } else await rec.hold(1200);
    await page.screenshot({ path: `${dir}/r-${i}.png` });
    if (off) rec.endSkip();
  }
} catch (e) {
  problems.push(`take failed: ${String(e).slice(0, 400)}`);
  await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {});
} finally {
  await rec.stop().catch(() => {});
  await writeFile(`${dir}/run.json`, JSON.stringify({ problems, answers: bot.log }, null, 1));
  console.log(JSON.stringify({ problems, answers: bot.log.map((l) => [l.skillId, l.correct, (l.result as any)?.correct]) }));
  await close();
}

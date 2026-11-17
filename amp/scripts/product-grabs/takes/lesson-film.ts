/** Extra take: a skill's lesson film from Pathways, signed out.
 * Usage: lesson-film.ts OUTDIR FORMAT [skill] [seconds] */
import { writeFile } from "node:fs/promises";
import { Recorder, launchFor, tap, watchProblems, type Format } from "../recorder.ts";
const [dir, format, skill = "equivalent-fractions", seconds = "14"] = process.argv.slice(2) as [string, Format, string, string];
const { page, close } = await launchFor(format);
const problems: string[] = [];
watchProblems(page, problems);
const timings: Record<string, number> = {};
const rec = new Recorder(page, dir, format);
await page.goto(`https://amp.corpora.inc/pathways?open=skill%3A${skill}`, { waitUntil: "networkidle" });
await page.getByRole("dialog").first().waitFor();
await rec.start();
await rec.hold(1600);
const film = page.getByRole("dialog").getByRole("link", { name: /lesson film/ }).first();
let t = Date.now();
await tap(page, film, 400);
await rec.skip(async () => {
  await page.getByRole("button", { name: "Play lesson film" }).first().waitFor({ timeout: 20000 }).catch(() => {});
});
timings.toPlayer = Date.now() - t;
problems.push(`player url: ${page.url()}`);
await rec.hold(500);
const play = page.getByRole("button", { name: "Play lesson film" }).first();
if (await play.isVisible().catch(() => false)) await tap(page, play, 300);
await rec.hold(Number(seconds) * 1000);
await rec.stop();
await writeFile(`${dir}/run.json`, JSON.stringify({ timings, problems, url: page.url() }, null, 1));
console.log(JSON.stringify({ timings, problems }));
await close();

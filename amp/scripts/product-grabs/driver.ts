/**
 * A long-lived recording session driven step by step: launch one browser for
 * a format (optionally a signed-in profile), keep the screencast running, and
 * run command snippets dropped into DIR/cmd.js (see send.ts). Each command's
 * result and a screenshot are written next to it. Lets a take be built and
 * reviewed one step at a time while the footage keeps rolling.
 *   driver.ts DIR FORMAT PROFILE|none [light|dark] [record=1]
 */
import { readFile, rename, writeFile, access } from "node:fs/promises";
import { homedir } from "node:os";
import { Recorder, launchFor, tap, glide, watchProblems, logApi, type Format } from "./recorder.ts";
import { Bot, slip } from "./bot.ts";
const [dir, format, profile, scheme = "light", record = "1"] = process.argv.slice(2) as [string, Format, string, "light" | "dark", string];
const { page, context, close } = await launchFor(format, {
  colorScheme: scheme,
  profile: profile === "none" ? undefined : `${homedir()}/.config/corpora/amp-video/profiles/${profile}`,
});
const problems: string[] = [];
const api: any[] = [];
watchProblems(page, problems);
logApi(page, api);
const bot = new Bot(page);
await bot.install();
const rec = new Recorder(page, dir, format);
const visible = (l: any) => l.filter({ visible: true }).first();
const state: Record<string, unknown> = {};
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
await writeFile(`${dir}/.ready`, String(Date.now())).catch(async () => {
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/.ready`, String(Date.now()));
});
let n = 0;
let recording = false;
for (;;) {
  const cmdPath = `${dir}/cmd.js`;
  try {
    await access(cmdPath);
  } catch {
    await new Promise((r) => setTimeout(r, 150));
    continue;
  }
  const code = await readFile(cmdPath, "utf8");
  n++;
  await rename(cmdPath, `${dir}/cmd-${n}.js`);
  if (code.trim() === "__stop__") break;
  const t0 = Date.now();
  let result: unknown, error: string | undefined;
  try {
    if (record === "1" && !recording && /rec\.start\(\)/.test(code)) recording = true;
    const fn = new AsyncFunction("page", "context", "rec", "bot", "tap", "glide", "visible", "state", "slip", "problems", code);
    result = await fn(page, context, rec, bot, tap, glide, visible, state, slip, problems);
  } catch (e) {
    error = String(e).slice(0, 1500);
  }
  await page.screenshot({ path: `${dir}/shot-${n}.png` }).catch(() => {});
  await writeFile(
    `${dir}/out-${n}.json`,
    JSON.stringify({ n, ms: Date.now() - t0, url: page.url(), result, error, problems: problems.splice(0) }, null, 1),
  );
}
await rec.stop().catch(() => {});
await writeFile(`${dir}/api.json`, JSON.stringify(api));
await writeFile(`${dir}/answers.json`, JSON.stringify({ answers: bot.log, notes: bot.notes }, null, 1));
await close();

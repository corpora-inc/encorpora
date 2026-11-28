#!/usr/bin/env node
/**
 * A draft screen recording for reviewers: the real-pack preview driven at a
 * pace a person can follow, 1280×800, light theme, one continuous video.
 *
 *   MAINT_REAL=1 scripts/loop.sh            (fresh device records and hub)
 *   node scripts/record-walkthrough.mjs [out.mp4]
 *   MAINT_REAL=1 scripts/loop.sh            (afterwards: the preview back to its normal fresh state)
 *
 * Device A's app on 4340 (MAINT_UI_BASE), device B's on 4343 (MAINT_UI_BASE_B): the same page
 * visits both, so the whole run is one video. Writes an H.264 MP4 when ffmpeg is installed,
 * else leaves the WebM. Re-run it whenever the content changes.
 */
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../../../amp/browser-security.mjs";

const A = process.env.MAINT_UI_BASE ?? "http://127.0.0.1:4340";
const B = process.env.MAINT_UI_BASE_B ?? "http://127.0.0.1:4343";
const out = path.resolve(process.argv[2] ?? "walkthrough.mp4");
const MESSAGE = "PreArm: Compass 2 not healthy";
const SIZE = { width: 1280, height: 800 };
// Pauses scale with MAINT_PACE (1.5: about two and a half minutes).
const PACE = Number(process.env.MAINT_PACE ?? 1.5);

const dir = await mkdtemp(path.join(tmpdir(), "maint-walkthrough-"));
const browser = await secureChromium(rawChromium).launch();
const context = await browser.newContext({ viewport: SIZE, colorScheme: "light", recordVideo: { dir, size: SIZE } });
context.setDefaultTimeout(30_000);
const page = await context.newPage();
const hold = (ms = 1600) => page.waitForTimeout(ms * PACE);
const type = (loc, text) => loc.pressSequentially(text, { delay: 55 });
const settle = async (ms) => {
  await page.waitForLoadState("networkidle").catch(() => {});
  await hold(ms);
};
const scrollTo = async (loc, ms = 1600) => {
  await loc.scrollIntoViewIfNeeded();
  await hold(ms);
};

try {
  // The fleet, then the boat.
  await page.goto(`${A}/`);
  await settle(2000);
  await page.getByText("Survey boat 7").first().click();
  await settle(1800);

  // Connect to vehicle: the message the boat shows, the manual's entry, Start.
  await page.getByRole("link", { name: "Connect to vehicle" }).click();
  await settle(1200);
  await page.getByRole("radio", { name: "Typed" }).click();
  await type(page.getByLabel("Code or message"), MESSAGE);
  await hold(600);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const start = page.getByRole("button", { name: "Start here" }).first();
  await start.waitFor();
  await hold(2200);
  await start.click();

  // The steps to the corrective action.
  await page.getByText("Step 1, symptom").waitFor();
  await settle(1800);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByText(/^Step 2, /).first().waitFor();
  await settle(2000);
  await page.getByRole("link", { name: "Do the corrective action" }).click();
  const jobId = page.url().match(/\/jobs\/([^/]+)/)?.[1];

  // Close-out: the action done, the fix checked, the lesson.
  await page.getByRole("button", { name: "Corrective action done" }).waitFor();
  await settle(1800);
  await page.getByRole("button", { name: "Corrective action done" }).click();
  await page.getByRole("heading", { name: "Did it fix it?" }).waitFor();
  await hold(1400);
  await page.getByRole("button", { name: "Fixed", exact: true }).click();
  await page.getByLabel("Verified cause").waitFor();
  await hold(1200);
  const causes = page.getByRole("group", { name: "Possible problems from the manual" }).getByRole("button");
  if (await causes.count()) await causes.first().click();
  else await type(page.getByLabel("Verified cause"), "Compass 2 cable loose at the autopilot");
  await type(page.getByLabel("Your note"), "Compass 2 cable was loose at the autopilot. Reseated it, then checked the compass settings.");
  await hold(1600);
  await page.getByRole("button", { name: "Save lesson and close" }).click();
  await page.getByRole("heading", { name: "Job closed" }).waitFor();
  await settle(2000);

  // Sync, then the hub: sign in, edit the note, approve, send to the fleet.
  await page.goto(`${A}/records`);
  await settle(1000);
  await page.getByRole("button", { name: "Sync now" }).click();
  await page.getByText(/^Sent \d+\./).waitFor();
  await hold(1800);
  await page.goto(`${A}/review`);
  await settle(1000);
  await type(page.getByLabel("Hub sign-in token"), "dev-supervisor-token");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("Signed in as").waitFor();
  await hold(1600);
  await page.getByRole("link", { name: /Compass X not healthy/ }).first().click();
  const note = page.getByLabel("Field note for the fleet");
  await note.waitFor();
  await hold(1600);
  await note.fill("");
  await type(note, "Before changing settings, reseat the compass 2 cable at the autopilot: on this boat a loose cable was the cause.");
  await hold(1600);
  await page.getByRole("button", { name: "Approve with edits" }).click();
  await page.getByText("Approved.").waitFor();
  await hold(1400);
  await page.getByRole("button", { name: "Send to the fleet" }).click();
  await page.getByText(/Sent to the fleet/).waitFor();
  await hold(2000);

  // Device B syncs; the same message on its boat shows the field note, apart from the manual.
  await page.goto(`${B}/records`);
  await settle(1000);
  await page.getByRole("button", { name: "Sync now" }).click();
  await page.getByText(/Received [1-9]\d* field note/).waitFor();
  await hold(1800);
  await page.goto(`${B}/units/boat-7/connect`);
  await settle(800);
  await page.getByRole("radio", { name: "Typed" }).click();
  await type(page.getByLabel("Code or message"), MESSAGE);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Start here" }).first().click();
  await page.getByText("Step 1, symptom").waitFor();
  await settle(1000);
  await scrollTo(page.locator("section.field").first(), 2800);

  // The pump: describe the problem, a measured value on the keypad, the original page.
  await page.goto(`${A}/`);
  await settle(1200);
  await page.getByRole("link", { name: /Pump 101/ }).first().click();
  await page.getByRole("heading", { name: "Pump 101" }).waitFor();
  await settle(1600);
  await page.getByRole("link", { name: "Troubleshoot" }).click();
  await type(page.getByLabel("Describe the problem"), "engine does not crank");
  const hit = page.getByRole("button", { name: /Engine will not crank/ }).first();
  await hit.waitFor();
  await hold(1800);
  await hit.click();
  await page.getByText("Step 1, symptom").waitFor();
  await settle(1400);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByText("Step 2, check").waitFor();
  await settle(1600);
  await page.getByRole("button", { name: /^yes$/i }).click();
  await page.getByText("Step 3, check").waitFor();
  await settle(1200);
  const pad = page.getByRole("group", { name: "Measured value", exact: true }).first();
  for (const k of "12.7") {
    await pad.getByRole("button", { name: k === "." ? "Decimal point" : k, exact: true }).click();
    await hold(350);
  }
  await hold(1400);
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.getByText("Step 4, check").waitFor();
  await settle(1600);
  await page.getByRole("link", { name: /^Page / }).first().click();
  await settle(3000);
  await page.getByRole("link", { name: "Close" }).first().click();
  await settle(1000);

  // Reference: the fault-code table and a lookup.
  await page.goto(`${A}/manual`);
  await settle(1400);
  await page.getByRole("link", { name: /Reference tables/ }).first().click();
  await settle(1600);
  await page.getByRole("link", { name: /Displayed fault codes/ }).first().click();
  await settle(2000);
  await page.getByRole("link", { name: "Reference", exact: true }).click();
  await settle(600);
  await type(page.getByLabel("Look up a code, item or term"), "E21");
  await page.getByRole("button", { name: "Look up" }).click();
  await page.getByRole("region", { name: /E21/ }).first().waitFor();
  await hold(2200);

  // Learn: one practice question, its rationale opening the manual.
  await page.goto(`${A}/learn`);
  await settle(1600);
  // The pump manual's practice, the unit just worked on.
  await page.locator('a[href$="/practice"][href*="pump"]').first().or(page.getByRole("link", { name: /^Practice/ }).first()).first().click();
  const choices = page.getByRole("list", { name: "Choices" });
  await choices.waitFor();
  await hold(2200);
  await choices.getByRole("button").first().click();
  await hold(2200);
  await choices.getByRole("link").first().click();
  await settle(2200);

  // Records: sources and licenses, the audit chain checked.
  await page.goto(`${A}/records`);
  await settle(1200);
  await scrollTo(page.getByText("Sources", { exact: true }).first(), 2200);
  await page.getByRole("button", { name: "Check the chain" }).click();
  await page.getByText(/Intact, \d+ entries/).waitFor();
  await scrollTo(page.getByText(/Intact, \d+ entries/), 2000);

  // The print view of the finished job.
  if (jobId) {
    await page.goto(`${A}/print/job/${jobId}`);
    await settle(3000);
  }
} catch (e) {
  await page.screenshot({ path: out.replace(/\.mp4$/, "-failed.png") }).catch(() => {});
  console.error(`walkthrough stopped at ${page.url()}`);
  throw e;
} finally {
  const video = page.video();
  await context.close();
  await browser.close();
  const webm = video ? await video.path() : null;
  if (webm) {
    await mkdir(path.dirname(out), { recursive: true });
    let ffmpeg = true;
    try {
      execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    } catch {
      ffmpeg = false;
    }
    if (ffmpeg) {
      execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", webm, "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out]);
      console.log(`walkthrough: ${out}`);
    } else {
      const w = out.replace(/\.mp4$/, ".webm");
      await copyFile(webm, w);
      console.log(`walkthrough: ${w} (ffmpeg not installed: left as WebM)`);
    }
  }
}

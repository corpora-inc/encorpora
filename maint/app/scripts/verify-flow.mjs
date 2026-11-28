#!/usr/bin/env node
/**
 * The whole job, end to end, in a real browser against the real engine
 * (`harvest serve` on the Model 40 fixture, with a fresh records file):
 *
 *   fleet (empty) -> import the fleet file -> unit -> describe -> guided steps
 *   (a measured value, then change the last answer) -> corrective action with
 *   its task run -> did it fix it -> lesson -> saved; install the field-note
 *   bundle; a second job shows the approved field note in its own panel.
 *
 * Along the way: refresh restores the step, back and forward work, the
 * result bar is reachable without scrolling at every width it pins at, and
 * nothing shifts when a result is recorded.
 *
 *   MAINT_UI_BASE=http://127.0.0.1:4340 MAINT_SAMPLES=.engine/pump40-samples node scripts/verify-flow.mjs
 */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../../../amp/browser-security.mjs";

const chromium = secureChromium(rawChromium);
const root = fileURLToPath(new URL("..", import.meta.url));
const base = process.env.MAINT_UI_BASE ?? "http://127.0.0.1:4340";
const samples = process.env.MAINT_SAMPLES ?? path.join(root, ".engine", "pump40-samples");
const out = process.env.CI ? path.join(root, "artifacts", "flow") : path.join(root, ".screens", "flow");
await mkdir(out, { recursive: true });

const browser = await chromium.launch();
let n = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const shot = async (name) => page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`), fullPage: true });
  const settle = () => page.waitForLoadState("networkidle");
  // The keypad, key by key, as a gloved hand would.
  const typeValue = async (v) => {
    const pad = page.getByRole("group", { name: "Measured value", exact: true }).first();
    for (const k of v) await pad.getByRole("button", { name: k === "." ? "Decimal point" : k, exact: true }).click();
  };

  // First run: an empty fleet goes straight to adding a unit; the fleet file comes in through Records.
  await page.goto(`${base}/`);
  await settle();
  await page.getByRole("heading", { name: "Add the unit you are working on" }).waitFor();
  await shot("first-run");
  await page.goto(`${base}/records`);
  await page.locator("input[type=file]").nth(1).setInputFiles(path.join(samples, "assets.json"));
  await page.getByText(/Added 3 and updated 0 units/).waitFor();

  // Identify a new unit from its plate.
  await page.goto(`${base}/units/new/type`);
  await page.getByLabel("Serial number").fill("P40E-2001");
  await page.getByRole("button", { name: "Identify" }).click();
  await page.getByText("Model 40 electric").first().waitFor();
  await page.getByText(/matches/).first().waitFor();
  await shot("identify-resolved");

  // The diesel unit from the fleet file.
  await page.goto(`${base}/`);
  await page.getByText("Pump 101").first().click();
  await page.getByRole("heading", { name: "Pump 101" }).waitFor();
  await shot("unit");
  await page.getByRole("link", { name: "Troubleshoot" }).click();
  await page.getByLabel("Describe the problem").fill("engine does not crank");
  const hit = page.getByRole("button", { name: /Engine will not crank/ }).first();
  await hit.waitFor();
  await shot("describe");
  await hit.click();

  // Step 1: the symptom. The plate shows the unit and its variant throughout.
  await page.getByText("Step 1, symptom").waitFor();
  assert.match(await page.locator("a.plate").first().innerText(), /Pump 101[\s\S]*Model 40 diesel/);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByText("Step 2, check").waitFor();

  // Refresh restores the step.
  await page.reload();
  await page.getByText("Step 2, check").waitFor();
  await shot("step-check");

  // Recording a result moves nothing above the controls before the next step arrives.
  const header = page.getByRole("heading", { level: 1 });
  const before = await header.boundingBox();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await page.getByText("Step 3, check").waitFor();
  const after = await header.boundingBox();
  assert.ok(Math.abs(before.y - after.y) < 0.5, "the step header moved when a result was recorded");

  // A measured value through the keypad.
  await typeValue("10.8");
  await shot("step-value");
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.getByText("Replace the battery. Refer to task 4-3.").waitFor();
  await shot("step-action");

  // Change the last answer: back to the measurement, which takes another branch.
  await page.getByRole("button", { name: "Change last answer" }).click();
  await page.getByText("Step 3, check").waitFor();
  await typeValue("10.9");
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await page.getByText("Replace the battery. Refer to task 4-3.").waitFor();

  // Corrective action: the task, step by step, recorded as a run.
  await page.getByRole("link", { name: "Do the corrective action" }).click();
  await page.getByRole("heading", { name: "Battery replacement (task 4-3)" }).waitFor();
  const passes = page.getByRole("button", { name: "Pass", exact: true });
  for (let i = 0, c = await passes.count(); i < c; i++) {
    await passes.nth(i).click();
    await page.waitForTimeout(150);
  }
  const record = page.getByRole("button", { name: "Record", exact: true });
  if (await record.count()) {
    await page.getByLabel("Recorded value").fill("2611");
    await record.click();
  }
  await shot("closeout-action");
  await page.getByRole("button", { name: "Corrective action done" }).click();
  await page.getByRole("heading", { name: "Did it fix it?" }).waitFor();
  await page.getByRole("button", { name: "Fixed", exact: true }).click();

  // The lesson, prefilled from the session: the manual's action and the task's parts.
  await page.getByLabel("Verified cause").waitFor();
  assert.equal(await page.getByLabel("Action taken").inputValue(), "Replace the battery. Refer to task 4-3.");
  await page.getByRole("button", { name: "Battery discharged." }).click();
  await page.getByLabel("Note for the next technician").fill("Battery date code three years old.");
  await shot("closeout-lesson");
  await page.getByRole("button", { name: "Save lesson and close" }).click();
  await page.getByRole("heading", { name: "Job closed" }).waitFor();
  await page.getByText("Waiting to sync").waitFor();
  await shot("closeout-saved");

  // Back and forward still land on real screens.
  await page.goBack();
  await page.waitForURL(/\/jobs\//);
  await page.goForward();
  await settle();

  // Field notes arrive as a signed bundle; then a second job on the same tree shows them, apart from the manual.
  await page.goto(`${base}/records`);
  await page.locator("input[type=file]").nth(0).setInputFiles(path.join(samples, "field-bundle.json"));
  await page.getByText(/Installed \d+ field note/).waitFor();
  await page.goto(`${base}/units/unit-101/troubleshoot`);
  await page.getByRole("button", { name: "Pump overheats" }).click();
  await page.getByText("Step 1, symptom").waitFor();
  const notes = page.locator("section.field");
  await notes.first().waitFor();
  assert.match(await notes.first().innerText(), /Not part of the manual/);
  assert.equal(await notes.first().locator(".manual-text").count(), 0, "field notes must never be set as manual text");
  await shot("second-pass-field-notes");

  // The audit trail recorded it all and its chain is intact.
  await page.goto(`${base}/records`);
  await page.getByRole("button", { name: "Check the chain" }).click();
  await page.getByText(/Intact, \d+ entries/).waitFor();
  await shot("records");

  // The result controls stay within reach on narrow and portrait screens.
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${base}/`);
    await page.getByRole("link", { name: /Continue/ }).first().click();
    await page.getByText(/^Step \d+, /).first().waitFor();
    await settle();
    const bar = page.getByLabel("Record the result");
    const box = await bar.boundingBox();
    assert.ok(box && box.y + box.height <= 844 + 0.5 && box.y >= 0, `result bar not on screen at ${width}px (${JSON.stringify(box)})`);
    await shot(`pinned-${width}`);
  }

  assert.deepEqual(errors, [], `console errors: ${errors.join(" | ")}`);
  console.log(`verify-flow: the whole job ran end to end (${n} screenshots in ${out})`);
} finally {
  await browser.close();
}

#!/usr/bin/env node
/**
 * The whole job, end to end, in a real browser against the real engine
 * (`harvest serve` on the Model 40 fixture, with a fresh records file):
 *
 *   device A: fleet (empty) -> import the fleet file -> unit -> describe ->
 *   guided steps (a measured value, then change the last answer) -> corrective
 *   action with its task run -> did it fix it -> lesson -> saved -> Sync;
 *   hub: Review -> approve with an edit -> send to the fleet;
 *   device B (a unit that never did the job): Sync -> the same symptom shows
 *   the approved note in the field-note panel; device A sees it too.
 *   device C was never enrolled: its uploads stay queued and Records says why.
 *   Also: a field-note bundle installed from a file, a goto into another
 *   table, connect to vehicle, and voice input.
 *
 * Along the way: refresh restores the step, back and forward work, the
 * result bar is reachable without scrolling at every width it pins at, and
 * nothing shifts when a result is recorded.
 *
 *   MAINT_IMPORT=B scripts/loop.sh          (hub 4319, device A 4317, device B 4320)
 *   npm run dev & npm run dev:b             (apps for A on 4340 and B on 4343)
 *   node scripts/verify-flow.mjs            (MAINT_UI_BASE / MAINT_UI_BASE_B to point elsewhere)
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
const baseB = process.env.MAINT_UI_BASE_B ?? "http://127.0.0.1:4343";
const baseC = process.env.MAINT_UI_BASE_C ?? "http://127.0.0.1:4345";
const samples = process.env.MAINT_SAMPLES ?? path.join(root, ".engine", "pump40-samples");
const out = process.env.CI ? path.join(root, "artifacts", "flow") : path.join(root, ".screens", "flow");
await mkdir(out, { recursive: true });

/**
 * A stand-in for the native shell, so on-device voice input runs in the browser
 * check: engine calls go through the native `engine_call` command (answered
 * here over HTTP), and the STT plugin hears a short spoken sentence.
 */
const fakeNative = (said) => {
  const callbacks = new Map();
  const listeners = {};
  let nextId = 1;
  const emit = (event, message) => {
    for (const l of listeners[event] ?? []) callbacks.get(l.id)?.({ message, index: l.index++ });
  };
  window.__TAURI_INTERNALS__ = {
    transformCallback: (cb) => {
      const id = nextId++;
      callbacks.set(id, cb);
      return id;
    },
    unregisterCallback: (id) => callbacks.delete(id),
    invoke: async (cmd, args) => {
      switch (cmd) {
        case "engine_call": {
          const r = await fetch(`/api/${args.method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(args.params ?? {}) });
          return r.json();
        }
        case "voice_model": return { status: "ready", file: "ggml-test.bin" };
        case "plugin:stt|is_available": return true;
        case "plugin:stt|validate_model": return { valid: true };
        case "plugin:stt|prepare": return { ready: true };
        case "plugin:stt|register_listener": (listeners[args.event] ??= []).push({ id: args.handler.id, index: 0 }); return null;
        case "plugin:stt|remove_listener": return null;
        case "plugin:stt|start_session": {
          let t = 0;
          window.__sttTimer = setInterval(() => {
            t += 125;
            emit("audio_level", { rms: t < 500 ? 0.03 : t < 2000 ? 0.2 : 0.03, t });
            if (t > 6000) clearInterval(window.__sttTimer);
          }, 125);
          return { started: true };
        }
        case "plugin:stt|stop_session": clearInterval(window.__sttTimer); return { text: said };
        case "plugin:stt|cancel_session": clearInterval(window.__sttTimer); return null;
        case "plugin:tts|stop": return null;
        case "plugin:tts|list_voices": return [];
        case "plugin:corpan-llm|llm_status": return { loaded: false, modelId: null };
        default: throw `unexpected command ${cmd}`;
      }
    },
  };
};

const browser = await chromium.launch();
let n = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  // Grow the viewport to the page so fixed bars sit where they do on a device, then shoot it.
  const shot = async (name) => {
    const vp = page.viewportSize();
    const full = await page.evaluate(() => document.documentElement.scrollHeight);
    if (full > vp.height) await page.setViewportSize({ width: vp.width, height: full });
    await page.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-${name}.png`) });
    if (full > vp.height) await page.setViewportSize(vp);
  };
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
  // The model (the scripted endpoint in tests) is set up for this device, so its use starts on;
  // a person can turn it off, and the choice is remembered across a reload.
  const useModel = page.getByRole("radiogroup", { name: "Use the model" });
  assert.equal(await useModel.getByRole("radio", { name: "On" }).getAttribute("aria-checked"), "true");
  await useModel.getByRole("radio", { name: "Off" }).click();
  await page.reload();
  assert.equal(await useModel.getByRole("radio", { name: "Off" }).getAttribute("aria-checked"), "true");
  await useModel.getByRole("radio", { name: "On" }).click();
  await page.locator('[data-reachable="unknown"]').waitFor();

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
  // The note fills the form through the model: a pick among the manual's causes and a time come back
  // marked Suggested; the model's own words (an "other" action, a note) never appear.
  await page.getByLabel("Your note").fill("Battery let go, date code three years old. Took 25 minutes.");
  await page.getByRole("button", { name: "Fill the form from my note" }).click();
  await page.locator('[data-suggested="minutes"]').waitFor();
  assert.ok(await page.locator('[data-suggested="cause"]').count(), "the cause is marked Suggested");
  assert.equal(await page.getByText("MODEL TEXT").count(), 0, "a model's own words reached the screen");
  assert.equal(await page.getByLabel("Action taken").inputValue(), "Replace the battery. Refer to task 4-3.");
  await shot("closeout-prefill");
  // Picking a cause confirms it; the time is still only suggested, so saving asks once, inline.
  await page.getByRole("button", { name: "Battery discharged." }).click();
  assert.equal(await page.locator('[data-suggested="cause"]').count(), 0);
  await page.getByRole("button", { name: "Save lesson and close" }).click();
  await page.getByRole("group", { name: "Confirm the suggested fields" }).getByText("Time").waitFor();
  await shot("closeout-confirm");
  await page.getByRole("button", { name: "Confirm and save" }).click();
  await page.getByRole("heading", { name: "Job closed" }).waitFor();
  await page.getByText("Waiting to sync").waitFor();
  await shot("closeout-saved");

  // Back and forward still land on real screens.
  await page.goBack();
  await page.waitForURL(/\/jobs\//);
  await page.goForward();
  await settle();

  // Sync: the lesson and the job go to the hub.
  await page.goto(`${base}/records`);
  await page.getByRole("button", { name: "Sync now" }).click();
  await page.getByText(/^Sent \d+\./).waitFor();

  // The hub: review the lesson, edit the note, approve, send to the fleet.
  const NOTE = "Check the battery date code first: on this pump, a battery over three years old was the cause.";
  await page.goto(`${base}/review`);
  await page.getByLabel("Hub sign-in token").fill("dev-supervisor-token");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("Signed in as").waitFor();
  assert.match(await page.getByText("Signed in as").innerText(), /Shop supervisor.*admin/);
  await page.getByRole("link", { name: /Engine will not crank/ }).first().click();
  await page.getByRole("heading", { name: "Field note for the fleet" }).waitFor();
  await page.getByLabel("Field note for the fleet").fill(NOTE);
  await shot("review");
  await page.getByRole("button", { name: "Approve with edits" }).click();
  await page.getByText("Approved.").waitFor();
  await page.getByRole("button", { name: "Send to the fleet" }).click();
  await page.getByText(/Sent to the fleet/).waitFor();
  await shot("review-sent");

  // Device B never did this job. After a sync, the same symptom on its unit shows the note, apart from the manual.
  const pageB = await context.newPage();
  pageB.on("pageerror", (e) => errors.push(`B: ${e.message}`));
  pageB.on("console", (m) => m.type() === "error" && errors.push(`B: ${m.text()}`));
  await pageB.goto(`${baseB}/records`);
  await pageB.getByRole("button", { name: "Sync now" }).click();
  await pageB.getByText(/Received [1-9]\d* field note/).waitFor();
  await pageB.goto(`${baseB}/units/unit-102/troubleshoot`);
  await pageB.getByLabel("Describe the problem").fill("engine does not crank");
  await pageB.getByRole("button", { name: /Engine will not crank.*Matched/ }).first().click();
  await pageB.getByText("Step 1, symptom").waitFor();
  const notesB = pageB.locator("section.field");
  await notesB.first().waitFor();
  assert.match(await notesB.first().innerText(), /battery date code first/);
  assert.match(await notesB.first().innerText(), /Not part of the manual/);
  assert.equal(await notesB.first().locator(".manual-text").count(), 0, "field notes must never be set as manual text");
  await pageB.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-device-b-field-note.png`), fullPage: true });
  await pageB.close();

  // A reviewer without the publisher role is never offered "Send to the fleet"; the admin sees Devices.
  assert.equal(await page.getByRole("heading", { name: "Devices" }).count(), 1);
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.getByLabel("Hub sign-in token").fill("dev-reviewer-only-token");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("Signed in as").waitFor();
  assert.equal(await page.getByRole("button", { name: "Send to the fleet" }).count(), 0);
  assert.equal(await page.getByRole("heading", { name: "Devices" }).count(), 0);

  // Device C was never enrolled: what it records stays queued, and Records says why in plain words.
  const pageC = await context.newPage();
  pageC.on("pageerror", (e) => errors.push(`C: ${e.message}`));
  await pageC.goto(`${baseC}/units/unit-101/troubleshoot`);
  await pageC.getByRole("button", { name: "Pump overheats" }).click();
  await pageC.getByRole("button", { name: "Continue", exact: true }).click();
  await pageC.getByRole("button", { name: "No", exact: true }).click();
  await pageC.getByRole("link", { name: "Do the corrective action" }).click();
  await pageC.getByRole("button", { name: "Corrective action done" }).click();
  await pageC.getByRole("button", { name: "Fixed", exact: true }).click();
  await pageC.getByLabel("Verified cause").fill("Strainer blocked with silt");
  await pageC.getByRole("button", { name: "Save lesson and close" }).click();
  await pageC.getByRole("heading", { name: "Job closed" }).waitFor();
  await pageC.goto(`${baseC}/records`);
  await pageC.getByRole("button", { name: "Sync now" }).click();
  await pageC.getByText(/does not accept uploads from this device yet/).first().waitFor();
  await pageC.getByText("Not enrolled").first().waitFor();
  const waiting = await pageC.getByText("Waiting in all").locator("xpath=following-sibling::dd[1]").innerText();
  assert.ok(Number(waiting) >= 1, `device C should keep its uploads queued (${waiting})`);
  await pageC.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-device-c-not-enrolled.png`), fullPage: true });
  await pageC.close();

  // A goto: the manual sends the job into another table; the jump is a step on the path.
  await page.goto(`${base}/units/unit-101/troubleshoot`);
  await page.getByLabel("Describe the problem").fill("engine does not crank");
  await page.getByRole("button", { name: /Engine will not crank.*Matched/ }).first().click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByText("Step 2, check").waitFor();
  await page.getByRole("button", { name: "No", exact: true }).click();
  await page.getByRole("button", { name: "Temperature lamp on" }).click();
  await page.getByRole("button", { name: "Continue in Pump overheats" }).click();
  await page.getByRole("heading", { name: "Pump overheats", level: 1 }).waitFor();
  assert.match(await page.locator("aside[aria-label=Job]").innerText(), /Go to Pump overheats/);
  await shot("goto-followed");

  // A field-note bundle can also arrive on a drive: installed from a file, it shows on its table (Pump overheats).
  await page.goto(`${base}/records`);
  await page.locator("input[type=file]").nth(0).setInputFiles(path.join(samples, "field-bundle.json"));
  await page.getByText(/Installed \d+ field note/).waitFor();
  await page.goto(`${base}/units/unit-101/troubleshoot`);
  await page.getByRole("button", { name: "Pump overheats" }).click();
  await page.getByText("Step 1, symptom").waitFor();
  const notes = page.locator("section.field");
  await notes.first().waitFor();
  assert.match(await notes.first().innerText(), /silty water/);
  await shot("second-pass-field-notes");

  // The audit trail recorded it all and its chain is intact.
  await page.goto(`${base}/records`);
  await page.getByRole("button", { name: "Check the chain" }).click();
  await page.getByText(/Intact, \d+ entries/).waitFor();
  await shot("records");

  // Connect to vehicle with no link on this device: a pasted log; the engine says what each code is and where to start.
  await page.goto(`${base}/units/unit-101`);
  await page.getByRole("link", { name: "Connect to vehicle" }).click();
  await page.getByRole("radio", { name: "Recorded" }).click();
  await page.getByLabel("Recorded log").fill("(1700000000.000000) can0 18FECA00#0401A8000101FFFF\n");
  await page.getByRole("button", { name: "Read the log" }).click();
  await page.getByText("SPN 168", { exact: true }).waitFor();
  await page.getByText("Battery voltage low").first().waitFor();
  await page.getByRole("radio", { name: "Typed" }).click();
  await page.getByLabel("Code or message").fill("engine running hot");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText(/No exact entry for/).waitFor();
  await page.getByText("Closest entries in this manual:").waitFor();
  await shot("connect-codes");
  await page.goto(`${base}/units/unit-101`);
  await page.getByText("Battery voltage low").first().waitFor();
  await page.getByRole("link", { name: "Connect to vehicle" }).click();
  await page.getByRole("button", { name: "Start here" }).first().click();
  await page.getByText(/^Step \d+, check/).waitFor();
  assert.match(await page.locator("article").first().innerText(), /battery voltage/i);

  // A code that is a reference-table row, scoped by a statement the unit cannot answer yet: the row
  // shows with the manual's statement and asks for the attribute in place; a value that is not a
  // version is refused next to the field; a good one is kept and the row re-reads as applying.
  await page.goto(`${base}/units/unit-101/connect`);
  await page.getByRole("button", { name: "Clear all" }).click();
  await page.getByRole("radio", { name: "Typed" }).click();
  await page.getByLabel("Code or message").fill("E52");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const e52 = page.locator('[data-hit-row="tab-3-3#3"]');
  await e52.waitFor();
  assert.match(await e52.innerText(), /Inverter fault/);
  assert.match(await e52.innerText(), /switch the supply off for 30 seconds/);
  const marker = e52.locator('[data-applicability="unknown"]');
  assert.match(await marker.innerText(), /firmware 2\.4 and later/);
  await marker.getByLabel("Controller firmware").fill("two point six");
  await marker.getByRole("button", { name: "Save" }).click();
  await marker.getByRole("alert").filter({ hasText: "does not read as a version" }).waitFor();
  await shot("applicability-refused");
  await marker.getByLabel("Controller firmware").fill("2.6");
  await marker.getByRole("button", { name: "Save" }).click();
  await e52.getByText("Applies to this unit:").waitFor();
  assert.equal(await e52.locator('[data-applicability="unknown"]').count(), 0);
  await shot("applicability-answered");
  // The answer is kept on the unit, marked as typed, and can be changed there.
  await page.goto(`${base}/units/unit-101`);
  const fw = page.locator('[data-attr="firmware"]');
  await fw.getByText("2.6", { exact: true }).waitFor();
  await fw.getByText("Typed", { exact: true }).waitFor();
  // A code the manual troubleshoots resolves to its row, with the tree to start.
  await page.getByRole("link", { name: "Reference tables" }).click();
  await page.getByLabel("Look up a code, item or term").fill("E21");
  await page.getByRole("button", { name: "Look up" }).click();
  await page.getByRole("region", { name: "Controller display codes E21" }).getByRole("link", { name: "Controller display codes" }).click();
  await page.getByText("Motor winding temperature high").waitFor();
  await page.getByRole("button", { name: "Start here" }).click();
  await page.getByText(/^Step \d+, /).first().waitFor();
  await shot("row-started");
  await page.goto(`${base}/units/unit-101/connect`);
  await page.getByRole("button", { name: "Clear all" }).click();

  // Describe with the model: one suggested entry that waits for Start, never starting by itself.
  await page.goto(`${base}/units/unit-101/troubleshoot`);
  await page.getByLabel("Describe the problem").fill("the pump engine is acting up and making a weird noise");
  const suggested = page.getByRole("region", { name: "Suggested entry" });
  await suggested.waitFor();
  await settle();
  assert.match(page.url(), /\/troubleshoot$/, "a suggestion must not start a job by itself");
  await shot("describe-suggest");
  await suggested.getByRole("button", { name: "Start" }).click();
  await page.getByText("Step 1, symptom").waitFor();
  // Words that fit two entries: the technician picks between them.
  await page.goto(`${base}/units/unit-101/troubleshoot`);
  await page.getByLabel("Describe the problem").fill("the pump engine is acting up and there is a rattle");
  const choice = page.getByRole("region", { name: "Which of these is it?" });
  await choice.waitFor();
  assert.equal(await choice.getByRole("button").count(), 2);
  await shot("describe-clarify");
  await choice.getByRole("button").first().click();
  await page.getByText("Step 1, symptom").waitFor();
  // Ask about this step: the manual's sentences under a fixed heading, each opening its page; or a decline.
  await page.getByRole("link", { name: "Ask about this step" }).click();
  await page.getByLabel("Question").fill("How do I check this?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  const answered = page.locator('[data-ask="answer"]');
  await answered.waitFor();
  assert.match(await answered.innerText(), /^What the manual says to do:/);
  assert.ok((await answered.getByRole("link").count()) > 0, "each sentence cites its page");
  await shot("ask-answer");
  await page.getByLabel("Question").fill("What colour is the paint?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await page.locator('[data-ask="decline"]').getByText("do not answer that").waitFor();
  await shot("ask-decline");
  // Records reports the model as it answered.
  await page.goto(`${base}/records`);
  await page.locator('[data-reachable="true"]').waitFor();

  // Voice, on a device with the speech model: the words land in the box to be checked before they are used.
  const native = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await native.addInitScript(fakeNative, " Engine does not crank. ");
  const pv = await native.newPage();
  pv.on("pageerror", (e) => errors.push(`voice: ${e.message}`));
  await pv.goto(`${base}/units/unit-101/troubleshoot`);
  await pv.getByRole("button", { name: "Speak" }).click();
  await pv.getByText("Check the words, then use them.").waitFor();
  assert.equal(await pv.getByLabel("Describe the problem").inputValue(), "Engine does not crank.");
  await pv.getByRole("button", { name: /Engine will not crank.*Matched/ }).first().click();
  await pv.getByText("Step 1, symptom").waitFor();
  await pv.getByRole("button", { name: "Note", exact: true }).click();
  await pv.getByRole("dialog", { name: "Note" }).getByRole("button", { name: "Speak" }).click();
  await pv.getByRole("dialog", { name: "Note" }).getByText("Check the words, then use them.").waitFor();
  const box = pv.getByLabel("Note with this answer");
  assert.equal(await box.inputValue(), "Engine does not crank.");
  await box.fill("Engine does not crank. Starter silent.");
  await pv.screenshot({ path: path.join(out, `${String(++n).padStart(2, "0")}-voice-note.png`) });
  await pv.getByRole("button", { name: "Keep note" }).click();
  await pv.getByText("Engine does not crank. Starter silent.").waitFor();
  await native.close();

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

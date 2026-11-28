#!/usr/bin/env node
/**
 * Browser verification for the crane app (built `dist/`, fixture pack).
 *
 * At 320, 390, 768 and 1280 px, light and dark:
 *   - every route loads with no horizontal overflow and zero layout shift;
 *   - screenshots land in artifacts/ui/ (uploaded by CI).
 * Flows (390 px): first run to a cited answer, citation to the exact
 * section, refresh restores, back and forward, a procedure run with a
 * deficiency, adaptive practice, a timed exam, the clearance and load chart
 * tools. State changes are checked for layout shift by measuring the
 * controls above the change before and after it.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium as rawChromium } from "playwright";
import { secureChromium } from "../../../amp/browser-security.mjs";

const chromium = secureChromium(rawChromium);
const root = fileURLToPath(new URL("..", import.meta.url));
const out = path.join(root, "artifacts", "ui");
const port = Number(process.env.CRANE_UI_PORT || 1441);
const base = `http://127.0.0.1:${port}`;
const WIDTHS = [320, 390, 768, 1280];
const THEMES = ["light", "dark"];
const ROUTES = [
  "/ask",
  "/ask/a/a.powerline-clearance",
  "/ask/q/rules%20for%20barge%20mounted%20cranes",
  "/ask/q/signaling",
  "/ask/q/outrigers",
  "/ask/q/xyzzy",
  "/read/29cfr1926.1408(b)(3)",
  "/do",
  "/do/shift-inspection",
  "/learn",
  "/learn/topic/power-lines",
  "/learn/topic/ground",
  "/learn/lesson/power-lines-table-a",
  "/learn/glossary",
  "/learn/rules",
  "/practice",
  "/practice/skills",
  "/practice/exam/core-practice",
  "/tools",
  "/tools/clearance",
  "/tools/load-chart",
  "/tools/load-chart/practice/demo",
  "/tools/signals",
  "/tools/signals/stop",
  "/settings",
  "/settings/about",
];
const SCREENSHOT = new Set(["/learn/topic/ground", "/ask", "/ask/q/signaling", "/ask/q/outrigers", "/ask/q/xyzzy", "/ask/a/a.powerline-clearance", "/read/29cfr1926.1408(b)(3)", "/do/shift-inspection", "/learn", "/practice", "/tools/clearance", "/tools/load-chart", "/tools/signals", "/settings"]);
// Serve every page under the shipped app's Content-Security-Policy, so anything the
// native WebView would block (inline script, a stray fetch, a blob image) fails here too.
const CSP = JSON.parse(await readFile(path.join(root, "src-tauri", "tauri.conf.json"), "utf8")).app.security.csp;
const slug = (r) => r.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "") || "root";

const preview = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
preview.stdout.on("data", (b) => (log += b));
preview.stderr.on("data", (b) => (log += b));
async function waitUp() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`preview did not start:\n${log}`);
}

/** Seed settings so a route renders past first run. */
const seeded = (role = "operator") => `localStorage.setItem("crane.settings", JSON.stringify({ state: { role: "${role}", equipment: null, theme: "system", lang: "en", assistant: false }, version: 1 }));`;

/**
 * A stand-in for the Tauri bridge, so the native voice and read-aloud UI runs
 * in the browser check. It answers the commands src/lib/native.ts invokes with
 * the shapes the plugins return, emits microphone levels like the STT plugin
 * (about 8 a second: room noise, a spoken question, then a pause), and records
 * read-aloud calls in window.__tts. `deny` makes the microphone permission fail
 * the way iOS reports it.
 */
const fakeNative = (opts) => {
  const callbacks = new Map();
  let nextId = 1;
  window.__tts = [];
  window.__stt = [];
  window.__calls = [];
  const listeners = {};
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
      window.__stt.push(cmd);
      window.__calls.push([cmd, args]);
      switch (cmd) {
        case "voice_model": return { status: args?.wait ? "ready" : "installing", file: "ggml-test.bin" };
        case "plugin:stt|is_available": return true;
        case "plugin:stt|validate_model": return { model: args.model, valid: true, problems: [] };
        case "plugin:stt|prepare": return { ready: true, model: args.args.model };
        case "plugin:stt|register_listener":
          (listeners[args.event] ??= []).push({ id: args.handler.id, index: 0 });
          return null;
        case "plugin:stt|remove_listener": return null;
        case "plugin:stt|start_session": {
          if (opts.deny) throw "MIC_PERMISSION_DENIED: Microphone access was denied";
          window.__sttPrompt = args.args.whisperParams?.initial_prompt ?? null;
          let t = 0;
          const timer = setInterval(() => {
            t += 125;
            const rms = t < 500 ? 0.03 : t < 2500 ? 0.18 + 0.04 * Math.sin(t) : 0.03;
            emit("audio_level", { rms, t });
            if (t > 9000) clearInterval(timer);
          }, 125);
          window.__sttTimer = timer;
          return { started: true, sessionId: args.args.sessionId };
        }
        case "plugin:stt|stop_session":
          clearInterval(window.__sttTimer);
          await new Promise((r) => setTimeout(r, 400));
          return { sessionId: args.args.sessionId, text: " How close can I get to a 345 kV line? " };
        case "plugin:stt|cancel_session": clearInterval(window.__sttTimer); return null;
        case "plugin:tts|list_voices":
          return [
            { id: "compact", language: "en-US", quality: "default" },
            { id: "cloud", language: "en-US", quality: "very_high", networkRequired: true },
            { id: "ava-premium", language: "en-US", quality: "enhanced", name: "Ava (Premium)" },
          ];
        case "plugin:tts|speak": window.__tts.push(args.args); await new Promise((r) => setTimeout(r, 300)); return null;
        case "plugin:tts|stop": return null;
        case "plugin:tts|open_tts_settings": return null;
        case "plugin:tts|open_app_details":
          if (args?.args?.packageName !== "inc.corpora.crane") throw "missing required key args";
          return null;
        case "plugin:corpan-llm|llm_status": return { loaded: false, modelId: null };
        default: throw `unexpected command ${cmd}`;
      }
    },
  };
};

const ANDROID_UA = "Mozilla/5.0 (Linux; Android 15; Pixel 8a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36";

async function newPage(browser, width, theme, { seed = true, native = null } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 860 }, colorScheme: theme, deviceScaleFactor: 1, ...(native?.android ? { userAgent: ANDROID_UA } : {}) });
  await context.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": CSP } });
  });
  if (seed) await context.addInitScript(seeded());
  if (native) await context.addInitScript(fakeNative, native);
  await context.addInitScript(() => {
    window.__shift = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__shift += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  return { context, page, errors };
}

async function assertLayout(page, label) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
    shift: window.__shift,
    wide: [...document.querySelectorAll("body *")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0) return false;
        // Elements inside a horizontal scroller (the load chart table) are allowed past the edge.
        for (let p = el.parentElement; p; p = p.parentElement) if (getComputedStyle(p).overflowX === "auto") return false;
        return r.right > window.innerWidth + 0.5;
      })
      .slice(0, 3)
      .map((el) => `${el.tagName}.${el.className}`.slice(0, 80)),
    // Icons inside controls render at their own size (no squeezing by padding).
    squeezed: [...document.querySelectorAll("button svg[width], a svg[width]")]
      .filter((svg) => svg.getBoundingClientRect().width > 0 && Math.abs(svg.getBoundingClientRect().width - Number(svg.getAttribute("width"))) > 0.5)
      .slice(0, 3)
      .map((svg) => `${svg.getAttribute("class")} ${svg.getBoundingClientRect().width}px`),
    // A filled control's label is never the colour of its own fill.
    invisible: [...document.querySelectorAll("button, a")]
      .filter((el) => {
        const cs = getComputedStyle(el);
        const bg = cs.backgroundColor;
        return el.getBoundingClientRect().width > 0 && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent" && cs.color === bg;
      })
      .slice(0, 3)
      .map((el) => `${el.tagName} "${el.textContent.trim().slice(0, 30)}"`),
  }));
  assert.deepEqual(m.squeezed, [], `${label}: squeezed icons`);
  assert.deepEqual(m.invisible, [], `${label}: labels the colour of their fill`);
  assert.ok(m.sw <= m.iw, `${label}: horizontal overflow ${m.sw} > ${m.iw} (${m.wide.join(", ")})`);
  assert.deepEqual(m.wide, [], `${label}: elements past the right edge`);
  assert.ok(m.shift < 0.001, `${label}: layout shift ${m.shift}`);
}

/** The rects of these locators must not move across `act`. */
async function steady(page, locators, act, label) {
  const before = await Promise.all(locators.map((l) => l.boundingBox()));
  await act();
  await page.waitForTimeout(120);
  const after = await Promise.all(locators.map((l) => l.boundingBox()));
  before.forEach((b, i) => {
    assert.ok(b && after[i], `${label}: element ${i} missing`);
    assert.ok(Math.abs(b.y - after[i].y) < 0.5 && Math.abs(b.x - after[i].x) < 0.5 && Math.abs(b.height - after[i].height) < 0.5, `${label}: element ${i} moved ${JSON.stringify(b)} -> ${JSON.stringify(after[i])}`);
  });
}

let browser;
let checks = 0;
try {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await waitUp();
  browser = await chromium.launch();

  // 1. Every route, every width, both themes.
  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const { context, page, errors } = await newPage(browser, width, theme);
      for (const route of ROUTES) {
        await page.goto(base + route);
        await page.locator("h1").first().waitFor();
        await page.evaluate(() => (window.__shift = 0));
        await assertLayout(page, `${route} @${width} ${theme}`);
        if (SCREENSHOT.has(route)) await page.screenshot({ path: path.join(out, `${slug(route)}-${width}-${theme}.png`), fullPage: true });
        checks++;
      }
      assert.deepEqual(errors, [], `console errors @${width} ${theme}`);
      await context.close();
    }
  }

  // 2. First run: one question, then a cited answer on screen.
  {
    const { context, page, errors } = await newPage(browser, 390, "light", { seed: false });
    await page.goto(base + "/");
    await page.waitForURL("**/ask");
    await page.getByRole("radio", { name: /Operator/ }).click();
    await page.waitForURL("**/ask/a/a.powerline-clearance");
    await page.locator("blockquote").first().waitFor();
    assert.ok(await page.locator(".plate").count() >= 2, "answer has citation plates");
    await page.screenshot({ path: path.join(out, "flow-first-run-answer.png"), fullPage: true });
    // Citation opens the exact paragraph.
    await page.locator(".plate", { hasText: "§1926.1408(a)(2)" }).first().click();
    await page.waitForURL(/\/read\/29cfr1926\.1408\(a\)\(2\)$/);
    await page.locator('[aria-current="true"]').first().waitFor();
    assert.equal(await page.locator('[aria-current="true"]').count(), 1, "the cited paragraph is marked");
    assert.match(await page.locator('[aria-current="true"]').innerText(), /closer than 20 feet/);
    // Refresh restores the screen.
    await page.reload();
    await page.locator('[aria-current="true"]').waitFor();
    // Back and forward.
    await page.goBack();
    await page.waitForURL("**/ask/a/a.powerline-clearance");
    await page.goForward();
    await page.waitForURL(/\/read\//);
    assert.deepEqual(errors, []);
    await context.close();
    checks++;
  }

  // 3. Ask is a search over the rules: results grouped by section, course-map matches first, never a cached answer.
  {
    const { context, page, errors } = await newPage(browser, 390, "light");
    await page.goto(base + "/ask");
    const input = page.getByLabel("Ask about a rule, a limit or a step");
    // Empty submit: inline error in the reserved line, nothing moves.
    await steady(page, [input, page.getByText("Common questions")], () => page.getByRole("button", { name: "Ask", exact: true }).click(), "empty ask");
    await page.getByText("Type a question first.").waitFor();
    await input.fill("when do I need a signal person");
    await input.press("Enter");
    await page.waitForURL(/\/ask\/q\//);
    await page.getByRole("heading", { level: 1, name: "Here’s what I found about “when do I need a signal person”" }).waitFor();
    await page.locator(".rule-hit").first().waitFor();
    assert.equal(await page.getByText(/answer that directly/).count(), 0, "no decline text over results");
    // The signal words, however asked, put §1926.1419 in the first group of rules, with the Signals topic and chart above.
    for (const q of ["signaling", "signalling", "hand signals", "who can give signals"]) {
      await page.goto(base + "/ask/q/" + encodeURIComponent(q));
      await page.locator(".rule-hit").first().waitFor();
      assert.equal(await page.locator(".rule-hit").first().getAttribute("data-root"), "29cfr1926.1419", `${q}: first group`);
      assert.match(await page.locator(".rule-hit").first().innerText(), /§1926\.1419/, `${q}: first group shows its citation`);
      const learn = page.getByRole("heading", { name: "Learn", exact: true });
      const rules = page.getByRole("heading", { name: "In the rules", exact: true });
      assert.ok((await learn.boundingBox()).y < (await rules.boundingBox()).y, `${q}: course-map matches come first`);
      assert.ok(await page.locator("a[href='/learn/topic/signals']").count() === 1, `${q}: the Signals topic`);
      assert.ok(await page.locator("a[href='/tools/signals']").count() === 1, `${q}: the hand signal chart`);
      assert.ok(await page.locator(".rule-hit mark.hit").count() >= 1, `${q}: matched words highlighted`);
      checks++;
    }
    // A result opens the exact paragraph in the Reader; back returns to the results.
    const best = page.locator(".rule-hit").first().locator("a").first();
    const href = await best.getAttribute("href");
    await best.click();
    await page.waitForURL((u) => u.pathname === decodeURIComponent(href) || u.pathname === href);
    await page.locator('[aria-current="true"]').first().waitFor();
    await page.goBack();
    await page.locator(".rule-hit").first().waitFor();
    // A typo is read as the indexed word and says so.
    await page.goto(base + "/ask/q/outrigers");
    await page.getByText("Read “outrigers” as “outriggers”.").waitFor();
    assert.ok(await page.locator(".rule-hit").count() >= 1, "a typo still reaches the rules");
    await page.goto(base + "/ask/q/" + encodeURIComponent("de-energized"));
    await page.locator(".rule-hit[data-root='29cfr1926.1408'], .rule-hit[data-root='29cfr1926.1407']").first().waitFor();
    // Truly off-topic: one plain line and the course map.
    await page.goto(base + "/ask/q/xyzzy");
    await page.getByText("Nothing in the crane rules matches that.", { exact: false }).waitFor();
    assert.equal(await page.locator(".rule-hit").count(), 0);
    assert.ok(await page.locator("a[href^='/learn/topic/']").count() >= 3, "topics offered");
    await page.goto(base + "/ask/q/" + encodeURIComponent("barge cranes floating on water"));
    await page.locator(".rule-hit[data-root='29cfr1926.1437']").first().waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    checks++;
  }

  // 4. Procedure run with a deficiency.
  {
    const { context, page, errors } = await newPage(browser, 390, "light");
    await page.goto(base + "/do/shift-inspection");
    await page.getByRole("button", { name: "Start" }).click();
    await page.waitForURL(/\/do\/run\/.+\/1$/);
    await page.getByRole("radio", { name: "Pass" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.waitForURL(/\/2$/);
    // Navigations commit in a transition: the URL changes before the DOM, so wait for step 2 itself.
    await page.getByText("Step 2 of 14").waitFor();
    const prev = page.getByRole("button", { name: "Previous" });
    await steady(page, [prev, page.getByLabel("Note (optional)")], () => page.getByRole("radio", { name: "Deficiency" }).click(), "deficiency");
    await page.getByRole("heading", { name: "Deficiency" }).waitFor();
    assert.ok(await page.locator("blockquote").count() >= 1, "deficiency quotes the rule");
    await page.getByLabel("Note (optional)").fill("Drive chain shows wear at the sprocket.");
    // A photo of the finding: a real PNG through the camera input, stored as JPEG.
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAE0lEQVR4nGP8tJIBK2DCLkwfCQDyqAGn31LftAAAAABJRU5ErkJggg==", "base64");
    await page.locator('input[type="file"]').setInputFiles({ name: "finding.png", mimeType: "image/png", buffer: png });
    await page.getByRole("button", { name: "Remove photo" }).waitFor();
    await page.screenshot({ path: path.join(out, "flow-deficiency.png"), fullPage: true });
    await page.reload();
    assert.equal(await page.getByLabel("Note (optional)").inputValue(), "Drive chain shows wear at the sprocket.", "run survives refresh");
    await page.goto(page.url().replace(/\/2$/, "/14"));
    await page.getByRole("button", { name: "Finish" }).click();
    await page.waitForURL(/\/do\/runs\//);
    await page.getByText("Deficiencies").waitFor();
    assert.equal((await page.locator(".text-display").nth(1).innerText()).trim(), "1");
    await page.screenshot({ path: path.join(out, "flow-run-report.png"), fullPage: true });
    // Export: one zip, run.json in harvest-run/1, the photo inside with its hash.
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export" }).click()]);
    assert.match(download.suggestedFilename(), /^shift-inspection-\d{4}-\d{2}-\d{2}-[a-z0-9]{6}\.zip$/);
    const zip = unzipSync(new Uint8Array(await (await import("node:fs/promises")).readFile(await download.path())));
    const report = JSON.parse(new TextDecoder().decode(zip["run.json"]));
    assert.equal(report.format, "harvest-run/1");
    assert.equal(report.status, "complete");
    assert.equal(report.steps.length, 14);
    assert.deepEqual(report.steps.map((x) => x.ord), Array.from({ length: 14 }, (_, i) => i + 1), "the pack's 1-based ords");
    assert.equal(report.steps_known, true);
    assert.deepEqual(report.steps.slice(0, 2).map((x) => x.outcome), ["pass", "fail"]);
    assert.equal(report.steps[1].deficiency, true);
    assert.equal(report.steps[1].note, "Drive chain shows wear at the sprocket.");
    assert.equal(report.steps[1].photos.length, 1);
    const photo = report.steps[1].photos[0];
    assert.equal(photo.sha256, createHash("sha256").update(zip[photo.path]).digest("hex"), "photo hash matches the bytes");
    await page.getByText("Run report saved.").waitFor();
    assert.deepEqual(errors, []);
    await context.close();
    checks++;
  }

  // 5. Adaptive practice: answer, feedback below the choices, next.
  {
    const { context, page } = await newPage(browser, 390, "light");
    await page.goto(base + "/practice/session");
    const choices = page.getByRole("group", { name: "Answer choices" }).getByRole("button");
    await choices.first().waitFor();
    await steady(page, [choices.first(), choices.last()], () => choices.first().click(), "practice answer");
    await page.getByRole("button", { name: "Next question" }).waitFor();
    await page.screenshot({ path: path.join(out, "flow-practice-feedback.png"), fullPage: true });
    const stem = await page.locator("h2").first().innerText();
    await page.reload();
    assert.equal(await page.locator("h2").first().innerText(), stem, "practice item survives refresh");
    await page.getByRole("button", { name: "Next question" }).click();
    await choices.first().waitFor();
    assert.equal(await choices.first().isDisabled(), false);
    // One feedback card, never filler: "Correct." or "Not quite. The answer is C.", why (and, when wrong,
    // why not the choice made), "Source: 29 CFR …. Read the source", and one Next button.
    for (let n = 0; n < 8; n++) {
      await choices.first().waitFor();
      const domain = await page.locator("h2").first().locator("xpath=preceding-sibling::p[1]").innerText();
      assert.match(domain, /^(SITE|OPERATIONS|TECHNICAL KNOWLEDGE|LOAD CHARTS|[A-Z ]+)/, "domain label above the stem");
      const pick = n % 2 === 0 ? 0 : (await choices.count()) - 1;
      await choices.nth(pick).click();
      const panel = page.locator(".practice-feedback");
      await panel.waitFor();
      const verdict = await panel.locator("h3").innerText();
      const reasons = await panel.locator(".feedback-why").allInnerTexts();
      for (const r of reasons) {
        assert.ok(r.trim().split(/\s+/).length >= 5, `feedback reason too short: "${r}"`);
        assert.doesNotMatch(r, /^(correct|incorrect)\b/i, `feedback reason restates the verdict: "${r}"`);
      }
      if (verdict === "Correct.") {
        assert.equal(reasons.length, 1, "a right answer gets one reason");
      } else {
        assert.match(verdict, /^Not quite\. The answer is [A-F]\.$/);
        assert.equal(reasons.length, 2, "a wrong answer gets why, then why not the choice made");
        assert.match(reasons[1], /^Why not [A-F]: /);
      }
      assert.equal(await panel.getByText(/^Correct\.?$/).count(), verdict === "Correct." ? 1 : 0, "no duplicated Correct");
      assert.match(await panel.locator(".feedback-source").innerText(), /^Source: (29 CFR 19\d\d\.\d+|Appendix)[^]*Read the source$/);
      assert.equal(await panel.getByRole("button").count(), 1, "a single Next button");
      if (n === 0) await page.screenshot({ path: path.join(out, "flow-practice-feedback-reasons.png"), fullPage: true });
      if (verdict !== "Correct." && !(await page.locator(".practice-feedback-shot").count())) await page.screenshot({ path: path.join(out, "flow-practice-feedback-wrong.png"), fullPage: true });
      if (n === 7) {
        await panel.getByRole("link", { name: "Read the source" }).click();
        await page.waitForURL(/\/read\//);
        await page.locator('[aria-current="true"]').first().waitFor();
        await page.goBack();
        await page.locator(".practice-feedback").waitFor();
      }
      await page.getByRole("button", { name: "Next question" }).click();
      checks++;
    }
    await context.close();
    checks++;
  }

  // 6. Timed exam: start, answer, review, submit, results by domain and skill.
  {
    const { context, page } = await newPage(browser, 390, "light");
    await page.goto(base + "/practice/exam/core-practice");
    await page.getByRole("button", { name: "Start exam" }).click();
    await page.waitForURL(/\/practice\/exam\/core-practice\/1$/);
    assert.match(await page.getByRole("timer").innerText(), /^2[45]:\d\d$/);
    await page.getByRole("radio").first().click();
    await page.getByRole("button", { name: "Flag for review" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.waitForURL(/\/2$/);
    await page.goto(base + "/practice/exam/core-practice/review");
    await page.getByText("1 of 20 answered.").waitFor();
    await page.getByRole("button", { name: "Submit exam" }).click();
    await page.waitForURL(/\/results$/);
    await page.getByRole("heading", { name: "By domain" }).waitFor();
    await page.getByRole("heading", { name: "By skill" }).waitFor();
    await page.screenshot({ path: path.join(out, "flow-exam-results.png"), fullPage: true });
    await context.close();
    checks++;
  }

  // A topic whose lessons are not written yet still teaches: its rules, practice and Ask.
  {
    const { context, page } = await newPage(browser, 390, "light");
    await page.goto(base + "/learn/topic/ground");
    await page.getByText("The rules for this topic").waitFor();
    assert.ok((await page.locator("a[href^='/read/']").count()) >= 1, "a topic with no lessons links its rules");
    await page.getByRole("link", { name: "Practice this topic" }).waitFor();
    await page.getByLabel("Ask about a rule, a limit or a step").waitFor();
    await context.close();
    checks++;
  }

  // Voice: one tap, live level, ends on the pause, transcript to check and edit, then Ask.
  for (const width of [320, 390]) {
    const { context, page, errors } = await newPage(browser, width, "light", { native: {} });
    await page.goto(base + "/ask");
    const talk = page.getByRole("button", { name: "Tap and ask" });
    await talk.waitFor();
    const box = page.getByLabel("Ask about a rule, a limit or a step");
    const starters = page.getByText("Common questions");
    const before = await Promise.all([box.boundingBox(), starters.boundingBox(), talk.boundingBox()]);
    assert.ok(before[2].height >= 72, `voice control is ${before[2].height}px tall`);
    await talk.click();
    const listening = page.getByRole("button", { name: /Listening/ });
    await listening.waitFor();
    assert.equal(await listening.getAttribute("aria-pressed"), "true");
    await page.screenshot({ path: path.join(out, `flow-voice-listening-${width}.png`), fullPage: true });
    // It stops on its own after the pause; the transcript lands in the box, not asked yet.
    await page.getByText("Check the question above, fix any word, then tap search.").waitFor({ timeout: 8000 });
    assert.equal(await box.inputValue(), "How close can I get to a 345 kV line?");
    assert.match(page.url(), /\/ask$/, "a spoken question is not asked until the person taps Ask");
    assert.ok((await page.evaluate(() => window.__sttPrompt))?.includes("deenergized"), "whisper is primed with the crane vocabulary");
    const after = await Promise.all([box.boundingBox(), starters.boundingBox(), talk.boundingBox()]);
    before.forEach((b, i) => assert.ok(Math.abs(b.y - after[i].y) < 0.5 && Math.abs(b.height - after[i].height) < 0.5, `voice states moved element ${i}`));
    await page.screenshot({ path: path.join(out, `flow-voice-done-${width}.png`), fullPage: true });
    await box.fill("What's the minimum clearance for a 345 kV line?");
    await box.press("Enter");
    await page.waitForURL(/\/ask\/q\//);
    assert.ok(decodeURIComponent(page.url()).endsWith("What's the minimum clearance for a 345 kV line?"));
    assert.deepEqual(errors, []);
    await context.close();
    checks++;
  }

  // Voice with the microphone refused: an inline way forward, typing still works, nothing moves.
  {
    const { context, page, errors } = await newPage(browser, 320, "light", { native: { deny: true } });
    await page.goto(base + "/ask");
    const talk = page.getByRole("button", { name: "Tap and ask" });
    const starters = page.getByText("Common questions");
    const y0 = (await starters.boundingBox()).y;
    await talk.click();
    await page.getByText("The microphone is off for this app. Allow it in Settings, or type the question.").waitFor();
    assert.equal((await starters.boundingBox()).y, y0, "the refusal message does not move the page");
    // A tap that would only fail again is never offered: the control now opens Settings.
    await page.getByRole("button", { name: "Open Settings" }).click();
    await page.waitForFunction(() => window.__stt.includes("plugin:tts|open_tts_settings"));
    assert.deepEqual(errors.filter((e) => !/voice\.start|MIC_PERMISSION/.test(e)), [], "opening Settings did not fail");
    await context.close();
    checks++;
  }

  // The same refusal on Android opens the app's details screen, with the plugin's argument shape.
  {
    const { context, page, errors } = await newPage(browser, 390, "light", { native: { deny: true, android: true } });
    await page.goto(base + "/ask");
    await page.getByRole("button", { name: "Tap and ask" }).click();
    await page.getByRole("button", { name: "Open Settings" }).click();
    await page.waitForFunction(() => window.__calls.some(([c]) => c === "plugin:tts|open_app_details"));
    const [, args] = await page.evaluate(() => window.__calls.find(([c]) => c === "plugin:tts|open_app_details"));
    assert.deepEqual(args, { args: { packageName: "inc.corpora.crane" } });
    assert.deepEqual(errors.filter((e) => !/voice\.start|MIC_PERMISSION/.test(e)), []);
    await context.close();
    checks++;
  }

  // Read-aloud: answers and procedure steps, in the most natural offline voice.
  {
    const { context, page, errors } = await newPage(browser, 390, "light", { native: {} });
    await page.goto(base + "/do/shift-inspection");
    await page.getByRole("button", { name: "Start" }).click();
    await page.waitForURL(/\/do\/run\/.+\/1$/);
    await page.getByRole("button", { name: "Read step" }).click();
    await page.waitForFunction(() => window.__tts.length > 0);
    const spoken = await page.evaluate(() => window.__tts[0]);
    assert.equal(spoken.voiceId, "ava-premium", "the enhanced offline voice, never the network one");
    assert.match(spoken.text, /Control mechanisms/);
    await page.goto(base + "/ask/a/a.powerline-clearance");
    await page.getByRole("button", { name: "Read aloud" }).click();
    await page.waitForFunction(() => window.__tts.length > 0);
    assert.deepEqual(errors, []);
    await context.close();
    checks++;
  }

  // 7. Tools: clearance result box keeps its size; load chart practice checks the work.
  {
    const { context, page } = await newPage(browser, 390, "light");
    await page.goto(base + "/tools/clearance");
    const result = page.getByText("Minimum clearance distance").locator("..");
    const h0 = (await result.boundingBox()).height;
    await page.getByLabel("Line voltage (nominal, AC)").fill("345");
    await page.getByText("20 ft").first().waitFor();
    assert.equal((await result.boundingBox()).height, h0, "clearance result keeps its size");
    await page.getByText("closer than 20 feet to this line").waitFor();
    await page.getByLabel("Line voltage (nominal, AC)").fill("500");
    await page.getByText("closer than 50 feet to this line").waitFor();
    await page.getByLabel("Line voltage (nominal, AC)").fill("200");
    await page.getByText("15 ft").first().waitFor();
    await page.getByLabel("Line voltage (nominal, AC)").fill("-3");
    await page.getByText("Enter a voltage above 0, in kV.").waitFor();
    await page.getByText("Enter a voltage or pick a band.").waitFor(); // the old distance is gone
    await page.goto(base + "/tools/load-chart/practice/demo");
    await page.getByRole("button", { name: "Check" }).click();
    await page.getByText("Enter the capacity as a number of pounds.").waitFor();
    await page.getByLabel("Gross rated capacity from the chart").fill("1000");
    await page.getByRole("radio", { name: "Yes" }).click();
    await page.getByRole("button", { name: "Check" }).click();
    await page.getByText("Gross rated capacity:").waitFor();
    await page.screenshot({ path: path.join(out, "flow-load-chart-practice.png"), fullPage: true });
    // A new problem starts clean, even when reached by the tab rather than "Next problem".
    await page.getByRole("navigation", { name: "Load chart modes" }).getByRole("link", { name: "Practice" }).click();
    await page.getByRole("button", { name: "Check" }).waitFor();
    assert.equal(await page.getByLabel("Gross rated capacity from the chart").inputValue(), "");
    await context.close();
    checks++;
  }

  console.log(`verify-ui: ${checks} checks passed (${ROUTES.length} routes x ${WIDTHS.length} widths x ${THEMES.length} themes + 6 flows). Screenshots: ${out}`);
} finally {
  await browser?.close();
  preview.kill();
}

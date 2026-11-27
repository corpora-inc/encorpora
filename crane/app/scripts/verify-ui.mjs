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
  "/read/29cfr1926.1408(b)(3)",
  "/do",
  "/do/shift-inspection",
  "/learn",
  "/learn/topic/power-lines",
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
const SCREENSHOT = new Set(["/ask", "/ask/a/a.powerline-clearance", "/read/29cfr1926.1408(b)(3)", "/do/shift-inspection", "/learn", "/practice", "/tools/clearance", "/tools/load-chart", "/tools/signals", "/settings"]);
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

async function newPage(browser, width, theme, { seed = true } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 860 }, colorScheme: theme, deviceScaleFactor: 1 });
  await context.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), "content-security-policy": CSP } });
  });
  if (seed) await context.addInitScript(seeded());
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

  // 3. Ask: a paraphrase is answered from the pack; an uncovered question declines with nearest sections.
  {
    const { context, page } = await newPage(browser, 390, "light");
    await page.goto(base + "/ask");
    const input = page.getByLabel("Ask about a rule, a limit or a step");
    // Empty submit: inline error in the reserved line, nothing moves.
    await steady(page, [input, page.getByText("Common questions")], () => page.getByRole("button", { name: "Ask", exact: true }).click(), "empty ask");
    await page.getByText("Type a question first.").waitFor();
    await input.fill("when do I need a signal person");
    await input.press("Enter");
    await page.waitForURL(/\/ask\/q\//);
    await page.getByText("The point of operation").first().waitFor();
    await page.goto(base + "/ask/q/" + encodeURIComponent("barge cranes floating on water"));
    await page.getByText("Closest sections").waitFor();
    assert.ok(await page.locator("a[href^='/read/']").count() >= 1);
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

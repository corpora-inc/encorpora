/**
 * Grade-3 problem flipbook: every grade-3 problem type on the REAL practice
 * screen (Vite dev app + real Fastify API, in-memory learner "Maya"; see
 * grades-fixture.ts).
 *
 * How a specific type is served: Home -> "Go" makes the client POST
 * /learners/:id/batches. A page.route registered after the fixture's rewrites
 * that request body to { templateId, count: 1 } (the server's own focused-
 * template path) and falls through to the fixture, which injects it into the
 * real API. The server seeds the problem with randomUUID(); a one-shot
 * override of node:crypto.randomUUID makes that seed "1" (or 2/3), so the
 * served problem is exactly generateProblemFor(templateId, seed, caps).
 *
 *   npx tsx ad-capture/g3-problems-capture.ts [templateId,...]
 *   G3_SEEDS="id=2,id2=3" to override per-type seeds.
 */
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { chromium, type Page } from "playwright";
import { generateProblem } from "../src/math/engine";

// --- one-shot seed override for the server's randomUUID ---------------------
const realUUID = crypto.randomUUID.bind(crypto);
let nextSeed: string | null = null;
(crypto as any).randomUUID = (...a: any[]) => {
  if (nextSeed !== null) {
    const s = nextSeed;
    nextSeed = null;
    return s;
  }
  return realUUID(...a);
};
syncBuiltinESMExports();
process.env.GRADES_PORT ??= "4791";
const { startGradesFixture } = await import("./grades-fixture");

const ROOT = "/Users/skyl/corpora-media/AMP-media/2026-11-03/grade3-speedrun/";
const OUT = ROOT + "captures/problems/";
mkdirSync(OUT, { recursive: true });
const beats = JSON.parse(readFileSync(ROOT + "beats.json", "utf8")).beats;
const all: { skillId: string; strand: string; id: string; title: string }[] =
  beats.flatMap((b: any) =>
    b.problemTypes.map((p: any) => ({
      skillId: b.skillId,
      strand: b.strand,
      id: p.id,
      title: p.title,
    })),
  );
const only = process.argv[2]?.split(",");
const list = only ? all.filter((t) => only.includes(t.id)) : all;
const seedOverride = Object.fromEntries(
  (process.env.G3_SEEDS ?? "")
    .split(",")
    .filter(Boolean)
    .map((kv) => kv.split("=")),
);
/** ~12 "Correct" shots across the five CCSS domains (OA, NBT, NF, MD, G). */
const CORRECT = new Set([
  "equal-tray-total", // OA
  "multiply-facts", // OA
  "missing-factor-fact", // OA
  "story-operation-choice", // OA
  "round-to-hundred", // NBT
  "add-three-digit", // NBT
  "fraction-model", // NF
  "fraction-line-position", // NF
  "clock-elapsed-minutes", // MD
  "scaled-bar-graph", // MD
  "rectangle-area", // MD
  "classify-quadrilateral", // G
  "equal-area-fraction", // G
]);

const fx = await startGradesFixture();
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  colorScheme: "light",
});
await context.addInitScript("globalThis.__name = (f) => f;");
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = await fx.attach(page);

let want: { id: string; seed: string } | null = null;
// Registered after fx.attach, so it runs first and falls back to the fixture.
await page.route("**/api/**/batches", async (route) => {
  const req = route.request();
  if (req.method() !== "POST" || !want) return route.fallback();
  const body = JSON.parse(req.postData() ?? "{}");
  delete body.recoveryStrand;
  body.templateId = want.id;
  body.count = 1;
  nextSeed = want.seed;
  return route.fallback({ postData: JSON.stringify(body) });
});

async function settle(extra = 600) {
  await page.evaluate(() => document.fonts.ready);
  await page
    .waitForFunction(
      () => !document.querySelector("[aria-busy=true], [data-placeholder]"),
      null,
      { timeout: 15000 },
    )
    .catch(() => console.warn(`still busy at ${page.url()}`));
  await page.waitForTimeout(extra);
}
async function parkPointer() {
  await page.mouse.move(389, 843);
}

async function serve(id: string, seed: string) {
  want = { id, seed };
  const expected = generateProblem(id, seed).public.id;
  await page.goto(fx.origin + "/");
  await page.getByRole("button", { name: /^(Go|Continue)$/ }).first().click();
  await page.locator(`[data-problem-id="${expected}"]`).first().waitFor();
  want = null;
  await settle();
  return expected;
}

/** Visible-state checks: an error banner, a blank figure, controls off-screen. */
async function inspect() {
  return page.evaluate(() => {
    const vis = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) };
    };
    const alert = [...document.querySelectorAll("[role=alert]")]
      .map((e) => (e as HTMLElement).innerText.trim())
      .filter(Boolean);
    const figs = [...document.querySelectorAll(".problem-stage svg, .problem-stage canvas")]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 40 && r.height > 40);
    const submit = document.querySelector(
      "button[type=submit], .choice-submit",
    );
    return {
      alerts: alert,
      figureCount: figs.length,
      stage: vis(document.querySelector(".problem-stage")),
      submit: vis(submit),
      docHeight: document.documentElement.scrollHeight,
      text: (document.querySelector(".problem-stage") as HTMLElement | null)?.innerText
        .replace(/\s+/g, " ")
        .slice(0, 300),
    };
  });
}

async function answer(saved: any) {
  const kind = saved.public.response.kind;
  const ans = saved.answer;
  if (kind === "choice") {
    await page.locator(`input[type=radio][value="${ans}"]`).check({ force: true });
  } else if (kind === "multi-select") {
    for (const v of JSON.parse(ans))
      await page.locator(`input[type=checkbox][value="${v}"]`).check({ force: true });
  } else {
    const boxes = page.getByRole("textbox");
    await boxes.first().fill(String(ans));
  }
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await page.locator("[data-answer-feedback]").waitFor();
  await page
    .locator(".practice-celebration")
    .waitFor({ state: "detached", timeout: 10000 })
    .catch(() => console.warn("celebration still mounted"));
  await settle(400);
  const heading = await page
    .getByText(/^(Correct|Not quite.*|Incorrect.*)$/)
    .first()
    .innerText()
    .catch(() => "NO HEADING");
  return heading.trim() + " | " + (await page.locator("[data-answer-feedback]").first().innerText()).replace(/\s+/g, " ");
}

const indexPath = OUT + "index.json";
const index: any[] = existsSync(indexPath) && only
  ? JSON.parse(readFileSync(indexPath, "utf8"))
  : [];
for (const t of list) {
  const seed = seedOverride[t.id] ?? "1";
  const errStart = errors.length;
  const entry: any = { templateId: t.id, skillId: t.skillId, strand: t.strand, title: t.title, seed };
  try {
    const pid = await serve(t.id, seed);
    const saved = fx.problems.get(pid)!;
    entry.responseKind = saved.public.response.kind;
    entry.answer = saved.answer;
    const state = await inspect();
    await parkPointer();
    const file = `${t.id}.png`;
    await page.screenshot({ path: OUT + file });
    entry.file = file;
    entry.state = state;
    const notes: string[] = [];
    if (state.alerts.length) notes.push(`alert: ${state.alerts.join(" | ")}`);
    if (state.submit && state.submit.bottom > 844) notes.push("Check button below the fold");
    if ((saved.public as any).figure && !state.figureCount) notes.push("figure expected but no svg/canvas found");
    // Phone multi-selects with a figure put their options behind a button.
    const opener = page.getByRole("button", { name: /^Select \d+ / });
    if (await opener.count()) {
      await opener.first().click();
      await settle(700);
      await parkPointer();
      entry.optionsFile = `${t.id}-options.png`;
      await page.screenshot({ path: OUT + entry.optionsFile });
      notes.push("phone layout puts the options behind a 'Select N' button; -options.png shows them open");
    }
    if (CORRECT.has(t.id)) {
      const fb = await answer(saved);
      entry.feedback = fb.slice(0, 200);
      if (!fb.startsWith("Correct |")) notes.push(`feedback not Correct: ${fb.slice(0, 80)}`);
      await parkPointer();
      entry.correctFile = `${t.id}-correct.png`;
      await page.screenshot({ path: OUT + entry.correctFile });
    }
    const errs = errors.slice(errStart);
    if (errs.length) notes.push(`console: ${errs.join(" | ").slice(0, 300)}`);
    entry.notes = notes.join("; ");
    console.log(`ok ${t.id} ${entry.responseKind} figs=${state.figureCount} ${entry.notes}`);
  } catch (e) {
    entry.notes = `FAILED: ${String(e).slice(0, 300)}`;
    console.log(`FAIL ${t.id} ${entry.notes}`);
    await page.screenshot({ path: OUT + `_fail-${t.id}.png` }).catch(() => {});
  }
  const at = index.findIndex((x) => x.templateId === t.id);
  if (at >= 0) index[at] = entry;
  else index.push(entry);
}
const order = new Map(all.map((t, i) => [t.id, i]));
index.sort((a, b) => order.get(a.templateId)! - order.get(b.templateId)!);
writeFileSync(indexPath, JSON.stringify(index, null, 1));
console.log(`unhandled: ${[...fx.unhandled].join(", ")}`);
await browser.close();
await fx.close();

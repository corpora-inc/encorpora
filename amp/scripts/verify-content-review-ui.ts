import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { generateProblem } from "../src/math/engine";
import { spokenMath } from "../src/web/MathText";

// Run against `npm run dev:content`; no database or learner records involved.
const base = `http://127.0.0.1:${process.env.AMP_REVIEW_PORT ?? 4312}`;
const output = "artifacts/content-review";
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const families = [
    "geometry-proof-step",
    "rational-equation-one-denominator",
    "rational-equation-check",
  ];
  for (const template of families) {
    const seed = "visual-0",
      generated = generateProblem(template, seed);
    await page.goto(`${base}/?${new URLSearchParams({ template, seed })}`);
    await page.locator(".review-prompt").waitFor();
    const action = (kind: string, extra = {}) =>
      page.request.post(`${base}/__review/action`, {
        data: { template, seed, action: kind, ...extra },
      });
    const publicProblem = await (await action("problem")).json();
    assert.equal(publicProblem.id, generated.public.id);
    for (const key of ["answer", "explanation", "hint", "choiceFeedback"])
      assert(!(key in publicProblem), key);
    assert.equal(
      (await (await action("check", { response: generated.answer })).json())
        .correct,
      true,
    );
    const wrong =
      generated.public.response.kind === "choice"
        ? generated.public.response.options.find(
            (o) => o.id !== generated.answer,
          )!.id
        : "99999";
    assert.equal(
      (await (await action("check", { response: wrong })).json()).correct,
      false,
    );
    if (generated.public.response.kind === "choice") {
      const correct = generated.public.response.options.find(
        (o) => o.id === generated.answer,
      )!;
      await page
        .getByRole("radio", { name: spokenMath(correct.label), exact: true })
        .check();
    } else
      await page
        .getByRole("textbox", { name: "Answer", exact: true })
        .fill(generated.answer);
    await page
      .getByRole("button", { name: "Check answer", exact: true })
      .click();
    await page.getByRole("status").filter({ hasText: "Correct." }).waitFor();
    await page.getByRole("button", { name: "Show hint", exact: true }).click();
    await page
      .getByRole("region", { name: "Hint or answer feedback" })
      .waitFor();
    assert.equal((await (await action("hint")).json()).hint, generated.hint);
    await page
      .getByRole("button", { name: "Show solution", exact: true })
      .click();
    await page.getByRole("region", { name: "Solution", exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Show in-practice lesson", exact: true })
      .click();
    await page.locator(".problem-lesson").waitFor();
    await page
      .getByRole("button", { name: "Show full lesson", exact: true })
      .click();
    await page
      .frameLocator("iframe")
      .getByText("A worked example", { exact: true })
      .waitFor();
    for (const width of [320, 390, 768, 1280])
      for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(
          (t) => document.documentElement.setAttribute("data-theme", t),
          theme,
        );
        await page.evaluate(() => document.fonts.ready);
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
          `${template}/${width}/${theme} overflow`,
        );
        await page.screenshot({
          path: `${output}/${template}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
  }
  await page.goto(`${base}/?template=rational-equation-check&seed=visual-0`);
  await page.locator(".review-prompt").waitFor();
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  let started!: () => void;
  const ready = new Promise<void>((r) => (started = r));
  await page.route("**/__review/action", async (route) => {
    if (route.request().postDataJSON().action === "hint") {
      const response = await route.fetch();
      started();
      await held;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Show hint", exact: true }).click();
  await ready;
  await page
    .getByRole("link", { name: "Justify an angle proof step", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Justify an angle proof step", exact: true })
    .waitFor();
  release();
  await page.unrouteAll({ behavior: "wait" });
  assert.equal(
    await page.getByRole("region", { name: "Hint or answer feedback" }).count(),
    0,
    "old hint must not appear in new selection",
  );
  // Loading the same selection must schedule a replacement, not strand busy.
  let sameRelease!: () => void, sameStarted!: () => void;
  const sameHeld = new Promise<void>((r) => (sameRelease = r));
  const sameReady = new Promise<void>((r) => (sameStarted = r));
  let blockFirst = true;
  await page.route("**/__review/action", async (route) => {
    if (blockFirst && route.request().postDataJSON().action === "problem") {
      blockFirst = false;
      const response = await route.fetch();
      sameStarted();
      await sameHeld;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.goto(`${base}/?template=rational-equation-check&seed=visual-0`);
  await sameReady;
  await page
    .getByRole("link", { name: "Check the original domain", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Check the original domain", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("button", { name: "Load", exact: true }).isEnabled(),
    true,
  );
  sameRelease();
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("radio").first().check();
  let checkRelease!: () => void, checkStarted!: () => void;
  const checkHeld = new Promise<void>((r) => (checkRelease = r)),
    checkReady = new Promise<void>((r) => (checkStarted = r));
  await page.route("**/__review/action", async (route) => {
    if (route.request().postDataJSON().action === "check") {
      const response = await route.fetch();
      checkStarted();
      await checkHeld;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Check answer", exact: true }).click();
  await checkReady;
  assert.equal(await page.locator('input[type="radio"]:disabled').count(), 4);
  checkRelease();
  await page.unrouteAll({ behavior: "wait" });
  assert.equal(
    (
      await page.request.post(`${base}/__review/action`, {
        data: {
          template: "rational-equation-check",
          seed: "x".repeat(128),
          action: "lesson",
        },
      })
    ).status(),
    200,
  );
  await page.goBack();
  await page
    .getByRole("heading", { name: "Check the original domain", exact: true })
    .waitFor();
  assert.equal(
    await page.getByRole("textbox", { name: "Seed", exact: true }).inputValue(),
    "visual-0",
  );
  await page.reload();
  await page
    .getByRole("heading", { name: "Check the original domain", exact: true })
    .waitFor();
  assert.equal(
    (
      await page.request.post(`${base}/__review/action`, {
        headers: { Origin: "https://example.com" },
        data: { template: "geometry-proof-step", seed: "a", action: "problem" },
      })
    ).status(),
    403,
  );
  assert.equal(
    (
      await page.request.post(`${base}/__review/action`, {
        data: { template: "missing", seed: "a", action: "problem" },
      })
    ).status(),
    400,
  );
  assert.equal(
    (
      await page.request.post(`${base}/__review/action`, {
        data: "x".repeat(5000),
      })
    ).status(),
    413,
  );
  assert.deepEqual(errors, []);
  console.log(
    "Verified all three families, exact grading, hint/solution/both lessons, 24 viewport/theme cases, history/reload, stale hints and local request boundaries.",
  );
} finally {
  await browser.close();
}

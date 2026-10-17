import { exitPractice, resume, startTopic } from "./ui-practice";
import { algebraDefinitions } from "../src/content/algebra-definitions.js";
import { equalGroupsDefinitions } from "../src/content/equal-groups-definitions.js";
import { registerFamilyRoutes } from "../src/family/routes.js";
import { chromium } from "playwright";
import { createServer } from "vite";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { buildApp } from "../src/server/app";
import { PostgresRepository } from "../src/server/repository";
import { developmentAuth } from "../src/server/auth";
import { migrate } from "./migrate";
import { templates } from "../src/math/engine";
const url = process.env.AMP_TEST_DATABASE_URL;
if (!url)
  throw new Error("AMP_TEST_DATABASE_URL is required for browser verification");
await migrate(url);
const repository = new PostgresRepository(url, { development: true });
const account = "development-household";
const learner = await repository.create(account, "Browser verification", 2016);
const learnerIds = [learner.id];
const app = buildApp({
  repository,
  authenticate: developmentAuth(),
  development: true,
});
await registerFamilyRoutes(app, {
  pool: repository.pool,
  authenticate: developmentAuth(),
  development: true,
});
await app.listen({ host: "127.0.0.1", port: 4351 });
const vite = await createServer({
  root: new URL("../", import.meta.url).pathname,
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: {
    host: "127.0.0.1",
    port: 4350,
    strictPort: true,
    proxy: { "/api": { target: "http://127.0.0.1:4351" } },
  },
});
await vite.listen();
const browser = await chromium.launch({ headless: true });
await mkdir(new URL("../artifacts/screenshots/", import.meta.url), {
  recursive: true,
});
try {
  const page = await browser.newPage({ hasTouch: true });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4350");
  await page
    .getByRole("combobox", { name: "Learner", exact: true })
    .selectOption(learner.id);
  await startTopic(page, "mean-data");
  // Navigation intentionally cancels pending batches; establish practice first.
  await page.locator(".problem-stage").waitFor();
  for (const viewport of [
    { width: 1280, height: 1000 },
    { width: 390, height: 844 },
    { width: 320, height: 720 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await resume(page);
    // Let the resize event apply the practice viewport height.
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await page.locator(".problem-stage").waitFor();
    const fit = await page.evaluate(() => {
      const stage = document.querySelector(".problem-stage")!;
      const action = document.querySelector(
        ".compact-answer-action, .answer-action",
      )!;
      return {
        stage: stage.clientHeight,
        content: stage.scrollHeight,
        actionBottom: Math.round(action.getBoundingClientRect().bottom),
        height: innerHeight,
      };
    });
    assert.ok(
      fit.stage >= 180 &&
        fit.content <= fit.stage + 2 &&
        fit.actionBottom <= fit.height,
      `Question and answer action must fit ${viewport.width}×${viewport.height}: ${JSON.stringify(fit)}`,
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Viewport must not overflow at ${viewport.width}px`,
    );
    await page.screenshot({
      path: new URL(
        `../artifacts/screenshots/practice-${viewport.width}.png`,
        import.meta.url,
      ).pathname,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 320, height: 568 });
  await page
    .getByRole("button", { name: "Enter your answer", exact: true })
    .click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  assert.equal(await page.locator("#answer").inputValue(), "1");
  await page.getByRole("button", { name: "Close panel", exact: true }).click();
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  await page.locator(".problem-lesson").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Lesson",
  );
  await page.getByRole("button", { name: /Your answer: 1/ }).click();
  await page.locator("#answer").fill("999");
  await page.getByRole("button", { name: "Check" }).click();
  await page.locator(".solution-panel").waitFor();
  assert.match(
    await page.locator(".solution-panel").innerText(),
    /Practiced with support/,
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() => document.activeElement?.textContent),
    "Next →",
  );
  await page.getByRole("button", { name: "Next", exact: false }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#answer").waitFor();
  // Mixed scheduling may choose a book-backed family; select the legacy lesson
  // explicitly before testing the lifecycle of its lesson-support request.
  await startTopic(page, "mean-data");
  await page.locator("#answer").waitFor();
  let releaseLesson!: () => void;
  let heldLesson!: () => void;
  const held = new Promise<void>((resolve) => {
    heldLesson = resolve;
  });
  const release = new Promise<void>((resolve) => {
    releaseLesson = resolve;
  });
  await page.route("**/lesson-support", async (route) => {
    const result = await route.fetch();
    heldLesson();
    await release;
    await route.fulfill({ response: result });
  });
  await page.getByRole("button", { name: "Lesson", exact: true }).click();
  await held;
  let releaseNext!: () => void;
  const nextHeld = new Promise<void>((resolve) => {
    releaseNext = resolve;
  });
  await page.route("**/batches", async (route) => {
    const result = await route.fetch();
    await nextHeld;
    await route.fulfill({ response: result });
  });
  await page.locator("#answer").fill("999999");
  await page.getByRole("button", { name: "Check" }).click();
  await page.locator(".solution-panel").waitFor();
  // Next waits on the held, already-requested problem; the lesson that was
  // requested for the answered problem must not open meanwhile.
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const delivered = page.waitForResponse((response) =>
    response.url().endsWith("/lesson-support"),
  );
  releaseLesson();
  await delivered;
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  assert.equal(
    await page.locator("dialog[open]").count(),
    0,
    "A stale lesson response cannot open another problem's lesson",
  );
  const nextDelivered = page.waitForResponse((response) =>
    response.url().endsWith("/batches"),
  );
  releaseNext();
  await nextDelivered;
  await page.waitForFunction(
    () =>
      !(
        document.querySelector(
          "select[aria-label='Learner']",
        ) as HTMLSelectElement
      )?.disabled,
  );
  await page.unroute("**/batches");
  await page.unroute("**/lesson-support");
  for (const template of templates) {
    await startTopic(page, template.id);
    await page.locator("#answer, .choice-form").first().waitFor();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `Overflow in ${template.id}`,
    );
    for (const size of [
      { width: 390, height: 844 },
      { width: 320, height: 568 },
      { width: 844, height: 390 },
    ]) {
      await page.setViewportSize(size);
      // Let the media-query subscription commit the appropriate answer surface.
      await page.waitForFunction(() => {
        const compact = matchMedia(
          "(max-width:650px) and (max-height:780px)",
        ).matches;
        return !!document.querySelector(".compact-answer-action") === compact;
      });
      const geometry = await page
        .locator(".problem-stage")
        .evaluate((stage) => ({
          height: stage.clientHeight,
          scroll: stage.scrollHeight,
        }));
      assert.ok(
        geometry.scroll <= geometry.height + 2,
        `${template.id} must fit ${size.width}×${size.height}: ${JSON.stringify(geometry)}`,
      );
      if (
        size.width === 320 &&
        [...equalGroupsDefinitions, ...algebraDefinitions].some(
          (d) => d.id === template.id,
        )
      )
        await page.screenshot({
          path: new URL(
            `../artifacts/screenshots/${template.id}-compact.png`,
            import.meta.url,
          ).pathname,
        });
      if (template.id === "fraction-group-count" && size.width === 320)
        await page.screenshot({
          path: new URL(
            "../artifacts/screenshots/fraction-group-count-compact.png",
            import.meta.url,
          ).pathname,
          fullPage: true,
        });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    if (
      template.id.startsWith("graphed-") ||
      template.id.startsWith("clock-") ||
      template.id.startsWith("bar-chart-")
    )
      await page.screenshot({
        path: new URL(
          `../artifacts/screenshots/${template.id}.png`,
          import.meta.url,
        ).pathname,
        fullPage: true,
      });
  }
  // Lessons: every problem type has its own short lesson.
  await exitPractice(page);
  await page.getByRole("button", { name: "Lessons", exact: true }).click();
  await page.locator(".topic-list:not([hidden]) button").first().click();
  await page.locator(".lesson-sheet .problem-lesson").waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.getByRole("button", { name: "← All lessons" }).click();
  // The header and tabs hold the same geometry on every section.
  const chrome = async () =>
    page.evaluate(() =>
      [".shell > header .brand", ".shell > header .account", ".shell > nav"]
        .map((selector) => {
          const r = document.querySelector(selector)!.getBoundingClientRect();
          return [r.x, r.y, r.width, r.height].map(Math.round).join(",");
        })
        .join(" | ")
        .concat(
          // Content starts the same distance below the tabs everywhere.
          ` | gap ${Math.round(
            document
              .querySelector(
                ".home-hero, .lesson-index, .lesson-sheet, .progress-surface, .start-card",
              )!
              .getBoundingClientRect().top -
              document.querySelector(".shell > nav")!.getBoundingClientRect()
                .bottom,
          )}`,
        ),
    );
  const sections: string[] = [];
  for (const section of ["Lessons", "Progress", "Practice"]) {
    await page.getByRole("button", { name: section, exact: true }).click();
    await page.waitForTimeout(150);
    sections.push(await chrome());
  }
  assert.equal(
    new Set(sections).size,
    1,
    `Header moved: ${sections.join(" / ")}`,
  );
  await exitPractice(page);
  await page.getByRole("button", { name: "Progress", exact: true }).click();
  await page.locator(".progress-skill-card").first().waitFor();
  await page.locator(".account-menu summary").click();
  await page.getByRole("button", { name: "Add learner", exact: true }).click();
  await page
    .getByLabel("Learner name", { exact: true })
    .fill("LongNickname".repeat(5));
  const creation = page.waitForResponse(
    (response) =>
      response.url().endsWith("/learners") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Create learner", exact: true })
    .click();
  learnerIds.push((await (await creation).json()).id);
  // A reload keeps the learner chosen on this device.
  await page.reload();
  await page.getByRole("combobox", { name: "Learner", exact: true }).waitFor();
  assert.equal(
    await page
      .getByRole("combobox", { name: "Learner", exact: true })
      .inputValue(),
    learnerIds.at(-1),
  );
  await page.getByRole("button", { name: "Practice", exact: true }).click();
  await page.getByRole("heading", { name: /^What year was/ }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "A maximum-length learner nickname must fit a phone viewport",
  );
  // The real application mounts parent controls independently of learning consent.
  await page.locator(".account-menu summary").click();
  await page
    .locator(".account-menu")
    .getByRole("button", { name: "Manage family", exact: true })
    .click();
  await page.locator(".family-center").waitFor();
  for (const size of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(size);
    await page
      .getByRole("navigation", { name: "Family sections" })
      .getByRole("button", { name: "Privacy", exact: true })
      .click();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    );
    const back = await page
      .getByRole("button", { name: "Back", exact: true })
      .boundingBox();
    assert.ok(
      back && back.y + back.height <= size.height,
      "Family exit stays visible",
    );
    if (size.width !== 844) {
      const lastChoice = await page
        .getByRole("button", { name: "What is retained?", exact: false })
        .boundingBox();
      assert.ok(
        lastChoice && lastChoice.y + lastChoice.height <= size.height,
        `Privacy choices fit phone viewport at ${size.width}×${size.height}: ${JSON.stringify(lastChoice)}`,
      );
    }
    await page.screenshot({
      path: new URL(
        `../artifacts/screenshots/family-in-app-${size.width}.png`,
        import.meta.url,
      ).pathname,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.waitForFunction(() =>
    document.activeElement?.matches(".account-menu summary"),
  );
  let releaseFamilyBatch!: () => void, familyBatchHeld!: () => void;
  const familyBatchRelease = new Promise<void>((resolve) => {
    releaseFamilyBatch = resolve;
  });
  const familyBatchWaiting = new Promise<void>((resolve) => {
    familyBatchHeld = resolve;
  });
  await page.route("**/batches", async (route) => {
    const result = await route.fetch();
    familyBatchHeld();
    await familyBatchRelease;
    await route.fulfill({ response: result });
  });
  await page.getByRole("button", { name: "2016", exact: true }).click();
  await page.getByRole("button", { name: "Go", exact: true }).click();
  await familyBatchWaiting;
  await page.locator(".account-menu summary").click();
  await page
    .locator(".account-menu")
    .getByRole("button", { name: "Manage family", exact: true })
    .click();
  await page.getByRole("heading", { name: "Who’s learning?" }).waitFor();
  await page
    .getByRole("navigation", { name: "Family sections" })
    .getByRole("button", { name: "Privacy", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Learning consent", exact: false })
    .click();
  // Synthetic mutation isolates this browser race from the shared test account.
  await page.route("**/family/consent/withdraw", (route) =>
    route.fulfill({ json: { withdrawn: true } }),
  );
  await page.route("**/api/v1/family", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "family_service_unavailable" },
    }),
  );
  await page
    .getByRole("button", { name: "Withdraw consent", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Withdraw consent", exact: true })
    .click();
  await page
    .getByText(
      "Your change was saved, but refreshed family details could not be loaded. Try refreshing; do not repeat the deletion.",
      { exact: true },
    )
    .waitFor();
  releaseFamilyBatch();
  await page.waitForTimeout(100);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  assert.equal(
    await page.locator("#answer").count(),
    0,
    "Late batch cannot restore practice after privacy invalidation",
  );
  assert.equal(
    await page.getByRole("button", { name: "Go", exact: true }).count(),
    0,
  );
  assert.equal(
    await page.getByRole("navigation", { name: "Learning sections" }).count(),
    0,
  );
  await page.locator(".account-menu summary").click();
  await page
    .locator(".account-menu")
    .getByRole("button", { name: "Manage family", exact: true })
    .click();
  await page.getByRole("heading", { name: "Family", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Browser learning, hint, attempt, lesson and progress flows passed at desktop and phone widths.",
  );
} finally {
  await browser.close();
  await vite.close();
  await app.close();
  await repository.pool.query(
    "DELETE FROM amp_learners WHERE id=ANY($1::text[])",
    [learnerIds],
  );
  await repository.close();
}
